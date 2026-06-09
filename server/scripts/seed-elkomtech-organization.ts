#!/usr/bin/env tsx
/**
 * Seed: Elkomtech — pełny projekt (organizacja + zespół + projekt)
 *
 * Tworzy klienta „Elkomtech" i buduje cały kontekst pracy:
 *  - organizacja + bogaty profil firmy (materiały DRD/Apator + rejestry KRS/REGON + apator.com)
 *  - OWNER: Piotr Wiśniewski (DBR) — pełna możliwość pracy
 *  - 19 osób zespołu (LB AiR ICT) z e-mailami (wzorzec imię.nazwisko@apator.com) i funkcjami
 *  - osoba prowadząca projekt: Katarzyna Helman — ADMIN org + OBSERVER projektu (manager-obserwator, read-only)
 *  - projekt „Wdrożenie polityki pracy procesami (AiR ICT)" + przypisania ról RACI
 *
 * Kontekst: „Elkomtech" = dawny Przedsiębiorstwo Wdrożeń Postępu Technicznego
 * „Elkomtech" (Łódź, ~1988), od 2013/2014 w Grupie Apator; Apator Elkomtech S.A.
 * (KRS 0000009308) wykreślona 2022-03-01 — obecnie Linia Biznesowa Automatyka
 * i Rozwiązania ICT (AiR ICT / AiRICT) w Apator S.A. Właścicielem biznesowym jest
 * Apator S.A. (zapisane w attribution_data); OWNER systemowy = Piotr/DBR (do pracy).
 *
 * Safety:
 *  - SEED_MODE=production + SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION
 *  - jawny target DB (DATABASE_URL / DATABASE_PUBLIC_URL)
 *  - dynamiczne filtrowanie kolumn (odporność na drift)
 *  - NIE nadpisuje haseł istniejących użytkowników (tylko nowym ustawia hasło tymczasowe)
 *  - NIE przenosi istniejących userów między organizacjami (multi-org przez organization_members)
 *
 * Usage:
 *   SEED_MODE=production \
 *   SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION \
 *   DATABASE_PUBLIC_URL=... \
 *   npx tsx server/scripts/seed-elkomtech-organization.ts
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

const ORG_ID = process.env.SEED_ORG_ID || 'elkomtech';
const ORG_NAME = process.env.SEED_ORG_NAME || 'Elkomtech';
const ORG_PLAN = 'enterprise';
const ORG_DOMAIN = 'elkomtech.com.pl';
const ORG_INDUSTRY = 'energy-infrastructure';

// OWNER systemowy (pełna praca z firmą). Właściciel biznesowy = Apator S.A. (attribution_data).
const OWNER_EMAIL = (process.env.ELKOMTECH_OWNER_EMAIL || 'piotr.wisniewski@dbr77.com').toLowerCase();
// Osoba prowadząca projekt: manager-obserwator → ADMIN (org) + OBSERVER (projekt, read-only).
const PROJECT_LEAD_EMAIL = (process.env.ELKOMTECH_LEAD_EMAIL || 'katarzyna.helman@gmail.com').toLowerCase();
const PROJECT_LEAD_FIRST = 'Katarzyna';
const PROJECT_LEAD_LAST = 'Helman';

const TEAM_TEMP_PASSWORD = process.env.ELKOMTECH_TEMP_PASSWORD || 'Elkomtech2026!change';

const PROJECT_ID = process.env.SEED_PROJECT_ID || 'elkomtech-polityka-procesowa';
const PROJECT_NAME = 'Wdrożenie polityki pracy procesami (AiR ICT)';
const PROJECT_GOAL =
  'Opis i wdrożenie procesów, opomiarowanie (KPI), wyznaczenie właścicieli procesów i governance — twarda polityka pracy procesami w LB AiR ICT (Łódź).';
const PROJECT_DESCRIPTION =
  'Audyt i transformacja procesowa linii AiR ICT (dawny Elkomtech). Zakres: pełny opis procesów (SIPOC/flowchart), opomiarowanie (TTO/TTR/OTIF/NPS), właściciele procesów + RACI, single source of truth (CRM/Service Desk), wydzielenie serwisu, standaryzacja oferty.';

// ── Zespół LB AiR ICT (Łódź) — e-maile: wzorzec imię.nazwisko@apator.com (bez PL znaków).
//    liza.wojtowicz@apator.com potwierdzony z istniejącego seeda Apatora. Reszta DO WERYFIKACJI.
type TeamMember = {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  projectRole: string; // wartość z PROJECT_ROLES (projectMemberService)
  emailVerified?: boolean;
};

const TEAM: TeamMember[] = [
  { firstName: 'Stanisław', lastName: 'Baluk', email: 'stanislaw.baluk@apator.com', jobTitle: 'Zarządzający Linią Biznesową AiR ICT', department: 'Zarząd LB', projectRole: 'SPONSOR' },
  { firstName: 'Krzysztof', lastName: 'Kluszczyński', email: 'krzysztof.kluszczynski@apator.com', jobTitle: 'Dyrektor Biura Rozwoju Automatyki / Business Development', department: 'Business Development', projectRole: 'SME' },
  { firstName: 'Tomasz', lastName: 'Dąbrowski', email: 'tomasz.dabrowski@apator.com', jobTitle: 'Business Development / Produkty', department: 'Business Development', projectRole: 'SME' },
  { firstName: 'Marcin', lastName: 'Motyl', email: 'marcin.motyl@apator.com', jobTitle: 'Handlowiec', department: 'Sprzedaż', projectRole: 'STAKEHOLDER' },
  { firstName: 'Mateusz', lastName: 'Grobelny', email: 'mateusz.grobelny@apator.com', jobTitle: 'Handlowiec', department: 'Sprzedaż', projectRole: 'STAKEHOLDER' },
  { firstName: 'Michał', lastName: 'Radecki', email: 'michal.radecki@apator.com', jobTitle: 'Handlowiec', department: 'Sprzedaż', projectRole: 'STAKEHOLDER' },
  { firstName: 'Wojciech', lastName: 'Gałczyński', email: 'wojciech.galczynski@apator.com', jobTitle: 'Handlowiec', department: 'Sprzedaż', projectRole: 'STAKEHOLDER' },
  { firstName: 'Łukasz', lastName: 'Mikulski', email: 'lukasz.mikulski@apator.com', jobTitle: 'Handlowiec', department: 'Sprzedaż', projectRole: 'STAKEHOLDER' },
  { firstName: 'Liza', lastName: 'Wójtowicz', email: 'liza.wojtowicz@apator.com', jobTitle: 'Specjalista ds. ofertowania', department: 'Ofertowanie', projectRole: 'SME', emailVerified: true },
  { firstName: 'Karolina', lastName: 'Zasada', email: 'karolina.zasada@apator.com', jobTitle: 'Specjalista ds. przetargów / ofertowanie', department: 'Ofertowanie / Przetargi', projectRole: 'SME' },
  { firstName: 'Anna', lastName: 'Morawska', email: 'anna.morawska@apator.com', jobTitle: 'Planista produkcji', department: 'Planowanie', projectRole: 'SME' },
  { firstName: 'Agnieszka', lastName: 'Cieślak', email: 'agnieszka.cieslak@apator.com', jobTitle: 'Produkcja', department: 'Produkcja', projectRole: 'STAKEHOLDER' },
  { firstName: 'Jerzy', lastName: 'Karbowski', email: 'jerzy.karbowski@apator.com', jobTitle: 'Szef Zespołu Uruchomień i Serwisu', department: 'Uruchomienia i Serwis', projectRole: 'WORKSTREAM_OWNER' },
  { firstName: 'Norbert', lastName: 'Dyttus', email: 'norbert.dyttus@apator.com', jobTitle: 'Projektant', department: 'Projektowanie / R&D', projectRole: 'SME' },
  { firstName: 'Grzegorz', lastName: 'Lewociuk', email: 'grzegorz.lewociuk@apator.com', jobTitle: 'Kierownik Obszaru Zarządzania Projektami Realizacyjnymi', department: 'Produkcja / Uruchomienia / Serwis', projectRole: 'WORKSTREAM_OWNER' },
  { firstName: 'Aleksandra', lastName: 'Strużyńska', email: 'aleksandra.struzynska@apator.com', jobTitle: 'Controller', department: 'Controlling', projectRole: 'SME' },
  { firstName: 'Mirosław', lastName: 'Chober', email: 'miroslaw.chober@apator.com', jobTitle: 'Specjalista konfiguracji / szkolenia SPV', department: 'Konfiguracja', projectRole: 'SME' },
  { firstName: 'Krzysztof', lastName: 'Drozd', email: 'krzysztof.drozd@apator.com', jobTitle: 'Specjalista konfiguracji', department: 'Konfiguracja', projectRole: 'STAKEHOLDER' },
  { firstName: 'Szymon', lastName: 'Piasecki', email: 'szymon.piasecki@apator.com', jobTitle: 'Kluczowy pracownik (funkcja do potwierdzenia)', department: '(do ustalenia)', projectRole: 'STAKEHOLDER' },
];

// ── Publiczne + projektowe fakty o firmie (attribution_data) ──────────────────
const ELKOMTECH_PUBLIC_FACTS = {
  source: 'DRD/Apator materials + public registers (KRS/REGON) + apator.com',
  programName: 'Elkomtech',
  ownership: {
    businessOwner: 'Apator S.A.',
    parentOrganizationId: 'apator-sa',
    relationship: 'Elkomtech = Linia Biznesowa Automatyka i Rozwiązania ICT (dawny Elkomtech) w Apator S.A.',
    systemOwner: 'Piotr Wiśniewski (DBR / Consultify) — konto OWNER do prowadzenia prac',
    consultant: 'DBR / Consultify — wykonawca audytu i transformacji',
  },
  legalHistory: {
    originalEntity: 'Przedsiębiorstwo Wdrożeń Postępu Technicznego „Elkomtech"',
    foundedAround: 1988,
    city: 'Łódź',
    legalEntityBeforeMerger: 'Apator Elkomtech S.A.',
    krs: '0000009308',
    nip: '7270125614',
    regon: '008230828',
    registeredAddress: 'ul. Wołowa 2c, 93-569 Łódź',
    acquiredByApator: '2013/2014',
    krsDeleted: '2022-03-01 (połączenie / wykreślenie z KRS)',
    currentStatus: 'Linia Biznesowa Apator S.A. — Automatyka i Rozwiązania ICT (AiR ICT / AiRICT), Łódź',
  },
  products: [
    'SCADA WindEx (ST — nadzór stacji, SP — sieci przemysłowe, LVS — sieci nN, TX — komunikacja SCADA)',
    'Telemechanika i automatyka stacyjna',
    'Sterowniki microBEL / BEL',
    'Sterownik SPV (OZE)',
    'Reklozery / wyłączniki sieciowe',
  ],
  marketSegments: ['OSD', 'OSP / PSE', 'OZE / fotowoltaika', 'Przemysł', 'JST'],
  competitors: ['Mikronika', 'Elektrometal Energetyka', 'PSI', 'ZPrAE / Włoszczowa'],
  internalContext_2025_2026: {
    line: 'AiR ICT (AiRICT), Łódź',
    revenue2025_tysPln: 65219.5,
    revenue2024_tysPln: 41700.9,
    marginLevel1_2025_pct: 26.1,
    surveyPopulationApprox: 160,
    advisors: ['Katarzyna Sobańska-Helman', 'Jarosław Wojtulewicz (DBR)'],
    engagement: 'Audyt + transformacja procesowa (opis procesów, opomiarowanie, właściciele procesów, governance)',
  },
  legacyWebsite: 'http://www.elkomtech.com.pl',
  currentWebsite: 'https://www.apator.com',
  sources: [
    'https://rejestr.io/krs/9308/apator-elkomtech',
    'https://www.dnb.com/pl-pl/firma/?id=1379771',
    'https://www.apator.com',
    'DRD/Apator (raport audytu, strategia 2026–2029, roadmapa, insighty)',
  ],
};

const ELKOMTECH_PROFILE = {
  industry: ORG_INDUSTRY,
  industry_subsector: 'power-grid-automation',
  industry_code: 'PKD 26.51.Z',
  company_size: 'medium',
  employee_count: 160,
  founding_year: 1988,
  headquarters_country: 'PL',
  growth_stage: 'transformation',
  risk_appetite: 'moderate',
  preferred_language: 'pl',
  communication_style: 'formal',
  industry_jargon_level: 'high',
  production_archetype: 'discrete',
  automation_level: 'medium',
  profile_completeness: 70,
  mission_statement: 'Dostarczanie systemów automatyki, telemechaniki i rozwiązań ICT (SCADA WindEx) dla operatorów sieci elektroenergetycznych.',
  vision_statement: 'Skalowalny i mierzalny model operacyjny linii AiR ICT, wspierający cyfryzację polskiej energetyki (OSD/OSP, OZE).',
  competitive_position: 'Silne portfolio produktowe i marka (dawny Elkomtech — WindEx / microBEL), wysokie bariery wejścia; przewaga osłabiana operacyjnie (terminy uruchomień, brak mierników i właścicieli procesów).',
  strategic_priorities: [
    'Twarda polityka pracy procesami: opis → wdrożenie → opomiarowanie → właściciele procesów → governance',
    'Wydzielenie serwisu od produkcji + capacity planning uruchomień',
    'Standaryzacja oferty („z półki") i SLA ofertowania',
    'CRM / Service Desk i system KPI (single source of truth)',
    'Program powrotu do klientów OSD',
    'Strategia 2026–2029: cyfryzacja sieci OSD/OSP, SCADA nN, OZE',
  ],
  primary_markets: ['Polska — OSD', 'PSE / OSP', 'OZE / fotowoltaika', 'Przemysł', 'JST'],
  customer_segments: ['OSD (Tauron, PGE, Energa, Enea, Stoen)', 'PSE / OSP', 'Wytwórcy OZE', 'Przemysł energochłonny'],
  key_competitors: ['Mikronika', 'Elektrometal Energetyka', 'PSI', 'ZPrAE / Włoszczowa'],
  regulatory_environment: ['Prawo zamówień publicznych (przetargi OSD/PSE)', 'Normy i dopuszczenia operatorów sieci', 'Cyberbezpieczeństwo OT/ICT', 'Transformacja energetyczna UE / KPO'],
};

const ELKOMTECH_BRANDING = {
  description: 'Elkomtech (dawny PWPT „Elkomtech", Łódź, ~1988) — producent automatyki, telemechaniki i systemów SCADA WindEx dla energetyki. Od 2013/2014 w Grupie Apator; obecnie Linia Biznesowa Automatyka i Rozwiązania ICT (AiR ICT) w Apator S.A., Łódź.',
  industry: ORG_INDUSTRY,
  companySize: 'medium',
  website: 'https://www.apator.com',
  legacyWebsite: 'http://www.elkomtech.com.pl',
  defaultLanguage: 'pl',
  currency: 'PLN',
  city: 'Łódź',
};

const ELKOMTECH_CONTEXT = {
  company_name: 'Elkomtech',
  industry: ORG_INDUSTRY,
  company_size: 'medium',
  location: 'Łódź, Polska',
  employee_count: 160,
  key_metrics: { revenue2025_tysPln: 65219.5, revenue2024_tysPln: 41700.9, marginLevel1_2025_pct: 26.1, revenueGrowthYoY_pct: 56 },
  stakeholders: TEAM.map((t) => `${t.firstName} ${t.lastName} — ${t.jobTitle}`),
  open_gaps: [
    'Brak twardych danych z rejestru zapytań (wolumen, konwersja, czas S/M/L)',
    'Brak badania NPS / głosu klienta',
    'Procesy back-office niezmapowane (zakupy, magazyn, produkcja, SCADA, controlling)',
    'Brak systemu KPI (TTO/TTR/OTIF) i właścicieli procesów',
  ],
  completeness_percent: 60,
};

function requireProductionConfirmation() {
  const mode = String(process.env.SEED_MODE || '').toLowerCase();
  const confirm = String(process.env.SEED_CONFIRM || '');
  if (mode !== 'production') {
    throw new Error(`Refusing to run: set SEED_MODE=production (current: "${mode || '(empty)'}")`);
  }
  if (confirm !== 'YES_I_UNDERSTAND_PRODUCTION') {
    throw new Error('Refusing to run without explicit confirmation. Set SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION');
  }
}

function nowIso() {
  return new Date().toISOString();
}

type Db = {
  run: (sql: string, params?: unknown[]) => Promise<unknown>;
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rows?: T[] }>;
};

async function getTableColumns(db: Db, tableName: string): Promise<Set<string>> {
  const schema = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return new Set((schema.rows || []).map((row) => String(row.column_name || '').trim()));
}

async function tableExists(db: Db, tableName: string): Promise<boolean> {
  const res = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS exists`,
    [tableName]
  );
  return Boolean(res.rows?.[0]?.exists);
}

/** Dynamic UPSERT — wstawia tylko istniejące kolumny (odporne na drift). */
async function upsertDynamic(db: Db, table: string, conflictCols: string[], entries: Array<[string, unknown]>): Promise<boolean> {
  if (!(await tableExists(db, table))) {
    logger.warn(`[seed-elkomtech] Table "${table}" missing — skipped (drift?)`);
    return false;
  }
  const columns = await getTableColumns(db, table);
  const filtered = entries.filter(([c]) => columns.has(c));
  const haveConflict = conflictCols.every((c) => columns.has(c));
  if (!haveConflict || filtered.length === 0) {
    logger.warn(`[seed-elkomtech] Table "${table}" lacks required columns — skipped`);
    return false;
  }
  const insertColumns = filtered.map(([c]) => c);
  const params = filtered.map(([, v]) => v);
  const updates = insertColumns.filter((c) => !conflictCols.includes(c)).map((c) => `${c} = EXCLUDED.${c}`);
  const setClause = updates.length > 0 ? `DO UPDATE SET ${updates.join(', ')}` : 'DO NOTHING';
  await db.run(
    `INSERT INTO ${table} (${insertColumns.join(', ')})
     VALUES (${insertColumns.map((_, i) => `$${i + 1}`).join(', ')})
     ON CONFLICT (${conflictCols.join(', ')}) ${setClause}`,
    params
  );
  return true;
}

