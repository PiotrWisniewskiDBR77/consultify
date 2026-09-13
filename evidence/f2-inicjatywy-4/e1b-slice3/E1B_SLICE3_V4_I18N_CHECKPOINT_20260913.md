# F2-1 E1 Slice 3 V4 — semantic Polish disposition label

Verdict requested from independent review: **scoped candidate; full E1 remains HOLD**.

## Exact correction

- `initiatives.analysis.parking` is now `Odłożenie` in Polish while English remains `Parking`.
- This preserves the DEC-479 structured disposition value `PARKING` while giving the Polish UI a semantic process label rather than copying the English noun.
- No baseline was updated.

## Verification

- `i18nTrescPolska.test.ts`: **3/3 PASS**, exit 0.
- Full `pomiar-jezyka`: exit 0; K7 remains **275**, below baseline ceiling 277.
- Focused Slice 3 suites: **25/25 PASS**, 6/6 suites, exit 0.
- Server typecheck: exit 0.
- Scoped ESLint: exit 0, 0 errors, 5 existing test warnings.
- Scoped Prettier: exit 0.
- `git diff --check`, `check:list-canon`, and `check:artefakt`: exit 0.
- Full frontend typecheck remains repository-inherited RED: exit 2, 191 diagnostics in 56 files. Its output is byte-identical to V3; the sole changed-path diagnostic remains the exact inherited `InitiativesHub.tsx(686,17)` expression already present in HEAD.

## Preserved qualifications

- **BLOCKED:** strict full migration remains stopped by inherited migration `919_z139_full_scope_double_escape_reconciliation.sql`.
- **EVIDENCE_MISSING:** real configured model quality on two organization contexts.
- **PARTIAL:** canonical PMO general-manager authority discovery; UI remains fail-closed.
- **HOLD full E1:** remaining I1.6–I1.18 and later E2–E5 remain outside this scoped correction.
