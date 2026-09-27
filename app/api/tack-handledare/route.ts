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
  const { placementId } = await req.json()

  if (!placementId) {
    return NextResponse.json({ error: 'Placerings-id saknas' }, { status: 400 })
  }

  const { data: pl } = await supabase
    .from('placements')
    .select(`
      id, actual_start, actual_end, tack_skickat_at, company_id,
      lia_periods(name, start_date, end_date, weeks, classes(educations(id, program_name, school_name, profiles:user_id(full_name, email)))),
      students(profiles(full_name)),
      companies(company_name)
    `)
    .eq('id', placementId)
    .maybeSingle()

  if (!pl) {
    return NextResponse.json({ error: 'Placeringen hittades inte' }, { status: 404 })
  }

  const per   = platta((pl as any).lia_periods)
  const kl    = platta((per as any)?.classes)
  const edu   = platta((kl as any)?.educations)
  const ul    = platta((edu as any)?.profiles)
  const stud  = platta((pl as any).students)
  const sProf = platta((stud as any)?.profiles)
  const comp  = platta((pl as any).companies)

  const { data: avtal } = await supabase
    .from('agreements')
    .select('handledare_name, handledare_email')
    .eq('placement_id', placementId)
    .maybeSingle()

  const mottagare: { email: string; namn: string }[] = []
  const sedda = new Set<string>()

  function lagg(email?: string | null, namn?: string | null) {
    const n = (email || '').toLowerCase().trim()
    if (!n || sedda.has(n)) return
    sedda.add(n)
    mottagare.push({ email: email as string, namn: namn || '' })
  }

  lagg(avtal?.handledare_email, avtal?.handledare_name)

  if ((pl as any).company_id && (edu as any)?.id) {
    const { data: partner } = await supabase
      .from('education_partners')
      .select('id')
      .eq('education_id', (edu as any).id)
      .eq('company_id', (pl as any).company_id)
      .maybeSingle()

    if (partner) {
      const { data: kont } = await supabase
        .from('partner_contacts')
        .select('name, email')
        .eq('partner_id', partner.id)
        .eq('aktiv', true)
        .not('email', 'is', null)

      for (const k of kont || []) lagg(k.email, k.name)
    }
  }

  if (!mottagare.length) {
    return NextResponse.json({ error: 'Ingen mottagare med e-postadress' }, { status: 400 })
  }

  const student = (sProf as any)?.full_name || 'Studenten'
  const foretag = (comp as any)?.company_name || ''
  const program = (edu as any)?.program_name || ''
  const skola   = (edu as any)?.school_name || ''
  const veckor  = (per as any)?.weeks
  const start   = (pl as any).actual_start || (per as any)?.start_date
  const slut    = (pl as any).actual_end   || (per as any)?.end_date

  let skickade = 0

  for (const m of mottagare) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1816">
        <div style="background:#0f0e0d;padding:26px 30px;border-radius:14px 14px 0 0">
          <span style="font-size:20px;font-weight:bold;color:#fff">LIA<span style="color:#e8420a">link</span></span>
        </div>
        <div style="border:1px solid #e8e4de;border-top:none;border-radius:0 0 14px 14px;padding:30px">
          <p style="font-size:15px;line-height:1.7;margin:0 0 18px">Hej ${m.namn},</p>

          <p style="font-size:15px;line-height:1.7;margin:0 0 20px">
            ${student} har nu avslutat sin LIA-period hos ${foretag}. Tack för att ni
            tog emot och för den tid ni lagt på handledningen.
          </p>

          <div style="background:#faf8f5;border:1px solid #e8e4de;border-radius:10px;padding:16px 18px;margin-bottom:22px">
            <p style="font-size:13px;color:#6b6560;margin:0 0 8px">Det här gjorde ni möjligt</p>
            <p style="font-size:14px;line-height:1.7;margin:0">
              ${veckor ? veckor + ' veckor' : 'En hel LIA-period'} av arbetslivserfarenhet
              för en studerande på ${program}.<br>
              <span style="color:#6b6560">${start} till ${slut}</span>
            </p>
          </div>

          <p style="font-size:15px;line-height:1.7;margin:0 0 20px">
            LIA är den del av utbildningen där det mesta lärandet sker. Det fungerar
            bara för att företag som ni ställer upp.
          </p>

          <p style="font-size:14px;line-height:1.7;margin:0">
            Vänliga hälsningar<br>
            ${(ul as any)?.full_name || ''}<br>
            <span style="color:#6b6560">${program}, ${skola}</span>
          </p>
        </div>
      </div>
    `

    try {
      await resend.emails.send({
        from: 'LIAlink <noreply@lialink.se>',
        replyTo: (ul as any)?.email || undefined,
        to: m.email,
        subject: 'Tack för att ni tog emot ' + student,
        html,
      })
      skickade++
    } catch (e) {
      // fortsatt med nasta mottagare
    }
  }

  await supabase
    .from('placements')
    .update({ tack_skickat_at: new Date().toISOString() })
    .eq('id', placementId)

  return NextResponse.json({ ok: true, skickade })
}
