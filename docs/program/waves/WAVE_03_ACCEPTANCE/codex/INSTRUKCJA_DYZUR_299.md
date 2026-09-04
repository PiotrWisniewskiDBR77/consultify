# INSTRUKCJA DYŻURU nr 299 — Codex — „★★★ Właściciel zobaczy oba kreatory na stagingu 04.09 po południu — a dziś nikt nie przeszedł po nich listą czekowania ani razu, i cztery testy dostępności są czerwone: ten dyżur (1) MIERZY rodzinę przełącznika (moja teza: 6 plików, DWIE powierzchnie produktowe, nie jedna — sprawdź sam), (2) rozstrzyga dowodem, po której stronie leży wina za 4 czerwone asercje `getByLabelText` w `src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx` (linie 140, 152, 178, 231 — mój przebieg 03.09 na markerze: **4 czerwone / 8 zielonych z 12**) i naprawia TĘ stronę, która jest zła, z dowodem mutacyjnym, (3) przechodzi listę czekowania część B z `docs/ui-standards/TRIADA_KANON.md` **literalnie, punkt po punkcie, dla OBU kreatorów osobno** (punkty tabelowe dostają jawne „n/d — kreator nie jest ekranem listowym”, z powodem wypisanym z nazwy, nigdy milczące pominięcie), (4) robi 8 kadrów kanonicznym `scripts/dev/grafika-zrzuty.mjs` (krok 1 i krok 2 kreatora × light/dark × pl/en) i OGLĄDA każdy (`Read`), (5) domyka blok dostępności (punkty 41-43: pełny cykl `Tab`/`Shift+Tab`, `Esc` zamyka jeden poziom naraz, `focus-visible` widoczny na KAŻDYM elemencie, zero `primary-*`). ★ Kształt kreatora jest ZATWIERDZONY — nie przeprojektowujesz go; zmieniasz wyłącznie to, co łamie kanon, dostępność albo kolor."

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
> **wyłącznie** `/private/tmp/cx-day299-kreator-wywiadu`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `416432abaf`**
> **Gałąź bazowa: `github-backup/grafika/m03-20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-03.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****02_WYWIAD — kreator wniosków (`InsightCreatorModal`) po włączeniu flagi na sztywno ON, PLUS druga powierzchnia, która pojechała tym samym przełącznikiem: kreator inicjatyw (`InitiativeWizardModal`).** Właściciel 03.09 wieczorem rozstrzygnął pozycję A4 (`DEC-2026-09-03-350`): kreator wywiadu ON OD RAZU, wbrew rekomendacji CTO („ON po odbiorze na stagingu”); odbiór listą czekowania przeniesiony do przelotu właściciela (bramka `G16`), nie jest warunkiem wstępnym włączenia. Commit `ba0da208a3` zmienił `readEnvFlag()` w `src/utils/interviewCreatorShellFlag.ts` tak, że przy braku zmiennej środowiskowej zwraca `true`. ★ Ta sama funkcja `isInterviewCreatorShellEnabled()` jest importowana przez `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx` (linia 44, użycie w linii 686) — czyli jednym commitem weszły na żywo DWA kreatory, nie jeden. Rodzina to 6 plików (`git grep -ln "creator-shell|creatorShell" -- src`): oba modale, wspólna powłoka `src/components/shared/WizardModal/` (`WizardModal.tsx`, `WizardStepper.tsx`, `creatorShell.css`) i test a11y. Ten dyżur robi to, czego właściciel NIE ma robić własnymi oczami jako pierwszy (reguła 7 kodeksu): pełny odbiór listą czekowania część B, PRZED `G16`.**.
Trasy front: ``src/components/Interview/InsightCreatorModal.tsx` (2892 linie; pole tytułu i jego etykieta w okolicach linii 1779-1802), `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx` (import flagi linia 44, użycie linia 686), `src/components/shared/WizardModal/WizardModal.tsx`, `WizardStepper.tsx`, `creatorShell.css`, `src/utils/interviewCreatorShellFlag.ts`. Ekran harnessu: `dev-render/screens/interview-creator-shell.tsx` (82 linie — importuje REALNY `InsightCreatorModal`, więc przyrząd pokazuje produkt; MIMO TO porównaj łańcuch przodków w harnessie i w realnej trasie, zanim zgłosisz cokolwiek jako defekt wysokości/szerokości). Wejście produkcyjne kreatora inicjatyw: `src/components/Initiatives/InitiativesHub.tsx`, `src/components/shared/UnifiedCreateLauncher.tsx`.`. Trasy tył: `Brak zmian po stronie serwera. Wołania kreatora idą przez `src/services/api` i `src/services/api/v8/interview` (`V8InterviewApi.createInsight`) — w tym dyżurze wyłącznie do odczytu, żeby ustalić, czy stan błędu kreatora ma własny widok. Jeśli znajdziesz defekt serwerowy, wpisujesz go do raportu jako znalezisko, NIE naprawiasz tutaj.`.

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
WT=/private/tmp/cx-day299-kreator-wywiadu
MARKER=416432abaf

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day299-kreator-wywiadu-odbior-20260903 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day299-kreator-wywiadu/config.worktree"
cat "$VAULT/worktrees/cx-day299-kreator-wywiadu/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day299-kreator-wywiadu-scratch
mkdir -p /private/tmp/cx-day299-kreator-wywiadu-artefakty

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
git -C "$VAULT" log --oneline 416432abaf..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 416432abaf..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day299-kreator-wywiadu-odbior-20260903
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 416432abaf..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `6` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: flaga jest domyslnie ON od commita ba0da208a3
grep -n 'parseFlag(meta.env' src/utils/interviewCreatorShellFlag.ts
git log --oneline -3 -- src/utils/interviewCreatorShellFlag.ts
#   oczekiwane: linia konczaca sie `?? true` oraz commit ba0da208a3 na szczycie

# (2) TEZA: ten sam przelacznik steruje DWIEMA powierzchniami, rodzina = 6 plikow
git grep -ln 'creator-shell\|creatorShell' -- src
git grep -n 'isInterviewCreatorShellEnabled' -- src/components/Initiatives
#   oczekiwane: 6 plikow; trafienie w InitiativeWizardModal.tsx (import ~44, uzycie ~686)

# (3) TEZA: test a11y kreatora ma 4 czerwone z 12, wszystkie na getByLabelText
npx vitest run src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx 2>&1 | tail -20
grep -n 'getByLabelText' src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx
#   oczekiwane: 4 failed / 8 passed (12); trafienia w liniach 140, 152, 178, 231 — zapisz SWOJE liczby

# (4) TEZA (moja, prawdopodobnie FALSZYWA): etykieta pola Tytul istnieje i jest zwiazana
sed -n '1776,1806p' src/components/Interview/InsightCreatorModal.tsx
grep -n 'requiredMarker' public/locales/pl/translation.json public/locales/en/translation.json
#   oczekiwane: label htmlFor=insight-creator-title + input id=insight-creator-title;
#   klucz requiredMarker w OBU plikach => 4 czerwone to zestarzale asercje, nie defekt produktu.
#   OBAL TO ALBO POTWIERDZ — wypisz dostepna nazwe pola z realnego DOM-u, nie z kodu.

# (5) TEZA: lista czekowania czesc B ma 43 punkty, nie 40
sed -n '90,275p' docs/ui-standards/TRIADA_KANON.md | grep -c '^- \[ \] '
#   oczekiwane: 43

# (6) TEZA: porty i dysk wolne
lsof -nP -iTCP:5276 -sTCP:LISTEN; lsof -nP -iTCP:5277 -sTCP:LISTEN; lsof -nP -iTCP:6303 -sTCP:LISTEN; docker ps --format '{{.Names}}' | grep -c cx-day299 || true
df -h /
#   oczekiwane: puste lsof, 0 kontenerow, powyzej 3 GB wolnego
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day299-kreator-wywiadu-odbior-20260903` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6303`. Twój JEDYNY port harnessu to `5276 i 5277`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day299-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286-298 (bazy 6290-6302, harness 5250-5275) oraz rodzeństwo z tej paczki: 300 (6304, 5278-5279), 301 (6305, 5280-5281), 302 (6306, 5282-5283), 303 (6307, 5284-5285), 304 (6308, 5286-5287), 305 (6309, 5288-5289), 306 (6310, 5290-5291). Twoje własne: baza 6303, harness 5276 i 5277. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright`, `grafika-zrzuty` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `Flaga `src/utils/interviewCreatorShellFlag.ts` jest już domyślnie ON (`readEnvFlag()` zwraca `parseFlag(...) ?? true`) i tego NIE zmieniasz — to decyzja właściciela `DEC-2026-09-03-350`. Zostawiasz w mocy awaryjny wyłącznik (`?ff_interviewCreatorShell=0` i `localStorage` `ff.interview_creator_shell`) i pokrywasz go testem, że OFF nadal daje starą powłokę (dziś ten test jest zielony — nie zepsuj go). Jeżeli w trakcie odbioru znajdziesz defekt tak duży, że kreator nie powinien iść na przelot właściciela, NIE przełączasz flagi sam: piszesz STOP w raporcie z nazwą defektu i kadrem, decyzję podejmuje nadzorca.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx` (dziś 8/12 zielonych — po dyżurze 12/12) · `src/components/Initiatives/Wizard/__tests__/InitiativeWizardModal.a11y.test.tsx` · `src/components/Initiatives/Wizard/__tests__/InitiativeWizardModal.projectSelection.test.tsx` · `src/components/Initiatives/__tests__/InitiativesHub.newModalA11y.test.tsx` · `src/utils/__tests__/interviewCreatorShellFlag.test.ts` · `tests/components/Interview/InsightCreatorModal.context-documents.test.tsx` · `tests/components/Interview/InsightCreatorModal.error-state.test.tsx` · `scripts/check-list-canon.sh` · `scripts/check-focus-canon.sh --ci` · `scripts/check-artefakt.sh``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY299_KREATOR_WYWIADU_ODBIOR_REPORT.md`. Dozwolone nowe pliki dokumentacyjne: raport pod `SCIEZKA_RAPORTU` oraz `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KREATORY_LISTA_CZEKOWANIA_20260903.md` (tabela: punkt listy czekowania · kreator wywiadu ✓/✗/n-d+powód · kreator inicjatyw ✓/✗/n-d+powód · kadr · commit naprawy). Kadry PNG do `evidence/kreatory-odbior-20260903/` (`git add -f` — nowe pliki poza `src/` bywają ignorowane). Kod: wyłącznie naprawy w wymienionej rodzinie 6 plików plus testy. **ZAKAZ edycji `MODULE_ACCEPTANCE.md`.**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day299-kreator-wywiadu-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day299-kreator-wywiadu-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ przeprojektowywania kreatora** — kształt (kroki, kolejność, geometria 1040×840) jest zatwierdzony; zmieniasz wyłącznie to, co łamie kanon, dostępność albo regułę koloru. **ZAKAZ zmiany domyślnej wartości flagi** (decyzja właściciela). **ZAKAZ `primary-*` w powłoce kreatora** (każdy numer = crimson; hook `check-artefakt.sh` blokuje). **ZAKAZ osłabiania testów** — jeżeli naprawiasz asercję, musisz dołożyć dowód mutacyjny, że nowa asercja nadal broni tego samego twierdzenia. **ZAKAZ własnych tabel/menu w kreatorze** (`scripts/check-list-canon.sh`). **ZAKAZ `git stash`** (stos jest współdzielony z innymi dyżurami). **ZAKAZ `pkill`/`killall`.** **ZAKAZ dotykania demo/staging/produkcji.** **ZAKAZ `--no-verify`.** **ZAKAZ edycji `MODULE_ACCEPTANCE.md`.** | Reguła 7 kodeksu (`CLAUDE.md`, powód: załamanie 07-11) mówi, że właściciel nigdy nie jest pierwszym testerem wizualnym. `DEC-2026-09-03-350` włączył kreator bez poprzedzającego odbioru i przeniósł weryfikację listą czekowania do przelotu właściciela 04.09 po południu. Jeśli lista czekowania zostanie przejechana dopiero PRZEZ właściciela, złamiemy regułę 7 przy pełnej świadomości. Ten dyżur wyprzedza przelot o kilkanaście godzin. Drugi powód: te same 4 czerwone testy dostępności stoją w drzewie od włączenia flagi i nikt nie rozstrzygnął, czy to defekt produktu, czy zestarzała asercja. |

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
cd /private/tmp/cx-day299-kreator-wywiadu

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day299-pg psql -U postgres -d cx299 \
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
cd /private/tmp/cx-day299-kreator-wywiadu

