import { getArtifactPath } from '@/utils/artifactLinks';

import type { ArtifactGovernanceSummary, TemplateType } from './types';

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
  if (params.kind === 'sheet') return getArtifactPath('sheet', id);
  return null;
}

export function resolveTemplateUsePath(templateId: string, templateType: TemplateType): string {
  const routeMap: Record<TemplateType, string> = {
    report: '/wordy',
    sheet: '/excele',
    presentation: '/prezentacje',
  };
  const base = routeMap[templateType] || '/wordy';
  return `${base}?templateArtifactId=${encodeURIComponent(templateId)}`;
}

export function resolveTemplateEditPath(templateId: string, templateType: TemplateType): string {
  if (templateType === 'presentation') {
    return `/presentations/wizard?templateArtifactId=${encodeURIComponent(templateId)}&edit=true`;
  }
  return `/reports/builder?tab=templates&templateArtifactId=${encodeURIComponent(templateId)}&edit=true`;
}

export function resolveTemplateClonePath(templateId: string, templateType: TemplateType): string {
  if (templateType === 'presentation') {
    return `/presentations/wizard?cloneTemplateArtifactId=${encodeURIComponent(templateId)}`;
  }
  return `/reports/builder?new=true&templateArtifactId=${encodeURIComponent(templateId)}`;
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
