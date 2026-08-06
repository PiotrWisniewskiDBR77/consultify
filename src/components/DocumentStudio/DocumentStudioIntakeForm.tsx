/**
 * Consultify Document Studio — Intake Form (Mode 1 & Mode 3).
 *
 * - Mode 1 = "generate without template": user describes the desired document
 *   and the backend planner infers a structure.
 * - Mode 3 = "generate from approved template": user picks an approved
 *   template; outline + formatting are hydrated server-side.
 */

import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/primitives/Button';
import { useAppStore } from '@/store/useAppStore';

import type {
  DocumentDensity,
  DocumentGoal,
  DocumentIntake,
  DocumentSourceRef,
  DocumentTemplate,
  DocumentTypeKey,
} from './types';

// Option labels stay in English here as defaults; they are translated at render
// time via t(labelKey, label). Keys are shared with the Template Architect view.
const DOCUMENT_TYPE_OPTIONS: { value: DocumentTypeKey | ''; labelKey: string; label: string }[] = [
  {
    value: '',
    labelKey: 'documentStudio.docType.autoDetect',
    label: 'Auto-detect from description',
  },
  {
    value: 'executive_memo',
    labelKey: 'documentStudio.docType.executiveMemo',
    label: 'Executive Memo',
  },
  {
    value: 'project_status_report',
    labelKey: 'documentStudio.docType.projectStatusReport',
    label: 'Project Status Report',
  },
  {
    value: 'steering_committee_report',
    labelKey: 'documentStudio.docType.steeringCommitteeReport',
    label: 'Steering Committee Report',
  },
  {
    value: 'ai_audit_report',
    labelKey: 'documentStudio.docType.aiAuditReport',
    label: 'AI Audit Report',
  },
  {
    value: 'interview_summary_report',
    labelKey: 'documentStudio.docType.interviewSummaryReport',
    label: 'Interview Summary Report',
  },
  {
    value: 'workshop_summary',
    labelKey: 'documentStudio.docType.workshopSummary',
    label: 'Workshop Summary',
  },
  {
    value: 'business_case',
    labelKey: 'documentStudio.docType.businessCase',
    label: 'Business Case',
  },
  {
    value: 'risk_register_report',
    labelKey: 'documentStudio.docType.riskRegisterReport',
    label: 'Risk Register Report',
  },
  { value: 'sop_document', labelKey: 'documentStudio.docType.sopDocument', label: 'SOP Document' },
  {
    value: 'implementation_plan',
    labelKey: 'documentStudio.docType.implementationPlan',
    label: 'Implementation Plan',
  },
  { value: 'board_report', labelKey: 'documentStudio.docType.boardReport', label: 'Board Report' },
  {
    value: 'sales_proposal',
    labelKey: 'documentStudio.docType.salesProposal',
    label: 'Sales Proposal',
  },
  {
    value: 'client_final_report',
    labelKey: 'documentStudio.docType.clientFinalReport',
    label: 'Client Final Report',
  },
  {
    value: 'generic_document',
    labelKey: 'documentStudio.docType.genericDocument',
    label: 'Generic document',
  },
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
  templateVersion?: string | null;
  sourceRefs?: DocumentSourceRef[];
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
  /** Kanoniczne id szablonu wybranego POZA tym formularzem (Biblioteka wzorców →
   *  „Użyj wzorca" → `/document-studio?entry=template&templateId=…`). Gdy trafi na
   *  zatwierdzony szablon, formularz startuje od razu w Mode 3 z tym wzorcem.
   *  Brak / nietrafione id = zachowanie jak dotąd (ręczny wybór). */
  initialTemplateId?: string | null;
  /** D1 tri-tryby: gdy true i są szablony — po wejściu ustaw fokus na pickerze
   *  szablonów (użytkownik wybrał „Z szablonu"). Domyślnie false = bez zmiany. */
  autoFocusTemplatePicker?: boolean;
  /** D1 tri-tryby: gdy podane — renderuje link „← Wybór trybu" nad formularzem
   *  (powrót do ekranu wyboru 3 trybów). Domyślnie brak = bez linku. */
  onBackToModes?: () => void;
}

