import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, CreditCard, Wallet, Building2, CheckCircle, Loader2, ChevronDown, X, Sparkles, Shield, Key, Smartphone, Banknote, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PaymentConfig {
  jazzCash: { merchantId: string; merchantPassword: string; isActive: boolean };
  easyPaisa: { merchantId: string; merchantPassword: string; isActive: boolean };
  bankTransfer: { accountTitle: string; accountNumber: string; bankName: string; branchCode: string; isActive: boolean };
}

const paymentMethods = [
  {
    id: 'jazzcash',
    key: 'jazzCash' as const,
    label: 'JazzCash',
    sub: 'Mobile Wallet',
    icon: Wallet,
    gradient: 'from-purple-500 to-purple-700',
    glow: 'shadow-purple-500/30',
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    border: 'border-purple-200 dark:border-purple-500/30',
    inputs: [
      { field: 'merchantId', placeholder: 'Phone (03001234567)', type: 'text' },
      { field: 'merchantPassword', placeholder: 'Password', type: 'password' },
    ]
  },
  {
    id: 'easypaisa',
    key: 'easyPaisa' as const,
    label: 'EasyPaisa',
    sub: 'Mobile Wallet',
    icon: Smartphone,
    gradient: 'from-emerald-500 to-emerald-700',
    glow: 'shadow-emerald-500/30',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    inputs: [
      { field: 'merchantId', placeholder: 'Merchant ID', type: 'text' },
      { field: 'merchantPassword', placeholder: 'Secret', type: 'password' },
    ]
  },
  {
    id: 'banktransfer',
    key: 'bankTransfer' as const,
    label: 'Bank Transfer',
    sub: 'IBFT / Online',
    icon: Building2,
    gradient: 'from-blue-500 to-blue-700',
    glow: 'shadow-blue-500/30',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-blue-200 dark:border-blue-500/30',
    inputs: [
      { field: 'bankName', placeholder: 'Bank Name', type: 'text' },
      { field: 'accountNumber', placeholder: 'Account Number', type: 'text' },
      { field: 'accountTitle', placeholder: 'Account Title', type: 'text' },
    ]
  }
];

