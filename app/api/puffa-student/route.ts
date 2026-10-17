import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)

// En påminnelse till en student som har matchningar men inte hört av sig.
// Skickas bara när UL trycker på knappen — inget automatiskt utskick.

export async function POST(req: NextRequest) {
  const { studentId, educationId, meddelande } = await req.json()

  if (!studentId) {
    return NextResponse.json({ error: 'Student saknas' }, { status: 400 })
  }

  const { data: student } = await supabase
    .from('students')
    .select('id, user_id, profiles(full_name, email)')
    .eq('id', studentId)
    .maybeSingle()

  const prof = student ? (Array.isArray(student.profiles) ? student.profiles[0] : student.profiles) : null
  const epost = (prof as any)?.email

  if (!epost) {
    return NextResponse.json(
      { error: 'Studenten saknar e-postadress' },
      { status: 400 }
    )
  }

  const { data: edu } = await supabase
    .from('educations')
    .select('program_name, school_name, profiles:user_id(full_name, email)')
    .eq('id', educationId)
    .maybeSingle()

  const ul = edu ? (Array.isArray((edu as any).profiles) ? (edu as any).profiles[0] : (edu as any).profiles) : null

  const { data: matchningar } = await supabase
    .from('matches')
    .select('score, companies(company_name, city), lia_platser(titel)')
    .eq('student_id', studentId)
    .gte('score', 50)
    .order('score', { ascending: false })
    .limit(4)

  const lista = matchningar || []

  const kort = lista.map((m: any) => {
    const co    = Array.isArray(m.companies) ? m.companies[0] : m.companies
    const plats = Array.isArray(m.lia_platser) ? m.lia_platser[0] : m.lia_platser
    const titel = plats?.titel
    return `
      <div style="background:#faf8f5;border:1px solid #e8e4de;border-radius:10px;padding:13px 15px;margin-bottom:10px">
        ${titel ? `<p style="font-size:14px;margin:0 0 3px"><strong>${titel}</strong></p>` : ''}
        <p style="font-size:${titel ? 13 : 14}px;color:${titel ? '#6b6560' : '#1a1816'};margin:0 0 3px">
          ${titel ? '' : '<strong>'}${co?.company_name || ''}${titel ? '' : '</strong>'}${co?.city ? ', ' + co.city : ''}
        </p>
        <p style="font-size:13px;color:#6b6560;margin:0">${m.score}% matchning</p>
      </div>`
  }).join('')

  const personligt = (meddelande || '').trim()

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1816">
      <div style="background:#0f0e0d;padding:26px 30px;border-radius:14px 14px 0 0">
        <span style="font-size:20px;font-weight:bold;color:#fff">LIA<span style="color:#e8420a">link</span></span>
      </div>
      <div style="border:1px solid #e8e4de;border-top:none;border-radius:0 0 14px 14px;padding:30px">
        <p style="font-size:15px;line-height:1.7;margin:0 0 18px">Hej ${(prof as any)?.full_name || ''},</p>

        ${personligt
          ? `<p style="font-size:15px;line-height:1.7;margin:0 0 20px">${personligt.replace(/\n/g, '<br>')}</p>`
          : `<p style="font-size:15px;line-height:1.7;margin:0 0 20px">
               Du har matchningar som väntar i LIAlink, men inget företag har hört
               något från dig än. Företagen hör av sig sällan först — det är du som
               tar kontakten, och ett kort meddelande räcker.
             </p>`}

        ${lista.length ? `<p style="font-size:14px;font-weight:bold;margin:0 0 10px">Dina bästa matchningar just nu</p>${kort}` : ''}

        <a href="${req.nextUrl.origin}/dashboard/student" style="display:inline-block;background:#e8420a;color:#fff;text-decoration:none;padding:13px 26px;border-radius:100px;font-weight:bold;font-size:14px;margin-top:12px">
          Öppna LIAlink
        </a>

        <p style="font-size:13px;color:#6b6560;line-height:1.6;margin:24px 0 0">
          Vet du inte vad du ska skriva? Börja med vem du är, vilken period du söker
          och varför just de verkar intressanta. Svara på det här mejlet om du vill
          bolla först.
        </p>
      </div>
      <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px">
        ${(edu as any)?.program_name || ''}${(edu as any)?.school_name ? ', ' + (edu as any).school_name : ''}
      </p>
    </div>
  `

  try {
    await resend.emails.send({
      from: 'LIAlink <noreply@lialink.se>',
      replyTo: (ul as any)?.email || undefined,
      to: epost,
      subject: lista.length
        ? 'Dina LIA-matchningar väntar på ett meddelande'
        : 'En påminnelse om din LIA',
      html,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, epost, antalMatchningar: lista.length })
}
