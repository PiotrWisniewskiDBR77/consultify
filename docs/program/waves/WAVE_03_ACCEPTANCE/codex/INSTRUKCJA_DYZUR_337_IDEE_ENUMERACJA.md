# INSTRUKCJA DYŻURU nr 337 — Codex — „★★★ IDEE — ENUMERACJA KONTROLEK NA WŁAŚCIWYM EKRANIE, PRZEPISANIE PO ODRZUCONYM DYŻURZE 331. Dyżur 331 został ODRZUCONY jednym rozstrzygającym powodem: commit `2ac619e988` wpisał do kontraktu enumeracji STAŁE INNEGO EKRANU — `unique 27 / menus 5 / sha 3864b45…` należą do listy Idei (`idea-table`), a mierzone miało być narzędzie tabeli (`idea-table-timeline-stuck`, realny `IdeaMapWorkspace` z `initialTool="table"` montujący realny `IdeaTableTool`). Pomiar odbiorcy dla WŁAŚCIWEGO ekranu, trzy stabilne przebiegi: **base 86, unique 82, menus 3, sha256 `2ccdd150…`, ZERO kontrolek bez nazwy dostępnej** — po wpisaniu tych wartości test jest zielony ŁĄCZNIE z bramką a11y. ★★ Przyczyną fałszu był PRZYRZĄD, nie produkt: `expect.poll(…).toBeGreaterThanOrEqual(minimumBase)` **zwalnia w połowie renderu** (200 ms → 1 kontrolka, od 800 ms → 86), więc cały wniosek „bezimienny przycisk blokuje mianownik” był artefaktem sondy. Ten dyżur ma NAJPIERW ustabilizować sondę (czekanie na warunek KOŃCOWY, nie na próg minimalny), potem zmierzyć, i dopiero potem wpisać kontrakt. ★ URATOWANE i JUŻ NA HEAD, nie powtarzasz: `85ca28cb28` (dowód konfliktu notatnika przez Gateway) i `f3b8f89941` (dowód mutacyjny strażnika tenanta metadanych). ★ Kontekst 295, nadal otwarty: enumeracja dowodzi EFEKTU tylko dla **12 z 226** sygnatur (5,3%) — wypatroszenie handlera istniejącej kontrolki NIE czerwieni testu"

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
> **wyłącznie** `/private/tmp/cx-day337-idee-enumeracja`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `1c4b5a5635bafd38ef375227824ada9b62be186e`**
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
Zakres: **07_MY_WORK_AGENT — narzędzia Idei (Tabela, Mind map, Whiteboard, Process flow): enumeracja kontrolek na WŁAŚCIWYM ekranie, stabilizacja sondy pomiarowej, wycofanie fałszywego twierdzenia z dokumentu trwałego. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plikiem postępu `/private/tmp/cx-day337-postep.md` (poza repo)**.
Trasy front: `Kontrakt i sonda: `src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx` (★ dziś cztery wpisy: `whiteboard-canvas` base 45 / unique 53 / menus 2, `mindmap-canvas` 57 / 65 / 2, `processflow-canvas` 63 / 81 / 3, `idea-table` 21 / 27 / 5 sha `3864b454…`; suma unique = 226; `describe.runIf(Boolean(HARNESS_URL))` — SKIP bez `DAY295_IDEA_HARNESS_URL`; bramka a11y = `expect(base.every(({ name }) => name.length > 0)).toBe(true)`; sonda = `expect.poll(…).toBeGreaterThanOrEqual(expected.minimumBase)` z `timeout: 30_000`). Ekrany harnessu: `dev-render/screens/idea-table-timeline-stuck.tsx` (★ WŁAŚCIWY — realny `IdeaMapWorkspace` z `initialTool="table"`, montuje realny `IdeaTableTool`), `dev-render/screens/idea-table.tsx` (★ NIEWŁAŚCIWY do tego pomiaru — to LISTA Idei, `IdeaTableScreen`), rejestr ekranów `dev-render/main.tsx` (wpisy `idea-table` ok. wiersza 2143 i `idea-table-timeline-stuck` ok. wiersza 2073). Produkt: `src/components/MyWork/IdeaTableTool.tsx` (★ `IdeaTableTool.tsx:2311` — `onClick: () => setShowConnectorWizard(true)`, kontrolka użyta przez odbiorcę do MUTACJI B) i trzy siostrzane narzędzia Idei w `src/components/MyWork/**``. Trasy tył: `Ten dyżur NIE ZMIENIA ANI JEDNEGO PLIKU w `server/src/`. Dwa dowody serwerowe z dyżuru 331 są JUŻ NA HEAD i ich NIE POWTARZASZ ani nie ruszasz: `85ca28cb28` — `server/src/routes/__tests__/day331.notebookConflict.gateway.pg.test.ts` (konflikt strony notatnika przez realny `ApiGateway`, kod `NOTEBOOK_PAGE_CONFLICT` na produkcyjnej `server/src/routes/v8/my-work.routes.ts`); `f3b8f89941` — dowód mutacyjny warunku tenantowego `save()` w `server/src/services/report/methodSessionReportMetadataService.ts`. Sprawdzasz komendą, że oba są przodkami `HEAD`, i idziesz dalej`.

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
WT=/private/tmp/cx-day337-idee-enumeracja
MARKER=1c4b5a5635bafd38ef375227824ada9b62be186e

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day337-idee-enumeracja-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day337-idee-enumeracja/config.worktree"
cat "$VAULT/worktrees/cx-day337-idee-enumeracja/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day337-idee-enumeracja-scratch
mkdir -p /private/tmp/cx-day337-idee-enumeracja-artefakty

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
git -C "$VAULT" log --oneline 1c4b5a5635bafd38ef375227824ada9b62be186e..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 1c4b5a5635bafd38ef375227824ada9b62be186e..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day337-idee-enumeracja-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 1c4b5a5635bafd38ef375227824ada9b62be186e..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: kontrakt na HEAD ma CZTERY wpisy, a czwarty to LISTA Idei, nie narzedzie tabeli
grep -n "minimumBase\|unique:\|menus:\|sha256" src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx
#   moje liczby: whiteboard-canvas 45/53/2; mindmap-canvas 57/65/2; processflow-canvas 63/81/3;
#   idea-table 21/27/5 sha 3864b4540d73...; suma unique = 53+65+81+27 = 226

# (2) TEZA: fałszywy commit 331 NIE JEST na HEAD — kontrakt nie zostal skazony
git log --oneline -5 -- src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx
git merge-base --is-ancestor 2ac619e988 HEAD && echo 'SKAZONY: 2ac619e988 jest na HEAD' || echo 'CZYSTO: 2ac619e988 NIE jest na HEAD'
#   moje liczby: jeden commit historii (`2fd3e38eeb`); 2ac619e988 NIE jest przodkiem HEAD

# (3) ★★ TEZA: fałszywy dopisek do TRWALEGO raportu 295 rowniez NIE JEST na HEAD
bash -c "grep -n 'Dopisek dyzuru 331|Dopisek dyżuru 331|bezimienn' docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY295_MOJAPRACA_INICJATYWY_REPORT.md" ; echo "kod grepa=$?"
git log --oneline -3 -- docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY295_MOJAPRACA_INICJATYWY_REPORT.md
#   moje liczby: ZERO trafien (kod grepa=1); historia pliku konczy sie na `1dc4b60f54`.
#   ★ Jesli tak jest takze u Ciebie, pozycja R3 jest w duzej czesci BEZPRZEDMIOTOWA i to
#   jest WYNIK, ktory zapisujesz — a nie powod, zeby cokolwiek dopisywac na wszelki wypadek.

# (4) TEZA: wlasciwy ekran montuje REALNE narzedzie tabeli, niewlasciwy montuje LISTE
grep -n "initialTool" dev-render/screens/idea-table-timeline-stuck.tsx
grep -n "'idea-table':" dev-render/main.tsx
sed -n '2073,2077p;2143,2147p' dev-render/main.tsx
#   oczekiwane: `initialTool="table"` w ekranie timeline-stuck; etykieta wpisu `idea-table`
#   mowi o "pelnym obiekcie: lista + podglad" — to REKORD/LISTA, nie narzedzie

# (5) ★★ TEZA ROZSTRZYGAJACA: sonda ZWALNIA W POLOWIE RENDERU
grep -n "expect.poll\|toBeGreaterThanOrEqual\|minimumBase\|describe.runIf\|name.length" \
  src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx
#   oczekiwane: `expect.poll(...).toBeGreaterThanOrEqual(expected.minimumBase)` z timeout 30_000,
#   `describe.runIf(Boolean(HARNESS_URL))` oraz bramka a11y na niepustej nazwie kazdej kontrolki.
#   ★ To jest przyczyna falszu 331: prog MINIMALNY spelnia sie, zanim render sie skonczy.

# (6) TEZA: dwa dowody uratowane z 331 sa juz na HEAD i ich nie powtarzasz
for s in 85ca28cb28 f3b8f89941; do \
  printf '%s ' "$s"; \
  git merge-base --is-ancestor "$s" HEAD && git log -1 --format='PRZODEK: %s' "$s" || echo 'NIE przodek'; \
done
ls server/src/routes/__tests__/day331.notebookConflict.gateway.pg.test.ts
#   oczekiwane: oba przodkami; plik testu istnieje

# (7) TEZA: efekt dowiedziony tylko dla 12 z 226 sygnatur — mutacja B nie czerwieni testu
sed -n '51,75p' docs/program/waves/WAVE_03_ACCEPTANCE/codex/ODBIOR_DYZUROW_295_297_298_20260903.md
grep -n "setShowConnectorWizard" src/components/MyWork/IdeaTableTool.tsx | head -5
#   oczekiwane: opis MUTACJI B (`IdeaTableTool.tsx:2311`) i zdanie "2+2+3+5 = 12 kontrolek
#   na 226 sygnatur (5,3%)"; kontrolka wciaz istnieje w produkcie

# (8) TEZA: liscie slownikow na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35198, en 33065

# (9) zasoby: dysk, porty, kontener
df -h /
lsof -nP -iTCP:6373 -sTCP:LISTEN; lsof -nP -iTCP:5513 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day337 || true
#   oczekiwane: powyzej 5 GB wolnego; oba porty puste; 0 kontenerow
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day337-idee-enumeracja-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6373`. Twój JEDYNY port harnessu to `5513`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day337-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki 04.09 — nie dotykasz: 334 (6370/5510), 335 (6371/5511), 336 (6372/5512). Starsze rodzeństwo 04.09: 330 (6356/5496), 331 (6357/5497), 332 (6358/5498), 333 (6359/5499). Cudze worktree 286-298 używają 6290-6299 i 5250-5269. Twoje własne wyłącznie: baza 6373, harness 5513. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright` — zabijasz wyłącznie własne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK. Ten dyżur nie dodaje, nie zmienia i nie przełącza ANI JEDNEJ flagi funkcyjnej. `DAY295_IDEA_HARNESS_URL` jest zmienną środowiskową testu, nie flagą produktu — ustawiasz ją na własny harness `http://127.0.0.1:5513` i zapisujesz to w raporcie`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`. Wszystkie NIETYKALNE DO ZAPISU`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY337_IDEE_ENUMERACJA_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md`, bo ten dyżur nie domyka wiersza macierzy — produkuje dowód, który dopiero wejdzie do bramki. Dopuszczalne AKTUALIZACJE (dopisanie, nigdy nadpisanie) dwóch istniejących dokumentów: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY295_MOJAPRACA_INICJATYWY_REPORT.md` — WYŁĄCZNIE jeżeli `R3` wykaże, że fałszywy dopisek na `HEAD` FAKTYCZNIE JEST; oraz `docs/program/REJESTR_ZNALEZISK_20260903.md` (jeden wiersz). Pliki dowodowe pod `evidence/day337/` (katalog NIE ISTNIEJE — tworzysz go). Plik postępu `/private/tmp/cx-day337-postep.md` żyje POZA repo. Nowe pliki w `tests/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day337-idee-enumeracja-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day337-idee-enumeracja-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ WPISANIA DO KONTRAKTU JAKIEJKOLWIEK LICZBY, KTÓREJ SAM NIE ZMIERZYŁEŚ TRZEMA STABILNYMI PRZEBIEGAMI.** To jest dokładnie błąd, za który odrzucono dyżur 331: przepisał stałe jednego ekranu do wpisu drugiego. Liczby z tej instrukcji (`base 86 / unique 82 / menus 3 / sha256 2ccdd150…`) są **kontrolą**, nie źródłem — pełny hash bierzesz WYŁĄCZNIE z własnego pomiaru, a jeżeli nie zgadza się z prefiksem, **zapisujesz rozbieżność i NIE dopasowujesz pomiaru do liczby**. **ZAKAZ mierzenia czegokolwiek, zanim sonda nie będzie stabilna** (`R1` przed `R2`) — pomiar na sondzie zwalniającej w połowie renderu jest artefaktem przyrządu, nie wynikiem. **ZAKAZ dopisywania sprostowania do dokumentu, w którym fałszywego twierdzenia NIE MA** — najpierw mierzysz, czy jest. **ZAKAZ powtarzania dowodów `85ca28cb28` i `f3b8f89941`** — są na `HEAD`. **ZAKAZ zamiany bramki a11y (`każda kontrolka ma niepustą nazwę`) na łagodniejszą, ostrzeżenie albo `expect.soft`.** **ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright`** — harness rodzeństwa dyżurów żyje na sąsiednich portach; zabijasz wyłącznie własne PID-y. **ZAKAZ `--retry` innego niż `0`** | Dyżur 331 wyprodukował wniosek, który brzmiał jak poważne znalezisko produktowe („bezimienny przycisk filtra blokuje uczciwy pomiar mianownika”), a był w całości artefaktem przyrządu: sonda zwalniała w połowie renderu i widziała jedną kontrolkę zamiast osiemdziesięciu sześciu. Twierdzenie zdążyło trafić dopiskiem do trwałego raportu 295 na gałęzi, która nie została scalona. To jest program w pigułce: narzędzie pomiarowe kłamie, a wniosek z niego wędruje do dokumentów. Dyżur 337 ma zrobić trzy rzeczy w tej kolejności: ustabilizować przyrząd, zmierzyć właściwy ekran własnymi rękami, i uporządkować ślad po fałszu — sprawdzając NAJPIERW, czy fałsz w ogóle dotarł na linię integracyjną. Osobno zostaje otwarte pytanie z dyżuru 295, którego 331 nie ruszył: enumeracja dowodzi efektu dla 12 z 226 kontrolek, więc 94,7% inwentarza to sygnatury DOM bez dowodu, że cokolwiek robią |

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
cd /private/tmp/cx-day337-idee-enumeracja

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day337-pg psql -U postgres -d cx337 \
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
cd /private/tmp/cx-day337-idee-enumeracja

docker run -d --name cx-day337-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx337 \
  -p 127.0.0.1:6373:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day337-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6373/cx337 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6373/cx337 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day337-idee-enumeracja && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6373/cx337 \
JWT_SECRET=cx337-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Harness: `npx vite --config dev-render/vite.config.ts --port 5513 --strictPort` (zapisz PID przez `$!`; zabijasz WYŁĄCZNIE własny PID). Test enumeracji z roota: `DAY295_IDEA_HARNESS_URL=http://127.0.0.1:5513 npx vitest run src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx --retry=0 --reporter=json --outputFile=/private/tmp/cx-day337-idee-enumeracja-artefakty/enumeracja-N.json` — trzy przebiegi, wyniki N=1,2,3. Ten dyżur pracuje w wariancie (C) `§0.2c` (`RUN_DB_TESTS=0 MOCK_DB=true`) — **kontenera `cx-day337-pg` NIE STAWIASZ**, port `6373` i nazwa kontenera zostają zarezerwowane i nieużyte; dowody serwerowe z 331 są już na `HEAD` i ich nie powtarzasz. Dowody mutacyjne obowiązkowe dla: sondy (pomiar przy 200 ms kontra po stabilizacji), bramki a11y (dodaj kontrolkę bez nazwy dostępnej — test MA się zaczerwienić), i dowodu efektu (MUTACJA B: wypatrosz `onClick` w `IdeaTableTool.tsx:2311` — nowy bezpiecznik MA się zaczerwienić). Cofasz przez `cp` do `/private/tmp/cx-day337-idee-enumeracja-scratch`, nigdy `git stash` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day337-idee-enumeracja-artefakty/day337-idee-enumeracja.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day337-idee-enumeracja && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Harness: `npx vite --config dev-render/vite.config.ts --port 5513 --strictPort` (zapisz PID przez `$!`; zabijasz WYŁĄCZNIE własny PID). Test enumeracji z roota: `DAY295_IDEA_HARNESS_URL=http://127.0.0.1:5513 npx vitest run src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx --retry=0 --reporter=json --outputFile=/private/tmp/cx-day337-idee-enumeracja-artefakty/enumeracja-N.json` — trzy przebiegi, wyniki N=1,2,3. Ten dyżur pracuje w wariancie (C) `§0.2c` (`RUN_DB_TESTS=0 MOCK_DB=true`) — **kontenera `cx-day337-pg` NIE STAWIASZ**, port `6373` i nazwa kontenera zostają zarezerwowane i nieużyte; dowody serwerowe z 331 są już na `HEAD` i ich nie powtarzasz. Dowody mutacyjne obowiązkowe dla: sondy (pomiar przy 200 ms kontra po stabilizacji), bramki a11y (dodaj kontrolkę bez nazwy dostępnej — test MA się zaczerwienić), i dowodu efektu (MUTACJA B: wypatrosz `onClick` w `IdeaTableTool.tsx:2311` — nowy bezpiecznik MA się zaczerwienić). Cofasz przez `cp` do `/private/tmp/cx-day337-idee-enumeracja-scratch`, nigdy `git stash` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day337-idee-enumeracja-artefakty/day337-idee-enumeracja.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day337-idee-enumeracja/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day337-pg psql -U postgres -d cx337 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day337-pg`.
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
> **(e) ★★★ **SIEDEM PUŁAPEK.** (1) **Próg minimalny w `expect.poll` zwalnia w połowie renderu** — `toBeGreaterThanOrEqual(minimumBase)` spełnia się przy pierwszej kontrolce, jaka pojawi się w DOM (200 ms → 1, od 800 ms → 86). Sonda ma czekać na warunek KOŃCOWY (stabilizacja liczby przez N kolejnych próbek), nie na próg. (2) **`describe.runIf(Boolean(HARNESS_URL))` daje `exit 0` przy ZERZE wykonanych przypadków** — brak `DAY295_IDEA_HARNESS_URL` to nie PASS, to brak pomiaru; zawsze podawaj liczbę WYKONANYCH przypadków. (3) **Ekran `idea-table` to LISTA Idei, nie narzędzie tabeli** — narzędzie montuje `idea-table-timeline-stuck` przez `initialTool="table"`; pomylenie tych dwóch było powodem odrzucenia 331. (4) **Hash sygnatur jest drutem ostrzegawczym, nie dowodem efektu** — MUTACJA B (wypatroszenie `onClick` istniejącej kontrolki przy niezmienionej etykiecie) zostawia hash bez zmian i test zielony. (5) **Przyrząd bywa niestabilny między przebiegami** — jeden zielony przebieg nie jest pomiarem; wymagane TRZY przebiegi z identycznym wynikiem, inaczej zapisujesz to jako niestabilność, a nie jako liczbę. (6) **Nie pisz własnego, doraźnego skryptu zrzutowego obok kanonicznego** — brakującą funkcję dokłada się istniejącemu narzędziu, opt-in, z parametrami zapisanymi na trwałe. (7) **`grep --include` w `zsh` zwraca pustkę zamiast wyników** — uruchamiaj przez `bash -c '…'` i sprawdzaj kod wyjścia; pustka nie jest wynikiem**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day337-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day337-idee-enumeracja-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (przeczytaj fakty odrzucenia 331 i potwierdź komendami, że kontrakt na HEAD jest CZYSTY) · R1 (STABILIZACJA SONDY — warunek końcowy zamiast progu minimalnego, z dowodem, że stara sonda zwalniała za wcześnie — RDZEŃ, przed jakimkolwiek pomiarem) · R2 (pomiar właściwego ekranu `idea-table-timeline-stuck` trzema stabilnymi przebiegami i wpisanie kontraktu z WŁASNYCH liczb — RDZEŃ) · R3 (ślad po fałszywym twierdzeniu: NAJPIERW zmierz, czy jest na HEAD; sprostowanie tylko jeżeli jest) · R4 (dowód EFEKTU zamiast inwentarza sygnatur: 12 z 226 — rozszerz zakres albo wypisz MARTWE z nazwy) · R5 (raport)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6373` albo `5513` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6373` albo `5513`** (`Z7`).

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

Dyżur 331 wyprodukował wniosek, który brzmiał jak poważne znalezisko produktowe —
**„bezimienny widoczny przycisk filtra zatrzymał uczciwy pomiar mianownika"** — i zdążył
przenieść go **dopiskiem do trwałego raportu 295**. Wniosek był **w całości artefaktem
przyrządu**. Dyżur został odrzucony jednym rozstrzygającym powodem:

> commit `2ac619e988` wpisał do kontraktu enumeracji **stałe innego ekranu** — `unique 27 /
> menus 5 / sha 3864b45…` należą do **listy** Idei (`idea-table`), a mierzone miało być
> **narzędzie tabeli** (`idea-table-timeline-stuck`).

**Pomiar odbiorcy dla właściwego ekranu, trzy stabilne przebiegi na harnessie:**
**base 86 · unique 82 · menus 3 · sha256 `2ccdd150…` · ZERO kontrolek bez nazwy dostępnej.**
Po wpisaniu **tych** wartości test jest zielony **łącznie z bramką a11y**.

**★★ Mechanizm fałszu — zapamiętaj go, bo to jest sedno tego dyżuru.**
Sonda pomiarowa to `expect.poll(async () => (await visibleControls(page)).length, { timeout:
30_000 }).toBeGreaterThanOrEqual(expected.minimumBase)`. **Próg minimalny spełnia się, zanim
render się skończy**: przy 200 ms strona ma **1** kontrolkę, dopiero od ok. 800 ms ma **86**.
Sonda zwalniała w połowie renderu, a wszystko, co po niej następowało — inwentarz, hash,
bramka a11y — liczyło się na niepełnym DOM-ie. **Przyrząd kłamał, a wniosek z niego trafił
do dokumentu.**

**★ Co jest już zrobione i czego NIE powtarzasz.** Dwa dowody z dyżuru 331 zostały uratowane
cherry-pickiem, potwierdzone mutacyjnie przez odbiorcę i **leżą na `HEAD`**:

- `85ca28cb28` — dowód konfliktu strony notatnika przez realny `ApiGateway` (kod
  `NOTEBOOK_PAGE_CONFLICT` na produkcyjnej `server/src/routes/v8/my-work.routes.ts`);
- `f3b8f89941` — dowód mutacyjny warunku tenantowego `save()` w
  `server/src/services/report/methodSessionReportMetadataService.ts`.

**★ Co pozostaje otwarte z dyżuru 295 i czego 331 nie ruszył.** Enumeracja dowodzi **efektu**
tylko dla **12 z 226** sygnatur (**5,3%**). Odbiorca 295 pokazał to mutacyjnie: wypatroszenie
`onClick` istniejącej kontrolki (`IdeaTableTool.tsx:2311`, etykieta bez zmian) **zostawia hash
bez zmian i test zielony**. Dodanie nowej martwej kontrolki do menu — **też zielony**.
Dzisiejszy bezpiecznik jest **inwentarzem sygnatur DOM plus drutem ostrzegawczym na hashu**,
a nie dowodem, że cokolwiek działa.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze `1c4b5a5635bafd38ef375227824ada9b62be186e`:

- kontrakt ma **cztery** wpisy: `whiteboard-canvas` 45 / 53 / 2, `mindmap-canvas` 57 / 65 / 2,
  `processflow-canvas` 63 / 81 / 3, `idea-table` 21 / 27 / 5 (sha `3864b454…`); suma
  `unique` = **226**;
- **`2ac619e988` NIE jest przodkiem `HEAD`** — kontrakt na linii integracyjnej **nie został
  skażony**; historia pliku kontraktu to jeden commit, `2fd3e38eeb`;
- **fałszywy dopisek do raportu 295 również NIE JEST na `HEAD`** — `grep` po „Dopisek dyżuru
  331" i po „bezimienn" w
  `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY295_MOJAPRACA_INICJATYWY_REPORT.md`
  nie znajduje **nic**; historia tego pliku kończy się na `1dc4b60f54`. Dopisek żyje wyłącznie
  na niescalonej gałęzi `codex/day331-mojapraca-i-silnik-20260904`.
  **★ To jest rozbieżność wobec zlecenia**, które mówiło o wycofaniu wpisu z dokumentu
  trwałego — i zapisuję ją tutaj wprost, żebyś nie dopisywał sprostowania do dokumentu,
  w którym nie ma czego prostować. **Zmierz to sam i zapisz swój wynik**;
- `85ca28cb28` i `f3b8f89941` **są przodkami `HEAD`**;
- ekran `idea-table-timeline-stuck` montuje `IdeaMapWorkspace` z `initialTool="table"`;
  ekran `idea-table` montuje `IdeaTableScreen`, a jego etykieta w rejestrze mówi o „pełnym
  obiekcie: lista + podgląd";
- sonda używa `toBeGreaterThanOrEqual(expected.minimumBase)` z `timeout: 30_000`; blok jest
  za `describe.runIf(Boolean(HARNESS_URL))`; bramka a11y to
  `expect(base.every(({ name }) => name.length > 0)).toBe(true)`;
- liście słowników: **pl 35198**, **en 33065**.

**Liczby pomiaru odbiorcy (`base 86 / unique 82 / menus 3 / sha256 `2ccdd150…``) są dla
Ciebie KONTROLĄ, nie źródłem.** Pełny hash bierzesz **wyłącznie z własnych trzech stabilnych
przebiegów**. Jeżeli Twój pomiar nie zgadza się z prefiksem — **zapisujesz rozbieżność i NIE
dopasowujesz pomiaru do liczby**. Dokładnie za to odrzucono dyżur 331.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: PRZYRZĄD · EKRAN HARNESSU · REJESTR EKRANÓW · PRODUKT · KONTRAKT · DOWODY · DOKUMENTY

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Przyrząd (sonda + kontrakt)** | `src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx` | **★ PEŁNA LICENCJA** w zakresie `R1`, `R2`, `R4`: stabilizacja sondy, dodanie wpisu dla właściwego ekranu, dobudowa dowodu efektu. **Zakaz osłabienia bramki a11y** (`każda kontrolka ma niepustą nazwę`) — nie zamieniasz jej na ostrzeżenie, `expect.soft` ani warunek. **Zakaz `--retry` innego niż `0`** | — |
| **Ekran harnessu — właściwy** | `dev-render/screens/idea-table-timeline-stuck.tsx` | **★ WĄSKA LICENCJA:** wolno dołożyć **atrybut identyfikujący** potrzebny do stabilnego pomiaru (np. znacznik gotowości renderu). **Zakaz zmiany `initialTool`, zakaz podmiany montowanego komponentu** | Brief |
| **Ekran harnessu — lista** | `dev-render/screens/idea-table.tsx` | **TYLKO ODCZYT.** To jest LISTA Idei i jej wpis w kontrakcie (`27 / 5 / 3864b454…`) jest **poprawny dla niej** — nie kasujesz go i nie „poprawiasz" | Opis w raporcie |
| **Rejestr ekranów harnessu** | `dev-render/main.tsx` | **★ WĄSKA LICENCJA:** wyłącznie etykieta wpisu `idea-table-timeline-stuck`, jeżeli `R2` wykaże, że myli. **Zakaz dodawania i usuwania ekranów** | Brief |
| **Produkt — narzędzie tabeli** | `src/components/MyWork/IdeaTableTool.tsx` | **TYLKO ODCZYT w tym dyżurze** — chyba że `R2` albo `R4` wykaże **realny** defekt dostępności (kontrolka bez nazwy) albo **realnie martwą** kontrolkę; wtedy naprawa jest dozwolona, w osobnym commicie, z dowodem mutacyjnym w obie strony | Wpis do tabeli MARTWE: `plik:linia`, etykieta, brak efektu, rekomendacja jako diff **nienałożony** |
| **Produkt — trzy siostrzane narzędzia Idei** | `src/components/MyWork/**` (mind map, whiteboard, process flow) | **TYLKO ODCZYT** — ich wpisy w kontrakcie są dziś poprawne i ich nie ruszasz | Opis w raporcie |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Warstwa serwerowa** | `server/**` w całości | **TYLKO ODCZYT — ZAKAZ ZAPISU.** Dwa dowody z 331 są na `HEAD`; ten dyżur ich nie powtarza i nie ulepsza | Opis w raporcie |
| **Dowody** | `evidence/day337/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**) | **★ PEŁNA LICENCJA na tworzenie** — surowe wyjścia JSON, logi trzech przebiegów, zapis pomiaru czasowego z `R1` | — |
| **Raport 295** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY295_MOJAPRACA_INICJATYWY_REPORT.md` | **★ WĄSKA LICENCJA WARUNKOWA:** sprostowanie **dopisane, nigdy nadpisane** — i **wyłącznie jeżeli `R3` zmierzy, że fałszywe twierdzenie na `HEAD` FAKTYCZNIE JEST**. Jeżeli go nie ma, **nie dotykasz pliku** | Zapis w raporcie: „pozycja bezprzedmiotowa", z komendą |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jeden wiersz, dopisany | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY337_IDEE_ENUMERACJA_REPORT.md` (**NOWY — nie istnieje na markerze**) | `R5` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **TYLKO ODCZYT — ZAKAZ ZAPISU.** Ten dyżur produkuje dowód, który dopiero wejdzie do bramki; wiersza nie dotykasz | Raport podaje, do której bramki dowód należy |
| **Cudze tereny** | `scripts/dev/p0p1-licznik-e1.mjs`, `REJESTR_P0P1_BLOKUJACE_G20.md` (dyżur 334) · `evidence/g19/**`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md` (dyżur 335) · `evidence/g15/**`, `REJESTR_G15_SAMOKONTROLA_20260903.md` (dyżur 336) · `server/migrations/**` (przedział nieprzydzielony) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ ROZSTRZYGNIĘCIE WOBEC `§0.2c`

**Wariant (C), bez kontenera.** Ten dyżur nie dotyka bazy danych. Pracujesz w wariancie (C)
(`RUN_DB_TESTS=0 MOCK_DB=true`), **kontenera `cx-day337-pg` nie stawiasz**; port `6373`
i nazwa kontenera pozostają zarezerwowane i nieużyte. W raporcie piszesz jednym zdaniem, że
baza nie była potrzebna, i **nie udajesz dowodu bazodanowego**. Dowód `§0.2b` (b) zastępujesz
zdaniem o braku bazy dyżuru — to jest pełny dowód `Z30` przy braku kontenera.

**Harness `dev-render`** uruchamiasz na **swoim** porcie `5513`:

```bash
cd "$WT"
npx vite --config dev-render/vite.config.ts --port 5513 --strictPort &
HARNESS_PID=$!
echo "HARNESS_PID=$HARNESS_PID" | tee /private/tmp/cx-day337-idee-enumeracja-artefakty/harness.pid
# ★ Na koniec zabijasz WYLACZNIE ten PID: kill "$HARNESS_PID".
# ★ ZAKAZ `pkill node` / `pkill vite` — na sasiednich portach zyja harnessy dyzurow 334-336.
```

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35198, en 33065

# (b) trzy bramki kanonu maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby: wszystkie 0
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | wpisy kontraktu i suma `unique` | 4 wpisy, suma `226` | komenda (1) z `§0.3` | TAK |
| 2 | czy fałszywy commit 331 jest na `HEAD` | **NIE** | komenda (2) z `§0.3` | TAK — `merge-base --is-ancestor`, nie sam `git log` |
| 3 | czy fałszywy dopisek jest w raporcie 295 na `HEAD` | **NIE** (zero trafień) | komenda (3) z `§0.3` | TAK — **`grep` przez `bash -c`**, bo w `zsh` bywa pusty przez `--include` |
| 4 | ekran właściwy kontra lista | `initialTool="table"` kontra `IdeaTableScreen` | komenda (4) z `§0.3` | TAK — czyta montowany komponent, nie nazwę wpisu |
| 5 | **liczba kontrolek w funkcji czasu** | `200 ms → 1`, `800 ms → 86` | pomiar z `R1` punkt 1 | TAK — **to jest dowód, że stara sonda zwalniała za wcześnie** |
| 6 | `base` właściwego ekranu, po stabilizacji | `86` | trzy przebiegi z `R2` | TAK |
| 7 | `unique` właściwego ekranu | `82` | jw. | TAK |
| 8 | `menus` właściwego ekranu | `3` | jw. | TAK |
| 9 | `sha256` sygnatur właściwego ekranu | prefiks `2ccdd150…`; **pełną wartość bierzesz z własnego pomiaru** | jw. | TAK |
| 10 | kontrolki bez nazwy dostępnej | `0` | bramka a11y w tym samym przebiegu | TAK |
| 11 | liczba WYKONANYCH przypadków testu | — | pole `numTotalTests` z JSON-a | TAK — **`0 failed` przy `0 wykonanych` NIE jest PASS** |
| 12 | sygnatury z dowiedzionym EFEKTEM | `12` z `226` (5,3%) | komenda (7) z `§0.3` + Twój pomiar po `R4` | TAK |
| 13 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx` ·
`evidence/day337/**` (nowy katalog) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY337_IDEE_ENUMERACJA_REPORT.md`.

**Zapisujesz WARUNKOWO:** `dev-render/screens/idea-table-timeline-stuck.tsx` (wyłącznie
znacznik gotowości renderu) · `dev-render/main.tsx` (wyłącznie etykieta jednego wpisu) ·
`src/components/MyWork/IdeaTableTool.tsx` (**tylko** przy udowodnionym mutacyjnie realnym
defekcie a11y albo martwej kontrolce, osobny commit) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY295_MOJAPRACA_INICJATYWY_REPORT.md`
(**tylko** jeżeli `R3` zmierzy obecność fałszywego twierdzenia) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jeden wiersz).

**JAWNIE NIE ZAPISZESZ:** `server/**`, `dev-render/screens/idea-table.tsx`, `tests/setup.ts`,
`tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `.github/workflows/**`,
`server/migrations/**`, `public/locales/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/**` (macierz odbioru), `scripts/dev/p0p1-licznik-e1.mjs`,
`REJESTR_P0P1_BLOKUJACE_G20.md`, `evidence/g15/**`, `evidence/g19/**`,
`G19_INWENTARZ_OBOWIAZKOW_20260903.md`, `REJESTR_G15_SAMOKONTROLA_20260903.md`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day337-idee-enumeracja
git diff --name-only --cached | tee /private/tmp/cx-day337-idee-enumeracja-artefakty/staged.txt
bash -c "grep -iE '^server/|idea-table\.tsx|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^public/locales/|MODULE_ACCEPTANCE|p0p1-licznik|REJESTR_P0P1|evidence/g15|evidence/g19|G19_INWENTARZ|REJESTR_G15' /private/tmp/cx-day337-idee-enumeracja-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — POTWIERDŹ, ŻE LINIA JEST CZYSTA (pierwsza pozycja, przed czymkolwiek)

1. Uruchom komendy (1), (2), (3) i (6) z `§0.3`.
2. Zapisz w raporcie **cztery odpowiedzi**: czy kontrakt na `HEAD` jest nieskażony; czy
   `2ac619e988` jest przodkiem; czy fałszywy dopisek jest w raporcie 295; czy oba uratowane
   commity leżą na `HEAD`.
3. ★ **Jeżeli którakolwiek odpowiedź różni się od mojej — to jest wynik, nie przeszkoda.**
   Zapisz rozbieżność w „Korektach wobec instrukcji" z komendą i idź dalej.

**Wymagany dowód:** cztery odpowiedzi z komendami. **Commit po `R0`** (może być pusty
w plikach kodu — wtedy commit obejmuje sam plik postępu i wpis w raporcie).

## R1 — STABILIZACJA SONDY (rdzeń — PRZED jakimkolwiek pomiarem)

**Nie mierzysz niczego, dopóki sonda nie jest stabilna.** Pomiar na sondzie zwalniającej
w połowie renderu jest artefaktem przyrządu, nie wynikiem — i to dokładnie ten błąd
wyprodukował fałszywe znalezisko 331.

1. **Udowodnij defekt sondy liczbą.** Uruchom harness, załaduj
   `?screen=idea-table-timeline-stuck&lang=pl&theme=light` i policz widoczne kontrolki
   **w funkcji czasu**: przy ok. 200 ms, 400 ms, 800 ms, 1500 ms, 3000 ms. Zapisz krzywą
   w `evidence/day337/sonda-krzywa.md`. **Moje liczby: 200 ms → 1, od ok. 800 ms → 86** —
   zmierz swoje.
2. **Przepisz sondę na warunek KOŃCOWY.** Ma czekać na **stabilizację**, nie na próg:
   liczba widocznych kontrolek jest **identyczna w N kolejnych próbkach** (N i odstęp
   dobierasz z krzywej z punktu 1 i **uzasadniasz liczbą**), a dopiero potem zapada pomiar.
   ★ **Próg minimalny nie może pozostać jedynym warunkiem zwolnienia sondy.** Jeżeli
   zostawiasz `minimumBase` jako dodatkowy bezpiecznik — pisz to wprost i uzasadnij.
3. **DOWÓD MUTACYJNY CELUJĄCY W SONDĘ.** Wstrzyknij do ekranu harnessu opóźnienie renderu
   (kopia pliku przez `cp` do katalogu scratch **poza repo**, `Z27` — **nigdy `git stash`**)
   i pokaż, że:
   - **stara** sonda przy tym opóźnieniu **przechodzi z zaniżonym mianownikiem**;
   - **nowa** sonda **czeka** i mierzy pełny mianownik albo **czerwieni się** z jawnym
     komunikatem o niestabilności.

   Przywróć przez `cp`; `git diff` po przywróceniu **pusty**.
4. **Trzy przebiegi na dowód stabilności.** Ta sama komenda, trzy razy, wyniki do
   `evidence/day337/`. Jeżeli trzy przebiegi dają różne liczby — **to jest wynik**
   („przyrząd niestabilny"), a nie powód do wybrania najładniejszej liczby.

**Wymagany dowód:** krzywa czasowa z liczbami, diff nowej sondy, mutacja w obie strony
z pełną nazwą czerwonego przypadku (`Z37`), trzy przebiegi z identycznym wynikiem, `git diff`
po przywróceniu (pusty). **Commit po `R1`.**

## R2 — POMIAR WŁAŚCIWEGO EKRANU I WPIS DO KONTRAKTU (rdzeń)

1. **Zmierz `idea-table-timeline-stuck`** ustabilizowaną sondą, **trzy razy**, z zapisem
   `--reporter=json --outputFile=`. Do raportu idą **cztery liczby i hash**: `base`,
   `unique`, `menus`, liczba kontrolek bez nazwy dostępnej, `sha256`.
   **Moje liczby kontrolne: 86 / 82 / 3 / 0, sha `2ccdd150…`.**
2. **Wpisz do kontraktu WŁASNE liczby.** ★★ **Pełny hash bierzesz wyłącznie z własnego
   pomiaru.** Jeżeli nie zgadza się z prefiksem `2ccdd150` — **zapisujesz rozbieżność i NIE
   dopasowujesz pomiaru do liczby**. To jest ten sam błąd, za który odrzucono 331, tylko
   w drugą stronę.
3. **Rozstrzygnij relację obu wpisów i zapisz decyzję.** Wpis `idea-table` (`27 / 5 /
   3864b454…`) jest **poprawny dla listy Idei** i **nie jest błędem sam w sobie** — błędem
   było branie go za narzędzie tabeli. Rozstrzygasz jedno z dwojga i **uzasadniasz**:
   - kontrakt ma **pięć** wpisów (cztery dotychczasowe + narzędzie tabeli), a suma `unique`
     rośnie z 226 do Twojej nowej liczby; albo
   - wpis listy zostaje **przemianowany na jednoznaczny** (żeby nikt więcej nie pomylił
     listy z narzędziem), a narzędzie dostaje własny wpis.

   **Podaj nową sumę `unique` i nazwij ją wprost jako nowy mianownik.**
4. **DOWÓD MUTACYJNY CELUJĄCY W BRAMKĘ a11y.** Dodaj tymczasowo do narzędzia kontrolkę
   **bez nazwy dostępnej** (przez `cp`, poza repo) i pokaż, że test **czerwieni się** na
   `expect(base.every(({ name }) => name.length > 0)).toBe(true)`. Przywróć przez `cp`.
   ★ Bez tego dowodu zdanie „ZERO kontrolek bez nazwy" jest twierdzeniem, nie pomiarem —
   bramka, która nigdy nie zaświeciła na czerwono, nie jest bramką.

**Wymagany dowód:** trzy przebiegi z identycznymi liczbami, diff kontraktu, uzasadnienie
decyzji z punktu 3, nowa suma `unique`, mutacja a11y w obie strony, `git diff` po przywróceniu
(pusty). **Commit po `R2`.**

## R3 — ŚLAD PO FAŁSZYWYM TWIERDZENIU: NAJPIERW ZMIERZ, CZY JEST

1. **Zmierz** komendą (3) z `§0.3`, czy dopisek („bezimienny widoczny przycisk filtra
   zatrzymał uczciwy pomiar mianownika") jest w
   `CODEX_DAY295_MOJAPRACA_INICJATYWY_REPORT.md` **na `HEAD`**. **Moja liczba: NIE MA GO** —
   żyje wyłącznie na niescalonej gałęzi `codex/day331-mojapraca-i-silnik-20260904`.
2. **Jeżeli go NIE MA** — pozycja jest **bezprzedmiotowa**, i to jest **wynik**: piszesz
   w raporcie, że fałszywe twierdzenie **nigdy nie dotarło na linię integracyjną**,
   z komendą i z `git log` na tym pliku. **Nie dopisujesz niczego „na wszelki wypadek"** —
   dopisek do dokumentu, w którym nie ma czego prostować, tworzy drugi rejestr tej samej
   rzeczy.
3. **Jeżeli JEST** — dopisujesz sprostowanie **OBOK, nigdy zamiast**: oryginalne zdanie
   zostaje, obok staje data, cytat obu wersji, komenda pomiarowa i **wyjaśnienie mechanizmu**
   (sonda zwalniająca przed końcem renderu — z Twoją krzywą z `R1`).
   ★ **Zanim dopiszesz — sprawdź, czy plik nie jest GENEROWANY przez skrypt:**
   `bash -c "grep -rl 'CODEX_DAY295' scripts/"`. Jeżeli jest — dopisek idzie do raportu,
   a do generatora idzie brief.
4. **Sprawdź RODZINĘ, nie tylko ten jeden plik.** Wypisz **wszystkie** miejsca w `docs/`
   i `evidence/` na `HEAD`, w których pojawia się twierdzenie o bezimiennej kontrolce
   blokującej mianownik — praca per zgłoszenie daje „poprawne w 2 z 3".
5. **Jeden wiersz w rejestrze znalezisk**: mechanizm („próg minimalny w `expect.poll`
   zwalnia sondę w połowie renderu; wniosek z takiej sondy jest artefaktem przyrządu"),
   bo to jest wzorzec, który wróci w innych pomiarach.

**Wymagany dowód:** wynik pomiaru z punktu 1 z komendą i kodem wyjścia; albo `git diff`
sprostowania, albo jednoznaczne zdanie „pozycja bezprzedmiotowa" z dowodem; lista rodziny
z punktu 4; wiersz rejestru znalezisk. **Commit po `R3`.**

## R4 — DOWÓD EFEKTU ZAMIAST INWENTARZA SYGNATUR (12 z 226)

Dzisiejszy bezpiecznik dowodzi **efektu** tylko dla wyzwalaczy menu
(`expect(openedMenus).toBe(expected.menus)`) — **12 kontrolek na 226 sygnatur, 5,3%**.
Reszta to inwentarz DOM plus hash: **wypatroszenie handlera nie czerwieni testu**.

1. **Odtwórz MUTACJĘ B** odbiorcy: zamień `onClick: () => setShowConnectorWizard(true)`
   w `IdeaTableTool.tsx:2311` na pusty handler (etykieta bez zmian), przez `cp` poza repo.
   Potwierdź, że **dzisiejszy** test pozostaje **zielony**. To jest punkt wyjścia.
2. **Dobuduj dowód efektu** — wybierz jeden z dwóch kierunków i **uzasadnij wybór**:
   - **kontrakt efektu**: dla kontrolek, których efekt da się zaobserwować w DOM (otwarcie
     dialogu, zmiana stanu widoku, pojawienie się panelu), test klika i sprawdza **skutek**,
     nie tylko obecność; albo
   - **jawna tabela MARTWE**: dla kontrolek, których efektu **nie da się** dowieść tym
     przyrządem, wypisujesz je z `plik:linia` i etykietą do `evidence/day337/martwe.md` —
     **z nazwy, nie liczbą zbiorczą**.

   ★ **Instrukcja 295 żądała dowodu ALBO wpisu do tabeli MARTWE dla KAŻDEJ kontrolki.**
   Zdanie „MARTWE: brak w dowiedzionym zakresie interakcji menu" jest formalnie prawdziwe
   i praktycznie puste — **nie powtarzaj tego kształtu**.
3. **DOWÓD MUTACYJNY CELUJĄCY W NOWY BEZPIECZNIK.** Po dobudowie: powtórz MUTACJĘ B
   i pokaż, że **teraz test się czerwieni**, z pełną nazwą przypadku (`Z37`). Przywróć przez
   `cp`; `git diff` po przywróceniu **pusty**.
   ★ Bezpiecznik, który przechodzi zarówno przed, jak i po wypatroszeniu handlera, **nie
   broni niczego**.
4. **Podaj nową liczbę pokrycia**: ile sygnatur ma dziś dowiedziony efekt, z nowego
   mianownika. Jeżeli liczba nadal jest mała — **napisz ją uczciwie**; częściowy wzrost
   z dowodem jest wynikiem, deklaracja pełnego pokrycia bez mutacji nie jest.

**Wymagany dowód:** wynik MUTACJI B przed i po, diff dobudowy, tabela MARTWE albo kontrakty
efektu, nowa liczba pokrycia z mianownikiem, `git diff` po przywróceniu (pusty).
**Commit po `R4`.**

## R5 — RAPORT

Raport zawiera: cztery odpowiedzi z `R0` · **krzywą czasową sondy** i diff stabilizacji
z `R1` · **trzy przebiegi pomiaru** właściwego ekranu z `R2` (`base`, `unique`, `menus`,
kontrolki bez nazwy, **pełny `sha256`**) · decyzję o relacji obu wpisów kontraktu i **nową
sumę `unique`** · wynik pomiaru z `R3` i jednoznaczne stwierdzenie, czy sprostowanie było
potrzebne · **nową liczbę pokrycia efektu** z `R4` · **wszystkie dowody mutacyjne dosłownie**
(sonda, a11y, MUTACJA B) z pełnymi nazwami czerwonych przypadków · **liczbę WYKONANYCH
przypadków** w każdym przebiegu · listę rozbieżności wobec liczb tej instrukcji ·
**niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** · obowiązkowy **akapit `§0.2e`** dla
każdego uruchomionego pakietu (dla tego dyżuru istotne są pułapki: `describe.runIf` dający
`exit 0` przy zerze wykonanych, oraz `vitest` z roota bez configu).

Osobno, jednym zdaniem: **do której bramki macierzy ten dowód należy** i **czego jeszcze
brakuje**, żeby dało się go tam wpisać. Wiersza macierzy **nie dotykasz**.

**Commit po `R5`.**

## Próg odbioru

**Sonda mierzy warunek końcowy, nie próg minimalny, i ma to udowodnione krzywą czasową oraz
mutacją; kontrakt niesie liczby WŁASNEGO pomiaru właściwego ekranu, potwierdzone trzema
identycznymi przebiegami; bramka a11y ma dowód, że potrafi zaświecić na czerwono; ślad po
fałszywym twierdzeniu jest zmierzony, a sprostowanie dopisane TYLKO tam, gdzie fałsz
faktycznie jest.**

Liczba wpisana do kontraktu bez własnego, trzykrotnie powtórzonego pomiaru — **nawet jeżeli
zgadza się z tą instrukcją** — jest podstawą odrzucenia dyżuru. To jest dokładnie ten błąd,
za który odrzucono 331.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „sonda ustabilizowana
i udowodniona krzywą 200 ms → N kontra 800 ms → M; właściwy ekran zmierzony trzykrotnie,
kontrakt niesie moje liczby; bramka a11y udowodniona mutacyjnie; fałszywe twierdzenie
zmierzone — jest / nie ma go na `HEAD`" — **jest pełnowartościowym wynikiem, nawet jeżeli
`R4` zostanie nietknięte.**

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Wpisz `base 86 / unique 82 / menus 3 / sha 2ccdd150…`" vs „nie przepisuj cudzych liczb" | `R2` punkt 2 i próg odbioru: liczby z instrukcji są **kontrolą**, źródłem są Twoje trzy przebiegi; rozbieżność zapisujesz, nie dopasowujesz |
| „Wycofaj fałszywy wpis z trwałego dokumentu" vs „na `HEAD` tego wpisu nie ma" | `R3` punkty 1–2: **najpierw mierzysz**; brak wpisu czyni pozycję bezprzedmiotową i **to jest wynik**, nie porażka; rozbieżność wobec zlecenia jest zapisana w „Zmierz moje liczby sam" |
| „Zmierz mianownik" vs „nie mierz na niestabilnej sondzie" | Kolejność `R1` przed `R2`, zapisana wprost jako warunek pozycji rdzenia |
| „Wpis `idea-table` jest błędny" vs „lista Idei to prawdziwy ekran" | `R2` punkt 3: wpis listy jest **poprawny dla listy**; błędem było branie go za narzędzie — dlatego rozstrzygasz relację, a nie kasujesz wpis |
| „Nie zmieniasz produktu" vs „napraw kontrolkę bez nazwy, jeśli ją znajdziesz" | Tabela licencji, wiersz „Produkt — narzędzie tabeli": naprawa **wyłącznie** przy udowodnionym mutacyjnie realnym defekcie, w osobnym commicie |
| „Bramka a11y ma być zielona" vs „bramka ma umieć zaświecić na czerwono" | `R2` punkt 4: zieleń dowodzisz pomiarem, zdolność do czerwieni — mutacją; jedno bez drugiego nie jest bramką |
| „Powtórz dowody z 331" vs „`85ca28cb28` i `f3b8f89941` są na `HEAD`" | `R0` punkt 1 (komenda (6)) i tabela licencji, wiersz „Warstwa serwerowa": potwierdzasz komendą i **nie powtarzasz** |
| „`§0.2c` (A) każe postawić kontener" vs „ten dyżur nie dotyka bazy" | Sekcja „ROZSTRZYGNIĘCIE WOBEC `§0.2c`": wiążący wariant **(C)**; port i kontener zarezerwowane i nieużyte |
| „Zabij harness po pracy" vs „zakaz `pkill`" | Sekcja z komendą harnessu: zapisujesz `$!` do pliku i zabijasz **wyłącznie własny PID**; na sąsiednich portach żyją harnessy dyżurów 334-336 |
| „Zero nowych dokumentów" (`Z13`) vs „pliki dowodowe i wiersz rejestru" | Tabela licencji: `evidence/day337/` to **ślad**, rejestr znalezisk to **AKTUALIZACJA**; nowy dokument rejestrowy jest dokładnie jeden — raport `R5` |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R1`, `R2`, `R4`: kopia przez `cp` do katalogu scratch poza repo; `git diff` po przywróceniu ma być pusty |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par, w tym **sprzeczność zlecenia ze stanem `HEAD`** (fałszywy dopisek) rozstrzygnięta na korzyść pomiaru |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — kontrakt, oba ekrany harnessu, `IdeaTableTool.tsx`, raport 295, odbiór 295/297/298, test 331 sprawdzone na markerze; `evidence/day337/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 13 wierszy; wiersze 1–4 i 13 zmierzone przy wydaniu, wiersze 5–10 są **liczbami odbiorcy podanymi jako kontrola**, co jest zapisane wprost |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — przyrząd · ekran właściwy · ekran listy · rejestr ekranów · produkt narzędzia · produkt siostrzany · bezpieczniki · serwer · dowody · raport 295 · rejestr znalezisk · raport dyżuru · macierz odbioru; w każdym wierszu stoi rzeczownik-produkt |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R0`–`R4` nie wymagają `auth.middleware.ts` ani `Gateway.ts`; `dev-render/main.tsx` i ekran harnessu mają **wąską, imienną licencję** |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6373/5513 wolne, brak kontenera `cx-day337-pg`, brak gałęzi i worktree; 334/335/336 mają rozłączne porty i rozłączne pliki; przedział migracji nieprzydzielony; **zakaz `pkill` zapisany imiennie**, bo rodzeństwo trzyma harnessy na sąsiednich portach |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: próg minimalny w `expect.poll`, `describe.runIf` dający `exit 0` przy zerze wykonanych, pomylenie listy z narzędziem, hash jako drut ostrzegawczy, niestabilność między przebiegami, doraźny skrypt obok kanonicznego, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
