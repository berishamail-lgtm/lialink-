import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token saknas' }, { status: 400 })

  const { data } = await supabase
    .from('evaluations')
    .select(`
      id, status, handledare_name, answered_at,
      placements(
        actual_start, actual_end,
        lia_periods(name, start_date, end_date, classes(name, educations(school_name, program_name))),
        students(profiles(full_name)),
        companies(company_name)
      )
    `)
    .eq('token', token)
    .maybeSingle()

  if (!data) return NextResponse.json({ error: 'ogiltig' }, { status: 404 })
  if (data.status === 'besvarat') return NextResponse.json({ error: 'besvarad' }, { status: 409 })

  return NextResponse.json({ evaluation: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, ...svar } = body

  if (!token) return NextResponse.json({ error: 'Token saknas' }, { status: 400 })

  const { data: ev } = await supabase
    .from('evaluations').select('id, status').eq('token', token).maybeSingle()

  if (!ev)                        return NextResponse.json({ error: 'Ogiltig lÃ¤nk' }, { status: 404 })
  if (ev.status === 'besvarat')   return NextResponse.json({ error: 'Redan besvarad' }, { status: 409 })

  const { error } = await supabase
    .from('evaluations')
    .update({ ...svar, status: 'besvarat', answered_at: new Date().toISOString() })
    .eq('id', ev.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
