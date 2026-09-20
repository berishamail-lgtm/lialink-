import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
    const { educationId, periodId, amne, meddelande, companyIds } = await req.json()

  if (!educationId || !amne?.trim() || !meddelande?.trim()) {
    return NextResponse.json({ error: 'Ämne och meddelande krävs' }, { status: 400 })
  }

  const { data: edu } = await supabase
    .from('educations')
    .select('program_name, school_name, profiles:user_id(full_name, email)')
    .eq('id', educationId)
    .single()

  if (!edu) return NextResponse.json({ error: 'Utbildningen hittades inte' }, { status: 404 })

  // Mottagare: företag i nätverket som inte avsagt sig
  const { data: partners } = await supabase
    .from('education_partners')
    .select('id, companies(id, company_name, contact_name, contact_email, user_id)')
    .eq('education_id', educationId)
    .eq('utskick', true)
    const valda: string[] = Array.isArray(companyIds) ? companyIds : []

  // Hämta e-post även för företag med konto
  const mottagare: { email: string; namn: string; foretag: string }[] = []

  for (const p of partners || []) {
    const c = (p as any).companies
        if (!c) continue
    if (valda.length && !valda.includes(c.id)) continue

    let epost = c.contact_email
    let namn  = c.contact_name || ''

    if (!epost && c.user_id) {
      const { data: prof } = await supabase
        .from('profiles').select('email, full_name').eq('id', c.user_id).maybeSingle()
      epost = prof?.email
      namn  = namn || prof?.full_name || ''
    }

    if (epost) mottagare.push({ email: epost, namn, foretag: c.company_name })
  }

  if (!mottagare.length) {
    return NextResponse.json({ error: 'Inga mottagare med e-postadress i nätverket' }, { status: 400 })
  }

  // Periodinfo om vald
  let periodText = ''
  if (periodId) {
    const { data: per } = await supabase
      .from('lia_periods').select('name, start_date, end_date, weeks, classes(name)')
      .eq('id', periodId).single()
    if (per) {
      const klass = (per as any).classes?.name
      periodText = `${per.name}${klass ? `, ${klass}` : ''}: ${per.start_date} till ${per.end_date}${per.weeks ? `, ${per.weeks} veckor` : ''}`
    }
  }

  const ul = (edu as any).profiles
  let skickade = 0

  for (const m of mottagare) {
    const html = `
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
            </div>
          ` : ''}
          <p style="font-size:14px;line-height:1.7;margin:0 0 6px">
            Vänliga hälsningar<br>
            ${ul?.full_name || ''}<br>
            <span style="color:#6b6560">${edu.program_name}, ${edu.school_name}</span>
          </p>
        </div>
        <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px;line-height:1.6">
          Du får detta mejl för att ${edu.school_name} har dig i sitt LIA-nätverk.<br>
          Vill du inte få fler utskick, svara på mejlet så tar vi bort dig.
        </p>
      </div>
    `

    try {
      await resend.emails.send({
        from: 'LIAlink <noreply@lialink.se>',
        replyTo: ul?.email || undefined,
        to: m.email,
        subject: amne.trim(),
        html,
      })
      skickade++
    } catch (e) {
      // fortsätt med nästa mottagare
    }
  }

  await supabase.from('natverk_utskick').insert({
    education_id:  educationId,
    lia_period_id: periodId || null,
    amne:          amne.trim(),
    meddelande:    meddelande.trim(),
    antal:         skickade,
  })

  return NextResponse.json({ ok: true, skickade, totalt: mottagare.length })
}