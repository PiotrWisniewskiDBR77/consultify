#!/usr/bin/env tsx
/**
 * D1 — SEED RDZENIA — organizacja „Northwind Manufacturing Ltd." (`northwind`)
 * (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D1, §3, §3.1 wiersz „Rdzeń").
 *
 * Buduje: 1 organizację `organization_type='PAID'`, profil organizacji, 9 osób
 * z prawdziwymi stanowiskami/dostępnością, 9 członkostw `organization_members`
 * (OWNER×1, ADMIN×2, MEMBER×6 — wyłącznie ze słownika ról), 2 zespoły z liderami,
 * 2 projekty niesystemowe. WSZYSTKO PO ANGIELSKU.
 *
 * UŻYCIE
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/01-rdzen.ts --oczekiwany-host 54418 --dry-run
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/01-rdzen.ts --oczekiwany-host 54418 --apply
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/01-rdzen.ts --oczekiwany-host 54418 --reset
 *
 * IDEMPOTENCJA: identyfikatory są UUIDv5 (`00-wspolne.ts:det`), drugi `--apply`
 * bez `--resetuj-hasla` musi dać `utworzono=0 zmieniono=0`.
 *
 * HASŁA: jedno wspólne hasło losowane przy pierwszym `--apply`, zapisane
 * WYŁĄCZNIE do pliku poza repo (`--haslo-plik`, domyślnie
 * `/private/tmp/dane-pokazowe-en/northwind-konta.txt`, chmod 600). Nie jest
 * drukowane na stdout. Istniejące konta NIE dostają nowego hasła, chyba że
 * `--resetuj-hasla`.
 *
 * `users.role` NIGDY nie niesie stanowiska (defekt zastany, patrz POMIAR.md §1.4)
 * — niesie WYŁĄCZNIE wartość ze słownika ról (OWNER/ADMIN/MEMBER), identyczną
 * jak `organization_members.role` tej samej osoby. Stanowisko żyje wyłącznie
 * w `users.job_title`.
 */
import bcrypt from 'bcryptjs';
import type { PoolClient } from 'pg';

import {
  DOMENA,
  Licznik,
  ORG_ID,
  ORG_NAZWA,
  ORG_SLUG,
  czytajWspolneArgumenty,
  det,
  losoweHaslo,
  otworzPool,
  sprawdzCel,
  sprawdzRoleSlownika,
  wymaganyUrl,
  zapiszHaslaPlik,
} from './00-wspolne';

// ============================================================================
// Dane — 9 osób, po angielsku, role WYŁĄCZNIE ze słownika
// (CHECK organization_members_role_check: OWNER/ADMIN/MEMBER/CONSULTANT/USER/GUEST)
// ============================================================================
type Osoba = {
  slug: string; // firstname.lastname — klucz e-maila i deterministycznego id
  imie: string;
  nazwisko: string;
  jobTitle: string;
  department: string;
  weeklyCapacityHours: number;
  rola: 'OWNER' | 'ADMIN' | 'MEMBER';
};

const OSOBY: Osoba[] = [
  { slug: 'james.whitfield', imie: 'James', nazwisko: 'Whitfield', jobTitle: 'Operations Director', department: 'Operations', weeklyCapacityHours: 40, rola: 'OWNER' },
  { slug: 'sarah.mitchell', imie: 'Sarah', nazwisko: 'Mitchell', jobTitle: 'Plant Manager', department: 'Manufacturing', weeklyCapacityHours: 40, rola: 'ADMIN' },
  { slug: 'robert.chen', imie: 'Robert', nazwisko: 'Chen', jobTitle: 'Head of Quality', department: 'Quality', weeklyCapacityHours: 38, rola: 'ADMIN' },
  { slug: 'emily.carter', imie: 'Emily', nazwisko: 'Carter', jobTitle: 'Production Planner', department: 'Planning', weeklyCapacityHours: 37, rola: 'MEMBER' },
  { slug: 'daniel.osei', imie: 'Daniel', nazwisko: 'Osei', jobTitle: 'Automation Engineer', department: 'Engineering', weeklyCapacityHours: 40, rola: 'MEMBER' },
  { slug: 'laura.novak', imie: 'Laura', nazwisko: 'Novak', jobTitle: 'Controls Engineer', department: 'Engineering', weeklyCapacityHours: 36, rola: 'MEMBER' },
  { slug: 'michael.grant', imie: 'Michael', nazwisko: 'Grant', jobTitle: 'Data Analyst', department: 'Operations', weeklyCapacityHours: 35, rola: 'MEMBER' },
  { slug: 'priya.sharma', imie: 'Priya', nazwisko: 'Sharma', jobTitle: 'HR Business Partner', department: 'Human Resources', weeklyCapacityHours: 32, rola: 'MEMBER' },
  { slug: 'thomas.baker', imie: 'Thomas', nazwisko: 'Baker', jobTitle: 'Finance Controller', department: 'Finance', weeklyCapacityHours: 40, rola: 'MEMBER' },
];

