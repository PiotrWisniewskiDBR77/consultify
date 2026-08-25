/**
 * vaultDocuments — model danych WNĘTRZA SEJFU (Client Vault → dokumenty).
 *
 * Wydzielone z `DocumentsRAGTab.tsx`, żeby nowy ekran sejfu
 * (`VaultDocumentsView` + `VaultDocumentPanel`) i stary panel superadmina
 * czytały TEN SAM kształt odpowiedzi `/api/knowledge/documents` — jeden
 * normalizator zamiast dwóch kopii (doktryna gęstości §reuse-first).
 *
 * Kontrakt backendu: `server/src/services/KnowledgeService.ts` → `getDocuments`
 * (SELECT * z `knowledge_docs`), pola m.in. filename · category · tags ·
 * scope · project_id · owner_id · status · chunk_count · file_size_bytes ·
 * created_at.
 */

import { Building2, FolderKanban, type LucideIcon, User } from 'lucide-react';

export type VaultScope = 'user' | 'project' | 'organization';

export interface VaultDocument {
  id: string;
  filename: string;
  category?: string;
  tags: string[];
  ai_visibility?: 'allowed' | 'blocked' | 'requires_approval';
  sensitivity?: 'public' | 'internal' | 'confidential';
  status: string;
  created_at: string;
  chunk_count: number;
  /** Rozmiar pliku w bajtach (kolumna `file_size_bytes`); brak = null. */
  file_size_bytes: number | null;
  scope: VaultScope;
  project_id: string | null;
  owner_id: string | null;
  /** ★ VLT-FOLDERS — folder wewnątrz TEGO sejfu; `null` = bez folderu. */
  folder_id: string | null;
}

export interface VaultProject {
  id: string;
  name: string;
}

export const DOCUMENT_CATEGORIES = [
  'Best Practices',
  'Methodology',
  'Standards',
  'Templates',
  'Other',
];

export const SCOPE_OPTIONS: Array<{
  value: VaultScope;
  labelPl: string;
  labelEn: string;
  icon: LucideIcon;
}> = [
  { value: 'user', labelPl: 'Prywatny (tylko ja)', labelEn: 'Private (only me)', icon: User },
  { value: 'project', labelPl: 'Projekt', labelEn: 'Project', icon: FolderKanban },
  { value: 'organization', labelPl: 'Organizacja', labelEn: 'Organization', icon: Building2 },
];

export const scopeMeta = (scope?: VaultScope) =>
  SCOPE_OPTIONS.find((o) => o.value === (scope || 'organization')) || SCOPE_OPTIONS[2];

export const scopeLabel = (scope: VaultScope | undefined, isPolish: boolean) => {
  const meta = scopeMeta(scope);
  return isPolish ? meta.labelPl : meta.labelEn;
};

/**
 * safeLevelLabel / safeDisplayName — the ONE place that turns a system
 * safe's `type` into user-facing text.
 *
 * FIX-19 (Day 3 layer-2 acceptance): moved here from `VaultSafesTable.tsx`
 * and routed through real i18n keys (`vault.safes.level*`) instead of a raw
 * PL/EN record with no translation entry — the reported bug was a Polish
 * screen showing "Mój sejf" in the safes table but literal English
 * "My safe" the moment the safe was opened (breadcrumb card, the "Sejf: …"
 * line in the add/edit document panel, the exported CSV filename) because
 * those call sites rendered the server's neutral `safe.name` fallback
 * (`server/src/routes/knowledge.routes.ts` — deliberately English, "any
 * consumer that does not localize") instead of localizing it. Every screen
 * that shows a system safe's name must go through this function so there is
 * exactly one PL/EN pair to keep in sync.
 */
export const safeLevelLabel = (
  type: VaultScope,
  isPolish: boolean,
  t: (key: string, fallback: string) => string
): string => {
  if (type === 'user') return t('vault.safes.levelUser', isPolish ? 'Mój sejf' : 'My safe');
  if (type === 'organization') {
    return t('vault.safes.levelOrganization', isPolish ? 'Sejf organizacji' : 'Organization safe');
  }
  return t('vault.safes.levelProject', isPolish ? 'Sejf projektu' : 'Project safe');
};

export const safeDisplayName = (
  safe: { type: VaultScope; name: string; isSystem?: boolean },
  isPolish: boolean,
  t: (key: string, fallback: string) => string
): string => {
  const isSystem = safe.isSystem ?? safe.type !== 'project';
  return isSystem ? safeLevelLabel(safe.type, isPolish, t) : safe.name;
};

/** Statusy indeksowania → ton chipu statusu (kanon: cichy chip z kropką). */
export const indexStatusTone = (status: string): 'success' | 'warning' | 'danger' | 'neutral' => {
  const s = (status || '').toLowerCase();
  if (s === 'indexed' || s === 'ready' || s === 'completed') return 'success';
  if (s === 'failed' || s === 'error') return 'danger';
  if (s === 'pending' || s === 'processing' || s === 'indexing') return 'warning';
  return 'neutral';
};

