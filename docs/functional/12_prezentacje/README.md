---
doc_id: prezentacje-functional-contract
title: Prezentacje (Gamma) — kontrakt funkcjonalny
menu_item: materials
subsystem: prezentacje (Materials → MAT-S-04)
truth_type: mixed (runtime + plan)
scope: generowanie i redagowanie prezentacji PPTX/PDF pod wzorzec gamma.app
status: partial — trzy filary w trzech różnych stanach, żaden nie jest w pełni domknięty
owner: piotr
last_reviewed: 2026-09-01
runtime_commit: 93c450c19d70e3f1d74f848f766a8507556537ec
---

# Prezentacje — czy dowozimy marzenie o Gammie

**To NIE jest osobna pozycja menu.** Prezentacje to podsystem `Materials` (pozycja
menu 10) — `docs/FUNCTIONAL_DOCUMENTATION.md`, wiersz `| 10 | Materials |`. Ten
dokument opisuje wyłącznie mechanikę generowania/redagowania decków. Widok listy
i biblioteki materiałów ma własny kontrakt w `docs/functional/10_materials/README.md`.

## Po co ten dokument istnieje

Właściciel prowadzi swoje realne doradztwo w Gammie: **367 prezentacji na jednym
motywie, sześć motywów na linie biznesowe, realni klienci**. Jego słowa, potwierdzone
1.09.2026:

> **„Gamma ma formę bez wiedzy. Consultify ma wiedzę bez formy."**

Ból: treść mieszka w Consultify, artefakt powstaje w Gammie, więc właściciel
**przepisuje ręcznie to, co system już wie**. Zbudowaliśmy pod to dziesięć dyżurów
(dyżury 226–232 fali 18, plus dyżur 186 treści i rekonesans G0–G3). **Nie było
dokumentu, który mówi właścicielowi, co z tego naprawdę działa.** To jest ten
dokument. Szczegółowy pomiar plik:linia jest w `AS_IS_2026-09-01.md` w tym samym
katalogu; tu jest synteza wg sposobu, w jaki właściciel o tym myśli.

## Trzy filary — słowami właściciela

Zapytany, co konkretnie zachwyca ludzi w Gammie, właściciel wskazał trzy rzeczy
(1.09.2026, źródło: `docs/program/funkcje/GAMMA_00_PRZEWODNIK.md:29-39`):

1. **Obrazy w wybranym stylu** — sześć pozycji do wyboru, obraz pasuje do treści.
2. **Układ, kolor, kształty** — z jego zastrzeżeniem: *„formatów układów nie mają
   dużo i często się powtarzają, ale pierwsze wrażenie jest super"*.
3. **Treść pisana ZANIM ruszy produkcja slajdów** — *„prezentacja wie, co
   opowiada"* — plus **agent, któremu mówisz co zmienić, i to się zmienia**.

**To jest miara tego dokumentu.** Nie „czy wygląda jak Gamma", tylko „czy te trzy
filary działają u nas — i jeśli nie, dlaczego dokładnie nie".

Dla każdego filaru rozdzielam cztery różne rzeczy, bo mylenie ich kosztowało ten
program tygodnie: **działa** (dociera do użytkownika bez włączania flagi) ·
**zbudowane, ale wyłączone** (kod istnieje, dowód mutacyjny istnieje, flaga
domyślnie OFF) · **nie istnieje** (nikt tego nie napisał) · **niemożliwe**
(twardy sufit narzędzia, nie brak czasu).

---

## ★ Twardy sufit biblioteki — zanim cokolwiek innego

Bibliotekę, którą składamy PPTX, mierzył dyżur G-0 w zainstalowanej paczce
`pptxgenjs 4.0.1` (`server/package.json:62`, `package.json:400` — zakres `^4.0.1`,
zainstalowana wersja zmierzona przez G-0 to 4.0.1). Wynik
(`docs/program/funkcje/GAMMA_G0_POMIAR.md:52-67`):

| cecha | stan |
| --- | --- |
| **gradienty** | **ZERO wystąpień** w całej paczce (typy + wszystkie bundle) — NIEMOŻLIWE bez symulacji nakładaniem kształtów |
| **osadzanie czcionek** | **ZERO wystąpień** — NIEMOŻLIWE, biblioteka tego nie oferuje |
| przezroczystość | obecna, już używana |

**Gradientowego tła i własnego kroju pisma tą drogą nie dowieziemy.** To nie jest
opinia o trudności — to jest brak funkcji w bibliotece. A gradient i krój to
**dwa z trzech składników „pierwszego wrażenia"**, o którym mówi właściciel przy
filarze 2. Ten pomiar sprostował wcześniejsze, błędne założenie jednego z
robotników, że gradienty są wspierane „z pamięci" — sprawdzenie w realnej paczce
tego nie potwierdziło.

