import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight, ChevronRight, Bot, MessageCircle, Star, Sparkles, Shield,
  Zap, BarChart3, Users, Globe, Smartphone, CheckCircle,
  ChevronDown, Menu, X, Clock, TrendingUp, DollarSign, Layers,
  Target, RefreshCw, MessageSquare, Play, Rocket, LineChart,
  Quote, HeadphonesIcon, ShoppingBag, Wallet, Repeat, Gem, Eye,
  Activity, Bell, Gift, Infinity, Lock, Mail, Phone, HelpCircle,
  Store,
} from 'lucide-react';
import ChatWidget from './ChatWidget';

type Props = { onGetStarted?: () => void; onLogin?: () => void };

const GradientText = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={`bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-500 bg-clip-text text-transparent ${className}`}>{children}</span>
);

const brands = [
  'Shopify', 'WooCommerce', 'Meta', 'Stripe', 'WhatsApp', 'Gemini AI'
];

const pricingPlans = [
  { name: 'Free', price: 'Rs.0', desc: 'Perfect for testing', popular: false, features: ['30 sessions/mo', '5 products', 'WhatsApp only', 'Basic AI replies', 'Community support'] },
  { name: 'Basic', price: 'Rs.1,500', desc: 'For growing stores', popular: false, features: ['300 sessions/mo', '20 products', 'Email reports', 'Smart negotiation', 'Basic analytics'] },
  { name: 'Professional', price: 'Rs.3,000', desc: 'Most popular', popular: true, features: ['Unlimited sessions', '100 products', 'All channels', 'Re-engagement', 'Payment verification', 'Priority support', 'Custom AI training'] },
  { name: 'Enterprise', price: 'Rs.7,000', desc: 'For large businesses', popular: false, features: ['Unlimited sessions', 'Unlimited products', 'Custom AI training', 'Dedicated support', 'SLA guarantee', 'White-label', 'API access'] },
];

const features = [
  { icon: Bot, title: 'AI Conversations', desc: 'Human-like WhatsApp replies that sell your products 24/7.' },
  { icon: Target, title: 'Smart Negotiation', desc: 'AI automatically negotiates prices within your limits to close deals.' },
  { icon: Shield, title: 'Payment Verification', desc: 'AI analyzes payment screenshots instantly — no manual checking.' },
  { icon: Globe, title: 'Multi-Language', desc: 'Urdu, English, and more — your customers get replies in their language.' },
  { icon: RefreshCw, title: 'Re-engagement', desc: 'Automatically follow up with inactive customers and recover lost sales.' },
  { icon: BarChart3, title: 'Live Analytics', desc: 'Track conversions, revenue, top products, and AI performance in real-time.' },
  { icon: Layers, title: 'Multi-Channel', desc: 'WhatsApp, Facebook, Instagram, Telegram — all from one dashboard.' },
  { icon: TrendingUp, title: 'AI Lead Scoring', desc: 'Identify high-converting customers and prioritize hot leads automatically.' },
];

const testimonials = [
  { name: 'Ali Raza', store: 'FashionHub.pk', text: 'Our WhatsApp sales increased by 43% in just 2 weeks. The AI handles everything!', rating: 5, revenue: '+Rs.280K' },
  { name: 'Sana Malik', store: 'Sana Cosmetics', text: 'AI replies better than my human agents. Payment verification is a lifesaver.', rating: 5, revenue: '+Rs.150K' },
  { name: 'Usman Khan', store: 'TechZone', text: 'I was skeptical, but the AI closed 12 orders on the first day alone. Insane!', rating: 5, revenue: '+Rs.420K' },
  { name: 'Fatima Ahmed', store: 'Fatima Luxe', text: 'We saved 60+ hours per week. The AI handles 90% of customer queries now.', rating: 5, revenue: '+Rs.310K' },
];

