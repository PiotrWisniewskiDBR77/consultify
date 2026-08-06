/**
 * templateBuilderApi — zapis szablonu do żywej fasady
 * `POST /api/deliverables/templates` (deliverableTemplates.routes.ts →
 * createDeliverableTemplate). Body = draftToPostBody() (1:1 kontrakt).
 *
 * Wzorzec fetch identyczny z useDeliverableTemplates (credentials:'include').
 * Silników generacji NIE dotyka — tylko struktura template'u.
 */

import {
  draftToPostBody,
  emptyDraft,
  newSheetColumn,
  nextId,
  type SheetColumnType,
  type TemplateDraft,
  type TemplateScope,
} from './templateBuilderModel';

export interface SavedTemplate {
  id: string;
  type: string;
  name: string;
}

export interface DeliverableTemplateRecord extends SavedTemplate {
  description: string | null;
  isSystem: boolean;
  organizationId: string | null;
  meta: Record<string, unknown>;
}

async function templateRequest(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(path, { credentials: 'include', ...init });
  if (!res.ok) {
    let msg = `Operacja na szablonie nie powiodła się (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) msg = String(data.error);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function saveTemplate(draft: TemplateDraft): Promise<SavedTemplate> {
  const body = draftToPostBody(draft);
  const data = await templateRequest('/api/deliverables/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const tpl = data.template ?? data;
  return { id: tpl.id, type: tpl.type, name: tpl.name };
}

export async function loadTemplate(id: string): Promise<DeliverableTemplateRecord> {
  const data = await templateRequest(`/api/deliverables/templates/${encodeURIComponent(id)}`);
  return data.template ?? data;
}

export async function updateTemplate(id: string, draft: TemplateDraft): Promise<SavedTemplate> {
  const body = draftToPostBody(draft);
  const data = await templateRequest(`/api/deliverables/templates/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: body.name, description: body.description, meta: body.meta }),
  });
  const tpl = data.template ?? data;
  return { id: tpl.id, type: tpl.type, name: tpl.name };
}

export async function deleteTemplate(id: string): Promise<void> {
  await templateRequest(`/api/deliverables/templates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/** Hydrates the manual editor from the canonical record returned by the facade. */
export function recordToDraft(record: DeliverableTemplateRecord): TemplateDraft {
  const scope = (record.meta?.scope === 'private' ? 'private' : 'org') as TemplateScope;
  const draft = emptyDraft(record.type as TemplateDraft['type'], record.name, scope);
  draft.description = record.description ?? '';
  draft.themeRef = typeof record.meta?.theme_ref === 'string' ? record.meta.theme_ref : null;
  if (record.type !== 'table') return draft;

  const raw = record.meta?.schema_snapshot;
  const schema = typeof raw === 'string' ? safeJson(raw) : raw;
  const sheets = Array.isArray((schema as any)?.sheets) ? (schema as any).sheets : [];
  draft.table = sheets.map((sheet: any, sheetIndex: number) => {
    const firstRowCells = sheet?.rows?.[0]?.cells ?? {};
    const columns = Array.isArray(sheet?.columns) ? sheet.columns : [];
    return {
      id: nextId('sheet'),
      name: String(sheet?.name || `Arkusz ${sheetIndex + 1}`),
      columns: columns.map((column: any, columnIndex: number) => {
        const base = newSheetColumn();
        const key = String(column?.key || String.fromCharCode(65 + columnIndex));
        const starter = firstRowCells?.[key];
        const validation = column?.validation ?? {};
        return {
          ...base,
          name: String(column?.header || `Kolumna ${columnIndex + 1}`),
          type: starter?.formula ? 'formula' : normalizeColumnType(column?.type),
          formula: starter?.formula ? `=${String(starter.formula)}` : '',
          starterValue: starter?.value == null ? '' : String(starter.value),
          numberFormat: typeof column?.numberFormat === 'string' ? column.numberFormat : '',
          validation: {
            type: ['list', 'decimal', 'whole'].includes(validation.type) ? validation.type : 'none',
            values: Array.isArray(validation.values) ? validation.values.join(', ') : '',
            min: validation.min == null ? '' : String(validation.min),
            max: validation.max == null ? '' : String(validation.max),
          },
        };
      }),
    };
  });
  if (draft.table.length === 0) draft.table = emptyDraft('table', record.name, scope).table;
  return draft;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normalizeColumnType(value: unknown): SheetColumnType {
  return ['text', 'number', 'currency', 'percent', 'date'].includes(String(value))
    ? (String(value) as SheetColumnType)
    : 'text';
}
