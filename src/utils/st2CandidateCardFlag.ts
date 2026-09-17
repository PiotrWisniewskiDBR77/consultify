type St2CandidateCardEnv = { VITE_ST2_CANDIDATE_CARD?: string };

/**
 * DEC-540 (U-09 / ST-2) rollout guard for the in-module initiative candidate
 * card. Fail-closed: a missing, empty, or any value other than the exact string
 * `true` is OFF, so the Interview module keeps its current behaviour until the
 * owner accepts the screen on a dump.
 */
export const isSt2CandidateCardEnabled = (
  env: St2CandidateCardEnv = import.meta.env as St2CandidateCardEnv
): boolean => env.VITE_ST2_CANDIDATE_CARD === 'true';
