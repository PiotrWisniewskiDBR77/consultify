#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Repair seed:
 * - Ensure APPROVED assessments are never "empty" (answers + completion/progress).
 * - Add 8–10 fully filled assessment-sourced initiatives.
 *
 * Safe / idempotent:
 * - Only updates assessments that are APPROVED AND missing meaningful content.
 * - Inserts initiatives with deterministic IDs (upsert).
 *
 * Usage (SQLite dev):
 *   cd server && DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/seed-repair-approved-assessments-and-add-initiatives.ts
 *
 * Usage (Postgres):
 *   cd server && DB_TYPE=postgres DATABASE_URL="postgresql://..." npx tsx scripts/seed-repair-approved-assessments-and-add-initiatives.ts
 */
import { createDatabase } from '../src/database/Database.js';
import { DRD_STRUCTURE } from '../../src/services/drdStructure';
import crypto from 'crypto';
import process from 'process';
import logger from '../src/utils/Logger.js';

type AnyRow = Record<string, any>;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

const log = {
  info: (msg: string) => console.log(`${colors.cyan}i${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}!${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg: string) => console.log(`${colors.dim}  → ${msg}${colors.reset}`),
  header: (msg: string) => console.log(`\n${colors.bold}${colors.cyan}${msg}${colors.reset}`),
};

function nowIso(): string {
  return new Date().toISOString();
}

function daysAgoIso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

async function getColumnSet(db: any, table: string): Promise<Set<string>> {
  try {
    const res = await db.query(`PRAGMA table_info(${table})`, []);
    const names = (res?.rows || []).map((r: any) => String(r?.name || '').trim()).filter(Boolean);
    return new Set(names);
  } catch {
    // If PRAGMA is not supported (older adapters), fall back to empty set.
    return new Set();
  }
}

async function ensureColumn(db: any, table: string, col: string, ddl: string) {
  try {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`, []);
    log.step(`Added column ${table}.${col}`);
  } catch {
    // Already exists or not supported — ignore.
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

type AssessmentType = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

function guessAssessmentType(raw: any): AssessmentType {
  const s = String(raw || 'DRD').toUpperCase();
  if (s === 'DRD' || s === 'SIRI' || s === 'ADMA' || s === 'CMMI' || s === 'LEAN') return s;
  return 'DRD';
}

function buildDrdAnswers(seedKey: string) {
  // Deterministic-ish variation based on seedKey hash
  const h = crypto.createHash('sha256').update(seedKey).digest();
  const rnd = (idx: number) => h[idx % h.length] / 255;

  const areas: Record<string, any> = {};
  let i = 0;
  for (const axis of DRD_STRUCTURE) {
    const maxLvl = axis.levelCount || 5;
    for (const area of axis.areas) {
      const achievedBase = 2 + Math.floor(rnd(i++) * 3); // 2..4
      const targetBase = achievedBase + 1 + Math.floor(rnd(i++) * 2); // +1..+2
      const achieved = clamp(achievedBase + ((i % 3) - 1), 1, maxLvl);
      const target = clamp(targetBase, achieved + 1, maxLvl);
      const note =
        i % 5 === 0
          ? 'Mocne fundamenty, ale brakuje spójnego governance i automatyzacji. Następny krok: ustandaryzować dane, wprowadzić KPI i zapewnić ciągły nadzór.'
          : i % 7 === 0
            ? 'Wdrożenie częściowe — istnieją narzędzia, lecz brakuje adopcji i integracji end‑to‑end. Wymagane: owners + proces przeglądu kwartalnego.'
            : '';

      areas[area.id] = {
        achievedLevel: achieved,
        targetLevel: target,
        ...(note
          ? {
              levelNotes: {
                [String(achieved)]: note,
              },
            }
          : {}),
        ...(i % 9 === 0
          ? {
              levelLinks: {
                [String(achieved)]: [
                  'https://intranet.example.com/policies',
                  'https://intranet.example.com/dashboards',
                ],
              },
            }
          : {}),
      };
    }
  }

  return { drd: { areas } };
}

function buildSiriAnswers(seedKey: string) {
  const dims = [
    'operations',
    'supply_chain',
    'product_lifecycle',
    'automation',
    'connectivity',
    'intelligence',
    'workforce_learning',
    'leadership',
  ];
  const h = crypto.createHash('sha256').update(seedKey).digest();
  const rnd = (idx: number) => h[idx % h.length] / 255;

  const dimensions: Record<string, any> = {};
  for (let i = 0; i < dims.length; i++) {
    const current = 2 + Math.floor(rnd(i) * 3); // 2..4
    const target = clamp(current + 1 + (i % 2), 3, 5);
    dimensions[dims[i]] = {
      current,
      target,
      notes:
        i % 2 === 0
          ? 'Zidentyfikowano lukę w standaryzacji i automatyzacji. Priorytet: spójne dane i mierniki skuteczności.'
          : 'Dobre podstawy operacyjne. Następny krok: skalowanie i integracje między domenami.',
      evidence: i % 3 === 0 ? 'Raport KPI, screenshot dashboardu, notatki z warsztatów' : '',
    };
  }

  return { siri: { dimensions, prioritisationMatrix: {} } };
}

function buildAdmaAnswers(seedKey: string) {
  const dims = [
    'digital_strategy',
    'digital_investments',
    'digital_culture',
    'product_features',
    'product_data',
    'product_services',
    'product_integration',
    'factory_automation',
    'factory_connectivity',
    'factory_intelligence',
    'value_chain_visibility',
    'value_chain_agility',
  ];
  const h = crypto.createHash('sha256').update(seedKey).digest();
  const rnd = (idx: number) => h[idx % h.length] / 255;

  const dimensions: Record<string, any> = {};
  for (let i = 0; i < dims.length; i++) {
    const current = 1 + Math.floor(rnd(i) * 4); // 1..4
    const target = clamp(current + 1, 2, 5);
    dimensions[dims[i]] = {
      current,
      target,
      notes:
        i % 3 === 0
          ? 'Obszar wymaga ustrukturyzowania: ownership, standardy danych, rytm przeglądów i automatyzacja raportowania.'
          : 'Istnieje inicjatywa/pilot; potrzebne jest skalowanie oraz wpięcie w governance i mierniki.',
      evidence: i % 4 === 0 ? 'Notatki z warsztatu, dane z ankiety, przykładowe KPI' : '',
    };
  }

  return { adma: { dimensions } };
}

function buildScoreSummary(type: AssessmentType, seedKey: string) {
  const h = crypto.createHash('sha256').update(`${type}:${seedKey}`).digest();
  const rnd = (idx: number) => h[idx % h.length] / 255;
  const actual = type === 'DRD' ? 3.2 + rnd(1) * 2.2 : 2.3 + rnd(2) * 2.0;
  const target = Math.min(actual + 1.4 + rnd(3) * 1.2, type === 'DRD' ? 7 : 5);
  const gap = Math.max(target - actual, 0);
  return {
    overall: {
      actual: Number(actual.toFixed(2)),
      target: Number(target.toFixed(2)),
      gap: Number(gap.toFixed(2)),
    },
    seeded: true,
  };
}

function buildContextSnapshot(type: AssessmentType) {
  const common = {
    audit: {
      phase: 'APPROVAL',
      notes: 'Assessment zatwierdzony — dane kompletne, gotowe do planowania inicjatyw.',
    },
  };
  if (type === 'SIRI') {
    return {
      ...common,
      scope: { plants: 2, businessUnits: ['Production', 'Supply Chain'], timeframe: '2026-Q1' },
    };
  }
  if (type === 'ADMA') {
    return {
      ...common,
      scope: { plants: 2, businessUnits: ['Production', 'Engineering'], timeframe: '2026-Q1' },
    };
  }
  return {
    ...common,
    scope: {
      plants: 3,
      businessUnits: ['Production', 'Sales', 'Supply Chain'],
      timeframe: '2026-Q1',
    },
  };
}

function looksEmptyJson(raw: any): boolean {
  if (raw == null) return true;
  const s = String(raw || '').trim();
  if (!s) return true;
  if (s === '{}' || s === '[]' || s === 'null') return true;
  try {
    const v = JSON.parse(s);
    if (v == null) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v).length === 0;
  } catch {
    // If it's non-JSON text, treat as non-empty
    return false;
  }
  return false;
}

