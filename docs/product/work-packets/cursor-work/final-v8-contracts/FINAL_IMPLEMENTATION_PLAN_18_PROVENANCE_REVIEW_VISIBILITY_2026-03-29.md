# Final Implementation Contract — Provenance / review / visibility (Position 18/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: `approved(scope)` for **P18-A** (trust-state canon frozen); **P18-B** `delivered`; **P18-C** `verified(evidence)`  
Last updated: 2026-03-31 (P18-C closeout)

## 1. Executive summary
- **Intent**: Pełne traceability myśli i kontekstu (trust grammar artefaktów).
- **Primary users**: konsumenci artefaktów, reviewerzy, operatorzy.
- **Success metric**: każdy artefakt odpowiada: skąd, jaki run, jaki stage, kto widzi, kto review’uje, co exportowano — spójnie na wszystkich powierzchniach.

## 2. Scope
### 2.1 In-scope
- Trust grammar: source/run/version lineage; review + validation; visibility + access; export trace.
- Konsystencja sygnałów w `Outputs Library` i preview/open.

### 2.2 Out-of-scope / non-goals

- **Global IAM / permissions redesign** — trust-state describes *exposure truth* for artifacts, not a new org-wide RBAC product.
- **Merging approve(run) with review(artifact)** — forbidden; see §2.5.
- **Second trust-state API or shadow “trust v2” JSON** — extend `GET /api/artifacts/:id/trust-state` and registry-derived fields; no parallel endpoint family for the same artifact without a reconciliation packet.
- **Surfaces inventing their own stage enums** — UI may only map **bounded** stage language in §2.4; new literals require contract/version bump (P18-A change control).
- **Frozen layout changes** — badges live inside existing shells (library preview, artifact shell); no new bars from `FROZEN_LAYOUTS.md`.

### 2.3 Trust-state canon — minimum payload (P18-A freeze)

**Conceptual pillars (product language)** — every governed artifact must be describable along these five dimensions (implementation may bundle fields):

| Pillar | Meaning (canonical) | Primary implementation shape today (extend, don’t fork) |
| --- | --- | --- |
| **source** | Where meaning came from (human/AI/initiative/chat/context), evidence pointers | `sourceRefs`, `originLinks`, `originSummary` on trust payload + registry row |
| **run_id** | Governing execution / plan-run identifier when artifact is run-mediated | `executionRunId`, `executionState`, `contextSnapshotId` |
| **stage** | Lifecycle: validation gate, publish/review gate, readiness — **distinct axes** | `validationState` + `validationChecks`; `publishState` + `reviewGateCount` / `reviewers`; `executionState` for run spine |
| **visibility** | Who may see / collaborate / review-share | `visibilityScope`, `accessGrants`, `canManageAccess`, `manageAccessPath`, `projectId` |
| **export_ledger** | what was exported, by whom, outcome | `exportHistory` (list of export traces); `exportPath` as current *capability* hint, not a substitute for ledger |

**Authoritative read model (single home):** `GET /api/artifacts/:id/trust-state` returns the trust bundle; list surfaces consume registry rows **plus** the same trust fields where denormalized. Library preview may refresh trust-state client-side but **must not** define competing semantics.

### 2.4 Stage language + UI badges (bounded)

**Axes (do not collapse):**

- **Execution spine** — `executionState` (from `execution_spine` / run): e.g. pending / running / completed / failed — shown only as **run** posture, never labeled “artifact review complete”.
- **Validation** — `validationState` + `validationChecks`: preconditions before promotion/review; badges: validated / pending / attention_required.
- **Publish / artifact review** — `publishState`, `reviewGateCount`, `reviewers`: human governance of the artifact; badges map to **review** vocabulary, not run approval.

**UI mapping rule:** badges in Outputs Library preview and artifact shells map **at most one** badge per axis per row region, or a compact multi-chip layout documented in Wave2 plan — no surface may swap execution badges for publish badges.

**Authority labels (frozen strings on payload):** `reviewAuthority: 'artifact_review'`, `executionAuthority: 'execution_spine'` — surfaces display both where relevant; they are not interchangeable.

