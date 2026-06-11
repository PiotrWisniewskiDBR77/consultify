# M17 — Outputs (Outputs Library) — FAZA 1: PRAWDA KODU

Branch: feat/deliverables-light. Czytane runtime: montaż (Gateway.ts) → komponent (ReportsAndPresentationsHub + useRapData) → API (artifacts.routes) → handler (artifactRegistryService) → SQL (v8_output_artifacts).

## Werdykty per pozycja inwentarza (1a–1d)

| # | Pozycja | Werdykt | Dowód (plik:linia) |
|---|---------|---------|---------------------|
| 1 | 7 zakładek taksonomii (All/Mine/Needs review/Documents/Presentations/Sheets/Templates) | **REALNE, ALE ZA FLAGĄ** | Taby: ReportsAndPresentationsHub.tsx:143-178. Rejestr za bramką: Gateway.ts:747 `app.use('/api/artifacts', v8FeatureGate, artifactsRoutes)` + v8FeatureGate.middleware.ts:14-21 (404 gdy `ENABLE_V8_GLOBAL!=='true'`). Default flagi = `false` (FeatureFlags.ts:31,113). **Przy OFF → 404, ale FE pokazuje BANER błędu, nie cichą pustkę** (patrz czerwona flaga niżej) |
| 2 | Filtry (status/typ/visibility/review/źródło, chipy z licznikami) | **REALNE** | Backend filtry: artifacts.routes.ts:307-337 (outputType/artifactFamily/visibilityScope/onlyMine/reviewShared/search). Liczniki z realnych wierszy, nie fabrykowane (mapArtifactGovernance czyta raw: useRapData.ts:755-762) |
| 3 | Widoki table/grid + search + otwarte dokumenty | **REALNE** | Hub: viewMode state ReportsAndPresentationsHub.tsx:87, availableViewModes `['table','grid']` :1086. Search → `?search=` artifacts.routes.ts:333 |
| 4 | Bramka eksportu za aprobatą | **REALNE — egzekwowana DWUWARSTWOWO (UI + SERWER)** | UI guard: useRapData.ts:165-169 `isExportApproved` + blok :1428-1431/:1463-1466 (toast „exportBlocked"). **Serwer = twardy backstop:** report-builder.routes.ts:3527/3598/3690/3913 `enforceQualityGatesForExport` (def. :180); presentations.routes.ts:1444 `enforceQualityGateForExport` + :1422 `enforceNoLegalHold` + :1424 visibility-deny + :1455 `export_blocked`. Eksport NIE jest blokowany tylko przyciskiem |
| 5 | Review/publish flow (start-review + Approve&publish) | **REALNE** | start-review: artifacts.routes.ts:717-804 (auto-przypisanie reviewerów org-admin :750-764, walidacja 409 :798). publish: :1002-1131 (transitions reviewable_share→in_review→approved→published, submitReviewGate, fail-closed na braku provenance :1056-1067) |
| 6 | Trust-state P18 (5 filarów) | **REALNE** | GET /:id/trust-state artifacts.routes.ts:668-685 → buildArtifactTrustPayload :226-297 (źródło=sourceRefs/originLinks, run=executionRun, stage=publishState/validationState, visibility=visibilityScope, export_ledger=exportHistory :245-247) |
| 7 | Lineage/provenance panel | **REALNE** | originLinks (artifacts.routes.ts:1272-1276 GET /:id), lineagePaths :256-262 (runPath/toolUsagePath/outputsPath), accessGrants :237 |
| 8 | Akcje wierszowe (Otwórz/podgląd/Discuss/Save as template/Eksport/Archiwizuj) | **REALNE** | resolveArtifactOpenPath via buildActionTargetPayload artifacts.routes.ts:73-170 (openPath per originRuntime). Save-as-template POST /:id/save-as-template :814-992. Export :1426-1494 useRapData. Archive (DELETE) :1496-1546 |
| 9 | Sheets tab (otwarcie w Table Builderze; brak CTA New) | **REALNE** | Fetch `?outputType=sheet` useRapData.ts:1221. Brak przycisku „New" potwierdzony (grep New/Nowy/button w SheetsTabContent.tsx = 0 trafień). openPath dla sheet = null, export → table-platform xlsx (artifacts.routes.ts:147-158) |
| 10 | Templates tab (active/draft/deprecated/archived, Nowy wzorzec → /reports/builder) | **REALNE** | TemplatesTabContent + fetchTemplates useRapData.ts:1380-1418 (łączy report/pres/sheet templates). „Nowy wzorzec" nav: Hub :206/:211. deprecate: artifacts.routes.ts:1138-1246 |
| 11 | Demo-data fallback (DEMO_* useRapData.ts:192+) | **MARTWE (potwierdzone)** | DEMO_REPORTS/PRESENTATIONS/TEMPLATES są w bloku komentarza `/* … */` od useRapData.ts:187 (`/*`) do :389 (`*/`). 0 konsumentów na ścieżce runtime. Demo wyłącznie przez seed Atelier Toys + `shouldAllowDemoData()` (:467) który steruje tylko treścią komunikatu błędu (:490/:493), nie wstrzykuje fixtures |
| 12 | Teresa→Outputs (deck/doc metadata.deliverable + event deliverables:draft-ready) | **REALNE, ZA FLAGĄ ENABLE_DELIVERABLES_LIGHT** | Event dispatch: UnifiedChatPanel.tsx:499 `window.dispatchEvent(new CustomEvent('deliverables:draft-ready'…))`; listener: WorkCanvasDocumentPanel.tsx:718/1068. BE rejestruje do Outputs: docGenerationRuntime.ts:223/521 `registerArtifactOrigin(originRuntime:'native_artifact')`. Router 404 gdy flaga OFF: deliverablesGenerations.routes.ts:39-45. Default flagi=false (FeatureFlags.ts:33,121) |
| 13 | Work Canvas → Outputs (register-in-outputs) | **REALNE (test SKOMMITOWANY, nie uncommitted)** | Handler: work-canvas.routes.ts:4424-4499 `registerArtifactOrigin(originRuntime:'native_artifact')`, ownedDraft guard :4425, envelope z linkiem `/presentations?tab=outputs&artifactId=`. FE wywołanie: api.ts:5222. Test work-canvas-register-in-outputs.test.ts skomitowany w 2bb18aae0c (git status czysty) — teza „uncommitted" NIEAKTUALNA |
| 14 | Kreator prezentacji /presentations/wizard | **REALNE** | Route AppRoutes.tsx:2026. Komponenty: PresentationWizard.tsx + wizard/WizardShell.tsx istnieją |
| 15 | „New AI document" → /document-studio | **REALNE** | Route AppRoutes.tsx:2080 (`/document-studio`) + :2100 (`/:artifactId`), backed by /api/document-studio |
| 16 | Public share viewer /presentations/shared/:shareToken (bez auth) | **REALNE** | FE: SharedPresentationView.tsx:47 fetch `/api/presentations/shared/:token`, route AppRoutes.tsx:2120. BE PUBLIC (przed verifyToken): presentations.routes.ts:606-623, WHERE share_token=? + sprawdzenie wygaśnięcia :613 |

## 1e — Wiring: funkcja → endpoint → tabela → status

| Funkcja | Endpoint | Tabela DB | Status |
|---------|----------|-----------|--------|
| Rejestr artefaktów (lista) | GET /api/artifacts | v8_output_artifacts | REALNE (artifactRegistryService.listArtifactsForUser, org-scoped) |
| Szczegół/akcje | GET /api/artifacts/:id (+/action-target,/access,/trust-state) | v8_output_artifacts + v8_artifact_origin_links | REALNE, org-scoped (getArtifactRow :937 WHERE artifact_id=? AND organization_id=?) |
| Review start | POST /api/artifacts/:id/start-review | v8_publish_records, v8_review_gates | REALNE |
| Publish | POST /api/artifacts/:id/publish | v8_publish_records, v8_output_artifacts | REALNE (publishReviewService) |
| Export ledger | (czytane w trust-state) | presentation_export_records + reportsPresModelService.getExportHistory | REALNE (catch→[] tolerancyjne :247) |
| Save-as-template | POST /api/artifacts/:id/save-as-template | report_builder_templates / presentation_templates + v8_output_artifacts | REALNE |
| Canvas→Outputs | POST /api/work-canvas/drafts/:id/register-in-outputs | work_canvas_drafts + v8_output_artifacts | REALNE |
| Teresa deliverable→Outputs | POST /api/deliverables/generations/:id/generate | v8_output_artifacts (registerArtifactOrigin) | REALNE za flagą |
| Public deck share | GET /api/presentations/shared/:token | presentation_decks (share_token) | REALNE, public |

## 1f — Flagi

| Flaga | Default RUNTIME | Kto włącza | Wpływ przy OFF |
|-------|-----------------|------------|----------------|
| ENABLE_V8_GLOBAL | **false** (FeatureFlags.ts:31,113; `=== 'true'`) | env var | **Cały /api/artifacts → 404** (Gateway.ts:747 + v8FeatureGate.middleware.ts:15-18). Brak legacy-fallback rejestru. FE łapie not-ok i renderuje BANER `ErrorState` (NIE pustka) |
| ENABLE_V8_SHADOW_MODE | false | env | — |
| ENABLE_DELIVERABLES_LIGHT | **false** (FeatureFlags.ts:33,121) | env var | Router /api/deliverables/generations → 404 (deliverablesGenerations.routes.ts:39-45). Teresa-generacja deck/doc nieczynna; legacy presentation flow nietknięty |
| ENABLE_DELIVERABLES_DOC_STREAMING | false | env | jednorazowy doc gen zamiast per-sekcja |
| ENABLE_TERESA_RETRIEVAL | false | env | brak read-tools Teresy |
| Org-level v8 'outputs' | wymaga wiersza v8_feature_flags; w NON-prod fallback gdy 0 wierszy (allowImplicitOrgRowsFallback) | setV8OrgFlag / superadmin | dodatkowa bramka v8OutputsGate (artifacts.routes.ts:40) — 404 V8_MODULE_DISABLED przy braku flagi org w prod |

Uwaga: artifacts.routes ma DWIE bramki — pre-auth `v8FeatureGate` (global, Gateway.ts:747) + post-auth `v8OutputsGate` (module, routes:40). Obie muszą przejść.

## 1g — Połączenia

**WEJŚCIA (do Outputs):**
- Canvas register-in-outputs: work-canvas.routes.ts:4424 → registerArtifactOrigin (native_artifact)
- Teresa deliverables: docGenerationRuntime.ts:223 (doc) / :521 (sheet) → registerArtifactOrigin; event deliverables:draft-ready UnifiedChatPanel.tsx:499
- Save-as-template z report/deck: artifacts.routes.ts:881/961
- Studia generujące (report-builder, presentations, table-platform) rejestrują origin

**WYJŚCIA (z Outputs):**
- Otwarcie w edytorach: buildActionTargetPayload artifacts.routes.ts:95-158 (report→/reports/builder/:id, presentation→/presentations/builder/:id, sheet→Table Builder, template→/reports/builder?tab=templates lub /presentations/wizard)
- Eksport: report-builder /export/pdf|pptx|docx, presentations /decks/:id/download (wszystkie z quality-gate)
- Public share: presentations.routes.ts:606 /shared/:token

## Wynik weryfikacji czerwonych flag

1. **poz.1 v8-404 PUSTKA?** → **OBALONE w części „cicha pustka".** Gdy ENABLE_V8_GLOBAL OFF, /api/artifacts zwraca 404. FE NIE połyka tego cicho: useRapData ustawia jawny `setError('Canonical artifact registry failed to load …')` (np. :807/:819/:849/:1181/:1238), a OutputsAggregateTabContent.tsx:702-710 renderuje `<ErrorState>` z retry. **Jest baner, nie niema pustka.** Subtelność: gdy rows.length===0 ORAZ brak error (np. flaga ON ale 0 artefaktów) → onboardingowy empty-state „Generate with Teresa" (:714). Brak legacy-fallback rejestru — przy OFF moduł jest funkcjonalnie martwy (sam baner błędu), co jest poprawnym fail-state, ale UX = „source needs attention" zamiast „funkcja wyłączona".
2. **poz.11 DEMO_* martwe?** → **POTWIERDZONE.** Tablice w bloku komentarza :187-389, 0 konsumentów runtime.
3. **poz.4 bramka eksportu serwerowo?** → **POTWIERDZONE SERWEROWO.** enforceQualityGatesForExport (report-builder.routes.ts:180/3527…) i enforceQualityGateForExport + enforceNoLegalHold (presentations.routes.ts:1422-1455). UI guard to tylko pre-flight UX.
4. **poz.13 register-in-outputs?** → **ISTNIEJE I DZIAŁA**, test SKOMMITOWANY (2bb18aae0c). Teza „uncommitted" nieaktualna.

## Sygnały cross-org dla SEC

- **CZYSTE (brak IDOR).** Cały artifactRegistryService konsekwentnie filtruje `WHERE artifact_id = ? AND organization_id = ?` na endpointach z :artifactId z URL: getArtifactRow:937, getArtifactByOrigin:992, deleteArtifact:1005-1020, origin-links:1416, plus inline w artifacts.routes (updateTemplate:184-186/215-221, deprecate:1173-1206). getAuthContext bierze organizationId z tokena (:49), nie z body/URL. **M17 NIE powtarza systemowego wzorca IDOR z M01/M03/M10/M13/M14.** Zgodny z czystymi M02/M25.
- **Public share viewer `/presentations/shared/:token`** (presentations.routes.ts:606-623): zapytanie WHERE share_token=? bez org-filtra — POPRAWNE (token jest poświadczeniem dla niezalogowanego). Entropia OK: token = `uuidv4().replace(/-/g,'')` = 122-bit losowości hex (presentations.routes.ts:1810). Tworzenie gated capability `presentation_share` (:1799) + `ensureConfidentialityPolicy` (:1809). Domyślne wygaśnięcie 7 dni (:1813), egzekwowane w odczycie (:613 `share_expires_at > CURRENT_TIMESTAMP`). **Brak ryzyka enumeracji.**
- Drobne: `/shared/:token` robi `SELECT *` z decka i zwraca przez normalizeDeckRow — warto zweryfikować w F2/SEC, czy normalizacja nie wycieka pól wrażliwych (source_refs/internal), ale brak org-leak.

## Podsumowanie
Moduł M17 to dojrzała, REALNA warstwa governance nad rejestrem v8_output_artifacts. Żadnych mock-stubów na żywej ścieżce; jedyny MARTWY element (DEMO_*) jest zakomentowany. Główne uwarunkowanie: dwie bramki V8 (global + org-module) — przy OFF moduł = baner błędu (nie cicha pustka, ale i nie elegancki „feature off"). Bezpieczeństwo cross-org czyste; public share o dobrej entropii i wygaśnięciu.
