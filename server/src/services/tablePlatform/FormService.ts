/**
 * Table Platform Form Service
 * CRUD for forms, public submission, and submission listing.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import auditService from './AuditService.js';
import recordsService from './RecordsService.js';
import schemaValidationService from './SchemaValidationService.js';
import { NotFoundError, ValidationError } from './ErrorHandling.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FormFieldConfig {
  fieldId: string;
  label?: string;
  required?: boolean;
  helpText?: string;
  defaultValue?: unknown;
  hidden?: boolean;
}

export interface FormConfig {
  fields: FormFieldConfig[];
  submitMessage?: string;
  redirectUrl?: string;
  allowMultiple?: boolean;
  requireAuth?: boolean;
  styling?: Record<string, unknown>;
}

export interface Form {
  id: string;
  table_id: string;
  name: string;
  description: string | null;
  slug: string;
  is_published: boolean;
  config: FormConfig;
  submit_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFormInput {
  name: string;
  description?: string;
  slug?: string;
  config?: Partial<FormConfig>;
}

export interface UpdateFormInput {
  name?: string;
  description?: string;
  slug?: string;
  is_published?: boolean;
  config?: Partial<FormConfig>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 12; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
}

const SLUG_REGEX = /^[a-z0-9][a-z0-9_-]{1,62}[a-z0-9]$/;

function validateSlug(slug: string): void {
  if (!SLUG_REGEX.test(slug)) {
    throw new ValidationError(
      'Slug must be 3-64 chars, lowercase alphanumeric with hyphens/underscores, no leading/trailing special chars'
    );
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

const formService = {
  async createForm(
    tableId: string,
    data: CreateFormInput,
    createdBy?: string
  ): Promise<Form> {
    const db = getDatabase();
    const id = uuidv4();
    const slug = data.slug ?? generateSlug();

    if (data.slug) {
      validateSlug(data.slug);
    }

    const tableCheck = await db.query('SELECT id FROM tp_tables WHERE id = $1', [tableId]);
    if (!tableCheck.rows.length) {
      throw new NotFoundError('Table', tableId);
    }

    if (data.slug) {
      const existing = await db.query('SELECT id FROM tp_forms WHERE slug = $1', [slug]);
      if (existing.rows.length) {
        throw new ValidationError(`Slug "${slug}" is already taken`);
      }
    }

    const config: FormConfig = {
      fields: data.config?.fields ?? [],
      submitMessage: data.config?.submitMessage ?? 'Thank you for your submission!',
      redirectUrl: data.config?.redirectUrl,
      allowMultiple: data.config?.allowMultiple ?? true,
      requireAuth: data.config?.requireAuth ?? false,
      styling: data.config?.styling ?? {},
    };

    await db.query(
      `INSERT INTO tp_forms (id, table_id, name, description, slug, config, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        tableId,
        data.name,
        data.description ?? null,
        slug,
        JSON.stringify(config),
        createdBy ?? null,
      ]
    );

    const row = (await db.query('SELECT * FROM tp_forms WHERE id = $1', [id])).rows[0];
    await auditService.logEvent('create', 'form', id, createdBy, undefined, row, {
      table_id: tableId,
    });

    return row as Form;
  },

  async getForm(formId: string): Promise<Form> {
    const db = getDatabase();
    const result = await db.query('SELECT * FROM tp_forms WHERE id = $1', [formId]);
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Form', formId);
    }
    return row as Form;
  },

  async getFormBySlug(slug: string): Promise<Form> {
    const db = getDatabase();
    const result = await db.query(
      'SELECT * FROM tp_forms WHERE slug = $1 AND is_published = true',
      [slug]
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Form', slug);
    }
    return row as Form;
  },

  async updateForm(formId: string, data: UpdateFormInput, updatedBy?: string): Promise<Form> {
    const db = getDatabase();

    const before = (await db.query('SELECT * FROM tp_forms WHERE id = $1', [formId])).rows[0];
    if (!before) {
      throw new NotFoundError('Form', formId);
    }

    if (data.slug && data.slug !== (before as { slug: string }).slug) {
      validateSlug(data.slug);
      const existing = await db.query(
        'SELECT id FROM tp_forms WHERE slug = $1 AND id != $2',
        [data.slug, formId]
      );
      if (existing.rows.length) {
        throw new ValidationError(`Slug "${data.slug}" is already taken`);
      }
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIdx}`);
      params.push(data.name);
      paramIdx++;
    }
    if (data.description !== undefined) {
      setClauses.push(`description = $${paramIdx}`);
      params.push(data.description);
      paramIdx++;
    }
    if (data.slug !== undefined) {
      setClauses.push(`slug = $${paramIdx}`);
      params.push(data.slug);
      paramIdx++;
    }
    if (data.is_published !== undefined) {
      setClauses.push(`is_published = $${paramIdx}`);
      params.push(data.is_published);
      paramIdx++;
    }
    if (data.config !== undefined) {
      const existingConfig = ((before as { config?: unknown }).config ?? {}) as FormConfig;
      const mergedConfig: FormConfig = {
        ...existingConfig,
        ...data.config,
        fields: data.config.fields ?? existingConfig.fields ?? [],
      };
      setClauses.push(`config = $${paramIdx}`);
      params.push(JSON.stringify(mergedConfig));
      paramIdx++;
    }

    params.push(formId);
    await db.query(
      `UPDATE tp_forms SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
      params
    );

    const after = (await db.query('SELECT * FROM tp_forms WHERE id = $1', [formId])).rows[0];
    await auditService.logEvent('update', 'form', formId, updatedBy, before, after, undefined);

    return after as Form;
  },

  async deleteForm(formId: string, deletedBy?: string): Promise<void> {
    const db = getDatabase();
    const before = (await db.query('SELECT * FROM tp_forms WHERE id = $1', [formId])).rows[0];
    if (!before) {
      throw new NotFoundError('Form', formId);
    }

    await db.query('DELETE FROM tp_forms WHERE id = $1', [formId]);
    await auditService.logEvent('delete', 'form', formId, deletedBy, before, undefined, undefined);
  },

  async listForms(tableId: string): Promise<Form[]> {
    const db = getDatabase();
    const result = await db.query(
      'SELECT * FROM tp_forms WHERE table_id = $1 ORDER BY created_at DESC',
      [tableId]
    );
    return result.rows as Form[];
  },

  async submitForm(
    formId: string,
    submissionData: Record<string, unknown>
  ): Promise<{ recordId: string }> {
    const db = getDatabase();

    const formResult = await db.query('SELECT * FROM tp_forms WHERE id = $1', [formId]);
    const form = formResult.rows[0] as Form | undefined;
    if (!form) {
      throw new NotFoundError('Form', formId);
    }
    if (!form.is_published) {
      throw new ValidationError('This form is not published');
    }

    const config = (typeof form.config === 'string'
      ? JSON.parse(form.config)
      : form.config) as FormConfig;

    const fieldsResult = await db.query(
      'SELECT * FROM tp_fields WHERE table_id = $1',
      [form.table_id]
    );
    const tableFields = fieldsResult.rows as Array<{
      id: string;
      name: string;
      field_type: string;
      options: Record<string, unknown>;
    }>;
    const fieldById = new Map(tableFields.map((f) => [f.id, f]));

    const recordData: Record<string, unknown> = {};
    const errors: Array<{ fieldId: string; message: string }> = [];

    for (const fc of config.fields) {
      const field = fieldById.get(fc.fieldId);
      if (!field) continue;

      if (fc.hidden) {
        if (fc.defaultValue !== undefined) {
          recordData[fc.fieldId] = fc.defaultValue;
        }
        continue;
      }

      const value = submissionData[fc.fieldId];
      const isEmpty = value === undefined || value === null || value === '';

      if (fc.required && isEmpty) {
        errors.push({
          fieldId: fc.fieldId,
          message: `${fc.label ?? field.name} is required`,
        });
        continue;
      }

      if (!isEmpty) {
        recordData[fc.fieldId] = value;
      } else if (fc.defaultValue !== undefined) {
        recordData[fc.fieldId] = fc.defaultValue;
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Form validation failed', { errors });
    }

    const schemaResult = await schemaValidationService.validateRecord(form.table_id, recordData);
    if (!schemaResult.valid) {
      throw new ValidationError('Record validation failed', { errors: schemaResult.errors });
    }

    const record = await recordsService.createRecord(form.table_id, recordData, undefined);
    if (!record) {
      throw new ValidationError('Failed to create record');
    }

    await db.query(
      'UPDATE tp_forms SET submit_count = submit_count + 1, updated_at = NOW() WHERE id = $1',
      [formId]
    );

    await auditService.logEvent('form_submit', 'form', formId, undefined, undefined, undefined, {
      table_id: form.table_id,
      record_id: record.id,
    });

    return { recordId: record.id };
  },

  async getSubmissions(
    formId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ records: unknown[]; total: number }> {
    const db = getDatabase();

    const formResult = await db.query('SELECT * FROM tp_forms WHERE id = $1', [formId]);
    const form = formResult.rows[0] as Form | undefined;
    if (!form) {
      throw new NotFoundError('Form', formId);
    }

    const limit = Math.min(options?.limit ?? 50, 200);
    const offset = options?.offset ?? 0;

    const countResult = await db.query(
      'SELECT COUNT(*) AS total FROM tp_records WHERE table_id = $1',
      [form.table_id]
    );
    const total = parseInt(String((countResult.rows[0] as { total: string })?.total ?? 0), 10);

    const result = await db.query(
      `SELECT * FROM tp_records WHERE table_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [form.table_id, limit, offset]
    );

    return { records: result.rows, total };
  },
};

export default formService;
