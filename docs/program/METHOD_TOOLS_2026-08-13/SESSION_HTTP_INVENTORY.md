# Dynamic SWOT session state — HTTP inventory (2026-08-13)

Stream: SESSION UI / HTTP ADAPTER. Worktree `wt-uihttp`,
branch `codex/tools-wt-uihttp-20260813`, base `82ed4bd657`.
Own DB: docker `cfy-uihttp`, Postgres on `localhost:56203`.

This is TASK 1 (inventory-first) for the stream mandate: make server +
PostgreSQL the source of truth for the Dynamic SWOT session UI, with
localStorage demoted to a cache/recovery-draft role only. Every claim below
is a file:line citation, verified by reading the code directly (not by
grepping flags or trusting docs) — per the project's own "verify the real
runtime" rule.

## 1. Where Dynamic SWOT session state lives today

- `src/store/useToolStore.ts` — a 5,079-line zustand store holding
  `ToolSession` (generic, all tool types) and the Dynamic SWOT-specific
  shape:
  - `SWOT_STEPS` — step/phase definitions, `useToolStore.ts:1342`.
  - `SWOTData` — `{ summary, signals, items, correlations, tensions,
    recommendedMoves, outputCandidates }`, `useToolStore.ts:219-226`.
  - `SWOTItem` — `useToolStore.ts:139-163`; `SWOTTension` —
    `useToolStore.ts:174-186`; `SWOTMove` (recommended moves) —
    `useToolStore.ts:187-210`.
  - `createInitialSWOTData()` — `useToolStore.ts:2447`.
  - Store actions that mutate SWOT working state locally:
    `addSWOTSignal`/`updateSWOTSignal`/`removeSWOTSignal` —
    `useToolStore.ts:2407-2409`, `4243-4256`+; `addSWOTItem` /
    `updateSWOTItem` / `removeSWOTItem` — `useToolStore.ts:2410-2412`;
    `setSWOTTensions` / `setSWOTMoves` / `setSWOTOutputCandidates` /
    `setSWOTSummary` — `useToolStore.ts:2413-2416`; `acceptAllInPhase` —
    `useToolStore.ts:2435`.
  - `hydrateSessionFromApi` — the bridge FROM the server response INTO the
    store's `currentSession` — declared `useToolStore.ts:2375-2388`,
    implemented `useToolStore.ts:4177-4222`. It does not read a `version`
    field (none is declared on its payload type).

## 2. Every place it persists

- **zustand `persist` middleware**, `useToolStore.ts:3727-3733` and
  `5071-5075`:
  ```ts
  persist(
    (set, get) => ({ ... }),
    { name: 'tool-store', partialize: (state) => ({ savedSessions: state.savedSessions }) }
  )
  ```
  This writes `localStorage['tool-store']` = `{ savedSessions: ToolSession[] }`
  — **unconditionally, forever, no TTL, no per-session scoping, no
  staleness check** — every time `saveSession()` runs
  (`useToolStore.ts:3767-3783`). `currentSession` itself is explicitly
  EXCLUDED from `partialize`, so only the `savedSessions` array persists.
  `loadSession(sessionId)` (`useToolStore.ts:3758-3765`) reads FROM this
  persisted array and slaps whatever it finds straight into
  `currentSession` — no comparison against the server.
- **Consumers of `savedSessions`/`loadSession`/`saveSession`**: grepped
  across `src/` — the ONLY call sites were inside `useToolStore.ts` itself,
  plus two view components: `ToolDocumentView.tsx` (this stream's target —
  now removed, see §4) and `ToolWorkspace.tsx:212-213, 436, 557`
  (untouched — a separate component, out of this stream's scope, not on
  the Dynamic SWOT dedicated-view path — see §3). **No list/recents UI
  anywhere in the app reads `savedSessions`** — the real session list is
  server-driven (`Api.listToolSessions`, `DiscoveryToolsHub.tsx`). This
  confirms the zustand-persisted blob was pure local pseudo-truth with no
  actual feature depending on it for the Dynamic SWOT flow — safe to stop
  writing/reading from `ToolDocumentView.tsx` (done; store itself
  untouched since `ToolWorkspace.tsx` still uses it).
- No other `localStorage`/`sessionStorage` keys touch tool-session answers
  anywhere in `src/` (full-repo grep for `localStorage` cross-checked
  against `tool|swot|session` — the only session-shaped hits were unrelated
  demo-session/idea-workspace/assessment-nav keys, not this domain).

## 3. Which component actually renders Dynamic SWOT

`src/components/DiscoveryTools/dedicatedToolTypes.ts:8-38` —
`DEDICATED_TOOL_TYPES` includes `'dynamic-swot'`. Any tool type in that
list is rendered by `src/components/DiscoveryTools/ToolDocumentView.tsx`
(gated in `src/components/Discovery/DiscoveryToolsHub.tsx:3613-3657`); tool
types NOT in that list fall through to `GenericToolDocumentView.tsx`. So
`ToolDocumentView.tsx` is the correct, and only, target for this stream.

## 4. HTTP endpoints — verified against `server/src/routes/tools.routes.ts`

All confirmed present and already wired to `ToolController` (owned by
another stream this session — read-only for this inventory):

