# UI Canon Packet — EXE-UI-CANON-001 (Execution)

Status: **BLOCKED_HUMAN** (per lane gate catalog — see "Why this task ends here" below).
Prepared by: Sonnet executor, closure lane B, worktree
`/Users/piotrwisniewski/Developer/consultify-closure-claude-b`.
Baseline SHA verified against: `64f507859c717494ffa5e83fae550173c9382230`
(branch `codex/closure-claude-b-transformation`).
This packet is ANALYSIS + EVIDENCE only. No source file was edited to produce it.

## Why this task ends at BLOCKED_HUMAN

Same gate catalog requirement as the sibling packets: signed-in browser/visual proof
at 1440×900/768×1024/390×844, light+dark, PL+EN, all seven states, keyboard flow
with visible focus/focus return, axe critical/serious = 0, plus a named human UX
verdict and manual VoiceOver pass. No agent can produce the human verdict. This
document is the run book + evidence bundle for a human to execute and sign.

---

## 1. Mounted-surface inventory — Execution

Router entry: `src/routes/AppRoutes.tsx:2322-2342` — `Route path={ROUTES.EXECUTION}`
(`/execution`, `src/routes/routeConfig.ts:117`) renders `ExecutionHub`
(imported `AppRoutes.tsx:108-110`) inside `MainLayout` + `V8UnavailableBanner` +
`ProductionModuleGate` (`moduleName="Execution"`). Note: unlike My Work and
Initiatives, `"Execution"` is **not** in the always-on core set
`PUBLIC_PRODUCTION_CORE_ROUTE_MODULES = new Set(['My Work', 'Initiatives',
'Implementation'])` (`AppRoutes.tsx:825`) — the set uses the string `'Implementation'`,
not `'Execution'`, so on the specific VTS-pilot public-production hostname this
module WOULD be hidden by `ProductionModuleGate` unless `'Implementation'` is
meant to alias it. This is a naming mismatch worth flagging but does not affect
demo/dev/normal production, where `shouldHideNonCoreModulesInPublicProduction()`
is false and the gate is a no-op. Legacy aliases: `/implementation` redirects
(query-preserving) to `/execution` (`AppRoutes.tsx:2343-2352`); `/rollout`
redirects to `/execution?tab=rollout` via `RedirectToCanonicalTab`
(`AppRoutes.tsx:2355-2365`) — both are not separate mounted surfaces.
`ExecutionHub` is only ever instantiated with no props from two sites:
`FullExecutionView.tsx:13` and `AppRoutes.tsx:2334` (confirmed by repo-wide grep for
`<ExecutionHub`).

### 1.1 Menu-2 tabs actually shown in the tab bar (`ExecutionHub.tsx:1993-2022`)

| id | label | file:line | reachable how |
|---|---|---|---|
| `list` | "Realizacje" | `ExecutionHub.tsx:1996-1999` | default tab, tab bar |
| `work` | "Praca" | `ExecutionHub.tsx:2000-2004` | tab bar click |
| `resources` | "Zasoby" | `ExecutionHub.tsx:2005-2009` | tab bar click |
| `control` | "Sterowanie" | `ExecutionHub.tsx:2010-2014` | tab bar click |
| `reports` | "Raporty" | `ExecutionHub.tsx:2015-2019` | tab bar click |

The deep-link handler (`ExecutionHub.tsx:907-925`) reads `?tab=` on load and
accepts exactly these 5 values (`['list','work','resources','control','reports']`,
`ExecutionHub.tsx:920`) plus one special case for `rollout` (`:927-932`, see §1.2).
Any other `?tab=` value is ignored by this effect.

### 1.2 Additional surfaces reachable, but NOT via the primary tab bar

| id | component | file:line | how it's actually reached |
|---|---|---|---|
| `rollout` | (subview switch inside `ExecutionHub`, `rolloutSubview` — kpi/risks/closure/plan/change) | render branch `ExecutionHub.tsx:5543`, CTA logic `:5900-5921` | **Legacy URL redirect only**: `/rollout` → `RedirectToCanonicalTab` → `/execution?tab=rollout` (`AppRoutes.tsx:2355-2365`) → deep-link effect special-cases `tab === 'rollout'` and calls `setActiveTab('rollout')` (`ExecutionHub.tsx:927-932`). Also reachable via the Teresa/chat action-handler mapping `rollout: '/rollout'` (`src/hooks/useActionHandler.ts:46`). **Not present in the visible `tabs` array** — a user browsing the tab bar alone will never see a "Rollout" tab; it survives only as a bookmark/AI-action target. |
| `people_change` | `ExecutionManagementView` | render branch `ExecutionHub.tsx:5621-5635`, import `ExecutionHub.tsx:128` | **In-app click target that is NOT a primary tab**: the Execution "Action Center" row "KPI deviation without plan" calls `setActiveTab('people_change')` directly (`ExecutionHub.tsx:4106-4114`). This is a genuine, reachable entry point — but it is one specific row inside an action-queue panel, not a labeled tab a user would discover by browsing tabs. **Not in the `?tab=` deep-link whitelist** (§1.1) — typing `/execution?tab=people_change` in the URL bar does **nothing** (the effect only recognizes the 6 values listed in §1.1); the on-page Action Center row is the only way in. |
| `summary` (Summary one-look) | `ExecutionSummaryOneLook` | render branch `ExecutionHub.tsx:5601-5619`, import `ExecutionHub.tsx:142` | **No reachable trigger exists.** `summaryOneLookEnabled` is read from `isExecutionFlagEnabled('summaryOneLook')` (`ExecutionHub.tsx:1990`) and defaults **ON** everywhere except the specific public-production host (`executionFeatureFlags.ts:116-120`, the D-D fallback) — so the flag itself is usually ON on demo/dev. **But repo-wide grep for `setActiveTab('summary'` / `"summary" as ModuleTab` inside `ExecutionHub.tsx` returns exactly one hit — the render-branch condition itself (`:5601`).** There is no tab-bar entry, no Action Center row, and no `?tab=summary` deep-link support. **The component is imported, its flag is ON by default, and it is still completely unreachable by any current code path** — a fourth, distinct category from the OFF-by-default gated surfaces the task asked to separate out. |

### 1.3 Category classification

1. **MOUNTED and reachable by a normal user at default flag values**: `list`,
   `work`, `resources`, `control`, `reports` (primary tab bar); `rollout` (via the
   `/rollout` legacy URL / Teresa action — reachable, just not from the tab bar);
   `people_change` (via the Action Center "KPI deviation without plan" row —
   reachable, just not from the tab bar or the URL).
2. **Present, imported, gated OFF by default**: none of the above are flag-gated
   OFF by default. `summary`/`ExecutionSummaryOneLook` is the opposite case — its
   flag (`summaryOneLook`) defaults **ON** (except one specific pilot host) yet the
   surface is still unreachable (see category 4).
3. **DEAD (zero importers)**: `ExecutionInitiativeStatusControl.tsx`,
   `KPIDashboard.tsx`, `PeopleChangeWorkspace.tsx`, `ReportCompactPanel.tsx`,
   `RiskSignalsPanel.tsx` — see §2, all five confirmed.
4. **Imported + wired + flag ON, but zero reachable trigger**:
   `ExecutionSummaryOneLook` (`summary` tab id) — see §1.2. Must not appear in a
   "what a user can do today" walkthrough despite its flag being ON by default.

---

## 2. Specific claims verified — all 5 reported-DEAD components

Method: for each file, grepped the entire repo (`src/`) for the bare component
name outside its own file, excluding tests. A hit only inside a code comment
(not an import/JSX usage) does not count as a live importer.

| file | grep result outside own file | verdict |
|---|---|---|
| `src/components/Execution/ExecutionInitiativeStatusControl.tsx` | zero hits anywhere | **VERIFIED — DEAD** |
| `src/components/Execution/KPIDashboard.tsx` | zero hits for this file; the only "KPIDashboard"-named hits in the repo (`src/components/MyWork/IdeaProcessFlowTool.tsx`, `src/components/MyWork/ProcessKPIDashboard.tsx`, `src/components/MyWork/index.ts:44`, `src/components/MyWork/processflow/ProcessFlowToolbar.tsx`, `src/actions/registry/processFlowActions.ts`) are all for a **different, unrelated component** — `ProcessKPIDashboard` in the My Work module — not `Execution/KPIDashboard.tsx` | **VERIFIED — DEAD** (do not confuse with the live `ProcessKPIDashboard` in a different module) |
| `src/components/Execution/PeopleChangeWorkspace.tsx` | one hit, `src/components/Execution/ExecutionChangeSignalsPanel.tsx:134`, and it is a **code comment** ("mirroring the proven pattern in PeopleChangeWorkspace.tsx"), not an import | **VERIFIED — DEAD** |
| `src/components/Execution/ReportCompactPanel.tsx` | one hit, `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx:166`, also a **code comment**, not an import | **VERIFIED — DEAD** |
| `src/components/Execution/RiskSignalsPanel.tsx` | zero hits anywhere | **VERIFIED — DEAD** |

All five files exist on disk (confirmed via `find`) and all five are confirmed to
have zero live importers. None of them should appear in the Execution UI canon
packet as a mounted surface, and none require visual/accessibility evidence in the
human run below.

---

## 3. Browser journey the human must run

Single default role is sufficient for the primary tab bar; the Action Center row
that opens `people_change` may require a specific data condition (a KPI deviation
without a recovery plan) to be visible — the seed data must include at least one
such case, or the row/entry point will not render for the human to click.

1. Sign in, navigate to `/execution`. Confirm default tab = "Realizacje" (`list`).
2. Confirm the tab bar shows exactly 5 tabs: Realizacje, Praca, Zasoby, Sterowanie,
   Raporty — **no** "Rollout", "People & Change", or "Summary" tab visible in the
   bar (canon requirement: don't screenshot surfaces with no tab-bar presence as if
   they were primary tabs).
3. For each of the 5 tabs, capture default/loading/empty/error/success. Note
   which of these genuinely apply (e.g. `control` may not have a meaningful
   "conflict" state — document N/A with reason).
4. Navigate directly to `/rollout` (typed URL) — confirm it lands on
   `/execution?tab=rollout` and renders the rollout subview switch (kpi / risks /
   closure / plan / change). Capture each `rolloutSubview` state that has visible
   UI (`ExecutionHub.tsx:5900-5920` enumerates kpi/risks/closure/plan/change).
5. From the `list` or `work` tab, open the Action Center panel and find the "KPI
   deviation without plan" row (`ExecutionHub.tsx:4106-4114`) — click it and
   confirm it lands on the People & Change view (`ExecutionManagementView`).
   Capture default/empty/success states for this view. If no seed data produces a
   non-zero count for this row, document that the entry point could not be
   triggered and why (seed gap), rather than skipping silently.
6. Do NOT attempt to visually verify the `summary` tab
   (`ExecutionSummaryOneLook`) as a normal user journey step — per §1.2/§2 there is
   no way to reach it through any UI action or URL today, even though its flag is
   ON by default. If the human wants a one-off developer-only capture for the
   backlog record, that requires manually calling `setActiveTab` via devtools or a
   temporary code patch — explicitly out of scope for a "normal user journey" run
   and should be logged as a follow-up, not treated as a required acceptance state.
7. Keyboard flow: Tab through the 5-tab bar, into a tab's content, open/close a
   document or side panel — confirm visible focus at every step and focus return
   to the triggering element on close.
8. Repeat steps 1-7 at each of PL/EN × light/dark × the three viewports
   (1440×900, 768×1024, 390×844).

---

## 4. Artifact list the run must capture

Directory convention: `docs/program/evidence/closure/b/EXE-UI-CANON-001/run-<date>/`

- `screenshots/<viewport>-<theme>-<lang>-<tab>-<state>.png` for the 5 primary tabs
  × states actually run, e.g. `1440x900-light-pl-list-default.png`.
- `screenshots/<viewport>-<theme>-<lang>-rollout-<subview>.png` for each of
  kpi/risks/closure/plan/change.
- `screenshots/<viewport>-<theme>-<lang>-people-change-<state>.png` for the
  Action-Center-triggered People & Change view.
- `screenshots/redirect-rollout-to-execution.png` and
  `screenshots/redirect-implementation-to-execution.png`.
