import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Session, Message, SalesState, formatUserId } from '../types';
import { MessageSquare, Search, Clock, Smartphone, CheckCheck, Eye, User, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function LiveChat() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isWhatsAppLinked, setIsWhatsAppLinked] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    axios.get('/api/whatsapp/status').then(res => {
      setIsWhatsAppLinked(res.data.isReady);
    }).catch(() => setIsWhatsAppLinked(false));

    const fetchSessions = async () => {
      try {
        const res = await axios.get('/api/sessions');
        setSessions((res.data as Session[]).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()));
      } catch (err) {}
    };

    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedSession) return;

    const fetchMessages = async () => {
      try {
        const res = await axios.get(`/api/sessions/${selectedSession.id}/messages`);
        setMessages(res.data);
      } catch (err) {}
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedSession?.id]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const filteredSessions = sessions.filter(s => 
    s.userId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isWhatsAppLinked) {
    return (
      <div className="h-[calc(100vh-120px)] max-w-[1600px] mx-auto p-4 flex items-center justify-center">
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 p-12 text-center max-w-lg shadow-sm">
          <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-4">WhatsApp Not Linked</h2>
          <p className="text-zinc-500 dark:text-zinc-400">
            Please link your WhatsApp device to view live customer chats.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] max-w-[1600px] mx-auto p-4 flex gap-4">
      {/* Left Sidebar: Customer List */}
      <div className="w-96 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden shadow-sm">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">Active Chats</h2>
            <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">Live</div>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700 rounded-2xl text-sm outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredSessions.map((session) => {
            const isActive = selectedSession?.id === session.id;
            return (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className={`w-full p-4 rounded-3xl flex items-center gap-4 transition-all group ${
                  isActive ? 'bg-zinc-900 dark:bg-zinc-800 text-white shadow-xl' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-lg text-zinc-500">
                  {session.userId.slice(-2)}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-sm truncate">{session.userId}</div>
                  <div className="text-xs opacity-60">State: {session.state}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Panel: Chat History */}
      <div className="flex-1 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden shadow-sm relative">
        {!selectedSession ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <MessageSquare className="w-12 h-12 text-zinc-200 mb-4" />
            <h3 className="text-xl font-black">Select a Chat</h3>
          </div>
        ) : (
          <>
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-black">{selectedSession.userId}</h3>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      await axios.patch(`/api/sessions/${selectedSession.id}`, { isBlocked: !selectedSession.isBlocked });
                      setSelectedSession(prev => prev ? { ...prev, isBlocked: !prev.isBlocked } : null);
                    } catch (e) {
                      console.error("Failed to update session:", e);
                    }
                  }}
                  className="px-4 py-2 bg-red-50 text-red-500 rounded-xl text-[10px] font-black uppercase"
                >
                  {selectedSession.isBlocked ? 'Unblock' : 'Block'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[70%] px-6 py-4 rounded-[2rem] ${
                    msg.role === 'user' ? 'bg-zinc-100 dark:bg-zinc-800 rounded-tl-none' : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-tr-none'
                  }`}>
                    <p className="text-sm font-medium">{msg.text}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800">
               <div className="flex items-center justify-between px-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">AI is managing this chat</span>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-black uppercase">Live</span>
                  </div>
               </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
