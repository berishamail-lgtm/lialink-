'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../../components/Sidebar'

export default function StudentProfil() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [userId, setUserId]   = useState('')
  const [profile, setProfile] = useState<any>(null)

  const [program, setProgram] = useState('')
  const [school, setSchool]   = useState('')
  const [city, setCity]       = useState('')
  const [bio, setBio]         = useState('')
  const [skills, setSkills]   = useState('')
  const [start, setStart]     = useState('')
  const [end, setEnd]         = useState('')

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
        setProgram(s.program || '')
        setSchool(s.school || '')
        setBio(s.bio || '')
        setSkills((s.skills || []).join(', '))
        setStart(s.lia_period_start || '')
        setEnd(s.lia_period_end || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean)
    await supabase.from('profiles').update({ city }).eq('id', userId)

    const payload = {
      program, school, bio,
      skills: skillsArray,
      lia_period_start: start || null,
      lia_period_end:   end   || null,
    }

    const { data: existing } = await supabase
      .from('students').select('id').eq('user_id', userId).single()

    if (existing) {
      await supabase.from('students').update(payload).eq('user_id', userId)
    } else {
      await supabase.from('students').insert({ ...payload, user_id: userId, status: 'söker' })
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
      <Sidebar role="student" name={profile?.full_name} subtitle={program} />

      <main className="flex-1 p-5 sm:p-8 max-w-2xl">
        <h1 className="text-2xl sm:text-3xl mb-1">Min profil</h1>
        <p className="text-muted text-sm mb-7">
          Det du fyller i här styr vilka företag du matchas med. Ort och LIA-period väger tyngst.
        </p>

        <form onSubmit={save} className="space-y-5">
          <section className="bg-card border border-line rounded-xl p-6 space-y-4">
            <h2 className="text-base">Utbildning</h2>

            <div>
              <label className="block text-sm mb-1.5">Program</label>
              <input value={program} onChange={e => setProgram(e.target.value)} placeholder="Automationstekniker" className={field} />
            </div>

            <div>
              <label className="block text-sm mb-1.5">Skola</label>
              <input value={school} onChange={e => setSchool(e.target.value)} placeholder="Lernia Yrkeshögskola" className={field} />
            </div>

            <div>
              <label className="block text-sm mb-1.5">Ort</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="Malmö" className={field} />
              <p className="text-muted text-xs mt-1.5">Företag på samma ort rankas högst i matchningen.</p>
            </div>
          </section>

          <section className="bg-card border border-line rounded-xl p-6 space-y-4">
            <h2 className="text-base">LIA-period</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Startar</label>
                <input type="date" value={start} onChange={e => setStart(e.target.value)} className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">Slutar</label>
                <input type="date" value={end} onChange={e => setEnd(e.target.value)} className={field} />
              </div>
            </div>
          </section>

          <section className="bg-card border border-line rounded-xl p-6 space-y-4">
            <h2 className="text-base">Om dig</h2>

            <div>
              <label className="block text-sm mb-1.5">Kompetenser</label>
              <input value={skills} onChange={e => setSkills(e.target.value)} placeholder="PLC, Excel, felsökning" className={field} />
              <p className="text-muted text-xs mt-1.5">Separera med kommatecken.</p>
            </div>

            <div>
              <label className="block text-sm mb-1.5">Presentation</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={4}
                placeholder="Vad vill du lära dig under din LIA?"
                className={`${field} resize-y`}
              />
              <p className="text-muted text-xs mt-1.5">Företag läser detta innan de kontaktar dig.</p>
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-text text-paper rounded-full py-3.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40"
          >
            {saving ? 'Sparar' : saved ? 'Sparat' : 'Spara profil'}
          </button>
        </form>
      </main>
    </div>
  )
}