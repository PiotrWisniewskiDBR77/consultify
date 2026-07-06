/**
 * TransferToRoadmapModal
 *
 * Modal for transferring an approved initiative to the roadmap.
 * Allows selection of:
 * - Target quarter (Q1-Q4 for current and next year)
 * - Priority (optional)
 * - Additional notes
 */

import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Flag,
  Loader2,
  MapPin,
  Target,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface TransferToRoadmapModalProps {
  initiativeId: string;
  initiativeName: string;
  onClose: () => void;
  onTransferred: () => void;
}

// Generate quarters for current and next year
const generateQuarters = () => {
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const quarters: { value: string; label: string; isPast: boolean }[] = [];

  // Current year quarters
  for (let q = 1; q <= 4; q++) {
    quarters.push({
      value: `${currentYear}-Q${q}`,
      label: `Q${q} ${currentYear}`,
      isPast: q < currentQuarter,
    });
  }

  // Next year quarters
  for (let q = 1; q <= 4; q++) {
    quarters.push({
      value: `${currentYear + 1}-Q${q}`,
      label: `Q${q} ${currentYear + 1}`,
      isPast: false,
    });
  }

  return quarters;
};

const PRIORITY_OPTIONS = [
  {
    value: 'LOW',
    label: 'Niski',
    color: 'bg-c-surface-raised text-c-text-secondary dark:bg-c-surface-raised dark:text-c-text-muted',
  },
  {
    value: 'MEDIUM',
    label: 'Średni',
    color: 'bg-[color-mix(in_srgb,var(--c-warning)_15%,transparent)] text-c-warning',
  },
  {
    value: 'HIGH',
    label: 'Wysoki',
    color: 'bg-[color-mix(in_srgb,var(--c-warning)_15%,transparent)] text-c-warning',
  },
  {
    value: 'CRITICAL',
    label: 'Krytyczny',
    color: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
  },
];

export const TransferToRoadmapModal: React.FC<TransferToRoadmapModalProps> = ({
  initiativeId,
  initiativeName,
  onClose,
  onTransferred,
}) => {
  const [quarters] = useState(generateQuarters);
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');
  const [priority, setPriority] = useState<string>('MEDIUM');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Set default quarter to current + 1 (or first non-past quarter)
  useEffect(() => {
    const firstFuture = quarters.find((q) => !q.isPast);
    if (firstFuture) {
      setSelectedQuarter(firstFuture.value);
    }
  }, [quarters]);

  // Handle transfer
  const handleTransfer = async () => {
    if (!selectedQuarter) {
      setError('Wybierz kwartał');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/initiatives/${initiativeId}/transfer-to-roadmap`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quarter: selectedQuarter,
          priority,
          notes: notes.trim(),
        }),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onTransferred();
          onClose();
        }, 1500);
      } else {
        const data = await response.json();
        setError(data.error || 'Nie udało się przenieść do roadmapy');
      }
    } catch (err) {
      console.error('[TransferToRoadmapModal] Transfer error:', err);
      setError('Błąd połączenia');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay p-4">
      <div className="bg-c-surface rounded-xl w-full max-w-md shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-c-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-c-accent-soft rounded-lg">
                <MapPin className="w-5 h-5 text-c-accent dark:text-c-accent" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-c-text">
                  Dodaj do Roadmapy
                </h3>
                <p className="text-sm text-c-text-muted truncate max-w-[200px]">
                  {initiativeName}
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
        <div className="px-6 py-4 space-y-5">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-full bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-c-success" />
              </div>
              <p className="text-lg font-medium text-c-text">
                Dodano do Roadmapy!
              </p>
              <p className="text-sm text-c-text-muted mt-1">
                Inicjatywa została zaplanowana
              </p>
            </div>
          ) : (
            <>
              {/* Quarter Selection */}
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2 flex items-center gap-2">
                  <Calendar size={16} className="text-c-accent" />
                  Docelowy kwartał <span className="text-danger-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {quarters.slice(0, 8).map((quarter) => (
                    <button
                      key={quarter.value}
                      onClick={() => !quarter.isPast && setSelectedQuarter(quarter.value)}
                      disabled={quarter.isPast}
                      className={`
                                                px-3 py-2 rounded-lg text-sm font-medium transition-all border-2
                                                ${
                                                  quarter.isPast
                                                    ? 'bg-c-surface-raised dark:bg-c-bg text-c-text-muted border-transparent cursor-not-allowed'
                                                    : selectedQuarter === quarter.value
                                                      ? 'bg-c-accent-soft text-c-accent dark:text-c-accent border-c-accent'
                                                      : 'bg-c-surface dark:bg-c-bg text-c-text-secondary border-c-border-subtle hover:border-c-accent dark:hover:border-c-accent'
                                                }
                                            `}
                    >
                      {quarter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Selection */}
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2 flex items-center gap-2">
                  <Flag size={16} className="text-c-warning" />
                  Priorytet
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPriority(opt.value)}
                      className={`
                                                px-3 py-2 rounded-lg text-xs font-medium transition-all border-2
                                                ${
                                                  priority === opt.value
                                                    ? `${opt.color} border-current`
                                                    : 'bg-c-surface dark:bg-c-bg text-c-text-secondary dark:text-c-text-muted border-c-border-subtle hover:border-c-border-subtle dark:hover:border-white/20'
                                                }
                                            `}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-2">
                  Notatki (opcjonalne)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Dodatkowe uwagi dotyczące planowania..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-c-border-subtle bg-c-surface dark:bg-c-bg text-c-text placeholder:text-c-text-muted dark:placeholder:text-c-text-muted resize-none text-sm focus:outline-none focus:ring-2 focus:ring-c-focus"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-danger-50 dark:bg-danger-500/10 text-danger-600 dark:text-danger-400 rounded-lg text-sm">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="px-6 py-4 border-t border-c-border-subtle bg-c-surface-raised dark:bg-c-bg">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-c-border-subtle text-c-text-secondary dark:text-c-text-muted rounded-lg font-medium hover:bg-c-surface-raised dark:hover:bg-white/5 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleTransfer}
                disabled={!selectedQuarter || submitting}
                className={`
                                    flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
                                    ${
                                      selectedQuarter && !submitting
                                        ? 'bg-c-text text-c-surface hover:opacity-90'
                                        : 'bg-c-surface-raised text-c-text-secondary dark:text-c-text-muted cursor-not-allowed'
                                    }
                                `}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Przenoszę...
                  </>
                ) : (
                  <>
                    <MapPin size={16} />
                    Dodaj do Roadmapy
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
