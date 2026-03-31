# P25-C — Contextual Help verification closeout (2026-03-31)

Packet: **P25-C**  
Depends on:
- **P25-B delivered**: `c06e33e746`
- **Closeout repair commit**: `98bf75bf8a`

## 1) Automated verification

Command:

```bash
E2E_MODE=true E2E_USE_WEB_SERVER=true E2E_BACKEND_RUNNER=tsx E2E_MOCK_DB=true \
E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://127.0.0.1:3000 \
npx playwright test --config playwright.smoke.config.ts tests/e2e/smoke/help-contextual-entrypoints.spec.ts

npx vitest run server/src/routes/v8/__tests__/help.routes.test.ts
```

Result: **PASS** on 2026-03-31
- Playwright: `tests/e2e/smoke/help-contextual-entrypoints.spec.ts` — **5/5 passed**
- Vitest: `server/src/routes/v8/__tests__/help.routes.test.ts` — **1/1 passed**

## 2) What this closeout verified

- Tools, Interview, and Outputs entry points all open Help and return through the bounded next-action loop.
- Missing article deep-link shows explicit degraded recovery (`Article not found` + `Search help`).
- PL locale falls back explicitly to EN when the article has no PL translation.
- `help-reco-v1` backend route remains green while runtime surfaces consume the contextual Help contract.

## 3) Closeout repairs included in `98bf75bf8a`

- Added an idempotent DB backfill migration for stale primer rows missing `next_action`.
- Hardened mock KB seed so existing primers are repaired, not only inserted when absent.
- Added a safe surface-context fallback in `KnowledgeArticleView` when article metadata is incomplete.
- Deferred Help panel close/navigation by one tick so the return click completes reliably in Playwright and runtime.
- Hardened `DiscoveryToolsHub` bootstrap with bounded fallbacks so Help entry remains reachable even if one startup request stalls.

## 4) Rollback posture

- If KB primer metadata is incomplete in an older environment, the UI still degrades safely back to the originating surface.
- The SQL backfill is idempotent and non-destructive.
- No frozen layout rules were changed; the fix is bounded to Help runtime behavior and test/seed stability.

## 5) Known limits

- Manual staging capture remains optional follow-up, but the required user-visible flows are now covered by deterministic smoke tests in-repo.
