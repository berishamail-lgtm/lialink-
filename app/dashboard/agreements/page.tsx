'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'

export default function AgreementsPage() {
  const [error, setError] = useState('')
  const [user, setUser]             = useState<any>(null)
  const [profile, setProfile]       = useState<any>(null)
  const [orgName, setOrgName]       = useState('')
  const [agreements, setAgreements] = useState<any[]>([])
  const [confirmed, setConfirmed]   = useState<Record<string, boolean>>({})
  const [signing, setSigning]       = useState('')
  const [loading, setLoading]       = useState(true)
  const supabase = createClient()
  const router   = useRouter()
  const [last, setLast] = useState<Record<string, boolean>>({})

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
  async function taBortAvtal(a: any) {
    const namn = a.students?.profiles?.full_name || 'studenten'
    if (!confirm(`Ta bort avtalet för ${namn}? Det går inte att ångra.`)) return

    const { error: err } = await supabase.from('agreements').delete().eq('id', a.id)
    if (err) { setError(err.message); return }

    await supabase.from('placements')
      .update({ status: 'matchad' })
      .eq('id', a.placement_id)

    await loadAgreements()
  }

  async function avbrytAvtal(a: any) {
    const skal = prompt('Varför avbryts avtalet?')
    if (skal === null) return

    const { error: err } = await supabase.from('agreements').update({
      status: 'avbrutet',
      avbrutet_skal: skal.trim() || null,
      avbrutet_at: new Date().toISOString(),
    }).eq('id', a.id)

    if (err) { setError(err.message); return }

    await supabase.from('placements')
      .update({ status: 'avbruten' })
      .eq('id', a.placement_id)

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
        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">{error}</p>
        )}
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
                                        {profile?.role === 'education' && a.status !== 'avbrutet' && (
                      <div className="flex flex-wrap gap-4 mt-3">
                        {!a.all_signed && (
                          <button onClick={() => taBortAvtal(a)} className="text-muted hover:text-alert text-sm underline underline-offset-2 transition">Ta bort avtalet</button>
                        )}
                        {a.all_signed && (
                          <button onClick={() => avbrytAvtal(a)} className="text-muted hover:text-alert text-sm underline underline-offset-2 transition">Avbryt avtalet</button>
                        )}
                      </div>
                    )}
                    {a.status === 'avbrutet' && (
                      <p className="text-alert text-sm mt-3">
                        Avbrutet{a.avbrutet_at ? ' ' + new Date(a.avbrutet_at).toLocaleDateString('sv-SE') : ''}
                        {a.avbrutet_skal ? ': ' + a.avbrutet_skal : ''}
                      </p>
                    )}
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
                        <a href={`/api/avtal-pdf?id=${a.id}`} target="_blank" rel="noopener" onClick={() => setLast({ ...last, [a.id]: true })} className="block w-full text-center border border-line rounded-full py-3 text-sm font-medium hover:border-text/30 transition mb-3">Läs avtalet</a>
                        <label className={`flex items-start gap-3 mb-3 ${last[a.id] ? 'cursor-pointer' : 'opacity-40'}`}>
                          <input
                            type="checkbox"
                            disabled={!last[a.id]}
                            checked={!!confirmed[a.id]}
                            onChange={e => setConfirmed({ ...confirmed, [a.id]: e.target.checked })}
                            className="mt-0.5 w-4 h-4 accent-[#e8420a] shrink-0"
                          />
                          <span className="text-muted text-sm leading-relaxed">
                            {profile?.role === 'company'
                              ? `Jag har läst avtalet, är behörig att ingå det för ${a.companies?.company_name} och uppgifterna stämmer.`
                              : 'Jag har läst avtalet och uppgifterna stämmer.'}
                          </span>
                        </label>
                        {!last[a.id] && (
                          <p className="text-muted text-sm mb-3">
                            Öppna och läs avtalet innan du signerar.
                          </p>
                        )}
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