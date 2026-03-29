# Wave 2 Canonical Scope Map

> Date: 2026-03-29
> Owner: Manager
> Status: canonical working authority for Wave 2 planning
> Purpose: freeze the exact scope, module grouping, and ownership model for the post-Wave-1 planning package

---

## 1. Authority

This file is the canonical scope authority for the new `Wave 2` planning package.

It is derived from:

- `docs/product/work-packets/V8_EXECUTION_WAVES_NOW_LATER_2026-03-28.md`
- `docs/product/work-packets/MANAGER_FALA_1_CANONICAL_EXECUTION_MAP_2026-03-28.md`
- `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`
- `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
- `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`

Interpretation rule:

- `Wave 1 ratified` does not mean `100% complete against the broad original vision`
- `bounded accepted` does not remove a module from Wave 2 if the broad product gap is still explicit
- `Wave 2` covers the modules that sit outside the active `Fala 1` execution scope or were only carried in bounded form while the broader product still remains open

---

## 2. Scope boundary

`Wave 2` is **not** a continuation of the active `16-stream` Wave 1 execution program.

`Wave 2` is the planning package for the broader product areas that remained:

- explicitly parked for later,
- only partially covered in bounded closure form,
- or documented strongly but not yet turned into a full implementation-grade execution program.

`Wave 2` therefore focuses on:

1. broad `Landing` beyond the bounded `Anna` lane
2. `Komunikacja` as a standalone product area
3. `Tools / Assessment`
4. `Help / Baza wiedzy`
5. `Program partnerski`
6. `Superadmin`
7. the full `Outputs` family
8. `Agenci / KIMI / Prompty / Palantir`
9. `Organization / Settings / Admin / Edukacja / Mobile`
10. broad `Synchronizacja` beyond its bounded accepted connector lane

Important nuance:

- `Help / Baza wiedzy` and `Program partnerski` were ratified as additional carried must-have packets in `548`, but they still belong in Wave 2 planning because the broader product breadth remains outside the original active `16-stream` scope.

---

## 3. Canonical cluster split

Wave 2 is organized into six planning clusters.

### Cluster A — Outputs And Artifact Family

Owns:

- `Outputs Library`
- `Documents`
- `Presentations`
- `Sheet`
- `ArtifactRun z czatu`
- `Object-linked outputs`
- `Notebook outputs`
- `Report -> Presentation`
- `Provenance / review / visibility`
- `Pelny Reports / Presentations builder`

### Cluster B — Entry And AI OS Expansion

Owns:

- broad `Landing`
- `Agenci / KIMI / Prompty / Palantir`

### Cluster C — Knowledge And Support Systems

Owns:

- `Help / Baza wiedzy`
- `Edukacja`

### Cluster D — Connectivity And Communication

Owns:

- `Komunikacja`
- broad `Synchronizacja`

### Cluster E — Business Enablement

Owns:

- `Tools`
- `Assessment`
- `Program partnerski`

### Cluster F — Platform Control And Reach

Owns:

- `Organization`
- `Settings`
- `Admin`
- `Superadmin`
- `Mobile`

---

## 4. Module map

| Module | Canonical Wave 2 interpretation | Cluster | Why it belongs here now | Notes |
| --- | --- | --- | --- | --- |
| `Landing` | broad public growth shell, IA, messaging, demo/trial convergence, commercial narrative | `Cluster B` | parked outside active `Anna` stream | bounded `Anna` work stays historical context only |
| `Komunikacja` | standalone communication product beyond execution-adjacent narrow flows | `Cluster D` | parked as separate product in Wave 1 | do not confuse with `Komunikacja dwukierunkowa` inside active work objects |
| `Tools` | broad consulting-tools product canon beyond bridge integration | `Cluster E` | current docs are bridge-heavy and partially V3-based | keep V3 truth visible, but plan full V8 product target |
| `Assessment` | unified assessment runtime across DRD/SIRI/ADMA and adjacent tooling | `Cluster E` | still lacks one full `Assessment v8` execution package | may reference tool standards and bridge docs |
| `Help / Baza wiedzy` | Teresa-led help, KB, contextual support, knowledge content, enablement entry | `Cluster C` | carried must-have accepted, broader product still open | treat bounded closeout as current truth, not final breadth |
| `Program partnerski` | full ecosystem product including portal, growth, enablement, directory, ops | `Cluster E` | carried must-have accepted, broader parity remains | use bounded closeout as baseline, not end-state |
| `Superadmin` | cross-domain platform operator layer | `Cluster F` | bounded admin/operator closure exists, broad superadmin still partial | keep tenant admin vs superadmin boundary explicit |
| `Outputs Library` | canonical artifact discovery and operations surface | `Cluster A` | explicit later program and still a broad product surface | must not create a second shell |
| `Documents` | governed durable document runtime | `Cluster A` | exists strongly, not yet planned as full Wave 2 family member | shares lifecycle with presentation and sheet |
| `Presentations` | governed durable presentation runtime | `Cluster A` | strong runtime and docs, still broad product gap vs full family closure | do not rewrite existing engine casually |
| `Sheet` | third governed artifact class and workbook path | `Cluster A` | explicit 8.2 gap and broad product target remains | split bounded governed path from spreadsheet-suite ambition |
| `ArtifactRun z czatu` | chat-first planning, execution, materialization, rerun, traceability spine | `Cluster A` | core part of artifact-native operating model | treat as spine, not separate shell |
| `Object-linked outputs` | object surfaces reading the same artifact truth | `Cluster A` | partial coverage remains across modules | especially interview and residual source-object surfaces |
| `Notebook outputs` | notebook-native output creation, readback, reopen and linkage | `Cluster A` | strong bounded packets landed, broader product-level definition still needed | must remain registry-backed |
| `Report -> Presentation` | deterministic cross-format promotion and reuse workflow | `Cluster A` | explicit later-scope item | keep narrow and explicit as workflow, not vague idea |
| `Provenance / review / visibility` | traceability, review queues, export truth, access semantics | `Cluster A` | cross-cutting doctrine exists, execution package still needed | not a standalone app; a cross-cutting layer |
| `Pelny Reports / Presentations builder` | office-style authoring/composition/editing product | `Cluster A` | broad gap remains beyond current bounded closures | separate from the library and registry work |
| `Agenci / KIMI / Prompty / Palantir` | user-facing AI operating system, prompt OS, multi-agent work, governed knowledge truth | `Cluster B` | broad product family remains explicitly open | split internally into prompt OS, agent UX, knowledge truth |
| `Organization` | tenant-facing organization intelligence and lifecycle layer | `Cluster F` | partial coverage only, no full V8 canon | must not collapse into legacy admin docs |
| `Settings` | coherent settings layer for user/org/policy/profile control | `Cluster F` | lacks one modern V8 package | distinguish tenant settings from platform config |
| `Admin` | tenant-facing admin and team operations layer | `Cluster F` | partial coverage and legacy-heavy | keep separate from platform-operator branch |
| `Edukacja` | standalone learning/enablement product beyond embedded help | `Cluster C` | explicit doc gap and deferred branch | may be attached to KB, but stays visible as module card |
| `Mobile` | mobile scope, parity targets, explicit non-goals | `Cluster F` | explicit missing package and deferred area | scope statement first, then execution |
| `Synchronizacja` | broad enterprise sync and provider-depth program | `Cluster D` | bounded sync lane accepted, broad provider product still open | includes OAuth round-trip, connect completion, provider depth |

---

## 5. Ownership rules

Each cluster brief owns its modules.

Each module also gets its own module card.

The ownership model is:

- cluster brief owns the planning logic across related modules,
- module card owns the concrete truth for one named module,
- master implementation order owns sequencing across clusters,
- no cluster may absorb another cluster's module just because the runtime is connected.

---

## 6. Required module-card set

Wave 2 must produce one standalone module card for each of the following:

1. `Landing`
2. `Komunikacja`
3. `Tools`
4. `Assessment`
5. `Help / Baza wiedzy`
6. `Program partnerski`
7. `Superadmin`
8. `Outputs Library`
9. `Documents`
10. `Presentations`
11. `Sheet`
12. `ArtifactRun z czatu`
13. `Object-linked outputs`
14. `Notebook outputs`
15. `Report -> Presentation`
16. `Provenance / review / visibility`
17. `Pelny Reports / Presentations builder`
18. `Agenci / KIMI / Prompty / Palantir`
19. `Organization`
20. `Settings`
21. `Admin`
22. `Edukacja`
23. `Mobile`
24. `Synchronizacja`

---

## 7. Explicit non-goals of this scope map

This file does not:

- define the final build order,
- decide exact packet count per module,
- rewrite Wave 1,
- or declare any module green.

It only freezes:

- what is in scope,
- how it is grouped,
- and which module cards must exist before execution planning begins.

---

## 8. Final rule

If any later Wave 2 document:

- drops one of the modules listed above,
- hides a module inside a vague cluster label,
- or treats bounded Wave 1 acceptance as equivalent to full product completion,

that later document is invalid and must be corrected.
