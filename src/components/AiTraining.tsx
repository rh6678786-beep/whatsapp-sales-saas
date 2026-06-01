import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Brain, Save, CheckCircle, Loader2, Plus, X, BookOpen, MessageSquare, Radio } from 'lucide-react';
import { motion } from 'motion/react';

const PERSONALITY_OPTIONS = ['Friendly', 'Professional', 'Casual', 'Custom'] as const;

export default function AiTraining() {
  const [aiInstructions, setAiInstructions] = useState('');
  const [personality, setPersonality] = useState('Friendly');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState('');

  const [savingInstructions, setSavingInstructions] = useState(false);
  const [savedInstructions, setSavedInstructions] = useState(false);
  const [savingPersonality, setSavingPersonality] = useState(false);
  const [savedPersonality, setSavedPersonality] = useState(false);
  const [savingKeywords, setSavingKeywords] = useState(false);
  const [savedKeywords, setSavedKeywords] = useState(false);
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [savedKnowledge, setSavedKnowledge] = useState(false);

  useEffect(() => {
    axios.get('/api/settings').then(res => {
      const data = res.data;
      if (data.aiInstructions) setAiInstructions(data.aiInstructions);
      if (data.aiPersonality) setPersonality(data.aiPersonality);
      if (data.aiKeywords) setKeywords(data.aiKeywords);
      if (data.aiKnowledge) setKnowledgeBase(data.aiKnowledge);
    }).catch(err => console.error('Failed to load AI settings:', err));
  }, []);

  const handleSave = async (field: string, value: any, setSaving: (v: boolean) => void, setSaved: (v: boolean) => void) => {
    setSaving(true);
    try {
      await axios.post('/api/settings', { [field]: value });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter(k => k !== kw));
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-2"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 to-indigo-500/30 rounded-[20px] blur-lg" />
          <div className="relative w-16 h-16 rounded-[20px] bg-gradient-to-br from-violet-900 to-indigo-700 dark:from-violet-500 dark:to-indigo-400 flex items-center justify-center shadow-2xl">
            <Brain className="w-8 h-8 text-white" />
          </div>
        </motion.div>
        <div>
          <h2 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-violet-900 to-indigo-500 dark:from-violet-300 dark:to-indigo-400 tracking-tight">
            AI Training
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2 mt-1">
            <MessageSquare className="w-4 h-4 text-violet-500" />
            Configure your AI's personality, knowledge, and behavior
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-8">
        {/* System Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-lg"
        >
          <div className="flex items-center gap-4 mb-6">
            <motion.div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </motion.div>
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white">System Instructions</h3>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Custom instructions that define the AI's core behavior</p>
            </div>
          </div>
          <div className="space-y-4">
            <textarea
              value={aiInstructions}
              onChange={(e) => setAiInstructions(e.target.value)}
              placeholder="Write custom instructions for your AI assistant..."
              rows={6}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all resize-y"
            />
            <div className="flex justify-end">
              <motion.button
                onClick={() => handleSave('aiInstructions', aiInstructions, setSavingInstructions, setSavedInstructions)}
                disabled={savingInstructions}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg flex items-center gap-2 ${savedInstructions
                  ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-violet-500/30 hover:shadow-violet-500/50'
                }`}
              >
                {savingInstructions ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : savedInstructions ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {savingInstructions ? 'Saving...' : savedInstructions ? 'Saved!' : 'Save Instructions'}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Personality Tone */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-lg"
        >
          <div className="flex items-center gap-4 mb-6">
            <motion.div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center">
              <Radio className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </motion.div>
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white">Personality Tone</h3>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">How your AI communicates with customers</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {PERSONALITY_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setPersonality(opt)}
                  className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all border-2 ${personality === opt
                    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 shadow-md'
                    : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {personality === 'Custom' && (
              <input
                type="text"
                value={personality === 'Custom' ? personality : ''}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="Describe your custom tone..."
                className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
              />
            )}
            <div className="flex justify-end">
              <motion.button
                onClick={() => handleSave('aiPersonality', personality, setSavingPersonality, setSavedPersonality)}
                disabled={savingPersonality}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg flex items-center gap-2 ${savedPersonality
                  ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-amber-500/30 hover:shadow-amber-500/50'
                }`}
              >
                {savingPersonality ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : savedPersonality ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {savingPersonality ? 'Saving...' : savedPersonality ? 'Saved!' : 'Save Tone'}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Keywords */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-lg"
        >
          <div className="flex items-center gap-4 mb-6">
            <motion.div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </motion.div>
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white">Trigger Keywords</h3>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Keywords that trigger specific AI responses</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                placeholder="Add a keyword..."
                className="flex-1 bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all"
              />
              <motion.button
                onClick={addKeyword}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-5 py-4 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all"
              >
                <Plus className="w-5 h-5" />
              </motion.button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-xl text-sm font-bold text-cyan-700 dark:text-cyan-300"
                  >
                    {kw}
                    <button onClick={() => removeKeyword(kw)} className="hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <motion.button
                onClick={() => handleSave('aiKeywords', keywords, setSavingKeywords, setSavedKeywords)}
                disabled={savingKeywords}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg flex items-center gap-2 ${savedKeywords
                  ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-cyan-500/30 hover:shadow-cyan-500/50'
                }`}
              >
                {savingKeywords ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : savedKeywords ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {savingKeywords ? 'Saving...' : savedKeywords ? 'Saved!' : 'Save Keywords'}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Knowledge Base */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-lg"
        >
          <div className="flex items-center gap-4 mb-6">
            <motion.div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center">
              <Brain className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </motion.div>
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white">Knowledge Base</h3>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Business-specific knowledge the AI should know</p>
            </div>
          </div>
          <div className="space-y-4">
            <textarea
              value={knowledgeBase}
              onChange={(e) => setKnowledgeBase(e.target.value)}
              placeholder="Add business-specific information, FAQs, product details, policies..."
              rows={8}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none transition-all resize-y"
            />
            <div className="flex justify-end">
              <motion.button
                onClick={() => handleSave('aiKnowledge', knowledgeBase, setSavingKnowledge, setSavedKnowledge)}
                disabled={savingKnowledge}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg flex items-center gap-2 ${savedKnowledge
                  ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30 hover:shadow-emerald-500/50'
                }`}
              >
                {savingKnowledge ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : savedKnowledge ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {savingKnowledge ? 'Saving...' : savedKnowledge ? 'Saved!' : 'Save Knowledge'}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
