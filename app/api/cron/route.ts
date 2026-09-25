import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  // Skydda mot anrop utifrån
  const hemlighet = req.headers.get('authorization')
  if (process.env.CRON_SECRET && hemlighet !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Obehörig' }, { status: 401 })
  }

  const tregrans = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  // Avtal som skapats för minst tre dagar sedan, inte signerade, ingen påminnelse skickad
  const { data: avtal } = await supabase
    .from('agreements')
    .select('id')
    .eq('all_signed', false)
    .neq('status', 'avbrutet')
    .lt('created_at', tregrans)
    .is('paminnelse_skickad_at', null)

  let avtalPaminnelser = 0
  for (const a of avtal || []) {
    const res = await fetch(`${req.nextUrl.origin}/api/avtal-notis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agreementId: a.id, paminnelse: true }),
    }).catch(() => null)
    if (res?.ok) avtalPaminnelser++
  }

  // Utvärderingar som skickats för minst en vecka sedan utan svar
  const veckograns = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: utv } = await supabase
    .from('evaluations')
    .select('placement_id')
    .eq('status', 'skickat')
    .lt('sent_at', veckograns)
    .is('reminded_at', null)

  let utvPaminnelser = 0
  for (const e of utv || []) {
    const res = await fetch(`${req.nextUrl.origin}/api/skicka-utvardering`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placementId: e.placement_id, paminnelse: true }),
    }).catch(() => null)
    if (res?.ok) utvPaminnelser++
  }

  return NextResponse.json({
    ok: true,
    avtalPaminnelser,
    utvPaminnelser,
    kord: new Date().toISOString(),
  })
}