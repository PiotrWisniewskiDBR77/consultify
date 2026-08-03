/**
 * exceleTemplatePresets — FE-only "saved parameter set" for the /excele
 * parametric template builder (ExceleParametricTemplates.tsx).
 *
 * Real step of AUTHORSHIP: after configuring a template's build parameters,
 * the user can save the current values as a named preset and reload it later
 * instead of re-typing the same numbers every time. Purely client-side —
 * there is no backend preset/favorite mechanism for workbook templates
 * (checked server/src/routes/workbook.routes.ts: only GET /templates and
 * POST /templates/:id/build exist), so this stores presets in localStorage,
 * keyed per templateId, mirroring the guarded-read pattern used by
 * src/utils/chatLanguagePreference.ts and the parse/normalize-never-throws
 * pattern used by src/components/MyWork/processflow/viewState.ts.
 *
 * Kept DOM-free (pure read/normalize helpers + a thin localStorage adapter)
 * so the shape can be unit-tested without mounting a component.
 */

export interface ExceleTemplatePreset {
  id: string;
  name: string;
  /** Raw form values as edited in ExceleParametricTemplates (display units —
   *  e.g. percent fields still ×100 — same shape as that component's `values` state). */
  values: Record<string, string | number>;
  createdAt: number;
}

const STORAGE_KEY = 'consultify-excele-template-presets-v1';
/** Guard against unbounded growth — oldest preset is dropped past this cap. */
const MAX_PRESETS_PER_TEMPLATE = 30;

type PresetsByTemplate = Record<string, ExceleTemplatePreset[]>;

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function isPlainValue(v: unknown): v is string | number {
  return typeof v === 'string' || typeof v === 'number';
}

/** Normalizes a raw parsed-JSON blob into a safe map, dropping anything malformed. Never throws. */
function normalizePresetsByTemplate(raw: unknown): PresetsByTemplate {
  if (!raw || typeof raw !== 'object') return {};
  const out: PresetsByTemplate = {};
  for (const [templateId, list] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof templateId !== 'string' || !templateId) continue;
    if (!Array.isArray(list)) continue;
    const normalized: ExceleTemplatePreset[] = [];
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.id !== 'string' || !e.id) continue;
      if (typeof e.name !== 'string' || !e.name.trim()) continue;
      if (!e.values || typeof e.values !== 'object') continue;
      const values: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(e.values as Record<string, unknown>)) {
        if (isPlainValue(v)) values[k] = v;
      }
      normalized.push({
        id: e.id,
        name: e.name,
        values,
        createdAt:
          typeof e.createdAt === 'number' && Number.isFinite(e.createdAt) ? e.createdAt : 0,
      });
    }
    if (normalized.length > 0) out[templateId] = normalized;
  }
  return out;
}

function readAll(): PresetsByTemplate {
  if (!hasLocalStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return normalizePresetsByTemplate(JSON.parse(raw));
  } catch {
    return {};
  }
}

function writeAll(data: PresetsByTemplate): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota exceeded / private mode — silently drop, non-critical FE convenience feature */
  }
}

function genId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Saved presets for one template, newest first. */
export function readTemplatePresets(templateId: string): ExceleTemplatePreset[] {
  if (!templateId) return [];
  const list = readAll()[templateId] || [];
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}

/** Adds a new preset (or overwrites one with the same trimmed name) and returns the updated, sorted list. */
export function saveTemplatePreset(
  templateId: string,
  name: string,
  values: Record<string, string | number>
): ExceleTemplatePreset[] {
  const trimmedName = name.trim();
  if (!templateId || !trimmedName) return readTemplatePresets(templateId);

  const all = readAll();
  const existing = all[templateId] || [];
  const withoutSameName = existing.filter(
    (p) => p.name.trim().toLowerCase() !== trimmedName.toLowerCase()
  );
  const entry: ExceleTemplatePreset = {
    id: genId(),
    name: trimmedName,
    values: { ...values },
    createdAt: Date.now(),
  };
  const next = [entry, ...withoutSameName].slice(0, MAX_PRESETS_PER_TEMPLATE);
  all[templateId] = next;
  writeAll(all);
  return readTemplatePresets(templateId);
}

/** Removes one preset by id and returns the updated, sorted list. */
export function deleteTemplatePreset(templateId: string, presetId: string): ExceleTemplatePreset[] {
  if (!templateId || !presetId) return readTemplatePresets(templateId);
  const all = readAll();
  const existing = all[templateId] || [];
  const next = existing.filter((p) => p.id !== presetId);
  if (next.length > 0) {
    all[templateId] = next;
  } else {
    delete all[templateId];
  }
  writeAll(all);
  return readTemplatePresets(templateId);
}
