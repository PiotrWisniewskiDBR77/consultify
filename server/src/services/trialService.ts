/**
 * Trial Service (legacy placeholder removal)
 *
 * Historically this module used the lazy service loader which returns a stub proxy when the legacy
 * implementation is missing. That masks missing functionality and can lead to runtime "success"
 * paths that never touch real code.
 *
 * We intentionally export an empty object so callers can detect missing methods and return an
 * honest `503` (routes) or skip scheduled work (cron) until a real implementation exists.
 */
const trialService: Record<string, never> = {};

export default trialService;
