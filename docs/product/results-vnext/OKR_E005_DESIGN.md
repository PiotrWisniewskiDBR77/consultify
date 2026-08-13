# OKR-E005 (Alignment) — FROZEN DESIGN

## §-IO. Integration Owner rulings (binding; override any contrary provisional wording below)

Status: **FROZEN**. Integration Owner: Claude (orchestrator session, 2026-08-10).
The sections below are the design draft as researched, accepted in full, subject to these rulings.

**Cross-cutting rulings — these resolve the recurring open questions common to every OKR draft:**

| # | Recurring question | Ruling |
|---|---|---|
| IO-1 | Prior OKR epics are designed but **not landed as code**; every cited signature/table/column comes from frozen docs, not running code. Several drafts independently confirmed this by direct grep. | **Correct, acknowledged, and NOT a blocker to freezing the design — but it IS a hard build-time gate.** The implementer MUST re-verify every cross-epic signature, table, and column against actually-landed code before writing against it, and MUST report divergence rather than silently adapting. The OKR epics land strictly in order E001→E008; each implementation begins by re-reading its predecessors' landed code. |
| IO-2 | A policy value the design needs has **no column on `okr_vnext_programs`** (attention thresholds, clamping rules, status-suggestion policy). | **Do NOT `ALTER TABLE okr_vnext_programs` for it in this epic.** Use an explicitly-named constant or return `not_calculable`, and record the gap in the closure entry. Reserving a column costs a migration on a table that may already hold data; naming the gap costs nothing and keeps it visible. Mirrors `reflection_required_for_close`'s own reserve-and-flag precedent. |
| IO-3 | A capability is plausible and useful but **no AC in the ledger names it**. | **Do not build it.** Name it in the closure entry as a deferred, unowned gap. Every prior domain held this line; speculative scope is exactly what the per-epic AC tables exist to prevent. |
| IO-4 | A cross-epic boundary is assumed but unconfirmed by any AC. | **Restate it forward explicitly** in the closure entry, addressed to whoever implements the neighbouring epic — never leave it a silent assumption. Precedent: OKR-E002 D13's `resolveScopeVisibility` gap, restated rather than quietly resolved. |
| IO-5 | A formula, threshold, or gradient is **not specified in any source document**. | **Never invent one carrying a free parameter.** Either use the definitionally-forced value (e.g. binary = 1.0/0.0) or return `not_calculable` with a reason. A fabricated gradient inside a number that feeds review decisions is the same class of risk as ROI's NPV/rounding gap. |
| IO-6 | The design needs a change to a file **outside this epic's own allowlist** (another module's controller, a shared platform primitive). | **Permitted only when additive and strictly backward-compatible** (new optional field, new exported function, widened guard that rejects nothing previously accepted). It must be its own separate commit, named in the closure entry as a cross-module change. Anything more invasive stops and reports instead. |

Any open question in this draft not addressed by an epic-specific ruling below stands **exactly as the draft documented it** — flagged, unresolved, and to be restated in the closure entry rather than silently decided during implementation.

---

Status: IN PROGRESS — reading source docs.

Worktree: `/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify-results-vnext-g0-20260809`
Branch: `codex/results-vnext-g0-20260809` (138 ahead / 0 behind origin/demo as of 2026-08-10)

---
## 1. Source: EPIC_LEDGER_LIVE.md — OKR-E005 Alignment (verbatim)

> Wypełnione przez agenta `aa3fc90c059b0bf01` — 2026-08-09.

### OKR-E005 Alignment

| Pole | OKR-F-014-AC-01 | OKR-F-015-AC-01 (izolujący AC) | OKR-F-016-AC-01 | OKR-F-017-AC-01 |
|---|---|---|---|---|
| Decision ID | D09 | D09 | D09 | D09, D10 |
| Requirement | `ObjectiveAlignment.relation=contributes_to` opcjonalna, cross-functional; brak wymuszonej czystości drzewa/klonowania treści. | **Utworzenie/akceptacja alignment NIE MUTUJE progress/confidence/roll-up celu docelowego** — bezpośrednie odrzucenie AS-IS `okr_objectives.parent_id` cascade rollup. | Cykle w grafie odrzucane na poziomie komendy; cross-cycle/cross-org niezgodność failuje walidację. | Ukryte/restricted Objectives nie przeciekają przez węzły/liczniki/search/analytics/Teresa — test negatywny na realDB. |
| Aggregate/owner | ObjectiveAlignment | ObjectiveAlignment ↔ Objective (target) | ObjectiveAlignment validation service | ObjectiveAlignment read projection |
| Command/query/API | `POST .../objectives/:id/alignments`, `DELETE .../alignments/:id` | j.w. (guard w accept) | j.w. (walidacja przy create) | `GET` alignment list/graph |
| Schema/migration/constraint | `okr_vnext_alignments` (status: proposed/accepted/rejected/removed) | `okr_vnext_objectives.progress/confidence` — **BRAK triggera/kaskady** | `okr_vnext_alignments` + cycle/org compat constraint | filtr autoryzacji PRZED agregacją |
| Roles/visibility | Objective Owner (propose), target Owner (accept/reject) | wszystkie role | wszystkie role | RESTRICTED_ACL/PRIVATE — Auditor break-glass wyjątek |
| Status | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |

**Key takeaways from the table:**
- Aggregate is `ObjectiveAlignment` (Objective↔Objective edge), relation type `contributes_to` (only one named in AC-01), OPTIONAL, cross-functional, NOT a strict tree, no content cloning.
- OKR-F-015-AC-01 is explicitly flagged "(izolujący AC)" — an isolating/negative AC — same convention as OKR-F-012 (KPI read isolation) and OKR-F-029 (legacy isolation). This is the direct textual anchor for "no score inheritance": creation/acceptance of an alignment must NOT mutate progress/confidence/roll-up of the target Objective. It is framed as direct rejection of the AS-IS `okr_objectives.parent_id` cascade rollup bug.
- Schema/constraint column for OKR-F-015 says literally: **"BRAK triggera/kaskady"** (no trigger/cascade) on `okr_vnext_objectives.progress/confidence`.
- OKR-F-016: cycle detection in the alignment graph is rejected at command level; cross-cycle/cross-org mismatch fails validation — table row schema note: "+ cycle/org compat constraint".
- OKR-F-017: hidden/restricted Objectives must not leak through alignment nodes/counters/search/analytics/Teresa — enforced via "filtr autoryzacji PRZED agregacją" (authorization filter BEFORE aggregation), tested via realDB negative test. Roles/visibility column: RESTRICTED_ACL/PRIVATE — Auditor break-glass exception.
- Status column for `okr_vnext_alignments`: status enum `proposed/accepted/rejected/removed` — this IS a maker-checker-lite propose/accept/reject flow, target Objective Owner accepts/rejects, source Objective Owner proposes.

## 2. Source: 04_OKR_IMPLEMENTATION_PLAN.md — Alignment section (§6, verbatim) + supporting decisions

Binding decision #8 (§2): **"Alignment means "contributes to". Alignment is optional and does not mechanically cascade wording or progress."**

§3.2 (what cannot become the vNext foundation), verbatim: **"current `parent_id` cascade automatically affects roll-up; vNext alignment is an explicit relation and has no default score effect;"**

§6 Alignment, full verbatim:

> `ObjectiveAlignment` is a first-class relation:
>
> ```yaml
> ObjectiveAlignment:
>   id: uuid
>   source_objective_id: uuid
>   target_objective_id: uuid
>   relation: contributes_to
>   rationale: text | null
>   created_by: uuid
>   status: proposed | accepted | rejected | removed
> ```
>
> Rules:
> - optional, authorization-aware, and cross-functional;
> - no forced tree purity and no wording clone;
> - no automatic progress inheritance or target synchronization;
> - cycle and organization compatibility validated;
> - graph cycles rejected;
> - hidden/restricted Objectives do not leak through nodes, edge counts, search, analytics, or Teresa;
> - unaligned is diagnostic context, not automatic failure.
>
> MVP may show parent/contribution relations as a list/tree. Interactive organization graph is V2.

**This is the canonical schema baseline** — flat edge table, one relation type (`contributes_to`) in MVP, status lifecycle `proposed|accepted|rejected|removed`, `source_objective_id`/`target_objective_id` (Objective→Objective, not Set→Set, not KR→Objective).

§18 Risks table, row "Reusing legacy cascade" → Consequence: "forced hierarchy and misleading roll-up" → Mitigation: **"separate alignment relation, no score inheritance"** — this is the literal source of the paraphrase in the task brief. The actual defining text is §6's "no automatic progress inheritance or target synchronization" plus §3.2's "has no default score effect", both anchored to AS-IS rejection of `okr_objectives.parent_id` cascade (per EPIC_LEDGER_LIVE OKR-F-015-AC-01).

§18 also: "Cross-domain coupling" risk → Mitigation: **"no structural foreign keys; typed optional context only"** — same family as D09 (KPI/OKR isolation) and D10 (ROI-E002 typed non-propagating reference pattern); alignment edges should follow the same typed-reference-not-FK discipline.

§7.4 Visibility rules, verbatim (governs cross-visibility reads, item E of this design):
- visibility permission and edit permission are separate;
- per-record restriction may narrow, never silently broaden, Program default;
- evidence may be more restricted than its OKR;
- **"unauthorized records are absent, not redacted with identifying metadata"**;
- all aggregations are computed after authorization filtering;
- break-glass requires explicit role, reason, expiry, alert, and event;
- exports, search index, notifications, AI context, and audit viewers enforce the same policy.

§19 Non-goals, relevant items: "required Objective/KR links to Initiative, KPI, ROI, task, or project"; "rigid mandatory cascade"; "sophisticated alignment graph in MVP" (→ confirms (F) graph/tree views are MVP-basic, interactive org graph is V2, per §6 closing line).

§16 GO/NO-GO gate table, row "Alignment": Required MVP basic | graph/auth | authorized view | relation reopen | **"no metadata leak"** | NO-GO until all.

