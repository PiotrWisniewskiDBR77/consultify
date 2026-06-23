# VTS GOLDEN — 3 scenariusze head-to-head (deck / doc / table)

> **Cel**: złoty zestaw testowy do porównania jakości naszych generatorów
> deliverable z **Gamma** (deck), **Kimi-Claude** (doc) i **Airtable** (table)
> na JEDNYM, realnym temacie DBR77.
>
> **Temat złoty (wybór Piotra)**: **diagnoza gotowości na AI w VTS Group** —
> rzeczywiste zlecenie DBR77 (VTS Group S.A., producent HVAC, ekspansja USA + Data
> Centers; pełnozałogowa ankieta-diagnoza ~131 osób, szablony PL/EN w 2 blokach,
> findings → rekomendacje). Por. `docs/handoff/VTS_WAVE2_HANDOFF.md`.
>
> **Bramka jakości (decyzja Q1)**: ≥85% kryteriów spełnione dla **WSZYSTKICH
> trzech** formatów. Poniżej każdy scenariusz ma własną listę ACCEPTANCE, której
> ≥85% musi przejść.
>
> **Konwencja**: proza i treść po polsku; klucze pól / typy / nazwy layoutów po
> angielsku (zgodnie z M18/M19/M20). Vocabulary layoutów: 17 SlideIntent
> (`presentationLayoutDirectorService.ts`). Block types:
> `documentStudioTypes.ts`. Field types: Table Platform.
>
> **UWAGA DANE**: wszystkie liczby (% gotowości, liczby respondentów, daty,
> budżety) są **ILUSTRACYJNE** — wiarygodne, ale wymyślone na potrzeby testu.
> NIE są to poufne dane klienta. Realne karty wave-2 (10 insightów / 15
> inicjatyw) żyją na prod (`vts_w2_*`) i NIE są tu kopiowane.

---

## Kontekst wspólny (feed do wszystkich generatorów)

```
client:    "VTS Group S.A."
project:   "Diagnoza gotowości na AI — wave 2"
language:  PL (primary), EN dostępne (ankieta 2-blokowa PL/EN)
scope:     ~131 pracowników, 8 działów, ankieta general + process
horizon:   transformacja 24 mies. (model 5-etapowy)
source:    findings z ankiety → rekomendacje → portfel inicjatyw
```

Działy w grze (illustrative): **Produkcja, R&D, Sprzedaż, Marketing, IT,
Finanse, HR, Logistyka**.

---

# 1) BOARD-DECK — prezentacja zarządcza wyników diagnozy (B1 Layout Director)

### intent
> "Przygotuj prezentację zarządczą dla rady nadzorczej VTS Group S.A. podsumowującą wyniki diagnozy gotowości na AI z ankiety wave 2 (~131 pracowników, 8 działów): streszczenie wykonawcze, metodyka badania, kluczowe wyniki z indeksem gotowości, rozbicie na działy, główne bariery wdrożenia AI, rekomendowany portfel inicjatyw, roadmapa 24-miesięczna w modelu 5-etapowym, ryzyka oraz następne kroki — ton formalny, paleta neutralna (harvard/slate), 10–12 slajdów."

### context
```
lang=PL, client="VTS Group S.A.", project="AI readiness diagnostic — wave 2",
template="board", audience="rada nadzorcza + zarząd"
```

### Proponowana lista slajdów (11 slajdów)

