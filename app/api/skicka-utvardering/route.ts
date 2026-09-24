import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
  const { placementId, paminnelse } = await req.json()

  if (!placementId) {
    return NextResponse.json({ error: 'Placerings-id saknas' }, { status: 400 })
  }

  const { data: pl } = await supabase
    .from('placements')
    .select(`
      id, actual_start, actual_end,
      lia_periods(name, start_date, end_date, classes(educations(school_name, program_name))),
      students(profiles(full_name)),
      companies(company_name)
    `)
    .eq('id', placementId)
    .maybeSingle()

  if (!pl) {
    return NextResponse.json({ error: 'Placeringen hittades inte' }, { status: 404 })
  }

  const { data: avtal } = await supabase
    .from('agreements')
    .select('id, handledare_name, handledare_email')
    .eq('placement_id', placementId)
    .maybeSingle()

  if (!avtal?.handledare_email) {
    return NextResponse.json(
      { error: 'Ingen e-post till handledaren. Fyll i den på avtalet först.' },
      { status: 400 }
    )
  }

  let { data: ev } = await supabase
    .from('evaluations')
    .select('id, token, status')
    .eq('placement_id', placementId)
    .maybeSingle()

  if (ev?.status === 'besvarat') {
    return NextResponse.json({ error: 'Utvärderingen är redan besvarad' }, { status: 409 })
  }

  if (!ev) {
    const { data: ny, error: evErr } = await supabase
      .from('evaluations')
      .insert({
        placement_id:     placementId,
        agreement_id:     avtal.id,
        handledare_name:  avtal.handledare_name,
        handledare_email: avtal.handledare_email,
      })
      .select('id, token, status')
      .single()

    if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 })
    ev = ny
  }

  // Plocka ut nastlade varden robust
  const per   = Array.isArray(pl.lia_periods) ? pl.lia_periods[0] : pl.lia_periods
  const kl    = per && (Array.isArray((per as any).classes) ? (per as any).classes[0] : (per as any).classes)
  const edu   = kl && (Array.isArray((kl as any).educations) ? (kl as any).educations[0] : (kl as any).educations)
  const stud  = Array.isArray(pl.students) ? pl.students[0] : pl.students
  const sProf = stud && (Array.isArray((stud as any).profiles) ? (stud as any).profiles[0] : (stud as any).profiles)
  const comp  = Array.isArray(pl.companies) ? pl.companies[0] : pl.companies

  const studentNamn = (sProf as any)?.full_name || 'Studenten'
  const foretag     = (comp as any)?.company_name || ''
  const skola       = (edu as any)?.school_name || 'Utbildningsanordnaren'
  const program     = (edu as any)?.program_name || ''
  const start       = pl.actual_start || (per as any)?.start_date
  const slut        = pl.actual_end   || (per as any)?.end_date
  const periodNamn  = (per as any)?.name || 'LIA'

  const url = `${req.nextUrl.origin}/utvardering/${ev.token}`

  const inledning = paminnelse
    ? `Vi skickade nyligen en utvärdering för ${studentNamn}s LIA-period hos er, och har inte fått in några svar än. Hinner ni svara tar det ett par minuter.`
    : `${studentNamn} har nu avslutat sin LIA-period hos er. Som handledare är er bedömning en del av underlaget för att studenten ska bli godkänd på kursen.`

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1816">
      <div style="background:#0f0e0d;padding:26px 30px;border-radius:14px 14px 0 0">
        <span style="font-size:20px;font-weight:bold;color:#fff">LIA<span style="color:#e8420a">link</span></span>
      </div>
      <div style="border:1px solid #e8e4de;border-top:none;border-radius:0 0 14px 14px;padding:30px">
        <p style="font-size:15px;line-height:1.7;margin:0 0 18px">Hej ${avtal.handledare_name || ''},</p>
        <p style="font-size:15px;line-height:1.7;margin:0 0 20px">${inledning}</p>

        <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:24px">
          <tr><td style="padding:6px 0;color:#6b6560">Student</td><td style="padding:6px 0">${studentNamn}</td></tr>
          <tr><td style="padding:6px 0;color:#6b6560">Företag</td><td style="padding:6px 0">${foretag}</td></tr>
          <tr><td style="padding:6px 0;color:#6b6560">Utbildning</td><td style="padding:6px 0">${program}</td></tr>
          <tr><td style="padding:6px 0;color:#6b6560">Period</td><td style="padding:6px 0">${periodNamn}, ${start} till ${slut}</td></tr>
        </table>

        <a href="${url}" style="display:inline-block;background:#e8420a;color:#fff;text-decoration:none;padding:13px 26px;border-radius:100px;font-weight:bold;font-size:14px">
          Fyll i utvärderingen
        </a>

        <p style="font-size:13px;color:#6b6560;line-height:1.6;margin:24px 0 0">
          Ingen inloggning behövs. Länken fungerar även i mobilen.
        </p>
      </div>
      <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px">
        Skickat av ${skola} via LIAlink
      </p>
    </div>
  `

  try {
    await resend.emails.send({
      from: 'LIAlink <noreply@lialink.se>',
      to: avtal.handledare_email,
      subject: paminnelse
        ? `Påminnelse: utvärdering för ${studentNamn}`
        : `Utvärdering efter LIA: ${studentNamn}`,
      html,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Mejlet kunde inte skickas' }, { status: 500 })
  }

  await supabase
    .from('evaluations')
    .update(
      paminnelse
        ? { reminded_at: new Date().toISOString() }
        : { status: 'skickat', sent_at: new Date().toISOString() }
    )
    .eq('id', ev.id)

  return NextResponse.json({ ok: true, email: avtal.handledare_email })
}
