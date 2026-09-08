#!/usr/bin/env tsx
/**
 * D6 — MATERIALS + MEETINGS + CHAT + MY WORK — organizacja „Northwind
 * Manufacturing Ltd." (`northwind`)
 * (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D6, §3.1 wiersze
 * „Materials"/„Meeting"; zlecenie D6 — patrz DZIENNIK/zlecenie robotnika).
 *
 * Buduje, WSZYSTKO PO ANGIELSKU:
 *   - 4 dokumenty (`report_builder_reports` + `report_builder_sections`),
 *   - 2 talie prezentacji (`presentation_decks` + `presentation_cards`,
 *     treść budowana przez `buildDeckDocumentFromStructuredSlides` —
 *     KANONICZNY builder, ten sam kod co `POST /decks`/`from-template`,
 *     żeby `resolveDeckContentCoherence` (Materiały → slide count) zawsze
 *     się zgadzał),
 *   - 1 skoroszyt (`generated_workbooks`, bajty XLSX realne przez
 *     `buildWorkbookBuffer` — ten sam builder co `createCanonicalWorkbook`),
 *   - wpisy rejestru artefaktów `v8_output_artifacts` +
 *     `v8_artifact_origin_links` dla wszystkich 7 powyższych (ekran
 *     Materiałów czyta WYŁĄCZNIE rejestr — `artifactRegistryService.ts:3052`
 *     `listArtifactsForUser`/`GET /api/artifacts`),
 *   - 2 spotkania (`meetings` + `meeting_participants` + `meeting_notes`,
 *     moduł za flagą `VITE_MODULE_MEETINGS`, domyślnie OFF — dane są
 *     seedowane niezależnie od flagi),
 *   - 3 wątki czatu (`conversations` + `conversation_messages`, 3–4
 *     wiadomości każdy),
 *   - 6 zadań osobistych OWNER-a (`tasks`, `task_type='personal'`) +
 *     MATERIALIZACJA `canonical_inbox_items` (My Work czyta WYŁĄCZNIE
 *     skrzynkę — `my-work.routes.ts` `GET /inbox/canonical`; logika sekcji/
 *     priorytetu skopiowana 1:1 z `inboxService.ts:106-127`
 *     (`sectionForTask`/`priorityForItem`), bo produkcyjny materializator
 *     (`materializeInboxItems`) wymaga pełnego bootstrapu aplikacji
 *     (`DbPromise`/`getDatabase()`) — nie do odpalenia ze standalone
 *     skryptu bez uruchamiania serwera).
 *
 * UŻYCIE
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/06-materialy.ts --oczekiwany-host 54418 --dry-run
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/06-materialy.ts --oczekiwany-host 54418 --apply
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/06-materialy.ts --oczekiwany-host 54418 --verify
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/06-materialy.ts --oczekiwany-host 54418 --reset
 *
 * IDEMPOTENCJA: wszystkie id są UUIDv5 (`00-wspolne.ts:det`). `--apply`
 * wykonuje WSZYSTKIE INSERT-y wewnątrz JEDNEJ transakcji z
 * `ON CONFLICT ... DO NOTHING` per wiersz; `--dry-run` uruchamia DOKŁADNIE
 * te same instrukcje i ROLLBACK-uje zamiast COMMIT — plan dry-run i
 * rzeczywisty apply nie mogą się rozjechać, bo to ten sam kod.
 *
 * ZALEŻNOŚĆ: wymaga `01-rdzen.ts --apply` (9 osób organizacji `northwind`,
 * w tym OWNER `james.whitfield@northwind.example`, właściciel wszystkich
 * 6 zadań osobistych tej paczki).
 *
 * `--reset` kasuje WYŁĄCZNIE wiersze utworzone przez TĘ paczkę (adresowane
 * po deterministycznych id) — nie rusza organizacji, osób ani innych paczek
 * (D2-D5), które współdzielą `organization_id='northwind'`.
 */
import { createHash } from 'node:crypto';

import type { PoolClient } from 'pg';

import {
  buildDeckDocumentFromStructuredSlides,
  type StructuredSlideInput,
} from '../../../src/services/presentationDeckDocumentService.js';
import { buildWorkbookBuffer } from '../../../src/services/workbook/WorkbookBuilder.js';
import type { WorkbookSchema } from '../../../src/services/workbook/WorkbookSchema.js';

import {
  DOMENA,
  Licznik,
  ORG_ID,
  czytajWspolneArgumenty,
  det,
  otworzPool,
  sprawdzCel,
  wymaganyUrl,
} from './00-wspolne';

const emailOsoby = (slug: string) => `${slug}@${DOMENA}`;
const uid = (slug: string) => det('user', emailOsoby(slug));

// Autorzy — z 01-rdzen.ts OSOBY (nie importujemy tamtego pliku, żeby nie
// ciągnąć jego CLI/main(); slugi/e-maile są tą samą, ustaloną listą 9 osób).
const OWNER = 'james.whitfield'; // OWNER — właściciel 6 zadań osobistych tej paczki

// ============================================================================
// 1) DOKUMENTY — 4 × report_builder_reports + report_builder_sections
// ============================================================================
type DocSection = { key: string; type: string; title: string; content: string };
type Doc = {
  slug: string;
  title: string;
  reportType: string;
  authorSlug: string;
  description: string;
  sections: DocSection[];
};

