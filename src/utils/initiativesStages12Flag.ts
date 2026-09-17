type InitiativesStages12Env = { VITE_INITIATIVES_STAGES_12?: string };

/** DEC-539 rollout guard. Missing, empty and every value except exact `true` are OFF. */
export const isInitiativesStages12Enabled = (
  env: InitiativesStages12Env = import.meta.env as InitiativesStages12Env
): boolean => env.VITE_INITIATIVES_STAGES_12 === 'true';