export default function PaymentSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<PaymentConfig>({
    jazzCash: { merchantId: '', merchantPassword: '', isActive: false },
    easyPaisa: { merchantId: '', merchantPassword: '', isActive: false },
    bankTransfer: { accountTitle: '', accountNumber: '', bankName: '', branchCode: '', isActive: false },
  });

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    try {
      const res = await axios.get('/api/payment/config');
      setConfig({
        jazzCash: { merchantId: res.data.jazzCash?.merchantId || '', merchantPassword: '', isActive: res.data.jazzCash?.isActive || false },
        easyPaisa: { merchantId: res.data.easyPaisa?.merchantId || '', merchantPassword: '', isActive: res.data.easyPaisa?.isActive || false },
        bankTransfer: res.data.bankTransfer || { accountTitle: '', accountNumber: '', bankName: '', branchCode: '', isActive: false },
      });
    } catch (err) { console.error('Failed to load:', err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setError(null);
    const errors: string[] = [];
    const hasActiveMethod = config.jazzCash.isActive || config.easyPaisa.isActive || config.bankTransfer.isActive;
    if (!hasActiveMethod) errors.push('Select at least one payment method');
    if (config.jazzCash.isActive && !confirmed.has('jazzCash')) errors.push('JazzCash: Click OK to confirm');
    if (config.easyPaisa.isActive && !confirmed.has('easyPaisa')) errors.push('EasyPaisa: Click OK to confirm');
    if (config.bankTransfer.isActive && !confirmed.has('bankTransfer')) errors.push('Bank: Click OK to confirm');
    if (errors.length > 0) { setError(errors.join('\n')); return; }
    setSaving(true);
    try { await axios.post('/api/payment/config', config); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (err) { console.error('Failed to save:', err); }
    finally { setSaving(false); }
  };

  const toggleExpand = (method: string) => {
    if (expanded === method) { setExpanded(null); return; }
    setExpanded(method);
    if (method === 'jazzcash' && !config.jazzCash.isActive) setConfig(p => ({ ...p, jazzCash: { ...p.jazzCash, isActive: true } }));
    if (method === 'easypaisa' && !config.easyPaisa.isActive) setConfig(p => ({ ...p, easyPaisa: { ...p.easyPaisa, isActive: true } }));
    if (method === 'banktransfer' && !config.bankTransfer.isActive) setConfig(p => ({ ...p, bankTransfer: { ...p.bankTransfer, isActive: true } }));
  };

  const handleConfirm = (method: string) => {
    if (method === 'jazzCash' && (!config.jazzCash.merchantId || config.jazzCash.merchantId.length < 10)) { setError('Enter valid phone (10+ digits)'); return; }
    if (method === 'easyPaisa' && (!config.easyPaisa.merchantId || !config.easyPaisa.merchantPassword)) { setError('Enter ID and Secret'); return; }
    if (method === 'bankTransfer' && (!config.bankTransfer.bankName || !config.bankTransfer.accountNumber)) { setError('Enter Bank Name and Account'); return; }
    setError(null);
    setConfirmed(p => new Set(p).add(method));
  };

  const updateField = (method: 'jazzCash' | 'easyPaisa' | 'bankTransfer', field: string, value: string) => {
    setConfig(p => ({ ...p, [method]: { ...p[method], [field]: value } }));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-xl shadow-purple-500/30"
        >
          <CreditCard className="w-8 h-8 text-white" />
        </motion.div>
        <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm animate-pulse">Loading Payment Config...</p>
      </motion.div>
    </div>
  );

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="text-center relative"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
          className="relative inline-flex mb-6"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/30 via-violet-500/30 to-indigo-500/30 rounded-[28px] blur-xl" />
          <div className="relative w-20 h-20 rounded-[28px] bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-purple-500/40 border border-purple-400/20">
            <CreditCard className="w-10 h-10 text-white" />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white dark:border-zinc-900"
            />
          </div>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400"
        >
          Payment Integration
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm font-medium"
        >
          Connect your payment methods to start accepting payments
        </motion.p>
      </motion.div>

      {/* Payment Methods Grid */}
      <div className="grid gap-6">
        {paymentMethods.map((method, idx) => {
          const isExpanded = expanded === method.id;
          const isConfirmed = confirmed.has(method.key);

          return (
            <motion.div
              key={method.id}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1 * idx, type: 'spring', stiffness: 200, damping: 25 }}
              layout
              className="group relative"
            >
              {/* Glow behind card */}
              <motion.div
                animate={{ opacity: isExpanded ? 1 : 0 }}
                className={`absolute -inset-2 bg-gradient-to-r ${method.gradient} rounded-[32px] blur-xl opacity-30 transition-opacity duration-500 pointer-events-none`}
              />

              <motion.div
                layout
                className={`relative bg-white dark:bg-zinc-900 border-2 rounded-[28px] overflow-hidden shadow-lg hover:shadow-xl transition-all duration-500 ${
                  isExpanded
                    ? `${method.border} shadow-2xl`
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {/* Top Gradient Line */}
                <motion.div
                  animate={{ scaleX: isExpanded ? 1 : 0 }}
                  className={`h-1 bg-gradient-to-r ${method.gradient} origin-left`}
                />

                {/* Header Row */}
                <motion.div
                  layout
                  onClick={() => toggleExpand(method.id)}
                  className="p-6 flex items-center justify-between cursor-pointer select-none"
                  whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                >
                  <div className="flex items-center gap-4">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: -5 }}
                      whileTap={{ scale: 0.95 }}
                      className={`relative w-14 h-14 rounded-2xl ${method.bg} ${method.border} border flex items-center justify-center`}
                    >
                      <method.icon className={`w-7 h-7 ${method.id === 'jazzcash' ? 'text-purple-600 dark:text-purple-400' : method.id === 'easypaisa' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`} />
                      {isConfirmed && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center"
                        >
                          <CheckCircle className="w-3 h-3 text-white" />
                        </motion.div>
                      )}
                    </motion.div>
                    <div>
                      <h3 className="text-xl font-black text-zinc-900 dark:text-white">{method.label}</h3>
                      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                        {method.sub}
                        {isConfirmed && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            className="text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1"
                          >
                            <span className="mx-1">•</span> Connected
                          </motion.span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{
                        backgroundColor: isConfirmed ? 'rgb(16 185 129)' : 'rgb(113 113 122)',
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white`}
                    >
                      {isConfirmed ? 'Active' : 'Inactive'}
                    </motion.div>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.div>
                  </div>
                </motion.div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

                        {method.inputs.map((input, i) => (
                          <motion.div
                            key={input.field}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="relative"
                          >
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                              {input.type === 'password' ? <Key className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                            </div>
                            <input
                              type={input.type}
                              value={(config[method.key] as any)[input.field] || ''}
                              onChange={e => updateField(method.key, input.field, e.target.value)}
                              placeholder={input.placeholder}
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:ring-4 focus:border-transparent outline-none transition-all"
                              style={{ '--tw-ring-color': method.gradient } as React.CSSProperties}
                              onFocus={e => {
                                e.target.style.borderColor = 'transparent';
                              }}
                            />
                          </motion.div>
                        ))}

                        <motion.button
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          onClick={() => handleConfirm(method.key)}
                          disabled={isConfirmed}
                          whileHover={!isConfirmed ? { scale: 1.02 } : {}}
                          whileTap={!isConfirmed ? { scale: 0.98 } : {}}
                          className={`relative w-full py-3.5 rounded-2xl font-black text-sm overflow-hidden group/btn transition-all duration-300 ${
                            isConfirmed
                              ? 'bg-emerald-500 text-white cursor-default shadow-lg shadow-emerald-500/30'
                              : `bg-gradient-to-r ${method.gradient} text-white shadow-lg hover:shadow-xl active:shadow-md`
                          }`}
                        >
                          <motion.div
                            initial={false}
                            animate={isConfirmed ? { scale: [1, 1.5, 1] } : {}}
                            transition={{ duration: 0.5 }}
                            className="flex items-center justify-center gap-2"
                          >
                            {isConfirmed ? (
                              <>
                                <CheckCircle className="w-5 h-5" />
                                Confirmed
                              </>
                            ) : (
                              <>
                                <Shield className="w-5 h-5" />
                                Confirm & Activate
                                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                              </>
                            )}
                          </motion.div>
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bottom shimmer on hover */}
                <motion.div
                  initial={false}
                  whileHover={{ opacity: 1 }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 pointer-events-none"
                />
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/30 rounded-2xl p-5 shadow-lg"
          >
            <div className="flex items-start gap-3">
              <X className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-red-600 dark:text-red-400 text-sm font-bold whitespace-pre-line">{error}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="relative"
      >
        {/* Glow */}
        <div className="absolute -inset-3 bg-gradient-to-r from-purple-500/20 via-violet-500/20 to-indigo-500/20 rounded-[40px] blur-xl opacity-50" />

        <motion.button
          onClick={handleSave}
          disabled={saving}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className={`relative w-full py-5 rounded-[28px] font-black text-lg flex items-center justify-center gap-3 transition-all duration-300 shadow-2xl overflow-hidden ${
            saved
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/40'
              : 'bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 shadow-purple-500/40 hover:shadow-purple-500/60'
          }`}
        >
          {/* Shimmer */}
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut', repeatDelay: 1 }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-[-20deg]"
          />

          {saving ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <Loader2 className="w-6 h-6" />
            </motion.div>
          ) : saved ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <CheckCircle className="w-6 h-6" />
            </motion.div>
          ) : (
            <Save className="w-6 h-6" />
          )}

          <span className="relative z-10">
            {saving ? 'Saving Configuration...' : saved ? 'Saved Successfully!' : 'Save Configuration'}
          </span>
        </motion.button>
      </motion.div>
    </div>
  );
}
