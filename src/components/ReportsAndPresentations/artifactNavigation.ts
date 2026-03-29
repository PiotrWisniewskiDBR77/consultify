import type { ArtifactGovernanceSummary } from './types';

type ArtifactNavigationKind = 'document' | 'presentation' | 'sheet';

export function resolveArtifactOpenPath(params: {
  kind: ArtifactNavigationKind;
  originRecordId: string;
  governance?: ArtifactGovernanceSummary | null;
}): string | null {
  const explicitOpenPath = String(params.governance?.openPath || '').trim();
  if (explicitOpenPath) return explicitOpenPath;

  if (params.kind === 'document') return `/reports/builder/${params.originRecordId}`;
  if (params.kind === 'presentation') return `/presentations/builder/${params.originRecordId}`;
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