const DOCUMENTS: Doc[] = [
  {
    slug: 'operational-excellence-charter',
    title: 'Operational Excellence Charter',
    reportType: 'charter',
    authorSlug: OWNER,
    description: 'Founding charter for the Northwind 2027 operational excellence programme.',
    sections: [
      {
        key: 'purpose',
        type: 'cover',
        title: 'Purpose & Mandate',
        content:
          '# Purpose & Mandate\n\nThe Operational Excellence Charter establishes the mandate for the **Northwind 2027** ' +
          'transformation programme across the Leeds and Rotherham plants. The programme exists to reduce unplanned ' +
          'downtime by 30% and cut warehouse handling cost per unit by 20% by the end of 2027, without compromising ' +
          'product quality or employee safety.\n\nSponsor: James Whitfield, Operations Director. This charter is the ' +
          'reference document for scope, governance and success measures for every initiative under the programme.',
      },
      {
        key: 'scope',
        type: 'list',
        title: 'Scope',
        content:
          '## In scope\n\n- Warehouse automation (Leeds distribution centre)\n- Predictive maintenance rollout ' +
          '(both plants)\n- Supplier risk management and quality gates\n- Digital work instructions and the ' +
          'Rotherham Line 3 digital twin pilot\n\n## Out of scope\n\n- Finance system replacement\n- New product ' +
          'development\n- Sites outside Leeds and Rotherham',
      },
      {
        key: 'governance',
        type: 'custom',
        title: 'Governance & Roles',
        content:
          '## Governance\n\nA monthly Steering Committee (Operations Director, Plant Manager, Head of Quality, ' +
          'Finance Controller) reviews programme status and clears cross-functional blockers. A weekly PMO review ' +
          'tracks task-level progress and risk. Every initiative in `IN_EXECUTION` carries a named execution owner ' +
          'and a linked project.',
      },
      {
        key: 'success-measures',
        type: 'recommendations',
        title: 'Success Measures',
        content:
          '## Success measures\n\n1. Unplanned downtime down 30% vs. FY2025 baseline\n2. Warehouse handling cost ' +
          'per unit down 20%\n3. Zero increase in recordable safety incidents\n4. 80% of shopfloor roles using ' +
          'digital work instructions by end of 2027',
      },
    ],
  },
  {
    slug: 'oee-baseline-report-q2-2026',
    title: 'OEE Baseline Report Q2 2026',
    reportType: 'baseline_report',
    authorSlug: 'michael.grant',
    description: 'Overall Equipment Effectiveness baseline across Leeds and Rotherham for Q2 2026.',
    sections: [
      {
        key: 'executive-summary',
        type: 'summary',
        title: 'Executive Summary',
        content:
          '# Executive Summary\n\nQ2 2026 blended OEE across both plants is **61.4%**, against a world-class ' +
          'benchmark of 85%. Availability losses (unplanned stoppages and changeovers) are the single largest ' +
          'contributor, ahead of performance and quality losses. Line 3 at Rotherham is the weakest line at 52.8% ' +
          'OEE and is the primary target for the predictive maintenance and digital twin pilots.',
      },
      {
        key: 'methodology',
        type: 'methodology',
        title: 'Methodology',
        content:
          '## Methodology\n\nOEE = Availability × Performance × Quality, calculated from shift-level production ' +
          'logs across 6 production lines (4 in Leeds, 2 in Rotherham) for the 13 weeks of Q2 2026. Planned ' +
          'maintenance windows are excluded from the availability denominator.',
      },
      {
        key: 'findings',
        type: 'axis_analysis',
        title: 'Findings by Line',
        content:
          '## Findings by line\n\n| Line | Availability | Performance | Quality | OEE |\n|---|---:|---:|---:|---:|\n' +
          '| Leeds L1 | 78% | 88% | 98% | 67.2% |\n| Leeds L2 | 74% | 85% | 97% | 61.0% |\n' +
          '| Rotherham L3 | 68% | 82% | 95% | 52.8% |\n| Rotherham L4 | 81% | 90% | 98% | 71.4% |\n\n' +
          'Rotherham Line 3 loses the most availability to unplanned stoppages — 34% of all Q2 downtime minutes ' +
          'across the two plants.',
      },
      {
        key: 'recommendations',
        type: 'recommendations',
        title: 'Recommendations',
        content:
          '## Recommendations\n\n1. Prioritise the predictive maintenance rollout on Rotherham Line 3\n' +
          '2. Validate the digital twin pilot against this baseline before scaling to other lines\n' +
          '3. Re-baseline OEE quarterly so the steering committee can track programme impact',
      },
    ],
  },
  {
    slug: 'supplier-quality-gate-procedure',
    title: 'Supplier Quality Gate Procedure',
    reportType: 'procedure',
    authorSlug: 'robert.chen',
    description: 'Quality gate criteria and escalation path for incoming supplier components.',
    sections: [
      {
        key: 'purpose',
        type: 'cover',
        title: 'Purpose',
        content:
          '# Purpose\n\nThis procedure defines the quality gate every incoming supplier lot must clear before it ' +
          'is released to production at Leeds or Rotherham, and the escalation path when a lot fails.',
      },
      {
        key: 'gate-criteria',
        type: 'list',
        title: 'Gate Criteria',
        content:
          '## Gate criteria\n\n- Certificate of conformance present and matches the purchase order\n' +
          '- Dimensional sample (n=5) within tolerance on all critical-to-quality dimensions\n' +
          '- Defect rate on the incoming sample below 0.5%\n' +
          '- No open corrective action request against the supplier for the same defect class',
      },
      {
        key: 'escalation',
        type: 'custom',
        title: 'Escalation Path',
        content:
          '## Escalation path\n\n1. Quality technician quarantines the lot and logs the failure\n' +
          '2. Head of Quality reviews within 1 business day\n' +
          '3. Supplier is issued a corrective action request with a 10-business-day response window\n' +
          '4. Repeat failure within 90 days escalates to the Steering Committee as a supplier risk item',
      },
      {
        key: 'roles',
        type: 'list',
        title: 'Roles & Responsibilities',
        content:
          '## Roles & responsibilities\n\n- **Quality technician** — inbound inspection and quarantine\n' +
          '- **Head of Quality** — gate decision and corrective action issuance\n' +
          '- **Production Planner** — reschedules production around quarantined lots',
      },
    ],
  },
  {
    slug: 'digital-roadmap-2026-2028',
    title: 'Digital Roadmap 2026–2028',
    reportType: 'roadmap',
    authorSlug: 'daniel.osei',
    description: 'Three-year digital and automation roadmap for Leeds and Rotherham.',
    sections: [
      {
        key: 'vision',
        type: 'cover',
        title: 'Vision',
        content:
          '# Vision\n\nBy the end of 2028, every shopfloor role at Leeds and Rotherham works from digital work ' +
          'instructions, every critical asset is covered by predictive maintenance, and Rotherham Line 3 runs a ' +
          'validated digital twin used for what-if planning ahead of every changeover.',
      },
      {
        key: 'horizons',
        type: 'axis_analysis',
        title: 'Roadmap by Horizon',
        content:
          '## Roadmap by horizon\n\n**2026** — Digital work instructions pilot (2 lines); Line 3 digital twin pilot; ' +
          'predictive maintenance sensors on critical assets.\n\n**2027** — Digital work instructions to 80% of ' +
          'shopfloor roles; predictive maintenance rollout across both plants; warehouse automation wave 1 live.\n\n' +
          '**2028** — Digital twin extended to 2 additional lines; closed-loop quality data from supplier gate ' +
          'through to shopfloor.',
      },
      {
        key: 'investment',
        type: 'matrix',
        title: 'Investment Summary',
        content:
          '## Investment summary\n\n| Workstream | 2026 | 2027 | 2028 |\n|---|---:|---:|---:|\n' +
          '| Digital work instructions | £120k | £180k | £60k |\n| Predictive maintenance | £340k | £260k | £80k |\n' +
          '| Digital twin | £210k | £90k | £140k |',
      },
      {
        key: 'risks',
        type: 'list',
        title: 'Risks & Dependencies',
        content:
          '## Risks & dependencies\n\n- Shopfloor Wi-Fi coverage must be upgraded at Rotherham before the digital ' +
          'twin pilot can scale\n- Predictive maintenance sensor lead times run 8-10 weeks\n' +
          '- Depends on the warehouse automation wave 1 business case being approved',
      },
    ],
  },
];

// ============================================================================
// 2) PREZENTACJE — 2 × presentation_decks (treść przez kanoniczny builder)
// ============================================================================
type Deck = {
  slug: string;
  title: string;
  deckType: string;
  authorSlug: string;
  goal: string;
  slides: StructuredSlideInput[];
};

