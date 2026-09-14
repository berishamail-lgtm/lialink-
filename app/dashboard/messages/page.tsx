'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'

export default function MessagesPage() {
  const [user, setUser]           = useState<any>(null)
  const [profile, setProfile]     = useState<any>(null)
  const [orgName, setOrgName]     = useState('')
  const [conversations, setConvs] = useState<any[]>([])
  const [active, setActive]       = useState<any>(null)
  const [messages, setMessages]   = useState<any[]>([])
  const [draft, setDraft]         = useState('')
  const [loading, setLoading]     = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase  = createClient()
  const router    = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      if (prof?.role === 'education') {
        const { data } = await supabase.from('educations').select('program_name').eq('user_id', user.id).single()
        setOrgName(data?.program_name || '')
      } else if (prof?.role === 'company') {
        const { data } = await supabase.from('companies').select('company_name').eq('user_id', user.id).single()
        setOrgName(data?.company_name || '')
      }

      await loadConversations(user.id)

      const params = new URLSearchParams(window.location.search)
      const toId   = params.get('to')
      const toName = params.get('name')
      if (toId && toName) {
        setActive({
          otherId: toId,
          otherName: toName,
          convId: [user.id, toId].sort().join('-'),
        })
      }

      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!active || !user) return
    openConversation(active)
  }, [active?.convId])

  async function loadConversations(userId: string) {
    const { data } = await supabase
      .from('messages')
      .select('*, from:from_user_id(full_name), to:to_user_id(full_name)')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    const map = new Map()
    for (const m of data || []) {
      const isMine  = m.from_user_id === userId
      const otherId = isMine ? m.to_user_id : m.from_user_id
      if (!map.has(otherId)) {
        map.set(otherId, {
          otherId,
          otherName: isMine ? m.to?.full_name : m.from?.full_name,
          convId:    m.conversation_id,
          preview:   m.body,
          unread:    !m.is_read && !isMine ? 1 : 0,
        })
      } else if (!m.is_read && !isMine) {
        map.get(otherId).unread++
      }
    }
    setConvs(Array.from(map.values()))
  }

  async function openConversation(conv: any) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conv.convId)
      .order('created_at', { ascending: true })
    setMessages(data || [])

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conv.convId)
      .eq('to_user_id', user.id)

    setTimeout(() => bottomRef.current?.scrollIntoView(), 50)

    supabase
      .channel('conv-' + conv.convId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conv.convId}`,
      }, payload => {
        setMessages(prev =>
          prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]
        )
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .subscribe()
  }

  async function send() {
    const body = draft.trim()
    if (!body || !active) return
    setDraft('')

    await supabase.from('messages').insert({
      conversation_id: active.convId,
      from_user_id:    user.id,
      to_user_id:      active.otherId,
      body,
      is_read:         false,
    })
    await loadConversations(user.id)
  }

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role={profile?.role} name={profile?.full_name} subtitle={orgName} />

      <main className="flex-1 flex min-h-0 lg:h-screen">
        <div className={`${active ? 'hidden md:flex' : 'flex'} w-full md:w-72 border-r border-line flex-col shrink-0`}>
          <div className="px-5 py-4 border-b border-line">
            <h1 className="text-lg">Meddelanden</h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-muted text-sm p-5 leading-relaxed">
                Inga konversationer än. Studenter startar en genom att kontakta ett företag från sina matchningar.
              </p>
            ) : conversations.map(c => (
              <button
                key={c.otherId}
                onClick={() => setActive(c)}
                className={`w-full text-left px-5 py-4 border-b border-line transition ${
                  active?.otherId === c.otherId ? 'bg-card' : 'hover:bg-card/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-sm font-medium truncate">{c.otherName}</span>
                  {c.unread > 0 && (
                    <span className="bg-accent text-white text-xs rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center shrink-0">
                      {c.unread}
                    </span>
                  )}
                </div>
                <p className="text-muted text-xs truncate">{c.preview}</p>
              </button>
            ))}
          </div>
        </div>

        <div className={`${active ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <p className="text-muted text-sm">Välj en konversation till vänster.</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-line flex items-center gap-3">
                <button
                  onClick={() => { setActive(null); setMessages([]) }}
                  className="md:hidden text-muted text-sm"
                >
                  Tillbaka
                </button>
                <h2 className="text-base truncate">{active.otherName}</h2>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-2 min-h-[40vh]">
                {messages.length === 0 && (
                  <p className="text-muted text-sm text-center py-8">
                    Skriv första meddelandet.
                  </p>
                )}
                {messages.map(m => {
                  const mine = m.from_user_id === user.id
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        mine ? 'bg-text text-paper' : 'bg-card border border-line'
                      }`}>
                        {m.body}
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-line p-4 flex gap-2">
                <input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder="Skriv ett meddelande"
                  className="flex-1 bg-card border border-line rounded-full px-4 py-2.5 text-sm outline-none focus:border-text/40 transition"
                />
                <button
                  onClick={send}
                  disabled={!draft.trim()}
                  className="bg-text text-paper px-5 rounded-full text-sm font-medium hover:opacity-85 transition disabled:opacity-25"
                >
                  Skicka
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}