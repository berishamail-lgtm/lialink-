import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
  const { namn, email, classId, city } = await req.json()

  if (!namn || !email || !classId) {
    return NextResponse.json({ error: 'Namn, e-post och klass krävs' }, { status: 400 })
  }

  const rensad = email.trim().toLowerCase()

  // Klassen och utbildningen
  const { data: klass } = await supabase
    .from('classes')
    .select('id, name, yh_kod, educations(program_name, school_name)')
    .eq('id', classId)
    .single()

  if (!klass) return NextResponse.json({ error: 'Klassen hittades inte' }, { status: 404 })
  const eduInfo = Array.isArray(klass.educations) ? klass.educations[0] : klass.educations
  // Finns användaren redan?
  const { data: befintlig } = await supabase
    .from('profiles').select('id, role').eq('email', rensad).maybeSingle()

  let userId = befintlig?.id

  if (!userId) {
    const { data: ny, error: authErr } = await supabase.auth.admin.createUser({
      email: rensad,
      email_confirm: true,
      user_metadata: { full_name: namn.trim(), role: 'student' },
    })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })
    userId = ny.user?.id
  }

  if (!userId) return NextResponse.json({ error: 'Kunde inte skapa konto' }, { status: 500 })

  if (city?.trim()) {
    await supabase.from('profiles').update({ city: city.trim() }).eq('id', userId)
  }

  // Studentprofil
  const { data: finnsStudent } = await supabase
    .from('students').select('id').eq('user_id', userId).maybeSingle()

  let studentId = finnsStudent?.id

  if (finnsStudent) {
    await supabase.from('students').update({ class_id: classId }).eq('id', finnsStudent.id)
  } else {
    const { data: skapad, error: sErr } = await supabase
      .from('students')
      .insert({
        user_id:      userId,
        class_id:     classId,
        program:      eduInfo?.program_name || '',
        school:       eduInfo?.school_name  || '',
        status:       'söker',
        skapad_av_ul: true,
      })
      .select('id').single()
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
    studentId = skapad?.id
  }

  // Placeringar för klassens perioder
  if (studentId) {
    const { data: perioder } = await supabase
      .from('lia_periods').select('id').eq('class_id', classId)

    for (const p of perioder || []) {
      await supabase.from('placements')
        .insert({ student_id: studentId, lia_period_id: p.id, status: 'söker' })
        .select()
    }
  }

  // Inbjudan med länk för att välja lösenord
  const { data: lank } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: rensad,
    options: { redirectTo: `${req.nextUrl.origin}/nytt-losenord` },
  })

  const url = lank?.properties?.action_link

  if (url) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1816">
        <div style="background:#0f0e0d;padding:26px 30px;border-radius:14px 14px 0 0">
          <span style="font-size:20px;font-weight:bold;color:#fff">LIA<span style="color:#e8420a">link</span></span>
        </div>
        <div style="border:1px solid #e8e4de;border-top:none;border-radius:0 0 14px 14px;padding:30px">
          <p style="font-size:15px;line-height:1.7;margin:0 0 18px">Hej ${namn.trim()},</p>
          <p style="font-size:15px;line-height:1.7;margin:0 0 24px">
            Din utbildningsledare har lagt upp dig i LIAlink, där du hittar din
            LIA-plats. Välj ett lösenord så kommer du igång. Fyll sedan i din ort
            och dina kompetenser så börjar vi matcha dig mot företag.
          </p>
          <a href="${url}" style="display:inline-block;background:#e8420a;color:#fff;text-decoration:none;padding:13px 26px;border-radius:100px;font-weight:bold;font-size:14px">
            Välj lösenord
          </a>
          <p style="font-size:13px;color:#6b6560;line-height:1.6;margin:24px 0 0">
            Du är kopplad till ${eduInfo?.program_name}, klass ${klass.name}.
          </p>
        </div>
      </div>
    `

    try {
      await resend.emails.send({
        from: 'LIAlink <noreply@lialink.se>',
        to: rensad,
        subject: 'Din LIA-plats börjar här',
        html,
      })
    } catch (e) {
      return NextResponse.json({ ok: true, varning: 'Kontot skapades men mejlet gick inte fram.' })
    }
  }

  return NextResponse.json({ ok: true, email: rensad })
}