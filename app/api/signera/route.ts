import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { agreementId, role, userId } = await req.json()

  if (!agreementId || !role || !userId) {
    return NextResponse.json({ error: 'Uppgifter saknas' }, { status: 400 })
  }

  // HÃ¤mta IP frÃ¥n request-headers
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'okÃ¤nd'

  const timeField = role === 'student' ? 'student_signed_at'
                  : role === 'company' ? 'company_signed_at'
                  : 'education_signed_at'

  const ipField   = role === 'student' ? 'student_signed_ip'
                  : role === 'company' ? 'company_signed_ip'
                  : 'education_signed_ip'

  // Kontrollera att anvÃ¤ndaren faktiskt Ã¤r part i avtalet
  const { data: agreement } = await supabase
    .from('agreements')
    .select('*, students(user_id), companies(user_id), educations(user_id)')
    .eq('id', agreementId)
    .single()

  if (!agreement) {
    return NextResponse.json({ error: 'Avtalet hittades inte' }, { status: 404 })
  }

  const partyId = role === 'student' ? agreement.students?.user_id
                : role === 'company' ? agreement.companies?.user_id
                : agreement.educations?.user_id

  if (partyId !== userId) {
    return NextResponse.json({ error: 'Du Ã¤r inte part i detta avtal' }, { status: 403 })
  }

  const { error } = await supabase
    .from('agreements')
    .update({
      [timeField]: new Date().toISOString(),
      [ipField]:   ip,
    })
    .eq('id', agreementId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Kolla om alla nu signerat
  const { data: updated } = await supabase
    .from('agreements')
    .select('all_signed')
    .eq('id', agreementId)
    .single()

  if (updated?.all_signed) {
    // Skicka PDF till alla parter
    await fetch(`${req.nextUrl.origin}/api/skicka-avtal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agreementId }),
    }).catch(() => {}) // fel hÃ¤r ska inte blockera signeringen
  }

  return NextResponse.json({
    ok: true,
    allSigned: updated?.all_signed ?? false,
  })
}
