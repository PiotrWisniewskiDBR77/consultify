/**
 * deliverableTemplateSeedService — DBR77 curated template seed data.
 *
 * Exports the template seed constants (consumed by unit tests) and
 * seedDbr77Templates(), which runs the seed SQL idempotently.
 *
 * DEC-461 (F8b, 2026-09-15): every human-facing string here — template names,
 * descriptions, section/slide titles, table field names and option values — is
 * ENGLISH. These rows are written straight into report_builder_templates /
 * presentation_templates / tp_base_templates and are then snapshotted into
 * v8_output_artifacts.title_snapshot, so there is no per-request locale on the
 * read path: a Polish seed would be permanently Polish for every viewer.
 * Polish equivalents ship as a separate PL seed (DEC-461), not from here.
 *
 * The seed normally runs through runTablePlatformMigrations() via
 * server/migrations/784_dbr77_template_seeds.sql (the 7xx_*.sql pattern).
 * That function is the alternative manual path.
 */

import logger from '../utils/Logger.js';
import { queryRun } from '../utils/queryHelpers.js';

// ──────────────────────────────────────────────────────────────────────────────
// Static seed data (source of truth for unit tests)
// ──────────────────────────────────────────────────────────────────────────────

export interface DocTemplateSection {
  key: string;
  type: string;
  title: string;
  order: number;
  required: boolean;
  defaultLength?: string;
  purpose?: string;
}

export interface DocTemplateSeed {
  id: string;
  name: string;
  description: string;
  source_type: string;
  report_type: string;
  is_system: boolean;
  is_public: boolean;
  sections: DocTemplateSection[];
}

export interface DeckTemplateSeed {
  id: string;
  name: string;
  description: string;
  deck_type: string;
  is_system: boolean;
  is_active: boolean;
  outline: Array<{ intent: string; title: string }>;
}

export interface TableTemplateField {
  name: string;
  type: string;
  options?: string[];
}

export interface TableTemplateSeed {
  name: string;
  description: string;
  category: string;
  is_featured: boolean;
  schema_snapshot: { fields: TableTemplateField[] };
}

// ──────────────────────────────────────────────────────────────────────────────

export const DBR77_DOC_TEMPLATES: DocTemplateSeed[] = [
  {
    id: 'dbr77-doc-audit-report',
    name: 'Audit Report',
    description:
      'Structured report from an organizational or process audit. Sections: summary, methodology, findings, recommendations.',
    source_type: 'DELIVERABLE',
    report_type: 'audit_report',
    is_system: true,
    is_public: true,
    sections: [
      {
        key: 'executive_summary',
        type: 'summary',
        title: 'Executive summary',
        order: 0,
        required: true,
        defaultLength: 'short',
        purpose: 'Key findings and recommendations in brief',
      },
      {
        key: 'methodology',
        type: 'methodology',
        title: 'Methodology',
        order: 1,
        required: true,
        defaultLength: 'short',
        purpose: 'Scope and research approach',
      },
      {
        key: 'findings',
        type: 'findings',
        title: 'Findings',
        order: 2,
        required: true,
        defaultLength: 'long',
        purpose: 'Detailed findings by area',
      },
      {
        key: 'recommendations',
        type: 'recommendations',
        title: 'Recommendations',
        order: 3,
        required: true,
        defaultLength: 'medium',
        purpose: 'Action priorities and implementation plan',
      },
    ],
  },
  {
    id: 'dbr77-doc-exec-memo',
    name: 'Executive memo',
    description:
      'A concise decision memo for the board. Sections: context, problem, options, recommendation.',
    source_type: 'DELIVERABLE',
    report_type: 'exec_memo',
    is_system: true,
    is_public: true,
    sections: [
      {
        key: 'context',
        type: 'context',
        title: 'Context',
        order: 0,
        required: true,
        defaultLength: 'short',
        purpose: 'Situation and decision background',
      },
      {
        key: 'problem',
        type: 'findings',
        title: 'Problem',
        order: 1,
        required: true,
        defaultLength: 'short',
        purpose: 'The key challenge to resolve',
      },
      {
        key: 'options',
        type: 'list',
        title: 'Options',
        order: 2,
        required: true,
        defaultLength: 'medium',
        purpose: 'Options with analysis',
      },
      {
        key: 'recommendation',
        type: 'recommendations',
        title: 'Recommendation',
        order: 3,
        required: true,
        defaultLength: 'short',
        purpose: 'Recommended option with rationale',
      },
    ],
  },
  {
    id: 'dbr77-doc-status-report',
    name: 'Status Report',
    description:
      'Periodic project progress report for the sponsor. Sections: status summary, scope, progress, risks, next steps.',
    source_type: 'DELIVERABLE',
    report_type: 'status_report',
    is_system: true,
    is_public: true,
    sections: [
      {
        key: 'status_summary',
        type: 'summary',
        title: 'Status summary',
        order: 0,
        required: true,
        defaultLength: 'short',
        purpose: 'RAG status, key achievements and alerts',
      },
      {
        key: 'scope',
        type: 'context',
        title: 'Scope and objectives',
        order: 1,
        required: true,
        defaultLength: 'short',
        purpose: 'Period objectives and scope of work',
      },
      {
        key: 'progress',
        type: 'findings',
        title: 'Progress and achievements',
        order: 2,
        required: true,
        defaultLength: 'long',
        purpose: 'What was delivered against plan',
      },
      {
        key: 'risks',
        type: 'list',
        title: 'Risks and blockers',
        order: 3,
        required: true,
        defaultLength: 'medium',
        purpose: 'Open risks, blockers, mitigation plan',
      },
      {
        key: 'next_steps',
        type: 'recommendations',
        title: 'Next steps',
        order: 4,
        required: true,
        defaultLength: 'short',
        purpose: 'Priorities and decisions for the next period',
      },
    ],
  },
];

