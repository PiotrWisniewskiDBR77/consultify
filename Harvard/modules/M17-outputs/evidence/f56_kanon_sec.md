# M17 — Outputs (Outputs Library) — Karta audytu F5 KANON + F6 BEZPIECZEŃSTWO

Agent: KANON+SEC · Repo: consultify @ feat/deliverables-light · Data: 2026-06-11
Hub: `ReportsAndPresentationsHub` · Trasy: `/presentations` (+`/reports`), public `/presentations/shared/:shareToken`
Rejestr: `GET /api/artifacts`, `artifactRegistryService`, `useRapData.ts`

---

## FAZA 5 — KANONY

### 1. §27 TABLE_AND_PREVIEW_CANON — tabela artefaktów (główna)

Moduł tabelowy. Tabela główna renderowana przez `FilterableTable` (canon SSOT)
wewnątrz `TableWithPreviewLayout` (`OutputsAggregateTabContent.tsx:1020-1032`).
Komponenty są kanoniczne — większość punktów A-S realizowana przez współdzielony
`FilterableTable` (`src/components/shared/ModuleHub/FilterableTable.tsx`).

| Punkt | Wymiar | Status | Dowód / odstępstwo |
|---|---|---|---|
| A | Komponent kanoniczny | OK | `FilterableTable` + `TableWithPreviewLayout` (1020, 52) |
| B | Preview (Table+Preview) | OK | `TableWithPreviewLayout`, `selectedRowId`, `onRowClick` (1023-1024) |
| C | Sort | CZĘŚĆ | kolumny mają `sortable: true` (np. 436); sort delegowany do FilterableTable — brak jawnego persist sortu |
| D | Filtry (chipy) | OK | `activeFilters` + `onFilterChange`, `filterable`/`filterOptions` per kolumna (327-374); chipy statusu/typu/scope/publish |
| E | Search | OK | `searchQuery` → `filteredData` (281-296) |
| F | Resize kolumn | OK | `ColumnResizer` w FilterableTable (`FilterableTable.tsx:12`) |
| G | Sticky header | OK (dziedziczone) | FilterableTable; nie nadpisane lokalnie |
| H | persistKey (szerokości/kolejność) | BRAK | `FilterableTable` wspiera `persistKey` (78), ale wywołanie w 1020-1031 **nie przekazuje `persistKey`** → reset szerokości po reloadzie (canon §27 H). P3 |
| I | Menu wiersza 1/2/3 (kebab) | OK | `getRowActions` (1026), `getMenu3AiButtonClass` (Hub:29) |
| J | Bulk / select-all | BRAK | FilterableTable wspiera `selection`/`type:'select'` (23-91), ale aggregate tab **nie używa** selekcji/bulk |
| K | Empty state | OK | `emptyMessage` (1029) + dedykowany pusty stan onboarding Teresy (714-739) |
| L | Loading | OK | `if (loading)` (698) |
| M | Error | OK | `if (error && rows.length===0 ...)` → panel błędu (702-710) |
| N | Grid/Table toggle | OK | `viewMode==='grid'` ścieżka (740-762) + table |
| O | Status chip | ODSTĘPSTWO | brak `EntityStatusChip` — surowe kropki/kolory (`bg-blue-400`/`bg-emerald-400`/`bg-amber-400`, 332-374). Canon §27 O wymaga `EntityStatusChip`. P3 |
| P | Hardkody kolorów | ODSTĘPSTWO | `text-blue-400` (311,313), `text-emerald-400` (315), `bg-blue-400`/`bg-emerald-400`/`bg-amber-400` (332-374), `border-amber-200/70 bg-amber-50/70` (793) zamiast tokenów. P3 |
| Q | Deep-link / open | OK | `initialArtifactId` deep-link (680-686), `openRow` double-click (1025) |
| R | Akcje (open/export/review/template/publish) | OK | start review (1006-1011), publish (626+), save-as-template (582+) |
| S | i18n etykiet | CZĘŚĆ | `useTranslation` + fallbacki, ALE 18× `isPolish ? 'PL' : 'EN'` inline (np. 367-374) — mieszany wzorzec. P3 |

