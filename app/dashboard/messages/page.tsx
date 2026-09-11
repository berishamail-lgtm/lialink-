'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function MessagesPage() {
  const [user, setUser]               = useState<any>(null)
  const [profile, setProfile]         = useState<any>(null)
  const [conversations, setConvs]     = useState<any[]>([])
  const [activeConv, setActiveConv]   = useState<any>(null)
  const [messages, setMessages]       = useState<any[]>([])
  const [newMsg, setNewMsg]           = useState('')
  const [loading, setLoading]         = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase  = createClient()
  const router    = useRouter()

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

      await loadConversations(user.id)
      setLoading(false)
      // Starta ny konversation om ?to= finns i URL
const params = new URLSearchParams(window.location.search)
const toId   = params.get('to')
const toName = params.get('name')
if (toId && toName) {
  const convId = [user.id, toId].sort().join('-')
  setActiveConv({ otherId: toId, otherName: toName, convId, lastMsg: '', unread: 0 })
}
    }
    load()
  }, [])

  async function loadConversations(userId: string) {
    const { data } = await supabase
      .from('messages')
      .select('*, from:from_user_id(full_name, role), to:to_user_id(full_name, role)')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    // Gruppera per konversation
    const convMap = new Map()
    for (const msg of data || []) {
      const otherId = msg.from_user_id === userId ? msg.to_user_id : msg.from_user_id
      const otherName = msg.from_user_id === userId ? msg.to?.full_name : msg.from?.full_name
      if (!convMap.has(otherId)) {
        convMap.set(otherId, {
          otherId,
          otherName,
          lastMsg: msg.body,
          lastTime: msg.created_at,
          unread: !msg.is_read && msg.to_user_id === userId ? 1 : 0,
          convId: msg.conversation_id
        })
      } else if (!msg.is_read && msg.to_user_id === userId) {
        convMap.get(otherId).unread++
      }
    }
    setConvs(Array.from(convMap.values()))
  }

  async function openConversation(conv: any) {
    setActiveConv(conv)

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conv.convId)
      .order('created_at', { ascending: true })

    setMessages(data || [])

    // Markera som lästa
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conv.convId)
      .eq('to_user_id', user.id)

    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

    // Realtidslyssnare
    supabase
      .channel('messages-' + conv.convId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conv.convId}`
      }, payload => {
        setMessages(prev => [...prev, payload.new])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
      .subscribe()
  }

  async function sendMessage() {
    if (!newMsg.trim() || !activeConv) return

    const msg = {
      conversation_id: activeConv.convId,
      from_user_id:    user.id,
      to_user_id:      activeConv.otherId,
      body:            newMsg.trim(),
      is_read:         false
    }

    await supabase.from('messages').insert(msg)
    setNewMsg('')
    await loadConversations(user.id)
  }

  async function startNewConversation(toUserId: string, toName: string) {
    const convId = [user.id, toUserId].sort().join('-')
    const conv = { otherId: toUserId, otherName: toName, convId, lastMsg: '', unread: 0 }
    setActiveConv(conv)
    setMessages([])
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0f0e0d] flex items-center justify-center">
      <p className="text-white">Laddar…</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0f0e0d] text-white flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-white/10 px-8 py-4 flex items-center justify-between flex-shrink-0">
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

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 62px)' }}>
        {/* Konversationslista */}
        <div className="w-80 border-r border-white/10 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-white/10">
            <h2 className="font-bold">Meddelanden</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-white/30 text-sm">
                Inga konversationer ännu
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.otherId}
                  onClick={() => openConversation(conv)}
                  className={`w-full text-left p-4 border-b border-white/5 hover:bg-white/5 transition ${
                    activeConv?.otherId === conv.otherId ? 'bg-white/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{conv.otherName}</span>
                    {conv.unread > 0 && (
                      <span className="bg-[#e8420a] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                  <p className="text-white/30 text-xs truncate">{conv.lastMsg}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chattfönster */}
        <div className="flex-1 flex flex-col">
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-3">💬</div>
                <h3 className="font-bold mb-1">Välj en konversation</h3>
                <p className="text-white/30 text-sm">eller starta en ny från din dashboard</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chatthuvud */}
              <div className="border-b border-white/10 px-6 py-4">
                <h3 className="font-bold">{activeConv.otherName}</h3>
              </div>

              {/* Meddelanden */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.from_user_id === user.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                      msg.from_user_id === user.id
                        ? 'bg-white text-[#0f0e0d]'
                        : 'bg-white/10 text-white'
                    }`}>
                      {msg.body}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Skriv meddelande */}
              <div className="border-t border-white/10 p-4 flex gap-3">
                <input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Skriv ett meddelande…"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white placeholder-white/20"
                />
                <button
                  onClick={sendMessage}
                  className="bg-white text-[#0f0e0d] px-5 py-3 rounded-xl font-bold text-sm hover:opacity-80 transition"
                >
                  Skicka
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}