import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
  const { agreementId } = await req.json()

  const { data: a } = await supabase
    .from('agreements')
    .select(`
      *,
      students(program, profiles(full_name, email)),
      companies(company_name, city, profiles:user_id(email)),
      educations(school_name, program_name, profiles:user_id(email))
    `)
    .eq('id', agreementId)
    .single()

  if (!a) {
    return NextResponse.json({ error: 'Avtalet hittades inte' }, { status: 404 })
  }

  // HÃ¤mta PDF:en frÃ¥n vÃ¥r egen route
  const pdfRes = await fetch(`${req.nextUrl.origin}/api/avtal-pdf?id=${agreementId}`)
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer())

  const studentName = a.students?.profiles?.full_name || 'Studenten'
  const companyName = a.companies?.company_name || 'FÃ¶retaget'
  const schoolName  = a.educations?.school_name || 'Utbildningen'

  const recipients = [
    a.students?.profiles?.email,
    a.companies?.profiles?.email,
    a.educations?.profiles?.email,
  ].filter(Boolean) as string[]

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Inga mottagare' }, { status: 400 })
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f0e0d">
      <div style="background:#0f0e0d;padding:28px 32px;border-radius:16px 16px 0 0">
        <div style="font-size:22px;font-weight:bold;color:#fff">LIA<span style="color:#e8420a">link</span></div>
      </div>
      <div style="border:1px solid #ddd9d3;border-top:none;border-radius:0 0 16px 16px;padding:32px">
        <h1 style="font-size:20px;margin:0 0 16px">LIA-avtalet Ã¤r signerat</h1>
        <p style="color:#6b6560;font-size:14px;line-height:1.7;margin:0 0 20px">
          Alla tre parter har nu signerat avtalet. Avtalet gÃ¤ller och en kopia
          finns bifogad som PDF.
        </p>
        <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:20px">
          <tr><td style="padding:8px 0;color:#6b6560">Student</td><td style="padding:8px 0;font-weight:bold">${studentName}</td></tr>
          <tr><td style="padding:8px 0;color:#6b6560">Arbetsgivare</td><td style="padding:8px 0;font-weight:bold">${companyName}</td></tr>
          <tr><td style="padding:8px 0;color:#6b6560">Utbildning</td><td style="padding:8px 0;font-weight:bold">${schoolName}</td></tr>
          <tr><td style="padding:8px 0;color:#6b6560">LIA-period</td><td style="padding:8px 0;font-weight:bold">${a.lia_start} â€“ ${a.lia_end}</td></tr>
        </table>
        <p style="color:#6b6560;font-size:12px;line-height:1.6;margin:0">
          Spara detta mejl som kvitto pÃ¥ signeringen. Vid frÃ¥gor, kontakta din utbildningsledare.
        </p>
      </div>
      <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px">
        Skickat via LIAlink
      </p>
    </div>
  `

  try {
    await resend.emails.send({
      from: 'LIAlink <noreply@lialink.se>',
      to: recipients,
      subject: `LIA-avtal signerat: ${studentName} â†” ${companyName}`,
      html,
      attachments: [{
        filename: `LIA-avtal-${studentName.replace(/\s+/g, '-')}.pdf`,
        content: pdfBuf.toString('base64'),
      }],
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sent: recipients.length })
}
