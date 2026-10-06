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
  const { placementId, companyId, userId, meddelande } = await req.json()

  if (!placementId || !companyId) {
    return NextResponse.json({ error: 'Placering och företag krävs' }, { status: 400 })
  }

  // Finns anmälan redan?
  const { data: finns } = await supabase
    .from('platsanmalan')
    .select('id, status')
    .eq('placement_id', placementId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (finns && finns.status === 'ny') {
    return NextResponse.json({ error: 'Ni har redan anmält den här platsen' }, { status: 409 })
  }

  const { data: pl } = await supabase
    .from('placements')
    .select(`
      id, status,
      lia_periods(name, start_date, end_date, weeks, classes(name, educations(id, program_name, school_name, profiles:user_id(full_name, email)))),
      students(profiles(full_name, email))
    `)
    .eq('id', placementId)
    .maybeSingle()

  if (!pl) {
    return NextResponse.json({ error: 'Placeringen hittades inte' }, { status: 404 })
  }

  if (!['söker', 'uppskjuten', 'förslag'].includes((pl as any).status)) {
    return NextResponse.json(
      { error: 'Studenten har redan en plats för den här perioden' },
      { status: 409 }
    )
  }

  const { data: co } = await supabase
    .from('companies').select('company_name, city').eq('id', companyId).maybeSingle()

  const per   = platta((pl as any).lia_periods)
  const kl    = platta((per as any)?.classes)
  const edu   = platta((kl as any)?.educations)
  const ul    = platta((edu as any)?.profiles)
  const stud  = platta((pl as any).students)
  const sProf = platta((stud as any)?.profiles)

  // Spara anmälan
  if (finns) {
    await supabase.from('platsanmalan').update({
      status: 'ny',
      anmald_av: userId || null,
      meddelande: meddelande?.trim() || null,
      skapad_at: new Date().toISOString(),
      hanterad_at: null,
    }).eq('id', finns.id)
  } else {
    const { error: aErr } = await supabase.from('platsanmalan').insert({
      placement_id: placementId,
      company_id:   companyId,
      anmald_av:    userId || null,
      meddelande:   meddelande?.trim() || null,
    })
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
  }

  // Markera placeringen som förslag så den syns tydligt hos UL
  await supabase.from('placements')
    .update({ status: 'förslag' })
    .eq('id', placementId)
    .in('status', ['söker', 'uppskjuten'])

  const student = (sProf as any)?.full_name || 'Studenten'
  const foretag = (co as any)?.company_name || 'Företaget'
  const program = (edu as any)?.program_name || ''
  const period  = (per as any)?.name || 'LIA'
  const start   = (per as any)?.start_date
  const slut    = (per as any)?.end_date

  // Mejl till utbildningsledaren
  if ((ul as any)?.email) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1816">
        <div style="background:#0f0e0d;padding:26px 30px;border-radius:14px 14px 0 0">
          <span style="font-size:20px;font-weight:bold;color:#fff">LIA<span style="color:#e8420a">link</span></span>
        </div>
        <div style="border:1px solid #e8e4de;border-top:none;border-radius:0 0 14px 14px;padding:30px">
          <p style="font-size:15px;line-height:1.7;margin:0 0 18px">Hej ${(ul as any)?.full_name || ''},</p>

          <p style="font-size:15px;line-height:1.7;margin:0 0 20px">
            <strong>${foretag}</strong> har anmält att de vill ta emot
            <strong>${student}</strong> för ${period}. Nu väntar de på att avtalet upprättas.
          </p>

          <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:22px">
            <tr><td style="padding:6px 0;color:#6b6560">Student</td><td style="padding:6px 0">${student}</td></tr>
            <tr><td style="padding:6px 0;color:#6b6560">Företag</td><td style="padding:6px 0">${foretag}${(co as any)?.city ? ', ' + (co as any).city : ''}</td></tr>
            <tr><td style="padding:6px 0;color:#6b6560">Utbildning</td><td style="padding:6px 0">${program}</td></tr>
            <tr><td style="padding:6px 0;color:#6b6560">Period</td><td style="padding:6px 0">${period}, ${start} till ${slut}</td></tr>
          </table>

          ${meddelande?.trim() ? `
            <div style="background:#faf8f5;border:1px solid #e8e4de;border-radius:10px;padding:14px 16px;margin-bottom:22px">
              <p style="font-size:13px;color:#6b6560;margin:0 0 4px">Meddelande från företaget</p>
              <p style="font-size:14px;margin:0;line-height:1.6">${meddelande.trim()}</p>
            </div>` : ''}

          <a href="${req.nextUrl.origin}/dashboard/students" style="display:inline-block;background:#e8420a;color:#fff;text-decoration:none;padding:13px 26px;border-radius:100px;font-weight:bold;font-size:14px">
            Bekräfta och skapa avtal
          </a>
        </div>
      </div>
    `

    try {
      await resend.emails.send({
        from: 'LIAlink <noreply@lialink.se>',
        to: (ul as any).email,
        subject: `${foretag} vill ta emot ${student}`,
        html,
      })
    } catch (e) {
      // anmälan är sparad även om mejlet inte gick fram
    }
  }

  return NextResponse.json({ ok: true })
}
