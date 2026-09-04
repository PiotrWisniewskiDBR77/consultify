# INSTRUKCJA DYŻURU nr 314 — Codex — „★★★ „Musimy miec kompletne karty inicjatyw — to jest sens naszej aplikacji” (wlasciciel, DEC-387): kontrakt karty Inicjatywy kasowal 20 z 24 sekcji i 3 z 5 grup, zostal naprawiony i ma bezpiecznik — ale POZOSTALYCH SZESC typow kart NIE ZOSTALO ZMIERZONE, a wspolny alias `?cardContract=1` wlacza je WSZYSTKIE NARAZ, wiec ta sama przyczyna moze dzis kasowac sekcje w rodzenstwie: ten dyzur (1) mierzy KAZDY z siedmiu typow osobno, OFF vs ON, liczba sekcji i liczba grup, UCHWYTEM DOM przez `scripts/dev/grafika-zrzuty.mjs --zlicz`, nigdy okiem ze zrzutu, (2) dla kazdego typu, ktory cokolwiek gubi, ustala PRZYCZYNE w kodzie i naprawia ja tak, zeby kontrakt SEKCJE ZACHOWYWAL i tylko PORZADKOWAL, (3) dokłada bezpiecznik kompletnosci per typ z dowodem mutacyjnym celujacym w ZABEZPIECZENIE, nie w mechanizm obok, (4) mierzy osobno rekord na koncie z NIEPUSTYM szablonem inicjatywy (`initiativeTemplate.visibleSections` dziala PRZED kontraktem i moze dac mniej niz komplet), (5) rozstrzyga kolejnosc grup wobec dokumentu kanonu, a jesli kanon milczy — zapisuje to jako pytanie do wlasciciela zamiast wymyslac, (6) robi PARE zrzutow OFF/ON per typ i konczy raportem, NIE WLACZAJAC flagi. ★ Flaga zostaje default OFF do akceptu wlasciciela na parach zrzutow — po jednej parze na typ karty."

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
> **wyłącznie** `/private/tmp/cx-day314-kontrakt-kart-rodzina`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `bc18bc7acac2ec825ebb3db2f1309738ab034d58`**
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
Zakres: ****PRZEKROJOWE — KONTRAKT KART, RODZINA SIEDMIU TYPOW.** Dyzur 305 zbudowal kanoniczny kontrakt karty (`src/components/standard/cardContract.types.ts`) i wdrozyl go do siedmiu artefaktow za JEDNA wspolna flaga `?cardContract=1` / `ff.cardContract`, default OFF. Pomiar z 04.09 na rekordzie Inicjatywy (`karta-initiative`, id `init-smed-linia-pakowania`, sciezka produkcyjna) pokazal, ze przy fladze ON kontrakt ZWEZAL lewa nawigacje z 24 sekcji / 5 grup do 4 sekcji / 2 grup — kasowal 20 z 24 sekcji i cale grupy „Decyzje i ryzyko”, „Ludzie”, „Zapisy”. Przyczyna: ZAMKNIETA ALLOWLISTA — ziarno `hiddenSectionIds` budowane ze zbioru `INITIATIVE_CORE_BOARD_IDS` u `INITIATIVE_MINIMAL_BOARD_VISIBLE_IDS` (lacznie cztery id), a wszystko poza nia ukrywane. Naprawione: `INITIATIVE_CONTRACT_HIDDEN_SEED` jest dzis PUSTE, porzadkowanie jest permutacja, bezpiecznik `tests/unit/initiatives/initiativeCardContractCompleteness.test.ts` (M1-M4) broni tego zabezpieczenia. ★ CZEGO NIKT NIE ZMIERZYL i po co istnieje ten dyzur: SZESC POZOSTALYCH TYPOW — Task, Decision, Notification, Insight, Interview, Tool. Wspolny alias wlacza je naraz, wiec jedno klikniecie wlasciciela moze dzis obciac sekcje w szesciu miejscach jednoczesnie. Zakres obejmuje takze rekord na koncie z niepustym szablonem (filtr `initiativeTemplate.visibleSections` dziala PRZED kontraktem) i rozstrzygniecie kolejnosci grup wobec `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`.**.
Trasy front: `SIEDEM kontraktow: `src/components/Initiatives/sections/initiativeCardContract.ts` (naprawiony — wzorzec), `src/components/MyWork/taskCardContract.ts`, `src/components/MyWork/decisionCardContract.ts`, `src/components/MyWork/notificationCardContract.ts`, `src/components/Interview/insightCardContract.ts`, `src/components/Interview/interviewCardContract.ts`, `src/components/DiscoveryTools/toolCards.contract.ts`. SIEDEM konsumentow: `src/components/Initiatives/InitiativeDocumentView.tsx`, `src/components/MyWork/TaskDetailView.tsx`, `src/components/MyWork/DecisionDetailView.tsx`, `src/components/MyWork/NotificationDetailView.tsx`, `src/components/Interview/InsightViewer.tsx`, `src/components/Interview/InterviewWorkspace.tsx`, `src/components/DiscoveryTools/KnownToolDetailView.tsx`. Silnik wspolny: `src/components/shared/NModeLayout/useCardLayout.ts` (funkcja `buildDefaultLayout` — to ona zamienia `spec.sets[0].cards` na widocznosc) oraz `src/components/shared/NModeLayout/NModeLeftNav.tsx` (uchwyty pomiarowe `data-nmode-section-item` i `data-nmode-section-group`). Typ wiazacy: `src/components/standard/cardContract.types.ts`. Ekrany harnessu: `dev-render/screens/karta-initiative.tsx`, `karta-task.tsx`, `karta-task-pelna.tsx`, `karta-decision.tsx`, `karta-notification.tsx`, `karta-insight.tsx`, `karta-interview.tsx`, `karta-tool.tsx`. Dokument kanonu (odczyt): `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` §13.1 (archetyp C — Rekord) i §12 (nawigacja).`. Trasy tył: `Brak zmian po stronie serwera. Ten dyzur nie dotyka `server/src` ani migracji — jesli okaze sie, ze zestaw sekcji przychodzi z serwera (np. z tabeli typow sekcji), wypisujesz to jako znalezisko z nazwa pliku i trasy, dokladasz gotowa rekomendacje jako diff w bloku kodu i idziesz dalej. NIE naprawiasz tego tutaj.`.

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
WT=/private/tmp/cx-day314-kontrakt-kart-rodzina
MARKER=bc18bc7acac2ec825ebb3db2f1309738ab034d58

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day314-kontrakt-kart-rodzina-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day314-kontrakt-kart-rodzina/config.worktree"
cat "$VAULT/worktrees/cx-day314-kontrakt-kart-rodzina/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day314-kontrakt-kart-rodzina-scratch
mkdir -p /private/tmp/cx-day314-kontrakt-kart-rodzina-artefakty

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
git -C "$VAULT" log --oneline bc18bc7acac2ec825ebb3db2f1309738ab034d58..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only bc18bc7acac2ec825ebb3db2f1309738ab034d58..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day314-kontrakt-kart-rodzina-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only bc18bc7acac2ec825ebb3db2f1309738ab034d58..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: kontraktow kart jest SIEDEM, jeden wspolny alias `?cardContract=1` wlacza je NARAZ
git grep -l 'cardContract' -- src | sort
git grep -n "get('cardContract')" -- src | wc -l
#   oczekiwane autora: 18 plikow na liscie, w tym SIEDEM plikow kontraktu
#   (initiativeCardContract.ts, insightCardContract.ts, interviewCardContract.ts,
#    decisionCardContract.ts, notificationCardContract.ts, taskCardContract.ts,
#    DiscoveryTools/toolCards.contract.ts) i SIEDEM widokow-konsumentow.
#   Druga komenda daje SZESC, nie siedem — Inicjatywa czyta ten sam parametr przez STALA
#   `FLAG_QUERY_ALIAS`, a nie przez literal. To NIE JEST oznaka, ze Inicjatywa ma inny alias:
#   sprawdz `grep -n FLAG_QUERY_ALIAS src/components/Initiatives/sections/initiativeCardContract.ts`.
#   Wspolny klucz localStorage: `ff.cardContract`. Zapisz swoje liczby — to Twoj mianownik.

