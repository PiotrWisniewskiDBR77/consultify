# Final V8 Master Plan (Wave 1 + Wave 2 + cross-cutting V8)
Date: 2026-03-29  
Owner: Program (Product + Engineering)  
Scope: one master index and execution order for all active modules in **Wave 1** and **Wave 2**, plus a small set of cross-cutting V8 modules explicitly called out in the current program review (Chat history + Knowledge/RAG).

---

## 1. Why this document exists

We already have:

- Wave 1: closure-grade completion across its bounded scope, plus per-module final implementation plans.
- Wave 2: a complete final implementation planning package (scope, briefs, module cards, gap backlog, master order, per-module plans).

What we still need operationally is:

- one **single open list** of modules we are working through,
- one **manager index** that points to the exact per-module plan,
- one consistent rule that a module is only considered **done** after: **scope approval + full execution + evidence**.

This file is that master index — updated to match the latest program re-grouping notes.

---

## 2. Authority chain (what wins in conflicts)

Canonical registry / truth:

- `docs/product/DOCUMENTATION_REGISTRY.md` (canonical vs snapshot classification)

Wave 1:

- `docs/product/work-packets/MANAGER_FALA_1_CANONICAL_EXECUTION_MAP_2026-03-28.md` (Wave 1 scope boundary)
- `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_MASTER_AUDIT_2026-03-29.md` (closed vs complete vs market fit)
- `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_MASTER_PLAN_2026-03-29.md` (Wave 1 execution order)
- `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_GAP_BACKLOG_2026-03-29.md` (Wave 1 gap backlog)

Wave 2:

- `docs/product/work-packets/wave-2/WAVE_2_CANONICAL_SCOPE_MAP.md` (Wave 2 scope boundary)
- `docs/product/work-packets/wave-2/WAVE_2_MASTER_IMPLEMENTATION_ORDER.md` (Wave 2 dependency order SSOT)
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_MASTER_AUDIT_2026-03-29.md` (baseline vs completeness)
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_MASTER_PLAN_2026-03-29.md` (Wave 2 execution-grade framing)
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_GAP_BACKLOG_2026-03-29.md` (Wave 2 gap backlog)

Cross-cutting V8 (non-wave, but actively referenced in the current program review):

- `docs/product/CHAT_V8_IMPLEMENTATION_PLAN.md`
- `docs/product/CHAT_V8_HISTORY_AND_LIBRARY_MODEL.md`
- `docs/product/KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md`

---

## 3. Program doctrine (the rule that keeps us honest)

### 3.1 “Closed” is not “Complete”

- **Wave 1** is formally **closed** (bounded lanes).
- This master plan is about **final implementation readiness and completeness**, not retroactively disputing closure.

### 3.2 Per-module definition of done

For each module in this plan:

- **Scope approved**: we explicitly accept the module plan’s scope + non-goals as the module’s deliverable contract.
- **Executed fully**: work is done against that contract (no silent scope drift).
- **Evidence complete**: tests, staging proof, and/or explicit evidence packets exist as defined by the module plan.

If any of the above is missing, the module is not considered done.

---

## 4. One combined execution order (Wave 1 + Wave 2 + cross-cutting)

We combine the waves into one program order by dependency and trust. This section is aligned to the re-grouping notes captured in the program review (the “newly described list”).

### Phase 0 — Cross-cutting: Chat continuity and “chat wisdom”

Rationale: these are cross-cutting foundations referenced as active work items in the current program review list.

0. `Historia czatów` (Chat history & library)
1. `Mądrość czata` (Knowledge/RAG / durable retrieval-backed memory)

### Phase 1 — Wave 1 structural trust and runtime coherence (P0-first)

Rationale: these are the highest-risk structural gaps that weaken day-to-day believability.

1. `Integracja`
2. `Kalendarz`
3. `Wdrożenia`
4. `KPI`
5. `Finanse`

### Phase 2 — Wave 1 operational usefulness and guided continuity

6. `Radar`
7. `Notatki`
8. `Teresa`
9. `Ankiety`
10. `Wnioski w Interview`
11. `Inicjatywy`

### Phase 3 — Wave 1 workspace-tool product quality

12. `Mind map`
13. `Whiteboard`
14. `Proces flow`
15. `Tabele`

### Phase 4 — Wave 1 commercial-strengthening layer

16. `Anna`

### Phase 5 — Outputs spine (chat → run → trust → library → formats)

Rationale: artifact truth is the most shared cross-module truth; we treat it as one spine:

- `ArtifactRun z czatu` (chat drives governed runs),
- `Provenance / review / visibility` (trust grammar),
- `Outputs Library` (one canonical home),
- and then format-specific surfaces (presentations, reports/documents, sheets, templates).

17. `ArtifactRun z czatu`
18. `Provenance / review / visibility`
19. `Outputs Library`
20. `Prezentacje` (maps to Wave 2 `Presentations`)
21. `Raporty` (maps to Wave 2 `Documents`)
22. `Wordy` (currently treated as the same delivered “document artifact” lane as `Raporty` unless separately split)
23. `Excele` (maps to Wave 2 `Sheet`)
24. `Templaty` (maps to Wave 2 templates inside `Reports/Presentations builder` scope)

Note:

- The Wave 2 artifact-family modules `Object-linked outputs`, `Notebook outputs`, `Report -> Presentation`, and `Pelny Reports / Presentations builder` remain in Wave 2 scope, but in the current program review list they are treated as secondary follow-ups behind the spine and core format lanes.

### Phase 6 — Wave 2 (Cluster B) Entry and AI OS expansion

27. `Landing`
28. `Agenci / KIMI / Prompty / Palantir`

### Phase 7 — Wave 2 (Cluster C) Knowledge and support systems

29. `Help / Baza wiedzy`
30. `Edukacja`

### Phase 8 — Wave 2 (Cluster E) Business enablement

31. `Tools`
32. `Assessment`
33. `Program partnerski`

### Phase 9 — Wave 2 (Cluster D) Connectivity and communication

34. `Synchronizacja`
35. `Komunikacja`

### Phase 10 — Wave 2 (Cluster F) Platform control and reach

36. `Organization`
37. `Settings`
38. `Admin`
39. `Superadmin`
40. `Mobile`

---

## 5. Master module index (Wave 1)

All Wave 1 modules **already have** a per-module final implementation plan file.

| Order | Module | Detailed implementation plan | Detailed plan status |
| ---: | --- | --- | --- |
| 1 | `Integracja` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_INTEGRACJA_2026-03-29.md` | present |
| 2 | `Kalendarz` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_KALENDARZ_2026-03-29.md` | present |
| 3 | `Wdrożenia` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_WDROZENIA_2026-03-29.md` | present |
| 4 | `KPI` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_KPI_2026-03-29.md` | present |
| 5 | `Finanse` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_FINANSE_2026-03-29.md` | present |
| 6 | `Radar` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_RADAR_2026-03-29.md` | present |
| 7 | `Notatki` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_NOTATKI_2026-03-29.md` | present |
| 8 | `Teresa` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_TERESA_2026-03-29.md` | present |
| 9 | `Ankiety` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_ANKIETY_2026-03-29.md` | present |
| 10 | `Wnioski w Interview` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_WNIOSKI_W_INTERVIEW_2026-03-29.md` | present |
| 11 | `Inicjatywy` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_INICJATYWY_2026-03-29.md` | present |
| 12 | `Mind map` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_MIND_MAP_2026-03-29.md` | present |
| 13 | `Whiteboard` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_WHITEBOARD_2026-03-29.md` | present |
| 14 | `Proces flow` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_PROCES_FLOW_2026-03-29.md` | present |
| 15 | `Tabele` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_TABELE_2026-03-29.md` | present |
| 16 | `Anna` | `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_ANNA_2026-03-29.md` | present |

---

## 6. Master module index (Wave 2)

All Wave 2 modules **already have** a per-module final implementation plan file.

