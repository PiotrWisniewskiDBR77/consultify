/**
 * Consultify Document Studio — Document Panel (FE-E1/FE-E2).
 *
 * Renders the generated DocumentSchema in the shared ExecutiveModuleShell:
 * left outline, central document canvas, right rail panels for Sources,
 * Properties, QA, and AI Editor.
 */

import type { TFunction } from 'i18next';
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  Download,
  FileText,
  FileWarning,
  History,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  Table2,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  ExecutiveModuleShell,
  type RightRailToolDescriptor,
  type TopBarChipDescriptor,
} from '@/components/shared/ExecutiveModuleShell';
import Button from '@/components/ui/primitives/Button';
import {
  fetchExecutionModuleManifest,
  validateExecutionModuleManifest,
} from '@/services/executionModuleStandard/api';
import type { ExecutionModuleValidationResult } from '@/services/executionModuleStandard/types';
import {
  buildMyWorkSheetTableOpenPath,
  resolveTablePlatformWorkspaceIdForTable,
} from '@/utils/sheetArtifactOpen';

import {
  cancelDocumentStudioApproval,
  createDocumentStudioShareLink,
  exportDocumentStudioArtifact,
  getDocumentStudioAccessHistory,
  getDocumentStudioCommentCounts,
  getDocumentStudioPolicy,
  getDocumentStudioSchemaDiff,
  getDocumentStudioVariant,
  insertDocumentStudioContentBlock,
  instantiateDocumentStudioContentBlock,
  listDocumentStudioApprovals,
  listDocumentStudioContentBlocks,
  listDocumentStudioShareLinks,
  listDocumentStudioSnapshots,
  listDocumentStudioVariants,
  QaBlockingError,
  QaOverrideUnauthorizedError,
  recordDocumentStudioApprovalDecision,
  requestDocumentStudioApproval,
} from './api';
import { DocumentCommentsPanel } from './DocumentCommentsPanel';
import { DocumentExportSuccessNote } from './DocumentExportSuccessNote';
import { DocumentSchemaDiffView } from './DocumentSchemaDiffView';
import { DocumentStudioQaPanel } from './DocumentStudioQaPanel';
import { DocumentTipTapEditor } from './editor';
import type {
  DocumentAccessHistoryEntry,
  DocumentApprovalDecisionKind,
  DocumentApprovalQuorumPolicy,
  DocumentApprovalRequest,
  DocumentBlock,
  DocumentCommentSectionCounts,
  DocumentContentBlockTemplate,
  DocumentGenerationWarning,
  DocumentQaReport,
  DocumentSchema,
  DocumentSchemaDiffResponse,
  DocumentSection,
  DocumentShareLink,
  DocumentShareLinkAccessScope,
  DocumentSourceRef,
  DocumentStudioPolicy,
  DocumentVariantSummary,
  DocumentVersionSnapshotSummary,
} from './types';

interface DocumentStudioDocumentPanelProps {
  artifactId: string;
  schema: DocumentSchema;
  /**
   * A4 — generation-time warnings recorded when the pipeline degraded via
   * a silent fallback (LLM prose failure, chart rasterization fallback,
   * cover-logo unavailable). Rendered as a discreet, dismissible-by-
   * expand "generated with limitations" chip. Defaults to none.
   */
  generationWarnings?: DocumentGenerationWarning[];
  onStartOver: () => void;
  onSchemaUpdated: (nextSchema: DocumentSchema) => void;
}

type TFn = TFunction;

/**
 * A4 — discreet "generated with limitations" chip. Collapsed by default to
 * a single amber (c-warning) pill showing the count; expands to a list of
 * the individual warnings. Zero crimson: uses only neutral `c-*` tokens +
 * the amber warning accent, matching the panel's existing inline banners.
 */
