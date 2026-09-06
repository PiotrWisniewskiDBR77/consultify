#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Initiatives Test Data Seeder
 * Seeds 15 sample initiatives for the Initiatives Hub UI.
 *
 * Uses canonical 11-status initiative lifecycle:
 * DRAFT → REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED → EXECUTING → DONE → TRACKING
 *
 * Usage:
 *   cd server && NODE_ENV=development DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/seed-initiatives-test-data.ts
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

function isoFutureDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// Canonical 11-status initiative lifecycle
type InitiativeStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'PROMOTED'
  | 'PLANNING'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'EXECUTING'
  | 'BLOCKED'
  | 'DONE'
  | 'TRACKING'
  | 'CANCELLED';

type SourceType = 'TOOL' | 'ASSESSMENT' | 'MANUAL';

type SeedInitiative = {
  id: string;
  title: string;
  description: string;
  status: InitiativeStatus;
  created_from: SourceType;
  source_assessment_id?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  progress: number;
  estimated_budget?: number;
  updatedAtDaysAgo: number;
  start_date_days?: number;
  end_date_days?: number;
};

const DEFAULT_ORG_ID = 'org-dbr77-system';

// 15 initiatives across all statuses
const seed: SeedInitiative[] = [
  // DRAFT (3) - from Tools and Assessment
  {
    id: 'init-draft-erp',
    title: 'ERP System Modernization',
    description: 'Upgrade legacy ERP to cloud-based solution',
    status: 'DRAFT',
    created_from: 'TOOL',
    priority: 'HIGH',
    risk_level: 'HIGH',
    progress: 0,
    estimated_budget: 500000,
    updatedAtDaysAgo: 1,
  },
  {
    id: 'init-draft-automation',
    title: 'Warehouse Automation Phase 1',
    description: 'Implement automated picking system in main warehouse',
    status: 'DRAFT',
    created_from: 'ASSESSMENT',
    source_assessment_id: 'assess-siri-warehouse',
    priority: 'MEDIUM',
    risk_level: 'MEDIUM',
    progress: 0,
    estimated_budget: 250000,
    updatedAtDaysAgo: 2,
  },
  {
    id: 'init-draft-training',
    title: 'Digital Skills Training Program',
    description: 'Company-wide digital literacy training initiative',
    status: 'DRAFT',
    created_from: 'ASSESSMENT',
    source_assessment_id: 'assess-drd-q1-2026',
    priority: 'MEDIUM',
    risk_level: 'MEDIUM',
    progress: 0,
    estimated_budget: 75000,
    updatedAtDaysAgo: 3,
  },

  // REVIEW (2) - under business review
  {
    id: 'init-review-crm',
    title: 'CRM Platform Migration',
    description: 'Migrate from legacy CRM to Salesforce',
    status: 'PENDING_APPROVAL',
    created_from: 'TOOL',
    priority: 'HIGH',
    risk_level: 'HIGH',
    progress: 10,
    estimated_budget: 350000,
    updatedAtDaysAgo: 4,
  },
  {
    id: 'init-review-iot',
    title: 'IoT Sensor Network Deployment',
    description: 'Deploy IoT sensors across production floor',
    status: 'PENDING_APPROVAL',
    created_from: 'ASSESSMENT',
    source_assessment_id: 'assess-siri-production',
    priority: 'MEDIUM',
    risk_level: 'HIGH',
    progress: 15,
    estimated_budget: 180000,
    updatedAtDaysAgo: 5,
  },

  // PROMOTED (2) - accepted for planning
  {
    id: 'init-promoted-bi',
    title: 'Business Intelligence Dashboard',
    description: 'Implement real-time BI dashboard for executives',
    status: 'PENDING_APPROVAL',
    created_from: 'ASSESSMENT',
    source_assessment_id: 'assess-adma-ops-ex',
    priority: 'HIGH',
    risk_level: 'MEDIUM',
    progress: 20,
    estimated_budget: 120000,
    updatedAtDaysAgo: 6,
  },
  {
    id: 'init-promoted-api',
    title: 'API Gateway Implementation',
    description: 'Centralized API management platform',
    status: 'PENDING_APPROVAL',
    created_from: 'TOOL',
    priority: 'MEDIUM',
    risk_level: 'MEDIUM',
    progress: 25,
    estimated_budget: 95000,
    updatedAtDaysAgo: 7,
  },

  // PLANNING (2) - being planned
  {
    id: 'init-planning-security',
    title: 'Cybersecurity Enhancement Program',
    description: 'Comprehensive security upgrade across all systems',
    status: 'PENDING_APPROVAL',
    created_from: 'ASSESSMENT',
    source_assessment_id: 'assess-cmmi-tech-stack',
    priority: 'CRITICAL',
    risk_level: 'HIGH',
    progress: 35,
    estimated_budget: 400000,
    updatedAtDaysAgo: 8,
  },
  {
    id: 'init-planning-mobile',
    title: 'Mobile App Development',
    description: 'Customer-facing mobile application',
    status: 'PENDING_APPROVAL',
    created_from: 'MANUAL',
    priority: 'HIGH',
    risk_level: 'HIGH',
    progress: 40,
    estimated_budget: 200000,
    updatedAtDaysAgo: 9,
  },

  // APPROVED (2) - ready for scheduling
  {
    id: 'init-approved-cloud',
    title: 'Cloud Migration Phase 2',
    description: 'Migrate remaining on-premise systems to cloud',
    status: 'APPROVED',
    created_from: 'ASSESSMENT',
    source_assessment_id: 'assess-drd-manufacturing',
    priority: 'HIGH',
    risk_level: 'HIGH',
    progress: 50,
    estimated_budget: 600000,
    updatedAtDaysAgo: 10,
    start_date_days: 14,
    end_date_days: 180,
  },
  {
    id: 'init-approved-data',
    title: 'Data Lake Implementation',
    description: 'Centralized data lake for analytics',
    status: 'APPROVED',
    created_from: 'TOOL',
    priority: 'MEDIUM',
    risk_level: 'HIGH',
    progress: 45,
    estimated_budget: 280000,
    updatedAtDaysAgo: 11,
    start_date_days: 30,
    end_date_days: 120,
  },

  // SCHEDULED (1) - in roadmap
  {
    id: 'init-scheduled-rpa',
    title: 'RPA Implementation',
    description: 'Robotic process automation for finance department',
    status: 'APPROVED',
    created_from: 'ASSESSMENT',
    source_assessment_id: 'assess-lean-automation',
    priority: 'MEDIUM',
    risk_level: 'MEDIUM',
    progress: 55,
    estimated_budget: 150000,
    updatedAtDaysAgo: 12,
    start_date_days: 7,
    end_date_days: 90,
  },

  // EXECUTING (1) - in progress
  {
    id: 'init-executing-devops',
    title: 'DevOps Transformation',
    description: 'Implement CI/CD pipeline and DevOps practices',
    status: 'IN_EXECUTION',
    created_from: 'ASSESSMENT',
    source_assessment_id: 'assess-cmmi-dev-process',
    priority: 'HIGH',
    risk_level: 'HIGH',
    progress: 65,
    estimated_budget: 180000,
    updatedAtDaysAgo: 5,
    start_date_days: -30,
    end_date_days: 60,
  },

  // DONE (1) - completed
  {
    id: 'init-done-lean',
    title: 'Lean Process Optimization',
    description: 'Waste reduction in manufacturing processes',
    status: 'CLOSED',
    created_from: 'ASSESSMENT',
    source_assessment_id: 'assess-lean-waste',
    priority: 'MEDIUM',
    risk_level: 'MEDIUM',
    progress: 100,
    estimated_budget: 120000,
    updatedAtDaysAgo: 14,
    start_date_days: -90,
    end_date_days: -7,
  },
];

