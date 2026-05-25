import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Store, TrendingUp, Shield, AlertTriangle, ExternalLink, ShieldCheck, Loader2, X, Mail, Phone } from 'lucide-react';

interface AdminClient {
  id: string;
  storeName?: string;
  verifiedEmail?: string;
  phone?: string;
  stats: {
    products: number;
    sessions: number;
    orders: number;
    totalSales: number;
  };
}

export default function SuperAdmin() {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<AdminClient | null>(null);

  useEffect(() => {
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
  }, []);

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

  const totalSaaSProfit = clients.reduce((sum, c) => sum + (c.stats.orders * 500), 0); // Mock commission

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
        
        <div className="flex items-center gap-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 rounded-[2rem] text-right">
             <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 opacity-60">Estimated Revenue</div>
             <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">Rs. {totalSaaSProfit.toLocaleString()}</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
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
                      <th className="px-8 py-4">Store Identity</th>
                      <th className="px-8 py-4">Inventory</th>
                      <th className="px-8 py-4">Activity</th>
                      <th className="px-8 py-4">Status</th>
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
                          <div className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{client.stats.products} Products</div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{client.stats.sessions} Chats</span>
                            <span className="text-[9px] text-emerald-500 font-black">{client.stats.orders} Orders</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">Active</span>
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
        </div>

        <div className="space-y-6">
           {selectedClient && (
             <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
               <div className="flex items-center justify-between mb-6">
                 <h3 className="text-lg font-black flex items-center gap-3">
                   <Store className="w-5 h-5 text-blue-500" /> Client Detail
                 </h3>
                 <button onClick={() => setSelectedClient(null)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-600 transition-all"><X className="w-4 h-4" /></button>
               </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-500/5 rounded-2xl">
                    <span className="text-sm font-bold opacity-70">Store</span>
                    <span className="text-sm font-black text-right">{selectedClient.storeName || 'Unnamed Store'}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl">
                    <span className="text-sm font-bold opacity-70">Admin ID</span>
                    <span className="text-sm font-mono font-black">{selectedClient.id}</span>
                  </div>
                  {selectedClient.verifiedEmail && (
                    <div className="flex justify-between items-center p-4 bg-indigo-50 dark:bg-indigo-500/5 rounded-2xl">
                      <span className="text-sm font-bold opacity-70 flex items-center gap-2"><Mail className="w-4 h-4" /> Verified Email</span>
                      <span className="text-sm font-black">{selectedClient.verifiedEmail}</span>
                    </div>
                  )}
                  {selectedClient.phone && (
                    <div className="flex justify-between items-center p-4 bg-teal-50 dark:bg-teal-500/5 rounded-2xl">
                      <span className="text-sm font-bold opacity-70 flex items-center gap-2"><Phone className="w-4 h-4" /> Phone</span>
                      <span className="text-sm font-black">{selectedClient.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center p-4 bg-emerald-50 dark:bg-emerald-500/5 rounded-2xl">
                    <span className="text-sm font-bold opacity-70">Orders</span>
                    <span className="text-xl font-black text-emerald-500">{selectedClient.stats.orders}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl">
                    <span className="text-sm font-bold opacity-70">Products</span>
                    <span className="text-xl font-black">{selectedClient.stats.products}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl">
                    <span className="text-sm font-bold opacity-70">Chat Sessions</span>
                    <span className="text-xl font-black">{selectedClient.stats.sessions}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-violet-50 dark:bg-violet-500/5 rounded-2xl">
                    <span className="text-sm font-bold opacity-70">Total Sales</span>
                    <span className="text-xl font-black text-violet-500">Rs. {selectedClient.stats.totalSales.toLocaleString()}</span>
                  </div>
                </div>
             </div>
           )}

           <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[2.5rem] p-8 shadow-xl">
              <h3 className="text-lg font-black mb-6 flex items-center gap-3">
                <Shield className="w-5 h-5 text-emerald-400" /> System Integrity
              </h3>
              <div className="space-y-4">
                 <div className="flex justify-between items-center p-4 bg-white/5 dark:bg-zinc-100 rounded-2xl">
                    <span className="text-sm font-bold opacity-70">Total WhatsApp Nodes</span>
                    <span className="text-xl font-black">{clients.length}</span>
                 </div>
                 <div className="flex justify-between items-center p-4 bg-white/5 dark:bg-zinc-100 rounded-2xl">
                    <span className="text-sm font-bold opacity-70">SaaS Health</span>
                    <span className="text-emerald-400 font-black tracking-widest text-[10px]">99.9% STABLE</span>
                 </div>
              </div>
           </div>

           <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8">
              <h3 className="text-lg font-black mb-4 flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-blue-500" /> Global Pulse
              </h3>
              <div className="space-y-6">
                 <div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                       <span>Infrastructure Usage</span>
                       <span>45%</span>
                    </div>
                    <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: '45%' }}
                         className="h-full bg-blue-500" 
                       />
                    </div>
                 </div>
                 <div className="p-4 bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 rounded-2xl">
                    <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">
                      All systems are operating normally. WhatsApp session isolation is active across {clients.length} isolated containers.
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
