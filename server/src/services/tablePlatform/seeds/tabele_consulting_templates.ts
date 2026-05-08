/**
 * Tabele consulting templates seed pack (Block A · EPIC-T5 · Sprint 2)
 *
 * Ships 30 templates that match the consulting workflows in
 * `DRD/consultify/docs/product/work-packets/tabele-full-product/block-A-template-catalog/epics/EPIC-T5_CONSULTING_TEMPLATE_PACK.md`:
 *
 *   * 12 entries land as `status='approved'` (the highest-frequency consulting
 *     deliverables — Initiative / Risk / Action / Stakeholder / Decision /
 *     Issue / MEDDPICC / ICP Fit / MAP / Sales Pipeline / KPI Matrix /
 *     Implementation Tracker).
 *   * 18 entries land as `status='draft'` (longer-tail or specialized).
 *
 * All field types are drawn from `SchemaValidationService.ALLOWED_FIELD_TYPES`
 * — anything that requires the EPIC-T7 specialised types (`risk_score`,
 * `source_reference`, `ai_generated_summary`, `priority`, …) falls back to a
 * close-enough generic equivalent (`rating`, `url`, `longText`, `singleSelect`
 * with consulting-grade choices). EPIC-T7 will rewrite these fields in place
 * via a follow-up migration; the `governance_rules.fallback_field_upgrades`
 * map records exactly which field needs which upgrade so the rewrite is
 * mechanical.
 *
 * Idempotency key: `governance_rules.seed_id` (stable slug, never reused).
 * The seeder uses it to decide INSERT vs UPDATE without relying on
 * `tp_base_templates.name` which has no UNIQUE constraint.
 */

export type TabeleTemplateStatus = 'approved' | 'draft';

export interface TabeleTemplateField {
  name: string;
  fieldType: string;
  required?: boolean;
  options?: Record<string, unknown>;
  formula?: string;
  description?: string;
}

export interface TabeleTemplateTable {
  name: string;
  description?: string;
  fields: TabeleTemplateField[];
}

export interface TabeleTemplateSchemaSnapshot {
  tables: TabeleTemplateTable[];
}

export interface TabeleTemplateGovernanceRules {
  seed_id: string;
  audience: string[];
  required_inputs: string[];
  approval_required_fields: string[];
  source_required_fields: string[];
  ai_fill_disallowed_fields: string[];
  min_records_for_publish: number;
  review_cadence_days: number;
  fallback_field_upgrades?: Record<string, string>;
}

export interface TabeleTemplateSeed {
  seed_id: string;
  name: string;
  description: string;
  category: string;
  status: TabeleTemplateStatus;
  version: string;
  is_featured: boolean;
  schema_snapshot: TabeleTemplateSchemaSnapshot;
  governance_rules: TabeleTemplateGovernanceRules;
}

// ── Field builders ───────────────────────────────────────────────────────────
//
// All builders return objects compatible with the existing
// `tp_base_templates.schema_snapshot.tables[].fields[]` shape consumed by
// `TemplateService.createFromTemplate` and validated by
// `SchemaValidationService`.

