# INSTRUKCJA DYŻURU nr 361 — Codex — „★★★ G19 KUBEŁEK C — DZIEWIĘĆ WIERSZY: USTALIĆ, CZEGO NAPRAWDĘ BRAKUJE, I ZŁOŻYĆ PAKIET DLA WŁAŚCICIELA. To NIE jest dyżur od podnoszenia wierszy. Dziewięć modułów (`02`, `03`, `07`, `09`, `10`, `12`, `14`, `15`, `16`) dostało od dyżuru 353 etykietę „oczy właściciela” — a w orzeczeniu źródłowym OŚMIU wierszom przypisano DOSŁOWNIE TO SAMO ZDANIE dowodu. Ten dyżur ma rozstrzygnąć per wiersz, czy brakuje (a) SCENARIUSZA, (b) REALNEGO ŁAŃCUCHA (ApiGateway + JWT + Postgres), czy (c) OCZU WŁAŚCICIELA — a jeżeli (c), to CO DOKŁADNIE ma zobaczyć i GDZIE KLIKNĄĆ. Produktem jest pakiet gotowy do wysłania właścicielowi, w stylu `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`. ★ Jeżeli któryś wiersz da się zamknąć maszynowo — POWIEDZ TO I ZAMKNIJ, z dowodem. ★★★ ANI JEDEN wiersz nie zmienia stanu bez dowodu; pakiet dla właściciela NIE JEST dowodem, jest przygotowaniem"

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
> **wyłącznie** `/private/tmp/cx-day361-g19-kubelek-c`.

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
Zakres: **BRAMKA ODBIORU `G19` („Later-change regression obligations resolved”) — **kubełek `C`, dziewięć modułów: `02_INTERVIEW`, `03_TOOLS`, `07_MY_WORK_AGENT`, `09_RESULTS`, `10_FINANCE`, `12_AUDITS`, `14_ADMIN`, `15_SETTINGS`, `16_PARTNER`**. Przedmiotem pracy jest **rozstrzygnięcie, czego brakuje**, i **pakiet przelotowy dla właściciela** — nie kod produktu i nie hurtowe podnoszenie wierszy. ★ Kubełki dziedziczysz z `evidence/g19/day353/r4-orzeczenie.md`: `A = 01, 04, 05, 06, 08, 11, 13` (siedem, przedmiot RÓWNOLEGŁEGO dyżuru 360 — **nie dotykasz**), `C` = te dziewięć**.
Trasy front: `★★ TU LEŻY SEDNO KUBEŁKA `C`. `G19` mierzy **regresję na ścieżkach zmienionych po odbiorze**, a dryf (`evidence/g19/day348-artefakty/g19-dryf-dzis.txt`, **106 plików, 90 bez testów**) jest w większości frontowy i **współdzielony**. Ustalone przez dyżur 353 per moduł (`r4-orzeczenie.md`) — to są WSKAZANIA, nie ustalenia, sprawdzasz każde: `02` → `NModeLeftNav` i formularze · `03` → formularze współdzielone i `ErrorState` · `07` → warunkowe renderowanie wspólnej powłoki · `09` → `HelpButton`, `ErrorState`, PL/EN · `10` → treść i stany warunkowe PL/EN · `12` → formularze i stany błędów/pustki · `14` → `HelpButton`/`ErrorState` i dane warunkowe · `15` → formularze współdzielone · `16` → realny rekord partnera w PL/EN. ★★ **Ten dyżur NIE renderuje ekranów i NIE robi zrzutów** — zrzuty to osobny tor (`dev-render`), a `Z28` zakazuje łączenia się ze stagingiem. Twoim produktem jest **instrukcja dla oczu właściciela**, nie obraz. Jedyny kontakt z `src/` to **odczyt**`. Trasy tył: `Zależnie od wyniku triażu. Dla wierszy zaklasyfikowanych do `(b)` — **brak realnego łańcucha** — masz **nazwać trasę i strażnika** z `plik:linia`, żeby dało się to zlecić maszynowo bez ponownego śledztwa. Wzorzec, jak taka para wygląda, jest gotowy i **nie budujesz go od nowa**: `server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts`, przypadek `denies foreign workload lookup while the owner reads the seeded task` (wiersz `214`), trasa `GET /api/tasks/workload/:userId` → `TaskController.getUserWorkload` (`server/src/controllers/TaskController.ts:2681`), mutacja w `AND organization_id = ?`, para obcy `404` / właściciel `200` na tym samym `userId`. ★ Jeżeli w triażu wyjdzie, że któryś wiersz da się zamknąć maszynowo **tu i teraz** — wolno Ci to zrobić, ale wtedy obowiązuje pełny rygor `R4`: para na realnym PostgreSQL przez realny `ApiGateway`, mutacja celująca w zabezpieczenie, `GREEN`→`RED`→`GREEN`, pusty `git diff``.

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
WT=/private/tmp/cx-day361-g19-kubelek-c
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
git -C "$VAULT" worktree add "$WT" -b codex/day361-g19-kubelek-c-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day361-g19-kubelek-c/config.worktree"
cat "$VAULT/worktrees/cx-day361-g19-kubelek-c/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day361-g19-kubelek-c-scratch
mkdir -p /private/tmp/cx-day361-g19-kubelek-c-artefakty

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
git -C "$WT" push github-backup codex/day361-g19-kubelek-c-20260904
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
cd /private/tmp/cx-day361-g19-kubelek-c

# (1) ★★★ ORZECZENIE DYZURU 353 ISTNIEJE — to jest Twoj punkt wyjscia
ls -la evidence/g19/day353/ evidence/g19/day353-artefakty/
cat evidence/g19/day353/r4-orzeczenie.md
#   ★ PRZECZYTAJ W CALOSCI. Stad masz kubelek C = 02,03,07,09,10,12,14,15,16 (dziewiec).

# (2) ★★★ ETYKIETA HURTOWA — sprawdz to SAM, to jest teza R1
bash -c "grep -cE 'Wspólne Bloki 1–3 zielone na markerze' evidence/g19/day353/r4-orzeczenie.md"
#   moja liczba: 8. OSIEM wierszy ma w kolumnie 'co zostalo udowodnione' DOSLOWNIE
#   to samo zdanie. To sa: 03,07,09,10,12,14,15,16 z kubelka C oraz — sprawdz sam — czy
#   ktorys spoza C. 02_INTERVIEW ma zamiast tego liczby (131/131, 218/218, 18/18).
#   ★ KOLUMNA 'czego brakuje' jest ZROZNICOWANA per modul — wiec hurt dotyczy DOWODU,
#   nie diagnozy. Ta roznica jest sednem R1: zroznicowany brak przy identycznym dowodzie
#   znaczy, ze ktos wiedzial, czego brakuje, ale nie zmierzyl, co jest.

# (3) ETYKIETA W MACIERZY — czy wszystkie dziewiec brzmi identycznie
bash -c "for m in 02_INTERVIEW 03_TOOLS 07_MY_WORK_AGENT 09_RESULTS 10_FINANCE 12_AUDITS 14_ADMIN 15_SETTINGS 16_PARTNER; do printf '%s ' \$m; grep -E '^\| G19 +\|' docs/program/waves/WAVE_03_ACCEPTANCE/modules/\$m/MODULE_ACCEPTANCE.md | head -1 | awk -F'|' '{print \$4}'; done"
#   moja liczba: 9 x 'NOT_PROVEN / OWNER_RETEST_PENDING' — identycznie

# (4) DRYF — DZIEDZICZYSZ, NIE LICZYSZ PONOWNIE
wc -l < evidence/g19/day348-artefakty/g19-dryf-dzis.txt
bash -c "grep -vcE '__tests__|[.]test[.]' evidence/g19/day348-artefakty/g19-dryf-dzis.txt"
#   moje liczby: 106 plikow, 90 bez testow. ★ CZWARTE LICZENIE DRYFU JEST ZAKAZANE.

# (5) ★★★ DEC-392 — kotwica G19 jest RUCHOMA; to zmienia wazność Twojego pakietu
bash -c "sed -n '/^## R[.] Decyzja CTO 04.09/,/^## S[.]/p' docs/program/REJESTR_ZNALEZISK_20260903.md"
#   oczekiwane: 'dowod wazny na dzien odbioru', 'wpis niesie date i SHA', '7 dni -> PASS_STALE'

