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
    .from('member_invites')
    .select('id, company_id, email, name, accepted_at, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) {
    return NextResponse.json({ error: 'Inbjudan hittades inte' }, { status: 404 })
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: 'Inbjudan är redan använd' }, { status: 409 })
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Inbjudan har gått ut' }, { status: 410 })
  }

  const { data: co } = await supabase
    .from('companies')
    .select('id, company_name')
    .eq('id', invite.company_id)
    .maybeSingle()

  if (!co) {
    return NextResponse.json({ error: 'Företaget hittades inte' }, { status: 404 })
  }

  // Profilraden måste finnas innan company_members kan peka på användaren.
  // Kontot är obekräftat här, så ingen session finns som kan skapa den.
  const { data: befintligProfil } = await supabase
    .from('profiles')
    .select('id')
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
      full_name: invite.name || null,
    })

    if (pErr) {
      return NextResponse.json(
        { error: 'Kunde inte skapa profil: ' + pErr.message },
        { status: 500 }
      )
    }
  }

  // Redan medlem? Då är vi klara.
  const { data: befintligMedlem } = await supabase
    .from('company_members')
    .select('id')
    .eq('company_id', invite.company_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!befintligMedlem) {
    const { error: mErr } = await supabase.from('company_members').insert({
      company_id:  invite.company_id,
      user_id:     userId,
      member_role: 'handledare',
    })

    if (mErr) {
      return NextResponse.json(
        { error: 'Kunde inte koppla dig till företaget: ' + mErr.message },
        { status: 500 }
      )
    }
  }

  await supabase
    .from('member_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  return NextResponse.json({
    ok: true,
    companyId: invite.company_id,
    companyName: co.company_name,
  })
}
