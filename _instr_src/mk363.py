# -*- coding: utf-8 -*-
import json

WT = "/private/tmp/cx-day363-g15-ile-realne"

KOMENDY = r"""```bash
cd "$WT"

# (1) TEZA: bramka G15 ma 16 wierszy, po jednym na modul — i NIE wszystkie sa PARTIAL_PASS
bash -c "grep -rn '^| \`\?G15' docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md" \
  | sed 's/|/ | /g' | cut -c1-200
echo "kod grepa=$?"
#   moje liczby: 16 wierszy. 2x PASS (01_ORGANIZATION, 13_CHAT);
#   10x PARTIAL_PASS; 4x NOT_MEASURED

# (2) ★★ TEZA ROZSTRZYGAJACA: sa DWA rozlaczne zbiory o liczebnosci 10
bash -c "grep -rl 'PARTIAL_PASS / RED_LEGACY' docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md | wc -l"
bash -c "grep -rl 'PARTIAL_PASS / SERVER_NOT_MEASURED' docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md | wc -l"
bash -c "grep -rl 'NOT_MEASURED / RED_LEGACY' docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md | wc -l"
#   moje liczby: 6 + 4 + 4.
#   Zbior A („stan = PARTIAL_PASS”) = 6 + 4 = 10 wierszy.
#   Zbior B („podtyp = RED_LEGACY_*”) = 6 + 4 = 10 wierszy.
#   ★ TO NIE JEST TEN SAM ZBIOR. Czesc wspolna = 6 modulow.

# (3) TEZA: numeral w podtypie NIE JEST jednostka — czytaj tresc wiersza, nie etykiete
for m in 02_INTERVIEW 03_TOOLS 05_INITIATIVES 06_EXECUTION 07_MY_WORK_AGENT \
         08_MEETINGS 10_FINANCE 11_MATERIALS 14_ADMIN 16_PARTNER; do
  echo "== $m"
  bash -c "grep -n '^| \`\?G15' docs/program/waves/WAVE_03_ACCEPTANCE/modules/$m/MODULE_ACCEPTANCE.md" \
    | grep -oE 'G15 (PARTIAL|NOT_MEASURED) —.*' | cut -c1-190
done
#   moje liczby, odczytane z TRESCI wierszy (FAIL frontowe):
#   02=7 · 03=1 · 05=19 · 06=14 · 07=3 · 08=3 · 10=1 · 11=2 · 14=7 · 16=9  ⇒ RAZEM 66
#   suma numeralow z ETYKIET podtypow (7+1+1+1+2+1+1+1+7+2+1nowa) ⇒ 26
#   ★ ROZJAZD 40 PRZYPADKOW. W 02/03/10/11/14 numeral liczy CZERWIENIE;
#   w 05/06/08 liczy POTWIERDZONE RODZINY; w 16 liczy PLIKI. To trzy rozne jednostki.

# (4) TEZA: material dowodowy trzech poprzednich dyzurow LEZY W REPO
ls evidence/g15/day336-artefakty/*.json | wc -l
ls evidence/g15/day347/ | wc -l
ls evidence/g15/day351-artefakty/ | wc -l
ls evidence/g15/day355/ evidence/g15/day355-artefakty/ | wc -l
#   moje liczby: 63 · 39 · 14 · 22 (z naglowkami katalogow)

# (5) ★★★ TEZA: STRAZNIK, ktory ma byc celem mutacji, NIE JEST tym, ktory mutowal dyzur 355
bash -c "grep -n \"toUpperCase() !== 'ACTIVE'\" server/src/services/legacyCutover/requireActiveMembership.ts"
sed -n '1904,1910p' server/src/middleware/auth.middleware.ts
#   moje liczby: warunek strazniczy w requireActiveMembership.ts to LINIA 34
#   (403 wychodzi w linii 35). Dyzur 355 mutowal auth.middleware.ts:1906
#   — middleware, ktorego badane testy NIE MONTUJA. Dlatego mutacja nie zaczerwienila.

# (6) ★★ TEZA: przebieg bazowy i zmutowany 355 mialy ROZNE MIANOWNIKI
node -e "const fs=require('fs');for(const f of ['evidence/g15/day355-artefakty/r3-gates-before.json','evidence/g15/day355-artefakty/r3-gates-mutated.json']){const r=JSON.parse(fs.readFileSync(f,'utf8'));console.log(f.split('/').pop(),'total',r.numTotalTests,'suites',r.testResults.length,'|',r.testResults.map(s=>s.name.split('/').pop()).join(' '));}"
#   moje liczby: before 68 / 3 pakiety · mutated 62 / 2 pakiety
#   ★ financeIntelligence.membershipGate.pg.test.ts (6 przypadkow) WYPADL miedzy A i B

# (7) TEZA: liscie slownikow i bramki kanonu na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35199, en 33066; focus=0, list=0, artefakt=0, reach=0

# (8) zasoby: dysk, porty, kontener
df -h /
lsof -nP -iTCP:6434 -sTCP:LISTEN; lsof -nP -iTCP:5574 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day363 || true
#   oczekiwane przy wydaniu: 35 GB wolnego; oba porty puste; 0 kontenerow
```"""