# (2) TEZA: Inicjatywa po naprawie ma PUSTE ziarno ukryc i 24 pozycje kolejnosci kanonicznej
grep -n 'INITIATIVE_CONTRACT_HIDDEN_SEED' src/components/Initiatives/sections/initiativeCardContract.ts
node -e "const s=require('fs').readFileSync('src/components/Initiatives/sections/initiativeCardContract.ts','utf8');const m=s.match(/INITIATIVE_BOARD_CANONICAL_ORDER[^=]*=\s*\[([\s\S]*?)\];/);console.log('kolejnosc kanoniczna:',((m?m[1]:'').match(/'[^']+'/g)||[]).length)"
#   oczekiwane autora: ziarno = pusta tablica `[]`, kolejnosc kanoniczna = 24

# (3) TEZA: rodzenstwo NIE MA wlasnego ziarna ukryc — mechanizm zwezenia siedzi gdzie indziej
git grep -n 'HIDDEN_SEED\|hiddenSectionIds' -- src/components/Interview src/components/MyWork src/components/DiscoveryTools
#   oczekiwane autora: SZESC trafien i ZERO z nich to `HIDDEN_SEED` — piec to ZYWY, WLASNY stan
#   `hiddenSectionIds` w `InsightViewer.tsx` (deklaracja `useState<Set<string>>`, filtr sekcji,
#   przekazanie dalej), szoste to komentarz w `TaskDetailView.tsx` mowiacy, ze Task takiego stanu
#   NIE MA.
#   ★ WNIOSEK, ktory masz potwierdzic: w rodzenstwie sa DWIE niezalezne drogi utraty sekcji —
#   (a) `spec` podawany do `useCardLayout` (`spec: xxxContractEnabled ? X_CARD_SPEC : ...`), gdzie
#   `buildDefaultLayout` bierze `spec.sets[0].cards` jako ZBIOR WIDOCZNYCH, oraz
#   (b) wlasny, zastany `hiddenSectionIds` w `InsightViewer`. Sprawdzasz OBIE, nie jedna.
#   Nie szukaj `hiddenSectionIds` tam, gdzie go nie ma — i nie przeocz go tam, gdzie jest.

# (4) TEZA: kazdy z 7 typow ma ekran w harnessie kanonicznym
python3 -c "import json;d=json.load(open('scripts/dev/g06-macierz-ekrany.json'));import itertools;print(sorted([e for k,v in d.items() if k[0].isdigit() for e in v if e.startswith('karta-')]))"
ls dev-render/screens/ | grep '^karta-'
#   oczekiwane autora: karta-decision, karta-initiative, karta-insight, karta-interview,
#   karta-notification, karta-task (+ karta-task-pelna), karta-tool

# (5) TEZA: narzedzie zrzutow UMIE juz liczyc pozycje i porownywac pary — nie piszesz swojego
grep -n "zlicz\|porownaj-z\|parametry\|rozwin-sekcje\|cofnij-jesli-skraca" scripts/dev/grafika-zrzuty.mjs | head -12
grep -rn 'data-nmode-section-item\|data-nmode-section-group' src/components/shared/NModeLayout/NModeLeftNav.tsx
#   oczekiwane autora: opcje `--zlicz`, `--porownaj-z`, `--parametry`, `--rozwin-sekcje`,
#   `--cofnij-jesli-skraca` istnieja; uchwyty w nawigacji to DOKLADNIE
#   `data-nmode-section-item` (pozycja) i `data-nmode-section-group` (naglowek grupy).
#   ★ UWAGA: w zamowieniu nadzorcy pada nazwa `data-nmode-group` — TAKIEGO uchwytu NIE MA.
#   Obowiazuje nazwa z kodu. Zapisz te rozbieznosc w „Korektach wobec instrukcji”.

# (6) TEZA: pulapka fikstury ZAMKNIETA — kazda inicjatywa otwiera zatwierdzony widok
git grep -n 'CanonicalInitiativeCardWorkspace' -- src | wc -l
grep -n 'handleOpenInitiativeDocument' src/components/Initiatives/InitiativesHub.tsx | head -3
#   oczekiwane autora: DOKLADNIE JEDNO trafienie i jest to KOMENTARZ w `InitiativesHub.tsx`
#   dokumentujacy usuniecie komponentu — zero kodu, zero importu, zero renderu.
#   `handleOpenInitiativeDocument` otwiera `InitiativeDocumentView` dla KAZDEJ inicjatywy.
#   Potwierdz to sam — pomiar ma isc sciezka produkcyjna, na rekordzie BEZ prefiksu `showcase`.

