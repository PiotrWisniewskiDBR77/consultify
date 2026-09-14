/**
 * ONE place that turns an i18next language tag into the DRD pack's content
 * language (DEC-461, fala J1).
 *
 * Why a helper instead of `i18n.language.startsWith('pl')` repeated at each
 * call site: `compileDrdPack()` is reached from SIX places (two module-level
 * caches among them). Every one of them has to answer the same question the
 * same way, or the questionnaire body and its labels can end up in different
 * languages on the same screen.
 *
 * Deliberately `i18next` and NOT `@/i18n`: the latter is the *initialising*
 * module (HTTP backend, language detector) and importing it would drag all of
 * that into every test that merely mocks `react-i18next`. Same reasoning, same
 * precedent as `src/components/assessment/report/drdLabels.ts` and
 * `src/utils/listDateFormat.ts`.
 */
import i18n from 'i18next';

import type { DrdPackLanguage } from './compileDrdPack';

/**
 * EN is the fallback, not PL (DEC-461: the software and its demo data lead in
 * English). Anything that is not a Polish tag — including an empty/unset
 * language before i18next has booted — resolves to `'en'`.
 */
export function drdPackLanguageFrom(raw: string | null | undefined): DrdPackLanguage {
  return String(raw ?? '')
    .toLowerCase()
    .startsWith('pl')
    ? 'pl'
    : 'en';
}

/**
 * The pack language for the interface language right now. Read it at call
 * time (inside a `useMemo` keyed on `i18n.language`, or inside a selector) —
 * never cache the RESULT at module scope, or switching the language in
 * Settings leaves the questionnaire in the previous language until a reload.
 */
export function currentDrdPackLanguage(): DrdPackLanguage {
  // `i18n.language` FIRST, `resolvedLanguage` only as a fallback: the rest of
  // this module (`drdLabels.ts`, both workspace screens, `DRDMatrixSession`)
  // reads `i18n.language`, and `resolvedLanguage` can differ from it when a
  // namespace has no bundle loaded yet. Two different answers on one screen is
  // exactly the split this helper exists to prevent.
  return drdPackLanguageFrom(i18n.language || i18n.resolvedLanguage);
}
