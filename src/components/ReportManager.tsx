import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Download, TrendingUp, Banknote, ShoppingBag, ArrowRight, BarChart3, FileText, Sparkles, AlertCircle, X } from 'lucide-react';

interface ReportData {
  revenue: number;
  cost: number;
  profit: number;
  orderCount: number;
  from: string;
  to: string;
}

export default function ReportManager() {
  const [fromDate, setFromDate] = useState(() => localStorage.getItem('reportFromDate') || new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(() => localStorage.getItem('reportToDate') || new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [noDataError, setNoDataError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    const pendingFrom = localStorage.getItem('pendingReportFrom');
    const pendingTo = localStorage.getItem('pendingReportTo');

    if (pendingFrom && pendingTo) {
      // Clear pending so it only happens once per click
      localStorage.removeItem('pendingReportFrom');
      localStorage.removeItem('pendingReportTo');
      
      // Delay fetching slightly to allow page to load and trigger the full entry animation
      setTimeout(() => {
        generateReport(pendingFrom, pendingTo);
      }, 300);
    }
  }, []);

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFromDate(e.target.value);
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToDate(e.target.value);
  };

  const validateDates = (from: string, to: string): string | null => {
    if (!from || !to) return 'Please select both From and To dates.';
    if (from > today) return 'Future date is not allowed for the "From" field.';
    if (to > today) return 'Future date is not allowed for the "To" field.';
    if (from > to) return '"From" date cannot be after "To" date. Please select a valid range.';
    return null;
  };

  const generateReport = async (overrideFrom?: string, overrideTo?: string) => {
    const f = overrideFrom || fromDate;
    const t = overrideTo || toDate;
    if (!f || !t) return;
    
    const validationError = validateDates(f, t);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setLoading(true);
    setReport(null);
    setNoDataError(false);

    try {
      const res = await axios.get(`/api/stats/report?from=${f}&to=${t}`);
      if (res.data.orderCount === 0) {
        setNoDataError(true);
        setReport(null);
      } else {
        setNoDataError(false);
        setReport(res.data);
      }
    } catch (err) {
      console.error('Failed to generate report:', err);
      setErrorMessage('Failed to generate report. Check server connection.');
      setNoDataError(false);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateClick = () => {
    const validationError = validateDates(fromDate, toDate);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    if (!fromDate || !toDate) return;
    
    // Save dates to generate on reload
    localStorage.setItem('pendingReportFrom', fromDate);
    localStorage.setItem('pendingReportTo', toDate);
    
    // Clear input cache so inputs are empty after reload
    localStorage.removeItem('reportFromDate');
    localStorage.removeItem('reportToDate');
    
    // Refresh page
    window.location.reload();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12">
      {/* Error Toast */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 max-w-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-red-800 dark:text-red-200 text-sm">Invalid Date Selection</p>
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errorMessage}</p>
              </div>
              <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-red-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex justify-between items-end">
        <div>
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-2"
          >
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 tracking-tight">
              Profit Reports
            </h1>
          </motion.div>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            Calculate custom period performance & net margins
          </p>
        </div>
      </header>

      {/* Date Selection Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
        <div className="flex flex-col md:flex-row items-end gap-6">
            <div className="flex-1 space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400 ml-1">
              From Date
              {fromDate === today && (
                <span className="text-red-500 ml-2">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block mr-1" />
                  Today
                </span>
              )}
            </label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="date" 
                value={fromDate}
                onChange={handleFromChange}
                max={today}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch (err) {}
                }}
                className={`w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 pl-12 text-zinc-800 dark:text-zinc-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all cursor-pointer ${
                  fromDate === today ? 'ring-2 ring-red-400 dark:ring-red-500/50' : ''
                }`}
              />
            </div>
          </div>

          <div className="hidden md:flex items-center justify-center h-14">
            <ArrowRight className="w-5 h-5 text-zinc-300" />
          </div>

          <div className="flex-1 space-y-2">
            <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400 ml-1">
              To Date
              {toDate === today && (
                <span className="text-red-500 ml-2">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block mr-1" />
                  Today
                </span>
              )}
            </label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="date" 
                value={toDate}
                onChange={handleToChange}
                max={today}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch (err) {}
                }}
                className={`w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 pl-12 text-zinc-800 dark:text-zinc-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all cursor-pointer ${
                  toDate === today ? 'ring-2 ring-red-400 dark:ring-red-500/50' : ''
                }`}
              />
            </div>
          </div>

          <button 
            onClick={handleGenerateClick}
            disabled={loading || !fromDate || !toDate}
            className="px-10 h-[60px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 shadow-xl flex items-center gap-3 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-white/20 dark:bg-black/10 translate-y-full group-hover:translate-y-0 transition-transform" />
            <span className="relative z-10">{loading ? 'Calculating...' : 'Generate Report'}</span>
          </button>
        </div>
      </div>

      {/* Report View */}
      <AnimatePresence mode="wait">
        {report && (
          <motion.div 
            key="report-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-8">
                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-3">Total Revenue</p>
                <p className="text-3xl font-black text-zinc-900 dark:text-white">Rs. {report.revenue.toLocaleString()}</p>
              </div>
              <div className="bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-[2rem] p-8">
                <p className="text-[10px] font-bold text-blue-400 dark:text-blue-500 uppercase tracking-[0.2em] mb-3">Net Profit</p>
                <p className="text-3xl font-black text-blue-600 dark:text-blue-400">Rs. {report.profit.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-[2rem] p-8">
                <p className="text-[10px] font-bold text-emerald-400 dark:text-emerald-500 uppercase tracking-[0.2em] mb-3">Orders Verified</p>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{report.orderCount}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 print:border-none print:shadow-none">
              <div className="flex justify-between items-start mb-12">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">Performance Summary</h2>
                  <p className="text-zinc-500">{new Date(report.from).toLocaleDateString()} - {new Date(report.to).toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={handlePrint}
                  className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl hover:bg-zinc-200 transition-colors print:hidden"
                >
                  <Download className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center py-4 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500 font-medium">Gross Revenue</span>
                  <span className="text-xl font-bold text-zinc-900 dark:text-white">Rs. {report.revenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-4 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500 font-medium">Total Cost of Goods</span>
                  <span className="text-xl font-bold text-rose-500">- Rs. {report.cost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-6">
                  <span className="text-xl font-black text-zinc-900 dark:text-white">Net Profit (Take Home)</span>
                  <div className="text-right">
                    <span className="text-3xl font-black text-blue-600 dark:text-blue-400">Rs. {report.profit.toLocaleString()}</span>
                    <p className="text-xs text-zinc-400 font-medium mt-1">Margin: {report.revenue > 0 ? Math.round((report.profit / report.revenue) * 100) : 0}%</p>
                  </div>
                </div>
              </div>

              <div className="mt-12 p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl flex items-center gap-4 border border-dashed border-zinc-200 dark:border-zinc-700">
                <TrendingUp className="w-6 h-6 text-emerald-500" />
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  During this period, you processed <span className="font-bold text-zinc-900 dark:text-white">{report.orderCount} orders</span> with an average order value of <span className="font-bold text-zinc-900 dark:text-white">Rs. {report.orderCount > 0 ? Math.round(report.revenue / report.orderCount).toLocaleString() : 0}</span>.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!report && !loading && !noDataError && !errorMessage && (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-10 h-10 text-zinc-300" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">No Report Generated</h3>
          <p className="text-zinc-500 max-w-xs">Select a date range above to calculate your net profit and business performance.</p>
        </div>
      )}

      {noDataError && !loading && (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-10 h-10 text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">No Records Found</h3>
          <p className="text-zinc-500 max-w-xs">There are no orders verified within the selected date range. Please try selecting a different date.</p>
        </div>
      )}
    </div>
  );
}
