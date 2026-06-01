import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, FileText, CheckCircle, AlertCircle, X, Download } from 'lucide-react';
import { useToast } from '../hooks/useToast';

export default function BulkImport() {
  const { success, error } = useToast();
  const [data, setData] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ created: number; errors: { row: number; error: string }[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePaste = async () => {
    if (!data.trim()) { error('Please paste CSV or JSON data'); return; }
    setLoading(true);
    try {
      const res = await axios.post('/api/bulk-import/products', { data, format: data.trim().startsWith('[') ? 'json' : 'csv' });
      setResult(res.data);
      success(`Created ${res.data.created} products`);
    } catch (err: any) {
      error(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  const handleFileUpload = async () => {
    if (!file) { error('Please select a file'); return; }
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    try {
      const res = await axios.post('/api/bulk-import/products/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data);
      success(`Created ${res.data.created} products from ${res.data.filename}`);
    } catch (err: any) {
      error(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Bulk Import Products</h1>
        <p className="text-sm text-zinc-500 mt-1">Import multiple products at once using CSV or JSON</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Paste CSV/JSON */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Paste CSV/JSON</h3>
              <p className="text-[11px] text-zinc-500">Copy from Excel/Sheets</p>
            </div>
          </div>
          <textarea
            value={data}
            onChange={e => setData(e.target.value)}
            placeholder={`name,price,costPrice,stock\nProduct A,1000,700,10\nProduct B,2000,1500,5`}
            className="w-full h-40 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
          />
          <button onClick={handlePaste} disabled={loading}
            className="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors disabled:opacity-50">
            {loading ? 'Importing...' : 'Import Data'}
          </button>
        </div>

        {/* Upload File */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Upload File</h3>
              <p className="text-[11px] text-zinc-500">CSV or JSON file</p>
            </div>
          </div>
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
            onClick={() => fileRef.current?.click()}
            className="w-full h-40 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors"
          >
            {file ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle className="w-5 h-5" />
                {file.name}
              </div>
            ) : (
              <div className="text-center">
                <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-sm text-zinc-500 font-medium">Drop file here or click to browse</p>
                <p className="text-[11px] text-zinc-400 mt-1">CSV or JSON, max 5MB</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.json" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
          <button onClick={handleFileUpload} disabled={loading || !file}
            className="w-full py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50">
            {loading ? 'Uploading...' : 'Upload & Import'}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-zinc-900 dark:text-white">Import Results</h3>
            <button onClick={() => setResult(null)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-emerald-500">{result.created}</p>
              <p className="text-[11px] text-zinc-500 font-medium">Created</p>
            </div>
            <div className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-red-500">{result.errors.length}</p>
              <p className="text-[11px] text-zinc-500 font-medium">Errors</p>
            </div>
            <div className="flex-1 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-zinc-600 dark:text-zinc-300">{result.total}</p>
              <p className="text-[11px] text-zinc-500 font-medium">Total</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3 max-h-32 overflow-y-auto">
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600 dark:text-red-400 font-mono">
                  Row {e.row}: {e.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Template */}
      <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-zinc-900 dark:text-white">CSV Template</h3>
          <button onClick={() => {
            const csv = 'name,price,costPrice,stock\nExample Product,1500,1000,20\nAnother Product,2500,1800,15';
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'products-template.csv'; a.click();
            URL.revokeObjectURL(url);
          }} className="flex items-center gap-1.5 text-xs text-blue-500 font-bold hover:text-blue-600">
            <Download className="w-3.5 h-3.5" /> Download Template
          </button>
        </div>
        <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-800/50 rounded-xl p-4 overflow-x-auto">
          {`name,price,costPrice,stock\n"Product A",1000,700,10\n"Product B",2000,1500,5\n"Product C",500,300,20`}
        </pre>
      </div>
    </div>
  );
}
