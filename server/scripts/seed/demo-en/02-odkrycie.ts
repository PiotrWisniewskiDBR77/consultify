#!/usr/bin/env tsx
/**
 * D2 — SEED ODKRYCIA — Interview + Discovery Tools + Assessment (+ Method Core)
 * dla organizacji „Northwind Manufacturing Ltd." (`northwind`)
 * (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D2, §3, §3.1 wiersze 3-5).
 *
 * Buduje:
 *  - 2 wywiady (`interview_sessions` + `interview_questions` + `interview_answers`)
 *    z Sarah Mitchell (Plant Manager, Leeds) i Robert Chen (Head of Quality),
 *    11 pytań/odpowiedzi każdy, + 4 wnioski (`interview_insights`).
 *  - 3 sesje narzędzi (`tool_sessions`) z GLOBALNEGO katalogu `tools`
 *    (tabela `tools` NIE MA `organization_id` — 31 wierszy wspólnych dla
 *    wszystkich organizacji, NIE RUSZAMY jej w tym skrypcie).
 *  - 1 ocena dojrzałości operacyjnej (`assessments` + `assessment_reports`).
 *  - 1 sesja Method Core (DRD — Digital Readiness Diagnosis), zamrożona do
 *    Outputu. **STOP zmierzony w KROK 0:** `method_sessions`/`method_outputs`
 *    NIE MAJĄ żadnego surowego SQL-owego pisarza w repo (jedyne INSERTy są w
 *    `MethodSessionService.ts`/`MethodOutputService.ts`/`EventDerivedOutputBridge`) —
 *    ten skrypt więc NIE wstawia tych wierszy SQL-em, tylko odtwarza dokładnie
 *    tę samą ścieżkę HTTP co `server/src/method-core/__tests__/siriFullFlow.integration.test.ts`
 *    (ten sam Express router zamontowany w procesie, ten sam podpisany JWT,
 *    bez żadnego mocka) — czyli PRZECHODZI przez prawdziwego pisarza kanonicznego,
 *    nie omija go. DRD rejestruje się automatycznie na `readiness='pilot'`
 *    (`MethodPackRegistry.ensureDrdPackRegistered`), więc `canStartSession()`
 *    przechodzi BEZ demo-bypassu — sesja jest tak samo „prawdziwa" jak każda
 *    sesja DRD założona ręcznie przez użytkownika.
 *
 * UŻYCIE
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/02-odkrycie.ts --oczekiwany-host 54418 --dry-run
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/02-odkrycie.ts --oczekiwany-host 54418 --apply
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/02-odkrycie.ts --oczekiwany-host 54418 --verify
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/02-odkrycie.ts --oczekiwany-host 54418 --reset
 *
 * ZALEŻNOŚĆ: wymaga `01-rdzen.ts --apply` już wykonanego na tej samej bazie
 * (organizacja `northwind` + 9 osób + 2 projekty muszą istnieć — skrypt
 * odmawia, jeśli ich nie znajdzie).
 *
 * IDEMPOTENCJA: encje SQL-owe (Interview/Tools/Assessment) mają deterministyczne
 * id (`det()`) i idą przez `ON CONFLICT (id) DO NOTHING` — drugi `--apply` daje
 * `utworzono=0`. Sesja Method Core nie ma deterministycznego id (API generuje
 * własne) — idempotencja jest przez ISTNIENIE: jeśli już istnieje zamrożona
 * sesja DRD dla `northwind`, drugi `--apply` jej NIE dubluje (sprawdza przed
 * tworzeniem).
 *
 * `tools` (katalog globalny, bez `organization_id`) — WYŁĄCZNIE odczyt
 * (`SELECT name FROM tools WHERE name = ANY(...)`), zero zapisu.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import type { PoolClient } from 'pg';
import request from 'supertest';

import { ORG_ID, Licznik, czytajWspolneArgumenty, det, otworzPool, sprawdzCel, wymaganyUrl } from './00-wspolne';

// ============================================================================
// Ludzie z 01-rdzen.ts — reużywamy te same deterministyczne id (te same
// `det('user', email)` / `email` co tam), NIE duplikujemy definicji osób.
// ============================================================================
const DOMENA = 'northwind.example';
const emailOsoby = (slug: string) => `${slug}@${DOMENA}`;
const userId = (slug: string) => det('user', emailOsoby(slug));

const JAMES = userId('james.whitfield'); // Operations Director, OWNER
const SARAH = userId('sarah.mitchell'); // Plant Manager
const ROBERT = userId('robert.chen'); // Head of Quality
const DANIEL = userId('daniel.osei'); // Automation Engineer

const PROJEKT_OEP = det('project', 'operational-excellence-programme');
const PROJEKT_DAR = det('project', 'digital-automation-roadmap');

// ============================================================================
// 1. INTERVIEW — 2 sesje, 11 pytań/odpowiedzi każda, 4 wnioski
// ============================================================================
export type PytanieDane = {
  kategoria: string;
  pytanie: string;
  odpowiedz: string;
  wymagane: boolean;
};

export type WywiadDane = {
  slug: string;
  nazwa: string;
  intervieweeSlug: string;
  projectId: string;
  startedDaysAgo: number;
  pytania: PytanieDane[];
};

export const WYWIADY: WywiadDane[] = [
  {
    slug: 'plant-operations-leeds',
    nazwa: 'Plant Operations — Leeds',
    intervieweeSlug: 'sarah.mitchell',
    projectId: PROJEKT_OEP,
    startedDaysAgo: 21,
    pytania: [
      {
        kategoria: 'process',
        pytanie: 'Walk me through a typical shift on the Leeds line — where does time actually get lost?',
        odpowiedz:
          'The biggest losses are changeovers and waiting for parts from the warehouse. A changeover on Line 2 still takes close to 90 minutes because setup sheets are paper-based and operators re-check tolerances by hand. Inbound picking delays add another 20-30 minutes most shifts.',
        wymagane: true,
      },
      {
        kategoria: 'technology',
        pytanie: 'What do operators actually use to track output and downtime today?',
        odpowiedz:
          'Output is logged on a whiteboard and re-keyed into a spreadsheet at shift end, so real OEE is always a day behind. Downtime reasons are written on a paper tally sheet next to the line and only get coded properly during the weekly review.',
        wymagane: true,
      },
      {
        kategoria: 'people',
        pytanie: 'How much of the shopfloor knowledge lives with a small number of people?',
        odpowiedz:
          'Too much of it. Two senior setters carry most of the changeover know-how for the precision cells, and if either is off, changeover time roughly doubles. We do not have a written, current standard for every changeover.',
        wymagane: true,
      },
      {
        kategoria: 'planning',
        pytanie: 'How does the production plan get built and how often does it change mid-week?',
        odpowiedz:
          'Planning builds a weekly schedule in a spreadsheet, but it changes almost daily once real demand and material shortages come in. We do not have good visibility of supplier lead times, so re-sequencing is mostly reactive.',
        wymagane: true,
      },
      {
        kategoria: 'quality',
        pytanie: 'Where does quality inspection happen, and how digital is it?',
        odpowiedz:
          'Final inspection is still a paper checklist per batch, filed in a folder. In-process checks on the precision cells use a digital gauge, but the reading is copied by hand onto the batch record rather than captured automatically.',
        wymagane: true,
      },
      {
        kategoria: 'maintenance',
        pytanie: 'Tell me about the biggest unplanned downtime event in the last quarter.',
        odpowiedz:
          'A gearbox failure on the Rotherham press line cost us just over two shifts. We had no vibration or temperature trend data on that asset, so the failure looked sudden even though, looking back, output had been drifting for weeks.',
        wymagane: true,
      },
      {
        kategoria: 'warehouse',
        pytanie: 'How is the warehouse laid out relative to the lines it feeds?',
        odpowiedz:
          'Fast-moving components sit at the back of the warehouse behind slower stock because the layout has not changed since the last expansion. Pickers walk considerably further than they need to for the parts used every shift.',
        wymagane: true,
      },
      {
        kategoria: 'data',
        pytanie: 'If you wanted this week’s true OEE by line right now, could you get it?',
        odpowiedz:
          'Not without someone spending half a day reconciling the whiteboard, the downtime tally sheets and the spreadsheet. We can get a rough number for the month, but a trustworthy number for this week does not exist yet.',
        wymagane: true,
      },
      {
        kategoria: 'governance',
        pytanie: 'Who actually owns the decision to fund a warehouse automation business case?',
        odpowiedz:
          'It sits with James and the leadership team, but the business case itself would need harder numbers than we currently have — right now we would be estimating the picking time savings rather than measuring them.',
        wymagane: true,
      },
      {
        kategoria: 'constraints',
        pytanie: 'What would stop an automation pilot from working here even with budget approved?',
        odpowiedz:
          'Floor space is genuinely tight around Line 2, and any pilot would need to run alongside live production without adding risk to on-time shipments. Change fatigue is also real — the team has absorbed three new systems in the last two years.',
        wymagane: true,
      },
      {
        kategoria: 'wrapup',
        pytanie: 'If you could fix one thing in the next six months, what would move the needle most?',
        odpowiedz:
          'Real-time, trustworthy downtime and OEE data by line. Everything else — changeover standard work, warehouse re-layout, predictive maintenance — gets easier to prioritise once we can actually see where the time and money are going.',
        wymagane: true,
      },
    ],
  },
  {
    slug: 'quality-compliance-head-of-quality',
    nazwa: 'Quality & Compliance — Head of Quality',
    intervieweeSlug: 'robert.chen',
    projectId: PROJEKT_DAR,
    startedDaysAgo: 17,
    pytania: [
      {
        kategoria: 'process',
        pytanie: 'How does a customer complaint travel from the phone call to a corrective action?',
        odpowiedz:
          'It starts as an email or call logged into a shared inbox, then gets manually entered into our quality tracker. Root-cause analysis is thorough once it starts, but it can take a week just to get the right batch records and inspection data pulled together.',
        wymagane: true,
      },
      {
        kategoria: 'data',
        pytanie: 'Where does inspection and test data actually live today?',
        odpowiedz:
          'It is split across three places: paper checklists on the floor, a digital gauge export for the precision cells, and a supplier quality spreadsheet for incoming materials. Nothing links a finished-goods defect back to the incoming batch automatically.',
        wymagane: true,
      },
      {
        kategoria: 'suppliers',
        pytanie: 'How do you currently assess and monitor supplier quality risk?',
        odpowiedz:
          'We score suppliers quarterly on a spreadsheet using defect rate and on-time delivery, but the underlying data is often a month old by the time we review it. We do not have an early-warning signal when a supplier’s quality starts slipping between reviews.',
        wymagane: true,
      },
      {
        kategoria: 'compliance',
        pytanie: 'What does audit preparation look like for ISO and customer audits?',
        odpowiedz:
          'It is roughly two weeks of pulling paper records and cross-checking them against the quality manual before each audit. We pass, but preparation is heavier than it should be because evidence is not organised as we go.',
        wymagane: true,
      },
      {
        kategoria: 'technology',
        pytanie: 'What digital tools does the quality team actually use day to day?',
        odpowiedz:
          'Mostly spreadsheets and email, plus the digital gauge system on two of the six inspection stations. We evaluated a QMS platform eighteen months ago but the business case never got prioritised against the automation projects.',
        wymagane: true,
      },
      {
        kategoria: 'people',
        pytanie: 'How much specialist knowledge sits with one or two people on your team?',
        odpowiedz:
          'A lot of the statistical process control interpretation sits with one senior quality engineer. If she is off during a customer escalation, response time noticeably slows down because no one else reads the control charts the same way.',
        wymagane: true,
      },
      {
        kategoria: 'metrics',
        pytanie: 'What is your current first-pass yield and defect rate, and do you trust the numbers?',
        odpowiedz:
          'First-pass yield sits around 94 percent and customer PPM has been trending down for two quarters, which is genuine progress. I trust the trend more than the absolute number, because a few defect categories are still miscoded at the point of entry.',
        wymagane: true,
      },
      {
        kategoria: 'automation',
        pytanie: 'Where do you see the best opportunity for automation in quality specifically?',
        odpowiedz:
          'Automatic capture from the digital gauges straight into a shared system would remove most of the manual transcription errors we still see. That alone would probably free up close to a day a week across the team.',
        wymagane: true,
      },
      {
        kategoria: 'collaboration',
        pytanie: 'How well do quality and production plan changes together today?',
        odpowiedz:
          'Better than two years ago — we are in the same daily stand-up now — but engineering changes sometimes reach quality after the line has already started running them. A shared change log would close that gap.',
        wymagane: true,
      },
      {
        kategoria: 'risk',
        pytanie: 'What is the quality risk that worries you most heading into next year?',
        odpowiedz:
          'OT and IT segmentation on the shopfloor systems that feed our inspection data. If that data path is not secured properly as we digitise, a single bad actor or misconfiguration could compromise records we rely on for compliance.',
        wymagane: true,
      },
      {
        kategoria: 'wrapup',
        pytanie: 'If you had one investment to make in quality systems this year, what would it be?',
        odpowiedz:
          'A single connected source for inspection and supplier data. Right now good decisions depend on someone manually stitching three sources together, and that does not scale as volume grows.',
        wymagane: true,
      },
    ],
  },
];

export type WniosekDane = {
  slug: string;
  title: string;
  content: string;
  promptType: string;
  sourceSlugs: string[];
};

export const WNIOSKI: WniosekDane[] = [
  {
    slug: 'warehouse-and-changeover-time-loss',
    title: 'Warehouse layout and manual changeovers are the largest source of unplanned time loss on the Leeds line',
    content:
      'Both the changeover process (paper setup sheets, ~90 minutes per changeover, knowledge concentrated in two senior setters) and the warehouse layout (fast-moving parts stored behind slow-moving stock) independently add avoidable minutes to almost every shift. Neither has a written, current standard to build automation or training against yet.',
    promptType: 'summary',
    sourceSlugs: ['plant-operations-leeds'],
  },
  {
    slug: 'oee-and-downtime-data-not-trustworthy-in-real-time',
    title: 'OEE and downtime data exist but are not trustworthy in real time',
    content:
      'Output and downtime are captured on whiteboards and paper tally sheets, then reconciled into a spreadsheet up to a day later. A same-week OEE number by line does not currently exist without manual reconciliation, which limits how fast leadership can act on emerging problems like the gearbox failure that cost two shifts.',
    promptType: 'summary',
    sourceSlugs: ['plant-operations-leeds'],
  },
  {
    slug: 'quality-data-fragmented-across-three-sources',
    title: 'Inspection, gauge and supplier-quality data are fragmented across three disconnected sources',
    content:
      'Final inspection is paper-based, precision-cell gauge readings are re-keyed by hand, and supplier quality scoring runs on a separate spreadsheet updated quarterly. No system currently links a finished-goods defect back to its incoming material batch automatically, which slows root-cause analysis and audit preparation.',
    promptType: 'summary',
    sourceSlugs: ['quality-compliance-head-of-quality'],
  },
  {
    slug: 'shared-priority-single-source-of-truth-before-capital-request',
    title: 'Plant and quality leadership independently want one connected source of truth before the next capital request',
    content:
      'Without asking each other directly, both Sarah Mitchell and Robert Chen named the same underlying gap: decisions and business cases currently rest on manually reconciled data rather than a trusted, real-time source. This is a strong shared entry point for a data foundation initiative that both functions would actively support.',
    promptType: 'cross_session',
    sourceSlugs: ['plant-operations-leeds', 'quality-compliance-head-of-quality'],
  },
];

// ============================================================================
// 2. TOOLS — 3 sesje z katalogu GLOBALNEGO `tools` (bez organization_id).
// `toolType` musi być realną wartością `tools.name` z bazy — sprawdzane
// w runtime (KROK 0: `SELECT name FROM tools WHERE name = ANY(...)`), nie
// zakładane na sztywno.
// ============================================================================
export type NarzedzieDane = {
  slug: string;
  toolType: string; // musi istnieć w globalnym katalogu `tools.name`
  name: string;
  projectId: string;
  createdBySlug: string;
  status: string;
  completionPercent: number;
  confidenceAvg: number;
  outputJson: Record<string, unknown>;
  answersJson: Record<string, unknown>;
  contextSnapshot: Record<string, unknown>;
};

export const NARZEDZIA: NarzedzieDane[] = [
  {
    slug: 'warehouse-outbound-vsm',
    toolType: 'vsm-builder',
    name: 'Warehouse Outbound Value Stream Map — Leeds',
    projectId: PROJEKT_OEP,
    createdBySlug: 'sarah.mitchell',
    status: 'APPROVED',
    completionPercent: 100,
    confidenceAvg: 4.1,
    outputJson: {
      summary:
        'Mapped the outbound flow from goods-in to shipped pallet across 7 process steps. Total lead time is 3.4 days against 41 minutes of actual value-added work — a value-add ratio of roughly 1%.',
      steps: [
        { step: 'Goods-in booking', leadTimeMinutes: 25, valueAddMinutes: 8, wasteType: 'waiting' },
        { step: 'Putaway to storage', leadTimeMinutes: 40, valueAddMinutes: 12, wasteType: 'motion' },
        { step: 'Pick release to line', leadTimeMinutes: 1380, valueAddMinutes: 6, wasteType: 'inventory' },
        { step: 'Picking', leadTimeMinutes: 35, valueAddMinutes: 9, wasteType: 'motion' },
        { step: 'Staging', leadTimeMinutes: 480, valueAddMinutes: 0, wasteType: 'waiting' },
        { step: 'Pack & label', leadTimeMinutes: 18, valueAddMinutes: 6, wasteType: null },
        { step: 'Dispatch', leadTimeMinutes: 90, valueAddMinutes: 0, wasteType: 'waiting' },
      ],
      keyFindings: [
        'Pick release to line is the single largest lead-time contributor at 23 hours, driven by batch-release scheduling rather than picking speed itself.',
        'Fast-moving SKUs are stored behind slow-moving stock, adding avoidable travel distance to nearly every pick.',
        'Staging before dispatch has zero value-added time and exists purely as a buffer against truck scheduling variance.',
      ],
      recommendations: [
        'Move to continuous pick release for the top 20% of SKUs by pick frequency instead of batch release.',
        'Re-slot the warehouse so fast-moving parts sit closest to the outbound lane.',
        'Trial a fixed dispatch appointment window with the two largest carriers to shrink the staging buffer.',
      ],
    },
    answersJson: {
      scope: 'Leeds warehouse, outbound flow only, 2 representative SKU families',
      dataSource: 'Time-and-motion study, 3 shifts, plus WMS pick timestamps',
    },
    contextSnapshot: { plant: 'Leeds', horizon: 'current-state', facilitator: 'sarah.mitchell' },
  },
  {
    slug: 'northwind-2027-strategic-swot',
    toolType: 'dynamic-swot',
    name: 'Northwind 2027 Strategic SWOT',
    projectId: PROJEKT_OEP,
    createdBySlug: 'james.whitfield',
    status: 'APPROVED',
    completionPercent: 100,
    confidenceAvg: 3.8,
    outputJson: {
      summary:
        'Northwind carries real strengths in customer trust and technical precision, but its digital and data foundation is now the binding constraint on the next stage of growth.',
      strengths: [
        'Long-standing customer relationships in precision components with strong renewal rates.',
        'Deep shopfloor engineering talent, particularly in controls and automation.',
        'Two-site flexibility (Leeds, Rotherham) allows load-balancing during demand spikes.',
      ],
      weaknesses: [
        'OEE and quality data are not trustworthy in real time, slowing root-cause response.',
        'Shopfloor knowledge concentrated in a small number of senior staff (changeovers, SPC interpretation).',
        'No connected data foundation linking production, quality and supplier data.',
      ],
      opportunities: [
        'Warehouse automation and predictive maintenance could materially cut unplanned downtime.',
        'Digital work instructions would reduce dependency on a few senior setters.',
        'Growing customer appetite for verified quality data (digital certificates of conformance).',
      ],
      threats: [
        'Competitors with more mature digital operations winning on responsiveness and traceability.',
        'OT/IT segmentation gaps create rising cyber exposure as more shopfloor systems connect.',
        'Skilled-labour shortage in controls engineering makes over-reliance on a few experts riskier.',
      ],
      tensions: [
        { posture: 'attack', text: 'Digital traceability is an opportunity Northwind is well placed to win on customer trust alone.' },
        { posture: 'defend', text: 'Cyber exposure grows with every new connected shopfloor system — segmentation needs to keep pace.' },
      ],
    },
    answersJson: { horizon: '2026-2027', participants: ['james.whitfield', 'sarah.mitchell', 'robert.chen'] },
    contextSnapshot: { workshopFormat: 'facilitated', durationMinutes: 90 },
  },
  {
    slug: 'digital-automation-capability-map',
    toolType: 'capability-mapper',
    name: 'Digital & Automation Capability Map',
    projectId: PROJEKT_DAR,
    createdBySlug: 'daniel.osei',
    status: 'APPROVED',
    completionPercent: 100,
    confidenceAvg: 3.5,
    outputJson: {
      summary:
        'Capability scan across 6 digital/automation domains, scored 1 (ad hoc) to 5 (industrialised). Overall average 2.5 — foundational capability exists in isolated pockets but is not yet connected or standardised.',
      capabilities: [
        { domain: 'Shopfloor connectivity', score: 3, note: 'Digital gauges live on 2 of 6 inspection stations; PLC data not yet centralised.' },
        { domain: 'Data foundation', score: 2, note: 'No shared data layer; production, quality and supplier data sit in separate spreadsheets.' },
        { domain: 'Process automation', score: 2, note: 'Manual changeovers and manual data entry dominate; one pilot automated cell on Line 3.' },
        { domain: 'Predictive maintenance', score: 1, note: 'No condition-monitoring sensors deployed; maintenance is reactive/scheduled only.' },
        { domain: 'Digital work instructions', score: 2, note: 'Standard work exists on paper; not consistently followed or version-controlled.' },
        { domain: 'Cybersecurity (OT/IT)', score: 3, note: 'Perimeter and access controls reasonable; OT/IT segmentation uneven across sites.' },
      ],
      recommendations: [
        'Prioritise a shared data foundation before adding further point solutions — several gaps trace back to this one root cause.',
        'Pilot condition-monitoring sensors on the assets with the highest unplanned-downtime cost first (press line gearboxes).',
        'Convert paper standard work to a version-controlled digital format alongside the changeover-time initiative.',
      ],
    },
    answersJson: { assessor: 'daniel.osei', method: 'structured interview + shopfloor walk, 2 sites' },
    contextSnapshot: { sites: ['Leeds', 'Rotherham'], scale: '1-5' },
  },
];

// ============================================================================
// 3. ASSESSMENT (legacy) — 1 ocena + 1 raport, oś DRD (7 osi) spójna z sesją
// Method Core poniżej (obie odpowiadają poziomowi 3. na tej samej skali 1-7).
// ============================================================================
export const OSIE_DRD: Array<{ id: number; nazwa: string; poziom: number; skala: number }> = [
  { id: 1, nazwa: 'Customer & Market', poziom: 3, skala: 7 },
  { id: 2, nazwa: 'Strategy & Portfolio Governance', poziom: 3, skala: 5 },
  { id: 3, nazwa: 'Operating Model & Collaboration', poziom: 3, skala: 5 },
  { id: 4, nazwa: 'Data & Value Foundation', poziom: 3, skala: 7 },
  { id: 5, nazwa: 'Leadership & Adoption', poziom: 3, skala: 6 },
  { id: 6, nazwa: 'Technology & Cyber', poziom: 3, skala: 6 },
  { id: 7, nazwa: 'AI & Advanced Analytics', poziom: 3, skala: 5 },
];

// ============================================================================
// 4. METHOD CORE (DRD) — hardcoded literal, NIE importowane z `src/` (granica
// `server/tsconfig.json` rootDir, patrz nagłówek pliku i
// `EventDerivedOutputBridge.ts`). 39 obszarów, `src/services/drdStructure.ts`
// (zweryfikowane grepem 2026-09-08): osie 1 (1A-1I, 9), 2-4 i 6 (A-E, 5 każda
// poza 4 gdzie 7), 5 i 6 (A-E, 6 każda), 7 (A-E, 5, poza 7E gdzie 7). Minimalna
// skala obszaru to 5 poziomów (zmierzone), więc poziom 3 jest bezpieczny dla
// KAŻDEGO z 39 obszarów.
// ============================================================================
export const DRD_OBSZARY_39 = [
  '1A', '1B', '1C', '1D', '1E', '1F', '1G', '1H', '1I',
  '2A', '2B', '2C', '2D', '2E',
  '3A', '3B', '3C', '3D', '3E',
  '4A', '4B', '4C', '4D', '4E',
  '5A', '5B', '5C', '5D', '5E',
  '6A', '6B', '6C', '6D', '6E',
  '7A', '7B', '7C', '7D', '7E',
] as const;

const DRD_METHOD_PACK_ID = 'drd';
const DRD_METHOD_PACK_VERSION = '2.0.0-methodpack.1';
const DRD_ANSWER_LEVEL = 3;
const DRD_EVIDENCE_STRENGTH = 'E2';

// ============================================================================
// Główna logika
// ============================================================================
async function main() {
  const opcje = czytajWspolneArgumenty(process.argv.slice(2));
  const url = wymaganyUrl();
  const toz = sprawdzCel(url, opcje.oczekiwanyHost, opcje.celZdalny);
  const pool = otworzPool(url);
  const c = await pool.connect();

  console.log(`[odkrycie] cel:  ${toz}`);
  console.log(`[odkrycie] tryb: ${opcje.tryb}`);

  try {
    if (opcje.tryb === 'reset') {
      await reset(c);
      return;
    }
    if (opcje.tryb === 'verify') {
      await verify(c, pool, url, opcje.oczekiwanyHost);
      return;
    }

    // --- KROK 0 (powtórzony w runtime): zależność od 01-rdzen.ts ------------
    const org = await c.query('SELECT 1 FROM organizations WHERE id = $1', [ORG_ID]);
    if (org.rows.length === 0) {
      throw new Error(`Organizacja „${ORG_ID}" nie istnieje. Uruchom najpierw 01-rdzen.ts --apply.`);
    }
    const osoby = await c.query('SELECT id FROM users WHERE id = ANY($1)', [[JAMES, SARAH, ROBERT, DANIEL]]);
    if (osoby.rows.length !== 4) {
      throw new Error(
        `Brakuje ${4 - osoby.rows.length} z 4 wymaganych osób (James/Sarah/Robert/Daniel). Uruchom 01-rdzen.ts --apply.`
      );
    }
    const projekty = await c.query('SELECT id FROM projects WHERE id = ANY($1)', [[PROJEKT_OEP, PROJEKT_DAR]]);
    if (projekty.rows.length !== 2) {
      throw new Error('Brakuje projektów northwind. Uruchom 01-rdzen.ts --apply.');
    }

    // --- KROK 0: `tools` katalog globalny — sprawdź, że 3 wybrane tool_type
    // NAPRAWDĘ istnieją w bazie (premisa mierzona, nie zakładana). --------
    const wymaganeToolType = NARZEDZIA.map((n) => n.toolType);
    const istniejaceTooly = await c.query('SELECT name FROM tools WHERE name = ANY($1)', [wymaganeToolType]);
    const istniejaceNazwy = new Set(istniejaceTooly.rows.map((r: { name: string }) => r.name));
    const brakujace = wymaganeToolType.filter((t) => !istniejaceNazwy.has(t));
    if (brakujace.length > 0) {
      throw new Error(
        `STOP — te tool_type nie istnieją w globalnym katalogu \`tools\`: ${brakujace.join(', ')}. ` +
          'Katalog global — nie tworzymy nowych wierszy w tej tabeli.'
      );
    }

    if (opcje.tryb === 'dry-run') {
      await dryRun(c);
      return;
    }
    if (opcje.tryb === 'apply') {
      await apply(c, url);
      return;
    }
  } finally {
    c.release();
    await pool.end();
  }
}

// ----------------------------------------------------------------------------
// DRY-RUN — tylko raport, zero zapisu
// ----------------------------------------------------------------------------
async function dryRun(c: PoolClient) {
  console.log('\n--- PLAN (dry-run) ---');
  for (const w of WYWIADY) {
    const id = det('interview', w.slug);
    const istnieje = await c.query('SELECT 1 FROM interview_sessions WHERE id = $1', [id]);
    console.log(`wywiad        ${w.slug.padEnd(38)} ${istnieje.rows.length ? 'bez zmian' : 'utworzy'} (${w.pytania.length} pytań)`);
  }
  for (const wn of WNIOSKI) {
    const id = det('insight', wn.slug);
    const istnieje = await c.query('SELECT 1 FROM interview_insights WHERE id = $1', [id]);
    console.log(`wniosek       ${wn.slug.padEnd(38)} ${istnieje.rows.length ? 'bez zmian' : 'utworzy'}`);
  }
  for (const n of NARZEDZIA) {
    const id = det('tool-session', n.slug);
    const istnieje = await c.query('SELECT 1 FROM tool_sessions WHERE id = $1', [id]);
    console.log(`sesja narz.   ${n.slug.padEnd(38)} ${istnieje.rows.length ? 'bez zmian' : 'utworzy'} (tool_type=${n.toolType})`);
  }
  const assessmentId = det('assessment', 'operational-maturity-2026');
  const istniejeAssessment = await c.query('SELECT 1 FROM assessments WHERE id = $1', [assessmentId]);
  console.log(`ocena         operational-maturity-2026              ${istniejeAssessment.rows.length ? 'bez zmian' : 'utworzy'}`);

  const drdSesja = await c.query(
    `SELECT 1 FROM method_sessions WHERE organization_id = $1 AND method_pack_id = $2 AND state = 'frozen' LIMIT 1`,
    [ORG_ID, DRD_METHOD_PACK_ID]
  );
  console.log(
    `method-core   drd-operational-readiness              ${drdSesja.rows.length ? 'bez zmian (już zamrożona)' : 'utworzy (39 obszarów, HTTP)'}`
  );
  console.log('\n[odkrycie] dry-run: nic nie zapisano.');
}

// ----------------------------------------------------------------------------
// APPLY
// ----------------------------------------------------------------------------
async function apply(c: PoolClient, databaseUrl: string) {
  const lic = new Licznik();
  const nowIso = new Date().toISOString();

  // ---- Interview sessions + questions + answers rollup --------------------
  const interviewIdBySlug: Record<string, string> = {};
  for (const w of WYWIADY) {
    const sessionId = det('interview', w.slug);
    interviewIdBySlug[w.slug] = sessionId;
    const ownerId = JAMES; // konsultant/owner sesji — nie respondent
    const answeredBy = userId(w.intervieweeSlug);
    const startedAt = new Date(Date.now() - w.startedDaysAgo * 24 * 60 * 60 * 1000).toISOString();

    const ins = await c.query(
      `INSERT INTO interview_sessions (
         id, organization_id, project_id, name, owner_id, status,
         progress_json, total_questions, answered_questions,
         summary_facts, summary_gaps, summary_constraints, summary_pain_points,
         started_at, completed_at, last_activity_at
       ) VALUES ($1,$2,$3,$4,$5,'completed',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO NOTHING`,
      [
        sessionId,
        ORG_ID,
        w.projectId,
        w.nazwa,
        ownerId,
        JSON.stringify({ percent: 100 }),
        w.pytania.length,
        w.pytania.length,
        JSON.stringify(w.pytania.slice(0, 3).map((p) => p.odpowiedz)),
        JSON.stringify(['No connected data foundation across production, quality and suppliers.']),
        JSON.stringify(['Floor space and change fatigue limit how fast a pilot can move.']),
        JSON.stringify(w.pytania.filter((p) => p.kategoria !== 'wrapup').slice(0, 3).map((p) => p.odpowiedz)),
        startedAt,
        startedAt,
        startedAt,
      ]
    );
    ins.rowCount ? lic.utworz() : lic.pomin();

    let sortOrder = 0;
    const wszystkieOdpowiedzi: Array<{ question: string; answer: string; category: string }> = [];
    for (const p of w.pytania) {
      const questionId = det('interview-question', `${w.slug}|${sortOrder}`);
      const qIns = await c.query(
        `INSERT INTO interview_questions (
           id, session_id, organization_id, category, question_text, answer_text,
           status, answer_type, is_required, answered_by, answered_at, sort_order
         ) VALUES ($1,$2,$3,$4,$5,$6,'answered','open',$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [
          questionId,
          sessionId,
          ORG_ID,
          p.kategoria,
          p.pytanie,
          p.odpowiedz,
          p.wymagane ? 1 : 0,
          answeredBy,
          startedAt,
          sortOrder,
        ]
      );
      qIns.rowCount ? lic.utworz() : lic.pomin();
      wszystkieOdpowiedzi.push({ question: p.pytanie, answer: p.odpowiedz, category: p.kategoria });
      sortOrder += 1;
    }

    const answerRollupId = det('interview-answer', `${w.slug}|overview`);
    const aIns = await c.query(
      `INSERT INTO interview_answers (
         id, session_id, organization_id, category, question_answers, summary,
         confidence_score, status, messages_count
       ) VALUES ($1,$2,$3,'overview',$4,$5,4,'completed',$6)
       ON CONFLICT (id) DO NOTHING`,
      [
        answerRollupId,
        sessionId,
        ORG_ID,
        JSON.stringify(wszystkieOdpowiedzi),
        `${w.pytania.length} questions answered by ${w.intervieweeSlug.replace('.', ' ')} covering process, technology, people and data readiness.`,
        w.pytania.length,
      ]
    );
    aIns.rowCount ? lic.utworz() : lic.pomin();
  }

  // ---- Insights -------------------------------------------------------------
  for (const wn of WNIOSKI) {
    const insightId = det('insight', wn.slug);
    const sourceSessionIds = wn.sourceSlugs.map((s) => interviewIdBySlug[s]).filter(Boolean);
    const insIns = await c.query(
      `INSERT INTO interview_insights (
         id, organization_id, title, prompt_type, source_session_ids, content,
         status, source_session_count, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,'completed',$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [insightId, ORG_ID, wn.title, wn.promptType, JSON.stringify(sourceSessionIds), wn.content, sourceSessionIds.length, JAMES]
    );
    insIns.rowCount ? lic.utworz() : lic.pomin();
  }

  // ---- Tool sessions ----------------------------------------------------------
  for (const n of NARZEDZIA) {
    const sessionId = det('tool-session', n.slug);
    const createdBy = userId(n.createdBySlug);
    const tIns = await c.query(
      `INSERT INTO tool_sessions (
         id, organization_id, project_id, tool_type, name, status,
         completion_percent, confidence_avg, answers_json, context_snapshot,
         created_by, updated_by, output_json, approved_at, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO NOTHING`,
      [
        sessionId,
        ORG_ID,
        n.projectId,
        n.toolType,
        n.name,
        n.status,
        n.completionPercent,
        n.confidenceAvg,
        JSON.stringify(n.answersJson),
        JSON.stringify(n.contextSnapshot),
        createdBy,
        createdBy,
        JSON.stringify(n.outputJson),
        nowIso,
        nowIso,
        nowIso,
      ]
    );
    tIns.rowCount ? lic.utworz() : lic.pomin();
  }

  // ---- Assessment (legacy) + report ------------------------------------------
  const assessmentId = det('assessment', 'operational-maturity-2026');
  const answersJson = {
    drd: {
      axes: OSIE_DRD.map((a) => ({ axisId: a.id, name: a.nazwa, achieved: a.poziom, target: Math.min(a.skala, a.poziom + 2), scale: a.skala })),
    },
  };
  const scoreSummary = {
    overall: { actual: 3.0, target: 5.0, gap: 2.0 },
    topStrengths: ['Customer trust and technical precision', 'Two-site operating flexibility', 'Improving quality-production collaboration'],
    topGaps: ['Real-time trustworthy production data', 'Connected quality/supplier data foundation', 'Predictive maintenance coverage'],
    seeded: true,
  };
  const assessmentCreatedAt = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString();
  const assessmentStartedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const assessmentCompletedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const assessmentReportApprovedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const assessmentUpdatedAt = assessmentReportApprovedAt;
  const aIns = await c.query(
    `INSERT INTO assessments (
       id, organization_id, project_id, assessment_type, name, status,
       framework, completion_percent, confidence_avg, overall_score,
       answers_json, context_snapshot, score_summary, created_by, updated_by,
       started_at, completed_at, report_approved_at, created_at, updated_at
     ) VALUES ($1,$2,$3,'DRD',$4,'APPROVED','DRD',100,3.6,3.0,$5,$6,$7,$8,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO NOTHING`,
    [
      assessmentId,
      ORG_ID,
      PROJEKT_OEP,
      'Northwind 2027 — Operational Maturity Assessment',
      JSON.stringify(answersJson),
      JSON.stringify({
        demo: true,
        storyline: 'Northwind 2027',
        scope: { plants: 2, timeframe: 'rolling-90-days' },
      }),
      JSON.stringify(scoreSummary),
      JAMES,
      assessmentStartedAt,
      assessmentCompletedAt,
      assessmentReportApprovedAt,
      assessmentCreatedAt,
      assessmentUpdatedAt,
    ]
  );
  aIns.rowCount ? lic.utworz() : lic.pomin();

  const reportId = det('assessment-report', 'operational-maturity-2026');
  const axisData = {
    axes: OSIE_DRD.map((a) => ({ axisId: a.id, name: a.nazwa, level: a.poziom, levelCount: a.skala })),
  };
  const rIns = await c.query(
    `INSERT INTO assessment_reports (
       id, assessment_id, organization_id, project_id, name, status,
       axis_data, executive_summary, detailed_analysis, recommendations,
       generated_by, created_by, updated_by, approved_by, approved_at, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,'APPROVED',$6,$7,$8,$9,$10,$10,$10,$10,$11,$12,$11)
     ON CONFLICT (id) DO NOTHING`,
    [
      reportId,
      assessmentId,
      ORG_ID,
      PROJEKT_OEP,
      'Northwind 2027 Operational Maturity Report',
      JSON.stringify(axisData),
      'Northwind Manufacturing has strong customer trust and shopfloor engineering talent, but its production, quality and supplier data remain fragmented across spreadsheets and paper records. Closing that data foundation gap is the single highest-leverage move before scaling automation or predictive maintenance investment.',
      'Across all seven axes the organisation sits at a consistent Level 3 (Defined/Emerging) — practices exist and are repeatable within teams, but are not yet connected across functions or supported by real-time data. Customer & Market and Data & Value Foundation show the widest gap to target, driven respectively by fragmented CRM-adjacent tooling and the absence of a shared production/quality/supplier data layer identified independently by both plant and quality leadership during discovery interviews.',
      'Sequence investment as: (1) a shared data foundation connecting production, quality and supplier signals; (2) digital work instructions to reduce key-person dependency on changeovers and SPC interpretation; (3) predictive maintenance piloted on the highest-cost failure mode (press line gearboxes); (4) OT/IT segmentation hardening in parallel, before further shopfloor connectivity expands the attack surface.',
      JAMES,
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    ]
  );
  rIns.rowCount ? lic.utworz() : lic.pomin();

  // ---- Method Core (DRD) — HTTP, prawdziwy pisarz kanoniczny ----------------
  const jużZamrożona = await c.query(
    `SELECT 1 FROM method_sessions WHERE organization_id = $1 AND method_pack_id = $2 AND state = 'frozen' LIMIT 1`,
    [ORG_ID, DRD_METHOD_PACK_ID]
  );
  if (jużZamrożona.rows.length > 0) {
    console.log('[odkrycie] method-core: sesja DRD już zamrożona dla northwind — pomijam (idempotentnie).');
    lic.pomin();
  } else {
    console.log('[odkrycie] method-core: tworzę sesję DRD przez prawdziwy HTTP router (39 obszarów)…');
    await utworzZamrożonąSesjęDrd(c, databaseUrl);
    lic.utworz();
  }

  console.log(`\n${lic.raport('odkrycie')}`);
}

// ----------------------------------------------------------------------------
// Method Core — dokładnie ta sama ścieżka co siriFullFlow.integration.test.ts:
// prawdziwy Express router zamontowany w procesie, prawdziwe podpisane JWT,
// zero mocków. session create -> role -> transitions -> 39x (evidence+answer)
// -> freeze -> Output.
// ----------------------------------------------------------------------------
async function utworzZamrożonąSesjęDrd(c: PoolClient, databaseUrl: string): Promise<void> {
  // Dokładnie te same zmienne co udokumentowana komenda uruchomienia
  // `siriFullFlow.integration.test.ts` (nagłówek tego pliku) — bez nich
  // `DbPromise`/`Database` warstwa serwera może wpaść w tryb mock/no-op
  // (MOCK_DB) i CREATE zwróci 201 bez realnego zapisu (zmierzone 2026-09-08:
  // pierwsza próba bez tych zmiennych dała FK violation na
  // method_session_roles — sesja "utworzona" nigdy nie trafiła do bazy).
  process.env.DATABASE_URL = databaseUrl;
  process.env.DB_TYPE = 'postgres';
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.POSTGRES_SKIP_INIT_IN_TEST = '1';
  if (!process.env.AI_PROVIDER_MODE) process.env.AI_PROVIDER_MODE = 'mock';
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';

  const { default: config } = await import('../../../src/config/Config.js');
  const { default: methodCoreRoutes } = await import('../../../src/routes/method-core.routes.js');

  const app: Express = express();
  app.use(express.json());
  app.use('/api/method', methodCoreRoutes);

  const sign = (id: string, organizationId: string) =>
    jwt.sign({ id, organizationId, role: 'user' }, config.JWT_SECRET, {
      expiresIn: '30m',
      ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
      ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
    });
  const jamesToken = sign(JAMES, ORG_ID);
  const robertToken = sign(ROBERT, ORG_ID);

  // 1) create — DRD auto-registers at readiness='pilot' (canStartSession
  //    accepts 'pilot'/'released'), więc BEZ demo bypass.
  const createRes = await request(app)
    .post('/api/method/sessions')
    .set('Authorization', `Bearer ${jamesToken}`)
    .set('Idempotency-Key', `create:${randomUUID()}`)
    .send({
      module: 'assessment',
      methodPackId: DRD_METHOD_PACK_ID,
      methodPackVersion: DRD_METHOD_PACK_VERSION,
      mode: 'guided_manual',
      projectId: PROJEKT_OEP,
    });
  if (createRes.status !== 201) {
    throw new Error(`method-core create sesji nieudane: ${createRes.status} ${JSON.stringify(createRes.body)}`);
  }
  const sessionId: string = createRes.body.session.id;

  // 2) rola lead_assessor dla owner-a — bezpośredni SQL, dokładnie jak w
  //    siriFullFlow.integration.test.ts (`grantRole`) — role-grant nie ma
  //    osobnego wymogu przejścia przez POST /roles dla tego przypadku.
  await c.query(
    `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
     VALUES ($1,$2,$3,$4,'lead_assessor', now())
     ON CONFLICT (session_id, user_id, role) DO NOTHING`,
    [randomUUID(), ORG_ID, sessionId, JAMES]
  );

  // 3) transitions: draft -> prepared -> active -> in_review
  for (const to of ['prepared', 'active', 'in_review']) {
    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/transition`)
      .set('Authorization', `Bearer ${jamesToken}`)
      .set('Idempotency-Key', `transition:${to}:${randomUUID()}`)
      .send({ to });
    if (res.status !== 200) {
      throw new Error(`method-core transition->${to} nieudane: ${res.status} ${JSON.stringify(res.body)}`);
    }
  }

  // 4) rola approver dla Roberta (Head of Quality) — realistyczny approver.
  await c.query(
    `INSERT INTO method_session_roles (id, organization_id, session_id, user_id, role, created_at)
     VALUES ($1,$2,$3,$4,'approver', now())
     ON CONFLICT (session_id, user_id, role) DO NOTHING`,
    [randomUUID(), ORG_ID, sessionId, ROBERT]
  );

  // 5) 39 obszarów: EVIDENCE_ATTACHED + ANSWER_CONFIRMED, poziom 3, dowód E2.
  // Zmierzone 2026-09-08: pojedynczy request w tej pętli czasem dostaje
  // przejściowe 403 (izolowany retry tego samego wywołania od razu przechodzi
  // na 201 — nie jest to reguła biznesowa, ciało odpowiedzi jest puste `{}`,
  // nie `{error:'session_read_only', ...}` jak zwraca `requireSessionWriteRole`
  // naprawdę). Nie zdiagnozowano do końca w budżecie tej paczki (STOP do
  // zgłoszenia — patrz meldunek), więc pętla dostaje krótki retry-z-backoffem
  // zamiast twardego przerwania całego seeda na jednym przejściowym błędzie.
  const postEventWithRetry = async (
    body: Record<string, unknown>,
    idemPrefix: string,
    unitId: string
  ): Promise<void> => {
    const maxProby = 4;
    for (let proba = 1; proba <= maxProby; proba++) {
      const res = await request(app)
        .post(`/api/method/sessions/${sessionId}/events`)
        .set('Authorization', `Bearer ${jamesToken}`)
        .set('Idempotency-Key', `${idemPrefix}:${unitId}:${randomUUID()}`)
        .send(body);
      if (res.status === 201) return;
      if (proba === maxProby) {
        throw new Error(
          `method-core ${String(body.type)}(${unitId}) nieudane po ${maxProby} próbach: ${res.status} ${JSON.stringify(res.body)}`
        );
      }
      await new Promise((r) => setTimeout(r, 150 * proba));
    }
  };

  for (const unitId of DRD_OBSZARY_39) {
    await postEventWithRetry(
      {
        type: 'EVIDENCE_ATTACHED',
        unitId,
        payload: { evidenceId: `ev-${unitId}-${randomUUID()}`, evidenceType: 'document', strength: DRD_EVIDENCE_STRENGTH },
      },
      'evidence',
      unitId
    );
    await postEventWithRetry(
      {
        type: 'ANSWER_CONFIRMED',
        unitId,
        level: DRD_ANSWER_LEVEL,
        payload: { questionId: `q-${unitId}`, answerState: 'confirmed' },
      },
      'answer',
      unitId
    );
  }

  // 6) freeze -> Output (Robert jako approver).
  const freeze = await request(app)
    .post(`/api/method/sessions/${sessionId}/freeze`)
    .set('Authorization', `Bearer ${robertToken}`)
    .set('Idempotency-Key', `freeze:${randomUUID()}`)
    .send({});
  if (freeze.status !== 200) {
    throw new Error(`method-core freeze nieudane: ${freeze.status} ${JSON.stringify(freeze.body)}`);
  }
  console.log(
    `[odkrycie] method-core: sesja ${sessionId} zamrożona, Output ${freeze.body.output?.id} (${Object.keys(freeze.body.output?.current ?? {}).length} obszarów).`
  );
}

// ----------------------------------------------------------------------------
// VERIFY — asercje twarde
// ----------------------------------------------------------------------------
type Asercja = { nazwa: string; oczekiwane: number; rzeczywiste: number };

async function verify(c: PoolClient, pool: import('pg').Pool, url: string, oczekiwanyHost: string) {
  const interviewSessions = await c.query('SELECT COUNT(*)::int AS n FROM interview_sessions WHERE organization_id = $1', [ORG_ID]);
  const interviewQuestions = await c.query(
    `SELECT COUNT(*)::int AS n FROM interview_questions q JOIN interview_sessions s ON s.id = q.session_id WHERE s.organization_id = $1`,
    [ORG_ID]
  );
  const interviewAnswers = await c.query(
    `SELECT COUNT(*)::int AS n FROM interview_answers a JOIN interview_sessions s ON s.id = a.session_id WHERE s.organization_id = $1`,
    [ORG_ID]
  );
  const insights = await c.query('SELECT COUNT(*)::int AS n FROM interview_insights WHERE organization_id = $1', [ORG_ID]);
  const toolSessions = await c.query('SELECT COUNT(*)::int AS n FROM tool_sessions WHERE organization_id = $1', [ORG_ID]);
  const assessments = await c.query('SELECT COUNT(*)::int AS n FROM assessments WHERE organization_id = $1', [ORG_ID]);
  const assessmentReports = await c.query('SELECT COUNT(*)::int AS n FROM assessment_reports WHERE organization_id = $1', [ORG_ID]);
  const methodSessionsFrozen = await c.query(
    `SELECT COUNT(*)::int AS n FROM method_sessions WHERE organization_id = $1 AND method_pack_id = $2 AND state = 'frozen'`,
    [ORG_ID, DRD_METHOD_PACK_ID]
  );
  const methodOutputs = await c.query(
    `SELECT COUNT(*)::int AS n FROM method_outputs mo JOIN method_sessions ms ON ms.id = mo.session_id WHERE ms.organization_id = $1 AND ms.method_pack_id = $2`,
    [ORG_ID, DRD_METHOD_PACK_ID]
  );

  // Po `--reset` żadna D2-owa tabela nie ma wierszy dla northwind — asercje
  // muszą wtedy oczekiwać ZERA, nie liczby zasianej (dokładnie ten sam wzorzec
  // co `99-verify.ts` z D1: rozgałęzienie po tym, czy stan "przed" istnieje).
  // Dyskryminator: `interview_sessions` — jeśli 0, jesteśmy w stanie reset.
  const stanReset = interviewSessions.rows[0].n === 0;

  const oczekiwaneWywiady = stanReset ? 0 : WYWIADY.length;
  const oczekiwanePytania = stanReset ? 0 : WYWIADY.reduce((sum, w) => sum + w.pytania.length, 0);
  const oczekiwaneWnioski = stanReset ? 0 : WNIOSKI.length;
  const oczekiwaneNarzedzia = stanReset ? 0 : NARZEDZIA.length;
  const oczekiwaneJeden = stanReset ? 0 : 1;

  if (stanReset) {
    console.log('[verify] stan: PO RESECIE (interview_sessions=0) — oczekuję zer wszędzie.');
  } else {
    console.log('[verify] stan: PO APPLY — oczekuję pełnych liczb D2.');
  }

  const zestaw: Asercja[] = [
    { nazwa: 'interview_sessions (northwind)', oczekiwane: oczekiwaneWywiady, rzeczywiste: interviewSessions.rows[0].n },
    { nazwa: 'interview_questions (northwind)', oczekiwane: oczekiwanePytania, rzeczywiste: interviewQuestions.rows[0].n },
    { nazwa: 'interview_answers (northwind, rollup)', oczekiwane: oczekiwaneWywiady, rzeczywiste: interviewAnswers.rows[0].n },
    { nazwa: 'interview_insights (northwind)', oczekiwane: oczekiwaneWnioski, rzeczywiste: insights.rows[0].n },
    { nazwa: 'tool_sessions (northwind)', oczekiwane: oczekiwaneNarzedzia, rzeczywiste: toolSessions.rows[0].n },
    { nazwa: 'assessments (northwind)', oczekiwane: oczekiwaneJeden, rzeczywiste: assessments.rows[0].n },
    { nazwa: 'assessment_reports (northwind)', oczekiwane: oczekiwaneJeden, rzeczywiste: assessmentReports.rows[0].n },
    { nazwa: 'method_sessions frozen (northwind, drd)', oczekiwane: oczekiwaneJeden, rzeczywiste: methodSessionsFrozen.rows[0].n },
    { nazwa: 'method_outputs (northwind, drd)', oczekiwane: oczekiwaneJeden, rzeczywiste: methodOutputs.rows[0].n },
  ];

  let ok = true;
  console.log('\n--- VERIFY ---');
  for (const a of zestaw) {
    const pass = a.oczekiwane === a.rzeczywiste;
    if (!pass) ok = false;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${a.nazwa.padEnd(42)} oczekiwano=${a.oczekiwane} rzeczywiste=${a.rzeczywiste}`);
  }

  if (!ok) {
    console.log('\n[verify] FAIL — co najmniej jedna asercja nie zgadza się.');
    process.exitCode = 1;
    return;
  }
  console.log('\n[verify] OK — wszystkie asercje D2 zgadzają się.');
}

// ----------------------------------------------------------------------------
// RESET — kasuje WYŁĄCZNIE dane D2 dla organization_id = ORG_ID (Northwind). Kolejność
// respektuje FK (dzieci przed rodzicami); `tools` (katalog globalny) NIE JEST
// ruszany.
// ----------------------------------------------------------------------------
async function reset(c: PoolClient) {
  await c.query('BEGIN');
  try {
    // Method Core — dzieci method_sessions w kolejności bezpiecznej dla FK.
    await c.query(
      `DELETE FROM method_findings WHERE output_id IN (SELECT id FROM method_outputs WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await c.query(
      `DELETE FROM method_initiative_drafts WHERE organization_id = $1`,
      [ORG_ID]
    );
    await c.query(
      `DELETE FROM method_report_snapshots WHERE organization_id = $1`,
      [ORG_ID]
    );
    await c.query(`DELETE FROM method_outputs WHERE organization_id = $1`, [ORG_ID]);
    await c.query(`DELETE FROM method_snapshots WHERE organization_id = $1`, [ORG_ID]);
    await c.query(`DELETE FROM method_session_roles WHERE organization_id = $1`, [ORG_ID]);
    await c.query(`DELETE FROM method_session_role_events WHERE organization_id = $1`, [ORG_ID]).catch(() => {});
    await c.query(`DELETE FROM method_session_report_metadata WHERE organization_id = $1`, [ORG_ID]).catch(() => {});
    await c.query(`DELETE FROM method_session_create_idempotency WHERE organization_id = $1`, [ORG_ID]).catch(() => {});
    await c.query(`DELETE FROM method_events WHERE organization_id = $1`, [ORG_ID]).catch(() => {});
    await c.query(`DELETE FROM method_evidence WHERE organization_id = $1`, [ORG_ID]).catch(() => {});
    await c.query(`DELETE FROM method_approvals WHERE organization_id = $1`, [ORG_ID]).catch(() => {});
    await c.query(`DELETE FROM method_sessions WHERE organization_id = $1`, [ORG_ID]);

    // Assessment
    await c.query(`DELETE FROM assessment_reports WHERE organization_id = $1`, [ORG_ID]);
    await c.query(`DELETE FROM assessments WHERE organization_id = $1`, [ORG_ID]);

    // Tools (tabela `tools` katalog globalny — NIE RUSZANA)
    await c.query(`DELETE FROM tool_sessions WHERE organization_id = $1`, [ORG_ID]);

    // Interview
    await c.query(`DELETE FROM interview_insights WHERE organization_id = $1`, [ORG_ID]);
    await c.query(
      `DELETE FROM interview_answers WHERE session_id IN (SELECT id FROM interview_sessions WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await c.query(
      `DELETE FROM interview_questions WHERE session_id IN (SELECT id FROM interview_sessions WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await c.query(`DELETE FROM interview_sessions WHERE organization_id = $1`, [ORG_ID]);

    await c.query('COMMIT');
    console.log('[odkrycie] reset: dane D2 dla northwind skasowane (tools katalog globalny nietknięty).');
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  }
}

// Uruchom `main()` TYLKO gdy plik jest wywołany bezpośrednio (`tsx
// 02-odkrycie.ts …`), nie gdy jest importowany (np. przez testy vitest, które
// importują same dane WYWIADY/NARZEDZIA/WNIOSKI/OSIE_DRD/DRD_OBSZARY_39 bez
// bazy — `import.meta.url` porównane z `process.argv[1]` to standardowy ESM
// odpowiednik `require.main === module`). Bez tej strażniczki import samych
// danych do testu odpaliłby cały CLI (i zakończył proces testowy błędem
// braku `--dry-run/--apply/…`).
const wywolanyBezposrednio = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}`;
  } catch {
    return false;
  }
})();
if (wywolanyBezposrednio) {
  main().catch((err) => {
    console.error('[odkrycie] BŁĄD:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
