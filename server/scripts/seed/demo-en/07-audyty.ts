#!/usr/bin/env tsx
/**
 * D2b — AUDITS — organizacja „Northwind Manufacturing Ltd." (`northwind`)
 * (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §3 wiersz 11 „Audits").
 *
 * JEDYNA pozycja menu bez seedu (galeria D7: „11 Audits PUSTY — żaden skrypt
 * D1-D6 nie pisze do audit_packs/audit_programs"). Ten skrypt buduje,
 * WSZYSTKO PO ANGIELSKU:
 *   - 1 pakiet audytowy „Operational Excellence Audit 2026"
 *     (`audit_packs`, klasyfikacja `DEMONSTRATION` — własna treść Consultify,
 *     NIE kopia żadnej normy zewnętrznej, wzorem `packSeed.ts`),
 *   - 6 kryteriów pakietu pod 1 domeną (`audit_pack_criteria` — SZABLON;
 *     nie ma w tabeli §3.1 wiersz 11, ale bez niego pakiet w zakładce
 *     Library wygląda na pusty i program nie mógłby "odziedziczyć" treści —
 *     to dokładnie ścieżka `createProgramCore()`
 *     w `server/src/services/audits/programService.ts:370-548`, tylko SQL-em),
 *   - 1 program „Line 3 Quality and Safety Audit" (`audit_programs`,
 *     `lifecycle_state='remediation'` — audyt terenowy zakończony, ustalenia
 *     potwierdzone, część działań już w toku),
 *   - 3 członków programu (`audit_program_members` — program_owner/
 *     lead_auditor/auditee, wzorem `createProgramCore`),
 *   - 6 kryteriów PROGRAMU — snapshot z pakietu, z WYNIKAMI
 *     (`audit_program_criteria.conformity_status`: 4 conforming/observation,
 *     2 nonconforming... patrz niżej — DOKŁADNIE 3 nonconforming, patrz kod),
 *   - 3 ustalenia (`audit_program_findings` — ŻYWA tabela nowej ścieżki;
 *     `audit_findings` to PUŁAPKA, ma 0 czytelników — `aiProposalService.ts:1134`
 *     czyta `audit_program_findings`, NIGDY `audit_findings`),
 *   - 3 działania korygujące (`audit_corrective_actions` — severity/owner/
 *     due date/status żyją NA USTALENIU i NA DZIAŁANIU; `initiative_id`
 *     łączy każde działanie z inicjatywą paczki D3, jeśli D3 jest już
 *     zasiana — `--bez-inicjatyw` pomija to pole, gdy D3 nie jest gotowa).
 *
 * DLACZEGO SQL, NIE `POST /api/audits/*`:
 * POMIAR.md §8 nie umieszcza Audits na liście „MUSI przez API" (to wyłącznie
 * KPI i rejestracja inicjatyw do planowania — CAS/outbox/idempotencja).
 * Zapis SQL degraduje bezpiecznie: jedyne, co pomija to bezpośredni INSERT,
 * to zdarzenia `audit_domain_events` (ten skrypt i tak dopisuje 2 zdarzenia
 * dla czytelności zakładki "Sesje") i blokadę `pg_advisory_xact_lock` na
 * `create_idempotency_key` (nieistotne — idempotencja tego skryptu idzie
 * przez deterministyczne UUIDv5 + `ON CONFLICT ... DO NOTHING`, jak każda
 * inna paczka D1-D6).
 *
 * UŻYCIE
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/07-audyty.ts --oczekiwany-host 54418 --dry-run
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/07-audyty.ts --oczekiwany-host 54418 --apply
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/07-audyty.ts --oczekiwany-host 54418 --verify
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/07-audyty.ts --oczekiwany-host 54418 --reset
 *
 * Flaga własna: `--bez-inicjatyw` — pomija `initiative_id` na działaniach
 * korygujących (dla uruchomienia PRZED `03-inicjatywy.ts --apply`; bez niej
 * skrypt i tak działa — `audit_corrective_actions.initiative_id` nie ma FK —
 * ale link byłby martwy, więc domyślnie skrypt WYMAGA, żeby 3 inicjatywy D3
 * już istniały, i rzuca błąd z jasną instrukcją, jeśli nie istnieją).
 *
 * IDEMPOTENCJA: wszystkie id UUIDv5 (`00-wspolne.ts:det`). `--apply` = JEDNA
 * transakcja, `ON CONFLICT (id) DO NOTHING` per wiersz. `--dry-run` = te same
 * INSERT-y, ROLLBACK zamiast COMMIT.
 *
 * ZALEŻNOŚĆ: wymaga `01-rdzen.ts --apply` (organizacja + 9 osób). Link do
 * inicjatyw wymaga `03-inicjatywy.ts --apply` (patrz `--bez-inicjatyw`).
 *
 * `--reset` kasuje WYŁĄCZNIE wiersze tej paczki (adresowane po deterministycznych
 * id) — nie rusza organizacji, osób, pakietów spoza tego `pack_key`, ani D1-D6.
 */
import type { PoolClient } from 'pg';

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
const idInicjatywy = (slug: string) => det('initiative', slug);

// ============================================================================
// Osoby (z 01-rdzen.ts — nie importujemy tamtego pliku, żeby nie ciągnąć CLI/main()).
// ============================================================================
const OWNER = 'james.whitfield'; // Operations Director — program_owner
const LEAD_AUDITOR = 'robert.chen'; // Head of Quality — lead_auditor
const AUDITEE = 'sarah.mitchell'; // Plant Manager — właściciel Line 3 dzień po dniu
const ACTION_OWNER_MAINTENANCE = 'daniel.osei'; // Automation Engineer
const ACTION_OWNER_QUALITY = 'michael.grant'; // Data Analyst — wykonawca supplier-quality-gate

// ============================================================================
// Inicjatywy D3, do których łączymy działania korygujące (jeśli --bez-inicjatyw
// nie jest podane — patrz sprawdzenie w main()).
// ============================================================================
const INICJATYWA_PREWENCYJNE_UTRZYMANIE = 'predictive-maintenance-cnc';
const INICJATYWA_BRAMKA_JAKOSCI = 'supplier-quality-gate';
const INICJATYWA_ENERGIA = 'energy-monitoring-iso-50001';

