# M19 — Prezentacje (Presentation Studio P20 / DeckBuilder) — Faza 5 (KANON) + Faza 6 (SEC)

Agent: KANON+SEC. Repo `feat/deliverables-light`. Skan statyczny kodu (live PENDING).
Trasy: `/prezentacje` (PrezentacjeView, ROUTES.PREZENTACJE_GEN), `/presentations/builder/:deckId` (DeckBuilder), `/presentation-studio` (PresentationStudioPage), `/presentations/shared/:shareToken` + `/presentations/embed/:shareToken` (SharedPresentationView, public).
Backend: `presentations.routes.ts` (6129 linii, ~75 endpointów), `presentationStudio.routes.ts` (S6 approval), serwisy decków/quality-gate/orchestration.

---

## FAZA 5 — KANONY

### 1. §27 TABLE_AND_PREVIEW_CANON — per powierzchnia

| Powierzchnia | Typ | §27 werdykt |
|---|---|---|
| **PresentationsHub** (lista decków) `src/components/Presentations/PresentationsHub.tsx` | TABELA list-table | **ZGODNY**. Używa kanonicznego `TableWithPreviewLayout` (`:44,608`), kolumny i18n (`:226-303`), `EntityStatusChip` w kolumnie status (`:269`), `RowActionsMenu` (`:43`), akcje: Export/Open source/Open preview/Rename/Archive z jawnym odwołaniem do **canon §9.2 Fixed Bottom Manifest** (`:303`), `renderPreview` (`:618`). Lista renderowana pod `/presentations` (ReportsAndPresentationsHub, terytorium M17). Odstępstwo: brak Delay (decki nie mają due date — uzasadnione w komentarzu). |
| **PrezentacjeView** `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` (wejście M19 `/prezentacje`) | NIE-TABELA (KimiWorkspaceShell — chat+artifact generator) | **N/D** — to runtime generatora (split chat / podgląd slajdów), nie lista. §27 nie dotyczy. |
| **DeckBuilder** `/presentations/builder/:deckId` | NIE-TABELA (WYSIWYG edytor slajdów, MELS shell) | **N/D** — kanwa edycji, nie lista. |
| **VersionHistoryPanel** `DeckBuilder/VersionHistoryPanel.tsx` | lista wersji (`<ul>` map `:118`) | **N/D / łagodne** — panel boczny w edytorze, nie tabela list-table; brak Menu 1/2/3, ale to akcja restore inline. Nie wymaga §27 A-S. |
| **ShareAnalyticsPanel** `DeckBuilder/ShareAnalyticsPanel.tsx` | panel metryk (grid 2-kol `:95`) | **N/D** — dashboard liczbowy, nie tabela list. |
| **DeckAuditLogModal** `DeckBuilder/DeckAuditLogModal.tsx` | modal audit-log | **N/D** — modal w edytorze, nie główna lista. |

**Wniosek §27:** Jedyna prawdziwa powierzchnia list-table (PresentationsHub) jest **w pełni kanoniczna** (`TableWithPreviewLayout` + EntityStatusChip + RowActionsMenu + §9.2). Powierzchnie DeckBuilder/Studio słusznie nie-tabelowe.

### 2. Wzorzec shell — MELS DeckBuilder (default ON)
`src/utils/melsDeckBuilderFlag.ts`: **default ON** (resolution: query `ff_melsDeckBuilder` > LS `ff.mels_deck_builder` > env `VITE_MELS_DECK_BUILDER` > ON). DeckBuilder rozgałęzia legacy 3-panel ↔ `DeckBuilderMelsView` (adapter `ExecutiveModuleShell`). Adapter prezentacyjny, ten sam stan/handlery — czysty UI-swap (wzorzec `melsTabeleFlag`). **Zgodny z ExecutiveModuleShell.** PrezentacjeView używa `KimiWorkspaceShell` (osobny shell generatora, spójny z Tabele/Document Studio).

