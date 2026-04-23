export const ONBOARDING_KPI_PERSONAS = [
  'overall',
  'Partner',
  'CFO',
  'CEO',
  'COO',
  'CISO',
  'Transformation',
] as const;

export type OnboardingKpiPersona = (typeof ONBOARDING_KPI_PERSONAS)[number];

export type OnboardingKpiMetricKey =
  | 'activation_rate'
  | 'median_time_to_first_artifact'
  | 'connector_attach_rate_at_aha'
  | 'first_artifact_approved_rate';

export type OnboardingKpiStatus = 'green' | 'amber' | 'red';

export type OnboardingKpiMetricValue = {
  actual: number;
  target: number;
  status: OnboardingKpiStatus;
};

export type OnboardingKpiRow = {
  persona: string;
  startedSessions: number;
  activatedSessions: number;
  resumedSessions: number;
  abandonedSessions: number;
  metrics: Record<OnboardingKpiMetricKey, OnboardingKpiMetricValue>;
};

export type OnboardingKpiDashboard = {
  generatedAt: string;
  totals: OnboardingKpiRow;
  personas: OnboardingKpiRow[];
  last24hEventCount: number;
};
