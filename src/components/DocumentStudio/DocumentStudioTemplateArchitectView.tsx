/**
 * Consultify Document Studio — Template Architect view (MVP-2, Mode 2).
 *
 * Implements the AI Document Template Architect workflow:
 *   - Draft a new template from a brief.
 *   - Review the draft (section blueprint, formatting summary).
 *   - Approve or deprecate; approval gates Mode 3 usage.
 *
 * Governance contract is enforced server-side. This view is a thin client.
 */

import {
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ColorPatternPicker } from '@/components/shared/colorPatterns/ColorPatternPicker';
import { useBrandKitColors } from '@/components/shared/colorPatterns/useBrandKitColors';
import {
  FilterableTable,
  type FilterChip,
  type TableColumn,
  type TableRow,
} from '@/components/shared/ModuleHub';
import { type RowAction } from '@/components/shared/RowActionsMenu';
import Button from '@/components/ui/primitives/Button';
import { isTemplateStructureEditorEnabled } from '@/utils/templateEditorFlag';

import {
  approveDocumentStudioTemplate,
  deprecateDocumentStudioTemplate,
  listDocumentStudioTemplates,
  planDocumentStudioTemplate,
  reviseDocumentStudioTemplateStructure,
} from './api';
import { DocumentStructurePreview } from './DocumentStructurePreview';
import {
  insertSection,
  makeBlankSection,
  removeSection,
  reorderSection,
} from './templateStructureOps';
import type {
  DocumentTemplate,
  DocumentTypeKey,
  TemplateDraftInput,
  TemplateSectionBlueprint,
} from './types';

function useDocumentTypeOptions(
  t: (key: string, def: string) => string
): { value: DocumentTypeKey; label: string }[] {
  return useMemo(
    () => [
      {
        value: 'executive_memo',
        label: t('documentStudio.docType.executiveMemo', 'Executive Memo'),
      },
      {
        value: 'project_status_report',
        label: t('documentStudio.docType.projectStatusReport', 'Project Status Report'),
      },
      {
        value: 'steering_committee_report',
        label: t('documentStudio.docType.steeringCommitteeReport', 'Steering Committee Report'),
      },
      {
        value: 'ai_audit_report',
        label: t('documentStudio.docType.aiAuditReport', 'AI Audit Report'),
      },
      {
        value: 'interview_summary_report',
        label: t('documentStudio.docType.interviewSummaryReport', 'Interview Summary Report'),
      },
      {
        value: 'workshop_summary',
        label: t('documentStudio.docType.workshopSummary', 'Workshop Summary'),
      },
      { value: 'business_case', label: t('documentStudio.docType.businessCase', 'Business Case') },
      {
        value: 'risk_register_report',
        label: t('documentStudio.docType.riskRegisterReport', 'Risk Register Report'),
      },
      { value: 'sop_document', label: t('documentStudio.docType.sopDocument', 'SOP Document') },
      {
        value: 'implementation_plan',
        label: t('documentStudio.docType.implementationPlan', 'Implementation Plan'),
      },
      { value: 'board_report', label: t('documentStudio.docType.boardReport', 'Board Report') },
      {
        value: 'sales_proposal',
        label: t('documentStudio.docType.salesProposal', 'Sales Proposal'),
      },
      {
        value: 'client_final_report',
        label: t('documentStudio.docType.clientFinalReport', 'Client Final Report'),
      },
      {
        value: 'generic_document',
        label: t('documentStudio.docType.genericDocument', 'Generic document'),
      },
    ],
    [t]
  );
}

interface DocumentStudioTemplateArchitectViewProps {
  onTemplateApproved?: (template: DocumentTemplate) => void;
}

export const DocumentStudioTemplateArchitectView: React.FC<
  DocumentStudioTemplateArchitectViewProps
