import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, X } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import {
  ConclusionsApi,
  type ArtifactConversion,
  type Conclusion,
} from '@/services/api/conclusions.api';

interface ArtifactConversionModalProps {
  isOpen: boolean;
  conclusion: Conclusion | null;
  onClose: () => void;
  onConverted?: (conversion: ArtifactConversion) => void;
}

export const ArtifactConversionModal: React.FC<ArtifactConversionModalProps> = ({
  isOpen,
  conclusion,
  onClose,
  onConverted,
}) => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conversion, setConversion] = useState<ArtifactConversion | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  if (!isOpen || !conclusion) return null;

  const handlePropose = async () => {
    setIsSubmitting(true);
    setWarning(null);
    try {
      const res = await ConclusionsApi.proposeInitiativeConversion(conclusion.id);
      setConversion(res.conversion);
      setWarning(res.warning || res.conversion.errorMessage || null);
      if (res.warning || res.conversion.conversionStatus === 'failed') {
        toast.error(res.warning || res.conversion.errorMessage || 'Conversion requires attention');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to propose conversion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecute = async () => {
    if (!conversion) return;
    setIsSubmitting(true);
    try {
      const res = await ConclusionsApi.executeConversion(conversion.id);
      toast.success('Initiative intake created');
      onConverted?.(res.conversion);
      onClose();
      if (res.initiative?.id) {
        navigate('/initiatives');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create initiative');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canExecute = conversion && conversion.conversionStatus === 'proposed' && !warning;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 px-4">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200/70 dark:border-navy-700/70 bg-white dark:bg-navy-950 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200/70 dark:border-navy-800">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Convert to...
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
              Initiative intake
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Create a traceable initiative draft from this conclusion.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-900"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-0">
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-2xl border border-slate-200/70 dark:border-navy-800 bg-slate-50 dark:bg-navy-900/50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Source</div>
              <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {conclusion.title}
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {conclusion.statement}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 p-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Confidence
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {conclusion.confidenceLevel}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 p-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Evidence
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {conclusion.evidenceRefs.length}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 p-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Status
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {conclusion.status}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200/70 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 text-amber-600 dark:text-amber-300" size={16} />
                <div>
                  <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Limits travel with the initiative
                  </div>
                  <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                    {conclusion.limits || 'No limits were provided for this conclusion.'}
                  </p>
                </div>
              </div>
            </div>

            {conversion && (
              <div className="rounded-2xl border border-slate-200/70 dark:border-navy-800 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {conversion.conversionStatus === 'failed' ? (
                    <AlertTriangle size={16} className="text-amber-500" />
                  ) : (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  )}
                  Conversion proposal: {conversion.conversionStatus}
                </div>
                {warning && <p className="mt-2 text-sm text-amber-600">{warning}</p>}
              </div>
            )}
          </div>

          <div className="border-t lg:border-t-0 lg:border-l border-slate-200/70 dark:border-navy-800 bg-slate-50 dark:bg-navy-900/50 px-5 py-5">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Target</div>
            <div className="mt-3 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200/70 dark:border-navy-800 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Initiative
                </span>
                <ArrowRight size={16} className="text-slate-400" />
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Creates a draft/intake initiative with source lineage.
              </p>
            </div>

            <div className="mt-5 space-y-2">
              {!conversion && (
                <button
                  type="button"
                  onClick={handlePropose}
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  Prepare proposal
                </button>
              )}
              {conversion && (
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={!canExecute || isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  Create initiative intake
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
