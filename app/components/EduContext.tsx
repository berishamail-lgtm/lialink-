'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Ctx = {
  educations: any[]
  current: any
  setCurrent: (e: any) => void
  loading: boolean
  fel: string
}

const EduCtx = createContext<Ctx>({
  educations: [], current: null, setCurrent: () => {}, loading: true, fel: '',
})

export const useEdu = () => useContext(EduCtx)

export function EduProvider({ children }: { children: React.ReactNode }) {
  const [educations, setEducations] = useState<any[]>([])
  const [current, setCurrentState]  = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [fel, setFel]               = useState('')
  const supabase = createClient()

  useEffect(() => {
    let avbruten = false

    async function hamta(userId: string) {
      const { data: prof } = await supabase
        .from('profiles').select('role').eq('id', userId).maybeSingle()

      if (avbruten) return

      if (prof?.role !== 'education') { setLoading(false); return }

      const { data: uppdrag } = await supabase
        .from('education_staff')
        .select('education_id')
        .eq('user_id', userId)
        .eq('aktiv', true)

      const ids = (uppdrag || []).map(u => u.education_id)

      if (!ids.length) {
        // Personal kopplad till skolan utan egen utbildning
        const { data: skolUppdrag } = await supabase
          .from('school_staff')
          .select('school_id, schools(id, name)')
          .eq('user_id', userId)
          .eq('aktiv', true)
          .maybeSingle()

        if (skolUppdrag) {
          const skola = Array.isArray((skolUppdrag as any).schools)
            ? (skolUppdrag as any).schools[0]
            : (skolUppdrag as any).schools

          setEducations([])
          setCurrentState({
            id: null,
            school_id: skolUppdrag.school_id,
            program_name: skola?.name || 'Företagsnätverk',
            endast_natverk: true,
          })
          setLoading(false)
          return
        }

        setEducations([])
        setCurrentState(null)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('educations')
        .select('*')
        .in('id', ids)
        .eq('active', true)
        .order('program_name')

      if (avbruten) return

      if (error) {
        setFel('Kunde inte hämta dina utbildningar. Ladda om sidan.')
        setLoading(false)
        return
      }

      const lista = data || []
      setEducations(lista)

      const sparad = typeof window !== 'undefined'
        ? localStorage.getItem('lialink-edu')
        : null
      setCurrentState(lista.find(e => e.id === sparad) || lista[0] || null)
      setLoading(false)
    }

    // Kör direkt om sessionen redan finns
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (avbruten) return
      if (session?.user) hamta(session.user.id)
      else setLoading(false)
    })

    // Och när den återställs eller ändras
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (avbruten) return
      if (session?.user) hamta(session.user.id)
      else {
        setEducations([])
        setCurrentState(null)
        setLoading(false)
      }
    })

    const timeout = setTimeout(() => { if (!avbruten) setLoading(false) }, 8000)

    return () => {
      avbruten = true
      clearTimeout(timeout)
      sub.subscription.unsubscribe()
    }
  }, [])

  function setCurrent(e: any) {
    setCurrentState(e)
    if (typeof window !== 'undefined' && e?.id) {
      localStorage.setItem('lialink-edu', e.id)
    }
  }

  return (
    <EduCtx.Provider value={{ educations, current, setCurrent, loading, fel }}>
      {children}
    </EduCtx.Provider>
  )
}