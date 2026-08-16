/**
 * Canonical presentation content for the Atelier Toys demo story.
 *
 * WHY THIS FILE EXISTS (MAT-006B staging blocker, 2026-08-01)
 * -----------------------------------------------------------
 * Three `presentation_decks` rows exist in the Railway `demo` PostgreSQL for
 * `organization_id = 'atelier'` — `atelier--deck--forward-board-readout`,
 * `atelier--deck--line3-steering`, `atelier--deck--connected-play-growth`.
 * They were inserted as METADATA-ONLY rows (title / deck_type / theme /
 * slide_count / status) with `deck_json`, `unified_json`, `outline_json` and
 * `source_artifacts` all NULL. No code ON THIS BRANCH produces them —
 * `demoSeedService.ts` contained zero references to decks or presentations, and
 * the id shape `<org>--deck--<slug>` matches its `makeId()`, so they most
 * likely came from an earlier or parallel seed variant that never landed here.
 * Either way `slide_count` was an integer with nothing behind it: the Materials
 * list read it and advertised "Ready · 11", while `GET /decks/:id` →
 * `normalizeDeckDocument()` returned `null` and the builder opened
 * "Card 1 of 0".
 *
 * This module is the canonical CONTENT source. It declares the decks as
 * `UnifiedReportJSON` — the existing render model written by
 * `presentationGeneratorService` — so the seed can materialize them through the
 * existing `deckDocumentFromUnifiedJson()` standard. No new deck format is
 * introduced here.
 *
 * Every number below is grounded in data the same Atelier seed already writes
 * (`atelierToysDemoTemplate.ts`, `upsertDrdAssessment`) so the deck traces back
 * to the initiative, the KPIs and the assessment the demo actually shows:
 *   - Line 3 OEE            74 → 80 → 82 %      (atelierToysResultsKpis)
 *   - Digital ARR           €6.2M → €7.4M → €8M (atelierToysResultsKpis)
 *   - Supplier lead-time    6 → 3 → 2 weeks     (atelierToysResultsKpis)
 *   - Line 3 supervisor adoption 0 → 70 → 100 % (atelierToysRolloutKpis)
 *   - DRD baseline overall  3.3 / 5.0           (upsertDrdAssessment)
 *   - Line 3 initiative     ROI 182 %, capex €420k, opex €120k
 */
import type { DeckSourceRef, DeckStatus } from '../presentationDeckDocumentService.js';
import type { UnifiedSlide } from '../report/pptx/types.js';

/**
 * A canonical Atelier deck: identity columns (kept byte-identical to the rows
 * already on `demo`, so this is an upsert and not a re-identification) plus the
 * slides that back its `slide_count`.
 */
export interface AtelierDeckTemplate {
  /** Deck id is `${organizationId}--deck--${slug}` (demo seed `makeId` shape). */
  slug: string;
  title: string;
  description: string;
  /** Existing rows carry `template_id = 'executive-standard'`; preserved. */
  templateId: string;
  deckType: string;
  audience: string;
  goal: string;
  theme: string;
  presentationMode: string;
  /**
   * ★ THE DATABASE, NOT THE TYPESCRIPT UNION, IS THE AUTHORITY HERE.
   *
   * `presentation_decks` carries a live CHECK constraint — verified read-only
   * against the Railway `demo` PostgreSQL on 2026-08-01:
   *
   *   presentation_decks_status_check
   *   CHECK (status = ANY (ARRAY['draft','generating','ready','exported','failed']))
   *
   * (declared in `migrations/568_presentations_brand_kits_templates.sql` and
   * `migrations/20260314_presentation_decks_deck_json.sql`; never dropped or
   * widened.) The TypeScript `DeckStatus` union is BROADER than that — it also
   * admits `'generated' | 'editing' | 'shared' | 'archived'`, none of which the
   * database accepts. Seeding one of those raises a constraint violation.
   *
   * So this field is typed `DeckStatus` for the document model but must be
   * restricted to the DB vocabulary; `DB_WRITABLE_DECK_STATUSES` below is the
   * enforced set and the seed asserts against it.
   */
  status: DeckStatus;
  sourceType: string;
  /** Leadership slug from `atelierToysLeadership`, resolved to a user id. */
  createdBySlug: string;
  /** Initiative slug this deck presents, for `source_refs` traceability. */
  sourceInitiativeSlug: string;
  sourceRefs: DeckSourceRef[];
  slides: UnifiedSlide[];
}

/**
 * The statuses `presentation_decks.status_check` actually accepts. Kept as a
 * runtime value (not just a type) so the seed can assert against it before
 * issuing a write the database would reject.
 */
export const DB_WRITABLE_DECK_STATUSES = [
  'draft',
  'generating',
  'ready',
  'exported',
  'failed',
] as const;

export function isDbWritableDeckStatus(status: string): boolean {
  return (DB_WRITABLE_DECK_STATUSES as readonly string[]).includes(status);
}