### 3. UI-standards — hardkody kolorów
Hardkody Tailwind w 10/30 plikach DeckBuilder (`ShareAnalyticsPanel`, `ThemeSwitcher`, `EditableBlock`, `DeckBuilderTopBar`, `DeckQualityGatesPanel`, `DeckAuditLogModal`, `SlideSorter`, `DeckBuilder`, `AgentActivityPanel`, `VersionHistoryPanel`). Przykład: `bg-blue-500/5` (`ShareAnalyticsPanel.tsx:107`), `primary-600`/`slate-` w `ShareModal`. **P3 KANON** — niespójne z tokenami EntityStatusChip/design-system; rose/sky/emerald/amber rozsiane. PresentationsHub czysty (EntityStatusChip).

### 4. i18n PL/EN — anti-pattern `isPolish`
**`DeckBuilder.tsx`: 25× `isPolish`** (`const isPolish = i18n.language?.startsWith('pl')` `:276`, dalej `:565,728,747,751,760,763,768,772…`) — hardkodowane pary stringów PL/EN w ternary zamiast `t()` (np. `isPolish ? 'Eksport nie powiódł się' : 'Export failed'` `:747`; `'Przywrócono wersję' : 'Version restored'` `:760`). To **gorszy wariant** anti-patternu i18n z M17 (tam ~18×). `PresentationsHub.tsx:103` ma `i18n.language === 'pl' ? 'pl' : 'en'` (lokalny lang-switch). DeckBuilderTopBar używa `t()` poprawnie (18× `t(`). **P2/P3 KANON** — DeckBuilder do migracji na `t()`+klucze.

### 5. Stany empty/loading/error; cicha degradacja
- DeckBuilder ma 15 wystąpień loading/error/empty/Skeleton — pokrycie obecne.
- **Degradacja schematu:** `GET /decks` przy braku tabel zwraca `{success:true, data:[], unavailable:true}` (`presentations.routes.ts:1390-1392`) — kontrolowana pusta lista z flagą, nie 500. Subscriber-dashboard zwraca **503 `SCHEMA_NOT_READY`** przy braku migracji 765 (`:671-677`) — dobre.
- M19 NIE jest gating'owane przez `ENABLE_V8_GLOBAL` (to wzorzec M17/Outputs). Generator (PrezentacjeView) + DeckBuilder działają bez bramki v8 — brak ryzyka „niemej pustki v8" tutaj.

### 6. CARD_CONTENT_FORMULA
**N/D potwierdzone** — moduł to edytor decków/slajdów (blocks, cards, layouts), nie karta Insight/Initiative wg CARD_CONTENT_FORMULA. Formuła nie dotyczy.

---

## FAZA 6 — BEZPIECZEŃSTWO

### 1. Trzy warstwy gatingu (nawigacja / route / API)
- **Nawigacja:** `betaAccess.ts` — `MODULE_PREZENTACJE_GEN:'closed'`, `MODULE_PRESENTATIONS:'closed'` (`:42,44`), `BETA_ADMINS_EXEMPT=false` → blokada dla wszystkich w menu (`lockClosedBetaModules`).
- **Route:** **`/prezentacje` (PrezentacjeView) ma TYLKO `ProtectedRoute requireAuth` — BRAK beta-locka** (`AppRoutes.tsx:1354-1364`). `/presentations/builder/:deckId` i `/presentation-studio` gated tylko `ProductionModuleGate` (public-production hide), **bez beta-locka** (`:2050-2071, 1996-2009`). **Beta-lock jest WYŁĄCZNIE nawigacyjny** — direct URL omija plate. **Identyczny wzorzec M17/M18 → [P2] SEC (nawigacyjny beta-lock).**
- **API:** `router.use(verifyToken)` od linii 802 + `ensurePresentationCapability(...,'presentation_edit'/'_export'/'_share')` per-endpoint. Dwa endpointy PRZED verifyToken: `/shared/:token` (public, intencjonalnie) i `/governance/subscriber/dashboard` (Bearer-HMAC, własny gating). Warstwa API solidna.

