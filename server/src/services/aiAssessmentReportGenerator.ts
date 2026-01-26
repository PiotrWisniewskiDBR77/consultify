// @ts-nocheck
/**
 * aiAssessmentReportGenerator
 *
 * NOTE:
 * The previous `.js` shim was self-re-exporting (circular) and broke both runtime
 * resolution (tsx) and typechecking. Until the full generator is migrated, we
 * expose a minimal, stable surface used by `routes/assessment/assessment-ai.routes.ts`.
 */

export const REPORT_TYPES = {
  full: 'full',
  stakeholder: 'stakeholder',
  benchmark: 'benchmark',
  initiativePlan: 'initiative_plan',
} as const;

export const STAKEHOLDER_ROLES = {
  owner: 'owner',
  pmo: 'pmo',
  consultant: 'consultant',
  sponsor: 'sponsor',
} as const;

export const aiAssessmentReportGenerator = {
  async generateFullReport(_assessment: any, _options?: any) {
    return { status: 'not_implemented', report: null };
  },
  async generateStakeholderReport(_assessment: any, _role: any, _options?: any) {
    return { status: 'not_implemented', report: null };
  },
  async generateBenchmarkReport(_assessment: any, _benchmarkId?: any, _options?: any) {
    return { status: 'not_implemented', report: null };
  },
  async generateInitiativePlan(_assessment: any, _planTypeOrOptions?: any, _optionsMaybe?: any) {
    return { status: 'not_implemented', plan: null };
  },
} as const;

export default aiAssessmentReportGenerator;
