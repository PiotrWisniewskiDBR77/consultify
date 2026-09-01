---
doc_id: grafika-sledztwo-odrzucone-20260901
status: canonical
truth_type: investigation
established: 2026-09-01
zrodlo: śledztwo robotnika toru GRAFIKA — kod gałęzi codex/m03-admin-20260824, żywy grep src/+server/src/, git log, zrzuty harness :3020
zrzuty: evidence/grafika/184-sledztwo-odrzucone/ (4 pliki: 2 ekrany × 2 motywy, faza PRZED)
powod: właściciel odrzucił dwa ekrany przy odbiorze i poprosił o rozstrzygnięcie z dowodem, osobno dla każdego
---

# Dwa odrzucone ekrany — śledztwo, nie sprzątanie

Ten dokument sprawdza dwa ekrany, które właściciel odrzucił, zanim ktokolwiek
je skasuje. Metoda: znaleźć plik testowy w `dev-render/`, ustalić jaki
komponent produkcyjny montuje, zmierzyć grep-em czy ten komponent ma żywego
wołacza w `src/`/`server/src/`, sprawdzić czy stoi za nim prawdziwy endpoint,
i sprawdzić czy jest inna droga do tej samej funkcji. Wniosek dla obu
ekranów jest RÓŻNY — jeden trzeba zostawić (żywa mechanika), drugi można
zdjąć (naprawdę martwy).

Uwaga: w repo istnieje już równoległe, głębsze opracowanie tych samych dwóch
przypadków — `docs/program/grafika/ANALIZA_ODRZUCONE_20260901.md` (plus dwa
inne ekrany). Poniższe ustalenia są zmierzone niezależnie tym dyżurem i
**potwierdzają** tamten dokument punkt po punkcie — traktuj oba jako zgodne.

---

## 1. `gen-excel-templates-tab` — „Szablony skoroszytów"

**Słowa właściciela:** *„To samo nie wiem, po co on jest."*

### Co montuje

`dev-render/screens/gen-excel-templates-tab.tsx` montuje realny komponent
produkcyjny `ExceleParametricTemplates`
(`src/components/AIChat/KimiWorkspace/ExceleParametricTemplates.tsx:205`),
z zamockowanym `Api.listWorkbookTemplates`/`buildWorkbookTemplate`. Renderowany
samotnie, bez otoczki huba — stąd na zrzucie duża pusta biel pod trzema
kartami.

### Wołacz w produkcji

Dwa żywe miejsca montowania (zmierzone `grep -rn "<ExceleParametricTemplates" src/`):

1. **`src/components/AIChat/KimiWorkspace/ArtifactModuleHome.tsx:223`** —
   `{lane === 'excele' && <ExceleParametricTemplates isPolish={isPolish} onBuilt={...} />}`.
   Warunek strażnika `useTabeleLifecycleGrid` (linia 119) dotyczy WYŁĄCZNIE
   `lane === 'tabele'`, więc dla `lane === 'excele'` ten mount jest
   **bezwarunkowy**. `ArtifactModuleHome lane="excele"` to `showHome` w
   `ExceleView.tsx:460-461` — czyli **domyślny ekran po wejściu na `/excele`**
   (trasa realna, `routeConfig.ts:40 EXCELE: '/excele'`), bez żadnej flagi.
