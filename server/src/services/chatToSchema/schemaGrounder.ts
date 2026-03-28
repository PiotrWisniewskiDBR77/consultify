/**
 * SchemaGrounder — builds a textual representation of the current schema
 * so the LLM has full context when generating proposals.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

// ---------------------------------------------------------------------------
// Field type inference (NL → Consultify field type)
// ---------------------------------------------------------------------------

const TYPE_RULES: Array<{ pattern: RegExp; type: string }> = [
  {
    pattern: /\b(amount|price|cost|budget|revenue|PLN|EUR|USD|kwota|cena|koszt)\b/i,
    type: 'currency',
  },
  { pattern: /\b(date|deadline|termin|when|data|due)\b/i, type: 'date' },
  { pattern: /\b(yes\/?no|true\/?false|checkbox|tak\/?nie|boolean)\b/i, type: 'checkbox' },
  {
    pattern: /\b(status|stage|phase|priority|category|etap|faza|priorytet|kategoria)\b/i,
    type: 'singleSelect',
  },
  { pattern: /\b(list\s+of|multiple|tags|many|multi|wiele|tagi)\b/i, type: 'multiSelect' },
  { pattern: /\b(email|e-mail)\b/i, type: 'email' },
  { pattern: /\b(phone|telefon|tel|mobile|komórka)\b/i, type: 'phone' },
  { pattern: /\b(url|link|website|http|strona)\b/i, type: 'url' },
  { pattern: /\b(description|notes|long|opis|notatki|uwagi)\b/i, type: 'longText' },
  { pattern: /\b(percent|procent|%)\b/i, type: 'percent' },
  { pattern: /\b(number|quantity|count|liczba|ilość|ilosc)\b/i, type: 'number' },
];

export function inferFieldType(naturalLanguageHint: string): string {
  const hint = (naturalLanguageHint || '').toLowerCase();
  for (const rule of TYPE_RULES) {
    if (rule.pattern.test(hint)) return rule.type;
  }
  return 'singleLineText';
}

// ---------------------------------------------------------------------------
// Schema grounding
// ---------------------------------------------------------------------------

interface FieldRow {
  id: string;
  name: string;
  field_type: string;
  options?: Record<string, unknown> | string;
}

interface TableRow {
  id: string;
  name: string;
}

interface BaseRow {
  id: string;
  name: string;
}

export async function groundSchema(baseId: string, tableId?: string): Promise<string> {
  const db = getDatabase();

  try {
    const baseResult = await db.query('SELECT id, name FROM tp_bases WHERE id = $1', [baseId]);
    const base = baseResult.rows[0] as BaseRow | undefined;
    if (!base) {
      return `Base not found (id: ${baseId}). User is creating from scratch.`;
    }

    const tablesResult = await db.query(
      'SELECT id, name FROM tp_tables WHERE base_id = $1 ORDER BY created_at ASC',
      [baseId]
    );
    const tables = tablesResult.rows as TableRow[];

    if (tables.length === 0) {
      return `Base: "${base.name}" (id: ${base.id})\nTables: (none)`;
    }

    const tablesToGround = tableId ? tables.filter((t) => t.id === tableId) : tables;

    const lines: string[] = [`Base: "${base.name}" (id: ${base.id})`, 'Tables:'];

    for (const table of tablesToGround) {
      lines.push(`- ${table.name} (id: ${table.id})`);

      const fieldsResult = await db.query(
        'SELECT id, name, field_type, options FROM tp_fields WHERE table_id = $1 ORDER BY field_order ASC, created_at ASC',
        [table.id]
      );
      const fields = fieldsResult.rows as FieldRow[];

      for (const field of fields) {
        let typeLabel = field.field_type;
        const opts = typeof field.options === 'string' ? safeParse(field.options) : field.options;

        if (opts && (field.field_type === 'single_select' || field.field_type === 'singleSelect')) {
          const choices = extractSelectOptions(opts);
          if (choices.length > 0) {
            typeLabel += `: ${choices.join(', ')}`;
          }
        }

        if (opts && (field.field_type === 'linked_record' || field.field_type === 'linkedRecord')) {
          const linked =
            (opts as Record<string, unknown>).linkedTableId ??
            (opts as Record<string, unknown>).linked_table_id;
          if (linked) {
            const linkedTable = tables.find((t) => t.id === linked);
            typeLabel += ` → ${linkedTable?.name ?? String(linked)}`;
          }
        }

        lines.push(`  - ${field.name} (${typeLabel})`);
      }
    }

    return lines.join('\n');
  } catch (e) {
    logger.error('[SchemaGrounder] groundSchema failed', {
      baseId,
      tableId,
      error: (e as Error).message,
    });
    return `Error loading schema for base ${baseId}. User may be creating from scratch.`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeParse(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractSelectOptions(opts: Record<string, unknown>): string[] {
  const choices = opts.choices ?? opts.options;
  if (!Array.isArray(choices)) return [];
  return choices
    .map((c: unknown) => {
      if (typeof c === 'string') return c;
      if (c && typeof c === 'object' && 'name' in c) return String((c as { name: string }).name);
      return null;
    })
    .filter((c): c is string => c !== null)
    .slice(0, 10);
}