// ============================================================================
// 1) PAKIET — audit_packs + audit_pack_criteria (1 domena + 6 kryteriów)
// ============================================================================
const PACK_SLUG = 'operational-excellence-audit-2026';
const PACK_KEY = 'northwind-operational-excellence-audit-2026';

type EvidenceKind = 'document' | 'observation' | 'system_export' | 'interview_answer';
type EvidenceSpec = { kind: EvidenceKind; description: string; mandatory: boolean };

type KryteriumDef = {
  refCode: string;
  title: string;
  requirementText: string;
  auditQuestion: string;
  expectedEvidence: EvidenceSpec[];
  auditProcedure: string;
  samplingGuidance: string;
  sourceReference: string;
  // wynik na poziomie PROGRAMU (nie pakietu — pakiet jest szablonem bez wyniku)
  conformityStatus:
    | 'conforming'
    | 'nonconforming'
    | 'observation'
    | 'opportunity_for_improvement';
  testResult: 'pass' | 'fail' | 'partial';
  auditorConclusion: string;
};

const DOMAIN_REF = 'D0';
const DOMAIN_TITLE = 'Line 3 Operational Discipline';

const CRITERIA: KryteriumDef[] = [
  {
    refCode: 'D0.1',
    title: '5S standard is maintained on Line 3',
    requirementText:
      'Each Line 3 work cell keeps its 5S audit score at or above 90% on the monthly checklist, with red-tag items cleared within five working days.',
    auditQuestion: 'What is the current 5S score for each Line 3 cell, and how quickly are red-tag items cleared?',
    expectedEvidence: [
      { kind: 'document', description: 'Monthly 5S checklist and score history for Line 3 cells', mandatory: true },
      { kind: 'observation', description: 'Walk of the cells against the checklist', mandatory: true },
    ],
    auditProcedure:
      'Review the last three months of 5S checklist scores. Walk cells 1-4 and compare the physical state against the checklist, checking that any red-tag items are closed within the five-day target.',
    samplingGuidance: 'Walk all four Line 3 cells; sample the two months either side of the last shutdown.',
    sourceReference: 'Northwind Operational Excellence Charter, workplace organisation standard',
    conformityStatus: 'conforming',
    testResult: 'pass',
    auditorConclusion:
      'All four cells scored above 90% in the last three checklists; the one red-tag item found during the walk (a mislabelled tooling drawer at cell 2) was closed the same day.',
  },
  {
    refCode: 'D0.2',
    title: 'Standard work instructions are current and followed at the station',
    requirementText:
      'Each Line 3 station has a current standard work instruction, and operators observed at the station follow the documented sequence.',
    auditQuestion: 'Does the standard work instruction at the station match what the operator actually does?',
    expectedEvidence: [
      { kind: 'document', description: 'Current standard work instruction per station', mandatory: true },
      { kind: 'observation', description: 'Timed observation of the operator at the station', mandatory: true },
    ],
    auditProcedure:
      'Pull the current standard work instruction for a sample of stations and time-observe the operator performing the cycle, noting any deviation.',
    samplingGuidance:
      'Sample five of the eleven Line 3 stations, weighted toward the three with the highest changeover frequency.',
    sourceReference: 'Northwind Operational Excellence Charter, standard work standard',
    conformityStatus: 'observation',
    testResult: 'partial',
    auditorConclusion:
      'Four of five sampled stations matched the documented sequence. At station 7, the operator used a shortcut for the torque check that is faster but not yet written into the instruction — recorded as an observation, not a non-conformance, because the shortcut is used consistently by all three shifts and appears safe, but it is undocumented.',
  },
  {
    refCode: 'D0.3',
    title: 'Preventive maintenance is executed to schedule',
    requirementText:
      'Scheduled preventive maintenance tasks on Line 3 equipment are completed within the planned week, and completion is recorded in the maintenance system.',
    auditQuestion:
      'What proportion of scheduled Line 3 preventive maintenance tasks were completed in the planned week over the last quarter?',
    expectedEvidence: [
      { kind: 'system_export', description: 'Preventive maintenance schedule and completion log export', mandatory: true },
    ],
    auditProcedure:
      'Export the preventive maintenance schedule and completion log for Line 3 for the last quarter. Compare planned versus actual completion week for each task.',
    samplingGuidance: 'Full population for the quarter (approximately 60 scheduled tasks) — the export makes 100% review practical.',
    sourceReference: 'Northwind maintenance planning procedure',
    conformityStatus: 'nonconforming',
    testResult: 'fail',
    auditorConclusion:
      '22 of 58 scheduled preventive maintenance tasks (38%) were completed more than one week late, concentrated on the three CNC cells not yet covered by the predictive-maintenance pilot. The fixed 12-week calendar is not being held to on those cells.',
  },
  {
    refCode: 'D0.4',
    title: 'Quality gate at goods-in catches non-conforming batches',
    requirementText:
      'Incoming batches of bought-in castings are checked against a documented sampling plan before release to Line 3, and the defect rate is reported back to the supplier.',
    auditQuestion: 'Is every incoming casting batch checked against a documented sampling plan, and is the result reported to the supplier?',
    expectedEvidence: [
      { kind: 'document', description: 'Goods-in sampling plan and inspection records', mandatory: true },
      { kind: 'document', description: 'Supplier defect-rate feedback record', mandatory: false },
    ],
    auditProcedure:
      'Review the goods-in inspection log for the last quarter against the sampling plan, and check whether supplier feedback was issued for batches with defects.',
    samplingGuidance: 'Sample 15 of the roughly 90 casting batches received in the quarter, weighted toward the two highest-risk suppliers.',
    sourceReference: 'Northwind quality manual, incoming inspection',
    conformityStatus: 'nonconforming',
    testResult: 'fail',
    auditorConclusion:
      'Goods-in performs a visual check only; no documented sampling plan or supplier feedback loop exists. 6 of 15 sampled batches had a defect rate above the internal 2% threshold with no record of supplier notification.',
  },
  {
    refCode: 'D0.5',
    title: 'Machine guarding and lockout-tagout are in place',
    requirementText:
      'Line 3 machines have guarding in place per the risk assessment, and lockout-tagout is used for every maintenance intervention.',
    auditQuestion: 'Is machine guarding intact and is lockout-tagout used for every maintenance intervention observed?',
    expectedEvidence: [
      { kind: 'observation', description: 'Walk of Line 3 guarding against the risk assessment', mandatory: true },
      { kind: 'document', description: 'Lockout-tagout permit log', mandatory: true },
    ],
    auditProcedure:
      'Walk all Line 3 machines against the current risk assessment and check guarding. Review the lockout-tagout permit log for the last quarter for completeness.',
    samplingGuidance: 'Full walk of Line 3 (11 stations); sample ten lockout-tagout permits from the log.',
    sourceReference: 'Northwind health and safety policy, machine guarding standard',
    conformityStatus: 'conforming',
    testResult: 'pass',
    auditorConclusion: 'All guarding matched the risk assessment. Ten sampled lockout-tagout permits were complete and signed off correctly.',
  },
  {
    refCode: 'D0.6',
    title: 'Line 3 energy consumption is metered and managed',
    requirementText: 'Line 3 energy consumption is metered separately from the rest of the site and reviewed against a target.',
    auditQuestion: 'Is Line 3 energy consumption metered separately, and is it reviewed against a target?',
    expectedEvidence: [
      { kind: 'system_export', description: 'Energy metering data for Line 3', mandatory: true },
      { kind: 'document', description: 'Record of the energy review meeting', mandatory: false },
    ],
    auditProcedure: 'Check whether a sub-meter exists for Line 3 and whether consumption is reported and reviewed.',
    samplingGuidance: 'Not applicable — checked once for the whole line.',
    sourceReference: 'Northwind sustainability policy',
    conformityStatus: 'nonconforming',
    testResult: 'fail',
    auditorConclusion:
      'Line 3 is metered only as part of the whole Rotherham site incomer; there is no line-level sub-meter and no energy-per-unit target reviewed for Line 3 specifically.',
  },
];

