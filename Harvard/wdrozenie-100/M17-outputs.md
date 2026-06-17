# TECZKA M17 — Outputs (Outputs Library)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje kartę audytu + INV_E + kod i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi · Rejestr Decyzji · DoD z liczbami · korekta staleności R3). Pogłębiona do poziomu PODŁOGI [`M13-inicjatywy.md`](M13-inicjatywy.md) (2026-06-13): C = model danych + bramki + enumeracja API; F = epiki→stories Gherkin→L-xx; G = liczby grep per-plik. Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md).

## 00 · Nagłówek
- **Moduł:** M17 Outputs (Outputs Library — biblioteka artefaktów) · **Pula:** beta (closed; cały moduł za `ENABLE_V8_GLOBAL`)
- **Ocena audytu:** 54/100 · **Tier:** Alpha · **Status:** FAZA 3 (szlif; **zależny od M18**) → FAZA 4 · **Rozmiar:** M (1–3 dni)
- **Żywy bloker:** brak P0 (P1 over-disclosure public viewera — NAPRAWIONE `1b67579d7a`)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13 (pogłębiona)
- **Karta:** `Harvard/modules/M17-outputs/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md` · **INV_E:** `…/INV_E_outputs_studia_meeting.md` (OUTPUTS poz.1-16)
- **Kod:** FE `src/components/ReportsAndPresentations/` (13 plików: `ReportsAndPresentationsHub.tsx`, `OutputsAggregateTabContent.tsx`, `ReportsTabContent/PresentationsTabContent/SheetsTabContent/TemplatesTabContent.tsx`, `TrustStatePreviewSection.tsx`, `useRapData.ts`, `useTrustState.ts`, `artifactNavigation.ts`, `outputsLibraryTabQuery.ts`, `duplicateArtifactToDraft.ts`) · BE `server/src/services/artifactRegistryService.ts` · `server/src/routes/artifacts.routes.ts` (29 endpointów) · `…/report-builder.routes.ts` (93 endpointy) · `…/presentations.routes.ts` (public share)

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta §0 + INV_E OUTPUTS | job-to-be-done + zakres |
| B UX docelowe | 🟢 | karta §5 (§27 wysoka zgodność `FilterableTable`+`TableWithPreviewLayout`) | stany ekranu + delta §27 (persistKey/chip) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + `artifactRegistryService.ts` | **model org-scope + 7-stanowa taksonomia + bramki dwuwarstwowe + enum API** (niżej) |
| D AI/Teresa | 🟢 | karta §0 (N/D — biblioteka nie produkuje kart) | deliverables za flagą + kręgosłup #1 |
| E Integracje | 🟢 | karta §1g | **zależność M18 (publish→bramka aprobaty)** (niżej) |
| F Epiki | 🟢 | karta §7 (3 fale) | **epiki→stories Gherkin→L-xx** (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby grep 2026-06-13 per-plik** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji** |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** dać jeden rejestr wszystkich artefaktów (raporty/decki/dokumenty/tabele) z governance — taksonomia 7 zakładek, trust-state, lineage, review/publish, bramka eksportu — jako warstwę „skąd to wyszło i czy gotowe do wydania".
- **Persony/role:** konsultant (przegląd/eksport), admin/owner (review/publish role-gated ADMIN/OWNER serwerowo), publiczny odbiorca share decku (read sanitizowany). Org-scope rejestru zawsze z tokena.
- **Zakres v1:** lista z rejestru `artifact_registry` (za V8) · 7 zakładek taksonomii + filtry/liczniki · trust-state 5 filarów + lineage · review/publish flow · bramka eksportu (quality serwerowo) · akcje wierszowe (open/export/archive/template) · public share viewer · register-in-outputs z Canvas/Teresa. **POZA v1:** produkcja treści kart (to robią studia M18/M19/M20 i Report Builder — M17 tylko linkuje).
- **Metryka:** lista trwała z rejestru; export tylko po aprobacie; 0 cross-org; public viewer bez over-disclosure.

## B · UX DOCELOWE *(link + stany + delta §27)*
- **§27 wysoka zgodność:** główna tabela artefaktów = kanoniczne `FilterableTable`+`TableWithPreviewLayout` (`OutputsAggregateTabContent.tsx:1020`). **Delta:** brak persistKey (reset szerokości po reload, L-06), brak `EntityStatusChip` (surowe kropki, L-07), bulk/select nieużyty, sort bez persistu.
- **Wzorzec hubowy:** `ReportsAndPresentationsHub` zgodny (Menu 1/2/3, 7 zakładek, breadcrumbs, dynamic tabs).
- **Stany ekranu (docelowo, koniec cichych pustek):**
  | Stan | Obecnie | Docelowo |
  |---|---|---|
  | pusty | lista pusta = brak komunikatu domenowego | empty-state „brak artefaktów / utwórz w studiu" |
  | ładowanie | spinner (`useRapData.ts`) | OK |
  | błąd | panel błędu z retry (`useRapData.ts:807`→`OutputsAggregateTabContent.tsx:702`) — **NIE niema pustka (flaga OBALONA)** | OK |
  | v8 OFF | komunikat generyczny „failed to load" | dedykowany baner „moduł wyłączony" (L-08) |
  | brak-uprawnień | API org-gated → 404/403 | komunikat „brak dostępu" |

## C · DANE + API + REGUŁY *(pogłębione — model + taksonomia + bramki + enum API)*
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f (`ENABLE_V8_GLOBAL` OFF→404 pre+post-auth; `ENABLE_DELIVERABLES_LIGHT` dla Teresa→Outputs).
- **Model danych (rejestr):** `artifact_registry` (org-scoped) + `export_ledger` (eksporty) + origin-links (lineage); odczyt zawsze `WHERE a.organization_id=? AND a.artifact_id=?` (`artifactRegistryService.ts:1891`), lista `:1944`. Public share = `presentation_decks.share_token` (32-hex, 122-bit).
- **Taksonomia 7 zakładek (FE stan):** Reports · Presentations · Sheets · Documents · Templates · (+2 agregatowe) — filtry+liczniki z raw (`useRapData.ts:755`). Każdy wiersz ma `governance.publishState` ∈ {`draft` · `in_review` · `reviewable_share` · `approved`/`published`} + `governance.validationState` ∈ {`pending` · …}.
- **Reguła org-scope (kanon, czysty):** orgId zawsze z tokena → artefakt org B = 404. **Trzeci moduł z rzędu BEZ cross-org IDOR** (kohorta M02/M25).
- **Bramki — DWIE warstwy (R3, kluczowe rozróżnienie):**
  | Bramka | Warstwa | Egzekucja | Dowód | Status |
  |---|---|---|---|---|
  | **review/publish** (start-review, Approve&publish) | rola | **serwerowa** ADMIN/OWNER | `artifacts.routes.ts:1011` | ✅ czysta |
  | **eksport — quality** (`REPORT_NOT_READY` 409 / `QUALITY_GATE_BLOCKED` 422) | jakość | **serwerowa** | `report-builder.routes.ts:180`, `presentations.routes.ts:1444` | ✅ czysta |
  | **eksport — publish-approval** (`publishState`/`validationState`) | aprobata | **TYLKO UI** (disable przycisku) | `OutputsAggregateTabContent.tsx:1000-1004` (`validationState==='pending'` …) | ⚠️ **L-01** — obejście bezpośrednim API |
- **Enumeracja API (`artifacts.routes.ts`, 29 endpointów; org z tokena):** lista/by-id (`GET /`, `GET /:id`, by-status, by-type) · trust-state/lineage (`:226-297`) · review/publish (`POST /:id/start-review`, `/approve`, `/publish` `:717,1002`) · eksport (delegacja do report-builder/presentations) · akcje wierszowe (`buildActionTargetPayload:73` → open/export/archive/template) · `GET /presentations/shared/:token` (public, sanitizowany). Report Builder = osobny router 93 endpointy (M17 linkuje, nie produkuje).

## D · AI / TERESA *(link + kręgosłup)*
- **N/D produkcyjnie:** M17 to biblioteka, nie produkuje treści kart (CARD_CONTENT_FORMULA N/D). Teresa→Outputs = rejestracja deliverable za `ENABLE_DELIVERABLES_LIGHT`.
- **Kręgosłup (Uwaga #1):** artefakty wpływają do rejestru z M02/M18/M19/M20 i z Teresy (`metadata.deliverable`+event). Pęknięcie więzi czat→panel (`SPEC_ZADANIE_01`: dwa rozłączne systemy artefaktów `useArtifactsStore` vs `WorkCanvasDocumentPanel`) dotyka ŹRÓDEŁ artefaktów wpływających do rejestru, nie samego rejestru — **zależność pośrednia** (L-10). Niezweryfikowane w specu: czy `docGenerationRuntime.ts` wpisuje artefakt do `useArtifactsStore` (do domknięcia przy fixie #1).

## E · INTEGRACJE
Karta §1g. **WEJŚCIE ←** M02 Canvas (register-in-outputs, provenance — real, test `2bb18aae0c`), M01/Teresa (deliverables za flagą), M18/M19/M20 studia (artefakty do rejestru). **WYJŚCIE →** edytory natywne (`resolveArtifactOpenPath`), pliki (PDF/PPTX za quality-gate), public (`/presentations/shared/:token`). **ZALEŻNOŚĆ BLOKUJĄCA (kolejność MASTER §5):** approval-gate Outputs (L-01) czyta stan publish/wersji dokumentu z **M18** → krok „bramka aprobaty serwerowa" WYMAGA trwałego stanu publish M18 → szlif M17 PO domknięciu trwałości M18. Public-viewer fix współdzielony z M19 (`1b67579d7a`, wspólny endpoint).

## F · EPIKI → STORIES → ZADANIA *(pogłębione, Gherkin → L-xx)*
- **EPIK 1 — Bramka aprobaty eksportu serwerowo (P2, po M18):**
  - Story 1.1: jako system chcę odrzucić eksport artefaktu nie-`approved`/`published`, aby niezatwierdzona treść nie wyszła do klienta.
    - Gherkin: *dany* artefakt `publishState=draft` · *gdy* klient woła handler eksportu bezpośrednim API · *wtedy* serwer zwraca 403 (nie tylko quality 409/422). [Z → **L-01**; zależne od trwałości publish M18]
    - Zadania: test T4 serwerowy (export `draft` → 403) [Z → **L-04**].
- **EPIK 2 — Bezpieczeństwo:**
  - Story 2.1: jako security chcę beta-guard na route `/presentations`, aby direct URL nie omijał plate BETA. Gherkin: *gdy* direct URL bez beta-flagi · *wtedy* plate BETA_LOCKED. [Z → **L-02**]
  - Story 2.2: jako security chcę rate-limit+revoke+410 na share decku. Gherkin: *gdy* >N/min na `/shared/:token` · *wtedy* 429; *gdy* revoke · *wtedy* 410 (nie 404). [Z → **L-03**]
- **EPIK 3 — Test prawdy:**
  - Story 3.1: fix mock i18n T1; decyzja 25 stale testów middleware T2 (D-01); viewer RAP T6. [Z → **L-04/L-05**]
- **EPIK 4 — Kanony:**
  - Story 4.1: §27 persistKey/`EntityStatusChip`/tokeny/bulk/sort-persist [Z → **L-06/L-07**]; i18n `t()` całość katalogu [Z → **L-09**]; dedykowany baner v8 OFF [Z → **L-08**]; CI `Londyn`.

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M17 |
|---|-----------|-----------|
| 1 | Front↔back | bramka eksportu egzekwuje aprobatę serwerowo (nie tylko quality `report-builder.routes.ts:180`); lista trwała z rejestru; 0 martwych przycisków (DEMO_* usunięty `167b2757bf`) |
| 2 | Bezpieczeństwo | export nie-approved → 403 (serwerowo); beta-guard route; share rate-limit+revoke+410; rejestr org-scoped (czysty `:1891,1944`); public viewer sanitizowany (zrobione `1b67579d7a`) |
| 3 | i18n | **96 z 96** `isPolish` w `src/components/ReportsAndPresentations` (grep 2026-06-13 = **96** — CAŁY katalog; karta podawała „18×" tylko w `OutputsAggregateTabContent`) → `t()` |
| 4 | Tokeny | **0 hex `#RRGGBB`** w `ReportsAndPresentations` (grep = 0); dług = klasy Tailwind (`blue-400`/`emerald-400`/`amber-400` `:311-374`) + brak `EntityStatusChip` |
| 5 | §27 | **0** surowych `<table>` (grep = 0; kanon `FilterableTable`); brak persistKey + bulk + sort-persist |
| 6 | E2E w PR-gate | S3 (approval serwerowo) + S7 (public viewer RAP) zielone na `Londyn` |

Scenariusze S1–S7: karta §0/§2 (330 PASS/30 FAIL = harness: i18n mock + 25 stale middleware + fixture gap). Bezpieczeństwo: karta §6. *(R4: 96× isPolish to CAŁY katalog M17 — sweep i18n musi objąć cały `ReportsAndPresentations`, nie tylko `OutputsAggregateTabContent`.)*

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 54/100; rejestr org-scoped czysty; bramka aprobaty tylko UI; share bez rate-limit; §27 odstępstwa | L-01..L-09 |
| W-02 | **Uwaga żywa #1** (`SPEC_ZADANIE_01`) | 2026-06-13 | kręgosłup czat→panel pęka — dotyka ŹRÓDEŁ deliverables wpływających do rejestru (dwa systemy artefaktów) | L-10 (zależność pośrednia) |
| W-03 | INV_E OUTPUTS poz.1-16 | 2026-06-11 | 2 pkt STALE: v8-404 nie jest niemą pustką; register-in-outputs test skommitowany | (skorygowane) |
| W-04 | **MASTER §5** (kolejność M18→M17) | 2026-06-13 | bramka aprobaty M17 czyta publish M18 → po trwałości M18 | L-01 (zależność) |
| W-05 | Feedback prod (kohorta beta) | — | brak własnej uwagi żywej M17 z 2026-06-13 | — (dziedziczy z karty) |

### 02 · Stan obecny (prawda kodu)
Rejestr org-scoped czysty (`:1891,1944`); 14/16 REALNE; DEMO_* martwy USUNIĘTY (`167b2757bf`); register-in-outputs realny+test (`2bb18aae0c`). **KOREKTA INV_E (R3, z karty):** v8-404 = panel błędu z retry, NIE niema pustka; register-in-outputs test skommitowany (teza „uncommitted" nieaktualna). **L-01 potwierdzone w kodzie 2026-06-13:** publish-approval sprawdzany TYLKO w `OutputsAggregateTabContent.tsx:1000-1004` (`item.governance?.validationState === 'pending'` disable przycisku FE); serwer pilnuje quality, NIE publish-approval → eksport `draft`/`in_review` bezpośrednim API obchodzi (org-scope+quality nadal chronią). P1 public viewer over-disclosure NAPRAWIONE (`1b67579d7a`).

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | **Status** | Zweryf. |
|----|------|---------|--------------------|-------|------|-----------|---------|
| L-01 | bramka aprobaty eksportu tylko UI (publish-approval) | W-01,W-04 | `OutputsAggregateTabContent.tsx:1000-1004` (FE-only) | P2 | 3 | **WYMAGA DECYZJI (D-02)** — endpointy eksportu są WSPÓŁDZIELONE authoring(DeckBuilder, eksport draftów legalny)↔governed-delivery; hardcode publish-state gate zepsułby authoring export. Potrzeba: osobna ścieżka delivery-export LUB potwierdzenie polityki (które stany blokują). NIE implementuję bramki łamiącej authoring | 2026-06-17 |
| L-02 | beta-lock tylko nawigacyjny | W-01 | `Sidebar.tsx:156` vs route bez beta-guarda | P2 | 3 | **NAPRAWIONA — `<BetaGate moduleId="MODULE_PRESENTATIONS">` owija `/presentations` route (`AppRoutes.tsx:1989`); zweryfikowane grepem 2026-06-17** | 2026-06-17 |
| L-03 | share decku bez rate-limit/revoke; expired→404 nie 410 | W-01 | `presentations.routes.ts` (viewer+mint+revoke) | P2 | 3 | **ZAMKNIĘTA** — rate-limit na publicznym viewerze `/shared/:token` (`publicViewerLimiter` 60/min) + mint (`shareRateLimiter` 30/min) + **revoke `DELETE /decks/:id/share`** (nuluje token→viewer 404). **expired→410 świadomie ODRZUCONE**: single-404 surface = anty-enumeracja (spójne z M18; 410 leakowałoby istnienie tokenu) | 2026-06-17 |
| L-04 | brak testu serwerowej bramki aprobaty (T4) | W-01 | `evidence/f2_tests_report.md` (S3 quality-only) | P0-test | 2 | **CZĘŚCIOWO POKRYTA — zależna od D-02.** Quality-gate (422) pokryty: `tests/integration/presentations/export-quality-gate.regression.test.ts`. Publish-approval gate (403) NIE ISTNIEJE serwerowo (L-01) → test T4 (eksport `draft` → 403) niemożliwy bez decyzji D-02 o polityce ścieżek. Można przetestować bez D-02: eksport artefaktu w stanie `draft` → quality permissive → 200 (demonstrating that only quality-gate, not publish-approval, is enforced server-side); taki test stanowi regression gdy D-02 doda bramkę. NIE implementuję testu full T4 bez D-02 (scope: integracja z `artifact_registry` + decyzja ścieżek). | 2026-06-17 |
| L-05 | 25 stale testów middleware + mock-drift i18n + viewer RAP | W-01 | `v8FeatureGate.middleware.test.ts` (vs cofnięty `9b794bb7f0`) | P0-test | 2 | otwarta (**D-01**) |  |
| L-06 | §27 brak persistKey + sort-persist | W-01 | `OutputsAggregateTabContent.tsx:1020` | P3 | 4 | **ZAMKNIĘTA** — `FilterableTable` otrzymał `persistKey="rap.outputs.aggregate"` → szerokości kolumn i sortowanie przeżywają reload; commit `90bca8243a` | 2026-06-17 |
| L-07 | §27 brak `EntityStatusChip` + klasy koloru + bulk nieużyty | W-01 | `OutputsAggregateTabContent.tsx:311-374` | P2 | 4 | **ZAMKNIĘTA** — kolumna status: `EntityStatusChip` (§27 kanon); ikony typów neutralne (`text-slate-400`) zgodne z visual standard; commit `90bca8243a` | 2026-06-17 |
| L-08 | v8 OFF → komunikat generyczny (nie „moduł wyłączony") | W-01 | `useRapData.ts:807` | P3 | 4 | **ZAMKNIĘTA** — `useRapData.ts`: 404 → `moduleDisabled` flag; `ReportsAndPresentationsHub.tsx`: nowy prop `moduleDisabled` → dedykowany baner „moduł wyłączony" (zamiast generic error); commit `90bca8243a` | 2026-06-17 |
| L-09 | i18n 96× `isPolish` (cały katalog, grep) | W-01 | `ReportsAndPresentations/*` (grep 2026-06-13=96) | P2 | 4 | **ZABLOKOWANA (Fala 4)** — `public/locales/*` ZAKAZANE w Fali 1; wymaga koordynacji z agentem i18n (inny commit); scope: sweep `t()` przez cały katalog `src/components/ReportsAndPresentations/` |  |
| L-10 | kręgosłup czat→deliverable (źródła artefaktów) | W-02 | `SPEC_ZADANIE_01` | P0-program | 0 | zależność (śledzona w SPEC_01) |  |
| L-11 | public viewer over-disclosure | W-01 | `presentations.routes.ts:412,621` | P1 | — | **NAPRAWIONA `1b67579d7a`** | 2026-06-11 |
| L-12 | DEMO_* martwy blok | W-01 | `useRapData.ts:187-389` | — | — | **USUNIĘTA `167b2757bf`** | 2026-06-12 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | 25 stale testów middleware (`v8FeatureGate`) | skasować / przywrócić hardening cofnięty `9b794bb7f0` | Piotr | TBD | otwarta (modułowa) |
| D-02 | bramka aprobaty eksportu (L-01) | osobna ścieżka delivery-export z publish-gate / potwierdzić które stany blokują na współdzielonym endpoincie / zostawić FE-only | Piotr | TBD | **otwarta** — endpointy eksportu współdzielone authoring↔delivery; gate na wspólnym endpoincie łamie eksport draftów w DeckBuilder; wymaga rozdzielenia ścieżek |

### 05 · Flagi / rollout — `ENABLE_V8_GLOBAL` OFF→404 (decyduje czy moduł żyje czy = panel błędu — udokumentować wartość na staging/prod); `ENABLE_DELIVERABLES_LIGHT`+`VITE_` dla Teresa→Outputs. Beta-guard route = nawigacyjny (direct URL omija plate; API org-gated).
### 06 · Ryzyka — krok 1 (bramka aprobaty) WYMAGA trwałego publish M18 → kolejność MASTER §5; 25 stale testów middleware = dług decyzyjny (D-01); `ENABLE_V8_GLOBAL` na prod nieznana (decyduje o życiu modułu); dev `.env` → Railway PROD.
### 07 · Log — 2026-06-11: re-audit F:5→7 (`1b67579d7a` public viewer, `bc5579918d` beta-lock 3-warstwowy), 53→54. 2026-06-12: A:21→22 (`167b2757bf` DEMO_* usunięty). 2026-06-13 (teczka pogłębiona): L-01 potwierdzone (approval FE-only `:1000-1004`); INV_E 2 pkt STALE skorygowane; C rozbite na 2-warstwowy model bramek + enum 29 endpointów; F na Gherkin. Re-ocena D/G po Fazach 3/4 (zależne od M18). **2026-06-17 (Runda 2 FE): L-06 ZAMKNIĘTA (persistKey FilterableTable), L-07 ZAMKNIĘTA (EntityStatusChip + neutral ikony), L-08 ZAMKNIĘTA (moduleDisabled baner) — commit `90bca8243a`.** **2026-06-17 (Runda 3): L-04 — zaktualizowana zależność; quality-gate pokryty (`export-quality-gate.regression.test.ts`); publish-approval test blocked by D-02 (endpointy współdzielone authoring↔delivery); bez D-02 możliwy tylko test negatywny draft→200. L-10 — śledzona jako SPEC_01, nie lokalna; zależność pośrednia potwierdzona (SPEC_ZADANIE_01 istnieje w `Harvard/SPEC_ZADANIE_01_chat_controller.md` — Tryb C: dwa rozłączne systemy artefaktów useArtifactsStore vs WorkCanvasDocumentPanel; dotyczy źródeł artefaktów wpływających do rejestru M17, nie samego rejestru). L-09 ZABLOKOWANA (Fala 4) — `public/locales/*` ZAKAZANE w Fali 1; wymaga koordynacji z agentem i18n; scope: 96× `isPolish` w całym `src/components/ReportsAndPresentations/`.**

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia (karta+INV_E+uwaga #1 jako zależność+MASTER) · R2 zero sierot · R3 statusy z dowodem (L-11/L-12 z commitami; L-01 potwierdzone w kodzie 2026-06-13; INV_E 2 pkt STALE skorygowane) · R4 DoD z liczbami (grep i18n=96, hex=0, `<table>`=0) · R5 decyzja z właścicielem (D-01) · A–E docelowy zlinkowany (C 2-warstwowy model bramek + enum API) · F epiki→stories Gherkin↔luki (zależność M18 jawna) · G DoD+S+sec · R6 sesja żywa = Faza 4. **Teczka kompletna do egzekucji.**
