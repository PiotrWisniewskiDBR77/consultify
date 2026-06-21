/**
 * deliverableTemplateService — federuje szablony z 3 tabel (deck/doc/table)
 * w jeden zunifikowany typ DeliverableTemplate.
 *
 * Fail-open per tabela: jeśli SQL rzuci (schema drift), zwracamy [] dla
 * danego typu i nie blokujemy pozostałych (wzorzec: finding_subquery_optional_table_silent_empty).
 */

import { queryAll } from '../utils/queryHelpers.js';

export type DeliverableTemplateType = 'doc' | 'deck' | 'table';

export interface DeliverableTemplate {
  id: string;
  type: DeliverableTemplateType;
  name: string;
  description: string | null;
  isSystem: boolean;
  isBlank: boolean;
  organizationId: string | null;
  meta: Record<string, unknown>;
}

const BLANK_NAME_PATTERN = /blank|pusty/i;

function detectIsBlank(
  name: string,
  meta: Record<string, unknown>
): boolean {
  if (BLANK_NAME_PATTERN.test(name)) return true;
  // doc: brak sekcji
  if (Array.isArray(meta.sections_json) && (meta.sections_json as unknown[]).length === 0)
    return true;
  if (typeof meta.sections_json === 'string') {
    try {
      const parsed = JSON.parse(meta.sections_json as string);
      if (Array.isArray(parsed) && parsed.length === 0) return true;
    } catch {
      // ignore
    }
  }
  // deck: brak outline
  if (Array.isArray(meta.outline_json) && (meta.outline_json as unknown[]).length === 0)
    return true;
  if (typeof meta.outline_json === 'string') {
    try {
      const parsed = JSON.parse(meta.outline_json as string);
      if (Array.isArray(parsed) && parsed.length === 0) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

async function listDeckTemplates(orgId: string): Promise<DeliverableTemplate[]> {
  try {
    const rows = await queryAll<{
      id: string;
      name: string;
      description: string | null;
      is_system: boolean;
      theme: string | null;
      organization_id: string | null;
      outline_json: string | null;
    }>(
      `SELECT id, name, description, is_system, theme, organization_id, outline_json
       FROM presentation_templates
       WHERE (is_system = true OR organization_id = $1) AND is_active = true
       ORDER BY is_system DESC, name`,
      [orgId]
    );
    return rows.map((r) => {
      const meta: Record<string, unknown> = {
        theme: r.theme,
        outline_json: r.outline_json,
      };
      return {
        id: r.id,
        type: 'deck' as DeliverableTemplateType,
        name: r.name,
        description: r.description,
        isSystem: Boolean(r.is_system),
        isBlank: detectIsBlank(r.name, meta),
        organizationId: r.organization_id,
        meta,
      };
    });
  } catch {
    return [];
  }
}

async function listDocTemplates(orgId: string): Promise<DeliverableTemplate[]> {
  try {
    const rows = await queryAll<{
      id: string;
      name: string;
      description: string | null;
      is_system: boolean;
      is_public: boolean;
      report_type: string | null;
      sections_json: string | null;
      organization_id: string | null;
    }>(
      `SELECT id, name, description, is_system, is_public, report_type, sections_json, organization_id
       FROM report_builder_templates
       WHERE (is_system = true OR is_public = true OR organization_id = $1)
       ORDER BY is_system DESC, name`,
      [orgId]
    );
    return rows.map((r) => {
      const meta: Record<string, unknown> = {
        report_type: r.report_type,
        sections_json: r.sections_json,
      };
      return {
        id: r.id,
        type: 'doc' as DeliverableTemplateType,
        name: r.name,
        description: r.description,
        isSystem: Boolean(r.is_system),
        isBlank: detectIsBlank(r.name, meta),
        organizationId: r.organization_id,
        meta,
      };
    });
  } catch {
    return [];
  }
}

async function listTableTemplates(): Promise<DeliverableTemplate[]> {
  try {
    const rows = await queryAll<{
      id: string;
      name: string;
      description: string | null;
      is_featured: boolean;
      category: string | null;
      schema_snapshot: unknown;
      created_by: string | null;
    }>(
      `SELECT id, name, description, is_featured, category, schema_snapshot, created_by
       FROM tp_base_templates
       ORDER BY is_featured DESC, name`,
      []
    );
    return rows.map((r) => {
      const meta: Record<string, unknown> = {
        category: r.category,
        schema_snapshot: r.schema_snapshot,
      };
      return {
        id: String(r.id),
        type: 'table' as DeliverableTemplateType,
        name: r.name,
        description: r.description,
        isSystem: r.created_by === null,
        isBlank: detectIsBlank(r.name, {}),
        organizationId: null,
        meta,
      };
    });
  } catch {
    return [];
  }
}

export async function listDeliverableTemplates(
  type: DeliverableTemplateType,
  orgId: string
): Promise<DeliverableTemplate[]> {
  switch (type) {
    case 'deck':
      return listDeckTemplates(orgId);
    case 'doc':
      return listDocTemplates(orgId);
    case 'table':
      return listTableTemplates();
    default:
      return [];
  }
}
