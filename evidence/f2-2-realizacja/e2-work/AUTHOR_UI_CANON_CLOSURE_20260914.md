# F2-2 E2 UI canon closure — author receipt 2026-09-14

**Verdict: the three UI HOLD findings are closed without expanding the domain or adding a migration.**

## Closed findings

1. All five native Bank selects were replaced by the shared Dropdown. Labels use the line's `initiativeStatusLabel`, EN+PL priority/filter keys, project titles from initiative/execution-case data, and organization-member names. Unknown values stay honest and never fall back to a raw identifier.
2. The attention-row kebab is backed by real handlers: Open source record when a source route exists, the manager actions returned by the existing service, and Open preview. Edit/archive/delete are capability N/D because the runtime projection exposes no such mutations; no disabled fake action is shown.
3. `StandardPreview` receives `onOpenFull` whenever the same source handler is available. The disabled reason exists only for rows without a reachable source record.

## Behavioral proof

- `WorkIntelligenceReport.canon.test.tsx` mounts the real `StandardTable` and `StandardPreview`; no table mock is used. It opens the row menu, checks the real actions and N/D omissions, opens preview, verifies the resolved owner name, then invokes the active header Open.
- `ExecutionHub.e1bBankViews.behavior.test.tsx` proves five standard dropdown triggers, zero native selects, translated status/priority choices, project/owner names, and identical filtering across table and Kanban views.
- Full delta: 14 files / 97 tests PASS with `--retry=0`; RealPG/Gateway/JWT: 2 files / 5 tests PASS, including concurrency.
- Server TypeScript heap 8 GiB, three focused esbuild bundles, duplicate detector, diff check, and production Vite build all exit 0.
- Browser proof covers the full `ExecutionHub` shell in EN light, EN dark, and PL dark. The screenshots show the real work report with selected preview and enabled Open; all three runs have zero recorded errors.