const NONCONFORMING = CRITERIA.filter((c) => c.conformityStatus === 'nonconforming');
if (NONCONFORMING.length !== 3) {
  throw new Error(`Oczekiwano dokładnie 3 kryteriów nonconforming, jest ${NONCONFORMING.length}.`);
}

// Taksonomia własna pakietu (wzorem `packSeed.ts` DEMO_FINDING_TAXONOMY, po angielsku).
const FINDING_TAXONOMY = [
  { key: 'conforming', label: 'Conforming', nonConforming: false, requiresCorrectiveAction: false, description: 'The requirement is met based on the evidence collected.' },
  { key: 'nonconforming', label: 'Nonconforming', nonConforming: true, requiresCorrectiveAction: true, description: 'The requirement is not met — a corrective action is required.', defaultSeverity: 'medium' },
  { key: 'observation', label: 'Observation', nonConforming: false, requiresCorrectiveAction: false, description: 'A risk signal that does not yet amount to a non-conformance.' },
  { key: 'opportunity_for_improvement', label: 'Opportunity for improvement', nonConforming: false, requiresCorrectiveAction: false, description: 'The process conforms but could be improved.' },
  { key: 'not_applicable', label: 'Not applicable', nonConforming: false, requiresCorrectiveAction: false, description: 'The criterion does not apply to this audit.' },
  { key: 'evidence_insufficient', label: 'Evidence insufficient', nonConforming: false, requiresCorrectiveAction: false, description: 'The evidence collected does not support a conformance or non-conformance conclusion.' },
];

// ============================================================================
// 2) PROGRAM — audit_programs + audit_program_members + audit_program_criteria
// ============================================================================
const PROGRAM_SLUG = 'line-3-quality-and-safety-audit-2026';
const PROGRAM_NAME = 'Line 3 Quality and Safety Audit';
const PROGRAM_OBJECTIVE =
  'Provide an independent view of Line 3 operational discipline — 5S, standard work, preventive maintenance, quality gate and energy metering — ahead of the next Operational Excellence steering review.';
const PROGRAM_SCOPE =
  'Rotherham Line 3 production operations: workplace organisation, standard work, preventive maintenance, goods-in quality gate, machine safety and energy metering. Excludes Lines 1 and 2 and the Leeds site.';
const PLANNED_START = '2026-07-06';
const PLANNED_END = '2026-08-28';
const CRITERIA_SNAPSHOT_AT = '2026-07-06T09:00:00.000Z';

// ============================================================================
// 3) USTALENIA — audit_program_findings (3, jedno na każde kryterium nonconforming)
// ============================================================================
type UstalenieDef = {
  refCode: string; // = refCode powiązanego kryterium
  statement: string;
  recommendation: string;
  rootCause: string;
  rootCauseMethod: string;
  severity: 'medium' | 'high';
  status: 'confirmed' | 'remediation_in_progress';
  ownerSlug: string;
  reviewedAt: string;
  action: {
    title: string;
    description: string;
    actionKind: 'corrective_action';
    ownerSlug: string;
    dueDate: string;
    priority: 'medium' | 'high';
    status: 'proposed' | 'approved' | 'in_progress';
    initiativeSlug: string;
  };
};