const LINE3_SOURCE_REFS: DeckSourceRef[] = [
  {
    artifact_id: 'initiative:line-3-digital-twin',
    artifact_type: 'initiative',
    artifact_name: 'Line 3 Digital Twin Rollout',
    confidence: 0.92,
    readiness: 'ready',
    freshness_days: 3,
    captured_at: null,
    lineage: null,
  },
  {
    artifact_id: 'kpi:result-line3-oee',
    artifact_type: 'kpi',
    artifact_name: 'Line 3 OEE',
    confidence: 0.95,
    readiness: 'ready',
    freshness_days: 1,
    captured_at: null,
    lineage: null,
  },
  {
    artifact_id: 'assessment:drd-atelier-forward-baseline',
    artifact_type: 'assessment',
    artifact_name: 'DRD Baseline — Atelier Forward',
    confidence: 0.88,
    readiness: 'approved',
    freshness_days: 21,
    captured_at: null,
    lineage: null,
  },
];

const PORTFOLIO_SOURCE_REFS: DeckSourceRef[] = [
  {
    artifact_id: 'assessment:drd-atelier-forward-baseline',
    artifact_type: 'assessment',
    artifact_name: 'DRD Baseline — Atelier Forward',
    confidence: 0.88,
    readiness: 'approved',
    freshness_days: 21,
    captured_at: null,
    lineage: null,
  },
  {
    artifact_id: 'initiative:line-3-digital-twin',
    artifact_type: 'initiative',
    artifact_name: 'Line 3 Digital Twin Rollout',
    confidence: 0.92,
    readiness: 'ready',
    freshness_days: 3,
    captured_at: null,
    lineage: null,
  },
  {
    artifact_id: 'finance:atelier-transformation-roi',
    artifact_type: 'financial_model',
    artifact_name: 'Atelier Toys — Transformation ROI',
    confidence: 0.9,
    readiness: 'approved',
    freshness_days: 7,
    captured_at: null,
    lineage: null,
  },
];

const GROWTH_SOURCE_REFS: DeckSourceRef[] = [
  {
    artifact_id: 'initiative:atelier-digital-growth',
    artifact_type: 'initiative',
    artifact_name: 'Atelier Digital Subscription Expansion',
    confidence: 0.85,
    readiness: 'ready',
    freshness_days: 5,
    captured_at: null,
    lineage: null,
  },
  {
    artifact_id: 'kpi:result-digital-arr',
    artifact_type: 'kpi',
    artifact_name: 'Digital ARR',
    confidence: 0.93,
    readiness: 'ready',
    freshness_days: 2,
    captured_at: null,
    lineage: null,
  },
];

/**
 * `atelier--deck--line3-steering` — 11 slides, steering-committee register.
 *
 * The count is NOT chosen to match the legacy `slide_count = 11`; the seed
 * derives `slide_count` from this array. It happens to agree, which is why the
 * demo list keeps showing 11 after the fix — now with content behind it.
 */
