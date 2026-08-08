/**
 * realTranslations — test-only helper (CB-01 pass 3) that mocks
 * `react-i18next`'s `useTranslation()` with a `t()` backed by the REAL
 * `public/locales/{lang}/translation.json` resource files, instead of an
 * ad-hoc string map hand-typed into each test.
 *
 * Why this exists: prior a11y tests asserted against the ENGLISH string
 * regardless of the `lang` passed to their i18n mock, which proves nothing
 * about the PL translation actually being present/correct. This resolves
 * dot-path keys against the shipped JSON and applies the same `{{var}}`
 * interpolation i18next uses, so a PL test genuinely fails if the Polish
 * key is missing or wrong.
 *
 * Not used by the app itself — import only from `*.test.tsx` files.
 */
import fs from 'node:fs';
import path from 'node:path';

export type SupportedTestLocale = 'en' | 'pl';

const resourceCache = new Map<SupportedTestLocale, Record<string, unknown>>();

function loadResource(lang: SupportedTestLocale): Record<string, unknown> {
  const cached = resourceCache.get(lang);
  if (cached) return cached;
  // Resolve from this file's own location so it works regardless of the
  // caller test file's directory depth.
  const filePath = path.resolve(__dirname, `../../public/locales/${lang}/translation.json`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  resourceCache.set(lang, parsed);
  return parsed;
}

function resolveKey(resource: Record<string, unknown>, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((node, segment) => {
    if (node && typeof node === 'object' && segment in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, resource);
  return typeof value === 'string' ? value : undefined;
}

function interpolate(template: string, opts?: Record<string, unknown>): string {
  if (!opts) return template;
  return Object.keys(opts).reduce((str, k) => {
    if (k === 'defaultValue' || k === 'returnObjects') return str;
    return str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(opts[k]));
  }, template);
}

/**
 * Returns a `t()` function that resolves keys against the real shipped
 * translation JSON for `lang`, falling back to the call site's own
 * `defaultValue`/positional default string only when the key is genuinely
 * absent from the resource (so a missing translation is still visible in
 * test output as English, exactly like the real app's i18next fallback
 * chain — but a PRESENT PL key is what actually gets asserted against).
 */
export function createRealT(lang: SupportedTestLocale) {
  const resource = loadResource(lang);
  return (key: string, defaultOrOpts?: unknown, maybeOpts?: unknown): string => {
    const opts =
      typeof maybeOpts === 'object' && maybeOpts !== null
        ? (maybeOpts as Record<string, unknown>)
        : typeof defaultOrOpts === 'object' && defaultOrOpts !== null
          ? (defaultOrOpts as Record<string, unknown>)
          : undefined;
    const fallback =
      typeof defaultOrOpts === 'string' ? defaultOrOpts : ((opts?.defaultValue as string) ?? key);
    const resolved = resolveKey(resource, key) ?? fallback;
    return interpolate(resolved, opts);
  };
}

/** Full `useTranslation()`-shaped mock value for `vi.mock('react-i18next', ...)`. */
export function createRealUseTranslation(lang: SupportedTestLocale) {
  const t = createRealT(lang);
  return () => ({
    t,
    i18n: { language: lang, getFixedT: () => t },
  });
}
