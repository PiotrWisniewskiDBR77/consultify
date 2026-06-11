# M13 — Inicjatywy · FAZA 1 — PRAWDA KODU

Audyt Harvard (Protokół V1), agent KOD. Branch `feat/deliverables-light`. READ-ONLY.
Zakres: sekcja „MODUŁ: INICJATYWY" (poz. 1-19) z `INV_D_...md`. Zasada: prawda kodu, nie dokumentacji. Dowód `plik:linia`.

Pliki źródłowe (klucz):
- `src/components/Initiatives/InitiativesHub.tsx` (2364 l.)
- `server/src/routes/pmo/initiatives.routes.ts` (~2558 l.) + `server/src/routes/initiatives-additive.routes.ts` + `server/src/routes/initiative-generator.routes.ts` + `server/src/routes/pmo/governance.routes.ts`
- `src/components/Initiatives/sections/registry.ts`
- `src/views/FullROIView.tsx`
- `src/components/Initiatives/InitiativeConflictsPanel.tsx`
- SSOT: `docs/initiatives/INITIATIVE_FORMULA.md`

---

## 1a. Werdykty per pozycja (1-19)

| # | Pozycja | Werdykt | Dowód |
|---|---------|---------|-------|
| 1 | Widok Portfolio — tabela + preview (`InitiativePreviewV3`) | **REALNE** | `InitiativesHub.tsx:1464-1497` (viewMode `table` → `TableWithPreviewLayout` + `PortfolioListView`); preview `:1422-1462` |
| 2 | Kanban — drag&drop statusów | **REALNE** | `InitiativesHub.tsx:1538-1558` (`PortfolioKanbanView`, `onStatusChange={handleStatusChange}`) |
| 3 | Timeline | **REALNE** | `InitiativesHub.tsx:1559-1578` (`InitiativesTimelineView`) |
| 4 | Grid (kafle) | **REALNE** | `InitiativesHub.tsx:1498-1537` (`InitiativeGridCard` map) |
| 5 | Dokument inicjatywy — rejestr ~30 sekcji | **REALNE** | `sections/registry.ts:50-83` (28 component_keys → komponenty); render: `InitiativesHub.tsx:1274-1285` (`InitiativeDocumentView`) |
| 6 | Zakładka Analysis (V3-F02) — 5 podwidoków + graf + auto-fix | **REALNE** | `InitiativesHub.tsx:1226-1247` (`PortfolioAnalysisView`); subviews `:1652-1697` (resources/feasibility/logic/timeline/completeness) |
| 7 | Charter wizard (Tryb A) — przycisk w hubie | **ZEPSUTE/UKRYTE w hubie** (komponent REALNY) | Przycisk Charter `disabled` zawsze: `InitiativesHub.tsx:1953-1962`. `setShowCharter(true)` NIGDY nie wołane (jedyne settery: `:2044`, `:2047` = tylko `false`). Komponent realny: `Wizard/InitiativeCharterWizard.tsx:378` (`createInitiativeWriteTruth`). |
| 8 | AI Initiative Wizard (Tryb B) — modal | **UKRYTE w hubie** (osiągalny z M10) | Przycisk `disabled` zawsze: `InitiativesHub.tsx:1943-1952`. `setShowInitiativeWizard(true)` NIGDY w hubie (settery `:1216`,`:2017` = `false`). Modal zmontowany `:2012-2040`. Żywy z M10: `Interview/InterviewHub.tsx:11919`,`:12863` → `:12955-12965` (`initialMode="generate_from_evidence"`). |
| 9 | Generator propozycji z insightów → Charter | **REALNE** (w M10) | `Interview/InsightViewer.tsx:61` import + użycie `InitiativeGeneratorModal`. Serwer: `initiative-generator.routes.ts` + `Api.getGeneratedInitiatives` `api.ts:9207`. |
| 10 | Modal „Nowa inicjatywa" — CTA + deep-link `?new=1` | **CTA ZEPSUTE / deep-link REALNY** | Primary CTA „New" `disabled` zawsze: `InitiativesHub.tsx:1985-1997`. `?new=1` realnie otwiera modal: `:843-863` (`setShowNewModal(true)` `:857`). Modal tworzy realnie: `:2167-2249` (`createInitiativeWriteTruth` `:2189`). |
| 11 | Bulk edit + eksport CSV | **REALNE** | Bulk modal `:2265-2359`; apply `handleBulkApply :1081-1134` (`PATCH /initiatives/:id/status` + `/quick-update`). Export CSV frontend-only `handleExportSelectedCsv :1156-1211`. |
| 12 | Archiwizacja + przejścia statusów (`initiativeWriteTruth`) | **REALNE** | Archive `handleArchiveInitiative :1137-1148` (`POST /initiatives/:id/archive`). Status preflight `handleStatusChange :866-964` przez `getInitiativeStatusPreflightTruth` + `updateInitiativeStatusWriteTruth`. Serwer: `initiatives.routes.ts:2236`, `:2157`. |
| 13 | Filtry/wyszukiwanie + detekcja duplikatów | **REALNE** | Filtry `:564-592`,`:1046-1060`; search `:1349-1356`; duplikaty `checkDuplicateInitiative` `:2174` (`utils/initiativeDuplicateDetection`). |
| 14 | Integracja V8 Planning — chip pending chains + snapshot | **REALNE z CICHĄ degradacją (bez komunikatu)** | Pending chains load: `:304-318` — catch → `setV8PendingDecisionChains([])` BEZ toast/banera (cisza). Snapshot `:320-347` — catch → `null` (cisza). Chipy `:1868-1937`. Portfolio fetch fallback V8→legacy też cichy `:380-396`. |
| 15 | Czat Teresy z kontekstem inicjatywy | **REALNE** | `openAiChat :1392-1410` (`useOpenChatWithContext`, `entityType:'initiative'`, `pmoContext.initiativeIds`); wpięte w preview `:1425-1451`. |
| 16 | ROI view `/roi` — `FullROIView` | **REALNE, słabo wyeksponowane (brak wejścia z sidebara)** | Route zarejestrowany: `routes/AppRoutes.tsx:1735-1744` + `routeConfig.ts:100` (`ROI:'/roi'`). Dane: `FullROIView.tsx:153` (`Api.getEconomicsAnalyses` → `/api/economics/analyses`, `api.ts:9180-9197`). NIE „Under Construction" (`FullROIView.tsx:6`). Brak nav-item: `FULL_STEP4_ROI` tylko w tablicach „completed" (`navigation/Sidebar/Sidebar.tsx:180`, `useSidebarState.tsx:64`, `layout/Sidebar.tsx:293`) — żadnego klikalnego linku do `/roi`. |
| 17 | Dane demo (Atelier Toys) | **ZA FLAGĄ demo** | `shouldAllowDemoData()` `api.ts:623-626` (isDemoMode/isDemoSession). Hub: `:284`,`:286-298`. ROI demo: `FullROIView.tsx:42-70`, `:166-173` (podstawia gdy realne puste / błąd). |
| 18 | Blokada pilota (VTS) — tworzenie/bulk | **REALNE** | `isPilotParticipantRole` `:197`; gating: New CTA ukryty `:1986`, bulk `:572-573`, modale auto-close `:1213-1218`, status/quick/bulk handlery early-return + `dispatchPilotAccessBlocked` (`:868-873`, `:968-973`, `:1082-1087`). Deep-link `?new=1` też blokowany `:847-856`. |
| 19 | `InitiativeConflictsPanel.tsx` | **MARTWE** (0 konsumentów) | Zero importów / zero JSX w `src/` (grep). `InitiativesTimelineView.tsx` NIE importuje (potwierdzone). Docstring `InitiativeConflictsPanel.tsx:1-6` FAŁSZYWIE twierdzi „Used in InitiativesTimelineView" → rozjazd dok↔kod. |

