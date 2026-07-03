# DRD REPORT SPEC — specyfikacja raportu klienckiego Digital Readiness Diagnostic

> **Status:** v1.0 · **Data:** 2026-07-02 · **Autor:** Claude (CTO)
> **Podstawa merytoryczna:** `docs/product/DRD_CANON.md` (kanon v1.0, MAP-1.0) — wszystkie definicje wymiarów, poziomów, wzorów i progów pochodzą STAMTĄD. Ten dokument definiuje wyłącznie: strukturę raportu, źródła danych per sekcja, reguły generowania treści (prompt-ready) i wymogi wizualne.
> **Standard jakości (miara nadrzędna):** dokument, który właściciel firmy konsultingowej podpisałby własnym nazwiskiem przed zarządem klienta. Raport **wnioskowy, nie opisowy** — każda sekcja przechodzi test: *co jest → co to znaczy → co robić najpierw → jaki efekt*.

---

## 0. Zasady generowania (obowiązują każdą sekcję)

1. **Liczby wyłącznie z silnika.** Każda wartość liczbowa (wyniki, procenty, gapy, rankingi) jest policzona deterministycznie wg wzorów kanonu §6–§7 i podana do LLM jako fakt. LLM nigdy nie liczy i nigdy nie wymyśla liczb.
2. **Grounding zamknięty.** Kontekst generacji = (a) dane sesji (achieved/target/evidence/notatki per obszar), (b) kanon DRD (opisy poziomów, ścieżki N→N+1, graf fundamentów), (c) profil organizacji (branża, wielkość, zakres badania), (d) profil referencyjny. **Nic spoza tego zbioru.** Zakaz przywoływania „badań branżowych", statystyk i cytatów, których nie ma we wsadzie.
3. **Zakaz wymyślania dowodów.** Jeśli obszar ma status „declared" (bez dowodu), tekst mówi o tym wprost („wg deklaracji zespołu, do potwierdzenia"). Raport, który udaje pewność, jest gorszy niż raport, który nazywa niepewność.
4. **Język wniosków.** Struktura zdań rekomendacyjnych: obserwacja → konsekwencja biznesowa → działanie → oczekiwany efekt. Zakaz pustych fraz („należy rozważyć", „warto zwrócić uwagę"). Każda rekomendacja ma adresata (rola) i horyzont.
5. **Dwujęzyczność:** raport generowany w PL lub EN z tego samego SoT; terminologia wymiarów/poziomów wyłącznie z kanonu (tabele §3.2 i §4.1).
6. **Progi publikacji:** `completeness ≥ 80%` → raport pełny; poniżej → wariant „Diagnoza wstępna" (ta sama struktura, okładka i summary jawnie oznaczone, sekcja S6 bez zobowiązań liczbowych).

**Kontrakt danych wejściowych (jedno wejście dla raportu i decku):**

```
DRDReportInput {
  org:        { name, industrySegment, sizeBand, scope, participants[], assessor }
  session:    { date, canonVersion, mapVersion,
                areas: { [areaId]: { achieved, target, confidence: evidence|declared,
                                     evidence[], notes } } }
  engine:     { dimensionScores[8] (S, poziom I–V, gap, confidence%),
                overall (S, poziom, completeness, confidence),
                topGaps[] (ranking wg Priority — kanon §7.1),
                prerequisites[] (z grafu fundamentów §7.3),
                waves { F1[], F2[], F3[] } }
  benchmark:  { profileId, values[8], source: expert|statistical, n? }
  initiatives?: powiązane inicjatywy z platformy (link-by-ref)
}
```

---

## 1. Struktura raportu — przegląd

| # | Sekcja | Objętość (PDF) | Charakter |
|---|---|---|---|
| S1 | Okładka + metryka badania | 1 str. | dane |
| S2 | Streszczenie zarządcze (wnioskowe) | 1–2 str. | AI + silnik |
| S3 | Profil dojrzałości — radar 8D | 1 str. | wizualizacja |
| S4 | Macierz obszar × poziom (39 obszarów) | 2 str. | wizualizacja |
| S5 | Top-3 luki z uzasadnieniem biznesowym | 3 str. (1/luka) | AI + silnik |
| S6 | Roadmapa transformacji (impact × effort → fale) | 2 str. | AI + silnik |
| S7 | Wyniki szczegółowe per wymiar (D1–D8) | 8 × 1–2 str. | AI + silnik |
| S8 | Załącznik metodyczny | 2–3 str. | statyczny z kanonu |

Całość: ~25–30 stron. Deck zarządczy (10–12 slajdów) = S2+S3+S5+S6 z tego samego wsadu — osobny format, ten sam SoT.

---

## 2. Specyfikacja sekcji

### S1 — Okładka + metryka badania

**Skąd dane:** `org`, `session` (deterministycznie, bez AI).