async function main() {
  console.log('\n🚀 Initiatives Test Data Seeder (15 initiatives)\n');

  const db = await createDatabase();

  // Determine org from existing users
  const userQuery = await db.query(`SELECT id, organization_id FROM users LIMIT 1`, []);
  const orgId = userQuery?.rows?.[0]?.organization_id || DEFAULT_ORG_ID;
  const userId = userQuery?.rows?.[0]?.id || 'user-system';

  log.info(`Seeding ${seed.length} initiatives into org ${orgId}`);

  // Table already exists in schema - just insert data
  for (const i of seed) {
    const now = new Date().toISOString();
    const updatedAt = isoDaysAgo(i.updatedAtDaysAgo);
    const startDate = i.start_date_days !== undefined ? (i.start_date_days < 0 ? isoDaysAgo(-i.start_date_days) : isoFutureDays(i.start_date_days)) : null;
    const endDate = i.end_date_days !== undefined ? (i.end_date_days < 0 ? isoDaysAgo(-i.end_date_days) : isoFutureDays(i.end_date_days)) : null;

    await db.query(
      `INSERT INTO initiatives (id, organization_id, title, name, description, status, created_from, source_assessment_id, priority, risk_level, progress, estimated_budget, owner_id, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         organization_id=excluded.organization_id,
         title=excluded.title,
         name=excluded.name,
         description=excluded.description,
         status=excluded.status,
         created_from=excluded.created_from,
         source_assessment_id=excluded.source_assessment_id,
         priority=excluded.priority,
         risk_level=excluded.risk_level,
         progress=excluded.progress,
         estimated_budget=excluded.estimated_budget,
         owner_id=excluded.owner_id,
         start_date=excluded.start_date,
         end_date=excluded.end_date,
         updated_at=excluded.updated_at`,
      [i.id, orgId, i.title, i.title, i.description, i.status, i.created_from, i.source_assessment_id || null, i.priority, i.risk_level, i.progress, i.estimated_budget || null, userId, startDate, endDate, now, updatedAt]
    );
    log.step(`Upserted ${i.status}: ${i.title} (${i.priority}, ${i.progress}%)`);
  }

  log.success(`Initiatives test data seeded successfully! (${seed.length} records)`);
}

main().catch((err) => {
  log.error(String(err?.message || err));
  process.exit(1);
});