2. **`src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx:1432`** —
   drugi mount, wewnątrz widoku `workbookTemplates` zakładki „Szablony" huba
   Materiałów. Przycisk-wejście do tego widoku (`showWorkbookTemplates`,
   linia 1517) jest schowany za flagą `ff_workbook_templates`, domyślnie
   **OFF** wszędzie (`src/utils/workbookTemplatesFlag.ts:23` — „Default: OFF").
   Ale sam widok **nie sprawdza tej flagi** przy renderze (linie 1427-1438) —
   trafia się na niego też przez zapis w kreatorze „Nowy szablon → Arkusz"
   (`ReportsAndPresentationsHub.tsx:1626-1639`, `onSaved` ustawia
   `templatesView` na `'workbookTemplates'` bezwarunkowo).

### Czy mechanika żyje

Tak. Backend: `GET /api/workbook/templates` (`server/src/routes/workbook.routes.ts:1117`)
i `POST /api/workbook/templates/:id/build` (`workbook.routes.ts:1143`),
oba wołają realny rejestr `listWorkbookTemplates()`
(`server/src/services/workbook/templates/index.ts:944`). Trzy wzorce to
prawdziwe modele finansowe konsultanta: P&L (3 scenariusze × 3 lata, 5
parametrów), budżet operacyjny (12 miesięcy, 6 parametrów), wycena DCF (6
parametrów) — zweryfikowane na zrzucie.

### Czy jest inne wejście

Tak, dwa: `/excele` (domyślne, bez flagi) i lądowanie po zapisie w kreatorze
szablonów. Jedyne, czego NIE MA, to osobna pozycja w Menu 1/2 prowadząca
wprost do zakładki huba — stąd „zdublowane wejście", nie „martwy ekran".

### Data ostatniej zmiany

`ExceleParametricTemplates.tsx` — 2026-08-08 (`4fdeec5a7a`,
`fix(integration): close shared frontend contracts`).
`ArtifactModuleHome.tsx` — 2026-08-17 (`19d5eccff7`). Aktywnie utrzymywane,
nie relikt.

### Zdanie o zrzucie

Ekran pokazuje nagłówek „Szablony skoroszytów", podtytuł „Wybierz model
parametryczny lub własny szablon i zbuduj gotowy .xlsx", i trzy karty (Model
P&L, Budżet operacyjny, Wycena DCF) — reszta strony jest pustym tłem, bo
dev-render pokazuje komponent w oderwaniu od hero i siatki pozostałych
szablonów, które w prawdziwym `/excele` renderują się pod spodem.

### REKOMENDACJA: zostawić i naprawić (nie zdejmować, nie kasować)

Uzasadnienie w języku właściciela: to nie jest osobny, zbędny ekran — to jest
ten sam „generator modeli finansowych" konsultanta, który dziś domyślnie widzi
każdy, kto otwiera Arkusze, tylko pokazany tutaj bez reszty strony wokół
niego, więc wygląda na sierotę. Zdjęcie SAMEGO komponentu zepsułoby domyślny
widok Arkuszy i końcówkę kreatora szablonów. To, co naprawdę można zdjąć bez
szkody, to zdublowane wejście menu do huba Materiałów (flaga i tak jest
wyłączona) — ale to inna decyzja niż „usuń ekran".

---

## 2. `results-three-pairs` — „Results — 3 pary (KPI/ROI/OKR)"

**Słowa właściciela:** *„To jest jakiś historyczny ekran. Chyba już tak dawno
nie wygląda — mam nadzieję."*

### Co montuje

