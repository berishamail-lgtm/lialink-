import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)

const MIN_POANG  = 20   // sparas i databasen
const MIN_NOTIS  = 60   // mejlas ut
const MEJL_GRANS = 80   // marginal mot Resends dygnsgräns

function platta(v: any) { return Array.isArray(v) ? v[0] : v }

function overlapp(aStart: any, aSlut: any, bStart: any, bSlut: any) {
  if (!aStart || !aSlut || !bStart || !bSlut) return 0
  const s = new Date(Math.max(new Date(aStart).getTime(), new Date(bStart).getTime()))
  const e = new Date(Math.min(new Date(aSlut).getTime(), new Date(bSlut).getTime()))
  if (e <= s) return 0
  const dagar = (e.getTime() - s.getTime()) / 86400000
  const total = (new Date(aSlut).getTime() - new Date(aStart).getTime()) / 86400000
  return total > 0 ? Math.min(1, dagar / total) : 0
}

// Hur stor del av det platsen efterfrågar har studenten?
function kompetensPoang(skills: string[], plats: any) {
  if (!skills.length) return 0

  const egna = skills.map(s => String(s).toLowerCase().trim()).filter(Boolean)
  const krav = (plats.kompetenser || [])
    .map((k: string) => String(k).toLowerCase().trim())
    .filter(Boolean)

  if (krav.length) {
    const traff = krav.filter((k: string) =>
      egna.some(s => s === k || s.includes(k) || k.includes(s))
    ).length
    return Math.round((traff / krav.length) * 30)
  }

  // Platsen har ingen kompetenslista — läs titeln och beskrivningen i stället.
  const text = [plats.titel, plats.beskrivning].filter(Boolean).join(' ').toLowerCase()
  if (!text) return 0
  const traff = egna.filter(s => text.includes(s)).length
  return Math.round((traff / egna.length) * 30)
}

function kort(s: string) {
  return `<div style="background:#faf8f5;border:1px solid #e8e4de;border-radius:10px;padding:13px 15px;margin-bottom:10px">${s}</div>`
}

