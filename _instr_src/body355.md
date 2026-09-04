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

Dyżur 336 zmierzył warstwę serwerową 15 modułów i **uratował surowe wyniki do repo** —
63 pliki JSON w `evidence/g15/day336-artefakty/`. Dyżur 347 wziął z tego największy kubełek
i rozstrzygnął go uczciwie: **401 z 542 czerwieni to był artefakt przyrządu, nie defekt
produktu.** Wariant pomiarowy wymuszał `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`
na izolowanych pakietach kontraktu tras, które z definicji podmieniają middleware i nie mają
bazy członkostwa, o którą koperta pyta. **Gałąź 347 nie zmieniła ani jednego pliku kodu
produktu** i to był poprawny wynik.

**Ale teza autora instrukcji 347 brzmiała „415 z 415 czerwieni o kształcie `403` to JEDNA
przyczyna". Dla Finansów ta teza jest OBALONA — i obalił ją własny pomiar dyżuru 347:**

| Artefakt | `numTotalTests` | `numPassedTests` | `numFailedTests` |
| --- | --- | --- | --- |
| `evidence/g15/day336-artefakty/10-finance-serwer.json` (PRZED) | 277 | 143 | **114** |
| `evidence/g15/day347/r4-10-finance-serwer.json` (PO naprawie 347) | 277 | 143 | **114** |

