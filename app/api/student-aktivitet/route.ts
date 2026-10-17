import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Aktivitet per student för en utbildning. Räknas ihop här i stället för i
// sidan, dels för att senaste inloggning bara går att läsa med servernyckeln,
// dels för att det annars blir sex frågor per sidladdning.

export async function POST(req: NextRequest) {
  const { educationId } = await req.json()

  if (!educationId) {
    return NextResponse.json({ error: 'Utbildning saknas' }, { status: 400 })
  }

  const { data: cls } = await supabase
    .from('classes').select('id, name').eq('education_id', educationId)

  const classIds = (cls || []).map(c => c.id)
  if (!classIds.length) return NextResponse.json({ ok: true, studenter: [] })

  const { data: studenter } = await supabase
    .from('students')
    .select('id, user_id, class_id, bio, skills, cv_path, pb_path, status, profiles(full_name, email, city)')
    .in('class_id', classIds)

  if (!studenter?.length) return NextResponse.json({ ok: true, studenter: [] })

  const studentIds = studenter.map(s => s.id)
  const userIds    = studenter.map(s => s.user_id).filter(Boolean)

  // ── Placeringar ────────────────────────────────────────────────
  const { data: placeringar } = await supabase
    .from('placements')
    .select('id, student_id, status, lia_periods(name, start_date)')
    .in('student_id', studentIds)

  // ── Matchningar ────────────────────────────────────────────────
  const { data: matchningar } = await supabase
    .from('matches')
    .select('student_id, score, company_id, companies(company_name), lia_platser(titel)')
    .in('student_id', studentIds)

  // ── Vilka användare tillhör ett företag? ───────────────────────
  // Behövs för att skilja "kontaktat ett företag" från "skrivit till sin UL".
  const { data: agare }   = await supabase
    .from('companies').select('user_id').not('user_id', 'is', null)
  const { data: medlem }  = await supabase
    .from('company_members').select('user_id')

  const foretagsAnvandare = new Set<string>([
    ...(agare  || []).map((c: any) => c.user_id),
    ...(medlem || []).map((m: any) => m.user_id),
  ].filter(Boolean))

  // ── Meddelanden i båda riktningar ──────────────────────────────
  const { data: skickade } = await supabase
    .from('messages')
    .select('from_user_id, to_user_id, created_at')
    .in('from_user_id', userIds)

  const { data: mottagna } = await supabase
    .from('messages')
    .select('from_user_id, to_user_id, created_at')
    .in('to_user_id', userIds)

  const kontaktadeAv: Record<string, Set<string>> = {}
  const sistaUtgaende: Record<string, string> = {}

  for (const m of skickade || []) {
    if (!foretagsAnvandare.has(m.to_user_id)) continue
    const f = m.from_user_id
    kontaktadeAv[f] = kontaktadeAv[f] || new Set()
    kontaktadeAv[f].add(m.to_user_id)
    if (!sistaUtgaende[f] || m.created_at > sistaUtgaende[f]) {
      sistaUtgaende[f] = m.created_at
    }
  }

  const svarTill: Record<string, Set<string>> = {}
  for (const m of mottagna || []) {
    if (!foretagsAnvandare.has(m.from_user_id)) continue
    const t = m.to_user_id
    svarTill[t] = svarTill[t] || new Set()
    svarTill[t].add(m.from_user_id)
  }

  // ── Senaste inloggning ur auth ─────────────────────────────────
  const senastInloggad: Record<string, string | null> = {}
  try {
    for (let sida = 1; sida <= 10; sida++) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page: sida,
        perPage: 1000,
      })
      if (error || !data?.users?.length) break
      for (const u of data.users) {
        senastInloggad[u.id] = (u as any).last_sign_in_at || null
      }
      if (data.users.length < 1000) break
    }
  } catch {
    // Går det inte visar sidan bara ett streck i den kolumnen.
  }

  const klassNamn: Record<string, string> = {}
  for (const c of cls || []) klassNamn[c.id] = c.name

  // ── Sätt ihop raderna ──────────────────────────────────────────
  const rader = studenter.map((s: any) => {
    const prof = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles

    const harKompetenser = Array.isArray(s.skills) && s.skills.length > 0
    const harBio = !!(s.bio && String(s.bio).trim())
    const harOrt = !!(prof?.city && String(prof.city).trim())
    const harCv  = !!s.cv_path
    const harPb  = !!s.pb_path

    const delar = [harKompetenser, harBio, harOrt, harCv, harPb]
    const profilProcent = Math.round((delar.filter(Boolean).length / delar.length) * 100)

    const mina: any[] = (matchningar || []).filter((m: any) => m.student_id === s.id)
    const sorterade = [...mina].sort((a: any, b: any) => b.score - a.score)
    const topp: any = sorterade[0] || null

    const toppCo: any = topp
      ? (Array.isArray(topp.companies) ? topp.companies[0] : topp.companies)
      : null

    const pl: any = (placeringar || []).find((p: any) => p.student_id === s.id) || null
    const period: any = pl
      ? (Array.isArray(pl.lia_periods) ? pl.lia_periods[0] : pl.lia_periods)
      : null

    return {
      studentId: s.id,
      userId:    s.user_id,
      namn:      prof?.full_name || 'Namn saknas',
      epost:     prof?.email || null,
      ort:       prof?.city || null,
      klass:     klassNamn[s.class_id] || '',

      harKompetenser, harBio, harOrt, harCv, harPb, profilProcent,

      matchTotalt: mina.length,
      matchBra:    mina.filter((m: any) => m.score >= 60).length,
      toppPoang:   topp?.score ?? null,
      toppForetag: toppCo?.company_name || null,

      kontaktade: s.user_id ? (kontaktadeAv[s.user_id]?.size || 0) : 0,
      svar:       s.user_id ? (svarTill[s.user_id]?.size || 0)     : 0,
      sistKontakt: s.user_id ? (sistaUtgaende[s.user_id] || null)  : null,

      senastAktiv: s.user_id ? (senastInloggad[s.user_id] ?? null) : null,

      placeringStatus: pl?.status || s.status || null,
      periodNamn:      period?.name || null,
    }
  })

  return NextResponse.json({ ok: true, studenter: rader })
}
