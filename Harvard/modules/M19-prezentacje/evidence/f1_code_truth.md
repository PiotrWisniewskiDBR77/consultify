# M19 — Prezentacje (Presentation Studio P20 / DeckBuilder) — FAZA 1: PRAWDA KODU

Branch: `feat/deliverables-light`. Audytor KOD. Czytany runtime: montaż → komponent → API → handler → SQL/migracja.

Mount BE: `server/src/Gateway.ts:877` → `app.use('/api/presentations', presentationsRoutes)`.
Plik tras: `server/src/routes/presentations.routes.ts` (6129 linii).
`router.use(verifyToken)` na `presentations.routes.ts:802` — endpointy publiczne (`/shared/:token`, subscriber dashboard) ZAREJESTROWANE PRZED tą linią, reszta po niej.

---

## TL;DR werdykty per pozycja

| # | Pozycja | Werdykt | Dowód |
|---|---------|---------|-------|
| 1 | Home modułu (PrezentacjeView) | REALNE | `PrezentacjeView.tsx` (510 l.), realne `Api.get` |
| 2 | Generacja decka pipeline V8 (`/api/artifact-runs`) | REALNE-ZA-FLAGĄ | `v8FeatureGate.middleware.ts:15` → 404 `V8_DISABLED` bez `ENABLE_V8_GLOBAL=true` |
| 3 | Auto-trigger (first msg / templatePrompt / templateArtifactId) | REALNE | `PrezentacjeView.tsx:168-289` |
| 4 | Reopen z biblioteki (?artifactId + KPI + badge cyklu życia) | REALNE | `PrezentacjeView.tsx:199-254`, trust-state `:212` |
| 5 | Intent-routing po generacji (export/agent-edit/motyw) | REALNE | `PrezentacjeView.tsx:318-353` |
| 6 | Quality gates przy eksporcie (canExport=false) | REALNE — SERWEROWO | `presentations.routes.ts:358-383` + `:1586-1614` → 422 `QUALITY_GATE_BLOCKED` |
| 7 | DeckBuilder WYSIWYG (SlideSorter/CardCanvas/TipTap/undo/autosave/CmdPalette/media/present) | REALNE | komplet plików w `src/components/Presentations/DeckBuilder/` |
| 8 | MELS shell (default ON, ?ff_melsDeckBuilder) | REALNE-ZA-FLAGĄ (default ON) | `melsDeckBuilderFlag.ts` — czysty swap UI, brak zmiany data-path |
| 9 | Motywy + brand kit | REALNE | `DeckThemeContext.tsx`, `ThemeSwitcher.tsx`, `BrandKitSettings.tsx` |
| 10 | **Historia wersji (snapshoty serwerowe + restore)** | **REALNE — PRAWDZIWA DB, NIE FASADA** | tabela `presentation_deck_versions` (migracja 752), `INSERT` na `:2161` (autosave), `:2320`, `:6054` (restore); GET `:5998`, restore `:6025` |
| 11 | Współpraca collaborate (Invite by email + permisje) | **STUB — POTWIERDZONY** | `ShareModal.tsx:134-171` — input bez value/onChange, przyciski bez onClick, brak API |
| 12 | Share + analityka (token, publiczny viewer, ShareAnalyticsPanel) | REALNE — ale OVER-DISCLOSURE | viewer `:607-622` zwraca `normalizeDeckRow(row)` = `{...row}` (leak — patrz SEC) |
| 13 | Agent Teresa w deckach (agent-edit + accept/reject + history + revert/bulk-revert) | REALNE | endpointy `:2180/:2299/:2389/:4999/:5260`; tabela `presentation_ai_operations` (migr. 641), realne `INSERT/UPDATE` |
| 14 | Governance (card, audit-log, audit-integrity, watchlist/alert-subscriptions) | REALNE | `:2426/:4757/:4833/:2500/:4015`; migracje 762/763/765 |
| 15 | Eksporty (PPTX/PDF/HTML/PNG/export-parity) | REALNE | `:1555 pdf`, `:1873 html`, `:5728 png`, `:1977 export-parity`; capability+gate+confidentiality+legal-hold guards |
| 16 | Presentation Studio S5/S7 (read-only + generacja za dwustopniową bramką) | REALNE (UKRYTE URL) | `src/components/PresentationStudio/PresentationStudioPage.tsx` + `presentationStudio.api.ts` |

Brak pozycji ZEPSUTE/MARTWE w zamrożonym zakresie. Jedyny STUB = poz.11 (collaborate).

---

## 1e — WIRING (kluczowe: snapshoty wersji, agent-history, share, export)

| Funkcja | Komponent FE | API | Handler | Tabela DB / migracja | Werdykt |
|---------|-------------|-----|---------|----------------------|---------|
| Autosave decka | `useVersionHistory.ts:198` | `PUT /presentations/decks/:deckId/autosave` | `routes:2116` | `UPDATE presentation_decks` + `INSERT presentation_deck_versions` (`:2160`) | REALNE DB |
| Snapshot wersji (timeline) | `useVersionHistory.ts:129` | `GET /presentations/decks/:deckId/versions` | `routes:5998` | `SELECT presentation_deck_versions` (migr. **752**) | **REALNA TABELA — NIE Map** |
| Restore wersji | `useVersionHistory.ts:258` | `POST /presentations/decks/:deckId/versions/:versionId/restore` | `routes:6025` | INSERT snapshot bieżącej + UPDATE deck (`:6054/:6063`) | REALNE DB |
| Agent-edit (propose) | DeckBuilder/AgentActivityPanel | `POST /decks/:deckId/agent-edit` | `routes:2180` | `INSERT presentation_ai_operations` (`:516`, migr. 641) | REALNE DB |
| Agent accept/reject | AgentActivityPanel | `:2299 / :2389` | `routes` | `UPDATE presentation_ai_operations` (`:573`) + `presentation_deck_versions` | REALNE DB |
| Agent history revert / bulk-revert | AgentActivityPanel | `:4999 / :5260` | `routes` | UPDATE deck + snapshot | REALNE DB |
| Share token | `ShareModal.tsx:55` | `POST /decks/:id/share` | `routes:1796` | `UPDATE presentation_decks SET share_token` (`:1816`) | REALNE DB |
| Public viewer | `SharedPresentationView.tsx` | `GET /presentations/shared/:token` | `routes:607` | `SELECT * presentation_decks WHERE share_token` | REALNE (ale leak, SEC) |
| Analytics view-beacon | ShareAnalyticsPanel | `POST /decks/:deckId/analytics/view` | `routes:5917` | `INSERT presentation_analytics` (migr. **610**) | REALNE DB |
| Eksport PDF/HTML/PNG | ShareModal/DeckBuilderTopBar | `/decks/:deckId/export/*` | `:1555/:1873/:5728` | strumień pliku; rekord `recordPresentationExportRecord` | REALNE |

> **Wynik weryfikacji persistencji-fasady (KRYTYCZNE):** M19 NIE ma wzorca fasady z M18. Snapshoty wersji decka są zapisywane PRAWDZIWYM `dbRun(INSERT INTO presentation_deck_versions ...)` (`presentations.routes.ts:2161, 2320, 6054`) do tabeli z migracji `752_p20_deck_version_and_history.sql` (FK do `presentation_decks ON DELETE CASCADE`, 2 indeksy). GET/restore też czytają realny `dbAll/dbGet`. **Snapshoty PRZEŻYWAJĄ restart serwera.** Brak `new Map()` udającej DAO. Agent-history (`presentation_ai_operations`, migr. 641) i analytics (`presentation_analytics`, migr. 610) — również realne tabele. To przeciwieństwo `documentVersionSnapshotService.ts` z M18.
>
> Uwaga konstrukcyjna (nie fasada): hook FE traktuje lokalne snapshoty (`createSnapshot` co 5 min, `useVersionHistory.ts:153`) jako efemeryczne in-session (`persisted:false`, `deckData` w pamięci JS), a serwerowe jako trwałe (`persisted:true`). Lokalne checkpointy giną po refreshu — ale to ŚWIADOMY design (merge w `mergeServerVersions:107`), nie ukryta utrata danych: każdy autosave i tak pisze trwały wiersz serwerowy.

---

## 1f — FLAGI

| Flaga | Gdzie | Default | Zachowanie bez flagi |
|-------|-------|---------|----------------------|
| `ENABLE_V8_GLOBAL` | `server/src/middleware/v8FeatureGate.middleware.ts:15` (pre-auth) + `v8OrgGate:27` (per-org) | OFF (env) | `/api/artifact-runs` → **404 `{error:'V8 features not available', code:'V8_DISABLED'}`**. Bez flagi cała generacja pipeline V8 martwa. **Degradacja: 404 z czytelnym kodem, NIE pusta biała strona** — FE `pipeline` dostaje błąd 404 (do potwierdzenia w live czy jest baner). |
| `ff_melsDeckBuilder` / `ff.mels_deck_builder` / `VITE_MELS_DECK_BUILDER` | `src/utils/melsDeckBuilderFlag.ts:` `isMelsDeckBuilderEnabled()` | **ON** | Czysty swap UI legacy ↔ `DeckBuilderMelsView` (ExecutiveModuleShell). Brak zmiany data-path, brak ryzyka. `?ff_melsDeckBuilder=0` → legacy 3-panel. |

---

## 1g — POŁĄCZENIA