export const DBR77_DECK_TEMPLATES: DeckTemplateSeed[] = [
  {
    id: 'dbr77-deck-board',
    name: 'Board deck',
    description:
      'Presentation for the board or supervisory board. Layout: cover, agenda, context, results, plan, Q&A.',
    deck_type: 'board_presentation',
    is_system: true,
    is_active: true,
    outline: [
      { intent: 'cover', title: 'Title slide' },
      { intent: 'agenda', title: 'Agenda' },
      { intent: 'context', title: 'Context and background' },
      { intent: 'performance_overview', title: 'Results and status' },
      { intent: 'roadmap', title: 'Action plan' },
      { intent: 'next_steps', title: 'Decisions and Q&A' },
    ],
  },
  {
    id: 'dbr77-deck-diagnostic',
    name: 'Diagnostic deck',
    description:
      'Diagnosis of an organization or a process. Layout: thesis, data, analysis, conclusions, recommendations.',
    deck_type: 'diagnostic',
    is_system: true,
    is_active: true,
    outline: [
      { intent: 'cover', title: 'Diagnosis' },
      { intent: 'executive_summary', title: 'Thesis and key conclusions' },
      { intent: 'data_overview', title: 'Data and observations' },
      { intent: 'analysis', title: 'Analysis' },
      { intent: 'key_messages', title: 'Conclusions' },
      { intent: 'recommendations', title: 'Recommendations' },
    ],
  },
  {
    id: 'dbr77-deck-investor-pitch',
    name: 'Investor pitch',
    description:
      'Investor pitch: problem to solution to traction to ask. Layout: cover, thesis, problem/market, solution, model and traction, plan, ask.',
    deck_type: 'investor_pitch',
    is_system: true,
    is_active: true,
    outline: [
      { intent: 'cover', title: 'Investor pitch' },
      { intent: 'executive_summary', title: 'Thesis and the ask' },
      { intent: 'context', title: 'Problem and market' },
      { intent: 'key_messages', title: 'Solution and advantage' },
      { intent: 'performance_overview', title: 'Traction and model' },
      { intent: 'roadmap', title: 'Plan and milestones' },
      { intent: 'next_steps', title: 'The ask and next steps' },
    ],
  },
];

