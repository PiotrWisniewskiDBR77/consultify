# UI Canon Packet — MYW-AGT-UI-CANON-001 (My Work)

Status: **BLOCKED_HUMAN** (per lane gate catalog — see "Why this task ends here" below).
Prepared by: Sonnet executor, closure lane B, worktree
`/Users/piotrwisniewski/Developer/consultify-closure-claude-b`.
Baseline SHA verified against: `64f507859c717494ffa5e83fae550173c9382230`
(branch `codex/closure-claude-b-transformation`).
This packet is ANALYSIS + EVIDENCE only. No source file was edited to produce it.

## Why this task ends at BLOCKED_HUMAN

The gate catalog for `MYW-AGT-UI-CANON-001` requires signed-in browser/visual proof at
1440×900, 768×1024, 390×844, light+dark, PL+EN, all of
default/loading/empty/error/permission/conflict/success, a keyboard flow with visible
focus and focus return, axe critical/serious = 0, PLUS a named human UX verdict and a
manual VoiceOver pass. No agent can produce the human verdict or run VoiceOver. This
document is the run book + evidence bundle a human executes and signs; every
automatable sub-claim below has already been resolved by static trace so the human
run is pure execution, not discovery.

---

## 1. Mounted-surface inventory — My Work

Router entry: `src/routes/AppRoutes.tsx:1481-1500` — `Route path="${ROUTES.MY_WORK}/*"`
(`/my-work/*`) renders `MyWorkView` inside `MainLayout` + `ProductionModuleGate`.
`ROUTES.MY_WORK = '/my-work'` (`src/routes/routeConfig.ts:56`).
`ProductionModuleGate` only hides the module when
`shouldHideNonCoreModulesInPublicProduction()` is true (a specific VTS-pilot public
production hostname check, `src/utils/publicProduction.ts:31-35`) — "My Work" is also
in the always-on core set `PUBLIC_PRODUCTION_CORE_ROUTE_MODULES`
(`src/routes/AppRoutes.tsx:825`), so on demo/dev/normal production this gate is a
no-op. `MyWorkView` (`src/views/MyWorkView.tsx:16,32`) renders `MyWorkHub`
(`src/components/MyWork/MyWorkHub.tsx`, 4567 lines) — the actual Menu‑2 tab shell.

### 1.1 Menu-2 tabs (`MyWorkHub.tsx:1663-1762`, `allTabs` filtered to `tabs`)

| id | label | file:line (definition) | default visible? | gate | gate default |
|---|---|---|---|---|---|
| `home` (Radar) | "Radar" | `MyWorkHub.tsx:1666-1672` | **NO** | `RADAR_ENABLED` source const, `MyWorkHub.tsx:245` | `false` — hardcoded, **not** an env/runtime flag |
| `ideas` | "Ideas" | `MyWorkHub.tsx:1673-1682` | yes (tab visible) but **content-locked** for non-admin | `isBetaSubareaClosed('MYWORK_IDEAS') && isBetaLockedForRole(role)` → `MyWorkHub.tsx:850-851` | betaAccess.ts `MYWORK_IDEAS: 'closed'` (`src/utils/betaAccess.ts:80`) + `BETA_ADMINS_EXEMPT=true` (`betaAccess.ts:32`) → **locked for every non-admin/owner/superadmin role**, open for admin/owner/superadmin |
| `notebook` | "Notebook" | `MyWorkHub.tsx:1683-1690` | yes | none | — |
| `inbox` | "Inbox" | `MyWorkHub.tsx:1691-1698` | yes — also the fallback/default landing tab (`MY_WORK_FALLBACK_TAB = 'inbox'`, `MyWorkHub.tsx:250`) since `home` is disabled | none | — |
| `calendar` | "Calendar" | `MyWorkHub.tsx:1699-1706` | yes | none | — |
| `tasks` | "Tasks" | `MyWorkHub.tsx:1707-1714` | yes | none | — |
| `decisions` | "Decisions" | `MyWorkHub.tsx:1715-1722` | yes | none | — |
| `vault` (Client Vault) | "Client Vault" | `MyWorkHub.tsx:1726-1733` | yes | `isClientVaultEnabled()` (`src/utils/clientVaultFlag.ts`) | **ON** by default (`clientVaultFlag.ts:34`, resolution order query→localStorage→env→default ON) |
| `agent` (Run agent) | "Run agent" | `MyWorkHub.tsx:1736-1743` | yes | `isAgentPlanEnabled()` (`src/utils/agentPlanFlag.ts`) | **ON** by default (`agentPlanFlag.ts:44`) |
| `manager` | "Manager" | `MyWorkHub.tsx:1744-1751` | yes, role-gated | `canViewManager` = admin/manager/superadmin role (`MyWorkHub.tsx:841-842`) — a **permission** gate, not a feature flag | visible only to admin/manager/superadmin |

