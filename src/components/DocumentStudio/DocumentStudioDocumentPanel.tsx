/**
 * Consultify Document Studio — Document Panel (FE-E1/FE-E2).
 *
 * Renders the generated DocumentSchema in the shared ExecutiveModuleShell:
 * left outline, central document canvas, right rail panels for Sources,
 * Properties, QA, and AI Editor.
 */

import {
  Bot,
  Download,
  FileText,
  FileWarning,
  History,
  Loader2,
  MessageSquare,
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
  createDocumentStudioComment,
  createDocumentStudioShareLink,
  exportDocumentStudioArtifact,
  getDocumentStudioAccessHistory,
  getDocumentStudioCommentThreads,
  getDocumentStudioPolicy,
  getDocumentStudioSchemaDiff,
  getDocumentStudioVariant,
  insertDocumentStudioContentBlock,
  instantiateDocumentStudioContentBlock,
  listDocumentStudioApprovals,
  listDocumentStudioContentBlocks,
  listDocumentStudioShareLinks,
  listDocumentStudioVariants,
  QaBlockingError,
  QaOverrideUnauthorizedError,
  recordDocumentStudioApprovalDecision,
  requestDocumentStudioApproval,
} from './api';
import { DocumentStudioQaPanel } from './DocumentStudioQaPanel';
import { DocumentTipTapEditor } from './editor';
import type {
  DocumentAccessHistoryEntry,
  DocumentApprovalDecisionKind,
  DocumentApprovalQuorumPolicy,
  DocumentApprovalRequest,
  DocumentBlock,
  DocumentCommentThread,
  DocumentContentBlockTemplate,
  DocumentQaReport,
  DocumentSchema,
  DocumentSchemaDiffResponse,
  DocumentSection,
  DocumentShareLink,
  DocumentShareLinkAccessScope,
  DocumentSourceRef,
  DocumentStudioPolicy,
  DocumentVariantSummary,
} from './types';

interface DocumentStudioDocumentPanelProps {
  artifactId: string;
  schema: DocumentSchema;
  onStartOver: () => void;
  onSchemaUpdated: (nextSchema: DocumentSchema) => void;
}

function metadataLabel(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'Not set';
  return value && value.trim().length > 0 ? value : 'Not set';
}

/**
 * Render a comment author identifier in a human-friendly way. Comment threads
 * only carry the author id; when that id is a raw UUID we shorten it so the UI
 * never shows a full 36-char identifier.
 */
