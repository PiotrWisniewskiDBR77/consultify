#!/usr/bin/env tsx
/**
 * Idempotent dev/staging seed for the Interview Insight Full PASS flow.
 *
 * Usage:
 *   SEED_INTERVIEW_INSIGHT_PASS_CONFIRM=YES \
 *   DB_TYPE=postgres \
 *   npx tsx server/scripts/seed-interview-insight-full-pass-flow.ts
 */
import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

dotenv.config({ path: process.env.ENV_FILE || '.env.staging.local' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { getDatabase } from '../src/database/Database.js';
import * as DbPromise from '../src/utils/DbPromise.js';

const CONFIRM = 'YES';
const fixturePath = path.resolve('server/fixtures/interview-insight-full-pass-flow.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function nowIso(): string {
  return new Date().toISOString();
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
       ) as exists`,
      [tableName, columnName],
      { fallback: true }
    );
    if (row?.exists) return true;
  } catch {
    // Fall through to SQLite probe.
  }

  try {
    const rows = await DbPromise.all<{ name?: string }>(`PRAGMA table_info(${tableName})`, [], {
      fallback: true,
    });
    return rows.some((row) => row.name === columnName);
  } catch {
    return false;
  }
}

async function ensureColumn(table: string, column: string, ddl: string): Promise<void> {
  if (await columnExists(table, column)) return;
  await DbPromise.run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`, [], { fallback: true });
}

