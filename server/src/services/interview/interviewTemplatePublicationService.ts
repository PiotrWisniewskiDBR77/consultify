import { v4 as uuidv4 } from 'uuid';

import { type PgTransactionClient, withPgTransaction } from '../../utils/queryHelpers.js';

import {
  isTruthyFlagSql,
  LEGACY_FLAG_FALSE,
  LEGACY_FLAG_TRUE,
} from './interviewLegacyFlags.js';

export class TemplatePublicationError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'TemplatePublicationError';
  }
}

type TemplateRow = Record<string, unknown> & {
  id: string;
  organization_id: string | null;
  template_scope?: string | null;
  created_by?: string | null;
  status?: string | null;
  version?: number | null;
};

export type PublishedTemplateQuestion = {
  id?: string;
  category: string;
  questionText: string;
  sortOrder?: number;
  answerType?: string;
  isRequired?: boolean;
  sectionTitle?: string;
  helpHint?: string;
  answerOptions?: unknown[];
  expectedAnswerShape?: string;
  description?: string;
  evidencePrompt?: string;
  allowVoice?: boolean;
  allowFileUpload?: boolean;
  allowUrl?: boolean;
  allowContextNote?: boolean;
  guidance?: string;
  exampleAnswer?: string;
};

export type PublishedTemplateSnapshot = {
  template: Record<string, unknown>;
  questions: Array<Record<string, unknown>>;
};

type PublicationFaultStage = 'live-updated' | 'snapshot-created';
let testFaultInjector: ((stage: PublicationFaultStage) => void | Promise<void>) | null = null;

export function setTemplatePublicationFaultInjectorForTests(
  injector: ((stage: PublicationFaultStage) => void | Promise<void>) | null
): void {
  if (process.env.NODE_ENV !== 'test') throw new Error('Fault injection is test-only');
  testFaultInjector = injector;
}

function normalizedScope(row: TemplateRow): string {
  return String(
    row.template_scope || (row.organization_id ? 'organization' : 'system')
  ).toLowerCase();
}

function canPublish(row: TemplateRow, organizationId: string, actorId: string): boolean {
  const scope = normalizedScope(row);
  if (scope === 'system' || row.organization_id !== organizationId) return false;
  return scope !== 'private' || row.created_by === actorId;
}

async function readQuestions(tx: PgTransactionClient, templateId: string) {
  return (
    await tx.query<Record<string, unknown>>(
      `SELECT * FROM interview_library_template_questions
       WHERE template_id = ? ORDER BY sort_order, id`,
      [templateId]
    )
  ).rows;
}

async function insertSnapshot(params: {
  tx: PgTransactionClient;
  template: TemplateRow;
  organizationId: string;
  actorId: string;
  version: number;
  questions: Array<Record<string, unknown>>;
}) {
  const snapshot: PublishedTemplateSnapshot = {
    template: { ...params.template, version: params.version, status: 'approved' },
    questions: params.questions,
  };
  await params.tx.query(
    `INSERT INTO interview_library_template_versions
       (id, template_id, organization_id, version, snapshot_json, published_by)
     VALUES (?, ?, ?, ?, ?::jsonb, ?)`,
    [
      uuidv4(),
      params.template.id,
      params.organizationId,
      params.version,
      JSON.stringify(snapshot),
      params.actorId,
    ]
  );
  return snapshot;
}

