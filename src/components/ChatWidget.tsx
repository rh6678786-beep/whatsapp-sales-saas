import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Bot, User, ExternalLink } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  links?: { label: string; sectionId: string }[];
}

interface QAItem {
  keywords: string[];
  answer: string;
  links?: { label: string; sectionId: string }[];
}

const qaData: QAItem[] = [
  {
    keywords: ['feature', 'what can it do', 'capabilities', 'what does it do', 'how does it work', 'functions', 'abilities'],
    answer: 'SaaS Closer AI is a complete AI sales agent for your WhatsApp. It handles customer conversations, recommends products, negotiates prices, verifies payment screenshots automatically, and confirms orders — all 24/7 without any human effort.',
    links: [
      { label: 'View All Features', sectionId: 'features' },
      { label: 'See Live Demo', sectionId: 'demo' },
    ],
  },
  {
    keywords: ['price', 'cost', 'pricing', 'plan', 'subscription', 'how much', 'fee', 'charges', 'payment'],
    answer: 'We have 4 plans: Free Trial (Rs.0 — 30 sessions), Basic (Rs.1,500 — 300 sessions), Professional (Rs.3,000 — unlimited sessions, most popular), and Enterprise (Rs.7,000 — unlimited everything + white-label). All plans include a free trial — no credit card needed!',
    links: [{ label: 'See Full Pricing', sectionId: 'pricing' }],
  },
  {
    keywords: ['setup', 'set up', 'how to start', 'getting started', 'installation', 'configure', 'begin', 'connect whatsapp'],
    answer: 'Setup takes less than 5 minutes! Just connect your WhatsApp number by scanning a QR code, add your products (bulk import supported), and the AI starts selling immediately. No coding or technical skills required.',
    links: [
      { label: 'Watch Demo', sectionId: 'demo' },
      { label: 'Start Free Trial', sectionId: 'pricing' },
    ],
  },
  {
    keywords: ['language', 'urdu', 'multilingual', 'multi language', 'english', 'arabic', 'hindi', 'bengali', 'spanish', 'french', 'chinese'],
    answer: 'Yes! The AI supports 8 languages: Urdu (Roman), English, Arabic, Hindi, Bengali, Spanish, French, and Chinese. It automatically detects the customer\'s language and responds in the same language. Perfect for the Pakistani market where Urdu, English, and Roman Urdu are commonly mixed.',
    links: [{ label: 'View Features', sectionId: 'features' }],
  },
  {
    keywords: ['payment', 'verify', 'verification', 'screenshot', 'confirm payment', 'payment proof'],
    answer: 'The AI automatically verifies payment screenshots using computer vision! When a customer sends a payment screenshot (JazzCash, EasyPaisa, or bank transfer), the AI analyzes it instantly, confirms the amount and details, and marks the order as verified — no manual checking needed.',
    links: [{ label: 'See Demo', sectionId: 'demo' }],
  },
  {
    keywords: ['safe', 'security', 'secure', 'privacy', 'private', 'data', 'encrypt', 'gdpr', 'protect'],
    answer: 'Absolutely safe! Your WhatsApp session runs in an isolated container. We never store your messages beyond what\'s needed for orders. Personal chats stay private — the AI only interacts with customers who message your business. All data is encrypted in transit and at rest. We follow GDPR guidelines.',
    links: [{ label: 'Learn More in FAQ', sectionId: 'pricing' }],
  },
  {
    keywords: ['cancel', 'refund', 'trial', 'free', 'contract', 'commitment'],
    answer: 'No contracts! You can cancel your subscription anytime. Your data stays with you for 30 days after cancellation in case you want to reactivate. The free trial requires no credit card — just start and see the results!',
    links: [{ label: 'View Plans', sectionId: 'pricing' }],
  },
  {
    keywords: ['negotiation', 'negotiate', 'bargain', 'discount', 'deal', 'offer'],
    answer: 'The AI has smart negotiation capabilities! It can automatically negotiate prices with customers within limits you set — closing more deals while protecting your margins. You control the minimum price and the AI handles the rest.',
    links: [{ label: 'Explore Features', sectionId: 'features' }],
  },
  {
    keywords: ['whatsapp', 'whatsapp web', 'whatsapp number', 'multiple numbers', 'official api'],
    answer: 'We use whatsapp-web.js which connects through WhatsApp Web — no API fees or approval needed. You can use your own existing WhatsApp number. The AI works directly from your account and replies to customers automatically.',
    links: [{ label: 'See How It Works', sectionId: 'demo' }],
  },
  {
    keywords: ['analytics', 'report', 'dashboard', 'stats', 'statistics', 'track', 'performance', 'revenue', 'conversion'],
    answer: 'The dashboard gives you live analytics: track active chats, conversion rates (avg 68%), daily revenue, lead scores, recent orders, and AI performance. You also get email reports with daily summaries of your store\'s performance.',
    links: [{ label: 'View Dashboard Preview', sectionId: 'demo' }],
  },
  {
    keywords: ['re-engagement', 'follow up', 'inactive', 'reminder', 'recover', 'abandon'],
    answer: 'The AI automatically follows up with inactive customers! If a customer stops replying mid-conversation, the AI sends a friendly reminder after a set time. This helps recover lost sales that would otherwise disappear.',
    links: [{ label: 'All Features', sectionId: 'features' }],
  },
  {
    keywords: ['telegram', 'facebook', 'instagram', 'multi channel', 'channel', 'social media', 'messenger'],
    answer: 'Yes! Besides WhatsApp, the AI works on Facebook, Instagram, and Telegram too — all from a single dashboard. Manage every channel in one place with the same powerful AI agent.',
    links: [{ label: 'Features Overview', sectionId: 'features' }],
  },
  {
    keywords: ['lead', 'scoring', 'hot lead', 'qualify', 'priority'],
    answer: 'The AI automatically scores and qualifies every lead! It identifies high-converting customers based on their behavior, budget, and urgency — so you know exactly who to prioritize. Hot leads get faster responses and special attention.',
    links: [{ label: 'Learn More', sectionId: 'features' }],
  },
  {
    keywords: ['support', 'help', 'contact', 'customer service', 'human'],
    answer: 'We offer priority support on Professional and Enterprise plans. Enterprise customers get a dedicated support team and SLA guarantee. All plans include community support to help you get started.',
    links: [{ label: 'Compare Plans', sectionId: 'pricing' }],
  },
  {
    keywords: ['product', 'upload', 'add product', 'inventory', 'stock', 'bulk import'],
    answer: 'Add your products with prices, images, and videos. Bulk import is supported for easy setup. The AI automatically learns about your products and recommends them to customers based on their interests. Free plan includes 5 products, going up to unlimited on higher plans.',
    links: [{ label: 'Pricing Details', sectionId: 'pricing' }],
  },
  {
    keywords: ['who is it for', 'target', 'audience', 'suitable', 'ecommerce', 'store owner', 'business'],
    answer: 'SaaS Closer AI is perfect for any ecommerce store owner who wants to automate their sales on WhatsApp. Whether you\'re a small boutique or a large enterprise, the AI handles your customer conversations 24/7 and helps you close more deals with less effort.',
    links: [
      { label: 'See Features', sectionId: 'features' },
      { label: 'View Plans', sectionId: 'pricing' },
    ],
  },
  {
    keywords: ['hello', 'hi', 'hey', 'salam', 'assalam', 'good morning', 'good evening'],
    answer: 'Hi there! 👋 I\'m the SaaS Closer AI assistant. I can tell you all about our AI sales agent for WhatsApp — features, pricing, setup, and more. What would you like to know?',
    links: [
      { label: 'View Features', sectionId: 'features' },
      { label: 'See Pricing', sectionId: 'pricing' },
    ],
  },
];

