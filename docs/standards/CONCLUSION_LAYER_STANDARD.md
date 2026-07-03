# CONCLUSION LAYER STANDARD — warstwa wniosków (SSOT)

> **Status:** v1.0 · **Data:** 2026-07-02 · **Właściciel:** CTO · **Program:** OXFORD O2.1
> **Rodzeństwo:** `docs/standards/CARD_CONTENT_FORMULA.md` (karty wniosków/inicjatyw) ·
> `docs/initiatives/INITIATIVE_FORMULA.md` (doktryna inicjatyw) · `docs/product/DRD_REPORT_SPEC.md`
> (raport DRD — pierwsze pełne wdrożenie tego standardu).
>
> **Problem, który ten dokument zamyka:** wyniki w całej aplikacji (raporty assessmentów, outputy
> tooli, analizy finansowe, generowane dokumenty i decki) kończą się na „pokaż liczby" zamiast
> „powiedz, co znaczą i co robić". Liczby klient ma w Excelu za darmo — **płaci za wniosek**.
>
> **Miara nadrzędna:** każdy wynik przechodzi test „czy właściciel firmy doradczej (HBS, MBA,
> 10 lat praktyki) podpisałby to własnym nazwiskiem przed zarządem klienta". Nie „czy jest
> poprawny", tylko „czy jest podpisywany".
>
> **Zakres:** KAŻDA powierzchnia, która prezentuje wynik analityczny użytkownikowi lub klientowi.
> Generatory (AI) i renderery (UI/PDF/PPTX) egzekwują ten standard programowo — §4.

---

# §1. FORMUŁA KANONICZNA (4 kroki, obowiązkowe)

Każdy wniosek — od jednego zdania interpretacji wskaźnika po executive summary raportu — realizuje
tę sekwencję. Krok pominięty = wniosek NIEZALICZONY (wyjątki tylko wg wariantów §3).

