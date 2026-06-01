import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { History, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';

interface AuditLogEntry {
  id: number;
  adminId: string;
  memberId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: any;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [offset]);

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`/api/audit?limit=${limit}&offset=${offset}`);
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch {
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const filteredLogs = search
    ? logs.filter(l =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.entity.toLowerCase().includes(search.toLowerCase()) ||
        (l.entityId && l.entityId.toLowerCase().includes(search.toLowerCase())) ||
        (l.ipAddress && l.ipAddress.toLowerCase().includes(search.toLowerCase()))
      )
    : logs;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-500" /> Audit Logs
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Track all administrative actions across your store</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 rounded-xl outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 w-64"
          />
        </div>
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-500 text-sm font-bold bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900 py-3 px-4 rounded-2xl mb-4"
        >
          {error}
        </motion.p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64 text-zinc-400 text-sm font-medium">Loading audit logs...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-12 text-center">
          <History className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-1">No audit logs found</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Actions will appear here as they are performed</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  {['Action', 'Entity', 'Entity ID', 'Details', 'IP Address', 'Date'].map(h => (
                    <th key={h} className="text-left px-5 py-4 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, i) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold ${
                        log.action === 'create' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' :
                        log.action === 'update' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400' :
                        log.action === 'delete' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' :
                        log.action === 'block' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400' :
                        log.action === 'unblock' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400' :
                        'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 capitalize">{log.entity}</span>
                    </td>
                    <td className="px-5 py-4">
                      {log.entityId ? (
                        <span className="text-sm text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">{log.entityId}</span>
                      ) : (
                        <span className="text-sm text-zinc-400 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {log.details ? (
                        <span className="text-sm text-zinc-500 dark:text-zinc-400 text-[11px] max-w-[200px] truncate block">
                          {typeof log.details === 'string' ? log.details : JSON.stringify(log.details).slice(0, 80)}
                        </span>
                      ) : (
                        <span className="text-sm text-zinc-400 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {log.ipAddress ? (
                        <span className="text-sm text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">{log.ipAddress}</span>
                      ) : (
                        <span className="text-sm text-zinc-400 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-500 dark:text-zinc-400 text-[11px] whitespace-nowrap">{formatDate(log.createdAt)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="font-medium">Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={offset === 0}
                onClick={() => setOffset(prev => Math.max(0, prev - limit))}
                className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </motion.button>
              <span className="font-bold text-zinc-700 dark:text-zinc-300 min-w-[4rem] text-center">{currentPage} / {totalPages || 1}</span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={offset + limit >= total}
                onClick={() => setOffset(prev => prev + limit)}
                className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
