# CODEX DAY 354 — etykiety narzędzi fazowych

## Werdykt

R1, R2, R3 i R5 wykonane. R4: PARTIAL / NOT_PROVEN dla zmienionych typów narzędzia; wskazany ekran dynamic-swot daje identyczne kadry PRZED/PO, ponieważ pięć widocznych etykiet było już poprawionych na markerze. Nie wymyślono różnicy w harnessie.

## Baza, marker i rozejście

`MARKER OK`. Sanity: `29fcbd4de20ca26d2febc50d9455128cab47ffce`, czysty status. Dysk: 40 GiB wolnego. Porty 6413/5553 były wolne; baza nie była potrzebna i kontener nie został uruchomiony. Tip bazowy wyprzedzał marker o siedem commitów dotyczących instrukcji i szkieletu; żaden plik produktu z zakresu nie różnił się.

## Korekty wobec instrukcji

- `~73` podejrzanych etykiet: obalone. Parser wymaganych wariantów i ternary wielowierszowych znalazł w badanym pliku 2 A + 34 B = 36.
- Mianowniki autora 105/256/3756 ternary były oparte na węższym kształcie. Własny pomiar: 119/350/4355; A: 2/8/83; B: 34/55/481 odpowiednio dla pliku, rodziny i całego src.
- Instrukcja wskazywała pięć wystąpień bramkowania typem na starych liniach. Bieżący grep znalazł 21 wystąpień `toolType === 'dynamic-swot'`; kafle nadal są bramkowane typem, nie flagą.
- Komenda kontroli konfliktów z podstawieniem wielowierszowej listy nazw próbowała uruchamiać kolejne pliki jako polecenia. Bezpieczny wariant NUL (`git diff --cached --name-only -z | xargs -0 grep`) dał zero konfliktów.
- Komenda esbuild bez wejściowego pliku w R1 zwróciła błąd flagi; dla każdej partii ze zmienionym TS/TSX uruchomiono esbuild z jawnymi ścieżkami i przeszedł.

## R1 — inwentarz

Pełna tabela 63 trafień rodziny jest w `evidence/etykiety-narzedzi-20260904/r1-inwentarz.md`. Szukane warianty: isPolish, isPL, lang/language === pl, i18n.language === pl, i18n.language?.startsWith(pl). Kategorie: DEFEKT, UZASADNIONA IDENTYCZNOŚĆ, PROPOZYCJA. Dług poza zakresem: całe src ma 83 A i 481 B według pełnego parsera.

## R2 — bezpiecznik

Skrypt importuje `justification`, ma ratchet oraz podłogę 150 plików / 300 ternary. Przed naprawą: 162 pliki, 350 ternary, 6 nieuzasadnionych A. Mutacje: Mission & Context podniosło dług do 7 i dało exit 1 z plik:linia; Status+SWOT zachowało dług 6 i exit 0; nieistniejący zakres dał 0/0 i exit 1. Po każdym przywróceniu przez cp diff produktu był pusty. Dwa testy bezpiecznika PASS.

## R3 — naprawa

Naprawiono 20 literałów: A=2, B=18. Źródła: title.pl w dynamicSwot, growthPaths, portfolioPriority, riskUncertainty i odpowiadające im fazy Wyniki i działania. Ratchet: 6 -> 4 -> 4; baseline obniżony do 4. Kształt B w badanym pliku: 34 -> 17 (zmienione `Trade-offy i priorytety` nadal jest wykrywane jako B, lecz pochodzi dosłownie z title.pl). Esbuild PASS. Celowany pakiet: 8/8 PASS.

Pełny przelot katalogów wykonał 45 przypadków: 42 PASS, 3 FAIL. Jeden błąd był iteracją testu podczas ustawiania języka i został naprawiony; dwa zastane FAIL dotyczą czterech brakujących kluczy Idea Workspace w obu słownikach. To zakres obcy, public/locales jest jawnie nietykalne. Pułapki DB/auth nie dotyczą tych czysto frontowych testów (`RUN_DB_TESTS=0 MOCK_DB=true`); pułapka pustego pomiaru wyłączona przez odczyt numTotalTests i pełnych nazw z JSON.

