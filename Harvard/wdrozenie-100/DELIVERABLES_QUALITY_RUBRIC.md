# Generatory Deliverable — RUBRYKA JAKOŚCI + testy manualne kompletności i jakości graficznej

> **Rola:** to jest warstwa odbioru **FT-6 (jakość AI)** + **FT-7 (manual)** + **etap 8 (→UI)** z trackera [`DELIVERABLES-STAN-PRACY-ODBIORY.md`](DELIVERABLES-STAN-PRACY-ODBIORY.md). Zamienia „ma być jak Gamma/Claude/Airtable" w **mierzalne, odhaczalne kryteria**.
> **Zasada:** każdy wygenerowany dokument przechodzi 3 bramki — **KOMPLETNOŚĆ** (czy nic nie brakuje), **JAKOŚĆ MERYTORYCZNA** (czy treść jest dobra), **JAKOŚĆ GRAFICZNA** (czy wygląda profesjonalnie). Dokument odebrany TYLKO gdy wszystkie 3 ≥ próg.

---

## 1. Model oceny (scoring)

Każdy wymiar oceniany **0 / 1 / 2**:
- **0** = brak / błąd / placeholder / fasada (np. surowy JSON, „awaiting content", wyrzucony styl)
- **1** = jest, ale słabe / niepełne / wymaga poprawy
- **2** = poziom konkurencji (Gamma/Claude/Airtable) — gotowe do oddania klientowi

**Bramki (per dokument):**
- **Kompletność:** ≥ 90% maks · **żaden wymiar = 0** (twardo — brak danych = brak odbioru)
- **Jakość merytoryczna:** ≥ 80% maks · żaden krytyczny wymiar (grounding, język) = 0
- **Jakość graficzna:** ≥ 80% maks · **żaden wymiar = 0** · **head-to-head ≥ referencja** (niżej)

**Head-to-head (najuczciwszy test „jak Gamma"):** ten sam golden-prompt (Q3) puszczamy u nas i w referencji (Gamma/Claude/Airtable). Oceniamy OBA tą samą rubryką graficzną. **Warunek odbioru: nasz wynik ≥ referencja na każdym wymiarze graficznym** (lub wyżej). To jest dowód „dorównaliśmy/wygraliśmy".

**Podstawa LICZBOWA wymiarów graficznych (G):** [`DELIVERABLES_GRAPHIC_PARAMETERS.md`](DELIVERABLES_GRAPHIC_PARAMETERS.md) — każdy wymiar G ma konkretny, zakotwiczony w konkurencji/standardach parametr (kontrast ≥4.5:1 · pie ≤5 wycinków · body decku 24pt · paleta ≤7 · A4 marginesy 1in · CF data-bars/color-scales/icon-sets…). Ocena 0/1/2 liczona względem TEJ liczby, nie wrażenia. To jest „dopracowany element oczekiwanych parametrów graficznych".

**Kto ocenia:** FT-6 = rubric-scoring automatyczny (golden) + Claude (audyt screenshotów). Etap 8 →UI = Claude proponuje wynik rubryki ze screenshotami, **Piotr zatwierdza**.

---

## 2. RUBRYKA — PREZENTACJA (deck) · benchmark GAMMA

### 2A. Kompletność (maks 18)
| # | Wymiar | Test (co sprawdzam na żywo) |
|---|---|---|
| K1 | Slajd tytułowy | tytuł + podtytuł + branding obecne, nie „Untitled" |
| K2 | Agenda/struktura | jest spis/agenda gdy deck >6 slajdów |
| K3 | Exec summary | streszczenie obecne i niepuste |
| K4 | Rdzeń merytoryczny | wszystkie slajdy z planu wygenerowane (liczba = outline) |
| K5 | Brak placeholderów | zero „Evidence gap…" / „awaiting content" / pustych pól |
| K6 | Dane zasilone | KPI/wykresy/tabele mają realne liczby (nie 0/—/lorem) |
| K7 | Next steps / rekomendacja | slajd zamykający obecny |
| K8 | Źródła / lineage | gdy z paczki źródła — widoczne odniesienie |
| K9 | Brak ucięć | żaden tekst/element nie obcięty poza slajd (overflow=0) |

### 2B. Jakość merytoryczna (maks 10)
| # | Wymiar | Test |
|---|---|---|
| M1 | Grounding (krytyczny) | treść zgodna ze źródłem, zero halucynacji nazw/liczb |
| M2 | Język PL/EN | poprawna polszczyzna, zero kalk z EN, spójny rejestr |
| M3 | Zwięzłość | brak ścian tekstu, ≤ ~6 bulletów/slajd, „mniej znaczy więcej" |
| M4 | Logika narracji | slajdy układają się w historię (problem→analiza→rekomendacja) |
| M5 | Brak filler | zero pustosłowia / generycznych frazesów |

### 2C. Jakość graficzna (maks 18) — **rdzeń „poziomu Gammy"**
| # | Wymiar | Test (na screenshocie light+dark) |
|---|---|---|
| G1 | Harmonia kolorów | paleta spójna, ≤3 dominujące, kontrast tekstu AA |
| G2 | Balans układu | treść wyważona, marginesy spójne, nic nie nachodzi |
| G3 | Whitespace | oddech, brak przepełnienia, brak ścian |
| G4 | Hierarchia typografii | tytuł>nagłówek>body czytelne, ≤2 kroje |
| G5 | Różnorodność slajdów | layouty się różnią (nie 10× ten sam), Gamma-like |
| G6 | Grafiki: trafność+jakość | obrazy pasują do treści, ostre, nie zniekształcone, **nie placeholder** |
| G7 | Czytelność wykresów | osie/legenda/jednostki, kolory z palety, nie CSS-słupek |
| G8 | Spójność brandu | logo/kolory/font wg Brand Kit na każdym slajdzie |
| G9 | Wykończenie | równe wyrównania, brak literówek w layoutcie, brak artefaktów |

### 2D. Manual — testy kompletności i jakości (deck) · **12 nowych scenariuszy**
> Każdy = wygeneruj realny deck danego typu → przejdź rubrykę 2A+2B+2C → screenshot + wynik. Typy pokrywają „dużo typów dokumentów".

| MQ | Typ decka (golden) | Na co kładę nacisk |
|---|---|---|
| MQ-D1 | Board Decision Deck | kompletność K1-K9, rekomendacja GO/NO-GO, exec summary |
| MQ-D2 | Diagnostic Read-out (DRD) | wykresy dojrzałości, KPI strip, G7 czytelność wykresów |
| MQ-D3 | Initiative Kickoff | roadmap slide, RAID, G5 różnorodność layoutów |
| MQ-D4 | Steering Committee Update | before/after, status, G2 balans gęstej treści |
| MQ-D5 | Executive Summary (1-pager rozbity na slajdy) | M3 zwięzłość, G3 whitespace |
| MQ-D6 | KPI/ROI Deck | tylko liczby/wykresy — G7 + K6 dane zasilone |
| MQ-D7 | Deck z paczki inicjatywy | M1 grounding ze źródła, K8 lineage |
| MQ-D8 | Deck z czystego promptu Teresy | kompletność bez źródła, M4 narracja |
| MQ-D9 | Deck z brandingiem klienta (Brand Kit) | G8 spójność brandu na każdym slajdzie |
| MQ-D10 | Deck z obrazami AI | G6 trafność+jakość obrazów, fallback gdy provider off |
| MQ-D11 | Deck długi (>15 slajdów) | K4 wszystkie wygenerowane, K9 brak ucięć, wydajność |
| MQ-D12 | **Head-to-head vs Gamma** (ten sam temat) | rubryka 2C nasz vs Gamma — ≥ na każdym G |

---

## 3. RUBRYKA — RAPORT (doc) · benchmark KIMI / CLAUDE

### 3A. Kompletność (maks 16)
| # | Wymiar | Test |
|---|---|---|
| K1 | Okładka + tytuł | okładka z tytułem/logo/datą |
| K2 | Spis treści | TOC obecny i zgodny z nagłówkami (gdy doc długi) |
| K3 | Wszystkie sekcje | każda sekcja z outline/template wypełniona |
| K4 | Brak placeholderów | zero „This section is awaiting content" |
| K5 | Tabele zasilone | tabele mają dane, nie puste/„—" |
| K6 | Wykresy/KPI | obecne gdy wymagane, renderują (nie placeholder) |
| K7 | Cytaty/źródła | citations/footnotes obecne gdy grounding ze źródła |
| K8 | Stopka/numeracja | numeracja stron, stopka |

### 3B. Jakość merytoryczna (maks 10)
M1 grounding (kryt.) · M2 język PL/EN (kryt.) · M3 struktura logiczna sekcji · M4 brak filler · M5 spójność rejestru (raport/memo/charter).

### 3C. Jakość graficzna (maks 16)
| # | Wymiar | Test (ekran + export DOCX + PDF) |
|---|---|---|
| G1 | Hierarchia typografii | H1/H2/H3/body czytelne i spójne |
| G2 | Odstępy/akapity | oddech, brak ścian, spójne marginesy |
| G3 | Styl tabel | **ramki/nagłówki/striping** (nie pipe-text, nie surowy JSON) |
| G4 | Wykresy | renderują wizualnie (recharts ekran / obraz w DOCX/PDF) |
| G5 | Callouty/cytaty | wyróżnione wizualnie, nie zlane z tekstem |
| G6 | Okładka/branding | logo, kolory, spójny nagłówek |
| G7 | Listy | prawdziwe listy (Word outline), nie ręczne „• " |
| G8 | Wierność export | DOCX i PDF wyglądają jak ekran (parytet, nie degradacja do tekstu) |

### 3D. Manual — testy kompletności i jakości (doc) · **11 nowych scenariuszy**
| MQ | Typ raportu (golden) | Nacisk |
|---|---|---|
| MQ-R1 | Raport audytowy (audit report) | K2 TOC, K3 sekcje, G3 tabele ryzyk |
| MQ-R2 | Executive Memo (1-2 str.) | M3 zwięzłość, G1 typografia |
| MQ-R3 | Project Charter | kompletność sekcji wg formuły inicjatyw |
| MQ-R4 | Proposal / oferta | G6 branding, M5 rejestr perswazyjny |
| MQ-R5 | Assessment Report z wykresami | K6 + G4 wykresy renderują w DOCX i PDF |
| MQ-R6 | Raport z paczki inicjatywy | M1 grounding, K7 cytaty do źródła |
| MQ-R7 | Doc z czystego promptu | kompletność bez źródła |
| MQ-R8 | Doc z tabelą wielokolumnową | G3 styl tabel w PDF (ramki!) |
| MQ-R9 | Doc z inline-AI „zaznacz→popraw" | jakość poprawki, M2 język |
| MQ-R10 | Export DOCX → otwórz w Word (computer-use) | G8 wierność, listy, obrazy osadzone |
| MQ-R11 | **Head-to-head vs Claude/Kimi** (ten sam temat) | rubryka 3C nasz vs referencja |

---

## 4. RUBRYKA — TABELA · benchmark AIRTABLE + CLAUDE-EXCEL

### 4A. Kompletność (maks 14)
| # | Wymiar | Test |
|---|---|---|
| K1 | Kolumny otypowane | każde pole ma sensowny typ (nie wszystko „text") |
| K2 | Seed-rows | wiersze przykładowe obecne, nie pusta tabela |
| K3 | Brak pustych wymaganych | wymagane komórki wypełnione |
| K4 | Formuły liczą | pola formuła zwracają wartość (nie #ERROR) |
| K5 | Relacje/lookup | gdy są — rozwiązują się |
| K6 | Widoki | min. grid; dodatkowe widoki gdy sensowne |

### 4B. Jakość merytoryczna (maks 8)
M1 trafność schematu (kryt. — typy pasują do treści) · M2 sensowne kolumny (nie nadmiarowe) · M3 język nagłówków PL/EN · M4 seed realistyczny.

### 4C. Jakość graficzna (maks 14) — **„kolory i formaty jak Claude-Excel"**
| # | Wymiar | Test (ekran + export XLSX otwarty w Excel) |
|---|---|---|
| G1 | Styl nagłówka | nagłówek wyróżniony (kolor/bold), nie goły |
| G2 | Kolory komórek | singleSelect/status mają kolory opcji |
| G3 | Conditional formatting | reguły kolorują (data-bar/color-scale/próg) — **widoczne** |
| G4 | Format liczb/dat/waluty | numFmt poprawny (1 234,56 zł / %, daty) |
| G5 | Szerokości kolumn | dopasowane, brak ucięć/„####" |
| G6 | Striping/czytelność | naprzemienne wiersze / siatka czytelna |
| G7 | **Wierność XLSX** | export otwarty w Excel **niesie** kolory/CF/formaty (NIE goły — demaskuje fasadę SheetJS) |

### 4D. Manual — testy kompletności i jakości (tabela) · **10 nowych scenariuszy**
| MQ | Typ tabeli (golden) | Nacisk |
|---|---|---|
| MQ-T1 | Rejestr ryzyk (RAID) | K1 typy, G2 kolory statusu, G3 CF na poziomie ryzyka |
| MQ-T2 | KPI Dashboard | K4 formuły, G4 format %/liczb, G3 data-bary |
| MQ-T3 | Budżet/koszty | G4 format waluty (zł), G6 striping, suma |
| MQ-T4 | Roadmap tabela | K5 relacje, widok timeline/gantt |
| MQ-T5 | Macierz oceny (assessment) | G3 color-scale na ocenach |
| MQ-T6 | Portfolio inicjatyw z paczki | M1 trafność, K2 seed z realnych danych |
| MQ-T7 | Tabela z czystego promptu | K1 otypowanie bez źródła |
| MQ-T8 | **Export XLSX → otwórz w Excel** (computer-use) | G7 wierność: kolory/CF/format NAPRAWDĘ w pliku |
| MQ-T9 | CF na żywo (dodaj regułę) | G3 reguła koloruje w gridzie i w eksporcie |
| MQ-T10 | **Head-to-head vs Airtable/Claude-Excel** | rubryka 4C nasz vs referencja |

---

## 5. Jak to wpina się w odbiór

- **FT-6 (jakość AI):** na zestawie golden-promptów (Q3) liczymy rubryki 2/3/4 automatycznie (rubric-scoring) + audyt Claude. Próg = sekcja 1. Bez progu → sub-moduł serii B/X NIE przechodzi etapu 4.
- **FT-7 (manual):** scenariusze MQ-* (33 łącznie: 12 deck + 11 doc + 10 tabela) wykonywane na żywo z **kompletem screenshotów** (Playwright .png / computer-use), każdy z wypełnioną rubryką. To są „więcej testów manualnych" sprawdzających kompletność + jakość.
- **Etap 8 (→UI):** Claude przedstawia screenshoty + wyniki rubryk graficznych (2C/3C/4C) + **head-to-head vs referencja**; Piotr zatwierdza „jakość graficzna odebrana".
- **Liczby w trackerze:** manualne MQ-* doliczane do kolumny Manual sub-modułów generujących dany typ (B1/B2/X1 deck, B3/R1/X3 doc, B4/R5/X2 tabela). Łączny manual programu rośnie o **+33 scenariusze jakościowe**.

## 6. Kryteria odbioru per test (WIĄŻĄCE) — merytoryka I grafika w KAŻDYM teście

**Reguła wiążąca (twarda):** każdy test jakościowy/manualny MQ-* daje **trzy oceny naraz** (Kompletność · Merytoryka · Grafika) i ma jeden werdykt:

> **ODEBRANY ⟺ Kompletność PASS ∧ Merytoryka PASS ∧ Grafika PASS**
> (koniunkcja — wystarczy jeden FAIL i test = **DO POPRAWY**)

Nie istnieje „zielony" test oceniony tylko merytorycznie albo tylko graficznie. **Każdy MQ wymusza obie oceny.** Dokument piękny-ale-pusty FAIL (merytoryka), dokument mądry-ale-brzydki FAIL (grafika). Tak samo w head-to-head: przegrana na choćby jednym wymiarze graficznym = DO POPRAWY.

### Karta odbioru (wypełniana dla KAŻDEGO MQ-*)
```
KARTA ODBIORU — MQ-XX · [typ dokumentu] · [data]
Wejście:     [golden-prompt / paczka źródła]
Dowód:       [screenshot .png] · [plik export: .pptx/.docx/.xlsx/.pdf]
────────────────────────────────────────────────────────────
KOMPLETNOŚĆ   __/maks   próg ≥90% · żaden wymiar=0     → PASS / FAIL
              braki: [lista wymiarów <2]
MERYTORYKA    __/maks   próg ≥80% · M1 grounding≠0 · M2 język≠0  → PASS / FAIL
              uwagi: [co obniża]
GRAFIKA       __/maks   próg ≥80% · żaden wymiar=0     → PASS / FAIL
              uwagi: [które G <2 i dlaczego]
HEAD-TO-HEAD  nasz __ vs referencja __  (gdy dotyczy)  → nasz ≥ ref? PASS / FAIL
────────────────────────────────────────────────────────────
WERDYKT:  ODEBRANY / DO POPRAWY
powód (gdy DO POPRAWY): [oś + wymiary, które nie przeszły]
```

### Przykład wypełniony — MQ-D1 (Board Decision Deck)
```
KARTA ODBIORU — MQ-D1 · Board Decision Deck · 2026-0X-XX
Wejście:  golden „decyzja GO/NO-GO wdrożenia AI w VTS"
Dowód:    mq-d1-board-deck-light.png + .pptx
────────────────────────────────────────────────────────────
KOMPLETNOŚĆ   17/18   K1-K9, slajd rekomendacji GO/NO-GO obecny, 0 placeholderów  → PASS
              braki: K2 agenda tylko częściowa (1)
MERYTORYKA     9/10   grounding ze źródła VTS ✓, język ✓, narracja problem→decyzja ✓  → PASS
              uwagi: M3 jeden slajd przegadany
GRAFIKA       15/18   paleta ✓ brand ✓ typografia ✓                                → PASS
              uwagi: G5 różnorodność 1 (3 slajdy ten sam layout), G7 wykres 1 (CSS-słupek)
HEAD-TO-HEAD  nasz 15 vs Gamma 16  → FAIL (Gamma wygrywa na G5/G7)
────────────────────────────────────────────────────────────
WERDYKT:  DO POPRAWY
powód: head-to-head — przegrana na G5 (różnorodność layoutów) i G7 (wykresy);
       blokuje odbiór mimo PASS na 3 bramkach bazowych → wraca do B1/B2 (Layout Director) + X3 (wykresy)
```
> Ten przykład pokazuje sedno: deck zdał 3 bramki bazowe, ale **przegrał head-to-head na grafice → nie odbieramy.** Tak działa „dorównać Gammie" jako kryterium, nie opinia.

### Gdzie egzekwowane
- **FT-7 (manual):** każdy MQ-* = jedna wypełniona Karta odbioru w `docs/qa/` + screenshoty. Sub-moduł serii B/R/X NIE przechodzi etapu 4, póki wszystkie jego MQ nie mają werdyktu ODEBRANY.
- **FT-6 (auto):** rubric-scoring liczy Kompletność/Merytoryka/Grafika automatycznie na golden-secie; te same progi i ta sama reguła koniunkcji.
- **Etap 8 (→UI):** Piotr widzi Karty odbioru (3 oceny + head-to-head) i zatwierdza.

## 7. Golden set (czeka Q3 — Piotr)
Potrzebuję **3–5 realnych tematów DBR77 per typ** (np. „audyt procesów ICT Apator", „deck zarządczy transformacji VTS", „rejestr ryzyk wdrożenia AI"). Na nich liczymy FT-6 i robimy head-to-head. Do uzupełnienia.
