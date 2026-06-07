import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, CheckCircle, X, ArrowRight, KeyRound, Rocket } from 'lucide-react';
import axios from 'axios';

interface ResetPasswordProps {
  onBackToLogin: () => void;
}

export default function ResetPassword({ onBackToLogin }: ResetPasswordProps) {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return "Password must be at least 8 characters";
    if (!/[a-z]/.test(pw)) return "Password must contain a lowercase letter";
    if (!/[A-Z]/.test(pw)) return "Password must contain an uppercase letter";
    if (!/\d/.test(pw)) return "Password must contain a number";
    if (!/[!@#$%^&*()_\-+=<>?/{}~|]/.test(pw)) return "Password must contain a special character";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset.');
      return;
    }

    const pwErr = validatePassword(newPassword);
    if (pwErr) {
      setError(pwErr);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/auth/reset-password', { token, newPassword });
      setSuccess(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to reset password';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-700 shadow-xl text-center">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-950/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <X className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 mb-2">Invalid Link</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <button
            onClick={onBackToLogin}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/25"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-700 shadow-xl text-center">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Rocket className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 mb-2">Password Reset!</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            Your password has been updated successfully. You can now sign in with your new password.
          </p>
          <button
            onClick={onBackToLogin}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
          >
            Sign In <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-700 shadow-xl"
        >
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-7 h-7 text-amber-500" />
            </div>
            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Reset Password</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Enter your new password below.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[2px] ml-1">
                New Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3.5 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 rounded-2xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
              {newPassword.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 h-1.5 rounded-full transition-all ${
                          i <= pwStrength(newPassword).score ? pwStrength(newPassword).color : 'bg-zinc-200 dark:bg-zinc-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-[10px] font-bold tracking-wide ${pwStrength(newPassword).color.replace('bg-', 'text-')}`}>
                    {pwStrength(newPassword).label}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[2px] ml-1">
                Confirm New Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 rounded-2xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm"
                  required
                />
              </div>
              {confirmPassword.length > 0 && (
                <p className={`text-[10px] font-bold mt-1 ${newPassword === confirmPassword ? 'text-emerald-500' : 'text-red-500'}`}>
                  {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
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

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Reset Password
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>

            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full text-center text-sm font-bold text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
            >
              ← Back to Sign In
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
