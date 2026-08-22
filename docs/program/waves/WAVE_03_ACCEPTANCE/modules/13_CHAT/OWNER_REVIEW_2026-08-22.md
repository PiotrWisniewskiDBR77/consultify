# Chat — owner navigation and visual review, 2026-08-22

Review SHA: `75bed3bb648577e5ac10fec98868893b768c4f92`  
Route: `/chat/13000000-0000-4000-8000-000000000001`  
Persona: `w3.chat.owner@local.test`, active same-tenant OWNER  
Fixture DB: `consultify_w3_chat_owner_piotr_cycle_20260822`  
Owner-review result: `NAVIGATION_AND_VISUAL_REVIEW_COMPLETE / REMEDIATION_REQUIRED / OWNER_VERDICT_PENDING`  
Functional result: `GOVERNED_HANDOFF_OWNER_PATH_PASS / CANVAS_AND_ACTION_API_AUDIT_NOT_RUN / LIVE_PROVIDER_NOT_CONFIGURED`

## Owner outcome and boundary

Piotr judged the screen understandable, readable and generally very strong. The
governed flow `Approve -> Create document -> Document created` was completed in
the browser. This is not final module acceptance: Piotr identified visual and
information-architecture changes, and explicitly assigned Canvas persistence,
toolbar/action endpoints, branches, signals, voice and live-provider behavior to
the integrator rather than to the owner-navigation round.

No finding below is `FIXED` or `OWNER_ACCEPTED`. Screenshots prove only the
visible state at capture time. They do not prove API execution, persistence,
authorization, tenant isolation or audit emission.

## Prioritized correction tasks

### `CHAT-OWN-001` — configurable Canvas/chat side order

- Priority: `P2`
- Owner wording: “Może warto byłoby gdzieś zrobić małą ikonkę umożliwiającą zamianę tych stron, jak kto lubi. Ja osobiście wolę odwrotnie.”
- Evidence: `CHAT-EVD-001`
- Task: add a compact swap-layout control. Support both `Canvas | Teresa` and
  `Teresa | Canvas`, without reloading or losing draft/scroll/focus state.
- Acceptance: preference persists per user after cold login; both layouts retain
  identical functionality; switching is keyboard accessible and does not move
  the global navigation.

### `CHAT-OWN-002` — one header height and a truthful save model

- Priority: `P1`
- Owner wording: “Proszę doprowadzić do tego, aby te wysokości były równe.”
- Evidence: `CHAT-EVD-002`, `CHAT-EVD-005`, `CHAT-EVD-008`
- Task: align the Canvas and conversation header rows. Decide one save contract:
  autosave is preferred for SaaS; otherwise expose one explicit, stateful Save.
  Remove the permanent layout-breaking `Unsaved changes` row.
- Acceptance: equal measured header heights; edits survive refresh and cold
  session; visible states cover `saved`, `dirty`, `saving`, `failed`, and retry;
  no false success and no navigation loss of unsaved work.

### `CHAT-OWN-003` — prove conversation branches or remove premature UI

- Priority: `P1`
- Owner wording: “Proszę tylko zwrócić uwagę, czy jest to podłączone prawidłowo.”
- Evidence: `CHAT-EVD-003`
- Task: audit `Conversation branches`: create, name, switch, preserve parent
  lineage and reopen. If the canonical backend contract does not exist, hide the
  production control and retain the capability as backlog scope.
- Acceptance: API and DB readback prove branch lineage and tenant ownership;
  switching never mutates the parent; reload opens the selected branch; empty,
  forbidden, stale and conflict states are explicit.

### `CHAT-OWN-004` — decide the product role of Important signals

- Priority: `P1`
- Owner wording: “Nie wiem, czy te sygnały do czegokolwiek są teraz wykorzystywane.”
- Evidence: `CHAT-EVD-004`, `CHAT-EVD-016`, `CHAT-EVD-017`
- Task: establish the signal producer, schema, refresh semantics, consumer and
  owner action. Keep the feature only if it has a real end-to-end role. If kept,
  move its trigger to the right-side header action group.
