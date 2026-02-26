export type ArtifactType =
  | 'decision'
  | 'initiative'
  | 'task'
  | 'notification'
  | 'report'
  | 'assessment'
  | 'tool'
  | 'insight'
  | 'project'
  | 'risk'
  | 'external'
  | 'idea';

export type ParsedArtifactRef = {
  type: ArtifactType;
  id: string;
};

const ARTIFACT_PREFIX: Record<ArtifactType, string> = {
  decision: 'DEC',
  initiative: 'INI',
  task: 'TSK',
  notification: 'NTF',
  report: 'RPT',
  assessment: 'ASM',
  tool: 'TOL',
  insight: 'INS',
  project: 'PRJ',
  risk: 'RSK',
  external: 'EXT',
  idea: 'IDE',
};

function normalizeId(rawId: string): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleaned) return 'UNKNOWN';
  return cleaned.length > 12 ? cleaned.slice(0, 12) : cleaned;
}

function getBasePath(type: ArtifactType, id: string): string {
  switch (type) {
    case 'task':
    case 'decision':
    case 'notification':
      return '/my-work';
    case 'initiative':
      return '/initiatives';
    case 'project':
      return `/projects/${id}`;
    case 'report':
      return `/reports/builder/${id}`;
    case 'assessment':
      return '/assessment';
    case 'tool':
      return '/discovery-tools/strategic';
    case 'insight':
      return '/interview';
    case 'risk':
      return '/my-work';
    case 'idea':
      return '/my-work';
    case 'external':
    default:
      return '/my-work';
  }
}

export function buildArtifactCode(type: ArtifactType, id: string): string {
  const prefix = ARTIFACT_PREFIX[type] || 'ART';
  return `${prefix}-${normalizeId(id).toUpperCase()}`;
}

export function buildArtifactRef(type: ArtifactType, id: string): string {
  return `${type}:${String(id)}`;
}

export function parseArtifactRef(value: string | null | undefined): ParsedArtifactRef | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const separatorIndex = raw.indexOf(':');
  if (separatorIndex <= 0) return null;
  const type = raw.slice(0, separatorIndex).trim().toLowerCase() as ArtifactType;
  const id = raw.slice(separatorIndex + 1).trim();
  if (!id) return null;
  return { type, id };
}

export function buildArtifactPermalink(type: ArtifactType, id: string): string {
  const safeId = String(id);
  const code = buildArtifactCode(type, safeId);
  const ref = buildArtifactRef(type, safeId);
  const basePath = getBasePath(type, safeId);
  const origin = window.location.origin;
  const params = new URLSearchParams({
    artifact: ref,
    code,
  });
  return `${origin}${basePath}?${params.toString()}`;
}
