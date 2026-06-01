import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, CheckCircle, RefreshCcw, Wifi, WifiOff, LogOut, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Phase = 'connected' | 'qr' | 'loading' | 'disconnecting';

export default function WhatsAppConnector() {
  const [status, setStatus] = useState<{ latestQr: string | null, isReady: boolean }>({ latestQr: null, isReady: false });
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/whatsapp/status');
      const data = res.data;
      console.log('WhatsApp status:', data);
      setStatus(data);
      setError(null);

      // Only update phase if we are not currently in the middle of disconnecting
      setPhase(prev => {
        if (prev === 'disconnecting') return prev; // don't override while user is waiting
        if (data.isReady) return 'connected';
        if (data.latestQr) return 'qr';
        return 'loading';
      });
    } catch (err) {
      setError('Could not reach server');
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp?')) return;
    setPhase('disconnecting');
    setStatus({ latestQr: null, isReady: false });
    setError(null);
    try {
      await axios.post('/api/whatsapp/logout');
      await axios.post('/api/whatsapp/init');
    } catch (err) {
      setError('Disconnect failed. Please try again.');
      setPhase('connected');
    }
  };

  useEffect(() => {
    axios.post('/api/whatsapp/init').catch(console.error);
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // When in 'disconnecting' phase, once we get a QR or ready signal, update phase
  useEffect(() => {
    if (phase === 'disconnecting') {
      if (status.isReady) setPhase('connected');
      else if (status.latestQr) setPhase('qr');
    }
  }, [status, phase]);

  const isConnected = phase === 'connected';
  const isDisconnecting = phase === 'disconnecting';
  const isLoadingQr = phase === 'loading' || isDisconnecting;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <header>
        <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400">
          WhatsApp Connection
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm font-medium">
          Connect your WhatsApp number to activate the AI Sales Agent
        </p>
      </header>

      <div className="relative group">
        {/* Glow ring */}
        <div className={`absolute -inset-1 rounded-3xl blur opacity-25 transition-all duration-1000 ${isConnected ? 'bg-gradient-to-r from-emerald-400 to-emerald-600 animate-pulse' :
            isDisconnecting ? 'bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse' :
              'bg-gradient-to-r from-zinc-300 to-zinc-500'
          }`} />

        <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 shadow-xl text-center space-y-8 overflow-hidden">
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.01)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

          {/* Status icon */}
          <div className="relative z-10 space-y-4">
            <motion.div
              animate={isConnected ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
              className={`w-24 h-24 mx-auto rounded-3xl flex items-center justify-center shadow-xl transition-all ${isConnected ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/40' :
                  isDisconnecting ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/30' :
                    'bg-zinc-100 dark:bg-zinc-800'
                }`}
            >
              {isConnected ? <CheckCircle className="w-12 h-12 text-white" /> :
                isDisconnecting ? <Loader2 className="w-12 h-12 text-white animate-spin" /> :
                  <Smartphone className="w-12 h-12 text-zinc-400 dark:text-zinc-500" />}
            </motion.div>

            <div>
              <h3 className={`text-2xl font-bold transition-colors ${isConnected ? 'text-emerald-600 dark:text-emerald-400' :
                  isDisconnecting ? 'text-amber-600 dark:text-amber-400' :
                    'text-zinc-900 dark:text-white'
                }`}>
                {isConnected ? 'Connected & Active' :
                  isDisconnecting ? 'Disconnecting…' :
                    phase === 'loading' ? 'Connecting…' :
                      'Scan to Connect'}
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                {isConnected ? 'WhatsApp is live. AI Agent is responding to customers.' :
                  isDisconnecting ? 'Please wait — generating a fresh QR code…' :
                    phase === 'loading' ? 'Waiting for QR code from server…' :
                      'Open WhatsApp → Linked Devices → Link a Device → Scan QR'}
              </p>
            </div>

            {/* Status pill */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border transition-all ${isConnected
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                : isDisconnecting
                  ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
              }`}>
              {isConnected ? <><Wifi className="w-3 h-3" /> Live</> :
                isDisconnecting ? <><Loader2 className="w-3 h-3 animate-spin" /> Resetting</> :
                  phase === 'qr' ? <><WifiOff className="w-3 h-3" /> Waiting for Scan</> :
                    <><RefreshCcw className="w-3 h-3 animate-spin" /> Loading</>}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="relative z-10 flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl px-4 py-3 text-sm font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* QR / Connected / Loading */}
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.25 }}
              className="relative z-10 flex justify-center"
            >
              {isConnected ? (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
                    The AI agent is handling incoming WhatsApp messages automatically.
                    Disconnect only if you want to switch accounts.
                  </p>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-6 py-3 bg-red-50 dark:bg-red-500/10 text-red-500 border border-red-200 dark:border-red-500/30 rounded-xl font-bold text-sm hover:bg-red-500 hover:text-white transition-all duration-200 mx-auto hover:shadow-[0_0_15px_rgba(239,68,68,0.35)]"
                  >
                    <LogOut className="w-4 h-4" /> Disconnect WhatsApp
                  </button>
                </div>
              ) : phase === 'qr' && status.latestQr ? (
                <div className="space-y-4">
                  <div className="relative inline-block">
                    <div className="absolute -inset-2 bg-gradient-to-r from-emerald-400 to-blue-400 rounded-[28px] blur opacity-30 animate-pulse" />
                    <div className="relative p-4 bg-white border-4 border-zinc-900 dark:border-white rounded-3xl shadow-2xl">
                      <QRCodeSVG value={status.latestQr} size={220} level="H" />
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center justify-center gap-1.5 italic">
                    <RefreshCcw className="w-3 h-3" /> QR refreshes automatically every few seconds
                  </p>
                </div>
              ) : (
                // Loading / disconnecting spinner
                <div className="flex flex-col items-center gap-4 py-10 text-zinc-400">
                  <Loader2 className="w-12 h-12 animate-spin opacity-40" />
                  <p className="text-sm italic">
                    {isDisconnecting ? 'Resetting session, new QR incoming…' : 'Waiting for QR code…'}
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
