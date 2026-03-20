# Chat v8 - Implementation plan

> Status: Draft v8
> Cel: Zamienic benchmark i SSOT `Chat v8` na program wdrozeniowy z epikami, falami, zaleznosciami i planem weryfikacji.

---

## 1. Strategic intent

`Chat v8` ma zostac wdrozone jako rozwoj istniejacego modulu chat, a nie jako nowy produkt obok `consultify`.

Cel programu:
- ustawic jeden canonical shell i jeden canonical route model,
- uporzadkowac full/split chat jako jeden system,
- dopiac history/library jako pelny produkt,
- ustawic retrieval, source transparency i modes jako leader-grade system,
- dopiac AI actions, voice i artifact handoff jako przewagi `consultify`,
- zachowac maksymalny reuse istniejacego runtime.

Program nie jest greenfieldem.
Ma maksymalnie reuse'owac:
- `UnifiedChatPanel`,
- `EnhancedChatInput`,
- `ChatHistorySidebar`,
- `useConversationStore`,
- stream API,
- attachments ingest,
- action infrastructure,
- workspace context flows.

---

## 2. Program structure

Program `v8` dzielimy na 6 strumieni:
- `V8-CHAT-01 ShellAndRouting`
- `V8-CHAT-02 HistoryAndLibrary`
- `V8-CHAT-03 RetrievalModesAndSources`
- `V8-CHAT-04 ActionsGovernanceAndArtifacts`
- `V8-CHAT-05 VoiceAndMultimodal`
- `V8-CHAT-06 RolloutTruthAndAdoption`

Kazdy strumien ma scope frontend, backend, data/contracts, UX, governance i testy.

---

## 3. Fale wdrozeniowe

### Fala A - Truth alignment

Cel:
- zamknac SSOT i benchmark,
- ustalic jedna prawde runtime,
- oddzielic canonical, partial i legacy.

Deliverables:
- `CHAT_V8_SSOT.md`
- `CHAT_V8_BENCHMARK.md`
- `CHAT_V8_WORKFLOW_MODEL.md`
- `CHAT_V8_AS_IS.md`
- `CHAT_V8_GAP_MATRIX.md`
- `CHAT_V8_RUNTIME_TRUTH_MAP.md`
- `CHAT_V8_AI_GOVERNANCE.md`

Definition of done:
- nie ma sporu, czym jest kanoniczny chat produktowo i wykonawczo,
- zespal zna target parity i realne starting point.

### Fala B - Product operating model

Cel:
- doprecyzowac shell, historia, retrieval, modes, actions i response model.

Deliverables:
- control surface spec,
- history/library model,
- attachments/retrieval spec,
- modes/scope model,
- actions/approvals spec,
- response model.

Definition of done:
- istnieje jedna formula pracy zamiast zbioru niespojnych surfaces.

### Fala C - Voice and trust hardening

Cel:
- ustawic jeden voice model,
- dopiac trust, source transparency i approval semantics.

Deliverables:
- voice/multimodal spec,
- acceptance criteria for source transparency,
- action governance clarifications.

Definition of done:
- user widzi jeden coherent trust model dla sources, actions i voice.

### Fala D - Rollout and migration safety

Cel:
- wdrazac bez utrwalania dwoch shelli i bez mylenia targetu.

Deliverables:
- rollout guidance,
- migration notes for legacy shell,
- QA matrix,
- support-ready interpretation.

Definition of done:
- mozna wdrazac iteracyjnie bez zgadywania, ktora sciezka jest docelowa.

---

## 4. Epics

### V8-CHAT-01 ShellAndRouting

Zakres:
- canonical full chat shell,
- split chat contract,
- route semantics,
- header/control ownership,
- legacy shell classification.

Frontend:
- jedna canonical surface dla full chat,
- jasny relation model full vs split,
- visibility rules for chat-level controls.

Backend:
- brak nowego backendu jako warunku,
- tylko alignment z route/store/runtime meaning.

Data/contracts:
- conversation route sync,
- display mode semantics,
- workspace context contract.

Migration/rollout:
- nie psuc deep links,
- zachowac compatibility z obecna route struktura,
- zdegradowac `AIChatWelcomeView` do roli transitional/legacy.

Test scope:
- route behavior,
- full vs split continuity,
- active conversation continuity,
- shell-level control visibility.

Priority:
- P0

### V8-CHAT-02 HistoryAndLibrary

Zakres:
- conversation lifecycle,
- folders personal/team,
- search,
- pinned/archive semantics,
- revisit model.

Frontend:
- history panel,
- folder drill-in,
- search behavior,
- conversation actions.

Backend:
- list/query semantics,
- folder CRUD and move behavior,
- pagination/search expectations.

Data/contracts:
- `chat folder` vs `PMO project`,
- titleSource,
- archive/star/move invariants.

Migration/rollout:
- nie gubic conversation membership,
- zachowac existing folders and routes,
- poprawic naming without breaking runtime.

Test scope:
- create/select/rename/archive/delete,
- move to folder / remove from folder,
- personal vs team folders,
- search and revisit flows.

Priority:
- P0

### V8-CHAT-03 RetrievalModesAndSources

Zakres:
- local files,
- URL ingest,
- cloud source honesty,
- focus/scope model,
- deep research and source transparency.