function findBestMatch(input: string): QAItem | null {
  const lower = input.toLowerCase().trim();
  let best: QAItem | null = null;
  let bestScore = 0;

  for (const qa of qaData) {
    for (const kw of qa.keywords) {
      if (lower.includes(kw)) {
        const score = kw.length;
        if (score > bestScore) {
          bestScore = score;
          best = qa;
        }
      }
    }
  }
  return best;
}

function scrollToSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}

const quickQuestions = [
  'What are the features?',
  'How much does it cost?',
  'How to set up?',
  'Multi-language support?',
  'Is it safe?',
  'Payment verification?',
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text?: string) => {
    const msg = text || input;
    if (!msg.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: msg.trim() };
    const match = findBestMatch(msg);
    let botMsg: ChatMessage;

    if (match) {
      botMsg = {
        role: 'bot',
        text: match.answer,
        links: match.links,
      };
    } else {
      botMsg = {
        role: 'bot',
        text: 'I\'m not sure about that. Try asking about features, pricing, setup, languages, or safety — or pick from the quick questions below!',
        links: [
          { label: 'View All Features', sectionId: 'features' },
          { label: 'See Pricing', sectionId: 'pricing' },
        ],
      };
    }

    setMessages(prev => [...prev, userMsg, botMsg]);
    setInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleQuickClick = (q: string) => {
    sendMessage(q);
  };

  const toggleOpen = () => {
    if (open) {
      setMessages([]);
      setInput('');
    }
    setOpen(!open);
  };

  return (
    <>
      {/* Floating chat button */}
      <motion.button
        onClick={toggleOpen}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-violet-500 to-indigo-600 rounded-full shadow-2xl shadow-violet-500/50 flex items-center justify-center hover:from-violet-400 hover:to-indigo-500 transition-all group"
      >
        {open ? (
          <X className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
        ) : (
          <MessageCircle className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
        )}
        <motion.div
          className="absolute -inset-2 bg-violet-500/20 rounded-full"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ repeat: 999999, duration: 2 }}
        />
      </motion.button>

      {/* Chat overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-48px)] bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden"
            style={{ maxHeight: '640px' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-700 px-4 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold">SaaS Closer AI</p>
                <p className="text-white/60 text-[10px]">Ask me anything about the product!</p>
              </div>
              <button
                onClick={toggleOpen}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>

            {/* Messages */}
            <div className="p-4 space-y-3.5 overflow-y-auto" style={{ height: '420px' }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <Bot className="w-14 h-14 text-violet-200 mb-3" />
                  <p className="text-base font-bold text-zinc-700 mb-1">Hi! How can I help you?</p>
                  <p className="text-xs text-zinc-400 leading-relaxed max-w-xs">
                    Ask me about features, pricing, setup, languages, safety — or pick a quick question below!
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2 justify-center">
                    {quickQuestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleQuickClick(q)}
                        className="px-3.5 py-1.5 bg-violet-50 border border-violet-200 rounded-full text-xs text-violet-700 font-medium hover:bg-violet-100 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    m.role === 'bot' ? 'bg-violet-50 border border-violet-200' : 'bg-zinc-100 border border-zinc-200'
                  }`}>
                    {m.role === 'bot' ? (
                      <Bot className="w-3.5 h-3.5 text-violet-600" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-zinc-500" />
                    )}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    m.role === 'bot'
                      ? 'bg-zinc-50 rounded-tl-sm border border-zinc-100'
                      : 'bg-gradient-to-r from-violet-600 to-indigo-600 rounded-tr-sm'
                  }`}>
                    <p className={`text-sm leading-relaxed ${
                      m.role === 'bot' ? 'text-zinc-700' : 'text-white'
                    }`}>
                      {m.text}
                    </p>
                    {m.links && m.links.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {m.links.map((link) => (
                          <button
                            key={link.sectionId}
                            onClick={() => scrollToSection(link.sectionId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/90 border border-violet-200 rounded-lg text-[11px] font-medium text-violet-700 hover:bg-violet-100 transition-colors shadow-sm"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {link.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick suggestions after messages */}
            {messages.length > 0 && (
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-1.5">
                  {quickQuestions.filter(q => !messages.some(m => m.role === 'user' && m.text.includes(q.split('?')[0].toLowerCase()))).slice(0, 3).map((q) => (
                    <button
                      key={q}
                      onClick={() => handleQuickClick(q)}
                      className="px-2.5 py-1 bg-violet-50/50 border border-violet-100 rounded-full text-[10px] text-violet-600 font-medium hover:bg-violet-100 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="border-t border-zinc-100 p-3 flex items-center gap-2 bg-white">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type your question..."
                className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all text-zinc-700 placeholder:text-zinc-400"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2.5 bg-gradient-to-r from-violet-500 to-indigo-600 rounded-xl text-white flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:from-violet-400 hover:to-indigo-500 transition-all shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
