/**
 * Presentation Wizard (T058)
 * Gamma-app-level guided flow: Source selection → Setup → Outline → Generate → Export
 */

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileText,
  GripVertical,
  Layout,
  Loader2,
  Monitor,
  Palette,
  PieChart,
  Play,
  Plus,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

// ============================================================
// TYPES
// ============================================================

interface SourceArtifact {
  type: string;
  id?: string;
  label: string;
  data?: any;
}

interface OutlineItem {
  intent: string;
  title: string;
  keyMessage?: string;
  enabled: boolean;
  sourceRef?: string;
}

interface DeckTemplate {
  id: string;
  name: string;
  description: string;
  deck_type: string;
  audience: string;
  goal: string;
  theme: string;
  outline_json: OutlineItem[];
  is_system: boolean;
}

interface IntentInfo {
  id: string;
  label: string;
  description: string;
}

type WizardStep = 'sources' | 'setup' | 'outline' | 'generating' | 'result';

const SOURCE_TYPES = [
  { type: 'initiative_portfolio', icon: Target, color: 'text-blue-500' },
  { type: 'execution_status', icon: BarChart3, color: 'text-emerald-500' },
  { type: 'kpi_roi', icon: TrendingUp, color: 'text-purple-500' },
  { type: 'raid', icon: Shield, color: 'text-red-500' },
  { type: 'assessment', icon: PieChart, color: 'text-cyan-500' },
  { type: 'tool_session', icon: Zap, color: 'text-amber-500' },
];

const AUDIENCES = ['sponsor', 'executive', 'investor', 'internal'] as const;
const GOALS = ['inform', 'decide', 'sell', 'align'] as const;
const THEMES = ['corporate', 'minimal', 'modern'] as const;
const CONFIDENTIALITIES = ['confidential', 'internal', 'public'] as const;

// ============================================================
// COMPONENT
// ============================================================

