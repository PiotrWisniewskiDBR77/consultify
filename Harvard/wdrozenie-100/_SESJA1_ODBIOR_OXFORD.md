# SESJA #1 — Odbiór Oxford (KOMPETENTNI)

> **Cel tej sesji:** Ty (Piotr) siadasz raz, na ~2-3h, i domykasz naraz ~55-70 pozycji Oxfordu —
> filaru „czy Consultify myśli jak konsultant". Nic z tego nie wymaga kodowania na żywo: to sesja
> **czytania dowodów + kilku decyzji produktowych**, nie klikania po ekranach (Oxford to głównie
> silnik, patrz sekcja 4).
>
> **Stan wejściowy (rejestr `_REJESTR_DOKONCZENIA.md`, 2026-07-19, po FALA-W7):** Oxford = **31✅ ·
> 23🟡 (zbudowane, czeka Twój odbiór) · 11⬜ · 5🔵 (czeka decyzja) · 70 razem**. Ta sesja adresuje
> praktycznie wszystkie 🟡 i 🔵.
>
> **Jak czytać stany:** ✅ zamknięte z dowodem · 🟡 zbudowane, kod działa, ale nikt formalnie nie
> powiedział „OK" · ⬜ nie zrobione · 🔵 świadomie odłożone, ale wymaga Twojej decyzji żeby nie
> wisiało w powietrzu.
>
> **Źródła tego dokumentu:** `tests/acceptance/o1-*.e2e.test.ts`, `h1-chain.e2e.test.ts`,
> `h3-dowody.e2e.test.ts`, `_PROJEKT_C_OXFORD.md`, `_REJESTR_DOKONCZENIA.md` (sekcja C),
> `_KONSTYTUCJA_PARTNERSKA.md` §5, `docs/product/DRD_CANON.md` §12, `docs/standards/O3_DEEPENING_MAP.md`.
> Praca wykonana **read-only** na `origin/demo` (tip `248eeb220a`) — nic z poniższego nie zostało
> jeszcze zmienione w kodzie.

---