§20 Open evidence/founder decisions (EVIDENCE_NEEDED, none directly about alignment cardinality/cross-cycle specifics beyond what §6 states — noted for Open Questions section).

NOTE: 04_OKR_IMPLEMENTATION_PLAN.md does NOT contain a D01-D15 canonical decision-text table itself (only "Decision ID" tags used in EPIC_LEDGER_LIVE cross-referencing D09/D10/etc.) — proceeding to `01_RESULTS_MASTER_IMPLEMENTATION_PLAN.md` for the canonical D-number definitions.

## 3. Source: 01_RESULTS_MASTER_IMPLEMENTATION_PLAN.md — D01-D15 canonical table (verbatim, §2)

```
| D08 | OKR Set jest materializowany | Set = Cycle + scope/team + owner |
| D09 | OKR niezależny od KPI/ROI/Initiative | tylko jawne referencje kontekstowe lub neutralny source binding |
| D10 | Widoczność zależy od domeny | KPI scope/chain; ROI restricted; OKR open-org z override |
| D11 | Maker-checker zależy od domeny i materialności | ROI ma najsilniejszą separację |
| D12 | Domain state + MyWork obligation + formal Decision | brak kopiowania stanu do systemu zadań |
| D13 | Clean start bez migracji legacy | nowe modele są puste; legacy read-only archive |
| D14 | Równoległa budowa KPI, ROI, OKR | wspólny Gate 0/1, potem trzy workstreamy |
| D15 | Teresa od pierwszego etapu | AI jest warstwą organizacyjną, nie późnym dodatkiem |
```

And the acceptance-criterion table (§ "gate" table further down), verbatim row for D09:

```
| D09 | niezależność OKR | G1/OKR | brak FK/roll-up inheritance | OKR |
```

(columns: ID | Decision | Gate | **Acceptance evidence** | Owner)

**THIS is the canonical "no score inheritance" defining text**: D09's acceptance-evidence column literally reads **"brak FK/roll-up inheritance"** ("no FK/roll-up inheritance") — exactly the phrase the task brief paraphrased ("same family as D09"). D09's decision text itself ("OKR niezależny od KPI/ROI/Initiative — tylko jawne referencje kontekstowe lub neutralny source binding") is about cross-DOMAIN independence (OKR vs KPI/ROI/Initiative), but its acceptance-evidence generalizes to "no FK / no roll-up inheritance" as the test property for the whole OKR domain — and EPIC_LEDGER_LIVE explicitly tags OKR-F-015 (alignment must not mutate target progress/confidence/roll-up) under **D09**, i.e. the Founders extended D09's "no FK/roll-up inheritance" discipline from cross-domain (OKR vs KPI/ROI) to intra-domain (Objective vs aligned Objective). So D09 is a DUAL-SCOPE decision: (a) no FK from okr_vnext_* to kpi_*/roi_*/initiatives; (b) no roll-up/cascade inheritance mechanism anywhere in OKR, including between aligned Objectives. Both are literally the same acceptance test shape: no trigger, no FK-driven cascade, no roll-up write path.

D10 row for reference: "Widoczność zależy od domeny | KPI scope/chain; ROI restricted; OKR open-org z override" → gate table: "domenowa widoczność | G1/G2/G7 | owner/manager/viewer/outsider, non-leak | Security + domeny" — governs (E)/(G) cross-visibility design below; OKR default = OPEN_ORGANIZATION with per-record override (matches §7.4 of 04_OKR_IMPLEMENTATION_PLAN.md).

D13 clarification (§2.1, verbatim): "`Clean start` oznacza brak backfillu i brak automatycznego uznania historycznych rekordów za nową prawdę. Nie oznacza fizycznego skasowania tabel lub rekordów." — relevant to legacy `okr_objectives.parent_id` handling: it stays in `LEGACY_READ_ONLY_ARCHIVE`, not migrated into `okr_vnext_alignments`.

## 4. Source: OKR_E001_DESIGN.md + OKR_E002_DESIGN.md — precedent facts to carry into E005

**Aggregate hierarchy so far (E001+E002, both FROZEN):**
```
OKRProgram (okr_vnext_programs, status draft|active|suspended|retired, ONE active per org — partial unique index)
└─ OKRCycle (okr_vnext_cycles, status planned|drafting|active|review|closed|cancelled, policy_version_id PINNED at creation, no scope columns — regression guard vs AS-IS)
   └─ OKRSet (okr_vnext_sets, = Cycle + scope_type/scope_id + owner_user_id, materialized, ABAC resource_type='okr_set')
      ├─ okr_vnext_approved_snapshots (immutable, REVOKE UPDATE/DELETE, content_hash, sequence_number)
      └─ okr_vnext_set_versions (append-only OKRMaterialChange, REVOKE UPDATE/DELETE)
```
Objective/KeyResult (OKR-E003) and Alignment (OKR-E005) do not exist in landed/frozen design yet — **must re-verify against actual landed code before finalizing table/column names**, per the task's "flag anything needing re-verification" instruction. This design assumes `okr_vnext_objectives`/`okr_vnext_key_results` exist with at least `objective_id PK`, `set_id FK`, `progress`, `confidence` columns (per EPIC_LEDGER_LIVE OKR-E003 row and OKR-F-015's explicit naming of `okr_vnext_objectives.progress/confidence`).

**Platform mechanics confirmed reusable for E005:**
- `executeAtomicCreate` / `executeAtomicCommand` / `AtomicWriteConflictError` (409) / `AtomicWriteAggregateNotFoundError` (404) — `server/src/services/resultsVnext/platform/atomicWrite.ts`. New event types must be registered there (`['mywork_projection']` consumer group pattern) — never silently reuse/duplicate an existing key (D9 precedent: `okr_set.published` was deliberately repurposed, not duplicated).
- `row_version`-CAS optimistic concurrency on every mutable aggregate row.
- SAVEPOINT-around-candidate-INSERT dedupe pattern for unique-constraint races (`createRoiCase` precedent; naive catch-without-SAVEPOINT fails `25P02`).
- `RVN_RESOURCE_TYPES` (`server/src/services/resultsVnext/platform/resourceTypes.ts`) and `CanonicalObjectTypeValues` (`server/src/types/myWorkRoofPackage.ts`) — append-only unions; `'okr_set'` reserved since RN-G1, actually written starting E002. New E005 aggregate (`ObjectiveAlignment`) likely needs no NEW resource_type of its own if alignment visibility is derived entirely from the two Objectives it connects (see §E below) rather than being its own ABAC resource — **this is a real design choice**, resolved in §G.
- `getActiveVisibilityPolicy` / `publishVisibilityPolicy` (`visibilityResolver.ts`) — domain-level policy row in `rvn_platform_visibility_policies` (`domain='okr'`), already authored by OKR-E001's `publishProgram`. E005 does not need its own visibility-policy authoring — it reads the existing `domain='okr'` policy.
- `buildVisibilityScopedCte` / `wrapWithVisibilityScope` (`visibilityScopedQuery.ts`) — mandatory for any ABAC-scoped read; **`rvn_platform_resource_visibility.resource_id` is TEXT, aggregate PKs are UUID — every join needs an explicit `::text` cast.** OKR-E002's own file list calls this "the single most-repeated real bug in this program" (missed 7× in one KPI epic already). This is the #1 mechanical risk for E005's read-side design (§G).
- Visibility rank order (local to `okrSetCommands.ts`, D12/D19 of E002 — **not a platform-wide helper**): `OPEN_ORG=0 < SCOPE=1 < MANAGEMENT_CHAIN=2 < RESTRICTED_ACL=3 < PRIVATE=4`. Real platform enum spelling is `OPEN_ORG`/`MANAGEMENT_CHAIN` (not `OPEN_ORGANIZATION`/`MANAGEMENT` as EPIC_LEDGER_LIVE's prose loosely says) — confirmed via E001 §4 DDL comment "Platform's real enum spelling (visibilityResolver.ts), not the plan doc's prose spelling." **Use this exact enum in E005's own DDL/checks.**
- Error-class convention: one class per aggregate, never reused across aggregates (`OkrSetSelfApprovalDeniedError`, not a shared `SelfApprovalDeniedError`). E005 needs its own `ObjectiveAlignment*Error` classes.
- Command file location convention: `server/src/services/resultsVnext/okr/okr<Aggregate>Commands.ts` + `okr<Aggregate>Types.ts` + (if ABAC-scoped reads) `okr<Aggregate>Repository.ts`.
- Route file: single `server/src/routes/resultsVnext/okr.routes.ts`, extended per epic (not a new file per epic) — mount-order note discipline: dynamic `:id` segments must be mounted after any literal sibling sub-paths.
- Validators: single `server/src/validators/resultsVnextOkr.validators.ts`, extended per epic.
- MyWork obligations: `createObligation` (`server/src/services/resultsVnext/platform/obligations.ts`) — E002 precedent `draft_okr_set`/`review_okr_set`. E005's propose/accept flow is a natural obligation candidate (`review_alignment_proposal` assigned to target Objective Owner) — **not explicitly named in the AC table, so this is a design addition to state explicitly, not silently assume** (same posture as E002 D15's `cancelOkrSet`).

**Standing rule repeated in every design doc**: re-verify every cross-epic reference against actually-landed code before implementation — OKR-E003/E004 have NO frozen design doc in this worktree yet (only E001/E002 exist per the earlier `find`), so **any assumption this document makes about `okr_vnext_objectives`/`okr_vnext_key_results` schema is unverified against landed code and must be re-checked** when E003 lands or is found to have landed out-of-band.

## 5. Source: EXECUTION_LEDGER.md §3.4 (OKR AS-IS code / D09 violations) + §3.6 (UI canon) + confirmation E003/E004 unlanded

