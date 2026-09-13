'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function SkapaAvtal() {
  const [user, setUser]           = useState<any>(null)
  const [students, setStudents]   = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [education, setEducation] = useState<any>(null)
  const [studentId, setStudentId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [liaStart, setLiaStart]   = useState('')
  const [liaEnd, setLiaEnd]       = useState('')
  const [saving, setSaving]       = useState(false)
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: edu } = await supabase
        .from('educations')
        .select('*')
        .eq('user_id', user.id)
        .single()
      setEducation(edu)

      const { data: studs } = await supabase
        .from('students')
        .select('*, profiles(full_name)')
      setStudents(studs || [])

      const { data: comps } = await supabase
        .from('companies')
        .select('*')
      setCompanies(comps || [])
    }
    load()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    await supabase.from('agreements').insert({
      student_id:   studentId,
      company_id:   companyId,
      education_id: education.id,
      lia_start:    liaStart,
      lia_end:      liaEnd,
      status:       'skickat'
    })

    router.push('/dashboard/agreements')
  }

  return (
    <div className="min-h-screen bg-[#0f0e0d] text-white">
      <nav className="border-b border-white/10 px-8 py-4 flex items-center justify-between">
        <div className="font-bold text-xl">
          LIA<span className="text-[#e8420a]">link</span>
        </div>
        <button
          onClick={() => router.push('/dashboard/agreements')}
          className="text-sm text-white/40 hover:text-white transition"
        >
          ← Tillbaka
        </button>
      </nav>

      <div className="max-w-2xl mx-auto px-8 py-10">
        <div className="mb-8">
          <p className="text-[#e8420a] text-xs font-bold uppercase tracking-widest mb-2">Utbildningsledare</p>
          <h1 className="text-3xl font-bold">Skapa LIA-avtal</h1>
          <p className="text-white/40 mt-1 text-sm">
            Välj student och företag – alla tre parter signerar digitalt.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-5">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Student *</label>
              <select
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                required
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white"
              >
                <option value="">Välj student…</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.profiles?.full_name} – {s.program}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Företag *</label>
              <select
                value={companyId}
                onChange={e => setCompanyId(e.target.value)}
                required
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white"
              >
                <option value="">Välj företag…</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.company_name} – {c.city}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">LIA-start *</label>
                <input
                  type="date"
                  value={liaStart}
                  onChange={e => setLiaStart(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">LIA-slut *</label>
                <input
                  type="date"
                  value={liaEnd}
                  onChange={e => setLiaEnd(e.target.value)}
                  required
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
            {saving ? 'Skapar…' : 'Skapa avtal & skicka till parter →'}
          </button>
        </form>
      </div>
    </div>
  )
}