const f = {
  text: (name: string, required = false): TabeleTemplateField => ({
    name,
    fieldType: 'singleLineText',
    required,
  }),
  longText: (name: string, required = false): TabeleTemplateField => ({
    name,
    fieldType: 'longText',
    required,
  }),
  number: (name: string, required = false): TabeleTemplateField => ({
    name,
    fieldType: 'number',
    required,
  }),
  percent: (name: string, required = false): TabeleTemplateField => ({
    name,
    fieldType: 'percent',
    required,
  }),
  currency: (name: string, symbol = 'PLN', required = false): TabeleTemplateField => ({
    name,
    fieldType: 'currency',
    required,
    options: { symbol, precision: 2 },
  }),
  date: (name: string, required = false): TabeleTemplateField => ({
    name,
    fieldType: 'date',
    required,
  }),
  rating: (name: string, max = 5, required = false): TabeleTemplateField => ({
    name,
    fieldType: 'rating',
    required,
    options: { max },
  }),
  checkbox: (name: string): TabeleTemplateField => ({ name, fieldType: 'checkbox' }),
  email: (name: string): TabeleTemplateField => ({ name, fieldType: 'email' }),
  phone: (name: string): TabeleTemplateField => ({ name, fieldType: 'phone' }),
  url: (name: string): TabeleTemplateField => ({ name, fieldType: 'url' }),
  user: (name: string, required = false): TabeleTemplateField => ({
    name,
    fieldType: 'user',
    required,
  }),
  status: (name: string, choices: Array<{ name: string; color: string }>): TabeleTemplateField => ({
    name,
    fieldType: 'singleSelect',
    options: { choices },
  }),
  multi: (name: string, choices: Array<{ name: string; color: string }>): TabeleTemplateField => ({
    name,
    fieldType: 'multiSelect',
    options: { choices },
  }),
  formula: (name: string, expression: string): TabeleTemplateField => ({
    name,
    fieldType: 'formula',
    formula: expression,
  }),

  // Specialised-type fallbacks (EPIC-T7 will rewrite). The map below describes
  // the eventual upgrade per field name; consumers (and the upgrade migration)
  // can read it from `governance_rules.fallback_field_upgrades`.
  priorityFallback: (name = 'Priority'): TabeleTemplateField => ({
    name,
    fieldType: 'singleSelect',
    options: {
      choices: [
        { name: 'Low', color: 'gray' },
        { name: 'Medium', color: 'yellow' },
        { name: 'High', color: 'orange' },
        { name: 'Critical', color: 'red' },
      ],
    },
  }),
  sourceFallback: (name = 'Source'): TabeleTemplateField => ({
    name,
    fieldType: 'url',
    description:
      'Fallback for source_reference field type (EPIC-T7). Stores a single source URL or artifact id; the full record provenance lives in tp_record_sources.',
  }),
  aiSummaryFallback: (name = 'AI Recommendation'): TabeleTemplateField => ({
    name,
    fieldType: 'longText',
    description:
      'Fallback for ai_generated_summary field type (EPIC-T7). Free-form longText until the AI-derived field type ships; manually editable for now.',
  }),
  riskScoreFallback: (name = 'Risk Score'): TabeleTemplateField => ({
    name,
    fieldType: 'rating',
    options: { max: 5 },
    description:
      'Fallback for risk_score field type (EPIC-T7). 1-5 rating until the dedicated type ships.',
  }),
};

const STATUS_CHOICES_GENERIC = [
  { name: 'Idea', color: 'gray' },
  { name: 'Selected', color: 'blue' },
  { name: 'In progress', color: 'yellow' },
  { name: 'Done', color: 'green' },
  { name: 'Dropped', color: 'red' },
];

const STATUS_CHOICES_BUSINESS = [
  { name: 'Open', color: 'blue' },
  { name: 'In review', color: 'yellow' },
  { name: 'Approved', color: 'green' },
  { name: 'Rejected', color: 'red' },
  { name: 'Closed', color: 'gray' },
];

const STATUS_CHOICES_RAG = [
  { name: 'Green', color: 'green' },
  { name: 'Amber', color: 'orange' },
  { name: 'Red', color: 'red' },
];

const SALES_STAGE_CHOICES = [
  { name: 'Discovery', color: 'blue' },
  { name: 'Qualification', color: 'cyan' },
  { name: 'Demo', color: 'yellow' },
  { name: 'Proposal', color: 'orange' },
  { name: 'Negotiation', color: 'pink' },
  { name: 'Closed Won', color: 'green' },
  { name: 'Closed Lost', color: 'red' },
];

const DEFAULT_FALLBACK_UPGRADES = {
  Priority: 'priority',
  'Risk Score': 'risk_score',
  Source: 'source_reference',
  'AI Recommendation': 'ai_generated_summary',
};

// ── Helper to build a governance_rules block ─────────────────────────────────

