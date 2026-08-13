# Case Workspace — interaction, responsive and accessibility contract

> Status: `APPROVED_SPEC / RUNTIME_PARTIAL`
> Date: 2026-08-09
> Owner: UX + Design System + Frontend
> Product parents: `01_PRODUCT_CANON_AND_MODES.md`, `02_INFORMATION_ARCHITECTURE_AND_UX.md`
> UI authority: `docs/ui-standards/CANON.md`, `docs/ui-standards/00-foundation/visual-language.md`

## 1. Interaction principles

1. Lightweight first: outcome, current state, attention and next action precede configuration.
2. Visible controls, no hidden mode changes.
3. Tabs switch places or projections; toggles only change boolean settings.
4. Every mutation states actor, target, effect and reversibility.
5. Teresa proposes changes to a draft or creates a version-bound proposal; she never edits a published plan silently.
6. Drag-and-drop is an acceleration, never the only operation.
7. Live updates preserve focus, scroll and user drafts.
8. Deep links restore Case, phase, selected step/result and return focus.
9. Destructive actions require danger semantics, named consequence and confirmation.
10. UI never substitutes animation for a durable state receipt.

## 2. Command and navigation behavior

The Workspace obeys one Command Row under the existing topbar. View-local controls such as `Prosty | Ekspercki | Lista`, zoom and timeline filters live inside the active view, not in another global toolbar.

Primary navigation:

- My Work remains the global attention origin.
- `Plan | Realizacja | Rezultaty` are semantic tabs.
- browser Back restores the prior My Work filter/preview or native deliverable return point.
- opening Teresa later does not change the Case context silently.

`Chat | Work` must never be implemented as a boolean toggle. Use split view on wide screens and semantic tabs on narrow screens.

## 3. Plan interactions

### 3.1 Add and connect

A user may:

- click `+` between steps;
- search the capability palette;
- drag a capability onto a valid edge;
- use keyboard commands `Dodaj przed`, `Dodaj po`, `Połącz z`;
- ask Teresa to propose a structural diff.

The UI previews the insertion location and validates typed inputs/outputs. Incompatible connections remain unapplied and explain the mismatch.

### 3.2 Select and inspect

Selecting a node opens a compact drawer. `Pełne szczegóły` changes to the expert projection with the same node selected. `Pokaż na Flow` returns to and centers the same node.

Selection is neutral and uses the shared selected-state token. Crimson is reserved for Teresa brand presence and destructive semantics, never selection, normal CTA or focus.

### 3.3 Move, branch and undo

- Visual movement alone does not change execution order.
- Reconnecting an edge is a semantic change and enters the draft diff.
- Branches require readable labels.
- Auto-layout never changes graph semantics.
- Undo/redo covers manual and Teresa-applied draft diffs.
- Published versions cannot be edited; editing creates a new draft.

### 3.4 Save and lifecycle

Autosave states are `Zapisywanie`, `Zapisano`, `Błąd zapisu`. Plan lifecycle states are `Szkic`, `Do przeglądu`, `Opublikowany`, `Wycofany`. They are rendered independently.

## 4. Execution interactions

### 4.1 Start and one-click

For a small safe one-step plan, one primary action may create and start the work. Before activation the compact preview still names:

- outcome;
- native module/result;
- Teresa's allowed action;
- autonomy level;
- data/recipient scope;
- side effect and approval behavior.

Multi-step or material work requires plan review. `Publish` and `Start` remain separate when risk, participants or irreversible effects justify the distinction.

### 4.2 Runtime controls

Only state-valid actions are visible. Each control returns a durable receipt and updated readback:

- pause/resume;
- cancel;
- retry failed step;
- provide input;
- approve/reject/request changes;
- remind/reassign a human task;
- re-run from checkpoint;
- propose a replan.

A cancelled or rejected action cannot continue because of a stale client event.

### 4.3 Approval interaction

An approval surface always includes summary, semantic diff, risk, evidence, consequence, expiry and actions. After decision it becomes a receipt with actor, timestamp, decision ID, plan/proposal version and audit link; active controls disappear.

### 4.4 Live updates

- New events never force-scroll a user reading older history.
- `3 nowe zdarzenia` offers an explicit jump.
- Last confirmed server time remains visible during reconnect.
- Lost connection does not imply a failed Run.
- Duplicate socket/poll events are deduplicated in the UI and runtime.

## 5. Native deliverable deep links

A result link includes stable Case and result identifiers but no sensitive payload in the URL. Opening `Otwórz w Finance`, `Otwórz Interview` or another owner module:

- loads the canonical native object;
- preserves permissions;
- shows optional Case context in the native header;
- provides a semantic return path to the same Case phase and selected step;
- restores focus to the triggering result card or node.

An unavailable/deleted source is rendered as unavailable with provenance and recovery guidance; it is not silently removed from lineage.

## 6. Responsive contract

### 6.1 Wide desktop (>=1280 px)

- Zlecenia uses table + preview.
- Plan may show canvas plus one inspector drawer.
- Realizacja may show main content plus an attention rail.
- Teresa may later open as a contextual right panel, never a permanent fourth column.
- Floating panels use shared elevation; content cards remain shadowless.

### 6.2 Narrow desktop and tablet (768–1279 px)

- One primary content region at a time.
- Inspector and attention become drawers.
- `Prosty | Ekspercki | Lista` remains visible as a segmented view control.
- Chat and Work later become tabs rather than compressed split view.
- The plan does not depend on a long fixed vertical canvas.

### 6.3 Mobile (<768 px)

- Default Plan projection is Lista.
- Step Detail is full-screen.
- Realizacja uses a vertical timeline and sticky attention action.
- Approvals, provide-input, pause, resume and cancel remain fully operable.
- Complex canvas authoring may be desktop-only, but every semantic edit required for ordinary work has a list/form equivalent.
- Actions use an accessible action sheet; no swipe-only command.
- Sticky regions must not cover focused controls or the on-screen keyboard.

Required visual test widths are `320`, `375`, `430`, `768`, `1024`, `1440` and `1920` px, plus 200% browser zoom.

## 7. Accessibility contract

Target: WCAG 2.2 AA.

### 7.1 Structure and focus

- Semantic landmarks and heading hierarchy.
- `Plan | Realizacja | Rezultaty` and view switchers use `tablist`, `tab`, `tabpanel` semantics.
- Arrow keys move tab focus; Enter/Space activates according to the shared primitive contract.
- Drawers/modals trap focus only while modal, close with supported dismiss behavior and return focus to the trigger.
- Deep-linked content receives programmatic focus on its heading without unexpected scroll loops.
- All touch targets are at least 44 x 44 pt.

### 7.2 Canvas equivalence

- Every node is keyboard-focusable and announces label, type, owner and state.
- Every edge appears in the selected node's textual `Połączenia` section.
- Add, connect, move, duplicate and delete have non-drag commands.
- The Lista projection exposes the same plan meaning and validation issues.
- Keyboard navigation supports skip links to selected step and validation problems.
- Zoom and pan are not prerequisites for reading or editing the plan.

### 7.3 Status and announcements

- Status is text plus optional icon/color, never color alone.
- `aria-live=polite` announces meaningful progress, reconnect and approval receipt.
- Background event streams do not repeatedly announce technical heartbeats.
- Error/block/partial messages name the consequence and available recovery.
- Focus remains with the user's current task after live updates.

### 7.4 Motion, contrast and content

- Focus uses `--c-focus`, never crimson.
- Motion uses shared `--motion-fast/base/slow` tokens and remains <=220 ms.
- `prefers-reduced-motion` removes movement/scale and nonessential animation.
- Light and dark modes meet contrast requirements.
- Graphs/KPI charts provide text/table equivalents.
- Icon-only actions have accessible names and tooltips where appropriate.