**Metoda pomiaru w tym dokumencie:** node_modules nie jest częścią tego worktree
(zależności nie były instalowane), więc powyższa liczba jest cytatem z pomiaru
G-0 (2026-09-01, zainstalowana paczka), nie ponownym niezależnym pomiarem. Traktuj
jako zmierzone raz, źródło podane.

---

## Filar 1 — Obrazy w wybranym stylu

**Stan: przewód gotowy, jakość nieoceniona.**

### Działa
- Nic z tego filaru nie działa **bez włączenia flagi** dla użytkownika końcowego.

### Zbudowane, ale wyłączone
- **Sześć presetów stylu obrazu** istnieje w kodzie, dokładnie tyle, ile
  właściciel zapamiętał: `corporate_photography`, `abstract_geometric`,
  `flat_illustration`, `data_focused`, `industry_realistic`, `minimal_no_images`
  (`src/components/Presentations/wizard/types.ts:96`). Komponent wyboru
  `ImageStyleSelector.tsx` **jest renderowany** — wołany w
  `src/components/Presentations/wizard/SetupStep.tsx:291`, a `SetupStep` jest
  renderowany w `src/components/Presentations/PresentationWizard.tsx:300`
  (`docs/program/funkcje/GAMMA_ZNALEZISKO_SZESC_STYLOW.md:36-49`). Użytkownik
  ten wybór **widzi i może go dokonać**.
