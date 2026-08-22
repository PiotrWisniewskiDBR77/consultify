/**
 * NewAssessmentModal
 * Modal component for creating new assessments with framework selection and name input
 */

import { Activity, AlertCircle, Cpu, Database, Layers, Loader2, Workflow, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  createSession as createMethodCoreSession,
  getSession as getMethodCoreSession,
  newIdempotencyKey,
} from '@/method-core/api/methodCoreApi';
import {
  DRD_METHOD_PACK_ID,
  DRD_METHOD_PACK_VERSION,
} from '@/method-core/methods/drd/compileDrdPack';
import { Api } from '@/services/api';
import { isFrameworkComingSoon } from '@/services/frameworkRegistry';
import { useAppStore } from '@/store/useAppStore';

// Types
export type AssessmentFramework = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

export interface NewAssessmentData {
  id: string;
  name: string;
  assessmentType: AssessmentFramework;
  status: string;
}

interface NewAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (assessment: NewAssessmentData) => void;
}

// Framework metadata. `comingSoon` is NOT hardcoded here — it is derived from
// the framework registry (src/services/frameworkRegistry.ts) so this picker can
// never drift from / lie about what is actually startable (decision D-B).
type FrameworkCardMeta = {
  value: AssessmentFramework;
  name: string;
  shortName: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  border: string;
  textColor: string;
  comingSoon?: boolean;
};

const FRAMEWORKS: FrameworkCardMeta[] = (
  [
    {
      value: 'DRD',
      name: 'Digital Readiness Diagnosis',
      shortName: 'DRD',
      description:
        'Comprehensive digital maturity diagnosis across 7 transformation axes (39 areas)',
      icon: <Activity size={20} />,
      gradient: 'from-primary-500/20 to-primary-600/10',
      border: 'border-primary-500/30 hover:border-primary-500/60',
      textColor: 'text-primary-400',
    },
    {
      value: 'SIRI',
      name: 'Smart Industry Readiness Index',
      shortName: 'SIRI',
      description:
        'Industry 4.0 readiness framework focusing on process, technology and organization',
      icon: <Cpu size={20} />,
      gradient: 'from-blue-500/20 to-blue-600/10',
      border: 'border-blue-500/30 hover:border-blue-500/60',
      textColor: 'text-blue-400',
    },
    {
      value: 'ADMA',
      name: 'Advanced Digital Maturity Assessment',
      shortName: 'ADMA',
      description: 'Advanced assessment model for digital transformation capabilities',
      icon: <Database size={20} />,
      gradient: 'from-blue-500/20 to-blue-600/10',
      border: 'border-blue-500/30 hover:border-blue-500/60',
      textColor: 'text-blue-400',
    },
    {
      value: 'CMMI',
      name: 'Capability Maturity Model Integration',
      shortName: 'CMMI',
      description: 'Process improvement framework for software and product development',
      icon: <Layers size={20} />,
      gradient: 'from-amber-500/20 to-amber-600/10',
      border: 'border-amber-500/30 hover:border-amber-500/60',
      textColor: 'text-amber-400',
    },
    {
      value: 'LEAN',
      name: 'Lean 4.0',
      shortName: 'LEAN',
      description: 'Lean manufacturing principles integrated with Industry 4.0 technologies',
      icon: <Workflow size={20} />,
      gradient: 'from-green-500/20 to-green-600/10',
      border: 'border-green-500/30 hover:border-green-500/60',
      textColor: 'text-green-400',
    },
  ] as FrameworkCardMeta[]
).map((f) => ({ ...f, comingSoon: isFrameworkComingSoon(f.value) }));

