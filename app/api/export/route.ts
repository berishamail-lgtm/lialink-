import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  // HÃ¤mta all data
  const { data: students } = await supabase
    .from('students')
    .select('*, profiles(full_name, email, city)')

  const { data: agreements } = await supabase
    .from('agreements')
    .select(`
      *,
      students(program, profiles(full_name, email)),
      companies(company_name, org_number, city, sector),
      educations(school_name, program_name)
    `)

  const { data: matches } = await supabase
    .from('matches')
    .select('score')

  // Blad 1: StudentÃ¶versikt
  const studentRows = (students || []).map(s => ({
    'Namn':        s.profiles?.full_name || '',
    'E-post':      s.profiles?.email || '',
    'Program':     s.program || '',
    'Skola':       s.school || '',
    'Stad':        s.profiles?.city || '',
    'LIA-start':   s.lia_period_start || '',
    'LIA-slut':    s.lia_period_end || '',
    'Status':      s.status || '',
    'Kompetenser': (s.skills || []).join(', '),
  }))

  // Blad 2: Avtal
  const agreementRows = (agreements || []).map(a => ({
    'Student':        a.students?.profiles?.full_name || '',
    'Program':        a.students?.program || '',
    'FÃ¶retag':        a.companies?.company_name || '',
    'Org.nummer':     a.companies?.org_number || '',
    'Bransch':        a.companies?.sector || '',
    'Ort':            a.companies?.city || '',
    'LIA-start':      a.lia_start || '',
    'LIA-slut':       a.lia_end || '',
    'Status':         a.all_signed ? 'Komplett' : a.status,
    'Student sign.':  a.student_signed_at   ? new Date(a.student_signed_at).toLocaleDateString('sv-SE')   : '',
    'FÃ¶retag sign.':  a.company_signed_at   ? new Date(a.company_signed_at).toLocaleDateString('sv-SE')   : '',
    'Utbildn. sign.': a.education_signed_at ? new Date(a.education_signed_at).toLocaleDateString('sv-SE') : '',
  }))

  // Blad 3: Sammanfattning fÃ¶r MYH
  const total       = students?.length || 0
  const medPlats    = (students || []).filter(s => ['matchad','avtal','aktiv','klar'].includes(s.status)).length
  const signerade   = (agreements || []).filter(a => a.all_signed).length
  const klara       = (students || []).filter(s => s.status === 'klar').length
  const snittMatch  = matches?.length
    ? Math.round(matches.reduce((sum, m) => sum + m.score, 0) / matches.length)
    : 0

  const summaryRows = [
    { 'Nyckeltal': 'Totalt antal studenter',        'VÃ¤rde': total },
    { 'Nyckeltal': 'Studenter med LIA-plats',       'VÃ¤rde': medPlats },
    { 'Nyckeltal': 'Signerade avtal (alla parter)', 'VÃ¤rde': signerade },
    { 'Nyckeltal': 'SlutfÃ¶rda LIA-perioder',        'VÃ¤rde': klara },
    { 'Nyckeltal': 'Placeringsgrad (%)',            'VÃ¤rde': total ? Math.round((medPlats / total) * 100) : 0 },
    { 'Nyckeltal': 'FullfÃ¶ljandegrad (%)',          'VÃ¤rde': total ? Math.round((klara / total) * 100) : 0 },
    { 'Nyckeltal': 'Genomsnittlig matchning (%)',   'VÃ¤rde': snittMatch },
    { 'Nyckeltal': 'Rapport genererad',             'VÃ¤rde': new Date().toLocaleDateString('sv-SE') },
  ]

  // Bygg arbetsboken
  const wb = XLSX.utils.book_new()

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Sammanfattning')

  const wsStudents = XLSX.utils.json_to_sheet(studentRows)
  wsStudents['!cols'] = [
    { wch: 22 }, { wch: 28 }, { wch: 24 }, { wch: 22 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 }
  ]
  XLSX.utils.book_append_sheet(wb, wsStudents, 'Studenter')

  const wsAgreements = XLSX.utils.json_to_sheet(agreementRows)
  wsAgreements['!cols'] = [
    { wch: 22 }, { wch: 24 }, { wch: 24 }, { wch: 14 }, { wch: 20 },
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }
  ]
  XLSX.utils.book_append_sheet(wb, wsAgreements, 'Avtal')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `LIAlink-MYH-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