cfg = {
 "NR_DYZURU": "363",
 "TYTUL_JEDNYM_ZDANIEM": (
   "★★★ G15 — ILE Z DZIESIĘCIU WIERSZY TO REALNY DEFEKT, A ILE ARTEFAKT PRZYRZĄDU. "
   "To jest dyżur **ROZSTRZYGAJĄCY, NIE NAPRAWCZY** — decyduje o tym, czy w ogóle warto "
   "cokolwiek naprawiać. Dwa dyżury pokazały dziś, że taki licznik potrafi być iluzją: "
   "**347** udowodnił, że z 542 czerwieni serwerowych **401 zniknęło po JEDNEJ zmianie** "
   "(różnica odtworzona jedną zmienną: `enforce` → 118/0/118, bez niej → 118/118/0); "
   "**355** orzekł to samo dla Finansów (114 czerwieni = 114 artefakt / 0 defekt). "
   "★★ ALE odbiorca 355 OBALIŁ jego wniosek, bo **mutacja chybiła celu** — trafiła "
   "w `validateOrgMembership` (`auth.middleware.ts:1906`), middleware, którego badane testy "
   "NIE MONTUJĄ; prawdziwym strażnikiem jest "
   "`server/src/services/legacyCutover/requireActiveMembership.ts` (warunek w linii **34**, "
   "`403` w linii 35). Po mutacji WŁAŚCIWEGO warunku: **GREEN 44/44 → RED 33/11 → GREEN 44/44** "
   "— pakiet broni bramki. Zadanie: dla KAŻDEGO z dziesięciu wierszy `G15` z podtypem "
   "zastanej czerwieni rozstrzygnąć **ARTEFAKT czy REALNY DEFEKT** i podać liczbę, przy czym "
   "rozstrzygnięcie musi stać na **mutacji trafiającej we właściwego strażnika**, nie na "
   "analogii — a tam, gdzie używasz analogii rodzinnej, masz to powiedzieć wprost i pokazać, "
   "na czym stoi"
 ),
 "WORKTREE": WT,
 "NAZWA_WORKTREE": "cx-day363-g15-ile-realne",
 "NAZWA": "day363-g15-ile-realne",
 "SCRATCH": WT + "-scratch",
 "ARTEFAKTY": WT + "-artefakty",
 "SHA_MARKERA": "2a7273e087cbd3e44344725b524f6ddd79d5badc",
 "REMOTE": "github-backup",
 "GALAZ_BAZOWA": "grafika/m03-20260902",
 "GALAZ_DYZURU": "codex/day363-g15-ile-realne-20260904",
 "WYDANY": "WYDANY",
 "DATA": "2026-09-04",
 "PORT_DB": "6434",
 "PORT_HARNESS": "5574",
 "KONTENER": "cx-day363-pg",
 "BAZA": "cx363",
 "JWT_SECRET": "cx363-test-secret-do-not-reuse-min-32-znaki",
 "N_KOMEND": "osiem",

 "MODUL_LUB_OBSZAR": (
   "BRAMKA ODBIORU `G15` („Integrator self-QA and impacted regression”) — konkretnie "
   "**dziesięć wierszy, których podtyp mówi o zastanej czerwieni** "
   "(`RED_LEGACY_1`, `RED_LEGACY_2`, `RED_LEGACY_7`, `RED_LEGACY_1_CONFIRMED`, "
   "`RED_LEGACY_2_CONFIRMED`, `RED_LEGACY_2_PLUS_RED_NEW_1`) w modułach "
   "`02_INTERVIEW`, `03_TOOLS`, `05_INITIATIVES`, `06_EXECUTION`, `07_MY_WORK_AGENT`, "
   "`08_MEETINGS`, `10_FINANCE`, `11_MATERIALS`, `14_ADMIN`, `16_PARTNER`. "
   "Przedmiotem pracy jest **ORZECZENIE**, nie naprawa: dla każdego wiersza rozstrzygasz, "
   "czy czerwień pod nim to **artefakt przyrządu pomiarowego** (jak 401 czerwieni w 347), "
   "czy **realny defekt produktu**, i podajesz liczbę. Produktem jest tabela dziesięciu "
   "wierszy z dowodem per wiersz oraz **jawna rekomendacja: co naprawiamy, a co przyjmujemy "
   "jako dług z numerem decyzji**. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, "
   "i plik postępu `/private/tmp/cx-day363-postep.md` (POZA repo)"
 ),

 "TRASY_FRONT": (
   "Ten dyżur **nie zmienia frontu**. Uruchamia frontowe pakiety testowe dziesięciu modułów, "
   "żeby odtworzyć czerwienie **po pełnych nazwach** — to jest odczyt, nie zmiana. "
   "Wszystkie pliki `src/**` pozostają `TYLKO ODCZYT` bez wyjątku, także wtedy gdy "
   "„wystarczyłaby jedna linijka, żeby test przeszedł”"
 ),

 "TRASY_TYL": (
   "★★ SEDNO METODY. Strażnik, który ma być celem mutacji tam, gdzie orzekasz ARTEFAKT "
   "z powodu bramki członkostwa: "
   "`server/src/services/legacyCutover/requireActiveMembership.ts` — **warunek `!== 'ACTIVE'` "
   "w linii 34, odpowiedź `403 ORG_MEMBERSHIP_REVOKED` w linii 35** (zmierzone przy wydaniu; "
   "instrukcja zlecenia podawała 35 dla warunku — sprawdź sam i zapisz, co zobaczyłeś). "
   "**NIE** `server/src/middleware/auth.middleware.ts:1901-1911` — tam mieszka `validateOrgMembership` "
   "o niemal identycznym kształcie zapytania, i to jest pułapka, w którą wpadł dyżur 355. "
   "Drugi strażnik tej rodziny: `requireFinanceEditorMembership` w TYM SAMYM pliku. "
   "Pakiety broniące zabezpieczenia: "
   "`server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts` (44 przypadki), "
   "`server/src/routes/v8/__tests__/financeIntelligence.membershipGate.pg.test.ts` (6 przypadków), "
   "`server/src/middleware/__tests__/auditsStrictMembership.middleware.test.ts` (18 przypadków). "
   "**Razem 68 — i to jest mianownik, który MUSI być identyczny w przebiegu bazowym i zmutowanym.** "
   "Dyżur 355 miał 68 kontra 62, bo `financeIntelligence` wypadł między A i B, i nikt tego nie zauważył"
 ),

 "LISTA_PORTOW_ZAJETYCH": (
   "Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium "
   "ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. "
   "Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. "
   "Rodzeństwo TEJ paczki 04.09 — nie dotykasz: 364 (6435/5575), 365 (6436/5576), 366 (6437/5577). "
   "Równoległa paczka 359-362 ma zarezerwowany przedział 6430-6433 i 5570-5573 — również nie dotykasz. "
   "Starsze rodzeństwo 04.09: 347 (6394/5534), 348 (6395/5535), 349 (6396/5536), 350 (6397/5537), "
   "351 (6410/5550), 352 (6411/5551), 353 (6412/5552), 354 (6413/5553), 355 (6414/5554). "
   "Twoje własne wyłącznie: baza 6434, harness 5574. "
   "★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)"
 ),

 "POZYCJE_Z_FLAGAMI": (
   "BRAK NOWYCH FLAG. Ten dyżur nie dodaje ani jednej flagi i nie zmienia wartości domyślnej "
   "żadnej istniejącej. ★★ UWAGA SZCZEGÓLNA: `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE`, "
   "`ENABLE_TEST_AUTH_BYPASS`, `ENABLE_V8_GLOBAL`, `RUN_DB_TESTS`, `MOCK_DB` **nie są flagami "
   "funkcyjnymi produktu** — to przełączniki trybu pomiaru. Wolno Ci nimi sterować "
   "W KOMENDZIE POMIAROWEJ i **musisz zapisać, którą wartość miała każda z nich w każdym "
   "przebiegu**, bo to jest połowa odpowiedzi na pytanie „artefakt czy defekt”. "
   "**Nie wolno Ci zmieniać ich wartości domyślnych w kodzie ani w plikach konfiguracji testów**"
 ),

 "LISTA_BRAMEK": (
   "`scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, "
   "`scripts/dev/reachability-from-root.mjs`, `tests/setup.ts`, `tests/helpers/**`, "
   "`tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, "
   "`server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`, "
   "`server/src/services/legacyCutover/requireActiveMembership.ts`, "
   "`server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts`, "
   "`server/src/routes/v8/__tests__/financeIntelligence.membershipGate.pg.test.ts`, "
   "`server/src/middleware/__tests__/auditsStrictMembership.middleware.test.ts`. "
   "Wszystkie **NIETYKALNE DO ZAPISU** — wolno je wołać w pomiarze i wolno je **tymczasowo "
   "zmutować i cofnąć przez `cp`**, nie wolno zostawić w nich ani jednej zmiany w commicie"
 ),

 "SCIEZKA_RAPORTU": "docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY363_G15_ILE_REALNE_REPORT.md",

 "Jedyny": (
   "Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w "
   "`docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — sekcje doszły "
   "dziś do `Z`, więc następne idą `AA`, `AB`, … (literę sprawdzasz komendą tuż przed commitem, "
   "nie zakładasz z góry, bo równolegle piszą inni autorzy), oraz nowe pliki dowodowe pod "
   "`evidence/g15/day363/` (katalog NIE ISTNIEJE na markerze — tworzysz go). "
   "★★★ **MACIERZ ODBIORU JEST NIETYKALNA W TYM DYŻURZE.** Nie zmieniasz stanu ANI JEDNEGO "
   "wiersza `G00`–`G20` w ŻADNYM z 16 modułów — także tego, o którym udowodnisz, że jest "
   "nieaktualny. Wierszami zajmują się równolegle dyżury 359-362; Twoim produktem jest "
   "ORZECZENIE i rekomendacja, nie wpis. Plik postępu `/private/tmp/cx-day363-postep.md` żyje "
   "POZA repo. Nowe pliki w `tests/` wymagają `git add -f`"
 ),

 "ZAKAZ_WLASCIWY_TEMU_DYZUROWI": (
   "★★★ **ZAKAZ ORZEKANIA „ARTEFAKT” Z ANALOGII BEZ POWIEDZENIA TEGO WPROST.** "
   "Najkrótsza droga do wyniku, który wygląda dobrze i jest nic niewart, to napisać "
   "„to ten sam kształt co w 347, więc artefakt” dla wszystkich dziesięciu wierszy. "
   "Orzeczenie ARTEFAKT jest ważne wtedy i tylko wtedy, gdy **albo** stoi na mutacji "
   "trafiającej we właściwego strażnika i pokazującej różnicę, **albo** jest jawnie "
   "oznaczone jako `ARTEFAKT_Z_ANALOGII` z podaniem: (a) wiersza wzorcowego, na którym "
   "analogia stoi, (b) czym udowodniłeś, że mechanizm jest ten sam, (c) czego NIE zmierzyłeś. "
   "★★ **ZAKAZ MUTACJI, KTÓRA NIE TRAFIA W ZABEZPIECZENIE** (`Z32`): jeżeli mutacja nie "
   "czerwieni, sprawdzasz NAJPIERW, czy trafiła w to, co miała trafić — dziś jeden dyżur "
   "ogłosił „wymaganie pomiarowo fałszywe”, bo mutował middleware, którego test nie montuje. "
   "★★ **ZAKAZ PORÓWNANIA PO LICZBACH** (`Z37`): „68 zielonych przed, 62 zielone po” **nie jest "
   "wynikiem** — to jest zmiana mianownika. Przebieg bazowy i zmutowany muszą mieć "
   "**identyczną listę pełnych nazw**, a jeżeli nie mają, to jest to defekt pomiaru i piszesz "
   "o tym, zanim cokolwiek orzekniesz. "
   "★★ **ZAKAZ NAPRAWIANIA.** Ten dyżur niczego nie naprawia w produkcie ani w testach. "
   "Jeżeli zobaczysz naprawę na jedną linijkę — opisujesz ją jako diff **NIENAŁOŻONY** "
   "i idziesz dalej. **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`** "
   "(`Z35`). **ZAKAZ zmiany stanu wiersza macierzy odbioru** — patrz sekcja o dokumentach"
 ),

 "DLACZEGO": (
   "Bo program stoi przed decyzją, ile pracy tu naprawdę jest. Dyżur 347 pokazał, że licznik "
   "542 zawierał 401 powtórzeń jednej przyczyny. Dyżur 355 orzekł 114 z 114 jako artefakt "
   "— i odbiorca to obalił, bo dowód celował w niewłaściwy plik. Dziesięć wierszy `G15` "
   "z podtypem zastanej czerwieni jest dziś **jedyną pozostałą niewiadomą tej bramki**: jeżeli "
   "to artefakty, zamykamy je długiem i idziemy dalej; jeżeli to defekty, ktoś musi je naprawić "
   "przed odbiorem. **Kto zaplanuje naprawy bez tego rozstrzygnięcia, zaplanuje pracę, "
   "której nie ma — albo przegapi tę, która jest.** A ponieważ jeden z dwóch dostępnych "
   "precedensów okazał się fałszywy, tym razem dowód musi być mocniejszy niż analogia"
 ),

 "PULAPKA_WLASCIWA_TEMU_MODULOWI": (
   "★★★ **SIEDEM PUŁAPEK.** "
   "(1) **Dwa rozłączne zbiory po dziesięć.** Wierszy `PARTIAL_PASS` jest dziesięć "
   "(cztery z nich mają podtyp `SERVER_NOT_MEASURED`, nie `RED_LEGACY`), a wierszy "
   "z podtypem `RED_LEGACY_*` też dziesięć (cztery z nich mają stan `NOT_MEASURED`, "
   "nie `PARTIAL_PASS`). Część wspólna to sześć modułów. **Zanim cokolwiek policzysz, "
   "powiedz, który zbiór bierzesz i dlaczego.** "
   "(2) **Numeral w podtypie nie jest jednostką.** W `02`/`14` `RED_LEGACY_7` liczy siedem "
   "czerwieni; w `05`/`06`/`08` `RED_LEGACY_1_CONFIRMED` liczy jedną potwierdzoną RODZINĘ "
   "przy 19, 14 i 3 czerwieniach na markerze; w `16` `RED_LEGACY_2_CONFIRMED` liczy dwa PLIKI "
   "przy 9 czerwieniach. **Suma numeralów daje 26, a suma czerwieni z treści wierszy — 66.** "
   "Rozjazd 40 przypadków jest realny i jest jednym z Twoich wyników. "
   "(3) **Mutacja w niewłaściwym pliku wygląda jak dowód.** `validateOrgMembership` "
   "(`auth.middleware.ts:1901-1911`) i `requireActiveMembership` "
   "(`legacyCutover/requireActiveMembership.ts:28-36`) mają niemal identyczne zapytanie "
   "i identyczny kod odpowiedzi. Testy montują ten drugi. "
   "(4) **Zmiana mianownika ukrywa się w zielonym wyniku.** Przebieg zmutowany 355 miał "
   "62 przypadki zamiast 68 i był w 100% zielony — bo cały pakiet po prostu nie wystartował. "
   "**Porównuj listy nazw pakietów, nie tylko `numFailedTests`.** "
   "(5) **Baza porównania musi się kompilować.** Klasyfikacja ZASTANA/NOWA na bazie, na której "
   "plik wykonał zero przypadków, jest fałszywa — dokładnie tak powstało „13 plików NOWA” "
   "w dyżurze 286 (marker konfliktu w `PreviewAIHintStrip.tsx:110`). "
   "`Transform failed` i `No test files found` to **BŁĄD KOMENDY**, nie PASS. "
   "(6) **Atrapa bazy kłamie o zapisie** (`Database.ts:686` zwraca `changes:1` dla każdego "
   "`UPDATE` niezależnie od `WHERE`) i **`NODE_ENV=test` bez `RUN_DB_TESTS=1` podstawia atrapę "
   "pod `DbPromise`** — `pg.Pool` widzi wiersz, kod produkcyjny nie. Wszystko, co dotyka "
   "członkostwa, wyłącznie na realnym PostgreSQL. "
   "(7) **`grep --include` w `zsh` zwraca pustkę zamiast wyników** — uruchamiaj przez "
   "`bash -c '…'` i sprawdzaj kod wyjścia; pustka nie jest wynikiem, dopóki nie wiesz, "
   "że komenda się wykonała"
 ),

 "SCIEZKI": (
   "Pakiety FRONTOWE dziesięciu modułów uruchamiasz z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, "
   "`--retry=0 --reporter=json --outputFile=/private/tmp/cx-day363-g15-ile-realne-artefakty/<etykieta>.json`. "
   "Ścieżki pakietów per moduł bierzesz z sekcji `R1` rejestru "
   "`docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` — **nie "
   "wymyślasz ich**; jeżeli dla modułu nie ma ścieżki, zapisujesz `NIEORZECZONY` zamiast "
   "zgadywać (tak zrobił dyżur 336 dla `15_SETTINGS` i to było poprawne). "
   "Pakiety SERWEROWE uruchamiasz z cwd `server/` — uruchomienie z roota bez właściwego "
   "configu daje `No test files found`, co jest BŁĘDEM KOMENDY, nie PASS. "
   "Pakiety broniące bramki członkostwa (`financeValue.membershipGate`, "
   "`financeIntelligence.membershipGate`, `auditsStrictMembership.middleware`) uruchamiasz "
   "**RAZEM, w jednym wywołaniu**, na realnym PostgreSQL, i **sprawdzasz, że mianownik wynosi "
   "68 przypadków w 3 pakietach PRZED i PO mutacją**. Worktree bazowy do klasyfikacji "
   "ZASTANA/REGRESJA zakładasz w "
   "`/private/tmp/cx-day363-g15-ile-realne-artefakty/baza` (POZA repo, kasowany po pomiarze, "
   "`df -h /` przed i po). Porównania po pełnych nazwach (`fullName`), nigdy po liczbach"
 ),

 "TU_WSTAWIASZ_KOMENDY_WERYFIKACJI_STANU_WEJSCIOWEGO": KOMENDY,

 "POZYCJE_RDZENIA": (
   "R0 (twarde zasady: orzekasz, nie naprawiasz; mutacja celuje w strażnika; mianownik "
   "identyczny po obu stronach; wiersz macierzy nietykalny) · "
   "R1 (który zbiór dziesiątki, jednostka podtypu, pełne nazwy czerwieni per wiersz — RDZEŃ) · "
   "R2 (orzeczenie ARTEFAKT/DEFEKT/NIEORZECZONY per wiersz, ze wskazaniem strażnika — RDZEŃ) · "
   "R3 (dowód mutacyjny trafiający we właściwego strażnika, w obie strony — RDZEŃ) · "
   "R4 (tabela dziesięciu wierszy + jawna rekomendacja: co naprawiamy, co dług z numerem decyzji) · "
   "R5 (raport, rozbieżności, pytania do właściciela)"
 ),
}

with open("_instr_src/cfg363.json", "w", encoding="utf-8") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=2)
print("OK cfg363.json", len(cfg), "pol")