Filter logic: `MyWorkHub.tsx:1754-1762`.

### 1.2 Document viewer surfaces opened from tabs (Menu-3 / artifact level)

- `decisions` tab → clicking a decision opens `DecisionDetailView`
  (`MyWorkHub.tsx:177-178` lazy import, mounted unconditionally at
  `MyWorkHub.tsx:3775-3784`, `case 'decision':`). See §2.2 for the DecisionWorkspace claim.
- `ideas` tab → `IdeaMapWorkspace` (`MyWorkHub.tsx:3755-3772`, `case` for idea documents).
- Legacy redirect-only routes that fold into My Work tabs (not separate mounts):
  `/vault` → `Navigate to /my-work?tab=vault` (`AppRoutes.tsx:1531-1534`);
  `/agent-plan` → `Navigate to /my-work?tab=agent` (`AppRoutes.tsx:1564-1567`).

### 1.3 Category classification

1. **MOUNTED, reachable by a normal (non-admin) user at default flag values**:
   `notebook`, `inbox`, `calendar`, `tasks`, `decisions`, `vault`, `agent`. The `ideas`
   tab is visible but its content is behind the beta lock for this role class (see
   below) — classify as MOUNTED-BUT-LOCKED, not fully open.
2. **Present, imported, gated OFF by default for the role in question**:
   - `ideas` tab content for non-admin/owner/superadmin roles — locked by
     `BETA_SUBAREA_STATUS.MYWORK_IDEAS = 'closed'` (`betaAccess.ts:80`); open for
     admin/owner/superadmin (`BETA_ADMINS_EXEMPT=true`).
   - `manager` tab — permission-gated, not flag-gated; open for admin/manager/superadmin.
3. **DEAD or effectively unreachable**:
   - `home` (Radar / `HomeView`) — `RADAR_ENABLED = false` is a hardcoded **source
     constant** (`MyWorkHub.tsx:245`), not a runtime/env flag. It is filtered out of
     `tabs` (`MyWorkHub.tsx:1755`) and coerced away if reached by state
     (`MyWorkHub.tsx:878-882`, `MyWorkHub.tsx:1755`, `MyWorkHub.tsx:3821`). **Turning
     it on requires a code edit + redeploy, not a config/env flip** — confirmed, see
     §2.1.
   - `src/components/MyWork/Decision/DecisionWorkspace.tsx` (+ its `index.ts`
     re-export) — zero importers anywhere in `src/` outside itself. See §2.2.

---

## 2. Specific claims verified

### 2.1 `RADAR_ENABLED = false` is a hardcoded source constant, not an env flag

**VERIFIED.** `src/components/MyWork/MyWorkHub.tsx:245`:
```
const RADAR_ENABLED = false;
```
Comment at `MyWorkHub.tsx:240-244` confirms intent: "Radar (the My Work 'home'
surface) is temporarily HIDDEN and PAUSED... Flipping RADAR_ENABLED back to true
restores the sidebar tab, the default landing, and HomeView rendering — no other
change required." There is no query/localStorage/env override mechanism for this
constant (unlike every other flag in this codebase, e.g. `clientVaultFlag.ts`,
`agentPlanFlag.ts`, `m05DecisionWorkspaceFlag.ts`, which all follow a
query→localStorage→env→default resolution chain). **Turning Radar on requires
editing this line and redeploying — it is a code change, not a config flip.**
Effects of `false`: `home` filtered out of `tabs` (`MyWorkHub.tsx:1755`), any
existing `home` state coerced to the fallback tab on mount
(`MyWorkHub.tsx:878-882`) and on unmount/query (`MyWorkHub.tsx:3821`), and the tab
is excluded from the tab-visibility check at `MyWorkHub.tsx:1755`. **Confirmed
literally OFF for every user at default settings, with no runtime bypass.**

