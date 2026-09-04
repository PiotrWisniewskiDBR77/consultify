## Po co ten dyżur istnieje

Dyżur 335 zrobił dwie rzeczy, których większość dyżurów nie robi: **ujawnił własne czerwienie
dobrowolnie** i **nie nazwał ich naprawionymi**. Jego raport kończy się zdaniem:

> *„Nie nazywam czterech pozostałych przypadków naprawionymi; wynik pokazuje zależność od
> kolejności/stanu lub niestabilność, która wymaga osobnej reprodukcji."*

**To jest wzorzec, którego ten dyżur nie ma prawa zepsuć.** Zamknięcie go gorzej niż zamknięto
tamten — jednym zielonym przebiegiem, `--retry`, albo `.skip` — będzie odrzucone.

Ten dyżur ma dwa **rozłączne** produkty:

- **(a) cztery czerwone testy UI na `HEAD`** — zielone, bo naprawiono produkt **albo** bo
  poprawiono błędną asercję, z jawnym uzasadnieniem, **które to jest i dlaczego**;
- **(b) niestabilność Bloku 3** — przyczyna nazwana i udowodniona **dziesięcioma kolejnymi
  przebiegami bez zmiany wyniku**.

## Część (a) — cztery czerwienie, cztery różne kształty

**Odtworzyłem je sam na markerze `6a4919f72db338e7f49a2cacb3787d20cc649883`.**
Trzy pliki, **62 przypadki, 58 zielonych, 4 czerwone**, 21 bloków `describe`.

| # | Pełna nazwa przypadku (`fullName`) | Plik | Co dokładnie zawodzi |
| --- | --- | --- | --- |
| 1 | `R04-2A · interakcja wiersza Shift+F10 na wierszu otwiera ten sam kontekst co kebab` | `filterableTable.r04-2a.test.tsx` | `expect(element).toHaveAttribute("tabindex", "0")` — **otrzymano `null`**. Wiersz nie jest fokusowalny, więc `Shift+F10` nie ma na czym stanąć |
| 2 | `R03-1 · Relations jest blokiem obowiązkowym renderuje empty state, gdy ekran NIE poda propa relations` | `standardPreview.r03.test.tsx` | `TestingLibraryElementError: Unable to find an element with the text: No relations` — blok `Relations` **nie renderuje pustego stanu** |
| 3 | `R03-1 · Relations jest blokiem obowiązkowym respektuje własną etykietę pustego stanu` | `standardPreview.r03.test.tsx` | to samo, dla własnej etykiety: nie znaleziono tekstu `Brak powiązań` |
| 4 | `R03-2 · zamykanie i focus return gdy element otwierający zniknął, focus wraca na kontener — skróty żyją dalej` | `tablePreviewGeometry.r03-2.test.tsx` | `AssertionError` — po zniknięciu elementu otwierającego fokus wrócił na **`<body>`**, a oczekiwano kontenera |

★★ **To NIE jest jedna przyczyna powtórzona cztery razy.** Kształty są cztery i rozstrzygasz
je osobno. Szukanie wspólnego mianownika jest tu błędem, który kosztuje pół dnia.

★ **Dwie czerwienie `R03-1` to najprawdopodobniej ta sama przyczyna** (blok `Relations`
w ogóle się nie renderuje albo renderuje się bez pustego stanu) — ale **udowodnij to**, zamiast
założyć; jeżeli tak jest, jedna naprawa domyka dwie i to jest dobry wynik.

**Dyżur 335 sklasyfikował je jako `ZASTANA_WZGLĘDEM_DYŻURU_335`** i uczciwie zaznaczył, że to
znaczy tylko tyle, że **wystąpiły przed jego zmianami UI** — a nie, że są stare. Wiek czerwieni
wobec kotwicy produktu jest **nierozstrzygnięty** i możesz go rozstrzygnąć: `git log -1` na
pliku testu i na pliku produktu powie, które z nich zmieniło się później.

★ **Wszystkie trzy pliki testowe przeszły niezależny bundle `esbuild`** (pomiar 335), więc
`Transform failed` nie maskuje wyniku. Powtórz to sam — `Transform failed` jest **błędem
komendy**, nie wynikiem.

## Część (b) — niestabilność Bloku 3, i trzy różne liczby na jej temat

Blok 3 to sześć plików kontraktów tras przez realny `ApiGateway`/JWT/PostgreSQL:

```text
server/src/routes/__tests__/ai.agentHubRateLimitRouting.test.ts
server/src/routes/__tests__/day274-ocena-dociera-do-listy.pg.test.ts
server/src/routes/__tests__/day275-method-outputs-kontrakt.pg.test.ts
server/src/routes/__tests__/day276-deck-autosave-persist.pg.test.ts
server/src/routes/__tests__/day276-workbook-cell-persist.pg.test.ts
server/src/routes/__tests__/day277-decyzje-zapis.pg.test.ts
```

