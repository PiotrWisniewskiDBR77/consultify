# WP M17 — Outputs (Outputs Library) · dokończenie do 100%

**Pula:** beta · **Karta:** `Harvard/modules/M17-outputs/KARTA_AUDYTU.md` (ocena 54/100) · **Rozmiar:** M (1–3 dni) · **Żywy bloker:** brak P0 (P1 over-disclosure już naprawione)
**Faza programu:** FAZA 3 (szlif; zależny od M18) → FAZA 4 (sweepy) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Biblioteka artefaktów (rejestr `artifact_registry`, 7 zakładek taksonomii, governance: trust-state 5 filarów, lineage, review/publish, bramka eksportu). Trzeci moduł z rzędu BEZ systemowego cross-org IDOR — rejestr konsekwentnie org-scoped (`getArtifactForUser`/`getArtifactListItemRow` `WHERE a.organization_id=? AND a.artifact_id=?`, `artifactRegistryService.ts:1891`; lista `:1944`; org zawsze z tokena → artefakt org B = 404). 14/16 pozycji REALNE, DEMO_* martwy USUNIĘTY (`167b2757bf`), register-in-outputs realny+skommitowany. Czerwona flaga v8-404 „cicha pustka" OBALONA: przy `ENABLE_V8_GLOBAL` OFF API zwraca 404 JSON, FE łapie i pokazuje panel błędu z retry (`useRapData.ts:807`→`OutputsAggregateTabContent.tsx:702`). P1 over-disclosure public viewera NAPRAWIONE (`1b67579d7a`). **Sufit = niewykonane Fazy 3/4 (D=0, G=0).**

## 2. Luki do DoD

### (a) BACKEND / API — bezpieczeństwo (FAZA 3)
- **[P2] Bramka aprobaty eksportu tylko UI.** Serwer pilnuje quality-gate (`report-builder.routes.ts:180`, `presentations.routes.ts:1444` → 409/422), ale publish-approval (`publishState`/`validationState`) sprawdzany TYLKO w `OutputsAggregateTabContent.tsx:1000` (disable przycisku) → obejście bezpośrednim API: eksport artefaktu `draft`/`in_review`. Fix: handlery eksportu odrzucają nie-`approved`/`published` (nie tylko quality).
- **[P2] beta-lock tylko nawigacyjny** — `/presentations` ma `ProductionModuleGate` bez beta-guarda (`Sidebar.tsx:156` vs route); direct URL omija plate (API org-gated → brak wycieku). Fix: beta-guard na route.
- **[P2] share decku bez rate-limit i bez revoke** — `/presentations/shared/:token` brak limitu (vs 30/min na `/api/public/artifacts`), brak unshare (link żyje do expiry ~7 dni); expired → 404 zamiast 410. Fix: rate-limit + revoke + 410.

### (b) FRONTEND / UX — kanony (FAZA 3/4)
- **[P3] v8 OFF → komunikat generyczny** „failed to load" zamiast „moduł wyłączony" (`useRapData.ts:807`). Fix: dedykowany baner.
- **[P3] §27 H persistKey BRAK** — `OutputsAggregateTabContent.tsx:1020` nie przekazuje persistKey do `FilterableTable` → reset szerokości po reload; sort bez persistu (§27 C).
- **[P2] §27 O `EntityStatusChip`** — surowe kropki kolorów zamiast chipa; **P hardkody kolorów** (`blue-400`/`emerald-400`/`amber-400`, `:311-374`); **J bulk/select** nieużyty (wsparcie jest — włączyć lub usunąć).
- **[P2] i18n** — `useTranslation` + 18× `isPolish?` inline mieszanka (sweep FAZA 4).

### (c) INTEGRACJA / TESTY E2E (FAZA 2 → naprawa + FAZA 4)
- **[P0 testowy] brak testu serwerowej bramki APROBATY** (T4) — testy pilnują quality, NIE publish-approval. Dodać: export `draft`/`in_review` przez API → 403.
- **[P0 testowy] 25 stale testów middleware** — `v8FeatureGate.middleware.test.ts` pisane pod utwardzony middleware cofnięty w `9b794bb7f0` → `res.status is not a function`. Decyzja: skasować lub przywrócić hardening (T2).
- **[P0 testowy] mock-drift react-i18next** (T1) — `ReportsAndPresentationsHub.canonicalDataPath`: `t(key,{defaultValue})` renderuje obiekt → crash (wzorzec M13/M14/M25).
- **[P2 testowy]** brak testu public viewera RAP (T6), fixture gap `tp_tables` (T3, 4 FAIL fail-closed 409), liczniki per tab (T7).
- CI: `test-suite.yml` tylko `[main,develop]`; default `Londyn` → żaden test M17 nie gate'uje PR. Dodać `pull_request:[Londyn]` (sweep FAZA 4).

## 3. Kroki realizacji
1. **(FAZA 3, po M18)** Serwerowa bramka aprobaty eksportu — handlery odrzucają artefakt nie-`approved`/`published` + test T4 (export `draft` → 403). **Zależne od trwałości stanu publish M18.**
2. **(FAZA 3)** beta-guard na `/presentations`; rate-limit + revoke + 410 na share decku.
3. **(FAZA 2 naprawa)** Fix testów: mock i18n (T1) + decyzja o 25 stale testach middleware (T2).
4. **(FAZA 3/4)** Dedykowany baner v8 OFF; §27 — persistKey, `EntityStatusChip`, tokeny kolorów, bulk lub usunięcie, sort persist; i18n `t()` (koniec 18× `isPolish`).
5. **(FAZA 4)** Test viewera RAP (T6), liczniki (T7), E2E S1–S7; CI `Londyn`.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** bramka eksportu egzekwuje aprobatę serwerowo; zero martwych przycisków; lista z rejestru trwała.
2. **Bezpieczeństwo:** export nie-approved → 403; beta-guard na route; share z rate-limit+revoke; rejestr org-scoped (już czysty); public viewer sanitizowany (już zrobione).
3. **i18n:** `t()` pełne (koniec 18× `isPolish`).
4. **Tokeny:** Visual Standard; `EntityStatusChip` zamiast surowych kropek.
5. **§27:** FilterableTable + persistKey + bulk + sort-persist.
6. **E2E w PR-gate:** S3 (approval serwerowo) + S7 (public viewer) zielone na `Londyn`.

## 5. Weryfikacja
- Bramka aprobaty: export artefaktu `draft`/`in_review` bezpośrednim API → 403 (test + żywy proof).
- beta-lock: direct URL `/presentations` → plate BETA_LOCKED.
- share: rate-limit działa, unshare unieważnia link, expired → 410.
- v8 OFF: użytkownik widzi dedykowany baner „moduł wyłączony", nie „failed to load".
- Rejestr: artefakt org B przez API → 404 (już zweryfikowane w audycie).
- `ENABLE_V8_GLOBAL` na staging/prod udokumentowane (decyduje czy moduł żyje); migracje artifact_registry/export_ledger/presentation_decks.share_token zastosowane.
- Uwaga DB: dev `.env` może wskazywać Railway PROD.

## 6. Zależności
- **Zależny od M18 (FAZA 1):** approval-gate Outputs czyta stan publish/wersji dokumentu — krok 1 (bramka aprobaty) WYMAGA trwałego stanu publish z M18 (kolejność z MASTER §5). Szlif M17 PO domknięciu trwałości M18.
- WEJŚCIE ← M02/M18/M19/M20 (artefakty do rejestru), M01/Teresa (deliverables za flagą).
- Public-viewer fix współdzielony z M19 (`1b67579d7a`) — już zrobione.
