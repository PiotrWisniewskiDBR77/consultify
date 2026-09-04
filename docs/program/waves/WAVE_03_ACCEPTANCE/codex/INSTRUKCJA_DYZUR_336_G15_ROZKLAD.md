# INSTRUKCJA DYŻURU nr 336 — Codex — „★★★ BRAMKA G15 — ROZŁOŻYĆ `PARTIAL_PASS` NA CZYNNIKI I DOMKNĄĆ TO, CO JEST BRAKIEM POMIARU. G15 ma 16 wierszy: **1 `PASS`** (`01_ORGANIZATION`), **11 `PARTIAL_PASS`** i **4 `NOT_MEASURED`**, z podtypami `RED_LEGACY_1/2/7`, `RED_LEGACY_2_PLUS_RED_NEW_1`, `SERVER_NOT_MEASURED`, `RED_LEGACY_1_CONFIRMED`, `RED_LEGACY_2_CONFIRMED`. Te podtypy znaczą DWIE zupełnie różne rzeczy i dziś są zlepione w jedną kolumnę: część to **DŁUG ZASTANY** (czerwień reprodukuje się na bazie — nie do naprawy w tym dyżurze), a część to **BRAK POMIARU** (serwerowe katalogi testów SĄ w mianowniku rejestru `REJESTR_G15_SAMOKONTROLA_20260903.md`, istnieją na dysku i nie są puste — po prostu nigdy ich nie uruchomiono; oraz cztery moduły, w których klasy `ZASTANA`/`NOWA` NIE DA SIĘ ORZEC, bo baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110` i pliki wykonały na niej ZERO przypadków). ★★ Pomiar, który daję z góry: baza G15 `f65c4ff6a0` jest **662 commity** za `HEAD`, marker G15 `35afcb15fd` — **599 commitów**, a marker konfliktu w `PreviewAIHintStrip.tsx` **na `HEAD` już nie istnieje**, więc baza da się dziś zmierzyć uczciwie. ★ Trop: jedyna czerwień sklasyfikowana jako **NOWA** w całej bramce (`MYW-IDEAS-010`, moduł `07`) figuruje dziś w rejestrze P0/P1 jako `NAPRAWIONE` z SHA `a995ca4c20` — sprawdź, czy bramka nie niesie defektu, którego już nie ma"

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
> **wyłącznie** `/private/tmp/cx-day336-g15-rozklad`.

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
Zakres: **PRZEKROJOWE — bramka G15 („Integrator self-QA and impacted regression”) macierzy odbioru fali 3, wszystkie 16 modułów. Przedmiotem pracy jest ROZŁOŻENIE podtypów na czynniki i WYKONANIE brakujących pomiarów, nie naprawa długu zastanego. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plikiem postępu `/private/tmp/cx-day336-postep.md` (poza repo)**.
Trasy front: `Katalogi testów frontu przypisane do modułów przez `REJESTR_G15_SAMOKONTROLA_20260903.md` sekcja R1 (mianownik bramki — do ODCZYTU i do URUCHOMIENIA, nie do przebudowy): `src/components/Organization/__tests__`, `src/components/Interview/__tests__`, `src/components/Discovery/__tests__`, `src/components/DiscoveryTools/__tests__`, `src/components/assessment/**/__tests__`, `src/components/method-workspace/__tests__`, `src/components/Initiatives/__tests__`, `src/components/Execution/__tests__`, `src/components/MyWork/__tests__`, `src/components/Meeting/__tests__`, `src/components/Results*/__tests__`, `src/components/Economics/__tests__`, `src/components/{ReportsAndPresentations,Presentations,PresentationStudio,DocumentStudio}/__tests__`, `src/components/Audit/__tests__`, `src/components/AIChat/__tests__`, `src/components/Admin/__tests__`, `src/components/settings/__tests__`, `src/views/partner/__tests__` oraz odpowiadające im katalogi `tests/unit/**` i `tests/components/partner`. Pliki produktu współdzielone, zmienione od bazy G15 (8 sztuk, do ODCZYTU): `src/components/shared/ExecutiveModuleShell/RightRail.tsx`, `src/components/shared/NModeLayout/NModeLeftNav.tsx`, `src/components/shared/NModeSections/CommentsCanvas.tsx`, `src/components/shared/PreviewPane/PreviewAIHintStrip.tsx`, `src/components/shared/PreviewPane/PreviewActivityStrip.tsx`, `src/components/shared/states/EmptyState.tsx`, `src/components/standard/EvidencePanelSection.tsx`, `src/components/ui/ResizableTable/ColumnResizer.tsx``. Trasy tył: `★★ TO JEST SEDNO POZYCJI `R3`. Serwerowe katalogi testów, które SĄ w mianowniku rejestru G15, ISTNIEJĄ na dysku i NIE SĄ puste, a mimo to nie zostały uruchomione: `server/src/services/organizationContext/__tests__`, `server/src/services/interview/__tests__`, `server/src/services/interviewCandidate/__tests__`, `server/src/routes/interviewDelivery/__tests__`, `server/src/services/tools/__tests__`, `server/src/services/toolCatalog/__tests__`, `server/src/services/toolFreeze/__tests__`, `server/src/routes/assessment*/__tests__`, `server/src/services/assessment*/__tests__`, `server/src/services/initiative/__tests__`, `server/src/domain/initiatives-execution/__tests__`, `server/src/services/execution*/__tests__`, `server/src/routes/my-work/__tests__`, `server/src/services/myWork/__tests__`, `server/src/services/meeting*/__tests__`, `server/src/routes/resultsVnext/__tests__`, `server/src/services/results*/**/__tests__`, `server/src/routes/v8/finance-v2/__tests__`, `server/src/services/finance/__tests__`, `server/src/services/{materials,materialExport,presentationExport}/__tests__`, `server/src/routes/audits/__tests__`, `server/src/services/audits/__tests__`, `server/src/services/auditProgram*/__tests__`, `server/src/services/{chatHandoff,chatToSchema}/__tests__`, `server/src/services/invitation/__tests__`, pliki partnerowe w `server/src/routes/v8/__tests__` i `server/src/services/__tests__`. Moje pomiary kontrolne na markerze: `server/src/routes/resultsVnext/__tests__` = 19 plików, `server/src/services/assessment/__tests__` = 13, `server/src/routes/audits/__tests__` = 7, `server/src/services/chatHandoff/__tests__` = 3, `server/src/services/tools/__tests__` = 2, `server/src/services/interview/__tests__` = 1 — **zbiór jest niepusty, więc „serwer niezmierzony” nie jest wymówką, tylko zadaniem**`.

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
WT=/private/tmp/cx-day336-g15-rozklad
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
git -C "$VAULT" worktree add "$WT" -b codex/day336-g15-rozklad-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day336-g15-rozklad/config.worktree"
cat "$VAULT/worktrees/cx-day336-g15-rozklad/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day336-g15-rozklad-scratch
mkdir -p /private/tmp/cx-day336-g15-rozklad-artefakty

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
git -C "$WT" push github-backup codex/day336-g15-rozklad-20260904
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