§3.4 verbatim facts (AS-IS legacy code, live on demo/prod today, `914_okr_management.sql` + RES-009):
- 4 legacy tables: `okr_cycles`, `okr_objectives` (**with `parent_id` cascade rollup** — this is THE AS-IS violation OKR-F-015-AC-01 rejects), `okr_key_results` (**with `kpi_id` + `kpi_definition_version_id` FK** — cross-domain D09 violation, separate from alignment), `okr_check_ins`.
- No `okr_sets`/`okr_programs` legacy tables — migration authors admittedly flattened Set into `okr_cycles.dept_id/team_id`.
- Legacy alignment mechanism = `okr_objectives.parent_id` — a plain self-referential FK with **cascading rollup** (exact mechanism forbidden by D09/OKR-F-015). This confirms the new `okr_vnext_alignments` design must NOT be a self-referential `parent_id`-style FK — it must be a separate edge table with independent lifecycle (proposed/accepted/rejected/removed) and zero write path into `progress`/`confidence`.
- Legacy write endpoints are `shadow:true` capability-gated — "shadow-only, nothing actually blocked" until `CAPABILITY_ENFORCE=enforce`. Not relevant to E005 directly (vNext writes go through real RBAC/ABAC per D08/D09 posture already established in E001/E002) but confirms legacy is not a security precedent to imitate.
- Good news noted: scoring is already manual-only in legacy (auto-score-from-KPI was reverted at `aa26ba4067`, documented as "superseded to informational-only" in the migration itself) — i.e. legacy's *KPI* auto-scoring problem is dead code today, but the *parent_id cascade rollup* problem (progress propagating from child Objective to parent Objective) is still live and is exactly what OKR-F-015 targets.

§3.6 (UI canon component inventory) — **not directly relevant to E005's backend design** (E001/E002 precedent: OKR domain epics through at least E002 are "Backend only — UI Registry is RN-G2"); recorded for completeness only. Key components if/when an alignment UI package follows: `StandardTable.tsx`/`FilterableTable.tsx`, `StandardPreview.tsx`, `TableWithPreviewLayout.tsx`. Crimson `#85182F` banned as state/CTA color per project-wide TRIADA_KANON (matches root CLAUDE.md rule #3). Not building any UI in this design — flagged as future-package concern only.

**Confirmed via full-file grep**: `EXECUTION_LEDGER.md` contains ZERO entries mentioning `OKR-E003` or `OKR-E004` or `OKR-E005` anywhere (searched `OKR-E00[1-8]`, zero matches at all — even E001/E002 closure entries are apparently not yet posted here, unlike KPI/ROI which have many numbered closure entries through §38/ROI-E007). This means: **OKR-E003 (Objectives & KRs) and OKR-E004 (Check-ins) have no confirmed landed code and no design doc in this worktree.** This design (E005) must treat `okr_vnext_objectives`/`okr_vnext_key_results` table/column names as **UNVERIFIED ASSUMPTIONS** sourced only from EPIC_LEDGER_LIVE.md's schema-column cell (which names `okr_vnext_objectives.progress`/`okr_vnext_objectives.confidence` literally) — flagged as an explicit open risk in §J.

## 6. Source: code precedents read directly (facts, not yet composed into design)

**`rvn_roi_benefit_evidence_links`** (`server/migrations/20260816_rvn_roi_economic_model.sql:279-296`) — typed FK to `rvn_kpi_definitions(kpi_id)` + `pinned_kpi_definition_version_id` FK, `purpose` CHECK, `dispute_status` CHECK. ROI_E002_DESIGN.md **D14 (verbatim)**: "No visibility check at link-creation time — only an organization-scoped existence check... **a link is metadata about a relationship, not a copy of the KPI's data**." Hydration (showing the linked KPI's actual name/value) must go through KPI's own `resource_type='kpi'` visibility-scoped query separately — "a viewer without KPI access sees the link exists (pinned id/version/purpose) but not the KPI's content." **This differs from what OKR-E005 needs**: ROI's evidence link is asymmetric (ROI Case is the "owner", KPI is passively referenced, and the link's mere existence is not sensitive) — OKR alignment is symmetric (BOTH endpoints are peer Objectives, either of which may be independently hidden), so §7.4's stricter "absent, not redacted" rule (not D14's softer "exists but content hidden") is the correct fit for OKR-E005 — see §11 below.

ROI_E002_DESIGN.md **D10 (verbatim, re: `link_graph_edges`)**: "polymorphic (`target_type IN (...)`, `target_id UUID`, no FK — matches `link_graph_edges`'s existing polymorphic-reference precedent)" — used there for `rvn_roi_scenario_overrides`, a NEW dedicated local table modeled on the shape, not literal rows written into `link_graph_edges` itself.

**`link_graph_edges`** DDL (`server/migrations/20260303_link_graph_v3.sql:7-25`): `id TEXT PK, organization_id, created_by, source_type TEXT, source_id TEXT, target_type TEXT, target_id TEXT, relation TEXT DEFAULT 'ref', container_type/container_id/block_id (optional context), created_at`. Fully generic, all-TEXT, NO FK, NO status lifecycle column at all (dedup via a best-effort unique index over the 7-tuple). Used across ~15 unrelated call sites (Idea/Interview/Decision/Notebook controllers) for ad hoc cross-content references, not for a single domain's own strongly-typed, lifecycle-bearing relation.

**Decision for (A)/(D) below**: `okr_vnext_alignments` must be its OWN dedicated table with typed UUID FKs to `okr_vnext_objectives` on both ends (not rows in `link_graph_edges`) — because: (1) both endpoints are always the SAME entity type within the SAME domain (Objective↔Objective), unlike `link_graph_edges`'s cross-module design target; (2) alignment needs a real status lifecycle (`proposed/accepted/rejected/removed`) that `link_graph_edges` has no column for; (3) `04_OKR_IMPLEMENTATION_PLAN.md` §6 already gives the literal target schema as a dedicated `ObjectiveAlignment` YAML shape, not a `link_graph_edges` row; (4) EPIC_LEDGER_LIVE's own Schema/constraint cell says `okr_vnext_alignments` literally.

**`kpiInitiativeImpactCommands.ts`** (`server/src/services/resultsVnext/kpi/kpiInitiativeImpactCommands.ts:1-20`, KPI-E005) — a DIFFERENT precedent shape: `rvn_kpi_initiative_impacts` deliberately has **no own `rvn_platform_resource_visibility` row** — "it inherits visibility from `kpi_id`" — and its events use `aggregateType: 'kpi'` (the PARENT's resource type) with `aggregateId` = the owning `kpi_id`, NOT the child row's own id. This works because that table has exactly ONE owning parent (`kpi_id`). **OKR-E005's alignment edge has TWO peer "owners" (source + target Objective) with potentially DIFFERENT visibility** — the single-parent-inherits pattern does not directly transfer; the read-time double-join rule (§11/§13 below) is the correct adaptation, reasoned from first principles using this precedent as the starting point, not a literal copy.

**`managementChainMaintenance.ts`** (`server/src/services/resultsVnext/platform/managementChainMaintenance.ts`) — `assertNoManagementChainCycle` (lines 213-259): walks the CURRENT single-parent chain from `newManagerId` upward; throws `ManagementChainCycleError` if the walk reaches `userId` itself; bounded by `orgSize` hops (defensive, handles pre-existing corrupted cycles without infinite loop) — throws `CHAIN_DOES_NOT_REACH_ROOT` if the bound is exceeded. Doc header (lines 1-12): **Decision explicitly "maintenance is SERVICE-LAYER, not a DB trigger"** — direct precedent for OKR-F-015's "BRAK triggera/kaskady" posture. Important structural difference from OKR alignment: management chain is a strict single-parent TREE (each user has exactly one current `manager_id`); alignment is a general many-to-many DAG (an Objective can have multiple alignment targets AND multiple sources) — so cycle detection cannot reuse the single-chain-walk algorithm verbatim; it needs general graph reachability (see §10 below), still bounded defensively the same way.

**`visibilityScopedQuery.ts`** (`server/src/services/resultsVnext/platform/visibilityScopedQuery.ts`) — `buildVisibilityScopedCte({userId, organizationId, resourceType})` returns `{sql: "WITH rvn_visible_resources(resource_type, resource_id) AS (...)", values}` — ONE CTE per `resourceType`, resolving OPEN_ORG/PRIVATE/SCOPE/MANAGEMENT_CHAIN/RESTRICTED_ACL branches (plus an RBAC/PBAC override UNION branch) against `rvn_platform_resource_visibility`. `resource_id` in that CTE and in `rvn_platform_resource_visibility` is **TEXT**; every join from a UUID-keyed domain table must cast `::text` (module doc explicitly calls this the single most-repeated real bug in the whole program — missed 7× in one KPI epic alone, per OKR_E002_DESIGN.md §7 file list). `wrapWithVisibilityScope(baseQuerySql, cteParams)` prepends the CTE to a caller's query; caller's own placeholders must start at `$4` (`VISIBILITY_CTE_PARAM_COUNT=3`). Since BOTH endpoints of an alignment edge are the SAME `resourceType` (`'okr_objective'`), one `buildVisibilityScopedCte({resourceType:'okr_objective'})` call is sufficient — the base query then needs TWO separate `INNER JOIN rvn_visible_resources` clauses (aliased differently) against the SAME CTE instance, one per endpoint. **Critical, currently-unverifiable dependency**: `RVN_RESOURCE_TYPES` (`server/src/services/resultsVnext/platform/resourceTypes.ts`), read directly, TODAY contains only `['kpi','roi_case','okr_set','deviation_case','kpi_scorecard']` — **`'okr_objective'` is NOT yet registered anywhere in this worktree.** `buildVisibilityScopedCte` throws synchronously if `resourceType` is not in that list. OKR-E005's entire read layer is therefore hard-blocked on OKR-E003 (Objectives) registering `'okr_objective'` in `RVN_RESOURCE_TYPES` + `CanonicalObjectTypeValues` (`server/src/types/myWorkRoofPackage.ts`) AND writing a `rvn_platform_resource_visibility` row per Objective at creation (mirroring `createOkrSet`'s own `'okr_set'` ABAC-row write) — **this has NOT landed** (confirmed: zero `okr_vnext_*` hits anywhere in `server/src` or `server/migrations` in this worktree — OKR-E001/E002 are FROZEN DESIGN DOCS ONLY, not implemented code, despite their own "Status: FROZEN" headers implying design-approval, not landed-code). This is the single most important re-verification flag for this whole document (see §16 Open Questions).

