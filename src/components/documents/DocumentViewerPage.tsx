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

type MetaState = { phase: 'loading' } | { phase: 'settled'; meta: DocumentHeaderMeta };

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

async function loadDocumentMeta(artifactId: string): Promise<DocumentHeaderMeta> {
  const path = `/artifacts/${encodeURIComponent(artifactId)}`;
  const [artifactResponse, actionTargetResponse] = await Promise.all([
    Api.get(path).catch(() => null),
    Api.get(`${path}/action-target`).catch(() => null),
  ]);
  const artifact = unwrapBody(artifactResponse) || {};
  const actionTarget = unwrapBody(actionTargetResponse) || {};
  // `deliveryState` is the registry's own vocabulary (draft/ready/shared/archived/…);
  // `originStatus` for a `report` runtime carries the Report Builder vocabulary
  // (GENERATED/APPROVED/CONFIGURING), which has no label here — hence the order.
  const statusKey =
    text(artifact.deliveryState) || text(actionTarget.originStatus) || text(artifact.originStatus);
  return {
    title: text(artifact.resolvedTitle),
    statusKey: statusKey ? statusKey.toLowerCase() : null,
    ownerName: text(artifact.ownerName),
    updatedAt: text(artifact.lastTransitionAt),
    originRecordId: text(artifact.originRecordId) || text(actionTarget.originRecordId),
    openPath: text(actionTarget.openPath),
  };
}

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

  useEffect(() => {
    let cancelled = false;
    setState({ phase: 'loading' });
    void loadDocumentMeta(artifactId).then((meta) => {
      if (!cancelled) setState({ phase: 'settled', meta });
    });
    return () => {
      cancelled = true;
    };
  }, [artifactId]);

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

  if (!meta) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-c-border-subtle bg-c-surface p-6 text-sm text-c-text-secondary">
          {tr('loading', 'Loading the document…')}
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