export const DBR77_TABLE_TEMPLATES: TableTemplateSeed[] = [
  {
    name: 'Risk Register',
    description:
      'Table for tracking project or organizational risks. Columns: risk, likelihood, impact, owner, status.',
    category: 'risk',
    is_featured: true,
    schema_snapshot: {
      fields: [
        { name: 'Risk', type: 'text' },
        {
          name: 'Likelihood',
          type: 'singleSelect',
          options: ['Low', 'Medium', 'High'],
        },
        { name: 'Impact', type: 'singleSelect', options: ['Low', 'Medium', 'High'] },
        { name: 'Owner', type: 'text' },
        { name: 'Status', type: 'singleSelect', options: ['Open', 'In progress', 'Closed'] },
      ],
    },
  },
  {
    name: 'KPI Dashboard',
    description:
      'KPI table with targets and current results. Columns: metric, target, actual, variance, trend.',
    category: 'kpi',
    is_featured: true,
    schema_snapshot: {
      fields: [
        { name: 'Metric', type: 'text' },
        { name: 'Target', type: 'number' },
        { name: 'Actual', type: 'number' },
        { name: 'Variance', type: 'number' },
        { name: 'Trend', type: 'singleSelect', options: ['↑ Up', '→ Flat', '↓ Down'] },
      ],
    },
  },
  {
    name: 'Initiative Register',
    description:
      'Table for tracking initiatives and tasks with priority and progress. Columns: initiative, owner, priority, status, progress.',
    category: 'initiative',
    is_featured: true,
    schema_snapshot: {
      fields: [
        { name: 'Initiative', type: 'text' },
        { name: 'Owner', type: 'text' },
        { name: 'Priority', type: 'singleSelect', options: ['High', 'Medium', 'Low'] },
        { name: 'Status', type: 'singleSelect', options: ['Backlog', 'In progress', 'Done'] },
        { name: 'Progress (%)', type: 'number' },
      ],
    },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Seed function (idempotent — SQL migration 784 is the primary path)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Seeds DBR77 curated templates into DB.
 * Idempotent: ON CONFLICT DO NOTHING for doc/deck; WHERE NOT EXISTS for table (UUID PK).
 * The SQL migration 784_dbr77_template_seeds.sql covers the normal startup path.
 * Call this manually only when the migration runner is not available.
 */
export async function seedDbr77Templates(): Promise<void> {
  const TAG = '[deliverableTemplateSeedService]';

  // Doc templates
  for (const t of DBR77_DOC_TEMPLATES) {
    try {
      await queryRun(
        `INSERT INTO report_builder_templates
           (id, organization_id, name, description, source_type, report_type,
            sections_json, is_system, is_public, created_by, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, true, true, NULL, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.name, t.description, t.source_type, t.report_type, JSON.stringify(t.sections)]
      );
    } catch (err: any) {
      logger.warn(`${TAG} Doc template seed skipped (${t.id}): ${err?.message}`);
    }
  }

  // Deck templates
  for (const t of DBR77_DECK_TEMPLATES) {
    try {
      await queryRun(
        `INSERT INTO presentation_templates
           (id, organization_id, name, description, deck_type, audience, goal,
            outline_json, is_system, is_active, created_by, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, $4, 'executive', 'inform', $5, true, true, NULL, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.name, t.description, t.deck_type, JSON.stringify(t.outline)]
      );
    } catch (err: any) {
      logger.warn(`${TAG} Deck template seed skipped (${t.id}): ${err?.message}`);
    }
  }

  // Table templates (UUID PK — no text id to conflict on; guard via name+category)
  for (const t of DBR77_TABLE_TEMPLATES) {
    try {
      await queryRun(
        `INSERT INTO tp_base_templates
           (name, description, category, schema_snapshot, is_featured, status,
            visibility, created_by, created_at)
         SELECT $1, $2, $3, $4::jsonb, $5, 'approved', 'system', NULL, NOW()
         WHERE NOT EXISTS (
           SELECT 1 FROM tp_base_templates WHERE name = $1 AND category = $3
         )`,
        [t.name, t.description, t.category, JSON.stringify(t.schema_snapshot), t.is_featured]
      );
      await queryRun(
        `UPDATE tp_base_templates
            SET status = 'approved', visibility = 'system'
          WHERE name = $1 AND category = $2 AND created_by IS NULL`,
        [t.name, t.category]
      );
    } catch (err: any) {
      logger.warn(`${TAG} Table template seed skipped (${t.name}): ${err?.message}`);
    }
  }

  logger.info(
    `${TAG} DBR77 template seed complete (doc:${DBR77_DOC_TEMPLATES.length}, deck:${DBR77_DECK_TEMPLATES.length}, table:${DBR77_TABLE_TEMPLATES.length})`
  );
}