- Dyżur 228 (`codex/day228-gamma-stylobrazu-20260901`, commit `4f5094a059`)
  poprowadził wybraną wartość aż do polecenia dla modelu: jeden punkt dyspozycji
  `deckVisualsService.ts::generateImageVisual` (okolice `:599` na markerze dyżuru)
  doklejia appendix stylu w kolejności „motyw pierwszy, preset drugi" i przekazuje
  finalny prompt do OpenAI, Gemini i Replicate. **Dowód mutacyjny**: usunięcie
  appendixu z promptu produkcyjnego dało 3 FAIL / 9 PASS (każda gałąź dostawcy
  dostała gołe `BASE PROMPT`), przywrócenie dało 12/12 PASS
  (`CODEX_DAY228_GAMMA_STYLOBRAZU_REPORT.md`, sekcja „Dowód mutacyjny RED → GREEN").
  Cała ścieżka jest za jedną flagą **`ENABLE_PRESENTATION_IMAGE_STYLE`, domyślnie
  `false`** (`server/src/config/FeatureFlags.ts:53`). Przy OFF prompt zostaje
  bajt w bajt bez zmian.
- **Dwie bramki jakości obrazu są realne, nie deklaratywne**: OCR
  (`tesseract.js`, próg >2 znaki po `trim()`) odrzuca obraz z wykrytym tekstem;
  detektor twarzy domyślnie odrzuca twarz dla każdego stylu. Obie zweryfikowane
  testami z realnym `tesseract.js` na deterministycznym PNG (nie atrapą OCR).
  Maksymalnie trzy próby generacji, potem istniejący fallback do zdjęć
  stockowych, a po jego braku jawne ostrzeżenie zamiast cichej pustki.
- **Nikt nie porównał wyników z gammowymi.** Bramki działają, ale jakość
  finalnego obrazu wobec wzorca Gammy jest **nieoceniona** — nie ma rubryki ani
  porównania.

### Nie istnieje
- **Duotone / dopasowanie koloru po wygenerowaniu obrazu** (mapowanie
  luminancji na paletę marki) — to jest **rekomendacja inżynierska** ze
  specyfikacji G-1, nie odtworzony mechanizm Gammy i nie zbudowany u nas kod
  (`docs/program/funkcje/GAMMA_G1_OBRAZY.md`, §2.3).
- **Style prompt na poziomie motywu** doklejany do KAŻDEGO obrazu w organizacji
  (mechanizm, którego Gamma naprawdę używa — patrz niżej) — u nas nie istnieje;
  mamy tylko styl per prezentacja z sześciu presetów.
- **Referencje obrazowe (1–4 zdjęcia wzorcowe na styl)** — nie istnieje.
- **Szósty, dodatkowy styl własny „Tekstura/materiał"** rekomendowany w
  specyfikacji — nie zaimplementowany, to propozycja.

### Niemożliwe (dziś, tą drogą)
- Nic w tym filarze samym w sobie uderza w twardy sufit biblioteki — obrazy
  rastrowe są w pełni wspierane. Sufit dotyczy filaru 2 (gradient tła, krój).

---

## Filar 2 — Układ, kolor, kształty

**Stan: DZIURA. Jedyny filar bez realnego dorobku produkcyjnego — mamy
specyfikację i jedną scaloną naprawę geometrii, resztę wydano bez scalenia.**

### Działa
- Nic z tego filaru nie działa bez flagi.

### Zbudowane, ale wyłączone
- **Geometria — dyżur 227, oceniony A, scalony.** Przed naprawą istniały **dwa
  niezgodne renderery** z różną geometrią: `PptxPipelineService` +
  `designTokens.ts` (margines 0,5 cala, góra treści 1,0 cala) kontra
  `DeckStyler.ts` + `themeRegistry.ts` (margines 0,6 cala, góra treści 1,7 cala) —
  różnica zmierzona wprost odczytem bajtów dwóch realnych plików PPTX (nie grep
  kodu): delta OFF `(0.1, 0.7)` cala, delta ON `(0, 0)`
  (`CODEX_DAY227_GAMMA_GEOMETRIA_REPORT.md`). Za flagą
  **`ENABLE_PPTX_CANONICAL_GEOMETRY`, domyślnie `false`**
  (`server/src/config/FeatureFlags.ts:52`) oba renderery czytają tę samą
  geometrię z `designTokens.ts`, a `harvard` (zestaw kolorów zapasowego
  renderera) czyta most marki `PRODUCT_BRAND_PRIMARY = '#85182F'` zamiast
  własnego zaszytego `#A41034`. **Przy OFF nic się nie zmieniło** — to jest
  właściwe działanie flagi, nie „bramka zamiast przewodu"
  (potwierdzone w niezależnym odbiorze, `5ad2e203fd`, ocena A−).
  **Trasa inicjatyw (`initiativeMaterializeService.ts:488`) nadal woła
  zapasowy renderer bezwarunkowo, bez flagi i bez fallbacku** — jeden produkt
  potrafi dziś wypuścić dwa pliki o różnej geometrii zależnie od tego, którędy
  poszedł, dopóki ktoś nie podepnie tej trasy pod flagę.
- **Edytor kolorów/fontów per układ (`PresentationTemplateArchitectView`)** —
  był całkowicie martwy: front wysyłał `customTemplate`, backend
  `PATCH /templates/:id` go destrukturyzował bez tego pola, praca konsultanta
  znikała po kliknięciu Zapisz (`docs/program/funkcje/GAMMA_G0_POMIAR.md:15-21`).
  Dyżur 226 (commit rdzenia `0aea4829e5`) to naprawił za flagą
  **`ENABLE_PRESENTATION_TEMPLATE_CUSTOM_SAVE`, domyślnie `false`**
  (`server/src/config/FeatureFlags.ts:54`; handler PUT dziś w
  `server/src/routes/presentations.routes.ts` — waliduje `customTemplate` tą
  samą funkcją co odczyt runtime i scala kontrakt bez utraty
  `colorTemplateId`, potwierdzone SQL readbackiem z tego samego przebiegu HTTP).
  `PptxPipelineService.ts:177-200` czyta `titleFont`, `bodyFont` i pięć kolorów
  z `customTemplate.theme` i buduje z nich tokeny renderera — **żywy konsument
  istnieje**. **Ale**: ogniwo „plik" (czy zapisane wartości naprawdę trafiają
  do bajtów wyeksportowanego PPTX) **nie zostało zweryfikowane** — autor dyżuru
  226 sam to nazwał `NIEZWERYFIKOWANE` (nie wygenerował i nie sparsował XML z
  wiersza zapisanego w tym samym przebiegu), a zrzuty UI nie zostały wykonane.
- **Praca konsultanta dociera do bajtów pliku** — to jest cytat z osobnego,
  niezależnego odbioru dyżuru 226 (`3621ec07ba`), który zbudował własną
  trzyczłonową bramkę z parsowaniem XML z archiwum PPTX i **potwierdził** to,
  czego autor dyżuru sam nie zweryfikował. Traktuj to jako rozstrzygnięte przez
  drugą, niezależną parę oczu, nie przez oryginalny raport.

### Nie istnieje
- **13 gotowych zestawów kolorystycznych (`CURATED_COLOR_SETS`) — nadal MARTWE
  dla eksportu, także po dyżurze 226.** Zapisuje się do bazy, ale funkcja
  budująca ustawienia renderu czyta z tego pola tylko `customTemplate`, **nigdy
  `colorTemplateId`** — potwierdzone wprost w raporcie dyżuru 226: „`colorTemplateId`
  nie ma konsumenta stylu po stronie backendu; jest identyfikatorem/metadanymi"
  (`CODEX_DAY226_GAMMA_EDYTOR_REPORT.md`, sekcja R2). Renderer i mapowanie 13
  presetów zostało świadomie wyłączone z zakresu dyżuru 226 (przypisane
  dyżurowi 227, który go nie dostarczył).