const faqs = [
  { q: 'Is this the official WhatsApp API?', a: 'We use whatsapp-web.js which connects through WhatsApp Web. No API fees or approval needed.' },
  { q: 'Can I use my own number?', a: 'Yes! You can connect your existing WhatsApp number. The AI works from your own account.' },
  { q: 'Does the AI support Urdu?', a: 'Absolutely. Our AI is trained for Urdu, English, and mixed (Roman Urdu). Customers get replies in their language.' },
  { q: 'Is payment verification automatic?', a: 'Yes. When a customer sends a payment screenshot, the AI analyzes it using computer vision and confirms the payment.' },
  { q: 'Can I cancel anytime?', a: 'No contracts. You can cancel your subscription anytime. Your data stays with you.' },
  { q: 'How long does setup take?', a: 'Less than 5 minutes. Connect WhatsApp, add products, and the AI starts selling immediately.' },
  { q: 'Is it safe to connect my WhatsApp account?', a: 'Absolutely. Your WhatsApp session runs inside an isolated container. We never store your messages on our servers beyond what is required for order processing. Your personal chats remain private and the AI only interacts with customers who message your business. All data is encrypted in transit and at rest.' },
  { q: 'Can I connect Facebook, Instagram, and Telegram safely?', a: 'Yes, all platforms are connected through official APIs or secure web interfaces. Each channel runs in its own isolated sandbox, so a compromise in one never affects another. We follow OAuth 2.0 best practices and never store your social media passwords. Access tokens are encrypted and rotated regularly.' },
  { q: 'What happens to my data if I cancel?', a: 'Your data is yours. Upon cancellation, we retain your data for 30 days (grace period) in case you wish to reactivate. After that, all your customer conversations, order history, and product data are permanently deleted from our servers. You can request an export anytime before deletion.' },
  { q: 'How does the AI handle sensitive customer information?', a: 'All sensitive data like phone numbers, addresses, and payment screenshots are encrypted at rest using AES-256. The AI model never trains on your customer data — each instance is isolated. Payment verification is done in-memory and discarded immediately after processing.' },
  { q: 'Is the platform GDPR and data protection compliant?', a: 'Yes. We follow GDPR guidelines for data processing and storage. Customer conversations are retained only for order processing and deleted after 90 days. You have full right to access, modify, or delete any customer data associated with your account at any time.' },
  { q: 'Can someone else access my WhatsApp if I connect it here?', a: 'No. Your WhatsApp session is securely stored with encryption and tied exclusively to your account. We use browser-level isolation similar to how WhatsApp Web works — except it runs on our secure server. You can disconnect anytime, and the session is immediately destroyed.' },
];

const stats = [
  { icon: MessageCircle, value: '50K+', label: 'Conversations Automated' },
  { icon: DollarSign, value: 'Rs.5M+', label: 'Revenue Processed' },
  { icon: Users, value: '500+', label: 'Active Store Owners' },
  { icon: TrendingUp, value: '94%', label: 'Customer Satisfaction' },
];

function TypeWriter({ texts, speed = 40 }: { texts: string[]; speed?: number }) {
  const [displayed, setDisplayed] = useState('');
  const [i, setI] = useState(0);
  const [char, setChar] = useState(0);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const t = texts[i] || '';
    if (deleting) {
      if (char === 0) { setDeleting(false); setI((i + 1) % texts.length); return; }
      const to = setTimeout(() => { setDisplayed(t.slice(0, char - 1)); setChar(char - 1); }, speed / 2);
      return () => clearTimeout(to);
    }
    if (char >= t.length) {
      const to = setTimeout(() => setDeleting(true), 2500);
      return () => clearTimeout(to);
    }
    const to = setTimeout(() => { setDisplayed(t.slice(0, char + 1)); setChar(char + 1); }, speed);
    return () => clearTimeout(to);
  }, [char, deleting, i, texts, speed]);
  return <span>{displayed}<motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: 999999, duration: 0.8 }}>|</motion.span></span>;
}

