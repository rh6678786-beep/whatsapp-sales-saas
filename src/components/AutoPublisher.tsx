import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { 
  Megaphone, Sparkles, Image, Video, Calendar, Clock, 
  Send, CheckCircle, XCircle, Loader2, AlertCircle, 
  History, Info, RefreshCw, Smartphone, Facebook, Instagram
} from 'lucide-react';
import { TelegramIcon, WhatsAppIcon } from './channelIcons';

interface PublishHistoryItem {
  id: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'none';
  platforms: string[];
  status: 'published' | 'scheduled' | 'failed';
  scheduledTime?: string;
  createdAt: string;
  errorMessage?: string;
}

export default function AutoPublisher() {
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'none'>('none');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, boolean>>({
    whatsapp: false,
    telegram: false,
    facebook: false,
    instagram: false
  });
  
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [history, setHistory] = useState<PublishHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await axios.get('/api/publish/history');
      setHistory(res.data);
    } catch (err) {
      console.error('Failed to fetch publication history', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleAiEnhance = async () => {
    if (!content.trim()) {
      setMessage({ type: 'error', text: 'Please write some text or product details first!' });
      return;
    }
    setIsEnhancing(true);
    setMessage(null);
    try {
      const res = await axios.post('/api/publish/ai-enhance', { text: content });
      if (res.data.success) {
        setContent(res.data.enhancedText);
        setMessage({ type: 'success', text: 'AI successfully enhanced your post content!' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.error || 'Failed to enhance content via AI' });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    const activePlatforms = Object.keys(selectedPlatforms).filter(p => selectedPlatforms[p]);
    
    if (!content.trim() && mediaType === 'none') {
      setMessage({ type: 'error', text: 'Please add some content or a media file to publish!' });
      return;
    }
    
    if (activePlatforms.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one social platform!' });
      return;
    }

    if (isScheduled && (!scheduledDate || !scheduledTime)) {
      setMessage({ type: 'error', text: 'Please specify both date and time for scheduling!' });
      return;
    }

    setIsPublishing(true);
    setMessage(null);

    const publishData = {
      content,
      mediaUrl: mediaType !== 'none' ? mediaUrl : undefined,
      mediaType,
      platforms: activePlatforms,
      scheduledTime: isScheduled ? `${scheduledDate}T${scheduledTime}` : undefined
    };

    try {
      const res = await axios.post('/api/publish', publishData);
      if (res.data.success) {
        setMessage({ 
          type: 'success', 
          text: isScheduled 
            ? 'Post scheduled successfully!' 
            : 'Post published successfully to all selected platforms!' 
        });
        
        // Reset form
        setContent('');
        setMediaUrl('');
        setMediaType('none');
        setIsScheduled(false);
        setScheduledDate('');
        setScheduledTime('');
        setSelectedPlatforms({
          whatsapp: false,
          telegram: false,
          facebook: false,
          instagram: false
        });
        
        // Refresh history
        fetchHistory();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.error || 'Failed to process your publication request' });
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }));
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Title Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="flex items-center justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Megaphone className="w-6 h-6" />
            </span>
            <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400">
              AI Multi-Platform Publisher
            </h2>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm font-medium">
            Publish text, images, or video Reels to Facebook, Instagram, Telegram, and WhatsApp simultaneously.
          </p>
        </div>
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Editor Panel */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handlePublish} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
            {/* Platforms Selection */}
            <div className="space-y-3">
              <label className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                Select Publishing Channels
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-600', activeBg: 'bg-blue-50 dark:bg-blue-900/15 border-blue-500/50' },
                  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-600', activeBg: 'bg-pink-50 dark:bg-pink-900/15 border-pink-500/50' },
                  { id: 'telegram', label: 'Telegram', icon: TelegramIcon, color: 'text-sky-500', activeBg: 'bg-sky-50 dark:bg-sky-900/15 border-sky-500/50' },
                  { id: 'whatsapp', label: 'WhatsApp', icon: WhatsAppIcon, color: 'text-emerald-500', activeBg: 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-500/50' },
                ].map(plat => {
                  const isSel = selectedPlatforms[plat.id];
                  const Icon = plat.icon;
                  return (
                    <motion.button
                      key={plat.id}
                      type="button"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePlatformToggle(plat.id)}
                      className={`flex items-center gap-2.5 p-3 rounded-2xl border-2 text-left transition-all ${
                        isSel 
                          ? `${plat.activeBg} border-2` 
                          : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/20'
                      }`}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${plat.color}`} />
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{plat.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Post text content */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                  Post Caption & Content
                </label>
                <motion.button
                  type="button"
                  onClick={handleAiEnhance}
                  disabled={isEnhancing || !content.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isEnhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {isEnhancing ? 'Enhancing...' : 'AI Magic Assist'}
                </motion.button>
              </div>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="What would you like to post? Enter raw features, discount details, or simple announcements..."
                rows={5}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-2xl p-4 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
              />
            </div>

            {/* Media Attachment */}
            <div className="space-y-3">
              <label className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                Attach Media (Reels / Post Media)
              </label>
              <div className="flex gap-2">
                {[
                  { id: 'none', label: 'No Media', icon: Info },
                  { id: 'image', label: 'Image URL', icon: Image },
                  { id: 'video', label: 'Video URL (Reels)', icon: Video }
                ].map(type => {
                  const isSel = mediaType === type.id;
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setMediaType(type.id as any)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                        isSel 
                          ? 'bg-zinc-900 dark:bg-zinc-800 text-white border-zinc-900 dark:border-zinc-700' 
                          : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {type.label}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {mediaType !== 'none' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-2 pt-1"
                  >
                    <input
                      type="url"
                      value={mediaUrl}
                      onChange={e => setMediaUrl(e.target.value)}
                      placeholder={`Enter public HTTPS URL of the ${mediaType}...`}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-100 dark:border-zinc-800 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-2xl px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
                    />
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                      💡 Ensure the URL is public and ends with standard extension (.jpg, .png, .mp4) or points directly to a CDN file.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Scheduling & Publish section */}
            <div className="border-t border-zinc-100 dark:border-zinc-800/50 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Schedule this publication?</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScheduled(!isScheduled)}
                  className={`w-12 h-6.5 rounded-full p-1 transition-all ${isScheduled ? 'bg-amber-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-all transform ${isScheduled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <AnimatePresence>
                {isScheduled && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden grid grid-cols-2 gap-4 pb-2"
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">Date</label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={e => setScheduledDate(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">Time</label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={e => setScheduledTime(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Status messaging */}
              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex items-start gap-2.5 p-4 rounded-2xl border text-xs font-bold ${
                      message.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'
                    }`}
                  >
                    {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                    <span>{message.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={isPublishing}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl text-sm font-black shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isPublishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                {isPublishing ? 'Publishing Request...' : isScheduled ? 'Schedule Multi-Post' : 'Publish to All Channels Now'}
              </motion.button>
            </div>
          </form>
        </div>

        {/* Live Preview & Sidebar Logs */}
        <div className="space-y-6">
          {/* Post Preview */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xl space-y-4">
            <h3 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
              Live Mock Preview
            </h3>
            
            <div className="border border-zinc-100 dark:border-zinc-800/80 rounded-2xl overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/20">
              {/* Header */}
              <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-xs text-white">
                  SF
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Your Brand Page</h4>
                  <p className="text-[9px] text-zinc-400">Just now • Automated Publish</p>
                </div>
              </div>

              {/* Media preview */}
              {mediaType !== 'none' && mediaUrl && (
                <div className="aspect-video bg-zinc-900 flex items-center justify-center overflow-hidden border-b border-zinc-100 dark:border-zinc-800">
                  {mediaType === 'image' ? (
                    <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/18181b/ffffff?text=Image+URL+Not+Found';
                    }} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-1.5">
                      <Video className="w-8 h-8 text-amber-500" />
                      <span className="text-[10px] font-bold">Standard Video Player (.mp4)</span>
                    </div>
                  )}
                </div>
              )}

              {/* Text content preview */}
              <div className="p-4 space-y-2">
                <p className="text-xs text-zinc-800 dark:text-zinc-200 font-medium whitespace-pre-line leading-relaxed">
                  {content || 'Your publication content will reflect dynamically here as you type in the editor...'}
                </p>
              </div>

              {/* Footer action preview */}
              <div className="p-2.5 bg-zinc-50 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <span className="text-[9px] text-zinc-400 font-bold">Active Channels:</span>
                <div className="flex gap-1.5">
                  {Object.keys(selectedPlatforms).map(key => {
                    if (!selectedPlatforms[key]) return null;
                    if (key === 'facebook') return <Facebook className="w-3.5 h-3.5 text-blue-500" key={key} />;
                    if (key === 'instagram') return <Instagram className="w-3.5 h-3.5 text-pink-500" key={key} />;
                    if (key === 'telegram') return <TelegramIcon className="w-3.5 h-3.5 text-sky-500" key={key} />;
                    if (key === 'whatsapp') return <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-500" key={key} />;
                    return null;
                  })}
                  {Object.values(selectedPlatforms).filter(Boolean).length === 0 && (
                    <span className="text-[9px] text-zinc-400 font-bold italic">None selected</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History Feed */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-zinc-400" />
            <h3 className="text-lg font-black text-zinc-900 dark:text-white">
              Publication Logs & Schedule History
            </h3>
          </div>
          <button
            onClick={fetchHistory}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 transition-all"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {isLoadingHistory ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <span className="text-xs text-zinc-400 font-bold">Loading publication history...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-bold">No standard publications executed yet</p>
            <p className="text-xs mt-1">Select channels, type captions, and publish your first omnichannel update!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-black text-[10px]">
                  <th className="py-3 px-4">Content Preview</th>
                  <th className="py-3 px-4">Media</th>
                  <th className="py-3 px-4">Platforms</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {history.map(item => (
                  <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20 transition-colors">
                    <td className="py-4 px-4 font-bold text-zinc-700 dark:text-zinc-300 max-w-xs truncate">
                      {item.content || <span className="italic text-zinc-400">Media only</span>}
                    </td>
                    <td className="py-4 px-4">
                      {item.mediaType !== 'none' && item.mediaUrl ? (
                        <a 
                          href={item.mediaUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-amber-500 transition-all inline-flex items-center gap-1 font-bold text-[10px]"
                        >
                          {item.mediaType === 'image' ? <Image className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                          View {item.mediaType}
                        </a>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-1.5">
                        {item.platforms.map(plat => {
                          if (plat === 'facebook') return <Facebook className="w-3.5 h-3.5 text-blue-500" key={plat} />;
                          if (plat === 'instagram') return <Instagram className="w-3.5 h-3.5 text-pink-500" key={plat} />;
                          if (plat === 'telegram') return <TelegramIcon className="w-3.5 h-3.5 text-sky-500" key={plat} title="Telegram" />;
                          if (plat === 'whatsapp') return <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-500" key={plat} title="WhatsApp" />;
                          return null;
                        })}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {item.status === 'published' && (
                        <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg font-black text-[9px] uppercase tracking-wider">
                          Published
                        </span>
                      )}
                      {item.status === 'scheduled' && (
                        <span className="px-2 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg font-black text-[9px] uppercase tracking-wider">
                          Scheduled
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span 
                          className="px-2 py-1 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg font-black text-[9px] uppercase tracking-wider cursor-help"
                          title={item.errorMessage || 'Execution failed'}
                        >
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-zinc-500 font-bold text-[10px]">
                      {item.status === 'scheduled' && item.scheduledTime ? (
                        <span className="flex items-center gap-1 text-amber-500">
                          <Clock className="w-3 h-3" />
                          {new Date(item.scheduledTime).toLocaleString()}
                        </span>
                      ) : (
                        new Date(item.createdAt).toLocaleString()
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