const DECKS: Deck[] = [
  {
    slug: 'steering-committee-september-2026',
    title: 'Steering Committee — September 2026',
    deckType: 'steering',
    authorSlug: OWNER,
    goal: 'Monthly programme status and decisions for the Northwind 2027 Steering Committee.',
    slides: [
      { type: 'title', content: { title: 'Steering Committee', subtitle: 'Northwind 2027 — September 2026' } },
      {
        type: 'content',
        content: {
          title: 'Programme Status',
          items: [
            'Blended OEE up 2.1pt vs. Q2 baseline (61.4% → 63.5%)',
            'Warehouse Automation Wave 1 on track for Leeds go-live in November',
            'Predictive Maintenance sensors installed on 60% of critical assets',
          ],
        },
      },
      {
        type: 'content',
        content: {
          title: 'Warehouse Automation Update',
          body: 'Conveyor and pick-to-light installation is complete on 2 of 4 zones. Operator training starts week of 21 September.',
        },
      },
      {
        type: 'content',
        content: {
          title: 'Predictive Maintenance Update',
          body: 'Rotherham Line 3 sensors are live and streaming vibration data. First predictive alert caught a bearing failure 9 days before it would have stopped the line.',
        },
      },
      {
        type: 'content',
        content: {
          title: 'Risks & Decisions Needed',
          items: [
            'Shopfloor Wi-Fi upgrade at Rotherham is 3 weeks behind — needed before digital twin pilot can scale',
            'Decision needed: approve Energy Efficiency Programme budget (£410k) — see Digital Roadmap',
          ],
        },
      },
      {
        type: 'next_steps',
        content: {
          title: 'Next Steps',
          items: [
            'Confirm Rotherham Wi-Fi upgrade timeline by 20 September',
            'Steering Committee decision on Energy Efficiency Programme budget',
            'Next review: 8 October 2026',
          ],
        },
      },
    ],
  },
  {
    slug: 'line3-mes-rollout-kickoff',
    title: 'Line 3 MES Rollout Kick-off',
    deckType: 'kickoff',
    authorSlug: 'daniel.osei',
    goal: 'Kick-off briefing for the Rotherham Line 3 manufacturing execution system rollout.',
    slides: [
      { type: 'title', content: { title: 'Line 3 MES Rollout', subtitle: 'Kick-off — Rotherham' } },
      {
        type: 'content',
        content: {
          title: 'Why Now',
          body: 'Line 3 is the lowest-OEE line at 52.8% and the target line for the digital twin pilot. A manufacturing execution system gives the real-time data the twin needs to be useful.',
        },
      },
      {
        type: 'content',
        content: {
          title: 'Scope & Timeline',
          items: [
            'Phase 1 (Oct-Nov 2026): machine connectivity and OEE dashboards',
            'Phase 2 (Dec 2026-Jan 2027): digital work instructions on Line 3',
            'Phase 3 (Feb 2027): digital twin integration',
          ],
        },
      },
      {
        type: 'content',
        content: {
          title: 'Team & RACI',
          items: [
            'Accountable: Daniel Osei, Automation Engineer',
            'Responsible: Laura Novak, Controls Engineer',
            'Consulted: Sarah Mitchell, Plant Manager',
            'Informed: Steering Committee',
          ],
        },
      },
      {
        type: 'content',
        content: {
          title: 'Success Criteria',
          items: [
            'Real-time OEE dashboard live on Line 3 by end of Phase 1',
            'Zero unplanned MES downtime during Phase 1-2 cutover',
          ],
        },
      },
      {
        type: 'next_steps',
        content: {
          title: 'Next Steps',
          items: ['Finalise machine connectivity vendor by 25 September', 'Phase 1 kickoff: 1 October 2026'],
        },
      },
    ],
  },
];

// ============================================================================
// 3) SKOROSZYT — 1 × generated_workbooks (bajty realne przez WorkbookBuilder)
// ============================================================================
const WORKBOOK_SLUG = 'scrap-cost-model';
const WORKBOOK_TITLE = 'Scrap Cost Model';

function buildScrapCostModelSchema(): WorkbookSchema {
  const months = ['Apr-26', 'May-26', 'Jun-26', 'Jul-26', 'Aug-26', 'Sep-26'];
  const lines = [
    { name: 'Leeds L1', unitCost: 4.2, scrapUnits: [820, 780, 910, 760, 700, 650] },
    { name: 'Leeds L2', unitCost: 5.1, scrapUnits: [640, 700, 590, 610, 580, 560] },
    { name: 'Rotherham L3', unitCost: 6.8, scrapUnits: [1210, 1340, 1180, 1290, 1150, 1080] },
    { name: 'Rotherham L4', unitCost: 4.9, scrapUnits: [510, 480, 520, 470, 440, 430] },
  ];

  const assumptionsRows = [
    { cells: { key: { value: 'Assumption' }, value: { value: 'Value' } }, isHeader: true },
    { cells: { key: { value: 'Reporting currency' }, value: { value: 'GBP' } } },
    { cells: { key: { value: 'Baseline period' }, value: { value: 'Apr-26 to Sep-26' } } },
    { cells: { key: { value: 'Scrap unit cost source' }, value: { value: 'Standard cost, Q2 2026 revision' } } },
  ];

  const dataColumns = [
    { key: 'line', header: 'Production Line', type: 'text' as const },
    ...months.map((m) => ({ key: m, header: m, type: 'currency' as const, numberFormat: '#,##0' })),
    { key: 'total', header: 'Total Scrap Cost', type: 'currency' as const, numberFormat: '#,##0' },
  ];

  const dataRows = lines.map((line) => {
    const cells: Record<string, { value?: number | string; formula?: string }> = {
      line: { value: line.name },
    };
    const colLetters = months.map((_, i) => String.fromCharCode('B'.charCodeAt(0) + i));
    months.forEach((m, i) => {
      cells[m] = { value: Math.round(line.scrapUnits[i]! * line.unitCost) };
    });
    const rowIndex = lines.indexOf(line) + 2; // +1 header, +1 for 1-based Excel rows
    cells.total = { formula: `SUM(${colLetters[0]}${rowIndex}:${colLetters[colLetters.length - 1]}${rowIndex})` };
    return { cells };
  });

  return {
    title: WORKBOOK_TITLE,
    description: 'Monthly scrap cost by production line, Leeds and Rotherham, Apr-Sep 2026.',
    author: 'Northwind Manufacturing Ltd.',
    sheets: [
      { name: 'Assumptions', purpose: 'Model assumptions', columns: [
        { key: 'key', header: 'Assumption', type: 'text' },
        { key: 'value', header: 'Value', type: 'text' },
      ], rows: assumptionsRows, isAssumptions: true },
      {
        name: 'Scrap Cost by Line',
        purpose: 'Monthly scrap cost by production line',
        columns: dataColumns,
        rows: dataRows,
        freezeRow: 1,
        freezeCol: 1,
        autoFilter: true,
      },
    ],
  };
}

// ============================================================================
// 4) SPOTKANIA — 2 × meetings + meeting_participants + meeting_notes
// ============================================================================
type MeetingParticipant = { slug: string; role: 'organizer' | 'attendee' | 'optional' };
type Meeting = {
  slug: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  organizerSlug: string;
  participants: MeetingParticipant[];
  agenda: string[];
  summary: string;
  keyPoints: string[];
  decisions: { decision: string; decidedBy?: string }[];
  actionItems: { task: string; owner?: string; deadline?: string; priority?: 'low' | 'medium' | 'high' }[];
};

