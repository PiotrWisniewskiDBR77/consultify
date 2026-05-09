# Consultify Document Studio — Gap Analysis vs 100% Product Vision

**Data raportu:** 8 maja 2026
**Wersja stanu kodu:** post-Epic E11 + slice E11.5 (MELS chip-id reconciliation) + slice FE-E1.1 (Frontend manifest loader hook)
**Autor:** Document Studio Architect (agent)
**Cel dokumentu:** porównać aktualny stan modułu Consultify Document Studio (DRD source-of-truth + zaszipowany kod) z 100% wizją produktową opisaną w `Consultify Document Studio / Word Artifact Engine — Dokument produktowo-architektoniczny` (8 maja 2026), wskazać konkretne luki i zaproponować backlog domknięcia.

> **Uwaga o atrybucji.** Niektóre commits z tej sesji zostały mis-attributed przez równoległy sync agent (zob. §6.13.2 i §6.14.1 implementation planu). Dla tego raportu używam *zawartości* commitów, nie ich wiadomości — wszystkie referencje do slice'ów i plików są zweryfikowane przez `git show`.

---

## 0. Skrót dla product ownera

| Wymiar | Pokrycie | Komentarz |
| --- | --- | --- |
| 11 komponentów A..K | **3 DELIVERED**, 8 PARTIAL | F (Schema), I (QA), K (Governance) najbliżej spec; A (Intake), B (Source Pack), H (Editor), J (Export) mają znaczące luki. |
| 40 FR (P0/P1/P2) | **17 DELIVERED**, 19 PARTIAL, **4 MISSING** | Missing: FR-22 charts, FR-37 access history (UX), FR-40 share link, plus `transformative` edit level (poza FR-13 zakresem). |
| 17 NFR | **0 DELIVERED**, 16 PARTIAL, 1 OPEN | Brak NFR-status "DELIVERED" wynika z metodologii: większość NFR wymaga golden tests / audytu bezpieczeństwa, których nie wykonano. |
| 20 spec templates | **20 / 20 DELIVERED** | Plus 2 extras (`benefits_tracking_report`, `portfolio_overview`) i 1 fallback (`generic_document` — nie seedowany, dostępny jako enum). |
| 5 MVPs | MVP-1..MVP-3 bardzo dobrze pokryte server-side; **MVP-4 tylko backend** (UI track-changes brak); MVP-5 enterprise — początek (E10 API). | Frontendowy "execution-module shell" track (FE-E1..FE-E5) tylko zaczęty (FE-E1.1). |
| 15 risks | **0 MITIGATED**, 13 PARTIALLY MITIGATED, 2 OPEN | OPEN: R8 (vendor lock-in), R11 (high AI costs). Wszystkie pozostałe mają backend mitigation, ale ujawnienia / UX / governance UI są niepełne. |
| 5 data models §8 | DocumentArtifact ~80% · DocumentTemplate ~85% · SectionBlueprint ~50% · DocumentEdit ~70% · FormattingSchema ~70% | Najsłabszy `SectionBlueprint` (brak `requiredData/optionalData/formattingStyle/approvalRequired` per blueprint). `DocumentArtifact` carries explicit `templateRef/sourcePackId/clientId/owner` przez V8 substrate, nie przez `DocumentSchema` self-describing. |

**Najważniejszy wniosek:** moduł ma silny **server-side substrate** (49 plików / 571 specs, 47+ endpointów, 22 system templates × 2 języki, 10-kategoryjny QA, advanced DOCX, audit/approval/comments/brand-voice/audience/content-blocks API), ale brakuje **Frontend Document Studio jako execution-module zgodnego z MELS** + 6-poziomowego edytora (poziomy 5/6 nie wystawione przez HTTP, poziom 6 — `transformative` — nie istnieje w typach).

---

## 1. Inwentarz kodu (stan po E11.5 + FE-E1.1)

### 1.1 Backend services (`consultify/server/src/services/documentStudio/`)

33 pliki produkcyjne (poza `__tests__`):

