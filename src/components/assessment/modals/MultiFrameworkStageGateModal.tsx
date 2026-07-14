/**
 * MultiFrameworkStageGateModal
 *
 * Stage-gate modal for multi-framework assessments.
 * Handles submission, review, and approval workflows with framework-specific validation.
 */

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileCheck,
  Info,
  Loader2,
  Send,
  Shield,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { AssessmentFramework, useMultiFrameworkStore } from '../../../store/useMultiFrameworkStore';

// ============================================
// TYPES
// ============================================

interface ValidationCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message?: string;
}

interface Reviewer {
  id: string;
  name: string;
  email: string;
  role: string;
  canApprove: boolean;
}

interface MultiFrameworkStageGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentId: string;
  framework: AssessmentFramework;
  currentStatus: string;
  targetStatus: 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
  onSuccess?: () => void;
}

// ============================================
// FRAMEWORK-SPECIFIC REQUIREMENTS
// ============================================

const FRAMEWORK_REQUIREMENTS: Record<
  AssessmentFramework,
  {
    minCompleteness: number;
    requiresReviewer: boolean;
    requiredRole?: string;
    requiredRoleLabel?: string;
    additionalChecks: string[];
  }
> = {
  DRD: {
    minCompleteness: 0.8,
    requiresReviewer: true,
    additionalChecks: ['All axes must have justification'],
  },
  SIRI: {
    minCompleteness: 0.9,
    requiresReviewer: true,
    additionalChecks: ['All 8 dimensions must be assessed', 'Legal disclaimer must be accepted'],
  },
  ADMA: {
    minCompleteness: 0.9,
    requiresReviewer: true,
    additionalChecks: ['All 5 pillars must be assessed', 'Legal disclaimer must be accepted'],
  },
  CMMI: {
    minCompleteness: 0.95,
    requiresReviewer: true,
    requiredRole: 'CMMI_LEAD_APPRAISER',
    requiredRoleLabel: 'CMMI Lead Appraiser',
    additionalChecks: [
      'All practice areas must be assessed',
      'Legal disclaimer must be accepted',
      'Approval requires certified Lead Appraiser',
    ],
  },
  LEAN: {
    minCompleteness: 0.7,
    requiresReviewer: true,
    additionalChecks: [
      'At least one process must be documented',
      'At least one workstation must be assessed',
    ],
  },
};

// ============================================
// COMPONENT
// ============================================