const MEETINGS: Meeting[] = [
  {
    slug: 'weekly-pmo-review-20260902',
    title: 'Weekly PMO Review',
    startAt: '2026-09-02T09:00:00.000Z',
    endAt: '2026-09-02T09:45:00.000Z',
    location: 'Leeds — Meeting Room 2 / Teams',
    organizerSlug: OWNER,
    participants: [
      { slug: OWNER, role: 'organizer' },
      { slug: 'sarah.mitchell', role: 'attendee' },
      { slug: 'emily.carter', role: 'attendee' },
      { slug: 'michael.grant', role: 'attendee' },
    ],
    agenda: [
      'Review task-level progress on Warehouse Automation Wave 1',
      'Predictive Maintenance sensor install status',
      'Blockers and escalations',
    ],
    summary:
      'Weekly PMO check-in on the Northwind 2027 programme. Warehouse Automation Wave 1 is on track; predictive ' +
      'maintenance sensor installation reached 60% of critical assets. One blocker raised on the Rotherham Wi-Fi ' +
      'upgrade.',
    keyPoints: [
      'Warehouse Automation Wave 1 conveyor install complete on 2 of 4 zones',
      'Predictive maintenance sensors live on 60% of critical assets',
      'Rotherham Wi-Fi upgrade is 3 weeks behind schedule',
    ],
    decisions: [{ decision: 'Escalate the Rotherham Wi-Fi upgrade delay to the Steering Committee', decidedBy: OWNER }],
    actionItems: [
      { task: 'Get a revised Wi-Fi upgrade timeline from the site contractor', owner: 'sarah.mitchell', deadline: '2026-09-09', priority: 'high' },
      { task: 'Prepare sensor coverage summary for the Steering Committee', owner: 'michael.grant', deadline: '2026-09-08', priority: 'medium' },
    ],
  },
  {
    slug: 'steering-committee-20260904',
    title: 'Steering Committee',
    startAt: '2026-09-04T14:00:00.000Z',
    endAt: '2026-09-04T15:30:00.000Z',
    location: 'Leeds — Boardroom / Teams',
    organizerSlug: OWNER,
    participants: [
      { slug: OWNER, role: 'organizer' },
      { slug: 'sarah.mitchell', role: 'attendee' },
      { slug: 'robert.chen', role: 'attendee' },
      { slug: 'thomas.baker', role: 'attendee' },
    ],
    agenda: [
      'Programme status against the Northwind 2027 Charter',
      'Energy Efficiency Programme budget approval',
      'Supplier quality gate escalations',
    ],
    summary:
      'Monthly Steering Committee. Programme is tracking to the Charter success measures. The committee approved ' +
      'the Energy Efficiency Programme budget and reviewed one open supplier quality escalation.',
    keyPoints: [
      'Blended OEE up 2.1pt vs. Q2 baseline',
      'Energy Efficiency Programme budget of £410k approved',
      'One supplier (St Albans Fasteners) has an open corrective action request',
    ],
    decisions: [
      { decision: 'Approve the Energy Efficiency Programme budget of £410,000', decidedBy: OWNER },
      { decision: 'Keep the St Albans Fasteners corrective action open pending the next incoming lot', decidedBy: 'robert.chen' },
    ],
    actionItems: [
      { task: 'Register the Energy Efficiency Programme for execution planning', owner: OWNER, deadline: '2026-09-11', priority: 'high' },
      { task: 'Follow up with St Albans Fasteners on corrective action response', owner: 'robert.chen', deadline: '2026-09-14', priority: 'medium' },
    ],
  },
];

// ============================================================================
// 5) CZAT — 3 × conversations + conversation_messages
// ============================================================================
type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ChatThread = { slug: string; title: string; ownerSlug: string; createdAt: string; messages: ChatMessage[] };

const CHAT_THREADS: ChatThread[] = [
  {
    slug: 'oee-losses-line3',
    title: 'Where are we losing OEE on Line 3?',
    ownerSlug: OWNER,
    createdAt: '2026-08-20T10:15:00.000Z',
    messages: [
      { role: 'user', content: 'Line 3 at Rotherham is our worst OEE line at 52.8%. Where is most of the loss coming from — availability, performance, or quality?' },
      { role: 'assistant', content: 'Based on the Q2 2026 OEE baseline, availability is the biggest gap on Line 3: 68% availability vs. 78-81% on the other lines. Unplanned stoppages account for roughly 34% of all downtime minutes across both plants, concentrated on Line 3.' },
      { role: 'user', content: 'That matches what maintenance has been telling us. Is the predictive maintenance rollout targeting Line 3 first?' },
      { role: 'assistant', content: 'Yes — Line 3 sensors are already live and streaming vibration data as of this month. The first predictive alert caught a bearing failure 9 days before it would have caused an unplanned stop.' },
    ],
  },
  {
    slug: 'supplier-defect-trend-st-albans',
    title: 'Supplier defect trend — St Albans Fasteners',
    ownerSlug: OWNER,
    createdAt: '2026-08-28T13:40:00.000Z',
    messages: [
      { role: 'user', content: 'Can you summarise the quality gate history for St Albans Fasteners over the last quarter?' },
      { role: 'assistant', content: 'St Albans Fasteners has one open corrective action request from the current quarter — a dimensional tolerance failure on an incoming fastener lot. No repeat failure of the same defect class has been logged yet within the 90-day escalation window.' },
      { role: 'user', content: 'Good — hold it open until the next incoming lot clears the gate, and flag it to me if it fails again.' },
      { role: 'assistant', content: 'Understood. I will keep the corrective action open and flag it to you immediately if the next St Albans Fasteners lot fails the quality gate on the same defect class — that would trigger the Steering Committee escalation.' },
    ],
  },
  {
    slug: 'shift-handover-weekend-coverage',
    title: 'Shift handover notes — weekend coverage',
    ownerSlug: OWNER,
    createdAt: '2026-09-05T07:05:00.000Z',
    messages: [
      { role: 'user', content: 'Summarise anything unusual from the weekend shift handover notes across both plants.' },
      { role: 'assistant', content: 'Nothing flagged as a safety incident. Leeds L2 had a 40-minute unplanned stop on Saturday night (changeover fault, resolved by the on-call technician). Rotherham ran without incident across both weekend shifts.' },
      { role: 'user', content: 'Thanks. Make sure the Leeds L2 stop is logged against this week\'s downtime numbers before the PMO review.' },
    ],
  },
];

// ============================================================================
// 6) ZADANIA OSOBISTE OWNER-a — 6 × tasks (task_type='personal') + inbox
// ============================================================================
type PersonalTask = {
  slug: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string; // YYYY-MM-DD
};

// "Dziś" dla tej paczki (patrz DZIENNIK/system) = 2026-09-08. Dwa zadania
// poniżej mają termin przed tą datą — celowo, żeby skrzynka pokazała sekcję
// "overdue" (sectionForTask, kopia inboxService.ts:106-112).
const PERSONAL_TASKS: PersonalTask[] = [
  {
    slug: 'approve-q3-capex-request',
    title: 'Approve Q3 capex request',
    description: 'Sign off the Q3 capital expenditure request covering the predictive maintenance sensor rollout.',
    status: 'todo',
    priority: 'high',
    dueDate: '2026-08-25',
  },
  {
    slug: 'follow-up-rotherham-downtime-log',
    title: 'Follow up with Rotherham plant manager on downtime log',
    description: 'Chase the completed Line 3 downtime log for the Q2 OEE baseline reconciliation.',
    status: 'todo',
    priority: 'medium',
    dueDate: '2026-09-02',
  },
  {
    slug: 'sign-off-line3-mes-kickoff-deck',
    title: 'Sign off Line 3 MES kickoff deck',
    description: 'Review and approve the Line 3 MES Rollout Kick-off deck before it goes to the wider team.',
    status: 'in_progress',
    priority: 'high',
    dueDate: '2026-09-10',
  },
  {
    slug: 'review-supplier-corrective-action-plan',
    title: 'Review supplier corrective action plan',
    description: 'Review the St Albans Fasteners corrective action response once it arrives.',
    status: 'todo',
    priority: 'medium',
    dueDate: '2026-09-12',
  },
  {
    slug: 'draft-steering-committee-opening-remarks',
    title: 'Draft opening remarks for steering committee',
    description: 'Draft the opening remarks for the October Steering Committee, covering programme status against the Charter.',
    status: 'todo',
    priority: 'medium',
    dueDate: '2026-09-18',
  },
  {
    slug: 'prepare-board-pack-october-review',
    title: 'Prepare board pack for October review',
    description: 'Assemble the October board pack: programme status, OEE trend, and the Energy Efficiency Programme budget update.',
    status: 'todo',
    priority: 'low',
    dueDate: '2026-09-30',
  },
];

