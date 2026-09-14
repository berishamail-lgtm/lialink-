'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'

export default function AgreementsPage() {
  const [user, setUser]             = useState<any>(null)
  const [profile, setProfile]       = useState<any>(null)
  const [orgName, setOrgName]       = useState('')
  const [agreements, setAgreements] = useState<any[]>([])
  const [confirmed, setConfirmed]   = useState<Record<string, boolean>>({})
  const [signing, setSigning]       = useState('')
  const [loading, setLoading]       = useState(true)
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      if (prof?.role === 'education') {
        const { data } = await supabase
          .from('educations').select('program_name').eq('user_id', user.id).single()
        setOrgName(data?.program_name || '')
      } else if (prof?.role === 'company') {
        const { data } = await supabase
          .from('companies').select('company_name').eq('user_id', user.id).single()
        setOrgName(data?.company_name || '')
      } else {
        const { data } = await supabase
          .from('students').select('program').eq('user_id', user.id).single()
        setOrgName(data?.program || '')
      }

      await loadAgreements()
      setLoading(false)
    }
    load()
  }, [])

  async function loadAgreements() {
    const { data } = await supabase
      .from('agreements')
      .select(`
        *,
        students(program, profiles(full_name, email)),
        companies(company_name, city),
        educations(school_name, program_name)
      `)
      .order('created_at', { ascending: false })
    setAgreements(data || [])
  }

  async function sign(agreementId: string) {
    setSigning(agreementId)
    const res = await fetch('/api/signera', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agreementId, role: profile?.role, userId: user.id }),
    })
    const data = await res.json()
    setSigning('')

    if (!res.ok) {
      alert('Signeringen gick inte igenom: ' + (data.error || 'okänt fel'))
      return
    }

    setConfirmed({})
    await loadAgreements()
  }

  function mySignature(a: any) {
    if (profile?.role === 'student')   return a.student_signed_at
    if (profile?.role === 'company')   return a.company_signed_at
    if (profile?.role === 'education') return a.education_signed_at
    return null
  }

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role={profile?.role} name={profile?.full_name} subtitle={orgName} />

      <main className="flex-1 p-5 sm:p-8 max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
          <div>
            <h1 className="text-2xl sm:text-3xl mb-1">Avtal</h1>
            <p className="text-muted text-sm">
              Ett LIA-avtal gäller när student, företag och utbildning alla signerat.
            </p>
          </div>
          {profile?.role === 'education' && (
            <button
              onClick={() => router.push('/dashboard/agreements/skapa')}
              className="bg-accent text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-85 transition"
            >
              Skapa avtal
            </button>
          )}
        </div>

        {agreements.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-12 text-center">
            <p className="mb-1">Inga avtal än</p>
            <p className="text-muted text-sm">
              {profile?.role === 'education'
                ? 'Skapa ett avtal när en student och ett företag kommit överens.'
                : 'Utbildningsledaren skapar avtalet när platsen är klar.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {agreements.map(a => {
              const signed  = mySignature(a)
              const parties = [
                { label: 'Student',     name: a.students?.profiles?.full_name, at: a.student_signed_at },
                { label: 'Företag',     name: a.companies?.company_name,       at: a.company_signed_at },
                { label: 'Utbildning',  name: a.educations?.school_name,       at: a.education_signed_at },
              ]
              const done = parties.filter(p => p.at).length

              return (
                <article key={a.id} className="bg-card border border-line rounded-xl overflow-hidden">
                  <div className="p-6 pb-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
                      <h2 className="text-lg">
                        {a.students?.profiles?.full_name} hos {a.companies?.company_name}
                      </h2>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${
                        a.all_signed ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'
                      }`}>
                        {a.all_signed ? 'Signerat' : `${done} av 3 har signerat`}
                      </span>
                    </div>
                    <p className="text-muted text-sm">
                      {a.educations?.program_name}, {a.educations?.school_name}
                    </p>
                    <p className="text-muted text-sm mt-3">
                      LIA-period {a.lia_start} till {a.lia_end}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 border-t border-line divide-x divide-line">
                    {parties.map(p => (
                      <div key={p.label} className="px-4 py-4">
                        <p className={`text-sm font-medium mb-0.5 ${p.at ? 'text-ok' : 'text-muted'}`}>
                          {p.at ? 'Signerat' : 'Väntar'}
                        </p>
                        <p className="text-xs text-muted truncate">{p.name}</p>
                        {p.at && (
                          <p className="text-xs text-muted/70 mt-0.5">
                            {new Date(p.at).toLocaleDateString('sv-SE')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-line p-5 bg-paper/50">
                    {a.all_signed ? (
                      <button
                        onClick={() => window.open(`/api/avtal-pdf?id=${a.id}`, '_blank')}
                        className="w-full bg-text text-paper rounded-full py-3 text-sm font-medium hover:opacity-85 transition"
                      >
                        Ladda ner avtalet som PDF
                      </button>
                    ) : signed ? (
                      <p className="text-muted text-sm text-center">
                        Du har signerat. Avtalet gäller när övriga parter gjort detsamma.
                      </p>
                    ) : (
                      <>
                        <label className="flex items-start gap-3 mb-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!confirmed[a.id]}
                            onChange={e => setConfirmed({ ...confirmed, [a.id]: e.target.checked })}
                            className="mt-0.5 w-4 h-4 accent-[#e8420a] shrink-0"
                          />
                          <span className="text-muted text-sm leading-relaxed">
                            {profile?.role === 'company'
                              ? `Jag är behörig att ingå detta avtal för ${a.companies?.company_name} och uppgifterna stämmer.`
                              : 'Jag har läst avtalet och uppgifterna stämmer.'}
                          </span>
                        </label>
                        <button
                          onClick={() => sign(a.id)}
                          disabled={!confirmed[a.id] || signing === a.id}
                          className="w-full bg-text text-paper rounded-full py-3 text-sm font-medium hover:opacity-85 transition disabled:opacity-25 disabled:cursor-not-allowed"
                        >
                          {signing === a.id ? 'Signerar' : 'Signera avtalet'}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}