# (7) TEZA: bezpiecznik kompletnosci Inicjatywy istnieje i jest zielony PRZED Twoja praca
npx vitest run tests/unit/initiatives/initiativeCardContractCompleteness.test.ts --retry=0 2>&1 | tail -6
#   oczekiwane autora: 6 przypadkow, wszystkie zielone. Jesli czerwone — to jest STOP wejsciowy,
#   bo pracujesz na zepsutej bazie (patrz „Baza pomiaru musi sie kompilowac”).

# (8) TEZA: bramki kanonu maja stan PRZED, ktory trzeba zapisac NAZWA PO NAZWIE
bash scripts/check-artefakt.sh 2>&1 | tail -3
bash scripts/check-focus-canon.sh --ci 2>&1 | tail -3
bash scripts/check-list-canon.sh 2>&1 | tail -3
#   oczekiwane autora: check-focus-canon --ci: OK, baseline 41 plikow / 60 wystapien.
#   Pozostale dwie — zapisz JAKIKOLWIEK stan, ktory dostaniesz, PRZED zmianami.

# (9) TEZA: porty, kontener i dysk sa wolne
lsof -nP -iTCP:5470 -sTCP:LISTEN; lsof -nP -iTCP:6330 -sTCP:LISTEN
docker ps --format '{{.Names}}' | grep -c cx-day314 || true
df -h /
#   oczekiwane: puste lsof, 0 kontenerow, powyzej 5 GB wolnego
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day314-kontrakt-kart-rodzina-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6330`. Twój JEDYNY port harnessu to `5470`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day314-pg`**. **ZAKAZANE:** `Zakazane na stale: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajete przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5449 oraz 6311-6313 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyzury 286-313 (bazy 6290-6329, harness 5250-5469). Cudze w TEJ SAMEJ partii: dyzur 315 (runtime 5471, baza 6331, kontener `cx-day315-pg`) i dyzur 316 (runtime 5472, baza 6332, kontener `cx-day316-pg`) — do nich nie zagladasz. Twoje wlasne i JEDYNE: baza 6330, runtime 5470, kontener `cx-day314-pg`. Sprawdzasz sam przed startem: `lsof -nP -iTCP:PORT -sTCP:LISTEN` oraz `docker ps`. Zajety port jest STOP-em calosci, a nie zaproszeniem do wziecia innego numeru`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `zadnej nowej flagi. Pracujesz na ISTNIEJACEJ fladze `?cardContract=1` / `ff.cardContract` / `VITE_VF1_*_CARD_CONTRACT`, ktora JUZ jest default OFF i MA POZOSTAC default OFF do akceptu wlasciciela`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-artefakt.sh` · `scripts/check-list-canon.sh` · `scripts/check-focus-canon.sh --ci` (baseline `scripts/check-focus-canon.baseline.txt` — 41 plikow / 60 wystapien; wolno go tylko ZACISNAC, nigdy poluzowac) · `scripts/dev/grafika-zrzuty.mjs` (harness kanoniczny — wolno DODAC opcje opt-in, nie wolno zmienic zachowania domyslnego) · `tests/unit/initiatives/initiativeCardContractCompleteness.test.ts` (bezpiecznik DEC-387 dla Inicjatywy — zielony, nie psujesz go) · `src/components/standard/cardContract.types.ts` (typ wiazacy siedmiu kart — zmiana tutaj dotyka wszystkich naraz)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY314_KONTRAKT_KART_RODZINA_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md` — ten dyzur jest przekrojowy przez cztery moduly (02_INTERVIEW, 03_TOOLS, 05_INITIATIVES, 07_MY_WORK_AGENT), a praca konczy sie z flaga OFF i bez akceptu wlasciciela, wiec nie ma czego podnosic do stanu faktycznego. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day314-kontrakt-kart-rodzina-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day314-kontrakt-kart-rodzina-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **ZAKAZ LICZENIA POZYCJI OKIEM ZE ZRZUTU** — kazda liczba sekcji i grup w Twoim raporcie musi pochodzic z `scripts/dev/grafika-zrzuty.mjs --zlicz` (uchwyty `data-nmode-section-item` i `data-nmode-section-group`) albo z uruchomionego testu; liczba „policzona na obrazku” jest podstawa odrzucenia raportu. ★★ **ZAKAZ PISANIA WLASNEGO SKRYPTU ZRZUTOW OBOK KANONICZNEGO** — brakujaca zdolnosc dokladasz do `scripts/dev/grafika-zrzuty.mjs` jako opcje OPT-IN, z zachowaniem domyslnego zachowania bit w bit. ★★ **ZAKAZ WLACZENIA FLAGI DOMYSLNIE** — `ff.cardContract` i rodzina `VITE_VF1_*_CARD_CONTRACT` konczy dyzur jako default OFF; wlaczenie nastepuje po akcepcie wlasciciela na parach zrzutow, jedna para na typ karty. ★★ **ZAKAZ POMIARU NA FIKSTURZE POKAZOWEJ** — rekord bez prefiksu `showcase`, sciezka produkcyjna. ★★ **ZAKAZ ROZSTRZYGANIA KOLEJNOSCI GRUP Z WLASNEJ GLOWY** — jesli dokument kanonu nie odpowiada, zapisujesz PYTANIE do wlasciciela, nie wymyslasz odpowiedzi | DEC-387 i slowa wlasciciela z 04.09: „Musimy miec kompletne karty inicjatyw — to jest sens naszej aplikacji”. Poprzedni odbior podal liczbe „11 z 15” policzona OKIEM na obrazku — byla to pojemnosc kadru lewego panelu, nie liczba sekcji, i nikt nie mogl jej powtorzyc; z tego powodu do harnessu kanonicznego dolozono `--zlicz` i `--porownaj-z` |

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
cd /private/tmp/cx-day314-kontrakt-kart-rodzina

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day314-pg psql -U postgres -d cx314 \
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
cd /private/tmp/cx-day314-kontrakt-kart-rodzina

docker run -d --name cx-day314-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx314 \
  -p 127.0.0.1:6330:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day314-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6330/cx314 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6330/cx314 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day314-kontrakt-kart-rodzina && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6330/cx314 \
