#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Assessment Test Data Seeder
 * Seeds sample assessments for the Assessment Hub UI.
 *
 * Usage:
 *   cd server && NODE_ENV=development DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/seed-assessment-test-data.ts
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

type SeedAssessment = {
  id: string;
  name: string;
  framework_type: 'DRD' | 'ADMA' | 'CMMI' | 'LEAN' | 'SIRI';
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'COMPLETED';
  progress: number;
  overallScore?: number;
  updatedAtDaysAgo: number;
};

const DEFAULT_ORG_ID = 'org-dbr77-system';

const seed: SeedAssessment[] = [
  {
    id: 'assess-drd-q1-2026',
    name: 'Q1 2026 Digital Maturity Assessment',
    framework_type: 'DRD',
    status: 'APPROVED',
    progress: 100,
    overallScore: 3.2,
    updatedAtDaysAgo: 0,
  },
  {
    id: 'assess-adma-ops-ex',
    name: 'Operational Excellence Assessment',
    framework_type: 'ADMA',
    status: 'IN_REVIEW',
    progress: 75,
    overallScore: 2.9,
    updatedAtDaysAgo: 0,
  },
  {
    id: 'assess-cmmi-tech-stack',
    name: 'Technology Stack Audit',
    framework_type: 'CMMI',
    status: 'DRAFT',
    progress: 50,
    overallScore: 2.4,
    updatedAtDaysAgo: 1,
  },
  {
    id: 'assess-lean-4-0',
    name: 'Lean 4.0 Maturity Assessment',
    framework_type: 'LEAN',
    status: 'DRAFT',
    progress: 25,
    overallScore: 2.1,
    updatedAtDaysAgo: 3,
  },
  {
    id: 'assess-siri-i40',
    name: 'Industry 4.0 Readiness Check',
    framework_type: 'SIRI',
    status: 'COMPLETED',
    progress: 100,
    overallScore: 3.6,
    updatedAtDaysAgo: 10,
  },
];

async function main() {
  console.log('\n🚀 Assessment Test Data Seeder\n');

  const db = await createDatabase();

  // Determine org from existing users (matches MyWork seeder behavior)
  const userQuery = await db.query(`SELECT id, organization_id FROM users LIMIT 1`, []);
  const orgId = userQuery?.rows?.[0]?.organization_id || DEFAULT_ORG_ID;

  log.info(`Seeding ${seed.length} assessments into org ${orgId}`);

  for (const a of seed) {
    const now = new Date().toISOString();
    const updatedAt = isoDaysAgo(a.updatedAtDaysAgo);
    const frameworkData = JSON.stringify({
      progress: a.progress,
      overallScore: a.overallScore ?? null,
      seeded: true,
    });

    await db.query(
      `INSERT INTO assessments (id, organization_id, name, description, status, created_at, updated_at, framework_type, framework_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         organization_id=excluded.organization_id,
         name=excluded.name,
         description=excluded.description,
         status=excluded.status,
         updated_at=excluded.updated_at,
         framework_type=excluded.framework_type,
         framework_data=excluded.framework_data`,
      [a.id, orgId, a.name, '', a.status, now, updatedAt, a.framework_type, frameworkData]
    );
    log.step(`Upserted ${a.framework_type}: ${a.name} (${a.status}, ${a.progress}%)`);
  }

  log.success('Assessment test data seeded successfully!');
}

main().catch((err) => {
  log.error(String(err?.message || err));
  process.exit(1);
});
