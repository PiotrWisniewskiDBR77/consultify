#!/usr/bin/env tsx
/**
 * Seed: Apator S.A. organization + users
 *
 * Production-safe script for creating/updating Apator tenant and importing
 * people list from onboarding screenshots.
 *
 * Safety:
 * - Requires explicit production confirmation.
 * - Requires explicit DB target (DATABASE_URL or DATABASE_PUBLIC_URL).
 * - Excludes non-person entries from source list.
 *
 * Usage:
 *   SEED_MODE=production \
 *   SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION \
 *   DATABASE_PUBLIC_URL=... \
 *   npx tsx server/scripts/seed-apator-organization.ts
 */

import crypto from 'crypto';

import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

import {
  logSelectedDatabaseTarget,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';
import logger from '../src/utils/Logger.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
if (process.env.ENV_FILE) {
  dotenv.config({ path: process.env.ENV_FILE, override: true });
}

const ORG_ID = process.env.SEED_ORG_ID || 'apator-sa';
const ORG_NAME = process.env.SEED_ORG_NAME || 'Apator S.A.';
const ORG_PLAN = 'enterprise';
const ORG_DOMAIN = 'apator.com';
const ORG_INDUSTRY = 'energy-infrastructure';
const TEMP_PASSWORD = process.env.APATOR_TEMP_PASSWORD || 'Apator2026!change';
const SPONSOR_EMAIL = (process.env.APATOR_SPONSOR_EMAIL || 'piotr.wisniewski@dbr77.com').toLowerCase();

const APATOR_PUBLIC_FACTS = {
  source: 'https://www.apator.com.pl/en/apator-group/about-us',
  sourcePl: 'https://www.apator.com.pl/o-nas/grupa-apator/poznaj-grupe-apator',
  legalEntity: 'Apator S.A.',
  groupModel: 'GROUP_WITH_MULTIPLE_PLANTS',
  companiesCount: 11,
  rndOfficesCount: 7,
  manufacturingPlantsCount: 6,
  distributionCountries: 60,
  yearlySupply: {
    electricityMeters: '1.3m',
    waterMeters: '2.6m',
    gasMeters: '1.2m',
  },
  keySitesMentioned: [
    'Tczew',
    'Slupsk',
    'Zielona Gora',
    'Lodz',
    'Jaryszki k. Poznania',
    'Swidnica',
    'Torun',
    'Ostaszewo/Lysomice',
  ],
  note:
    'Tenant seeded as group-level container. Plants should be modeled as child units in next rollout step.',
};

type SeedUser = {
  email: string;
  firstName: string;
  lastName: string;
  role: 'USER';
};

const APATOR_USERS: SeedUser[] = [
  { firstName: 'Maciej', lastName: 'Wyczesany', email: 'maciej.wyczesany@apator.com', role: 'USER' },
  { firstName: 'Slawomir', lastName: 'Migala', email: 'slawomir.migala@apator.com', role: 'USER' },
  { firstName: 'Szymon', lastName: 'Piotrowski', email: 'szymon.piotrowski@apator.com', role: 'USER' },
  { firstName: 'Lukasz', lastName: 'Zaworski', email: 'lukasz.zaworski@apator.com', role: 'USER' },
  { firstName: 'Lukasz', lastName: 'Steinmann', email: 'lukasz.steinmann@apator.com', role: 'USER' },
  { firstName: 'Bozena', lastName: 'Wroblewska', email: 'bozena.wroblewska@apator.com', role: 'USER' },
  { firstName: 'Janusz', lastName: 'Marcinkowski', email: 'janusz.marcinkowski@apator.com', role: 'USER' },
  { firstName: 'Mateusz', lastName: 'Wisniewski', email: 'mateusz.m.wisniewski@apator.com', role: 'USER' },
  { firstName: 'Marcin', lastName: 'Skonieczny', email: 'marcin.skonieczny@apator.com', role: 'USER' },
  { firstName: 'Maciej', lastName: 'Leszynski', email: 'maciej.leszynski@apator.com', role: 'USER' },
  { firstName: 'Malgorzata', lastName: 'Foj', email: 'malgorzata.foj@apator.com', role: 'USER' },
  { firstName: 'Katarzyna', lastName: 'Cieszynska', email: 'katarzyna.cieszynska@apator.com', role: 'USER' },
  { firstName: 'Slawek', lastName: 'Migala', email: 'slawek.migala@apator.com', role: 'USER' },
  { firstName: 'Marcin', lastName: 'Soltysiak', email: 'marcin.soltysiak@apator.com', role: 'USER' },
  { firstName: 'Magdalena', lastName: 'Ismer-Grendzicka', email: 'magdalena.ismer-grendzicka@apator.com', role: 'USER' },
  { firstName: 'Janusz', lastName: 'Niedzwiecki', email: 'janusz.niedzwiecki@apator.com.pl', role: 'USER' },
  { firstName: 'Szymon', lastName: 'Surma', email: 'szymon.surma@apator.com', role: 'USER' },
  { firstName: 'Miroslaw', lastName: 'Stalkowski', email: 'miroslaw.stalkowski@apator.com', role: 'USER' },
  { firstName: 'Tomasz', lastName: 'Skubiszak', email: 'tomasz.skubiszak@apator.com', role: 'USER' },
  { firstName: 'Cezary', lastName: 'Mikowski', email: 'cezary.mikowski@apator.com', role: 'USER' },
  { firstName: 'Karol', lastName: 'Kozlowski', email: 'karol.kozlowski@apator.com', role: 'USER' },
  { firstName: 'Karol', lastName: 'Rzepczynski', email: 'karol.rzepczynski@apator.com', role: 'USER' },
  { firstName: 'Piotr', lastName: 'Krauze', email: 'piotr.krauze@apator.com', role: 'USER' },
  { firstName: 'Agata', lastName: 'Bartoszewicz', email: 'agata.bartoszewicz@apator.com', role: 'USER' },
  { firstName: 'Piotr', lastName: 'Sikora', email: 'piotr.sikora@apator.com', role: 'USER' },
  { firstName: 'Maciej', lastName: 'Zyman', email: 'maciej.zyman@apator.com', role: 'USER' },
  { firstName: 'Liza', lastName: 'Wojtowicz', email: 'liza.wojtowicz@apator.com', role: 'USER' },
  { firstName: 'Lukasz', lastName: 'Wloscianko', email: 'lukasz.wloscianko@apator.com', role: 'USER' },
  { firstName: 'Robert', lastName: 'Trzajna', email: 'robert.trzajna@apator.com', role: 'USER' },
  { firstName: 'Marek', lastName: 'Szymanski', email: 'marek.szymanski@apator.com', role: 'USER' },
  { firstName: 'Maciej', lastName: 'Stachurski', email: 'maciej.stachurski@apator.com', role: 'USER' },
  { firstName: 'Lukasz', lastName: 'Melkowski', email: 'lukasz.melkowski@apator.com', role: 'USER' },
  { firstName: 'Krzysztof', lastName: 'Kaczmarek', email: 'krzysztof.a.kaczmarek@apator.com', role: 'USER' },
  { firstName: 'Kalina', lastName: 'Karamara-Smejlik', email: 'kalina.karamara-smejlik@apator.com', role: 'USER' },
  { firstName: 'Bartlomiej', lastName: 'Grochowski', email: 'bartlomiej.grochowski@apator.com', role: 'USER' },
  { firstName: 'Martyna', lastName: 'Formela', email: 'martyna.formela@apator.com', role: 'USER' },
  { firstName: 'Mariusz', lastName: 'Dittmann', email: 'mariusz.dittmann@apator.com', role: 'USER' },
  { firstName: 'Zbigniew', lastName: 'Cybulski', email: 'zbigniew.cybulski@apator.com', role: 'USER' },
  { firstName: 'Blazej', lastName: 'Bartkowski', email: 'blazej.bartkowski@apator.com', role: 'USER' },
  { firstName: 'Jan', lastName: 'Wiese', email: 'jan.wiese@apator.com', role: 'USER' },
  { firstName: 'Mariusz', lastName: 'Michalski', email: 'mariusz.michalski@apator.com', role: 'USER' },
  { firstName: 'Mariola', lastName: 'Romanowska', email: 'mariola.romanowska@apator.com', role: 'USER' },
];

function requireProductionConfirmation() {
  const mode = String(process.env.SEED_MODE || '').toLowerCase();
  const confirm = String(process.env.SEED_CONFIRM || '');
  if (mode !== 'production') {
    throw new Error(`Refusing to run: set SEED_MODE=production (current: "${mode || '(empty)'}")`);
  }
  if (confirm !== 'YES_I_UNDERSTAND_PRODUCTION') {
    throw new Error(
      'Refusing to run without explicit confirmation. Set SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION'
    );
  }
}

function nowIso() {
  return new Date().toISOString();
}

async function getTableColumns(
  db: {
    query: <T>(sql: string, params?: unknown[]) => Promise<{ rows?: T[] }>;
  },
  tableName: string
): Promise<Set<string>> {
  const schema = await db.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return new Set((schema.rows || []).map((row) => String(row.column_name || '').trim()));
}

async function upsertOrganization(
  db: {
    run: (sql: string, params?: unknown[]) => Promise<unknown>;
    query: <T>(sql: string, params?: unknown[]) => Promise<{ rows?: T[] }>;
  },
  sponsorUserId: string
) {
  const columns = await getTableColumns(db, 'organizations');

  const entries: Array<[string, unknown]> = [
    ['id', ORG_ID],
    ['name', ORG_NAME],
    ['status', 'active'],
    ['plan', ORG_PLAN],
    ['industry', ORG_INDUSTRY],
    ['domain', ORG_DOMAIN],
    ['organization_type', 'PAID'],
    ['billing_status', 'ACTIVE'],
    ['is_active', 1],
    ['attribution_data', JSON.stringify(APATOR_PUBLIC_FACTS)],
    ['created_by_user_id', sponsorUserId],
    ['onboarding_status', 'ORG_SETUP_COMPLETED'],
    ['default_locale', 'pl'],
    ['enabled_locales', JSON.stringify(['pl', 'en'])],
    ['billing_currency', 'PLN'],
    ['billing_country', 'PL'],
    ['owner_id', sponsorUserId],
    ['updated_at', nowIso()],
  ].filter(([column]) => columns.has(column));

  const insertColumns = entries.map(([column]) => column);
  const params = entries.map(([, value]) => value);
  const updateColumns = insertColumns
    .filter((column) => column !== 'id')
    .map((column) => `${column} = EXCLUDED.${column}`);

  await db.run(
    `INSERT INTO organizations (${insertColumns.join(', ')})
     VALUES (${insertColumns.map((_, index) => `$${index + 1}`).join(', ')})
     ON CONFLICT (id) DO UPDATE SET
       ${updateColumns.join(', ')}`,
    params
  );
}

async function ensureSponsorMembership(
  db: { run: (sql: string, params?: unknown[]) => Promise<unknown> },
  sponsorUserId: string
) {
  await db.run(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', $4)
     ON CONFLICT(organization_id, user_id) DO UPDATE SET role = 'OWNER', status = 'ACTIVE'`,
    [crypto.randomUUID(), ORG_ID, sponsorUserId, nowIso()]
  );
}

async function main() {
  requireProductionConfirmation();

  const target = resolveScriptDatabaseTarget({
    label: 'seed-apator-organization',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('seed-apator-organization', target);
  process.env.DATABASE_URL = target.connectionString;

  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = await getDatabaseAsync();

  const sponsorRow = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE lower(trim(email)) = $1 LIMIT 1`,
    [SPONSOR_EMAIL]
  );
  const sponsorUserId = sponsorRow.rows?.[0]?.id;
  if (!sponsorUserId) {
    throw new Error(`Sponsor user not found for ${SPONSOR_EMAIL}`);
  }

  await upsertOrganization(db, sponsorUserId);
  await ensureSponsorMembership(db, sponsorUserId);

  const passwordHash = bcrypt.hashSync(TEMP_PASSWORD, 10);
  let created = 0;
  let updated = 0;
  let existingInOtherOrg = 0;

  for (const user of APATOR_USERS) {
    const email = user.email.toLowerCase().trim();
    const existing = await db.query<{ id: string; organization_id: string | null; role: string | null }>(
      `SELECT id, organization_id, role
       FROM users
       WHERE lower(trim(email)) = $1
       LIMIT 1`,
      [email]
    );

    let userId: string;
    if (existing.rows?.[0]?.id) {
      userId = existing.rows[0].id;
      const currentOrg = String(existing.rows[0].organization_id || '').trim();
      if (currentOrg && currentOrg !== ORG_ID) {
        existingInOtherOrg += 1;
      }

      await db.run(
        `UPDATE users
         SET first_name = $1,
             last_name = $2,
             status = 'active',
             password = $3
         WHERE id = $4`,
        [user.firstName, user.lastName, passwordHash, userId]
      );
      updated += 1;
    } else {
      userId = crypto.randomUUID();
      await db.run(
        `INSERT INTO users
         (id, organization_id, email, password, first_name, last_name, role, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)`,
        [userId, ORG_ID, email, passwordHash, user.firstName, user.lastName, user.role, nowIso()]
      );
      created += 1;
    }

    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5)
       ON CONFLICT(organization_id, user_id)
       DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE'`,
      [crypto.randomUUID(), ORG_ID, userId, user.role, nowIso()]
    );
  }

  logger.info('[seed-apator] ✅ Apator organization setup complete', {
    organization: {
      id: ORG_ID,
      name: ORG_NAME,
      groupModel: APATOR_PUBLIC_FACTS.groupModel,
      plan: ORG_PLAN,
    },
    users: {
      totalRequested: APATOR_USERS.length,
      created,
      updated,
      existingInOtherOrg,
      excludedFromSource: [
        'apatorostaszewo@db77.pl (non-person shared mailbox / site entity)',
        'phillip.stepnakowski@ap... (email truncated in source screenshot)',
      ],
    },
  });

  // eslint-disable-next-line no-console
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  // eslint-disable-next-line no-console
  console.log('║                    Apator S.A. - Setup Complete                     ║');
  // eslint-disable-next-line no-console
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  // eslint-disable-next-line no-console
  console.log(`║ Organization: ${ORG_NAME} (${ORG_ID})`);
  // eslint-disable-next-line no-console
  console.log(`║ Group model: ${APATOR_PUBLIC_FACTS.groupModel}`);
  // eslint-disable-next-line no-console
  console.log(`║ Users requested: ${APATOR_USERS.length}`);
  // eslint-disable-next-line no-console
  console.log(`║ Created: ${created} | Updated: ${updated}`);
  // eslint-disable-next-line no-console
  console.log(`║ Existing in other orgs (multi-org membership kept): ${existingInOtherOrg}`);
  // eslint-disable-next-line no-console
  console.log(`║ Temporary password set for imported users: ${TEMP_PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[seed-apator] Failed:', error);
  process.exit(1);
});
