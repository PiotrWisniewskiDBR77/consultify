# TECZKA M13 — Inicjatywy (wzorzec referencyjny wg `_WZORZEC_TECZKI.md`)

> Pierwsza pełna teczka wg kanonu 8 warstw. Reużywa: karty audytu, evidence f1/f2/f56, formuł, oraz wcześniejszego WP. Linkuje, nie duplikuje.

## 00 · Nagłówek
- **Moduł:** M13 Inicjatywy · **Pula:** core (kliencki: VTS/Apator/Elkomtech)
- **Ocena:** 54/100 · **Tier:** Alpha górny · **Status:** FAZA 2 (klienci) · **Żywy bloker:** brak P0
- **Właściciel:** Piotr · **Daty:** karta 2026-06-12 · teczka 2026-06-13
- **Karta:** `Harvard/modules/M13-inicjatywy/KARTA_AUDYTU.md` · **Evidence:** `…/evidence/f1_code_truth.md`, `f2_tests_report.md`, `f56_kanon_sec.md` · **Master:** `_MASTER.md`
- **Kod:** `src/components/Initiatives/` · `server/src/routes/pmo/initiatives.routes.ts`

---

## A · INTENCJA / PRODUKT
- **Job-to-be-done:** zamienić wnioski z diagnozy (wywiady/insighty) w zarządzalne inicjatywy transformacyjne — od pomysłu, przez kartę (charter) i bramki, po wdrożenie i rozliczenie wartości.
- **Persony i role:** **Konsultant** (tworzy/edytuje/prowadzi przez bramki), **Klient-właściciel** (przegląda, zatwierdza statusy), **Pilot VTS** (ograniczony — bez create/bulk), **Admin** (pełnia).
- **Zakres v1:** portfolio (4 widoki) · dokument inicjatywy (~30 sekcji) · charter/AI-wizard · generator z insightów (M10) · bramki statusów + zatwierdzenia · ROI · archive · czat Teresy.
- **POZA zakresem v1:** zaawansowane symulacje portfela (what-if), zewnętrzne integracje PM (Jira/Asana), wersjonowanie kart inicjatyw.
- **Metryka wartości:** % inicjatyw przechodzących z „draft" do „w realizacji" z kompletną kartą (≥90 wg `CARD_CONTENT_FORMULA`); czas insight→inicjatywa.

## B · UI/UX — STAN DOCELOWY
- **Layout:** hub z 4 widokami portfela (tabela/Kanban/Timeline/Grid) + preview prawego panelu + pełny dokument inicjatywy (~30 sekcji). Tworzenie z huba: New / Charter / AI Wizard.
- **Stany:** pusty (brak inicjatyw → CTA „utwórz"), ładowanie, błąd, pełny, **V8-OFF → baner degradacji** (nie cicha pustka), brak-uprawnień (pilot → ukryte create/bulk z komunikatem).
- **Interakcje:** „Otwórz" z board-preview (✅ wpięte), Menu 1/2/3, Kanban DnD statusów, bulk Tag/Due/Delete, deep-link `?open=`/`?new=1`. **Cel #14:** menu boczne jako wizualizacja pipeline'u statusów + preview „next-gate" + zarządzanie statusem z wnętrza inicjatywy.
- **Treść/język:** pełne PL/EN przez `t()` (dziś inline `i18n.language==='pl'` w `renderInitiativePreview*`); ton Teresy.
- **Zgodność z systemem:** Visual Standard · tokeny · §27 (Portfolio + listy) · RC-4 sticky thead.
- **Czytelność wnętrza (#16):** sekcje czytelne, AI-fill wg standardu McKinsey (patrz D).

## C · DANE + API + REGUŁY
- **Model danych:** `initiatives` (org-scoped), sekcje w `sections/registry.ts` (~30), powiązania cel↔inicjatywa, decyzja↔inicjatywa; statusy/bramki w `stageGateService.ts`.
- **Kontrakt API:** lista/CRUD `pmo/initiatives.routes.ts` (`verifyToken`+`requireOrgAccess`, scoped ✅); generator z insightów; archive/status z preflightem `initiativeWriteTruth`; V8 Planning (chip, degraduje).
- **Reguły biznesowe:** maszyna statusów + bramki (SSOT: 7 dokumentów `INITIATIVE_*.md` — **do pogodzenia z `stageGateService.ts` i UI**); kto-zatwierdza per bramka; **gating pilota VTS musi być serwerowy** (dziś tylko UI).

## D · AI / TERESA
- **Co generuje:** propozycje inicjatyw z insightów wywiadu (`generate_from_evidence`); uzupełnianie sekcji dokumentu.
- **Formuła (SSOT, linkować nie duplikować):** `docs/initiatives/INITIATIVE_FORMULA.md` (doktryna MECE/Kerzner/Kaplan-Norton/McKinsey) + `docs/standards/CARD_CONTENT_FORMULA.md` (McKinsey-grade treść kart). **Cel #16:** AI-fill każdej sekcji zgodny z formułą (`initiativeGenerationService.ts` / `InitiativeDocumentView.tsx` vs standard).
- **Sterowanie:** generacja z czatu idzie przez kręgosłup (Faza 0); granice persony („nie udawaj wykonania").

## E · INTEGRACJE — mapa połączeń
- **Wejścia ←:** M10 Wywiad (Charter / `generate_from_evidence`, `InterviewHub.tsx:12955`); M01 Czat (karty propozycji).
- **Wyjścia →:** M14 Wdrożenie (realizacja), M15 Rezultaty (rozliczenie wartości), M03 Kalendarz (feed inicjatyw), M16 Finanse (ROI `/roi`→`/api/economics/analyses`).
- **Zdarzenia/deep-linki:** `?open=<id>&mode=doc|drawer`, `?new=1`.
- **Kręgosłup:** generacja z czatu → `UnifiedChatPanel`/deliverables; otwieranie in-context (#10) → klaster nawigacyjny Fazy 0.4.
- **Zależności blokujące:** Faza 0 (kręgosłup) dla generacji z czatu; decyzja UX #10 dla in-context.

## F · EPIKI → STORIES → ZADANIA
**EPIK 1 — Tworzenie inicjatyw z huba żyje** (realizuje B/„create")
- Story 1.1: jako konsultant chcę utworzyć inicjatywę z huba (New/Charter/Wizard), aby nie wchodzić przez deep-link. Akceptacja: *gdy* klikam New/Charter/Wizard *wtedy* otwiera się modal i powstaje trwała inicjatywa. Zadania: Z-01→L-01.
- Story 1.2: jako pilot VTS NIE mogę tworzyć/bulk. Akceptacja: *gdy* pilot woła create/bulk API *wtedy* 403. Zadania: Z-02→L-06.

**EPIK 2 — Kompletny system statusów i bramek (#14)** (realizuje B/„pipeline" + C/reguły)
- Story 2.1: jako konsultant widzę pipeline statusów + „next-gate" i przesuwam inicjatywę z egzekucją uprawnień. Akceptacja: przejście statusu respektuje `stageGateService` + rolę zatwierdzającego. Zadania: Z-03→L-03.

**EPIK 3 — AI-fill wg formuły McKinsey (#16)** (realizuje D)
- Story 3.1: jako konsultant generuję sekcję, która spełnia `CARD_CONTENT_FORMULA` (≥90). Akceptacja: spot-check sekcji vs formuła. Zadania: Z-04→L-04.

**EPIK 4 — Degradacja i odporność** — V8-OFF baner (Z-05→L-05); bulk BE/ukrycie (Z-06→L-02).
**EPIK 5 — Szlif kanonu** — RC-4/§27/i18n/tokeny (Z-07→L-11); E2E S2/S3/S5 do PR-gate.
**EPIK 6 (decyzja) — In-context open (#10)** — po D-01 (patrz H/04).

## G · JAKOŚĆ / WERYFIKACJA
**DoD skwantyfikowane (bramka 6/6):**

| # | Kryterium | Miara dla M13 |
|---|-----------|---------------|
| 1 | Front↔back | New/Charter/Wizard tworzą (lub usunięte); bulk żywe (lub ukryte); 0 martwych CTA; statusy/bramki sterowalne |
| 2 | Bezpieczeństwo | gating pilota serwerowy (403, test); governance org-scope ✅ (`b9f2dee9d2` — **potwierdzić testem cross-org**) |
| 3 | i18n | 0 `i18n.language==='pl'` inline w `InitiativesHub` [liczba: `grep -c` → do policzenia przed startem] |
| 4 | Tokeny | 0 hardkodów vs Visual Standard [do policzenia] |
| 5 | §27 | Portfolio + listy przez FilterableTable; RC-4 sticky thead naprawione |
| 6 | E2E w PR-gate | S2 (deep-link create), S3 (edycja sekcji), S5 (Charter z insightu) zielone na `Londyn` |

**Scenariusze S:** S2 create `?new=1`→trwałość · S3 edycja sekcji · S5 Charter z insightu M10 · S6 Kanban DnD. Dowody → `evidence/f4_*`.
**Bezpieczeństwo:** cross-org governance (test regresji), gating pilota (403), brak IDOR na powiązaniach.
**Wydajność:** paginacja portfela; brak N+1 na ~30 sekcjach dokumentu.
**Telemetria/sukces:** % inicjatyw draft→realizacja z kartą ≥90; czas insight→inicjatywa.

## H · GOVERNANCE / STEROWANIE

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść | → Luka |
|----|--------|------|-------|--------|
| W-01 | Karta audytu | 2026-06-12 | create-from-hub disabled, V8 cicha degradacja, pilot gating UI-only, bulk disabled, RC-4/i18n | L-01,L-02,L-05,L-06,L-11 |
| W-02 | **Uwaga żywa #15** | 2026-06-13 | brak CTA „Otwórz" z board-preview | L-08 ✅ |
| W-03 | **Uwaga żywa #10** | 2026-06-13 | otwarcie inicjatywy zawsze nawiguje do modułu | L-07 (decyzja D-01) |
| W-04 | **Uwaga żywa #14** | 2026-06-13 | kompletny system statusów/bramek/preview/menu | L-03 |
| W-05 | **Uwaga żywa #16** | 2026-06-13 | formuła AI-fill (McKinsey) + czytelność wnętrza | L-04 |
| W-06 | Formuły/standardy | — | `INITIATIVE_FORMULA.md` + `CARD_CONTENT_FORMULA.md` | L-04 |
| W-07 | Feedback prod (VTS pilot) | — | pilot nie może tworzyć/bulk | L-06 |

*(Brak dedykowanego `SPEC_ZADANIE` dla M13 — #14/#16 opisane w UWAGI_TESTY.)*

### 02 · Stan obecny (prawda kodu)
Rdzeń realny: portfolio (4 widoki), dokument (~30 sekcji, `sections/registry.ts`), Analysis (graf + feasibility/completeness + auto-fix), generator z insightów, archive/status (`initiativeWriteTruth`), ROI (`/roi`→`/api/economics/analyses`). **Naprawione w audycie:** cross-org governance IDOR (`b9f2dee9d2`), CRUD 0→5/5 testów (`ea77dc678c`), AI Wizard CTA (`3aec45a21d`), ROI nav (`dc1dd6154d`), `InitiativeConflictsPanel` usunięty (`2dbebfdd74`). **Naprawione 2026-06-13:** CTA „Otwórz" z board-preview (`18ed3e44f7`). Inwentarz: REALNE 12(+2 degradacja) · disabled 2 · ukryte 1 · za-flagą 1 · martwe 1 (`evidence/f1_code_truth.md`).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Warstwa | Faza | Status |
|----|------|---------|--------------------|-------|---------|------|--------|
| L-01 | create-from-hub disabled (New/Charter/Wizard) | W-01 | `InitiativesHub.tsx:1985-1997,1943-1952,1953-1962` | P1 | FE | 2 | otwarta |
| L-02 | bulk Tag/Due/Delete zawsze disabled (brak BE) | W-01 | hub bulk-bar | P3 | FE/BE | 4 | otwarta |
| L-03 | kompletny system statusów/bramek/preview/menu | W-04 | `stageGateService.ts` + `INITIATIVE_*.md` | P1-design | FE/BE | 2 | otwarta |
| L-04 | AI-fill sekcji wg formuły McKinsey | W-05,W-06 | `initiativeGenerationService.ts`, `InitiativeDocumentView.tsx` | P1-design | AI | 2 | otwarta |
| L-05 | cicha degradacja V8 bez banera | W-01 | chip V8 Planning (vs Finance/Results) | P1 | BE/FE | 2 | otwarta |
| L-06 | gating pilota VTS tylko klient | W-01,W-07 | `createInitiative`/bulk/generator (brak gatingu serwerowego) | P1 | security | 2 | otwarta |
| L-07 | in-context open (nawiguje do modułu) | W-03 | `MyWorkHub.tsx:1249,3193` | P1-design | nawigacja | 0.4 | **decyzja D-01** |
| L-08 | brak CTA „Otwórz" z board-preview | W-02 | `InitiativePreviewV3.tsx:399`; fix w `InitiativesHub` footer | P1-TOP | FE | — | **NAPRAWIONA `18ed3e44f7`** |
| L-09 | cross-org governance IDOR | W-01 | — | P0 | security | — | naprawiona `b9f2dee9d2` (R3: potwierdzić testem) |
| L-10 | 0 testów CRUD (stale import) | W-01 | `initiatives-crud.test.ts` | P0-test | testy | — | naprawiona `ea77dc678c` (5/5) |
| L-11 | RC-4 / §27 / i18n inline / tokeny | W-01 | `renderInitiativePreview*` (`i18n.language==='pl'`) | P1/P2 | przekrojowe | 4 | otwarta |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | #10 in-context open inicjatywy w MyWork: jak? | drawer / karta w widoku / dynamiczna zakładka | Piotr | TBD | otwarta |
| D-02 | #14 zakres systemu statusów w v1 | pełny pipeline+egzekucja / minimalny preview | Piotr | TBD | otwarta |
| D-03 | bulk Tag/Due/Delete | dopiąć BE / ukryć przyciski | Piotr | TBD | otwarta |

### 05 · Flagi / rollout
V8 Planning (env, degraduje); pilot VTS (rola — gating dziś UI-only, do serwera); beta — M13 w puli core (otwarty).

### 06 · Ryzyka i założenia
- Ryzyko: SSOT statusów (7 dok. `INITIATIVE_*.md`) rozjechany z `stageGateService.ts` → #14 wymaga najpierw pogodzenia docs↔kod.
- Założenie: governance IDOR realnie zamknięty (`b9f2dee9d2`) — wymaga testu cross-org (R3).
- Uwaga DB: dev `.env` może wskazywać Railway PROD.

### 07 · Log wdrożenia + re-ocena
- 2026-06-13: L-08 „Otwórz" CTA wpięte (`18ed3e44f7`, ten program). Re-ocena D po Fazie 2.
- Audyt 2026-06-11/12: L-09/L-10 naprawione; ocena 54/100.

---

## Bramka teczki: 8/9 (R6 — sesja żywa po Fazie 2 zaplanowana; D-01/D-02/D-03 otwarte — wpisane z właścicielem, czekają na termin)
