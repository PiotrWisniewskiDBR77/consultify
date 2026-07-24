/**
 * TEST-ONLY (dev-render harness, never ships to demo). Opt-in artificial
 * delay on `/locales/**` fetches so we can deterministically reproduce the
 * "useMemo/useCallback calls t() but doesn't depend on `t` → memo frozen with
 * a raw i18n key from before translations finished loading" race for
 * screenshot verification (CLAUDE.md regula #1 — realny runtime, nie docy).
 *
 * Zero effect unless `?slowLocale=<ms>` is present in the URL. Must be
 * imported BEFORE `../src/i18n` in dev-render/main.tsx so the patched
 * `window.fetch` is in place before i18next's HttpBackend fires its first
 * request (module side effects run in import order).
 */
(function installSlowLocaleFetch() {
  if (typeof window === 'undefined') return;
  const ms = Number(new URLSearchParams(window.location.search).get('slowLocale') || '0');
  if (!ms || Number.isNaN(ms) || ms <= 0) return;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/locales/')) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
    return realFetch(input as RequestInfo, init);
  };
  // eslint-disable-next-line no-console
  console.warn(`[dev-render] slowLocaleFetch active: /locales/** delayed by ${ms}ms`);
})();

export {};
