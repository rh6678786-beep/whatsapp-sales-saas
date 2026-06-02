import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Mail, Lock, Users, ArrowRight, Rocket } from 'lucide-react';
import axios from 'axios';

interface TeamLoginProps {
  onLogin: () => void;
  onBackToAdmin: () => void;
}

export default function TeamLogin({ onLogin, onBackToAdmin }: TeamLoginProps) {
  const [email, setEmail] = useState('');
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
      const res = await axios.post('/api/team/login', { email, password });
      if (res.data?.token) {
        sessionStorage.setItem('isAdmin', 'true');
        sessionStorage.setItem('adminId', res.data.adminId);
        sessionStorage.setItem('authToken', res.data.token);
        sessionStorage.setItem('teamMember', JSON.stringify(res.data.member));
        onLogin();
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
      <div className="hidden lg:flex w-[55%] relative overflow-hidden bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-cyan-950/30">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:48px_48px] dark:opacity-20" />
        <div className="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] bg-emerald-200/30 dark:bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] bg-teal-200/30 dark:bg-teal-500/10 rounded-full blur-[120px]" />

        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="absolute top-[12%] left-[6%] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-lg shadow-emerald-500/10 border border-white/50 dark:border-zinc-700/50 flex items-center gap-3 z-20"
        >
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">Team Access</p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Role-based login</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.8, ease: 'easeOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[82%] max-w-[680px] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-emerald-500/10 border border-white/40 dark:border-zinc-700/40 overflow-hidden z-10"
        >
          <div className="p-10 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-violet-500/30">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-black text-zinc-800 dark:text-zinc-100 tracking-tight">Team Member Portal</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-2 max-w-sm mx-auto">
              Sign in with your team credentials to access the dashboard with role-based permissions.
            </p>
          </div>
        </motion.div>
      </div>

      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 lg:p-12 relative">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md relative z-10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="w-14 h-14 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-6"
          >
            <Users className="w-8 h-8 text-white" />
          </motion.div>

          <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight text-center">Team Login</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mt-2 mb-10 text-center">Sign in with your team credentials</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[2px] ml-1">Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 group-focus-within:text-violet-500 transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="team@example.com"
                  className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-violet-400 rounded-2xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[2px] ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 group-focus-within:text-violet-500 transition-colors" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3.5 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-violet-400 rounded-2xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm"
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

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-gradient-to-r from-violet-500 to-violet-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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

            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 font-medium pt-2">
              <button
                type="button"
                onClick={onBackToAdmin}
                className="text-violet-600 hover:text-violet-700 font-bold transition-colors"
              >
                Admin login
              </button>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
