## Po co ten dyżur istnieje

Bramka `G15` („Integrator self-QA and impacted regression”) ma szesnaście wierszy — po jednym
na moduł. Dwa świecą `PASS`. Pozostałe czternaście niosą podtypy, a **dziesięć z nich mówi
o „zastanej czerwieni”**. Nikt dotąd nie odpowiedział na pytanie, które za tymi podtypami stoi:
**czy to są defekty produktu, czy artefakty przyrządu pomiarowego.**

Dziś to pytanie przestało być teoretyczne, bo dwa dyżury pokazały obie odpowiedzi naraz.

**Dyżur 347** wziął 542 czerwienie serwerowe zmierzone przez dyżur 336 i pokazał, że
**401 z nich zniknęło po JEDNEJ zmianie**. Różnicę odtworzył jedną zmienną środowiskową:
ten sam plik, `enforce` → `118 total / 0 pass / 118 fail`; bez tej zmiennej →
`118 total / 118 pass / 0 fail`. Nie było 401 defektów. Był jeden rozjazd między trybem
pomiaru a przeznaczeniem pakietu.

**Dyżur 355** próbował powtórzyć to dla Finansów i orzekł: **114 czerwieni = 114 artefakt,
0 realny defekt**. Argument: dwanaście czerwonych plików sieje **zero** wierszy
`organization_members`, a dziesięć zielonych sieje **co najmniej jeden**.

**★★ I tu odbiorca 355 obalił jego główny wniosek — nie dlatego, że teza była zła, tylko
dlatego, że dowód celował w niewłaściwy plik.** Zamówiona mutacja trafiła
w `validateOrgMembership` (`server/src/middleware/auth.middleware.ts:1901-1911`) — middleware,
którego badane testy **nie montują**. Mutacja została zielona, a dyżur zapisał to jako
„wymaganie pomiarowo fałszywe”. Prawdziwym strażnikiem jest
`server/src/services/legacyCutover/requireActiveMembership.ts`. Po mutacji **właściwego**
warunku pakiety broniące bramki zachowały się dokładnie tak, jak powinny:

> **GREEN 44/44 → RED 33/11 → GREEN 44/44.**
>
> **Pakiet broni bramki.**

**Sens tego dyżuru w jednym zdaniu:** rozstrzygnąć dziesięć wierszy tą samą metodą, ale
**z dowodem, który trafia**, i podać liczbę — ile z tego jest realne.

## ★ Stan zastany, zmierzony przeze mnie na markerze `2a7273e087cbd3e44344725b524f6ddd79d5badc`

**Szesnaście wierszy `G15`, po stanie:**

| Stan wiersza | Ile | Moduły |
| --- | ---: | --- |
| `PASS` | 2 | `01_ORGANIZATION`, `13_CHAT` |
| `PARTIAL_PASS / RED_LEGACY_*` | 6 | `02`, `03`, `07`, `10`, `11`, `14` |
| `PARTIAL_PASS / SERVER_NOT_MEASURED` | 4 | `04`, `09`, `12`, `15` |
| `NOT_MEASURED / RED_LEGACY_*_CONFIRMED` | 4 | `05`, `06`, `08`, `16` |
| **razem** | **16** | |

**★★ PIERWSZA ROZBIEŻNOŚĆ — i musisz ją rozstrzygnąć, zanim cokolwiek policzysz.**
Zlecenie, z którego powstała ta instrukcja, mówiło o „dziesięciu wierszach `PARTIAL_PASS`
z podtypami `RED_LEGACY_*`”. **Takiego zbioru nie ma.** Są dwa różne zbiory o liczebności
dziesięć, a ich część wspólna to sześć modułów:

- **zbiór A** — stan `PARTIAL_PASS`: `02`, `03`, `04`, `07`, `09`, `10`, `11`, `12`, `14`, `15`
  (cztery z nich mają podtyp `SERVER_NOT_MEASURED`, nie `RED_LEGACY`);
- **zbiór B** — podtyp `RED_LEGACY_*`: `02`, `03`, `05`, `06`, `07`, `08`, `10`, `11`, `14`, `16`
  (cztery z nich mają stan `NOT_MEASURED`, nie `PARTIAL_PASS`).

**Przedmiotem tego dyżuru jest zbiór B** — bo pytanie brzmi „ile z zastanej czerwieni jest
realne”, a to podtyp mówi o czerwieni. **Ale masz to potwierdzić własnym pomiarem
i zapisać wprost, który zbiór wziąłeś.**

