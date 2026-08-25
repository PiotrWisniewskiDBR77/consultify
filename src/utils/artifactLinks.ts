// ── V5-IDEA-31: Unified artifact identity contract ──────────────────────────

export type ArtifactType =
  | 'decision'
  | 'initiative'
  | 'task'
  | 'process'
  | 'role'
  | 'system'
  | 'kpi'
  | 'tool_session'
  | 'notification'
  | 'report'
  | 'assessment'
  | 'tool'
  | 'insight'
  | 'project'
  | 'risk'
  | 'external'
  | 'idea'
  | 'notebook'
  | 'presentation'
  | 'sheet'
  | 'meeting'
  | 'financial_model'
  | 'budget'
  | 'valuation'
  | 'analysis'
  | 'knowledge';

/**
 * Canonical artifact reference — the universal way to point to any artifact.
 * Replaces `ParsedArtifactRef` as the canonical shared type.
 */
export type ArtifactRef = {
  type: ArtifactType;
  id: string;
};

/** @deprecated Use ArtifactRef instead */
export type ParsedArtifactRef = ArtifactRef;

/** Human-readable artifact index code (e.g. "DEC-041", "INIT-024") */
export type ArtifactIndex = string;

/**
 * V5 Artifact Identity Map — canonical icon, accent, and label per type.
 * Source of truth for all UI rendering of artifact badges, chips, previews.
 */
export interface ArtifactIdentity {
  icon: string;
  accent: string;
  labelEn: string;
  labelPl: string;
  prefix: string;
}

export const ARTIFACT_IDENTITY: Record<ArtifactType, ArtifactIdentity> = {
  initiative: {
    icon: 'Rocket',
    accent: 'blue',
    labelEn: 'Initiative',
    labelPl: 'Inicjatywa',
    prefix: 'INIT',
  },
  idea: { icon: 'Lightbulb', accent: 'violet', labelEn: 'Idea', labelPl: 'Pomysł', prefix: 'IDEA' },
  task: {
    icon: 'CheckSquare',
    accent: 'emerald',
    labelEn: 'Task',
    labelPl: 'Zadanie',
    prefix: 'TASK',
  },
  process: {
    icon: 'Workflow',
    accent: 'sky',
    labelEn: 'Process',
    labelPl: 'Proces',
    prefix: 'PROC',
  },
  role: {
    icon: 'UserSquare2',
    accent: 'violet',
    labelEn: 'Role',
    labelPl: 'Rola',
    prefix: 'ROLE',
  },
  system: {
    icon: 'Server',
    accent: 'cyan',
    labelEn: 'System',
    labelPl: 'System',
    prefix: 'SYS',
  },
  kpi: {
    icon: 'Gauge',
    accent: 'amber',
    labelEn: 'KPI',
    labelPl: 'KPI',
    prefix: 'KPI',
  },
  tool_session: {
    icon: 'BriefcaseBusiness',
    accent: 'indigo',
    labelEn: 'Tool Session',
    labelPl: 'Sesja narzędzia',
    prefix: 'TS',
  },
  decision: {
    icon: 'Scale',
    accent: 'amber',
    labelEn: 'Decision',
    labelPl: 'Decyzja',
    prefix: 'DEC',
  },
  notebook: {
    icon: 'BookOpen',
    accent: 'indigo',
    labelEn: 'Notebook',
    labelPl: 'Notatnik',
    prefix: 'NOTE',
  },
  tool: {
    icon: 'Wrench',
    accent: 'emerald',
    labelEn: 'Tool',
    labelPl: 'Narzędzie',
    prefix: 'TOOL',
  },
  assessment: {
    icon: 'CheckCircle2',
    accent: 'cyan',
    labelEn: 'Assessment',
    labelPl: 'Ocena',
    prefix: 'ASM',
  },
  report: {
    icon: 'FileBarChart2',
    accent: 'slate',
    labelEn: 'Report',
    labelPl: 'Raport',
    prefix: 'REP',
  },
  presentation: {
    icon: 'Presentation',
    accent: 'fuchsia',
    labelEn: 'Presentation',
    labelPl: 'Prezentacja',
    prefix: 'DECK',
  },
  sheet: {
    icon: 'FileSpreadsheet',
    accent: 'emerald',
    labelEn: 'Sheet',
    labelPl: 'Arkusz',
    prefix: 'SHT',
  },
  meeting: {
    icon: 'CalendarDays',
    accent: 'sky',
    labelEn: 'Meeting',
    labelPl: 'Spotkanie',
    prefix: 'MTG',
  },
  notification: {
    icon: 'Bell',
    accent: 'red',
    labelEn: 'Notification',
    labelPl: 'Powiadomienie',
    prefix: 'NTF',
  },
  insight: {
    icon: 'Lightbulb',
    accent: 'lime',
    labelEn: 'Insight',
    labelPl: 'Insight',
    prefix: 'INS',
  },
  project: {
    icon: 'FolderKanban',
    accent: 'indigo',
    labelEn: 'Project',
    labelPl: 'Projekt',
    prefix: 'PRJ',
  },
  risk: { icon: 'AlertTriangle', accent: 'red', labelEn: 'Risk', labelPl: 'Ryzyko', prefix: 'RSK' },
  external: {
    icon: 'ExternalLink',
    accent: 'slate',
    labelEn: 'External',
    labelPl: 'Zewnętrzny',
    prefix: 'EXT',
  },
  financial_model: {
    icon: 'Calculator',
    accent: 'emerald',
    labelEn: 'Financial Model',
    labelPl: 'Model finansowy',
    prefix: 'FIN',
  },
  budget: { icon: 'Wallet', accent: 'green', labelEn: 'Budget', labelPl: 'Budżet', prefix: 'BDG' },
  valuation: {
    icon: 'TrendingUp',
    accent: 'teal',
    labelEn: 'Valuation',
    labelPl: 'Wycena',
    prefix: 'VAL',
  },
  analysis: {
    icon: 'BarChart3',
    accent: 'orange',
    labelEn: 'Analysis',
    labelPl: 'Analiza',
    prefix: 'ANL',
  },
  knowledge: {
    icon: 'BookMarked',
    accent: 'purple',
    labelEn: 'Knowledge',
    labelPl: 'Wiedza',
    prefix: 'KNW',
  },
};