JWT_SECRET=cx314-test-secret-do-not-reuse \
npx vitest run tests/unit/initiatives/initiativeCardContractCompleteness.test.ts tests/unit/cards/ src/components/shared/NModeLayout/__tests__/ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day314-kontrakt-kart-rodzina-artefakty/day314-kontrakt-kart-rodzina.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day314-kontrakt-kart-rodzina && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit/initiatives/initiativeCardContractCompleteness.test.ts tests/unit/cards/ src/components/shared/NModeLayout/__tests__/ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day314-kontrakt-kart-rodzina-artefakty/day314-kontrakt-kart-rodzina.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day314-kontrakt-kart-rodzina/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day314-pg psql -U postgres -d cx314 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day314-pg`.
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
> **(e) (e) ★★ POJEMNOSC KADRU UDAJE LICZBE SEKCJI. Lewy panel karty ma WLASNE
> przewijanie (`NModeLeftNav.tsx`, klasa `N_MODE_LEFT_NAV_SCROLL_CLASS` w bloku
> `sticky top-28`), wiec przy 1440x900 widac naraz okolo pietnastu pozycji
> NIEZALEZNIE od tego, ile ich jest. Odbiorca dyzuru 305 policzyl „11 z 15”
> OKIEM na obrazku — to byla POJEMNOSC KADRU, nie liczba sekcji, i nikt nie mogl
> tej liczby powtorzyc. **Liczebnosc mierzysz uchwytem DOM przez `--zlicz`,
> nigdy ze zrzutu.** Zrzut sluzy wylacznie do pokazania wlascicielowi, jak to
> WYGLADA; ile tego jest — mowi liczba z narzedzia.
>
> (f) ★★ ROZWIJANIE SEKCJI POTRAFI ZAMKNAC PODGLAD. Udokumentowany ksztalt
> „przyrzad zamyka podglad przed skanem”: petla rozwijania klika w naglowki i przy
> okazji zwija panel, ktory mial byc na zrzucie, a skan w trakcie animacji daje
> falszywy wynik. Dlatego dla KAZDEGO ekranu robisz przelot Z `--rozwin-sekcje=1`
> i BEZ niego, porownujesz DLUGOSC wydobytego tekstu, i jesli wersja „rozwinieta”
> ma tekstu MNIEJ — uzywasz `--cofnij-jesli-skraca=1` i zapisujesz ten fakt.
>
> (g) ★★ WSPOLNY ALIAS WLACZA WSZYSTKO NARAZ. `?cardContract=1` i klucz
> `ff.cardContract` w localStorage sa WSPOLNE dla wszystkich siedmiu typow. Nie da
> sie wlaczyc jednego typu tym linkiem. Skutek praktyczny: jesli mierzysz typ po
> typie w tej samej przegladarce, MUSISZ czyscic `localStorage` miedzy przelotami,
> inaczej „OFF” nie bedzie OFF-em. Harness kanoniczny startuje czysty kontekst na
> przelot — ale jesli klikasz recznie, to jest Twoja pulapka.
>
> (★) ★★ `npx vitest run` W TYM REPO ZAPISUJE `junit.xml` DO KORZENIA WORKTREE.
> To jest zachowanie konfiguracji, nie Twoj blad — nie commituj tego pliku i nie
> „naprawiaj” go zmiana konfiguracji testow. Do artefaktow uzywasz
> `--reporter=json --outputFile=<plik POZA repo>`, jak w `§0.2c`.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day314-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day314-kontrakt-kart-rodzina-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 — pomiar OFF vs ON dla KAZDEGO z siedmiu typow, uchwytem DOM (`--zlicz`), liczba sekcji i liczba grup; R2 — przyczyna w kodzie dla kazdego typu, ktory cokolwiek gubi; R3 — naprawa: kontrakt ZACHOWUJE sekcje i tylko PORZADKUJE; R4 — bezpiecznik kompletnosci per typ z dowodem mutacyjnym w ZABEZPIECZENIE`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6330` albo `5470` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6330` albo `5470`** (`Z7`).

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

Właściciel powiedział 04.09 dosłownie: **„Musimy mieć kompletne karty inicjatyw — to jest sens
naszej aplikacji”** (`DEC-387`). Tego samego dnia zaakceptował parę zrzutów karty Inicjatywy —
ale zaakceptował JEDEN typ karty z siedmiu.

Co się stało wcześniej: kontrakt karty z dyżuru 305, po włączeniu flagi, **kasował 20 z 24 sekcji
i 3 z 5 grup** lewej nawigacji rekordu Inicjatywy. Przyczyna nie była subtelna — ziarno
`hiddenSectionIds` budowano jako **zamkniętą allowlistę**: widoczne było wyłącznie to, co należało
do `INITIATIVE_CORE_BOARD_IDS` ∪ `INITIATIVE_MINIMAL_BOARD_VISIBLE_IDS`, czyli **cztery id**.
Wszystko pozostałe znikało. Naprawa jest już na markerze: `INITIATIVE_CONTRACT_HIDDEN_SEED` jest
puste, porządkowanie jest permutacją, a bezpiecznik
`tests/unit/initiatives/initiativeCardContractCompleteness.test.ts` (M1–M4, dwie mutacje) tego pilnuje.

**Czego nikt nie zmierzył i po co jesteś tutaj:** pozostałe **sześć typów kart** — Task, Decision,
Notification, Insight, Interview, Tool. Wszystkie siedem wisi na **jednym wspólnym aliasie**
`?cardContract=1` i jednym kluczu `ff.cardContract`, więc **jedno kliknięcie właściciela włącza je
naraz**. Jeżeli ta sama zamknięta allowlista siedzi w rodzeństwie, to w dniu włączenia flagi
właściciel straci sekcje w sześciu miejscach jednocześnie — i zobaczy to jako „aplikacja gubi treść”,
a nie jako „flaga”.

## ★★ OSTRZEŻENIE, KTÓRE MUSISZ PRZECZYTAĆ PRZED PIERWSZYM POMIAREM

Poprzedni odbiór tej rodziny zameldował: **„ON kasuje 11 z 15 sekcji”**. Ta liczba była **FAŁSZYWA
JAKO LICZBA SEKCJI** — była to **POJEMNOŚĆ KADRU**.

