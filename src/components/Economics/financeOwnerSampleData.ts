/**
 * Deterministic, explicitly requested owner-review data for the Finance registries.
 * It is enabled only by `sampleData=finance-vnext` and never impersonates DB readback.
 */

export const FINANCE_OWNER_SAMPLE_STATEMENTS = [
  {
    id: 'sample-finance-pack-fy2025',
    entity_name: 'CD Projekt Group — FY 2025',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    period_label: 'FY 2025',
    currency: 'PLN',
    scaling: 'thousands',
    pack_status: 'approved',
    validation_status: 'approved',
    pack_readiness_status: 'ready',
    pack_readiness_score: 100,
    overall_confidence: 0.98,
    pl_count: 1,
    bs_count: 1,
    cf_count: 1,
    source_statement_count: 3,
    updated_at: '2026-08-23T08:00:00.000Z',
    statements: [
      { id: 'sample-pl', statement_type: 'P&L', status: 'approved', readiness_status: 'ready', readiness_score: 100, validation_status: 'approved', mapped_line_count: 124, total_line_count: 124, unmapped_line_count: 0, source_file_name: 'CDP-FY2025.pdf' },
      { id: 'sample-bs', statement_type: 'BS', status: 'approved', readiness_status: 'ready', readiness_score: 100, validation_status: 'approved', mapped_line_count: 132, total_line_count: 132, unmapped_line_count: 0, source_file_name: 'CDP-FY2025.pdf' },
      { id: 'sample-cf', statement_type: 'CF', status: 'approved', readiness_status: 'ready', readiness_score: 100, validation_status: 'approved', mapped_line_count: 116, total_line_count: 116, unmapped_line_count: 0, source_file_name: 'CDP-FY2025.pdf' },
    ],
  },
];

export const FINANCE_OWNER_SAMPLE_MODELS = [
  {
    id: 'sample-finance-baseline',
    name: 'GoldCo operating baseline 2026–2028',
    artifact_type: 'BASELINE_MODEL',
    status: 'APPROVED',
    scenario: 'base',
    currency: 'PLN',
    horizon_months: 36,
    start_date: '2026-01-01',
    source_statement_pack_id: 'sample-finance-pack-fy2025',
    event_count: 372,
    updated_at: '2026-08-23T09:00:00.000Z',
  },
  {
    id: 'sample-finance-prediction-standard',
    name: 'STANDARD BASE prediction 2026–2028',
    artifact_type: 'PREDICTION_SCENARIO',
    status: 'REVIEW',
    scenario: 'base',
    currency: 'PLN',
    horizon_months: 36,
    start_date: '2026-01-01',
    source_statement_pack_id: 'sample-finance-pack-fy2025',
    event_count: 372,
    updated_at: '2026-08-23T10:00:00.000Z',
  },
];

export const FINANCE_OWNER_SAMPLE_ANALYSES = [
  {
    id: 'sample-finance-analysis',
    title: 'FY 2025 liquidity and profitability analysis',
    status: 'APPROVED',
    analysis_type: 'comprehensive',
    currency: 'PLN',
    periods: ['2024', '2025'],
    source_statement_ids: ['sample-pl', 'sample-bs', 'sample-cf'],
    source_statement_pack_id: 'sample-finance-pack-fy2025',
    updated_at: '2026-08-23T09:30:00.000Z',
  },
  {
    id: 'sample-finance-investment-analysis',
    title: 'Automation investment case',
    status: 'DRAFT',
    analysis_type: 'investment_case',
    currency: 'PLN',
    periods: ['2026', '2027', '2028'],
    source_statement_pack_id: 'sample-finance-pack-fy2025',
    updated_at: '2026-08-22T14:00:00.000Z',
  },
];

export const FINANCE_OWNER_SAMPLE_VALUATIONS = [
  {
    id: 'sample-finance-valuation-dcf',
    title: 'Enterprise value — DCF FCFF',
    status: 'APPROVED',
    source_type: 'prediction',
    method: 'DCF_FCFF',
    currency: 'PLN',
    horizon_years: 5,
    updated_at: '2026-08-23T11:00:00.000Z',
  },
];

export function isFinanceOwnerSampleDataEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('sampleData') === 'finance-vnext';
}
