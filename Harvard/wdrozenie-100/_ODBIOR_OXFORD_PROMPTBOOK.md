# ODBIÓR OXFORD — prompt-book (dla Piotra, ~1.5-2h, jakość merytoryczna)

> Przelot przeglądarki (Ty = user A, org demo). Login: piotr.wisniewski@dbr77.com
> Demo tip: flag-check `ENABLE_DISCOVERY_TOOLS=1`, `BUSINESS_CASE_ADVISORY=0` (O4 za flagą)
> Zasada odbioru: merytoryka, nie UI. Per tool: PASS (podpisałbyś) / FAIL (konkretny błąd) + lista poprawek
> Miara jedyna: **„czy ten wniosek wyglądałby jak mój własny raport dla klienta?"**

---

## CZĘŚĆ 1 — Trzy archetypy reprezentatywne (wybierz z O3, testuj merytorykę)

| # | Tool | Przypadek testowy | Input | Co oceniać | Gdzie sprawdzić |
|---|------|------------------|-------|-----------|-----------------|
| **1** | **Dynamic SWOT** (wzorzec Q-banku) | Wejście na rynek DACH — gra nowy gracz SaaS B2B | Notatka: „3-4 osoby, ~€1M budżetu, tempo 18 m-cy, produktu nie ma jeszcze. Konkurencja: SAP, Oracle, kleinsze 10-15 startup" | **Answer-first**: czy conclusion summary zaraz mówi SO/WO/ST/WT vide? Nie: „gromadź dane" − FAIL. **MECE**: czy SO/WO/ST/WT się nie pokrywają (O=okazja DLA nas, W=wyzwanie DLA nas czy wewnętrzne słabości)? Odwrócone=FAIL. **Grounding**: czy każde SO ma źródło − co konkretnie wskazuje (raport, benchmark, dane teścia)? Zmyślone % w branży bez dowodu=FAIL. **Actionability**: czy wprost wynika „co robić najpierw" (SO+WO=atakuj, ST=broń, WT=unikaj)? Vague=FAIL. **Evidence**: czy narrative drąży „dlaczego SO, nie tylko: jest szansa"? | Discovery Tools → SWOT → wklej notatkę (lub ręcznie wypełnij pola) → SummaryStep (wniosek OK2-validated) |
| **2** | **Market Forces (Porter)** | Rynek retail FMCG w EU post-inflacji | Input: „czytaj z publicznych raportów, załóż marża brutto 23%, średnia org 180 FTE, przychód €50M" | **Answer-first**: czy mówi wprost (branża atrakcyjna/nieatrakcyjna wg 5-sił)? Nie=FAIL. **MECE**: czy 5 sił (dostawcy, odbiorcy, nowych konkurenci, substytuty, rywalowie) mają jasne granic? Przemieszane=FAIL. **Grounding**: czy per siła: liczba konkurentów, marża, switcher cost — konkretne źródła? Gęsto zakreskowane=FAIL. **Actionability**: czy wprost wynika które siły atakują NASZĄ marżę (sekwencja działań)? Ogólnie=FAIL. **Evidence**: czy narrative pokazuje trade-off (przykład: mało dostawców ALE wysoki switcher cost odbiorcy = paradoks)? | Discovery Tools → Market Forces (Porter) → wpisz rynek (FMCG) + dane → SummaryStep |
| **3** | **Portfolio Priority** (macierz impact×effort) | Ranking inicjatyw do portfolio (4-6 inicjatyw z org, różne impact/effort) | Import z live initiatives orga: „digital transformation 6-18m €2M", „supply-chain automation 3-6m €500k", „people analytics POC 1-3m €100k", itp. Wymuszenie źródła per liczba (budżet z FIN, timeline z DELIVERY_PLAN, impact z KPI drivers) | **Answer-first**: czy sekwencja NOW/SOON/LATER wynika wprost z macierzy (górno-lewo=first)? Arbitralne porządkowanie=FAIL. **MECE**: czy inicjatywy się nie pokrywają i razem pokrywają ambicję porfolio? Dublety lub luki strategiczne=FAIL. **Grounding**: czy budżet/effort pochodzi z rzeczywistych danych orga (finance.initiatives.cost) czy zmyślone €2M? INVENTED_NUMBER flaga=FAIL. **Actionability**: czy wynika zarządzanie dependencies (B czeka na A)? Ignorancja zależności =FAIL. **Evidence**: czy narrative uzasadnia porządek ograniczeniami (budżet cap €5M, senior team dostępny 3-4 projektów jednocześnie)? | Initiatives → (jeśli jest portfolio view) → kliknij tool Portfolio Priority → import live initiatives → macierz 2×2 + ranking |
| **4** | **Value Chain** (dekompozycja kosztów-wartości) | Produkcja/usługa (wybierz rzeczywisty łańcuch z klienta lub testowy: logistyka 3PL, consulting, manufacturing) | Input: „magazyn, transport, ostatnia mila, customer service". Wymuszenie dla każdego: gdzie rośnie koszt (labor, infrastruktura, tech debt) i gdzie maleje wartość (np. customer czeka 5 dni zamiast 1, musimy buforować zapas). | **Answer-first**: czy narrative wyraża jasno co CUT (za mała wartość, duży koszt) vs GROW (duża wartość, mały koszt)? Nie=FAIL. **MECE**: czy ogniwa się nie pokrywają (ostatnia mila ≠ transport)? Rozmyta granica=FAIL. **Grounding**: czy liczby: jednostkowy koszt per ogniwo (€/przesyłka), zysk netto per ogniwo, czy pochodzą z controller danych czy „mniej więcej"? Oszacowanie bez źródła=FAIL. **Actionability**: czy wynika sekwencja ruchów (najpierw zmniejsz koszt magazynu, potem optimizuj transport)? Ogólna lista=FAIL. **Evidence**: czy pokrywa się z ambicją (redukcja marży operacyjnej z 8% do 6%)? Oderwane od metryki=FAIL. | Discovery Tools → Value Chain (jeśli dostępny) → wpisz ogniwa + dane kostów → SummaryStep |

