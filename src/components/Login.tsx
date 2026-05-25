import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, User, Sparkles, ArrowRight, ShieldCheck, Store, LogIn, Mail, KeyRound, ArrowLeft, Timer, Eye, EyeOff, Rocket, CheckCircle, X } from 'lucide-react';
import axios from 'axios';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimer(30);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOtpRequest = async (): Promise<boolean> => {
    setLoading(true);
    setError('');
    setOtp('');
    try {
      const res = await axios.post('/api/auth/send-otp', {
        email,
        adminId: username,
        password,
        storeName: storeName || undefined,
      });
      if (res.data?.success) {
        setOtpSent(true);
        startTimer();
        return true;
      }
      return false;
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || err?.message || '';
      if (status === 409) {
        setError(msg || 'This already exists.');
      } else if (status === 400) {
        setError(msg || 'Invalid request.');
      } else if (status === 500) {
        setError('Server error: ' + msg);
      } else {
        setError('Cannot connect to server. (' + msg + ')');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0 || loading) return;
    await sendOtpRequest();
  };

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return "Password must be at least 8 characters";
    if (!/[a-z]/.test(pw)) return "Password must contain a lowercase letter";
    if (!/[A-Z]/.test(pw)) return "Password must contain an uppercase letter";
    if (!/\d/.test(pw)) return "Password must contain a number";
    if (!/[!@#$%^&*()_\-+=<>?/{}~|]/.test(pw)) return "Password must contain a special character";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (mode === 'register') {
      const pwErr = validatePassword(password);
      if (pwErr) {
        setError(pwErr);
        setLoading(false);
        return;
      }
      if (!email.toLowerCase().endsWith('@gmail.com')) {
        setError('For security reasons, only Gmail accounts are accepted for registration.');
        setLoading(false);
        return;
      }
    }

    try {
      if (mode === 'login') {
        const res = await axios.post('/api/auth/login', {
          adminId: username || 'default-admin',
          password
        });
        if (res.data?.token) {
          localStorage.setItem('isAdmin', 'true');
          localStorage.setItem('adminId', res.data.adminId || username || 'default-admin');
          localStorage.setItem('authToken', res.data.token);
          onLogin();
        } else {
          setError('Invalid credentials. Please try again.');
        }
      } else {
        if (step === 'form') {
          const success = await sendOtpRequest();
          if (success) {
            setStep('otp');
          }
        }
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || err?.message || '';
      if (status === 401) {
        setError('Invalid credentials. Please try again.');
      } else if (status === 409) {
        setError(msg || 'This already exists.');
      } else if (status === 400) {
        setError(msg || 'Invalid request.');
      } else if (status === 500) {
        setError('Server error: ' + msg);
      } else {
        setError('Cannot connect to server. (' + msg + ')');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/verify-otp', { email, otp });
      if (res.data?.token) {
        localStorage.setItem('isAdmin', 'true');
        localStorage.setItem('adminId', res.data.adminId);
        localStorage.setItem('authToken', res.data.token);
        onLogin();
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || err?.message || '';
      if (status === 400) {
        setError(msg || 'Invalid OTP');
      } else if (status === 409) {
        setError(msg || 'Already registered');
      } else if (status === 500) {
        setError('Server error: ' + msg);
      } else {
        setError('Cannot connect to server. (' + msg + ')');
      }
    } finally {
      setLoading(false);
    }
  };

  const pwStrength = (pw: string): { score: number; label: string; color: string } => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[!@#$%^&*()_\-+=<>?/{}~|]/.test(pw)) s++;
    if (s <= 1) return { score: s, label: 'Weak', color: 'bg-red-500' };
    if (s <= 3) return { score: s, label: 'Medium', color: 'bg-amber-500' };
    return { score: s, label: 'Strong', color: 'bg-emerald-500' };
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute top-[-30%] left-[-20%] w-[80%] h-[80%] bg-emerald-500/10 rounded-full blur-[160px]" />
        <div className="absolute bottom-[-30%] right-[-20%] w-[80%] h-[80%] bg-indigo-500/10 rounded-full blur-[160px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-zinc-900/80 backdrop-blur-2xl border border-zinc-800/50 rounded-[2.5rem] p-8 lg:p-10 shadow-2xl shadow-black/50">
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4"
            >
              <Rocket className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-xl font-black text-white tracking-tight">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-zinc-500 text-xs mt-1 font-medium">
              {mode === 'login' ? 'Sign in to your dashboard' : 'Start your 7-day free trial'}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex bg-zinc-800/50 rounded-2xl p-1 mb-7 border border-zinc-700/30">
            <button
              onClick={() => { setMode('login'); setError(''); setStep('form'); }}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${mode === 'login' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <LogIn className="w-4 h-4 inline mr-2" />Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${mode === 'register' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Sparkles className="w-4 h-4 inline mr-2" />Register
            </button>
          </div>

          <AnimatePresence mode="wait">
            {step === 'otp' ? (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                    <Mail className="w-7 h-7 text-emerald-400" />
                  </div>
                  <p className="text-zinc-400 text-sm">
                    Code sent to <span className="text-white font-bold">{email}</span>
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Timer className="w-4 h-4 text-zinc-500" />
                    <span className={`text-sm font-bold ${timer > 0 ? 'text-zinc-400' : 'text-red-400'}`}>
                      {timer > 0 ? `${timer}s remaining` : 'Time expired'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[2px] ml-1">Enter OTP</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full bg-zinc-800/50 border-2 border-zinc-700/50 focus:border-emerald-500/40 rounded-xl px-4 py-4 text-white text-center text-3xl tracking-[12px] font-black outline-none transition-all placeholder:text-zinc-600"
                    autoFocus
                  />
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-red-400 text-sm font-bold bg-red-500/10 border border-red-500/20 py-3 px-4 rounded-xl"
                  >
                    <X className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </motion.p>
                )}

                <motion.button
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.length !== 6}
                  whileHover={otp.length === 6 ? { scale: 1.02 } : {}}
                  whileTap={otp.length === 6 ? { scale: 0.98 } : {}}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-black text-sm shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Verify & Create Account
                      <CheckCircle className="w-4 h-4" />
                    </>
                  )}
                </motion.button>

                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <button
                    onClick={handleResendOtp}
                    disabled={timer > 0 || loading}
                    className="text-sm font-bold text-zinc-500 hover:text-emerald-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {loading ? 'Sending...' : timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                  </button>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>

                <button
                  onClick={() => { setStep('form'); setOtp(''); setError(''); if (timerRef.current) clearInterval(timerRef.current); setTimer(0); }}
                  className="w-full text-center text-sm font-bold text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
              >
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[2px] ml-1">Store ID</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. zia-store"
                        className="w-full pl-11 pr-4 py-3.5 bg-zinc-800/50 border-2 border-zinc-700/50 focus:border-emerald-500/40 rounded-xl outline-none transition-all text-sm font-medium text-white placeholder:text-zinc-600"
                        required
                      />
                    </div>
                  </div>

                  {mode === 'register' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[2px] ml-1">Email</label>
                        <div className="relative group">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full pl-11 pr-4 py-3.5 bg-zinc-800/50 border-2 border-zinc-700/50 focus:border-emerald-500/40 rounded-xl outline-none transition-all text-sm font-medium text-white placeholder:text-zinc-600"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[2px] ml-1">Store Name</label>
                        <div className="relative group">
                          <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                          <input
                            type="text"
                            value={storeName}
                            onChange={(e) => setStoreName(e.target.value)}
                            placeholder="e.g. Zia Fashion Store"
                            className="w-full pl-11 pr-4 py-3.5 bg-zinc-800/50 border-2 border-zinc-700/50 focus:border-emerald-500/40 rounded-xl outline-none transition-all text-sm font-medium text-white placeholder:text-zinc-600"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[2px] ml-1">Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-11 pr-11 py-3.5 bg-zinc-800/50 border-2 border-zinc-700/50 focus:border-emerald-500/40 rounded-xl outline-none transition-all text-sm font-medium text-white placeholder:text-zinc-600"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {mode === 'register' && password.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={`flex-1 h-1 rounded-full transition-all ${i <= pwStrength(password).score ? pwStrength(password).color : 'bg-zinc-700'}`}
                            />
                          ))}
                        </div>
                        <p className={`text-[10px] font-bold tracking-wide ${pwStrength(password).color.replace('bg-', 'text-')}`}>
                          {pwStrength(password).label}
                        </p>
                      </div>
                    )}
                  </div>

                  {mode === 'register' && (
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-medium">
                      {[
                        { check: password.length >= 8, label: '8+ characters' },
                        { check: /[a-z]/.test(password), label: 'Lowercase' },
                        { check: /[A-Z]/.test(password), label: 'Uppercase' },
                        { check: /\d/.test(password), label: 'Number' },
                        { check: /[!@#$%^&*()_\-+=<>?/{}~|]/.test(password), label: 'Special char' },
                      ].map((r) => (
                        <div key={r.label} className={`flex items-center gap-1.5 ${r.check ? 'text-emerald-400' : 'text-zinc-600'}`}>
                          {r.check ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {r.label}
                        </div>
                      ))}
                    </div>
                  )}

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-red-400 text-sm font-bold bg-red-500/10 border border-red-500/20 py-3 px-4 rounded-xl"
                    >
                      <X className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </motion.p>
                  )}

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-black text-sm shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 group disabled:opacity-50 transition-all"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        {mode === 'login' ? 'Sign In' : 'Send OTP'}
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom text */}
        <p className="text-center text-xs text-zinc-600 mt-6 font-medium">
          {mode === 'login' ? "Don't have an account?" : 'Already registered?'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setStep('form'); }}
            className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
          >
            {mode === 'login' ? 'Register here' : 'Sign in'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
