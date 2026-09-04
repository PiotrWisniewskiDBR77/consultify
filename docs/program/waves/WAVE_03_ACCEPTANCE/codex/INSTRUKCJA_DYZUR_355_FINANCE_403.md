# INSTRUKCJA DYŻURU nr 355 — Codex — „★★★ FINANSE: DRUGA PRZYCZYNA CZERWIENI SERWEROWYCH — 114 CZERWIENI `10_FINANCE`, KTÓRYCH DYŻUR 347 NIE RUSZYŁ. Dyżur 347 rozstrzygnął 401 z 542 czerwieni serwerowych: były **artefaktem przyrządu**, nie defektami produktu (pomiar wymuszał `enforce` na izolowanych kontraktach tras, które podmieniają middleware i nie mają wiersza `organization_members`). Gałąź 347 nie zmieniła ani jednego pliku kodu produktu. ★★ ALE teza „415 z 415 to jedna przyczyna" została **OBALONA DLA FINANSÓW**: w `10_FINANCE` zostaje **114 czerwieni**, a mój pomiar z artefaktów `evidence/g15/day347/r4-10-finance-serwer.json` pokazuje, że jest ich **dokładnie tyle samo co przed naprawą 347 (277 total / 114 fail przed i po)** — naprawa Results nie tknęła Finansów. ★★ Zadanie: rozstrzygnąć DRUGĄ przyczynę **tą samą metodą, którą 347 rozstrzygnął pierwszą** — znaleźć JEDNO źródło, nie naprawiać po jednym teście — i **jawnie rozdzielić, ile z tych 114 to artefakt pomiaru, a ile realny defekt produktu**. To rozróżnienie jest CAŁĄ wartością tego dyżuru. ★ ZAKAZ wygaszenia zabezpieczenia: wymagana para „obcy dostaje odmowę / właściciel dostaje dane" na realnym łańcuchu HTTP i dowód mutacyjny celujący w SAMO ZABEZPIECZENIE. Naprawa przez rozluźnienie uprawnień = odrzucenie dyżuru"

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
> **wyłącznie** `/private/tmp/cx-day355-finance-403`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `c0f690bae36a386de27f1a349fbb9674ec03c693`**
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
Zakres: **PRZEKROJOWE — warstwa serwerowa modułu `10_FINANCE` (tam mieszka 114 czerwieni, których dyżur 347 nie ruszył), z kontrolnym przelotem po `09_RESULTS`, żeby udowodnić, że Twoja naprawa nie zgasiła tego, co 347 naprawił. Przedmiotem pracy jest **JEDNA przyczyna źródłowa** i **jawny podział 114 czerwieni na ARTEFAKT POMIARU i REALNY DEFEKT PRODUKTU**. Porównania WYŁĄCZNIE po pełnych nazwach przypadków (`fullName`), nigdy po liczbach. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plikiem postępu `/private/tmp/cx-day355-postep.md` (poza repo)**.
Trasy front: `Ten dyżur **nie dotyka frontu**. Jedyny kontakt z `src/`: odczyt, gdyby czerwień serwerowa okazała się skutkiem kontraktu UI — wtedy piszesz o tym w raporcie i idziesz dalej. Pliki frontowe pozostają `TYLKO ODCZYT` bez wyjątku`. Trasy tył: `★★ SEDNO. Bramka, która produkuje kod `ORG_MEMBERSHIP_REVOKED`: `server/src/middleware/auth.middleware.ts` (wiersz **1910** — `403 ORG_MEMBERSHIP_REVOKED`, gdy `SELECT status FROM organization_members WHERE user_id = ? AND organization_id = ?` nie daje wiersza `ACTIVE`; wiersz **1922-1926** — `catch` → `503 ORG_MEMBERSHIP_LOOKUP_UNAVAILABLE`; wcześniejsze wyjścia: super-admin ok. 1884, zaufana sesja demo ok. 1894). Pakiety, które padają: `server/src/routes/v8/finance-v2/__tests__/**` (12 plików z czerwienią) oraz `server/src/services/finance/__tests__/**`. Trasy produktu, które te testy montują: `server/src/routes/v8/finance-v2/*.routes.ts` przez realny `server/src/services/ApiGateway.ts`. Osobny, WŁASNY dowód bramki członkostwa: `server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts`, `server/src/routes/v8/__tests__/financeIntelligence.membershipGate.pg.test.ts`, `server/src/middleware/__tests__/auditsStrictMembership.middleware.test.ts` — **to jest miejsce, w którym zabezpieczenie ma być bronione, i ono musi zostać zielone po Twojej pracy**`.

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
WT=/private/tmp/cx-day355-finance-403
MARKER=c0f690bae36a386de27f1a349fbb9674ec03c693

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day355-finance-403-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day355-finance-403/config.worktree"
cat "$VAULT/worktrees/cx-day355-finance-403/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day355-scratch
mkdir -p /private/tmp/cx-day355-finance-403-artefakty

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
git -C "$VAULT" log --oneline c0f690bae36a386de27f1a349fbb9674ec03c693..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only c0f690bae36a386de27f1a349fbb9674ec03c693..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day355-finance-403-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only c0f690bae36a386de27f1a349fbb9674ec03c693..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: artefakty 336 i 347 sa w REPO, nie w katalogu tymczasowym
ls evidence/g15/day336-artefakty/*-serwer.json | grep -vc baza
ls evidence/g15/day347/*.json | wc -l
#   moje liczby: 15 plikow '<modul>-serwer.json' (336) oraz 20 plikow JSON w day347/

# (2) ★★ TEZA ROZSTRZYGAJACA: naprawa 347 NIE TKNELA Finansow — przed i po sa identyczne
node -e "const fs=require('fs');for(const [l,p] of [['PRZED-336','evidence/g15/day336-artefakty/10-finance-serwer.json'],['PO-347','evidence/g15/day347/r4-10-finance-serwer.json']]){const j=JSON.parse(fs.readFileSync(p,'utf8'));console.log(l,'numTotalTests',j.numTotalTests,'numPassedTests',j.numPassedTests,'numFailedTests',j.numFailedTests);}"
#   moje liczby: obie linie identyczne — numTotalTests 277 · numPassedTests 143 · numFailedTests 114

# (3) ★★★ TEZA, KTORA SAM SOBIE OBALILEM — sprawdz ja przede mna
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('evidence/g15/day336-artefakty/10-finance-serwer.json','utf8'));const m=[];for(const t of j.testResults)for(const a of t.assertionResults)if(a.status==='failed')m.push((a.failureMessages||[]).join(' '));const h=r=>m.filter(x=>r.test(x)).length;console.log('fail',m.length,'| zawiera 403:',h(/403/),'| ORG_MEMBERSHIP_REVOKED:',h(/ORG_MEMBERSHIP_REVOKED/),'| expected 403 to be:',h(/expected 403 to be/),'| TypeError:',h(/TypeError/));"
#   moje liczby: fail 114 · zawiera 403: 79 · ORG_MEMBERSHIP_REVOKED: 20 · expected 403 to be: 59 · TypeError: 31
#   ★★ ZLECENIE NADZORCY MOWILO „59 z kodem 403 wskazuje ORG_MEMBERSHIP_REVOKED". TO JEST FALSZ i sam to
#   zmierzylem: 59 to ksztalt 'expected 403 to be X' BEZ zadnego kodu w komunikacie, a ORG_MEMBERSHIP_REVOKED
#   wystepuje w 20 innych przypadkach. To dwa ROZLACZNE kubelki, nie jeden. Potwierdz to albo obal.

# (4) ★★★ TROP GLOWNY — bramka, ktora zwraca ORG_MEMBERSHIP_REVOKED
sed -n '1898,1928p' server/src/middleware/auth.middleware.ts
#   oczekiwane: SELECT status FROM organization_members ... -> brak wiersza ACTIVE -> 403 ORG_MEMBERSHIP_REVOKED;
#   catch -> 503 ORG_MEMBERSHIP_LOOKUP_UNAVAILABLE

# (5) ★★★ TROP DRUGI — SEPARACJA IDEALNA: kazdy plik, ktory sadzi wiersz czlonkostwa, jest ZIELONY
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('evidence/g15/day336-artefakty/10-finance-serwer.json','utf8'));for(const t of j.testResults){let tot=0,f=0;for(const a of t.assertionResults){tot++;if(a.status==='failed')f++;}const rel=t.name.replace(/^.*?(server\/src.*)$/,'\$1');let s='BRAK-PLIKU';try{s=fs.readFileSync(rel,'utf8').includes('organization_members')?'TAK':'NIE';}catch(e){}console.log(String(f).padStart(3),'/',String(tot).padStart(3),'seed_organization_members='+s,rel.split('/').pop());}"
#   moje liczby: WSZYSTKIE 10 plikow z seed=TAK maja 0 czerwieni; WSZYSTKIE 12 plikow z czerwienia maja seed=NIE
#   (approveRbacGate 20/20, comments 18/24, saved-views 17/17, artifacts-lifecycle-compute 15/15,
#    valuation-cross-tenant 11/11, pkg-b2-cross-tenant 9/9, compare 7/17, valuation-b3-review 6/6,
#    crosscutting 5/5, models 3/3, valuation-independent-verifier 2/2, day116-...-wacc-conflict 1/1)

# (6) TEZA: bramka ma WLASNY dowod, ktory po Twojej pracy MUSI zostac zielony
ls server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts
ls server/src/routes/v8/__tests__/financeIntelligence.membershipGate.pg.test.ts
ls server/src/middleware/__tests__/auditsStrictMembership.middleware.test.ts
#   oczekiwane: trzy pliki istnieja

# (7) TEZA: dyzur 347 NIE nazwal przyczyny Finansow — to jest praca nowa
bash -c "grep -n 'ORG_MEMBERSHIP_REVOKED' docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY347_403_PRZYCZYNA_REPORT.md" ; echo "kod grepa=$?"
#   oczekiwane: JEDNO trafienie (wiersz 43) — 347 nazwal to kaskada i poszedl dalej, przyczyny nie wskazal

# (8) TEZA: liscie slownikow i bramki kanonu na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35198 · en 33065 · wszystkie cztery bramki = 0
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day355-finance-403-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6414`. Twój JEDYNY port harnessu to `5554`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day355-pg`**. **ZAKAZANE:** `porty `5555`/`6415` (dyżur 356), `5556`/`6416` (dyżur 357), `5557`/`6417` (dyżur 358) oraz WSZYSTKIE porty spoza pary `5554`/`6414`; kontenery `cx-day356-pg`, `cx-day357-pg`, `cx-day358-pg` i każdy inny `cx-day*-pg``. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur nie zamawia ani jednej flagi funkcyjnej. `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE` NIE jest flagą produktu, tylko przełącznikiem trybu pomiaru czytanym wyłącznie pod `NODE_ENV==='test'`: wolno nim sterować w komendzie, NIE WOLNO zmieniać warunku w kodzie`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**` (w tym `auth.middleware.ts`, `auditsStrictMembership.middleware.ts`, `resultsInternalBetaVisibility.middleware.ts`), `server/src/services/ApiGateway.ts`, `server/src/routes/v8/index.ts`, `server/src/schemas/**`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY355_FINANCE_403_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE wiersz `G15` i WYŁĄCZNIE pod twardym warunkiem z `R0`: wiersz zmienia stan tylko razem z dowodem w TYM SAMYM commicie. Dodatkowo: dopisanie sekcji „Aktualizacja dyżuru 355" do `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` (dopisanie, nigdy nadpisanie), nowe pliki dowodowe pod `evidence/g15/day355/` (katalog NIE ISTNIEJE na markerze — tworzysz go, `git add -f`) oraz jedna nowa sekcja w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze (sekcje doszły dziś do `Q`, ale równolegle dopisują inni autorzy — literę sprawdzasz komendą tuż przed commitem, nie zakładasz z góry). **ZAKAZ dotykania wierszy `G00`–`G14` i `G16`–`G20` oraz MODULE_ACCEPTANCE pozostałych 15 modułów.** Plik postępu `/private/tmp/cx-day355-postep.md` żyje POZA repo. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day355-finance-403-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day355-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | Produkcja NIETYKALNA; demo i staging są jedną bazą. **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur** |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it`, jeśli plik je ustawia | `vitest.config.ts` ustawia `retry: CI ? 3 : 1`. Przy otwartej dziurze pierwszy przebieg realnie zmienia stan, asercja pada, Vitest ponawia — i test **raportuje `PASS` mimo otwartej dziury**. Udowodnione na module Partner |
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
| `Z40` | **★★ ZAKAZ WYGASZENIA ZABEZPIECZENIA CZŁONKOSTWA.** Zakazane bezwzględnie: zmiana warunku w `auth.middleware.ts` tak, żeby bramka przestała egzekwować poza testami; dopuszczenie statusu innego niż `ACTIVE`; globalny `vi.mock` bramki w `tests/setup.ts`, `tests/helpers/**` albo `tests/__mocks__/**`; „naprawa" polegająca na tym, że bramka przestaje pytać bazy. Każda z tych rzeczy = **odrzucenie całego dyżuru**, nie pozycji | Bramka członkostwa jest jedyną rzeczą, która trzyma dane jednej organizacji z dala od drugiej. Zmierzony kształt: fail-closed świeci na zielono, bo kontekst nie dociera, i funkcja przestaje działać dla WSZYSTKICH — a raport melduje sukces |

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
cd /private/tmp/cx-day355-finance-403

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day355-pg psql -U postgres -d cx355 \
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
cd /private/tmp/cx-day355-finance-403

docker run -d --name cx-day355-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx355 \
  -p 127.0.0.1:6414:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day355-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6414/cx355 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6414/cx355 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day355-finance-403 && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6414/cx355 \
JWT_SECRET=cx355-test-secret-do-not-reuse-min-32-znaki \
npx vitest run server/src/routes/v8/finance-v2/__tests__/ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day355-finance-403-artefakty/finance-przemiar.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day355-finance-403 && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/v8/finance-v2/__tests__/ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day355-finance-403-artefakty/finance-przemiar.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day355-finance-403/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day355-pg psql -U postgres -d cx355 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day355-pg`.
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
> **(e) **(e) ★★ PUŁAPKA WŁAŚCIWA FINANSOM: `createArtifactViaHttp` pada na `403 ORG_MEMBERSHIP_REVOKED` W FAZIE PRZYGOTOWANIA DANYCH, a nie w mierzonej asercji.** Skutkiem jest **31 × `TypeError: Cannot read properties of undefined`** — czerwień, która wygląda jak defekt kodu produktu, a jest kaskadą po nieudanym seedzie. Dowód: `bash -c "grep -c 'createArtifactViaHttp' server/src/routes/v8/finance-v2/__tests__/*.pg.test.ts"`. **Nie licz kaskady jako osobnych defektów** — dyżur 347 policzył ją poprawnie (51 = 31 + 20) i to jest Twój punkt wyjścia, nie Twoje odkrycie**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day355-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day355-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (``R1`, `R2`, `R3``) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6414` albo `5554` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6414` albo `5554`** (`Z7`).

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
