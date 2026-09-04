# CODEX DAY 344 — SWOT: kafle etapów i plakietka gotowości

Data pomiaru: 2026-09-04. Marker: `6a4919f72d` (`6a4919f72db338e7f49a2cacb3787d20cc649883`). Gałąź: `codex/day344-swot-kafle-20260904`. Worktree: `/private/tmp/cx-day344-swot-kafle`. Werdykt: **R1–R6 ZROBIONE; integracja i akcept właściciela NIEZWERYFIKOWANE**.

## 0.1 — marker, baza pracy i rozbieżność tipa

Instrukcję odczytano w całości z `github-backup/grafika/m03-20260902` w bare-vaulcie, przed pracą. Wolne miejsce wynosiło 32 GiB przed materializacją i 18 GiB po niej. Porty 6391 i 5531 były wolne. Dosłowny wynik kontroli markera:

```text
2b793b6fda fix: uratuj artefakty dowodowe dyzuru 335 do repo (blok3-po.json cytowany z SHA, a lezal poza repo)
1203348444 Merge agent/instr-K — instrukcje 347, 348, 349, 350
6972825bea docs(instrukcje): dyzury 347-350 — przyczyna 542 czerwieni, przemiar G19, czerwien UI + niestabilnosc, pakiet G16
97e15ee9fe Merge agent/instr-J — instrukcje 343, 344, 345, 346
ee1c810fe5 docs(instrukcje): dyzur 346 (falszywa kompletnosc raportu Oceny) + korekta sciezek testow w 344/345
a0a85ae181 docs(instrukcje): dyzur 345 — domkniecie panelu Idei/Notatnika (aside, szerokosc, nazwa, martwa sciezka env, para zrzutow)
3943e4c92a docs(instrukcje): dyzur 344 — kafle etapow SWOT bez konsumenta, plakietka gotowosci, kanon crimsona
e9e4408dd7 docs(instrukcje): dyzur 343 — DEC-388 domkniecie (zabezpieczenie renderujace widok, 9 deskryptorow, flaga trojwarstwowa)
d3ecaa3c4a Merge agent/naprawa-334 — trzy falszywe rozstrzygniecia cofniete + DZIURA W BEZPIECZNIKU ZAMKNIETA
53a1cc29fc docs(naprawa-334): raport naprawy G20 + M29 w rejestrze znalezisk
56a0690e0d docs(licznik-g20): przegenerowany rejestr P0/P1 — BLOKUJE 13
afc923d912 fix(licznik-g20): cofniecie trzech falszywych rozstrzygniec dyzuru 334
7b7d7a5a92 fix(licznik-g20): SHA uznany za dowod naprawy musi byc mlodszy niz zgloszenie defektu
6a4919f72d fix(day341,342): przenies testy spod src/ do tests/ — bezpiecznik osiagalnosci zielony
e25eb19b64 Merge codex/day338 (odbiór adwersaryjny: SCALIC Z ZASTRZEZENIEM — ★ ZAKAZ WLACZANIA FLAGI)
107993da51 Merge codex/day339 (odbiór adwersaryjny: SCALIC — licencja dotrzymana)
937f2d3193 Merge codex/day341-swot-podlaczenie-20260904 (odbiór adwersaryjny 04.09)
660482d485 Merge codex/day342-panel-idei-podlaczenie-20260904 (odbiór adwersaryjny 04.09)
a8d333a173 Merge codex/day330-wywiad-menu-akcji-20260904 (odbiór adwersaryjny 04.09)
924ebd3c7a Merge codex/day292-wywiad-menu-akcji-20260903 (odbiór adwersaryjny 04.09)
cdeacf2194 fix(licznik-g20): dyspozycja decyzji z wiersza ledgeru, nie z calego tekstu dowodowego
ebc5fbf928 Merge codex/day337 (odbiór adwersaryjny: SCALIC Z ZASTRZEZENIEM)
896956b9bb fix: przenumeruj M28->M29 (duplikat) + uratuj dowod 542 czerwieni G15 do repo
00139f062c Merge codex/day336 (odbiór adwersaryjny: SCALIC Z ZASTRZEZENIEM)
e31e74c2d9 Merge codex/day335 (odbiór adwersaryjny: SCALIC)
MARKER OK
```

