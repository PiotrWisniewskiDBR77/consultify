# INSTRUKCJA DYŻURU nr 363 — Codex — „★★★ G15 — ILE Z DZIESIĘCIU WIERSZY TO REALNY DEFEKT, A ILE ARTEFAKT PRZYRZĄDU. To jest dyżur **ROZSTRZYGAJĄCY, NIE NAPRAWCZY** — decyduje o tym, czy w ogóle warto cokolwiek naprawiać. Dwa dyżury pokazały dziś, że taki licznik potrafi być iluzją: **347** udowodnił, że z 542 czerwieni serwerowych **401 zniknęło po JEDNEJ zmianie** (różnica odtworzona jedną zmienną: `enforce` → 118/0/118, bez niej → 118/118/0); **355** orzekł to samo dla Finansów (114 czerwieni = 114 artefakt / 0 defekt). ★★ ALE odbiorca 355 OBALIŁ jego wniosek, bo **mutacja chybiła celu** — trafiła w `validateOrgMembership` (`auth.middleware.ts:1906`), middleware, którego badane testy NIE MONTUJĄ; prawdziwym strażnikiem jest `server/src/services/legacyCutover/requireActiveMembership.ts` (warunek w linii **34**, `403` w linii 35). Po mutacji WŁAŚCIWEGO warunku: **GREEN 44/44 → RED 33/11 → GREEN 44/44** — pakiet broni bramki. Zadanie: dla KAŻDEGO z dziesięciu wierszy `G15` z podtypem zastanej czerwieni rozstrzygnąć **ARTEFAKT czy REALNY DEFEKT** i podać liczbę, przy czym rozstrzygnięcie musi stać na **mutacji trafiającej we właściwego strażnika**, nie na analogii — a tam, gdzie używasz analogii rodzinnej, masz to powiedzieć wprost i pokazać, na czym stoi"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
poprzednich dyżurów. Wszystko, czego potrzebujesz, jest poniżej albo pod
wskazanymi ścieżkami w repo.

