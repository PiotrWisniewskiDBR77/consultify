# INSTRUKCJA DYŻURU nr 330 — Codex — „Dyżur 292 zrobił tylko R1-R2 macierzy akcji Wywiadu (03.09) — R3-R6 (Sesje, Szablony, Skrzynka, Wnioski, Inicjatywy Wywiadu, dowód, raport) NIE ZOSTAŁY ROZPOCZĘTE (potwierdzone: zero commitów 04.09 na worktree, dwa commity 03.09 nad wspólnym przodkiem) — do tego dyżur 322 postawił fałszywą tezę o teście ("InsightViewer.tsx" nie istnieje w pliku testu), realny defekt jest inny: macierz ma 6 konsumentów, test kontraktowy "is consumed by" wymienia tylko 5 i pomija InterviewInsightPreview.tsx, który macierz faktycznie importuje — a osobno dyżur 323 zostawił literał gwiazdki w kroku 2 InsightCreatorModal.tsx:2177 mimo że cały jego zakres dotyczył tej właśnie konwencji"

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
> **wyłącznie** `/private/tmp/cx-day330-wywiad-menu-akcji`.

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
Zakres: **Wywiad (Interview) — domknięcie R3-R6 macierzy akcji (dyżur 292), naprawa szóstego brakującego konsumenta w teście kontraktowym, naprawa literału gwiazdki pozostawionego przez dyżur 323, niezależna weryfikacja rejestru 43×2 obu kreatorów**.
Trasy front: ``src/components/Interview/interviewActionMatrix.ts` (SSOT macierzy, ZERO callbacków — woła istniejące handlery), `src/components/Interview/InterviewHub.tsx` (host kebaba wiersza), `src/components/Interview/InterviewAssignmentPreview.tsx`, `InterviewSessionPreview.tsx`, `InterviewTemplatePreview.tsx`, `InterviewInitiativePreview.tsx`, `InterviewInsightPreview.tsx` (★ TEN PLIK importuje `interviewActionMeta` — linia 32 — ale test kontraktowy go nie wymienia jako konsumenta, patrz R2), `src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx`, `src/components/Interview/InsightCreatorModal.tsx` (★ linia 2177 — literał ` *` w `renderSessionsBlock()`, kontra poprawna konwencja `requiredMarker` w liniach 1791/1822), `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx` (wyłącznie do odczytu — kreator równoległy z rejestru 43×2)`. Trasy tył: `Trasy Wywiadu wołane przez istniejące handlery z macierzy (bez zmian w tym dyżurze — macierz woła je, nie definiuje na nowo): `server/src/routes/interview.routes.ts`, `server/src/routes/v8/interview.routes.ts`, `server/src/routes/v8/interview-insights.routes.ts`. Ten dyżur NIE zmienia żadnej trasy serwera — cały zakres jest frontowy (macierz + kebab + podglądy + test kontraktowy + jeden literał w modalu)`.

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
WT=/private/tmp/cx-day330-wywiad-menu-akcji
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
git -C "$VAULT" worktree add "$WT" -b codex/day330-wywiad-menu-akcji-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day330-wywiad-menu-akcji/config.worktree"
cat "$VAULT/worktrees/cx-day330-wywiad-menu-akcji/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day330-wywiad-menu-akcji-scratch
mkdir -p /private/tmp/cx-day330-wywiad-menu-akcji-artefakty

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
git -C "$WT" push github-backup codex/day330-wywiad-menu-akcji-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 1c3d3da844ae03c87985a8f5dc74846a073c0220..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
# (1) TEZA: 292 ma dokladnie DWA commity nad wspolnym przodkiem (R1+R2 zrobione, R3-R6 nie)
git -C /private/tmp/cx-day292-wywiad-menu log --oneline 58ef0771d7..HEAD
#   oczekiwane: dokladnie 2 wiersze ("docs(interview): zmierz macierz..." + "feat(interview): unify action matrix...")

# (2) TEZA: worktree 292 jest czysty (brak niecommitowanego WIP)
git -C /private/tmp/cx-day292-wywiad-menu status --short
#   oczekiwane: pusto

# (3) TEZA: "InsightViewer.tsx" NIE wystepuje w tescie kontraktowym (teza dyzuru 322 byla falszywa)
grep -n "InsightViewer" src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx
#   oczekiwane: pustka (0 trafien)

# (4) TEZA: test kontraktowy "is consumed by" wymienia PIEC plikow, pomija InterviewInsightPreview.tsx
sed -n '63,75p' src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx
#   oczekiwane: lista `files` ma dokladnie 5 wpisow (InterviewHub + 4 Preview), bez InterviewInsightPreview.tsx