**Ani jedna czerwień Finansów nie zgasła.** Raport 347 zapisał to wprost (wiersz 80:
„`10_FINANCE`: 277 total, 143 PASS, 114 FAIL, 20 pending — brak spadku") i poszedł dalej.
Ten dyżur jest tym „dalej".

### ★★ Rozbicie 114 czerwieni — mój pomiar, do sprawdzenia

Liczby są z `evidence/g15/day336-artefakty/10-finance-serwer.json`, komenda (3) z `§0.3`:

| Kubełek (po treści `failureMessages`) | Ile |
| --- | --- |
| `expected 403 to be X` — **bez** kodu w komunikacie (`201`×15, `400`×6, `404`×16, `200`×20, `409`×1, `204`×1) | **59** |
| `createArtifactViaHttp failed: 403 {"code":"ORG_MEMBERSHIP_REVOKED"}` | **20** |
| `TypeError: Cannot read properties of undefined` | **31** |
| reszta (4 przypadki, inne brzmienie) | **4** |
| **razem** | **114** |

**★★ SPROSTOWANIE, KTÓRE MUSISZ ZNAĆ, ZANIM ZACZNIESZ.** Zlecenie nadzorcy dla tego dyżuru
mówiło: **„59 z kodem `403` wskazuje `ORG_MEMBERSHIP_REVOKED`"**. **To jest fałsz i sam go
zmierzyłem przy pisaniu tej instrukcji.** To są DWA ROZŁĄCZNE kubełki: 59 przypadków ma
kształt `expected 403 to be X` i **nie zawiera żadnego kodu w komunikacie**, a
`ORG_MEMBERSHIP_REVOKED` pada w **20 innych** przypadkach, wszystkich w jednym pliku
(`approveRbacGate.pg.test.ts`) i wszystkich przez `createArtifactViaHttp`. Łącznie słowo `403`
występuje w **79** ze 114 komunikatów. **Sprawdź to komendą (3) i zapisz swój wynik** — jeżeli
Twój pomiar da coś innego niż mój, obowiązuje Twój.

### ★★ Plik-świadek, który jest cenniejszy od pozostałych

`compare.routes.pg.test.ts` pada **7 z 17** — dziesięć przypadków przechodzi.
`comments.routes.pg.test.ts` pada **18 z 24**. **Znajdź te przechodzące przypadki i powiedz,
czym się różnią od padających.** To jest najkrótsza droga do przyczyny — dokładnie tak, jak
`roiFinanceSeam.routes.test.ts` 25/26 był najkrótszą drogą w dyżurze 347.

## ★★ MOJA HIPOTEZA — masz ją OBALIĆ ALBO POTWIERDZIĆ, nie przyjąć

**To jest hipoteza autora instrukcji, nie zweryfikowany fakt.** Podaję ją, żebyś nie szukał
po omacku, i podaję też, jak ją obalić.

Bramka `server/src/middleware/auth.middleware.ts` w okolicy wierszy **1898-1926** wykonuje:

```
SELECT status FROM organization_members WHERE user_id = ? AND organization_id = ?
```

i gdy nie ma wiersza o statusie znormalizowanym do `ACTIVE`, odpowiada
`403 { code: 'ORG_MEMBERSHIP_REVOKED' }`. Wcześniejsze wyjścia „przepuść" to super-admin
(ok. 1884) i zaufana publiczna sesja demo (ok. 1894). `catch` (ok. 1922) daje
`503 ORG_MEMBERSHIP_LOOKUP_UNAVAILABLE`.

**Pomiar, który robi z tego hipotezę, a nie zgadywanie — separacja jest IDEALNA:**

| Grupa plików `10_FINANCE` | Sieje wiersz `organization_members`? | Czerwieni |
| --- | --- | --- |
| `analysis`, `baseline`, `cross-tenant`, `export-import`, `legacy-id-bridge`, `lineage-navigator`, `mount-proof`, `prediction`, `statements`, `valuation` (10 plików) | **TAK** | **0** |
| `approveRbacGate` 20/20 · `comments` 18/24 · `saved-views` 17/17 · `artifacts-lifecycle-compute` 15/15 · `valuation-cross-tenant` 11/11 · `pkg-b2-cross-tenant` 9/9 · `compare` 7/17 · `valuation-b3-review` 6/6 · `crosscutting` 5/5 · `models` 3/3 · `valuation-independent-verifier` 2/2 · `day116-approved-valuation-wacc-conflict` 1/1 (12 plików) | **NIE** | **114** |
| `financeDigitizationAnalysisCandidateHandoff`, `numberNotation.*` (kontrole jednostkowe, nie dotykają bramki) | NIE | 0 |

**Ani jeden plik, który sieje członkostwo, nie ma czerwieni. Ani jeden plik z czerwienią nie
sieje członkostwa.** Komenda (5) z `§0.3` odtwarza to w jednym przebiegu.

**Wniosek hipotezy:** 12 pakietów uruchamia realny `ApiGateway` z realnym PostgreSQL, tworzy
użytkownika i organizację, ale **nie zakłada wiersza `organization_members`**, o który bramka
pyta na KAŻDYM żądaniu. Więc pierwsze żądanie wraca `403` — czasem w mierzonej asercji
(`expected 403 to be 201`), czasem w fazie przygotowania danych (`createArtifactViaHttp
failed: 403 ORG_MEMBERSHIP_REVOKED`), a to drugie kaskaduje na `TypeError`.

**Jak ją OBALIĆ (i obalenie jest sukcesem dyżuru):** weź **jeden** plik z listy „NIE" —
proponuję `artifacts-lifecycle-compute.routes.pg.test.ts`, bo pada 15/15 i ma czysty kształt
`expected 403 to be 201` — i uruchom go **dwa razy** na własnej bazie, zmieniając **DOKŁADNIE
JEDNĄ RZECZ**: obecność wiersza `organization_members (user_id, organization_id, status='ACTIVE')`
posadzonego w `beforeAll` w tej samej formie, w jakiej robi to `valuation.routes.pg.test.ts`.
**Jeżeli obie strony dają 15 FAIL — moja hipoteza jest FAŁSZYWA**, zapisujesz to wprost
i szukasz dalej (kolejni kandydaci, w tej kolejności: `requireOrgAccess`,
`demoContextMiddleware`, `ENABLE_V8_GLOBAL`, montaż `server/src/routes/v8/index.ts`,
brak roli w `organization_members.role`, `FINANCE_EDIT_FORBIDDEN`).
**Różnica wyniku między tymi dwoma przebiegami jest dowodem przyczyny — ale NIE JEST naprawą.**

## ★★ NAJWAŻNIEJSZA POZYCJA TEGO DYŻURU: ARTEFAKT POMIARU KONTRA REALNY DEFEKT

To jest cała wartość dyżuru i odbiorca sprawdzi to jako pierwsze.

**Kryterium rozstrzygające, dosłownie — dla KAŻDEGO z 12 padających plików odpowiadasz na
jedno pytanie:**

> **Czy w produkcie istnieje ścieżka, którą realny użytkownik dostaje wiersz
> `organization_members` ze statusem `ACTIVE` po utworzeniu/dołączeniu do organizacji?**

- **TAK, produkt tę ścieżkę ma, a test jej po prostu nie wywołał** ⇒ **ARTEFAKT POMIARU.**
  Fikstura testu nie odtwarza tego, co robi produkt. Dowód: `plik:linia` w kodzie produktu,
  który ten wiersz zapisuje (`INSERT INTO organization_members`), plus zdanie, którą trasą
  realny użytkownik go dostaje.
- **NIE, w produkcie nie ma takiej ścieżki albo ona nie działa** ⇒ **REALNY DEFEKT PRODUKTU.**
  Dowód: realne żądanie HTTP przez realny `ApiGateway` odtwarzające drogę użytkownika,
  z **zapisanym kodem odpowiedzi**, pokazujące, że po tej drodze wiersza nie ma.

**Wynik obowiązkowy: tabela 12 wierszy (plik → ARTEFAKT / REALNY DEFEKT / NIEORZECZONY),
z liczbą czerwieni przy każdym i jawną sumą, która ma się zgodzić ze 114.**
Wiersz `NIEORZECZONY` jest dozwolony i uczciwy — ale wymaga zdania **„czego konkretnie mi
zabrakło, żeby rozstrzygnąć samodzielnie"**.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze `c0f690bae36a386de27f1a349fbb9674ec03c693`:

- `10_FINANCE` warstwa serwerowa: **277 / 143 / 114**, **identycznie przed i po dyżurze 347**;
- rozkład kubełków: **59** `expected 403 to be X` · **20** `ORG_MEMBERSHIP_REVOKED` · **31**
  `TypeError` · **4** reszta; słowo `403` w **79** ze 114 komunikatów;
- separacja: **10 plików sieje `organization_members` → 0 czerwieni**; **12 plików nie sieje →
  114 czerwieni**; ani jednego wyjątku w żadną stronę;
- 20 wystąpień `ORG_MEMBERSHIP_REVOKED` mieszka w **jednym** pliku (`approveRbacGate.pg.test.ts`)
  i wszystkie idą przez `createArtifactViaHttp`;
- w repo są **63** artefakty 336 i **20** plików JSON dyżuru 347;
- katalog `evidence/g15/day355/` **NIE ISTNIEJE** na markerze — tworzysz go;
- liście słowników: **pl 35198**, **en 33065**; cztery bezpieczniki (`focus-canon`, `list-canon`,
  `artefakt`, `reachability --check-baseline`) kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / schematy** | `server/src/schemas/**` | **TYLKO ODCZYT** — schemat jest kontraktem produktu | Cytat wiersza schematu + brief |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/routes/v8/index.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** Każde „działa" znaczy: realne żądanie HTTP przez realny `ApiGateway`, z **zapisanym kodem odpowiedzi** | Opis w raporcie |
| **Bramka członkostwa** | `server/src/middleware/auth.middleware.ts` | **NIETYKALNE DO ZAPISU (`Z12`) — BEZ WYJĄTKU.** To jest miejsce, w którym mieszka zabezpieczenie. Wolno **czytać** i **cytować `plik:linia`**; wolno **zmutować tymczasowo** w `R3` wyłącznie jako dowód mutacyjny, z cofnięciem przez `cp` i pustym `git diff` | Brief z `plik:linia` + diff **nienałożony** |
| **Pozostałe middleware** | `server/src/middleware/**` (w tym `auditsStrictMembership.middleware.ts`, `resultsInternalBetaVisibility.middleware.ts`) | **NIETYKALNE DO ZAPISU** (`Z12`) | Brief |
| **Kontroler / trasy** | `server/src/routes/**` | **TYLKO ODCZYT** — ten dyżur uruchamia testy tras, nie zmienia tras. Wyjątek wymaga dowodu z `R2` i osobnego akapitu w raporcie | Wpis: plik, linia, czerwień, rekomendacja jako diff **nienałożony** |
| **Serwis / repozytorium** | `server/src/services/**`, `server/src/domain/**`, `server/src/repositories/**` | **TYLKO ODCZYT** | jak wyżej |
| **Testy `10_FINANCE` — 12 padających plików** | `server/src/routes/v8/finance-v2/__tests__/{approveRbacGate,comments,saved-views,artifacts-lifecycle-compute,valuation-cross-tenant,pkg-b2-cross-tenant,compare,crosscutting,models,valuation-b3-review,valuation-independent-verifier}.pg.test.ts`, `server/src/routes/v8/finance-v2/__tests__/day116-approved-valuation-wacc-conflict.realpg.test.ts` | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ** i wolno **dopisać do `beforeAll` posadzenie wiersza `organization_members` ze statusem `ACTIVE`** dokładnie w formie, w jakiej robi to `valuation.routes.pg.test.ts` — **jeżeli `R2` udowodni, że to jest właściwa naprawa, i wyłącznie dla plików sklasyfikowanych w `R2` jako ARTEFAKT POMIARU**. **Zakaz zmiany progu, usuwania asercji, zawężania zakresu i zmiany oczekiwanego kodu odpowiedzi, żeby zzielenieć** | — |
| **Testy `10_FINANCE` — 10 plików zielonych** | pozostałe `server/src/routes/v8/finance-v2/__tests__/**`, `server/src/services/finance/__tests__/**` | **TYLKO ODCZYT** — to jest wzorzec, z którego kopiujesz formę seedu, i baza kontrolna | — |
| **Dowód bramki (zabezpieczenie)** | `server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts`, `server/src/routes/v8/__tests__/financeIntelligence.membershipGate.pg.test.ts`, `server/src/middleware/__tests__/auditsStrictMembership.middleware.test.ts` | **NIETYKALNE DO ZAPISU.** To jest miejsce, w którym zabezpieczenie jest bronione. Wolno je **uruchamiać** i **musisz** je uruchomić PRZED i PO swojej zmianie | Wynik do raportu |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY.** Globalny `vi.mock` bramki członkostwa w tych plikach = wygaszenie zabezpieczenia dla całego korpusu | Opis w raporcie |
| **Produkt UI** | `src/**`, `src/views/**`, `public/locales/**` | **TYLKO ODCZYT** | Opis w raporcie |
| **Migracje** | `server/migrations/**` | **TYLKO ODCZYT — przedział nieprzydzielony temu dyżurowi.** Jeżeli brak wiersza członkostwa okaże się luką schematu, produktem jest brief, nie migracja | Brief z `plik:linia` |
| **Nowe testy** | `tests/**` (NOWE pliki, `git add -f`) | **★ PEŁNA LICENCJA na dodanie** testu dowodzącego pary „obcy `403` / właściciel `200`", jeżeli istniejące pokrycie okaże się niewystarczające. **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** | — |
| **Dowody** | `evidence/g15/day355/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**, `git add -f`) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie** | — |
| **Artefakty 336 i 347** | `evidence/g15/day336-artefakty/**`, `evidence/g15/day336-*.md`, `evidence/g15/day347/**` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To jest baza porównania; nadpisanie unieważnia cały dyżur | — |
| **Rejestr G15** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` | **AKTUALIZACJA przez DOPISANIE** sekcji „Aktualizacja dyżuru 355" | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/MODULE_ACCEPTANCE.md`, **wyłącznie wiersz `G15`** | **★ WĄSKA LICENCJA POD WARUNKIEM `R0`:** wiersz zmienia stan **tylko razem z dowodem w TYM SAMYM commicie**. Zakaz dotykania wierszy `G00`–`G14`, `G16`–`G20` i pozostałych 15 modułów | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem (dziś doszły do `Q`) | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY355_FINANCE_403_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `src/components/MyWork/prototypes/**`, `src/utils/ideaNotebookRightPanelPrototypeFlag.ts`, `tests/unit/flags/**` (dyżur 356) · `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, wiersz `G16` (dyżur 357) · `server/src/routes/__tests__/day27{4,5,6,7}-*.pg.test.ts`, `evidence/g19/**`, `vitest.config.ts` (dyżur 358) · `evidence/g15/day347/**` (dyżur 347) · wszystko wokół licznika kompletności, 20 ekranów podglądu, wiersza `G19` i etykiet narzędzi (dyżury 351-354) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
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
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | `10_FINANCE` przed / po dyżurze 347 | `277/143/114` obie strony | komenda (2) z `§0.3` | TAK — czyta `numTotalTests`, nie tylko `numFailedTests` |
| 2 | kubełki 114 czerwieni | `59 / 20 / 31 / 4` | komenda (3) z `§0.3` | TAK — filtruje po treści `failureMessages`, nie po nazwie testu |
| 3 | ile komunikatów zawiera `403` | `79` | komenda (3) z `§0.3` | TAK — **to obala „59 wskazuje `ORG_MEMBERSHIP_REVOKED`"** |
| 4 | separacja seed / czerwień | `10 → 0` i `12 → 114` | komenda (5) z `§0.3` | TAK — **ani jednego wyjątku; to jest rdzeń hipotezy** |
| 5 | przypadki przechodzące w plikach częściowych | `compare` 10/17, `comments` 6/24 | własna komenda `R1` | TAK — świadkowie różnicy |
| 6 | czy `403` znika po posadzeniu członkostwa | — | dwa przebiegi `R2` różniące się JEDNĄ rzeczą | TAK — różnica jest dowodem przyczyny |
| 7 | podział ARTEFAKT / REALNY DEFEKT | — | `R2` punkt 4, tabela 12 wierszy | TAK — **suma ma się zgodzić ze 114, sprawdź to jawnie** |
| 8 | czerwienie PO zmianie | — | przemiar `R4`, po **nazwach** | TAK — `Z37`: liczba bez nazw nie jest wynikiem |
| 9 | kontrola `09_RESULTS` | — | `R4` punkt 2 | TAK — dowód, że nie zgasiłeś tego, co naprawił 347 |
| 10 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY355_FINANCE_403_REPORT.md` ·
`evidence/g15/day355/**` (nowy katalog, `git add -f`).

**Zapisujesz WARUNKOWO (tylko z dowodem `R2`):**
12 padających plików `server/src/routes/v8/finance-v2/__tests__/**` wymienionych imiennie
w tabeli licencji · nowe pliki testowe w `tests/` (`git add -f`) ·
`modules/10_FINANCE/MODULE_ACCEPTANCE.md` wyłącznie wiersz `G15` ·
`REJESTR_G15_SAMOKONTROLA_20260903.md` (sekcja dopisana) ·
`REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `src/**`, `public/locales/**`, `tests/setup.ts`, `tests/helpers/**`,
`tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`,
`server/migrations/**`, `server/src/middleware/**`, `server/src/services/ApiGateway.ts`,
`server/src/routes/v8/index.ts`, `server/src/routes/v8/__tests__/finance*.membershipGate.pg.test.ts`,
`evidence/g15/day336-*`, `evidence/g15/day347/**`, `evidence/g19/**`,
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, wiersze `G00`–`G14` i `G16`–`G20`,
MODULE_ACCEPTANCE pozostałych 15 modułów.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day355-finance-403
git diff --name-only --cached | tee /private/tmp/cx-day355-finance-403-artefakty/staged.txt
bash -c "grep -iE '^src/|^public/locales/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|^server/src/middleware/|ApiGateway|routes/v8/index|membershipGate|day336-|day347/|evidence/g19|PRZELOT_WLASCICIELA|modules/0[1-9]_|modules/1[1-6]_' /private/tmp/cx-day355-finance-403-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Każda zmiana dotykająca bramki członkostwa wymaga PARY dowodów w tym samym commicie.**
Nie wystarczy „test przeszedł". Wymagam dwóch zdań z kodami odpowiedzi:
**(a)** żądanie od użytkownika, który **nie ma** wiersza `ACTIVE` w `organization_members`,
**nadal dostaje `403 ORG_MEMBERSHIP_REVOKED`**;
**(b)** żądanie od użytkownika, który **ma** taki wiersz, dostaje `200`/`201`.
Jeden dowód bez drugiego jest **wygaszeniem**, nie naprawą. To jest zmierzony kształt:
fail-closed świeci zielono, bo kontekst nie dociera, i funkcja przestaje działać dla wszystkich.

**(2) Nie naprawiasz po jednym teście.** Jeżeli po `R2` nie umiesz wskazać **jednej**
przyczyny obejmującej większość ze 114 czerwieni — piszesz to wprost jako wynik i **nie
wchodzisz w 114 poprawek**. Zdanie „przyczyna jest wieloraka, oto trzy rodziny po N czerwieni"
jest pełnowartościowym wynikiem tego dyżuru.

**(3) Porównania po NAZWACH, nigdy po liczbach.** Tabela „przed / po" w `R4` ma dwie kolumny
pełnych nazw przypadków (`fullName`), nie dwie liczby. „Było 114, jest 12" bez listy nazw
NIE jest wynikiem (`Z37`) — jeden test mógł zgasnąć, a drugi się zapalić.

**Wymagany dowód:** trzy zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — ODTWORZENIE 114 CZERWIENI PO NAZWACH I ŚWIADKOWIE RÓŻNICY (rdzeń)

Pracujesz na artefaktach, które **już są w repo** — nie uruchamiasz jeszcze niczego.

1. Wypisz **wszystkie 114 pełnych nazw** czerwonych przypadków z
   `evidence/g15/day336-artefakty/10-finance-serwer.json` do
   `evidence/g15/day355/przed-nazwy.txt` — po jednej nazwie na wiersz, z prefiksem pliku.
   **To jest baza porównania dla `R4` i bez niej `R4` nie ma sensu.**
2. Zrób to **drugi raz** z `evidence/g15/day347/r4-10-finance-serwer.json` do
   `evidence/g15/day355/po347-nazwy.txt` i zrób `diff` obu plików.
   **Twierdzę, że `diff` jest PUSTY — sprawdź to i zapisz wynik.** Jeżeli nie jest pusty,
   moja teza „naprawa 347 nie tknęła Finansów" jest fałszywa i to jest ważniejsze niż reszta
   pozycji.
3. Pogrupuj czerwienie po **kształcie komunikatu**, nie po nazwie testu. Minimum kubełków:
   `expected 403 to be X` · `ORG_MEMBERSHIP_REVOKED` w treści · `TypeError`/`undefined` ·
   `createArtifactViaHttp failed` · reszta. **Podaj liczbę w każdym kubełku i sumę — suma ma
   się zgodzić ze 114.**
4. Wskaż **kaskadę**: które kubełki są SKUTKIEM pierwszego `403`, a nie osobną czerwienią.
   Dyżur 347 policzył ją jako `31 + 20 = 51` — **potwierdź albo obal, cytując treść
   komunikatu**, nie powtarzaj po nim.
5. Wskaż **świadków różnicy**: `compare.routes.pg.test.ts` pada 7 z 17,
   `comments.routes.pg.test.ts` 18 z 24. **Nazwij przypadki, które PRZECHODZĄ, i powiedz,
   czym się różnią od padających.**

**Wymagany dowód:** `evidence/g15/day355/przed-nazwy.txt` ze 114 nazwami · `diff` wobec
`po347-nazwy.txt` · tabela kubełków z sumą · zdanie o kaskadzie z liczbą · nazwy i wyjaśnienie
świadków. **Commit po `R1`.**

## R2 — PRZYCZYNA ŹRÓDŁOWA I PODZIAŁ NA ARTEFAKT / DEFEKT (rdzeń)

**To jest pozycja, w której hipoteza staje się faktem albo pada, i pozycja, dla której ten
dyżur istnieje.**

1. **Postaw kontener** `cx-day355-pg` na porcie `6414`, baza `cx355`, i przepuść migracje
   zgodnie z `§0.2c` (A) — **dwa przebiegi**, drugi bezbłędny i bez zmian (idempotencja).
   `pgvector/pgvector:pg16`; `postgres:15` **nie przechodzi migracji**.
2. **Odtwórz separację na żywo, nie z artefaktu:** uruchom `artifacts-lifecycle-compute.routes.pg.test.ts`
   (dziś 15/15 FAIL, kształt czysty) oraz `valuation.routes.pg.test.ts` (dziś 15/15 PASS,
   sieje członkostwo), `--retry=0`, `--reporter=json`, komplet env z `§0.2c` (B).
   **Zapisz oba JSON-y i oba `numTotalTests` / `numFailedTests`.**
3. **Jedna zmiana, dwa przebiegi.** Do `beforeAll` pliku `artifacts-lifecycle-compute.routes.pg.test.ts`
   dopisz posadzenie wiersza `organization_members (user_id, organization_id, status='ACTIVE', role=…)`
   **w dokładnie tej formie, w jakiej robi to `valuation.routes.pg.test.ts`** — i uruchom ten
   sam plik drugi raz. **Zapisz oba JSON-y.**
   - **Jeżeli różnica jest zerowa — moja hipoteza jest FAŁSZYWA.** Zapisz to zdaniem
     „hipoteza autora instrukcji obalona pomiarem" i szukaj dalej. Kolejni kandydaci,
     w tej kolejności: `requireOrgAccess`, `demoContextMiddleware`, `ENABLE_V8_GLOBAL`,
     montaż `server/src/routes/v8/index.ts`, wartość `organization_members.role`,
     `FINANCE_EDIT_FORBIDDEN`.
   - **Jeżeli różnica jest duża — nadal nie masz przyczyny, masz przełącznik.** Dopiero
     wskazanie `plik:linia` w `server/src/middleware/auth.middleware.ts`, które **czyta** ten
     wiersz i decyduje o `403`, jest przyczyną. **Cytuj wiersz dosłownie.**
4. **★★ PODZIAŁ, DLA KTÓREGO TEN DYŻUR ISTNIEJE.** Dla **każdego** z 12 padających plików
   odpowiadasz na pytanie z sekcji „ARTEFAKT POMIARU KONTRA REALNY DEFEKT" i wypełniasz
   tabelę: **plik · ile czerwieni · ARTEFAKT / REALNY DEFEKT / NIEORZECZONY · dowód**.
   Dowodem dla „ARTEFAKT" jest `plik:linia` w kodzie produktu, który zapisuje wiersz
   członkostwa (`INSERT INTO organization_members`), plus nazwa trasy, którą realny użytkownik
   go dostaje. Dowodem dla „REALNY DEFEKT" jest realne żądanie HTTP przez realny `ApiGateway`
   z **zapisanym kodem odpowiedzi**. **Suma czerwieni w tabeli ma dać 114 — sprawdź to jawnie.**
5. **Rozstrzygnij rodzinę, nie pojedynczy plik** (`KROK 0` przed jakąkolwiek zmianą): wypisz
   wszystkie 28 plików mierzonych jako `10_FINANCE`, zaznacz, które sieją członkostwo, a które
   nie. **Zmiana ma objąć całą rodzinę sklasyfikowaną jako ARTEFAKT albo raport ma powiedzieć,
   dlaczego nie.**

**Wymagany dowód:** cztery JSON-y (dwa pliki × dwa warianty) z `numTotalTests` każdego ·
cytat `plik:linia` gałęzi decydującej o `403` · **tabela 12 wierszy ARTEFAKT/DEFEKT z sumą
114** · tabela rodziny 28 plików. **Commit po `R2`.**

## R3 — JEDNA ZMIANA I PARA DOWODÓW (rdzeń)

**Zmieniasz RAZ i tylko to, co `R2` sklasyfikował jako ARTEFAKT POMIARU.** Wybierasz jedno
z rozwiązań i **uzasadniasz wybór**, wypisując, co odrzuciłeś i dlaczego:

- **(A)** posadzenie wiersza `organization_members` w `beforeAll` tych pakietów, które są
  kontraktami HTTP z realnym `ApiGateway` — w formie skopiowanej z pliku, który dziś jest
  zielony;
- **(B)** wspólny pomocnik seedujący w `server/src/routes/v8/finance-v2/__tests__/` — **tylko
  jeżeli `R2` pokaże, że forma jest identyczna we wszystkich plikach**;
- **(C)** zgłoszenie REALNEGO DEFEKTU jako briefu z diffem **nienałożonym**, bez zmiany kodu
  produktu — to jest właściwa droga dla każdego pliku sklasyfikowanego jako REALNY DEFEKT,
  bo naprawa produktu wymaga własnego dyżuru i decyzji właściciela;
- **(D)** cokolwiek innego, co `R2` wskaże jako właściwe.

**Czego NIE WOLNO — niezależnie od wybranej drogi:**
zmiany warunku w `auth.middleware.ts` tak, żeby bramka przestała egzekwować ·
dopuszczenia statusu innego niż `ACTIVE` · globalnego `vi.mock` bramki w `tests/setup.ts`,
`tests/helpers/**` lub `tests/__mocks__/**` (`Z18`) · `.skip`, `.todo`, `--retry` innego niż
`0`, poszerzania `exclude`, zmiany oczekiwanego kodu odpowiedzi w asercji (`Z35`).

**Para dowodów, obowiązkowa, w tym samym commicie:**

1. **Obcy nadal odbity:** `server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts`
   i `financeIntelligence.membershipGate.pg.test.ts` uruchomione na realnym PostgreSQL,
   **zielone przed i po Twojej zmianie** — wyniki obu przebiegów do raportu.
2. **Właściciel przechodzi:** realne żądanie HTTP przez realny `ApiGateway`, z podpisanym
   JWT, na Twoim PostgreSQL po pełnych migracjach, od użytkownika z wierszem `ACTIVE` —
   **z zapisanym kodem odpowiedzi** (`Z34`).
3. **Dowód mutacyjny celujący w ZABEZPIECZENIE, nie w mechanizm** (`Z32`): w
   `server/src/middleware/auth.middleware.ts` zamień warunek
   `normalizeMembershipStatus(membership.status) === 'ACTIVE'` na `!!membership`
   **albo** usuń warunek statusu z zapytania → testy broniące bramki
   (`financeValue.membershipGate`, `auditsStrictMembership.middleware`) mają
   **zaczerwienić się**; cofnij przez `cp` ze `SCRATCH` (nigdy `git stash`, `Z27`) → mają
   **zzielenieć**; `git diff` po cofnięciu **pusty**. Obie komendy i oba wyniki dosłownie
   w raporcie.
   ★ Mutacja w treści testu albo w zmiennej środowiskowej **nie liczy się** — ma trafić
   w kod, który realizuje zabezpieczenie.

**Wymagany dowód:** opis wybranej drogi z uzasadnieniem odrzucenia pozostałych · para
„obcy `403` / właściciel `200`" z kodami odpowiedzi · dowód mutacyjny w obie strony · wynik
pakietów broniących bramki przed i po. **Commit po `R3`.**

## R4 — PRZEMIAR PO ZMIANIE I TABELA „PRZED / PO" PO NAZWACH

1. Uruchom **cały** `10_FINANCE` tym samym wariantem, którym mierzył dyżur 336 (poza świadomie
   zmienionym elementem z `R3`), `--retry=0`, `--reporter=json`.
2. **Kontrolnie uruchom `09_RESULTS`** — dowód, że nie zgasiłeś tego, co naprawił dyżur 347.
3. Zapisz `evidence/g15/day355/po-nazwy.txt` i zrób
   `diff evidence/g15/day355/przed-nazwy.txt evidence/g15/day355/po-nazwy.txt`.
4. **Tabela główna dyżuru:** trzy kolumny — **nazwy, które zniknęły**, **nazwy, które
   zostały** (dług), **nazwy, które się POJAWIŁY** (każda pojawiona nazwa wymaga wyjaśnienia
   albo STOP-u).
5. **Podaj `numTotalTests`, nie tylko `numFailedTests`.** Przebieg z zerem wykonanych
   przypadków kończy się `exit 0` i **nie jest pomiarem**. `No test files found` i
   `Transform failed` to **BŁĄD KOMENDY**.
6. **Jawna liczba tego, co zostaje, w rozbiciu na ARTEFAKT i REALNY DEFEKT:**
   „ze 114 czerwieni zniknęło N, zostaje M, z czego K to realne defekty produktu wymagające
   osobnego dyżuru — i oto ich nazwy".

**Wymagany dowód:** `po-nazwy.txt` · pełny `diff` · tabela trzech kolumn · `numTotalTests`
dla każdego przebiegu · wynik kontrolny `09_RESULTS` · jawna liczba pozostających czerwieni
z podziałem. **Commit po `R4`.**

## R5 — RAPORT, JAWNA LICZBA I PYTANIA DO WŁAŚCICIELA

Raport zawiera: tabelę kubełków z `R1` · wynik `diff` przed/po-347 · rozstrzygnięcie hipotezy
z `R2` (**wprost: potwierdzona czy obalona**) · **tabelę 12 wierszy ARTEFAKT/REALNY
DEFEKT/NIEORZECZONY z sumą 114** · opis JEDNEJ zmiany z `R3` wraz z uzasadnieniem odrzucenia
pozostałych dróg · parę dowodów „obcy `403` / właściciel `200`" · dowód mutacyjny w obie
strony · tabelę „przed / po" po nazwach z `R4` · **jawną liczbę czerwieni, które zostają** ·
listę rozbieżności wobec liczb tej instrukcji · **niepustą sekcję „TWIERDZENIA
NIEZWERYFIKOWANE"** · obowiązkowy akapit `§0.2e` dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „CO NADAL WYMAGA OSOBNEGO ZLECENIA".** Każdy plik
sklasyfikowany jako REALNY DEFEKT wypisujesz z nazwy, z liczbą czerwieni i jednozdaniowym
opisem, czego brakuje w produkcie. **To jest produkt, którego program potrzebuje najbardziej:
ile pracy tam naprawdę jest, a ile było artefaktem przyrządu.**

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA".** Sekcja może być pusta, ale wtedy
piszesz wprost: „nie mam zastrzeżeń".

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy (dziś sekcje doszły do `Q`).

**Commit po `R5`.**

## Próg odbioru

**Jedno źródło wskazane z `plik:linia`, tabela „przed / po" po NAZWACH, jawny podział 114
czerwieni na artefakt pomiaru i realny defekt produktu, oraz jawna liczba tego, co zostaje** —
przy nienaruszonej bramce członkostwa, udowodnionej parą „obcy `403` / właściciel `200`"
i dowodem mutacyjnym w obie strony.

Odbiorca odrzuci dyżur, w którym czerwienie zniknęły, a pary dowodów nie ma; w którym
porównanie jest po liczbach zamiast po nazwach; w którym podziału na artefakt i defekt nie ma
albo jego suma nie daje 114; albo w którym bramkę „naprawiono" przez rozluźnienie uprawnień.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „114 czerwieni rozłożone na
k kubełków, przyczyna wskazana/obalona z cytatem `plik:linia`, podział na artefakt i defekt
wykonany, zmiana nie wykonana, bo wymaga decyzji właściciela" — **jest pełnowartościowym
wynikiem, nawet jeśli ani jedna czerwień nie zgasła.**

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Napraw 114 czerwieni" vs „zakaz wygaszania bramki" | `R0` (1) i `R3`: zmiana wymaga PARY dowodów — obcy nadal `403`, właściciel `200`; jeden bez drugiego jest wygaszeniem |
| „`auth.middleware.ts` NIETYKALNY (`Z12`)" vs „przyczyna leży w tym pliku" | Tabela licencji: plik jest nietykalny **do zapisu trwałego**; `R3` punkt 3 zamawia mutację **tymczasową** jako dowód, z cofnięciem przez `cp` i pustym `git diff` — to nie jest zmiana produktu |
| „Znajdź jedną przyczynę" vs „rozdziel artefakt od defektu" | `R2` punkty 3 i 4: jedna przyczyna techniczna (`403` z braku wiersza) może dawać DWA werdykty produktowe w zależności od tego, czy produkt tę ścieżkę ma; to nie jest sprzeczność, tylko dwa poziomy odpowiedzi |
| „Zmieniasz testy" vs „`Z18` zakazuje ruszać infrastruktury testów" | `R3`: seed wolno dopisać **w pojedynczym pliku pakietu**; globalny mock albo seed w `tests/setup.ts`/`helpers`/`__mocks__` pozostaje zakazany — to różnica między jednym pakietem a całym korpusem |
| „Instrukcja mówi 59 = `ORG_MEMBERSHIP_REVOKED`" vs „mój pomiar mówi 20" | Sekcja „SPROSTOWANIE": autor instrukcji sam obalił zdanie zlecenia przy wydaniu; wiążący jest pomiar wykonawcy (`Z24`) |
| „Zmierz spadek" vs `Z37` (zakaz porównań po liczbach) | `R1` i `R4`: `przed-nazwy.txt` i `po-nazwy.txt` z pełnymi `fullName`; produktem jest `diff`, nie różnica dwóch liczb |
| „Zmiana ma objąć rodzinę" vs „zmieniasz RAZ" | `R2` punkt 5: rodzina to ta sama zmiana zastosowana mechanicznie, nie N różnych poprawek; jeżeli rodzina wymaga N różnych rozwiązań, to `R2` obalił jedność przyczyny i mówisz to wprost |
| „Uruchom testy bramki" vs „są NIETYKALNE" | Tabela licencji: nietykalne **do zapisu**; uruchamianie jest jawnie zamówione i obowiązkowe przed i po |
| „Migracje mogą być przyczyną" vs „brak przydzielonego przedziału" | Tabela licencji, wiersz „Migracje": produktem jest **brief z `plik:linia`**, nie migracja; pozycja z briefem jest ZROBIONA, nie STOP |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R3` punkt 3: mutację cofasz przez `cp` ze `SCRATCH`; `git diff` po cofnięciu ma być pusty |
| „Dopisz sekcję do rejestru znalezisk" vs „równolegle piszą inni autorzy" | `R5`: literę sekcji sprawdzasz komendą **tuż przed commitem**, nie zakładasz z góry; kolizja liter jest przewidziana |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — 63 artefakty 336, 20 plików JSON 347, `auth.middleware.ts:1898-1926`, 28 plików `finance-v2/__tests__`, trzy pakiety broniące bramki sprawdzone przy wydaniu; `evidence/g15/day355/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 10 wierszy; wiersze 1-5 i 10 zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — walidator · montaż · bramka członkostwa · pozostałe middleware · kontroler · serwis/repozytorium · 12 testów padających · 10 testów zielonych · dowód bramki · infrastruktura testów · UI · migracje · nowe testy · dowody · artefakty 336/347 · rejestr · macierz · rejestr znalezisk · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` nie uruchamia niczego (czyta artefakty z repo), `R2` mierzy i klasyfikuje, `R3` zmienia dokładnie jedną rzecz w plikach testowych, `R4` mierzy |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `6414`/`5554` wolne (`lsof` przy wydaniu), brak kontenera `cx-day355-pg`, brak gałęzi `codex/day355-*` i worktree; 356/357/358 mają rozłączne porty (`6415`/`5555`, `6416`/`5556`, `6417`/`5557`) i rozłączne pliki; dyżury 351-354 mają rozłączny temat |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: kaskada `createArtifactViaHttp` → `TypeError` liczona jako osobne defekty, wygaszenie bramki, `403` kontra `503`, atrapa bazy, `NODE_ENV=test` bez `RUN_DB_TESTS`, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