### 2.2 `DecisionWorkspace` vs `DecisionDetailView` — which one is live

**VERIFIED — `DecisionDetailView` is the only one MyWorkHub ever mounts.**
`MyWorkHub.tsx:3775-3784`, `case 'decision':` unconditionally renders
`DecisionDetailView` (imported `MyWorkHub.tsx:177-178`). There is **no** reference
to `DecisionWorkspace` or to `isM05DecisionWorkspaceEnabled` anywhere in
`MyWorkHub.tsx` (confirmed by full-file grep — zero hits for either string).

`src/components/MyWork/Decision/DecisionWorkspace.tsx` (exported via
`src/components/MyWork/Decision/index.ts:1-2`) has **zero importers** anywhere in
`src/` outside its own directory (confirmed by repo-wide grep for
`Decision/DecisionWorkspace` and for any import of `./Decision`/`MyWork/Decision`).
It is dead code by the standard "zero importers" test.

**Nuance worth flagging to the human reviewer:** there IS a feature flag,
`src/utils/m05DecisionWorkspaceFlag.ts`, whose default is **ON**
(`isM05DecisionWorkspaceEnabled()` → `readEnvFlag()` defaults `true`,
`m05DecisionWorkspaceFlag.ts:42-44`), and a comment inside `DecisionDetailView.tsx`
(`DecisionDetailView.tsx:5581-5583`) explicitly claims: *"this legacy view is now
reachable ONLY via the m05DecisionWorkspaceFlag kill-switch (default ON routes to
the real-backend DecisionWorkspace instead — see MyWorkHub.tsx)."* **That comment is
stale/false** — `MyWorkHub.tsx` never reads this flag, never imports
`DecisionWorkspace`, and unconditionally renders `DecisionDetailView`. The flag
module exists, defaults ON, and is completely disconnected from the component it
claims to gate — a phantom flag (same pattern flagged in MEMORY.md for
`ENABLE_TERESA_NOTE_CREATE`). `DecisionDetailView.tsx` is the sole importer of
`m05DecisionWorkspaceFlag.ts` (confirmed by grep), and even there the flag's value
is never actually read/branched on — only mentioned in a comment. **Recommend a
follow-up ticket to either wire the flag into `MyWorkHub.tsx` or delete the dead
flag module + dead `DecisionWorkspace` component + the stale comment**, but that is
out of scope for this evidence-only packet.

### 2.3 `MYWORK_IDEAS` betaAccess value vs. `MyWorkHub.tsx` comment claim

**VERIFIED — the comment in `MyWorkHub.tsx` is stale/wrong.**
`src/utils/betaAccess.ts:80`:
```
MYWORK_IDEAS: 'closed', // My Work → Ideas tab
```
`src/components/MyWork/MyWorkHub.tsx:848` comment claims:
```
// Current config: MYWORK_IDEAS='open' + BETA_ADMINS_EXEMPT=true → nobody locked.
```
This is factually incorrect against the current `betaAccess.ts` SSOT value
(`'closed'`, not `'open'`). The actual runtime effect
(`MyWorkHub.tsx:850-851`):
```
const ideasBetaLocked =
  isBetaSubareaClosed('MYWORK_IDEAS') && isBetaLockedForRole(currentUser?.role);
```
`isBetaSubareaClosed('MYWORK_IDEAS')` → `true` (status is `'closed'`).
`isBetaLockedForRole(role)` → `true` for every role except
admin/owner/superadmin (`betaAccess.ts:92-95`, `BETA_ADMINS_EXEMPT=true`).
**Net effect: `ideasBetaLocked = true` for every regular (non-admin) user** — the
opposite of what the stale comment says ("nobody locked"). Admin/owner/superadmin
are exempt and see the tab unlocked. The `betaAccess.ts:72-80` block comment
explains why it's closed: "podstawowa ścieżka nie działa — kreator 'New Idea'
otwiera zawsze mapę myśli... szablony nie istnieją... 3 z 4 narzędzi są puste."
**The UI canon packet for a normal (non-admin) user must treat `ideas` content as
LOCKED, not open, at default settings.**

