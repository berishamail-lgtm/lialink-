'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../../components/Sidebar'

export default function StudentProfil() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')
  const [userId, setUserId]   = useState('')
  const [profile, setProfile] = useState<any>(null)

  const [kod, setKod]             = useState('')
  const [klass, setKlass]         = useState<any>(null)
  const [kodStatus, setKodStatus] = useState('')

  const [city, setCity]     = useState('')
  const [bio, setBio]       = useState('')
  const [skills, setSkills] = useState('')

  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      if (prof?.city) setCity(prof.city)

      const { data: s } = await supabase
        .from('students').select('*').eq('user_id', user.id).single()

      if (s) {
        setBio(s.bio || '')
        setSkills((s.skills || []).join(', '))
        if (s.class_id) {
          const { data: c } = await supabase
            .from('classes')
            .select('*, educations(program_name, school_name)')
            .eq('id', s.class_id).single()
          if (c) { setKlass(c); setKod(c.yh_kod) }
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  async function checkKod() {
    const varde = kod.trim()
    if (!varde) return
    setKodStatus('söker')

    const { data } = await supabase
      .from('classes')
      .select('*, educations(program_name, school_name)')
      .eq('yh_kod', varde)
      .maybeSingle()

    if (data) { setKlass(data); setKodStatus('hittad') }
    else      { setKlass(null); setKodStatus('saknas') }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!klass) { setError('Ange din YH-kod och kontrollera den först.'); return }

    setSaving(true)
    setError('')

    const skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean)
    await supabase.from('profiles').update({ city }).eq('id', userId)

    const payload = {
      class_id: klass.id,
      program:  klass.educations?.program_name || '',
      school:   klass.educations?.school_name  || '',
      bio,
      skills:   skillsArray,
    }

    const { data: existing } = await supabase
      .from('students').select('id').eq('user_id', userId).maybeSingle()

    let studentId = existing?.id

    if (existing) {
      await supabase.from('students').update(payload).eq('user_id', userId)
    } else {
      const { data: created } = await supabase
        .from('students').insert({ ...payload, user_id: userId, status: 'sÃ¶ker' })
        .select('id').single()
      studentId = created?.id
    }

    if (studentId) {
      const { data: perioder } = await supabase
        .from('lia_periods').select('id').eq('class_id', klass.id)

      for (const p of perioder || []) {
        await supabase.from('placements')
          .insert({ student_id: studentId, lia_period_id: p.id, status: 'sÃ¶ker' })
          .select()
      }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => router.push('/dashboard/student'), 900)
  }

  const field = 'w-full bg-card border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="student" name={profile?.full_name} subtitle={klass?.name} />

      <main className="flex-1 p-5 sm:p-8 max-w-2xl">
        <h1 className="text-2xl sm:text-3xl mb-1">Min profil</h1>
        <p className="text-muted text-sm mb-7">
          Din ort och dina kompetenser styr vilka företag du matchas med.
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">{error}</p>
        )}

        <form onSubmit={save} className="space-y-5">
          <section className="bg-card border border-line rounded-xl p-6 space-y-4">
            <h2 className="text-base">Din utbildning</h2>

            <div>
              <label className="block text-sm mb-1.5">YH-kod</label>
              <div className="flex gap-2">
                <input value={kod} onChange={e => { setKod(e.target.value); setKodStatus('') }} placeholder="YH01234-2025" className={field} />
                <button type="button" onClick={checkKod} className="bg-text text-paper rounded-lg px-5 text-sm font-medium hover:opacity-85 transition shrink-0">Kontrollera</button>
              </div>
              <p className="text-muted text-xs mt-1.5">Koden får du av din utbildningsledare vid kursstart.</p>
            </div>

            {kodStatus === 'saknas' && (
              <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3">
                Ingen klass med den koden. Kontrollera stavningen med din utbildningsledare.
              </p>
            )}

            {klass && (
              <div className="bg-ok/8 border border-ok/25 rounded-lg px-4 py-3">
                <p className="text-sm font-medium">{klass.educations?.program_name}</p>
                <p className="text-muted text-sm">{klass.educations?.school_name}, klass {klass.name}</p>
              </div>
            )}
          </section>

          <section className="bg-card border border-line rounded-xl p-6 space-y-4">
            <h2 className="text-base">Om dig</h2>

            <div>
              <label className="block text-sm mb-1.5">Ort</label>
              <input value={city} onChange={e => setCity(e.target.value)} required placeholder="Malmö" className={field} />
              <p className="text-muted text-xs mt-1.5">Du läser på distans, så ange orten där du vill göra din LIA.</p>
            </div>

            <div>
              <label className="block text-sm mb-1.5">Kompetenser</label>
              <input value={skills} onChange={e => setSkills(e.target.value)} placeholder="PLC, Excel, felsökning" className={field} />
              <p className="text-muted text-xs mt-1.5">Separera med kommatecken.</p>
            </div>

            <div>
              <label className="block text-sm mb-1.5">Presentation</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} placeholder="Vad vill du lära dig under din LIA?" className={field + ' resize-y'} />
              <p className="text-muted text-xs mt-1.5">företag läser detta innan de hör av sig.</p>
            </div>
          </section>

          <button type="submit" disabled={saving || !klass} className="w-full bg-text text-paper rounded-full py-3.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-30">
            {saving ? 'Sparar' : saved ? 'Sparat' : 'Spara profil'}
          </button>
        </form>
      </main>
    </div>
  )
}
