# M6 — language and receipts freeze

**READY FOR CTO REVIEW.** The implementation is frozen for CTO review on branch `codex/a-m6-language-receipts-20260915`, based on `dcbd6c052a15f6ef65a6ec698bb0cbda4a7902fe`.

## Delivered behavior

- An explicitly requested Idea Process Flow remains selected after reopening an existing idea instead of falling back to Mind Map.
- Initiative, Decision, Report, and Presentation conversions now return an object-specific receipt with a working destination derived from the created object identifier.
- Process Flow lane labels use the measured palette gutter and no longer sit underneath the palette.
- Execution Bank uses a short localized variance heading (`Δ days` / `Δ dni`) within the existing column width.
- Assessment report failures render inside the application shell.
- Generated program-management report markdown is English-first, and audit-criteria errors expose stable codes for client-side localization.
- DRD levels use English titles and descriptions in English and retain Polish source copy in Polish.
- `apiErrorFallbacks.ts` required no implementation delta: all 220 fallback codes are present in both locale catalogs (`en 220/220`, `pl 220/220`).

## Verification

- Targeted Vitest: **44/44 PASS** across seven individually invoked files.
- Esbuild syntax/transpile verification: **13/13 production files PASS**, invoked per file.
- TypeScript fingerprint required by W78:
  - same-environment comparison using the actual symlink to the current owner `node_modules` and TypeScript 5.8.3: clean `dcbd6c052a` server **27**, candidate server **27**, therefore server delta **0**; clean frontend **TIMEOUT_120**, candidate frontend **TIMEOUT_120**.
  - CTO **177 / 0** and earlier Codex **194 / 27** are historical references only. They are not the current same-environment comparison.
- `node_modules` resolves to `/Users/piotrwisniewski/Developer/Consultify/node_modules`; neither `node_modules` nor `package-lock.json` was modified.

## Evidence limits

- Light and dark browser screenshots are **NOT_PROVEN** in this freeze. No built browser runtime was started in this package, and no staging write was made.
- Full frontend TypeScript completion is **NOT_PROVEN** for both clean base and candidate under the 120-second command ceiling.
- Review verdict is intentionally left to CTO under W78; this freeze contains no self-acceptance.

## Product commits

- `da0639b0a1` — preserve explicit Idea tool selection.
- `95897bf5df` — object-specific conversion receipts and destinations.
- `dd63930f9c` — measured Process Flow lane-label gutter.
- `3be223c278` — Execution Bank heading and report shell.
- `35ab487899` — English-first PM reports and coded audit errors.
- `6cbc1265be` — locale-specific DRD projection.