- Acceptance: every signal shows source, freshness, severity and destination;
  zero state explains purpose; refresh reads canonical data; authorization and
  cross-tenant denial are proven. Otherwise the trigger is absent.

### `CHAT-OWN-005` — simplify the Canvas command bar and audit every action

- Priority: `P1`
- Owner wording: “Ten pasek wygląda fantastycznie. Pytanie tylko, czy wszystko prawidłowo jest podłączone i działa.”
- Evidence: `CHAT-EVD-005`, `CHAT-EVD-006`, `CHAT-EVD-008`
- Task: retain the strong visual direction, but create an action-contract matrix
  for every icon. Remove or rename `PROMOTE`; no unexplained label may remain.
- Acceptance per action: control -> endpoint/command -> authorization -> durable
  write -> UI receipt -> API/DB readback -> cold reopen; loading, failure,
  duplicate and stale states tested. An unimplemented control is removed or
  explicitly disabled and labelled.

### `CHAT-OWN-006` — replace the oversized kebab with direct DOC/MD control

- Priority: `P1`
- Owner wording: “Jedyne, czego naprawdę nie ma, to możliwość zmiany, czy widzimy MD, czy DOCA.”
- Evidence: `CHAT-EVD-007`
- Task: inventory the floating kebab menu, remove duplicated actions and actions
  better expressed in conversation. Put `DOC/MD` directly in the main Canvas
  bar. Decide whether a third rich-edit mode has distinct product value.
- Acceptance: no duplicate commands; every retained action has one canonical
  location; view switching preserves the same source content and selection;
  keyboard/focus behavior is stable.

### `CHAT-OWN-007` — repair floating-panel layering and containment

- Priority: `P1`
- Owner wording: “Po otwarciu pływającego menu tekst dokumentu prześwituje lub nachodzi na panel.”
- Evidence: `CHAT-EVD-007`
- Task: correct background opacity, stacking context, clipping and responsive
  width so Canvas text never renders over the menu surface.
- Acceptance: no bleed-through at desktop/tablet, both themes and browser zoom;
  panel remains within viewport, scroll is owned by the panel and focus is
  restored to its trigger on close.

### `CHAT-OWN-008` — complete the governed proposal card in Liquid Glass

- Priority: `P1`
- Owner wording: “To nie jest zgodne z Liquid Class, który już jest standardem naszej aplikacji.”
- Evidence: `CHAT-EVD-009`–`CHAT-EVD-011`
- Task: bring the proposal/decision card into the canonical Liquid Glass system:
  radius, translucent layered background, border, spacing and semantic icon
  color. Remove the unintended cherry tint from the shield.
- Acceptance: `pending`, `approved`, `rejected`, `materializable`, `working`,
  `materialized` and `failed` are visually distinct; source/hash/version remain
  readable; no state depends on color alone. Preserve the already-proven
  `Approve -> Create document -> Document created` behavior.

### `CHAT-OWN-009` — unify response actions and keep icons stable

- Priority: `P1`
- Owner wording: “Całość powinna albo być w jednej tabelce, albo wcale nie być w tabelce.” and “czasem znikają ikony.”
- Evidence: `CHAT-EVD-012`–`CHAT-EVD-014`, `CHAT-EVD-018`
- Task: implement one response-action component. Base and expanded actions must
  share one visual container (recommended: one Liquid Glass capsule). Controls
  remain mounted during sending, streaming, retry and failure; unavailable
  actions become disabled or busy rather than disappearing.
- Acceptance: no layout shift across all response states; consistent radius,
  spacing and focus order; each action has an API/command contract and honest
  feedback; retry does not duplicate an operation.

### `CHAT-OWN-010` — normalize conversation header controls

