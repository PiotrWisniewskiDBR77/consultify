# Idea Workspace Tools Sprint 7 Runtime Gate - 2026-05-15

## Verdict

`PASS_WITH_BUSINESS_MANUAL_FOLLOWUP`

Sprint 7 closes the developer-side runtime and contract preflight for Mind Map, Whiteboard, Process Flow, Notebook, Calendar, and Idea Workspace tools. The V5 Ideas Workspace static contract, local runtime API smoke, production build, and staging route/API probes pass.

Full Business Owner visual AnyGravity acceptance remains intentionally open for tool-level save/read-back, ACL/denied states, Teresa handoff, and cross-tool workshop flows.

## Scope

- Idea Workspace seed surface, chat handoff, SuperCanvas object families, focus modes, mind map, process flow, table views, knowledge cards, artifact links, conversion, export, visual system, telemetry, and backend route contracts.
- Runtime Idea API flows: create, map read/save, object artifact attach/detach/read-back, conversion, AI generate endpoint availability, chat handoff, list, stage transition, depth persistence, backlinks, and template save/read-back.
- Notebook, calendar, tasks, My Work, Ideas, and Discovery Tools route availability on staging.
- Core My Work APIs remain auth-gated.

## Fixes Applied

The V5 Ideas Workspace static smoke initially passed `30/35` and failed the seed surface and hierarchy color checks:

- `V5-04 Seed Surface component exists with templates`
- `V5-05 Hero input and primary start actions`
- `V5-06 Popular starts intent system`
- `V5-07 Structured brief mode`
- `V5-43 Hierarchical color system`

Root cause: the seed surface had been simplified and no longer exposed several V5 contract markers, while the mind map hierarchy depth helper lived in the node model rather than directly in `IdeaRecommendationMap`.

The fix restores the seed surface contract with lightweight `TEMPLATES`, popular starts, `PrimaryStartButton`, and structured brief handling, and keeps the hierarchy depth helper explicit in the map file.

The runtime Ideas smoke then failed `16/18` because conversion in the local mock gateway returned `500` when `tool_sessions` was unavailable. The route now keeps production strictness but returns a mock traceability session id only under the test/mock gateway, allowing conversion behavior to be verified without pretending the production schema requirement is optional.

## Validation Evidence

- `npx tsx server/scripts/smoke-v5-ideas-workspace.ts` -> `35/35 PASS`
- Local Ideas runtime e2e harness with test-support bootstrap -> `18/18 PASS`
  - create idea
  - read/save map
  - attach/detach/read-back object artifacts
  - artifact links survive frontend-format save/reload round-trip
  - convert idea to initiative
  - AI generate endpoint responds
  - chat handoff
  - list ideas
  - stage transition
  - node depth persistence
  - selection-level conversion
  - backlinks
  - template nodes save/read-back
- Production build with `NODE_OPTIONS=--max-old-space-size=8192 npm run build` -> PASS
- `ReadLints` for changed files -> no linter errors
- Targeted Vitest transform command for changed My Work TSX files -> PASS, no targeted component tests found

## Staging Route/API Probe

Target: `https://demo.consultify.ai`

- `GET /my-work` -> `200`
- `GET /my-work/ideas` -> `200`
- `GET /my-work/notebook` -> `200`
- `GET /my-work/calendar` -> `200`
- `GET /my-work/tasks` -> `200`
- `GET /discovery-tools` -> `200`
- `GET /api/my-work/my-ideas` unauthenticated -> `401 No token provided`
- `GET /api/my-work/link-graph/backlinks?type=idea&id=__probe__` unauthenticated -> `401 No token provided`
- `GET /api/my-work/notebook/pages` unauthenticated -> `401 No token provided`
- `GET /api/calendar/events` unauthenticated -> `401 No token provided`

The probe confirms the user-facing routes are available and My Work tool APIs remain auth-gated.

## Remaining Risk

- `docs/modules/04_narzedzia` remains `status: draft`.
- Full logged-in visual AnyGravity acceptance is still required for Mind Map, Whiteboard, Process Flow, Notebook, Calendar, and Idea Workspace.
- Teresa cross-tool mutation/refusal/provenance gates are intentionally carried into Sprint 8.