---

## 3. Browser journey the human must run

Two role passes are required because `ideas` and `manager` are role-gated.

### Pass A — Regular member (non-admin), PL then EN, light then dark

1. Sign in as a seeded regular-member demo account (not admin/owner/superadmin).
2. Land on `/my-work` (default tab = `inbox`, since Radar is off).
3. Confirm the tab bar shows: Ideas, Notebook, Inbox, Calendar, Tasks, Decisions,
   Client Vault, Run agent — **no "Radar"/Home tab**, **no "Manager" tab**.
4. Click each of: Notebook, Inbox, Calendar, Tasks, Decisions, Client Vault,
   Run agent. For each: capture default state, then trigger loading (fresh reload
   with network throttled/paused if the harness supports it), empty (org/user with
   zero records if a seed exists, otherwise document as NOT_RUN), error (kill the
   API call via devtools/test-support, or note as best-effort), and — where the tab
   supports it — a conflict state (e.g. two tabs editing the same decision) and a
   success state (create/save an item).
5. Click "Ideas" — expect the `AccessBlockedModal` (`BETA_LOCKED`) permission state,
   not the Ideas content. Capture this as the "permission" state for Ideas.
6. Open a Decision document from the Decisions tab — confirm it opens
   `DecisionDetailView` (per §2.2) and capture the "capability notice" banner at
   `DecisionDetailView.tsx:5594-5599` (comments/alternatives/etc. persist to
   localStorage only, not the server — this banner should be visible and legible in
   both themes).
7. Repeat steps 3-6 with the UI language switched to English, then repeat the whole
   pass with the OS/app theme set to dark.
8. Repeat the full pass at each of the three required viewports: 1440×900, 768×1024,
   390×844.
9. Keyboard flow: from a cold page load, Tab through the tab bar, into a tab's
   content, open a document, and close it — confirm focus is always visible
   (visible focus ring token, not default browser outline unless that IS the
   canon token) and that closing a document returns focus to the triggering
   element (not to `<body>`).

### Pass B — Admin/Owner/Superadmin, PL, light (minimum; repeat matrix if time allows)

1. Sign in as an admin/owner/superadmin seeded account.
2. Confirm "Manager" tab is now visible in the tab bar (role gate open).
3. Confirm "Ideas" tab now opens real content instead of `AccessBlockedModal`
   (beta-admin exemption).
4. Capture default/loading/empty/error/success for the Manager tab.
5. Do NOT test Radar/Home — it is source-disabled for every role (§2.1); there is
   no environment variable or query override that will turn it on. Confirm this by
   trying `?ff_...` style query overrides are absent for this specific flag (there
   is none to try) and noting the tab stays absent.

---

## 4. Artifact list the run must capture

Directory convention: `docs/program/evidence/closure/b/MYW-AGT-UI-CANON-001/run-<date>/`

- `screenshots/<viewport>-<theme>-<lang>-<role>-<tab>-<state>.png` for every
  (viewport × theme × lang × role × tab × state) combination actually run, e.g.
  `1440x900-light-pl-member-inbox-default.png`,
  `390x844-dark-en-admin-manager-empty.png`.
- `screenshots/<viewport>-<theme>-<lang>-<role>-decisions-detailview-capability-banner.png`
  — explicit capture of the `DecisionDetailView.tsx:5594-5599` banner.
- `screenshots/<viewport>-<theme>-<lang>-member-ideas-permission-blocked.png` —
  the `AccessBlockedModal` permission state.
- `keyboard/focus-trace-<viewport>.png` (or a short screen recording) showing the
  Tab-order walk and focus-return-on-close behavior.
- `traces/<role>-<tab>-<scenario>.zip` — Playwright trace files (`trace:
  'retain-on-failure'` is the repo default per `playwright.config.ts:87`; force
  `trace: 'on'` for this acceptance run so traces exist even on pass).
