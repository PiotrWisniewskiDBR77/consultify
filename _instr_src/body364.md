## Po co ten dyżur istnieje

Dyżur 354 zrobił dobrą robotę i został scalony. Naprawił **20 literałów** w
`src/components/DiscoveryTools/toolCompletion.ts`: 2 o identycznych gałęziach warunku języka
(`isPolish ? 'X' : 'X'`) i 18 hybryd (gałąź polska trzymała angielskie słowo). Polskie nazwy
wziął **dosłownie z `title.pl` paczek**, nie z własnej głowy. Bezpiecznik dostał pięć dowodów
mutacyjnych — czerwieni się na defekcie, **nie** czerwieni na `'Status'` i `'SWOT'`, czerwieni
przy zerze obiektów, przy złym zakresie i przy zmalałym długu — i **importuje** `justification`
ze `scripts/dev/i18n-pl-audyt.mjs`, zamiast go kopiować.

**★★ A potem odbiorca spojrzał na zrzut i zobaczył kafel „Synteza i napięcia” obok drzewa
„Synteza i wnioski”.** Poszedł głębiej i znalazł dwie rzeczy, których 354 nie objął:

1. **Kształt `namePl:` nie jest skanowany przez bezpiecznik w ogóle**, a plik
   `src/store/useToolStore.ts` **nie leży nawet w zakresie skanu**. Pola `namePl` trzymają
   tam czysty angielski — dokładnie dla tych narzędzi, które 354 naprawiał:
   `Portfolio Items & Matrix`, `Trade-offs & Priorities`, `Ansoff Options Build`,
   `Five Forces Build`, `Outputs & Actions`.
2. **18 z 20 napraw dyżuru 354 nie ma żadnej ochrony regresyjnej.** Ratchet wykrywa tylko
   kształt „obie gałęzie identyczne”. Hybryda — polska gałąź z angielskim słowem — przechodzi
   przez niego bez śladu. Jutro ktoś może cofnąć osiemnaście z dwudziestu napraw i żadna
   bramka tego nie zauważy.

**To nie jest za flagą.** Drzewo faz i nagłówek czytają `namePl` w **ośmiu** miejscach
(`ToolCanvas.tsx:1024`, `:1075`; `ToolDocumentView.tsx:1095`, `:1243`, `:1287`, `:1832`,
`:1930`; `ToolHeader.tsx:203`), bramkuje je wyłącznie `toolType`, a nie flaga. Polski
użytkownik zobaczy angielskie nazwy faz **od razu po scaleniu, bez włączania czegokolwiek**.

## ★★ CZEGO NIE PRZYJMUJESZ NA WIARĘ — trzy liczby ze zlecenia, które mój pomiar zmienił

**(a) „18 pól `namePl` trzyma czysty angielski”.** To liczba odbiorcy, nie moja.
**Mój pomiar daje 23 w `src/store/useToolStore.ts` i 27 w całej `src/`:**

| Plik | Literałów `namePl:` identycznych z sąsiednim `name:` | Uwaga |
| --- | ---: | --- |
| `src/store/useToolStore.ts` | **23** | 20 w czterech rodzinach + `Sizing`, `Backlog`, `Redesign` |
| `src/config/transformationTools.ts` | **3** | `SMED`, `Six Sigma DMAIC`, `Process Mining` — nazwy własne metodyk |
| `src/components/DiscoveryTools/__tests__/toolCanvas.smoke.test.tsx` | **1** | `"Unknown"` — plik testowy |
| **razem `src/`** | **27** | z **331** wszystkich literałów `namePl:` |

**Zmierz to sam.** Jeżeli Twoja liczba jest inna od 23, 27 i 331 — obowiązuje Twoja, a różnicę
zapisujesz wprost. Nie zaczynasz naprawy przed podaniem własnej liczby.

**(b) „kafle bramkuje `toolType === 'dynamic-swot'` w pięciu miejscach `ToolDocumentView.tsx`”.**
**Mój pomiar tego nie potwierdza.** W tym pliku jest **20** wystąpień tego warunku, a funkcja
kafli `computeDynamicSwotPhaseSummaries` ma **dokładnie jedno** wywołanie (linia 529) — i **nie
istnieje jej odpowiednik** dla `market-forces`, `growth-paths`, `portfolio-priority`,
`risk-uncertainty`. W `toolCompletion.ts` są tylko funkcje `computeDynamicSwot*`,
`computeToolReviewGaps` i `computeToolCompletionItems`.

**Konsekwencja dla dowodu wizualnego:** obrazek „polska lista kontrolna obok angielskiego
drzewa” dla czterech rodzin **prawdopodobnie nie istnieje**, bo te narzędzia w ogóle nie
renderują kafli. To, co realnie widzi polski użytkownik, to **angielskie nazwy faz w drzewie
i w nagłówku**. **Sprawdź to sam w `R1` i zbuduj dowód `R5` na tym, co się faktycznie
renderuje** — nie na tym, co napisałem.

