/**
 * AdminInitiativeCreatorPanel
 *
 * Admin panel wrapper for the Initiative Creator functionality.
 * Provides a full-screen interface for generating initiatives from assessments.
 * Uses the InitiativesGenerationWizardModal logic but styled as a panel.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BarChart3,
  Brain,
  Building2,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Search,
  Settings,
  Sparkles,
  Target,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

type GenerationMode = 'ASSESSMENT_REPORT' | 'REPORT_ONLY';
type RunStatus = 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';

interface AssessmentOption {
  id: string;
  name: string;
  type?: string;
  status?: string;
  projectName?: string;
}

interface RunProgress {
  runId: string;
  assessmentId: string;
  status: RunStatus;
  mode: GenerationMode;
  methodologyId: string;
  requestedCount: number;
  batchSize: number;
  generatedCount: number;
  batchesPlanned: number;
  batchesCreated: number;
  batchesSucceeded: number;
  batchesFailed: number;
  updatedAt?: string | null;
  error?: string | null;
}

const METHODOLOGIES = [
  {
    id: 'impact-feasibility',
    name: 'Impact-Feasibility Matrix',
    description: 'Priorytetyzacja na podstawie wpływu i wykonalności',
  },
  {
    id: 'quick-wins',
    name: 'Quick Wins First',
    description: 'Najpierw szybkie zwycięstwa',
  },
  {
    id: 'strategic-alignment',
    name: 'Strategic Alignment',
    description: 'Dopasowanie do celów strategicznych',
  },
];

export const AdminInitiativeCreatorPanel: React.FC = () => {
  const { t } = useTranslation();

  // State
  const [step, setStep] = useState<'select' | 'configure' | 'running' | 'done'>('select');
  const [assessments, setAssessments] = useState<AssessmentOption[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generation config
  const [methodologyId, setMethodologyId] = useState<string>('impact-feasibility');
  const [requestedCount, setRequestedCount] = useState<number>(20);
  const [includeChatContext, setIncludeChatContext] = useState<boolean>(true);
  const [consultantBrief, setConsultantBrief] = useState<string>('');

  // Run state
  const [starting, setStarting] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<RunProgress | null>(null);

  const pollTimer = useRef<number | null>(null);

  // Fetch assessments
  useEffect(() => {
    const fetchAssessments = async () => {
      setLoading(true);
      try {
        const response = await Api.listAssessments({ limit: 200, offset: 0 });
        const list = Array.isArray((response as any)?.items)
          ? (response as any).items
          : Array.isArray((response as any)?.assessments)
            ? (response as any).assessments
            : [];
        setAssessments(
          list.map((a: any) => ({
            id: a.id,
            name: a.name,
            type: a.assessmentType || a.assessment_type || a.type,
            status: a.status || a.backendStatus,
            projectName: a.projectName || a.project_name || '',
          }))
        );
      } catch (err) {
        console.error('Failed to fetch assessments:', err);
        setError('Nie udało się pobrać listy ocen');
      } finally {
        setLoading(false);
      }
    };
    fetchAssessments();
  }, []);

  // Filter assessments
  const filteredAssessments = useMemo(() => {
    return assessments.filter(
      (a) =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.projectName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [assessments, searchQuery]);

  const selectedAssessment = assessments.find((a) => a.id === selectedAssessmentId);

  // Can start generation
  const canStart = useMemo(() => {
    if (!selectedAssessmentId) return false;
    if (!Number.isFinite(requestedCount) || requestedCount < 1) return false;
    return true;
  }, [selectedAssessmentId, requestedCount]);

  // Start generation
  const handleStartGeneration = useCallback(async () => {
    if (!canStart) return;

    setStarting(true);
    setError(null);

    try {
      const response = await Api.post('/initiatives/generate', {
        assessmentId: selectedAssessmentId,
        mode: 'ASSESSMENT_REPORT',
        methodologyId,
        requestedCount,
        includeChatContext,
        consultantBrief: consultantBrief.trim() || undefined,
      });

      if (response.runId) {
        setRunId(response.runId);
        setStep('running');
        startPolling(response.runId);
      }
    } catch (err: any) {
      console.error('Failed to start generation:', err);
      setError(err.message || 'Nie udało się rozpocząć generowania');
    } finally {
      setStarting(false);
    }
  }, [
    canStart,
    selectedAssessmentId,
    methodologyId,
    requestedCount,
    includeChatContext,
    consultantBrief,
  ]);

  // Poll for progress
  const startPolling = useCallback((id: string) => {
    const poll = async () => {
      try {
        const response = await Api.get(`/initiatives/runs/${id}`);
        setProgress(response);

        if (response.status === 'SUCCEEDED' || response.status === 'PARTIAL') {
          setStep('done');
          if (pollTimer.current) {
            clearInterval(pollTimer.current);
            pollTimer.current = null;
          }
        } else if (response.status === 'FAILED' || response.status === 'CANCELLED') {
          setError(response.error || 'Generowanie nie powiodło się');
          if (pollTimer.current) {
            clearInterval(pollTimer.current);
            pollTimer.current = null;
          }
        }
      } catch (err) {
        console.error('Failed to poll progress:', err);
      }
    };

    poll();
    pollTimer.current = window.setInterval(poll, 2000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
      }
    };
  }, []);

  // Reset wizard
  const handleReset = useCallback(() => {
    setStep('select');
    setSelectedAssessmentId('');
    setRunId(null);
    setProgress(null);
    setError(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <Lightbulb className="w-6 h-6 text-amber-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-c-text">
            {t('admin.initiativeCreator.title', 'Kreator inicjatyw')}
          </h2>
          <p className="text-sm text-slate-400">
            {t('admin.initiativeCreator.subtitle', 'Generuj inicjatywy transformacyjne z ocen')}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-danger-500/10 border border-danger-500/20">
          <AlertCircle className="w-5 h-5 text-danger-400" />
          <span className="text-sm text-danger-300">{error}</span>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {['select', 'configure', 'running', 'done'].map((s, i) => (
          <React.Fragment key={s}>
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                step === s
                  ? 'bg-c-text text-c-bg'
                  : ['select', 'configure', 'running', 'done'].indexOf(step) > i
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'bg-white/5 text-slate-500'
              }`}
            >
              {i + 1}
            </div>
            {i < 3 && (
              <div
                className={`flex-1 h-0.5 ${
                  ['select', 'configure', 'running', 'done'].indexOf(step) > i
                    ? 'bg-primary-500/50'
                    : 'bg-white/10'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Select Assessment */}
        {step === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <h3 className="text-sm font-medium text-slate-300">
              {t('admin.initiativeCreator.selectAssessment', 'Wybierz ocenę')}
            </h3>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={t('admin.initiativeCreator.searchPlaceholder', 'Szukaj oceny...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-c-text placeholder-slate-500 focus:outline-none focus:border-primary-500/50"
              />
            </div>

            {/* Assessments Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
              {filteredAssessments.map((assessment) => (
                <button
                  key={assessment.id}
                  onClick={() => {
                    setSelectedAssessmentId(assessment.id);
                    setStep('configure');
                  }}
                  className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary-500/30 text-left transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white/5">
                      <Building2 className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-c-text truncate">{assessment.name}</p>
                      {assessment.projectName && (
                        <p className="text-xs text-slate-500 mt-0.5">{assessment.projectName}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {assessment.type && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-slate-400">
                            {assessment.type}
                          </span>
                        )}
                        {assessment.status && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 text-emerald-400">
                            {assessment.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {filteredAssessments.length === 0 && (
              <div className="text-center py-8 bg-white/5 rounded-xl">
                <Target className="w-10 h-10 mx-auto text-slate-500 mb-3" />
                <p className="text-slate-500 dark:text-slate-400">
                  {t('admin.initiativeCreator.noAssessments', 'Brak ocen do wyboru')}
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Step 2: Configure */}
        {step === 'configure' && selectedAssessment && (
          <motion.div
            key="configure"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Selected Assessment */}
            <div className="p-4 rounded-lg bg-primary-500/10 border border-primary-500/20">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-primary-400" />
                <span className="text-sm font-medium text-primary-300">Wybrana ocena</span>
              </div>
              <p className="text-c-text font-medium">{selectedAssessment.name}</p>
            </div>

            {/* Methodology */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                <Brain className="w-4 h-4 inline mr-2" />
                {t('admin.initiativeCreator.methodology', 'Metodologia')}
              </label>
              <div className="space-y-2">
                {METHODOLOGIES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMethodologyId(m.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      methodologyId === m.id
                        ? 'bg-primary-500/10 border-primary-500/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <p
                      className={`font-medium ${methodologyId === m.id ? 'text-primary-300' : 'text-c-text'}`}
                    >
                      {m.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{m.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Count */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('admin.initiativeCreator.count', 'Liczba inicjatyw')}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={requestedCount}
                onChange={(e) => setRequestedCount(parseInt(e.target.value) || 20)}
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-c-text focus:outline-none focus:border-primary-500/50"
              />
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeChatContext}
                  onChange={(e) => setIncludeChatContext(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-300">
                  {t('admin.initiativeCreator.includeContext', 'Uwzględnij kontekst z czatu')}
                </span>
              </label>
            </div>

            {/* Consultant Brief */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('admin.initiativeCreator.consultantBrief', 'Dodatkowe wskazówki (opcjonalne)')}
              </label>
              <textarea
                value={consultantBrief}
                onChange={(e) => setConsultantBrief(e.target.value)}
                rows={3}
                placeholder={t(
                  'admin.initiativeCreator.consultantBriefPlaceholder',
                  'Np. skup się na automatyzacji procesów...'
                )}
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-c-text placeholder-slate-500 focus:outline-none focus:border-primary-500/50 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep('select')}
                className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
              >
                {t('common.back', 'Wstecz')}
              </button>
              <button
                onClick={handleStartGeneration}
                disabled={!canStart || starting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {starting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('admin.initiativeCreator.starting', 'Uruchamianie...')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {t('admin.initiativeCreator.generate', 'Generuj inicjatywy')}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Running */}
        {step === 'running' && (
          <motion.div
            key="running"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-500/20 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            </div>
            <h3 className="text-lg font-medium text-c-text mb-2">
              {t('admin.initiativeCreator.generating', 'Generowanie inicjatyw...')}
            </h3>
            {progress && (
              <div className="space-y-2 mt-4">
                <p className="text-slate-500 dark:text-slate-400">
                  Wygenerowano: {progress.generatedCount} / {progress.requestedCount}
                </p>
                <div className="w-64 mx-auto h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-c-surface transition-all"
                    style={{
                      width: `${(progress.generatedCount / progress.requestedCount) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && progress && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-medium text-c-text mb-2">
              {t('admin.initiativeCreator.completed', 'Generowanie zakończone!')}
            </h3>
            <p className="text-slate-400 mb-6">
              {t('admin.initiativeCreator.completedDesc', 'Wygenerowano {{count}} inicjatyw', {
                count: progress.generatedCount,
              })}
            </p>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-medium transition-colors"
            >
              {t('admin.initiativeCreator.generateMore', 'Generuj więcej')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminInitiativeCreatorPanel;
