# V8.1 Evidence - Landing Anna language fallback T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna language fallback`
Taxonomy: `T4`
Status: `accepted`

## Acceptance basis

This bounded `Landing Anna language fallback` lane is ready for `T4` acceptance because the live Anna runtime and widget now
honor the unsupported-language rule from the public contract.

1. the public Anna route now returns an English fallback note for unsupported languages
2. the normal PL/EN path remains intact for supported conversations
3. the widget now surfaces the unsupported-language note directly on the landing surface
4. focused route and widget regressions prove the bounded fallback behavior

## Why this is sufficient

The lane was scoped as one bounded unsupported-language cut, not as a full multilingual expansion program. Within that scope,
the contract-vs-runtime language fallback gap is closed.

Any future broader multilingual support, analytics, prompt-quality, or placement work remains visible backlog and should only
re-enter execution through a separate explicit promotion.

## Evidence chain

1. `evidence/236-v81-landing-anna-language-fallback-split-brain-map.md`
2. `evidence/237-v81-landing-anna-language-fallback-seam.md`
