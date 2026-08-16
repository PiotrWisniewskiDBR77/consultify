# UI Canon Packet — INI-UI-CANON-001 (Initiatives)

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

## 1. Mounted-surface inventory — Initiatives

Router entry: `src/routes/AppRoutes.tsx:2188-2202` — `Route path={ROUTES.INITIATIVES}`
(`/initiatives`, `src/routes/routeConfig.ts:110`) renders `InitiativesHub`
(imported `AppRoutes.tsx:105-107`) inside `MainLayout` + `ProductionModuleGate`.
"Initiatives" is in the always-on core set `PUBLIC_PRODUCTION_CORE_ROUTE_MODULES`
(`AppRoutes.tsx:825`), so the production gate is a no-op except on the specific
VTS-pilot public-production hostname. Legacy aliases `/roadmap` and `/portfolio`
redirect (query-preserving) to `/initiatives` (`AppRoutes.tsx:2207-2226`) — they are
not separate mounted surfaces. `InitiativesHub` is only ever instantiated with no
props (`initialTab` defaults to `'list'`) from three sites: `FullInitiativesView.tsx:13`,
`PortfolioView.tsx:13`, and `AppRoutes.tsx:2197` — confirmed by repo-wide grep for
`<InitiativesHub`; none pass an `initialTab` override.

### 1.1 Menu-2 tabs actually shown in the tab bar (`InitiativesHub.tsx:605-629`)

| id | label | file:line | reachable how |
|---|---|---|---|
| `list` | "Inicjatywy" | `InitiativesHub.tsx:608-611` | default tab, tab bar |
| `portfolio` | "Portfel" | `InitiativesHub.tsx:613-616` | tab bar click |
| `plan` | "Plan" | `InitiativesHub.tsx:618-621` | tab bar click |
| `capacity` | "Obciążenie" | `InitiativesHub.tsx:623-626` | tab bar click |

These four are also the only values in `CANONICAL_INITIATIVES_TABS`
(`InitiativesHub.tsx:221`), which gates (a) the initial `?tab=` query read on mount
(`InitiativesHub.tsx:235-238`) and (b) the `popstate` (browser back/forward) handler
(`InitiativesHub.tsx:1138-1147`). `handleMainTabChange`
(`InitiativesHub.tsx:1126-1136`) — the only handler wired to
`StandardModuleBar`'s `onTabChange` — can only ever receive one of these four
values, because `StandardModuleBar` is rendered with `tabs={tabs}`
(`InitiativesHub.tsx:2200`) and that `tabs` array is exactly the four rows above.

### 1.2 Additional `renderContent()` branches that exist in code but have **no reachable trigger**

`InitiativesHub.tsx`'s content switch also branches on three more `activeTab`
values that are **not** in `tabs`, **not** in `CANONICAL_INITIATIVES_TABS`, and are
**never assigned** by any `setActiveTab(...)` call in the file (confirmed:
repo-wide grep for `setActiveTab(` inside this file returns exactly 4 call sites —
`InitiativesHub.tsx:699`, `:727` (both `'list'`), `:1128` (`tab` from
`handleMainTabChange`, constrained to the 4 canonical tabs), `:1145`
(`popstate` handler, also constrained to the 4 canonical tabs) — none of them can
ever produce `'observability'`, `'candidates'`, or `'portfolioHealth'`):

| id | component rendered | file:line | import site |
|---|---|---|---|
| `observability` | `InitiativeObservabilityPanel` | `InitiativesHub.tsx:1424-1426` | `InitiativesHub.tsx:112` |
| `candidates` | `SourceProposalRegistrationSurface` | `InitiativesHub.tsx:1430-1452` | `InitiativesHub.tsx:133` |
| `portfolioHealth` | `PortfolioHealthView` | `InitiativesHub.tsx:1455-1466` | `InitiativesHub.tsx:131` |

Repo-wide grep for `tab=observability`, `tab=candidates`, `tab=portfolioHealth`
across all of `src/` returns **zero** matches — no navigate() call, no `<Link>`,
no button anywhere in the app ever targets these tab ids either. **Conclusion:
these three components are imported, wired into the switch statement, and would
render correctly if `activeTab` were ever set to their id — but nothing in the
current codebase can ever set it that way.** This is a fourth category, distinct
from the three the task asked for: **present + imported + no flag gate + zero
reachable trigger** (neither a UI click path nor a working deep link). Recommend
treating these as functionally DEAD for the purposes of the UI canon packet (they
must not appear in a "what a user can do today" walkthrough), while noting they are
not literally zero-importer dead code like the CandidatesTable/PortfolioHealthTable
files in §2.

### 1.3 Category classification

1. **MOUNTED and reachable by a normal user at default flag values**: `list`,
   `portfolio`, `plan`, `capacity` (all four, no flag gate beyond the
   pilot-only `ProductionModuleGate`).
2. **Present, imported, gated OFF by default**: none found for this module — there
   is no feature-flag-gated Menu-2 surface in Initiatives.