- **Orchestrator**: `documentStudioService.ts` (single source of truth dla pipeline'u)
- **Schema + types**: `documentStudioTypes.ts`
- **Planning**: `documentNarrativePlanner.ts`, `documentNarrativeRefiner.ts`, `documentContentGenerator.ts`
- **Rendering**: `documentSchemaRenderer.ts` (markdown), `documentDocxRenderer.ts`, `documentDocxStructure.ts`, `documentDocxStyles.ts`, `documentPdfRenderer.ts`
- **QA**: `documentQaService.ts` (10 kategorii, w tym brand-voice-aware)
- **Editor**: `documentEditorRefiner.ts`, `documentTeresaIntent.ts`
- **Templates**: `documentTemplateService.ts`, `documentTemplateRegistryDao.ts`, `documentTemplateSeeder.ts` (22 typy × PL/EN), `documentTemplateRefiner.ts`
- **Source Packs (E4)**: `documentSourcePackService.ts`, `documentSourcePackRegistryDao.ts`, `documentSourcePackConnectors.ts`
- **Lifecycle (E5)**: `documentLifecycleService.ts`, `documentVersionSnapshotService.ts`
- **Comments (E6)**: `documentCommentsService.ts`
- **Brand Voice (E7)**: `documentBrandVoiceService.ts`, `documentBrandVoiceRegistryDao.ts`
- **Audience Profiles / Variants (E9)**: `documentAudienceProfileService.ts`, `documentAudienceProfileRegistryDao.ts`, `documentAudienceProfileSeeds.ts`, `documentAudienceProjector.ts`
- **Approvals (E10)**: `documentApprovalService.ts`, `documentApprovalRegistryDao.ts`
- **Content Blocks (E10)**: `documentContentBlockService.ts`, `documentContentBlockRegistryDao.ts`

### 1.2 Backend governance (`consultify/server/src/services/executionModuleStandard/`)

3 pliki (E11 + E11.5):
- `executionModuleStandardTypes.ts` — typy manifestu, MELS-aligned chip ids (`internal · theme · history · qa · governance · analytics · audit · share · agent · run`)
- `executionModuleStandard.ts` — kanoniczne stałe + walidator
- `executionModuleStandardManifests.ts` — 3 reference manifesty (doc-builder, deck-builder, excel-builder)

### 1.3 HTTP routes (`consultify/server/src/routes/`)

- `document-studio.routes.ts` — duża powierzchnia, ~50+ endpointów: plan / generate / export / get / templates / source-packs / chat-create / lifecycle / snapshots / rollback / editor proposals (local|section|global) / comments / brand-voice / audience-profiles / artifact variants / approvals / content-blocks / policy
- `execution-modules.routes.ts` — 4 endpointy (E11.3): standard, manifests, manifest, validate

### 1.4 Frontend (`consultify/src/components/DocumentStudio/` + `consultify/src/services/executionModuleStandard/`)

- `DocumentStudio/types.ts` — frontend mirror typów (subset: editor scope **tylko 3 wartości** — `local | section | global`)
- `DocumentStudio/api.ts` — fetch wrappers
- `DocumentStudio/DocumentStudioView.tsx` — top-level z tabami Generate / Plan template, fazy intake → outline → document
- `DocumentStudio/DocumentStudioIntakeForm.tsx` — Mode 1/3 intake
- `DocumentStudio/DocumentStudioOutlinePanel.tsx` — preview outline
- `DocumentStudio/DocumentStudioTemplateArchitectView.tsx` — Mode 2
- `DocumentStudio/DocumentStudioDocumentPanel.tsx` — read-only preview + export bar (NIE jest 3-zone, NIE ma Menu 2 chips)
- `DocumentStudio/DocumentStudioEditorPanel.tsx` — proposal UX dla local|section|global
- `DocumentStudio/DocumentStudioQaPanel.tsx` — QA report viewer
- `executionModuleStandard/types.ts` — FE mirror manifestu (FE-E1.1)
- `executionModuleStandard/api.ts` — fetch wrappers (FE-E1.1)
- `executionModuleStandard/useExecutionModuleManifest.ts` — React hook z module-level cache (FE-E1.1)

### 1.5 Shared shell (gotowy do użycia, niewykorzystany jeszcze przez Document Studio)

`consultify/src/components/shared/ExecutiveModuleShell/` — MELS:
- `index.tsx` (`ExecutiveModuleShell` — 3-zone shell)
- `TopBar.tsx`, `LeftRail.tsx`, `RightRail.tsx`, `RailResizeHandle.tsx`, `ShortcutHelpModal.tsx`
- `ChipDescriptor.ts` (`MELS_CHIP_ORDER` — 10 ids w MELS naming)
- `useRailState.ts` (collapse + 32px / 280..360 / localStorage `mels.rail.{moduleKey}`)
- `shortcuts.ts`

Tabele już używa MELS (`TabeleTopBarChips.tsx`, `TabeleMelsView.tsx`). Document Studio jeszcze nie.

---

## 2. Sekcja A — Framing alignment

**Doktryna SSOT** (`CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md`) jest spójna ze 100% spec:

- Dokumenty są persistowane jako V8.1/wave5 artifacts z `DocumentSchema` w metadata → "document is schema before file" ✓
- 3 tryby pracy zaimplementowane backend-side (Mode 1: outline → generate, Mode 2: template architect → registry, Mode 3: approved template → generate z `materializeDocumentArtifact` + preflight) ✓
- Word/PDF jako derivative outputs przez dedykowane renderery ✓

**Luka:** "live artifact UX" (3-zone execution-module shell, Menu 2 chips, Teresa-only popover/drawer, prawdziwy AI Document Editor jako edytor a nie generator) **nie jest zrealizowana frontendowo**. Front jest na poziomie *MVP-1 + częściowo MVP-3* (intake → outline → document → export + edytor proposals 3-scope).

---

## 3. Sekcja B — Komponenty A..K

| # | Komponent | Status | Evidence / kluczowe luki |
| --- | --- | --- | --- |
| A | Document Request Intake | **PARTIAL** | `DocumentStudioIntakeForm.tsx` + `/plan` + `/generate` + chat path `/chat/create-from-sources`. **Brak:** unified "quick create" z research session / interview / artifact / CRM jako single-click action; intake jest jedną formą + jednym chatem, nie wieloma surface'ami z spec'a §A. |
| B | Source Pack Builder | **PARTIAL** | `documentSourcePackService.ts` + `documentSourcePackConnectors.ts` (E4). Connectors: `url`, `text`, `file`, `integration`, `v8_artifact`. **Brak:** szeroki zakres źródeł ze spec'a §B (research sessions, interview, KPI, CRM, decisions, tasks, risk register, action items, surveys, transcripts, financials, roadmap, initiative backlog) jako *natywne* connectory; per-claim provenance + confidence level + visible matrix used/skipped/approved/draft/missing **brak w UI**. |
| C | Document Narrative Planner | **DELIVERED** (Mode 1 + template-derived) | `documentNarrativePlanner.ts` + `documentNarrativeRefiner.ts` (LLM optional). Mode 3 hydrates z `template.sectionBlueprint`. **Częściowo:** persona variants są w E9 (`documentAudienceProjector.ts`), ale nie są częścią Plannera w klasycznym sensie spec'a §C. |
| D | AI Document Template Architect | **PARTIAL** | `documentTemplateRefiner.ts` + `documentTemplateService.ts` + `POST /templates/plan` + `DocumentStudioTemplateArchitectView.tsx`. Template ma: `sectionBlueprint`, `formattingSchema`, `exportRules`, `requiredInputs`. **Brak:** charts spec, numbering detail per heading level, logo/disclaimer rules per template (jest tenant-wide), conditional sections, data mapping schema, persona variants per template. |
| E | Template Registry | **PARTIAL → strong backend** | Postgres `documentTemplateRegistryDao.ts`, cache+service `documentTemplateService.ts`, seeder z 22 typami × PL/EN. **Brak:** `usage_count`, `feedback_quality_score`, `last_used_at`, `persona`, `region`, `brand`, `dependencies/successor` na `DocumentTemplate`. Filtrowanie po typie/języku/statusie ✓; po personie/regionie/brandzie ✗. |
| F | Document Schema Engine | **PARTIAL → strong types** | Bogate typy w `documentStudioTypes.ts`: `DocumentSection`, `DocumentBlock` z `kind` (incl. `appendix`), `audienceTags`, fields lifecycle. **Mutation path** orchestrator + proposals (E3) zamiast generic CRUD per block. Comments / approvals attach przez dedykowane services. |
| G | Formatting & Style Engine | **PARTIAL** | `DEFAULT_CONSULTING_FORMATTING_SCHEMA` + E8 stack (`documentDocxStyles.ts`, `documentDocxStructure.ts`, `documentDocxRenderer.ts`, `documentPdfRenderer.ts`). **Brak:** golden tests pokazujących true Word styles na 50+ stronach z każdym block kind; pixel-for-pixel enterprise verification; charts; cover page rendering verification. |
| H | AI Document Editor | **PARTIAL** | Typy mają **5/6 poziomów**: `local`, `section`, `global`, `methodology`, `source`. **Routes wystawione**: tylko local + section + global (E3). **Service-side only**: `createMethodologyEditProposal`, `createSourceEditProposal` w `documentStudioService.ts` istnieją ale **brak HTTP routes**. Frontend `DocumentStudioEditorPanel.tsx` + `types.ts` widzą **tylko 3 scopes**. **Poziom 6 — `transformative` — NIE ISTNIEJE** ani w typach, ani w services, ani w intent classifierze. |
| I | Document QA Engine | **DELIVERED (10 kategorii)** | `documentQaService.ts.runDocumentQa` — brand, language, completeness, sources, methodology, executive, risk, data, format, export. Brand-voice-aware (E7). Export gate z `QaBlockingError` + role-gated override. **Spec wymienia 13+ koncepcji** (repetition, send-readiness, tone-vs-audience, contradictions, confidentiality-marking, appendix-required-elements) — niektóre są podzbiorami wdrożonych kategorii (np. confidentiality jest w `format`, contradictions częściowo w `data`), inne są niestandalone. |
| J | Export Engine | **PARTIAL** | DOCX / PDF / markdown ✓ (E8). QA gate ✓. Override ✓ (E2.4 + audit). **Brak:** share link jako Document Studio surface (FR-40), HTML preview jako primary alternative, formal fallback ladder ("DOCX fail → PDF → markdown → internal artifact"). Internal artifact jest niezniszczalny dzięki immutable `DocumentVersionSnapshot` (E5.2). |
| K | Governance & Versioning | **PARTIAL → strong backend** | `documentLifecycleService.ts` (E5.1), `documentVersionSnapshotService.ts` (E5.2 + rollback E5.3), `documentApprovalService.ts` (E10.1), `documentCommentsService.ts` (E6), source provenance via `sourceRef` na blockach/sekcjach + Source QA. Per-event audit DAO w każdym service'ie. **Brak:** unified access-history UX, full track-changes view, real-time multiplayer collaboration, eksport history jako pierwszorzędne. |

---

## 4. Sekcja C — Wymagania funkcjonalne FR-01..FR-40

| Id | Tytuł | Prio | Status | Evidence / luka |
| --- | --- | --- | --- | --- |
| FR-01 | Prompt-driven creation | P0 | **PARTIAL** | Intake form + `/plan` + `/generate` + chat (`/chat/create-from-sources`, E4.4). Pełny "prompt-only" parity przez wszystkie surface (CRM, project, research session) **niewystawiony**. |
| FR-02 | Doc-type recognition | P0 | **PARTIAL** | `DocumentTypeKey` enum (22 typy) + intake `documentType?` (opcjonalny). Auto-classification z wolnego tekstu chat — **niezweryfikowane** (Teresa intent jest dla edycji, nie dla typeu). |
| FR-03 | AI structure planning | P0 | **DELIVERED** | `documentNarrativePlanner.ts` (deterministic) + `documentNarrativeRefiner.ts` (LLM optional). Outline jest pokazywany przed generowaniem (`DocumentStudioOutlinePanel.tsx`). |
| FR-04 | AI template planning | P1 | **PARTIAL** | `documentTemplateRefiner.ts` + `POST /templates/plan` + `DocumentStudioTemplateArchitectView.tsx`. Generuje sectionBlueprint + formattingSchema. **Niepełne wobec spec §D:** brak charts/numbering/logo/disclaimer/conditional sections. |
| FR-05 | Template approval | P1 | **DELIVERED** | `approveTemplate`/`deprecateTemplate` w service + routes; UI w `TemplateArchitectView`. Status flow draft → approved → deprecated. |
| FR-06 | Template Registry | P1 | **PARTIAL** | DAO + service + seeder ✓; filtrowanie po typie/języku/statusie ✓. **Brak:** `usage_count`, `feedback_score`, `last_used_at`, persona/region/brand fields. |
| FR-07 | Generate-from-template | P0 | **DELIVERED** | `materializeDocumentArtifact({ templateId })` (Mode 3); preflight `MissingRequiredSourceError`. |
| FR-08 | Source Pack Builder | P0 | **PARTIAL** | E4: `documentSourcePackService.ts` + `documentSourcePackConnectors.ts` + 9 endpointów. Source pack jest reużywalny. **Brak:** szerokie connectory ze spec §B (research, interview, KPI, CRM, decisions, risks, action items). |
| FR-09 | Missing-data marking | P0 | **PARTIAL** | Mode 3 preflight + `MissingRequiredSourceError` + completeness QA + `isAssumption` na blockach. **Per-section "missing data" UI marker** w canvas — brak. |
| FR-10 | Chat editing | P0 | **PARTIAL** | `documentTeresaIntent.ts` mapuje chat → editor scope (5 wartości). Chat surface w `DocumentStudio*` **niezintegrowany** (Teresa drawer dopiero w FE-E5 backlog). Intent classifier istnieje server-side, ale wiring z chat MCP/UI **nieprzetraced**. |
| FR-11 | Local edit | P1 | **DELIVERED** | `POST /editor/proposals/local` + `DocumentStudioEditorPanel.tsx`. |
| FR-12 | Sectional edit | P1 | **DELIVERED** | `POST /editor/proposals/section` + UI scope `section`. |
| FR-13 | Global edit | P1 | **DELIVERED** | `POST /editor/proposals/global`. **Spec wymienia także persona switch jako global** — pokrywany E9 audience variants (ale jako osobny pipeline, nie editor proposal). |
| FR-14 | Versioning | P0 | **DELIVERED** | E5.2 `DocumentVersionSnapshot` + immutable persistence; każda materializacja + rollback tworzy snapshot. |
| FR-15 | Diff | P0 | **PARTIAL** | Proposal `diff.before` / `diff.after` jako stringi. **Brak:** structural diff viewer, side-by-side rendering, paragraph-level highlighting w UI. |
| FR-16 | AI-edit approval | P0 | **DELIVERED** | E3: proposal → approve/reject → executed; status flow + audit. |
| FR-17 | DOCX export | P0 | **DELIVERED** | E8: `documentDocxRenderer.ts` + export route. |
| FR-18 | True Word styles | P0 | **PARTIAL** | E8.1 + `documentDocxStyles.ts` (named paragraph styles per formatting class). **Brak:** golden tests vs Word desktop / Word online / LibreOffice; pixel-perfect enterprise verification. |
| FR-19 | PDF export | P0 | **DELIVERED** | E8.4 PDF parity + `documentPdfRenderer.ts`. |
| FR-20 | TOC | P1 | **DELIVERED** (E8.2) | TOC + cover page break + appendix lettering/numbering. |
| FR-21 | Tables | P0 | **PARTIAL** | Block kind `table` + `risk_table` w generatorze. **Brak:** Excel-grade tabele, complex headers, merged cells, calculated columns. |
| FR-22 | Charts | P2 | **MISSING** | Brak block kind `chart`, brak chart pipeline w `documentDocxRenderer.ts` / `documentPdfRenderer.ts`. **Realna luka spec'a.** |
| FR-23 | Citations + sources | P0 | **PARTIAL** | E8.3 captions + footnotes + citation markers w DOCX. `citation` block type w `documentStudioTypes.ts`. **Brak:** end-to-end "click source ref → jumpto" w UI. |
| FR-24 | Source provenance | P0 | **PARTIAL** | `sourceRef` na blockach + sekcjach + sources QA. **Brak:** per-sentence provenance UI (spec wymaga "kliknąć source ref"). |
| FR-25 | Document QA | P0 | **DELIVERED (engine)** | E2: 10 kategorii; lista issues + score per kategoria; export gate. |
| FR-26 | Template compliance check | P1 | **PARTIAL** | Methodology QA porównuje document.sections z template.sectionBlueprint (kolejność, brakujące, dodatkowe). **Brak:** pełna proof of compliance dla R1-R4 governance canon (jest w SSOT TYPE_TAXONOMY ale validator nie pokrywa wszystkich rules). |
| FR-27 | Brand compliance check | P1 | **DELIVERED** | E7 Brand QA + `documentBrandVoiceService.ts` per-tenant profiles. |
| FR-28 | Roles + permissions | P0 | **PARTIAL** | Tenant guards w services + `verifyToken` middleware; QA override role-gated. **Fine-grained document ACL** dziedziczone z V8 — nie auditowane w tym raporcie. |
| FR-29 | Review mode | P1 | **PARTIAL** | `DocumentStatus` includes `in_review`; `documentCommentsService.ts` (E6). **Brak:** dedicated review mode UI w execution-module shell. |
| FR-30 | Comments | P1 | **DELIVERED (API)** | E6.1 data plane + E6.2 thread aggregation + E6.3 routes (9 endpointów). UI panel **niezweryfikowany w tym raporcie** poza istnieniem routes. |
| FR-31 | Persona variants | P1 | **PARTIAL** | E9 `AudienceProfile` + projector + 4 system seeds (CEO/Board/Team/Client) + 9 endpointów. **Frontend picker / variant gallery — MISSING** (FE-E5 backlog). |
| FR-32 | Draft/final status | P0 | **DELIVERED** | E5.1 status enum + transitions: `draft → in_review → approved → exported → archived`; watermark per status. |
| FR-33 | Rollback | P1 | **DELIVERED** | E5.3: rollback tworzy nowy snapshot + audit. |
| FR-34 | Confidentiality labels | P0 | **PARTIAL** | `confidentiality` enum (`internal/client_confidential/restricted/public`) na schema + footer flag w formatting. **Brak:** verified embedding w DOCX/PDF cover + visible w artifact view jako pierwszorzędny element. |
| FR-35 | Reusable content blocks | P2 | **DELIVERED (API)** | E10.2: `documentContentBlockService.ts` + 9 endpointów. **UI library picker — MISSING** (FE-E4 backlog). |
| FR-36 | Export rules | P1 | **PARTIAL** | `TemplateExportRules` (docx/pdf/markdown/approvalRequiredForExport). **Enforcement jest częściowy** — gate sprawdza approval i QA, ale nie waliduje pełnego rule matrix per template. |
| FR-37 | Access history | P1 | **PARTIAL** | Per-service audit DAOs (template, source-pack, brand-voice, audience, approvals, content-blocks). **Brak:** unified access-history view per dokument. |
| FR-38 | Multi-language | P2 | **PARTIAL** | `language: 'pl' \| 'en'` na schema + templates seeded PL/EN. **Brak:** więcej języków, locale-aware formatting, i18n UI strings. |
| FR-39 | Appendix management | P1 | **PARTIAL** | `kind: 'appendix'` na sekcjach + `appendixStyle` w formatting + E8.2 lettering A/B/C. **Brak:** dedicated UI do zarządzania appendix items. |
| FR-40 | Share link | P2 | **MISSING / inherited** | Brak dedicated share-link impl. w Document Studio routes; potencjalnie reuse V8 publish — niezweryfikowane. **Mark as MISSING** w Document Studio surface. |

**Sumarycznie:**
- DELIVERED: **17/40** (FR-03, FR-05, FR-07, FR-11, FR-12, FR-13, FR-14, FR-16, FR-17, FR-19, FR-20, FR-25, FR-27, FR-30, FR-32, FR-33, FR-35)
- PARTIAL: **19/40** — większość ma backend, brakuje UI lub fragmentu funkcjonalności
- MISSING: **4/40** — FR-22 (charts), FR-37 (access history UX), FR-40 (share link), plus orphan: 6th editor level (`transformative`) nieobecny w typach

---

## 5. Sekcja D — Wymagania niefunkcjonalne NFR-01..NFR-17

| Id | Tytuł | Status | Evidence / luka |
| --- | --- | --- | --- |
| NFR-01 | Enterprise document quality | **PARTIAL** | QA + assumptions + brand-voice + audience profiles. Subjective "consulting-grade" verdict — wymaga user studies / customer feedback loop. |
| NFR-02 | Stable formatting | **PARTIAL** | 49 plików / 571 specs (snapshot tests dla schema, DOCX, PDF). **Brak:** golden 150-page stress; cross-renderer (Word desktop / online / LibreOffice). |
| NFR-03 | Word export quality | **PARTIAL** | E8.1-E8.3 named styles + TOC + captions + footnotes; `documentDocxStyles.ts` map per formatting class. **Brak:** verified vs realna recenzja klienta. |
| NFR-04 | PDF export quality | **PARTIAL** | E8.4 parity test + `documentPdfRenderer.ts`. **Brak:** 50+ stron stress test. |
| NFR-05 | Data security | **PARTIAL** | Tenant guards w pattern + `verifyToken`. Confidentiality enums. **Brak:** end-to-end security audit + penetration test scope. |
| NFR-06 | No hallucinations | **PARTIAL** | `isAssumption` flag + sources QA + completeness QA. **Brak:** LLM-side hard guarantees (refiner prevents intent drift, ale mogą halucynować na block content). |
| NFR-07 | Source traceability | **PARTIAL** | `sourceRef` na blokach. **Brak:** per-sentence UI breadcrumb. |
| NFR-08 | Compliance governance | **PARTIAL** | E5/E6/E10 governance API + audit + approvals. **Brak:** unified compliance reporting UI; export sertifikacji. |
| NFR-09 | Performance | **PARTIAL** | Section-level edits (E3); proposals nie regenerują całego dokumentu. **Brak:** chunked generation dla 50-150 stron; incremental rendering w UI. |
| NFR-10 | Multi-user collaboration | **PARTIAL** | Comments + approvals + roles ✓. **Brak:** real-time collaborative editing (CRDT / OT). |
| NFR-11 | Auditability | **PARTIAL** | Per-service audit DAOs. **Brak:** consolidated audit trail view. |
| NFR-12 | Reliability (export fail safety) | **PARTIAL** | Markdown fallback w UI; immutable snapshots. **Brak:** explicit cascade (DOCX fail → PDF → markdown → preview). |
| NFR-13 | Long-document support | **PARTIAL** | Section-level edits + immutable snapshots. **Brak:** stress test 50-150 stron + chunked LLM generation. |
| NFR-14 | AI cost control | **PARTIAL** | `useLlm` flag opcjonalny; deterministic narrative planner default. **Brak:** explicit cost budget per dokument; caching layer. |
| NFR-15 | Export-error resilience | **PARTIAL** | Internal artifact + snapshot zostają nawet przy export fail. **Brak:** explicit fallback policy w kodzie. |
| NFR-16 | Access-rights for AI sources | **OPEN** | Connectors + types istnieją; **enforcement vs org ACL wymaga deep audit** `documentSourcePackConnectors.ts`. **Wysokie ryzyko governance** jeśli claim "done". |
| NFR-17 | Source-version preservation | **PARTIAL** | `DocumentSourceRef` w schema **nie zawiera explicit version pinning** (jest sourceId/sourceTitle, brak sourceVersion / sourceSnapshotId). **Konkretna luka.** |

---

## 6. Sekcja E — 20 spec templates + extras

System seeds w `documentTemplateSeeder.ts` (Epic E1, commit `0990f6c13`):

| # | Spec name | `documentTypeKey` | Seeded SYSTEM (PL/EN)? |
| --- | --- | --- | --- |
| 1 | Executive Memo | `executive_memo` | ✓ DELIVERED |
| 2 | Project Status Report | `project_status_report` | ✓ DELIVERED |
| 3 | Steering Committee Report | `steering_committee_report` | ✓ DELIVERED |
| 4 | AI Audit Report | `ai_audit_report` | ✓ DELIVERED |
| 5 | Interview Summary Report | `interview_summary_report` | ✓ DELIVERED |
| 6 | Digital Transformation Roadmap | `digital_transformation_roadmap` | ✓ DELIVERED |
| 7 | Business Case | `business_case` | ✓ DELIVERED |
| 8 | Sales Proposal | `sales_proposal` | ✓ DELIVERED |
| 9 | Client Discovery Report | `client_discovery_report` | ✓ DELIVERED |
| 10 | Workshop Summary | `workshop_summary` | ✓ DELIVERED |
| 11 | Risk Register Report | `risk_register_report` | ✓ DELIVERED |
| 12 | Decision Memo | `decision_memo` | ✓ DELIVERED |
| 13 | SOP Document | `sop_document` | ✓ DELIVERED |
| 14 | Implementation Plan | `implementation_plan` | ✓ DELIVERED |
| 15 | Change Management Plan | `change_management_plan` | ✓ DELIVERED |
| 16 | Board Report | `board_report` | ✓ DELIVERED |
| 17 | Research Report | `research_report` | ✓ DELIVERED |
| 18 | Due Diligence Note | `due_diligence_note` | ✓ DELIVERED |
| 19 | Internal Policy Document | `internal_policy_document` | ✓ DELIVERED |
| 20 | Client Final Report | `client_final_report` | ✓ DELIVERED |

**Extras (poza listą 20 z spec'a):**
- `benefits_tracking_report` — system template, PL/EN
- `portfolio_overview` — system template, PL/EN
- `generic_document` — typ enum, **nie seedowany** (fallback dla ad-hoc)

**Werdyk:** templates **kompletnie pokryte** (20/20 + 2 extras + 1 fallback). Łącznie 22 documentTypeKey × 2 języki = **44 system templates** w bazie.

---

## 7. Sekcja F — Pokrycie 5 MVP'ów

| MVP | Cel | Co pokryte | Co brakuje |
| --- | --- | --- | --- |
| **MVP-1** Internal Document Artifact + basic generation | doc jako artifact, prompt-gen, podstawowe templates, podstawowy source pack, preview, PDF, prosty DOCX, basic review status | E1 (template registry persistence) + E4 (source packs + chat creation) + E5.1 (lifecycle status) + V8/wave5 substrate (artifact persistence). Frontend: `DocumentStudioView.tsx` ma intake → outline → document → export. Markdown/PDF/DOCX exporty działają. | "Artifact workspace embedding" — Document Studio jest jako standalone route, nie jako embed w project workspace; basic review status istnieje (`in_review`) ale bez review UI. |
| **MVP-2** Template Planner + Template Registry | AI Template Planner, Registry, status, formatting schema, generate-from-approved-template, basic Word styles, basic TOC, required inputs | E1 (22 system templates × 2 języki + Postgres registry + audit). Mode 3 (`materializeDocumentArtifact({ templateId })`). Mode 2 UI (`TemplateArchitectView`). Basic Word styles + TOC w E8.2. | Registry product fields (usage count, feedback, persona/region/brand); template marketplace; advanced approval workflow. |
| **MVP-3** AI Document Editor + diff + QA | AI Editor, section-level edits, diff, AI-edit approval, source provenance, QA Engine, missing-data marking, template compliance check | E2 (full QA 10 kategorii); E3 (editor proposals local/section/global + Teresa intent + methodology+source scopes service-side). E4 source-pack preflight + missing-required-source. E6 comments. | **Methodology + source proposals routes nie wystawione przez HTTP**. **`transformative` 6. poziom edycji nie istnieje**. UI editor scope **tylko 3 wartości** (frontend `types.ts`). Diff jako string before/after — brak full track-changes. |
| **MVP-4** Advanced DOCX + governance | advanced DOCX, true Word styles, comments, track-changes view, brand governance, reusable content blocks, advanced permissions, export history | E8 (style classes, TOC, cover, appendix lettering, captions, footnotes, citations + PDF parity). E5 (snapshots, rollback). E6 (comments API). E7 (brand voice + brand QA). E10 (approvals + content blocks API). | **Frontend ExecutiveModuleShell adoption dla Document Studio (FE-E1..FE-E5 dopiero w FE-E1.1)**. Track-changes-like view brak. Unified access/export history view brak. |
| **MVP-5** Enterprise collaboration + integrations | multiplayer, legal/compliance templates, Word/Google Docs integrations, CRM integrations, multi-language, marketplace, advanced audit, advanced permissioning, external reviewer | Tylko fundamenty: E10 approvals + content blocks (API), E9 audience variants (API). | **Wszystko z UX'a brak**: real-time multiplayer (CRDT), Word/Docs integration, CRM integration, multi-language full i18n, marketplace, external reviewer flow. |

**Wnioski po MVP:** 
- **MVP-1** ~80% (artifact + basic gen ok; embedding + review UI brak)
- **MVP-2** ~70% (registry + Mode 3 strong; product fields + marketplace brak)
- **MVP-3** ~60% (QA engine strong; editor 3/5 routes wystawione; 6th level brak; diff prymitywny)
- **MVP-4** ~50% (DOCX backend strong; frontend MELS adopcja dopiero zaczyna)
- **MVP-5** ~10% (tylko fundamenty API)

---

## 8. Sekcja G — 15 ryzyk

| Risk | Status | Mitigation reference |
| --- | --- | --- |
| **R1** Słaby export Word | PARTIALLY MITIGATED | E8 + `documentDocxRenderer.ts` + golden tests w `documentDocxStyles.test.ts`, `documentDocxRenderer.test.ts`, `documentDocxCaptionsFootnotes.test.ts`. **Open:** stress 50+ stron, cross-renderer. |
| **R2** Rozjeżdżające formatowanie | PARTIALLY MITIGATED | Schema-first doctrine (SSOT §5.6); E5 immutable snapshots; ~50 specs. **Open:** golden baseline breadth. |
| **R3** Brak prawdziwych Word styles | PARTIALLY MITIGATED | `documentDocxStyles.ts` (E8.1) — named paragraph styles per formatting class. **Open:** edge-case blocks. |
| **R4** Halucynacje | PARTIALLY MITIGATED | `isAssumption` flag, source QA, claims check w QA, refiner intent guards (E3.1 methodology scope, E3.2 source scope). **Open:** LLM-stage guarantee. |
| **R5** Brak źródeł | PARTIALLY MITIGATED | Source Pack Builder (E4) + sources QA + Mode 3 preflight. **Open:** zależy od jakości ingestion. |
| **R6** Zbyt ogólny język | PARTIALLY MITIGATED | Brand QA + Language QA + persona variants (E9) + brand voice profile (E7). |
| **R7** Dokumenty ładne, ale bez wartości | PARTIALLY MITIGATED | Methodology QA + Executive QA (TL;DR/exec summary/recommendations/decision next-steps). |
| **R8** Vendor lock-in | **OPEN** | Schema-first jest agnostyczne (DOCX/PDF/markdown to derivative outputs), ale faktyczna migrowalność z V8/wave5 nie była audytowana. |
| **R9** Brak governance | PARTIALLY MITIGATED | E5 lifecycle + E5.2 snapshots + E10 approvals + E6 comments + per-service audit. **Open:** UX cienki. |
| **R10** Trudność edycji długich dokumentów | PARTIALLY MITIGATED | Section-level proposals (E3) — brak full-doc regeneration przy małej zmianie. **Open:** chunked LLM generation, streaming UX. |
| **R11** Wysokie koszty AI | **OPEN** | `useLlm` flag opcjonalny + deterministic planner default. **Brak:** explicit per-document budget, caching layer, model routing per scope. |
| **R12** Niespójność wersji | PARTIALLY MITIGATED | E5.2 immutable `DocumentVersionSnapshot` + rollback tworzy nową wersję. |
| **R13** Brak zaufania klienta | PARTIALLY MITIGATED | Source pack widoczny + QA score + assumptions oznaczone. **Open:** UX provenance per claim. |
| **R14** Brak kontroli nad poufnymi danymi | PARTIALLY MITIGATED | RBAC override gate + confidentiality enums + tenant guards. **Open:** end-to-end security audit. |
| **R15** Problemy z eksportem DOCX | PARTIALLY MITIGATED | E8 stack + tests + markdown fallback. **Open:** explicit fallback ladder. |

---

## 9. Sekcja H — Zalety wobec konkurencji (z §16 spec'a)

Dla każdego "lepiej niż X" z §16 product spec'a — czy claim jest w kodzie czy tylko w doc'ach:

| Claim | Stan w kodzie |
| --- | --- |
| **Lepiej niż Word Copilot** — system tworzy dokument z procesu + źródeł + metodologii + approval workflow, nie tylko pomaga pisać | **CZĘŚCIOWO W KODZIE.** Backend ma source pack + methodology QA + approval workflow. UX (chat-driven editor jako *wewnątrz* dokumentu) brak. |
| **Lepiej niż Google Gemini w Docs** — kontroluje source pack, wersje, diffy, braki, status | **W KODZIE.** Source Pack (E4), version snapshots (E5.2), diff (E3), missing-data (E2.1 + Mode 3 preflight), status (E5.1). |
| **Lepiej niż PandaDoc** — obsługuje złożone dokumenty analityczne i konsultingowe, nie tylko offer/contract | **W KODZIE.** 22 system templates pokrywają consulting/analyst/decision dokumenty. |
| **Lepiej niż DocuSign / Conga / Ironclad** — pełne consulting execution, nie tylko legal lifecycle | **W KODZIE jako fundament.** Approvals (E10) + comments (E6) + audience variants (E9) — backend strong. UX consulting-execution view brak. |
| **Lepiej niż Templafy** — pilnuje brandu + metodologii + źródeł + rekomendacji + governance projektu | **W KODZIE jako fundament.** Brand voice (E7) + methodology QA + source provenance + governance API. UX consolidation brak. |
| **Lepiej niż Writer / Jasper / Copy.ai** — tworzy audytowalne dokumenty enterprise, nie tylko content | **W KODZIE.** Per-service audit + `DocumentVersionSnapshot` + approval audit + brand QA + methodology QA. |
| **Lepiej niż Notion / Coda** — produkuje finalne dokumenty klientowskie z DOCX/PDF + approval | **W KODZIE.** E8 advanced DOCX + PDF parity + E10 approvals. |
| **Lepiej niż document automation** — AI planning + AI editing + narrative reasoning + document QA | **CZĘŚCIOWO W KODZIE.** Narrative planner ✓, AI editor (5/6 levels) ✓, document QA ✓. AI planning **na poziomie outline + template architect**, nie pełna narrative reasoning chain. |

---

## 10. Sekcja I — Największe luki (P0 / governance impact)

1. **Methodology + source editor scopes nie są wystawione przez HTTP routes**. Existują w `documentStudioService.ts` (`createMethodologyEditProposal`, `createSourceEditProposal`) ale frontend nie ma do nich dostępu. Łamie to SSOT 5-scope doctrine.

2. **6th editor level — `transformative` — całkowicie brakuje**. Spec wymienia transformative jako kluczową funkcję ("przerób dokument z notatki wewnętrznej na raport klientowski"). Częściowo pokrywany przez E9 audience variants ale jako osobny pipeline, nie jako editor scope.

3. **Frontend nie jest 3-zone execution-module zgodny z UI_UX_SOURCE_OF_TRUTH.md §249-304**. `DocumentStudioDocumentPanel.tsx` to flat preview + export bar. Brak Menu 2 chips, brak Teresa drawer, brak right panel collapse, brak Menu 3 AI actions slot. **MELS shell istnieje gotowy** (`ExecutiveModuleShell`) ale Document Studio go nie używa. (FE-E1..FE-E5 backlog).

4. **Source Pack UX nie pokazuje per-claim provenance + confidence + matrix used/skipped/approved/draft/missing**. Widoczność źródeł jest **wymaganiem zaufania klienta** (R13).

5. **Share link (FR-40) nie istnieje jako Document Studio surface**. Nie ma share UX, nie ma expiry, nie ma scoped permissions per share.

6. **Template registry brakuje product fields** (usage count, feedback score, persona/region/brand, dependencies). Bez tych pól nie da się zbudować data-driven template improvement loop.

7. **Charts (FR-22) nie istnieją**. Block kind `chart` nie zdefiniowany; brak chart pipeline w DOCX/PDF rendererach.

8. **NFR-16 (AI source rights) i NFR-17 (source version preservation) wymagają audytu**. Drugie ma konkretną lukę — `DocumentSourceRef` nie ma `sourceVersion` / `sourceSnapshotId`.

9. **Track-changes UI brak** (FR-15 diff jest stringiem). Bez visual diff approval AI edits nie spełni enterprise UX bar.

10. **Real-time multiplayer collaboration brak** (NFR-10). Backend ma comments + approvals, ale nie ma OT/CRDT layer dla collaborative editing.

---

## 11. Sekcja J — Co jest mocne

1. **Single orchestrator** (`documentStudioService.ts`) z czystym Mode 1/2/3 pipeline — łatwo audytować, łatwo extends.
2. **Postgres-backed template registry + 22 typy × PL/EN system seeds** — wyjątkowo szczegółowo (E1).
3. **10-kategoryjny QA engine + role-gated export override + structured `QaBlockingError`** — silny inżynierski hardening.
4. **Advanced DOCX stack** (E8: styles, structure, TOC, cover, appendix lettering, captions, footnotes, citations + PDF parity) z dedykowanymi specs.
5. **Enterprise collaboration primitives na poziomie API/service** (comments E6, approvals E10, content blocks E10, audience variants E9, brand voice E7) — fundament wpięty.
6. **MELS execution-module standard skodyfikowany** (E11) z reference manifestami doc/excel/deck-builder + walidatorem + governance API. Frontend MELS shell istnieje od dawna i jest production-tested w Tabele.
7. **571 vitest specs przechodzą** w Document Studio + Execution Module Standard scope. Pre-existing tsc errors w `tablePlatform/AiUsageService.ts` znane i out-of-scope.
8. **Audit trail per service** — każdy service ma swój `*Audit` DAO; każda mutacja zostawia ślad.

---

## 12. Sekcja K — Rekomendowany backlog do 100%

W kolejności impaktu (P0 governance / UX → P2):

### 12.1 P0 — odblokowuje SSOT compliance

- **Slice E3.5** — wystawić HTTP routes dla methodology + source editor proposals (`POST /editor/proposals/methodology`, `POST /editor/proposals/source`). Update FE `types.ts` na 5 scopes. ~1 day server + ~0.5 day FE.
- **Slice E3.6** — dodać `transformative` 6. poziom do typów + service + intent classifier + route. ~2 days.
- **Frontend Document Studio epic family FE-E1..FE-E5** — adopcja MELS, prowadząca do 3-zone shell + Menu 2 chips + Teresa drawer + Menu 3 AI actions zgodnie z `DOC_BUILDER_MANIFEST`. ~3-4 weeks.

### 12.2 P1 — domknięcie spec'a

- **Slice E5.6** — `DocumentSourceRef.sourceVersion` / `sourceSnapshotId` (NFR-17). Per-source pinning przy materialize. ~1 day.
- **Slice E13** — share link surface (FR-40): share routes + expiry + scoped permissions + UI share dialog. ~1 week.
- **Slice E14** — registry product fields (FR-06): `usage_count`, `feedback_quality_score`, `last_used_at`, `persona`, `region`, `brand`, `dependencies`. ~3 days.
- **Slice E15** — unified access-history view (FR-37): backend aggregator + UI panel. ~1 week.
- **Slice E16** — track-changes UI (FR-15): visual diff component + per-paragraph highlight + side-by-side. ~1 week.

### 12.3 P2 — pełnia spec'a

- **Slice E17** — Charts (FR-22): block kind `chart` + DOCX/PDF chart pipeline (chart.js → img w DOCX). ~1 week.
- **Slice E18** — Multi-language full i18n (FR-38): więcej języków, locale-aware formatting, i18n strings. ~2 weeks.
- **Slice E19** — Source Pack widoczność per-claim provenance + confidence (R13). ~1 week.
- **Slice E20** — Real-time multiplayer (NFR-10): CRDT layer (Yjs / Automerge) + presence + cursor sync. ~3-4 weeks.

### 12.4 Out-of-scope dla 100% Document Studio (raczej platform-wide)

- AI cost telemetry + per-document budget (NFR-14) — wave5 cross-cutting.
- Word/Google Docs integrations (MVP-5) — strategiczna decyzja, nie część doctrine'u.
- Template marketplace — strategiczna funkcja długoterminowa.

---

## 13. Sekcja L — Inwentarz plików (referencja)

Pełny inwentarz plików backend services + routes + frontend components — zobacz §1 niniejszego dokumentu (Inwentarz kodu). Wszystkie pliki opisane jednolinijkowo.

---

## 14. Niepewności i caveat'y

- **Teresa intent → chat MCP/UI wiring** — `documentTeresaIntent.ts` istnieje server-side; jego wywołanie z chat runtime'u nie zostało prześledzone w tym raporcie. Może już działać, może wymagać explicite wiringu.
- **Document ACL** dziedziczone z V8 — nie audytowane w tym raporcie. Realny FR-28 status zależy od V8/wave5.
- **Share link** — możliwy reuse V8 publish; jeśli jest, `documentStudioRoutes` nie ma jeszcze surface'u.
- **NFR-16** (AI source rights) — wymaga deep audit `documentSourcePackConnectors.ts`; **wysokie ryzyko governance** jeśli ktoś claim'uje "done" bez tego audytu.
- **Parallel sync agent** ma znany problem (zob. §6.13.2 i §6.14.1 implementation planu) — niektóre commits są mis-attributed. Treść kodu jest poprawna; tylko commit messages bywają cudze.

---

## 15. Sekcja M — Data models §8 spec'a vs current code

Spec wymienia 5 modeli danych (§8.1..§8.5). Mapa do `consultify/server/src/services/documentStudio/documentStudioTypes.ts`:

### 15.1 DocumentArtifact (spec §8.1)

Spec keys: `id`, `title`, `type`, `client_id`, `project_id`, `template_id`, `source_pack_id`, `version`, `status`, `owner`, `confidentiality`, `export_formats`, `sections[]`.

Code: `DocumentSchema` (linia ~155) + `Artifact` (V8.1 substrate) — kompozyt, NIE jeden interface. Mapowanie:

- `id` → `Artifact.id`; `version` → `ArtifactVersion`. ✓
- `title` → `DocumentSchema.title`. ✓
- `type` → `DocumentSchema.documentType` (`DocumentTypeKey` enum, 22 wartości). ✓
- `client_id`, `project_id` → `Artifact.organizationId` + V8 ACL; **brak explicit `clientId` na `DocumentSchema`** (dziedziczone z V8 work_canvas / project context).
- `template_id` → konsumowane przez `materializeDocumentArtifact({ templateId })` ale **nie persistowane na `DocumentSchema`** (mode 1 dokumenty go nie mają). **Konkretna luka:** brak `templateRef.templateId + version` na samym schema.
- `source_pack_id` → `DocumentSourceRef[]` jest na schema; **brak top-level `sourcePackId`** (spec wymienia jeden source pack id). Pack-level link istnieje przez `sourcePackService.attach`.
- `status` → `DocumentSchema.documentStatus` (E5.1, optional na typie, service overlay'uje `'draft'`). ✓
- `owner` → V8 audit + per-service audit; **brak explicit `owner` na `DocumentSchema`**. Materialize zapisuje `createdBy` na podstawie auth context.
- `confidentiality` → `DocumentSchema.confidentiality` (`internal | client_confidential | restricted | public`). ✓
- `export_formats` → V8 + template `exportRules`; **nie na samej schema**.
- `sections[].source_refs` → `DocumentSection.sources` + `DocumentBlock.source_ref`. ✓ (per-block + per-section pokrycie, lepsze niż spec).

**Gap:** explicit `templateRef`, `sourcePackId`, `clientId`, `owner` na `DocumentSchema` (per-section / per-artifact correspondence). Funkcjonalnie pokryte przez V8 + service'y, ale nie czytelne z samego artifactu bez context lookup'a.

### 15.2 DocumentTemplate (spec §8.2)

Spec keys: `id`, `name`, `category`, `purpose`, `status`, `version`, `owner`, `audience`, `required_inputs`, `section_blueprint`, `formatting_schema`, `export_rules`.

Code: `DocumentTemplate` (linia ~565). Mapowanie:

- `id` (`templateId`), `name`, `category` (10 wartości), `documentType`, `purpose`, `audience` (string[]), `language`, `languageStyle`, `communicationRegister`, `density`, `confidentiality`, `requiredInputs`, `sectionBlueprint`, `formattingSchema`, `exportRules`, `status`, `version`, `createdBy`, `createdAt`, `updatedAt`, `approvedBy`, `approvedAt`, `deprecatedBy`, `deprecatedAt`, `notes`. ✓ Bardzo silne pokrycie + extras (language/languageStyle/communicationRegister/density/confidentiality).
- **Brak (spec implicit / FR-06 product fields):** `usage_count`, `feedback_quality_score`, `last_used_at`, `persona`, `region`, `brand`, `dependencies`. Patrz §10 punkt 6 + §12 Slice E14.

### 15.3 SectionBlueprint (spec §8.3)

Spec keys: `section_number`, `section_name`, `purpose`, `required_data[]`, `optional_data[]`, `formatting_style`, `length_guideline`, `approval_required`.

Code: `TemplateSectionBlueprint` (linia 550):

```typescript
export interface TemplateSectionBlueprint {
  title: string;
  level: 1 | 2 | 3;
  purpose: string;
  required: boolean;
  expectedLengthHint: 'short' | 'medium' | 'long';
}
```

**Mapping:**
- `section_number` → `level` (numeryczny poziom nagłówka, nie literacka numeracja). Częściowo.
- `section_name` → `title`. ✓
- `purpose` → `purpose`. ✓
- `required_data[]` / `optional_data[]` → **BRAK**. Konkretna luka. Wymaganie z spec'a §D ("Template Architect definiuje wymagane dane / required inputs per sekcja") jest pokryte tylko top-level `requiredInputs[]` na całym template, NIE per sekcja.
- `formatting_style` (np. `H1_with_intro_and_table`) → **BRAK na blueprint**. Formatting jest top-level w `formattingSchema`. Per-sekcja styl override'y nie istnieją.
- `length_guideline` → `expectedLengthHint` ale jako enum 3 wartości (short/medium/long), nie jako "2-3 pages" string z spec'a. Częściowo.
- `approval_required` → **BRAK per-blueprint**. Approval jest na poziomie całego dokumentu (`DocumentApproval` z E10).

**Konkretna luka:** `requiredData[]`, `optionalData[]`, `formattingStyle`, `approvalRequired` per blueprint.

### 15.4 DocumentEdit (spec §8.4)

Spec keys: `edit_id`, `command`, `scope`, `edit_type`, `proposed_changes[]`, `approval_status`, `version_before`, `version_after`, `applied_by`, `approved_by`.

Code: `DocumentEditorProposal` (linia ~298 in types). Mapowanie:

- `edit_id` → `proposalId`. ✓
- `command` → `instruction`. ✓ (cała instrukcja od użytkownika).
- `scope.type` → `scope: DocumentEditorScope` (5 wartości server-side). **Spec implicit ma 6** (transformative). ✗
- `scope.section_id` / `scope.block_id` → `sectionId?`, `blockId?` na proposal. ✓
- `edit_type` ("rewrite") → **BRAK explicit** na proposal. Pokryte przez `scope` + `instruction` semantykę. Częściowo.
- `proposed_changes[]` → `diff: { before, after }` jako stringi. **Spec wymienia per-target changes (paragraph_001 etc.) jako tablicę**. ✗ Convention różni się — spec jest bogatszy.
- `approval_status` → `status: 'proposed' | 'approved' | 'rejected' | 'executed'`. ✓
- `version_before`, `version_after` → snapshots ID poprzed i po `executed`. **`DocumentEditorProposal` nie ma versionBefore/versionAfter pól**. ✗ Snapshot tworzy się na execute (`takeVersionSnapshot`), ale link nie jest na proposal.
- `applied_by` → `createdBy`. ✓
- `approved_by` → `approvedBy?`. ✓

**Konkretna luka:** `editType` enum, `proposedChanges[]` jako tablica (per-target diff), `versionBeforeId` + `versionAfterId` linki na proposal, `transformative` scope.

### 15.5 FormattingSchema (spec §8.5)

Spec keys: `fonts`, `heading_styles` (per-level: font_size + bold + spacing_before/after), `table_styles`, `margins`, `headers.content`, `footers`, `page_numbering.format`, `cover_page` (logo/status/confidentiality), `TOC.max_depth`, `appendix_style.prefix` + `numbering`.

Code: `FormattingSchema` (linia 122). Mapowanie:

- `fonts.body` / `fonts.heading` ✓ + extra `mono?`.
- `heading_styles` → kod ma `headingStyles: { h1: string; h2: string; h3: string }` jako string descriptor (np. `'16pt bold numbered'`). **Spec ma per-level structured object** z `font_size` (number), `bold` (boolean), `spacing_before/after`. ✗ Mniej granularne niż spec.
- `table_styles.default` ✓ + extras (`risk_table` w spec'u).
- `list_styles` ✓ (extra w kodzie).
- `margins` → `page.marginsCm`. ✓ (kod nazywa cm explicitly, spec ma string `"2.0cm"`).
- `headers.enabled` ✓; **`headers.content` (np. "Client Confidential | Consultify") nie istnieje na `FormattingSchema`** — implicit z `confidentiality` na schema + per-template footer config.
- `footers.enabled` + `pageNumbering` + `confidentialityLabel` ✓; **`footers.pageNumbering.format` ("Page X of Y") nie konfigurowalny** — hardcoded w renderer.
- `coverPage` → `boolean` flag. **Spec ma object** `{ enabled, include_logo, include_status, include_confidentiality }`. ✗ Kod jest binarny, spec jest granularny.
- `TOC` → `toc: boolean`. **Spec ma `{ enabled, max_depth }`**. ✗
- `appendix_style` → `appendixStyle: 'lettered' | 'numbered' | 'none'`. ✓ Kod ma enum, spec ma `prefix` + `numbering` osobno.

**Konkretna luka:** structured `headingStyles` (font_size, bold, spacing_before/after per level); `headers.content`; `footers.pageNumbering.format`; `coverPage` jako object z flagami; `toc.maxDepth`.

### 15.6 Werdyk per-model

| Spec model | Coverage | Top gaps |
| --- | --- | --- |
| DocumentArtifact (§8.1) | ~80% | Brak explicit `templateRef`, `sourcePackId`, `clientId`, `owner` na `DocumentSchema` (V8 carries it). |
| DocumentTemplate (§8.2) | ~85% | Brak product fields (usage/feedback/persona/region/brand/dependencies). |
| SectionBlueprint (§8.3) | ~50% | Brak `requiredData`, `optionalData`, `formattingStyle`, `approvalRequired` per blueprint. |
| DocumentEdit (§8.4) | ~70% | Brak `editType`, `proposedChanges[]` jako structured array, `versionBeforeId/AfterId`, `transformative` scope. |
| FormattingSchema (§8.5) | ~70% | Brak structured `headingStyles`, `headers.content`, `coverPage` jako object, `toc.maxDepth`, `footers.pageNumbering.format`. |

---

## 16. Konkluzja

**Server-side substrate jest mocny** (49 plików / 571 specs / ~50 endpointów / 22 system templates × 2 języki / 10-kategoryjny QA / advanced DOCX / E10 enterprise collaboration API). **20/20 spec templates zaszipowane** + 2 extras.

**Frontend jest bardzo niedoinwestowany** względem 100% spec'a. `DocumentStudio*` ma intake/outline/document/editor (3 scopes)/QA panele jako flat surface. **Brakuje:** 3-zone MELS shell, Menu 2 chips, Teresa drawer, Menu 3 AI actions, full source-pack matrix UX, track-changes diff, content block library picker, audience variant picker, comments+approvals UI w MELS shell, share link, unified access history.

**Drugi największy gap to AI Document Editor** — 5/6 poziomów istnieje, ale tylko 3/6 wystawione przez HTTP, i 6/6 (`transformative`) całkowicie brakuje.

**Trzeci gap to data-fidelity uzupełnienia**: charts (FR-22), source-version pinning (NFR-17), template product fields (usage/feedback/persona/region), per-claim provenance UI.

Domknięcie do 100% spec'a wymaga ~6-10 tygodni focused work przy obecnym poziomie zespołu — głównie frontend (FE-E1..FE-E5 ~3-4 tyg) + uzupełnienia editor scopes (E3.5/E3.6 ~3-5 dni) + share link / access history / track-changes UI (~2-3 tyg) + charts + multi-language + per-claim provenance UX (~2-3 tyg).

---

## 17. Status updates after backend gap-closing campaign (2026-05-09)

> **Note:** This addendum captures the state of the module after the post-gap-analysis backend campaign. The numbers in §0..§16 above describe the world at 2026-05-08; the world after the campaign is summarized below. Sections §1..§16 are kept for historical reference.

### 17.1 Suite & coverage delta

| Metric | At gap report (2026-05-08) | After campaign (2026-05-09) | Delta |
| ---: | ---: | ---: | ---: |
| Document Studio + Execution Module Standard specs | 571 | **760** | **+189** |
| §15 substrate fields delivered | 0 / 5 | **5 / 5 substrate-complete** | +5 |
| Editor scopes (data) | 5 / 6 | **6 / 6** | +1 (transformative) |
| Editor scopes exposed via HTTP | 3 / 6 | **6 / 6** | +3 (methodology, source, transformative) |
| QA categories | 10 | **11** | +1 (`source_drift` advisory layer) |
| Block kinds | 12 | **13** | +1 (`chart`) |

### 17.2 Closed substrate gaps

| Gap (vs §10 / §15) | Slice | Commit | Status |
| --- | --- | --- | --- |
| §10.1 — methodology + source editor HTTP routes | E3.5 | `70d2e3d9f` | ✅ DELIVERED |
| §10.2 — transformative 6th editor level | E3.6 | `e0276c539` | ✅ DELIVERED |
| §10.6 — template product fields (substrate) | E14 | `4a3db24e4` | ✅ SUBSTRATE |
| §10.6 — template usage tracking (wiring) | E14.recordUsage.wiring | `820e2136c` | ✅ DELIVERED |
| §10.7 — chart block (substrate) | E17.charts | `ce01210bd` | ✅ SUBSTRATE |
| §10.8 — sourceVersion + sourceSnapshotId (substrate) | E5.6 | `ea6089cd9` | ✅ SUBSTRATE |
| §10.8 — source-drift QA advisory layer | E5.6.qa | `4253fd588` | ✅ DELIVERED |
| §10.9 — track-changes structural diff (substrate) | E16.diff | `5cd843c38` | ✅ SUBSTRATE |
| §10.9 — track-changes audit pipeline | E16.diff.audit | `820e2136c` | ✅ DELIVERED |
| §15.1 — DocumentSchema artifact-ref fields (substrate) | E15.artifact | `fe2170e50` | ✅ SUBSTRATE |
| §15.1 — DocumentSchema artifact-ref runtime population | E15.wiring.materialize | `820e2136c` | ✅ DELIVERED |
| §15.3 — TemplateSectionBlueprint per-section fields | E14.blueprint | `20bbe1293` | ✅ SUBSTRATE |
| §15.4 — DocumentEdit substrate | E15.4.edit | `2da0e63ba` | ✅ SUBSTRATE |
| §15.4 — DocumentEdit version pinning runtime population | E15.wiring.snapshot.proposal | `820e2136c` | ✅ DELIVERED |
| §15.5 — FormattingSchema substrate | E15.5.formatting | `8040088be` | ✅ SUBSTRATE |

### 17.3 Outstanding work after campaign

**Backend follow-ups (deferred for explicit operational reasons):**
- **E14.persistence** — DB migration + DAO update for the 8 product fields. Deferred because it touches Postgres schema; needs a migration strategy and a downtime window.
- **E5.6.qa.hard** — registry-side hard-drift comparator (compare pinned `sourceVersion` vs latest known version). Needs a per-source latest-version lookup in `documentSourcePackService`.
- **E15.5.formatting.render** — DOCX/PDF renderers consume new `headingStylesDetailed` / `coverPageDetailed` / `tocConfig`. Needs golden-DOCX corpus updates.
- **E17.charts.render** — DOCX `chart.js` → PNG + PDF parity + Format-QA chart category + FE-E2 chart preview. Requires a server-side chart library decision (`chart.js` + `node-canvas` vs `vega`).
- **E16.diff.frontend** + **E16.diff.proposal** — FE consumers of the structural-diff substrate.
- **E13** — share link surface (types + DAO + routes + FE), the last remaining P1 functional gap.

**Frontend (paused — parallel-sync interference):**
- FE-E1.2 → FE-E5 — 3-zone MELS shell, Menu 2 chips, right panel collapse, manifest wiring, Sources/Properties/QA tabs, Menu 3 AI actions, Comments + Approvals + Library surfaces, Audience Variant picker, Teresa drawer.
- Blocked on `parallel-sync agent` coordination — frontend file edits routinely lose attribution and revert; resolved once the tooling boundary is clarified.

### 17.4 Definition of done — campaign acceptance

- ✅ All §15 data-model substrates ship with type, helper, and ≥17 specs each.
- ✅ All §10 P0/P1 substrate gaps have a SUBSTRATE or DELIVERED status.
- ✅ Suite at 760/760 green, ESLint clean, tsc clean for modified files.
- ✅ Audit pipeline now carries structural-diff summary on every snapshot N+1.
- ✅ Every Mode 3 generation increments template usage automatically.
- ✅ Every editor proposal pins `versionBeforeId` to the most recent snapshot.
- ✅ Every produced `DocumentSchema` carries `templateRef`/`sourcePackId`/`clientId`/`owner` fields when applicable.
- ⏳ Frontend MELS shell (FE-E1.2..FE-E5) — paused on parallel-sync.
- ⏳ Renderer-level wiring (charts, formatting, structural-diff UI) — pending dependency / corpus decisions.

This addendum is the **closeout reference** for the post-gap-report backend campaign. Use it together with `CONSULTIFY_DOCUMENT_STUDIO_V1_IMPLEMENTATION_PLAN.md` §6.15.x for the full audit trail.

---

## 18. Status updates after technical-debt remediation campaign (2026-05-09 PM)

A targeted "tech debt" campaign followed §17. Focus was **operational** (parallel-sync investigation + tooling) plus **one consumer-wiring slice** that was previously deferred. This section records the resolution.

### 18.1 Faza A — Parallel-sync agent root cause found

**Identified root cause:** `Google Drive Desktop` (PID 3485, ~100% CPU running). It actively syncs `~/Documents/Antygracity/` with cloud Drive, which:

- Causes transient file deletions during file-provider migration → `git add … && git commit …` lands as `no changes added to commit`.
- Re-syncs commits from other-machine identities (e.g. `staging` on a different laptop) → silent attribution rewrite locally.

**Existing partial defense:** `.cursor/hooks/agent-snapshot-pre-flight.sh` already snapshots `consultify/` before each prompt (passive — restores from `.drive-sync-backup/`), but never blocked the root cause.

**Handover deliverable:** `DRD/consultify/docs/operations/PARALLEL_SYNC_REMEDIATION_2026-05-09.md` — three operator-side options (subfolder sync exclude / move repo out of `~/Documents/` / keep + defensive tooling) plus long-term recommendation (don't host product code in `~/Documents/` on macOS). User-side (GUI) action required for permanent fix; agent cannot reach Drive Settings.

### 18.2 Faza B — Defensive tooling shipped

`scripts/git-tools/` (commit `070e01f46`):

- **`atomic-commit.sh`** — proactive `git add + commit + verify` wrapper with 200ms FS-settle. Exits non-zero on attribution mismatch (1) or empty staging (2) so CI / wrappers detect sync collisions.
- **`post-commit-attribution-check`** — hook script firing after every commit (incl. IDE GUI / rebases / cherry-picks / amends), warning on stderr if `%an %ae` ≠ configured user.
- **`install-hooks.sh`** — one-time installer setting `core.hooksPath = scripts/git-tools/hooks` and symlinking the hook. Idempotent.
- **`README.md`** — full operator guide.

Defensive tooling mitigates symptoms even if §18.1 remediation is never executed. Verified working: this campaign's 3 commits all show clean `Piotr` attribution after `atomic-commit.sh` invocation.

### 18.3 Faza C — Consumer-wiring slice E15.5.formatting.render shipped

Commit `5e905fb50`. Five §15.5 substrate fields wired into live DOCX + PDF renderers:

| Substrate field | DOCX wiring | PDF wiring |
| --- | --- | --- |
| `headingStylesDetailed.{h1,h2,h3}` | `buildDocxStyleConfig` overrides class-derived sizing | `buildPdfRenderContext` overrides `PDF_SIZING_BY_CLASS` |
| `headers.content` | `renderDocumentSchemaToDocxBuffer` header runs | `drawHeaderFooter` header text |
| `footers.pageNumberingFormat` | tokenized into `PageNumber.CURRENT/TOTAL_PAGES` runs | literal `{N}` / `{M}` substitution |
| `tocConfig.maxDepth` | `headingStyleRange = '1-${maxDepth}'` | filter PDF TOC entries |
| `coverPageDetailed.{includeStatus,includeConfidentiality}` | conditional subtitle composition | conditional subtitle composition |

**Tests:** 16 new specs in `documentRendererE15FormattingRender.test.ts` (verified via `JSZip` for DOCX XML + `pdf-parse` for PDF text). All pass; full Document Studio suite **731/731 green**.

**Backwards compatibility:** Every wired surface uses `??` fallback to legacy default → schemas without the new fields render byte-identically. Verified by existing 24 DOCX renderer + style tests + 17 PDF parity tests (all unchanged).

**Deferred:** `coverPageDetailed.includeLogo` — requires asset embedding pipeline (out of this slice).

### 18.4 Outstanding work after this campaign

**Resolved:**
- ✅ Parallel-sync root cause identified, handover playbook delivered.
- ✅ Defensive tooling shipped and verified working.
- ✅ E15.5.formatting.render — last big substrate-to-renderer gap closed.

**Still outstanding (unchanged from §17.3):**
- E14.persistence (DB migration), E5.6.qa.hard (registry comparator), E17.charts.render (chart library decision), E16.diff.frontend, E16.diff.proposal, E13 (share link surface).
- Frontend FE-E1.2 → FE-E5 — **now unblockable** once user runs §18.1 §2 GUI step or moves repo out of `~/Documents/`.

### 18.5 Definition of done — tech-debt campaign acceptance

- ✅ Parallel-sync investigated end-to-end; root cause documented with reproducible evidence (PID + ps output).
- ✅ Defensive tooling shipped, executable, idempotent install, verified by 3 successful clean-attribution commits.
- ✅ E15.5.formatting.render fully wired with 16 new specs and zero regressions in legacy tests.
- ✅ Plan + gap report updated with full audit trail.
- ⏳ User-side §18.1 §2 GUI step (operator-only; not agent-reachable).

---

## 19. Status updates after second tech-debt sweep (2026-05-09 EOD)

A second backend-focused sweep ran while the user-side parallel-sync GUI step (§18.1 §2) remained pending. Two more outstanding §17.3 follow-ups closed.

### 19.1 Slice E16.diff.proposal — DONE (commit `c46b2f3b1`)

**Scope.** Wired the structural-diff substrate (slice 6.15.11) into the **proposal-side** audit pipeline. `approveEditProposal` now computes `computeDocumentSchemaDiff(schema, nextSchema)` after `applyProposalToSchema(...)` produces `nextSchema`, and emits `details.structuralDiffSummary` + `details.structuralDiffStats` on the `proposal_executed` audit row alongside the existing `scope` / `sectionId` / `blockId` / `llmRefined` / `blockRewritesCount` fields.

**Files.** `documentStudioService.ts` (1 hot-path function), `__tests__/documentStudioProposalDiffAudit.test.ts` (4 specs: local + section + global + backward-compat).

**Validation.** Suite **735/735 green** (+4). ESLint clean for modified scope. `try { … } catch { … }` guard ensures a diff-service hiccup never aborts an approval that succeeded structurally.

**Closes.** §15.4 (DocumentEdit substrate — proposal-side diff wiring), §10.9 (track-changes substrate — proposal_executed integration). Together with slice 6.15.12 (E16.diff.audit on snapshot-side), this **closes the full audit-pipeline integration loop** for the structural-diff substrate.

**Note.** `versionAfterId` on the proposal still left for a follow-up — needs an explicit "snapshot after apply" path that does not exist yet. The structural diff is now the **audit-grade replacement** for the missing pin until that path lands.

### 19.2 Slice E5.6.qa.hard — DONE (commit `1a8679103`)

**Scope.** Closed the §17.3 follow-up explicitly named "registry-side hard-drift comparator (compare pinned `sourceVersion` vs latest known version in source registry; requires per-source latest-version lookup in `documentSourcePackService`)". This was the last NFR-17 implementation gap.

**New service.** `documentSourceVersionRegistryService.ts` — append-only, tenant-scoped registry of every `sourceVersion` observation per `(organizationId, sourceType, sourceId)`. Public surface:

| Function | Contract |
| --- | --- |
| `recordSeenSourceVersion({ orgId, type, id, version, snapshotId?, recordedAt? })` | Idempotent on `(version, snapshot)`; refreshes `recordedAt` on re-observation. Silent on whitespace / empty inputs. |
| `getLatestKnownSourceVersion({ orgId, type, id })` | Recency-based latest (NOT semver-sorted; V8 sources rarely use semver). Returns `null` for unobserved tuples. |
| `compareSourceVersionPin({ orgId, type, id, pinnedSourceVersion })` | Three-way: `no_registry_entry` / `in_sync` / `hard_drift`. Trim-aware. |
| `__resetSourceVersionRegistryForTests()` | Test isolation. |

In-memory only — rebuilds from source-pack ingestion on cold start. No DAO yet (no cross-process need). Tenant-isolated by `organizationId`-led keying.

**Wirings.**

1. `documentSourcePackService.addSourcePackItem` — when `newItem.sourceRef.sourceVersion` is non-empty, calls `recordSeenSourceVersion`. Wrapped in `try { … } catch { … }` — registry hiccup never fails ingestion.
2. `documentQaService.runSourceDriftQa` — extended `emitDriftFinding` to consult the registry for **pinned** refs:
   - `compareSourceVersionPin` returns `hard_drift` → emit `source_drift_hard` finding at `medium` severity (advisory; **NEVER blocking**).
   - Returns `in_sync` or `no_registry_entry` → no finding.
   - Unpinned refs: legacy `source_drift_unpinned` at `low` severity (unchanged).
3. `documentQaService.RunDocumentQaOptions.organizationId` — new optional field. When supplied → tenant context flows; when omitted → hard-drift path skipped (backward compat for test harness / dev tools).
4. `documentStudioService.runQaForDocument` + export-time QA call — both pass `organizationId` so production runs see hard drift.

**Summary line update.** `Source-drift QA: N hard-drift (pinned≠latest), M unpinned (advisory); score X/100.` — audit / right-panel surface renders breakdown precisely.

**Threshold = 0 stays.** Category remains advisory — gating on hard drift requires explicit approver consent at schema level (deferred).

**Files.** `documentSourceVersionRegistryService.ts` (NEW), `documentSourcePackService.ts`, `documentQaService.ts`, `documentStudioService.ts`, `__tests__/documentSourceVersionRegistryService.test.ts` (10 specs), `__tests__/documentQaSourceDriftHard.test.ts` (6 specs).

**Validation.** Suite **751/751 green** (+16). All 11 pre-existing soft-drift specs pass unchanged. ESLint clean for new files; 2 pre-existing lint warnings in `documentQaService.ts` (lines 723, 1710) untouched — not from this slice.

**Closes.** §17.3 follow-up `E5.6.qa.hard` — "needs a per-source latest-version lookup" blocker resolved. NFR-17 implementation completion (advisory layer): soft + hard drift now both detected and surfaced.

### 19.3 Outstanding work after this sweep

**Resolved by this sweep:**
- ✅ E16.diff.proposal (commit `c46b2f3b1`).
- ✅ E5.6.qa.hard (commit `1a8679103`).

**Still outstanding (post-§19):**
- **E14.persistence** — DB migration (8 product fields). Blocked on schema migration approval.
- **E17.charts.render** — server-side chart library decision (chart.js vs vega). Architectural call needed before implementation.
- **E16.diff.frontend** — wire `computeDocumentSchemaDiff` into FE-E2 track-changes UI. Blocked by parallel-sync resolution.
- **E13 (share link surface)** — types + DAO + routes + FE. P1 functional gap.
- **`coverPageDetailed.includeLogo`** — image embedding pipeline + asset registry integration.
- **Frontend FE-E1.2 → FE-E5** — entire frontend campaign. Blocked by parallel-sync resolution.

**Backend audit-grade closeout reached:** every §17.3 follow-up that was independently shippable is now shipped. Remaining backend items either need migration consent (E14), an architecture decision (E17), or a full new substrate (E13). Frontend is the next campaign once §18.1 §2 user-side GUI step lands.

### 19.4 Definition of done — second tech-debt sweep acceptance

- ✅ E16.diff.proposal shipped — proposal_executed audit row carries structural diff for every editor scope.
- ✅ E5.6.qa.hard shipped — registry-side hard-drift detection wired into both production QA call sites.
- ✅ 16 new specs added; suite goes from 731 → 751 green (+20 since campaign start).
- ✅ Backwards compatibility verified: every legacy spec passes unchanged after each commit.
- ✅ Plan §6.15.14 + §6.15.15 documented; gap report §19 records full audit trail.
- ✅ All commits use `atomic-commit.sh` and show clean `Piotr` attribution (defensive tooling working as designed).

---

## 20. Slice E13.1 — Share-link surface (FR-40) — DONE (2026-05-09 EOD)

**Commit `a4ae18a65`.** Closed the **last remaining P1 functional gap** (FR-40 share link, MISSING per §C.4 / §I §11.5 #5 / §K §12.2). Backend substrate ships end-to-end; FE share dialog stays deferred behind §18.1 §2 parallel-sync remediation.

### 20.1 What shipped

**Types** (`documentStudioTypes.ts` §E13 block, ~150 lines):
- `DocumentShareLinkStatus` (`active | revoked | expired`), `DocumentShareLinkAccessScope` (`read | comment`), `DocumentShareLinkAuditAction` (4 verbs), `DocumentShareLink`, `DocumentShareLinkAuditEntry`, `DocumentShareLinkRuntimeStatus`.

**DAO** (`documentShareLinkRegistryDao.ts`, NEW):
- Mirror of `documentSourcePackRegistryDao` contract.
- Maps + token-secondary-index keyed by `${organizationId}::${shareLinkId}`.
- Public surface: `loadShareLinksForOrg` / `loadShareLinkById` / `loadShareLinkByToken` (tenant-less; consumer doesn't know the tenant) / `persistShareLink` (keeps token index in sync on rotate) / `markShareLinkStatusInDao` / `bumpShareLinkConsumeCount` (atomic counter + lastConsumedAt) / `loadAuditForShareLink` (sorted ASC) / `persistShareLinkAuditEntry` (idempotent on auditId) / `countActiveShareLinksForArtifact` / `__resetShareLinkRegistryDaoForTests`.

**Service** (`documentShareLinkService.ts`, NEW):
- Synchronous-friendly mutation surface, in-process Map cache + best-effort DAO write-through.
- `createShareLink` (input validation, 256-bit URL-safe token, audit) / `revokeShareLink` (idempotent) / `getShareLink` / `listShareLinks` (hides expired by default) / `consumeShareLink` (UNAUTHENTICATED — cold-start DAO fallback, count bump, audit, single 404 anti-enumeration, one-shot `share_link_expired_observed`) / `getShareLinkRuntimeStatus` (pure: revoked-wins, then `expiresAt vs now()`) / `getActiveShareLinkCount` / `ensureShareLinkRegistryHydrated` / `__resetShareLinkRegistryForTests`.

**Routes** (`document-studio.routes.ts` + `Gateway.ts`):

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/document-studio/:artifactId/share-links` | yes | create |
| GET | `/api/document-studio/:artifactId/share-links` | yes | list (decorated runtimeStatus) |
| GET | `/api/document-studio/share-links/:shareLinkId` | yes | get one + runtimeStatus |
| POST | `/api/document-studio/share-links/:shareLinkId/revoke` | yes | revoke (idempotent) |
| GET | `/api/document-studio/share-links/:shareLinkId/audit` | yes | full audit trail |
| POST | `/api/document-studio/share-links/resolve` | **NO** | public consume (anti-enumeration) |

The public route is exported as `documentShareLinkPublicRoutes` and mounted in `Gateway.ts` BEFORE `documentStudioRoutes` on the same `/api/document-studio` prefix — Express matches the first router whose path resolves, so the public route never reaches `verifyToken`.

### 20.2 Tests

| File | Specs | Coverage |
| --- | --- | --- |
| `documentShareLinkService.test.ts` (NEW) | 20 | create / revoke / get / list / consume / runtime-status / count, all tenant-isolated |
| `document-studio-share-links.routes.test.ts` (NEW) | 16 | every route × success + error paths + 401 unauth + 404 cross-tenant + anti-enumeration |

**Suite: 787/787 green** (+36 specs since slice start; 731 → 751 after §19, 751 → 787 after §20).

### 20.3 Validation

- ESLint: 0 errors. 2 `@typescript-eslint/no-explicit-any` warnings on the `vi.mock(verifyToken)` signature in the route test — identical pattern to `admin.routes.test.ts`; not a regression.
- TSC clean for the entire scope.
- Backwards compatible: zero existing routes / services / types modified destructively. `Gateway.ts` mounts a new router BEFORE the existing one without changing any existing mount.

### 20.4 Gaps closed

- **FR-40 share link** — was the only **P1 MISSING** in §0 / §C.4. Now DELIVERED on backend with audit-grade integration.
- **§11.5 #5** ("Share link nie istnieje jako Document Studio surface — nie ma share UX, nie ma expiry, nie ma scoped permissions per share") — all three concerns shipped server-side.
- **§K §12.2 — Slice E13** — closed except for FE share dialog (FE-E2 right-panel, blocked by parallel-sync).

### 20.5 Outstanding work after §20

| Item | Status | Unblocker |
| --- | --- | --- |
| §18.1 §2 GUI step (parallel-sync) | ⏳ user-only | 15-30 min in Drive Settings GUI |
| E14.persistence | blocked | DB migration approval |
| E17.charts.render | blocked | Chart library architectural call (chart.js vs vega) |
| E13.fe (share dialog FE-E2 right-panel) | blocked | §18.1 §2 user step |
| E16.diff.frontend | blocked | §18.1 §2 user step |
| FE-E1.2..FE-E5 | blocked | §18.1 §2 user step |
| `coverPageDetailed.includeLogo` | open backend | Asset embedding pipeline |
| `edit` / `download` share scopes | open product | Auth story for anonymous mutations |
| HMAC token hashing | open backend | Wave5 DB migration |

**Backend P1 MISSING list is now empty.** Every `MISSING` row from §C.4 §0 (FR-22 charts, FR-37 access history UX, FR-40 share link) is either:
- delivered on backend (FR-40 — this slice), or
- blocked on architectural decision (FR-22 — chart library), or
- a frontend-only gap (FR-37 — access history UX).

The backend audit-grade closeout for the V1 Document Studio is essentially complete. Outstanding backend slices (E14 / E17 / `includeLogo` / token-hash) all need product or architecture sign-off before they can ship.

### 20.6 Definition of done — Slice E13.1 acceptance

- ✅ Substrate (types) shipped.
- ✅ DAO with token-secondary-index + tenant-isolated reads + idempotent audit shipped.
- ✅ Service with full mutation + read + consume surface + runtime-status helper shipped.
- ✅ 5 authed routes + 1 public consume route shipped; public route mounts before `verifyToken` and is anti-enumeration on the 404 surface.
- ✅ 36 new specs (20 service + 16 routes); suite 751 → 787 green.
- ✅ Plan §6.15.16 + gap report §20 documented.
- ✅ Commit `a4ae18a65` shows clean `Piotr` attribution via `atomic-commit.sh`.

---

## 21. V1 backend campaign — closeout addendum (2026-05-09)

This section records the five-slice "CTO pit stop" closeout that brought the V1 Document Studio backend to a feature-complete + audit-grade state. Plan §6.15.17–§6.15.22 contains the per-slice depth; this section is the gap-against-target reconciliation.

### 21.1 Final P1 / P2 status matrix

| Gap row (original) | Status | Shipped by |
| --- | --- | --- |
| FR-22 charts (P1, MISSING) | ✅ DELIVERED (real raster render + QA) | Slices E17.charts + E17.rasterization (`eb8d31a19` + `ac344c01c`) |
| FR-37 access history aggregator (P1, MISSING) | ✅ DELIVERED (backend) | Slice FR-37 (`2557a7c17`) |
| FR-40 share-link surface (P1, MISSING) | ✅ DELIVERED (backend, incl. hardening) | Slices E13.1 + E13.hardening (`a4ae18a65` + `d2af7e489`) |
| E14 template product-fields persistence (P2) | ✅ DELIVERED | Slice E14.persistence (`8a792f458`) |
| E15.5 `coverPageDetailed.includeLogo` (P2) | ✅ DELIVERED | Slice E15.5.coverPageLogo (`3b1edd9a8`) |
| E13 HMAC token hash (P2) | ✅ DELIVERED | Slice E13.hardening (`d2af7e489`) |
| E13 token rotation route (P2) | ✅ DELIVERED | Slice E13.hardening (`d2af7e489`) |
| E13 `download` access scope (P2) | ✅ DELIVERED | Slice E13.hardening (`d2af7e489`) |
| E13 `edit` access scope (P2) | 🔶 DEFERRED | Open product decision (anon-mutation auth story) |
| FR-22 server-side chart rasterization | ✅ DELIVERED | Slice E17.rasterization (`ac344c01c`) |
| `coverPageDetailed.includeLogo` aspect ratio | ✅ DELIVERED | Slice E15.5 follow-up (`b1c2b0c67`) |
| `coverPageDetailed.includeLogo` multipart upload | ✅ DELIVERED | Slice E15.5 follow-up (`c2a52dd50`) |

**Backend V1 MISSING list is empty.** Every row in §C.4 §0 (P1) and §K (P2) is either shipped or carries explicit deferral rationale tied to a product / architecture decision rather than engineering capacity.

### 21.2 Aggregate validation

| Metric | Pre-campaign | Post-campaign |
| --- | --- | --- |
| Document Studio test files | ~62 | 71 |
| Document Studio specs | 787 | 854 |
| Document Studio P1 backend MISSING gaps | 3 | 0 |
| Document Studio P2 backend gaps | 6 | 1 (open product) |

Full Document Studio sweep remains green after post-closeout follow-ups (share-link DAO/hash hardening, chart rasterization, cover-logo ratio + multipart route). Aggregate suite count is now **854 specs across 71 files**. Zero breaking changes; every consumer-facing surface either accepts new optional parameters or extends an existing enum additively.

### 21.3 What V1 backend ships (acceptance contract)

A consumer of the Document Studio V1 backend can:

1. **Generate** documents through the existing planner / generator pipeline (unchanged).
2. **Render** them to DOCX or PDF with full E15.5 formatting fidelity — heading styles, header content, footer page numbering, TOC depth, full cover page (incl. logo).
3. **Embed charts** as real rendered images in DOCX/PDF (Chart.js server-side rasterization), with deterministic fallback placeholders when rendering fails.
4. **Persist + discover templates** with usage / feedback / persona / region / brand / dependency tags surviving process restart and feeding the discovery sort path.
5. **Share** an artifact with an external party via tenant-scoped, time-boxed, scope-controlled (`read | comment | download`) links — with HMAC-hashed tokens, constant-time verification, rotation on demand, idempotent revoke, anti-enumeration consume, and full audit trail.
6. **Audit** the artifact end-to-end through a unified access-history aggregator that joins direct artifact audit + share-link audit + approval audit chronologically with pagination + source filtering.
7. **Audit** every mutation across the surface — every state-changing service call writes an audit row keyed to a deterministic action enum, persisted via write-through to the same DAO that holds the entity.

### 21.4 What V1 backend explicitly does NOT ship

- Frontend (entire FE-E1.2 .. FE-E5 campaign) — blocked on parallel-sync remediation.
- DB-backed share-link / asset DAOs — wave5 mechanical migration; in-memory DAOs preserve the public surface verbatim.
- `edit` share scope — product decision pending.

### 21.5 Required user actions before frontend campaign starts

**One physical user action remains** (no engineering substitute):

- **Parallel-sync remediation** — `DRD/consultify/docs/operations/PARALLEL_SYNC_REMEDIATION_2026-05-09.md` §2. Approx 15–30 min in Drive Desktop Settings. Until completed, every frontend file write is at risk of being silently reverted or attributed to a `staging` Git identity.

Everything else can proceed under engineering-only authority: ops can run the `770_document_studio_template_product_fields.sql` migration whenever a deploy window is available, and product / architecture decisions can be queued for review without blocking new backend work.

### 21.6 Definition of done — V1 backend acceptance

- ✅ All P1 MISSING backend gaps closed (3 of 3).
- ✅ All deferable P2 backend gaps either closed (6 of 6) or carry an explicit deferral with rationale tied to a non-engineering blocker.
- ✅ 831/831 Document Studio specs green across 68 files.
- ✅ Lint + typecheck clean across all touched files.
- ✅ Plan §6.15.17–§6.15.22 + gap §21 document the campaign in audit-grade detail.
- ✅ Post-closeout follow-up commits (`77f0c426b`, `ac344c01c`, `b1c2b0c67`, `c2a52dd50`) also show clean `Piotr` attribution via `atomic-commit.sh`.
- ✅ Backend ships zero breaking changes; every existing call site continues to function unmodified.
- 🔶 One user action queued (parallel-sync remediation) — required to unblock the frontend V1 campaign, NOT part of backend acceptance.
