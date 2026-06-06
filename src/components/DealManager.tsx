import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Deal, Product } from '../types';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Edit2, Tag, X, Sparkles, Save, ChevronLeft, ChevronRight, Package, Calendar, DollarSign, Image, Eye, EyeOff, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TableSkeleton } from './Skeleton';

export default function DealManager() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [formData, setFormData] = useState<Partial<Deal>>({
    title: '',
    description: '',
    productIds: [],
    discountPrice: null,
    image: '',
    startDate: null,
    endDate: null,
    isActive: true,
  });
  const [error, setError] = useState<string | null>(null);

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/deals');
      setDeals(res.data);
    } catch (err: any) {
      toast.error('Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get('/api/products?page=1&limit=500');
      setProducts(res.data.products || []);
    } catch (err: any) {
      toast.error('Failed to load products');
    }
  };

  useEffect(() => {
    fetchDeals();
    fetchProducts();
  }, []);

  const openAddModal = () => {
    setEditingDeal(null);
    setFormData({ title: '', description: '', productIds: [], discountPrice: null, image: '', startDate: null, endDate: null, isActive: true });
    setError(null);
    setIsAdding(true);
  };

  const openEditModal = (deal: Deal) => {
    setEditingDeal(deal);
    setFormData({
      title: deal.title,
      description: deal.description,
      productIds: deal.productIds,
      discountPrice: deal.discountPrice,
      image: deal.image,
      startDate: deal.startDate ? deal.startDate.slice(0, 10) : null,
      endDate: deal.endDate ? deal.endDate.slice(0, 10) : null,
      isActive: deal.isActive,
    });
    setError(null);
    setIsAdding(true);
  };

  const toggleProductSelection = (productId: string) => {
    setFormData(prev => {
      const current = prev.productIds || [];
      if (current.includes(productId)) {
        return { ...prev, productIds: current.filter(id => id !== productId) };
      }
      return { ...prev, productIds: [...current, productId] };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title?.trim()) {
      setError('Deal title is required');
      return;
    }

    const data = {
      ...formData,
      discountPrice: formData.discountPrice ? Number(formData.discountPrice) : null,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
    };

    try {
      if (editingDeal) {
        await axios.patch(`/api/deals/${editingDeal.id}`, data);
      } else {
        await axios.post('/api/deals', data);
      }
      setIsAdding(false);
      fetchDeals();
    } catch (err: any) {
      const serverError = err?.response?.data?.error || err?.message || "Unknown error";
      setError(`Failed to save: ${serverError}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`/api/deals/${id}`);

      const timer = setTimeout(async () => {
        try {
          await axios.patch(`/api/deals/${id}/permanent-delete`);
        } catch {}
      }, 30000);

      toast.custom(
        (t) => (
          <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl px-5 py-3.5 shadow-2xl flex items-center gap-4 max-w-sm">
            <span className="text-sm font-bold flex-1">Deal deleted</span>
            <button
              onClick={async () => {
                clearTimeout(timer);
                try {
                  await axios.patch(`/api/deals/${id}/restore`);
                  toast.dismiss(t.id);
                  fetchDeals();
                } catch {}
              }}
              className="px-3 py-1.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-lg text-xs font-black hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              UNDO
            </button>
          </div>
        ),
        { duration: 30000 }
      );

      fetchDeals();
    } catch (err) {
      toast.error('Failed to delete deal');
    }
  };

  const toggleActive = async (deal: Deal) => {
    try {
      await axios.patch(`/api/deals/${deal.id}`, { isActive: !deal.isActive });
      fetchDeals();
    } catch (err) {
      toast.error('Failed to toggle deal');
    }
  };

  const getProductName = (id: string) => {
    return products.find(p => p.id === id)?.name || 'Unknown Product';
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-2"
          >
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg shadow-amber-500/20">
              <Tag className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 tracking-tight">
              Deals & Offers
            </h2>
          </motion.div>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Create combo deals and special discounts for your customers
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="group relative px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black transition-all hover:scale-105 active:scale-95 shadow-xl flex items-center gap-3 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-orange-400/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Plus className="w-5 h-5 relative z-10" />
          <span className="relative z-10">New Deal</span>
        </button>
      </div>

      {/* Loading State */}
      {loading && <TableSkeleton rows={6} cols={3} />}

      {/* Deals Grid */}
      {!loading && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {deals.map((deal) => (
            <motion.div
              layout
              key={deal.id}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className={`bg-white dark:bg-zinc-900 border rounded-[2.5rem] relative group overflow-hidden transition-all shadow-md hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:-translate-y-2 duration-500 ${deal.isActive ? 'border-zinc-200 dark:border-zinc-800' : 'border-rose-200 dark:border-rose-900/50 opacity-70'}`}
            >
              {/* Image */}
              <div className="relative h-52 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                {deal.image ? (
                  <img src={deal.image} alt={deal.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Tag className="w-16 h-16 text-zinc-300 dark:text-zinc-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/50 to-transparent" />

                {/* Active badge */}
                <div className="absolute top-4 left-4">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-black tracking-wider ${deal.isActive ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {deal.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                {/* Quick Actions */}
                <div className="absolute top-4 right-4 flex gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-30">
                  <button
                    onClick={() => toggleActive(deal)}
                    className="p-3 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white rounded-2xl shadow-lg transition-colors active:scale-90"
                    title={deal.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {deal.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEditModal(deal)}
                    className="p-3 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white rounded-2xl shadow-lg transition-colors active:scale-90"
                    title="Edit Deal"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(deal.id)}
                    className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl shadow-lg transition-colors active:scale-90"
                    title="Delete Deal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-8">
                <h3 className="text-2xl font-black text-zinc-800 dark:text-white leading-tight mb-3">{deal.title}</h3>

                {deal.description && (
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-4">{deal.description}</p>
                )}

                {deal.discountPrice && (
                  <div className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 mb-4">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xl tracking-tighter">Rs. {deal.discountPrice.toLocaleString()}</span>
                  </div>
                )}

                {/* Products in deal */}
                {deal.productIds.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Included Products</p>
                    <div className="flex flex-wrap gap-2">
                      {deal.productIds.map(pid => (
                        <span key={pid} className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-3 py-1.5 rounded-full border border-violet-100 dark:border-violet-500/20">
                          <Package className="w-3 h-3" />
                          {getProductName(pid)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dates */}
                {(deal.startDate || deal.endDate) && (
                  <div className="flex items-center gap-4 text-xs font-medium text-zinc-400">
                    <Calendar className="w-3.5 h-3.5" />
                    {deal.startDate && <span>From {formatDate(deal.startDate)}</span>}
                    {deal.endDate && <span>To {formatDate(deal.endDate)}</span>}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>}

      {/* Empty State */}
      {!loading && deals.length === 0 && (
        <div className="py-32 flex flex-col items-center justify-center text-zinc-400 space-y-4">
          <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center">
            <Tag className="w-10 h-10 opacity-20" />
          </div>
          <p className="font-bold text-lg">No deals created yet.</p>
          <button onClick={openAddModal} className="text-amber-500 font-black hover:underline">Create your first deal</button>
        </div>
      )}

      {/* Deal Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
            />

            <motion.form
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onSubmit={handleSave}
              className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-10 rounded-[3rem] shadow-2xl max-w-lg w-full space-y-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${editingDeal ? 'bg-amber-500' : 'bg-orange-500'}`}>
                    {editingDeal ? <Edit2 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                  </div>
                  {editingDeal ? 'Edit Deal' : 'New Deal'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-zinc-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Deal Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10 in 1 Combo Deal, Summer Special"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-zinc-800 dark:text-zinc-200 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Description (optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Describe what this deal includes..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-zinc-800 dark:text-zinc-200 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Discount Price (optional)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    <input
                      type="number"
                      placeholder="Leave empty for non-discounted combo deals"
                      value={formData.discountPrice ?? ''}
                      onChange={(e) => setFormData({ ...formData, discountPrice: e.target.value ? Number(e.target.value) : null })}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 pl-10 text-zinc-800 dark:text-zinc-200 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                  <p className="text-xs text-zinc-400 font-medium">Leave empty if this is just a combo offer without discount</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Deal Image (optional)</label>
                  <div className="flex items-start gap-4">
                    {formData.image && (
                      <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex-shrink-0 group">
                        <img src={formData.image} alt="Deal preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, image: '' })}
                          className="absolute inset-0 bg-rose-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <X className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    )}
                    <label className="flex-1 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 cursor-pointer hover:border-amber-500 transition-colors">
                      <Image className="w-6 h-6 text-zinc-400" />
                      <span className="text-xs font-bold text-zinc-400">Click to upload image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const form = new FormData();
                          form.append("files", file);
                          try {
                            const res = await axios.post("/api/upload", form);
                            if (res.data.urls?.[0]) {
                              setFormData({ ...formData, image: res.data.urls[0] });
                            }
                          } catch (err: any) {
                            console.error("Upload failed:", err);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Start Date (optional)</label>
                    <input
                      type="date"
                      value={formData.startDate || ''}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value || null })}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-zinc-800 dark:text-zinc-200 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400">End Date (optional)</label>
                    <input
                      type="date"
                      value={formData.endDate || ''}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value || null })}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-zinc-800 dark:text-zinc-200 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Products Selection for Combo */}
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400 flex items-center justify-between">
                    <span>Products in Deal (optional)</span>
                    <span className="normal-case font-medium opacity-60">Select for combo</span>
                  </label>
                  {products.length === 0 ? (
                    <p className="text-sm text-zinc-400">No products available. Add products first.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3">
                      {products.map(product => {
                        const isSelected = (formData.productIds || []).includes(product.id);
                        return (
                          <button
                            type="button"
                            key={product.id}
                            onClick={() => toggleProductSelection(product.id)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${isSelected
                              ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30'
                              : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <Package className="w-4 h-4" />
                              <span>{product.name}</span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-violet-500" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 text-sm font-bold flex items-center gap-3"
                  >
                    {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  className="w-full py-5 text-white rounded-3xl font-black text-lg shadow-xl transition-all hover:-translate-y-1 active:scale-95 mt-4 flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-amber-500/20"
                >
                  {editingDeal ? <><Save className="w-5 h-5" /> Save Changes</> : <><Plus className="w-5 h-5" /> Create Deal</>}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