**(c) Niezgodność „Synteza i napięcia” / „Synteza i wnioski”** jest realna, ale to **inny
defekt**: obie nazwy są polskie, tylko różne. Kafel bierze
`toolCompletion.ts:156` (`'Synteza i napięcia'`), drzewo bierze
`useToolStore.ts:1400` (`'Synteza i wnioski'`). To jest niezgodność SSOT wewnątrz polszczyzny,
a nie angielszczyzna. **Rozstrzygnij ją osobno i nie wliczaj do liczby z punktu (a).**

## ★ Stan zastany bezpiecznika, zmierzony przeze mnie na markerze `2a7273e087cbd3e44344725b524f6ddd79d5badc`

`scripts/dev/check-etykiety-dwujezyczne.mjs`:

| Cecha | Wartość zmierzona | Czego NIE obejmuje |
| --- | --- | --- |
| zakres skanu | `src/components/DiscoveryTools`, `src/toolPacks` | **`src/store/useToolStore.ts`**, `src/config/**`, reszta `src/` |
| wzorzec | ternary `(isPolish\|isPL\|lang===pl\|…) ? 'x' : 'y'` | **kształt `namePl: '…'`**, kształt obiektu `{ pl, en }` |
| co uznaje za defekt | `pl === en` **i** `justification(pl) === null` | **hybrydę** — `pl !== en`, ale `pl` jest angielskie |
| plik bazowy | `maxUnjustifiedIdentical: 4`, `minFiles: 150`, `minTernaries: 300` | — |
| bieżący przebieg | pliki **162**, ternary **350**, nieuzasadnione **4**, `exit 0` | — |

Cztery obecne nieuzasadnione to `SWOTCorrelationsStep.tsx:90,94,98,101`
(`Attack` / `Repair` / `Defend` / `Protect`) — 354 zapisał je jako **propozycje do akceptu
właściciela**, nie jako defekty do cichej naprawy. **Nie ruszasz ich bez decyzji właściciela.**

## ★★ Pułapka arytmetyczna, którą musisz rozwiązać ZANIM rozszerzysz zakres

Rozszerzenie skanu na całą `src/` wciągnie do licznika także wartości, których polskość jest
sporna. `justification()` (zaimportowany, nie kopiowany) zwraca:

| Wartość | `justification()` | Co to znaczy |
| --- | --- | --- |
| `SMED` | `"skrót lub kod techniczny"` | **UZASADNIONE** — nie liczy się do długu |
| `SWOT` | `"skrót lub kod techniczny"` | **UZASADNIONE** |
| `Status` | `"poprawny polski internacjonalizm"` | **UZASADNIONE** |
| `Six Sigma DMAIC` | `null` | **NIEUZASADNIONE** — wpadnie do licznika |
| `Process Mining` | `null` | **NIEUZASADNIONE** |
| `Sizing`, `Backlog`, `Redesign` | `null` | **NIEUZASADNIONE** |
| `Portfolio Items & Matrix`, `Five Forces Build`, `Outputs & Actions` | `null` | **NIEUZASADNIONE** — i słusznie |

**Progu `maxUnjustifiedIdentical: 4` nie wolno podnieść.** Masz trzy uczciwe wyjścia i musisz
wybrać jedno, uzasadniając wybór:

- **naprawić** wartość (jeśli polski odpowiednik istnieje w paczce);
- **uzasadnić** ją, dopisując do mapy `exact` w `scripts/dev/i18n-pl-audyt.mjs` —
  **i wtedy wypisujesz każdą dopisaną wartość z nazwy w raporcie**, bo to jest jedyne miejsce,
  w którym da się uciszyć realny defekt bez śladu;
- **oddzielić licznik** — osobne, jawnie nazwane pole bazowe dla nowego kształtu, z pisemnym
  uzasadnieniem, dlaczego to nie jest obejście ratcheta.

**Czwartego wyjścia — podniesienia progu — nie ma.**

## ★ Zmierz moje liczby sam

Twierdzę, na markerze:

- literałów `namePl:` w `src/`: **331**; identycznych z sąsiednim `name:`: **27**;
- w `src/store/useToolStore.ts`: **23** (nie 18 — to liczba odbiorcy);
- z tego **20** w czterech rodzinach (`PORTER_STEPS`, `GROWTH_PATHS_STEPS`,
  `PORTFOLIO_PRIORITY_STEPS`, `RISK_UNCERTAINTY_STEPS`) i **3** jednowyrazowe
  (`Sizing`, `Backlog`, `Redesign`);
- polskich odpowiedników w paczkach: **20 z 20** — po pięć `title.pl` w każdej z czterech paczek;
- miejsc renderujących `step.namePl`: **8**, z czego jedno (`ToolDocumentView.tsx:1930`)
  ma naprawę per wywołanie dla trzech identyfikatorów faz;
- wystąpień `toolType === 'dynamic-swot'` w `ToolDocumentView.tsx`: **20** (zlecenie mówiło o pięciu);
- wywołań `computeDynamicSwotPhaseSummaries`: **1**; funkcji kafli dla pozostałych czterech
  narzędzi: **0**;
- bezpiecznik na markerze: **162 pliki / 350 ternary / 4 nieuzasadnione**, `exit 0`;
- liście słowników: **pl 35199**, **en 33066**; cztery bezpieczniki kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: DEFINICJA · MAPA · RENDERER · PACZKA · BEZPIECZNIK · TESTY · HARNESS · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest
**ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Definicja faz (SSOT runtime)** | `src/store/useToolStore.ts` — wyłącznie pola `namePl:` w tablicach `*_STEPS` | **★ PEŁNA LICENCJA NA ZMIANĘ WARTOŚCI `namePl`**, pod warunkiem że każda nowa wartość ma wskazane źródło `title.pl` w paczce (`plik:linia`). **Zakaz zmiany `id`, `name`, `description`, `descriptionPl`, `required`, `aiAssisted` i całej reszty pliku** | — |
| **Mapa `toolType` → kroki** | `src/store/useToolStore.ts:2740-2790`, `getStepDefinitions()` | **TYLKO ODCZYT** — to jest wołacz, który dowodzi żywotności; nie zmieniasz go | Opis w raporcie |
| **Paczki (źródło polszczyzny)** | `src/toolPacks/packs/*.pack.ts`, `src/toolPacks/contract.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To jest źródło prawdy; dopasowujesz kod do paczki, nigdy odwrotnie | Cytat `plik:linia` + brief |
| **Renderery `namePl`** | `src/components/DiscoveryTools/ToolCanvas.tsx`, `ToolDocumentView.tsx`, `ToolHeader.tsx` | **★ WĄSKA LICENCJA:** wolno **usunąć nakładkę per wywołanie** w `ToolDocumentView.tsx:1930`, jeżeli `R4` naprawi definicję — i **wyłącznie** razem z dowodem, że wszystkie osiem miejsc pokazuje tę samą polską nazwę. Zakaz jakiejkolwiek innej zmiany w tych plikach | Brief z `plik:linia` + diff **nienałożony** |
| **Kafle listy kontrolnej** | `src/components/DiscoveryTools/toolCompletion.ts` | **★ WĄSKA LICENCJA POD WARUNKIEM `R1`:** wolno ujednolicić `'Synteza i napięcia'` (linia 156) z drzewem **albo odwrotnie** — ale **tylko po rozstrzygnięciu, która nazwa jest kanoniczna**, ze wskazaniem `title.pl` paczki `dynamicSwot`. Zakaz zmiany logiki liczenia | Brief |
| **Bezpiecznik etykiet** | `scripts/dev/check-etykiety-dwujezyczne.mjs`, `scripts/dev/check-etykiety-dwujezyczne.baseline.json` | **★ PEŁNA LICENCJA NA ROZSZERZENIE** o kształt `namePl:` i o zakres skanu. **Zakaz podniesienia `maxUnjustifiedIdentical` i obniżenia `minFiles`/`minTernaries`** | — |
| **Słownik uzasadnień** | `scripts/dev/i18n-pl-audyt.mjs` | **★ WĄSKA LICENCJA:** wolno dopisać do mapy `exact` wyłącznie nazwy własne, akronimy i standardy — **każda dopisana wartość wypisana z nazwy w raporcie**, do przeglądu właściciela. Zakaz zmiany `justification()` w sposób, który przepuszcza całe klasy wartości | Brief |
| **Testy bezpiecznika** | `tests/unit/i18n/checkEtykietyDwujezyczne.test.ts` | **★ PEŁNA LICENCJA na rozszerzenie** o przypadki nowego kształtu | — |
| **Nowe testy** | `tests/**` (nowe pliki, `git add -f`) | **★ PEŁNA LICENCJA.** **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** — `src/store/__tests__/swotStepLocale.test.ts` jest zastanym wyjątkiem i nie powielasz tego wzorca | — |
| **Zastany test lokalizacji kroków** | `src/store/__tests__/swotStepLocale.test.ts` | **★ WĄSKA LICENCJA:** wolno **rozszerzyć asercje** o pozostałe rodziny, jeżeli uznasz to za najkrótszą drogę do ochrony; **zakaz osłabienia istniejących asercji** | — |
| **Harness (dev-render)** | `dev-render/main.tsx`, `dev-render/screens/**` | **★ WĄSKA LICENCJA:** wolno dodać **jeden** nowy wpis `SCREENS` montujący **realny** komponent produktu (wzór: `tools-swot-session-workspace`, który montuje realny `ToolDocumentView`) z innym `toolType`. **Zakaz atrapy zamiast komponentu produktu i zakaz zmiany istniejących wpisów** | Opis w raporcie, jeżeli nie da się dodać |
| **Narzędzie zrzutów** | `scripts/dev/grafika-zrzuty.mjs` | **NIETYKALNE DO ZAPISU.** Wolno **wołać** z istniejącymi opcjami. ★ Zakaz własnego skryptu zrzucającego obok kanonicznego | Opis w raporcie |
| **Słowniki** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **NIETYKALNE DO ZAPISU.** Liście nie mogą zmaleć **ani urosnąć** od tego dyżuru | Opis w raporcie |
| **Serwer** | `server/**` | **TYLKO ODCZYT** | Brief |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`** | Opis w raporcie |
| **Dowody** | `evidence/etykiety-namepl-20260904/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**) | **★ PEŁNA LICENCJA na tworzenie**; commitujesz przez `git add -f` | — |
| **Dowody 354** | `evidence/etykiety-narzedzi-20260904/**` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To baza porównania | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł**, w tym `03_TOOLS` | Rekomendacja w raporcie |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze** (`AA`, `AB`, …), sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY364_NAMEPL_RODZINA_REPORT.md` (**NOWY**) | `R6` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `evidence/g15/**` i wszystko wokół bramki `G15` (dyżur 363) · `src/components/standard/StandardPreview.tsx`, `scripts/dev/grafika-zrzuty.mjs`, `evidence/podglad-relations-20260904/**` (dyżur 365) · `tests/unit/assessment/day351.assessmentCompleteness.test.ts`, `server/src/routes/assessment/assessment-hub.routes.ts`, `server/src/services/legacyCutover/**` (dyżur 366) · wiersze macierzy i rejestry bramek (dyżury 359-362) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC ANI UROSNAC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35199, en 33066

# (b) cztery bezpieczniki kanonu maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: wszystkie 0

# (c) bezpiecznik etykiet — PRZED i PO
node scripts/dev/check-etykiety-dwujezyczne.mjs; echo "etykiety=$?"
#   moje liczby przy wydaniu: pliki=162, ternary=350, nieuzasadnione=4, exit 0
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | literałów `namePl:` w `src/` | `331` | komenda (1) z `§0.3` | TAK — całe drzewo `.ts`/`.tsx`, nie jeden plik |
| 2 | identycznych z sąsiednim `name:` | `27` | komenda (1) | TAK — porównuje z NAJBLIŻSZYM poprzedzającym `name:` |
| 3 | z tego w `useToolStore.ts` | `23` | komenda (1) | TAK — **obala liczbę 18 ze zlecenia; zmierz sam** |
| 4 | czterech rodzin / jednowyrazowych | `20` / `3` | komenda (2) | TAK |
| 5 | polskich odpowiedników w paczkach | `20` | komenda (4) | TAK — po `id` fazy, nie po `name` |
| 6 | zakres i wzorzec bezpiecznika | 2 katalogi / 1 kształt | komenda (3) | TAK — **to jest dowód luki, nie opinia** |
| 7 | stan bezpiecznika na markerze | `162 / 350 / 4` | komenda (3) | TAK |
| 8 | wystąpień `toolType === 'dynamic-swot'` | `20` | komenda (5) | TAK — **obala „pięć miejsc” ze zlecenia** |
| 9 | wywołań funkcji kafli | `1`, brak odpowiedników | komenda (5) | TAK — **obala tezę o kaflach czterech rodzin** |
| 10 | miejsc renderujących `step.namePl` | `8` | komenda (6) | TAK — **to jest rodzina wołaczy** |
| 11 | liczba naprawionych etykiet PO | — | własny przemiar `R4`, po NAZWACH | TAK — `Z37` |
| 12 | liście słowników PL/EN | `35199` / `33066` | blok (a) „WARUNKÓW WSPÓLNYCH” | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY364_NAMEPL_RODZINA_REPORT.md` ·
`evidence/etykiety-namepl-20260904/**` (nowy katalog) ·
`scripts/dev/check-etykiety-dwujezyczne.mjs` (+ plik bazowy) ·
`tests/unit/i18n/checkEtykietyDwujezyczne.test.ts`.

**Zapisujesz WARUNKOWO:**
`src/store/useToolStore.ts` (wyłącznie wartości `namePl`) ·
`src/components/DiscoveryTools/toolCompletion.ts` (wyłącznie po rozstrzygnięciu `R1`) ·
`src/components/DiscoveryTools/ToolDocumentView.tsx` (wyłącznie nakładka `:1930`) ·
`scripts/dev/i18n-pl-audyt.mjs` (wyłącznie mapa `exact`, każda wartość wypisana w raporcie) ·
`src/store/__tests__/swotStepLocale.test.ts` (wyłącznie rozszerzenie asercji) ·
`dev-render/main.tsx` + jeden nowy plik w `dev-render/screens/` ·
nowe pliki testowe w `tests/` (`git add -f`) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `public/locales/**`, `server/**`, `src/toolPacks/**`,
`src/components/DiscoveryTools/tools/DynamicSWOT/SWOTCorrelationsStep.tsx` (cztery propozycje
czekają na decyzję właściciela), `scripts/dev/grafika-zrzuty.mjs`, `tests/setup.ts`,
`tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`,
`.github/workflows/**`, `server/migrations/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (**wszystkie 16**),
`evidence/etykiety-narzedzi-20260904/**`, `evidence/g15/**`,
`evidence/podglad-relations-20260904/**`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day364-namepl-rodzina
git diff --name-only --cached | tee /private/tmp/cx-day364-namepl-rodzina-artefakty/staged.txt
bash -c "grep -iE '^public/locales/|^server/|^src/toolPacks/|SWOTCorrelationsStep|grafika-zrzuty|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE|etykiety-narzedzi-20260904|evidence/g15|podglad-relations' /private/tmp/cx-day364-namepl-rodzina-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Własna liczba przed pierwszą naprawą.** Podajesz swój pomiar rodziny `namePl:` w całej
`src/` — trzy liczby: wszystkich literałów, identycznych z `name:`, i tych w `useToolStore.ts`.
Dopiero potem wolno Ci cokolwiek zmienić. **Liczba 18 ze zlecenia i liczba 23 z tej instrukcji
są cudze; obowiązuje Twoja.**

**(2) Polska nazwa pochodzi z paczki albo jest propozycją.** Dla każdej naprawionej etykiety
podajesz `plik:linia` w `src/toolPacks/packs/*.pack.ts`, z którego wzięła się nazwa.
Nie ma źródła → nie ma naprawy; jest **propozycja do akceptu właściciela** w osobnej tabeli.

**(3) Próg bezpiecznika jest nietykalny.** `maxUnjustifiedIdentical: 4` nie rośnie,
`minFiles: 150` i `minTernaries: 300` nie maleją. Rozszerzenie zakresu, które podnosi licznik
długu, rozwiązujesz naprawą, uzasadnieniem albo osobnym licznikiem — nigdy progiem.

**(4) Naprawa idzie do DEFINICJI, nie do wołacza.** `ToolDocumentView.tsx:1930` już raz
zamaskował „Outputs & Actions” w jednym z ośmiu miejsc. Ten kształt odrasta.

**Wymagany dowód:** cztery zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — WŁASNY POMIAR CAŁEJ RODZINY I WERYFIKACJA TEZY O KAFLACH (rdzeń)

**KROK 0 — wypisz rodzeństwo, zanim cokolwiek naprawisz.**

1. **Policz kształt `namePl:` w CAŁEJ `src/`** (nie w jednym pliku). Zapisz tabelę
   `evidence/etykiety-namepl-20260904/r1-rodzina.tsv`: plik · linia · `name` · `namePl` ·
   `IDENTYCZNE`/`RÓŻNE` · czy w `namePl` są polskie znaki diakrytyczne · `justification()`.
   **Podaj trzy liczby i porównaj je z moimi (331 / 27 / 23).**
2. **Policz drugi kształt tej samej rodziny:** obiekt `{ pl: '…', en: '…' }` w paczkach
   i w `ToolDocumentView.tsx`. Powiedz, ile z nich trzyma identyczne wartości i ile z tego
   jest uzasadnionych.
3. **Zweryfikuj tezę o kaflach.** Policz wystąpienia `toolType === 'dynamic-swot'`
   w `ToolDocumentView.tsx`, wywołania `compute*PhaseSummaries` i funkcje `compute*`
   w `toolCompletion.ts`. **Odpowiedz wprost na jedno pytanie: czy narzędzia
   `market-forces`, `growth-paths`, `portfolio-priority`, `risk-uncertainty` renderują
   kafle listy kontrolnej — TAK czy NIE.** Od tej odpowiedzi zależy kształt dowodu `R5`.
4. **Wypisz osiem miejsc renderujących `step.namePl`** i zaznacz, które z nich mają nakładkę
   per wywołanie. To jest rodzina wołaczy i naprawa ma objąć wszystkie osiem naraz.
5. **Rozstrzygnij niezgodność „Synteza i napięcia” / „Synteza i wnioski”.** Podaj, która
   z dwóch nazw ma pokrycie w `title.pl` paczki `dynamicSwot`, i zapisz to jako osobne
   znalezisko — **nie wliczaj go do liczby z punktu 1**.

**Wymagany dowód:** `r1-rodzina.tsv` z trzema liczbami · lista rozbieżności wobec 331/27/23/20/5 ·
jednoznaczna odpowiedź TAK/NIE o kaflach czterech rodzin · tabela ośmiu wołaczy ·
rozstrzygnięcie niezgodności SWOT. **Commit po `R1`.**

## R2 — BEZPIECZNIK: DRUGI KSZTAŁT, SZERSZY ZAKRES, MUTACJA W OBIE STRONY (rdzeń)

1. **Rozszerz `scripts/dev/check-etykiety-dwujezyczne.mjs`** o kształt `namePl:` (pole
   porównywane z najbliższym poprzedzającym `name:`) i o zakres obejmujący
   `src/store/useToolStore.ts`. Zakres podajesz **jawnie w kodzie**, nie przez „całe `src/`
   i zobaczymy” — a jeżeli wybierzesz całe `src/`, to musisz rozstrzygnąć wszystkie wartości
   z tabeli pułapki arytmetycznej wyżej.
2. **`justification` importujesz**, nigdy nie kopiujesz — tak jak zrobił 354.
3. **Podłoga liczebności musi objąć nowy kształt.** Dziś są dwie (`minFiles`, `minTernaries`).
   Dodaj trzecią — minimalną liczbę zeskanowanych literałów `namePl:` — bo inaczej bezpiecznik
   przechodzi, gdy przestanie cokolwiek znajdować. **„Brak pomiaru nie jest wynikiem.”**
4. **DOWÓD MUTACYJNY W OBIE STRONY**, obowiązkowy, w tym samym commicie:
   - **czerwieni się na defekcie:** wstaw do dowolnej tablicy `*_STEPS` nową parę
     `name: 'Some English Phrase'` / `namePl: 'Some English Phrase'` → bezpiecznik ma
     **zakończyć się kodem 1** i wypisać `plik:linia`;
   - **NIE czerwieni się na uzasadnionej identyczności:** `SMED`, `SWOT`, `Status` mają
     przejść (`justification()` zwraca dla nich powód) → bezpiecznik **kod 0**;
   - **czerwieni się przy zerze obiektów:** ustaw zakres na katalog bez plików → **kod 1**
     (podłoga liczebności), nie „OK, nic nie znalazłem”;
   - **czerwieni się przy zmalałym długu bez obniżenia bazy** — jeżeli Twój ratchet ma tę
     własność, pokaż ją; jeżeli nie ma, napisz to wprost.
   Każdą mutację cofasz przez `cp` ze `SCRATCH` (nigdy `git stash`, `Z27`); `git diff` po
   cofnięciu **pusty**. Obie komendy i oba wyniki **dosłownie** w raporcie.
5. **Rozszerz test bezpiecznika** `tests/unit/i18n/checkEtykietyDwujezyczne.test.ts`
   o przypadki nowego kształtu. **Asercja na ZACHOWANIU** (kod wyjścia, treść komunikatu),
   **nigdy na tekście źródła skryptu** — ten drugi kształt przepuścił już dziś dwie mutacje
   w innym dyżurze.

**Wymagany dowód:** diff bezpiecznika · nowy plik bazowy z jawnym progiem · cztery mutacje
z dosłownymi komendami i wynikami · `git diff` pusty po każdym cofnięciu · wynik testu
bezpiecznika PRZED i PO. **Commit po `R2`.**

## R3 — DOMKNIĘCIE OCHRONY OSIEMNASTU NAPRAW Z DYŻURU 354

**To jest znane niedomknięcie, zapisane wprost w raporcie 354: ratchet widzi wyłącznie
kształt „obie gałęzie identyczne”, więc 18 z 20 wczorajszych napraw nie ma dziś żadnej
ochrony regresyjnej.**

1. Wypisz **te 18 literałów z nazwy** (źródło: `evidence/etykiety-narzedzi-20260904/r1-inwentarz.md`,
   **TYLKO ODCZYT**) i dla każdego podaj, co dziś by się stało, gdyby ktoś cofnął naprawę.
2. Zbuduj ochronę **kształtu hybrydy**: gałąź polska trzymająca wartość, która nie ma ani
   jednego polskiego znaku diakrytycznego **i** ma pokrycie w `title.pl` paczki jako inna
   wartość. To jest wykonalne mechanicznie i nie wymaga słownika języka.
3. **Dowód mutacyjny:** cofnij **jedną** z osiemnastu napraw (przez `cp`, nie `git revert`)
   → nowa ochrona ma **zaczerwienić się i wskazać `plik:linia`**; przywróć → **zielona**;
   `git diff` pusty.
4. Jeżeli uznasz, że mechanicznej ochrony dla hybrydy nie da się zbudować bez fałszywych
   alarmów — **piszesz to wprost, z przykładem fałszywego alarmu**, i to też jest wynik.
   Nie budujesz ochrony, która czerwieni się na `Raport / Deck`.

**Wymagany dowód:** lista 18 nazw · opis mechanizmu ochrony · mutacja w obie strony
z dosłownymi komendami · albo pisemne uzasadnienie, dlaczego mechaniczna ochrona jest
niewykonalna, z konkretnym przykładem. **Commit po `R3`.**

## R4 — NAPRAWA Z PACZEK, PO `id` FAZY, CAŁA RODZINA NARAZ (rdzeń)

1. **Zbuduj mapę `id` fazy → `title.pl`** z czterech paczek
   (`marketForces`, `growthPaths`, `portfolioPriority`, `riskUncertainty`).
   **★ Mapujesz po `id`, nigdy po `name`** — paczka `riskUncertainty` ma
   `en: 'Mission & Context'`, a `useToolStore` `name: 'Risk Mission & Context'`;
   mapowanie po nazwie da złe pary i nikt tego nie zauważy na zrzucie.
2. **Podmień wartości `namePl`** w `PORTER_STEPS`, `GROWTH_PATHS_STEPS`,
   `PORTFOLIO_PRIORITY_STEPS`, `RISK_UNCERTAINTY_STEPS`. **Nic poza polem `namePl`.**
3. **Rozstrzygnij osobno `Sizing`, `Backlog`, `Redesign`** (`RPA_SCANNER_STEPS`,
   `PROCESS_AUTOMATION_STEPS`) oraz `Six Sigma DMAIC`, `Process Mining`
   (`src/config/transformationTools.ts`). Dla każdej z tych pięciu wartości podajesz jedną
   z trzech decyzji: **naprawiona z paczki** (z `plik:linia`), **uzasadniona** (dopisana do
   `exact`, wypisana z nazwy w raporcie), albo **propozycja do akceptu właściciela**
   (osobna tabela, wzór z raportu 354). **`SMED` jest już uzasadniony przez `justification()`
   — nie ruszasz go.**
4. **Nakładka per wywołanie.** Po naprawie definicji sprawdź, czy
   `ToolDocumentView.tsx:1930` (`isOutputs ? 'Wyniki i działania' : step.namePl`) jest jeszcze
   potrzebna. Jeżeli nie — usuń ją **razem z dowodem**, że wszystkie osiem miejsc pokazuje tę
   samą nazwę. Jeżeli tak — napisz dlaczego.
5. **Przemiar po naprawie**: uruchom bezpiecznik i celowany pakiet testowy; podaj
   `numTotalTests`, nie tylko `numFailedTests`. `No test files found` i `Transform failed`
   to **BŁĄD KOMENDY**, nie PASS. Porównaj **listy pełnych nazw** przed i po — żadna nazwa
   nie ma zniknąć.
6. **`npx esbuild`** na każdym zmienionym pliku `.ts`/`.tsx` — `Transform failed` jest błędem
   komendy, nie wynikiem.

**Wymagany dowód:** tabela „`id` fazy → `title.pl` → nowa wartość `namePl`” dla całej rodziny ·
decyzja per każda z pięciu wartości spornych · rozstrzygnięcie nakładki `:1930` ·
`diff` list pełnych nazw testów przed/po · wynik `esbuild`. **Commit po `R4`.**

## R5 — DOWÓD WIZUALNY: POLSKI UŻYTKOWNIK WIDZI POLSKIE NAZWY

**★ Kształt tego dowodu zależy od odpowiedzi z `R1` punkt 3.** Jeżeli cztery rodziny nie
renderują kafli — dowodzisz **drzewa faz i nagłówka**, nie kafli. Nie udajesz obrazka,
którego w produkcie nie ma.

1. **Wejście harnessu.** Wzór: `tools-swot-session-workspace` w `dev-render/main.tsx`, który
   montuje **realny** `ToolDocumentView`. Dodaj **jeden** analogiczny wpis z `toolType`
   jednej z czterech rodzin (rekomendacja: `portfolio-priority` — ma najwięcej angielskich
   etykiet). **Zakaz atrapy zamiast komponentu produktu.**
2. **Zrzuty kanonicznym harnessem** `scripts/dev/grafika-zrzuty.mjs` na porcie `5575`:
   para PRZED/PO, **oba motywy**, `pl`, **sekcje ROZWINIĘTE**. **Zakaz własnego skryptu
   zrzucającego obok kanonicznego** — doraźny skrypt dał już raz parę identycznych obrazów
   i zameldował sukces.
3. **Kontrola pary:** suma kontrolna SHA-256 i średnia jasność każdego pliku.
   **Para bajtowo identyczna = ZERO dowodu** — jeżeli PRZED i PO wyjdą identyczne, to znaczy,
   że zmiana nie dotarła do renderowanego DOM-u, i **piszesz to wprost zamiast zaliczać parę**.
   Kontrola jasności: `light` znacznie jaśniejszy od `dark` (para o zbliżonej jasności to ten
   sam obraz pod dwiema nazwami).
4. **Liczebność z uchwytu DOM**, nie z oka: policz elementy drzewa faz i wypisz ich teksty
   z DOM-u, do JSON-a obok zrzutu.
5. **★ OBEJRZYJ KADRY WŁASNYMI OCZAMI** i napisz jedno zdanie per zrzut: co widzisz.
   Nie „testy przeszły”, tylko „na PO-light drzewo faz pokazuje pięć polskich nazw:
   … , … , … , … , …”. Jeżeli zobaczysz coś złego — mówisz to, nawet jeżeli liczby są zielone.
6. **Kontrola przyrządu:** porównaj, co jest hostem harnessu, a co produktem. Trzy z sześciu
   „defektów wysokości” w innym dyżurze okazały się przyrządem, nie produktem.

**Wymagany dowód:** para zrzutów w obu motywach z SHA-256 i średnią jasnością ·
JSON z tekstami z uchwytu DOM · jedno zdanie oględzin per kadr · jawne stwierdzenie,
czy para jest różna bajtowo. **Commit po `R5`.**

## R6 — RAPORT, PROPOZYCJE I PYTANIA DO WŁAŚCICIELA

Raport zawiera: własne trzy liczby z `R1` i listę rozbieżności wobec 18/23/27/331/5 ·
jednoznaczną odpowiedź TAK/NIE o kaflach czterech rodzin · opis rozszerzenia bezpiecznika
z `R2` i **cztery mutacje dosłownie** · rozstrzygnięcie ochrony osiemnastu napraw z `R3` ·
tabelę naprawy z `R4` z `plik:linia` źródła każdej polskiej nazwy · dowód wizualny z `R5`
z oględzinami · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE”** · obowiązkowy akapit
`§0.2e` dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „PROPOZYCJE DO AKCEPTU WŁAŚCICIELA”** — tabela w formacie
z raportu 354: `plik:linia` · obecny PL · obecny EN · proponowany PL · dlaczego nie ma
w paczce. Tu trafia wszystko, czego nie da się wziąć dosłownie z `title.pl`.

★★ **Osobna, obowiązkowa sekcja: „CO DOPISAŁEM DO `exact`”** — każda wartość z nazwy,
z jednozdaniowym uzasadnieniem. Sekcja może być pusta, ale wtedy piszesz wprost:
„nie dopisałem nic”. **To jest jedyne miejsce, w którym da się uciszyć realny defekt bez
śladu, więc ślad jest obowiązkowy.**

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** Kandydaci: czy `Backlog`
i `Sizing` mają zostać po angielsku jako terminy branżowe; która nazwa fazy syntezy SWOT
jest kanoniczna. Sekcja może być pusta, ale wtedy piszesz wprost: „nie mam zastrzeżeń”.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sekcje doszły dziś do `Z`, więc następne idą
`AA`, `AB`, …; sprawdź komendą
`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy.

**Commit po `R6`.**

## Próg odbioru

**Własna liczba, para zrzutów narzędzia pokazująca polskie nazwy faz na realnym komponencie
produktu, i bezpiecznik obejmujący OBA kształty — `pl === en` oraz hybrydę — z dowodem
mutacyjnym w obie strony: czerwieni się na defekcie, NIE czerwieni na uzasadnionej
identyczności.**

Odbiorca odrzuci dyżur, w którym: liczba pochodzi z instrukcji zamiast z pomiaru; polska
nazwa pochodzi z głowy wykonawcy zamiast z paczki; próg bezpiecznika został podniesiony;
para zrzutów jest bajtowo identyczna i mimo to zaliczona; naprawiono definicję, ale nie
sprawdzono ośmiu wołaczy; albo dopisano coś do `exact` bez wypisania tego z nazwy.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „rodzina policzona na 27
w całej `src/`, bezpiecznik rozszerzony i udowodniony mutacyjnie, naprawa nie wykonana,
bo pięć wartości wymaga decyzji właściciela” — **jest pełnowartościowym wynikiem**, o ile
te pięć wartości jest wypisane z nazwy.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „18 pól trzyma angielski” vs „mój pomiar daje 23” | `R0` (1) i `R1`: obowiązuje pomiar wykonawcy; obie cudze liczby są jawnie oznaczone jako cudze |
| „Zrób zrzut kafli” vs „cztery rodziny nie renderują kafli” | `R1` punkt 3 i `R5`: kształt dowodu zależy od zmierzonej odpowiedzi TAK/NIE; dowodzisz tego, co się renderuje |
| „Rozszerz zakres bezpiecznika” vs „nie wolno podnieść progu” | Sekcja „pułapka arytmetyczna” i `R0` (3): trzy uczciwe wyjścia (naprawa, uzasadnienie, osobny licznik); czwartego nie ma |
| „Dopisz do `exact`” vs „to jest sposób na uciszenie defektu” | Tabela licencji i `R6`: wąska licencja **plus** obowiązkowa sekcja z każdą wartością z nazwy |
| „Naprawa do definicji” vs „w `:1930` jest nakładka” | `R0` (4) i `R4` punkt 4: nakładka znika **razem z dowodem** na wszystkich ośmiu wołaczach albo zostaje z uzasadnieniem |
| „Paczki są SSOT” vs „potrzebna nazwa, której w paczce nie ma” | `R0` (2) i `R6`: brak źródła ⇒ **propozycja do akceptu właściciela**, nie naprawa |
| „`SWOTCorrelationsStep` ma cztery nieuzasadnione” vs „licznik ma nie rosnąć” | Tabela licencji: te cztery są zastanym długiem z propozycją 354 i **czekają na decyzję właściciela**; nie ruszasz ich i nie liczysz jako swoich |
| „Zrzuty w obu motywach” vs „para identyczna = zero dowodu” | `R5` punkt 3: identyczna para jest **wynikiem negatywnym do zapisania**, nie parą do zaliczenia |
| „Dodaj wejście harnessu” vs „harness jest przyrządem, nie produktem” | Tabela licencji i `R5` punkt 6: wpis musi montować **realny** komponent produktu, a raport ma odróżnić hosta od produktu |
| „Nie zmieniaj słowników” vs „naprawiasz polskie napisy” | Tabela licencji: te napisy żyją w `.ts`, nie w `translation.json`; liście PL/EN mają zostać bez zmian |
| „Aktualizuj macierz” vs „macierz nietykalna” | Sekcja o dokumentach: bramkami zajmują się dyżury 359-362; Twoim produktem jest rekomendacja |
| „Dopisz sekcję do rejestru znalezisk” vs „równolegle piszą inni autorzy” | `R6`: literę sprawdzasz komendą tuż przed commitem; sekcje doszły do `Z`, następne to `AA`, `AB` |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 12 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — `useToolStore.ts`, cztery paczki, trzy renderery, bezpiecznik + plik bazowy, jego test, wpis `tools-swot-session-workspace`, dowody 354 sprawdzone; `evidence/etykiety-namepl-20260904/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1-10 i 12 zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — definicja · mapa · paczki · renderery · kafle · bezpiecznik · słownik uzasadnień · testy bezpiecznika · nowe testy · zastany test · harness · narzędzie zrzutów · słowniki · serwer · infrastruktura testów · dowody · dowody 354 · macierz · rejestr znalezisk · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` mierzy, `R2`-`R3` budują bezpiecznik, `R4` naprawia definicję, `R5` dowodzi wzrokiem, `R6` składa |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6435/5575 wolne (`lsof` przy wydaniu), brak kontenera `cx-day364-pg`, brak gałęzi `codex/day364-*` i worktree; 363/365/366 mają rozłączne porty i pliki; paczka 359-362 ma zarezerwowany przedział 6430-6433/5570-5573 i rozłączny temat |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: klucz istnieje ≠ przetłumaczony, bezpiecznik nie widzi kształtu ani pliku, arytmetyka progu, mapowanie po `name`, naprawa per wywołanie, obalona teza o kaflach, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |
