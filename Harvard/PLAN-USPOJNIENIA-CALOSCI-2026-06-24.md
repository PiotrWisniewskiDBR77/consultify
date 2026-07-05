# PLAN PEŁNEGO USPÓJNIENIA — spięcie całości projektu

> Plan uspójnienia pracy pomiędzy wszystkimi modułami, stage'ami i analizą. SSOT programu „spięcia całości". Stan: 2026-06-24, po domknięciu M13/M14 i [audycie inicjatyw](AUDYT-INICJATYWY-2026-06-24.md). Buduje na istniejących wątkach: System Unification (Faza 1 prelude), Initiative Chain (M13→M14→M15→M16), oraz na zweryfikowanym kręgosłupie `initiativeStatuses.ts`.

---

## 0. TEZA — co znaczy „spiąć całość"

Aplikacja ma **jeden naturalny kręgosłup, który już dziś łączy moduły, ale połączenia są niespójne.** Kręgosłupem jest **inicjatywa i jej cykl życia**. Potwierdzone w kodzie (`initiativeStatuses.ts`):

```
ANALIZA            INICJATYWA (planowanie)        WYKONANIE        REZULTATY   FINANSE
Tools/Assessment → Initiatives                  → Execution      → Benefits  → Finance
DRAFT              REVIEW→…→SCHEDULED              SCHEDULED→…→DONE  TRACKING
  └── interview/insight/financial-analysis        (M13)            (M14)       (M15)      (M16)
```

Jeden obiekt (inicjatywa) przepływa przez wszystkie moduły; **status = kontrakt, który decyduje, który moduł nią operuje** (`getStatusesForModule()` filtruje API per moduł). To znaczy:

> **Uspójnić projekt = uczynić ten kręgosłup JEDYNYM backbonem, do którego każdy moduł podłącza się jako czysty producent/konsument, z jednym źródłem prawdy i zweryfikowanym handoffem na każdej granicy stage'a.**

Audyt pokazał, że dziś tak NIE jest: ~23 ścieżki tworzenia, ~60 kolumn z duplikatami, ręczne/rozjechane handoffy, jakość nieegzekwowana, stan per-moduł rozsynchronizowany. Plan poniżej to naprawia w 5 osiach / 5 falach.

---

## 1. STAN OBECNY — gdzie są szwy i co pęka

| Granica (stage boundary) | Dziś | Problem |
|---|---|---|
| **Analiza → Inicjatywa** | assessment/interview/financial/tool → INSERT inicjatywy | ~23 lejki, niespójny status/pola, lineage niepełny, jakość niewymuszona |
| **Inicjatywa → Wykonanie** | M14 czyta inicjatywy M13 na żywo (status SCHEDULED+) | ✅ działa (read-live), ale brak jawnego „kontraktu gotowości do wykonania" |
| **Wykonanie → Rezultaty** | benefits handoff M14→M15 (zbudowany) | ✅ serwis+UI gotowe, ale 1 z wielu handoffów — reszta nieujednolicona |
| **Rezultaty → Finanse** | results/economics linkują inicjatywę | rozjazd: rollout_* project-scoped, finanse osobny model |
| **Każdy moduł ↔ stan FE** | każdy moduł fetch'uje osobno | brak współdzielonej świeżości → stale data, rozjechane kopie |

**Wspólny mianownik wszystkich pęknięć:** brak JEDNEGO kontraktu na (a) tworzenie, (b) model danych, (c) handoff między stage'ami, (d) jakość, (e) stan FE.

---

## 2. PIĘĆ OSI USPÓJNIENIA

### OŚ A — Jeden lejek tworzenia + kanoniczny obiekt
Wszystkie ścieżki tworzenia → wspólny `createInitiativeService` (jeden kontrakt pól, jedna walidacja, jeden status startowy `DRAFT`, lineage obowiązkowy). Koniec z 23 surowymi `INSERT`.