export const DocumentGenerationWarningsChip: React.FC<{
  warnings: DocumentGenerationWarning[];
  /**
   * B4 — override for the collapsed-summary i18n key so the chip can be
   * reused for export-time warnings ("Exported with limitations") without
   * duplicating the component. Defaults to the generation-time summary.
   */
  summaryKey?: string;
}> = ({ warnings, summaryKey = 'documentStudio.generationWarnings.summary' }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (warnings.length === 0) return null;

  const labelFor = (code: string): string => {
    // Per-code friendly label with a safe fallback to the raw code so an
    // unknown future code still renders something meaningful.
    const key = `documentStudio.generationWarnings.codes.${code}`;
    const translated = t(key);
    return translated === key ? code : translated;
  };

  return (
    <div
      className="rounded-md border border-c-warning/40 bg-c-warning/10 px-3 py-2 text-xs text-c-text"
      data-testid="document-generation-warnings-chip"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-1.5 font-medium text-c-text">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-c-warning" aria-hidden />
          {t(summaryKey, { count: warnings.length })}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-c-text-muted transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {expanded ? (
        <ul className="mt-2 space-y-1.5 border-t border-c-warning/20 pt-2 text-c-text-secondary">
          {warnings.map((w, i) => (
            <li key={`${w.code}-${i}`} className="flex flex-col gap-0.5">
              <span className="font-medium text-c-text">{labelFor(w.code)}</span>
              <span className="text-c-text-muted">{w.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

function renderSectionPreview(section: DocumentSection, idx: number): React.ReactNode {
  return (
    <section
      key={section.sectionId}
      id={section.sectionId}
      className="rounded-lg border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-900"
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-navy-900 dark:text-white">
          {idx + 1}. {section.title}
        </h3>
        {section.purpose ? <span className="text-xs text-slate-600">{section.purpose}</span> : null}
      </header>
      <div className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-300">
        {section.blocks.map((block) => {
          const isAssumption = Boolean(block.isAssumption);
          const blockClass = isAssumption
            ? 'rounded border border-amber-400/30 bg-amber-50 px-2 py-1 dark:border-amber-400/30 dark:bg-amber-500/10'
            : '';
          const content = (() => {
            if (block.type === 'heading') {
              const value = block.content as { text?: string };
              return (
                <div className="font-semibold text-navy-900 dark:text-white">{value.text}</div>
              );
            }
            if (block.type === 'paragraph') {
              const value = block.content as { text?: string };
              return <p>{value.text}</p>;
            }
            if (block.type === 'list') {
              const value = block.content as { style?: string; items?: string[] };
              const items = Array.isArray(value.items) ? value.items : [];
              if (value.style === 'numbered') {
                return (
                  <ol className="list-decimal pl-5">
                    {items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ol>
                );
              }
              return (
                <ul className="list-disc pl-5">
                  {items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              );
            }
            if (block.type === 'callout') {
              const value = block.content as { variant?: string; text?: string };
              return (
                <div className="rounded-md border border-c-border-subtle bg-c-surface-raised px-3 py-2 italic">
                  {value.text}
                </div>
              );
            }
            return (
              <pre className="whitespace-pre-wrap text-xs text-slate-500">
                {JSON.stringify(block.content, null, 2)}
              </pre>
            );
          })();
          return (
            <div key={block.blockId} className={blockClass}>
              {content}
              {isAssumption ? (
                <div className="mt-1 text-xs font-medium uppercase tracking-wide text-amber-600">
                  Assumption — needs source
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function metadataLabel(value: string | string[] | undefined, notSet: string): string {
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : notSet;
  return value && value.trim().length > 0 ? value : notSet;
}

function getConnectorState(
  sourceType: string,
  t: TFn
): {
  label: string;
  tone: 'success' | 'warning' | 'muted';
} {
  const normalized = sourceType.toLowerCase();
  if (['notion', 'drive', 'google_drive', 'sharepoint', 'confluence'].includes(normalized)) {
    return {
      label: t('documentStudio.panel.connectorDegraded', 'degraded: external connector gate'),
      tone: 'warning',
    };
  }
  if (['table', 'v8_artifact', 'file', 'url', 'raw_text', 'chat'].includes(normalized)) {
    return { label: t('documentStudio.panel.connectorReady', 'connector ready'), tone: 'success' };
  }
  return {
    label: t('documentStudio.panel.connectorUnknown', 'connector state unknown'),
    tone: 'muted',
  };
}

function collectBlockSourceKeys(sections: DocumentSection[]): Set<string> {
  const keys = new Set<string>();
  for (const section of sections) {
    for (const block of section.blocks) {
      const ref = block.sourceRef;
      if (ref) keys.add(`${ref.sourceType}:${ref.sourceId}`);
    }
  }
  return keys;
}

function SourceListPanel({
  sourceRefs,
  sections,
  assumptionCount,
}: {
  sourceRefs: DocumentSourceRef[];
  sections: DocumentSection[];
  assumptionCount: number;
}): React.ReactElement {
  const { t } = useTranslation();
  const usedSourceKeys = useMemo(() => collectBlockSourceKeys(sections), [sections]);
  const assumptionBlockCount = useMemo(
    () =>
      sections.reduce(
        (count, section) => count + section.blocks.filter((block) => block.isAssumption).length,
        0
      ),
    [sections]
  );
  const sourceRows = sourceRefs.map((ref) => {
    const key = `${ref.sourceType}:${ref.sourceId}`;
    const used = usedSourceKeys.has(key);
    const pinned = Boolean(ref.sourceVersion || ref.sourceSnapshotId);
    const connector = getConnectorState(ref.sourceType, t);
    return { ref, key, used, pinned, connector };
  });
  const matrix = {
    used: sourceRows.filter((row) => row.used).length,
    skipped: sourceRows.filter((row) => !row.used).length,
    missing: sourceRefs.length === 0 ? 1 : 0,
    assumption: assumptionBlockCount,
    pinned: sourceRows.filter((row) => row.pinned).length,
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-c-text">
          {t('documentStudio.panel.sourcesTitle', 'Sources')}
        </h3>
        <p className="text-xs text-c-text-secondary">
          {t('documentStudio.panel.sourcesSummary', {
            defaultValue: '{{attached}} attached · {{assumptions}} assumptions flagged',
            attached: sourceRefs.length,
            assumptions: assumptionCount,
          })}
        </p>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        {[
          [t('documentStudio.panel.matrixUsed', 'Used'), matrix.used],
          [t('documentStudio.panel.matrixSkipped', 'Skipped'), matrix.skipped],
          [t('documentStudio.panel.matrixMissing', 'Missing'), matrix.missing],
          [t('documentStudio.panel.matrixAssumption', 'Assumption'), matrix.assumption],
          [t('documentStudio.panel.matrixPinned', 'Pinned'), matrix.pinned],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-2"
          >
            <div className="text-[10px] uppercase tracking-wide text-c-text-secondary">{label}</div>
            <div className="mt-1 font-semibold text-c-text">{value}</div>
          </div>
        ))}
      </div>
      {sourceRefs.length === 0 ? (
        <div className="rounded-lg border border-amber-300/40 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300">
          {t(
            'documentStudio.panel.noSources',
            'No sources are attached to this document. Analytical claims should stay marked as assumptions until a source pack is bound.'
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {sourceRows.map(({ ref, key, used, connector }, index) => (
            <li
              key={`${key}:${index}`}
              className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs"
            >
              <div className="font-medium text-c-text">{ref.sourceTitle || ref.sourceId}</div>
              <div className="mt-1 text-c-text-secondary">
                {ref.sourceType} · {ref.sourceId}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    used
                      ? 'bg-success-500/10 text-success-700 dark:text-emerald-300'
                      : 'bg-c-surface-raised text-c-text-secondary'
                  }`}
                >
                  {used
                    ? t('documentStudio.panel.badgeUsed', 'used')
                    : t('documentStudio.panel.badgeSkipped', 'skipped')}
                </span>
                {ref.sourceVersion ? (
                  <span className="rounded-full bg-success-500/10 px-2 py-0.5 text-[10px] font-medium text-success-700 dark:text-emerald-300">
                    {t('documentStudio.panel.badgeVersion', {
                      defaultValue: 'version {{version}}',
                      version: ref.sourceVersion,
                    })}
                  </span>
                ) : (
                  <span className="rounded-full bg-warning-500/10 px-2 py-0.5 text-[10px] font-medium text-warning-700 dark:text-amber-300">
                    {t('documentStudio.panel.badgeUnpinned', 'unpinned')}
                  </span>
                )}
                {ref.sourceSnapshotId ? (
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                    {t('documentStudio.panel.badgeSnapshotReady', 'snapshot ready')}
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    connector.tone === 'success'
                      ? 'bg-success-500/10 text-success-700 dark:text-emerald-300'
                      : connector.tone === 'warning'
                        ? 'bg-warning-500/10 text-warning-700 dark:text-amber-300'
                        : 'bg-c-surface-raised text-c-text-secondary'
                  }`}
                >
                  {connector.label}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PropertiesPanel({
  schema,
  sourceCount,
  assumptionCount,
}: {
  schema: DocumentSchema;
  sourceCount: number;
  assumptionCount: number;
}): React.ReactElement {
  const { t } = useTranslation();
  const notSet = t('documentStudio.panel.notSet', 'Not set');
  const rows: Array<[string, string]> = [
    [t('documentStudio.panel.propType', 'Type'), schema.documentType],
    [t('documentStudio.panel.propLanguage', 'Language'), schema.language.toUpperCase()],
    [t('documentStudio.panel.propAudience', 'Audience'), metadataLabel(schema.audience, notSet)],
    [t('documentStudio.panel.propGoal', 'Goal'), schema.goal],
    [t('documentStudio.panel.propRegister', 'Register'), schema.communicationRegister],
    [t('documentStudio.panel.propDensity', 'Density'), schema.density],
    [t('documentStudio.panel.propStyle', 'Style'), schema.languageStyle],
    [t('documentStudio.panel.propConfidentiality', 'Confidentiality'), schema.confidentiality],
    [
      t('documentStudio.panel.propTemplate', 'Template'),
      schema.templateRef
        ? `${schema.templateRef.templateId} v${schema.templateRef.templateVersion}`
        : notSet,
    ],
    [t('documentStudio.panel.propSourcePack', 'Source pack'), schema.sourcePackId ?? notSet],
    [t('documentStudio.panel.propClient', 'Client'), schema.clientId ?? notSet],
    [t('documentStudio.panel.propOwner', 'Owner'), schema.owner ?? notSet],
    [t('documentStudio.panel.propSources', 'Sources'), String(sourceCount)],
    [t('documentStudio.panel.propAssumptions', 'Assumptions'), String(assumptionCount)],
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-c-text">
          {t('documentStudio.panel.propertiesTitle', 'Properties')}
        </h3>
        <p className="text-xs text-c-text-secondary">
          {t(
            'documentStudio.panel.propertiesSubtitle',
            'Artifact metadata and template/source pointers.'
          )}
        </p>
      </div>
      <dl className="space-y-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3"
          >
            <dt className="text-[10px] font-medium uppercase tracking-wide text-c-text-secondary">
              {label}
            </dt>
            <dd className="mt-1 break-words text-xs text-c-text">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function OutlinePanel({
  sections,
  sourceCount,
  assumptionCount,
}: {
  sections: DocumentSection[];
  sourceCount: number;
  assumptionCount: number;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <div className="mb-3 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs">
        <div className="font-medium text-c-text">
          {t('documentStudio.panel.sectionsCount', {
            defaultValue: '{{count}} sections',
            count: sections.length,
          })}
        </div>
        <div className="mt-1 text-c-text-secondary">
          {t('documentStudio.panel.sourcesAssumptions', {
            defaultValue: '{{sources}} sources · {{assumptions}} assumptions',
            sources: sourceCount,
            assumptions: assumptionCount,
          })}
        </div>
      </div>
      <nav aria-label={t('documentStudio.documentPanel.outlineAria', 'Document outline')}>
        <ol className="space-y-1.5">
          {sections.map((section, index) => (
            <li key={section.sectionId}>
              <a
                href={`#${section.sectionId}`}
                className="block rounded-lg px-3 py-2 text-xs text-c-text transition-colors hover:bg-c-surface-raised hover:text-c-text"
              >
                <span className="font-medium">
                  {index + 1}. {section.title}
                </span>
                <span className="mt-0.5 block text-[10px] text-c-text-secondary">
                  {t('documentStudio.panel.blocksCount', {
                    defaultValue: '{{count}} blocks',
                    count: section.blocks.length,
                  })}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}

function ActivityPanel({ artifactId }: { artifactId: string }): React.ReactElement {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<DocumentAccessHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await getDocumentStudioAccessHistory(artifactId, { limit: 80 }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.panel.activityLoadFailed', 'Failed to load activity')
      );
    } finally {
      setLoading(false);
    }
  }, [artifactId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('documentStudio.panel.activityTitle', 'Activity')}
          </h3>
          <p className="text-xs text-c-text-secondary">
            {t(
              'documentStudio.panel.activitySubtitle',
              'Unified document, share-link and approval history.'
            )}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          {loading
            ? t('documentStudio.panel.loading', 'Loading…')
            : t('documentStudio.panel.refresh', 'Refresh')}
        </Button>
      </div>
      {error ? (
        <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : null}
      {!loading && !error && entries.length === 0 ? (
        <div className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs text-c-text-secondary">
          {t('documentStudio.panel.activityEmpty', 'No activity has been recorded yet.')}
        </div>
      ) : null}
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.entryId}
            className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-c-text">{entry.action}</div>
              <span className="rounded-full bg-c-surface-raised px-2 py-0.5 text-[10px] text-c-text-secondary">
                {entry.source}
              </span>
            </div>
            <div className="mt-1 text-c-text-secondary">
              {entry.actorId} · {new Date(entry.occurredAt).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShareLinksPanel({ artifactId }: { artifactId: string }): React.ReactElement {
  const { t } = useTranslation();
  const [links, setLinks] = useState<DocumentShareLink[]>([]);
  const [scope, setScope] = useState<DocumentShareLinkAccessScope>('read');
  const [label, setLabel] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLinks(await listDocumentStudioShareLinks(artifactId));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.panel.shareLoadFailed', 'Failed to load share links')
      );
    } finally {
      setLoading(false);
    }
  }, [artifactId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createLink = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    setCreatedToken(null);
    try {
      const link = await createDocumentStudioShareLink(artifactId, {
        accessScope: scope,
        label: label.trim() || undefined,
      });
      setCreatedToken(link.token);
      setLinks(await listDocumentStudioShareLinks(artifactId));
      toast.success(t('documentStudio.documentPanel.shareLinkCreated', 'Share link created'));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.panel.shareCreateFailed', 'Failed to create share link')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-c-text">
          {t('documentStudio.panel.shareTitle', 'Share links')}
        </h3>
        <p className="text-xs text-c-text-secondary">
          {t(
            'documentStudio.panel.shareSubtitle',
            'Create scoped links. The plaintext token is shown only after creation.'
          )}
        </p>
      </div>
      <div className="mb-3 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3">
        <label className="mb-2 block text-xs text-c-text-secondary">
          {t('documentStudio.panel.shareLabel', 'Label')}
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 text-sm"
            placeholder={t('documentStudio.documentPanel.reviewNamePlaceholder', 'Client review')}
          />
        </label>
        <label className="mb-3 block text-xs text-c-text-secondary">
          {t('documentStudio.panel.shareScope', 'Scope')}
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as DocumentShareLinkAccessScope)}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 text-sm"
          >
            <option value="read">{t('documentStudio.panel.scopeRead', 'Read')}</option>
            <option value="comment">{t('documentStudio.panel.scopeComment', 'Comment')}</option>
            <option value="download">
              {t('documentStudio.documentPanel.actionDownload', 'Download')}
            </option>
            <option value="edit">{t('documentStudio.documentPanel.actionEdit', 'Edit')}</option>
          </select>
        </label>
        <Button type="button" size="sm" onClick={createLink} disabled={submitting}>
          {submitting
            ? t('documentStudio.panel.shareCreating', 'Creating…')
            : t('documentStudio.panel.shareCreate', 'Create link')}
        </Button>
        {createdToken ? (
          <div className="mt-3 rounded-lg border border-success-500/30 bg-success-500/10 p-2 text-xs text-success-700 dark:text-emerald-300">
            {t('documentStudio.panel.shareToken', 'Token')}:{' '}
            <span className="break-all font-mono">{createdToken}</span>
          </div>
        ) : null}
      </div>
      {error ? (
        <div className="mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : null}
      {!loading && links.length === 0 ? (
        <div className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs text-c-text-secondary">
          {t('documentStudio.panel.shareEmpty', 'No share links yet.')}
        </div>
      ) : null}
      <ul className="space-y-2">
        {links.map((link) => (
          <li
            key={link.shareLinkId}
            className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-c-text">{link.label || link.shareLinkId}</div>
              <span className="rounded-full bg-c-surface-raised px-2 py-0.5 text-[10px] text-c-text-secondary">
                {link.runtimeStatus?.effectiveStatus ?? link.status}
              </span>
            </div>
            <div className="mt-1 text-c-text-secondary">
              {link.accessScope} ·{' '}
              {t('documentStudio.panel.shareUsedTimes', {
                defaultValue: 'used {{count}} times',
                count: link.consumeCount,
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AudienceVariantsPanel({ artifactId }: { artifactId: string }): React.ReactElement {
  const { t } = useTranslation();
  const [variants, setVariants] = useState<DocumentVariantSummary[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVariants(await listDocumentStudioVariants(artifactId));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.panel.variantsLoadFailed', 'Failed to load audience variants')
      );
    } finally {
      setLoading(false);
    }
  }, [artifactId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const previewVariant = async (profileId: string): Promise<void> => {
    setError(null);
    try {
      const variant = await getDocumentStudioVariant(artifactId, profileId);
      setPreview(
        t('documentStudio.panel.variantPreviewSummary', {
          defaultValue:
            '{{title}}: {{kept}} sections kept, {{dropped}} dropped, {{blocksDropped}} blocks dropped.',
          title: variant.schema.title,
          kept: variant.provenance.sectionsKept.length,
          dropped: variant.provenance.sectionsDropped.length,
          blocksDropped: variant.provenance.blocksDropped,
        })
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.panel.variantRenderFailed', 'Failed to render variant')
      );
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-c-text">
          {t('documentStudio.panel.variantsTitle', 'Audience variants')}
        </h3>
        <p className="text-xs text-c-text-secondary">
          {t(
            'documentStudio.panel.variantsSubtitle',
            'Render read-only projections for board, client, team, or custom audience profiles.'
          )}
        </p>
      </div>
      {error ? (
        <div className="mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : null}
      {preview ? (
        <div className="mb-3 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-800 dark:text-sky-300">
          {preview}
        </div>
      ) : null}
      {!loading && variants.length === 0 ? (
        <div className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs text-c-text-secondary">
          {t('documentStudio.panel.variantsEmpty', 'No active audience profiles are available.')}
        </div>
      ) : null}
      <ul className="space-y-2">
        {variants.map((variant) => (
          <li
            key={variant.profile.profileId}
            className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs"
          >
            <div className="font-medium text-c-text">{variant.profile.name}</div>
            <div className="mt-1 text-c-text-secondary">
              {variant.profile.audienceLabels.join(', ') ||
                t('documentStudio.panel.inheritsAudience', 'inherits audience')}{' '}
              · v{variant.profile.version}
            </div>
            {variant.plan.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-c-text-secondary">
                {variant.plan.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => void previewVariant(variant.profile.profileId)}
            >
              {t('documentStudio.panel.previewProjection', 'Preview projection')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SchemaDiffPanel({ artifactId }: { artifactId: string }): React.ReactElement {
  const { t } = useTranslation();
  const [result, setResult] = useState<DocumentSchemaDiffResponse | null>(null);
  const [snapshots, setSnapshots] = useState<DocumentVersionSnapshotSummary[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await getDocumentStudioSchemaDiff(artifactId, selectedVersionId || undefined));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.panel.diffLoadFailed', 'Failed to load schema diff')
      );
    } finally {
      setLoading(false);
    }
  }, [artifactId, selectedVersionId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    // Best-effort: the baseline picker is optional sugar — the diff itself
    // defaults to the latest snapshot when the list cannot be loaded.
    let cancelled = false;
    void listDocumentStudioSnapshots(artifactId)
      .then((items) => {
        if (!cancelled) setSnapshots(items);
      })
      .catch(() => {
        if (!cancelled) setSnapshots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [artifactId]);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('documentStudio.panel.diffTitle', 'Schema diff')}
          </h3>
          <p className="text-xs text-c-text-secondary">
            {t(
              'documentStudio.panel.diffSubtitle',
              'Read-only comparison between live schema and the latest snapshot.'
            )}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          {loading
            ? t('documentStudio.panel.loading', 'Loading…')
            : t('documentStudio.panel.refresh', 'Refresh')}
        </Button>
      </div>
      {error ? (
        <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : null}
      {snapshots.length > 0 ? (
        <label className="mb-3 block text-xs text-c-text-secondary">
          {t('documentStudio.panel.diffBaselinePicker', 'Compare against snapshot')}
          <select
            value={selectedVersionId}
            onChange={(event) => setSelectedVersionId(event.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 text-sm"
            data-testid="schema-diff-baseline-select"
          >
            <option value="">
              {t('documentStudio.panel.diffBaselineLatest', 'Latest snapshot')}
            </option>
            {[...snapshots].reverse().map((snapshot) => (
              <option key={snapshot.versionId} value={snapshot.versionId}>
                {`v${snapshot.versionNumber} · ${new Date(snapshot.capturedAt).toLocaleString()}${
                  snapshot.label ? ` · ${snapshot.label}` : ''
                }`}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {result ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs">
            <div className="font-medium text-c-text">{result.summary}</div>
            <div className="mt-1 text-c-text-secondary">
              {t('documentStudio.panel.diffBaseline', {
                defaultValue: 'Baseline v{{version}}',
                version: result.baseSnapshot.versionNumber,
              })}{' '}
              · {new Date(result.baseSnapshot.capturedAt).toLocaleString()}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              [
                t('documentStudio.panel.diffSectionsAdded', 'Sections +'),
                result.diff.stats.addedSectionCount,
              ],
              [
                t('documentStudio.panel.diffSectionsModified', 'Sections Δ'),
                result.diff.stats.modifiedSectionCount,
              ],
              [
                t('documentStudio.panel.diffBlocksAdded', 'Blocks +'),
                result.diff.stats.addedBlockCount,
              ],
              [
                t('documentStudio.panel.diffBlocksModified', 'Blocks Δ'),
                result.diff.stats.modifiedBlockCount,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-2"
              >
                <div className="text-[10px] uppercase tracking-wide text-c-text-secondary">
                  {label}
                </div>
                <div className="mt-1 font-semibold text-c-text">{value}</div>
              </div>
            ))}
          </div>
          {!result.diff.hasChanges ? (
            <div className="rounded-lg border border-success-500/30 bg-success-500/10 p-3 text-xs text-success-700 dark:text-emerald-300">
              {t(
                'documentStudio.panel.diffNoChanges',
                'Live schema matches the selected snapshot structurally.'
              )}
            </div>
          ) : (
            <DocumentSchemaDiffView diff={result.diff} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function ManifestGatePanel(): React.ReactElement {
  const { t } = useTranslation();
  const [result, setResult] = useState<ExecutionModuleValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const manifest = await fetchExecutionModuleManifest('doc-builder');
      setResult(await validateExecutionModuleManifest('doc-builder', manifest));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'documentStudio.panel.manifestValidateFailed',
              'Failed to validate DOC_BUILDER_MANIFEST'
            )
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('documentStudio.panel.manifestTitle', 'Manifest gate')}
          </h3>
          <p className="text-xs text-c-text-secondary">
            {t(
              'documentStudio.panel.manifestSubtitle',
              'Server-side validation for DOC_BUILDER_MANIFEST.'
            )}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          {loading
            ? t('documentStudio.panel.manifestChecking', 'Checking…')
            : t('documentStudio.panel.manifestRecheck', 'Recheck')}
        </Button>
      </div>
      {error ? (
        <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : null}
      {result ? (
        <div className="space-y-3">
          <div
            className={`rounded-lg border p-3 text-xs ${
              result.ok
                ? 'border-success-500/30 bg-success-500/10 text-success-700 dark:text-emerald-300'
                : 'border-danger-500/30 bg-danger-500/10 text-danger-700 dark:text-danger-300'
            }`}
          >
            <div className="font-semibold">
              {result.ok
                ? t('documentStudio.panel.manifestPasses', 'DOC_BUILDER_MANIFEST passes')
                : t(
                    'documentStudio.panel.manifestViolations',
                    'DOC_BUILDER_MANIFEST has violations'
                  )}
            </div>
            <div className="mt-1">
              {t('documentStudio.panel.manifestCounts', {
                defaultValue: '{{must}} MUST · {{should}} SHOULD',
                must: result.mustViolations.length,
                should: result.shouldViolations.length,
              })}
            </div>
          </div>
          {[...result.mustViolations, ...result.shouldViolations].length > 0 ? (
            <ul className="space-y-2">
              {[...result.mustViolations, ...result.shouldViolations].map((violation) => (
                <li
                  key={`${violation.ruleId}:${violation.message}`}
                  className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs"
                >
                  <div className="font-medium text-c-text">
                    {violation.ruleId} · {violation.severity.toUpperCase()}
                  </div>
                  <p className="mt-1 text-c-text-secondary">{violation.message}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ApprovalsPanel({ artifactId }: { artifactId: string }): React.ReactElement {
  const { t } = useTranslation();
  const [approvals, setApprovals] = useState<DocumentApprovalRequest[]>([]);
  const [participantInput, setParticipantInput] = useState('');
  const [reason, setReason] = useState('');
  const [decisionComment, setDecisionComment] = useState('');
  const [quorumPolicy, setQuorumPolicy] = useState<DocumentApprovalQuorumPolicy>('single_approval');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setApprovals(await listDocumentStudioApprovals(artifactId));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.panel.approvalsLoadFailed', 'Failed to load approvals')
      );
    } finally {
      setLoading(false);
    }
  }, [artifactId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requestApproval = async (): Promise<void> => {
    const participants = participantInput
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((userId) => ({ userId, required: true }));
    if (participants.length === 0) {
      setError(
        t('documentStudio.panel.approvalsReviewerRequired', 'Add at least one reviewer user id.')
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const approval = await requestDocumentStudioApproval(artifactId, {
        participants,
        quorumPolicy,
        reason: reason.trim() || undefined,
      });
      setApprovals((current) => [
        approval,
        ...current.filter((a) => a.approvalId !== approval.approvalId),
      ]);
      setParticipantInput('');
      setReason('');
      toast.success(t('documentStudio.documentPanel.approvalRequested', 'Approval requested'));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.panel.approvalRequestFailed', 'Failed to request approval')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitDecision = async (
    approvalId: string,
    kind: DocumentApprovalDecisionKind
  ): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const approval = await recordDocumentStudioApprovalDecision(artifactId, approvalId, {
        kind,
        comment: decisionComment.trim() || undefined,
      });
      setApprovals((current) =>
        current.map((item) => (item.approvalId === approval.approvalId ? approval : item))
      );
      setDecisionComment('');
      toast.success(
        t('documentStudio.documentPanel.approvalDecisionRecorded', 'Approval decision recorded')
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.panel.decisionFailed', 'Failed to record decision')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cancelApproval = async (approvalId: string): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const approval = await cancelDocumentStudioApproval(
        artifactId,
        approvalId,
        reason.trim() || undefined
      );
      setApprovals((current) =>
        current.map((item) => (item.approvalId === approval.approvalId ? approval : item))
      );
      toast.success(t('documentStudio.documentPanel.approvalCancelled', 'Approval cancelled'));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.panel.approvalCancelFailed', 'Failed to cancel approval')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('documentStudio.panel.approvalsTitle', 'Approvals')}
          </h3>
          <p className="text-xs text-c-text-secondary">
            {t(
              'documentStudio.panel.approvalsSubtitle',
              'Review tickets and quorum state for this document.'
            )}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          {loading
            ? t('documentStudio.panel.loading', 'Loading…')
            : t('documentStudio.panel.refresh', 'Refresh')}
        </Button>
      </div>
      <div className="mb-3 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3">
        <label className="mb-2 block text-xs text-c-text-secondary">
          {t('documentStudio.panel.reviewersLabel', 'Reviewers (comma-separated user ids)')}
          <input
            value={participantInput}
            onChange={(event) => setParticipantInput(event.target.value)}
            placeholder="user-1,user-2"
            className="mt-1 h-9 w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 text-sm"
          />
        </label>
        <label className="mb-2 block text-xs text-c-text-secondary">
          {t('documentStudio.panel.quorumLabel', 'Quorum')}
          <select
            value={quorumPolicy}
            onChange={(event) =>
              setQuorumPolicy(event.target.value as DocumentApprovalQuorumPolicy)
            }
            className="mt-1 h-9 w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 text-sm"
          >
            <option value="single_approval">
              {t('documentStudio.panel.quorumSingle', 'Single approval')}
            </option>
            <option value="majority">{t('documentStudio.panel.quorumMajority', 'Majority')}</option>
            <option value="unanimous">
              {t('documentStudio.panel.quorumUnanimous', 'Unanimous')}
            </option>
          </select>
        </label>
        <label className="mb-2 block text-xs text-c-text-secondary">
          {t('documentStudio.panel.reasonLabel', 'Reason')}
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 min-h-[64px] w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm"
          />
        </label>
        <Button type="button" size="sm" onClick={requestApproval} disabled={submitting}>
          {submitting
            ? t('documentStudio.panel.working', 'Working…')
            : t('documentStudio.panel.requestApproval', 'Request approval')}
        </Button>
      </div>
      <label className="mb-3 block text-xs text-c-text-secondary">
        {t('documentStudio.panel.decisionCommentLabel', 'Decision comment')}
        <input
          value={decisionComment}
          onChange={(event) => setDecisionComment(event.target.value)}
          className="mt-1 h-9 w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 text-sm"
          placeholder={t(
            'documentStudio.documentPanel.reviewerCommentPlaceholder',
            'Optional reviewer comment'
          )}
        />
      </label>
      {error ? (
        <div className="mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : null}
      {!loading && approvals.length === 0 ? (
        <div className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs text-c-text-secondary">
          {t('documentStudio.panel.approvalsEmpty', 'No approval requests yet.')}
        </div>
      ) : null}
      <ul className="space-y-2">
        {approvals.map((approval) => (
          <li
            key={approval.approvalId}
            className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-c-text">
                {approval.reason || approval.approvalId}
              </div>
              <span className="rounded-full bg-c-surface-raised px-2 py-0.5 text-[10px] text-c-text-secondary">
                {approval.status}
              </span>
            </div>
            <div className="mt-1 text-c-text-secondary">
              {t('documentStudio.panel.approvalMeta', {
                defaultValue:
                  '{{participants}} participants · {{quorum}} · {{decisions}} decisions',
                participants: approval.participants.length,
                quorum: approval.quorumPolicy,
                decisions: approval.decisions.length,
              })}
            </div>
            {approval.status === 'pending' ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void submitDecision(approval.approvalId, 'approve')}
                  disabled={submitting}
                >
                  {t('documentStudio.panel.approve', 'Approve')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void submitDecision(approval.approvalId, 'request_changes')}
                  disabled={submitting}
                >
                  {t('documentStudio.panel.requestChanges', 'Request changes')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void submitDecision(approval.approvalId, 'reject')}
                  disabled={submitting}
                >
                  {t('documentStudio.panel.reject', 'Reject')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void cancelApproval(approval.approvalId)}
                  disabled={submitting}
                >
                  {t('documentStudio.panel.cancel', 'Cancel')}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContentLibraryPanel({
  artifactId,
  schema,
  onSchemaUpdated,
}: {
  artifactId: string;
  schema: DocumentSchema;
  onSchemaUpdated: (nextSchema: DocumentSchema) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [blocks, setBlocks] = useState<DocumentContentBlockTemplate[]>([]);
  const [instantiatedBlock, setInstantiatedBlock] = useState<DocumentBlock | null>(null);
  const [targetSectionId, setTargetSectionId] = useState(schema.sections[0]?.sectionId ?? '');
  const [lastInsertedBlockId, setLastInsertedBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBlocks(
        await listDocumentStudioContentBlocks({
          documentType: schema.documentType,
          language: schema.language,
        })
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.panel.libraryLoadFailed', 'Failed to load content library')
      );
    } finally {
      setLoading(false);
    }
  }, [schema.documentType, schema.language, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (
      targetSectionId &&
      schema.sections.some((section) => section.sectionId === targetSectionId)
    ) {
      return;
    }
    setTargetSectionId(schema.sections[0]?.sectionId ?? '');
  }, [schema.sections, targetSectionId]);

  const instantiateBlock = async (contentBlockId: string): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await instantiateDocumentStudioContentBlock(contentBlockId);
      setInstantiatedBlock(result.block);
      toast.success(t('documentStudio.panel.blockInstantiated', 'Content block instantiated'));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.panel.blockInstantiateFailed', 'Failed to instantiate content block')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const insertBlock = async (contentBlockId: string): Promise<void> => {
    if (!targetSectionId) {
      setError(
        t(
          'documentStudio.panel.selectTargetSection',
          'Select a target section before inserting a content block.'
        )
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await insertDocumentStudioContentBlock(artifactId, contentBlockId, {
        sectionId: targetSectionId,
        position: 'end',
      });
      setInstantiatedBlock(result.insertedBlock);
      setLastInsertedBlockId(result.insertedBlock.blockId);
      onSchemaUpdated(result.schema);
      toast.success(
        t('documentStudio.panel.blockInserted', 'Content block inserted into document')
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.panel.blockInsertFailed', 'Failed to insert content block')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('documentStudio.panel.libraryTitle', 'Content library')}
          </h3>
          <p className="text-xs text-c-text-secondary">
            {t(
              'documentStudio.panel.librarySubtitle',
              'Active reusable blocks matching this document type and language.'
            )}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          {loading
            ? t('documentStudio.panel.loading', 'Loading…')
            : t('documentStudio.panel.refresh', 'Refresh')}
        </Button>
      </div>
      {error ? (
        <div className="mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : null}
      {instantiatedBlock ? (
        <div className="mb-3 rounded-lg border border-success-500/30 bg-success-500/10 p-3 text-xs text-success-700 dark:text-emerald-300">
          <div className="mb-1 font-semibold">
            {lastInsertedBlockId === instantiatedBlock.blockId
              ? t('documentStudio.panel.insertedReadback', 'Inserted block read-back')
              : t('documentStudio.panel.instantiatedPreview', 'Instantiated block preview')}
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap">
            {JSON.stringify(instantiatedBlock, null, 2)}
          </pre>
        </div>
      ) : null}
      <label className="mb-3 block text-xs font-medium text-c-text-secondary">
        {t('documentStudio.panel.insertIntoSection', 'Insert into section')}
        <select
          className="mt-1 w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-2 py-1 text-xs text-c-text"
          value={targetSectionId}
          onChange={(event) => setTargetSectionId(event.target.value)}
        >
          {schema.sections.map((section, index) => (
            <option key={section.sectionId} value={section.sectionId}>
              {index + 1}. {section.title}
            </option>
          ))}
        </select>
      </label>
      {!loading && blocks.length === 0 ? (
        <div className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs text-c-text-secondary">
          {t('documentStudio.panel.libraryEmpty', 'No reusable blocks match this document yet.')}
        </div>
      ) : null}
      <ul className="space-y-2">
        {blocks.map((block) => (
          <li
            key={block.contentBlockId}
            className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-xs"
          >
            <div className="font-medium text-c-text">{block.name}</div>
            <div className="mt-1 text-c-text-secondary">
              {block.languageScope} · v{block.version} · {block.block.type}
            </div>
            {block.description ? (
              <p className="mt-2 text-c-text-secondary">{block.description}</p>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => void instantiateBlock(block.contentBlockId)}
              disabled={submitting}
            >
              {t('documentStudio.panel.instantiatePreview', 'Instantiate preview')}
            </Button>
            <Button
              type="button"
              size="sm"
              className="ml-2 mt-2"
              onClick={() => void insertBlock(block.contentBlockId)}
              disabled={submitting || !targetSectionId}
            >
              {t('documentStudio.panel.insertIntoDocument', 'Insert into document')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TeresaDrawerPanel({
  artifactId,
  schema,
  onSchemaUpdated,
}: {
  artifactId: string;
  schema: DocumentSchema;
  onSchemaUpdated: (nextSchema: DocumentSchema) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <div className="mb-3 rounded-lg border border-c-accent bg-c-accent-soft0 p-3">
        <h3 className="text-sm font-semibold text-c-text">Teresa</h3>
        <p className="mt-1 text-xs text-c-text-secondary">
          {t(
            'documentStudio.panel.teresaSubtitle',
            'AI document co-editor. Use source/methodology prompts here for governed proposal flows; all changes still require review and approval before execution.'
          )}
        </p>
      </div>
      <p className="text-xs text-c-text-secondary">
        Zaznacz tekst w dokumencie, aby poprawić go z pomocą Teresy.
      </p>
    </div>
  );
}

export const DocumentStudioDocumentPanel: React.FC<DocumentStudioDocumentPanelProps> = ({
  artifactId,
  schema,
  generationWarnings = [],
  onStartOver,
  onSchemaUpdated,
}) => {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState<'markdown' | 'docx' | 'pdf' | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  /** B4 — last successfully exported format; drives the inline success note. */
  const [exportSuccess, setExportSuccess] = useState<'markdown' | 'docx' | 'pdf' | null>(null);
  /** B4 — export-time warnings (chart raster / logo fallbacks) from the last export. */
  const [exportWarnings, setExportWarnings] = useState<DocumentGenerationWarning[]>([]);
  const [openingBuilder, setOpeningBuilder] = useState(false);
  /** When set, the previous export attempt was QA-blocked. The user can resolve findings or invoke the audited override. */
  const [qaBlock, setQaBlock] = useState<{
    format: 'markdown' | 'docx' | 'pdf';
    report: DocumentQaReport;
  } | null>(null);
  /** Cached policy snapshot; controls whether the override button is rendered. */
  const [policy, setPolicy] = useState<DocumentStudioPolicy | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDocumentStudioPolicy()
      .then((next) => {
        if (!cancelled) setPolicy(next);
      })
      .catch(() => {
        // Default deny: leave policy null → override button stays hidden.
        if (!cancelled) setPolicy({ canOverrideQa: false, role: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sourceCount = schema.sourceRefs.length;
  const assumptionCount = useMemo(
    () =>
      schema.sections.reduce(
        (acc, section) => acc + section.blocks.filter((b) => b.isAssumption).length,
        0
      ),
    [schema]
  );
  const tableSourceRef = useMemo(
    () =>
      schema.sourceRefs.find((ref) => {
        const sourceType = String(ref.sourceType || '').toLowerCase();
        return sourceType.includes('table') || sourceType.includes('sheet');
      }) ?? null,
    [schema.sourceRefs]
  );

  const triggerTextDownload = (filename: string, content: string, mime: string): void => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const triggerBinaryDownload = (filename: string, base64: string, mime: string): void => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const mimeForFormat = (format: 'markdown' | 'docx' | 'pdf'): string => {
    if (format === 'markdown') return 'text/markdown';
    if (format === 'pdf') return 'application/pdf';
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  };

  const handleExport = useCallback(
    async (
      format: 'markdown' | 'docx' | 'pdf',
      options: { qaOverride?: boolean } = {}
    ): Promise<void> => {
      setExporting(format);
      setExportError(null);
      setExportNote(null);
      setExportSuccess(null);
      setExportWarnings([]);
      if (!options.qaOverride) setQaBlock(null);
      try {
        const payload = await exportDocumentStudioArtifact(artifactId, format, {
          qaOverride: options.qaOverride === true,
        });
        const manifest = (payload.manifest ?? {}) as Record<string, unknown>;

        const hasBinary =
          typeof payload.contentBase64 === 'string' && payload.contentBase64.length > 0;
        const hasText = typeof payload.contentText === 'string' && payload.contentText.length > 0;
        if (!hasBinary && !hasText) {
          setExportNote(t('documentStudio.panel.exportNoContent', 'Export returned no content.'));
          return;
        }

        if (hasBinary) {
          triggerBinaryDownload(
            payload.filename,
            payload.contentBase64 as string,
            mimeForFormat(format)
          );
        } else {
          triggerTextDownload(
            payload.filename,
            payload.contentText as string,
            mimeForFormat(format)
          );
        }

        setQaBlock(null);
        setExportSuccess(format);
        // B4 — export-time warnings (e.g. chart_raster_failed, logo_unavailable)
        // were previously dropped on the floor; surface them next to the note.
        setExportWarnings(payload.generationWarnings ?? []);
        toast.success(
          t('documentStudio.panel.exportSuccess', {
            defaultValue: '{{format}} exported — the download has started.',
            format: format.toUpperCase(),
          })
        );
        if (manifest.qaOverride === true) {
          setExportNote(
            t(
              'documentStudio.panel.exportedWithOverride',
              'Exported with QA override. The override has been recorded in the audit trail.'
            )
          );
        }
      } catch (err) {
        if (err instanceof QaBlockingError) {
          setQaBlock({ format, report: err.report });
          setExportError(
            t(
              'documentStudio.panel.exportQaBlocked',
              'Export blocked by Quality QA. Resolve the findings below or use the audited override.'
            )
          );
          return;
        }
        if (err instanceof QaOverrideUnauthorizedError) {
          // The frontend hides the override button for non-privileged users,
          // but a stale policy or deep link can still surface this — refresh
          // the cached policy and show a clear message.
          setPolicy({ canOverrideQa: false, role: err.role ?? null });
          setExportError(
            err.message ||
              t(
                'documentStudio.panel.overrideUnauthorized',
                'You are not authorized to override the export QA gate. Ask a privileged reviewer.'
              )
          );
          return;
        }
        // B4 — readable i18n framing instead of a bare technical message;
        // the underlying detail is kept as context when available.
        const detail = err instanceof Error && err.message.trim().length > 0 ? err.message : null;
        setExportError(
          detail
            ? t('documentStudio.panel.exportFailedWithDetail', {
                defaultValue: '{{format}} export failed: {{detail}}',
                format: format.toUpperCase(),
                detail,
              })
            : t('documentStudio.panel.exportFailedFormat', {
                defaultValue: '{{format}} export failed. Please try again.',
                format: format.toUpperCase(),
              })
        );
      } finally {
        setExporting(null);
      }
    },
    [artifactId, t]
  );

  const handleOpenBuilder = async (): Promise<void> => {
    if (!tableSourceRef?.sourceId) {
      setExportNote(
        t(
          'documentStudio.panel.noTableSource',
          'No sheet/table source is attached to this document.'
        )
      );
      return;
    }
    setOpeningBuilder(true);
    setExportError(null);
    try {
      const workspaceId = await resolveTablePlatformWorkspaceIdForTable(tableSourceRef.sourceId);
      if (!workspaceId) {
        setExportError(
          t(
            'documentStudio.panel.workspaceResolveFailed',
            'Could not resolve workspace for the linked table source.'
          )
        );
        return;
      }
      const targetPath = buildMyWorkSheetTableOpenPath(workspaceId, tableSourceRef.sourceId);
      toast.success(t('documentStudio.panel.openingBuilder', 'Opening sheets builder lane…'));
      window.location.assign(targetPath);
    } catch (err) {
      setExportError(
        err instanceof Error
          ? err.message
          : t('documentStudio.panel.openBuilderFailed', 'Failed to open sheets builder')
      );
    } finally {
      setOpeningBuilder(false);
    }
  };

  const topBarChips = useMemo<TopBarChipDescriptor[]>(
    () => [
      {
        id: 'history',
        label: t('documentStudio.panel.chipHistory', 'History'),
        icon: History,
        tooltip: t(
          'documentStudio.panel.chipHistoryTooltip',
          'Open the unified activity feed from the right rail.'
        ),
      },
      {
        id: 'qa',
        label: qaBlock
          ? t('documentStudio.panel.chipQaBlocked', 'QA blocked')
          : t('documentStudio.panel.chipQa', 'QA'),
        icon: ShieldCheck,
        dotTone: qaBlock ? 'danger' : 'success',
        tooltip: t('documentStudio.panel.chipQaTooltip', 'Open the QA panel from the right rail.'),
      },
      {
        id: 'governance',
        label: policy?.canOverrideQa
          ? t('documentStudio.panel.chipOverrideAllowed', 'Override allowed')
          : t('documentStudio.panel.chipGovernance', 'Governance'),
        icon: FileWarning,
        dotTone: policy?.canOverrideQa ? 'warning' : 'neutral',
        tooltip: t(
          'documentStudio.panel.chipGovernanceTooltip',
          'Export governance policy for this user.'
        ),
      },
      {
        id: 'share',
        label: t('documentStudio.panel.chipShare', 'Share'),
        icon: Share2,
        tooltip: t(
          'documentStudio.panel.chipShareTooltip',
          'Open share-link management from the right rail.'
        ),
      },
      {
        id: 'agent',
        label: t('documentStudio.panel.chipAiEditor', 'AI Editor'),
        icon: Bot,
        tooltip: t('documentStudio.panel.chipAiEditorTooltip', 'Open Teresa from the right rail.'),
      },
      {
        id: 'run',
        label: exporting
          ? t('documentStudio.panel.chipExporting', 'Exporting')
          : t('documentStudio.panel.chipExportDocx', 'Export DOCX'),
        icon: Download,
        kind: 'primary',
        disabled: exporting !== null,
        onClick: () => void handleExport('docx'),
      },
    ],
    [exporting, handleExport, policy?.canOverrideQa, qaBlock, t]
  );

  // Right-rail tool inventory (13 total). Kanon powłoki: ≤5 "primary"
  // icons visible by default in the icon strip; the rest fold behind a
  // single `more` overflow entry (mirrors the `⋯` pattern already used
  // for TopBar chip overflow — see ExecutiveModuleShell/TopBar.tsx).
  // Nothing is removed: all 13 tools remain reachable, just regrouped
  // by visibility tier. Primary 5 chosen for write/structure/export
  // frequency: Sources, Properties, Quality QA, Teresa (AI co-writing),
  // Comments. The remaining 8 (Activity, Schema diff, Audience
  // variants, Share links, Approvals, Manifest gate, Content library,
  // AI Editor hint) are secondary/advanced and move to overflow.
  const primaryRightRailTools = useMemo<RightRailToolDescriptor[]>(
    () => [
      {
        id: 'sources',
        label: t('documentStudio.panel.toolSources', 'Sources'),
        icon: FileText,
        badge: sourceCount > 0 ? sourceCount : undefined,
        dotTone: assumptionCount > 0 ? 'warning' : sourceCount > 0 ? 'success' : 'warning',
      },
      {
        id: 'properties',
        label: t('documentStudio.panel.toolProperties', 'Properties'),
        icon: Table2,
      },
      {
        id: 'qa',
        label: t('documentStudio.panel.toolQa', 'Quality QA'),
        icon: ShieldCheck,
        dotTone: qaBlock ? 'danger' : null,
      },
      {
        id: 'teresa',
        label: 'Teresa',
        icon: Bot,
      },
      {
        id: 'comments',
        label: t('documentStudio.panel.toolComments', 'Comments'),
        icon: MessageSquare,
      },
    ],
    [assumptionCount, qaBlock, sourceCount, t]
  );

  const overflowRightRailTools = useMemo<RightRailToolDescriptor[]>(
    () => [
      {
        id: 'activity',
        label: t('documentStudio.panel.toolActivity', 'Activity'),
        icon: History,
      },
      {
        id: 'diff',
        label: t('documentStudio.panel.toolDiff', 'Schema diff'),
        icon: FileWarning,
      },
      {
        id: 'variants',
        label: t('documentStudio.panel.toolVariants', 'Audience variants'),
        icon: Users,
      },
      {
        id: 'share',
        label: t('documentStudio.panel.toolShare', 'Share links'),
        icon: Share2,
      },
      {
        id: 'approvals',
        label: t('documentStudio.panel.toolApprovals', 'Approvals'),
        icon: ShieldCheck,
      },
      {
        id: 'manifest',
        label: t('documentStudio.panel.toolManifest', 'Manifest gate'),
        icon: ShieldCheck,
      },
      {
        id: 'library',
        label: t('documentStudio.panel.toolLibrary', 'Content library'),
        icon: FileText,
      },
      {
        id: 'editor',
        label: t('documentStudio.panel.toolAiEditor', 'AI Editor'),
        icon: Sparkles,
      },
    ],
    [t]
  );

  // Selected overflow tool id (drives the panel once the user picks a
  // row from the `more` menu). `ExecutiveModuleShell` owns the rail's
  // `activeToolId` internally and does not expose it, so this stays
  // deliberately sticky across `more` re-opens (last pick shown again)
  // rather than reaching into shell internals to auto-reset it. The
  // explicit "back to menu" affordance (`renderOverflowToolPanel`)
  // always lets the user return to the full list.
  const [overflowSelection, setOverflowSelection] = useState<string | null>(null);

  const rightRailTools = useMemo<RightRailToolDescriptor[]>(
    () => [
      ...primaryRightRailTools,
      {
        id: 'more',
        label: t('documentStudio.panel.toolMore', 'More tools'),
        icon: MoreHorizontal,
      },
    ],
    [primaryRightRailTools, t]
  );

  // `more` overflow menu — full-width rows listing the 8 secondary
  // tools, mirroring the `⋯` idiom in ExecutiveModuleShell/TopBar.tsx.
  // Picking a row sets `overflowSelection`, which routes the panel to
  // that tool's real content (rendered below via `effectiveToolId`).
  const renderOverflowMenu = (): React.ReactNode => (
    <div
      className="flex h-full flex-col overflow-y-auto p-2"
      data-testid="document-studio-rail-overflow-menu"
    >
      {overflowRightRailTools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => setOverflowSelection(tool.id)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-c-text-secondary transition-colors hover:bg-c-surface-raised"
          data-testid={`document-studio-rail-overflow-item-${tool.id}`}
        >
          <tool.icon size={14} aria-hidden="true" className="flex-shrink-0" />
          <span className="flex-1 truncate">{tool.label}</span>
        </button>
      ))}
    </div>
  );

  // Overflow tool panels (8 secondary tools, reached via `more` →
  // menu row). Each is wrapped with a "back to menu" affordance so the
  // user can return to the overflow list without leaving the rail.
  const renderOverflowToolPanel = (overflowToolId: string): React.ReactNode => {
    const backButton = (
      <button
        type="button"
        onClick={() => setOverflowSelection(null)}
        className="flex items-center gap-1 px-3 pt-2 text-xs text-c-text-secondary hover:text-c-text"
        data-testid="document-studio-rail-overflow-back"
      >
        <ChevronDown size={12} className="rotate-90" aria-hidden="true" />
        {t('documentStudio.panel.toolMoreBack', 'More tools')}
      </button>
    );

    let content: React.ReactNode = null;
    if (overflowToolId === 'activity') {
      content = <ActivityPanel artifactId={artifactId} />;
    } else if (overflowToolId === 'diff') {
      content = <SchemaDiffPanel artifactId={artifactId} />;
    } else if (overflowToolId === 'share') {
      content = <ShareLinksPanel artifactId={artifactId} />;
    } else if (overflowToolId === 'variants') {
      content = <AudienceVariantsPanel artifactId={artifactId} />;
    } else if (overflowToolId === 'approvals') {
      content = <ApprovalsPanel artifactId={artifactId} />;
    } else if (overflowToolId === 'manifest') {
      content = <ManifestGatePanel />;
    } else if (overflowToolId === 'library') {
      content = (
        <ContentLibraryPanel
          artifactId={artifactId}
          schema={schema}
          onSchemaUpdated={onSchemaUpdated}
        />
      );
    } else if (overflowToolId === 'editor') {
      content = (
        <div className="h-full overflow-y-auto p-3">
          <p className="text-xs text-c-text-secondary">
            Zaznacz tekst w dokumencie, aby poprawić go z pomocą Teresy.
          </p>
        </div>
      );
    }

    if (!content) return null;

    return (
      <div className="flex h-full flex-col">
        {backButton}
        <div className="min-h-0 flex-1">{content}</div>
      </div>
    );
  };

  const renderRightRailPanel = (activeToolId: string | null): React.ReactNode => {
    if (activeToolId === 'more') {
      return overflowSelection ? renderOverflowToolPanel(overflowSelection) : renderOverflowMenu();
    }
    if (activeToolId === 'sources') {
      return (
        <SourceListPanel
          sourceRefs={schema.sourceRefs}
          sections={schema.sections}
          assumptionCount={assumptionCount}
        />
      );
    }
    if (activeToolId === 'properties') {
      return (
        <PropertiesPanel
          schema={schema}
          sourceCount={sourceCount}
          assumptionCount={assumptionCount}
        />
      );
    }
    if (activeToolId === 'comments') {
      return <DocumentCommentsPanel artifactId={artifactId} sections={schema.sections} />;
    }
    if (activeToolId === 'teresa') {
      return (
        <TeresaDrawerPanel
          artifactId={artifactId}
          schema={schema}
          onSchemaUpdated={onSchemaUpdated}
        />
      );
    }
    if (activeToolId === 'qa') {
      return (
        <div className="h-full overflow-y-auto p-3">
          <DocumentStudioQaPanel artifactId={artifactId} />
        </div>
      );
    }
    return null;
  };

  const canvas = (
    <div className="flex min-h-full flex-col">
      {generationWarnings.length > 0 && (
        <div className="px-6 pt-4">
          <DocumentGenerationWarningsChip warnings={generationWarnings} />
        </div>
      )}
      {(exportSuccess || exportWarnings.length > 0 || exportNote || exportError || qaBlock) && (
        <div className="space-y-3 px-6 pt-4">
          {exportSuccess ? (
            <DocumentExportSuccessNote
              format={exportSuccess}
              onDismiss={() => {
                setExportSuccess(null);
                setExportWarnings([]);
              }}
            />
          ) : null}

          {exportWarnings.length > 0 ? (
            <DocumentGenerationWarningsChip
              warnings={exportWarnings}
              summaryKey="documentStudio.generationWarnings.exportSummary"
            />
          ) : null}

          {exportNote ? (
            <div className="rounded-md border border-amber-400/30 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {exportNote}
            </div>
          ) : null}

          {exportError ? (
            <div
              role="alert"
              className="rounded-md border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-xs text-danger-700 dark:text-danger-400"
            >
              {exportError}
            </div>
          ) : null}

          {qaBlock ? (
            <div
              role="alert"
              className="rounded-md border border-danger-500/40 bg-danger-500/5 px-3 py-3 text-xs dark:border-danger-400/30 dark:bg-danger-500/10"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="font-semibold text-danger-700 dark:text-danger-300">
                  {t('documentStudio.panel.qaBlockedExport', {
                    defaultValue: 'QA blocked the {{format}} export',
                    format: qaBlock.format.toUpperCase(),
                  })}
                </span>
                <span className="rounded-full bg-danger-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger-700 dark:text-danger-300">
                  {t('documentStudio.panel.blockingCategories', {
                    defaultValue: '{{count}} blocking categories',
                    count: qaBlock.report.categories.filter((c) => c.blocking).length,
                  })}
                </span>
              </div>
              <ul className="mb-2 space-y-1 text-c-text">
                {qaBlock.report.categories
                  .filter((c) => c.blocking)
                  .map((c) => (
                    <li key={c.category}>
                      <span className="font-medium uppercase tracking-wide">{c.category}</span>
                      <span className="ml-2 text-c-text-secondary">
                        {t('documentStudio.panel.scoreFindings', {
                          defaultValue: 'score {{score}}/100 · {{count}} findings',
                          score: c.score,
                          count: c.findings.length,
                        })}
                      </span>
                    </li>
                  ))}
              </ul>
              <p className="mb-2 text-c-text-secondary">
                {t(
                  'documentStudio.panel.qaBlockedHint',
                  'Resolve the findings in the QA panel, or proceed with an audited override if the export is time-critical and you accept the risk.'
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setQaBlock(null)}
                  disabled={exporting !== null}
                >
                  {t('documentStudio.panel.dismiss', 'Dismiss')}
                </Button>
                {policy?.canOverrideQa ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="border border-danger-400/40 text-danger-700 hover:bg-danger-500/10 dark:text-danger-300"
                    onClick={() => handleExport(qaBlock.format, { qaOverride: true })}
                    disabled={exporting !== null}
                  >
                    <span className="inline-flex items-center gap-1">
                      {exporting === qaBlock.format ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {t('documentStudio.panel.overrideAndExport', 'Override and export (audited)')}
                    </span>
                  </Button>
                ) : (
                  <span className="text-[11px] text-c-text-secondary">
                    {t(
                      'documentStudio.panel.overrideRequiresRole',
                      'Override requires admin or manager role'
                    )}
                    {policy?.role
                      ? ` — ${t('documentStudio.panel.yourRole', {
                          defaultValue: 'your role: {{role}}',
                          role: policy.role,
                        })}`
                      : ''}
                    .
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-3 overflow-y-auto p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3">
          <div>
            <h2 className="text-sm font-semibold text-c-text">
              {t('documentStudio.panel.documentPreview', 'Document preview')}
            </h2>
            <p className="text-xs text-c-text-secondary">
              {schema.documentType} · {schema.language.toUpperCase()} · {schema.density} ·{' '}
              {schema.confidentiality}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenBuilder}
              disabled={!tableSourceRef || openingBuilder}
            >
              <span className="inline-flex items-center gap-1">
                {openingBuilder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {t('documentStudio.panel.openInSheetsBuilder', 'Open in Sheets Builder')}
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleExport('markdown')}
              disabled={exporting !== null}
            >
              <span className="inline-flex items-center gap-1">
                {exporting === 'markdown' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Markdown
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleExport('docx')}
              disabled={exporting !== null}
            >
              <span className="inline-flex items-center gap-1">
                {exporting === 'docx' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                DOCX
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null}
            >
              <span className="inline-flex items-center gap-1">
                {exporting === 'pdf' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                PDF
              </span>
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onStartOver}>
              <span className="inline-flex items-center gap-1">
                <RotateCcw className="h-3.5 w-3.5" />
                {t('documentStudio.panel.startOver', 'Start over')}
              </span>
            </Button>
          </div>
        </div>
        <DocumentTipTapEditor
          schema={schema}
          onSchemaUpdated={onSchemaUpdated}
          editable
          artifactId={artifactId}
        />
      </div>
    </div>
  );

  return (
    <ExecutiveModuleShell
      moduleKey="document-studio"
      moduleLabel={t('documentStudio.view.moduleLabel', 'Document Studio')}
      title={schema.title}
      onBack={onStartOver}
      backLabel={t('documentStudio.panel.startOver', 'Start over')}
      topBarChips={topBarChips}
      presenceSlot={
        <div className="text-right text-[11px] text-c-text-secondary">
          <div>
            {schema.language.toUpperCase()} · {schema.confidentiality}
          </div>
          <div>
            {t('documentStudio.panel.presenceSources', {
              defaultValue: '{{count}} sources',
              count: sourceCount,
            })}
            {assumptionCount > 0
              ? ` · ${t('documentStudio.panel.presenceAssumptions', {
                  defaultValue: '{{count}} assumptions',
                  count: assumptionCount,
                })}`
              : ''}
          </div>
        </div>
      }
      leftRailTitle={t('documentStudio.panel.outlineTitle', 'Outline')}
      leftRailContent={
        <OutlinePanel
          sections={schema.sections}
          sourceCount={sourceCount}
          assumptionCount={assumptionCount}
        />
      }
      rightRailTools={rightRailTools}
      renderRightRailPanel={renderRightRailPanel}
      canvas={canvas}
      defaultLeftWidth={260}
      defaultRightWidth={340}
      persistRailState
      testId="document-studio-mels-shell"
    />
  );
};

export default DocumentStudioDocumentPanel;
