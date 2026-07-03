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

import { Archive, CheckCircle2, Loader2, Plus, ShieldAlert } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  FilterableTable,
  type FilterChip,
  type TableColumn,
  type TableRow,
} from '@/components/shared/ModuleHub';
import { type RowAction } from '@/components/shared/RowActionsMenu';
import Button from '@/components/ui/primitives/Button';

import {
  approveDocumentStudioTemplate,
  deprecateDocumentStudioTemplate,
  listDocumentStudioTemplates,
  planDocumentStudioTemplate,
} from './api';
import type { DocumentTemplate, DocumentTypeKey, TemplateDraftInput } from './types';

const DOCUMENT_TYPE_OPTIONS: { value: DocumentTypeKey; label: string }[] = [
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

interface DocumentStudioTemplateArchitectViewProps {
  onTemplateApproved?: (template: DocumentTemplate) => void;
}

export const DocumentStudioTemplateArchitectView: React.FC<
  DocumentStudioTemplateArchitectViewProps
> = ({ onTemplateApproved }) => {
  const { t } = useTranslation();
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
    () => templates.find((t) => t.templateId === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  // L-08 — canonical §27 table. Columns map to FilterableTable's conventions:
  // the `status` column auto-renders <EntityStatusChip>, and approve/deprecate
  // live in the per-row actions menu via `getRowActions`.
  const tableColumns = useMemo<TableColumn[]>(
    () => [
      { id: 'name', label: 'Template', width: '260px' },
      { id: 'documentType', label: 'Type' },
      { id: 'meta', label: 'Sections', align: 'right', width: '120px' },
      {
        id: 'status',
        label: 'Status',
        width: '140px',
        filterable: true,
        filterOptions: [
          { value: 'draft', label: 'Draft' },
          { value: 'approved', label: 'Approved' },
          { value: 'deprecated', label: 'Deprecated' },
        ],
      },
    ],
    []
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
    const template = templates.find((t) => t.templateId === row.id);
    if (!template) return [];
    const isBusy = busyTemplateId === template.templateId;
    const actions: RowAction[] = [];
    if (template.status === 'draft') {
      actions.push({
        id: 'approve',
        label: isBusy ? 'Approving…' : 'Approve',
        icon: CheckCircle2,
        variant: 'primary',
        onClick: () => void handleApprove(template.templateId),
      });
    }
    if (template.status !== 'deprecated') {
      actions.push({
        id: 'deprecate',
        label: isBusy ? 'Working…' : 'Deprecate',
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
      setError(err instanceof Error ? err.message : 'Failed to load templates');
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
      setError(err instanceof Error ? err.message : 'Failed to draft template');
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
      setError(err instanceof Error ? err.message : 'Failed to approve template');
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
      setError(err instanceof Error ? err.message : 'Failed to deprecate template');
    } finally {
      setBusyTemplateId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-6">
      <header>
        <h2 className="text-lg font-semibold text-navy-900 dark:text-white">
          Document Template Architect
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Design a reusable, governed Word/PDF template. Drafts must be approved before they can
          drive Mode 3 generation.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
        <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
          Draft a new template
        </h3>
        <form onSubmit={handleDraft} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Template name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(
                'documentStudio.templateArchitect.namePlaceholder',
                'e.g., Quarterly Board Memo template'
              )}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Document type</span>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentTypeKey)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-950"
            >
              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-1 flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Purpose <span className="text-danger-500">*</span>
            </span>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={3}
              placeholder="What kind of documents will this template produce, and for whom?"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-950"
              minLength={8}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Audience (comma-separated)
            </span>
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder={t(
                'documentStudio.templateArchitect.audiencePlaceholder',
                'e.g., Board, CEO, CFO'
              )}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'pl' | 'en')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-950"
            >
              <option value="pl">Polish</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="col-span-1 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950 sm:col-span-2">
            <input
              type="checkbox"
              checked={useLlm}
              onChange={(e) => setUseLlm(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-c-focus-solid focus:ring-c-focus"
            />
            <span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Refine with AI Template Architect (optional)
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Allows AI to rewrite section purposes and propose a refined template name. Falls
                back silently to the deterministic blueprint if AI is unavailable. New / removed /
                renamed sections are rejected.
              </span>
            </span>
          </label>
          <div className="col-span-1 flex items-center justify-between gap-3 sm:col-span-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {lastDraftRefined === true
                ? 'Last draft was refined by AI.'
                : lastDraftRefined === false
                  ? 'Last AI refinement returned no changes; deterministic draft used.'
                  : null}
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={drafting || purpose.trim().length < 8}
            >
              {drafting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Drafting…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Draft template
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

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy-900 dark:text-white">Template registry</h3>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void refresh()}
            disabled={loadingList}
          >
            {loadingList ? 'Refreshing…' : 'Refresh'}
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
          emptyMessage={loadingList ? 'Loading templates…' : 'No templates yet.'}
          canvasClassName="mt-3"
          density="compact"
          persistKey="documentStudio.templates"
        />

        {selectedTemplate ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-navy-700 dark:bg-navy-950">
            <div className="font-semibold text-navy-900 dark:text-white">
              Section blueprint — {selectedTemplate.name}
            </div>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700 dark:text-slate-300">
              {selectedTemplate.sectionBlueprint.map((section, idx) => (
                <li key={`${selectedTemplate.templateId}-section-${idx}`}>
                  <span className="font-medium">{section.title}</span>
                  {section.purpose ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {' '}
                      — {section.purpose}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default DocumentStudioTemplateArchitectView;
