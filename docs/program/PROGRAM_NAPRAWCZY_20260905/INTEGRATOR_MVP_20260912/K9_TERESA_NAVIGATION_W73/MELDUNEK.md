# K9 — Teresa navigation manifest and admin/settings grounding

Verdict: **P1 CORRECTED; READY FOR A NEW INDEPENDENT REVIEW; not accepted and not integrated.**

## Scope delivered

- `src/routes/routeConfig.ts` owns the canonical Teresa navigation manifest.
- The server-safe mirror is pinned by a cross-runtime drift contract.
- Teresa receives only navigation entries allowed by the verified role, organization-specific flag state, and server-controlled runtime flags.
- A hidden module is omitted from the model prompt. An available module carries a localized EN/PL click path. A visible planned module carries a localized unavailability reason.
- `admin` grounding contains organization metadata, aggregated membership roles, and organization flag names/states without emails, setting values, targeting rules, tokens, or secrets.
- `settings` grounding contains user language/timezone and addressable organization setting keys without `setting_value`.
- The route passes the verified server role and server-owned Meetings flag; no client-provided role or flag decides visibility.
- `/chat/stream` now selects `status, role` from the active membership row and replaces a stale JWT role before grounding. A downgrade from `ADMIN` to `MEMBER` therefore removes admin navigation, queries and citations.
- A failed `feature_flags` query keeps chat available while excluding all organization-gated manifest entries. It emits no gated label or route in either language.
- Navigation remains descriptive and is consistent with `navigationHonesty.ts`: no second Teresa panel and no claim that Teresa opened a screen.

## Behavioral proof

- Targeted tests: **4 files, 20 passed, 0 failed**.
  - role/org/runtime-hidden module is absent from the prompt;
  - available admin/meeting module has an EN click path;
  - PL labels, path and unavailable reason are localized;
  - routeConfig ↔ server mirror is identical;
  - admin/settings citations are addressable and secret setting values do not enter the prompt.
  - flag-query fault injection excludes all five organization-gated entries, labels and routes in EN and PL;
  - route middleware proves stale `ADMIN` JWT plus current `MEMBER` membership yields no admin label, route, query or citation.
- Expanded routing importer set: candidate **247 passed / 1 failed**; exact base `f2628a0d36` **246 passed / 1 failed**. The added passing test is the K9 manifest mirror. The same pre-existing failure name appears on both sides: `tests/navigation/routeMapping.test.ts` expects `/results` for `BENEFITS_REALIZATION` and receives `/results/kpi`.

## W73 gates

- server TypeScript: RC 0;
- frontend TypeScript: RC 2, **177 errors**, **7427 listFiles** (W73 limit: 177; three package files are newly included);
- `check:jezyk:ci`: PASS, no bucket increased (reported reductions K4en −68, K7 −1);
- `check:list-canon`: **349**, unchanged;
- `check:artefakt`: **8 / 0 / 117**, unchanged;
- production build with `NODE_OPTIONS=--max-old-space-size=8192`: RC 0;
- new `as any`: 0;
- migrations: 0;
- forbidden files touched: 0.
- `git diff --check` against exact base: RC 0 after removing four inherited extra EOF blank lines.

## Visual evidence

Screenshots are **N/A**. K9 changes only backend prompt grounding and a data-only route manifest; it adds no route, component, panel, control, or visible UI state. Rendering a screenshot would therefore show byte-for-byte existing UI and would not prove the changed behavior. The behavior is proved at the prompt boundary by the EN/PL allow/deny contract tests.

## Known limits

- Organization-specific navigation overrides are read only from an explicitly successful production `feature_flags` query scoped to the active organization. An absent row after a successful query retains the canonical route default; a query fault excludes every organization-gated entry.
- K9 does not add a navigation tool. Teresa can explain the click path and cannot perform the click.
- The package remains based on exact `f2628a0d36` as assigned. Integration/rebase belongs to CTO.