- Priority: `P2`
- Owner wording: “Zaokrąglenie selektora/menu rozmowy `Main` jest niezgodne ze standardem wizualnym aplikacji.”
- Evidence: `CHAT-EVD-015`–`CHAT-EVD-017`
- Task: align `Main`, branch/history and adjacent controls to canonical Liquid
  Glass radii, height, border, spacing and active/focus states. Place Signals on
  the right only if `CHAT-OWN-004` validates the feature.
- Acceptance: one measured component contract at desktop/tablet and both themes;
  no icon movement or clipping across state changes.

### `CHAT-OWN-011` — restore the stronger personalized start screen

- Priority: `P1`
- Owner wording: “Starsza wersja z powitaniem `Talk to Teresa, Piotr` jest wyraźnie lepszym kierunkiem niż obecne `Let’s start your transformation`.”
- Evidence: `CHAT-EVD-019`, `CHAT-EVD-020`
- Task: rebuild the empty/start state around personalized `Talk to Teresa,
  {firstName}`. The product is broader than transformation; use short,
  contextual/rotating supporting copy. Keep punctuation white, accent the name,
  and restore the larger, lower Consultify brand lockup.
- Acceptance: correct safe fallback without a first name; rotating text never
  changes layout or misstates capability; PL/EN copy reviewed; screen remains
  usable at tablet and zoom; no hydration flash of another user's name.

### `CHAT-OWN-012` — add a subtle living-input pulse

- Priority: `P2`
- Owner wording: “jakiś lekki impuls, na przykład czerwony, żeby powoli krążył i pokazywał, że to okno żyje.”
- Evidence: `CHAT-EVD-019`, `CHAT-EVD-020`
- Task: create a slow, restrained crimson highlight travelling around the input
  border, integrated with Liquid Glass.
- Acceptance: animation pauses/reduces under `prefers-reduced-motion`, consumes
  no material idle CPU/GPU, does not imply sending/recording, retains contrast
  and stops or changes semantics while the input is disabled/busy.

### `CHAT-OWN-013` — rebuild history IA for private and organization work

- Priority: `P1`
- Owner wording: “Ja bym chciał, żebyś go zorganizował bardzo analogicznie do tego, co dziś jest standardem w kodeksie albo w klocie.”
- Evidence: `CHAT-EVD-021`, `CHAT-EVD-022`
- Task: reduce indentation and increase information density. Preserve explicit
  Private and Organization scopes. Implement or backlog canonical folder/project
  management and shared organization context; never present a cosmetic scope
  split without backend/RBAC isolation.
- Acceptance: create/rename/move/archive/delete/search/collapse/reopen persist;
  Recents, pinned items, `Show more` and contextual actions are evaluated;
  private data is owner-only; organization membership/roles control read/write;
  moving private content to organization requires explicit visibility consent;
  shared context has owner, provenance, version and audit trail.

### `CHAT-OWN-014` — give every start-screen control one explicit semantic

- Priority: `P1`
- Owner wording: “dla każdego z tych przycisków, musimy mieć jasno przepisane działania i API.”
- Evidence: `CHAT-EVD-023`
- Task: define three separate contracts:
  1. `Auto/Documents/Tables/Presentations` selects the governed output type and
     its executable artifact API.
  2. `Daily brief/Quick savings/Product idea/Plan review` starts a conversation
     with a reviewed topic-specific prompt.
  3. `Market analysis/Financial analysis/Classic consulting/Digital
     transformation` deep-links to the relevant canonical product capability.
- Acceptance: each control has a destination, prompt/command schema, permission,
  analytics/audit event and return-to-chat context; no dead route, placeholder or
  purely decorative action; prompt starters are visible/editable before send.

### `CHAT-OWN-015` — verify Teresa voice modes across the application

- Priority: `P1`
- Owner wording: “trzeba uwzględnić, że istnieją dwie formuły mówienia” and “Trzeba sprawdzić, czy jest podłączony i czy działa.”
- Evidence: `CHAT-EVD-024`, `CHAT-EVD-025`
- Task: keep the accepted global Teresa side panel, and verify both speech input
  (dictation/conversation as applicable) and Teresa response reading. Audit the
  top-right reading control and persistence across module navigation.
