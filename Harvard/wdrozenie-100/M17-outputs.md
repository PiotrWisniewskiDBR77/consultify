# TECZKA M17 — Outputs (Outputs Library)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje kartę audytu + INV_E + kod i dokłada brakujące ogniwa (Rejestr Wejść z uwagami żywymi · Rejestr Decyzji · DoD z liczbami · korekta staleności R3). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md), referencja: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M17 Outputs (Outputs Library — biblioteka artefaktów) · **Pula:** beta (closed; cały moduł za `ENABLE_V8_GLOBAL`)
- **Ocena audytu:** 54/100 · **Tier:** Alpha · **Status:** FAZA 3 (szlif; **zależny od M18**) → FAZA 4 · **Rozmiar:** M (1–3 dni)
- **Żywy bloker:** brak P0 (P1 over-disclosure public viewera — NAPRAWIONE `1b67579d7a`)
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M17-outputs/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md` · **INV_E:** `…/INV_E_outputs_studia_meeting.md` (OUTPUTS poz.1-16)
- **Kod:** `src/components/ReportsAndPresentations/` (`ReportsAndPresentationsHub`, `OutputsAggregateTabContent.tsx`, `useRapData.ts`) · `server/src/services/artifactRegistryService.ts` · `server/src/routes/artifacts.routes.ts` · `…/presentations.routes.ts` (public share) · `…/report-builder.routes.ts`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta §0 + INV_E OUTPUTS | job-to-be-done + zakres |
| B UX docelowe | 🟢 | karta §5 (§27 wysoka zgodność `FilterableTable`+`TableWithPreviewLayout`) | delta §27 (persistKey/chip) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + `artifactRegistryService.ts` | model org-scope + bramki (niżej) |
| D AI/Teresa | 🟢 | karta §0 (N/D — biblioteka nie produkuje kart) | deliverables za flagą |
| E Integracje | 🟢 | karta §1g | zależność M18 (niżej) |
| F Epiki | 🟢 | karta §7 (3 fale) | epiki (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2/§7 | **liczby grep 2026-06-13** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść + Decyzji** |

---

## A · INTENCJA *(link + uzupełnienie)*
- **Job-to-be-done:** dać jeden rejestr wszystkich artefaktów (raporty/decki/dokumenty/tabele) z governance — taksonomia 7 zakładek, trust-state, lineage, review/publish, bramka eksportu — jako warstwę „skąd to wyszło i czy gotowe do wydania".
- **Persony/role:** konsultant (przegląd/eksport), admin/owner (review/publish role-gated ADMIN/OWNER serwerowo), publiczny odbiorca share decku (read sanitizowany). Org-scope rejestru zawsze z tokena.
- **Zakres v1:** lista z rejestru `artifact_registry` (za V8) · 7 zakładek taksonomii + filtry/liczniki · trust-state 5 filarów + lineage · review/publish flow · bramka eksportu (quality serwerowo) · akcje wierszowe (open/export/archive/template) · public share viewer · register-in-outputs z Canvas/Teresa. **POZA v1:** produkcja treści kart (to robią studia M18/M19/M20 i Report Builder — M17 tylko linkuje).
- **Metryka:** lista trwała z rejestru; export tylko po aprobacie; 0 cross-org; public viewer bez over-disclosure.

## B · UX DOCELOWE *(link + delta §27)*
- **§27 wysoka zgodność:** główna tabela artefaktów = kanoniczne `FilterableTable`+`TableWithPreviewLayout` (`OutputsAggregateTabContent.tsx:1020`). **Delta:** brak persistKey (reset szerokości po reload, L-06), brak `EntityStatusChip` (surowe kropki, L-07), bulk/select nieużyty, sort bez persistu.
- **Wzorzec hubowy:** `ReportsAndPresentationsHub` zgodny (Menu 1/2/3, 7 zakładek, breadcrumbs, dynamic tabs).
- **Stany:** v8 OFF → API 404 JSON, FE łapie i pokazuje panel błędu z retry (`useRapData.ts:807`→`OutputsAggregateTabContent.tsx:702`) — **NIE niema pustka** (czerwona flaga „cicha pustka" OBALONA). Delta: komunikat generyczny „failed to load" zamiast „moduł wyłączony" (L-08).

## C · DANE + API + REGUŁY *(link + org-scope/bramki)*
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f (`ENABLE_V8_GLOBAL` OFF→404 pre+post-auth; `ENABLE_DELIVERABLES_LIGHT` dla Teresa→Outputs).
- **Reguła org-scope (kanon, czysty):** `getArtifactForUser`/`getArtifactListItemRow` → `WHERE a.organization_id=? AND a.artifact_id=?` (`artifactRegistryService.ts:1891`), lista `:1944`; orgId zawsze z tokena → artefakt org B = 404. **Trzeci moduł z rzędu BEZ cross-org IDOR.**
- **Reguły bramek:** review/publish role-gated ADMIN/OWNER serwerowo (`artifacts.routes.ts:1011`); bramka eksportu — **quality serwerowo** (`report-builder.routes.ts:180`, `presentations.routes.ts:1444`→409/422), ale **publish-approval (`publishState`/`validationState`) tylko UI** (`OutputsAggregateTabContent.tsx:1001-1004` disable przycisku) → obejście bezpośrednim API (L-01, zweryfikowane: brak serwerowego sprawdzenia approval). Public share — over-disclosure NAPRAWIONE (`1b67579d7a`).

## D · AI / TERESA *(link)*
- **N/D produkcyjnie:** M17 to biblioteka, nie produkuje treści kart (CARD_CONTENT_FORMULA N/D). Teresa→Outputs = rejestracja deliverable za `ENABLE_DELIVERABLES_LIGHT`.
- **Kręgosłup (Uwaga #1):** artefakty wpływają do rejestru z M02/M18/M19/M20 i z Teresy (`metadata.deliverable`+event). Pęknięcie więzi czat→panel (`SPEC_ZADANIE_01`) dotyka ŹRÓDEŁ artefaktów, nie samego rejestru — zależność pośrednia.

## E · INTEGRACJE
Karta §1g. **WEJŚCIE ←** M02 Canvas (register-in-outputs, provenance — real, test `2bb18aae0c`), M01/Teresa (deliverables za flagą), M18/M19/M20 studia (artefakty do rejestru). **WYJŚCIE →** edytory natywne (`resolveArtifactOpenPath`), pliki (PDF/PPTX za quality-gate), public (`/presentations/shared/:token`). **ZALEŻNOŚĆ BLOKUJĄCA:** approval-gate Outputs czyta stan publish/wersji dokumentu z **M18** → krok „bramka aprobaty" WYMAGA trwałego stanu publish M18 (kolejność MASTER §5: szlif M17 PO domknięciu trwałości M18). Public-viewer fix współdzielony z M19 (`1b67579d7a`).

## F · EPIKI *(z karty §7, forma epików)*
- **EPIK 1 — Bramka aprobaty serwerowo (P2, po M18):** handlery eksportu odrzucają artefakt nie-`approved`/`published` (nie tylko quality) + test T4 (L-01). **Zależne od trwałości publish M18.** [Fala 1]
- **EPIK 2 — Bezpieczeństwo:** beta-guard route `/presentations` (L-02); rate-limit+revoke+410 na share decku (L-03). [Fala 2]
- **EPIK 3 — Test prawdy:** fix mock i18n T1; decyzja 25 stale testów middleware T2 (D-01); test approval serwerowy T4; viewer RAP T6 (L-04/L-05). [Fala 1/4]
- **EPIK 4 — Kanony:** §27 persistKey/`EntityStatusChip`/tokeny/bulk/sort-persist (L-06/L-07); i18n `t()` (L-09); dedykowany baner v8 OFF (L-08); CI `Londyn`. [Fala 3/4]

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M17 |
|---|-----------|-----------|
| 1 | Front↔back | bramka eksportu egzekwuje aprobatę serwerowo (nie tylko quality); lista trwała z rejestru; 0 martwych przycisków |
| 2 | Bezpieczeństwo | export nie-approved → 403 (serwerowo); beta-guard route; share rate-limit+revoke+410; rejestr org-scoped (czysty); public viewer sanitizowany (zrobione `1b67579d7a`) |
| 3 | i18n | **96 z 96** `isPolish` w `src/components/ReportsAndPresentations` (grep 2026-06-13 = **96**; karta podawała „18× isPolish" tylko w `OutputsAggregateTabContent`) → `t()` |
| 4 | Tokeny | **0 hex `#RRGGBB`** w `ReportsAndPresentations` (grep = 0); dług = klasy Tailwind (`blue-400`/`emerald-400`/`amber-400` `:311-374`) + brak `EntityStatusChip` |
| 5 | §27 | **0** surowych `<table>` (grep = 0; kanon `FilterableTable`); brak persistKey + bulk + sort-persist |
| 6 | E2E w PR-gate | S3 (approval serwerowo) + S7 (public viewer RAP) zielone na `Londyn` |

Scenariusze S1–S7: karta §0/§2 (330 PASS/30 FAIL = harness: i18n mock + 25 stale middleware + fixture gap). Bezpieczeństwo: karta §6. *(R4: 96× isPolish to CAŁY katalog M17, nie tylko `OutputsAggregateTabContent` 18× z karty — sweep i18n musi objąć cały `ReportsAndPresentations`.)*

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | 54/100; rejestr org-scoped czysty; bramka aprobaty tylko UI; share bez rate-limit; §27 odstępstwa | L-01..L-09 |
| W-02 | **Uwaga żywa #1** (`SPEC_ZADANIE_01`) | 2026-06-13 | kręgosłup czat→panel pęka — dotyka ŹRÓDEŁ deliverables wpływających do rejestru | L-10 (zależność pośrednia) |
| W-03 | INV_E OUTPUTS poz.1-16 | 2026-06-11 | 2 pkt STALE: v8-404 nie jest niemą pustką; register-in-outputs test skommitowany | (skorygowane) |
| W-04 | **MASTER §5** (kolejność M18→M17) | 2026-06-13 | bramka aprobaty M17 czyta publish M18 → po trwałości M18 | L-01 (zależność) |
| W-05 | Feedback prod (kohorta beta) | — | brak własnej uwagi żywej M17 z 2026-06-13 | — (dziedziczy z karty) |

