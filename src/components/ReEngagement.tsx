import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Send, Clock, Sparkles, MessageSquare, RefreshCw, Loader2, CheckCircle, XCircle, Target, TrendingUp, User, Calendar, Zap, Eye, ChevronRight, Lock } from 'lucide-react';
import { Session, formatUserId } from '../types';
import { useFeatures } from '../hooks/useFeatures';

export default function ReEngagement({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const features = useFeatures();
  const [customers, setCustomers] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendingOne, setSendingOne] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [config, setConfig] = useState({ enabled: true, inactiveDays: 7, maxReminders: 3, minLeadScore: 0 });
  const [showConfig, setShowConfig] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/re-engagement/customers');
      setCustomers(res.data.customers);
      setTotal(res.data.total);
    } catch (err) { }
    setLoading(false);
  };

  const fetchConfig = async () => {
    try {
      const res = await axios.get('/api/settings');
      if (res.data.reEngagement) setConfig(res.data.reEngagement);
    } catch (err) { }
  };

  useEffect(() => {
    fetchCustomers();
    fetchConfig();
  }, []);

  if (!features.reEngagement) {
    return (
      <div className="p-8 max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-[28px] flex items-center justify-center">
          <Lock className="w-10 h-10 text-zinc-400" />
        </div>
        <h2 className="text-3xl font-black text-zinc-900 dark:text-white">Re-Engagement Locked</h2>
        <p className="text-zinc-500 max-w-md">Auto re-engagement for inactive customers is available on the <span className="font-bold text-zinc-800 dark:text-zinc-200">Professional</span> plan and above. Upgrade to automatically follow up with customers who haven't replied.</p>
        <button onClick={() => onNavigate?.('billing')} className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-black text-sm shadow-xl hover:scale-105 active:scale-95 transition-all">
          View Plans
        </button>
      </div>
    );
  }

  const handleSendAll = async () => {
    if (!confirm(`Send re-engagement messages to ${customers.length} customers?`)) return;
    setSending(true);
    setResult(null);
    try {
      const res = await axios.post('/api/re-engagement/send-all');
      setResult({ sent: res.data.sent || 0, failed: res.data.failed || 0 });
      setTimeout(() => fetchCustomers(), 2000);
    } catch (err) {
      setResult({ sent: 0, failed: customers.length });
    }
    setSending(false);
  };

  const handleSendOne = async (userId: string) => {
    setSendingOne(userId);
    try {
      const res = await axios.post('/api/re-engagement/send-one', { userId });
      if (res.data.success) {
        setPreviewMsg(res.data.message);
        setTimeout(() => fetchCustomers(), 1000);
      }
    } catch (err) {
      console.error("Failed to send re-engagement:", err);
      setPreviewMsg("Failed to send message. Check server.");
    }
    setSendingOne(null);
  };

  const handlePreview = async (userId: string) => {
    setSelectedCustomer(userId);
    setPreviewLoading(true);
    setPreviewMsg(null);
    try {
      const res = await axios.post('/api/re-engagement/preview', { userId });
      setPreviewMsg(res.data?.message || 'No message generated');
    } catch (err) {
      setPreviewMsg('Failed to generate preview');
    }
    setPreviewLoading(false);
  };

  const handleSaveConfig = async () => {
    try {
      await axios.post('/api/re-engagement/schedule', config);
      setShowConfig(false);
      fetchCustomers();
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  };

  const getDaysSince = (dateStr: string) => {
    const ts = new Date(dateStr).getTime();
    if (isNaN(ts)) return Infinity;
    return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
  };

  const activeCustomers = customers.filter(c => {
    const days = getDaysSince(c.lastMessageAt);
    return days >= config.inactiveDays && (c.remindersCount || 0) < config.maxReminders;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4 mb-3">
            <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300 }} className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-rose-500/30 to-orange-500/30 rounded-[20px] blur-lg" />
              <div className="relative w-16 h-16 rounded-[20px] bg-gradient-to-br from-rose-500 to-orange-600 flex items-center justify-center shadow-2xl">
                <Users className="w-8 h-8 text-white" />
              </div>
            </motion.div>
            <div>
              <h2 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 tracking-tight">Re-Engagement</h2>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2 mt-1">
                <Sparkles className="w-4 h-4 text-rose-500" />
                Bring back inactive customers with AI-powered messages
              </p>
            </div>
          </motion.div>
        </div>
        <div className="flex gap-3">
          <motion.button onClick={() => setShowConfig(!showConfig)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-5 py-3 rounded-2xl font-black text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center gap-2">
            <Target className="w-4 h-4" />
            Settings
          </motion.button>
          <motion.button onClick={fetchCustomers} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-5 py-3 rounded-2xl font-black text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </motion.button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-4 gap-4">
        {[
          { label: 'Inactive Customers', value: total, icon: Users, c: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/5' },
          { label: 'Ready to Engage', value: activeCustomers.length, icon: Target, c: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/5' },
          { label: 'Already Contacted', value: customers.filter(c => (c.remindersCount || 0) > 0).length, icon: CheckCircle, c: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/5' },
          { label: 'Potential Revenue', value: `Rs.${(activeCustomers.length * 2500).toLocaleString()}`, icon: TrendingUp, c: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/5' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{stat.label}</p>
              <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-4 h-4 ${stat.c}`} />
              </div>
            </div>
            <p className={`text-2xl font-black ${stat.c}`}>{stat.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showConfig && (
          <motion.div initial={{ opacity: 0, y: -20, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -20, height: 0 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[28px] p-6 shadow-lg overflow-hidden">
            <div className="grid grid-cols-4 gap-6">
              {[
                { label: 'Auto Send', key: 'enabled', type: 'toggle' },
                { label: 'Inactive Days', key: 'inactiveDays', type: 'number', min: 1, max: 90 },
                { label: 'Max Reminders', key: 'maxReminders', type: 'number', min: 1, max: 10 },
                { label: 'Min Lead Score', key: 'minLeadScore', type: 'number', min: 0, max: 100 },
              ].map(field => (
                <div key={field.key} className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{field.label}</label>
                  {field.type === 'toggle' ? (
                    <button onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))} className={`w-full py-3 rounded-xl font-black text-sm transition-all ${config.enabled ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                      {config.enabled ? 'ON' : 'OFF'}
                    </button>
                  ) : (
                    <input type="number" value={(config as any)[field.key]} onChange={e => setConfig(c => ({ ...c, [field.key]: Number(e.target.value) }))} min={field.min} max={field.max} className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-rose-500" />
                  )}
                </div>
              ))}
            </div>
            <motion.button onClick={handleSaveConfig} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="mt-4 w-full py-3 rounded-2xl font-black text-sm bg-gradient-to-r from-rose-500 to-orange-600 text-white shadow-lg flex items-center justify-center gap-2">
              <SaveIcon className="w-4 h-4" />
              Save Settings
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send All Button */}
      {activeCustomers.length > 0 && (
        <motion.button
          onClick={handleSendAll}
          disabled={sending}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="relative w-full py-5 rounded-[28px] font-black text-lg bg-gradient-to-r from-rose-500 to-orange-600 text-white shadow-2xl shadow-rose-500/40 flex items-center justify-center gap-3 overflow-hidden disabled:opacity-50"
        >
          <motion.div animate={{ x: ['-100%', '200%'] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut', repeatDelay: 1 }} className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg]" />
          {sending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
          <span className="relative z-10">{sending ? `Sending to ${activeCustomers.length} customers...` : `Send AI Re-Engagement to ${activeCustomers.length} Customers`}</span>
        </motion.button>
      )}

      {/* Result Banner */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`rounded-2xl p-5 flex items-center gap-3 ${result.sent > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30' : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30'}`}>
            {result.sent > 0 ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
            <p className={`text-sm font-bold ${result.sent > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
              {result.sent > 0 ? `✅ ${result.sent} messages sent successfully!` : `❌ Failed to send messages`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[28px] overflow-hidden shadow-lg">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-black text-zinc-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-rose-500" />
            Inactive Customers
          </h3>
          <span className="text-xs font-bold text-zinc-400">{customers.length} customers</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Users className="w-12 h-12 mb-4 opacity-30" />
            <p className="font-bold text-lg">No inactive customers found</p>
            <p className="text-sm">All customers are active or already contacted</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {customers.map((customer, idx) => {
              const days = getDaysSince(customer.lastMessageAt);
              const isEligible = days >= config.inactiveDays && (customer.remindersCount || 0) < config.maxReminders;
              const isSelected = selectedCustomer === customer.userId;

              return (
                <motion.div key={customer.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }}>
                  <div className="p-5 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${isEligible ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                    {formatUserId(customer.userId).slice(-2)}
                  </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-zinc-900 dark:text-white">{formatUserId(customer.userId)}</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${customer.state === 'NEGOTIATING' ? 'bg-amber-100 text-amber-700' : customer.state === 'NEW' ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-500'}`}>
                              {customer.state}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {days}d ago</span>
                            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {customer.metadata?.messageCount || 0} msgs</span>
                            <span className={`flex items-center gap-1 font-bold ${customer.metadata?.leadStatus === 'HOT' ? 'text-rose-500' : customer.metadata?.leadStatus === 'WARM' ? 'text-amber-500' : 'text-zinc-400'}`}>
                              {customer.metadata?.leadStatus || 'COLD'}
                            </span>
                            {customer.selectedProductId && <span className="text-emerald-500">🎯 Product Selected</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <motion.button
                          onClick={() => handlePreview(customer.userId)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
                          title="Preview Message"
                        >
                          <Eye className="w-4 h-4" />
                        </motion.button>

                        <motion.button
                          onClick={() => handleSendOne(customer.userId)}
                          disabled={sendingOne === customer.userId || !isEligible}
                          whileHover={isEligible ? { scale: 1.05 } : {}}
                          whileTap={isEligible ? { scale: 0.95 } : {}}
                          className={`p-2.5 rounded-xl transition-all flex items-center gap-2 ${
                            sendingOne === customer.userId
                              ? 'bg-rose-500 text-white'
                              : isEligible
                                ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-300 cursor-not-allowed'
                          }`}
                          title={isEligible ? 'Send Message' : `Already contacted ${customer.remindersCount}/${config.maxReminders} times`}
                        >
                          {sendingOne === customer.userId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </motion.button>

                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-xs font-bold text-zinc-400">
                          <Clock className="w-3 h-3" />
                          {customer.remindersCount || 0}/{config.maxReminders}
                        </div>
                      </div>
                    </div>

                    {/* Preview */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="mt-4 ml-14 p-4 bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-500/5 dark:to-orange-500/5 border border-rose-200 dark:border-rose-500/20 rounded-2xl">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="w-4 h-4 text-rose-500" />
                              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">AI Generated Message</span>
                            </div>
                            {previewLoading ? (
                              <div className="flex items-center gap-2 text-zinc-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Generating...</div>
                            ) : (
                              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 leading-relaxed">{previewMsg || 'No preview available'}</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