export const DocumentStudioIntakeForm: React.FC<DocumentStudioIntakeFormProps> = ({
  onSubmit,
  loading,
  error,
  approvedTemplates,
  templatesNotice,
  initialTemplateId = null,
  autoFocusTemplatePicker = false,
  onBackToModes,
}) => {
  const { t } = useTranslation();
  // P0 URODZINOWE (2026-07-27) — pokazuje, jaki kontekst organizacji zostanie
  // automatycznie dołączony do generacji (server/src/services/documentStudio/
  // documentOrgContextSourcePack.ts). Czysto informacyjne — kontekst jest
  // budowany i wstrzykiwany PO STRONIE SERWERA na podstawie zalogowanej
  // organizacji; formularz nic tu nie wysyła, tylko informuje.
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const templatePickerRef = useRef<HTMLSelectElement | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState<DocumentTypeKey | ''>('');
  const [language, setLanguage] = useState<'pl' | 'en'>('pl');
  const [density, setDensity] = useState<DocumentDensity>('standard');
  const [goal, setGoal] = useState<DocumentGoal>('inform');
  const [audience, setAudience] = useState('');
  // Domyślnie ON (audyt 2026-07-22): useLlm bramkuje CAŁĄ generację treści
  // (documentStudioService generateBlockProse), nie tylko kolejność sekcji — z
  // OFF dokument powstawał jako pusty szkielet („This section is awaiting content").
  const [useLlm, setUseLlm] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [requiredSources, setRequiredSources] = useState<
    Record<string, { kind: 'text' | 'url' | 'attachment'; value: string }>
  >({});

  const preselectApplied = useRef(false);

  const hasTemplates = Boolean(approvedTemplates && approvedTemplates.length > 0);

  // Preselekcja z URL (?templateId=): stosowana RAZ, dopiero gdy lista
  // zatwierdzonych szablonów zawiera ten rekord. Gdy nie zawiera — nic nie
  // ustawiamy (widok pokazuje notkę zamiast udawać, że wybór zadziałał).
  useEffect(() => {
    if (preselectApplied.current) return;
    const wanted = (initialTemplateId || '').trim();
    if (!wanted) return;
    if (!approvedTemplates || approvedTemplates.length === 0) return;
    if (!approvedTemplates.some((tpl) => tpl.templateId === wanted)) return;
    preselectApplied.current = true;
    setSelectedTemplateId(wanted);
  }, [initialTemplateId, approvedTemplates]);

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

  useEffect(() => {
    setRequiredSources({});
  }, [selectedTemplateId]);

  // D1 tri-tryby: gdy wejście przez „Z szablonu" i picker jest dostępny —
  // ustaw na nim fokus, żeby wybór trybu miał widoczny skutek.
  useEffect(() => {
    if (autoFocusTemplatePicker && hasTemplates) {
      templatePickerRef.current?.focus();
    }
  }, [autoFocusTemplatePicker, hasTemplates]);

  const requiredSourcesComplete =
    !selectedTemplate ||
    selectedTemplate.requiredInputs.every(
      (requirement) => requiredSources[requirement]?.value.trim().length > 0
    );
  const isValid = description.trim().length >= 10 && requiredSourcesComplete && !loading;

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
      templateVersion: inTemplateMode ? selectedTemplate?.version : null,
      sourceRefs: inTemplateMode
        ? selectedTemplate?.requiredInputs.map((requirement) => {
            const source = requiredSources[requirement];
            return {
              sourceType: source.kind,
              sourceId:
                source.kind === 'url'
                  ? source.value.trim()
                  : `${source.kind}:${requirement}:${source.value.trim()}`,
              // Exact requirement label is intentional: the backend preflight
              // matches the declared dependency against this explicit binding.
              sourceTitle: requirement,
            };
          })
        : undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-6"
    >
      {onBackToModes ? (
        <button
          type="button"
          onClick={onBackToModes}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-c-text-secondary transition-colors hover:text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <ArrowLeft size={14} aria-hidden />
          {t('documentStudio.intake.backToModes', 'Wybór trybu')}
        </button>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold text-c-text">
          {inTemplateMode
            ? t('documentStudio.intake.titleTemplateMode', 'Generate from approved template')
            : t('documentStudio.intake.titleFreeMode', 'Generate without template')}
        </h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          {inTemplateMode
            ? t(
                'documentStudio.intake.subtitleTemplateMode',
                'Outline and formatting are hydrated from the selected template. The brief below provides the document body.'
              )
            : t(
                'documentStudio.intake.subtitleFreeMode',
                'Describe the document you need. Document Studio will plan an outline and a deterministic first draft. No hallucinated facts: missing inputs are flagged as assumptions.'
              )}
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
          <span className="font-medium text-c-text">
            {t('documentStudio.intake.useTemplateLabel', 'Use approved template (optional)')}
          </span>
          <select
            ref={templatePickerRef}
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            <option value="">
              {t(
                'documentStudio.intake.noTemplateOption',
                'No template — Mode 1 (free generation)'
              )}
            </option>
            {approvedTemplates?.map((t) => (
              <option key={t.templateId} value={t.templateId}>
                {t.name} · v{t.version} · {t.documentType.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          {selectedTemplate ? (
            <span className="text-xs text-c-text-secondary">
              {t('documentStudio.intake.templateModeSummary', {
                defaultValue:
                  'Mode 3 active. {{sections}} sections, {{confidentiality}} confidentiality.',
                sections: selectedTemplate.sectionBlueprint.length,
                confidentiality: selectedTemplate.confidentiality.replace(/_/g, ' '),
              })}
            </span>
          ) : null}
        </label>
      ) : null}

      {selectedTemplate && selectedTemplate.requiredInputs.length > 0 ? (
        <div className="rounded-lg border border-sky-300/50 bg-sky-50 px-3 py-2 text-sm dark:border-sky-400/30 dark:bg-sky-500/5">
          <div className="font-medium text-sky-900 dark:text-sky-200">
            {t(
              'documentStudio.intake.requiredSourcesTitle',
              'This template requires the following sources before it can generate'
            )}
          </div>
          <p className="mt-1 text-xs text-c-text-secondary">
            {t(
              'documentStudio.intake.requiredSourcesHint',
              'Add matching items to the source pack of this run (or attach them upstream); the backend rejects generation if any of these is missing.'
            )}
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {selectedTemplate.requiredInputs.map((requirement) => (
              <li key={requirement} className="grid gap-1 rounded-md py-1 text-c-text">
                <label className="font-medium" htmlFor={`required-source-${requirement}`}>
                  {requirement}
                </label>
                <div className="grid grid-cols-[8rem_1fr] gap-2">
                  <select
                    aria-label={`${requirement} source type`}
                    value={requiredSources[requirement]?.kind ?? 'text'}
                    onChange={(event) =>
                      setRequiredSources((current) => ({
                        ...current,
                        [requirement]: {
                          kind: event.target.value as 'text' | 'url' | 'attachment',
                          value: '',
                        },
                      }))
                    }
                    className="rounded-md border border-sky-300 bg-c-surface px-2 py-1"
                  >
                    <option value="text">{t('documentStudio.intake.sourceText', 'Text')}</option>
                    <option value="url">{t('documentStudio.intake.sourceUrl', 'URL')}</option>
                    <option value="attachment">
                      {t('documentStudio.intake.sourceAttachment', 'Attachment ID')}
                    </option>
                  </select>
                  <input
                    id={`required-source-${requirement}`}
                    type={requiredSources[requirement]?.kind === 'url' ? 'url' : 'text'}
                    value={requiredSources[requirement]?.value ?? ''}
                    onChange={(event) =>
                      setRequiredSources((current) => ({
                        ...current,
                        [requirement]: {
                          kind: current[requirement]?.kind ?? 'text',
                          value: event.target.value,
                        },
                      }))
                    }
                    placeholder={t(
                      'documentStudio.intake.requiredSourcePlaceholder',
                      'Paste content, URL, or an existing attachment ID'
                    )}
                    className="rounded-md border border-sky-300 bg-c-surface px-2 py-1"
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {currentOrganization?.name ? (
        <div
          data-testid="docstudio-intake-context-chip"
          className="flex items-center gap-1.5 self-start rounded-full border border-slate-200/60 bg-c-surface-raised px-3 py-1 text-xs text-c-text-secondary dark:border-white/[0.06]"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {t('documentStudio.intake.contextChip', {
              defaultValue: 'Context: {{organizationName}}',
              organizationName: currentOrganization.name,
            })}
          </span>
        </div>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-c-text">
          {t('documentStudio.intake.descriptionLabel', 'Description')}{' '}
          <span className="text-danger-500">*</span>
        </span>
        <textarea
          data-testid="docstudio-intake-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder={t(
            'documentStudio.intake.descriptionPlaceholder',
            'e.g., Prepare an interview summary report for the client board: scope, key findings, risks, recommendations.'
          )}
          className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
          required
          minLength={10}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-c-text">
          {t('documentStudio.intake.titleLabel', 'Title (optional)')}
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t(
            'documentStudio.intake.titlePlaceholder',
            'Auto-derived from description if empty'
          )}
          className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-c-text">
            {t('documentStudio.intake.documentTypeLabel', 'Document type')}
          </span>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as DocumentTypeKey | '')}
            className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            {DOCUMENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey, opt.label)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-c-text">
            {t('documentStudio.intake.languageLabel', 'Language')}
          </span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'pl' | 'en')}
            className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            <option value="pl">{t('documentStudio.intake.languagePolish', 'Polish')}</option>
            <option value="en">{t('documentStudio.intake.languageEnglish', 'English')}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-c-text">
            {t('documentStudio.intake.densityLabel', 'Density')}
          </span>
          <select
            value={density}
            onChange={(e) => setDensity(e.target.value as DocumentDensity)}
            className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            {DENSITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(`documentStudio.density.${opt.value}`, opt.label)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-c-text">
            {t('documentStudio.intake.goalLabel', 'Goal')}
          </span>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as DocumentGoal)}
            className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            {GOAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(`documentStudio.goal.${opt.value}`, opt.label)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-c-text">
          {t('documentStudio.intake.audienceLabel', 'Audience (comma-separated)')}
        </span>
        <input
          type="text"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder={t(
            'documentStudio.intakeForm.audiencePlaceholder',
            'e.g., CEO, CFO, Transformation Officer'
          )}
          className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
        />
      </label>

      {!inTemplateMode ? (
        <label className="flex items-start gap-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={useLlm}
            onChange={(e) => setUseLlm(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-c-border-subtle text-c-focus-solid focus:ring-c-focus"
          />
          <span>
            <span className="font-medium text-c-text">
              {t(
                'documentStudio.intake.useLlmLabel',
                'Generate section content with AI (recommended)'
              )}
            </span>
            <span className="block text-xs text-c-text-secondary">
              {t(
                'documentStudio.intake.useLlmHint',
                'With this on, AI writes the prose for each section (and may adjust section order/purpose). Turn it off only for an empty outline scaffold with section headings and no content. Falls back to the deterministic outline if AI is unavailable.'
              )}
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
        <Button
          type="submit"
          variant="primary"
          disabled={!isValid}
          data-testid="docstudio-generate-btn"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {inTemplateMode
                ? t('documentStudio.intake.generating', 'Generating…')
                : t('documentStudio.intake.planning', 'Planning…')}
            </span>
          ) : inTemplateMode ? (
            t('documentStudio.intake.submitTemplate', 'Generate from template')
          ) : (
            t('documentStudio.intake.submitPlan', 'Plan document')
          )}
        </Button>
      </div>
    </form>
  );
};

export default DocumentStudioIntakeForm;
