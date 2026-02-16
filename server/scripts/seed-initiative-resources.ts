#!/usr/bin/env node
/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
/**
 * Initiative Resources Seeder (SQLite dev DB)
 *
 * Fills the four "Resources" tables used by the Initiatives -> Resources screen:
 * - initiative_budget_items
 * - initiative_resources
 * - initiative_tools
 * - initiative_intangible_assets
 *
 * Requirements:
 * - Writes REAL rows to the DB (no mockups)
 * - Safe by default: only inserts into EMPTY tables per-initiative
 * - No deletes, no updates of existing rows
 *
 * Usage:
 *   cd server && DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/seed-initiative-resources.ts
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../src/database/Database.js';
import { transaction } from '../src/utils/queryHelpers.js';

type TableInfoRow = { name?: string };

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

function nowIso() {
  return new Date().toISOString();
}

function safeSqlIdent(name: string) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function requireSafeSqlitePath() {
  const dbType = process.env.DB_TYPE || 'sqlite';
  const sqlitePath = process.env.SQLITE_PATH;

  if (dbType !== 'sqlite') {
    throw new Error(`This seeder only supports SQLite. Current DB_TYPE=${dbType}`);
  }
  if (!sqlitePath) {
    throw new Error('SQLITE_PATH is required. Example: SQLITE_PATH=../data/dev/consultinity.db');
  }

  const resolved = path.resolve(process.cwd(), sqlitePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`SQLITE_PATH does not exist: ${resolved}`);
  }

  const looksLikeDev = resolved.includes(`${path.sep}data${path.sep}dev${path.sep}consultinity.db`);
  if (!looksLikeDev && process.env.FORCE_SEED !== 'true') {
    throw new Error(
      `Refusing to seed non-dev DB: ${resolved}\n` +
        `Set FORCE_SEED=true only if you really want to seed this file.`
    );
  }

  return resolved;
}

async function getColumnsSet(db: any, table: string): Promise<Set<string>> {
  const res = await db.query(`PRAGMA table_info(${safeSqlIdent(table)})`, []);
  const rows = (res.rows || []) as Array<{ name?: string }>;
  return new Set(rows.map((r) => String(r.name || '')).filter(Boolean));
}

async function countByInitiative(db: any, table: string, initiativeId: string, orgId: string) {
  const row = await db.get(
    `SELECT COUNT(*) as c FROM ${safeSqlIdent(table)} WHERE initiative_id = ? AND organization_id = ?`,
    [initiativeId, orgId]
  );
  const c = Number((row && (row.c ?? Object.values(row)[0])) || 0);
  return Number.isFinite(c) ? c : 0;
}

async function insertRow(db: any, table: string, colsSet: Set<string>, row: Record<string, any>) {
  const cols = Object.keys(row).filter((c) => colsSet.has(c));
  if (cols.length === 0) return 0;
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT INTO ${safeSqlIdent(table)} (${cols.map(safeSqlIdent).join(', ')}) VALUES (${placeholders})`;
  const params = cols.map((c) => row[c]);
  const res = await db.run(sql, params);
  return Number(res?.changes || 0);
}

function buildBudgetSeed(currency: string) {
  return [
    {
      category: 'personnel',
      cost_type: 'OPEX',
      amount: 180000,
      currency,
      description: 'Delivery team capacity (engineers, QA, BA) – baseline estimate.',
    },
    {
      category: 'consulting',
      cost_type: 'OPEX',
      amount: 60000,
      currency,
      description: 'External SME / architecture consulting (time-boxed advisory).',
    },
    {
      category: 'technology',
      cost_type: 'CAPEX',
      amount: 120000,
      currency,
      description: 'Core platform components / initial implementation (CAPEX portion).',
    },
    {
      category: 'infrastructure',
      cost_type: 'OPEX',
      amount: 45000,
      currency,
      description: 'Cloud runtime & environments (dev/test/prod) – quarterly run-rate.',
    },
    {
      category: 'licenses',
      cost_type: 'OPEX',
      amount: 25000,
      currency,
      description: 'Tooling licenses (PM, CI/CD, observability) – annual subscription.',
    },
    {
      category: 'training',
      cost_type: 'OPEX',
      amount: 18000,
      currency,
      description: 'Enablement & training budget (delivery + business users).',
    },
    {
      category: 'other',
      cost_type: 'OPEX',
      amount: 12000,
      currency,
      description: 'Contingency for minor expenses (travel, workshops, materials).',
    },
  ];
}

function buildFteSeed(startDate?: string | null, endDate?: string | null) {
  return [
    {
      name: 'Katarzyna Wiśniewska',
      role: 'member',
      allocation_percentage: 50,
      start_date: startDate || null,
      end_date: endDate || null,
      notes: 'Business Analyst – requirements, stakeholder alignment.',
    },
    {
      name: 'Tomasz Zieliński',
      role: 'member',
      allocation_percentage: 100,
      start_date: startDate || null,
      end_date: endDate || null,
      notes: 'Developer – core implementation & integration.',
    },
    {
      name: 'Ewa Dąbrowska',
      role: 'member',
      allocation_percentage: 40,
      start_date: startDate || null,
      end_date: endDate || null,
      notes: 'QA Engineer – test strategy & automation.',
    },
    {
      name: 'Paweł Lewandowski',
      role: 'consultant',
      allocation_percentage: 70,
      start_date: startDate || null,
      end_date: endDate || null,
      notes: 'Data Engineer – pipelines, data quality, reporting.',
    },
    {
      name: 'IoT Engineer (TBD)',
      role: 'consultant',
      allocation_percentage: 100,
      start_date: startDate || null,
      end_date: endDate || null,
      notes: 'IoT integration – connectivity, device onboarding.',
    },
    {
      name: 'Delivery Lead (TBD)',
      role: 'lead',
      allocation_percentage: 60,
      start_date: startDate || null,
      end_date: endDate || null,
      notes: 'Delivery governance – plan, risks, dependencies, reporting.',
    },
  ];
}

function buildToolsSeed() {
  return [
    {
      name: 'Jira + Confluence',
      category: 'software',
      vendor: 'Atlassian',
      license_cost: 0,
      license_type: 'subscription',
      status: 'active',
      notes: 'Project tracking, backlog management, documentation.',
      cost_type: 'OPEX',
    },
    {
      name: 'GitHub Enterprise',
      category: 'platform',
      vendor: 'GitHub',
      license_cost: 0,
      license_type: 'subscription',
      status: 'planned',
      notes: 'Source control, PR workflows, code owners, security scanning.',
      cost_type: 'OPEX',
    },
    {
      name: 'CI/CD Runner Platform',
      category: 'platform',
      vendor: 'Internal / Cloud',
      license_cost: 0,
      license_type: 'internal',
      status: 'planned',
      notes: 'Dedicated runners for builds/tests; environment isolation.',
      cost_type: 'OPEX',
    },
    {
      name: 'Cloud Subscription (non-prod + prod)',
      category: 'cloud',
      vendor: 'AWS/Azure/GCP',
      license_cost: 0,
      license_type: 'subscription',
      status: 'active',
      notes: 'Compute, storage, networking; tagging & cost governance required.',
      cost_type: 'OPEX',
    },
    {
      name: 'Observability Stack',
      category: 'software',
      vendor: 'Datadog / Grafana',
      license_cost: 0,
      license_type: 'subscription',
      status: 'planned',
      notes: 'Logs, metrics, alerts, SLA dashboards for critical services.',
      cost_type: 'OPEX',
    },
  ];
}

function buildIntangiblesSeed(currency: string) {
  return [
    {
      asset_type: 'training',
      name: 'Secure SDLC & Threat Modeling workshop',
      provider: 'Internal Security / External Trainer',
      cost: 0,
      currency,
      valid_from: null,
      valid_until: null,
      status: 'planned',
      beneficiaries: 'Delivery team',
      notes: 'Focus on OWASP ASVS, dependency hygiene, secure review checklists.',
      cost_type: 'OPEX',
    },
    {
      asset_type: 'certification',
      name: 'Cloud Practitioner / Fundamentals (batch)',
      provider: 'AWS/Azure/GCP',
      cost: 0,
      currency,
      valid_from: null,
      valid_until: null,
      status: 'planned',
      beneficiaries: 'Engineers & Data team',
      notes: 'Baseline cloud competency; improves delivery velocity and governance.',
      cost_type: 'OPEX',
    },
    {
      asset_type: 'knowledge',
      name: 'Architecture Decision Records (ADR) library',
      provider: null,
      cost: 0,
      currency,
      valid_from: null,
      valid_until: null,
      status: 'active',
      beneficiaries: 'All stakeholders',
      notes: 'Lightweight decision traceability for audit and onboarding.',
      cost_type: 'OPEX',
    },
  ];
}

async function main() {
  const resolved = requireSafeSqlitePath();
  log.info(`Seeding initiative Resources into SQLite: ${resolved}`);

  const db = getDatabase() as any;

  const initiatives = (await db.query(
    `SELECT id, organization_id, COALESCE(title, name) as title,
            planned_start_date as plannedStart, planned_end_date as plannedEnd
     FROM initiatives
     ORDER BY updated_at DESC
     LIMIT 50`,
    []
  )) as any;
  const rows = (initiatives.rows || []) as Array<{
    id: string;
    organization_id: string;
    title?: string | null;
    plannedStart?: string | null;
    plannedEnd?: string | null;
  }>;

  if (rows.length === 0) {
    log.warn('No initiatives found. Nothing to seed.');
    return;
  }

  const tables = [
    'initiative_budget_items',
    'initiative_resources',
    'initiative_tools',
    'initiative_intangible_assets',
  ] as const;

  // Ensure the target tables exist.
  for (const t of tables) {
    const exists = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [
      t,
    ]);
    if (!exists?.name) {
      throw new Error(
        `Missing required table: ${t}. Run migrations first (npm run db:migrate:safe).`
      );
    }
  }

  const cols = {
    initiative_budget_items: await getColumnsSet(db, 'initiative_budget_items'),
    initiative_resources: await getColumnsSet(db, 'initiative_resources'),
    initiative_tools: await getColumnsSet(db, 'initiative_tools'),
    initiative_intangible_assets: await getColumnsSet(db, 'initiative_intangible_assets'),
  };

  let totalInserted = 0;
  let initiativesTouched = 0;

  for (const i of rows) {
    const initiativeId = String(i.id);
    const orgId = String(i.organization_id);
    const title = String(i.title || '').trim() || initiativeId;

    // Decide currency: PLN default; if initiative already has currency in budget items, reuse it.
    const existingCurRow = await db.get(
      `SELECT currency FROM initiative_budget_items WHERE initiative_id = ? AND organization_id = ? AND currency IS NOT NULL AND currency != '' LIMIT 1`,
      [initiativeId, orgId]
    );
    const currency = String(existingCurRow?.currency || 'PLN') || 'PLN';

    const counts = {
      budget: await countByInitiative(db, 'initiative_budget_items', initiativeId, orgId),
      fte: await countByInitiative(db, 'initiative_resources', initiativeId, orgId),
      tools: await countByInitiative(db, 'initiative_tools', initiativeId, orgId),
      intangibles: await countByInitiative(db, 'initiative_intangible_assets', initiativeId, orgId),
    };

    const needsAny =
      counts.budget === 0 || counts.fte === 0 || counts.tools === 0 || counts.intangibles === 0;
    if (!needsAny) continue;

    log.info(`Initiative: ${title}`);
    log.step(
      `Existing rows: budget=${counts.budget}, team/fte=${counts.fte}, tools=${counts.tools}, intangibles=${counts.intangibles}`
    );

    const createdAt = nowIso();
    const updatedAt = createdAt;
    const startDate = i.plannedStart ? String(i.plannedStart).slice(0, 10) : null;
    const endDate = i.plannedEnd ? String(i.plannedEnd).slice(0, 10) : null;

    const insertedThisInitiative = await transaction(async (txDb: any) => {
      let inserted = 0;

      if (counts.budget === 0) {
        const budgetRows = buildBudgetSeed(currency).map((b) => ({
          id: uuidv4(),
          initiative_id: initiativeId,
          organization_id: orgId,
          category: b.category,
          cost_type: b.cost_type,
          amount: b.amount,
          currency: b.currency,
          description: b.description,
          created_at: createdAt,
          updated_at: updatedAt,
          source: 'manual',
        }));
        for (const r of budgetRows) {
          inserted += await insertRow(
            txDb,
            'initiative_budget_items',
            cols.initiative_budget_items,
            r
          );
        }
      }

      if (counts.fte === 0) {
        const fteRows = buildFteSeed(startDate, endDate).map((r) => ({
          id: uuidv4(),
          initiative_id: initiativeId,
          organization_id: orgId,
          user_id: null,
          name: r.name,
          role: r.role,
          allocation_percentage: r.allocation_percentage,
          start_date: r.start_date,
          end_date: r.end_date,
          notes: r.notes,
          created_at: createdAt,
          updated_at: updatedAt,
          source: 'manual',
        }));
        for (const r of fteRows) {
          inserted += await insertRow(txDb, 'initiative_resources', cols.initiative_resources, r);
        }
      }

      if (counts.tools === 0) {
        const toolRows = buildToolsSeed().map((t) => ({
          id: uuidv4(),
          initiative_id: initiativeId,
          organization_id: orgId,
          name: t.name,
          category: t.category,
          vendor: t.vendor,
          license_cost: t.license_cost,
          license_type: t.license_type,
          status: t.status,
          notes: t.notes,
          created_at: createdAt,
          updated_at: updatedAt,
          source: 'manual',
          cost_type: t.cost_type,
        }));
        for (const r of toolRows) {
          inserted += await insertRow(txDb, 'initiative_tools', cols.initiative_tools, r);
        }
      }

      if (counts.intangibles === 0) {
        const intangibleRows = buildIntangiblesSeed(currency).map((a) => ({
          id: uuidv4(),
          initiative_id: initiativeId,
          organization_id: orgId,
          asset_type: a.asset_type,
          name: a.name,
          provider: a.provider,
          cost: a.cost,
          currency: a.currency,
          valid_from: a.valid_from,
          valid_until: a.valid_until,
          status: a.status,
          beneficiaries: a.beneficiaries,
          notes: a.notes,
          created_at: createdAt,
          updated_at: updatedAt,
          source: 'manual',
          cost_type: a.cost_type,
        }));
        for (const r of intangibleRows) {
          inserted += await insertRow(
            txDb,
            'initiative_intangible_assets',
            cols.initiative_intangible_assets,
            r
          );
        }
      }

      return inserted;
    });

    if (insertedThisInitiative > 0) {
      initiativesTouched++;
      totalInserted += insertedThisInitiative;
      log.success(`Inserted ${insertedThisInitiative} row(s).`);
    }
  }

  if (initiativesTouched === 0) {
    log.success('Nothing to seed: all initiatives already have Resources data.');
    // Continue with light normalization/repair (safe, idempotent).
  }

  // Repair: normalize any legacy/dev values that UI doesn't recognize.
  // (Earlier seed runs used "infrastructure" category for tools; UI expects: software|hardware|cloud|platform|other)
  try {
    const repairRes = await db.run(
      `UPDATE initiative_tools
       SET category = 'platform'
       WHERE LOWER(COALESCE(category, '')) = 'infrastructure'`,
      []
    );
    const repaired = Number(repairRes?.changes || 0);
    if (repaired > 0) {
      log.success(`Repaired ${repaired} tool row(s): category "infrastructure" -> "platform".`);
    }
  } catch {
    // ignore (table/column might not exist in some local DB variants)
  }

  // Show final counts for visibility on the *first* touched initiative.
  const first = rows[0];
  if (first) {
    const orgId = String(first.organization_id);
    const initiativeId = String(first.id);
    const after = {
      budget: await countByInitiative(db, 'initiative_budget_items', initiativeId, orgId),
      fte: await countByInitiative(db, 'initiative_resources', initiativeId, orgId),
      tools: await countByInitiative(db, 'initiative_tools', initiativeId, orgId),
      intangibles: await countByInitiative(db, 'initiative_intangible_assets', initiativeId, orgId),
    };
    log.info(
      `Example counts (initiative=${initiativeId}): budget=${after.budget}, team/fte=${after.fte}, tools=${after.tools}, intangibles=${after.intangibles}`
    );
  }

  log.success(
    `Done. Seeded ${initiativesTouched} initiative(s), inserted ${totalInserted} row(s) total.`
  );
}

main().catch((e) => {
  log.error(e?.message || String(e));
  process.exitCode = 1;
});