### OŚ B — Cykl życia jako jedyny kręgosłup stage'ów
Status inicjatywy = jedyny kontrakt międzymodułowy. Każdy moduł czyta `getStatusesForModule()` (zero hardkodowanych filtrów). Każda granica stage'a = **jawny, zweryfikowany handoff** (event + kontrakt gotowości), nie ręczna kopia.

### OŚ C — Jedno źródło prawdy danych
Jeden rekord inicjatywy, udokumentowany SoT per domena (ROI, timeline, budżet, stage), deduplikacja kolumn, CHECK na statusie. Moduły **referują**, nie kopiują.

### OŚ D — Jakość wzdłuż całej rury
Validatory formuły zakodowane i uruchamiane na wejściu; generatory AI wymuszają CARD_CONTENT_FORMULA; MECE-check portfela. To, co płynie kręgosłupem, jest zawsze dobrze uformowane.

### OŚ E — Jeden stan, jedna świeżość, jedna nawigacja
Współdzielona warstwa danych (klucze React-Query + inwalidacja), brak rozjechanych kopii per-moduł, spójna nawigacja i UI, usunięcie martwych duplikatów.

---

## 3. PROGRAM — 5 FAL (każda wdrażalna i weryfikowalna osobno)

> Każda fala: budowana za flagą gdzie ryzykowna, zweryfikowana na żywym kokpicie v8 (lokalny FE → staging-trolley, org a3e05d4a) + Playwright, deploy na demo. Prod nietknięty bez osobnej zgody.

### 🌊 FALA 1 — Fundament prawdy (OŚ A + C-core) — *najwyższy priorytet*
**Cel:** jedno wejście, jeden status, jeden kontrakt.
1. `createInitiativeService` — wspólny serwis tworzenia; przekierować ~23 ścieżki INSERT na niego (etapami: najpierw routy `economics`/`finance`/`my-work`/`report-*`, potem serwisy).
2. Normalizacja statusu startowego → `DRAFT` wszędzie; usnąć `step3`/`PENDING_REVIEW` z tworzenia; **CHECK constraint** na `status` po backfillu danych.
3. Ujednolicić `name`/`title` (jedna kolumna kanoniczna + backfill).
4. `aiActionExecutor` — org_id obowiązkowy.
**Odbiór:** wszystkie testy integ. tworzenia zielone; każdy nowy rekord = DRAFT + komplet pól kontraktu + lineage; CHECK aktywny.

### 🌊 FALA 2 — Handoffy stage'ów jako kontrakty (OŚ B)
**Cel:** każda granica między modułami = jawny, zweryfikowany przepływ.
1. **Analiza→Inicjatywa:** wszystkie generatory (assessment/interview/tool/financial) przez Falę-1 lejek, z lineage = źródło analizy. Jeden kształt „kandydata".
2. **Inicjatywa→Wykonanie:** jawny kontrakt „ready-for-execution" (bramki M13 już to robią — sformalizować jako jeden serwis `stageHandoff`).
3. **Wykonanie→Rezultaty:** ujednolicić benefits-handoff (zbudowany M14) jako wzorzec; spiąć closure→tracking.
4. **Rezultaty→Finanse:** zlinkować rollout/benefits z modelem finansowym (M16) po initiative_id (nie project-scoped osobno).
5. Każdy moduł czyta `getStatusesForModule()` — usunąć lokalne hardkody statusów.
**Odbiór:** prześledzenie jednej inicjatywy end-to-end przez wszystkie 5 granic; każdy handoff emituje event + ma test.

### 🌊 FALA 3 — Jakość wzdłuż rury (OŚ D)
**Cel:** to co płynie kręgosłupem jest zawsze kompletne.
1. Zakodować brakujące validatory §B3 (kpi_baseline_target, raid_mix, scope_out_mece, *_count, milestones_count) i uruchamiać na CREATE.
2. Wstrzyknąć CARD_CONTENT_FORMULA §A3 do promptów generatorów (assessment/tool/propose); ujednolicić na `AIPipeline`+timeout+fallback.
3. Backend MECE-check portfela (`/initiatives/validate-portfolio-mece`) używany przy generacji.
4. Reviewer §B4 domyślnie włączony.
**Odbiór:** generowana inicjatywa ma tezę+KPI baseline→target+RAID lub jawne ostrzeżenie; MECE-overlapy wykrywane.

