import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function overlapScore(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  if (!aStart || !aEnd || !bStart || !bEnd) return 0
  const as = new Date(aStart).getTime(), ae = new Date(aEnd).getTime()
  const bs = new Date(bStart).getTime(), be = new Date(bEnd).getTime()
  const start = Math.max(as, bs), end = Math.min(ae, be)
  if (end <= start) return 0
  return Math.round(((end - start) / (ae - as)) * 25)
}

function skillScore(skills: string[], lookingFor: string): number {
  if (!skills?.length || !lookingFor) return 0
  const text = lookingFor.toLowerCase()
  const hits = skills.filter(s => text.includes(s.toLowerCase())).length
  return Math.min(30, Math.round((hits / skills.length) * 30))
}

export async function POST() {
  // Placeringar som fortfarande söker
  const { data: placements, error: pe } = await supabase
    .from('placements')
    .select(`
      id, status, actual_start, actual_end,
      lia_periods(start_date, end_date, classes(educations(id))),
      students(id, skills, program, profiles(city))
    `)
    .in('status', ['söker', 'uppskjuten'])

  const { data: companies, error: ce } = await supabase
    .from('companies')
    .select('*')
    .gt('spots_available', 0)

  if (pe || ce) {
    return NextResponse.json({ message: 'Databasfel: ' + (pe?.message || ce?.message) })
  }

  if (!placements?.length) {
    return NextResponse.json({ message: 'Inga studenter söker LIA-plats just nu.' })
  }

  if (!companies?.length) {
    return NextResponse.json({ message: 'Inga företag med lediga platser att matcha mot.' })
  }

  let skapade = 0

  for (const pl of placements as any[]) {
    const student = pl.students
    if (!student) continue

    // Faktiska datum går före klassens planerade
    const start = pl.actual_start || pl.lia_periods?.start_date
    const end   = pl.actual_end   || pl.lia_periods?.end_date

    const studentCity = student.profiles?.city?.toLowerCase() || ''

    for (const co of companies) {
      const { data: finns } = await supabase
        .from('matches')
        .select('id')
        .eq('placement_id', pl.id)
        .eq('company_id', co.id)
        .maybeSingle()

      if (finns) continue
            // Respektera företagets val av utbildningar
      if (co.open_to === 'valda') {
        const eduId = pl.lia_periods?.classes?.educations?.id
        const { data: tillaten } = await supabase
          .from('company_educations')
          .select('id')
          .eq('company_id', co.id)
          .eq('education_id', eduId)
          .maybeSingle()
        if (!tillaten) continue
      }

      const companyCity = co.city?.toLowerCase() || ''
      const scoreCity = studentCity && companyCity
        ? (studentCity === companyCity ? 30 : 8)
        : 0

      const scoreSkills = skillScore(student.skills || [], co.looking_for || '')
      const scorePeriod = overlapScore(start, end, co.lia_period_start, co.lia_period_end)

      const scoreSector = student.program && co.sector
        ? (co.sector.toLowerCase().includes(student.program.split(' ')[0].toLowerCase()) ? 15 : 0)
        : 0

      const score = scoreCity + scoreSkills + scorePeriod + scoreSector
      if (score < 20) continue

      await supabase.from('matches').insert({
        placement_id: pl.id,
        student_id:   student.id,
        company_id:   co.id,
        score,
        score_city:   scoreCity,
        score_skills: scoreSkills,
        score_period: scorePeriod,
        score_sector: scoreSector,
        status:       'föreslagen',
      })
      skapade++
    }
  }

  return NextResponse.json({
    message: skapade === 0
      ? 'Inga nya matchningar. Alla möjliga träffar finns redan.'
      : `${skapade} ${skapade === 1 ? 'ny matchning' : 'nya matchningar'} skapade.`
  })
}