- Acceptance: microphone permissions, listening, transcription, review/send,
  TTS start/pause/stop, mute, unavailable and error states are explicit; no
  recording without clear active indication; state does not leak between users;
  keyboard and screen-reader controls are named.

### `CHAT-OWN-016` — live-provider and user-safe error closure

- Priority: `P1`
- Owner wording: “nie działa, ale rozumiem, że to jest lokalna instancja” and “jestem naprawdę zadowolony z tego, jak to wygląda.”
- Evidence: `CHAT-EVD-012`, `CHAT-EVD-013`, `CHAT-EVD-025`
- Task: run the final Chat round with an authorized real provider. Preserve the
  local fail-closed `NO_LLM_PROVIDER` behavior, but separate user-safe messaging
  from administrator diagnostics.
- Acceptance: send/stream/cancel/retry/recover pass; partial output and duplicate
  prevention are proven; conversation persists after refresh/cold login; ordinary
  users do not see internal endpoints/log instructions; admins retain correlated
  diagnostics; provider failure creates no false answer, proposal or artifact.

### `CHAT-OWN-017` — complete the Canvas functional qualification

- Priority: `P0` acceptance gate
- Owner wording: “Nie przetestowaliśmy, na ile dobrze działa Canvas. Nie przetestowaliśmy, czy działają przyciski w czacie, czy spełniają swoje funkcje. Rozumiem, że to nie jest moim zadaniem w tym momencie.”
- Evidence: entire review set, especially `CHAT-EVD-005`–`CHAT-EVD-008`
- Task: integrator-owned full Canvas qualification after UI remediation. Build an
  inventory of every visible action and editor mode; verify editing, formatting,
  insertion, AI-assisted actions, export, artifact creation, autosave/conflict,
  history/versioning and recovery against canonical services.
- Acceptance: action-contract matrix is 100% reconciled; positive and negative
  paths have browser, network and API/DB evidence; refresh and cold session prove
  persistence; unauthorized/foreign/stale/conflicting commands fail closed; no
  placeholder control remains visible. Piotr receives a retest focused on the
  resulting experience, not endpoint debugging.

## Owner-positive observations retained

- Initial judgment: screen is understandable, readable and all visible elements
  are generally acceptable.
- Canvas command bar visual direction: “wygląda fantastycznie”.
- Governed creation concept and navigation between work items: “co do zasady,
  fantastyczne”.
- Conversation menu: “wygląda dobrze”.
- Global Teresa panel: “Pasuje mi to, jak jest.”
- Overall Chat appearance: “jestem naprawdę zadowolony z tego, jak to wygląda.”

These positives constrain remediation: simplify and connect the experience; do
not replace the accepted overall direction.

## Required retest packet

1. Desktop dark before/after for all P1/P2 visual findings.
2. Desktop light and tablet for the same components; mobile remains separately
   deferred under the Wave 3 program decision.
3. Fresh Canvas fixture with edit/save/conflict/version/reopen evidence.
4. Full action-contract matrix for toolbar, response actions and start screen.
5. Private/organization folder RBAC and shared-context readback.
6. Branch, Signals and voice decisions with implemented evidence or explicit
   removal/backlog disposition.
7. Live-provider send/stream/retry/cold-reopen round.
8. Owner retest on one frozen exact SHA followed by an explicit verdict.

## Current owner decision

Piotr completed the intended visual/navigation walkthrough and delegated
technical integration verification to Codex. He did not state one of the formal
verdict phrases (`Akceptuję`, `Akceptuję po poprawkach`, `Nie akceptuję`). The
module therefore remains `OWNER_VERDICT_PENDING`; the evidence supports
`REMEDIATION_REQUIRED`, not inferred acceptance.
