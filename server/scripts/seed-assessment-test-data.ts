#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Assessment Test Data Seeder
 * Seeds 3 realistic DRD assessments for the Assessment Hub + DRD editor.
 *
 * IMPORTANT:
 * - This seeds the workflow v2-compatible `assessments` schema (answers_json, context_snapshot, etc.)
 * - The resulting assessments are openable in `/assessment/drd/:assessmentId`
 *
 * Usage:
 *   cd server && NODE_ENV=development DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/seed-assessment-test-data.ts
 */

import { createDatabase } from '../src/database/Database.js';
import { DRD_STRUCTURE } from '../../src/services/drdStructure';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

const log = {
  info: (msg: string) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg: string) => console.log(`${colors.dim}  → ${msg}${colors.reset}`),
};

function isoDaysAgo(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

type AssessmentType = 'DRD';
type AssessmentStatus = 'DRAFT' | 'IN_REVIEW' | 'AWAITING_APPROVAL' | 'APPROVED';

type SeedAssessment = {
  id: string;
  name: string;
  assessment_type: AssessmentType;
  status: AssessmentStatus;
  completionPercent: number;
  confidenceAvg: number;
  updatedAtDaysAgo: number;
  answers: Record<string, any>;
  contextSnapshot: Record<string, any>;
  scoreSummary: Record<string, any>;
  report?: { status: 'DRAFT' | 'APPROVED'; content: Record<string, any> } | null;
};

const DEFAULT_ORG_ID = 'org-dbr77-system';

type AreaState = {
  achievedLevel: number;
  targetLevel?: number;
  levelNotes?: Record<string, string>;
  levelLinks?: Record<string, string[]>;
  levelDecisions?: Record<string, 'skip'>;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getAllDrdAreas(): Array<{ axisId: number; levelCount: number; areaId: string }> {
  const out: Array<{ axisId: number; levelCount: number; areaId: string }> = [];
  for (const axis of DRD_STRUCTURE) {
    for (const area of axis.areas) {
      out.push({ axisId: axis.id, levelCount: axis.levelCount || 5, areaId: area.id });
    }
  }
  return out;
}

function buildDrdAreas(params: {
  coverage: number; // 0..1
  maturityByAxis: Partial<Record<number, { achieved: number; target: number }>>;
  focusNotes?: Partial<Record<string, string>>;
  focusLinks?: Partial<Record<string, string[]>>;
}): Record<string, AreaState> {
  const all = getAllDrdAreas();
  const total = all.length || 1;
  const cutoff = Math.round(total * clamp(params.coverage, 0, 1));

  const areas: Record<string, AreaState> = {};
  for (let idx = 0; idx < all.length; idx++) {
    const { axisId, levelCount, areaId } = all[idx];
    const base = params.maturityByAxis[axisId] || { achieved: 0, target: 0 };
    const isIncluded = idx < cutoff;

    // Small deterministic variation by index to avoid all-equal scores.
    const wobble = (idx % 3) - 1; // -1, 0, +1
    const achieved = isIncluded ? clamp(base.achieved + wobble, 0, levelCount) : 0;
    const target = isIncluded ? clamp(base.target, 1, levelCount) : 0;

    const note = params.focusNotes?.[areaId];
    const links = params.focusLinks?.[areaId];

    areas[areaId] = {
      achievedLevel: achieved,
      ...(target > 0 ? { targetLevel: target } : {}),
      ...(note
        ? {
            levelNotes: {
              [String(Math.max(1, achieved || 1))]: note,
            },
          }
        : {}),
      ...(links && links.length
        ? {
            levelLinks: {
              [String(Math.max(1, achieved || 1))]: links,
            },
          }
        : {}),
      ...(isIncluded && achieved === 0
        ? {
            // Explicitly mark the first level as intentionally skipped (enterprise-friendly).
            levelDecisions: { '1': 'skip' },
          }
        : {}),
    };
  }
  return areas;
}

function calcCompletionPercentFromAnswers(answers: any): number {
  const areas = answers?.drd?.areas || {};
  const all = getAllDrdAreas();
  const total = all.length || 1;
  let answered = 0;
  for (const { axisId, levelCount, areaId } of all) {
    const s = areas?.[areaId];
    const hasAchieved = Number(s?.achievedLevel || 0) > 0;
    const hasTarget = Number(s?.targetLevel || 0) > 0;
    const hasDecisions = s?.levelDecisions && Object.keys(s.levelDecisions || {}).length > 0;
    const hasNotes =
      s?.levelNotes && Object.values(s.levelNotes || {}).some((v: any) => String(v || '').trim());
    const hasLinks =
      s?.levelLinks &&
      Object.values(s.levelLinks || {}).some((arr: any) => Array.isArray(arr) && arr.length > 0);
    if (hasAchieved || hasTarget || hasDecisions || hasNotes || hasLinks) answered += 1;
    // suppress unused warnings for levelCount in case of future rules
    void axisId;
    void levelCount;
  }
  return Math.round((answered / total) * 100);
}

const seed: SeedAssessment[] = [
  {
    id: 'drd-audit-q1-2026',
    name: 'DRD Audit — Enterprise Readiness (Q1 2026)',
    assessment_type: 'DRD',
    status: 'APPROVED',
    completionPercent: 100,
    confidenceAvg: 3.4,
    updatedAtDaysAgo: 0,
    answers: {
      drd: {
        areas: buildDrdAreas({
          coverage: 1,
          maturityByAxis: {
            1: { achieved: 4, target: 6 },
            2: { achieved: 3, target: 5 },
            3: { achieved: 3, target: 5 },
            4: { achieved: 4, target: 6 },
            5: { achieved: 3, target: 5 },
            6: { achieved: 3, target: 5 },
            7: { achieved: 2, target: 4 },
          },
          focusNotes: {
            '1F': 'OEE i CMMS są w użyciu, ale MES nie jest jeszcze spójnie wdrożony na wszystkich liniach.',
            '4D': 'BI/DWH działa, ale jakość danych jest nierówna między zakładami; brakuje formalnego DQ governance.',
            '6A': 'Ryzyka są identyfikowane, ale nie ma cyklicznego przeglądu ryzyk OT/IT i mierników skuteczności kontroli.',
            '7B': 'Pierwsze use-case AI (planowanie i predykcja) w pilotażu; brak MLOps i stałego monitoringu driftu.',
          },
          focusLinks: {
            '1F': [
              'https://intranet.example.com/oee-dashboard',
              'https://intranet.example.com/cmms',
            ],
            '6A': ['https://intranet.example.com/security/policies'],
          },
        }),
      },
    },
    contextSnapshot: {
      audit: {
        phase: 'APPROVAL',
        notes:
          'Audit zakończony. Dane kompletne (DoD), raport zatwierdzony. Gotowe do generowania inicjatyw.',
      },
      scope: {
        plants: 3,
        businessUnits: ['Production', 'Supply Chain', 'Sales'],
        timeframe: '2026-Q1',
      },
    },
    scoreSummary: {
      overall: { actual: 3.4, target: 5.3, gap: 1.9 },
      seeded: true,
    },
    report: {
      status: 'APPROVED',
      content: {
        executiveSummary:
          'Q1 2026 DRD: organizacja ma solidne fundamenty procesowe i danych, największe luki dotyczą MES/OT integracji oraz governance AI.',
        generatedAt: new Date().toISOString(),
      },
    },
  },
  {
    id: 'drd-audit-manufacturing-2026-02',
    name: 'DRD Audit — Manufacturing Division (Feb 2026)',
    assessment_type: 'DRD',
    status: 'IN_REVIEW',
    completionPercent: 100,
    confidenceAvg: 3.1,
    updatedAtDaysAgo: 1,
    answers: {
      drd: {
        areas: buildDrdAreas({
          coverage: 1,
          maturityByAxis: {
            1: { achieved: 3, target: 5 },
            2: { achieved: 2, target: 4 },
            3: { achieved: 2, target: 4 },
            4: { achieved: 3, target: 5 },
            5: { achieved: 2, target: 4 },
            6: { achieved: 2, target: 4 },
            7: { achieved: 1, target: 3 },
          },
          focusNotes: {
            '1D': 'MRP działa, ale workflow zakupowy nadal częściowo w mailach; brak pełnej ścieżki akceptacji w systemie.',
            '4A': 'Dane z maszyn zbierane selektywnie; brak standaryzacji tagów i spójnej rozdzielczości pomiaru.',
          },
        }),
      },
    },
    contextSnapshot: {
      audit: {
        phase: 'REVIEW',
        notes:
          'W trakcie review: uzupełnić dowody dla 4A/4D, potwierdzić mapping MES oraz zaktualizować targety na osi 1.',
      },
      scope: { plants: 1, businessUnits: ['Production'], timeframe: '2026-02' },
    },
    scoreSummary: {
      overall: { actual: 2.8, target: 4.6, gap: 1.8 },
      seeded: true,
    },
    report: null,
  },
  {
    id: 'drd-audit-logistics-2026-02',
    name: 'DRD Audit — Logistics & Supply Chain (Feb 2026)',
    assessment_type: 'DRD',
    status: 'DRAFT',
    completionPercent: 100,
    confidenceAvg: 3.0,
    updatedAtDaysAgo: 2,
    answers: {
      drd: {
        areas: buildDrdAreas({
          coverage: 1,
          maturityByAxis: {
            1: { achieved: 2, target: 4 },
            2: { achieved: 2, target: 4 },
            3: { achieved: 1, target: 3 },
            4: { achieved: 2, target: 4 },
            5: { achieved: 2, target: 4 },
            6: { achieved: 2, target: 4 },
            7: { achieved: 1, target: 3 },
          },
          focusNotes: {
            '1E': 'WMS jest planowany; obecnie identyfikacja głównie barcode bez śledzenia statusu w czasie zbliżonym do real-time.',
          },
        }),
      },
    },
    contextSnapshot: {
      audit: {
        phase: 'FIELDWORK',
        notes: 'W trakcie warsztatów: zebrać artefakty (WMS/EDI, SLA, KPI OTIF).',
      },
      scope: { plants: 1, businessUnits: ['Supply Chain'], timeframe: '2026-02' },
    },
    scoreSummary: {
      overall: { actual: 2.1, target: 4.0, gap: 1.9 },
      seeded: true,
    },
    report: null,
  },
];

async function main() {
  console.log('\n🚀 DRD Assessment Seeder (3 realistic audits)\n');

  const db = await createDatabase();

  const targetOrgFromEnv =
    (process.env.TARGET_ORG_ID ||
      process.env.ORG_ID ||
      process.env.ORGANIZATION_ID ||
      process.env.ORG) ??
    '';

  // Determine org: prefer env override, otherwise pick the org with the most existing assessments,
  // otherwise fall back to DEFAULT_ORG_ID.
  let orgId = targetOrgFromEnv.trim() || '';
  if (!orgId) {
    try {
      const orgCounts = await db.query(
        `SELECT organization_id as orgId, COUNT(*) as count
         FROM assessments
         GROUP BY organization_id
         ORDER BY count DESC`,
        []
      );
      orgId = orgCounts?.rows?.[0]?.orgId || '';
    } catch {
      // ignore
    }
  }
  if (!orgId) orgId = DEFAULT_ORG_ID;

  // Choose a user from that org (fallback to any user / system)
  let userId = 'system';
  try {
    const u = await db.query(`SELECT id FROM users WHERE organization_id = ? LIMIT 1`, [orgId]);
    userId = u?.rows?.[0]?.id || userId;
  } catch {
    // ignore
  }
  if (userId === 'system') {
    try {
      const anyU = await db.query(`SELECT id FROM users LIMIT 1`, []);
      userId = anyU?.rows?.[0]?.id || userId;
    } catch {
      // ignore
    }
  }

  log.info(`Seeding ${seed.length} DRD assessments into org ${orgId}`);

  // Ensure workflow v2 tables exist (minimal subset required for the editor + list).
  await db.query(
    `CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      status TEXT DEFAULT 'DRAFT',
      project_id TEXT,
      assessment_type TEXT NOT NULL,
      name TEXT NOT NULL,
      completion_percent INTEGER DEFAULT 0,
      confidence_avg REAL DEFAULT 0,
      answers_json TEXT DEFAULT '{}',
      context_snapshot TEXT DEFAULT '{}',
      score_summary TEXT DEFAULT '{}',
      navigation_json TEXT DEFAULT '{}',
      review_requested_at TEXT,
      report_approved_at TEXT,
      approved_at TEXT,
      created_by TEXT NOT NULL,
      updated_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    []
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS assessment_sessions (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT
    )`,
    []
  );

  await db.query(
    `CREATE TABLE IF NOT EXISTS assessment_reports (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      status TEXT DEFAULT 'DRAFT',
      content_json TEXT DEFAULT '{}',
      approved_by TEXT,
      approved_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    []
  );

  for (const a of seed) {
    const now = new Date().toISOString();
    const updatedAt = isoDaysAgo(a.updatedAtDaysAgo);
    const completion = a.completionPercent ?? calcCompletionPercentFromAnswers(a.answers || {});

    await db.query(
      `INSERT INTO assessments (
          id, organization_id, project_id, assessment_type, name, status,
          completion_percent, confidence_avg,
          answers_json, context_snapshot, score_summary, navigation_json,
          report_approved_at, approved_at,
          created_by, updated_by, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         organization_id = excluded.organization_id,
         project_id = excluded.project_id,
         assessment_type = excluded.assessment_type,
         name = excluded.name,
         status = excluded.status,
         completion_percent = excluded.completion_percent,
         confidence_avg = excluded.confidence_avg,
         answers_json = excluded.answers_json,
         context_snapshot = excluded.context_snapshot,
         score_summary = excluded.score_summary,
         navigation_json = excluded.navigation_json,
         report_approved_at = excluded.report_approved_at,
         approved_at = excluded.approved_at,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`,
      [
        a.id,
        orgId,
        null,
        a.assessment_type,
        a.name,
        a.status,
        completion,
        a.confidenceAvg,
        JSON.stringify(a.answers || {}),
        JSON.stringify(a.contextSnapshot || {}),
        JSON.stringify(a.scoreSummary || {}),
        JSON.stringify({ axisId: 1, areaId: '1A', level: 1 }),
        a.status === 'APPROVED' ? updatedAt : null,
        a.status === 'APPROVED' ? updatedAt : null,
        userId,
        userId,
        now,
        updatedAt,
      ]
    );

    // Keep a session open so it appears in the submenu (best-effort).
    try {
      await db.query(
        `INSERT INTO assessment_sessions (id, assessment_id, user_id, opened_at, closed_at)
         VALUES (?, ?, ?, ?, NULL)
         ON CONFLICT(id) DO NOTHING`,
        [`sess-${a.id}`, a.id, userId, updatedAt]
      );
    } catch {
      // ignore (older sqlite may not support ON CONFLICT(id) for this schema)
    }

    // Seed an approved report for the approved audit (so Manage gates behave realistically).
    if (a.report && a.report.status === 'APPROVED') {
      const reportId = `report-${a.id}`;
      try {
        await db.query(
          `INSERT INTO assessment_reports (
            id, assessment_id, version, status, content_json, approved_by, approved_at, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            content_json = excluded.content_json,
            approved_by = excluded.approved_by,
            approved_at = excluded.approved_at,
            updated_at = excluded.updated_at`,
          [
            reportId,
            a.id,
            1,
            'APPROVED',
            JSON.stringify(a.report.content || {}),
            userId,
            updatedAt,
            userId,
            updatedAt,
            updatedAt,
          ]
        );
      } catch {
        // ignore
      }
    }

    log.step(
      `Upserted DRD: ${a.name} (${a.status}, ${completion}%, confidence ${a.confidenceAvg})`
    );
  }

  log.success(`DRD assessments seeded successfully! (${seed.length} records)`);
}

main().catch((err) => {
  log.error(String(err?.message || err));
  process.exit(1);
});