### 2. ORG-SCOPE na endpointach deck/:deckId/:id — przegląd kompletny
`getOrgId(req)` zawsze z tokena (`req.user.organizationId`, `presentations.routes.ts:184`), **nigdy z body/params** — fundament poprawny.

| Endpoint | Linia | Org-scope |
|---|---|---|
| `GET /decks` (lista) | 1385 | `WHERE organization_id = ?` ✅ |
| `GET /decks/:id` | 1404 | `WHERE id = ? AND organization_id = ?` ✅ |
| `GET /decks/:id/download` | 1437 | org+artifact-visibility+quality-gate ✅ |
| `GET /decks/:deckId/export/pdf` | 1580 | org+confidentiality+quality-gate ✅ |
| `POST /decks/:deckId/export/html` | 1895 | `AND organization_id = ?` ✅ |
| `POST /decks/:deckId/export/png` | 5750 | `AND organization_id = ?` ✅ |
| `DELETE /decks/:id` | 1763,1774 | `AND organization_id = ?` ✅ |
| `POST /decks/:id/share` | 1803,1816 | `AND organization_id = ?` ✅ |
| `POST /decks/:deckId/autosave` (SlideSorter save) | 2126,2171 | `AND organization_id = ?` ✅ |
| `POST /decks/:deckId/agent-edit` | 2190 | `AND organization_id = ?` ✅ |
| `POST …/agent-edit/:operationId/accept` | 2312,2344 | `AND organization_id = ?` ✅ |
| `POST …/agent-edit/:operationId/reject` | (org-scoped) | ✅ |
| `POST /decks/:deckId/governance-card` | 2436 | `AND organization_id = ?` ✅ |
| `GET /decks/:deckId/audit-log` | 4879 | `WHERE deck_id = ? AND organization_id = ?` ✅ |
| `…/agent-history/:operationId/revert` | 5020,5037 | `AND organization_id = ? AND deck_id = ?` ✅ |
| `…/agent-history/bulk-revert` | 5300,5319 | `AND organization_id = ?` ✅ |
| `GET /decks/:deckId/analytics` (read) | 5954 | `AND organization_id = ?` ✅ |
| `GET /decks/:deckId/versions` | 6004 | `AND organization_id = ?` ✅ |
| `POST …/versions/:versionId/restore` | 6033,6064 | deck org-checked, wersja `WHERE id=? AND deck_id=?` (deck_id już zweryfikowany) ✅ |
| **`POST /decks/:deckId/analytics/view`** | **5923** | **❌ `SELECT id FROM presentation_decks WHERE id = ?` — BRAK organization_id** |

**[P3] SEC-A: analytics/view bez org-scope** — `POST /decks/:deckId/analytics/view` (`presentations.routes.ts:5917-5944`) sprawdza istnienie decka `WHERE id = ?` (`:5923`) BEZ `organization_id`, po czym `INSERT INTO presentation_analytics`. Endpoint za `verifyToken`, więc wymaga zalogowania, ale **uwierzytelniony user org B może wstrzykiwać zdarzenia page_view do decka org A** (zna/zgadnie deckId). Zapis cross-org (zaśmiecenie analityki innego tenanta), nie odczyt — niski impakt, ale to **jedyny endpoint mutujący bez filtra org**. Fix: dodać `AND organization_id = ?`. *Uwaga: ten endpoint celowo nie wymaga share-tokena (telemetria z public viewera) — alternatywnie przepisać na `/shared/:token`-bound zapis.*

**Werdykt org-scope:** Rejestr decków **CZYSTY z systemowego cross-org IDOR** (jak M02/M25/M17/M18) — 18/19 endpointów mutujących/odczytowych filtruje `organization_id` z tokena; jedyny wyłom to telemetria-write (P3, nie odczyt danych). **M19 dołącza do kohorty „czystych", a nie dziurawych (M01/M03/M10/M13/M14).**