const emailOsoby = (o: Osoba) => `${o.slug}@${DOMENA}`;

// ============================================================================
// Zespoły — 2, po angielsku, liderzy z listy powyżej
// ============================================================================
type Zespol = {
  slug: string;
  nazwa: string;
  opis: string;
  kolor: string;
  liderSlug: string;
  czlonkowieSlugi: string[]; // zawiera lidera
};

const ZESPOLY: Zespol[] = [
  {
    slug: 'plant-operations',
    nazwa: 'Plant Operations — Leeds & Rotherham',
    opis: 'Runs day-to-day manufacturing operations across both sites and owns the operations data used for planning and reporting.',
    kolor: 'blue',
    liderSlug: 'sarah.mitchell',
    czlonkowieSlugi: ['sarah.mitchell', 'james.whitfield', 'emily.carter', 'michael.grant', 'priya.sharma'],
  },
  {
    slug: 'engineering-quality',
    nazwa: 'Engineering & Quality',
    opis: 'Owns automation, controls and quality assurance for the Northwind 2027 transformation programme.',
    kolor: 'violet',
    liderSlug: 'robert.chen',
    czlonkowieSlugi: ['robert.chen', 'daniel.osei', 'laura.novak', 'thomas.baker'],
  },
];

// ============================================================================
// Projekty — 2, niesystemowe, po angielsku
// ============================================================================
type Projekt = {
  slug: string;
  nazwa: string;
  opis: string;
  cel: string;
  ownerSlug: string;
  startDate: string;
  targetEndDate: string;
  budget: number;
  currency: string;
  priority: string;
  phase: string;
  status: string;
};

const PROJEKTY: Projekt[] = [
  {
    slug: 'operational-excellence-programme',
    nazwa: 'Operational Excellence Programme',
    opis:
      'Northwind 2027 flagship programme to modernise manufacturing operations across the Leeds and Rotherham plants — warehouse automation, predictive maintenance and supplier risk management.',
    cel: 'Reduce unplanned downtime by 30% and cut warehouse handling cost per unit by 20% by end of 2027.',
    ownerSlug: 'james.whitfield',
    startDate: '2026-01-12',
    targetEndDate: '2027-12-17',
    budget: 2400000,
    currency: 'GBP',
    priority: 'high',
    phase: 'execution',
    status: 'active',
  },
  {
    slug: 'digital-automation-roadmap',
    nazwa: 'Digital & Automation Roadmap',
    opis:
      'Engineering-led roadmap covering digital work instructions, the Rotherham Line 3 digital twin pilot and controls modernisation across both sites.',
    cel: 'Deliver a validated digital twin pilot on Line 3 and roll out digital work instructions to 80% of shopfloor roles.',
    ownerSlug: 'robert.chen',
    startDate: '2026-03-02',
    targetEndDate: '2027-06-30',
    budget: 850000,
    currency: 'GBP',
    priority: 'medium',
    phase: 'planning',
    status: 'active',
  },
];

// ============================================================================
// Profil organizacji
// ============================================================================
const PROFIL = {
  industry: 'Industrial Manufacturing',
  industry_subsector: 'Precision Components',
  company_size: 'MID_MARKET',
  employee_count: 340,
  annual_revenue: 48000000,
  founding_year: 1987,
  headquarters_country: 'United Kingdom',
  mission_statement:
    'Engineer and manufacture precision industrial components that keep our customers’ production lines running, safely and reliably, every shift.',
  vision_statement:
    'To be the UK’s most trusted precision manufacturing partner through digitally-enabled, zero-defect operations.',
  competitive_position: 'CHALLENGER',
  growth_stage: 'MATURE',
  risk_appetite: 'MODERATE',
  preferred_language: 'en',
  communication_style: 'PROFESSIONAL',
  currency: 'GBP',
};

