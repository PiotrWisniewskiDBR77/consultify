/**
 * s2-locale-added-keys.test.ts
 *
 * RISK-26 (P3) — locale-sweep gate for the S2-LOCALE stream.
 * Updated by S23-LOCALE (2026-08-12, RISK-38): the app's Japanese locale code
 * was migrated from 'jp' to 'ja' — see src/i18n.ts. 'jp' is not a valid
 * BCP47 subtag for Japanese ('ja' is); the app now resolves 'ja' natively and
 * reads `public/locales/ja/`. The old `public/locales/jp/` directory (richer
 * content — 2480 keys vs. the then-dead `ja/`'s 1175, plus 8 keys
 * (`reports.entry.*`) that only existed in `ja/`) was reconciled into the new
 * `public/locales/ja/` (nothing lost from either side) and removed. 'jp' is
 * kept as a read-time alias (see `LANGUAGE_ALIASES` in src/i18n.ts) so any
 * already-persisted 'jp' preference (localStorage, account/conversation
 * `language` columns) keeps resolving instead of stranding users — it is not
 * a locale file on disk anymore.
 *
 * This program (the "Ideas transformation" branch) added a batch of new keys
 * to `public/locales/pl` and `public/locales/en` on top of the origin/demo
 * baseline. Those keys previously had no translation at all in `de`, `es`,
 * `ar`, `ja` and silently fell back to the English developer default — not a
 * regression (they never had an entry), but not "done" either.
 *
 * Rather than hand-maintaining a list of "which keys were added" (which goes
 * stale the moment someone edits it without updating this file — the exact
 * kind of drift this test exists to catch), this test RE-DERIVES the added
 * key set at run time by diffing the current `en` translation file's flattened
 * key set against the same file as it existed at the pre-stream baseline
 * commit (`BASE_SHA`, origin/demo @ 2026-08 before this program started). This
 * mirrors the AST-based approach in `idea-workspace-required-keys.test.ts`
 * (which re-derives its scope by walking source files at run time instead of
 * hand-typing a key list) — the derivation source here is git history instead
 * of an AST, but the goal is the same: no hand-typed list to drift out of sync.
 *
 * Supported-locale decision for this stream (S2-LOCALE, 2026-08-12):
 *   - de, es, ar, ja (formerly jp): option (A) — keys added, machine/LLM-
 *     translated (not reviewed by a native speaker — see session report).
 *     Covered by this test.
 *   - pl, en: out of scope — they are this stream's read-only source of truth,
 *     covered separately by idea-workspace-required-keys.test.ts.
 *
 * Plural handling: i18next's PluralResolver calls `new Intl.PluralRules(lng)`
 * with the app's own locale code, not a re-mapped ISO code. Before the
 * S23-LOCALE migration the app's Japanese code was 'jp', which is NOT a valid
 * BCP47 language subtag, so Intl.PluralRules('jp') silently resolved to an
 * en-US-shaped rule (['one','other']) instead of the linguistically correct
 * Japanese-only ('other') rule — verified empirically, see the session
 * report. Now that the app resolves the real 'ja' subtag,
 * Intl.PluralRules('ja').resolvedOptions().pluralCategories is ['other']
 * only, and the `_one` duplicates that existed purely as a workaround for the
 * bug were removed from `public/locales/ja/translation.json`. This test
 * computes the actually-required plural suffixes per locale via
 * `Intl.PluralRules(locale).resolvedOptions()`, the same mechanism i18next
 * itself uses, so it validates against runtime reality rather than assumed
 * linguistics — and would have caught the 'jp' bug directly if it had
 * compared against real Japanese instead of inheriting the app's own broken
 * code.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

// origin/demo baseline this stream diffed against to derive "keys this
// program added" (see METHOD in the stream brief). Frozen on purpose: this
// stream's supported-locale commitment covers exactly the keys added up to
// this point, not keys added by later, unrelated work on the same branch.
const BASE_SHA = '9d17cac114';

const SUPPORTED_TARGET_LOCALES = ['de', 'es', 'ar', 'ja'] as const;
type TargetLocale = (typeof SUPPORTED_TARGET_LOCALES)[number];

function flatten(obj: unknown, prefix: string, out: Record<string, unknown>): Record<string, unknown> {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else {
    out[prefix] = obj;
  }
  return out;
}

function readCurrentEn(): Record<string, unknown> {
  const p = path.join(ROOT, 'public', 'locales', 'en', 'translation.json');
  return flatten(JSON.parse(readFileSync(p, 'utf8')), '', {});
}

function readBaseEn(): Record<string, unknown> {
  const raw = execSync(`git show ${BASE_SHA}:public/locales/en/translation.json`, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return flatten(JSON.parse(raw), '', {});
}

function readTargetLocale(locale: TargetLocale): Record<string, unknown> {
  const p = path.join(ROOT, 'public', 'locales', locale, 'translation.json');
  return flatten(JSON.parse(readFileSync(p, 'utf8')), '', {});
}

const enCurrent = readCurrentEn();
const enBase = readBaseEn();
const addedKeys = Object.keys(enCurrent).filter((k) => !(k in enBase));

const PLURAL_SUFFIX_RE = /^(.*)_(one|other)$/;
const pluralBases = new Set<string>();
const plainAddedKeys: string[] = [];
for (const key of addedKeys) {
  const m = key.match(PLURAL_SUFFIX_RE);
  if (m) pluralBases.add(m[1]);
  else plainAddedKeys.push(key);
}

const ALL_CLDR_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

function requiredSuffixesFor(locale: TargetLocale): string[] {
  return new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
}

describe('S2-LOCALE — keys this program added to en resolve in de/es/ar/ja', () => {
  it('re-derived a non-trivial number of added keys from the base commit diff', () => {
    // Sanity guard mirroring idea-workspace-required-keys.test.ts: if this
    // drops to ~0, the git derivation broke, not the locales.
    expect(addedKeys.length).toBeGreaterThan(300);
    expect(pluralBases.size).toBeGreaterThan(0);
  });

  it.each(SUPPORTED_TARGET_LOCALES)('%s: every plain added key resolves', (locale) => {
    const target = readTargetLocale(locale);
    const missing = plainAddedKeys.filter((k) => !(k in target) || target[k] === undefined);
    expect(
      missing.length,
      `${missing.length} key(s) missing from ${locale}/translation.json (showing up to 40):\n` +
        missing.slice(0, 40).join('\n')
    ).toBe(0);
  });

  it.each(SUPPORTED_TARGET_LOCALES)('%s: every plural base has the locale-correct CLDR suffixes', (locale) => {
    const target = readTargetLocale(locale);
    const requiredSuffixes = requiredSuffixesFor(locale);
    const missing: string[] = [];
    for (const base of pluralBases) {
      for (const suffix of requiredSuffixes) {
        const key = `${base}_${suffix}`;
        if (!(key in target) || target[key] === undefined) missing.push(key);
      }
    }
    expect(
      missing.length,
      `${locale} is missing ${missing.length} required plural form(s) ` +
        `(Intl.PluralRules('${locale}') needs [${requiredSuffixes.join(', ')}] per base):\n` +
        missing.slice(0, 40).join('\n')
    ).toBe(0);
  });

  it.each(SUPPORTED_TARGET_LOCALES)('%s: no blank values for added keys', (locale) => {
    const target = readTargetLocale(locale);
    const requiredSuffixes = requiredSuffixesFor(locale);
    const keysToCheck = [
      ...plainAddedKeys,
      ...[...pluralBases].flatMap((base) => requiredSuffixes.map((s) => `${base}_${s}`)),
    ];
    const blanks = keysToCheck.filter((k) => typeof target[k] === 'string' && (target[k] as string).trim() === '');
    expect(blanks.length, `${locale} has blank values for: ${blanks.slice(0, 40).join(', ')}`).toBe(0);
  });
});
