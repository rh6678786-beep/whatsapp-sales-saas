import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { CheckCircle, XCircle, Link2, Unlink, Loader2, Eye, EyeOff, Key } from 'lucide-react';

interface TelegramConfig {
  botToken: string;
  isActive: boolean;
}

interface Props {
  config: TelegramConfig;
  connected: boolean;
  testing: boolean;
  error: string | null;
  showToken: boolean;
  botName: string | null;
  setConfig: React.Dispatch<React.SetStateAction<TelegramConfig>>;
  setTesting: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setBotName: React.Dispatch<React.SetStateAction<string | null>>;
  setShowToken: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function TelegramSetup(props: Props) {
  const { config, connected, testing, error, showToken, botName } = props;
  const { setConfig, setTesting, setError, setConnected, setBotName, setShowToken } = props;

  const handleTest = async () => {
    if (!config.botToken) {
      setError('Enter Bot Token first');
      return;
    }
    setTesting(true);
    setError(null);
    try {
      const res = await axios.post('/api/telegram/test', { botToken: config.botToken });
      if (res.data.success) {
        await axios.post('/api/telegram/config', { isActive: true, botToken: config.botToken, botName: res.data.botName });
        setConnected(true);
        setBotName(res.data.botName);
      } else {
        setError(res.data.error || 'Connection failed');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to connect');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await axios.post('/api/telegram/config', { isActive: false, botToken: '' });
    } catch (e) { console.error('TG disconnect failed:', e); }
    setConfig({ botToken: '', isActive: false });
    setConnected(false);
    setBotName(null);
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
                <p className="font-bold text-sm text-emerald-700 dark:text-emerald-300">Telegram Bot Connected</p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">{botName || 'Bot active'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-4 text-center">
                <p className="text-xl font-black text-zinc-900 dark:text-white">Telegram Bot API</p>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Integration</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-4 text-center">
                <p className="text-xl font-black text-emerald-500">Active</p>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Status</p>
              </div>
            </div>
            <motion.button
              onClick={handleDisconnect}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 rounded-2xl font-black text-sm bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Unlink className="w-4 h-4" />
              Disconnect Telegram
            </motion.button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Telegram Bot Token</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type={showToken ? 'text' : 'password'}
                  value={config.botToken}
                  onChange={e => {
                    const updated = { ...config, botToken: e.target.value };
                    setConfig(updated);
                  }}
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-2xl pl-11 pr-11 py-3.5 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
                />
                <button onClick={() => setShowToken(!showToken)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                onClick={handleTest}
                disabled={testing || !config.botToken}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-sky-500 to-cyan-600 text-white shadow-lg shadow-sky-500/30 hover:shadow-sky-500/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {testing ? 'Testing...' : 'Test & Connect'}
              </motion.button>
            </div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-sky-50 dark:bg-sky-500/5 border border-sky-200 dark:border-sky-500/20 rounded-2xl p-5 space-y-3">
              <p className="text-xs font-black text-sky-700 dark:text-sky-300 uppercase tracking-widest">How to get these:</p>
              {[
                'Open Telegram → Search @BotFather',
                'Send /newbot → Choose a name → Choose a username',
                'BotFather will give you a Bot Token (copy it)',
                'Enter the token above and click Test & Connect',
                'Your bot will automatically get webhook configured',
                'Users can now DM your bot on Telegram!',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 text-xs text-sky-600 dark:text-sky-400">
                  <span className="w-5 h-5 rounded-full bg-sky-500/10 flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</span>
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