# (1) TEZA: rozklad G15 to 1 PASS / 11 PARTIAL_PASS / 4 NOT_MEASURED, z szescioma podtypami
for m in docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/; do \
  printf '%s :: ' "$(basename $m)"; \
  grep -E '^\|[[:space:]]*G15\b' "$m/MODULE_ACCEPTANCE.md" | head -1 | awk -F'|' '{print $4}'; \
done
#   moje liczby: 01 PASS; 04/09/12/13/15 PARTIAL_PASS/SERVER_NOT_MEASURED; 03/10 RED_LEGACY_1;
#   11 RED_LEGACY_2; 02/14 RED_LEGACY_7; 07 RED_LEGACY_2_PLUS_RED_NEW_1;
#   05/06/08 NOT_MEASURED/RED_LEGACY_1_CONFIRMED; 16 NOT_MEASURED/RED_LEGACY_2_CONFIRMED

# (2) ★★ TEZA ROZSTRZYGAJACA: baza i marker G15 sa DALEKO za HEAD
for s in f65c4ff6a0 35afcb15fd; do \
  printf '%s ' "$s"; \
  git merge-base --is-ancestor "$s" HEAD && echo "przodek, commitow do HEAD: $(git rev-list --count $s..HEAD)" || echo 'NIE przodek'; \
done
#   moje liczby: f65c4ff6a0 = przodek, 662 commity; 35afcb15fd = przodek, 599 commitow

# (3) ★★ TEZA ROZSTRZYGAJACA: przyczyna czterech NOT_MEASURED juz NIE ISTNIEJE na HEAD
bash -c "grep -nE '^[<]{7}|^[=]{7}|^[>]{7}' src/components/shared/PreviewPane/PreviewAIHintStrip.tsx" ; echo "kod grepa=$?"
npx esbuild --loader:.tsx=tsx --bundle=false --outfile=/dev/null src/components/shared/PreviewPane/PreviewAIHintStrip.tsx && echo 'ESBUILD OK'
#   oczekiwane: ZERO trafien markera konfliktu (kod grepa=1) oraz ESBUILD OK.
#   ★ To znaczy, ze klase ZASTANA/NOWA da sie dzis orzec — czego 03.09 nie dalo sie zrobic.

# (4) TEZA: serwerowe katalogi testow z mianownika ISTNIEJA i NIE SA puste
for d in server/src/services/interview/__tests__ server/src/services/tools/__tests__ \
         server/src/routes/audits/__tests__ server/src/services/chatHandoff/__tests__ \
         server/src/routes/resultsVnext/__tests__ server/src/services/assessment/__tests__; do \
  printf '%s ' "$d"; [ -d "$d" ] && echo "JEST ($(ls "$d" | wc -l) plikow)" || echo 'BRAK'; \
done
#   moje liczby: 1, 2, 7, 3, 19, 13 plikow — zbior NIEPUSTY

# (5) TEZA: mianownik G15 zyje w rejestrze, ktory NIE jest generowany skryptem
ls docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md
bash -c "grep -rl 'REJESTR_G15' scripts/" ; echo "kod grepa=$?"
#   oczekiwane: plik istnieje; grep w scripts/ NIC nie znajduje (kod 1) => dopisek jest bezpieczny

# (6) TEZA: jedyna czerwien NOWA calej bramki (MYW-IDEAS-010) figuruje juz jako NAPRAWIONA
bash -c "grep -n 'MYW-IDEAS-010' docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md"
git merge-base --is-ancestor a995ca4c20 HEAD && git log -1 --format='%h %s' a995ca4c20
#   oczekiwane: wiersz "NAPRAWIONE | SHA_OK | a995ca4c20"; commit jest przodkiem HEAD

# (7) TEZA: podzial podtypow ma pokrycie w skorygowanych zdaniach odbioru dyzuru 286
sed -n '148,170p' docs/program/waves/WAVE_03_ACCEPTANCE/codex/ODBIOR_DYZUROW_286_290_291_20260903.md
#   oczekiwane: 16 gotowych zdan G15, z ktorych czytasz DOSLOWNIE, co znaczy kazdy podtyp

# (8) TEZA: liscie slownikow na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35198, en 33065

