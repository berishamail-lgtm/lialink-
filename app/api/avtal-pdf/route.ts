import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Avtals-id saknas' }, { status: 400 })

  const { data: a } = await supabase
    .from('agreements')
    .select(`
      *,
      placements(lia_periods(name, classes(name))),
      students(program, profiles(full_name, email, city)),
      companies(company_name, org_number, phone, city),
      educations(school_name, program_name, org_number, phone, contact_phone, villkor_text, profiles:user_id(full_name, email))
    `)
    .eq('id', id)
    .single()

  if (!a) return NextResponse.json({ error: 'Avtalet hittades inte' }, { status: 404 })

  const pdf  = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique)

  const ink  = rgb(0.1, 0.1, 0.1)
  const grey = rgb(0.45, 0.45, 0.45)
  const line = rgb(0.75, 0.75, 0.75)

  const M  = 50
  const W  = 595
  const CW = W - M * 2

  let page = pdf.addPage([W, 842])
  let y = 780

  function text(s: string, x: number, yy: number, size = 9, f = font, color = ink) {
    page.drawText(s || '', { x, y: yy, size, font: f, color })
  }

  function box(x: number, yy: number, w: number, h: number) {
    page.drawRectangle({
      x, y: yy - h, width: w, height: h,
      borderColor: line, borderWidth: 0.7,
    })
  }

  function row(cells: { label: string; value: string; w: number }[], h = 34) {
    let x = M
    for (const c of cells) {
      box(x, y, c.w, h)
      text(c.label, x + 5, y - 11, 7.5, ital, grey)
      text(c.value || '', x + 5, y - 25, 9.5, font, ink)
      x += c.w
    }
    y -= h
  }

  function heading(s: string, size = 10) {
    text(s, M, y, size, bold, ink)
    y -= 15
  }

  function wrap(s: string, maxW: number, size: number, f = font): string[] {
    const out: string[] = []
    for (const para of (s || '').split('\n')) {
      if (!para.trim()) { out.push(''); continue }
      let cur = ''
      for (const word of para.split(' ')) {
        const test = cur ? cur + ' ' + word : word
        if (f.widthOfTextAtSize(test, size) > maxW) { out.push(cur); cur = word }
        else cur = test
      }
      if (cur) out.push(cur)
    }
    return out
  }

  function newPageIfNeeded(needed: number) {
    if (y - needed < 60) {
      page = pdf.addPage([W, 842])
      y = 780
    }
  }

  const edu = a.educations
  const co  = a.companies
  const st  = a.students

  // Rubrik
  text('AVTALSVILLKOR FÃ–R LÃ„RANDE I ARBETE', M, y, 15, bold, ink)
  y -= 16
  text(
    [a.placements?.lia_periods?.name, a.placements?.lia_periods?.classes?.name, edu?.program_name]
      .filter(Boolean).join('  |  '),
    M, y, 9, font, grey
  )
  y -= 26

  heading('PARTER OCH DELTAGARE', 9)
  y -= 4

  // Mottagaren
  heading('Mottagaren', 9.5)
  row([
    { label: 'FÃ¶retags-/org/myndighetsnamn', value: co?.company_name || '', w: CW * 0.46 },
    { label: 'Org nummer', value: co?.org_number || '', w: CW * 0.27 },
    { label: 'Telefon',    value: co?.phone || '',      w: CW * 0.27 },
  ])
  row([
    { label: 'Handledare', value: a.handledare_name || '',  w: CW * 0.46 },
    { label: 'Telefon',    value: a.handledare_phone || '', w: CW * 0.27 },
    { label: 'E-post',     value: a.handledare_email || '', w: CW * 0.27 },
  ])
  y -= 16

  // Utbildningsanordnaren
  heading(edu?.school_name || 'Utbildningsanordnaren', 9.5)
  row([
    { label: 'FÃ¶retagsnamn', value: edu?.school_name || '', w: CW * 0.46 },
    { label: 'Org nummer',   value: edu?.org_number || '',  w: CW * 0.27 },
    { label: 'Telefon',      value: edu?.phone || '',       w: CW * 0.27 },
  ])
  row([
    { label: 'Utbildningsansvarig', value: edu?.profiles?.full_name || '', w: CW * 0.46 },
    { label: 'Telefon',             value: edu?.contact_phone || '',       w: CW * 0.27 },
    { label: 'E-post',              value: edu?.profiles?.email || '',     w: CW * 0.27 },
  ])
  y -= 16

  // Studerande
  heading('Studerande', 9.5)
  row([
    { label: 'Namn',         value: st?.profiles?.full_name || '', w: CW * 0.40 },
    { label: 'Personnummer', value: '',                            w: CW * 0.24 },
    { label: 'Startdatum',   value: a.lia_start || '',             w: CW * 0.18 },
    { label: 'Slutdatum',    value: a.lia_end || '',               w: CW * 0.18 },
  ])
  row([
    { label: 'Adress',  value: a.student_address || '',   w: CW * 0.46 },
    { label: 'Telefon', value: a.student_phone || '',     w: CW * 0.27 },
    { label: 'E-post',  value: st?.profiles?.email || '', w: CW * 0.27 },
  ])
  y -= 16

  // SÃ¤rskilda villkor
  heading('SÃ¤rskilda villkor och Ã–vrigt', 9.5)
  const sv  = wrap(a.sarskilda_villkor || '', CW - 12, 9)
  const svH = Math.max(30, sv.length * 12 + 14)
  box(M, y, CW, svH)
  let sy = y - 14
  for (const l of sv) { text(l, M + 6, sy, 9); sy -= 12 }
  y -= svH + 20

  // Signaturer
  const parties = [
    { title: edu?.school_name || 'Utbildningsanordnaren', name: edu?.profiles?.full_name || '', at: a.education_signed_at, ort: a.education_ort },
    { title: 'Mottagaren', name: a.handledare_name || '',       at: a.company_signed_at, ort: a.company_ort },
    { title: 'Studerande', name: st?.profiles?.full_name || '', at: a.student_signed_at, ort: a.student_ort },
  ]

  newPageIfNeeded(150)

  text('Detta avtal har upprÃ¤ttats i tre likalydande exemplar, varav utbildningsanordnaren,',
       M, y, 8.5, font, ink)
  y -= 11
  text('Mottagaren och den Studerande har tagit var sitt.', M, y, 8.5, font, ink)
  y -= 16

  const colW   = CW / 3
  const startY = y

  parties.forEach((p, i) => {
    const x = M + colW * i
    let cy = startY

    box(x, cy, colW, 22)
    text(p.title, x + 5, cy - 14, 9, bold, ink)
    cy -= 22

    box(x, cy, colW, 40)
    text('Ort', x + 5, cy - 11, 7.5, ital, grey)
    text('Datum', x + colW / 2 + 5, cy - 11, 7.5, ital, grey)
    text(p.ort || '', x + 5, cy - 26, 9)
    text(p.at ? new Date(p.at).toLocaleDateString('sv-SE') : '', x + colW / 2 + 5, cy - 26, 9)
    cy -= 40

    box(x, cy, colW, 46)
    text('Signatur', x + 5, cy - 11, 7.5, ital, grey)
    if (p.at) {
      text('Signerat digitalt i LIAlink', x + 5, cy - 27, 8, font, grey)
      text(new Date(p.at).toLocaleString('sv-SE'), x + 5, cy - 37, 7, font, grey)
    }
    cy -= 46

    box(x, cy, colW, 34)
    text('NamnfÃ¶rtydligande', x + 5, cy - 11, 7.5, ital, grey)
    text(p.name, x + 5, cy - 25, 9)
  })

  y = startY - 142

  // Villkorstext
  if (edu?.villkor_text) {
    page = pdf.addPage([W, 842])
    y = 780
    heading('Villkor', 13)
    y -= 6

    for (const l of wrap(edu.villkor_text, CW, 9)) {
      if (y < 60) { page = pdf.addPage([W, 842]); y = 780 }
      if (!l) { y -= 7; continue }
      const isHeading = /^\d+\.\s/.test(l)
      text(l, M, y, isHeading ? 9.5 : 9, isHeading ? bold : font, ink)
      y -= isHeading ? 14 : 12
    }
  }

  // Sidfot
  const stamp = `LIAlink  |  Avtals-id ${a.id}  |  Utskrivet ${new Date().toLocaleDateString('sv-SE')}`
  for (const p of pdf.getPages()) {
    p.drawText(stamp, { x: M, y: 32, size: 6.5, font, color: grey })
  }

  const bytes   = await pdf.save()
  const filnamn = (st?.profiles?.full_name || 'avtal').replace(/\s+/g, '-')

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="LIA-avtal-${filnamn}.pdf"`,
    },
  })
}

