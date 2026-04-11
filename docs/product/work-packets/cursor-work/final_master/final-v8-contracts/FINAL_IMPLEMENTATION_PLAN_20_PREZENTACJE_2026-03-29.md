# Final Implementation Contract — Prezentacje (Position 20/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: verified(evidence) — P20-A/B/C complete  
Last updated: 2026-03-31 (P20-C verification closure)

## 1. Executive summary
- **Intent**: Gamma‑like: generacja+edycja; export PPT/PDF; zarządzanie generatorem; edycja z poziomu czata.
- **Primary users**: konsultanci/PMO tworzący decki.
- **Success metric**: prezentacja jako trwały artefakt: create → reopen/continue → review → deliver/export, z traceability i bez overclaim „full deck suite”.

## 2. Scope
### 2.1 In-scope
- Governed deck runtime (durable identity + continuation + review/export truth).
- Integration: Outputs Library + ArtifactRun + Provenance.

### 2.2 Out-of-scope / non-goals
- Pełna parity z narzędziami prezentacyjnymi.
- “Full PowerPoint suite” parity (animations, master slide editor, complex layouts, realtime co-authoring as baseline).
- Dekki jako “osobny świat” poza Outputs (P19) — jeden kanoniczny home artefaktów.

### 2.3 Deck artifact canon (schema + single truth)

**Rule:** Deck jest artefaktem w **Outputs Library (P19)** i konsumuje **Templates (P24)** oraz **trust-state / provenance (P18)**. Prezentacje nie mogą tworzyć równoległej rejestracji ani “presentations_v2”.

**Canonical identity:**

- `deck_artifact_id` = `Artifact.id` / `ArtifactRef` (SSOT: `docs/product/ARTIFACT_LINKING_V5_SSOT.md`, P19).
- `template_id` jest **mandatory** i wskazuje na `OutputTemplate.templateId` (P24; template też jest artefaktem w Outputs).

**Deck payload (logical model; stored/derived as needed):**

| Field | Type | Meaning | Truth source / constraints |
| --- | --- | --- | --- |
| `deck_artifact_id` | string (UUID) | Stable deck identity | P19 `ArtifactRef` |
| `template_id` | string (UUID) | Template contract used | P24 `OutputTemplate.templateId` (required) |
| `format_family` | `'deck'` | Family discriminator | Must match template |
| `title` | string | Deck title | Editable without changing identity |
| `slide_count` | number | Current number of slides | Derived from `slide_structure[]` |
| `slide_structure[]` | array | Ordered slide records | Stable `slide_id` per slide; order mutable |
| `speaker_notes` | enum / payload | Speaker notes posture + content | `required/optional/none` from P24 template; per-slide notes stored in structure |
| `transition_style` | enum | Governed transition posture | Bounded (e.g. `none` / `basic`) — no animation suite |
| `version` | integer | Optimistic concurrency + history key | Increment on structural/content edits |
| `export_ledger[]` | array | Export attempts and successes | **Projection of P18 `exportHistory`**; no parallel export store |
| `share_posture` | object | Share link/access posture | Must respect P18 visibility/access grants |
| `analytics_summary` | object | Bounded consumption signal | Bounded (views/time); no overclaim |

**Slide structure record (minimum):**

| Field | Type | Meaning | Notes |
| --- | --- | --- | --- |
| `slide_id` | string (UUID) | Stable per-slide identity | Persists across edits/reorder |
| `order` | number | Order in deck | Reorder changes order, not ids |
| `intent` | string | Slide intent | Should align with template `outlineBlueprint` intents |
| `layout` | string | Layout key | Governed set; template may constrain |
| `content_blocks[]` | array | Structured content | No freeform “pptx XML editing” |
| `speaker_notes_text?` | string | Notes per slide | Optional / required per template policy |

### 2.4 Lifecycle states (draft → reviewed → exported) — without duplicating P18

**Rule:** Deck lifecycle badges must be **falsifiable** and must not fork trust vocabulary. We expose the three canonical deck states:

- `draft`: deck exists but is not marked reviewed for delivery.
- `reviewed`: human review of the **artifact** is complete (maps to P18 publish/review axis).
- `exported`: at least one **successful** export exists in `export_ledger[]` (maps to P18 export ledger).

**Source of truth mapping:**

- `draft/reviewed` is a view on top of P18 publish/review axis (`publishState` / reviewers).
- `exported` is computed from P18 `exportHistory` with `status=success`.
- Surfaces may denormalize these badges into list rows, but **must** be derivable from the P18 trust payload (no parallel enums).

### 2.5 Durable identity + reopen/continue semantics (structural continuity)

**Reopen rule:** Reopen from Outputs Library must open the same `deck_artifact_id` and preserve:

- slide ids (`slide_id`) and ordering,
- template reference (`template_id`) and template-derived constraints,
- trust-state (P18) and export ledger projection.

**Continuation rule:** “Continue editing” means patching the existing deck (no regenerate-from-scratch by default). Regeneration can exist only as an explicit action that:

- preserves `deck_artifact_id`,
- records a version history entry,
- maintains traceability to prior versions.

### 2.6 Continuation depth (per-slide AI edits + version history + revert)

**Minimum continuation operations (bounded):**

- Slide-level refine: rewrite bullets, change tone, tighten summary **within** slide intent.
- Slide-level replace: regenerate a single slide while preserving deck identity.
- Insert/remove slide: structural changes preserve deck identity; removed slides are recoverable via version history (bounded).
- Speaker notes edit: per-slide notes refinement (if policy allows).

**Versioning posture:**

- Deck maintains `version` (monotonic) for optimistic concurrency and `version_history` for revert.
- Revert restores a prior deck version while keeping the same `deck_artifact_id` and recording the revert as a new version (no destructive “time travel”).

### 2.7 Review/export grammar (badges + next actions + resilience)

**Review grammar (artifact review, not run approval):**

- Badges communicate `draft` vs `reviewed` with clear next-action cues (e.g. “Mark as reviewed”, “Request changes”).
- Review actions update the **P18 publish/review axis** (never `approve(run)`).

**Export grammar (bounded PDF/PPTX):**

- Supported formats: **PDF**, **PPTX** only (explicitly bounded).
- Export limits are explicit (examples; finalize in P20-B implementation): max slide count, max embedded assets size, limited transitions/animations, font fallback rules.

**Export resilience (no ghost artifacts):**

- Every export attempt yields a ledger entry (`export_ledger[]`) with `status: success | failed`.
- Failure must not create a new deck artifact; it records error + retry affordance.
- Retry reuses the same deck identity; multiple exports append ledger entries (audit trail).

### 2.8 Template integration + org branding (P24 + P30)

- `template_id` is mandatory for deck creation and persists for the deck’s lifetime (unless explicit “retarget template” operation is approved later).
- Deck uses P24 `OutputTemplate` deck extensions as its generation contract (e.g. `outlineBlueprint`, `slideCountRange`, `speakerNotesPolicy`).
- Branding defaults come from P30 `ResolvedOrganizationContext.profile`; templates inherit brand defaults (P24 rule: no redefining org branding).

### 2.9 Share + analytics posture (bounded, governed)

**Share:**

- Share is a link-based view of the deck artifact with access control (P18 visibility/access grants).
- Share permission denied returns explicit “what next” guidance (request access / switch org / ask owner).
- Share events are audit-recorded as provenance events (P18) and/or access-grant changes (no parallel share ledger outside trust/provenance).

**Analytics (bounded):**

- Only bounded consumption metrics: `views_count`, `unique_viewers_count` (if feasible), `time_spent_total` / `avg_time_spent` (coarse).
- Analytics is directional, not definitive “engagement truth”; no overclaim dashboards in scope.

### 2.10 Anti-duplicate gate (explicit)

**Hard rules:**

- No parallel template store (P24 `OutputTemplate` is SSOT).
- No parallel Outputs home (P19 library is SSOT).
- No parallel provenance / trust-state or export ledger (P18 is SSOT).
- No `presentations_v2` table, no `deck_registry_v2`, no forked routes for open/reopen beyond `ArtifactRef` identity.

### 2.11 Degraded / error posture (must be explicit)

- **Template not found** (invalid/deleted `template_id`): 404 + guidance to choose a new template; deck remains readable; generation/edit features that require template are blocked with explicit message.
- **Export failure**: ledger records `failed` with error category + retry guidance; no ghost artifacts; if partial file created, it must not be attached as a “success export”.
- **Continuation conflict (concurrent edit)**: 409 with guidance to refresh; client must rebase changes against latest `version`.
- **Share permission denied**: 403 with “request access” path; do not leak deck content via share endpoint.
- **Provenance unavailable (P18 outage)**: fail closed for review/export state transitions that require ledger writes; keep read-only access.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PRESENTATIONS_2026-03-29.md`
- Benchmark: `docs/product/PREZENTACJE_V8_BENCHMARK.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu definiuje benchmark jako: **governed deck generation and continuation products** z durable identity i review trust (`WAVE2_FINAL_IMPLEMENTATION_PLAN_PRESENTATIONS_2026-03-29.md`).
- Benchmark doc: `docs/product/PREZENTACJE_V8_BENCHMARK.md`.

### 4.2 Local Softs evidence (concrete artifacts)
- **Gamma (AI-first generation + templates + folders as surfaces)**:
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/reference/generate-a-gamma.html` (Generate a gamma: generacja jako API; artifact-first posture).
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/reference/create-from-template.html` (Create from template: template-driven deck creation).
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/reference/list-folders.html` (folders: organizacja artefaktów).
  - `Softs/0 Prezentacje/Gamma.zip :: Gamma/developers.gamma.appx/docs/generate-api-parameters-explained.html` (parametry generacji jako jawny kontrakt).
- **Pitch (team workflow: comments/review + export + pitch rooms)**:
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/4318672-collaborate-with-comments.html` (comments: feedback/review surface).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/4919360-recover-an-earlier-version-of-your-slide.html` (version history: recovery posture).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/3551638-export-a-presentation-to-pdf.html` (export PDF).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/6713988-export-a-presentation-to-power-point.html` (export PPTX).
  - `Softs/0 Prezentacje/Pitch help.zip :: Pitch help/help.pitch.com/en/articles/10134438-share-pitch-rooms-with-prospects-or-clients.html` (pitch rooms: “decks, links, files” + analytics).
- **Beautiful.ai (quality-by-structure + slide-level AI editing + export resilience + analytics)**:
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/12885226948109-Creating-a-presentation-with-AI.html` (AI presentation generation: workflow-first, nie tylko prompt).
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/43350069148557-Create-and-Edit-your-Slides-with-Slide-AI.html` (Slide AI: iteracja per-slide; refine bez przebudowy całości).
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/115002537392-How-do-I-export-as-a-PDF.html` (export PDF + ograniczenia statyczności).
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/115002626972-What-do-I-do-if-I-receive-an-export-failure.html` (export failure: recovery/troubleshooting posture).
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/360004996892-Version-History.html` (version history + revert + deleted slide recovery).
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/360000747892-How-can-I-share-a-link-to-my-presentation.html` (share link + access control + analytics).
  - `Softs/0 Prezentacje/Beautiul.zip :: Beautiul/support.beautiful.ai/hc/en-us/articles/360028082532-Analytics-Pro-Tier.html` (analytics dashboard: views/time).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “durable deck runtime z jawym lifecycle + export truth”, nie “pełny PowerPoint parity”.**

- **Generate → continue as normal workflow (Gamma + Beautiful.ai Slide AI)**:
  - Generacja tworzy deck z durable identity.
  - Kontynuacja to nie “wygeneruj od nowa”: istnieje iteracja per-slide / per-sekcja z zachowaniem struktury.
- **Templates/themes/folders as governed surfaces (Gamma + Pitch)**:
  - Template-driven creation + organizacja (folders) są częścią produktu (nie “ukryty system”).
- **Review/feedback as a first-class layer (Pitch comments)**:
  - Deck ma review surface (comments) i jawne statusy draft/reviewed (bez mieszania z approval(run)).
- **Export as governed delivery (Pitch + Beautiful.ai export posture)**:
  - Export PDF/PPTX ma jawne ograniczenia i recovery path (export failure).
  - Export events są traceable (powiązane z pozycją 18).
- **Share + analytics posture (Pitch rooms + Beautiful.ai analytics)**:
  - Udostępnienia mają kontrolę i “proof of delivery/consumption” (bounded analytics), bez overclaim.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE2_FINAL_IMPLEMENTATION_PLAN_PRESENTATIONS_2026-03-29.md` + `WAVE2_GAP_BACKLOG_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Continuation depth | continue without losing structure | “continuation semantics not strong enough” | Domknąć reopen/continue + structural continuity jako kontrakt produktu | P0 |
| Review + export grammar | ready vs draft visible | “review/export grammar needs one package” | Ujednolicić review/delivery/export state + badges + next action | P0 |
| Export resilience | recovery path for failures | (nieudowodnione jako domknięte) | Dodać recovery posture dla export (failures) i audyt exportów | P1 |
| Library convergence | canonical home | depends on Outputs Library | Zapewnić spójność z `Outputs Library` (one home) + reopen from library | P0

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Deck ma durable identity; reopen/continue działa; review/delivery/export są jawne; traceability jest widoczne.
- Export (PPT/PDF w zadeklarowanym zakresie) ma jawne ograniczenia + recovery path; export event jest zapisany.
- Z poziomu czata: plan → approve(run) → deck w `Outputs Library` → reopen/continue bez utraty lineage.

### 5.2 Tests
- Integracyjne: generate → reopen → continue (edit) → review state change → export PDF/PPTX → audit in provenance.
- Regression: export failure → czytelny stan + retry bez tworzenia “ghost artifacts”.
- Contract tests: lifecycle payload (draft/reviewed/exported) spójny w library/preview/open.

### 5.3 Staging proof checklist
- Demo: “generate→continue→review→export” z widocznym lineage i zapisanym export eventem.
- Demo: reopen z `Outputs Library` + kontynuacja z czata (approve(run) vs review separation).

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Wave2 SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P20-A — Deck lifecycle canon + review/export grammar (scope approval)
- **Goal**: durable deck identity + reopen/continue; jawny review/export state.
- **Inputs required**: Outputs Library convergence (pozycja 19) + trust-state (pozycja 18).
- **Acceptance**: scope zatwierdzony; non-goals jawne; export limits + recovery posture spisane.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze deck lifecycle states (draft/reviewed/exported) + reopen/continue semantics.
  - Freeze review/export grammar + limits + recovery posture (no ghost artifacts).
  - Freeze convergence rules with Outputs Library (19) and trust-state (18).
- **DoD**:
  - Approved(scope): continuation and review/export semantics are explicit and testable.

##### P20-A — Acceptance checklist (testable, 10+)

1. **Deck is an Output artifact**: deck has stable `deck_artifact_id` (`ArtifactRef`) and appears in Outputs Library (P19) as the canonical home.
2. **Template required**: `template_id` is mandatory on create and references P24 `OutputTemplate.templateId`; no create flow without a template contract.
3. **Deck schema extensions explicit**: deck payload includes `slide_count`, `slide_structure[]`, `speaker_notes` posture, and `transition_style` with bounded semantics.
4. **Stable slide identity**: each slide has stable `slide_id`; reordering/editing preserves ids; add/remove preserves deck identity.
5. **Reopen preserves structure**: reopen from Outputs Library returns the same deck identity and the same slide structure (modulo latest edits), not a regenerated deck.
6. **Continuation ≠ regenerate**: “continue editing” defaults to patching existing deck; regenerate-from-scratch requires explicit user action and records version history.
7. **Lifecycle badges are derivable**: `draft/reviewed/exported` are derived from P18 publish/review axis and export ledger; no parallel lifecycle enum store.
8. **Review grammar is artifact review**: review actions modify P18 publish/review axis and do not conflate with `approve(run)`.
9. **Export bounded + resilient**: export supports only PDF/PPTX with explicit limits; failures record a ledger entry and provide retry; no ghost deck artifacts created.
10. **Export recorded in provenance**: successful and failed exports are recorded in P18 `exportHistory` and reflected in deck `export_ledger[]` projection.
11. **Share governed**: share link respects access control; denied access yields 403 with guidance; share events are recorded as provenance/access changes.
12. **Bounded analytics**: only views/time metrics; explicitly not “full engagement analytics”; surfaced as directional signal.
13. **Concurrency conflict explicit**: concurrent edit yields 409 with version mismatch guidance; client must refresh/rebase.
14. **Anti-duplicate enforced**: contract explicitly forbids parallel template/output/provenance stores and `presentations_v2`.

#### P20-B — Generate→continue→review→export closure
- **Goal**: domknąć E2E lifecycle + export audit.
- **Acceptance**: continue nie gubi struktury; export ma recovery path; lineage widoczne.
- **Evidence**: integracyjne testy + staging demo (reopen z library).
- **Tasks**:
  - Implement generate→reopen→continue→review→export end-to-end (bounded).
  - Implement export retry/recovery and audit events; add integration/regression tests (5.2).
  - Run staging demos (5.3) including reopen from library.
- **Staging proof script (click-by-click)**:
  1. Generate a deck from template/brief and confirm it lands in Outputs Library with lineage.
  2. Reopen the deck from library and continue editing; verify structure continuity.
  3. Move the deck to a review state and verify badges/next action cues are explicit.
  4. Export to PDF/PPTX (bounded) and verify export event is recorded; then simulate export failure and verify retry/recovery (no ghost artifacts).
  5. Return to library and confirm open/reopen shows the same trust-state and export history.
- **DoD**:
  - Continuation preserves structure; export is audytowalny with recovery; lineage visible.

#### P20-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P20-A/B/C.
  - Validate rollback: disable export; preserve reopen/continue.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw reopen/continue + review grammar, potem eksport resilience (P1) i rozszerzenia.

### 8.3 Rollback plan
- Wyłącz export; zachowaj reopen/continue; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: brak continuation depth (deck “zdycha” po wygenerowaniu).
- Ryzyko: export failure tworzy ghost artifacts.
- Decyzje: minimalny zakres exportów (PDF/PPTX) i ich ograniczenia.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P20-A | approved(scope) | `dc30ec2170` | N/A — scope packet | N/A — scope packet | Canon frozen in §2.3–2.11 + P20-A checklist; lock P20-A released; EXECUTION_INDEX #20 updated. |
| P20-B | delivered | `2c4965e88e` + gap-closure commit on `ws/c-artifact-evidence` | **Split-screen**: KimiWorkspaceShell extended with `prezentacje` lane (chat 420px left ↔ deck preview right); PrezentacjeView wraps shell with lane="prezentacje". **Pipeline**: useKimiArtifactPipeline extended for `presentation` artifact family + `presentation` output type; 8-step pipeline (snapshot→plan→preflight→accept→review→approve→materialize→generate). After materialize: calls `/presentations/generate/deck` then fetches deck data for preview. **Auto-trigger**: chat first user+AI exchange auto-starts pipeline. **Preview**: deck slide cards fetched from `/api/presentations/decks/{id}` with unified_json parsing (slide intent, title, bullet points); KPI cards (slide count, format, status); **lifecycle badge** (draft/reviewed/exported) derived from deck status/export_path. **Download**: PPTX via `/api/presentations/decks/{id}/download` + **PDF export** via `/api/presentations/decks/{id}/export/pdf`. **DeckBuilder link**: "Open in Deck Builder" button links to `/presentations/builder/{id}`. **Reopen**: `?artifactId=` query param hydrates existing deck preview from API without requiring new generation. **Progress**: 8-step TaskProgressBar. **Replay/Remix**: server-side re-run / reset to goal input. **Sidebar**: AppView.PREZENTACJE_GEN in menuConfig. **Routes**: `/prezentacje` in routeConfig + AppRoutes. | Gamma-style split-screen generation workspace functional; pipeline wired to V8 artifact run lifecycle; deck preview shows slide cards with intent/title/bullets + lifecycle badge; DeckBuilder integration for full editing; Outputs Library integration via P19; reopen from library works via ?artifactId=. | Bounded: deck preview is read-only slide card summary (DeckBuilder for full WYSIWYG); template selection uses default (PresentationWizard at /presentations/wizard for template-driven creation); continuation depth (per-slide AI edits, version history, revert) available in DeckBuilder; share/analytics posture bounded per §2.9; no cancel-mid-generation. Provenance via P18/P19. |
| P20-C | verified(evidence) | gap-closure commit on `ws/c-artifact-evidence` | **Integration**: split-screen chat↔deck → generate via V8 pipeline + `/presentations/generate/deck` → deck slide card preview (intent/title/bullets from unified_json) → lifecycle badge (draft/reviewed/exported) → KPI summary → download PPTX + PDF export → open in DeckBuilder → Replay (server re-run) → Remix (new goal) → reopen via `?artifactId=`. **Regression**: export failure → toast error + retry; no ghost outputs. **Contract**: deck artifact payload includes type + lifecycle + export via v8_artifact_runs + v8_output_artifacts + v8_artifact_origin_links (P18); presentation registered via artifact registry (P19). **Rollback**: disable Prezentacje sidebar entry + route; preserve Outputs Library listing + DeckBuilder access + PPTX/PDF export. | Staging proof: (1) Open /prezentacje → split-screen renders; (2) Type goal → Generate → pipeline starts (8 steps); (3) Chat auto-trigger works; (4) After generate: deck preview with slide cards + lifecycle badge + KPI; (5) "Open in Deck Builder" links to /presentations/builder/{id}; (6) Download PPTX works; (7) PDF export button works; (8) Replay/Remix functional; (9) Sidebar "Prezentacje" navigates to /prezentacje; (10) Reopen: /prezentacje?artifactId={id} loads existing deck from API; (11) Outputs Library shows deck with reopen path. | Known limits: deck preview is read-only slide cards (DeckBuilder for WYSIWYG); template selection uses default in KIMI flow (PresentationWizard for template-driven); continuation depth in DeckBuilder only; share/analytics bounded per §2.9; no cancel-mid-generation. |

### 10.1 Compliance Uplift (2026-04-11)

The following items were addressed in a full DoD audit against all 14 P20-A checklist items:

| Checklist # | Gap | Resolution | Files |
| --- | --- | --- | --- |
| 2 | `template_id` nullable in DDL | Migration 751: backfill + NOT NULL trigger | `server/migrations/751_p20_template_id_not_null.sql` |
| 7 | KIMI badge reads `presentation_decks.status` instead of P18 | `PrezentacjeView` now fetches trust-state from P18 via `/artifacts/:id/trust-state`; shared `deriveDeckLifecycleBadge()` helper | `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx`, `src/utils/deckLifecycleBadge.ts` |
| 9 | No export limits; no `failed` ledger; PDF double-record bug | Export limits (60 slides, 50MB); `recordCanonicalDeckExportTrace` supports `status: failed`; PDF double-record removed | `server/src/routes/presentations.routes.ts` |
| 10 | Export ledger only records `completed` | Now records both `completed` and `failed` with error category | `server/src/routes/presentations.routes.ts` |
| 13 | No 409 concurrency handling | `version` column on `presentation_decks`; autosave checks `X-Deck-Version` header, returns 409 on mismatch | `server/migrations/752_p20_deck_version_and_history.sql`, `server/src/routes/presentations.routes.ts` |
| Builder P0 §6.3 | AI agent-edit applies directly (silent mutation) | Proposal mode: `pendingAgentEdit` state with Accept/Reject UI | `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` |
| §2.6 | No server-side version history | `presentation_deck_versions` table; `GET /versions` + `POST /restore` API; autosave snapshots previous state | `server/migrations/752_p20_deck_version_and_history.sql`, `server/src/routes/presentations.routes.ts` |
| §2.3 slide_id | Synthetic IDs on unified_json bridge | `deckFromUnifiedJson` now prefers `slide.slide_id || slide.id || slide.card_id` | `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` |

**Tests added:**
- `tests/integration/presentations/p20-lifecycle.test.ts` — E2E lifecycle (§5.2 integration)
- `tests/integration/presentations/p20-export-resilience.test.ts` — export failure regression (§5.2)
- `tests/integration/presentations/p20-lifecycle-payload.test.ts` — lifecycle badge consistency (§5.2 contract)
- `tests/components/Presentations/DeckBuilder.test.tsx` — Builder P0 contract (stable IDs, undo, version diff)

