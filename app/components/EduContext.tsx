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

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (!avbruten) setLoading(false); return }

        const { data: prof } = await supabase
          .from('profiles').select('role').eq('id', user.id).maybeSingle()
                  console.log('EduContext: user', user.id, 'roll', prof?.role)

        // Bara utbildningsledare behöver utbildningar
        if (prof?.role !== 'education') {
          if (!avbruten) setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('educations')
          .select('*')
          .eq('user_id', user.id)
          .eq('active', true)
          .order('program_name')
          console.log('EduContext: utbildningar', data?.length, 'fel', error?.message)

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
      } catch (e) {
        if (!avbruten) {
          setFel('Något gick fel vid inläsningen. Ladda om sidan.')
          setLoading(false)
        }
      }
    }

    load()

    // Säkerhetsnät: fastna aldrig i laddningsläge
    const timeout = setTimeout(() => {
      if (!avbruten) setLoading(false)
    }, 8000)

    return () => { avbruten = true; clearTimeout(timeout) }
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