const LINE3_STEERING_SLIDES: UnifiedSlide[] = [
  {
    intent: 'cover',
    key_message: 'Line 3 Digital Twin — gate decision on phase-2 funding',
    content: {
      type: 'cover',
      title: 'Line 3 Digital Twin — Steering Committee Deck',
      subtitle: 'OEE recovery, downtime economics, and the phase-2 funding gate',
      organization: 'Atelier Toys',
      date: 'Atelier Forward · steering cadence',
      confidentiality: 'Internal',
    },
  },
  {
    intent: 'executive_summary',
    key_message: 'The twin is delivering; the constraint is now scale-up funding, not proof.',
    content: {
      type: 'executive_summary',
      headline: 'OEE is +6 points against a +8 target; phase 2 is the remaining gap',
      kpis: [
        { name: 'Line 3 OEE', value: 80, unit: '%', target: 82, trend: 'up', status: 'good' },
        {
          name: 'Supervisor adoption',
          value: 70,
          unit: '%',
          target: 100,
          trend: 'up',
          status: 'warning',
        },
        { name: 'Expected ROI', value: 182, unit: '%', trend: 'flat', status: 'good' },
      ],
      key_findings: [
        'Line 3 OEE moved 74 → 80 % over four quarters; the 82 % target is inside reach with the changeover standard applied.',
        'Telemetry is live on every Line 3 station, so root-cause attribution is now evidence-based rather than shift anecdote.',
        'Supervisor adoption is at 70 % — the value lever that is still open, and the one phase 2 pays for.',
        'Committed spend is €420k capex plus €120k opex against a 182 % expected ROI on the approved business case.',
      ],
      recommendation:
        'Approve phase-2 funding at the board gate so the changeover standard and supervisor enablement land before the Line 4 decision.',
    },
  },
  {
    intent: 'key_messages',
    key_message: 'Three things the steering committee has to hold',
    content: {
      type: 'key_messages',
      messages: [
        {
          title: 'Proof is done',
          description:
            'The pilot answered the technical question: the twin sees the losses, and the losses are actionable. Telemetry went live 14 days ago across all Line 3 stations.',
        },
        {
          title: 'Value is behind adoption, not technology',
          description:
            'The remaining 2 OEE points sit in supervisor behaviour during changeover, not in the model. That is a rollout problem with a known playbook.',
        },
        {
          title: 'The gate is time-sensitive',
          description:
            'Phase-2 integrations and supervisor enablement need to close before the Line 4 scale-up decision, or the Line 4 case is argued without a stable baseline.',
        },
      ],
    },
  },
  {
    intent: 'performance_overview',
    key_message: 'Where Line 3 stands against baseline and target',
    content: {
      type: 'performance_overview',
      period: 'Rolling 4 quarters',
      kpis: [
        { name: 'Line 3 OEE', value: 80, unit: '%', target: 82, trend: 'up', status: 'good' },
        {
          name: 'Supervisor adoption',
          value: 70,
          unit: '%',
          target: 100,
          trend: 'up',
          status: 'warning',
        },
        {
          name: 'Downtime alert latency',
          value: 8,
          unit: 'min',
          target: 10,
          trend: 'down',
          status: 'good',
        },
        {
          name: 'Changeover time',
          value: -11,
          unit: '% vs baseline',
          target: -18,
          trend: 'down',
          status: 'warning',
        },
      ],
      context:
        'Baseline is the pre-rollout quarter (OEE 74 %). Target is the approved business-case commitment (OEE 82 %, changeover −18 %).',
    },
  },
  {
    intent: 'single_insight',
    key_message: 'OEE recovery is linear and on trajectory — the last two points need phase 2',
    content: {
      type: 'single_insight',
      chart_type: 'line',
      chart_data: {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        series: [
          { name: 'Line 3 OEE (actual)', values: [74, 76, 78, 80] },
          { name: 'Target', values: [82, 82, 82, 82] },
        ],
      },
      insight_text:
        'Four consecutive quarters of +2 points. The curve is driven by loss visibility, which is now saturated — further gains come from acting on the losses, not seeing more of them.',
      source: 'Results KPI — Line 3 OEE (owner: Marc Dubois)',
    },
  },
  {
    intent: 'root_cause',
    key_message: 'What is still costing Line 3 output',
    content: {
      type: 'root_cause',
      problem: 'The remaining 2 OEE points are concentrated in three recurring loss patterns.',
      causes: [
        {
          cause: 'Non-standard changeover sequence between shifts',
          impact: 'Largest single loss bucket; changeover is −11 % against a −18 % commitment.',
          severity: 'high',
        },
        {
          cause: 'Supervisor recommendations acted on inconsistently',
          impact: 'Adoption at 70 % — alerts are raised but not always closed within the shift.',
          severity: 'high',
        },
        {
          cause: 'Event-taxonomy drift during scale-up',
          impact: 'Degrades attribution quality and erodes trust in the twin as it widens.',
          severity: 'medium',
        },
      ],
    },
  },
  {
    intent: 'initiative_portfolio',
    key_message: 'The twin does not stand alone — three moves carry the operations case',
    content: {
      type: 'initiative_portfolio',
      initiatives: [
        {
          name: 'Line 3 Digital Twin Rollout',
          summary: 'Deploy Digital Twin on Line 3 to cut downtime and shorten changeovers.',
          strategicIntent: 'Fix',
          strategicRole: 'Accelerator',
          priority: 'high',
          timeline: 'Executing · gate at next board',
          budget: '€420k capex · €120k opex',
          roi: '182 %',
          owner: 'Marc Dubois',
        },
        {
          name: 'Procurement Control Tower',
          summary: 'Unify supplier risk, inventory signals, and margin exposure.',
          strategicIntent: 'De-risk',
          strategicRole: 'Foundation',
          priority: 'high',
          timeline: 'Executing',
          budget: '€90k capex · €65k opex',
          roi: '148 %',
          owner: 'Isabelle Leroy',
        },
        {
          name: 'Atelier Digital Subscription Expansion',
          summary: 'Unify renewal insight and protect digital ARR.',
          strategicIntent: 'Grow',
          strategicRole: 'Scaling',
          priority: 'high',
          timeline: 'Executing',
          roi: 'ARR €6.2M → €8M',
          owner: 'Thomas Viau',
        },
      ],
    },
  },
  {
    intent: 'roadmap',
    key_message: 'Where phase-2 funding lands in the plan',
    content: {
      type: 'roadmap',
      phases: [
        {
          label: 'Phase 1 — Instrument',
          timeframe: 'Completed',
          status: 'completed',
          items: [
            'Telemetry live across all Line 3 stations',
            'Downtime alerting under 10 minutes',
            'Baseline loss taxonomy agreed with operations',
          ],
        },
        {
          label: 'Phase 1b — Prove',
          timeframe: 'In progress',
          status: 'in_progress',
          items: [
            'Supervisor pilot validating recommendations against actual losses',
            'Sensor coverage gaps closed on heat-treatment and packing',
            'Board demo of downtime simulation prepared',
          ],
        },
        {
          label: 'Phase 2 — Standardize (gate)',
          timeframe: 'Post-gate, 45 days',
          status: 'planned',
          items: [
            'Changeover sequence encoded and enforced in the twin',
            'Supervisor enablement to 100 % adoption',
            'Automated signal-quality checks before any widening',
          ],
        },
        {
          label: 'Phase 3 — Scale',
          timeframe: 'After Line 4 decision',
          status: 'planned',
          items: [
            'Operations handover package closed',
            'Line 4 replication on the locked taxonomy',
          ],
        },
      ],
    },
  },
  {
    intent: 'risk_management',
    key_message: 'What we are watching, and who holds it',
    content: {
      type: 'risk_management',
      risks: [
        {
          risk: 'Telemetry signal quality regresses during scale-up',
          likelihood: 'medium',
          impact: 'high',
          mitigation:
            'Lock the event taxonomy before scaling and add automated signal-quality checks.',
          owner: 'Julien Moreau',
        },
        {
          risk: 'Shift adoption gap persists after the pilot',
          likelihood: 'medium',
          impact: 'high',
          mitigation:
            'Supervisor enablement funded inside phase 2, with adoption tracked as a rollout KPI rather than a training milestone.',
          owner: 'Marc Dubois',
        },
        {
          risk: 'Sensor integration latency on remaining stations',
          likelihood: 'low',
          impact: 'medium',
          mitigation: 'Close coverage gaps on heat-treatment and packing before phase-2 cut-over.',
          owner: 'Luc Rousseau',
        },
        {
          risk: 'Data quality drift erodes trust in attribution',
          likelihood: 'medium',
          impact: 'medium',
          mitigation: 'Weekly signal-quality report reviewed in the operations cadence.',
          owner: 'Julien Moreau',
        },
      ],
    },
  },
  {
    intent: 'comparison',
    key_message: 'Fund phase 2 now, or hold until after Line 4 — the trade-off',
    content: {
      type: 'comparison',
      left_label: 'Approve phase 2 now',
      right_label: 'Hold until after the Line 4 decision',
      left_items: [
        'Changeover standard lands while the pilot team is still assembled',
        'Adoption reaches 100 % before the Line 4 business case is argued',
        'Line 4 replicates a stable, locked event taxonomy',
        'OEE 82 % commitment stays inside the current fiscal narrative',
      ],
      right_items: [
        'No incremental spend this quarter',
        'Pilot team disperses; re-forming costs 4–6 weeks',
        'Line 4 case is argued on a 70 %-adoption baseline',
        'Taxonomy drift risk carries into the wider rollout',
      ],
      verdict:
        'Approve phase 2. The saving from holding is one quarter of opex; the cost is arguing the Line 4 case without a stable baseline.',
    },
  },
  {
    intent: 'next_steps',
    key_message: 'Decisions and owners leaving this room',
    content: {
      type: 'next_steps',
      actions: [
        {
          action: 'Approve second-phase funding for the Line 3 twin rollout',
          owner: 'Claire Laurent',
          deadline: 'Next board meeting',
          status: 'pending',
        },
        {
          action: 'Close sensor coverage gaps on heat-treatment and packing stations',
          owner: 'Luc Rousseau',
          deadline: '+7 days',
          status: 'in_progress',
        },
        {
          action: 'Standardize the changeover sequence inside the Digital Twin',
          owner: 'Marc Dubois',
          deadline: '+18 days',
          status: 'pending',
        },
        {
          action: 'Prepare the board demo of the downtime simulation',
          owner: 'Julien Moreau',
          deadline: 'Board meeting −2 days',
          status: 'pending',
        },
        {
          action: 'Close the Line 3 operations handover package',
          owner: 'Marc Dubois',
          deadline: '+21 days',
          status: 'pending',
        },
      ],
      closing_message:
        'One decision is asked of this committee: release phase-2 funding so the twin converts visibility into the last two OEE points.',
    },
  },
];

