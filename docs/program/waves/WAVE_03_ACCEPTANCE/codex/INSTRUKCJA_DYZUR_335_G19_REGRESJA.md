# INSTRUKCJA DYŻURU nr 335 — Codex — „★★★ BRAMKA G19 — SZESNAŚCIE WIERSZY `NOT_PROVEN / OWNER_RETEST_PENDING` ROZŁOŻONE NA TRZY KUBEŁKI, I WYKONANIE TEGO, KTÓRY DA SIĘ WYKONAĆ MASZYNOWO. Wszystkie 16 wierszy G19 stoją dziś na `NOT_PROVEN`; propozycja poprzedniego dyżuru, żeby wpisać `TECHNICAL_REGRESSION_PASS`, została ODRZUCONA przez odbiorcę (odbiór dyżuru 290 §2.5: „Wariant 1 pozostaje niedostępny”) — i tej decyzji NIE odwracasz. ★★ Kluczowy pomiar, który daję z góry i który masz powtórzyć: cały dowód G19 stoi na ZAMROŻONYM markerze `fee24bddb0`, a HEAD jest **544 commity dalej**; na ścieżkach współdzielonych, które G19 mierzy z definicji, zmieniły się od tamtego pomiaru **104 pliki** (89 bez testów: 77 serwer + 10 UI + 2 słowniki) — czyli sam mianownik bramki „obowiązki regresji po późniejszych zmianach” UROSŁA po jej zmierzeniu, a znalezisko `G19-Z3` („0 plików”) było prawdziwe wtedy i jest fałszywe dziś. ★ Drugi trop: dziura zapisana w dowodzie jako GRANICA („sondy NIE obejmują dostępu obcej organizacji do ISTNIEJĄCEGO obiektu właściciela”) mogła zostać zamknięta PÓŹNIEJ przez dyżur 307 (`server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts`, przelot PAROWANY obcy+właściciel, odebrany jako GOTOWE z zastrzeżeniami) — sprawdź to, zanim cokolwiek zbudujesz od zera"

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
> **wyłącznie** `/private/tmp/cx-day335-g19-regresja`.

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
Zakres: **PRZEKROJOWE — bramka G19 („Later-change regression obligations resolved”) macierzy odbioru fali 3, wszystkie 16 modułów. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plikiem postępu `/private/tmp/cx-day335-postep.md` (poza repo)**.
Trasy front: `Powierzchnia współdzielona, którą G19 mierzy z definicji (do ODCZYTU i do pomiaru, nie do przebudowy): `src/components/standard/**`, `src/components/shared/**`, `src/components/ui/**`, `src/index.css`, `tailwind.config.js`, `public/locales/{pl,en}/translation.json`. Pliki UI zmienione PO markerze G19 `fee24bddb0` (moja liczba: 10) — m.in. `src/components/shared/NModeLayout/NModeLeftNav.tsx`, `src/components/shared/AICardDraftModal.tsx`, `src/components/shared/ToolWizard/ToolWizardShell.tsx`, `src/components/shared/forms/{DatePicker,MultiSelect,PriorityPicker,Select}.tsx`, `src/components/ui/HelpButton.tsx`, `src/components/ui/primitives/ErrorState.tsx`, `src/index.css``. Trasy tył: ``server/src/middleware/**` (w tym `auth.middleware.ts`, `mfaEnrollmentToken.middleware.ts`, `requireAudit`, `appErrorMapper.ts`) oraz `server/src/routes/**` — razem 77 plików serwerowych bez testów zmienionych PO markerze G19. Istniejące dowody, które masz NAJPIERW zinwentaryzować, a nie budować od nowa: `server/src/routes/__tests__/day290-g19-http-flight.pg.test.ts`, `server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts` (★ przelot PAROWANY obcy+właściciel, `it('denies foreign workload lookup while the owner reads the seeded task')`), `server/src/routes/__tests__/initiativesExecutionRuntime.dropdown.pg.test.ts`, `server/src/routes/__tests__/day277-decyzje-zapis.pg.test.ts` (★ dwie czerwienie Bloku 3 — przestarzały payload wobec pola `escalation`), `server/src/middleware/__tests__/mfaEnrollmentToken.middleware.test.ts``.

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
WT=/private/tmp/cx-day335-g19-regresja
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
git -C "$VAULT" worktree add "$WT" -b codex/day335-g19-regresja-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day335-g19-regresja/config.worktree"
cat "$VAULT/worktrees/cx-day335-g19-regresja/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day335-g19-regresja-scratch
mkdir -p /private/tmp/cx-day335-g19-regresja-artefakty

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
git -C "$WT" push github-backup codex/day335-g19-regresja-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 1c4b5a5635bafd38ef375227824ada9b62be186e..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `10` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: WSZYSTKIE 16 wierszy G19 stoja na NOT_PROVEN / OWNER_RETEST_PENDING
for m in docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/; do \
  printf '%s :: ' "$(basename $m)"; \
  grep -E '^\|[[:space:]]*G19\b' "$m/MODULE_ACCEPTANCE.md" | head -1 | awk -F'|' '{print $4}'; \
done
#   oczekiwane: 16 wierszy, kazdy " `NOT_PROVEN / OWNER_RETEST_PENDING` "

# (2) ★★ TEZA ROZSTRZYGAJACA: marker dowodu G19 (fee24bddb0) jest DALEKO za HEAD
git merge-base --is-ancestor fee24bddb0 HEAD && echo 'fee24bddb0 = PRZODEK HEAD' || echo 'NIE przodek'
echo "commitow fee24bddb0..HEAD: $(git rev-list --count fee24bddb0..HEAD)"
#   moje liczby: przodek; 544 commity

# (3) ★★ TEZA ROZSTRZYGAJACA: mianownik G19 UROSL po jego zmierzeniu
git diff --name-only fee24bddb0 HEAD -- \
  src/components/standard src/components/shared src/components/ui \
  src/index.css tailwind.config.js public/locales \
  server/src/middleware server/src/routes > "/private/tmp/cx-day335-g19-regresja-artefakty/g19-dryf.txt"
wc -l < "/private/tmp/cx-day335-g19-regresja-artefakty/g19-dryf.txt"
grep -vcE '__tests__|\.test\.' "/private/tmp/cx-day335-g19-regresja-artefakty/g19-dryf.txt"
grep -cE '^src/' "/private/tmp/cx-day335-g19-regresja-artefakty/g19-dryf.txt"
#   moje liczby: 104 pliki razem; 89 bez testow; 10 UI
#   ★ To jest DOKLADNIE ta sama komenda, ktora inwentarz G19 nazywa "poleceniem wzorcowym",
#   tyle ze z markera dowodu do HEAD. Znalezisko G19-Z3 mowi "0 plikow" — bylo prawdziwe,
#   gdy HEAD ~ fee24bddb0. Jesli Twoja liczba tez jest >0, bramka mierzy NIEAKTUALNY zbior.

# (4) TEZA: obowiazek jest JEDEN, nie szesnascie — 16 kotwic G18 daje TRZY rozne zbiory
for m in docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/; do \
  printf '%s ' "$(basename $m)"; \
  grep -oE 'wiersza `G18` = `[0-9a-f]+`' "$m/MODULE_ACCEPTANCE.md" | head -1; \
done | sort -k2
#   oczekiwane: 316bce9dd9 (x2), 08775ced65 (x10), 85dfe6c3e2, 4d402fcfc8 (x2), 97c8293786, 075735c395
#   ★ Sprawdz SAM, czy zbior 28-plikowy jest PODZBIOREM 49-plikowego (teza inwentarza G19-Z2).

# (5) ★★ TEZA: dziura izolacji D-a2 mogla zostac zamknieta POZNIEJ, przez dyzur 307
ls -l server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts
git log --oneline -3 -- server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts
grep -n "it(\|denies foreign\|expect(denied" server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts | head -10
#   oczekiwane: plik istnieje; commity `8865552775` i `bdf71ee7f1`; przypadek
#   "denies foreign workload lookup while the owner reads the seeded task" z asercja 404.
#   ★ To jest PARA: obcy nie widzi + wlasciciel widzi. Dokladnie to, czego brakowalo w G19.

# (6) TEZA: dowody G19 leza w evidence/g19 i sa czytelne
ls evidence/g19/
sed -n '1,20p' evidence/g19/przelot-http.md
#   oczekiwane: 26 plikow; przelot 12/12 z jawna korekta "obcy OWNER poprawnie otrzymal 200
#   dla SWOJEJ organizacji" i jedyna sonda po id obiektu = symetryczne 404/404

# (7) TEZA: dwie czerwienie Bloku 3 to przestarzaly payload testu, nie defekt produktu
ls server/src/routes/__tests__/day277-decyzje-zapis.pg.test.ts
grep -rn "escalation" server/src/schemas/ | head -5
#   oczekiwane: plik testu istnieje; pole `escalation` jest nullable, ale NIEOPCJONALNE
#   w schemacie `ReplaceDecisionEnhancementsSchema` (ok. wiersz 220)

# (8) TEZA: werdykt "TECHNICAL_REGRESSION_PASS" zostal ODRZUCONY i tego NIE odwracasz
grep -n "Wariant 1" docs/program/waves/WAVE_03_ACCEPTANCE/codex/ODBIOR_DYZUROW_286_290_291_20260903.md | head -5
#   oczekiwane: zdanie "Wariant 1 pozostaje niedostepny; obowiazuje NOT_PROVEN / OWNER_RETEST_PENDING"

# (9) TEZA: liscie slownikow na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35198, en 33065

# (10) zasoby: dysk, porty, kontener
df -h /
lsof -nP -iTCP:6371 -sTCP:LISTEN; lsof -nP -iTCP:5511 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day335 || true
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day335-g19-regresja-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6371`. Twój JEDYNY port harnessu to `5511`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day335-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki 04.09 — nie dotykasz: 334 (6370/5510), 336 (6372/5512), 337 (6373/5513). Starsze rodzeństwo 04.09: 330 (6356/5496), 331 (6357/5497), 332 (6358/5498), 333 (6359/5499). Cudze worktree 286-298 używają 6290-6299 i 5250-5269. Twoje własne wyłącznie: baza 6371, harness 5511. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK. Ten dyżur nie dodaje, nie zmienia i nie przełącza ANI JEDNEJ flagi funkcyjnej. Jeżeli któryś dowód wymaga włączenia flagi, żeby przejść — to jest ZNALEZISKO do raportu i granica dowodu, nigdy zmiana domyślnej wartości flagi`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`. Model uprawnień NIETYKALNY do zapisu: `server/src/middleware/auth.middleware.ts`, `server/src/middleware/mfaEnrollmentToken.middleware.ts`, `server/src/middleware/requireAudit*`, `server/src/services/ApiGateway.ts` — wolno je WOŁAĆ w dowodzie, nie wolno ich zmieniać. Wyjątek: jeżeli dowód mutacyjny wykaże REALNĄ dziurę izolacji, naprawa jest dozwolona i staje się głównym produktem pozycji — z osobnym commitem i dowodem w obie strony`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY335_G19_REGRESJA_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/<MODUŁ>/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE wiersz `G19` i WYŁĄCZNIE pod twardym warunkiem z `R0`: wiersz zmienia stan tylko wtedy, gdy dowód jest załączony w TYM SAMYM commicie. Dodatkowo dopuszczalne dopisanie plików dowodowych pod `evidence/g19/` (katalog istnieje) oraz jednego wiersza w `docs/program/REJESTR_ZNALEZISK_20260903.md`. **ZAKAZ dotykania wierszy `G00`–`G18` i `G20`.** Plik postępu `/private/tmp/cx-day335-postep.md` żyje POZA repo. Nowe pliki w `tests/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day335-g19-regresja-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day335-g19-regresja-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ WPISANIA `PASS` LUB `TECHNICAL_REGRESSION_PASS` DO WIERSZA `G19` W JAKIMKOLWIEK MODULE.** Wariant `TECHNICAL_REGRESSION_PASS` został jawnie ODRZUCONY przez odbiorcę dyżuru 290 (§2.5) i tej decyzji nie odwracasz — także wtedy, gdy Twoje pomiary wyjdą zielone. **ZAKAZ zmiany stanu wiersza macierzy bez dowodu załączonego W TYM SAMYM COMMICIE** — wpis i dowód są jednym commitem albo nie ma wpisu; wpis bez dowodu jest podstawą odrzucenia CAŁEGO dyżuru. **ZAKAZ przyjęcia symetrycznej odpowiedzi (`404/404`, `200/200`) jako dowodu izolacji** — dowodem jest PARA: „obcy NIE widzi konkretnego, ISTNIEJĄCEGO obiektu właściciela” **oraz** „właściciel TEN SAM obiekt widzi”; sama odmowa dla obu stron to kształt „zamknięte przez wygaszenie”. **ZAKAZ używania atrapy bazy jako dowodu zapisu** — `Database.ts:686` zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE`. **ZAKAZ `--retry` innego niż `0`.** **ZAKAZ zmiany progu, asercji lub zakresu istniejącego testu, żeby zzielenieć** — jeżeli test jest przestarzały wobec schematu, naprawiasz PAYLOAD testu i pokazujesz mutacyjnie, że nadal broni tego, co bronił | G19 to jedyna bramka macierzy, w której wszystkie 16 wierszy stoją na `NOT_PROVEN`, mimo że wykonano pod nią bardzo dużo realnej pracy pomiarowej. Poprzedni dyżur chciał to zamknąć nazwą wariantu; odbiorca odrzucił nazwę, bo nazwa nie jest dowodem. Ale prawdziwy powód, dla którego bramka nie ma prawa dziś zzielenieć, jest inny i nikt go dotąd nie policzył: cały dowód stoi na markerze sprzed 544 commitów, a bramka z definicji mierzy „obowiązki regresji po PÓŹNIEJSZYCH zmianach”. Bramka, której mianownik urósł po pomiarze, mierzy przeszłość. Jednocześnie część brakujących dowodów mogła już powstać w późniejszych dyżurach (307, 321, 325, 326, 331) — i wtedy praca polega na ZNALEZIENIU i PODPIĘCIU dowodu, nie na zbudowaniu go po raz drugi |

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
cd /private/tmp/cx-day335-g19-regresja

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day335-pg psql -U postgres -d cx335 \
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
cd /private/tmp/cx-day335-g19-regresja

docker run -d --name cx-day335-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx335 \
  -p 127.0.0.1:6371:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day335-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6371/cx335 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6371/cx335 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day335-g19-regresja && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6371/cx335 \
JWT_SECRET=cx335-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Testy serwerowe z cwd `server/`, z `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6371/cx335` (uruchomienie z roota bez właściwego configu daje `No test files found` — to BŁĄD KOMENDY, nie PASS): `server/src/routes/__tests__/day290-g19-http-flight.pg.test.ts`, `server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts`, `server/src/routes/__tests__/day277-decyzje-zapis.pg.test.ts`, `server/src/routes/__tests__/initiativesExecutionRuntime.dropdown.pg.test.ts`, `server/src/middleware/__tests__/mfaEnrollmentToken.middleware.test.ts`. Testy frontu z roota, wariant (C) `RUN_DB_TESTS=0 MOCK_DB=true`: blok 1 (18 plików podglądu/tabeli, wspólny dla wszystkich 16 modułów). Wszystko z `--retry=0` i `--reporter=json --outputFile=`. Dowody mutacyjne obowiązkowe dla: izolacji cross-org na ISTNIEJĄCYM obiekcie (usuń warunek organizacji w zapytaniu, pokaż że obcy widzi; przywróć przez `cp`), oraz dla każdego testu, którego payload naprawiasz --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day335-g19-regresja-artefakty/day335-g19-regresja.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day335-g19-regresja && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Testy serwerowe z cwd `server/`, z `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6371/cx335` (uruchomienie z roota bez właściwego configu daje `No test files found` — to BŁĄD KOMENDY, nie PASS): `server/src/routes/__tests__/day290-g19-http-flight.pg.test.ts`, `server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts`, `server/src/routes/__tests__/day277-decyzje-zapis.pg.test.ts`, `server/src/routes/__tests__/initiativesExecutionRuntime.dropdown.pg.test.ts`, `server/src/middleware/__tests__/mfaEnrollmentToken.middleware.test.ts`. Testy frontu z roota, wariant (C) `RUN_DB_TESTS=0 MOCK_DB=true`: blok 1 (18 plików podglądu/tabeli, wspólny dla wszystkich 16 modułów). Wszystko z `--retry=0` i `--reporter=json --outputFile=`. Dowody mutacyjne obowiązkowe dla: izolacji cross-org na ISTNIEJĄCYM obiekcie (usuń warunek organizacji w zapytaniu, pokaż że obcy widzi; przywróć przez `cp`), oraz dla każdego testu, którego payload naprawiasz --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day335-g19-regresja-artefakty/day335-g19-regresja.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day335-g19-regresja/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day335-pg psql -U postgres -d cx335 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day335-pg`.
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
> **(e) ★★★ **SZEŚĆ PUŁAPEK.** (1) **Symetryczna odmowa nie jest izolacją.** `404/404` dla obcego i właściciela oznacza, że obiektu nie ma — funkcja jest wygaszona dla wszystkich. Wymagana jest PARA: obcy dostaje odmowę, właściciel TEN SAM obiekt czyta. (2) **`200/200` też bywa poprawne** — jeżeli trasa jest listą własnej organizacji, obcy OWNER prawidłowo dostaje `200` ze SWOIMI danymi; dowodem izolacji jest wtedy BRAK identyfikatorów właściciela w treści odpowiedzi, nie kod HTTP. To jest zapisane wprost w `evidence/g19/przelot-http.md`. (3) **Atrapa bazy kłamie o zapisie**: `Database.ts:686` zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE` — każdy dowód zapisu warunkowego wyłącznie na realnym PostgreSQL. (4) **`NODE_ENV=test` bez `RUN_DB_TESTS=1` podstawia atrapę pod `DbPromise`** — `pg.Pool` widzi wiersz, kod produkcyjny nie; wtedy „200 OK” jest fałszywe w drugą stronę. (5) **`describe.runIf`/`skipIf` i `No test files found`**: przebieg, w którym wykonało się 0 przypadków, kończy się `exit 0` — to NIE jest PASS, to brak pomiaru. Zawsze wypisuj liczbę WYKONANYCH przypadków, nie tylko liczbę porażek. (6) **`grep --include` w `zsh` zwraca pustkę zamiast wyników** — uruchamiaj przez `bash -c '…'` i sprawdzaj, że komenda się wykonała; pustka nie jest wynikiem**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day335-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day335-g19-regresja-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarda zasada dowodu w tym samym commicie — przeczytaj przed czymkolwiek) · R1 (pomiar dryfu: ile powierzchni współdzielonej zmieniło się PO markerze dowodu G19 — RDZEŃ) · R2 (podział 16 wierszy na trzy kubełki, wiersz po wierszu, z uzasadnieniem — RDZEŃ) · R3 (wykonanie kubełka maszynowego, w tym para izolacyjna cross-org, z dowodem mutacyjnym — RDZEŃ) · R4 (dwie czerwienie Bloku 3 i cztery Bloku 1: klasa ZASTANA/NOWA orzeczona, nie zamilczona) · R5 (pakiet do przelotu właściciela dla kubełka wymagającego oczu) · R6 (raport)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6371` albo `5511` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6371` albo `5511`** (`Z7`).

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

Bramka **G19 — „Later-change regression obligations resolved"** ma **16 wierszy i wszystkie
stoją na `NOT_PROVEN / OWNER_RETEST_PENDING`**. Nie dlatego, że nikt nic pod nią nie zrobił —
pracy pomiarowej jest bardzo dużo i leży w `evidence/g19/`. Dlatego, że **dowód nie domyka
definicji**, a próba domknięcia go **nazwą wariantu** (`TECHNICAL_REGRESSION_PASS`) została
przez odbiorcę **jawnie odrzucona**: „Wariant 1 pozostaje niedostępny; obowiązuje
`NOT_PROVEN / OWNER_RETEST_PENDING`" (odbiór dyżuru 290, §2.5). **Tej decyzji nie odwracasz.**

**Definicja operacyjna bramki**, zapisana w `G19_INWENTARZ_OBOWIAZKOW_20260903.md` i wiążąca
dla tego dyżuru:

> G19 modułu M jest zamknięte wtedy i tylko wtedy, gdy dla KAŻDEGO pliku w zadeklarowanym
> zbiorze powierzchni współdzielonych, który zmienił się między SHA odbioru modułu M (`G18`)
> a zamrożonym markerem finalnym, istnieje dowód wykonany NA TYM MARKERZE, że powierzchnia
> modułu M dalej zachowuje się zgodnie z tym, co właściciel odebrał — osobno dla warstwy
> wizualnej i osobno dla warstwy serwerowej — a plik bez żadnego z tych dwóch dowodów jest
> **wypisany z nazwy jako otwarty dług**.

**★★ I tu jest rzecz, której nikt dotąd nie policzył.** Cały dowód G19 został wykonany na
**zamrożonym markerze `fee24bddb0`**. Dziś `HEAD` jest **544 commity dalej**. Na dokładnie
tych ścieżkach współdzielonych, które definicja wymienia, zmieniły się od tamtego pomiaru
**104 pliki** (89 bez testów: 77 serwerowych, 10 UI, 2 słowniki). Znalezisko `G19-Z3`
z inwentarza mówi „`git diff --name-only fee24bddb0 HEAD -- <ścieżki współdzielone>` → **0
plików**" — i to **było prawdą**, kiedy `HEAD` był praktycznie równy `fee24bddb0`.
**Dziś jest fałszem.** Bramka, która mierzy „obowiązki po późniejszych zmianach", mierzy
dziś przeszłość.

**★ Drugi trop, przeciwny w wymowie.** Dziura zapisana w dowodzie jako **GRANICA** —
„sondy NIE obejmują dostępu obcej organizacji do **istniejącego** obiektu właściciela"
(`evidence/g19/przelot-http.md`) — mogła zostać **zamknięta później**, przez dyżur 307:
`server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts` jest przelotem
**parowanym** (obcy **i** właściciel) i zawiera przypadek
`denies foreign workload lookup while the owner reads the seeded task`. Dyżur 307 został
odebrany jako **GOTOWE (z zastrzeżeniami)** i jego commity (`8865552775`, `bdf71ee7f1`)
leżą na `HEAD`. **Sprawdź to, zanim zbudujesz cokolwiek od zera** — najtańszy dowód to ten,
który już istnieje i trzeba go tylko znaleźć i podpiąć.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze `1c4b5a5635bafd38ef375227824ada9b62be186e`:

- **16/16** wierszy `G19` = `NOT_PROVEN / OWNER_RETEST_PENDING`; zero `PASS`, zero
  `PARTIAL_PASS`;
- `fee24bddb0` **jest przodkiem** `HEAD`; między nimi **544 commity**;
- na ścieżkach współdzielonych: **104 pliki**, **89** bez testów, **10** w `src/`,
  **77** serwerowych bez testów, **2** słowniki;
- 16 kotwic `G18` redukuje się do **sześciu różnych SHA** i **trzech** różnych zbiorów zmian:
  `316bce9dd9` → 49 plików (moduły `01`, `08`), `08775ced65` → 30 plików (10 modułów),
  cztery późne SHA (`85dfe6c3e2`, `4d402fcfc8` ×2, `97c8293786`, `075735c395`) → 28 plików;
  zbiór 28-plikowy jest **podzbiorem** 49-plikowego;
- `day307-crossorg-read-flight.pg.test.ts` **istnieje na `HEAD`** i zawiera przypadek
  parowany z asercją `404` dla obcego przy równoczesnym odczycie właściciela;
- stan dowodów G19 na `fee24bddb0`: Blok 1 (18 plików podglądu/tabeli, wspólny dla wszystkich
  16 modułów) **127/131**, cztery czerwienie oznaczone jako ZASTANE; Blok 2 (middleware)
  **225/225** plus nowy `mfaEnrollmentToken.middleware.test.ts` **7/7** z mutacją na czerwono;
  Blok 3 (kontrakty tras 03.09, realny PostgreSQL) **16/18**, dwie czerwienie = przestarzały
  payload testu `day277-decyzje-zapis` wobec pola `escalation`; przelot HTTP **12/12** tras;
  `initiativesExecutionRuntime.dropdown` **2/2** z dowodem mutacyjnym;
- liście słowników: **pl 35198**, **en 33065**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / schemat** | `server/src/schemas/**` — w szczególności `ReplaceDecisionEnhancementsSchema` (pole `escalation`, ok. wiersz 220) | **TYLKO ODCZYT.** Schemat jest kontraktem produktu; przestarzały jest **test**, nie schemat | Cytat wiersza schematu w raporcie + poprawiony payload testu |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/routes/v8/index.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** Każde „działa" w tym dyżurze znaczy: realne żądanie HTTP przez realny `ApiGateway.getInstance().initializeRoutes(app)` z podpisanym JWT, z **zapisanym kodem odpowiedzi** | Opis w raporcie |
| **Kontroler / trasy** | `server/src/routes/**` (77 plików zmienionych po markerze G19) | **TYLKO ODCZYT** — chyba że dowód mutacyjny wykaże REALNĄ dziurę izolacji; wtedy naprawa jest dozwolona, w osobnym commicie, z dowodem w obie strony | Wpis do raportu: plik, linia, brakujący dowód, rekomendacja jako diff **nienałożony** |
| **Middleware (model uprawnień)** | `server/src/middleware/auth.middleware.ts`, `mfaEnrollmentToken.middleware.ts`, `requireAudit*`, `appErrorMapper.ts` | **NIETYKALNE DO ZAPISU** (`Z12`) — wolno WOŁAĆ w dowodzie. Wyjątek jak wyżej: realna dziura, osobny commit, mutacja w obie strony | Brief + czerwony kontrakt |
| **Serwis / repozytorium** | `server/src/services/**`, `server/src/repositories/**` | **TYLKO ODCZYT** | jak wyżej |
| **Powierzchnia współdzielona UI** | `src/components/standard/**`, `src/components/shared/**`, `src/components/ui/**`, `src/index.css`, `tailwind.config.js` | **TYLKO ODCZYT.** Ten dyżur MIERZY tę powierzchnię, nie przebudowuje jej | Wpis do raportu z `plik:linia` |
| **Słowniki** | `public/locales/{pl,en}/translation.json` | **TYLKO ODCZYT** — liście **nie mogą zmaleć** (`pl 35198`, `en 33065`) | — |
| **Testy — istniejące dowody G19** | `server/src/routes/__tests__/day290-g19-http-flight.pg.test.ts`, `day307-crossorg-read-flight.pg.test.ts`, `day277-decyzje-zapis.pg.test.ts`, `initiativesExecutionRuntime.dropdown.pg.test.ts`, `server/src/middleware/__tests__/mfaEnrollmentToken.middleware.test.ts` | **★ WĄSKA LICENCJA:** wolno **dodawać** przypadki i **naprawiać przestarzały payload** wobec schematu. **Zakaz** obniżania progu, usuwania asercji i zawężania zakresu, żeby zzielenieć — każda zmiana istniejącej asercji wymaga dowodu mutacyjnego, że test nadal broni tego, co bronił | — |
| **Testy — nowe** | nowy plik pod `server/src/routes/__tests__/` z prefiksem `day335-` | **★ PEŁNA LICENCJA** — wyłącznie realny PostgreSQL i realny `ApiGateway`. Nowe pliki w `tests/` wymagają `git add -f` | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Dowody** | `evidence/g19/**` | **★ PEŁNA LICENCJA na DOPISYWANIE.** Nowe pliki dowodowe pod `evidence/g19/day335-*`; **zakaz nadpisywania i kasowania istniejących** — to jest ślad poprzedniego pomiaru | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`, **wyłącznie wiersz `G19`** | **★ WĄSKA LICENCJA POD WARUNKIEM `R0`:** wiersz zmienia stan **tylko razem z dowodem w TYM SAMYM commicie**. **ZAKAZ wpisania `PASS` i `TECHNICAL_REGRESSION_PASS`.** Zakaz dotykania wierszy `G00`–`G18` i `G20` | — |
| **Inwentarz G19** | `docs/program/waves/WAVE_03_ACCEPTANCE/G19_INWENTARZ_OBOWIAZKOW_20260903.md` | **AKTUALIZACJA przez DOPISANIE** sekcji „Aktualizacja dyżuru 335" — oryginalne zdania zostają, obok staje sprostowanie z datą i komendą. **Zakaz nadpisywania** znaleziska `G19-Z3` | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jeden wiersz, dopisany | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY335_G19_REGRESJA_REPORT.md` (**NOWY — nie istnieje na markerze**) | `R6` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `scripts/dev/p0p1-licznik-e1.mjs`, `REJESTR_P0P1_BLOKUJACE_G20.md`, wiersz `G20` (dyżur 334) · wiersz `G15` i `evidence/g15/**` (dyżur 336) · `src/components/MyWork/**`, `dev-render/**` (dyżur 337) · `server/migrations/**` (przedział nieprzydzielony) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

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
| 1 | wiersze `G19` w stanie `NOT_PROVEN` | `16` z `16` | komenda (1) z `§0.3` | TAK — czyta kolumnę statusu wszystkich 16 plików |
| 2 | commity między markerem dowodu a `HEAD` | `544` | komenda (2) z `§0.3` | TAK |
| 3 | **pliki współdzielone zmienione PO markerze dowodu** | `104` | komenda (3) z `§0.3` | TAK — **te same ścieżki, które definicja G19 wymienia** |
| 4 | z tego bez plików testowych | `89` | `grep -vcE '__tests__\|\.test\.'` na wyniku (3) | TAK |
| 5 | z tego UI / serwer bez testów | `10` / `77` | `grep -cE '^src/'` i dopełnienie | TAK |
| 6 | różne kotwice `G18` i zbiory zmian | `6` SHA → `3` zbiory (49 / 30 / 28) | komenda (4) z `§0.3` + `git diff --stat <SHA> HEAD -- <ścieżki>` | TAK — **sprawdź podzbiorowość sam**, nie przyjmuj jej |
| 7 | czy przelot parowany 307 istnieje na `HEAD` | **TAK** | komenda (5) z `§0.3` | TAK — czyta treść przypadku, nie samą nazwę pliku |
| 8 | Blok 1 (podgląd/tabela, wspólny) | `127/131`, 4 czerwienie | uruchomienie bloku 1 z `--retry=0 --reporter=json` | TAK |
| 9 | Blok 3 (kontrakty tras, realny PG) | `16/18`, 2 czerwienie | uruchomienie bloku 3 na `cx335` | TAK |
| 10 | liczba WYKONANYCH przypadków w każdym przebiegu | — | pole `numTotalTests` z raportu JSON | TAK — **`0 failed` przy `0 wykonanych` NIE jest PASS** |
| 11 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:** `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY335_G19_REGRESJA_REPORT.md` ·
`evidence/g19/day335-*` (nowe pliki dowodowe).

**Zapisujesz WARUNKOWO:** nowy plik testu `server/src/routes/__tests__/day335-*.pg.test.ts` ·
poprawiony payload `server/src/routes/__tests__/day277-decyzje-zapis.pg.test.ts` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` **wyłącznie wiersz
`G19`, wyłącznie razem z dowodem w tym samym commicie** ·
`docs/program/waves/WAVE_03_ACCEPTANCE/G19_INWENTARZ_OBOWIAZKOW_20260903.md` (sekcja
dopisana) · `docs/program/REJESTR_ZNALEZISK_20260903.md` (jeden wiersz) · pliki
`server/src/routes/**` lub `server/src/middleware/**` **tylko** przy udowodnionej mutacyjnie
realnej dziurze izolacji.

**JAWNIE NIE ZAPISZESZ:** `src/**` (powierzchnia współdzielona jest tu MIERZONA, nie
zmieniana), `public/locales/**`, `server/src/schemas/**`, `tests/setup.ts`, `tests/helpers/**`,
`tests/__mocks__/**`, `vitest*.config.ts`, `.github/workflows/**`, `server/migrations/**`,
`scripts/dev/p0p1-licznik-e1.mjs`, `REJESTR_P0P1_BLOKUJACE_G20.md`, wiersze `G00`–`G18`
i `G20` macierzy, `dev-render/**`, `src/components/MyWork/**`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day335-g19-regresja
git diff --name-only --cached | tee /private/tmp/cx-day335-g19-regresja-artefakty/staged.txt
bash -c "grep -iE '^src/|^public/locales/|^server/src/schemas/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|p0p1-licznik|REJESTR_P0P1|dev-render/|components/MyWork' /private/tmp/cx-day335-g19-regresja-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — TWARDA ZASADA TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**Wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM commicie.**

Konkretnie: commit, który dotyka `MODULE_ACCEPTANCE.md`, **musi** w tym samym `git show
--stat` zawierać co najmniej jeden plik dowodowy (`evidence/g19/day335-*`) albo plik testu,
na który ten wiersz się powołuje. **Wpis bez dowodu jest podstawą odrzucenia całego dyżuru** —
nie tej jednej pozycji, całego dyżuru.

**Nie wolno wpisać `PASS` ani `TECHNICAL_REGRESSION_PASS`.** Dopuszczalne nowe stany to
wyłącznie takie, które **nazywają zakres dowodu i jego granicę** (np.
`NOT_PROVEN / OWNER_RETEST_PENDING` z rozszerzonym uzasadnieniem, albo stan częściowy z jawnie
wypisanym otwartym długiem). Jeżeli uważasz, że wiersz zasługuje na mocniejszy stan — **piszesz
to jako PROPOZYCJĘ w raporcie**, z gotowym tekstem wiersza, i zostawiasz decyzję odbiorcy.

**Wymagany dowód:** jedno zdanie w raporcie, że przeczytałeś tę zasadę, plus `git show --stat`
każdego commita dotykającego macierzy. **Bez commita — to jest warunek, nie pozycja.**

## R1 — DRYF: ILE POWIERZCHNI WSPÓŁDZIELONEJ ZMIENIŁO SIĘ PO MARKERZE DOWODU (rdzeń)

1. Uruchom komendy (2) i (3) z `§0.3`. Do raportu idą: liczba commitów, liczba plików razem,
   bez testów, UI, serwer.
2. **Rozbij listę na kategorie** i podaj każdą z nazwy (nie „kilka plików tras"):
   słowniki · `src/components/shared` · `src/components/ui` · `src/index.css` ·
   `server/src/middleware` · `server/src/routes`.
3. **Dopisz sprostowanie do inwentarza** — sekcja „Aktualizacja dyżuru 335" w
   `G19_INWENTARZ_OBOWIAZKOW_20260903.md`, **obok** znaleziska `G19-Z3`, nigdy zamiast niego:
   oryginalne zdanie („0 plików") zostaje, obok staje data, komenda i nowa liczba.
   ★ **Zanim dopiszesz — sprawdź, czy ten plik nie jest GENEROWANY przez skrypt:**
   `bash -c "grep -rl 'G19_INWENTARZ_OBOWIAZKOW' scripts/"`. Jeżeli jest — dopisek idzie do
   raportu, a do generatora idzie brief.
4. **Odpowiedz na pytanie, które z tego wynika, i zapisz odpowiedź jako wynik:** czy dowód
   wykonany na `fee24bddb0` zachowuje ważność wobec `HEAD`? Jeżeli nie — **to jest główne
   ustalenie tego dyżuru** i wchodzi do wszystkich 16 wierszy.

**Wymagany dowód:** pięć liczb z komendami, lista plików z podziałem na kategorie (w
`evidence/g19/day335-dryf.md`), `git diff` dopisku do inwentarza. **Commit po `R1`.**

## R2 — PODZIAŁ 16 WIERSZY NA TRZY KUBEŁKI, WIERSZ PO WIERSZU (rdzeń)

Dla **każdego z 16 modułów** produkujesz wiersz tabeli z przypisaniem do **jednego z trzech
kubełków** i z **imiennym uzasadnieniem**:

- **(A) BRAK SCENARIUSZA — da się wykonać maszynowo.** Dowód nie istnieje, ale nic nie stoi
  na przeszkodzie, żeby powstał w tym dyżurze: brakujący przypadek testowy, nieuruchomiony
  blok, niepodpięty dowód z późniejszego dyżuru.
- **(B) BRAK REALNEGO ŁAŃCUCHA.** Dowód wymaga realnego `ApiGateway` + podpisanego JWT +
  realnego PostgreSQL, a dotąd mierzono go atrapą albo w ogóle. **★ Uwaga:** to NIE jest
  automatycznie „niewykonalne" — masz do dyspozycji kontener `cx-day335-pg` na porcie `6371`.
  Do (B) trafia tylko to, czego **nie da się** zmierzyć w tym dyżurze (np. zależność od
  stagingu albo od realnego providera zewnętrznego), z **nazwaniem przeszkody**.
- **(C) BRAK OCZU WŁAŚCICIELA.** Dowód z natury wymaga człowieka: język (D-a3), warunkowe
  renderowanie (D-a4), sensowność treści, przelot po stagingu na realnych danych z otwarciem
  **realnego rekordu z listy** (`DEC-2026-09-03-346`: odbiór na fiksturze pokazowej nie jest
  odbiorem).

**★ Zanim podzielisz — rozstrzygnij strukturę.** Inwentarz twierdzi (`G19-Z2`), że
**obowiązek jest JEDEN, nie szesnaście**: 16 kotwic redukuje się do trzech zbiorów, a zbiór
28-plikowy jest podzbiorem 49-plikowego. **Sprawdź to sam** komendą (4) i `git diff --stat`.
Jeżeli teza się potwierdza, Twoja tabela ma **16 wierszy, ale trzy różne mianowniki** — i to
zapisujesz wprost, bo to zmienia koszt zamknięcia bramki o rząd wielkości. Jeżeli się **nie**
potwierdza — to jest obalenie i **cenniejszy wynik niż plan**.

**Wymagany dowód:** tabela 16 wierszy (moduł · kotwica `G18` · mianownik · kubełek ·
uzasadnienie z nazwy), plus osobna tabela trzech zbiorów zmian z dowodem podzbiorowości albo
jej obalenia. **Commit po `R2`.**

## R3 — WYKONANIE KUBEŁKA (A), W TYM PARA IZOLACYJNA CROSS-ORG (rdzeń)

**To jest pozycja, w której dyżur produkuje dowód, a nie tylko go opisuje.**

1. **Najpierw zinwentaryzuj to, co JUŻ ISTNIEJE.** Uruchom komendę (5) z `§0.3` i przeczytaj
   `day307-crossorg-read-flight.pg.test.ts` w całości. Odpowiedz w raporcie na pytanie:
   **czy ten test zamyka granicę zapisaną w `evidence/g19/przelot-http.md`?** Jeżeli tak —
   podpinasz go jako dowód i **nie budujesz drugiego**; jeżeli częściowo — wypisujesz
   imiennie, czego brakuje. ★ Program ma zmierzony kształt „biblioteka bez wywołania" i jego
   odwrotność: dowód, który istnieje, ale nikt go nie podpiął pod bramkę.
2. **Uruchom Blok 1, Blok 2 i Blok 3 na `HEAD`** (nie na `fee24bddb0`), z `--retry=0`
   i `--reporter=json --outputFile=`. **Podaj liczbę WYKONANYCH przypadków**, nie tylko
   liczbę porażek — przebieg z zerem wykonanych kończy się `exit 0` i nie jest dowodem.
3. **Para izolacyjna cross-org na ISTNIEJĄCYM obiekcie.** Jeżeli punkt 1 wykaże, że dziura
   nadal jest otwarta, budujesz **nowy** test `server/src/routes/__tests__/day335-*.pg.test.ts`
   przez realny `ApiGateway`, z **dwoma** podpisanymi JWT z **dwóch** organizacji.
   Dowód musi mieć **OBIE połowy w jednym przebiegu**:
   - **obcy NIE widzi** konkretnego, **zaseedowanego, istniejącego** obiektu właściciela
     (kod odpowiedzi zapisany);
   - **właściciel TEN SAM obiekt widzi** (kod odpowiedzi i identyfikator zapisany).

   ★★ **Symetryczna odmowa (`404/404`) nie jest dowodem izolacji** — jest dowodem, że
   obiektu nie ma, czyli że funkcja jest wygaszona dla wszystkich. To jest zmierzony kształt
   „zamknięte przez wygaszenie" i wystąpił w tym programie trzykrotnie jednego dnia.
   ★ Równie ważne: `200/200` **bywa poprawne**, gdy trasa jest listą własnej organizacji —
   wtedy dowodem izolacji jest **brak identyfikatorów właściciela w treści odpowiedzi obcego**,
   nie kod HTTP. Tak właśnie jest zapisane w `evidence/g19/przelot-http.md` i tego kształtu
   nie „naprawiasz" na `403`.
4. **DOWÓD MUTACYJNY CELUJĄCY W ZABEZPIECZENIE.** Usuń warunek organizacji w zapytaniu, które
   broni tego obiektu (kopia przez `cp` do katalogu scratch **poza repo**, `Z27` — **nigdy
   `git stash`**), i pokaż, że **obcy zaczyna widzieć obiekt właściciela**, a Twój nowy test
   **czerwieni się**. Przywróć przez `cp`; `git diff` po przywróceniu **pusty**.
   ★ Test, który przechodzi zarówno przed, jak i po usunięciu zabezpieczenia, **nie broni
   niczego** — to kształt „test scenariusza nie broni zabezpieczenia" i jest podstawą
   odrzucenia pozycji.
5. **Zdanie „działa" ma cenę.** Każde takie zdanie w raporcie ma obok siebie: metodę, ścieżkę,
   kod odpowiedzi i ścieżkę do surowego logu w `evidence/g19/day335-*`.

**Wymagany dowód:** werdykt o teście 307 (zamyka / częściowo / nie), trzy bloki uruchomione na
`HEAD` z liczbą wykonanych przypadków, para izolacyjna z dwoma kodami odpowiedzi, mutacja
w obie strony z pełną nazwą czerwonego przypadku (`Z37`), `git diff` po przywróceniu (pusty).
**Commit po `R3`.**

## R4 — CZERWIENIE: KLASA ORZECZONA, NIE ZAMILCZANA

1. **Dwie czerwienie Bloku 3** (`day277-decyzje-zapis` wobec pola `escalation`). Sprawdź
   `ReplaceDecisionEnhancementsSchema` — pole jest **nullable, ale nieopcjonalne**. Jeżeli
   potwierdzisz, że przestarzały jest **test**, a nie schemat: **naprawiasz payload testu**
   i pokazujesz mutacyjnie, że test **nadal broni tego, co bronił** (usuń pole z payloadu →
   test ma się czerwienić z komunikatem walidatora, nie przechodzić). ★ **Zakaz naprawiania
   tego przez `.optional()` w schemacie** — schemat jest kontraktem produktu.
2. **Cztery czerwienie Bloku 1.** Dziś opisane jako ZASTANE, ale **bez pary bazowej na
   `HEAD`**. Orzeknij klasę dla każdej z nazwy: `ZASTANA` (czerwieni się także na bazie
   sprzed zmiany) czy `NOWA`. ★ **Baza pomiaru musi się kompilować** — zanim nazwiesz coś
   „zastanym", sprawdź `esbuild` na plikach czerwonych i na ich bazie; `Transform failed`
   jest **błędem komendy**, nie wynikiem, a przebieg, który wykonał zero przypadków, nie jest
   bazą.
3. **Wypisz otwarty dług z nazwy.** Definicja G19 wymaga tego wprost: plik bez żadnego
   z dwóch dowodów ma być **wymieniony imiennie**. Lista idzie do `evidence/g19/day335-dlug.md`
   i do raportu.

**Wymagany dowód:** stan Bloku 3 przed i po naprawie payloadu z mutacją, tabela czterech
czerwieni Bloku 1 z klasą i komendą bazową, imienna lista otwartego długu. **Commit po `R4`.**

## R5 — PAKIET DO PRZELOTU WŁAŚCICIELA (kubełek C)

Dla wierszy, które trafiły do kubełka **(C)**, produkujesz **pakiet do przelotu** — nie wpis
`PASS`. Pakiet ma być na tyle konkretny, żeby właściciel mógł go wykonać bez pytań:

- **co otworzyć** — moduł, ekran, i **realny rekord z listy**, nie fikstura pokazowa
  (`DEC-2026-09-03-346`); podaj, jak taki rekord rozpoznać;
- **co kliknąć** — kolejność kroków, po jednym zdaniu na krok;
- **czego szukać** — konkretne rzeczy, które mogły się zepsuć od odbioru modułu, wynikające
  z **Twojej** listy z `R1`: zmienione napisy (słowniki), zmienione komponenty współdzielone
  (`NModeLeftNav`, formularze, `ErrorState`, `HelpButton`), zmienione trasy;
- **co jest sygnałem porażki** — sformułowane tak, żeby dało się odpowiedzieć „tak"/„nie";
- **czego pakiet NIE obejmuje** — jawna granica, żeby przelot nie był brany za dowód czegoś,
  czego nie dotknął.

Pakiet zapisujesz w `evidence/g19/day335-pakiet-przelotu.md` i **streszczasz w raporcie**.

**Wymagany dowód:** pakiet z podziałem na 16 modułów (albo na trzy grupy kotwic, jeżeli `R2`
potwierdzi, że mianowniki są trzy), z jawną granicą. **Commit po `R5`.**

## R6 — RAPORT

Raport zawiera: stan PRZED/PO wszystkich 16 wierszy · **liczby dryfu z `R1`** i odpowiedź na
pytanie o ważność dowodu z `fee24bddb0` · **tabelę 16 wierszy z kubełkami** z `R2` ·
werdykt o teście 307 i wyniki trzech bloków na `HEAD` z **liczbą wykonanych przypadków** ·
parę izolacyjną z dwoma kodami odpowiedzi · **wszystkie dowody mutacyjne dosłownie**
z pełnymi nazwami czerwonych przypadków · imienną listę otwartego długu · pakiet przelotu ·
**gotowy tekst wiersza `G19`** dla każdego modułu, którego stan proponujesz zmienić, wraz
z SHA commita, w którym leży dowód · listę rozbieżności wobec liczb tej instrukcji ·
**niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** · obowiązkowy **akapit `§0.2e`** dla
każdego uruchomionego pakietu.

**Commit po `R6`.**

## Próg odbioru

**Każdy z 16 wierszy `G19` ma przypisany kubełek z imiennym uzasadnieniem, kubełek maszynowy
jest WYKONANY z dowodem mutacyjnym celującym w zabezpieczenie, a każda zmiana stanu wiersza
leży w tym samym commicie co jej dowód.** Wpis bez dowodu — choćby jeden — jest podstawą
odrzucenia całego dyżuru. `PASS` i `TECHNICAL_REGRESSION_PASS` nie są dopuszczalnymi stanami.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „mianownik G19 urósł o N
plików po markerze dowodu, 16 wierszy rozłożone na trzy kubełki (A: k, B: l, C: m), kubełek
A wykonany z parą izolacyjną i mutacją, kubełek C ma pakiet przelotu, otwarty dług wypisany
imiennie" — **jest pełnowartościowym wynikiem, nawet jeśli ani jeden wiersz nie zmienił
stanu.**

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Przepchnij bramkę G19" vs „zakaz wpisania `PASS`" | Próg odbioru i `R0`: produktem jest **rozłożenie na kubełki + wykonanie maszynowego**, nie zielony wiersz; wiersz może pozostać `NOT_PROVEN` i dyżur jest odebrany |
| „Odbiorca odrzucił `TECHNICAL_REGRESSION_PASS`" vs „wykonaj regresję maszynowo" | `R3`: wykonujesz **dowód**, ale nie nadajesz mu nazwy odrzuconego wariantu; nazwa nie była problemem sama w sobie — problemem było, że nie domykała definicji |
| „Zmierz dryf na `HEAD`" vs „dowód G19 jest na `fee24bddb0`" | `R1` punkt 4: to jest **pytanie do rozstrzygnięcia**, a odpowiedź jest głównym ustaleniem; nie „naprawiasz" markera, tylko nazywasz konsekwencję |
| „Nie zmieniasz `server/src/routes/**`" vs „napraw dziurę izolacji, jeśli ją znajdziesz" | Tabela licencji, wiersze „Kontroler" i „Middleware": naprawa jest dozwolona **wyłącznie** przy udowodnionej mutacyjnie realnej dziurze, w osobnym commicie, z dowodem w obie strony |
| „Napraw dwie czerwienie Bloku 3" vs „zakaz obniżania asercji, żeby zzielenieć" | `R4` punkt 1: naprawiasz **payload testu**, nie schemat i nie asercję; mutacja ma pokazać, że test nadal broni |
| „`200` dla obcej organizacji jest podejrzane" vs „`200/200` bywa poprawne" | `R3` punkt 3: kryterium to **brak identyfikatorów właściciela w treści**, nie kod HTTP; kształt zapisany w `evidence/g19/przelot-http.md` i **nie naprawiasz go na `403`** |
| „Dowód ma być na realnym PostgreSQL" vs „`§0.2c` (C) mockuje bazę" | Sekcja `SCIEZKI`: Blok 1 idzie wariantem (C), Bloki 2-3 i wszystkie dowody izolacji wariantem (B) na `cx335`; **atrapa nie jest dowodem zapisu** (`Database.ts:686`) |
| „Zero nowych dokumentów" (`Z13`) vs „dopisek do inwentarza i pliki dowodowe" | Tabela licencji: inwentarz i rejestr znalezisk to **AKTUALIZACJE istniejących**, `evidence/g19/` to **ślad**, nie dokument rejestrowy; nowy dokument rejestrowy jest dokładnie jeden — raport `R6` |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R3` punkt 4 i `R4`: kopia przez `cp` do katalogu scratch poza repo; `git diff` po przywróceniu ma być pusty |
| „Wpisz wynik do 16 wierszy" vs „obowiązek jest jeden, nie szesnaście" | `R2`: tabela ma 16 wierszy, ale **trzy mianowniki**; jeżeli teza `G19-Z2` się potwierdzi, jeden przebieg dowodowy obsługuje wszystkie 16 — i to zapisujesz wprost |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 10 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — `day307-crossorg-read-flight.pg.test.ts`, `day277-decyzje-zapis.pg.test.ts`, `evidence/g19/**`, inwentarz G19 sprawdzone na markerze; jedyny nowy dokument rejestrowy to raport `R6` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 11 wierszy; wiersze 1–7 i 11 zmierzone przy wydaniu |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — walidator/schemat · trasa/montaż · kontroler · middleware · serwis/repozytorium · UI współdzielone · słowniki · testy istniejące i nowe · bezpieczniki · dowody · macierz odbioru · inwentarz; w każdym wierszu stoi rzeczownik-produkt |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1`, `R2`, `R5` nie dotykają kodu; `R3`/`R4` wołają `ApiGateway` i middleware bez ich zmieniania, a wyjątek naprawczy jest imienny i warunkowy |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6371/5511 wolne, brak kontenera `cx-day335-pg`, brak gałęzi i worktree; 334/336/337 mają rozłączne porty i rozłączne pliki; przedział migracji nieprzydzielony |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: symetryczna odmowa, poprawne `200/200`, atrapa bazy kłamiąca o zapisie, `NODE_ENV=test` bez `RUN_DB_TESTS`, `runIf`/`skipIf` dające `exit 0` przy zerze wykonanych, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