3. **DEAD (zero importers)**: `CandidatesTable.tsx`, `PortfolioHealthTable.tsx`,
   and transitively `CandidatesPanel.tsx` — see §2. These must not appear in any
   UI canon packet.
4. **Imported + wired but unreachable (no trigger exists)** — a variant worth
   flagging separately from both (2) and (3): `InitiativeObservabilityPanel`
   (`observability`), `SourceProposalRegistrationSurface` (`candidates`),
   `PortfolioHealthView` (`portfolioHealth`). See §1.2 and §2.4.

---

## 2. Specific claims verified

### 2.1 `CandidatesTable.tsx` — zero importers

**VERIFIED — DEAD.** File exists at `src/components/Initiatives/CandidatesTable.tsx`.
Repo-wide grep for the string `CandidatesTable` outside its own file returns zero
hits (no import, no reference, not even in a comment).

### 2.2 `PortfolioHealthTable.tsx` — zero importers

**VERIFIED — DEAD.** File exists at `src/components/Initiatives/PortfolioHealthTable.tsx`.
Repo-wide grep for `PortfolioHealthTable` outside its own file returns zero hits.
Note this is a distinct file from the live `PortfolioHealthView.tsx`, which IS
imported (`InitiativesHub.tsx:131`) — do not confuse the two when reading the
packet; `PortfolioHealthView` is itself unreachable for the different reason in §1.2
(no trigger), while `PortfolioHealthTable` is unreachable because nothing imports
it at all.

### 2.3 `CandidatesPanel.tsx` — transitively dead via `CandidatesTable.tsx`

**VERIFIED.** The only reference to `CandidatesPanel` outside its own file is
inside the already-dead `CandidatesTable.tsx`:
```
CandidatesTable.tsx:12: import { type AcceptCandidatePayload, useCandidates } from './CandidatesPanel';
```
`CandidatesTable.tsx:16,24` (comments) confirm this was an additive replacement
attempt that reused `CandidatesPanel`'s `useCandidates` hook. Since
`CandidatesTable.tsx` itself has zero importers (§2.1), `CandidatesPanel.tsx` is
transitively unreachable too — **confirmed dead**, exactly as reported.

### 2.4 "Candidate-accept backend is live and mounted; UI is dead → no way to action a candidate in the product" — PARTIALLY REFUTED, more nuanced than stated

**Backend is confirmed live and mounted**, but the picture on the frontend is more
complex than "the only UI is dead":

- **Legacy candidates backend** (`server/src/routes/initiativeCandidates.routes.ts`,
  4 endpoints: `GET`, `POST` ×3 at lines 43/73/104/148) is mounted at
  `/api/initiatives` via `server/src/Gateway.ts:648`:
  ```
  app.use('/api/initiatives', gatewayVerifyToken, trialEntryGuard, initiativeCandidatesRouter);
  ```
  (import at `Gateway.ts:148`). This is the same backend `CandidatesPanel.tsx`
  (dead, §2.3) was built against (`CANDIDATES_BASE = ${API_URL}/initiatives/candidates`,
  `CandidatesPanel.tsx:55`).

- **This legacy backend DOES have a live frontend consumer today — just not inside
  the Initiatives module.** `src/components/Initiatives/InitiativeSuggestionBadge.tsx`
  calls the exact same endpoints (`CANDIDATES_BASE` at
  `InitiativeSuggestionBadge.tsx:58`, `GET .../candidates?status=pending` at
  `:100`, `POST .../candidates/:id/accept` at `:135`). That badge component is
  imported and mounted in three places, none of which are the Initiatives hub:
  `src/components/Discovery/InsightDetailView.tsx:38,371`,
  `src/views/DRDAuditReportView.tsx:21,687` (gated OFF by default —
  `isDrdReportEnabled()`, see `src/utils/drdReportFlag.ts`, referenced at
  `AppRoutes.tsx:738`), and `src/views/AssessmentSessionEditorView.tsx:38,2101`
  (mounted, reachable via the Assessment module). **So a user CAN accept a
  candidate today, but only by finding the suggestion badge on an Interview
  Insight or an Assessment session screen — not from anywhere inside
  `/initiatives`.**

- **Separately, a newer "source proposal" write path exists** —
  `SourceProposalRegistrationSurface` (imported into `InitiativesHub.tsx:133` for
  the orphaned `candidates` tab, §1.2) talks to a different backend surface via
  `listSourceProposals`/`readSourceProposal` in
  `@/services/initiatives-execution/runtimeApi`
  (`SourceProposalRegistrationSurface.tsx:4-8`), not the legacy
  `initiativeCandidates.routes.ts`. A code comment in `InitiativesHub.tsx:1427-1429`
  explains the intent: *"The legacy 'Accept candidate' write path is intentionally
  no longer reachable from the UI: registration is a governed, idempotent server
  command with read-back."* **However, per §1.2, this replacement surface is itself
  unreachable — nothing in the app ever sets `activeTab` to `'candidates'`.** So the
  intended replacement was wired into the switch statement but never got a tab
  button, nav link, or deep link — it is exactly as unreachable as the legacy path
  it was meant to replace, just for a different reason (no trigger vs. zero
  importers).

