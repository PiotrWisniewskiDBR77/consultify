/**
 * DOC-0 etap 2a (DEC-593) — the standalone screen behind `/documents/:artifactId`.
 *
 * Etap 1 mounted `DocumentViewer` as a full-screen overlay inside the Materials
 * list, so the header ("name · status") and Properties came from the clicked row.
 * A deep link (chat, e-mail, browser history) carries only the artifact id, so
 * here they come from the EXISTING registry read model:
 *   GET /api/artifacts/:id            → resolvedTitle · originStatus · ownerName · lastTransitionAt · originRecordId
 *   GET /api/artifacts/:id/action-target → the server's own open path (`buildActionTargetPayload`,
 *                                        the same call the list row is mapped from, so "Edit"
 *                                        here goes exactly where "Edit" in the list goes)
 * No new endpoint and no `server/**` change. Document content stays owned by
 * `documentContentResolver`; this component only supplies its inputs.
 *
 * D-102 (Wpis 134): the artifact read is the EXISTENCE authority. A 404 means the
 * deep link is dead (the document was removed) — the user must be told the link is
 * stale, NOT shown the same blank header as a transient fault. Any other failure
 * (5xx, network) is retryable, so it gets a "Try again" affordance instead. Before
 * this, `loadDocumentMeta` swallowed every error to `null` and both cases rendered
 * an identical empty viewer, leaving the user unable to tell a dead link from a
 * hiccup.
 *
 * D-125 (DEC-681): the artifact registry is NOT the only home for an id that can
 * reach `/documents/:id`. Context documents (uploads behind `GET /api/documents`)
 * live in a disjoint read model and are NEVER backfilled into the registry (the
 * lazy `ensureBackfilledOutputsForOrg` covers report/presentation/sheet outputs
 * only), so their ids 404 here even though the documents exist — the viewer then
 * lied "This document no longer exists". Now an artifact 404 falls through to
 * `GET /api/documents/:id`: a 200 renders an HONEST context-file view (name, MIME
 * type, owner, date, download) under an explicit "Context file — not an artifact"
 * label; the 404 authority ("no longer exists") survives ONLY when neither the
 * artifact nor the context document exists. No new endpoint, no `server/**` change.
 */
import { FileText } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { DocumentViewer } from '@/components/documents/DocumentViewer';
import type { ArtifactNavigationKind } from '@/components/ReportsAndPresentations/artifactNavigation';
import {
  buildDocumentViewerListPath,
  resolveArtifactOpenPath,
} from '@/components/ReportsAndPresentations/artifactNavigation';
import { formatDateTime } from '@/components/MyWork/Decision/workspaceHelpers';
import { Api, API_URL } from '@/services/api';

/** Document status keys of the registry read model, same vocabulary as the list row. */
const DOCUMENT_STATUS_KEYS = [
  'draft',
  'generated',
  'editing',
  'ready',
  'exported',
  'shared',
  'archived',
] as const;

interface DocumentHeaderMeta {
  title: string | null;
  kind: Extract<ArtifactNavigationKind, 'document' | 'presentation'>;
  statusKey: string | null;
  ownerName: string | null;
  updatedAt: string | null;
  originRecordId: string | null;
  openPath: string | null;
}

/**
 * D-125: metadata of a CONTEXT upload (`GET /api/documents/:id`), a read model
 * disjoint from the artifact registry. Only the honest fields the order names:
 * name, MIME type, owner, date. `downloadPath` is built from the existing
 * `GET /api/documents/:id/download` endpoint (no new server surface).
 */
interface ContextDocumentMeta {
  name: string | null;
  mimeType: string | null;
  ownerName: string | null;
  updatedAt: string | null;
  downloadPath: string;
}

type MetaState =
  | { phase: 'loading' }
  | { phase: 'settled'; meta: DocumentHeaderMeta }
  | { phase: 'context-document'; doc: ContextDocumentMeta }
  | { phase: 'not-found' }
  | { phase: 'error' };

type MetaResult =
  | { kind: 'ok'; meta: DocumentHeaderMeta }
  | { kind: 'context-document'; doc: ContextDocumentMeta }
  | { kind: 'not-found' }
  | { kind: 'error' };

/** `Api.get` answers with the axios response; the registry wraps its payload in `{ data }`. */
function unwrapBody(response: unknown): Record<string, unknown> | null {
  const body = (response as { data?: unknown } | null)?.data;
  if (!body || typeof body !== 'object') return null;
  const nested = (body as { data?: unknown }).data;
  if (nested && typeof nested === 'object') return nested as Record<string, unknown>;
  return body as Record<string, unknown>;
}

const text = (value: unknown): string | null => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
};

