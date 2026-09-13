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
      students(program, school, profiles(full_name, email, city)),
      companies(company_name, org_number, city, address, sector),
      educations(school_name, program_name, city)
    `)
    .eq('id', id)
    .single()

  if (!a) return NextResponse.json({ error: 'Avtalet hittades inte' }, { status: 404 })

  const pdf   = await PDFDocument.create()
  const page  = pdf.addPage([595, 842]) // A4
  const font  = await pdf.embedFont(StandardFonts.Helvetica)
  const bold  = await pdf.embedFont(StandardFonts.HelveticaBold)

  const ink    = rgb(0.06, 0.055, 0.05)
  const orange = rgb(0.91, 0.26, 0.04)
  const grey   = rgb(0.42, 0.40, 0.38)
  const line   = rgb(0.87, 0.85, 0.83)

  let y = 790

  function text(str: string, opts: any = {}) {
    page.drawText(str || '–', {
      x: opts.x ?? 50,
      y: opts.y ?? y,
      size: opts.size ?? 10,
      font: opts.bold ? bold : font,
      color: opts.color ?? ink,
    })
  }

  function rule(atY: number) {
    page.drawLine({
      start: { x: 50, y: atY },
      end:   { x: 545, y: atY },
      thickness: 0.8,
      color: line,
    })
  }

  // Header
  text('LIA', { size: 22, bold: true })
  page.drawText('link', { x: 50 + bold.widthOfTextAtSize('LIA', 22), y, size: 22, font: bold, color: orange })
  text('LIA-AVTAL', { x: 440, y: y + 6, size: 9, bold: true, color: grey })
  text(a.all_signed ? 'Signerat av alla parter' : 'Ej fullständigt signerat', {
    x: 440, y: y - 6, size: 8, color: a.all_signed ? rgb(0.1, 0.5, 0.3) : orange,
  })

  y -= 24
  rule(y)
  y -= 34

  // Parter
  text('PARTER', { size: 8, bold: true, color: orange }); y -= 18

  const parties = [
    ['Student',      a.students?.profiles?.full_name, `${a.students?.program || ''} · ${a.students?.school || ''}`, a.students?.profiles?.email],
    ['Arbetsgivare', a.companies?.company_name, `${a.companies?.sector || ''} · ${a.companies?.city || ''}`, a.companies?.org_number ? `Org.nr ${a.companies.org_number}` : ''],
    ['Utbildning',   a.educations?.school_name, a.educations?.program_name, a.educations?.city],
  ]

  for (const [label, name, sub, extra] of parties) {
    text(label as string, { size: 8, bold: true, color: grey }); y -= 14
    text(name as string, { size: 12, bold: true }); y -= 13
    text(sub as string, { size: 9, color: grey }); y -= 12
    if (extra) { text(extra as string, { size: 9, color: grey }); y -= 12 }
    y -= 10
  }

  rule(y); y -= 28

  // Period
  text('LIA-PERIOD', { size: 8, bold: true, color: orange }); y -= 18
  text('Startdatum', { size: 8, color: grey })
  text('Slutdatum',  { x: 300, size: 8, color: grey }); y -= 15
  text(a.lia_start, { size: 12, bold: true })
  text(a.lia_end,   { x: 300, size: 12, bold: true }); y -= 28

  rule(y); y -= 28

  // Signaturer
  text('SIGNATURER', { size: 8, bold: true, color: orange }); y -= 20

  const signatures = [
    ['Student',      a.students?.profiles?.full_name, a.student_signed_at],
    ['Arbetsgivare', a.companies?.company_name,       a.company_signed_at],
    ['Utbildning',   a.educations?.school_name,       a.education_signed_at],
  ]

  for (const [label, name, signedAt] of signatures) {
    const signed = !!signedAt
    text(signed ? 'Signerat' : 'Ej signerat', {
      size: 9, bold: true,
      color: signed ? rgb(0.1, 0.5, 0.3) : grey,
    })
    text(label as string, { x: 130, size: 9, color: grey })
    text(name as string,  { x: 230, size: 10, bold: true })
    text(signedAt ? new Date(signedAt as string).toLocaleString('sv-SE') : '', {
      x: 400, size: 9, color: grey,
    })
    y -= 22
  }

  y -= 14
  rule(y); y -= 24

  // Villkor
  text('VILLKOR', { size: 8, bold: true, color: orange }); y -= 16

  const terms = [
    'LIA (Lärande i arbete) genomförs enligt utbildningsplanen för programmet.',
    'Arbetsgivaren utser en handledare som ansvarar för studentens introduktion och uppföljning.',
    'Studenten omfattas av utbildningsanordnarens försäkring under LIA-perioden.',
    'LIA är obetald om inget annat avtalats skriftligen mellan parterna.',
    'Studenten omfattas av sekretess avseende uppgifter hos arbetsgivaren.',
    'Avbrott ska omgående meddelas utbildningsledaren av den part som initierar det.',
  ]

  for (const term of terms) {
    text('•', { size: 9, color: grey })
    text(term, { x: 62, size: 9, color: ink })
    y -= 15
  }

  // Footer
  page.drawText(
    `Genererat via LIAlink · ${new Date().toLocaleString('sv-SE')} · Avtals-id ${a.id}`,
    { x: 50, y: 40, size: 7, font, color: grey }
  )

  const bytes = await pdf.save()
  const student = (a.students?.profiles?.full_name || 'avtal').replace(/\s+/g, '-')

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="LIA-avtal-${student}.pdf"`,
    },
  })
}