/**
 * FLAGI V8 ORGANIZACJI — bez nich cała powierzchnia `/api/v8/*` zwraca 404
 * `V8_ORG_DISABLED` dla nowej organizacji NA PRODUKCYJNYM `NODE_ENV`.
 *
 * ZMIERZONE w D8 na stagingu (nie w planie): `v8FeatureGate.middleware.ts:7`
 * `allowImplicitOrgRowsFallback()` = `NODE_ENV !== 'production'`. Lokalne
 * stanowisko dowodowe D1-D7 chodzi na `NODE_ENV=development`, więc organizacja
 * BEZ ani jednego wiersza w `v8.v8_feature_flags` była tam cicho przepuszczana.
 * Staging i demo chodzą na `NODE_ENV=production` — tam brak wierszy = 404, co
 * wywróciło rejestrację budżetu w paczce D5 (`POST /api/v8/finance/budgets`).
 *
 * Wartości = LUSTRO organizacji referencyjnej stagingu (DBR77): każdy moduł
 * poza `finance` i `shadow_mode` włączony. `v8OrgGate` sprawdza „którykolwiek
 * moduł włączony", nie moduł per trasa (`featureFlagService.ts:isV8Enabled`),
 * więc `finance=0` NIE blokuje tras finansowych — trzymamy się konfiguracji,
 * która na stagingu jest sprawdzona, zamiast wymyślać własną.
 *
 * Kształt wiersza jest DOKŁADNIE taki, jaki pisze kanoniczny pisarz
 * `setV8OrgFlag()` (`server/src/services/v8/featureFlagService.ts:160`):
 * `flag_id = "<orgId>:<module>"`, `enabled` 0/1, `updated_at` ISO.
 * Trasą API tego zrobić się NIE DA — `PUT /api/v8/admin/feature-flags/:module`
 * wymaga SUPERADMINA (`feature-flags.routes.ts:34`), którego seed nie ma i
 * którego wymuszanie zmieniałoby trwale rolę cudzego konta.
 */
const FLAGI_V8: Array<{ modul: string; wlaczony: boolean }> = [
  { modul: 'ai_core', wlaczony: true },
  { modul: 'chat', wlaczony: true },
  { modul: 'finance', wlaczony: false },
  { modul: 'lifecycle', wlaczony: true },
  { modul: 'multiplayer', wlaczony: true },
  { modul: 'outputs', wlaczony: true },
  { modul: 'pm_sync', wlaczony: true },
  { modul: 'results', wlaczony: true },
  { modul: 'workspace', wlaczony: true },
];

// ============================================================================
// Plan
// ============================================================================
type StanElementu = 'utworzy' | 'zaktualizuje' | 'bez zmian';

type Plan = {
  organizacja: StanElementu;
  profil: StanElementu;
  osoby: Array<{ slug: string; email: string; akcja: StanElementu | 'KONFLIKT'; powod?: string }>;
  czlonkostwa: Array<{ slug: string; akcja: StanElementu }>;
  zespoly: Array<{ slug: string; akcja: StanElementu }>;
  czlonkowieZespolow: Array<{ zespolSlug: string; osobaSlug: string; akcja: StanElementu }>;
  projekty: Array<{ slug: string; akcja: StanElementu }>;
  flagiV8: Array<{ modul: string; akcja: StanElementu }>;
};

/**
 * Tabela flag V8: kanoniczna jest `v8.v8_feature_flags`, ale
 * `featureFlagService.ts` ma udokumentowany fallback na `public.v8_feature_flags`
 * tam, gdzie schemat `v8` nie istnieje. Powtarzamy dokładnie ten wybór, żeby
 * seed nie wywrócił się na bazie bez schematu `v8`.
 */
async function tabelaFlagV8(c: PoolClient): Promise<string> {
  const r = await c.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'v8' AND table_name = 'v8_feature_flags'"
  );
  return Number(r.rows[0]?.n ?? 0) > 0 ? 'v8.v8_feature_flags' : 'v8_feature_flags';
}