// ---------------------------------------------------------------------------
// sectionForTask/priorityForItem — kopia 1:1 z server/src/services/inboxService.ts
// (linie ~106-127), dopasowana do naszego zamkniętego zbioru 6 zadań (brak
// blokad — isBlocked zawsze false w tej paczce).
// ---------------------------------------------------------------------------
function sectionForTask(status: string, dueDate: string, today: string): string {
  const s = status.toLowerCase();
  if (s === 'done' || s === 'completed' || s === 'validated') return 'assigned_tasks';
  if (dueDate && dueDate < today) return 'overdue_sla_breach';
  return 'assigned_tasks';
}

function priorityForItem(raw: string): 'critical' | 'high' | 'normal' | 'low' {
  const p = raw.toLowerCase();
  if (p === 'urgent' || p === 'critical') return 'critical';
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'normal';
}

const TODAY = '2026-09-08';

// ============================================================================
// Rejestr artefaktów — wspólny helper dla dokumentów/talii/skoroszytu
// ============================================================================
type ArtifactFamily = 'document' | 'presentation' | 'sheet';
type OutputType = 'report' | 'presentation' | 'sheet';
type OriginRuntime = 'report' | 'presentation' | 'sheet';

async function registerArtifact(
  c: PoolClient,
  params: {
    originRuntime: OriginRuntime;
    originRecordId: string;
    outputType: OutputType;
    artifactFamily: ArtifactFamily;
    titleSnapshot: string;
    ownerUserId: string;
    createdBy: string;
    deliveryState: string;
  }
): Promise<number> {
  const artifactId = det('artifact', `${params.originRuntime}|${params.originRecordId}`);
  const now = new Date().toISOString();
  let inserted = 0;

  const r1 = await c.query(
    `INSERT INTO v8_output_artifacts (
       artifact_id, organization_id, output_type, artifact_family, delivery_state,
       title_snapshot, owner_user_id, canonical_home, visibility_scope, created_by,
       created_at, last_transition_at, is_draft
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'outputs_library','organization',$8,$9,$9,0)
     ON CONFLICT (artifact_id) DO NOTHING`,
    [
      artifactId,
      ORG_ID,
      params.outputType,
      params.artifactFamily,
      params.deliveryState,
      params.titleSnapshot,
      params.ownerUserId,
      params.createdBy,
      now,
    ]
  );
  inserted += r1.rowCount ?? 0;

  const linkId = det('artifact-link', `${params.originRuntime}|${params.originRecordId}`);
  const r2 = await c.query(
    `INSERT INTO v8_artifact_origin_links (
       link_id, artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin, created_at
     ) VALUES ($1,$2,$3,$4,$5,1,$6)
     ON CONFLICT (organization_id, origin_runtime, origin_record_id) DO NOTHING`,
    [linkId, artifactId, ORG_ID, params.originRuntime, params.originRecordId, now]
  );
  inserted += r2.rowCount ?? 0;

  return inserted;
}

