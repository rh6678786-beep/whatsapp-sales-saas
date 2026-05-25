import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Megaphone, Users, Send, AlertTriangle, Eye, Zap, Sparkles, Clock, CheckCircle2, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useFeatures } from '../hooks/useFeatures';

const TEMPLATES = [
  { 
    id: 'eid', 
    name: '🌙 Eid Sale', 
    text: "Assalam o Alaikum! ✨ Hamari EID SALE shuru ho gayi hai! 🎉 Tamam items par FLAT 50% OFF. Jaldi order karein, stock khatam ho raha hai! 🛍️" 
  },
  { 
    id: 'stock', 
    name: '🔥 Stock Clearance', 
    text: "BIG NEWS! 📢 Humara stock clearance sale live hai. Sab kuch wholesale price par! Check karein abhi. 🚀" 
  },
  { 
    id: 'welcome', 
    name: '👋 New Arrivals', 
    text: "Shukriya humse rabta karne ka! Humare paas nayi collection aa gayi hai. Kya aap dekhna chahenge? 😊" 
  },
  {
    id: 'abandoned',
    name: '🛒 Flash Discount',
    text: "Assalam o Alaikum! Khas aapke liye sirf aaj ke din FLASH SALE: Apna koi bhi pasandida item order karein aur hasil karein FREE DELIVERY! 🚚 Deal miss mat karein."
  },
  {
    id: 'review',
    name: '⭐ Request Review',
    text: "Assalam o Alaikum! Umeed hai apko hamari collection aur service pasand aayi hogi. Agar waqt miley to zaroor batayein ke hum kaise mazeed behtar kar sakte hain. Shukriya! 🙏"
  }
];