### 2.5 Invariant: **approve(run) ≠ review(artifact)**

- **approve(run)** — user/system action that allows an **execution run** to proceed or complete (spine, tool/agent run); reflected in `executionState` and related run APIs.
- **review(artifact)** — human governance of **artifact publish quality / visibility transitions**; reflected in `publishState`, reviewers, and `/api/artifacts/:id/start-review` (and successors).
- **Hard rule:** UI copy, API naming, and tests must **never** use “approved” for both in the same breath without disambiguation; P18-B contract tests must include a regression that toggling one axis does not silently imply the other.

### 2.6 Anti-duplicate gate (extend — no v2 beside v1)

| Area | Canon (path) | Rule |
| --- | --- | --- |
| HTTP trust read | `server/src/routes/artifacts.routes.ts` — `buildArtifactTrustPayload`, `GET /:id/trust-state` | Extend payload fields here + `artifactRegistryService`; no second trust JSON route for the same `artifactId`. |
| Registry + validation snapshot | `server/src/services/v8/artifactRegistryService.ts` — `deriveArtifactValidationSnapshot` and list row mapping | Single derivation for validation state; consumers import this truth. |
| Export history | `server/src/services/v8/reportsPresModelService.ts` — `getExportHistory` (as used by trust payload) | **export_ledger** back end; extend tables/services, don’t add a shadow “export audit v2”. |
| Client governance summary | `src/components/ReportsAndPresentations/types.ts` — `ArtifactGovernanceSummary` | Align new fields with trust-state response; one TS shape for preview + tables. |
| Outputs Library preview | `src/components/ReportsAndPresentations/OutputsAggregateTabContent.tsx` — fetch `.../trust-state` | Merge into preview **only** from this API; no alternate trust URL per artifact type in P18-B without packet. |
| Artifact identity SSOT | `docs/product/ARTIFACT_LINKING_V5_SSOT.md`; `src/utils/artifactLinks.ts` | Deep links and `ArtifactRef` stay canonical; trust layers attach to identity, don’t fork routes. |
| Contract tests | `tests/integration/routes/artifacts.routes.test.ts` — `trust-state` expectations | Extend assertions here for schema stability; no duplicate schema spec in ad-hoc fixtures. |

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PROVENANCE_REVIEW_VISIBILITY_2026-03-29.md`
- Module card: `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_PROVENANCE_REVIEW_VISIBILITY.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu definiuje benchmark jako: **enterprise lineage, review, and visibility systems** (audytowalna prawda artefaktów) (`WAVE2_FINAL_IMPLEMENTATION_PLAN_PROVENANCE_REVIEW_VISIBILITY_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Claude (citations as verifiable evidence pointers)**:
  - `Softs/0 Czat/Cloude doc.zip :: Cloude doc/platform.claude.com/cookbook/misc-using-citations.html` (citations: answer→źródła; affordance do weryfikacji).
- **LangSmith (traces/observability as an audit surface)**:
  - `Softs/0 Agenci/Longchain dev.zip :: Longchain dev/docs.langchain.com/langsmith/share-trace.html` (share trace: trace jako artefakt do wglądu).
  - `Softs/0 Agenci/Longchain dev.zip :: Longchain dev/docs.langchain.com/langsmith/observability.html` (observability: śledzenie runów i zachowania agentów).
  - `Softs/0 Agenci/Longchain dev.zip :: Longchain dev/docs.langchain.com/langsmith/administration-overview.html` (administration: governance posture dla wglądu).
- **OpenAI (agent/tool posture → audyt i approvals)**:
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/resources/agents.html` (Agents resources: agent runs jako “first-class”).
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/resources/tools.html` (Tools: tool calls jako część kontraktu).
  - `Softs/0 Agenci/OpenAI.zip :: OpenAI/developers.openai.com/codex/agent-approvals-security.html` (approvals/security: zasady bezpiecznego wykonywania).
- **Palantir Foundry (lineage as interactive workspace)**:
  - `Softs/Palantir/www.palantir.com/docs/foundry/workflow-lineage.html` (Workflow Lineage overview: “graph of provenance”, debugging/maintenance; access controls).
  - `Softs/Palantir/www.palantir.com/docs/foundry/data-lineage/explore-lineage.html` (Data Lineage: end-to-end view; eksploracja lineage).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “artefakt ma audytowalną prawdę na każdej powierzchni”, nie “pełny enterprise IAM redesign”.**

- **Evidence pointers (Claude citations posture)**:
  - “Dlaczego tak mówimy” ma mieć wskazania źródeł (albo jawne ograniczenie), nie tylko badge “AI”.
- **Run traceability (LangSmith traces posture)**:
  - Każdy artefakt ma link do runu: inputs → tool calls → outputs → errors/warnings.
- **Approval separation (OpenAI approvals posture + Wave2 doctrine)**:
  - Approval(run) jest osobną osią od review(artifact); UI i data model nie mogą ich zlewać.
- **Lineage as explorable graph (Palantir lineage)**:
  - Użytkownik może “prześledzić pochodzenie” (provenance) i zrozumieć zależności; nie tylko statyczny “created by”.
- **Visibility/export truth**:
  - Kto widzi, co można exportować, i co zostało wyeksportowane jest częścią trust grammar (z audytem).

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE2_FINAL_IMPLEMENTATION_PLAN_PROVENANCE_REVIEW_VISIBILITY_2026-03-29.md` + `WAVE2_GAP_BACKLOG_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Exposure consistency | same truth everywhere | “exposure uneven across surfaces” | Ujednolicić trust-state w Library + Preview + Export surfaces | P0 |
| Stage clarity | validation vs review clear | “stages not packaged clearly enough” | Domknąć stage language i badges (validation/review/ready) | P0 |
| Traceability depth | run→tool→output visible | “grammar risks lagging doctrine” | Pokazać run lineage + tool calls + evidence pointers jako first-class | P1 |

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Trust-state jest widoczny i niesprzeczny (library + preview + export history + access); stage separation jest jasna.
- Każdy artefakt ma: source + run id + stage + owner/reviewer + visibility/export posture (spójne).
- Approval(run) ≠ review(artifact): brak konfliktów i “podwójnej prawdy”.

### 5.2 Tests
- Integracyjne: ArtifactRun → Outputs Library → Preview → Export → Audit readback.
- Regression: zmiana stage (validated/reviewed) → wszystkie surfaces aktualizują się spójnie.
- Contract tests: trust payload schema (source/run/stage/visibility/export ledger) jest stabilny.

### 5.3 Staging proof checklist
- Demo: artefakt pochodzący z runu ma lineage widoczne i klikalne; citations/evidence pointers tam gdzie dotyczy.
- Demo: export eventy są widoczne (kto/kiedy/co) i nie łamią visibility.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Wave2 SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P18-A — Trust-state canon + exposure consistency (scope approval)
- **Goal**: jedna gramatyka trust-state/stage/visibility spójna w library/preview/export.
- **Inputs required**: §2.3–2.6; Wave2 detailed plan; `NEXT_PACKET.md` authorization.
- **Evidence**: scope approval + linkowane SSOT; lock P18-A released; `EXECUTION_INDEX.md` #18 = `approved(scope)`; ledger §10.

##### P18-A — Acceptance checklist (testable)

1. **Minimum pillars**: Contract defines **source**, **run_id**, **stage**, **visibility**, **export_ledger** with explicit mapping to current trust payload fields (§2.3 table).
2. **Single read API**: `GET /api/artifacts/:id/trust-state` is the **authoritative** trust bundle for an artifact id; surfaces extend consumption, not parallel schemas (§2.6).
3. **Stage axes separated**: Validation (`validationState`/`validationChecks`), publish/review (`publishState`/reviewers/gates), and execution (`executionState`/`executionRunId`) are **three distinct** concepts in contract copy (§2.4).
4. **Badge mapping bounded**: UI chips/badges must map to §2.4 axes without swapping execution labels for publish labels (falsifiable in P18-B staging).
5. **Invariant explicit**: §2.5 states **approve(run) ≠ review(artifact)** with definitions; forbidden to merge in UI/API naming without disambiguation.
6. **Authority strings**: Payload carries `reviewAuthority` vs `executionAuthority` as non-interchangeable; surfaces that show trust must preserve both meanings where applicable.
7. **export_ledger**: `exportHistory` is the audit trail shape; `exportPath` is capability, not a substitute for ledger entries (§2.3).
8. **Anti-duplicate**: §2.6 lists **concrete** repo files to extend; no `trust-state-v2` route without reconciliation packet.
9. **Non-goals**: §2.2 excludes second API, shadow enums, IAM redesign, frozen-layout breaks.
10. **Outputs Library alignment**: Consumers (e.g. Outputs preview) use trust-state merge only — already reflected in anti-duplicate row for `OutputsAggregateTabContent.tsx`.
11. **Foundation ordering**: `EXECUTION_INDEX` lists **18** as the first foundation trust anchor; **P18-A** (scope only) does not require prior completion of 17/19/27 — downstream positions consume this canon once frozen.

- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze trust payload schema (source/run/stage/visibility/export ledger) and mapping to UI badges.
  - Freeze stage language (validation/review/ready) and exposure rules across surfaces.
  - Freeze approval(run) vs review(artifact) invariants.
- **DoD**:
  - `approved(scope)`: §2.3–2.6 + checklist above; index #18; lock released.

#### P18-B — End-to-end traceability closure
- **Goal**: run→tool→output traceability jako first-class + spójny export audit.
- **Acceptance**: lineage jest klikalne; export event nie łamie visibility; stage separation jest jasna.
- **Evidence**: integracyjne testy + staging demo lineage+export.
- **Tasks**:
  - Implement click-through lineage (run→tool calls→output) as first-class.
  - Implement export audit that respects visibility; add integration/regression tests (5.2).
  - Run staging demos (5.3) and capture evidence.
- **Staging proof script (click-by-click)**:
  1. Open an artifact in Outputs/Preview and locate trust-state badges (stage/visibility/export).
  2. Click lineage: open run id → tool calls → output pointers (bounded).
  3. Change stage (e.g., validated/reviewed) and verify the badge updates consistently across list + preview + open.
  4. Export/share (bounded) and confirm export event is recorded and does not bypass visibility.
  5. Attempt access with insufficient role and verify denial is explicit (no leakage).
- **DoD**:
  - Lineage is visible and consistent; exports are audytowalne and do not bypass visibility.

#### P18-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Fill ledger rows P18-A/B/C with commits, test runs, staging proofs.
  - Validate rollback: disable new badges/exports; preserve read-only lineage.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw payload+badges (read surfaces), potem rozszerzenia traceability depth (P1).

### 8.3 Rollback plan
- Wyłącz nowe badges/exports; zachowaj read-only lineage; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: sprzeczna prawda trust-state w różnych surfaces.
- Ryzyko: export omija visibility (compliance issue).
- Decyzje: minimalny zestaw stages i ich mapping do UI.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P18-A | approved(scope) | `0123538bb5` | N/A — docs/scope only | N/A | Canon §2.3–2.6; P18-A checklist; anti-duplicate §2.6; lock P18-A released; EXECUTION_INDEX #18 updated. |
| P18-B | delivered | `354be3330c` | `npx vitest run tests/integration/routes/artifacts.routes.test.ts tests/integration/routes/v8.execution.routes.test.ts` — PASS | `docs/product/work-packets/cursor-work/final_master/evidence/P18-B_PROVENANCE_LINEAGE_EXPORT_AUDIT_VERIFICATION_2026-03-30.md` | Click-through lineage (run -> tool calls -> output pointers) in Outputs Preview; export endpoints enforce visibility and record completed export traces; deny-by-default for non-visible runs (no leakage). |
| P18-C | verified(evidence) | `98bf75bf8a` | `npx vitest run tests/integration/routes/artifacts.routes.test.ts tests/integration/routes/v8.execution.routes.test.ts` -> PASS (21/21) | `docs/product/work-packets/cursor-work/final_master/evidence/P18-C_PROVENANCE_CLOSEOUT_2026-03-31.md` | Closeout verified trust-state payload stability, axis separation, visible lineage surfaces, and fail-closed access rules for non-visible runs. |

