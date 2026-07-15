# PROGRAM DOKOŃCZENIA — Harvard · Harvey · Oxford (audyt 2026-07-15)

> SSOT domykania przed Vegas. Podstawa: 5 audytorów read-only + ~15 pod-raportów nad żywym
> demo (tip `2f09458063`), każde twierdzenie z dowodem grep/plik:linia. Zasada: żywy runtime,
> nie checkboxy (docy zaniżały/zawyżały OBUSTRONNIE — potwierdzone wielokrotnie).

## 1. UCZCIWY BILANS (nie zawyżony)

| Program | Kod | End-to-end użyteczne | Wąskie gardło |
|---|---|---|---|
| **Oxford** | ~85-90% | ~85% (1 sierota UI) | **ODBIÓR Piotra = 0%** (brak scenariusza — B6 dotyczy Harvarda!) |
| **Harvard** | ~70-90%/moduł | zmienne (flagi OFF) | flipy + i18n MyWork 2502× + M16 wiring UI |
| **Harvey** | ~80% kod | **~50-55%** (surowo) | HP-21 graded-run, HP-8/12/13/17 niewpięte, HP-0 nieprawda |

**Werdykt: NIE 100%.** Ale luki są policzone, zdeduplikowane i posortowane niżej.

## 2. ★ PILNE — bezpieczeństwo / integralność (FALA 8, autonomiczna, BEZ decyzji Piotra)

| # | Znalezisko | Dowód | Fix |
|---|---|---|---|
| P1 | **HP-0 żywa nieprawda ISO 27001 „Certified"** | `DocsSecurityView.tsx:59-67` + `SecurityDashboard.tsx:93` (data `2025-06-30` przeterminowana!) twierdzą certified; audyt realnie 08-10 | 2 pliki → „in progress" |
| P2 | **Whiteboard: nadawanie ról facylitacji BEZ autoryzacji backendu** | `realtime-platform.routes.ts:756-793` tylko `requireUser`; `realtimePlatformService.ts:363-380` upsert bez bramki → każdy user org nadaje sobie `facilitator` w cudzej sesji | dodać gate (requester=facilitator/admin) + serwer autorytatywny |
| P3 | **Dead-code `AdminSidebar.tsx` (364 l.) wskrzeszony git-race'm** | 0 importerów, przywrócony commitem `4881687226` po usunięciu `d073e66508` | `git rm` |
| P4 | **M15 split-brain: v8 anomalies/forecast/rca osierocone** | `v8/results.routes.ts` — 0 callerów; front woła legacy `benefits.routes.ts` | usunąć duplikat lub przełączyć front (decyzja w kodzie) |
| P5 | **M08 Audit/Activity cichy pusty stan** | `ActivityFeed.tsx:145`/`AuditTrailPanel.tsx:165` `_isPlatformTable` nieużyty; fix leży w niezmergowanej `feat/tp-fe-fix-broken-buttons` | port gating |
| P6 | **promptRegistry.ts × 2 pliki, ta sama nazwa, różna rola** | `server/src/ai/` (indeks meta) vs `src/hooks/discovery/toolAi/` (mózg promptów) | cross-ref w docblockach |

## 3. WIRING — silniki gotowe, brak spięcia UI (FALA 9, za flagami OFF)

| # | Luka | Dowód | Rozmiar |
|---|---|---|---|
| W1 | **HP-8 status bar aprobat 0 callerów** | `ArtifactApprovalStatusBar` gotowy, `statusBar=` nigdzie nie przekazany | S wiring |
| W2 | **HP-17 Evidence UI tylko 2/8 narzędzi** | `EvidencePanelSection` wpięty w Insight+Task; 6 archetypów generuje evidence bez ekspozycji | M wiring |
| W3 | **HP-12 ślad decyzji agentów w Command Center** | 0 śladu | M build |
| W4 | **HP-13 karta benchmarku w Command Center** | 0 śladu (zależy od HP-21) | S build |
| W5 | **O4 business-case endpoint bez UI** | `/api/v8/advisory/business-case` gotowy, 0 przycisku | S wiring |
| W6 | **O3 Risk&Uncertainty bez dedykowanego q-bank** | jedyny z 19; pytania inline | S build |
| W7 | **M16 ~50 endpointów finance bez callerów UI** | valuation/planning/intelligence zbudowane dziś, 0 w src/ | **decyzja Piotra: co miały zasilać** → potem L wiring |