function gov(
  partial: Partial<TabeleTemplateGovernanceRules> & {
    seed_id: string;
    audience: string[];
  }
): TabeleTemplateGovernanceRules {
  return {
    seed_id: partial.seed_id,
    audience: partial.audience,
    required_inputs: partial.required_inputs ?? [],
    approval_required_fields: partial.approval_required_fields ?? [],
    source_required_fields: partial.source_required_fields ?? [],
    ai_fill_disallowed_fields: partial.ai_fill_disallowed_fields ?? [],
    min_records_for_publish: partial.min_records_for_publish ?? 3,
    review_cadence_days: partial.review_cadence_days ?? 30,
    fallback_field_upgrades: partial.fallback_field_upgrades ?? { ...DEFAULT_FALLBACK_UPGRADES },
  };
}

// ── Template list (12 approved + 18 draft) ───────────────────────────────────

export const TABELE_CONSULTING_TEMPLATES: TabeleTemplateSeed[] = [
  // ===== 12 approved =======================================================
  {
    seed_id: 'tab-init-reg',
    name: 'Initiative Register',
    description: 'Operational initiative register with owner, scoring and status.',
    category: 'strategy',
    status: 'approved',
    version: '1.0.0',
    is_featured: true,
    schema_snapshot: {
      tables: [
        {
          name: 'Initiatives',
          description: 'Strategic and operational initiatives',
          fields: [
            f.text('Title', true),
            f.user('Owner', true),
            f.status('Status', STATUS_CHOICES_GENERIC),
            f.priorityFallback(),
            f.rating('Impact', 5),
            f.rating('Effort', 5),
            f.formula('ROI Score', 'Impact / max(Effort, 1)'),
            f.riskScoreFallback(),
            f.sourceFallback(),
            f.aiSummaryFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-init-reg',
      audience: ['PMO', 'Leadership'],
      required_inputs: ['Title', 'Owner'],
      approval_required_fields: ['Owner', 'Status'],
      source_required_fields: ['Source'],
      ai_fill_disallowed_fields: ['Owner'],
      min_records_for_publish: 3,
    }),
  },
  {
    seed_id: 'tab-risk-reg-ops',
    name: 'Risk Register (operational)',
    description: 'Operational risk register with likelihood, impact, mitigation owner.',
    category: 'risk',
    status: 'approved',
    version: '1.0.0',
    is_featured: true,
    schema_snapshot: {
      tables: [
        {
          name: 'Risks',
          fields: [
            f.text('Risk Title', true),
            f.longText('Description'),
            f.user('Owner', true),
            f.rating('Likelihood', 5, true),
            f.rating('Impact', 5, true),
            f.formula('Risk Score', 'Likelihood * Impact'),
            f.status('RAG', STATUS_CHOICES_RAG),
            f.longText('Mitigation'),
            f.date('Review Due'),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-risk-reg-ops',
      audience: ['PMO', 'Risk owners'],
      approval_required_fields: ['Owner', 'RAG'],
      source_required_fields: ['Source'],
      review_cadence_days: 14,
    }),
  },
  {
    seed_id: 'tab-action-plan',
    name: 'Action Plan',
    description: 'Action items with owner, due date, dependency and status.',
    category: 'execution',
    status: 'approved',
    version: '1.0.0',
    is_featured: true,
    schema_snapshot: {
      tables: [
        {
          name: 'Actions',
          fields: [
            f.text('Action', true),
            f.user('Owner', true),
            f.date('Due', true),
            f.status('Status', STATUS_CHOICES_GENERIC),
            f.priorityFallback(),
            f.longText('Dependency'),
            f.checkbox('Blocked'),
            f.longText('Outcome'),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-action-plan',
      audience: ['Project teams'],
      approval_required_fields: ['Owner', 'Due'],
      ai_fill_disallowed_fields: ['Owner'],
    }),
  },
  {
    seed_id: 'tab-stake-map',
    name: 'Stakeholder Map',
    description: 'Stakeholders with influence/interest, sentiment and engagement plan.',
    category: 'change',
    status: 'approved',
    version: '1.0.0',
    is_featured: true,
    schema_snapshot: {
      tables: [
        {
          name: 'Stakeholders',
          fields: [
            f.text('Name', true),
            f.text('Role'),
            f.text('Org / Department'),
            f.email('Email'),
            f.rating('Influence', 5),
            f.rating('Interest', 5),
            f.status('Sentiment', [
              { name: 'Champion', color: 'green' },
              { name: 'Supporter', color: 'cyan' },
              { name: 'Neutral', color: 'gray' },
              { name: 'Skeptic', color: 'orange' },
              { name: 'Blocker', color: 'red' },
            ]),
            f.longText('Engagement Plan'),
            f.date('Last Contact'),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-stake-map',
      audience: ['Change leads'],
      ai_fill_disallowed_fields: ['Sentiment'],
    }),
  },
  {
    seed_id: 'tab-decision-log',
    name: 'Decision Log',
    description: 'Steering-committee decisions with context, rationale and consequence.',
    category: 'governance',
    status: 'approved',
    version: '1.0.0',
    is_featured: true,
    schema_snapshot: {
      tables: [
        {
          name: 'Decisions',
          fields: [
            f.text('Decision', true),
            f.date('Decided On', true),
            f.user('Decided By', true),
            f.longText('Context'),
            f.longText('Rationale'),
            f.longText('Consequence'),
            f.status('Status', STATUS_CHOICES_BUSINESS),
            f.sourceFallback(),
            f.aiSummaryFallback('AI Summary'),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-decision-log',
      audience: ['Steering committees'],
      approval_required_fields: ['Decided By', 'Status'],
      source_required_fields: ['Source'],
      review_cadence_days: 90,
    }),
  },
  {
    seed_id: 'tab-issue-log',
    name: 'Issue Log',
    description: 'Issues with severity, owner, mitigation and status.',
    category: 'governance',
    status: 'approved',
    version: '1.0.0',
    is_featured: true,
    schema_snapshot: {
      tables: [
        {
          name: 'Issues',
          fields: [
            f.text('Issue', true),
            f.user('Owner', true),
            f.status('Severity', [
              { name: 'Critical', color: 'red' },
              { name: 'High', color: 'orange' },
              { name: 'Medium', color: 'yellow' },
              { name: 'Low', color: 'gray' },
            ]),
            f.status('Status', STATUS_CHOICES_GENERIC),
            f.date('Reported On'),
            f.date('Target Resolution'),
            f.longText('Mitigation'),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-issue-log',
      audience: ['PMO'],
      approval_required_fields: ['Owner', 'Status'],
    }),
  },
  {
    seed_id: 'tab-meddpicc',
    name: 'MEDDPICC Qualification Sheet',
    description: 'Sales opportunity qualification using the MEDDPICC framework.',
    category: 'sales',
    status: 'approved',
    version: '1.0.0',
    is_featured: true,
    schema_snapshot: {
      tables: [
        {
          name: 'MEDDPICC',
          fields: [
            f.text('Account', true),
            f.text('Opportunity', true),
            f.user('Owner', true),
            f.longText('Metrics'),
            f.text('Economic Buyer'),
            f.longText('Decision Criteria'),
            f.longText('Decision Process'),
            f.longText('Paper Process'),
            f.longText('Identified Pain'),
            f.text('Champion'),
            f.text('Competition'),
            f.percent('Confidence'),
            f.status('Status', SALES_STAGE_CHOICES),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-meddpicc',
      audience: ['Sales'],
      approval_required_fields: ['Owner', 'Status'],
      source_required_fields: ['Source'],
      ai_fill_disallowed_fields: ['Champion', 'Economic Buyer'],
      review_cadence_days: 7,
    }),
  },
  {
    seed_id: 'tab-icp-fit',
    name: 'ICP Fit Score Sheet',
    description: 'Score accounts against the Ideal Customer Profile.',
    category: 'sales',
    status: 'approved',
    version: '1.0.0',
    is_featured: true,
    schema_snapshot: {
      tables: [
        {
          name: 'ICP Fit',
          fields: [
            f.text('Account', true),
            f.text('Industry'),
            f.text('Country'),
            f.number('Headcount'),
            f.currency('Revenue (annual)', 'PLN'),
            f.rating('ICP Match', 5, true),
            f.rating('Buying Intent', 5),
            f.formula('Composite Score', '(ICP Match + Buying Intent) / 2'),
            f.longText('Why a fit'),
            f.sourceFallback(),
            f.aiSummaryFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-icp-fit',
      audience: ['Sales'],
      source_required_fields: ['Source'],
    }),
  },
  {
    seed_id: 'tab-map',
    name: 'Mutual Action Plan',
    description: 'Joint customer + seller action plan toward signature.',
    category: 'sales',
    status: 'approved',
    version: '1.0.0',
    is_featured: true,
    schema_snapshot: {
      tables: [
        {
          name: 'MAP Steps',
          fields: [
            f.text('Step', true),
            f.user('Seller Owner'),
            f.text('Customer Owner'),
            f.date('Target Date'),
            f.status('Status', STATUS_CHOICES_GENERIC),
            f.checkbox('Customer Acknowledged'),
            f.longText('Notes'),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-map',
      audience: ['Sales', 'Customer success'],
      approval_required_fields: ['Seller Owner', 'Status'],
      ai_fill_disallowed_fields: ['Customer Owner'],
    }),
  },
  {
    seed_id: 'tab-sales-pipe',
    name: 'Sales Pipeline Table',
    description: 'Pipeline of open deals with stage, value, close date and confidence.',
    category: 'sales',
    status: 'approved',
    version: '1.0.0',
    is_featured: true,
    schema_snapshot: {
      tables: [
        {
          name: 'Deals',
          fields: [
            f.text('Deal Name', true),
            f.text('Account'),
            f.user('Owner', true),
            f.status('Stage', SALES_STAGE_CHOICES),
            f.currency('Amount', 'PLN', true),
            f.date('Close Date', true),
            f.percent('Probability'),
            f.formula('Weighted Amount', 'Amount * Probability'),
            f.longText('Next Steps'),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-sales-pipe',
      audience: ['Sales leadership'],
      approval_required_fields: ['Owner', 'Stage'],
      review_cadence_days: 7,
    }),
  },
  {
    seed_id: 'tab-kpi-matrix',
    name: 'KPI Matrix',
    description: 'KPI definitions with target, actual, owner and frequency.',
    category: 'operations',
    status: 'approved',
    version: '1.0.0',
    is_featured: true,
    schema_snapshot: {
      tables: [
        {
          name: 'KPIs',
          fields: [
            f.text('KPI', true),
            f.longText('Definition'),
            f.user('Owner', true),
            f.text('Unit'),
            f.number('Target'),
            f.number('Actual'),
            f.formula('Achievement %', '(Actual / max(Target, 1)) * 100'),
            f.status('Cadence', [
              { name: 'Daily', color: 'gray' },
              { name: 'Weekly', color: 'blue' },
              { name: 'Monthly', color: 'cyan' },
              { name: 'Quarterly', color: 'green' },
            ]),
            f.status('Status', STATUS_CHOICES_RAG),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-kpi-matrix',
      audience: ['Operations', 'Finance'],
      approval_required_fields: ['Owner'],
      source_required_fields: ['Source'],
    }),
  },
  {
    seed_id: 'tab-impl-tracker',
    name: 'Implementation Tracker',
    description: 'Track go-live activities, blockers and adoption signals.',
    category: 'execution',
    status: 'approved',
    version: '1.0.0',
    is_featured: true,
    schema_snapshot: {
      tables: [
        {
          name: 'Implementation',
          fields: [
            f.text('Workstream', true),
            f.user('Owner', true),
            f.status('Stage', [
              { name: 'Plan', color: 'gray' },
              { name: 'Build', color: 'blue' },
              { name: 'Test', color: 'yellow' },
              { name: 'Pilot', color: 'orange' },
              { name: 'Live', color: 'green' },
            ]),
            f.percent('Progress'),
            f.date('Go-live target'),
            f.longText('Open blockers'),
            f.status('RAG', STATUS_CHOICES_RAG),
            f.sourceFallback(),
            f.aiSummaryFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-impl-tracker',
      audience: ['PMO'],
      approval_required_fields: ['Owner', 'RAG'],
      review_cadence_days: 7,
    }),
  },

  // ===== 18 draft ===========================================================
  {
    seed_id: 'tab-proj-backlog',
    name: 'Project Backlog',
    description: 'Backlog of project tasks with priority, estimate and owner.',
    category: 'execution',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'Backlog',
          fields: [
            f.text('Item', true),
            f.user('Owner'),
            f.priorityFallback(),
            f.rating('Effort (1-5)', 5),
            f.rating('Value (1-5)', 5),
            f.status('Status', STATUS_CHOICES_GENERIC),
            f.longText('Acceptance criteria'),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-proj-backlog',
      audience: ['Project teams'],
    }),
  },
  {
    seed_id: 'tab-interview-tracker',
    name: 'Interview Tracker',
    description: 'Discovery interviews with respondent, theme and key findings.',
    category: 'research',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'Interviews',
          fields: [
            f.text('Respondent', true),
            f.text('Role'),
            f.text('Org'),
            f.date('Interview date'),
            f.user('Interviewer', true),
            f.multi('Themes', [
              { name: 'Pain', color: 'red' },
              { name: 'Goal', color: 'green' },
              { name: 'Workflow', color: 'blue' },
              { name: 'Tool', color: 'cyan' },
              { name: 'Budget', color: 'orange' },
            ]),
            f.longText('Key findings'),
            f.longText('Quotes'),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-interview-tracker',
      audience: ['Researchers'],
      source_required_fields: ['Source'],
    }),
  },
  {
    seed_id: 'tab-workshop-output',
    name: 'Workshop Output Table',
    description: 'Workshop session outputs grouped by exercise and decision owner.',
    category: 'research',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'Workshop Outputs',
          fields: [
            f.text('Workshop', true),
            f.date('Date'),
            f.text('Exercise'),
            f.user('Captured by'),
            f.longText('Output'),
            f.user('Decision owner'),
            f.status('Decision', STATUS_CHOICES_BUSINESS),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-workshop-output',
      audience: ['Workshop leads'],
    }),
  },
  {
    seed_id: 'tab-dt-roadmap',
    name: 'Digital Transformation Roadmap',
    description: 'Sequence of digital transformation initiatives with horizon and budget.',
    category: 'strategy',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'Roadmap',
          fields: [
            f.text('Initiative', true),
            f.status('Horizon', [
              { name: 'H1 (0-12m)', color: 'green' },
              { name: 'H2 (12-24m)', color: 'yellow' },
              { name: 'H3 (24m+)', color: 'gray' },
            ]),
            f.user('Owner', true),
            f.currency('Budget', 'PLN'),
            f.percent('Confidence'),
            f.priorityFallback(),
            f.status('Status', STATUS_CHOICES_GENERIC),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-dt-roadmap',
      audience: ['Transformation PMO'],
      review_cadence_days: 60,
    }),
  },
  {
    seed_id: 'tab-ai-uc-reg',
    name: 'AI Use Case Register',
    description: 'AI use cases with feasibility, value and risk score.',
    category: 'strategy',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'AI Use Cases',
          fields: [
            f.text('Use case', true),
            f.user('Owner'),
            f.longText('Problem statement'),
            f.rating('Feasibility', 5),
            f.rating('Business value', 5),
            f.riskScoreFallback(),
            f.status('Status', STATUS_CHOICES_GENERIC),
            f.sourceFallback(),
            f.aiSummaryFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-ai-uc-reg',
      audience: ['AI office'],
      ai_fill_disallowed_fields: ['Owner'],
    }),
  },
  {
    seed_id: 'tab-auto-opp-reg',
    name: 'Automation Opportunity Register',
    description: 'Process automation opportunities with effort and saving estimates.',
    category: 'operations',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'Automation Opportunities',
          fields: [
            f.text('Process', true),
            f.user('Owner'),
            f.rating('Volume / month', 5),
            f.rating('Manual effort', 5),
            f.currency('Estimated annual saving', 'PLN'),
            f.priorityFallback(),
            f.status('Status', STATUS_CHOICES_GENERIC),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-auto-opp-reg',
      audience: ['Operations'],
    }),
  },
  {
    seed_id: 'tab-bizcase',
    name: 'Business Case Table',
    description: 'Business case rows with cost / benefit / NPV.',
    category: 'finance',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'Business Cases',
          fields: [
            f.text('Initiative', true),
            f.currency('Cost', 'PLN'),
            f.currency('Annual benefit', 'PLN'),
            f.number('Payback (months)'),
            f.currency('NPV', 'PLN'),
            f.rating('Confidence', 5),
            f.user('Owner'),
            f.status('Status', STATUS_CHOICES_BUSINESS),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-bizcase',
      audience: ['Finance', 'Strategy'],
      source_required_fields: ['Source'],
    }),
  },
  {
    seed_id: 'tab-vendor-comp',
    name: 'Vendor Comparison Table',
    description: 'Compare vendors on price, capability fit and risk.',
    category: 'procurement',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'Vendors',
          fields: [
            f.text('Vendor', true),
            f.url('Website'),
            f.currency('Annual cost', 'PLN'),
            f.rating('Capability fit', 5),
            f.rating('Implementation effort', 5),
            f.riskScoreFallback(),
            f.longText('References'),
            f.status('Status', STATUS_CHOICES_BUSINESS),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-vendor-comp',
      audience: ['Procurement'],
      source_required_fields: ['Source'],
    }),
  },
  {
    seed_id: 'tab-research-source',
    name: 'Research Source Table',
    description: 'Sources used in a research synthesis with credibility rating.',
    category: 'research',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'Research Sources',
          fields: [
            f.text('Title', true),
            f.text('Author'),
            f.url('URL'),
            f.date('Published'),
            f.rating('Credibility', 5),
            f.longText('Key claim'),
            f.checkbox('Primary'),
            f.sourceFallback('Provenance'),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-research-source',
      audience: ['Researchers'],
      source_required_fields: ['URL'],
    }),
  },
  {
    seed_id: 'tab-sop-reg',
    name: 'SOP Register',
    description: 'Standard operating procedures with owner and review cadence.',
    category: 'operations',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'SOPs',
          fields: [
            f.text('SOP', true),
            f.user('Owner', true),
            f.url('Doc link'),
            f.date('Last reviewed'),
            f.number('Review cadence (days)'),
            f.status('Status', STATUS_CHOICES_BUSINESS),
            f.longText('Notes'),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-sop-reg',
      audience: ['Operations'],
      review_cadence_days: 90,
    }),
  },
  {
    seed_id: 'tab-change-tracker',
    name: 'Change Management Tracker',
    description: 'Change initiatives with adoption signals and risk score.',
    category: 'change',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'Change Initiatives',
          fields: [
            f.text('Initiative', true),
            f.user('Owner'),
            f.status('Stage', [
              { name: 'Awareness', color: 'gray' },
              { name: 'Desire', color: 'blue' },
              { name: 'Knowledge', color: 'cyan' },
              { name: 'Ability', color: 'yellow' },
              { name: 'Reinforcement', color: 'green' },
            ]),
            f.percent('Adoption'),
            f.riskScoreFallback(),
            f.longText('Resistance signals'),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-change-tracker',
      audience: ['Change leads'],
    }),
  },
  {
    seed_id: 'tab-train-plan',
    name: 'Training Plan Table',
    description: 'Training plan rows with audience, format and completion.',
    category: 'hr',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'Training Plan',
          fields: [
            f.text('Module', true),
            f.text('Audience'),
            f.status('Format', [
              { name: 'Self-paced', color: 'gray' },
              { name: 'Live online', color: 'blue' },
              { name: 'In-person', color: 'green' },
            ]),
            f.number('Duration (h)'),
            f.user('Trainer'),
            f.percent('Completion'),
            f.longText('Notes'),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-train-plan',
      audience: ['HR', 'Learning & Development'],
    }),
  },
  {
    seed_id: 'tab-gov-reg',
    name: 'Governance Register',
    description: 'Governance items (policies, controls) with owner and review cadence.',
    category: 'governance',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'Governance Items',
          fields: [
            f.text('Item', true),
            f.text('Type'),
            f.user('Owner', true),
            f.date('Last reviewed'),
            f.number('Review cadence (days)'),
            f.status('Status', STATUS_CHOICES_BUSINESS),
            f.longText('Notes'),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-gov-reg',
      audience: ['Risk', 'Compliance'],
      review_cadence_days: 90,
    }),
  },
  {
    seed_id: 'tab-audit-find',
    name: 'Audit Findings Table',
    description: 'Audit findings with severity, owner and remediation due date.',
    category: 'audit',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'Audit Findings',
          fields: [
            f.text('Finding', true),
            f.text('Reference (control id)'),
            f.status('Severity', [
              { name: 'Critical', color: 'red' },
              { name: 'High', color: 'orange' },
              { name: 'Medium', color: 'yellow' },
              { name: 'Low', color: 'gray' },
            ]),
            f.user('Owner', true),
            f.date('Remediation due'),
            f.status('Status', STATUS_CHOICES_GENERIC),
            f.longText('Remediation plan'),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-audit-find',
      audience: ['Audit', 'Risk'],
      source_required_fields: ['Source'],
    }),
  },
  {
    seed_id: 'tab-req-table',
    name: 'Requirements Table',
    description: 'Product requirements with type, priority and acceptance criteria.',
    category: 'product',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'Requirements',
          fields: [
            f.text('Requirement', true),
            f.status('Type', [
              { name: 'Functional', color: 'blue' },
              { name: 'Non-functional', color: 'cyan' },
              { name: 'Compliance', color: 'orange' },
            ]),
            f.priorityFallback(),
            f.longText('Acceptance criteria'),
            f.user('Owner'),
            f.status('Status', STATUS_CHOICES_GENERIC),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-req-table',
      audience: ['Product'],
    }),
  },
  {
    seed_id: 'tab-feat-prio',
    name: 'Feature Prioritization Table',
    description: 'Score features using RICE-like inputs.',
    category: 'product',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'Features',
          fields: [
            f.text('Feature', true),
            f.rating('Reach', 5),
            f.rating('Impact', 5),
            f.rating('Confidence', 5),
            f.rating('Effort', 5),
            f.formula('RICE Score', '(Reach * Impact * Confidence) / max(Effort, 1)'),
            f.user('Owner'),
            f.status('Status', STATUS_CHOICES_GENERIC),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-feat-prio',
      audience: ['Product'],
    }),
  },
  {
    seed_id: 'tab-roi-calc',
    name: 'ROI Calculation Table',
    description: 'Per-initiative ROI with horizon and net benefit.',
    category: 'finance',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'ROI Items',
          fields: [
            f.text('Initiative', true),
            f.currency('Investment', 'PLN', true),
            f.currency('Annual return', 'PLN'),
            f.number('Horizon (years)'),
            f.formula('Total return', 'Annual return * Horizon (years)'),
            f.formula('Net benefit', 'Total return - Investment'),
            f.formula(
              'ROI %',
              '((Annual return * Horizon (years)) - Investment) / max(Investment, 1) * 100'
            ),
            f.rating('Confidence', 5),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-roi-calc',
      audience: ['Finance'],
      source_required_fields: ['Source'],
    }),
  },
  {
    seed_id: 'tab-client-disc',
    name: 'Client Discovery Table',
    description: 'Discovery findings per client interaction.',
    category: 'sales',
    status: 'draft',
    version: '0.9.0',
    is_featured: false,
    schema_snapshot: {
      tables: [
        {
          name: 'Discovery',
          fields: [
            f.text('Account', true),
            f.text('Contact'),
            f.date('Interaction date'),
            f.multi('Themes', [
              { name: 'Goal', color: 'green' },
              { name: 'Pain', color: 'red' },
              { name: 'Tool', color: 'blue' },
              { name: 'Budget', color: 'orange' },
              { name: 'Timeline', color: 'yellow' },
            ]),
            f.longText('Findings'),
            f.longText('Quotes'),
            f.user('Owner'),
            f.sourceFallback(),
          ],
        },
      ],
    },
    governance_rules: gov({
      seed_id: 'tab-client-disc',
      audience: ['Sales'],
      source_required_fields: ['Source'],
    }),
  },
];

// Compile-time invariants the unit test re-asserts at runtime:
//   * exactly 30 entries, exactly 12 approved + 18 draft
//   * unique seed_ids
//   * each schema_snapshot.tables[0].fields has length >= 5
//   * every fieldType used exists in `SchemaValidationService.ALLOWED_FIELD_TYPES`
//
// The test file `tabele_consulting_templates.test.ts` proves these.
