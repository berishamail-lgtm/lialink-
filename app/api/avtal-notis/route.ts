import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)

function platta(v: any) { return Array.isArray(v) ? v[0] : v }

function mall(o: {
  namn: string
  student: string
  foretag: string
  program: string
  period: string
  skola: string
  url: string
  paminnelse: boolean
}) {
  const inledning = o.paminnelse
    ? 'Vi påminner om att LIA-avtalet nedan fortfarande väntar på din signering. Utan alla tre signaturer kan LIA-perioden inte börja.'
    : 'Ett LIA-avtal har upprättats och väntar på din signering. Logga in, läs igenom avtalet och signera.'

  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1816">
      <div style="background:#0f0e0d;padding:26px 30px;border-radius:14px 14px 0 0">
        <span style="font-size:20px;font-weight:bold;color:#fff">LIA<span style="color:#e8420a">link</span></span>
      </div>
      <div style="border:1px solid #e8e4de;border-top:none;border-radius:0 0 14px 14px;padding:30px">
        <p style="font-size:15px;line-height:1.7;margin:0 0 18px">Hej ${o.namn},</p>
        <p style="font-size:15px;line-height:1.7;margin:0 0 20px">${o.paminnelse ? '' : ''}${inledning}</p>

        <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:24px">
          <tr><td style="padding:6px 0;color:#6b6560">Student</td><td style="padding:6px 0">${o.student}</td></tr>
          <tr><td style="padding:6px 0;color:#6b6560">Företag</td><td style="padding:6px 0">${o.foretag}</td></tr>
          <tr><td style="padding:6px 0;color:#6b6560">Utbildning</td><td style="padding:6px 0">${o.program}</td></tr>
          <tr><td style="padding:6px 0;color:#6b6560">LIA-period</td><td style="padding:6px 0">${o.period}</td></tr>
        </table>

        <a href="${o.url}" style="display:inline-block;background:#e8420a;color:#fff;text-decoration:none;padding:13px 26px;border-radius:100px;font-weight:bold;font-size:14px">
          Läs och signera
        </a>
      </div>
      <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px">
        Skickat av ${o.skola} via LIAlink
      </p>
    </div>
  `
}

export async function POST(req: NextRequest) {
  const { agreementId, paminnelse } = await req.json()

  if (!agreementId) {
    return NextResponse.json({ error: 'Avtals-id saknas' }, { status: 400 })
  }

  const { data: a } = await supabase
    .from('agreements')
    .select(`*,
      placements(lia_periods(name, classes(educations(program_name, school_name)))),
      students(user_id, profiles(full_name, email)),
      companies(user_id, company_name, profiles:user_id(full_name, email))`)
    .eq('id', agreementId)
    .maybeSingle()

  if (!a) {
    return NextResponse.json({ error: 'Avtalet hittades inte' }, { status: 404 })
  }

  if (a.all_signed) {
    return NextResponse.json({ error: 'Avtalet är redan signerat av alla' }, { status: 400 })
  }

  const pl    = platta(a.placements)
  const per   = platta((pl as any)?.lia_periods)
  const kl    = platta((per as any)?.classes)
  const edu   = platta((kl as any)?.educations)
  const stud  = platta(a.students)
  const sProf = platta((stud as any)?.profiles)
  const comp  = platta(a.companies)
  const cProf = platta((comp as any)?.profiles)

  const student = (sProf as any)?.full_name || 'Studenten'
  const foretag = (comp as any)?.company_name || ''
  const program = (edu as any)?.program_name || ''
  const skola   = (edu as any)?.school_name || 'Utbildningsanordnaren'
  const period  = ((per as any)?.name || 'LIA') + ', ' + a.lia_start + ' till ' + a.lia_end
  const url     = req.nextUrl.origin + '/dashboard/agreements'

  const mottagare: { email: string; namn: string }[] = []

  if (!a.student_signed_at && (sProf as any)?.email) {
    mottagare.push({ email: (sProf as any).email, namn: student })
  }

  if (!a.company_signed_at) {
    const epost = (cProf as any)?.email || a.handledare_email
    const namn  = a.handledare_name || (cProf as any)?.full_name || foretag
    if (epost) mottagare.push({ email: epost, namn })
  }

  if (!mottagare.length) {
    return NextResponse.json({ ok: true, skickade: 0 })
  }

  let skickade = 0

  for (const m of mottagare) {
    try {
      await resend.emails.send({
        from: 'LIAlink <noreply@lialink.se>',
        to: m.email,
        subject: paminnelse
          ? 'Påminnelse: LIA-avtal väntar på din signering'
          : 'LIA-avtal väntar på din signering',
        html: mall({
          namn: m.namn,
          student, foretag, program, period, skola, url,
          paminnelse: !!paminnelse,
        }),
      })
      skickade++
    } catch (e) {
      // fortsatt med nasta mottagare
    }
  }

  await supabase
    .from('agreements')
    .update(
      paminnelse
        ? { paminnelse_skickad_at: new Date().toISOString() }
        : { notis_skickad_at: new Date().toISOString() }
    )
    .eq('id', agreementId)

  return NextResponse.json({ ok: true, skickade })
}
