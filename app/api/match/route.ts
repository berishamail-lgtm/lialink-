import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function calcPeriodOverlap(
  sStart: string, sEnd: string,
  cStart: string, cEnd: string
): number {
  if (!sStart || !sEnd || !cStart || !cEnd) return 0
  const ss = new Date(sStart).getTime()
  const se = new Date(sEnd).getTime()
  const cs = new Date(cStart).getTime()
  const ce = new Date(cEnd).getTime()
  const overlapStart = Math.max(ss, cs)
  const overlapEnd   = Math.min(se, ce)
  if (overlapEnd <= overlapStart) return 0
  const overlap    = overlapEnd - overlapStart
  const studentLen = se - ss
  return Math.round((overlap / studentLen) * 25)
}

function calcSkills(
  studentSkills: string[],
  lookingFor: string
): number {
  if (!studentSkills?.length || !lookingFor) return 0
  const looking = lookingFor.toLowerCase()
  const matches = studentSkills.filter(s =>
    looking.includes(s.toLowerCase())
  ).length
  return Math.min(30, Math.round((matches / studentSkills.length) * 30))
}

export async function POST() {
  const { data: students, error: se } = await supabase
    .from('students')
    .select('*, profiles(city)')

  const { data: companies, error: ce } = await supabase
    .from('companies')
    .select('*')

  if (se || ce) {
    return NextResponse.json({ message: 'Databasfel: ' + (se?.message || ce?.message) })
  }

  if (!students?.length || !companies?.length) {
    return NextResponse.json({ 
      message: `Ingen data – studenter: ${students?.length || 0}, företag: ${companies?.length || 0}` 
    })
  }

  let created = 0

  for (const student of students) {
    for (const company of companies) {
      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('student_id', student.id)
        .eq('company_id', company.id)
        .single()

      if (existing) continue

      const studentCity = student.profiles?.city?.toLowerCase() || ''
      const companyCity = company.city?.toLowerCase() || ''

      const scoreCity = studentCity && companyCity
        ? studentCity === companyCity ? 30 : 10
        : 0

      const scoreSkills = calcSkills(student.skills || [], company.looking_for || '')

      const scorePeriod = calcPeriodOverlap(
        student.lia_period_start, student.lia_period_end,
        company.lia_period_start, company.lia_period_end
      )

      const scoreSector = student.program && company.sector
        ? company.sector.toLowerCase().includes(
            student.program.split(' ')[0].toLowerCase()
          ) ? 15 : 0
        : 0

      const score = scoreCity + scoreSkills + scorePeriod + scoreSector

      if (score > 0) {
        await supabase.from('matches').insert({
          student_id:   student.id,
          company_id:   company.id,
          score,
          score_city:   scoreCity,
          score_skills: scoreSkills,
          score_period: scorePeriod,
          score_sector: scoreSector,
          status:       'föreslagen'
        })
        created++
      }
    }
  }

  return NextResponse.json({
    message: `Matchning klar – ${created} nya matchningar skapade`
  })
}