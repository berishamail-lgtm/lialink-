import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const fragor = [
  { key: 'q1_handledarinsats', text: 'Handledarens egen insats',       grupp: 'Om samarbetet' },
  { key: 'q2_information',     text: 'Informationen om utbildningen',  grupp: 'Om samarbetet' },
  { key: 'q3_initiativ',       text: 'Initiativförmåga',               grupp: 'Om studenten' },
  { key: 'q4_samarbete',       text: 'Samarbete och service',          grupp: 'Om studenten' },
  { key: 'q5_planera',         text: 'Planera och prioritera',         grupp: 'Om studenten' },
  { key: 'q6_strukturera',     text: 'Strukturera uppgifter',          grupp: 'Om studenten' },
  { key: 'q7_analytisk',       text: 'Analytisk förmåga',              grupp: 'Om studenten' },
  { key: 'q8_sjalvstandig',    text: 'Arbeta självständigt',           grupp: 'Om studenten' },
  { key: 'q9a_skriftligt',     text: 'Kommunikation, skriftligt',      grupp: 'Om studenten' },
  { key: 'q9b_muntligt',       text: 'Kommunikation, muntligt',        grupp: 'Om studenten' },
  { key: 'q10_lamplighet',     text: 'Lämplighet för yrkesrollen',     grupp: 'Om studenten' },
  { key: 'q11_uppforande',     text: 'Uppförande',                     grupp: 'Om studenten' },
  { key: 'q12_redovisning',    text: 'Muntlig LIA-redovisning',        grupp: 'Om studenten' },
]

function platta(v: any) { return Array.isArray(v) ? v[0] : v }

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Id saknas' }, { status: 400 })

  const { data: ev } = await supabase
    .from('evaluations')
    .select(`*,
      placements(
        actual_start, actual_end,
        lia_periods(name, start_date, end_date, classes(name, termin, educations(program_name, school_name))),
        students(profiles(full_name)),
        companies(company_name, city)
      )`)
    .eq('id', id)
    .maybeSingle()

  if (!ev) return NextResponse.json({ error: 'Utvärderingen hittades inte' }, { status: 404 })
  if (ev.status !== 'besvarat') {
    return NextResponse.json({ error: 'Utvärderingen är inte besvarad än' }, { status: 400 })
  }

  const pl   = platta(ev.placements)
  const per  = platta((pl as any)?.lia_periods)
  const kl   = platta((per as any)?.classes)
  const edu  = platta((kl as any)?.educations)
  const st   = platta((pl as any)?.students)
  const prof = platta((st as any)?.profiles)
  const co   = platta((pl as any)?.companies)

  const pdf  = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique)

  const ink  = rgb(0.1, 0.1, 0.1)
  const grey = rgb(0.45, 0.45, 0.45)
  const line = rgb(0.8, 0.8, 0.8)

  const M = 50
  const W = 595
  const CW = W - M * 2

  let page = pdf.addPage([W, 842])
  let y = 780

  function ren(s: string) {
    return (s || '').replace(/\r/g, '').replace(/[^\x20-\x7E\xA0-\xFFåäöÅÄÖ]/g, '')
  }

  function text(s: string, x: number, yy: number, size = 9, f = font, color = ink) {
    page.drawText(ren(s), { x, y: yy, size, font: f, color })
  }

  function rad(yy: number) {
    page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 0.7, color: line })
  }

  text('UTVÄRDERING EFTER LIA', M, y, 15, bold)
  y -= 18
  text([edu?.program_name, kl?.name, per?.name].filter(Boolean).join('  |  '), M, y, 9, font, grey)
  y -= 24
  rad(y)
  y -= 24

  const fakta: string[][] = [
    ['Student',    prof?.full_name || ''],
    ['Utbildning', [edu?.program_name, edu?.school_name].filter(Boolean).join(', ')],
    ['Klass',      [kl?.name, kl?.termin].filter(Boolean).join(', ')],
    ['LIA-period', (per?.name || '') + ', ' + (pl?.actual_start || per?.start_date || '') + ' till ' + (pl?.actual_end || per?.end_date || '')],
    ['Företag',    [co?.company_name, co?.city].filter(Boolean).join(', ')],
    ['Handledare', ev.handledare_name || ''],
    ['Besvarad',   ev.answered_at ? new Date(ev.answered_at).toLocaleDateString('sv-SE') : ''],
  ]

  for (const f of fakta) {
    text(f[0], M, y, 8.5, ital, grey)
    text(f[1], M + 110, y, 10)
    y -= 17
  }

  y -= 10
  rad(y)
  y -= 26

  let grupp = ''
  for (const f of fragor) {
    if (f.grupp !== grupp) {
      grupp = f.grupp
      if (y < 130) { page = pdf.addPage([W, 842]); y = 780 }
      y -= 6
      text(grupp.toUpperCase(), M, y, 8.5, bold, grey)
      y -= 18
    }

    if (y < 110) { page = pdf.addPage([W, 842]); y = 780 }

    text(f.text, M, y, 10)
    const svar = (ev as any)[f.key] || '-'
    const bredd = bold.widthOfTextAtSize(ren(svar), 10)
    text(svar, W - M - bredd, y, 10, bold)
    y -= 8
    rad(y)
    y -= 15
  }

  if (ev.comment) {
    y -= 14
    if (y < 140) { page = pdf.addPage([W, 842]); y = 780 }
    text('KOMMENTAR', M, y, 8.5, bold, grey)
    y -= 18

    const ord = ren(ev.comment).split(/\s+/)
    let buffert = ''
    for (const o of ord) {
      const test = buffert ? buffert + ' ' + o : o
      if (font.widthOfTextAtSize(test, 10) > CW) {
        text(buffert, M, y, 10)
        y -= 14
        buffert = o
        if (y < 70) { page = pdf.addPage([W, 842]); y = 780 }
      } else {
        buffert = test
      }
    }
    if (buffert) text(buffert, M, y, 10)
  }

  const stamp = 'LIAlink  |  Utskrivet ' + new Date().toLocaleDateString('sv-SE')
  for (const p of pdf.getPages()) {
    p.drawText(stamp, { x: M, y: 32, size: 6.5, font, color: grey })
  }

  const bytes = await pdf.save()
  const namn = (prof?.full_name || 'utvardering').replace(/\s+/g, '-')

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="Utvardering-' + namn + '.pdf"',
    },
  })
}
