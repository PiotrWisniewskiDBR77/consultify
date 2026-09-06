/**
 * Review-mode flag seeding — 2026-07-20 (Piotr's full-app acceptance pass).
 *
 * Piotr's own console-paste kit (`_REJESTR_ODBIORU_FINAL_2026-07-20.md`)
 * confused more than it helped ("nie wiem o czym ty mówisz" re: Chrome's
 * "allow pasting" prompt). This is the zero-friction replacement: open
 * `https://demo.consultify.ai/?review=1` ONCE — every flag below is written
 * to localStorage (survives client-side route changes, unlike the URL query
 * string itself) — then browse normally, no console.
 *
 * Only flags that are genuinely OFF by default and SAFE to preview are
 * listed here (verified against `origin/demo` 2026-07-20 adversarial audit).
 * Deliberately excludes `ff.fin_variance_bridge` — known-broken (missing
 * `actual` column), would just generate a false bug report.
 *
 * Reversal: `https://demo.consultify.ai/?review=0` (clears the same keys).
 */

const REVIEW_FLAG_KEYS = [
  'ff.mels_canvas',
  'ff.mels_tabele',
  'ff.mels_prezentacje',
  'ff.mindmap_pptx_native',
  'ff.tabele_qa',
  'ff.tabele_conversions',
  'ff.tabele_form_intake',
  'ff.tabele_source_pack',
  'ff.interview_pending_review_tab',
  'ff.audit_program_edit',
  'ff.template_lifecycle',
  'ff.record_provenance',
] as const;

export function seedReviewModeFlags(search: string = window.location.search): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return;
  }
  const requested = params.get('review');
  if (requested === '1') {
    for (const key of REVIEW_FLAG_KEYS) window.localStorage.setItem(key, '1');
    // eslint-disable-next-line no-console
    console.info('[review-mode] enabled', REVIEW_FLAG_KEYS.length, 'flags — browse normally.');
  } else if (requested === '0') {
    for (const key of REVIEW_FLAG_KEYS) window.localStorage.removeItem(key);
    // eslint-disable-next-line no-console
    console.info('[review-mode] disabled — cleared', REVIEW_FLAG_KEYS.length, 'flags.');
  }
}
