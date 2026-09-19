import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { placementId, companyId, nyttForetag, note } = await req.json()

  if (!placementId) {
    return NextResponse.json({ error: 'Placering saknas' }, { status: 400 })
  }

  let foretagId = companyId

  // Skapa företaget om det inte finns
  if (!foretagId && nyttForetag?.namn) {
    const { data: co, error: coErr } = await supabase
      .from('companies')
      .insert({
        company_name:    nyttForetag.namn.trim(),
        city:            nyttForetag.ort?.trim() || null,
        contact_name:    nyttForetag.kontakt?.trim() || null,
        contact_email:   nyttForetag.epost?.trim() || null,
        contact_phone:   nyttForetag.telefon?.trim() || null,
        spots_total:     1,
        spots_available: 1,
        origin:          'ul',
        claimed:         false,
      })
      .select('id').single()

    if (coErr) return NextResponse.json({ error: coErr.message }, { status: 500 })
    foretagId = co.id

    // Lägg till i UL:s nätverk
    const { data: pl } = await supabase
      .from('placements')
      .select('lia_periods(classes(education_id))')
      .eq('id', placementId)
      .single()

    const eduId = (pl as any)?.lia_periods?.classes?.education_id
    if (eduId) {
      await supabase.from('education_partners')
        .insert({ education_id: eduId, company_id: foretagId })
        .select()
    }
  }

  if (!foretagId) {
    return NextResponse.json({ error: 'Välj ett företag eller fyll i ett nytt' }, { status: 400 })
  }

  const { error } = await supabase
    .from('placements')
    .update({
      company_id: foretagId,
      status:     'matchad',
      source:     'ul',
      ul_note:    note?.trim() || null,
    })
    .eq('id', placementId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, companyId: foretagId })
}