| Order | Module | Detailed implementation plan | Module card (Wave 2) | Detailed plan status |
| ---: | --- | --- | --- | --- |
| 17 | `ArtifactRun z czatu` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_CHAT_ARTIFACTRUN_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_CHAT_ARTIFACTRUN.md` | present |
| 18 | `Provenance / review / visibility` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PROVENANCE_REVIEW_VISIBILITY_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_PROVENANCE_REVIEW_VISIBILITY.md` | present |
| 19 | `Outputs Library` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_OUTPUTS_LIBRARY_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_OUTPUTS_LIBRARY.md` | present |
| 20 | `Documents` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_DOCUMENTS.md` | present |
| 21 | `Presentations` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PRESENTATIONS_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_PRESENTATIONS.md` | present |
| 22 | `Sheet` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SHEET_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_SHEET.md` | present |
| 23 | `Object-linked outputs` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_OBJECT_LINKED_OUTPUTS_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_OBJECT_LINKED_OUTPUTS.md` | present |
| 24 | `Notebook outputs` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_NOTEBOOK_OUTPUTS_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_NOTEBOOK_OUTPUTS.md` | present |
| 25 | `Report -> Presentation` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_REPORT_TO_PRESENTATION_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_REPORT_TO_PRESENTATION.md` | present |
| 26 | `Pelny Reports / Presentations builder` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_FULL_REPORTS_PRESENTATIONS_BUILDER_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_FULL_REPORTS_PRESENTATIONS_BUILDER.md` | present |
| 27 | `Landing` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_LANDING_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_LANDING.md` | present |
| 28 | `Agenci / KIMI / Prompty / Palantir` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_AGENTS_KIMI_PROMPTS_PALANTIR_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_AGENTS_KIMI_PROMPTS_PALANTIR.md` | present |
| 29 | `Help / Baza wiedzy` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_HELP_KNOWLEDGE_BASE_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_HELP_KNOWLEDGE_BASE.md` | present |
| 30 | `Edukacja` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_EDUKACJA_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_EDUKACJA.md` | present |
| 31 | `Tools` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_TOOLS_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_TOOLS.md` | present |
| 32 | `Assessment` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ASSESSMENT_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_ASSESSMENT.md` | present |
| 33 | `Program partnerski` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PARTNER_PROGRAM_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_PARTNER_PROGRAM.md` | present |
| 34 | `Synchronizacja` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SYNCHRONIZATION_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_SYNCHRONIZATION.md` | present |
| 35 | `Komunikacja` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_COMMUNICATION_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_COMMUNICATION.md` | present |
| 36 | `Organization` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ORGANIZATION_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_ORGANIZATION.md` | present |
| 37 | `Settings` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SETTINGS_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_SETTINGS.md` | present |
| 38 | `Admin` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_ADMIN_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_ADMIN.md` | present |
| 39 | `Superadmin` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SUPERADMIN_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_SUPERADMIN.md` | present |
| 40 | `Mobile` | `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_MOBILE_2026-03-29.md` | `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_MOBILE.md` | present |

---

## 6.1 Program review mapping (new names → canonical modules / plan files)

The current program review list uses a few shorthand names. This mapping keeps the master plan consistent with the canonical Wave 2 module set:

| Program review label | Canonical module (Wave 1/2) | Plan file exists | Where |
| --- | --- | --- | --- |
| `Notatnik` | `Notatki` (Wave 1) | yes | `.../wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_NOTATKI_2026-03-29.md` |
| `Mindmap` | `Mind map` (Wave 1) | yes | `.../wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_MIND_MAP_2026-03-29.md` |
| `OutputsLibrary` | `Outputs Library` (Wave 2) | yes | `.../wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_OUTPUTS_LIBRARY_2026-03-29.md` |
| `Prezentacje` | `Presentations` (Wave 2) | yes | `.../wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PRESENTATIONS_2026-03-29.md` |
| `Raporty` | `Documents` (Wave 2) | yes | `.../wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_DOCUMENTS_2026-03-29.md` |
| `Excele` | `Sheet` (Wave 2) | yes | `.../wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_SHEET_2026-03-29.md` |
| `Templaty` | `Pelny Reports / Presentations builder` (Wave 2) | yes | `.../wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_FULL_REPORTS_PRESENTATIONS_BUILDER_2026-03-29.md` |
| `Help` + `Baza wiedzy` | `Help / Baza wiedzy` (Wave 2) | yes | `.../wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_HELP_KNOWLEDGE_BASE_2026-03-29.md` |
| `Historia czatów` | Chat v8 (cross-cutting) | yes | `docs/product/CHAT_V8_HISTORY_AND_LIBRARY_MODEL.md` + `docs/product/CHAT_V8_IMPLEMENTATION_PLAN.md` |
| `Mądrość czata` | Knowledge/RAG v8 (cross-cutting) | yes | `docs/product/KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md` |

If we later decide that `Wordy` is a separate module from `Raporty` (documents-as-reports), it requires an explicit scope split and a new dedicated per-module plan file.

## 7. Next step after this master plan

This master file is a manager index. The next program step is:

1. Pick the next module by the phase order above.
2. Read the detailed plan and explicitly approve the scope + non-goals.
3. Execute the plan fully.
4. Attach evidence links (tests, staging proof, or referenced evidence packets) to the per-module plan or the manager tracking surface.

When a module is done, we mark it as done in the manager index (a follow-up file), not by editing history or reopening scope.