### 3. PUBLIC SHARE VIEWER `/presentations/shared/:shareToken` — KRYTYCZNE
**POTWIERDZONE: M19 współdzieli ten endpoint z M17 — finding P1 over-disclosure dotyczy M19.**
`GET /presentations/shared/:token` (`presentations.routes.ts:606-623`) wykonuje `SELECT * FROM presentation_decks WHERE share_token = ?` i zwraca `normalizeDeckRow(row)` = **`{...row}`** (`:412-421`) — CAŁY wiersz tabeli `presentation_decks` nieuwierzytelnionemu klientowi: `organization_id`, `created_by`/`generated_by`, `confidentiality`, wewnętrzne ID, sam `share_token`. **FE czyta to:** `SharedPresentationView.tsx:70` (`orgId: row.organization_id`), `:71` (`createdBy: row.generated_by || row.created_by`). Endpoint zarejestrowany PRZED `router.use(verifyToken)` (`:606` < `:802`) → faktycznie publiczny. **Zweryfikowane w kodzie.**

- **Zasięg M19:** DeckBuilder/P20 **NIE ma osobnego publicznego viewera** — `presentationStudio.routes.ts` ma `router.use(verifyToken)` na linii 206 i ZERO endpointów `/shared`/`/public`. Trasy `/presentations/shared/:shareToken` i `/presentations/embed/:shareToken` (`AppRoutes.tsx:2120,2128`) obie mountują ten sam `SharedPresentationView` czytający ten sam payload. Więc **jeden wspólny leak obejmuje cały moduł prezentacji (M17+M19)**.
- **Liczenie:** odnotowane jako **współdzielone z M17 (P1)** — NIE podwajam wagi; potwierdzam zasięg na M19.
- **Token entropia:** `uuidv4().replace(/-/g,'')` = 32-hex / 122-bit (`:1810`) — nieenumerowalny, OK.
- **Rate-limit:** BRAK na `/shared/:token` (kontrast: `/api/public/artifacts` ma 30/min). **[P2] SEC-B.**
- **Revoke/unshare:** BRAK — nie ma endpointu czyszczącego `share_token`; link żyje do `share_expires_at` (default +7 dni, `:1813`). Expired → 404 (nie 410). **[P2] SEC-C.**

### 4. Quality gate eksportu (canExport) — SERWEROWO (NAJWAŻNIEJSZE)
**Quality gate JEST egzekwowany serwerowo** na WSZYSTKICH ścieżkach eksportu: `enforceQualityGateForExport()` (`:358-383`) wywołuje `checkDeckQualityGates(org,deck)` i przy `!report.canExport` zwraca **422 `QUALITY_GATE_BLOCKED`** — wpięte w `/download` (`:1444`), `/export/pdf` (`:1586`), `/export/html` (`:1908`), `/export/png` (`:5762`). Dodatkowo każdy export: capability `presentation_export`, `enforceNoLegalHold`, artifact-visibility (`getArtifactByOrigin`), `ensureConfidentialityPolicy`, `enforceExportLimits`. **To MOCNIEJSZE niż M17** (tam approval-gate był tylko UI).

**ALE — [P2] SEC-D: bypass quality-gate przez query param bez role-checka** — wszystkie 4 endpointy honorują `allowOverride: req.query.overrideQualityGate === 'true'` (`:1448,1590,1908,5762`), a `enforceQualityGateForExport` przepuszcza export gdy `allowOverride` (`:366`). **Override NIE jest gated rolą/uprawnieniem** — każdy z capability `presentation_export` dopisuje `?overrideQualityGate=true` i całkowicie omija quality-gate. Serwerowa bramka istnieje, ale ma klient-sterowalny wyłącznik. Fix: ogranicz override do ADMIN/OWNER (jak `CONFIDENTIALITY_SHARE_REQUIRES_ADMIN` `:231`).

### 4b. Approval-ticket S6 (Presentation Studio) — SERWEROWO, MOCNE
Bramka generacji w `/presentation-studio` (proposal→approval→execution→audit) **egzekwowana serwerowo**: `POST /generate/request-approval` mintuje **single-use ticket** wiążący `(organizationId, userId, payload-fingerprint)` (`presentationStudioOrchestrationService.ts:515-633`); `POST /generate` bez ticketu → **403 `PRECONDITION_REQUIRED`** (`presentationStudio.routes.ts:620-628`), redempcja atomowa, swapped-payload/cross-tenant/re-redeem odrzucone (`executePresentationStudioGenerate`, org z auth `:647`). Brak dziury — wzorcowa dwustopniowa bramka.