export const MultiFrameworkStageGateModal: React.FC<MultiFrameworkStageGateModalProps> = ({
  isOpen,
  onClose,
  assessmentId,
  framework,
  currentStatus,
  targetStatus,
  onSuccess,
}) => {
  const [validationChecks, setValidationChecks] = useState<ValidationCheck[]>([]);
  const [availableReviewers, setAvailableReviewers] = useState<Reviewer[]>([]);
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const store = useMultiFrameworkStore();
  const requirements = FRAMEWORK_REQUIREMENTS[framework];

  // Validate on mount
  useEffect(() => {
    if (isOpen) {
      validateAssessment();
      loadReviewers();
    }
  }, [isOpen, assessmentId, framework]);

  // Validate assessment completeness and requirements
  const validateAssessment = async () => {
    setIsValidating(true);
    const checks: ValidationCheck[] = [];

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/mf-assessments/${assessmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const assessment = await response.json();

      // Check completeness
      const completeness = calculateCompleteness(assessment.data, framework);
      checks.push({
        id: 'completeness',
        label: `Assessment completeness (${Math.round(completeness * 100)}%)`,
        passed: completeness >= requirements.minCompleteness,
        severity: completeness >= requirements.minCompleteness ? 'info' : 'error',
        message:
          completeness < requirements.minCompleteness
            ? `Minimum ${Math.round(requirements.minCompleteness * 100)}% required`
            : undefined,
      });

      // Check legal disclaimer for educational frameworks
      if (['SIRI', 'ADMA', 'CMMI'].includes(framework)) {
        const disclaimerAccepted = assessment.data?.legalDisclaimerAccepted === true;
        checks.push({
          id: 'legal_disclaimer',
          label: 'Legal disclaimer accepted',
          passed: disclaimerAccepted,
          severity: disclaimerAccepted ? 'info' : 'error',
          message: !disclaimerAccepted
            ? 'Legal disclaimer must be accepted before submission'
            : undefined,
        });
      }

      // Framework-specific checks
      if (framework === 'SIRI') {
        const dimensions = assessment.data?.dimensions || {};
        const assessedDimensions = Object.values(dimensions).filter(
          (v: any) => v != null && v > 0
        ).length;
        checks.push({
          id: 'dimensions_complete',
          label: `Dimensions assessed (${assessedDimensions}/8)`,
          passed: assessedDimensions >= 8,
          severity: assessedDimensions >= 8 ? 'info' : 'warning',
        });
      }

      if (framework === 'CMMI') {
        const practiceAreas = assessment.data?.practiceAreas || {};
        const assessedPAs = Object.values(practiceAreas).filter(
          (v: any) => v != null && v > 0
        ).length;
        checks.push({
          id: 'practice_areas_complete',
          label: `Practice areas assessed (${assessedPAs}/20)`,
          passed: assessedPAs >= 18,
          severity: assessedPAs >= 18 ? 'info' : 'warning',
        });
      }

      if (framework === 'LEAN') {
        const processes = assessment.data?.processes || [];
        const workstations = assessment.data?.workstations || [];
        checks.push({
          id: 'processes_documented',
          label: `Processes documented (${processes.length})`,
          passed: processes.length > 0,
          severity: processes.length > 0 ? 'info' : 'error',
        });
        checks.push({
          id: 'workstations_assessed',
          label: `Workstations assessed (${workstations.length})`,
          passed: workstations.length > 0,
          severity: workstations.length > 0 ? 'info' : 'error',
        });
      }

      // Check for required role if approving
      if (targetStatus === 'APPROVED' && requirements.requiredRole) {
        checks.push({
          id: 'required_role',
          label: requirements.requiredRoleLabel || 'Required approver role',
          passed: true, // Will be validated server-side
          severity: 'warning',
          message: `This approval requires a ${requirements.requiredRoleLabel}`,
        });
      }
    } catch (err: any) {
      setError(err.message);
    }

    setValidationChecks(checks);
    setIsValidating(false);
  };

  // Calculate completeness based on framework
  const calculateCompleteness = (data: any, fw: AssessmentFramework): number => {
    if (!data) return 0;

    switch (fw) {
      case 'SIRI': {
        const dimensions = data.dimensions || {};
        const total = 8;
        const filled = Object.values(dimensions).filter((v: any) => v != null && v > 0).length;
        return filled / total;
      }
      case 'ADMA': {
        const dimensions = data.dimensions || {};
        const total = 17; // ADMA has 17 dimensions
        const filled = Object.values(dimensions).filter((v: any) => v != null && v > 0).length;
        return filled / total;
      }
      case 'CMMI': {
        const practiceAreas = data.practiceAreas || {};
        const total = 20;
        const filled = Object.values(practiceAreas).filter((v: any) => v != null && v > 0).length;
        return filled / total;
      }
      case 'LEAN': {
        let score = 0;
        const total = 3;
        if ((data.processes || []).length > 0) score++;
        if ((data.workstations || []).length > 0) score++;
        if (data.managementPractices && Object.keys(data.managementPractices).length > 0) score++;
        return score / total;
      }
      default:
        return 0.5;
    }
  };

  // Load available reviewers
  const loadReviewers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/framework-rbac/approvers/${framework}?organizationId=${store.activeMetadata?.organizationId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setAvailableReviewers(data.approvers || []);
      }
    } catch (err) {
      console.warn('Failed to load reviewers:', err);
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');

      let endpoint = '';
      const body: any = { comment };

      if (targetStatus === 'IN_REVIEW') {
        endpoint = `/api/assessment-workflow/${assessmentId}/submit-for-review?framework=${framework}`;
        body.reviewerIds = selectedReviewers;
      } else if (targetStatus === 'APPROVED') {
        endpoint = `/api/assessment-workflow/${assessmentId}/approve?framework=${framework}`;
      } else if (targetStatus === 'REJECTED') {
        endpoint = `/api/assessment-workflow/${assessmentId}/reject?framework=${framework}`;
        body.reason = comment;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update status');
      }

      // Update store
      store.setMetadata({ status: targetStatus as any });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if can proceed
  const canProceed =
    validationChecks.filter((c) => c.severity === 'error' && !c.passed).length === 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-c-surface-raised rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-c-border-subtle">
          <div className="flex items-center gap-3">
            <div
              className={`
                            w-10 h-10 rounded-lg flex items-center justify-center
                            ${
                              targetStatus === 'IN_REVIEW'
                                ? 'bg-[color-mix(in_srgb,var(--c-info)_15%,transparent)] text-c-info'
                                : targetStatus === 'APPROVED'
                                  ? 'bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] text-c-success'
                                  : 'bg-danger-100 text-danger-600'
                            }
                        `}
            >
              {targetStatus === 'IN_REVIEW' ? (
                <Send className="w-5 h-5" />
              ) : targetStatus === 'APPROVED' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-c-text">
                {targetStatus === 'IN_REVIEW'
                  ? 'Submit for Review'
                  : targetStatus === 'APPROVED'
                    ? 'Approve Assessment'
                    : 'Reject Assessment'}
              </h2>
              <p className="text-sm text-c-text-muted">{framework} Assessment Stage Gate</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Validation Checks */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-c-text-secondary mb-3 flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              Validation Checks
            </h3>

            {isValidating ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-c-info" />
                <span className="ml-2 text-c-text-muted">Validating assessment...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {validationChecks.map((check) => (
                  <div
                    key={check.id}
                    className={`
                                            flex items-center justify-between p-3 rounded-lg
                                            ${
                                              check.passed
                                                ? 'bg-[color-mix(in_srgb,var(--c-success)_10%,transparent)]'
                                                : check.severity === 'error'
                                                  ? 'bg-danger-50 dark:bg-danger-900/20'
                                                  : 'bg-[color-mix(in_srgb,var(--c-warning)_10%,transparent)]'
                                            }
                                        `}
                  >
                    <div className="flex items-center gap-3">
                      {check.passed ? (
                        <CheckCircle2 className="w-5 h-5 text-c-success" />
                      ) : check.severity === 'error' ? (
                        <AlertCircle className="w-5 h-5 text-danger-500" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-c-warning" />
                      )}
                      <div>
                        <span
                          className={`
                                                    text-sm font-medium
                                                    ${
                                                      check.passed
                                                        ? 'text-c-success'
                                                        : check.severity === 'error'
                                                          ? 'text-danger-700 dark:text-danger-300'
                                                          : 'text-c-warning'
                                                    }
                                                `}
                        >
                          {check.label}
                        </span>
                        {check.message && (
                          <p className="text-xs text-c-text-muted mt-0.5">{check.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reviewer Selection (for submission) */}
          {targetStatus === 'IN_REVIEW' && requirements.requiresReviewer && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-c-text-secondary mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Select Reviewers
              </h3>

              {availableReviewers.length > 0 ? (
                <div className="space-y-2">
                  {availableReviewers.map((reviewer) => (
                    <label
                      key={reviewer.id}
                      className={`
                                                flex items-center justify-between p-3 rounded-lg border cursor-pointer
                                                ${
                                                  selectedReviewers.includes(reviewer.id)
                                                    ? 'border-c-info bg-[color-mix(in_srgb,var(--c-info)_10%,transparent)]'
                                                    : 'border-c-border-subtle hover:border-c-info'
                                                }
                                            `}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedReviewers.includes(reviewer.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedReviewers([...selectedReviewers, reviewer.id]);
                            } else {
                              setSelectedReviewers(
                                selectedReviewers.filter((id) => id !== reviewer.id)
                              );
                            }
                          }}
                          className="w-4 h-4 rounded border-c-border-subtle"
                        />
                        <div>
                          <div className="font-medium text-c-text">{reviewer.name}</div>
                          <div className="text-xs text-c-text-muted">{reviewer.email}</div>
                        </div>
                      </div>
                      {reviewer.canApprove && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-c-accent-soft text-c-accent rounded">
                          Can Approve
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-c-text-muted">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No reviewers available</p>
                </div>
              )}
            </div>
          )}

          {/* Required Role Warning */}
          {targetStatus === 'APPROVED' && requirements.requiredRole && (
            <div className="mb-6 p-4 bg-[color-mix(in_srgb,var(--c-warning)_10%,transparent)] rounded-lg border-l-2 border-c-warning">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-c-warning mt-0.5" />
                <div>
                  <p className="font-medium text-c-warning">Special Approval Required</p>
                  <p className="text-sm text-c-warning mt-1">
                    {framework} approval requires a certified {requirements.requiredRoleLabel}. Your
                    credentials will be verified.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Comment/Reason */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              {targetStatus === 'REJECTED' ? 'Rejection Reason' : 'Comment (optional)'}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                targetStatus === 'REJECTED'
                  ? 'Please provide a reason for rejection...'
                  : 'Add any additional notes...'
              }
              rows={3}
              className="w-full px-4 py-3 border border-c-border-subtle rounded-lg
                                bg-c-surface-raised text-c-text
                                focus:ring-2 focus:ring-c-focus focus:border-transparent"
              required={targetStatus === 'REJECTED'}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-4 bg-danger-50 dark:bg-danger-900/20 rounded-lg border border-danger-200 dark:border-danger-800">
              <div className="flex items-center gap-2 text-danger-700 dark:text-danger-300">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-c-border-subtle bg-c-surface-raised dark:bg-c-surface">
          <button
            onClick={onClose}
            className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={
              isLoading || isValidating || !canProceed || (targetStatus === 'REJECTED' && !comment)
            }
            className={`
                            px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors
                            ${
                              canProceed && !isLoading
                                ? targetStatus === 'REJECTED'
                                  ? 'bg-danger-600 hover:bg-danger-700 text-white'
                                  : 'bg-c-info hover:opacity-90 text-white'
                                : 'bg-c-border text-c-text-muted cursor-not-allowed'
                            }
                        `}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {targetStatus === 'IN_REVIEW' && 'Submit for Review'}
                {targetStatus === 'APPROVED' && 'Approve Assessment'}
                {targetStatus === 'REJECTED' && 'Reject Assessment'}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiFrameworkStageGateModal;