| Method | Path | Handler | Route line |
|---|---|---|---|
| POST | `/api/tools` | `createToolSession` | `tools.routes.ts:35` |
| GET | `/api/tools/:toolId` | `getToolSession` | `tools.routes.ts:44` |
| PUT | `/api/tools/:toolId` | `updateToolSession` | `tools.routes.ts:45` |
| POST | `/api/tools/:toolId/request-review` | `requestReview` | `tools.routes.ts:46-50` |
| POST | `/api/tools/:toolId/approve` | `approveTool` | `tools.routes.ts:51` |
| POST | `/api/tools/:toolId/send-back` | `sendBackToDraft` | `tools.routes.ts:52` |
| POST | `/api/tools/:toolId/promote` | `promoteToOutput` | `tools.routes.ts:53` |
| GET | `/api/tools/:toolId/history` | `getHistory` | `tools.routes.ts:66` |

### `GET /api/tools/:toolId` response shape

`server/src/controllers/ToolController.ts:1087-1155`. Hand-built JSON:
`id, name, toolType, status, progress, confidenceAvg, projectId, createdBy,
createdAt, updatedAt, reviewRequestedAt, approvedAt, answers,
contextSnapshot, wizardState, missingItems, failureReason,
lastGenerationBatchId, generatedInitiatives, decisions, permissions`.
**No `version` field**, even though `tool_sessions.version` exists in the
row it just `SELECT *`-ed (confirmed live: `docker exec cfy-uihttp psql -c
"\d tool_sessions"` shows `version integer not null default 1`).

### `PUT /api/tools/:toolId` — `updateToolSession`

`ToolController.ts:1157-1369`. Partial-update semantics (only columns the
caller sent are touched — H3 comment, `ToolController.ts:1266-1273`).
Returns `{ id, status, updatedAt }` — **no `version`**. `version` IS bumped
server-side on every `answers` write (`ToolController.ts:1290`:
`setClauses.push('version = version + 1')`), but:
- the endpoint does **not** accept an `expectedVersion`/If-Match style
  field from the client, and
- it does **not** perform a conditional `WHERE version = ?` update for
  this normal save path.

The 409s this endpoint DOES return today are for other reasons: session
locked after approval/generation (`ToolController.ts:1201-1207`), an
invalid status transition (`ToolController.ts:1220-1231`), or unresolved
DoD/missing-items blockers on a `FINALIZED` transition
(`ToolController.ts:1233-1264`). Compare with `acceptSwotProposal`
(`ToolController.ts:3045-3055`), which DOES do a real CAS
(`UPDATE ... WHERE version = $4 RETURNING version`) — but only for that one
proposal-accept path, a different endpoint entirely.

**Consequence for this stream**: true server-side optimistic-concurrency
(revision tracking against `tool_sessions.version`) cannot be completed
end-to-end without editing `ToolController.ts`, which is explicitly
off-limits this session (owned by another stream). The adapter built here
(`src/services/toolSessionApi.ts`) is written forward-compatible with that
gap — see its file header — and a follow-up has been flagged (see §7).

## 5. Frontend API client

`src/services/api.ts` (21,413 lines) — the real `Api` object already used
by `ToolDocumentView.tsx`/`DiscoveryToolsHub.tsx`. Methods used by this
stream's adapter:
- `Api.createToolSession` — `api.ts:6751-6770`.
- `Api.getToolSession` — `api.ts:6906-6909`.
- `Api.updateToolSession` — `api.ts:6911-6937`.

Error contract (`handleResponse`, `api.ts:900-1040`): any HTTP response
actually received throws an `Error` with `.status = res.status`
(`api.ts:1026-1029`) and `.data` = parsed body. A `fetch()` call that never
reaches the network throws a plain `TypeError` with **no** `.status` —
this is the distinguishing signal the new adapter uses to tell "offline"
apart from "server said no" (`src/services/toolSessionApi.ts`'s
`isOfflineError`).

Documented project trap (see MEMORY.md
`gendeck-genexcel-nadganianie-2026-07-23`): tests and harnesses must patch
`Api` METHODS, not `window.fetch` — followed throughout this stream's new
tests (`vi.mock('@/services/api', ...)` / `vi.mock('@/services/toolSessionApi', ...)`).

## 6. Pre-existing state before this stream's changes (now superseded)

Before this stream's work, `ToolDocumentView.tsx` ALREADY called the real
HTTP endpoints directly (create/get/update over `Api.*`) with a 2000ms
debounced autosave effect (`ToolDocumentView.tsx` pre-change lines
613-682 in the base commit) — i.e. the transport was NOT purely
local/localStorage as a naive read of the mandate might suggest. What was
genuinely missing, and is what this stream's Tasks 2-3 closed:
- no separation into a reusable, independently-testable adapter/hook —
  fetch/debounce/error-handling was inlined directly in a 2,174-line view
  component;
- no offline detection/retry;
- no 409/conflict handling (a failed save just sat in a `'error'` state
  with no path to reconcile with the server);
- no revision/version tracking scaffold;
- `loadSession(sessionId)` (`useToolStore.ts:3758-3765`) seeded
  `currentSession` from the zustand-persisted local `savedSessions` cache
  BEFORE the server response arrived — a real (if narrow) local-storage-as
  -pseudo-truth window, closed by this stream (see CHANGES.md/report).
- no recovery-draft concept at all — an edit made in the 2s debounce
  window before a tab close/crash was simply lost, silently.

## 7. Follow-up flagged (out of this stream's scope)

`ToolController.ts`'s `getToolSession`/`updateToolSession` should be
extended to (a) return `version` in the GET/PUT response and (b) accept an
optional `expectedVersion` on PUT, doing a conditional
`WHERE version = $n` update and returning a real 409 on mismatch — mirror
of the existing SWOT-proposal-accept CAS pattern
(`ToolController.ts:3045-3055`). The frontend adapter already sends
`expectedVersion` on every save and reads `version` defensively from every
response, so this becomes a pure backend change with zero required
frontend follow-up once landed.
