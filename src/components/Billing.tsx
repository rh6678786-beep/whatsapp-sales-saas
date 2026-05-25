import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Check, Loader2, CreditCard, ShieldCheck, ArrowRight, Zap, Crown, Building2, AlertTriangle, BarChart3, Users, Package as PackageIcon, MessageSquare } from 'lucide-react';
import axios from 'axios';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  limits: { maxSessionsPerMonth: number; maxProducts: number; maxBroadcastsPerMonth: number; maxTeamMembers: number };
  popular?: boolean;
}

interface Subscription {
  planId: string;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: string;
}

interface Usage {
  sessionsThisMonth: number;
  broadcastsThisMonth: number;
  productCount: number;
}

export default function Billing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [usage, setUsage] = useState<Usage>({ sessionsThisMonth: 0, broadcastsThisMonth: 0, productCount: 0 });
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, subRes] = await Promise.all([
        axios.get('/api/billing/plans'),
        axios.get('/api/billing/subscription'),
      ]);
      setPlans(plansRes.data);
      setPlan(subRes.data.plan);
      setSubscription(subRes.data.subscription);
      setUsage(subRes.data.usage || { sessionsThisMonth: 0, broadcastsThisMonth: 0, productCount: 0 });
    } catch (err) {
      setError('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    if (planId === subscription?.planId) return;
    setUpgrading(planId);
    setError('');
    try {
      const res = await axios.post('/api/billing/create-checkout', { planId });
      if (res.data.url) {
        window.location.href = res.data.url;
      }
      if (res.data.mockUpgrade) {
        await fetchData();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upgrade failed');
    } finally {
      setUpgrading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel at period end?')) return;
    try {
      await axios.post('/api/billing/cancel');
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Cancel failed');
    }
  };

  const handlePortal = async () => {
    try {
      const res = await axios.post('/api/billing/portal');
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      setError('Failed to open billing portal');
    }
  };

  const planIcons: Record<string, any> = {
    free: Sparkles,
    basic: Zap,
    professional: Crown,
    business: Users,
    enterprise: Building2,
  };

  const planColors: Record<string, string> = {
    free: 'from-zinc-500 to-zinc-400',
    basic: 'from-blue-600 to-blue-500',
    professional: 'from-emerald-600 to-emerald-500',
    business: 'from-orange-600 to-orange-500',
    enterprise: 'from-violet-600 to-violet-500',
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-500/30',
      trialing: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-500/30',
      past_due: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-500/30',
      canceled: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-500/30',
      free: 'bg-zinc-500/10 text-zinc-600 border-zinc-200 dark:border-zinc-500/30',
    };
    return colors[status] || colors.free;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-xl">
          <CreditCard className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight">Billing</h2>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2 mt-1">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            Manage your subscription and usage limits
          </p>
        </div>
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl px-6 py-4 text-red-600 dark:text-red-400 font-bold text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {error}
        </motion.div>
      )}

      {/* Current Plan Status */}
      {subscription && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-lg">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${planColors[subscription.planId] || planColors.free} flex items-center justify-center shadow-lg`}>
                {React.createElement(planIcons[subscription.planId] || Sparkles, { className: 'w-8 h-8 text-white' })}
              </div>
              <div>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white">
                  {plan?.name || 'Free'} Plan
                </h3>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusBadge(subscription.status)}`}>
                    {subscription.status === 'free' ? 'Active' : subscription.status === 'trialing' ? `Free Trial` : subscription.status}
                  </span>
                  {subscription.status === 'trialing' && subscription.trialEnd && (
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-500/30">
                      Trial ends: {new Date(subscription.trialEnd).toLocaleDateString()}
                    </span>
                  )}
                  {subscription.cancelAtPeriodEnd && (
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-500/30">
                      Cancels at period end
                    </span>
                  )}
                  {subscription.currentPeriodEnd && (
                    <span className="text-xs text-zinc-400">
                      Renews: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              {subscription.planId !== 'free' && (
                <button onClick={handlePortal} className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-2xl font-bold text-sm text-zinc-700 dark:text-zinc-300 transition-all flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Manage
                </button>
              )}
              {subscription.planId !== 'free' && !subscription.cancelAtPeriodEnd && (
                <button onClick={handleCancel} className="px-6 py-3 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-2xl font-bold text-sm text-red-600 dark:text-red-400 transition-all">
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Usage Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {[
              { icon: MessageSquare, label: 'Conversations / Month', current: usage.sessionsThisMonth, limit: plan?.limits.maxSessionsPerMonth || 30 },
              { icon: PackageIcon, label: 'Products', current: usage.productCount, limit: plan?.limits.maxProducts || 5 },
              { icon: BarChart3, label: 'Broadcasts / Month', current: usage.broadcastsThisMonth, limit: plan?.limits.maxBroadcastsPerMonth || 0 },
            ].map((item, i) => {
              const pct = item.limit > 0 ? Math.min(100, Math.round((item.current / item.limit) * 100)) : 0;
              const warn = pct >= 80;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <item.icon className={`w-4 h-4 ${warn ? 'text-amber-500' : 'text-zinc-400'}`} />
                      <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{item.label}</span>
                    </div>
                    {warn && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-2xl font-black text-zinc-900 dark:text-white">{item.current}</span>
                    <span className="text-sm font-bold text-zinc-400">/ {item.limit === 999999 ? '∞' : item.limit}</span>
                  </div>
                  <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, delay: i * 0.15 }}
                      className={`h-full rounded-full ${warn ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((p, idx) => {
          const isCurrent = p.id === subscription?.planId;
          const Icon = planIcons[p.id] || Sparkles;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`relative bg-white dark:bg-zinc-900 border-2 rounded-[32px] p-6 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col ${
                p.popular ? 'border-emerald-500 dark:border-emerald-500' : 'border-zinc-200 dark:border-zinc-800'
              } ${isCurrent ? 'ring-2 ring-emerald-500/50' : ''}`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg shadow-emerald-500/30 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  MOST POPULAR
                </div>
              )}

              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${planColors[p.id]} flex items-center justify-center mb-5 shadow-md`}>
                <Icon className="w-6 h-6 text-white" />
              </div>

                  <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-1">{p.name}</h3>
                  <div className="flex items-baseline gap-1 mb-5">
                    {p.price === 0 ? (
                      <span className="text-4xl font-black text-zinc-900 dark:text-white">Free</span>
                    ) : (
                      <>
                        <span className="text-3xl font-black text-zinc-900 dark:text-white">Rs.{p.price.toLocaleString()}</span>
                        <span className="text-sm font-bold text-zinc-400">/mo</span>
                      </>
                    )}
                  </div>

              <div className="space-y-3 flex-1">
                {p.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{f}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleUpgrade(p.id)}
                disabled={upgrading === p.id || isCurrent}
                className={`mt-6 w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                  isCurrent
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-default'
                    : p.popular
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {upgrading === p.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCurrent ? (
                  <>
                    <Check className="w-4 h-4" />
                    Current Plan
                  </>
                ) : (
                  <>
                    {subscription?.status === 'trialing' ? 'Upgrade' : p.price === 0 ? 'Get Started' : 'Upgrade'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