/** `atelier--deck--forward-board-readout` — 14 slides, board register. */
const FORWARD_BOARD_READOUT_SLIDES: UnifiedSlide[] = [
  {
    intent: 'cover',
    key_message: 'Atelier Forward — the year in one readout',
    content: {
      type: 'cover',
      title: 'Atelier Forward — 2015 Board Readout',
      subtitle: 'Discovery → diagnosis → portfolio → banked value',
      organization: 'Atelier Toys',
      date: 'Annual board readout',
      confidentiality: 'Internal',
    },
  },
  {
    intent: 'executive_summary',
    key_message: 'The transformation is producing measurable value across three fronts',
    content: {
      type: 'executive_summary',
      headline: 'Operations, supply chain and digital all moved — €1.4M of value is banked',
      kpis: [
        { name: 'Line 3 OEE', value: 80, unit: '%', target: 82, trend: 'up', status: 'good' },
        { name: 'Digital ARR', value: 7.4, unit: '€M', target: 8, trend: 'up', status: 'good' },
        {
          name: 'Supplier lead-time variance',
          value: 3,
          unit: 'weeks',
          target: 2,
          trend: 'down',
          status: 'good',
        },
      ],
      key_findings: [
        'Digital readiness scored 3.3 / 5.0 on the DRD baseline against a 5.0 ambition — the gap is concentrated in cyber, value evidence and the AI operating model.',
        'A 22-initiative portfolio is governed end to end; 14 are executing and one has closed.',
        'The three headline KPIs all moved in the right direction and are reconciled to a confirmed FY2014 P&L.',
        'The weakest link is evidence discipline: value is real but still partly reconciled by hand before board reviews.',
      ],
      recommendation:
        'Continue the portfolio as governed, and fund the two scale-up gates — Line 3 phase 2 and renewal insight consolidation.',
    },
  },
  {
    intent: 'key_messages',
    key_message: 'What the board should take away',
    content: {
      type: 'key_messages',
      messages: [
        {
          title: 'The operating system holds',
          description:
            'Discovery, diagnosis, portfolio, delivery and value now run on one thread. Every number in this readout traces back to an initiative and an owner.',
        },
        {
          title: 'Value is banked, not forecast',
          description:
            'OEE, ARR and lead-time variance are measured against a confirmed baseline — not modelled uplift.',
        },
        {
          title: 'Two gates remain',
          description:
            'Line 3 phase-2 funding and renewal-insight consolidation are the two decisions that carry next year’s case.',
        },
      ],
    },
  },
  {
    intent: 'section_intro',
    key_message: 'Where the diagnosis came from',
    content: {
      type: 'section_intro',
      section_title: 'Discovery and diagnosis',
      section_number: 1,
      description:
        'Five discovery interviews, plant telemetry, and a full DRD assessment — synthesized into four insights, each wired to an initiative.',
    },
  },
  {
    intent: 'assessment',
    key_message: 'DRD baseline: 3.3 / 5.0, with the gap concentrated in three areas',
    content: {
      type: 'assessment',
      matrix_type: 'radar',
      scale_max: 7,
      overall_score: 3.3,
      axes: [
        {
          axisId: '1',
          axisName: 'Digital Processes',
          score: 4,
          maxScore: 7,
          target: 6,
          gap: 2,
        },
        { axisId: '2', axisName: 'Digital Products', score: 3, maxScore: 5, target: 5, gap: 2 },
        {
          axisId: '3',
          axisName: 'Digital Business Models',
          score: 3,
          maxScore: 5,
          target: 5,
          gap: 2,
        },
        { axisId: '4', axisName: 'Data Management', score: 4, maxScore: 7, target: 6, gap: 2 },
        {
          axisId: '5',
          axisName: 'Culture of Transformation',
          score: 3,
          maxScore: 5,
          target: 5,
          gap: 2,
        },
        { axisId: '6', axisName: 'Cybersecurity', score: 2, maxScore: 5, target: 4, gap: 2 },
        { axisId: '7', axisName: 'AI Maturity', score: 2, maxScore: 5, target: 4, gap: 2 },
      ],
    },
  },
  {
    intent: 'root_cause',
    key_message: 'Three structural causes behind the gap',
    content: {
      type: 'root_cause',
      problem: 'Digital readiness is uneven, and the unevenness is structural rather than local.',
      causes: [
        {
          cause: 'Value evidence is reconciled manually between finance and operations',
          impact: 'Board reviews depend on hand-built numbers, which caps trust and speed.',
          severity: 'high',
        },
        {
          cause: 'OT/IT segmentation is uneven across sites',
          impact: 'Cybersecurity scores 2 / 5 — the lowest axis alongside AI maturity.',
          severity: 'high',
        },
        {
          cause: 'Prioritization still leans on sponsor push',
          impact: 'Portfolio governance exists, but value logic is not yet the deciding argument.',
          severity: 'medium',
        },
      ],
    },
  },
  {
    intent: 'single_insight',
    key_message: 'Line 3 OEE is the clearest proof the operating model works',
    content: {
      type: 'single_insight',
      chart_type: 'line',
      chart_data: {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        series: [
          { name: 'Line 3 OEE (actual)', values: [74, 76, 78, 80] },
          { name: 'Digital ARR (€M)', values: [6.2, 6.6, 7.0, 7.4] },
        ],
      },
      insight_text:
        'Operations and digital growth moved together, quarter after quarter — the portfolio is not carried by a single win.',
      source: 'Results KPIs — Line 3 OEE, Digital ARR',
    },
  },
  {
    intent: 'section_intro',
    key_message: 'From diagnosis to a governed portfolio',
    content: {
      type: 'section_intro',
      section_title: 'The portfolio',
      section_number: 2,
      description:
        '22 initiatives across operations, supply chain and digital growth — each with an owner, a business case and a place in the roadmap.',
    },
  },
  {
    intent: 'initiative_portfolio',
    key_message: 'The three initiatives carrying the value case',
    content: {
      type: 'initiative_portfolio',
      initiatives: [
        {
          name: 'Line 3 Digital Twin Rollout',
          summary: 'Cut downtime and shorten changeovers on the flagship line.',
          strategicIntent: 'Fix',
          strategicRole: 'Accelerator',
          priority: 'high',
          timeline: 'Executing · board gate pending',
          budget: '€420k capex · €120k opex',
          roi: '182 %',
          owner: 'Marc Dubois',
        },
        {
          name: 'Procurement Control Tower',
          summary: 'Unify supplier risk, inventory signals and margin exposure.',
          strategicIntent: 'De-risk',
          strategicRole: 'Foundation',
          priority: 'high',
          timeline: 'Executing',
          budget: '€90k capex · €65k opex',
          roi: '148 %',
          owner: 'Isabelle Leroy',
        },
        {
          name: 'Atelier Digital Subscription Expansion',
          summary: 'Consolidate renewal insight and protect digital ARR.',
          strategicIntent: 'Grow',
          strategicRole: 'Scaling',
          priority: 'high',
          timeline: 'Executing',
          roi: 'ARR €6.2M → €8M',
          owner: 'Thomas Viau',
        },
      ],
    },
  },
  {
    intent: 'performance_overview',
    key_message: 'The three numbers the board tracks',
    content: {
      type: 'performance_overview',
      period: 'FY2015 against FY2014 baseline',
      kpis: [
        { name: 'Line 3 OEE', value: 80, unit: '%', target: 82, trend: 'up', status: 'good' },
        { name: 'Digital ARR', value: 7.4, unit: '€M', target: 8, trend: 'up', status: 'good' },
        {
          name: 'Supplier lead-time variance',
          value: 3,
          unit: 'weeks',
          target: 2,
          trend: 'down',
          status: 'good',
        },
        {
          name: 'Supervisor adoption (Line 3)',
          value: 70,
          unit: '%',
          target: 100,
          trend: 'up',
          status: 'warning',
        },
      ],
      context:
        'Grounded on a confirmed FY2014 P&L. Baselines: OEE 74 %, ARR €6.2M, lead-time variance 6 weeks.',
    },
  },
  {
    intent: 'roadmap',
    key_message: 'The next four quarters',
    content: {
      type: 'roadmap',
      phases: [
        {
          label: 'Completed',
          timeframe: 'FY2015 H1',
          status: 'completed',
          items: [
            'DRD baseline approved at 3.3 / 5.0',
            'Line 3 telemetry live',
            'Supplier scorecards published for the top 25 vendors',
          ],
        },
        {
          label: 'In progress',
          timeframe: 'FY2015 H2',
          status: 'in_progress',
          items: [
            'Line 3 supervisor pilot',
            'Weekly margin war room',
            'Renewal insight consolidation',
          ],
        },
        {
          label: 'Gated',
          timeframe: 'Next board',
          status: 'planned',
          items: ['Line 3 phase-2 funding', 'Line 4 scale-up decision'],
        },
        {
          label: 'Planned',
          timeframe: 'FY2016',
          status: 'planned',
          items: [
            'OT/IT segmentation programme',
            'AI operating model and monitoring',
            'Automated value evidence pipeline',
          ],
        },
      ],
    },
  },
  {
    intent: 'risk_management',
    key_message: 'Portfolio-level risks the board owns',
    content: {
      type: 'risk_management',
      risks: [
        {
          risk: 'Value evidence remains manually reconciled',
          likelihood: 'high',
          impact: 'medium',
          mitigation:
            'Automate the value pipeline so board numbers come from the ledger, not a spreadsheet pass.',
          owner: 'Claire Laurent',
        },
        {
          risk: 'OT/IT segmentation gaps across sites',
          likelihood: 'medium',
          impact: 'high',
          mitigation: 'Fund the segmentation programme ahead of any wider twin rollout.',
          owner: 'Julien Moreau',
        },
        {
          risk: 'Telemetry signal quality regresses during scale-up',
          likelihood: 'medium',
          impact: 'high',
          mitigation: 'Lock the event taxonomy and add automated signal-quality checks.',
          owner: 'Julien Moreau',
        },
        {
          risk: 'APAC churn surfaces too late to defend ARR',
          likelihood: 'medium',
          impact: 'medium',
          mitigation: 'Consolidate renewal insight and add early-warning churn signals.',
          owner: 'Thomas Viau',
        },
      ],
    },
  },
  {
    intent: 'next_steps',
    key_message: 'What the board is asked to decide',
    content: {
      type: 'next_steps',
      actions: [
        {
          action: 'Approve Line 3 phase-2 funding',
          owner: 'Claire Laurent',
          deadline: 'This meeting',
          status: 'pending',
        },
        {
          action: 'Confirm the Line 4 scale-up decision date',
          owner: 'Antoine Laurent',
          deadline: 'This meeting',
          status: 'pending',
        },
        {
          action: 'Commission the OT/IT segmentation programme',
          owner: 'Julien Moreau',
          deadline: 'FY2016 planning',
          status: 'pending',
        },
        {
          action: 'Stand up the automated value-evidence pipeline',
          owner: 'Hugo Bernard',
          deadline: 'FY2016 Q1',
          status: 'pending',
        },
      ],
      closing_message:
        'The transformation has cleared the proof stage. The board’s remaining job is to fund the scale-up gates and to retire manual value reconciliation.',
    },
  },
  {
    intent: 'appendix',
    key_message: 'Method, sources and limits',
    content: {
      type: 'appendix',
      title: 'Method, sources and limits',
      body: 'This readout is generated from the same records the platform runs on: the DRD baseline assessment, 22 governed initiatives, the results KPI ledger and the approved transformation ROI model grounded on a confirmed FY2014 P&L.',
      tables: [
        {
          headers: ['Source', 'Status', 'Freshness'],
          rows: [
            ['DRD Baseline — Atelier Forward', 'Approved', '21 days'],
            ['Results KPI ledger (OEE, ARR, lead-time)', 'Live', '1–2 days'],
            ['Transformation ROI model', 'Approved', '7 days'],
            ['Discovery interviews (5)', 'Synthesized', 'Baseline'],
          ],
        },
      ],
      footnotes: [
        'Limits: churn attribution is partial; supplier scorecards cover the top 25 vendors only.',
        'Value evidence for two KPIs is still reconciled manually before board review.',
      ],
    },
  },
];