/**
 * Tworzy/aktualizuje usera. NIE nadpisuje hasła ani organization_id istniejących
 * kont (bezpieczne dla multi-org). Funkcję zapisuje w job_title/department (jeśli kolumny istnieją).
 */
async function upsertUser(
  db: Db,
  userCols: Set<string>,
  person: { firstName: string; lastName: string; email: string; jobTitle?: string; department?: string },
  defaultOrgId: string,
  newUserPasswordHash: string
): Promise<{ id: string; created: boolean }> {
  const email = person.email.toLowerCase().trim();
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE lower(trim(email)) = $1 LIMIT 1`,
    [email]
  );

  if (existing.rows?.[0]?.id) {
    const id = existing.rows[0].id;
    const sets: string[] = ['first_name = $1', 'last_name = $2', "status = 'active'"];
    const params: unknown[] = [person.firstName, person.lastName];
    if (person.jobTitle && userCols.has('job_title')) {
      params.push(person.jobTitle);
      sets.push(`job_title = $${params.length}`);
    }
    if (person.department && userCols.has('department')) {
      params.push(person.department);
      sets.push(`department = $${params.length}`);
    }
    params.push(id);
    await db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    return { id, created: false };
  }

  const id = crypto.randomUUID();
  const entries: Array<[string, unknown]> = (
    [
      ['id', id],
      ['organization_id', defaultOrgId],
      ['email', email],
      ['password', newUserPasswordHash],
      ['first_name', person.firstName],
      ['last_name', person.lastName],
      ['role', 'USER'],
      ['status', 'active'],
      ['job_title', person.jobTitle],
      ['department', person.department],
      ['created_at', nowIso()],
    ] as Array<[string, unknown]>
  ).filter(([c, v]) => userCols.has(c) && v !== undefined);
  const insertCols = entries.map(([c]) => c);
  const params = entries.map(([, v]) => v);
  await db.run(
    `INSERT INTO users (${insertCols.join(', ')}) VALUES (${insertCols.map((_, i) => `$${i + 1}`).join(', ')})`,
    params
  );
  return { id, created: true };
}

/** Słownik ról organization_members różni się między bazami (MEMBER vs USER). Wykryj z constraintu. */
async function detectMemberRole(db: Db): Promise<string> {
  try {
    const r = await db.query<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conrelid = 'organization_members'::regclass AND conname LIKE '%role%'`
    );
    const def = (r.rows || []).map((x) => x.def).join(' ');
    if (/'MEMBER'/.test(def)) return 'MEMBER';
    if (/'USER'/.test(def)) return 'USER';
  } catch {
    /* ignore — fallback below */
  }
  return 'MEMBER';
}

