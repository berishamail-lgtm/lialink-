'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AgreementsPage() {
  const [user, setUser]         = useState<any>(null)
  const [profile, setProfile]   = useState<any>(null)
  const [agreements, setAgreements] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  const supabase = createClient()
  const router   = useRouter()
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(prof)

      await loadAgreements(user.id, prof?.role)
      setLoading(false)
    }
    load()
  }, [])

  async function loadAgreements(userId: string, role: string) {
    let query = supabase
      .from('agreements')
      .select(`
        *,
        students(*, profiles(full_name, email)),
        companies(company_name, city),
        educations(school_name, program_name)
      `)
      .order('created_at', { ascending: false })

    const { data } = await query
    setAgreements(data || [])
  }

  async function signAgreement(agreementId: string, role: string) {
    const res = await fetch('/api/signera', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agreementId, role, userId: user.id }),
    })
    const data = await res.json()

    if (!res.ok) {
      alert('Kunde inte signera: ' + (data.error || 'okänt fel'))
      return
    }

    setConfirmed({})
    await loadAgreements(user.id, role)
    alert(data.allSigned
      ? '✓ Avtalet är nu signerat av alla parter! PDF skickas till alla.'
      : '✓ Du har signerat avtalet!')
  
  }

  function hasSignedAlready(agreement: any, role: string): boolean {
    if (role === 'student')   return !!agreement.student_signed_at
    if (role === 'company')   return !!agreement.company_signed_at
    if (role === 'education') return !!agreement.education_signed_at
    return false
  }

  function statusLabel(agreement: any) {
    if (agreement.all_signed) return { text: 'Komplett', color: 'text-green-400', bg: 'bg-green-400/15' }
    if (agreement.status === 'avbrutet') return { text: 'Avbrutet', color: 'text-red-400', bg: 'bg-red-400/15' }
    const signed = [
      agreement.student_signed_at,
      agreement.company_signed_at,
      agreement.education_signed_at
    ].filter(Boolean).length
    return { text: `${signed}/3 signerat`, color: 'text-yellow-400', bg: 'bg-yellow-400/15' }
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/dashboard/${profile?.role === 'education' ? 'education' : profile?.role === 'company' ? 'company' : 'student'}`)}
            className="text-sm text-white/40 hover:text-white transition"
          >
            ← Dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-[#e8420a] text-xs font-bold uppercase tracking-widest mb-2">
              LIA-Avtal
            </p>
            <h1 className="text-3xl font-bold">Avtal & signeringar</h1>
            <p className="text-white/40 mt-1 text-sm">
              Alla tre parter måste signera för att avtalet ska gälla.
            </p>
          </div>

          {/* Bara UL kan skapa avtal */}
          {profile?.role === 'education' && (
            <button
              onClick={() => router.push('/dashboard/agreements/skapa')}
              className="bg-[#e8420a] text-white px-6 py-3 rounded-full font-bold text-sm hover:opacity-80 transition"
            >
              + Skapa avtal
            </button>
          )}
        </div>

        {agreements.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <div className="text-4xl mb-4">📄</div>
            <h2 className="text-lg font-bold mb-2">Inga avtal ännu</h2>
            <p className="text-white/40 text-sm">
              {profile?.role === 'education'
                ? 'Skapa ett avtal när en student och ett företag är överens.'
                : 'Din utbildningsledare skapar avtalet när allt är klart.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {agreements.map(agreement => {
              const status = statusLabel(agreement)
              const signed = hasSignedAlready(agreement, profile?.role)
              return (
                <div key={agreement.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg">
                        {agreement.students?.profiles?.full_name} ↔ {agreement.companies?.company_name}
                      </h3>
                      <p className="text-white/40 text-sm mt-1">
                        {agreement.educations?.school_name} · {agreement.educations?.program_name}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${status.bg} ${status.color}`}>
                      {status.text}
                    </span>
                  </div>

                  {/* Period */}
                  <div className="bg-white/5 rounded-xl p-4 mb-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-white/40">LIA-start</span>
                        <div className="font-semibold mt-1">{agreement.lia_start}</div>
                      </div>
                      <div>
                        <span className="text-white/40">LIA-slut</span>
                        <div className="font-semibold mt-1">{agreement.lia_end}</div>
                      </div>
                    </div>
                  </div>

                  {/* Signeringsstatus */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Student', signed: agreement.student_signed_at, name: agreement.students?.profiles?.full_name },
                      { label: 'Företag', signed: agreement.company_signed_at, name: agreement.companies?.company_name },
                      { label: 'Utbildning', signed: agreement.education_signed_at, name: agreement.educations?.school_name },
                    ].map((party, i) => (
                      <div key={i} className={`rounded-xl p-3 text-center ${party.signed ? 'bg-green-400/10 border border-green-400/20' : 'bg-white/5 border border-white/10'}`}>
                        <div className={`text-lg mb-1 ${party.signed ? 'text-green-400' : 'text-white/20'}`}>
                          {party.signed ? '✓' : '○'}
                        </div>
                        <div className="text-xs font-bold">{party.label}</div>
                        <div className="text-white/30 text-xs truncate">{party.name}</div>
                        {party.signed && (
                          <div className="text-green-400/60 text-xs mt-1">
                            {new Date(party.signed).toLocaleDateString('sv-SE')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Signera-knapp */}
                  {!agreement.all_signed && !signed && (
                    <div>
                      <label className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4 mb-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!confirmed[agreement.id]}
                          onChange={e => setConfirmed({ ...confirmed, [agreement.id]: e.target.checked })}
                          className="mt-0.5 w-4 h-4 accent-[#e8420a]"
                        />
                        <span className="text-white/60 text-xs leading-relaxed">
                          {profile?.role === 'company'
                            ? `Jag intygar att jag är behörig att ingå detta avtal för ${agreement.companies?.company_name} och att uppgifterna ovan är korrekta.`
                            : 'Jag har läst avtalet och intygar att uppgifterna ovan är korrekta.'}
                        </span>
                      </label>
                      <button
                        onClick={() => signAgreement(agreement.id, profile?.role)}
                        disabled={!confirmed[agreement.id]}
                        className="w-full bg-white text-[#0f0e0d] rounded-full py-3 font-bold text-sm hover:opacity-80 transition disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ✍️ Signera avtal
                      </button>
                    </div>
                  )}
                  {signed && !agreement.all_signed && (
                    <p className="text-center text-white/30 text-sm py-2">
                      ✓ Du har signerat – väntar på övriga parter
                    </p>
                  )}
               {agreement.all_signed && (
  <div>
    <p className="text-center text-green-400 text-sm py-2 font-bold">
      ✓ Alla parter har signerat – LIA är bekräftad!
    </p>
      <button onClick={() => window.open(`/api/avtal-pdf?id=${agreement.id}`, '_blank')} className="w-full bg-white text-[#0f0e0d] rounded-full py-3 font-bold text-sm hover:opacity-80 transition">📄 Ladda ner avtal som PDF</button>
  </div>
)}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}