# Final Implementation Contract — Outputs Library (Position 19/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

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
- Pełny office authoring suite.
- Drugi outputs shell / drugi registry.

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
- **Inputs required**: trust-state schema (pozycja 18); list/preview/open coherence rules.
- **Acceptance**: scope zatwierdzony; non-goals jawne; “no second registry” zasada spisana.
- **Evidence**: scope approval + linkowane SSOT.

#### P19-B — Multi-format convergence + preview/open/reopen closure
- **Goal**: wiele typów artefaktów na jednej prawdzie; preview/open/reopen bez sprzeczności.
- **Acceptance**: 4 typy działają; queues “needs review” i badges spójne; export/share audytowalne.
- **Evidence**: integracyjne testy + staging demo.

#### P19-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).

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
| P19-A |  |  |  |  |  |
| P19-B |  |  |  |  |  |
| P19-C |  |  |  |  |  |

