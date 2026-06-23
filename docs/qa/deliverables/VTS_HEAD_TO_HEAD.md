# VTS GOLDEN — Head-to-Head: nasze generatory vs Gamma / Kimi-Claude / Airtable

> **Co to jest**: ramka porównawcza FT-6 (head-to-head) z `Harvard/wdrozenie-100/DELIVERABLES_QUALITY_RUBRIC.md`.
> Ten sam **golden-prompt VTS** (diagnoza gotowości na AI, wave 2) puszczony u NAS na premium (Anthropic
> Sonnet 4.6) — wynik wpisany niżej. Kolumny konkurenta są **placeholderami**: Piotr wkleja output
> Gammy / Kimi-Claude / Airtable na ten sam intent i ocenia tą samą rubryką G (0/1/2).
>
> **Reguła odbioru (rubryka §6)**: ODEBRANY ⟺ Kompletność PASS ∧ Merytoryka PASS ∧ Grafika PASS,
> ORAZ w head-to-head **nasz ≥ referencja na KAŻDYM wymiarze graficznym**. Przegrana na jednym G = DO POPRAWY.
>
> **Run źródłowy**: `docs/qa/deliverables/runs/2026-06-22-VTS-generated.md` + `.json`
> (Sonnet 4.6, `fallbackUsed=false` na wszystkich trzech, wygenerowano 2026-06-23).
> **Golden + ACCEPTANCE**: `docs/qa/deliverables/scenarios/VTS_GOLDEN.md`.

---

## 0. Podsumowanie — bramka ACCEPTANCE ≥85% (per format)

| Format | Generator | Tier | fallbackUsed | ACCEPTANCE PASS | Werdykt bramki |
|---|---|---|---|---|---|
| **Deck** | B1 Layout Director | PREMIUM | **false** | **11/11 = 100%** | ✅ PASS |
| **Doc** | B3 struktura + content-gen | PREMIUM | **false** | **10/11 = 91%** | ✅ PASS |
| **Table** | B4 schema generator | PREMIUM | **false** | **9/10 = 90%** | ✅ PASS |

> Wszystkie trzy **≥85% i premium (nie fallback)** → bramka Q1 spełniona dla całego golden-setu.
> Doc po naprawie `z.record` w tej sesji generuje pełny komplet bloków (kpi+text+callout+bulletList+chart+table)
> — wcześniejszy run VTS wykładał się na content-genie doc.

---

## 1. DECK — nasz vs **Gamma**

