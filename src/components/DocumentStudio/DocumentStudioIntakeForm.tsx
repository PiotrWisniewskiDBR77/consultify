/**
 * Consultify Document Studio — Intake Form (Mode 1 & Mode 3).
 *
 * - Mode 1 = "generate without template": user describes the desired document
 *   and the backend planner infers a structure.
 * - Mode 3 = "generate from approved template": user picks an approved
 *   template; outline + formatting are hydrated server-side.
 */

import { Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import Button from '@/components/ui/primitives/Button';

import type {
  DocumentDensity,
  DocumentGoal,
  DocumentIntake,
  DocumentTemplate,
  DocumentTypeKey,
} from './types';

const DOCUMENT_TYPE_OPTIONS: { value: DocumentTypeKey | ''; label: string }[] = [
  { value: '', label: 'Auto-detect from description' },
  { value: 'executive_memo', label: 'Executive Memo' },
  { value: 'project_status_report', label: 'Project Status Report' },
  { value: 'steering_committee_report', label: 'Steering Committee Report' },
  { value: 'ai_audit_report', label: 'AI Audit Report' },
  { value: 'interview_summary_report', label: 'Interview Summary Report' },
  { value: 'workshop_summary', label: 'Workshop Summary' },
  { value: 'business_case', label: 'Business Case' },
  { value: 'risk_register_report', label: 'Risk Register Report' },
  { value: 'sop_document', label: 'SOP Document' },
  { value: 'implementation_plan', label: 'Implementation Plan' },
  { value: 'board_report', label: 'Board Report' },
  { value: 'sales_proposal', label: 'Sales Proposal' },
  { value: 'client_final_report', label: 'Client Final Report' },
  { value: 'generic_document', label: 'Generic document' },
];

const DENSITY_OPTIONS: { value: DocumentDensity; label: string }[] = [
  { value: 'concise', label: 'Concise (1–3 pages)' },
  { value: 'standard', label: 'Standard (4–8 pages)' },
  { value: 'detailed', label: 'Detailed (8–15 pages)' },
  { value: 'comprehensive', label: 'Comprehensive (15+ pages)' },
];

const GOAL_OPTIONS: { value: DocumentGoal; label: string }[] = [
  { value: 'inform', label: 'Inform' },
  { value: 'decide', label: 'Drive decision' },
  { value: 'approve', label: 'Seek approval' },
  { value: 'recommend', label: 'Recommend' },
  { value: 'align', label: 'Align stakeholders' },
];

export interface IntakeSubmitOptions {
  useLlm: boolean;
  templateId?: string | null;
}

interface DocumentStudioIntakeFormProps {
  onSubmit: (intake: DocumentIntake, options: IntakeSubmitOptions) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
  /** Approved templates available for Mode 3. When provided, a template picker
   *  becomes available; selecting one switches the form into Mode 3. */
  approvedTemplates?: DocumentTemplate[];
  /** Non-blocking notice when the approved-template list could not be loaded.
   *  Mode 1 (free generation) stays fully available; the picker is just hidden. */
  templatesNotice?: string | null;
}

export const DocumentStudioIntakeForm: React.FC<DocumentStudioIntakeFormProps> = ({
  onSubmit,
  loading,
  error,
  approvedTemplates,
  templatesNotice,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState<DocumentTypeKey | ''>('');
  const [language, setLanguage] = useState<'pl' | 'en'>('pl');
  const [density, setDensity] = useState<DocumentDensity>('standard');
  const [goal, setGoal] = useState<DocumentGoal>('inform');
  const [audience, setAudience] = useState('');
  const [useLlm, setUseLlm] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const hasTemplates = Boolean(approvedTemplates && approvedTemplates.length > 0);
  const inTemplateMode = selectedTemplateId.length > 0;
  const selectedTemplate =
    approvedTemplates?.find((t) => t.templateId === selectedTemplateId) ?? null;

  // When the user picks a template, prefill metadata from it so the form
  // stays self-explanatory while the server still owns the canonical schema.
  useEffect(() => {
    if (!selectedTemplate) return;
    if (selectedTemplate.documentType) setDocumentType(selectedTemplate.documentType);
    if (selectedTemplate.language) setLanguage(selectedTemplate.language);
    if (selectedTemplate.density) setDensity(selectedTemplate.density);
    if (selectedTemplate.audience.length > 0) {
      setAudience(selectedTemplate.audience.join(', '));
    }
  }, [selectedTemplate]);

  const isValid = description.trim().length >= 10 && !loading;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!isValid) return;
    const audienceList = audience
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    const intake: DocumentIntake = {
      title: title.trim() || undefined,
      description: description.trim(),
      documentType: documentType || undefined,
      language,
      density,
      goal,
      audience: audienceList.length > 0 ? audienceList : undefined,
    };
    void onSubmit(intake, {
      // M18/L-04: Mode3 (template) now uses LLM to fill content — template provides
      // structure, LLM generates the actual text (same as Mode1). Previously hardcoded
      // to false which bypassed LLM entirely even when a template was selected.
      useLlm: inTemplateMode ? true : useLlm,
      templateId: inTemplateMode ? selectedTemplateId : null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-6"
    >
      <div>
        <h2 className="text-lg font-semibold text-navy-900 dark:text-white">
          {inTemplateMode ? 'Generate from approved template' : 'Generate without template'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {inTemplateMode
            ? 'Outline and formatting are hydrated from the selected template. The brief below provides the document body.'
            : 'Describe the document you need. Document Studio will plan an outline and a deterministic first draft. No hallucinated facts: missing inputs are flagged as assumptions.'}
        </p>
      </div>

      {templatesNotice ? (
        <div
          role="status"
          className="rounded-lg border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-400"
        >
          {templatesNotice}
        </div>
      ) : null}

      {hasTemplates ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            Use approved template (optional)
          </span>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-white"
          >
            <option value="">No template — Mode 1 (free generation)</option>
            {approvedTemplates?.map((t) => (
              <option key={t.templateId} value={t.templateId}>
                {t.name} · v{t.version} · {t.documentType.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          {selectedTemplate ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Mode 3 active. {selectedTemplate.sectionBlueprint.length} sections,{' '}
              {selectedTemplate.confidentiality.replace(/_/g, ' ')} confidentiality.
            </span>
          ) : null}
        </label>
      ) : null}

      {selectedTemplate && selectedTemplate.requiredInputs.length > 0 ? (
        <div className="rounded-lg border border-sky-300/50 bg-sky-50 px-3 py-2 text-sm dark:border-sky-400/30 dark:bg-sky-500/5">
          <div className="font-medium text-sky-900 dark:text-sky-200">
            This template requires the following sources before it can generate
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Add matching items to the source pack of this run (or attach them upstream); the backend
            rejects generation if any of these is missing.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {selectedTemplate.requiredInputs.map((requirement) => (
              <li
                key={requirement}
                className="flex items-start gap-2 text-slate-700 dark:text-slate-200"
              >
                <span
                  aria-hidden
                  className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-500"
                />
                <span>{requirement}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          Description <span className="text-danger-500">*</span>
        </span>
        <textarea
          data-testid="docstudio-intake-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="e.g., Prepare an interview summary report for the client board: scope, key findings, risks, recommendations."
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-white"
          required
          minLength={10}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">Title (optional)</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Auto-derived from description if empty"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-white"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Document type</span>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as DocumentTypeKey | '')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-white"
          >
            {DOCUMENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'pl' | 'en')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-white"
          >
            <option value="pl">Polish</option>
            <option value="en">English</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Density</span>
          <select
            value={density}
            onChange={(e) => setDensity(e.target.value as DocumentDensity)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-white"
          >
            {DENSITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Goal</span>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as DocumentGoal)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-white"
          >
            {GOAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          Audience (comma-separated)
        </span>
        <input
          type="text"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="e.g., CEO, CFO, Transformation Officer"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-white"
        />
      </label>

      {!inTemplateMode ? (
        <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900">
          <input
            type="checkbox"
            checked={useLlm}
            onChange={(e) => setUseLlm(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-c-focus-solid focus:ring-c-focus"
          />
          <span>
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Refine outline with AI (optional)
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Allows the planner to reorder sections and rewrite section purposes. Falls back
              silently to the deterministic outline if AI is unavailable. New or invented sections
              are rejected.
            </span>
          </span>
        </label>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-700 dark:text-danger-400"
        >
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={!isValid} data-testid="docstudio-generate-btn">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {inTemplateMode ? 'Generating…' : 'Planning…'}
            </span>
          ) : inTemplateMode ? (
            'Generate from template'
          ) : (
            'Plan document'
          )}
        </Button>
      </div>
    </form>
  );
};

export default DocumentStudioIntakeForm;