**Objaw:** pierwszy poprawnie skonfigurowany przebieg na świeżej bazie dał czerwień
na `day274`, `day275` i **dwóch przypadkach workbook `day276`**. Po naprawie **wyłącznie
payloadu `day277`** (dodanie `escalation: null`, kontrakt
`server/src/validators/decision.validators.ts:210-220`) ponowiono **cały blok bez zmian
w pozostałych plikach** — i wyszło **`18/18` GREEN**. **Cztery przypadki zzieleniały same.**

**★★ Trzy różne liczby o tym samym bloku, które sam zmierzyłem w artefaktach 335:**

| Źródło | Wynik |
| --- | --- |
| `evidence/g19/blok3-marker.json` (surowy JSON) | **18 / 11 / 7**, czerwone pliki: `day274`, `day276-deck`, `day276-workbook`, `day277`; **`day275` ZIELONY** |
| tabela w `evidence/g19/day335-r3-maszynowy.md` | **18 wykonanych / 12 zielonych / 6 czerwonych** |
| tekst w `evidence/g19/day335-r4-czerwienie.md` | **12 / 18**, i wymienia jako czerwone `day274`, **`day275`**, dwa `day276` oraz `day277` |

**Rozstrzygnięcie tej rozbieżności jest częścią `R3`** — i samo w sobie jest cenne, bo pokazuje,
czy niestabilność dotyka `day275` czy nie. **Nie zakładaj, która liczba jest prawdziwa.**

**★★ Ostrzeżenie o dowodzie poza repo.** Artefakt `blok3-po.json` (ten z wynikiem `18/18`,
cytowany z SHA-256 `0df629f348ff0def401a70125a57b59518ce1967096723d822a43bb0d078f0d2`)
**NIE LEŻY W REPO** — w `evidence/g19/` są tylko `blok3-marker.json` i `blok3-marker.log`.
Sprawdziłem 04.09: plik istnieje **poza repo**, w
`/private/tmp/cx-day335-g19-regresja-artefakty/blok3-po.json`. To jest katalog artefaktów
cudzego dyżuru: **wolno Ci go PRZECZYTAĆ i policzyć `shasum -a 256`, nie wolno tam nic
zapisać ani niczego usunąć** (`Z6`). Jeżeli pliku już nie ma — **odtwarzasz pomiar sam**
i zapisujesz, że dowód wyparował.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze:

- trzy pliki testowe UI: **62 przypadki / 58 zielonych / 4 czerwone**, i dokładnie te cztery
  pełne nazwy z tabeli wyżej;
- kształty czterech czerwieni: `tabindex` = `null` · brak tekstu `No relations` · brak tekstu
  `Brak powiązań` · fokus na `<body>` zamiast kontenera;
- `evidence/g19/blok3-marker.json` = **18 / 11 / 7**, `day275` **zielony**;
- trzy różne liczby o Bloku 3 w trzech dokumentach dyżuru 335;
- `blok3-po.json` **nie ma w repo**; leży w katalogu tymczasowym poza repo;
- kontrakt `escalation` żyje w `server/src/validators/decision.validators.ts`,
  **nie** w `server/src/schemas/` (instrukcja 335 wskazywała ten drugi, nieistniejący);
- liście słowników: **pl 35198**, **en 33065**; cztery bezpieczniki (`focus-canon`,
  `list-canon`, `artefakt`, `reachability --check-baseline`) kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / kontrakt** | `server/src/validators/decision.validators.ts` (pole `escalation`, wiersze ok. 210-220) | **TYLKO ODCZYT** — schemat jest kontraktem produktu; jeżeli test się o niego rozbija, przestarzały jest test | Cytat wiersza + brief |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/routes/v8/index.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ** (`Z22`). Każde „działa" znaczy: realne żądanie HTTP przez realny `ApiGateway`, z **zapisanym kodem odpowiedzi** | Opis w raporcie |