Dosłowny wynik sanity po utworzeniu worktree:

```text
6a4919f72db338e7f49a2cacb3787d20cc649883
```

`git status --short | head -3` nie wypisał żadnego wiersza. Marker był przodkiem tipa, lecz tip był 13 commitów dalej; praca zgodnie z instrukcją zaczęła się dokładnie od markera, bez rebase. `git diff --name-only 6a4919f72d..github-backup/grafika/m03-20260902` obejmował instrukcje 343–350, rejestry G20/G19, naprawę 334, artefakty G19 i licznik P0/P1; nadzorca musi scalić nowszy tip przy odbiorze.

## 0.2 — baza, migracje i Z30

Uruchomiono wyłącznie `pgvector/pgvector:pg16` jako `cx-day344-pg` na 6391, baza `cx344`. Pierwszy przebieg zastosował 894 migracje i zakończył się `Postgres migrations complete`; drugi: `Applying migrations: 0` i ten sam wynik. Nie dodano ani nie zmieniono migracji.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## 0.3 — pakiet testów przed/po

Ta sama komenda po obu stronach: `RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/tools tests/unit/toolpacks src/toolPacks/__tests__ --retry=0 --reporter=json --outputFile=…`.

| Stan | Suites | Testy | Pełne nazwy |
| --- | ---: | ---: | ---: |
| PRZED | 56/56 | 376/376 | 376 |
| PO | 58/58 | 381/381 | 381 |

Porównanie posortowanych `assertionResults[].fullName`: zniknęło 0, dodano 5. Nowe nazwy: render SSOT dla flagi OFF; render SSOT dla flagi ON; klik przełącza realną fazę; osiągalna plakietka wyliczonej gotowości; neutralny aktywny kafel z `c-focus` w elastycznej siatce. SHA-256 JSON: PRZED `23b12c673267eda6cb90c28fbff70321873d6096af5cfac741a250b3e91a3915`, PO `6eb191c9a2b7cbebbb0e0e0fe58b2176f6730480c0f07c05ad3010180c9a7c10`.

To jest dowód jednostkowy DOM z `RUN_DB_TESTS=0` i `MOCK_DB=true`, nie dowód trasy HTTP, Gateway, trwałości DB ani produkcji. Nie zmieniano infra testowej. Ostrzeżenia React `act(...)` pozostały na stderr, ale nie były błędami testów.

## R1 — pomiar wejściowy

Ta sama sesja `sess-demo-1`, realny bundle Vite na 5531, dedykowany ekran harnessu:

| Flaga | Etapy `[data-nmode-section-item]` | Kafle `[data-testid="dynamic-swot-phase-tile"]` | Plakietki `[data-testid="dynamic-swot-readiness-badge"]` |
| --- | ---: | ---: | ---: |
| OFF | 5 | 0 | 0 |
| ON | 7 | 0 | 0 |

Przyczyna na markerze: `workSection` był deklarowany w linii 1115 i konsumowany dopiero w `defaultSections` w linii 1931, podczas gdy `isStrategicPhaseTool` wracał wcześniej w liniach 1722–1923. Render gotowości w liniach 1136–1148 był w tej samej martwej gałęzi. Bazowe przebiegi miały po 5 znanych 404 harnessu, dlatego nie uznano ich za kadry akceptacyjne. Dowód: `evidence/swot-kafle-20260904/r1-baseline.json`. Commit: `cbb4ddc37f`.

## R2 — kafle w realnej gałęzi fazowej

`renderDynamicSwotPhaseOverview()` konsumuje bezpośrednio `dynamicSwotPhaseSummaries` wyliczone przez `computeDynamicSwotPhaseSummaries`; nie ma drugiej listy faz. Jest renderowany wewnątrz każdego aktywnego canvasu gałęzi strategicznej. Klik ustawia krok i aktywną sekcję; dodatkowy lokalny ref zachowuje sekcję dla siódmej fazy, której zastany pięcioelementowy store nie przyjmował przez `setCurrentStep`.

Pomiar po naprawie z uchwytu DOM, na tej samej sesji: OFF **5 etapów / 5 kafli**, ON **7 etapów / 7 kafli**. Plakietka: 1 w obu wariantach.

