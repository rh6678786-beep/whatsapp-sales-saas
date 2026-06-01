import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Globe, Check, TrendingUp, DollarSign, Users, Smartphone, Briefcase, Package, ShoppingBag, MessageSquare, Bell, ChevronRight, ArrowRight, ChevronLeft, X, Shield, Lock, Mail, User, Phone, Timer, CheckCircle, ArrowLeft, Star, Zap, Rocket } from 'lucide-react';
import axios from 'axios';

interface SignupProps {
  onSignup: () => void;
  onSignIn: () => void;
}

const countries = [
  { code: '+92', label: 'PK', flag: '🇵🇰', digits: 10, example: '300 1234567' },
  { code: '+1', label: 'US', flag: '🇺🇸', digits: 10, example: '(555) 123-4567' },
  { code: '+44', label: 'UK', flag: '🇬🇧', digits: 10, example: '7400 123456' },
  { code: '+971', label: 'AE', flag: '🇦🇪', digits: 9, example: '50 123 4567' },
  { code: '+966', label: 'SA', flag: '🇸🇦', digits: 9, example: '55 123 4567' },
  { code: '+91', label: 'IN', flag: '🇮🇳', digits: 10, example: '98765 43210' },
  { code: '+880', label: 'BD', flag: '🇧🇩', digits: 10, example: '1712 345678' },
  { code: '+62', label: 'ID', flag: '🇮🇩', digits: 10, example: '812 3456 7890' },
  { code: '+60', label: 'MY', flag: '🇲🇾', digits: 9, example: '12 345 6789' },
  { code: '+65', label: 'SG', flag: '🇸🇬', digits: 8, example: '8123 4567' },
];

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

