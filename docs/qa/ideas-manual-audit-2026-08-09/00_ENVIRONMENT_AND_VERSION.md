# Ideas manual audit — environment and version gate

Status: **PASS — current working tree runtime verified**
Execution: `2026-08-09 07:27–10:43 Europe/Warsaw`
Mode: audit → repair → retest → continue

## Candidate identity

- Working tree: `/Users/piotrwisniewski/.codex/worktrees/8fd1/consultify`
- Git HEAD: `4610ddb7de335071921435d265bb499ac2ac51e2` (detached)
- Runtime badge: `LOCAL @4610ddb7de`
- Frontend: `http://localhost:4173`, Vite started from this working tree.
- Backend: `http://127.0.0.1:3002`, `server/src/index.ts` started from this working tree.
- Frontend proxy: explicitly set to `VITE_API_TARGET=http://127.0.0.1:3002`.
- Database/session: existing authenticated Piotr Wiśniewski session; no auth bypass.
- Browser: Google Chrome for Testing 145; normal landscape window, dark theme.
- `demo.consultify.ai`: not used; no matching deployment SHA was established.
- Baseline was dirty before this task. No reset, clean, stash, broad stage or unrelated-file edit was performed.

## Why port 3000 was rejected

`localhost:3000` served the separate iCloud checkout, not the passed working tree. The audit therefore moved to 4173 and required the badge above before testing. A first backend process on 3001 later stopped, producing a transport `HTTP 500`; it was replaced with the candidate backend on 3002. Retest produced a real AI proposal, proving this was environment loss rather than an implementation failure.

## Required newest-version markers

| Marker | Result | Runtime proof |
|---|---|---|
| draggable right rail handle | PASS | `Move tool rail` present in all four tools |
| bottom zoom and overflow controls | PASS | zoom percentage, +/− and `More view controls` visible |
| Menu 2 changes URL, Menu 3 and module together | PASS after repair | `List` from Mind Map, Process Flow and Whiteboard returned to real `/my-work/ideas`; subsequent isolated records could be opened |
| exact local SHA | PASS | badge `LOCAL @4610ddb7de` equals HEAD prefix |

## Isolated audit records

| Tool | Record | Route / ID |
|---|---|---|
| Mind Map | `AUDIT Mind Map 20260809-0730` | `68895aa1-c05e-4091-8ae0-9fd54dea7843/workspace/mind-map` |
| Process Flow | `AUDIT Process Flow 20260809-0755` | `3de94f33-d6dc-41a1-8912-a20780976b4c/workspace/process-flow` |
| Whiteboard | `AUDIT Whiteboard 20260809-0757` | `35100af2-01dc-46f5-828e-a09a6d60a910/workspace/whiteboard` |
| Table | `AUDIT Table 20260809-0759` | `a9e4cee9-bf0a-4720-92b2-e5bb1c75064c/workspace/table` |

## Repairs made during the gate

1. `MyWorkHub.tsx`: canonical module-list routes now clear stale `activeDocumentId`. Before: `/my-work/ideas` URL with a still-mounted Mind Map. After: URL, Menu 3 and list content reconcile atomically; refresh stays on the list.
2. Audit brief updated from read-only to the user-authorized audit/repair/retest workflow.
3. Candidate backend started from the exact working tree and frontend proxy corrected to it.
4. `MyWorkHub.tsx`: route-owned workspace data now refreshes an already-open tab, canonical workspace URL follows the active representation, and live `initialTool` is retained when switching representations. This repaired Table→Process Flow refresh mismatch and Whiteboard tabs reopening as Process Flow.
5. `CanvasContextMenu.tsx`: Enter/Space now activates the focused menuitem. Runtime retest opened Whiteboard Comments; focused unit coverage was added.

## Evidence

- Historical failure: [system__navigation__list-url__workspace-stale.png](screens/system__navigation__list-url__workspace-stale.png)
- Initial auth gate: [environment__gate__auth__blocked.png](screens/environment__gate__auth__blocked.png)
- Final runtime evidence is included per tool in reports 01–04.

## Limitations

- Responsive screenshots were captured at 1280×800, 1440×900 and 1920×1080 for all four representations. At narrow widths controls compact/clip differently; screenshots remain the authoritative visual evidence.
- Browser zoom 100% and 200% was exercised for all four representations. Evidence: `screenshots/cross-tool__zoom__200-*.png`; 100% is also covered by the scene and viewport evidence.
- Light/dark and PL/EN were exercised in runtime. In PL/light the same idea completed the canonical representation cycle Mind Map → Whiteboard → Process Flow → Table → Mind Map, with one screenshot per representation; EN/dark was restored afterward.
- Product records created above are audit data and were intentionally retained as reproducible evidence.

## Verification commands

- Root `npm run type-check`: **PASS** after all current code repairs.
- Focused tests: **16/16 PASS** (`CanvasContextMenu` 5 and `MyWorkHub.menu2-routing` 11).
- CSV parse/shape: **PASS**, 131 inventory data rows and 12 columns each.
- Required artifact gate: **PASS**, all eight required files plus 70 screenshot files present.
- `npm --prefix server run typecheck`: **FAIL on the supplied baseline** with broad pre-existing errors in Interview, Organization, WebSocket typings, middleware, Table Platform and other unrelated modules. No reported error pointed to `ideaAIGeneratorService.ts`; the failing global server gate is preserved as baseline evidence, not misreported as green.
