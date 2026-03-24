/**
 * SQLite in-memory DDL + reset helpers for artifact substrate integration tests.
 */
import { promisify } from 'node:util';

import type sqlite3 from 'sqlite3';

export async function applyArtifactSubstrateDdl(db: sqlite3.Database): Promise<void> {
  const exec = promisify(db.exec.bind(db));
  await exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS report_builder_reports (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      project_id TEXT,
      source_type TEXT,
      source_id TEXT,
      source_name TEXT,
      source_framework TEXT,
      title TEXT,
      description TEXT,
      report_type TEXT,
      template_id TEXT,
      config_json TEXT,
      company_context_json TEXT,
      status TEXT,
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT,
      version INTEGER,
      report_type_v3 TEXT,
      goal_v3 TEXT,
      communication_register TEXT,
      density TEXT,
      period_from TEXT,
      period_to TEXT,
      confidentiality TEXT,
      source_refs_json TEXT
    );

    CREATE TABLE IF NOT EXISTS report_builder_sections (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      section_key TEXT,
      section_type TEXT,
      title TEXT,
      order_index INTEGER,
      enabled INTEGER,
      required INTEGER,
      length TEXT,
      language TEXT,
      content_format TEXT,
      custom_prompt TEXT,
      block_type_id TEXT,
      block_config_json TEXT,
      render_kind TEXT,
      repeat_for TEXT,
      repeat_key TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS report_builder_templates (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      source_type TEXT,
      report_type TEXT,
      sections_json TEXT,
      is_default INTEGER DEFAULT 0,
      is_public INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS report_builder_activity (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      action_type TEXT,
      action_by TEXT,
      action_at TEXT,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS presentation_decks (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      title TEXT,
      status TEXT,
      deck_type TEXT,
      presentation_mode TEXT,
      slide_count INTEGER,
      export_format TEXT,
      created_at TEXT,
      updated_at TEXT,
      source_id TEXT,
      source_refs_json TEXT
    );

    CREATE TABLE IF NOT EXISTS v8_output_artifacts (
      artifact_id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      output_type TEXT NOT NULL CHECK (output_type IN ('report', 'presentation', 'sheet')),
      artifact_family TEXT CHECK (artifact_family IN ('document', 'presentation', 'sheet')),
      delivery_state TEXT NOT NULL DEFAULT 'draft',
      title_snapshot TEXT,
      owner_user_id TEXT,
      canonical_home TEXT NOT NULL DEFAULT 'outputs_library',
      visibility_scope TEXT NOT NULL DEFAULT 'organization'
        CHECK (visibility_scope IN ('private', 'project', 'organization', 'review_shared', 'demo')),
      project_id TEXT,
      context_snapshot_id TEXT,
      execution_run_id TEXT,
      template_family_ref TEXT,
      source_initiative_id TEXT,
      ai_governance_preset_ref TEXT,
      origin_summary_json TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_transition_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS v8_artifact_origin_links (
      link_id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      origin_runtime TEXT NOT NULL
        CHECK (origin_runtime IN ('report', 'presentation', 'sheet', 'native_artifact')),
      origin_record_id TEXT NOT NULL,
      is_primary_origin INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS v8_artifact_access_grants (
      grant_id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      grant_kind TEXT NOT NULL CHECK (grant_kind IN ('user', 'role')),
      user_id TEXT,
      role_key TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS v8_publish_records (
      record_id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      current_state TEXT NOT NULL DEFAULT 'private_draft',
      published_by TEXT NOT NULL,
      published_at TEXT,
      reviewers TEXT NOT NULL DEFAULT '[]',
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS v8_review_gates (
      gate_id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      review_type TEXT NOT NULL,
      reviewer_id TEXT NOT NULL,
      result TEXT NOT NULL,
      comments TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS v8_artifact_runs (
      run_id TEXT PRIMARY KEY,
      artifact_id TEXT,
      organization_id TEXT NOT NULL,
      execution_run_id TEXT NOT NULL,
      context_snapshot_id TEXT NOT NULL,
      trigger_type TEXT NOT NULL
        CHECK (trigger_type IN ('chat', 'module_action', 'template', 'refresh')),
      source_context_type TEXT,
      source_context_id TEXT,
      requested_by_user_id TEXT NOT NULL,
      plan_json TEXT NOT NULL,
      run_status TEXT NOT NULL DEFAULT 'planned'
        CHECK (run_status IN ('planned', 'proposal_created', 'retry_requested', 'completed', 'failed')),
      proposal_id TEXT,
      retry_of_run_id TEXT,
      failure_reason TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export async function clearArtifactSubstrateTables(db: sqlite3.Database): Promise<void> {
  const run = promisify(db.run.bind(db));
  await run('DELETE FROM v8_artifact_access_grants');
  await run('DELETE FROM v8_artifact_origin_links');
  await run('DELETE FROM v8_review_gates');
  await run('DELETE FROM v8_publish_records');
  await run('DELETE FROM v8_artifact_runs');
  await run('DELETE FROM v8_output_artifacts');
  await run('DELETE FROM report_builder_activity');
  await run('DELETE FROM report_builder_sections');
  await run('DELETE FROM report_builder_templates');
  await run('DELETE FROM report_builder_reports');
  await run('DELETE FROM project_members');
  await run('DELETE FROM projects');
}