**Zawartość:** tytuł („Diagnoza Gotowości Cyfrowej — {org.name}"), branding wg decyzji P4 kanonu, data, zakres badania, uczestnicy i prowadzący, oraz **metryka wiarygodności** — element podpisu własnym nazwiskiem:

```
Kompletność badania:  {completeness}% (ocenione {n}/39 obszarów)
Pokrycie dowodowe:    {confidence}% poziomów potwierdzonych artefaktami
Wersja metodyki:      DRD Canon {canonVersion} · MAP {mapVersion}
```

**Wizualnie:** pełnostronicowa okładka klasy wydawniczej: dużo światła, jeden akcent graficzny (miniatura radaru jako znak wodny), typografia serif/sans z systemu (§3). Metryka badania jako dyskretny blok na dole — nie chowamy jej.

---

### S2 — Streszczenie zarządcze (wnioskowe)

**Skąd dane:** `engine.overall`, `engine.dimensionScores`, `engine.topGaps[0..2]`, `benchmark`, nazwy poziomów z kanonu §4.1.

**Struktura wymuszona (szkielet promptu):**

```
Wygeneruj streszczenie zarządcze diagnozy DRD. Dokładnie 5 akapitów, razem ≤ 350 słów:

1. STAN (2–3 zdania): na jakim poziomie (I–V, nazwą kanoniczną) jest organizacja ogólnie
   i gdzie jest najsilniejsza/najsłabsza. Użyj wyłącznie podanych wyników: {dimensionScores}.
2. CO TO ZNACZY (2–3 zdania): konsekwencja biznesowa tego profilu dla firmy z segmentu
   {industrySegment} na tle profilu referencyjnego {benchmark.values} — gdzie firma
   odstaje w dół/górę i czym to grozi/co umożliwia.
3. TRZY LUKI (3 zdania, po jednym na lukę): {topGaps[0..2]} — nazwa luki + skutek
   biznesowy zaniechania, bez szczegółów technicznych.
4. CO NAJPIERW (2–3 zdania): nadrzędna rekomendacja Fali 1 z {waves.F1} + dlaczego ta
   kolejność (jeśli w {prerequisites} jest zależność — nazwij ją wprost).
5. EFEKT (1–2 zdania): co zmieni się w horyzoncie 12 mies. po wykonaniu Fali 1 — opisz
   przejście poziomów (np. „z poziomu wyspowego do zintegrowanego w D4 i D1"),
   bez obiecywania kwot, których nie ma we wsadzie.

Zakazy: żadnych liczb spoza wsadu; żadnych ogólników („dynamiczny rozwój technologii");
żadnego streszczania metodyki. Ton: partner firmy doradczej mówiący do zarządu.
```

**Wizualnie:** jedna kolumna tekstu + pasek boczny z 4 kafelkami KPI (wynik ogólny %, poziom I–V słownie, pozycja vs benchmark strzałką, liczba luk krytycznych). Pull-quote z rekomendacją nadrzędną.

---

### S3 — Profil dojrzałości: radar 8D (signature visual DRD)

**Skąd dane:** `engine.dimensionScores` (current, target), `benchmark.values` — trzy serie, wartości znormalizowane 0–100% (kanon §6.1; nigdy surowe poziomy różnych skal na jednym radarze).

**Reguły treści:** pod radarem tabela 8 wierszy: wymiar · wynik % · poziom I–V · target · benchmark · delta. Jedno zdanie interpretacji per wymiar (AI, ≤15 słów, wzór: „{Wymiar}: {stan-syntetycznie} — {co to znaczy}"). Adnotacja źródła benchmarku (ekspercki/statystyczny, n) — obowiązkowa (kanon §8.1).

**Wizualnie:** radar = znak firmowy raportu DRD: 8 osi w kolejności D1→D8, paleta spokojna blue/teal/slate (jak `drdVizAdapter`, **zakaz crimson**), wypełnienie current półprzezroczyste, target linią przerywaną, benchmark cienką linią neutralną. Etykiety pełnymi nazwami PL/EN, nie skrótami. Render SVG (ostry w druku), min. 140 mm szerokości na A4.

---

### S4 — Macierz obszar × poziom (mapa 39 obszarów)

**Skąd dane:** `session.areas` + struktura kanonu §2.3 (deterministycznie, bez AI).

**Reguły treści:** 7 grup osi; wiersz = obszar; komórki = szczeble drabiny natywnej (5/6/7). Kodowanie: osiągnięte (wypełnione), target (obrys), luka (pole między nimi delikatnie zakreskowane). Status dowodowy: obszary „declared" oznaczone symbolem (np. ◌) z legendą „wg deklaracji — do potwierdzenia"; nieocenione — wyszarzone „nie badano". Obok każdego wiersza gap liczbowo.

**Wizualnie:** to sekcja „gęsta" — dyscyplina siatki: jedna strona na osie 1–4, druga na 5–7; nazwy poziomów drabiny w nagłówku grupy (np. dla osi 1: Rejestracja → Stanowiska → Proces → Automatyzacja → MES → ERP → AI). Heatmapa w jednej rodzinie barw (teal), intensywność = poziom; czerwieni używamy wyłącznie jako mikro-akcentu luk krytycznych (top-3), nigdzie indziej.

---

### S5 — Top-3 luki z uzasadnieniem biznesowym (1 strona / luka)

**Skąd dane:** `engine.topGaps[0..2]` (ranking Priority — kanon §7.1, deterministyczny), per luka: obszary składowe, poziomy current/target, opisy poziomów i ścieżka N→N+1 z kanonu §4–§5, `prerequisites`.

**Struktura wymuszona per luka (szkielet promptu):**

```
Dla luki {gap.name} (wymiar {dimension}, poziom {current} → target {target}) napisz
kartę luki. Sekcje, dokładnie w tej kolejności:

CO JEST (≤60 słów): stan faktyczny językiem behawioralnym z kanonu poziomu {current},
  skonkretyzowany dowodami z sesji: {evidence, notes}. Jeśli confidence=declared — zaznacz.
CO TO ZNACZY (≤80 słów): konsekwencja biznesowa utrzymania stanu — przez pryzmat
  segmentu {industrySegment} i zależności {prerequisites} (np. „blokuje plany AI").
  Nazwij ryzyko/koszt zaniechania jakościowo; kwoty tylko jeśli są w notatkach sesji.
CO ROBIĆ NAJPIERW (3–5 punktów): konkretne kroki ze ścieżki N→N+1 kanonu §5 dla tego
  wymiaru, dobrane do luk obszarów składowych; każdy punkt = czasownik + artefakt
  + rola odpowiedzialna.
JAKI EFEKT (≤50 słów): obserwowalna zmiana po domknięciu (co będzie widać w firmie,
  jaki poziom zostanie osiągnięty, co to odblokowuje wg grafu fundamentów).
```

**Reguły selekcji (silnik, nie AI):** top-3 wg Priority; maks. 2 luki z jednego wymiaru; jeśli w top-3 nie ma żadnego fundamentu (Foundation=1) a fundamenty mają gap > 0 — trzecia pozycja jest zastępowana najwyższym fundamentem (raport nie może rekomendować dachu przed fundamentem).

**Wizualnie:** karta lukowa = powtarzalny layout: nagłówek z wymiarem i przejściem poziomów (np. „II → IV"), mini-drabina poziomów z zaznaczonym skokiem, cztery bloki treści w stałym rytmie, pasek „odblokowuje: {wymiary}" na dole.

---

### S6 — Roadmapa transformacji (impact × effort → fale)

**Skąd dane:** `engine.topGaps` (pełny ranking), `engine.waves` (F1/F2/F3 wg kanonu §7.2), BizImpact/Effort per pozycja, `prerequisites`, opcjonalnie `initiatives` (link-by-ref do platformy).

**Reguły treści:**
- **Macierz impact×effort (silnik):** wszystkie luki z gap > 0 jako punkty; ćwiartki nazwane: „Zacznij tutaj" (wysoki impact/niski effort), „Zaplanuj" (wysoki/wysoki), „Przy okazji" (niski/niski), „Odłóż" (niski/wysoki).
- **Fale F1/F2/F3 (silnik + AI):** per fala lista pozycji: nazwa działania (z kroków §5 kanonu) · wymiar · efekt (przejście poziomu) · rola odpowiedzialna · zależności. AI generuje wyłącznie jednozdaniowe opisy działań i zdanie otwierające falę („Cel fali: …"); skład i kolejność fal są z silnika.
- Jeśli platforma ma powiązane inicjatywy — pozycje roadmapy linkują do nich po ID (spójność raport ↔ moduł Inicjatywy).

**Wizualnie:** rozkładówka: lewa strona macierz (scatter, punkty kolorem wymiaru — paleta radaru; etykiety bez nakładania), prawa strona oś czasu 0–6–18–36 mies. z falami jako pasmami; strzałki zależności między pozycjami (graf fundamentów). Maks. 12 pozycji na osi czasu — reszta w tabeli zbiorczej pod spodem.

---

### S7 — Wyniki szczegółowe per wymiar (D1–D8, rozdział na wymiar)

**Skąd dane:** per wymiar: obszary składowe z `session.areas`, wynik/poziom/gap z silnika, opisy behawioralne poziomów (kanon §4.2), ścieżka N→N+1 (kanon §5), benchmark wymiaru.

**Struktura rozdziału (stała):**
1. **Nagłówek-werdykt** (AI, 1 zdanie ≤20 słów): syntetyczna ocena wymiaru — wniosek, nie opis (zły: „Wymiar obejmuje 5 obszarów"; dobry: „Dane są zbierane nowocześnie, ale utykają w silosach — analityka nie ma na czym pracować").
2. **Pasek wyniku:** % + poziom I–V + benchmark + target.
3. **Tabela obszarów:** obszar · poziom natywny osiągnięty/target · status dowodu · najkrótszy komentarz z notatek sesji.
4. **Stan behawioralny** (AI, ≤100 słów): opis poziomu z kanonu §4.2 doprecyzowany faktami z evidence/notes — co konkretnie widzieliśmy u klienta.
5. **Ścieżka wyżej** (AI z kanonu §5, 3–4 punkty): kroki przejścia na poziom target, z ról i artefaktów.
6. **Powiązania:** czego ten wymiar wymaga / co odblokowuje (graf §7.3) — generowane deterministycznie.

**Wizualnie:** stały szablon rozdziału; mini-radar z podświetlonym wymiarem jako element nawigacji; drabina poziomów wymiaru z zaznaczonym „jesteś tu / cel". Kolor przewodni rozdziału = kolor wymiaru z palety radaru.

---

### S8 — Załącznik metodyczny

**Skąd dane:** statycznie z kanonu (§1–§4, §6, §8) — bez AI, wersjonowane razem z kanonem.

**Zawartość:** czym jest DRD i czyją jest metodyką (branding wg P4); dwie warstwy 39/8 i mapowanie MAP-1.0 (tabela); skala I–V z mapowaniem drabin natywnych; wzory scoringu i progi (jawne — klient ma prawo policzyć nas samodzielnie); zasady dowodowe i statusy confidence; źródło benchmarku z adnotacją; słownik pojęć; nota o wersji kanonu i zasadach porównań rok-do-roku.

**Wizualnie:** typografia „dokumentacyjna" (mniejszy stopień, dwie kolumny), tabele z kanonu 1:1.

---

## 3. Warstwa wizualna — wymogi przekrojowe

**Technologia:** wolna — rekomendacja: **HTML+CSS (paged media) → PDF klasy wydawniczej** (ten sam HTML = podgląd w aplikacji i druk); wykresy SVG generowane z danych silnika (zero screenshotów, zero rastrów poza logo). Deck PPTX z tego samego wsadu przez istniejący pipeline Materiałów (M17).

**System graficzny (spójny z Artifact Anatomy Standard i paletą `drdVizAdapter`):**
- Paleta danych: blue/teal/slate (D1–D8 wg kolejności adaptera); **crimson zakazany** w danych i statusach; czerwień wyłącznie jako mikro-akcent luk krytycznych w S4/S5.
- Format A4 portrait; marginesy lustrzane min. 18/22 mm; siatka 12-kolumnowa; paginacja + żywa pagina z nazwą sekcji; spis treści generowany.
- Typografia: 2 kroje (nagłówkowy + tekstowy), skala modularna; liczby w tabelach tabelarycznie (tnum).
- Każdy wykres: tytuł-wniosek (nie „Wykres 3"), źródło danych, legenda; etykiety osi pełnymi słowami.
- Tryb „Diagnoza wstępna" (completeness < 80%): pasek statusu na każdej stronie nagłówka sekcji.
- Dostępność druku: raport musi być czytelny w druku mono (kodowanie luk nie może polegać wyłącznie na kolorze — dublować kreskowaniem/symbolem).

**DoD wizualny:** odbiór na wydruku i na ekranie; test „wyrwanej strony" — każda strona zrozumiała bez sąsiednich (nagłówek-werdykt + kontekst na każdej); zero sierot/wdów w nagłówkach; wykresy ostre w 300 dpi.

---

## 4. QA i Definition of Done raportu

1. **Zgodność liczb:** każda liczba w PDF == wynik silnika (test automatyczny na wsadzie referencyjnym).
2. **Test wnioskowości:** próbka sekcji S2/S5/S7 przechodzi review wg checklisty: czy jest „co jest→co znaczy→co robić→jaki efekt"; czy każda rekomendacja ma rolę i horyzont; czy nie ma fraz-wydmuszek.
3. **Test dowodowy:** żaden fragment nie twierdzi więcej, niż mówi status confidence obszaru.
4. **Test fundamentów:** roadmapa nie rekomenduje działania z niespełnionym prerequisite z grafu §7.3.
5. **Odbiór wizualny Piotra** na realnych danych demo (pełny PDF + deck), nie na lorem ipsum.
6. **Parytet z SIRI/ADMA:** DRD po wdrożeniu tej specyfikacji ma ≥ ich zakres (report + mapa + deck + inicjatywy) — flagowiec nie może być gorszy od frameworków gościnnych.
