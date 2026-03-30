import { getArtifactPath } from '@/utils/artifactLinks';

import type { ArtifactGovernanceSummary } from './types';

type ArtifactNavigationKind = 'document' | 'presentation' | 'sheet';

export function resolveArtifactOpenPath(params: {
  kind: ArtifactNavigationKind;
  originRecordId: string;
  governance?: ArtifactGovernanceSummary | null;
}): string | null {
  const explicitOpenPath = String(params.governance?.openPath || '').trim();
  if (explicitOpenPath) return explicitOpenPath;

  const id = String(params.originRecordId || '').trim();
  if (!id) return null;

  // Same primary URL as deep links / chat (getArtifactPath) — preview “Open” must not fork truth.
  if (params.kind === 'document') return getArtifactPath('report', id);
  if (params.kind === 'presentation') return getArtifactPath('presentation', id);
  return null;
}

export function appendArtifactOpenAction(path: string | null, action: string): string | null {
  const normalizedPath = String(path || '').trim();
  const normalizedAction = String(action || '').trim();
  if (!normalizedPath || !normalizedAction) return normalizedPath || null;

  const [base, query = ''] = normalizedPath.split('?');
  const params = new URLSearchParams(query);
  params.set('action', normalizedAction);
  const serialized = params.toString();

  return serialized ? `${base}?${serialized}` : base;
}
