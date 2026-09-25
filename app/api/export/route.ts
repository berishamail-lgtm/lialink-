import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const eduId = req.nextUrl.searchParams.get('edu')
  if (!eduId) return NextResponse.json({ error: 'Utbildning saknas' }, { status: 400 })

  const { data: edu } = await supabase
    .from('educations').select('*').eq('id', eduId).single()

  if (!edu) return NextResponse.json({ error: 'Utbildningen hittades inte' }, { status: 404 })

  const { data: cls } = await supabase
    .from('classes').select('*').eq('education_id', eduId)
  const classIds = (cls || []).map(c => c.id)

  let students: any[] = [], placements: any[] = [], agreements: any[] = [], evaluations: any[] = []

  if (classIds.length) {
    const { data: s } = await supabase
      .from('students')
      .select('*, classes(name, termin, yh_kod), profiles(full_name, email, city)')
      .in('class_id', classIds)
    students = s || []

    const { data: per } = await supabase
      .from('lia_periods').select('id').in('class_id', classIds)
    const periodIds = (per || []).map(p => p.id)

    if (periodIds.length) {
      const { data: pl } = await supabase
        .from('placements')
        .select(`*,
          lia_periods(name, sequence, start_date, end_date, weeks, classes(name, termin, yh_kod)),
          students(profiles(full_name, email, city)),
          companies(company_name, org_number, city, sector)`)
        .in('lia_period_id', periodIds)
      placements = pl || []

      const plIds = placements.map(p => p.id)
      if (plIds.length) {
        const { data: a } = await supabase
          .from('agreements').select('*').in('placement_id', plIds)
        agreements = a || []

        const { data: e } = await supabase
          .from('evaluations').select('*').in('placement_id', plIds)
        evaluations = e || []
      }
    }
  }

  // Blad 1: Sammanfattning
  const medPlats  = placements.filter(p => ['matchad','avtal','aktiv','klar'].includes(p.status)).length
  const klara     = placements.filter(p => p.status === 'klar').length
  const signerade = agreements.filter(a => a.all_signed).length
  const besvarade = evaluations.filter(e => e.status === 'besvarat').length

  const summary = [
    { 'Nyckeltal': 'Utbildning',                     'Värde': edu.program_name },
    { 'Nyckeltal': 'Utbildningsanordnare',           'Värde': edu.school_name },
    { 'Nyckeltal': 'Antal klasser',                  'Värde': classIds.length },
    { 'Nyckeltal': 'Inskrivna studenter',            'Värde': students.length },
    { 'Nyckeltal': 'LIA-perioder totalt',            'Värde': placements.length },
    { 'Nyckeltal': 'Perioder med plats',             'Värde': medPlats },
    { 'Nyckeltal': 'Slutförda perioder',             'Värde': klara },
    { 'Nyckeltal': 'Avtal signerade av alla parter', 'Värde': signerade },
    { 'Nyckeltal': 'Utvärderingar inkomna',          'Värde': besvarade },
    { 'Nyckeltal': 'Placeringsgrad (%)',             'Värde': placements.length ? Math.round((medPlats / placements.length) * 100) : 0 },
    { 'Nyckeltal': 'Fullföljandegrad (%)',           'Värde': placements.length ? Math.round((klara / placements.length) * 100) : 0 },
    { 'Nyckeltal': 'Rapport genererad',              'Värde': new Date().toLocaleDateString('sv-SE') },
    { 'Nyckeltal': 'YH-koder',                       'Värde': (cls || []).map(c => c.yh_kod).filter(Boolean).join(', ') },
  ]

  // Blad 2: Placeringar
  const placRows = placements.map(p => ({
    'YH-kod':       p.lia_periods?.classes?.yh_kod || '',
    'Student':      p.students?.profiles?.full_name || '',
    'E-post':       p.students?.profiles?.email || '',
    'Ort':          p.students?.profiles?.city || '',
    'Klass':        p.lia_periods?.classes?.name || '',
    'Termin':       p.lia_periods?.classes?.termin || '',
    'LIA-period':   p.lia_periods?.name || '',
    'Startdatum':   p.actual_start || p.lia_periods?.start_date || '',
    'Slutdatum':    p.actual_end   || p.lia_periods?.end_date || '',
    'Veckor':       p.lia_periods?.weeks || '',
    'Status':       p.status || '',
    'Företag':      p.companies?.company_name || '',
    'Org.nummer':   p.companies?.org_number || '',
    'Företagsort':  p.companies?.city || '',
    'Bransch':      p.companies?.sector || '',
    'Källa':        p.source || '',
  }))

  // Blad 3: Avtal
  const agrRows = agreements.map(a => {
    const p = placements.find(x => x.id === a.placement_id)
    return {
      'YH-kod':     p?.lia_periods?.classes?.yh_kod || '',
      'Student':        p?.students?.profiles?.full_name || '',
      'LIA-period':     p?.lia_periods?.name || '',
      'Företag':        p?.companies?.company_name || '',
      'Handledare':     a.handledare_name || '',
      'Startdatum':     a.lia_start || '',
      'Slutdatum':      a.lia_end || '',
      'Status':         a.all_signed ? 'Komplett' : a.status,
      'Student sign.':  a.student_signed_at   ? new Date(a.student_signed_at).toLocaleDateString('sv-SE')   : '',
      'Företag sign.':  a.company_signed_at   ? new Date(a.company_signed_at).toLocaleDateString('sv-SE')   : '',
      'Utbildn. sign.': a.education_signed_at ? new Date(a.education_signed_at).toLocaleDateString('sv-SE') : '',
    }
  })

  // Blad 4: Utvärderingar
  const evRows = evaluations.filter(e => e.status === 'besvarat').map(e => {
    const p = placements.find(x => x.id === e.placement_id)
    return {
      'YH-kod':          p?.lia_periods?.classes?.yh_kod || '',
      'Student':          p?.students?.profiles?.full_name || '',
      'LIA-period':       p?.lia_periods?.name || '',
      'Företag':          p?.companies?.company_name || '',
      'Handledare':       e.handledare_name || '',
      'Besvarad':         e.answered_at ? new Date(e.answered_at).toLocaleDateString('sv-SE') : '',
      'Handledarinsats':  e.q1_handledarinsats || '',
      'Vår information':  e.q2_information || '',
      'Initiativ':        e.q3_initiativ || '',
      'Samarbete':        e.q4_samarbete || '',
      'Planera':          e.q5_planera || '',
      'Strukturera':      e.q6_strukturera || '',
      'Analytisk':        e.q7_analytisk || '',
      'Självständig':     e.q8_sjalvstandig || '',
      'Skriftligt':       e.q9a_skriftligt || '',
      'Muntligt':         e.q9b_muntligt || '',
      'Lämplighet':       e.q10_lamplighet || '',
      'Uppförande':       e.q11_uppforande || '',
      'Redovisning':      e.q12_redovisning || '',
      'Kommentar':        e.comment || '',
    }
  })

  const wb = XLSX.utils.book_new()

  const ws1 = XLSX.utils.json_to_sheet(summary)
  ws1['!cols'] = [{ wch: 34 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Sammanfattning')

  const ws2 = XLSX.utils.json_to_sheet(placRows)
  ws2['!cols'] = Array(16).fill({ wch: 18 })
  XLSX.utils.book_append_sheet(wb, ws2, 'Placeringar')

  const ws3 = XLSX.utils.json_to_sheet(agrRows)
  ws3['!cols'] = Array(11).fill({ wch: 18 })
  XLSX.utils.book_append_sheet(wb, ws3, 'Avtal')

  const ws4 = XLSX.utils.json_to_sheet(evRows)
  ws4['!cols'] = Array(20).fill({ wch: 15 })
  XLSX.utils.book_append_sheet(wb, ws4, 'Utvärderingar')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const namn = edu.program_name.replace(/[^a-zA-ZåäöÅÄÖ0-9]/g, '-')
  const filnamn = `LIAlink-${namn}-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filnamn}"`,
    },
  })
}