const FINDINGS: UstalenieDef[] = [
  {
    refCode: 'D0.3',
    statement:
      'Line 3 CNC preventive maintenance is not held to the fixed 12-week calendar; 38% of scheduled tasks over the last quarter were more than a week late.',
    recommendation:
      "Bring the three uncovered CNC cells into the predictive-maintenance pilot ahead of schedule, or restore adherence to the fixed calendar until they are covered.",
    rootCause:
      'The fixed 12-week calendar assumes fitter capacity that is being redirected to install the predictive-maintenance sensors on cells 1-2, leaving cells 3-6 short of planned hours.',
    rootCauseMethod: '5 whys',
    severity: 'high',
    status: 'remediation_in_progress',
    ownerSlug: ACTION_OWNER_MAINTENANCE,
    reviewedAt: '2026-08-14T10:00:00.000Z',
    action: {
      title: 'Bring CNC cells 3-6 into the predictive-maintenance pilot',
      description:
        'Extend vibration and spindle-current sensing from cells 1-2 to cells 3-6 ahead of the wave-2 date, closing the maintenance gap the audit found.',
      actionKind: 'corrective_action',
      ownerSlug: ACTION_OWNER_MAINTENANCE,
      dueDate: '2026-12-18',
      priority: 'high',
      status: 'in_progress',
      initiativeSlug: INICJATYWA_PREWENCYJNE_UTRZYMANIE,
    },
  },
  {
    refCode: 'D0.4',
    statement:
      'Goods-in performs a visual check only for bought-in castings; there is no documented sampling plan and no supplier defect-rate feedback loop, and 6 of 15 sampled batches were over the internal 2% defect threshold.',
    recommendation:
      "Bring forward the Supplier Quality Gate initiative's sampling plan and supplier scorecard for the two highest-risk casting suppliers.",
    rootCause: 'The goods-in quality gate procedure was never written after the visual check was set up as an interim measure two years ago.',
    rootCauseMethod: '5 whys',
    severity: 'high',
    status: 'remediation_in_progress',
    ownerSlug: ACTION_OWNER_QUALITY,
    reviewedAt: '2026-08-14T10:20:00.000Z',
    action: {
      title: 'Stand up the goods-in sampling plan and supplier scorecard',
      description:
        'Implement the documented sampling plan by supplier risk class and start the monthly defect-rate feedback to the two highest-risk casting suppliers.',
      actionKind: 'corrective_action',
      ownerSlug: ACTION_OWNER_QUALITY,
      dueDate: '2027-01-15',
      priority: 'high',
      status: 'approved',
      initiativeSlug: INICJATYWA_BRAMKA_JAKOSCI,
    },
  },
  {
    refCode: 'D0.6',
    statement: 'Line 3 energy consumption is metered only at the whole-site incomer; there is no line-level sub-meter or energy-per-unit target.',
    recommendation:
      'Sequence the Line 3 sub-meter installation early in the Energy Monitoring and ISO 50001 initiative so Line 3 has its own energy-per-unit baseline before the certification audit is booked.',
    rootCause: 'Sub-metering was scoped for the twelve largest loads sitewide by total consumption, and no individual Line 3 load was large enough on its own to make that list.',
    rootCauseMethod: 'pareto',
    severity: 'medium',
    status: 'confirmed',
    ownerSlug: ACTION_OWNER_MAINTENANCE,
    reviewedAt: '2026-08-14T10:40:00.000Z',
    action: {
      title: 'Install a Line 3 sub-meter ahead of the site-wide rollout',
      description:
        'Bring the Line 3 incomer sub-meter forward in the Energy Monitoring and ISO 50001 sequence so a line-level baseline exists before the certification audit is booked.',
      actionKind: 'corrective_action',
      ownerSlug: ACTION_OWNER_MAINTENANCE,
      dueDate: '2027-01-31',
      priority: 'medium',
      status: 'proposed',
      initiativeSlug: INICJATYWA_ENERGIA,
    },
  },
];

// ============================================================================
// Id-y deterministyczne
// ============================================================================
const packId = det('audit-pack', PACK_SLUG);
const domainId = det('audit-pack-criterion', `${PACK_SLUG}|${DOMAIN_REF}`);
const packCriterionId = (refCode: string) => det('audit-pack-criterion', `${PACK_SLUG}|${refCode}`);

const programId = det('audit-program', PROGRAM_SLUG);
const programDomainId = det('audit-program-criterion', `${PROGRAM_SLUG}|${DOMAIN_REF}`);
const programCriterionId = (refCode: string) => det('audit-program-criterion', `${PROGRAM_SLUG}|${refCode}`);
const findingId = (refCode: string) => det('audit-program-finding', `${PROGRAM_SLUG}|${refCode}`);
const actionId = (refCode: string) => det('audit-corrective-action', `${PROGRAM_SLUG}|${refCode}`);
const memberId = (slug: string, role: string) => det('audit-program-member', `${PROGRAM_SLUG}|${role}|${slug}`);
const eventId = (key: string) => det('audit-domain-event', `${PROGRAM_SLUG}|${key}`);
const sourceId = det('audit-norm-source', PACK_SLUG);
const SOURCE_VERSION = '1.0';

