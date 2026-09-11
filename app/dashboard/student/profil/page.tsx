'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function StudentProfil() {
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [success, setSuccess]   = useState(false)
  const [userId, setUserId]     = useState('')
  const [program, setProgram]   = useState('')
  const [school, setSchool]     = useState('')
  const [bio, setBio]           = useState('')
  const [city, setCity]         = useState('')
  const [skills, setSkills]     = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd]     = useState('')
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: prof } = await supabase
        .from('profiles')
        .select('city')
        .eq('id', user.id)
        .single()
      if (prof?.city) setCity(prof.city)

      const { data: stud } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (stud) {
        setProgram(stud.program || '')
        setSchool(stud.school || '')
        setBio(stud.bio || '')
        setSkills((stud.skills || []).join(', '))
        setPeriodStart(stud.lia_period_start || '')
        setPeriodEnd(stud.lia_period_end || '')
      }

      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean)

    await supabase.from('profiles').update({ city }).eq('id', userId)

    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (existing) {
      await supabase.from('students').update({
        program, school, bio,
        skills: skillsArray,
        lia_period_start: periodStart || null,
        lia_period_end:   periodEnd   || null,
      }).eq('user_id', userId)
    } else {
      await supabase.from('students').insert({
        user_id: userId,
        program, school, bio,
        skills: skillsArray,
        lia_period_start: periodStart || null,
        lia_period_end:   periodEnd   || null,
        status: 'söker'
      })
    }

    setSaving(false)
    setSuccess(true)
    setTimeout(() => {
      router.push('/dashboard/student')
    }, 1500)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0f0e0d] flex items-center justify-center">
      <p className="text-white">Laddar…</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0f0e0d] text-white">
      <nav className="border-b border-white/10 px-8 py-4 flex items-center justify-between">
        <div className="font-bold text-xl">
          LIA<span className="text-[#e8420a]">link</span>
        </div>
        <button
          onClick={() => router.push('/dashboard/student')}
          className="text-sm text-white/40 hover:text-white transition"
        >
          ← Tillbaka
        </button>
      </nav>

      <div className="max-w-2xl mx-auto px-8 py-10">
        <div className="mb-8">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Student</p>
          <h1 className="text-3xl font-bold">Din profil</h1>
          <p className="text-white/40 mt-1 text-sm">Fyll i din information så kan vi matcha dig med rätt företag.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-sm uppercase tracking-wider text-white/40">Grundinfo</h2>

            <div>
              <label className="block text-sm font-semibold mb-1">Utbildningsprogram</label>
              <input
                value={program}
                onChange={e => setProgram(e.target.value)}
                placeholder="t.ex. Digital Marknadsföring"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white placeholder-white/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Skola</label>
              <input
                value={school}
                onChange={e => setSchool(e.target.value)}
                placeholder="t.ex. Lernia Yrkeshögskola"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white placeholder-white/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Stad</label>
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="t.ex. Malmö"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white placeholder-white/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Om mig</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Berätta kort om dig själv och vad du söker i en LIA-plats…"
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white placeholder-white/20 resize-none"
              />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-sm uppercase tracking-wider text-white/40">LIA-info</h2>

            <div>
              <label className="block text-sm font-semibold mb-1">Kompetenser</label>
              <input
                value={skills}
                onChange={e => setSkills(e.target.value)}
                placeholder="t.ex. Excel, Python, Projektledning (separera med komma)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white placeholder-white/20"
              />
              <p className="text-white/30 text-xs mt-1">Separera med komma</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">LIA-start</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={e => setPeriodStart(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">LIA-slut</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={e => setPeriodEnd(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-white text-[#0f0e0d] rounded-full py-4 font-bold text-sm hover:opacity-80 transition disabled:opacity-50"
          >
            {saving ? 'Sparar…' : success ? '✓ Sparat!' : 'Spara profil →'}
          </button>
        </form>
      </div>
    </div>
  )
}