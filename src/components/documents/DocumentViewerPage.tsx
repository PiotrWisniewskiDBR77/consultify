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
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { DocumentViewer } from '@/components/documents/DocumentViewer';
import {
  buildDocumentViewerListPath,
  resolveArtifactOpenPath,
} from '@/components/ReportsAndPresentations/artifactNavigation';
import { formatDateTime } from '@/components/MyWork/Decision/workspaceHelpers';
import { Api } from '@/services/api';

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
  statusKey: string | null;
  ownerName: string | null;
  updatedAt: string | null;
  originRecordId: string | null;
  openPath: string | null;
}

type MetaState =
  | { phase: 'loading' }
  | { phase: 'settled'; meta: DocumentHeaderMeta }
  | { phase: 'not-found' }
  | { phase: 'error' };

type MetaResult =
  | { kind: 'ok'; meta: DocumentHeaderMeta }
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
    return artifactOutcome.status === 404 ? { kind: 'not-found' } : { kind: 'error' };
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
    navigate(buildDocumentViewerListPath(artifactId));
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

  return (
    <DocumentViewer
      artifactId={artifactId}
      originRecordId={meta.originRecordId}
      title={meta.title}
      statusLabel={statusLabel}
      ownerName={meta.ownerName}
      updatedAt={meta.updatedAt ? formatDateTime(meta.updatedAt, i18n.language === 'pl' ? 'pl-PL' : 'en-GB') : null}
      onClose={backToList}
      onEdit={meta.openPath || meta.originRecordId ? openEditor : undefined}
    />
  );
};

export default DocumentViewerPage;