export async function publishInterviewTemplate(params: {
  organizationId: string;
  actorId: string;
  templateId: string;
  metadata: Record<string, unknown>;
  questions: PublishedTemplateQuestion[];
  expectedVersion: number;
}): Promise<{ templateId: string; version: number; snapshot: PublishedTemplateSnapshot }> {
  const name = String(params.metadata.name || '').trim();
  if (!name)
    throw new TemplatePublicationError('TEMPLATE_NAME_REQUIRED', 400, 'Template name is required');
  if (!Array.isArray(params.questions) || params.questions.length === 0) {
    throw new TemplatePublicationError(
      'TEMPLATE_QUESTIONS_REQUIRED',
      400,
      'At least one question is required'
    );
  }
  if (params.questions.some((question) => !String(question.questionText || '').trim())) {
    throw new TemplatePublicationError('QUESTION_TEXT_REQUIRED', 400, 'Every question needs text');
  }

  return withPgTransaction(async (tx) => {
    const locked = await tx.query<TemplateRow>(
      `SELECT * FROM interview_library_templates WHERE id = ? FOR UPDATE`,
      [params.templateId]
    );
    const existing = locked.rows[0];
    if (!existing || !canPublish(existing, params.organizationId, params.actorId)) {
      throw new TemplatePublicationError('TEMPLATE_NOT_FOUND', 404, 'Template not found');
    }
    const storedVersion = Number(existing.version || 0);
    if (!Number.isInteger(params.expectedVersion) || params.expectedVersion !== storedVersion) {
      throw new TemplatePublicationError(
        'TEMPLATE_VERSION_CONFLICT',
        409,
        'Template changed since it was opened'
      );
    }

    const versionRows = await tx.query<{ max_version: number | null }>(
      `SELECT MAX(version)::int AS max_version FROM interview_library_template_versions
       WHERE template_id = ? AND organization_id = ?`,
      [params.templateId, params.organizationId]
    );
    let maxVersion = versionRows.rows[0]?.max_version ?? null;
    const currentVersion = Math.max(1, storedVersion);
    const currentQuestions = await readQuestions(tx, params.templateId);

    // Legacy approved rows had a mutable numeric counter but no snapshot. Preserve
    // their current published shape before replacing it with the first governed edit.
    if (maxVersion == null && String(existing.status || '').toLowerCase() === 'approved') {
      await insertSnapshot({
        tx,
        template: existing,
        organizationId: params.organizationId,
        actorId: params.actorId,
        version: currentVersion,
        questions: currentQuestions,
      });
      maxVersion = currentVersion;
    }
    const nextVersion = maxVersion == null ? Math.max(1, storedVersion + 1) : maxVersion + 1;
    const now = new Date().toISOString();
    const requestedScope = String(params.metadata.scope || normalizedScope(existing)).toLowerCase();
    if (!['private', 'organization'].includes(requestedScope)) {
      throw new TemplatePublicationError(
        'TEMPLATE_SCOPE_INVALID',
        400,
        'Only private or organization templates can be published here'
      );
    }
    const isDefault = Boolean(params.metadata.isDefault);

    if (isDefault) {
      // M03R-002: `is_default` to kolumna TEXT z trzema kodowaniami w danych
      // ('0', 'false', 'true'). Porównanie do liczby wywalało CAŁĄ transakcję
      // publikacji (`operator does not exist: text = integer`), więc szablonu
      // oznaczonego jako domyślny nie dało się opublikować w ogóle.
      await tx.query(
        `UPDATE interview_library_templates
         SET is_default = ?, updated_at = ?
         WHERE organization_id = ? AND id != ? AND ${isTruthyFlagSql('is_default')}`,
        [LEGACY_FLAG_FALSE, now, params.organizationId, params.templateId]
      );
    }

    await tx.query(
      `UPDATE interview_library_templates
       SET name = ?, description = ?, category = ?, visibility = ?, template_scope = ?,
           is_default = ?, audience = ?,
           estimated_time_minutes = ?, runtime_mode_default = ?, answer_design_guide = ?,
           area_tags = ?, status = 'approved', version = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [
        name,
        String(params.metadata.description || ''),
        String(params.metadata.category || 'CUSTOM'),
        String(params.metadata.visibility || existing.visibility || 'org'),
        requestedScope,
        // M03R-002 (P2 review `cb47528a53`): kolumna jest TEXT, a bindowanie
        // `1/0` dokładało CZWARTE kodowanie obok istniejących `'0' | 'false' |
        // 'true'`. Cała ścieżka publikacji zapisuje odtąd jedną postać.
        isDefault ? LEGACY_FLAG_TRUE : LEGACY_FLAG_FALSE,
        String(params.metadata.audience || ''),
        Number.isFinite(Number(params.metadata.estimatedTimeMinutes))
          ? Number(params.metadata.estimatedTimeMinutes)
          : 10,
        String(params.metadata.runtimeModeDefault || 'one_question_per_screen'),
        String(params.metadata.answerDesignGuide || ''),
        JSON.stringify(Array.isArray(params.metadata.areaTags) ? params.metadata.areaTags : []),
        nextVersion,
        now,
        params.templateId,
        params.organizationId,
      ]
    );

    await tx.query(`DELETE FROM interview_library_template_questions WHERE template_id = ?`, [
      params.templateId,
    ]);
    for (const [index, question] of params.questions.entries()) {
      await tx.query(
        `INSERT INTO interview_library_template_questions
           (id, template_id, category, question_text, sort_order, answer_type, is_required,
            section_title, help_hint, answer_options, expected_answer_shape, description,
            evidence_prompt, allow_voice, allow_file_upload, allow_url, allow_context_note,
            guidance, example_answer, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          question.id || uuidv4(),
          params.templateId,
          question.category || 'strategy',
          String(question.questionText).trim(),
          Number.isFinite(Number(question.sortOrder)) ? Number(question.sortOrder) : index,
          question.answerType || 'open',
          Boolean(question.isRequired),
          question.sectionTitle || null,
          question.helpHint || null,
          JSON.stringify(Array.isArray(question.answerOptions) ? question.answerOptions : []),
          question.expectedAnswerShape || null,
          question.description || null,
          question.evidencePrompt || null,
          question.allowVoice ? 1 : 0,
          question.allowFileUpload ? 1 : 0,
          question.allowUrl ? 1 : 0,
          question.allowContextNote === false ? 0 : 1,
          question.guidance || null,
          question.exampleAnswer || null,
          now,
        ]
      );
    }
    await testFaultInjector?.('live-updated');

    const updated = (
      await tx.query<TemplateRow>(
        `SELECT * FROM interview_library_templates WHERE id = ? AND organization_id = ?`,
        [params.templateId, params.organizationId]
      )
    ).rows[0];
    const updatedQuestions = await readQuestions(tx, params.templateId);
    const snapshot = await insertSnapshot({
      tx,
      template: updated,
      organizationId: params.organizationId,
      actorId: params.actorId,
      version: nextVersion,
      questions: updatedQuestions,
    });
    await testFaultInjector?.('snapshot-created');
    return { templateId: params.templateId, version: nextVersion, snapshot };
  });
}

export async function getPublishedInterviewTemplateSnapshot(
  organizationId: string,
  templateId: string,
  version: number
): Promise<PublishedTemplateSnapshot | null> {
  const row = await withPgTransaction(async (tx) => {
    const result = await tx.query<{ snapshot_json: PublishedTemplateSnapshot | string }>(
      `SELECT v.snapshot_json
       FROM interview_library_template_versions v
       JOIN interview_library_templates t ON t.id = v.template_id
       WHERE v.template_id = ? AND v.version = ?
         AND (
           v.organization_id = ?
           OR (
             v.organization_id = 'system'
             AND COALESCE(NULLIF(t.template_scope, ''), CASE WHEN t.organization_id IS NULL THEN 'system' ELSE 'organization' END) = 'system'
           )
         )
       ORDER BY CASE WHEN v.organization_id = ? THEN 0 ELSE 1 END
       LIMIT 1`,
      [templateId, version, organizationId, organizationId]
    );
    return result.rows[0] ?? null;
  });
  if (!row) return null;
  return typeof row.snapshot_json === 'string' ? JSON.parse(row.snapshot_json) : row.snapshot_json;
}

/**
 * System templates are product-owned, immutable inputs. Unlike organization and
 * private templates, they cannot be published by a tenant actor. Materialize
 * their current approved shape exactly once when the first governed assignment
 * needs it, then reuse the global immutable version for every tenant.
 */
export async function ensureSystemInterviewTemplateSnapshotForAssignment(params: {
  templateId: string;
  version: number;
}): Promise<PublishedTemplateSnapshot> {
  return withPgTransaction(async (tx) => {
    const templateResult = await tx.query<TemplateRow>(
      `SELECT * FROM interview_library_templates WHERE id = ? FOR UPDATE`,
      [params.templateId]
    );
    const template = templateResult.rows[0];
    if (!template || normalizedScope(template) !== 'system') {
      throw new TemplatePublicationError(
        'SYSTEM_TEMPLATE_NOT_FOUND',
        404,
        'System template not found'
      );
    }
    const storedVersion = Number(template.version || 0);
    if (
      String(template.status || '').toLowerCase() !== 'approved' ||
      !Number.isInteger(params.version) ||
      params.version < 1 ||
      params.version !== storedVersion
    ) {
      throw new TemplatePublicationError(
        'SYSTEM_TEMPLATE_VERSION_NOT_APPROVED',
        409,
        'The selected system template version is not approved'
      );
    }

    const existing = await tx.query<{ snapshot_json: PublishedTemplateSnapshot | string }>(
      `SELECT snapshot_json FROM interview_library_template_versions
       WHERE template_id = ? AND version = ?`,
      [params.templateId, params.version]
    );
    if (existing.rows[0]) {
      const value = existing.rows[0].snapshot_json;
      return typeof value === 'string' ? JSON.parse(value) : value;
    }

    const questions = await readQuestions(tx, params.templateId);
    if (questions.length === 0) {
      throw new TemplatePublicationError(
        'SYSTEM_TEMPLATE_QUESTIONS_REQUIRED',
        409,
        'The selected system template has no published questions'
      );
    }
    const snapshot: PublishedTemplateSnapshot = {
      template: { ...template, version: params.version, status: 'approved' },
      questions,
    };
    await tx.query(
      `INSERT INTO interview_library_template_versions
         (id, template_id, organization_id, version, snapshot_json, published_by)
       VALUES (?, ?, 'system', ?, ?::jsonb, 'system')
       ON CONFLICT (template_id, version) DO NOTHING`,
      [uuidv4(), params.templateId, params.version, JSON.stringify(snapshot)]
    );
    const persisted = await tx.query<{
      snapshot_json: PublishedTemplateSnapshot | string;
    }>(
      `SELECT snapshot_json FROM interview_library_template_versions
       WHERE template_id = ? AND version = ?`,
      [params.templateId, params.version]
    );
    const value = persisted.rows[0]?.snapshot_json;
    if (!value) {
      throw new TemplatePublicationError(
        'SYSTEM_TEMPLATE_SNAPSHOT_FAILED',
        500,
        'System template snapshot could not be persisted'
      );
    }
    return typeof value === 'string' ? JSON.parse(value) : value;
  });
}