**Templates** ma osobną zakładkę (`TemplatesTabContent.tsx`) — również tabelowa, te
same komponenty kanoniczne. Sheets/Presentations/Reports mają osobne tab-contenty
(`SheetsTabContent`, `PresentationsTabContent`, `ReportsTabContent`).

**Werdykt §27:** zgodność wysoka (komponenty kanoniczne FilterableTable+Preview).
Główne odstępstwa: **brak `persistKey`** (H), **brak `EntityStatusChip`** (O),
hardkody kolorów (P), mieszany i18n (S), niewykorzystana selekcja/bulk (J).

### 2. Wzorzec hubowy (ModuleHub)
OK. `ReportsAndPresentationsHub` używa `ModuleHub` (`Hub:28`), Menu 1/2/3
(`ModuleMenu3`, `getMenu3AiButtonClass`), 7 zakładek taksonomii
(All | Mine | Needs review | Documents | Presentations | Sheets | Templates,
`Hub:146-178`), breadcrumbs (`AppRoutes:1977-1980`), dynamiczne taby dokumentów
(`useModuleOpenDocuments('reports_presentations')`, `Hub:102`). Zgodny.

### 3. Kanon raportów R1-R4
N/D bezpośrednio w M17 — Outputs to biblioteka/rejestr, raporty produkuje Report
Builder (origin `report`). Outputs jedynie linkuje (`openPath`/`exportPath`,
`artifacts.routes.ts:95-106`). Zgodności R1-R4 nie egzekwuje ten moduł.

### 4. UI-standards (kolory/chipy)
Odstępstwa jak w §27 P/O: hardkody `blue-400`/`emerald-400`/`amber-400`,
surowe statusy zamiast `EntityStatusChip`. P3.

### 5. i18n PL/EN
`useTranslation` z kluczami `rap.*` i fallbackami. Odstępstwo: 18× `isPolish ?`
inline w `OutputsAggregateTabContent.tsx` (mieszanka i18n + ternary), część
fallbacków po polsku ("Brak outputów", "Biblioteka wzorców"). P3.

### 6. Stany / cicha degradacja v8 OFF — KLUCZOWE
- empty/loading/error per tab: **OK** (aggregate 698-739; useRapData setError per hook).
- **Gating v8 OFF:** API zwraca **404 JSON** (`v8FeatureGate.middleware.ts:14-21`
  `V8_DISABLED`; `v8OrgGate` 51-55 `V8_ORG_DISABLED`; `v8OutputsGate` =
  `createV8ModuleGate('outputs')` 96-100 `V8_MODULE_DISABLED`). FE łapie błąd i
  ustawia generyczny komunikat: "Canonical artifact registry failed to load outputs."
  (`useRapData.ts:807,819,849,867`), renderowany w panelu błędu (aggregate 702-710).
  → **NIE jest niemą pustką** (lepsze niż finding v8-404 z M-innych), ALE komunikat
  jest **generyczny "failed to load"**, nie rozróżnia „funkcja niedostępna /
  moduł wyłączony" od realnej awarii. Odstępstwo łagodne: brak dedykowanego baneru
  „feature unavailable" dla 404/V8_*_DISABLED. **P3** (nie nieme, ale mylące).

### 7. CARD_CONTENT_FORMULA
**N/D — potwierdzone.** Outputs to biblioteka/rejestr artefaktów (report/presentation/
sheet/template), nie produkuje kart Insight/Initiative. Formuła nie dotyczy.

---

## FAZA 6 — BEZPIECZEŃSTWO

### SEC-1 [P2] Beta-lock TYLKO nawigacyjny — direct URL omija plate
`MODULE_PRESENTATIONS: 'closed'` (`betaAccess.ts:42`), `BETA_ADMINS_EXEMPT=false`
(blok dla wszystkich). Lock aplikowany **wyłącznie w Sidebarze**:
`lockClosedBetaModules(...)` w `Sidebar.tsx:156` (dekoruje drzewo menu).
Trasa `/presentations` (`AppRoutes.tsx:1984-1991`) jest opakowana tylko
`ProductionModuleGate` (gate trybu produkcyjnego), **bez bramki beta-closed**.
→ Użytkownik nie-admin wpisując bezpośrednio `/presentations` w URL **omija plate
BETA_LOCKED** i wchodzi do Huba. API nadal egzekwuje `v8OutputsGate` (dane org-gated),
więc to **nie wyciek danych** — luka obrony-w-głąb / governance UX.
**Dowód:** `betaAccess.ts:42`, `Sidebar.tsx:154-156`, `AppRoutes.tsx:1984-1991`
(brak `isBetaClosed`/`BETA_LOCKED` na trasie). **Severity P2.**

