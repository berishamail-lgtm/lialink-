import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
  const { companyId, email, name } = await req.json()

  if (!companyId || !email) {
    return NextResponse.json({ error: 'Uppgifter saknas' }, { status: 400 })
  }

  const { data: co } = await supabase
    .from('companies').select('company_name').eq('id', companyId).single()

  if (!co) return NextResponse.json({ error: 'FÃ¶retaget hittades inte' }, { status: 404 })

  const { data: invite, error } = await supabase
    .from('member_invites')
    .insert({ company_id: companyId, email: email.trim(), name: name?.trim() || null })
    .select('token').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const url = `${req.nextUrl.origin}/handledare/${invite.token}`

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1816">
      <div style="background:#0f0e0d;padding:26px 30px;border-radius:14px 14px 0 0">
        <span style="font-size:20px;font-weight:bold;color:#fff">LIA<span style="color:#e8420a">link</span></span>
      </div>
      <div style="border:1px solid #e8e4de;border-top:none;border-radius:0 0 14px 14px;padding:30px">
        <p style="font-size:15px;line-height:1.7;margin:0 0 18px">Hej ${name || ''},</p>
        <p style="font-size:15px;line-height:1.7;margin:0 0 24px">
          ${co.company_name} anvÃ¤nder LIAlink fÃ¶r att ta emot LIA-studenter, och har
          lagt till dig som handledare. Med ett konto ser du dina studenter, kan skriva
          till dem och signera LIA-avtal digitalt.
        </p>
        <a href="${url}" style="display:inline-block;background:#e8420a;color:#fff;text-decoration:none;padding:13px 26px;border-radius:100px;font-weight:bold;font-size:14px">
          Skapa ditt konto
        </a>
        <p style="font-size:13px;color:#6b6560;line-height:1.6;margin:24px 0 0">
          LÃ¤nken gÃ¤ller i 30 dagar.
        </p>
      </div>
    </div>
  `

  try {
    await resend.emails.send({
      from: 'LIAlink <noreply@lialink.se>',
      to: email.trim(),
      subject: `Du Ã¤r tillagd som handledare hos ${co.company_name}`,
      html,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, email: email.trim() })
}