`dev-render/screens/results-three-pairs.tsx` montuje realny komponent
`ResultsThreePairsView` (`src/components/Results/ResultsThreePairsView.tsx:679`
eksport domyślny), bezstanowy, z danymi wstrzykniętymi przez host (5 KPI, 4
ROI, 2 cele OKR — polskie nazwy, np. „OEE linii pakowania").

### Wołacz w produkcji

`grep -rn "<ResultsThreePairsView" src/` daje jedno trafienie:
**`src/components/Results/ResultsHub.tsx:1978`**, za warunkiem
`threePairsOn` (linia 268: `isResultsFlagEnabled('threePairs')`,
`resultsFeatureFlags.ts:51-55` — domyślnie ON poza publiczną produkcją).

Na pierwszy rzut oka to wygląda na żywy mount. **Ale sam `ResultsHub` nie ma
dziś żadnej trasy.** Zmierzone bezpośrednio:

- `src/routes/AppRoutes.tsx:2874` montuje pod `/results`
  `<ResultsOwnerReviewEntry />`, NIE `<ResultsHub />`.
- `src/components/Results/ResultsOwnerReviewEntry.tsx:12`:
  `return <Navigate to={ROUTES.RESULTS_KPI.ROOT} replace />;` — twardy
  redirect, bez wyjątków.
- Commit `8df1cd413d`, **2026-08-24**, autor Piotr, tytuł
  `fix(results): retire legacy root fallback` — usunął ostatnią ścieżkę,
  którą `ResultsHub` mógł się jeszcze pojawić pod `/results`.
- `grep -rln "import.*ResultsHub" src/` daje dziś tylko dwa pliki:
  `src/components/Results/index.ts` (reeksport z barrela, nikt go stamtąd
  nie bierze do renderu) i `src/components/Results/__tests__/ResultsHub.smoke.test.tsx`
  (test). Zero produkcyjnych wołaczy poza samym plikiem.

To ten sam kształt pomyłki, przed którym ostrzega ten projekt („wołacz istnieje
≠ renderuje się") — `ResultsHub.tsx` ma świeże commity (do 19.08, np.
`979c14e5f8 feat(results): retire canonical-backed legacy KPI writers`) i
prawidłowo montuje `ResultsThreePairsView`, ale routing, który by go
kiedykolwiek wyświetlił użytkownikowi, został wycięty 24.08 — pięć dni
później niż ostatnia edycja pliku. Sam plik żyje w repo, ekran nie żyje w
produkcie.

### Czy mechanika żyje

Dane w komponencie są czysto props-driven (zero fetchu wewnątrz), więc „silnik"
za tym ekranem to silniki KPI/ROI/OKR jako takie — a te żyją, tylko czytane
są dziś przez INNY, aktualny zestaw ekranów (patrz niżej), nie przez ten
komponent.

### Czy jest inne wejście

Tak — i to jest właśnie dzisiejszy odpowiednik. Realne trasy modułu Wyniki:
`ROUTES.RESULTS_KPI.ROOT` = `/results/kpi` (`AppRoutes.tsx:2889`),
`ROUTES.RESULTS_ROI.ROOT` = `/results/roi` (`:2999`),
`ROUTES.RESULTS_OKR.ROOT` = `/results/okr` (`:3081`) — osobne rejestry KPI/
ROI/OKR (tzw. Results vNext), które użytkownik widzi dziś po kliknięciu
„Wyniki" w menu bocznym. „Trzy pary" nie jest tym, co zastąpiło stary hub —
to JEST stary hub, a te trzy rejestry go zastąpiły.

### Data ostatniej zmiany

`ResultsThreePairsView.tsx` — 2026-08-04/2026-08-08 (ostatnia treściowa
zmiana `d0b2b56b8f feat(results): expose KPI ROI and OKR table navigation`).
Trasa, która go pokazywała, wycięta 2026-08-24 — czternaście dni po ostatniej
zmianie treści i tydzień przed odbiorem. Podejrzenie właściciela („dawno tak
nie wygląda") jest trafne, tylko z innego powodu niż wygląd: ekran nie jest
brzydki, jest nieosiągalny.

### Zdanie o zrzucie

Zrzut jest czysty i zgodny z kanonem — nagłówek „Rezultaty", podtytuł
„Niefinansowe rezultaty inicjatyw w trzech parach: obietnica ↔ realizacja",
trzy pigułki (KPI 5 / ROI 4 / OKR 2), karta podsumowania („5 KPI, w celu 2/5,
średnia realizacja celu 94%") i prawdziwa `StandardTable` z semantycznymi
kolorami i uczciwym „Brak danych" zamiast fałszywego zera — wygląda dobrze,
ale to nieistotne, skoro nikt tam nie trafia.

### REKOMENDACJA: zdjąć

Uzasadnienie w języku właściciela: masz rację — to zdjęcie z albumu, nie
ekran produktu. Droga, która kiedyś prowadziła tu z menu „Wyniki", trzy
tygodnie temu została przekierowana na trzy osobne, nowsze tablice (KPI/ROI/
OKR), które konsultant widzi dziś zamiast tego ekranu. Zdjęcie tego ekranu z
odbioru i z dev-render nic nie zepsuje, bo nikt do niego dziś nie trafia —
jedyne ryzyko to komponenty, które `ResultsHub` montował TYLKO dla siebie
(np. szuflada historii KPI z kartą naprawczą), a które mogą być gotowym, ale
nigdzie niepodłączonym kawałkiem funkcji — to osobna decyzja, nie objęta tym
odbiorem.

---

## Skrót dla nadzorcy

| Ekran | Rekomendacja | Jednozdaniowy dowód |
|---|---|---|
| `gen-excel-templates-tab` | zostawić i naprawić | Ten sam komponent jest dziś domyślnym, bezwarunkowym widokiem po wejściu na `/excele` (`ExceleView.tsx:460-461` → `ArtifactModuleHome.tsx:223`) — zdjęcie skasowałoby żywy generator modeli finansowych (P&L/budżet/DCF), nie pusty ekran. |
| `results-three-pairs` | zdjąć | `ResultsHub`, jedyny wołacz tego komponentu, nie ma żadnej trasy od commitu `8df1cd413d` (24.08, „retire legacy root fallback") — `/results` przekierowuje na `/results/kpi`, więc ekran istnieje w repo, ale nie w produkcie. |
