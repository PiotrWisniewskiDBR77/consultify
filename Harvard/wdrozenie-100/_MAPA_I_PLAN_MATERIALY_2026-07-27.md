# MAPA TEGO, CO MAMY + PLAN WDROŻENIA · Materiały · 2026-07-27

> Powstało na zlecenie Piotra: „przeanalizuj dokładnie dokumentację, którą mamy… zrób pełen spis
> tego, co już jest gotowe i co się nadaje do wykorzystania. Później uprość przepływ i nawigację
> i z tego stwórz plan do wdrożenia."
> Podstawa: 3 równoległe audyty dokumentacji (3200+ plików `docs/`, 275 `Harvard/wdrozenie-100/`)
> + wcześniejszy inwentarz kodu (`_INWENTARZ_GENERATORY_3_FORMATY_2026-07-27.md`).
> Miara nadrzędna: `_NAGRANIE_PIOTRA_WIZJA_MATERIALY_2026-07-27.md` (N1-N17).

## 0. WNIOSEK NACZELNY (jedno zdanie)
**Wszystko, czego Piotr zażądał dziś rano, jest już zaprojektowane i w większości zbudowane —
rozproszone po 3200 plikach i nigdy nie zespolone ani nie dokończone. To nie jest projekt
projektowania. To projekt DOKOŃCZENIA i SCALENIA.**

Trzy dowody:
1. **Przepływ** (N11: format → tryb → BANG, zakaz formularzy): spisany 3 dni temu w kanonie
   `MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md` §4 — z jawnym zakazem: „Pierwszy ekran
   nie może być tabelą parametrów ani technicznym formularzem". Kod tego nie wykonał.
2. **Generator szablonów 3-kolumnowy** (N14: lewa=kolejność, prawa=klocki, środek=budowanie):
   spisany w TYM SAMYM kanonie §5 — „lista bloków po lewej, wybrany blok w centrum, konfiguracja
   całości i design po prawej". Piotr podyktował dziś to, co zapisaliśmy 24.07.
3. **Mózg pomiędzy** (N8/N16: plan treści → egzekucja na oczach): **istnieje w kodzie** jako
   5-warstwowy `narrativeEngine` (fakty → obserwacje → plan wywodu → język → post-checks),
   wpięty w deck i Word. Problem: pracuje tylko dla **4 z 15 typów slajdów**, **Excela nie dotyka
   w ogóle**, a w dokumentacji nazywa się inaczej (`CONCLUSION_LAYER_STANDARD` K1→K4), więc nikt
   nie wiedział, że go ma.

## 1. CO BIERZEMY WPROST (reuse — zakaz pisania od nowa)

### 1.1 Układ ekranów i menu
| Zasób | Co daje | Gdzie |
|---|---|---|
| **ARTIFACT_ANATOMY_STANDARD** §5, §13 | Alfabet 6 stref (M1/M2/M3/RAIL/PANEL/PPM) + gotowa specyfikacja menu dla archetypów **B Dokument · D Matryca · E Deck** — dosłownie „Document/Wordy", „Table/Spreadsheet", „Presentation/Deck" | `Harvard/wdrozenie-100/` |
| **MODULE_EXECUTIVE_LAYOUT_STANDARD (MELS)** — status LOCKED | Kanon 4 stref (top bar · left rail · canvas · right rail) **dedykowany wyłącznie dla Wordy/Tabele/Prezentacje** + kontrakt `ExecutiveModuleShell` | `docs/product/` |
| **_FORMULA_MENU_NARZEDZI_12** poz. #10-12 | Diff „co jest DZIŚ vs formuła" dla Word/Excel/PowerPoint z dowodami plik:linia | `Harvard/wdrozenie-100/` |
| **Rodzina dokumentów IDEE** (`_MENU3_*`, `_RAIL_LEWY_*`, `_PRAWY_PANEL_IDEE`, `_FAZA0_PARYTET_*`) | **Szablon metody**, którą Piotr każe powtórzyć (N15): plik per strefa×narzędzie, grep-first + żywy render, dowód plik:linia | `Harvard/wdrozenie-100/` |
| **DOKTRYNA_TABELA_NIE_EXCEL** | Rozróżnienie Lista / Excel / Platforma-tabel — warunek wstępny pisania menu Excela | `docs/ui-standards/` |

