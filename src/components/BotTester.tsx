import React, { useState, useEffect, useLayoutEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Send, Smartphone, User, Bot, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function BotTester() {
  const [phone, setPhone] = useState('whatsapp:+923001234567');
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<{ role: 'user' | 'model', text: string, images?: string[], videos?: string[] }[]>([]);
  const [loading, setLoading] = useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);

  // Whenever the AI (model) sends a response, ensure the input stays focused and selected
  useLayoutEffect(() => {
    if (chat.length && chat[chat.length - 1].role === 'model') {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(0, 0);
    }
  }, [chat]);

  const sendMessage = async () => {
    if (!message.trim()) return;
    if (loading) return;

    const userMsg = message;
    setMessage('');
    setChat(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    // Refocus the input field immediately after sending the message
    inputRef.current?.focus();
    // Ensure the cursor is at the start (selection cleared)
    inputRef.current?.setSelectionRange(0, 0);

    try {
      const res = await axios.post('/api/webhook/whatsapp', {
        From: phone,
        Body: userMsg
      }, {
        timeout: 30000,
        validateStatus: (status) => status < 500
      });

      if (res.status >= 400) {
        setChat(prev => [...prev, { role: 'model', text: "Server issue ho gaya. Thoda wait karein aur dubara try karein." }]);
      } else if (res.data?.response) {
        setChat(prev => [...prev, { role: 'model', text: res.data.response, images: res.data.images, videos: res.data.videos }]);
      } else {
        setChat(prev => [...prev, { role: 'model', text: "Koi response nahi aaya." }]);
      }
    } catch (err: any) {
      toast.error("Failed to send message");
      setChat(prev => [...prev, { role: 'model', text: "Connection error: " + (err.message || "Try again") }]);
      } finally {
        setLoading(false);
        // Keep the input focused and place cursor at start for the next message
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(0, 0);
      }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto h-[calc(100vh-100px)] flex flex-col transition-colors">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2 transition-colors">
          <Smartphone className="w-6 h-6" /> WhatsApp Simulator
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm transition-colors">Test the AI Salesman flow as a customer</p>
      </header>

      <div className="flex-1 bg-zinc-100 dark:bg-zinc-900/50 rounded-3xl p-6 overflow-y-auto space-y-4 border-8 border-white dark:border-zinc-900 shadow-inner transition-colors">
        {chat.map((msg, i) => (
          <motion.div
            initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm text-sm ${msg.role === 'user' ? 'bg-zinc-900 dark:bg-emerald-600 text-white rounded-br-none' : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white rounded-bl-none border border-zinc-100 dark:border-zinc-700'
              }`}>
              <div className="flex items-center gap-2 mb-1 opacity-50 text-[10px] font-bold uppercase tracking-widest">
                {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                {msg.role === 'user' ? 'Customer' : 'AI Salesman'}
              </div>
              {msg.videos && msg.videos.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {msg.videos.map((vid, i) => (
                    <video key={i} src={vid} controls className="w-64 rounded-xl border border-zinc-200 dark:border-zinc-700" />
                  ))}
                </div>
              )}
              {msg.images && msg.images.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {msg.images.map((img, i) => (
                    <img key={i} src={img} alt="Product" className="w-32 h-32 object-cover rounded-xl border border-zinc-200 dark:border-zinc-700" />
                  ))}
                </div>
              )}
              {msg.text}
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex justify-start italic text-zinc-400 dark:text-zinc-500 text-xs animate-pulse">
            AI Salesman is typing...
          </div>
        )}
        {chat.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4 opacity-30 dark:opacity-20 text-zinc-900 dark:text-white">
            <Smartphone className="w-12 h-12" />
            <p>Send a message like "Hello" or "Price kya hai?" to start the sales funnel.</p>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="mt-6 flex gap-4"
      >
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          autoFocus
          onFocus={(e) => e.target.select()}
          placeholder="Type your message..."
          className="flex-1 px-6 py-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-2xl shadow-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-emerald-500 outline-none transition-colors"
          disabled={loading}
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          disabled={loading}
          className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 p-4 rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
        </button>
      </form>
    </div>
  );
}
