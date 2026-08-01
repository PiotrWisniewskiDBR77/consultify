# M06 Manual-gate sub-agent brief (Playwright)

You complete a slice of the **M06 Ideas · Mind Map** Manual gate: author + run Playwright
specs that produce one screenshot per scenario. Work ONLY on your assigned sections.
Repo: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify` · branch `Londyn`.

## Environment (already running — do NOT start/stop)
- Frontend: `http://localhost:3000` · Backend: `http://localhost:3001` (staging DB).
- Proven harness: `tests/e2e/m06/_m06.ts` — **import it, do NOT modify it.**
- Reference (already GREEN): `tests/e2e/m06/m06-01-routing.spec.ts` — mirror its style.
- Scenario source of truth: `Harvard/Testy manualne/TESTY_M06_IDEAS_MIND_MAP.md`.
  READ your assigned `### X.Y` line ranges before authoring.

## Harness API (`./_m06`)
```ts
import { bootstrap, createIdea, openMindmap, shot, nodeCount, CANVAS_LABEL } from './_m06';
const { token } = await bootstrap(page);              // test-support bootstrap + tour skip → /dashboard
const ideaId = await createIdea(page, token, title?); // Recommendation-map idea, returns id
await openMindmap(page, ideaId);                       // → /my-work/ideas/:id/workspace/mindmap, waits for canvas
await shot(page, '2.1-tab-child');                     // writes tests/e2e/screenshots/m06/2.1-tab-child.png
await nodeCount(page);                                 // count of .react-flow__node
```
- Canvas locator: `page.getByLabel(CANVAS_LABEL)` (`'Idea map workspace'`). Nodes: `.react-flow__node`.
- Keyboard grammar: `Tab`=child, `Enter`=sibling, `F2`=rename, `Delete`/`Backspace`=delete. Palette: `Meta+k`.
- Map sync endpoint: `POST /api/my-work/my-ideas/:id/map/sync`.
- You may READ app source (`src/components/MyWork/mindmap/**`) to find real aria-labels / test-ids / button text.

## Deliverable
- ONE spec file per assigned section: `tests/e2e/m06/m06-NN-<slug>.spec.ts` (NN = zero-padded section #).
- One `test('X.Y ...')` per `### X.Y` sub-scenario — cover EVERY one in your sections.
- Each test: real action → real assertion (DOM/network/reload per spec §0.3) → `await shot(page, '<X.Y>-<slug>')`.
  Screenshot filename MUST start with the scenario number.
- For modifying scenarios where spec §0.3 applies, assert `POST /map/sync` fired
  (`page.waitForResponse(r => /\/map\/sync/.test(r.url()))`) OR node-count change + reload persistence.

## Honest-skip policy (NO fake passes)
- `[MANUAL]` (drag/touch/voice/mic/live-cursor/perf-feel): author the test, open the UI surface and
  screenshot it if reachable, then `test.skip()`/`test.fixme()` with an explicit reason. Document why.
- `[REAL-AI]` / AI endpoints (§11, §2.5, §18.4/5): attempt empirically. Fire the request; 200+content →
  assert + screenshot (PASS). 5xx/disabled/no-key → honest-skip with the actual HTTP status + screenshot of
  the triggered-but-empty state.
- Two-tab realtime (§16): Playwright supports two contexts/pages — IMPLEMENT it. NOTE: the harness caches ONE
  bootstrapped session per run (`getSharedSession`), so two pages share the SAME org → use that for
  cooperation/graph_patch tests. (`register-demo` is NOT used: it is the public, unprivileged,
  read-only demo signup.)
  Cross-org reject (§16.5) is already covered by `tests/integration/gateways/ideaCollabWs.orgscope.test.ts` —
  reference that and skip the live cross-org attempt. If WS won't connect locally, honest-skip with reason.
- A documented skip COUNTS. A fake pass does NOT. Never assert success on a broken flow — instead report it
  as a DEFECT.

## Reconciliations (spec predates Harvard-2 fixes; verified 2026-06-20)
- Beta `MYWORK_IDEAS` is now **'open'** (not 'closed').
- Sidekick event IS consumed (`AIActionsPopover.tsx:91`, `FloatingAIPopover.tsx:54`) — §23.1 no longer a gap.
- `WebhookSettings.tsx` was **DELETED** (orphan) — §17.10 → assert N/A (file gone), honest-skip noting removal.
- ExportPowerPoint downloads HTML labeled **"Pobierz HTML (do PDF/PPTX)"** — §17.7 assert the honest label, not `.pptx`.

## Run + iterate (you MUST run and reach green/honest-skip)
```
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify
E2E_BASE_URL=http://localhost:3000 E2E_API_URL=http://localhost:3001 \
  npx playwright test tests/e2e/m06/m06-NN-<slug>.spec.ts --project=chromium --workers=1 --reporter=list
ls tests/e2e/screenshots/m06/   # confirm PNGs exist
```
Fix wrong selectors by inspecting the live DOM / reading source. Canvas mount can take ~15s (heavy component).

## Constraints
- ONLY create/edit your own `m06-NN-*.spec.ts`. Do NOT edit `_m06.ts`, other specs, app source, or docs.
- Do NOT `git add`/commit. Do NOT start/stop servers. Do NOT touch prod.
- `--workers=1`. Each test calls its own `bootstrap()`/`createIdea()` (own demo user + idea — no shared state).

## Return (structured)
- Per scenario X.Y: `PASS` / `SKIP:<reason>` / `DEFECT:<sev>` + screenshot filename + 1-line note.
- Real defects found: severity (P0/P1/P2) + `file:line` + symptom.
- Spec files created + final run result (`X passed / Y skipped`).