async function zbudujPlan(c: PoolClient, resetujHasla: boolean): Promise<Plan> {
  const plan: Plan = {
    organizacja: 'utworzy',
    profil: 'utworzy',
    osoby: [],
    czlonkostwa: [],
    zespoly: [],
    czlonkowieZespolow: [],
    projekty: [],
    flagiV8: [],
  };

  // --- Organizacja -----------------------------------------------------------
  const org = await c.query<{ id: string; name: string; organization_type: string; is_active: number; plan: string }>(
    'SELECT id, name, organization_type, is_active, plan FROM organizations WHERE id = $1',
    [ORG_ID]
  );
  if (org.rows.length > 0) {
    const r = org.rows[0]!;
    plan.organizacja =
      r.name === ORG_NAZWA && r.organization_type === 'PAID' && Number(r.is_active) === 1 && r.plan === 'enterprise'
        ? 'bez zmian'
        : 'zaktualizuje';
  }

  // --- Profil ------------------------------------------------------------------
  const profil = await c.query<{ organization_id: string; industry: string | null; employee_count: number | null }>(
    'SELECT organization_id, industry, employee_count FROM organization_profiles WHERE organization_id = $1',
    [ORG_ID]
  );
  if (profil.rows.length > 0) {
    const p = profil.rows[0]!;
    plan.profil = p.industry === PROFIL.industry && Number(p.employee_count) === PROFIL.employee_count ? 'bez zmian' : 'zaktualizuje';
  }

  // --- 9 osób ------------------------------------------------------------------
  for (const o of OSOBY) {
    const email = emailOsoby(o);
    const userId = det('user', email);
    const istnieje = await c.query<{
      id: string;
      organization_id: string | null;
      first_name: string | null;
      last_name: string | null;
      role: string | null;
      job_title: string | null;
      department: string | null;
      weekly_capacity_hours: string | null;
      timezone: string | null;
      language: string | null;
      status: string | null;
    }>(
      'SELECT id, organization_id, first_name, last_name, role, job_title, department, weekly_capacity_hours, timezone, language, status FROM users WHERE email = $1',
      [email]
    );

    if (istnieje.rows.length === 0) {
      plan.osoby.push({ slug: o.slug, email, akcja: 'utworzy' });
      plan.czlonkostwa.push({ slug: o.slug, akcja: 'utworzy' });
      continue;
    }

    const u = istnieje.rows[0]!;
    if (String(u.organization_id || '') !== ORG_ID) {
      plan.osoby.push({
        slug: o.slug,
        email,
        akcja: 'KONFLIKT',
        powod: `e-mail już istnieje w innej organizacji (organization_id="${u.organization_id ?? '(puste)'}"). E-mail jest globalnie unikalny — nie przenoszę.`,
      });
      continue;
    }
    if (u.id !== userId) {
      plan.osoby.push({
        slug: o.slug,
        email,
        akcja: 'KONFLIKT',
        powod: `konto istnieje z innym id niż deterministyczne (${u.id} ≠ ${userId}). Nie przepisuję cudzego rekordu.`,
      });
      continue;
    }

    const trzebaZmienic =
      u.first_name !== o.imie ||
      u.last_name !== o.nazwisko ||
      u.role !== o.rola ||
      u.job_title !== o.jobTitle ||
      u.department !== o.department ||
      Number(u.weekly_capacity_hours) !== o.weeklyCapacityHours ||
      u.timezone !== 'Europe/London' ||
      u.language !== 'en' ||
      u.status !== 'active';
    plan.osoby.push({ slug: o.slug, email, akcja: trzebaZmienic || resetujHasla ? 'zaktualizuje' : 'bez zmian' });

    const czl = await c.query<{ role: string; status: string | null }>(
      'SELECT role, status FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [ORG_ID, userId]
    );
    if (czl.rows.length === 0) plan.czlonkostwa.push({ slug: o.slug, akcja: 'utworzy' });
    else
      plan.czlonkostwa.push({
        slug: o.slug,
        akcja: czl.rows[0]!.role === o.rola && czl.rows[0]!.status === 'ACTIVE' ? 'bez zmian' : 'zaktualizuje',
      });
  }

  const konflikty = plan.osoby.filter((o) => o.akcja === 'KONFLIKT');
  if (konflikty.length > 0) return plan; // nie planuj reszty — apply i tak się zatrzyma

  // --- 2 zespoły -----------------------------------------------------------------
  for (const z of ZESPOLY) {
    const teamId = det('team', z.slug);
    const istnieje = await c.query<{ id: string; name: string; description: string | null; lead_id: string | null }>(
      'SELECT id, name, description, lead_id FROM teams WHERE id = $1',
      [teamId]
    );
    const liderId = det('user', emailOsoby(OSOBY.find((o) => o.slug === z.liderSlug)!));
    if (istnieje.rows.length === 0) {
      plan.zespoly.push({ slug: z.slug, akcja: 'utworzy' });
    } else {
      const t = istnieje.rows[0]!;
      plan.zespoly.push({
        slug: z.slug,
        akcja: t.name === z.nazwa && t.description === z.opis && t.lead_id === liderId ? 'bez zmian' : 'zaktualizuje',
      });
    }

    for (const czlonekSlug of z.czlonkowieSlugi) {
      const userId = det('user', emailOsoby(OSOBY.find((o) => o.slug === czlonekSlug)!));
      const czlTeam = await c.query(
        'SELECT team_id, role FROM team_members WHERE team_id = $1 AND user_id = $2',
        [teamId, userId]
      );
      const oczekiwanaRola = czlonekSlug === z.liderSlug ? 'lead' : 'member';
      if (czlTeam.rows.length === 0)
        plan.czlonkowieZespolow.push({ zespolSlug: z.slug, osobaSlug: czlonekSlug, akcja: 'utworzy' });
      else
        plan.czlonkowieZespolow.push({
          zespolSlug: z.slug,
          osobaSlug: czlonekSlug,
          akcja: czlTeam.rows[0]!.role === oczekiwanaRola ? 'bez zmian' : 'zaktualizuje',
        });
    }
  }

  // --- 2 projekty ------------------------------------------------------------------
  for (const p of PROJEKTY) {
    const projectId = det('project', p.slug);
    const ownerId = det('user', emailOsoby(OSOBY.find((o) => o.slug === p.ownerSlug)!));
    const istnieje = await c.query<{ id: string; name: string; description: string | null; owner_id: string | null }>(
      'SELECT id, name, description, owner_id FROM projects WHERE id = $1',
      [projectId]
    );
    if (istnieje.rows.length === 0) plan.projekty.push({ slug: p.slug, akcja: 'utworzy' });
    else {
      const r = istnieje.rows[0]!;
      plan.projekty.push({
        slug: p.slug,
        akcja: r.name === p.nazwa && r.description === p.opis && r.owner_id === ownerId ? 'bez zmian' : 'zaktualizuje',
      });
    }
  }

  // --- flagi V8 organizacji -------------------------------------------------------
  const flagi = await c.query<{ module: string; enabled: number }>(
    `SELECT module, enabled FROM ${await tabelaFlagV8(c)} WHERE organization_id = $1`,
    [ORG_ID]
  );
  for (const f of FLAGI_V8) {
    const wiersz = flagi.rows.find((r) => r.module === f.modul);
    plan.flagiV8.push({
      modul: f.modul,
      akcja: !wiersz ? 'utworzy' : Number(wiersz.enabled) === (f.wlaczony ? 1 : 0) ? 'bez zmian' : 'zaktualizuje',
    });
  }

  return plan;
}