/** `atelier--deck--connected-play-growth` — 9 slides, commercial register. */
const CONNECTED_PLAY_GROWTH_SLIDES: UnifiedSlide[] = [
  {
    intent: 'cover',
    key_message: 'Connected Play — the growth story behind digital ARR',
    content: {
      type: 'cover',
      title: 'Connected Play — Growth Story',
      subtitle: 'Digital ARR €6.2M → €7.4M, attach rate 11 % → 18 %, retention path to 115 %',
      organization: 'Atelier Toys',
      date: 'Commercial growth review',
      confidentiality: 'Internal',
    },
  },
  {
    intent: 'executive_summary',
    key_message: 'ARR is growing; the constraint has moved from acquisition to renewal insight',
    content: {
      type: 'executive_summary',
      headline: 'ARR at €7.4M against an €8M target — the gap is renewal visibility, not demand',
      kpis: [
        { name: 'Digital ARR', value: 7.4, unit: '€M', target: 8, trend: 'up', status: 'good' },
        { name: 'Attach rate', value: 18, unit: '%', target: 22, trend: 'up', status: 'warning' },
        {
          name: 'APAC churn',
          value: 4.1,
          unit: '%',
          target: 2.5,
          trend: 'flat',
          status: 'warning',
        },
      ],
      key_findings: [
        'ARR moved €6.2M → €7.4M across four quarters, tracking the €8M commitment.',
        'Attach rate on connected-play hardware moved 11 % → 18 %; the commercial motion works.',
        'Renewal insight is fragmented across teams, so APAC churn at 4.1 % surfaces too late to defend.',
      ],
      recommendation:
        'Consolidate renewal insight into one view and add early-warning churn signals before the next renewal cycle.',
    },
  },
  {
    intent: 'key_messages',
    key_message: 'Three things to hold about the growth line',
    content: {
      type: 'key_messages',
      messages: [
        {
          title: 'Demand is proven',
          description:
            'Attach rate nearly doubled without a price change — the connected-play proposition lands with the existing customer base.',
        },
        {
          title: 'Churn is a visibility problem',
          description:
            'APAC churn is not larger than expected; it is discovered later than it can be defended. That is a data problem, not a product problem.',
        },
        {
          title: 'The €8M target is reachable this cycle',
          description:
            'On the current trajectory, closing the renewal-insight gap is worth more than any new acquisition push.',
        },
      ],
    },
  },
  {
    intent: 'performance_overview',
    key_message: 'The commercial scoreboard',
    content: {
      type: 'performance_overview',
      period: 'Rolling 4 quarters',
      kpis: [
        { name: 'Digital ARR', value: 7.4, unit: '€M', target: 8, trend: 'up', status: 'good' },
        { name: 'Attach rate', value: 18, unit: '%', target: 22, trend: 'up', status: 'warning' },
        {
          name: 'Net revenue retention',
          value: 108,
          unit: '%',
          target: 115,
          trend: 'up',
          status: 'warning',
        },
        {
          name: 'APAC churn',
          value: 4.1,
          unit: '%',
          target: 2.5,
          trend: 'flat',
          status: 'critical',
        },
      ],
      context:
        'Baseline is FY2014: ARR €6.2M, attach rate 11 %. Targets are the approved digital growth commitments.',
    },
  },
  {
    intent: 'single_insight',
    key_message: 'ARR growth is steady — the €8M gap closes on retention, not new logos',
    content: {
      type: 'single_insight',
      chart_type: 'bar',
      chart_data: {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        series: [
          { name: 'Digital ARR (€M)', values: [6.2, 6.6, 7.0, 7.4] },
          { name: 'Target (€M)', values: [8, 8, 8, 8] },
        ],
      },
      insight_text:
        'Each quarter added roughly €0.4M. Holding APAC churn at the target rate is worth more than a quarter of new-logo growth.',
      source: 'Results KPI — Digital ARR (owner: Thomas Viau)',
    },
  },
  {
    intent: 'comparison',
    key_message: 'Defend the base, or push acquisition',
    content: {
      type: 'comparison',
      left_label: 'Defend the installed base',
      right_label: 'Push new acquisition',
      left_items: [
        'Closes the churn gap where the revenue already exists',
        'Renewal insight consolidation is a data change, not a headcount change',
        'Lifts net revenue retention toward the 115 % path',
      ],
      right_items: [
        'Adds top-line, but at a higher cost per euro of ARR',
        'Does not address why APAC revenue leaves',
        'Compounds the renewal-visibility problem at a larger base',
      ],
      verdict:
        'Defend first. Retention is the cheaper euro this cycle, and it is the one the current data gap is destroying.',
    },
  },
  {
    intent: 'roadmap',
    key_message: 'How the growth plan sequences',
    content: {
      type: 'roadmap',
      phases: [
        {
          label: 'Now',
          timeframe: 'This quarter',
          status: 'in_progress',
          items: [
            'Consolidate renewal insight into a single view',
            'Instrument early-warning churn signals for APAC',
          ],
        },
        {
          label: 'Next',
          timeframe: 'Next quarter',
          status: 'planned',
          items: [
            'Renewal playbook by segment',
            'Attach-rate motion extended to the second hardware line',
          ],
        },
        {
          label: 'Then',
          timeframe: 'FY2016',
          status: 'planned',
          items: ['Retention path to 115 % NRR', 'ARR commitment at €8M held for a full year'],
        },
      ],
    },
  },
  {
    intent: 'risk_management',
    key_message: 'What could take the €8M off the table',
    content: {
      type: 'risk_management',
      risks: [
        {
          risk: 'APAC churn continues to surface after the renewal window',
          likelihood: 'high',
          impact: 'high',
          mitigation: 'Early-warning signals wired into the renewal cadence, not a monthly report.',
          owner: 'Thomas Viau',
        },
        {
          risk: 'Renewal data stays fragmented across systems',
          likelihood: 'medium',
          impact: 'high',
          mitigation: 'Consolidation is the first deliverable, ahead of any new commercial motion.',
          owner: 'Thomas Viau',
        },
        {
          risk: 'Attach-rate motion does not transfer to the second hardware line',
          likelihood: 'medium',
          impact: 'medium',
          mitigation: 'Pilot on one region before committing the commercial plan.',
          owner: 'Claire Laurent',
        },
      ],
    },
  },
  {
    intent: 'next_steps',
    key_message: 'Owners and dates',
    content: {
      type: 'next_steps',
      actions: [
        {
          action: 'Consolidate renewal insight into one view',
          owner: 'Thomas Viau',
          deadline: 'This quarter',
          status: 'in_progress',
        },
        {
          action: 'Instrument early-warning churn signals for APAC',
          owner: 'Thomas Viau',
          deadline: 'This quarter',
          status: 'pending',
        },
        {
          action: 'Publish the renewal playbook by segment',
          owner: 'Claire Laurent',
          deadline: 'Next quarter',
          status: 'pending',
        },
      ],
      closing_message:
        'The growth story is intact. The next euro of ARR is cheaper to defend than to acquire — that is what this plan funds.',
    },
  },
];