function shouldRepairApprovedAssessment(row: AnyRow, cols: Set<string>): boolean {
  const answersEmpty = cols.has('answers_json') ? looksEmptyJson(row.answers_json) : true;
  const ctxEmpty = cols.has('context_snapshot') ? looksEmptyJson(row.context_snapshot) : true;
  const scoreEmpty = cols.has('score_summary') ? looksEmptyJson(row.score_summary) : true;
  const legacyEmpty = cols.has('framework_data') ? looksEmptyJson(row.framework_data) : true;
  const completion = Number(row.completion_percent ?? 0);
  const completionBad = !Number.isFinite(completion) || completion < 80;

  // "Approved and empty" in practice means: no answers + no meaningful meta.
  return answersEmpty || ctxEmpty || scoreEmpty || (legacyEmpty && completionBad);
}

type InitiativeSeed = {
  id: string;
  name: string;
  title: string;
  summary: string;
  hypothesis: string;
  problem_statement: string;
  market_context: string;
  target_state: string;
  deliverables: string[];
  success_criteria: string[];
  scope_in: string[];
  scope_out: string[];
  kill_criteria: string[];
  key_risks: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'DRAFT' | 'PENDING_REVIEW';
  estimated_budget: number;
  planned_start_date: string;
  planned_end_date: string;
  tags: string[];
  resource_tools: string[];
};

function shortHash(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 8);
}

