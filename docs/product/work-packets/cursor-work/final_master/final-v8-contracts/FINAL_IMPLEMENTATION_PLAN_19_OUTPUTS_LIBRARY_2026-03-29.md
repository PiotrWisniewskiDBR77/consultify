# Final Implementation Contract — Outputs Library (Position 19/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: `approved(scope)` for **P19-A** (library canon frozen); P19-B / P19-C not started  
Last updated: 2026-03-30 (P19-A scope closure)

## 1. Executive summary
- **Intent**: Jedno miejsce na efekty pracy (tabele/excel, word, prezentacje, raporty); wyszukiwanie + automatyczne tworzenie i wysyłanie.
- **Primary users**: każdy użytkownik wytwarzający/odbierający artefakty; reviewerzy.
- **Success metric**: „one canonical artifact home” z jawna taksonomią, kolejkami (mine/needs review/type), preview/open/reopen i spójnym trust-state.

## 2. Scope
### 2.1 In-scope
- Biblioteka jako kanoniczny home dla artefaktów (bez drugiej rejestracji).
- Taxonomy + queue semantics + ownership/review signals.
- Preview/open/reopen spójne z registry truth.

### 2.2 Out-of-scope / non-goals

**Product non-goals (explicit)**

- **Full DAM / media asset management** — no canonical “second library” for files, versions, or rights that competes with artifact truth.
- **Second Outputs Library, second artifact registry, or alternate “home”** — no parallel listing surfaces that own a different membership or lifecycle than the library contract.
- **Duplicate routing or open paths** — no second deep-link scheme for the same `ArtifactRef` (see anti-duplicate gate).
- **Library-defined trust-state** — stages, approval vs review, visibility, and export posture come **only** from Position **18** (P18-A canon); the library **displays** them, it does **not** invent enums or substates.
- **Office-grade authoring suite** — parity target is discovery, ownership, review queues, preview/open/reopen, and convergence of formats into **one** home (see §4 Softs), not feature parity with desktop office.
- **Changing frozen shell layouts** — list + preview must follow `docs/ui-standards/FROZEN_LAYOUTS.md` (e.g. App Table + Preview: single click = preview, double / explicit open = full); no extra toolbars between topbar and table.

### 2.3 Anti-duplicate gate (extend canon — no parallel truth)

P19-B/C implementation MUST **extend** the following existing SSOT and code — not introduce competing tables, registries, flags, or route families without a new reconciliation packet.

| Area | Canon (path) | Rule |
| --- | --- | --- |
| Artifact identity & deep links | `docs/product/ARTIFACT_LINKING_V5_SSOT.md` — `Artifact`, `ArtifactRef`, `ArtifactIndex`; `src/utils/artifactLinks.ts` — `getArtifactPath()` | One `ArtifactRef` → one primary URL shape for **open** / **reopen**; preview uses the same underlying identity. |
| Module × artifact closure | `docs/modules/MODULE_ROUTING_ARCHITECTURE.md` — canonical outputs by module | Taxonomy / “by type” aligns with this closed list; extensions go through docs + change control, not ad-hoc UI-only types. |
| Tool output vocabulary (Tools lane) | `docs/product/UNIVERSAL_TOOL_OUTPUTS_STANDARD_V1.md` | Default output types for Tools remain the declared set; library lists them; no shadow type registry. |
| Home → library bridge (queue navigation) | `src/components/MyWork/Home/homeV2Types.ts` — `outputs_all` / `outputs_mine` / `outputs_review`; `src/components/MyWork/MyWorkHub.tsx` — navigates to `/presentations?tab=...` | **Extend** this semantic bridge to full multi-format library; do not add a separate “my outputs” registry. |
| App table + preview behavior | `docs/ui-standards/FROZEN_LAYOUTS.md`; `docs/ui-standards/03-modules/app-table-standard.md` | Single click = preview, double / primary open = full; Command Row discipline preserved. |
| Trust / provenance / review | `final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_18_PROVENANCE_REVIEW_VISIBILITY_2026-03-29.md` (P18-A) | **approve(run) ≠ review(artifact)**; trust badges and audit visibility consume P18 only. |

If implementers find a near-duplicate store or route, **stop** — record in §9 and reconcile via an explicit packet, per §2.3 playbook.

### 2.4 Dependency: Position 18 (mandatory)