| # | intent (SlideIntent) | tytuł | key_message |
|---|---|---|---|
| 1 | `cover` | Diagnoza gotowości na AI — VTS Group S.A. | Wyniki ankiety wave 2: 131 pracowników, 8 działów, droga do skalowania AI |
| 2 | `executive_summary` | Streszczenie wykonawcze | Średni indeks gotowości 58/100 — fundament jest, brakuje kompetencji i danych; 7 inicjatyw zwróci się w 24 mies. |
| 3 | `key_messages` | Trzy wnioski dla zarządu | (1) Apetyt na AI wysoki, (2) dane rozproszone i niespójne, (3) luka kompetencyjna w produkcji i logistyce |
| 4 | `assessment` | Metodyka badania | Ankieta 2-blokowa PL/EN (general + process), 131 zaproszeń, 87% zwrotu, indeks gotowości w 5 wymiarach |
| 5 | `performance_overview` | Indeks gotowości — obraz całościowy | 58/100 średnio; data 41, kompetencje 49, procesy 62, kultura 71, technologia 67 |
| 6 | `comparison` | Gotowość wg działów | R&D (74) i IT (71) ciągną w górę; Produkcja (44) i Logistyka (46) wymagają wsparcia |
| 7 | `root_cause` | Główne bariery wdrożenia | Brak spójnych danych (#1, 63% wskazań), luka kompetencyjna (#2), niejasny właściciel AI (#3) |
| 8 | `recommendation_portfolio` | Rekomendowany portfel inicjatyw | 7 inicjatyw w 3 falach: szybkie wygrane (data hub, akademia AI), enablery, skalowanie |
| 9 | `roadmap` | Roadmapa 24 mies. — model 5-etapowy | Etap 1 audyt danych → 2 pilotaże → 3 kompetencje → 4 skalowanie → 5 governance |
| 10 | `risk_management` | Ryzyka i mitygacje | 5 ryzyk: jakość danych, adopcja, regulacje AI Act, dług technologiczny, brak ownera — z planem mitygacji |
| 11 | `next_steps` | Następne kroki | Decyzja o budżecie Etapu 1, powołanie AI Owner, start audytu danych w 30 dni |

> Każdy slajd dostaje `imageBrief` (np. slajd 6: "stylizowana mapa działów fabryki HVAC z wskaźnikami gotowości, paleta harvard, bez tekstu"; slajd 9: "oś czasu 5 etapów, ikony bez ludzi, neutralne tło").

### ACCEPTANCE (deck) — bramka ≥85%
1. `slides.length` ∈ [10, 12].
2. `slides[0].intent === 'cover'` ORAZ tytuł cover zawiera **"VTS"**.
3. `slides[last].intent === 'next_steps'`.
4. **≥8 distinct SlideIntent** w decku (kanon ≥8 dla ≥8 slajdów).
5. Obecne: `executive_summary`, `roadmap`, `risk_management`, `recommendation_portfolio` (po ≥1).
6. Obecny ≥1 z {`performance_overview`,`assessment`} (metryki indeksu gotowości).
7. **Jedna paleta** dla całego decka, `paletteId` ∈ catalog13 (preferowane harvard/slate/midnight — ton board).
8. **0 naruszeń** reguły „no >2 consecutive identical layouts".
9. **imageBrief na KAŻDYM slajdzie** (nonempty ≥10 znaków).
10. `source === 'llm'` na wszystkich slajdach (premium aktywne, nie fallback).
11. Co najmniej jeden slajd wymienia z nazwy ≥3 działy (rozbicie działowe realne).

### vs Gamma — co porównujemy wizualnie
Ten sam intent wrzucamy do Gammy. Porównujemy: (a) **różnorodność layoutów** — czy Gamma daje 8+ realnie różnych układów czy wariacje jednego; (b) **spójność palety** — czy nasz „one palette/deck" wygląda bardziej zwarcie niż auto-theme Gammy; (c) **trafność image-briefów** vs auto-grafika Gammy (czy nie wstawia ludzi/stocku nie na temat); (d) czy slajd „gotowość wg działów" czyta się jako realna analiza, a nie ozdobnik.

---

# 2) DIAGNOSTIC REPORT — pełna diagnoza pisemna (B3 doc structure + content-gen)

### intent
> "Napisz pełny raport diagnostyczny gotowości na AI dla VTS Group S.A. na podstawie ankiety wave 2 (~131 pracowników, 8 działów, blok general + process, PL/EN): streszczenie wykonawcze z indeksem gotowości, kontekst i cele, metodyka badania, kluczowe wyniki z rozbiciem na 5 wymiarów i 8 działów, główne bariery, rekomendacje uszeregowane wg priorytetu, roadmapa 24-miesięczna w 5 etapach oraz rejestr ryzyk z mitygacją — z paskiem KPI, ostrzeżeniami w ramkach, tabelą porównawczą działów i wykresem trendu gotowości."

### context
```
lang=PL, client="VTS Group S.A.", project="AI readiness diagnostic — wave 2",
audience="zarząd + liderzy działów", format="A4 portrait"
```

### Outline sekcji (8 sekcji) z `purpose` (steruje blokami)

| # | sekcja | purpose (steruje bogatymi blokami) |
|---|---|---|
| 1 | **Streszczenie wykonawcze** | Otwórz `kpi_strip` z 4 metrykami całego badania (zwrot ankiety 87%, średni indeks 58/100, liczba inicjatyw 7, horyzont 24 mies.), potem 2 paragrafy wniosku. → wymusza **kpi** + **text**. |
| 2 | **Kontekst i cele diagnozy** | Proza: po co badanie, ekspansja USA + Data Centers jako tło, czego oczekuje zarząd. 1 `callout` z zakresem („co jest, a co NIE jest celem tego badania"). → **text** + **callout**. |
| 3 | **Metodyka badania** | Opisz ankietę 2-blokową PL/EN (general + process), próbę 131, kanał magic-link, 5 wymiarów indeksu; `bullet_list` z wymiarami. 1 `callout` (limitacja: samoocena, nie audyt techniczny). → **bulletList** + **callout**. |
| 4 | **Kluczowe wyniki — indeks gotowości** | `chart` (line/bar) trendu/rozkładu gotowości po 5 wymiarach; proza interpretacji. → **chart** + **text**. |
| 5 | **Gotowość wg działów** | `table` porównawcza 8 działów (dział, respondenci, indeks, najsłabszy wymiar) + proza o rozwarstwieniu. → **table** + **text**. |
| 6 | **Główne bariery wdrożenia** | Proza + `callout` ostrzegawczy o ryzyku jakości danych (#1 bariera). → **text** + **callout** (drugi callout typu warning). |
| 7 | **Rekomendacje** | `bullet_list` (lub numbered) 7 rekomendacji uszeregowanych wg priorytetu, każda z właścicielem i horyzontem. → **bulletList**. |
| 8 | **Roadmapa i ryzyka** | Proza roadmapy 5-etapowej + `table` rejestru ryzyk (ryzyko, prawdopodobieństwo, wpływ, mitygacja, właściciel). → **text** + **table**. |

### ACCEPTANCE (doc) — bramka ≥85%
1. `sections.length` ∈ [7, 9].
2. **≥5 distinct block types** w całym dokumencie.
3. **≥1 `kpi`** (kpi_strip) z 3–5 itemami, każdy {label, value, delta/jednostka}.
4. **≥2 `callout`** (zakres w sek. 2 + warning o danych w sek. 6).
5. **≥1 `table`** (gotowość wg działów LUB rejestr ryzyk — idealnie obie).
6. **≥1 `bulletList`** (rekomendacje LUB wymiary metodyki).
7. **≥1 `chart`** (rozkład/trend indeksu gotowości).
8. Każda sekcja ma `heading` (H2) — dokument >1 strona.
9. Sek. 1 (streszczenie) wymienia średni indeks gotowości jako liczbę.
10. `citations[]` / `source_refs[]` osobno od prozy (źródło = ankieta wave 2), nie wplecione w akapit.
11. Sek. 5 tabela ma wiersz dla ≥6 z 8 działów.

### vs Kimi-Claude — co porównujemy wizualnie
Ten sam intent → Kimi-Claude (Claude w trybie pisania długich dokumentów). Porównujemy: (a) **bogactwo bloków** — czy konkurent daje ścianę prozy, czy realnie wstawia KPI-strip / tabelę / wykres / callout jak my; (b) **strukturę** — czy 7–9 sekcji jest logicznych i niepowtarzalnych; (c) **trafność warningów** (callout o jakości danych — czy konkurent w ogóle sygnalizuje ryzyko); (d) **typografię A4** (hierarchia H1→body, measure 50–75ch) vs surowy markdown konkurenta; (e) czy rekomendacje mają właściciela + horyzont (actionability), a nie ogólniki.

---

# 3) RESULTS TABLE — tracker wyników diagnozy / inicjatyw (B4 table schema generator)

### intent
> "Wygeneruj tabelę śledzącą wyniki diagnozy gotowości na AI w VTS Group wave 2 w rozbiciu na działy: dział, liczba respondentów, frekwencja, indeks gotowości (0–100), najsłabszy wymiar, główna bariera, priorytet działania, właściciel inicjatywy, termin docelowy oraz status — z kolorowaniem warunkowym indeksu gotowości i priorytetu, oraz przykładowymi danymi dla 8 działów."

### context
```
lang=PL, client="VTS Group S.A.", project="AI readiness diagnostic — wave 2",
view="department readiness tracker"
```

### Pola (fields) z typami

| key (EN) | label (PL) | type | uwagi / opcje |
|---|---|---|---|
| `department` | Dział | `singleSelect` | Produkcja, R&D, Sprzedaż, Marketing, IT, Finanse, HR, Logistyka — każda z hex |
| `respondents` | Respondenci | `number` | numberFormat `#,##0` |
| `response_rate` | Frekwencja | `percent` | numberFormat `0%` |
| `readiness_score` | Indeks gotowości | `number` | 0–100; **kandydat na conditional formatting** (colorScale czerwony→amber→zielony) |
| `weakest_dimension` | Najsłabszy wymiar | `singleSelect` | Dane, Kompetencje, Procesy, Kultura, Technologia |
| `top_barrier` | Główna bariera | `singleLineText` | krótki opis |
| `priority` | Priorytet | `singleSelect` | Wysoki (#DC2626), Średni (#D97706), Niski (#16A34A) — **kandydat CF** |
| `owner` | Właściciel | `singleLineText` | rola/funkcja (nie e-mail/telefon) |
| `target_date` | Termin docelowy | `date` | numberFormat `YYYY-MM-DD` |
| `confidence` | Pewność danych | `rating` | 1–5 (jakość/kompletność odpowiedzi) |
| `status` | Status | `singleSelect` | Do startu (neutral), W toku (amber), Zrobione (green), Zablokowane (red) |

> Brak pól `email`/`phone` — zgodnie z wymogiem PII-free dla tego scenariusza.

### Seed rows (8 wierszy — ILUSTRACYJNE)

| Dział | Respondenci | Frekwencja | Indeks | Najsłabszy wymiar | Główna bariera | Priorytet | Właściciel | Termin | Pewność | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Produkcja | 38 | 82% | 44 | Kompetencje | Luka umiejętności na hali | Wysoki | Dyr. Produkcji | 2026-09-30 | 4 | W toku |
| R&D | 14 | 100% | 74 | Procesy | Brak standardu eksperymentów | Niski | Head of R&D | 2026-12-31 | 5 | Do startu |
| Sprzedaż | 22 | 86% | 57 | Dane | Rozproszony CRM | Średni | Dyr. Sprzedaży | 2026-10-31 | 3 | W toku |
| Marketing | 9 | 89% | 61 | Technologia | Brak narzędzi GenAI | Średni | Lider Marketingu | 2026-11-15 | 4 | Do startu |
| IT | 11 | 91% | 71 | Kultura | Postawa „AI to ryzyko" | Niski | CTO | 2027-01-31 | 5 | Do startu |
| Finanse | 12 | 83% | 53 | Dane | Niespójne źródła raportów | Wysoki | CFO | 2026-09-30 | 3 | Zablokowane |
| HR | 8 | 100% | 66 | Procesy | Ręczne procesy rekrutacji | Średni | Dyr. HR | 2026-11-30 | 4 | W toku |
| Logistyka | 17 | 76% | 46 | Dane | Brak danych w czasie rzecz. | Wysoki | Dyr. Logistyki | 2026-10-15 | 2 | Do startu |

### ACCEPTANCE (table) — bramka ≥85%
1. `fields.length` ≥ 6 (tu 11).
2. **≥1 `singleSelect`** z hex colorem na KAŻDEJ opcji (department/priority/status/weakest_dimension).
3. **≥1 `number`** ORAZ **≥1 `percent`** (readiness_score/respondents + response_rate) z poprawnym numberFormat.
4. **≥1 `date`** z numberFormat `YYYY-MM-DD` (target_date).
5. **≥1 pole-kandydat na conditional formatting**: `readiness_score` (colorScale) LUB `priority`/`status` (cellIs/iconSet).
6. `priority` i `status` mają **semantyczne kolory** (wysoki/zablokowany=czerwony, średni/w toku=amber, niski/zrobione=zielony).
7. `seedRows.length` ≥ 6 (tu 8 — pełne pokrycie działów).
8. **0 pól PII** (`email`/`phone`) — zgodnie z intentem.
9. ≥1 pole `rating` (confidence) renderowane jako gwiazdki/skala 1–5.
10. Header row stylizowany (bold, white font, bgColor DBR77/`#4472C4`); freeze row 1.

### vs Airtable — co porównujemy wizualnie
Ten sam intent → Airtable. Porównujemy: (a) **trafność typowania** — czy Airtable samo rozpozna `percent`/`rating`/`date`, czy zostawi „single line text" do ręcznej poprawy; (b) **conditional formatting** — czy nasz colorScale na indeksie gotowości i kolory priorytetu wyglądają tak czytelnie jak ręcznie skonfigurowane reguły Airtable; (c) **kolory selectów** — czy semantyka (czerwony=wysokie ryzyko) jest spójna od razu; (d) **jakość seed-danych** — czy nasze przykładowe wiersze są wiarygodne i spójne (frekwencja×respondenci, indeks×najsłabszy wymiar), a nie losowe; (e) **eksport** — czy nasz WorkbookBuilder (ExcelJS) zachowa fills/numFmt/freeze przy XLSX (Airtable jako baseline).

---

## Podsumowanie golden-setu

- **3 scenariusze, 1 temat** (VTS AI-readiness wave 2) — bezpośrednio porównywalne z Gamma / Kimi-Claude / Airtable.
- Każdy ma: `intent` (PL), pełną strukturę (slajdy / sekcje / pola+seed), listę ACCEPTANCE z bramką **≥85%**, oraz notę „vs konkurent".
- Dane **ilustracyjne**, PII-free; realne karty wave-2 pozostają na prod (`vts_w2_*`).
- Mapowanie: deck → M19 (B1 Layout Director), doc → M18 (B3), table → M20 (B4).
