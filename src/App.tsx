import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Signin from './components/Signin';
import Signup from './components/Signup';
import TeamLogin from './components/TeamLogin';
import OnboardingWizard from './components/OnboardingWizard';
import ErrorPage from './components/ErrorPage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

import { LayoutDashboard, Package, ShieldCheck, Settings, LogOut, Menu, X, Smartphone, MessageSquare, Sun, Moon, Megaphone, FileText, ChevronDown, ChevronRight, CreditCard, Share2, Users, Store, Shield, DollarSign, HelpCircle, Tag, ShoppingBag, Zap, History, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { SalesState, Session } from './types';


function getAdminId(): string {
  return localStorage.getItem('adminId') || 'default-admin';
}

function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

axios.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['x-admin-id'] = getAdminId();
  return config;
});

const ErrorBoundary = React.lazy(() => import('./components/ErrorBoundary'));
const LandingPage = React.lazy(() => import('./components/LandingPage'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const WhatsAppConnector = React.lazy(() => import('./components/WhatsAppConnector'));
const LiveChat = React.lazy(() => import('./components/LiveChat'));
const BroadcastManager = React.lazy(() => import('./components/BroadcastManager'));
const ReportManager = React.lazy(() => import('./components/ReportManager'));
const PaymentSettings = React.lazy(() => import('./components/PaymentSettings'));
const BotTester = React.lazy(() => import('./components/BotTester'));
const OrderVerifier = React.lazy(() => import('./components/OrderVerifier'));
const ProductManager = React.lazy(() => import('./components/ProductManager'));
const DealManager = React.lazy(() => import('./components/DealManager'));
const Channels = React.lazy(() => import('./components/Channels'));
const ReEngagement = React.lazy(() => import('./components/ReEngagement'));
const SuperAdmin = React.lazy(() => import('./components/SuperAdmin'));
const Billing = React.lazy(() => import('./components/Billing'));
const SettingsPage = React.lazy(() => import('./components/Settings'));
const AiTraining = React.lazy(() => import('./components/AiTraining'));
const HelpPage = React.lazy(() => import('./components/Help'));
const AutoPublisher = React.lazy(() => import('./components/AutoPublisher'));
const TeamMembers = React.lazy(() => import('./components/TeamMembers'));
const AuditLogs = React.lazy(() => import('./components/AuditLogs'));
const BulkImport = React.lazy(() => import('./components/BulkImport'));

const TabFallback = () => <div className="flex items-center justify-center h-64 text-zinc-400 text-sm font-medium">Loading...</div>;


axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthError =
      error.response?.status === 401 ||
      (error.response?.status === 500 && (
        error.response?.data?.error === 'Invalid or expired token' ||
        error.response?.data?.error === 'Authentication required'
      ));

    if (isAuthError) {
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('adminId');
      localStorage.removeItem('authToken');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

type MainTab = 'dashboard' | 'whatsapp' | 'features' | 'channels' | 'products' | 'reports' | 'help' | 'payments' | 'settings' | 'training' | 'super' | 'billing' | 'team' | 'audit' | 'bulk-import';
type WhatsAppSubTab = 'connector' | 'chats';
type ProductsSubTab = 'products' | 'deals';
type FeaturesSubTab = 'broadcast' | 'reengage' | 'autopost' | 'tester' | 'orders';

export default function App() {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>(() => {
    return (localStorage.getItem('activeMainTab') as MainTab) || 'dashboard';
  });
  const [whatsappSubTab, setWhatsappSubTab] = useState<WhatsAppSubTab>(() => {
    return (localStorage.getItem('whatsappSubTab') as WhatsAppSubTab) || 'connector';
  });
  const [productsSubTab, setProductsSubTab] = useState<ProductsSubTab>(() => {
    return (localStorage.getItem('productsSubTab') as ProductsSubTab) || 'products';
  });
  const [featuresSubTab, setFeaturesSubTab] = useState<FeaturesSubTab>(() => {
    return (localStorage.getItem('featuresSubTab') as FeaturesSubTab) || 'broadcast';
  });
  const [whatsappExpanded, setWhatsappExpanded] = useState(true);
  const [productsExpanded, setProductsExpanded] = useState(true);
  const [featuresExpanded, setFeaturesExpanded] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  type ThemeMode = 'light' | 'dark' | 'auto';
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('theme') as ThemeMode) || 'auto';
  });
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAdmin') === 'true';
  });
  // When the user clicks "Get Started" we show the Login component instead of the landing page
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showTeamLogin, setShowTeamLogin] = useState(false);
  const [notifiedSessionIds, setNotifiedSessionIds] = useState<Set<string>>(new Set());
  const [pendingCount, setPendingCount] = useState(0);
  const [businessLogo, setBusinessLogo] = useState('');
  const [storeName, setStoreName] = useState('SalesForce');

  const shortcuts = useMemo(() => [
    { key: 'k', ctrl: true, handler: () => { const el = document.querySelector<HTMLInputElement>('[data-search]'); el?.focus(); }, description: 'Search' },
    { key: 'n', ctrl: true, handler: () => { const btn = document.querySelector<HTMLButtonElement>('[data-add]'); btn?.click(); }, description: 'New Item' },
    { key: 'Escape', handler: () => { document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b => b.click()); }, description: 'Close Modal' },
    { key: 'd', ctrl: true, handler: () => setTheme(t => t === 'dark' ? 'light' : t === 'light' ? 'auto' : 'dark'), description: 'Toggle Theme' },
  ], []);
  useKeyboardShortcuts(shortcuts, isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      axios.get('/api/settings').then(res => {
        setBusinessLogo(res.data.businessLogo || '');
        setStoreName(res.data.storeName || 'SalesForce');
      }).catch(() => { });
    }
  }, [isAuthenticated]);

  // Use ref for notifiedSessionIds to avoid dependency loop
  const notifiedSessionIdsRef = useRef(notifiedSessionIds);
  notifiedSessionIdsRef.current = notifiedSessionIds;

  // Save active tab to localStorage on change
  React.useEffect(() => {
    localStorage.setItem('activeMainTab', activeMainTab);
  }, [activeMainTab]);

  React.useEffect(() => {
    localStorage.setItem('whatsappSubTab', whatsappSubTab);
  }, [whatsappSubTab]);

  React.useEffect(() => {
    localStorage.setItem('productsSubTab', productsSubTab);
  }, [productsSubTab]);

  React.useEffect(() => {
    localStorage.setItem('featuresSubTab', featuresSubTab);
  }, [featuresSubTab]);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateEffective = () => {
      const effective = theme === 'auto' ? (mediaQuery.matches ? 'dark' : 'light') : theme;
      setEffectiveTheme(effective);
      if (effective === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    updateEffective();
    localStorage.setItem('theme', theme);
    mediaQuery.addEventListener('change', updateEffective);
    return () => mediaQuery.removeEventListener('change', updateEffective);
  }, [theme]);

  // Global Notification System - fixed to not cause infinite re-renders
  React.useEffect(() => {
    if (!isAuthenticated) return;

    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    const checkPendingPayments = async () => {
      try {
        const res = await axios.get('/api/sessions');
        const sessions: Session[] = res.data;
        const pending = sessions.filter(s => s.state === SalesState.PAYMENT_SENT);
        setPendingCount(pending.length);

        pending.forEach(s => {
          // Use ref to check without dependency loop
          if (!notifiedSessionIdsRef.current.has(s.id)) {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New Payment Received!', {
                body: `Customer ${s.userId.slice(-6)} has sent a payment screenshot. Please verify.`,
              });
            }
            setNotifiedSessionIds(prev => new Set(prev).add(s.id));

            // Play notification beep using inline data URI (no AudioContext, no user interaction needed)
            try {
              const beep = new Audio('data:audio/wav;base64,UklGRtQEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YbAEAAB/z/vurVcTASh3yfrxtV8YACJvw/f1vGcdAB1nvPX3w28iABhftfH6yXcoARNXre77z34uAg9Qpur81YY0AwxInuX92446BghBluD+4JZBCAY6jtv95Z5IDAM0htX86qZQDwIuf8/77q1XEwEod8n68bVfGAAib8P39bxnHQAdZ7z198NvIgAYX7Xx+sl3KAETV63u+89/LgIPUKbq/NWGNAMMSJ7l/duOOgYIQZbg/uCWQQgGOo7b/eWeSAwDNIbV/OqmUA8CLn/P++6tVxMBKHfJ+vG1XxgAIm/D9/W8Zx0AHWe89ffDbyIAGF+18frJdygBE1et7vvPfi4CD1Cm6vzVhjQDDEie5f3bjjoGCEGW4P7glkEIBjqO2/3lnkgMAzSG1fzqplAPAi5+z/vurVcTASh3yfrxtV8YACJvw/f1vGcdAB1nvPX3w28iABhftfH6yXcoARNXre77z34uAg9Qpur81YY0AwxInuX92446BghBluD+4JZBCAY6jtv95Z5IDAM0htX86qZQDwIuf8/77q1XEwEod8n68bVfGAAib8P39bxnHQAdZ7z198NvIgAYX7Xx+sl3KAETV63u+89+LgIPUKbq/NWGNAMMSJ7l/duOOgYIQZbg/uCWQQgGOo7b/eWeSAwDNIbV/OqmUA8CLn/P++6tVxMBKHfJ+vG1XxgAIm/D9/W8Zx0AHWe89ffDbyIAGF+18frJdygBE1et7vvPfi4CD1Cm6vzVhjQDDEie5f3bjjoGCEGW4P7glkEIBjqO2/3lnkgMAzSG1fzqplAPAi5/P++6tVxMBKHfJ+vG1XxgAIm/D9/W8Zx0AHWe89ffDbyIAGF+18frJdygBE1et7vvPfi4CD1Cm6vzVhjQDDEie5f3bjjoGCEGW4P7glkEIBjqO2/3lnkgMAzSG1fzqplAPAi4=');
              beep.volume = 0.3;
              beep.play().catch(() => { }); // Browser may block — silently ignore
            } catch (e) { }
          }
        });
      } catch (err) {
        // Ignore silent errors
      }
    };

    const interval = setInterval(checkPendingPayments, 10000);
    checkPendingPayments();
    return () => clearInterval(interval);
  }, [isAuthenticated]); // Only depend on isAuthenticated, NOT notifiedSessionIds

  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const handleLogin = async () => {
    setIsAuthenticated(true);
    localStorage.setItem('isAdmin', 'true');
    localStorage.setItem('activeMainTab', 'dashboard');
    localStorage.setItem('whatsappSubTab', 'connector');
    setActiveMainTab('dashboard');
    setWhatsappSubTab('connector');
    try {
      const res = await axios.get('/api/settings');
      if (res.data?.onboardingComplete === false) {
        setNeedsOnboarding(true);
      }
    } catch {
      // If settings fetch fails, treat as complete
    }
  };

  const handleOnboardingComplete = () => {
    setNeedsOnboarding(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('adminId');
    localStorage.removeItem('authToken');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    if (showSignup) {
      return <QueryClientProvider client={queryClient}><Signup onSignup={handleLogin} onSignIn={() => { setShowSignup(false); setShowLogin(true); }} /><React.Suspense fallback={null}><div><Toaster /></div></React.Suspense></QueryClientProvider>;
    }
    if (showLogin) {
      return <QueryClientProvider client={queryClient}><Signin onSignin={handleLogin} onSignUp={() => { setShowLogin(false); setShowSignup(true); }} /><React.Suspense fallback={null}><div><Toaster /></div></React.Suspense></QueryClientProvider>;
    }
    if (showTeamLogin) {
      return <QueryClientProvider client={queryClient}><TeamLogin onLogin={handleLogin} onBackToAdmin={() => setShowTeamLogin(false)} /><React.Suspense fallback={null}><div><Toaster /></div></React.Suspense></QueryClientProvider>;
    }
    return (
      <QueryClientProvider client={queryClient}>
        <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
          <LandingPage onGetStarted={() => setShowSignup(true)} onLogin={() => setShowLogin(true)} onTeamLogin={() => setShowTeamLogin(true)} />
        </React.Suspense>
        <React.Suspense fallback={null}><div><Toaster /></div></React.Suspense>
      </QueryClientProvider>
    );
  }

  if (needsOnboarding) {
    return <QueryClientProvider client={queryClient}><OnboardingWizard onComplete={handleOnboardingComplete} /><React.Suspense fallback={null}><div><Toaster /></div></React.Suspense></QueryClientProvider>;
  }

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
    { id: 'features', label: 'Features', icon: Zap },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'billing', label: 'Billing', icon: DollarSign },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'channels', label: 'Channels', icon: Share2 },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'help', label: 'Help', icon: HelpCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'training', label: 'AI Training', icon: Zap },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'audit', label: 'Audit Log', icon: History },
    { id: 'bulk-import', label: 'Bulk Import', icon: Upload },
  ] as any[];

  if (getAdminId() === 'default-admin') {
    tabs.unshift({ id: 'super', label: 'Platform', icon: Shield });
  }

  const whatsappSubTabs = [
    { id: 'connector', label: 'Connection', icon: Smartphone },
    { id: 'chats', label: 'Live Chat', icon: MessageSquare },
  ] as const;

  const productsSubTabs = [
    { id: 'products', label: 'Products', icon: ShoppingBag },
    { id: 'deals', label: 'Deals', icon: Tag },
  ] as const;

  const featuresSubTabs = [
    { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
    { id: 'reengage', label: 'Re-Engage', icon: Users },
    { id: 'autopost', label: 'AI Publisher', icon: Megaphone },
    { id: 'tester', label: 'Simulator', icon: MessageSquare },
    { id: 'orders', label: 'Verification', icon: ShieldCheck },
  ] as const;

  const handleMainTabClick = (tabId: string) => {
    if (tabId === 'whatsapp') {
      if (activeMainTab !== 'whatsapp') {
        setActiveMainTab('whatsapp');
        setWhatsappExpanded(true);
        setWhatsappSubTab('connector');
      } else {
        setWhatsappExpanded(!whatsappExpanded);
      }
    } else if (tabId === 'products') {
      if (activeMainTab !== 'products') {
        setActiveMainTab('products');
        setProductsExpanded(true);
        setProductsSubTab('products');
      } else {
        setProductsExpanded(!productsExpanded);
      }
    } else if (tabId === 'features') {
      if (activeMainTab !== 'features') {
        setActiveMainTab('features');
        setFeaturesExpanded(true);
        setFeaturesSubTab('broadcast');
      } else {
        setFeaturesExpanded(!featuresExpanded);
      }
    } else {
      setWhatsappExpanded(false);
      setProductsExpanded(false);
      setFeaturesExpanded(false);
      setActiveMainTab(tabId as MainTab);
    }
  };

  const getActiveTab = () => {
    if (activeMainTab === 'whatsapp') {
      if (whatsappSubTab === 'chats') return 'chats';
      return 'whatsapp';
    }
    if (activeMainTab === 'products') {
      if (productsSubTab === 'deals') return 'deals';
      return 'products';
    }
    if (activeMainTab === 'features') {
      if (featuresSubTab === 'reengage') return 'reengage';
      if (featuresSubTab === 'autopost') return 'autopost';
      if (featuresSubTab === 'tester') return 'tester';
      if (featuresSubTab === 'orders') return 'orders';
      return 'broadcast';
    }
    return activeMainTab;
  };

  return (
    <QueryClientProvider client={queryClient}>
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 transition-colors flex font-sans text-zinc-900 dark:text-zinc-100">
      <React.Suspense fallback={null}><div><Toaster /></div></React.Suspense>
      {/* Sidebar */}
      <ErrorBoundary fallback={
        <aside className="w-[280px] bg-white dark:bg-zinc-950 border-r border-zinc-100 dark:border-zinc-800/50 flex items-center justify-center p-6">
          <p className="text-xs text-red-500 font-medium">Sidebar error</p>
        </aside>
      }>
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="bg-white dark:bg-zinc-950 border-r border-zinc-100 dark:border-zinc-800/50 overflow-hidden relative flex flex-col transition-colors shadow-lg dark:shadow-none"
      >
        <div className="p-6 flex-1">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 bg-emerald-500/30 rounded-xl blur-md" />
              {businessLogo ? (
                <img src={businessLogo} alt="Logo" className="relative w-10 h-10 rounded-xl object-cover shadow-lg" />
              ) : (
                <div className="relative w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Store className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            <div>
              <h1 className="font-black text-base tracking-tight text-zinc-900 dark:text-white leading-none">{storeName}</h1>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-0.5">AI Agent</p>
            </div>
          </div>

          <nav className="space-y-1">
            {tabs.map((tab) => {
              const isActive = activeMainTab === tab.id && tab.id !== 'whatsapp' && tab.id !== 'features';
              const isWhatsApp = tab.id === 'whatsapp';
              const isWhatsAppActive = activeMainTab === 'whatsapp';
              const isFeatures = tab.id === 'features';
              const isFeaturesActive = activeMainTab === 'features';
              const iconColors: Record<string, string> = {
                dashboard: 'text-blue-500',
                whatsapp: 'text-emerald-500',
                features: 'text-rose-500',
                channels: 'text-indigo-500',
                products: 'text-violet-500',
                reports: 'text-blue-500',
                payments: 'text-purple-500',
              };
              return (
                <div key={tab.id} className="relative">
                  <button
                    onClick={() => handleMainTabClick(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${isActive || (isWhatsApp && isWhatsAppActive) || (isFeatures && isFeaturesActive)
                      ? 'bg-zinc-900 dark:bg-zinc-800 text-white shadow-lg shadow-zinc-900/30 dark:shadow-none'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ${isActive || (isWhatsApp && isWhatsAppActive) || (isFeatures && isFeaturesActive) ? 'hidden' : ''
                      }`} />
                    {(isActive || (isWhatsApp && isWhatsAppActive) || (isFeatures && isFeaturesActive)) && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-400 rounded-r-full"
                      />
                    )}
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className={`relative z-10 transition-transform duration-200`}
                    >
                      <tab.icon className={`w-5 h-5 transition-all ${isActive || (isWhatsApp && isWhatsAppActive) || (isFeatures && isFeaturesActive) ? 'text-white' : iconColors[tab.id] + ' opacity-70 group-hover:opacity-100 group-hover:drop-shadow-sm'}`} />
                    </motion.div>
                    <span className="relative z-10 font-bold text-sm">{tab.label}</span>
                    {(tab.id === 'whatsapp' || tab.id === 'products' || tab.id === 'features') && (
                      <motion.div
                        animate={{ rotate: (tab.id === 'whatsapp' ? whatsappExpanded : tab.id === 'products' ? productsExpanded : featuresExpanded) ? 0 : -90 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="ml-auto"
                      >
                        <ChevronDown className="w-4 h-4 opacity-60" />
                      </motion.div>
                    )}
                  </button>

                  {/* Products Sub-tabs */}
                  {tab.id === 'products' && activeMainTab === 'products' && productsExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="ml-3 pl-4 mt-2 space-y-1 border-l-2 border-violet-500/40 overflow-hidden"
                    >
                      {productsSubTabs.map((subTab, index) => {
                        const isSubActive = productsSubTab === subTab.id;
                        return (
                          <motion.button
                            key={subTab.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => setProductsSubTab(subTab.id as ProductsSubTab)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group relative ml-[-2px] ${isSubActive
                              ? 'bg-gradient-to-r from-violet-500/20 to-transparent text-violet-600 dark:text-violet-400 border border-violet-500/30'
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700'
                              }`}
                          >
                            {isSubActive && (
                              <motion.div
                                layoutId="activeProductsSubTab"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-violet-400 rounded-r-full shadow-lg shadow-violet-500/50"
                              />
                            )}
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <subTab.icon className={`w-4 h-4 ${isSubActive ? 'text-violet-500 drop-shadow-sm' : 'opacity-50 group-hover:opacity-80'}`} />
                            </motion.div>
                            <span className="font-bold text-sm">{subTab.label}</span>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* WhatsApp Sub-tabs */}
                  {tab.id === 'whatsapp' && activeMainTab === 'whatsapp' && whatsappExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="ml-3 pl-4 mt-2 space-y-1 border-l-2 border-emerald-500/40 overflow-hidden"
                    >
                      {whatsappSubTabs.map((subTab, index) => {
                        const isSubActive = whatsappSubTab === subTab.id;
                        return (
                          <motion.button
                            key={subTab.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => setWhatsappSubTab(subTab.id as WhatsAppSubTab)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group relative ml-[-2px] ${isSubActive
                              ? 'bg-gradient-to-r from-emerald-500/20 to-transparent text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700'
                              }`}
                          >
                            {isSubActive && (
                              <motion.div
                                layoutId="activeSubTab"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-400 rounded-r-full shadow-lg shadow-emerald-500/50"
                              />
                            )}
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <subTab.icon className={`w-4 h-4 ${isSubActive ? 'text-emerald-500 drop-shadow-sm' : 'opacity-50 group-hover:opacity-80'}`} />
                            </motion.div>
                            <span className="font-bold text-sm">{subTab.label}</span>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* Features Sub-tabs */}
                  {tab.id === 'features' && activeMainTab === 'features' && featuresExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="ml-3 pl-4 mt-2 space-y-1 border-l-2 border-rose-500/40 overflow-hidden"
                    >
                      {featuresSubTabs.map((subTab, index) => {
                        const isSubActive = featuresSubTab === subTab.id;
                        return (
                          <motion.button
                            key={subTab.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => setFeaturesSubTab(subTab.id as FeaturesSubTab)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group relative ml-[-2px] ${isSubActive
                              ? 'bg-gradient-to-r from-rose-500/20 to-transparent text-rose-600 dark:text-rose-400 border border-rose-500/30'
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700'
                              }`}
                          >
                            {isSubActive && (
                              <motion.div
                                layoutId="activeFeaturesSubTab"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-rose-400 rounded-r-full shadow-lg shadow-rose-500/50"
                              />
                            )}
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <subTab.icon className={`w-4 h-4 ${isSubActive ? 'text-rose-500 drop-shadow-sm' : 'opacity-50 group-hover:opacity-80'}`} />
                            </motion.div>
                            <span className="font-bold text-sm">{subTab.label}</span>
                            {subTab.id === 'orders' && pendingCount > 0 && (
                              <motion.span
                                whileHover={{ scale: 1.2 }}
                                className="ml-auto w-5 h-5 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-amber-500/50"
                              >
                                {pendingCount}
                              </motion.span>
                            )}
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Bottom section - Theme Toggle */}
          <div className="p-6 border-t border-zinc-100 dark:border-zinc-800/50 space-y-3 transition-colors">
            <div className="relative bg-zinc-100 dark:bg-zinc-900 rounded-2xl p-1 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <motion.div
                layoutId="themeToggleBg"
                className={`absolute top-1 bottom-1 w-[calc(33.33%-2px)] rounded-xl z-0 ${theme === 'light' ? 'left-1 bg-white shadow-md' : theme === 'dark' ? 'left-[calc(33.33%+1px)] bg-zinc-800 shadow-lg' : 'left-[calc(66.66%+1px)] bg-zinc-800/50 shadow-lg'
                  }`}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
              <div className="relative z-10 flex">
                <button
                  onClick={() => setTheme('light')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-colors"
                >
                  <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-amber-500' : 'text-zinc-400'}`} />
                  <span className={theme === 'light' ? 'text-zinc-900' : 'text-zinc-400'}>Light</span>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-colors"
                >
                  <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-blue-400' : 'text-zinc-400'}`} />
                  <span className={theme === 'dark' ? 'text-white' : 'text-zinc-400'}>Dark</span>
                </button>
                <button
                  onClick={() => setTheme('auto')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-colors"
                >
                  <motion.div
                    animate={{ rotate: theme === 'auto' ? 0 : theme === 'dark' ? 180 : -180 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <svg className={`w-3.5 h-3.5 ${theme === 'auto' ? 'text-emerald-400' : 'text-zinc-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </motion.div>
                  <span className={theme === 'auto' ? 'text-emerald-400' : 'text-zinc-400'}>Auto</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.aside>
      </ErrorBoundary>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between px-6 sticky top-0 z-10 transition-colors">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 dark:text-zinc-400 transition-colors"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleLogout}
            className="p-2.5 rounded-xl text-zinc-400 dark:text-zinc-500 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </motion.button>
        </header>

        <div className="py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={getActiveTab()}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
            >
              <Suspense fallback={<TabFallback />}>
              <ErrorBoundary>
                {activeMainTab === 'dashboard' && <Dashboard />}
                {activeMainTab === 'whatsapp' && whatsappSubTab === 'connector' && <WhatsAppConnector />}
                {activeMainTab === 'whatsapp' && whatsappSubTab === 'chats' && <LiveChat />}
                {activeMainTab === 'features' && featuresSubTab === 'broadcast' && <BroadcastManager onNavigate={handleMainTabClick} />}
                {activeMainTab === 'features' && featuresSubTab === 'reengage' && <ReEngagement onNavigate={handleMainTabClick} />}
                {activeMainTab === 'features' && featuresSubTab === 'autopost' && <AutoPublisher />}
                {activeMainTab === 'features' && featuresSubTab === 'tester' && <BotTester />}
                {activeMainTab === 'features' && featuresSubTab === 'orders' && <OrderVerifier />}
                {activeMainTab === 'channels' && <Channels onNavigate={handleMainTabClick} />}
                {activeMainTab === 'products' && productsSubTab === 'products' && <ProductManager />}
                {activeMainTab === 'products' && productsSubTab === 'deals' && <DealManager />}
                {activeMainTab === 'reports' && <ReportManager />}
                {activeMainTab === 'billing' && <Billing />}
                {activeMainTab === 'payments' && <PaymentSettings />}
                {activeMainTab === 'help' && <HelpPage />}
                {activeMainTab === 'settings' && <SettingsPage />}
                {activeMainTab === 'training' && <AiTraining />}
                {activeMainTab === 'super' && <SuperAdmin />}
                {activeMainTab === 'team' && <TeamMembers />}
                {activeMainTab === 'audit' && <AuditLogs />}
                {activeMainTab === 'bulk-import' && <BulkImport />}
                {!['dashboard','whatsapp','features','channels','products','reports','billing','payments','help','settings','training','super','team','audit','bulk-import'].includes(activeMainTab) && <ErrorPage type="404" />}
              </ErrorBoundary>
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
    </QueryClientProvider>
  );
}