### 5. ShareModal „Invite by email" (collaborate) — czysty no-op UI
`DeckBuilder/ShareModal.tsx:~140` — input email + przycisk Mail **bez `onClick`/`onChange`**; przyciski permission View/Comment też bez handlerów. **Nie wysyła NICZEGO na serwer** — martwy stub UI, nie potencjalny błąd serwera. **[P3] SEC-E** (mylące UI: użytkownik klika, nic się nie dzieje, brak feedbacku). Działa tylko zakładka „share" (public link via `/decks/:id/share`).

### 6. Sekrety/PII w logach; share analytics cross-org
- IP w analytics hashowane SHA-256 z solą (`hashIp` `:5985-5991`, sól hardkodowana `'consultify-salt'` — **P3** stała sól, ale to nie sekret tożsamości).
- Subscriber-dashboard: brak echa signing-secret, generyczne 401, single-subscription scope (`:636-645`) — czyste.
- Share analytics READ org-scoped (`:5954`) — brak wycieku metryk innej org po stronie odczytu.
- Brak logowania surowych tokenów/sekretów w przejrzanych ścieżkach.

---

## PODSUMOWANIE FINDINGÓW SEC

| ID | Sev | Finding | Dowód |
|---|---|---|---|
| SEC-PUBLIC (wspólny z M17) | **P1** | Public viewer `/shared/:token` zwraca `{...row}` (org_id, confidentiality, created_by, share_token, wewnętrzne ID) nieuwierzytelnionemu | `presentations.routes.ts:412,606-623`; FE `SharedPresentationView.tsx:70-71` |
| SEC-D | **P2** | Bypass serwerowego quality-gate przez `?overrideQualityGate=true` BEZ role-checka | `presentations.routes.ts:366,1448,1590,1908,5762` |
| SEC-BETA | P2 | Beta-lock tylko nawigacyjny — direct URL omija (`/prezentacje`, `/builder`, `/presentation-studio`) | `AppRoutes.tsx:1354-1364,2050-2071,1996-2009` vs `betaAccess.ts:42-44` |
| SEC-B | P2 | Brak rate-limit na public `/shared/:token` (vs 30/min na public artifacts) | `presentations.routes.ts:606` |
| SEC-C | P2 | Brak revoke/unshare; link żyje do expiry (+7 dni); expired→404 nie 410 | `presentations.routes.ts:1810-1818` |
| SEC-A | P3 | `analytics/view` bez org-scope — cross-org write telemetrii (auth-only) | `presentations.routes.ts:5923` |
| SEC-E | P3 | „Invite by email" + permission buttons = no-op stub (mylące, nie błąd serwera) | `ShareModal.tsx:~134-175` |
| — | P3 | Stała sól `consultify-salt` w `hashIp` | `presentations.routes.ts:5988` |

**OK / zaliczone (nie powielać):** rejestr decków org-scoped czysty (brak systemowego cross-org IDOR — kohorta M02/M25/M17/M18); `getOrgId` z tokena; quality-gate eksportu serwerowy (mocniejszy niż M17); S6 approval-ticket serwerowy (org+user+fingerprint, single-use); token share 122-bit nieenumerowalny; subscriber-dashboard bez echa sekretu; brak osobnego publicznego viewera P20 (dzieli M17-owy).

**Najważniejsze (priorytet napraw):**
1. **Sanityzacja public viewera** (P1, wspólny z M17) — whitelista pól w `/shared/:token`, bez org_id/confidentiality/created_by/share_token.
2. **Role-gate `overrideQualityGate`** (P2) — ogranicz do ADMIN/OWNER, inaczej serwerowy quality-gate jest obchodliwy jednym query paramem.
3. Beta-lock na route (nie tylko nawigacja) + rate-limit/revoke share.