/**
 * Get the accent color class for a given artifact type.
 */
export function getArtifactAccent(type: ArtifactType): string {
  return ARTIFACT_IDENTITY[type]?.accent || 'slate';
}

/**
 * Get the icon name for a given artifact type.
 */
export function getArtifactIcon(type: ArtifactType): string {
  return ARTIFACT_IDENTITY[type]?.icon || 'FileText';
}

/**
 * Get the human-readable label for a given artifact type.
 */
export function getArtifactLabel(type: ArtifactType, lang: string = 'en'): string {
  const identity = ARTIFACT_IDENTITY[type];
  if (!identity) return type;
  return lang.startsWith('pl') ? identity.labelPl : identity.labelEn;
}

const ARTIFACT_PREFIX: Record<string, string> = Object.fromEntries(
  Object.entries(ARTIFACT_IDENTITY).map(([k, v]) => [k, v.prefix])
);

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
    case 'process':
    case 'role':
    case 'system':
    case 'kpi':
    case 'decision':
    case 'notification':
      return '/my-work';
    case 'initiative':
      return '/initiatives';
    case 'project':
      return `/projects/${id}`;
    case 'report':
      return `/wordy?artifactId=${id}`;
    case 'assessment':
      return '/assessment';
    case 'tool':
      return '/discovery-tools/strategic';
    case 'tool_session':
      return `/my-work?session=${id}`;
    case 'insight':
      return '/interview';
    case 'risk':
      return '/my-work';
    case 'idea':
      return '/my-work';
    case 'notebook':
      return '/my-work';
    case 'presentation':
      return `/prezentacje?artifactId=${id}`;
    case 'sheet':
      return `/tabele?artifactId=${id}`;
    // DEC-2026-08-24-07: links straight to the canonical object card
    // (`/meetings/:meetingId`) instead of the generic list — every other
    // case here that has an `id` does the same.
    case 'meeting':
      return `/meetings/${id}`;
    // V5-IDEA-34: Finance artifact parity
    case 'financial_model':
      return `/economics?tab=models&open=${id}`;
    case 'budget':
      return `/economics?tab=prediction&open=${id}`;
    case 'valuation':
      return `/economics?tab=valuation&open=${id}`;
    case 'analysis':
      return `/economics?tab=analysis&open=${id}`;
    case 'external':
    default:
      return '/my-work';
  }
}

/**
 * Relative API path to download the current XLSX snapshot of a canonical sheet artifact.
 * `tableId` is the table-platform `tp_tables.id` (same as `originRecordId` when `originRuntime === 'sheet'`).
 */
export function getV8SheetArtifactXlsxExportPath(tableId: string): string {
  return `/api/table-platform/tables/${encodeURIComponent(tableId)}/export/xlsx`;
}

/**
 * Deep-link into My Work Sheets lane (Option A path) for a canonical `tp_tables` row.
 * `workspaceId` is `tp_bases.workspace_id` (idea id).
 */
export function buildMyWorkSheetTableOpenPath(workspaceId: string, tableId: string): string {
  return `/my-work/sheets/${encodeURIComponent(workspaceId)}/tables/${encodeURIComponent(tableId)}`;
}