function buildInitiativeSeeds(idPrefix: string): InitiativeSeed[] {
  const mkDate = (daysFromNow: number) =>
    new Date(Date.now() + daysFromNow * 86400 * 1000).toISOString();

  const out: InitiativeSeed[] = [
    {
      id: `${idPrefix}_01_ai_ops`,
      name: 'AI-Assisted Incident Triage (IT/OT)',
      title: 'AI-Assisted Incident Triage (IT/OT)',
      summary:
        'Uspójnienie procesu obsługi incydentów IT/OT: klasyfikacja, priorytetyzacja i routing zgłoszeń z wykorzystaniem LLM + reguł. Cel: skrócić MTTR o 25–35% i odciążyć L2/L3.',
      hypothesis:
        'Jeśli połączymy standaryzowany formularz zgłoszenia, automatyczne tagowanie i rekomendacje kroków, to 30% incydentów zostanie rozwiązanych bez eskalacji, a 60% trafi od razu do właściwego ownera.',
      problem_statement:
        'Obecnie triage incydentów jest manualny, zależny od pojedynczych osób i wiedzy ukrytej. Skutkuje to opóźnieniami, błędną klasyfikacją oraz eskalacjami „na ślepo”.',
      market_context:
        'Rosnąca złożoność środowisk hybrydowych i integracji OT/IT zwiększa liczbę incydentów. Organizacje o wysokiej dojrzałości stosują automatyzację triage i playbooki.',
      target_state:
        'Jedno źródło prawdy dla incydentów, automatyczne kategoryzowanie + playbooki, mierniki MTTR/MTTD w dashboardach, integracja z narzędziami SOC/SIEM.',
      deliverables: [
        'Nowy formularz zgłoszeń (pola obowiązkowe + walidacja)',
        'Reguły klasyfikacji i mapping do ownerów',
        'Moduł rekomendacji kroków (playbook)',
        'Integracja z narzędziem ticketowym + SIEM',
        'Dashboard KPI (MTTR/MTTD, eskalacje, backlog)',
      ],
      success_criteria: [
        'MTTR -25% w 90 dni od wdrożenia',
        '≥60% zgłoszeń trafia od razu do właściwej kolejki',
        'Spadek eskalacji L2→L3 o 15%',
        'Satysfakcja użytkowników (CSAT) +10pp',
      ],
      scope_in: [
        'Incydenty IT/OT o priorytecie P2–P4',
        'Tagowanie + routing',
        'Playbooki dla top 10 kategorii',
      ],
      scope_out: [
        'Automatyczne wykonywanie zmian w systemach produkcyjnych',
        'Incident response dla P0 bez człowieka',
      ],
      kill_criteria: [
        'Brak poprawy MTTR po 8 tygodniach pilota',
        'Niska akceptacja (adopcja <50% po 30 dniach)',
        'Ryzyko bezpieczeństwa nieakceptowalne (z audytu)',
      ],
      key_risks: [
        'Jakość danych wejściowych (opisy incydentów)',
        'Nadmiar fałszywych rekomendacji',
        'Brak jednoznacznych ownerów domen',
      ],
      priority: 'high',
      status: 'DRAFT',
      estimated_budget: 90000,
      planned_start_date: mkDate(14),
      planned_end_date: mkDate(120),
      tags: ['ai', 'operations', 'security', 'it-ot'],
      resource_tools: ['Jira/ServiceNow', 'SIEM', 'Runbooks', 'LLM gateway'],
    },
    {
      id: `${idPrefix}_02_data_gov`,
      name: 'Data Governance MVP (Owners + DQ rules)',
      title: 'Data Governance MVP (Owners + DQ rules)',
      summary:
        'Wdrożenie minimalnego governance danych: definicje krytycznych danych, ownership (RACI), zestaw reguł jakości i raportowanie w cyklu tygodniowym.',
      hypothesis:
        'Jeśli zdefiniujemy 20 krytycznych atrybutów i wdrożymy automatyczne reguły DQ, to liczba błędów raportowych spadnie o 50% w 3 miesiące.',
      problem_statement:
        'Brak formalnego governance powoduje niespójność danych między systemami i ręczne „czyszczenie” w raportach. To obniża zaufanie i spowalnia decyzje.',
      market_context:
        'Firmy przechodzące transformację cyfrową budują DQ/MDM jako fundament. Regulacje (NIS2, AI Act) wymagają większej przejrzystości danych.',
      target_state:
        'Zdefiniowane data products, formalni właściciele, reguły DQ uruchomione w pipeline, dashboardy DQ i proces obsługi wyjątków.',
      deliverables: [
        'Lista 20 krytycznych danych + definicje',
        'RACI ownership dla domen',
        'Zestaw reguł DQ + alerting',
        'Dashboard DQ + raport tygodniowy',
        'Proces obsługi wyjątków / ticketing',
      ],
      success_criteria: [
        'Spadek błędów w raportach o 50%',
        '≥80% domen ma przypisanego ownera',
        'DQ score ≥95% dla krytycznych danych',
      ],
      scope_in: ['2–3 domeny danych (np. produkcja, sprzedaż, logistyka)', 'DQ rules + dashboard'],
      scope_out: ['Pełne MDM enterprise-wide', 'Data catalog dla całej organizacji (po MVP)'],
      kill_criteria: ['Brak ownerów po 30 dniach', 'Brak danych źródłowych do reguł DQ'],
      key_risks: ['Brak czasu SME', 'Rozbieżne definicje KPI', 'Zbyt szeroki zakres na start'],
      priority: 'critical',
      status: 'PENDING_REVIEW',
      estimated_budget: 120000,
      planned_start_date: mkDate(7),
      planned_end_date: mkDate(90),
      tags: ['data', 'governance', 'quality'],
      resource_tools: ['SQL', 'Airflow/DBT', 'Power BI', 'Data contracts'],
    },
    {
      id: `${idPrefix}_03_ot_security`,
      name: 'OT/IT Segmentation Quick Win',
      title: 'OT/IT Segmentation Quick Win',
      summary:
        'Szybkie wzmocnienie bezpieczeństwa OT/IT: segmentacja sieci, przegląd reguł firewall, podstawowe IDS dla OT i cykliczny skan podatności.',
      hypothesis:
        'Jeśli wprowadzimy segmentację i minimalne polityki dostępu, ryzyko krytycznych incydentów spadnie, a audyt NIS2 przejdzie bez major findings.',
      problem_statement:
        'Obecna łączność OT/IT jest zbyt płaska. Brakuje jasnych stref i kontroli dostępu, co zwiększa ryzyko ransomware i przestojów.',
      market_context:
        'Ataki na łańcuch dostaw i środowiska OT rosną. Segmentacja i monitoring to standard w dojrzałych organizacjach przemysłowych.',
      target_state:
        'Strefy OT/IT z politykami, monitoring anomalii, regularny vulnerability management, szybkie procedury IR.',
      deliverables: [
        'Docelowa mapa segmentacji',
        'Zaktualizowane reguły firewall',
        'IDS/monitoring dla OT',
        'Skan podatności + plan remediacji',
        'Runbook incydentowy OT',
      ],
      success_criteria: [
        'Zmniejszenie liczby nieautoryzowanych połączeń między strefami do ~0',
        'Raport z audytu bez krytycznych niezgodności',
        'Regularny skan podatności (co 2 tygodnie) uruchomiony',
      ],
      scope_in: ['Zakład A + najważniejsze segmenty OT', 'Firewall + IDS', 'VM process'],
      scope_out: ['Pełny SOC 24/7 dla OT (po wdrożeniu MVP)'],
      kill_criteria: [
        'Brak zgody biznesu na przerwy serwisowe',
        'Ryzyko przestojów nieakceptowalne',
      ],
      key_risks: [
        'Zależności z integracjami legacy',
        'Brak dokumentacji sieci',
        'Dostawcy zewnętrzni',
      ],
      priority: 'high',
      status: 'DRAFT',
      estimated_budget: 180000,
      planned_start_date: mkDate(21),
      planned_end_date: mkDate(150),
      tags: ['security', 'ot', 'network'],
      resource_tools: ['Firewall', 'IDS', 'Asset inventory', 'Vulnerability scanner'],
    },
    {
      id: `${idPrefix}_04_mops`,
      name: 'MLOps Foundation (Model registry + monitoring)',
      title: 'MLOps Foundation (Model registry + monitoring)',
      summary:
        'Podstawa pod skalowanie AI: rejestr modeli, pipeline wdrożeniowy, monitoring driftu i jakości, standardy walidacji oraz audytowalność.',
      hypothesis:
        'Jeśli ustandaryzujemy lifecycle ML, czas wdrożenia nowego modelu spadnie o 40%, a liczba awarii produkcyjnych o 30%.',
      problem_statement:
        'Modele ML są obecnie „ad-hoc”: brak wersjonowania i monitoringu, co blokuje skalowanie use-case’ów i zwiększa ryzyko biznesowe.',
      market_context:
        'Regulacje i best practices wymagają audytowalności modeli. Bez MLOps ROI z AI spada przez koszty utrzymania i awarie.',
      target_state:
        'Model registry + automatyczny deploy + monitoring, jednoznaczne standardy i metryki, gotowość na compliance.',
      deliverables: [
        'Model registry (MLflow/alternatywa)',
        'CI/CD dla modeli (deploy + rollback)',
        'Monitoring driftu + alerty',
        'Standardy walidacji i checklisty',
        'Szablony repozytoriów i dokumentacji',
      ],
      success_criteria: [
        'Czas wdrożenia modelu -40%',
        'Monitoring 100% modeli w produkcji',
        'Zdefiniowane SLO dla modeli',
      ],
      scope_in: ['2 pierwsze modele produkcyjne', 'Monitoring + registry', 'CI/CD'],
      scope_out: ['Pełna platforma feature store (faza 2)'],
      kill_criteria: ['Brak model owners', 'Brak infrastruktury/zgody na narzędzia'],
      key_risks: ['Zależności od zespołów IT', 'Brak kompetencji MLOps', 'Koszty chmury'],
      priority: 'medium',
      status: 'PENDING_REVIEW',
      estimated_budget: 110000,
      planned_start_date: mkDate(30),
      planned_end_date: mkDate(180),
      tags: ['ai', 'mlops', 'platform'],
      resource_tools: ['MLflow', 'Docker', 'CI/CD', 'Observability'],
    },
  ];

  // Add more to reach 8–10
  const more: InitiativeSeed[] = [
    {
      id: `${idPrefix}_05_cx`,
      name: 'Customer Self‑Service Portal (B2B)',
      title: 'Customer Self‑Service Portal (B2B)',
      summary:
        'Portal dla klientów B2B: status zamówień, reklamacje, dokumenty, SLA. Cel: odciążyć obsługę klienta i poprawić NPS.',
      hypothesis:
        'Jeśli udostępnimy self‑service dla top 20 klientów, wolumen zapytań do supportu spadnie o 20–30%, a NPS wzrośnie o 10pp.',
      problem_statement:
        'Informacje o zamówieniach i reklamacjach są rozproszone. Klienci korzystają z maili/telefonu, co generuje koszty i opóźnienia.',
      market_context:
        'Standardem staje się B2B self‑service i transparentność łańcucha dostaw. Klienci oczekują 24/7 dostępu do danych.',
      target_state:
        'Jedna brama dla klienta: zamówienia, dokumenty, SLA, komunikacja, integracje API.',
      deliverables: [
        'MVP portalu (zamówienia + dokumenty)',
        'SSO + RBAC',
        'Moduł reklamacji',
        'Integracja z ERP',
        'Analytics adopcji',
      ],
      success_criteria: ['Spadek ticketów o 20%', 'Adopcja >60% w 90 dni', 'NPS +10pp'],
      scope_in: ['Top 20 klientów', '2 procesy (orders + docs)', 'Integracja ERP (read-only)'],
      scope_out: ['Marketplace wielokrajowy (faza 2)'],
      kill_criteria: ['Brak sponsorów biznesowych', 'Brak integracji ERP w czasie'],
      key_risks: ['Integracja legacy', 'Zarządzanie dostępami klientów', 'Bezpieczeństwo danych'],
      priority: 'high',
      status: 'DRAFT',
      estimated_budget: 160000,
      planned_start_date: mkDate(10),
      planned_end_date: mkDate(140),
      tags: ['cx', 'b2b', 'portal'],
      resource_tools: ['React', 'API gateway', 'SSO', 'ERP integration'],
    },
    {
      id: `${idPrefix}_06_oee`,
      name: 'Unified OEE Dashboard (Real‑time)',
      title: 'Unified OEE Dashboard (Real‑time)',
      summary:
        'Ujednolicenie wskaźników OEE i wdrożenie dashboardów real‑time na shop‑floor i dla managementu.',
      hypothesis:
        'Jeśli znormalizujemy definicje OEE i zintegrujemy źródła danych, czas reakcji na straty spadnie o 15%, a OEE wzrośnie o 3–5pp w 6 miesięcy.',
      problem_statement:
        'Dziś OEE jest liczone niespójnie między liniami/zakładami. Brakuje jednego widoku i szybkiego alertingu.',
      market_context:
        'Lean + Industry 4.0 opierają się na real‑time metrics i ciągłym doskonaleniu. OEE jest kluczowym KPI w produkcji.',
      target_state:
        'Jedna definicja OEE, automatyczne zbieranie danych, dashboardy i alerty, raport tygodniowy oraz backlog usprawnień.',
      deliverables: [
        'Definicje KPI + data dictionary',
        'Integracja źródeł (MES/SCADA)',
        'Dashboardy real‑time',
        'Alerty',
        'Szablon raportu',
      ],
      success_criteria: [
        'Wzrost OEE +3pp',
        'Alerty działają w <5 min',
        '100% linii wpięte w 12 tygodni',
      ],
      scope_in: ['Zakład A', '3 linie', 'real‑time dashboard + alerty'],
      scope_out: ['Predykcyjna optymalizacja (faza 2)'],
      kill_criteria: ['Brak danych z linii', 'Nieuzgodnione definicje KPI'],
      key_risks: ['Jakość danych', 'Dostęp do OT', 'Zależność od dostawców MES'],
      priority: 'medium',
      status: 'PENDING_REVIEW',
      estimated_budget: 75000,
      planned_start_date: mkDate(5),
      planned_end_date: mkDate(90),
      tags: ['manufacturing', 'kpi', 'oee'],
      resource_tools: ['Power BI', 'MES', 'IoT gateway'],
    },
    {
      id: `${idPrefix}_07_compliance_ai`,
      name: 'AI Policy Pack (EU AI Act readiness)',
      title: 'AI Policy Pack (EU AI Act readiness)',
      summary:
        'Pakiet polityk i procesów dla AI: klasyfikacja systemów, rejestr modeli, ocena ryzyka, wymagania dot. danych i audytu.',
      hypothesis:
        'Jeśli wdrożymy polityki i minimum narzędziowe (rejestr + checklisty), ryzyko compliance spadnie, a time‑to‑approve dla use-case’ów skróci się o 20%.',
      problem_statement:
        'AI use-case’y rosną, ale brak jednolitych zasad i audytowalności. To blokuje decyzje i zwiększa ryzyko regulacyjne.',
      market_context:
        'EU AI Act i oczekiwania klientów wymagają transparentności i kontroli. Firmy z governance szybciej skalują AI.',
      target_state:
        'Formalne zasady AI, role, rytm przeglądów, rejestr modeli i proces akceptacji ryzyka.',
      deliverables: [
        'Polityki AI (min. 6)',
        'Checklisty oceny',
        'Model registry/ewidencja',
        'Proces przeglądu kwartalnego',
        'Szkolenie dla ownerów',
      ],
      success_criteria: [
        '100% projektów AI w rejestrze',
        'Proces akceptacji działa',
        'Audyt wewnętrzny bez krytycznych luk',
      ],
      scope_in: ['Use-case’y AI w organizacji', 'Rejestr + proces', 'Szkolenia'],
      scope_out: ['Pełna automatyzacja oceny ryzyka (faza 2)'],
      kill_criteria: ['Brak sponsora', 'Brak akceptacji prawnej'],
      key_risks: ['Brak zasobów prawnych', 'Rozproszone projekty AI', 'Zbyt teoretyczne podejście'],
      priority: 'high',
      status: 'DRAFT',
      estimated_budget: 60000,
      planned_start_date: mkDate(3),
      planned_end_date: mkDate(75),
      tags: ['compliance', 'ai', 'governance'],
      resource_tools: ['Policy templates', 'Workshops', 'Registry'],
    },
    {
      id: `${idPrefix}_08_supply_chain`,
      name: 'Supplier OTIF + Disruption Alerts',
      title: 'Supplier OTIF + Disruption Alerts',
      summary:
        'Minimum „control tower” dla dostawców: OTIF, lead time, alerty o odchyleniach, dashboard dla zakupów i planowania.',
      hypothesis:
        'Jeśli będziemy mieć OTIF i alerty w czasie zbliżonym do rzeczywistego, koszty ekspresów i braki materiałowe spadną o 10–15% w 6 miesięcy.',
      problem_statement:
        'Dziś zakłócenia są wykrywane z opóźnieniem. Dane o dostawach są w mailach/arkuszach, co utrudnia reakcję.',
      market_context:
        'Niepewność łańcuchów dostaw wymaga wczesnych sygnałów i transparentności. Control tower zaczyna się od OTIF + alertów.',
      target_state:
        'Dashboard OTIF, alerty, proces eskalacji, cykliczne przeglądy wydajności dostawców.',
      deliverables: [
        'Model danych OTIF',
        'Integracja ERP/EDI (MVP)',
        'Dashboard + alerty',
        'Proces eskalacji',
        'Raport miesięczny',
      ],
      success_criteria: [
        'OTIF mierzony dla top 20 dostawców',
        'Alerty w <1h',
        'Spadek ekspresów o 10%',
      ],
      scope_in: ['Top 20 dostawców', 'Alerty + dashboard', 'Proces eskalacji'],
      scope_out: ['Pełna optymalizacja zapasów (faza 2)'],
      kill_criteria: ['Brak danych EDI/ERP', 'Dostawcy nie udostępniają danych'],
      key_risks: ['Jakość danych', 'Zależność od dostawców', 'Brak ownera procesu'],
      priority: 'medium',
      status: 'PENDING_REVIEW',
      estimated_budget: 85000,
      planned_start_date: mkDate(20),
      planned_end_date: mkDate(140),
      tags: ['supply-chain', 'kpi', 'alerts'],
      resource_tools: ['ERP', 'Power BI', 'Webhook/ETL'],
    },
    {
      id: `${idPrefix}_09_people`,
      name: 'Digital Skills Academy (Role‑based)',
      title: 'Digital Skills Academy (Role‑based)',
      summary:
        'Program kompetencji cyfrowych: ścieżki dla operatorów, liderów i specjalistów. Cel: zwiększyć adopcję narzędzi i skuteczność zmian.',
      hypothesis:
        'Jeśli dostarczymy role‑based szkolenia i mierniki kompetencji, adopcja narzędzi (MES/BI) wzrośnie o 25% w 4 miesiące.',
      problem_statement:
        'Brak spójnego programu upskillingu powoduje nierówną adopcję narzędzi i opór przed zmianą.',
      market_context:
        'Transformacja cyfrowa wymaga inwestycji w ludzi. Firmy z akademią szybciej skalują inicjatywy i utrzymują ROI.',
      target_state:
        'Stały program szkoleń + LMS, mierniki kompetencji, sieć championów i feedback loop.',
      deliverables: [
        'Curriculum',
        'LMS setup',
        'Materiały + warsztaty',
        'Certyfikacja',
        'Dashboard postępu',
      ],
      success_criteria: [
        '≥70% ukończeń na ścieżkach',
        'Wzrost adopcji narzędzi',
        'Sieć 15 championów',
      ],
      scope_in: ['3 role', 'Pilot 250 osób', 'LMS + warsztaty'],
      scope_out: ['Program enterprise dla 100% firmy (faza 2)'],
      kill_criteria: ['Brak czasu uczestników', 'Brak sponsora HR/COO'],
      key_risks: ['Niska motywacja', 'Zbyt teoretyczne materiały', 'Brak mierników'],
      priority: 'low',
      status: 'DRAFT',
      estimated_budget: 45000,
      planned_start_date: mkDate(25),
      planned_end_date: mkDate(210),
      tags: ['people', 'training', 'change'],
      resource_tools: ['LMS', 'Workshops', 'Champions'],
    },
  ];

  return [...out, ...more].slice(0, 10);
}

