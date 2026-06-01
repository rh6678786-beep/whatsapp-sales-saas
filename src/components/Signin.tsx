import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, User, Lock, TrendingUp, DollarSign, Users, Smartphone, Briefcase, Package, ShoppingBag, MessageSquare, Bell, ChevronRight, ArrowRight, Rocket } from 'lucide-react';
import axios from 'axios';

interface SigninProps {
  onSignin: () => void;
  onSignUp: () => void;
}

export default function Signin({ onSignin, onSignUp }: SigninProps) {
  const [storeId, setStoreId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'theme') {
        if (e.newValue === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/login', {
        adminId: storeId || 'default-admin',
        password,
      });
      if (res.data?.token) {
        localStorage.setItem('isAdmin', 'true');
        localStorage.setItem('adminId', res.data.adminId || storeId || 'default-admin');
        localStorage.setItem('authToken', res.data.token);
        onSignin();
      } else {
        setError('Invalid credentials. Please try again.');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || err?.message || '';
      if (status === 401) {
        setError('Invalid credentials. Please try again.');
      } else if (status === 500) {
        setError('Server error: ' + msg);
      } else {
        setError('Cannot connect to server. (' + msg + ')');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans bg-white dark:bg-zinc-900">
      {/* Left – Dashboard Preview */}
      <div className="hidden lg:flex w-[55%] relative overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-cyan-950/30">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:48px_48px] dark:opacity-20" />
        <div className="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] bg-emerald-200/30 dark:bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] bg-teal-200/30 dark:bg-teal-500/10 rounded-full blur-[120px]" />

        {/* Floating mini-cards */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="absolute top-[12%] left-[6%] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-lg shadow-emerald-500/10 border border-white/50 dark:border-zinc-700/50 flex items-center gap-3 z-20"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">WhatsApp</p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Connected</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="absolute top-[18%] right-[6%] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-lg shadow-emerald-500/10 border border-white/50 dark:border-zinc-700/50 flex items-center gap-3 z-20"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">Notifications</p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">3 new alerts</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="absolute bottom-[22%] left-[4%] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-lg shadow-emerald-500/10 border border-white/50 dark:border-zinc-700/50 flex items-center gap-3 z-20"
        >
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">Team</p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">4 members</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.6 }}
          className="absolute bottom-[18%] right-[5%] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-lg shadow-emerald-500/10 border border-white/50 dark:border-zinc-700/50 flex items-center gap-3 z-20"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">Inventory</p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">142 items</p>
          </div>
        </motion.div>

        {/* Main Dashboard Card */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.8, ease: 'easeOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[82%] max-w-[680px] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-emerald-500/10 border border-white/40 dark:border-zinc-700/40 overflow-hidden z-10"
        >
          {/* Card Header */}
          <div className="px-7 pt-7 pb-4 border-b border-emerald-100/50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 tracking-tight">Dashboard Overview</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">Your store at a glance</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Live</span>
              </div>
            </div>
          </div>

          <div className="p-7 space-y-6">
            {/* Three analytics cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Orders', value: '156', change: '+12%', icon: ShoppingBag, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Revenue', value: '$48,290', change: '+8.3%', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Customers', value: '1,024', change: '+23%', icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
              ].map((card) => (
                <div key={card.label} className="bg-white dark:bg-zinc-800/50 rounded-2xl p-4 shadow-sm border border-zinc-100/80 dark:border-zinc-700/80 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{card.label}</span>
                    <div className={`w-8 h-8 ${card.bg} rounded-xl flex items-center justify-center`}>
                      <card.icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                  </div>
                  <p className="text-xl font-black text-zinc-800 dark:text-zinc-100">{card.value}</p>
                  <p className="text-[10px] font-bold text-emerald-600 mt-1">{card.change} vs last month</p>
                </div>
              ))}
            </div>

            {/* Simple Bar Chart */}
            <div className="bg-zinc-50/80 dark:bg-zinc-800/50 rounded-2xl p-5 border border-zinc-100/80 dark:border-zinc-700/80">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 dark:text-zinc-500">Weekly Sales</span>
                <div className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                  <span>Last 7 days</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
              <div className="flex items-end justify-between gap-3 h-20">
                {[35, 55, 42, 78, 65, 90, 82].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: h }}
                      transition={{ delay: 0.5 + i * 0.08, duration: 0.6, ease: 'easeOut' }}
                      className="w-full bg-gradient-to-t from-emerald-400 to-emerald-300 rounded-lg relative group cursor-pointer"
                    >
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[9px] font-bold px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        ${h * 10}
                      </div>
                    </motion.div>
                    <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature cards grid */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'WhatsApp', icon: Smartphone, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Team', icon: Briefcase, color: 'text-violet-600', bg: 'bg-violet-50' },
                { label: 'Inventory', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Orders', icon: ShoppingBag, color: 'text-amber-600', bg: 'bg-amber-50' },
              ].map((f) => (
                <div key={f.label} className="bg-white dark:bg-zinc-800/50 rounded-xl p-3.5 border border-zinc-100 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all hover:border-emerald-100 dark:hover:border-emerald-800 group cursor-default">
                  <div className={`w-9 h-9 ${f.bg} rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                    <f.icon className={`w-4.5 h-4.5 ${f.color}`} />
                  </div>
                  <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">{f.label}</p>
                  <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">Module</p>
                </div>
              ))}
            </div>

            {/* AI Assistant */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">AI Assistant</p>
                  <p className="text-[10px] text-white/80 font-medium">Automate customer support</p>
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 text-[10px] font-bold text-white flex items-center gap-1">
                Active <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right – Signin Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 lg:p-12 relative">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md relative z-10"
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6"
          >
            <Rocket className="w-8 h-8 text-white" />
          </motion.div>

          {/* Title */}
          <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight text-center">Welcome Back</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-2 mb-10 text-center">Sign in to your dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Store ID */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[2px] ml-1">Store ID</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type="text"
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  placeholder="e.g. zia-store"
                  className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 rounded-2xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[2px] ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3.5 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 rounded-2xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-sm font-bold bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 py-3 px-4 rounded-2xl"
              >
                {error}
              </motion.p>
            )}

            {/* Primary CTA */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </motion.button>

            {/* Bottom link */}
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 font-medium pt-2">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={onSignUp}
                className="text-emerald-600 hover:text-emerald-700 font-bold transition-colors"
              >
                Sign up
              </button>
            </p>
          </form>
        </motion.div>
      </div>  
    </div>
  );
}
