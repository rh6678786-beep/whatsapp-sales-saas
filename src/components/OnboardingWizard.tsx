import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store, User, Lock, Sparkles, ArrowRight, Check, Zap, Crown, Building2, CreditCard, Smartphone, Share2, MessageSquare, CheckCircle, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import axios from 'axios';

interface OnboardingWizardProps {
  onComplete: () => void;
}

const PLANS = [
  { id: 'free', name: 'Free', price: 0, icon: Sparkles, color: 'from-zinc-500 to-zinc-400', features: ['30 sessions/mo', '5 products', 'Basic AI', 'WhatsApp'] },
  { id: 'basic', name: 'Basic', price: 1500, icon: Zap, color: 'from-blue-600 to-blue-500', features: ['300 sessions/mo', '20 products', 'Advanced AI', 'WhatsApp + Instagram'] },
  { id: 'professional', name: 'Professional', price: 3500, icon: Crown, color: 'from-emerald-600 to-emerald-500', features: ['1,500 sessions/mo', '100 products', 'All channels', 'Negotiation AI'], popular: true },
];

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    adminId: '',
    password: '',
    storeName: '',
    email: '',
    phone: '',
    address: '',
  });
  const [selectedPlan, setSelectedPlan] = useState('free');

  const steps = [
    { label: 'Store Setup', icon: Store },
    { label: 'Choose Plan', icon: CreditCard },
    { label: 'All Set!', icon: CheckCircle },
  ];

  const updateForm = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleRegister = async () => {
    setLoading(true);
    setError('');
    try {
      const existingAdminId = localStorage.getItem('adminId');
      const isNewUser = !existingAdminId || existingAdminId === 'default-admin';
      if (isNewUser) {
        const res = await axios.post('/api/auth/register', {
          adminId: form.adminId,
          password: form.password,
          storeName: form.storeName || undefined,
        });
        if (res.data?.token) {
          localStorage.setItem('isAdmin', 'true');
          localStorage.setItem('adminId', res.data.adminId);
          localStorage.setItem('authToken', res.data.token);
        }
      } else {
        form.adminId = existingAdminId;
      }
      await axios.put('/api/settings/profile', {
        storeName: form.storeName,
        email: form.email,
        phone: form.phone,
        address: form.address,
      });
      if (selectedPlan !== 'free') {
        await axios.post('/api/billing/create-checkout', { planId: selectedPlan });
      }
      await axios.post('/api/settings', { onboardingComplete: true });
      onComplete();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setError('Store ID already exists. Try a different one.');
      } else {
        setError(err.response?.data?.error || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl relative z-10"
      >
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-zinc-900 dark:bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <ShieldCheck className="w-8 h-8 text-white dark:text-zinc-900" />
            </div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Set Up Your Store</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm font-medium">Get started in 2 minutes</p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {steps.map((s, i) => (
              <React.Fragment key={i}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${i <= step ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                    {i < step ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-xs font-bold ${i <= step ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-12 h-0.5 rounded-full ${i < step ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl px-5 py-3 text-red-600 dark:text-red-400 text-sm font-bold text-center">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* STEP 1: Store Setup */}
            {step === 0 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Store ID</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input type="text" value={form.adminId} onChange={e => updateForm('adminId', e.target.value.replace(/[^a-z0-9-]/g, ''))} placeholder="my-store" className="w-full pl-10 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-white rounded-2xl outline-none text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 transition-all" required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input type="password" value={form.password} onChange={e => updateForm('password', e.target.value)} placeholder="Min 4 chars" className="w-full pl-10 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-white rounded-2xl outline-none text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 transition-all" required />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Store Name</label>
                  <div className="relative">
                    <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input type="text" value={form.storeName} onChange={e => updateForm('storeName', e.target.value)} placeholder="My Fashion Store" className="w-full pl-10 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-white rounded-2xl outline-none text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Email</label>
                    <input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} placeholder="store@example.com" className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-white rounded-2xl outline-none text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Phone</label>
                    <input type="tel" value={form.phone} onChange={e => updateForm('phone', e.target.value)} placeholder="+92 300 1234567" className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-white rounded-2xl outline-none text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 transition-all" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Address</label>
                  <input type="text" value={form.address} onChange={e => updateForm('address', e.target.value)} placeholder="Store address" className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-white rounded-2xl outline-none text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 transition-all" />
                </div>

                <div className="flex gap-3 pt-4">
                  <div className="flex-1" />
                  <button onClick={() => {
                    const isNewUser = !localStorage.getItem('adminId') || localStorage.getItem('adminId') === 'default-admin';
                    if (isNewUser && (!form.adminId || !form.password)) {
                      setError('Store ID and password required for new accounts');
                      return;
                    }
                    setError('');
                    setStep(1);
                  }} className="px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl flex items-center gap-2">
                    Next Step
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: Plan Selection */}
            {step === 1 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-6">
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center font-medium">Choose a plan to start. You can upgrade or downgrade anytime.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {PLANS.map((p) => {
                    const Icon = p.icon;
                    const isSelected = selectedPlan === p.id;
                    return (
                      <button key={p.id} onClick={() => setSelectedPlan(p.id)}
                        className={`relative text-left bg-white dark:bg-zinc-800/50 border-2 rounded-2xl p-5 transition-all hover:shadow-lg ${isSelected ? 'border-zinc-900 dark:border-white ring-2 ring-zinc-900/20 dark:ring-white/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'}`}>
                        {p.popular && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[9px] font-black px-3 py-1 rounded-full">POPULAR</div>}
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center mb-3`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <h4 className="font-black text-zinc-900 dark:text-white">{p.name}</h4>
                        <div className="flex items-baseline gap-0.5 mt-1 mb-3">
                          {p.price === 0 ? (
                            <span className="text-2xl font-black text-zinc-900 dark:text-white">Free</span>
                          ) : (
                            <span className="text-2xl font-black text-zinc-900 dark:text-white">Rs.{p.price.toLocaleString()}</span>
                          )}
                          <span className="text-xs font-bold text-zinc-400">/mo</span>
                        </div>
                        <div className="space-y-1.5">
                          {p.features.map((f, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{f}</span>
                            </div>
                          ))}
                        </div>
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-6 h-6 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-white dark:text-zinc-900" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setStep(0)} className="px-6 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={() => setStep(2)} className="flex-1 px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-2">
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Welcome */}
            {step === 2 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-6 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.2 }} className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30">
                  <CheckCircle className="w-10 h-10 text-white" />
                </motion.div>

                <div>
                  <h2 className="text-3xl font-black text-zinc-900 dark:text-white">You're All Set!</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">Your store is ready to start selling with AI</p>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-6 text-left space-y-4 border border-zinc-100 dark:border-zinc-700/50">
                  {[
                    { icon: Smartphone, title: 'Connect WhatsApp', desc: 'Link your WhatsApp number to start chatting with customers' },
                    { icon: Store, title: 'Add Products', desc: 'Upload your product catalog so the AI can start selling' },
                    { icon: Share2, title: 'Setup Channels', desc: 'Connect Instagram, Facebook, and Telegram for multi-channel sales' },
                    { icon: MessageSquare, title: 'Test Your Bot', desc: 'Use the Simulator to test your AI agent before going live' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-zinc-900/5 dark:bg-white/5 flex items-center justify-center shrink-0">
                        <item.icon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{item.title}</h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleRegister}
                  disabled={loading}
                  className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {selectedPlan === 'free' ? 'Start Free' : `Start Rs.${PLANS.find(p => p.id === selectedPlan)?.price?.toLocaleString()}/mo Plan`}
                      <Sparkles className="w-5 h-5" />
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