**★★ DRUGA ROZBIEŻNOŚĆ — numeral w podtypie nie jest jednostką.** To nie jest drobiazg
redakcyjny; to jest różnica czterdziestu przypadków.

| Moduł | Podtyp | Co mówi numeral | Czerwieni z TREŚCI wiersza |
| --- | --- | --- | ---: |
| `02_INTERVIEW` | `RED_LEGACY_7` | siedem czerwieni | 7 (124 PASS / 7 FAIL / 16 pending) |
| `03_TOOLS` | `RED_LEGACY_1` | jedna czerwień | 1 (620/621) |
| `05_INITIATIVES` | `RED_LEGACY_1_CONFIRMED` | **jedna potwierdzona rodzina** | 19 (840 PASS / 19 FAIL / 8 pending) |
| `06_EXECUTION` | `RED_LEGACY_1_CONFIRMED` | **jedna potwierdzona rodzina** | 14 (426/440) |
| `07_MY_WORK_AGENT` | `RED_LEGACY_2_PLUS_RED_NEW_1` | dwie zastane + jedna nowa | 3 (554 PASS / 3 FAIL / 9 pending) |
| `08_MEETINGS` | `RED_LEGACY_1_CONFIRMED` | **jedna potwierdzona rodzina** | 3 (32/35) |
| `10_FINANCE` | `RED_LEGACY_1` | jedna czerwień | 1 (923/924) |
| `11_MATERIALS` | `RED_LEGACY_2` | dwie czerwienie | 2 (182/184) |
| `14_ADMIN` | `RED_LEGACY_7` | siedem czerwieni | 7 (241/248) |
| `16_PARTNER` | `RED_LEGACY_2_CONFIRMED` | **dwa potwierdzone PLIKI** | 9 (186/195) |
| **suma numeralów** | | **26** | **66** |

**Czterdzieści przypadków różnicy.** Trzy różne jednostki pod jedną etykietą: czerwienie,
rodziny, pliki. To jest dokładnie ten kształt, w którym „licznik mierzy rozjazd dwóch
rejestrów”, a nie stan produktu. **Zmierz obie kolumny sam i zapisz, którą liczbę uznajesz
za mianownik tego dyżuru.**

**★ Materiał dowodowy trzech poprzednich dyżurów leży W REPO** — nie musisz go odtwarzać:

| Katalog | Co zawiera | Moja liczba plików |
| --- | --- | ---: |
| `evidence/g15/day336-artefakty/` | surowe JSON-y pomiaru 15 modułów, z pełnymi nazwami | 63 |
| `evidence/g15/day347/` | przed/po-nazwy, dowód różnicowy `enforce`, mutacje, klasyfikacja | 39 |
| `evidence/g15/day351-artefakty/` | przebiegi front/serwer i pięć mutacji licznika kompletności | 14 |
| `evidence/g15/day355/` + `day355-artefakty/` | 114 nazw Finansów, przebiegi bramek, mutacja, która chybiła | 3 + 17 |

## ★ Zmierz moje liczby sam

Twierdzę, na markerze:

- wierszy `G15`: **16**; `PASS` **2**; `PARTIAL_PASS` **10**; `NOT_MEASURED` **4**;
- zbiór A i zbiór B mają po **10** elementów i **6** wspólnych;
- suma numeralów podtypów: **26**; suma czerwieni z treści wierszy: **66**;
- warunek strażniczy w `requireActiveMembership.ts` stoi w linii **34**, odpowiedź `403`
  w linii **35** (zlecenie podawało 35 dla warunku — to jest rozbieżność, którą już zapisałem;
  **potwierdź ją albo obal**);
- przebieg bazowy 355: **68 przypadków w 3 pakietach**; przebieg zmutowany: **62 w 2 pakietach**
  — `financeIntelligence.membershipGate.pg.test.ts` (6 przypadków) **wypadł między A i B**;