function ram(innehall: string, fot: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1816">
      <div style="background:#0f0e0d;padding:26px 30px;border-radius:14px 14px 0 0">
        <span style="font-size:20px;font-weight:bold;color:#fff">LIA<span style="color:#e8420a">link</span></span>
      </div>
      <div style="border:1px solid #e8e4de;border-top:none;border-radius:0 0 14px 14px;padding:30px">
        ${innehall}
      </div>
      <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px">${fot}</p>
    </div>
  `
}

export async function POST(req: NextRequest) {
  const { educationId } = await req.json()

  if (!educationId) {
    return NextResponse.json({ error: 'Utbildning saknas' }, { status: 400 })
  }

  const { data: edu } = await supabase
    .from('educations')
    .select('id, program_name, school_name, profiles:user_id(full_name, email)')
    .eq('id', educationId)
    .maybeSingle()

  if (!edu) return NextResponse.json({ error: 'Utbildningen hittades inte' }, { status: 404 })

  const tomtSvar = { ok: true, skapade: 0, mejl: 0, studenter: 0, foretag: 0, platser: 0 }

  // ── Placeringar som söker ──────────────────────────────────────
  const { data: cls } = await supabase
    .from('classes').select('id').eq('education_id', educationId)
  const classIds = (cls || []).map(c => c.id)
  if (!classIds.length) return NextResponse.json(tomtSvar)

  const { data: per } = await supabase
    .from('lia_periods').select('id, name, start_date, end_date, weeks')
    .in('class_id', classIds)
  const periodIds = (per || []).map(p => p.id)
  if (!periodIds.length) return NextResponse.json(tomtSvar)

  const { data: placeringar } = await supabase
    .from('placements')
    .select('id, student_id, lia_period_id, status, students(user_id, skills, profiles(full_name, email, city))')
    .in('lia_period_id', periodIds)
    .in('status', ['söker', 'uppskjuten'])

  if (!placeringar?.length) return NextResponse.json(tomtSvar)

  // ── Öppna platser hos företag med konto ────────────────────────
  const { data: platser } = await supabase
    .from('lia_platser')
    .select(`
      id, company_id, handledare_id, titel, beskrivning, kompetenser,
      bransch, ort, period_start, period_end, antal_lediga, open_to, status,
      companies!inner(
        id, company_name, city, sector, claimed,
        lia_period_start, lia_period_end,
        profiles:user_id(full_name, email)
      ),
      handledare(name, email)
    `)
    .eq('status', 'oppen')
    .eq('companies.claimed', true)

  if (!platser?.length) return NextResponse.json(tomtSvar)

  // Platser som är begränsade till valda utbildningar
  const { data: pe } = await supabase
    .from('plats_educations').select('plats_id').eq('education_id', educationId)
  const tillatna = new Set((pe || []).map((r: any) => r.plats_id))

  const relevanta = (platser as any[]).filter(p =>
    p.open_to !== 'valda' || tillatna.has(p.id)
  )

  if (!relevanta.length) return NextResponse.json(tomtSvar)

  const nyaForStudent: Record<string, any[]> = {}
  const nyaForForetag: Record<string, any[]> = {}
  let skapade = 0

  const programNamn = String((edu as any).program_name || '')

  for (const pl of placeringar) {
    const st     = platta((pl as any).students)
    const sProf  = platta((st as any)?.profiles)
    const period = (per || []).find(p => p.id === pl.lia_period_id)
    const skills = ((st as any)?.skills || []) as string[]
    const ort    = ((sProf as any)?.city || '').toLowerCase().trim()

    // Bästa platsen per företag. Ett företag med tre behov ska inte dyka upp
    // tre gånger i kandidatlistan — studenten matchas mot det som passar bäst.
    const bastPerForetag: Record<string, { poang: number; plats: any; delar: any }> = {}

    for (const plats of relevanta) {
      const co = platta(plats.companies)
      if (!co) continue

      const platsOrt     = (plats.ort || co.city || '').toLowerCase().trim()
      const platsStart   = plats.period_start || co.lia_period_start
      const platsSlut    = plats.period_end   || co.lia_period_end
      const platsBransch = plats.bransch      || co.sector

      let pOrt = 0
      if (ort && platsOrt) pOrt = ort === platsOrt ? 30 : 8

      const pSkills = kompetensPoang(skills, plats)

      const pPeriod = Math.round(
        overlapp(period?.start_date, period?.end_date, platsStart, platsSlut) * 25
      )

      let pBransch = 0
      if (platsBransch && programNamn) {
        const prog    = programNamn.toLowerCase()
        const bransch = String(platsBransch).toLowerCase()
        if (prog.includes(bransch.split(' ')[0]) || bransch.includes(prog.split(' ')[0])) {
          pBransch = 15
        }
      }

      const poang = pOrt + pSkills + pPeriod + pBransch
      if (poang < MIN_POANG) continue

      const nuvarande = bastPerForetag[co.id]
      if (!nuvarande || poang > nuvarande.poang) {
        bastPerForetag[co.id] = {
          poang,
          plats,
          delar: { ort: pOrt, skills: pSkills, period: pPeriod, bransch: pBransch },
        }
      }
    }

    for (const [companyId, bast] of Object.entries(bastPerForetag)) {
      const { poang, plats, delar } = bast
      const co = platta(plats.companies)

      const { data: finns } = await supabase
        .from('matches').select('id, notis_skickad_at')
        .eq('placement_id', pl.id).eq('company_id', companyId).maybeSingle()

      if (finns) {
        await supabase.from('matches').update({
          score:        poang,
          score_city:   delar.ort,
          score_skills: delar.skills,
          score_period: delar.period,
          score_sector: delar.bransch,
          plats_id:     plats.id,
        }).eq('id', finns.id)

        if (finns.notis_skickad_at) continue   // redan aviserad
      } else {
        const { error } = await supabase.from('matches').insert({
          placement_id: pl.id,
          student_id:   pl.student_id,
          company_id:   companyId,
          plats_id:     plats.id,
          score:        poang,
          score_city:   delar.ort,
          score_skills: delar.skills,
          score_period: delar.period,
          score_sector: delar.bransch,
        })
        if (error) continue
        skapade++
      }

      if (poang < MIN_NOTIS) continue

      const sEpost = (sProf as any)?.email
      if (sEpost) {
        nyaForStudent[sEpost] = nyaForStudent[sEpost] || []
        nyaForStudent[sEpost].push({
          namn:    (sProf as any)?.full_name,
          foretag: co.company_name,
          titel:   plats.titel,
          ort:     plats.ort || co.city,
          poang,
          period:  period?.name,
        })
      }

      const cProf  = platta(co.profiles)
      const cEpost = (cProf as any)?.email
      if (cEpost) {
        nyaForForetag[cEpost] = nyaForForetag[cEpost] || []
        nyaForForetag[cEpost].push({
          namn:    (cProf as any)?.full_name,
          student: (sProf as any)?.full_name,
          titel:   plats.titel,
          poang,
          period:  period?.name,
          start:   period?.start_date,
          slut:    period?.end_date,
        })
      }

      await supabase.from('matches')
        .update({ notis_skickad_at: new Date().toISOString() })
        .eq('placement_id', pl.id).eq('company_id', companyId)
    }
  }

  // ── Utskick, ett mejl per mottagare ────────────────────────────
  const ul = platta((edu as any).profiles)
  let mejl = 0

  for (const [epost, lista] of Object.entries(nyaForStudent)) {
    if (mejl >= MEJL_GRANS) break

    const rader = lista
      .sort((a, b) => b.poang - a.poang)
      .slice(0, 5)
      .map(m => kort(
        `<p style="font-size:14px;margin:0 0 3px"><strong>${m.titel}</strong></p>` +
        `<p style="font-size:13px;color:#6b6560;margin:0 0 3px">${m.foretag}${m.ort ? ', ' + m.ort : ''}</p>` +
        `<p style="font-size:13px;color:#6b6560;margin:0">${m.poang}% matchning${m.period ? ' · ' + m.period : ''}</p>`
      )).join('')

    const antal = lista.length
    const html = ram(`
      <p style="font-size:15px;line-height:1.7;margin:0 0 18px">Hej ${lista[0].namn || ''},</p>
      <p style="font-size:15px;line-height:1.7;margin:0 0 20px">
        ${antal === 1 ? 'En LIA-plats matchar' : antal + ' LIA-platser matchar'} din profil och
        din period. Logga in och läs mer, och hör av dig till de som verkar intressanta.
      </p>
      ${rader}
      <a href="${req.nextUrl.origin}/dashboard/student" style="display:inline-block;background:#e8420a;color:#fff;text-decoration:none;padding:13px 26px;border-radius:100px;font-weight:bold;font-size:14px;margin-top:12px">
        Se dina matchningar
      </a>
      <p style="font-size:13px;color:#6b6560;line-height:1.6;margin:24px 0 0">
        En matchning är ett förslag, inte en plats. Det är du som tar kontakt.
      </p>
    `, `${programNamn}, ${(edu as any).school_name}`)

    try {
      await resend.emails.send({
        from: 'LIAlink <noreply@lialink.se>',
        replyTo: (ul as any)?.email || undefined,
        to: epost,
        subject: antal === 1 ? 'En LIA-plats matchar din profil' : `${antal} LIA-platser matchar din profil`,
        html,
      })
      mejl++
    } catch (e) { /* fortsätt */ }
  }

  for (const [epost, lista] of Object.entries(nyaForForetag)) {
    if (mejl >= MEJL_GRANS) break

    const rader = lista
      .sort((a, b) => b.poang - a.poang)
      .slice(0, 5)
      .map(m => kort(
        `<p style="font-size:14px;margin:0 0 3px"><strong>${m.student}</strong></p>` +
        `<p style="font-size:13px;color:#6b6560;margin:0 0 3px">${m.titel}</p>` +
        `<p style="font-size:13px;color:#6b6560;margin:0">${m.poang}% matchning${m.period ? ' · ' + m.period : ''}${m.start ? ', ' + m.start + ' till ' + m.slut : ''}</p>`
      )).join('')

    const antal = lista.length
    const html = ram(`
      <p style="font-size:15px;line-height:1.7;margin:0 0 18px">Hej ${lista[0].namn || ''},</p>
      <p style="font-size:15px;line-height:1.7;margin:0 0 20px">
        ${antal === 1 ? 'En studerande' : antal + ' studerande'} från ${programNamn}
        matchar en av era platser. Logga in och läs deras profil och CV.
      </p>
      ${rader}
      <a href="${req.nextUrl.origin}/dashboard/company" style="display:inline-block;background:#e8420a;color:#fff;text-decoration:none;padding:13px 26px;border-radius:100px;font-weight:bold;font-size:14px;margin-top:12px">
        Se kandidaterna
      </a>
      <p style="font-size:13px;color:#6b6560;line-height:1.6;margin:24px 0 0">
        Vill ni ta emot någon klickar ni &bdquo;Vi tar emot&rdquo; så upprättar
        utbildningsledaren avtalet.
      </p>
    `, `${(edu as any).school_name} via LIAlink`)

    try {
      await resend.emails.send({
        from: 'LIAlink <noreply@lialink.se>',
        replyTo: (ul as any)?.email || undefined,
        to: epost,
        subject: antal === 1 ? 'En kandidat matchar er' : `${antal} kandidater matchar er`,
        html,
      })
      mejl++
    } catch (e) { /* fortsätt */ }
  }

  return NextResponse.json({
    ok: true,
    skapade,
    mejl,
    studenter: Object.keys(nyaForStudent).length,
    foretag: Object.keys(nyaForForetag).length,
    platser: relevanta.length,
  })
}