export const indexStatusLabel = (status: string, isPolish: boolean): string => {
  const s = (status || '').toLowerCase();
  if (!isPolish) return status || '—';
  const map: Record<string, string> = {
    indexed: 'Zindeksowany',
    ready: 'Gotowy',
    completed: 'Zakończony',
    pending: 'Oczekuje',
    processing: 'W trakcie',
    indexing: 'Indeksowanie',
    failed: 'Błąd',
    error: 'Błąd',
    unknown: 'Nieznany',
  };
  return map[s] || status || '—';
};

export const formatBytes = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || !Number.isFinite(Number(bytes))) return '—';
  const value = Number(bytes);
  if (value <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let out = value;
  while (out >= 1024 && idx < units.length - 1) {
    out /= 1024;
    idx += 1;
  }
  return `${out >= 10 || idx === 0 ? Math.round(out) : out.toFixed(1)} ${units[idx]}`;
};

export const formatDate = (value: string | null | undefined, isPolish: boolean): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(isPolish ? 'pl-PL' : undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// ── Normalizacja odpowiedzi API ─────────────────────────────────────────────

type JsonRecord = Record<string, unknown> & { data?: JsonRecord | unknown[] };

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const getListPayload = <T>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const hasListShape = (value: unknown, keys: string[]) => {
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  return (
    Array.isArray(value.data) ||
    keys.some((key) => Array.isArray(value[key])) ||
    Boolean(
      data &&
      (Array.isArray(data.data) ||
        keys.some((key) => Array.isArray(data[key])) ||
        Boolean(nestedData && keys.some((key) => Array.isArray(nestedData[key]))))
    )
  );
};

const asText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const asNumberOrNull = (value: unknown): number | null =>
  value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);

export const normalizeVaultDocuments = (value: unknown): VaultDocument[] => {
  if (!hasListShape(value, ['documents', 'items'])) {
    throw new Error('Knowledge documents response was not a list');
  }
  return getListPayload<Record<string, unknown>>(value, ['documents', 'items'])
    .map((doc) => {
      const ai_visibility: VaultDocument['ai_visibility'] =
        doc.ai_visibility === 'allowed' ||
        doc.ai_visibility === 'blocked' ||
        doc.ai_visibility === 'requires_approval'
          ? doc.ai_visibility
          : 'allowed';
      const sensitivity: VaultDocument['sensitivity'] =
        doc.sensitivity === 'public' ||
        doc.sensitivity === 'internal' ||
        doc.sensitivity === 'confidential'
          ? doc.sensitivity
          : 'internal';
      const scope: VaultScope =
        doc.scope === 'user' || doc.scope === 'project' || doc.scope === 'organization'
          ? doc.scope
          : 'organization';

      return {
        id: asText(doc.id, ''),
        filename: asText(doc.filename, 'Untitled document'),
        category:
          doc.category === null || doc.category === undefined
            ? undefined
            : asText(doc.category, ''),
        tags: Array.isArray(doc.tags) ? doc.tags.map((tag) => asText(tag, '')).filter(Boolean) : [],
        ai_visibility,
        sensitivity,
        status: asText(doc.status, 'unknown'),
        created_at: asText(doc.created_at, ''),
        chunk_count: asNumberOrNull(doc.chunk_count) ?? 0,
        file_size_bytes: asNumberOrNull(doc.file_size_bytes),
        scope,
        project_id:
          doc.project_id === null || doc.project_id === undefined
            ? null
            : asText(doc.project_id, ''),
        owner_id:
          doc.owner_id === null || doc.owner_id === undefined ? null : asText(doc.owner_id, ''),
        folder_id:
          doc.folder_id === null || doc.folder_id === undefined ? null : asText(doc.folder_id, ''),
      };
    })
    .filter((doc) => doc.id);
};

export const normalizeVaultProjects = (value: unknown): VaultProject[] => {
  const list = Array.isArray(value)
    ? value
    : getListPayload<Record<string, unknown>>(value, ['projects', 'items']);
  return list
    .map((p) => {
      const rec = p as Record<string, unknown>;
      return { id: asText(rec.id, ''), name: asText(rec.name, 'Untitled project') };
    })
    .filter((p) => p.id);
};

export const getUploadedDocumentInfo = (value: unknown) => {
  const payload = isRecord(value)
    ? isRecord(value.data)
      ? isRecord((value.data as JsonRecord).data)
        ? ((value.data as JsonRecord).data as JsonRecord)
        : (value.data as JsonRecord)
      : value
    : value;
  const doc = isRecord(payload) && isRecord(payload.document) ? payload.document : payload;
  return {
    id: isRecord(doc) ? asText(doc.id, '') : '',
    chunkCount:
      isRecord(payload) && Number.isFinite(Number(payload.chunkCount))
        ? Number(payload.chunkCount)
        : 0,
  };
};