- `keyboard/focus-trace-<viewport>.png` (or short recording).
- `traces/<tab>-<scenario>.zip` — Playwright traces, force `trace: 'on'` for this run.
- `axe/<viewport>-<theme>-<lang>-<tab>.json` — one `@axe-core/playwright` report per
  screen (dependency present: `package.json:427`). Verdict requires 0 critical + 0
  serious.
- `SIGNOFF.md` (template §6).

---

## 5. G4 run configuration — real app, real PostgreSQL

Same contract as the other two packets in this lane
(`playwright.config.ts:9,43` default `useWebServer=false` and `MOCK_DB='true'`;
G4 forbids mock persistence).

```
E2E_USE_WEB_SERVER=true
E2E_MOCK_DB=false
E2E_API_URL=http://127.0.0.1:3001
E2E_BASE_URL=http://localhost:3000
DATABASE_URL=postgresql://<user>:<pass>@<host>:<port>/<real_db>
DB_TYPE=postgres
DB_MANAGED_SCHEMA=off
MOCK_REDIS=true
ENABLE_TEST_GATEWAY=true
ENABLE_TEST_SUPPORT=true
TEST_SUPPORT_KEY=<real-value>
E2E_REQUIRE_TEST_SUPPORT=true
E2E_BACKEND_RUNNER=tsx
```

Command:
```
npx playwright test --project=chromium tests/e2e/<execution-suite>.spec.ts
```

The real database must be seeded with: initiatives in active execution across a
mix of statuses (for `list`/`work`/`resources`/`control`/`reports` non-empty
states), rollout-stage data for at least one initiative (for the `rollout`
subviews), and at least one KPI deviation without a recovery plan (to make the
Action Center's `people_change` entry point clickable per §3 step 5).

---

## 6. Named-human sign-off block (template)

```
Reviewer (name):
Role (title):
Tenant / org used for the run:
Product SHA under test:
Journey executed (§3 steps 1-8): [ ]
Viewports covered: 1440x900 [ ]  768x1024 [ ]  390x844 [ ]
Themes covered: light [ ]  dark [ ]
Languages covered: PL [ ]  EN [ ]
States covered per tab: default/loading/empty/error/permission/conflict/success
  (mark N/A per tab where a state genuinely does not apply, with reason)
Rollout subviews covered: kpi [ ] risks [ ] closure [ ] plan [ ] change [ ]
People & Change entry point triggered via Action Center: YES / seed gap (reason):
Keyboard flow + visible focus + focus return: PASS / FAIL (attach trace)
axe critical=0, serious=0: PASS / FAIL (attach reports)
Manual VoiceOver pass: PASS / FAIL / NOT RUN (reason)
Overall UX verdict: ACCEPT / REJECT / ACCEPT WITH FOLLOW-UPS
Product note acknowledged: "summary" one-look tab has no live trigger despite its
  flag defaulting ON (§1.2) — accept as-is / file follow-up ticket:
Product note acknowledged: ProductionModuleGate module-name mismatch
  ("Execution" vs. "Implementation" in the core-module allowlist, §1) — accept as-is
  / file follow-up ticket:
Follow-ups filed (ticket ids):
Signature / date:
```

---

## 7. Open items explicitly marked NOT_VERIFIED

- Whether the `ProductionModuleGate` naming mismatch (`'Execution'` vs.
  `'Implementation'` in `PUBLIC_PRODUCTION_CORE_ROUTE_MODULES`,
  `AppRoutes.tsx:825`) has any live effect on the actual VTS-pilot hostname was
  **not** tested at runtime — flagged as a static-trace observation only, since it
  does not affect demo/dev where this G4 run will execute.
- Whether other Action Center rows or kebab items elsewhere in Execution set
  `activeTab` to a hidden value the same way the `people_change` row does was not
  exhaustively enumerated beyond the specific claims in the task; a full sweep of
  every `setActiveTab(` call site inside `ExecutionHub.tsx` was performed for this
  packet's specific claims (5 dead components + summary/rollout/people_change) but
  not for the entire 6000-line file's other interactive surfaces.
- No dev server or browser was started while preparing this packet (hard rule for
  this task); all reachability claims above come from static code trace, not
  runtime observation.