- **P19-A** assumes **P18-A** delivers the **trust-state canon** (vocabulary, separation of run approval vs artifact review, exposure rules).
- The Outputs Library **must not** define a competing trust model; any queue labeled **Needs review** maps to **artifact** review semantics from P18, not to “approve run” UI.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_OUTPUTS_LIBRARY_2026-03-29.md`
- Module card: `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_OUTPUTS_LIBRARY.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu definiuje benchmark jako: **artifact hubs and document libraries** (discovery/ownership/review/reopen) (`WAVE2_FINAL_IMPLEMENTATION_PLAN_OUTPUTS_LIBRARY_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Pitch (library + folders + sharing + version history)**:
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/6010928-organize-your-workspace-library.html` (Workspace Library: templates/images/videos/fonts w “one shared place” + collections).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/3678628-organize-presentations-with-folders.html` (folders/subfolders: discovery + private/shared semantics).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/4456444-share-private-folders-with-others.html` (invite-only folder sharing: bounded visibility).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/4919360-recover-an-earlier-version-of-your-slide.html` (version history: recover wcześniejszej wersji).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/9554400-view-a-pitch-deck-from-an-external-link.html` (external link viewing: share/read posture).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/4318672-collaborate-with-comments.html` (comments: feedback/review surface).
- **Gamma (folders + templates as API surface)**:
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/reference/list-folders.html` (List folders: library organization as a first-class API).
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/reference/create-from-template.html` (Create from template: generator → durable artifact).
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/docs/list-themes-and-list-folders-apis-explained.html` (pagination + listing posture).
- **KIMI (deliverable hub direction)**:
  - `Softs/KIMI/Docs/www.kimi.com/en/agent.html` (deliverables: docs/slides/sheets/reports; “artifact-first” posture).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “one canonical artifact home z kolejkami i trust-state”, nie “office authoring suite”.**

- **One shared library with taxonomy (Pitch Library + folders)**:
  - Artefakty są w jednym miejscu; foldery/collections pomagają w discovery.
  - Widoczność (private/shared) jest jawna.
- **Queue semantics: mine / needs review / type**:
  - Library daje “next action”: co wymaga review, co jest moje, co jest do wysłania/exportu.
- **Versioning + recover posture (Pitch version history)**:
  - Artefakt ma wersje i recovery posture (co było, kiedy, i jak wrócić).
- **External sharing posture (Pitch external link)**:
  - Udostępnienie jest kontrolowane i ma czytelną “view mode” semantykę.
- **Comments/review surface (Pitch comments)**:
  - Review/feedback jest widoczny jako część lifecycle artefaktu (bez mieszania z approval(run)).
- **Create-from-template → durable artifact (Gamma + KIMI)**:
  - Generacja z template kończy się trwałym artefaktem w bibliotece, nie “ephemeral output”.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE2_FINAL_IMPLEMENTATION_PLAN_OUTPUTS_LIBRARY_2026-03-29.md` + `WAVE2_GAP_BACKLOG_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Taxonomy + queues | explain “why here / what next” | “taxonomy and queue semantics thin” | Domknąć taxonomy/queues (mine/review/type) jako stabilny kontrakt | P0 |
| Ownership + review language | visible owner/reviewer | “language not explicit enough” | Ujednolicić owner/review badges i next-action cues | P0 |
| Preview/open/reopen coherence | no contradictory paths | “shell risks feeling thin” | Preview/open/reopen muszą pokazywać to samo trust-state co registry | P0 |
| Family convergence | all formats land here | “family convergence incomplete” | Upewnić się, że wszystkie deklarowane formaty mają canonical landing w library | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Wszystkie deklarowane typy artefaktów lądują i są odkrywalne; kolejki/review/owner działają; preview pokazuje trust-state; brak sprzecznych ścieżek otwierania.
- Library jest jedynym kanonicznym “home” (bez drugiego shell/registry).
- External share/export posture jest jawny i audytowalny (współgra z pozycją 18).

### 5.2 Tests
- Integracyjne: artifact materialize → appears in library → filters/queues → preview → open → reopen → export → audit.
- Regression: change owner/review state → natychmiast spójne w list + preview + open.
- Contract tests: library query payload (taxonomy/queues/trust-state) stabilny dla wielu typów artefaktów.

### 5.3 Staging proof checklist
- Demo: 4 różne typy artefaktów w bibliotece + “needs review” queue + open/reopen.
- Demo: external share / export → widoczny event w trust ledger (pozycja 18).

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Wave2 SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P19-A — Library canon (one home) + taxonomy/queues (scope approval)
- **Goal**: Outputs Library jako canonical home; taxonomy/queues/owner/review jako stabilny kontrakt.
- **Inputs required**: P18-A trust-state canon; list/preview/open coherence rules (`FROZEN_LAYOUTS` + app table standard).
- **Evidence**: scope approval + linkowane SSOT; lock P19-A released; `EXECUTION_INDEX.md` #19 = `approved(scope)`.

##### P19-A — Acceptance checklist (testable)

1. **One home**: Contract states a single canonical Outputs Library home; §2.3 lists SSOT to extend; **no** second registry / alternate “truth” for membership.
2. **Minimal queues — semantics**: **Mine** (artifacts where the current user is owner or primary author per existing model); **Needs review** (artifacts awaiting **artifact** review per P18 — not run approval); **By type / taxonomy** (filter dimension aligned with `MODULE_ROUTING_ARCHITECTURE` + declared artifact families). Each queue maps to one coherent filter contract (tabs/query params or documented equivalent).
3. **Owner vs reviewer**: UI language distinguishes **owner** (accountability) and **reviewer** (review obligation); **next-action cues** are tied to queue semantics (e.g. “needs your review” vs “your draft”).
4. **Preview vs open vs reopen**: **Single click** → preview; **double click or explicit Open** → full detail; **reopen from library** uses the same route/`getArtifactPath` identity as primary open — **no** contradictory paths for the same `ArtifactRef`.
5. **Trust-state display only**: Library surfaces read trust-state from **P18**; no new trust enum or stage model owned by P19.
6. **Approve(run) ≠ review(artifact)**: Contract and queues make the separation falsifiable; “Needs review” cannot mean “pending run approval”.
7. **Anti-duplicate**: §2.3 is filled with **concrete** repo paths; implementers extend those canons.
8. **Non-goals**: §2.2 explicitly excludes full DAM, second library, library-local trust-state, and frozen-layout violations.
9. **Home bridge alignment**: Existing `outputs_all` / `outputs_mine` / `outputs_review` navigation remains consistent with queue names above or is migrated without duplicating home (documented in P19-B if code moves).
10. **Authority chain intact**: Section 3 links remain the Wave2 SSOT for gap ledger; this file does not fork detailed plan ownership.

- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze taxonomy/queues (mine/review/type) + owner/reviewer language and next-action cues.
  - Freeze list/preview/open/reopen coherence rules (no contradictory paths).
  - Freeze dependency on trust-state schema (position 18) and “one home” invariant.
- **DoD**:
  - `approved(scope)`: library is the canonical home and contract is stable (queues/badges/coherence); P19-A acceptance checklist satisfied; index #19 updated.

#### P19-B — Multi-format convergence + preview/open/reopen closure
- **Goal**: wiele typów artefaktów na jednej prawdzie; preview/open/reopen bez sprzeczności.
- **Acceptance**: 4 typy działają; queues “needs review” i badges spójne; export/share audytowalne.
- **Evidence**: integracyjne testy + staging demo.
- **Tasks**:
  - Implement multi-format landing + discoverability for declared types (bounded).
  - Implement queues + preview/open/reopen coherence; ensure trust-state matches everywhere.
  - Add integration tests (5.2) and run staging demo (5.3) (4 types + needs review).
- **Staging proof script (click-by-click)**:
  1. Materialize or seed 4 different artifact types and verify they all appear in Outputs Library.
  2. Use filters/queues to open “needs review” and confirm owner/reviewer badges are consistent.
  3. Single-click preview an artifact; then open full view; then reopen from library — verify trust-state matches everywhere.
  4. Change review/owner state and confirm list + preview + open update coherently.
  5. Export/share (bounded) and verify provenance/export event is visible (via position 18).
- **DoD**:
  - Library behaves as one home; open/reopen never contradict preview; export/share audited (via 18).

#### P19-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P19-A/B/C.
  - Validate rollback: disable new queues/badges; preserve read-only listing.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw list/preview/open spójność, potem family convergence rozszerzenia (P1).

### 8.3 Rollback plan
- Wyłącz nowe queues/badges; zachowaj read-only listing; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: druga prawda (inne “home”).
- Ryzyko: sprzeczne zachowanie open/reopen vs preview.
- Decyzje: minimalny zestaw queues i ich semantyka “next action”.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P19-A | approved(scope) | `30c484be6b` | N/A — docs/scope only | N/A | Scope frozen: §2.2–2.4, P19-A checklist; anti-duplicate §2.3; EXECUTION_INDEX #19 updated; lock P19-A released. |
| P19-B |  |  |  |  |  |
| P19-C |  |  |  |  |  |