### SEC-2 [OK] ORG-SCOPE rejestru artefaktów — CZYSTY (brak cross-org IDOR)
W przeciwieństwie do M01/M03/M10/M13/M14 — rejestr jest szczelnie org-scoped.
- Lista: `listArtifactsForUser` — `WHERE a.organization_id = ?`
  (`artifactRegistryService.ts:1944`), wszystkie JOIN-y z `... AND r/d.organization_id
  = a.organization_id` (1933-1943), potem filtr `hasArtifactAccess` (visibility scope, 1957-1968).
- by-id: `getArtifactForUser` → `getArtifactListItemRow` —
  `WHERE a.organization_id = ? AND a.artifact_id = ?` (`:1891-1893`), + `hasArtifactAccess`.
- by-origin: `getArtifactByOrigin` → `getOriginLinkByOrigin` skanuje po
  `organization_id` (905-908), potem `getArtifactForUser` (2099-2105).
- UPDATE/DELETE: `updateArtifactMetadata` (`:1082`), `cleanupGhostOutputsByOrigin`
  (1004-1023), `deprecate`/`publish` w routes — wszystkie `WHERE ... AND organization_id = ?`.
- Handlery `artifacts.routes.ts` zawsze przekazują `organizationId` z
  `getAuthContext` (47-52); brak ścieżki przyjmującej orgId z body/query.
- Pre-warunki: `verifyToken` + `requireV8OrgContext` + `v8OutputsGate` (routes:38-40).
→ Artefakt org B **nieosiągalny** po artifactId z kontekstu org A (zwraca 404).
**Werdykt: CZYSTY.** (Wzorzec jak M02/M25.)

### SEC-3 [P2] Bramka EKSPORTU governance — egzekwowana tylko jako quality-gate, NIE jako publish-approval
Dwie warstwy:
- **Quality-gate: egzekwowane SERWEROWO** ✅ — report:
  `enforceQualityGatesForExport` → 409 `REPORT_NOT_READY_FOR_EXPORT`
  (`report-builder.routes.ts:179-192`); deck: `enforceQualityGateForExport` → 422
  `QUALITY_GATE_BLOCKED` (`presentations.routes.ts:358-383, 366`). Posiada
  `allowOverride`.
- **Governance publish-approval: TYLKO UI** ⚠️ — w Outputs UI przycisk
  eksportu/review jest `disabled` na podstawie `publishState`/`validationState`
  (`OutputsAggregateTabContent.tsx:1000-1005`). Same endpointy eksportu
  (`/api/report-builder/:id/export/pdf`, `/api/presentations/decks/:id/download`)
  **nie sprawdzają** stanu publish/review artefaktu — egzekwują wyłącznie quality-gate.
→ Użytkownik może wyeksportować artefakt nie-zatwierdzony w review, wołając endpoint
bezpośrednio (omija UI-disable). Quality-gate i org-scope nadal działają, więc niższy
priorytet. **Dowód:** `presentations.routes.ts:358-383`, `report-builder.routes.ts:179-192`
(brak `getPublishRecord`/publishState check). **Severity P2.**

### SEC-4 [P1] PUBLIC SHARE VIEWER /presentations/shared/:token — WYCIEK org_id + brak rate-limit + brak revoke
Endpoint: `presentations.routes.ts:606-623` (przed `router.use(verifyToken)` @802, bez auth — poprawnie).
- **Entropia tokenu:** `uuidv4().replace(/-/g,'')` = 32 hex (122 bity) — OK, nieenumerowalny (1810).
- **Expiry:** egzekwowane w zapytaniu `share_expires_at IS NULL OR > CURRENT_TIMESTAMP` (613) — OK.
- **404 vs 410:** wygasły/nieznany → **404** (617-619); brak rozróżnienia 410 dla
  expired (canon `/api/public/artifacts` używa 410). Drobne.
