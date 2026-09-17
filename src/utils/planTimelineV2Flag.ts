type PlanTimelineEnv = Record<string, string | boolean | undefined>;

/**
 * Release gate for the DEC-608/DEC-615 plan-card timeline (name column + bars
 * only in the centre). Default is OFF: the accepted mockup goes live only after
 * the owner approves the rendered screenshot.
 */
export const isPlanTimelineV2Enabled = (
  env: PlanTimelineEnv = import.meta.env as PlanTimelineEnv
): boolean => env.VITE_PLAN_TIMELINE_V2 === 'true';