## 8. Design-system constraints and component binding plan

Feature screens compose shared components; they do not introduce a local visual language. Proposed reusable families require review and a binding entry before implementation:

| Family | Responsibility | Existing binding/candidate |
|---|---|---|
| Workspace shell | Header, one Command Row, phase tabs | Existing My Work shell in `src/components/MyWork/MyWorkHub.tsx`; no new parallel shell. |
| List/preview | Zlecenia navigation | `src/components/standard/`, existing integration in `AgentHubShell.tsx`; comply with TRIADA. |
| Status | User-facing lifecycle and attention | Extend central mapping in `src/constants/statusColors.ts`; no local status palette. |
| Selection/focus | Selected row/node and keyboard focus | `src/components/shared/selectionTokens.ts`, `--c-focus` in `src/index.css`. |
| Flow | Node, edge, view toolbar | Candidate `AgentPlanCanvas.tsx`; requires canonical Definition binding and list equivalent before acceptance. |
| Palette/inspector | Typed capability discovery and step detail | Candidates `AgentWorkshopPalette.tsx`, `agentWorkshopCatalog.ts`; entries require executor contracts. |
| Approval | Summary, diff, evidence, action, receipt | Reuse shared decision/approval primitives where available; no chat-only governance duplicate. |
| Timeline | Business events and technical disclosure | Must use the shared timeline family; raw log styling is not a new default. |
| Deliverable link | Native result identity and return path | Shared deep-link component required across owner modules. |

Visual rules:

- one colored primary action per active region;
- ordinary module CTA uses navy; Teresa presence may use brand crimson; destruction uses danger semantics;
- selection is neutral;
- content separation uses surfaces and spacing before borders;
- cards in cards are not the default;
- shadows are limited to floating UI and sticky elevation;
- Inter, flattened type hierarchy, `font-semibold` rather than bold headings;
- outline icons with consistent stroke;
- no gradient, glow or broad animation to signify AI.

## 9. Required UI states

Each primary surface must provide deterministic fixtures and runtime proof for:

- empty;
- initial loading;
- background refresh;
- slow network;
- stale/offline;
- validation error;
- permission denied;
- concurrency conflict;
- rate limit;
- backend failure;
- lost event connection/reconnect;
- blocked governance/membership;
- partial completion;
- expired approval;
- unavailable source;
- restart during active Run.

No state may show an infinite spinner without status, timeout and recovery.

## 10. Interaction acceptance criteria

### 10.1 Automated and semantic

- keyboard-only completion of create, review, start, approval and native-result return;
- no critical/serious automated accessibility findings;
- tab, drawer, dialog, menu and live-region semantics tested;
- reduced-motion coverage;
- no duplicate mutation after double click, refresh, reconnect or replay;
- stable deep-link restoration for Case, phase, step, approval and deliverable;
- List and Flow expose identical step count, identity, validation and dependencies;
- UI status is derived from canonical read model, not optimistic fiction.

### 10.2 Browser and device evidence

One exact SHA/deployment evidence pack contains:

- screenshots in light/dark at all required widths;
- video of direct module work without Case;
- video of safe one-click Zlecenie;
- video of reviewed multi-step plan through Run and native result;
- mobile approval and waiting-step monitoring;
- keyboard and VoiceOver/NVDA walkthrough;
- 200% zoom evidence;
- controlled blocked, partial, offline, conflict and restart states;
- focus return after drawer, deep link and native module visit;
- browser network trace matched to API, event and realDB readback;
- plan version, Run ID, approval receipt and deliverable lineage;
- tenant/project isolation proof.

Build success, mock-only tests, a screenshot without readback, helper tests, stale deployment evidence or self-attestation do not satisfy final acceptance. Until the full pack is current for one candidate, runtime status remains `PARTIAL`.