# (5) TEZA: InterviewInsightPreview.tsx FAKTYCZNIE importuje interviewActionMeta (jest realnym, pomijanym konsumentem)
grep -n "interviewActionMeta" src/components/Interview/InterviewInsightPreview.tsx
#   oczekiwane: co najmniej 1 trafienie (import z './interviewActionMatrix')

# (6) TEZA: InsightCreatorModal.tsx:2177 ma nadal literal gwiazdki w kroku 2, kontra poprawna konwencja kroku 1
sed -n '2175,2179p' src/components/Interview/InsightCreatorModal.tsx
sed -n '1788,1792p' src/components/Interview/InsightCreatorModal.tsx
#   oczekiwane: linia ok. 2177 konczy sie surowym ` *`; linie 1791/1822 uzywaja t('interview.insightCreatorModal.requiredMarker', 'wymagane') w nawiasie

# (7) TEZA: rejestr 43x2 istnieje, ale ma marker STARSZY niz Twoj (weryfikacja niezalezna wymagana)
head -3 docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md
#   oczekiwane: naglowek cytuje marker `bc18bc7a...`, inny niz marker tej instrukcji (`1c3d3da8...`)

# (8) TEZA: Stan PO rejestru menu Wywiadu jest nadal placeholderem (R3-R6 niewykonane tresciowo)
grep -n "Do uzupelnienia po R2" docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_MENU_AKCJI_WYWIAD_20260903.md
#   oczekiwane: 1 trafienie — sekcja "Stan PO" jest nadal pusta

# (9) dysk, porty, kontener
df -h /
lsof -nP -iTCP:6356 -sTCP:LISTEN; lsof -nP -iTCP:5496 -sTCP:LISTEN; docker ps --format '{{.Names}}' | grep -c cx-day330 || true
#   oczekiwane: powyzej 5 GB wolnego dysku; oba porty puste; 0 kontenerow
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day330-wywiad-menu-akcji-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6356`. Twój JEDYNY port harnessu to `5496`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day330-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000, 5037, 5060-5061, 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta: 5432, 5433 (Postgres hosta), 6012, 6379 (redis). Rodzeństwo paczki 04.09, wydawane w tym samym zestawie czterech instrukcji — NIE dotykasz ich portów nawet jeśli Twój dyżur wygląda na front-only: 331 (6357/5497), 332 (6358/5498), 333 (6359/5499). Cudze — worktree reużywane w tym dyżurze (292) używa portów NIEZNANYCH z tej instrukcji — nie zgaduj ich, nie odpalaj, Twoje własne to wyłącznie 6356/5496. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `Brak. Ten dyżur nie dodaje ani nie zmienia żadnej flagi funkcyjnej — macierz akcji Wywiadu (R1-R2) jest już scalona i działa bez flagi; R3-R6 uzupełniają wiring istniejących handlerów w istniejącym mechanizmie, naprawa literału i wzmocnienie testu też nie wymagają flagi`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`. Model uprawnień Wywiadu (`server/src/middleware/auth.middleware.ts`, bramki tras `interview.routes.ts`/`v8/interview.routes.ts`) — ten dyżur nie ma powodu ich dotykać, zero zmian tras`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY330_WYWIAD_MENU_REPORT.md`. Dozwolone nowe/zmieniane pliki dokumentacyjne: raport pod `SCIEZKA_RAPORTU`, uzupełnienie sekcji "Stan PO" w `REJESTR_MENU_AKCJI_WYWIAD_20260903.md` (istniejący plik, dopisujesz, nie kasujesz "Pomiar PRZED"), dopisek weryfikacyjny do `REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md` pod istniejącym Werdyktem (nie kasujesz istniejących 43 wierszy). Kod: zgodnie z zakresem R1-R6 instrukcji 292 + naprawa literału + wzmocnienie testu kontraktowego. Nowe pliki w `tests/` wymagają `git add -f`. **ZAKAZ edycji `MODULE_ACCEPTANCE.md`**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day330-wywiad-menu-akcji-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day330-wywiad-menu-akcji-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ tworzenia nowego worktree dla pozycji R3-R6** — reużywasz `/private/tmp/cx-day292-wywiad-menu`, kontynuujesz na TEJ SAMEJ gałęzi `codex/day292-wywiad-menu-akcji-20260903` od commitu `73c03f41a2`. **ZAKAZ zmiany bazy tego worktree i ZAKAZ `rebase`.** **ZAKAZ przepisywania "Pomiar PRZED" w rejestrze menu akcji** — dopisujesz wyłącznie "Stan PO". **ZAKAZ kasowania istniejących 43 wierszy rejestru kreatorów** — Twoja weryfikacja jest DOPISKIEM pod Werdyktem, z jawnym stwierdzeniem zgodny/niezgodny per punkt na Twoim własnym marker. **ZAKAZ zmiany `WizardModal.tsx`** (poza zakresem — należy do wspólnej powłoki obu kreatorów, dotknięcie wymaga decyzji właściciela, patrz punkt 43 rejestru). **ZAKAZ zmiany jakiejkolwiek trasy serwera** — cały zakres tego dyżuru jest frontowy | Worktree 292 istnieje z częściową, poprawną pracą (R1-R2 scalone w mechanizm); jego odtworzenie od zera kosztowałoby więcej niż domknięcie. Fałszywa teza dyżuru 322 (cytat nieistniejącego stringu) pokazuje, że przyczyna niedokończenia menu akcji NIE była tam, gdzie ktoś ją szukał — prawdziwa luka (szósty konsument) jest inna i cicha: test przechodzi, mimo że nie sprawdza całej rodziny plików, które faktycznie zależą od macierzy. Literał gwiazdki w kroku 2 kreatora przetrwał własny dyżur konwencji (323) mimo 16 obejrzanych kadrów — bo krok 2 nie był w polu widzenia mutacji dowodowej, tylko krok 1 (Tytuł). Rejestr 43×2 istnieje, ale nikt niezależny go nie zweryfikował na świeżym markerze — werdykt, którego nikt nie sprawdził drugi raz, jest tylko obietnicą |

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
cd /private/tmp/cx-day330-wywiad-menu-akcji

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day330-pg psql -U postgres -d cx330 \
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
cd /private/tmp/cx-day330-wywiad-menu-akcji