- **Kolor i typografia jako motyw „gamma-grade"** — dyżur 229 **wydany, nic nie
  scalone**. Poza specyfikacją (15 cech mierzalnych w
  `GAMMA_G1_SPECYFIKACJA.md`) nie ma tu produkcyjnego kodu do zacytowania.
- **Sześć zakładek edytora motywu** (Colors/Fonts/Logo/Design/Images/Charts) i
  **wbudowana kontrola kontrastu przy każdym polu** — to jest wzorzec
  **zaobserwowany u Gammy** (`GAMMA_G3_OBCHOD_MENU.md:45-54`), u nas **nie
  istnieje** nawet za flagą. Nasz edytor motywu ma dziś jedną zakładkę koloru/
  fontu i nie sprawdza kontrastu przy wpisywaniu.
- **Wypalanie tła jako pojedynczy raster** (gradient + ziarno + welon w jednym
  PNG) — rekomendacja specyfikacji G-1 §5, nie zaimplementowane.

### Niemożliwe (dziś, tą drogą)
- **Gradient tła i osadzony krój pisma** — twardy sufit `pptxgenjs`, patrz wyżej.
  Jedyne obejścia: (a) symulacja gradientu nakładaniem półprzezroczystych
  kształtów — da widoczne schodkowanie na rzutniku i nie da ziarna wcale
  (`GAMMA_G1_OBRAZY.md:190-196`); (b) wypalenie całego tła jako obraz — traci
  edytowalność w PowerPoincie; (c) tryb „Studio" Gammy (cały slajd jako jeden
  obraz) — patrz Odkrycie nr 1 niżej, to decyzja produktowa, nie łatka.
- **Identyczny render w PowerPoint/Keynote/Google Slides/LibreOffice** —
  **nawet Gamma tego nie ma**: panel eksportu na koncie właściciela ostrzega
  wprost *„Layouts may shift after exporting to PowerPoint and Google Slides"*
  (`GAMMA_G3_OBCHOD_MENU.md:125-136`). To nie jest nasz brak, to właściwość
  formatu PPTX w ogóle.

---

## Filar 3 — Treść pisana zanim ruszy produkcja slajdów + agent redagujący

**Stan: zbudowany, ale z dziurą. Najbardziej dojrzały z trzech filarów, i
jednocześnie ten z najostrzej nazwanym kłamstwem nazw operacji.**

