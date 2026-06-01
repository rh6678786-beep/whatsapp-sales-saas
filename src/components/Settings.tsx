import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Key, Smartphone, Zap, Save, CheckCircle, Shield, Lock, Eye, EyeOff, User, Sparkles, Banknote, RefreshCw, Loader2, X, ArrowRight, Store, Upload, ChevronDown, Mail, Send, Clock, Globe, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import TwoFactorSetup from './TwoFactorSetup';

const LANGUAGES = [
  { code: 'ur', name: 'Urdu (Roman) — اردو' },
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'العربية — Arabic' },
  { code: 'hi', name: 'हिन्दी — Hindi' },
  { code: 'bn', name: 'বাংলা — Bengali' },
  { code: 'es', name: 'Español — Spanish' },
  { code: 'fr', name: 'Français — French' },
  { code: 'zh', name: '中文 — Chinese' },
];

export default function Settings() {
  const [settings, setSettings] = useState({
    storeName: 'SalesForce AI',
    geminiApiKey: '',
    geminiModel: 'gemini-flash-latest',
    jazzCashNumber: '0300-1234567',
    advanceAmount: 300,
    businessLogo: '',
    phone: '',
    address: '',
    language: 'ur',
    memoryConfig: { enabled: true, summarizationThreshold: 20, embeddingEnabled: true },
    proactiveConfig: {
      enabled: false,
      maxPerDay: 5,
      maxPerRun: 50,
      quietStartHour: 21,
      quietEndHour: 9,
      abandonedCart: { enabled: true, hours: 24 },
      reEngagement: { enabled: true, inactiveDays: 7 },
      priceDrop: { enabled: true },
      birthday: { enabled: true },
    },
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Show/hide API key
  const [showApiKey, setShowApiKey] = useState(false);

  // Success checkmark for JazzCash
  const [jazzSaved, setJazzSaved] = useState(false);

  // Email report settings
  const [emailSettings, setEmailSettings] = useState({
    notificationEmail: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    emailReportsEnabled: true,
    isSuperAdmin: false,
  });
  const [loadingEmailSettings, setLoadingEmailSettings] = useState(false);
  const [emailSettingsSaved, setEmailSettingsSaved] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [dbInfo, setDbInfo] = useState<{ database: string; connected: boolean }>({ database: 'Checking...', connected: false });

  useEffect(() => {
    fetchSettings();
    fetchEmailSettings();
    fetchDbInfo();
  }, []);

  const fetchDbInfo = async () => {
    try {
      const res = await axios.get('/api/health');
      setDbInfo({ database: res.data.database, connected: res.data.connected });
    } catch {
      setDbInfo({ database: 'Not connected', connected: false });
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get('/api/settings');
      setSettings(prev => ({ ...prev, ...res.data, language: res.data.language || 'ur' }));
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchEmailSettings = async () => {
    try {
      const res = await axios.get('/api/email-report/settings');
      setEmailSettings(prev => ({ ...prev, ...res.data }));
    } catch (err) {
      console.error('Failed to fetch email settings:', err);
    }
  };

  const handleSaveEmailSettings = async () => {
    setLoadingEmailSettings(true);
    try {
      await axios.post('/api/email-report/settings', emailSettings);
      setEmailSettingsSaved(true);
      setTestResult(null);
      setTimeout(() => setEmailSettingsSaved(false), 2000);
    } catch (err) {
      alert('Failed to save email settings');
    } finally {
      setLoadingEmailSettings(false);
    }
  };

  const handleTestEmail = async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await axios.post('/api/email-report/test');
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTestSending(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post('/api/settings', {
        geminiApiKey: settings.geminiApiKey,
        geminiModel: settings.geminiModel,
        storeName: settings.storeName,
        advanceAmount: settings.advanceAmount,
        businessLogo: settings.businessLogo,
        phone: settings.phone,
        address: settings.address,
        language: settings.language,
        memoryConfig: settings.memoryConfig,
        proactiveConfig: settings.proactiveConfig,
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        window.location.reload();
      }, 1500);
    } catch (err) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveJazzCash = async () => {
    try {
      await axios.post('/api/settings', {
        jazzCashNumber: settings.jazzCashNumber
      });
      setJazzSaved(true);
      setTimeout(() => {
        setJazzSaved(false);
        window.location.reload();
      }, 1500);
    } catch (err) {
      alert('Failed to save JazzCash number');
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required');
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError('New password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      const verifyRes = await axios.post('/api/settings/verify-password', { password: oldPassword });
      if (!verifyRes.data.success) {
        setPasswordError('Old password is incorrect');
        setChangingPassword(false);
        return;
      }
      await axios.post('/api/settings', { adminPassword: newPassword });
      setPasswordChanged(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordChanged(false);
        window.location.reload();
      }, 1500);
    } catch (err) {
      setPasswordError('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
      >
        <div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4 mb-3"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-500/30 to-zinc-700/30 rounded-[20px] blur-lg" />
              <div className="relative w-16 h-16 rounded-[20px] bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-white dark:to-zinc-300 flex items-center justify-center shadow-2xl">
                <SettingsIcon className="w-8 h-8 text-white dark:text-zinc-900" />
              </div>
            </motion.div>
            <div>
              <h2 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 tracking-tight">
                Settings
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2 mt-1">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                Configure your AI agent, security, and payment preferences
              </p>
            </div>
          </motion.div>
        </div>

        <motion.button
          onClick={handleSave}
          disabled={saving}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          className={`relative px-8 py-4 rounded-2xl font-black text-sm transition-all overflow-hidden shadow-xl ${saved
            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/40'
            : 'bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-white dark:to-zinc-200 text-white dark:text-zinc-900 shadow-zinc-900/30 dark:shadow-white/20'
            }`}
        >
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut', repeatDelay: 1 }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg]"
          />
          <div className="relative z-10 flex items-center gap-2.5">
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <CheckCircle className="w-4 h-4" />
              </motion.div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </div>
        </motion.button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* === GENERAL === */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-lg hover:shadow-xl transition-all duration-500 group"
        >
          <div className="flex items-center gap-4 mb-8">
            <motion.div
              whileHover={{ scale: 1.1, rotate: -5 }}
              className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center"
            >
              <User className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </motion.div>
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white">Store Info</h3>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">General business details</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-amber-500" />
                Store Name
              </label>
              <input
                type="text"
                value={settings.storeName}
                onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                placeholder="Your store name"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-amber-500" />
                Business Logo
              </label>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 shrink-0">
                  {settings.businessLogo ? (
                    <img src={settings.businessLogo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-2xl cursor-pointer text-xs font-bold text-zinc-600 dark:text-zinc-400 transition-all">
                    <Upload className="w-4 h-4" />
                    Upload Logo
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = () => setSettings({ ...settings, businessLogo: reader.result as string });
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                  {settings.businessLogo && (
                    <button onClick={() => setSettings({ ...settings, businessLogo: '' })} className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors">Remove Logo</button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-amber-500" />
                Phone
              </label>
              <input
                type="tel"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                placeholder="+92 300 1234567"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-amber-500" />
                Address
              </label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="Store address"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
              />
            </div>

            {/* System info card */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="relative overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-800 dark:to-zinc-950 rounded-2xl p-6 mt-6"
            >
              <div className="relative z-10 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md shrink-0">
                  <RefreshCw className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm mb-1">Account Info</h4>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Store ID: <span className="text-emerald-400 font-bold">{localStorage.getItem('adminId') || '—'}</span>
                  </p>
                  <p className="text-zinc-400 text-xs leading-relaxed mt-1">
                    Database: <span className={`font-bold ${dbInfo.connected ? 'text-emerald-400' : 'text-red-400'}`}>{dbInfo.database}</span>
                  </p>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
            </motion.div>
          </div>
        </motion.div>

        {/* === AI SETTINGS === */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-lg hover:shadow-xl transition-all duration-500 group"
        >
          <div className="flex items-center gap-4 mb-8">
            <motion.div
              whileHover={{ scale: 1.1, rotate: -5 }}
              className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center"
            >
              <Zap className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </motion.div>
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white">AI Engine</h3>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Gemini AI configuration</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-violet-500" />
                Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={settings.geminiApiKey}
                  onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                  placeholder="Enter your Gemini API Key"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 rounded-2xl px-5 py-4 pr-12 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                >
                  {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-violet-500" />
                AI Model
              </label>
              <div className="relative">
                <select
                  value={settings.geminiModel}
                  onChange={(e) => setSettings({ ...settings, geminiModel: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-900 dark:text-white outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="gemini-flash-latest">Gemini 1.5 Flash (Most Stable)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Latest)</option>
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-violet-500" />
                AI Language
              </label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-500" />
                <select
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-zinc-900 dark:text-white outline-none transition-all appearance-none cursor-pointer"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 mt-1.5 ml-1">
                <span className="w-1 h-1 rounded-full bg-violet-500" />
                AI agent will respond to customers in the selected language
              </p>
            </div>
          </div>
        </motion.div>

        {/* === MEMORY CONFIGURATION === */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-lg hover:shadow-xl transition-all duration-500 group"
        >
          <div className="flex items-center gap-4 mb-8">
            <motion.div
              whileHover={{ scale: 1.1, rotate: -5 }}
              className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center"
            >
              <Brain className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </motion.div>
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white">AI Memory</h3>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Long-term context & learning</p>
            </div>
          </div>
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.memoryConfig?.enabled ?? true}
                  onChange={(e) => setSettings({ ...settings, memoryConfig: { ...settings.memoryConfig, enabled: e.target.checked } })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600" />
                <span className="ms-3 text-sm font-bold text-zinc-600 dark:text-zinc-400">Enable AI Memory</span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.memoryConfig?.embeddingEnabled ?? true}
                  onChange={(e) => setSettings({ ...settings, memoryConfig: { ...settings.memoryConfig, embeddingEnabled: e.target.checked } })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600" />
                <span className="ms-3 text-sm font-bold text-zinc-600 dark:text-zinc-400">Enable Embeddings (semantic search)</span>
              </label>
            </div>
            <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 mt-1.5 ml-1">
              <span className="w-1 h-1 rounded-full bg-cyan-500" />
              AI remembers past conversations and customer preferences across sessions
            </p>
          </div>
        </motion.div>

        {/* === PROACTIVE AGENT === */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, type: 'spring', stiffness: 200 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-lg hover:shadow-xl transition-all duration-500 group"
        >
          <div className="flex items-center gap-4 mb-8">
            <motion.div
              whileHover={{ scale: 1.1, rotate: -5 }}
              className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center"
            >
              <Zap className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </motion.div>
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white">Proactive Agent</h3>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Automated outbound triggers & campaigns</p>
            </div>
          </div>
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.proactiveConfig?.enabled ?? false}
                  onChange={(e) => setSettings({ ...settings, proactiveConfig: { ...settings.proactiveConfig, enabled: e.target.checked } })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600" />
                <span className="ms-3 text-sm font-bold text-zinc-600 dark:text-zinc-400">Enable Proactive Engine</span>
              </label>
            </div>

            {settings.proactiveConfig?.enabled && (
              <div className="space-y-4 pl-2 border-l-2 border-amber-200 dark:border-amber-800 ml-1">
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Triggers</p>
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.proactiveConfig?.abandonedCart?.enabled ?? true}
                        onChange={(e) => setSettings({ ...settings, proactiveConfig: { ...settings.proactiveConfig, abandonedCart: { ...settings.proactiveConfig?.abandonedCart, enabled: e.target.checked } } })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600" />
                      <span className="ms-3 text-sm font-bold text-zinc-600 dark:text-zinc-400">Abandoned Cart</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.proactiveConfig?.reEngagement?.enabled ?? true}
                        onChange={(e) => setSettings({ ...settings, proactiveConfig: { ...settings.proactiveConfig, reEngagement: { ...settings.proactiveConfig?.reEngagement, enabled: e.target.checked } } })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600" />
                      <span className="ms-3 text-sm font-bold text-zinc-600 dark:text-zinc-400">Re-engagement (Inactive)</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.proactiveConfig?.priceDrop?.enabled ?? true}
                        onChange={(e) => setSettings({ ...settings, proactiveConfig: { ...settings.proactiveConfig, priceDrop: { ...settings.proactiveConfig?.priceDrop, enabled: e.target.checked } } })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600" />
                      <span className="ms-3 text-sm font-bold text-zinc-600 dark:text-zinc-400">Price Drop Alerts</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.proactiveConfig?.birthday?.enabled ?? true}
                        onChange={(e) => setSettings({ ...settings, proactiveConfig: { ...settings.proactiveConfig, birthday: { ...settings.proactiveConfig?.birthday, enabled: e.target.checked } } })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600" />
                      <span className="ms-3 text-sm font-bold text-zinc-600 dark:text-zinc-400">Birthday Greetings</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Max per day</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={settings.proactiveConfig?.maxPerDay ?? 5}
                      onChange={(e) => setSettings({ ...settings, proactiveConfig: { ...settings.proactiveConfig, maxPerDay: Number(e.target.value) || 5 } })}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-2xl px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Max per run</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={settings.proactiveConfig?.maxPerRun ?? 50}
                      onChange={(e) => setSettings({ ...settings, proactiveConfig: { ...settings.proactiveConfig, maxPerRun: Number(e.target.value) || 50 } })}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-2xl px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 mt-1.5 ml-1">
              <span className="w-1 h-1 rounded-full bg-amber-500" />
              Schedules automated follow-ups every 15 minutes for abandoned carts, re-engagement, price drops, and birthdays
            </p>
          </div>
        </motion.div>

        {/* === PASSWORD CHANGE === */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, type: 'spring', stiffness: 200 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-lg hover:shadow-xl transition-all duration-500 group"
        >
          <div className="flex items-center gap-4 mb-8">
            <motion.div
              whileHover={{ scale: 1.1, rotate: -5 }}
              className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 flex items-center justify-center"
            >
              <Lock className="w-6 h-6 text-red-600 dark:text-red-400" />
            </motion.div>
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white">Security</h3>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Change admin password</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Current Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showOldPw ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 rounded-2xl pl-11 pr-11 py-4 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
                />
                <button
                  onClick={() => setShowOldPw(!showOldPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showOldPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">New Password</label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars, A-Z, a-z, 0-9, special char"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 rounded-2xl pl-11 pr-11 py-4 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
                />
                <button
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Confirm New Password</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 rounded-2xl pl-11 pr-4 py-4 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
                />
              </div>
            </div>

            <AnimatePresence>
              {passwordError && (
                <motion.div
                  initial={{ opacity: 0, y: -5, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -5, height: 0 }}
                  className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-xs font-bold"
                >
                  <X className="w-4 h-4 shrink-0" />
                  {passwordError}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              onClick={handleChangePassword}
              disabled={changingPassword}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative w-full py-4 rounded-2xl font-black text-sm overflow-hidden transition-all shadow-lg ${passwordChanged
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/30'
                : 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-500/30 hover:shadow-red-500/50'
                }`}
            >
              <motion.div
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut', repeatDelay: 1 }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg]"
              />
              <div className="relative z-10 flex items-center justify-center gap-2 text-white">
                {changingPassword ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : passwordChanged ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                  >
                    <CheckCircle className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <Lock className="w-5 h-5" />
                )}
                {changingPassword ? 'Changing...' : passwordChanged ? 'Password Changed!' : 'Change Password'}
              </div>
            </motion.button>
          </div>
        </motion.div>

        {/* === TWO-FACTOR AUTHENTICATION === */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.37, type: 'spring', stiffness: 200 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-lg hover:shadow-xl transition-all duration-500 group"
        >
          <TwoFactorSetup />
        </motion.div>

        {/* === JAZZCASH ADVANCE PAYMENT === */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-lg hover:shadow-xl transition-all duration-500 group"
        >
          <div className="flex items-center gap-4 mb-8">
            <motion.div
              whileHover={{ scale: 1.1, rotate: -5 }}
              className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center"
            >
              <Smartphone className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </motion.div>
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white">Advance Payment</h3>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">JazzCash / Easypaisa number for Rs. 300 advance</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                Payment Collection Number
              </label>
              <div className="relative">
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
                <input
                  type="text"
                  value={settings.jazzCashNumber}
                  onChange={(e) => setSettings({ ...settings, jazzCashNumber: e.target.value })}
                  placeholder="0300-1234567"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl pl-12 pr-4 py-4 text-lg font-black text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-600 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                Advance Amount (Rs.)
              </label>
              <div className="relative">
                <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
                <input
                  type="number"
                  value={settings.advanceAmount}
                  onChange={(e) => setSettings({ ...settings, advanceAmount: Number(e.target.value) || 300 })}
                  placeholder="300"
                  min={50}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl pl-12 pr-4 py-4 text-lg font-black text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-600 outline-none transition-all"
                />
              </div>
              <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 mt-1.5 ml-1">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                Customers will pay this amount as advance to confirm orders
              </p>
            </div>

            <div className="flex gap-3">
              <motion.button
                onClick={handleSaveJazzCash}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${jazzSaved
                  ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30 hover:shadow-emerald-500/50'
                  }`}
              >
                {jazzSaved ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Number
                  </>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-4 rounded-2xl font-black text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center gap-2"
              >
                <Banknote className="w-5 h-5" />
                Rs. {settings.advanceAmount}
              </motion.button>
            </div>

            {/* Info card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/5 dark:to-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  <span className="font-black">How it works:</span> Jab koi customer order confirm kare ga, AI agent automatically
                  unhein <span className="font-bold">Rs. {settings.advanceAmount} advance</span> is number par bhejne ka kare ga. Payment screenshot
                  bhejne par aap verify kar sakte hain.
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* === DAILY EMAIL REPORT === */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-lg hover:shadow-xl transition-all duration-500 group"
        >
          <div className="flex items-center gap-4 mb-8">
            <motion.div
              whileHover={{ scale: 1.1, rotate: -5 }}
              className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center"
            >
              <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </motion.div>
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white">Daily Email Report</h3>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Receive order summary at 10 PM daily</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-blue-500" />
                Notification Email
              </label>
              <input
                type="email"
                value={emailSettings.notificationEmail}
                onChange={(e) => setEmailSettings({ ...emailSettings, notificationEmail: e.target.value })}
                placeholder="admin@example.com"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
              />
              <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 mt-1.5 ml-1">
                <span className="w-1 h-1 rounded-full bg-blue-500" />
                Daily order summary will be sent to this email at 10:00 PM
              </p>
            </div>

            {emailSettings.isSuperAdmin && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5">
                <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-4 flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  SMTP Configuration (Super Admin)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">SMTP Host</label>
                    <input
                      type="text"
                      value={emailSettings.smtpHost}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl px-4 py-3.5 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">SMTP Port</label>
                    <input
                      type="number"
                      value={emailSettings.smtpPort}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: Number(e.target.value) || 587 })}
                      placeholder="587"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl px-4 py-3.5 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">SMTP Username</label>
                    <input
                      type="text"
                      value={emailSettings.smtpUser}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
                      placeholder="your@email.com"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl px-4 py-3.5 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">SMTP Password</label>
                    <div className="relative">
                      <input
                        type={showSmtpPass ? "text" : "password"}
                        value={emailSettings.smtpPass}
                        onChange={(e) => setEmailSettings({ ...emailSettings, smtpPass: e.target.value })}
                        placeholder="App password or SMTP password"
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl px-4 py-3.5 pr-10 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
                      />
                      <button
                        onClick={() => setShowSmtpPass(!showSmtpPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                      >
                        {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailSettings.emailReportsEnabled}
                  onChange={(e) => setEmailSettings({ ...emailSettings, emailReportsEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                <span className="ms-3 text-sm font-bold text-zinc-600 dark:text-zinc-400">Enable daily email reports</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <motion.button
                onClick={handleSaveEmailSettings}
                disabled={loadingEmailSettings}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex-1 min-w-[140px] py-4 rounded-2xl font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${emailSettingsSaved
                  ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-500/30 hover:shadow-blue-500/50'
                  }`}
              >
                {loadingEmailSettings ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : emailSettingsSaved ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Email Settings
                  </>
                )}
              </motion.button>

              <motion.button
                onClick={handleTestEmail}
                disabled={testSending}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-6 py-4 rounded-2xl font-black text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {testSending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                Test Email
              </motion.button>
            </div>

            {testResult && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold ${testResult.success
                  ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-green-600 dark:text-green-400'
                  : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400'
                  }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <X className="w-4 h-4 shrink-0" />
                )}
                {testResult.success ? 'Test email sent successfully! Check your inbox.' : `Failed: ${testResult.error}`}
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/5 dark:to-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  <span className="font-black">How it works:</span> Har raat 10:00 PM par system automatically
                  poore din ke confirmed orders ki list aapki email par bhej de ga. Har order mein
                  <span className="font-bold"> customer name, contact number, address, product name, aur amount</span> shamil hoga.
                  SMTP credentials save karna lazmi hai — Gmail ke liye App Password use karein.
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}


