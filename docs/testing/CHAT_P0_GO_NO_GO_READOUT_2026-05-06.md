# Chat P0 Manual QA GO/NO-GO Readout (2026-05-06)

Decision: `GO` for manual QA.

Rationale:
- No open P0/P1 from the Chat P0 recovery scope.
- Frontend source defaults are aligned to org-first policy.
- Trust/citations tests updated to current UX contract and passing.
- Manual QA script is prepared and deterministic.

---

## Evidence

### A) Config alignment (org-first)
Updated defaults:
- `src/hooks/useAIStream.ts` -> `knowledgeSources.organizationData ?? true`
- `src/services/api.ts` -> `knowledgeSources.organizationData ?? true`
- `src/store/slices/authSlice.ts` -> `knowledgeSources.organizationData: true`
- `src/store/slices/chatSlice.ts` -> `knowledgeSources.organizationData: true`

Verification:
- Search check in active frontend code finds no remaining `organizationData: false` in primary paths.

### B) Trust/citations regression shield
Updated test contract:
- Badge hidden when no citations.
- Removed old expectations for `"No cited sources"` UI.
- Updated interaction tests to pass citations where badge is expected.
- Updated degraded/no-citations branches to assert non-render.

Verification:
- Command: `npx vitest run "src/components/AIChat/__tests__/TrustBadge.test.tsx"`
- Result: `68 passed, 0 failed`.

### C) Lint signal on touched files
Verification:
- `ReadLints` run on all modified source files.
- Result: no linter errors.

### D) Chat P0 backend/API smoke (from latest recovery run)
Latest smoke output baseline:
- `historyMessages: 2`
- `source.status: 200`
- `deep.status: 200`
- `attachment.status: 200`
- `badPdf.status: 400` with `PDF_TEXT_EXTRACTION_FAILED` (expected degraded behavior)
- `pass: true`

Interpretation:
- History, source governance, deep thinking, and attachment degradation contract were all validated.

---

## Residual risk and scope notes
- This readout is `GO` for manual QA, not production release sign-off.
- Manual QA still must collect UI evidence in live flows using the checklist:
  - `docs/testing/CHAT_P0_MANUAL_QA_CHECKLIST_2026-05-06.md`
- Non-scope legacy/backup files (`src/services/api 2.ts`, `api 3.ts`, `api 4.ts`) still contain older defaults but are not primary runtime paths.

---

## Handoff instruction
- Execute manual QA checklist end-to-end.
- Report each section with one of: `PASS`, `BLOCKED_P1`, `INCONCLUSIVE`.
- Attach screenshots and short notes for any deviation.

