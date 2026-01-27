#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Assessment Test Data Seeder
 * Seeds 15 sample assessments for the Assessment Hub UI.
 *
 * Uses canonical 11-status initiative lifecycle:
 * DRAFT → REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED → EXECUTING → DONE → TRACKING
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

type FrameworkType = 'DRD' | 'ADMA' | 'CMMI' | 'LEAN' | 'SIRI';
type AssessmentStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'DONE';

type SeedAssessment = {
  id: string;
  name: string;
  description: string;
  framework_type: FrameworkType;
  status: AssessmentStatus;
  progress: number;
  overallScore?: number;
  updatedAtDaysAgo: number;
};

const DEFAULT_ORG_ID = 'org-dbr77-system';

// 15 assessments with various frameworks and statuses
const seed: SeedAssessment[] = [
  // DRD Assessments (3)
  {
    id: 'assess-drd-q1-2026',
    name: 'Q1 2026 Digital Maturity Assessment',
    description: 'Comprehensive digital readiness diagnosis for Q1 2026',
    framework_type: 'DRD',
    status: 'APPROVED',
    progress: 100,
    overallScore: 3.2,
    updatedAtDaysAgo: 0,
  },
  {
    id: 'assess-drd-manufacturing',
    name: 'Manufacturing Division DRD',
    description: 'Digital transformation assessment for manufacturing operations',
    framework_type: 'DRD',
    status: 'REVIEW',
    progress: 85,
    overallScore: 2.8,
    updatedAtDaysAgo: 1,
  },
  {
    id: 'assess-drd-logistics',
    name: 'Logistics Digital Readiness',
    description: 'Assessment of digital capabilities in logistics department',
    framework_type: 'DRD',
    status: 'DRAFT',
    progress: 45,
    overallScore: 2.1,
    updatedAtDaysAgo: 2,
  },

  // SIRI Assessments (3)
  {
    id: 'assess-siri-i40',
    name: 'Industry 4.0 Readiness Check',
    description: 'Smart Industry Readiness Index assessment for I4.0 transformation',
    framework_type: 'SIRI',
    status: 'DONE',
    progress: 100,
    overallScore: 3.6,
    updatedAtDaysAgo: 10,
  },
  {
    id: 'assess-siri-production',
    name: 'Production Line SIRI Assessment',
    description: 'SIRI evaluation for automated production lines',
    framework_type: 'SIRI',
    status: 'REVIEW',
    progress: 90,
    overallScore: 3.1,
    updatedAtDaysAgo: 3,
  },
  {
    id: 'assess-siri-warehouse',
    name: 'Warehouse Automation Readiness',
    description: 'Smart warehouse readiness assessment using SIRI framework',
    framework_type: 'SIRI',
    status: 'DRAFT',
    progress: 30,
    overallScore: 1.8,
    updatedAtDaysAgo: 5,
  },

  // ADMA Assessments (3)
  {
    id: 'assess-adma-ops-ex',
    name: 'Operational Excellence Assessment',
    description: 'ADMA-based operational excellence maturity evaluation',
    framework_type: 'ADMA',
    status: 'REVIEW',
    progress: 75,
    overallScore: 2.9,
    updatedAtDaysAgo: 0,
  },
  {
    id: 'assess-adma-supply-chain',
    name: 'Supply Chain Digital Maturity',
    description: 'Advanced digital maturity assessment for supply chain',
    framework_type: 'ADMA',
    status: 'APPROVED',
    progress: 100,
    overallScore: 3.4,
    updatedAtDaysAgo: 7,
  },
  {
    id: 'assess-adma-hr',
    name: 'HR Digital Transformation',
    description: 'Human resources digital maturity assessment',
    framework_type: 'ADMA',
    status: 'DRAFT',
    progress: 60,
    overallScore: 2.5,
    updatedAtDaysAgo: 4,
  },

  // CMMI Assessments (3)
  {
    id: 'assess-cmmi-tech-stack',
    name: 'Technology Stack Audit',
    description: 'CMMI-based technology capability maturity assessment',
    framework_type: 'CMMI',
    status: 'DRAFT',
    progress: 50,
    overallScore: 2.4,
    updatedAtDaysAgo: 1,
  },
  {
    id: 'assess-cmmi-dev-process',
    name: 'Development Process Maturity',
    description: 'Software development process maturity evaluation',
    framework_type: 'CMMI',
    status: 'APPROVED',
    progress: 100,
    overallScore: 3.8,
    updatedAtDaysAgo: 14,
  },
  {
    id: 'assess-cmmi-qa',
    name: 'Quality Assurance CMMI',
    description: 'QA process maturity assessment using CMMI framework',
    framework_type: 'CMMI',
    status: 'REVIEW',
    progress: 80,
    overallScore: 3.0,
    updatedAtDaysAgo: 6,
  },

  // LEAN Assessments (3)
  {
    id: 'assess-lean-4-0',
    name: 'Lean 4.0 Maturity Assessment',
    description: 'DBR77 Lean 4.0 framework assessment for process optimization',
    framework_type: 'LEAN',
    status: 'DRAFT',
    progress: 25,
    overallScore: 2.1,
    updatedAtDaysAgo: 3,
  },
  {
    id: 'assess-lean-waste',
    name: 'Waste Reduction Assessment',
    description: 'Lean assessment focused on waste identification and elimination',
    framework_type: 'LEAN',
    status: 'DONE',
    progress: 100,
    overallScore: 3.5,
    updatedAtDaysAgo: 21,
  },
  {
    id: 'assess-lean-automation',
    name: 'Automation Potential Analysis',
    description: 'Lean 4.0 assessment for automation opportunities',
    framework_type: 'LEAN',
    status: 'REVIEW',
    progress: 70,
    overallScore: 2.7,
    updatedAtDaysAgo: 8,
  },
];

async function main() {
  console.log('\n🚀 Assessment Test Data Seeder (15 assessments)\n');

  const db = await createDatabase();

  // Determine org from existing users (matches MyWork seeder behavior)
  const userQuery = await db.query(`SELECT id, organization_id FROM users LIMIT 1`, []);
  const orgId = userQuery?.rows?.[0]?.organization_id || DEFAULT_ORG_ID;

  log.info(`Seeding ${seed.length} assessments into org ${orgId}`);

  // Ensure assessments table exists
  await db.query(
    `CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'DRAFT',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      framework_type TEXT DEFAULT 'DRD',
      framework_data TEXT DEFAULT '{}'
    )`,
    []
  );

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
      [a.id, orgId, a.name, a.description, a.status, now, updatedAt, a.framework_type, frameworkData]
    );
    log.step(`Upserted ${a.framework_type}: ${a.name} (${a.status}, ${a.progress}%)`);
  }

  log.success(`Assessment test data seeded successfully! (${seed.length} records)`);
}

main().catch((err) => {
  log.error(String(err?.message || err));
  process.exit(1);
});
