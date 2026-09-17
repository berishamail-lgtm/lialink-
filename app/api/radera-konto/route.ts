import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Avgör om kontot kan raderas helt eller måste anonymiseras
async function bedomning(userId: string, role: string) {
  if (role === 'student') {
    const { data: s } = await supabase
      .from('students').select('id').eq('user_id', userId).maybeSingle()
    if (!s) return { metod: 'raderad', skal: [] as string[] }

    const { count: avtal } = await supabase
      .from('agreements').select('id', { count: 'exact', head: true })
      .eq('student_id', s.id).not('education_signed_at', 'is', null)

    const skal: string[] = []
    if (avtal) skal.push(`${avtal} signerat ${avtal === 1 ? 'LIA-avtal' : 'LIA-avtal'}`)

    return { metod: skal.length ? 'anonymiserad' : 'raderad', skal, studentId: s.id }
  }

  if (role === 'company') {
    const { data: c } = await supabase
      .from('companies').select('id').eq('user_id', userId).maybeSingle()
    if (!c) return { metod: 'raderad', skal: [] as string[] }

    const { count: avtal } = await supabase
      .from('agreements').select('id', { count: 'exact', head: true })
      .eq('company_id', c.id).not('company_signed_at', 'is', null)

    const skal: string[] = []
    if (avtal) skal.push(`${avtal} signerat ${avtal === 1 ? 'LIA-avtal' : 'LIA-avtal'}`)

    return { metod: skal.length ? 'anonymiserad' : 'raderad', skal, companyId: c.id }
  }

  // Utbildningsledare
  const { data: e } = await supabase
    .from('educations').select('id').eq('user_id', userId).maybeSingle()
  if (!e) return { metod: 'raderad', skal: [] as string[] }

  const { count: klasser } = await supabase
    .from('classes').select('id', { count: 'exact', head: true }).eq('education_id', e.id)

  const skal: string[] = []
  if (klasser) skal.push(`${klasser} ${klasser === 1 ? 'klass' : 'klasser'} med studenter`)

  return { metod: klasser ? 'blockerad' : 'raderad', skal, educationId: e.id }
}

// Vad som händer, utan att göra det
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  const role   = req.nextUrl.searchParams.get('role')
  if (!userId || !role) return NextResponse.json({ error: 'Uppgifter saknas' }, { status: 400 })

  const b = await bedomning(userId, role)
  return NextResponse.json(b)
}

export async function POST(req: NextRequest) {
  const { userId, role, reason } = await req.json()
  if (!userId || !role) return NextResponse.json({ error: 'Uppgifter saknas' }, { status: 400 })

  const b: any = await bedomning(userId, role)

  if (b.metod === 'blockerad') {
    return NextResponse.json(
      { error: 'Kontot kan inte tas bort så länge det har aktiva klasser. Flytta över eller avsluta dem först.' },
      { status: 409 }
    )
  }

  // Ta bort uppladdade filer oavsett metod
  const { data: filer } = await supabase.storage.from('dokument').list(userId)
  if (filer?.length) {
    await supabase.storage.from('dokument')
      .remove(filer.map(f => `${userId}/${f.name}`))
  }

  if (b.metod === 'anonymiserad') {
    if (role === 'student' && b.studentId) {
      await supabase.from('students').update({
        bio: null, skills: null, cv_path: null, pb_path: null,
        linkedin_url: null, anonymized: true,
      }).eq('id', b.studentId)
    }
    if (role === 'company' && b.companyId) {
      await supabase.from('companies').update({
        contact_name: null, contact_email: null, contact_phone: null,
        description: null, anonymized: true, user_id: null, claimed: false,
      }).eq('id', b.companyId)
    }

    await supabase.from('profiles').update({
      full_name: 'Borttagen användare',
      email:     `borttagen-${userId.slice(0, 8)}@lialink.se`,
      phone:     null,
      city:      null,
      avatar_url: null,
      deleted_at: new Date().toISOString(),
      deletion_reason: reason || null,
    }).eq('id', userId)
  }

  await supabase.from('deletion_log').insert({
    role,
    method: b.metod,
    reason: reason || null,
  })

  // Auth-kontot bort i båda fallen. Radering tar med profilen via cascade.
  await supabase.auth.admin.deleteUser(userId)

  return NextResponse.json({ ok: true, metod: b.metod })
}
