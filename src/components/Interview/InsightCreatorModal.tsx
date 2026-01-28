/**
 * InsightCreatorModal - Advanced AI Insight Generator
 * BCG Enterprise Level - Multiple analysis types, filters, custom prompts
 */

import {
  AlertTriangle,
  BarChart3,
  Brain,
  Calendar,
  ChevronDown,
  FileText,
  Filter,
  Lightbulb,
  Loader2,
  MessageSquare,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

// ==========================================
// TYPES
// ==========================================

export type InsightPromptType =
  | 'summary'
  | 'trends'
  | 'problems'
  | 'recommendations'
  | 'comparison'
  | 'gaps'
  | 'risk_assessment'
  | 'opportunity_scan'
  | 'maturity'
  | 'stakeholder_map';

interface CompletedSession {
  id: string;
  name: string;
  templateId?: string;
  templateName?: string;
  templateCategory?: string;
  status: string;
  completedAt?: string;
  respondentId?: string;
  respondentName?: string;
  answeredQuestions: number;
  totalQuestions: number;
}

interface InsightCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ==========================================
// ANALYSIS TYPE DEFINITIONS
// ==========================================

interface AnalysisType {
  id: InsightPromptType;
  name: string;
  namePl: string;
  description: string;
  descriptionPl: string;
  icon: React.ReactNode;
  color: string;
  category: 'basic' | 'advanced' | 'bcg';
}

const ANALYSIS_TYPES: AnalysisType[] = [
  // Basic
  {
    id: 'summary',
    name: 'Executive Summary',
    namePl: 'Podsumowanie Wykonawcze',
    description: 'Comprehensive overview of key findings for leadership',
    descriptionPl: 'Kompleksowy przegląd kluczowych wniosków dla zarządu',
    icon: <FileText size={18} />,
    color: 'blue',
    category: 'basic',
  },
  {
    id: 'trends',
    name: 'Trend Analysis',
    namePl: 'Analiza Trendów',
    description: 'Identify patterns and emerging themes across interviews',
    descriptionPl: 'Identyfikacja wzorców i pojawiających się tematów',
    icon: <TrendingUp size={18} />,
    color: 'purple',
    category: 'basic',
  },
  {
    id: 'problems',
    name: 'Problem Discovery',
    namePl: 'Odkrywanie Problemów',
    description: 'Surface pain points, challenges, and blockers',
    descriptionPl: 'Wydobycie problemów, wyzwań i blokad',
    icon: <AlertTriangle size={18} />,
    color: 'red',
    category: 'basic',
  },
  {
    id: 'recommendations',
    name: 'Recommendations',
    namePl: 'Rekomendacje',
    description: 'Actionable suggestions based on interview findings',
    descriptionPl: 'Konkretne sugestie działań na podstawie wywiadów',
    icon: <Lightbulb size={18} />,
    color: 'amber',
    category: 'basic',
  },
  // Advanced
  {
    id: 'comparison',
    name: 'Cross-Interview Comparison',
    namePl: 'Porównanie Wywiadów',
    description: 'Compare perspectives between different respondents',
    descriptionPl: 'Porównaj perspektywy różnych respondentów',
    icon: <BarChart3 size={18} />,
    color: 'cyan',
    category: 'advanced',
  },
  {
    id: 'gaps',
    name: 'Gap Analysis',
    namePl: 'Analiza Luk',
    description: 'Identify missing information and unanswered questions',
    descriptionPl: 'Identyfikacja brakujących informacji i pytań bez odpowiedzi',
    icon: <Target size={18} />,
    color: 'orange',
    category: 'advanced',
  },
  {
    id: 'risk_assessment',
    name: 'Risk Assessment',
    namePl: 'Ocena Ryzyk',
    description: 'Extract and categorize risks mentioned in interviews',
    descriptionPl: 'Wydobycie i kategoryzacja ryzyk z wywiadów',
    icon: <AlertTriangle size={18} />,
    color: 'rose',
    category: 'advanced',
  },
  {
    id: 'opportunity_scan',
    name: 'Opportunity Scan',
    namePl: 'Skan Szans',
    description: 'Identify quick wins and growth opportunities',
    descriptionPl: 'Identyfikacja quick wins i szans rozwoju',
    icon: <Zap size={18} />,
    color: 'emerald',
    category: 'advanced',
  },
  // BCG Frameworks
  {
    id: 'maturity',
    name: 'Maturity Assessment',
    namePl: 'Ocena Dojrzałości',
    description: 'Evaluate organizational maturity level (1-5 scale)',
    descriptionPl: 'Ocena poziomu dojrzałości organizacji (skala 1-5)',
    icon: <Brain size={18} />,
    color: 'indigo',
    category: 'bcg',
  },
  {
    id: 'stakeholder_map',
    name: 'Stakeholder Mapping',
    namePl: 'Mapa Interesariuszy',
    description: 'Identify key players, their influence and positions',
    descriptionPl: 'Identyfikacja kluczowych graczy, ich wpływu i stanowisk',
    icon: <Users size={18} />,
    color: 'violet',
    category: 'bcg',
  },
];

// ==========================================
// COMPONENT
// ==========================================

export const InsightCreatorModal: React.FC<InsightCreatorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  // State
  const [title, setTitle] = useState('');
  const [selectedType, setSelectedType] = useState<InsightPromptType>('summary');
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterTemplate, setFilterTemplate] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Data
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [sessionsRes, templatesRes] = await Promise.all([
          Api.get('/interview/sessions/completed').catch(() => []),
          Api.get('/interview/templates').catch(() => []),
        ]);

        setCompletedSessions(Array.isArray(sessionsRes) ? sessionsRes : []);
        setTemplates(Array.isArray(templatesRes) ? templatesRes : []);
      } catch (error) {
        console.error('[InsightCreatorModal] Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setSelectedType('summary');
      setSelectedSessions([]);
      setCustomPrompt('');
      setShowFilters(false);
      setFilterTemplate('');
      setFilterDateFrom('');
      setFilterDateTo('');
    }
  }, [isOpen]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    let sessions = completedSessions;

    if (filterTemplate) {
      sessions = sessions.filter((s) => s.templateId === filterTemplate);
    }

    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      sessions = sessions.filter((s) => s.completedAt && new Date(s.completedAt) >= from);
    }

    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      sessions = sessions.filter((s) => s.completedAt && new Date(s.completedAt) <= to);
    }

    return sessions;
  }, [completedSessions, filterTemplate, filterDateFrom, filterDateTo]);

  // Get selected analysis type
  const selectedAnalysisType = ANALYSIS_TYPES.find((t) => t.id === selectedType);

  // Color classes helper
  const getColorClasses = (color: string, variant: 'bg' | 'border' | 'text' | 'ring') => {
    const colors: Record<string, Record<string, string>> = {
      blue: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400', ring: 'ring-blue-500/30' },
      purple: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400', ring: 'ring-purple-500/30' },
      red: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400', ring: 'ring-red-500/30' },
      amber: { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-400', ring: 'ring-amber-500/30' },
      cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500', text: 'text-cyan-400', ring: 'ring-cyan-500/30' },
      orange: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400', ring: 'ring-orange-500/30' },
      rose: { bg: 'bg-rose-500/20', border: 'border-rose-500', text: 'text-rose-400', ring: 'ring-rose-500/30' },
      emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
      indigo: { bg: 'bg-indigo-500/20', border: 'border-indigo-500', text: 'text-indigo-400', ring: 'ring-indigo-500/30' },
      violet: { bg: 'bg-violet-500/20', border: 'border-violet-500', text: 'text-violet-400', ring: 'ring-violet-500/30' },
    };
    return colors[color]?.[variant] || '';
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error(isPolish ? 'Podaj tytuł wniosków' : 'Enter insight title');
      return;
    }

    if (selectedSessions.length === 0) {
      toast.error(isPolish ? 'Wybierz przynajmniej jedną sesję' : 'Select at least one session');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading(isPolish ? 'Generowanie wniosków AI...' : 'Generating AI insights...');

    try {
      await Api.post('/interview/insights', {
        title: title.trim(),
        sessionIds: selectedSessions,
        promptType: selectedType,
        filters: {
          templateId: filterTemplate || undefined,
          dateFrom: filterDateFrom || undefined,
          dateTo: filterDateTo || undefined,
        },
        customPrompt: customPrompt.trim() || undefined,
      });

      toast.dismiss(toastId);
      toast.success(isPolish ? 'Wnioski wygenerowane!' : 'Insights generated!');
      onSuccess();
      onClose();
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(isPolish ? 'Nie udało się wygenerować wniosków' : 'Failed to generate insights');
      console.error('[InsightCreatorModal] Failed to generate insight:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle session selection
  const toggleSession = (sessionId: string) => {
    setSelectedSessions((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    );
  };

  // Select all / deselect all
  const toggleAllSessions = () => {
    if (selectedSessions.length === filteredSessions.length) {
      setSelectedSessions([]);
    } else {
      setSelectedSessions(filteredSessions.map((s) => s.id));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-navy-900 border border-navy-700 rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-navy-700 shrink-0">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles size={20} className="text-amber-400" />
            {isPolish ? 'Kreator Wniosków AI' : 'AI Insight Creator'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-navy-700 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">
              {isPolish ? 'Tytuł wniosków' : 'Insight Title'} *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                isPolish
                  ? 'np. Analiza transformacji cyfrowej Q1 2024'
                  : 'e.g. Digital Transformation Analysis Q1 2024'
              }
              className="w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
            />
          </div>

          {/* Analysis Type Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">
              {isPolish ? 'Typ analizy' : 'Analysis Type'} *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-navy-800 border text-left transition-all ${
                  showTypeDropdown ? 'border-primary-500 ring-1 ring-primary-500/30' : 'border-navy-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  {selectedAnalysisType && (
                    <>
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColorClasses(
                          selectedAnalysisType.color,
                          'bg'
                        )} ${getColorClasses(selectedAnalysisType.color, 'text')}`}
                      >
                        {selectedAnalysisType.icon}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {isPolish ? selectedAnalysisType.namePl : selectedAnalysisType.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {isPolish ? selectedAnalysisType.descriptionPl : selectedAnalysisType.description}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <ChevronDown
                  size={18}
                  className={`text-slate-400 transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown */}
              {showTypeDropdown && (
                <div className="absolute z-10 mt-2 w-full bg-navy-800 border border-navy-600 rounded-lg shadow-xl max-h-80 overflow-auto">
                  {/* Basic */}
                  <div className="px-3 py-2 border-b border-navy-700">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {isPolish ? 'Podstawowe' : 'Basic'}
                    </span>
                  </div>
                  {ANALYSIS_TYPES.filter((t) => t.category === 'basic').map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        setSelectedType(type.id);
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-navy-700 transition-colors ${
                        selectedType === type.id ? 'bg-navy-700' : ''
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColorClasses(
                          type.color,
                          'bg'
                        )} ${getColorClasses(type.color, 'text')}`}
                      >
                        {type.icon}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-white">
                          {isPolish ? type.namePl : type.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {isPolish ? type.descriptionPl : type.description}
                        </div>
                      </div>
                    </button>
                  ))}

                  {/* Advanced */}
                  <div className="px-3 py-2 border-b border-t border-navy-700">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {isPolish ? 'Zaawansowane' : 'Advanced'}
                    </span>
                  </div>
                  {ANALYSIS_TYPES.filter((t) => t.category === 'advanced').map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        setSelectedType(type.id);
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-navy-700 transition-colors ${
                        selectedType === type.id ? 'bg-navy-700' : ''
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColorClasses(
                          type.color,
                          'bg'
                        )} ${getColorClasses(type.color, 'text')}`}
                      >
                        {type.icon}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-white">
                          {isPolish ? type.namePl : type.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {isPolish ? type.descriptionPl : type.description}
                        </div>
                      </div>
                    </button>
                  ))}

                  {/* BCG Frameworks */}
                  <div className="px-3 py-2 border-b border-t border-navy-700">
                    <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                      {isPolish ? 'BCG Frameworks' : 'BCG Frameworks'}
                    </span>
                  </div>
                  {ANALYSIS_TYPES.filter((t) => t.category === 'bcg').map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        setSelectedType(type.id);
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-navy-700 transition-colors ${
                        selectedType === type.id ? 'bg-navy-700' : ''
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColorClasses(
                          type.color,
                          'bg'
                        )} ${getColorClasses(type.color, 'text')}`}
                      >
                        {type.icon}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-white">
                          {isPolish ? type.namePl : type.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {isPolish ? type.descriptionPl : type.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filters Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <Filter size={16} />
              <span>{isPolish ? 'Filtry' : 'Filters'}</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}
              />
            </button>

            {showFilters && (
              <div className="mt-3 p-3 bg-navy-800/50 border border-navy-700 rounded-lg space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Template filter */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      {isPolish ? 'Szablon' : 'Template'}
                    </label>
                    <select
                      value={filterTemplate}
                      onChange={(e) => setFilterTemplate(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-navy-800 border border-navy-600 text-sm text-white focus:border-primary-500 transition-colors"
                    >
                      <option value="">{isPolish ? 'Wszystkie' : 'All'}</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date from */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      {isPolish ? 'Data od' : 'Date from'}
                    </label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-navy-800 border border-navy-600 text-sm text-white focus:border-primary-500 transition-colors"
                    />
                  </div>

                  {/* Date to */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      {isPolish ? 'Data do' : 'Date to'}
                    </label>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-navy-800 border border-navy-600 text-sm text-white focus:border-primary-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Session Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-400">
                {isPolish ? 'Wybierz sesje źródłowe' : 'Select source sessions'} *
              </label>
              {filteredSessions.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllSessions}
                  className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                >
                  {selectedSessions.length === filteredSessions.length
                    ? isPolish
                      ? 'Odznacz wszystkie'
                      : 'Deselect all'
                    : isPolish
                    ? 'Zaznacz wszystkie'
                    : 'Select all'}
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-primary-400" />
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 bg-navy-800/50 rounded-lg border border-navy-700">
                <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {isPolish ? 'Brak zakończonych sesji' : 'No completed sessions'}
                </p>
                {(filterTemplate || filterDateFrom || filterDateTo) && (
                  <p className="text-xs mt-1">
                    {isPolish ? 'Spróbuj zmienić filtry' : 'Try changing filters'}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-auto pr-1">
                {filteredSessions.map((session) => {
                  const isSelected = selectedSessions.includes(session.id);
                  return (
                    <label
                      key={session.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary-500/15 border-primary-500'
                          : 'bg-navy-800 border-navy-700 hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSession(session.id)}
                        className="w-4 h-4 rounded border-navy-600 bg-navy-800 text-primary-500 focus:ring-primary-500/50"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white font-medium truncate">
                          {session.name || 'Interview Session'}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span>
                            {session.answeredQuestions}/{session.totalQuestions}{' '}
                            {isPolish ? 'pytań' : 'questions'}
                          </span>
                          {session.templateName && (
                            <>
                              <span>•</span>
                              <span>{session.templateName}</span>
                            </>
                          )}
                          {session.completedAt && (
                            <>
                              <span>•</span>
                              <span>{new Date(session.completedAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-xs text-emerald-400">
                          {isPolish ? 'Zakończona' : 'Completed'}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {selectedSessions.length > 0 && (
              <p className="text-xs text-primary-400 mt-2">
                {isPolish
                  ? `Wybrano ${selectedSessions.length} sesji`
                  : `${selectedSessions.length} session(s) selected`}
              </p>
            )}
          </div>

          {/* Custom Prompt */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">
              {isPolish ? 'Dodatkowe instrukcje (opcjonalnie)' : 'Additional instructions (optional)'}
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              placeholder={
                isPolish
                  ? 'np. Skup się na różnicach między działem IT a biznesem. Użyj języka polskiego.'
                  : 'e.g. Focus on differences between IT and business departments. Use formal language.'
              }
              className="w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              {isPolish
                ? 'Te instrukcje zostaną dodane do promptu AI'
                : 'These instructions will be added to the AI prompt'}
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-navy-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="flex-1 px-4 py-2 rounded-lg bg-navy-800 border border-navy-600 text-slate-300 hover:bg-navy-700 transition-colors disabled:opacity-50"
          >
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedSessions.length === 0 || !title.trim() || isGenerating}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {isPolish ? 'Generowanie...' : 'Generating...'}
              </>
            ) : (
              <>
                <Sparkles size={16} />
                {isPolish ? 'Generuj wnioski' : 'Generate Insights'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsightCreatorModal;