Frontend:
- add files menu,
- mode toggles,
- scope visibility,
- sourced answer expectations.

Backend:
- ingest endpoints,
- stream context contract,
- research confirm contract,
- source-aware retrieval behavior.

Data/contracts:
- attachment context,
- source classes,
- citation expectations,
- partial vs guaranteed semantics.

Migration/rollout:
- nie obiecywac more than runtime,
- improve parity between shells.

Test scope:
- file ingest,
- URL ingest,
- grounded answer,
- deep research gate,
- mode combinations.

Priority:
- P0

### V8-CHAT-04 ActionsGovernanceAndArtifacts

Zakres:
- pending actions,
- approve/reject/execute semantics,
- message actions,
- save-to-artifact flows,
- feedback contract.

Frontend:
- pending action indicator,
- proposal state visibility,
- response action surfaces,
- save flows.

Backend:
- action APIs,
- executor semantics,
- audit lifecycle,
- feedback endpoint behavior.

Data/contracts:
- action state model,
- audit references,
- feedback payload semantics.

Migration/rollout:
- wycofac fake or partial semantics z canonical docs,
- utrzymac tylko honest capabilities.

Test scope:
- approve/reject behavior,
- execute semantics,
- save-to-artifact paths,
- feedback submission.

Priority:
- P0

### V8-CHAT-05 VoiceAndMultimodal

Zakres:
- dictation,
- voice conversation,
- TTS/auto-read,
- STT/TTS provider semantics,
- user-facing states and fallbacks.

Frontend:
- visible voice controls,
- state communication,
- interruption/stop UX.

Backend:
- `/api/voice/stt`
- `/api/voice/tts`
- `/api/voice/health`

Data/contracts:
- voice mode semantics,
- privacy expectations,
- browser vs server behavior.

Migration/rollout:
- nie dokumentowac hidden-only flows jako mature.

Test scope:
- dictation works,
- server STT works,
- TTS works or degrades cleanly,
- health reporting is accurate.

Priority:
- P1

### V8-CHAT-06 RolloutTruthAndAdoption

Zakres:
- rollout notes,
- support interpretation,
- docs linking,
- evaluation and adoption metrics.

Frontend:
- none primary

Backend:
- none primary

Data/contracts:
- classification matrix `canonical | partial | legacy | not supported`

Migration/rollout:
- old docs become background references,
- new docs become SSOT.

Test scope:
- QA checklist completeness,
- support-readiness review.

Priority:
- P1

---

## 5. Execution order

1. Freeze runtime truth and canonical vocabulary.
2. Ship history/library model and shell/routing model.
3. Ship retrieval/scope/source contracts.
4. Ship actions/governance/feedback contracts.
5. Ship voice and multimodal contract.
6. Cross-link, rollout-tag and harden acceptance criteria.

Detailed spec map used by this plan:
- `CHAT_V8_CONTROL_SURFACE_SPEC.md`
- `CHAT_V8_HISTORY_AND_LIBRARY_MODEL.md`
- `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`
- `CHAT_V8_MODES_AND_SCOPE_MODEL.md`
- `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `CHAT_V8_VOICE_AND_MULTIMODAL.md`
- `CHAT_V8_RESPONSE_MODEL.md`

Legacy/background references only:
- `docs/UNIFIED_AI_CHAT_SYSTEM.md`
- `docs/AI_CHAT_SYSTEM_DESIGN.md`
- `docs/AI_CHAT_DATA_MODEL.md`
- `docs/api/AI_CHAT_API.md`
- `docs/flows/core/AI_CHAT_ASSISTANCE_FLOW.md`
- `docs/product/modules/ai/AI_CHAT_CONTROL_AUDIT_2026-03-07.md`

---

## 6. Verification plan

### 6.1 Product verification

- one shell rule is explicit,
- full and split workflow are coherent,
- history semantics are complete and non-contradictory,
- source and scope semantics are understandable,
- action approval semantics are unambiguous,
- voice is one coherent user-facing story.

### 6.2 Runtime verification

- docs align with real routes and handlers,
- attachments and URL ingest match real endpoints,
- feedback and action APIs reflect real behavior,
- no placeholder path is documented as complete.

### 6.3 Benchmark verification

- core chat feels as clear as `ChatGPT`,
- history feels closer to `Claude`,
- research/source semantics feel closer to `Perplexity`,
- workspace/action layer remains uniquely `Consultify`.

---

## 7. Risks

- documenting aspirational behavior instead of actual runtime truth,
- preserving dual-shell ambiguity,
- under-specifying scope and source semantics,
- over-stating cloud and voice maturity,
- failing to distinguish approval from execution in AI actions.

---

## 8. Acceptance matrix

| Epic | Acceptance condition |
|---|---|
| ShellAndRouting | One canonical shell and route model is clearly defined |
| HistoryAndLibrary | Full conversation lifecycle and folder model are explicit |
| RetrievalModesAndSources | Attachment, research and source transparency contracts are explicit |
| ActionsGovernanceAndArtifacts | Proposal, approval, execution and artifact handoff are explicit |
| VoiceAndMultimodal | One coherent voice contract exists |
| RolloutTruthAndAdoption | New package can serve as the only required SSOT for future work |