function formatAuthorLabel(authorId: string | undefined | null): string {
  const id = String(authorId || '').trim();
  if (!id) return '—';
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function getConnectorState(sourceType: string): {
  label: string;
  tone: 'success' | 'warning' | 'muted';
} {
  const normalized = sourceType.toLowerCase();
  if (['notion', 'drive', 'google_drive', 'sharepoint', 'confluence'].includes(normalized)) {
    return {
      label: 'degraded: external connector gate',
      tone: 'warning',
    };
  }
  if (['table', 'v8_artifact', 'file', 'url', 'raw_text', 'chat'].includes(normalized)) {
    return { label: 'connector ready', tone: 'success' };
  }
  return { label: 'connector state unknown', tone: 'muted' };
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
    const connector = getConnectorState(ref.sourceType);
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
        <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Sources</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {sourceRefs.length} attached · {assumptionCount} assumption
          {assumptionCount === 1 ? '' : 's'} flagged
        </p>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        {[
          ['Used', matrix.used],
          ['Skipped', matrix.skipped],
          ['Missing', matrix.missing],
          ['Assumption', matrix.assumption],
          ['Pinned', matrix.pinned],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-slate-200 bg-white p-2 dark:border-navy-700 dark:bg-navy-900"
          >
            <div className="text-[10px] uppercase tracking-wide text-slate-600">{label}</div>
            <div className="mt-1 font-semibold text-navy-900 dark:text-slate-100">{value}</div>
          </div>
        ))}
      </div>
      {sourceRefs.length === 0 ? (
        <div className="rounded-lg border border-amber-300/40 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300">
          No sources are attached to this document. Analytical claims should stay marked as
          assumptions until a source pack is bound.
        </div>
      ) : (
        <ul className="space-y-2">
          {sourceRows.map(({ ref, key, used, connector }, index) => (
            <li
              key={`${key}:${index}`}
              className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-navy-700 dark:bg-navy-900"
            >
              <div className="font-medium text-navy-900 dark:text-slate-100">
                {ref.sourceTitle || ref.sourceId}
              </div>
              <div className="mt-1 text-slate-500 dark:text-slate-400">
                {ref.sourceType} · {ref.sourceId}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    used
                      ? 'bg-success-500/10 text-success-700 dark:text-emerald-300'
                      : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {used ? 'used' : 'skipped'}
                </span>
                {ref.sourceVersion ? (
                  <span className="rounded-full bg-success-500/10 px-2 py-0.5 text-[10px] font-medium text-success-700 dark:text-emerald-300">
                    version {ref.sourceVersion}
                  </span>
                ) : (
                  <span className="rounded-full bg-warning-500/10 px-2 py-0.5 text-[10px] font-medium text-warning-700 dark:text-amber-300">
                    unpinned
                  </span>
                )}
                {ref.sourceSnapshotId ? (
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                    snapshot ready
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    connector.tone === 'success'
                      ? 'bg-success-500/10 text-success-700 dark:text-emerald-300'
                      : connector.tone === 'warning'
                        ? 'bg-warning-500/10 text-warning-700 dark:text-amber-300'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
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
  const rows: Array<[string, string]> = [
    ['Type', schema.documentType],
    ['Language', schema.language.toUpperCase()],
    ['Audience', metadataLabel(schema.audience)],
    ['Goal', schema.goal],
    ['Register', schema.communicationRegister],
    ['Density', schema.density],
    ['Style', schema.languageStyle],
    ['Confidentiality', schema.confidentiality],
    [
      'Template',
      schema.templateRef
        ? `${schema.templateRef.templateId} v${schema.templateRef.templateVersion}`
        : 'Not set',
    ],
    ['Source pack', schema.sourcePackId ?? 'Not set'],
    ['Client', schema.clientId ?? 'Not set'],
    ['Owner', schema.owner ?? 'Not set'],
    ['Sources', String(sourceCount)],
    ['Assumptions', String(assumptionCount)],
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Properties</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Artifact metadata and template/source pointers.
        </p>
      </div>
      <dl className="space-y-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-slate-200 bg-white p-3 dark:border-navy-700 dark:bg-navy-900"
          >
            <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-600">
              {label}
            </dt>
            <dd className="mt-1 break-words text-xs text-navy-900 dark:text-slate-100">{value}</dd>
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
      <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-navy-700 dark:bg-navy-900">
        <div className="font-medium text-navy-900 dark:text-slate-100">
          {sections.length} sections
        </div>
        <div className="mt-1 text-slate-500 dark:text-slate-400">
          {sourceCount} sources · {assumptionCount} assumptions
        </div>
      </div>
      <nav aria-label={t('documentStudio.documentPanel.outlineAria', 'Document outline')}>
        <ol className="space-y-1.5">
          {sections.map((section, index) => (
            <li key={section.sectionId}>
              <a
                href={`#${section.sectionId}`}
                className="block rounded-lg px-3 py-2 text-xs text-slate-700 transition-colors hover:bg-slate-100 hover:text-navy-900 dark:text-slate-300 dark:hover:bg-navy-800 dark:hover:text-slate-100"
              >
                <span className="font-medium">
                  {index + 1}. {section.title}
                </span>
                <span className="mt-0.5 block text-[10px] text-slate-600">
                  {section.blocks.length} block{section.blocks.length === 1 ? '' : 's'}
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
  const [entries, setEntries] = useState<DocumentAccessHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await getDocumentStudioAccessHistory(artifactId, { limit: 80 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Activity</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Unified document, share-link and approval history.
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
      {error ? (
        <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : null}
      {!loading && !error && entries.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-400">
          No activity has been recorded yet.
        </div>
      ) : null}
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.entryId}
            className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-navy-700 dark:bg-navy-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-navy-900 dark:text-slate-100">{entry.action}</div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-navy-800 dark:text-slate-300">
                {entry.source}
              </span>
            </div>
            <div className="mt-1 text-slate-500 dark:text-slate-400">
              {entry.actorId} · {new Date(entry.occurredAt).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CommentsPanel({ artifactId }: { artifactId: string }): React.ReactElement {
  const { t } = useTranslation();
  const [threads, setThreads] = useState<DocumentCommentThread[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setThreads(await getDocumentStudioCommentThreads(artifactId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = async (): Promise<void> => {
    if (!draft.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      setThreads(
        await createDocumentStudioComment(artifactId, {
          body: draft.trim(),
          anchor: { kind: 'document' },
        })
      );
      setDraft('');
      toast.success(t('documentStudio.documentPanel.commentAdded', 'Comment added'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Comments</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Document-level review threads. Block anchors stay visible in each thread.
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
      <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-navy-700 dark:bg-navy-900">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add document-level review comment…"
          className="min-h-[80px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-navy-900 outline-none focus:border-c-focus-solid focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-950 dark:text-slate-100"
        />
        <div className="mt-2 flex justify-end">
          <Button type="button" size="sm" onClick={submit} disabled={submitting || !draft.trim()}>
            {submitting ? 'Adding…' : 'Add comment'}
          </Button>
        </div>
      </div>
      {error ? (
        <div className="mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : null}
      {!loading && threads.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-400">
          No comments yet.
        </div>
      ) : null}
      <ul className="space-y-2">
        {threads.map((thread) => (
          <li
            key={thread.threadId}
            className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-navy-700 dark:bg-navy-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-navy-900 dark:text-slate-100">
                {thread.root.body || 'Deleted comment'}
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-navy-800 dark:text-slate-300">
                {thread.status}
              </span>
            </div>
            <div className="mt-1 text-slate-500 dark:text-slate-400">
              {formatAuthorLabel(thread.root.authorId)} · {thread.anchor.kind}
            </div>
            {thread.replies.length > 0 ? (
              <div className="mt-2 border-l border-slate-200 pl-2 dark:border-navy-700">
                {thread.replies.length} repl{thread.replies.length === 1 ? 'y' : 'ies'}
              </div>
            ) : null}
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
      setError(err instanceof Error ? err.message : 'Failed to load share links');
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

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
      setError(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Share links</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Create scoped links. The plaintext token is shown only after creation.
        </p>
      </div>
      <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-navy-700 dark:bg-navy-900">
        <label className="mb-2 block text-xs text-slate-600 dark:text-slate-300">
          Label
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-950"
            placeholder={t('documentStudio.documentPanel.reviewNamePlaceholder', 'Client review')}
          />
        </label>
        <label className="mb-3 block text-xs text-slate-600 dark:text-slate-300">
          Scope
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as DocumentShareLinkAccessScope)}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-950"
          >
            <option value="read">Read</option>
            <option value="comment">Comment</option>
            <option value="download">
              {t('documentStudio.documentPanel.actionDownload', 'Download')}
            </option>
            <option value="edit">{t('documentStudio.documentPanel.actionEdit', 'Edit')}</option>
          </select>
        </label>
        <Button type="button" size="sm" onClick={createLink} disabled={submitting}>
          {submitting ? 'Creating…' : 'Create link'}
        </Button>
        {createdToken ? (
          <div className="mt-3 rounded-lg border border-success-500/30 bg-success-500/10 p-2 text-xs text-success-700 dark:text-emerald-300">
            Token: <span className="break-all font-mono">{createdToken}</span>
          </div>
        ) : null}
      </div>
      {error ? (
        <div className="mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : null}
      {!loading && links.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-400">
          No share links yet.
        </div>
      ) : null}
      <ul className="space-y-2">
        {links.map((link) => (
          <li
            key={link.shareLinkId}
            className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-navy-700 dark:bg-navy-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-navy-900 dark:text-slate-100">
                {link.label || link.shareLinkId}
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-navy-800 dark:text-slate-300">
                {link.runtimeStatus?.effectiveStatus ?? link.status}
              </span>
            </div>
            <div className="mt-1 text-slate-500 dark:text-slate-400">
              {link.accessScope} · used {link.consumeCount} time
              {link.consumeCount === 1 ? '' : 's'}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AudienceVariantsPanel({ artifactId }: { artifactId: string }): React.ReactElement {
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
      setError(err instanceof Error ? err.message : 'Failed to load audience variants');
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const previewVariant = async (profileId: string): Promise<void> => {
    setError(null);
    try {
      const variant = await getDocumentStudioVariant(artifactId, profileId);
      setPreview(
        `${variant.schema.title}: ${variant.provenance.sectionsKept.length} sections kept, ${variant.provenance.sectionsDropped.length} dropped, ${variant.provenance.blocksDropped} blocks dropped.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to render variant');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">
          Audience variants
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Render read-only projections for board, client, team, or custom audience profiles.
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
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-400">
          No active audience profiles are available.
        </div>
      ) : null}
      <ul className="space-y-2">
        {variants.map((variant) => (
          <li
            key={variant.profile.profileId}
            className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-navy-700 dark:bg-navy-900"
          >
            <div className="font-medium text-navy-900 dark:text-slate-100">
              {variant.profile.name}
            </div>
            <div className="mt-1 text-slate-500 dark:text-slate-400">
              {variant.profile.audienceLabels.join(', ') || 'inherits audience'} · v
              {variant.profile.version}
            </div>
            {variant.plan.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-600 dark:text-slate-300">
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
              Preview projection
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SchemaDiffPanel({ artifactId }: { artifactId: string }): React.ReactElement {
  const [result, setResult] = useState<DocumentSchemaDiffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await getDocumentStudioSchemaDiff(artifactId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schema diff');
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const changedSections =
    result?.diff.sectionDiffs.filter((section) => section.kind !== 'unchanged') ?? [];

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Schema diff</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Read-only comparison between live schema and the latest snapshot.
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
      {error ? (
        <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : null}
      {result ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-navy-700 dark:bg-navy-900">
            <div className="font-medium text-navy-900 dark:text-slate-100">{result.summary}</div>
            <div className="mt-1 text-slate-500 dark:text-slate-400">
              Baseline v{result.baseSnapshot.versionNumber} ·{' '}
              {new Date(result.baseSnapshot.capturedAt).toLocaleString()}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['Sections +', result.diff.stats.addedSectionCount],
              ['Sections Δ', result.diff.stats.modifiedSectionCount],
              ['Blocks +', result.diff.stats.addedBlockCount],
              ['Blocks Δ', result.diff.stats.modifiedBlockCount],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-200 bg-white p-2 dark:border-navy-700 dark:bg-navy-900"
              >
                <div className="text-[10px] uppercase tracking-wide text-slate-600">{label}</div>
                <div className="mt-1 font-semibold text-navy-900 dark:text-slate-100">{value}</div>
              </div>
            ))}
          </div>
          {changedSections.length === 0 ? (
            <div className="rounded-lg border border-success-500/30 bg-success-500/10 p-3 text-xs text-success-700 dark:text-emerald-300">
              Live schema matches the selected snapshot structurally.
            </div>
          ) : (
            <ul className="space-y-2">
              {changedSections.map((section) => {
                const changedBlocks = section.blockDiffs.filter(
                  (block) => block.kind !== 'unchanged'
                );
                return (
                  <li
                    key={section.sectionId}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-navy-700 dark:bg-navy-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-navy-900 dark:text-slate-100">
                        {section.afterTitle ?? section.beforeTitle ?? section.sectionId}
                      </div>
                      <span className="rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] font-medium text-primary-700 dark:text-primary-300">
                        {section.kind}
                      </span>
                    </div>
                    <div className="mt-1 text-slate-500 dark:text-slate-400">
                      {changedBlocks.length} changed block
                      {changedBlocks.length === 1 ? '' : 's'}
                    </div>
                    {changedBlocks.slice(0, 3).map((block) => (
                      <div
                        key={block.blockId}
                        className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 dark:border-navy-800 dark:bg-navy-950"
                      >
                        <div className="font-medium text-slate-600 dark:text-slate-300">
                          {block.kind} · {block.blockType ?? 'unknown'}
                        </div>
                        <div className="mt-1 line-clamp-2 text-slate-500 dark:text-slate-400">
                          {block.afterText ?? block.beforeText ?? block.blockId}
                        </div>
                      </div>
                    ))}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ManifestGatePanel(): React.ReactElement {
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
      setError(err instanceof Error ? err.message : 'Failed to validate DOC_BUILDER_MANIFEST');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Manifest gate</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Server-side validation for DOC_BUILDER_MANIFEST.
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          {loading ? 'Checking…' : 'Recheck'}
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
              {result.ok ? 'DOC_BUILDER_MANIFEST passes' : 'DOC_BUILDER_MANIFEST has violations'}
            </div>
            <div className="mt-1">
              {result.mustViolations.length} MUST · {result.shouldViolations.length} SHOULD
            </div>
          </div>
          {[...result.mustViolations, ...result.shouldViolations].length > 0 ? (
            <ul className="space-y-2">
              {[...result.mustViolations, ...result.shouldViolations].map((violation) => (
                <li
                  key={`${violation.ruleId}:${violation.message}`}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-navy-700 dark:bg-navy-900"
                >
                  <div className="font-medium text-navy-900 dark:text-slate-100">
                    {violation.ruleId} · {violation.severity.toUpperCase()}
                  </div>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">{violation.message}</p>
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
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

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
      setError('Add at least one reviewer user id.');
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
      setError(err instanceof Error ? err.message : 'Failed to request approval');
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
      setError(err instanceof Error ? err.message : 'Failed to record decision');
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
      setError(err instanceof Error ? err.message : 'Failed to cancel approval');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Approvals</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Review tickets and quorum state for this document.
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
      <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-navy-700 dark:bg-navy-900">
        <label className="mb-2 block text-xs text-slate-600 dark:text-slate-300">
          Reviewers (comma-separated user ids)
          <input
            value={participantInput}
            onChange={(event) => setParticipantInput(event.target.value)}
            placeholder="user-1,user-2"
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-950"
          />
        </label>
        <label className="mb-2 block text-xs text-slate-600 dark:text-slate-300">
          Quorum
          <select
            value={quorumPolicy}
            onChange={(event) =>
              setQuorumPolicy(event.target.value as DocumentApprovalQuorumPolicy)
            }
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-950"
          >
            <option value="single_approval">Single approval</option>
            <option value="majority">Majority</option>
            <option value="unanimous">Unanimous</option>
          </select>
        </label>
        <label className="mb-2 block text-xs text-slate-600 dark:text-slate-300">
          Reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 min-h-[64px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
          />
        </label>
        <Button type="button" size="sm" onClick={requestApproval} disabled={submitting}>
          {submitting ? 'Working…' : 'Request approval'}
        </Button>
      </div>
      <label className="mb-3 block text-xs text-slate-600 dark:text-slate-300">
        Decision comment
        <input
          value={decisionComment}
          onChange={(event) => setDecisionComment(event.target.value)}
          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-950"
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
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-400">
          No approval requests yet.
        </div>
      ) : null}
      <ul className="space-y-2">
        {approvals.map((approval) => (
          <li
            key={approval.approvalId}
            className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-navy-700 dark:bg-navy-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-navy-900 dark:text-slate-100">
                {approval.reason || approval.approvalId}
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-navy-800 dark:text-slate-300">
                {approval.status}
              </span>
            </div>
            <div className="mt-1 text-slate-500 dark:text-slate-400">
              {approval.participants.length} participants · {approval.quorumPolicy} ·{' '}
              {approval.decisions.length} decisions
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
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void submitDecision(approval.approvalId, 'request_changes')}
                  disabled={submitting}
                >
                  Request changes
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void submitDecision(approval.approvalId, 'reject')}
                  disabled={submitting}
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void cancelApproval(approval.approvalId)}
                  disabled={submitting}
                >
                  Cancel
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
      setError(err instanceof Error ? err.message : 'Failed to load content library');
    } finally {
      setLoading(false);
    }
  }, [schema.documentType, schema.language]);

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
      toast.success('Content block instantiated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to instantiate content block');
    } finally {
      setSubmitting(false);
    }
  };

  const insertBlock = async (contentBlockId: string): Promise<void> => {
    if (!targetSectionId) {
      setError('Select a target section before inserting a content block.');
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
      toast.success('Content block inserted into document');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to insert content block');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">
            Content library
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Active reusable blocks matching this document type and language.
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
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
              ? 'Inserted block read-back'
              : 'Instantiated block preview'}
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap">
            {JSON.stringify(instantiatedBlock, null, 2)}
          </pre>
        </div>
      ) : null}
      <label className="mb-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
        Insert into section
        <select
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-navy-900 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-100"
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
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-400">
          No reusable blocks match this document yet.
        </div>
      ) : null}
      <ul className="space-y-2">
        {blocks.map((block) => (
          <li
            key={block.contentBlockId}
            className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-navy-700 dark:bg-navy-900"
          >
            <div className="font-medium text-navy-900 dark:text-slate-100">{block.name}</div>
            <div className="mt-1 text-slate-500 dark:text-slate-400">
              {block.languageScope} · v{block.version} · {block.block.type}
            </div>
            {block.description ? (
              <p className="mt-2 text-slate-600 dark:text-slate-300">{block.description}</p>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => void instantiateBlock(block.contentBlockId)}
              disabled={submitting}
            >
              Instantiate preview
            </Button>
            <Button
              type="button"
              size="sm"
              className="ml-2 mt-2"
              onClick={() => void insertBlock(block.contentBlockId)}
              disabled={submitting || !targetSectionId}
            >
              Insert into document
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
  return (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      <div className="mb-3 rounded-lg border border-primary-500/20 bg-primary-500/5 p-3">
        <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Teresa</h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          AI document co-editor. Use source/methodology prompts here for governed proposal flows;
          all changes still require review and approval before execution.
        </p>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Zaznacz tekst w dokumencie, aby poprawić go z pomocą Teresy.
      </p>
    </div>
  );
}

export const DocumentStudioDocumentPanel: React.FC<DocumentStudioDocumentPanelProps> = ({
  artifactId,
  schema,
  onStartOver,
  onSchemaUpdated,
}) => {
  const [exporting, setExporting] = useState<'markdown' | 'docx' | 'pdf' | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
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
      if (!options.qaOverride) setQaBlock(null);
      try {
        const payload = await exportDocumentStudioArtifact(artifactId, format, {
          qaOverride: options.qaOverride === true,
        });
        const manifest = (payload.manifest ?? {}) as Record<string, unknown>;
        const pending = manifest.pendingRendering as string | undefined;
        const pendingNote = manifest.pendingRenderingNote as string | undefined;

        if (typeof payload.contentBase64 === 'string' && payload.contentBase64.length > 0) {
          triggerBinaryDownload(payload.filename, payload.contentBase64, mimeForFormat(format));
          if (manifest.qaOverride === true) {
            setExportNote(
              'Exported with QA override. The override has been recorded in the audit trail.'
            );
          }
          setQaBlock(null);
          return;
        }
        if (typeof payload.contentText === 'string' && payload.contentText.length > 0) {
          triggerTextDownload(payload.filename, payload.contentText, mimeForFormat(format));
          if (pending) {
            // Backwards-compatible fallback: if a deployment still returns the
            // pending tag, surface its note rather than failing silently.
            setExportNote(
              pendingNote ??
                `${format.toUpperCase()} export is pending finalization. Markdown is available now.`
            );
          }
          if (manifest.qaOverride === true) {
            setExportNote(
              'Exported with QA override. The override has been recorded in the audit trail.'
            );
          }
          setQaBlock(null);
          return;
        }
        setExportNote('Export returned no content.');
      } catch (err) {
        if (err instanceof QaBlockingError) {
          setQaBlock({ format, report: err.report });
          setExportError(
            'Export blocked by Quality QA. Resolve the findings below or use the audited override.'
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
              'You are not authorized to override the export QA gate. Ask a privileged reviewer.'
          );
          return;
        }
        setExportError(err instanceof Error ? err.message : 'Export failed');
      } finally {
        setExporting(null);
      }
    },
    [artifactId]
  );

  const handleOpenBuilder = async (): Promise<void> => {
    if (!tableSourceRef?.sourceId) {
      setExportNote('No sheet/table source is attached to this document.');
      return;
    }
    setOpeningBuilder(true);
    setExportError(null);
    try {
      const workspaceId = await resolveTablePlatformWorkspaceIdForTable(tableSourceRef.sourceId);
      if (!workspaceId) {
        setExportError('Could not resolve workspace for the linked table source.');
        return;
      }
      const targetPath = buildMyWorkSheetTableOpenPath(workspaceId, tableSourceRef.sourceId);
      toast.success('Opening sheets builder lane…');
      window.location.assign(targetPath);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to open sheets builder');
    } finally {
      setOpeningBuilder(false);
    }
  };

  const topBarChips = useMemo<TopBarChipDescriptor[]>(
    () => [
      {
        id: 'history',
        label: 'History',
        icon: History,
        tooltip: 'Open the unified activity feed from the right rail.',
      },
      {
        id: 'qa',
        label: qaBlock ? 'QA blocked' : 'QA',
        icon: ShieldCheck,
        dotTone: qaBlock ? 'danger' : 'success',
        tooltip: 'Open the QA panel from the right rail.',
      },
      {
        id: 'governance',
        label: policy?.canOverrideQa ? 'Override allowed' : 'Governance',
        icon: FileWarning,
        dotTone: policy?.canOverrideQa ? 'warning' : 'neutral',
        tooltip: 'Export governance policy for this user.',
      },
      {
        id: 'share',
        label: 'Share',
        icon: Share2,
        tooltip: 'Open share-link management from the right rail.',
      },
      {
        id: 'agent',
        label: 'AI Editor',
        icon: Bot,
        tooltip: 'Open Teresa from the right rail.',
      },
      {
        id: 'run',
        label: exporting ? 'Exporting' : 'Export DOCX',
        icon: Download,
        kind: 'primary',
        disabled: exporting !== null,
        onClick: () => void handleExport('docx'),
      },
    ],
    [exporting, handleExport, policy?.canOverrideQa, qaBlock]
  );

  const rightRailTools = useMemo<RightRailToolDescriptor[]>(
    () => [
      {
        id: 'sources',
        label: 'Sources',
        icon: FileText,
        badge: sourceCount > 0 ? sourceCount : undefined,
        dotTone: assumptionCount > 0 ? 'warning' : sourceCount > 0 ? 'success' : 'warning',
      },
      {
        id: 'properties',
        label: 'Properties',
        icon: Table2,
      },
      {
        id: 'activity',
        label: 'Activity',
        icon: History,
      },
      {
        id: 'diff',
        label: 'Schema diff',
        icon: FileWarning,
      },
      {
        id: 'variants',
        label: 'Audience variants',
        icon: Users,
      },
      {
        id: 'comments',
        label: 'Comments',
        icon: MessageSquare,
      },
      {
        id: 'share',
        label: 'Share links',
        icon: Share2,
      },
      {
        id: 'approvals',
        label: 'Approvals',
        icon: ShieldCheck,
      },
      {
        id: 'manifest',
        label: 'Manifest gate',
        icon: ShieldCheck,
      },
      {
        id: 'library',
        label: 'Content library',
        icon: FileText,
      },
      {
        id: 'qa',
        label: 'Quality QA',
        icon: ShieldCheck,
        dotTone: qaBlock ? 'danger' : null,
      },
      {
        id: 'teresa',
        label: 'Teresa',
        icon: Bot,
      },
      {
        id: 'editor',
        label: 'AI Editor',
        icon: Sparkles,
      },
    ],
    [assumptionCount, qaBlock, sourceCount]
  );

  const renderRightRailPanel = (activeToolId: string | null): React.ReactNode => {
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
    if (activeToolId === 'activity') {
      return <ActivityPanel artifactId={artifactId} />;
    }
    if (activeToolId === 'diff') {
      return <SchemaDiffPanel artifactId={artifactId} />;
    }
    if (activeToolId === 'comments') {
      return <CommentsPanel artifactId={artifactId} />;
    }
    if (activeToolId === 'share') {
      return <ShareLinksPanel artifactId={artifactId} />;
    }
    if (activeToolId === 'variants') {
      return <AudienceVariantsPanel artifactId={artifactId} />;
    }
    if (activeToolId === 'approvals') {
      return <ApprovalsPanel artifactId={artifactId} />;
    }
    if (activeToolId === 'manifest') {
      return <ManifestGatePanel />;
    }
    if (activeToolId === 'library') {
      return (
        <ContentLibraryPanel
          artifactId={artifactId}
          schema={schema}
          onSchemaUpdated={onSchemaUpdated}
        />
      );
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
    if (activeToolId === 'editor') {
      return (
        <div className="h-full overflow-y-auto p-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Zaznacz tekst w dokumencie, aby poprawić go z pomocą Teresy.
          </p>
        </div>
      );
    }
    return null;
  };

  const canvas = (
    <div className="flex min-h-full flex-col">
      {(exportNote || exportError || qaBlock) && (
        <div className="space-y-3 px-6 pt-4">
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
                  QA blocked the {qaBlock.format.toUpperCase()} export
                </span>
                <span className="rounded-full bg-danger-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger-700 dark:text-danger-300">
                  {qaBlock.report.categories.filter((c) => c.blocking).length} blocking categor
                  {qaBlock.report.categories.filter((c) => c.blocking).length === 1 ? 'y' : 'ies'}
                </span>
              </div>
              <ul className="mb-2 space-y-1 text-slate-700 dark:text-slate-200">
                {qaBlock.report.categories
                  .filter((c) => c.blocking)
                  .map((c) => (
                    <li key={c.category}>
                      <span className="font-medium uppercase tracking-wide">{c.category}</span>
                      <span className="ml-2 text-slate-500 dark:text-slate-400">
                        score {c.score}/100 · {c.findings.length} finding
                        {c.findings.length === 1 ? '' : 's'}
                      </span>
                    </li>
                  ))}
              </ul>
              <p className="mb-2 text-slate-600 dark:text-slate-300">
                Resolve the findings in the QA panel, or proceed with an audited override if the
                export is time-critical and you accept the risk.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setQaBlock(null)}
                  disabled={exporting !== null}
                >
                  Dismiss
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
                      Override and export (audited)
                    </span>
                  </Button>
                ) : (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Override requires admin or manager role
                    {policy?.role ? ` — your role: ${policy.role}` : ''}.
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-3 overflow-y-auto p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-navy-700 dark:bg-navy-900">
          <div>
            <h2 className="text-sm font-semibold text-navy-900 dark:text-slate-100">
              Document preview
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
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
                Open in Sheets Builder
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
                Start over
              </span>
            </Button>
          </div>
        </div>
        <DocumentTipTapEditor schema={schema} onSchemaUpdated={onSchemaUpdated} editable artifactId={artifactId} />
      </div>
    </div>
  );

  return (
    <ExecutiveModuleShell
      moduleKey="document-studio"
      moduleLabel="Document Studio"
      title={schema.title}
      onBack={onStartOver}
      backLabel="Start over"
      topBarChips={topBarChips}
      presenceSlot={
        <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
          <div>
            {schema.language.toUpperCase()} · {schema.confidentiality}
          </div>
          <div>
            {sourceCount} sources
            {assumptionCount > 0 ? ` · ${assumptionCount} assumptions` : ''}
          </div>
        </div>
      }
      leftRailTitle="Outline"
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
