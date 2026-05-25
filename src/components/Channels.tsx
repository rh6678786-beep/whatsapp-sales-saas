import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { Share2, Smartphone, Globe, CheckCircle, Zap, ChevronRight, Link2, Lock, Sparkles } from 'lucide-react';
import { WhatsAppIcon, MessengerIcon, InstagramIcon, TelegramIcon, TikTokIcon } from './channelIcons';
import { useFeatures } from '../hooks/useFeatures';
import FacebookSetup from './channels/FacebookSetup';
import InstagramSetup from './channels/InstagramSetup';
import TelegramSetup from './channels/TelegramSetup';
import TikTokSetup from './channels/TikTokSetup';

interface Channel {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  gradient: string;
  bg: string;
  border: string;
  textColor: string;
  connected: boolean;
  configurable?: boolean;
}

const channelFeatureMap: Record<string, keyof import('../hooks/useFeatures').PlanCapabilities> = {
  messenger: 'facebook',
  instagram: 'instagram',
  telegram: 'telegram',
};

export default function Channels({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const features = useFeatures();
  const [activeChannel, setActiveChannel] = useState<string | null>(null);

  const [facebookConfig, setFacebookConfig] = useState({ pageId: '', pageAccessToken: '', verifyToken: '', isActive: false });
  const [fbTesting, setFbTesting] = useState(false);
  const [fbError, setFbError] = useState<string | null>(null);
  const [fbConnected, setFbConnected] = useState(false);
  const [showFbToken, setShowFbToken] = useState(false);
  const [showFbVerifyToken, setShowFbVerifyToken] = useState(false);

  const [instagramConfig, setInstagramConfig] = useState({ igBusinessId: '', pageAccessToken: '', verifyToken: '', isActive: false });
  const [igTesting, setIgTesting] = useState(false);
  const [igError, setIgError] = useState<string | null>(null);
  const [igConnected, setIgConnected] = useState(false);
  const [showIgToken, setShowIgToken] = useState(false);
  const [showIgVerifyToken, setShowIgVerifyToken] = useState(false);

  const [telegramConfig, setTelegramConfig] = useState({ botToken: '', isActive: false });
  const [tgTesting, setTgTesting] = useState(false);
  const [tgError, setTgError] = useState<string | null>(null);
  const [tgConnected, setTgConnected] = useState(false);
  const [showTgToken, setShowTgToken] = useState(false);
  const [tgBotName, setTgBotName] = useState<string | null>(null);
  
  const [tiktokConfig, setTiktokConfig] = useState({ clientKey: '', clientSecret: '', isActive: false });
  const [tiktokTesting, setTiktokTesting] = useState(false);
  const [tiktokError, setTiktokError] = useState<string | null>(null);
  const [tiktokConnected, setTiktokConnected] = useState(false);
  const [showTiktokSecret, setShowTiktokSecret] = useState(false);

  const [advancedModeFb, setAdvancedModeFb] = useState(false);
  const [advancedModeIg, setAdvancedModeIg] = useState(false);
  const [advancedModeTiktok, setAdvancedModeTiktok] = useState(false);

  const [whatsappConnected, setWhatsappConnected] = useState(false);

  const channels: Channel[] = [
    { id: 'whatsapp', name: 'WhatsApp', description: 'Connected via whatsapp-web.js', icon: WhatsAppIcon, color: 'text-emerald-500', gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/30', textColor: 'text-emerald-600 dark:text-emerald-400', connected: whatsappConnected, configurable: true },
    { id: 'messenger', name: 'Facebook Messenger', description: 'Connect your Facebook page', icon: MessengerIcon, color: 'text-blue-500', gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30', textColor: 'text-blue-600 dark:text-blue-400', connected: fbConnected, configurable: true },
    { id: 'instagram', name: 'Instagram DM', description: 'Connect Instagram business account', icon: InstagramIcon, color: 'text-pink-500', gradient: 'from-pink-500 to-rose-600', bg: 'bg-pink-50 dark:bg-pink-500/10', border: 'border-pink-200 dark:border-pink-500/30', textColor: 'text-pink-600 dark:text-pink-400', connected: igConnected, configurable: true },
    { id: 'telegram', name: 'Telegram', description: 'Connect via Telegram Bot API', icon: TelegramIcon, color: 'text-sky-500', gradient: 'from-sky-500 to-sky-600', bg: 'bg-sky-50 dark:bg-sky-500/10', border: 'border-sky-200 dark:border-sky-500/30', textColor: 'text-sky-600 dark:text-sky-400', connected: tgConnected, configurable: true },
    { id: 'tiktok', name: 'TikTok Shop/DM', description: 'Connect TikTok Business API', icon: TikTokIcon, color: 'text-zinc-900 dark:text-white', gradient: 'from-zinc-800 to-zinc-900 dark:from-zinc-700 dark:to-zinc-800', bg: 'bg-zinc-100 dark:bg-zinc-800/50', border: 'border-zinc-300 dark:border-zinc-700', textColor: 'text-zinc-900 dark:text-zinc-100', connected: tiktokConnected, configurable: true },
    { id: 'webchat', name: 'Web Chat Widget', description: 'Embeddable chat widget for your website', icon: Globe, color: 'text-violet-500', gradient: 'from-violet-500 to-violet-600', bg: 'bg-violet-50 dark:bg-violet-500/10', border: 'border-violet-200 dark:border-violet-500/30', textColor: 'text-violet-600 dark:text-violet-400', connected: false },
  ];

  const checkWhatsAppStatus = async () => {
    try {
      const res = await axios.get('/api/whatsapp/status');
      setWhatsappConnected(res.data.isReady);
    } catch {}
  };

  useEffect(() => {
    loadFacebookConfig();
    loadInstagramConfig();
    checkWhatsAppStatus();
    const waInterval = setInterval(checkWhatsAppStatus, 30000);

    const handleAuthMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'FB_AUTH_SUCCESS') {
        await axios.post('/api/facebook/config', { isActive: true });
        setFbConnected(true);
        setIgConnected(true);
      } else if (event.data?.type === 'TIKTOK_AUTH_SUCCESS') {
        await axios.post('/api/tiktok/config', { isActive: true });
        setTiktokConnected(true);
      }
    };
    
    window.addEventListener('message', handleAuthMessage);
    return () => {
      clearInterval(waInterval);
      window.removeEventListener('message', handleAuthMessage);
    };
  }, []);

  const loadFacebookConfig = async () => {
    try {
      const res = await axios.get('/api/settings');
      if (res.data.facebook) {
        setFacebookConfig(res.data.facebook);
        setFbConnected(res.data.facebook.isActive);
      }
      if (res.data.instagram) {
        setInstagramConfig(res.data.instagram);
        setIgConnected(res.data.instagram.isActive);
      }
      if (res.data.tiktok) {
        setTiktokConfig(res.data.tiktok);
        setTiktokConnected(res.data.tiktok.isActive);
      }
    } catch (err) { }
  };

  const loadInstagramConfig = async () => {
    try {
      const res = await axios.get('/api/settings');
      if (res.data.instagram) {
        setInstagramConfig(res.data.instagram);
        setIgConnected(res.data.instagram.isActive);
      }
    } catch (err) { }
  };

  const openOAuthPopup = (url: string, title: string) => {
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(url, title, `width=${width},height=${height},top=${top},left=${left}`);
  };

  const toggleChannel = (id: string) => {
    const featureKey = channelFeatureMap[id];
    if (featureKey && !features[featureKey]) {
      return;
    }
    setActiveChannel(activeChannel === id ? null : id);
  };

  const connectedCount = channels.filter(c => c.connected).length;
  const unlockedChannels = channels.filter(c => !channelFeatureMap[c.id] || features[channelFeatureMap[c.id]]);
  const availableCount = unlockedChannels.length - connectedCount;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10">
      <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} className="text-center">
        <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, delay: 0.1 }} className="relative inline-flex mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 via-indigo-500/30 to-violet-500/30 rounded-[28px] blur-xl" />
          <div className="relative w-20 h-20 rounded-[28px] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/40 border border-blue-400/20">
            <Share2 className="w-10 h-10 text-white" />
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }} className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white dark:border-zinc-900" />
          </div>
        </motion.div>
        <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400">Connect Channels</motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm font-medium">Connect your AI Sales Agent to multiple platforms</motion.p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-3 gap-4">
        {[
          { label: 'Connected', value: connectedCount, icon: CheckCircle, c: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/5' },
          { label: 'Available', value: availableCount, icon: Zap, c: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/5' },
          { label: 'Total Platforms', value: channels.length, icon: Share2, c: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/5' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center`}>
              <stat.icon className={`w-6 h-6 ${stat.c}`} />
            </div>
            <div>
              <p className="text-2xl font-black text-zinc-900 dark:text-white">{stat.value}</p>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid gap-5">
        {channels.map((channel, idx) => {
          const isExpanded = activeChannel === channel.id;
          const featureKey = channelFeatureMap[channel.id];
          const isLocked = featureKey && !features[featureKey];

          return (
            <motion.div key={channel.id} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * idx, type: 'spring', stiffness: 200, damping: 25 }} layout>
              <motion.div
                layout
                onClick={() => toggleChannel(channel.id)}
                className={`relative bg-white dark:bg-zinc-900 border-2 rounded-[24px] overflow-hidden shadow-lg hover:shadow-xl transition-all duration-500 cursor-pointer ${isExpanded ? `${channel.border} shadow-2xl` : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'} ${isLocked ? 'opacity-60 hover:opacity-80' : ''}`}
              >
                <motion.div animate={{ scaleX: channel.connected ? 1 : 0 }} className={`h-1 bg-gradient-to-r ${channel.gradient} origin-left`} />

                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <motion.div whileHover={{ scale: 1.1, rotate: -5 }} className={`relative w-14 h-14 rounded-2xl ${channel.bg} ${channel.border} border flex items-center justify-center`}>
                        {isLocked ? (
                          <Lock className={`w-6 h-6 text-zinc-400`} />
                        ) : (
                          <channel.icon className={`w-7 h-7 ${channel.color}`} />
                        )}
                        {channel.connected && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </motion.div>
                        )}
                      </motion.div>
                      <div>
                        <h3 className={`text-lg font-black ${isLocked ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-white'}`}>{channel.name}</h3>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {isLocked ? 'Upgrade to unlock this channel' : channel.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {channel.connected ? (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Live</span>
                        </motion.div>
                      ) : isLocked ? (
                        <motion.div onClick={(e) => { e.stopPropagation(); onNavigate?.('billing'); }} whileHover={{ scale: 1.05 }} className="px-4 py-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-xl flex items-center gap-1.5 shadow-lg cursor-pointer">
                          <Sparkles className="w-3 h-3 text-zinc-500 dark:text-zinc-300" />
                          <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-300 uppercase tracking-widest">Upgrade</span>
                        </motion.div>
                      ) : channel.configurable ? (
                        <motion.div whileHover={{ scale: 1.05 }} className={`px-4 py-1.5 bg-gradient-to-r ${channel.gradient} rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg`}>
                          <Link2 className="w-3 h-3 text-white" />
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">Setup</span>
                        </motion.div>
                      ) : (
                        <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Soon</span>
                        </div>
                      )}
                      {channel.configurable && !isLocked && (
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300 }} className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                          <ChevronRight className="w-4 h-4" />
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && channel.id === 'messenger' && (
                      <FacebookSetup
                        config={facebookConfig}
                        connected={fbConnected}
                        testing={fbTesting}
                        error={fbError}
                        showToken={showFbToken}
                        showVerifyToken={showFbVerifyToken}
                        advancedMode={advancedModeFb}
                        setConfig={setFacebookConfig}
                        setTesting={setFbTesting}
                        setError={setFbError}
                        setConnected={setFbConnected}
                        setShowToken={setShowFbToken}
                        setShowVerifyToken={setShowFbVerifyToken}
                        setAdvancedMode={setAdvancedModeFb}
                        openOAuthPopup={openOAuthPopup}
                      />
                    )}

                    {isExpanded && channel.id === 'instagram' && (
                      <InstagramSetup
                        config={instagramConfig}
                        connected={igConnected}
                        testing={igTesting}
                        error={igError}
                        showToken={showIgToken}
                        showVerifyToken={showIgVerifyToken}
                        advancedMode={advancedModeIg}
                        setConfig={setInstagramConfig}
                        setTesting={setIgTesting}
                        setError={setIgError}
                        setConnected={setIgConnected}
                        setShowToken={setShowIgToken}
                        setShowVerifyToken={setShowIgVerifyToken}
                        setAdvancedMode={setAdvancedModeIg}
                        openOAuthPopup={openOAuthPopup}
                      />
                    )}

                    {isExpanded && channel.id === 'telegram' && (
                      <TelegramSetup
                        config={telegramConfig}
                        connected={tgConnected}
                        testing={tgTesting}
                        error={tgError}
                        showToken={showTgToken}
                        botName={tgBotName}
                        setConfig={setTelegramConfig}
                        setTesting={setTgTesting}
                        setError={setTgError}
                        setConnected={setTgConnected}
                        setBotName={setTgBotName}
                        setShowToken={setShowTgToken}
                      />
                    )}

                    {isExpanded && channel.id === 'tiktok' && (
                      <TikTokSetup
                        config={tiktokConfig}
                        connected={tiktokConnected}
                        testing={tiktokTesting}
                        error={tiktokError}
                        showSecret={showTiktokSecret}
                        advancedMode={advancedModeTiktok}
                        setConfig={setTiktokConfig}
                        setTesting={setTiktokTesting}
                        setError={setTiktokError}
                        setConnected={setTiktokConnected}
                        setShowSecret={setShowTiktokSecret}
                        setAdvancedMode={setAdvancedModeTiktok}
                        openOAuthPopup={openOAuthPopup}
                      />
                    )}

                    {isExpanded && channel.id === 'whatsapp' && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="overflow-hidden">
                        <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-5" />
                        <div className="space-y-4 text-center py-4" onClick={e => e.stopPropagation()}>
                          <div className="mx-auto w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                            <Smartphone className="w-8 h-8 text-emerald-500" />
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-zinc-900 dark:text-white">WhatsApp Integration</h4>
                            <p className="text-xs text-zinc-500 mt-2 max-w-sm mx-auto">
                              Manage your WhatsApp connection from the <span className="font-bold text-emerald-500">WhatsApp</span> tab in the sidebar.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {isExpanded && channel.id === 'webchat' && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="overflow-hidden">
                        <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-5" />
                        <div className="space-y-4 text-center py-4" onClick={e => e.stopPropagation()}>
                          <div className="mx-auto w-16 h-16 bg-violet-50 dark:bg-violet-500/10 rounded-2xl flex items-center justify-center">
                            <Globe className="w-8 h-8 text-violet-500" />
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-zinc-900 dark:text-white">Web Chat Widget</h4>
                            <p className="text-xs text-zinc-500 mt-2 max-w-sm mx-auto">Coming soon — Embed a chat widget on your website.</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