docker run -d --name cx-day330-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx330 \
  -p 127.0.0.1:6356:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day330-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6356/cx330 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6356/cx330 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day330-wywiad-menu-akcji && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6356/cx330 \
JWT_SECRET=cx330-test-secret-do-not-reuse \
npx vitest run `npx vitest run src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx --retry=0` (front, z roota repo); esbuild per plik zmieniony (`npx esbuild <plik> --bundle --outfile=/dev/null` albo `--noEmit` przez `tsc` WYŁĄCZNIE na pojedynczym pliku — zakaz pełnego `tsc`/`vitest` całego pakietu, `HIGIENA WYKONANIA`); dowód mutacyjny obowiązkowy dla wzmocnionego czwartego bloku kontraktowego (usuń wywołanie handlera z jednego z sześciu plików-konsumentów, pokaż czerwony, przywróć, pokaż zielony); dowód główny = zrzuty kebaba+podglądu dla 6 typów (light/dark, pl/en) opisane w raporcie, ścieżka `evidence/day330-wywiad-menu/` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day330-wywiad-menu-akcji-artefakty/day330-wywiad-menu-akcji.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day330-wywiad-menu-akcji && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run `npx vitest run src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx --retry=0` (front, z roota repo); esbuild per plik zmieniony (`npx esbuild <plik> --bundle --outfile=/dev/null` albo `--noEmit` przez `tsc` WYŁĄCZNIE na pojedynczym pliku — zakaz pełnego `tsc`/`vitest` całego pakietu, `HIGIENA WYKONANIA`); dowód mutacyjny obowiązkowy dla wzmocnionego czwartego bloku kontraktowego (usuń wywołanie handlera z jednego z sześciu plików-konsumentów, pokaż czerwony, przywróć, pokaż zielony); dowód główny = zrzuty kebaba+podglądu dla 6 typów (light/dark, pl/en) opisane w raporcie, ścieżka `evidence/day330-wywiad-menu/` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day330-wywiad-menu-akcji-artefakty/day330-wywiad-menu-akcji.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day330-wywiad-menu-akcji/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day330-pg psql -U postgres -d cx330 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day330-pg`.
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
> **(e) nie dotyczy — ten dyżur nie dotyka żadnej trasy serwera ani middleware'u autoryzacji, wyłącznie komponenty front-end i jeden plik testu kontraktowego. Dowód: `git diff --stat` po zakończeniu R1-R6 nie ma prawa wykazać żadnego pliku pod `server/`**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day330-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day330-wywiad-menu-akcji-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (przeczytaj INSTRUKCJA_DYZUR_292.md w całości, historię worktree 292, zmierz 9 komend §0.1) · R1 = R3 instrukcji 292 (Sesje + Szablony, wiring z macierzy) · R2 = R4 instrukcji 292 (Skrzynka + Wnioski + Inicjatywy Wywiadu) + naprawa listy konsumentów testu kontraktowego (dopisanie InterviewInsightPreview.tsx jako szóstego, wzmocnienie asercji do EFEKTU zamiast samej obecności stringu) · R3 = naprawa literału gwiazdki `InsightCreatorModal.tsx:2177` na konwencję `requiredMarker` · R4 = weryfikacja niezależna rejestru 43×2 na Twoim marker (dopisek pod Werdyktem, nie nadpisanie) · R5 = R5 instrukcji 292 (dowód: zrzuty kebaba+podglądu 6 typów, a11y, lista czekowania część B per typ) · R6 (raport zbiorczy + uzupełnienie "Stan PO")`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6356` albo `5496` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6356` albo `5496`** (`Z7`).

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

