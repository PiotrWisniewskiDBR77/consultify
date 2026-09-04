## ★★ UZUPEŁNIENIE DO SEKCJI „JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE" (wyżej)

Sekcja wyżej obowiązuje w całości. Poniższe dwa zdania mają **pierwszeństwo**
przed jej brzmieniem — pierwszego w niej nie ma, a drugie odsyła do sekcji,
która w tym dokumencie nazywa się inaczej.

1. **★ Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz rozbieżność wprost.**
   Dotyczy KAŻDEJ liczby w tym dokumencie, także tych, które autor zmierzył sam przy wydaniu.
2. **★ Obalenie którejkolwiek tezy z sekcji „MOJA HIPOTEZA" albo „Zmierz moje
   liczby sam" jest SUKCESEM dyżuru, a nie porażką.** Zapisz to w „Korektach
   wobec instrukcji" z dowodem i idź dalej. (Sekcja wyżej mówi „TEZY
   ZLECENIA…" — w tym dokumencie te sekcje noszą nazwy podane tutaj.)

---

## Po co ten dyżur istnieje

**Dyżur 349 zrobił rzecz, którą ten program ceni wyżej niż zieloną liczbę.** Miał kandydata
na przyczynę niestabilności — advisory lock. Sprawdził go **własnym dowodem mutacyjnym**:
usunął lock i puścił dziesięć przebiegów. Wszystkie wyszły zielone, czyli **lock nie był
przyczyną**. I wtedy 349 **sam odrzucił swojego kandydata** zamiast dopisać bezpiecznik,
który wyglądałby dobrze w raporcie. Bezpiecznika nie dodał świadomie — żeby nie commitować
atrapy. **To jest wzorzec, którego trzymasz się i Ty.**

**Przyczyna pozostaje nieznana.** To jest druga próba i ma iść **inną metodą**.

**Twarde fakty, wszystkie sprawdzalne w repo:**

Pliki `day274`, `day275`, `day276` (dwa) i `day277` bywają czerwone raz i zielone przy
ponowieniu **bez żadnej zmiany kodu**. W repo leżą cztery artefakty tego samego Bloku 3:

| Artefakt | Liczby | Czerwone przypadki (po nazwach) |
| --- | --- | --- |
| `evidence/g19/blok3-marker.json` | `18/11/7` | `day274` ×1, `day276-deck` ×2, `day276-workbook` ×2, `day277` ×2 |
| `evidence/g19/day335-artefakty/blok3-przed.json` | `18/12/6` | `day274` ×1, `day275` ×1, `day276-workbook` ×2, `day277` ×2 |
| `evidence/g19/day348-artefakty/blok3-przed.json` | `18/11/7` | `day275` ×1, `day276-deck` ×2, `day276-workbook` ×2, `day277` ×2 |
| `evidence/g19/day335-artefakty/blok3-po.json` | `18/18/0` | **żaden** |

**Przeczytaj tę tabelę dwa razy.** Dwa różne przebiegi dały **identyczne `18/11/7`** przy
**różnych zestawach nazw**. Gdyby ktokolwiek porównał je po liczbach, uznałby je za ten sam
wynik. To jest `Z37` w postaci zmierzonej, nie teoretycznej.

**Czwarty wiersz jest najważniejszy: suita POTRAFI być cała zielona.** `18/18/0` po naprawie
payloadu z dyżuru 335 dowodzi, że nie mamy do czynienia z sześcioma trwale zepsutymi plikami.

---

## ★★ SPROSTOWANIE, KTÓREGO NIE WOLNO COFNĄĆ

Wcześniejsza teza nadzorcy brzmiała: „`vitest.config.ts` ustawia `retry: CI ? 3 : 1`".
**Ta teza jest FAŁSZYWA.** Stan faktyczny na markerze, sprawdzony komendą (2) z `§0.3`:

- `vitest.config.ts:339` ustawia **`retry: 0`**. Zapis `retry: process.env.CI ? 3 : 1` żyje
  wyłącznie w **komentarzu historycznym** nad tym wierszem — jest tam CELOWO, jako
  wyjaśnienie, dlaczego bezpiecznik powstał. Nie kasujesz go i nie „porządkujesz".
- `server/vitest.config.ts` — **config, którym Blok 3 realnie biegnie** — nie zawiera
  słowa `retry` w ogóle, czyli obowiązuje domyślne `retry: 0`.
- Istnieje bezpiecznik `tests/unit/config/vitestNoRetry.contract.test.ts`, który pilnuje,
  żeby ponowienia nie wróciły. **Nie osłabiasz go i nie omijasz.**

**Wniosek: ponowień nie ma w żadnym z dwóch configów. Tam przyczyny nie ma.** Każda minuta
wydana na sprawdzanie `retry` jest minutą straconą — i to jest jedyne zdanie w tym dokumencie,
którego nie musisz weryfikować samodzielnie przed pominięciem, bo komenda (2) rozstrzyga je
w trzy sekundy.