export const NewAssessmentModal: React.FC<NewAssessmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { currentProjectId } = useAppStore();
  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const drdIdempotencyKeyRef = useRef<string | null>(null);

  // Form state
  const [selectedFramework, setSelectedFramework] = useState<AssessmentFramework | null>(null);
  const [assessmentName, setAssessmentName] = useState('');
  const [assessmentDescription, setAssessmentDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step state (1: select framework, 2: enter details)
  const [step, setStep] = useState<1 | 2>(1);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedFramework(null);
      setAssessmentName('');
      setAssessmentDescription('');
      setError(null);
      drdIdempotencyKeyRef.current = null;
      setStep(1);
    }
  }, [isOpen]);

  // Focus name input when entering step 2
  useEffect(() => {
    if (step === 2 && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [step]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle framework selection
  const handleFrameworkSelect = useCallback(
    (framework: AssessmentFramework) => {
      // Honest gate (decision D-B): coming-soon frameworks (CMMI/LEAN) never start
      // a session, even if the disabled card is bypassed.
      if (isFrameworkComingSoon(framework)) {
        toast(t('assessment.newModal.comingSoonToast', 'This framework is coming soon.'), {
          icon: '🔜',
        });
        return;
      }
      setSelectedFramework(framework);
      // Auto-generate a default name
      const frameworkData = FRAMEWORKS.find((f) => f.value === framework);
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      setAssessmentName(`${frameworkData?.shortName || framework} Assessment - ${dateStr}`);
      setStep(2);
    },
    [t]
  );

  // Handle back to framework selection
  const handleBack = useCallback(() => {
    setStep(1);
    setError(null);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!selectedFramework) {
        setError('Please select a framework');
        return;
      }

      // Honest gate (decision D-B): never create a session for a coming-soon
      // framework, even if selection state was set out-of-band.
      if (isFrameworkComingSoon(selectedFramework)) {
        setError(
          t(
            'assessment.newModal.comingSoonError',
            'This framework is coming soon and cannot be started yet.'
          )
        );
        return;
      }

      if (selectedFramework !== 'DRD' && !assessmentName.trim()) {
        setError('Please enter an assessment name');
        return;
      }

      if (selectedFramework !== 'DRD' && assessmentName.trim().length > 200) {
        setError('Assessment name must be 200 characters or less');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const response =
          selectedFramework === 'DRD'
            ? await (async () => {
                const created = await createMethodCoreSession(
                  {
                    module: 'assessment',
                    methodPackId: DRD_METHOD_PACK_ID,
                    methodPackVersion: DRD_METHOD_PACK_VERSION,
                    mode: 'guided_manual',
                    projectId: currentProjectId || null,
                  },
                  drdIdempotencyKeyRef.current ||
                    (drdIdempotencyKeyRef.current = newIdempotencyKey())
                );
                const readback = await getMethodCoreSession(created.session.id);
                if (
                  readback.session.id !== created.session.id ||
                  readback.session.module !== 'assessment' ||
                  readback.session.methodPackId !== DRD_METHOD_PACK_ID ||
                  readback.session.methodPackVersion !== DRD_METHOD_PACK_VERSION
                ) {
                  throw new Error('Canonical DRD session readback mismatch');
                }
                drdIdempotencyKeyRef.current = null;
                return { id: readback.session.id, status: readback.session.state };
              })()
            : await Api.createAssessmentSession({
                assessmentType: selectedFramework,
                name: assessmentName.trim(),
                description: assessmentDescription.trim() || undefined,
                projectId: currentProjectId || null,
              });

        toast.success('Assessment created successfully');

        onSuccess?.({
          id: response.id,
          name:
            selectedFramework === 'DRD'
              ? `DRD · ${response.id.slice(0, 8)}`
              : assessmentName.trim(),
          assessmentType: selectedFramework,
          status: response.status || 'DRAFT',
        });

        onClose();
      } catch (err: any) {
        const message = err?.message || 'Failed to create assessment';
        setError(message);
        toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedFramework, assessmentName, currentProjectId, onSuccess, onClose, t]
  );

  // Get selected framework data
  const selectedFrameworkData = FRAMEWORKS.find((f) => f.value === selectedFramework);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl"
        role="dialog"
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-c-border-subtle">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold text-c-text">
              {step === 1 ? 'Select Framework' : 'New Assessment'}
            </h2>
            <p className="text-sm text-c-text-secondary mt-0.5">
              {step === 1
                ? 'Choose an assessment framework to get started'
                : `Creating ${selectedFrameworkData?.shortName} assessment`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {step === 1 ? (
            /* Step 1: Framework Selection */
            <div className="grid grid-cols-1 gap-3">
              {FRAMEWORKS.map((framework) => (
                <button
                  key={framework.value}
                  onClick={
                    framework.comingSoon ? undefined : () => handleFrameworkSelect(framework.value)
                  }
                  disabled={framework.comingSoon}
                  className={`
                    flex items-start gap-4 w-full p-4 rounded-xl text-left
                    bg-gradient-to-br ${framework.gradient}
                    border ${framework.border}
                    transition-all duration-200
                    ${
                      framework.comingSoon
                        ? 'opacity-60 cursor-not-allowed'
                        : 'hover:shadow-lg hover:-translate-y-0.5'
                    }
                  `}
                >
                  <div
                    className={`
                      flex-shrink-0 p-2.5 rounded-lg
                      bg-c-surface-raised ${framework.textColor}
                    `}
                  >
                    {framework.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-sm font-bold ${framework.textColor}`}>
                        {framework.shortName}
                      </span>
                      <span className="text-c-text font-medium">{framework.name}</span>
                      {framework.comingSoon && (
                        <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-c-surface-raised text-c-text-secondary border border-slate-500/30">
                          {t('assessment.newModal.comingSoonBadge', 'Coming soon')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-c-text-secondary mt-1 line-clamp-2">
                      {framework.description}
                    </p>
                  </div>
                  <svg
                    className="flex-shrink-0 w-5 h-5 text-c-text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              ))}
            </div>
          ) : (
            /* Step 2: Assessment Details Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Selected Framework Display */}
              {selectedFrameworkData && (
                <div
                  className={`
                    flex items-center gap-3 p-3 rounded-lg
                    bg-gradient-to-br ${selectedFrameworkData.gradient}
                    border ${selectedFrameworkData.border.replace('hover:', '')}
                  `}
                >
                  <div
                    className={`p-2 rounded-lg bg-c-surface-raised ${selectedFrameworkData.textColor}`}
                  >
                    {selectedFrameworkData.icon}
                  </div>
                  <div>
                    <div
                      className={`font-mono text-sm font-bold ${selectedFrameworkData.textColor}`}
                    >
                      {selectedFrameworkData.shortName}
                    </div>
                    <div className="text-sm text-c-text-secondary">
                      {selectedFrameworkData.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="ml-auto text-sm text-c-text-secondary hover:text-c-text transition-colors"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Method Core has no persisted display-metadata contract yet.
                  Do not collect fields that would disappear on cold read. */}
              {selectedFramework !== 'DRD' && (
                <div>
                  <label
                    htmlFor="assessment-name"
                    className="block text-sm font-medium text-c-text-secondary mb-2"
                  >
                    Assessment Name
                  </label>
                  <input
                    ref={nameInputRef}
                    id="assessment-name"
                    type="text"
                    value={assessmentName}
                    onChange={(e) => setAssessmentName(e.target.value)}
                    placeholder="Enter assessment name..."
                    maxLength={200}
                    className="
                    w-full h-11 px-4 bg-c-surface-raised border border-c-border-subtle rounded-lg
                    text-c-text placeholder-c-text-muted
                    focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/25
                    transition-colors
                  "
                  />
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs text-c-text-muted">
                      Give your assessment a descriptive name
                    </span>
                    <span
                      className={`text-xs ${assessmentName.length > 180 ? 'text-amber-400' : 'text-c-text-muted'}`}
                    >
                      {assessmentName.length}/200
                    </span>
                  </div>
                </div>
              )}

              {/* Assessment Description Input */}
              {selectedFramework !== 'DRD' && (
                <div>
                  <label
                    htmlFor="assessment-description"
                    className="block text-sm font-medium text-c-text-secondary mb-2"
                  >
                    Description <span className="text-c-text-muted">(optional)</span>
                  </label>
                  <textarea
                    id="assessment-description"
                    value={assessmentDescription}
                    onChange={(e) => setAssessmentDescription(e.target.value)}
                    placeholder="Describe the scope and objectives of this assessment..."
                    maxLength={1000}
                    rows={3}
                    className="
                    w-full px-4 py-3 bg-c-surface-raised border border-c-border-subtle rounded-lg
                    text-c-text placeholder-c-text-muted resize-none
                    focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/25
                    transition-colors
                  "
                  />
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs text-c-text-muted">
                      Optional context for this assessment
                    </span>
                    <span
                      className={`text-xs ${assessmentDescription.length > 900 ? 'text-amber-400' : 'text-c-text-muted'}`}
                    >
                      {assessmentDescription.length}/1000
                    </span>
                  </div>
                </div>
              )}

              {selectedFramework === 'DRD' && (
                <p className="text-sm text-c-text-secondary">
                  The canonical session label will be assigned from its Method Core identifier.
                </p>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-danger-500/10 border border-danger-500/30 rounded-lg">
                  <AlertCircle size={16} className="text-danger-400 flex-shrink-0" />
                  <span className="text-sm text-danger-400">{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="
                    px-4 py-2.5 rounded-lg text-sm font-medium
                    text-c-text-secondary hover:text-c-text
                    border border-c-border-subtle hover:bg-c-surface-raised
                    transition-colors
                  "
                  disabled={isSubmitting}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="
                    flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
                    bg-gradient-to-r from-primary-500 to-primary-600
                    text-white
                    hover:from-primary-400 hover:to-primary-500
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all
                  "
                  disabled={isSubmitting || (selectedFramework !== 'DRD' && !assessmentName.trim())}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Creating...
                    </>
                  ) : selectedFramework === 'DRD' ? (
                    'Start DRD session'
                  ) : (
                    'Create Assessment'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer - Step 1 only */}
        {step === 1 && (
          <div className="px-6 py-4 border-t border-c-border-subtle bg-c-surface-raised">
            <button
              onClick={onClose}
              className="w-full py-2.5 text-sm text-c-text-secondary hover:text-c-text transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewAssessmentModal;
