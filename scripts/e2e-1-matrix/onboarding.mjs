// DEC-590 (Wpis 47, gap D): the first-run onboarding guard key used by the matrix
// to dismiss the onboarding modal for service accounts. It MUST stay byte-identical
// to the front-end builder `doneKey` in
// src/components/Onboarding/useFirstRunOnboarding.ts:21, otherwise the modal covers
// every screen again (run 1: 147/154 FAIL). Keeping it in its own module lets
// contract.test.mjs pin it against the front-end source; a mutation here now fails
// a test instead of silently re-breaking the whole matrix.
export function onboardingDoneKey(userId) {
  return `consultify_onboarding_done:${userId}`;
}
