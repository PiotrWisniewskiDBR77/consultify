# Case Workspace — information architecture and UX

> Status: `APPROVED_SPEC / RUNTIME_PARTIAL`
> Date: 2026-08-09
> Owner: Product + UX
> Product parent: `01_PRODUCT_CANON_AND_MODES.md`
> UI authority: `docs/ui-standards/CANON.md`; list anatomy remains subordinate to `docs/ui-standards/TRIADA_KANON.md`

## 1. UX outcome

The lightweight Workspace must answer four questions before exposing implementation detail:

1. What do we want to achieve?
2. What is happening now?
3. What needs attention?
4. What results already exist?

The primary Polish information architecture is:

`Plan | Realizacja | Rezultaty`

These are projections of one Case, not separate storage domains.

## 2. Placement now and later

### 2.1 Now — My Work

The first product surface lives inside the existing My Work shell. It must preserve the frozen navigation and one Command Row rule.

The current `Run agent` surface becomes a `Zlecenia` entry with:

- a list of Cases/Zlecenia;
- filters and saved views;
- one shared attention queue through My Work;
- entry to the lightweight Case Workspace;
- direct links to native module work;
- an explicit `Widok zaawansowany` entry for process design.

It must not add a second task inbox, second approvals inbox or second top-level toolbar.

### 2.2 Later — Chat

Teresa adds a conversational entry to the same objects:

`conversation -> proposed Zlecenie card -> plan review -> same Case Workspace`

Chat does not receive a private planner, Run state or deliverable store. On a wide desktop Teresa may be a contextual side panel. On narrower viewports `Rozmowa | Zlecenie` are tabs, not an on/off toggle.

## 3. Zlecenia list

The list follows the existing list/table canon. Desktop uses a table plus preview; mobile uses equivalent cards/list rows.

Required columns or row facts:

- name and expected outcome;
- type: one-step, flow, transformation;
- user-facing status;
- attention state;
- result progress, not merely node count;
- owner;
- next action;
- deadline;
- last activity.

Default priority order:

1. requires my decision;
2. blocked;
3. overdue or expiring;
4. active;
5. recent.

Saved views:

- `Wymaga mojej uwagi`;
- `Moje aktywne`;
- `Zespół`;
- `Szkice`;
- `Zaplanowane`;
- `Zakończone`.

Definition records and individual Runs must never be silently mixed as equivalent rows. A Zlecenie row may summarize the active/latest Run and link to its history.

## 4. Workspace shell

### 4.1 Compact header

The header contains:

- Zlecenie name;
- one-sentence outcome;
- status and health;
- owner and optional deadline;
- last confirmed update;
- one primary action appropriate to state;
- overflow actions;
- later, contextual `Porozmawiaj z Teresą`.

Scope, participants, autonomy, budget and full brief open in a drawer. They do not create a permanent second header row.

### 4.2 Phase tabs

The stable tabs are:

- **Plan** — intended work and plan approval;
- **Realizacja** — live Run, attention and timeline;
- **Rezultaty** — decisions, native deliverables, evidence and value.

Unavailable phases remain visible with a reason, for example `Realizacja — plan niezatwierdzony`.

## 5. Plan

### 5.1 Default projection

The default Plan is a lightweight flow showing:

- outcome and definition of done;
- business steps;
- human/Teresa/system owner;
- owning module;
- expected native result;
- main dependency or gate;
- validation warning.

### 5.2 Three views, one definition

`Prosty | Ekspercki | Lista`

- **Prosty** is a simple n8n-like visual projection for orientation and common edits.
- **Ekspercki** exposes contracts, routing, policies and evidence.
- **Lista** is the mobile and accessibility-equivalent projection.

Switching views preserves the selected `stepId`, plan version, viewport/scroll and focus target. A change in one view appears immediately in the others. Stable route values are `simple | expert | list`; English names are identifiers only, never visible UI copy.

### 5.3 Flow node and edge

A node shows only:

- business label;
- type;
- executor;
- owning module;
- expected output;
- duration/wait indicator;
- validation or runtime status.

Edges mean `after completion`, `after approval`, `if`, `parallel`, `after event` or `after date`. Branch edges require text labels. Color is never the only differentiator.

### 5.4 Contextual palette

The palette opens through `+`, search or insert-on-edge. Categories are:

- Moduły;
- Teresa / AI;
- Praca człowieka;
- Decyzje i zgody;
- Dane i dokumenty;
- Czekanie i zdarzenia;
- Sterowanie;
- Integracje.

A palette item names its capability, required input, created deliverable, owner module and availability. A block without a working executor is disabled and says what is missing.

### 5.5 Step detail

The first disclosure level is a compact drawer:

- purpose;
- owner;
- inputs;
- result;
- approval;
- duration/wait;
- risk.

`Pełne szczegóły` exposes typed contracts, routing, policy, retry, timeout, idempotency, schemas, evidence and diagnostics. Secret values are never rendered.

### 5.6 Plan approval

Before material execution the review summarizes:

- outcome and success criteria;
- steps and owners;
- autonomy level;
- writes/side effects;
- approvals and human/external waits;
- data, connections and recipients;
- expected time/cost;
- risk and reversibility;
- validation issues;
- diff from the previous published version.

A small safe one-step plan may combine confirmation, creation and start into one `Zatwierdź i rozpocznij` action. The preview remains explicit; one click means low ceremony, not hidden execution.

## 6. Realizacja

### 6.1 Overview

The default Run view contains:

- health summary;
- active or waiting step;
- consolidated attention;
- next action;
- progress by results/milestones;
- time and cost;
- state-valid controls;
- business timeline.