**★★ UWAGA — ten sam fałsz stoi wyżej, w tabeli zakazów.** Kolumna uzasadnienia `Z29` mówi
„`vitest.config.ts` ustawia `retry: CI ? 3 : 1`". **To jest opis stanu sprzed dyżuru 42**,
który tę wartość wyzerował; szkielet instrukcji nie został po tamtej zmianie poprawiony.
**Sam zakaz `Z29` obowiązuje bez zmian** — `--retry=0` w każdej komendzie pomiarowej —
zmienił się wyłącznie powód, dla którego jest potrzebny. **Nie „naprawiaj" tego przez
przywrócenie ponowień w konfiguracji.** Rozbieżność zapisz w „Korektach wobec instrukcji";
poprawienie szkieletu należy do nadzorcy.

---

## ★★ MOJA HIPOTEZA — masz ją OBALIĆ ALBO POTWIERDZIĆ, nie przyjąć

| # | Teza | Na czym ją opieram | Jak ją obalisz |
| --- | --- | --- | --- |
| `H1` | „Trzeci pomiar `12/18`" **nie istnieje**. `12` i `18` to `numTotalTestSuites` i `numTotalTests` — **stała para we wszystkich czterech artefaktach**, nie wynik | komenda (3) z `§0.3`: każdy z czterech plików podaje `12` suit i `18` testów, mając 6 wpisów w `testResults` | Pokaż artefakt, w którym `12` jest liczbą **zielonych przypadków**. Wtedy teza pada i mamy naprawdę trzeci wynik |
| `H2` | Czerwienie dzielą się na **stały rdzeń** (`day276-workbook` ×2, `day277` ×2 — czerwone we wszystkich trzech pomiarach „przed") i **pierścień rotujący** (`day274` ×1, `day275` ×1, `day276-deck` ×2) | tabela wyżej, artefakty w repo | Puść suitę dziesięć razy. Jeżeli rdzeń też rotuje — teza pada. Jeżeli pierścień okaże się stały — teza pada |
| `H3` | **Rdzeń to REALNY DEFEKT, nie niestabilność.** Niestabilność dotyczy wyłącznie pierścienia | `H2` + `blok3-po.json` = `18/18/0`, czyli rdzeń **da się** naprawić | Jeżeli rdzeń przejdzie zielono w choćby jednym z Twoich dziesięciu przebiegów bez zmiany kodu — teza pada i rdzeń też jest niestabilny |
| `H4` | **Czerwony przebieg jest SZYBKI, zielony jest WOLNY** — to nie jest przekroczenie limitu czasu, tylko `fail-fast` | komenda (5) z `§0.3`: `day277` „owner writes all five fields" = **43 ms na czerwono**, **201 ms na zielono**; `day275` = 41 ms / 186 ms; `day276-workbook` = 37 ms / 87 ms | Zmierz czasy w swoich przebiegach. Jeżeli czerwone są wolniejsze albo równe zielonym, teza pada i wracają kandydaci czasowe (`testTimeout: 10000` w `server/vitest.config.ts`) |
| `H5` | **Kolejność plików nie jest przyczyną, bo nie jest losowa.** `server/vitest.config.ts` nie ustawia `sequence.shuffle`; `order: 'random'` w `vitest.config.ts:345` to klucz nieistniejący w tym miejscu (jak zdemaskowany już `retryMode: 'run'`) i dotyczy innego configu | komenda (6) z `§0.3` | Wypisz **rozstrzygniętą** konfigurację (`vitest --config server/vitest.config.ts list` albo log z `--reporter=verbose`) i pokaż, że kolejność się zmienia między przebiegami. Wtedy teza pada |
| `H6` | **Kolejność w `beforeEach` nie jest przyczyną, bo `beforeEach` w tych plikach nie ma.** Wszystkie cztery pliki `day27x` używają `beforeAll` i `randomUUID` — kolizja identyfikatorów między plikami jest wykluczona | komenda (7) z `§0.3`: `beforeEach` = 0 trafień | Znajdź `beforeEach` albo stały identyfikator w którymkolwiek z sześciu plików. Wtedy teza pada |
| `H7` | Najcenniejszy brakujący pomiar to **treść odpowiedzi `500`**. Trzy dyżury odczytały kod statusu i **ani jeden nie odczytał ciała błędu ani logu serwera** | przegląd raportów 335/348/349 i artefaktów: w JSON-ach są wyłącznie `expected 500 to be 200` | Pokaż w artefaktach zapisaną treść `500`. Jeżeli jest — teza pada i masz gotowy trop |

---

## ★ Zmierz moje liczby sam

Każda liczba w tym dokumencie jest **rozkazem pomiarowym**, nie faktem. Dwie rzeczy ze
zlecenia nadzorcy autor tej instrukcji **obalił już przy wydaniu** i zapisuje to jawnie,
żeby nie wróciły jako „zweryfikowany fakt":

> **Zlecenie mówiło: „trzy niezależne pomiary tego samego markera dały trzy różne wyniki:
> `18/11/7`, `18/12/6` oraz `12/18`".** Zmierzyłem: `12/18` to `numTotalTestSuites` /
> `numTotalTests` — para **stała we wszystkich czterech artefaktach**, także w tym, który
> jest w 100% zielony. To najprawdopodobniej **nie jest trzeci pomiar, tylko trzeci odczyt
> tego samego pliku**. Sprawdź to komendą (3) i rozstrzygnij.

> **Zlecenie mówiło: „`day274`/`day275`/`day276` bywają czerwone".** Do tej listy należy
> także **`day277`** — czerwony we wszystkich trzech pomiarach „przed" i zielony
> w `blok3-po.json`. Pomijanie go zawęża zbiór o połowę stałego rdzenia.

---

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: TESTY · TRASA · KONTROLER · SERWIS · BRAMKA · KONFIGURACJA · DOWODY

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` + rekomendację jako diff **nienałożony**. Pozycja z takim produktem
jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Sześć plików Bloku 3** | `server/src/routes/__tests__/{ai.agentHubRateLimitRouting,day274-ocena-dociera-do-listy.pg,day275-method-outputs-kontrakt.pg,day276-deck-autosave-persist.pg,day276-workbook-cell-persist.pg,day277-decyzje-zapis.pg}.test.ts` | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ dowolną liczbę razy** i wolno **dopisać diagnostykę** (log treści odpowiedzi, log czasu, log stanu bazy) w `R1`/`R2`. **Zakaz: `.skip`, `.only`, `.todo`, `.fails`, usuwania przypadków, osłabiania asercji, podnoszenia `testTimeout` w pliku, dopisywania `retry`.** Diagnostykę zostawiasz w kodzie **tylko wtedy, gdy jest trwale użyteczna** — inaczej cofasz ją przez `cp` przed commitem | — |
| **Trasa · kontroler · serwis · repozytorium wołane przez te testy** | `server/src/routes/**` (poza szóstką), `server/src/controllers/**`, `server/src/services/**`, `server/src/repositories/**` | **TYLKO ODCZYT do czasu wskazania przyczyny.** Jeżeli `R2` wskaże przyczynę z `plik:linia` **w tym obszarze**, `R3` dostaje **wąską licencję na jedną zmianę w jednym pliku**, z parą mutacyjną i dziesięcioma przebiegami. Zmiana bez wskazanej przyczyny = odrzucenie pozycji | Brief z `plik:linia` |
| **Bramka członkostwa** | `server/src/middleware/auth.middleware.ts` i cały `server/src/middleware/**` | **★★ NIETYKALNE DO ZAPISU — `Z12` i `Z40`.** Kształt `403` jest **objawem**, nie miejscem naprawy. „Naprawa" polegająca na tym, że bramka przestaje pytać bazy albo dopuszcza status inny niż `ACTIVE`, to **odrzucenie całego dyżuru**, nie pozycji | Brief z `plik:linia` + wpis do raportu |
| **Konfiguracja testów** | `vitest.config.ts`, `server/vitest.config.ts`, `server/vitest.config.v8-db.ts`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**` | **★★ NIETYKALNE DO ZAPISU — `Z18`, NAJOSTRZEJSZY.** Wolno **czytać** i wolno **cytować `plik:linia`**. Wolno **zmutować tymczasowo** w `R2` jako dowód (np. `fileParallelism: false`), pod warunkiem cofnięcia przez `cp` i **pustego `git diff`**. Trwała zmiana `retry`, `exclude`, `testTimeout` albo progów = odrzucenie dyżuru | Cytat + wynik przebiegu |
| **Bezpiecznik zakazu ponowień** | `tests/unit/config/vitestNoRetry.contract.test.ts` | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ**. **Zakaz osłabiania i usuwania przypadków** | — |
| **Nowe testy i skrypty diagnostyczne** | `tests/**` (NOWE pliki, `git add -f`), `scripts/**` (NOWY skrypt, `git add -f`) | **★ PEŁNA LICENCJA na dodanie**, z zastrzeżeniem `Z18` i `Z31`. **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`.** Po dodaniu: `node scripts/dev/reachability-from-root.mjs --check-baseline` musi dać `exit 0` | — |
| **Migracje** | `server/migrations/**` | **TYLKO ODCZYT.** Uruchamiasz je w `BLOKU 0` na własnym kontenerze; **nie dopisujesz ani nie zmieniasz żadnej.** Jeżeli przyczyna leży w migracjach — produktem jest **brief z `plik:linia`**, nie migracja; pozycja z briefem jest ZROBIONA, nie STOP | Brief |
| **Front** | `src/**` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** Blok 3 to kontrakty tras; front tu nie występuje | Opis w raporcie |
| **CI** | `.github/workflows/**` | **TYLKO ODCZYT (`Z38`/`Z39`).** Jeżeli uznasz, że Blok 3 powinien mieć bramkę w CI — rekomendujesz to jako diff **nienałożony** i jako pytanie do właściciela | Diff nienałożony + brief |
| **Macierze odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16) | **★★ NIETYKALNE DO ZAPISU — w szczególności wiersz `G19`.** Ten dyżur diagnozuje przyrząd, a nie orzeka o module | — |
| **Dowody** | `evidence/g19/day358/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**, `git add -f`) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie.** **Wszystkie JSON-y przebiegów, logi i tabele lądują TUTAJ, w repo.** Dowód w `/private/tmp` nie jest dowodem — cztery razy jednego dnia trzeba było takie ratować | — |
| **Istniejące artefakty G19** | `evidence/g19/**` poza `day358/` | **TYLKO ODCZYT — cudza praca, dowód historyczny.** Czytasz je obowiązkowo w `R1`; **nie nadpisujesz i nie kasujesz** | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem (dziś doszły do `Q`) | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY358_NIESTABILNOSC_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `server/src/routes/v8/finance-v2/__tests__/**`, `evidence/g15/**` (dyżur 355) · `src/components/MyWork/prototypes/**`, `tests/unit/flags/**`, `evidence/day356/**` (dyżur 356) · `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, `evidence/day357/**` (dyżur 357) · licznik kompletności, 20 ekranów podglądu, etykiety narzędzi (dyżury 351-354) | **TYLKO ODCZYT** | Wpis do raportu |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

---

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
#   moje liczby: wszystkie 0. ★ Ostatni sprawdzasz PO KAZDYM dodaniu pliku do tests/.

# (c) ★★ WLASCIWY TEMU DYZUROWI — konfiguracja ponowien MUSI byc nietknieta
bash -c "grep -n 'retry: 0' vitest.config.ts"
bash -c "grep -c 'retry' server/vitest.config.ts" || echo "server/vitest.config.ts: 0 trafien — poprawnie"
git diff --stat -- vitest.config.ts server/vitest.config.ts
#   oczekiwane PRZED i PO: wiersz 339 = 'retry: 0'; server config bez slowa 'retry'; git diff PUSTY
```

**Jeżeli którakolwiek liczba zmaleje (słowniki) albo bramka zgaśnie — naprawiasz KODEM,
nigdy progiem i nigdy `--no-verify`** (`Z35`). **Jeżeli `git diff` na configach nie jest
pusty na koniec — cofasz zmianę przez `cp`, zanim zrobisz cokolwiek innego.**

---

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | plików w Bloku 3 | `6` | komenda (1) z `§0.3` | TAK |
| 2 | przypadków w Bloku 3 | `18` | komenda (3) z `§0.3` | TAK — **stałe we wszystkich czterech artefaktach** |
| 3 | `numTotalTestSuites` w tych samych plikach | `12` | komenda (3) z `§0.3` | TAK — **to jest źródło fałszywego „trzeciego pomiaru"** (`H1`) |
| 4 | wpisów w `testResults` | `6` | komenda (3) z `§0.3` | TAK — `6 ≠ 12`, licznik suit nie odpowiada plikom |
| 5 | przypadków w stałym rdzeniu | `4` (`day276-workbook` ×2, `day277` ×2) | komenda (4) + `R1` | TAK — `H2`/`H3` |
| 6 | przypadków w pierścieniu rotującym | `4` (`day274` ×1, `day275` ×1, `day276-deck` ×2) | komenda (4) + `R1` | TAK |
| 7 | czas przypadku `day277` „owner writes all five fields" na czerwono / na zielono | `43 ms` / `201 ms` | komenda (5) z `§0.3` | TAK — **`H4`, sygnatura `fail-fast`** |
| 8 | wiersz z `retry` w `vitest.config.ts` | `339`, wartość `0` | komenda (2) z `§0.3` | TAK — **sprostowanie** |
| 9 | trafień `retry` w `server/vitest.config.ts` | `0` | komenda (2) z `§0.3` | TAK — **config, którym Blok 3 realnie biegnie** |
| 10 | trafień `beforeEach` w plikach `day27x` | `0` | komenda (7) z `§0.3` | TAK — `H6` startuje z pozycji obalonej |
| 11 | `testTimeout` w `server/vitest.config.ts` | `10000` ms | komenda (6) z `§0.3` | TAK — **jedyny nadpisany klucz; reszta domyślna** |
| 12 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

---

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY358_NIESTABILNOSC_REPORT.md` ·
`evidence/g19/day358/**` (nowy katalog, `git add -f`).

**Zapisujesz WARUNKOWO (tylko z dowodem `R2`/`R3`):**
jeden plik z szóstki Bloku 3 (diagnostyka trwale użyteczna) · **jeden** plik produktu
wskazany jako przyczyna w `R2` · nowe pliki testowe w `tests/` (`git add -f`) · nowy skrypt
w `scripts/` (`git add -f`) · `REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `src/**`, `server/src/middleware/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`,
`tests/unit/config/vitestNoRetry.contract.test.ts`, `tsconfig*.json`, `.github/workflows/**`,
`server/migrations/**`, `public/locales/**`, wszystkie `MODULE_ACCEPTANCE.md`,
`evidence/g19/**` poza `day358/`, `evidence/g15/**`, `evidence/day35{6,7}/**`,
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day358-niestabilnosc
mkdir -p evidence/g19/day358
git diff --name-only --cached | tee evidence/g19/day358/staged.txt
# ★ UWAGA: grep -E NIE ZNA lookaheadow. Katalog wlasny wycinamy OSOBNYM grep -v, nie wzorcem.
bash -c "grep -v '^evidence/g19/day358/' evidence/g19/day358/staged.txt | grep -iE '^src/|^server/src/middleware/|vitest.*config|^tests/setup|^tests/helpers|^tests/__mocks__|vitestNoRetry|^tsconfig|^\.github/|^server/migrations/|^public/locales/|MODULE_ACCEPTANCE|^evidence/g19/|^evidence/g15/|^evidence/day35[67]/|PRZELOT_WLASCICIELA'" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
bash -c "grep -rn '\.skip(\|\.only(\|\.todo(\|\.fails(\|retry' server/src/routes/__tests__/day27*.pg.test.ts server/src/routes/__tests__/ai.agentHubRateLimitRouting.test.ts" \
  && echo "★★ WYCISZENIE W PLIKACH BLOKU 3 — COFNIJ" \
  || echo "brak wyciszen OK"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

1. **Nie zaczynasz od naprawiania. Zaczynasz od ROZDZIELENIA.** Dopóki nie wiesz, które
   przypadki są trwale czerwone, a które rotują, każdy przebieg mierzy mieszankę dwóch
   różnych zjawisk i nic nie rozstrzyga. **To jest metoda, którą ten dyżur różni się od 349.**
2. **Każdy kandydat obalany OSOBNO, z dowodem obalenia.** „Sprawdziłem równoległość
   i kolejność, nic z tego" nie jest wynikiem. Wynikiem jest: kandydat · komenda · liczba
   przebiegów · wynik · zdanie „obalony, bo…". Dyżur 349 zostawił wzór — trzymaj się go.
3. **Odczytaj TREŚĆ błędu, nie kod statusu.** `500` to wyjątek i ma komunikat oraz ślad
   stosu. Trzy dyżury odczytały `expected 500 to be 200` i ani jeden nie zapisał, co
   serwer właściwie powiedział. **To jest najtańszy nieodrobiony pomiar w tym temacie.**
4. **Jeżeli nie znajdziesz przyczyny — napisz to wprost i NIE dokładaj atrapy bezpiecznika.**
   Raport „nie znaleziono, oto siedmiu kandydatów i dowody ich obalenia" jest
   **pełnowartościowym wynikiem odbioru**. Bezpiecznik, który zawsze świeci na zielono,
   nie jest.

---

## R1 — ROZDZIELENIE RDZENIA OD PIERŚCIENIA: DZIESIĘĆ PRZEBIEGÓW PO NAZWACH (rdzeń)

1. **Postaw bazę wg `BLOKU 0`** (kontener `cx-day358-pg`, port `6417`, pełne migracje,
   dwa przebiegi migracji — drugi ma być bezbłędny i bez zmian). **Dopiero potem** cokolwiek
   mierzysz (`Z20`).
2. **Puść Blok 3 dziesięć razy**, z cwd `server/`, configiem `server/vitest.config.ts`,
   wariantem (B), z `--retry=0` i `--reporter=json --outputFile=evidence/g19/day358/przebieg-NN.json`
   dla `NN` od `01` do `10`. **Uruchomienie z katalogu głównego daje `0` wykonanych
   przypadków i `exit 0` — to jest BŁĄD KOMENDY, nie `PASS`** (zdarzyło się dyżurowi 335).
   Po każdym przebiegu sprawdź, że `numTotalTests` = `18`; jeżeli nie — komenda jest zła,
   nie produkt.
3. **Zbuduj tabelę 18 wierszy × 10 kolumn** (przypadek × przebieg, `GREEN`/`RED`),
   **po pełnych nazwach `fullName`, nigdy po liczbach** (`Z37`). Zapisz jako
   `evidence/g19/day358/r1-macierz.md`. To jest **główny produkt tego dyżuru** i bez niego
   żadna dalsza pozycja nie ma podstawy.
4. **Rozstrzygnij `H2` i `H3`.** Przypadek czerwony w `10/10` = **rdzeń**. Przypadek
   o wyniku mieszanym = **pierścień**. Podaj obie listy imiennie i jawnie napisz, czy mój
   podział (`4` + `4`) się potwierdził. **Jeżeli rdzeń rotuje albo pierścień jest stały —
   to jest cenniejszy wynik niż potwierdzenie.**
5. **Zmierz czasy (`H4`).** Dla każdego przypadku o wyniku mieszanym podaj medianę czasu
   na czerwono i na zielono. Potwierdź albo obal sygnaturę „czerwony szybki / zielony wolny".
6. Zapisz dziesięć JSON-ów **do repo**, nie do `/private/tmp`. **`git add -f`.**

**Commit po `R1`. Push na `github-backup` (`Z34a`).**

---

## R2 — TREŚĆ BŁĘDU I OBALANIE KANDYDATÓW POJEDYNCZO (rdzeń)

**Kolejność jest wiążąca: najpierw punkt 1, bo może rozstrzygnąć wszystko naraz.**

1. **★★ ODCZYTAJ TREŚĆ `500`.** Dopisz do jednego przypadku z rdzenia (np. `day277`
   „owner writes all five fields") log ciała odpowiedzi i log błędu serwera przy statusie
   innym niż oczekiwany. Puść pięć razy i **wklej do raportu dosłowną treść komunikatu**.
   Zapisz jako `evidence/g19/day358/r2-tresc-500.txt`. Jeżeli komunikat wskaże przyczynę —
   masz ją, idziesz do `R3` i **pomijasz resztę kandydatów, pisząc dlaczego**.
2. **Kandydat: równoległość plików.** Puść Blok 3 dziesięć razy z `--no-file-parallelism`.
   Wynik identyczny w `10/10` → równoległość jest **warunkiem koniecznym** i to jest trop.
   Wynik nadal mieszany → kandydat **obalony**, zapisz to.
3. **Kandydat: kolejność plików (`H5`).** **Najpierw udowodnij, czy kolejność w ogóle się
   zmienia** — wypisz rozstrzygniętą konfigurację i porównaj kolejność plików w dwóch
   przebiegach. Jeżeli jest stała, kandydat jest **obalony bez ani jednego dodatkowego
   przebiegu** i piszesz to. Jeżeli się zmienia, moja teza `H5` pada — puść z wymuszoną
   stałą kolejnością i porównaj.
4. **Kandydat: stan współdzielony między plikami.** Puść **każdy z sześciu plików osobno**,
   dziesięć razy każdy. Plik czerwony **także w izolacji** → to defekt wewnętrzny tego pliku
   albo produktu, **nie interakcja**. Plik zielony `10/10` w izolacji i czerwony w pakiecie →
   **interakcja potwierdzona**; wtedy uruchamiaj **pary** (ofiara + każdy inny plik), żeby
   nazwać agresora. Wyniki do `evidence/g19/day358/r2-izolacja.md`.
5. **Kandydat: wyciek połączeń do bazy.** W trakcie przebiegu pakietu zmierz
   `SELECT count(*) FROM pg_stat_activity` i porównaj z `SHOW max_connections` na **swoim**
   kontenerze. Podaj wartość szczytową. Jeżeli szczyt jest daleko od limitu, kandydat jest
   **obalony liczbą**, nie przeczuciem.
6. **Kandydat: zegar i strefa czasowa.** Puść pakiet z `TZ=UTC` i z `TZ=Europe/Warsaw`,
   po pięć razy. Różnica wyniku = trop; brak różnicy = kandydat obalony.
7. **Kandydat: kolejność w `beforeEach` (`H6`).** Zaczyna z pozycji obalonej — `beforeEach`
   w tych plikach nie ma. **Potwierdź komendą i zamknij go jednym zdaniem**, nie przebiegami.
8. **Tabela kandydatów** — obowiązkowa, do `evidence/g19/day358/r2-kandydaci.md`:
   kandydat · komenda · liczba przebiegów · wynik · **werdykt: POTWIERDZONY / OBALONY /
   NIEROZSTRZYGNIĘTY** · zdanie uzasadnienia. **Kandydat bez dowodu obalenia liczy się jako
   nierozstrzygnięty, nie jako obalony.**

**Commit po `R2`. Push.**

---

## R3 — JEDNA ZMIANA I DZIESIĘĆ PRZEBIEGÓW BEZ ZMIANY WYNIKU (rdzeń, warunkowa)

**Ta pozycja jest WARUNKOWA: wykonujesz ją tylko wtedy, gdy `R2` wskazał przyczynę
z `plik:linia`. Bez wskazanej przyczyny przechodzisz do `R4` i piszesz to wprost — to nie
jest porażka.**

1. **Zmieniasz JEDNĄ rzecz w JEDNYM pliku.** Nie sześć poprawek per plik testowy; jedno
   źródło. Jeżeli naprawa wymaga sześciu różnych rozwiązań, to znaczy, że `R2` nie znalazł
   jednej przyczyny — i mówisz to wprost zamiast rozsypywać łaty.
2. **Para mutacyjna celująca w ZABEZPIECZENIE, nie w mechanizm.** Psujesz naprawę → **dziesięć
   przebiegów, wynik wraca do niestabilnego**; przywracasz przez `cp` (`Z27`, nigdy
   `git stash`) → **dziesięć przebiegów zielonych**; `git diff` po przywróceniu **pusty**.
   Obie komendy i oba wyniki dosłownie w raporcie.
3. **Próg to dziesięć KOLEJNYCH przebiegów bez zmiany wyniku**, porównanych **po nazwach**.
   Dziewięć zielonych i jeden mieszany = **próg nieosiągnięty**, i zapisujesz to jako taki.
4. **★★ ZAKAZ, który unieważnia całą pozycję:** naprawa przez `.skip`, `.todo`, `--retry`,
   `retry` w konfiguracji, poszerzenie `exclude`, podniesienie `testTimeout` w celu ukrycia
   objawu albo obniżenie progu. **Uznasz to za jedyne wyjście → STOP z uzasadnieniem**
   i przechodzisz do `R4`.
5. Zapisz dziesięć JSON-ów po naprawie do `evidence/g19/day358/po-naprawie-NN.json`.
   **`git add -f`.**

**Commit po `R3`. Push.**

---

## R4 — JAWNY WERDYKT I GRANICA WIEDZY

1. **Napisz werdykt jednym zdaniem** w jednym z dwóch kształtów, bez trzeciej możliwości:
   - „**Przyczyna: `plik:linia`** — dziesięć kolejnych przebiegów bez zmiany wyniku,
     dowód mutacyjny w obie strony w `evidence/g19/day358/`."
   - „**Nie znaleziono.** Sprawdziłem N kandydatów, M obaliłem dowodem, K pozostaje
     nierozstrzygniętych. Bezpiecznika nie dodałem, bo byłby atrapą."
2. **★ Drugi kształt jest wynikiem akceptowalnym.** Dyżur 349 oddał dokładnie taki i został
   przyjęty. **Udawanie nie jest** — bezpiecznik, który przechodzi, bo nie może zmierzyć,
   bo nikt go nie woła albo bo wejście jest puste, to **gorzej niż brak bezpiecznika**.
3. **Rozstrzygnij `H3` na piśmie:** czy stały rdzeń to realny defekt produktu, czy
   niestabilność. Jeżeli realny defekt — **opisujesz go z `plik:linia` jako osobne
   zlecenie** i **nie naprawiasz go w tym dyżurze** (to inny zakres i inna licencja).
4. **★★ Napisz wprost, czego wynik NIE dowodzi.** W szczególności: **żadna liczba z Bloku 3
   uzyskana w tym dyżurze nie jest podstawą do podniesienia wiersza `G19`** w żadnym
   `MODULE_ACCEPTANCE.md`. Zdanie musi być w raporcie dosłownie.

**Commit po `R4`. Push.**

---

## R5 — RAPORT, JAWNE LICZBY I PYTANIA DO WŁAŚCICIELA

Raport zawiera: **macierz 18 × 10 po nazwach** · listę rdzenia i pierścienia · **dosłowną
treść odpowiedzi `500`** · tabelę kandydatów z werdyktami · odpowiedź na `H1`–`H7`
(„potwierdzona / obalona", każda z komendą i wynikiem) · **pusty `git diff` na obu configach
vitest, wklejony dosłownie** · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** ·
obowiązkowy akapit `§0.2e` dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „CO NADAL WYMAGA OSOBNEGO ZLECENIA".** Jeżeli stały rdzeń
okazał się realnym defektem — tu go opisujesz, z `plik:linia`, i **nie naprawiasz**.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA".** Może być pusta, ale wtedy
piszesz wprost: „nie mam zastrzeżeń".

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy (dziś sekcje doszły do `Q`).

**Commit po `R5`. Push.**

---

## Próg odbioru

**Przyczyna z `plik:linia` i dziesięć kolejnych przebiegów bez zmiany wyniku, porównanych
po nazwach — ALBO jawny raport „nie znaleziono" z listą sprawdzonych i OBALONYCH kandydatów,
każdy z dowodem obalenia.** W obu wariantach obowiązkowa jest macierz `18 × 10` i rozdzielenie
rdzenia od pierścienia.

Odbiorca odrzuci dyżur, w którym: wyniki porównano po liczbach zamiast po nazwach; kandydata
zamknięto zdaniem „sprawdziłem, nic z tego" bez komendy i liczby przebiegów; dopisano
bezpiecznik, który przechodzi zawsze; zmieniono `retry`, `exclude`, `testTimeout` albo dodano
`.skip`; podniesiono wiersz `G19`; dowody zostawiono w `/private/tmp` zamiast w
`evidence/g19/day358/`; albo Blok 3 uruchomiono z katalogu głównego i `0` wykonanych
przypadków odczytano jako sukces.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „macierz 18 × 10 zbudowana,
rdzeń i pierścień rozdzielone imiennie, treść `500` odczytana i wklejona, trzech kandydatów
obalonych dowodem, czwartego nie zdążyłem — oto który i jaką komendą go sprawdzić" —
**jest pełnowartościowym wynikiem.** Zdanie „niestabilność naprawiona" bez dziesięciu
przebiegów porównanych po nazwach nie jest.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną. Dotyczy to zwłaszcza
konfiguracji ponowień — **jeżeli `retry` w którymkolwiek configu przestało być zerem,
zatrzymujesz się i meldujesz to nadzorcy, zanim cokolwiek zmierzysz.**

## AUDYT SPRZECZNOŚCI

| Para wymagań, która może wyglądać na sprzeczną | Rozstrzygnięcie |
| --- | --- |
| „Znajdź przyczynę" vs „wolno nie znaleźć" | `R0` (4) i `R4` (2): raport „nie znaleziono" z dowodami obalenia jest **wynikiem odbioru**, nie porażką; nieakceptowalne jest udawanie, nie niewiedza |
| „Zmutuj `fileParallelism`" vs `Z18` (configi NIETYKALNE) | Tabela licencji, wiersz „Konfiguracja testów": nietykalne **do zapisu trwałego**; mutacja tymczasowa z cofnięciem przez `cp` i pustym `git diff` jest jawnie zamówiona |
| „Dopisz diagnostykę do testów" vs „nie zmieniasz testów" | Tabela licencji, wiersz „Sześć plików Bloku 3": wolno **dopisać log**, zakazane jest osłabianie asercji, `.skip` i usuwanie przypadków — to różnica między obserwacją a wyciszeniem |
| „`403` wskazuje bramkę członkostwa" vs `Z40` (bramka nietykalna) | Tabela licencji: `403` jest **objawem**, nie miejscem naprawy; naprawa przez rozluźnienie bramki = odrzucenie **całego** dyżuru |
| „Instrukcja mówi `12/18` to trzeci pomiar" vs „mój pomiar mówi, że to `numTotalTestSuites`" | Sekcja „Zmierz moje liczby sam", teza `H1`: autor obalił to zdanie zlecenia **przy wydaniu**; wiążący jest pomiar wykonawcy (`Z24`) |
| ★★ **`Z29` w tabeli zakazów mówi: „`vitest.config.ts` ustawia `retry: CI ? 3 : 1`"** vs sekcja „SPROSTOWANIE" tego dokumentu | **Kolumna uzasadnienia `Z29` jest NIEAKTUALNA** — to opis stanu z 28.08, sprzed dyżuru 42, który tę wartość wyzerował. Dziś `vitest.config.ts:339` ma `retry: 0`, a `server/vitest.config.ts` nie ma słowa `retry`. **SAM ZAKAZ `Z29` obowiązuje bez zmian** (`--retry=0` w każdej komendzie), zmienił się tylko powód, dla którego jest potrzebny. Sprawdź to komendą (2) i **zapisz rozbieżność w „Korektach wobec instrukcji" — kolumna uzasadnienia `Z29` do poprawienia w szkielecie `docs/program/system-pracy/02_SZKIELET_INSTRUKCJI.md`, co jest zadaniem nadzorcy, nie Twoim** |
| „Sprawdź kolejność plików" vs „kolejność nie jest losowa" | `R2` (3): **najpierw dowodzisz, czy kolejność się zmienia**; jeżeli nie — kandydat pada bez ani jednego przebiegu i to też jest wynik |
| „Napraw stały rdzeń" vs „nie naprawiasz defektów produktu" | `R4` (3): rdzeń, jeżeli okaże się realnym defektem, **opisujesz z `plik:linia` jako osobne zlecenie**; ten dyżur diagnozuje niestabilność |
| „Dziesięć przebiegów" vs `testTimeout: 10000` i realna baza | `BLOK 0` + `R1` (2): przebiegi są krótkie (`18` przypadków); jeżeli mimo to nie zdążysz — zatrzymujesz się po `R1` z commitem, zgodnie z prawem zatrzymania |
| „Zapisz dziesięć JSON-ów do repo" vs `Z13` (dokumentacja rośnie szybciej niż produkt) | Tabela licencji, wiersz „Dowody": `Z13` ogranicza **dokumenty rejestrowe**, a nie artefakty pomiarowe; **dowód poza repo wyparowuje** i dziś cztery razy trzeba było takie ratować |
| „Dopisz sekcję do rejestru znalezisk" vs „równolegle dopisują inni autorzy" | `R5`: literę sekcji sprawdzasz komendą **tuż przed commitem**, nie zakładasz z góry |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — sześć plików Bloku 3, `vitest.config.ts:339`, `server/vitest.config.ts` (66 wierszy), `tests/unit/config/vitestNoRetry.contract.test.ts`, cztery artefakty `evidence/g19/**`, `evidence/g19/mianownik.md` — wszystkie otwarte i odczytane przy wydaniu; `evidence/g19/day358/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wszystkie zmierzone przy wydaniu na markerze, w tym rozbicie czerwieni po nazwach i czasy przypadków |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — sześć plików Bloku 3 · trasa/kontroler/serwis/repozytorium · bramka członkostwa · konfiguracja testów · bezpiecznik ponowień · nowe testy i skrypty · migracje · front · CI · macierze odbioru · dowody · artefakty G19 · rejestr znalezisk · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` tylko mierzy, `R2` mutuje tymczasowo i cofa, `R3` jest **warunkowa** i zmienia jeden plik, `R4`/`R5` piszą |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `6417`/`5557` wolne przy wydaniu, brak kontenera `cx-day358-pg`, brak gałęzi `codex/day358-*` i worktree; 355/356/357 mają rozłączne porty (`6414`/`5554`, `6415`/`5555`, `6416`/`5556`) i **rozłączne pliki**; dyżury 351-354 mają rozłączny temat |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera, łącznie z odczytem czterech artefaktów JSON |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: **`numTotalTestSuites` czytane jako liczba zielonych**, dwa przebiegi o identycznych liczbach i różnych nazwach, uruchomienie z katalogu głównego dające `0` przypadków i `exit 0`, `DB_TYPE` przybity do `sqlite` w `server/vitest.config.ts`, `grep --include` w `zsh`, dowód poza repo |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