---

## CZĘŚĆ 2 — Business Case + Benchmark (O4 + O6)

| # | Komponenta | Testuj | Walidacja PASS/FAIL |
|---|-----------|--------|-------------------|
| **5** | **Business Case O4** (jeśli flaga `BUSINESS_CASE_ADVISORY=1`) | Inicjatywa: „digital supply-chain, invest €3M, spodziewany savings €1.5M/rok przez 3 lata" | **Assumptions jawne**: czy widać stopy dyskontowe, inflację, ramp-up (r. 1-2 niskie, r. 3+ pełne)? Nie=FAIL. **Senaryusze**: czy są 3 (pesymistyczny/bazowy/optimistyczny) z różnymi assumptions (przykład: adoption rate 40% vs 60% vs 80%)? Jeden scenariusz=FAIL. **Rekomendacja**: czy mówi IRR/NPV i wprost: GO/NO-GO? Vague=FAIL. **Grounding**: czy %savings pochodzą z linii biznesu, czy „założenie"? |
| **6** | **Benchmark branżowy O6** | Ta sama inicjatywa: Supply-chain automation w retail/manufacturing | **Profil referencyjny**: czy raport pokazuje „top performers w branży osiągają savings 18-25%, mid 10-15%, laggards <5%"? Nie=FAIL. **Disclaimer**: czy jest jasne „expert-hypothesis-v1, based on n≥10 projects"? Marketing-speak=FAIL. **Interpretacja**: czy mówi wprost gdzie NASZA organizacja vs benchmark (jesteśmy w upper-quartile czy bottom)? |

---

## CZĘŚĆ 3 — Ścieżka na demo (konkretne kliki)