function liczOgolem(plan: Plan) {
  return (
    (plan.organizacja !== 'bez zmian' ? 1 : 0) +
    (plan.profil !== 'bez zmian' ? 1 : 0) +
    plan.osoby.filter((o) => o.akcja !== 'bez zmian' && o.akcja !== 'KONFLIKT').length +
    plan.czlonkostwa.filter((m) => m.akcja !== 'bez zmian').length +
    plan.zespoly.filter((z) => z.akcja !== 'bez zmian').length +
    plan.czlonkowieZespolow.filter((m) => m.akcja !== 'bez zmian').length +
    plan.projekty.filter((p) => p.akcja !== 'bez zmian').length +
    plan.flagiV8.filter((f) => f.akcja !== 'bez zmian').length
  );
}

// ============================================================================
// Zapis
// ============================================================================
async function zapisz(c: PoolClient, plan: Plan, resetujHasla: boolean, hasloPlik: string): Promise<Licznik> {
  const lic = new Licznik();
  let wspolneHaslo: string | null = null;
  const kontaZHaslem: string[] = [];

  await c.query('BEGIN');
  try {
    // --- Organizacja -----------------------------------------------------------
    if (plan.organizacja !== 'bez zmian') {
      await c.query(
        `INSERT INTO organizations (id, name, plan, status, industry, organization_type, is_active, default_language, default_timezone)
         VALUES ($1, $2, 'enterprise', 'active', $3, 'PAID', 1, 'en', 'Europe/London')
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name,
                                        plan = EXCLUDED.plan,
                                        organization_type = EXCLUDED.organization_type,
                                        is_active = EXCLUDED.is_active,
                                        industry = EXCLUDED.industry,
                                        default_language = EXCLUDED.default_language,
                                        default_timezone = EXCLUDED.default_timezone`,
        [ORG_ID, ORG_NAZWA, PROFIL.industry]
      );
      if (plan.organizacja === 'utworzy') lic.utworz();
      else lic.zmien();
    } else lic.pomin();

    // --- Profil ------------------------------------------------------------------
    if (plan.profil !== 'bez zmian') {
      await c.query(
        `INSERT INTO organization_profiles (
           id, organization_id, industry, industry_subsector, company_size, employee_count,
           annual_revenue, founding_year, headquarters_country, mission_statement, vision_statement,
           competitive_position, growth_stage, risk_appetite, preferred_language, communication_style, currency
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (id) DO UPDATE SET
           industry = EXCLUDED.industry, industry_subsector = EXCLUDED.industry_subsector,
           company_size = EXCLUDED.company_size, employee_count = EXCLUDED.employee_count,
           annual_revenue = EXCLUDED.annual_revenue, founding_year = EXCLUDED.founding_year,
           headquarters_country = EXCLUDED.headquarters_country, mission_statement = EXCLUDED.mission_statement,
           vision_statement = EXCLUDED.vision_statement, competitive_position = EXCLUDED.competitive_position,
           growth_stage = EXCLUDED.growth_stage, risk_appetite = EXCLUDED.risk_appetite,
           preferred_language = EXCLUDED.preferred_language, communication_style = EXCLUDED.communication_style,
           currency = EXCLUDED.currency, updated_at = CURRENT_TIMESTAMP`,
        [
          det('profile', ORG_SLUG),
          ORG_ID,
          PROFIL.industry,
          PROFIL.industry_subsector,
          PROFIL.company_size,
          PROFIL.employee_count,
          PROFIL.annual_revenue,
          PROFIL.founding_year,
          PROFIL.headquarters_country,
          PROFIL.mission_statement,
          PROFIL.vision_statement,
          PROFIL.competitive_position,
          PROFIL.growth_stage,
          PROFIL.risk_appetite,
          PROFIL.preferred_language,
          PROFIL.communication_style,
          PROFIL.currency,
        ]
      );
      if (plan.profil === 'utworzy') lic.utworz();
      else lic.zmien();
    } else lic.pomin();

    // --- 9 osób ------------------------------------------------------------------
    for (const o of OSOBY) {
      const email = emailOsoby(o);
      const userId = det('user', email);
      const stan = plan.osoby.find((p) => p.slug === o.slug)!.akcja;
      if (stan === 'bez zmian' && !resetujHasla) {
        lic.pomin();
        continue;
      }

      if (stan === 'utworzy') {
        if (!wspolneHaslo) wspolneHaslo = losoweHaslo();
        kontaZHaslem.push(email);
        await c.query(
          `INSERT INTO users (
             id, organization_id, email, password, first_name, last_name, role, status,
             job_title, department, weekly_capacity_hours, timezone, language, locale
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,'Europe/London','en','en')`,
          [
            userId,
            ORG_ID,
            email,
            await bcrypt.hash(wspolneHaslo, 10),
            o.imie,
            o.nazwisko,
            o.rola,
            o.jobTitle,
            o.department,
            o.weeklyCapacityHours,
          ]
        );
        lic.utworz();
      } else {
        if (resetujHasla) {
          if (!wspolneHaslo) wspolneHaslo = losoweHaslo();
          kontaZHaslem.push(email);
          await c.query('UPDATE users SET password = $1 WHERE id = $2', [await bcrypt.hash(wspolneHaslo, 10), userId]);
        }
        await c.query(
          `UPDATE users SET first_name=$1, last_name=$2, role=$3, status='active', job_title=$4, department=$5,
                             weekly_capacity_hours=$6, timezone='Europe/London', language='en', locale='en'
           WHERE id = $7`,
          [o.imie, o.nazwisko, o.rola, o.jobTitle, o.department, o.weeklyCapacityHours, userId]
        );
        lic.zmien();
      }
    }

    // --- 9 członkostw ------------------------------------------------------------
    for (const o of OSOBY) {
      const userId = det('user', emailOsoby(o));
      const stan = plan.czlonkostwa.find((p) => p.slug === o.slug)!.akcja;
      if (stan === 'bez zmian') {
        lic.pomin();
        continue;
      }
      await c.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1,$2,$3,$4,'ACTIVE')
         ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE'`,
        [det('member', `${ORG_SLUG}|${emailOsoby(o)}`), ORG_ID, userId, o.rola]
      );
      if (stan === 'utworzy') lic.utworz();
      else lic.zmien();
    }

    // Właściciel organizacji = osoba z rolą OWNER.
    const wlasciciel = OSOBY.find((o) => o.rola === 'OWNER')!;
    await c.query('UPDATE organizations SET owner_id = $1 WHERE id = $2 AND owner_id IS DISTINCT FROM $1', [
      det('user', emailOsoby(wlasciciel)),
      ORG_ID,
    ]);

    // --- 2 zespoły -----------------------------------------------------------------
    for (const z of ZESPOLY) {
      const teamId = det('team', z.slug);
      const liderId = det('user', emailOsoby(OSOBY.find((o) => o.slug === z.liderSlug)!));
      const stan = plan.zespoly.find((p) => p.slug === z.slug)!.akcja;
      if (stan !== 'bez zmian') {
        await c.query(
          `INSERT INTO teams (id, organization_id, name, description, lead_id, color, is_active, team_type)
           VALUES ($1,$2,$3,$4,$5,$6,1,'standard')
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
                                          lead_id = EXCLUDED.lead_id, updated_at = CURRENT_TIMESTAMP`,
          [teamId, ORG_ID, z.nazwa, z.opis, liderId, z.kolor]
        );
        if (stan === 'utworzy') lic.utworz();
        else lic.zmien();
      } else lic.pomin();

      for (const czlonekSlug of z.czlonkowieSlugi) {
        const userId = det('user', emailOsoby(OSOBY.find((o) => o.slug === czlonekSlug)!));
        const rola = czlonekSlug === z.liderSlug ? 'lead' : 'member';
        const stanCz = plan.czlonkowieZespolow.find((p) => p.zespolSlug === z.slug && p.osobaSlug === czlonekSlug)!.akcja;
        if (stanCz === 'bez zmian') {
          lic.pomin();
          continue;
        }
        await c.query(
          `INSERT INTO team_members (team_id, user_id, role, allocation_percent, is_primary_team)
           VALUES ($1,$2,$3,100,1)
           ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
          [teamId, userId, rola]
        );
        if (stanCz === 'utworzy') lic.utworz();
        else lic.zmien();
      }
    }

    // --- 2 projekty ------------------------------------------------------------------
    for (const p of PROJEKTY) {
      const projectId = det('project', p.slug);
      const ownerId = det('user', emailOsoby(OSOBY.find((o) => o.slug === p.ownerSlug)!));
      const stan = plan.projekty.find((pp) => pp.slug === p.slug)!.akcja;
      if (stan === 'bez zmian') {
        lic.pomin();
        continue;
      }
      await c.query(
        `INSERT INTO projects (
           id, organization_id, name, description, goal, status, owner_id, lead_id,
           start_date, target_end_date, budget_amount, budget_currency, currency, priority, phase,
           is_system, rag_enabled
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$11,$12,$13,false,1)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, description = EXCLUDED.description, goal = EXCLUDED.goal,
           owner_id = EXCLUDED.owner_id, lead_id = EXCLUDED.lead_id, start_date = EXCLUDED.start_date,
           target_end_date = EXCLUDED.target_end_date, budget_amount = EXCLUDED.budget_amount,
           budget_currency = EXCLUDED.budget_currency, currency = EXCLUDED.currency,
           priority = EXCLUDED.priority, phase = EXCLUDED.phase, updated_at = CURRENT_TIMESTAMP`,
        [
          projectId,
          ORG_ID,
          p.nazwa,
          p.opis,
          p.cel,
          p.status,
          ownerId,
          p.startDate,
          p.targetEndDate,
          p.budget,
          p.currency,
          p.priority,
          p.phase,
        ]
      );
      if (stan === 'utworzy') lic.utworz();
      else lic.zmien();
    }

    // --- flagi V8 organizacji ---------------------------------------------------
    const tabelaFlag = await tabelaFlagV8(c);
    for (const f of FLAGI_V8) {
      const stan = plan.flagiV8.find((x) => x.modul === f.modul)!.akcja;
      if (stan === 'bez zmian') {
        lic.pomin();
        continue;
      }
      await c.query(
        `INSERT INTO ${tabelaFlag} (flag_id, organization_id, module, enabled, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, NULL)
         ON CONFLICT (organization_id, module)
         DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = EXCLUDED.updated_at`,
        [`${ORG_ID}:${f.modul}`, ORG_ID, f.modul, f.wlaczony ? 1 : 0, new Date().toISOString()]
      );
      if (stan === 'utworzy') lic.utworz();
      else lic.zmien();
    }

    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }

  if (wspolneHaslo && kontaZHaslem.length > 0) {
    const tresc =
      `Konta pokazowe — organizacja "${ORG_NAZWA}" (northwind) — PLIK POZA REPOZYTORIUM.\n` +
      `Wygenerowano: ${new Date().toISOString()}\n` +
      `Wspólne hasło do wszystkich kont poniżej (dostęp pokazowy): ${wspolneHaslo}\n\n` +
      kontaZHaslem.map((e) => `  ${e}`).join('\n') +
      '\n';
    zapiszHaslaPlik(hasloPlik, tresc);
    console.log(`\n[rdzen] hasło (1 wspólne dla ${kontaZHaslem.length} kont) zapisane do ${hasloPlik} (chmod 600). NIE jest drukowane.`);
  }

  return lic;
}

// ============================================================================
// Reset — kasuje WYŁĄCZNIE organization_id = ORG_ID (Northwind)
// ============================================================================
async function reset(c: PoolClient): Promise<void> {
  const org = await c.query('SELECT id FROM organizations WHERE id = $1', [ORG_ID]);
  if (org.rows.length === 0) {
    console.log('[rdzen] reset: organizacja "northwind" już nie istnieje — nic do zrobienia.');
    return;
  }
  await c.query('BEGIN');
  try {
    // Cykl FK organizations.owner_id -> users.id oraz users.organization_id -> organizations.id:
    // najpierw zerujemy owner_id, potem kasujemy users (kaskadowo zabiera organization_members
    // i team_members), na końcu organizację (kaskadowo zabiera teams, projects, organization_profiles).
    await c.query('UPDATE organizations SET owner_id = NULL WHERE id = $1', [ORG_ID]);
    const usunieciUzytkownicy = (await c.query('DELETE FROM users WHERE organization_id = $1', [ORG_ID])).rowCount ?? 0;
    await c.query(`DELETE FROM ${await tabelaFlagV8(c)} WHERE organization_id = $1`, [ORG_ID]);
    await c.query('DELETE FROM organizations WHERE id = $1', [ORG_ID]);
    await c.query('COMMIT');
    console.log(`[rdzen] reset: usunięto organizację "northwind" + ${usunieciUzytkownicy} kont (kaskada: członkostwa, zespoły, projekty, profil).`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
}

// ============================================================================
// main
// ============================================================================
async function main() {
  const opcje = czytajWspolneArgumenty(process.argv.slice(2));
  if (opcje.tryb === 'verify') throw new Error('--verify obsługuje 99-verify.ts, nie 01-rdzen.ts.');

  // Guard uruchomieniowy: żadna z 9 osób nie ma roli spoza słownika (nigdy stanowiska).
  for (const o of OSOBY) sprawdzRoleSlownika(o.rola, `osoba ${o.slug}`);

  const url = wymaganyUrl();
  const toz = sprawdzCel(url, opcje.oczekiwanyHost, opcje.celZdalny);
  const pool = otworzPool(url);
  const c = await pool.connect();

  try {
    console.log(`[rdzen] cel:          ${toz}`);
    console.log(`[rdzen] organizacja:  ${ORG_NAZWA} (id ${ORG_ID})`);
    console.log(`[rdzen] tryb:         ${opcje.tryb}`);

    if (opcje.tryb === 'reset') {
      await reset(c);
      return;
    }

    const plan = await zbudujPlan(c, opcje.resetujHasla);
    const konflikty = plan.osoby.filter((o) => o.akcja === 'KONFLIKT');

    console.log('\n--- PLAN ---');
    console.log(`organizacja: ${plan.organizacja}`);
    console.log(`profil:      ${plan.profil}`);
    for (const o of plan.osoby) console.log(`osoba        ${o.email.padEnd(34)} ${o.akcja}${o.powod ? ' — ' + o.powod : ''}`);
    for (const m of plan.czlonkostwa) console.log(`członkostwo  ${m.slug.padEnd(34)} ${m.akcja}`);
    for (const z of plan.zespoly) console.log(`zespół       ${z.slug.padEnd(34)} ${z.akcja}`);
    for (const m of plan.czlonkowieZespolow) console.log(`zesp.członek ${(m.zespolSlug + '/' + m.osobaSlug).padEnd(34)} ${m.akcja}`);
    for (const p of plan.projekty) console.log(`projekt      ${p.slug.padEnd(34)} ${p.akcja}`);
    for (const f of plan.flagiV8) console.log(`flaga V8     ${f.modul.padEnd(34)} ${f.akcja}`);

    if (konflikty.length > 0) {
      console.error(`\n[rdzen] KONFLIKTY: ${konflikty.length}. Nic nie zapisano.`);
      process.exitCode = 2;
      return;
    }

    if (opcje.tryb === 'dry-run') {
      const doZmiany = liczOgolem(plan);
      console.log(`\n[rdzen] dry-run: plan obejmuje 1 organizację + profil + 9 osób + 9 członkostw + 2 zespoły + ${ZESPOLY.reduce((n, z) => n + z.czlonkowieSlugi.length, 0)} członków zespołów + 2 projekty + ${FLAGI_V8.length} flag V8. ${doZmiany} rzeczy do zmiany. Nic nie zapisano.`);
      return;
    }

    // --apply
    const lic = await zapisz(c, plan, opcje.resetujHasla, opcje.hasloPlik);
    console.log('\n' + lic.raport('rdzen'));
    if (lic.utworzono === 0 && lic.zmieniono === 0) console.log('[rdzen] idempotentnie: nic nie było do zrobienia.');
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(`[rdzen] BŁĄD: ${(e as Error).message}`);
  process.exit(1);
});
