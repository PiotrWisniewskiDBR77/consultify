import { FileText, Loader2, Sparkles, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

import { ReportTemplatePickerModal } from './ReportTemplatePickerModal';

type AssessmentOption = {
  id: string;
  name: string;
  type?: string;
  status?: string;
};

type ReportTemplate = {
  id: string;
  name: string;
  description?: string | null;
  reportType?: string | null;
  isDefault?: boolean;
};

export function NewAssessmentReportModal(props: {
  isOpen: boolean;
  assessments: AssessmentOption[];
  onClose: () => void;
  onCreated: (reportId: string) => void;
}) {
  const { isOpen, assessments, onClose, onCreated } = props;

  const [assessmentId, setAssessmentId] = useState<string>('');
  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedAssessment = useMemo(
    () => assessments.find((a) => a.id === assessmentId) || null,
    [assessments, assessmentId]
  );

  // Only approved assessments can have reports created from them (backend requirement)
  const approvedAssessments = useMemo(
    () => assessments.filter((a) => a.status?.toUpperCase() === 'APPROVED'),
    [assessments]
  );

  const canCreate = Boolean(assessmentId && template?.id && !busy);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-xl rounded-2xl overflow-hidden border border-c-border-subtle bg-c-surface shadow-2xl">
        <div className="px-6 py-4 border-b border-c-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-c-accent-soft text-c-accent dark:text-c-accent">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-semibold text-c-text">
                New assessment report
              </div>
              <div className="text-xs text-c-text-muted">
                Choose assessment + template. A draft will be generated.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="p-2 rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised text-c-text-muted"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-c-text-secondary mb-2">
              Assessment
            </label>
            <select
              value={assessmentId}
              onChange={(e) => setAssessmentId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-c-border-subtle bg-c-surface dark:bg-c-bg text-sm text-c-text"
              disabled={busy}
            >
              <option value="">
                {approvedAssessments.length === 0
                  ? 'No approved assessments available'
                  : 'Select assessment…'}
              </option>
              {approvedAssessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.type ? `(${String(a.type).toUpperCase()})` : ''}
                </option>
              ))}
            </select>
            {approvedAssessments.length === 0 && (
              <p className="mt-2 text-xs text-c-warning">
                Only approved assessments can be used to create reports. Approve an assessment
                first.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised dark:bg-c-bg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-c-text-secondary uppercase tracking-wider">
                  Template
                </div>
                <div className="mt-1 text-sm font-semibold text-c-text truncate">
                  {template?.name || 'Not selected'}
                </div>
                {template?.description ? (
                  <div className="mt-1 text-xs text-c-text-secondary line-clamp-2">
                    {template.description}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setTemplatePickerOpen(true)}
                disabled={busy}
                className="shrink-0 h-9 px-3 rounded-lg border border-c-border-subtle bg-c-surface text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised"
              >
                Choose
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => !busy && onClose()}
              className="h-10 px-4 rounded-lg border border-c-border-subtle text-sm font-semibold text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canCreate}
              onClick={async () => {
                if (!assessmentId || !template?.id) return;
                setBusy(true);
                const toastId = toast.loading('Creating report…');
                try {
                  const title = selectedAssessment?.name
                    ? `Report - ${selectedAssessment.name}`
                    : 'Report';
                  const created: any = await Api.post('/report-builder', {
                    sourceType: 'ASSESSMENT',
                    sourceId: assessmentId,
                    title,
                    description: '',
                    templateId: template.id,
                  });
                  const reportId = String(
                    created?.report?.id || created?.id || created?.reportId || ''
                  );
                  if (!reportId) throw new Error('Missing report id');

                  toast.loading('Generating report content with AI…', { id: toastId });
                  try {
                    await Api.post(`/report-builder/${reportId}/generate`, {
                      regenerateAll: false,
                    });
                  } catch (genErr: any) {
                    console.warn(
                      '[NewAssessmentReportModal] Generation error (non-fatal):',
                      genErr
                    );
                  }

                  toast.success('Report generated — opening editor', { id: toastId });
                  onCreated(reportId);
                  onClose();
                } catch (e: any) {
                  toast.error(e?.error || e?.message || 'Failed to create report', { id: toastId });
                } finally {
                  setBusy(false);
                }
              }}
              className="h-10 px-4 rounded-lg bg-c-accent hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Create draft
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <ReportTemplatePickerModal
        isOpen={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={(tpl) => {
          setTemplate(tpl as any);
          setTemplatePickerOpen(false);
        }}
        sourceType="ASSESSMENT"
        framework={selectedAssessment?.type || null}
        lockFramework={true}
      />
    </div>
  );
}

export default NewAssessmentReportModal;