- `axe/<viewport>-<theme>-<lang>-<role>-<tab>.json` — one `@axe-core/playwright`
  report per screen captured above (dependency already present:
  `package.json:427`, `"@axe-core/playwright": "4.13.0"`). Verdict requires
  0 critical + 0 serious violations per report.
- `SIGNOFF.md` (template in §6 below, filled in and signed).

---

## 5. G4 run configuration — real app, real PostgreSQL

`playwright.config.ts:43` defaults `MOCK_DB` to `'true'`
(`` `MOCK_DB=${process.env.E2E_MOCK_DB ?? 'true'}` ``) and `playwright.config.ts:9`
defaults `useWebServer` to `false` (`process.env.E2E_USE_WEB_SERVER === 'true'`).
G4 forbids mock persistence, so both must be overridden explicitly.

Required env block (values per `playwright.config.ts:7-58`):

```
E2E_USE_WEB_SERVER=true
E2E_MOCK_DB=false
E2E_API_URL=http://127.0.0.1:3001          # or the real backend under test
E2E_BASE_URL=http://localhost:3000          # or the real frontend under test
DATABASE_URL=postgresql://<user>:<pass>@<host>:<port>/<real_db>   # NOT the mock default
DB_TYPE=postgres
DB_MANAGED_SCHEMA=off
MOCK_REDIS=true                              # unless a real Redis is also required by the run
ENABLE_TEST_GATEWAY=true
ENABLE_TEST_SUPPORT=true
TEST_SUPPORT_KEY=<real-value, not the local placeholder>
E2E_REQUIRE_TEST_SUPPORT=true                # forces globalSetup/globalTeardown to run
E2E_BACKEND_RUNNER=tsx                        # or "build" if the sandbox needs a compiled server
```

Command:
```
npx playwright test --project=chromium tests/e2e/<my-work-suite>.spec.ts
```

Notes:
- `playwright.config.ts:20-21` — if `DATABASE_URL` is not set it silently falls back
  to `postgresql://user:pass@127.0.0.1:5432/consultify`; the human must explicitly
  point this at a real, non-mock Postgres instance seeded with a regular-member and
  an admin/owner/superadmin account.
- `playwright.config.ts:151,161` — the config itself warns when localhost is used
  without `E2E_USE_WEB_SERVER=true`, and requires `E2E_ALLOW_LOCALHOST_REMOTE=true`
  to intentionally bypass that guard; do not set the bypass for this G4 run.
- Do NOT start a dev server yourself while preparing this packet (hard rule for
  this evidence task) — the env block above is for the human's own G4 execution.

---

## 6. Named-human sign-off block (template)

```
Reviewer (name):
Role (title):
Tenant / org used for the run:
Product SHA under test:
Journey executed: Pass A (member) [ ]   Pass B (admin) [ ]
Viewports covered: 1440x900 [ ]  768x1024 [ ]  390x844 [ ]
Themes covered: light [ ]  dark [ ]
Languages covered: PL [ ]  EN [ ]
States covered per tab: default/loading/empty/error/permission/conflict/success
  (mark N/A per tab where a state genuinely does not apply, with reason)
Keyboard flow + visible focus + focus return: PASS / FAIL (attach trace)
axe critical=0, serious=0: PASS / FAIL (attach reports)
Manual VoiceOver pass: PASS / FAIL / NOT RUN (reason)
Overall UX verdict: ACCEPT / REJECT / ACCEPT WITH FOLLOW-UPS
Follow-ups filed (ticket ids):
Signature / date:
```

---

## 7. Open items explicitly marked NOT_VERIFIED

- Exhaustive enumeration of every modal/drawer *inside* each tab (e.g. every
  kebab action in Tasks/Calendar/Notebook) was **not** performed — this packet
  covers the Menu-1/Menu-2/document-viewer mounted-surface level required for the
  UI canon inventory, not every nested dialog. A deeper pass would be needed if the
  gate requires per-modal screenshots.
- Whether an empty-org seed exists for every tab (for the "empty" state) was not
  independently confirmed against the demo seed data; the human run must check
  seed availability per tab or document the state as N/A with reason.
- `error` and `conflict` states generally require either test-support fault
  injection or a second concurrent session; neither was exercised here (analysis
  only, no dev server/browser was started per the hard rules for this task).
