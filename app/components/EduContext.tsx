'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Ctx = {
  educations: any[]
  current: any
  setCurrent: (e: any) => void
  loading: boolean
}

const EduCtx = createContext<Ctx>({
  educations: [], current: null, setCurrent: () => {}, loading: true,
})

export const useEdu = () => useContext(EduCtx)

export function EduProvider({ children }: { children: React.ReactNode }) {
  const [educations, setEducations] = useState<any[]>([])
  const [current, setCurrentState]  = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('educations')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('program_name')

      const lista = data || []
      setEducations(lista)

      const sparad = typeof window !== 'undefined'
        ? localStorage.getItem('lialink-edu')
        : null
      const vald = lista.find(e => e.id === sparad) || lista[0] || null
      setCurrentState(vald)
      setLoading(false)
    }
    load()
  }, [])

  function setCurrent(e: any) {
    setCurrentState(e)
    if (typeof window !== 'undefined' && e?.id) {
      localStorage.setItem('lialink-edu', e.id)
    }
  }

  return (
    <EduCtx.Provider value={{ educations, current, setCurrent, loading }}>
      {children}
    </EduCtx.Provider>
  )
}