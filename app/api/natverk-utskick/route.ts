import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: NextRequest) {
    const { educationId, periodId, amne, meddelande, companyIds } = await req.json()

  if (!educationId || !amne?.trim() || !meddelande?.trim()) {
    return NextResponse.json({ error: 'Ämne och meddelande krävs' }, { status: 400 })
  }

  const { data: edu } = await supabase
    .from('educations')
    .select('program_name, school_name, profiles:user_id(full_name, email)')
    .eq('id', educationId)
    .single()

  if (!edu) return NextResponse.json({ error: 'Utbildningen hittades inte' }, { status: 404 })

  // Mottagare: företag i nätverket som inte avsagt sig
  const { data: partners } = await supabase
    .from('education_partners')
    .select('id, companies(id, company_name, contact_name, contact_email, user_id)')
    .eq('education_id', educationId)
    .eq('utskick', true)
    const valda: string[] = Array.isArray(companyIds) ? companyIds : []

  // Hämta e-post även för företag med konto
  const mottagare: { email: string; namn: string; foretag: string }[] = []
  const sedda = new Set<string>()

  for (const p of partners || []) {
    const c = (p as any).companies
    if (!c) continue
    if (valda.length && !valda.includes(c.id)) continue

    // Aktiva kontaktpersoner för relationen
    const { data: kontakter } = await supabase
      .from('partner_contacts')
      .select('name, email')
      .eq('partner_id', p.id)
      .eq('aktiv', true)
      .not('email', 'is', null)

    for (const k of kontakter || []) {
      const nyckel = (k.email || '').toLowerCase()
      if (!nyckel || sedda.has(nyckel)) continue
      sedda.add(nyckel)
      mottagare.push({ email: k.email, namn: k.name || '', foretag: c.company_name })
    }

    // Kontot som fallback om inga kontaktpersoner finns
    if (!kontakter?.length && c.user_id) {
      const { data: prof } = await supabase
        .from('profiles').select('email, full_name').eq('id', c.user_id).maybeSingle()
      const nyckel = (prof?.email || '').toLowerCase()
      if (nyckel && !sedda.has(nyckel)) {
        sedda.add(nyckel)
        mottagare.push({ email: prof!.email, namn: prof?.full_name || '', foretag: c.company_name })
      }
    }
  }

  if (!mottagare.length) {
    return NextResponse.json({ error: 'Inga mottagare med e-postadress i nätverket' }, { status: 400 })
  }

  // Periodinfo om vald
  let periodText = ''
  if (periodId) {
    const { data: per } = await supabase
      .from('lia_periods').select('name, start_date, end_date, weeks, classes(name)')
      .eq('id', periodId).single()
    if (per) {
      const klass = (per as any).classes?.name
      periodText = `${per.name}${klass ? `, ${klass}` : ''}: ${per.start_date} till ${per.end_date}${per.weeks ? `, ${per.weeks} veckor` : ''}`
    }
  }

  const ul = (edu as any).profiles
  let skickade = 0
//ERsätt
  const GRANS = 90   // marginal mot Resends dagsgräns på 100
  const misslyckade: string[] = []
  let skickade = 0

  for (const m of mottagare) {
    if (skickade >= GRANS) {
      misslyckade.push(m.email)
      continue
    }

    try {
      await resend.emails.send({
        from: 'LIAlink <noreply@lialink.se>',
        replyTo: ul?.email || undefined,
        to: m.email,
        subject: amne.trim(),
        html: mall(m),
      })
      skickade++
    } catch (e: any) {
      misslyckade.push(m.email)
    }
  }

  await supabase.from('natverk_utskick').insert({
    education_id:  educationId,
    lia_period_id: periodId || null,
    amne:          amne.trim(),
    meddelande:    meddelande.trim(),
    antal:         skickade,
  })

  return NextResponse.json({
    ok: true,
    skickade,
    totalt: mottagare.length,
    misslyckade: misslyckade.length,
    varning: misslyckade.length
      ? `${misslyckade.length} mejl gick inte fram. Dagsgränsen för utskick är nådd — försök igen imorgon.`
      : null,
  })
}