### 1.2 Mózg i merytoryka
| Zasób | Co daje |
|---|---|
| **`narrativeEngine/` (kod)** | Działający 5-warstwowy silnik: L1 fakty → L2 selekcja → L3 plan wywodu → L4 język (LLM) → L5 post-checks anty-fabrykacja. Wpięty w deck + Word |
| **CONCLUSION_LAYER_STANDARD** (K1→K2→K3→K4) | Doktryna myślenia + testy operacyjne: *„czy to zdanie pasowałoby do dowolnej firmy?"*, *„czy przy przeciwnych danych napisalibyśmy to samo?"* + walidatory maszynowe + 5 wariantów per powierzchnia |
| **DELIVERABLE_STANDARDS_AND_TOOLING** | Twarde kryteria per format: prezentacja ≤6 bulletów/≤8 słów, action-titles, Minto/SCQA/MECE · Word 45-90 znaków w wierszu, one-idea-per-paragraph · Excel wg **IBCS** + konwencja kolorów modelu (niebieskie=wejście, czarne=formuła) |
| **CONSULTING_TEMPLATES_LIBRARY_V3** | **60 metodyk konsultingowych** (GE-McKinsey 9-box, BCG, Porter, Blue Ocean, VRIO) — „prześledzić i ułożyć", już ułożone |
| **BUSINESS_PLAN_GENERATOR_SPEC + SPINE** | Jedyny **dowiedziony** przykład „jeden mózg → 3 formaty z identycznymi liczbami" (testy zielone). Dziś za flagą OFF i niepodpięty — wzorzec do rozszerzenia |
| **Księga faktów (`factRefs`)** | Mechanizm: liczba w materiale = referencja do artefaktu, nie kopia → deck i raport nigdy się nie kłócą. Realnie w kodzie |
| **M17-BAR-HEAD-TO-HEAD** (25.06) | Jedyny realny pojedynek z Gammą na tym samym briefie. Werdykt: Gamma bije nas w tytułach-tezach, chipach sekcji, arsenale layoutów, brandingu, renderze PPTX; my bijemy w ugruntowanych liczbach i finansach klasy CFO |
| **benchmarks/chat-and-ai** | Gotowy wzorzec „na naszych oczach" (split-view + checklista postępu) — N16 |

## 2. CO UNIEWAŻNIAMY (żeby przestało mylić ludzi i agentów)
1. `REPORTS_AND_PRESENTATIONS_OUTPUT_OPERATING_MODEL_V8` (23.03) — model „Raporty i Prezentacje =
   dwa osobne produkty". Sprzeczny z jednym modułem i z „raport = dokument Word".
2. Każdy zapis o **osobnym ekranie startu w stylu Gammy** — Piotr rozstrzygnął: wejście „Z AI" to
   **Teresa**, nie nowy ekran (N10, potwierdzone rano).
3. `_CONSOLIDATED_MENU_TABLE_PREVIEW_2026-06-19` — porzucony draft z TRZECIĄ, sprzeczną definicją
   „Menu 1/2/3". Nigdy nie zaakceptowany.
4. Fragment master-speca o „czystym inpucie Gamma-style" jako bycie **osobnym od Teresy**.
5. Formularz intake (Opis/Typ/Gęstość/Cel/Odbiorcy) jako krok przepływu — łamie kanon §4 i N12.

## 3. CZEGO NAPRAWDĘ BRAKUJE (realne luki, nie do przepisania z dokumentów)
| # | Luka | Klasa |
|---|---|---|
| L1 | **Jeden spis menu dla 3 narzędzi** w formie z IDEI (lewe/prawe/górne, powtarzalne vs osobne, z benchmarkiem) — dziś rozproszony po 3 dokumentach | dokument |
| L2 | **Benchmark układu** dla dokumentów: „u Gammy jest X, u nas Y" prymityw po prymitywie (dla Tabeli taki istnieje, dla Word/Excel/PPT nie) | dokument |
| L3 | **Zero doktryny treści dla Excela** — jest opis, JAK zbudować plik; nic o tym, JAKIE liczby i formuły mają tam być i dlaczego | dokument+kod |
| L4 | **Mózg pokrywa 4 z 15 typów slajdów** i nie dotyka Excela | kod |
| L5 | **Streaming „na oczach" nieopisany jako doktryna** — infrastruktura jest, spec czego user widzi i kiedy — nie ma | dokument+kod |
| L6 | Przepływ N11 **nie jest wykonany w kodzie** (formularz nadal żyje) | kod |
| L7 | Teresa jako wejście „Z AI" **zerwana w punktach** (kickoff ginie; Execution→Prezentacje martwe) | kod |
| L8 | Trzy różne znaczenia „Menu 1/2/3" w dokumentach — źródło fałszywych alarmów | dokument |

## 4. UPROSZCZONY PRZEPŁYW I NAWIGACJA (propozycja do akceptu)

### 4.1 Tworzenie — dwa pytania, zero formularzy
```
[Dodaj]  →  format: Dokument · Prezentacja · Arkusz
         →  start:  Czysto · Z AI · Z szablonu
         →  otwiera się NARZĘDZIE (koniec pytań)
```
- **Czysto** → pusty dokument w edytorze.
- **Z AI** → edytor + **Teresa z boku**; kontekst (projekt/ocena/wywiady) dołączony automatycznie
  i widoczny jako chipy; treść powstaje blok po bloku na oczach.
