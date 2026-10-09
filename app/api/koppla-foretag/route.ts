import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { token, userId } = await req.json()

  if (!token || !userId) {
    return NextResponse.json({ error: 'Token och användare krävs' }, { status: 400 })
  }

  const { data: invite } = await supabase
    .from('company_invites')
    .select('id, company_id, accepted_at, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) {
    return NextResponse.json({ error: 'Inbjudan hittades inte' }, { status: 404 })
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Inbjudan har gått ut' }, { status: 410 })
  }

  // Redan kopplat?
  const { data: co } = await supabase
    .from('companies')
    .select('id, name, user_id, claimed')
    .eq('id', invite.company_id)
    .maybeSingle()

  if (!co) {
    return NextResponse.json({ error: 'Företaget hittades inte' }, { status: 404 })
  }

  if (co.user_id && co.user_id !== userId) {
    return NextResponse.json(
      { error: 'Företaget är redan kopplat till ett annat konto' },
      { status: 409 }
    )
  }

  // Profilrad måste finnas innan companies.user_id kan sättas (foreign key).
  // Kontot är ofta obekräftat här, så ingen session finns som kan skapa den.
  const { data: befintligProfil } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()

  if (!befintligProfil) {
    const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(userId)

    if (authErr || !authData?.user?.email) {
      return NextResponse.json(
        { error: 'Kunde inte läsa användarens e-postadress' },
        { status: 500 }
      )
    }

    const { error: pErr } = await supabase.from('profiles').insert({
      id: userId,
      email: authData.user.email,
      role: 'company',
      full_name: co.name ?? null,
    })

    if (pErr) {
      return NextResponse.json(
        { error: 'Kunde inte skapa profil: ' + pErr.message },
        { status: 500 }
      )
    }
  }

  const { error: uErr } = await supabase
    .from('companies')
    .update({ user_id: userId, claimed: true })
    .eq('id', invite.company_id)

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

  await supabase
    .from('company_invites')
    .update({ accepted_at: new Date().toISOString(), pending_user_id: userId })
    .eq('id', invite.id)

  return NextResponse.json({ ok: true, companyId: invite.company_id })
}