# (9) zasoby: dysk, porty, kontener
df -h /
lsof -nP -iTCP:6372 -sTCP:LISTEN; lsof -nP -iTCP:5512 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day336 || true
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day336-g15-rozklad-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6372`. Twój JEDYNY port harnessu to `5512`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day336-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki 04.09 — nie dotykasz: 334 (6370/5510), 335 (6371/5511), 337 (6373/5513). Starsze rodzeństwo 04.09: 330 (6356/5496), 331 (6357/5497), 332 (6358/5498), 333 (6359/5499). Cudze worktree 286-298 używają 6290-6299 i 5250-5269. Twoje własne wyłącznie: baza 6372, harness 5512. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK. Ten dyżur nie dodaje, nie zmienia i nie przełącza ANI JEDNEJ flagi funkcyjnej. Zdania G15 modułów `09_RESULTS` i `10_FINANCE` odnotowują „flagi OFF” jako stan pomiaru — ten stan ZACHOWUJESZ; jeżeli któryś test wymaga flagi ON, żeby przejść, to jest ZNALEZISKO i granica dowodu, nigdy zmiana domyślnej wartości`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`. Wszystkie NIETYKALNE DO ZAPISU — wolno je wołać w pomiarze, nie wolno ich zmieniać, także wtedy gdy „wystarczyłaby drobna zmiana, żeby test przeszedł”`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY336_G15_ROZKLAD_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/<MODUŁ>/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE wiersz `G15` i WYŁĄCZNIE pod twardym warunkiem z `R0`: wiersz zmienia stan tylko razem z dowodem w TYM SAMYM commicie. Dodatkowo: dopisanie sekcji „Aktualizacja dyżuru 336” do `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` (dopisanie, nigdy nadpisanie — sprawdź komendą (5), że plik nie jest generowany), nowe pliki dowodowe pod `evidence/g15/` (katalog NIE ISTNIEJE na markerze — tworzysz go) oraz jeden wiersz w `docs/program/REJESTR_ZNALEZISK_20260903.md`. **ZAKAZ dotykania wierszy `G00`–`G14` i `G16`–`G20`.** Plik postępu `/private/tmp/cx-day336-postep.md` żyje POZA repo. Nowe pliki w `tests/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day336-g15-rozklad-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day336-g15-rozklad-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ ZAMIANY `PARTIAL_PASS` NA `PASS` PRZEZ ZAWĘŻENIE KRYTERIUM.** Najprostszy sposób zzielenienia pięciu wierszy `SERVER_NOT_MEASURED` to napisanie, że warstwa serwerowa nie należy do mianownika G15 — a należy: `REJESTR_G15_SAMOKONTROLA_20260903.md` sekcja R1 wymienia serwerowe katalogi testów w mianowniku KAŻDEGO modułu. To jest zmierzony kształt „bezpiecznik nagradza defekt”: im większy brak pomiaru, tym łatwiej przejść kryterium po jego zawężeniu. **Jeżeli uważasz, że kryterium jest źle postawione — piszesz to WPROST jako PYTANIE DO WŁAŚCICIELA w raporcie, i nie przepisujesz go po cichu.** **ZAKAZ nazwania czerwieni `ZASTANĄ` bez pary bazowej, która się SKOMPILOWAŁA** — `Transform failed` i przebieg z zerem wykonanych przypadków są BŁĘDEM KOMENDY, nie bazą. **ZAKAZ naprawiania długu zastanego** — ten dyżur go MIERZY i WYPISUJE Z NAZWY, nie usuwa; naprawa zastanej czerwieni bez osobnego zlecenia jest wyjściem poza zakres. **ZAKAZ zmiany progu, asercji lub zakresu istniejącego testu, żeby zzielenieć.** **ZAKAZ `--retry` innego niż `0`.** **ZAKAZ nadpisywania rejestru G15** — historia pomiaru z 03.09 zostaje nietknięta | G15 jest jedyną bramką, w której jeden moduł ma `PASS`, a pozostałych piętnaście ma sześć różnych podtypów porażki zlepionych w jedną kolumnę. Dopóki podtypy nie są rozłożone na czynniki, nie da się powiedzieć, ile z tej bramki to dług, którego nikt dziś nie ruszy, a ile to praca do wykonania w jedno popołudnie. Pomiar z 03.09 jest przy tym podwójnie nieaktualny: baza jest 662 commity za `HEAD`, a jej marker konfliktu — powód czterech `NOT_MEASURED` — na `HEAD` już nie istnieje. Innymi słowy: cztery wiersze stoją na przeszkodzie, której nie ma, a pięć na braku pomiaru, który da się wykonać jedną komendą na moduł |

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
cd /private/tmp/cx-day336-g15-rozklad

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day336-pg psql -U postgres -d cx336 \
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
cd /private/tmp/cx-day336-g15-rozklad

docker run -d --name cx-day336-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx336 \
  -p 127.0.0.1:6372:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day336-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6372/cx336 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6372/cx336 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day336-g15-rozklad && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6372/cx336 \
JWT_SECRET=cx336-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Testy frontu z roota, wariant (C) `RUN_DB_TESTS=0 MOCK_DB=true`, per moduł, katalogi z sekcji R1 rejestru G15. Testy serwerowe z cwd `server/`, wariant (B) `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6372/cx336` — uruchomienie z roota bez właściwego configu daje `No test files found`, co jest BŁĘDEM KOMENDY, nie PASS. Wszystko z `--retry=0` i `--reporter=json --outputFile=/private/tmp/cx-day336-g15-rozklad-artefakty/<modul>-<warstwa>.json`. Pomiar bazowy dla klasyfikacji ZASTANA/NOWA: osobny worktree z `f65c4ff6a0` w `/private/tmp/cx-day336-g15-rozklad-artefakty/baza` (POZA repo, kasowany po pomiarze, `df -h /` przed i po). Dowód główny = tabela 16 wierszy z podziałem na DŁUG ZASTANY / BRAK POMIARU / CZERWIEŃ NOWA, plus wyniki wykonanych pomiarów serwerowych --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day336-g15-rozklad-artefakty/day336-g15-rozklad.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day336-g15-rozklad && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Testy frontu z roota, wariant (C) `RUN_DB_TESTS=0 MOCK_DB=true`, per moduł, katalogi z sekcji R1 rejestru G15. Testy serwerowe z cwd `server/`, wariant (B) `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6372/cx336` — uruchomienie z roota bez właściwego configu daje `No test files found`, co jest BŁĘDEM KOMENDY, nie PASS. Wszystko z `--retry=0` i `--reporter=json --outputFile=/private/tmp/cx-day336-g15-rozklad-artefakty/<modul>-<warstwa>.json`. Pomiar bazowy dla klasyfikacji ZASTANA/NOWA: osobny worktree z `f65c4ff6a0` w `/private/tmp/cx-day336-g15-rozklad-artefakty/baza` (POZA repo, kasowany po pomiarze, `df -h /` przed i po). Dowód główny = tabela 16 wierszy z podziałem na DŁUG ZASTANY / BRAK POMIARU / CZERWIEŃ NOWA, plus wyniki wykonanych pomiarów serwerowych --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day336-g15-rozklad-artefakty/day336-g15-rozklad.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day336-g15-rozklad/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day336-pg psql -U postgres -d cx336 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day336-pg`.
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
> **(e) ★★★ **SZEŚĆ PUŁAPEK.** (1) **Zawężenie kryterium wygląda jak wynik.** Wykreślenie warstwy serwerowej z mianownika zamienia 5 `PARTIAL` w `PASS` w minutę i nie zmienia w produkcie nic — to jest kształt „bezpiecznik nagradza defekt”. (2) **Baza pomiaru musi się skompilować.** Klasyfikacja `ZASTANA`/`NOWA` liczona na bazie, na której plik nie wykonał ani jednego przypadku, jest zgadywaniem; `Transform failed` to błąd komendy. (3) **`0 failed` przy `0 wykonanych` to nie PASS** — zawsze wypisuj `numTotalTests`, nie tylko `numFailedTests`. (4) **Atrapa bazy kłamie o zapisie**: `Database.ts:686` zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE`; testy serwerowe dotykające zapisu wyłącznie na realnym PostgreSQL (`RUN_DB_TESTS=1 MOCK_DB=false`). (5) **`NODE_ENV=test` bez `RUN_DB_TESTS=1` podstawia atrapę pod `DbPromise`** — `pg.Pool` widzi wiersz, kod produkcyjny nie. (6) **`grep --include` w `zsh` zwraca pustkę zamiast wyników** — uruchamiaj przez `bash -c '…'` i sprawdzaj kod wyjścia; pustka nie jest wynikiem, dopóki nie wiesz, że komenda się wykonała**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day336-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day336-g15-rozklad-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarda zasada: dowód w tym samym commicie; zakaz zawężania kryterium) · R1 (dekodowanie sześciu podtypów — co dokładnie znaczy każdy, z cytatem źródła — RDZEŃ) · R2 (podział 16 wierszy na DŁUG ZASTANY kontra BRAK POMIARU, z liczbami — RDZEŃ) · R3 (wykonanie brakujących pomiarów serwerowych — RDZEŃ) · R4 (orzeczenie klasy ZASTANA/NOWA dla czterech `NOT_MEASURED` na bazie, która się kompiluje) · R5 (weryfikacja jedynej czerwieni NOWA: `MYW-IDEAS-010`) · R6 (raport + pytania do właściciela o źle postawione kryteria)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6372` albo `5512` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6372` albo `5512`** (`Z7`).

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

Bramka **G15 — „Integrator self-QA and impacted regression"** jest jedyną bramką macierzy,
w której **jeden moduł ma `PASS`, a pozostałe piętnaście ma sześć różnych podtypów porażki
zlepionych w jedną kolumnę**. Dopóki te podtypy nie są rozłożone na czynniki, nikt nie umie
odpowiedzieć na najprostsze pytanie: **ile z tej bramki to dług, którego dziś nikt nie ruszy,
a ile to praca do wykonania jedną komendą na moduł.**

**Stan zastany, zmierzony na markerze `1c4b5a5635bafd38ef375227824ada9b62be186e`:**

| Moduł | Stan `G15` |
| --- | --- |
| `01_ORGANIZATION` | `PASS` |
| `02_INTERVIEW` | `PARTIAL_PASS / RED_LEGACY_7` |
| `03_TOOLS` | `PARTIAL_PASS / RED_LEGACY_1` |
| `04_ASSESSMENT` | `PARTIAL_PASS / SERVER_NOT_MEASURED` |
| `05_INITIATIVES` | `NOT_MEASURED / RED_LEGACY_1_CONFIRMED` |
| `06_EXECUTION` | `NOT_MEASURED / RED_LEGACY_1_CONFIRMED` |
| `07_MY_WORK_AGENT` | `PARTIAL_PASS / RED_LEGACY_2_PLUS_RED_NEW_1` |
| `08_MEETINGS` | `NOT_MEASURED / RED_LEGACY_1_CONFIRMED` |
| `09_RESULTS` | `PARTIAL_PASS / SERVER_NOT_MEASURED` |
| `10_FINANCE` | `PARTIAL_PASS / RED_LEGACY_1` |
| `11_MATERIALS` | `PARTIAL_PASS / RED_LEGACY_2` |
| `12_AUDITS` | `PARTIAL_PASS / SERVER_NOT_MEASURED` |
| `13_CHAT` | `PARTIAL_PASS / SERVER_NOT_MEASURED` |
| `14_ADMIN` | `PARTIAL_PASS / RED_LEGACY_7` |
| `15_SETTINGS` | `PARTIAL_PASS / SERVER_NOT_MEASURED` |
| `16_PARTNER` | `NOT_MEASURED / RED_LEGACY_2_CONFIRMED` |

Razem: **1 `PASS`, 11 `PARTIAL_PASS`, 4 `NOT_MEASURED`**.

**Te podtypy znaczą dwie zupełnie różne rzeczy, a stoją w jednej kolumnie:**

- **`RED_LEGACY_N`** — N czerwieni, dla których **istnieje para bazowa** i które reprodukują
  się na bazie. To jest **DŁUG ZASTANY**. Ten dyżur go **mierzy i wypisuje z nazwy**,
  **nie naprawia**.
- **`SERVER_NOT_MEASURED`** — front jest **w 100% zielony** (`04`: 620/620, `09`: 418/418,
  `12`: 17/17, `13`: 439/439, `15`: 13/13), a **warstwa serwerowa modułu nigdy nie została
  uruchomiona** — mimo że serwerowe katalogi testów **są w mianowniku** rejestru
  `REJESTR_G15_SAMOKONTROLA_20260903.md` sekcja R1. To jest **BRAK POMIARU**, czyli praca
  do wykonania **w tym dyżurze**.
- **`NOT_MEASURED / RED_LEGACY_N_CONFIRMED`** — klasy `ZASTANA`/`NOWA` **nie dało się
  orzec**, bo baza `f65c4ff6a0` miała **nierozstrzygnięty marker konfliktu**
  w `src/components/shared/PreviewPane/PreviewAIHintStrip.tsx:110`, przez co pliki testowe
  dotykające grafu importów tego komponentu **wykonały na bazie zero przypadków**. To też
  jest **BRAK POMIARU** — i to taki, którego przyczyna **już nie istnieje**.
- **`RED_LEGACY_2_PLUS_RED_NEW_1`** (`07_MY_WORK_AGENT`) — jedyna czerwień w całej bramce
  sklasyfikowana jako **NOWA**: `MYW-IDEAS-010`.

**★★ Dwa fakty, które zmieniają obraz i które daję z góry do sprawdzenia:**

1. **Pomiar G15 jest podwójnie nieaktualny.** Baza `f65c4ff6a0` leży **662 commity** za
   `HEAD`, marker dyżuru `35afcb15fd` — **599 commitów**.
2. **Przeszkoda, która wyprodukowała cztery `NOT_MEASURED`, na `HEAD` już nie istnieje.**
   Marker konfliktu w `PreviewAIHintStrip.tsx` został rozstrzygnięty; plik się kompiluje.
   **Klasę `ZASTANA`/`NOWA` da się dziś orzec uczciwie** — czego 03.09 zrobić się nie dało.
3. **Jedyna czerwień `NOWA` w całej bramce** (`MYW-IDEAS-010`) figuruje dziś w rejestrze
   P0/P1 jako **`NAPRAWIONE` z SHA `a995ca4c20`**. Sprawdź, czy bramka nie niesie defektu,
   którego już nie ma.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze:

- rozkład G15: **1 / 11 / 4** dokładnie jak w tabeli wyżej;
- `f65c4ff6a0` = przodek `HEAD`, **662 commity**; `35afcb15fd` = przodek, **599 commitów**;
- `PreviewAIHintStrip.tsx` **nie zawiera** markerów konfliktu i **kompiluje się** pod
  `esbuild`;
- serwerowe katalogi testów z mianownika **istnieją i nie są puste**:
  `server/src/routes/resultsVnext/__tests__` = **19** plików,
  `server/src/services/assessment/__tests__` = **13**,
  `server/src/routes/audits/__tests__` = **7**,
  `server/src/services/chatHandoff/__tests__` = **3**,
  `server/src/services/tools/__tests__` = **2**,
  `server/src/services/interview/__tests__` = **1**;
- `REJESTR_G15_SAMOKONTROLA_20260903.md` **nie jest generowany** przez żaden skrypt
  (`grep -rl 'REJESTR_G15' scripts/` nie znajduje nic) — dopisek do niego jest bezpieczny;
- `MYW-IDEAS-010` ma w rejestrze P0/P1 werdykt `NAPRAWIONE / SHA_OK / a995ca4c20`, a commit
  jest przodkiem `HEAD`;
- liście słowników: **pl 35198**, **en 33065**;
- **moje kontrolne liczniki plików testowych na `HEAD`** (do porównania z rejestrem, który
  liczył na `35afcb15fd`): `15_SETTINGS` = **7** (rejestr: 7), `13_CHAT` = **52**
  (rejestr: 51), `12_AUDITS` = **29** przy trzech z czterech katalogów (rejestr: 41 przy
  czterech). **Rozbieżności są oczekiwane — zmierz swoje i zapisz je.**

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / schematy** | `server/src/schemas/**` | **TYLKO ODCZYT** — schemat jest kontraktem produktu; jeżeli test się o niego rozbija, przestarzały jest test | Cytat wiersza schematu + brief |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/routes/v8/index.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** Każde „działa" w tym dyżurze znaczy: realne żądanie HTTP przez realny `ApiGateway`, z **zapisanym kodem odpowiedzi** | Opis w raporcie |
| **Kontroler / trasy** | `server/src/routes/**` | **TYLKO ODCZYT** — ten dyżur URUCHAMIA testy tych tras, nie zmienia tras | Wpis do raportu: plik, linia, czerwień, klasa, rekomendacja jako diff **nienałożony** |
| **Serwis** | `server/src/services/**`, `server/src/domain/**` | **TYLKO ODCZYT** | jak wyżej |
| **Repozytorium** | `server/src/repositories/**` | **TYLKO ODCZYT** | jak wyżej |
| **Middleware / model uprawnień** | `server/src/middleware/**` | **NIETYKALNE DO ZAPISU** (`Z12`) | Brief |
| **Produkt UI (moduły)** | `src/components/**`, `src/views/**` | **TYLKO ODCZYT.** Ten dyżur MIERZY, nie naprawia — także wtedy, gdy czerwień wygląda na łatwą do usunięcia | Wpis do raportu z `plik:linia` i klasą czerwieni |
| **Produkt UI (współdzielony, 8 plików z rejestru)** | `RightRail.tsx`, `NModeLeftNav.tsx`, `CommentsCanvas.tsx`, `PreviewAIHintStrip.tsx`, `PreviewActivityStrip.tsx`, `EmptyState.tsx`, `EvidencePanelSection.tsx`, `ColumnResizer.tsx` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To są pliki, których zmiana wywołała całą bramkę; ich dotknięcie unieważnia pomiar | Opis w raporcie |
| **Testy — istniejące** | wszystkie katalogi z sekcji R1 rejestru G15 (front i serwer) | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ** i wolno **dodawać** nowe przypadki. **Zakaz** zmiany progu, usuwania asercji i zawężania zakresu, żeby zzielenieć — każda zmiana istniejącej asercji wymaga dowodu mutacyjnego, że test nadal broni tego, co bronił | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Dowody** | `evidence/g15/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie** | — |
| **Rejestr G15** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` | **AKTUALIZACJA przez DOPISANIE** sekcji „Aktualizacja dyżuru 336" — historia pomiaru z 03.09 zostaje **nietknięta**; sprawdź komendą (5), że plik nie jest generowany | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`, **wyłącznie wiersz `G15`** | **★ WĄSKA LICENCJA POD WARUNKIEM `R0`:** wiersz zmienia stan **tylko razem z dowodem w TYM SAMYM commicie**, i **nigdy przez zawężenie kryterium**. Zakaz dotykania wierszy `G00`–`G14` i `G16`–`G20` | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jeden wiersz, dopisany | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY336_G15_ROZKLAD_REPORT.md` (**NOWY — nie istnieje na markerze**) | `R6` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `scripts/dev/p0p1-licznik-e1.mjs`, wiersz `G20` (dyżur 334) · wiersz `G19`, `evidence/g19/**`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md` (dyżur 335) · `src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx`, `dev-render/**` (dyżur 337) · `server/migrations/**` (przedział nieprzydzielony) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
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
| 1 | rozkład stanów `G15` | `1 PASS / 11 PARTIAL_PASS / 4 NOT_MEASURED` | komenda (1) z `§0.3` | TAK — czyta kolumnę statusu wszystkich 16 plików |
| 2 | liczba wystąpień każdego z sześciu podtypów | `SERVER_NOT_MEASURED` 5 · `RED_LEGACY_7` 2 · `RED_LEGACY_1` 2 · `RED_LEGACY_2` 1 · `RED_LEGACY_2_PLUS_RED_NEW_1` 1 · `RED_LEGACY_1_CONFIRMED` 3 · `RED_LEGACY_2_CONFIRMED` 1 | wynik (1) przepuszczony przez `sort \| uniq -c` | TAK — suma = 15 + 1 `PASS` = 16, **sprawdź to jawnie** |
| 3 | dystans bazy i markera G15 od `HEAD` | `662` / `599` commitów | komenda (2) z `§0.3` | TAK |
| 4 | czy przyczyna czterech `NOT_MEASURED` nadal istnieje | **NIE** — zero markerów konfliktu, `esbuild` OK | komenda (3) z `§0.3` | TAK — sprawdza **kompilowalność**, nie samą obecność pliku |
| 5 | czy serwerowe katalogi mianownika są niepuste | `19 / 13 / 7 / 3 / 2 / 1` plików | komenda (4) z `§0.3` | TAK — **to obala „nie ma czego mierzyć"** |
| 6 | liczba plików testowych per moduł na `HEAD` | patrz „Zmierz moje liczby sam" | `find <katalogi modułu> -name '*.test.*' -o -name '*.spec.*' \| wc -l` | TAK — **porównaj z rejestrem liczonym na `35afcb15fd`** |
| 7 | wykonane przypadki per przebieg | — | pole `numTotalTests` z raportu JSON | TAK — **`0 failed` przy `0 wykonanych` NIE jest PASS** |
| 8 | czerwienie per moduł: warstwa front | — | przebieg wariantem (C) | TAK |
| 9 | czerwienie per moduł: warstwa serwer | — | przebieg wariantem (B) na `cx336` | TAK — **to jest brakujący pomiar** |
| 10 | klasa każdej czerwieni | `ZASTANA` / `NOWA` | ta sama pełna nazwa przypadku na bazie `f65c4ff6a0` **i** na `HEAD` | TAK — **tylko jeżeli baza się skompilowała** |
| 11 | status `MYW-IDEAS-010` | `NAPRAWIONE / a995ca4c20` | komenda (6) z `§0.3` | TAK |
| 12 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY336_G15_ROZKLAD_REPORT.md` ·
`evidence/g15/**` (nowy katalog).

**Zapisujesz WARUNKOWO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` **wyłącznie wiersz
`G15`, wyłącznie razem z dowodem w tym samym commicie** ·
`docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` (sekcja
dopisana) · `docs/program/REJESTR_ZNALEZISK_20260903.md` (jeden wiersz) · nowe pliki testowe
(tylko jeżeli `R3` wykaże, że brakuje kontraktu — z `git add -f`).

**JAWNIE NIE ZAPISZESZ:** `src/**`, `server/src/**` (ten dyżur **MIERZY produkt, nie zmienia
go**), `public/locales/**`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`,
`vitest*.config.ts`, `.github/workflows/**`, `server/migrations/**`,
`scripts/dev/p0p1-licznik-e1.mjs`, `REJESTR_P0P1_BLOKUJACE_G20.md`, `evidence/g19/**`,
`G19_INWENTARZ_OBOWIAZKOW_20260903.md`, wiersze `G00`–`G14` i `G16`–`G20` macierzy,
`dev-render/**`, `src/components/MyWork/__tests__/ideaTools.controlEnumeration.test.tsx`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day336-g15-rozklad
git diff --name-only --cached | tee /private/tmp/cx-day336-g15-rozklad-artefakty/staged.txt
bash -c "grep -iE '^src/|^server/src/|^public/locales/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|p0p1-licznik|REJESTR_P0P1|evidence/g19|G19_INWENTARZ|dev-render/|controlEnumeration' /private/tmp/cx-day336-g15-rozklad-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — DWIE TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM commicie.**
Commit dotykający `MODULE_ACCEPTANCE.md` musi w tym samym `git show --stat` zawierać plik
dowodowy (`evidence/g15/*`) albo plik testu, na który wiersz się powołuje. Wpis bez dowodu
jest podstawą odrzucenia **całego dyżuru**.

**(2) `PARTIAL_PASS` nie staje się `PASS` przez zawężenie kryterium.** Najprostsza droga do
zzielenienia pięciu wierszy `SERVER_NOT_MEASURED` prowadzi przez napisanie, że warstwa
serwerowa nie należy do mianownika G15. **Należy** — `REJESTR_G15_SAMOKONTROLA_20260903.md`
sekcja R1 wymienia serwerowe katalogi testów w mianowniku **każdego** modułu, i katalogi te
istnieją oraz nie są puste (komenda (4)). Zawężenie kryterium jest zmierzonym kształtem
„bezpiecznik nagradza defekt": **im większy brak pomiaru, tym łatwiej przejść kryterium po
jego zawężeniu.**

**Jeżeli uważasz, że kryterium jest źle postawione — piszesz to WPROST, jako pytanie do
właściciela w `R6`, i NIE przepisujesz go po cichu.** Pytanie ma być rozstrzygalne
(„tak"/„nie"), np.: *„Czy warstwa serwerowa modułu ma należeć do mianownika G15, skoro
osobne bramki mierzą kontrakty tras?"* — a nie opisem problemu.

**Wymagany dowód:** dwa zdania w raporcie, że przeczytałeś obie zasady, plus `git show --stat`
każdego commita dotykającego macierzy. **Bez commita — to jest warunek, nie pozycja.**

## R1 — DEKODOWANIE SZEŚCIU PODTYPÓW (rdzeń)

Dla **każdego** z sześciu podtypów (`RED_LEGACY_1`, `RED_LEGACY_2`, `RED_LEGACY_7`,
`RED_LEGACY_2_PLUS_RED_NEW_1`, `SERVER_NOT_MEASURED`, `RED_LEGACY_N_CONFIRMED`) produkujesz
w raporcie:

1. **Co dokładnie znaczy** — jedno zdanie, z **cytatem źródła**. Źródłem są skorygowane
   zdania G15 z odbioru dyżuru 286 (komenda (7) z `§0.3`, wiersze ok. 148–170) oraz treść
   samych komórek `G15` w macierzy. **Nie parafrazujesz — cytujesz.**
2. **Ile wierszy go nosi** — liczba, z komendą.
3. **Do której kategorii należy**: **DŁUG ZASTANY** (nie do naprawy w tym dyżurze)
   czy **BRAK POMIARU** (do wykonania).
4. **Co konkretnie trzeba zrobić**, żeby wiersz przestał go nosić.

★ **Nie zakładaj, że mój podział jest poprawny.** Ja twierdzę, że `RED_LEGACY_*` bez sufiksu
`_CONFIRMED` to dług zastany, a `SERVER_NOT_MEASURED` i `*_CONFIRMED` to brak pomiaru.
**Sprawdź to na cytatach.** Obalenie mojego podziału jest sukcesem dyżuru.

**Wymagany dowód:** tabela sześciu podtypów z cytatami, liczbami i kategorią.
**Commit po `R1`.**

## R2 — PODZIAŁ 16 WIERSZY: DŁUG ZASTANY KONTRA BRAK POMIARU (rdzeń)

Tabela **16 wierszy**, każdy z: modułem · obecnym stanem · **liczbą czerwieni klasy
`ZASTANA`** · **liczbą czerwieni klasy `NOWA`** · **liczbą czerwieni klasy NIEORZECZONEJ** ·
**czy warstwa serwerowa była mierzona (TAK/NIE)** · kategorią (`DŁUG` / `BRAK POMIARU` /
mieszany) · **co dokładnie zamknęłoby ten wiersz**.

Do tego **dwie liczby zbiorcze**, które są głównym produktem tej pozycji:

- **ile wierszy stoi WYŁĄCZNIE na długu zastanym** (czyli nie da się ich domknąć w tym
  dyżurze bez naprawiania produktu — a naprawianie produktu jest tu **zakazane**);
- **ile wierszy stoi WYŁĄCZNIE na braku pomiaru** (czyli domykają się przebiegiem).

★ **Wypisz dług z nazwy.** Każda czerwień klasy `ZASTANA` ma trafić do
`evidence/g15/day336-dlug-zastany.md` z **pełną nazwą przypadku** (`Z37`), plikiem i modułem.
„Siedem czerwieni zastanych" bez nazw nie jest wynikiem — jest zaokrągleniem.

**Wymagany dowód:** tabela 16 wierszy, dwie liczby zbiorcze, plik z imienną listą długu.
**Commit po `R2`.**

## R3 — WYKONANIE BRAKUJĄCYCH POMIARÓW SERWEROWYCH (rdzeń)

**To jest pozycja, w której dyżur produkuje brakujący pomiar, a nie tylko go opisuje.**

1. **Postaw kontener** `cx-day336-pg` na porcie `6372`, baza `cx336`, i przepuść migracje
   zgodnie z `§0.2c` (A) — **dwa przebiegi**, drugi ma być bezbłędny i bez zmian
   (idempotencja). `pgvector/pgvector:pg16`; `postgres:15` **nie przechodzi migracji**.
2. **Dla każdego modułu** uruchom **serwerowe** katalogi testów z jego mianownika (sekcja R1
   rejestru G15), z cwd `server/`, wariantem (B), `--retry=0`,
   `--reporter=json --outputFile=/private/tmp/cx-day336-g15-rozklad-artefakty/<modul>-serwer.json`.
   ★ Zacznij od pięciu modułów z podtypem `SERVER_NOT_MEASURED` (`04`, `09`, `12`, `13`, `15`) —
   tam front jest w 100% zielony i **serwer jest jedyną otwartą rzeczą**.
3. **Podaj `numTotalTests`, nie tylko `numFailedTests`.** Przebieg, w którym wykonało się
   zero przypadków, kończy się `exit 0` i **nie jest pomiarem**. `No test files found` to
   **BŁĄD KOMENDY**.
4. **Każda czerwień dostaje klasę** — patrz `R4`. Czerwień bez klasy jest wynikiem
   niepełnym.
5. **Nie naprawiasz produktu.** Jeżeli czerwień wygląda na trywialną do usunięcia —
   opisujesz ją w raporcie z `plik:linia` i **rekomendacją jako diff nienałożony**. To jest
   pozycja pomiarowa.
6. **Sprzątanie:** `docker rm -fv cx-day336-pg` (bez `-v` wolumen zostaje), `df -h /` przed
   i po. Program stracił dobę na dysku zjedzonym przez niesprzątnięte artefakty.

**Wymagany dowód:** dla każdego z 16 modułów: komenda, `numTotalTests`, `numPassedTests`,
`numFailedTests`, ścieżka do JSON-a; osobno wyróżnione pięć modułów `SERVER_NOT_MEASURED`;
wynik obu przebiegów migracji; `df -h /` przed i po. **Commit po `R3`.**

## R4 — KLASA `ZASTANA`/`NOWA` NA BAZIE, KTÓRA SIĘ KOMPILUJE

Cztery moduły (`05`, `06`, `08`, `16`) mają `NOT_MEASURED`, bo baza `f65c4ff6a0` nie
kompilowała się w miejscu, które te testy importują. **Ta przeszkoda już nie istnieje.**

1. **Załóż worktree bazowy** z `f65c4ff6a0` w
   `/private/tmp/cx-day336-g15-rozklad-artefakty/baza` (**POZA repo**, `Z13`).
2. **Rozstrzygnij marker konfliktu na bazie** — kopią pliku z `HEAD` do worktree bazowego
   (przez `cp`, nigdy `git stash`), tak jak zrobił to odbiór 03.09 („baza naprawiona").
   **Zapisz dokładnie, co zrobiłeś** — to jest ingerencja w bazę pomiaru i musi być jawna.
3. **Zanim uruchomisz cokolwiek — sprawdź, że baza się kompiluje**: `esbuild` na plikach
   czerwonych i na `PreviewAIHintStrip.tsx`. **`Transform failed` jest błędem komendy, nie
   wynikiem.** Baza, na której plik wykonał zero przypadków, **nie jest bazą**.
4. **Dla każdej czerwieni** porównaj **pełną nazwę przypadku** (`Z37`) na bazie i na `HEAD`:
   ta sama nazwa czerwona po obu stronach ⇒ `ZASTANA`; czerwona tylko na `HEAD` ⇒ `NOWA`;
   nieuruchomiona po którejkolwiek stronie ⇒ `NIEORZECZONA`, i **tak ją zapisujesz**, nie
   zgadujesz.
5. **Skasuj worktree bazowy** po pomiarze; `df -h /` przed i po.

**Wymagany dowód:** dowód kompilowalności bazy, tabela czerwieni z klasami i pełnymi nazwami,
opis ingerencji w bazę, `df -h /` przed i po, potwierdzenie skasowania worktree.
**Commit po `R4`.**

## R5 — JEDYNA CZERWIEŃ `NOWA` W CAŁEJ BRAMCE

`07_MY_WORK_AGENT` niesie podtyp `RED_LEGACY_2_PLUS_RED_NEW_1`, gdzie `NOWA` to
`MYW-IDEAS-010`. Rejestr P0/P1 daje tej pozycji dziś werdykt `NAPRAWIONE / SHA_OK /
a995ca4c20`.

1. Sprawdź komendą (6), czy commit jest przodkiem `HEAD` i **czego dotyka** (`git show
   --stat`).
2. **Uruchom przypadek, który był czerwony**, na `HEAD` i podaj jego **pełną nazwę** oraz
   wynik.
3. Rozstrzygnij: czy bramka niesie defekt, którego już nie ma. Jeżeli tak — **to jest
   propozycja zmiany podtypu wiersza `07`** (z dowodem w tym samym commicie). Jeżeli nie —
   opisz, co dokładnie jest nadal czerwone.
4. ★ **Sprawdź RODZINĘ, nie tylko tę jedną pozycję.** Program ma zmierzony kształt „zlecenie
   obejmuje rodzinę": wypisz **wszystkie** pozycje `MYW-IDEAS-*` z rejestru P0/P1 i ich
   werdykty, zanim uznasz rodzinę za rozliczoną.

**Wymagany dowód:** `git show --stat` commita, pełna nazwa przypadku i jego wynik na `HEAD`,
tabela rodziny `MYW-IDEAS-*`. **Commit po `R5`.**

## R6 — RAPORT I PYTANIA DO WŁAŚCICIELA

Raport zawiera: stan PRZED/PO wszystkich 16 wierszy · **tabelę sześciu podtypów z cytatami**
z `R1` · **tabelę 16 wierszy z podziałem na dług i brak pomiaru** oraz dwie liczby zbiorcze
z `R2` · **wyniki pomiarów serwerowych** z `R3` (`numTotalTests` dla każdego modułu) ·
**tabelę klas czerwieni** z `R4` z pełnymi nazwami · rozstrzygnięcie `MYW-IDEAS-010` z `R5` ·
**imienną listę długu zastanego** · listę rozbieżności wobec liczb tej instrukcji ·
**niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** · obowiązkowy **akapit `§0.2e`** dla
każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA O KRYTERIUM".** Jeżeli w trakcie
pracy uznasz, że któreś kryterium G15 jest źle postawione (np. że warstwa serwerowa nie
powinna być w mianowniku, albo że dług zastany nie powinien blokować bramki) — **piszesz to
tutaj, jako pytanie rozstrzygalne, i NIE zmieniasz kryterium sam**. Sekcja może być pusta,
ale wtedy piszesz wprost: „nie mam zastrzeżeń do kryterium".

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`.

**Commit po `R6`.**

## Próg odbioru

**Każdy z sześciu podtypów `G15` ma jednozdaniową definicję z cytatem źródła; każdy z 16
wierszy ma przypisaną kategorię (dług zastany / brak pomiaru) z liczbami; brakujące pomiary
serwerowe są WYKONANE z `numTotalTests` dla każdego modułu; każda czerwień ma klasę orzeczoną
na bazie, która się skompilowała, albo jest jawnie oznaczona jako NIEORZECZONA.**

Żaden wiersz nie zmienia stanu na `PASS` przez zawężenie kryterium. Zastrzeżenie do kryterium
jest **pytaniem w raporcie**, nigdy cichą zmianą.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „sześć podtypów rozłożone na
czynniki z cytatami, k wierszy stoi wyłącznie na długu zastanym, l wyłącznie na braku pomiaru,
pomiary serwerowe wykonane dla m modułów, dług wypisany imiennie" — **jest pełnowartościowym
wynikiem, nawet jeśli ani jeden wiersz nie zmienił stanu.**

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Domknij maszynowe" vs „zakaz zamiany `PARTIAL` na `PASS`" | `R0` (2) i próg odbioru: domykasz **POMIAR**, nie stan wiersza; stan zmienia się tylko z dowodem i nigdy przez zawężenie kryterium |
| „Zmierz czerwienie" vs „zakaz naprawiania produktu" | `R3` punkt 5: czerwień opisujesz z `plik:linia` i **diffem nienałożonym**; to jest dyżur pomiarowy |
| „Orzeknij klasę `ZASTANA`" vs „baza nie kompilowała się" | `R4` punkty 2–3: rozstrzygasz marker konfliktu **kopią z `HEAD` przez `cp`**, jawnie to opisujesz i **najpierw dowodzisz kompilowalności** |
| „Nie dotykasz plików współdzielonych" vs „`R4` kopiuje `PreviewAIHintStrip.tsx`" | `R4` punkt 2: kopia trafia do **worktree bazowego POZA repo**, nie do repo; w repo ten plik pozostaje `TYLKO ODCZYT` |
| „Kryterium jest złe" vs „zakaz przepisywania kryterium" | `R0` (2) i `R6`: piszesz **pytanie rozstrzygalne** do właściciela; sekcja pytań jest obowiązkowa, choćby miała brzmieć „nie mam zastrzeżeń" |
| „Warstwa serwerowa niezmierzona" vs „nie ma czego mierzyć" | Komenda (4) z `§0.3`: katalogi **istnieją i są niepuste** (19/13/7/3/2/1 plików) — „nie ma czego mierzyć" jest obalone pomiarem |
| „`§0.2c` (C) mockuje bazę" vs „testy serwerowe wymagają realnego PG" | Sekcja `SCIEZKI`: front wariantem (C), serwer wariantem (B) na `cx336`; **atrapa nie jest dowodem zapisu** (`Database.ts:686`) |
| „Zero nowych dokumentów" (`Z13`) vs „dopisek do rejestru G15 i pliki dowodowe" | Tabela licencji: rejestr G15 i rejestr znalezisk to **AKTUALIZACJE istniejących**, `evidence/g15/` to **ślad**, nie dokument rejestrowy; nowy dokument rejestrowy jest dokładnie jeden — raport `R6` |
| „Worktree bazowy ułatwia dowód" vs `Z13` i próg 5 GB | `R4` punkty 1 i 5: worktree bazowy leży **poza repo**, jest kasowany po pomiarze, `df -h /` przed i po |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R4` punkt 2: kopia przez `cp`; `git diff` w repo po pracy ma nie zawierać plików współdzielonych |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 10 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — rejestr G15, odbiór 286, serwerowe katalogi testów sprawdzone; `evidence/g15/` **jawnie oznaczony jako nieistniejący**; jedyny nowy dokument rejestrowy to raport `R6` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1–6, 11 i 12 zmierzone przy wydaniu |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — walidator · trasa/montaż · kontroler · serwis · repozytorium · middleware · UI modułowe · UI współdzielone · testy · bezpieczniki · dowody · rejestr · macierz odbioru; w każdym wierszu stoi rzeczownik-produkt |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1`, `R2`, `R5` nie dotykają kodu; `R3` i `R4` uruchamiają istniejące pakiety, nie zmieniając produktu |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6372/5512 wolne, brak kontenera `cx-day336-pg`, brak gałęzi i worktree; 334/335/337 mają rozłączne porty i rozłączne pliki; przedział migracji nieprzydzielony |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: zawężenie kryterium, baza która się nie kompiluje, `0 wykonanych` jako `PASS`, atrapa bazy, `NODE_ENV=test` bez `RUN_DB_TESTS`, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
