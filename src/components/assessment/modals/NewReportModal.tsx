/**
 * NewReportModal
 *
 * Modal for creating a new report from an approved assessment.
 * Fetches list of approved assessments and allows selecting one to create a report.
 * Includes context readiness validation before allowing report creation.
 */

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  FileOutput,
  FileText,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { ContextReadinessGate } from '../ContextReadinessGate';

interface ApprovedAssessment {
  id: string;
  name: string;
  projectName: string;
  completedAt: string;
  createdBy: string;
  progress: number;
}

interface NewReportModalProps {
  projectId?: string;
  preselectedAssessmentId?: string;
  onClose: () => void;
  onCreated: (reportId: string) => void;
}

export const NewReportModal: React.FC<NewReportModalProps> = ({
  projectId,
  preselectedAssessmentId,
  onClose,
  onCreated,
}) => {
  const [assessments, setAssessments] = useState<ApprovedAssessment[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(
    preselectedAssessmentId || null
  );
  const [reportName, setReportName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Context readiness state
  const [canGenerateReport, setCanGenerateReport] = useState(false);
  const [contextScore, setContextScore] = useState(0);
  const [showContextGate, setShowContextGate] = useState(false);

  // Handle context readiness change
  const handleReadinessChange = useCallback((canFinalize: boolean, score: number) => {
    setCanGenerateReport(canFinalize);
    setContextScore(score);
    // Show gate if score is below threshold
    if (!canFinalize) {
      setShowContextGate(true);
    }
  }, []);

  // Fetch approved assessments
  useEffect(() => {
    const fetchAssessments = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const url = projectId
          ? `/api/assessments?status=APPROVED&projectId=${projectId}`
          : '/api/assessments?status=APPROVED';

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setAssessments(data.assessments || []);

          // Auto-select if preselected
          if (preselectedAssessmentId) {
            const found = (data.assessments || []).find(
              (a: ApprovedAssessment) => a.id === preselectedAssessmentId
            );
            if (found) {
              setReportName(`Report - ${found.name}`);
            }
          }
        } else {
          setError('Nie udało się pobrać listy assessmentów');
        }
      } catch (err) {
        console.error('[NewReportModal] Error fetching assessments:', err);
        setError('Błąd połączenia');
      } finally {
        setLoading(false);
      }
    };

    fetchAssessments();
  }, [projectId, preselectedAssessmentId]);

  // Handle assessment selection
  const handleSelectAssessment = useCallback(
    (assessmentId: string) => {
      setSelectedAssessmentId(assessmentId);
      const selected = assessments.find((a) => a.id === assessmentId);
      if (selected && !reportName) {
        setReportName(`Report - ${selected.name}`);
      }
    },
    [assessments, reportName]
  );

  // Create report
  const handleCreate = async () => {
    if (!selectedAssessmentId) {
      setError('Wybierz assessment');
      return;
    }

    if (!reportName.trim()) {
      setError('Podaj nazwę raportu');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/assessment-reports', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assessmentId: selectedAssessmentId,
          name: reportName.trim(),
          projectId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(true);
        setTimeout(() => {
          onCreated(data.id);
          onClose();
        }, 1500);
      } else {
        const data = await response.json();
        setError(data.error || 'Nie udało się utworzyć raportu');
      }
    } catch (err) {
      console.error('[NewReportModal] Create error:', err);
      setError('Błąd połączenia');
    } finally {
      setCreating(false);
    }
  };

  // Filter assessments by search
  const filteredAssessments = assessments.filter((a) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return a.name.toLowerCase().includes(query) || a.projectName.toLowerCase().includes(query);
  });

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay p-4">
      <div className="bg-c-surface rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-c-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-c-accent-soft rounded-lg">
                <FileOutput className="w-5 h-5 text-c-accent dark:text-c-accent" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-c-text">Nowy Raport</h3>
                <p className="text-sm text-c-text-muted">
                  Utwórz raport z zatwierdzonego assessmentu
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
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[500px] overflow-y-auto">
          {/* Context Readiness Gate - shown if context insufficient */}
          {showContextGate && !canGenerateReport && projectId && (
            <div className="mb-4">
              <ContextReadinessGate
                projectId={projectId}
                onReadinessChange={handleReadinessChange}
                onNavigateToContext={() => {
                  onClose();
                  // Navigate to organization profile - parent should handle this
                }}
                showRecommendations={true}
              />
            </div>
          )}

          {/* Context check for projectId */}
          {projectId && !showContextGate && !canGenerateReport && (
            <div className="hidden">
              <ContextReadinessGate
                projectId={projectId}
                onReadinessChange={handleReadinessChange}
                compact={true}
              />
            </div>
          )}

          {success ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-full bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-c-success" />
              </div>
              <p className="text-lg font-medium text-c-text">Raport utworzony!</p>
              <p className="text-sm text-c-text-muted mt-1">
                Możesz teraz edytować treść raportu
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-c-accent animate-spin" />
            </div>
          ) : assessments.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-c-text-secondary dark:text-c-text-muted mx-auto mb-3" />
              <p className="text-c-text-muted font-medium">
                Brak zatwierdzonych assessmentów
              </p>
              <p className="text-sm text-c-text-muted mt-1">
                Najpierw zatwierdź assessment w procesie recenzji
              </p>
            </div>
          ) : (
            <>
              {/* Report Name Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  Nazwa raportu
                </label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="np. Raport DRD Q1 2025"
                  className="w-full px-4 py-2.5 rounded-lg border border-c-border-subtle bg-c-surface dark:bg-c-bg text-c-text placeholder:text-c-text-muted dark:placeholder:text-c-text-muted"
                />
              </div>

              {/* Search */}
              {assessments.length > 3 && (
                <div className="relative mb-4">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted"
                    size={16}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Szukaj assessmentu..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-c-border-subtle bg-c-surface dark:bg-c-bg text-c-text placeholder:text-c-text-muted dark:placeholder:text-c-text-muted text-sm"
                  />
                </div>
              )}

              {/* Assessment Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  Wybierz assessment ({filteredAssessments.length})
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredAssessments.map((assessment) => {
                    const isSelected = selectedAssessmentId === assessment.id;
                    return (
                      <button
                        key={assessment.id}
                        onClick={() => handleSelectAssessment(assessment.id)}
                        className={`
                                                    w-full text-left p-3 rounded-lg border-2 transition-all
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
                                                                ? 'bg-c-accent border-c-accent'
                                                                : 'border-c-border-subtle'
                                                            }
                                                        `}
                            >
                              {isSelected && <CheckCircle2 size={12} className="text-white" />}
                            </div>
                            <div>
                              <p className="font-medium text-c-text text-sm">
                                {assessment.name}
                              </p>
                              <p className="text-xs text-c-text-muted">
                                {assessment.projectName}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] text-c-success rounded-full text-xs font-medium">
                              <CheckCircle2 size={10} />
                              Zatwierdzony
                            </span>
                            <p className="text-xs text-c-text-muted mt-1">
                              {assessment.completedAt ? formatDate(assessment.completedAt) : ''}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
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
        {!success && !loading && assessments.length > 0 && (
          <div className="px-6 py-4 border-t border-c-border-subtle bg-c-surface-raised dark:bg-c-bg">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-c-border-subtle text-c-text-secondary dark:text-c-text-muted rounded-lg font-medium hover:bg-c-surface-raised dark:hover:bg-white/5 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleCreate}
                disabled={
                  !selectedAssessmentId ||
                  !reportName.trim() ||
                  creating ||
                  (projectId ? !canGenerateReport : false)
                }
                className={`
                                    flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
                                    ${
                                      selectedAssessmentId &&
                                      reportName.trim() &&
                                      !creating &&
                                      (!projectId || canGenerateReport)
                                        ? 'bg-c-text text-c-surface hover:opacity-90'
                                        : 'bg-c-surface-raised text-c-text-secondary dark:text-c-text-muted cursor-not-allowed'
                                    }
                                `}
                title={
                  projectId && !canGenerateReport
                    ? `Context score (${contextScore}%) is below required threshold`
                    : undefined
                }
              >
                {creating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Tworzę...
                  </>
                ) : projectId && !canGenerateReport ? (
                  <>
                    <Building2 size={16} />
                    Uzupełnij kontekst ({contextScore}%)
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Utwórz raport
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