docker run -d --name cx-day299-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx299 \
  -p 127.0.0.1:6303:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day299-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6303/cx299 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6303/cx299 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day299-kreator-wywiadu && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6303/cx299 \
JWT_SECRET=cx299-test-secret-do-not-reuse \
npx vitest run testy: `npx vitest run src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx` (linia bazowa 4 czerwone / 8 zielonych z 12 — zapisz SWÓJ wynik), `npx vitest run src/components/Initiatives/Wizard/__tests__`, `npx vitest run src/utils/__tests__/interviewCreatorShellFlag.test.ts`; dowód mutacyjny dla każdej zmienionej asercji; dowód główny = tabela 43 punktów × 2 powierzchnie + 8 kadrów obejrzanych oczami --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day299-kreator-wywiadu-artefakty/day299-kreator-wywiadu.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day299-kreator-wywiadu && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run testy: `npx vitest run src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx` (linia bazowa 4 czerwone / 8 zielonych z 12 — zapisz SWÓJ wynik), `npx vitest run src/components/Initiatives/Wizard/__tests__`, `npx vitest run src/utils/__tests__/interviewCreatorShellFlag.test.ts`; dowód mutacyjny dla każdej zmienionej asercji; dowód główny = tabela 43 punktów × 2 powierzchnie + 8 kadrów obejrzanych oczami --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day299-kreator-wywiadu-artefakty/day299-kreator-wywiadu.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day299-kreator-wywiadu/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day299-pg psql -U postgres -d cx299 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day299-pg`.
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
> **(e) ★★★ SZEŚĆ PUŁAPEK. (1) ★ **MOJA TEZA O PRZYCZYNIE 4 CZERWONYCH JEST PRAWDOPODOBNIE FAŁSZYWA I MASZ JĄ OBALIĆ ALBO POTWIERDZIĆ POMIAREM.** W kolejce zapisano „brak etykiety pola Tytuł w trybie creator-shell”. Mój własny pomiar mówi co innego: etykieta ISTNIEJE i jest poprawnie związana (`<label htmlFor="insight-creator-title">` w okolicy linii 1779, `<input id="insight-creator-title">` w okolicy 1794), a zmieniła się KONWENCJA znacznika pola wymaganego — z literalnej gwiazdki ` *` na `({t('interview.insightCreatorModal.requiredMarker')})`, czyli „(wymagane)” / „(required)”; komentarz w kodzie cytuje `CLAUDE.md` §3 i odbiór 2026-08-30, a klucz `requiredMarker` jest w OBU `public/locales/*/translation.json`. Jeśli tak jest, to 4 czerwone to ZESTARZAŁE ASERCJE, a naprawa produktu byłaby cofnięciem zatwierdzonego kanonu. Rozstrzygasz to sam, dowodem, i naprawiasz właściwą stronę. Zakaz naprawiania produktu „bo tak mówi zlecenie”. (2) Naprawa testu nie może osłabiać twierdzenia: po zmianie asercji uruchom dowód mutacyjny — usuń `htmlFor` z etykiety i pokaż, że test robi się czerwony; przywróć i pokaż zielony. Test, który przechodzi po skasowaniu wiązania etykiety, jest bezwartościowy. (3) `tests/setup.ts` podmienia CAŁY `react-i18next` atrapą, w której `t(klucz, 'domyślne')` zwraca wartość domyślną — test „polskich napisów” bez `vi.mock('react-i18next', importActual)` patrzy na angielszczyznę wpisaną w kodzie i przechodzi przy PUSTYM `pl/translation.json`. Dotyczy to wprost testu z linii 226-233. (4) Lista czekowania część B ma **43 punkty, nie 40** (mój pomiar: `sed -n '90,275p' docs/ui-standards/TRIADA_KANON.md | grep -c '^- \[ \] '` = 43; nazwa „40-punktowa” jest historyczna, punkty 41-43 to blok A11Y dopisany później). Kreator to modal, nie ekran listowy — punkty o tabeli, pstryczku, kebabie i kanbanie dostają „n/d” Z POWODEM wypisanym z nazwy; punkty o kolorze, fokusie, przyciskach, dostępności i motywach obowiązują w całości. (5) Przyrząd: `dev-render/screens/interview-creator-shell.tsx` montuje realny komponent, ale HOST harnessu to nie produkt — 3 z 6 „defektów wysokości” z 02.09 okazały się przyrządem. Zanim zgłosisz cokolwiek o geometrii, porównaj łańcuch przodków (`display`, `overflow`, `height`) w harnessie i na realnej trasie. (6) Kreator ma KROKI — kadr pierwszego kroku nie dowodzi niczego o drugim. Fotografuj każdy krok osobno; użycie `--rozwin-sekcje=1 --klik-po-rozwinieciu=1 --osiad-po-rozwinieciu=1500 --cofnij-jesli-skraca=1 --a11y=1` obowiązuje tam, gdzie kreator ma sekcje zwijane; na kanwach bez sekcji nie rozwijasz.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day299-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day299-kreator-wywiadu-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (pomiar: rodzina przełącznika — ile plików i ILE POWIERZCHNI produktowych; liczba punktów listy czekowania część B; przebieg testu a11y z liczbami; łańcuch przodków harness vs realna trasa) · R2 (rozstrzygnięcie 4 czerwonych: produkt czy asercja — dowód w postaci wypisanej dostępnej nazwy pola z realnego DOM-u; naprawa właściwej strony; dowód mutacyjny w obie strony) · R3 (odbiór listą czekowania część B, 43 punkty, LITERALNIE, osobno dla kreatora wywiadu i kreatora inicjatyw; każdy „n/d” z powodem; wynik jako tabela w rejestrze) · R4 (8 kadrów kanonicznym narzędziem: krok 1 i krok 2 × light/dark × pl/en dla kreatora wywiadu, plus komplet dla kreatora inicjatyw; KAŻDY kadr obejrzany przez `Read`, opis z nazwy tego, co widać) · R5 (blok dostępności 41-43: pełny cykl `Tab`/`Shift+Tab` bez pułapki fokusa, `Esc` zamyka jeden poziom naraz, `focus-visible` na każdym elemencie interaktywnym, skan `--a11y=1`; naprawy) · R6 (raport: tabela 43 punktów × 2 powierzchnie, rozstrzygnięcie 4 czerwonych z dowodem, znaleziska do osobnych dyżurów, TWIERDZENIA NIEZWERYFIKOWANE)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6303` albo `5276 i 5277` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6303` albo `5276 i 5277`** (`Z7`).

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

Właściciel wejdzie na staging 04.09 po południu i zobaczy kreator wniosków oraz kreator inicjatyw
w nowej powłoce. Po żadnym z nich nikt jeszcze nie przeszedł listą czekowania. Reguła 7 kodeksu
mówi, że właściciel nigdy nie jest pierwszym testerem wizualnym — a `DEC-2026-09-03-350` włączył
kreator bez poprzedzającego odbioru i przeniósł weryfikację do przelotu właściciela. Ten dyżur
wyprzedza przelot o kilkanaście godzin i domyka cztery czerwone testy dostępności, które stoją
w drzewie od włączenia flagi.

## ★ Zmierz moje liczby sam

Twierdzę: flaga jest domyślnie ON od `ba0da208a3`; rodzina przełącznika to 6 plików i DWIE
powierzchnie produktowe (kreator wywiadu i kreator inicjatyw); test a11y daje 4 czerwone
z 12, wszystkie na `getByLabelText`; lista czekowania część B ma 43 punkty, nie 40.
Komendy z §0.3 to sprawdzają. **Jeśli Twój pomiar przeczy mojej liczbie, obowiązuje Twój.**

★★ Osobno: w kolejce zapisano, że przyczyną czerwieni jest „brak etykiety pola Tytuł”.
**Mój własny pomiar temu przeczy** — etykieta istnieje i jest związana, a zmieniła się konwencja
znacznika pola wymaganego (z ` *` na „(wymagane)” / „(required)”, kanon z 30.08). Nie przyjmuj
ani mojej pierwszej wersji, ani drugiej: wypisz dostępną nazwę pola z realnego DOM-u i napraw tę
stronę, która jest zła. Naprawa produktu, gdy zły jest test, cofnęłaby zatwierdzony kanon.

## R1 — POMIAR (rdzeń)

Rodzina przełącznika: ile plików, ile powierzchni produktowych, gdzie są ich wejścia w aplikacji.
Liczba punktów listy czekowania część B. Przebieg testu a11y z liczbami. Łańcuch przodków ekranu
harnessu obok łańcucha z realnej trasy — zanim cokolwiek zgłosisz o geometrii.

Commit po `R1`.

## R2 — CZTERY CZERWONE (rdzeń)

Rozstrzygnięcie dowodem: produkt czy asercja. Dowodem jest dostępna nazwa pola odczytana
z realnego DOM-u, nie cytat z kodu. Naprawa właściwej strony. Dowód mutacyjny w obie strony:
po naprawie usuń wiązanie etykiety i pokaż czerwień, przywróć i pokaż zieleń.

Commit po `R2`.

## R3 — LISTA CZEKOWANIA (rdzeń)

Część B, 43 punkty, literalnie, osobno dla kreatora wywiadu i osobno dla kreatora inicjatyw.
Każde „n/d” z powodem wypisanym z nazwy — milczące pominięcie punktu jest defektem odbioru.
Wynik jako tabela w rejestrze.

Commit po `R3`.

## R4 — KADRY (rdzeń)

Osiem kadrów kanonicznym `scripts/dev/grafika-zrzuty.mjs`: krok 1 i krok 2 kreatora, light i dark,
polski i angielski. Komplet dla drugiej powierzchni. Każdy kadr obejrzany przez `Read` i opisany
z nazwy: co widać, czego brakuje. Para light/dark, która jest tym samym obrazem, to defekt kadru,
nie dowód.

Commit po `R4`.

## R5 — DOSTĘPNOŚĆ (rdzeń)

Punkty 41-43: pełny cykl `Tab` i `Shift+Tab` przez wszystkie elementy interaktywne bez pułapki
fokusa; `Esc` zamyka jeden poziom naraz; `focus-visible` widoczny na każdym elemencie, nigdy
`primary-*`. Skan `--a11y=1` na rozwiniętym DOM-ie. Naprawy z testem.

Commit po `R5`.

## R6 — RAPORT

Tabela 43 punktów × 2 powierzchnie. Rozstrzygnięcie czterech czerwonych z dowodem mutacyjnym.
Znaleziska do osobnych dyżurów. TWIERDZENIA NIEZWERYFIKOWANE.

## Prawo zatrzymania

„R1-R3 wykonane, kreator wywiadu przeszedł 41 z 43 punktów, dwa defekty opisane, kreator
inicjatyw nieodebrany z powodu X” jest wynikiem. „Kreator wygląda dobrze”, bez tabeli punktów
i bez obejrzanych kadrów, nie jest wart nic. Jeśli znajdziesz defekt, który nie powinien pojechać
na przelot właściciela — piszesz STOP z nazwą i kadrem, nie przełączasz flagi sam.
