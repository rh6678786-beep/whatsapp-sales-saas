import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { CheckCircle, XCircle, ExternalLink, Link2, Unlink, Loader2, Eye, EyeOff, Key } from 'lucide-react';

interface TikTokConfig {
  clientKey: string;
  clientSecret: string;
  isActive: boolean;
}

interface Props {
  config: TikTokConfig;
  connected: boolean;
  testing: boolean;
  error: string | null;
  showSecret: boolean;
  advancedMode: boolean;
  setConfig: React.Dispatch<React.SetStateAction<TikTokConfig>>;
  setTesting: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSecret: React.Dispatch<React.SetStateAction<boolean>>;
  setAdvancedMode: React.Dispatch<React.SetStateAction<boolean>>;
  openOAuthPopup: (url: string, title: string) => void;
}

export default function TikTokSetup(props: Props) {
  const { config, connected, testing, error, showSecret, advancedMode } = props;
  const { setConfig, setTesting, setError, setConnected, setShowSecret, setAdvancedMode, openOAuthPopup } = props;

  const handleAuthorize = async () => {
    setTesting(true);
    setError(null);
    try {
      await axios.post('/api/tiktok/config', { isActive: true, clientKey: config.clientKey, clientSecret: config.clientSecret });
      setConnected(true);
    } catch (err: any) {
      setError('Failed to authorize TikTok API');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await axios.post('/api/tiktok/config', { isActive: false, clientSecret: '' });
    } catch (e) { console.error('TikTok disconnect failed:', e); }
    setConfig({ clientKey: '', clientSecret: '', isActive: false });
    setConnected(false);
  };

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="overflow-hidden">
      <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-5" />

      <div className="space-y-5" onClick={e => e.stopPropagation()}>
        {connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-200 dark:border-emerald-500/20">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300">TikTok Business API Connected</p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">Status: Authorized</p>
              </div>
            </div>
            <motion.button
              onClick={handleDisconnect}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 rounded-2xl font-black text-sm bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Unlink className="w-4 h-4" />
              Disconnect TikTok
            </motion.button>
          </div>
        ) : !advancedMode ? (
          <div className="space-y-6 text-center py-4">
            <div className="mx-auto w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-900 dark:text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
            </div>
            <div>
              <h4 className="text-lg font-black text-zinc-900 dark:text-white">Connect with TikTok</h4>
              <p className="text-xs text-zinc-500 mt-2 max-w-sm mx-auto">
                Securely connect your TikTok Shop and DMs. One-click authorization via official TikTok API.
              </p>
            </div>
            <motion.button
              onClick={() => openOAuthPopup('/api/auth/tiktok/login', 'TikTok Login')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 rounded-2xl font-black text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
              Continue with TikTok
            </motion.button>
            <button onClick={() => setAdvancedMode(true)} className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline underline-offset-4">
              Use Manual Developer Setup (Advanced)
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-black text-zinc-800 dark:text-zinc-200">Advanced Manual Setup</h4>
              <button onClick={() => setAdvancedMode(false)} className="text-[10px] text-zinc-500 hover:underline">Back to Easy Login</button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">TikTok Client Key</label>
              <input
                type="text"
                value={config.clientKey}
                onChange={(e) => {
                  const val = e.target.value;
                  setConfig(prev => ({ ...prev, clientKey: val }));
                }}
                onBlur={() => {
                  axios.post('/api/tiktok/config', { clientKey: config.clientKey }).catch(() => {});
                }}
                placeholder="e.g. awabc123..."
                className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-zinc-900 dark:focus:border-white focus:ring-4 focus:ring-zinc-500/10 rounded-2xl px-5 py-3.5 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">TikTok Client Secret</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={config.clientSecret}
                  onChange={(e) => {
                    const val = e.target.value;
                    setConfig(prev => ({ ...prev, clientSecret: val }));
                  }}
                onBlur={() => {
                  axios.post('/api/tiktok/config', { clientSecret: config.clientSecret }).catch(() => {});
                }}
                  placeholder="Your TikTok App Secret"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-zinc-900 dark:focus:border-white focus:ring-4 focus:ring-zinc-500/10 rounded-2xl pl-11 pr-11 py-3.5 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
                />
                <button onClick={() => setShowSecret(!showSecret)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <motion.button
                onClick={handleAuthorize}
                disabled={testing || !config.clientKey || !config.clientSecret}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-3.5 rounded-2xl font-black text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                {testing ? 'Authorizing...' : 'Authorize TikTok'}
              </motion.button>
            </div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-5 space-y-3">
              <p className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">How to connect TikTok:</p>
              {[
                'Go to developers.tiktok.com → Create App',
                'Select "TikTok for Business" APIs',
                'Enable "Direct Messages" and "Content Management" permissions',
                'Copy Client Key and Client Secret above',
                'Set Redirect URI to your dashboard URL',
                'Click Authorize to connect your account',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="w-5 h-5 rounded-full bg-zinc-900/10 dark:bg-white/10 flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</span>
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