**`teresa-kpi-forbidden-verbs.test.ts`** (`tests/resultsVnext/teresa-kpi-forbidden-verbs.test.ts`, KPI-E006 precedent for structural enforcement) — the exact pattern requested by the task for part (B): reads the SOURCE TEXT of the target file(s) directly (`readFileSync`), then asserts (1) an exported canon array (`P08_KPI_FORBIDDEN_VERBS`) exactly matches a pinned literal list, (2) every cross-domain import in the target file is drawn from a hard allowlist of names (`ALLOWED_KPI_IMPORT_NAMES`), parsed via regex over `import { ... } from '...'` lines, including alias handling (`x as y`), (3) no forbidden verb appears as an imported binding OR as a `verb(` call pattern in non-comment lines, (4) the canon array's own verb strings never appear anywhere else in the canon file outside their own declaration block. The file's own header explains WHY a naive substring-count-zero grep (as originally sketched in the design doc) is "always false by construction" once the canon array itself exists, and documents the REAL invariant actually being proven (no reachable IMPORT of the forbidden verb, which is the only way JS/TS can call a function it doesn't define locally). **This is the exact template `alignmentNoScoreMutation.static.test.ts` should follow** (§9 below).


---

# OKR-E005 — Alignment — DRAFT DESIGN (Integration Owner review pending)

**Status: DRAFT, not yet frozen.** Fifth epic of the OKR domain, Results Next program.
Backend only, mirroring E001/E002's own posture ("Backend only — UI Registry is RN-G2").

**★ HEADLINE RE-VERIFICATION FLAG, read before anything else below**: OKR-E001 and
OKR-E002 exist ONLY as FROZEN DESIGN DOCS in this worktree — direct grep confirms
**zero `okr_vnext_*` hits anywhere in `server/src` or `server/migrations`**, and
`RVN_RESOURCE_TYPES` (`resourceTypes.ts`) still reads
`['kpi','roi_case','okr_set','deviation_case','kpi_scorecard']` with no
`'okr_program'`/`'okr_cycle'`/`'okr_set'`-writer/`'okr_objective'` addition landed.
OKR-E003 (Objectives/KRs) and OKR-E004 (Check-ins) have **no design doc at all** in
this worktree. Every table/column name this document uses for
`okr_vnext_objectives`/`okr_vnext_key_results` is sourced only from
`EPIC_LEDGER_LIVE.md`'s schema-column prose cells (which do literally name
`okr_vnext_objectives.progress`/`okr_vnext_objectives.confidence`) — **not from any
landed code or frozen DDL**. This document must be re-verified line-by-line against
whatever OKR-E001/E002/E003/E004 code actually exists at implementation time, the
same "mandatory, stated at the top" re-verification discipline OKR-E002 D20 imposed
on itself relative to OKR-E001.

## 0. Ground truth

Full per-AC table, `EPIC_LEDGER_LIVE.md`, OKR-E005 Alignment (4 ACs, all tagged
Decision ID **D09**, one also D10) — quoted verbatim in §1 above. Summary:

1. **OKR-F-014-AC-01** — `ObjectiveAlignment.relation=contributes_to` optional,
   cross-functional; no forced tree purity/content cloning.
2. **OKR-F-015-AC-01 (isolating AC)** — creating/accepting an alignment must NOT
   mutate the target Objective's progress/confidence/roll-up — direct rejection of
   the AS-IS `okr_objectives.parent_id` cascade rollup.
3. **OKR-F-016-AC-01** — graph cycles rejected at command level; cross-cycle/
   cross-org incompatibility fails validation.
4. **OKR-F-017-AC-01** — hidden/restricted Objectives never leak through alignment
   nodes/counters/search/analytics/Teresa — realDB negative test required.

**D09** (`01_RESULTS_MASTER_IMPLEMENTATION_PLAN.md` §2, quoted): "OKR niezależny od
KPI/ROI/Initiative — tylko jawne referencje kontekstowe lub neutralny source
binding." Acceptance-evidence column (gate table): **"brak FK/roll-up
inheritance."** EPIC_LEDGER_LIVE extends D09's scope from cross-DOMAIN (OKR vs
KPI/ROI/Initiative) to intra-DOMAIN (Objective vs aligned Objective) by tagging
OKR-F-015 under D09 — this document treats D09 as governing BOTH.

**AS-IS legacy violation** (`914_okr_management.sql`, confirmed via
`EXECUTION_LEDGER.md` §3.4): `okr_objectives.parent_id` is a plain self-referential
FK **with cascading rollup** — the exact mechanism OKR-F-015 rejects. `okr_vnext_alignments`
must NOT be a `parent_id`-shaped column with any cascade; it is a separate edge table
with an independent status lifecycle and zero write path into Objective fields.

---

## (A) Alignment edge entity

**What aligns to what**: Objective → Objective. Not Set→Set, not KR→Objective —
pinned literally by `04_OKR_IMPLEMENTATION_PLAN.md` §6's YAML (`source_objective_id`/
`target_objective_id`) and by EPIC_LEDGER_LIVE's `Aggregate/owner` cells
("ObjectiveAlignment ↔ Objective (target)").

**Cardinality**: many-to-many. §6: "no forced tree purity" — an Objective may have
multiple outgoing alignments (contributes to several targets) and multiple incoming
alignments (several Objectives contribute to it). Not a tree.

**Directionality**: directed edge, `source` "contributes to" `target`. Semantically
source = the more-granular/contributing Objective, target = the Objective being
contributed to (colloquially "child→parent", but the schema and this design
deliberately avoid that vocabulary — §6 explicitly bans "forced tree purity", and a
cross-functional edge between two peer-scope Objectives is equally valid).