### 02 · Stan obecny (prawda kodu)
Rejestr org-scoped czysty (`:1891,1944`); 14/16 REALNE; DEMO_* martwy USUNIĘTY (`167b2757bf`); register-in-outputs realny+test (`2bb18aae0c`). **KOREKTA INV_E (R3, z karty):** v8-404 = panel błędu z retry, NIE niema pustka; register-in-outputs test skommitowany (teza „uncommitted" nieaktualna). **L-01 potwierdzone 2026-06-13:** publish-approval sprawdzany TYLKO w `OutputsAggregateTabContent.tsx:1001-1004` (disable przycisku FE); serwer pilnuje quality, NIE publish-approval → eksport `draft`/`in_review` bezpośrednim API obchodzi (org-scope+quality nadal chronią). P1 public viewer over-disclosure NAPRAWIONE (`1b67579d7a`).

### 03 · Rejestr luk
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | **Status** | Zweryf. |
|----|------|---------|--------------------|-------|------|-----------|---------|
| L-01 | bramka aprobaty eksportu tylko UI (publish-approval) | W-01,W-04 | `OutputsAggregateTabContent.tsx:1001-1004` (FE-only) | P2 | 3 | otwarta (**zależna od M18**) | 2026-06-13 |
| L-02 | beta-lock tylko nawigacyjny | W-01 | `Sidebar.tsx:156` vs route bez beta-guarda | P2 | 3 | otwarta |  |
| L-03 | share decku bez rate-limit/revoke; expired→404 nie 410 | W-01 | `/presentations/shared/:token` | P2 | 3 | otwarta |  |
| L-04 | brak testu serwerowej bramki aprobaty (T4) | W-01 | `evidence/f2_tests_report.md` (S3 quality-only) | P0-test | 2 | otwarta |  |
| L-05 | 25 stale testów middleware + mock-drift i18n + viewer RAP | W-01 | `v8FeatureGate.middleware.test.ts` (vs cofnięty `9b794bb7f0`) | P0-test | 2 | otwarta (**D-01**) |  |
| L-06 | §27 brak persistKey + sort-persist | W-01 | `OutputsAggregateTabContent.tsx:1020` | P3 | 4 | otwarta |  |
| L-07 | §27 brak `EntityStatusChip` + klasy koloru + bulk nieużyty | W-01 | `OutputsAggregateTabContent.tsx:311-374` | P2 | 4 | otwarta |  |
| L-08 | v8 OFF → komunikat generyczny (nie „moduł wyłączony") | W-01 | `useRapData.ts:807` | P3 | 4 | otwarta |  |
| L-09 | i18n 96× `isPolish` (cały katalog, grep) | W-01 | `ReportsAndPresentations/*` (grep 2026-06-13=96) | P2 | 4 | otwarta |  |
| L-10 | kręgosłup czat→deliverable (źródła artefaktów) | W-02 | `SPEC_ZADANIE_01` | P0-program | 0 | zależność (śledzona w SPEC_01) |  |
| L-11 | public viewer over-disclosure | W-01 | `presentations.routes.ts:412,621` | P1 | — | **NAPRAWIONA `1b67579d7a`** | 2026-06-11 |
| L-12 | DEMO_* martwy blok | W-01 | `useRapData.ts:187-389` | — | — | **USUNIĘTA `167b2757bf`** | 2026-06-12 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | 25 stale testów middleware (`v8FeatureGate`) | skasować / przywrócić hardening cofnięty `9b794bb7f0` | Piotr | TBD | otwarta |

### 05 · Flagi / rollout — `ENABLE_V8_GLOBAL` OFF→404 (decyduje czy moduł żyje czy = panel błędu — udokumentować wartość na staging/prod); `ENABLE_DELIVERABLES_LIGHT`+`VITE_` dla Teresa→Outputs. Beta-guard route = nawigacyjny (direct URL omija plate; API org-gated).
### 06 · Ryzyka — krok 1 (bramka aprobaty) WYMAGA trwałego publish M18 → kolejność MASTER §5; 25 stale testów middleware = dług decyzyjny (D-01); `ENABLE_V8_GLOBAL` na prod nieznana (decyduje o życiu modułu); dev `.env` → Railway PROD.
### 07 · Log — 2026-06-11: re-audit F:5→7 (`1b67579d7a` public viewer, `bc5579918d` beta-lock 3-warstwowy), 53→54. 2026-06-12: A:21→22 (`167b2757bf` DEMO_* usunięty). 2026-06-13 (teczka): L-01 potwierdzone (approval FE-only); INV_E 2 pkt STALE skorygowane. Re-ocena D/G po Fazach 3/4 (zależne od M18).

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia (karta+INV_E+uwaga #1 jako zależność+MASTER) · R2 zero sierot · R3 statusy z dowodem (L-11/L-12 z commitami; L-01 potwierdzone w kodzie 2026-06-13; INV_E 2 pkt STALE skorygowane) · R4 DoD z liczbami (grep i18n=96, hex=0, `<table>`=0) · R5 decyzja z właścicielem (D-01) · A–E docelowy zlinkowany · F epiki↔luki (zależność M18 jawna) · G DoD+S+sec · R6 sesja żywa = Faza 4. **Teczka kompletna do egzekucji.**
