import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Kopplar handledaren på avtalet till en rad i handledare-tabellen och
// sätter placements.handledare_id. Finns personen inte skapas hon — utan
// konto. Kontot är frivilligt och kommer i så fall separat.

export async function POST(req: NextRequest) {
  const { companyId, placementId, name, email, phone } = await req.json()

  if (!companyId || !name) {
    return NextResponse.json({ error: 'Företag och namn krävs' }, { status: 400 })
  }

  const epost = (email || '').trim()
  const namn  = String(name).trim()

  let post: { id: string; user_id: string | null } | null = null

  // 1. Hitta befintlig: e-post är det säkra nyckelordet, namn är reservplanen.
  if (epost) {
    const { data } = await supabase
      .from('handledare')
      .select('id, user_id')
      .eq('company_id', companyId)
      .ilike('email', epost)
      .maybeSingle()
    post = data || null
  }

  if (!post) {
    const { data } = await supabase
      .from('handledare')
      .select('id, user_id, email')
      .eq('company_id', companyId)
      .ilike('name', namn)
      .limit(1)

    const trolig = (data || [])[0]

    // Samma namn utan e-post är rimligen samma person. Har den raden redan
    // en annan adress låter vi den vara och skapar en ny.
    if (trolig && (!trolig.email || !epost || trolig.email.toLowerCase() === epost.toLowerCase())) {
      post = { id: trolig.id, user_id: trolig.user_id }

      if (epost && !trolig.email) {
        await supabase.from('handledare').update({ email: epost }).eq('id', trolig.id)
      }
    }
  }

  // 2. Skapa om hon inte finns
  if (!post) {
    const { data: ny, error: err } = await supabase
      .from('handledare')
      .insert({
        company_id: companyId,
        name:       namn,
        email:      epost || null,
        phone:      (phone || '').trim() || null,
      })
      .select('id, user_id')
      .single()

    if (err) {
      return NextResponse.json(
        { error: 'Kunde inte skapa handledaren: ' + err.message },
        { status: 500 }
      )
    }
    post = ny
  } else if (phone && String(phone).trim()) {
    await supabase
      .from('handledare')
      .update({ phone: String(phone).trim() })
      .eq('id', post.id)
      .is('phone', null)
  }

  // 3. Koppla placeringen
  if (placementId) {
    const { error: pErr } = await supabase
      .from('placements')
      .update({ handledare_id: post.id })
      .eq('id', placementId)

    if (pErr) {
      return NextResponse.json(
        { error: 'Handledaren sparades men placeringen kunde inte kopplas: ' + pErr.message },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    ok: true,
    handledareId: post.id,
    harKonto: !!post.user_id,
  })
}