// ============================================================================
// Zapis — WSZYSTKO w jednej transakcji; dry-run = ROLLBACK, apply = COMMIT.
// Dzięki temu plan (dry-run) i wykonanie (apply) to dosłownie ten sam kod.
// ============================================================================
async function wykonaj(c: PoolClient, commit: boolean): Promise<Licznik> {
  const lic = new Licznik();
  const now = new Date().toISOString();

  await c.query('BEGIN');
  try {
    // --- 1) Dokumenty -----------------------------------------------------
    for (const doc of DOCUMENTS) {
      const docId = det('report', doc.slug);
      const authorId = uid(doc.authorSlug);
      const r = await c.query(
        `INSERT INTO report_builder_reports (
           id, organization_id, source_type, source_id, source_name, title, description,
           report_type, status, created_by, created_at, updated_at, generated_at, approved_at, approved_by
         ) VALUES ($1,$2,'WORK_CANVAS',$3,$4,$5,$6,$7,'APPROVED',$8,$9,$9,$9,$9,$8)
         ON CONFLICT (id) DO NOTHING`,
        [
          docId,
          ORG_ID,
          `northwind-demo-2026-doc-${doc.slug}`,
          doc.title,
          doc.title,
          doc.description,
          doc.reportType,
          authorId,
          now,
        ]
      );
      if ((r.rowCount ?? 0) > 0) lic.utworz();
      else lic.pomin();

      let orderIndex = 0;
      for (const section of doc.sections) {
        const sectionId = det('report-section', `${doc.slug}|${section.key}`);
        const rs = await c.query(
          `INSERT INTO report_builder_sections (
             id, report_id, section_key, section_type, title, order_index, enabled, required,
             length, language, generated_content, edited_content, content_format,
             generation_model, generated_at, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,true,false,'medium','business',$7,$7,'markdown','seed-d6',$8,$8,$8)
           ON CONFLICT (report_id, section_key) DO NOTHING`,
          [sectionId, docId, section.key, section.type, section.title, orderIndex, section.content, now]
        );
        if ((rs.rowCount ?? 0) > 0) lic.utworz();
        else lic.pomin();
        orderIndex += 1;
      }

      const insertedArtifact = await registerArtifact(c, {
        originRuntime: 'report',
        originRecordId: docId,
        outputType: 'report',
        artifactFamily: 'document',
        titleSnapshot: doc.title,
        ownerUserId: authorId,
        createdBy: authorId,
        deliveryState: 'ready',
      });
      if (insertedArtifact > 0) lic.utworz();
      else lic.pomin();
    }

    // --- 2) Prezentacje -----------------------------------------------------
    for (const deck of DECKS) {
      const deckId = det('deck', deck.slug);
      const authorId = uid(deck.authorSlug);
      const document = buildDeckDocumentFromStructuredSlides({
        deckId,
        organizationId: ORG_ID,
        title: deck.title,
        theme: 'corporate',
        slides: deck.slides,
        status: 'ready',
        createdBy: authorId,
      });
      const slideCount = document.cards.length;

      const r = await c.query(
        `INSERT INTO presentation_decks (
           id, organization_id, title, description, deck_type, goal, language, confidentiality,
           theme, presentation_mode, slide_count, status, source_type, source_id, deck_json,
           source_refs_json, version, generated_by, created_by, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,'en','internal','corporate','briefing',$7,'ready','manual',$8,$9,'[]',1,$10,$10,$11,$11)
         ON CONFLICT (id) DO NOTHING`,
        [
          deckId,
          ORG_ID,
          deck.title,
          deck.goal,
          deck.deckType,
          deck.goal,
          slideCount,
          `northwind-demo-2026-deck-${deck.slug}`,
          JSON.stringify(document),
          authorId,
          now,
        ]
      );
      if ((r.rowCount ?? 0) > 0) lic.utworz();
      else lic.pomin();

      for (const card of document.cards) {
        const rc = await c.query(
          `INSERT INTO presentation_cards (id, deck_id, card_index, intent, blocks_json, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$6)
           ON CONFLICT (id) DO NOTHING`,
          [card.card_id, deckId, card.order_index, card.intent, JSON.stringify(card.blocks), now]
        );
        if ((rc.rowCount ?? 0) > 0) lic.utworz();
        else lic.pomin();
      }

      const insertedArtifact = await registerArtifact(c, {
        originRuntime: 'presentation',
        originRecordId: deckId,
        outputType: 'presentation',
        artifactFamily: 'presentation',
        titleSnapshot: deck.title,
        ownerUserId: authorId,
        createdBy: authorId,
        deliveryState: 'ready',
      });
      if (insertedArtifact > 0) lic.utworz();
      else lic.pomin();
    }

    // --- 3) Skoroszyt -----------------------------------------------------
    {
      const workbookId = det('workbook', WORKBOOK_SLUG);
      const authorId = uid('thomas.baker'); // Finance Controller — właściciel modelu kosztów braków
      const schema = buildScrapCostModelSchema();
      const bytes = await buildWorkbookBuffer(schema);

      const r = await c.query(
        `INSERT INTO generated_workbooks (
           id, organization_id, title, description, prompt, schema_json, sheet_count, file_name,
           file_size, quality_score, classification, lifecycle_status, approval_current,
           created_by, created_at, version
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'internal','approved',1,$11,$12,1)
         ON CONFLICT (id) DO NOTHING`,
        [
          workbookId,
          ORG_ID,
          WORKBOOK_TITLE,
          schema.description,
          'northwind-demo-2026-workbook-scrap-cost-model',
          JSON.stringify(schema),
          schema.sheets.length,
          'Scrap_Cost_Model.xlsx',
          bytes.length,
          0.92,
          authorId,
          now,
        ]
      );
      if ((r.rowCount ?? 0) > 0) lic.utworz();
      else lic.pomin();

      const insertedArtifact = await registerArtifact(c, {
        originRuntime: 'sheet',
        originRecordId: workbookId,
        outputType: 'sheet',
        artifactFamily: 'sheet',
        titleSnapshot: WORKBOOK_TITLE,
        ownerUserId: authorId,
        createdBy: authorId,
        deliveryState: 'ready',
      });
      if (insertedArtifact > 0) lic.utworz();
      else lic.pomin();
    }

    // --- 4) Spotkania -------------------------------------------------------
    for (const meeting of MEETINGS) {
      const meetingId = det('meeting', meeting.slug);
      const organizerId = uid(meeting.organizerSlug);
      const attendeeEmails = meeting.participants.map((p) => emailOsoby(p.slug));

      const r = await c.query(
        `INSERT INTO meetings (
           id, organization_id, title, start_at, end_at, location, attendees_json, agenda_json,
           status, created_by, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'completed',$9,$10,$10)
         ON CONFLICT (id) DO NOTHING`,
        [
          meetingId,
          ORG_ID,
          meeting.title,
          meeting.startAt,
          meeting.endAt,
          meeting.location,
          JSON.stringify(attendeeEmails),
          JSON.stringify(meeting.agenda),
          organizerId,
          now,
        ]
      );
      if ((r.rowCount ?? 0) > 0) lic.utworz();
      else lic.pomin();

      for (const p of meeting.participants) {
        const participantId = det('meeting-participant', `${meeting.slug}|${p.slug}`);
        const personId = uid(p.slug);
        const rp = await c.query(
          `INSERT INTO meeting_participants (
             id, organization_id, meeting_id, participant_kind, user_id, display_name, role,
             invitation_status, delivery_status, responded_at, invited_by, created_at, updated_at
           ) VALUES ($1,$2,$3,'user',$4,$5,$6,'accepted','captured',$7,$8,$7,$7)
           ON CONFLICT (id) DO NOTHING`,
          [participantId, ORG_ID, meetingId, personId, p.slug, p.role, now, organizerId]
        );
        if ((rp.rowCount ?? 0) > 0) lic.utworz();
        else lic.pomin();
      }

      const noteId = det('meeting-note', meeting.slug);
      const transcriptHash = createHash('sha256').update(`northwind-demo-2026|${meeting.slug}`).digest('hex');
      const rn = await c.query(
        `INSERT INTO meeting_notes (
           id, organization_id, meeting_id, source, language, transcript_hash, summary,
           key_points_json, decisions_json, action_items_json, status, created_by, created_at, updated_at
         ) VALUES ($1,$2,$3,'heuristic','en',$4,$5,$6,$7,$8,'approved',$9,$10,$10)
         ON CONFLICT (id) DO NOTHING`,
        [
          noteId,
          ORG_ID,
          meetingId,
          transcriptHash,
          meeting.summary,
          JSON.stringify(meeting.keyPoints),
          JSON.stringify(meeting.decisions),
          JSON.stringify(
            meeting.actionItems.map((a) => ({ ...a, owner: a.owner ? emailOsoby(a.owner) : undefined }))
          ),
          organizerId,
          now,
        ]
      );
      if ((rn.rowCount ?? 0) > 0) lic.utworz();
      else lic.pomin();
    }

    // --- 5) Czat --------------------------------------------------------------
    for (const thread of CHAT_THREADS) {
      const conversationId = det('conversation', thread.slug);
      const ownerId = uid(thread.ownerSlug);
      const rc = await c.query(
        `INSERT INTO conversations (
           id, user_id, organization_id, created_by, title, title_source, language,
           created_at, updated_at
         ) VALUES ($1,$2,$3,$2,$4,'user','en',$5,$5)
         ON CONFLICT (id) DO NOTHING`,
        [conversationId, ownerId, ORG_ID, thread.title, thread.createdAt]
      );
      if ((rc.rowCount ?? 0) > 0) lic.utworz();
      else lic.pomin();

      let seq = 1;
      let ts = new Date(thread.createdAt).getTime();
      for (const msg of thread.messages) {
        const messageId = det('chat-message', `${thread.slug}|${seq}`);
        const createdAt = new Date(ts).toISOString();
        const rm = await c.query(
          `INSERT INTO conversation_messages (
             id, conversation_id, role, content, message_type, author_user_id, seq, created_at
           ) VALUES ($1,$2,$3,$4,'text',$5,$6,$7)
           ON CONFLICT (id) DO NOTHING`,
          [messageId, conversationId, msg.role, msg.content, msg.role === 'user' ? ownerId : null, seq, createdAt]
        );
        if ((rm.rowCount ?? 0) > 0) lic.utworz();
        else lic.pomin();
        seq += 1;
        ts += 3 * 60 * 1000; // +3 min per message, realistyczny odstęp
      }
    }

    // --- 6) Zadania osobiste OWNER-a + materializacja skrzynki ---------------
    const ownerId = uid(OWNER);
    for (const task of PERSONAL_TASKS) {
      const taskId = det('task', task.slug);
      const rt = await c.query(
        `INSERT INTO tasks (
           id, organization_id, title, description, status, priority, assignee_id, reporter_id,
           due_date, task_type, created_by, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,'personal',$7,$9,$9)
         ON CONFLICT (id) DO NOTHING`,
        [taskId, ORG_ID, task.title, task.description, task.status, task.priority, ownerId, task.dueDate, now]
      );
      if ((rt.rowCount ?? 0) > 0) lic.utworz();
      else lic.pomin();

      // Materializacja skrzynki — logika 1:1 z inboxService.ts (sectionForTask/
      // priorityForItem), UPSERT na tym samym kluczu unikalności co produkcyjny
      // materializator: (user_id, source_entity_type, source_entity_id).
      const inboxId = det('inbox-item', `${ownerId}|task|${taskId}`);
      const section = sectionForTask(task.status, task.dueDate, TODAY);
      const priority = priorityForItem(task.priority);
      const ri = await c.query(
        `INSERT INTO canonical_inbox_items (
           id, user_id, organization_id, item_type, source_entity_type, source_entity_id,
           title, description, priority, section, status, sla_deadline, source_status,
           created_at, updated_at
         ) VALUES ($1,$2,$3,'task','task',$4,$5,$6,$7,$8,'pending',$9,$10,$11,$11)
         ON CONFLICT (user_id, source_entity_type, source_entity_id) DO NOTHING`,
        [inboxId, ownerId, ORG_ID, taskId, task.title, task.description, priority, section, task.dueDate, task.status, now]
      );
      if ((ri.rowCount ?? 0) > 0) lic.utworz();
      else lic.pomin();
    }

    if (commit) await c.query('COMMIT');
    else await c.query('ROLLBACK');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }

  return lic;
}

