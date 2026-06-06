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
        error(`${res.data.errors.length} products failed to save`);
      }
    } catch (err: any) {
      error(err.response?.data?.error || err.message || 'Failed to save products');
    } finally {
      setSaving(false);
    }
  };

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
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="e.g. Smart Watch Pro"
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Sale Price (Rs.) *</label>
            <input
              type="number"
              value={formPrice}
              onChange={e => setFormPrice(e.target.value)}
              placeholder="e.g. 5000"
              min="0"
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Cost Price (Rs.)</label>
            <input
              type="number"
              value={formCostPrice}
              onChange={e => setFormCostPrice(e.target.value)}
              placeholder="e.g. 3500"
              min="0"
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Stock</label>
            <input
              type="number"
              value={formStock}
              onChange={e => setFormStock(e.target.value)}
              placeholder="10"
              min="0"
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
            />
          </div>
        </div>

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
            <div className="p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Products Added ({products.length})
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Total Value: <span className="font-bold text-emerald-500">Rs. {totalCost.toLocaleString()}</span>
                  {' · '}Investment: <span className="font-bold text-zinc-500">Rs. {totalInvestment.toLocaleString()}</span>
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="text-left px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">#</th>
                    <th className="text-left px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Product</th>
                    <th className="text-right px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sale Price</th>
                    <th className="text-right px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Cost</th>
                    <th className="text-right px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Stock</th>
                    <th className="text-center px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Images</th>
                    <th className="text-right px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
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
                        <span className={`font-bold ${p.stock === 0 ? 'text-red-500' : 'text-zinc-700 dark:text-zinc-300'}`}>{p.stock}</span>
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