## 4. HIGIENA — dług mechaniczny (FALA 10, flota)

- **i18n MyWork 2502×** (`isPl`): table 1110, notebook 223/260, mindmap 105, whiteboard 38, process-flow 137 — flotowalny sweep. Plus Interview 218, Initiatives 394, M17 81.
- **★ audyt repo-wide `t(key, plDefault)` bez klucza w locale** — StandardTable kebab pokazywał PL etykiety EN-użytkownikom (naprawione 3 pliki, wzorzec szerszy).
- Sieroty do rm (po weryfikacji): `WebhookSettings.tsx` (mindmap, 0 imp.), `SnapshotManager.tsx` (table, 0 imp.), `KnowledgePulse.tsx` (notebook, 0 imp.).
- Drawery mindmap: 2530 linii duplikatu, konsolidacja `mindmapDrawerUnified` gotowa za flagą OFF.
- §27 resztki: M27 31 raw `<table>`, IdeasTableContent §27-todo, AIProposalDiffModal, GridView (świadome wyjątki arkuszy).

## 5. BUDOWA DUŻA (FALA 11, po decyzjach Piotra)

- **HP-4/5 Agent w Teresie** — koncept gotowy (`agentPlannerService` = kręgosłup), 6 zadań, czeka na 3 pytania Piotra.
- **HP-25 Governance-sync** — koncept B1→B4 (SCIM już jest, P1 cross-org ostrożność).

## 6. DECYZJE PIOTRA (odblokowują flipy/kierunek — nie blokują fal 8-10)

1. **Flipy default-ON** (zrzuty gotowe/czyste): `ff_commandCenter` (CC komplet) · `ff_ssoSelfService` · M16 6 paneli (`valueOffice/investmentAppraisal/valuationVisuals/varianceBridge/driverPlanner/modelVersioning`) · M14 `summaryOneLook`+`changeSignals` (dark bug!) · **M02 deliverables** (`ENABLE_DELIVERABLES_LIGHT`+`VITE_` — canvas triada MARTWA bez tego!) · M17 `EXPORT_APPROVAL_ENFORCE` (shadow→enforce po adopcji).
2. **M12 Audyty** — `MODULE_AUDITS: closed` „empty module": otwierać na demo czy chować?
3. **HP-21 graded run** — mini (5 zadań, grosze) czy pełny korpus (~100 wywołań premium)?
4. **M16 ~50 endpointów** — co miały zasilać? (wiring UI vs oznaczyć dead-code)
5. **HP-4 semantyka**: błąd kroku=stop/kontynuacja? · wykonanie live/tło? · Agent Builder pełne definicje/szablon?
6. **Dual-stack M08** (D-01) — `tablePlatformMetadataFirst` OFF: domknąć ścieżkę B czy zostawić legacy?

## 7. KOLEJNOŚĆ → potem VEGAS

FALA 8 (bezpieczeństwo, TERAZ) → FALA 9 (wiring za flagami) → FALA 10 (i18n flota) → **decyzje Piotra** → FALA 11 (Agent w Teresie) → **VEGAS** (finał wizualny hurtem: crimson resztki, dark changeSignals, styl Vault, templateKey overlap, §27 M27 wizualnie).

Backlog Vegas rośnie w `_VEGAS_BACKLOG` (crimson Help/ENTERPRISE badge, dark białe karty changeSignals, Vault legacy-styl, templateKey kolizja).
