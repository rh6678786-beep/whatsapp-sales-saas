import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import { Users, Store, Shield, AlertTriangle, ExternalLink, ShieldCheck, Loader2, X, Mail, Phone, Globe, RefreshCw, MessageSquare, Package, ShoppingBag, TrendingUp, DollarSign, CheckCircle, XCircle, Crown, Zap, Sparkles, Building2, Smartphone } from 'lucide-react';

interface AdminClient {
  id: string;
  storeName?: string;
  verifiedEmail?: string;
  phone?: string;
  address?: string;
  language?: string;
  businessLogo?: string;
  advanceAmount?: number;
  jazzCashNumber?: string;
  onboardingComplete?: boolean;
  channels: {
    facebook: boolean;
    instagram: boolean;
    telegram: boolean;
  };
  subscription?: any;
  stats: {
    products: number;
    sessions: number;
    orders: number;
    totalSales: number;
    totalProfit: number;
    pendingPayments: number;
  };
}

export default function SuperAdmin() {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<AdminClient | null>(null);

  const languageNames: Record<string, string> = {
    ur: 'Urdu (Roman)', en: 'English', ar: 'العربية', hi: 'हिन्दी',
    bn: 'বাংলা', es: 'Español', fr: 'Français', zh: '中文',
  };
  const langName = (code?: string) => languageNames[code || 'ur'] || code || 'ur';

  const fetchClients = () => {
    setLoading(true);
    axios.get('/api/super/clients')
      .then(res => {
        setClients(res.data);
        setError(null);
        setLoading(false);
      })
      .catch(err => {
        setError(err?.response?.data?.error || err.message || 'Failed to fetch clients');
        setLoading(false);
      });
  };

  useEffect(fetchClients, []);

  const planIcons: Record<string, any> = { free: Sparkles, basic: Zap, pro: Crown, enterprise: Building2 };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-zinc-900 dark:text-white animate-spin" />
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Loading SaaS Ecosystem...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 p-8">
        <AlertTriangle className="w-12 h-12 text-red-500" />
        <p className="text-red-500 font-bold text-lg">Error Loading Clients</p>
        <p className="text-zinc-500 text-sm max-w-md text-center">{error}</p>
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-sm mt-4">Retry</button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-zinc-900 dark:bg-white p-2 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-white dark:text-zinc-900" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">SaaS Control Center</span>
          </div>
          <h1 className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">Super Admin</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">Manage your multi-tenant empire and monitor client growth.</p>
        </div>
        <button
          onClick={fetchClients}
          className="flex items-center gap-2 px-5 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-2xl font-bold text-sm text-zinc-700 dark:text-zinc-300 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-xl font-black flex items-center gap-3">
            <Users className="w-6 h-6" /> Active Clients
          </h3>
          <span className="px-4 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-bold">{clients.length} Registered</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-50 dark:border-zinc-800/50">
                <th className="px-8 py-4">Store</th>
                <th className="px-8 py-4">Orders</th>
                <th className="px-8 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
              {clients.map(client => (
                <tr key={client.id} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-zinc-500">
                        {client.id.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-zinc-900 dark:text-white">{client.storeName || 'Unnamed Store'}</div>
                        <div className="text-[10px] text-zinc-400 font-medium">ID: {client.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{client.stats.orders}</span>
                  </td>
                  <td className="px-8 py-6">
                    <button
                      onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
                      className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Popup */}
      {selectedClient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedClient(null)}
        >
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-8 py-6 flex items-center justify-between rounded-t-[2.5rem] z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-lg text-zinc-500">
                  {selectedClient.id.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-white">{selectedClient.storeName || 'Unnamed Store'}</h2>
                  <p className="text-sm text-zinc-500 font-medium">{selectedClient.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-8">

              {/* Plan & Subscription */}
              {selectedClient.subscription && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">Subscription</h3>
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/5 rounded-2xl p-5 border border-emerald-200 dark:border-emerald-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      {(() => {
                        const Icon = planIcons[selectedClient.subscription?.planId] || Sparkles;
                        return <Icon className="w-5 h-5 text-emerald-600" />;
                      })()}
                      <span className="font-black text-lg text-zinc-900 dark:text-white capitalize">{selectedClient.subscription?.planId || 'Free'} Plan</span>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${selectedClient.subscription?.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                        {selectedClient.subscription?.status || 'unknown'}
                      </span>
                    </div>
                    {selectedClient.subscription?.currentPeriodEnd && (
                      <p className="text-sm text-zinc-500 font-medium">Renews: {new Date(selectedClient.subscription.currentPeriodEnd).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Store Info */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">Store Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InfoCard label="Store Name" value={selectedClient.storeName || '—'} />
                  <InfoCard label="Admin ID" value={selectedClient.id} mono />
                  <InfoCard label="Verified Email" value={selectedClient.verifiedEmail || '—'} icon={<Mail className="w-4 h-4" />} />
                  <InfoCard label="Phone" value={selectedClient.phone || '—'} icon={<Phone className="w-4 h-4" />} />
                  <InfoCard label="Address" value={selectedClient.address || '—'} />
                  <InfoCard label="Language" value={langName(selectedClient.language)} icon={<Globe className="w-4 h-4" />} />
                  <InfoCard label="JazzCash Number" value={selectedClient.jazzCashNumber || '—'} />
                  <InfoCard label="Advance Amount" value={selectedClient.advanceAmount ? `Rs.${selectedClient.advanceAmount}` : '—'} />
                  <InfoCard label="Onboarding Complete" value={selectedClient.onboardingComplete ? 'Yes' : 'No'} />
                </div>
              </div>

              {/* Channels / Social Accounts */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">Connected Channels</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <ChannelCard name="WhatsApp" connected={false} />
                  <ChannelCard name="Facebook" connected={selectedClient.channels?.facebook || false} />
                  <ChannelCard name="Instagram" connected={selectedClient.channels?.instagram || false} />
                  <ChannelCard name="Telegram" connected={selectedClient.channels?.telegram || false} />

                </div>
              </div>

              {/* Stats */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard label="Total Orders" value={selectedClient.stats?.orders ?? 0} icon={<ShoppingBag className="w-4 h-4" />} color="emerald" />
                  <StatCard label="Total Sales" value={`Rs.${(selectedClient.stats?.totalSales || 0).toLocaleString()}`} icon={<DollarSign className="w-4 h-4" />} color="violet" />
                  <StatCard label="Total Profit" value={`Rs.${(selectedClient.stats?.totalProfit || 0).toLocaleString()}`} icon={<TrendingUp className="w-4 h-4" />} color="blue" />
                  <StatCard label="Products" value={selectedClient.stats?.products ?? 0} icon={<Package className="w-4 h-4" />} color="amber" />
                  <StatCard label="Sessions" value={selectedClient.stats?.sessions ?? 0} icon={<MessageSquare className="w-4 h-4" />} color="indigo" />
                  <StatCard label="Pending Payments" value={selectedClient.stats?.pendingPayments ?? 0} icon={<AlertTriangle className="w-4 h-4" />} color="red" />
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value, icon, mono }: { label: string; value: string; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
      {icon && <span className="text-zinc-400">{icon}</span>}
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-bold text-zinc-900 dark:text-white truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

function ChannelCard({ name, connected }: { name: string; connected: boolean }) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-2xl border ${connected ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'}`}>
      {connected ? (
        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="w-5 h-5 text-zinc-300 dark:text-zinc-600 shrink-0" />
      )}
      <span className={`text-sm font-bold ${connected ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400'}`}>{name}</span>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    violet: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
  };
  return (
    <div className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colors[color] || colors.emerald}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-black text-zinc-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