export const ATELIER_PRESENTATION_DECKS: AtelierDeckTemplate[] = [
  {
    slug: 'forward-board-readout',
    title: 'Atelier Forward — 2015 Board Readout',
    description:
      'Executive story: discovery → diagnosis → 22-initiative portfolio → €1.4M banked value.',
    templateId: 'executive-standard',
    deckType: 'executive',
    audience: 'Executive',
    goal: 'Board update',
    theme: 'consultify-dark',
    presentationMode: 'standard',
    status: 'ready',
    sourceType: 'assessment',
    createdBySlug: 'antoine-laurent',
    sourceInitiativeSlug: 'line-3-digital-twin',
    sourceRefs: PORTFOLIO_SOURCE_REFS,
    slides: FORWARD_BOARD_READOUT_SLIDES,
  },
  {
    slug: 'line3-steering',
    title: 'Line 3 Digital Twin — Steering Committee Deck',
    description: 'OEE 74→80→82%, downtime economics, phase-2 budget decision.',
    templateId: 'executive-standard',
    deckType: 'executive',
    audience: 'Steering committee',
    goal: 'Gate decision',
    theme: 'consultify-dark',
    presentationMode: 'standard',
    status: 'ready',
    sourceType: 'tool',
    createdBySlug: 'marc-dubois',
    sourceInitiativeSlug: 'line-3-digital-twin',
    sourceRefs: LINE3_SOURCE_REFS,
    slides: LINE3_STEERING_SLIDES,
  },
  {
    slug: 'connected-play-growth',
    title: 'Connected Play — Growth Story',
    description: 'Digital ARR €6.2M→€7.4M, attach rate 11%→18%, retention path to 115%.',
    templateId: 'executive-standard',
    deckType: 'executive',
    audience: 'Commercial leadership',
    goal: 'Growth review',
    theme: 'consultify-dark',
    presentationMode: 'standard',
    // MIGRATION NOTE: the live row carries `status = 'exported'`, which IS
    // accepted by the database CHECK but is absent from the TypeScript
    // `DeckStatus` union — the two vocabularies disagree (see the field doc on
    // `AtelierDeckTemplate.status`). The deck has `export_path = NULL` and no
    // export artifact on disk, so 'exported' was never true anyway; the seed
    // converges it to 'ready', which is legal in BOTH vocabularies.
    status: 'ready',
    sourceType: 'finance',
    createdBySlug: 'thomas-viau',
    sourceInitiativeSlug: 'atelier-digital-growth',
    sourceRefs: GROWTH_SOURCE_REFS,
    slides: CONNECTED_PLAY_GROWTH_SLIDES,
  },
];

export function getAtelierPresentationDecks(): AtelierDeckTemplate[] {
  return ATELIER_PRESENTATION_DECKS;
}