**Podsumowanie liczbowe (1-19):**
- REALNE: **12** (1,2,3,4,5,6,9,11,12,13,15,18)
- REALNE z degradacją / słabo wyeksponowane: **2** (14 cicha degradacja, 16 ROI bez sidebara)
- ZEPSUTE (przycisk-zawsze-disabled, realny komponent): **2** (7 Charter, 10 New CTA — w obu komponent działa innym wejściem)
- UKRYTE (nieosiągalne z UI huba): **1** (8 AI Wizard; żywe tylko z M10)
- ZA FLAGĄ: **1** (17 demo) — (18 traktowane jako realna blokada)
- MARTWE: **1** (19)

> Uwaga klasyfikacyjna: poz. 7, 8, 10 dzielą ten sam wzorzec — w hubie M13 wszystkie 3 ścieżki tworzenia są disabled. Komponenty same w sobie są realne; nieosiągalne są TYLKO przyciski huba. Jedyne żywe wejścia: deep-link `?new=1` (poz.10) oraz generator/wizard z M10 Wywiad (poz.8/9).

---

## 1b. Status „tworzenia z huba" (kluczowe ustalenie)

Wszystkie 3 widoczne CTA tworzenia w hubie M13 są **disabled na sztywno** (badge „Coming soon"/„w przygotowaniu"), bez żadnej ścieżki ustawiającej stan na `true`:

| Ścieżka | Stan w hubie | Dowód |
|---------|--------------|-------|
| Primary CTA „Nowa inicjatywa" | `disabled` zawsze | `InitiativesHub.tsx:1985-1997` |
| AI Initiative Wizard (Menu 3) | `disabled` zawsze; `setShowInitiativeWizard(true)` nieobecny w hubie | `:1943-1952` |
| Charter (Menu 3) | `disabled` zawsze; `setShowCharter(true)` nieobecny | `:1953-1962` |
| Deep-link `/initiatives?new=1` | **DZIAŁA** (otwiera realny modal create) | `:843-863` → `setShowNewModal(true) :857`; create `:2167-2249` |
| Generator/Wizard z M10 (`generate_from_evidence`) | **DZIAŁA** (poza hubem) | `Interview/InterviewHub.tsx:12955-12965`; `InsightViewer.tsx:61` |

`?new=1` zweryfikowany: parametr czytany z `useSearchParams`, `setShowNewModal(true)`, czyszczenie param `next.delete('new')`, blokada dla pilota. **Realna ścieżka.**

---

## 1c. Mocki / hardcode / ciche degradacje / przyciski-zawsze-błąd

- **Ciche degradacje (bez komunikatu dla usera):**
  - Portfolio fetch V8→legacy: `InitiativesHub.tsx:380-396` (catch bez toastu).
  - V8 pending decisions: `:304-318` catch → `[]` (cisza).
  - V8 snapshot: `:320-347` / `:598-621` catch → `null` (cisza).
  - allInitiatives (duplikaty): `:404-413` catch → fallback bez sygnału.
  - ROI: `FullROIView.tsx:171-177` — przy błędzie w demo-mode chowa błąd (`setError(false)`) i pokazuje DEMO; bez demo → `setError(true)` (uczciwy ErrorState).