**Net conclusion for the packet:** within the Initiatives module specifically, there
is currently **no way to action a candidate** — both the old (`CandidatesTable`/
`CandidatesPanel`, dead) and new (`SourceProposalRegistrationSurface`, orphaned tab)
paths are unreachable from `/initiatives`. The only live, reachable candidate-accept
UI in the product today is the `InitiativeSuggestionBadge` embedded in Interview
Insight and Assessment session screens, hitting the legacy `/api/initiatives/candidates`
backend — a UI/backend pairing that lives entirely outside the module this task
covers. This is a materially important handoff note: fixing the Initiatives module's
`candidates` tab does not just mean "un-delete CandidatesTable" — it means either (a)
wiring a real tab button/nav entry to the already-imported
`SourceProposalRegistrationSurface`, or (b) deciding the Insight/Assessment badge is
the canonical entry point and removing the dead switch branch + dead files instead.
That product decision is out of scope for this evidence packet.

---

## 3. Browser journey the human must run

Single role (any authenticated org member with initiatives read/write) is
sufficient — no role-gated tabs were found in this module (unlike My Work).

1. Sign in, navigate to `/initiatives`. Confirm default tab = "Inicjatywy" (`list`).
2. Confirm the tab bar shows exactly 4 tabs: Inicjatywy, Portfel, Plan, Obciążenie
   — no fifth "Candidates"/"Kandydaci" or "Observability" or "Portfolio Health" tab
   is visible anywhere (canon requirement: don't screenshot surfaces that don't
   exist for a user).
3. For each of the 4 tabs, capture default/loading/empty (org with zero
   initiatives, if a seed exists)/error/success. `capacity` and `plan` may not have
   a meaningful "conflict" state — document as N/A with reason if so.
4. Table/list view: open an initiative document (single click → preview,
   double-click / "open full" → full document) — capture the preview panel and the
   full artifact view as part of the `list` tab's states.
5. Confirm `/roadmap` and `/portfolio` (typed directly in the URL bar) redirect to
   `/initiatives` and preserve any query string — capture one screenshot proving
   the redirect landed on the canonical URL.
6. Do NOT attempt to reach `?tab=candidates`, `?tab=observability`, or
   `?tab=portfolioHealth` as if they were real product surfaces — per §1.2/§2.4
   they are dead ends by design of the current code (the query param is ignored on
   load and on `popstate`); if the human wants to visually confirm this for the
   record, one screenshot of the URL bar showing the ignored query param plus the
   tab bar still on `list` is sufficient evidence, not a full state matrix.
7. Keyboard flow: Tab through the 4-tab bar, into the active tab's content, open a
   document, close it — confirm visible focus at every step and focus return to
   the trigering element on close.
8. Repeat steps 1-7 at each of PL/EN × light/dark × the three viewports
   (1440×900, 768×1024, 390×844).

---

## 4. Artifact list the run must capture

Directory convention: `docs/program/evidence/closure/b/INI-UI-CANON-001/run-<date>/`

- `screenshots/<viewport>-<theme>-<lang>-<tab>-<state>.png` for each of the 4 real
  tabs × states actually run, e.g. `1440x900-light-pl-list-default.png`.
- `screenshots/<viewport>-<theme>-<lang>-list-preview-open.png` and
  `-list-fulldocument-open.png` for the initiative document viewer states.
- `screenshots/redirect-roadmap-to-initiatives.png` and
  `screenshots/redirect-portfolio-to-initiatives.png`.
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
npx playwright test --project=chromium tests/e2e/<initiatives-suite>.spec.ts
```

The real database must be seeded with at least one organization that has
initiatives in a mix of statuses so `portfolio`/`plan`/`capacity` render
non-empty states, plus an org with zero initiatives for the empty state.

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
Keyboard flow + visible focus + focus return: PASS / FAIL (attach trace)
axe critical=0, serious=0: PASS / FAIL (attach reports)
Manual VoiceOver pass: PASS / FAIL / NOT RUN (reason)
Overall UX verdict: ACCEPT / REJECT / ACCEPT WITH FOLLOW-UPS
Product note acknowledged: candidate-accept has no live entry point inside
  /initiatives today (§2.4) — accept as-is / file follow-up ticket:
Follow-ups filed (ticket ids):
Signature / date:
```

---

## 7. Open items explicitly marked NOT_VERIFIED

- Whether `InitiativeSuggestionBadge`'s accept flow (reached via Assessment/
  Discovery, outside this module) is itself visually/accessibly compliant was
  **not** assessed — it belongs to the Assessment/Interview UI canon scope, not
  this Initiatives packet; flagged here only because it's the real answer to "how
  does a user accept a candidate today."
- Empty-org seed availability per tab was not independently confirmed.
- No dev server or browser was started while preparing this packet (hard rule for
  this task); all reachability claims above come from static code trace
  (`setActiveTab` call-site enumeration + whitelist checks), not runtime
  observation.
