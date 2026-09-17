// DEC-590 (Wpis 73 / C3c): the presentation-state writer that run.mjs hands to
// page.evaluate. Playwright serializes this function by source and runs it in the
// BROWSER, where Node imports (e.g. onboardingDoneKey from ./onboarding.mjs) do NOT
// exist — referencing one throws ReferenceError and, in run 2, failed all 8 variants
// (8/8 FAILURE). Therefore this body may reference ONLY its argument and browser
// globals (localStorage, JSON). The onboarding key is computed in NODE by the caller
// and passed in as `onboardingKey`. presentationState.test.mjs runs this function in
// an empty node:vm scope so any leaked Node symbol reddens a test instead of silently
// re-breaking the whole matrix.
export function applyPresentationState({ locale, theme, onboardingKey }) {
  localStorage.setItem('i18nextLng', locale);
  localStorage.setItem('consultify_language', locale);
  localStorage.setItem('theme', theme);
  // DEC-590 (Wpis 39): dismiss the first-run onboarding modal for the service
  // account. useFirstRunOnboarding reads `{onboardingKey}` === 'true' as an instant
  // local guard BEFORE any server call, so this touches no server-side preference.
  if (onboardingKey) {
    localStorage.setItem(onboardingKey, 'true');
  }
  const raw = localStorage.getItem('consultify-storage');
  let parsed = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {}
  parsed.state = { ...(parsed.state || {}), theme };
  parsed.version ??= 2;
  localStorage.setItem('consultify-storage', JSON.stringify(parsed));
}