function resolveViewerKind(
  artifact: Record<string, unknown>,
  actionTarget: Record<string, unknown>
): Extract<ArtifactNavigationKind, 'document' | 'presentation'> {
  const raw = [
    text(artifact.outputType),
    text(artifact.artifactFamily),
    text(artifact.kind),
    text(actionTarget.kind),
    text(actionTarget.originRuntime),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return raw.includes('presentation') ? 'presentation' : 'document';
}

/**
 * HTTP status off a thrown `ApiError` (`.status`) or an axios-like error
 * (`.response.status`). A bare network fault carries neither → `undefined`, which
 * the caller treats as transient (retryable), never as "does not exist".
 */
function readStatus(error: unknown): number | undefined {
  const candidate = (error as { status?: unknown; response?: { status?: unknown } } | null) ?? {};
  const raw = candidate.status ?? candidate.response?.status;
  const status = Number(raw);
  return Number.isFinite(status) && status > 0 ? status : undefined;
}

/**
 * D-125 (DEC-681): the second existence authority. Called ONLY after the artifact
 * registry answers 404. `GET /api/documents/:id` returns the context-upload record
 * directly (not wrapped in `{ data }`), which `unwrapBody` passes through. A 404
 * here too means the id resolves in neither read model → the link is genuinely
 * dead; any other failure is transient and stays retryable.
 */
async function loadContextDocument(artifactId: string): Promise<MetaResult> {
  const docOutcome = await Api.get(`/documents/${encodeURIComponent(artifactId)}`)
    .then((response) => ({ ok: true as const, response }))
    .catch((error: unknown) => ({ ok: false as const, status: readStatus(error) }));

  if (!docOutcome.ok) {
    return docOutcome.status === 404 ? { kind: 'not-found' } : { kind: 'error' };
  }

  const doc = unwrapBody(docOutcome.response) || {};
  return {
    kind: 'context-document',
    doc: {
      name: text(doc.originalName) || text(doc.filename),
      mimeType: text(doc.mimeType),
      ownerName: text(doc.ownerName),
      updatedAt: text(doc.updatedAt) || text(doc.createdAt),
      downloadPath: `${API_URL}/documents/${encodeURIComponent(artifactId)}/download`,
    },
  };
}

async function loadDocumentMeta(artifactId: string): Promise<MetaResult> {
  const path = `/artifacts/${encodeURIComponent(artifactId)}`;
  // Both reads still fire in parallel (the loading state and the "exactly two
  // reads" contract depend on it); only the artifact read's failure is classified.
  const [artifactOutcome, actionTargetResponse] = await Promise.all([
    Api.get(path)
      .then((response) => ({ ok: true as const, response }))
      .catch((error: unknown) => ({ ok: false as const, status: readStatus(error) })),
    Api.get(`${path}/action-target`).catch(() => null),
  ]);

  if (!artifactOutcome.ok) {
    // A transient artifact failure stays retryable; only a 404 falls through to
    // the context-document read model (D-125), which decides not-found vs. honest.
    return artifactOutcome.status === 404
      ? loadContextDocument(artifactId)
      : { kind: 'error' };
  }

  const artifact = unwrapBody(artifactOutcome.response) || {};
  const actionTarget = unwrapBody(actionTargetResponse) || {};
  // `deliveryState` is the registry's own vocabulary (draft/ready/shared/archived/…);
  // `originStatus` for a `report` runtime carries the Report Builder vocabulary
  // (GENERATED/APPROVED/CONFIGURING), which has no label here — hence the order.
  const statusKey =
    text(artifact.deliveryState) || text(actionTarget.originStatus) || text(artifact.originStatus);
  return {
    kind: 'ok',
    meta: {
      title: text(artifact.resolvedTitle),
      kind: resolveViewerKind(artifact, actionTarget),
      statusKey: statusKey ? statusKey.toLowerCase() : null,
      ownerName: text(artifact.ownerName),
      updatedAt: text(artifact.lastTransitionAt),
      originRecordId: text(artifact.originRecordId) || text(actionTarget.originRecordId),
      openPath: text(actionTarget.openPath),
    },
  };
}

const STATE_BOX =
  'rounded-xl border border-c-border-subtle bg-c-surface p-6 text-sm text-c-text-secondary';
const STATE_BUTTON =
  'rounded-lg border border-c-border px-3 py-2 text-sm text-c-text hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

export const DocumentViewerPage: React.FC<{ artifactId: string }> = ({ artifactId }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  /** DEC-461: PL key + EN default — the viewer's own namespace, extended here. */
  const tr = useCallback(
    (key: string, en: string, opts?: Record<string, unknown>) =>
      t(`documents.viewer.${key}`, en, opts),
    [t]
  );

  const [state, setState] = useState<MetaState>({ phase: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ phase: 'loading' });
    void loadDocumentMeta(artifactId).then((result) => {
      if (cancelled) return;
      if (result.kind === 'ok') setState({ phase: 'settled', meta: result.meta });
      else if (result.kind === 'context-document')
        setState({ phase: 'context-document', doc: result.doc });
      else if (result.kind === 'not-found') setState({ phase: 'not-found' });
      else setState({ phase: 'error' });
    });
    return () => {
      cancelled = true;
    };
  }, [artifactId, reloadToken]);

  const meta = state.phase === 'settled' ? state.meta : null;

  const statusLabel = useMemo(() => {
    const key = meta?.statusKey || '';
    return (DOCUMENT_STATUS_KEYS as readonly string[]).includes(key)
      ? tr(`statusLabel.${key}`, key)
      : null;
  }, [meta, tr]);

  const backToList = useCallback(() => {
    navigate(buildDocumentViewerListPath(artifactId, meta?.kind || 'document'));
  }, [artifactId, navigate]);

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  const openEditor = useCallback(() => {
    if (meta?.openPath) {
      navigate(meta.openPath);
      return;
    }
    const originRecordId = meta?.originRecordId || '';
    if (!originRecordId) return;
    const path = resolveArtifactOpenPath({ kind: 'document', originRecordId });
    if (path) navigate(path);
  }, [meta, navigate]);

  if (state.phase === 'loading') {
    return (
      <div className="p-6">
        <div className={STATE_BOX} data-testid="doc0-page-loading">
          {tr('loading', 'Loading the document…')}
        </div>
      </div>
    );
  }

  if (state.phase === 'not-found') {
    return (
      <div className="p-6">
        <div className={STATE_BOX} data-testid="doc0-page-not-found">
          <p>{tr('pageNotFound', 'This document no longer exists. The link may be out of date.')}</p>
          <button type="button" className={`${STATE_BUTTON} mt-4`} onClick={backToList}>
            {tr('backToList', 'Back to documents')}
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="p-6">
        <div className={STATE_BOX} data-testid="doc0-page-error">
          <p>
            {tr(
              'pageLoadError',
              'The document could not be loaded. Check your connection and try again.'
            )}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className={STATE_BUTTON}
              data-testid="doc0-page-retry"
              onClick={retry}
            >
              {tr('retry', 'Try again')}
            </button>
            <button type="button" className={STATE_BUTTON} onClick={backToList}>
              {tr('backToList', 'Back to documents')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'context-document') {
    const doc = state.doc;
    const locale = i18n.language === 'pl' ? 'pl-PL' : 'en-GB';
    const rows: Array<{ id: string; label: string; value: string | null }> = [
      { id: 'type', label: tr('fileType', 'File type'), value: doc.mimeType },
      { id: 'owner', label: tr('owner', 'Owner'), value: doc.ownerName },
      {
        id: 'updated',
        label: tr('updated', 'Updated'),
        value: doc.updatedAt ? formatDateTime(doc.updatedAt, locale) : null,
      },
    ];
    return (
      <div className="p-6">
        <div
          className={`${STATE_BOX} max-w-2xl`}
          data-testid="doc0-page-context-document"
          aria-label={tr('contextFilePanelAriaLabel', 'Context file details')}
        >
          <span
            className="inline-flex items-center rounded-full border border-c-border bg-c-surface-raised px-2.5 py-1 text-xs font-medium text-c-text-secondary"
            data-testid="doc0-context-badge"
          >
            {tr('contextFileBadge', 'Context file — not an artifact')}
          </span>
          <h2
            className="mt-4 flex items-center gap-2 text-base font-semibold text-c-text"
            data-testid="doc0-context-name"
          >
            <FileText className="h-4 w-4 shrink-0 text-c-text-secondary" aria-hidden="true" />
            <span className="break-all">{doc.name || tr('untitled', 'Document')}</span>
          </h2>
          <dl className="mt-4 divide-y divide-c-border-subtle border-y border-c-border-subtle">
            {rows.map((row) => (
              <div key={row.id} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-c-text-secondary">{row.label}</dt>
                <dd
                  className="text-right text-c-text"
                  data-testid={`doc0-context-${row.id}`}
                >
                  {row.value?.trim() || '—'}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex gap-2">
            <a
              className={STATE_BUTTON}
              href={doc.downloadPath}
              data-testid="doc0-context-download"
              download
            >
              {tr('download', 'Download')}
            </a>
            <button type="button" className={STATE_BUTTON} onClick={backToList}>
              {tr('backToList', 'Back to documents')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // The four early returns above narrow `state` to the settled variant, so
  // `state.meta` is non-null here even though the `meta` alias stays nullable.
  const settledMeta = state.meta;

  return (
    <DocumentViewer
      artifactId={artifactId}
      kind={settledMeta.kind}
      originRecordId={settledMeta.originRecordId}
      title={settledMeta.title}
      statusLabel={statusLabel}
      ownerName={settledMeta.ownerName}
      updatedAt={settledMeta.updatedAt ? formatDateTime(settledMeta.updatedAt, i18n.language === 'pl' ? 'pl-PL' : 'en-GB') : null}
      onClose={backToList}
      onEdit={settledMeta.openPath || settledMeta.originRecordId ? openEditor : undefined}
    />
  );
};

export default DocumentViewerPage;