export default function LandingPage({ onGetStarted, onLogin }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeDemoMsg, setActiveDemoMsg] = useState(0);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveDemoMsg(prev => (prev + 1) % 6);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2500);
  };

  const handleFooterLink = (link: string) => {
    const sectionMap: Record<string, string> = {
      Features: 'features',
      Pricing: 'pricing',
      Demo: 'demo',
    };
    const id = sectionMap[link];
    if (id) {
      scrollTo(id);
    } else {
      showToast(`${link} — Coming soon!`);
    }
  };

  const demoMessages = [
    { side: 'left', text: 'Price kya hai?', icon: 'user' },
    { side: 'left', text: 'Delivery kitne din me hogi?', icon: 'user' },
    { side: 'right', text: 'Sir aaj special offer hai! 15% discount 🎉', icon: 'bot' },
    { side: 'right', text: 'Lahore main 2 working days 🚚', icon: 'bot' },
    { side: 'right', text: 'Payment screenshot bhej dein, main verify karti hoon! ✅', icon: 'bot' },
    { side: 'left', text: 'Order confirm kr do 👍', icon: 'user' },
  ];

  return (
    <div className="bg-white text-zinc-900 font-sans overflow-hidden">
      {/* ========== NAVBAR ========== */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-2xl border-b border-zinc-100 shadow-lg shadow-black/5 transition-all duration-500"
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8 flex items-center justify-between h-20 sm:h-24">
          <button onClick={() => scrollTo('hero')} className="flex items-center gap-3 group cursor-pointer">
            <motion.div
              whileHover={{ rotate: -10, scale: 1.1 }}
              className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30"
            >
              <Rocket className="w-6 h-6 text-white" />
            </motion.div>
            <span className="font-black text-2xl tracking-tight text-zinc-900">SaaS<span className="text-emerald-500">Closer</span></span>
          </button>
          <div className="hidden md:flex items-center gap-12">
            {['Features', 'Pricing', 'Demo'].map(item => (
              <button
                key={item}
                onClick={() => scrollTo(item.toLowerCase())}
                className="relative text-[17px] font-bold text-zinc-600 hover:text-zinc-900 transition-colors group"
              >
                {item}
                <span className="absolute -bottom-1.5 left-0 w-0 h-[3px] bg-emerald-500 rounded-full group-hover:w-full transition-all duration-300" />
              </button>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-5">
            <motion.button
              onClick={onLogin}
              whileHover={{ scale: 1.03 }}
              className="px-6 py-3 text-[16px] font-bold text-zinc-600 hover:text-zinc-900 transition-colors relative group rounded-xl"
            >
              Login
              <span className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-zinc-100 transition-colors" />
            </motion.button>
            <motion.button
              onClick={onGetStarted}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              className="group relative px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold text-[16px] shadow-lg shadow-emerald-500/30 overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                Start Free Trial <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-500"
                initial={{ x: '100%' }}
                whileHover={{ x: 0 }}
                transition={{ duration: 0.3 }}
              />
            </motion.button>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2.5 text-zinc-500">
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white/95 backdrop-blur-2xl border-b border-zinc-100 overflow-hidden"
            >
              <div className="px-6 py-5 space-y-3">
                {['Features', 'Pricing', 'Demo'].map(item => (
                  <button key={item} onClick={() => scrollTo(item.toLowerCase())} className="block w-full text-left py-2.5 text-base font-semibold text-zinc-500 hover:text-zinc-900 transition-colors">
                    {item}
                  </button>
                ))}
                <div className="pt-4 border-t border-zinc-100 space-y-3">
                  <button onClick={onLogin} className="block w-full text-left py-2.5 text-base font-semibold text-zinc-500 hover:text-zinc-900">Login</button>
                  <button onClick={onGetStarted} className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold text-base shadow-lg shadow-emerald-500/30">Start Free Trial</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ========== HERO ========== */}
      <section id="hero" className="relative min-h-screen flex items-center pt-24 sm:pt-28 pb-16 sm:pb-24 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="absolute top-[-15%] left-[-5%] w-[80%] h-[80%] bg-emerald-100/50 rounded-full blur-[200px]" />
          <div className="absolute bottom-[-20%] right-[-5%] w-[70%] h-[70%] bg-teal-100/50 rounded-full blur-[200px]" />
          <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-emerald-50/50 rounded-full blur-[150px]" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-600 text-xs font-bold mb-6 tracking-wide"
              >
                <Sparkles className="w-3.5 h-3.5" /> AI-POWERED SALES AUTOMATION
              </motion.div>
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black leading-[1.02] tracking-tight text-zinc-900">
                <GradientText>Your AI Sales Agent</GradientText>
                <br />for{' '}
                <span className="text-zinc-900 relative">
                  WhatsApp
                  <motion.span
                    className="absolute -bottom-2 left-0 h-1 bg-gradient-to-r from-emerald-500 to-transparent rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ delay: 1.5, duration: 0.8 }}
                  />
                </span>
              </h1>
              <p className="mt-5 text-base sm:text-lg text-zinc-500 leading-relaxed max-w-lg">
                Automate customer replies, negotiate prices, verify payments, and close orders automatically — all inside WhatsApp using AI.
              </p>

              {/* Live typing preview */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="mt-6 flex items-center gap-3 bg-zinc-50 rounded-2xl px-5 py-3 border border-zinc-100 max-w-md"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: 999999, duration: 2 }}
                  className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0"
                />
                <span className="text-sm text-zinc-600">
                  <TypeWriter texts={[
                    '👋 Hi! Welcome to our store!',
                    '🔥 Special discount available today!',
                    '✅ Your order has been confirmed!',
                    '🎉 Free delivery on all orders!',
                  ]} />
                </span>
              </motion.div>

              <div className="flex flex-wrap gap-3 mt-8">
                <motion.button
                  onClick={onGetStarted}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="group relative px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-black text-sm shadow-2xl shadow-emerald-500/40 overflow-hidden"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Start Free Trial <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-emerald-500"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: 0 }}
                    transition={{ duration: 0.4 }}
                  />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => scrollTo('demo')}
                  className="px-7 py-4 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-2xl font-bold text-sm border border-zinc-200 hover:border-zinc-300 transition-all flex items-center gap-2"
                >
                  <Play className="w-4 h-4" /> Watch Demo
                </motion.button>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.8 }}
                className="mt-6 flex items-center gap-4 text-xs text-zinc-400"
              >
                <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> No credit card</span>
                <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> 5-min setup</span>
                <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Cancel anytime</span>
              </motion.div>
            </motion.div>

            {/* Hero Visual — WhatsApp Chat UI */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <motion.div className="relative w-full max-w-[280px] mx-auto">
                <div className="aspect-[9/19] bg-gradient-to-b from-emerald-50 to-zinc-50 rounded-[2rem] shadow-2xl shadow-emerald-500/10 border border-emerald-100 overflow-hidden">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-5 bg-zinc-100 rounded-b-2xl z-10" />
                  <div className="absolute inset-2 rounded-[1.75rem] bg-white overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"><Bot className="w-4 h-4 text-white" /></div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-bold">AI Sales Agent</p>
                        <div className="flex items-center gap-1.5">
                          <motion.div
                            animate={{ scale: [1, 1.3, 1] }}
                            transition={{ repeat: 999999, duration: 2 }}
                            className="w-1.5 h-1.5 bg-emerald-300 rounded-full"
                          />
                          <p className="text-white/60 text-[10px]">Online</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <motion.div
                            key={i}
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: 999999, duration: 1.5, delay: i * 0.2 }}
                            className="w-1 h-1 bg-white/40 rounded-full"
                          />
                        ))}
                      </div>
                    </div>
                    <div className="p-3 space-y-2.5" style={{ height: 'calc(100% - 52px)', overflowY: 'auto' }}>
                      {[
                        { side: 'left', text: 'Hi! 👋 Welcome! Check out our latest collection — we have amazing deals today!', time: '10:32 AM' },
                        { side: 'right', text: 'Show me kya available hai? 😊', time: '10:33 AM' },
                        { side: 'left', text: 'Here are our top picks!', time: '10:33 AM', products: true },
                        { side: 'left', text: '🔥 Premium Sneakers — Rs.4,499\n👗 Designer Kurti — Rs.2,999\n⌚ Smart Watch — Rs.6,499', time: '10:33 AM' },
                        { side: 'right', text: 'Sneakers kitne me discount milega?', time: '10:34 AM' },
                        { side: 'left', text: 'Sir, aapke liye special offer! 🎉 10% discount on any item + free delivery!', time: '10:34 AM', highlight: true },
                        { side: 'right', text: 'Done! Order confirm kardo 👍', time: '10:35 AM' },
                        { side: 'left', text: 'Payment screenshot bhej dein ✅', time: '10:35 AM' },
                      ].map((m, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 + i * 0.2 }}
                          className={`flex ${m.side === 'left' ? 'justify-start' : 'justify-end'}`}
                        >
                          <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                            m.side === 'left'
                              ? m.highlight
                                ? 'bg-emerald-50 rounded-tl-sm border border-emerald-200'
                                : 'bg-zinc-100 rounded-tl-sm'
                              : 'bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-tr-sm'
                          }`}>
                            {m.products && (
                              <div className="flex gap-1.5 mb-2">
                                {['bg-amber-400', 'bg-violet-400', 'bg-cyan-400'].map((c, j) => (
                                  <motion.div
                                    key={j}
                                    whileHover={{ scale: 1.05 }}
                                    className={`w-12 h-12 ${c} rounded-lg cursor-pointer`}
                                  />
                                ))}
                              </div>
                            )}
                            <p className={`text-xs leading-relaxed whitespace-pre-line ${
                              m.highlight
                                ? 'text-emerald-700 font-medium'
                                : m.side === 'left'
                                  ? 'text-zinc-700'
                                  : 'text-white'
                            }`}>
                              {m.text}
                            </p>
                            <p className="text-[9px] text-right mt-1 opacity-50">{m.time}</p>
                          </div>
                        </motion.div>
                      ))}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 3 }}
                        className="flex justify-start"
                      >
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl rounded-tl-sm px-4 py-3">
                          <p className="text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" /> Order Confirmed! Payment of Rs.4,499 received!
                          </p>
                        </div>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 3.5 }}
                        className="flex justify-start"
                      >
                        <div className="bg-zinc-100 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
                          {[0, 1, 2].map(i => (
                            <motion.div
                              key={i}
                              animate={{ y: [0, -4, 0] }}
                              transition={{ repeat: 999999, duration: 0.6, delay: i * 0.15 }}
                              className="w-2 h-2 bg-emerald-500 rounded-full"
                            />
                          ))}
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </motion.div>
              <div className="absolute -inset-8 bg-gradient-to-br from-emerald-200/30 via-transparent to-teal-200/30 rounded-full blur-[100px] -z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== STATS BANNER ========== */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-emerald-100/50 rounded-3xl overflow-hidden border border-emerald-100/50"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative bg-white p-6 sm:p-8 text-center group hover:bg-emerald-50/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-zinc-900 mb-1">{stat.value}</div>
              <div className="text-xs text-zinc-500 font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ========== TRUSTED BY ========== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-[10px] font-bold text-zinc-400 uppercase tracking-[4px] mb-8"
        >
          Trusted by modern ecommerce brands worldwide
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-wrap items-center justify-center gap-8 sm:gap-16"
        >
          {brands.map((b, i) => (
            <motion.span
              key={b}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.05, opacity: 0.6 }}
              className="text-lg sm:text-xl font-black text-zinc-300 tracking-tight cursor-default transition-all"
            >
              {b}
            </motion.span>
          ))}
        </motion.div>
      </section>

      {/* ========== FEATURES GRID ========== */}
      <section id="features" className="relative max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/30 via-transparent to-transparent pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-600 text-xs font-bold mb-5"
          >
            <Zap className="w-3.5 h-3.5" /> POWERFUL FEATURES
          </motion.div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-900">
            Everything You Need to{' '}
            <span className="bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-500 bg-clip-text text-transparent">
              Sell on Auto-Pilot
            </span>
          </h2>
          <p className="mt-3 text-zinc-500 text-sm max-w-lg mx-auto">
            From intelligent conversations to payment verification — let AI handle the heavy lifting.
          </p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -6 }}
              className="relative p-6 bg-white rounded-2xl border border-zinc-100 hover:border-emerald-100 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" />
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
                <f.icon className="w-5.5 h-5.5 text-white" />
              </div>
              <h3 className="text-base font-bold text-zinc-900 mb-1.5">{f.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ========== LIVE AI CHAT DEMO ========== */}
      <section id="demo" className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-50 via-white to-teal-50 border border-emerald-100 p-6 sm:p-10 lg:p-14"
        >
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-200/30 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-200/30 rounded-full blur-[100px]" />
          <div className="relative z-10 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-600 text-xs font-bold mb-5"
              >
                <MessageSquare className="w-3.5 h-3.5" /> LIVE AI DEMO
              </motion.div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight text-zinc-900">
                See How AI <GradientText>Closes Deals</GradientText> in Real-Time
              </h2>
              <p className="mt-3 text-zinc-500 text-sm max-w-md">
                Watch how our AI agent handles customer inquiries, negotiates prices, and closes orders automatically.
              </p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="mt-6 bg-white rounded-2xl p-5 border border-zinc-200 overflow-hidden shadow-sm"
              >
                <div className="flex items-center gap-2 mb-4 text-xs text-zinc-500 font-medium">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ repeat: 999999, duration: 1.5 }}
                    className="w-2 h-2 bg-emerald-500 rounded-full"
                  />
                  Live Conversation
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeDemoMsg}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-3 items-start ${demoMessages[activeDemoMsg].side === 'right' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      demoMessages[activeDemoMsg].icon === 'bot'
                        ? 'bg-emerald-50 border border-emerald-200'
                        : 'bg-zinc-100 border border-zinc-200'
                    }`}>
                      {demoMessages[activeDemoMsg].icon === 'bot' ? (
                        <Bot className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Users className="w-4 h-4 text-zinc-500" />
                      )}
                    </div>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                      demoMessages[activeDemoMsg].side === 'right'
                        ? 'bg-emerald-50 border border-emerald-200 rounded-tr-sm'
                        : 'bg-zinc-100 border border-zinc-200 rounded-tl-sm'
                    }`}>
                      <p className={`text-sm ${
                        demoMessages[activeDemoMsg].icon === 'bot'
                          ? 'text-emerald-700 font-medium'
                          : 'text-zinc-700'
                      }`}>
                        {demoMessages[activeDemoMsg].text}
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: 999999, duration: 1.5 }}
                  className="mt-3 flex gap-1"
                >
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 bg-zinc-300 rounded-full" />
                  ))}
                </motion.div>
              </motion.div>
            </div>

            <div className="space-y-4">
              {[
                { icon: Bot, label: 'AI Reply Time', value: '< 2 seconds', color: 'from-emerald-400 to-emerald-600', accent: 'text-emerald-600' },
                { icon: CheckCircle, label: 'Conversion Rate', value: '68%', color: 'from-violet-400 to-purple-600', accent: 'text-violet-600' },
                { icon: Users, label: 'Active Conversations', value: '12', color: 'from-blue-400 to-indigo-600', accent: 'text-blue-600' },
                { icon: TrendingUp, label: 'Revenue Today', value: 'Rs.24,499', color: 'from-amber-400 to-orange-600', accent: 'text-amber-600' },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ x: 4 }}
                  className="bg-white rounded-xl p-4 border border-zinc-200 flex items-center justify-between group cursor-default shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <s.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm text-zinc-600 font-medium">{s.label}</span>
                  </div>
                  <span className={`text-lg font-black ${s.accent}`}>{s.value}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-50/30 to-transparent pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-600 text-xs font-bold mb-5">
            <Zap className="w-3.5 h-3.5" /> HOW IT WORKS
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-900">
            Start Selling in{' '}
            <span className="bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-500 bg-clip-text text-transparent">
              3 Simple Steps
            </span>
          </h2>
          <p className="mt-3 text-zinc-500 text-sm">From zero to AI-powered sales in under 5 minutes.</p>
        </motion.div>
        <div className="grid sm:grid-cols-3 gap-8 sm:gap-6 relative">
          <div className="hidden sm:block absolute top-20 left-[16.66%] right-[16.66%] h-0.5 bg-gradient-to-r from-emerald-200 via-emerald-300 to-emerald-200" />
          {[
            { step: '01', title: 'Connect WhatsApp', desc: 'Scan QR code to link your WhatsApp. Takes 30 seconds. No technical skills needed.', icon: Smartphone, color: 'from-emerald-500 to-emerald-600' },
            { step: '02', title: 'Upload Products', desc: 'Add your products with prices, images, and videos. Bulk import supported.', icon: Layers, color: 'from-violet-500 to-purple-600' },
            { step: '03', title: 'AI Starts Selling', desc: 'Your AI agent handles conversations, negotiates, and closes deals 24/7 automatically.', icon: Rocket, color: 'from-amber-500 to-orange-600' },
          ].map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative text-center p-8 bg-white rounded-3xl border border-zinc-100 hover:border-emerald-100 hover:shadow-lg transition-all group"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-4 py-0.5 rounded-full text-[10px] font-bold text-zinc-400 border border-zinc-200 group-hover:border-emerald-200 group-hover:text-emerald-600 transition-all">
                Step {s.step}
              </div>
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-300`}>
                <s.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 mb-2">{s.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ========== DASHBOARD PREVIEW ========== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-600 text-xs font-bold mb-5">
            <BarChart3 className="w-3.5 h-3.5" /> DASHBOARD
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-900">
            Your{' '}
            <span className="bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-500 bg-clip-text text-transparent">
              Command Center
            </span>
          </h2>
          <p className="mt-3 text-zinc-500 text-sm">Monitor everything from one powerful dashboard.</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white rounded-[1.5rem] border border-zinc-200 overflow-hidden shadow-xl shadow-zinc-200/50"
        >
          <div className="bg-zinc-50 px-5 py-3 flex items-center gap-3 border-b border-zinc-200">
            <div className="flex gap-1.5">
              <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: 999999, duration: 2 }} className="w-3 h-3 rounded-full bg-red-400" />
              <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: 999999, duration: 2, delay: 0.3 }} className="w-3 h-3 rounded-full bg-amber-400" />
              <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: 999999, duration: 2, delay: 0.6 }} className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <span className="text-xs font-bold text-zinc-500">AI Sales Dashboard — Live</span>
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: 999999, duration: 2 }}
              className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold"
            >
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              All Systems Active
            </motion.div>
          </div>
          <div className="p-5 sm:p-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: MessageCircle, label: 'Active Chats', value: '12', change: '+3 this hour', color: 'text-emerald-600', chart: 'bg-emerald-100' },
              { icon: TrendingUp, label: 'AI Conversion', value: '68%', change: '+12% vs yesterday', color: 'text-emerald-600', chart: 'bg-violet-100' },
              { icon: DollarSign, label: 'Revenue Today', value: 'Rs.24,499', change: '+8% vs yesterday', color: 'text-emerald-600', chart: 'bg-amber-100' },
              { icon: Users, label: 'Lead Score Avg', value: '86', change: 'Hot 🔥', color: 'text-emerald-600', chart: 'bg-rose-100' },
            ].map((c, idx) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -2 }}
                className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 hover:border-emerald-100 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-zinc-500">{c.label}</span>
                  <c.icon className="w-4 h-4 text-zinc-400" />
                </div>
                <div className={`text-xl sm:text-2xl font-black ${c.color}`}>{c.value}</div>
                <div className="text-[10px] font-bold text-emerald-600 mt-1">{c.change}</div>
                <div className="mt-3 flex items-end gap-1 h-8">
                  {[30, 50, 35, 65, 45, 80, 60, 90].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + idx * 0.1 + i * 0.05, duration: 0.4 }}
                      className="flex-1 rounded-sm"
                      style={{ background: `rgba(16,185,129,${0.15 + (h / 100) * 0.5})` }}
                    />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="px-5 sm:px-6 pb-5 sm:pb-6 grid lg:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-zinc-50 rounded-xl p-4 border border-zinc-100"
            >
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <ShoppingBag className="w-3.5 h-3.5" /> Recent Orders
              </h4>
              {[
                { customer: 'Ahmed Ali', product: 'Premium Sneakers', amount: 'Rs.4,499', status: 'Verified', statusColor: 'text-emerald-600' },
                { customer: 'Sana Khan', product: 'Designer Kurti', amount: 'Rs.2,999', status: 'Pending', statusColor: 'text-amber-600' },
                { customer: 'Usman R.', product: 'Smart Watch', amount: 'Rs.6,499', status: 'Verified', statusColor: 'text-emerald-600' },
              ].map((o, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center justify-between py-2.5 border-b border-zinc-200 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{o.customer}</p>
                    <p className="text-[10px] text-zinc-500">{o.product}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-zinc-700">{o.amount}</p>
                    <span className={`text-[10px] font-bold ${o.statusColor}`}>{o.status}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-zinc-50 rounded-xl p-4 border border-zinc-100"
            >
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" /> AI Payment Verification
              </h4>
              <div className="space-y-3">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="bg-emerald-50 rounded-xl p-3 border border-emerald-200"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-bold text-emerald-700">Verified</span>
                  </div>
                  <p className="text-xs text-zinc-500">Ahmed Ali — Rs.4,499 — Screenshot matched ✓</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="bg-amber-50 rounded-xl p-3 border border-amber-200"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-bold text-amber-700">Pending Review</span>
                  </div>
                  <p className="text-xs text-zinc-500">Sana Khan — Rs.2,999 — Awaiting screenshot</p>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ========== AUTOMATION ========== */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-50/30 to-transparent pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-600 text-xs font-bold mb-5">
            <Zap className="w-3.5 h-3.5" /> 24/7 AUTOMATION
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-900">
            Never Miss a <span className="text-emerald-600">Single Lead</span>
          </h2>
          <p className="mt-3 text-zinc-500 text-sm">Your AI agent works around the clock — weekends, holidays, 24/7.</p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Clock, value: '24/7', label: 'AI Support', desc: 'Your AI agent never sleeps. Works 24/7 including holidays and weekends.' },
            { icon: Zap, value: '< 2s', label: 'Instant Replies', desc: 'Customers get replies in under 2 seconds. No waiting, no frustration.' },
            { icon: Target, value: '100%', label: 'Leads Captured', desc: 'No missed messages. Every single lead is captured and followed up.' },
            { icon: RefreshCw, value: 'Auto', label: 'Follow-ups', desc: 'Abandoned customers get automated recovery messages. Recover lost sales.' },
          ].map((a, i) => (
            <motion.div
              key={a.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="bg-white rounded-2xl p-6 border border-zinc-100 hover:border-emerald-100 hover:shadow-lg transition-all text-center group"
            >
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-200 group-hover:scale-110 transition-transform">
                <a.icon className="w-7 h-7 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-zinc-900 mb-1">{a.value}</div>
              <div className="text-sm font-bold text-emerald-600 mb-2">{a.label}</div>
              <p className="text-xs text-zinc-500 leading-relaxed">{a.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ========== PRICING ========== */}
      <section id="pricing" className="relative max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/30 via-transparent to-transparent pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-600 text-xs font-bold mb-5">
            <DollarSign className="w-3.5 h-3.5" /> PRICING
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-900">
            Simple, Transparent{' '}
            <span className="bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-500 bg-clip-text text-transparent">Pricing</span>
          </h2>
          <p className="mt-3 text-zinc-500 text-sm">Start free. Upgrade when you grow. No hidden fees.</p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {pricingPlans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`relative p-6 rounded-2xl border transition-all duration-300 ${
                p.popular
                  ? 'bg-white border-emerald-200 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/20'
                  : 'bg-white border-zinc-100 hover:border-zinc-200 hover:shadow-lg'
              }`}
            >
              {p.popular && (
                <motion.div
                  initial={{ y: -10, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[10px] font-black px-4 py-1 rounded-full tracking-wide flex items-center gap-1 shadow-lg"
                >
                  <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ repeat: 999999, duration: 2 }}>
                    <Star className="w-3 h-3 fill-white" />
                  </motion.div>
                  MOST POPULAR
                </motion.div>
              )}
              <h3 className="text-lg font-bold text-zinc-900">{p.name}</h3>
              <div className="mt-3 flex items-baseline gap-0.5">
                <span className="text-3xl font-black text-zinc-900">{p.price}</span>
                <span className="text-xs text-zinc-500">/month</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1.5 mb-5">{p.desc}</p>
              <ul className="space-y-2.5 mb-6">
                {p.features.map(f => (
                  <motion.li
                    key={f}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="flex items-start gap-2 text-xs text-zinc-600"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </motion.li>
                ))}
              </ul>
              <motion.button
                onClick={onGetStarted}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                  p.popular
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50'
                    : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100 border border-zinc-200'
                }`}
              >
                {p.name === 'Free' ? 'Get Started' : 'Start Free Trial'}
              </motion.button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ========== TESTIMONIALS ========== */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-600 text-xs font-bold mb-5">
            <Star className="w-3.5 h-3.5" /> TESTIMONIALS
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-900">
            Loved by{' '}
            <span className="bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-500 bg-clip-text text-transparent">Store Owners</span>
          </h2>
          <p className="mt-3 text-zinc-500 text-sm">See what our customers are saying about AI-powered sales.</p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="bg-white rounded-2xl p-6 border border-zinc-100 hover:border-emerald-100 hover:shadow-lg transition-all group"
            >
              <div className="flex gap-0.5 mb-4">
                {Array(t.rating).fill(0).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                  >
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  </motion.div>
                ))}
              </div>
              <p className="text-sm text-zinc-600 leading-relaxed mb-5">"{t.text}"</p>
              <div className="flex items-center gap-3 pt-4 border-t border-zinc-100">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-xs font-bold text-white shadow-lg"
                >
                  {t.name.split(' ').map(n => n[0]).join('')}
                </motion.div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-zinc-900">{t.name}</p>
                  <p className="text-[10px] text-zinc-500">{t.store}</p>
                </div>
                <span className="text-xs font-black text-emerald-600">{t.revenue}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ========== FAQ ========== */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-600 text-xs font-bold mb-5">
            <HelpCircle className="w-3.5 h-3.5" /> FAQ
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900">
            Frequently Asked{' '}
            <span className="bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-500 bg-clip-text text-transparent">Questions</span>
          </h2>
        </motion.div>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl border border-zinc-100 overflow-hidden"
            >
              <motion.button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left group"
                whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
              >
                <span className="text-sm font-bold text-zinc-900 group-hover:text-emerald-600 transition-colors">{faq.q}</span>
                <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }} transition={{ duration: 0.3 }}>
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                </motion.div>
              </motion.button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="px-5 pb-4 text-sm text-zinc-500 leading-relaxed border-t border-zinc-100 pt-4"
                    >
                      {faq.a}
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-[2.5rem] p-10 sm:p-16 lg:p-20 text-center"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute top-[-50%] left-[-20%] w-[80%] h-[80%] bg-emerald-400/20 rounded-full blur-[150px]" />
          <div className="absolute bottom-[-50%] right-[-20%] w-[80%] h-[80%] bg-emerald-300/10 rounded-full blur-[150px]" />
          <div className="relative z-10">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6"
            >
              <Rocket className="w-8 h-8 text-white" />
            </motion.div>
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
              Start Your{' '}
              <span className="text-emerald-200">AI Sales Agent</span> Today
            </h2>
            <p className="mt-4 text-emerald-200/80 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
              Join thousands of stores using AI to close deals on autopilot. No coding required. No contracts. No risk.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
              <motion.button
                onClick={onGetStarted}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="group px-8 py-4 bg-white text-emerald-800 rounded-2xl font-black text-sm shadow-2xl shadow-emerald-900/50 overflow-hidden relative"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Start Free Trial — No Credit Card
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </motion.button>
              <motion.button
                onClick={() => showToast('Talk to Sales — Coming soon!')}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold text-sm border border-white/20 transition-all flex items-center gap-2"
              >
                <HeadphonesIcon className="w-4 h-4" /> Talk to Sales
              </motion.button>
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="mt-8 flex items-center justify-center gap-6 text-xs text-emerald-200/60"
            >
              <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Free 7-day trial</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> No credit card</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Cancel anytime</span>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ========== TOAST NOTIFICATION ========== */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-zinc-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold"
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-zinc-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Rocket className="w-4 h-4 text-white" />
                </div>
                <span className="font-black text-base text-zinc-900">SaaS<span className="text-emerald-500">Closer</span></span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-[220px]">
                AI-powered WhatsApp sales automation for modern ecommerce stores. Close more deals with less effort.
              </p>
              <div className="flex gap-3 mt-4">
                {[
                  { icon: MessageCircle, label: 'WhatsApp', action: 'Contact' },
                  { icon: Mail, label: 'Email', action: 'Email' },
                  { icon: Phone, label: 'Phone', action: 'Call' },
                ].map(s => (
                  <motion.div
                    key={s.label}
                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(16,185,129,0.1)' }}
                    onClick={() => showToast(`${s.action} support coming soon!`)}
                    className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-400 hover:text-emerald-600 cursor-pointer transition-colors"
                  >
                    <s.icon className="w-4 h-4" />
                  </motion.div>
                ))}
              </div>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Demo', 'Integrations', 'Changelog'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact', 'Press Kit'] },
              { title: 'Support', links: ['Help Center', 'API Docs', 'Privacy Policy', 'Terms of Service', 'Status'] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-sm font-bold text-zinc-900 mb-4">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map(l => (
                    <li key={l}>
                      <button onClick={() => handleFooterLink(l)} className="text-xs text-zinc-500 hover:text-zinc-900 cursor-pointer transition-colors duration-200">
                        {l}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-zinc-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-zinc-400">
              © {new Date().getFullYear()} SaaS Closer AI. All rights reserved. Made with ❤️ for store owners.
            </p>
            <div className="flex gap-6 text-xs text-zinc-400">
              <button onClick={() => handleFooterLink('Privacy Policy')} className="hover:text-zinc-900 cursor-pointer transition-colors">Privacy</button>
              <button onClick={() => handleFooterLink('Terms of Service')} className="hover:text-zinc-900 cursor-pointer transition-colors">Terms</button>
              <button onClick={() => handleFooterLink('API Docs')} className="hover:text-zinc-900 cursor-pointer transition-colors">API Docs</button>
              <button onClick={() => handleFooterLink('Help Center')} className="hover:text-zinc-900 cursor-pointer transition-colors">Support</button>
            </div>
          </div>
        </div>
      </footer>

      {/* AI Chat Widget */}
      <ChatWidget />
    </div>
  );
}