| **Kontroler / trasy Bloku 3** | `server/src/routes/pmo/**`, `server/src/routes/v8/{chat,teresa}.routes.ts`, `server/src/routes/meeting.routes.ts` | **★ WĄSKA LICENCJA:** wolno zmienić **wyłącznie** wtedy, gdy `R4` udowodni, że przyczyna niestabilności leży w kodzie produktu (np. wyścig w zapisie), i **wyłącznie razem z dowodem mutacyjnym** | Wpis: plik, linia, problem, rekomendacja jako diff **nienałożony** |
| **Serwis / repozytorium** | `server/src/services/**`, `server/src/domain/**`, `server/src/repositories/**` | **TYLKO ODCZYT** | jak wyżej |
| **Middleware / model uprawnień** | `server/src/middleware/**` | **NIETYKALNE DO ZAPISU** (`Z12`) | Brief |
| **Produkt UI — powłoka współdzielona** | `src/components/shared/ModuleHub/FilterableTable.tsx`, `src/components/standard/StandardPreview.tsx`, `src/components/shared/PreviewPane/**`, `src/components/ui/ResizableTable/**` | **★ WĄSKA LICENCJA:** wolno naprawić **dokładnie to, co opisują cztery czerwone przypadki** — fokusowalność wiersza, renderowanie pustego stanu bloku `Relations`, powrót fokusu na kontener. **Zakaz zmian wyglądu, refaktoryzacji i „przy okazji"** | Wpis do raportu z `plik:linia` |
| **Kanon UI** | `docs/ui-standards/TRIADA_KANON.md`, `tailwind.config.js`, `src/index.css` | **TYLKO ODCZYT.** ★ `primary-*` **każdy numer** = crimson `#85182F` — czerwień wyłącznie semantyka krytyczna; fokus tokenem `c-focus`. Ekrany listowe wyłącznie `StandardTable`/`StandardModuleBar` — **zakaz własnych tabel** | Opis w raporcie |
| **Testy — cztery czerwienie** | `src/components/shared/__tests__/{filterableTable.r04-2a,standardPreview.r03,tablePreviewGeometry.r03-2}.test.tsx` | **★ WĄSKA LICENCJA:** wolno poprawić asercję **tylko** z jawnym uzasadnieniem, że opisuje kontrakt, którego produkt świadomie już nie ma (z commitem albo decyzją właściciela), i **tylko** z dowodem mutacyjnym, że poprawiony test nadal broni tego, co bronił. **Zakaz `.skip`, `.todo`, `--retry`, poszerzania `exclude`, obniżania progów** | — |
| **Testy — Blok 3** | sześć plików `server/src/routes/__tests__/{ai.agentHubRateLimitRouting,day27*}.test.ts` | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ** wielokrotnie i wolno naprawić **przyczynę niestabilności** (np. izolację stanu między przypadkami), jeżeli `R4` ją wskaże. **Zakaz zmiany asercji i zakresu, żeby zzielenieć** | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY.** ★ `retry: CI ? 3 : 1` w `vitest.config.ts` jest **przyczyną maskowania niestabilności** i mimo to **go nie zmieniasz** — obchodzisz jawnym `--retry=0` w każdej komendzie i opisujesz to jako znalezisko | Opis w raporcie + rekomendacja jako diff **nienałożony** |
| **Artefakty cudzego dyżuru 335** | `/private/tmp/cx-day335-g19-regresja-artefakty/**` | **★ WĄSKA LICENCJA — WYŁĄCZNIE ODCZYT I `shasum`.** `Z6` zakazuje zapisu i usuwania; ten wyjątek dotyczy **tylko odczytu** plików `blok3-po.json` i `blok3-po-nazwy.txt`. Jeżeli ich nie ma — odtwarzasz pomiar sam | Zdanie w raporcie: „dowód wyparował, odtworzyłem" |
| **Dowody 335 w repo** | `evidence/g19/**` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To baza porównania; nadpisanie unieważnia dyżur | — |
| **Dowody** | `evidence/day349/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie** | — |
| **Nowe testy** | `tests/**` (nowe pliki, `git add -f`) | **★ PEŁNA LICENCJA na dodanie** bezpiecznika przed nawrotem z `R5`. **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** — dziś trzeba było przenosić trzy razy | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **NIETYKALNA — ten dyżur NIE dotyka żadnego wiersza żadnej bramki.** `G15` należy do 347, `G19` do 348, `G16` do 350 | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY349_CZERWIEN_UI_REPORT.md` (**NOWY**) | `R6` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `evidence/g15/**`, `resultsInternalBetaVisibility.middleware.ts`, `server/src/routes/resultsVnext/**` (dyżur 347) · `evidence/g19/day348/**`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md`, `day307-crossorg-read-flight.pg.test.ts`, `TaskController.ts` (dyżur 348) · `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` (dyżur 350) · wszystko wokół `DEC-388`, kafli SWOT, panelu Idei i kompletności raportu (dyżury 343-346) · `server/migrations/**` (przedział nieprzydzielony) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35198, en 33065

# (b) cztery bezpieczniki maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: wszystkie 0
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`). ★ W tym dyżurze ryzyko jest
realne: dotykasz powłoki kanonu, a `check-focus-canon.sh` i `check-list-canon.sh` pilnują
dokładnie tych plików.

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | przypadki w trzech plikach UI | `62 / 58 / 4` | komenda (2) z `§0.3` | TAK — **podaje `numTotalTests`, nie tylko `numFailedTests`** |
| 2 | pełne nazwy czterech czerwieni | cztery nazwy z tabeli | komenda (2) z `§0.3` | TAK — porównanie po `fullName` (`Z37`) |
| 3 | kształt każdej czerwieni | `tabindex=null` · 2× brak tekstu · fokus na `body` | komenda (3) z `§0.3` | TAK — czyta `failureMessages`, nie samą nazwę |
| 4 | wiek czerwieni wobec produktu | **nierozstrzygnięty** | `git log -1 --format='%h %ad %s'` na pliku testu i pliku produktu | TAK — **335 świadomie tego nie orzekł, Ty możesz** |
| 5 | wynik Bloku 3 wg surowego JSON-a | `18 / 11 / 7`, `day275` zielony | komenda (5) z `§0.3` | TAK |
| 6 | wynik Bloku 3 wg dwóch dokumentów 335 | `18/12/6` oraz `12/18` z `day275` czerwonym | komenda (5) z `§0.3` | TAK — **trzy źródła, trzy liczby; rozstrzygasz w `R3`** |
| 7 | czy `blok3-po.json` istnieje | **nie w repo**, tak poza repo (stan 04.09) | komenda (6) z `§0.3` | TAK — `ls` na cytowanej ścieżce, zawsze |
| 8 | wynik dziesięciu przebiegów | — | `R4`, dziesięć JSON-ów + `shasum -a 256` każdego | TAK — **jeden zielony przebieg NIE jest dowodem** |
| 9 | czy naprawa czterech czerwieni czegoś nie zgasiła | — | pełny przebieg trzech plików UI po naprawie, po nazwach | TAK — nazwa, która zniknęła, wymaga wyjaśnienia albo STOP-u |
| 10 | bezpieczniki kanonu po naprawie | wszystkie `0` | blok (b) „WARUNKÓW WSPÓLNYCH" | TAK — dotykasz powłoki kanonu |
| 11 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |
| 12 | `numTotalTests` każdego przebiegu | — | pole `numTotalTests` z raportu JSON | TAK — **`0 failed` przy `0 wykonanych` NIE jest PASS** |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY349_CZERWIEN_UI_REPORT.md` ·
`evidence/day349/**` (nowy katalog).

**Zapisujesz WARUNKOWO (tylko z dowodem `R1`–`R4`):**
`src/components/shared/ModuleHub/FilterableTable.tsx` · `src/components/standard/StandardPreview.tsx` ·
`src/components/shared/PreviewPane/**` · `src/components/ui/ResizableTable/**` ·
trzy pliki testowe czterech czerwieni · sześć plików Bloku 3 ·
kod produktu Bloku 3 (tylko jeżeli `R4` wskaże wyścig w produkcie) ·
nowe pliki testowe w `tests/` (`git add -f`, **nigdy pod `src/`**) ·
`REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `docs/program/waves/WAVE_03_ACCEPTANCE/modules/**` (żadna bramka —
`G15` do 347, `G19` do 348, `G16` do 350), `public/locales/**`, `tailwind.config.js`,
`src/index.css`, `docs/ui-standards/**`, `tests/setup.ts`, `tests/helpers/**`,
`tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`,
`server/migrations/**`, `server/src/middleware/**`, `server/src/services/ApiGateway.ts`,
`evidence/g19/**`, `evidence/g15/**`, `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`,
`/private/tmp/cx-day335-g19-regresja-artefakty/**` (odczyt tak, zapis nigdy).

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day349-czerwien-ui
git diff --name-only --cached | tee /private/tmp/cx-day349-czerwien-ui-artefakty/staged.txt
bash -c "grep -iE 'MODULE_ACCEPTANCE|^public/locales/|^tailwind\.config|^src/index\.css|^docs/ui-standards/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|^server/src/middleware/|ApiGateway|^evidence/g19/|^evidence/g15/|PRZELOT_WLASCICIELA' /private/tmp/cx-day349-czerwien-ui-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"

# ★★ druga kontrola, wlasciwa TEMU dyzurowi: zero wyciszen w tym, co commitujesz
git diff --cached -U0 | bash -c "grep -nE '^\+.*(\.skip|\.only|\.todo|retry:|--retry=[1-9]|ts-ignore|ts-expect-error|eslint-disable|max-warnings|continue-on-error)'" \
  && echo "★★★ WYCISZENIE W DIFFIE — TO JEST ZAKAZ NADRZEDNY TEGO DYZURU, COFNIJ" \
  || echo "brak wyciszen OK"
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Zero wyciszania — to jest zakaz nadrzędny.** `.skip`, `.only`, `.todo`, `--retry` inne
niż `0`, `retry:` w opcjach `describe`/`it`, poszerzanie `exclude`/`testIgnore`, obniżanie
progów, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `--max-warnings`,
`continue-on-error: true`. **Uznasz którekolwiek za jedyne wyjście → STOP z uzasadnieniem,
nie cichy commit.** Druga kontrola przed commitem (blok wyżej) sprawdza to mechanicznie.

**(2) Naprawa asercji wymaga jawnego uzasadnienia, KTÓRA STRONA jest przestarzała.** Wolno
poprawić test, jeżeli udowodnisz, że opisuje kontrakt, którego produkt **świadomie** już nie
ma — z commitem albo decyzją właściciela w `OWNER_DECISION_LEDGER_2026-08-24.md`. Wtedy
**dowodzisz mutacyjnie**, że poprawiony test nadal broni tego, co bronił. „Test był zły"
bez dowodu jest zawężeniem kryterium.

**(3) Jeden zielony przebieg NIE jest dowodem naprawy niestabilności.** Dowodem jest
**dziesięć kolejnych przebiegów bez zmiany wyniku**, z dziesięcioma zapisanymi plikami JSON
i ich `shasum -a 256`, porównanymi **po nazwach przypadków**. To jest dokładnie ten sam
błąd, który pozwolił nazwać cztery przypadki „zielonymi" po jednym powtórzeniu.

**Wymagany dowód:** trzy zdania w raporcie, że przeczytałeś te zasady, plus wynik obu kontroli
przed każdym commitem. **Bez commita — to jest warunek, nie pozycja.**

## R1 — CZTERY CZERWIENIE: ROZSTRZYGNIĘCIE PER CZERWIEŃ (rdzeń)

Nie naprawiasz jeszcze niczego. **Dla KAŻDEJ z czterech czerwieni z osobna** produkujesz:

1. **Pełną nazwę przypadku** i **pełny komunikat błędu** (nie skrót).
2. **Cytat asercji z pliku testu**, z `plik:linia`.
3. **Cytat miejsca w produkcie**, które tę asercję ma spełnić, z `plik:linia`. Jeżeli takiego
   miejsca **nie ma** — to jest odpowiedź: produkt nie ma kontraktu, który test opisuje.
4. **Werdykt: `PRODUKT` czy `ASERCJA`** — i **dlaczego**, jednym zdaniem, z dowodem.
   - `PRODUKT` = kontrakt jest słuszny, produkt go nie realizuje → naprawiasz produkt;
   - `ASERCJA` = kontrakt został świadomie zmieniony → naprawiasz test, cytując commit
     albo decyzję, która go zmieniła.
5. **Wiek czerwieni**: `git log -1 --format='%h %ad %s'` na pliku testu i na pliku produktu.
   Który zmienił się później? Dyżur 335 świadomie **nie orzekł** wieku; Ty możesz i to jest
   wartość dodana.
6. **Sprawdź, czy dwie czerwienie `R03-1` mają jedną przyczynę.** Jeżeli tak — jedna naprawa
   domyka dwie, i mówisz to wprost. Jeżeli nie — traktujesz je osobno.

★ **Sprawdź RODZINĘ, nie tylko te cztery przypadki** (`KROK 0`): jeżeli brak `tabindex="0"`
dotyczy wiersza w `FilterableTable`, sprawdź, czy to samo dotyczy `StandardTable` i innych
tabel powłoki. Program ma zmierzony kształt „naprawa per wywołanie odrasta" — defekt załatany
w jednym miejscu wrócił po ośmiu tygodniach w dwunastu plikach.

**Wymagany dowód:** cztery bloki (nazwa · komunikat · asercja `plik:linia` · miejsce w produkcie
`plik:linia` · werdykt `PRODUKT`/`ASERCJA` z uzasadnieniem · wiek) · zdanie o rodzinie.
**Commit po `R1`.**

## R2 — NAPRAWA CZTERECH CZERWIENI Z DOWODEM MUTACYJNYM (rdzeń)

1. Naprawiasz **dokładnie to, co opisuje werdykt z `R1`** — nic więcej. Zakaz refaktoryzacji,
   zmian wyglądu i poprawek „przy okazji".
2. **Dowód mutacyjny per naprawiona czerwień** (`Z32`), celujący w **ZABEZPIECZENIE, nie
   w mechanizm**: cofnij swoją naprawę produktu → test **czerwony**; przywróć przez `cp`
   (nigdy `git stash`, `Z27`) → test **zielony**; `git diff` po przywróceniu **pusty**.
   Obie komendy i oba wyniki dosłownie w raporcie.
   ★ Dla czerwieni sklasyfikowanej jako `ASERCJA` mutacja jest odwrotna: **zepsuj produkt
   w miejscu, którego poprawiony test broni** → ma zaczerwienić się; cofnij → zielony.
   Test, który przechodzi także po zepsuciu produktu, jest **tautologią** i naprawa jest
   odrzucona.
3. **Bezpieczniki kanonu po każdej zmianie UI**: `check-focus-canon.sh --ci`,
   `check-list-canon.sh`, `check-artefakt.sh` — wszystkie kodem `0`. ★ Fokus tokenem
   `c-focus`, **nigdy** `primary-*` (crimson `#85182F`).
4. **Przemiar całych trzech plików po nazwach**: `ui-po.json` i `diff` nazw wobec
   `ui-przed.json`. **Każda nazwa, która zniknęła, wymaga wyjaśnienia albo STOP-u.**

**Wymagany dowód:** diff naprawy z `plik:linia` · dowód mutacyjny w obie strony dla każdej
z czterech czerwieni · trzy bezpieczniki kanonu kodem `0` · `diff` nazw przed/po.
**Commit po `R2`.**

## R3 — REPRODUKCJA NIESTABILNOŚCI I ROZSTRZYGNIĘCIE TRZECH LICZB (rdzeń)

1. **Postaw kontener** `cx-day349-pg` na porcie `6396`, baza `cx349`, i przepuść migracje
   zgodnie z `§0.2c` (A) — **dwa przebiegi**, drugi bezbłędny i bez zmian (idempotencja).
   `pgvector/pgvector:pg16`; `postgres:15` **nie przechodzi migracji**.
2. **Rozstrzygnij trzy rozbieżne liczby dyżuru 335** (`18/11/7` vs `18/12/6` vs `12/18`),
   w szczególności **czy `day275` był czerwony czy zielony**. Źródła: surowy
   `evidence/g19/blok3-marker.json` (wiążący, bo maszynowy) i dwa dokumenty opisowe.
   Odczytaj też — **wyłącznie do odczytu, `shasum -a 256`** —
   `/private/tmp/cx-day335-g19-regresja-artefakty/blok3-po.json`; jeżeli plik zniknął,
   zapisz „dowód wyparował" i odtwórz pomiar sam.
3. **Odtwórz objaw**: uruchom Blok 3 na świeżej bazie, `--retry=0`, i zobacz, czy czerwienie
   `day274`/`day275`/`day276` wystąpią. **Jeżeli za pierwszym razem wyjdzie `18/18` —
   to NIE znaczy, że niestabilności nie ma; to znaczy, że nie trafiłeś w warunek.**
   Wtedy przechodzisz do punktu 4 i szukasz warunku celowo.
4. **Postaw i sprawdź cztery hipotezy, po kolei, każdą osobno** — to jest sedno pozycji:
   - **(H1) wyścig** — dwa przypadki piszą do tego samego wiersza; sprawdź uruchamiając
     pliki pojedynczo kontra razem;
   - **(H2) współdzielony stan bazy** — przypadek zostawia dane, które psują następny;
     sprawdź na bazie świeżej per plik kontra bazie wspólnej;
   - **(H3) kolejność plików** — `vitest` nie gwarantuje kolejności; sprawdź uruchomienie
     w kolejności odwrotnej i alfabetycznej;
   - **(H4) zależność od zegara** — `Date.now()`, granica doby, `TZ`; sprawdź, czy któryś
     przypadek porównuje daty.
   **Każda hipoteza dostaje: komendę, wynik, werdykt POTWIERDZONA/OBALONA.**
5. **Podaj `numTotalTests` dla każdego przebiegu.** Uruchomienie Bloku 3 z roota daje
   **0 wykonanych przypadków i `exit 0`** — to jest BŁĄD KOMENDY, nie PASS; zdarzyło się
   dyżurowi 335 i zostało słusznie odrzucone.

**Wymagany dowód:** rozstrzygnięcie trzech liczb z cytatami źródeł · wynik odtworzenia objawu ·
cztery hipotezy z komendą, wynikiem i werdyktem · `numTotalTests` każdego przebiegu ·
wynik obu przebiegów migracji. **Commit po `R3`.**

## R4 — PRZYCZYNA NIESTABILNOŚCI I DZIESIĘĆ PRZEBIEGÓW (rdzeń)

1. **Nazwij przyczynę jednym zdaniem, z `plik:linia`.** „Zależność od kolejności lub stanu"
   nie jest przyczyną — jest listą podejrzanych. Przyczyna to na przykład: *„`day276-workbook`
   czyta wiersz, który `day274` usuwa w `afterEach`, bo obie suity używają tego samego
   `organizationId` zaszytego w `plik:linia`"*.
2. **Napraw przyczynę**, jeżeli leży w kodzie testu albo w izolacji stanu. Jeżeli leży
   w produkcie (realny wyścig) — naprawiasz produkt, z dowodem mutacyjnym.
   **Jeżeli jedynym wyjściem byłby `--retry` albo `.skip` — STOP z uzasadnieniem** (`R0` 1).
3. **DZIESIĘĆ KOLEJNYCH PRZEBIEGÓW BEZ ZMIANY WYNIKU.** Zapisz `blok3-run-01.json` …
   `blok3-run-10.json`, każdy z `shasum -a 256`, wszystkie z `--retry=0`. Porównaj je
   **po nazwach przypadków** — nie po liczbach. **Jedna nazwa, która zmieniła stan między
   przebiegami, unieważnia dowód** i wracasz do punktu 1.
4. **Podaj, czy dziesięć przebiegów było na tej samej bazie, czy na świeżej per przebieg** —
   to zmienia znaczenie dowodu i musi być jawne.
5. **Sprzątanie:** `docker rm -fv cx-day349-pg` (bez `-v` wolumen zostaje), `df -h /` przed
   i po. Program stracił dobę na dysku zjedzonym przez niesprzątnięte artefakty.

**Wymagany dowód:** przyczyna jednym zdaniem z `plik:linia` · diff naprawy · dziesięć plików
JSON z `shasum -a 256` i porównaniem po nazwach · jawne zdanie o bazie · `df -h /` przed i po.
**Commit po `R4`.**

## R5 — BEZPIECZNIK PRZED NAWROTEM

Jeżeli przyczyna z `R4` na to pozwala, dodajesz **jeden** bezpiecznik, który zaczerwieni się,
gdy defekt wróci:

- test izolacji stanu między suitami, albo
- asercja, że każda suita Bloku 3 pracuje na własnym, unikalnym identyfikatorze, albo
- kontrakt `tabindex`/pustego stanu dla **całej rodziny** komponentów powłoki, nie tylko
  dla jednego wywołania (`KROK 0` z `R1`).

**Nowy plik testowy kładziesz w `tests/`, NIGDY pod `src/`** — dziś trzeba było przenosić trzy
razy — i dodajesz go przez `git add -f`.

**Bezpiecznik bez dowodu mutacyjnego nie jest bezpiecznikiem**: zepsuj to, czego broni →
czerwony; przywróć → zielony.

Jeżeli przyczyna **nie pozwala** na bezpiecznik (np. jest w bibliotece testowej) — piszesz to
wprost jako wynik i **nie dodajesz atrapy bezpiecznika**.

**Wymagany dowód:** plik bezpiecznika z pełną nazwą przypadku · dowód mutacyjny w obie strony ·
albo jawne zdanie „bezpiecznik niemożliwy, bo …". **Commit po `R5`.**

## R6 — RAPORT I PYTANIA DO WŁAŚCICIELA

Raport zawiera: cztery bloki rozstrzygnięć z `R1` (werdykt `PRODUKT`/`ASERCJA` per czerwień) ·
diffy naprawy i dowody mutacyjne z `R2` · rozstrzygnięcie trzech rozbieżnych liczb dyżuru 335
z `R3` · cztery hipotezy z werdyktami · przyczynę niestabilności jednym zdaniem z `plik:linia` ·
**dziesięć przebiegów z `shasum -a 256` i porównaniem po nazwach** · bezpiecznik z `R5` ·
listę rozbieżności wobec liczb tej instrukcji · **niepustą sekcję „TWIERDZENIA
NIEZWERYFIKOWANE"** · obowiązkowy akapit `§0.2e` dla każdego uruchomionego pakietu ·
deklarację `Z30`.

★★ **Osobna, obowiązkowa sekcja: „`retry: CI ? 3 : 1` — ZNALEZISKO, KTÓREGO NIE NAPRAWIAM".**
`vitest.config.ts` ustawia ponawianie i **to jest mechanizm, który zamienia niestabilność
w fałszywą zieleń w CI**. Nie wolno Ci go zmienić (`Z18`), ale masz go opisać jako znalezisko,
z rekomendacją jako **diff nienałożony** i z oszacowaniem, ile testów w korpusie może dziś
przechodzić dzięki ponawianiu.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA".** W szczególności, jeżeli któraś
z czterech czerwieni okazała się `ASERCJĄ` opisującą kontrakt, którego produkt świadomie nie
ma — **pytanie brzmi, czy kontrakt ma wrócić do produktu, czy zostać skasowany z testu**.
To jest decyzja produktowa, nie techniczna. Sekcja może być pusta, ale wtedy piszesz wprost:
„nie mam pytań".

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle pisze inny autor.

**Commit po `R6`.**

## Próg odbioru

**Cztery testy zielone z powodu naprawy produktu albo poprawienia błędnej asercji — z jawnym
uzasadnieniem, które to jest i dlaczego, oraz z dowodem mutacyjnym per czerwień; a niestabilność
wyjaśniona PRZYCZYNĄ (`plik:linia`, nie listą podejrzanych) i udowodniona DZIESIĘCIOMA
kolejnymi przebiegami bez zmiany wyniku, porównanymi po nazwach przypadków.**

Odbiorca odrzuci dyżur, w którym pojawi się `.skip`, `.todo`, `--retry` inne niż `0`,
poszerzony `exclude` albo obniżony próg; w którym niestabilność uznano za naprawioną po
jednym zielonym przebiegu; w którym porównanie jest po liczbach zamiast po nazwach; albo
w którym zmieniono asercję bez dowodu, że produkt świadomie zmienił kontrakt.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „cztery czerwienie rozstrzygnięte
per czerwień (k `PRODUKT`, l `ASERCJA`), naprawione m, niestabilność zreprodukowana i przypisana
hipotezie H2 z dowodem, dziesięć przebiegów niewykonane, bo …" — **jest pełnowartościowym
wynikiem, nawet jeśli nie wszystkie cztery testy zzieleniały.**

★★ **STOP jest tu wynikiem lepszym niż wyciszenie.** Jeżeli jedynym sposobem zzielenienia
czerwieni byłoby `.skip`, `--retry` albo obniżenie progu — **zatrzymujesz się i piszesz
dlaczego**. To jest dokładnie to zachowanie, za które dyżur 335 zasłużył na uznanie.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Zzieleń cztery testy" vs „zakaz wyciszania" | `R0` (1) i próg odbioru: zieleń pochodzi z naprawy produktu albo z poprawionej asercji z dowodem; wyciszenie to STOP, nie commit |
| „Wolno poprawić asercję" vs „zakaz zawężania kryterium" | `R0` (2) i `R2` punkt 2: poprawiona asercja wymaga **odwrotnej mutacji** — zepsuty produkt musi ją zaczerwienić; tautologia jest odrzucona |
| „`Z18` zakazuje ruszać `vitest.config.ts`" vs „`retry` maskuje niestabilność" | `LISTA_BRAMEK` i `R6`: **nie zmieniasz go**, obchodzisz jawnym `--retry=0` i opisujesz jako znalezisko z diffem **nienałożonym** |
| „`Z6` zakazuje cudzych katalogów `/private/tmp/cx-*`" vs „porównaj z `blok3-po.json`" | Tabela licencji: **wąska licencja WYŁĄCZNIE na odczyt i `shasum`** dwóch nazwanych plików; zapis i usuwanie nadal zakazane; brak pliku = odtwarzasz pomiar sam |
| „Napraw powłokę współdzieloną" vs „kanon UI jest prawem nadrzędnym" | Tabela licencji i `R2` punkt 3: naprawiasz **dokładnie to, co opisuje test**, fokus tokenem `c-focus`, a trzy bezpieczniki kanonu muszą kończyć się `0` |
| „Napraw rodzinę" vs „zakaz napraw poza zakresem" | `R1` punkt „sprawdź RODZINĘ" i `R5`: rodzinę **wypisujesz i pokrywasz bezpiecznikiem**; naprawa rodzeństwa poza czterema czerwieniami wymaga jawnego akapitu w raporcie i zgody na rozszerzenie zakresu |
| „Dziesięć przebiegów" vs „nie marnuj czasu" | `R4` punkt 3: to jest **jedyny akceptowany dowód** dla niestabilności; przebiegi są sekwencyjne i tanie w porównaniu z kosztem fałszywej zieleni |
| „Odtwórz objaw" vs „za pierwszym razem wyszło zielono" | `R3` punkt 3: zielony pierwszy przebieg **nie obala** niestabilności; przechodzisz do celowego szukania warunku (H1-H4) |
| „Nie dotykasz macierzy" vs „to jest praca pod G19" | Tabela licencji: `G19` należy do dyżuru 348; Ty dostarczasz **materiał** do tego wiersza, nie zmieniasz go |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R2` punkt 2 i `R4`: kopia przez `cp` do `SCRATCH`; `git diff` po cofnięciu ma być pusty |
| „Zero nowych dokumentów" (`Z13`) vs „pliki dowodowe i sekcja rejestru" | Tabela licencji: rejestr znalezisk to **AKTUALIZACJA istniejącego**, `evidence/day349/` to **ślad**; nowy dokument rejestrowy jest dokładnie jeden — raport `R6` |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — trzy pliki testowe UI, sześć plików Bloku 3, `decision.validators.ts`, `blok3-marker.json` sprawdzone; `evidence/day349/` **jawnie oznaczony jako nieistniejący**; `blok3-po.json` **jawnie oznaczony jako nieobecny w repo** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1-3, 5-7 i 11 zmierzone przy wydaniu, w tym pełny przebieg trzech plików UI (`62/58/4`) |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — walidator · montaż · kontroler Bloku 3 · serwis/repozytorium · middleware · UI powłoki · kanon · testy czerwieni · testy Bloku 3 · infrastruktura testów · artefakty cudze · dowody 335 · dowody własne · nowe testy · macierz · rejestr · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` i `R3` nie zmieniają kodu; `R2` dotyka wyłącznie czterech miejsc opisanych testami; `R4`/`R5` dotykają izolacji stanu i nowego pliku w `tests/` |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6396/5536 wolne (`lsof` przy wydaniu), brak kontenera `cx-day349-pg`, brak gałęzi `codex/day349-*` i worktree; 347/348/350 mają rozłączne porty i pliki; paczka 343-346 ma zarezerwowany przedział 6390-6393/5530-5533 i rozłączny temat; kolizja z 348 rozstrzygnięta imiennie po obu stronach |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera, łącznie z pełnym przebiegiem trzech plików testowych |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: `retry: CI ? 3 : 1`, „te same liczby" bez nazw, cztery różne kształty czerwieni, kanon powłoki, niestabilność jako własność harnessu, atrapa bazy, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