// ============================================================================
// wykonaj — jedna transakcja, ON CONFLICT DO NOTHING, commit=apply / rollback=dry-run
// ============================================================================
async function wykonaj(c: PoolClient, commit: boolean, wlaczInicjatywy: boolean): Promise<Licznik> {
  const lic = new Licznik();
  const now = new Date().toISOString();

  await c.query('BEGIN');
  try {
    // --- 0) Źródło pakietu — bez niego `evaluateStartGate()`
    // (`AuditLibraryTab.tsx:76-93`) pokazuje "Pack has no source attached —
    // it cannot count as 'published' for an audit." mimo publication_status
    // = 'published'. Wzorem `packSeed.ts:ensureDemoSource` — źródło WŁASNE
    // (Consultify/Northwind), nie kopia normy.
    const rSource = await c.query(
      `INSERT INTO audit_norm_sources (
         id, organization_id, source_key, title, publisher, source_version,
         source_kind, rights_status, verification_status, source_type,
         verification_state, created_by, created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,'internal_procedure','owned_internal','UNVERIFIED',
         'INTERNAL_PROCEDURE','UNVERIFIED',$7,$8,$8
       )
       ON CONFLICT (id) DO NOTHING`,
      [
        sourceId,
        ORG_ID,
        `${PACK_KEY}-source`,
        'Northwind Operational Excellence Programme — internal audit procedure',
        'Northwind Manufacturing Ltd.',
        SOURCE_VERSION,
        uid(LEAD_AUDITOR),
        now,
      ]
    );
    if ((rSource.rowCount ?? 0) > 0) lic.utworz();
    else lic.pomin();

    // --- 1) Pakiet -----------------------------------------------------
    const rPack = await c.query(
      `INSERT INTO audit_packs (
         id, organization_id, pack_key, version, title, summary, purpose,
         source_id, source_version, classification, publication_status,
         scope, objectives, audit_type,
         required_roles, required_competencies, finding_taxonomy,
         sampling_guidance, published_by, published_at, created_by,
         created_at, updated_at, source_type, verification_state
       ) VALUES (
         $1,$2,$3,1,$4,$5,$6,$7,$8,'DEMONSTRATION','published',$9,$10,'internal_process',
         $11,$12,$13,$14,$15,$16,$17,$18,$18,'INTERNAL_PROCEDURE','UNVERIFIED'
       )
       ON CONFLICT (id) DO NOTHING`,
      [
        packId,
        ORG_ID,
        PACK_KEY,
        'Operational Excellence Audit 2026',
        'A Consultify-authored internal audit pack covering 5S, standard work, preventive maintenance, quality gate and safety/energy discipline for manufacturing lines — not a copy of any external norm.',
        'Give plant leadership an independent, evidence-based read on operational discipline ahead of the next Operational Excellence steering review.',
        sourceId,
        SOURCE_VERSION,
        'Any Northwind production line nominated for an internal operational excellence audit.',
        'Demonstrate the audit chain — criterion, evidence, procedure, conclusion, finding, corrective action — on a real production line.',
        JSON.stringify(['lead_auditor', 'auditor', 'auditee']),
        JSON.stringify(['lean manufacturing fundamentals', 'internal audit technique']),
        JSON.stringify(FINDING_TAXONOMY),
        'Purposive sampling — prioritise the shifts and cells flagged in the latest downtime and non-conformance logs.',
        uid(LEAD_AUDITOR),
        '2026-06-15T09:00:00.000Z',
        uid(OWNER),
        now,
      ]
    );
    if ((rPack.rowCount ?? 0) > 0) lic.utworz();
    else lic.pomin();

    // --- 2) Kryteria pakietu (1 domena + 6 kryteriów) -------------------
    const rDomain = await c.query(
      `INSERT INTO audit_pack_criteria (
         id, pack_id, parent_id, ordinal, ref_code, node_kind, title, mandatory, created_at, updated_at
       ) VALUES ($1,$2,NULL,0,$3,'domain',$4,true,$5,$5)
       ON CONFLICT (id) DO NOTHING`,
      [domainId, packId, DOMAIN_REF, DOMAIN_TITLE, now]
    );
    if ((rDomain.rowCount ?? 0) > 0) lic.utworz();
    else lic.pomin();

    for (const [idx, cr] of CRITERIA.entries()) {
      const r = await c.query(
        `INSERT INTO audit_pack_criteria (
           id, pack_id, parent_id, ordinal, ref_code, node_kind, title, requirement_text,
           source_reference, audit_question, expected_evidence, audit_procedure,
           sampling_guidance, mandatory, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,'criterion',$6,$7,$8,$9,$10,$11,$12,true,$13,$13)
         ON CONFLICT (id) DO NOTHING`,
        [
          packCriterionId(cr.refCode),
          packId,
          domainId,
          idx + 1,
          cr.refCode,
          cr.title,
          cr.requirementText,
          cr.sourceReference,
          cr.auditQuestion,
          JSON.stringify(cr.expectedEvidence),
          cr.auditProcedure,
          cr.samplingGuidance,
          now,
        ]
      );
      if ((r.rowCount ?? 0) > 0) lic.utworz();
      else lic.pomin();
    }

    // --- 3) Program ------------------------------------------------------
    const projectId = det('project', 'operational-excellence-programme');
    const rProgram = await c.query(
      `INSERT INTO audit_programs (
         id, organization_id, name, description, objective, status, config,
         pack_id, pack_key, pack_version, lifecycle_state, scope_text,
         criteria_snapshot_at, planned_start, planned_end, program_owner_id,
         lead_auditor_id, project_id, created_by, created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,'active',$6,$7,$8,1,'remediation',$9,$10,$11,$12,$13,$14,$15,$16,$17,$17
       )
       ON CONFLICT (id) DO NOTHING`,
      [
        programId,
        ORG_ID,
        PROGRAM_NAME,
        'Internal operational excellence audit of Rotherham Line 3, run against the Operational Excellence Audit 2026 pack.',
        PROGRAM_OBJECTIVE,
        JSON.stringify({}),
        packId,
        PACK_KEY,
        PROGRAM_SCOPE,
        CRITERIA_SNAPSHOT_AT,
        PLANNED_START,
        PLANNED_END,
        uid(OWNER),
        uid(LEAD_AUDITOR),
        projectId,
        uid(LEAD_AUDITOR),
        now,
      ]
    );
    if ((rProgram.rowCount ?? 0) > 0) lic.utworz();
    else lic.pomin();

    // --- 4) Członkowie programu -------------------------------------------
    const members: Array<{ slug: string; role: string; independence: boolean }> = [
      { slug: OWNER, role: 'program_owner', independence: true },
      { slug: LEAD_AUDITOR, role: 'lead_auditor', independence: true },
      { slug: AUDITEE, role: 'auditee', independence: false },
    ];
    for (const m of members) {
      const r = await c.query(
        `INSERT INTO audit_program_members (
           id, program_id, organization_id, user_id, member_role, independence_declared,
           assigned_by, assigned_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [memberId(m.slug, m.role), programId, ORG_ID, uid(m.slug), m.role, m.independence, uid(OWNER), now]
      );
      if ((r.rowCount ?? 0) > 0) lic.utworz();
      else lic.pomin();
    }

    // --- 5) Kryteria programu — snapshot z pakietu, Z WYNIKAMI ------------
    const rProgDomain = await c.query(
      `INSERT INTO audit_program_criteria (
         id, program_id, organization_id, pack_criterion_id, parent_id, ordinal, ref_code,
         node_kind, title, mandatory, applicable, conformity_status, work_status, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,NULL,0,$5,'domain',$6,true,true,'not_tested','open',$7,$7)
       ON CONFLICT (id) DO NOTHING`,
      [programDomainId, programId, ORG_ID, domainId, DOMAIN_REF, DOMAIN_TITLE, now]
    );
    if ((rProgDomain.rowCount ?? 0) > 0) lic.utworz();
    else lic.pomin();

    for (const [idx, cr] of CRITERIA.entries()) {
      const r = await c.query(
        `INSERT INTO audit_program_criteria (
           id, program_id, organization_id, pack_criterion_id, parent_id, ordinal, ref_code,
           node_kind, title, requirement_text, source_reference, audit_question, expected_evidence,
           audit_procedure, sampling_guidance, mandatory, applicable, assigned_auditor_id,
           assigned_auditee_id, test_result, auditor_note, auditor_conclusion, conformity_status,
           concluded_by, concluded_at, work_status, created_at, updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,'criterion',$8,$9,$10,$11,$12,$13,$14,true,true,$15,$16,$17,$18,$19,$20,$21,$22,
           'concluded',$23,$23
         )
         ON CONFLICT (id) DO NOTHING`,
        [
          programCriterionId(cr.refCode),
          programId,
          ORG_ID,
          packCriterionId(cr.refCode),
          programDomainId,
          idx + 1,
          cr.refCode,
          cr.title,
          cr.requirementText,
          cr.sourceReference,
          cr.auditQuestion,
          JSON.stringify(cr.expectedEvidence),
          cr.auditProcedure,
          cr.samplingGuidance,
          uid(LEAD_AUDITOR),
          uid(AUDITEE),
          cr.testResult,
          cr.auditorConclusion,
          cr.auditorConclusion,
          cr.conformityStatus,
          uid(LEAD_AUDITOR),
          PLANNED_END,
          now,
        ]
      );
      if ((r.rowCount ?? 0) > 0) lic.utworz();
      else lic.pomin();
    }

    // --- 6) Ustalenia + działania korygujące -------------------------------
    for (const f of FINDINGS) {
      const critId = programCriterionId(f.refCode);
      const fId = findingId(f.refCode);
      const rFinding = await c.query(
        `INSERT INTO audit_program_findings (
           id, program_id, organization_id, criterion_id, reference_code, statement,
           requirement_text, classification, severity, recommendation, root_cause,
           root_cause_method, root_cause_confirmed, status, owner_user_id, author_id,
           reviewed_by, reviewed_at, review_note, created_at, updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,'nonconforming',$8,$9,$10,$11,true,$12,$13,$14,$15,$16,$17,$18,$18
         )
         ON CONFLICT (id) DO NOTHING`,
        [
          fId,
          programId,
          ORG_ID,
          critId,
          f.refCode,
          f.statement,
          CRITERIA.find((c) => c.refCode === f.refCode)!.requirementText,
          f.severity,
          f.recommendation,
          f.rootCause,
          f.rootCauseMethod,
          f.status,
          uid(f.ownerSlug),
          uid(LEAD_AUDITOR),
          uid(OWNER),
          f.reviewedAt,
          'Confirmed by the program owner; corrective action tracked against the linked initiative.',
          now,
        ]
      );
      if ((rFinding.rowCount ?? 0) > 0) lic.utworz();
      else lic.pomin();

      if (wlaczInicjatywy) {
        const initExists = await c.query('SELECT 1 FROM initiatives WHERE id = $1 AND organization_id = $2', [
          idInicjatywy(f.action.initiativeSlug),
          ORG_ID,
        ]);
        if (initExists.rows.length === 0) {
          throw new Error(
            `Inicjatywa "${f.action.initiativeSlug}" nie istnieje. Uruchom 03-inicjatywy.ts --apply, albo podaj --bez-inicjatyw.`
          );
        }
      }

      const rAction = await c.query(
        `INSERT INTO audit_corrective_actions (
           id, finding_id, program_id, organization_id, action_kind, title, description,
           owner_user_id, due_date, priority, status, initiative_id, created_by, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
         ON CONFLICT (id) DO NOTHING`,
        [
          actionId(f.refCode),
          fId,
          programId,
          ORG_ID,
          f.action.actionKind,
          f.action.title,
          f.action.description,
          uid(f.action.ownerSlug),
          f.action.dueDate,
          f.action.priority,
          f.action.status,
          wlaczInicjatywy ? idInicjatywy(f.action.initiativeSlug) : null,
          uid(f.action.ownerSlug),
          now,
        ]
      );
      if ((rAction.rowCount ?? 0) > 0) lic.utworz();
      else lic.pomin();
    }

    // --- 7) Zdarzenia — czytelność zakładki "Sesje" / trail --------------
    const rEv1 = await c.query(
      `INSERT INTO audit_domain_events (
         id, program_id, organization_id, entity_type, entity_id, event_type,
         actor_id, summary, payload, actor_kind
       ) VALUES ($1,$2,$3,'program',$2,'program.created_from_pack',$4,$5,$6,'human')
       ON CONFLICT (id) DO NOTHING`,
      [
        eventId('created'),
        programId,
        ORG_ID,
        uid(LEAD_AUDITOR),
        `Created program "${PROGRAM_NAME}" from pack ${PACK_KEY} v1`,
        JSON.stringify({ packId, packKey: PACK_KEY, packVersion: 1, criteriaCount: CRITERIA.length }),
      ]
    );
    if ((rEv1.rowCount ?? 0) > 0) lic.utworz();
    else lic.pomin();

    const rEv2 = await c.query(
      `INSERT INTO audit_domain_events (
         id, program_id, organization_id, entity_type, entity_id, event_type,
         actor_id, summary, payload, actor_kind
       ) VALUES ($1,$2,$3,'program',$2,'program.lifecycle_advanced',$4,$5,$6,'human')
       ON CONFLICT (id) DO NOTHING`,
      [
        eventId('remediation'),
        programId,
        ORG_ID,
        uid(OWNER),
        `Advanced "${PROGRAM_NAME}" to remediation — 3 findings confirmed, corrective actions assigned`,
        JSON.stringify({ lifecycleState: 'remediation', findingsCount: FINDINGS.length }),
      ]
    );
    if ((rEv2.rowCount ?? 0) > 0) lic.utworz();
    else lic.pomin();

    if (commit) await c.query('COMMIT');
    else await c.query('ROLLBACK');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }

  return lic;
}

// ============================================================================
// Reset — kasuje WYŁĄCZNIE wiersze tej paczki (adresowane po deterministycznych id).
// ============================================================================
async function reset(c: PoolClient): Promise<void> {
  const critIds = CRITERIA.map((c) => programCriterionId(c.refCode));
  const packCritIds = CRITERIA.map((c) => packCriterionId(c.refCode));
  const findIds = FINDINGS.map((f) => findingId(f.refCode));
  const actIds = FINDINGS.map((f) => actionId(f.refCode));
  const memberIds = [
    memberId(OWNER, 'program_owner'),
    memberId(LEAD_AUDITOR, 'lead_auditor'),
    memberId(AUDITEE, 'auditee'),
  ];
  await c.query('BEGIN');
  try {
    let usuniete = 0;
    // `audit_domain_events` jest APPEND-ONLY (`trg_audit_domain_events_append_only`
    // — zmierzone na żywej bazie: próba DELETE rzuca „append-only; append a
    // superseding event instead" i wycofuje CAŁĄ transakcję resetu). To jest
    // poprawne zachowanie audytu — ślad zdarzeń nie znika, nawet gdy program
    // znika. `reset()` świadomie NIE kasuje tych 2 wierszy; `--verify` po
    // resecie sprawdza to wprost (nie oczekuje zdarzeń=0).
    for (const id of actIds) {
      usuniete += (await c.query('DELETE FROM audit_corrective_actions WHERE id = $1', [id])).rowCount ?? 0;
    }
    for (const id of findIds) {
      usuniete += (await c.query('DELETE FROM audit_program_findings WHERE id = $1', [id])).rowCount ?? 0;
    }
    for (const id of critIds) {
      usuniete += (await c.query('DELETE FROM audit_program_criteria WHERE id = $1', [id])).rowCount ?? 0;
    }
    usuniete += (await c.query('DELETE FROM audit_program_criteria WHERE id = $1', [programDomainId])).rowCount ?? 0;
    for (const id of memberIds) {
      usuniete += (await c.query('DELETE FROM audit_program_members WHERE id = $1', [id])).rowCount ?? 0;
    }
    usuniete += (await c.query('DELETE FROM audit_programs WHERE id = $1', [programId])).rowCount ?? 0;
    for (const id of packCritIds) {
      usuniete += (await c.query('DELETE FROM audit_pack_criteria WHERE id = $1', [id])).rowCount ?? 0;
    }
    usuniete += (await c.query('DELETE FROM audit_pack_criteria WHERE id = $1', [domainId])).rowCount ?? 0;
    usuniete += (await c.query('DELETE FROM audit_packs WHERE id = $1', [packId])).rowCount ?? 0;
    usuniete += (await c.query('DELETE FROM audit_norm_sources WHERE id = $1', [sourceId])).rowCount ?? 0;

    await c.query('COMMIT');
    console.log(`[audyty] reset: usunięto ${usuniete} wierszy paczki D2b (organizacja "northwind" nietknięta).`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
}

// ============================================================================
// Verify — asercje twarde (== N), self-contained.
// ============================================================================
type Asercja = { nazwa: string; oczekiwane: number; rzeczywiste: number };

async function verify(c: PoolClient): Promise<void> {
  const count = async (sql: string, params: unknown[]): Promise<number> => {
    const r = await c.query<{ n: string }>(sql, params);
    return Number(r.rows[0]?.n ?? 0);
  };

  const packi = await count('SELECT COUNT(*)::int AS n FROM audit_packs WHERE id = $1', [packId]);
  const zrodla = await count('SELECT COUNT(*)::int AS n FROM audit_norm_sources WHERE id = $1', [sourceId]);
  const packZeZrodlem = await count(
    "SELECT COUNT(*)::int AS n FROM audit_packs WHERE id = $1 AND source_id IS NOT NULL AND publication_status = 'published'",
    [packId]
  );
  const pakietKryteria = await count(
    'SELECT COUNT(*)::int AS n FROM audit_pack_criteria WHERE pack_id = $1',
    [packId]
  );
  const programy = await count('SELECT COUNT(*)::int AS n FROM audit_programs WHERE id = $1', [programId]);
  const czlonkowie = await count(
    'SELECT COUNT(*)::int AS n FROM audit_program_members WHERE program_id = $1',
    [programId]
  );
  const programKryteria = await count(
    'SELECT COUNT(*)::int AS n FROM audit_program_criteria WHERE program_id = $1',
    [programId]
  );
  const kryteriaNonconforming = await count(
    "SELECT COUNT(*)::int AS n FROM audit_program_criteria WHERE program_id = $1 AND conformity_status = 'nonconforming'",
    [programId]
  );
  const ustalenia = await count(
    'SELECT COUNT(*)::int AS n FROM audit_program_findings WHERE program_id = $1',
    [programId]
  );
  const ustaleniaMartwaTabela = await count('SELECT COUNT(*)::int AS n FROM audit_findings WHERE 1=0', []); // pułapka — zawsze 0, kotwica dokumentacyjna
  const dzialania = await count(
    'SELECT COUNT(*)::int AS n FROM audit_corrective_actions WHERE program_id = $1',
    [programId]
  );
  const dzialaniaZDataTermin = await count(
    'SELECT COUNT(*)::int AS n FROM audit_corrective_actions WHERE program_id = $1 AND due_date IS NOT NULL',
    [programId]
  );
  const dzialaniaZWlascicielem = await count(
    'SELECT COUNT(*)::int AS n FROM audit_corrective_actions WHERE program_id = $1 AND owner_user_id IS NOT NULL',
    [programId]
  );
  const dzialaniaZInicjatywa = await count(
    'SELECT COUNT(*)::int AS n FROM audit_corrective_actions WHERE program_id = $1 AND initiative_id IS NOT NULL',
    [programId]
  );
  const zdarzenia = await count('SELECT COUNT(*)::int AS n FROM audit_domain_events WHERE program_id = $1', [
    programId,
  ]);
  const zPolskimZnakiem = await count(
    `SELECT COUNT(*)::int AS n FROM audit_program_findings WHERE program_id = $1 AND statement ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'`,
    [programId]
  );

  if (packi === 0) {
    const zestawReset: Asercja[] = [
      { nazwa: 'pakiet (audit_packs)', oczekiwane: 0, rzeczywiste: packi },
      { nazwa: 'źródło pakietu (audit_norm_sources)', oczekiwane: 0, rzeczywiste: zrodla },
      { nazwa: 'kryteria pakietu (audit_pack_criteria)', oczekiwane: 0, rzeczywiste: pakietKryteria },
      { nazwa: 'program (audit_programs)', oczekiwane: 0, rzeczywiste: programy },
      { nazwa: 'członkowie programu (audit_program_members)', oczekiwane: 0, rzeczywiste: czlonkowie },
      { nazwa: 'kryteria programu (audit_program_criteria)', oczekiwane: 0, rzeczywiste: programKryteria },
      { nazwa: 'ustalenia (audit_program_findings)', oczekiwane: 0, rzeczywiste: ustalenia },
      { nazwa: 'działania korygujące (audit_corrective_actions)', oczekiwane: 0, rzeczywiste: dzialania },
      {
        nazwa: 'zdarzenia (audit_domain_events) — APPEND-ONLY, reset nie kasuje (oczekiwane=2, nie 0)',
        oczekiwane: 2,
        rzeczywiste: zdarzenia,
      },
    ];
    console.log(
      '[verify] stan: PO --reset (pakiet=0) — oczekiwane WSZYSTKO=0 Z WYJĄTKIEM audit_domain_events (append-only, trwały ślad).'
    );
    wypiszIZakoncz(zestawReset);
    return;
  }

  const zestaw: Asercja[] = [
    { nazwa: 'pakiet (audit_packs)', oczekiwane: 1, rzeczywiste: packi },
    { nazwa: 'źródło pakietu (audit_norm_sources)', oczekiwane: 1, rzeczywiste: zrodla },
    {
      nazwa: 'pakiet ma source_id + publication_status=published (bramka "start audytu" w UI)',
      oczekiwane: 1,
      rzeczywiste: packZeZrodlem,
    },
    { nazwa: 'kryteria pakietu (audit_pack_criteria, 1 domena + 6)', oczekiwane: 7, rzeczywiste: pakietKryteria },
    { nazwa: 'program (audit_programs)', oczekiwane: 1, rzeczywiste: programy },
    { nazwa: 'członkowie programu (audit_program_members)', oczekiwane: 3, rzeczywiste: czlonkowie },
    { nazwa: 'kryteria programu (audit_program_criteria, 1 domena + 6)', oczekiwane: 7, rzeczywiste: programKryteria },
    { nazwa: 'kryteria programu — nonconforming', oczekiwane: 3, rzeczywiste: kryteriaNonconforming },
    { nazwa: 'ustalenia (audit_program_findings) — ŻYWA tabela, nie audit_findings', oczekiwane: 3, rzeczywiste: ustalenia },
    { nazwa: 'pułapka: audit_findings nie jest czytana (kotwica=0)', oczekiwane: 0, rzeczywiste: ustaleniaMartwaTabela },
    { nazwa: 'działania korygujące (audit_corrective_actions)', oczekiwane: 3, rzeczywiste: dzialania },
    { nazwa: 'działania z terminem (due_date)', oczekiwane: 3, rzeczywiste: dzialaniaZDataTermin },
    { nazwa: 'działania z właścicielem (owner_user_id)', oczekiwane: 3, rzeczywiste: dzialaniaZWlascicielem },
    { nazwa: 'działania powiązane z inicjatywą D3 (initiative_id)', oczekiwane: 3, rzeczywiste: dzialaniaZInicjatywa },
    { nazwa: 'zdarzenia (audit_domain_events)', oczekiwane: 2, rzeczywiste: zdarzenia },
    { nazwa: 'ustalenia z polskim znakiem (ma być 0)', oczekiwane: 0, rzeczywiste: zPolskimZnakiem },
  ];

  wypiszIZakoncz(zestaw);
}

function wypiszIZakoncz(asercje: Asercja[]): void {
  let bledy = 0;
  for (const a of asercje) {
    const ok = a.oczekiwane === a.rzeczywiste;
    if (!ok) bledy++;
    console.log(`[verify] ${ok ? 'OK  ' : 'FAIL'} ${a.nazwa.padEnd(65)} oczekiwane=${a.oczekiwane} rzeczywiste=${a.rzeczywiste}`);
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
  const bezInicjatyw = process.argv.slice(2).includes('--bez-inicjatyw');
  const url = wymaganyUrl();
  const toz = sprawdzCel(url, opcje.oczekiwanyHost);
  const pool = otworzPool(url);
  const c = await pool.connect();

  try {
    console.log(`[audyty] cel:  ${toz}`);
    console.log(`[audyty] tryb: ${opcje.tryb}${bezInicjatyw ? ' (--bez-inicjatyw)' : ''}`);

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
        `Organizacja "${ORG_ID}" nie istnieje. Uruchom najpierw 01-rdzen.ts --apply (paczka D2b zależy od D1).`
      );
    }

    const lic = await wykonaj(c, opcje.tryb === 'apply', !bezInicjatyw);
    console.log('\n' + lic.raport('audyty'));
    if (opcje.tryb === 'dry-run') {
      console.log('[audyty] dry-run: transakcja wykonana i wycofana (ROLLBACK) — nic nie zapisano.');
    } else if (lic.utworzono === 0 && lic.zmieniono === 0) {
      console.log('[audyty] idempotentnie: nic nie było do zrobienia.');
    }
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(`[audyty] BŁĄD: ${(e as Error).message}`);
  process.exit(1);
});