async function main() {
  log.header('═══════════════════════════════════════════════════════════');
  log.header('  Repair Approved Assessments + Seed Initiatives');
  log.header('═══════════════════════════════════════════════════════════');

  const db = await createDatabase();

  // Pick org(s)
  const targetOrgFromEnv =
    (process.env.TARGET_ORG_ID ||
      process.env.SEED_ORG_ID ||
      process.env.ORG_ID ||
      process.env.ORGANIZATION_ID ||
      process.env.ORG) ??
    '';

  const explicitOrgId = String(targetOrgFromEnv || '').trim() || null;

  const orgIds = await (async (): Promise<string[]> => {
    if (explicitOrgId) return [explicitOrgId];
    try {
      const res = await db.query(
        `SELECT DISTINCT organization_id as orgId
         FROM assessments
         WHERE UPPER(COALESCE(status,'DRAFT')) IN ('APPROVED','COMPLETED')`,
        []
      );
      const ids = (res?.rows || []).map((r: any) => String(r?.orgId || '').trim()).filter(Boolean);
      if (ids.length) return ids;
    } catch {
      // ignore
    }
    try {
      const orgCounts = await db.query(
        `SELECT organization_id as orgId, COUNT(*) as count
         FROM assessments
         GROUP BY organization_id
         ORDER BY count DESC`,
        []
      );
      const first = orgCounts?.rows?.[0]?.orgId ? [String(orgCounts.rows[0].orgId)] : [];
      if (first.length) return first;
    } catch {
      // ignore
    }
    try {
      const anyOrg = await db.query(
        `SELECT id FROM organizations ORDER BY created_at DESC LIMIT 1`,
        []
      );
      const id = anyOrg?.rows?.[0]?.id ? [String(anyOrg.rows[0].id)] : [];
      if (id.length) return id;
    } catch {
      // ignore
    }
    return ['org-dbr77-system'];
  })();

  log.info(`Organizations to process: ${orgIds.join(', ')}`);

  // Ensure assessment columns exist (especially for older dev DBs)
  log.header('Ensuring schema columns (best-effort)');
  await ensureColumn(db, 'assessments', 'assessment_type', `TEXT`);
  await ensureColumn(db, 'assessments', 'completion_percent', `INTEGER DEFAULT 0`);
  await ensureColumn(db, 'assessments', 'confidence_avg', `REAL DEFAULT 0`);
  await ensureColumn(db, 'assessments', 'answers_json', `TEXT DEFAULT '{}'`);
  await ensureColumn(db, 'assessments', 'context_snapshot', `TEXT DEFAULT '{}'`);
  await ensureColumn(db, 'assessments', 'score_summary', `TEXT DEFAULT '{}'`);
  await ensureColumn(db, 'assessments', 'navigation_json', `TEXT DEFAULT '{}'`);
  await ensureColumn(db, 'assessments', 'report_approved_at', `TEXT`);
  await ensureColumn(db, 'assessments', 'approved_at', `TEXT`);
  await ensureColumn(db, 'assessments', 'updated_by', `TEXT`);
  await ensureColumn(db, 'assessments', 'framework_type', `TEXT`);
  await ensureColumn(db, 'assessments', 'framework_data', `TEXT`);
  await ensureColumn(db, 'assessments', 'description', `TEXT DEFAULT ''`);

  // Ensure initiatives core + "fully filled" columns exist (idempotent)
  await ensureColumn(db, 'initiatives', 'summary', `TEXT`);
  await ensureColumn(db, 'initiatives', 'hypothesis', `TEXT`);
  await ensureColumn(db, 'initiatives', 'planned_start_date', `TEXT`);
  await ensureColumn(db, 'initiatives', 'planned_end_date', `TEXT`);
  await ensureColumn(db, 'initiatives', 'owner_execution_id', `TEXT`);
  await ensureColumn(db, 'initiatives', 'sponsor_id', `TEXT`);
  await ensureColumn(db, 'initiatives', 'market_context', `TEXT`);
  await ensureColumn(db, 'initiatives', 'problem_statement', `TEXT`);
  await ensureColumn(db, 'initiatives', 'deliverables', `TEXT`);
  await ensureColumn(db, 'initiatives', 'success_criteria', `TEXT`);
  await ensureColumn(db, 'initiatives', 'scope_in', `TEXT`);
  await ensureColumn(db, 'initiatives', 'scope_out', `TEXT`);
  await ensureColumn(db, 'initiatives', 'kill_criteria', `TEXT`);
  await ensureColumn(db, 'initiatives', 'key_risks', `TEXT`);
  await ensureColumn(db, 'initiatives', 'resource_tools', `TEXT`);
  await ensureColumn(db, 'initiatives', 'tags', `TEXT`);
  await ensureColumn(db, 'initiatives', 'target_state', `TEXT`);
  await ensureColumn(db, 'initiatives', 'charter_completeness', `INTEGER DEFAULT 0`);
  await ensureColumn(db, 'initiatives', 'progress', `INTEGER DEFAULT 0`);
  await ensureColumn(db, 'initiatives', 'source_type', `TEXT DEFAULT 'manual'`);
  await ensureColumn(db, 'initiatives', 'source_id', `TEXT`);
  await ensureColumn(db, 'initiatives', 'source_assessment_id', `TEXT`);

  const assessmentCols = await getColumnSet(db, 'assessments');
  const initiativeCols = await getColumnSet(db, 'initiatives');

  let totalRepaired = 0;
  let totalInitiativesUpserted = 0;

  for (const orgId of orgIds) {
    // Pick user for org
    let userId = 'system';
    try {
      const u = await db.query(
        `SELECT id FROM users WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`,
        [orgId]
      );
      userId = u?.rows?.[0]?.id || userId;
    } catch {
      /* ignore */
    }
    if (userId === 'system') {
      try {
        const anyU = await db.query(`SELECT id FROM users ORDER BY created_at DESC LIMIT 1`, []);
        userId = anyU?.rows?.[0]?.id || userId;
      } catch {
        /* ignore */
      }
    }

    log.header(`Organization: ${orgId} (user: ${userId})`);

    // Fetch approved / completed assessments
    log.header('Repairing APPROVED/COMPLETED assessments (only when empty)');
    const approved = await (async () => {
      try {
        const res = await db.query(
          `SELECT id, name, status,
                  assessment_type, framework_type,
                  completion_percent, confidence_avg,
                  answers_json, context_snapshot, score_summary, navigation_json,
                  framework_data,
                  report_approved_at, approved_at,
                  updated_at
           FROM assessments
           WHERE organization_id = ?
             AND UPPER(COALESCE(status,'DRAFT')) IN ('APPROVED','COMPLETED')
           ORDER BY updated_at DESC`,
          [orgId]
        );
        return (res?.rows || []) as AnyRow[];
      } catch (e: any) {
        log.warn(`Could not query approved assessments: ${e?.message || e}`);
        return [] as AnyRow[];
      }
    })();

    let repairedCount = 0;
    for (const row of approved) {
      const type = guessAssessmentType(row.assessment_type || row.framework_type);
      const needsRepair = shouldRepairApprovedAssessment(row, assessmentCols);
      if (!needsRepair) {
        log.step(`OK (already filled): ${row.name || row.id}`);
        continue;
      }

      const seedKey = `${row.id}:${row.name || ''}:${type}`;
      const answers =
        type === 'SIRI'
          ? buildSiriAnswers(seedKey)
          : type === 'ADMA'
            ? buildAdmaAnswers(seedKey)
            : buildDrdAnswers(seedKey);
      const scoreSummary = buildScoreSummary(type, seedKey);
      const ctx = buildContextSnapshot(type);

      const overallScore = Number(scoreSummary?.overall?.actual || 0);
      const frameworkData = {
        progress: 100,
        overallScore,
        type,
        answers,
        contextSnapshot: ctx,
        scoreSummary,
        seeded: true,
        repairedAt: nowIso(),
      };

      const updatedAt = nowIso();
      const approvedAt = row.approved_at || updatedAt;
      const reportApprovedAt = row.report_approved_at || updatedAt;

      const sets: string[] = [];
      const params: any[] = [];
      const setIf = (col: string, val: any) => {
        if (!assessmentCols.has(col)) return;
        sets.push(`${col} = ?`);
        params.push(val);
      };

      setIf('assessment_type', type);
      setIf('framework_type', type);
      setIf('completion_percent', 100);
      setIf('confidence_avg', Number(row.confidence_avg || 0) >= 1 ? row.confidence_avg : 3.5);
      setIf('answers_json', JSON.stringify(answers));
      setIf('context_snapshot', JSON.stringify(ctx));
      setIf('score_summary', JSON.stringify(scoreSummary));
      setIf(
        'navigation_json',
        row.navigation_json || JSON.stringify({ axisId: 1, areaId: '1A', level: 1 })
      );
      setIf('framework_data', JSON.stringify(frameworkData));
      setIf('approved_at', approvedAt);
      setIf('report_approved_at', reportApprovedAt);
      setIf('updated_by', userId);
      setIf('updated_at', updatedAt);

      if (sets.length === 0) continue;

      try {
        await db.query(
          `UPDATE assessments SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
          [...params, row.id, orgId]
        );
        repairedCount += 1;
        log.step(
          `Repaired ✅ ${type} [${String(row.status || '').toUpperCase()}]: ${row.name || row.id}`
        );
      } catch (e: any) {
        log.warn(`Failed to repair assessment ${row.id}: ${e?.message || e}`);
      }
    }

    if (approved.length === 0) {
      log.warn('No APPROVED/COMPLETED assessments found to repair (skipping assessment repair).');
    } else {
      log.success(`Assessments checked: ${approved.length}, repaired: ${repairedCount}`);
    }
    totalRepaired += repairedCount;

    // Seed 8–10 initiatives linked to these assessments if possible.
    log.header('Seeding 8–10 fully filled initiatives (assessment-sourced)');
    const idPrefix = `seed_demo_initiative_${shortHash(orgId)}`;

    // Backward-compat cleanup: remove the earlier non-org-scoped demo IDs if present.
    // This prevents the list from silently doubling after upgrading this script.
    const legacyIds = [
      'seed_demo_initiative_01_ai_ops',
      'seed_demo_initiative_02_data_gov',
      'seed_demo_initiative_03_ot_security',
      'seed_demo_initiative_04_mops',
      'seed_demo_initiative_05_cx',
      'seed_demo_initiative_06_oee',
      'seed_demo_initiative_07_compliance_ai',
      'seed_demo_initiative_08_supply_chain',
      'seed_demo_initiative_09_people',
    ];
    try {
      const ph = legacyIds.map(() => '?').join(', ');
      await db.query(`DELETE FROM initiatives WHERE organization_id = ? AND id IN (${ph})`, [
        orgId,
        ...legacyIds,
      ]);
    } catch {
      // ignore
    }

    const initiatives = buildInitiativeSeeds(idPrefix);
    const approvedIds = approved.map((a) => String(a.id));
    const sourceAssessmentId = approvedIds.length ? approvedIds : [null];

    const ownerExecutionId = userId;
    const sponsorId = userId;

    const cols = initiativeCols;
    const has = (c: string) => cols.has(c);
    const push = (obj: Record<string, any>, col: string, val: any) => {
      if (!has(col)) return;
      obj[col] = val;
    };

    let upserted = 0;
    for (let i = 0; i < initiatives.length; i++) {
      const init = initiatives[i];
      const id = init.id;
      const assessmentId = sourceAssessmentId[i % sourceAssessmentId.length];
      const createdAt = daysAgoIso(7 + (i % 7));
      const updatedAt = daysAgoIso(i % 5);

      const record: Record<string, any> = {};
      push(record, 'id', id);
      push(record, 'organization_id', orgId);
      push(record, 'project_id', null);
      push(record, 'name', init.name);
      push(record, 'title', init.title);
      push(record, 'description', init.summary);
      push(record, 'summary', init.summary);
      push(record, 'hypothesis', init.hypothesis);
      push(record, 'status', init.status);
      push(record, 'priority', init.priority);
      push(
        record,
        'impact',
        init.priority === 'critical' ? 'high' : init.priority === 'high' ? 'high' : 'medium'
      );
      push(record, 'effort', init.priority === 'low' ? 'low' : 'medium');
      push(record, 'category', 'Strategy');
      push(record, 'source_type', 'assessment');
      push(record, 'source_id', assessmentId);
      push(record, 'source_assessment_id', assessmentId);
      push(record, 'estimated_budget', init.estimated_budget);
      push(record, 'estimated_timeline', null);
      push(record, 'planned_start_date', init.planned_start_date);
      push(record, 'planned_end_date', init.planned_end_date);
      push(record, 'owner_execution_id', ownerExecutionId);
      push(record, 'sponsor_id', sponsorId);
      push(record, 'market_context', init.market_context);
      push(record, 'problem_statement', init.problem_statement);
      push(record, 'target_state', init.target_state);
      push(record, 'deliverables', JSON.stringify(init.deliverables));
      push(record, 'success_criteria', JSON.stringify(init.success_criteria));
      push(record, 'scope_in', JSON.stringify(init.scope_in));
      push(record, 'scope_out', JSON.stringify(init.scope_out));
      push(record, 'kill_criteria', JSON.stringify(init.kill_criteria));
      push(record, 'key_risks', JSON.stringify(init.key_risks));
      push(record, 'resource_tools', JSON.stringify(init.resource_tools));
      push(record, 'tags', JSON.stringify(init.tags));
      push(
        record,
        'risk_level',
        init.priority === 'critical' ? 'high' : init.priority === 'high' ? 'medium' : 'low'
      );
      push(record, 'ai_generated', 0);
      push(record, 'progress', init.status === 'PENDING_REVIEW' ? 5 : 0);
      push(record, 'charter_completeness', 100);
      push(record, 'created_by', userId);
      push(record, 'updated_by', userId);
      push(record, 'created_at', createdAt);
      push(record, 'updated_at', updatedAt);

      const insertCols = Object.keys(record);
      const insertVals = insertCols.map((c) => record[c]);
      const placeholders = insertCols.map(() => '?').join(', ');

      const updateable = [
        'name',
        'title',
        'description',
        'summary',
        'hypothesis',
        'status',
        'priority',
        'impact',
        'effort',
        'category',
        'source_type',
        'source_id',
        'source_assessment_id',
        'estimated_budget',
        'planned_start_date',
        'planned_end_date',
        'owner_execution_id',
        'sponsor_id',
        'market_context',
        'problem_statement',
        'target_state',
        'deliverables',
        'success_criteria',
        'scope_in',
        'scope_out',
        'kill_criteria',
        'key_risks',
        'resource_tools',
        'tags',
        'risk_level',
        'progress',
        'charter_completeness',
        'updated_by',
        'updated_at',
      ].filter((c) => has(c));
      const updateSql = updateable.map((c) => `${c} = excluded.${c}`).join(', ');

      const sql = `INSERT INTO initiatives (${insertCols.join(', ')})
                   VALUES (${placeholders})
                   ON CONFLICT(id) DO UPDATE SET ${updateSql}`;

      try {
        await db.query(sql, insertVals);
        upserted += 1;
        log.step(`Upserted initiative: ${init.title} [${init.status}]`);
      } catch (e: any) {
        log.warn(`Failed to upsert initiative ${id}: ${e?.message || e}`);
      }
    }

    log.success(`Initiatives upserted: ${upserted}`);
    totalInitiativesUpserted += upserted;

    try {
      logger.info('[seed-repair-approved-assessments-and-add-initiatives] Org done', {
        orgId,
        repairedApprovedAssessments: repairedCount,
        initiativesUpserted: upserted,
      });
    } catch {
      // ignore
    }
  }

  log.header('All done.');
  log.success(`Total repaired assessments: ${totalRepaired}`);
  log.success(`Total initiatives upserted: ${totalInitiativesUpserted}`);
}

main().catch((err) => {
  log.error(String(err?.message || err));
  process.exit(1);
});
