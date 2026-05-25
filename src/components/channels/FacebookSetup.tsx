import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { CheckCircle, XCircle, Link2, Unlink, Loader2, Eye, EyeOff, Key, Shield, MessageCircle } from 'lucide-react';

interface FacebookConfig {
  pageId: string;
  pageAccessToken: string;
  verifyToken: string;
  isActive: boolean;
}

interface Props {
  config: FacebookConfig;
  connected: boolean;
  testing: boolean;
  error: string | null;
  showToken: boolean;
  showVerifyToken: boolean;
  advancedMode: boolean;
  setConfig: React.Dispatch<React.SetStateAction<FacebookConfig>>;
  setTesting: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setShowToken: React.Dispatch<React.SetStateAction<boolean>>;
  setShowVerifyToken: React.Dispatch<React.SetStateAction<boolean>>;
  setAdvancedMode: React.Dispatch<React.SetStateAction<boolean>>;
  openOAuthPopup: (url: string, title: string) => void;
}

function handleFbTestConnection(
  config: FacebookConfig,
  setTesting: React.Dispatch<React.SetStateAction<boolean>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  setConnected: React.Dispatch<React.SetStateAction<boolean>>
) {
  return async () => {
    if (!config.pageId || !config.pageAccessToken) {
      setError('Enter Page ID and Access Token first');
      return;
    }
    setTesting(true);
    setError(null);
    try {
      const res = await axios.post('/api/facebook/test', {
        pageId: config.pageId,
        pageAccessToken: config.pageAccessToken
      });
      if (res.data.success) {
        await axios.post('/api/facebook/config', { isActive: true });
        setConnected(true);
      } else {
        setError(res.data.error || 'Connection failed');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to connect');
    } finally {
      setTesting(false);
    }
  };
}

function handleFbDisconnect(
  config: FacebookConfig,
  setConfig: React.Dispatch<React.SetStateAction<FacebookConfig>>,
  setConnected: React.Dispatch<React.SetStateAction<boolean>>
) {
  return async () => {
    try {
      await axios.post('/api/facebook/config', { isActive: false, pageAccessToken: '', verifyToken: '' });
    } catch (e) { console.error('FB disconnect failed:', e); }
    setConfig({ pageId: '', pageAccessToken: '', verifyToken: '', isActive: false });
    setConnected(false);
  };
}

function handleSaveConfig(field: string, value: string) {
  axios.post('/api/facebook/config', { [field]: value }).catch(() => {});
}

export default function FacebookSetup(props: Props) {
  const { config, connected, testing, error, showToken, showVerifyToken, advancedMode } = props;
  const { setConfig, setTesting, setError, setConnected, setShowToken, setShowVerifyToken, setAdvancedMode, openOAuthPopup } = props;

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="overflow-hidden">
      <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-5" />

      <div className="space-y-5" onClick={e => e.stopPropagation()}>
        {connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-200 dark:border-emerald-500/20">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300">Facebook Messenger Connected</p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">Page ID: {config.pageId}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-4 text-center">
                <p className="text-xl font-black text-zinc-900 dark:text-white">Messenger API</p>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Integration</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-4 text-center">
                <p className="text-xl font-black text-emerald-500">Active</p>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Status</p>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                ⚡ Webhook URL: <span className="font-mono text-[10px] bg-amber-100/50 dark:bg-amber-900/30 px-2 py-1 rounded">https://your-domain.com/api/webhook/facebook</span>
              </p>
              <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-1.5">Set this URL in your Facebook App dashboard → Messenger → Webhooks</p>
            </div>
            <motion.button
              onClick={handleFbDisconnect(config, setConfig, setConnected)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 rounded-2xl font-black text-sm bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Unlink className="w-4 h-4" />
              Disconnect Messenger
            </motion.button>
          </div>
        ) : !advancedMode ? (
          <div className="space-y-6 text-center py-4">
            <div className="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <h4 className="text-lg font-black text-zinc-900 dark:text-white">Connect with Facebook</h4>
              <p className="text-xs text-zinc-500 mt-2 max-w-sm mx-auto">
                One-click secure login. We only request permission to read and reply to messages on your behalf. Your password remains private.
              </p>
            </div>
            <motion.button
              onClick={() => openOAuthPopup('/api/auth/facebook/login', 'Facebook Login')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 rounded-2xl font-black text-sm bg-[#1877F2] text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Continue with Facebook
            </motion.button>
            <button onClick={() => setAdvancedMode(true)} className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline underline-offset-4">
              Use Manual Developer Setup (Advanced)
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-black text-zinc-800 dark:text-zinc-200">Advanced Manual Setup</h4>
              <button onClick={() => setAdvancedMode(false)} className="text-[10px] text-blue-500 hover:underline">Back to Easy Login</button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Facebook Page ID</label>
              <input
                type="text"
                value={config.pageId}
                onChange={e => setConfig(prev => ({ ...prev, pageId: e.target.value }))}
                onBlur={e => handleSaveConfig('pageId', (e.target as HTMLInputElement).value)}
                placeholder="e.g. 123456789012345"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl px-5 py-3.5 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Page Access Token</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showToken ? 'text' : 'password'}
                  value={config.pageAccessToken}
                  onChange={e => setConfig(prev => ({ ...prev, pageAccessToken: e.target.value }))}
                  onBlur={e => handleSaveConfig('pageAccessToken', (e.target as HTMLInputElement).value)}
                  placeholder="EAAB... long token"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl pl-11 pr-11 py-3.5 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
                />
                <button onClick={() => setShowToken(!showToken)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Webhook Verify Token</label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showVerifyToken ? 'text' : 'password'}
                  value={config.verifyToken}
                  onChange={e => setConfig(prev => ({ ...prev, verifyToken: e.target.value }))}
                  onBlur={e => handleSaveConfig('verifyToken', (e.target as HTMLInputElement).value)}
                  placeholder="Your custom verify token"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl pl-11 pr-11 py-3.5 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
                />
                <button onClick={() => setShowVerifyToken(!showVerifyToken)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  {showVerifyToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-xs font-bold">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3">
              <motion.button
                onClick={handleFbTestConnection(config, setTesting, setError, setConnected)}
                disabled={testing || !config.pageId || !config.pageAccessToken}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {testing ? 'Testing...' : 'Test & Connect'}
              </motion.button>
            </div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-5 space-y-3">
              <p className="text-xs font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">How to get these:</p>
              {[
                'Go to developers.facebook.com → Create App',
                'Add Messenger product → Select your Page',
                'Generate Page Access Token from Tools',
                'Set Webhook URL to your server + /api/webhook/facebook',
                'Enter the Verify Token you set in Facebook App',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 text-xs text-blue-600 dark:text-blue-400">
                  <span className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</span>
                  {step}
                </div>
              ))}
            </motion.div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