Lewy panel karty ma **własne przewijanie** (`src/components/shared/NModeLayout/NModeLeftNav.tsx`,
blok `sticky top-28` + klasa `N_MODE_LEFT_NAV_SCROLL_CLASS`), więc przy 1440×900 mieści naraz
około piętnastu pozycji **niezależnie od tego, ile ich naprawdę jest**. Odbiorca policzył pozycje
palcem po obrazku, a ponieważ obrazek nie mógł pokazać więcej niż piętnaście — dostał piętnaście.

**Wniosek operacyjny, obowiązujący Cię bez wyjątku: liczebność mierzysz UCHWYTEM DOM, nigdy okiem.**
Narzędzie kanoniczne `scripts/dev/grafika-zrzuty.mjs` ma dwie opcje **opt-in**, dołożone właśnie po
tym incydencie (`DEC-387`, 04.09):

- `--zlicz=<nazwa>:<selektor CSS>[;<nazwa>:<selektor>...]` — liczy `querySelectorAll(css).length`
  **w chwili zrzutu**, zapisuje pierwsze 60 tekstów trafionych węzłów i wypisuje liczbę
  w podsumowaniu oraz w `--wynik-json`. Zero trafień raportuje jako `0`, nigdy nie pomija.
- `--porownaj-z=<katalog>` — porównuje każdy świeży zrzut z jednoimiennym zrzutem z podanego
  katalogu: sumy SHA-256 obu plików i procent różnych pikseli. Para bajtowo identyczna jest
  raportowana jako `IDENTYCZNE` z kodem wyjścia 1.

Uchwyty pomiarowe w nawigacji to **dokładnie**:

| Co liczysz | Selektor |
|---|---|
| pozycja sekcji | `[data-nmode-section-item]` |
| nagłówek grupy | `[data-nmode-section-group]` |

★ **Rozbieżność, którą masz potwierdzić i zapisać:** w zamówieniu nadzorcy pada nazwa
`data-nmode-group`. **Takiego atrybutu w kodzie NIE MA** — jest `data-nmode-section-group`
(`NModeLeftNav.tsx`, komentarz „DEC-387 — uchwyt pomiarowy nagłówka grupy”). Sprawdź to `grep`-em
i wpisz do „Korekt wobec instrukcji”. To jest przykład tego, o co chodzi w zdaniu zamykającym
tę instrukcję.

## ★ Pułapka fikstury — ZAMKNIĘTA, ale masz to potwierdzić własną komendą

Przez trzy tygodnie odbiór Inicjatywy stał na przyrządzie: realne inicjatywy (od 13.08, `07bc597420`)
otwierały nieodebrany `CanonicalInitiativeCardWorkspace`, a zatwierdzony widok dostawały wyłącznie
id z prefiksem `showcase`. **Dziś tego komponentu w repo nie ma**, a
`InitiativesHub.tsx` → `handleOpenInitiativeDocument` otwiera `InitiativeDocumentView` dla
**każdej** inicjatywy. Potwierdź to komendami (2) i (6) z weryfikacji wejściowej i **mierz na rekordzie
bez prefiksu `showcase`** — dla Inicjatywy referencyjny rekord to `init-smed-linia-pakowania`
(ten sam, na którym powstał pomiar 24/5 → 4/2).

## ★ Zmierz moje liczby sam

Twierdzę, na markerze:

| # | Twierdzenie | Moja liczba | Komenda |
|---|---|---|---|
| 1 | typów kart z własnym kontraktem | **7** | `git grep -l 'cardContract' -- src \| sort` (7 plików `*ardContract*`/`*.contract.ts` + 7 konsumentów) |
| 2 | wspólny alias włączający wszystkie naraz | **1** (`?cardContract=1`, `ff.cardContract`) | `git grep -n "get('cardContract')" -- src` |
| 3 | ziarno ukryć Inicjatywy po naprawie | **puste `[]`** | `grep -n 'INITIATIVE_CONTRACT_HIDDEN_SEED' src/components/Initiatives/sections/initiativeCardContract.ts` |
| 4 | pozycji w kolejności kanonicznej Inicjatywy | **24** | komenda (2) z weryfikacji wejściowej |
| 5 | grup w lewej nawigacji Inicjatywy | **5** (Zakres i plan · Decyzje i ryzyko · Rezultaty · Ludzie · Zapisy) | `grep -n 'groupLabels' src/components/Initiatives/InitiativeDocumentView.tsx` |
| 6 | rodzeństwo z własnym `HIDDEN_SEED` | **0 plików** | komenda (3) z weryfikacji wejściowej |
| 6b | rodzeństwo z **własnym, żywym `hiddenSectionIds`** | **1 plik — `InsightViewer.tsx`** | komenda (3) |
| 7 | ekranów `karta-*` w harnessie | **8** (7 typów + `karta-task-pelna`) | `ls dev-render/screens/ \| grep '^karta-'` |
| 8 | baseline bramki fokusu | **41 plików / 60 wystąpień** | `bash scripts/check-focus-canon.sh --ci` |

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

★ Twierdzenia 6 i 6b są najważniejsze i najbardziej podchwytliwe. Brak `HIDDEN_SEED`
w rodzeństwie **nie znaczy, że rodzeństwo jest bezpieczne** — w rodzinie są **dwie niezależne
drogi utraty sekcji** i masz sprawdzić obie:

| Droga | Gdzie | Jak wygląda |
|---|---|---|
| **(a) ziarno widoczności przez `spec`** | wszystkie siedem konsumentów | `spec: xxxContractEnabled ? X_CARD_SPEC : ...` → `buildDefaultLayout` w `useCardLayout.ts` bierze `spec.sets[0].cards` jako **zbiór widocznych**, a resztę katalogu chowa |
| **(b) własny, zastany `hiddenSectionIds`** | **`src/components/Interview/InsightViewer.tsx`** — jedyny taki przypadek w rodzeństwie | żywy `useState<Set<string>>`, filtr sekcji i przekazanie dalej; działa **niezależnie** od kontraktu |

**Nie szukaj `hiddenSectionIds` tam, gdzie go nie ma — i nie przeocz go tam, gdzie jest.**
Komentarz w `TaskDetailView.tsx` mówi wprost, że Task takiego stanu nie ma — to jest wskazówka,
że autor kontraktu **wiedział o tej różnicy** i warto sprawdzić, czy wiedział o wszystkich.

