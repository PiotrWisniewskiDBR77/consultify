# Sprint 6 QA Report — Table Studio Foundation

**Date:** 2026-05-07  
**Recommendation:** `GO_WITH_CONSTRAINTS`

## Summary

Tabele-specific validation is green across focused backend, frontend component, scoped lint, DBR77, locale JSON, and focused Playwright smoke checks. The full repository gates are not globally green because existing baseline lint/typecheck/i18n failures remain outside the Tabele work area.

## PASS Evidence

- Backend focused gate:
  `cd DRD/consultify/server && npx vitest run src/routes/__tests__/table-platform.schema-proposals-acl-audit.test.ts src/routes/__tests__/table-platform.relations-explain.test.ts src/services/tablePlatform/__tests__/RelationExplainabilityService.test.ts --maxWorkers=1 --maxConcurrency=1`
  → PASS, 3 files / 32 tests.
- Frontend focused gate:
  `cd DRD/consultify && npx vitest run tests/components/AIChat/KimiWorkspace/TabeleView.test.tsx tests/components/AIChat/KimiWorkspace/tabelePreview tests/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.test.ts tests/components/AIChat/KimiWorkspace/ArtifactModuleHome.test.tsx --maxWorkers=1 --maxConcurrency=1`
  → PASS, 7 files / 28 tests.
- Focused e2e smoke:
  `CI=true E2E_MODE=true E2E_USE_WEB_SERVER=true E2E_BACKEND_RUNNER=tsx E2E_MOCK_DB=true E2E_API_URL=http://127.0.0.1:3101 E2E_BASE_URL=http://127.0.0.1:3100 npx playwright test --config playwright.smoke.config.ts tests/e2e/smoke/tabele-foundation.spec.ts --project=chromium --workers=1`
  → PASS, 3/3 tests.
- Scoped source lint:
  `npx eslint src/components/AIChat/KimiWorkspace/TabeleView.tsx src/components/AIChat/KimiWorkspace/tabelePreview/*.tsx src/services/api/tablePlatform.api.ts --quiet`
  → PASS.
- Scoped diagnostics:
  `ReadLints` on changed Tabele source/tests/e2e/API files → PASS.
- DBR77 hex scan:
  workspace ripgrep for `#[0-9a-fA-F]{3,6}\b` over `TabeleView.tsx` and `tabelePreview/*.tsx` → PASS, 0 hits.
- Locale JSON:
  `JSON.parse(public/locales/en/translation.json)` and `JSON.parse(public/locales/pl/translation.json)` → PASS.

## Constraints / Baseline Failures

- `npm run lint` → FAIL on broad existing Prettier/import-sort issues across unrelated files. New Tabele source lint is clean after targeted formatting.
- `npm run type-check` → FAIL on existing non-Tabele modules including `AIChat/WorkCanvas`, `Presentations/DeckBuilder`, `ProfileSettings`, `routeConfig`, and `AdminAuditLogsView`.
- `cd server && npm run typecheck` → FAIL on existing presentation backend modules (`presentations.routes.ts`, `presentationDeckDocumentService.ts`, `presentationTemplateRuntimeService.ts`).
- `npm run i18n:check` → FAIL on existing DE/ES/AR/JA `help.*` gaps. PL reports complete; EN/PL Tabele keys were added and parse.
- Manual screenshot evidence for DBR77/Wordy parity/Menu 3 was not captured in this CLI-only run; code-level audits are clean.

## Security Result

P0 `TBL-SEC-1` is resolved for schema proposal ACL. Cross-tenant audit now passes 9/9. Relation explainability route tests pass 9/9, and service tests pass 14/14.

## Recommendation

`GO_WITH_CONSTRAINTS`: proceed to Sprint 7 closeout with explicit baseline constraints recorded. Do not claim full repo lint/typecheck/i18n green until unrelated baseline failures are cleaned in a separate quality block.