> = ({ onTemplateApproved }) => {
  const { t } = useTranslation();
  const documentTypeOptions = useDocumentTypeOptions(t);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);

  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [documentType, setDocumentType] = useState<DocumentTypeKey>('executive_memo');
  const [audience, setAudience] = useState('');
  const [language, setLanguage] = useState<'pl' | 'en'>('pl');
  const [useLlm, setUseLlm] = useState(false);
  const [lastDraftRefined, setLastDraftRefined] = useState<boolean | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((tpl) => tpl.templateId === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  // C1 — manual structure editor (behind flag `?ff_tpl_editor=1`, default ON
  // since 79a75de14e, akcept Piotra 2026-07-22 po live-verify; UWAGA: decyzja
  // architekta D6 z 2026-07-24 postuluje OFF — konflikt do rozstrzygnięcia
  // przez Piotra, nie zmieniaj defaultu bez jego słowa). When OFF the section
  // blueprint stays read-only and this whole surface is byte-identical to
  // pre-flag state. When ON, a DRAFT template's sections become editable
  // (add / remove / move / rename) before approval.
  const structureEditorEnabled = isTemplateStructureEditorEnabled();
  const isEditableDraft = structureEditorEnabled && selectedTemplate?.status === 'draft';
  const [editSections, setEditSections] = useState<TemplateSectionBlueprint[]>([]);
  const [savingStructure, setSavingStructure] = useState(false);
  // Fala 1 (2026-07-28) — "wzorzec kolorów" (N31): the same gallery the
  // Deck Template Architect now offers (`PresentationTemplateArchitectView`),
  // wired to Word templates for the first time. Independent of section
  // structure — saved together only because both are draft-only author
  // edits on this one screen; a template can carry colors, structure, or
  // both (see `ColorPatternPicker`).
  const [editColorTemplateId, setEditColorTemplateId] = useState('');
  const [editFormatting, setEditFormatting] = useState<DocumentTemplate['formattingSchema'] | null>(
    null
  );
  const [requiredInputsText, setRequiredInputsText] = useState('');
  const brandKitColors = useBrandKitColors();

  // Reset the working copy whenever the selected draft (or its saved revision)
  // changes. Keyed on templateId + updatedAt so a successful save re-syncs.
  useEffect(() => {
    setEditSections(
      selectedTemplate ? selectedTemplate.sectionBlueprint.map((s) => ({ ...s })) : []
    );
    setEditColorTemplateId(selectedTemplate?.formattingSchema?.colorTemplateId ?? '');
    setEditFormatting(
      selectedTemplate ? JSON.parse(JSON.stringify(selectedTemplate.formattingSchema)) : null
    );
    setRequiredInputsText((selectedTemplate?.requiredInputs ?? []).join('\n'));
  }, [selectedTemplate?.templateId, selectedTemplate?.updatedAt]);

  const structureDirty = useMemo(() => {
    if (!selectedTemplate) return false;
    return JSON.stringify(editSections) !== JSON.stringify(selectedTemplate.sectionBlueprint);
  }, [editSections, selectedTemplate]);

  const colorPatternDirty = useMemo(() => {
    if (!selectedTemplate) return false;
    return editColorTemplateId !== (selectedTemplate.formattingSchema?.colorTemplateId ?? '');
  }, [editColorTemplateId, selectedTemplate]);

  const hasUnsavedChanges = structureDirty || colorPatternDirty;
  const wordSettingsDirty = useMemo(() => {
    if (!selectedTemplate || !editFormatting) return false;
    return (
      JSON.stringify(editFormatting) !== JSON.stringify(selectedTemplate.formattingSchema) ||
      requiredInputsText !== selectedTemplate.requiredInputs.join('\n')
    );
  }, [editFormatting, requiredInputsText, selectedTemplate]);
  const hasAnyUnsavedChanges = hasUnsavedChanges || wordSettingsDirty;

  const hasBlankSectionTitle = useMemo(
    () => editSections.some((s) => s.title.trim().length === 0),
    [editSections]
  );

  const renameEditSection = (index: number, title: string): void => {
    setEditSections((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next[index] = { ...next[index], title };
      return next;
    });
  };

  const handleEditSectionHintsChange = (index: number, rawText: string): void => {
    const hints = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    setEditSections((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next[index] = { ...next[index], contentHints: hints.length > 0 ? hints : undefined };
      return next;
    });
  };

  // C1 briefing fields — mirrors handleEditSectionHintsChange: keep the
  // working copy raw while typing (server-side sanitizeAuthoredSection trims
  // and caps on save), only fold to `undefined` when the field is emptied so
  // the read-only view's "no guidance yet" branches stay correct.
  const handleEditSectionKeyMessageChange = (index: number, value: string): void => {
    setEditSections((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next[index] = { ...next[index], keyMessage: value.length > 0 ? value : undefined };
      return next;
    });
  };

  const handleEditSectionDataNeededChange = (index: number, rawText: string): void => {
    const items = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    setEditSections((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next[index] = { ...next[index], dataNeeded: items.length > 0 ? items : undefined };
      return next;
    });
  };

  const handleEditSectionEvidenceChange = (index: number, value: string): void => {
    setEditSections((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next[index] = { ...next[index], suggestedEvidence: value.length > 0 ? value : undefined };
      return next;
    });
  };

  const handleSaveStructure = async (): Promise<void> => {
    if (!selectedTemplate) return;
    setSavingStructure(true);
    setError(null);
    try {
      const normalized = editSections.map((s) => ({ ...s, title: s.title.trim() }));
      await reviseDocumentStudioTemplateStructure(
        selectedTemplate.templateId,
        normalized,
        colorPatternDirty ? editColorTemplateId || null : undefined,
        editFormatting
          ? {
              formattingSchema: editFormatting,
              requiredInputs: requiredInputsText
                .split('\n')
                .map((value) => value.trim())
                .filter(Boolean),
            }
          : undefined
      );
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.templateArchitect.errReviseStructure', 'Failed to save structure')
      );
    } finally {
      setSavingStructure(false);
    }
  };

  // L-08 — canonical §27 table. Columns map to FilterableTable's conventions:
  // the `status` column auto-renders <EntityStatusChip>, and approve/deprecate
  // live in the per-row actions menu via `getRowActions`.
  const tableColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'name',
        label: t('documentStudio.templateArchitect.colTemplate', 'Template'),
        width: '260px',
      },
      { id: 'documentType', label: t('documentStudio.templateArchitect.colType', 'Type') },
      {
        id: 'meta',
        label: t('documentStudio.templateArchitect.colSections', 'Sections'),
        align: 'right',
        width: '120px',
      },
      {
        id: 'status',
        label: t('documentStudio.templateArchitect.colStatus', 'Status'),
        width: '140px',
        filterable: true,
        filterOptions: [
          { value: 'draft', label: t('documentStudio.templateArchitect.statusDraft', 'Draft') },
          {
            value: 'approved',
            label: t('documentStudio.templateArchitect.statusApproved', 'Approved'),
          },
          {
            value: 'deprecated',
            label: t('documentStudio.templateArchitect.statusDeprecated', 'Deprecated'),
          },
        ],
      },
    ],
    [t]
  );

  const tableRows = useMemo<TableRow[]>(
    () =>
      templates.map((template) => ({
        id: template.templateId,
        name: template.name,
        documentType: template.documentType.replace(/_/g, ' '),
        meta: `v${template.version} · ${template.sectionBlueprint.length}`,
        status: template.status,
      })),
    [templates]
  );

  const getRowActions = (row: TableRow): RowAction[] => {
    const template = templates.find((tpl) => tpl.templateId === row.id);
    if (!template) return [];
    const isBusy = busyTemplateId === template.templateId;
    const actions: RowAction[] = [];
    if (template.status === 'draft') {
      actions.push({
        id: 'approve',
        label: isBusy
          ? t('documentStudio.templateArchitect.approving', 'Approving…')
          : t('documentStudio.templateArchitect.approve', 'Approve'),
        icon: CheckCircle2,
        variant: 'primary',
        onClick: () => void handleApprove(template.templateId),
      });
    }
    if (template.status !== 'deprecated') {
      actions.push({
        id: 'deprecate',
        label: isBusy
          ? t('documentStudio.templateArchitect.working', 'Working…')
          : t('documentStudio.templateArchitect.deprecate', 'Deprecate'),
        icon: Archive,
        variant: 'danger',
        divider: actions.length > 0,
        onClick: () => void handleDeprecate(template.templateId),
      });
    }
    return actions;
  };

  const refresh = async (): Promise<void> => {
    setLoadingList(true);
    setError(null);
    try {
      const list = await listDocumentStudioTemplates();
      setTemplates(list);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.templateArchitect.errLoadTemplates', 'Failed to load templates')
      );
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleDraft = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (purpose.trim().length < 8) return;
    setDrafting(true);
    setError(null);
    setLastDraftRefined(null);
    try {
      const input: TemplateDraftInput = {
        name: name.trim() || undefined,
        purpose: purpose.trim(),
        documentType,
        language,
        audience: audience
          .split(',')
          .map((a) => a.trim())
          .filter((a) => a.length > 0),
      };
      const result = await planDocumentStudioTemplate(input, { useLlm });
      setName('');
      setPurpose('');
      setAudience('');
      setSelectedTemplateId(result.template.templateId);
      setLastDraftRefined(useLlm ? result.llmRefined : null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.templateArchitect.errDraftTemplate', 'Failed to draft template')
      );
    } finally {
      setDrafting(false);
    }
  };

  const handleApprove = async (templateId: string): Promise<void> => {
    setBusyTemplateId(templateId);
    setError(null);
    try {
      const approved = await approveDocumentStudioTemplate(templateId);
      onTemplateApproved?.(approved);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.templateArchitect.errApproveTemplate', 'Failed to approve template')
      );
    } finally {
      setBusyTemplateId(null);
    }
  };

  const handleDeprecate = async (templateId: string): Promise<void> => {
    setBusyTemplateId(templateId);
    setError(null);
    try {
      await deprecateDocumentStudioTemplate(templateId);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'documentStudio.templateArchitect.errDeprecateTemplate',
              'Failed to deprecate template'
            )
      );
    } finally {
      setBusyTemplateId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-6">
      <header>
        <h2 className="text-lg font-semibold text-c-text">
          {t('documentStudio.templateArchitect.heading', 'Document Template Architect')}
        </h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t(
            'documentStudio.templateArchitect.subheading',
            'Design a reusable, governed Word/PDF template. Drafts must be approved before they can drive Mode 3 generation.'
          )}
        </p>
      </header>

      <section className="rounded-xl border border-c-border-subtle bg-c-surface p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-c-text">
          {t('documentStudio.templateArchitect.draftHeading', 'Draft a new template')}
        </h3>
        <form onSubmit={handleDraft} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-c-text">
              {t('documentStudio.templateArchitect.templateName', 'Template name')}
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(
                'documentStudio.templateArchitect.templateNamePlaceholder',
                'e.g., Quarterly Board Memo template'
              )}
              className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-c-text">
              {t('documentStudio.templateArchitect.documentType', 'Document type')}
            </span>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentTypeKey)}
              className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
            >
              {documentTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-1 flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-c-text">
              {t('documentStudio.templateArchitect.purpose', 'Purpose')}{' '}
              <span className="text-danger-500">*</span>
            </span>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={3}
              placeholder={t(
                'documentStudio.templateArchitect.purposePlaceholder',
                'What kind of documents will this template produce, and for whom?'
              )}
              className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
              minLength={8}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-c-text">
              {t('documentStudio.templateArchitect.audience', 'Audience (comma-separated)')}
            </span>
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder={t(
                'documentStudio.templateArchitect.audiencePlaceholder',
                'e.g., Board, CEO, CFO'
              )}
              className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-c-text">
              {t('documentStudio.templateArchitect.language', 'Language')}
            </span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'pl' | 'en')}
              className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
            >
              <option value="pl">
                {t('documentStudio.templateArchitect.langPolish', 'Polish')}
              </option>
              <option value="en">
                {t('documentStudio.templateArchitect.langEnglish', 'English')}
              </option>
            </select>
          </label>
          <label className="col-span-1 flex items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={useLlm}
              onChange={(e) => setUseLlm(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-c-border-subtle text-c-focus-solid focus:ring-c-focus"
            />
            <span>
              <span className="font-medium text-c-text">
                {t(
                  'documentStudio.templateArchitect.refineWithAi',
                  'Refine with AI Template Architect (optional)'
                )}
              </span>
              <span className="block text-xs text-c-text-secondary">
                {t(
                  'documentStudio.templateArchitect.refineWithAiHint',
                  'Allows AI to rewrite section purposes and propose a refined template name. Falls back silently to the deterministic blueprint if AI is unavailable. New / removed / renamed sections are rejected.'
                )}
              </span>
            </span>
          </label>
          <div className="col-span-1 flex items-center justify-between gap-3 sm:col-span-2">
            <div className="text-xs text-c-text-secondary">
              {lastDraftRefined === true
                ? t('documentStudio.templateArchitect.refinedByAi', 'Last draft was refined by AI.')
                : lastDraftRefined === false
                  ? t(
                      'documentStudio.templateArchitect.refinedNoChanges',
                      'Last AI refinement returned no changes; deterministic draft used.'
                    )
                  : null}
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={drafting || purpose.trim().length < 8}
            >
              {drafting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />{' '}
                  {t('documentStudio.templateArchitect.drafting', 'Drafting…')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />{' '}
                  {t('documentStudio.templateArchitect.draftTemplate', 'Draft template')}
                </span>
              )}
            </Button>
          </div>
        </form>
      </section>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-700 dark:text-danger-400"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="rounded-xl border border-c-border-subtle bg-c-surface p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-c-text">
            {t('documentStudio.templateArchitect.registryHeading', 'Template registry')}
          </h3>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void refresh()}
            disabled={loadingList}
          >
            {loadingList
              ? t('documentStudio.templateArchitect.refreshing', 'Refreshing…')
              : t('documentStudio.templateArchitect.refresh', 'Refresh')}
          </Button>
        </div>
        <FilterableTable
          columns={tableColumns}
          data={tableRows}
          selectedRowId={selectedTemplateId}
          onRowClick={(row) => setSelectedTemplateId(row.id)}
          getRowActions={getRowActions}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          emptyMessage={
            loadingList
              ? t('documentStudio.templateArchitect.loadingTemplates', 'Loading templates…')
              : t('documentStudio.templateArchitect.noTemplatesYet', 'No templates yet.')
          }
          canvasClassName="mt-3"
          density="compact"
          persistKey="documentStudio.templates"
        />

        {selectedTemplate ? (
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
            <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-3 text-sm">
              {isEditableDraft ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-c-text">
                      {t('documentStudio.templateArchitect.sectionBlueprint', 'Section blueprint')}{' '}
                      — {selectedTemplate.name}
                    </div>
                    {hasAnyUnsavedChanges ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setEditSections(
                              selectedTemplate.sectionBlueprint.map((s) => ({ ...s }))
                            );
                            setEditColorTemplateId(
                              selectedTemplate.formattingSchema?.colorTemplateId ?? ''
                            );
                            setEditFormatting(
                              JSON.parse(JSON.stringify(selectedTemplate.formattingSchema))
                            );
                            setRequiredInputsText(selectedTemplate.requiredInputs.join('\n'));
                          }}
                          disabled={savingStructure}
                        >
                          {t('documentStudio.templateArchitect.resetStructure', 'Reset')}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void handleSaveStructure()}
                          disabled={
                            savingStructure || hasBlankSectionTitle || editSections.length === 0
                          }
                        >
                          {savingStructure
                            ? t('documentStudio.templateArchitect.savingStructure', 'Saving…')
                            : t('documentStudio.templateArchitect.saveStructure', 'Save structure')}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                      {t('documentStudio.templateArchitect.colorPatternLabel', 'Wzorzec kolorów')}
                    </span>
                    <p className="mb-2 text-[11px] text-c-text-secondary">
                      {t(
                        'documentStudio.templateArchitect.colorPatternHint',
                        'Niezależny od struktury sekcji — możesz zapisać sam kolor, samą strukturę, albo oba naraz.'
                      )}
                    </p>
                    <ColorPatternPicker
                      value={editColorTemplateId}
                      onChange={setEditColorTemplateId}
                      brandKitColors={brandKitColors}
                      hideLabel
                    />
                  </div>
                  {editFormatting ? (
                    <fieldset className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-c-border-subtle p-3 sm:grid-cols-2">
                      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                        {t('documentStudio.templateArchitect.wordSettings', 'Word layout')}
                      </legend>
                      {(
                        [
                          ['coverPage', 'Cover page'],
                          ['toc', 'Table of contents'],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-sm text-c-text">
                          <input
                            type="checkbox"
                            checked={editFormatting[key]}
                            onChange={(event) =>
                              setEditFormatting((prev) =>
                                prev ? { ...prev, [key]: event.target.checked } : prev
                              )
                            }
                          />
                          {t(`documentStudio.templateArchitect.${key}`, label)}
                        </label>
                      ))}
                      <label className="flex items-center gap-2 text-sm text-c-text">
                        <input
                          type="checkbox"
                          checked={editFormatting.headers.enabled}
                          onChange={(event) =>
                            setEditFormatting((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    headers: { ...prev.headers, enabled: event.target.checked },
                                  }
                                : prev
                            )
                          }
                        />
                        {t('documentStudio.templateArchitect.header', 'Header')}
                      </label>
                      <label className="flex items-center gap-2 text-sm text-c-text">
                        <input
                          type="checkbox"
                          checked={editFormatting.footers.enabled}
                          onChange={(event) =>
                            setEditFormatting((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    footers: { ...prev.footers, enabled: event.target.checked },
                                  }
                                : prev
                            )
                          }
                        />
                        {t('documentStudio.templateArchitect.footer', 'Footer')}
                      </label>
                      <label className="flex items-center gap-2 text-sm text-c-text">
                        <input
                          type="checkbox"
                          checked={editFormatting.footers.pageNumbering}
                          onChange={(event) =>
                            setEditFormatting((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    footers: {
                                      ...prev.footers,
                                      pageNumbering: event.target.checked,
                                    },
                                  }
                                : prev
                            )
                          }
                        />
                        {t('documentStudio.templateArchitect.pageNumbering', 'Page numbering')}
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-c-text-secondary">
                        {t('documentStudio.templateArchitect.bodyFont', 'Body font/style')}
                        <input
                          value={editFormatting.fonts.body}
                          onChange={(event) =>
                            setEditFormatting((prev) =>
                              prev
                                ? { ...prev, fonts: { ...prev.fonts, body: event.target.value } }
                                : prev
                            )
                          }
                          className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-sm text-c-text"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-c-text-secondary sm:col-span-2">
                        {t(
                          'documentStudio.templateArchitect.requiredInputs',
                          'Required source inputs (one per line)'
                        )}
                        <textarea
                          value={requiredInputsText}
                          onChange={(event) => setRequiredInputsText(event.target.value)}
                          rows={3}
                          className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-sm text-c-text"
                        />
                      </label>
                    </fieldset>
                  ) : null}
                  <ol className="mt-2 space-y-1">
                    {editSections.map((section, idx) => (
                      <li
                        key={`${selectedTemplate.templateId}-edit-section-${idx}`}
                        className="group flex flex-col gap-1 rounded-md px-1.5 py-1 hover:bg-c-surface focus-within:bg-c-surface"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-c-text-secondary">
                            {idx + 1}.
                          </span>
                          <input
                            type="text"
                            value={section.title}
                            onChange={(e) => renameEditSection(idx, e.target.value)}
                            aria-label={t(
                              'documentStudio.templateArchitect.sectionTitleLabel',
                              'Section title'
                            )}
                            placeholder={t(
                              'documentStudio.templateArchitect.sectionTitlePlaceholder',
                              'Section title'
                            )}
                            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-c-text hover:border-c-border-subtle focus:border-c-focus-solid focus:bg-c-surface focus:outline-none focus:ring-2 focus:ring-c-focus"
                          />
                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            <button
                              type="button"
                              onClick={() =>
                                setEditSections((prev) => reorderSection(prev, idx, 'up'))
                              }
                              disabled={idx === 0}
                              aria-label={t(
                                'documentStudio.templateArchitect.moveSectionUp',
                                'Move section up'
                              )}
                              className="rounded p-1 text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditSections((prev) => reorderSection(prev, idx, 'down'))
                              }
                              disabled={idx === editSections.length - 1}
                              aria-label={t(
                                'documentStudio.templateArchitect.moveSectionDown',
                                'Move section down'
                              )}
                              className="rounded p-1 text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditSections((prev) => removeSection(prev, idx))}
                              aria-label={t(
                                'documentStudio.templateArchitect.removeSection',
                                'Remove section'
                              )}
                              className="rounded p-1 text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="pl-7">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                            {t('documentStudio.templateArchitect.contentHints', 'Content guidance')}
                          </span>
                          <textarea
                            value={(section.contentHints ?? []).join('\n')}
                            onChange={(e) => handleEditSectionHintsChange(idx, e.target.value)}
                            rows={Math.max(2, (section.contentHints ?? []).length)}
                            placeholder={t(
                              'documentStudio.templateArchitect.contentHintsPlaceholder',
                              'One guidance phrase per line — what this section should cover (no invented facts). Use "Refine with AI" on a new draft to auto-suggest.'
                            )}
                            className="mt-0.5 w-full rounded-md border border-c-border-subtle bg-c-surface px-1.5 py-1 text-xs text-c-text-secondary focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
                          />
                        </div>
                        <div className="pl-7">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                            {t('documentStudio.templateArchitect.keyMessage', 'Key message')}
                          </span>
                          <input
                            type="text"
                            value={section.keyMessage ?? ''}
                            onChange={(e) => handleEditSectionKeyMessageChange(idx, e.target.value)}
                            aria-label={t(
                              'documentStudio.templateArchitect.keyMessage',
                              'Key message'
                            )}
                            placeholder={t(
                              'documentStudio.templateArchitect.keyMessagePlaceholder',
                              'The one-sentence thesis this section should argue (no invented conclusions).'
                            )}
                            className="mt-0.5 w-full rounded-md border border-c-border-subtle bg-c-surface px-1.5 py-1 text-xs text-c-text-secondary focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
                          />
                        </div>
                        <div className="pl-7">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                            {t('documentStudio.templateArchitect.dataNeeded', 'Data needed')}
                          </span>
                          <textarea
                            value={(section.dataNeeded ?? []).join('\n')}
                            onChange={(e) => handleEditSectionDataNeededChange(idx, e.target.value)}
                            rows={Math.max(2, (section.dataNeeded ?? []).length)}
                            aria-label={t(
                              'documentStudio.templateArchitect.dataNeeded',
                              'Data needed'
                            )}
                            placeholder={t(
                              'documentStudio.templateArchitect.dataNeededPlaceholder',
                              'One data/input label per line — what to collect before writing this section (no invented values).'
                            )}
                            className="mt-0.5 w-full rounded-md border border-c-border-subtle bg-c-surface px-1.5 py-1 text-xs text-c-text-secondary focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
                          />
                        </div>
                        <div className="pl-7">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                            {t(
                              'documentStudio.templateArchitect.suggestedEvidence',
                              'Suggested evidence'
                            )}
                          </span>
                          <input
                            type="text"
                            value={section.suggestedEvidence ?? ''}
                            onChange={(e) => handleEditSectionEvidenceChange(idx, e.target.value)}
                            aria-label={t(
                              'documentStudio.templateArchitect.suggestedEvidence',
                              'Suggested evidence'
                            )}
                            placeholder={t(
                              'documentStudio.templateArchitect.suggestedEvidencePlaceholder',
                              'The category of proof that should back this section (a source type, not a specific fabricated citation).'
                            )}
                            className="mt-0.5 w-full rounded-md border border-c-border-subtle bg-c-surface px-1.5 py-1 text-xs text-c-text-secondary focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
                          />
                        </div>
                      </li>
                    ))}
                  </ol>
                  <button
                    type="button"
                    onClick={() =>
                      setEditSections((prev) => insertSection(prev, undefined, makeBlankSection()))
                    }
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-c-text-secondary hover:bg-c-surface hover:text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('documentStudio.templateArchitect.addSection', 'Add section')}
                  </button>
                  {hasBlankSectionTitle ? (
                    <p className="mt-1 text-xs text-c-text-secondary">
                      {t(
                        'documentStudio.templateArchitect.blankTitleHint',
                        'Every section needs a title before you can save.'
                      )}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="font-semibold text-c-text">
                    {t('documentStudio.templateArchitect.sectionBlueprint', 'Section blueprint')} —{' '}
                    {selectedTemplate.name}
                  </div>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-c-text">
                    {selectedTemplate.sectionBlueprint.map((section, idx) => (
                      <li key={`${selectedTemplate.templateId}-section-${idx}`}>
                        <span className="font-medium">{section.title}</span>
                        {section.purpose ? (
                          <span className="text-xs text-c-text-secondary">
                            {' '}
                            — {section.purpose}
                          </span>
                        ) : null}
                        {section.contentHints && section.contentHints.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {section.contentHints.map((hint, hintIdx) => (
                              <span
                                key={`${selectedTemplate.templateId}-section-${idx}-hint-${hintIdx}`}
                                className="rounded-full border border-c-border-subtle bg-c-surface px-2.5 py-0.5 text-[11px] text-c-text-secondary"
                              >
                                {hint}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {section.keyMessage ? (
                          <div className="mt-1 text-[11px] text-c-text-secondary">
                            <span className="font-medium uppercase tracking-wide text-c-text-muted">
                              {t('documentStudio.templateArchitect.keyMessage', 'Key message')}:
                            </span>{' '}
                            <span className="italic">{section.keyMessage}</span>
                          </div>
                        ) : null}
                        {section.dataNeeded && section.dataNeeded.length > 0 ? (
                          <div className="mt-1 text-[11px] text-c-text-secondary">
                            <span className="font-medium uppercase tracking-wide text-c-text-muted">
                              {t('documentStudio.templateArchitect.dataNeeded', 'Data needed')}:
                            </span>{' '}
                            <div className="mt-0.5 flex flex-wrap gap-1.5">
                              {section.dataNeeded.map((item, itemIdx) => (
                                <span
                                  key={`${selectedTemplate.templateId}-section-${idx}-data-${itemIdx}`}
                                  className="rounded-full border border-c-border-subtle bg-c-surface px-2.5 py-0.5 text-[11px] text-c-text-secondary"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {section.suggestedEvidence ? (
                          <div className="mt-1 text-[11px] text-c-text-secondary">
                            <span className="font-medium uppercase tracking-wide text-c-text-muted">
                              {t(
                                'documentStudio.templateArchitect.suggestedEvidence',
                                'Suggested evidence'
                              )}
                              :
                            </span>{' '}
                            {section.suggestedEvidence}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
            <div className="lg:sticky lg:top-0">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                {t('documentStudio.templateArchitect.structurePreviewHeading', 'Structure preview')}
              </div>
              <DocumentStructurePreview
                sections={isEditableDraft ? editSections : selectedTemplate.sectionBlueprint}
              />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default DocumentStudioTemplateArchitectView;