- **Outputs / rejestr artefaktów:** `syncArtifactRegistryForDeck` (`routes:449`) → `artifactRegistryService.registerArtifactOrigin` (`originRuntime:'presentation'`). Eksport czyta `getArtifactByOrigin` z kontrolą widoczności (`routes:1568`). REALNE wpięcie.
- **Teresa agent:** agent-edit pipeline (`:2180`+) z accept/reject i pełną historią. REALNE.
- **Share publiczny:** `GET /presentations/shared/:token` (`:607`) — WŁASNY endpoint M19 (NIE współdzielony z M17). Token-scoped + wygasanie (`share_expires_at`).

---

## SEC — sygnały dla fazy bezpieczeństwa

### 1. Public share OVER-DISCLOSURE (ŚREDNI/WYSOKI) — TEN SAM WZORZEC CO M17
`presentations.routes.ts:621` → `res.json({ success:true, data: normalizeDeckRow(row) })`, gdzie `normalizeDeckRow` (`:412-422`) robi `return { ...row, ...parsed }`. `row` to `SELECT *` z `presentation_decks` (`:609-615`), więc do NIEUWIERZYTELNIONEGO publicznego widza wyciekają wszystkie kolumny surowe: **`organization_id`, `confidentiality`, `share_token`, `share_expires_at`, `created_by`, `updated_at`** itd. To dokładnie problem zgłoszony przy M17 (`{...row}`). Endpoint M19 jest osobny od M17, ale ma identyczną wadę. **Rekomendacja:** allowlista pól dla publicznego viewera (tytuł + deck_json + ewentualnie branding), bez `organization_id`/`confidentiality`/`share_token`.

### 2. Cross-org IDOR — CZYSTO (jak M02/M25/M17/M18, NIE jak M01/M03/M10/M13/M14)
44 zapytań deckowych z `AND organization_id = ?`. Wszystkie endpointy `:deckId` z URL (autosave `:2126`, GET `:1404`, export `:1580`, agent-edit `:2190`, versions `:6004`, restore `:6033`, analytics-read `:5954`) filtrują `organization_id`. Listy governance (`:2521`, `:3554`) też `WHERE organization_id = ?`.
- **Jedyny wyjątek:** `POST /decks/:deckId/analytics/view` (`:5923`) — `SELECT id FROM presentation_decks WHERE id = ?` BEZ org-filter. To publiczny beacon widoku (viewerToken-based, wołany przez współdzielony viewer bez kontekstu org). Zwraca tylko `{success:true}`, nie ujawnia treści — ryzyko niskie (co najwyżej oracle istnienia deck_id + zaśmiecenie analytics cudzym deckiem). Warto domknąć przez weryfikację że deck ma aktywny share_token.

### 3. Eksport — twardo bramkowany SERWEROWO (POZYTYW)
`/decks/:deckId/export/pdf` (`:1555`): `ensurePresentationCapability('presentation_export')` → `enforceNoLegalHold` → `getArtifactByOrigin` (widoczność) → org-filter → `ensureConfidentialityPolicy` → `enforceQualityGateForExport` → 422 `QUALITY_GATE_BLOCKED` gdy `canExport=false`. `canExport=false` blokuje na serwerze, nie tylko w UI. Override tylko jawnym `?overrideQualityGate=true`.

---

## Podsumowanie końcowe (po polsku)

- **Persistencja-fasada? NIE.** M19 ma PRAWDZIWE snapshoty wersji w DB (`presentation_deck_versions`, migr. 752, realne INSERT/SELECT/restore). To przeciwieństwo fasady z M18 Document Studio. Snapshoty serwerowe, agent-history i analytics przeżywają restart. Lokalne 5-min checkpointy są świadomie efemeryczne, ale każdy autosave pisze trwały wiersz — brak ukrytej utraty danych.
- **collaborate = STUB potwierdzony** (`ShareModal.tsx:134-171`): „Invite by email" i przyciski permisji View/Comment bez `onClick`, input bez `value/onChange`, brak jakiegokolwiek wywołania API/handlera BE. Czyste martwe UI.
- **Quality gate eksportu = SERWEROWY** (422 `QUALITY_GATE_BLOCKED`, `routes:366/1586`), nie kosmetyka UI.
- **V8 za flagą:** bez `ENABLE_V8_GLOBAL=true` `/api/artifact-runs` zwraca 404 `V8_DISABLED` (czytelny kod, nie pusta strona; baner FE do potwierdzenia live).
- **Share over-disclosure = REALNY problem:** publiczny `/shared/:token` zwraca `{...row}` z `organization_id`/`confidentiality`/`share_token` — ten sam wzorzec co M17. Do naprawy (allowlista pól).
- **Cross-org IDOR:** moduł CZYSTY (44× org-filter na endpointach `:deckId`); jedyny wyjątek to publiczny analytics-beacon `:5923` o niskim ryzyku.