export default function BroadcastManager({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const features = useFeatures();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRef = useRef(0);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/stats');
      setCustomerCount(res.data.activeUsers || 0);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (!features.broadcast) {
    return (
      <div className="p-8 max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-[28px] flex items-center justify-center">
          <Lock className="w-10 h-10 text-zinc-400" />
        </div>
        <h2 className="text-3xl font-black text-zinc-900 dark:text-white">Broadcast Locked</h2>
        <p className="text-zinc-500 max-w-md">Bulk broadcast messaging is available on the <span className="font-bold text-zinc-800 dark:text-zinc-200">Business</span> plan and above. Upgrade to send messages to all your customers at once.</p>
        <button onClick={() => onNavigate?.('billing')} className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl hover:scale-105 active:scale-95 transition-all">
          View Plans
        </button>
      </div>
    );
  }

  const handleBroadcast = async () => {
    if (!message.trim()) return;
    
    setIsSending(true);
    setProgress(0);
    currentRef.current = 0;
    setStatusText("Initializing campaign...");

    try {
      const res = await axios.post('/api/broadcast', { message });
      setStatusText(res.data.message);
      
      const total = customerCount || 10;
      intervalRef.current = setInterval(() => {
        currentRef.current += 1;
        const p = Math.min((currentRef.current / total) * 100, 95);
        setProgress(p);
        if (currentRef.current >= total) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setProgress(100);
          setStatusText("Campaign Completed Successfully!");
          setIsSending(false);
        }
      }, 3000);

    } catch (e: any) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsSending(false);
      setStatusText("Broadcast Failed.");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-2"
          >
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg shadow-purple-500/20">
              <Megaphone className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 tracking-tight">
              Broadcast Center
            </h2>
          </motion.div>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Reach your entire audience with a single click
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-6 py-3 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <Users className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-zinc-400">Total Reach</p>
              <p className="text-xl font-black text-zinc-900 dark:text-white">{customerCount || '...'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        
        {/* Left Column: Compose & Templates (8 cols) */}
        <div className="xl:col-span-8 space-y-8">
          
          {/* Templates Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Quick Templates
            </h3>
            <div className="flex flex-wrap gap-3">
              {TEMPLATES.map(t => (
                <button 
                  key={t.id}
                  onClick={() => setMessage(t.text)}
                  className="px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:border-purple-500 dark:hover:border-purple-500 hover:text-purple-500 transition-all shadow-sm active:scale-95"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl group-hover:bg-purple-500/10 transition-all duration-1000" />
            
            <label className="block text-sm font-black text-zinc-400 uppercase tracking-widest mb-4">Craft Your Message</label>
            <textarea 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Start typing your viral marketing message..."
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 min-h-[250px] text-lg font-medium text-zinc-800 dark:text-zinc-200 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none transition-all resize-none shadow-inner"
            />

            <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3 text-zinc-500 bg-zinc-100 dark:bg-zinc-800/50 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-bold tracking-tight">Auto-delay: 3s (Anti-Ban Protection)</span>
              </div>

              <button 
                onClick={handleBroadcast}
                disabled={isSending || !message.trim()}
                className="w-full md:w-auto flex items-center justify-center gap-3 px-12 py-5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-3xl font-black text-xl shadow-[0_20px_50px_rgba(79,70,229,0.3)] hover:shadow-[0_20px_60px_rgba(79,70,229,0.5)] active:scale-95 transition-all disabled:opacity-30 group"
              >
                {isSending ? (
                  <span className="animate-pulse">Launching...</span>
                ) : (
                  <>
                    Send Broadcast <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Progress Section */}
          <AnimatePresence>
            {isSending && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-900 dark:bg-zinc-100 p-8 rounded-[2rem] shadow-2xl text-white dark:text-zinc-900"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                    <span className="text-sm font-black uppercase tracking-widest">{statusText}</span>
                  </div>
                  <span className="text-2xl font-black font-mono">{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-4 bg-zinc-800 dark:bg-zinc-200 rounded-full overflow-hidden border border-white/10 dark:border-black/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-gradient-to-r from-emerald-400 to-blue-500 shadow-[0_0_15px_rgba(52,211,153,0.5)]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Live Preview (4 cols) */}
        <div className="xl:col-span-4">
          <div className="sticky top-28 space-y-4">
            <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2 px-2">
              <Eye className="w-4 h-4" /> Live Preview
            </h3>
            
            {/* WhatsApp Phone Frame */}
            <div className="relative mx-auto w-full max-w-[320px] aspect-[9/18.5] bg-zinc-950 rounded-[3rem] border-[8px] border-zinc-800 dark:border-zinc-900 shadow-2xl overflow-hidden p-1">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-6 bg-zinc-800 dark:border-zinc-900 rounded-b-2xl z-20" />
              
              {/* WhatsApp Header */}
              <div className="bg-[#075E54] p-4 pt-8 flex items-center gap-3">
                <div className="w-8 h-8 bg-zinc-200 rounded-full" />
                <div>
                  <p className="text-white text-xs font-bold">Store Customer</p>
                  <p className="text-[10px] text-emerald-100 opacity-80">online</p>
                </div>
              </div>

              {/* Chat Background */}
              <div className="h-full bg-[#E5DDD5] relative overflow-hidden p-4">
                 {/* Message Bubble */}
                 <motion.div 
                  key={message}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="max-w-[85%] bg-white p-3 rounded-2xl rounded-tl-none shadow-sm text-[13px] text-zinc-800 leading-relaxed relative"
                >
                  <div className="whitespace-pre-wrap break-words min-h-[1em]">
                    {message || "Type a message to see preview..."}
                  </div>
                  <span className="text-[9px] text-zinc-400 block text-right mt-1">10:42 PM</span>
                  <div className="absolute top-0 -left-2 w-0 h-0 border-[10px] border-transparent border-t-white" />
                </motion.div>

                {/* Bottom Bar */}
                <div className="absolute bottom-16 left-0 right-0 p-2 flex gap-2">
                   <div className="flex-1 bg-white rounded-full h-8 px-4 flex items-center text-[10px] text-zinc-400 shadow-sm">
                     Type a message
                   </div>
                   <div className="w-8 h-8 bg-[#075E54] rounded-full flex items-center justify-center text-white shadow-md">
                     <Send className="w-3.5 h-3.5" />
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Benefits Footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10 border-t border-zinc-100 dark:border-zinc-800/50">
        {[
          { icon: <Zap />, title: "Instant Reach", desc: "No queues, direct into customer's inbox" },
          { icon: <CheckCircle2 />, title: "High Conversion", desc: "WhatsApp has a 98% open rate" },
          { icon: <AlertTriangle />, title: "Anti-Ban", desc: "Built-in smart delay for safety" },
        ].map((item, idx) => (
          <div key={idx} className="flex gap-4 p-4 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
            <div className="text-purple-500">{item.icon}</div>
            <div>
              <h4 className="text-sm font-black dark:text-white">{item.title}</h4>
              <p className="text-xs text-zinc-500 mt-1">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