| # | Krok | Co zawiera | Skąd pochodzi |
|---|---|---|---|
| **K1. CO JEST** | Fakt | Stan faktyczny: liczba, poziom, trend, obserwacja — z jawnym statusem dowodu (potwierdzone / deklarowane / brak danych) | **Silnik/dane — NIGDY z LLM.** Każda liczba policzona deterministycznie i podana do LLM jako fakt wejściowy |
| **K2. CO TO ZNACZY** | Interpretacja | Konsekwencja biznesowa faktu w kontekście organizacji: branża, wielkość, model biznesowy, benchmark, zależności. Czym stan grozi / co umożliwia | LLM na zamkniętym groundingu: (dane silnika + profil organizacji + kanon metodyki + benchmark). **Nic spoza wsadu** — zakaz „badań branżowych" i statystyk, których nie ma we wsadzie |
| **K3. CO ROBIĆ NAJPIERW I DLACZEGO** | Priorytet | **Maks. 3 akcje**, uszeregowane wg impact × effort (i prerequisites, jeśli metodyka ma graf zależności). Każda akcja = czasownik + artefakt/przedmiot + rola odpowiedzialna. Kolejność UZASADNIONA („najpierw X, bo blokuje Y") | Ranking z silnika tam, gdzie istnieje (priority score, graf fundamentów); LLM formułuje treść akcji, nie kolejność |
| **K4. JAKI EFEKT** | Rezultat | Oczekiwany, mierzalny lub obserwowalny rezultat wykonania K3 — **z horyzontem czasowym** (np. „w 6 mies.", „do końca Fali 1"). Bez kwot, których nie ma we wsadzie; jeśli efekt jest jakościowy — opisany behawioralnie („co będzie widać w firmie") | LLM z ograniczeniem: efekt musi wynikać z K3 i mieścić się w danych/kanonie |

**Zasada proporcji:** K2–K4 razem ≥ 50% objętości wniosku. Wynik, w którym K1 (liczby, tabele,
wykresy) dominuje, a K2–K4 to doklejone zdanie — jest opisem, nie wnioskiem, i nie przechodzi §5.

**Zasada answer-first (piramida Minto):** pierwszym zdaniem każdej jednostki wnioskowej jest
konkluzja (synteza K1+K2), nie wstęp, nie metodyka, nie „w niniejszej sekcji przedstawiono".

---

# §2. REGUŁY JAKOŚCI WNIOSKU (obowiązują każdy wariant)

## R1. Zakaz ogólników (automatyczny FAIL)
Frazy-wydmuszki dyskwalifikują wniosek: „poprawić komunikację", „zoptymalizować procesy",
„należy rozważyć", „warto zwrócić uwagę", „dynamiczny rozwój technologii", „w dzisiejszych
czasach", „kluczowe znaczenie ma". Test: **czy zdanie pasowałoby do dowolnej firmy na świecie?**
Jeśli tak — jest ogólnikiem. Wniosek musi zawierać konkret klienta: liczbę, rolę, proces, nazwę,
obszar.

## R2. Wymóg przyczynowości (wniosek → dowód)
Każda teza interpretacyjna (K2) wskazuje swój dowód: konkretną liczbę/obserwację z K1, wpis
z sesji, notatkę, benchmark. Łańcuch jest jawny: *„marża spada 3 kwartały z rzędu (K1) **→**
przy rosnących przychodach oznacza to erozję cenową lub wzrost kosztów jednostkowych, nie problem
popytu (K2)"*. Teza bez dowodu = hipoteza i MUSI być tak nazwana („hipoteza — do potwierdzenia
w …"), z niższym poziomem pewności. Zakaz udawania pewności: raport, który nazywa niepewność,
jest lepszy niż raport, który ją maskuje.

## R3. Wymóg rozróżnialności (falsyfikowalność)
Wniosek musi być **FAŁSZYWALNY**: gdyby dane były inne, wniosek brzmiałby inaczej. Test
rozróżnialności: *„czy przy przeciwnych danych napisalibyśmy to samo zdanie?"* Jeśli tak —
wniosek jest pusty. „Firma ma potencjał do poprawy" przechodzi przy KAŻDYCH danych = FAIL.
„Firma traci ~2 dni na każdym zleceniu na ręcznym przepisywaniu zamówień między systemami,
co przy 400 zleceniach/rok daje ~800 dni buforów" — fałszywalne (inne dane → inny wniosek) = PASS.
(Spójne z falsyfikowalną tezą inicjatywy „Jeśli X, to Y, bo Z" — INITIATIVE_FORMULA §2.)

## R4. Język konsultanta
- **Ton:** partner firmy doradczej mówiący do zarządu. Bezpośredni, rzeczowy, bez asekuracji
  i bez dramatyzowania. Twierdzenia w stronie czynnej („Dział X traci…", nie „można zaobserwować,
  że…"). Uczciwa niepewność nazwana wprost, nie rozmyta trybem przypuszczającym.
- **PL/EN:** wniosek generowany w języku dokumentu z tego samego wsadu (SoT). W PL obowiązuje
  słownik terminów nietłumaczonych z CARD_CONTENT_FORMULA §A5 (KPI, ROI, MECE, RACI, CAPEX/OPEX…);
  reszta prozy wyłącznie po polsku. Zakaz kalek („adresować problem", „dostarczać wartość").
- **Długości (domyślne, warianty §3 mogą zaostrzać):** interpretacja jednozdaniowa ≤ 20 słów;
  blok K1 ≤ 60 słów; K2 ≤ 80 słów; K3 = 3–5 punktów po ≤ 25 słów; K4 ≤ 50 słów;
  executive summary ≤ 350 słów. Krótszy wniosek z konkretem > dłuższy z watą.

## R5. Liczby wyłącznie z silnika (zasada twarda, przekrojowa)
Każda wartość liczbowa widoczna we wniosku (wynik, %, gap, ranking, kwota, prognoza) pochodzi
z deterministycznego silnika/danych źródłowych i jest przekazana do LLM jako fakt. **LLM nigdy
nie liczy i nigdy nie wymyśla liczb.** Brak liczby we wsadzie → wniosek jakościowy + „do
ustalenia (gdzie/kiedy)" — nigdy liczba zmyślona. Kwantyfikacja szacunkowa dozwolona TYLKO
z jawnym założeniem we wsadzie (wzór: CARD_CONTENT_FORMULA §A7).

## R6. Adresat i horyzont
Każda rekomendacja (K3) ma adresata (rolę — nie „organizacja powinna") i każdy efekt (K4)
ma horyzont. Rekomendacja bez właściciela i bez terminu to życzenie.

---

# §3. WARIANTY PER POWIERZCHNIA

Formuła §1 jest stała; zmienia się kształt i objętość. Pięć wariantów kanonicznych:

## W1. Raport assessmentu — executive summary 5-akapitowe
Spójnie z `docs/product/DRD_REPORT_SPEC.md` §S2 (DRD = implementacja referencyjna; SIRI/ADMA
i kolejne frameworki przejmują ten sam szkielet):

| Akapit | Krok formuły | Treść |
|---|---|---|
| 1. STAN | K1 | Poziom ogólny (nazwą kanoniczną skali) + gdzie najsilniej/najsłabiej — wyłącznie z wyników silnika |
| 2. CO TO ZNACZY | K2 | Konsekwencja profilu dla firmy z tego segmentu na tle benchmarku — gdzie odstaje i czym to grozi/co umożliwia |
| 3. TRZY LUKI | K1+K2 | Top-3 luki (ranking z silnika): nazwa + skutek biznesowy zaniechania, bez szczegółów technicznych |
| 4. CO NAJPIERW | K3 | Nadrzędna rekomendacja Fali 1 + dlaczego ta kolejność (zależność z grafu prerequisites nazwana wprost) |
| 5. EFEKT | K4 | Co zmieni się w horyzoncie 12 mies. po Fali 1 — przejście poziomów, bez obiecywania kwot spoza wsadu |

Razem ≤ 350 słów. Ta sama formuła schodzi na niższe poziomy raportu: karta luki = pełne
K1→K2→K3→K4 (DRD_REPORT_SPEC §S5); rozdział wymiaru otwiera **nagłówek-werdykt** (≤ 20 słów,
wniosek nie opis — §S7).

## W2. Output toola — rekomendacja z rationale i trade-offami
Każdy tool (SWOT, Porter, Ansoff, Value Chain…) kończy się blokiem **„Rekomendacja"**, nie
wypełnioną macierzą. Struktura:
1. **Werdykt** (1–2 zdania, answer-first): co z tej analizy wynika dla decyzji klienta.
2. **Rationale** (K2): dlaczego — z odwołaniem do konkretnych pozycji analizy (dowód, R2).
3. **Trade-offy** (obowiązkowe, min. 1): co wybieramy KOSZTEM czego; jaka opcja została odrzucona
   i dlaczego. Rekomendacja bez trade-offu = nie było decyzji, tylko lista.
4. **Pierwsze kroki** (K3, maks. 3) + **efekt** (K4).

Wypełniona macierz/canvas bez tego bloku = tool niedokończony.

## W3. Analiza finansowa — łańcuch wskaźnik → trend → driver → prognoza → rekomendacja
Interpretacja pojedynczego wskaźnika i cały raport finansowy realizują ten sam łańcuch:

| Ogniwo | Krok | Przykład treści |
|---|---|---|
| Wskaźnik | K1 | wartość + benchmark/próg + status dowodu (liczby z silnika) |
| Trend | K1 | kierunek i dynamika (N okresów) — trend jest częścią FAKTU, nie interpretacji |
| Driver | K2 | CO napędza wartość i trend — rozkład na składowe (np. spadek CR napędza wzrost zobowiązań krótkoterminowych, nie spadek aktywów); driver wskazany z danych, nie zgadywany |
| Prognoza | K2/K4 | dokąd to zmierza przy utrzymaniu trendu — TYLKO jeśli silnik liczy projekcję; inaczej jakościowo („przy tym tempie próg X w ~N kwartałów") z jawnym założeniem |
| Rekomendacja | K3+K4 | maks. 3 akcje z rolą + efekt z horyzontem |

Zakaz interpretacji „semaforkowej" bez łańcucha: „wskaźnik w normie" to nie wniosek (patrz §6, P1).

## W4. Karta insightu / inicjatywy
Warstwa wniosków kart jest już znormalizowana — **SSOT = CARD_CONTENT_FORMULA** (sekcje
Obserwacja → Mechanizm → Dowody → Wpływ → Rekomendacja mapują się na K1→K2→K3/K4). Ten dokument
niczego tam nie dubluje; dodaje jedno: **każda powierzchnia, która STRESZCZA kartę** (listy,
huby, rollupy portfela, eksporty) streszcza jej wniosek (answer-first z executive_summary),
nigdy metadane.

## W5. Deck — nagłówek slajdu = teza, nie temat
- **Tytuł każdego slajdu treściowego jest zdaniem twierdzącym z konkluzją** (action title),
  nie etykietą sekcji. Zły: „Wyniki wymiaru Dane". Dobry: „Dane zbieramy nowocześnie, ale
  utykają w silosach — analityka nie ma na czym pracować".
- Test spisu treści: **przeczytanie samych tytułów slajdów = pełna narracja rekomendacji**
  (storyline). Jeśli tytuły czytane po kolei nie opowiadają historii K1→K2→K3→K4 — deck jest
  sklejką sekcji, nie narracją.
- Body slajdu = dowód tezy z tytułu (wykres/liczby z silnika), nie nowa myśl.
- Każdy wykres ma tytuł-wniosek (nie „Wykres 3") — spójnie z DRD_REPORT_SPEC §3.
- Deck zarządczy kończy się slajdem „Co robić najpierw" (K3) + „Czego oczekiwać" (K4) — nigdy
  slajdem „Dziękujemy".

---

# §4. KONTRAKT PROMPT-READY (egzekwowalny programowo)

## 4.1. Struktura wejścia (wspólna dla wszystkich wariantów)

```
ConclusionInput {
  facts:      // WYŁĄCZNE źródło liczb — silnik/dane, nigdy LLM
              { metrics[]: {name, value, unit, benchmark?, trend?, threshold?},
                rankings[]: {items, score, kryterium},     // np. topGaps wg priority
                evidence[]: {ref, snippet, confidence: confirmed|declared|missing} }
  org:        { name, industrySegment, sizeBand, goals[], constraints[], glossary[] }
  canon?:     { skala/poziomy/ścieżki/graf zależności — jeśli metodyka je ma }
  benchmark?: { values, source: expert|statistical, n? }
  language:   pl|en
  variant:    W1|W2|W3|W4|W5
}
```

## 4.2. Szkielet promptu (baza; per wariant dokładany kształt z §3)

```
Jesteś partnerem firmy doradczej (HBS, MBA, 10 lat praktyki). Piszesz wniosek, który
podpiszesz własnym nazwiskiem przed zarządem {{org.name}}.
Standard: docs/standards/CONCLUSION_LAYER_STANDARD.md — formuła K1→K2→K3→K4.

ZASADY TWARDE:
- Liczby WYŁĄCZNIE z {{facts}} — nie licz, nie szacuj, nie przywołuj statystyk spoza wsadu.
- Grounding zamknięty: {{facts}} + {{org}} + {{canon}} + {{benchmark}}. Nic więcej.
- Dowód {{confidence=declared}} → pisz „wg deklaracji, do potwierdzenia". Brak danych →
  „do ustalenia (gdzie/kiedy)", nigdy zmyślona liczba.
- Każda teza K2 wskazuje dowód z {{facts}} (przyczynowość). Wniosek fałszywalny — przy
  innych danych brzmiałby inaczej.
- K3: maks. 3 akcje wg impact×effort {{facts.rankings}}; każda = czasownik + artefakt
  + rola. K4: efekt mierzalny/obserwowalny + horyzont.
- Zakaz ogólników pasujących do każdej firmy. Answer-first. Język: {{language}}
  (PL: słownik nietłumaczonych wg CARD_CONTENT_FORMULA §A5).
Zwróć WYŁĄCZNIE JSON wg kontraktu §4.3. Na końcu sam sprawdź checklistę §5 i zwróć
selfCheck z wynikiem per punkt.
```

Nakładki per wariant: **W1** — wymuszone 5 akapitów ≤350 słów (szkielet 1:1 z DRD_REPORT_SPEC
§S2); **W2** — wymagane pola `verdict`, `rationale`, `tradeoffs[] (≥1: chosen/rejected/why)`;
**W3** — wymagany komplet łańcucha `indicator/trend/driver/forecast/recommendation`, `forecast`
tylko gdy wsad zawiera projekcję lub jawne założenie; **W4** — kontrakt CARD_CONTENT_FORMULA
§B5 bez zmian; **W5** — `slides[].title` walidowany jako zdanie-teza (zawiera orzeczenie,
nie jest frazą rzeczownikową), sekwencja tytułów zwracana dodatkowo jako `storyline` do
osobnej recenzji.

## 4.3. Struktura wyjścia (JSON — renderer składa, LLM nie formatuje dokumentu)

```
ConclusionOutput {
  headline:  string                        // answer-first, ≤20 słów, teza nie temat
  k1_fact:   { text, factRefs[] }          // każdy factRef = klucz z facts
  k2_meaning:{ text, factRefs[] }          // ≥1 factRef na tezę (przyczynowość)
  k3_actions:[ {action, why_first, owner_role, effort, impact} ]   // 1–3
  k4_effect: { text, horizon, observable_or_metric }
  confidence: confirmed|mixed|declared     // najsłabsze ogniwo użytych dowodów
  selfCheck: { [punkt §5]: pass|fail }
}
```

## 4.4. Walidatory maszynowe (lint wniosku — PASS/FAIL przed publikacją)

| Walidator | Warunek |
|---|---|
| `numbers_from_engine` | każda liczba w tekstach występuje w `facts` (diff numeryczny; tolerancja formatu/zaokrągleń) — **twardy** |
| `k_complete` | k1–k4 niepuste (wyjątki tylko per wariant §3) |
| `k3_max3` | 1 ≤ akcje ≤ 3; każda ma owner_role + why_first |
| `k4_horizon` | k4 zawiera horyzont czasowy |
| `evidence_link` | k2.factRefs ≥ 1; każdy factRef istnieje w facts |
| `confidence_honest` | jeśli użyto dowodu `declared` → tekst zawiera zastrzeżenie; `confidence` = najsłabsze ogniwo |
| `no_filler` | 0 trafień na liście fraz-wydmuszek (R1, lista utrzymywana przy walidatorze) |
| `len_limits` | limity długości R4 / wariantu |
| `lang` | proza w `language`; PL → 0 EN poza słownikiem §A5 |
| `title_is_thesis` (W5) | tytuł slajdu ma orzeczenie; nie jest samą frazą rzeczownikową |
| `tradeoff_present` (W2) | ≥ 1 trade-off z parą chosen/rejected |
| `chain_complete` (W3) | komplet wskaźnik→trend→driver→(prognoza)→rekomendacja |

Pipeline jak w CARD_CONTENT_FORMULA §B1: generacja → walidatory → recenzja adversarialna
(checklista §5) → poprawki → publikacja. Żaden wniosek nie trafia do UI/PDF/PPTX bez PASS.

---

# §5. DoD — CHECKLISTA RECENZENTA („czy przeszłoby u partnera")

Recenzent (druga para oczu lub agent-recenzent, adversarialny — szuka powodów do FAIL) odpowiada
TAK/NIE. **Każde NIE = wniosek wraca z konkretną poprawką.**

1. **Test podpisu:** czy partner firmy doradczej podpisałby to nazwiskiem przed zarządem klienta — bez poprawiania ani jednego zdania?
2. **Test formuły:** czy są wszystkie 4 kroki (co jest → co znaczy → co robić najpierw → jaki efekt) i czy K2–K4 to ≥ połowa treści?
3. **Test liczb:** czy każda liczba w tekście występuje we wsadzie z silnika (zero liczb „z głowy")?
4. **Test rozróżnialności:** gdyby dane klienta były przeciwne, czy wniosek brzmiałby inaczej? (zdanie pasujące do każdej firmy = FAIL)
5. **Test przyczynowości:** czy każda teza interpretacyjna wskazuje swój dowód, a hipotezy są nazwane hipotezami z limitem pewności?
6. **Test priorytetu:** czy akcji jest ≤ 3, czy kolejność jest uzasadniona (impact×effort / prerequisites) i czy każda ma rolę odpowiedzialną?
7. **Test efektu:** czy rezultat jest mierzalny lub behawioralnie obserwowalny i ma horyzont — bez obietnic (kwot, poziomów) spoza wsadu?
8. **Test uczciwości dowodowej:** czy tekst nie twierdzi więcej, niż pozwala status dowodów (declared/missing nazwane wprost)?
9. **Test answer-first:** czy pierwsze zdanie (i tytuł slajdu w W5) niesie konkluzję, a nie temat/wstęp/metodykę?
10. **Test języka:** zero fraz-wydmuszek, ton partnera (strona czynna, bez asekuracji), PL czysty poza słownikiem §A5, limity długości dotrzymane?

---

# §6. WZORCE — before/after (realne powierzchnie aplikacji)

## P1. Analiza finansowa (W3)
**Źle (dzisiejszy wzorzec, por. `financialAnalysisService`):**
> „Current ratio: 1,2 — w normie (healthy range 1,0–2,0)."

**Wg standardu:**
> **Płynność formalnie w normie, ale trend zjada bufor — przy tym tempie próg ostrzegawczy za ~3 kwartały.**
> CR 1,2 (próg 1,0; branżowo 1,5–2,0) spadł z 1,6 w 4 kwartały. Driver: zobowiązania
> krótkoterminowe +38% r/r przy płaskich aktywach obrotowych — rosną kredyty kupieckie, nie
> zapasy. Najpierw: (1) CFO — renegocjacja terminów u 3 największych dostawców (wg salda),
> (2) kontroler — tygodniowy monitoring CR z progiem alarmowym 1,1, (3) CFO — przegląd linii
> kredytowej ZANIM wskaźnik dobije do progu. Efekt: zatrzymanie erozji i CR ≥ 1,3 w 2 kwartały;
> firma negocjuje z pozycji siły, nie pod ścianą.

## P2. Raport assessmentu — komentarz wymiaru (W1)
**Źle:**
> „Wymiar Dane i Analityka uzyskał wynik 42% (poziom II). Obejmuje 5 obszarów. Wykres poniżej przedstawia wyniki szczegółowe."

**Wg standardu:**
> **Dane zbieracie nowocześnie, ale utykają w silosach — analityka nie ma na czym pracować.**
> Poziom II (42%) przy benchmarku segmentu 58%: akwizycja danych na IV, integracja na I
> (wg deklaracji zespołu, do potwierdzenia — brak dowodu w sesji). To blokuje deklarowane plany
> AI: bez wspólnej warstwy danych każdy use-case zaczyna od ręcznego sklejania źródeł. Najpierw:
> IT Lead — inwentaryzacja źródeł i wspólny model danych dla 2 procesów krytycznych (nie „całej
> firmy"), bo to prerequisite Fali 2. Efekt: w 6 mies. przejście integracji I→III i odblokowanie
> pierwszego use-case'u AI na realnych danych.

## P3. Output toola — SWOT (W2)
**Źle:**
> „Mocne strony: doświadczony zespół, jakość produktu. Słabe: uzależnienie od 1 klienta. Szanse: rynek DACH. Zagrożenia: konkurencja cenowa."

**Wg standardu:**
> **Werdykt: wejście do DACH jest właściwym ruchem, ale najpierw trzeba rozbroić koncentrację przychodów — ekspansja z 61% przychodu u jednego klienta to skalowanie ryzyka, nie biznesu.**
> Rationale: siła (jakość potwierdzona 0,4% reklamacji) jest realną przewagą w DACH, ale słabość
> (klient A = 61% przychodu) czyni firmę niefinansowalną dla partnerów dystrybucyjnych, których
> ekspansja wymaga. Trade-off: odkładamy DACH o 2 kwartały KOSZTEM tempa wzrostu, w zamian za
> zdolność kredytową i pozycję negocjacyjną; wariant „DACH natychmiast" odrzucony, bo utrata
> klienta A w trakcie ekspansji zabija obie nogi naraz. Najpierw: (1) CEO — plan de-koncentracji
> do <45% w 12 mies. (3 leady z pipeline'u), (2) CFO — test finansowalności u 2 banków,
> (3) Sales Lead — desk research 5 dystrybutorów DACH równolegle. Efekt: za 2 kwartały decyzja
> go/no-go DACH podjęta na danych, z koncentracją w trendzie spadkowym.

---

## Wdrożenie (mapa O2 — poza zakresem tego SSOT, dla nawigacji)
O2.2 raporty assessmentów ×3 (DRD wg DRD_REPORT_SPEC = referencja) · O2.3 outputy tooli (W2)
· O2.4 analizy finansowe (W3) · O2.5 generatory raport/deck (W1+W5). Każde wdrożenie = bramka:
walidatory §4.4 w pipeline + próbka przez checklistę §5 + podpis Piotra na realnych danych.

## Changelog
- **v1.0 (2026-07-02):** pierwszy kanon — formuła K1–K4, reguły R1–R6, warianty W1–W5, kontrakt
  prompt-ready, DoD recenzenta, wzorce before/after. OXFORD O2.1. Do zatwierdzenia przez Piotra.
