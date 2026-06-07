import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Plus, Save, X, Edit2, Trash2, Image, Package, CheckCircle, AlertCircle, Upload } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { motion, AnimatePresence } from 'motion/react';

interface TempProduct {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  features: string[];
  images: string[]; // base64 data URLs
  imagesPreviews: string[];
  editIndex: number | null;
}

export default function BulkImport() {
  const { success, error } = useToast();
  const [products, setProducts] = useState<TempProduct[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: { name: string; error: string }[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'inStock' | 'lowStock' | 'outOfStock'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: 'stock' | 'price' | 'name' | 'profit'; dir: 'asc' | 'desc' } | null>(null);

  // Refs for auto-focus on Enter
  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const costPriceRef = useRef<HTMLInputElement>(null);
  const stockRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formStock, setFormStock] = useState('10');
  const [formFeature, setFormFeature] = useState('');
  const [formFeatures, setFormFeatures] = useState<string[]>([]);
  const [formImages, setFormImages] = useState<{ dataUrl: string; name: string }[]>([]);

  const resetForm = () => {
    setFormName('');
    setFormPrice('');
    setFormCostPrice('');
    setFormStock('10');
    setFormFeature('');
    setFormFeatures([]);
    setFormImages([]);
    setEditingIndex(null);
    // Auto-focus back to name for next product entry
    nameRef.current?.focus();
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const maxImages = 5;
    const existing = formImages.length;
    const allowed = maxImages - existing;

    for (let i = 0; i < Math.min(files.length, allowed); i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        error(`Image "${file.name}" is too large (max 5MB)`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setFormImages(prev => [...prev, { dataUrl, name: file.name }]);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const removeFormImage = (index: number) => {
    setFormImages(prev => prev.filter((_, i) => i !== index));
  };

  const addFeature = () => {
    const f = formFeature.trim();
    if (f && !formFeatures.includes(f)) {
      setFormFeatures(prev => [...prev, f]);
      setFormFeature('');
    }
  };

  const removeFeature = (index: number) => {
    setFormFeatures(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddToList = () => {
    // Validate
    if (!formName.trim()) { error('Product name is required'); return; }
    const price = parseFloat(formPrice);
    if (isNaN(price) || price <= 0) { error('Sale price must be a valid number > 0'); return; }
    const costPrice = parseFloat(formCostPrice) || 0;
    const stock = parseInt(formStock) || 10;

    const newEntry: TempProduct = {
      id: crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: formName.trim(),
      price,
      costPrice,
      stock: Math.max(0, stock),
      features: [...formFeatures],
      images: formImages.map(img => img.dataUrl),
      imagesPreviews: formImages.map(img => img.dataUrl),
      editIndex: editingIndex,
    };

    if (editingIndex !== null) {
      // Update existing
      setProducts(prev => prev.map((p, i) => i === editingIndex ? newEntry : p));
    } else {
      // Add new
      setProducts(prev => [...prev, newEntry]);
    }

    resetForm();
  };

  const handleEdit = (index: number) => {
    const p = products[index];
    setFormName(p.name);
    setFormPrice(String(p.price));
    setFormCostPrice(String(p.costPrice));
    setFormStock(String(p.stock));
    setFormFeatures(p.features);
    setFormImages(p.images.map(url => ({ dataUrl: url, name: 'image' })));
    setEditingIndex(index);
  };

  const handleDelete = (index: number) => {
    setProducts(prev => prev.filter((_, i) => i !== index));
    if (editingIndex === index) resetForm();
  };

  const handleSaveAll = async () => {
    if (products.length === 0) { error('Add at least one product first'); return; }
    setSaving(true);
    setResult(null);

    try {
      const productsToSave = products.map(p => ({
        name: p.name,
        price: p.price,
        costPrice: p.costPrice,
        stock: p.stock,
        features: p.features,
        images: p.images,
        videos: [] as string[],
      }));

      const res = await axios.post('/api/products/bulk-save', { products: productsToSave });
      setResult(res.data);
      if (res.data.created > 0) {
        success(`✅ ${res.data.created} products saved successfully!`);
        if (res.data.created === products.length) {
          setProducts([]);
        }
      }
      if (res.data.errors?.length > 0) {
        const firstErr = res.data.errors[0];
        const errMsg = firstErr.error || 'Unknown error';
        error(`${res.data.errors.length} product(s) failed: ${firstErr.name} — ${errMsg}`);
      }
    } catch (err: any) {
      error(err.response?.data?.error || err.message || 'Failed to save products');
    } finally {
      setSaving(false);
    }
  };

  // Filtered + sorted products
  const filteredProducts = (() => {
    let filtered = [...products];

    // Stock filter
    if (stockFilter === 'inStock') {
      filtered = filtered.filter(p => p.stock > 5);
    } else if (stockFilter === 'lowStock') {
      filtered = filtered.filter(p => p.stock > 0 && p.stock <= 5);
    } else if (stockFilter === 'outOfStock') {
      filtered = filtered.filter(p => p.stock === 0);
    }

    // Sort
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aVal: number;
        let bVal: number;
        if (sortConfig.key === 'stock') {
          aVal = a.stock;
          bVal = b.stock;
        } else if (sortConfig.key === 'price') {
          aVal = a.price;
          bVal = b.price;
        } else if (sortConfig.key === 'profit') {
          aVal = a.price - a.costPrice;
          bVal = b.price - b.costPrice;
        } else {
          aVal = a.name.localeCompare(b.name);
          bVal = b.name.localeCompare(a.name);
        }
        if (aVal < bVal) return sortConfig.dir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  })();

  const totalCost = products.reduce((sum, p) => sum + p.price, 0);
  const totalInvestment = products.reduce((sum, p) => sum + p.costPrice, 0);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
          <Package className="w-7 h-7 text-violet-500" />
          Bulk Product Import
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Enter products one by one, then save all at once. Images can be picked directly from your device.
        </p>
      </div>

      {/* Product Entry Form */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
          {editingIndex !== null ? (
            <>✏️ Editing: <span className="text-violet-500">{formName}</span></>
          ) : '➕ Add Product'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Product Name *</label>
            <input
              ref={nameRef}
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); priceRef.current?.focus(); } }}
              placeholder="e.g. Smart Watch Pro"
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Sale Price (Rs.) *</label>
            <input
              ref={priceRef}
              type="number"
              value={formPrice}
              onChange={e => setFormPrice(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); costPriceRef.current?.focus(); } }}
              placeholder="e.g. 5000"
              min="0"
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Cost Price (Rs.)</label>
            <input
              ref={costPriceRef}
              type="number"
              value={formCostPrice}
              onChange={e => setFormCostPrice(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); stockRef.current?.focus(); } }}
              placeholder="e.g. 3500"
              min="0"
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Stock</label>
            <input
              ref={stockRef}
              type="number"
              value={formStock}
              onChange={e => setFormStock(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddToList(); } }}
              placeholder="10"
              min="0"
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
            />
          </div>
        </div>

        {/* Profit Analysis */}
        {formPrice && formCostPrice && parseFloat(formPrice) > 0 && parseFloat(formCostPrice) > 0 && (() => {
          const salePrice = parseFloat(formPrice);
          const costPrice = parseFloat(formCostPrice);
          const profit = salePrice - costPrice;
          const profitPercent = (profit / costPrice) * 100;
          const isHealthy = profitPercent >= 20;

          return (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={`mb-6 p-4 rounded-2xl border flex items-center justify-between transition-colors ${
                isHealthy
                  ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20'
                  : profitPercent >= 0
                    ? 'bg-amber-50 dark:bg-amber-500/5 border-amber-100 dark:border-amber-500/20'
                    : 'bg-rose-50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/20'
              }`}
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Estimated Profit</p>
                <p className={`text-xl font-black ${isHealthy ? 'text-emerald-500' : profitPercent >= 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                  {profit >= 0 ? 'Rs. ' : '-Rs. '}{Math.abs(profit).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  {profitPercent >= 20 ? 'Healthy Profit' : profitPercent >= 0 ? 'Low Profit' : 'Loss'}
                </p>
                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black mt-1 ${
                  profitPercent >= 20
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : profitPercent >= 0
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                      : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                }`}>
                  {profit > 0 ? '+' : ''}
                  {profitPercent.toFixed(1)}%
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* Features */}
        <div className="mb-6">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Features</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={formFeature}
              onChange={e => setFormFeature(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
              placeholder="Type a feature and press Enter"
              className="flex-1 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
            />
            <button onClick={addFeature} className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              + Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formFeatures.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 rounded-lg text-xs font-medium">
                {f}
                <button onClick={() => removeFeature(i)} className="hover:text-red-500 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Images */}
        <div className="mb-6">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">
            Product Images (up to 5, max 5MB each)
          </label>
          <div className="flex flex-wrap gap-3">
            {formImages.map((img, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 group">
                <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeFormImage(i)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {formImages.length < 5 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:border-violet-400 hover:text-violet-500 transition-colors cursor-pointer"
              >
                <Upload className="w-5 h-5" />
                <span className="text-[9px] font-medium">Add Image</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImagePick}
            className="hidden"
          />
        </div>

        <button
          onClick={handleAddToList}
          className="w-full py-3.5 bg-violet-500 hover:bg-violet-600 text-white rounded-2xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-5 h-5" />
          {editingIndex !== null ? 'Update Product in List' : 'Add Product to List'}
        </button>
      </div>

      {/* Products List */}
      <AnimatePresence>
        {products.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden"
          >
            <div className="p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Products Added ({products.length})
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Total Value: <span className="font-bold text-emerald-500">Rs. {totalCost.toLocaleString()}</span>
                  {' · '}Investment: <span className="font-bold text-zinc-500">Rs. {totalInvestment.toLocaleString()}</span>
                  {stockFilter !== 'all' && (
                    <span className="ml-2 text-violet-500">· Showing {filteredProducts.length}</span>
                  )}
                </p>
              </div>
              {/* Stock Filter Buttons */}
              <div className="flex items-center gap-1.5">
                {(['all', 'inStock', 'lowStock', 'outOfStock'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => { setStockFilter(option); }}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                      stockFilter === option
                        ? option === 'outOfStock'
                          ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                          : option === 'lowStock'
                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                            : option === 'inStock'
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                              : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {option === 'all' ? 'All' : option === 'inStock' ? 'In Stock' : option === 'lowStock' ? 'Low Stock' : 'Out of Stock'}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="text-left px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">#</th>
                    <th
                      className="text-left px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors select-none"
                      onClick={() => setSortConfig(prev => prev?.key === 'name' && prev.dir === 'asc' ? { key: 'name', dir: 'desc' } : { key: 'name', dir: 'asc' })}
                    >
                      Product {sortConfig?.key === 'name' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : '⇅'}
                    </th>
                    <th
                      className="text-right px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors select-none"
                      onClick={() => setSortConfig(prev => prev?.key === 'price' && prev.dir === 'asc' ? { key: 'price', dir: 'desc' } : { key: 'price', dir: 'asc' })}
                    >
                      Sale Price {sortConfig?.key === 'price' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : '⇅'}
                    </th>
                    <th className="text-right px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Cost</th>
                    <th
                      className="text-right px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors select-none"
                      onClick={() => setSortConfig(prev => prev?.key === 'profit' && prev.dir === 'asc' ? { key: 'profit', dir: 'desc' } : { key: 'profit', dir: 'asc' })}
                    >
                      Profit {sortConfig?.key === 'profit' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : '⇅'}
                    </th>
                    <th
                      className="text-right px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors select-none"
                      onClick={() => setSortConfig(prev => prev?.key === 'stock' && prev.dir === 'asc' ? { key: 'stock', dir: 'desc' } : { key: 'stock', dir: 'asc' })}
                    >
                      Stock {sortConfig?.key === 'stock' ? (sortConfig.dir === 'asc' ? '↑' : '↓') : '⇅'}
                    </th>
                    <th className="text-center px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Images</th>
                    <th className="text-right px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-zinc-400 font-mono text-xs">{i + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {p.imagesPreviews[0] ? (
                            <img src={p.imagesPreviews[0]} alt="" className="w-10 h-10 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                              <Image className="w-5 h-5 text-zinc-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-white">{p.name}</p>
                            {p.features.length > 0 && (
                              <p className="text-[10px] text-zinc-400 mt-0.5">{p.features.slice(0, 2).join(', ')}{p.features.length > 2 ? '...' : ''}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-zinc-900 dark:text-white">Rs. {p.price.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-zinc-500">Rs. {p.costPrice.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        {p.costPrice > 0 ? (() => {
                          const profit = p.price - p.costPrice;
                          const profitPercent = (profit / p.costPrice) * 100;
                          const isHealthy = profitPercent >= 20;
                          return (
                            <div className="flex flex-col items-end">
                              <span className={`font-bold text-sm ${isHealthy ? 'text-emerald-500' : profitPercent >= 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                                {profit >= 0 ? '+' : ''}Rs. {profit.toLocaleString()}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isHealthy
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                  : profitPercent >= 0
                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                    : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                              }`}>
                                {profit > 0 ? '+' : ''}{profitPercent.toFixed(1)}%
                              </span>
                            </div>
                          );
                        })() : <span className="text-zinc-400 text-xs">—</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-bold ${
                          p.stock === 0
                            ? 'text-red-500'
                            : p.stock <= 5
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                        }`}>{p.stock}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs text-zinc-400">{p.imagesPreviews.length} 📸</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(i)}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-violet-500 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(i)}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-zinc-400 hover:text-red-500 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-white rounded-2xl font-bold text-base transition-all hover:scale-[1.01] active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3"
              >
                {saving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save All ({products.length} Products)
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-zinc-900 dark:text-white">Save Results</h3>
              <button onClick={() => setResult(null)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-emerald-500">{result.created}</p>
                <p className="text-[11px] text-zinc-500 font-medium">Created</p>
              </div>
              <div className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-red-500">{result.errors.length}</p>
                <p className="text-[11px] text-zinc-500 font-medium">Errors</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-4 bg-red-50 dark:bg-red-950/30 rounded-xl p-3 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600 dark:text-red-400 font-mono">{e.name}: {e.error}</p>
                ))}
              </div>
            )}
            {result.created > 0 && products.length === 0 && (
              <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">All products saved! Add more or go to Products tab to view them.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {products.length === 0 && !result && (
        <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
            <Package className="w-10 h-10 text-zinc-300" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">No Products Added Yet</h3>
          <p className="text-zinc-500 max-w-md">
            Fill in the product details above and click <strong>"Add Product to List"</strong> to add products.
            When you're done, click <strong>"Save All"</strong> to save everything at once.
          </p>
        </div>
      )}
    </div>
  );
}
