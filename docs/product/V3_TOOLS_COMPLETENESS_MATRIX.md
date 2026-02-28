# V3 Tools & Templates — Completeness Matrix (SSOT readiness)

> **Status:** Draft (v3)  
> **Goal:** one place to verify whether we have *complete source-of-truth data* to implement v3:
> - end-to-end workflow (Tools → Outputs)
> - per-tool runtime contracts
> - help/KB + AI context packs

## 1) End-to-end workflow readiness (module-level)

**Covered (SSOT exists):**

- **Tools workflow skeleton** (Library → Sessions → Outputs → Initiatives): `docs/product/CONSULTING_TOOLS_V3.md`
- **Finalization + traceability gate** (only 2 sources): `docs/product/SOURCE_TRACEABILITY_SPEC.md`
- **Reports/Presentations generators** (Gamma-like UX + templates + traceability):  
  - `docs/product/REPORT_GENERATOR_V3.md`  
  - `docs/product/PRESENTATION_GENERATOR_V3.md`  
  - `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`
- **Operating model placement** (Tools in client flow): `docs/product/OPERATING_MODEL_V3.md`

**Remaining gaps (must be authored to be “complete”):**

- **Output package mapping per tool**: for each toolType/template we need a canonical “Report section mapping” and “Deck slide mapping” (even if minimal) so generators can scaffold consistent deliverables from tool snapshots.

---

## 2) Per-tool readiness — 31 interactive toolTypes

**Source-of-truth coverage:**

- **Inventory + per-tool spec skeleton**: `docs/product/CONSULTING_TOOLS_TOOL_SPECS_V3.md`
- **Known Tools registry fields** (Library content): `server/src/services/KnownToolsService.ts`
- **DB seeds for all 31 toolTypes (Library + KB article slugs)**:
  - `server/migrations/559_tools_known_tools_library.sql` (10)
  - `server/migrations/562_tools_toolsets_speed.sql` (15)
  - `server/migrations/604_tools_missing_known_tools_library.sql` (6)

**Now true (after 604):**

- 31/31 toolTypes have:
  - `whenToUse/inputs/steps/outputs/commonMistakes/example/nextSteps` (EN+PL) in `tools.library_content_translations`
  - KB article slugs `tools-<toolType>-how-to` with EN+PL content

**Remaining gaps (content + assets):**

- **Preview graphic**: requirements exist in tool specs but graphic assets are not produced/linked in KB (`thumbnail_url` often NULL).
- **Micro-video**: scripts exist only partially; URLs are not wired (`video_url` often NULL).
- **Runtime surface contracts**: some tools still need more precise “table columns / workspace mode / validation gates” in `CONSULTING_TOOLS_TOOL_SPECS_V3.md` (many sections still minimal).

---

## 3) Per-template readiness — 60 classic frameworks (Consulting Templates)

**Source-of-truth coverage:**

- **Implementation contract** (this is the canonical place): `docs/product/CONSULTING_TEMPLATES_LIBRARY_V3.md`
- **Method + examples**: `wdrozenia/modules/tools/catalog/{strategy,operations,transformation}/`
- **Micro-video scripts**: `wdrozenia/modules/tools/catalog/movie/`

**Observed gaps in repo (must fix for “final SSOT completeness”):**

- The movie folder contains many duplicate files (`<name> 2.md`, `<name> 3.md`, etc.). The canonical set referenced by `movie/00-INDEX.md` requires **exact filenames** without suffixes.
- ✅ **Resolved (SSOT hygiene):** all canonical filenames referenced by `movie/00-INDEX.md` now exist as exact matches (no missing targets).

**Remaining gaps (system integration):**

- **Templates in Library registry**: we have the canonical list + spec, but we do not yet store template entries in the Known Tools `tools` table.
  - Decision needed: whether templates live in the same Library (as `framework_template`) or a separate Templates library tab.
- **Help/KB publishing**: canonical sources exist in repo, but KB table seeding for `templates-<slug>-how-to` is not yet implemented (optional, depending on Help UI plan).

---

## 4) “Complete SSOT” Definition of Done (for v3 readiness)

We consider SSOT complete when:

- **Workflow**: the module-level contract is explicit and points to canonical generator specs.
- **Per toolType (31)**: spec includes surface contract + DoD + initiative mapping + KB slug + asset requirements.
- **Per template (60)**: `CONSULTING_TEMPLATES_LIBRARY_V3.md` contains artifact structure + DoD + initiative mapping + help pack contract (section 7).
- **Assets pipeline**: every tool entry has defined preview graphic requirements + a micro-video script (even if URLs are pending).