- **WYCIEK PAYLOADU [P1]:** handler zwraca `normalizeDeckRow(row)` = **`{...row}`**
  (`:412-422, 621`) — cały wiersz `presentation_decks`, w tym `organization_id`,
  `created_by`/`generated_by`, `confidentiality`, wewnętrzne ID, sam `share_token`.
  FE publiczny **odczytuje `row.organization_id`** (`SharedPresentationView.tsx:70`)
  — dowód, że org ID trafia do nieuwierzytelnionego klienta. Kontrast: `/api/public/
  artifacts/:token` jawnie sanitizuje ("Never returns internal IDs, author identity,
  or org IDs", `public-artifacts.routes.ts` nagłówek). **Severity P1.**
- **BRAK RATE-LIMIT [P2]:** `/shared/:token` nie ma `express-rate-limit`
  (grep `rateLimit` w presentations.routes.ts = 0), podczas gdy
  `public-artifacts.routes.ts` ma 30/min/IP. Otwiera na bruteforce/abuse. **Severity P2.**
- **BRAK REVOKE [P2]:** brak endpointu unshare/revoke dla share_token decku
  (revoke istnieje tylko dla subscriber-tokenów, `:4471`). Re-share rotuje token
  (1810-1818), ale nie ma jawnego „cofnij udostępnienie" → ustawienia `share_token=NULL`.
  Stary link żyje do expiry (domyślnie 7 dni). **Severity P2.**

### SEC-5 [OK] Review/publish — wymaga roli serwerowo
`POST /:id/publish` → `canPublishOrgTemplate(roleKey)` (ADMIN/OWNER/SUPERADMIN),
403 dla pozostałych (`artifacts.routes.ts:1011-1015`). `POST /:id/access` →
`canManageArtifactAccess` (owner lub admin), 403 (701-703). `start-review` z
walidacją stanu (766-802). `deprecate` → `canPublishOrgTemplate`, 403 (1152-1154).
→ Nie każdy zalogowany może opublikować cudzy artefakt. **Werdykt: CZYSTY.**

### SEC-6 [P3] Sekrety/PII w logach
`registerArtifactOrigin` loguje `originRuntime:originRecordId` + artifactId
(`:1171-1173`) — ID, nie PII. Brak logowania tokenów/sekretów w ścieżce Outputs.
Share endpoint nie loguje tokenu. Drobne: log org ID przy notyfikacji kontekstu
(1202-1205) — akceptowalne. **Severity P3 (informacyjne).**

---

## PODSUMOWANIE FINDINGÓW SEC
| ID | Severity | Tytuł | Dowód |
|---|---|---|---|
| SEC-4a | **P1** | Public share viewer wycieka `organization_id`/created_by/confidentiality (cały wiersz) | presentations.routes.ts:412-422,621 → SharedPresentationView.tsx:70 |
| SEC-1 | **P2** | Beta-lock tylko nawigacyjny — direct URL `/presentations` omija plate | betaAccess.ts:42; Sidebar.tsx:156; AppRoutes.tsx:1984-1991 |
| SEC-3 | **P2** | Bramka eksportu governance (publish-approval) tylko UI; serwer egzekwuje jedynie quality-gate | presentations.routes.ts:358-383; report-builder.routes.ts:179-192 |
| SEC-4b | **P2** | Brak rate-limit na `/presentations/shared/:token` | presentations.routes.ts:606-623 |
| SEC-4c | **P2** | Brak revoke/unshare share_token decku | presentations.routes.ts:1794-1847 (brak revoke) |
| SEC-2 | OK | Org-scope rejestru CZYSTY (brak cross-org IDOR) | artifactRegistryService.ts:1891-1893,1944 |
| SEC-5 | OK | Review/publish wymaga roli serwerowo | artifacts.routes.ts:1011-1015,701-703 |
| SEC-6 | P3 | Logi: ID nie PII, brak tokenów | artifactRegistryService.ts:1171-1173 |
