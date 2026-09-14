# F2-2 Realizacja E2 Praca — Wpis 42 freeze receipt

**Werdykt: READY_FOR_EXACT_SHA_INDEPENDENT_REVIEW on line `29d1db9f00793dab6aeac5f68656200cddf9e529`; no migration.**

- The five Bank filters use the standard dropdown component. Status and priority use EN+PL labels, while project and owner display canonical names instead of raw IDs.
- The management-attention table uses a real `StandardTable` kebab with only backed capabilities. A new test mounts the real table, opens the kebab, verifies action order and absence of invented edit/archive/delete mutations, opens preview, and proves the active header Open calls the same real source handler.
- The earlier E2 behavior remains intact: three work windows, weekly/on-demand durable generation, deterministic concurrent conflict recovery, real project titles, governed manager actions, and descriptive missing-version copy.
- Full Wpis 30 delta plus the new canon test: **14/14 files, 97/97 tests PASS**, each with `--retry=0`.
- Real PostgreSQL 18 on package-owned port 5290 through ApiGateway/JWT: **2/2 files, 5/5 tests PASS**, including concurrent same-week generation, one durable row, manager mutation/audit, tenant isolation and adjacent-route protection.
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc -p server/tsconfig.json --noEmit --pretty false`: exit 0. Focused esbuild for service, full `ExecutionHub`, and `WorkIntelligenceReport`: 3/3 exit 0.
- Full frontend `tsc --noEmit` completes with heap 8 GiB but remains red on inherited current-line files outside the S4 delta; no diagnostic points to the modified S4 files.
- Duplicate JSON-key detector: EN 0, PL 0. `git diff --check`: PASS. Feature gates `VITE_EXECUTION_WORK_ANALYSIS` and `ENABLE_EXECUTION_WORK_ANALYSIS` remain default OFF.
- Production Vite build: exit 0. Full `ExecutionHub` browser receipt: EN light, EN dark and PL dark, active preview Open, human-readable project/owner names, 0 console/page/HTTP errors.
- Migrations: none. The exact freeze manifest is generated from the content commit and excludes itself.
