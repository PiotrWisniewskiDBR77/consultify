/**
 * GenerateInitiativesModal
 *
 * Modal for generating transformation initiatives from an approved report.
 * Uses AI to analyze gaps and generate actionable initiatives.
 *
 * Flow:
 * 1. Select a finalized report
 * 2. Configure AI generation parameters
 * 3. Preview generated initiatives
 * 4. Approve and save to database
 */

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Edit,
  Eye,
  FileText,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Report {
  id: string;
  name: string;
  assessmentId: string;
  assessmentName: string;
  status: string;
  createdAt: string;
}

interface GeneratedInitiative {
  id: string;
  name: string;
  description: string;
  sourceAxisId: string;
  area?: string;
  estimatedROI: number;
  estimatedBudget: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  objectives: string[];
  assessmentId: string;
  problemStatement?: string;
}

interface GenerateInitiativesModalProps {
  projectId: string;
  preselectedReportId?: string;
  onClose: () => void;
  onGenerated: (count: number) => void;
}

// Steps in the wizard
type WizardStep = 'select-report' | 'configure' | 'preview' | 'saving';

export const GenerateInitiativesModal: React.FC<GenerateInitiativesModalProps> = ({
  projectId,
  preselectedReportId,
  onClose,
  onGenerated,
}) => {
  // Wizard state
  const [step, setStep] = useState<WizardStep>('select-report');

  // Report selection
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    preselectedReportId || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingReports, setLoadingReports] = useState(true);

  // AI Configuration
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium'>('all');
  const [maxInitiatives, setMaxInitiatives] = useState(10);

  // Generated initiatives
  const [generatedInitiatives, setGeneratedInitiatives] = useState<GeneratedInitiative[]>([]);
  const [selectedInitiatives, setSelectedInitiatives] = useState<Set<string>>(new Set());

  // Status
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch reports on mount
  useEffect(() => {
    const fetchReports = async () => {
      setLoadingReports(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const url = projectId
          ? `/api/assessment-reports?status=APPROVED&projectId=${projectId}`
          : '/api/assessment-reports?status=APPROVED';

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setReports(data.reports || []);

          // Auto-select if preselected
          if (preselectedReportId) {
            const found = (data.reports || []).find((r: Report) => r.id === preselectedReportId);
            if (found) {
              setSelectedReportId(found.id);
              // Skip directly to configure step
              setStep('configure');
            }
          }
        } else {
          setError('Nie udało się pobrać listy raportów');
        }
      } catch (err) {
        console.error('[GenerateInitiativesModal] Error fetching reports:', err);
        setError('Błąd połączenia');
      } finally {
        setLoadingReports(false);
      }
    };

    fetchReports();
  }, [projectId, preselectedReportId]);

  // Get selected report
  const selectedReport = reports.find((r) => r.id === selectedReportId);

  // Filter reports by search
  const filteredReports = reports.filter((r) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return r.name.toLowerCase().includes(query) || r.assessmentName?.toLowerCase().includes(query);
  });

  // Generate initiatives using AI
  const handleGenerate = async () => {
    if (!selectedReport) {
      setError('Wybierz raport');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');

      // First, get gaps from the assessment
      const gapsResponse = await fetch(`/api/initiatives/gaps/${selectedReport.assessmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let gaps: any[] = [];
      if (gapsResponse.ok) {
        const gapsData = await gapsResponse.json();
        gaps = gapsData.gaps || [];
      }

      // If no gaps API, generate directly
      const response = await fetch('/api/initiatives/generate/ai', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gaps: gaps.length > 0 ? gaps : [{ assessmentId: selectedReport.assessmentId }],
          constraints: {
            maxInitiatives,
            priorityFilter,
            focusAreas: focusAreas.length > 0 ? focusAreas : undefined,
          },
          context: {
            reportId: selectedReport.id,
            reportName: selectedReport.name,
            assessmentId: selectedReport.assessmentId,
            projectId,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const initiatives = (data.initiatives || []).map((init: any) => ({
          ...init,
          id: init.id || uuidv4(),
          assessmentId: selectedReport.assessmentId,
        }));
        setGeneratedInitiatives(initiatives);
        // Select all by default
        setSelectedInitiatives(new Set(initiatives.map((i: GeneratedInitiative) => i.id)));
        setStep('preview');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Nie udało się wygenerować inicjatyw');
      }
    } catch (err) {
      console.error('[GenerateInitiativesModal] Generate error:', err);
      setError('Błąd podczas generowania');
    } finally {
      setGenerating(false);
    }
  };

  // Save selected initiatives
  const handleSave = async () => {
    const toSave = generatedInitiatives.filter((i) => selectedInitiatives.has(i.id));

    if (toSave.length === 0) {
      setError('Wybierz co najmniej jedną inicjatywę');
      return;
    }

    setSaving(true);
    setError(null);
    setStep('saving');

    try {
      const token = localStorage.getItem('token');

      const response = await fetch('/api/initiatives/approve', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initiatives: toSave,
          projectId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(true);
        setTimeout(() => {
          onGenerated(result.transferred?.length || toSave.length);
          onClose();
        }, 1500);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Nie udało się zapisać inicjatyw');
        setStep('preview');
      }
    } catch (err) {
      console.error('[GenerateInitiativesModal] Save error:', err);
      setError('Błąd podczas zapisywania');
      setStep('preview');
    } finally {
      setSaving(false);
    }
  };

  // Toggle initiative selection
  const toggleInitiative = (id: string) => {
    const newSelected = new Set(selectedInitiatives);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedInitiatives(newSelected);
  };

  // Toggle all
  const toggleAll = () => {
    if (selectedInitiatives.size === generatedInitiatives.length) {
      setSelectedInitiatives(new Set());
    } else {
      setSelectedInitiatives(new Set(generatedInitiatives.map((i) => i.id)));
    }
  };

  // Remove initiative from list
  const removeInitiative = (id: string) => {
    setGeneratedInitiatives((prev) => prev.filter((i) => i.id !== id));
    const newSelected = new Set(selectedInitiatives);
    newSelected.delete(id);
    setSelectedInitiatives(newSelected);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M PLN`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k PLN`;
    return `${amount} PLN`;
  };

  // Risk level colors
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'HIGH':
        return 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400';
      case 'MEDIUM':
        return 'bg-[color-mix(in_srgb,var(--c-warning)_15%,transparent)] text-c-warning';
      default:
        return 'bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] text-c-success';
    }
  };

  // DRD Axes labels
  const AXIS_LABELS: Record<string, string> = {
    processes: 'Procesy',
    digitalProducts: 'Produkty Cyfrowe',
    businessModels: 'Modele Biznesowe',
    dataManagement: 'Zarządzanie Danymi',
    culture: 'Kultura',
    cybersecurity: 'Cyberbezpieczeństwo',
    aiMaturity: 'Dojrzałość AI',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay p-4">
      <div className="bg-c-surface rounded-xl w-full max-w-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-c-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-c-accent-soft rounded-lg">
                <Sparkles className="w-5 h-5 text-c-accent dark:text-c-accent" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-c-text">Generuj Inicjatywy</h3>
                <p className="text-sm text-c-text-muted">
                  {step === 'select-report' && 'Wybierz raport źródłowy'}
                  {step === 'configure' && 'Skonfiguruj parametry AI'}
                  {step === 'preview' &&
                    `Przejrzyj ${generatedInitiatives.length} wygenerowanych inicjatyw`}
                  {step === 'saving' && 'Zapisywanie...'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-4">
            {['select-report', 'configure', 'preview'].map((s, idx) => {
              const stepLabels = ['Raport', 'Konfiguracja', 'Podgląd'];
              const stepIdx = ['select-report', 'configure', 'preview'].indexOf(step);
              const isActive = s === step;
              const isPast = stepIdx > idx;

              return (
                <React.Fragment key={s}>
                  <div
                    className={`
                                        flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                                        ${isActive ? 'bg-c-surface-raised dark:bg-white/[0.1] text-c-text' : ''}
                                        ${isPast ? 'bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] text-c-success' : ''}
                                        ${!isActive && !isPast ? 'bg-c-surface-raised text-c-text-muted' : ''}
                                    `}
                  >
                    {isPast ? <CheckCircle2 size={14} /> : <span>{idx + 1}</span>}
                    {stepLabels[idx]}
                  </div>
                  {idx < 2 && <ChevronRight size={16} className="text-c-text-muted" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Success State */}
          {success && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-c-success" />
              </div>
              <p className="text-lg font-medium text-c-text">Inicjatywy zapisane!</p>
              <p className="text-sm text-c-text-muted mt-1">
                {selectedInitiatives.size} inicjatyw dodano do rejestru
              </p>
            </div>
          )}

          {/* Step 1: Select Report */}
          {step === 'select-report' && !success && (
            <>
              {loadingReports ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-c-accent animate-spin" />
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-c-text-secondary dark:text-c-text-muted mx-auto mb-3" />
                  <p className="text-c-text-muted font-medium">Brak sfinalizowanych raportów</p>
                  <p className="text-sm text-c-text-muted mt-1">
                    Najpierw sfinalizuj raport w zakładce Reports
                  </p>
                </div>
              ) : (
                <>
                  {/* Search */}
                  {reports.length > 3 && (
                    <div className="relative mb-4">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted"
                        size={16}
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Szukaj raportu..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface dark:bg-c-bg text-c-text text-sm"
                      />
                    </div>
                  )}

                  {/* Report List */}
                  <div className="space-y-2">
                    {filteredReports.map((report) => {
                      const isSelected = selectedReportId === report.id;
                      return (
                        <button
                          key={report.id}
                          onClick={() => setSelectedReportId(report.id)}
                          className={`
                                                        w-full text-left p-4 rounded-lg border-2 transition-all
                                                        ${
                                                          isSelected
                                                            ? 'border-c-accent bg-c-accent-soft'
                                                            : 'border-c-border-subtle hover:border-c-border-subtle dark:hover:border-white/20'
                                                        }
                                                    `}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className={`
                                                                w-5 h-5 rounded-full flex items-center justify-center border-2
                                                                ${
                                                                  isSelected
                                                                    ? 'bg-c-text border-c-accent'
                                                                    : 'border-c-border-subtle'
                                                                }
                                                            `}
                              >
                                {isSelected && (
                                  <CheckCircle2 size={12} className="text-c-surface" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-c-text">{report.name}</p>
                                <p className="text-xs text-c-text-muted mt-0.5">
                                  Assessment: {report.assessmentName}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] text-c-success rounded-full text-xs font-medium">
                                <CheckCircle2 size={10} />
                                Final
                              </span>
                              <p className="text-xs text-c-text-muted mt-1">
                                {report.createdAt ? formatDate(report.createdAt) : ''}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* Step 2: Configure */}
          {step === 'configure' && !success && (
            <div className="space-y-6">
              {/* Selected Report Summary */}
              {selectedReport && (
                <div className="p-4 bg-c-accent-soft rounded-lg border border-c-accent dark:border-c-accent">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-c-accent dark:text-c-accent" />
                    <div>
                      <p className="font-medium text-c-text">{selectedReport.name}</p>
                      <p className="text-xs text-c-text-muted">{selectedReport.assessmentName}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Max Initiatives */}
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  Maksymalna liczba inicjatyw
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={3}
                    max={20}
                    value={maxInitiatives}
                    onChange={(e) => setMaxInitiatives(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-8 text-center font-medium text-c-text">{maxInitiatives}</span>
                </div>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  Priorytet inicjatyw
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'all', label: 'Wszystkie' },
                    { value: 'high', label: 'Tylko wysokie' },
                    { value: 'medium', label: 'Średnie i wyższe' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPriorityFilter(opt.value as any)}
                      className={`
                                                px-4 py-2 rounded-lg text-sm font-medium transition-all border-2
                                                ${
                                                  priorityFilter === opt.value
                                                    ? 'bg-c-accent-soft text-c-accent dark:text-c-accent border-c-accent'
                                                    : 'bg-c-surface dark:bg-c-bg text-c-text-secondary dark:text-c-text-muted border-c-border-subtle hover:border-c-border-subtle'
                                                }
                                            `}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Note */}
              <div className="flex items-start gap-3 p-4 bg-[color-mix(in_srgb,var(--c-warning)_10%,transparent)] rounded-lg border-l-2 border-c-warning">
                <Sparkles className="w-5 h-5 text-c-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-c-warning">Generowanie AI</p>
                  <p className="text-xs text-c-warning mt-1">
                    AI przeanalizuje luki w assessment i wygeneruje rekomendacje inicjatyw
                    transformacyjnych. Każda inicjatywa będzie zawierać szacowany ROI, budżet i
                    poziom ryzyka.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && !success && (
            <div className="space-y-4">
              {/* Selection controls */}
              <div className="flex items-center justify-between">
                <button
                  onClick={toggleAll}
                  className="text-sm text-c-accent dark:text-c-accent hover:underline"
                >
                  {selectedInitiatives.size === generatedInitiatives.length
                    ? 'Odznacz wszystkie'
                    : 'Zaznacz wszystkie'}
                </button>
                <span className="text-sm text-c-text-muted">
                  Wybrano: {selectedInitiatives.size} / {generatedInitiatives.length}
                </span>
              </div>

              {/* Initiatives List */}
              <div className="space-y-3">
                {generatedInitiatives.map((initiative) => {
                  const isSelected = selectedInitiatives.has(initiative.id);
                  return (
                    <div
                      key={initiative.id}
                      className={`
                                                p-4 rounded-lg border-2 transition-all
                                                ${
                                                  isSelected
                                                    ? 'border-c-accent bg-c-accent-soft'
                                                    : 'border-c-border-subtle'
                                                }
                                            `}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleInitiative(initiative.id)}
                          className={`
                                                        w-5 h-5 rounded shrink-0 mt-0.5 flex items-center justify-center border-2 transition-colors
                                                        ${
                                                          isSelected
                                                            ? 'bg-c-text border-c-accent'
                                                            : 'border-c-border-subtle hover:border-c-accent'
                                                        }
                                                    `}
                        >
                          {isSelected && <CheckCircle2 size={12} className="text-c-surface" />}
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-c-text">{initiative.name}</p>
                              <p className="text-xs text-c-text-muted mt-0.5">
                                {AXIS_LABELS[initiative.sourceAxisId] || initiative.sourceAxisId}
                                {initiative.area && ` • ${initiative.area}`}
                              </p>
                            </div>
                            <button
                              onClick={() => removeInitiative(initiative.id)}
                              className="p-1 text-c-text-muted hover:text-danger-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <p className="text-sm text-c-text-secondary mt-2 line-clamp-2">
                            {initiative.description}
                          </p>

                          {/* Metrics */}
                          <div className="flex items-center gap-4 mt-3">
                            <div className="flex items-center gap-1.5 text-c-success">
                              <TrendingUp size={14} />
                              <span className="text-xs font-medium">
                                ROI: {initiative.estimatedROI}x
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-c-text-muted">
                              <DollarSign size={14} />
                              <span className="text-xs">
                                {formatCurrency(initiative.estimatedBudget)}
                              </span>
                            </div>
                            <span
                              className={`
                                                            px-2 py-0.5 rounded text-xs font-medium
                                                            ${getRiskColor(initiative.riskLevel)}
                                                        `}
                            >
                              {initiative.riskLevel === 'HIGH'
                                ? 'Wysokie ryzyko'
                                : initiative.riskLevel === 'MEDIUM'
                                  ? 'Średnie ryzyko'
                                  : 'Niskie ryzyko'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {generatedInitiatives.length === 0 && (
                <div className="text-center py-8">
                  <Lightbulb className="w-12 h-12 text-c-text-secondary dark:text-c-text-muted mx-auto mb-3" />
                  <p className="text-c-text-muted">Nie wygenerowano żadnych inicjatyw</p>
                  <button
                    onClick={() => setStep('configure')}
                    className="mt-4 text-c-accent dark:text-c-accent hover:underline text-sm"
                  >
                    Zmień konfigurację i spróbuj ponownie
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Saving State */}
          {step === 'saving' && !success && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-c-accent animate-spin mb-4" />
              <p className="text-lg font-medium text-c-text">Zapisuję inicjatywy...</p>
              <p className="text-sm text-c-text-muted mt-1">
                {selectedInitiatives.size} inicjatyw zostanie dodanych do rejestru
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 mt-4 bg-danger-50 dark:bg-danger-500/10 text-danger-600 dark:text-danger-400 rounded-lg text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && step !== 'saving' && (
          <div className="shrink-0 px-6 py-4 border-t border-c-border-subtle bg-c-surface-raised dark:bg-c-bg">
            <div className="flex items-center gap-3">
              {/* Back button */}
              {step !== 'select-report' && (
                <button
                  onClick={() => {
                    if (step === 'configure') setStep('select-report');
                    if (step === 'preview') setStep('configure');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 border border-c-border-subtle text-c-text-secondary dark:text-c-text-muted rounded-lg font-medium hover:bg-c-surface-raised dark:hover:bg-white/5 transition-colors"
                >
                  <ChevronLeft size={16} />
                  Wstecz
                </button>
              )}

              <div className="flex-1" />

              {/* Cancel */}
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-c-text-secondary dark:text-c-text-muted hover:text-c-text dark:hover:text-c-text-muted font-medium transition-colors"
              >
                Anuluj
              </button>

              {/* Next/Generate/Save */}
              {step === 'select-report' && (
                <button
                  onClick={() => setStep('configure')}
                  disabled={!selectedReportId}
                  className={`
                                        flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
                                        ${
                                          selectedReportId
                                            ? 'bg-c-text text-c-surface hover:opacity-90'
                                            : 'bg-c-surface-raised text-c-text-secondary dark:text-c-text-muted cursor-not-allowed'
                                        }
                                    `}
                >
                  Dalej
                  <ChevronRight size={16} />
                </button>
              )}

              {step === 'configure' && (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2.5 bg-c-text text-c-surface hover:opacity-90 rounded-lg font-medium transition-all"
                >
                  {generating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Generuję...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Generuj z AI
                    </>
                  )}
                </button>
              )}

              {step === 'preview' && (
                <button
                  onClick={handleSave}
                  disabled={selectedInitiatives.size === 0 || saving}
                  className={`
                                        flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
                                        ${
                                          selectedInitiatives.size > 0 && !saving
                                            ? 'bg-c-success hover:opacity-90 text-white'
                                            : 'bg-c-surface-raised text-c-text-secondary dark:text-c-text-muted cursor-not-allowed'
                                        }
                                    `}
                >
                  <Save size={16} />
                  Zapisz ({selectedInitiatives.size})
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