export function getArtifactPath(type: ArtifactType, id: string): string {
  const safeId = String(id);
  const code = buildArtifactCode(type, safeId);
  const ref = buildArtifactRef(type, safeId);
  const basePath = getBasePath(type, safeId);

  const params = new URLSearchParams({
    artifact: ref,
    code,
  });

  if (type === 'initiative') {
    params.set('open', safeId);
    params.set('mode', 'doc');
  }

  const separator = basePath.includes('?') ? '&' : '?';
  return `${basePath}${separator}${params.toString()}`;
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

// ── V5-IDEA-32: Workspace object attachment helpers ─────────────────────────

export type WorkspaceObjectType =
  | 'node'
  | 'sticky'
  | 'cluster'
  | 'frame'
  | 'step'
  | 'lane'
  | 'vsm_block'
  | 'table'
  | 'row'
  | 'knowledge_card'
  | 'idea_card';

export type WorkspaceObjectRef = {
  workspaceType: 'idea_workspace';
  workspaceId: string;
  objectType: WorkspaceObjectType;
  objectId: string;
};

export type ArtifactLinkRole = 'context' | 'source' | 'output' | 'evidence' | 'related';

export type ArtifactLink = {
  artifactRef: ArtifactRef;
  artifactIndex?: string;
  label?: string;
  linkRole?: ArtifactLinkRole;
  pinned?: boolean;
};

export type ObjectAttachment = {
  objectRef: WorkspaceObjectRef;
  artifactLink: ArtifactLink;
  attachedAt?: string;
  attachedBy?: string;
};

type NodeLikeWithArtifacts = {
  artifactLinks?: ArtifactLink[];
  data?: Record<string, unknown> & { artifactLinks?: ArtifactLink[] };
};

export function buildWorkspaceObjectRef(
  workspaceId: string,
  objectType: WorkspaceObjectType,
  objectId: string
): WorkspaceObjectRef {
  return { workspaceType: 'idea_workspace', workspaceId, objectType, objectId };
}

export function buildArtifactLink(
  type: ArtifactType,
  id: string,
  role: ArtifactLinkRole = 'related',
  label?: string
): ArtifactLink {
  return {
    artifactRef: { type, id },
    artifactIndex: buildArtifactCode(type, id),
    label,
    linkRole: role,
  };
}

export function attachArtifactToObject(
  workspaceId: string,
  objectType: WorkspaceObjectType,
  objectId: string,
  artifactType: ArtifactType,
  artifactId: string,
  role: ArtifactLinkRole = 'related'
): ObjectAttachment {
  return {
    objectRef: buildWorkspaceObjectRef(workspaceId, objectType, objectId),
    artifactLink: buildArtifactLink(artifactType, artifactId, role),
    attachedAt: new Date().toISOString(),
  };
}

export function getNodeArtifactLinks(
  node: NodeLikeWithArtifacts | null | undefined
): ArtifactLink[] {
  if (!node) return [];
  if (Array.isArray(node.data?.artifactLinks)) return node.data.artifactLinks;
  if (Array.isArray(node.artifactLinks)) return node.artifactLinks;
  return [];
}

export function withNormalizedArtifactLinks<T extends NodeLikeWithArtifacts>(node: T): T {
  const links = getNodeArtifactLinks(node);
  if (links.length === 0) return node;
  return {
    ...node,
    artifactLinks: links,
    data: {
      ...(node.data || {}),
      artifactLinks: links,
    },
  };
}

export function buildArtifactPermalink(type: ArtifactType, id: string): string {
  const origin = window.location.origin;
  return `${origin}${getArtifactPath(type, id)}`;
}

/**
 * Return the first pinned link, or the first link overall.
 * Useful when UI needs a single "primary" artifact to highlight.
 */
export function getPrimaryArtifactLink(links: ArtifactLink[]): ArtifactLink | null {
  if (!links || links.length === 0) return null;
  return links.find((l) => l.pinned) || links[0];
}

/**
 * Convert an ArtifactLink to a payload suitable for `mywork-open-item` events.
 */
export function artifactLinkToOpenPayload(link: ArtifactLink): {
  type: string;
  id: string;
  name: string;
} {
  return {
    type: link.artifactRef.type,
    id: link.artifactRef.id,
    name: link.label || `${link.artifactRef.type}:${link.artifactRef.id}`,
  };
}

/**
 * Convert a legacy `artifactRef` string (e.g. "initiative:abc123") to an ArtifactLink[].
 */
export function legacyRefToArtifactLinks(ref: string | null | undefined): ArtifactLink[] {
  const parsed = parseArtifactRef(ref);
  if (!parsed) return [];
  return [buildArtifactLink(parsed.type, parsed.id, 'related')];
}