- oba przebiegi 355 były w **100% zielone** — mutacja nie zaczerwieniła niczego, bo chybiła;
- liście słowników: **pl 35199**, **en 33066**; cztery bezpieczniki kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest
**ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / schematy** | `server/src/schemas/**`, `src/schemas/**` | **TYLKO ODCZYT** | Cytat wiersza + brief |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/routes/v8/index.ts`, `server/src/Gateway.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** Każde „działa” znaczy: realne żądanie HTTP z **zapisanym kodem odpowiedzi** | Opis w raporcie |
| **Strażnik członkostwa (cel mutacji)** | `server/src/services/legacyCutover/requireActiveMembership.ts` | **★ WĄSKA LICENCJA NA MUTACJĘ TYMCZASOWĄ:** wolno zmutować warunek w `R3`, **wyłącznie** żeby pokazać czerwień, i **obowiązkowo cofnąć przez `cp` ze `SCRATCH`** (nigdy `git stash`, `Z27`); `git diff` po cofnięciu **pusty**. **Zakaz zostawienia jakiejkolwiek zmiany w commicie** | — |
| **Pozostałe middleware / model uprawnień** | `server/src/middleware/**` (w tym `auth.middleware.ts`) | **NIETYKALNE DO ZAPISU** (`Z12`). Wolno CZYTAĆ — i musisz, żeby pokazać różnicę wobec właściwego strażnika | Brief |
| **Kontroler / trasy** | `server/src/routes/**` | **TYLKO ODCZYT** | Wpis: plik, linia, czerwień, rekomendacja jako diff **nienałożony** |
| **Serwis / repozytorium / domena** | `server/src/services/**`, `server/src/domain/**`, `server/src/repositories/**` | **TYLKO ODCZYT** (wyjątek: strażnik wyżej, mutacja tymczasowa) | jak wyżej |
| **Produkt UI** | `src/**`, `public/locales/**` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** Ten dyżur orzeka, nie naprawia | Opis w raporcie |
| **Testy modułów (10 wierszy)** | pakiety wskazane w `REJESTR_G15_SAMOKONTROLA_20260903.md` sekcja `R1` | **TYLKO URUCHAMIANIE.** Zakaz zmiany progu, asercji, zakresu i `.skip` (`Z35`) | — |
| **Pakiety broniące bramki** | `server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts`, `.../financeIntelligence.membershipGate.pg.test.ts`, `server/src/middleware/__tests__/auditsStrictMembership.middleware.test.ts` | **NIETYKALNE DO ZAPISU.** Wolno **uruchamiać** i **musisz** uruchomić PRZED i PO mutacji, **razem, w jednym wywołaniu**, z kontrolą mianownika 68/3 | Wynik do raportu |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Nowe testy** | `tests/**` (nowe pliki, `git add -f`) | **★ PEŁNA LICENCJA na dodanie** testu, który dowodzi orzeczenia, jeżeli istniejące pokrycie nie wystarcza. **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** | — |
| **Dowody** | `evidence/g15/day363/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie** | — |
| **Artefakty 336/347/351/355** | `evidence/g15/day336-*`, `day347/**`, `day351-artefakty/**`, `day355*/**` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To jest baza porównania; nadpisanie unieważnia dyżur | — |
| **Rejestr G15** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` | **TYLKO ODCZYT w tym dyżurze** — rejestrem zajmują się równolegle dyżury 359-362 | Rekomendacja do raportu |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł.** Także wtedy, gdy udowodnisz, że wiersz jest nieaktualny | Rekomendacja w raporcie, ze wskazaniem wiersza i proponowanego stanu |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze** (sekcje doszły do `Z`, następne to `AA`, `AB`, …), sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY363_G15_ILE_REALNE_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `src/store/useToolStore.ts`, `src/components/DiscoveryTools/**`, `scripts/dev/check-etykiety-dwujezyczne*` (dyżur 364) · `src/components/standard/StandardPreview.tsx`, `scripts/dev/grafika-zrzuty.mjs`, `evidence/podglad-relations-20260904/**` (dyżur 365) · `tests/unit/assessment/day351.assessmentCompleteness.test.ts`, `server/src/routes/assessment/assessment-hub.routes.ts`, `evidence/g15/day355/**` jako miejsce ZAPISU (dyżur 366) · wiersze macierzy i rejestry bramek `G15`/`G19`/`G20` (dyżury 359-362) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35199, en 33066