### 🌊 FALA 4 — Jeden stan i nawigacja (OŚ E)
**Cel:** koniec stale-data i rozjechanych kopii.
1. Współdzielona warstwa danych inicjatyw (klucze React-Query) + inwalidacja po każdej mutacji; Initiatives-hub i Execution czytają to samo.
2. Ujednolicić źródło zależności Gantta (jedno: `task_dependencies`); oba widoki czytają to samo.
3. Usunąć martwy kod: `InitiativeDetailModal` (root, 0 importów), orphan `routes/initiatives.routes.ts`, pliki-śmieci `* 2.ts`.
4. Spójna nawigacja deep-link do inicjatywy (jeden wzorzec route/modal).
**Odbiór:** edycja w jednym module odbija się natychmiast w innym; jeden Gantt-truth; build bez martwych duplikatów.

### 🌊 FALA 5 — Obserwowalność łańcucha (OŚ B + C, korona)
**Cel:** prześledzić każdy rezultat wstecz do źródłowej analizy i zmierzyć cały lejek.
1. End-to-end lineage view: insight/analiza → inicjatywa → wykonanie → rezultat → finanse (po istniejącym link-graph + source_type/id).
2. Funnel-analityka: ile analiz→inicjatyw→wdrożeń→zrealizowanych korzyści (konwersja stage'ów).
3. Udokumentowany SoT per domena danych (deduplikacja reszty kolumn) — domknięcie OŚ C.
**Odbiór:** dla dowolnej zrealizowanej korzyści widać pełen łańcuch pochodzenia; dashboard konwersji lejka.

---

## 4. SEKWENCJA I UZASADNIENIE

- **Fala 1 najpierw** — bo jeden lejek + jeden status to fundament, na którym stoją wszystkie pozostałe (handoffy, jakość, stan). Największa redukcja ryzyka integralności.
- **Fala 2 przed 3** — najpierw spiąć przepływ (żeby było co walidować end-to-end), potem dokręcać jakość wzdłuż niego.
- **Fala 4 równolegle możliwa** — higiena stanu FE jest w dużej mierze niezależna; można robić w tle.
- **Fala 5 na końcu** — obserwowalność ma sens, gdy rura jest spójna (1–3) i świeża (4).

**Zależności od decyzji/danych:** Fala 1.2 (CHECK constraint) wymaga backfillu danych prod/staging — robić ostrożnie, najpierw staging. Fala 5 wymaga, by lineage z Fali 1–2 był kompletny.

## 5. JAK WERYFIKUJEMY (sprawdzony loop)
Każda fala: kod + testy (vitest unit/integ) → tsc 0 → weryfikacja na żywym kokpicie v8 (lokalny FE→staging-trolley, screenshot) → Playwright E2E → deploy demo. Wzorzec udowodniony na M14 (8 powierzchni UI, Playwright 8/8). Flagi `default OFF` dla zmian ryzykownych. **Prod (centerbeam) nietknięty bez osobnej zgody.**

## 6. CZEGO PLAN NIE OBEJMUJE (świadomie)
- Przepisania modułów od zera — uspójniamy istniejące, nie budujemy na nowo.
- Zmian w prod-DB bez osobnego okna (backfill/CHECK = osobny, ostrożny krok na staging najpierw).
- Demo-login 500 (osobny blocker infra — baza pgvector demo, do naprawy niezależnie).

---

## 7. PIERWSZY KROK
Rekomendacja: zacząć od **Fali 1, krok 1–2** (`createInitiativeService` + normalizacja statusu) — to jednym ruchem spina integralność wejścia, daje kontrakt dla handoffów (Fala 2) i jest warunkiem CHECK-constraintu. Budowalne i weryfikowalne w izolacji, niskie ryzyko (additive + flag dla przekierowania ścieżek).
