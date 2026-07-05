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
| L-01 | bramka aprobaty eksportu tylko UI (publish-approval) | W-01,W-04 | `OutputsAggregateTabContent.tsx:1000-1004` (FE-only) | P2 | 3 | **ZAMKNIĘTA (częściowo — wave5; pełny cross-route = v1.1, doprecyz. 2026-06-19)** — `assertArtifactExportable()` helper dodany w `artifacts.routes.ts`; bramkuje OBA endpointy wave5: `GET /wave5/:id/export-manifest` + `POST /wave5/:id/exported` → 403 `EXPORT_NOT_APPROVED` gdy `publishState` nie in `['approved','published']`; `approved/published` przechodzą; commit `904224c484`. **PEŁNE ZAMKNIĘCIE cross-route export-gate (report-builder/presentations/table-platform) = v1.1 (JAWNIE ODŁOŻONE).** Zależność BLOKUJĄCA: gate czyta stan publish/wersji z **M18** → pełna polityka po domknięciu trwałości publish M18 (MASTER §5; W-04). | 2026-06-17 |
| L-02 | beta-lock tylko nawigacyjny | W-01 | `Sidebar.tsx:156` vs route bez beta-guarda | P2 | 3 | **NAPRAWIONA — `<BetaGate moduleId="MODULE_PRESENTATIONS">` owija `/presentations` route (`AppRoutes.tsx:1989`); zweryfikowane grepem 2026-06-17** | 2026-06-17 |
| L-03 | share decku bez rate-limit/revoke; expired→404 nie 410 | W-01 | `presentations.routes.ts` (viewer+mint+revoke) | P2 | 3 | **ZAMKNIĘTA** — rate-limit na publicznym viewerze `/shared/:token` (`publicViewerLimiter` 60/min) + mint (`shareRateLimiter` 30/min) + **revoke `DELETE /decks/:id/share`** (nuluje token→viewer 404). **expired→410 świadomie ODRZUCONE**: single-404 surface = anty-enumeracja (spójne z M18; 410 leakowałoby istnienie tokenu) | 2026-06-17 |
| L-04 | brak testu serwerowej bramki aprobaty (T4) | W-01 | `evidence/f2_tests_report.md` (S3 quality-only) | P0-test | 2 | **ZAMKNIĘTA** — `tests/integration/artifacts/export-approval-guard.contract.test.ts` (9/9 PASS, mutation-verified): `draft`→403 `EXPORT_NOT_APPROVED`, `in_review`→403, `approved`→proceeds (export-manifest), `published`→proceeds (exported), `not found`→404; commit `904224c484` | 2026-06-17 |
| L-05 | 25 stale testów middleware + mock-drift i18n + viewer RAP | W-01 | `v8FeatureGate.middleware.test.ts` (vs cofnięty `9b794bb7f0`) | P0-test | 2 | **ZAMKNIĘTA** — 25 stale testów usunięto; 17 nowych testów per aktualny kontrakt uproszczonego middleware (ON/OFF/undefined, org-gating, module-gating, throws→fail-open); mutation-verified; commit `27e268f812` | 2026-06-17 |
| L-06 | §27 brak persistKey + sort-persist | W-01 | `OutputsAggregateTabContent.tsx:1020` | P3 | 4 | **ZAMKNIĘTA** — `FilterableTable` otrzymał `persistKey="rap.outputs.aggregate"` → szerokości kolumn i sortowanie przeżywają reload; commit `90bca8243a` | 2026-06-17 |
| L-07 | §27 brak `EntityStatusChip` + klasy koloru + bulk nieużyty | W-01 | `OutputsAggregateTabContent.tsx:311-374` | P2 | 4 | **ZAMKNIĘTA** — kolumna status: `EntityStatusChip` (§27 kanon); ikony typów neutralne (`text-slate-400`) zgodne z visual standard; commit `90bca8243a` | 2026-06-17 |
| L-08 | v8 OFF → komunikat generyczny (nie „moduł wyłączony") | W-01 | `useRapData.ts:807` | P3 | 4 | **ZAMKNIĘTA** — `useRapData.ts`: 404 → `moduleDisabled` flag; `ReportsAndPresentationsHub.tsx`: nowy prop `moduleDisabled` → dedykowany baner „moduł wyłączony" (zamiast generic error); commit `90bca8243a` | 2026-06-17 |
| L-09 | i18n 96× `isPolish` (cały katalog, grep) | W-01 | `ReportsAndPresentations/*` (grep 2026-06-13=96) | P2 | 4 | **ZAMKNIĘTA `4d12b9153d`+`f5f333c135` (2026-06-18, Harvard 2)** — `ReportsAndPresentations/*` `isPolish`→`t('reports.*')`; `duplicateTitleSuffix()` przez singleton i18n. Dług PL domknięty: reports+rap (271 kluczy EN-default→PL). 0 brakujących w pl I en dla używanych `reports.*`/`rap.*`; pozostałe 18 `isPolish ?` = selektory danych (`meta.labelPl`). PL render zweryfikowany runtime (`qualityGates.title`→„Kontrola jakości", `rap.filters.status.active`→„Aktywny"). |  |
| L-10 | kręgosłup czat→deliverable (źródła artefaktów) | W-02 | `SPEC_ZADANIE_01` | P0-program | 0 | **NAPRAWIONA-SPEC_01 2026-06-17 `a6aea8d2d5`+`e7bd755b04`** — Tryb A function-calling: Teresa woła `generate_deliverable`→`plan/start`→SSE `deliverable`→montaż canvasa; źródła wpływają do rejestru tą samą drogą co intercept. Testy 6/6. Żywe S-A E2E (auth+LLM staging) pending. | |
| L-11 | public viewer over-disclosure | W-01 | `presentations.routes.ts:412,621` | P1 | — | **NAPRAWIONA `1b67579d7a`** | 2026-06-11 |
| L-12 | DEMO_* martwy blok | W-01 | `useRapData.ts:187-389` | — | — | **USUNIĘTA `167b2757bf`** | 2026-06-12 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | 25 stale testów middleware (`v8FeatureGate`) | skasować / przywrócić hardening cofnięty `9b794bb7f0` | Piotr | 2026-06-17 | **ROZSTRZYGNIĘTE** — skasować i przepisać per aktualny kontrakt; 17 nowych testów `27e268f812` |
| D-02 | bramka aprobaty eksportu (L-01) | osobna ścieżka delivery-export z publish-gate / potwierdzić które stany blokują na współdzielonym endpoincie / zostawić FE-only | Piotr | 2026-06-17 | **ROZSTRZYGNIĘTE** — guard na wave5 endpointach (approved/published pass, pozostałe 403); pełna polityka v1.1 (cross-route); commit `904224c484` |

### 05 · Flagi / rollout — `ENABLE_V8_GLOBAL` OFF→404 (decyduje czy moduł żyje czy = panel błędu — udokumentować wartość na staging/prod); `ENABLE_DELIVERABLES_LIGHT`+`VITE_` dla Teresa→Outputs. Beta-guard route = nawigacyjny (direct URL omija plate; API org-gated).
### 06 · Ryzyka — krok 1 (bramka aprobaty) WYMAGA trwałego publish M18 → kolejność MASTER §5; 25 stale testów middleware = dług decyzyjny (D-01); `ENABLE_V8_GLOBAL` na prod nieznana (decyduje o życiu modułu); dev `.env` → Railway PROD.
### 07 · Log — 2026-06-17 (Harvard 4 Fala 5): i18n sweep M17 — 0 ternary literałów zamienionych (17 legalnych `isPolish` usages: date-locale 6×, property access 9×, array index 1×, prop passing 1× — wszystkie poza zakresem zamiany). `keys_M17.json` = `{}`. L-09 i18n — ZABLOKOWANA (locales poza strefą Fali 1). Hex tokens M17: 0 hex w `ReportsAndPresentations/` (potwierdzone). 2026-06-17 (Runda 4): L-01 ZAMKNIĘTA (`904224c484` assertArtifactExportable guard wave5 endpoints); L-04 ZAMKNIĘTA (`904224c484` 9/9 contract tests); D-01+D-02 ROZSTRZYGNIĘTE. 2026-06-17 (Runda 3): L-05 ZAMKNIĘTA (`27e268f812`); L-09 ZABLOKOWANA (Fala 4); L-10 śledzona SPEC_01. 2026-06-17 (Runda 2 FE): L-06 ZAMKNIĘTA (persistKey FilterableTable), L-07 ZAMKNIĘTA (EntityStatusChip + neutral ikony), L-08 ZAMKNIĘTA (moduleDisabled baner) — commit `90bca8243a`. 2026-06-13 (teczka pogłębiona): L-01 potwierdzone (approval FE-only `:1000-1004`); INV_E 2 pkt STALE skorygowane; C rozbite na 2-warstwowy model bramek + enum 29 endpointów; F na Gherkin. Re-ocena D/G po Fazach 3/4 (zależne od M18). 2026-06-12: A:21→22 (`167b2757bf` DEMO_* usunięty). 2026-06-11: re-audit F:5→7 (`1b67579d7a` public viewer, `bc5579918d` beta-lock 3-warstwowy), 53→54. rose→danger sweep: 4 zmiany w `TrustStatePreviewSection.tsx` (ReportsAndPresentations/) — commit `0958115c3e` (merge `7fc5a7e7f0`).

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia (karta+INV_E+uwaga #1 jako zależność+MASTER) · R2 zero sierot · R3 statusy z dowodem (L-11/L-12 z commitami; L-01 potwierdzone w kodzie 2026-06-13; INV_E 2 pkt STALE skorygowane) · R4 DoD z liczbami (grep i18n=96, hex=0, `<table>`=0) · R5 decyzja z właścicielem (D-01) · A–E docelowy zlinkowany (C 2-warstwowy model bramek + enum API) · F epiki→stories Gherkin↔luki (zależność M18 jawna) · G DoD+S+sec · R6 sesja żywa = Faza 4. **Teczka kompletna do egzekucji.**

## EKRANY (inwentarz) — 2026-06-19

Weryfikacja kodu (read-only): top-3 = PRAWDA. L-01 bramka aprobaty serwerowa: `assertArtifactExportable()` (`artifacts.routes.ts:654`) → `EXPORT_NOT_APPROVED` 403 (`:674`), wpięta w dwa wave5 endpointy (`:686,702`). L-04 test: `tests/integration/artifacts/export-approval-guard.contract.test.ts` istnieje. L-03 share: `publicViewerLimiter` 60/min (`presentations.routes.ts:601,611`), `shareRateLimiter` mint/revoke (`:1808,1819,1877`), revoke→404 komentarz (`:623`). L-06/L-07: `persistKey="rap.outputs.aggregate"` (`OutputsAggregateTabContent.tsx:1076`), `EntityStatusChip` (`:410`).

Hub: `ReportsAndPresentationsHub.tsx` (ModuleHub — Menu 1/2/3, 7 zakładek, breadcrumbs).
| Ekran / widok | Cel | Plik |
|---|---|---|
| Outputs Aggregate (rejestr) | Główna tabela artefaktów (FilterableTable+TableWithPreview, persistKey) | `OutputsAggregateTabContent.tsx` |
| Reports tab | Zakładka raportów + preview | `ReportsTabContent.tsx`, `previews/ReportPreview.tsx` |
| Presentations tab | Zakładka decków + preview | `PresentationsTabContent.tsx`, `previews/PresentationPreview.tsx` |
| Sheets tab | Zakładka arkuszy | `SheetsTabContent.tsx` |
| Templates tab | Zakładka szablonów + preview | `TemplatesTabContent.tsx`, `previews/TemplatePreview.tsx` |
| Documents tab | Zakładka dokumentów (taksonomia) | w hubie / aggregate query |
| Trust-State Preview | 5 filarów trust + lineage | `TrustStatePreviewSection.tsx` |
| Public Share Viewer | Sanitizowany podgląd decku (`/shared/:token`) | `presentations.routes.ts` (BE) |
| Stan: pusty | empty-state domenowy | `OutputsAggregateTabContent.tsx` |
| Stan: błąd | panel błędu + retry | `useRapData.ts:807`→`OutputsAggregateTabContent.tsx:702` |
| Stan: v8 OFF | dedykowany baner "moduł wyłączony" (moduleDisabled) | `useRapData.ts`→`ReportsAndPresentationsHub.tsx` |

Liczba ekranów: ~11 (7 zakładek taksonomii + trust-state + public viewer + stany).

---

## Generatory Deliverable — warstwa zunifikowanego wejścia (M17 w programie M17–M20)

> **APPEND 2026-06-23.** Sekcja dokłada do teczki M17 NOWĄ rolę modułu w programie „Generatory Deliverable" (SSOT: [`DELIVERABLES-STAN-PRACY-ODBIORY.md`](DELIVERABLES-STAN-PRACY-ODBIORY.md), plan testów: `docs/qa/deliverables/test-plan/{E,T,X}-series.md`). Powyższa teczka (warstwy 00–H) opisuje ISTNIEJĄCY moduł Outputs Library (rejestr/biblioteka/lineage); ta sekcja opisuje M17 jako **zunifikowany launcher + hub + transakcyjny rejestr** generatorów. Zachowuje wzorzec 8-warstwowy ([`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md)): traceability epik→DoD→dowód, R3 (dowód > dziedziczenie), R4 (DoD z liczbami).
>
> **PRAWDA STANU (uczciwie, R3):** wszystkie sub-moduły niżej są **CODE-COMPLETE za flagą** (FE: `VITE_ENABLE_DELIVERABLES_LIGHT`; premium: `ENABLE_DELIVERABLES_PREMIUM`), **NIE wpięte w żywe UI klienta** (klienci OFF najpierw). Launcher (`OutputsLauncherModal`) + hub (`ReportsAndPresentationsHub`, `data-testid="reports-presentations-hub"`) renderują się w żywym UI na `/presentations`. `data-testid` dodane w tej sesji: `launcher-type-report|presentation|table`, `launcher-template-*`, `launcher-suggest-input/btn`, `outputs-new-btn`. Potwierdzone żywo: app bootuje lokalnie, hub renderuje się po zalogowaniu, przyciski „New presentation"/„New AI document" obecne.

### Rola M17 w programie (job-to-be-done warstwy wejścia)
M17 przestaje być tylko „biblioteką wyników" — staje się **jednym wejściem do produkcji deliverable**: launcher „Nowy" z 3 kaflami typu (Raport / Prezentacja / Tabela) → galeria template (DBR77 kuratorowane + user-created + Teresa-proponuje) → spójna „paczka kontekstu" → routing do edytora (Tryb B przez Teresę) → po generacji **transakcyjna rejestracja w Outputs + lineage**. Jeden silnik, zero duplikatów (północny gwiazdor: „jeden deliverable, zero duplikatów" — [[finding_deliverables_connection_model]]).

### F+ · EPIKI → STORIES (warstwa launcher/template/registry, traceable do E/T/X)

- **EPIK G1 — Launcher „Nowy" + 3 kafle typu (sub-moduł E1, 2 epiki):**
  - Story G1.1: jako użytkownik na tabie agregatu Outputs (`outputs_all/mine/review`) chcę kliknąć „Nowy" i zobaczyć modal z 3 kaflami typu, aby zacząć dowolny deliverable z jednego miejsca.
    - Gherkin: *dany* hub `/presentations`, tab agregatu, flaga `VITE_ENABLE_DELIVERABLES_LIGHT=true` · *gdy* klik `outputs-new-btn` · *wtedy* `role=dialog` „New output" z 3 kaflami (`launcher-type-report|presentation|table`). [dowód: `OutputsLauncherModal.tsx:213-286`, `ReportsAndPresentationsHub.tsx:237-246` `handleNewItem`; commit `a3387f55ed`]
  - Story G1.2: jako system chcę, by flaga OFF dawała fallback (NIE launcher), aby klient bez programu nie zobaczył nowego flow. Gherkin: *gdy* flaga != 'true' i klik „Nowy" · *wtedy* `navigate('/presentations?tab=templates')`, brak modala. [dowód: `ReportsAndPresentationsHub.tsx:237-246`]

- **EPIK G2 — Galeria template (sub-moduł E2 + T2 DBR77 + T3 user-created, 2+2+2 epiki):**
  - Story G2.1: jako użytkownik po wyborze typu chcę galerię szablonów (Blank zawsze pierwszy + kuratorowane DBR77 per typ), aby wystartować ze struktury, nie z pustki. Gherkin: *gdy* klik kafla typu · *wtedy* krok 2 „Choose a template" z `launcher-template-blank` + kuratorowane (doc: audit-report/exec-memo; deck: board-deck/diagnostic; table: risk-register/kpi-dashboard). [dowód: `OutputsLauncherModal.tsx:259-402`; T2 seed migracja `784`, commit `f3b19a78d1`]
  - Story G2.2: jako użytkownik chcę tworzyć/edytować/usuwać własne template (org-scope), widoczne tylko w mojej org. Gherkin: *dany* `POST/PUT/DELETE /api/deliverables/templates` za JWT+org · *gdy* cross-org PUT/DELETE · *wtedy* 403 (`TemplateForbiddenError`). [dowód: `deliverableTemplates.routes.ts`; migracja `785`; commit `4a79090db8`]

- **EPIK G3 — Silnik template zunifikowany (sub-moduł T1, federacja 3 tabel):**
  - Story G3.1: jako FE chcę jednego API `GET /api/deliverables/templates?type={doc|deck|table}` federującego 3 tabele (`report_builder_templates`/`presentation_templates`/`tp_base_templates`), aby launcher nie znał szczegółów per typ. Gherkin: *gdy* `type` valid · *wtedy* `200 {templates:[...]}`; *gdy* `type` invalid · *wtedy* `400`. [dowód: `deliverableTemplates.routes.ts:44-49`; migracja `783`; commit `bc41936116`]

- **EPIK G4 — Teresa-proponuje template (sub-moduł T4):**
  - Story G4.1: jako użytkownik chcę z intencji NL („zrób audyt") dostać sugestię template z confidence+uzasadnieniem. Gherkin: *gdy* `POST /api/deliverables/templates/suggest {intent,type}` · *wtedy* `200 {suggestion: null | {templateId,confidence,reasoning}}` (fail-open, NIGDY 500). [dowód: `deliverableTemplates.routes.ts:166-194`; commit `6d227f4798`]

- **EPIK G5 — Kontrakt „paczka kontekstu" + routing (sub-moduły E3 + E4):**
  - Story G5.1: jako system chcę, by każda ścieżka wejścia (encja inicjatywy/notatnik/ideas/canvas/czat/„Nowy") montowała spójny `openChatWithContext({entityType:'deliverable_launch', entityId:'{type}-{templateId}', contextData:{teresaPrompt, deliverableType, templateId}})`. Gherkin: *gdy* wybór typu+template w launcherze · *wtedy* opener czatu z `deliverableKickoffSeed(type)` zgodnym z detektorem Tryb B. [dowód: `ReportsAndPresentationsHub.tsx:205-224`; commit `097553ee6c`/`E3`]
  - Story G5.2: jako użytkownik po odpowiedzi Teresy (Tryb B) chcę trafić do właściwego edytora (doc→`/document-studio` TipTap, deck→`/presentations/:deckId` MELS, tabela→grid); błąd generacji = uczciwy komunikat, nie biały ekran. [dowód: E4 = REUSE Tryb B; mapowanie `toApiType` `OutputsLauncherModal.tsx:200-201`]

- **EPIK G6 — X5 doc/sheet = jedna encja (round-trip, brak duplikatu):**
  - Story G6.1: jako system chcę, by doc/sheet z czatu i edycja w Studio/Canvas były TYM SAMYM rekordem (`work_canvas_drafts.artifact_id ↔ wave5_artifacts`), aby lista Outputs nie pokazywała duplikatów. Gherkin: *gdy* `commitDraftToArtifact` re-commit istniejącego · *wtedy* `isNewArtifact===false`, bump wersji, zero drugiego rekordu. [dowód: `unifiedDocEntityService.ts`; commit `14f29f8f1f`]

- **EPIK G7 — X6 transakcyjny rejestr Outputs + lineage:**
  - Story G7.1: jako system chcę, by każdy artefakt ze źródła trafiał do Outputs ATOMOWO (BEGIN/COMMIT obu INSERT-ów: `v8_output_artifacts` + `v8_artifact_origin_links`), idempotentnie po `(originRuntime, originRecordId)`, z lineage do źródła; po błędzie ROLLBACK (zero driftu); org-scope. Gherkin: *gdy* 2× register tej samej pary · *wtedy* 1 artefakt (`isNew===false`); *gdy* błąd 2. INSERT · *wtedy* 0 wierszy. [dowód: `outputsTransactionalRegistry.ts`; commit `5825e2d7f6`]

### G+ · DoD globalny (7 kryteriów SSOT) — zastosowany do M17 launcher/template/registry

| # | Kryterium globalne | Stan dla M17 (warstwa generatorów) | Met / Pending |
|---|---|---|---|
| 1 | **Spięcie front↔back** (zero fasad/martwych CTA) | Launcher+hub renderują żywo; `data-testid` dodane (`outputs-new-btn`, `launcher-type-*`, `launcher-template-*`, `launcher-suggest-*`); template API federuje 3 tabele realnie; X6 rejestr transakcyjny | 🟡 **częściowo** — kod spięty, ale launcher→edytor (G5.2) idzie przez Teresę/Tryb B i **NIEZWERYFIKOWANE żywo na końcu** (wymaga LLM); klienci OFF |
| 2 | **Bezpieczeństwo** (org-scope, JWT, flaga per-org+fail-open, 0 P0/P1) | Template API: `verifyToken`+`requireOrgAccess` na całym routerze; org z JWT (`getOrgId`); cross-org PUT/DELETE→403; suggest fail-open (nigdy 500); X5/X6 org-scope (null/`[]` dla cudzej org) | 🟢 **code-side spełnione** (FT-8 zielone T1/T3/X5/X6); **żywy IDOR-test cross-org pending** (2 różne org w E2E = blocker test-infra) |
| 3 | **i18n** (PL+EN przez `t()`) | Launcher i18n PL/EN (`rap.outputs.launcher.*`); E1/E2/T4 i18n zadeklarowane zielone code-side; rdzeń M17 hub: L-09 ZAMKNIĘTA (`reports.*`/`rap.*` 271 kluczy) | 🟢 **code-side**; żywy PL/EN render launchera pending (FT-7) |
| 4 | **Tokeny CSS** (zero hex w chrome) | Hub: 0 hex (grep=0, sekcja G powyżej); launcher kafle/galeria = klasy Tailwind/tokeny | 🟢 **code-side** (dark-parytet launchera = FT-3 e2e + manual pending) |
| 5 | **Standard UI/UX** (kanon §7/§9/§17/§27; „mniej znaczy więcej") | Launcher 2-krokowy minimalny (typ→template), Blank zawsze pierwszy; hub = ModuleHub (Menu 1/2/3, breadcrumbs) | 🟡 **pending UI-review** (→UI Piotra; checkpoint manualny W1) |
| 6 | **tsc + lint + testy** (0 fail; KOMPLET FT) | Code-side FT zielone: E1 FT-1; E2 FT-1 10/10; E3 FT-2 6/6; T1 20/20; T2 20/20; T3 18/18; T4 22/22; X5 12/12; X6 10/10 | 🟡 **FT-1/FT-2/FT-8 zielone**; **FT-3 (e2e Playwright) NIE napisane** (plan w E/T/X-series, blokery test-id częściowo zdjęte); FT-7 manual 0 |
| 7 | **Flaga/rollout/telemetria** (zmiana za flagą per-org; fail-open; telemetria) | Launcher za `VITE_ENABLE_DELIVERABLES_LIGHT`; premium za `ENABLE_DELIVERABLES_PREMIUM`; telemetria kosztu przez AIPipeline (B5 resolver) | 🟢 **flaga + fail-open obecne**; **deploy staging za flagą + per-org rollout = pending** (znany blocker: VITE flaga build-time, [[finding_deliverables_vite_flag_deploy]]) |

**Podsumowanie DoD: 0/7 formalnie ZAMKNIĘTE.** Met code-side (kryteria 2,3,4,7) ale żaden nie domknięty do końca bo brak: FT-3 e2e zielone na Londyn (kryt. 6), żywa weryfikacja launcher→edytor (kryt. 1), UI-review Piotra (kryt. 5), deploy staging + manual FT-7 + →F/→UI (kryt. 1,5,7). To jest stan **„code-complete, odbiór niedomknięty"** — zgodny z dashboardem SSOT (0/24 ZAMKNIĘTYCH).

### Status per sub-moduł (R3 — dowód, nie dziedziczenie)

| Sub-moduł | Rola w M17 | Code-side | Deploy | FT-3 e2e | Manual (FT-7) | →F | →UI |
|---|---|---|---|---|---|---|---|
| **E1** Launcher + 3 kafle | wejście | 🟢 (commit `a3387f55ed`; FT-1✅) | ⬜ pending | ⬜ plan E-series E1-S01..S12 | ⬜ 0/6 | ⬜ | ⬜ |
| **E2** Galeria template | wejście | 🟢 (commit `c4c8bac2d3`; FT-1 10/10) | ⬜ | ⬜ plan E2-S01..S08 | ⬜ 0/5 | ⬜ | ⬜ |
| **E3** Paczka kontekstu (3 ścieżki) | wejście | 🟢 (commit `097553ee6c`; FT-2 6/6) | ⬜ | ⬜ plan E3-S01..S10 (S01-05 zablokowane brakiem test-id „zrób z tego") | ⬜ 0/8 | ⬜ | ⬜ |
| **E4** Routing → edytor | wejście | 🟢 (REUSE Tryb B) | ⬜ | ⬜ plan E4-S01..S07 (S01-03 wymagają LLM lub mock) | ⬜ 0/4 | ⬜ | ⬜ |
| **T1** Model template + persyst | silnik | 🟢 (commit `bc41936116`; FT-1+2 20/20+org-scope) | ⬜ | ⬜ plan T1 (API testowalne OD ZARAZ; cross-org blocked = 2 org) | ⬜ 0/4 | ⬜ | ⬜ |
| **T2** Biblioteka DBR77 | silnik | 🟢 (commit `f3b19a78d1`; FT-1 14/14 + FT-2 6/6) | ⬜ | ⬜ plan T2 (golden FT-6 = ocena człowieka) | ⬜ 0/6 | ⬜ | ⬜ |
| **T3** User-created CRUD | silnik | 🟢 (commit `4a79090db8`; FT-1+2+8 18/18) | ⬜ | ⬜ plan T3 (CRUD API OD ZARAZ) | ⬜ 0/6 | ⬜ | ⬜ |
| **T4** Teresa-proponuje | silnik | 🟢 (commit `6d227f4798`; FT-1+2+6 22/22) | ⬜ | ⬜ plan T4 (suggest API OD ZARAZ; fail-open) | ⬜ 0/4 | ⬜ | ⬜ |
| **X5** doc/sheet = jedna encja | rejestr | 🟢 (commit `14f29f8f1f`; FT 12/12) | ⬜ (OPT-IN, żywe EP nietknięte) | ⬜ X5-U01 (UI brak dup) | ⬜ 0/6 | ⬜ | ⬜ |
| **X6** Transakcyjny rejestr + lineage | rejestr | 🟢 (commit `5825e2d7f6`; FT 10/10) | ⬜ (NIE modyfikuje żywej `registerArtifactOrigin`) | ⬜ X6-U01 (output natychmiast) | ⬜ 0/4 | ⬜ | ⬜ |

**Legenda statusu:** 🟢 GOTOWY code-side (FT-1/2/8 zielone, commit) · ⬜ pending. Wszystkie sub-moduły = **code-side done / deploy-pending / FT-3 e2e niedopisane / FT-7 manual 0 / →F →UI pending**.

### H+ · Rejestr wejść (dołożone — program Generatory Deliverable)
| ID | Źródło | Data | Treść (1 zd.) | → Luka / Story |
|----|--------|------|----------------|---------|
| W-06 | SSOT `DELIVERABLES-STAN-PRACY-ODBIORY.md` (E1-E4,T1-T4,X5,X6) | 2026-06-22 | M17 = zunifikowany launcher+hub+transakcyjny rejestr; 24/24 code-side, 0/24 ZAMKNIĘTE | G1-G7 |
| W-07 | `docs/qa/deliverables/test-plan/E-series.md` | 2026-06-22 | launcher nie nawiguje wprost do edytora — montuje opener Teresy (Tryb B); E3-S01..05 blokowane brakiem test-id „zrób z tego" | G5 (routing przez czat) |
| W-08 | `docs/qa/deliverables/test-plan/T-series.md` | 2026-06-22 | unified template API `doc\|deck\|table` federuje 3 tabele; cross-org 403/izolacja blokowane brakiem 2 org w E2E | G2/G3/G4 |
| W-09 | `docs/qa/deliverables/test-plan/X-series.md` | 2026-06-22 | X5 jedna encja (zero dup) + X6 transakcyjny rejestr + lineage; brak per-wiersz/per-tab `data-testid` w hubie | G6/G7 |
| W-10 | Sesja 2026-06-23 (żywa weryfikacja) | 2026-06-23 | app bootuje lokalnie, hub renderuje się po zalogowaniu; `data-testid` launchera dodane (`outputs-new-btn`, `launcher-type-*`, `launcher-template-*`, `launcher-suggest-input/btn`) | (odblokowuje FT-3) |

### H+ · Rejestr decyzji (dołożone)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-03 | Kiedy wpiąć launcher w żywe UI klienta | OFF do domknięcia FT-3+FT-7+staging / włączyć per-org pilot | Piotr | po W1 checkpoint | **OTWARTE** — klienci OFF najpierw (decyzja programu) |
| D-04 | Próg jakości FT-6 (Q1) dla golden T2/T4 | ≥85% wszystkie formaty (locked 2026-06-22) | Piotr | — | **ROZSTRZYGNIĘTE** (Q1=≥85%) — pomiar live pending |
| D-05 | 2 różne org w E2E test-support (odblokowuje cross-org 403: T1/T3/X5/X6) | rozszerzyć `/api/test-support/bootstrap` o świeżą org / honest-skip | Piotr/Claude | przed FT-8 e2e | **OTWARTE** |

### Bramka teczki (warstwa generatorów): dokumentacyjnie kompletna; ODBIÓR niedomknięty
Epiki G1-G7 traceable do E/T/X + commitów (R2 zero sierot); DoD 7/7 zmapowane z liczbami FT (R4); statusy z dowodem-commitem, nie dziedziczone (R3); decyzje z właścicielem (R5: D-03/D-05 otwarte). **Następny krok (R6):** deploy staging za flagą → FT-3 e2e (E/T/X-series) → checkpoint manualny W1 (FT-7) → →F/→UI Piotra. Manualne scenariusze wykonawcze: [`Harvard/Testy manualne/TESTY_M17_OUTPUTS.md`](../Testy%20manualne/TESTY_M17_OUTPUTS.md) §Generatory Deliverable.
