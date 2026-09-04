# INSTRUKCJA DYŻURU nr 324 — Codex — „Kontrakt kart PRZESTAL kasowac sekcje (ON=OFF dla 7 typow, zmierzone uchwytem DOM), ale odbior 04.09 znalazl PRAWDZIWY sufit kompletnosci: przy NIEPUSTYM szablonie inicjatywy karta ma 6 sekcji z 24 — NIEZALEZNIE od flagi, bo filtr `initiativeTemplate.visibleSections` dziala PRZED kontraktem i kontrakt go nie widzi; ten dyzur mierzy sufit, rozstrzyga trzy pulapki wdrozeniowe i domyka kompletnosc Zadania (10 w katalogu, 8 renderowanych) oraz inwentarz typow bez kontraktu"

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
> **wyłącznie** `/private/tmp/cx-day324-szablon-tnie-karte`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `1c3d3da844ae03c87985a8f5dc74846a073c0220`**
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
Zakres: **INICJATYWY — KOMPLETNOSC KARTY (★ NAJWYZSZY PRIORYTET PRODUKTOWY, DEC-387; slowa wlasciciela: „Musimy miec kompletne karty inicjatyw — to jest sens naszej aplikacji"). Pomiar sufitu szablonowego, trzy pulapki wdrozeniowe kontraktu kart, kompletnosc Zadania i Wniosku, inwentarz 7 typow z §13.1 bez kontraktu**.
Trasy front: ``src/components/Initiatives/InitiativeDocumentView.tsx` (RDZEN — `enabledNModeSectionIds` ok. 5274, `visibleSections` ok. 2172, `initiativeNSections` ok. 5291, kolejnosc kanoniczna ok. 9020), `src/components/Initiatives/sections/initiativeCardContract.ts`, `src/components/Initiatives/templates/initiativeLevelTemplates.ts`, `src/components/MyWork/TaskDetailView.tsx` + `taskCardContract.ts`, `src/components/MyWork/DecisionDetailView.tsx` + `decisionCardContract.ts`, `src/components/MyWork/NotificationDetailView.tsx` + `notificationCardContract.ts`, `src/components/Interview/insightCardContract.ts`, `src/components/Interview/interviewCardContract.ts`, `src/components/DiscoveryTools/toolCards.contract.ts`, `src/components/shared/NModeLayout/NModeLeftNav.tsx` (uchwyty `data-nmode-section-item` / `data-nmode-section-group`), `dev-render/screens/karta-initiative.tsx` i szesc siostrzanych `karta-*.tsx``. Trasy tył: ``server/src/services/initiativeTemplateService.ts` — TYLKO ODCZYT. Ten dyzur NIE zmienia `server/src/**`: sufit lezy po stronie frontu (filtr szablonu w `InitiativeDocumentView.tsx`), a nie w serwisie szablonow. Jesli Twoj pomiar pokaze inaczej — to jest wynik, wpisz go i zglos, nie zmieniaj serwera`.

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
WT=/private/tmp/cx-day324-szablon-tnie-karte
MARKER=1c3d3da844ae03c87985a8f5dc74846a073c0220

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day324-szablon-tnie-karte-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day324-szablon-tnie-karte/config.worktree"
cat "$VAULT/worktrees/cx-day324-szablon-tnie-karte/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day324-szablon-tnie-karte-scratch
mkdir -p /private/tmp/cx-day324-szablon-tnie-karte-artefakty

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
git -C "$VAULT" log --oneline 1c3d3da844ae03c87985a8f5dc74846a073c0220..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 1c3d3da844ae03c87985a8f5dc74846a073c0220..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day324-szablon-tnie-karte-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 1c3d3da844ae03c87985a8f5dc74846a073c0220..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day324-szablon-tnie-karte

# ★ WSZYSTKIE grepy uruchamiasz w BASHU (`bash -lc '...'` albo skrypt `.sh`).
#   W `zsh` `grep --include=*.ts` zwraca `no matches found` ZAMIAST wynikow —
#   pustka nie jest wynikiem, dopoki nie sprawdzisz, ze polecenie sie wykonalo.

# (1) TEZA: kontraktow kart jest 7 (initiative, task, decision, notification, insight, interview, tool)
find src -name '*ardContract*.ts' -o -name '*ards.contract.ts' | sort
#   oczekiwane: 8 sciezek — 7 kontraktow artefaktow + `src/components/standard/cardContract.types.ts` (typ wiazacy)

# (2) ★ TEZA GLOWNA: filtr szablonu dziala PRZED kontraktem i kontrakt go NIE WIDZI
grep -n 'enabledNModeSectionIds' src/components/Initiatives/InitiativeDocumentView.tsx
grep -n 'uporzadkujSekcjeBoarduInicjatywy' src/components/Initiatives/InitiativeDocumentView.tsx
#   oczekiwane: `enabledNModeSectionIds` liczone ok. 5274 i STOSOWANE ok. 5544-5548
#   (`allSections.filter(...)`) — czyli ZANIM powstanie `nModeSectionsWithContent`;
#   `uporzadkujSekcjeBoarduInicjatywy` wolane dopiero ok. 9028, na juz OKROJONEJ liscie.
#   To jest przyczyna „6 z 24 niezaleznie od flagi".

# (3) TEZA: kanoniczna kolejnosc boardu inicjatywy ma 24 pozycje
awk 'NR>795 && /^\];/{exit} NR>795' src/components/Initiatives/sections/initiativeCardContract.ts | grep -c "'"
#   oczekiwane: 24

# (4) TEZA: szablon `quick_win` deklaruje 5 sekcji — stad 6 na karcie (5 + zawsze-obecna definicja)
sed -n '36,48p' src/components/Initiatives/templates/initiativeLevelTemplates.ts
#   oczekiwane: `level: 'quick_win'` i `visibleSections: [overview, scope, tasks, kpis, attachments]`

# (5) TEZA: Zadanie ma 10 pozycji w katalogu; Wniosek 30
sed -n '304,315p' src/components/MyWork/taskCardContract.ts
awk 'NR>709 && /^\];/{exit} NR>709' src/components/Interview/insightCardContract.ts | grep -cE '^  [A-Z][A-Z_0-9]*,'
#   oczekiwane: TASK_CARDS = 10 wpisow; INSIGHT_CARDS = 30

# (6) ★ TEZA-PULAPKA: Decyzja NIE czyta `ff.cardContract` z localStorage
sed -n '500,512p' src/components/MyWork/DecisionDetailView.tsx
grep -n "localStorage.getItem('ff.cardContract')" src/components/MyWork/TaskDetailView.tsx src/components/MyWork/NotificationDetailView.tsx src/components/MyWork/DecisionDetailView.tsx src/components/Initiatives/sections/initiativeCardContract.ts
#   oczekiwane: `useDecisionCardContractEnabled` czyta WYLACZNIE `import.meta.env` + query `?cardContract=1`
#   i tylko pod `import.meta.env.DEV`; `ff.cardContract` NIE pada w `DecisionDetailView.tsx`

# (7) TEZA: §13.1 ma 11 wierszy archetypu REKORD; 4 z nich maja kontrakt
grep -n '### 13.1' Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md
sed -n '1041,1052p' Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md
#   oczekiwane: naglowek §13.1 w linii 1037; 11 wierszy tabeli (Initiative, Task, Decision, KPI,
#   Insight, Idea, RAID, Milestone, Change Request, Stage Gate, Action Proposal).
#   ★ MOJA LICZBA: 11 - 4 z kontraktem = 7 typow bez kontraktu, NIE 8. Zlecenie mowilo „8 typow"
#   i wymienialo 7 nazw — policz sam i zapisz SWOJA liczbe.

# (8) zasoby wolne
df -h /
lsof -nP -iTCP:5490 -sTCP:LISTEN; lsof -nP -iTCP:6350 -sTCP:LISTEN
docker ps --format '{{.Names}}' | grep -c cx-day324 || true
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day324-szablon-tnie-karte-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6350`. Twój JEDYNY port harnessu to `5490`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day324-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000, 5037, 5060-5061, 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez inne prace: 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5449 oraz 6311-6313 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286-323 oraz rodzeństwo tej paczki 04.09: 325 (6351/5491), 326 (6352/5492); dyżury 313-323 poza tą instrukcją, sprawdź sam przed startem. Twoje własne: baza 6350, harness 5490. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y, po numerze PID, nigdy po nazwie procesu`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `pozycjach R1 i R3, i WYŁĄCZNIE do zmierzenia pary OFF/ON w Twoim własnym przelocie harnessowym: VITE_VF1_*_CARD_CONTRACT, parametr zapytania cardContract=1 oraz klucz localStorage ff.cardContract. Wszystkie trzy kończą ten dyżur DOMYŚLNIE OFF — zmiana wartości domyślnej w kodzie, w .env*, w docker-compose* albo w railway* jest odrzuceniem pozycji, a nie drobiazgiem. Właściciel akceptuje na Twoich zrzutach, nie na żywym ekranie (CLAUDE.md reguła 7 i §9). Zmiana SPOSOBU ODCZYTU flagi w pozycji R2 nie jest zmianą jej wartości domyślnej i jest dozwolona`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: `scripts/check-list-canon.sh` · `scripts/check-focus-canon.sh --ci` · `scripts/check-artefakt.sh` · `scripts/check-triada.sh` · `scripts/check-gestosc.sh` · `tests/unit/initiatives/initiativeCardContractCompleteness.test.ts` · `tests/unit/initiatives/initiativeRecordCanon.test.ts` · `tests/unit/initiatives/initiativeCardValidators.test.ts` · `src/components/standard/__tests__/**`. ★ WYJĄTEK IMIENNY: `scripts/dev/grafika-zrzuty.mjs` ma w tym dyżurze WĄSKĄ LICENCJĘ (wyłącznie zmiany addytywne i opt-in) — patrz tabela licencji `B.1`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY324_SZABLON_TNIE_KARTE_REPORT.md`. Dozwolone nowe/zmieniane pliki dokumentacyjne: raport pod `SCIEZKA_RAPORTU` oraz NOWY `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMPLETNOSCI_KART_20260904.md` (tabela: typ karty · pozycji w katalogu · pozycji renderowanych OFF · pozycji renderowanych ON · uchwyt DOM użyty do pomiaru · kadr · commit). Kadry PNG do `evidence/kompletnosc-kart-20260904/` (`git add -f`). **ZAKAZ edycji `MODULE_ACCEPTANCE.md`** — ten dyżur jest przekrojowy przez siedem typów kart i cztery moduły, więc żadnego pojedynczego `MODULE_ACCEPTANCE.md` nie podnosi. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day324-szablon-tnie-karte-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day324-szablon-tnie-karte-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ LICZENIA SEKCJI ZE ZRZUTU.** Każda liczba pozycji karty pochodzi z uchwytu DOM (`scripts/dev/grafika-zrzuty.mjs --zlicz=...`, selektory `[data-nmode-section-item]` / `[data-nmode-section-group]`), NIGDY z oglądania obrazka. Odbiorca dyżuru 305 policzył okiem „ON kasuje 11 z 15 sekcji” — to była POJEMNOŚĆ KADRU, nie liczba sekcji, i nikt nie mógł tej liczby powtórzyć. **ZAKAZ zmiany wartości domyślnej jakiejkolwiek flagi kontraktu kart** (`Z10`/`Z11`). **ZAKAZ samodzielnego rozstrzygania nazw Menu 3 dla Initiative** — `ARTIFACT_ANATOMY_STANDARD.md` §13.1 daje sześć nazw (Zadania · Definicja · Wdrożenie · Ekonomia · Governance · Zespół), a produkt ma pięć grup (Zakres i plan · Decyzje i ryzyko · Rezultaty · Ludzie · Zapisy); pytanie do właściciela stawiasz z OBIEMA listami obok siebie, jako wpis `DO DECYZJI WŁAŚCICIELA`, i nie zmieniasz żadnej z nich. **ZAKAZ „naprawiania” sufitu szablonowego przez wyłączenie filtru szablonów** — szablony są funkcją produktu, a nie defektem; ten dyżur ma zmierzyć i opisać, decyzja o kształcie należy do właściciela | Właściciel powiedział wprost: „Musimy mieć kompletne karty inicjatyw — to jest sens naszej aplikacji” (`DEC-387`), i zaakceptował parę zrzutów. Dyżury 305 i 314 doprowadziły kontrakt do stanu `ON = OFF` dla wszystkich siedmiu typów, więc raport „kontrakt niczego nie ucina” jest prawdziwy — a mimo to właściciel dalej może zobaczyć kartę z sześcioma sekcjami zamiast dwudziestu czterech, bo tnie ją NIE kontrakt, tylko szablon inicjatywy. Kolejny raport „naprawione” bez zmierzenia tego sufitu byłby trzecim z rzędu, po którym właściciel widzi to samo |

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
cd /private/tmp/cx-day324-szablon-tnie-karte

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day324-pg psql -U postgres -d cx324 \
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
cd /private/tmp/cx-day324-szablon-tnie-karte

docker run -d --name cx-day324-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx324 \
  -p 127.0.0.1:6350:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day324-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6350/cx324 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6350/cx324 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day324-szablon-tnie-karte && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6350/cx324 \
JWT_SECRET=cx324-test-secret-do-not-reuse \
npx vitest run `npx vitest run tests/unit/initiatives/initiativeCardContractCompleteness.test.ts tests/unit/initiatives/initiativeRecordCanon.test.ts tests/unit/initiatives/initiativeCardValidators.test.ts --retry=0` (pakiet jednostkowy — wariant `§0.2c` (C)) · `npx vitest run src/components/standard/__tests__ --retry=0`. Ten dyżur **nie dotyka bazy danych w pomiarach testowych**: bloki `§0.2c` (A) i (B) mają zastosowanie WYŁĄCZNIE wtedy, gdy uruchamiasz kanoniczny runtime zrzutowy na realnym rekordzie inicjatywy (`R3`) — wtedy migracje i kontener są obowiązkowe, wraz z całym protokołem `§0.2b` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day324-szablon-tnie-karte-artefakty/day324-szablon-tnie-karte.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day324-szablon-tnie-karte && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run `npx vitest run tests/unit/initiatives/initiativeCardContractCompleteness.test.ts tests/unit/initiatives/initiativeRecordCanon.test.ts tests/unit/initiatives/initiativeCardValidators.test.ts --retry=0` (pakiet jednostkowy — wariant `§0.2c` (C)) · `npx vitest run src/components/standard/__tests__ --retry=0`. Ten dyżur **nie dotyka bazy danych w pomiarach testowych**: bloki `§0.2c` (A) i (B) mają zastosowanie WYŁĄCZNIE wtedy, gdy uruchamiasz kanoniczny runtime zrzutowy na realnym rekordzie inicjatywy (`R3`) — wtedy migracje i kontener są obowiązkowe, wraz z całym protokołem `§0.2b` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day324-szablon-tnie-karte-artefakty/day324-szablon-tnie-karte.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day324-szablon-tnie-karte/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day324-pg psql -U postgres -d cx324 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day324-pg`.
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
> **(e) ★★★ **SZEŚĆ PUŁAPEK TEGO DYŻURU.** (1) **Filtr szablonu wyprzedza kontrakt.** `enabledNModeSectionIds` (`InitiativeDocumentView.tsx` ok. 5274) zawęża `allSections` ok. 5548, a `uporzadkujSekcjeBoarduInicjatywy` dostaje ok. 9028 już okrojoną listę i zwraca jej PERMUTACJĘ — kontrakt fizycznie nie może przywrócić tego, czego mu nie podano. Dlatego para OFF/ON jest identyczna (6/3 i 6/3) i dlatego pomiar „ON = OFF” jest prawdziwy, a karta i tak niekompletna. (2) **Zastany `localStorage` przeżyje naprawę.** Klucz układu ma osobną przestrzeń nazw dla kontraktu: `task:nmode:card-layout:v2-contract:<id>` / `decision:nmode:card-layout:v2-contract:<id>` / `notification:nmode:card-layout:v2-contract:<id>`. Kto ruszał menedżer kart przy fladze ON, ma zapisany WĘŻSZY układ i po naprawie zobaczy stary stan. Każdy pomiar robisz w ŚWIEŻYM profilu przeglądarki albo po jawnym wyczyszczeniu tych kluczy — i zapisujesz w raporcie, którą drogą. (3) **Decyzja zostanie na starym w dniu włączenia flagi.** `useDecisionCardContractEnabled` (`DecisionDetailView.tsx` ok. 502-511) czyta wyłącznie `import.meta.env.VITE_VF1_DECISION_CARD_CONTRACT` oraz query `?cardContract=1` **pod `import.meta.env.DEV`** — nie czyta `localStorage ff.cardContract`, którego używa pozostała szóstka. To jest rozjazd rodziny, nie defekt jednego pliku: wypisz KOMPLET siedmiu wołaczy zanim cokolwiek zaproponujesz. (4) **Przyrząd to nie produkt.** `dev-render/screens/karta-*.tsx` montuje realny komponent, ale łańcuch przodków (`display`/`overflow`/`height`) w harnessie jest inny niż na realnej trasie; 3 z 6 „defektów wysokości” z 02.09 okazały się przyrządem. Zanim zgłosisz cokolwiek o geometrii, porównaj oba łańcuchy. (5) **Para light/dark bitowo identyczna to ZERO dowodu** — narzędzie raportuje ją jako `IDENTYCZNE` z kodem wyjścia 1; taka para nie jest kadrem odbiorczym. (6) **`grep --include` w `zsh` zwraca `no matches found` zamiast wyników** — każdy pomiar grepem uruchamiasz w `bash`; pustka nie jest wynikiem, dopóki nie sprawdzisz, że polecenie w ogóle się wykonało**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day324-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day324-szablon-tnie-karte-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (pomiar sufitu szablonowego uchwytem DOM: para OFF/ON na REALNYM rekordzie z NIEPUSTYM szablonem, plus para na rekordzie z PUSTYM szablonem — cztery liczby, nie dwie) · R2 (rodzina flag: komplet siedmiu wołaczy w jednej tabeli, rozstrzygnięcie trzech pułapek wdrożeniowych, gotowe diffy NIENAŁOŻONE) · R3 (para zrzutów odbiorczych na realnym rekordzie z niepustym szablonem, light+dark, pl+en)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6350` albo `5490` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6350` albo `5490`** (`Z7`).

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

Właściciel powiedział wprost: **„Musimy mieć kompletne karty inicjatyw — to jest sens naszej
aplikacji"** (`DEC-387`) i zaakceptował parę zrzutów. Dyżury 305 i 314 są już na markerze tego
dyżuru i zrobiły rzecz prawdziwą: **kontrakt kart przestał kasować sekcje.** Zmierzono to uchwytem
DOM i potwierdzono mutacją, dla wszystkich siedmiu typów, `ON = OFF`:

| Typ | pozycji ON/OFF | grup ON/OFF |
| --- | --- | --- |
| Initiative | 24 / 24 | 5 / 5 |
| Insight | 22 / 22 | 5 / 5 |
| Task | 8 / 8 | — |
| Interview | 8 / 8 | 3 / 3 |
| Decision | 6 / 6 | — |
| Tool | 4 / 4 | 3 / 3 |
| Notification | 3 / 3 | — |

**I mimo to właściciel może dalej zobaczyć niekompletną kartę.** Odbiór adwersaryjny 04.09 zmierzył
sufit, którego żaden z tych dyżurów nie widział:

> **Przy NIEPUSTYM szablonie inicjatywy karta ma 6 sekcji z 24 — NIEZALEŻNIE od flagi.**
> Zmierzone: OFF 6 pozycji / 3 grupy, ON 6 pozycji / 3 grupy.

Przyczyna leży w kolejności dwóch filtrów w `src/components/Initiatives/InitiativeDocumentView.tsx`:

1. **NAJPIERW** `enabledNModeSectionIds` (ok. linii 5274) buduje zbiór dozwolonych id z
   `initiativeTemplate.visibleSections`, a ok. linii 5544-5548 zawęża nim `allSections`:
   `withGroup(allSections.filter((section) => enabledNModeSectionIds.has(section.id)))`.
2. **DOPIERO POTEM**, ok. linii 9028, kontrakt dostaje już okrojoną listę i wykonuje na niej
   `uporzadkujSekcjeBoarduInicjatywy(...)`, która — zgodnie z własnym komentarzem i asercją w
   teście kompletności — **zwraca PERMUTACJĘ wejścia**. Cały wkład kontraktu w wygląd to
   **PORZĄDEK, nie cięcie.**

Kontrakt fizycznie nie może przywrócić sekcji, której mu nie podano. Dlatego para OFF/ON jest
identyczna, dlatego raport „kontrakt niczego nie ucina" jest **prawdziwy**, i dlatego karta jest
**mimo to niekompletna**. To jest realny powód, dla którego właściciel może dalej widzieć sześć
sekcji zamiast dwudziestu czterech.

Szablon `quick_win` (`src/components/Initiatives/templates/initiativeLevelTemplates.ts`, ok. linii
36-48) deklaruje pięć sekcji: `overview`, `scope`, `tasks`, `kpis`, `attachments`. Sześć na karcie
= te pięć plus zawsze-obecna `initiative-definition`. **To nie jest przypadek — to jest arytmetyka
szablonu.**

**Ten dyżur nie „naprawia" tego przez wyłączenie szablonów.** Szablony są funkcją produktu, nie
defektem. Zadaniem dyżuru jest **zmierzyć sufit czterema liczbami zamiast dwoma** (pusty szablon
OFF/ON **i** niepusty szablon OFF/ON), rozstrzygnąć trzy pułapki, które czekają na dzień włączenia
flagi, i postawić właścicielowi jedno pytanie z obiema listami nazw obok siebie.

### Trzy pułapki, które czekają na dzień włączenia flagi

1. **Decyzja zostanie na starym.** `useDecisionCardContractEnabled`
   (`src/components/MyWork/DecisionDetailView.tsx`, ok. 502-511) czyta wyłącznie
   `import.meta.env.VITE_VF1_DECISION_CARD_CONTRACT` oraz query `?cardContract=1`, i to query
   **tylko pod `import.meta.env.DEV`**. Pozostała szóstka czyta dodatkowo
   `localStorage.getItem('ff.cardContract')`. W dniu, w którym ktoś włączy kontrakt jednym linkiem,
   sześć artefaktów przełączy się, a Decyzja nie.
2. **Zastany `localStorage` przeżyje naprawę.** Klucz układu ma osobną przestrzeń nazw dla
   kontraktu — `task:nmode:card-layout:v2-contract:<id>`,
   `decision:nmode:card-layout:v2-contract:<id>`, `notification:nmode:card-layout:v2-contract:<id>`.
   Kto ruszał menedżer kart przy fladze `ON`, ma zapisany węższy układ i **po naprawie zobaczy stary
   stan**. Każdy pomiar w tym dyżurze robisz w świeżym profilu albo po jawnym wyczyszczeniu tych
   kluczy — i **zapisujesz w raporcie, którą drogą**.
3. **Nazwy Menu 3 się rozjeżdżają.** `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` §13.1
   (nagłówek w linii 1037, wiersz `Initiative (L)` tuż pod nim) daje sześć nazw:
   *Zadania · Definicja · Wdrożenie · Ekonomia · Governance · Zespół*. Produkt ma pięć grup
   (`InitiativeDocumentView.tsx` ok. 5500): *Zakres i plan · Decyzje i ryzyko · Rezultaty · Ludzie
   · Zapisy*. **Nie rozstrzygasz tego sam** — stawiasz właścicielowi pytanie z OBIEMA listami.

### Pozostałe zmierzone braki kompletności

- **Zadanie:** `TASK_CARDS` ma **10** pozycji w katalogu (`taskCardContract.ts`, ok. 304-315),
  a karta renderuje **8**. Dwie pozycje katalogu nie mają renderu — ustal **które** i **dlaczego**.
- **Wniosek:** `INSIGHT_CARDS` ma **30** pozycji, a kontrakt celowo zachowuje **22**. Ustal, czy
  ta ósemka jest świadomym wyborem produktowym (wtedy: gdzie zapisanym), czy długiem.
- **Typy bez kontraktu:** §13.1 wymienia jedenaście artefaktów archetypu REKORD. Kontrakt mają
  cztery (Initiative, Task, Decision, Insight). **Moja liczba: siedem bez kontraktu** — KPI, Idea,
  RAID, Milestone, Change Request, Stage Gate, Action Proposal. Zlecenie mówiło „8 typów" i
  wymieniało siedem nazw; **policz sam i zapisz swoją liczbę**. Żaden z nich nie był mierzony.

## ★ Zmierz moje liczby sam

Twierdzę: kontraktów jest 7; kanoniczna kolejność boardu inicjatywy ma 24 pozycje; `TASK_CARDS`
ma 10, `INSIGHT_CARDS` ma 30; szablon `quick_win` deklaruje 5 sekcji; §13.1 ma 11 wierszy, z czego
4 mają kontrakt; `DecisionDetailView.tsx` nie czyta `ff.cardContract`; liście
`public/locales/pl/translation.json` = 35198, `en` = 33065 (liczone z rozwinięciem tablic —
komenda w `B.3` wiersz 8).

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH — CAŁA ŚCIEŻKA

> **★★ ZASTRZEŻENIE.** Poniższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
> opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
> NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Warstwa | Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- | --- |
| **walidator** | `src/components/Initiatives/__tests__/**`, `src/components/MyWork/__tests__/**` (NOWE pliki) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31` | — |
| **walidator** | `tests/unit/initiatives/initiativeCardContractCompleteness.test.ts`, `initiativeRecordCanon.test.ts`, `initiativeCardValidators.test.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie NOWYCH przypadków `it(...)`**. Zakaz zmiany i osłabiania istniejących asercji, zakaz zmiany progów | Nowy plik testowy obok, z nagłówkiem `// KONTRAKT DYŻURU 324` |
| **trasa (front)** | `src/components/Initiatives/InitiativeDocumentView.tsx` | **TYLKO ODCZYT w tym dyżurze.** To jest plik-rdzeń sufitu; zmiana kolejności filtrów jest **decyzją produktową właściciela**, nie naprawą wykonawcy | Produkt zastępczy: **gotowy diff w bloku kodu, NIENAŁOŻONY**, plus brief z promieniem rażenia (ile modułów, ile typów kart, co się dzieje z zastanym `localStorage`) |
| **trasa (front)** | `src/components/MyWork/DecisionDetailView.tsx` | **★ WĄSKA LICENCJA — WYŁĄCZNIE funkcja `useDecisionCardContractEnabled`** (ok. 502-511), i **wyłącznie** w celu zrównania jej z rodziną (odczyt `localStorage ff.cardContract`), **bez zmiany wartości domyślnej — flaga zostaje OFF** (`Z10`). Zakaz zmiany czegokolwiek innego w tym pliku | Gotowy diff + brief |
| **kontrakt** | `src/components/Initiatives/sections/initiativeCardContract.ts`, `src/components/MyWork/taskCardContract.ts`, `decisionCardContract.ts`, `notificationCardContract.ts`, `src/components/Interview/insightCardContract.ts`, `interviewCardContract.ts`, `src/components/DiscoveryTools/toolCards.contract.ts` | **TYLKO ODCZYT** — siedem deskryptorów kanonicznych; ich zmiana przesuwa kompozycję kart, którą właściciel zaakceptował na zrzutach | Pomiar + wpis w rejestrze + gotowy diff nienałożony |
| **typ wiążący** | `src/components/standard/cardContract.types.ts` | **TYLKO ODCZYT — PLIK PRZEKROJOWY.** Typ przepływa przez wszystkie siedem kontraktów; jego zmiana psuje kompilację każdego z nich | **CZERWONY KONTRAKT TESTOWY** (`it('KONTRAKT DLA DYŻURU 324 — …')`, nagłówek `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`) + brief: plik:linia · promień rażenia · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| **powłoka** | `src/components/shared/NModeLayout/NModeLeftNav.tsx` | **TYLKO ODCZYT** — nosi uchwyty pomiarowe `data-nmode-section-item` (linie 157, 294) i `data-nmode-section-group` (linia 423). Uchwyty są Twoim przyrządem; ich zmiana unieważnia pomiar | Opis w raporcie + gotowy diff nienałożony |
| **szablony (front)** | `src/components/Initiatives/templates/initiativeLevelTemplates.ts`, `types.ts`, `InitiativeLevelSelector.tsx`, `src/hooks/useInitiativeTemplate.ts` | **TYLKO ODCZYT** — kształt szablonów to decyzja produktowa | Pomiar + wpis `DO DECYZJI WŁAŚCICIELA` ze zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie" |
| **serwis (tył)** | `server/src/services/initiativeTemplateService.ts` | **TYLKO ODCZYT** | Opis w raporcie z dowodem plik:linia |
| **repozytorium (tył)** | `server/src/services/resultsVnext/**`, `server/src/repositories/**` | **TYLKO ODCZYT** — poza zakresem | Opis w raporcie |
| **migracje** | `server/migrations/**` | **BEZ LICENCJI — ten dyżur nie dodaje ani nie zmienia żadnej migracji.** Przedział migracji nie jest mu przydzielony | Jeśli uznasz, że migracja jest potrzebna — to jest STOP MERYTORYCZNY z briefem, idziesz do następnej pozycji |
| **narzędzie** | `scripts/dev/grafika-zrzuty.mjs` | **★ WĄSKA LICENCJA — WYŁĄCZNIE zmiany ADDYTYWNE i OPT-IN** (nowy parametr `--…`, domyślnie wyłączony), zgodnie z regułą „nie pisz własnego zrzutu obok kanonicznego". **ZAKAZ zmiany zachowania domyślnego** — dziesiątki istniejących wywołań w `scripts/dev/*.sh` i instrukcjach muszą działać bit w bit jak dziś | Opis brakującej zdolności w raporcie + gotowy diff |
| **przyrząd** | `dev-render/screens/karta-initiative.tsx`, `karta-task.tsx`, `karta-task-pelna.tsx`, `karta-decision.tsx`, `karta-insight.tsx`, `karta-interview.tsx`, `karta-notification.tsx`, `karta-tool.tsx` | **★ PEŁNA LICENCJA** — to jest harness, nie produkt. Pamiętaj: **host harnessu nie jest produktem** (pułapka 4) | — |
| **i18n** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. Zakaz zmiany istniejących wartości. **Liczba liści nie może zmaleć** (baza: pl 35198 / en 33065 — komenda w `B.3`) | — |
| **rejestr** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMPLETNOSCI_KART_20260904.md` (**NOWY**) | **★ PEŁNA LICENCJA** | — |
| **dowody** | `evidence/kompletnosc-kart-20260904/**` (**NOWY**) | **★ PEŁNA LICENCJA**, `git add -f` | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY324_SZABLON_TNIE_KARTE_REPORT.md` | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **kanon (dok.)** | `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`, `docs/ui-standards/TRIADA_KANON.md` | **TYLKO ODCZYT** (`Z14`-podobny) | Errata w raporcie |
| **decyzje** | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar, jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja jest zrobiona z takim opisem |
| **cudzy teren** | `server/src/middleware/appErrorMapper.ts`, `src/services/errors/appErrorCopy.ts`, `src/services/api.ts` — **teren dyżuru 325**; `server/src/routes/admin/service-accounts.routes.ts`, `server/src/services/tablePlatform/**` — **teren dyżuru 326** | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, treść problemu, gotowa rekomendacja jako diff w bloku kodu, **nienałożony**. Pozycja idzie dalej |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit robisz PO KAŻDEJ pozycji,
push na `github-backup` po pierwszym commicie i po każdej kolejnej pozycji (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Pomiar sufitu szablonowego — CZTERY liczby | TAK | NIE — dowód: `grep -n 'enabledNModeSectionIds' src/components/Initiatives/InitiativeDocumentView.tsx` pokazuje, że pomiar jest odczytem | bazowe | Para OFF/ON na rekordzie z **NIEPUSTYM** szablonem **i** para OFF/ON na rekordzie z **PUSTYM** szablonem, wszystkie cztery liczone uchwytem DOM, każda z zapisanym id rekordu i stanem `localStorage` | `node scripts/dev/grafika-zrzuty.mjs … --zlicz='pozycje:[data-nmode-section-item];grupy:[data-nmode-section-group]' --wynik-json=…` ×4 | `docs(day324): pomiar sufitu szablonowego — 4 liczby (324 R1)` |
| R2 | Rodzina flag kontraktu — komplet siedmiu wołaczy + trzy pułapki | TAK | NIE — dowód: `DecisionDetailView.tsx` ma jawną wąską licencję w `B.1` | bazowe + 1 nowy test rodziny | Tabela siedmiu wołaczy (plik:linia · czyta env? · czyta query? · czyta `localStorage`? · pod `DEV`?), rozstrzygnięcie trzech pułapek, gotowe diffy **nienałożone** dla `InitiativeDocumentView.tsx`, nałożony diff **wyłącznie** dla `useDecisionCardContractEnabled`, flaga nadal OFF | `npx vitest run src/components/MyWork/__tests__ --retry=0` + dowód mutacyjny (patrz `R2`) | `fix(mywork): Decyzja czyta ff.cardContract jak reszta rodziny — flaga nadal OFF (324 R2)` |
| R3 | Para zrzutów odbiorczych na REALNYM rekordzie z niepustym szablonem | TAK | NIE | n/d | 4 kadry (light+dark × pl+en) na realnym rekordzie z listy, nie na id pokazowym; każdy obejrzany przez `Read` i opisany; para light/dark **nie może być bitowo identyczna** | `node scripts/dev/grafika-zrzuty.mjs … --porownaj-z=…` | `docs(day324): kadry odbiorcze karty inicjatywy (324 R3)` |
| R4 | Kompletność Zadania (10 vs 8) i Wniosku (30 vs 22) | NIE | NIE | +2 testy | Wypisane **imiennie**, które pozycje katalogu nie mają renderu i dlaczego; werdykt: dług czy świadomy wybór (przy „świadomy" — gdzie zapisany) | `npx vitest run tests/unit/initiatives --retry=0` | `docs(day324): rozliczenie kompletnosci Task i Insight (324 R4)` |
| R5 | Inwentarz typów §13.1 bez kontraktu | NIE | NIE | n/d | Tabela: artefakt z §13.1 · ma kontrakt? · plik · jeśli nie — czy ekran w ogóle istnieje w `src/`. **Twoja liczba**, nie moja | `sed -n '1041,1052p' Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` + `find src -name '*ardContract*.ts'` | `docs(day324): inwentarz typow §13.1 bez kontraktu (324 R5)` |
| R6 | Pytanie do właściciela — nazwy Menu 3 | NIE | NIE | n/d | Wpis `DO DECYZJI WŁAŚCICIELA` z OBIEMA listami nazw obok siebie, kadrem, i zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie" | — | `docs(day324): pytanie o nazwy Menu 3 Initiative (324 R6)` |
| R7 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" **niepusta** | — | `docs(day324): raport` |

> **Kolumna „Wymaga plików przekrojowych?" jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Żadna pozycja nie wymaga zmiany pliku, którego nie masz prawa dotknąć:
> `cardContract.types.ts` jest przekrojowy i **żadna pozycja go nie zmienia** — jeśli uznasz, że
> musi, produktem jest czerwony kontrakt + brief, a pozycja jest **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą z tych liczb mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz w `bash`.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Kontrakty kart artefaktów | 7 (+1 plik typu) | `find src -name '*ardContract*.ts' -o -name '*ards.contract.ts' \| sort` | TAK — uruchomione na markerze |
| 2 | Pozycje kanonicznej kolejności boardu inicjatywy | 24 | `awk 'NR>795 && /^\];/{exit} NR>795' src/components/Initiatives/sections/initiativeCardContract.ts \| grep -c "'"` | TAK |
| 3 | Pozycje katalogu Zadania | 10 | `sed -n '304,315p' src/components/MyWork/taskCardContract.ts` (policz wpisy tablicy) | TAK |
| 4 | Pozycje katalogu Wniosku | 30 | `awk 'NR>709 && /^\];/{exit} NR>709' src/components/Interview/insightCardContract.ts \| grep -cE '^  [A-Z][A-Z_0-9]*,'` | TAK |
| 5 | Sekcje deklarowane przez szablon `quick_win` | 5 | `sed -n '41,47p' src/components/Initiatives/templates/initiativeLevelTemplates.ts` | TAK — to jest arytmetyka „6 z 24" |
| 6 | Wiersze §13.1 (archetyp REKORD) | 11 | `sed -n '1041,1052p' Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md \| grep -c '^| '` | TAK |
| 7 | Grupy Menu 3 w produkcie (Initiative) | 5 | `sed -n '5499,5503p' src/components/Initiatives/InitiativeDocumentView.tsx` | TAK |
| 8 | Liście `translation.json` | pl 35198 / en 33065 | `node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'` | TAK — **liczba nie może zmaleć**; tablice liczone element po elemencie |
| 9 | Wołacze `ff.cardContract` w `localStorage` | 6 z 7 (bez Decyzji) | `grep -rn "localStorage.getItem('ff.cardContract')" src` (w `bash`) | TAK — brak trafienia w `DecisionDetailView.tsx` JEST wynikiem |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KOMPLETNOSCI_KART_20260904.md` | NOWY | R1/R4/R5 | ZEROWE |
| 2 | `evidence/kompletnosc-kart-20260904/**` | NOWY | R1/R3 | ZEROWE |
| 3 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY324_SZABLON_TNIE_KARTE_REPORT.md` | NOWY | R7 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `src/components/MyWork/DecisionDetailView.tsx` | R2 | Tylko funkcja `useDecisionCardContractEnabled`, tylko zrównanie z rodziną, **flaga nadal domyślnie OFF**, z dowodem mutacyjnym w obie strony |
| `src/components/MyWork/__tests__/**` (NOWE) | R2 | Test rodziny wołaczy — musi CZERWIENIĆ po usunięciu odczytu `localStorage` z któregokolwiek z siedmiu |
| `dev-render/screens/karta-*.tsx` | R1/R3 | Tylko jeśli przyrząd nie pozwala zamontować realnego rekordu z niepustym szablonem |
| `scripts/dev/grafika-zrzuty.mjs` | R1 | Tylko addytywnie i opt-in, jeśli brakuje zdolności pomiarowej; zachowanie domyślne bit w bit jak dziś |
| `public/locales/{pl,en}/translation.json` | R2 | Tylko dopisanie kluczy, parytet w tym samym commicie, liczba liści nie maleje |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
src/components/Initiatives/InitiativeDocumentView.tsx  — rdzeń sufitu; produkt = diff NIENAŁOŻONY
src/components/standard/cardContract.types.ts          — przekrojowy przez 7 kontraktów
server/src/middleware/appErrorMapper.ts                — teren dyżuru 325
src/services/errors/appErrorCopy.ts, src/services/api.ts — teren dyżuru 325
server/src/routes/admin/service-accounts.routes.ts     — teren dyżuru 326
server/src/services/tablePlatform/**                   — teren dyżuru 326
tests/unit/backend/security/noRawErrorMessage.test.ts  — teren dyżuru 326
server/migrations/**                                   — przedział nieprzydzielony
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6350 | `lsof -nP -iTCP:6350 -sTCP:LISTEN` → puste (sprawdzone przy pisaniu instrukcji) |
| Port harnessu | 5490 | `lsof -nP -iTCP:5490 -sTCP:LISTEN` → puste |
| Kontener | `cx-day324-pg` | `docker ps --format '{{.Names}}' \| grep cx-day324` → brak |
| Baza | `cx324` | n/d |
| Gałąź | `codex/day324-szablon-tnie-karte-20260904` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day324-szablon-tnie-karte` | nie istnieje |
| Przedział migracji | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | n/d |
| Flagi | wszystkie `*_CARD_CONTRACT` — **NIEZMIENIANE, domyślnie OFF** | `grep -rn 'VITE_VF1_.*CARD_CONTRACT' src` |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day324-szablon-tnie-karte
git diff --name-only --cached | tee /private/tmp/cx-day324-szablon-tnie-karte-artefakty/staged.txt
grep -iE 'InitiativeDocumentView\.tsx|cardContract\.types\.ts|appErrorMapper|appErrorCopy|services/api\.ts|service-accounts\.routes|tablePlatform/|noRawErrorMessage|server/migrations/' \
  /private/tmp/cx-day324-szablon-tnie-karte-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"
```

---

## R1 — POMIAR SUFITU SZABLONOWEGO: CZTERY LICZBY, NIE DWIE

**To jest rdzeń dyżuru.** Dotychczasowe pomiary dawały parę OFF/ON i wyprowadzały z niej wniosek
„kontrakt niczego nie ucina" — prawdziwy, ale niewystarczający. Mierzysz **cztery** stany:

| # | Rekord | Flaga | Co zapisujesz |
| --- | --- | --- | --- |
| 1 | realny, z **NIEPUSTYM** `initiativeTemplate` | OFF | pozycji · grup · id rekordu · nazwa szablonu |
| 2 | ten sam | ON | jw. |
| 3 | realny, z **PUSTYM** `initiativeTemplate` (albo bez szablonu) | OFF | jw. |
| 4 | ten sam | ON | jw. |

**Liczbę bierzesz WYŁĄCZNIE z uchwytu DOM**, nigdy ze zrzutu:

```bash
cd /private/tmp/cx-day324-szablon-tnie-karte
node scripts/dev/grafika-zrzuty.mjs \
  --zlicz='pozycje:[data-nmode-section-item];grupy:[data-nmode-section-group]' \
  --wynik-json=/private/tmp/cx-day324-szablon-tnie-karte-artefakty/r1-off-niepusty.json \
  <pozostałe parametry przelotu wg pomocy narzędzia>
#   oczekiwane dla stanu (1) i (2): pozycje 6, grupy 3 — IDENTYCZNIE, bo tnie szablon, nie flaga
#   oczekiwane dla stanu (3) i (4): pozycje 24, grupy 5 — IDENTYCZNIE
```

**`0` trafień jest wynikiem `0`, nigdy „pomiar się nie udał"** — brak pomiaru nie jest wynikiem.
Jeżeli selektor daje `0` na obu stanach, to znaczy, że **mierzysz nie ten ekran**: sprawdź, czy
komponent w ogóle się zamontował, zanim ogłosisz cokolwiek.

**Stan `localStorage` przed każdym z czterech pomiarów zapisujesz do raportu.** Pomiar w profilu
z zastanym kluczem `…:v2-contract:<id>` mierzy cudzy układ, nie produkt (pułapka 2).

Prawo zatrzymania po tej pozycji.

## R2 — RODZINA FLAG: SIEDEM WOŁACZY W JEDNEJ TABELI

**KROK 0 — wypisz rodzeństwo, zanim ruszysz cokolwiek.** Praca per-zgłoszenie daje „poprawne w 2
z 3". Tabela ma mieć siedem wierszy:

| Artefakt | Plik:linia wołacza | env | query `?cardContract=1` | `localStorage ff.cardContract` | tylko pod `DEV`? |
| --- | --- | --- | --- | --- | --- |

Dopiero mając komplet, rozstrzygasz trzy pułapki:

1. **Decyzja.** Zrównaj `useDecisionCardContractEnabled` z rodziną (odczyt `ff.cardContract`).
   **Wartość domyślna zostaje OFF** (`Z10`). Dowód mutacyjny obowiązkowy **w obie strony i wycelowany
   w ZABEZPIECZENIE, nie w mechanizm**: usuń odczyt `localStorage` → nowy test **CZERWONY**;
   przywróć przez `cp` z kopii w `SCRATCH` (`Z27`, nigdy `git stash`) → **ZIELONY**; `git diff` po
   cofnięciu **pusty**. Obie komendy i oba wyniki dosłownie w raporcie.
2. **Zastany `localStorage`.** Zaproponuj mechanizm (migracja klucza? jednorazowe czyszczenie
   przy zmianie wersji kontraktu?) jako **gotowy diff NIENAŁOŻONY** plus brief z promieniem
   rażenia. Nie nakładasz — to dotyka danych w przeglądarkach ludzi.
3. **Kolejność filtrów w `InitiativeDocumentView.tsx`.** **NIE NAKŁADASZ.** Produktem jest diff
   w bloku kodu + brief: co dokładnie się zmienia, ile typów kart dotyka, co widzi właściciel przed
   i po, i jak wyglądałby dowód mutacyjny.

Prawo zatrzymania po tej pozycji.

## R3 — PARA ZRZUTÓW ODBIORCZYCH NA REALNYM REKORDZIE

Kanonicznym `scripts/dev/grafika-zrzuty.mjs`, na **REALNYM rekordzie inicjatywy z listy**, z
**niepustym szablonem** — nie na id pokazowym. (Znany kształt fałszywego gotowego: realne
inicjatywy otwierają inny widok niż id pokazowe; odbiór rekordu = otwórz realny rekord z listy.)

Cztery kadry: light+dark × pl+en. Każdy obejrzany przez `Read` i opisany z nazwy: co widać, ile
sekcji, czego brakuje. **Para light/dark bitowo identyczna to defekt kadru, nie dowód** — narzędzie
zgłasza ją jako `IDENTYCZNE` z kodem wyjścia 1.

Uruchomienie pełnego runtime'u do zrzutów jest dozwolone **wyłącznie** przez kanoniczny
`scripts/dev/start-wave3-owner-runtime.mjs`, po wykonaniu dowodów (a) i (b) z `§0.2b` i po
spełnieniu wszystkich warunków punktu (4).

Prawo zatrzymania po tej pozycji.

## R4 — KOMPLETNOŚĆ ZADANIA I WNIOSKU

Wypisz **imiennie**, które z 10 pozycji katalogu Zadania nie mają renderu i dlaczego (nie „dwie
brakują" — nazwy). To samo dla ośmiu pozycji Wniosku poza dwudziestoma dwiema. Werdykt per pozycja:
**dług** (wtedy: gotowy diff nienałożony) albo **świadomy wybór produktowy** (wtedy: gdzie
zapisany — `DEC-…` ze ścieżką pliku; jeśli nigdzie, to jest dług).

Prawo zatrzymania po tej pozycji.

## R5 — INWENTARZ TYPÓW §13.1 BEZ KONTRAKTU

Tabela: artefakt z §13.1 · ma kontrakt (plik) · jeśli nie — czy ekran w ogóle istnieje w `src/`
(`grep` w `bash`, bez `| head` — obcięcie produkuje fałszywe sieroty). **Twoja liczba.** Zlecenie
mówiło „8 typów", ja policzyłem 7; jeśli wyjdzie Ci co innego, wiążący jest Twój pomiar.

Prawo zatrzymania po tej pozycji.

## R6 — PYTANIE DO WŁAŚCICIELA: NAZWY MENU 3

Wpis `DO DECYZJI WŁAŚCICIELA` z **obiema listami obok siebie** — sześć nazw z §13.1 i pięć grup
z produktu — kadrem obecnego stanu i jednym zdaniem: **„czego konkretnie mi zabrakło, żeby
rozstrzygnąć samodzielnie"**. Wpis bez tego zdania liczy się jako nierozstrzygnięty.

## R7 — RAPORT

Struktura `§R.2`. Obowiązkowo: cztery liczby z `R1` z zapisanym stanem `localStorage` przy każdej,
tabela siedmiu wołaczy, dowód mutacyjny Decyzji w obie strony, ścieżki czterech kadrów z opisem,
rejestr kompletności, wpis `DO DECYZJI WŁAŚCICIELA`, sekcja **TWIERDZENIA NIEZWERYFIKOWANE**
niepusta.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobione (cztery liczby), R2 zrobione, R3 rozpoczęte,
R4-R6 nietknięte" jest pełnowartościowym wynikiem — o ile R1 stoi na uchwycie DOM, a nie na
oglądaniu obrazka, i o ile R2 stoi na dowodzie mutacyjnym wycelowanym w zabezpieczenie.

**Odwrotna kolejność — inwentarze (R4/R5) zrobione, rdzeń (R1/R2/R3) „częściowo" — jest podstawą
odrzucenia.**

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela niżej | TAK |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone pętlą `[ -e "$p" ]` na worktree z markera; zero `BRAK` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, dziewięć wierszy |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (diff · brief · kontrakt · pomiar · wpis) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4 |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (325, 326) | TAK — `B.4.4`; porty 5490/6350 zmierzone jako wolne |
| 7 | Komendy paste-ready, z `#   oczekiwane: …` | TAK |
| 8 | Pułapki środowiska w całości + sześć pułapek modułu | TAK |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru" bez ścieżki | TAK |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu w dokumencie: `0`; wierszy `Z`: `41` | TAK |

### AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| Zakaz `Z10` „zero zmian flag" **vs** `R2` zmienia sposób odczytu flagi Decyzji | `Z10` (pole wyjątku) i `B.1` — zmiana SPOSOBU ODCZYTU nie jest zmianą wartości domyślnej; domyślna zostaje `OFF` |
| Zakaz `Z12` wymienia `scripts/dev/grafika-zrzuty.mjs` jako nietykalny **vs** `R1` może potrzebować nowej zdolności pomiarowej | `Z12` (wyjątek imienny) + `B.1` — wąska licencja, wyłącznie addytywna i opt-in |
| „Zmierz kompletność karty" **vs** `InitiativeDocumentView.tsx` tylko do odczytu | `B.1` i `B.2` — produktem `R2` jest **diff nienałożony** + brief; pozycja jest ZROBIONA |
| Zakaz `Z11` „nie odsłaniasz nowego ekranu bez akceptu" **vs** `R3` wymaga zrzutów przy fladze `ON` | `R3` + pole flag — flaga włączana **wyłącznie w Twoim harnessie**, do zrzutu; do repo nie wchodzi żadna zmiana domyślnej |
| Zakaz `Z13` „dokładnie JEDEN nowy dokument" **vs** `R1`/`R4`/`R5` piszą do rejestru | `Z13` (pole „jedyny inny dokument") — raport + jeden imiennie wskazany rejestr, nic więcej |
| Zakaz `Z30` „zero wysyłki" **vs** `R3` uruchamia pełny runtime do zrzutów | `§0.2b` punkt (4) — wyjątek wyłącznie dla zrzutów, po dowodach (a) i (b), z deklaracją dosłowną |