async function ensureLineageColumns(): Promise<void> {
  await DbPromise.run(
    `CREATE TABLE IF NOT EXISTS generated_workbooks (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      prompt TEXT,
      schema_json TEXT,
      sheet_count INTEGER DEFAULT 1,
      file_name TEXT,
      file_size INTEGER,
      validation_errors TEXT,
      quality_score REAL,
      pipeline_log TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    [],
    { fallback: true }
  );

  for (const table of ['initiatives', 'my_ideas', 'generated_workbooks']) {
    await ensureColumn(table, 'action_contract_json', "action_contract_json TEXT DEFAULT '{}'");
    await ensureColumn(table, 'source_pack_json', "source_pack_json TEXT DEFAULT '{}'");
    await ensureColumn(table, 'evidence_refs_json', "evidence_refs_json TEXT DEFAULT '[]'");
  }
  await ensureColumn(
    'presentation_decks',
    'source_refs_json',
    "source_refs_json TEXT DEFAULT '{}'"
  );
}

async function seedIdentity(): Promise<void> {
  const now = nowIso();
  await DbPromise.run(
    `INSERT INTO organizations (id, name, plan, status, created_at)
     VALUES (?, ?, 'demo', 'active', ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = 'active'`,
    [fixture.organizationId, 'Interview Insight PASS Fixture Org', now],
    { fallback: true }
  );

  await DbPromise.run(
    `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at)
     VALUES (?, ?, ?, 'dev-fixture-not-for-login', 'Interview', 'Owner', 'ADMIN', 'active', ?)
     ON CONFLICT(id) DO UPDATE SET organization_id = excluded.organization_id, email = excluded.email`,
    [fixture.userId, fixture.organizationId, 'interview.pass.fixture@example.invalid', now],
    { fallback: true }
  );

  await DbPromise.run(
    `INSERT INTO projects (id, organization_id, name, description, status, owner_id, created_at, updated_at)
     VALUES (?, ?, 'Interview Insight PASS Flow', 'Controlled fixture for Interview Insight full PASS verification.', 'active', ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
    [fixture.projectId, fixture.organizationId, fixture.userId, now, now],
    { fallback: true }
  );
}

async function seedInterviewMaterial(): Promise<void> {
  const now = nowIso();
  // Liczniki sesji MUSZĄ wynikać z materiału fixture'a, nie być wpisane na sztywno.
  // Wcześniej każda sesja dostawała `total_questions = answered_questions = 3`,
  // podczas gdy fixture niesie po JEDNEJ odpowiedzi na sesję — fixture sam
  // produkował więc rozjazd licznika, który mamy tu wykrywać.
  const answersBySession = new Map<string, number>();
  for (const answer of fixture.approvedCompletedMaterial.answers) {
    answersBySession.set(answer.sessionId, (answersBySession.get(answer.sessionId) || 0) + 1);
  }

  for (const sessionId of fixture.approvedCompletedMaterial.sessionIds) {
    const answeredCount = answersBySession.get(sessionId) || 0;
    await DbPromise.run(
      `INSERT INTO interview_sessions (
        id, organization_id, project_id, name, owner_id, status,
        total_questions, answered_questions, template_id, completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = 'completed', total_questions = excluded.total_questions, answered_questions = excluded.answered_questions, updated_at = excluded.updated_at`,
      [
        sessionId,
        fixture.organizationId,
        fixture.projectId,
        `PASS source session ${sessionId}`,
        fixture.userId,
        answeredCount,
        answeredCount,
        fixture.approvedCompletedMaterial.templateId,
        now,
        now,
        now,
      ],
      { fallback: true }
    );
  }

  // M03R-003 — fixture pisze do KANONICZNEGO magazynu odpowiedzi.
  //
  // Do 2026-08-04 ten seed wstawiał wiersze do `interview_answers`. Ta tabela
  // nie ma w produkcie ANI JEDNEGO czytelnika (remanent: 0 odwołań w `server/src`
  // i `src/`), a bieżący stan odpowiedzi trzyma `interview_questions.answer_text`
  // + `status='answered'` — to z niego `updateSessionProgress()` liczy
  // `answered_questions`. Skutek starego zapisu: sesja z licznikiem 3, w której
  // aplikacja nie widzi żadnej odpowiedzi, czyli dokładnie kształt „submitted
  // z progresem 0%" obserwowany na demo. Fixture musi produkować stan, który
  // produkt potrafi odczytać — inaczej testuje coś, czego użytkownik nie zobaczy.
  for (const answer of fixture.approvedCompletedMaterial.answers) {
    await DbPromise.run(
      `INSERT INTO interview_questions (
        id, session_id, organization_id, category, question_text, answer_text,
        status, confidence_score, answered_by, answered_at, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, 'handoff', ?, ?, 'answered', 5, ?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = 'answered', answer_text = excluded.answer_text, updated_at = excluded.updated_at`,
      [
        answer.answerId,
        answer.sessionId,
        fixture.organizationId,
        'What is blocking reliable onboarding handoffs?',
        answer.excerpt,
        fixture.userId,
        now,
        now,
        now,
      ],
      { fallback: true }
    );
  }
}

async function seedInsight(): Promise<void> {
  const now = nowIso();
  const insight = fixture.insight;
  await DbPromise.run(
    `INSERT INTO interview_insights (
      id, session_id, organization_id, category, title, description, insight_type, impact_level, confidence,
      status, created_by, created_at, updated_at, prompt_type, source_session_ids, content,
      source_session_count, custom_prompt, executive_summary, themes_json, evidence_map_json,
      material_quality_json, generation_context_json, analysis_scope_json, context_mode, analysis_mode, topic_focus_json
    ) VALUES (?, ?, ?, 'consulting', ?, ?, 'governance_gap', 'high', ?, 'completed', ?, ?, ?, 'custom', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = 'completed',
      content = excluded.content,
      material_quality_json = excluded.material_quality_json,
      generation_context_json = excluded.generation_context_json,
      updated_at = excluded.updated_at`,
    [
      insight.id,
      fixture.approvedCompletedMaterial.sessionIds[0],
      fixture.organizationId,
      insight.title,
      insight.content,
      insight.confidence,
      fixture.userId,
      now,
      now,
      JSON.stringify(fixture.approvedCompletedMaterial.sessionIds),
      insight.content,
      fixture.approvedCompletedMaterial.sessionIds.length,
      insight.leadingQuestion,
      insight.content,
      JSON.stringify([
        {
          title: insight.title,
          confidence: insight.confidence,
          evidence_refs: fixture.p10.finding.evidenceRefs,
        },
      ]),
      JSON.stringify({ evidenceRefs: fixture.p10.finding.evidenceRefs }),
      JSON.stringify(insight.materialQuality),
      JSON.stringify(insight.generationContext),
      JSON.stringify(insight.generationContext.analysisScope),
      insight.contextMode,
      insight.analysisMode,
      JSON.stringify(insight.topicFocus),
    ],
    { fallback: true }
  );
}

async function seedP10(): Promise<void> {
  const now = nowIso();
  const finding = fixture.p10.finding;
  await DbPromise.run(
    `INSERT INTO interview_insight_findings (
      id, organization_id, insight_id, source_section_type, source_key, finding_statement,
      confidence_level, limits_text, limits_json, next_action_text, next_action_json,
      review_status, readback_status, readback_summary, readback_updated_at,
      created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, 'candidate', ?, ?, 'high', ?, '[]', ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      review_status = excluded.review_status,
      readback_status = excluded.readback_status,
      readback_summary = excluded.readback_summary,
      updated_at = excluded.updated_at`,
    [
      finding.id,
      fixture.organizationId,
      fixture.insight.id,
      fixture.p10.candidate.id,
      finding.statement,
      fixture.insight.materialQuality.recommendation,
      'Create initiative draft with owner and readiness checklist.',
      finding.reviewStatus,
      finding.readbackStatus,
      finding.readbackSummary,
      now,
      fixture.userId,
      fixture.userId,
      now,
      now,
    ],
    { fallback: true }
  );

  for (const ref of finding.evidenceRefs) {
    await DbPromise.run(
      `INSERT INTO interview_insight_evidence_pointers (
        id, organization_id, insight_id, finding_id, pointer_type, source_ref,
        source_fingerprint, captured_excerpt, captured_at, pointer_state, metadata_json, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'interview_answer', ?, ?, ?, ?, 'active', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET pointer_state = 'active', updated_at = excluded.updated_at`,
      [
        `evidence-${ref}`,
        fixture.organizationId,
        fixture.insight.id,
        finding.id,
        ref,
        ref,
        ref,
        now,
        JSON.stringify({ fixture: fixture.fixture }),
        fixture.userId,
        now,
        now,
      ],
      { fallback: true }
    );
  }
}

async function seedDownstreamActions(): Promise<void> {
  const now = nowIso();
  const sourcePackJson = JSON.stringify(fixture.sourcePack);
  const actionContractJson = JSON.stringify(fixture.actionContract);
  const evidenceRefsJson = JSON.stringify(fixture.actionContract.lineage.evidenceRefs);

  await DbPromise.run(
    `INSERT INTO my_ideas (
      id, user_id, organization_id, title, body, tags, source_type, source_conversation_id,
      action_contract_json, source_pack_json, evidence_refs_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'interview_insight', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET action_contract_json = excluded.action_contract_json, updated_at = excluded.updated_at`,
    [
      'idea-pass-onboarding-handoff',
      fixture.userId,
      fixture.organizationId,
      'Idea: onboarding handoff readiness checklist',
      fixture.insight.content,
      JSON.stringify(['interview-insight', 'full-pass-fixture']),
      fixture.insight.id,
      actionContractJson,
      sourcePackJson,
      evidenceRefsJson,
      now,
      now,
    ],
    { fallback: true }
  );

  await DbPromise.run(
    `INSERT INTO generated_workbooks (
      id, organization_id, title, description, prompt, schema_json, sheet_count, file_name,
      file_size, validation_errors, quality_score, pipeline_log,
      action_contract_json, source_pack_json, evidence_refs_json, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 2, ?, 1024, NULL, 0.95, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET action_contract_json = excluded.action_contract_json`,
    [
      'workbook-pass-onboarding-handoff',
      fixture.organizationId,
      'Table: onboarding handoff action ledger',
      'Structured table from Interview Insight PASS fixture.',
      fixture.insight.leadingQuestion,
      JSON.stringify({
        title: 'Onboarding handoff action ledger',
        sheets: [{ name: 'Evidence' }, { name: 'Actions' }],
      }),
      'onboarding-handoff-action-ledger.xlsx',
      JSON.stringify([{ step: 'seeded' }]),
      actionContractJson,
      sourcePackJson,
      evidenceRefsJson,
      fixture.userId,
      now,
    ],
    { fallback: true }
  );

  await DbPromise.run(
    `INSERT INTO notebook_pages (
      id, owner_user_id, organization_id, project_id, visibility, title, content_json, content_text,
      tags_json, maturity, status, capture_source, capture_metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'project', ?, ?, ?, ?, 'seed', 'active', 'interview_insight', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET capture_metadata = excluded.capture_metadata, updated_at = excluded.updated_at`,
    [
      'note-pass-onboarding-handoff',
      fixture.userId,
      fixture.organizationId,
      fixture.projectId,
      'Note: onboarding handoff governance gap',
      JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: fixture.insight.content }] },
        ],
      }),
      fixture.insight.content,
      JSON.stringify(['interview-insight', 'full-pass-fixture']),
      JSON.stringify({
        sourceType: 'interview_insight',
        sourceId: fixture.insight.id,
        actionContract: fixture.actionContract,
        sourcePack: fixture.sourcePack,
        evidenceRefs: fixture.actionContract.lineage.evidenceRefs,
      }),
      now,
      now,
    ],
    { fallback: true }
  );

  await DbPromise.run(
    `INSERT INTO initiatives (
      id, organization_id, project_id, name, title, category, priority, impact, effort,
      summary, hypothesis, status, problem_statement, source_type, source_id,
      action_contract_json, source_pack_json, evidence_refs_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'interview-initiative-draft', 'medium', 'medium', 'medium', ?, ?, 'DRAFT', ?, 'interview_insight', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET action_contract_json = excluded.action_contract_json, updated_at = excluded.updated_at`,
    [
      'initiative-pass-onboarding-handoff',
      fixture.organizationId,
      fixture.projectId,
      'Initiative: onboarding handoff readiness owner',
      'Initiative: onboarding handoff readiness owner',
      fixture.insight.content,
      fixture.p10.finding.statement,
      fixture.insight.materialQuality.recommendation,
      fixture.insight.id,
      actionContractJson,
      sourcePackJson,
      evidenceRefsJson,
      now,
      now,
    ],
    { fallback: true }
  );

  await DbPromise.run(
    `INSERT INTO presentation_decks (
      id, organization_id, project_id, title, description, deck_type, theme, source_refs_json,
      slide_count, status, source_type, source_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'custom', 'modern', ?, 3, 'draft', 'interview_insight', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET source_refs_json = excluded.source_refs_json, updated_at = excluded.updated_at`,
    [
      'deck-pass-onboarding-handoff',
      fixture.organizationId,
      fixture.projectId,
      'Presentation: onboarding handoff governance gap',
      fixture.insight.content,
      JSON.stringify({
        source: { type: 'interview_insight', id: fixture.insight.id },
        actionContract: fixture.actionContract,
        sourcePack: fixture.sourcePack,
        evidenceRefs: fixture.actionContract.lineage.evidenceRefs,
      }),
      fixture.insight.id,
      now,
      now,
    ],
    { fallback: true }
  );

  await DbPromise.run(
    `INSERT INTO report_builder_reports (
      id, organization_id, project_id, source_type, source_id, source_name, title, description,
      report_type, config_json, company_context_json, status, created_by, created_at, updated_at, version
    ) VALUES (?, ?, ?, 'INTERVIEW', ?, ?, ?, ?, 'INTERVIEW', ?, '{}', 'CONFIGURING', ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET config_json = excluded.config_json, updated_at = excluded.updated_at`,
    [
      'report-pass-onboarding-handoff',
      fixture.organizationId,
      fixture.projectId,
      fixture.insight.id,
      fixture.insight.title,
      'Report: onboarding handoff governance gap',
      fixture.insight.content,
      JSON.stringify({
        sourceSubType: 'interview_insight',
        actionContract: fixture.actionContract,
        sourcePack: fixture.sourcePack,
        evidenceRefs: fixture.actionContract.lineage.evidenceRefs,
      }),
      fixture.userId,
      now,
      now,
    ],
    { fallback: true }
  );
}

async function main(): Promise<void> {
  if (process.env.SEED_INTERVIEW_INSIGHT_PASS_CONFIRM !== CONFIRM) {
    throw new Error(`Refusing to seed without SEED_INTERVIEW_INSIGHT_PASS_CONFIRM=${CONFIRM}`);
  }
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new Error('Refusing to run in NODE_ENV=production');
  }

  await getDatabase();
  await ensureLineageColumns();
  await seedIdentity();
  await seedInterviewMaterial();
  await seedInsight();
  await seedP10();
  await seedDownstreamActions();

  console.log('[seed-interview-insight-full-pass-flow] Seeded fixture:', {
    organizationId: fixture.organizationId,
    projectId: fixture.projectId,
    insightId: fixture.insight.id,
    downstreamActions: fixture.downstreamActions,
  });
}

main()
  .catch((error) => {
    console.error('[seed-interview-insight-full-pass-flow] Failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode || 0), 50);
  });