### Dla O2-O3 toolów (Discovery Tools → UI):
1. Zaloguj się demo.consultify.ai (Piotr)
2. Menu główne → Discovery Tools (albo INITIATIVES → Create Initiative → Tools tab)
3. Wybierz tool (SWOT / Porter / Value Chain / Portfolio Priority)
4. **Scenariusz 1 (cold start)**: wklej text case z tabeli wyżej → tool drąży pytania (Q-bank) → SummaryStep
5. **Scenariusz 2 (warm start)**: jeśli existuje inicjatywa w orga → import live data → tool pre-fills z KPI/drivers
6. Sprawdź output: conclusion summary (K1-K4 layer), evidence sekcja, karty luk (jeśli wygenerowane)

### Dla O4 Business Case:
- Flag check: `BUSINESS_CASE_ADVISORY=1`
- Menu: Initiatives → [initiative] → Financial Analysis / Business Case tab (jeśli widoczny)
- Input: assumptions editor (WACC, inflation, adoption curve)
- Sprawdzaj: scenarios panel, IRR/NPV, sensitivity analysis (jeśli zbudowany)

### Dla O6 Benchmark:
- Menu: Initiatives → Financial section (lub Reports)
- Tool: Ratio Analysis (jeśli live)
- Walidacja: czy benchmark per-branża bierze się z `financeIndustryBenchmarks.ts` (9 branż) zamiast universal ±15%?

---

## CZĘŚĆ 4 — Rubryka oceny (per tool)

| Wymiar | PASS (4-5 pkt) | FAIL (1-3 pkt) | Komentarz |
|--------|---|---|---|
| **Answer-first** | Wniosek w pierwszym zdaniu summary; listener wie o co chodzi zaraz | „Gromadź dane", „może być", vague rekomendacja | Konsultant myśli wynik → mówi wynik NAJPIERW |
| **MECE** | Osie/wymiary się nie pokrywają, razem pokrywają domen | Dublety, luki, przemieszana logika (SO zawiera słabości) | Logika „mutual exclusive, collectively exhaustive" |
| **Grounding liczb** | Każda % / €/jednostka ma źródło (finance.data / benchmark / published report) | Zmyślone: „około 30%", „big", estimation bez zakotwiczenia | Liczby NIE mogą być wymyślone; estimate OK jeśli oznakowany |
| **Actionability** | Wprost wynika co robić najpierw (impact×effort ranking, zależności) | Lista rzeczy, brak priorytetu, circular dependencies | Czytający wie co zrobić jutro i po co |
| **Evidence** | Narrative drąży trade-offy, limitacje, dlaczego tak nie inaczej | Powierzchownie: „to jest szansa" bez wyjaśnienia mechanizmu | Story bierze za kark, nie zostawia wątpliwości |

---

## ZNANE OGRANICZENIA (szary kód — nie liczą się do FAIL)

- **LLM tier flaky**: glm-4.6 na demo czasem zwraca incomplete responses; jeśli output pięty-trz — rerun tool (do 2 prób)
- **Evidence UI pusty dla O4**: Business Case szablony gotowe, ale Evidence/narrative section mogą być stubem
- **Benchmark O6.1 (profile referencyjne)**: wpięcie w raport DRD czeka decyzja P3 Piotra
- **Q-banki zbudowane ale nie w prod**:  SWOT/Porter/Ansoff/Value Chain/Portfolio Priority to worktree (`e8cc969e2d`), merge na demo 07-15

---

## WYNIK ODBIORU

Per tool w tabeli §1: **✅ PASS** (podpisałbyś) / **❌ FAIL** (lista pop. do hotfixu)

**Komplet ✅** na 4-6 reprezentatywnych toolach = **Oxford Quality v1 READY** (założenie: średnio 1-2 hotfixy per tool, każdy ≤1h)

Sesja: 60-90 min. Zaraz po: commit tag `demo-safe-oxford-quality-<data>` jeśli PASS
