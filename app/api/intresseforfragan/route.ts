import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)

function platta(v: any) { return Array.isArray(v) ? v[0] : v }

export async function POST(req: NextRequest) {
  const { educationId, periodId, partnerIds } = await req.json()

  if (!educationId || !Array.isArray(partnerIds) || !partnerIds.length) {
    return NextResponse.json({ error: 'Utbildning och mottagare krävs' }, { status: 400 })
  }

  const { data: edu } = await supabase
    .from('educations')
    .select('program_name, school_name, profiles:user_id(full_name, email)')
    .eq('id', educationId)
    .maybeSingle()

  if (!edu) {
    return NextResponse.json({ error: 'Utbildningen hittades inte' }, { status: 404 })
  }

  let periodText = ''
  if (periodId) {
    const { data: per } = await supabase
      .from('lia_periods')
      .select('name, start_date, end_date, weeks, classes(name)')
      .eq('id', periodId)
      .maybeSingle()

    if (per) {
      const kl = platta((per as any).classes)
      periodText = (per as any).name +
        ((kl as any)?.name ? ', ' + (kl as any).name : '') + ': ' +
        (per as any).start_date + ' till ' + (per as any).end_date +
        ((per as any).weeks ? ', ' + (per as any).weeks + ' veckor' : '')
    }
  }

  const { data: forfragan, error: fErr } = await supabase
    .from('intresseforfragan')
    .insert({ education_id: educationId, lia_period_id: periodId || null })
    .select('id')
    .single()

  if (fErr || !forfragan) {
    return NextResponse.json({ error: fErr?.message || 'Kunde inte skapa förfrågan' }, { status: 500 })
  }

  const ul = platta((edu as any).profiles)
  let skickade = 0

  for (const pid of partnerIds) {
    const { data: svar, error: sErr } = await supabase
      .from('intressesvar')
      .insert({ forfragan_id: forfragan.id, partner_id: pid })
      .select('token')
      .single()

    if (sErr || !svar) continue

    const { data: partner } = await supabase
      .from('education_partners')
      .select('companies(company_name)')
      .eq('id', pid)
      .maybeSingle()

    const foretag = (platta((partner as any)?.companies) as any)?.company_name || ''

    const { data: kont } = await supabase
      .from('partner_contacts')
      .select('name, email')
      .eq('partner_id', pid)
      .eq('aktiv', true)
      .not('email', 'is', null)

    const url = req.nextUrl.origin + '/intresse/' + svar.token

    for (const k of kont || []) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1816">
          <div style="background:#0f0e0d;padding:26px 30px;border-radius:14px 14px 0 0">
            <span style="font-size:20px;font-weight:bold;color:#fff">LIA<span style="color:#e8420a">link</span></span>
          </div>
          <div style="border:1px solid #e8e4de;border-top:none;border-radius:0 0 14px 14px;padding:30px">
            <p style="font-size:15px;line-height:1.7;margin:0 0 18px">Hej ${k.name || ''},</p>

            <p style="font-size:15px;line-height:1.7;margin:0 0 20px">
              Vi planerar nu nästa LIA-period för ${(edu as any).program_name} och hör av
              oss till er i vårt nätverk. Har ni möjlighet att ta emot en studerande?
            </p>

            ${periodText ? `
              <div style="background:#faf8f5;border:1px solid #e8e4de;border-radius:10px;padding:14px 16px;margin-bottom:22px">
                <p style="font-size:13px;color:#6b6560;margin:0 0 4px">Perioden det gäller</p>
                <p style="font-size:14px;margin:0"><strong>${periodText}</strong></p>
              </div>` : ''}

            <p style="font-size:15px;line-height:1.7;margin:0 0 22px">
              Svara med ett klick. Det tar tjugo sekunder, och ni binder er inte till
              något genom att svara ja.
            </p>

            <a href="${url}" style="display:inline-block;background:#e8420a;color:#fff;text-decoration:none;padding:13px 26px;border-radius:100px;font-weight:bold;font-size:14px">
              Svara här
            </a>

            <p style="font-size:14px;line-height:1.7;margin:26px 0 0">
              Vänliga hälsningar<br>
              ${(ul as any)?.full_name || ''}<br>
              <span style="color:#6b6560">${(edu as any).program_name}, ${(edu as any).school_name}</span>
            </p>
          </div>
          <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px">
            Ni får detta för att ${(edu as any).school_name} har ${foretag} i sitt LIA-nätverk.
          </p>
        </div>
      `

      try {
        await resend.emails.send({
          from: 'LIAlink <noreply@lialink.se>',
          replyTo: (ul as any)?.email || undefined,
          to: k.email,
          subject: 'Kan ni ta emot en LIA-studerande i ' + (edu as any).program_name + '?',
          html,
        })
        skickade++
      } catch (e) {
        // fortsatt med nasta mottagare
      }
    }
  }

  return NextResponse.json({ ok: true, skickade, forfraganId: forfragan.id })
}
