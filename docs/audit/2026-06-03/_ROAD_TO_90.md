# Consultify — Road to 90/100 (kompletny, scalony plan)

**Scala:** re‑audyt v2 per‑moduł (`MODULE_NN_*.md`, 2026‑06‑03) + 38 screenów właściciela (runtime) + `_NEXT_ROUND_REPAIR_PLAN` + `TABLE_GRAPHICS_ROOTCAUSE` + flows/engineering health.
**Cel:** każdy moduł w zakresie ≥ **90/100**, app bez wpadek runtime, spójna grafika (tabele!), brak bugów danych. Śr. teraz ~73 → cel ≥90.

## Definicja „90/100" (per moduł)
Ładuje się zawsze (zero 429/crash/spinner‑forever) · tabele wyrównane (kanoniczna tabela) · zero bugów danych w widoku (encoding/UUID/puste panele) · wszystkie handoffy wpięte (brak 404/dead‑end) · empty≠error rozróżnione · spójne tokeny (crimson/navy, shell ModuleHub) · smoke‑test realnie w CI.

---

## A. PRZEKROJOWE (naprawiają wiele modułów naraz — robić NAJPIERW)

| ID | Problem | Dotyka | Zadanie | Prio |
|---|---|---|---|---|
| X‑RT1 | Burza 429 (retry‑on‑429 = mój regres + apiAuthRateLimiter 2000/15min + StrictMode×2 + polling + N+1) | Notebook, Inbox, Tasks, Meeting, Interview‑Init, Ideas‑map | `fetchWithRetry`: nie ponawiać na 429; scope limiter per‑user; dedup StrictMode; zbatchować startowy storm; fix inbox N+1 (`my-work.routes.ts:1398`); zdjąć dev‑flag | **P0** |
| X‑RT2 | Auth‑loop‑guard/circuit‑breaker false‑trip blokuje całe moduły | Tools Library (+?) | poprawić próg/reset; jawny stan + auto‑recovery; nie ubijać całego modułu | **P0** |
| X‑RT3 | Crash runtime „Coś poszło nie tak" | Execution>Implementation | znaleźć wyjątek; error‑boundary z retry; fix przyczyny | **P0** |
| X‑RT4 | Double‑fire fetchy (×2 „Failed to load") | Meeting (+?) | StrictMode‑safe dedup/abort | P1 |
| X‑TBL | Grafika tabel — 8 przyczyn (desync sticky/scroll, overflow‑hidden, 4px select, brak kanonicznej tabeli/230 plików) | ~wszystkie listy | Faza1: usuń inner overflow + fix select; Faza2: usuń overflow‑hidden wrapperów; Faza3: kanoniczna tabela + migracja | **P0/P1** |
| X‑DB1 | ~138 osieroconych tabel nie powstaje na świeżym PG | deploy całości | walidacja `DRAFT_schema_bootstrap_consolidation.sql` na staging → aktywacja | **P0(deploy)** |
| X‑DB2 | `collab_sessions.duration_seconds` brak kolumny | Ideas/Whiteboard collab | migracja | P1 |
| X‑DB3 | Dialekt SQL: NOW() 477×, LATERAL 12× | testy/SQLite path | portability sweep | P2 |
| X‑UI1 | Kanon kolorów/shell: primary 3846× vs crimson 79×; slate 45,7k; 8× SplitLayout; prymitywy stanów 2,3% | wszystkie | flip primary→crimson (nav+nagłówki), slate→navy sweep, SplitLayout→ModuleHub, użyć Loading/Empty/Error | P1 (RAZEM) |
| X‑UI2 | z‑index overlay (Chat nad Manager), tooltipy nie znikają, sidebar historii ucięty | Chat/Manager/Inbox | backdrop/portal/z‑layer; dismiss tooltip; szerokość sidebara | P1 |
| X‑ENG1 | CI nie uruchamia testów komponentów (glob) | jakość całości | naprawić include vitest | P1 |
| X‑ENG2 | server `tsc --noCheck` (4 543 błędy) | bezpieczeństwo typów | osobny program redukcji | P2 |

---

## B. PER‑MODUŁ — stan → 90 (problemy funkcjonalne + zadania)

### 01 Czat/Teresa — 84 → 90
- Canvas używa `window.location.assign('/presentations')` (twardy reload zamiast SPA‑nav) → zmienić na navigate.
- Voice live wymaga `GEMINI_LIVE_API_KEY` (akcja właściciela).
- Sidebar historii: szerokość/truncation (X‑UI2).
**Do 90:** SPA‑nav handoff, voice key, polish sidebara.

### 02 Moja Praca — 68 → 90 (najwięcej runtime)
- Notebook/Inbox/Tasks „Failed to load" = X‑RT1 (po fixie wrócą — RE‑VERIFY).
- Radar: panel detalu sygnału pusty → zasilić.
- Ideas: tytuły `&amp;quot;` (double‑encoding) → escape raz; Recommendation map spinner‑forever → timeout/error.
- Process Flow: upewnić migracja na prod; facilitation routes kompletne.
- Perf N+1 (inbox) → Promise.all.
**Do 90:** X‑RT1, Radar panel, Ideas encoding+map, perf.

### 03 Wywiad — 84 → 90
- Interview>Initiatives „degraded" = X‑RT1/odrębny fetch → re‑verify + dedykowany error/empty.
- Bramka jakości + reszta akcji „coming soon" do końca.
**Do 90:** re‑verify init tab, domknąć akcje.

### 04 Narzędzia — 65 → 90 (jeden z najniższych)
- `ToolWizardView` martwy (niereferowany) → zamontować lub usunąć.
- Megatrend seed w `migrations/` nie w `migrations-v2/` (prod) → przenieść; isComingSoon upsert pomijany na istniejących DB → data‑migracja.
- ADMA/CMMI/LEAN tworzą sesje bez gating → walidacja `framework_type`.
- DoD gap‑gates tylko 3/14 ship‑tools → dodać do reszty.
**Do 90:** sporo — priorytet po runtime.

### 05 Inicjatywy — 74 → 90
- GapAnalysisDashboard POST `/api/initiatives/generate-from-assessments` 404 (orphan) → wpiąć route lub usunąć komponent.
- Generator stub (bez LLM) → podłączyć generowanie.
**Do 90:** route generatora + LLM.

### 06 Realizacja — 71 → 90
- **Crash Implementation (X‑RT3)** → P0.
- NOW() dialekt (rollout); Execution→Results brak CTA (handoff).
**Do 90:** crash fix, handoff CTA, dialekt.

### 07 Rezultaty — 72 → 90
- LATERAL dialekt (benefits.routes); Results→Outputs brak CTA; bucket „in realization" pusty (mapowanie lifecycle); legacy kpi‑reports route unguarded.
**Do 90:** dialekt, CTA, lifecycle mapping, guard.

### 08 Finanse/billing — 59 → 90 (NAJNIŻSZY; decyzja zakresu)
- 35 endpointów billing 503 (zabramkowane); Stripe wg D8 (odłożony).
- **Decyzja:** czy 08 ma iść do 90 teraz (duży nakład Stripe) czy zostać „uczciwe 59" do fazy sprzedażowej? Rekomendacja: zostaw do D8, podnoś po decyzji o płatnościach.

### 08b Model finansowy — 74 → 90
- Export gubi `relatedInitiativeIds` (`FinancialModelWorkspace.tsx:711`) → przekazać.
- Finance→Initiative 404 — JUŻ fix (`?open=`).
**Do 90:** export context + drobne.

### 09 Outputs — 78 → 90
- Documents Library: surowe UUID + nazwy „Executive presentation draft" (brak join/lookup) → rozwiązać nazwy + źródło.
- approval‑gate done.
**Do 90:** fix listy Documents/Outputs (UUID/nazwy).

### 10 Dokumenty (Doc Studio) — 71 → 90
- LLM prose default OFF (placeholdery) → włączyć z kluczem; persystencja/route — done.
**Do 90:** LLM prose on (klucz), PDF figury.

### 11 Tabele (Table Studio) — 77 → 90
- Grafika tabel (X‑TBL) dotyczy też tu; MELS off; konwersja artefaktu flag off.
**Do 90:** X‑TBL + włączyć MELS/konwersję gdy UI gotowe.

### 12 Prezentacje — 79 → 90
- Collab stripped (multiplayer fast‑follow); reszta OK.
**Do 90:** drobny polish; multiplayer to fast‑follow (nie do 90).

### 13 Meeting — 72 → 90
- „Failed to load meetings" ×2 = X‑RT1 + double‑fire (X‑RT4) → re‑verify + dedup; transkrypcja/Teresa‑na‑spotkaniu = „później" (nie do 90 v1).
**Do 90:** runtime fix; CRUD już jest.

### 16 Organizacja — 79 → 90
- Invitation email stub (brak SMTP); double context widget (2 fetche).
**Do 90:** SMTP/wysyłka zaproszeń, dedup widgetu.

### 17 Admin — 67 → 90
- Role‑change/remove idą przez org‑route (omijają adminP32 + audyt) → przekierować przez adminP32; per‑org email (hardcode); crimson drift na AI/Security; backup 503.
**Do 90:** audyt role‑change, per‑org email, tokeny, backup.

### 18 Ustawienia — 76 → 90
- Usuwanie konta: UI woła nie‑gatowany `/api/gdpr/deletion-request` (brak weryfikacji hasła), a gatowany endpoint nie jest wołany; `deleteAccount` to stub → spiąć UI z poprawnym, hasło‑gatowanym endpointem.
- AI‑settings: zamontowany jest `ai/ai-settings.routes` (hard 503), nie root z fallbackiem → przełączyć mount lub przenieść fallback.
- Audit log: braki (profile/webhooks/signatures).
**Do 90:** deletion security, AI‑settings mount, audit log.

### 19 Partner — 69 → 90
- 12 endpointów stub (ukryte) — do implementacji wg priorytetu kanału; `@ts-nocheck` na partners.routes (serwer); model prowizyjny.
**Do 90:** odsłonić kolejne funkcje partnera wg decyzji kanału (część może zostać fast‑follow).

---

## C. SEKWENCJA do 90
1. **Runtime (A: X‑RT1/2/3/4)** — odblokowuje 02/03/06/13 + Tools Library. *(1–2 dni)*
2. **Tabele (X‑TBL Faza1‑2) + bugi danych (Ideas encoding, Documents UUID, Radar panel)** — widoczny skok. *(2–3 dni)*
3. **Integralność danych (X‑DB1/2)** — przed deployem. *(0,5–1 dzień + walidacja RAZEM)*
4. **Per‑moduł do 90: 04, 05, 07, 17, 18, 09, 08b, 16** — równolegle per owner. *(gros pracy)*
5. **UI/UX (X‑UI1/2) — sesja RAZEM** + X‑TBL Faza3 + CI glob (X‑ENG1).
6. **Decyzje zakresu:** 08 Finanse (Stripe?), 19 Partner (zakres kanału), 13 transkrypcja, 12 multiplayer — co wchodzi do 90 v1 vs fast‑follow.

## D. Co podnosi średnią najszybciej
Runtime (A) + tabele (X‑TBL) + 4 najniższe moduły (08 wyłączyć z 90 decyzją; 04→90, 17→90, 18→90, 19 częściowo) → realnie śr. 73 → ~88‑90. Reszta to polish + decyzje zakresu.