// ============================================================================
// Reset — kasuje WYŁĄCZNIE wiersze utworzone przez TĘ paczkę, adresowane po
// deterministycznych id (nie rusza organizacji, osób, D1-D5).
// ============================================================================
async function reset(c: PoolClient): Promise<void> {
  const docIds = DOCUMENTS.map((d) => det('report', d.slug));
  const deckIds = DECKS.map((d) => det('deck', d.slug));
  const workbookId = det('workbook', WORKBOOK_SLUG);
  const meetingIds = MEETINGS.map((m) => det('meeting', m.slug));
  const conversationIds = CHAT_THREADS.map((t) => det('conversation', t.slug));
  const taskIds = PERSONAL_TASKS.map((t) => det('task', t.slug));
  const ownerId = uid(OWNER);
  const artifactOriginRecordIds = [...docIds, ...deckIds, workbookId];

  await c.query('BEGIN');
  try {
    let usuniete = 0;

    for (const originRecordId of artifactOriginRecordIds) {
      const artifactId = det(
        'artifact',
        docIds.includes(originRecordId)
          ? `report|${originRecordId}`
          : deckIds.includes(originRecordId)
            ? `presentation|${originRecordId}`
            : `sheet|${originRecordId}`
      );
      usuniete += (
        await c.query('DELETE FROM v8_artifact_origin_links WHERE organization_id = $1 AND origin_record_id = $2', [
          ORG_ID,
          originRecordId,
        ])
      ).rowCount ?? 0;
      usuniete += (await c.query('DELETE FROM v8_output_artifacts WHERE artifact_id = $1', [artifactId])).rowCount ?? 0;
    }

    for (const docId of docIds) {
      usuniete += (await c.query('DELETE FROM report_builder_sections WHERE report_id = $1', [docId])).rowCount ?? 0;
      usuniete += (await c.query('DELETE FROM report_builder_reports WHERE id = $1', [docId])).rowCount ?? 0;
    }

    for (const deckId of deckIds) {
      usuniete += (await c.query('DELETE FROM presentation_cards WHERE deck_id = $1', [deckId])).rowCount ?? 0;
      usuniete += (await c.query('DELETE FROM presentation_decks WHERE id = $1', [deckId])).rowCount ?? 0;
    }

    usuniete += (await c.query('DELETE FROM generated_workbooks WHERE id = $1', [workbookId])).rowCount ?? 0;

    for (const meetingId of meetingIds) {
      usuniete += (await c.query('DELETE FROM meeting_notes WHERE meeting_id = $1', [meetingId])).rowCount ?? 0;
      usuniete += (await c.query('DELETE FROM meeting_participants WHERE meeting_id = $1', [meetingId])).rowCount ?? 0;
      usuniete += (await c.query('DELETE FROM meetings WHERE id = $1', [meetingId])).rowCount ?? 0;
    }

    for (const conversationId of conversationIds) {
      usuniete +=
        (await c.query('DELETE FROM conversation_messages WHERE conversation_id = $1', [conversationId])).rowCount ??
        0;
      usuniete += (await c.query('DELETE FROM conversations WHERE id = $1', [conversationId])).rowCount ?? 0;
    }

    for (const taskId of taskIds) {
      usuniete +=
        (
          await c.query(
            "DELETE FROM canonical_inbox_items WHERE user_id = $1 AND source_entity_type = 'task' AND source_entity_id = $2",
            [ownerId, taskId]
          )
        ).rowCount ?? 0;
      usuniete += (await c.query('DELETE FROM tasks WHERE id = $1', [taskId])).rowCount ?? 0;
    }

    await c.query('COMMIT');
    console.log(`[materialy] reset: usunięto ${usuniete} wierszy paczki D6 (organizacja "northwind" nietknięta).`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
}

// ============================================================================
// Verify — asercje twarde (== N), self-contained (nie wymaga 99-verify.ts).
// ============================================================================
type Asercja = { nazwa: string; oczekiwane: number; rzeczywiste: number };

async function verify(c: PoolClient): Promise<void> {
  const docIds = DOCUMENTS.map((d) => det('report', d.slug));
  const deckIds = DECKS.map((d) => det('deck', d.slug));
  const workbookId = det('workbook', WORKBOOK_SLUG);
  const meetingIds = MEETINGS.map((m) => det('meeting', m.slug));
  const conversationIds = CHAT_THREADS.map((t) => det('conversation', t.slug));
  const taskIds = PERSONAL_TASKS.map((t) => det('task', t.slug));
  const ownerId = uid(OWNER);

  const count = async (sql: string, params: unknown[]): Promise<number> => {
    const r = await c.query<{ n: string }>(sql, params);
    return Number(r.rows[0]?.n ?? 0);
  };

  const dokumenty = await count('SELECT COUNT(*)::int AS n FROM report_builder_reports WHERE id = ANY($1)', [docIds]);
  const sekcje = await count(
    'SELECT COUNT(*)::int AS n FROM report_builder_sections WHERE report_id = ANY($1)',
    [docIds]
  );
  const talie = await count('SELECT COUNT(*)::int AS n FROM presentation_decks WHERE id = ANY($1)', [deckIds]);
  const talieZeSlajdami = await count(
    "SELECT COUNT(*)::int AS n FROM presentation_decks WHERE id = ANY($1) AND slide_count > 0",
    [deckIds]
  );
  const karty = await count('SELECT COUNT(*)::int AS n FROM presentation_cards WHERE deck_id = ANY($1)', [deckIds]);
  const skoroszyty = await count('SELECT COUNT(*)::int AS n FROM generated_workbooks WHERE id = $1', [workbookId]);
  const artefakty = await count(
    `SELECT COUNT(*)::int AS n FROM v8_output_artifacts a
     JOIN v8_artifact_origin_links l ON l.artifact_id = a.artifact_id AND l.organization_id = a.organization_id
     WHERE a.organization_id = $1 AND l.origin_record_id = ANY($2)`,
    [ORG_ID, [...docIds, ...deckIds, workbookId]]
  );
  const spotkania = await count('SELECT COUNT(*)::int AS n FROM meetings WHERE id = ANY($1)', [meetingIds]);
  const uczestnicy = await count(
    'SELECT COUNT(*)::int AS n FROM meeting_participants WHERE meeting_id = ANY($1)',
    [meetingIds]
  );
  const notatki = await count('SELECT COUNT(*)::int AS n FROM meeting_notes WHERE meeting_id = ANY($1)', [meetingIds]);
  const watki = await count('SELECT COUNT(*)::int AS n FROM conversations WHERE id = ANY($1)', [conversationIds]);
  const wiadomosci = await count(
    'SELECT COUNT(*)::int AS n FROM conversation_messages WHERE conversation_id = ANY($1)',
    [conversationIds]
  );
  const zadania = await count(
    "SELECT COUNT(*)::int AS n FROM tasks WHERE id = ANY($1) AND task_type = 'personal' AND assignee_id = $2",
    [taskIds, ownerId]
  );
  const skrzynka = await count(
    "SELECT COUNT(*)::int AS n FROM canonical_inbox_items WHERE user_id = $1 AND source_entity_type = 'task' AND source_entity_id = ANY($2)",
    [ownerId, taskIds]
  );
  const skrzynkaOverdue = await count(
    "SELECT COUNT(*)::int AS n FROM canonical_inbox_items WHERE user_id = $1 AND source_entity_type = 'task' AND source_entity_id = ANY($2) AND section = 'overdue_sla_breach'",
    [ownerId, taskIds]
  );
  const spolskimi = await count(
    `SELECT COUNT(*)::int AS n FROM report_builder_reports WHERE id = ANY($1)
       AND title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'`,
    [docIds]
  );

  // Stan po --reset: WSZYSTKO musi być zerem (paczka D6 usunięta, organizacja
  // i D1-D5 nietknięte — nie sprawdzamy tu niczego poza D6). Rozstrzygamy po
  // `dokumenty === 0`, bo dokumenty są zawsze pierwszym wierszem zapisywanym
  // i kasowanym w tej paczce.
  if (dokumenty === 0) {
    const zestawReset: Asercja[] = [
      { nazwa: 'dokumenty (report_builder_reports)', oczekiwane: 0, rzeczywiste: dokumenty },
      { nazwa: 'sekcje dokumentów (report_builder_sections)', oczekiwane: 0, rzeczywiste: sekcje },
      { nazwa: 'talie prezentacji (presentation_decks)', oczekiwane: 0, rzeczywiste: talie },
      { nazwa: 'karty slajdów (presentation_cards)', oczekiwane: 0, rzeczywiste: karty },
      { nazwa: 'skoroszyty (generated_workbooks)', oczekiwane: 0, rzeczywiste: skoroszyty },
      { nazwa: 'wpisy w rejestrze artefaktów (v8_output_artifacts+link)', oczekiwane: 0, rzeczywiste: artefakty },
      { nazwa: 'spotkania (meetings)', oczekiwane: 0, rzeczywiste: spotkania },
      { nazwa: 'uczestnicy spotkań (meeting_participants)', oczekiwane: 0, rzeczywiste: uczestnicy },
      { nazwa: 'notatki ze spotkań (meeting_notes)', oczekiwane: 0, rzeczywiste: notatki },
      { nazwa: 'wątki czatu (conversations)', oczekiwane: 0, rzeczywiste: watki },
      { nazwa: 'wiadomości czatu (conversation_messages)', oczekiwane: 0, rzeczywiste: wiadomosci },
      { nazwa: 'zadania osobiste OWNER-a (tasks)', oczekiwane: 0, rzeczywiste: zadania },
      { nazwa: 'skrzynka OWNER-a (canonical_inbox_items)', oczekiwane: 0, rzeczywiste: skrzynka },
    ];
    console.log('[verify] stan: PO --reset (dokumenty=0) — oczekiwane WSZYSTKO=0.');
    wypiszIZakoncz(zestawReset);
    return;
  }

  const zestaw: Asercja[] = [
    { nazwa: 'dokumenty (report_builder_reports)', oczekiwane: DOCUMENTS.length, rzeczywiste: dokumenty },
    {
      nazwa: 'sekcje dokumentów (report_builder_sections)',
      oczekiwane: DOCUMENTS.reduce((n, d) => n + d.sections.length, 0),
      rzeczywiste: sekcje,
    },
    { nazwa: 'talie prezentacji (presentation_decks)', oczekiwane: DECKS.length, rzeczywiste: talie },
    { nazwa: 'talie ze slide_count > 0 (koherentne z deck_json)', oczekiwane: DECKS.length, rzeczywiste: talieZeSlajdami },
    { nazwa: 'karty slajdów (presentation_cards)', oczekiwane: DECKS.reduce((n, d) => n + d.slides.length, 0), rzeczywiste: karty },
    { nazwa: 'skoroszyty (generated_workbooks)', oczekiwane: 1, rzeczywiste: skoroszyty },
    { nazwa: 'wpisy w rejestrze artefaktów (v8_output_artifacts+link)', oczekiwane: DOCUMENTS.length + DECKS.length + 1, rzeczywiste: artefakty },
    { nazwa: 'spotkania (meetings)', oczekiwane: MEETINGS.length, rzeczywiste: spotkania },
    { nazwa: 'uczestnicy spotkań (meeting_participants)', oczekiwane: MEETINGS.reduce((n, m) => n + m.participants.length, 0), rzeczywiste: uczestnicy },
    { nazwa: 'notatki ze spotkań (meeting_notes)', oczekiwane: MEETINGS.length, rzeczywiste: notatki },
    { nazwa: 'wątki czatu (conversations)', oczekiwane: CHAT_THREADS.length, rzeczywiste: watki },
    { nazwa: 'wiadomości czatu (conversation_messages)', oczekiwane: CHAT_THREADS.reduce((n, t) => n + t.messages.length, 0), rzeczywiste: wiadomosci },
    { nazwa: 'zadania osobiste OWNER-a (tasks)', oczekiwane: PERSONAL_TASKS.length, rzeczywiste: zadania },
    { nazwa: 'skrzynka OWNER-a (canonical_inbox_items)', oczekiwane: PERSONAL_TASKS.length, rzeczywiste: skrzynka },
    {
      nazwa: 'skrzynka OWNER-a — sekcja overdue_sla_breach',
      oczekiwane: PERSONAL_TASKS.filter((t) => t.dueDate < TODAY).length,
      rzeczywiste: skrzynkaOverdue,
    },
    { nazwa: 'dokumenty z polskim znakiem w tytule (ma być 0)', oczekiwane: 0, rzeczywiste: spolskimi },
  ];

  wypiszIZakoncz(zestaw);
}

function wypiszIZakoncz(asercje: Asercja[]): void {
  let bledy = 0;
  for (const a of asercje) {
    const ok = a.oczekiwane === a.rzeczywiste;
    if (!ok) bledy++;
    console.log(`[verify] ${ok ? 'OK  ' : 'FAIL'} ${a.nazwa.padEnd(60)} oczekiwane=${a.oczekiwane} rzeczywiste=${a.rzeczywiste}`);
  }
  if (bledy > 0) {
    console.error(`\n[verify] FAIL: ${bledy} asercji nie przeszło.`);
    process.exitCode = 1;
  } else {
    console.log(`\n[verify] PASS: wszystkie ${asercje.length} asercji przeszły.`);
  }
}

// ============================================================================
// main
// ============================================================================
async function main() {
  const opcje = czytajWspolneArgumenty(process.argv.slice(2));
  const url = wymaganyUrl();
  const toz = sprawdzCel(url, opcje.oczekiwanyHost);
  const pool = otworzPool(url);
  const c = await pool.connect();

  try {
    console.log(`[materialy] cel:  ${toz}`);
    console.log(`[materialy] tryb: ${opcje.tryb}`);

    if (opcje.tryb === 'reset') {
      await reset(c);
      return;
    }
    if (opcje.tryb === 'verify') {
      await verify(c);
      return;
    }

    const org = await c.query('SELECT 1 FROM organizations WHERE id = $1', [ORG_ID]);
    if (org.rows.length === 0) {
      throw new Error(
        `Organizacja "${ORG_ID}" nie istnieje. Uruchom najpierw 01-rdzen.ts --apply (paczka D6 zależy od D1).`
      );
    }

    const lic = await wykonaj(c, opcje.tryb === 'apply');
    console.log('\n' + lic.raport('materialy'));
    if (opcje.tryb === 'dry-run') {
      console.log('[materialy] dry-run: transakcja wykonana i wycofana (ROLLBACK) — nic nie zapisano.');
    } else if (lic.utworzono === 0 && lic.zmieniono === 0) {
      console.log('[materialy] idempotentnie: nic nie było do zrobienia.');
    }
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(`[materialy] BŁĄD: ${(e as Error).message}`);
  process.exit(1);
});