22.08 właściciel zobaczył, że w Wywiadzie pełne menu akcji ma tylko Przydział — Skrzynka, Sesje,
Szablony, Wnioski i Inicjatywy Wywiadu wyglądają jak ten sam produkt, ale nie dają tych samych
możliwości. Dyżur 292 (03.09) zrobił R1 (macierz akcji, jedna tabela dla sześciu typów) i R2
(wspólny mechanizm — `interviewActionMatrix.ts` jako SSOT, z którego korzysta i kebab wiersza,
i pasek podglądu). R3-R6 — dopięcie pozostałych pięciu typów, naprawa testu, dowód, raport —
**nie zostały rozpoczęte**: worktree ma dokładnie dwa commity nad wspólnym przodkiem, oba z
03.09, zero z 04.09.

Dyżur 322 dostał zadanie domknięcia R3-R6 i też ich nie zaczął. Zamiast tego postawił w swoim
raporcie tezę o przyczynie: „test wymienia `InsightViewer.tsx`". **To jest fałsz — w pliku testu
nie ma ani jednego wystąpienia tego napisu.** Prawdziwy defekt jest inny i cichszy: czwarty blok
testu kontraktowego (`is consumed by the row-menu host and every dedicated preview action
component`) sprawdza obecność `interviewActionMeta` w liście **pięciu** plików — hosta kebaba
(`InterviewHub.tsx`) i czterech podglądów (Assignment/Session/Template/Initiative). **Pomija
szósty realny konsument: `InterviewInsightPreview.tsx`**, który macierz faktycznie importuje
(`import { interviewActionMeta } from './interviewActionMatrix';`, linia 32) — po prostu nikt go
nie dopisał do listy testowanych plików. Test dziś przechodzi, bo nie patrzy tam, gdzie powinien.

Osobno, z odbioru dyżuru 323 (którego całym zakresem była właśnie ta konwencja): mimo naprawy
czterech asercji testu a11y i 16 obejrzanych kadrów, **`InsightCreatorModal.tsx:2177` nadal ma
literał gwiazdki** — `{t('interview.insightCreatorModal.selectSourceSessions')} *` w
`renderSessionsBlock()` (krok 2, wybór sesji źródłowych). Krok 1 (pole Tytuł, linie 1786-1792)
ma poprawną konwencję: `({t('interview.insightCreatorModal.requiredMarker', 'wymagane')})`,
z komentarzem w kodzie cytującym `CLAUDE.md` §3 i odbiór 2026-08-30. Dyżur 323 naprawił i
zweryfikował mutacyjnie tylko pole Tytuł — krok 2 nie był w zakresie jego dowodu i literał
przetrwał niezauważony. Do tego rejestr 43×2 obu kreatorów (`REJESTR_KREATORY_LISTA_CZEKOWANIA_
20260904.md`), który dyżur 323 zbudował, nosi marker starszy niż ten dokument i nikt niezależny
go jeszcze nie zweryfikował.

## ★ Zmierz moje liczby sam

Twierdzę: 292 ma dokładnie dwa commity nad `58ef0771d7` (`aa8fdcc8bd`, `73c03f41a2`), worktree
czysty; test kontraktowy nie zawiera stringu `InsightViewer`; lista `files` w czwartym bloku ma
5 wpisów, brakuje `InterviewInsightPreview.tsx`, który realnie importuje `interviewActionMeta`;
`InsightCreatorModal.tsx:2177` ma surowy ` *`, linie 1791/1822 mają poprawny `requiredMarker`;
rejestr 43×2 istnieje (53 linie, marker `bc18bc7a...`) z werdyktem „nie osiąga 100%" (punkty
31/32/40/41/43 czerwone dla co najmniej jednego kreatora); sekcja „Stan PO" rejestru menu akcji
Wywiadu jest nadal placeholderem jednozdaniowym. **Jeśli Twój pomiar przeczy mojej liczbie,
obowiązuje Twój — zapisz rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
> jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi«
> jest NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, produkt
> zastępczy: czerwony kontrakt + brief.

| Plik / wzorzec | Licencja | Zastępczy produkt |
| --- | --- | --- |
| `src/components/Interview/interviewActionMatrix.ts` | **★ PEŁNA LICENCJA** w zakresie R3-R6 (dopisanie akcji Sesji/Szablonów/Skrzynki/Wniosków/Inicjatyw Wywiadu, jeśli macierz ich dziś nie niesie) | — |
| `src/components/Interview/InterviewHub.tsx`, `InterviewAssignmentPreview.tsx`, `InterviewSessionPreview.tsx`, `InterviewTemplatePreview.tsx`, `InterviewInitiativePreview.tsx`, `InterviewInsightPreview.tsx` | **★ PEŁNA LICENCJA** w zakresie wiring macierzy → kebab/pasek podglądu | — |
| `src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx` | **★ PEŁNA LICENCJA** — dopisanie `InterviewInsightPreview.tsx` do listy `files`, wzmocnienie asercji z `toContain('interviewActionMeta')` na dowód EFEKTU (wywołanie handlera) | — |
| `src/components/Interview/InsightCreatorModal.tsx` | **★ WĄSKA LICENCJA: wyłącznie linia ok. 2177** (`renderSessionsBlock()`), zamiana literału ` *` na konwencję `({t('interview.insightCreatorModal.requiredMarker', 'wymagane')})` analogiczną do linii 1791/1822. **ZAKAZ** zmiany innych linii, kroków, layoutu | Czerwony kontrakt + brief |
| `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx` | **TYLKO ODCZYT** — wchodzi wyłącznie do weryfikacji rejestru 43×2 (R4), nie do naprawy | Wpis `DO DECYZJI WŁAŚCICIELA` jeśli znajdziesz nowy defekt |
| `src/components/shared/WizardModal/WizardModal.tsx` | **TYLKO ODCZYT — WSPÓLNA powłoka obu kreatorów** | Wpis `DO DECYZJI WŁAŚCICIELA` z promieniem rażenia, nie naprawiasz tutaj |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_MENU_AKCJI_WYWIAD_20260903.md` | **PEŁNA LICENCJA — wyłącznie dopisanie sekcji „Stan PO"**. **ZAKAZ** zmiany „Pomiar PRZED" | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md` | **PEŁNA LICENCJA na DOPISYWANIE** pod istniejącym „Werdykt". **ZAKAZ kasowania 43 istniejących wierszy** | — |
| `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie, jeśli R1-R2 (Sesje/Szablony/Skrzynka/Wnioski/Inicjatywy) wymaga nowych kluczy akcji | — |
| `evidence/day330-wywiad-menu/**` (**NOWY**, poza repo-śledzeniem standardowym) | **★ PEŁNA LICENCJA**, `git add -f` | — |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| `scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh`, `scripts/check-artefakt.sh` | **TYLKO ODCZYT** | Musisz przechodzić zielono, nie zmieniać reguł |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY330_WYWIAD_MENU_REPORT.md` | **JEDYNY nowy raport zbiorczy** (`Z13`) | — |
| **Wszystko inne, w tym CAŁE `server/`** | **TYLKO ODCZYT** | Opis w raporcie z plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

| Pozycja | Nazwa | Rdzeń? | Przekrojowe? | DoD | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R0 | Odczyt instrukcji 292 + historia worktree + 9 komend `§0.1` | TAK | NIE | bazowe | Wszystko przeczytane i zmierzone na Twoim markerze | 9 komend | brak |
| R1 | Sesje + Szablony (R3 instr. 292) | TAK | NIE — dowód: `Z12` nie chroni plików Wywiadu | wg instr. 292 | Akcje z macierzy uzupełnione w obu miejscach dla tych dwóch typów, klucze i18n pl/en, esbuild każdego pliku | `npx esbuild <plik> --bundle --outfile=/dev/null` per plik | `feat(interview): R3 sesje+szablony menu akcji (330 R1)` |
| R2 | Skrzynka + Wnioski + Inicjatywy Wywiadu (R4 instr. 292) + naprawa listy konsumentów testu | TAK | NIE | wg instr. 292 + 1 wzmocniona asercja | Trzy pozostałe typy uzupełnione; `InterviewInsightPreview.tsx` dopisany do listy `files`; czwarty blok asertuje EFEKT (wywołanie handlera), nie sam string | `npx vitest run src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx --retry=0` | `feat(interview): R4 skrzynka+wnioski+inicjatywy + szósty konsument testu (330 R2)` |
| R3 | Naprawa literału `InsightCreatorModal.tsx:2177` | TAK | NIE — dowód: wiersz `B.1` daje wąską licencję | 0 nowych | Krok 2 używa `requiredMarker`, zero surowych `*` w polach wymaganych modalu | `grep -n \"') \\*'\" src/components/Interview/InsightCreatorModal.tsx` → pusto | `fix(interview): usuwa ostatni literał gwiazdki — krok 2 kreatora wniosku (330 R3)` |
| R4 | Weryfikacja niezależna rejestru 43×2 | NIE | NIE | n/d | Dopisek pod „Werdykt" z Twoim własnym przejściem punktów na marker `1c3d3da8...`, zgodny/niezgodny per punkt, nie przepisany z 323 | `evidence/day330-wywiad-menu/rejestr-weryfikacja.md` | `docs(day330): weryfikacja niezależna rejestru 43x2 (330 R4)` |
| R5 | Dowód (R5 instr. 292) | TAK | NIE | wg instr. 292 | Zrzuty kebaba+podglądu 6 typów, light+dark, pl+en, a11y bez naruszeń hosta, lista czekowania część B per typ | `node scripts/dev/grafika-zrzuty.mjs …` | `docs(day330): dowód 6 typów Wywiadu (330 R5)` |
| R6 | Raport zbiorczy + „Stan PO" | NIE | NIE | n/d | Struktura `§R.2`, „Stan PO" rejestru menu akcji uzupełnione, TWIERDZENIA NIEZWERYFIKOWANE niepuste | — | `docs(day330): raport` |

> Żadna pozycja nie wymaga zmiany pliku serwera — cały zakres jest frontowy.

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Commity 292 ponad wspólnym przodkiem | 2 | `git -C /private/tmp/cx-day292-wywiad-menu log --oneline 58ef0771d7..HEAD \| wc -l` | TAK |
| 2 | Wystąpienia `InsightViewer` w teście kontraktowym | 0 | `grep -c InsightViewer src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx` | TAK |
| 3 | Pliki w liście `files` czwartego bloku | 5 (brakuje 6.) | `sed -n '63,70p' src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx \| grep -c \"src/components/Interview\"` | TAK |
| 4 | Import `interviewActionMeta` w `InterviewInsightPreview.tsx` | 1 | `grep -c interviewActionMeta src/components/Interview/InterviewInsightPreview.tsx` | TAK |
| 5 | Literały ` *` pozostałe w `InsightCreatorModal.tsx` (wzorzec `') *'` po tekście i18n, nie w komentarzu) | 1 (linia 2177) | `grep -n \"') \\*'\\|)} \\*\" src/components/Interview/InsightCreatorModal.tsx` | ★ SPRAWDŹ — dopasuj wzorzec do realnego stylu linii, nie kopiuj ślepo |
| 6 | Wiersze rejestru 43×2 | 43 (86 rozstrzygnięć: kreator × 2) | `grep -c '^| [0-9]' docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md` | TAK |
| 7 | Punkty czerwone w werdykcie 43×2 dla co najmniej jednego kreatora | 5 (31,32,40,41,43) | odczyt tabeli, kolumna zawiera `✗` | TAK — do potwierdzenia niezależnie w R4 |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik/katalog | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- |
| 1 | `src/components/Interview/**` (poza `InsightCreatorModal.tsx` poza linią 2177) | R1-R2 | NISKIE — Twój worktree reużywany, nikt inny go dziś nie dotyka |
| 2 | `src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx` | R2 | NISKIE |
| 3 | `src/components/Interview/InsightCreatorModal.tsx` (wyłącznie linia 2177) | R3 | ŚREDNIE — plik dotykany przez dyżur 323 wcześniej, ale ten commit już scalony |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_MENU_AKCJI_WYWIAD_20260903.md` (sekcja Stan PO) | R6 | NISKIE |
| 5 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md` (dopisek) | R4 | NISKIE |
| 6 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY330_WYWIAD_MENU_REPORT.md` | R6 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `public/locales/pl/translation.json`, `public/locales/en/translation.json` | R1-R2 | Tylko jeśli uzupełnienie akcji wymaga nowych kluczy i18n — dopisujesz, parytet w tym samym commicie |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/** (cały katalog) — zero zmian tras w tym dyżurze
src/components/shared/WizardModal/WizardModal.tsx — wspólna powłoka, promień rażenia poza zakresem
src/components/Initiatives/Wizard/InitiativeWizardModal.tsx — tylko odczyt w tym dyżurze
scripts/dev/testy-puste-skan.mjs, tests/unit/config/noEmptyAssertions.test.ts — dyżur 332
server/migrations/**, server/scripts/migrationOrdering.ts, tests/unit/backend/schema/** — dyżur 333
src/components/MyWork/**, src/components/Initiatives/** (poza WizardModal) — dyżur 331
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6356 | `lsof -nP -iTCP:6356 -sTCP:LISTEN` → puste |
| Port harnessu | 5496 | `lsof -nP -iTCP:5496 -sTCP:LISTEN` → puste |
| Kontener | `cx-day330-pg` | `docker ps` → brak |
| Baza | `cx330` | n/d — front-only, kontener prawdopodobnie niepotrzebny, ale zarezerwowany |
| Gałąź | `codex/day292-wywiad-menu-akcji-20260903` (REUŻYWANA, nie tworzysz nowej) | `git -C /private/tmp/cx-day292-wywiad-menu branch --show-current` |
| Worktree | `/private/tmp/cx-day292-wywiad-menu` (istniejący, reużywany) | `ls -d /private/tmp/cx-day292-wywiad-menu` |
| Flagi | brak nowych | n/d |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day292-wywiad-menu
git diff --name-only --cached | tee /private/tmp/cx-day330-wywiad-menu-akcji-artefakty/staged.txt
grep -iE '^server/|testy-puste-skan|migrationOrdering|WizardModal\.tsx$|InitiativeWizardModal\.tsx$' /private/tmp/cx-day330-wywiad-menu-akcji-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — ODCZYT I POMIAR

Przeczytaj `INSTRUKCJA_DYZUR_292.md` w całości. Wykonaj i wklej wynik 9 komend `§0.1`. Potwierdź
na SWOIM markerze: dwa commity 292, brak `InsightViewer` w teście, pięć plików w liście `files`,
import `interviewActionMeta` w `InterviewInsightPreview.tsx`, literał w linii 2177, marker
rejestru 43×2 starszy niż Twój, „Stan PO" nadal placeholder.

Prawo zatrzymania po tej pozycji.

## R1 — SESJE + SZABLONY (rdzeń, R3 instrukcji 292)

Uzupełnij akcje z macierzy w obu miejscach (kebab wiersza + pasek podglądu) dla typów `session`
i `template`, jeśli macierz dziś nie niesie dla nich pełnego kompletu z rejestru „Pomiar PRZED"
(`REJESTR_MENU_AKCJI_WYWIAD_20260903.md`). Klucze i18n pl/en dla każdej nowej akcji. Esbuild
KAŻDEGO zmienionego pliku osobno (zakaz pełnego `tsc`). Zrzuty kebaba i podglądu obu typów,
light/dark, jako dowód wstępny (pełny dowód formalny idzie do R5).

Commit po R1.

## R2 — SKRZYNKA + WNIOSKI + INICJATYWY WYWIADU + SZÓSTY KONSUMENT (rdzeń, R4 instrukcji 292)

Jak R1, dla typów `inbox`, `insight`, `initiative`. Dla Inicjatyw Wywiadu: każda akcja „otwórz
inicjatywę" prowadzi do zatwierdzonego rekordu (`DEC-2026-09-03-346`: `InitiativeDocumentView`),
zweryfikuj testem `initiativeRecordCanon`, jeśli istnieje, albo opisz brak i zaprojektuj
odpowiednik.

**Naprawa listy konsumentów (pozycja przeniesiona z fałszywej diagnozy dyżuru 322):** dopisz
`'src/components/Interview/InterviewInsightPreview.tsx'` do tablicy `files` w bloku `is consumed
by the row-menu host and every dedicated preview action component`
(`interviewActionMatrix.contract.test.tsx`, dziś linie ok. 63-70). Następnie wzmocnij samą
asercję: zamiast `toContain('interviewActionMeta')` (dowód obecności stringu w pliku źródłowym,
nie dowód wywołania), zbuduj dowód EFEKTU — np. renderuj każdy z sześciu komponentów (host
kebaba + 5 podglądów), otwórz menu/pasek akcji i sprawdź, że wybranie pozycji z macierzy
faktycznie wywołuje odpowiadający handler/trasę, nie tylko że identyfikator `interviewActionMeta`
występuje w kodzie pliku. **Dowód mutacyjny obowiązkowy**: usuń wywołanie handlera z JEDNEGO
z sześciu plików, uruchom test — musi zaczerwienić się; przywróć przez `cp` kopii (`Z27`) —
musi wrócić do zielonego; `git diff --check` na pliku produkcyjnym pusty przed commitem.

Commit po R2.

## R3 — NAPRAWA LITERAŁU `InsightCreatorModal.tsx:2177`

W `renderSessionsBlock()` zamień:

```diff
- {t('interview.insightCreatorModal.selectSourceSessions')} *
+ {t('interview.insightCreatorModal.selectSourceSessions')}{' '}
+ <span className="text-xs font-normal text-slate-600 dark:text-slate-400">
+   ({t('interview.insightCreatorModal.requiredMarker', 'wymagane')})
+ </span>
```

(dopasuj dokładny JSX do stylu sąsiedniego labela w liniach 1786-1792 — ta sama klasa, ten sam
klucz `requiredMarker`). Po naprawie: `grep -n "') \*'" src/components/Interview/
InsightCreatorModal.tsx` → pusto (zero pozostałych surowych gwiazdek w polach wymaganych).
Sprawdź istniejący test a11y (`InsightCreatorModal.a11y.test.tsx`, naprawiony przez dyżur 323)
— **jeśli** zawiera asercję na `selectSourceSessions` z literałem `*`, napraw ją analogicznie do
naprawy z dyżuru 323 (`getByLabelText` na nowy wzorzec), z tym samym dowodem mutacyjnym w obie
strony (usuń `htmlFor`/`aria-label`, pokaż czerwony, przywróć, pokaż zielony).

Commit po R3.

## R4 — WERYFIKACJA NIEZALEŻNA REJESTRU 43×2

Rejestr `REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md` istnieje z markerem `bc18bc7a...` —
starszym niż ten dyżur. Przejdź WSZYSTKIE 43 punkty dla obu kreatorów na SWOIM markerze
(`1c3d3da8...`), niezależnie, bez kopiowania cudzych wyników. Zapisz dopisek pod istniejącym
„Werdykt": per punkt — zgodny z zapisem 323 / niezgodny (z dowodem) / nie dotyczy zmieniło się.
Punkty 31/32/40/41/43 (dziś czerwone dla co najmniej jednego kreatora) sprawdź ze szczególną
uwagą — to one niosą werdykt „nie osiąga 100%". Nie naprawiasz `WizardModal.tsx` (poza zakresem,
patrz `B.1`) — jeśli defekt tam nadal stoi, potwierdź to i zostaw `DO DECYZJI WŁAŚCICIELA`.

Commit po R4.

## R5 — DOWÓD (rdzeń, R5 instrukcji 292)

Dla każdego z 6 typów Wywiadu: zrzut kebaba otwartego i podglądu z paskiem akcji, light + dark,
pl 1440 i en 1024, kanonicznym narzędziem `scripts/dev/grafika-zrzuty.mjs` z flagami z pułapki
(5) `§0.2e` tej instrukcji jeśli dotyczy sekcji zwijanych. A11y zero realnych naruszeń poza
trzema regułami hosta. Test kontraktowy `interviewActionMatrix.contract.test.tsx` w całości
zielony (R2). Lista czekowania część B z `TRIADA_KANON.md` przejrzana per typ, z zaznaczeniem
punktów nie do spełnienia i dlaczego (np. Wywiad to nie ekran kanban — `n/d`).

Commit po R5.

## R6 — RAPORT ZBIORCZY

Macierz PRZED/PO wszystkich sześciu typów, stan naprawy literału z dowodem mutacyjnym testu
a11y (jeśli dotknięty), wynik weryfikacji niezależnej 43×2 (zgodny/niezgodny per punkt), ścieżki
zrzutów R5, uzupełniona sekcja „Stan PO" w `REJESTR_MENU_AKCJI_WYWIAD_20260903.md`, TWIERDZENIA
NIEZWERYFIKOWANE.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1-R3 zrobione, R4 rozpoczęte, R5-R6 nietknięte" jest
pełnowartościowym wynikiem. Menu z przyciskiem, który nic nie robi, nie jest warte nic — to
atrapa. Zamknięcie w raporcie pozycji, której nie domknąłeś w całości, nie jest wynikiem —
rejestr, który kłamie, kosztuje więcej niż praca, której nie zrobiono.
