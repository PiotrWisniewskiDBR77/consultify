/**
 * StageGateModal
 *
 * Modal wrapper for AssessmentStageGate component.
 * Shows gate criteria checklist and allows proceeding to next phase.
 */

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Shield,
  Unlock,
  X,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface GateCriterion {
  id: string;
  criterion: string;
  isMet: boolean;
  evidence?: string;
}

interface StageGateModalProps {
  projectId: string;
  assessmentId: string;
  gateType: 'READINESS_GATE' | 'DESIGN_GATE' | 'PLANNING_GATE' | 'EXECUTION_GATE' | 'CLOSURE_GATE';
  fromPhase: string;
  toPhase: string;
  onClose: () => void;
  onProceed: () => void;
}

const GATE_CONFIG: Record<string, { title: string; description: string }> = {
  READINESS_GATE: {
    title: 'Bramka Gotowości',
    description: 'Sprawdź gotowość przed rozpoczęciem Assessment',
  },
  DESIGN_GATE: {
    title: 'Bramka Design',
    description: 'Zatwierdź Assessment przed tworzeniem Raportu',
  },
  PLANNING_GATE: {
    title: 'Bramka Planowania',
    description: 'Sprawdź gotowość inicjatyw przed Roadmapą',
  },
  EXECUTION_GATE: {
    title: 'Bramka Wykonania',
    description: 'Zatwierdź roadmapę przed rozpoczęciem realizacji',
  },
  CLOSURE_GATE: {
    title: 'Bramka Zamknięcia',
    description: 'Sprawdź gotowość do stabilizacji',
  },
};

export const StageGateModal: React.FC<StageGateModalProps> = ({
  projectId,
  assessmentId,
  gateType,
  fromPhase,
  toPhase,
  onClose,
  onProceed,
}) => {
  const [loading, setLoading] = useState(true);
  const [criteria, setCriteria] = useState<GateCriterion[]>([]);
  const [isGatePassed, setIsGatePassed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passing, setPassing] = useState(false);

  const gateConfig = GATE_CONFIG[gateType] || GATE_CONFIG['DESIGN_GATE'];

  // Fetch gate criteria
  useEffect(() => {
    const fetchGateCriteria = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/stage-gates/${projectId}/evaluate/${gateType}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setCriteria(data.completionCriteria || []);
          setIsGatePassed(data.status === 'READY');
        } else {
          setError('Nie udało się pobrać kryteriów bramki. Spróbuj ponownie.');
          setCriteria([]);
          setIsGatePassed(false);
        }
      } catch (err) {
        console.error('[StageGateModal] Error:', err);
        setError('Nie udało się pobrać kryteriów bramki. Sprawdź połączenie i spróbuj ponownie.');
        setCriteria([]);
        setIsGatePassed(false);
      } finally {
        setLoading(false);
      }
    };

    fetchGateCriteria();
  }, [projectId, gateType]);

  // Handle passing the gate
  const handlePassGate = async () => {
    if (!isGatePassed) return;

    setPassing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/stage-gates/${projectId}/pass/${gateType}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Nie udało się przejść bramki');
      }

      onProceed();
    } catch (err: any) {
      console.error('[StageGateModal] Error passing gate:', err);
      setError(err?.message || 'Nie udało się przejść bramki. Spróbuj ponownie.');
    } finally {
      setPassing(false);
    }
  };

  const metCount = criteria.filter((c) => c.isMet).length;
  const progressPercent = criteria.length > 0 ? Math.round((metCount / criteria.length) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay p-4">
      <div className="bg-c-surface rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-c-border-subtle bg-c-surface-raised">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  isGatePassed
                    ? 'bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)]'
                    : 'bg-[color-mix(in_srgb,var(--c-warning)_15%,transparent)]'
                }`}
              >
                <Shield
                  className={`w-5 h-5 ${
                    isGatePassed
                      ? 'text-c-success'
                      : 'text-c-warning'
                  }`}
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-c-text">
                  {gateConfig.title}
                </h3>
                <p className="text-sm text-c-text-muted">
                  {fromPhase} → {toPhase}
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
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-c-accent animate-spin" />
            </div>
          ) : (
            <>
              {/* Description */}
              <p className="text-sm text-c-text-secondary mb-4">
                {gateConfig.description}
              </p>

              {/* Error state */}
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-500/30 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-danger-700 dark:text-danger-300">{error}</p>
                    <p className="text-xs text-danger-500 dark:text-danger-400 mt-1">
                      Nie można ocenić bramki. Sprawdź konfigurację projektu lub skontaktuj się z
                      administratorem.
                    </p>
                  </div>
                </div>
              )}

              {/* Progress */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-2 bg-c-surface-raised rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      progressPercent === 100 ? 'bg-c-success' : 'bg-c-warning'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span
                  className={`text-sm font-medium ${
                    progressPercent === 100
                      ? 'text-c-success'
                      : 'text-c-warning'
                  }`}
                >
                  {metCount}/{criteria.length}
                </span>
              </div>

              {/* Criteria List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {criteria.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      c.isMet
                        ? 'bg-[color-mix(in_srgb,var(--c-success)_8%,transparent)] border-c-success'
                        : 'bg-c-surface-raised dark:bg-c-bg border-c-border-subtle'
                    }`}
                  >
                    <div className="mt-0.5">
                      {c.isMet ? (
                        <CheckCircle2 className="w-5 h-5 text-c-success" />
                      ) : (
                        <XCircle className="w-5 h-5 text-c-text-secondary dark:text-c-text-muted" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          c.isMet
                            ? 'text-c-success'
                            : 'text-c-text-secondary dark:text-c-text-muted'
                        }`}
                      >
                        {c.criterion}
                      </p>
                      {c.evidence && (
                        <p className="text-xs text-c-text-muted mt-0.5">
                          {c.evidence}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Gate Status */}
              <div
                className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${
                  isGatePassed
                    ? 'bg-[color-mix(in_srgb,var(--c-success)_10%,transparent)] border border-c-success'
                    : 'bg-[color-mix(in_srgb,var(--c-warning)_10%,transparent)] border-l-2 border-c-warning'
                }`}
              >
                {isGatePassed ? (
                  <>
                    <Unlock className="w-5 h-5 text-c-success" />
                    <span className="text-sm font-medium text-c-success">
                      Bramka otwarta - możesz przejść dalej
                    </span>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5 text-c-warning" />
                    <span className="text-sm font-medium text-c-warning">
                      Bramka zamknięta - spełnij wymagania
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-c-border-subtle bg-c-surface-raised dark:bg-c-bg">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-c-border-subtle text-c-text-secondary dark:text-c-text-muted rounded-lg font-medium hover:bg-c-surface-raised dark:hover:bg-white/5 transition-colors"
            >
              Anuluj
            </button>
            <button
              onClick={handlePassGate}
              disabled={!isGatePassed || passing}
              className={`
                                flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
                                ${
                                  isGatePassed && !passing
                                    ? 'bg-c-success hover:opacity-90 text-white'
                                    : 'bg-c-surface-raised text-c-text-secondary dark:text-c-text-muted cursor-not-allowed'
                                }
                            `}
            >
              {passing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Przechodzę...
                </>
              ) : (
                <>
                  <ArrowRight size={16} />
                  Przejdź do {toPhase}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