# (b) cztery bezpieczniki maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: wszystkie 0
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | wierszy `G15` razem | `16` | komenda (1) z `§0.3` | TAK — jeden wiersz per moduł |
| 2 | zbiór A (`PARTIAL_PASS`) | `10` | komenda (2) | TAK |
| 3 | zbiór B (podtyp `RED_LEGACY_*`) | `10` | komenda (2) | TAK — **i to jest przedmiot dyżuru** |
| 4 | część wspólna A ∩ B | `6` | komenda (2) | TAK |
| 5 | suma numeralów podtypów | `26` | komenda (3) | TAK — liczy ETYKIETY |
| 6 | suma czerwieni z treści wierszy | `66` | komenda (3) | TAK — liczy TREŚĆ; **różnica 40 jest wynikiem** |
| 7 | artefakty poprzednich dyżurów w repo | `63 / 39 / 14 / 3+17` | komenda (4) | TAK |
| 8 | linia warunku strażnika | `34` (403 w `35`) | komenda (5) | TAK — **obala liczbę ze zlecenia** |
| 9 | mianownik pakietów broniących bramki | `68` w `3` pakietach | komenda (6) | TAK — **i musi być ten sam po mutacji** |
| 10 | czerwienie per wiersz po NAZWACH | — | własny przebieg `R1` | TAK — `Z37`: liczba bez nazw nie jest wynikiem |
| 11 | ZASTANA / REGRESJA dla tego, co zostaje | — | ta sama `fullName` na bazie i na markerze | TAK — **tylko jeżeli baza się skompilowała** |
| 12 | liście słowników PL/EN | `35199` / `33066` | blok (a) „WARUNKÓW WSPÓLNYCH” | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY363_G15_ILE_REALNE_REPORT.md` ·
`evidence/g15/day363/**` (nowy katalog).

**Zapisujesz WARUNKOWO:**
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja, litera sprawdzona komendą) ·
nowe pliki testowe w `tests/` (`git add -f`), jeżeli okażą się potrzebne do dowodu.

**JAWNIE NIE ZAPISZESZ:** `src/**`, `public/locales/**`, `server/src/**` (mutacja `R3` jest
tymczasowa i cofnięta), `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`,
`vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/migrations/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (**wszystkie 16**),
`REJESTR_G15_SAMOKONTROLA_20260903.md`, `evidence/g15/day336-*`, `evidence/g15/day347/**`,
`evidence/g15/day351-artefakty/**`, `evidence/g15/day355*/**`,
`evidence/podglad-relations-20260904/**`, `scripts/dev/grafika-zrzuty.mjs`,
`scripts/dev/check-etykiety-dwujezyczne*`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day363-g15-ile-realne
git diff --name-only --cached | tee /private/tmp/cx-day363-g15-ile-realne-artefakty/staged.txt
bash -c "grep -iE '^src/|^public/locales/|^server/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE|REJESTR_G15|day336-|g15/day347|g15/day351|g15/day355|podglad-relations|grafika-zrzuty|check-etykiety' /private/tmp/cx-day363-g15-ile-realne-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Orzekasz, nie naprawiasz.** Ten dyżur ma jeden produkt: tabelę dziesięciu wierszy
z werdyktem i liczbą. Jeżeli zobaczysz naprawę na jedną linijkę — opisujesz ją jako diff
**NIENAŁOŻONY** i idziesz dalej. Naprawa bez rozstrzygnięcia jest pracą, o której nie wiemy,
czy jest potrzebna.

**(2) Mutacja celuje w ZABEZPIECZENIE, nie w mechanizm** (`Z32`). Jeżeli mutacja nie
czerwieni, **NAJPIERW** sprawdzasz, czy trafiła w to, co miała trafić — dodaj do zmutowanej
gałęzi jednorazowy `logger`/`throw` albo sprawdź `grep` montażu w pakiecie i zapisz wynik.
Dopiero potem wolno Ci napisać, że wymaganie jest pomiarowo fałszywe. Dziś dokładnie ten krok
został pominięty i kosztował obalony wniosek całego dyżuru.

**(3) Mianownik po obu stronach musi być IDENTYCZNY.** Przed mutacją i po mutacji porównujesz
**listy pełnych nazw pakietów i przypadków**, nie `numFailedTests`. Przebieg, w którym pakiet
w ogóle nie wystartował, kończy się zielenią i **nie jest pomiarem**. Zmierzona wartość
wzorcowa: **68 przypadków w 3 pakietach**.

**(4) Wiersz macierzy odbioru jest NIETYKALNY.** Żaden z 16 modułów, żadna bramka. Twoim
produktem jest rekomendacja: „wiersz `G15` modułu X powinien przejść na stan Y, bo Z” —
wpis zrobi kto inny.

**Wymagany dowód:** cztery zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — KTÓRY ZBIÓR, JAKA JEDNOSTKA, JAKIE NAZWY (rdzeń)

Pracujesz najpierw na dokumentach i artefaktach, które **już są w repo**.

1. **Rozstrzygnij zbiór.** Wypisz szesnaście wierszy `G15` ze stanem i podtypem do
   `evidence/g15/day363/r1-szesnascie-wierszy.tsv`. Podaj liczebność zbioru A, zbioru B
   i części wspólnej. **Napisz jednym zdaniem, który zbiór bierzesz jako przedmiot dyżuru
   i dlaczego.** Jeżeli Twój pomiar da inny podział niż mój — obowiązuje Twój.
2. **Rozstrzygnij jednostkę.** Dla każdego z dziesięciu wierszy podaj **dwie liczby**:
   numeral z etykiety podtypu i liczbę czerwieni z treści wiersza. **Podaj sumy obu kolumn
   i różnicę.** Powiedz wprost, ile różnych jednostek kryje się pod jedną etykietą.
3. **Odtwórz czerwienie po NAZWACH.** Dla każdego z dziesięciu modułów uruchom pakiety
   wskazane w sekcji `R1` rejestru `REJESTR_G15_SAMOKONTROLA_20260903.md`,
   `RUN_DB_TESTS=0 MOCK_DB=true --retry=0 --reporter=json`, i zapisz **pełne nazwy**
   (`fullName`) czerwonych przypadków do `evidence/g15/day363/r1-nazwy-<moduł>.txt`.
   **Podaj `numTotalTests`, nie tylko `numFailedTests`.** Przebieg z zerem wykonanych
   przypadków kończy się `exit 0` i nie jest pomiarem; `No test files found`
   i `Transform failed` to **BŁĄD KOMENDY**.
4. **Jeżeli dla modułu nie ma ścieżki w rejestrze — zapisujesz `NIEORZECZONY` i nie zgadujesz.**
   Tak zrobił dyżur 336 dla `15_SETTINGS` i to było poprawne.
5. **Porównaj z markerem sprzed odbioru.** Dla każdego wiersza sprawdź, czy liczba czerwieni,
   którą dziś mierzysz, zgadza się z liczbą zapisaną w treści wiersza. **Każda rozbieżność
   jest wynikiem** — wiersze były pisane 03.09, a od tego czasu weszły m.in. dyżury 347 i 354.

**Wymagany dowód:** `r1-szesnascie-wierszy.tsv` · tabela dwóch kolumn liczb z sumami i różnicą ·
pliki nazw per moduł · `numTotalTests` każdego przebiegu · lista rozbieżności wobec treści
wierszy. **Commit po `R1`.**

## R2 — ORZECZENIE PER WIERSZ: ARTEFAKT, DEFEKT CZY NIEORZECZONY (rdzeń)

Dla **każdego** z dziesięciu wierszy odpowiadasz na trzy pytania w tej kolejności:

1. **Co konkretnie czerwieni się pod tym wierszem?** Pełna nazwa i treść komunikatu — nie
   „siedem czerwieni Wywiadu”, tylko siedem nazw i siedem komunikatów.
2. **Jaki mechanizm to powoduje?** Nazwij `plik:linia`. Kandydaci, uporządkowani po tym,
   jak często okazywali się przyczyną w tym programie:
   - bramka członkostwa (`requireActiveMembership.ts`, `requireFinanceEditorMembership`)
     — kształt zmierzony w 347 i 355;
   - koperta widoczności (`resultsInternalBetaVisibility.middleware.ts`) — kształt 347;
   - **niekompilowalna baza porównania** (marker konfliktu, jak
     `PreviewAIHintStrip.tsx:110` w dyżurze 286) — kształt, który wyprodukował
     „13 plików NOWA” z niczego;
   - atrapa bazy pod `DbPromise` przy `NODE_ENV=test` bez `RUN_DB_TESTS=1`;
   - **realny defekt produktu** — i to też jest dopuszczalna odpowiedź.
3. **Artefakt czy defekt?** Werdykt z jednej z czterech wartości:
   `ARTEFAKT_DOWIEDZIONY` · `ARTEFAKT_Z_ANALOGII` · `REALNY_DEFEKT` · `NIEORZECZONY`.

**★★ `ARTEFAKT_Z_ANALOGII` jest dozwolony, ale musi być oznaczony i uzasadniony.** Podajesz:
(a) wiersz wzorcowy, na którym analogia stoi; (b) czym udowodniłeś, że mechanizm jest ten
sam — **wspólny `plik:linia` strażnika, nie podobny komunikat**; (c) czego nie zmierzyłeś.
Wiersz opisany jako `ARTEFAKT_Z_ANALOGII` bez tych trzech elementów jest **odrzucony**.

**★ Nie musisz mieć dziesięciu mutacji.** Musisz mieć **mutację dla każdego RÓŻNEGO
mechanizmu**, który wskazałeś. Jeżeli osiem wierszy prowadzi do jednego strażnika, wystarczy
jedna mutacja plus osiem uzasadnień, że to ten sam `plik:linia` — i tak masz to napisać wprost.

**Wymagany dowód:** tabela dziesięciu wierszy z kolumnami: moduł · czerwieni (nazwy w pliku) ·
mechanizm (`plik:linia`) · werdykt · na czym stoi. **Commit po `R2`.**

## R3 — DOWÓD MUTACYJNY, KTÓRY TRAFIA (rdzeń)

**To jest pozycja, w której dyżur 355 poległ. Przeczytaj ją dwa razy.**

1. **Postaw kontener** `cx-day363-pg` na porcie `6434`, baza `cx363`, i przepuść migracje
   zgodnie z `§0.2c` (A) — **dwa przebiegi**, drugi bezbłędny i bez zmian (idempotencja).
   `pgvector/pgvector:pg16`; `postgres:15` **nie przechodzi migracji**.
2. **Przebieg BAZOWY.** Uruchom **razem, w jednym wywołaniu**, na realnym PostgreSQL:
   `server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts`,
   `server/src/routes/v8/__tests__/financeIntelligence.membershipGate.pg.test.ts`,
   `server/src/middleware/__tests__/auditsStrictMembership.middleware.test.ts`.
   **Zapisz `numTotalTests`, listę pakietów i listę pełnych nazw.** Moja liczba wzorcowa:
   **68 przypadków w 3 pakietach**. Jeżeli Twój przebieg da mniej pakietów — **to jest
   defekt pomiaru i zatrzymujesz się tutaj**, zanim cokolwiek zmutujesz.
3. **Mutacja celująca w strażnika.** W `server/src/services/legacyCutover/requireActiveMembership.ts`
   zamień warunek statusu (linia **34**, potwierdź numer sam) tak, żeby zabezpieczenie
   przestało odrzucać — na przykład `!== 'ACTIVE'` na `=== ' NIGDY'`, albo usuń warunek
   statusu z zapytania. **Cel: żeby obcy PRZESTAŁ dostawać `403`.**
4. **Przebieg ZMUTOWANY — tym samym wywołaniem, bez zmiany zakresu.** Porównaj **listę
   pakietów i listę nazw**, nie tylko liczbę czerwieni. Oczekiwany kształt wyniku:
   **RED, z tym samym mianownikiem 68 w 3 pakietach.** Wynik zmierzony przez odbiorcę na
   samym `financeValue.membershipGate`: **GREEN 44/44 → RED 33/11 → GREEN 44/44.**
5. **Cofnięcie przez `cp`** ze `SCRATCH` (nigdy `git stash`, `Z27`); `git diff` po cofnięciu
   **pusty**; przebieg końcowy **zielony, z tym samym mianownikiem**.
6. **Jeżeli mutacja NIE zaczerwieniła** — **nie piszesz, że wymaganie jest fałszywe.**
   Piszesz, co sprawdziłeś, żeby ustalić, czy mutacja w ogóle została wykonana przez badany
   kod: montaż w pakiecie, ślad w logu, druga mutacja w innym miejscu tego samego pliku.
   Dopiero po tym wolno Ci orzekać.
7. **Drugi strażnik tej rodziny.** `requireFinanceEditorMembership` mieszka w tym samym pliku
   i ma własny warunek roli. **Powiedz, czy Twoja mutacja go obejmowała, czy nie** — praca
   per wywołanie zamiast per rodzina daje „poprawne w 2 z 3”.

**Wymagany dowód:** dwa JSON-y (bazowy i zmutowany) z `numTotalTests` i listą pakietów ·
`diff` list pełnych nazw · dosłowna komenda mutacji i komenda cofnięcia · `git diff` pusty ·
JSON końcowy zielony · zdanie o drugim strażniku. **Commit po `R3`.**

## R4 — TABELA DZIESIĘCIU WIERSZY I JAWNA REKOMENDACJA

**To jest produkt, po który program przyszedł.**

1. **Tabela główna**, dziesięć wierszy, kolumny:
   moduł · liczba czerwieni (moja, zmierzona) · mechanizm (`plik:linia`) · werdykt
   (`ARTEFAKT_DOWIEDZIONY` / `ARTEFAKT_Z_ANALOGII` / `REALNY_DEFEKT` / `NIEORZECZONY`) ·
   na czym stoi werdykt · plik z nazwami.
2. **Trzy jawne liczby, każda z listą nazw:**
   ile czerwieni jest artefaktem, ile realnym defektem, ile nieorzeczonych.
   „Z 66 czerwieni N to artefakt, M to realny defekt, K nieorzeczonych” **bez listy nazw
   nie jest wynikiem** (`Z37`).
3. **Rekomendacja per wiersz** — jedna z trzech, i tylko z tych trzech:
   - `NAPRAWIAMY` — z oszacowaniem, ile rodzin naprawczych obejmuje i który dyżur miałby to wziąć;
   - `DŁUG` — z propozycją numeru decyzji. **Numer sprawdzasz komendą tuż przed commitem**
     (`bash -c "grep -rhoE 'DEC-[0-9]{3}' docs/ | sort -u | tail -3"`), nie zakładasz z góry;
     przy wydaniu instrukcji numery szły do `DEC-392`.
   - `DOMIERZYĆ` — z jednym zdaniem, czego brakuje do orzeczenia.
4. **Rekomendacja dla wiersza macierzy** — dla każdego z dziesięciu podaj, na jaki stan
   wiersz `G15` powinien przejść i pod jakim warunkiem. **Nie zmieniasz go.**
5. **ZASTANA kontra REGRESJA dla tego, co uznasz za realny defekt.** Worktree bazowy
   w `/private/tmp/cx-day363-g15-ile-realne-artefakty/baza` (POZA repo, `Z13`). **Zanim
   cokolwiek uruchomisz — udowodnij, że baza się kompiluje**: `npx esbuild` na plikach, które
   będziesz mierzył. **`Transform failed` jest błędem komendy, nie wynikiem.** Baza, na której
   plik wykonał zero przypadków, **nie jest bazą** — to jest dokładnie ten błąd, który
   wyprodukował fałszywe „13 plików NOWA” w dyżurze 286. Skasuj worktree po pomiarze;
   `df -h /` przed i po.

**Wymagany dowód:** tabela dziesięciu wierszy · trzy liczby z listami nazw ·
rekomendacja per wiersz z numerem decyzji sprawdzonym komendą · dowód kompilowalności bazy ·
`df -h /` przed i po · potwierdzenie skasowania worktree. **Commit po `R4`.**

## R5 — RAPORT, ROZBIEŻNOŚCI I PYTANIA DO WŁAŚCICIELA

Raport zawiera: rozstrzygnięcie zbioru z `R1` (**wprost: A czy B i dlaczego**) · tabelę dwóch
jednostek z różnicą · tabelę dziesięciu wierszy z `R4` · **trzy jawne liczby z listami nazw** ·
dowód mutacyjny z `R3` w obie strony, z mianownikiem po obu stronach ·
listę rozbieżności wobec liczb tej instrukcji · **niepustą sekcję „TWIERDZENIA
NIEZWERYFIKOWANE”** · obowiązkowy akapit `§0.2e` dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „CO NAPRAWIAMY, A CO PRZYJMUJEMY JAKO DŁUG”.** Dwie listy,
każda z nazwami, każda z uzasadnieniem jednozdaniowym. To jest zdanie, którego program
potrzebuje najbardziej: **ile pracy tam naprawdę jest, a ile było złudzeniem licznika.**

★★ **Osobna, obowiązkowa sekcja: „GDZIE UŻYŁEM ANALOGII”.** Wypisz każdy wiersz orzeczony
jako `ARTEFAKT_Z_ANALOGII`, z wierszem wzorcowym i z tym, czego nie zmierzyłeś. Sekcja może
być pusta, ale wtedy piszesz wprost: „każde orzeczenie stoi na własnym pomiarze”.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** Jeżeli uznasz, że etykieta
podtypu `RED_LEGACY_N` jest niereformowalna, bo `N` znaczy trzy różne rzeczy — piszesz to
tutaj jako pytanie rozstrzygalne („tak”/„nie”), i **nie zmieniasz jej po cichu w żadnym
wierszu ani rejestrze.** Sekcja może być pusta, ale wtedy piszesz wprost: „nie mam zastrzeżeń”.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sekcje doszły dziś do `Z`, więc następne idą
`AA`, `AB`, …; sprawdź komendą
`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy.

**Commit po `R5`.**

## Próg odbioru

**Tabela dziesięciu wierszy z podziałem artefakt/defekt, każdy wiersz rozstrzygnięty dowodem,
i jawna rekomendacja: co naprawiamy, a co przyjmujemy jako dług z numerem decyzji** — przy
dowodzie mutacyjnym, który **trafia we właściwego strażnika**, i przy mianowniku identycznym
po obu stronach mutacji.

Odbiorca odrzuci dyżur, w którym: orzeczenie „artefakt” stoi na analogii, która nie jest jako
analogia oznaczona; mutacja nie zaczerwieniła i nie sprawdzono, czy trafiła; przebiegi bazowy
i zmutowany mają różną liczbę pakietów; porównanie jest po liczbach zamiast po nazwach;
albo zmienił się stan choćby jednego wiersza macierzy odbioru.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „dziesięć wierszy rozłożonych
na k mechanizmów, dwa rozstrzygnięte dowodem mutacyjnym, osiem nieorzeczonych, bo wymagają
pomiaru na realnej bazie, którego nie zdążyłem wykonać” — **jest pełnowartościowym wynikiem**,
o ile każda z tych liczb ma listę nazw.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Rozstrzygnij dziesięć wierszy” vs „są dwa różne zbiory po dziesięć” | `R1` punkt 1: wybierasz zbiór B i piszesz to wprost; liczebności obu zbiorów i części wspólnej są wymaganym dowodem |
| „Podaj liczbę czerwieni” vs „numeral podtypu jest jednostką” | `R1` punkt 2: podajesz DWIE liczby i ich różnicę; to rozjazd rejestrów, nie stan produktu |
| „Dowód musi być mutacyjny” vs „nie masz czasu na dziesięć mutacji” | `R2`: mutacja per MECHANIZM, nie per wiersz; wiersze na tym samym `plik:linia` dzielą jeden dowód, i tak masz to napisać |
| „Analogia jest zabroniona” vs „`ARTEFAKT_Z_ANALOGII` jest dozwolony” | `R2`: analogia jest dozwolona **oznaczona**; zabroniona jest analogia UDAJĄCA pomiar |
| „Strażnik jest nietykalny” vs „zmutuj strażnika” | Tabela licencji: wąska licencja na mutację TYMCZASOWĄ z obowiązkowym cofnięciem przez `cp` i pustym `git diff` |
| „Naprawiaj” vs „nie naprawiaj” | `R0` (1) i tabela licencji: ten dyżur **nie naprawia**; naprawa jest produktem rekomendacji, nie tego dyżuru |
| „Aktualizuj macierz” vs „macierz nietykalna” | Sekcja o dokumentach i tabela licencji: wierszami zajmują się dyżury 359-362; Twoim produktem jest rekomendacja stanu |
| „Zmierz spadek” vs `Z37` | `R1` punkt 3 i `R4` punkt 2: pliki `fullName` per moduł; produktem jest lista nazw, nie różnica liczb |
| „Uruchom pakiety broniące bramki” vs „są nietykalne” | Tabela licencji: nietykalne **do zapisu**; uruchamianie jest jawnie zamówione i obowiązkowe przed i po |
| „Worktree bazowy ułatwia dowód” vs `Z13` i próg 5 GB | `R4` punkt 5: worktree bazowy leży **poza repo**, jest kasowany po pomiarze, `df -h /` przed i po |
| „Zapisz `NIEORZECZONY`” vs „miałeś rozstrzygnąć wszystkie dziesięć” | `R1` punkt 4 i `R2` punkt 3: `NIEORZECZONY` z podaniem, czego brakuje, jest pełnowartościowym werdyktem; zgadywanie nie jest |
| „Dopisz sekcję do rejestru znalezisk” vs „równolegle piszą inni autorzy” | `R5`: literę sprawdzasz komendą tuż przed commitem; sekcje doszły do `Z`, następne to `AA`, `AB` |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 12 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — 16 plików `MODULE_ACCEPTANCE.md`, `requireActiveMembership.ts`, `auth.middleware.ts`, trzy pakiety bramkowe, cztery katalogi dowodowe sprawdzone; `evidence/g15/day363/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1-9 i 12 zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — walidator · montaż · strażnik · pozostałe middleware · kontroler · serwis/repozytorium · UI · testy modułów · pakiety bramkowe · infrastruktura testów · nowe testy · dowody · artefakty poprzedników · rejestr G15 · macierz · rejestr znalezisk · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` czyta dokumenty i uruchamia front, `R2` orzeka, `R3` mierzy na własnej bazie, `R4`-`R5` składają wynik |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6434/5574 wolne (`lsof` przy wydaniu), brak kontenera `cx-day363-pg`, brak gałęzi `codex/day363-*` i worktree; 364/365/366 mają rozłączne porty i pliki; paczka 359-362 ma zarezerwowany przedział 6430-6433/5570-5573 i rozłączny temat (bramki) |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: dwa zbiory po dziesięć, numeral bez jednostki, mutacja w niewłaściwym pliku, zmiana mianownika w zielonym wyniku, niekompilowalna baza, atrapa bazy, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |
