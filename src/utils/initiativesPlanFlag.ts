type InitiativePlanEnv = Record<string, string | boolean | undefined>;

/** Release gate for the Wave 2 Initiatives Plan workspace. Default is OFF. */
export const isInitiativesPlanEnabled = (
  env: InitiativePlanEnv = import.meta.env as InitiativePlanEnv
): boolean => env.VITE_INITIATIVES_PLAN === 'true';