Oba dowody mutacyjne wykonano przez `cp` kopii do scratch, pojedynczą mutację i odtworzenie przez `cp`:

1. Usunięcie fazy `review` z wyniku `computeDynamicSwotPhaseSummaries`: dosłowny wynik `expected [ 'mission', 'input', 'swot', …(3) ] to deeply equal [ 'mission', 'input', 'swot', …(4) ]`; brakowało `review`; `1 failed | 2 passed (3)`. SHA logu `8848112a5efaa24afd49867a5c85153e0a94d01116c68492a1597b019f86af7e`.
2. Usunięcie montażu overview z canvasu fazy: dosłowny wynik `Unable to find an element by: [data-testid="dynamic-swot-phase-tile"]`; `3 failed (3)`. SHA logu `d84392146a438264b65f2bc66017d3abb88febb5329061c4c2dd2fe52d0f9df2`.

Po odtworzeniu: `Test Files 1 passed (1)`, `Tests 3 passed (3)`; SHA logu `e70f377e86332a744e053c2a499866956300ccbacf683bfe14c47cbec0920560`. Mutowany plik tylko-do-odczytu wrócił bajtowo do stanu sprzed mutacji i nie wszedł do commita. Commit: `5567a5c6ed`.

## R3 — plakietka i panel kontekstu

Plakietka ma osiągalnego konsumenta i uchwyt DOM w overview (`ToolDocumentView.tsx`, obecnie linie 1112–1136); pomiar końcowy: 1 przy OFF i 1 przy ON. Broni jej osobny test. Commit: `24f3635ca1`.

`ToolContextPanel` pozostaje **DO DECYZJI WŁAŚCICIELA**. Na markerze wykluczenie `ai-collaboration` występowało w obu gałęziach:

```tsx
// gałąź fazowa, linie 1911–1913
...(toolType === 'dynamic-swot'
  ? []
  : [

// gałąź domyślna, linie 1952–1954
...(toolType === 'dynamic-swot'
  ? []
  : [
```

Oba warunki wprowadził commit `4a36e8a745f4bc11418ade6ac1d68ae7695a2818` (`checkpoint wave 3 recovery candidate`), bez zapisanej racji produktowej. Nie mam dowodu, czy panel ma być drugim miejscem współpracy AI, czy świadomie nie może dublować canvasu. Potrzebna decyzja o właścicielstwie tej funkcji; bez niej nie usuwam wykluczenia.

## R4 — siatka i kanon crimsona

PRZED: `grid gap-3 sm:grid-cols-2 xl:grid-cols-4`; aktywny kafel: `border-primary-300 bg-primary-500/10 shadow-sm`.

PO: `grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3`; aktywny kafel: `c-focus` oraz `border-slate-400 bg-slate-100 shadow-sm dark:border-navy-500 dark:bg-navy-800/80`. Test wyklucza `primary`, `crimson` i `c-accent` z aktywnego stanu. Oględziny wariantu ON potwierdziły układ 3/3/1 bez przycięcia przy 1440 px.

Trzy bramki: `check-focus-canon.sh --ci` PASS (zastany dług 61 plików / 169, coverage 91%, bez wzrostu); `check-list-canon.sh` PASS (157 plików, baseline 368, bez wzrostu); `check-artefakt.sh` PASS (crimson 8 wobec baseline 9; R1 ostrzeżeń 2, R2+R3 0). Commit: `68128b3886`.

## R5 — cztery kadry właścicielskie

Kanoniczny `scripts/dev/grafika-zrzuty.mjs`, realny bundle Vite na 5531, ta sama sesja `sess-demo-1`, sekcje rozwinięte, po animacji, bez kontrolek harnessu. Safe stubs harnessu usunęły wcześniejsze 404; każdy przebieg miał 0 błędów konsoli i 0 błędów HTTP.

| Flaga / motyw | SHA-256 | Średnia jasność | Etapy / kafle / plakietki |
| --- | --- | ---: | ---: |
| OFF light | `5b9a884c63bf6f0efe4ab6c3b5de16673ba919f6ded777d875f01a5b409f1d16` | 245.6866 | 5 / 5 / 1 |
| OFF dark | `b588ee9bd1d8058af5618467f2732328c534bec4d5398aa7b1b6c8fb2970f41a` | 28.4565 | 5 / 5 / 1 |
| ON light | `7dbaaaa31d8035672c385ae6933978b5ac686661f105da3fe6f7780adf93cd70` | 245.4363 | 7 / 7 / 1 |
| ON dark | `ed85701e344f72ed5b29043d9e9e1fbe0d848edfaf973e4bf3c52e71edb48ee8` | 28.2616 | 7 / 7 / 1 |

Wszystkie cztery obrazy obejrzano w oryginalnej rozdzielczości: 0 przyciętych kafli, 0 zwiniętych sekcji, brak kontrolek harnessu, motywy i warianty nie są bajtowo identyczne. Obrazy pozostają poza repo zgodnie z Z13; metadane są w `evidence/swot-kafle-20260904/r5-visual-proof.json`. Kanoniczny skrypt kończył kodem 1 i komunikatem `state control 1/2 pairs`, ponieważ jego mianownik miesza rekord stanu z rekordem luminancji; oba obrazy każdego przebiegu miały osobno status OK, marker DOM oraz zero błędów. Nie ukrywam tej wady przyrządu. Próba z `--a11y=1` nie utworzyła kadrów, bo dedykowany HTML nie ma `#dev-render-root`; powtórzono bez axe, którego R5 nie wymaga. Commit: `9da73194f8`.

Flaga `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES` kończy dyżur OFF; runtime Vite został zatrzymany.

## Korekty wobec instrukcji i przebiegu

- Instrukcja wskazała drugi warunek panelu około linii 2054; na markerze był w 1952–1954, a 2054 zamykało `map`. Nie zmieniono znaczenia warunku.
- Statyczne liczniki wejściowe wykonano przed migracjami, mimo nakazanej kolejności „migracje przed pomiarem”. Był to błąd proceduralny. DOM R1 oraz wszystkie pomiary produktu wykonano po obu zielonych przebiegach migracji; statyczne wyniki ponowiono i nie zmieniły się.
- Pierwszy commit R2 został prawidłowo zablokowany przez pre-commit, bo przeniesiony zastany crimson wyglądał jak nowe naruszenie. Bezpiecznika nie obchodzono. Neutralne klasy i elastyczna siatka musiały wejść do produktu w commicie R2; osobny commit R4 dodał odrębny kontrakt testowy i ponowił trzy bramki. To odchylenie od semantycznego podziału commitów jest jawne.
- Pierwsza próba R5 z axe była niekompatybilna z dedykowanym rootem i nie dała żadnego kadru; nie została zaliczona.

## R6 — bilans zmian i odbiór

Zmodyfikowano wyłącznie licencjonowane ścieżki: `ToolDocumentView.tsx`, nowy test pod `tests/unit/tools/`, harness, dwa pliki JSON dowodu, ten raport i wiersz R-20. Nie dotknięto powłoki N, store, deskryptora faz, flagi, i18n, migracji ani backendu. Liście i18n nie zmalały: PL 35198, EN 33065.

Każda pozycja ma osobny commit i push. Wiersz R-20 otrzymuje sprostowanie z liczebnościami DOM przed/po i statusem plakietki, bez zmiany zastanego opisu.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano wdrożenia, produkcyjnego HTTP, ApiGateway/JWT/PostgreSQL readback ani zachowania urządzenia; dyżur był frontowy, a unit testy miały `RUN_DB_TESTS=0 MOCK_DB=true`.
- Nie uzyskano akceptu właściciela dla czterech kadrów ani decyzji o `ToolContextPanel`; dlatego R-20 nie jest pełnym akceptem produktu.
- Nie wykonano pełnego axe na kadrach z powodu niezgodnego root elementu dedykowanego HTML; bramki focus/list/artefakt nie zastępują audytu dostępności.
- Nie wykonano pełnego typechecku całego repo ani pełnego E2E; zielony jest wskazany pakiet 381 testów oraz test skupiony.
- Nie uruchamiano modelu LLM, generowania ani wysyłki; nie dowodzi to jakości treści AI ani ścieżek integracyjnych.
- Nowszy tip `grafika/m03-20260902` nie został scalony do tej gałęzi; integracja należy do nadzorcy.

