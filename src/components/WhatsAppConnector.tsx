import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Smartphone, CheckCircle, RefreshCcw, Wifi, WifiOff, 
  Loader2, AlertCircle, Key, Phone, Settings2, TestTube,
  Shield, ExternalLink, Trash2, Eye, EyeOff, MessageCircle,
  LogIn, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ConnectionPhase = 'disconnected' | 'configuring' | 'testing' | 'connected' | 'error';

interface WhatsAppCloudConfig {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  businessAccountId: string;
  verifyToken: string;
  phoneNumber: string;
  isActive: boolean;
}

/**
 * Open a popup window for OAuth login.
 * Returns a reference to the popup window.
 */
function openOAuthPopup(url: string, title: string): Window | null {
  const width = 600;
  const height = 750;
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;
  return window.open(
    url,
    title,
    `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
  );
}

export default function WhatsAppConnector() {
  const [phase, setPhase] = useState<ConnectionPhase>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [advancedMode, setAdvancedMode] = useState(false);
  
  // Form state
  const [config, setConfig] = useState<WhatsAppCloudConfig>({
    accessToken: '',
    phoneNumberId: '',
    wabaId: '',
    businessAccountId: '',
    verifyToken: '',
    phoneNumber: '',
    isActive: false,
  });
  
  // Show/hide sensitive fields
  const [showToken, setShowToken] = useState(false);
  const [savedConfig, setSavedConfig] = useState<WhatsAppCloudConfig | null>(null);

  // Load existing config on mount
  useEffect(() => {
    loadStatus();
  }, []);

  // Listen for OAuth postMessage from popup
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'whatsapp_oauth') {
        // OAuth succeeded — update state from received data
        setPhase('connected');
        setError(null);
        setSuccess('WhatsApp connected successfully! 🎉');
        setSavedConfig({
          accessToken: '••••••••',
          phoneNumberId: e.data.phoneNumberId || '',
          wabaId: e.data.wabaId || '',
          businessAccountId: e.data.businessAccountId || '',
          verifyToken: '••••••••',
          phoneNumber: e.data.phoneNumber || '',
          isActive: true,
        });
        // Reload full status from server
        setTimeout(() => loadStatus(), 1000);
      } else if (e.data?.type === 'whatsapp_oauth_error') {
        setError(e.data.error || 'OAuth connection failed');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const loadStatus = async () => {
    try {
      const res = await axios.get('/api/whatsapp/status');
      const data = res.data;
      
      if (data.isReady) {
        setPhase('connected');
        setSavedConfig({
          accessToken: '••••••••',
          phoneNumberId: data.phoneNumberId || '',
          wabaId: data.wabaId || '',
          businessAccountId: data.businessAccountId || '',
          verifyToken: '••••••••',
          phoneNumber: data.phoneNumber || '',
          isActive: true,
        });
      } else {
        setPhase('disconnected');
      }
    } catch (err) {
      setError('Could not reach server');
      setPhase('error');
    }
  };

  const handleInputChange = (field: keyof WhatsAppCloudConfig, value: string | boolean) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!config.accessToken || !config.phoneNumberId || !config.wabaId) {
      setError('Please fill in at least: Access Token, Phone Number ID, and WABA ID');
      return;
    }

    setPhase('configuring');
    setError(null);
    setSuccess(null);

    try {
      await axios.post('/api/whatsapp/configure', config);
      setSuccess('Credentials saved! Testing connection…');
      
      // Test the connection
      const testRes = await axios.post('/api/whatsapp/test');
      
      if (testRes.data.success) {
        setPhase('connected');
        setSuccess('WhatsApp connected and verified successfully! 🎉');
        setSavedConfig({ ...config, accessToken: '••••••••', verifyToken: '••••••••' });
      } else {
        setPhase('connected');
        setSuccess('Credentials saved, but connection test failed. Check your settings.');
        setError(testRes.data.error);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save configuration');
      setPhase('disconnected');
    }
  };

  const handleTestConnection = async () => {
    setPhase('testing');
    setError(null);
    setSuccess(null);

    try {
      const res = await axios.post('/api/whatsapp/test');
      if (res.data.success) {
        setSuccess('Connection test successful! ✅');
        setPhase('connected');
      } else {
        setError(res.data.error || 'Connection test failed');
        setPhase('connected');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Connection test failed');
      setPhase('connected');
    }
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp?')) return;
    
    setPhase('configuring');
    setError(null);
    setSuccess(null);

    try {
      await axios.post('/api/whatsapp/logout');
      setPhase('disconnected');
      setSavedConfig(null);
      setConfig({
        accessToken: '',
        phoneNumberId: '',
        wabaId: '',
        businessAccountId: '',
        verifyToken: '',
        phoneNumber: '',
        isActive: false,
      });
      setSuccess('WhatsApp disconnected successfully');
    } catch (err: any) {
      setError('Failed to disconnect');
      setPhase('connected');
    }
  };

  const handleRemoveConfig = async () => {
    if (!confirm('This will permanently remove all WhatsApp configuration. Continue?')) return;
    
    try {
      await axios.delete('/api/whatsapp/config');
      setPhase('disconnected');
      setSavedConfig(null);
      setConfig({
        accessToken: '',
        phoneNumberId: '',
        wabaId: '',
        businessAccountId: '',
        verifyToken: '',
        phoneNumber: '',
        isActive: false,
      });
      setSuccess('WhatsApp configuration removed');
    } catch (err: any) {
      setError('Failed to remove configuration');
    }
  };

  const handleOAuthLogin = () => {
    openOAuthPopup('/api/whatsapp/oauth/login', 'WhatsApp Login');
  };

  const isConnected = phase === 'connected';
  const isLoading = phase === 'configuring' || phase === 'testing';

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <header>
        <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-400">
          WhatsApp Connection
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm font-medium">
          Connect your WhatsApp Business Account via Meta Cloud API
        </p>
      </header>

      {/* Status Card */}
      <div className="relative group">
        <div className={`absolute -inset-1 rounded-3xl blur opacity-25 transition-all duration-1000 ${
          isConnected 
            ? 'bg-gradient-to-r from-emerald-400 to-emerald-600 animate-pulse' 
            : 'bg-gradient-to-r from-zinc-300 to-zinc-500'
        }`} />

        <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xl text-center space-y-6 overflow-hidden">
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.01)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

          {/* Status Icon */}
          <div className="relative z-10 space-y-3">
            <motion.div
              animate={isConnected ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
              className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center shadow-xl transition-all ${
                isConnected 
                  ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/40' 
                  : 'bg-zinc-100 dark:bg-zinc-800'
              }`}
            >
              {isConnected 
                ? <CheckCircle className="w-10 h-10 text-white" /> 
                : <Smartphone className="w-10 h-10 text-zinc-400 dark:text-zinc-500" />
              }
            </motion.div>

            <div>
              <h3 className={`text-xl font-bold transition-colors ${
                isConnected 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-zinc-900 dark:text-white'
              }`}>
                {isConnected ? 'Connected & Active' : 'Not Connected'}
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                {isConnected 
                  ? 'WhatsApp Cloud API is live. AI Agent is responding to customers via Meta API.'
                  : 'Configure your WhatsApp Business Account to activate the AI Sales Agent'
                }
              </p>
            </div>

            {/* Status Pill */}
            {isConnected && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30">
                <Wifi className="w-3 h-3" /> Live
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl px-4 py-3 text-sm font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl px-4 py-3 text-sm font-medium">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Configuration */}
      <AnimatePresence mode="wait">
        {isConnected && savedConfig ? (
          /* Connected State — Show Summary and Actions */
          <motion.div
            key="connected"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4"
          >
            <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              Connection Details
            </h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-zinc-400 text-xs uppercase tracking-wider font-medium">Phone Number ID</p>
                <p className="text-zinc-700 dark:text-zinc-300 font-mono text-xs mt-1">{savedConfig.phoneNumberId}</p>
              </div>
              <div>
                <p className="text-zinc-400 text-xs uppercase tracking-wider font-medium">WABA ID</p>
                <p className="text-zinc-700 dark:text-zinc-300 font-mono text-xs mt-1">{savedConfig.wabaId}</p>
              </div>
              {savedConfig.phoneNumber && (
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-wider font-medium">Phone Number</p>
                  <p className="text-zinc-700 dark:text-zinc-300 mt-1">{savedConfig.phoneNumber}</p>
                </div>
              )}
              {savedConfig.businessAccountId && (
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-wider font-medium">Business Account</p>
                  <p className="text-zinc-700 dark:text-zinc-300 font-mono text-xs mt-1">{savedConfig.businessAccountId}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleTestConnection}
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                Test Connection
              </button>
              
              <button
                onClick={handleLogout}
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 rounded-xl font-bold text-sm hover:bg-amber-500 hover:text-white transition-all duration-200 disabled:opacity-50"
              >
                <WifiOff className="w-4 h-4" /> Disconnect
              </button>

              <button
                onClick={handleRemoveConfig}
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-500 border border-red-200 dark:border-red-500/30 rounded-xl font-bold text-sm hover:bg-red-500 hover:text-white transition-all duration-200 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Remove Config
              </button>
            </div>
          </motion.div>
        ) : (
          /* Disconnected State — Show Easy Connect or Advanced Form */
          <motion.div
            key={advancedMode ? 'advanced' : 'easy'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6"
          >
            {advancedMode ? (
              /* ---- Advanced Manual Setup Form ---- */
              <div className="space-y-5">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">
                    <Settings2 className="w-3 h-3 inline mr-1.5" />
                    Manual Developer Setup
                  </h4>
                  <button 
                    onClick={() => setAdvancedMode(false)} 
                    className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 hover:text-emerald-600 hover:underline"
                  >
                    <ArrowLeft className="w-3 h-3" /> Back to Easy Connect
                  </button>
                </div>

                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl text-sm text-blue-700 dark:text-blue-400">
                  <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold mb-1">Need credentials?</p>
                    <p className="text-xs">
                      1. Go to{' '}
                      <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" 
                         className="underline hover:text-blue-800 dark:hover:text-blue-300">
                        Meta Developers
                      </a>
                      {' '}→ Create App → Business<br />
                      2. Add WhatsApp product → Copy <strong>Phone Number ID</strong> &amp; <strong>WABA ID</strong><br />
                      3. Generate a <strong>Permanent Access Token</strong> (Settings → Never expire)<br />
                      4. Set a <strong>Verify Token</strong> (any random string) for webhook
                    </p>
                  </div>
                </div>

                {/* Phone Number ID */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    <Phone className="w-3 h-3 inline mr-1" />
                    Phone Number ID *
                  </label>
                  <input
                    type="text"
                    value={config.phoneNumberId}
                    onChange={(e) => handleInputChange('phoneNumberId', e.target.value)}
                    placeholder="e.g. 123456789012345"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* WABA ID */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    <Settings2 className="w-3 h-3 inline mr-1" />
                    WABA ID (WhatsApp Business Account ID) *
                  </label>
                  <input
                    type="text"
                    value={config.wabaId}
                    onChange={(e) => handleInputChange('wabaId', e.target.value)}
                    placeholder="e.g. 123456789012345"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* Access Token */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    <Key className="w-3 h-3 inline mr-1" />
                    Permanent Access Token *
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={config.accessToken}
                      onChange={(e) => handleInputChange('accessToken', e.target.value)}
                      placeholder="EAAB...za"
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Optional Fields */}
                <details className="group">
                  <summary className="text-sm text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 font-medium">
                    Advanced Settings
                  </summary>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                        <Shield className="w-3 h-3 inline mr-1" />
                        Webhook Verify Token
                      </label>
                      <input
                        type="text"
                        value={config.verifyToken}
                        onChange={(e) => handleInputChange('verifyToken', e.target.value)}
                        placeholder="Your custom verify token"
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                        Business Account ID
                      </label>
                      <input
                        type="text"
                        value={config.businessAccountId}
                        onChange={(e) => handleInputChange('businessAccountId', e.target.value)}
                        placeholder="Optional"
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                        <Phone className="w-3 h-3 inline mr-1" />
                        Business Phone Number
                      </label>
                      <input
                        type="text"
                        value={config.phoneNumber}
                        onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                        placeholder="+923001234567"
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                </details>

                {/* Save Button */}
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold text-sm hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving & Testing…</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Save & Connect</>
                  )}
                </button>

                {/* Webhook URL Info */}
                <div className="text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 space-y-1">
                  <p className="font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Webhook URL</p>
                  <p className="font-mono break-all text-emerald-600 dark:text-emerald-400">
                    {window.location.origin}/api/whatsapp/webhook
                  </p>
                  <p className="mt-1">
                    Set this URL in Meta Developer Portal → WhatsApp → Configuration → Webhook.
                    Use the Verify Token you set above.
                  </p>
                </div>
              </div>
            ) : (
              /* ---- Easy Connect (OAuth) Mode ---- */
              <div className="space-y-6 text-center py-4">
                <div className="mx-auto w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-zinc-900 dark:text-white">
                    Connect with WhatsApp
                  </h4>
                  <p className="text-xs text-zinc-500 mt-2 max-w-sm mx-auto">
                    Securely connect your WhatsApp Business Account via Meta.
                    We'll access your WABA and phone numbers to send and receive messages.
                  </p>
                </div>

                <motion.button
                  onClick={handleOAuthLogin}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all flex items-center justify-center gap-2"
                >
                  <LogIn className="w-5 h-5" />
                  Connect via Meta Login
                </motion.button>

                <div className="text-xs text-zinc-400 space-y-2">
                  <p className="flex items-center justify-center gap-2">
                    <Shield className="w-3 h-3" />
                    Only requests WhatsApp Business message permissions
                  </p>
                </div>

                <button 
                  onClick={() => setAdvancedMode(true)} 
                  className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline underline-offset-4"
                >
                  Use Manual Developer Setup (Advanced)
                </button>

                {/* Requirements Box */}
                <div className="text-left bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-5 space-y-3">
                  <p className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest">
                    Before connecting:
                  </p>
                  {[
                    'Have a WhatsApp Business Account in Meta Business Suite',
                    'A phone number registered with WhatsApp Business Cloud API',
                    'Your Meta App has WhatsApp product added',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs text-amber-600 dark:text-amber-400">
                      <span className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</span>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="flex items-center justify-center gap-3 text-zinc-500 dark:text-zinc-400 py-4">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">{phase === 'testing' ? 'Testing connection…' : 'Saving configuration…'}</span>
        </div>
      )}
    </div>
  );
}
