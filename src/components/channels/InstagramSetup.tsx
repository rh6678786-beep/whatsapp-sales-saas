import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { CheckCircle, XCircle, Link2, Unlink, Loader2, Eye, EyeOff, Key, Shield, Send } from 'lucide-react';

interface InstagramConfig {
  igBusinessId: string;
  pageAccessToken: string;
  verifyToken: string;
  isActive: boolean;
}

interface Props {
  config: InstagramConfig;
  connected: boolean;
  testing: boolean;
  error: string | null;
  showToken: boolean;
  showVerifyToken: boolean;
  advancedMode: boolean;
  setConfig: React.Dispatch<React.SetStateAction<InstagramConfig>>;
  setTesting: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setShowToken: React.Dispatch<React.SetStateAction<boolean>>;
  setShowVerifyToken: React.Dispatch<React.SetStateAction<boolean>>;
  setAdvancedMode: React.Dispatch<React.SetStateAction<boolean>>;
  openOAuthPopup: (url: string, title: string) => void;
}

function handleIgTestConnection(
  config: InstagramConfig,
  setTesting: React.Dispatch<React.SetStateAction<boolean>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  setConnected: React.Dispatch<React.SetStateAction<boolean>>
) {
  return async () => {
    if (!config.igBusinessId || !config.pageAccessToken) {
      setError('Enter Instagram Business Account ID and Access Token first');
      return;
    }
    setTesting(true);
    setError(null);
    try {
      const res = await axios.post('/api/instagram/test', {
        igBusinessId: config.igBusinessId,
        pageAccessToken: config.pageAccessToken
      });
      if (res.data.success) {
        await axios.post('/api/instagram/config', { isActive: true });
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

function handleIgDisconnect(
  config: InstagramConfig,
  setConfig: React.Dispatch<React.SetStateAction<InstagramConfig>>,
  setConnected: React.Dispatch<React.SetStateAction<boolean>>
) {
  return async () => {
    try {
      await axios.post('/api/instagram/config', { isActive: false, pageAccessToken: '', verifyToken: '' });
    } catch (e) { console.error('IG disconnect failed:', e); }
    setConfig({ igBusinessId: '', pageAccessToken: '', verifyToken: '', isActive: false });
    setConnected(false);
  };
}

function handleSaveConfig(field: string, value: string) {
  axios.post('/api/instagram/config', { [field]: value }).catch(() => {});
}

export default function InstagramSetup(props: Props) {
  const { config, connected, testing, error, showToken, showVerifyToken, advancedMode } = props;
  const { setConfig, setTesting, setError, setConnected, setShowToken, setShowVerifyToken, setAdvancedMode, openOAuthPopup } = props;

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'instagram_oauth') {
        setConfig(prev => ({
          ...prev,
          igBusinessId: e.data.igBusinessId,
          pageAccessToken: e.data.pageAccessToken,
        }));
        if (e.data.igBusinessId && e.data.pageAccessToken) {
          setTimeout(() => {
            handleIgTestConnection(
              { ...config, igBusinessId: e.data.igBusinessId, pageAccessToken: e.data.pageAccessToken },
              setTesting, setError, setConnected
            )();
          }, 500);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="overflow-hidden">
      <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-5" />

      <div className="space-y-5" onClick={e => e.stopPropagation()}>
        {connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-200 dark:border-emerald-500/20">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300">Instagram DM Connected</p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">IG Business ID: {config.igBusinessId}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-4 text-center">
                <p className="text-xl font-black text-zinc-900 dark:text-white">Instagram Graph API</p>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Integration</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-4 text-center">
                <p className="text-xl font-black text-emerald-500">Active</p>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Status</p>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                ⚡ Webhook URL: <span className="font-mono text-[10px] bg-amber-100/50 dark:bg-amber-900/30 px-2 py-1 rounded">https://your-domain.com/api/webhook/instagram</span>
              </p>
              <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-1.5">Set this URL in your Facebook App dashboard → Instagram → Webhooks</p>
            </div>
            <motion.button
              onClick={handleIgDisconnect(config, setConfig, setConnected)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 rounded-2xl font-black text-sm bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Unlink className="w-4 h-4" />
              Disconnect Instagram
            </motion.button>
          </div>
        ) : !advancedMode ? (
          <div className="space-y-6 text-center py-4">
            <div className="mx-auto w-16 h-16 bg-pink-50 dark:bg-pink-500/10 rounded-2xl flex items-center justify-center">
              <Send className="w-8 h-8 text-pink-500" />
            </div>
            <div>
              <h4 className="text-lg font-black text-zinc-900 dark:text-white">Connect with Instagram</h4>
              <p className="text-xs text-zinc-500 mt-2 max-w-sm mx-auto">
                Securely connect your Instagram Business account via Meta. We will only access your DMs to reply to customers.
              </p>
            </div>
            <motion.button
              onClick={() => openOAuthPopup('/api/auth/instagram/login', 'Instagram Login')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 rounded-2xl font-black text-sm bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              Connect via Instagram
            </motion.button>
            <button onClick={() => setAdvancedMode(true)} className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline underline-offset-4">
              Use Manual Developer Setup (Advanced)
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-black text-zinc-800 dark:text-zinc-200">Advanced Manual Setup</h4>
              <button onClick={() => setAdvancedMode(false)} className="text-[10px] text-pink-500 hover:underline">Back to Easy Login</button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Instagram Business Account ID</label>
              <input
                type="text"
                value={config.igBusinessId}
                onChange={e => setConfig(prev => ({ ...prev, igBusinessId: e.target.value }))}
                onBlur={e => handleSaveConfig('igBusinessId', (e.target as HTMLInputElement).value)}
                placeholder="e.g. 17841405822304917"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 rounded-2xl px-5 py-3.5 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Facebook Page Access Token</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showToken ? 'text' : 'password'}
                  value={config.pageAccessToken}
                  onChange={e => setConfig(prev => ({ ...prev, pageAccessToken: e.target.value }))}
                  onBlur={e => handleSaveConfig('pageAccessToken', (e.target as HTMLInputElement).value)}
                  placeholder="EAAB... long token"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 rounded-2xl pl-11 pr-11 py-3.5 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
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
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 rounded-2xl pl-11 pr-11 py-3.5 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
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
                onClick={handleIgTestConnection(config, setTesting, setError, setConnected)}
                disabled={testing || !config.igBusinessId || !config.pageAccessToken}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {testing ? 'Testing...' : 'Test & Connect'}
              </motion.button>
            </div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-pink-50 dark:bg-pink-500/5 border border-pink-200 dark:border-pink-500/20 rounded-2xl p-5 space-y-3">
              <p className="text-xs font-black text-pink-700 dark:text-pink-300 uppercase tracking-widest">How to get these:</p>
              {[
                'Go to developers.facebook.com → Create App',
                'Add Instagram Graph API product',
                'Connect your Instagram Business Account to your Facebook Page',
                'Generate a Page Access Token with instagram_basic, instagram_manage_messages, pages_messaging permissions',
                'Find your IG Business ID in Facebook App dashboard → Instagram → Instagram Business Account ID',
                'Set Webhook URL to your server + /api/webhook/instagram',
                'Enter the Verify Token you set in Facebook App',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 text-xs text-pink-600 dark:text-pink-400">
                  <span className="w-5 h-5 rounded-full bg-pink-500/10 flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</span>
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