# (6) WZOR PAKIETU DLA WLASCICIELA ISTNIEJE — czytasz go i nasladujesz JEGO STRUKTURE
ls -la docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md
bash -c "grep -nE '^#{1,2} ' docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md | head -30"
#   oczekiwane: 'Zanim zaczniesz', 'Jak zglaszac uwage', 'Czego NIE zglaszaj nigdy',
#   potem sekcje per modul. ★ TEN pakiet dotyczy G16; Twoj dotyczy G19 — to CO INNEGO.

# (7) SPOR O WERSJE STAGINGU JEST OTWARTY — Twoj pakiet MUSI to uwzglednic
bash -c "grep -n '1c4b5a5635\|fb6547b7d0' docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md | head"
#   oczekiwane: dwa sporne znaczniki wersji; Z28 zakazuje sprawdzenia ich na stagingu.
#   ★ Twoj pakiet podaje SHA, NA KTORYM OBOWIAZUJE, i NIE twierdzi, ze staging na nim stoi.

# (8) LISCIE SLOWNIKOW I CZTERY BRAMKI — maja byc IDENTYCZNE przed i po calym dyzurze
node -e 'const f=require("fs");function c(o){let n=0;const w=v=>{if(v&&typeof v==="object"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ["pl","en"])console.log(l,c(JSON.parse(f.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35199, en 33066; focus=0, list=0, artefakt=0, reach=0
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day361-g19-kubelek-c-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6432`. Twój JEDYNY port harnessu to `5572`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day361-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki (04.09 noc) — **nie dotykasz cudzych**: 359 (6430/5570), 360 (6431/5571), 361 (6432/5572), 362 (6433/5573). Wcześniejsze rodzeństwo 04.09: 343-346 (6390-6393 / 5530-5533), 347 (6394/5534), 348 (6395/5535), 349 (6396/5536), 350 (6397/5537), 351 (6410/5550), 352 (6411/5551), 353 (6412/5552), 354 (6413/5553), 355-358. ★★ RÓWNOLEGLE inny autor pisze instrukcje **363-366**; ich portów NIE ZNAM, więc obowiązuje reguła twarda: **bierzesz WYŁĄCZNIE swoje dwa porty i żaden inny**, a port zajęty jest powodem do STOP-u całości (`Z7`), nigdy do podmiany numeru. **Twoje własne wyłącznie: baza 6432, runtime 5572.** Zmierzyłem 04.09: `5570-5573` i `6430-6433` wszystkie wolne, kontenery `cx-day359-pg`…`cx-day362-pg` nie istnieją. ★ Kontener stawiasz **tylko wtedy**, gdy triaż wykaże wiersz zamykalny maszynowo — w przeciwnym razie ten dyżur bazy nie potrzebuje. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!` po starcie każdego procesu w tle)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK. Ten dyżur nie dodaje, nie zmienia i nie przełącza ANI JEDNEJ flagi funkcyjnej. ★★ ALE: **sprawdzenie flag jest częścią triażu**. Kilka razy w tym programie „właściciel nie ma funkcji X” znaczyło „funkcja jest za flagą OFF”, a raz odwrotnie — flaga wyglądała na OFF, bo zmienna środowiskowa omijała ją wczesnym `return true` w SZEŚCIU rodzinach. Zanim wpiszesz do pakietu krok „kliknij X”, sprawdź, czy X **jest widoczne dla właściciela na SHA, na którym pakiet obowiązuje** — i zapisz `plik:linia` flagi. Krok, którego właściciel nie może wykonać, unieważnia całą sekcję pakietu`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/check-triada.sh`, `scripts/check-gestosc.sh`, `scripts/dev/reachability-from-root.mjs`, `scripts/dev/p0p1-licznik-e1.mjs` i jego test, `.husky/pre-commit`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`. Wszystkie **NIETYKALNE DO ZAPISU** — wolno je wołać w pomiarze, nie wolno ich zmieniać. ★★ Dyżur 360 tworzy równolegle NOWY bezpiecznik `scripts/dev/g19-waznosc-dowodu.mjs` — **Ty go nie tworzysz i nie edytujesz**; jeżeli pojawi się w Twoim drzewie, znaczy to, że pomyliłeś gałąź. ★ Bramka, która przechodzi, bo nie mogła nic zmierzyć, nie jest wynikiem: każde wywołanie zapisujesz z kodem wyjścia ORAZ z liczbą zbadanych obiektów`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY361_G19_KUBELEK_C_REPORT.md`. Jedyne inne dokumenty do zmiany: **(a)** **NOWY** pakiet dla właściciela `docs/program/PRZELOT_WLASCICIELA_G19_20260904.md` (plik NIE ISTNIEJE na markerze — tworzysz go; **nie nadpisujesz** istniejącego `PRZELOT_WLASCICIELA_STAGING_20260904.md`, który dotyczy `G16` i jest nietykalny). **(b)** wiersze `G19` w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/{02_INTERVIEW,03_TOOLS,07_MY_WORK_AGENT,09_RESULTS,10_FINANCE,12_AUDITS,14_ADMIN,15_SETTINGS,16_PARTNER}/MODULE_ACCEPTANCE.md` — **WYŁĄCZNIE kolumna `G19`, WYŁĄCZNIE w tych dziewięciu, WYŁĄCZNIE z dowodem w tym samym commicie**. **Siedem modułów kubełka `A` (`01`, `04`, `05`, `06`, `08`, `11`, `13`) jest przedmiotem RÓWNOLEGŁEGO dyżuru 360 — nie dotykasz ich ANI RAZU.** `G15`, `G16`, `G18`, `G20` nietykalne w każdym module. **(c)** **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` — Twoja litera to **`AC`**; sprawdzasz ją komendą `bash -c "grep -nE '^## [A-Z]+[.]' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -5"` TUŻ PRZED commitem (dziś sekcje idą do `Z`, litera `V` wolna, ale zarezerwowana — nie zajmuj jej; jeżeli `AC` zajęta, bierzesz pierwszą wolną i zapisujesz to w raporcie). ★★ WSZYSTKIE dowody idą do `evidence/g19/day361/` (katalog NIE ISTNIEJE na markerze — tworzysz go) z `git add -f`. Nowe kontrakty testowe (gdyby powstały) idą do `tests/`, **NIGDY pod `src/`**, też z `git add -f`. Plik postępu `/private/tmp/cx-day361-postep.md` żyje POZA repo. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day361-g19-kubelek-c-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day361-g19-kubelek-c-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ HURTOWEGO PODNIESIENIA DZIEWIĘCIU WIERSZY.** To NIE jest dyżur od podnoszenia wierszy. Dyżur, którego produktem jest dziewięć wierszy zmienionych na podstawie jednego argumentu, jest dyżurem odrzuconym — i jest dokładnie powtórzeniem błędu, który ten dyżur ma **wykryć**. ★★★ **ZAKAZ UZNANIA PAKIETU DLA WŁAŚCICIELA ZA DOWÓD.** Pakiet jest **przygotowaniem**. Wiersz zmienia stan wyłącznie z dowodem załączonym w tym samym commicie. ★★★ **ZAKAZ ORZECZENIA „(c) oczy właściciela” BEZ KONKRETU.** Zdanie „przelot właściciela pozostaje wymagany”, powtórzone dziewięć razy, **NIE JEST orzeczeniem** — dokładnie tak wygląda etykieta przepisana hurtem, którą masz wykryć. Każde `(c)` musi mieć: **ekran, ścieżkę kliknięć, rekord (realny, nie pokazowy), co konkretnie ma się zmienić od odbioru i na co patrzeć**. ★★★ **ZAKAZ ROBIENIA ZRZUTÓW I RENDEROWANIA EKRANÓW** — to osobny tor; a `Z28` zakazuje łączenia się ze stagingiem, demo i produkcją w każdą stronę. ★★ **ZAKAZ TWIERDZENIA, ŻE STAGING STOI NA JAKIMKOLWIEK SHA.** Spór `1c4b5a5635` vs `fb6547b7d0` jest otwarty i **nierozstrzygalny bez połączenia**, którego nie wolno Ci nawiązać. Twój pakiet podaje **SHA, na którym obowiązuje**, i mówi wprost, że weryfikacja wersji stagingu należy do nadzorcy. ★★ **ZAKAZ CZWARTEGO LICZENIA DRYFU** — `106` / `90` jest policzone trzy razy zgodnie. ★★ **ZAKAZ DOTYKANIA SIEDMIU WIERSZY KUBEŁKA `A`** — idą równolegle w dyżurze 360. ★★ **ZAKAZ NADPISANIA `PRZELOT_WLASCICIELA_STAGING_20260904.md`** — to pakiet `G16`, nietykalny. ★★ **ZAKAZ WPISANIA `TECHNICAL_REGRESSION_PASS` I KAŻDEGO SYNONIMU** (odrzucony dwa razy). ★★ **ZAKAZ ZMIANY KODU PRODUKTU** (`src/**`, `server/src/**`) poza mutacją TYMCZASOWĄ, gdyby triaż wykazał wiersz zamykalny maszynowo — wtedy po `cp` do `SCRATCH`, przywracaną przez `cp`, **nigdy `git stash`** (`Z27`), z pustym `git diff`. ★ **ZAKAZ `pkill`/`killall`, `git stash`, `git push` poza własną gałęzią, `git fetch --all` oraz scalania czegokolwiek** | Bo dziewięć wierszy `G19` dostało tę samą etykietę i **osiem z nich ma w kolumnie uzasadnienia dosłownie to samo zdanie**: „Wspólne Bloki 1–3 zielone na markerze”. Autor dyżuru 353 sam nazwał swoją klasyfikację hipotezą i napisał, że jest **warunkowa względem decyzji o kotwicy**. Kotwica została rozstrzygnięta (`DEC-392`, 04.09), więc warunek odpadł — i teraz trzeba sprawdzić, czy etykieta się broni. ★ To jest kształt, który już nas kosztował: **„próbka zamiast zbioru”** (obejrzano dwa obiekty i ogłoszono stan całości) połączony z **„zamknięte ostatecznie na prototypie”** (status postawiony przy nierozpoczętym przeglądzie). Dziewięć razy „wymaga oczu właściciela” może być prawdą — ale może też być jednym zdaniem skopiowanym dziewięć razy, a różnica między tymi dwiema rzeczami to jest cały ten dyżur. ★ Drugi powód jest praktyczny: nawet jeśli etykieta jest prawdziwa, **właściciel nie ma czego kliknąć**. „Oczy właściciela na realnym rekordzie” to nie jest instrukcja. Pakiet, który mówi *gdzie wejść, w co kliknąć, na co patrzeć i czego NIE zgłaszać*, zamienia dziewięć zablokowanych wierszy w jedno posiedzenie właściciela — i to jest najtańsza droga do domknięcia bramki, jaką mamy |

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
cd /private/tmp/cx-day361-g19-kubelek-c

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day361-pg psql -U postgres -d cx361 \
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
cd /private/tmp/cx-day361-g19-kubelek-c

docker run -d --name cx-day361-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx361 \
  -p 127.0.0.1:6432:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day361-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6432/cx361 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6432/cx361 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day361-g19-kubelek-c && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6432/cx361 \
JWT_SECRET=cx361-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Ten dyżur w rdzeniu **nie potrzebuje bazy** — `R1`, `R2`, `R4` i `R5` to analiza dokumentów, kodu i historii gita. Kontener stawiasz **wyłącznie wtedy**, gdy `R2` wykaże wiersz zamykalny maszynowo (`R3`). Wtedy: kontener `cx-day361-pg`, port `6432`, baza `cx361`, obraz `pgvector/pgvector:pg16` (`postgres:15` **nie przechodzi migracji**), migracje **dwoma przebiegami na bazie OD ZERA**, drugi ma dać `Applying migrations: 0`; wariant (B) z cwd `server/`, `RUN_DB_TESTS=1`. ★★ PUŁAPKA: `NODE_ENV=test` **bez** `RUN_DB_TESTS=1` podstawia atrapę bazy pod `DbPromise` — `pg.Pool` widzi wiersz, kod produkcyjny nie; atrapa zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE` (`server/src/database/Database.ts:686`). **Każdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; podajesz `numTotalTests`. Przelot z zerem wykonanych przypadków kończy się `exit 0` i NIE JEST POMIAREM. `No test files found` oraz `Transform failed` to BŁĄD KOMENDY, nie `PASS`.** ★ Porównania po **NAZWACH przypadków** (`fullName`), nigdy po samych liczbach. Nowe kontrakty kładziesz w `tests/`, NIGDY pod `src/`, z `git add -f`; po każdym dodaniu pliku `node scripts/dev/reachability-from-root.mjs --check-baseline` (`exit 0`) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day361-g19-kubelek-c-artefakty/day361-g19-kubelek-c.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day361-g19-kubelek-c && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Ten dyżur w rdzeniu **nie potrzebuje bazy** — `R1`, `R2`, `R4` i `R5` to analiza dokumentów, kodu i historii gita. Kontener stawiasz **wyłącznie wtedy**, gdy `R2` wykaże wiersz zamykalny maszynowo (`R3`). Wtedy: kontener `cx-day361-pg`, port `6432`, baza `cx361`, obraz `pgvector/pgvector:pg16` (`postgres:15` **nie przechodzi migracji**), migracje **dwoma przebiegami na bazie OD ZERA**, drugi ma dać `Applying migrations: 0`; wariant (B) z cwd `server/`, `RUN_DB_TESTS=1`. ★★ PUŁAPKA: `NODE_ENV=test` **bez** `RUN_DB_TESTS=1` podstawia atrapę bazy pod `DbPromise` — `pg.Pool` widzi wiersz, kod produkcyjny nie; atrapa zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE` (`server/src/database/Database.ts:686`). **Każdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; podajesz `numTotalTests`. Przelot z zerem wykonanych przypadków kończy się `exit 0` i NIE JEST POMIAREM. `No test files found` oraz `Transform failed` to BŁĄD KOMENDY, nie `PASS`.** ★ Porównania po **NAZWACH przypadków** (`fullName`), nigdy po samych liczbach. Nowe kontrakty kładziesz w `tests/`, NIGDY pod `src/`, z `git add -f`; po każdym dodaniu pliku `node scripts/dev/reachability-from-root.mjs --check-baseline` (`exit 0`) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day361-g19-kubelek-c-artefakty/day361-g19-kubelek-c.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day361-g19-kubelek-c/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day361-pg psql -U postgres -d cx361 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day361-pg`.
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
> **(e) ★★★ **SIEDEM PUŁAPEK TEGO DYŻURU.** **(1) Etykieta przepisana hurtem wygląda jak orzeczenie.** Osiem z dziewięciu wierszy ma **identyczne** zdanie uzasadnienia. Twoim pierwszym zadaniem jest **zmierzyć to, a nie założyć** — i podpisać się pod wynikiem albo go obalić. **(2) „Wymaga oczu właściciela” bywa zasłoną dla „nikt nie sprawdził”.** Zanim napiszesz `(c)`, musisz wykluczyć `(a)` i `(b)` — czyli pokazać, że **istnieje** scenariusz i **istnieje** realny łańcuch, a mimo to maszyna nie orzeknie. Jeżeli tego nie pokażesz, `(c)` jest zgadywaniem. **(3) Pakiet dla właściciela, który nie mówi „czego NIE zgłaszać”, generuje pracę zamiast ją kończyć.** Istniejący pakiet `G16` ma tę sekcję i to jest jego najważniejsza część: bez niej właściciel zgłosi rzeczy świadomie odłożone do fali 2, a my rozliczymy je po raz trzeci. **(4) Rekord pokazowy nie jest rekordem odbiorowym.** „Ekran zatwierdzony na fiksturze ≠ ekran, który dostajesz z listy” kosztował nas tydzień przy Inicjatywach: realne rekordy otwierały nieodebraną powłokę, a zatwierdzony widok dostawały wyłącznie identyfikatory pokazowe. Każdy krok w Twoim pakiecie ma mówić **„otwórz rekord z prawdziwą nazwą”** i **„jeśli lista jest pusta — to jest uwaga, nie improwizuj”**. **(5) Dowód poza repo wyparowuje.** Pakiet i wszystkie artefakty idą **do repo** (`git add -f`), nie do katalogu tymczasowego. Bramka trzymająca `PASS` na manifeście w `/private/tmp`, którego już nie ma, wystąpiła w tym programie naprawdę. **(6) Dowód ma teraz TERMIN.** `DEC-392` daje siedem dni. Twój pakiet **musi nieść własną datę i SHA** oraz zdanie, kiedy wygasa — inaczej właściciel przeleci go po dziesięciu dniach i dostaniemy `PASS`, który już nie obowiązuje. **(7) Spór o wersję stagingu jest otwarty i nierozstrzygalny z Twojej strony.** `Z28` zakazuje połączenia. Pakiet podaje SHA, **na którym obowiązuje**, i jawnie oddaje weryfikację wersji nadzorcy — nigdy nie twierdzi, że staging na tym SHA stoi**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day361-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day361-g19-kubelek-c-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (trzy twarde zasady — czytasz) · R1 (**pomiar etykiety**: czy `OWNER_RETEST_PENDING` jest orzeczeniem indywidualnym, czy przepisanym hurtem — dowód, nie teza) · R2 (**triaż per wiersz**: `(a)` brak scenariusza / `(b)` brak realnego łańcucha / `(c)` oczy właściciela — z wykluczeniem dwóch pozostałych i z `plik:linia`) · R3 (**wyjęcie tego, co maszynowe**: jeżeli któryś wiersz da się zamknąć, zamykasz go z pełnym rygorem dowodu; jeżeli żaden — piszesz to wprost) · R4 (**pakiet dla właściciela** `docs/program/PRZELOT_WLASCICIELA_G19_20260904.md`) · R5 (podniesienie wierszy — **wyłącznie z dowodem**; zero podniesionych jest dopuszczalnym wynikiem) · R6 (raport i jedna sekcja rejestru). **Commit po KAŻDEJ pozycji `R`, a w `R2` po każdych trzech modułach**; pozycja bez commita jest pozycją niewykonaną`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6432` albo `5572` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6432` albo `5572`** (`Z7`).

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

Bramka `G19` stoi na `NOT_PROVEN / OWNER_RETEST_PENDING` we **wszystkich szesnastu** modułach.
Dyżur 353 podzielił je na dwa kubełki i **dziewięciu** przypisał etykietę „wymaga oczu
właściciela":

> `02_INTERVIEW` · `03_TOOLS` · `07_MY_WORK_AGENT` · `09_RESULTS` · `10_FINANCE` ·
> `12_AUDITS` · `14_ADMIN` · `15_SETTINGS` · `16_PARTNER`

**Ten dyżur nie podnosi tych wierszy. Ten dyżur ustala, czy ta etykieta jest prawdą.**

Powód jest twardy i policzalny: w `evidence/g19/day353/r4-orzeczenie.md` **osiem wierszy ma
w kolumnie „co zostało udowodnione" DOSŁOWNIE to samo zdanie** — „Wspólne Bloki 1–3 zielone
na markerze". Jednocześnie kolumna „czego brakuje" jest **zróżnicowana per moduł**. To jest
charakterystyczny rozjazd: **ktoś wiedział, czego brakuje, ale nie zmierzył, co jest.**
Autor 353 zresztą sam nazwał swoją klasyfikację **hipotezą warunkową względem decyzji
o kotwicy** — a kotwica została rozstrzygnięta 04.09 (`DEC-392`), więc warunek odpadł.

**Trzy produkty tego dyżuru, w tej kolejności:**

1. **Pomiar etykiety** — czy `OWNER_RETEST_PENDING` jest orzeczeniem indywidualnym, czy
   przepisanym hurtem. Odpowiedź obojętnie która, byle **zmierzona**.
2. **Triaż per wiersz**: brakuje `(a)` scenariusza, `(b)` realnego łańcucha
   (`ApiGateway` + JWT + Postgres), czy `(c)` oczu właściciela — a jeżeli `(c)`,
   to **co dokładnie ma zobaczyć i gdzie kliknąć**.
3. **Pakiet gotowy do wysłania właścicielowi** — nowy plik
   `docs/program/PRZELOT_WLASCICIELA_G19_20260904.md`, w stylu istniejącego
   `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` (kroki · na co patrzeć ·
   **czego NIE zgłaszać**).

★★★ **Ani jeden wiersz nie zmienia stanu bez dowodu. Pakiet dla właściciela NIE JEST dowodem —
jest przygotowaniem.** Jeżeli w triażu wyjdzie, że któryś wiersz da się zamknąć maszynowo —
**powiedz to i zamknij**, ale z pełnym rygorem: para na realnym PostgreSQL, mutacja celująca
w zabezpieczenie, `GREEN`→`RED`→`GREEN`, pusty `git diff`.

---

## ★ Co jest ZROBIONE — NIE POWTARZASZ

| Pozycja | Stan | Wynik, który dziedziczysz |
| --- | --- | --- |
| Przemiar dryfu | **ZROBIONY** trzy razy zgodnie | **106 plików**, **90 bez testów**. ★★★ **CZWARTE liczenie jest zakazane** |
| Kubełki `A`/`B`/`C` | **ZROBIONE** | `A = 01, 04, 05, 06, 08, 11, 13` (**7**, dyżur 360) · `B = 0` · `C` = Twoje **9** |
| Wzorzec dowodu (`day307`) | **WYKONANY** | obcy `404` / 64 B, właściciel `200` / 243 B; mutacja filtra organizacji → `200` zamiast `404`. `evidence/g19/day353/r2-day307-orzeczenie.md` |
| Pytanie o kotwicę | **ZADANE I ROZSTRZYGNIĘTE** | `DEC-392`, sekcja `R` rejestru: kotwica **ruchoma**, dowód ważny **na dzień odbioru**, wpis niesie **datę i SHA**, po **7 dniach** → `PASS_STALE` |
| Liczba `615` | **ZAMKNIĘTA JAKO NIEODTWARZALNA** | trzy warianty dają `1216` / `1015` / `315` |
| Wzór pakietu dla właściciela | **ISTNIEJE** | `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` — ★ dotyczy **`G16`**, nie `G19`; **naśladujesz strukturę, nie treść** |

---

## ★★ SPROSTOWANIE ZLECENIA — co mój pomiar potwierdził, a co doprecyzował

**POTWIERDZONE:**

| Teza | Mój pomiar |
| --- | --- |
| `G19`: 16 × `NOT_PROVEN / OWNER_RETEST_PENDING` | **potwierdzone** — w tym wszystkie dziewięć Twoich |
| kubełek `C` = 9 modułów | **potwierdzone**, z imionami: `02`, `03`, `07`, `09`, `10`, `12`, `14`, `15`, `16` |
| etykieta `OWNER_RETEST_PENDING` mogła być przepisana hurtem | **★ POTWIERDZONE POMIAREM**: `grep -c 'Wspólne Bloki 1–3 zielone na markerze'` w `r4-orzeczenie.md` daje **`8`** |
| `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` istnieje i nadaje się na wzór | **potwierdzone** — ma sekcje „Zanim zaczniesz", „Jak zgłaszać uwagę", „Czego NIE zgłaszaj nigdy" i sekcje per moduł z „Kroki" / „Co się zmieniło" / „Czego NIE zgłaszaj" |
| liście słowników `pl 35199` / `en 33066` | **potwierdzone** |

**DOPRECYZOWANE PRZEZ MÓJ POMIAR:**

- ★★★ **Hurt dotyczy kolumny DOWODU, nie kolumny DIAGNOZY.** Osiem wierszy ma identyczne
  „co zostało udowodnione", ale **każdy ma inne „czego brakuje"** (`02` → `NModeLeftNav`
  i formularze; `09` → `HelpButton`, `ErrorState`, PL/EN; `16` → realny rekord partnera…).
  To nie jest zwykłe kopiuj-wklej — to jest **diagnoza bez pomiaru**. Twoje `R1` ma to nazwać
  precyzyjnie, a nie ogłosić „wszystko przepisane hurtem".
- ★★ **Istniejący pakiet ma otwarty spór o wersję stagingu**: wskazuje `1c4b5a5635`
  i alternatywnie `fb6547b7d0`, i sam mówi, że dyżur 350 **nie zweryfikował tego na stagingu,
  bo obowiązuje `Z28`**. Twój pakiet dziedziczy to ograniczenie: podaje SHA, **na którym
  obowiązuje**, i nie twierdzi, że staging na nim stoi.
- ★★ **`DEC-392` daje dowodowi TERMIN — 7 dni.** Pakiet, który nie niesie własnej daty
  i SHA, po dziesięciu dniach wyprodukuje `PASS`, który już nie obowiązuje. **Twój pakiet ma
  mieć nagłówek z datą, SHA i dniem wygaśnięcia.**
- ★ **`09_RESULTS`, `12_AUDITS` i `15_SETTINGS` są jednocześnie przedmiotem RÓWNOLEGŁEGO
  dyżuru 362** (bramka `G15`, kolumna inna niż Twoja, ten sam plik). Patrz `B.4.6`.

★ **Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA

| Warstwa | Ścieżka | Licencja | Produkt |
| --- | --- | --- | --- |
| **orzeczenie 353 (odczyt)** | `evidence/g19/day353/r4-orzeczenie.md`, `r2-day307-orzeczenie.md`, `r3-piec-modulow-i-bloki.md`, `r5-podniesienie-i-pytanie-o-kotwice.md` | **tylko odczyt** — to jest Twój materiał wejściowy | cytaty w tabeli `R1` |
| **macierz — DZIEWIĘĆ modułów `C`** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/{02_INTERVIEW,03_TOOLS,07_MY_WORK_AGENT,09_RESULTS,10_FINANCE,12_AUDITS,14_ADMIN,15_SETTINGS,16_PARTNER}/MODULE_ACCEPTANCE.md` | **★ WĄSKA — WYŁĄCZNIE wiersz `G19`**, wyłącznie w tych dziewięciu, **wyłącznie z dowodem w tym samym commicie** | zmieniony wiersz + dowód |
| **macierz — SIEDEM modułów `A`** | `modules/{01,04,05,06,08,11,13}_*/MODULE_ACCEPTANCE.md` | **★ ZAKAZ ZAPISU** — równoległy dyżur 360 | brak zmian |
| **pakiet dla właściciela (NOWY)** | `docs/program/PRZELOT_WLASCICIELA_G19_20260904.md` | **★ ZAPIS — to jest główny produkt `R4`.** Plik **NIE ISTNIEJE** na markerze | pakiet, dziewięć sekcji |
| **pakiet `G16` (wzór)** | `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` | **★ NIETYKALNY DO ZAPISU** — naśladujesz strukturę, nie nadpisujesz pliku | wskazanie naśladowanych sekcji |
| **kod frontu (odczyt)** | `src/**`, w szczególności komponenty współdzielone z listy dryfu | **tylko odczyt** — ustalasz, co konkretnie się zmieniło od odbioru i co właściciel ma zobaczyć | `plik:linia` + zdanie do pakietu |
| **flagi (odczyt)** | `src/utils/betaAccess.ts`, `server/src/sharedRuntime/utils/betaMenuStatus.ts`, rodziny `import.meta.env` | **tylko odczyt** — sprawdzasz, czy krok pakietu jest wykonalny dla właściciela | `plik:linia` flagi + zdanie |
| **trasy i strażnicy (odczyt + uruchomienie)** | `server/src/routes/**`, `server/src/controllers/**`, `server/src/services/**` | **odczyt + uruchomienie istniejących testów**; **mutacja TYMCZASOWA wyłącznie w `R3`**, po `cp` do `SCRATCH`, przywracana przez `cp`, **nigdy `git stash`** (`Z27`) | nazwa trasy i strażnika `plik:linia`; w `R3` — mutacja w obie strony |
| **nowe kontrakty testowe** | `tests/**` (★ **NIGDY pod `src/`**) | **zapis** — wyłącznie w `R3`, `git add -f` | plik kontraktu + wynik |
| **dowody** | `evidence/g19/day361/**` (**NOWY** katalog) | **zapis, `git add -f`** — jawna licencja; „zakaz binariów w repo" byłby wymyślonym powodem | tabele triażu, logi, `*.json` |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY361_G19_KUBELEK_C_REPORT.md` | **zapis (główny produkt raportowy)** | raport |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA — JEDNA nowa sekcja, litera `AC`**; zakaz zajmowania litery `V` | jedna sekcja |
| **kod produktu (zapis)** | `src/**`, `server/src/**` | **★ ZAKAZ ZAPISU** poza mutacją tymczasową w `R3` | defekt → `plik:linia` + **diff nienałożony** |
| **bramki i harness** | `scripts/check-*.sh`, `scripts/dev/reachability-from-root.mjs`, `scripts/dev/p0p1-licznik-e1.mjs`, `scripts/dev/g19-waznosc-dowodu.mjs` (tworzy go **dyżur 360**), `tests/setup.ts`, `tests/helpers/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **NIETYKALNE DO ZAPISU** — wolno wołać w pomiarze | wyniki `0` |

---

## B.2. TABELA POZYCJI

| Poz. | Co robi | Rdzeń? | Wykonalne bez pliku przekrojowego? | Commit |
| --- | --- | --- | --- | --- |
| `R0` | trzy twarde zasady — czytasz | — | — | — |
| `R1` | **pomiar etykiety**: hurt czy orzeczenie | TAK | TAK — sam odczyt + `grep` | **TAK** |
| `R2` | **triaż per wiersz** `(a)`/`(b)`/`(c)` z wykluczeniem dwóch pozostałych | TAK | TAK — moduł po module | **TAK ×3** |
| `R3` | wyjęcie tego, co maszynowe — dowód albo jawne „żaden" | TAK | TAK | **TAK** |
| `R4` | **pakiet dla właściciela** | TAK | TAK — nowy dokument | **TAK** |
| `R5` | podniesienie wierszy wyłącznie z dowodem | TAK | TAK | **TAK** |
| `R6` | raport i jedna sekcja rejestru | — | TAK | **TAK** |

★ **Commit po KAŻDEJ pozycji `R`, a w `R2` po każdych trzech modułach.**

---

## B.3. TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | moduły kubełka `C` | `9` | `(1)`, `(3)` | TAK |
| 2 | moduły kubełka `A` — **nie dotykasz** | `7` | `(1)` | TAK |
| 3 | wiersze z identycznym zdaniem dowodu w `r4-orzeczenie.md` | `8` | `(2)` | TAK — ★ **teza `R1`** |
| 4 | wiersze `G19` kubełka `C` z identyczną etykietą w macierzy | `9` | `(3)` | TAK |
| 5 | pliki dryfu `G19` | `106` | `(4)` | TAK — **nie liczysz po raz czwarty** |
| 6 | pliki dryfu bez testów | `90` | `(4)` | TAK |
| 7 | okno ważności dowodu wg `DEC-392` | `7` dni | `(5)` | TAK |
| 8 | sekcje wzoru pakietu do naśladowania | `3` wspólne + `1` per moduł | `(6)` | TAK |
| 9 | sporne znaczniki wersji stagingu | `2` (`1c4b5a5635`, `fb6547b7d0`) | `(7)` | TAK — ★ **nierozstrzygalne z Twojej strony (`Z28`)** |
| 10 | wierszy podniesionych / dowodów załączonych | — | `R5`, dwa liczniki | TAK — **muszą być równe** |
| 11 | liście słowników i cztery bramki | `35199` / `33066`, cztery `0` | `(8)` | TAK — identyczne przed i po |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| Plik | Pozycja | Zakres |
| --- | --- | --- |
| `docs/program/PRZELOT_WLASCICIELA_G19_20260904.md` | `R4` | **NOWY** pakiet dla właściciela |
| `evidence/g19/day361/**` | `R1`–`R5` | **NOWY** katalog |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY361_G19_KUBELEK_C_REPORT.md` | `R6` | raport |
| `docs/program/REJESTR_ZNALEZISK_20260903.md` | `R6` | jedna nowa sekcja, litera `AC` |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Warunek | Zakres |
| --- | --- | --- |
| `modules/{02,03,07,09,10,12,14,15,16}_*/MODULE_ACCEPTANCE.md` | **wyłącznie** gdy `R3` da dowód maszynowy | **wyłącznie wiersz `G19`** |
| `tests/**` (nowe kontrakty) | gdy `R3` zamyka wiersz maszynowo | kontrakt + `git add -f` |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

`src/**` · `server/src/**` (poza mutacją tymczasową w `R3`) · `public/locales/**` ·
**siedem plików `MODULE_ACCEPTANCE.md` kubełka `A`** · żaden wiersz macierzy poza `G19` ·
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` · `scripts/**` ·
`.github/workflows/**` · `docs/ui-standards/**` ·
żaden plik dyżurów 359, 360, 362 ani 363–366.

★ Plik postępu `/private/tmp/cx-day361-postep.md` żyje **poza repo**.

### B.4.4. Zasoby wyłączne

Baza **6432**, runtime **5572**, kontener **`cx-day361-pg`**, baza **`cx361`**,
worktree `/private/tmp/cx-day361-g19-kubelek-c`, gałąź `codex/day361-g19-kubelek-c-20260904`.
Sprawdziłem 04.09: oba porty wolne, kontener nie istnieje, worktree nie istnieje,
gałąź nie istnieje.

★★ **Port zajęty = STOP CAŁOŚCI (`Z7`), NIGDY podmiana numeru.**

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
git status --short                  # zero plikow spoza tabeli B.4.1/B.4.2
git diff --cached --stat            # ★ commit dotykajacy macierzy MUSI zawierac plik dowodowy
git diff -- src/ server/src/        # PUSTY
bash -c "git diff --cached --name-only | grep -E 'modules/(01|04|05|06|08|11|13)_' && echo 'STOP: kubelek A' || echo 'kubelek A nietkniety'"
bash -c "git diff --cached --name-only | grep -q 'PRZELOT_WLASCICIELA_STAGING' && echo 'STOP: pakiet G16 nietykalny' || echo 'pakiet G16 nietkniety'"
bash -c "grep -rnE '^(<{7}|>{7}|={7})' \$(git diff --cached --name-only)"   # zero znacznikow konfliktu
```

### B.4.6. ★★ ROZŁĄCZNOŚĆ Z DYŻURAMI RÓWNOLEGŁYMI — czytaj, zanim dotkniesz macierzy

Cztery dyżury tej paczki dotykają **tych samych plików** `MODULE_ACCEPTANCE.md`, ale
**rozłącznych kolumn i modułów**:

| Dyżur | Kolumna | Moduły |
| --- | --- | --- |
| 359 | `G20` | wszystkie 16 |
| 360 | `G19` | `01`, `04`, `05`, `06`, `08`, `11`, `13` |
| **361 (Ty)** | **`G19`** | **`02`, `03`, `07`, `09`, `10`, `12`, `14`, `15`, `16`** |
| 362 | `G15` | `04`, `09`, `12`, `15` |

★ **Konflikt scalenia rozstrzyga nadzorca.** Nie próbujesz go uprzedzić, nie scalasz cudzej
gałęzi, nie „porządkujesz" cudzej kolumny i nie poprawiasz cudzego wiersza, nawet jeżeli
uważasz, że jest zły — **to jest znalezisko do raportu, nie do edytora**.

---

## R0 — TRZY TWARDE ZASADY (przeczytaj, zanim cokolwiek zrobisz)

**ZASADA 1 — wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM
commicie.** `git show --stat` musi zawierać plik z `evidence/g19/day361/**` albo plik testu.
Commit bez dowodu **cofasz przez `git reset --soft HEAD~1`**.
**Wpis bez dowodu = odrzucenie całego dyżuru.**

**ZASADA 2 — pakiet dla właściciela NIE JEST dowodem.** Jest przygotowaniem. Wolno go złożyć
i **nie podnieść ani jednego wiersza** — to jest pełnowartościowy wynik. Nie wolno go
złożyć **i podnieść wiersze na jego podstawie**.

**ZASADA 3 — `TECHNICAL_REGRESSION_PASS` był odrzucony DWA RAZY i nie wolno go wprowadzić pod
żadną nazwą.** Zakaz obejmuje każdy synonim brzmiący jak zaliczenie. ★ Jeżeli `R3` zamknie
któryś wiersz maszynowo, obowiązuje kształt z **pięcioma polami** (`R5`): `data=`, `sha=`,
`mianownik=… wg …`, pełna nazwa przypadku, ścieżka artefaktu.

★ **Jeżeli uważasz, że te trzy zasady razem czynią część dyżuru niewykonalną — to jest wynik
i zapisujesz go jako pytanie. Nie obchodzisz ich.**

---

## R1 — POMIAR ETYKIETY: HURT CZY ORZECZENIE (rdzeń, tani)

★★ **Teza, którą masz sprawdzić, nie potwierdzić.** Zlecenie mówi „sprawdź, czy ktoś nie
przepisał etykiety hurtem". Zapisz ją jako **pytanie pomiarowe**, nie jako fakt — bo hipoteza
nadzorcy potrafi wrócić jako „zweryfikowany fakt", jeżeli wykonawca jej nie zmierzy.

Dla **każdego** z dziewięciu wierszy:

1. **Cytat kolumny „co zostało udowodnione"** z `r4-orzeczenie.md`, dosłownie.
2. **Cytat kolumny „czego brakuje"**, dosłownie.
3. **Cytat kolumny dowodu z macierzy** (`MODULE_ACCEPTANCE.md`, wiersz `G19`), dosłownie.
4. **Orzeczenie:** czy te trzy cytaty razem opisują **ten moduł**, czy dowolny inny.
   Test operacyjny: **podmień w cytacie nazwę modułu na inną — czy zdanie dalej jest
   prawdziwe?** Jeżeli tak, to jest etykieta hurtowa.
5. **Twoja liczba:** ile z dziewięciu przechodzi ten test, a ile nie.

★★ **Nie kończ na „osiem to hurt".** Mój pomiar mówi, że **hurt siedzi w kolumnie dowodu,
a diagnoza jest zróżnicowana**. To znaczy coś konkretnego: **ktoś wiedział, czego brakuje,
ale nie zmierzył, co jest.** Sprawdź, czy tak jest naprawdę — i napisz to zdaniem, które
da się obalić.

**Wymagany dowód:** `evidence/g19/day361/r1-etykieta.md` — dziewięć wierszy × cztery cytaty
+ orzeczenie + Twoja liczba, oraz jedno zdanie werdyktu. **Commit po `R1`.**

---

## R2 — TRIAŻ PER WIERSZ: `(a)` / `(b)` / `(c)` (rdzeń, commit ×3)

Dla **każdego** z dziewięciu modułów przypisujesz **dokładnie jedną** kategorię — i musisz
**wykluczyć dwie pozostałe**, nie tylko wskazać jedną.

| Kategoria | Znaczenie | Co MUSISZ pokazać, żeby ją przypisać |
| --- | --- | --- |
| **`(a)` brak scenariusza** | nie ma opisu, co miałoby być udowodnione | wskazanie, że dla tego modułu nie istnieje ani jeden przypadek testowy pokrywający zmienioną ścieżkę — z komendą i liczbą |
| **`(b)` brak realnego łańcucha** | scenariusz jest, ale nikt go nie przepuścił przez `ApiGateway` + JWT + Postgres | **nazwa trasy i strażnika z `plik:linia`**, żeby dało się to zlecić maszynowo bez ponownego śledztwa; plus zdanie, dlaczego dzisiejszy test nie jest łańcuchem |
| **`(c)` oczy właściciela** | scenariusz jest, łańcuch jest, a mimo to maszyna nie orzeknie | **wykluczenie `(a)` i `(b)` dowodem** + **ekran, ścieżka kliknięć, rodzaj rekordu, co się zmieniło od odbioru, na co patrzeć** |

★★★ **Zdanie „przelot właściciela pozostaje wymagany" NIE JEST orzeczeniem `(c)`.** Powtórzone
dziewięć razy jest dokładnie tą etykietą hurtową, którą wykrywasz w `R1`. Wymagam konkretu,
na przykład: *„`09_RESULTS`: scenariusz istnieje (`tests/unit/results/…`), łańcuch istnieje
(`server/src/routes/resultsVnext/…`), ale zmiana dotyczy `HelpButton` i `ErrorState` w powłoce
współdzielonej — maszyna nie orzeknie, czy właściciel widzi POPRAWNY tekst po polsku;
właściciel wchodzi w Wyniki → otwiera realny raport z listy (nie „Przykład") → wywołuje stan
błędu przez odświeżenie z zerwaną siecią → patrzy, czy komunikat jest po polsku i czy
`HelpButton` otwiera pomoc"*.

★ **Sprawdź flagi**, zanim wpiszesz `(c)`. Krok, którego właściciel nie może wykonać, bo
funkcja jest za flagą OFF, unieważnia sekcję pakietu. Zapisz `plik:linia` flagi.
★★ Pamiętaj o kształcie **„flaga OFF w kodzie ≠ wyłączona"**: w sześciu rodzinach zmienna
środowiskowa omija flagę wczesnym `return true`.

**Wymagany dowód:** `evidence/g19/day361/r2-triaz.md` — dziewięć wierszy, kategoria,
**wykluczenie dwóch pozostałych**, `plik:linia`, liczby zbiorcze `(a)`/`(b)`/`(c)`.
**Commit po każdych trzech modułach.**

---

## R3 — WYJĘCIE TEGO, CO MASZYNOWE (rdzeń)

Jeżeli `R2` wykaże wiersz, który **da się zamknąć maszynowo** — zamykasz go, ale z pełnym
rygorem, bez ani jednego skrótu:

1. Kontener `cx-day361-pg`, port `6432`, baza `cx361`, obraz `pgvector/pgvector:pg16`.
   Migracje **dwoma przebiegami na bazie OD ZERA**; drugi ma dać `Applying migrations: 0`.
2. **Para** przez realny `ApiGateway` z realnym JWT: obcy odmowa, właściciel `200`
   **z niepustym ciałem**, na **tym samym identyfikatorze istniejącego obiektu**. Zapisz oba
   kody i obie długości. ★★ **Symetryczna odmowa nie jest dowodem** — to kształt „zamknięte
   przez wygaszenie": funkcja wyłączona dla wszystkich, bramka zielona, produkt martwy.
3. **Mutacja celująca w ZABEZPIECZENIE**, nie w mechanizm: kasujesz to, co odróżnia obcego od
   właściciela. Jeżeli test czerwienieje z **innego** powodu — chybiłeś, przecelowujesz
   i **zapisujesz, że pierwsza próba chybiła**. Mutacja po `cp` do `SCRATCH`, przywrócenie
   przez `cp` (**nigdy `git stash`**, `Z27`), `git diff` **pusty**.
4. **Przelot z `--retry=0` i `--reporter=json --outputFile=<ARTEFAKTY>`**, `numTotalTests`
   podany. ★★ Przelot z **zerem** wykonanych przypadków kończy się `exit 0` i **nie jest
   pomiarem**. `No test files found` i `Transform failed` to **BŁĄD KOMENDY**, nie `PASS`.
5. **Sprzątanie:** `docker rm -fv cx-day361-pg`, `df -h /` przed i po. ★ **Zakaz
   `pkill`/`killall`** — zabijasz wyłącznie własne PID-y.

★★ **Jeżeli ŻADEN wiersz nie da się zamknąć maszynowo — to jest wynik, nie porażka.**
Piszesz to wprost, **per moduł**, z powodem: *„`X` nie da się zamknąć maszynowo, bo …"*.
Wtedy kontenera nie stawiasz w ogóle i zapisujesz, że nie był potrzebny.

**Wymagany dowód:** albo pełny dowód dla wskazanych wierszy (para + mutacja + `numTotalTests`
+ pusty `git diff`), albo jawne zdanie „zero wierszy zamykalnych maszynowo, bo …" **per moduł**.
**Commit po `R3`.**

---

## R4 — PAKIET DLA WŁAŚCICIELA (rdzeń, główny produkt)

Tworzysz **NOWY** plik `docs/program/PRZELOT_WLASCICIELA_G19_20260904.md`.
Naśladujesz **strukturę** istniejącego `PRZELOT_WLASCICIELA_STAGING_20260904.md`
(**nie nadpisujesz go** — tamten dotyczy `G16` i jest nietykalny).

**Nagłówek pakietu — obowiązkowe pola:**

| Pole | Dlaczego obowiązkowe |
| --- | --- |
| **Czego dotyczy** | `G19` = „czy coś się zepsuło od czasu odbioru", a **nie** `G16` = „przed/po naprawach". Właściciel musi wiedzieć, czego szuka |
| **SHA, na którym pakiet obowiązuje** | `DEC-392`: wpis niesie datę i SHA |
| **Data wystawienia i dzień wygaśnięcia** | `DEC-392`: **7 dni**, potem `PASS_STALE` |
| **Zdanie o wersji stagingu** | spór `1c4b5a5635` vs `fb6547b7d0` jest otwarty; `Z28` zakazuje sprawdzenia. **Pakiet nie twierdzi, że staging stoi na tym SHA** — mówi, że weryfikację wersji robi nadzorca przed przelotem |
| **Ile to zajmie** | właściciel planuje czas; istniejący pakiet mówi „60–90 minut" |

**Sekcje wspólne (naśladujesz):** „Zanim zaczniesz" · „Jak zgłaszać uwagę" (jedna linia na
uwagę: **moduł · ekran · co widzę · czego oczekiwałem · zrzut**) · **„Czego NIE zgłaszaj
nigdy"**.

★★★ **Sekcja „Czego NIE zgłaszaj" jest najważniejszą częścią pakietu.** Bez niej właściciel
zgłosi rzeczy świadomie odłożone do fali 2 i rozliczymy je po raz trzeci. Do tej sekcji
wchodzą **wyłącznie** rzeczy, które masz **udokumentowane numerem decyzji albo ścieżką** —
nigdy Twoje przypuszczenia.

**Sekcja per moduł — dziewięć sekcji, każda z czterema polami:**

1. **Kroki** — dosłowna ścieżka kliknięć, od wejścia do modułu do obiektu obserwacji.
2. **Rekord** — ★★ **„otwórz rekord z PRAWDZIWĄ nazwą (klient, projekt, inicjatywa), nie
   »Showcase«, »Przykład«, »Demo«. Jeśli lista jest pusta — zapisz to jako uwagę, nie
   improwizuj na rekordzie pokazowym."** To zdanie ma być w **każdej** sekcji: rozjazd
   „ekran zatwierdzony na fiksturze ≠ ekran z listy" kosztował nas tydzień przy Inicjatywach.
3. **Co się zmieniło od odbioru** — konkretnie, z nazwą komponentu z listy dryfu (`02` →
   `NModeLeftNav` i formularze; `03` → formularze współdzielone i `ErrorState`; `07` →
   warunkowe renderowanie wspólnej powłoki; `09` → `HelpButton`/`ErrorState`/PL-EN;
   `10` → treść i stany warunkowe PL/EN; `12` → formularze i stany błędów/pustki;
   `14` → `HelpButton`/`ErrorState` i dane warunkowe; `15` → formularze współdzielone;
   `16` → realny rekord partnera w PL/EN). ★ **Sprawdź każde wskazanie w kodzie**, zanim je
   przepiszesz — to są wskazania dyżuru 353, nie ustalenia.
4. **Czego NIE zgłaszaj w tym module** — z numerem decyzji albo ścieżką.

★ **Język i motyw:** wzorzec mówi, że przełączenie PL↔EN i jasny↔ciemny wystarczy zrobić
**raz w całym przelocie**. Zachowaj to — pakiet ma być wykonalny w jednym posiedzeniu.

★ **Tabela na końcu**: dziewięć wierszy, kolumna na datę wykonania części, żeby właściciel
mógł rozłożyć przelot na raty.

**Wymagany dowód:** plik pakietu w repo · lista dziewięciu sekcji z czterema polami każda ·
zdanie w raporcie, które wskazania 353 potwierdziłeś w kodzie, a które obaliłeś.
**Commit po `R4`.**

---

## R5 — PODNIESIENIE WIERSZY (wyłącznie z dowodem)

1. Podnosisz **wyłącznie** wiersze zamknięte w `R3`, z **pięcioma polami**: `data=`, `sha=`,
   `mianownik=<liczba> wg <ścieżka>`, **pełna nazwa przypadku**, **ścieżka artefaktu**.
   Wiersz bez któregokolwiek pola jest wpisem bez dowodu.
2. **Wpis i dowód idą JEDNYM commitem.**
3. **Policz: ile wierszy podniosłeś, ile dowodów załączyłeś. Te dwie liczby mają być równe.**
4. **Zero podniesionych wierszy jest oczekiwanym i pełnowartościowym wynikiem tego dyżuru** —
   pod warunkiem, że `R1`, `R2` i `R4` są wykonane, a raport mówi **per moduł**, dlaczego.
5. ★ **Dla wierszy `(c)` zaproponuj brzmienie, którego użyje przyszły dyżur PO przelocie
   właściciela** — gotowy szablon z pustymi polami `data=`/`sha=`, żeby następny nie musiał
   go wymyślać. **Nie wpisujesz go do macierzy.**

**Wymagany dowód:** `git show --stat` każdego commita dotykającego macierzy · tabela
„wiersz → dowód → pięć pól" · dwie zgodne liczby · szablon dla `(c)`. **Commit po `R5`.**

---

## R6 — RAPORT I JEDNA SEKCJA REJESTRU

Raport `CODEX_DAY361_G19_KUBELEK_C_REPORT.md` zawiera, w tej kolejności:

1. **Każdą liczbę z tej instrukcji, którą Twój pomiar obalił** — osobną sekcją, na początku.
2. `R1`: werdykt o etykiecie, z liczbą i cytatami.
3. `R2`: tabela dziewięciu wierszy z kategorią i **wykluczeniem dwóch pozostałych**;
   liczby zbiorcze `(a)`/`(b)`/`(c)`.
4. `R3`: co zamknięto maszynowo albo jawne „zero, bo …" per moduł.
5. `R4`: co zawiera pakiet; **które wskazania dyżuru 353 potwierdziłeś w kodzie, a które
   obaliłeś** — imiennie.
6. `R5`: ile wierszy, ile dowodów; szablon dla `(c)`.
7. **Pytania do właściciela** — rozstrzygalne, z wariantami i konsekwencjami.
8. Co zostało niewykonane i dlaczego — imiennie, per moduł.
9. `df -h /` przed i po.

Sekcja w `docs/program/REJESTR_ZNALEZISK_20260903.md` — **litera `AC`**, sprawdzana komendą
**tuż przed commitem**:
`bash -c "grep -nE '^## [A-Z]+[.]' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -5"`.
Dziś sekcje idą do `Z`; litera `V` jest **wolna, ale zarezerwowana** — nie zajmuj jej.
Jeżeli `AC` jest zajęta, bierzesz pierwszą wolną i **zapisujesz to w raporcie**.

**Commit po `R6`.**

---

## Próg odbioru

Dyżur jest odebrany, gdy **wszystkie** poniższe są prawdziwe:

1. `R1` dał **zmierzony** werdykt o etykiecie `OWNER_RETEST_PENDING` — z cytatami dla
   wszystkich dziewięciu i testem „podmień nazwę modułu".
2. `R2` przypisał **każdemu** z dziewięciu dokładnie jedną kategorię `(a)`/`(b)`/`(c)`
   **z wykluczeniem dwóch pozostałych**; **ani jedno `(c)` nie brzmi „przelot właściciela
   pozostaje wymagany"** bez ekranu, ścieżki kliknięć, rodzaju rekordu i przedmiotu obserwacji.
3. Każde `(b)` niesie **nazwę trasy i strażnika z `plik:linia`** — gotową do zlecenia.
4. `R3` albo zamknął wskazane wiersze z parą, mutacją celującą w zabezpieczenie i pustym
   `git diff`, albo napisał **per moduł**, dlaczego się nie da.
5. Pakiet `docs/program/PRZELOT_WLASCICIELA_G19_20260904.md` istnieje, ma nagłówek z **SHA,
   datą i dniem wygaśnięcia**, sekcję **„Czego NIE zgłaszaj"** i **dziewięć** sekcji
   modułowych po cztery pola.
6. Pakiet **nie twierdzi**, że staging stoi na jakimkolwiek SHA.
7. Każdy podniesiony wiersz ma **pięć pól** i dowód w **tym samym** commicie; **liczba
   podniesionych = liczbie dowodów**. Zero podniesionych jest dopuszczalne.
8. **Żaden wiersz nie brzmi `TECHNICAL_REGRESSION_PASS` ani synonimem.**
9. **Ani jeden z siedmiu wierszy kubełka `A` nie został dotknięty**; pakiet `G16` nietknięty;
   `git diff` na kodzie produktu pusty.
10. Liście słowników i cztery bramki identyczne przed i po; kontener (jeżeli powstał) usunięty;
    `df -h /` przed i po w raporcie.

---

## Prawo zatrzymania

Zatrzymujesz się i piszesz **STOP** z powodem, jeżeli:

- którykolwiek z Twoich portów (`6432`, `5572`) jest zajęty — **STOP całości, nigdy podmiana**;
- `evidence/g19/day353/r4-orzeczenie.md` albo `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`
  **nie istnieje** — wtedy zniknęła podstawa albo wzór tego dyżuru i trzeba to zgłosić;
- sekcja `R` (`DEC-392`) rejestru nie istnieje — reguła ważności jest podstawą pakietu;
- realizacja `R5` wymagałaby wpisania stanu, który jest synonimem odrzuconego
  `TECHNICAL_REGRESSION_PASS`;
- pakiet wymagałby połączenia ze stagingiem, demo albo produkcją w którąkolwiek stronę
  (`Z28`) — **wtedy pakiet zostaje bez tego kroku, z jawną adnotacją**, a STOP dotyczy
  wyłącznie tego kroku, nie całości.

★ **Zatrzymanie z konkretnym powodem jest pełnowartościowym wynikiem dyżuru.**
Zmyślony dowód nie jest.

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para | Rozstrzygnięcie |
| --- | --- |
| „to nie jest dyżur od podnoszenia wierszy" × „jeżeli da się zamknąć — zamknij" | `R3` — zamykasz **tylko to**, co przejdzie pełny rygor dowodu; reszta zostaje |
| „pakiet dla właściciela" × „pakiet nie jest dowodem" | `R0` zasada 2 — pakiet to przygotowanie; wiersz zmienia stan wyłącznie z dowodem |
| „ustal, czego brakuje" × „zakaz robienia zrzutów i renderowania" | `R2` — ustalasz **z kodu i historii**, a wynikiem jest instrukcja dla oczu właściciela, nie obraz |
| „sprawdź, czy etykieta jest hurtowa" × „nie zamieniaj tezy nadzorcy w fakt" | `R1` — teza jest **pytaniem pomiarowym**; obie odpowiedzi pełnowartościowe, byle zmierzone |
| „naśladuj istniejący pakiet" × „nie nadpisuj go" | `B.1` — nowy plik `PRZELOT_WLASCICIELA_G19_20260904.md`; tamten dotyczy `G16` |
| „pakiet ma mówić, na czym stoi" × „`Z28` zakazuje sprawdzenia stagingu" | `R4`, nagłówek — pakiet podaje **SHA, na którym obowiązuje**, i oddaje weryfikację wersji nadzorcy |
| „dowód ważny 7 dni" × „pakiet dla właściciela na później" | `R4` — pakiet **niesie własną datę wygaśnięcia**; przelot po terminie wymaga odświeżenia pomiaru, nie nowego pakietu |
| „zakaz zmiany kodu produktu" × „mutacja w `R3`" | `B.1` — mutacja **tymczasowa**, po `cp`, przywracana przez `cp`, z pustym `git diff` |
| „dziewięć wierszy" × „zakaz hurtu" | `R2` — każdy wiersz ma **własne** wykluczenie dwóch kategorii; dziewięć takich samych uzasadnień = dyżur odrzucony |
| „`git add -f` dla dowodów" × „zakaz binariów w repo" | `B.1` — jawna licencja na `evidence/g19/day361/**` |
| „mandat CTO — decyduj sam" × „pytania do właściciela" | `R6` punkt 7 — triaż i pakiet rozstrzygasz sam; do właściciela idzie wyłącznie to, co wymaga jego oczu albo decyzji produktowej |

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na `2a7273e087`; zero `BRAK`. Oznaczone `NOWY`: `docs/program/PRZELOT_WLASCICIELA_G19_20260904.md`, `evidence/g19/day361/**`, raport, sekcja `AC` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, jedenaście wierszy; liczba `8` (etykieta hurtowa) zmierzona przeze mnie 04.09 |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (cytat · zdanie · wskazanie `plik:linia`) |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `B.2`, kolumna 4; `R2` idzie moduł po module, `R4` to jeden nowy dokument |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `B.4.4` i **`B.4.6`** (rozłączność kolumn i modułów wobec 359, 360, 362); `6432`/`5572` zmierzone jako wolne. ★ 363–366 pisze inny autor — `Z7` zaostrzony |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c` |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu dyżurowi (siedem) | TAK — `§0.2d` w części A + siedem pułapek w polu pułapek |
| 9 | Samodzielność — zero odwołań do rozmów bez ścieżki | TAK; każdy cytat pracy 353 ma ścieżkę artefaktu |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
