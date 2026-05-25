import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Search, MessageCircle, Mail, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const faqs = [
  {
    question: 'How do I connect my Facebook/Instagram account?',
    answer: 'Go to Channels → Instagram, enter your Facebook App credentials in .env, then click "Connect Instagram". Each client connects their own Instagram Business Account through the Facebook App.',
  },
  {
    question: 'How does the billing & trial work?',
    answer: 'You get a 7-day free trial with Professional plan limits. After trial ends, you auto-downgrade to Free (Rs.0). Upgrade anytime from the Billing page. Plans: Basic (Rs.1,500/mo), Professional (Rs.3,500/mo), Business (Rs.6,500/mo), Enterprise (Rs.15,000/mo).',
  },
  {
    question: 'What happens when I hit the conversation limit?',
    answer: 'New customers are blocked from starting a conversation until the next billing cycle. Returning customers within existing sessions can still chat. Upgrade your plan to increase the limit.',
  },
  {
    question: 'How do I add products?',
    answer: 'Go to Products → Add Product. Enter name, price, features, and upload product images. Your AI will use this catalog to respond to customer inquiries.',
  },
  {
    question: 'How does the AI handle customer replies?',
    answer: 'The AI uses your product catalog and store settings to answer customer questions. It can check product availability, share prices, and guide customers through the ordering process automatically.',
  },
  {
    question: 'How do I verify an order?',
    answer: 'Go to Verification page. Each order shows customer details, product, amount, and payment screenshot. You can approve or reject orders from there.',
  },
  {
    question: 'Can I send broadcast messages?',
    answer: 'Yes, if your plan supports it. Go to WhatsApp → Broadcast. You can send messages to all customers or select specific segments. Available in Professional, Business, and Enterprise plans.',
  },
  {
    question: 'How do I set up JazzCash payments?',
    answer: 'Go to Payments, enter your JazzCash number and advance amount. Share this number with customers for manual payment. Upload payment screenshots in the chat for verification.',
  },
  {
    question: 'Is WhatsApp business API required?',
    answer: 'No. This system works with WhatsApp Web (scan QR code) to simulate AI replies. No business API approval or webhook setup needed.',
  },
  {
    question: 'How do I change my Gemini AI model?',
    answer: 'Go to Settings → AI Settings. You can change the model (e.g., gemini-2.0-flash, gemini-2.0-pro) and configure the system prompt for your AI personality.',
  },
  {
    question: 'What happens to my data if I downgrade?',
    answer: 'Your data (products, orders, chats) is preserved. You simply lose access to premium features like Broadcast, Re-Engagement, and Instragram/Facebook channels until you upgrade again.',
  },
  {
    question: 'How do I contact support?',
    answer: 'If you need help beyond this FAQ, reach out via email at support@salesforceai.com or use the contact form in the platform.',
  },
];

export default function Help() {
  const [search, setSearch] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filtered = faqs.filter((f) =>
    f.question.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Help & FAQ</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Frequently asked questions</p>
          </div>
        </div>

        <div className="relative mt-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpenIndex(null); }}
            placeholder="Search questions..."
            className="w-full bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
          />
        </div>
      </header>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map((faq, i) => (
            <motion.div
              key={faq.question}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-950/50 transition-colors"
              >
                <span className="text-sm font-bold text-zinc-900 dark:text-white pr-4">
                  {faq.question}
                </span>
                <span className="shrink-0 w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                  {openIndex === i ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </span>
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-4">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-zinc-400">
            <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-bold">No questions found</p>
            <p className="text-sm mt-1">Try a different search term</p>
          </div>
        )}
      </div>

      <div className="mt-10 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-zinc-800 dark:to-zinc-900 rounded-2xl p-6 border border-amber-200 dark:border-zinc-700">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-200 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h4 className="font-bold text-zinc-900 dark:text-white text-sm mb-1">Still need help?</h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Contact us at{' '}
              <a href="mailto:support@salesforceai.com" className="text-amber-600 dark:text-amber-400 font-bold hover:underline">
                support@salesforceai.com
              </a>{' '}
              and we&apos;ll get back to you within 24 hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