export const PresentationWizard: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  // Wizard state
  const [step, setStep] = useState<WizardStep>('sources');
  const [templates, setTemplates] = useState<DeckTemplate[]>([]);
  const [intents, setIntents] = useState<IntentInfo[]>([]);

  // Source selection
  const [selectedSources, setSelectedSources] = useState<SourceArtifact[]>([]);

  // Setup
  const [title, setTitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [audience, setAudience] = useState<typeof AUDIENCES[number]>('executive');
  const [goal, setGoal] = useState<typeof GOALS[number]>('inform');
  const [language, setLanguage] = useState<'en' | 'pl'>(isPl ? 'pl' : 'en');
  const [theme, setTheme] = useState<typeof THEMES[number]>('corporate');
  const [confidentiality, setConfidentiality] = useState<typeof CONFIDENTIALITIES[number]>('internal');

  // Outline
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [deckId, setDeckId] = useState('');

  // Result
  const [result, setResult] = useState<{ slideCount: number; warnings: string[]; exportPath?: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    trackFunnelEvent('presentation_generator_opened', {});
    loadTemplates();
    loadIntents();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await Api.get('/presentations/templates');
      setTemplates(res.data || []);
    } catch {}
  };

  const loadIntents = async () => {
    try {
      const res = await Api.get('/presentations/intents');
      setIntents(res.data || []);
    } catch {}
  };

  // ---- SOURCE SELECTION ----

  const toggleSource = (type: string) => {
    setSelectedSources(prev => {
      const exists = prev.find(s => s.type === type);
      if (exists) return prev.filter(s => s.type !== type);
      const label = SOURCE_TYPES.find(s => s.type === type)?.type.replace(/_/g, ' ') || type;
      return [...prev, { type, label }];
    });
  };

  // ---- OUTLINE GENERATION ----

  const handleGenerateOutline = async () => {
    if (!title.trim()) {
      toast.error(t('presentations.wizard.titleRequired', 'Please enter a title'));
      return;
    }
    setStep('outline');
    try {
      const res = await Api.post('/presentations/generate/outline', {
        title,
        templateId: selectedTemplate || undefined,
        audience,
        goal,
        language,
        theme,
        confidentiality,
        sourceArtifacts: selectedSources,
      });
      setOutline(res.data.outline);
      setDeckId(res.data.deckId);
      trackFunnelEvent('presentation_outline_generated', { templateId: selectedTemplate, slideCount: res.data.outline.length });
    } catch (err) {
      toast.error(t('presentations.wizard.outlineFailed', 'Failed to generate outline'));
      setStep('setup');
    }
  };

  // ---- DECK GENERATION ----

  const handleGenerate = async () => {
    setStep('generating');
    setGenerating(true);
    try {
      const res = await Api.post('/presentations/generate/deck', {
        deckId,
        outline,
        setup: { title, templateId: selectedTemplate, audience, goal, language, theme, confidentiality, sourceArtifacts: selectedSources },
      });
      setResult(res.data);
      setStep('result');
      trackFunnelEvent('presentation_exported', { format: 'pptx', slideCount: res.data.slideCount });
    } catch (err) {
      toast.error(t('presentations.wizard.generationFailed', 'Generation failed'));
      setStep('outline');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!deckId) return;
    try {
      const response = await fetch(`/api/presentations/decks/${deckId}/download`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'presentation'}.pptx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(t('presentations.wizard.downloadFailed', 'Download failed'));
    }
  };

  // ---- OUTLINE EDITING ----

  const toggleSlide = (index: number) => {
    setOutline(prev => prev.map((item, i) => i === index ? { ...item, enabled: !item.enabled } : item));
  };

  const removeSlide = (index: number) => {
    setOutline(prev => prev.filter((_, i) => i !== index));
  };

  const addSlide = (intent: string) => {
    const info = intents.find(i => i.id === intent);
    setOutline(prev => [...prev, { intent, title: info?.label || intent, enabled: true }]);
  };

  const moveSlide = (from: number, to: number) => {
    if (to < 0 || to >= outline.length) return;
    setOutline(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  // ---- STEP NAVIGATION ----

  const canProceedSetup = title.trim().length > 0;
  const enabledSlides = outline.filter(o => o.enabled);

  // ---- RENDER ----

  return (
    <div className="min-h-screen bg-white dark:bg-navy-950">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-navy-700 px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('presentations.wizard.title', 'Presentation Generator')}</h1>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X size={20} /></button>
          )}
        </div>
        {/* Steps indicator */}
        <div className="flex items-center gap-2 mt-4 max-w-5xl mx-auto">
          {(['sources', 'setup', 'outline', 'result'] as const).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <div className="flex-1 h-px bg-slate-200 dark:bg-navy-700" />}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${step === s || (s === 'generating' && step === 'generating') ? 'bg-purple-500 text-white' : ['sources', 'setup', 'outline', 'result'].indexOf(step) > i ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-slate-100 dark:bg-navy-800 text-slate-500'}`}>
                {['sources', 'setup', 'outline', 'result'].indexOf(step) > i ? <Check size={14} /> : <span className="w-5 h-5 flex items-center justify-center text-xs font-bold">{i + 1}</span>}
                <span className="hidden sm:inline">{[t('presentations.steps.sources', 'Sources'), t('presentations.steps.setup', 'Setup'), t('presentations.steps.outline', 'Outline'), t('presentations.steps.result', 'Result')][i]}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* STEP 1: SOURCE SELECTION */}
        {step === 'sources' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('presentations.sources.title', 'Select Data Sources')}</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1">{t('presentations.sources.subtitle', 'Choose which platform artifacts to include in your deck.')}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {SOURCE_TYPES.map(({ type, icon: Icon, color }) => {
                const selected = selectedSources.some(s => s.type === type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleSource(type)}
                    className={`p-5 rounded-xl border-2 text-left transition-all ${selected ? 'border-purple-500 bg-purple-500/5 shadow-lg shadow-purple-500/10' : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'}`}
                  >
                    <Icon className={`w-8 h-8 ${color} mb-3`} />
                    <p className="font-semibold text-slate-900 dark:text-white">{t(`presentations.sources.${type}`, type.replace(/_/g, ' '))}</p>
                    {selected && <div className="mt-2 flex items-center gap-1 text-xs text-purple-500 font-medium"><Check size={12} /> {t('common.selected', 'Selected')}</div>}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setStep('setup')}
                disabled={selectedSources.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.next', 'Next')} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SETUP */}
        {step === 'setup' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('presentations.setup.title', 'Configure Your Deck')}</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1">{t('presentations.setup.subtitle', 'Set the tone, audience, and style.')}</p>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('presentations.setup.deckTitle', 'Deck Title')} *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('presentations.setup.titlePlaceholder', 'e.g., Steering Committee Update — Q1 2026')} className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-lg" />
            </div>

            {/* Template selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('presentations.setup.template', 'Template (optional)')}</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <button
                  onClick={() => setSelectedTemplate('')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${!selectedTemplate ? 'border-purple-500 bg-purple-500/5' : 'border-slate-200 dark:border-navy-700 hover:border-slate-300'}`}
                >
                  <Sparkles className="w-5 h-5 text-purple-400 mb-2" />
                  <p className="font-medium text-slate-900 dark:text-white text-sm">{t('presentations.setup.customDeck', 'Custom Deck')}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t('presentations.setup.customDeckDesc', 'AI generates outline from sources')}</p>
                </button>
                {templates.filter(t => t.is_system).map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => { setSelectedTemplate(tmpl.id); trackFunnelEvent('template_selected', { templateId: tmpl.id, type: 'deck' }); }}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${selectedTemplate === tmpl.id ? 'border-purple-500 bg-purple-500/5' : 'border-slate-200 dark:border-navy-700 hover:border-slate-300'}`}
                  >
                    <Layout className="w-5 h-5 text-blue-400 mb-2" />
                    <p className="font-medium text-slate-900 dark:text-white text-sm">{tmpl.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{tmpl.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Options grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SelectField label={t('presentations.setup.audience', 'Audience')} value={audience} onChange={v => setAudience(v as any)} options={AUDIENCES.map(a => ({ value: a, label: t(`presentations.audiences.${a}`, a) }))} />
              <SelectField label={t('presentations.setup.goal', 'Goal')} value={goal} onChange={v => setGoal(v as any)} options={GOALS.map(g => ({ value: g, label: t(`presentations.goals.${g}`, g) }))} />
              <SelectField label={t('presentations.setup.language', 'Language')} value={language} onChange={v => setLanguage(v as any)} options={[{ value: 'en', label: 'English' }, { value: 'pl', label: 'Polski' }]} />
              <SelectField label={t('presentations.setup.theme', 'Theme')} value={theme} onChange={v => setTheme(v as any)} options={THEMES.map(th => ({ value: th, label: t(`presentations.themes.${th}`, th) }))} />
            </div>

            <SelectField label={t('presentations.setup.confidentiality', 'Confidentiality')} value={confidentiality} onChange={v => setConfidentiality(v as any)} options={CONFIDENTIALITIES.map(c => ({ value: c, label: t(`presentations.confidentialities.${c}`, c) }))} />

            {/* Navigation */}
            <div className="flex justify-between">
              <button onClick={() => setStep('sources')} className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <ArrowLeft size={16} /> {t('common.back', 'Back')}
              </button>
              <button
                onClick={handleGenerateOutline}
                disabled={!canProceedSetup}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-500 disabled:opacity-50"
              >
                <Sparkles size={16} /> {t('presentations.setup.generateOutline', 'Generate Outline')}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: OUTLINE EDITOR */}
        {step === 'outline' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('presentations.outline.title', 'Deck Outline')}</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">{enabledSlides.length} {t('presentations.outline.slides', 'slides')} · {t('presentations.outline.reorder', 'Drag to reorder, toggle to include/exclude')}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  onChange={e => { if (e.target.value) { addSlide(e.target.value); e.target.value = ''; } }}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
                  defaultValue=""
                >
                  <option value="" disabled>{t('presentations.outline.addSlide', '+ Add slide...')}</option>
                  {intents.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              {outline.map((item, index) => (
                <div
                  key={`${item.intent}-${index}`}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${item.enabled ? 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700' : 'bg-slate-50 dark:bg-navy-800/50 border-slate-100 dark:border-navy-800 opacity-60'}`}
                >
                  <div className="flex flex-col gap-1">
                    <button onClick={() => moveSlide(index, index - 1)} disabled={index === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronRight size={14} className="-rotate-90" /></button>
                    <button onClick={() => moveSlide(index, index + 1)} disabled={index === outline.length - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronRight size={14} className="rotate-90" /></button>
                  </div>
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 text-xs font-bold">{index + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-white">{item.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-700 text-slate-500 dark:text-slate-400">{item.intent}</span>
                    </div>
                    {item.keyMessage && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">{item.keyMessage}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleSlide(index)} className={`p-1.5 rounded-lg transition-colors ${item.enabled ? 'bg-green-500/20 text-green-500' : 'bg-slate-200 dark:bg-navy-700 text-slate-400'}`}>
                      {item.enabled ? <Eye size={14} /> : <X size={14} />}
                    </button>
                    <button onClick={() => removeSlide(index)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep('setup')} className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <ArrowLeft size={16} /> {t('common.back', 'Back')}
              </button>
              <button
                onClick={handleGenerate}
                disabled={enabledSlides.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 shadow-lg shadow-purple-500/25"
              >
                <Play size={16} /> {t('presentations.outline.generate', 'Generate Deck')} ({enabledSlides.length} {t('presentations.outline.slides', 'slides')})
              </button>
            </div>
          </div>
        )}

        {/* STEP 3.5: GENERATING */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('presentations.generating.title', 'Generating Your Deck')}</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">{t('presentations.generating.subtitle', 'Creating BCG-grade slides with quality validation. This may take a moment...')}</p>
          </div>
        )}

        {/* STEP 4: RESULT */}
        {step === 'result' && result && (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('presentations.result.ready', 'Your Deck is Ready!')}</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1">{result.slideCount} {t('presentations.result.slidesGenerated', 'slides generated successfully')}</p>
            </div>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-500/5 border border-yellow-200 dark:border-yellow-500/20 rounded-xl p-4">
                <p className="font-medium text-yellow-800 dark:text-yellow-400 text-sm mb-2">{t('presentations.result.warnings', 'Quality Warnings')}</p>
                <ul className="space-y-1">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-sm text-yellow-700 dark:text-yellow-300/80">• {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/25 text-lg"
              >
                <Download size={20} /> {t('presentations.result.downloadPptx', 'Download PPTX')}
              </button>
              <button
                onClick={() => { setStep('outline'); }}
                className="flex items-center gap-2 px-6 py-3 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-navy-800"
              >
                <ArrowLeft size={16} /> {t('presentations.result.editOutline', 'Edit & Regenerate')}
              </button>
            </div>

            {/* Deck info */}
            <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                <span><strong>{result.slideCount}</strong> {t('presentations.outline.slides', 'slides')}</span>
                <span>·</span>
                <span>{theme}</span>
                <span>·</span>
                <span>{language.toUpperCase()}</span>
                <span>·</span>
                <span>{confidentiality}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// SHARED COMPONENTS
// ============================================================

const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-900 dark:text-white"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

export default PresentationWizard;
