import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Product } from '../types';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, Edit2, Package, Banknote, ListChecks, X, Sparkles, ShoppingBag, Save, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TableSkeleton } from './Skeleton';
import Pagination from './Pagination';
import SearchBar from './SearchBar';

const MediaSlideshow = ({ images = [], videos = [], name }: { images?: string[], videos?: string[], name: string }) => {
  const media = [...(videos || []), ...(images || [])];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isHovered && media.length > 1) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % media.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isHovered, media.length]);

  if (media.length === 0) {
    return (
      <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
        <Package className="w-12 h-12 text-zinc-300" />
    </div>
  );
}

  const isVideo = currentIndex < (videos?.length || 0);

  const nextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % media.length);
  };

  const prevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
  };

  return (
    <div 
      className="relative h-full w-full overflow-hidden group/slideshow"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setCurrentIndex(0);
      }}
    >
      <AnimatePresence mode="wait">
        {isVideo ? (
          <motion.video
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full object-cover"
            src={media[currentIndex]}
            controls
            muted
          />
        ) : (
          <motion.img
            key={currentIndex}
            src={media[currentIndex]}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full object-cover"
            alt={name}
          />
        )}
      </AnimatePresence>

      {media.length > 1 && (
        <>
          <div className="absolute inset-0 flex items-center justify-between px-2 opacity-0 group-hover/slideshow:opacity-100 transition-opacity z-20">
            <button 
              onClick={prevSlide}
              className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/40 transition-all active:scale-90"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={nextSlide}
              className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/40 transition-all active:scale-90"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
            {media.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
                className={`h-1 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-4 bg-white' : 'w-1 bg-white/40'}`} 
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({ name: '', price: 0, costPrice: 0, images: [], videos: [] });
  const [featureInput, setFeatureInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'inStock' | 'outOfStock'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const LIMIT = 20;

  const fetchProducts = async (p?: number, searchTerm?: string, stock?: string) => {
    try {
      setLoading(true);
      setFetchError(null);
      const pageNum = p ?? page;
      const term = searchTerm ?? debouncedSearch;
      const s = stock ?? stockFilter;
      const res = await axios.get(`/api/products?page=${pageNum}&pageSize=${LIMIT}${term ? `&search=${encodeURIComponent(term)}` : ''}`);
      const data = res.data;
      if (!data.data) {
        setFetchError('Invalid response from server');
        return;
      }
      let products = data.data;
      if (s === 'inStock') {
        products = products.filter((pr: Product) => (pr as any).stock === undefined || (pr as any).stock > 0);
      } else if (s === 'outOfStock') {
        products = products.filter((pr: Product) => (pr as any).stock === 0);
      }
      setProducts(products);
      setTotal(data.pagination?.total ?? data.total);
      setTotalPages(data.pagination?.totalPages ?? data.totalPages);
    } catch (err: any) {
      setFetchError(err?.response?.data?.error || err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchProducts(page, debouncedSearch, stockFilter);
  }, [page, debouncedSearch, stockFilter]);

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) setPage(p);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ name: '', price: 0, costPrice: 0, images: [], videos: [] });
    setFeatureInput('');
    setError(null);
    setIsAdding(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({ 
      name: product.name, 
      price: product.price, 
      costPrice: product.costPrice || 0, 
      images: product.images || [],
      videos: product.videos || []
    });
    setFeatureInput((product.features || []).join('\n'));
    setError(null);
    setIsAdding(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if ((formData.costPrice || 0) >= (formData.price || 0)) {
      setError("❌ Sale Price cost price se zyada honi chahye taake aapko profit ho!");
      return;
    }

    const data = {
      ...formData,
      features: featureInput.split(/[\n,]+/).map(f => f.trim()).filter(f => f !== '')
    };

    try {
      if (editingProduct) {
        await axios.patch(`/api/products/${editingProduct.id}`, data);
      } else {
        await axios.post('/api/products', data);
      }
      setIsAdding(false);
      setPage(1);
      fetchProducts(1);
    } catch (err: any) {
      const serverError = err?.response?.data?.error || err?.message || "Unknown error";
      toast.error(`Failed to save: ${serverError}`);
      setError(`Failed to save: ${serverError}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product? This will remove it from the AI catalog.')) {
      try {
        await axios.delete(`/api/products/${id}`);
        const nextPage = products.length === 1 && page > 1 ? page - 1 : page;
        setPage(nextPage);
        fetchProducts(nextPage);
      } catch (err) {
        toast.error('Failed to delete product');
      }
    }
  };

  const handleBatchDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} products? This will permanently remove them from the AI catalog.`)) return;
    try {
      await axios.delete('/api/products/batch', { data: { ids: Array.from(selectedIds) } });
      setSelectedIds(new Set());
      const nextPage = products.length === selectedIds.size && page > 1 ? page - 1 : page;
      setPage(nextPage);
      fetchProducts(nextPage);
    } catch (err) {
      toast.error('Failed to delete selected products');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
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
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <ShoppingBag className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400 tracking-tight">
              Product Catalog
            </h2>
          </motion.div>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            Manage products your AI Sales Agent sells
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="min-w-[200px] sm:min-w-[260px]">
            <SearchBar value={search} onChange={setSearch} placeholder="Search products..." />
          </div>
          <button 
            onClick={openAddModal}
            className="group relative px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black transition-all hover:scale-105 active:scale-95 shadow-xl flex items-center gap-3 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-blue-400/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Plus className="w-5 h-5 relative z-10" /> 
            <span className="relative z-10">Add New Product</span>
          </button>
          <button 
            onClick={() => window.location.hash = '#/bulk-import'}
            className="group relative px-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 shadow-md flex items-center gap-3 overflow-hidden"
          >
            <Upload className="w-5 h-5 relative z-10" /> 
            <span className="relative z-10">Bulk Import</span>
          </button>
        </div>
      </div>

      {/* Selection & Filter Controls */}
      <div className="flex items-center justify-between -mt-4">
        <div className="flex items-center gap-2">
          {products.length > 0 && (
            <label className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
              <input
                type="checkbox"
                checked={products.length > 0 && selectedIds.size === products.length}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Select All</span>
            </label>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'inStock', 'outOfStock'] as const).map((option) => (
          <button
            key={option}
            onClick={() => { setStockFilter(option); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              stockFilter === option
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {option === 'all' ? 'All' : option === 'inStock' ? 'In Stock' : 'Out of Stock'}
          </button>
        ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && <TableSkeleton rows={8} cols={4} />}

      {/* Grid Layout */}
      {!loading && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {products.map((product) => (
            <motion.div
              layout
              key={product.id}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] relative group overflow-hidden transition-all shadow-md hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:-translate-y-2 duration-500"
            >
              {/* Product Image Wrapper */}
              <div className="relative h-64 overflow-hidden">
                <MediaSlideshow images={product.images} videos={product.videos} name={product.name} />
                
                {/* Glossy Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                {/* Selection checkbox */}
                <div className="absolute top-4 left-4 z-30">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(product.id)}
                    onChange={() => toggleSelect(product.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 rounded-lg border-zinc-300 dark:border-zinc-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                  />
                </div>

                {/* Quick Actions overlay */}
                <div className="absolute top-4 right-4 flex gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-30">
                  <button 
                    onClick={() => openEditModal(product)}
                    className="p-3 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white rounded-2xl shadow-lg transition-colors active:scale-90"
                    title="Edit Product"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(product.id)}
                    className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl shadow-lg transition-colors active:scale-90"
                    title="Delete Product"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Info Card */}
              <div className="p-8">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-2xl font-black text-zinc-800 dark:text-white leading-tight">{product.name}</h3>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-6">
                  <div className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                    <span className="text-xs uppercase tracking-widest opacity-60">Rs.</span>
                    <span className="text-2xl tracking-tighter">{product.price.toLocaleString()}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 text-zinc-400 dark:text-zinc-500 font-bold bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                    <span className="text-[10px] uppercase tracking-widest opacity-60">Cost:</span>
                    <span className="text-sm">Rs. {product.costPrice?.toLocaleString() || '0'}</span>
                  </div>
                </div>
                
                <div className="space-y-2.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Key Features</p>
                  {product.features.map((feature, i) => (
                    <div key={i} className="text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/40 px-4 py-3 rounded-2xl transition-colors border border-zinc-100/50 dark:border-zinc-800/50">
                      <div className="w-2 h-2 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>}

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Product Modal Overlay */}
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
              onSubmit={handleSaveProduct}
              className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-10 rounded-[3rem] shadow-2xl max-w-lg w-full space-y-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${editingProduct ? 'bg-amber-500' : 'bg-blue-500'}`}>
                    {editingProduct ? <Edit2 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                  </div>
                  {editingProduct ? 'Edit Product' : 'New Product'}
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
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Product Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Ultra Smart Watch Series 9"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-zinc-800 dark:text-zinc-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Sale Price (Rs.)</label>
                    <div className="relative">
                      <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                      <input 
                        type="number" 
                        required
                        value={formData.price === 0 ? 0 : formData.price || ''}
                        onChange={(e) => setFormData({...formData, price: Number(e.target.value) || 0})}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 pl-10 text-zinc-800 dark:text-zinc-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Cost Price (Rs.)</label>
                    <div className="relative">
                      <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-500" />
                      <input 
                        type="number" 
                        required
                        value={formData.costPrice || ''}
                        onChange={(e) => setFormData({...formData, costPrice: Number(e.target.value) || 0})}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 pl-10 text-zinc-800 dark:text-zinc-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Profit Analysis */}
                {formData.price! > 0 && formData.costPrice! > 0 && (() => {
                  const profit = formData.price! - formData.costPrice!;
                  const profitPercent = (profit / formData.costPrice!) * 100;
                  const isHealthy = profitPercent >= 20;
                  
                  return (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className={`p-4 rounded-2xl border flex items-center justify-between transition-colors ${
                        isHealthy 
                          ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20' 
                          : 'bg-rose-50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/20'
                      }`}
                    >
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Estimated Profit</p>
                        <p className={`text-xl font-black ${isHealthy ? 'text-emerald-500' : 'text-rose-500'}`}>
                          Rs. {profit.toLocaleString()}
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

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 text-sm font-bold flex items-center gap-3"
                  >
                    <span className="text-lg">⚠️</span>
                    {error}
                  </motion.div>
                )}

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Product Images (Unlimited)</label>
                  <div className="grid grid-cols-4 gap-3">
                    {formData.images?.map((img, idx) => (
                      <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                        <img src={img} className="w-full h-full object-cover" alt="product" />
                        <button 
                          type="button"
                          onClick={() => setFormData({...formData, images: formData.images?.filter((_, i) => i !== idx)})}
                          className="absolute inset-0 bg-rose-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <X className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    ))}
                    <label className="aspect-square flex flex-col items-center justify-center gap-1 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:border-blue-500 transition-colors">
                      <Plus className="w-4 h-4 text-zinc-400" />
                      <span className="text-[9px] font-black text-zinc-400 uppercase">Add</span>
                      <input 
                        type="file" 
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;
                          const form = new FormData();
                          files.forEach(f => form.append("files", f));
                          try {
                            const res = await axios.post("/api/upload", form);
                            const urls: string[] = res.data.urls;
                            setFormData(prev => ({...prev, images: [...(prev.images || []), ...urls]}));
                          } catch (err: any) {
                            toast.error("Image upload failed");
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Product Video (1 video)</label>
                  <div className="grid grid-cols-2 gap-3">
                    {formData.videos?.map((vid, idx) => (
                      <div key={idx} className="relative group aspect-video rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                        <video src={vid} className="w-full h-full object-cover" controls />
                        <button 
                          type="button"
                          onClick={() => setFormData({...formData, videos: formData.videos?.filter((_, i) => i !== idx)})}
                          className="absolute inset-0 bg-rose-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <X className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    ))}
                    <label className="aspect-video flex flex-col items-center justify-center gap-1 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:border-blue-500 transition-colors">
                      <Plus className="w-4 h-4 text-zinc-400" />
                      <span className="text-[9px] font-black text-zinc-400 uppercase">Add Video</span>
                      <input 
                        type="file" 
                        accept="video/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const form = new FormData();
                          form.append("files", file);
                          try {
                            const res = await axios.post("/api/upload", form);
                            const urls: string[] = res.data.urls;
                            setFormData(prev => ({...prev, videos: urls}));
                          } catch (err: any) {
                            toast.error("Video upload failed");
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400 flex items-center justify-between">
                    <span>Product Features</span>
                    <span className="normal-case font-medium opacity-60">Press Enter for each new feature</span>
                  </label>
                  <div className="relative">
                    <ListChecks className="absolute left-4 top-4 w-4 h-4 text-zinc-400" />
                    <textarea 
                      required
                      rows={4}
                      placeholder="High Quality Display&#10;Waterproof IP68&#10;7 Days Battery Life"
                      value={featureInput}
                      onChange={(e) => setFeatureInput(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 pl-10 text-zinc-800 dark:text-zinc-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all resize-none"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className={`w-full py-5 text-white rounded-3xl font-black text-lg shadow-xl transition-all hover:-translate-y-1 active:scale-95 mt-4 flex items-center justify-center gap-3 ${editingProduct ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-amber-500/20' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20'}`}
                >
                  {editingProduct ? <><Save className="w-5 h-5" /> Save Changes</> : <><Plus className="w-5 h-5" /> Create Product</>}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Error State */}
      {fetchError && (
        <div className="py-16 px-8 max-w-xl mx-auto flex flex-col items-center justify-center text-zinc-400 space-y-4">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center">
            <Package className="w-8 h-8 text-red-400" />
          </div>
          <p className="font-bold text-lg text-red-500">Failed to load products</p>
          <p className="text-sm text-zinc-500 text-center">{fetchError}</p>
          <button onClick={() => fetchProducts(page)} className="text-blue-500 font-black hover:underline">Try Again</button>
        </div>
      )}

      {/* Empty State */}
      {!fetchError && products.length === 0 && (
        <div className="py-32 flex flex-col items-center justify-center text-zinc-400 space-y-4">
          <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center">
            <Package className="w-10 h-10 opacity-20" />
          </div>
          <p className="font-bold text-lg">No products found in catalog.</p>
          <button onClick={openAddModal} className="text-blue-500 font-black hover:underline">Add your first product</button>
        </div>
      )}

      {/* Floating Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-4 z-50">
          <span className="text-sm font-bold">{selectedIds.size} selected</span>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-white dark:hover:text-zinc-900 transition-colors">Cancel</button>
          <div className="w-px h-5 bg-zinc-700 dark:bg-zinc-300" />
          <button onClick={handleBatchDelete} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-black hover:bg-red-600 transition-colors">Delete Selected</button>
        </div>
      )}

    </div>
  );
}
