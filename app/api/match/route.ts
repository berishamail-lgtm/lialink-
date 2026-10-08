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
    .select('id, program_name, school_name, sector, profiles:user_id(full_name, email)')
    .eq('id', educationId)
    .maybeSingle()

  if (!edu) return NextResponse.json({ error: 'Utbildningen hittades inte' }, { status: 404 })

  // Placeringar som söker
  const { data: cls } = await supabase
    .from('classes').select('id').eq('education_id', educationId)
  const classIds = (cls || []).map(c => c.id)

  if (!classIds.length) {
    return NextResponse.json({ ok: true, skapade: 0, mejl: 0 })
  }

  const { data: per } = await supabase
    .from('lia_periods').select('id, name, start_date, end_date, weeks')
    .in('class_id', classIds)
  const periodIds = (per || []).map(p => p.id)

  if (!periodIds.length) {
    return NextResponse.json({ ok: true, skapade: 0, mejl: 0 })
  }

  const { data: placeringar } = await supabase
    .from('placements')
    .select('id, student_id, lia_period_id, status, students(user_id, skills, profiles(full_name, email, city))')
    .in('lia_period_id', periodIds)
    .in('status', ['söker', 'uppskjuten'])

  if (!placeringar?.length) {
    return NextResponse.json({ ok: true, skapade: 0, mejl: 0 })
  }

  // Företag som är öppna för utbildningen
  const { data: foretag } = await supabase
    .from('companies')
    .select('*, profiles:user_id(full_name, email)')
    .eq('claimed', true)

  const { data: valda } = await supabase
    .from('company_educations').select('company_id').eq('education_id', educationId)
  const valdaIds = new Set((valda || []).map(v => v.company_id))

  const nyaForStudent: Record<string, any[]> = {}
  const nyaForForetag: Record<string, any[]> = {}
  let skapade = 0

  for (const pl of placeringar) {
    const st     = platta((pl as any).students)
    const sProf  = platta((st as any)?.profiles)
    const period = (per || []).find(p => p.id === pl.lia_period_id)
    const skills = ((st as any)?.skills || []) as string[]
    const ort    = ((sProf as any)?.city || '').toLowerCase().trim()

    for (const co of foretag || []) {
      if (co.open_to === 'valda' && !valdaIds.has(co.id)) continue

      let poang = 0

      // Ort, 30
      const coOrt = (co.city || '').toLowerCase().trim()
      if (ort && coOrt && ort === coOrt) poang += 30
      else if (ort && coOrt) poang += 8

      // Kompetenser, 30
      if (skills.length && co.looking_for) {
        const soker = String(co.looking_for).toLowerCase()
        const traff = skills.filter(s => soker.includes(String(s).toLowerCase())).length
        poang += Math.round((traff / skills.length) * 30)
      }

      // Period, 25
      poang += Math.round(overlapp(
        period?.start_date, period?.end_date,
        co.available_from, co.available_to
      ) * 25)

      // Bransch, 15
      if (co.sector && (edu as any).program_name) {
        const prog = String((edu as any).program_name).toLowerCase()
        const bransch = String(co.sector).toLowerCase()
        if (prog.includes(bransch.split(' ')[0]) || bransch.includes(prog.split(' ')[0])) {
          poang += 15
        }
      }

      if (poang < MIN_POANG) continue

      // Finns matchningen redan?
      const { data: finns } = await supabase
        .from('matches').select('id, notis_skickad_at')
        .eq('placement_id', pl.id).eq('company_id', co.id).maybeSingle()

      if (finns) {
        await supabase.from('matches').update({ score: poang }).eq('id', finns.id)
        if (finns.notis_skickad_at) continue   // redan aviserad
      } else {
        const { error } = await supabase.from('matches').insert({
          placement_id: pl.id,
          student_id:   pl.student_id,
          company_id:   co.id,
          score:        poang,
        })
        if (error) continue
        skapade++
      }

      if (poang < MIN_NOTIS) continue

      // Samla för utskick
      const sEpost = (sProf as any)?.email
      if (sEpost) {
        nyaForStudent[sEpost] = nyaForStudent[sEpost] || []
        nyaForStudent[sEpost].push({
          namn: (sProf as any)?.full_name,
          foretag: co.company_name,
          ort: co.city,
          poang,
          period: period?.name,
        })
      }

      const cProf = platta((co as any).profiles)
      const cEpost = (cProf as any)?.email
      if (cEpost) {
        nyaForForetag[cEpost] = nyaForForetag[cEpost] || []
        nyaForForetag[cEpost].push({
          namn: (cProf as any)?.full_name,
          student: (sProf as any)?.full_name,
          poang,
          period: period?.name,
          start: period?.start_date,
          slut: period?.end_date,
        })
      }

      // Markera som aviserad
      await supabase.from('matches')
        .update({ notis_skickad_at: new Date().toISOString() })
        .eq('placement_id', pl.id).eq('company_id', co.id)
    }
  }

  // ── Utskick, ett mejl per mottagare ──
  const ul = platta((edu as any).profiles)
  let mejl = 0

  for (const [epost, lista] of Object.entries(nyaForStudent)) {
    if (mejl >= MEJL_GRANS) break

    const rader = lista
      .sort((a, b) => b.poang - a.poang)
      .slice(0, 5)
      .map(m => kort(
        `<p style="font-size:14px;margin:0 0 3px"><strong>${m.foretag}</strong>${m.ort ? ', ' + m.ort : ''}</p>` +
        `<p style="font-size:13px;color:#6b6560;margin:0">${m.poang}% matchning${m.period ? ' · ' + m.period : ''}</p>`
      )).join('')

    const antal = lista.length
    const html = ram(`
      <p style="font-size:15px;line-height:1.7;margin:0 0 18px">Hej ${lista[0].namn || ''},</p>
      <p style="font-size:15px;line-height:1.7;margin:0 0 20px">
        ${antal === 1 ? 'Ett företag matchar' : antal + ' företag matchar'} din profil och
        din LIA-period. Logga in och läs mer om dem, och hör av dig till de som verkar intressanta.
      </p>
      ${rader}
      <a href="${req.nextUrl.origin}/dashboard/student" style="display:inline-block;background:#e8420a;color:#fff;text-decoration:none;padding:13px 26px;border-radius:100px;font-weight:bold;font-size:14px;margin-top:12px">
        Se dina matchningar
      </a>
      <p style="font-size:13px;color:#6b6560;line-height:1.6;margin:24px 0 0">
        En matchning är ett förslag, inte en plats. Det är du som tar kontakt.
      </p>
    `, `${(edu as any).program_name}, ${(edu as any).school_name}`)

    try {
      await resend.emails.send({
        from: 'LIAlink <noreply@lialink.se>',
        replyTo: (ul as any)?.email || undefined,
        to: epost,
        subject: antal === 1 ? 'Ett företag matchar din profil' : `${antal} företag matchar din profil`,
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
        `<p style="font-size:13px;color:#6b6560;margin:0">${m.poang}% matchning${m.period ? ' · ' + m.period : ''}${m.start ? ', ' + m.start + ' till ' + m.slut : ''}</p>`
      )).join('')

    const antal = lista.length
    const html = ram(`
      <p style="font-size:15px;line-height:1.7;margin:0 0 18px">Hej ${lista[0].namn || ''},</p>
      <p style="font-size:15px;line-height:1.7;margin:0 0 20px">
        ${antal === 1 ? 'En studerande' : antal + ' studerande'} från ${(edu as any).program_name}
        matchar det ni söker. Logga in och läs deras profil och CV.
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
  })
}