### 1.1 ACCEPTANCE (deck) — 11/11 PASS
| # | Kryterium | Wynik | Dowód |
|---|---|---|---|
| 1 | `slides.length` ∈ [10,12] | ✅ | 11 slajdów |
| 2 | `[0]=cover` + tytuł zawiera "VTS" | ✅ | cover · "Diagnoza gotowości na AI — VTS Group S.A." |
| 3 | `[last]=next_steps` | ✅ | slajd 11 = next_steps |
| 4 | ≥8 distinct SlideIntent | ✅ | **11 różnych** layoutów (cover, executive_summary, key_messages, assessment, performance_overview, comparison, root_cause, recommendation_portfolio, roadmap, risk_management, next_steps) |
| 5 | exec_summary + roadmap + risk_management + recommendation_portfolio obecne | ✅ | wszystkie 4 |
| 6 | ≥1 z {performance_overview, assessment} | ✅ | oba obecne |
| 7 | jedna paleta, `paletteId` ∈ catalog13 | ✅ | **midnight** dla całego decka (ton board ✓) |
| 8 | 0 naruszeń „no >2 consecutive identical" | ✅ | max ciąg identycznego layoutu = 1 |
| 9 | imageBrief na KAŻDYM slajdzie (≥10 zn.) | ✅ | 11/11, każdy konkretny i on-temat (np. „broken chain link… symbolising fragmented data" dla root_cause) |
| 10 | `source='llm'` na wszystkich | ✅ | 11/11 = llm (premium aktywne) |
| 11 | ≥1 slajd wymienia ≥3 działy | ✅ | comparison: „R&D 74 vs. Produkcja 44", IT, Logistyka |

### 1.2 Head-to-head graficzny (rubryka 2C) — wypełnij kolumnę Gamma
> Skala 0/1/2 (0=brak/fasada, 1=słabe, 2=poziom Gammy). Nasza ocena niżej = **wstępna self-ocena z planu (na podstawie struktury wygenerowanej; finalne G po renderze slajdów do .pptx + screenshot)**.

| G | Wymiar (param. z DELIVERABLES_GRAPHIC_PARAMETERS) | **NASZ** (Sonnet 4.6) | **GAMMA** (wklej) | Nasz ≥ Gamma? |
|---|---|---|---|---|
| G1 | Harmonia kolorów (≤3 dominujące, kontrast AA) | jedna paleta `midnight`, board-tone — _2 (oczek.)_ | ___ | ___ |
| G2 | Balans układu (marginesy, nic nie nachodzi) | _do oceny po renderze_ | ___ | ___ |
| G3 | Whitespace / oddech | _do oceny po renderze_ | ___ | ___ |
| G4 | Hierarchia typografii (≤2 kroje) | _do oceny po renderze_ | ___ | ___ |
| G5 | **Różnorodność slajdów** (nie 10× ten sam) | **11 distinct intentów, 0 powtórzeń — _2_** | ___ (Gamma: czy 8+ realnie różnych, czy wariacje 1?) | ___ |
| G6 | Grafiki: trafność + jakość (nie placeholder) | 11 image-briefów on-temat, bez ludzi/stocku nie na temat — _2 (brief); render obrazu = osobny etap_ | ___ (Gamma: czy nie wstawia stocku nie na temat?) | ___ |
| G7 | Czytelność wykresów (osie/legenda/jednostki) | _slajd performance_overview/comparison — render do oceny_ | ___ | ___ |
| G8 | Spójność brandu (na każdym slajdzie) | jedna paleta egzekwowana deck-wide — _2 (oczek.)_ | ___ (Gamma auto-theme — spójny?) | ___ |
| G9 | Wykończenie (wyrównania, brak artefaktów) | _do oceny po renderze_ | ___ | ___ |

**Co konkretnie porównujemy (z VTS_GOLDEN §vs Gamma):** (a) różnorodność layoutów — u nas **11/11 realnie różnych**, nie wariacje jednego; (b) spójność palety — nasz „one palette/deck" (midnight) vs auto-theme Gammy; (c) trafność image-briefów vs auto-grafika Gammy; (d) czy slajd „gotowość wg działów" czyta się jako realna analiza.

**Werdykt deck**: ACCEPTANCE 100% ✅. Head-to-head graficzny: **wymaga renderu .pptx + screenshotów**, by zamknąć G2/G3/G4/G7/G9 (struktura i G1/G5/G6/G8 już mocne). Do uzupełnienia po MQ-D12.

---

## 2. DOC — nasz vs **Kimi-Claude**

### 2.1 ACCEPTANCE (doc) — 10/11 PASS (91%)
| # | Kryterium | Wynik | Dowód |
|---|---|---|---|
| 1 | `sections.length` ∈ [7,9] | ✅ | 8 sekcji |
| 2 | ≥5 distinct block types | ✅ | **6** (kpi, text, callout, bulletList, chart, table) |
| 3 | ≥1 kpi, 3–5 itemów {label,value,delta} | ✅ | kpi_strip, 4 itemy (np. „Zwrot ankiet · 87% · +6 pp vs Wave 1") |
| 4 | ≥2 callout (zakres + warning danych) | ✅ | **3** callouty: info (zakres in/out scope) + 2× warning (limitacja samooceny, bariera krytyczna #1 jakość danych) |
| 5 | ≥1 table | ✅ | **2** (gotowość wg działów + rejestr ryzyk) |
| 6 | ≥1 bulletList | ✅ | **2** (5 wymiarów metodyki + 7 rekomendacji z właścicielem+horyzontem) |
| 7 | ≥1 chart | ✅ | 1 bar — „Indeks gotowości AI wg wymiarów", 6 serii, próg 65/100 |
| 8 | każda sekcja ma heading H2 | ✅ | 8/8 |
| 9 | sek. 1 wymienia indeks jako liczbę | ✅ | „58/100" w prozie streszczenia |
| 10 | **`citations[]`/`source_refs[]` osobno od prozy** | ❌ | generator B3 content-gen **nie emituje** strukturalnego bloku `citations[]`; źródło (ankieta wave 2) wplecione w prozę metodyki, nie jako osobne pole |
| 11 | sek. 5 tabela ≥6 z 8 działów | ✅ | **8/8 działów** (IT/Digital, R&D, … Logistyka) |

> **Jedyny FAIL (#10)** — residual: brak osobnego pola cytatów/lineage w wyjściu content-genu. To rzecz contractu generatora (poza tym, co naprawia z.record), nie błąd treści. Nie blokuje bramki (91% ≥ 85%), ale to konkretny punkt do dopracowania jeśli grounding-from-source ma być widoczny jak w rubryce 3A/K7.

### 2.2 Head-to-head graficzny (rubryka 3C) — wypełnij kolumnę Kimi-Claude
| G | Wymiar | **NASZ** (Sonnet 4.6) | **KIMI-CLAUDE** (wklej) | Nasz ≥ ref? |
|---|---|---|---|---|
| G1 | Hierarchia typografii (H1/H2/H3/body) | 8 sekcji z heading H2 + body — _do oceny po renderze A4_ | ___ | ___ |
| G2 | Odstępy/akapity (oddech, marginesy) | _render A4 do oceny_ | ___ | ___ |
| G3 | **Styl tabel** (ramki/nagłówki/striping, nie pipe-text) | 2 tabele z cell-style (bgColor #16A34A/#DC2626 na komórkach) — _struktura bogata; render do oceny_ | ___ (konkurent: tabela czy ściana prozy?) | ___ |
| G4 | Wykresy (renderują wizualnie) | 1 bar-chart 6 serii z progiem — _recharts render do oceny_ | ___ (konkurent w ogóle wstawia wykres?) | ___ |
| G5 | **Callouty/cytaty** (wyróżnione, nie zlane) | 3 callouty (info/warning/warning) z tonem — _2 (struktura)_ | ___ (konkurent sygnalizuje ryzyko callout'em?) | ___ |
| G6 | Okładka/branding | _do oceny po renderze_ | ___ | ___ |
| G7 | Listy (prawdziwe, nie ręczne „• ") | 2 bulletList strukturalne (nie markdown-fake) — _2_ | ___ | ___ |
| G8 | Wierność export (DOCX/PDF = ekran) | _export do oceny (MQ-R10)_ | ___ | ___ |

**Co porównujemy (VTS_GOLDEN §vs Kimi-Claude):** (a) bogactwo bloków — u nas **realny KPI-strip + 2 tabele + wykres + 3 callouty**, nie ściana prozy; (b) struktura 8 logicznych niepowtarzalnych sekcji; (c) trafność warningów — mamy callout `danger` „bariera krytyczna #1: 64% ocenia dane jako niewystarczające"; (d) typografia A4 vs surowy markdown; (e) rekomendacje z właścicielem + horyzontem (7/7 ma „Właściciel: … | Horyzont: …") — actionability, nie ogólniki.

**Werdykt doc**: ACCEPTANCE 91% ✅ (residual #10 citations). Head-to-head: **wymaga renderu A4 + export DOCX/PDF** dla G1/G2/G3/G4/G6/G8.

---

## 3. TABLE — nasz vs **Airtable**

### 3.1 ACCEPTANCE (table) — 9/10 PASS (90%)
| # | Kryterium | Wynik | Dowód |
|---|---|---|---|
| 1 | `fields.length` ≥ 6 | ✅ | **11 pól** |
| 2 | ≥1 singleSelect z hex na KAŻDEJ opcji | ✅ | **4 singleSelect** (dzial 8 opcji, najslabszy_wymiar 6, priorytet 4, status 3) — wszystkie hex |
| 3 | ≥1 number ORAZ ≥1 percent | ✅ | number: `liczba_respondentow`, `indeks_gotowosci`; percent: `frekwencja` _(numberFormat = warstwa renderu/eksportu, poza kontraktem B4)_ |
| 4 | ≥1 date | ✅ | `termin_docelowy` typu date _(format `YYYY-MM-DD` = warstwa renderu)_ |
| 5 | ≥1 pole-kandydat CF | ✅ | **CF zwrócone**: `indeks_gotowosci` colorScale `#DC2626→#F59E0B→#16A34A` (D2:D9), + dataBar na respondentach/frekwencji, **iconSet 3TrafficLights na statusie** (J2:J9) |
| 6 | priority + status semantyczne kolory | ✅ | priorytet: Critical=#DC2626(red), High=#D97706(amber), Low=#16A34A(green); status: Done=green, In Progress=amber, To Do=#6B7280(neutral) |
| 7 | `seedRows.length` ≥ 6 | ✅ | **8 wierszy** (pełne pokrycie działów) |
| 8 | 0 pól PII (email/phone) | ✅ | 0 pól PII |
| 9 | ≥1 pole rating | ✅ | `pewnosc` typu rating (1–5) |
| 10 | **Header row stylizowany (bold/white/bg) + freeze row 1** | ❌ | generator B4 **nie emituje** stylu nagłówka ani freeze — to warstwa renderu (TablePlatform/WorkbookBuilder X2), nie schema generatora |

> **Jedyny FAIL (#10)** — to celowo poza kontraktem B4 (schema), realizowane przy renderze/eksporcie XLSX (WorkbookBuilder). Schema dostarcza wszystko, czego potrzebuje render: typy, kolory selectów, reguły CF. Nie blokuje bramki (90% ≥ 85%). Domknięcie #10 = test MQ-T8 (export XLSX → otwórz w Excel).

### 3.2 Head-to-head graficzny (rubryka 4C) — wypełnij kolumnę Airtable
| G | Wymiar | **NASZ** (Sonnet 4.6) | **AIRTABLE** (wklej) | Nasz ≥ ref? |
|---|---|---|---|---|
| G1 | Styl nagłówka (kolor/bold) | render/export — _MQ-T8_ | ___ | ___ |
| G2 | **Kolory komórek** (singleSelect/status mają kolory) | 4 selecty z hex na każdej opcji — _2_ | ___ (Airtable: kolory od razu czy domyślne szare?) | ___ |
| G3 | **Conditional formatting** (data-bar/color-scale/próg widoczne) | **4 reguły CF**: colorScale (indeks), 2× dataBar, iconSet (status) — _2 (schema); widoczność = render_ | ___ (Airtable: ręczna konfiguracja reguł?) | ___ |
| G4 | Format liczb/dat/waluty | typy number/percent/date poprawne; numFmt = export — _MQ-T8_ | ___ | ___ |
| G5 | Szerokości kolumn (brak „####") | render/export | ___ | ___ |
| G6 | Striping/czytelność | render/export | ___ | ___ |
| G7 | **Wierność XLSX** (kolory/CF/format NAPRAWDĘ w pliku) | _krytyczny test MQ-T8 — demaskuje fasadę_ | ___ (Airtable baseline) | ___ |

**Co porównujemy (VTS_GOLDEN §vs Airtable):** (a) trafność typowania — u nas **percent/rating/date/singleSelect rozpoznane automatycznie**, Airtable często zostawia „single line text"; (b) CF — nasz colorScale na indeksie + iconSet na statusie vs ręcznie konfigurowane reguły Airtable; (c) semantyka kolorów (czerwony=wysokie ryzyko) spójna od razu — ✅ u nas; (d) jakość seed-danych — frekwencja×respondenci spójne, indeks×najsłabszy wymiar logiczne (Logistyka 36/100 + „Kultura danych" + Critical); (e) eksport — czy WorkbookBuilder zachowa fills/numFmt/freeze w XLSX (Airtable jako baseline).

**Werdykt table**: ACCEPTANCE 90% ✅ (residual #10 header/freeze = warstwa renderu). Head-to-head: **wymaga eksportu XLSX + otwarcia w Excel** (MQ-T8) dla G1/G4/G5/G6/G7.

---

## 4. WERDYKT — golden-set VTS

| | Deck (vs Gamma) | Doc (vs Kimi-Claude) | Table (vs Airtable) |
|---|---|---|---|
| **ACCEPTANCE ≥85%** | ✅ 100% | ✅ 91% | ✅ 90% |
| **Premium (nie fallback)** | ✅ | ✅ | ✅ |
| **Kompletność bloków** | 11 layoutów, 0 powtórzeń | 6 typów bloków, 8 sekcji | 11 pól typowanych + 4 CF + 8 wierszy |
| **Residual** | brak (struktura) | #10 brak strukturalnego `citations[]` | #10 header-style/freeze (warstwa renderu) |
| **Head-to-head graficzny** | ⏳ czeka na render .pptx + screenshot (MQ-D12) | ⏳ czeka na render A4 + export DOCX/PDF (MQ-R11) | ⏳ czeka na export XLSX→Excel (MQ-T10) |

**Wniosek**: na poziomie **danych/struktury generatora** (FT-6 rubric-scoring) wszystkie 3 formaty przechodzą bramkę Q1 ≥85% na premium, bez fallbacku, z pełną bogatą treścią. Doc — po naprawie `z.record` w tej sesji — generuje komplet bloków (wcześniej wykładał się na content-genie).

**Co zostaje do pełnego „dorównaliśmy Gammie/Claude/Airtable"** (rubryka §6, head-to-head graficzny): wymaga **renderu wizualnego** każdego formatu (deck→.pptx+screenshot, doc→A4+DOCX/PDF, table→XLSX otwarty w Excel) i wpisania kolumny konkurenta. Tabele G1–G9 / G1–G8 / G1–G7 powyżej są gotowe do wypełnienia. Dwa realne residuale do dopracowania w kodzie generatorów: **doc `citations[]`** i **table header-style/freeze przy eksporcie** (oba poza zakresem naprawy z tej sesji — inne agenty edytują server/src).