### Działa
- **Kolejność „treść przed slajdami" jest w produkcji, nie za flagą.**
  `PresentationWizard.handleGenerateOutline` woła
  `/presentations/generate/outline`, ustawia `step='outline'`, renderuje
  `OutlineStep` do przejrzenia i edycji tytułu/tezy, i dopiero `handleGenerate`
  woła `/generate/deck` (`CODEX_DAY231_GAMMA_ZWIEDZY_REPORT.md`, R2 — „teza
  instrukcji, że tego nie ma, została obalona pomiarem"). To jest dokładnie
  element 3 właściciela, potwierdzony mechanicznie na żywym koncie Gammy
  (przycisk „Generate outline", nie „Generate";
  `GAMMA_G2_SESJA_NA_ZYWO.md:40-44`) i już wcześniej w naszym produkcie.
- **Brama stanu propozycji decku agenta działa bez flagi.** `getAiOperation`
  czyta trwały rekord z Postgresa; `/accept` i `/reject` zwracają `409
  AI_PROPOSAL_ALREADY_RESOLVED` dla stanu innego niż `draft`; przejście stanu
  używa `WHERE id = ? AND status = ?` i wymaga dokładnie jednego zmienionego
  wiersza. Zmierzone RealPG (3/3 PASS) i mutacyjnie w trzech niezależnych
  mutacjach RED→GREEN (`CODEX_DAY232_GAMMA_AGENT_REPORT.md`, R1).

### Zbudowane, ale wyłączone
- **Konspekt z wiedzy organizacji, nie z szablonu i słów kluczowych.**
  `presentationKnowledgeOutlineService.ts` przechodzi przez realny
  `executeReadTool → executeToolCall → executeKBSearch → ragService.hybridSearch`
  — **para dowodowa rozstrzygająca**: fakt istniejący wyłącznie w treści
  dokumentu (dwie liczby losowe) trafia do konspektu i `outline_json` przy
  fladze ON i dostępie do dokumentu; ta sama sonda dla **innej organizacji**
  zwraca `results: []` i żadnej liczby (`ODBIOR_231.md`, `pairDecisive: true`).
  Za flagą **`ENABLE_DECK_FROM_KNOWLEDGE`, domyślnie `false`**
  (`server/src/config/FeatureFlags.ts:68`) — i wymaga **jednocześnie**
  `ENABLE_TERESA_TOOL_LOOP` (też domyślnie `false`,
  `server/src/config/FeatureFlags.ts:36`), bo bez niej model nie dostaje
  narzędzi i trasa oddaje HTTP 500 dla każdego (zmierzone, `ODBIOR_231.md`,
  FIX-5). **Runbook włączenia: obie flagi razem, albo żadna.**
  ★ Odbiór adwersaryjny wykrył i naprawił, PRZED scaleniem, że stempel
  pochodzenia `source_type='org_knowledge_outline'` **był echem samej flagi**,
  nie faktem wykonania gałęzi wiedzy — cztery producenckie wołacze
  `generateOutline` nie przekazują `actor`, więc dostawały etykietę „z wiedzy
  organizacji" przy konspekcie zbudowanym z szablonu. Naprawione: stempel
  wystawiany z faktu (`groundedOutlineUsed`), nie z ustawienia flagi
  (`ODBIOR_231.md`, FIX-1, FIX-2 — filtr źródeł też był strukturalnie zamknięty
  na głucho, żadne prawdziwe źródło nie mogło przejść, naprawione dopasowaniem
  znormalizowanym).
- **Pięć operacji redagowania agenta** za flagą
  **`ENABLE_TERESA_DECK_EDIT`, domyślnie `false`**
  (`server/src/config/FeatureFlags.ts:38`): `rewrite_slide`, `shorten_slide`,
  `split_slide`, `change_archetype`, `add_source`
  (`server/src/services/presentationAgentEditService.ts:15-19`). Panel „Agent"
  jest zamontowany w produkcyjnym `DeckBuilder.tsx` (nie w drugim, osobnym
  panelu) i pokazuje dziennik zdarzeń.
- **Cytowania nie mogą już być fabrykowane.** `add_source` przyjmował wcześniej
  dowolny adres wklejony w czacie i zapisywał go jako cytowanie — dokładnie to,
  czym Consultify **nie ma być**. Naprawione i zweryfikowane parą dowodową:
  adres z czatu ⇒ odrzucony, lista cytowań zostaje pusta; adres realnego
  dokumentu wiedzy organizacji ⇒ przyjęty, cytowanie ma identyfikator i tytuł
  z bazy, nie z tekstu polecenia (`ODBIOR_230_232_FIX.md`, FIX-232 A2).
- **Ochrona przed wyścigiem dwóch równoległych poleceń.** Kod produkcyjny daje
  `[200, 409]` (wersja przechodzi 1→2); po usunięciu zabezpieczenia
  mutacyjnie `[200, 200]` — zgubiona aktualizacja. Mutacja trafiła w
  zabezpieczenie, nie w mechanizm (`ODBIOR_230_232_FIX.md`, FIX-232 A1).

### Nie istnieje
- **Trzy „następne ruchy" po zakończeniu pracy agenta** („dodaj 2 slajdy",
  „znajdź powiązane studia przypadku", „zwizualizuj slajdy przeładowane
  tekstem") — pokazane wyłącznie w harnessie dowodowym, **nie podłączone do
  produktu**. Trzecia pozycja jest nieaktywna, bo zależy od detektora
  przepełnienia z dyżuru 230, który nie jest jeszcze scalony do tej samej linii
  (`CODEX_DAY232_GAMMA_AGENT_REPORT.md`, R3/R4).
- **Realny model nigdy sam nie wywołał `search_knowledge_base`** na nowej
  trasie — dowiedziono wyłącznie **transportu** (wiedza → narzędzie → konspekt
  → deck) atrapą podmieniającą tylko `llmService.callStream`, nigdy pełnego
  przebiegu z prawdziwym modelem. To zostaje jawnie otwarte (`R5c`,
  `ODBIOR_231.md`, budżet właściciela).
- **Atrybucja każdej liczby wewnątrz `deck_json`/`unified_json`** — prowieniencja
  dziś kończy się na `outline_json`, nie sięga do finalnego decku.
- **Żaden finalny PPTX z nowej ścieżki „z wiedzy organizacji" nie został
  wygenerowany ani razu** (`ODBIOR_231.md`, sekcja 7).

### Niemożliwe / nazwy kłamią (świadomie nienaprawione — osobny dyżur)
Trzy z pięciu operacji agenta **robią coś innego, niż deklaruje ich nazwa** —
zweryfikowane czytając kod, nie z opisu:

| Operacja | Co obiecuje nazwa | Co robi naprawdę | Dowód |
| --- | --- | --- | --- |
| „przeredaguj" (`rewrite_slide`) | model redaguje treść | **wkleja dosłownie tekst z polecenia użytkownika po dwukropku**, zero modelu | `server/src/services/presentationAgentEditService.ts:513` — `String(prompt).split(':').slice(1).join(':').trim()` |
| „podziel slajd" (`split_slide`) | inteligentny podział treści | **tnie w połowie liczby ZNAKÓW**, może przeciąć w środku wyrazu; nowy `card_id` budowany ze znacznika czasu (`Date.now()`) — kolizja przy dwóch podziałach w tej samej milisekundzie | `server/src/services/presentationAgentEditService.ts:534` (`Math.ceil(text.length / 2)`), `:540` (`-split-${Date.now()}`) |
| „zmień archetyp" (`change_archetype`) | zmiana układu slajdu | wyciąga nazwę z regexu w poleceniu i **wpisuje ją bez żadnej walidacji** przeciw liście dozwolonych archetypów | `server/src/services/presentationAgentEditService.ts:554` — `cards[index].layout_id = layoutId` |

**To jest osobny dyżur, nie poprawka przy okazji** (`ODBIOR_230_232_FIX.md`,
sekcja „Odnotowane, świadomie NIE naprawione"). Dopóki nie jest naprawione,
„agent, któremu mówisz co zmienić, i to się zmienia" — trzeci element obietnicy
właściciela — **działa dla dwóch z pięciu operacji przez przypadek składniowy**
(dopisywanie tekstu, wpisywanie identyfikatora), nie przez rozumienie polecenia.

★ **Szósta niezależna kopia mechanizmu „AI proponuje, człowiek akceptuje" w
produkcie**, zero wspólnego kodu z poprzednimi pięcioma (w tym z dyżuru 207).
Dług architektoniczny do rozstrzygnięcia, nie błąd tego dyżuru.

---

## ★★ Przyczyna źródłowa całej oceny jakości: brak klucza do modelu językowego

To jest odkrycie, które **unieważnia część wcześniejszych wniosków** o „słabych
generatorach" dokumentów i prezentacji. Pierwszy uczciwy pomiar na realnym
Postgresie, realnym `Gateway`, realnych trasach produkcyjnych
(`docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md`) wykrył, że w środowisku
pomiarowym **nie było żadnego klucza do modelu językowego**. Logi pokazują
realne, nieudane wywołania: brak klucza → pięć błędów → bezpiecznik otwiera się
→ „brak dostępnego modelu". To jest jednocześnie dowód, że kod jest prawdziwy,
nie atrapa — atrapa by „zadziałała".

**Wniosek: dwa z trzech generatorów zmierzonych tym pomiarem (dokument, deck)
nie były oceniane. Były oceniane ich awaryjne zastępniki.** Trzeci artefakt
(arkusz DCF) jest deterministyczny, bez modelu — dlatego brak klucza mu nie
zaszkodził i **wyszedł dobrze** (kontrola 100/100, wartość zgodna z niezależnym
przeliczeniem). To dowodzi, że produkt **potrafi** wyprodukować dobry artefakt,
gdy nie zależy od modelu.

**Dopóki nie powtórzymy przebiegu z realnym kluczem, żadna ocena jakości
dokumentu ani prezentacji nie jest wiążąca — ani ta zła, ani przyszła dobra.**
To dotyczy wprost oceny filarów 1 i 3 w tym dokumencie: „przewód gotowy" i
„agent działa" są zmierzone strukturalnie (dowody mutacyjne, RealPG), ale
**jakość tego, co model naprawdę powie na realnym kluczu, jest nieznana**.

## ★★ Niespójność bramek jakości — najgroźniejsze znalezisko pomiaru

Z tego samego przebiegu (`DOWOD_TRZY_PLIKI_2026-09-01.md`):

- **Dokument (DOCX) z treścią zastępczą (432 słowa, zero zdań z konkretem,
  wypełniacze typu „TBD", wyciek nawiasu systemowego do tekstu klienckiego)
  ZOSTAŁ ZABLOKOWANY.** Bramka jakości wykryła niezgodność języka i za małą
  gęstość treści i odmówiła wydania pliku. Plik powstał dopiero po świadomym,
  audytowanym obejściu bramki.
- **Prezentacja (PPTX, 12 slajdów, 533 słowa) z jawnie fałszywym zdaniem
  „Diagnoza objęła portfel 0 inicjatyw i 0 ryzyk" (przy dwóch dostarczonych
  źródłach z realnymi inicjatywami) PRZESZŁA z oceną 99/100.**
  Przyczyna po stronie prezentacji: `server/src/services/deliverables/deckConclusionSlide.ts:179-180`
  liczy `initiativesCount`/`risksCount` wyłącznie ze strukturalnych tablic
  (`a._initiatives`, `a._risks`) — źródło tekstowe, w którym fakt istniał, jest
  dla tej syntezy **niewidoczne**.

**Gorszy artefakt dostał wyższą ocenę.** Bramki jakości nie są dziś spójne
między formatami — prezentacja potrzebuje bramki tej samej mocy co dokument,
zanim jakiekolwiek 99/100 znaczy cokolwiek.

---

## Mechanizm Gammy wart skopiowania — rozstrzygnięty na żywym koncie

Właściciel udostępnił swoje płatne konto Gammy (1.09.2026) i poprosił o realny
przebieg, nie o czytanie dokumentacji marketingowej. Najważniejsze ustalenie
mechaniczne, nie domysł (`docs/program/funkcje/GAMMA_G3_OBCHOD_MENU.md:13-37`):

> **Motyw → zakładka „Images" → pole „Style prompt"**: treść tego pola jest
> **doklejana do KAŻDEJ generacji obrazu w tym motywie**. Motyw właściciela
> (`theme_DBR77`, podpisany „367 gammas are using this theme") ma tam wpisane:
> *„…utilizing a gradient of fuchsia, pink, and royal blue…"*.

To rozstrzyga wcześniejsze „nieustalone" z pierwszej specyfikacji (G-1): Gamma
**nie** robi obróbki po wygenerowaniu (duotone) — stosuje paletę **w treści
polecenia dla modelu**, ustawioną raz na poziomie motywu/organizacji, a nie per
generacja. To jest **najtańsza do skopiowania rzecz z całej Gammy o
największym efekcie spójności** (stąd 367 spójnych prezentacji z jednego
motywu) i mamy jej odpowiednik, ale **per prezentacja, nie per motyw
organizacji** — dyżur 228 (patrz Filar 1). Podniesienie tego na poziom motywu
organizacji jest naturalnym następnym krokiem, nie zbudowanym dziś.

Dwa dodatkowe fakty z tego samego przebiegu, ważne dla oczekiwań:
- **Gamma ma dwa tryby projektowania slajdu**: „Classic" (bloki edytowalne —
  nasz dzisiejszy sufit) i „Studio" (**cały slajd to jeden wygenerowany obraz,
  edycja przez pytanie AI**). Studio tłumaczy jednocześnie efekt „wow" i to,
  że układów jest mało — w Studio układ jako pojęcie **nie istnieje**.
  Wybór między tymi dwoma podejściami dla nas jest **decyzją produktową**, nie
  techniczną (`GAMMA_G2_SESJA_NA_ZYWO.md`, Odkrycie nr 1).
- **Nawet Gamma nie ma wierności eksportu.** Panel eksportu ostrzega wprost,
  że układ może się przesunąć w PowerPoincie i Google Slides. To zamyka
  dyskusję o formacie dystrybucji: **PDF dla odbiorcy, PPTX dla edytujących** —
  bo tak działa nawet wzorzec, którego gonimy.

---

## ★ Decyzja właściciela z 1.09.2026: własne składanie, API Gammy jako osobny, tani tor

Trzy drogi do filaru 2 rozważono (`GAMMA_00_PRZEWODNIK.md:91-104`):
- **A. Własne składanie** — kolor, kształt, siatka, przezroczystość; da się
  zrobić czysto, **nie da się „wow" gradientem**.
- **B. API Gammy** — oni renderują, my dostarczamy treść; rozdwojenie
  właściciela znika, cena to zależność i opłata.
- **C. Renderujemy sami do obrazu** i wklejamy jako grafikę; pełna kontrola
  wyglądu, ale slajd przestaje być edytowalny w PowerPoincie.

**Decyzja: idziemy drogą A (własne składanie) jako główny tor, a drogę B (API
Gammy) badamy RÓWNOLEGLE jako osobny, tani tor rozpoznawczy — nie jako
zamiennik.** Powód: jeśli B naprawdę przyjmuje gotową treść i oddaje gotową
prezentację, to jest najkrótsza droga do marzenia właściciela, i lepiej się o
tym dowiedzieć teraz niż po zbudowaniu całego filaru 2 własnymi rękami.

## Pięć rzeczy nadal niewiadomych — otwarte, nie zamknięte

Przepisane z `GAMMA_00_PRZEWODNIK.md:76-90`, żaden z tych punktów nie został od
tamtej pory zmierzony:

1. **Co dokładnie API Gammy przyjmuje i co zwraca** — dokumentacja nie została
   otwarta, cennik nie sprawdzony. To jest pytanie numer jeden, bo może
   odwrócić cały kierunek filaru 2.
2. **Czy zmiana motywu naprawdę zmienia wygląd** czy tylko paletę — nie
   testowano edytora motywu na żywej prezentacji.
3. **Limity i koszt konta Gammy** — ile generowań, co się dzieje po
   przekroczeniu (wiadomo tylko: jeden wygenerowany deck 10 slajdów kosztował
   90 kredytów, licznik 6 108 → 6 018).
4. **Jak bardzo eksport psuje układ w praktyce** — ostrzeżenie widziano,
   skutku nie zmierzono.
5. **Czy da się wgrać własny motyw firmowy klienta** do Gammy.

## Flagi tego podsystemu — wszystkie domyślnie WYŁĄCZONE

| Flaga | Domyślnie | Steruje | Plik |
| --- | --- | --- | --- |
| `ENABLE_PRESENTATION_TEMPLATE_CUSTOM_SAVE` | `false` | zapis niestandardowego szablonu koloru/fontu (filar 2) | `server/src/config/FeatureFlags.ts:54` |
| `ENABLE_PPTX_CANONICAL_GEOMETRY` | `false` | jedna geometria zamiast dwóch niezgodnych (filar 2) | `server/src/config/FeatureFlags.ts:52` |
| `ENABLE_PRESENTATION_IMAGE_STYLE` | `false` | styl obrazu dociera do promptu + bramki OCR/twarz (filar 1) | `server/src/config/FeatureFlags.ts:53` |
| `ENABLE_DECK_OVERFLOW_WARNING` | `false` | ostrzeżenie o przepełnieniu slajdu przed pobraniem | `server/src/config/FeatureFlags.ts:55` |
| `ENABLE_TERESA_DECK_EDIT` | `false` | pięć operacji redagowania agenta (filar 3) | `server/src/config/FeatureFlags.ts:38` |
| `ENABLE_DECK_FROM_KNOWLEDGE` | `false` | konspekt z wiedzy organizacji zamiast szablonu (filar 3) | `server/src/config/FeatureFlags.ts:68` |
| `ENABLE_TERESA_TOOL_LOOP` | `false` | wymagana RAZEM z powyższą — bez niej trasa daje HTTP 500 | `server/src/config/FeatureFlags.ts:36` |

Żadna z tych flag nie jest dziś włączona domyślnie nigdzie. **Reguła 7 z
CLAUDE.md obowiązuje wprost**: żaden z tych ekranów nie idzie na demo bez
osobnego, pojedynczego akceptu właściciela na czystym zrzucie — jeden po
drugim, nigdy hurtem.

## Co wymaga pomiaru — zbiorczo

- **Wszystko, co zależy od realnego modelu językowego** — najpilniejsze:
  powtórzyć przebieg trzech plików z realnym kluczem (patrz sekcja o
  przyczynie źródłowej).
- Ogniwo „plik" dla edytora szablonu (dyżur 226) — czy zapisane
  `customTemplate` naprawdę trafia do bajtów wyeksportowanego PPTX.
- Czy realny model **sam z siebie** wywoła `search_knowledge_base` z właściwym
  zasięgiem projektu (dyżur 231, `R5c`).
- Jakość obrazów wygenerowanych z sześciu presetów wobec wzorca Gammy — nie ma
  dziś żadnego porównania.
- Marginesy błędu detektora przepełnienia poza próbką pięciu slajdów jednego
  layoutu/kroju/silnika (dziś zmierzone tylko na LibreOffice).
- Pięć niewiadomych o API Gammy (sekcja wyżej) — to jest osobny, mały tor
  rozpoznawczy, nie część budowy filaru 2.
- Wyrównanie bramek jakości dokument/prezentacja do tej samej mocy — dziś
  gorszy artefakt (deck z fałszywym zdaniem) dostaje wyższą ocenę niż lepszy
  (dokument zablokowany słusznie).

## Mapa dokumentów źródłowych

Ten dokument syntetyzuje siedem plików `docs/program/funkcje/GAMMA_*.md`, dwa
dowody (`DOWOD_TRZY_PLIKI_2026-09-01.md`, `ODBIOR_230_232_FIX.md`, `ODBIOR_231.md`)
i sześć raportów wykonawczych `docs/program/waves/WAVE_03_ACCEPTANCE/codex/
CODEX_DAY226…232_GAMMA_*_REPORT.md`. Szczegółowy pomiar plik:linia,
uporządkowany per system a nie per filar, jest w `AS_IS_2026-09-01.md` obok.
`docs/program/funkcje/GAMMA_00_PRZEWODNIK.md` pozostaje punktem wejścia do
surowego materiału źródłowego i ma dopisany odnośnik do tego dokumentu.