# TABELA LICENCJI PLIKOWYCH

Ta tabela jest **jedynym** źródłem prawa do zapisu w tym dyżurze. Kolumna „Produkt zastępczy”
mówi, co robisz, gdy pliku nie wolno Ci zmienić — **żaden wiersz nie brzmi samo „STOP”**.

| Warstwa | Ścieżka | Prawo | Produkt zastępczy / uwaga |
|---|---|---|---|
| **kontrakt (rdzeń)** | `src/components/Initiatives/sections/initiativeCardContract.ts` | **ODCZYT — WZORZEC** | Naprawiony 04.09 i zaakceptowany przez właściciela. Kopiujesz z niego **wzorzec** (puste ziarno + permutacja), nie zmieniasz go. Jeśli Twoja naprawa rodzeństwa wymaga zmiany TUTAJ — czerwony kontrakt testowy + brief, pozycja **ZROBIONA** |
| **kontrakt** | `src/components/MyWork/taskCardContract.ts` | **★ PEŁNA LICENCJA** w zakresie `R2`–`R3` | — |
| **kontrakt** | `src/components/MyWork/decisionCardContract.ts` | **★ PEŁNA LICENCJA** w zakresie `R2`–`R3` | — |
| **kontrakt** | `src/components/MyWork/notificationCardContract.ts` | **★ PEŁNA LICENCJA** w zakresie `R2`–`R3` | — |
| **kontrakt** | `src/components/Interview/insightCardContract.ts` | **★ PEŁNA LICENCJA** w zakresie `R2`–`R3` | — |
| **kontrakt** | `src/components/Interview/interviewCardContract.ts` | **★ PEŁNA LICENCJA** w zakresie `R2`–`R3` | — |
| **kontrakt** | `src/components/DiscoveryTools/toolCards.contract.ts` | **★ PEŁNA LICENCJA** w zakresie `R2`–`R3` | — |
| **typ wiążący (przekrojowy)** | `src/components/standard/cardContract.types.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Zmiana tutaj dotyka **siedmiu kart naraz**. Produkt zastępczy: **czerwony kontrakt testowy** — nowy plik testu, który dziś **PADA** i opisuje żądane zachowanie, oznaczony `it('KONTRAKT DLA DYŻURU 314 — …')`, plus brief wynikowy w raporcie. Pozycja jest wtedy **ZROBIONA** |
| **powłoka / silnik (przekrojowy)** | `src/components/shared/NModeLayout/useCardLayout.ts` | **TYLKO ODCZYT** | To silnik wspólny wszystkich kart i kilku innych artefaktów. Jak wyżej: czerwony kontrakt + brief |
| **powłoka** | `src/components/shared/NModeLayout/NModeLeftNav.tsx` | **★ WĄSKA LICENCJA:** wyłącznie **dodanie brakującego uchwytu pomiarowego** `data-nmode-section-item` / `data-nmode-section-group`, jeżeli którejś gałęzi renderowania go brakuje | Zakaz zmiany klas, układu, kolejności i logiki zwijania grup. Każdy dodany uchwyt opisujesz w raporcie |
| **konsument** | `src/components/Initiatives/InitiativeDocumentView.tsx` | **★ WĄSKA LICENCJA:** wyłącznie pozycja `R5` (rekord z niepustym szablonem) i wyłącznie w bloku `visibleSections` / `initiativeNSections` | Zakaz przebudowy widoku; zakaz ruszania `groupLabels` i `groupIndexById` bez rozstrzygnięcia z `R6` |
| **konsument** | `src/components/MyWork/TaskDetailView.tsx` | **★ WĄSKA LICENCJA:** wyłącznie hook flagi i przekazanie `spec` do `useCardLayout`, w zakresie `R3` | — |
| **konsument** | `src/components/MyWork/DecisionDetailView.tsx` | jak wyżej | ★ Ten widok ma **inny, uboższy** hook flagi (czyta tylko URL, bez `localStorage` i bez `env`). Rozstrzygnij, czy to defekt rodziny, i zapisz |
| **konsument** | `src/components/MyWork/NotificationDetailView.tsx` | jak wyżej | — |
| **konsument** | `src/components/Interview/InsightViewer.tsx` | jak wyżej | — |
| **konsument** | `src/components/Interview/InterviewWorkspace.tsx` | jak wyżej | — |
| **konsument** | `src/components/DiscoveryTools/KnownToolDetailView.tsx` | jak wyżej | — |
| **harness** | `dev-render/screens/karta-*.tsx` (8 plików) | **★ PEŁNA LICENCJA** na dołożenie tego, co potrzebne do pomiaru | Zakaz zmiany warstwy produktu przez harness; harness ma **montować realny komponent**, nie replikę JSX |
| **harness (przekrojowy)** | `scripts/dev/grafika-zrzuty.mjs` | **★ WĄSKA LICENCJA:** wyłącznie **NOWE opcje opt-in** | **Domyślne zachowanie bit w bit bez zmian.** Zakaz pisania własnego skryptu zrzutów obok |
| **test** | `tests/unit/initiatives/initiativeCardContractCompleteness.test.ts` | **TYLKO ODCZYT — WZORZEC** | Zielony bezpiecznik `DEC-387`. Kopiujesz z niego strukturę M1–M4. Nie psujesz |
| **test (NOWE pliki)** | `tests/unit/cards/**`, `src/components/**/__tests__/**` | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31` | `git add -f` — nowe pliki w `tests/` bywają ignorowane |
| **dokument kanonu** | `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` | **TYLKO ODCZYT** | Źródło rozstrzygnięcia `R6`. Jeśli kanon milczy — **pytanie do właściciela w raporcie**, nie własna decyzja |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY314_KONTRAKT_KART_RODZINA_REPORT.md` (**NOWY PLIK**) | **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| **cudzy teren** | `src/components/AIChat/**` | **TYLKO ODCZYT — teren dyżuru 315** | Wpis do raportu: plik, linia, problem, **gotowa rekomendacja jako diff w bloku kodu, nienałożony**. Pozycja idzie dalej |
| **cudzy teren** | `src/services/api.ts`, `src/services/errors/**` | **TYLKO ODCZYT — teren dyżuru 316** | jak wyżej |
| **cudzy teren** | `server/src/**`, `server/migrations/**` | **TYLKO ODCZYT** | Ten dyżur nie ma pozycji serwerowej ani migracyjnej |

**Nietykalne imiennie:** `src/components/standard/cardContract.types.ts`;
`src/components/shared/NModeLayout/useCardLayout.ts`; `initiativeCardContract.ts` (naprawa 04.09,
zaakceptowana); domyślna wartość flagi `ff.cardContract` i rodziny `VITE_VF1_*_CARD_CONTRACT`
(kończą dyżur jako **OFF**); baseline `scripts/check-focus-canon.baseline.txt` (wolno tylko
**zacisnąć**, nigdy poluzować).

**Rozłączność z partią równoległą:** dyżur 315 pracuje w `src/components/AIChat/**` i w
`dev-render/screens/` na ekranach Czatu; dyżur 316 pracuje w `src/services/**` i w warstwie
prezentacji błędów. Wspólny punkt styku to **wyłącznie** `scripts/dev/grafika-zrzuty.mjs`
(Ty i 315 możecie chcieć dołożyć tam opcję). Przed pierwszym commitem w tym pliku sprawdź
`git log` gałęzi bazowej i **zgłoś kolizję zasobową ZANIM napiszesz**, nie po.

# POZYCJE

## R1 — POMIAR SIEDMIU TYPÓW, OFF vs ON (rdzeń)

Dla **każdego** z siedmiu typów, osobno, dwa przeloty kanonicznym harnessem: bez flagi i z flagą
(`--parametry='cardContract=1'`). Dla każdego przelotu **liczba pozycji** i **liczba grup**
z `--zlicz`, w obu motywach.

Szkic komendy (dopracuj nazwy ekranów i port sam; harness stoi na Twoim porcie `5470`):

```bash
cd "$WT"
# serwer harnessu — TWÓJ port, strictPort, w tle
npx vite --config dev-render/vite.config.ts --port 5470 --strictPort &

node scripts/dev/grafika-zrzuty.mjs \
  --base=http://127.0.0.1:5470 \
  --ekrany=karta-initiative,karta-task,karta-decision,karta-notification,karta-insight,karta-interview,karta-tool \
  --katalog=evidence/grafika/kontrakt-kart-314/OFF \
  --faza=PRZED --motywy=light,dark --szerokosc=1440 --wysokosc=900 \
  --rozwin-sekcje=1 --cofnij-jesli-skraca=1 \
  --zlicz='sekcje:[data-nmode-section-item];grupy:[data-nmode-section-group]' \
  --wynik-json=/private/tmp/cx-day314-kontrakt-kart-rodzina-artefakty/off.json

node scripts/dev/grafika-zrzuty.mjs \
  --base=http://127.0.0.1:5470 \
  --ekrany=karta-initiative,karta-task,karta-decision,karta-notification,karta-insight,karta-interview,karta-tool \
  --katalog=evidence/grafika/kontrakt-kart-314/ON \
  --faza=PO --motywy=light,dark --szerokosc=1440 --wysokosc=900 \
  --parametry='cardContract=1' \
  --rozwin-sekcje=1 --cofnij-jesli-skraca=1 \
  --zlicz='sekcje:[data-nmode-section-item];grupy:[data-nmode-section-group]' \
  --porownaj-z=evidence/grafika/kontrakt-kart-314/OFF \
  --wynik-json=/private/tmp/cx-day314-kontrakt-kart-rodzina-artefakty/on.json
```

**Obowiązkowa kontrola przyrządu, zanim uwierzysz wynikowi** (ten krok jest częścią pozycji,
nie dodatkiem):

1. Przelot **z** `--rozwin-sekcje=1` i **bez** niego, dla tego samego ekranu.
2. Porównaj **długość wydobytego tekstu** w obu przelotach.
3. Jeżeli wersja „rozwinięta” ma tekstu **mniej** — rozwijanie **zamyka** podgląd (udokumentowany
   kształt „przyrząd zamyka podgląd przed skanem”). Wtedy `--cofnij-jesli-skraca=1` jest
   obowiązkowe, a fakt zapisujesz w raporcie.
4. Zrzut, na którym `--zlicz` daje `0` dla `[data-nmode-section-item]`, **nie jest dowodem, że
   sekcji nie ma** — najpierw sprawdź, czy komponent w ogóle się zamontował. „Brak pomiaru nie
   jest wynikiem”.

**Ukończone, gdy:** w raporcie jest tabela `typ · motyw · sekcje OFF · sekcje ON · grupy OFF ·
grupy ON · różnica`, wypełniona **liczbami z narzędzia**, a każdy wiersz ma nazwę pliku zrzutu.
Sekcje **rozwinięte**. Kontrola przyrządu opisana.

**Commit po `R1`.**

## R2 — PRZYCZYNA W KODZIE, PER TYP (rdzeń)

Dla każdego typu, który w `R1` cokolwiek gubi: **gdzie dokładnie** ginie sekcja. Ścieżka do
wskazania jest zawsze ta sama i ma cztery ogniwa:

`kontrakt (X_CARD_SPEC / X_CARD_RENDER_IDS)` → `konsument (spec: enabled ? SPEC : ...)` →
`useCardLayout.buildDefaultLayout` (`spec.sets[0].cards` = zbiór widocznych) → `NModeLeftNav`.

★ Dla `InsightViewer` ogniw jest **pięć** — dochodzi jego własny, zastany `hiddenSectionIds`,
który filtruje sekcje **niezależnie od kontraktu**. Zmierz, które z dwóch ogniw kurczy zbiór;
jeżeli oba, powiedz to wprost i podaj liczby osobno.

Wskazujesz **plik i linię** ogniwa, w którym zbiór się kurczy, i nazywasz mechanizm: allowlista,
brakujący wpis w katalogu, zły zestaw w `sets[0]`, czy zastany stan ukryć.

★ Typ, który **niczego nie gubi**, też dostaje wiersz — z dowodem, dlaczego nie gubi. „Nie
sprawdzone” i „sprawdzone, w porządku” to dwa różne wyniki i mają się różnić w raporcie.

**Commit po `R2`.**

## R3 — NAPRAWA: KONTRAKT ZACHOWUJE, NIE KASUJE (rdzeń)

Zasada naprawy jest jedna i wynika wprost z `DEC-387`: **kontrakt karty ma sekcje ZACHOWYWAĆ
i tylko PORZĄDKOWAĆ.** Wzorzec masz w `initiativeCardContract.ts`:

- ziarno ukryć **puste**,
- funkcja porządkująca jest **permutacją** (nic nie wypada po drodze),
- kolejność kanoniczna **pokrywa** każdą sekcję, którą produkt realnie renderuje,
- lista id jest czytana **ze źródła produktu**, nie przepisana do testu.

Commit **per typ**, z `esbuild` każdego dotkniętego pliku. Zakaz zamiany hurtem przez jeden
codemod bez pomiaru per typ — to jest dokładnie ten błąd, którym allowlista weszła do siedmiu
miejsc naraz.

**Commit per typ.**

## R4 — BEZPIECZNIK KOMPLETNOŚCI PER TYP (rdzeń)

Nowy test per typ, wzorowany na M1–M4 z bezpiecznika Inicjatywy. **Dowód mutacyjny musi celować
w ZABEZPIECZENIE, nie w mechanizm obok:** mutacja polega na **przywróceniu zamkniętej allowlisty**
(wstawiasz do ziarna ukryć id spoza zestawu rdzenia) i test ma **spaść na czerwono**. Mutacja,
która psuje import, literówkę albo sygnaturę funkcji, **nie jest dowodem** — w trzech na cztery
dyżury jednego dnia testy przechodziły po skasowaniu zabezpieczenia właśnie dlatego, że mutacja
celowała obok.

Uruchamiasz z `--retry=0` i **zapisujesz PEŁNE NAZWY** testów przed i po (`§0.4a`).
`N passed` bez nazw nie jest pomiarem.

**Commit po `R4`.**

## R5 — REKORD Z NIEPUSTYM SZABLONEM (rdzeń, niezmierzony)

`InitiativeDocumentView.tsx` filtruje sekcje przez `initiativeTemplate?.visibleSections ||
initiativeTemplate?.visible_sections` **ZANIM** kontrakt karty cokolwiek zrobi (dwa miejsca w pliku
— znajdź oba `grep`-em `visibleSections`, nie po numerze linii). Szablony poziomów leżą
w `src/components/Initiatives/templates/initiativeLevelTemplates.ts` i mają **niepuste** listy
`visibleSections`.

Czego nikt nie zmierzył: **rekordu na koncie z niepustym szablonem**. Zmierz go — OFF i ON,
`--zlicz` jak w `R1` — i odpowiedz na jedno pytanie: **czy przy niepustym szablonie „komplet”
w ogóle jest osiągalny**, czy szablon z definicji ucina wcześniej.

★ To jest pytanie o **kontrakt produktu**, nie o kod: jeżeli szablon ucina, a właściciel oczekuje
kompletu, to konflikt dwóch mechanizmów i **rozstrzyga go właściciel**. Twoja rola: **zmierzyć
i nazwać konflikt jednym zdaniem, które da się zacytować**. Nie rozstrzygasz go sam.

**Commit po `R5`.**

## R6 — KOLEJNOŚĆ GRUP WOBEC KANONU

Dzisiejsza kolejność grup Inicjatywy (`Zakres i plan · Decyzje i ryzyko · Rezultaty · Ludzie ·
Zapisy`) pochodzi z tablicy `groupLabels` w `InitiativeDocumentView.tsx` — czyli **z kodu, który
sam siebie uzasadnia**. To **nie jest** rozstrzygnięcie kanonu.

Sprawdź `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`, §13.1 (archetyp C — Rekord) i §12
(nawigacja i otwieranie). Moje odczytanie: **§13.1 opisuje sekcje kluczowe PRAWEGO panelu per
artefakt i NIE ustala kolejności grup lewej nawigacji.** Jeżeli potwierdzisz, że kanon w tej
sprawie milczy — **zapisujesz to jako pytanie do właściciela w raporcie i NIE zmieniasz
kolejności**. Jeżeli znajdziesz w kanonie miejsce, które to rozstrzyga — cytujesz je z numerem
paragrafu i dostosowujesz kolejność.

**Zakaz wymyślania kolejności „bo tak logiczniej”.** Zmiana kolejności grup jest zmianą twarzy
produktu i idzie tą samą drogą co reszta: zrzut → akcept właściciela.

**Commit po `R6`.**

## R7 — RAPORT I PARY DO AKCEPTU

Raport zawiera:

1. Tabelę `R1` (siedem typów × dwa motywy, liczby z narzędzia).
2. Tabelę `R2` (przyczyna per typ, plik i linia; typy zdrowe też mają wiersz).
3. Listę par zrzutów **gotowych do pokazania właścicielowi — po jednej parze na typ karty**,
   z sumą kontrolną każdego pliku i wynikiem `--porownaj-z`. **Para bajtowo identyczna nie jest
   parą** i musi być opisana jako defekt kadru albo dowód, że zmiana nie dotarła do renderowanego
   elementu — rozstrzygnij które, nie przemilczaj.
4. Odpowiedź `R5` jednym cytowalnym zdaniem.
5. Rozstrzygnięcie `R6` albo pytanie do właściciela.
6. Stan trzech bramek kanonu **nazwa po nazwie**, przed i po.
7. Zdanie wprost: **flaga kończy dyżur jako default OFF; gałąź NIE jest scalona i czeka na akcept
   właściciela na zrzutach.**
8. Sekcję **TWIERDZENIA NIEZWERYFIKOWANE** — niepustą.

## Prawo zatrzymania

„Zmierzyłem siedem typów, cztery gubiły sekcje, naprawiłem trzy, czwarty wymaga dotknięcia pliku
przekrojowego więc zostawiam czerwony kontrakt i brief, siedem par zrzutów gotowych, żadna nie jest
bajtowo identyczna” **jest wynikiem** i jest lepsze niż siedem naprawionych typów bez pomiaru.

Włączenie flagi domyślnie bez akceptu właściciela **nie jest przyspieszeniem** — jest złamaniem
reguły, która powstała po krachu 07-12 („zakaz masowego włączania”) i po załamaniu 07-11
(„właściciel nigdy nie jest pierwszym testerem wizualnym”).

---

**★ Ostatnie zdanie tej instrukcji i najważniejsze: Jeśli Twój pomiar przeczy liczbie podanej
w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz rozbieżność wprost.** Obalenie którejkolwiek
mojej tezy jest **SUKCESEM** dyżuru, a nie porażką.
