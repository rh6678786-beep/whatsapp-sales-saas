import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { SalesState, Session, formatUserId } from '../types';
import { CheckCircle, XCircle, Eye, CornerUpLeft, Truck, Send, Loader2, Calendar, DollarSign, CreditCard, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SearchBar from './SearchBar';

export default function OrderVerifier() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [trackingModalOpen, setTrackingModalOpen] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState('');
  const [courier, setCourier] = useState('Postex');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');

  const fetchSessions = async () => {
    try {
      const params = new URLSearchParams();
      if (stateFilter && stateFilter !== 'all') params.set('state', stateFilter);
      if (search) params.set('search', search);
      const qs = params.toString();
      const res = await axios.get(`/api/sessions${qs ? `?${qs}` : ''}`);
      const allSessions: Session[] = res.data.data ?? res.data;
      const verificationSessions = allSessions.filter((s: Session) => 
        [SalesState.PAYMENT_AWAITING, SalesState.PAYMENT_SENT, SalesState.VERIFIED, SalesState.ORDER_CONFIRMED].includes(s.state)
      );
      
      setSessions(verificationSessions);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 15000);
    return () => clearInterval(interval);
  }, [search, stateFilter]);

  const handleVerify = async (userId: string) => {
    try {
      await axios.patch(`/api/sessions/${userId}`, { state: SalesState.VERIFIED });
      fetchSessions();
    } catch (e) {
      console.error("Failed to verify payment:", e);
    }
  };

  const handleReject = async (userId: string) => {
    const reason = prompt('Reason for rejection (Optional - leave blank for AI to auto-think):');
    // If user clicks Cancel, don't do anything. If they click OK with empty string, proceed with AI.
    if (reason === null) return; 

    try {
      await axios.patch(`/api/sessions/${userId}`, { 
        state: SalesState.NEGOTIATING,
        reason: reason || undefined
      });
      fetchSessions();
    } catch (e) {
      alert('Failed to reject payment.');
    }
  };

  const handleConfirmOrder = async (userId: string) => {
    try {
      await axios.patch(`/api/sessions/${userId}`, { state: SalesState.ORDER_CONFIRMED });
      fetchSessions();
    } catch (e) {
      console.error("Failed to confirm order:", e);
    }
  };

  const analyzeScreenshot = async (imageBase64: string) => {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await axios.post('/api/payment/analyze-screenshot', { imageBase64 });
      setAnalysis(res.data);
    } catch (err) {
      console.error('Analysis failed:', err);
      setAnalysis({ error: 'Failed to analyze' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleViewImage = (imageUrl: string | undefined) => {
    if (!imageUrl) return;
    setViewingImage(imageUrl);
    setAnalysis(null);
    if (imageUrl.includes('base64,')) {
      const base64 = imageUrl.split('base64,')[1];
      analyzeScreenshot(base64);
    }
  };

  const handleAddTracking = async (userId: string) => {
    if (!trackingId) return alert('Please enter tracking ID');
    try {
      // Pass the userId as the order id here since userId matches session/order id in mock
      await axios.post(`/api/orders/${userId}/tracking`, {
        trackingId,
        courier,
        userId
      });
      alert('Tracking info sent to customer via WhatsApp! 🚀');
      setTrackingModalOpen(null);
      setTrackingId('');
      fetchSessions();
    } catch (e) {
      alert('Failed to send tracking info. Check server console.');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 transition-colors">
      <header>
        <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400">Payment & Order Verification</h2>
        <p className="text-zinc-500 dark:text-zinc-400 italic font-serif mt-2 transition-colors">Directly control the lifecycle of customer conversions</p>
      </header>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-sm">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by userId..." />
        </div>
        <select
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          className="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
        >
          <option value="all">All States</option>
          <option value="PAYMENT_AWAITING">Payment Awaiting</option>
          <option value="PAYMENT_SENT">Payment Sent</option>
          <option value="VERIFIED">Verified</option>
          <option value="ORDER_CONFIRMED">Order Confirmed</option>
        </select>
      </div>

      {/* Image Viewer Modal */}
      <AnimatePresence>
        {viewingImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingImage(null)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full bg-white dark:bg-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <span className="text-sm font-black uppercase tracking-widest text-zinc-400">Payment Verification Screenshot</span>
                <button 
                  onClick={() => setViewingImage(null)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6 text-zinc-400" />
                </button>
              </div>
              <div className="p-2 bg-zinc-100 dark:bg-zinc-950 flex justify-center items-center min-h-[400px]">
                <img 
                  src={viewingImage} 
                  alt="Payment Verification" 
                  className="max-h-[70vh] object-contain rounded-2xl shadow-lg"
                />
              </div>
              
              {/* Analysis Results */}
              <div className="px-6 pb-4">
                {analyzing ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-zinc-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-medium">Analyzing screenshot...</span>
                  </div>
                ) : analysis ? (
                  analysis.error ? (
                    <div className="text-red-500 text-sm text-center py-2">{analysis.error}</div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-3 border border-purple-200 dark:border-purple-500/20">
                        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                          <Calendar className="w-4 h-4" />
                          <span className="text-xs font-bold">Date</span>
                        </div>
                        <span className="text-sm font-black text-zinc-900 dark:text-white">{analysis.date || 'N/A'}</span>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3 border border-emerald-200 dark:border-emerald-500/20">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                          <DollarSign className="w-4 h-4" />
                          <span className="text-xs font-bold">Amount</span>
                        </div>
                        <span className="text-sm font-black text-zinc-900 dark:text-white">Rs. {analysis.amount || 'N/A'}</span>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-3 border border-blue-200 dark:border-blue-500/20">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                          <CreditCard className="w-4 h-4" />
                          <span className="text-xs font-bold">Method</span>
                        </div>
                        <span className="text-sm font-black text-zinc-900 dark:text-white">{analysis.method || 'N/A'}</span>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3 border border-amber-200 dark:border-amber-500/20">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                          <User className="w-4 h-4" />
                          <span className="text-xs font-bold">Sender</span>
                        </div>
                        <span className="text-sm font-black text-zinc-900 dark:text-white">{analysis.sender || 'N/A'}</span>
                      </div>
                      {analysis.notes && analysis.notes !== 'None' && (
                        <div className="col-span-2 md:col-span-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3">
                          <span className="text-xs font-bold text-zinc-500">Notes: </span>
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">{analysis.notes}</span>
                        </div>
                      )}
                    </div>
                  )
                ) : null}
              </div>
              
              <div className="p-6 bg-white dark:bg-zinc-900 flex justify-center">
                <button 
                  onClick={() => setViewingImage(null)}
                  className="px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black transition-all hover:scale-105"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
        
        <div className="relative bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-zinc-100/50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800 transition-colors">
                  <th className="px-6 py-5 text-left text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-bold">Customer ID</th>
                  <th className="px-6 py-5 text-left text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-bold">Current State</th>
                  <th className="px-6 py-5 text-left text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-bold">Screenshot</th>
                  <th className="px-6 py-5 text-right text-[11px] uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {sessions.map((session) => (
                  <React.Fragment key={session.id}>
                  <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-all duration-300 group/row relative">
                    <td className="px-6 py-6">
                      <span className="font-mono text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors shadow-inner">
                        {formatUserId(session.userId)}
                      </span>
                    </td>
                    <td className="px-6 py-6">
                       <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border shadow-sm transition-all duration-300 ${
                        session.state === SalesState.PAYMENT_SENT ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/50 shadow-amber-500/20 glow-amber' :
                        session.state === SalesState.VERIFIED ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/50 shadow-blue-500/20 glow-blue' :
                        'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/50 shadow-emerald-500/20 glow-emerald'
                      }`}>
                        {session.state}
                      </span>
                    </td>
                    <td className="px-6 py-6">
                      {session.metadata?.paymentScreenshot ? (
                        <button 
                          onClick={() => handleViewImage(session.metadata?.paymentScreenshot)}
                          className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-blue-500 dark:hover:text-blue-400 text-xs font-bold transition-all shadow-sm hover:shadow-blue-500/20 hover:border-blue-500/30 border border-transparent"
                        >
                          <Eye className="w-4 h-4" /> View Image
                        </button>
                      ) : session.state === SalesState.PAYMENT_SENT ? (
                         <span className="text-zinc-400 text-[10px] italic">No image saved</span>
                      ) : <span className="text-zinc-300 dark:text-zinc-600 text-xs italic font-medium">Verified ✓</span>}
                    </td>
                    <td className="px-6 py-6 text-right">
                      <div className="flex justify-end gap-3">
                        {session.state === SalesState.PAYMENT_SENT && (
                          <>
                            <button 
                              onClick={() => handleReject(session.id)}
                              className="p-2.5 text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-500 hover:text-white rounded-xl transition-all duration-300 hover:scale-110 border border-red-200 dark:border-red-500/30 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                              title="Reject Payment"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleVerify(session.id)}
                              className="p-2.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-500 hover:text-white rounded-xl transition-all duration-300 hover:scale-110 border border-emerald-200 dark:border-emerald-500/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                              title="Verify Payment"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        {session.state === SalesState.VERIFIED && (
                          <button 
                            onClick={() => handleConfirmOrder(session.id)}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-[0_0_15px_rgba(79,70,229,0.4)] hover:shadow-[0_0_25px_rgba(79,70,229,0.6)] transition-all flex items-center gap-2 hover:scale-105 border border-indigo-400/50"
                          >
                            <CheckCircle className="w-4 h-4" /> Confirm Order
                          </button>
                        )}
                        {session.state === SalesState.ORDER_CONFIRMED && (
                          <button 
                            onClick={() => setTrackingModalOpen(trackingModalOpen === session.id ? null : session.id)}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:shadow-[0_0_25px_rgba(16,185,129,0.6)] transition-all flex items-center gap-2 hover:scale-105 border border-teal-400/50"
                          >
                            <Truck className="w-4 h-4" /> Add Tracking
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  
                  {/* Tracking Input Row */}
                  <AnimatePresence>
                    {trackingModalOpen === session.id && (
                      <motion.tr 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800"
                      >
                        <td colSpan={4} className="px-6 py-4">
                          <div className="flex items-end justify-end gap-4 p-4 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700">
                            <div className="flex-1 max-w-xs">
                              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1">Courier Service</label>
                              <select 
                                value={courier} 
                                onChange={e => setCourier(e.target.value)}
                                className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-xl text-sm p-3 font-medium text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                              >
                                <option value="Postex">Postex</option>
                                <option value="TCS">TCS</option>
                                <option value="Leopards">Leopards</option>
                                <option value="CallCourier">CallCourier</option>
                                <option value="M&P">M&P</option>
                              </select>
                            </div>
                            <div className="flex-1 max-w-sm">
                              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1">Tracking ID</label>
                              <input 
                                type="text" 
                                value={trackingId}
                                onChange={e => setTrackingId(e.target.value)}
                                placeholder="Enter tracking number..."
                                className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-xl text-sm p-3 font-mono text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                              />
                            </div>
                            <button 
                              onClick={() => handleAddTracking(session.userId)}
                              className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50"
                              disabled={!trackingId}
                            >
                              <Send className="w-4 h-4" /> Send to Customer
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                  </React.Fragment>
                ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-24 text-center text-zinc-400 dark:text-zinc-500 italic">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <CornerUpLeft className="w-8 h-8 opacity-50" />
                      <p>No orders pending verification.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