Diff nazw PRZED/PO: dodano dwa testy bezpiecznika i `renders Polish phase labels by their SSOT names`; nie zniknął żaden przypadek.

## Propozycje do akceptu właściciela

| plik:linia | obecny PL | obecny EN | proponowany PL | dlaczego nie ma w paczce |
| --- | --- | --- | --- | --- |
| toolCompletion.ts:185 | Określ ścieżki outputów | Define the output routes | Określ ścieżki wyników | brak osobnego title.pl dla output routes |
| toolCompletion.ts:319,351,389,424,461 | Brak kandydatów outputów | Missing output candidates | Brak kandydatów wyników | brak title.pl dla output candidates |
| toolCompletion.ts:412,662 | sygnały portfolio | portfolio signals | sygnały portfela | brak title.pl dla signals |
| toolCompletion.ts:415 | elementów portfolio | portfolio items | elementów portfela | title.pl opisuje całą fazę, nie komunikat braku |
| toolCompletion.ts:418 | trade-offów portfolio | portfolio trade-offs | kompromisów portfela | brak title.pl dla komunikatu braku |
| toolCompletion.ts:492 | Brak pomiaru baseline | Missing baseline measurement | Brak pomiaru bazowego | instrukcja jawnie klasyfikuje jako propozycję |
| toolCompletion.ts:495 | Brak re-estymacji target | Missing target re-estimation | Brak ponownego oszacowania celu | instrukcja jawnie klasyfikuje jako propozycję |
| SWOTCorrelationsStep.tsx:90,94,98,101 | Attack / Repair / Defend / Protect | identyczne | Atak / Naprawa / Obrona / Ochrona | brak odpowiadających title.pl |
| ToolDocumentView.tsx:2321 | krok Input & Exploration | Input & Exploration | krok Wejście i eksploracja | brak osobnego title.pl dla całego zdania |
| EvidenceEditor.tsx:172 | benchmark | benchmark | punkt odniesienia | brak title.pl dla placeholdera |
| SWOTInsightsPhase.tsx:259,284,945 | high-impact / deadline / trigger / trade-off | angielskie rdzenie | wysoki wpływ / termin / wyzwalacz / kompromis | brak odpowiadających title.pl dla zdań |

Pozostałe trafienia oznaczone PROPOZYCJA w R1 są internacjonalizmami lub markami (`panel`, `Report Builder`) i wymagają decyzji, czy wspólny rejestr justification ma je uznać za poprawne; nie dopisano wyjątków na sztywno.

## R4 — granica dowodu wizualnego

5 kafli, 5 tekstów zgodnych z title.pl, 0 angielskich rdzeni — w light i dark, PRZED i PO. Kadr obejmuje drzewo i kafle. Sumy: light `7a6d381c...9167b`, dark `198bcd46...1ca0e`, identyczne PRZED/PO. To uczciwy STOP R4, nie dowód zmiany. Harness montuje realny ToolDocumentView i computeDynamicSwotPhaseSummaries, lecz nie gałęzie portfolio/risk zmienione w R3.

## Ryzyko

Kafle są bramkowane typem narzędzia, nie flagą; po scaleniu widzi je każdy użytkownik. Nie dodano ani nie przełączono flagi.

## Niewykonane

- Wizualna różnica PRZED/PO dla 20 zmienionych literałów: NOT_PROVEN, brak licencjonowanego ekranu odpowiednich typów.
- Dwa zastane FAIL słowników Idea Workspace: poza zakresem i zakaz zapisu public/locales.
- Baza: nieuruchomiona, bo żaden test jej nie wymagał.

## Bramki końcowe

Słowniki: pl 35199, en 33066 — bez zmian. `etykiety=0`, `focus=0`, `list=0`, `artefakt=0`, `reach=0`. Celowany pakiet końcowy: 8/8 PASS, zero znikniętych pełnych nazw testów. Zero zmian w public/locales, MODULE_ACCEPTANCE, grafika-zrzuty i i18n-pl-audyt.