## SPIS TREŚCI
1. [Promptbook Oxford O1](#1-promptbook-oxford-o1) — 6 dowodów „assessment → inicjatywy/raport" per DRD/SIRI/ADMA
2. [Lista pozycji Oxford czekających na odbiór](#2-lista-pozycji-oxford-czekających-na-odbiór) — tabele O1-O8
3. [Decyzje do podjęcia](#3-decyzje-do-podjęcia) — DRD Kanon, CONCLUSION_LAYER, O7.1, śmieci, itd.
4. [Co zobaczysz na ekranie vs co jest tylko silnikiem](#4-co-zobaczysz-na-ekranie-vs-co-jest-tylko-silnikiem)
5. [Checklist sesji — kolejność, czas, co robić](#5-checklist-sesji)

---

## 1. Promptbook Oxford O1

O1 to fundament Oxfordu: „czy assessment (DRD/SIRI/ADMA) rzeczywiście kończy się **inicjatywami do
zrobienia** i **raportem, który można pokazać klientowi**". Poniżej 6 dowodów (testy E2E na realnej
bazie, realnym routerze, realnym uwierzytelnieniu — zero atrap biznesowych). Każdy dowód sprząta po
sobie (prefiks `odbior--...--` na wszystkich testowych wierszach, usuwane w `afterAll`) — **zero
śmieci zostaje w demo**.

**Jak to zobaczysz:** to są testy backendu (mechanika, nie ekran). Ja (agent/CTO) uruchamiam je i
wklejam Tobie log z wynikiem — zgodnie z zasadą „Piotr nigdy pierwszym testerem": najpierw JA
odpalam i pokazuję czysty wynik, dopiero potem Ty czytasz i akceptujesz. Wyjątek: **test #5 (DRD
Raport) ma gotową próbkę HTML, którą możesz otworzyć sam w przeglądarce** — link niżej.

---

### T1 — DRD: Assessment → Inicjatywy (H1.3)
**Plik:** `tests/acceptance/h1-chain.e2e.test.ts` (opis `H1.3`) · **Dowód:** commit `a3234936d6`

**Co robi:** Symuluje zakończenie assessmentu DRD z dwiema konkretnymi rekomendacjami
(„Renegocjuj cennik z kluczowym klientem", „Wdroż przegląd kosztów bezpośrednich"). Woła REALNY
mechanizm zamykania assessmentu (`AssessmentWorkbenchService.transition → completed`) i sprawdza,
że w bazie faktycznie pojawiły się **2 inicjatywy w statusie DRAFT**, powiązane z assessmentem
(back-reference), plus że powtórne zamknięcie **nie tworzy duplikatów**.

**Czego szukać (dobre/złe):**
- DOBRZE: `runState: 'completed'`, 2 wiersze w `initiatives` ze statusem `DRAFT`, `source_type =
  'assessment'`, tytuły inicjatyw = dosłowna treść rekomendacji z assessmentu (nie parafraza AI —
  to ważne: brak fabrykacji treści).
- ŹLE: brak inicjatyw, status inny niż DRAFT, powtórne zamknięcie tworzy drugi komplet (duplikaty).

---

### T2 — SIRI: Assessment → Inicjatywy (O1.8, wariant A)
**Plik:** `tests/acceptance/o1-siri-adma-initiatives.e2e.test.ts` (opis `O1.8 — SIRI`) · **Dowód:** commit `2e4b86a067`

**Co robi:** Ten sam mechanizm co T1, ale na assessmentcie **SIRI** (dojrzałość Industry 4.0),
z rekomendacjami z luk w wymiarach Operations/Supply Chain. Dowodzi, że mechanizm **nie jest
zaszyty pod DRD** — działa identycznie dla innej metodyki.

**Czego szukać:** 2 inicjatywy DRAFT, treść = rekomendacje SIRI („Podnieś automatyzację operacji…",
„Zintegruj łańcuch dostaw…"), idempotencja (bez duplikatów przy powtórce).

---

### T3 — ADMA: Assessment → Inicjatywy (O1.8, wariant B)
**Plik:** `tests/acceptance/o1-siri-adma-initiatives.e2e.test.ts` (opis `O1.8 — ADMA`) · **Dowód:** commit `2e4b86a067`

**Co robi:** To samo dla assessmentu **ADMA** (dojrzałość produkcji zaawansowanej), z trzema
rekomendacjami z luk filarowych (advanced manufacturing / operational excellence).

**Czego szukać:** 3 inicjatywy DRAFT z treścią rekomendacji ADMA, poprawny back-reference.

---

### T4 — Odporność: brak rekomendacji → wnioski z kluczowych ustaleń (O1.8, wariant C)
**Plik:** `tests/acceptance/o1-siri-adma-initiatives.e2e.test.ts` (opis „keyFindings fallback") · **Dowód:** commit `2e4b86a067`

**Co robi:** Sprawdza scenariusz brzegowy — gdy assessment **nie ma** jawnych „następnych kroków"
(nextActions puste), silnik **nie milczy**, tylko tworzy inicjatywy z „kluczowych ustaleń"
(keyFindings). To dowód, że mechanizm nie jest kruchy na niekompletne dane wejściowe z metodyki,
która nie zawsze generuje explicit rekomendacje.

**Czego szukać:** 2 inicjatywy powstałe mimo pustego `nextActions`, treść = dosłowne `keyFindings`.

---

### T5 — DRD: Raport klienta + benchmark branżowy + narrator AI (O1.4/O1.5) — ★ MA WIZUALNY PODGLĄD
**Plik:** `tests/acceptance/o1-drd-report-benchmark.e2e.test.ts` · **Dowód:** commit `aff4cca91d`

**Co robi:** To jest **flagowy output Oxfordu** — pełny raport DRD dla klienta (HTML klasy
wydawniczej, do druku/PDF). Test woła realny endpoint `GET
/api/assessment-reports/:id/drd-report`, z realnym silnikiem AI (Anthropic, nie atrapa) piszącym
narrację (streszczenie + rozdział na wymiar + karty luk), z **twardą siatką bezpieczeństwa**: gdyby
AI zmyśliło liczbę, walidator to złapie i cofnie do wersji deterministycznej (liczby zawsze z
silnika, nigdy z głowy modelu). Dolicza też **benchmark branżowy** („Typowa firma" / „Lider
branży") z jawnym zastrzeżeniem „hipoteza ekspercka" (nie udajemy zmierzonych danych, których nie
mamy).

**★ Otwórz sam:** `docs/qa/deliverables/runs/DRD-REPORT-SAMPLE.html` — gotowa próbka tego samego
generatora, zweryfikowana wizualnie i jako PDF. To jest jedyny element promptbooka O1, który możesz
obejrzeć bezpośrednio (statyczny plik HTML, nie wymaga logowania) — otwórz w przeglądarce.

**Czego szukać w próbce / w logu testu:**
- DOBRZE: sekcja „Benchmark branżowy" z etykietami „Typowa firma"/„Lider branży" + zastrzeżenie
  „expert-hypothesis"/„hipoteza"; radar/mapa 8 wymiarów; **liczby w tekście zgadzają się z danymi
  wejściowymi** (np. cyberbezpieczeństwo na poziomie 1/5 = 20% — to musi być widoczne wprost, nie
  zaokrąglone czy zmyślone); jawna adnotacja, że jeden wymiar (D5 Technologia) nie ma dopasowanego
  wskaźnika w silniku (uczciwe „brakuje", nie fabrykacja).
- ŹLE: liczby, które nie zgadzają się z wejściem; brak zastrzeżenia przy benchmarku (wygląda jak
  twardy fakt rynkowy); crimson/czerwień użyta jako kolor dekoracyjny (czerwień = tylko krytyczne
  stany, patrz doktryna UI); tekst „w niniejszym rozdziale przedstawiono..." zamiast konkluzji na
  starcie (piramida Minto — wniosek najpierw).
- **Uwaga inżynierska (nieważna dla oceny treści):** pełne wygenerowanie z żywym AI trwa 90-180s —
  to nie błąd, model pisze ~9 fragmentów i każdy jest sam siebie sprawdza.

---

### T6 — SIRI/ADMA: mechanika samego assessmentu (H3.4/H3.5)
**Plik:** `tests/acceptance/h3-dowody.e2e.test.ts` (opis `H3.4`/`H3.5`) · **Dowód:** commit `5c50d0c266`

**Co robi:** Zanim assessment w ogóle dojdzie do „zakończony → inicjatywy" (T2/T3), musi działać
sama mechanika wypełniania: stwórz assessment SIRI (lub ADMA) → zapisz odpowiedzi + wynik
(`overallScore`, `maturityLevel`) → przeładuj stronę → dane muszą przetrwać. To jest dowód „nie
gubimy pracy użytkownika w trakcie assessmentu", niezależny od T2/T3 (które testują dopiero
moment zamknięcia).

**Czego szukać:** odpowiedzi i wynik identyczne po przeładowaniu (`GET` zwraca to, co zapisano
w `PUT`), poprawny `assessment_type` (SIRI ≠ ADMA nie mieszają się).

---

## 2. Lista pozycji Oxford czekających na odbiór

Legenda: **S** = stan (✅/🟡/⬜/🔵) · **Akcja** = kto ma ruch (`ODB`=Twój odbiór, `DEC`=Twoja
decyzja, `JA`=CTO robi bez pytania). Dowody = commit SHA lub nazwa testu E2E.

### O1 — Kanony metodyczne (24 = 8 elementów × DRD/SIRI/ADMA)
Ten blok domyka się **promptbookiem z sekcji 1** (T1-T6) + decyzją K1 (DRD Kanon P1-P5, sekcja 3).

| Element | DRD | SIRI | ADMA | Co zaakceptować |
|---|---|---|---|---|
| Kanon (dokument metodyki) | 🟡 (czeka K1: P1-P5) | ✅* | ✅* | DRD: przeczytaj `DRD_CANON.md` §12, zdecyduj P1-P5. SIRI/ADMA: status „✅?" z 07-01, sprzed metody dowodowej — potwierdź, że nadal aktualne (nie wymaga nowej pracy, tylko Twojego „tak, znam i akceptuję") |
| Q-bank (pytanie→wymiar→poziom) | 🟡 (699 pytań, zmergowane) | ✅* | ✅* | Zaufaj dowodowi liczbowemu (699 pytań, 3 partie, testy strukturalne) — realna praca do przejrzenia jest w oddzielnej sesji kanonu, nie tu |
| Scoring/agregacja | 🟡 | ✅* | ✅* | j.w. |
| Benchmark branżowy | ⬜ (DRD) | ✅ | 🟡 (próg FoF) | DRD ma benchmark wpięty w raport (patrz T5!) — status ⬜ w tabeli jest już nieaktualny, T5 to dowodzi |
| **Raport + narrator AI** | 🟡 (zbudowany) | 🟡 | 🟡 | **To jest T5 wyżej** — otwórz próbkę HTML, zaakceptuj lub wskaż poprawki |
| Mapa/radar | 🟡 | ✅ | ✅ | widoczne w próbce T5 dla DRD |
| Ścieżka dojrzałości N→N+1 | 🟡 (nowe, zbudowane, 168/168 testów) | 🟡 | 🟡 | dowód kodowy gotowy — potwierdź że koncept „co zrobić żeby przejść wyżej" ma sens biznesowy |
| Generator inicjatyw z wyniku | 🟡 | ⬜* | ⬜* | **To jest T1-T4 wyżej** — status ⬜ w starej tabeli już nieaktualny, promptbook to dowodzi dla wszystkich 3 metodyk |

`* = statusy „✅?" z 07-01, sprzed wprowadzenia metody dowodowej — sesja kanonu O1/O6 (osobna, po tej) potwierdza formalnie.`

### O2 — Standard wniosków, „co jest → co znaczy → co robić → jaki efekt" (5 pozycji)
| ID | Co to | Stan | Dowód | Co zaakceptować |
|---|---|---|---|---|
| O2.1 | SSOT standardu (`CONCLUSION_LAYER_STANDARD.md`) | 🟡 | dokument gotowy | **Decyzja K2 — patrz sekcja 3, JUŻ zatwierdzona 07-19, tu tylko formalny zapis** |
| O2.2 | Wdrożenie w raportach SIRI+ADMA (exec summary z werdyktem, karty top-3 luk, pasek „Droga do FoF≥4" dla ADMA) | 🟡 | commit `0211daa262`, 19/19 testów | Odbiór: czy raport SIRI/ADMA faktycznie brzmi jak wniosek konsultanta, nie opis danych |
| O2.3 | Wdrożenie w 19/19 narzędziach (tools) | 🟡 | commity `6712546ad8`+`df5a1cf58a` | Zaufaj dowodowi (35/35 testów) — patrz też O3 niżej |
| O2.4 | Wdrożenie w analizach finansowych | 🟡 | commit `ef636ee09b` | j.w. |
| O2.5 | Narracja w generatorze decków (slajd „Wnioski") | ⬜ | brak dowodu | Nie zrobione — do zaplanowania |

### O3 — 19 narzędzi Discovery, „q-banki głębokie" (pogłębianie eksperckie)
**19/19 narzędzi ZBUDOWANE i zmergowane.** Wzorzec pilotażowy = Dynamic SWOT (Twoje wskazanie) —
raz zaakceptowany, reszta idzie tym samym mechanizmem.

| Grupa | Narzędzia | Stan | Co zaakceptować |
|---|---|---|---|
| 10 strategicznych | SWOT · Porter · Value Chain · Ansoff · Capability Mapper · Ambition Decomposer · Focus&Trade-offs · Narrative Engine · Risk&Uncertainty · Portfolio Priority | 🟡×10 | Odbiór przez promptbook (ta sesja skupia się na O1; osobna krótka sesja „czy SWOT jako wzorzec = OK" odblokowuje resztę automatycznie) |
| 9 operacyjnych (lean/ops) | SOP Builder · A3 · SMED · DMS Builder · Inventory Autopilot · AI Discovery · Pain Explorer · RPA Scanner · Process Automation | 🟡×9 | j.w. — dedykowane commity istnieją dla każdego |
| Mechanizm pogłębiania (drabinka pytań) | wszystkie 19 | ❓→wyjaśnione | **Werdykt (`O3_DEEPENING_MAP.md`):** żadne z 19 narzędzi nie jest „jednym strzałem" — wszystkie mają wielokrotnie klikalny mechanizm dopytywania. 8 z 9 operacyjnych **nie ma** czatowego mentora krok-po-kroku (mają za to przycisk „pogłęb sekcję") — świadomy, udokumentowany dług, nie luka |

### O4 — Finanse jako doradztwo (7/7 zbudowane)
| ID | Co to | Stan | Dowód |
|---|---|---|---|
| O4.1 | Business case 5-fazowy (założenia→model→scenariusze→rekomendacja) | 🟡 | E2E NPV, flaga ON |
| O4.2-4.4 | Scenariusze-dźwignie, value tree, współzależności portfela | 🟡 | commit `2db90082a7` |
| O4.5 | WACC/parametry per branża | 🟡 | commit `1e057461a2` |
| O4.6-4.7 | Trend+prognoza, post-mortem realized-vs-projected | 🟡 | commit `8f432229d5` |

Odbiór: czy sekcja finansowa raportu/inicjatywy brzmi jak analiza doradcy, nie arkusz kalkulacyjny.

### O5 — Biblioteka promptów AI („mózg jako zarządzany zasób", 6 pozycji)
| ID | Co to | Stan | Co zaakceptować |
|---|---|---|---|
| O5.1 | Prompty 25 sekcji dokumentu inicjatywy (12 podniesionych do standardu) | 🟡 | **Decyzja: 9 sekcji-paneli bez promptu AI — zostawić bez AI czy dopisać?** |
| O5.2 | AI-guidance per framework DRD/SIRI/ADMA | 🟡 | commit `87d74fa0f6` |
| O5.3 | Briefy generatorów dokumentów | 🟡 | zaufaj dowodowi |
| O5.4 | Ton Teresy (persona) — przegląd merytoryczny | ⬜ | do zrobienia po tej sesji |
| O5.5 | Rejestr promptów — jedno miejsce, wersjonowanie | ✅ | już odebrane (07-15) |
| O5.6 | Pytania Wywiadu (M10) klasy konsultanta | ⬜ | do zrobienia |

### O6 — Benchmarki branżowe (3/3 zbudowane, 2/3 z formalnym dowodem)
| ID | Co to | Stan | Dowód | Co zaakceptować |
|---|---|---|---|---|
| O6.1 | Profile referencyjne 3 branż (widoczne w raporcie, patrz T5) | 🟡 | commit `ddcfd03e4a` | **Decyzja K6/P3 — czy publikować od razu z adnotacją „hipoteza ekspercka"? (rekomendacja: tak, patrz sekcja 3)** |
| O6.2 | Zakresy wskaźników per branża (9 branż × 13 rodzin wskaźników) | ✅ | commit `917aaef042` + `tests/acceptance/o6-benchmark-financial.e2e.test.ts` | już z dowodem — potwierdź formalnie |
| O6.3 | Źródła danych + „kto odświeża" | ✅ | commit `77691e2771` + ten sam test | j.w. |

### O7 — Standardy treści (3 pozycje)
| ID | Co to | Stan | Co zaakceptować |
|---|---|---|---|
| O7.1 | Walidator CARD_CONTENT_FORMULA (karty wniosków/inicjatyw) | 🟡 | **Decyzja JUŻ podjęta 07-19: tryb advisory (ostrzega, nie blokuje) → PODNIESIONY do twardej bramy. Tu tylko formalny zapis — patrz sekcja 3** |
| O7.2 | Walidator INITIATIVE_FORMULA w generatorze inicjatyw | ✅ | commit `34c57112aa` |
| O7.3 | Ton języka PL/EN „konsultanta, nie asystenta" | 🟡 (subiektywne) | **To jest jedyna pozycja Oxfordu, która wymaga Twojego OKA, nie logu testu** — przeczytaj 2-3 fragmenty wygenerowanych tekstów (np. w próbce T5) i powiedz „brzmi jak partner firmy doradczej" czy nie |

### O8 — Pomoc i edukacja (3 pozycje, zbudowane węziej niż docelowo — tylko DRD)
| ID | Co to | Stan |
|---|---|---|
| O8.1 | Hinty „dlaczego to pytanie" w assessmentach | 🟡 (16/16 testów, szerzej niż dokumentacja mówiła) |
| O8.2 | Help content aktualny do nowych przepływów | 🟡 |
| O8.3 | Słownik pojęć konsultingowych | 🟡 |

Odbiór: potwierdź zakres (na razie tylko DRD) — czy rozszerzać na SIRI/ADMA/tools to osobna decyzja (nie blokuje ✅ dzisiejszego zakresu).

---

## 3. Decyzje do podjęcia

Format: **kontekst (2 zdania) → rekomendacja CTO → Twoja decyzja (miejsce do wpisania)**.

### K1 — DRD Kanon: 5 decyzji P1-P5 (`docs/product/DRD_CANON.md` §12)
Kanon DRD (metodyka flagowa) ma 5 otwartych pytań właścicielskich zanim uznamy go za ostateczny —
każde ma już rekomendację CTO wpisaną w dokumencie źródłowym.

| # | Pytanie | Rekomendacja CTO | Twoja decyzja |
|---|---|---|---|
| P1 | Radar 8 wymiarów: wariant „uczciwy pomiarowo" czy dobudować oś „Strategia" (marketingowo ładniej, wymaga nowej pracy pomiarowej)? | Wariant uczciwy teraz; „Strategia" jako kandydat do kanonu 2.0 | ☐ |
| P2 | Wyróżnienie „Digital Frontrunner DRD" (poziom IV we wszystkich 8 wymiarach) jako element marki? | Tak — cel aspiracyjny dla klientów + narracja sprzedażowa | ☐ |
| P3 | Benchmark branżowy w raportach: publikować od razu z adnotacją „hipoteza ekspercka", czy czekać na ≥10 realnych ocen/segment? | Publikować od razu z adnotacją — raport bez punktu odniesienia jest słabszy niż z jawnie oznaczoną hipotezą | ☐ |
| P4 | Branding raportu: „DRD by DBR77" czy „Consultify DRD"? | „DRD by DBR77" na okładce, Consultify jako platforma w stopce | ☐ |
| P5 | Nazwa: „Digital Readiness Diagnostic" czy „Diagnosis"? | Diagnostic (brzmi jak nazwa produktu; „diagnosis" sugeruje jednostkę chorobową) | ☐ |

### K2 — CONCLUSION_LAYER_STANDARD: zatwierdzenie ★ JUŻ ZDECYDOWANE 07-19
**Kontekst:** standard „co jest → co znaczy → co robić najpierw → jaki efekt" (`docs/standards/
CONCLUSION_LAYER_STANDARD.md`) jest już wdrożony na 3 powierzchniach (SIRI/ADMA raporty, 19
narzędzi, finanse) — pytanie było czy formalnie go zatwierdzić jako obowiązujący.
**Status:** zatwierdzony 07-19 w rozmowie roboczej. **Ta sesja tylko to odnotowuje** — rejestr
(`_REJESTR_DOKONCZENIA.md` wiersz O2.1) wciąż pokazuje 🔵/DEC K2 i wymaga aktualizacji na ✅ przy
najbliższej fali.

### K3 — Kasacja ~39 „śmieci-artefaktów" (dane testowe w demo)
**Kontekst:** demo ma ~39+ zduplikowanych/testowych inicjatyw i innych artefaktów (część oznaczona
wprost „THROWAWAY"/„DELETE"), które psują pierwsze wrażenie w Initiatives/Results/Finance. Realna
skala może być większa niż 39 (odkryto duplikaty ×3 tych samych nazw w kilku modułach).
**Rekomendacja:** fizyczne usunięcie (nie tylko ukrycie filtrem) — to dane demo, nie produkcyjne;
lista ID jest już zebrana w `_KARTY_SESJI/DOWODY_SESJA1.md`. | Twoja decyzja: ☐ usuń fizycznie ☐ zostaw ukryte filtrem

### K4 — 9 sekcji dokumentu inicjatywy bez promptu AI
**Kontekst:** z 25 sekcji dokumentu inicjatywy, 12 zostało podniesionych do standardu treści, ale
9 sekcji-paneli (RAID/gates/comments/control i podobne) świadomie nie ma własnego promptu AI —
działają jako proste panele danych.
**Rekomendacja:** zostawić bez AI (to pola operacyjne/kontrolne, nie miejsca na wniosek doradczy —
generowanie tam treści AI byłoby sztuczne). | Twoja decyzja: ☐ zgoda ☐ dopisać AI do wskazanych sekcji

### K5 — „SWOT ×3 / PPTX ×3"
**Kontekst:** ten punkt widnieje na liście otwartych decyzji w Konstytucji Partnerskiej bez dalszego
rozwinięcia w dostępnej dokumentacji — najpewniej dotyczy liczby wariantów/wersji do wygenerowania
(3 warianty SWOT, 3 warianty eksportu PPTX) z wcześniejszej rozmowy, której zapis nie przetrwał w
plikach źródłowych.
**Rekomendacja:** doprecyzować ustnie na sesji — nie zgaduję znaczenia zamiast rzetelnie to
oznaczyć jako niejasne. | Twoja decyzja / doprecyzowanie: ______________________

### K6 — Publikacja profili branżowych (O6.1) — patrz P3 wyżej
Ta sama decyzja co P3 (benchmark od razu z adnotacją) stosowana bezpośrednio do profili O6.1.
Rekomendacja identyczna: publikować teraz z jawnym „expert-hypothesis-v1, kalibracja od n≥10".

### K7 — 179 osieroconych organizacji (dane testowe „Atelier Toys" i podobne)
**Kontekst:** w bazie istnieje 179 organizacji-testowych bez właściciela/aktywności — powiązane z
higieną danych demo (H6.11, STAGE-BLOCKER).
**Rekomendacja:** nie usuwać bez wyraźnej zgody — możliwe, że część to celowe seed-dane (np.
Atelier Toys, Twoja własna org). Wymaga jednorazowego przeglądu listy przed decyzją usunięcia.
| Twoja decyzja: ☐ pokaż mi listę do przeglądu ☐ usuń wszystkie poza [wskaż które zostawić]

### K8 — Zasada: PROD nietykalny bez zgody (D-G)
To nie jest otwarta decyzja, tylko przypomnienie stałej zasady: nic z tej sesji (ani żadnej innej)
nie trafia na produkcję bez Twojego wyraźnego „tak" — wszystko dzieje się na `demo`.

### O7.1 — CARD_CONTENT_FORMULA: advisory czy twarda brama? ★ JUŻ ZDECYDOWANE 07-19
**Kontekst:** walidator jakości kart wniosków/inicjatyw (CARD_CONTENT_FORMULA) był złagodzony do
trybu „advisory" (ostrzega w logu, nie blokuje zapisu) — pytanie było, czy to wystarcza, czy
powinien być twardą bramą (blokuje zapis niepełnej karty).
**Status:** zdecydowane 07-19 — **twarda brama** (podniesiony z advisory do gate). **Ta sesja tylko
to odnotowuje** — rejestr (wiersz O7.1) wciąż pokazuje 🔵/DEC i wymaga aktualizacji przy najbliższej
fali (włączenie faktycznego blokowania w kodzie, jeśli jeszcze nie wdrożone jako gate).

### 6 martwych funkcji `build<Tool>DeepenPrompt` — usunąć?
**Kontekst:** audyt mechanizmu pogłębiania 19 narzędzi (`docs/standards/O3_DEEPENING_MAP.md`)
znalazł kilka funkcji-builderów promptów, które są zdefiniowane w kodzie, ale nigdzie nie
wywoływane (0 callerów) — np. `buildCapabilityLadderPromptBlock`, `buildCategoryLadderPromptBlock`.
To nie jest luka funkcjonalna (ten sam mechanizm jest pokryty inaczej, przez `deepeningLadder.ts`),
tylko dług porządkowy — martwy kod.
**Rekomendacja:** usunąć przy najbliższym sprzątaniu (JA robię bez pytania — to czysto techniczne,
zero ryzyka produktowego). | Twoja decyzja: ☐ zgoda na usunięcie ☐ zostawić na razie

---

## 4. Co zobaczysz na ekranie vs co jest tylko silnikiem

Oxford to w ~80% **mechanika/silnik** (dowodzona testami, nie ekranami) — to normalne i zgodne z
kolejnością programu: „mechanika najpierw, wygląd (Vegas) potem". Poniżej jasny podział, żebyś
wiedział czego szukać wzrokiem, a co odbierasz na zaufanie do dowodu.

| Pozycja | Ma ekran do obejrzenia? | Gdzie |
|---|---|---|
| T5 — Raport DRD (O1.4/O1.5) | **TAK** | `docs/qa/deliverables/runs/DRD-REPORT-SAMPLE.html` — otwórz wprost w przeglądarce |
| O2.2 — Raporty SIRI/ADMA z wnioskami | Częściowo (komponent zamontowany, live URL wymaga zalogowanej sesji na demo — poproś mnie o zrzut) | `src/components/assessment/reports/templates/SIRIReportTemplate.tsx` + `ReportEditor.tsx` |
| O2.5 — Slajd „Wnioski" w decku | Tak, ale **flaga OFF domyślnie** (`ENABLE_DECK_CONCLUSION_SLIDE`) — do obejrzenia poproś o zrzut za flagą, zgodnie z zasadą „wygląd tylko za flagą do akceptu" | generator decków |
| O4 — Finanse (business case, scenariusze, WACC) | Częściowo — `ReconciliationPanel` i sekcja raportu finansowego istnieją jako UI, reszta to dane w API | Finance Hub |
| T1-T4 — Assessment → Inicjatywy (wszystkie 3 metodyki) | **NIE** — to czysta mechanika bazy danych/serwisu, bez dedykowanego ekranu „obejrzyj co powstało" (inicjatywy widać potem normalnie w module Initiatives) | — |
| T6 — Mechanika assessmentu SIRI/ADMA | **NIE bezpośrednio** — dowód działa na poziomie API; sam ekran wypełniania assessmentu istnieje w apce, ale to osobna, już wcześniej odebrana pozycja (H3.3 DRD ma dowód wizualny z 07-13) | — |
| O3 — 19 narzędzi (q-banki, drabinki pytań) | Tak, w module Discovery/Tools — ale to nie jest przedmiotem TEJ sesji (promptbook skupia się na O1); odbiór wizualny 19 narzędzi to osobna, krótsza sesja po zaakceptowaniu wzorca SWOT | Discovery |
| O5/O6/O7/O8 | Głównie NIE — to prompty, benchmarki, walidatory, help content: działają „pod maską" innych ekranów | — |

**Dlaczego tak mało ekranów w Oxfordzie:** to zgodne z regułą #7 — nic wizualnie niedojrzałe nie
trafia przed Twoje oczy bez wcześniejszego renderu i zrzutu przeze mnie. Oxford dowozi mechanikę
teraz; „ładny" (Vegas) rollout artefaktów i list to osobny, już częściowo ukończony program
równoległy — Oxford nie czeka na niego, żeby być uznanym za kompetentny.

---

## 5. Checklist sesji

**Czas: ~2-3h.** Kolejność zaprojektowana tak, żeby najpierw przejść przez to, co odblokowuje
najwięcej pozycji naraz (promptbook + kanon), potem szybkie decyzje, na końcu subiektywna ocena
tonu.

| # | Krok | Co robisz | Ile czasu | Odblokowuje |
|---|---|---|---|---|
| 1 | Przeczytaj sekcję 1 (promptbook) | Czytanie + jedno otwarcie pliku HTML (T5) w przeglądarce | ~30 min | Rozumienie co Oxford właściwie robi |
| 2 | Obejrzyj log dowodów T1-T4, T6 (dostarczę przed sesją) | Czytanie logów testów (ja je uruchamiam i wklejam) — sprawdzasz czy kryteria „dobre/złe" z sekcji 1 są spełnione | ~20 min | O1: 24 pozycje → w większości ✅ |
| 3 | Oceń próbkę DRD Report (T5) | Otwórz HTML, przeczytaj 2-3 rozdziały, sprawdź benchmark+zastrzeżenie | ~15 min | O1.4/O1.5, częściowo O6.1 |
| 4 | Podejmij decyzje K1 (P1-P5, DRD Kanon) | Zaznacz ☐ przy każdym z 5 pytań w sekcji 3 (rekomendacje już wpisane — możesz po prostu potwierdzić) | ~20 min | K1 → kanon DRD formalnie zamknięty |
| 5 | Podejmij pozostałe decyzje (K3-K7 + O7.1/K2 odnotowanie) | Zaznacz ☐ przy każdej | ~30 min | ~6 pozycji 🔵 → zamknięte z decyzją |
| 6 | Przejrzyj tabele O2/O4/O5/O6/O7/O8 (sekcja 2) | Skanuj — większość to „zaufaj dowodowi, potwierdź formalnie"; zatrzymaj się tylko przy wierszach z „Decyzja" | ~30 min | ~35-40 pozycji 🟡→✅ |
| 7 | O7.3 — ton języka | Przeczytaj 2-3 fragmenty tekstu z próbki DRD (już otwartej w kroku 3) + jeśli chcesz, poproszę o dodatkowy fragment z innego modułu; powiedz „brzmi jak partner firmy doradczej" czy nie | ~15 min | O7.3 (jedyna pozycja wymagająca Twojego oka, nie logu) |
| 8 | Podpis / zamknięcie sesji | Krótkie podsumowanie: ile pozycji zamkniętych, co zostaje otwarte na SESJĘ #2 | ~10 min | Aktualizacja `_REJESTR_DOKONCZENIA.md` (robię ja, po sesji) |

**Co wymaga Twojego kliknięcia/pisania:** kroki 4, 5, 7 (zaznaczenia ☐ i jedno zdanie oceny tonu).
**Co czytasz/oglądasz:** kroki 1, 2, 3, 6. Reszta (uruchamianie testów, zbieranie logów, otwieranie
HTML) robię ja przed i w trakcie sesji.

**Po sesji:** aktualizuję `_REJESTR_DOKONCZENIA.md` (liczniki + wiersze), commituję na `demo`,
przygotowuję materiał na SESJĘ #2 (ENFORCE/SPRZĄT/OPS).