- **Z szablonu** → galeria szablonów (miniatury) → wybór → dokument już zbudowany wg blueprintu.

Formularz Opis/Typ/Gęstość/Cel/Odbiorcy **znika z przepływu**. Te parametry, jeśli w ogóle
potrzebne, żyją w szablonie albo w rozmowie z Teresą — nigdy jako bramka przed startem.

### 4.2 Nawigacja — jedno wejście, jedna rama
- Sidebar: **Materiały** (jedyne wejście do rezultatów) — już zrobione.
- Menu 1: **5 zakładek** — Wszystkie · Dokumenty · Prezentacje · Arkusze · Szablony — już zrobione.
- Generatory szablonów: **wewnątrz zakładki Szablony** pod „Nowy szablon" — już zrobione.
- Każde studio (Word/Deck/Excel): **rama modułu** — breadcrumb `Materiały › Dokumenty › [nazwa]`
  + powrót. (P1 planu — do zrobienia)
- Wejście kontekstowe z innych modułów („Przygotuj materiał z tej inicjatywy") — kontrakt
  `sourceContext` istnieje, dwa punkty są martwe → naprawić.

### 4.3 Generator szablonów — jeden układ, trzy formaty
Lewa: kolejność bloków (slajdy/sekcje/arkusze) · Środek: wybrany blok + reguły · Prawa: klocki
i konfiguracja całości. Baza: **Architekt szablonów prezentacji** (istnieje, dojrzały) — Word
i Excel wyrównujemy do niego, nie odwrotnie.

## 5. PLAN WDROŻENIA

### FAZA A — KANON NA PAPIERZE (1 dzień, Fable + Sonnet)
- **A1** `_KANON_MENU_3_NARZEDZIA.md`: scalić ARTIFACT_ANATOMY §5/§13 + MELS + _FORMULA_MENU #10-12
  w JEDEN spis: dla Word/Excel/PPT — góra, lewy rail, prawy panel, PPM; kolumna
  **wspólne vs swoiste**; dowód plik:linia „jak jest dziś". Format 1:1 jak dokumenty IDEI. [L1, L8]
- **A2** `_BENCHMARK_UKLAD_DOKUMENTY.md`: pojedynek układu z Gammą/Notion/Canva — prymityw po
  prymitywie, wzorzec `_FAZA0_PARYTET_TABELA_AIRTABLE`. [L2]
- **A3** `_DOKTRYNA_TRESCI_EXCEL.md`: czego nie ma wcale — jakie liczby, jakie formuły, jaka
  struktura arkusza dla typów zadań; oparte o IBCS + progi z BUSINESS_PLAN_GENERATOR. [L3]
- **A4** `_DOKTRYNA_STREAMING.md`: co user widzi i kiedy (plan → bloki po kolei → gotowe). [L5]
- **A5** Unieważnić 5 pozycji z §2 (nagłówki SUPERSEDED + wpis w rejestrze).

### FAZA B — PRZEPŁYW (2 dni, Sonnet, prototyp Opus)
- **B1** Wyrzucić formularz intake z przepływu; „Z AI" prowadzi do Teresy z kontekstem. [L6]
- **B2** Naprawić Teresę jako wejście: kickoff dla wszystkich formatów, Execution→Prezentacje. [L7]
- **B3** Rama modułu w 3 studiach (breadcrumb + powrót).
- **B4** Galeria szablonów z miniaturami zamiast tabeli nazw (sylwetki już istnieją).

### FAZA C — MÓZG (3 dni, Opus rdzeń + Sonnet obrzeża)
- **C1** Rozszerzyć L4 silnika z 4 na wszystkie sensowne typy slajdów. [L4]
- **C2** Wpiąć Excel w silnik + wdrożyć doktrynę z A3. [L3, L4]
- **C3** Streaming blok-po-bloku wg A4 — widoczna egzekucja. [L5]
- **C4** Podpiąć wzorzec SPINE (jeden mózg → 3 formaty, identyczne liczby) — dziś za flagą OFF.

### FAZA D — GENERATORY SZABLONÓW (2 dni, Sonnet)
- **D1** Word i Excel do układu 3-kolumnowego (baza: Architekt prezentacji).
- **D2** Zapisany szablon realnie steruje generacją dla wszystkich 3 formatów (deck i raport
  zrobione, Excel zostaje).

### RÓWNOLEGLE (cały czas)
Złota suita E2E po każdej fali · demo + tag po każdej partii · rytm akceptów rano/wieczorem.

## 6. KOLEJNOŚĆ I UZASADNIENIE
**Faza A pierwsza** — bo bez jednego kanonu na papierze fazy B/C/D znów rozjadą się na trzy
strony, dokładnie jak przez ostatnie miesiące. To jeden dzień, który chroni cały tydzień.
Fazy B i C mogą iść równolegle po A (różne warstwy: przepływ vs treść).
