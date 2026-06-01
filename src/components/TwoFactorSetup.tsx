import React, { useState } from 'react';
import axios from 'axios';
import { Shield, Mail, Key, CheckCircle, AlertCircle } from 'lucide-react';

export default function TwoFactorSetup() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp' | 'done'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await axios.post('/api/auth/2fa/send', { email });
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    try {
      await axios.post('/api/auth/2fa/verify', { otp });
      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-violet-500" />
        </div>
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-white">Two-Factor Authentication</h3>
          <p className="text-xs text-zinc-500">Add an extra layer of security</p>
        </div>
      </div>

      {step === 'email' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Enter your email to receive a verification code.</p>
          <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-4 py-3 border border-zinc-200 dark:border-zinc-700">
            <Mail className="w-4 h-4 text-zinc-400" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none" />
          </div>
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
          <button onClick={handleSendOtp} disabled={loading || !email} className="w-full py-2.5 bg-violet-500 text-white rounded-xl text-sm font-bold hover:bg-violet-600 transition-colors disabled:opacity-50">
            {loading ? 'Sending...' : 'Send Code'}
          </button>
        </div>
      )}

      {step === 'otp' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Enter the 6-digit code sent to <strong>{email}</strong></p>
          <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-4 py-3 border border-zinc-200 dark:border-zinc-700">
            <Key className="w-4 h-4 text-zinc-400" />
            <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} className="flex-1 bg-transparent text-sm tracking-[8px] font-mono font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none" />
          </div>
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
          <button onClick={handleVerify} disabled={loading || otp.length !== 6} className="w-full py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50">
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center py-6">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <p className="font-bold text-zinc-900 dark:text-white">2FA Enabled</p>
          <p className="text-xs text-zinc-500 mt-1">Your account is now secured with two-factor authentication.</p>
        </div>
      )}
    </div>
  );
}