- **Przyciski-zawsze-disabled (afordancja „coming soon"):**
  - New CTA `:1985`, AI Wizard `:1943`, Charter `:1953`.
  - Bulk bar: Tag `:1768`, Change due date `:1778`, Delete `:1822` — `disabled` + `title=comingSoonBackend` (brak endpointu). Export CSV/Assign/Archive/AI = realne.
- **Hardcode:** DEMO dane ROI (`FullROIView.tsx:42-70`) i demo huba — wyłącznie za flagą demo, nie wyciekają do realnego runtime gdy flaga OFF.
- **Mocków produkcyjnych w runtime: brak** w zakresie M13.

---

## 1d. Rozjazdy kontraktu / dok↔kod

- `InitiativeConflictsPanel.tsx:1-6` docstring: „Used in InitiativesTimelineView (Roadmap timeline)" — **NIEPRAWDA**, 0 konsumentów. Martwy kod z mylącym komentarzem.
- Inwentarz poz.7 etykietuje Charter jako „[DZIAŁA z insightów]", ale realne wejście to **AI Wizard z M10** (`InitiativeWizardModal` initialMode `generate_from_evidence`), a nie `InitiativeCharterWizard` — `InitiativeCharterWizard` jest zmontowany w hubie (`:2042`) lecz NIGDZIE nie otwierany. (Drobny rozjazd nazewnictwa komponentu.)

---

## 1e. Wiring (tabela kontraktu FE↔BE)

| Funkcja | FE (plik:linia) | Endpoint / serwer | Status |
|---------|------------------|--------------------|--------|
| List inicjatyw (portfolio) | `InitiativesHub.tsx:381-396` | `V8PlanningApi.getPortfolio` → `/api/v8/planning/initiatives/portfolio` (`planning.ts:350`); fallback `Api.getInitiatives` → `/api/initiatives` (`initiatives.routes.ts:1009`) | REALNE (fallback cichy) |
| Detail / open deep-link | `:777-787` | `V8PlanningApi.getInitiative` (`planning.ts:354`) → fallback `/initiatives/:id` (`:2121`) → fallback `?source=interview_insight` | REALNE (3-poziomowy fallback) |
| CREATE | `:2189` / `Wizard/InitiativeCharterWizard.tsx:378` | `createInitiativeWriteTruth` → `POST /initiatives` (`:2108`, `validateBody(CreateInitiativeSchema)`) | REALNE (CTA huba disabled; wejście `?new=1`/M10) |
| Quick-update | `:1009-1011` | `quickUpdateInitiativeWriteTruth` → `PATCH /initiatives/:id/quick-update` | REALNE |
| Status change (preflight + write) | `:896-953` | `getInitiativeStatusPreflightTruth` (gate-readiness-check) + `updateInitiativeStatusWriteTruth` → `PATCH /initiatives/:id/status` (`:2133`/`:2143`) | REALNE |
| Dokument ~30 sekcji (render+save) | `registry.ts:50-83`; `InitiativeDocumentView` | sekcje per-key (`/initiatives/:id/...` kpis/milestones/resources/raid/decisions/section-types); generate-section `:1899` | REALNE |
| Analysis / graf zależności | `:1226-1247` (`PortfolioAnalysisView`) | `/portfolio/dependencies` (`:674`), `/portfolio/rollups` (`:668`), snapshot critical-path/deps (`planning.ts:421`) | REALNE |
| Charter generate (Tryb A) | `InitiativeCharterWizard.tsx:378` | `createInitiativeWriteTruth` → `POST /initiatives` | REALNE (nieosiągalny z huba) |
| Wizard generate_from_evidence (Tryb B) | `InitiativeWizardModal.tsx:1074-1090` | `/initiatives/wizard/sessions` (`:170`), `/similarity-check` (`:1038`), generator (`initiative-generator.routes.ts`) | REALNE (wejście z M10) |
| Archive | `:1140` | `POST /initiatives/:id/archive` (`:2236`, `InitiativeController.archiveInitiative`) | REALNE |
| Bulk status/owner | `:1091-1107` | `PATCH /initiatives/:id/status` + `/quick-update` (Promise.allSettled) | REALNE |
| Export CSV | `:1156-1211` | frontend-only (Blob) | REALNE (bez BE) |
| ROI `/api/economics/analyses` | `FullROIView.tsx:153` | `Api.getEconomicsAnalyses` (`api.ts:9180`) → `/api/economics/analyses` | REALNE |
| Bulk Tag / Due date / Delete | `:1768`,`:1778`,`:1822` | brak endpointu | DISABLED (coming soon backend) |

---

## 1f. Flagi (default BE/komentarz vs RUNTIME)

| Flaga | Default / źródło | Efekt runtime | Dowód |
|-------|------------------|----------------|-------|
| `shouldAllowDemoData()` (demo Atelier Toys) | OFF (isDemoMode/isDemoSession) | Gdy ON i realne puste → demo dataset (hub + ROI). Gdy OFF → brak danych demo | `api.ts:623-626`; `InitiativesHub.tsx:284`; `FullROIView.tsx:166-173` |
| Pilot (VTS) `isPilotParticipantRole` | wg roli usera | Blokuje całe tworzenie/bulk/status; deep-link `?new=1` też | `InitiativesHub.tsx:197`,`:847-856`,`:1213-1218` |
| V8 Planning (governed runtime) | bez jawnej flagi — preferencja V8, fallback legacy w catch | Cicha degradacja do `/api/initiatives` gdy V8 niedostępne; chipy V8 znikają | `:380-396`,`:304-318` |

> Uwaga: w M13 V8 nie jest pod `useV8FeatureFlag(...)` (jak Finance/Results) — to twardy try/catch z cichym fallbackiem, nie przełącznik z banerem degradacji.

---

## 1g. Połączenia międzymodułowe

**WEJŚCIA (do M13):**

| Z modułu | Mechanizm | Plik:linia | Status |
|----------|-----------|------------|--------|
| M10 Wywiad → generate_from_evidence / Wizard | `InitiativeWizardModal initialMode='generate_from_evidence'` | `Interview/InterviewHub.tsx:12955-12965`; trigger `:11919`,`:12863` | REALNE (jedyne żywe AI-tworzenie) |
| M10 Wywiad → generator z insightów | `InitiativeGeneratorModal` w InsightViewer | `Interview/InsightViewer.tsx:61` | REALNE |
| M10 → handoff/link do istniejącej inicjatywy | `Api.getInitiatives` + target_initiative_id | `InsightViewer.tsx:2258`,`:2303-2321` | REALNE |
| Kontekst org / projekt | `useAppStore` currentProjectId/currentUser | `InitiativesHub.tsx:195` | REALNE |

**WYJŚCIA (z M13):**

| Do modułu | Mechanizm | Plik:linia | Status |
|-----------|-----------|------------|--------|
| M14 Wdrożenie — reuse dokumentu | `InitiativeDocumentView sourceModule` (współdzielony z ExecutionHub) | `InitiativesHub.tsx:1276-1283` | REALNE (komponent współdzielony) |
| M16 Finanse — modele/ROI | nav `/economics?tab=models&initiativeId=` | `:1455` (preview footer „Finanse") | REALNE (link) |
| M15/M16 ekonomia — ROI/NPV | `/api/economics/analyses` (FullROIView) | `FullROIView.tsx:153`; nav `:1455` | REALNE |
| Czat Teresy — kontekst inicjatywy | `useOpenChatWithContext` entityType `initiative` | `:1392-1410` | REALNE |
| Deep-link share (kopiuj link) | `?open=:id&mode=drawer` | `:1412-1420` | REALNE |

---

## TOP 5 findingów

- **P1 — Tworzenie z huba M13 całkowicie martwe w UI (poz. 7/8/10).** 3 widoczne CTA (New, AI Wizard, Charter) są `disabled` na sztywno bez żadnej ścieżki włączenia (`InitiativesHub.tsx:1943-1962`, `:1985-1997`). Użytkownik huba nie utworzy inicjatywy inaczej niż przez nieoczywisty deep-link `?new=1` lub przez M10 Wywiad. Komponenty są gotowe — to czysto UI-gating. **Najwyższa dźwignia naprawcza.**
- **P1 — ROI (`/roi`, poz. 16) realny, ale bez wejścia z sidebara.** Pełny dashboard na realnych danych (`/api/economics/analyses`) jest nieosiągalny nawigacyjnie — `FULL_STEP4_ROI` figuruje tylko w tablicach „completed", brak klikalnego linku (`navigation/Sidebar/Sidebar.tsx:180` i pokrewne). Funkcja istnieje, lecz praktycznie ukryta.
- **P2 — `InitiativeConflictsPanel.tsx` martwy + mylący docstring (poz. 19).** 0 konsumentów; docstring twierdzi użycie w `InitiativesTimelineView` (nieprawda). Dead code do usunięcia lub wpięcia.
- **P2 — Ciche degradacje V8→legacy bez sygnału (poz. 14).** `getPendingDecisions`/`getInitiativeSnapshot`/`getPortfolio` w catch zwracają puste bez komunikatu (`:304-347`, `:380-396`). User nie wie, że widzi degradowany (legacy) widok bez chipów V8 — ryzyko cichej utraty governance-kontekstu.
- **P3 — Bulk Tag/Change-due-date/Delete to przyciski-zawsze-disabled (brak BE).** `:1768`,`:1778`,`:1822` — uczciwie oznaczone „coming soon (backend)", ale zajmują miejsce w pasku akcji bez funkcji.

**Ścieżka pliku:** `Harvard/modules/M13-inicjatywy/evidence/f1_code_truth.md`
