import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
  const { companyId, educationId } = await req.json()

  const { data: co } = await supabase
    .from('companies').select('*').eq('id', companyId).single()

  if (!co)                return NextResponse.json({ error: 'Företaget hittades inte' }, { status: 404 })
  if (co.claimed)         return NextResponse.json({ error: 'Företaget har redan ett konto' }, { status: 400 })
  if (!co.contact_email)  return NextResponse.json({ error: 'Ingen e-postadress på företaget' }, { status: 400 })

  const { data: edu } = await supabase
    .from('educations').select('*, profiles:user_id(full_name)')
    .eq('id', educationId).single()

  const { data: invite, error } = await supabase
    .from('company_invites')
    .insert({ company_id: companyId, education_id: educationId, email: co.contact_email })
    .select('token').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const url = `${req.nextUrl.origin}/valkommen/${invite.token}`
  const ul  = edu?.profiles?.full_name || 'Utbildningsledaren'

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1816">
      <div style="background:#0f0e0d;padding:26px 30px;border-radius:14px 14px 0 0">
        <span style="font-size:20px;font-weight:bold;color:#fff">LIA<span style="color:#e8420a">link</span></span>
      </div>
      <div style="border:1px solid #e8e4de;border-top:none;border-radius:0 0 14px 14px;padding:30px">
        <p style="font-size:15px;line-height:1.7;margin:0 0 18px">Hej ${co.contact_name || ''},</p>
        <p style="font-size:15px;line-height:1.7;margin:0 0 18px">
          ${ul} på ${edu?.school_name || 'skolan'} använder LIAlink för att koordinera
          LIA-platser för ${edu?.program_name || 'utbildningen'}, och har lagt in
          ${co.company_name} bland sina samarbetspartners.
        </p>
        <p style="font-size:15px;line-height:1.7;margin:0 0 24px">
          Skapar ni ett konto ser ni studenter som passar er verksamhet, och kan
          signera LIA-avtal direkt i stället för via mejl fram och tillbaka.
        </p>
        <a href="${url}" style="display:inline-block;background:#e8420a;color:#fff;text-decoration:none;padding:13px 26px;border-radius:100px;font-weight:bold;font-size:14px">
          Skapa konto
        </a>
        <p style="font-size:13px;color:#6b6560;line-height:1.6;margin:24px 0 0">
          Länken gäller i 30 dagar. Vill ni inte vara med behöver ni inte göra något.
        </p>
      </div>
    </div>
  `

  try {
    await resend.emails.send({
      from: 'LIAlink <onboarding@resend.dev>',
      to: co.contact_email,
      subject: `Inbjudan att ta emot LIA-studenter från ${edu?.school_name || 'skolan'}`,
      html,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, email: co.contact_email })
}