async function ensureOrgMember(db: Db, orgId: string, userId: string, role: string) {
  await db.run(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     VALUES ($1, $2, $3, $4, 'ACTIVE', $5)
     ON CONFLICT(organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE'`,
    [crypto.randomUUID(), orgId, userId, role, nowIso()]
  );
}

async function ensureProjectMember(db: Db, pmCols: Set<string>, projectId: string, userId: string, projectRole: string, addedById: string) {
  const entries: Array<[string, unknown]> = [
    ['id', crypto.randomUUID()],
    ['project_id', projectId],
    ['user_id', userId],
    ['project_role', projectRole],
    ['normalized_project_role', projectRole],
    ['legacy_project_role', projectRole],
    ['role_template_id', `factory_global_${projectRole.toLowerCase()}`],
    ['allocation_percent', 100],
    ['permissions', '{}'],
    ['added_by_id', addedById],
    ['created_at', nowIso()],
    ['updated_at', nowIso()],
  ].filter(([c]) => pmCols.has(c));
  const insertCols = entries.map(([c]) => c);
  const params = entries.map(([, v]) => v);
  await db.run(
    `INSERT INTO project_members (${insertCols.join(', ')})
     VALUES (${insertCols.map((_, i) => `$${i + 1}`).join(', ')})
     ON CONFLICT (project_id, user_id) DO UPDATE SET
       project_role = EXCLUDED.project_role,
       normalized_project_role = EXCLUDED.normalized_project_role`,
    params
  );
}

async function main() {
  requireProductionConfirmation();

  const target = resolveScriptDatabaseTarget({
    label: 'seed-elkomtech-organization',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('seed-elkomtech-organization', target);
  process.env.DATABASE_URL = target.connectionString;

  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = (await getDatabaseAsync()) as unknown as Db;

  const userCols = await getTableColumns(db, 'users');
  const passwordHash = bcrypt.hashSync(TEAM_TEMP_PASSWORD, 10);
  const memberRole = await detectMemberRole(db); // 'MEMBER' lub 'USER' wg constraintu bazy
  logger.info(`[seed-elkomtech] Member role for this DB: ${memberRole}`);

  // ── OWNER (Piotr/DBR) — musi już istnieć; nie ruszamy jego hasła/org ──────────
  const ownerRow = await db.query<{ id: string }>(`SELECT id FROM users WHERE lower(trim(email)) = $1 LIMIT 1`, [OWNER_EMAIL]);
  const ownerUserId = ownerRow.rows?.[0]?.id;
  if (!ownerUserId) throw new Error(`Owner user not found for ${OWNER_EMAIL} (run dev-ensure-admin first)`);

  // ── 1. organizacja ───────────────────────────────────────────────────────────
  await upsertDynamic(db, 'organizations', ['id'], [
    ['id', ORG_ID],
    ['name', ORG_NAME],
    ['status', 'active'],
    ['plan', ORG_PLAN],
    ['industry', ORG_INDUSTRY],
    ['domain', ORG_DOMAIN],
    ['organization_type', 'PAID'],
    ['billing_status', 'ACTIVE'],
    ['is_active', 1],
    ['attribution_data', JSON.stringify(ELKOMTECH_PUBLIC_FACTS)],
    ['created_by_user_id', ownerUserId],
    ['onboarding_status', 'ORG_SETUP_COMPLETED'],
    ['default_locale', 'pl'],
    ['enabled_locales', JSON.stringify(['pl', 'en'])],
    ['billing_currency', 'PLN'],
    ['billing_country', 'PL'],
    ['owner_id', ownerUserId],
    ['updated_at', nowIso()],
  ]);
  await ensureOrgMember(db, ORG_ID, ownerUserId, 'OWNER');

  // ── 2. profil + branding + kontekst ──────────────────────────────────────────
  const profileWritten = await upsertDynamic(db, 'organization_profiles', ['organization_id'], [
    ['id', `elkomtech_profile_${crypto.randomUUID()}`],
    ['organization_id', ORG_ID],
    ['industry', ELKOMTECH_PROFILE.industry],
    ['industry_subsector', ELKOMTECH_PROFILE.industry_subsector],
    ['industry_code', ELKOMTECH_PROFILE.industry_code],
    ['company_size', ELKOMTECH_PROFILE.company_size],
    ['employee_count', ELKOMTECH_PROFILE.employee_count],
    ['founding_year', ELKOMTECH_PROFILE.founding_year],
    ['headquarters_country', ELKOMTECH_PROFILE.headquarters_country],
    ['growth_stage', ELKOMTECH_PROFILE.growth_stage],
    ['risk_appetite', ELKOMTECH_PROFILE.risk_appetite],
    ['preferred_language', ELKOMTECH_PROFILE.preferred_language],
    ['communication_style', ELKOMTECH_PROFILE.communication_style],
    ['industry_jargon_level', ELKOMTECH_PROFILE.industry_jargon_level],
    ['production_archetype', ELKOMTECH_PROFILE.production_archetype],
    ['automation_level', ELKOMTECH_PROFILE.automation_level],
    ['profile_completeness', ELKOMTECH_PROFILE.profile_completeness],
    ['mission_statement', ELKOMTECH_PROFILE.mission_statement],
    ['vision_statement', ELKOMTECH_PROFILE.vision_statement],
    ['competitive_position', ELKOMTECH_PROFILE.competitive_position],
    ['strategic_priorities', JSON.stringify(ELKOMTECH_PROFILE.strategic_priorities)],
    ['primary_markets', JSON.stringify(ELKOMTECH_PROFILE.primary_markets)],
    ['customer_segments', JSON.stringify(ELKOMTECH_PROFILE.customer_segments)],
    ['key_competitors', JSON.stringify(ELKOMTECH_PROFILE.key_competitors)],
    ['regulatory_environment', JSON.stringify(ELKOMTECH_PROFILE.regulatory_environment)],
    ['currency', 'PLN'],
    ['created_by', ownerUserId],
    ['updated_by', ownerUserId],
  ]);

  await upsertDynamic(db, 'organization_settings', ['organization_id', 'setting_key'], [
    ['organization_id', ORG_ID],
    ['setting_key', 'branding'],
    ['setting_value', JSON.stringify(ELKOMTECH_BRANDING)],
    ['updated_at', nowIso()],
  ]);

  const contextWritten = await upsertDynamic(db, 'organization_context', ['organization_id'], [
    ['id', `elkomtech_ctx_${crypto.randomUUID()}`],
    ['organization_id', ORG_ID],
    ['company_name', ELKOMTECH_CONTEXT.company_name],
    ['industry', ELKOMTECH_CONTEXT.industry],
    ['company_size', ELKOMTECH_CONTEXT.company_size],
    ['location', ELKOMTECH_CONTEXT.location],
    ['employee_count', ELKOMTECH_CONTEXT.employee_count],
    ['key_metrics', JSON.stringify(ELKOMTECH_CONTEXT.key_metrics)],
    ['stakeholders', JSON.stringify(ELKOMTECH_CONTEXT.stakeholders)],
    ['open_gaps', JSON.stringify(ELKOMTECH_CONTEXT.open_gaps)],
    ['completeness_percent', ELKOMTECH_CONTEXT.completeness_percent],
  ]);

  // ── 3. zespół (19 osób) — userzy + członkostwo MEMBER ────────────────────────
  let createdUsers = 0;
  let updatedUsers = 0;
  const teamIds: Array<{ member: TeamMember; userId: string }> = [];
  for (const member of TEAM) {
    const { id, created } = await upsertUser(db, userCols, member, ORG_ID, passwordHash);
    await ensureOrgMember(db, ORG_ID, id, memberRole);
    teamIds.push({ member, userId: id });
    if (created) createdUsers += 1;
    else updatedUsers += 1;
  }

  // ── 4. osoba prowadząca projekt: Katarzyna Helman — ADMIN org + OBSERVER projektu
  const { id: leadUserId } = await upsertUser(
    db,
    userCols,
    {
      firstName: PROJECT_LEAD_FIRST,
      lastName: PROJECT_LEAD_LAST,
      email: PROJECT_LEAD_EMAIL,
      jobTitle: 'Osoba prowadząca projekt (manager-obserwator)',
      department: 'DBR / Prowadzenie projektu',
    },
    ORG_ID,
    passwordHash
  );
  await ensureOrgMember(db, ORG_ID, leadUserId, 'ADMIN');

  // ── 5. projekt + przypisania ról ─────────────────────────────────────────────
  const projectWritten = await upsertDynamic(db, 'projects', ['id'], [
    ['id', PROJECT_ID],
    ['organization_id', ORG_ID],
    ['name', PROJECT_NAME],
    ['description', PROJECT_DESCRIPTION],
    ['goal', PROJECT_GOAL],
    ['status', 'active'],
    ['owner_id', ownerUserId],
    ['current_phase', 'Context'],
    ['created_at', nowIso()],
    ['updated_at', nowIso()],
  ]);

  let projectMembers = 0;
  if (projectWritten && (await tableExists(db, 'project_members'))) {
    const pmCols = await getTableColumns(db, 'project_members');
    // OWNER (Piotr) jako konsultant prowadzący delivery
    await ensureProjectMember(db, pmCols, PROJECT_ID, ownerUserId, 'CONSULTANT', ownerUserId);
    projectMembers += 1;
    // Katarzyna — manager-obserwator (read-only)
    await ensureProjectMember(db, pmCols, PROJECT_ID, leadUserId, 'OBSERVER', ownerUserId);
    projectMembers += 1;
    // Zespół — wg RACI z TEAM.projectRole
    for (const { member, userId } of teamIds) {
      await ensureProjectMember(db, pmCols, PROJECT_ID, userId, member.projectRole, ownerUserId);
      projectMembers += 1;
    }
  }

  logger.info('[seed-elkomtech] ✅ Elkomtech project built', {
    organization: { id: ORG_ID, name: ORG_NAME },
    owner: OWNER_EMAIL,
    projectLead: { email: PROJECT_LEAD_EMAIL, orgRole: 'ADMIN', projectRole: 'OBSERVER' },
    team: { total: TEAM.length, createdUsers, updatedUsers },
    project: { id: PROJECT_ID, written: projectWritten, members: projectMembers },
    profileWritten,
    contextWritten,
  });

  // eslint-disable-next-line no-console
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  // eslint-disable-next-line no-console
  console.log('║                 Elkomtech — Full Project Built                       ║');
  // eslint-disable-next-line no-console
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  // eslint-disable-next-line no-console
  console.log(`║ Organization: ${ORG_NAME} (${ORG_ID})  | business owner: Apator S.A.`);
  // eslint-disable-next-line no-console
  console.log(`║ OWNER (system): ${OWNER_EMAIL}`);
  // eslint-disable-next-line no-console
  console.log(`║ Project: ${PROJECT_NAME} (${PROJECT_ID})`);
  // eslint-disable-next-line no-console
  console.log(`║ Project lead (manager-observer): ${PROJECT_LEAD_EMAIL} → ADMIN + OBSERVER`);
  // eslint-disable-next-line no-console
  console.log(`║ Team: ${TEAM.length} (created ${createdUsers}, updated ${updatedUsers}) | project members: ${projectMembers}`);
  // eslint-disable-next-line no-console
  console.log(`║ Temp password (new users only): ${TEAM_TEMP_PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[seed-elkomtech] Failed:', error);
  process.exit(1);
});