const pwChecks = (pw: string) => [
  { check: pw.length >= 8, label: '8+ characters' },
  { check: /[a-z]/.test(pw), label: 'Lowercase' },
  { check: /[A-Z]/.test(pw), label: 'Uppercase' },
  { check: /\d/.test(pw), label: 'Number' },
  { check: /[!@#$%^&*()_\-+=<>?/{}~|]/.test(pw), label: 'Special char' },
];

const plans = [
  { id: 'free', name: 'Free Trial', price: 0, desc: '30 conversations, 5 products, AI agent', icon: Rocket, popular: true },
  { id: 'basic', name: 'Basic', price: 1500, desc: '300 conversations, 20 products, Instagram', icon: Zap },
  { id: 'pro', name: 'Professional', price: 3000, desc: 'Unlimited conversations, all channels', icon: Star },
  { id: 'enterprise', name: 'Enterprise', price: 7000, desc: 'Full customization, white label', icon: Briefcase },
];

function InfoPage({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-900 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 dark:border-zinc-700">
        <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 dark:text-zinc-100">{title}</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
        >
          <X className="w-5 h-5 text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 dark:text-zinc-500" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 lg:p-10 max-w-3xl mx-auto">
        <p className="text-sm text-zinc-600 dark:text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 leading-relaxed whitespace-pre-line">{content}</p>
      </div>
    </div>
  );
}

export default function Signup({ onSignup, onSignIn }: SignupProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+92');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [infoPage, setInfoPage] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('free');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const validateStep1 = () => {
    if (!name.trim()) { setError('Please enter your full name'); return false; }
    if (!email.trim()) { setError('Please enter your email address'); return false; }
    if (!email.toLowerCase().endsWith('@gmail.com')) { setError('For security reasons, only Gmail accounts are accepted.'); return false; }
    if (!phone.trim()) { setError('Please enter your phone number'); return false; }
    const country = countries.find(c => c.code === countryCode);
    if (country && phone.length !== country.digits) {
      setError(`Please enter a valid ${country.digits}-digit ${country.label} number`);
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (password.length < 8) { setError('Password must be at least 8 characters'); return false; }
    if (!/[a-z]/.test(password)) { setError('Password must contain a lowercase letter'); return false; }
    if (!/[A-Z]/.test(password)) { setError('Password must contain an uppercase letter'); return false; }
    if (!/\d/.test(password)) { setError('Password must contain a number'); return false; }
    if (!/[!@#$%^&*()_\-+=<>?/{}~|]/.test(password)) { setError('Password must contain a special character'); return false; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return false; }
    return true;
  };

  const handleNext = async () => {
    setError('');
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setLoading(true);
      try {
        await axios.post('/api/auth/send-otp', {
          email,
          adminId: name.toLowerCase().replace(/\s+/g, '-'),
          password,
          storeName: name + "'s Store",
          phone: countryCode + phone,
        });
        setOtpSent(true);
        startTimer();
        setStep(3);
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || 'Failed to send OTP');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    setError('');
    if (step === 3) {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimer(0);
    }
    setStep(step - 1);
  };

  const handleResendOtp = async () => {
    if (timer > 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      await axios.post('/api/auth/send-otp', {
        email,
        adminId: name.toLowerCase().replace(/\s+/g, '-'),
        password,
        storeName: name + "'s Store",
        phone: countryCode + phone,
      });
      startTimer();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/verify-otp', { email, otp });
      if (res.data?.token) {
        localStorage.setItem('isAdmin', 'true');
        localStorage.setItem('adminId', res.data.adminId);
        localStorage.setItem('authToken', res.data.token);
        setStep(4);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || err?.message || '';
      if (status === 400) {
        setError(msg || 'Invalid OTP');
      } else if (status === 409) {
        setError(msg || 'Already registered');
      } else {
        setError('Cannot connect to server. (' + msg + ')');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    setLoading(true);
    setError('');
    try {
      await axios.post('/api/settings/plan', { plan: planId });
      onSignup();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || '';
      if (msg) setError(msg);
      onSignup();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans bg-white dark:bg-zinc-900">
      {infoPage && (
        <InfoPage
          title={infoPage === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
          content={infoPage === 'terms'
            ? 'TERMS OF SERVICE\n\n1. Acceptance of Terms\nBy creating an account and using our AI-powered SaaS platform, you agree to be bound by these Terms of Service.\n\n2. Description of Service\nWe provide an AI-driven sales automation platform integrated with WhatsApp for ecommerce businesses.\n\n3. User Responsibilities\nYou are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.\n\n4. Prohibited Uses\nYou agree not to use the service for any unlawful purpose or in violation of any applicable laws or regulations.\n\n5. Intellectual Property\nAll content, features, and functionality of our platform are owned by us and protected by intellectual property laws.\n\n6. Limitation of Liability\nWe shall not be liable for any indirect, incidental, special, consequential, or punitive damages.\n\n7. Termination\nWe reserve the right to terminate or suspend your account at any time for violation of these terms.\n\n8. Changes to Terms\nWe may modify these terms at any time. Continued use of the service constitutes acceptance of the modified terms.'
            : 'PRIVACY POLICY\n\n1. Information We Collect\nWe collect personal information including your name, email address, phone number, and business details when you create an account.\n\n2. How We Use Your Information\nWe use your information to provide, maintain, and improve our services, process transactions, and communicate with you.\n\n3. Data Protection\nWe implement industry-standard security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction.\n\n4. Data Sharing\nWe do not sell, trade, or rent your personal information to third parties.\n\n5. Cookies\nWe use cookies and similar tracking technologies to enhance your experience and analyze usage patterns.\n\n6. Your Rights\nYou have the right to access, update, or delete your personal information at any time.\n\n7. Contact Us\nIf you have any questions about this Privacy Policy, please contact our support team.'}
          onClose={() => setInfoPage(null)}
        />
      )}

      {/* Left – Dashboard Preview */}
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
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">WhatsApp</p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 dark:text-zinc-500">Connected</p>
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
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 dark:text-zinc-500">3 new alerts</p>
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
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 dark:text-zinc-500">4 members</p>
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
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 dark:text-zinc-500">142 items</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.8, ease: 'easeOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[82%] max-w-[680px] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-emerald-500/10 border border-white/40 dark:border-zinc-700/40 overflow-hidden z-10"
        >
          <div className="px-7 pt-7 pb-4 border-b border-emerald-100/50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 tracking-tight">Dashboard Overview</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">Your store at a glance</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Live</span>
              </div>
            </div>
          </div>

          <div className="p-7 space-y-6">
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

      {/* Right – Signup Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 lg:p-12 relative">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md relative z-10"
        >
          {/* Progress indicator */}
          <div className="flex items-center gap-3 mb-10">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${s <= step ? 'bg-emerald-500 shadow-sm shadow-emerald-500/40' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                />
              ))}
            </div>
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              {step === 1 ? 'Account Info' : step === 2 ? 'Password' : step === 3 ? 'OTP Verification' : 'Choose Plan'} — Step {step} of 4
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Create Your Account</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-medium mt-2 mb-8">Join thousands of ecommerce businesses</p>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 uppercase tracking-[2px] ml-1">Full Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ahmed Khan"
                      className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 rounded-2xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 uppercase tracking-[2px] ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ahmed@example.com"
                      className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 rounded-2xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 uppercase tracking-[2px] ml-1">Phone Number</label>
                  <div className="flex gap-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setCountryOpen(!countryOpen)}
                      className="h-full px-3.5 py-3.5 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 rounded-2xl outline-none transition-all text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2 shadow-sm min-w-[90px]"
                    >
                      <span className="text-base">{countries.find(c => c.code === countryCode)?.flag}</span>
                      <span>{countryCode}</span>
                      </button>
                      {countryOpen && (
                        <div className="absolute top-full left-0 mt-1 w-44 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl z-30 py-2 max-h-48 overflow-y-auto">
                          {countries.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => { setCountryCode(c.code); setCountryOpen(false); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-emerald-50 transition-colors"
                            >
                              <span className="text-base">{c.flag}</span>
                              <span>{c.code}</span>
                              <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-bold uppercase">{c.label}</span>
                              {c.code === countryCode && <Check className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder={countries.find(c => c.code === countryCode)?.example || '300 1234567'}
                      className="flex-1 px-4 py-3.5 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 rounded-2xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium ml-1">Do not include the leading 0</p>
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
                  type="button"
                  onClick={handleNext}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 group transition-all"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 uppercase tracking-[2px] ml-1">Password</label>
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
                  {password.length > 0 && (
                    <div className="mt-3 space-y-3">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`flex-1 h-1.5 rounded-full transition-all ${i <= pwStrength(password).score ? pwStrength(password).color : 'bg-zinc-200 dark:bg-zinc-700'}`}
                          />
                        ))}
                      </div>
                      <p className={`text-[10px] font-bold tracking-wide ${pwStrength(password).color.replace('bg-', 'text-')}`}>
                        {pwStrength(password).label}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-medium">
                        {pwChecks(password).map((r) => (
                          <div key={r.label} className={`flex items-center gap-1.5 ${r.check ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                            {r.check ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {r.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 uppercase tracking-[2px] ml-1">Re-enter Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-11 pr-12 py-3.5 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 rounded-2xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw(!showConfirmPw)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                    >
                      {showConfirmPw ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <p className={`text-[10px] font-bold mt-1 ${password === confirmPassword ? 'text-emerald-500' : 'text-red-500'}`}>
                      {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                    </p>
                  )}
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

                <div className="flex gap-3">
                  <motion.button
                    type="button"
                    onClick={handleBack}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 py-4 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-2xl font-bold text-sm hover:border-zinc-300 dark:hover:border-zinc-600 transition-all flex items-center justify-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handleNext}
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 group transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Send OTP
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-200/50">
                    <Mail className="w-7 h-7 text-emerald-600" />
                  </div>
                  <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 text-sm font-medium">
                    Code sent to{' '}
                    <span className="text-zinc-900 dark:text-zinc-100 font-bold">{email}</span>
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Timer className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                    <span className={`text-sm font-bold ${timer > 0 ? 'text-zinc-500 dark:text-zinc-400 dark:text-zinc-500' : 'text-red-500'}`}>
                      {timer > 0 ? `${timer}s remaining` : 'Time expired'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 uppercase tracking-[2px] ml-1">Enter OTP</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 rounded-2xl px-4 py-4 text-zinc-900 dark:text-zinc-100 text-center text-3xl tracking-[12px] font-black outline-none transition-all placeholder:text-zinc-300 shadow-sm"
                    autoFocus
                  />
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <div
                    onClick={() => setTerms(!terms)}
                    className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-200 ${terms ? 'bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-500/30' : 'border-zinc-300 hover:border-zinc-400'}`}
                  >
                    {terms && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-medium leading-relaxed">
                    I agree to the{' '}
                    <button type="button" onClick={() => setInfoPage('terms')} className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors">Terms of Service</button>
                    {' '}and{' '}
                    <button type="button" onClick={() => setInfoPage('privacy')} className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors">Privacy Policy</button>
                  </span>
                </label>

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
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.length !== 6 || !terms}
                  whileHover={otp.length === 6 && terms ? { scale: 1.02 } : {}}
                  whileTap={otp.length === 6 && terms ? { scale: 0.98 } : {}}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                  <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                  <button
                    onClick={handleResendOtp}
                    disabled={timer > 0 || loading}
                    className="text-sm font-bold text-zinc-400 dark:text-zinc-500 hover:text-emerald-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {loading ? 'Sending...' : timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                  </button>
                  <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                </div>

                <button
                  onClick={handleBack}
                  className="w-full text-center text-sm font-bold text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>

              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="text-center mb-2">
                  <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-200/50">
                    <Rocket className="w-7 h-7 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Choose Your Plan</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-medium mt-1">Start your 7-day free trial, no credit card needed</p>
                </div>

                <div className="space-y-3">
                  {plans.map((plan) => {
                    const isSelected = selectedPlan === plan.id;
                    return (
                      <motion.button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlan(plan.id)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-sm shadow-emerald-500/10'
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600'
                        }`}
                      >
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                          <plan.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{plan.name}</span>
                            {plan.popular && (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Popular</span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-medium">{plan.desc}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {plan.price === 0 ? (
                            <p className="font-black text-emerald-600 text-sm">Free</p>
                          ) : (
                            <>
                              <p className="font-black text-zinc-900 dark:text-zinc-100">Rs.{plan.price.toLocaleString()}</p>
                              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">/mo</p>
                            </>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
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
                  type="button"
                  onClick={() => handleSelectPlan(selectedPlan)}
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 group transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {selectedPlan === 'free' ? 'Start 7-Day Free Trial' : 'Continue with ' + plans.find(p => p.id === selectedPlan)?.name}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </motion.button>

                <div className="flex items-center gap-2 justify-center text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  No credit card required. Cancel anytime.
                </div>
              </motion.div>
            )}

            {step < 4 && (
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-medium pt-4">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={onSignIn}
                  className="text-emerald-600 hover:text-emerald-700 font-bold transition-colors"
                >
                  Sign in
                </button>
              </p>
            )}
          </form>
        </motion.div>
      </div>
    </div>
  );
}