Controls include `Start`, `Zaplanuj`, `Wstrzymaj`, `Wznów`, `Anuluj`, `Ponów` and `Zaproponuj zmianę planu` according to policy and role.

### 6.2 Honest statuses

User-facing statuses are:

- Szkic;
- Gotowe;
- Zaplanowane;
- W toku;
- Czeka na Ciebie;
- Czeka na zespół;
- Czeka na system;
- Wymaga uwagi;
- Zablokowane;
- Częściowo zakończone;
- Zakończone;
- Anulowane.

Technical substates remain in diagnostics. Save state remains separate from lifecycle state.

### 6.3 Attention

Each attention item states:

- what is required;
- why now;
- impact of no action;
- owner and deadline;
- Teresa's recommendation;
- evidence and freshness;
- available decisions;
- escalation or recovery.

Governance and membership blocks are not rendered as generic errors.

### 6.4 Timeline

The business timeline includes step transitions, human/external waits, approvals, deliverables, retries, pauses, replans, failures and outcome observations. Repeated technical heartbeats are aggregated. Raw events and correlation IDs are contextual diagnostics.

### 6.5 Long-running human and external steps

`Running` is forbidden for a step that is actually waiting. The step card identifies:

- who or what is awaited;
- wait start and expected signal;
- deadline/SLA;
- last confirmed contact or heartbeat;
- reminder/escalation policy;
- next automatic action;
- impact on the Case;
- permitted `remind`, `reassign`, `skip`, `retry` or `cancel` actions.

### 6.6 Runtime plan projection

The Plan projection in Realizacja is read-only and overlays `pending`, `active`, `waiting`, `attention`, `blocked`, `partial`, `failed`, `skipped` and `completed`. It never turns the published definition into an editable live graph.

## 7. Rezultaty

Results are domain objects, not a list of generated files. Required groups are:

- key findings and recommendations;
- decisions;
- native deliverables;
- effect/value;
- evidence and lineage.

Each result shows status, owner, owner module, version, sources, approval, freshness and a deep link `Otwórz w [module]`.

Value distinguishes:

- baseline;
- target;
- actual;
- measurement date/window;
- confidence and attribution;
- next measurement;
- `unmeasured`, `partial`, `confirmed`, `not achieved` and `evidence missing`.

## 8. Teresa and approvals in the later Chat surface

The active context is always explicit:

`Kontekst: [Zlecenie name] [Zmień] [Odłącz]`

An approval card includes:

- decision title and summary;
- why it is needed now;
- semantic diff: added, removed, changed;
- impact, reversibility and risk;
- evidence count, freshness and gaps;
- requester, owner and expiry;
- `Zatwierdź`, `Poproś o korektę`, `Odrzuć`, optional `Deleguj`;
- immutable receipt after the decision.

Conversational confirmation is allowed only for exact Chat-to-Case confirmation and A0/A1 work. A2 execution requires an explicit `Zatwierdź i rozpocznij`/equivalent control or an already published plan policy. Material A3/A4 actions, formal Decisions, Initiatives, budget, shared publication, external action and closure require an explicit approval control plus step-up or dual control where policy requires it. A loose `OK` never selects between multiple proposals.

## 9. Empty, loading, error and partial states

Every phase supplies honest states:

- **Empty:** explains why there is no content and offers both direct-module and Teresa/Zlecenie paths where appropriate.
- **Loading:** preserves structure and last confirmed state; no full-screen reset for background refresh.
- **Stale/offline:** shows timestamp and disables unsafe mutations.
- **Error:** names the failed action, persistence impact, recovery and correlation reference.
- **Blocked:** identifies reason, unblock owner, required action and consequence.
- **Partial:** states exactly which results are complete, unverified or missing.
- **Permission denied:** names required role/route to request access without leaking protected content.
- **Conflict:** shows the newer version and offers review/merge rather than silent overwrite.

## 10. Code mapping

| UX surface | Current code candidate | Acceptance note |
|---|---|---|
| My Work mount | `src/components/MyWork/MyWorkHub.tsx` | Preserve shared My Work and frozen shell. |
| Current list/preview shell | `src/components/AIChat/AgentHubShell.tsx` | Migration source for Zlecenia list; do not preserve mixed definition/run semantics. |
| Plan composition | `src/components/AIChat/AgentPlanWorkspace.tsx`, `AgentPlanPanel.tsx` | Split lightweight Plan from advanced configuration. |
| Flow canvas | `src/components/AIChat/AgentPlanCanvas.tsx` | Must become a projection of canonical Plan Definition and have a list equivalent. |
| Palette | `src/components/AIChat/AgentWorkshopPalette.tsx`, `agentWorkshopCatalog.ts` | Capability-backed entries only. |
| List capability contract | `src/components/MyWork/tableSurfaceCapabilities.ts` | Rename/migrate without creating a parallel list canon. |
| Current API adapter | `src/services/api/agentPlan.api.ts` | Must not remain the final owner beside canonical V8 Case/Run. |
| Visibility/read model | `server/src/services/v8/executionVisibilityService.ts` | Candidate source for unified Plan/Run/attention read model. |

## 11. UX acceptance

Acceptance requires browser evidence on one exact SHA that proves:

- a user can identify outcome, state, attention and next action without opening advanced detail;
- list, preview and Workspace preserve My Work navigation conventions;
- Flow, Lista and Szczegóły remain synchronized;
- Definition, published version and Run cannot be confused;
- a wait lasting days has an honest waiting state and escalation;
- every result deep-links to the native module and returns to the selected Case/step;
- all empty/loading/stale/error/blocked/partial states are rendered from controlled runtime conditions;
- direct module work and Teresa-created work expose the same canonical result identity;
- no screen claims completion without real API/DB readback.
