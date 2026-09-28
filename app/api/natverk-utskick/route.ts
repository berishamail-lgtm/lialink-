import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)

// Marginal mot Resends dagsgräns på 100 mejl
const GRANS = 90

function platta(v: any) { return Array.isArray(v) ? v[0] : v }

export async function POST(req: NextRequest) {
  const { educationId, periodId, amne, meddelande, companyIds } = await req.json()

  if (!educationId || !amne?.trim() || !meddelande?.trim()) {
    return NextResponse.json({ error: 'Ämne och meddelande krävs' }, { status: 400 })
  }

  const { data: edu } = await supabase
    .from('educations')
    .select('program_name, school_name, profiles:user_id(full_name, email)')
    .eq('id', educationId)
    .maybeSingle()

  if (!edu) {
    return NextResponse.json({ error: 'Utbildningen hittades inte' }, { status: 404 })
  }

  const { data: partners } = await supabase
    .from('education_partners')
    .select('id, companies(id, company_name, user_id)')
    .eq('education_id', educationId)
    .eq('utskick', true)
    .eq('aktiv', true)

  const valda: string[] = Array.isArray(companyIds) ? companyIds : []

  // Bygg mottagarlistan från kontaktpersoner, med kontot som reserv
  const mottagare: { email: string; namn: string; foretag: string }[] = []
  const sedda = new Set<string>()

  for (const p of partners || []) {
    const c = platta((p as any).companies) as any
    if (!c) continue
    if (valda.length && !valda.includes(c.id)) continue

    const { data: kontakter } = await supabase
      .from('partner_contacts')
      .select('name, email')
      .eq('partner_id', (p as any).id)
      .eq('aktiv', true)
      .not('email', 'is', null)

    for (const k of kontakter || []) {
      const nyckel = (k.email || '').toLowerCase()
      if (!nyckel || sedda.has(nyckel)) continue
      sedda.add(nyckel)
      mottagare.push({ email: k.email as string, namn: k.name || '', foretag: c.company_name })
    }

    if (!kontakter?.length && c.user_id) {
      const { data: prof } = await supabase
        .from('profiles').select('email, full_name').eq('id', c.user_id).maybeSingle()
      const nyckel = (prof?.email || '').toLowerCase()
      if (nyckel && !sedda.has(nyckel)) {
        sedda.add(nyckel)
        mottagare.push({
          email: prof!.email as string,
          namn: prof?.full_name || '',
          foretag: c.company_name,
        })
      }
    }
  }

  if (!mottagare.length) {
    return NextResponse.json(
      { error: 'Inga mottagare med e-postadress. Lägg till kontaktpersoner på företagen först.' },
      { status: 400 }
    )
  }

  // Periodinfo om vald
  let periodText = ''
  if (periodId) {
    const { data: per } = await supabase
      .from('lia_periods')
      .select('name, start_date, end_date, weeks, classes(name)')
      .eq('id', periodId)
      .maybeSingle()

    if (per) {
      const kl = platta((per as any).classes) as any
      periodText = (per as any).name +
        (kl?.name ? ', ' + kl.name : '') + ': ' +
        (per as any).start_date + ' till ' + (per as any).end_date +
        ((per as any).weeks ? ', ' + (per as any).weeks + ' veckor' : '')
    }
  }

  const ul = platta((edu as any).profiles) as any

  function mall(m: { email: string; namn: string; foretag: string }) {
    return `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1816">
        <div style="background:#0f0e0d;padding:26px 30px;border-radius:14px 14px 0 0">
          <span style="font-size:20px;font-weight:bold;color:#fff">LIA<span style="color:#e8420a">link</span></span>
        </div>
        <div style="border:1px solid #e8e4de;border-top:none;border-radius:0 0 14px 14px;padding:30px">
          <p style="font-size:15px;line-height:1.7;margin:0 0 18px">Hej ${m.namn || m.foretag},</p>

          <div style="font-size:15px;line-height:1.7;margin:0 0 20px;white-space:pre-wrap">${meddelande.trim()}</div>

          ${periodText ? `
            <div style="background:#faf8f5;border:1px solid #e8e4de;border-radius:10px;padding:14px 16px;margin-bottom:20px">
              <p style="font-size:13px;color:#6b6560;margin:0 0 4px">Aktuell LIA-period</p>
              <p style="font-size:14px;margin:0"><strong>${periodText}</strong></p>
            </div>` : ''}

          <p style="font-size:14px;line-height:1.7;margin:0 0 6px">
            Vänliga hälsningar<br>
            ${ul?.full_name || ''}<br>
            <span style="color:#6b6560">${(edu as any).program_name}, ${(edu as any).school_name}</span>
          </p>
        </div>
        <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px;line-height:1.6">
          Du får detta mejl för att ${(edu as any).school_name} har er i sitt LIA-nätverk.<br>
          Vill du inte få fler utskick, svara på mejlet så tar vi bort dig.
        </p>
      </div>
    `
  }

  const misslyckade: string[] = []
  let skickade = 0

  for (const m of mottagare) {
    if (skickade >= GRANS) {
      misslyckade.push(m.email)
      continue
    }

    try {
      await resend.emails.send({
        from: 'LIAlink <noreply@lialink.se>',
        replyTo: ul?.email || undefined,
        to: m.email,
        subject: amne.trim(),
        html: mall(m),
      })
      skickade++
    } catch (e) {
      misslyckade.push(m.email)
    }
  }

  await supabase.from('natverk_utskick').insert({
    education_id:  educationId,
    lia_period_id: periodId || null,
    amne:          amne.trim(),
    meddelande:    meddelande.trim(),
    antal:         skickade,
  })

  return NextResponse.json({
    ok: true,
    skickade,
    totalt: mottagare.length,
    misslyckade: misslyckade.length,
    varning: misslyckade.length
      ? misslyckade.length + ' mejl gick inte fram. Dagsgränsen för utskick kan vara nådd, försök med resten imorgon.'
      : null,
  })
}