**Edge metadata / relation type**: **only `contributes_to` is real.** Neither the
AC table nor `04_OKR_IMPLEMENTATION_PLAN.md` §6 names `supports` or `depends-on`
anywhere — those were the TASK BRIEF's own speculative paraphrase, not sourced text.
Per this program's repeated "reserve a column, never fabricate a feature surface"
discipline (OKR-E002 D2's reasoning), the `relation` column is `TEXT NOT NULL
DEFAULT 'contributes_to' CHECK (relation IN ('contributes_to'))` — a single legal
value today, intentionally not a richer enum with unused branches. §19 non-goals
confirms: "sophisticated alignment graph in MVP" is explicitly out of scope.

**Lifecycle**: `proposed → accepted | rejected`, and `accepted → removed` (also
`proposed → removed`, withdrawing an unanswered proposal). Four states total,
literal from EPIC_LEDGER_LIVE's Schema cell: `status: proposed | accepted |
rejected | removed`. Only `status='accepted'` edges constitute a "live" alignment
relationship for graph/read purposes (§10, §12); `proposed` is a pending request,
`rejected`/`removed` are terminal dead ends (a rejected/removed edge frees the slot
for a fresh proposal — see uniqueness rule below).

### Schema (DDL sketch)

Migration file: `server/migrations/<date>_rvn_okr_alignment.sql` (dated after
whatever OKR-E003/E004 land, per this program's sequential-dating convention).

```sql
-- ============================================================
-- okr_vnext_alignments — ObjectiveAlignment. Objective -> Objective edge.
-- D09/OKR-F-015: NO trigger, NO cascade to okr_vnext_objectives, anywhere.
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_alignments (
  alignment_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          TEXT NOT NULL,

  source_objective_id       UUID NOT NULL REFERENCES okr_vnext_objectives(objective_id),
  target_objective_id       UUID NOT NULL REFERENCES okr_vnext_objectives(objective_id),

  -- MVP: exactly one legal relation. Not a richer enum with unused branches —
  -- neither the AC table nor plan §6 names a second relation type. Widen only
  -- against a future AC, not speculatively.
  relation                   TEXT NOT NULL DEFAULT 'contributes_to'
                               CHECK (relation IN ('contributes_to')),
  rationale                  TEXT NULL,

  status                     TEXT NOT NULL DEFAULT 'proposed'
                               CHECK (status IN ('proposed','accepted','rejected','removed')),

  -- OKR-F-016: cycle/org compatibility as a REAL DB-level CHECK, not only
  -- app-code validation — denormalized at write time from each Objective's
  -- owning Set (Postgres CHECK constraints cannot cross-reference other
  -- tables, so these two columns are captured, not derived in-place).
  source_cycle_id             UUID NOT NULL,
  target_cycle_id             UUID NOT NULL,

  proposed_by                 TEXT NOT NULL,
  proposed_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_by                 TEXT NULL,
  responded_at                 TIMESTAMPTZ NULL,
  response_reason              TEXT NULL,
  removed_by                   TEXT NULL,
  removed_at                   TIMESTAMPTZ NULL,

  row_version                   INT NOT NULL DEFAULT 1,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- No self-loop.
  CHECK (source_objective_id <> target_objective_id),
  -- OKR-F-016: same Cycle required (see (C) below for the reasoning and its
  -- own flagged uncertainty re: annual_direction_enabled cross-cadence case).
  CHECK (source_cycle_id = target_cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_alignments_org_source
  ON okr_vnext_alignments(organization_id, source_objective_id, status);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_alignments_org_target
  ON okr_vnext_alignments(organization_id, target_objective_id, status);

-- Dedup slot: rejected/removed frees the slot (same "frees the slot" pattern
-- as okr_vnext_sets' ux_okr_vnext_sets_one_per_scope_cycle_owner, D3 of
-- OKR-E002) — a fresh proposal is allowed after a prior one was rejected or
-- removed; a live proposed/accepted duplicate is not.
CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_alignments_live_edge
  ON okr_vnext_alignments(organization_id, source_objective_id, target_objective_id, relation)
  WHERE status IN ('proposed','accepted');

-- Explicitly absent by design (D09/OKR-F-015, see (B)):
--   * no trigger on this table touching okr_vnext_objectives;
--   * no FOREIGN KEY ... ON UPDATE CASCADE anywhere near progress/confidence;
--   * no rvn_platform_resource_visibility row for this table's own resource_id
--     (alignment visibility is DERIVED at read time from both endpoints'
--     Objective visibility, never independently set — see (G)).
```

**Why `source_cycle_id`/`target_cycle_id` are denormalized, not joined at read
time**: EPIC_LEDGER_LIVE's Schema/constraint cell for OKR-F-016 literally says
"`okr_vnext_alignments` + cycle/org compat constraint" (singular, DB-level
"constraint" wording, not "validation service" wording, which the same row's
Aggregate/owner cell separately names for the actual cycle-detection algorithm).
A Postgres `CHECK` cannot reference another table, so the only way to get a REAL
constraint (not just app-code validation) is to capture both cycle ids on the row
itself at INSERT time (looked up via each Objective's `set_id → okr_vnext_sets.cycle_id`,
one extra join in the command's pre-check, same shape `createCycle`'s
`OkrCycleProgramNotActiveError` pre-check already uses in OKR-E001 §6.4) and CHECK
equality declaratively.


## (B) THE no-score-inheritance guarantee — structural, not documented

Task framing: "design how this is structurally enforced... what test or structural
property proves no code path propagates a score across an alignment edge?" Modeled
directly on `teresa-kpi-forbidden-verbs.test.ts` (KPI-E006) and the ROI-E007 grep-gate
posture ("AC-02 proven: zero write path exists anywhere in this epic's code to any
`financial_*` table (grep gate, not just a test)") — a **four-layer** proof, because
a single layer (e.g. "we just didn't build a trigger") is easy to defeat by accident
in a later epic:

**Layer 1 — DDL absence (structural/schema).** `okr_vnext_alignments`'s own migration
(above) contains no `CREATE TRIGGER`, and `okr_vnext_objectives`' migration (OKR-E003,
to be re-verified) must likewise define none referencing `okr_vnext_alignments`.
Direct precedent: `managementChainMaintenance.ts`'s own header states its closure
maintenance is "SERVICE-LAYER, not a DB trigger" as a deliberate architectural
decision — OKR-E005 goes one step further: not just "no trigger performs the
propagation," but "no service-layer code performs it either" (management-chain
closure DOES have a deliberate service-layer side effect on a DIFFERENT table;
alignment must have NO side effect on `okr_vnext_objectives` at all).

**Layer 2 — static source-text proof** (new file, mirrors `teresa-kpi-forbidden-verbs.test.ts`
exactly): `tests/resultsVnext/okr/alignmentNoScoreMutation.static.test.ts`.

```typescript
// Reads server/src/services/resultsVnext/okr/okrAlignmentCommands.ts (and any
// sibling okr*Alignment*.ts file) as raw text via readFileSync — never imports
// and calls it, so a dynamic-import trick cannot defeat the check (same
// rationale teresa-kpi-forbidden-verbs.test.ts's header states verbatim).

// 1. No raw SQL string literal in the alignment command file ever contains
//    `UPDATE okr_vnext_objectives` (case-insensitive) or the substring
//    "okr_vnext_objectives" on the same line as "SET " — i.e. this file may
//    SELECT/read okr_vnext_objectives (needed for the cycle/org-compat
//    pre-check) but may never appear as the target of an UPDATE.
const forbiddenUpdatePattern = /UPDATE\s+okr_vnext_objectives|okr_vnext_objectives[^\n]*\bSET\b/i;
expect(forbiddenUpdatePattern.test(alignmentCommandsSource)).toBe(false);

// 2. Import whitelist, same shape as ALLOWED_KPI_IMPORT_NAMES: every name
//    imported from '../okrObjectiveCommands.js' (OKR-E003, once landed) in
//    the alignment command file must be drawn from a hard allowlist of pure
//    READ functions (e.g. getObjectiveForAlignmentValidation). Any verb
//    shaped like updateObjective*/recalculate*/setConfidence*/recordProgress*
//    is categorically absent from the allowlist — this is checked the same
//    parse-import-lines-then-diff-against-a-Set way KPI-E006 checks it.

// 3. A canon array (mirrors P08_KPI_FORBIDDEN_VERBS), e.g.
//    OKR_ALIGNMENT_FORBIDDEN_OBJECTIVE_VERBS = ['updateObjectiveProgress',
//    'setObjectiveConfidence', 'recalculateObjectiveRollup', ...] (the exact
//    names sourced from OKR-E003's actual exports once it lands — placeholder
//    names here, re-verify) — asserted never imported/called in the alignment
//    command file, same two checks (import-binding text, `verb(` call
//    pattern in non-comment lines) as teresa-kpi-forbidden-verbs.test.ts's
//    tests 3-4.
```

**Layer 3 — realDB behavioral proof, the literal AC-01 evidence** (new file):
`tests/resultsVnext/okr/alignmentNoScoreMutation.realdb.test.ts`. Create two
Objectives with known, non-null `progress`/`confidence`/`updated_at`/`row_version`.
Run, in separate cases: `proposeAlignment` → `acceptAlignment`; `proposeAlignment`
→ `rejectAlignment`; `proposeAlignment` → `acceptAlignment` → `removeAlignment`.
After **every single command**, re-`SELECT *` both the source and target Objective
rows and assert **full-row equality** (not just the two named columns — this
catches an accidental touch of ANY other Objective column too, the same
"provably never mutates" discipline OKR-E002's own DoD checklist used for
`okr_vnext_set_versions` vs. `okr_vnext_approved_snapshots`).

**Layer 4 — DB introspection proof** (same realDB test file or a sibling): query
`information_schema.triggers WHERE event_object_table = 'okr_vnext_objectives'`
and assert the result set contains no trigger whose `action_statement`/`trigger_name`
references `okr_vnext_alignments` — scoped to "no alignment-related trigger"
rather than "zero triggers total" so this assertion does not spuriously break if
an unrelated future feature (e.g. an `updated_at`-touch trigger) is added to
`okr_vnext_objectives` for a reason that has nothing to do with alignment.

**Why four layers and not one**: Layer 1 (DDL) proves nothing was wired at the
database level. Layer 2 (static) proves nothing was wired at the command level,
and — critically — is the layer that keeps working even if a FUTURE epic
(OKR-E006/E007, or a careless edit to `okrAlignmentCommands.ts` itself) tries to
add "just one quick progress bump on accept" — it fails CI immediately, before a
realDB test even runs. Layer 3 (realDB) is the literal, undeniable proof the AC
asks for. Layer 4 (introspection) catches the one channel none of the other three
layers can see: a trigger added directly via a migration that never goes through
`okrAlignmentCommands.ts` at all.


## (C) Cycle-boundary rules

**Resolved from ACs**: OKR-F-016-AC-01 states "Cykle w grafie odrzucane na poziomie
komendy; cross-cycle/cross-org niezgodność failuje walidację" and plan §6 says
"cycle and organization compatibility validated." Neither source spells out the
EXACT compatibility rule (same `cycle_id` literally? same `program_id` but any
cycle? any cycle at all as long as same org?) — this is a genuine ambiguity the AC
text does not pin down, flagged in §16.

**This design's chosen interpretation** (stated explicitly, not silently assumed,
per this program's convention): **same `organization_id` AND same `cycle_id`**,
where each Objective's `cycle_id` is resolved transitively via its owning Set
(`okr_vnext_objectives.set_id → okr_vnext_sets.cycle_id`). Rationale: D08 defines
`OKR Set = Cycle + scope + owner` — different-scope Sets (company/BU/team/individual)
within one org normally run CONCURRENTLY under the SAME Cycle (that is how OKR
cascade practice works — a company's Q1 objectives align against team Q1 objectives,
not against a team's Q3 objectives from a different Cycle). Same-`cycle_id` also
transitively guarantees same-`program_id`, since `okr_vnext_cycles.program_id` is a
single FK (OKR-E001 §4 DDL) — no separate program-compatibility check is needed.
Same-`organization_id` is trivial tenant isolation, non-negotiable regardless of
cycle.

**Cross-Program alignment**: rejected as a consequence of the same-cycle rule
(a Cycle belongs to exactly one Program). Given OKR-E001 P7 established "at most one
ACTIVE Program per org," a cross-Program alignment would only be theoretically
reachable by referencing a Cycle under a retired/suspended Program — already
excluded because that Cycle's Objectives would not normally be open for new
alignment proposals in the first place (out of scope to re-verify here; OKR-E003/
E004 govern whether closed/archived Cycles' Objectives can receive NEW alignment
proposals at all — flagged in §16).

**Cross-Cycle alignment — the flagged tension**: OKR-E001's `okr_vnext_programs`
carries an `annual_direction_enabled` flag (§4 DDL), which strongly implies the
product intends SOME notion of annual direction-setting Objectives that quarterly
Cycles' Objectives align against — i.e., a genuinely different Cycle than the
quarterly one. This design's strict same-`cycle_id` rule may be **too strict** for
that specific case and is flagged as a real open question (§16) requiring
confirmation once OKR-E003/E004's cadence model is actually built — not resolved
here, since inventing a special-case "annual direction Cycle" exception without any
AC or landed schema to back it would be exactly the kind of fabricated scope this
program's decision discipline exists to prevent.

**Enforcement mechanism**: both a DB-level `CHECK (source_cycle_id = target_cycle_id)`
(see (A) DDL) AND a command-layer pre-check before the INSERT is attempted (fail
fast with a named error rather than surfacing a raw `23514` CHECK-violation code to
the API caller) — same "guard before write, not just let the DB reject it" posture
`createCycle`'s `OkrCycleProgramNotActiveError` pre-check uses (OKR-E001 §6.4).

```typescript
export class ObjectiveAlignmentCycleMismatchError extends Error {
  code = 'CYCLE_MISMATCH';
  constructor(sourceCycleId: string, targetCycleId: string) {
    super(`Objective alignment rejected: source Cycle ${sourceCycleId} does not match target Cycle ${targetCycleId}`);
    this.name = 'ObjectiveAlignmentCycleMismatchError';
  }
}
```


## (D) Graph cycle detection

**AC-mandated: prevention, not tolerance.** OKR-F-016-AC-01: "Cykle w grafie
odrzucane na poziomie komendy" — cycles are REJECTED at the command level, full
stop; not logged-and-tolerated, not a warning. Ledger's Command/query/API cell for
this AC: "j.w. (walidacja przy create)" — **validation happens at CREATE
(`proposeAlignment`) time**, not deferred to accept time (contrast OKR-F-015, whose
own cell literally says "guard w accept" — that guard is the no-mutation guard, a
DIFFERENT check, discussed in (B); it is not evidence that cycle detection also
runs at accept time).

**Algorithm — general graph reachability, not a single-parent chain walk.**
`managementChainMaintenance.ts`'s `assertNoManagementChainCycle` is the direct named
precedent, but its algorithm (walk ONE current `manager_id` pointer upward) only
works because management chain is a strict single-parent TREE. Alignment is a
many-to-many DAG (§(A)) — an Objective can have multiple outgoing AND incoming
edges — so the check must be genuine reachability: **before inserting
`source→target`, ask "can `target` already reach `source` via existing `accepted`
edges?"** If yes, adding `source→target` would close a cycle
(`source→target→...→source`). Only `status='accepted'` edges count as real graph
edges for this purpose — a `proposed` (not-yet-agreed) edge is not yet a live
contribution relationship and must not be treated as blocking a DIFFERENT proposal
from being submitted (though it WILL be checked again, see below, before it can
itself become `accepted`).

```sql
-- Bounded-depth recursive CTE, same defensive-bound philosophy as
-- managementChainMaintenance.ts's orgSize-hop cap (guards against a
-- pre-existing corrupted cycle looping forever, and against pathological
-- fan-out). maxDepth chosen generously (see (F) for reasoning); this is a
-- READ, not a write, so it runs inside the same transaction as the
-- candidate INSERT, before it, and throws if any row is returned.
WITH RECURSIVE reachable AS (
  SELECT target_objective_id AS objective_id, 1 AS depth
    FROM okr_vnext_alignments
   WHERE source_objective_id = $1  -- candidate target
     AND status = 'accepted'
     AND organization_id = $3
  UNION ALL
  SELECT a.target_objective_id, r.depth + 1
    FROM okr_vnext_alignments a
    JOIN reachable r ON a.source_objective_id = r.objective_id
   WHERE a.status = 'accepted'
     AND a.organization_id = $3
     AND r.depth < 50 -- defensive bound, not an AC-sourced number
)
SELECT 1 FROM reachable WHERE objective_id = $2 -- candidate source
LIMIT 1;
```

If this query returns a row, `target` can already reach `source` — inserting
`source→target` would close a cycle. Reject with:

```typescript
export class ObjectiveAlignmentCycleDetectedError extends Error {
  code = 'CYCLE_DETECTED';
  constructor(sourceObjectiveId: string, targetObjectiveId: string) {
    super(`Aligning Objective ${sourceObjectiveId} to ${targetObjectiveId} would create a cycle in the accepted alignment graph`);
    this.name = 'ObjectiveAlignmentCycleDetectedError';
  }
}
```

**Design addition beyond the literal AC cell, stated explicitly (not silent)**:
this design ALSO re-runs the identical reachability check inside `acceptAlignment`
(not just `proposeAlignment`), as defense against a genuine race: two DIFFERENT
`proposed` alignments, each individually acyclic at its own propose time, could
together close a cycle once BOTH are accepted (e.g. `A→B` proposed and accepted
first; `B→C` proposed — acyclic, since only `A→B` is `accepted` at that moment;
`C→A` proposed — also acyclic at that moment; if `B→C` and `C→A` are THEN both
accepted, in either order, the second acceptance closes `A→B→C→A`). Re-checking at
accept time closes this gap at negligible extra cost (same query, same transaction
shape). This mirrors the established pattern of OKR-E001 P10 / OKR-E002 D15 —
additions beyond the literal ledger cell, named and justified rather than silently
assumed.


## (E) Cross-visibility reads — the genuinely hard part

**Governing rule, `04_OKR_IMPLEMENTATION_PLAN.md` §7.4, quoted verbatim**:
"unauthorized records are absent, not redacted with identifying metadata" +
"all aggregations are computed after authorization filtering." OKR-F-017-AC-01
(EPIC_LEDGER_LIVE, verbatim): "Ukryte/restricted Objectives nie przeciekają przez
węzły/liczniki/search/analytics/Teresa" — hidden/restricted Objectives leak through
NEITHER nodes NOR edge counts NOR search NOR analytics NOR Teresa.

**Why ROI-E002 D14's softer pattern does NOT transfer** ("a link is metadata about
a relationship, not a copy of the data" — link exists visibly, content hidden):
ROI's benefit-evidence link is asymmetric — the ROI Case is the confident owner of
the link, the KPI is a passively-referenced, usually-less-sensitive object, and the
LINK'S EXISTENCE itself was judged not sensitive (D14: "referencing a KPI by
id/pinned-version is not itself a content leak"). OKR alignment is symmetric — BOTH
endpoints are independently-visibility-controlled peer Objectives, and OKR-F-017's
own AC explicitly names "restricted/hidden **Objectives**" (not "restricted
alignment content") as the thing that must not leak — meaning even the FACT that a
particular hidden Objective participates in an alignment is itself the leak OKR-F-017
targets, not just its title/progress. §7.4's own "absent, not redacted" phrasing
(a general platform-wide rule, not alignment-specific) is the stricter, correct fit.

**The concrete answer to "what does a viewer see when they can see the child but
not the aligned parent"**: **Nothing about that specific edge.** It is entirely
absent from:
- the child Objective's own alignment list/detail view (no "1 hidden alignment"
  placeholder — a non-zero placeholder count is itself metadata that a hidden
  relationship exists, which OKR-F-017's "nie przeciekają przez... liczniki"
  clause forbids just as much as revealing the parent's title would);
- any "aligned to N Objectives" count/badge anywhere (Set-level, list-level,
  Teresa-context) — every such count is computed via the SAME
  authorization-filtered query as the edge list itself, never a raw
  `COUNT(*) FROM okr_vnext_alignments`;
- graph/tree views (§F) — the walk simply stops at the first invisible node in
  either direction (see §F's exact semantics);
- search/analytics/Teresa context — same rule, same underlying query function
  (no separate code path is permitted to exist per §7.4's "exports, search index,
  notifications, AI context, and audit viewers enforce the same policy").

**This applies symmetrically** — the same absence-not-redaction rule governs a
viewer who CAN see the parent but not the child (reverse direction): an "aligned
FROM N Objectives" list on the parent's own detail page never reveals the count or
existence of a hidden contributing child either.

**Why no special-casing is needed for the Owner's own edges**: an Objective's Owner
always has at least `PRIVATE`-branch access to their OWN Objective (the
`visibility_mode='PRIVATE' AND owner_user_id = $viewer` branch in
`buildVisibilityScopedCte` always matches the record's own owner regardless of its
actual configured `visibility_mode` — re-verify this against the real
`visibilityScopedQuery.ts` PRIVATE branch, which currently only matches when
`visibility_mode='PRIVATE'` literally, NOT "the owner always sees their own resource
regardless of mode" — **this is a real gap this design surfaces, not a settled
fact**, see §16). If that gap is real, an Objective Owner whose OWN Objective is
configured `RESTRICTED_ACL`/`MANAGEMENT_CHAIN` without an explicit ACL grant to
themselves could in principle fail the visibility join against their own resource —
a pre-existing platform-layer question, not something OKR-E005 can fix (out of file
ownership, same posture OKR-E002 D13 took toward `resolveScopeVisibility`'s
`SCOPE`-mode gap: named, not fixed here).

**A necessary NEW command-layer authorization check, added and stated explicitly**
(not present in any AC, but structurally required — see (H)/(J)): `proposeAlignment`
requires the caller to be the source Objective's Owner AND to currently have at
least view-visibility into the TARGET Objective (checked via a single-resource
`resolveVisibility`-shaped call, not the list-oriented CTE) — otherwise a proposer
could name a target they cannot see at all, which is nonsensical for a
"cross-functional, you pick a real target" flow. `acceptAlignment`/`rejectAlignment`
similarly re-confirms the responder (target Owner, trivially visible to themselves)
currently has view-visibility into the SOURCE Objective before allowing the
decision — guarding against the source's visibility having narrowed between
propose and accept, so a target Owner is never asked to accept/reject something they
can no longer see the content of.

## (F) Alignment views — read model

**MVP scope, plan §6's own closing line**: "MVP may show parent/contribution
relations as a **list/tree**. Interactive organization graph is **V2**." — i.e. this
epic's read surface is deliberately modest.

**No materialized closure table**, unlike `managementChainMaintenance.ts`'s
`rvn_platform_management_chain_closure`. Reasoning, stated explicitly (the task
asks to "consider... whether a materialized closure table is warranted... same
reasoning may or may not apply" — it does not, for four independent reasons):
1. Management chain is a MANDATORY, single-parent-per-node TREE; every user has
   at most one current manager. Alignment is OPTIONAL, many-to-many (§A) — no
   forced tree purity (§6) — a fundamentally different, sparser graph shape.
2. The management-chain closure is queried by the CORE `visibilityScopedQuery.ts`
   CTE's `MANAGEMENT_CHAIN` branch — i.e. on essentially every list/search/export
   read across ALL THREE domains (KPI/ROI/OKR). Alignment reads are a narrow,
   OKR-specific, comparatively rare surface (a handful of detail-page/tree views),
   not a hot path shared platform-wide.
3. §6/§19 explicitly defer the interactive organization graph to V2 — building a
   whole closure-maintenance subsystem (`managementChainMaintenance.ts` is ~400
   lines with its own cycle-protection algorithm) now, for a feature not even
   scheduled for this program's next phase, is disproportionate scope.
4. Cycle prevention (§D) already makes the accepted-edge graph acyclic by
   construction going forward, so a bounded recursive CTE is cheap and safe — no
   risk of unbounded recursion from a legitimate write (only from pre-existing
   corrupted data, defensively bounded the same way `assertNoManagementChainCycle`
   bounds its own walk).

**Read functions** (`okrAlignmentRepository.ts`):

- `listAlignmentsForObjective(objectiveId, direction: 'outgoing'|'incoming', status?)`
  — direct edges only (one hop), ABAC-filtered (§G). Powers the MVP list/tree view.
- `getAlignmentTreeUnderObjective(rootObjectiveId, maxDepth = 6)` — bounded
  recursive CTE walking `target_objective_id → source_objective_id` edges
  ("who contributes to me, and who contributes to them...", i.e. the "everything
  aligned under the company Objective" read the task names). `maxDepth = 6` is an
  arbitrary, generously-sized default (individual→team→BU→division→company plus
  slack), NOT sourced from any AC — flagged in §16 as a reasonable default
  requiring no Founder sign-off but worth surfacing.

  **Visibility pruning semantics, stated precisely**: the walk PRUNES AT EACH
  RECURSION STEP, not only at the end — the recursive term's join against
  `rvn_visible_resources` happens INSIDE the recursive CTE, not as a final `WHERE`
  filter over an already-fully-materialized traversal. If the immediate next node
  in either direction is invisible to the current viewer, **the walk stops at that
  edge** — it does NOT skip the invisible node and continue to reveal a
  visible-but-more-distant ancestor/descendant beyond it. Rationale: revealing
  "grandparent visible, parent invisible" would itself leak that a hidden
  intermediate node exists (an inference leak) and would misrepresent the graph's
  true shape (falsely implying direct alignment). The visible subtree a viewer sees
  is exactly the maximal CONNECTED visible region reachable without ever crossing
  through a hidden node — this is the one design choice in this document with no
  directly-quotable AC text behind the "stop, don't skip" specific behavior
  (§7.4's "absent, not redacted" supports it strongly but doesn't spell out the
  multi-hop case explicitly) — flagged in §16 as the strictest defensible reading,
  not a proven requirement.

## (G) Visibility mechanics + the mandatory `::text` cast

`okr_vnext_alignments` does **NOT** get its own `rvn_platform_resource_visibility`
row and does **NOT** get its own `RVN_RESOURCE_TYPES` entry (no `'okr_alignment'`
value). Precedent considered and adapted, not copied: `kpiInitiativeImpactCommands.ts`
(KPI-E005)'s `rvn_kpi_initiative_impacts` also has no own ABAC row, "it inherits
visibility from `kpi_id`" — but that table has exactly ONE owning parent. Alignment
has TWO peer owners (source + target Objective) with potentially DIFFERENT
visibility, so the correct adaptation is: **visibility is derived at READ time as
the AND of both endpoints' visibility**, never stored or independently settable on
the edge itself (there is no "make this alignment more/less visible than its
Objectives" control anywhere in the ACs, and inventing one would be fabricated
scope).

**Every alignment read query** uses ONE `buildVisibilityScopedCte({userId,
organizationId, resourceType:'okr_objective'})` call, then joins the SAME CTE
instance TWICE — once per endpoint:

```sql
WITH rvn_visible_resources(resource_type, resource_id) AS ( ... )  -- from buildVisibilityScopedCte
SELECT a.*
  FROM okr_vnext_alignments a
  JOIN rvn_visible_resources vis_source
    ON vis_source.resource_type = 'okr_objective'
   AND vis_source.resource_id = a.source_objective_id::text
  JOIN rvn_visible_resources vis_target
    ON vis_target.resource_type = 'okr_objective'
   AND vis_target.resource_id = a.target_objective_id::text
 WHERE a.organization_id = $1
   AND a.status = 'accepted'
   -- caller's own filters start at $4 (VISIBILITY_CTE_PARAM_COUNT + 1)
```

**The mandatory `::text` cast, called out explicitly per the task's instruction**:
`rvn_platform_resource_visibility.resource_id` is `TEXT`;
`okr_vnext_alignments.source_objective_id`/`target_objective_id` (and
`okr_vnext_objectives.objective_id`, once it exists) are `UUID`. **Every join above
casts `::text` on both sides of the JOIN** — this exact class of bug (forgetting the
cast) is documented in `OKR_E002_DESIGN.md` §7 as "the single most-repeated real bug
in this program... missed 7 times in one KPI epic." A dedicated realDB test
(`okrAlignmentVisibilityJoin.realdb.test.ts`, mirroring OKR-E002's own
`okrSetVisibilityJoin.realdb.test.ts`) must exist before shipping, exercising
OPEN_ORG/SCOPE/MANAGEMENT_CHAIN/PRIVATE/RESTRICTED_ACL on BOTH endpoints
independently (both visible / source hidden / target hidden / both hidden — 4×5
combinations minimum is excessive; the required minimum is: both-visible-appears,
source-hidden-absent, target-hidden-absent, both-hidden-absent — 4 cases per
visibility-mode pairing that actually differs in behavior).

**★ Hard, blocking dependency, restated from §6 above**: this entire section
requires `'okr_objective'` to already be a member of `RVN_RESOURCE_TYPES`
(`resourceTypes.ts`) — confirmed via direct grep that it is **not** there today
(only `kpi`, `roi_case`, `okr_set`, `deviation_case`, `kpi_scorecard`). OKR-E003 must
register it (and its own `CanonicalObjectTypeValues` counterpart, and write a
`rvn_platform_resource_visibility` row per Objective at creation, mirroring
`createOkrSet`'s own `'okr_set'` row) before ANY of OKR-E005's read-side code can
run without throwing. This must be re-verified against actually-landed OKR-E003
code — not assumed — before implementation (§16).


## (H) API surface (`server/src/routes/resultsVnext/okr.routes.ts`, extended)

Ledger's literal Command/query/API cells name only `POST .../objectives/:id/alignments`
and `DELETE .../alignments/:alignmentId` plus a bare `GET` for list/graph — the
accept/reject split is implied by the 4-state status enum but not given its own
literal route name anywhere in the source docs. Filled in explicitly here (stated,
not silent — same posture as OKR-E001 P10/OKR-E002 D15/D19):

| Method | Path | Command/Repository | Auth |
|---|---|---|---|
| `POST` | `/objectives/:objectiveId/alignments` | `proposeAlignment` | Objective Owner (source) |
| `POST` | `/alignments/:alignmentId/accept` | `acceptAlignment` | target Objective Owner |
| `POST` | `/alignments/:alignmentId/reject` | `rejectAlignment` | target Objective Owner |
| `DELETE` | `/alignments/:alignmentId` | `removeAlignment` | source or target Objective Owner (§16 open) |
| `GET` | `/objectives/:objectiveId/alignments` | `listAlignmentsForObjective` (`?direction=outgoing\|incoming&status=`) | ABAC (both endpoints visible) |
| `GET` | `/objectives/:objectiveId/alignment-tree` | `getAlignmentTreeUnderObjective` (`?maxDepth=`) | ABAC (pruned walk) |

Every mutating route requires the caller to already be authenticated/org-scoped
(`requireOrgAccess()`), with the specific Owner check performed INSIDE the command
(consistent with how `approveOkrSet`'s self-approval denial is a command-layer
check, not a route-middleware check, per OKR-E002 §4.5) — not a coarse RBAC role
gate, because "Objective Owner" is a per-record fact, not an org role (OKR-E001 P2's
RBAC-only posture does NOT apply here; this mirrors OKR-E002's ABAC posture instead,
per its §6 note "Sets are ABAC resources... unlike OKR-E001's Program/Cycle").

**Mount-order note** (same class of bug fixed twice in KPI, restated per convention):
`/alignments/:alignmentId` and `/alignments/:alignmentId/accept` are both dynamic
single-segment-then-literal paths — no collision risk within this epic's own routes,
but any future literal-path sub-router under `/alignments` must mount before the
bare `:alignmentId` handlers.

Validators: `server/src/validators/resultsVnextOkr.validators.ts`, extended (same
file as E001/E002, not a new file).

Error mapping: `AtomicWriteConflictError`→409, `AtomicWriteAggregateNotFoundError`→404,
`ObjectiveAlignmentValidationError`→409 (self-loop, wrong status transition),
`ObjectiveAlignmentCycleMismatchError`→409, `ObjectiveAlignmentCycleDetectedError`→409,
`ObjectiveAlignmentVisibilityDeniedError`→403 (target/source not viewable at
propose/accept time), Zod→400, ACL/Owner-check failure→403, unknown→500.

## (I) File list (backend only)

**New:**
- `server/migrations/<date>_rvn_okr_alignment.sql`
- `server/src/services/resultsVnext/okr/okrAlignmentTypes.ts`
- `server/src/services/resultsVnext/okr/okrAlignmentCommands.ts` (`proposeAlignment`,
  `acceptAlignment`, `rejectAlignment`, `removeAlignment`, `assertNoAlignmentCycle`,
  + error classes: `ObjectiveAlignmentValidationError`,
  `ObjectiveAlignmentCycleMismatchError`, `ObjectiveAlignmentCycleDetectedError`,
  `ObjectiveAlignmentVisibilityDeniedError`)
- `server/src/services/resultsVnext/okr/okrAlignmentRepository.ts`
  (`listAlignmentsForObjective`, `getAlignmentTreeUnderObjective` — ABAC-scoped, both
  endpoints joined per (G))
- `tests/resultsVnext/okr/okrAlignmentCreate.realdb.test.ts` (dedupe-slot race,
  self-loop rejection, propose-time target-visibility check)
- `tests/resultsVnext/okr/okrAlignmentCycleDetection.realdb.test.ts` (direct 2-node
  cycle, transitive 3+-node cycle, race between two concurrently-proposed edges
  closing a cycle only once both accepted — the accept-time re-check's own proof)
- `tests/resultsVnext/okr/okrAlignmentCycleBoundary.realdb.test.ts` (cross-cycle
  rejection via the DB CHECK, cross-org rejection)
- `tests/resultsVnext/okr/okrAlignmentVisibilityJoin.realdb.test.ts` (`::text` cast
  on both endpoints, both-visible/source-hidden/target-hidden/both-hidden, break-glass
  Auditor branch)
- `tests/resultsVnext/okr/alignmentNoScoreMutation.static.test.ts` (Layer 2 of (B))
- `tests/resultsVnext/okr/alignmentNoScoreMutation.realdb.test.ts` (Layers 3+4 of (B))
- `tests/resultsVnext/okr/okrAlignmentLifecycle.realdb.test.ts` (propose/accept/
  reject/remove transitions, dedup-slot-freed-on-reject/removed)
- `server/src/routes/resultsVnext/__tests__/okr.routes.test.ts` (extended)

**Changed:**
- `server/src/routes/resultsVnext/okr.routes.ts` — 6 new routes
- `server/src/validators/resultsVnextOkr.validators.ts` — new schemas
- `server/src/services/resultsVnext/platform/atomicWrite.ts` — new events
  (`okr_alignment.proposed`, `.accepted`, `.rejected`, `.removed`), all →
  `['mywork_projection']` per this program's default fan-out
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` / `EXECUTION_LEDGER.md` —
  closure entry, restating every open question in §16 explicitly, not silently
  dropped (same discipline OKR-E002's own DoD checklist required for D13/D17)

**Read-only reference (re-read for exact current signatures at implementation
time — mandatory, per OKR-E002 D20's standing rule):**
- `server/src/services/resultsVnext/okr/okrSetCommands.ts` (SAVEPOINT dedupe
  pattern, row_version CAS, error-class-per-aggregate convention)
- `server/src/services/resultsVnext/okr/okrCycleCommands.ts` (generic lifecycle
  transition helper shape, fail-closed pre-check pattern)
- `server/src/services/resultsVnext/platform/managementChainMaintenance.ts`
  (cycle-protection algorithm shape, service-layer-not-trigger precedent)
- `server/src/services/resultsVnext/platform/visibilityScopedQuery.ts`
  (`buildVisibilityScopedCte`/`wrapWithVisibilityScope`, `::text` cast contract)
- `server/src/services/resultsVnext/platform/resourceTypes.ts` (confirm
  `'okr_objective'` has actually been added by OKR-E003 before writing any query
  against it)
- `server/migrations/20260816_rvn_roi_economic_model.sql` (`rvn_roi_benefit_evidence_links`
  — typed non-propagating reference shape)
- `server/src/services/resultsVnext/kpi/kpiInitiativeImpactCommands.ts`
  (single-parent-inherits-visibility precedent, contrast case for why alignment
  needs the double-join instead)
- `tests/resultsVnext/teresa-kpi-forbidden-verbs.test.ts` (static-proof test
  template for (B) Layer 2)
- OKR-E003's `okrObjectiveCommands.ts`/`okrKeyResultCommands.ts` — **UNVERIFIED,
  does not exist in this worktree**, must be read in full once it lands; every
  function/column name this document references from it is a placeholder inferred
  from EPIC_LEDGER_LIVE's prose only

## (J) Open questions — genuine ambiguity, not resolved by guessing

1. **★★★ Blocking**: OKR-E003 (Objectives/KRs) and OKR-E004 (Check-ins) have no
   frozen design doc AND no landed code anywhere in this worktree (confirmed by
   direct grep — zero `okr_vnext_*` hits in `server/src` or `server/migrations`,
   `RVN_RESOURCE_TYPES` still lacks even `'okr_program'`/`'okr_cycle'` despite
   OKR-E001's own "FROZEN DESIGN" header). Every table/column name this document
   uses for `okr_vnext_objectives` (`objective_id`, `set_id`, `progress`,
   `confidence`) is sourced only from `EPIC_LEDGER_LIVE.md`'s prose cells, not from
   any DDL. **Nothing in this document can be implemented until OKR-E001 through
   E004 actually land and this design is re-verified against their real code.**
2. **Relation type scope**: only `contributes_to` has any AC/plan backing. The task
   brief's own "supports/depends-on?" phrasing is NOT sourced from any document
   read in this pass — do not build additional relation types without a new
   Founder decision.
3. **Cross-cycle compatibility rule** (§C): this design infers "same `cycle_id`"
   from §6's terse "cycle... compatibility validated," but OKR-E001's
   `annual_direction_enabled` Program flag hints at an intentional cross-cadence
   (annual↔quarterly) alignment use case this design's strict rule would block.
   Needs Founder/OKR-E003 confirmation once the cadence model is concrete.
4. **Self-accept**: this design permits the SAME person to accept their own
   proposed alignment (source Owner == target Owner) with no maker-checker gate,
   reasoned from "alignment never touches score, so it isn't 'material' in D11's
   sense" — not confirmed by any AC or plan §7.3 text (which does not mention
   alignment at all in its maker-checker list). A considered default, not a proven
   requirement.
5. **`removeAlignment` authority**: EPIC_LEDGER_LIVE's Roles/visibility cell for
   OKR-F-014 names only "Objective Owner (propose), target Owner (accept/reject)" —
   who may REMOVE an already-accepted edge is unstated. This design defaults to
   "either endpoint's Owner may unilaterally remove," unconfirmed.
6. **Propose-time target-visibility requirement** (§E): this design requires the
   proposer to have at least view-visibility into the target Objective before
   `proposeAlignment` succeeds — a structural addition with no direct AC backing,
   likely a no-op in practice since D10's OKR default is `OPEN_ORG`, but could
   over-restrict a legitimate cross-functional proposal against a genuinely
   `SCOPE`/`MANAGEMENT_CHAIN`-restricted target. Needs confirmation.
7. **Accept-time source-re-visibility requirement** (§E): symmetric addition —
   re-confirming the target Owner can still see the source at accept time. Same
   "structural addition, not AC-sourced" caveat.
8. **MyWork obligation** (`review_alignment_proposal`, assigned to target Owner on
   propose): `createObligation`'s `obligation_type` parameter is free-text (no
   enum found in `platform/obligations.ts` on direct read), so this is low-risk to
   introduce, but it is a design ADDITION with no literal AC/plan-§13 backing
   located in this pass (plan §11's event list mentions "alignment" among required
   EVENTS generically, not a named MyWork obligation) — flag for confirmation, not
   silently assumed.
9. **Strict "absent, no soft hint" vs. product UX** (§E/§F): this design takes the
   strictest defensible reading of §7.4 ("absent, not redacted... no metadata
   leak") — zero disclosure that a hidden alignment exists at all, anywhere,
   including counts. A real OKR product might reasonably want a soft "some
   alignments are not visible to you" hint. Not resolved here; flagged as a
   genuine product-vs-security tension for the Integration Owner to weigh in on.
10. **`buildVisibilityScopedCte`'s PRIVATE-branch owner-bypass gap** (§E): the
    CTE's `PRIVATE` branch only matches when `visibility_mode='PRIVATE'` literally
    — it is NOT self-evidently true (not verified in this pass) that an Objective's
    Owner always sees their OWN Objective regardless of its configured mode (e.g.
    `RESTRICTED_ACL` without an explicit self-grant). If that gap is real, it is a
    pre-existing platform-layer issue (`visibilityScopedQuery.ts`), out of this
    epic's file ownership to fix — named here, not silently worked around.
11. **`maxDepth = 6`** for the alignment-tree walk (§F) is an arbitrary,
    AC-unsourced default. Low-stakes, but worth a Founder/product sanity check
    against real org depth once OKR-E003's scope model (company/BU/team/individual
    — 4 levels) is confirmed; 6 was chosen with slack above the 4 known scope
    levels, not derived from any spec number.
12. **Whether closed/archived Cycles' Objectives can receive NEW alignment
    proposals** — not addressed by any AC read in this pass; likely "no" by
    analogy with other domains' closed-state write-guards, but not confirmed.

---

## Definition of done (draft — for Integration Owner to ratify alongside the rest)

- [ ] All 6 endpoints work against real Objectives once OKR-E003 lands
- [ ] `tsc --noEmit` clean on the whole repo
- [ ] Direct + transitive cycle rejection verified against real Postgres, both at
      propose time and at the accept-time re-check (race scenario proven)
- [ ] Cross-cycle and cross-org rejection verified (DB CHECK + command-layer
      pre-check both exercised)
- [ ] `::text` cast verified on both endpoint joins; both-visible / source-hidden /
      target-hidden / both-hidden all proven absent-not-redacted
- [ ] Layers 1-4 of (B) all pass: no trigger in DDL, static import/SQL-text proof
      green, realDB full-row-equality proof green, trigger-introspection proof green
- [ ] Full existing KPI + ROI + OKR-E001..E004 test suites still green — before/after
      evidence, not a claimed number
- [ ] `EXECUTION_LEDGER.md` closure entry + `EPIC_LEDGER_LIVE.md` OKR-E005 rows updated
- [ ] All 12 open questions in §16(J) explicitly restated in the closure entry, not
      silently dropped
- [ ] **Every table/column/function name borrowed from OKR-E001/E002/E003/E004 in
      this document has been re-verified against actually-landed code before a
      single line of OKR-E005 is implemented** — this is not optional given §16
      item 1's severity.

**END OF DESIGN — awaiting Integration Owner review.**