> ### ★★ ZAKAZ NR 1 — KATALOG WŁAŚCICIELA. CZYTASZ TO, ZANIM URUCHOMISZ COKOLWIEK.
>
> **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani
> do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`,
> ani `git fetch`, ani `git worktree add`.
> To brudny checkout właściciela produktu i jest **NIETYKALNY**.
> Jedyny dozwolony kontakt z tą ścieżką to **symlink `node_modules` (odczyt)**
> wg `DEC-2026-08-26-86`.
>
> **★★ TO JEST NAJCZĘSTSZA PRZYCZYNA STRACONEJ GODZINY W TYM PROGRAMIE.**
> Instrukcja dyżuru 53 kazała wykonać `git fetch --all` i `git worktree add`
> „w root-repo" — wykonawca zrobił to w katalogu właściciela, `Z5` zablokowało
> pracę i dyżur stanął na STOP-ie, który nie miał prawa powstać.
> **Dlatego w `§0.1` masz PEŁNĄ, DOSŁOWNĄ procedurę worktree Z VAULTA.**
> Nie improwizuj jej i nie zastępuj „swoim sposobem". Twoje miejsce pracy to
> **wyłącznie** `/private/tmp/cx-day363-g15-ile-realne`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `2a7273e087cbd3e44344725b524f6ddd79d5badc`**
> **Gałąź bazowa: `github-backup/grafika/m03-20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-04.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **BRAMKA ODBIORU `G15` („Integrator self-QA and impacted regression”) — konkretnie **dziesięć wierszy, których podtyp mówi o zastanej czerwieni** (`RED_LEGACY_1`, `RED_LEGACY_2`, `RED_LEGACY_7`, `RED_LEGACY_1_CONFIRMED`, `RED_LEGACY_2_CONFIRMED`, `RED_LEGACY_2_PLUS_RED_NEW_1`) w modułach `02_INTERVIEW`, `03_TOOLS`, `05_INITIATIVES`, `06_EXECUTION`, `07_MY_WORK_AGENT`, `08_MEETINGS`, `10_FINANCE`, `11_MATERIALS`, `14_ADMIN`, `16_PARTNER`. Przedmiotem pracy jest **ORZECZENIE**, nie naprawa: dla każdego wiersza rozstrzygasz, czy czerwień pod nim to **artefakt przyrządu pomiarowego** (jak 401 czerwieni w 347), czy **realny defekt produktu**, i podajesz liczbę. Produktem jest tabela dziesięciu wierszy z dowodem per wiersz oraz **jawna rekomendacja: co naprawiamy, a co przyjmujemy jako dług z numerem decyzji**. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plik postępu `/private/tmp/cx-day363-postep.md` (POZA repo)**.
Trasy front: `Ten dyżur **nie zmienia frontu**. Uruchamia frontowe pakiety testowe dziesięciu modułów, żeby odtworzyć czerwienie **po pełnych nazwach** — to jest odczyt, nie zmiana. Wszystkie pliki `src/**` pozostają `TYLKO ODCZYT` bez wyjątku, także wtedy gdy „wystarczyłaby jedna linijka, żeby test przeszedł”`. Trasy tył: `★★ SEDNO METODY. Strażnik, który ma być celem mutacji tam, gdzie orzekasz ARTEFAKT z powodu bramki członkostwa: `server/src/services/legacyCutover/requireActiveMembership.ts` — **warunek `!== 'ACTIVE'` w linii 34, odpowiedź `403 ORG_MEMBERSHIP_REVOKED` w linii 35** (zmierzone przy wydaniu; instrukcja zlecenia podawała 35 dla warunku — sprawdź sam i zapisz, co zobaczyłeś). **NIE** `server/src/middleware/auth.middleware.ts:1901-1911` — tam mieszka `validateOrgMembership` o niemal identycznym kształcie zapytania, i to jest pułapka, w którą wpadł dyżur 355. Drugi strażnik tej rodziny: `requireFinanceEditorMembership` w TYM SAMYM pliku. Pakiety broniące zabezpieczenia: `server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts` (44 przypadki), `server/src/routes/v8/__tests__/financeIntelligence.membershipGate.pg.test.ts` (6 przypadków), `server/src/middleware/__tests__/auditsStrictMembership.middleware.test.ts` (18 przypadków). **Razem 68 — i to jest mianownik, który MUSI być identyczny w przebiegu bazowym i zmutowanym.** Dyżur 355 miał 68 kontra 62, bo `financeIntelligence` wypadł między A i B, i nikt tego nie zauważył`.

---

### 0.1. ★★ BAZA PRACY, MARKER I GAŁĄŹ — PROCEDURA DOSŁOWNA, Z VAULTA

**Repozytorium, z którego pracujesz, to BARE-vault, a nie checkout właściciela:**

```
/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
```

Vault ma `extensions.worktreeConfig=true`. **To ma konsekwencję operacyjną,
którą MUSISZ obsłużyć — krok (4).**

**PIERWSZE KOMENDY DYŻURU — wklej dokładnie tak, po kolei:**

```bash
VAULT=/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
WT=/private/tmp/cx-day363-g15-ile-realne
MARKER=2a7273e087cbd3e44344725b524f6ddd79d5badc

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day363-g15-ile-realne-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day363-g15-ile-realne/config.worktree"
cat "$VAULT/worktrees/cx-day363-g15-ile-realne/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day363-g15-ile-realne-scratch
mkdir -p /private/tmp/cx-day363-g15-ile-realne-artefakty

# (7) sanity
git -C "$WT" rev-parse HEAD
git -C "$WT" status --short | head -3
```

**Wynik komend (2) i (7) wklejasz do raportu dosłownie.**

> **★★ PUŁAPKA — REMOTE `icloud-source` JEST MARTWY.**
> Vault ma trzy remote'y: `github-backup` (żywy, jedyny Twój),
> `origin` (**zakazany do pushu**, `Z1`) i `icloud-source`, wskazujący na
> nieistniejący katalog `/private/tmp/consultify-staging-deploy-e6ca`.
> **Dlatego NIE WOLNO Ci wołać `git fetch --all`.**
> **Błąd `icloud-source` przy jakimkolwiek fetchu NIE JEST negatywnym wynikiem
> markera i NIE JEST powodem do STOP-u.** Jedynym negatywnym wynikiem markera
> jest napis `MARKER BRAK` z komendy `merge-base` powyżej.

**★★ REGUŁA ROZEJŚCIA (`DEC-2026-08-26-95`).**
Jeżeli marker **nie jest** przodkiem tipa albo gałąź nie istnieje — **STOP
całego dyżuru**. Nie improwizujesz bazy: nie startujesz z `origin/demo`,
`main`, `Londyn`, `codex/preserve-*`, `codex/day*-instrukcja-*` ani z żadnej
gałęzi cudzych dyżurów.

Jeżeli marker **JEST** przodkiem, ale **tip uciekł do przodu — to NIE jest
STOP**. Startujesz **dokładnie z markera**, a do raportu wpisujesz:

```bash
git -C "$VAULT" log --oneline 2a7273e087cbd3e44344725b524f6ddd79d5badc..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 2a7273e087cbd3e44344725b524f6ddd79d5badc..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day363-g15-ile-realne-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 2a7273e087cbd3e44344725b524f6ddd79d5badc..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `osiem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
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
```

---

### §0.4a — pomiar zasięgu testów (warunek oddania raportu, patrz `Z24`)

Zanim ogłosisz jakikolwiek wynik testów, zmierz zasięg PEŁNYMI NAZWAMI, nie liczbami:

1. PRZED zmianami produktu: uruchom pakiet(y) testów wskazane w licencji z
   `--reporter=json` (albo zapisz listę `describe/it` z wyjścia) i zapisz do
   artefaktów plik `przed-nazwy.txt` — po jednej PEŁNEJ nazwie testu na wiersz.
2. PO zmianach: to samo do `po-nazwy.txt`.
3. Do raportu wchodzi: `diff przed-nazwy.txt po-nazwy.txt` — nazwy DODANE (twoje
   nowe testy) i nazwy ZNIKNIĘTE (każda zniknięta = wyjaśnienie albo STOP).
   `N passed` bez nazw NIE jest pomiarem. „Ta sama liczba" przy innym składzie
   nazw to fałszywa zieleń (Z37).
4. Przepisanie liczby z instrukcji, cudzego raportu albo rejestru = zawyżenie
   i podstawa odrzucenia raportu. Liczysz sam, u siebie, na swojej bazie.

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day363-g15-ile-realne-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6434`. Twój JEDYNY port harnessu to `5574`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day363-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki 04.09 — nie dotykasz: 364 (6435/5575), 365 (6436/5576), 366 (6437/5577). Równoległa paczka 359-362 ma zarezerwowany przedział 6430-6433 i 5570-5573 — również nie dotykasz. Starsze rodzeństwo 04.09: 347 (6394/5534), 348 (6395/5535), 349 (6396/5536), 350 (6397/5537), 351 (6410/5550), 352 (6411/5551), 353 (6412/5552), 354 (6413/5553), 355 (6414/5554). Twoje własne wyłącznie: baza 6434, harness 5574. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK NOWYCH FLAG. Ten dyżur nie dodaje ani jednej flagi i nie zmienia wartości domyślnej żadnej istniejącej. ★★ UWAGA SZCZEGÓLNA: `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE`, `ENABLE_TEST_AUTH_BYPASS`, `ENABLE_V8_GLOBAL`, `RUN_DB_TESTS`, `MOCK_DB` **nie są flagami funkcyjnymi produktu** — to przełączniki trybu pomiaru. Wolno Ci nimi sterować W KOMENDZIE POMIAROWEJ i **musisz zapisać, którą wartość miała każda z nich w każdym przebiegu**, bo to jest połowa odpowiedzi na pytanie „artefakt czy defekt”. **Nie wolno Ci zmieniać ich wartości domyślnych w kodzie ani w plikach konfiguracji testów**`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`, `server/src/services/legacyCutover/requireActiveMembership.ts`, `server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts`, `server/src/routes/v8/__tests__/financeIntelligence.membershipGate.pg.test.ts`, `server/src/middleware/__tests__/auditsStrictMembership.middleware.test.ts`. Wszystkie **NIETYKALNE DO ZAPISU** — wolno je wołać w pomiarze i wolno je **tymczasowo zmutować i cofnąć przez `cp`**, nie wolno zostawić w nich ani jednej zmiany w commicie`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY363_G15_ILE_REALNE_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — sekcje doszły dziś do `Z`, więc następne idą `AA`, `AB`, … (literę sprawdzasz komendą tuż przed commitem, nie zakładasz z góry, bo równolegle piszą inni autorzy), oraz nowe pliki dowodowe pod `evidence/g15/day363/` (katalog NIE ISTNIEJE na markerze — tworzysz go). ★★★ **MACIERZ ODBIORU JEST NIETYKALNA W TYM DYŻURZE.** Nie zmieniasz stanu ANI JEDNEGO wiersza `G00`–`G20` w ŻADNYM z 16 modułów — także tego, o którym udowodnisz, że jest nieaktualny. Wierszami zajmują się równolegle dyżury 359-362; Twoim produktem jest ORZECZENIE i rekomendacja, nie wpis. Plik postępu `/private/tmp/cx-day363-postep.md` żyje POZA repo. Nowe pliki w `tests/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day363-g15-ile-realne-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
| `Z14` | **Nie zmieniasz `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz decyzji w kodzie. Uważasz, że decyzja się myli → **errata w raporcie** | SSOT decyzji właściciela |
| `Z15` | **Zero modelu językowego w tym dyżurze.** Żaden pomiar, strażnik ani ekran nie woła `llmService`, `/api/ai/**` ani `GoogleGenerativeAI` | `DEC-51` — zakaz atrapy AI; bezpieczeństwo nie ma prawa zależeć od sieci |
| `Z16` | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych, `503 not_configured`, `null`, `UNKNOWN` ani nagrobków `410`** | „Zero placebo i atrap"; uczciwy `503` jest wzorcem POPRAWNYM |
| `Z17` | **Zakaz wszystkiego poza zakresem tego dyżuru** — z imiennymi licencjami z tabeli licencji | Podział front/tył i rozłączność z dyżurami równoległymi |
| `Z18` | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej:** `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts`, każdy `vitest.*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | Jedna zmiana globalnego mocka fałszuje wynik całego korpusu |
| `Z19` | **Nie odmontowujesz i nie kasujesz żadnego routera, middleware ani joba CI zamontowanego dziś** | Odmontowanie trasy potrafi zabić ekran, którego nie mierzysz; bramki znikają łatwiej, niż wracają |
| `Z20` | **★★ ZAKAZ uruchamiania testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, W TEJ SAMEJ LINII komendy.** Kolejność BLOKU 0 jest wiążąca: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar** | Trzy incydenty zapisu do cudzej bazy |
| `Z21` | **DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`). Pełna ścieżka: realne wejście HTTP → realny `ApiGateway` → `verifyToken` → trasa → handler → zapytanie → **wiersz w Twojej bazie** → odczyt, który ten wiersz podnosi → konsument w `src/` **albo jawne zdanie „brak konsumenta"** | Istnienie kodu ≠ działanie |
| `Z22` | **★★ Test wstrzykujący zależności albo montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). Dowodem jest `ApiGateway.getInstance().initializeRoutes(app)` | Replika rozjeżdża się z produkcją i nikt tego nie zauważa |
| `Z23` | **★★ ZERO ATRAP.** `200` z pustą kopertą tam, gdzie zapytanie padło, jest atrapą. `0` tam, gdzie wartość jest nieznana, jest atrapą. Ekran, który zapisuje do magazynu, którego nikt nie czyta, jest atrapą. Przycisk bez trasy jest atrapą | `DEC-2026-08-25-21/22`, `DEC-51` |
| `Z24` | **Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu.** Zawężony wybór albo **przepisanie cudzej liczby** = zawyżenie i podstawa odrzucenia | Liczby autora instrukcji i nadzorcy krążą po dokumentach i utrwalają się jako „fakt" |
| `Z25` | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener.** `tests/setup.ts` ma bezpiecznik i rzuca błędem zamiast fallbacku | **Port `5432` NASŁUCHUJE i nie jest Twój** — fallback = zapis do cudzych danych |
| `Z26` | **★★ Komplet env w tej samej linii — patrz `§0.2c`.** Bez `MOCK_DB=false` odczyty idą cicho na atrapę bazy; bez `ENABLE_V8_GLOBAL=true` część tras daje `404` **przed uwierzytelnieniem**; bez `ENABLE_TEST_AUTH_BYPASS=false` `verifyToken` **jest omijany** | Tak zginął dzień 23 |
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day363-g15-ile-realne-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | Produkcja NIETYKALNA; demo i staging są jedną bazą. **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur** |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it`, jeśli plik je ustawia | **Historycznie** `vitest.config.ts` ustawiał `retry: CI ? 3 : 1` i to unieważniało całą rodzinę testów izolacji: przy otwartej dziurze pierwszy przebieg realnie zmieniał stan, asercja padała, Vitest ponawiał — i test **raportował `PASS` mimo otwartej dziury** (dowód: `tests/integration/_retrymask/`, archetyp dyżuru 42). **Stan na 04.09: `vitest.config.ts:339` ustawia `retry: 0`, a `server/vitest.config.ts` nie ustawia `retry` wcale.** Zakaz zostaje w mocy — dotyczy `--retry=N` w CLI i `retry` w opcjach `describe`/`it` — ale **nie szukaj tu przyczyny niestabilności**: ponowień w konfiguracji już nie ma |
| `Z30` | **★★ ZAKAZ REALNEJ WYSYŁKI E-MAILI, ZAPROSZEŃ KALENDARZOWYCH I POWIADOMIEŃ.** Przed pierwszym przebiegiem zapisującym **udowodnij w raporcie**, że dostawca poczty jest atrapą — protokół `§0.2b` | Wysłany e-mail i zaproszenie kalendarzowe są **nieodwracalne** i trafiają do skrzynek osób trzecich |
| `Z31` | **★★ ZAKAZ PRZYPINANIA STRAŻNIKA TESTU REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wołasz `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW**, w szczególności bez `expectedDatabase` | Dyżur 43 przypiął strażnik do swojej bazy: po usunięciu kontenera **30 przypadków dowodowych stało się trwałym `SKIP`**, pakiet raportuje `exit 0` i wygląda jak sukces |
| `Z32` | **★★ ZAKAZ WPISU `FIXED` / `VERIFIED` / `ZROBIONE_WG_DoD` BEZ DOWODU MUTACYJNEGO W OBIE STRONY.** Psujesz kod produkcyjny → test **CZERWONY**; cofasz → test **ZIELONY**; `git diff` po cofnięciu **pusty**. Obie komendy i oba wyniki dosłownie w raporcie. Mutację cofasz przez `cp` (`Z27`), nigdy `git stash` | Dyżur 44 wpisał `FIXED` dla podatności, **która nigdy nie istniała** — test przechodził także przed zmianą, bo asercja była tautologią |
| `Z33` | **★★ PRZED KAŻDYM POMIAREM SPRAWDZASZ, CZY STRAŻNIK, KTÓRY MIERZYSZ, NIE WYŁĄCZA SIĘ SAM W TRYBIE TESTOWYM** — ramka `§0.2d` | Na `resultsInternalBetaVisibility.middleware.ts` zmierzono **416 fałszywych twierdzeń** o uprawnieniach jednego modułu |
| `Z34` | **★★ GREP DOWODZI, ŻE ŁAŃCUCH ISTNIEJE, NIE ŻE DZIAŁA.** Zdanie „działa" wolno Ci napisać wyłącznie po realnym żądaniu HTTP przez realny `ApiGateway`, z podpisanym JWT, na realnym Postgresie po pełnych migracjach — **i po zapisaniu KODU ODPOWIEDZI** | 28.08 w module kalendarza zmierzono kompletny łańcuch komponent → `fetch` → trasa → handler → `INSERT`. **Każdy realny `POST` zwracał `500`**, bo `req.db` nigdy nie było ustawiane w tej gałęzi montażu |
| `Z34a` | **★★ PO PIERWSZYM COMMICIE ROBISZ PUSH NA `github-backup`**, a potem po każdej pozycji | 28.08 trzy dyżury pracowały cały dzień bez kopii zapasowej |
| `Z35` | **Zakaz „naprawiania" przez wyciszanie:** `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `.skip`, `.todo`, poszerzanie `exclude`/`testIgnore`, obniżanie progów pokrycia, `--max-warnings`, `continue-on-error: true` na jobie testowym. Uznajesz to za jedyne wyjście → **STOP z uzasadnieniem**, nie cichy commit | To jest choroba, którą program leczy, a nie narzędzie do jej leczenia |
| `Z36` | **Zakaz `eslint --fix` i `prettier --write` na czymkolwiek szerszym niż plik, który i tak zmieniasz z innego powodu.** Zakaz `--fix` na katalogu, na `.`, na globie | Autofix dotknąłby tysięcy plików i skasował pracę **wszystkich** równoległych dyżurów |
| `Z37` | **Porównania testów po NAZWACH przypadków (`fullName`), NIGDY po liczbach.** „Było 300 PASS, jest 300 PASS" nie jest dowodem — jeden test mógł zgasnąć, a drugi się zapalić | Wektor maskowania regresji |
| `Z38` | **Zakaz usuwania i odmontowywania jakiegokolwiek joba CI.** Wolno dodać, wolno poprawić warunek. Usunięcie = STOP z rekomendacją | Bramki znikają łatwiej, niż wracają |
| `Z39` | **Zakaz uruchamiania realnych workflow GitHub Actions** — `gh workflow run`, `gh run rerun`, `act` z realnymi sekretami, push wyzwalający CI na `main`/`develop`/`Londyn`/`demo`. Dowód robisz **statycznie** | Realny przebieg CI dotyka sekretów i środowisk poza Twoją kontrolą |
| `Z40` | ★★★ **ZAKAZ ORZEKANIA „ARTEFAKT” Z ANALOGII BEZ POWIEDZENIA TEGO WPROST.** Najkrótsza droga do wyniku, który wygląda dobrze i jest nic niewart, to napisać „to ten sam kształt co w 347, więc artefakt” dla wszystkich dziesięciu wierszy. Orzeczenie ARTEFAKT jest ważne wtedy i tylko wtedy, gdy **albo** stoi na mutacji trafiającej we właściwego strażnika i pokazującej różnicę, **albo** jest jawnie oznaczone jako `ARTEFAKT_Z_ANALOGII` z podaniem: (a) wiersza wzorcowego, na którym analogia stoi, (b) czym udowodniłeś, że mechanizm jest ten sam, (c) czego NIE zmierzyłeś. ★★ **ZAKAZ MUTACJI, KTÓRA NIE TRAFIA W ZABEZPIECZENIE** (`Z32`): jeżeli mutacja nie czerwieni, sprawdzasz NAJPIERW, czy trafiła w to, co miała trafić — dziś jeden dyżur ogłosił „wymaganie pomiarowo fałszywe”, bo mutował middleware, którego test nie montuje. ★★ **ZAKAZ PORÓWNANIA PO LICZBACH** (`Z37`): „68 zielonych przed, 62 zielone po” **nie jest wynikiem** — to jest zmiana mianownika. Przebieg bazowy i zmutowany muszą mieć **identyczną listę pełnych nazw**, a jeżeli nie mają, to jest to defekt pomiaru i piszesz o tym, zanim cokolwiek orzekniesz. ★★ **ZAKAZ NAPRAWIANIA.** Ten dyżur niczego nie naprawia w produkcie ani w testach. Jeżeli zobaczysz naprawę na jedną linijkę — opisujesz ją jako diff **NIENAŁOŻONY** i idziesz dalej. **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`** (`Z35`). **ZAKAZ zmiany stanu wiersza macierzy odbioru** — patrz sekcja o dokumentach | Bo program stoi przed decyzją, ile pracy tu naprawdę jest. Dyżur 347 pokazał, że licznik 542 zawierał 401 powtórzeń jednej przyczyny. Dyżur 355 orzekł 114 z 114 jako artefakt — i odbiorca to obalił, bo dowód celował w niewłaściwy plik. Dziesięć wierszy `G15` z podtypem zastanej czerwieni jest dziś **jedyną pozostałą niewiadomą tej bramki**: jeżeli to artefakty, zamykamy je długiem i idziemy dalej; jeżeli to defekty, ktoś musi je naprawić przed odbiorem. **Kto zaplanuje naprawy bez tego rozstrzygnięcia, zaplanuje pracę, której nie ma — albo przegapi tę, która jest.** A ponieważ jeden z dwóch dostępnych precedensów okazał się fałszywy, tym razem dowód musi być mocniejszy niż analogia |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ★ **UWAGA — SPROSTOWANIE 2026-08-30.** Ten szkielet wymieniał tu wcześniej
  przełącznik `ENABLE_LIVE_EMAIL`. **Taka flaga NIE ISTNIEJE w kodzie** — `grep`
  po całym `server/src` i `src` daje zero trafień. Był to fantom, powielany
  w każdej wydanej instrukcji. **Nie szukaj go i nie raportuj, że jest wyłączony.**
  Realny warunek wysyłki jest inny i opisany w punkcie (2) poniżej: poczta wychodzi
  wyłącznie wtedy, gdy `emailService.ts:202` zobaczy **jednocześnie** `smtpConfig.host`
  i `smtpConfig.auth.user`, sklejone **najpierw z tabeli `settings`**, dopiero potem
  ze zmiennych środowiskowych. Bez tych dwóch wartości serwis pisze na konsolę;
- ustawić `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_FROM`
  w środowisku, w `.env*`, w `docker-compose*` ani nigdzie indziej;
- wstawić wiersza konfiguracji SMTP do tabeli ustawień w swojej bazie;
- uruchomić serwera pełnym `server/src/index.ts` **na potrzeby testów** — tam
  startują drenaże outboxów; testy montują `ApiGateway`, nie cały serwer
  (`Z22`);
- uruchomić `server/src/index.ts` na potrzeby zrzutów inaczej niż przez
  kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs` i bez spełnienia
  wszystkich warunków z punktu (4) poniżej;
- wywołać ręcznie żadnej funkcji `drain*` / `startNotificationOutboxDrainCron`
  / `outboxWorker`.

**(2) Trzy dowody, które wklejasz do raportu ZANIM uruchomisz cokolwiek
zapisującego:**

```bash
cd /private/tmp/cx-day363-g15-ile-realne

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day363-pg psql -U postgres -d cx363 \
  -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
#   oczekiwane: 0 wierszy. Jezeli tabela `settings` nie istnieje — wklej TEN blad,
#   to tez jest dowod (nie ma skad wziac konfiguracji poczty).

# (c) dla TESTOW: zaden drenaz outboxu nie dziala w procesie testowym
grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
#   oczekiwane: 0 trafien — drenaze startuja w server/src/index.ts, ktorego NIE uruchamiasz
```

**(3) Deklaracja obowiązkowa dla TESTÓW w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane."**

**(4) Wyjątek wyłącznie dla ZRZUTÓW ODBIOROWYCH — pełny produkt, nie replika.**
Pełny `server/src/index.ts` wolno uruchomić wyłącznie przez kanoniczny
`scripts/dev/start-wave3-owner-runtime.mjs`, po wykonaniu dowodów (a) i (b),
oraz tylko gdy wszystkie poniższe warunki są spełnione imiennie:

- runtime pracuje wyłącznie na efemerycznej lokalnej bazie dyżuru pod
  `127.0.0.1`, na zasobach przydzielonych w instrukcji; nie wolno adoptować
  bazy zawierającej jakikolwiek klucz `smtp%`;
- środowisko procesu serwera pochodzi z `childEnv(...)`, ma
  `DOTENV_DISABLED='1'` i nie zawiera `SMTP_*`, `RESEND`, `SENDGRID` ani
  `MAIL*`; trzeba to potwierdzić dla uruchomionego procesu, nie tylko dla
  powłoki wywołującej;
- zapytanie z dowodu (b), wykonane po wszystkich migracjach i seedach, zwraca
  `0` wierszy bezpośrednio przed startem runtime'u;
- nie ustawiasz flag drenaży na `true`, nie wywołujesz żadnego drenażu ręcznie
  i nie wykonujesz żadnej operacji, która tworzy wiadomość, zaproszenie lub
  powiadomienie; runtime służy wyłącznie do odczytu i wykonania zrzutów;
- po starcie ponownie sprawdzasz środowisko należącego do Ciebie procesu oraz
  log serwera. Trafienie konfiguracji poczty, próby realnego transportu albo
  niejednoznaczność dowodu oznacza natychmiastowe zatrzymanie runtime'u i STOP
  całego dyżuru (`Z30`).

Brak konfiguracji nie wyłącza samych drenaży: w runtime z realną bazą startują
one domyślnie. Ochroną jest fail-closed protokół powyżej — `emailService`
tworzy realny transporter dopiero przy jednoczesnej obecności hosta i
użytkownika SMTP; bez nich pozostaje atrapą konsolową. Dowody (a) i (b)
obowiązują zatem zarówno testy, jak i zrzuty odbiorowe.

**Deklaracja obowiązkowa dla ZRZUTÓW ODBIOROWYCH w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane."**

**Ostrzeżenie wsteczne (`DEC-2026-08-29-314`):** dyżury `70`, `72`, `73`,
`76`, `81` i `85` uruchomiły kanoniczny runtime do zrzutów, przez co
sześciokrotnie naruszyły wcześniejsze bezwarunkowe brzmienie `§0.2b`. Do szkody
nie doszło, ponieważ niezależny protokół `Z30` wymagał wykazania, że dostawca
poczty jest atrapą. To ostrzeżenie nie znosi zakazu ani nie zastępuje dowodów.

---

### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — TRZY WARIANTY, ZAWSZE W JEDNEJ LINII

**Zmienna postawiona `export`-em wcześniej NIE LICZY SIĘ.** `vitest.config.ts`
przybija część wartości (`DB_TYPE='sqlite'`), więc komplet musi stać
**w tej samej linii komendy** — i masz **udowodnić, że nadpisał**, a nie założyć.

**(A) MIGRACJE — pełny łańcuch, przed jakimkolwiek pomiarem (`Z20`):**

```bash
cd /private/tmp/cx-day363-g15-ile-realne

docker run -d --name cx-day363-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx363 \
  -p 127.0.0.1:6434:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day363-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6434/cx363 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6434/cx363 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day363-g15-ile-realne && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6434/cx363 \
JWT_SECRET=cx363-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Pakiety FRONTOWE dziesięciu modułów uruchamiasz z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day363-g15-ile-realne-artefakty/<etykieta>.json`. Ścieżki pakietów per moduł bierzesz z sekcji `R1` rejestru `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` — **nie wymyślasz ich**; jeżeli dla modułu nie ma ścieżki, zapisujesz `NIEORZECZONY` zamiast zgadywać (tak zrobił dyżur 336 dla `15_SETTINGS` i to było poprawne). Pakiety SERWEROWE uruchamiasz z cwd `server/` — uruchomienie z roota bez właściwego configu daje `No test files found`, co jest BŁĘDEM KOMENDY, nie PASS. Pakiety broniące bramki członkostwa (`financeValue.membershipGate`, `financeIntelligence.membershipGate`, `auditsStrictMembership.middleware`) uruchamiasz **RAZEM, w jednym wywołaniu**, na realnym PostgreSQL, i **sprawdzasz, że mianownik wynosi 68 przypadków w 3 pakietach PRZED i PO mutacją**. Worktree bazowy do klasyfikacji ZASTANA/REGRESJA zakładasz w `/private/tmp/cx-day363-g15-ile-realne-artefakty/baza` (POZA repo, kasowany po pomiarze, `df -h /` przed i po). Porównania po pełnych nazwach (`fullName`), nigdy po liczbach --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day363-g15-ile-realne-artefakty/day363-g15-ile-realne.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day363-g15-ile-realne && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Pakiety FRONTOWE dziesięciu modułów uruchamiasz z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day363-g15-ile-realne-artefakty/<etykieta>.json`. Ścieżki pakietów per moduł bierzesz z sekcji `R1` rejestru `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` — **nie wymyślasz ich**; jeżeli dla modułu nie ma ścieżki, zapisujesz `NIEORZECZONY` zamiast zgadywać (tak zrobił dyżur 336 dla `15_SETTINGS` i to było poprawne). Pakiety SERWEROWE uruchamiasz z cwd `server/` — uruchomienie z roota bez właściwego configu daje `No test files found`, co jest BŁĘDEM KOMENDY, nie PASS. Pakiety broniące bramki członkostwa (`financeValue.membershipGate`, `financeIntelligence.membershipGate`, `auditsStrictMembership.middleware`) uruchamiasz **RAZEM, w jednym wywołaniu**, na realnym PostgreSQL, i **sprawdzasz, że mianownik wynosi 68 przypadków w 3 pakietach PRZED i PO mutacją**. Worktree bazowy do klasyfikacji ZASTANA/REGRESJA zakładasz w `/private/tmp/cx-day363-g15-ile-realne-artefakty/baza` (POZA repo, kasowany po pomiarze, `df -h /` przed i po). Porównania po pełnych nazwach (`fullName`), nigdy po liczbach --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day363-g15-ile-realne-artefakty/day363-g15-ile-realne.json
```

**To NIE jest naruszenie `Z26`, tylko warunek `Z25`:** bez `DATABASE_URL`
`tests/setup.ts` rzuciłby błędem przy `RUN_DB_TESTS=1`.
**Nigdy nie mieszasz: pakiet jednostkowy NIE jest dowodem egzekucji.**

**Znaczenie każdej zmiennej — musisz je znać, zanim ją wpiszesz:**

| Zmienna | Co się stanie, gdy jej zabraknie |
| --- | --- |
| `RUN_DB_TESTS=1` | `tests/setup.ts` pomija testy bazodanowe; pakiet raportuje `exit 0` |
| `MOCK_DB=false` | odczyty idą **cicho** na atrapę bazy, zapisy nigdzie nie lądują |
| `DB_TYPE=postgres` | `vitest.config.ts` przybija `sqlite` — mierzysz inny silnik, niż myślisz |
| `NODE_ENV=test` | runner migracji odmawia albo zwraca MOCK przy bazie lokalnej |
| `ENABLE_V8_GLOBAL=true` | część tras daje **fałszywe `404` PRZED uwierzytelnieniem** |
| `ENABLE_TEST_AUTH_BYPASS=false` | **`verifyToken` JEST OMIJANY** — każdy test uwierzytelniania przechodzi z fałszywego powodu |
| `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` | strażnik przepuszcza wszystko przy `NODE_ENV=test` (416 fałszywych twierdzeń) |
| `DATABASE_URL` | fallback na `localhost:5432`, który **nasłuchuje i nie jest Twój** |
| `JWT_SECRET` | podpisany JWT nie przejdzie przez `verifyToken`; dostaniesz `401` z niewłaściwego powodu |
| `--retry=0` | test „atak odrzucony" **leczy się skutkiem własnego ataku** i raportuje `PASS` |

---

### 0.2d. ★★ ZNANE PUŁAPKI ŚRODOWISKA — OSIEMNAŚCIE, KAŻDA KOSZTOWAŁA GODZINY

**Czytaj to, ZANIM uznasz cokolwiek za zepsute.**

1. **Vault jest BARE + `extensions.worktreeConfig=true`.** Po `git worktree add`
   **musisz** utworzyć `<vault>/worktrees/cx-day363-g15-ile-realne/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day363-pg psql -U postgres -d cx363 -c '…'`.
4. **Runner migracji wymaga `NODE_ENV=test` przy bazie lokalnej.** Bez tego
   strażnik localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
   (`server/scripts/migrate.postgres.ts:640-650`).
5. **`vitest.config.ts` (ok. `:209-210`) twardo ustawia `test.env.DB_TYPE='sqlite'`.**
   Zmienna z powłoki bywa nadpisywana — `DB_TYPE=postgres` musi stać
   **w tej samej linii komendy**, a Ty **udowadniasz w raporcie, że nadpisało**
   (asercja `expect(process.env.DB_TYPE).toBe('postgres')` w pierwszym `it`
   każdego nowego pakietu). Pliku **nie zmieniasz** (`Z18`).
6. **`JSON.parse` na kolumnie typu `json` działa na SQLite i wywala `500` na
   PostgreSQL** — sterownik `pg` zwraca już zdeserializowany obiekt. Jeżeli
   kolumny są `TEXT`, kształt `500` nie występuje, ale występuje kształt
   **cichej utraty danych**. Każdy `500` widoczny na PG a nie na SQLite sprawdź
   najpierw pod tym kątem (`DEC-2026-08-28-245`).
7. **CI NIE URUCHAMIA TESTÓW dla naszych gałęzi.** Joby `test-suite.yml` są
   warunkowane na `main`/`develop`, a my jesteśmy na `Londyn`/`demo`;
   `lint-typecheck` pada na zastanych błędach `tsc`, a `pr-gate` czyta wynik
   pominiętego joba jako sukces (`DEC-2026-08-28-246`). **„CI zielone" nie jest
   w tym repo żadnym dowodem.** Dowodem jest wyłącznie Twój przebieg z `--retry=0`.
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day363-pg`.
9. **Reporter `basic` NIE ISTNIEJE w tej wersji vitest** (`--reporter=basic` →
   `Failed to load custom Reporter from basic`). Do porównania nazw używasz
   `--reporter=json --outputFile=<plik poza repo>`.
10. **`npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów** przy
    przekierowaniu wyjścia. **Nie ufaj kodowi wyjścia** — liczby i nazwy czytasz
    z JSON-a.
11. **Nowe pliki w `tests/` wymagają `git add -f`** (katalog bywa ignorowany
    częściowo). Sprawdzasz `git status --short` po każdym commicie.
12. **`| head` na grepie sierot produkuje FAŁSZYWE SIEROTY.** Werdykt „martwy
    komponent" wymaga grepu **bez obcięcia**, z wykluczeniem `__tests__`
    i komentarzy.
13. **ESM nie honoruje `NODE_PATH`.** Skrypt `.mjs` uruchamiany spoza repo nie
    znajdzie pakietów — rozwiązuj je przez `createRequire(REPO + '/package.json')`.
14. **Na remote `github-backup` NIE MA gałęzi `main`, `develop`, `Londyn` ani
    `demo`** — są na `origin` (`origin/develop` **stoi od 2026-06-02**).
    Pracujemy na linii `Londyn`/`demo`.
15. **`postgres:15` NIE PRZECHODZI migracji** — brak rozszerzenia `vector`.
    Obraz obowiązkowy: `pgvector/pgvector:pg16`.
16. **`prettier` na wielkich plikach potrafi przepisać cały plik.** W repo
    **nie ma** skryptu `format` — wołasz `npx prettier --write <pliki>` wprost.
    Jeżeli wynik reformatu przekracza ~3× liczbę Twoich linii merytorycznych —
    **cofasz reformat** (`cp` z kopii wg `Z27`, nigdy `git stash`), zostawiasz
    styl zastany i wpisujesz to do raportu.
17. **Istnieją testy tekstowe przez `readFileSync` + `toContain`,** które
    asertują **dosłowne linie kodu**. Reformat takiej linii wywala test.
    Jeżeli test zapali się od Twojego reformatu — **to jest regresja Twojego
    reformatu, nie „test do poprawienia"**: cofasz reformat.
18. **`npx vitest` z roota bez właściwego configu daje `No test files found`.**
    To **nie jest `PASS`** — to jest brak pomiaru.

---

> **★★ RAMKA DO `Z33` — PUŁAPKI, KTÓRE FAŁSZUJĄ ZIELONY PRZEBIEG.**
> **Zielona suita w tym repozytorium NIE JEST DOWODEM, dopóki nie wiesz, którą
> pułapkę omija.**
>
> **(a) `ENABLE_V8_GLOBAL` nieustawione → fałszywe `404` PRZED uwierzytelnieniem.**
> `server/src/middleware/v8FeatureGate.middleware.ts:15` czyta
> `process.env.ENABLE_V8_GLOBAL === 'true'`; przy braku zmiennej bramka odcina
> trasę **zanim** cokolwiek sprawdzi tożsamość. Twój test „obcy tenant dostaje
> `404`" przechodzi wtedy z całkiem innego powodu, niż myślisz.
>
> **(b) `resultsInternalBetaVisibility.middleware.ts` przepuszcza wszystko przy
> `NODE_ENV=test`,** dopóki nie ustawisz
> `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. **Na tym strażniku
> zmierzono 416 fałszywych twierdzeń o uprawnieniach.**
>
> **(c) `vitest.config.ts` twardo ustawia `test.env.DB_TYPE='sqlite'`.** Część
> „testów bazodanowych" idzie na atrapę. `MOCK_DB=false DB_TYPE=postgres`
> w tej samej linii to jedyne wyjście; pliku nie zmieniasz (`Z18`).
>
> **(d) `ENABLE_TEST_AUTH_BYPASS`.** `server/src/middleware/auth.middleware.ts`
> zawiera gałąź: `if (NODE_ENV === 'test' && ENABLE_TEST_AUTH_BYPASS === 'true')`
> — czyli **`verifyToken` potrafi wyłączyć się sam w trybie testowym**.
>
> **(e) ★★★ **SIEDEM PUŁAPEK.** (1) **Dwa rozłączne zbiory po dziesięć.** Wierszy `PARTIAL_PASS` jest dziesięć (cztery z nich mają podtyp `SERVER_NOT_MEASURED`, nie `RED_LEGACY`), a wierszy z podtypem `RED_LEGACY_*` też dziesięć (cztery z nich mają stan `NOT_MEASURED`, nie `PARTIAL_PASS`). Część wspólna to sześć modułów. **Zanim cokolwiek policzysz, powiedz, który zbiór bierzesz i dlaczego.** (2) **Numeral w podtypie nie jest jednostką.** W `02`/`14` `RED_LEGACY_7` liczy siedem czerwieni; w `05`/`06`/`08` `RED_LEGACY_1_CONFIRMED` liczy jedną potwierdzoną RODZINĘ przy 19, 14 i 3 czerwieniach na markerze; w `16` `RED_LEGACY_2_CONFIRMED` liczy dwa PLIKI przy 9 czerwieniach. **Suma numeralów daje 26, a suma czerwieni z treści wierszy — 66.** Rozjazd 40 przypadków jest realny i jest jednym z Twoich wyników. (3) **Mutacja w niewłaściwym pliku wygląda jak dowód.** `validateOrgMembership` (`auth.middleware.ts:1901-1911`) i `requireActiveMembership` (`legacyCutover/requireActiveMembership.ts:28-36`) mają niemal identyczne zapytanie i identyczny kod odpowiedzi. Testy montują ten drugi. (4) **Zmiana mianownika ukrywa się w zielonym wyniku.** Przebieg zmutowany 355 miał 62 przypadki zamiast 68 i był w 100% zielony — bo cały pakiet po prostu nie wystartował. **Porównuj listy nazw pakietów, nie tylko `numFailedTests`.** (5) **Baza porównania musi się kompilować.** Klasyfikacja ZASTANA/NOWA na bazie, na której plik wykonał zero przypadków, jest fałszywa — dokładnie tak powstało „13 plików NOWA” w dyżurze 286 (marker konfliktu w `PreviewAIHintStrip.tsx:110`). `Transform failed` i `No test files found` to **BŁĄD KOMENDY**, nie PASS. (6) **Atrapa bazy kłamie o zapisie** (`Database.ts:686` zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE`) i **`NODE_ENV=test` bez `RUN_DB_TESTS=1` podstawia atrapę pod `DbPromise`** — `pg.Pool` widzi wiersz, kod produkcyjny nie. Wszystko, co dotyka członkostwa, wyłącznie na realnym PostgreSQL. (7) **`grep --include` w `zsh` zwraca pustkę zamiast wyników** — uruchamiaj przez `bash -c '…'` i sprawdzaj kod wyjścia; pustka nie jest wynikiem, dopóki nie wiesz, że komenda się wykonała**
>
> **Obowiązek dowodowy.** Dla **każdego** pakietu uruchomionego jako dowód
> czegokolwiek raport zawiera akapit: *która z pułapek (a)–(e) dotyczy tego
> pakietu, jak ją wyłączyłem, i co konkretnie dowodzi, że wyłączyłem*.
> Akapit „nie dotyczy" jest dopuszczalny **tylko** z komendą pokazującą, że dany
> strażnik nie leży na ścieżce. **Pomiar bez tego akapitu nie liczy się jako dowód.**

---

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości MERYTORYCZNEJ: STOP tej POZYCJI i wpis
w raporcie — nigdy improwizacja. W tym programie zasadny STOP jest NAGRADZANY,
a zgadywanie karane** (dzień 23 dostał `SUPERVISOR_ACCEPT` za STOP,
`DEC-2026-08-26-130`).

**Rozróżnij dwa rodzaje:**

- **STOP MERYTORYCZNY** (mile widziany): zmierzyłeś i wyszło inaczej, niż mówi
  ta instrukcja; brakuje informacji, której nikt poza właścicielem nie
  dostarczy; naprawa wymaga decyzji produktowej. **Wpisujesz do raportu
  i IDZIESZ DALEJ do następnej pozycji.**
- **STOP PROCEDURALNY** (zakazany): „instrukcja jest sprzeczna", „ścieżka nie
  istnieje", „nie mam licencji na plik". **Ten rodzaj NIE zatrzymuje niczego** —
  patrz tabela niżej i sekcja końcowa.

### ★★ TABELA: STOP PROCEDURALNY ZAKAZANY — DZIAŁANIE ZASTĘPCZE

| Powód, dla którego chciałbyś stanąć | Co robisz ZAMIAST STOP-u |
| --- | --- |
| „Musiałbym zmienić plik przekrojowy (`auth.middleware.ts` / `Gateway.ts` / bramkę platformową)" | **Czerwony kontrakt testowy + brief wynikowy** (tabela licencji, wiersz 1). Pozycja jest wtedy **ZROBIONA**, nie STOP |
| „Plik, którego potrzebuję, nie jest w tabeli licencji" | Traktujesz go jako **tylko do odczytu** i dajesz czerwony kontrakt + brief. Pozycja **ZROBIONA** |
| „Instrukcja jest wewnętrznie sprzeczna" | Sekcja **„JEŚLI COŚ JEST SPRZECZNE"** na końcu dokumentu. Wybierasz interpretację **bezpieczniejszą**, opisujesz w „Korektach", **kontynuujesz pozostałe pozycje** |
| „Ścieżka podana w instrukcji nie istnieje" | Sprawdzasz `ls`, wpisujesz **swój wynik** do „Korekt", szukasz realnego odpowiednika i **idziesz dalej**. Rozbieżność pomiaru z instrukcją **nie jest sprzecznością — jest WYNIKIEM** |
| „Instrukcja podaje dwie różne liczby" | Mierzysz sam, podajesz **swoją** liczbę z komendą (`Z24`). To **nie jest** powód do STOP-u |
| „`git fetch` zwrócił błąd `icloud-source`" | To **nie jest** błąd. `§0.2d` pkt 2. Idziesz dalej |
| „`psql` nie istnieje na hoście" | `docker exec cx-day363-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day363-g15-ile-realne-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: orzekasz, nie naprawiasz; mutacja celuje w strażnika; mianownik identyczny po obu stronach; wiersz macierzy nietykalny) · R1 (który zbiór dziesiątki, jednostka podtypu, pełne nazwy czerwieni per wiersz — RDZEŃ) · R2 (orzeczenie ARTEFAKT/DEFEKT/NIEORZECZONY per wiersz, ze wskazaniem strażnika — RDZEŃ) · R3 (dowód mutacyjny trafiający we właściwego strażnika, w obie strony — RDZEŃ) · R4 (tabela dziesięciu wierszy + jawna rekomendacja: co naprawiamy, co dług z numerem decyzji) · R5 (raport, rozbieżności, pytania do właściciela)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6434` albo `5574` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6434` albo `5574`** (`Z7`).

Format wpisu STOP:

```
### STOP — <pozycja>
Rodzaj: MERYTORYCZNY / PROCEDURALNY
Powód: <jedno zdanie>
Licencja, którą sprawdziłem: <cytat wiersza z tabeli licencji + wynik>
Dowód: <plik:linia albo komenda + wynik>
Co dostarczyłem ZAMIAST zmiany: <czerwony kontrakt / pomiar / gotowy diff / brief>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Rekomendacja dla nadzorcy: <co zmienić, gdzie, jaki promień rażenia>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
Czy kontynuowałem pozostałe pozycje: TAK / NIE + dlaczego
```

**★★ STOP bez wypełnionego pola „Licencja, którą sprawdziłem" jest NIEZASADNY
z definicji. STOP bez wypełnionego pola „Co dostarczyłem ZAMIAST zmiany" jest
NIEZASADNY z definicji.**

---

## ★★ JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE LUB NIEWYKONALNE

**Ta instrukcja była pisana i sprawdzana przez człowieka i model. Może mieć
błędy. Nie zatrzymuj przez nie dyżuru.**

**Procedura, dosłownie:**

1. **Opisz sprzeczność w raporcie**, w sekcji „Korekty wobec instrukcji":
   **cytat obu wykluczających się zdań z numerami paragrafów**, na czym polega
   konflikt, jaki masz dowód i co zrobiłeś.
2. **Wybierz interpretację BEZPIECZNIEJSZĄ.** Reguły rozstrzygające,
   w tej kolejności:
   - **nie ruszaj cudzego pliku** — gdy nie wiesz, czy masz licencję, **nie
     masz**; traktuj plik jako tylko do odczytu i dostarcz czerwony kontrakt
     + brief;
   - **nie osłabiaj asercji** — gdy test przeszkadza, opisujesz go, nie
     zmieniasz;
   - **nie kasuj** — gdy werdykt jest niepewny, wpisz `DO DECYZJI WŁAŚCICIELA`
     ze zdaniem **„czego konkretnie mi zabrakło, żeby rozstrzygnąć
     samodzielnie"** (wiersz bez tego zdania liczy się jako nierozstrzygnięty);
   - **nie włączaj** — gdy nie wiesz, czy flaga ma być `ON`, zostaje `OFF`
     (`Z10`/`Z11`);
   - **nie wysyłaj niczego na zewnątrz** — gdy nie masz pewności co do `Z30`,
     nie klikasz;
   - **nie poszerzaj dostępu** — gdy bramka jest niejednoznaczna, **odmawiasz
     zamiast przepuszczać**;
   - **mierz zamiast zgadywać** — gdy instrukcja podaje liczbę, a Twój pomiar
     daje inną, **wiążący jest Twój pomiar z komendą** (`Z24`).
3. **KONTYNUUJESZ POZOSTAŁE POZYCJE.** Sprzeczność w jednym paragrafie nie
   zwalnia z pozostałych ani z raportu.
4. **Zatrzymanie CAŁEGO dyżuru** — wyłącznie z pięciu powodów wymienionych
   w `§0.5`.
5. **Nigdy nie „naprawiaj" instrukcji przez improwizację w kodzie.**
   Sprzeczność w dokumencie rozwiązuje się **wpisem w raporcie**, nie zmianą
   w produkcie.
6. **★ Rozbieżność między pomiarem a tą instrukcją NIE JEST sprzecznością —
   jest WYNIKIEM.** Każda liczba, linia i teza w tym dokumencie to **rozkaz
   pomiarowy**, nie prawda objawiona.

**★ Trzy najcenniejsze rzeczy, jakie możesz oddać:** dowód, że coś, co uchodziło
za działające, nie działa; dowód, że coś, co uchodziło za zepsute, jest sprawne;
i uczciwe zdanie „tego nie zmierzyłem, bo…".

**★ Ostatnie zdanie tej instrukcji i najważniejsze: obalenie którejkolwiek tezy
z sekcji „TEZY ZLECENIA…" jest SUKCESEM dyżuru, a nie porażką. Zapisz to
w „Korektach wobec instrukcji" z dowodem i idź dalej.**

---

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
