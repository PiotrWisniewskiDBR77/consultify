#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Reports Test Data Seeder
 * Seeds 10 sample reports for the Reports Hub UI.
 *
 * Report statuses: DRAFT, PUBLISHED, APPROVED, ARCHIVED
 *
 * Usage:
 *   cd server && NODE_ENV=development DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/seed-reports-test-data.ts
 */

import { createDatabase } from '../src/database/Database.js';

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

// Reports use simpler status: draft, final, archived
type ReportStatus = 'draft' | 'final' | 'archived';

type SeedReport = {
  id: string;
  title: string;
  status: ReportStatus;
  version: number;
  updatedAtDaysAgo: number;
};

const DEFAULT_ORG_ID = 'org-dbr77-system';

// 10 reports with various statuses
const seed: SeedReport[] = [
  // Draft (4)
  {
    id: 'report-draft-drd-q1',
    title: 'Q1 2026 DRD Assessment Report',
    status: 'draft',
    version: 1,
    updatedAtDaysAgo: 0,
  },
  {
    id: 'report-draft-exec-monthly',
    title: 'January 2026 Executive Summary',
    status: 'draft',
    version: 1,
    updatedAtDaysAgo: 1,
  },
  {
    id: 'report-draft-initiative-cloud',
    title: 'Cloud Migration Progress Report',
    status: 'draft',
    version: 1,
    updatedAtDaysAgo: 2,
  },
  {
    id: 'report-draft-siri',
    title: 'SIRI Assessment Draft',
    status: 'draft',
    version: 1,
    updatedAtDaysAgo: 3,
  },

  // Final (4)
  {
    id: 'report-final-siri-i40',
    title: 'Industry 4.0 Readiness Report',
    status: 'final',
    version: 2,
    updatedAtDaysAgo: 10,
  },
  {
    id: 'report-final-progress-q4',
    title: 'Q4 2025 Progress Report',
    status: 'final',
    version: 3,
    updatedAtDaysAgo: 30,
  },
  {
    id: 'report-final-devops',
    title: 'DevOps Transformation Status',
    status: 'final',
    version: 2,
    updatedAtDaysAgo: 5,
  },
  {
    id: 'report-final-cmmi',
    title: 'Development Process Maturity Report',
    status: 'final',
    version: 4,
    updatedAtDaysAgo: 14,
  },

  // Archived (2)
  {
    id: 'report-archived-lean',
    title: 'Lean Process Optimization Final Report',
    status: 'archived',
    version: 5,
    updatedAtDaysAgo: 60,
  },
  {
    id: 'report-archived-q3',
    title: 'Q3 2025 Progress Report',
    status: 'archived',
    version: 3,
    updatedAtDaysAgo: 90,
  },
];

async function main() {
  console.log('\n🚀 Reports Test Data Seeder (10 reports)\n');

  const db = await createDatabase();

  // Determine org from existing users
  const userQuery = await db.query(`SELECT id, organization_id FROM users LIMIT 1`, []);
  const orgId = userQuery?.rows?.[0]?.organization_id || DEFAULT_ORG_ID;
  const userId = userQuery?.rows?.[0]?.id || 'user-system';

  log.info(`Seeding ${seed.length} reports into org ${orgId}`);

  // Table already exists in schema - just insert data
  for (const r of seed) {
    const now = new Date().toISOString();
    const updatedAt = isoDaysAgo(r.updatedAtDaysAgo);
    const blockOrder = JSON.stringify([]);
    const sources = JSON.stringify({ seeded: true });

    await db.query(
      `INSERT INTO reports (id, organization_id, title, status, version, block_order, sources, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         organization_id=excluded.organization_id,
         title=excluded.title,
         status=excluded.status,
         version=excluded.version,
         block_order=excluded.block_order,
         sources=excluded.sources,
         updated_at=excluded.updated_at`,
      [r.id, orgId, r.title, r.status, r.version, blockOrder, sources, now, updatedAt]
    );
    log.step(`Upserted: ${r.title} (${r.status}, v${r.version})`);
  }

  log.success(`Reports test data seeded successfully! (${seed.length} records)`);
}

main().catch((err) => {
  log.error(String(err?.message || err));
  process.exit(1);
});
