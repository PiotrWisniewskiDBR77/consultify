# INSTRUKCJA DYŻURU nr 249 — Codex — „★★ SYGNATURA BEZ ZABEZPIECZENIA — TRZY POTWIERDZONE PRZYPADKI DZIŚ, PEŁNY PRZEGLĄD `server/src/services/**` W TOKU. Zmierzone bezpośrednio w kodzie na SHA `818e9cec0b` (świeższym niż marker `df7f13056f`): `server/src/services/ai/proactiveNudges.ts:11` `generateNudges(userId, orgId?)` — parametr `orgId` NIGDY nie pojawia się w ciele funkcji (zapytania `SELECT ... FROM tasks WHERE assignee_id=?` i `FROM decisions WHERE assigned_to=?`, obie parametryzowane WYŁĄCZNIE `[userId]`, potwierdzone `grep -n "orgId" proactiveNudges.ts` → trafienia tylko w sygnaturach trzech funkcji przekazujących go dalej, ZERO w zapytaniach); `server/src/services/ai/abTesting.ts:178` `startExperiment(id, userId)` — `UPDATE ai_ab_experiments SET status='running'... WHERE id = ? AND status = 'draft'` z parametrem WYŁĄCZNIE `[id]`, `userId` kompletnie nieużyty w całej funkcji; `server/src/services/tablePlatform/FieldPermissionService.ts:34,52` `canReadField(userId, fieldId, userRole)` i `canWriteField(userId, fieldId, userRole)` — OBIE funkcje (rodzeństwo w tym samym pliku, ten sam kształt) decydują wyłącznie na podstawie STRINGA `userRole` przekazanego przez wołającego, `userId` nigdzie nieużyty, czyli wołający może podać DOWOLNY `userRole` bez weryfikacji, że to naprawdę rola tego `userId`. Kontekst: `server/src/services/StudioService.ts:104-129` (`getDocument`) miało dokładnie ten sam kształt — naprawione dziś, referencja do porównania."

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
> **wyłącznie** `/private/tmp/cx-day249-sygnatura-bez-ochrony`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `df7f13056f`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-01.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****PRZEKROJOWE — POMIAR, BEZ NAPRAWY (domyślnie). Sygnatura bez zabezpieczenia (kształt 23, `docs/program/funkcje/KSZTALT_23_SYGNATURA_BEZ_ZABEZPIECZENIA.md`) w `server/src/services/**`: funkcje przyjmujące `userId`/`organizationId`/`orgId` jako parametr, które NIE UŻYWAJĄ go w zapytaniu SQL. Zmierzony przypadek referencyjny: `StudioService.getDocument` przyjmowało `userId` i nigdy go nie użyło (już naprawione dziś). Ten dyżur mierzy — czyta do SQL, nie liczy wystąpień identyfikatora — i zgłasza, nie naprawia, chyba że trafi na coś jednoznacznego i wąskiego (patrz `POZYCJE_RDZENIA`).****.
Trasy front: `brak w zakresie tego dyżuru — pomiar po stronie `server/src/services/**`, front nie jest dotykany`. Trasy tył: `3 potwierdzone przypadki: `server/src/services/ai/proactiveNudges.ts:11` · `server/src/services/ai/abTesting.ts:178` · `server/src/services/tablePlatform/FieldPermissionService.ts:34,52` — plus ok. 80 dalszych kandydatów heurystycznych z `§3 R1` do przeczytania w `R2``.

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
WT=/private/tmp/cx-day249-sygnatura-bez-ochrony
MARKER=df7f13056f

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day249-sygnatura-bez-ochrony-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day249-sygnatura-bez-ochrony/config.worktree"
cat "$VAULT/worktrees/cx-day249-sygnatura-bez-ochrony/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day249-sygnatura-bez-ochrony-scratch
mkdir -p /private/tmp/cx-day249-sygnatura-bez-ochrony-artefakty

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
git -C "$VAULT" log --oneline df7f13056f..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only df7f13056f..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day249-sygnatura-bez-ochrony-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only df7f13056f..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: generateNudges(userId, orgId) w proactiveNudges.ts nigdy nie uzywa orgId
grep -n "orgId" server/src/services/ai/proactiveNudges.ts
sed -n '11,50p' server/src/services/ai/proactiveNudges.ts
#   oczekiwane: orgId pojawia sie tylko w sygnaturach funkcji przekazujacych go dalej,
#   zero w zapytaniach SQL wewnatrz generateNudges

# (2) TEZA: startExperiment(id, userId) w abTesting.ts nigdy nie uzywa userId
sed -n '170,195p' server/src/services/ai/abTesting.ts
#   oczekiwane: UPDATE ... WHERE id = ? AND status = 'draft', parametr WYLACZNIE [id]

# (3) TEZA: canWriteField i canReadField w FieldPermissionService.ts nigdy nie uzywaja userId
sed -n '1,70p' server/src/services/tablePlatform/FieldPermissionService.ts
#   oczekiwane: obie funkcje przyjmuja userId w sygnaturze, decyzja oparta WYLACZNIE
#   na parametrze userRole (string od wolajacego), userId nieuzyty w ciele

# (4) TEZA: StudioService.getDocument mial dzis dokladnie ten sam ksztalt, juz naprawiony
grep -n "organization_id !== organizationId" server/src/services/StudioService.ts
#   oczekiwane: trafienie — to jest wzorzec NAPRAWIONEGO przypadku do porownania

# (5) TEZA: users.organization_id (jesli istnieje) jest kolumna 1:1, nie tablica wielu
#     organizacji na uzytkownika — potrzebne do osadu w PULAPCE
grep -rn "CREATE TABLE users\b" server/migrations/*.sql | head -3
grep -rn "organization_id" server/migrations/*.sql | grep -i "ALTER TABLE users\|users.*organization_id" | head -5
#   oczekiwane: znajdz definicje kolumny, potwierdz czy jest to FK 1:1 czy relacja wiele-do-wielu

# (6) TEZA: kod zrodlowy kzstaltu 23 opisuje dokladnie StudioService jako przyklad referencyjny
grep -n "Studio\|userId.*nigdy" docs/program/funkcje/KSZTALT_23_SYGNATURA_BEZ_ZABEZPIECZENIA.md
#   oczekiwane: potwierdzenie opisu zmierzonego przypadku

# (7) TEZA: dyzury 246/247 (siostrzane w tej samej paczce) mierza obecnosc organization_id
#     w TRASACH, nie uzycie parametru w SERWISACH — rozne, komplementarne wymiary
ls docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_246_DOMIAR_AUDYTU.md docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_247_PROBKA_NAPRAWIONE.md 2>&1
#   oczekiwane: pliki moga jeszcze nie istniec w Twoim repo (inny tor je scala) — brak pliku
#   NIE jest STOP-em, zapisz w Korektach i kontynuuj na podstawie opisu w tej instrukcji

# (8) TEZA: miejsce na dysku wystarcza
df -h /
#   oczekiwane: powyzej 5 GB wolnego
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day249-sygnatura-bez-ochrony-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6238`. Twój JEDYNY port harnessu to `5218 i 5219`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day249-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6229, 5010-5209, 6404-6411, 6600-6830 (obejmuje też dyżury 242-244). Twoje własne: baza 6238, harness 5218 i 5219. Cudze — siostrzane dyżury TEJ SAMEJ paczki (245-249, wydane 2026-09-01), nie dotykasz: baza 6230/harness 5210-11 (dyżur 245 Uprawnienia Flaga), baza 6232/harness 5212-13 (dyżur 246 Domiar Audytu), baza 6234/harness 5214-15 (dyżur 247 Próbka Naprawione), baza 6236/harness 5216-17 (dyżur 248 Martwe Bliźniaki). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi. `Z10` obowiązuje bez wyjątku.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/admin.middleware.ts` · `server/src/middleware/rbac.middleware.ts` · `server/src/middleware/effectiveCapability.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY249_SYGNATURA_BEZ_OCHRONY_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć, to jeden nowy wpis (nie edycja istniejących wierszy) w rejestrze dowodowym `docs/program/funkcje/KSZTALT_23_SYGNATURA_BEZ_ZABEZPIECZENIA.md` — WYŁĄCZNIE nowa sekcja na końcu pliku „## Dzień 249 — przemiatanie serwera” z tabelą klasyfikacji kandydatów i dowodem `plik:linia` dla każdego. Zakaz kasowania, nadpisywania lub przepisywania istniejącej treści tego pliku. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day249-sygnatura-bez-ochrony-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day249-sygnatura-bez-ochrony-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **Domyślnie ZAKAZ NAPRAWY** — ten dyżur mierzy i zgłasza, tak jak 246/247. **Jedyny dopuszczalny wyjątek**: jeśli podczas R2 trafisz na przypadek TAK WĄSKI i JEDNOZNACZNY jak `FieldPermissionService.canWriteField`/`canReadField` (jedna funkcja, jeden plik, brak zależności od bramek platformowych z `LISTA_BRAMEK`, poprawka to dodanie JEDNEGO porównania `userId`-do-roli-z-bazy zamiast ślepego zaufania `userRole` z wołania) — WOLNO Ci naprawić WYŁĄCZNIE tę jedną, wąską pozycję, z pełnym dowodem mutacyjnym i parą dowodową jak w dyżurze 245, pod warunkiem że nie dotykasz żadnego pliku z `LISTA_BRAMEK` ani nie zmieniasz kształtu odpowiedzi dla panelu administracyjnego. **W razie wątpliwości — NIE naprawiasz, zgłaszasz.** ZAKAZ liczenia wystąpień identyfikatora jako dowodu kontroli — czytasz WYWOŁANIE zapytania SQL, nie sygnaturę. | Kształt 23 jest szczególnie niebezpieczny, bo `docs/program/funkcje/KSZTALT_23_SYGNATURA_BEZ_ZABEZPIECZENIA.md` wprost ostrzega: „obecność parametru uprawnień w sygnaturze nie jest dowodem kontroli… nasz własny audyt rodzin tras szukał między innymi tak (grep po obecności organizationId/userId) — ten przypadek złapał wyłącznie dlatego, że wykonawca zszedł do samego zapytania SQL”. Innymi słowy: dyżury 246 i 247 tej samej paczki, mierzące obecność `organization_id` w PLIKACH TRAS, z definicji NIE ZŁAPIĄ tego kształtu, jeśli parametr jest obecny ale nieużyty — bo ich filtr heurystyczny szuka OBECNOŚCI, nie UŻYCIA. Ten dyżur mierzy inny, komplementarny wymiar: funkcje w WARSTWIE SERWISU (nie tras), gdzie parametr jest przyjęty, ale nie trafia do zapytania. |

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
cd /private/tmp/cx-day249-sygnatura-bez-ochrony

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day249-pg psql -U postgres -d cx249 \
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
cd /private/tmp/cx-day249-sygnatura-bez-ochrony

docker run -d --name cx-day249-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx249 \
  -p 127.0.0.1:6238:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day249-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6238/cx249 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6238/cx249 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day249-sygnatura-bez-ochrony && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6238/cx249 \
JWT_SECRET=cx249-test-secret-do-not-reuse \
npx vitest run server/src/services/tablePlatform/__tests__/day249-fieldPermissionService.userScope.test.ts (WYŁĄCZNIE jeśli podejmiesz się wąskiej naprawy z ZAKAZ_WLASCIWY_TEMU_DYZUROWI — w przeciwnym razie ten dyżur nie tworzy plików testowych) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day249-sygnatura-bez-ochrony-artefakty/day249-pomiar.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day249-sygnatura-bez-ochrony && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/tablePlatform/__tests__/day249-fieldPermissionService.userScope.test.ts (WYŁĄCZNIE jeśli podejmiesz się wąskiej naprawy z ZAKAZ_WLASCIWY_TEMU_DYZUROWI — w przeciwnym razie ten dyżur nie tworzy plików testowych) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day249-sygnatura-bez-ochrony-artefakty/day249-pomiar.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day249-sygnatura-bez-ochrony/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day249-pg psql -U postgres -d cx249 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day249-pg`.
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
> **(e) ★★ NIE KAŻDY „NIEUŻYTY PARAMETR” JEST DZIURĄ — TRZEBA OSĄDZIĆ, CZY SCOPING PRZEZ INNY KANAŁ WYSTARCZA.** Przykład z `proactiveNudges.ts`: `generateNudges(userId, orgId)` nie używa `orgId`, ale zapytania SĄ scope'owane przez `userId` (`assignee_id=?`/`assigned_to=?`) — jeśli `assignee_id` jednoznacznie wiąże się z JEDNĄ organizacją (użytkownik należy do dokładnie jednej organizacji), brak `orgId` w zapytaniu może być NIESZKODLIWY, bo `userId` już wystarczająco zawęża wynik. **To wymaga sprawdzenia schematu** (`grep -n "organization_id" server/migrations/*.sql | grep -i users` — czy `users.organization_id` jest kolumną 1:1, nie tablicą wielu organizacji na użytkownika) — nie automatycznego ogłoszenia dziury. Kontrastuj to z `FieldPermissionService.canWriteField` — tam `userId` nie jest użyty W OGÓLE, a `userRole` jest przyjmowany BEZPOŚREDNIO od wołającego bez weryfikacji względem `userId` — to jest kształt znacznie poważniejszy (wołający może zgłosić się jako dowolna rola). **Rozróżnij te dwa przypadki jawnie w raporcie**, nie traktuj każdego trafienia identycznie.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day249-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day249-sygnatura-bez-ochrony-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (potwierdzenie trzech znanych przypadków, warunek wejścia) · R1 (regeneracja heurystycznej listy kandydatów w `server/src/services/**`) · R2 (przeczytanie ok. 80 kandydatów do SQL, klasyfikacja, ewentualna wąska naprawa jednego jednoznacznego przypadku) · R3 (raport)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6238` albo `5218 i 5219` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6238` albo `5218 i 5219`** (`Z7`).

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

# 1. PO CO TEN DYŻUR ISTNIEJE

`docs/program/funkcje/KSZTALT_23_SYGNATURA_BEZ_ZABEZPIECZENIA.md` opisuje dwudziesty trzeci
kształt fałszywego „gotowe": **funkcja przyjmuje `userId`/`organizationId` w sygnaturze, ale nigdy
nie używa go w zapytaniu.** Zmierzony przypadek referencyjny: `StudioService.getDocument`
(`server/src/services/StudioService.ts`) przyjmowało `userId` jako parametr i nigdy go nie
użyło w `WHERE`. Skutek — zanim naprawiono dziś — obca organizacja mogła odczytać, nadpisać
i skasować cudzy dokument. Reguła z tego dokumentu:

> „Obecność parametru uprawnień w sygnaturze nie jest dowodem kontroli. Dowodem jest jego użycie
> w warunku zapytania — sprawdzane do samego SQL."

**To jest dokładnie to, czego dyżury 246 i 247 tej samej paczki NIE złapią z definicji** — ich
filtr heurystyczny szuka OBECNOŚCI `organization_id` w pliku trasy, nie UŻYCIA w konkretnej
funkcji serwisowej. Ten dyżur mierzy komplementarny, głębszy wymiar: warstwę serwisu
(`server/src/services/**`), gdzie parametr jest przyjęty, ale może nie trafiać do zapytania.

## Trzy przypadki potwierdzone dziś, na SHA `818e9cec0b`

### 1. `proactiveNudges.ts:11` — `generateNudges(userId, orgId?)`

```ts
async generateNudges(userId: string, orgId?: string) {
  const stale = await dbAll(
    `SELECT id,title FROM tasks WHERE assignee_id=? AND status!='done' ... LIMIT 5`,
    [userId]
  );
  // ...decisions query, tez tylko [userId]...
}
```

`orgId` pojawia się TYLKO w sygnaturach trzech funkcji, które przekazują go dalej
(`getActiveNudges`, `getPendingNudges`, i jedna funkcja zapisująca aktywność z INSERT-em
`[userId, orgId, ...]` — INNA funkcja niż `generateNudges`). W samym `generateNudges` `orgId`
jest **zerowo używane**. **Nuans, nie automatyczna dziura:** zapytania są scope'owane przez
`userId` (`assignee_id=?`/`assigned_to=?`) — jeśli `users.organization_id` jest kolumną 1:1 (jeden
użytkownik należy do dokładnie jednej organizacji), brak `orgId` w WHERE może być NIESZKODLIWY,
bo `userId` już wystarczająco zawęża wynik. **To wymaga sprawdzenia schematu w `R0`**, nie
automatycznego ogłoszenia dziury.

### 2. `abTesting.ts:178` — `startExperiment(id, userId)`

```ts
async startExperiment(id: string, userId: string) {
  await dbRun(
    `UPDATE ai_ab_experiments SET status = 'running', started_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'draft'`,
    [id]
  );
  return this.getExperiment(id);
}
```

`userId` **kompletnie nieużyty** — parametr `[id]` jedyny w zapytaniu. Dowolny wołający, znający
`id` eksperymentu, może go uruchomić niezależnie od tego, czy `userId` ma do niego jakiekolwiek
prawo. Brak tu żadnego alternatywnego kanału scope'owania (w przeciwieństwie do przypadku 1) —
**to jest przypadek bliższy dziurze niż niegroźnej redundancji**.

### 3. `FieldPermissionService.ts:34,52` — `canReadField`/`canWriteField` (DWIE funkcje, to samo rodzeństwo)

```ts
async canReadField(userId: string, fieldId: string, userRole: string): Promise<boolean> {
  const field = await db.query('SELECT options FROM tp_fields WHERE id = $1', [fieldId]);
  // ...decyzja WYŁĄCZNIE na podstawie 'userRole' (string od wołającego)...
}

async canWriteField(userId: string, fieldId: string, userRole: string): Promise<boolean> {
  // identyczny kształt — userId NIGDY nieużyte
}
```

**Obie funkcje w tym samym pliku, ten sam kształt — rodzeństwo, dokładnie jak wymaga metodyka
programu** („szukaj rodzeństwa, które ma poprawkę, i tego, które jej nie ma"). `userId` jest
przyjmowane, ale decyzja opiera się WYŁĄCZNIE na `userRole` — stringu przekazanym przez wołającego,
BEZ weryfikacji, że to naprawdę rola TEGO `userId`. Jeżeli wołający kontroluje `userRole`
(np. z ciała żądania, nie z sesji), to jest bezpośrednia eskalacja uprawnień. **To wymaga
sprawdzenia w `R0`, skąd faktycznie pochodzi `userRole` u wszystkich wołających tych dwóch
funkcji** — jeśli pochodzi zawsze z bezpiecznego źródła (np. middleware sesji), ryzyko jest niższe
niż wygląda; jeśli z ciała żądania, to jest to gotowa dziura.

## Zakres i metoda

`server/src/services/**` ma **1736 plików**. Pełne przeczytanie wszystkich nie mieści się w jednym
dyżurze. Metoda: funkcje-metody z parametrem `userId`/`organizationId`/`orgId` w sygnaturze, których
ciało (okno 60 linii) zawiera wywołanie zapytania do bazy (`dbGet`/`dbAll`/`dbRun`/`db.query`/
`pool.query`/`knex`), a sam parametr pojawia się w tym oknie **co najwyżej raz** (czyli tylko
w sygnaturze, albo raz gdzie indziej niedowodnie). To jest **heurystyka przesiewowa, NIE wyrok** —
każdy trafiony kandydat wymaga PRZECZYTANIA, dokładnie jak wymaga kształt 23 („nie licz wystąpień,
czytaj SQL"). Moja świeża regeneracja tej heurystyki na SHA `818e9cec0b` dała **82 kandydatów**
(`§3 R1`).

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | `generateNudges(userId, orgId)` nigdy nie używa `orgId` w zapytaniach | komenda (1) |
| T2 | `startExperiment(id, userId)` nigdy nie używa `userId` | komenda (2) |
| T3 | `canReadField`/`canWriteField` nigdy nie używają `userId`, decydują wyłącznie na `userRole` | komenda (3) |
| T4 | `StudioService.getDocument` miał dziś dokładnie ten sam kształt, już naprawiony | komenda (4) |
| T5 | `users.organization_id` — sprawdź czy to kolumna 1:1 czy relacja wiele-do-wielu | komenda (5) |
| T6 | Kształt 23 opisuje `StudioService` jako przypadek referencyjny | komenda (6) |
| T7 | Dyżury 246/247 mierzą inny wymiar (obecność w trasach, nie użycie w serwisach) | komenda (7) |
| T8 | Miejsce na dysku wystarcza | komenda (8) |

---

# 3. POZYCJE DYŻURU

## R0 — POTWIERDZENIE TRZECH ZNANYCH PRZYPADKÓW (rdzeń, warunek wejścia)

Wykonaj **wszystkie 8 komend** z `§0.1`. Dla `generateNudges` — ustal, czy `users.organization_id`
jest 1:1 (komenda (5)); zapisz wniosek TAK/NIE w raporcie z uzasadnieniem, czy brak `orgId` w
zapytaniu jest w tym konkretnym przypadku nieszkodliwy. Dla `canReadField`/`canWriteField` —
znajdź WSZYSTKICH wołających obu funkcji (`grep -rn "canReadField\|canWriteField" server/src`)
i ustal, skąd pochodzi argument `userRole` w KAŻDYM wywołaniu (z middleware sesji/JWT, czy
z ciała żądania kontrolowanego przez wołającego). To rozstrzyga, czy przypadek 3 jest dziurą, czy
tylko nieeleganckim, ale bezpiecznym kodem.

## R1 — REGENERACJA HEURYSTYCZNEJ LISTY KANDYDATÓW (rdzeń)

Powtórz heurystykę z `§1` na własnym SHA (metody z parametrem `userId`/`organizationId`/`orgId`
w sygnaturze, ciało z wywołaniem zapytania, parametr użyty ≤1 raz w oknie 60 linii). Porównaj
swoją liczbę z moją (82). Rozjazd jest oczekiwany (`Z24`) — Twoja lista jest wiążąca. Jeżeli chcesz
użyć mojej listy jako startu (bo Twoja regeneracja dała podobny rząd wielkości), oto ona —
`plik:linia`, nazwa funkcji, parametr niepewny:

```
server/src/services/integrationService.ts:127        getIntegrations              orgId
server/src/services/integrationService.ts:259        disconnectIntegration        userId
server/src/services/onboardingService.ts:117         initializeOnboarding         orgId
server/src/services/integrationHubService.ts:671     getIntegrationStats          organizationId
server/src/services/aiCostControlService.ts:431      getUserUsage                 organizationId, userId
server/src/services/settingsRegistryService.ts:474   readOrganizationSecuritySettings  orgId
server/src/services/dunningService.ts:548            getOrganization               orgId
server/src/services/RefreshTokenService.ts:205       _isOrganizationSuspended      organizationId
server/src/services/behaviorIntelligenceService.ts:138  getAdoptionMetrics         organizationId
server/src/services/changeSentimentService.ts:559    getCoachingActions            orgId
server/src/services/ActivityService.ts:187            getByOrganization             organizationId
server/src/services/automationRulesService.ts:378    deleteRule                    orgId
server/src/services/helpService.ts:434                getUserTickets                userId
server/src/services/integrationStatusService.ts:40    getHealthForOrg               orgId
server/src/services/triggerEvaluationService.ts:215   scanBudgetSignals             organizationId
server/src/services/financialModelingService.ts:1651  listModels                    orgId
server/src/services/presentationQualityGatesService.ts:149  loadOrgTemplateNames    organizationId
server/src/services/changeControlService.ts:112       emitChange                    orgId
server/src/services/TaskService.ts:249                 deleteTask                    userId
server/src/services/reportCadenceService.ts:127       findDueReports                orgId
server/src/services/analyticsService.ts:292            getDashboards                 orgId
server/src/services/transactionReadinessService.ts:338  getHistory                   orgId
server/src/services/smsService.ts:409                  getPhoneStatus                userId
server/src/services/organizationMetadataService.ts:52  deleteMetadata                orgId
server/src/services/budgetingService.ts:236             listBudgets                   orgId
server/src/services/BillingWebhookService.ts:381       dunningFailed                 orgId
server/src/services/BillingWebhookService.ts:404       getRecentEvents               organizationId
server/src/services/ratioAnalysisService.ts:1193       getBenchmarks                 organizationId
server/src/services/aiSettingsService.ts:516            getAvailableModels            orgId
server/src/services/financialAnalysisService.ts:539    approveAnalysis               orgId, userId
server/src/services/financialAnalysisService.ts:916    runFullAnalysis               orgId
server/src/services/financialAnalysisService.ts:979    computeLivePreview            orgId
server/src/services/ragLogicService.ts:512              computeR4Rag                  organizationId
server/src/services/feedbackAIService.ts:463            generateInsights              userId
server/src/services/aiBudgetService.ts:439              acknowledgeAlert              userId
server/src/services/interviewTranscriptService.ts:83   deleteMessages                organizationId
server/src/services/changeChampionsService.ts:130      removeChampion                organizationId
server/src/services/adminIamOperationsService.ts:191   getAdminIamJobMetrics         organizationId
server/src/services/securityService.ts:409              isIPAllowed                   orgId
server/src/services/frameworkEntitlementService.ts:25  checkAccess                   organizationId
server/src/services/frameworkEntitlementService.ts:111 revokeAccess                  organizationId
server/src/services/decisionService.ts:473              getPendingDecisions           orgId, userId
server/src/services/decisionService.ts:602              getProjectDecisions           orgId
server/src/services/riskDetectionService.ts:51          loadOrgAppetite               organizationId
server/src/services/v8/myWorkRoofService.ts:473        getCalendarPhases             organizationId
server/src/services/v8/promptOsRuntimeService.ts:273   listPresetsByOrganization     orgId
server/src/services/v8/replayDeadLetterService.ts:695  getExpiredResolvedRecords     orgId
server/src/services/v8/pmSyncTruthService.ts:889       listProviderCatalogStates     orgId
server/src/services/v8/operatorAdminService.ts:539     getSupportNotes               orgId
server/src/services/v8/operatorAdminService.ts:670     checkFleetHealthSignals       orgId
server/src/services/v8/reportsPresModelService.ts:1019 getTemplateUsageStats         organizationId
server/src/services/v8/planningContinuityService.ts:676  getPendingDecisions          organizationId
server/src/services/cqrs/project/queries/ListProjectsQuery.ts:5  constructor         organizationId
server/src/services/resultsVnext/roi/roiFinanceReconciliationCommands.ts:160  hasActiveExplicitFinanceOwnerGrant  userId
server/src/services/health/healthProbeService.ts:1129  getCachedResults              organizationId
server/src/services/content/FavoriteService.ts:128     isFavorited                   userId
server/src/services/executionControl/reportClassificationReadModel.ts:14  read       organizationId
server/src/services/executionControl/numericContributionReadModel.ts:49  read        organizationId
server/src/services/executionControl/governanceDataQualityReadModel.ts:20  read      organizationId
server/src/services/deliverables/deliverablesGenerationService.ts:115  getDeckRow    organizationId
server/src/services/ai/multimodalChunker.ts:248         persistChunk                  orgId
server/src/services/ai/enterpriseSecurity.ts:182        scanAndSanitize               orgId, userId
server/src/services/ai/deckVisualsService.ts:127        getOrgPolicy                  organizationId
server/src/services/ai/proactiveNudges.ts:189           suppressNudgeType             userId
server/src/services/ai/userStyleProfileService.ts:175   createProfile                 organizationId
server/src/services/ai/aiLearningService.ts:596         extractStylePatterns          userId
server/src/services/invitation/InvitationDataService.ts:99  markAsAccepted            userId
server/src/services/billing/BillingQueryService.ts:118  getBillingModel               orgId
server/src/services/ideaHandoff/ideaHandoffService.ts:150  loadTenantScopedIdea       organizationId
server/src/services/tablePlatform/SCIMService.ts:94      createUser                    organizationId
server/src/services/tablePlatform/SCIMService.ts:127    deactivateUser                userId
server/src/services/tablePlatform/TableContextService.ts:13  getTableContextForOrg   orgId
server/src/services/tablePlatform/ServiceAccountService.ts:95  listServiceAccounts   organizationId
server/src/services/tablePlatform/AutomationService.ts:505  getRunCounts              organizationId
```

(Trzy przypadki potwierdzone w `R0` — `proactiveNudges.ts:11`, `abTesting.ts:178`,
`FieldPermissionService.ts:34,52` — NIE są powtórzone w tej liście, są już przeczytane.)

## R2 — CZYTANIE KANDYDATÓW DO SQL, KLASYFIKACJA, EWENTUALNA WĄSKA NAPRAWA (rdzeń)

Dla KAŻDEGO kandydata: przeczytaj CAŁĄ funkcję (nie tylko okno 60 linii z heurystyki), znajdź
zapytanie SQL, sprawdź czy parametr niepewny (`orgId`/`userId`/`organizationId`) rzeczywiście
trafia do `WHERE`/tablicy parametrów. Klasyfikuj: **BEZPIECZNY** (parametr używany, albo scoping
przez inny parametr wystarcza — uzasadnij jak w przypadku `generateNudges`), **DZIURAWY**
(potwierdzony do SQL, brak jakiegokolwiek scope'owania), **NIEJEDNOZNACZNY** (wymaga dalszego
śledzenia wołających, opisz co dokładnie trzeba by sprawdzić). Cel: przeczytać **co najmniej
60-80** z 82 kandydatów (jeśli czasu zabraknie na wszystkie, rdzeniem jest przeczytanie jak
największej części, uczciwie opisanej — `§0.5`, „Robisz rdzeń i uczciwie opisujesz resztę jako
niezrobioną").

**Wąska naprawa (WYJĄTEK, nie reguła):** jeśli `R0` potwierdzi, że `canWriteField`/`canReadField`
są dziurawe (userRole pochodzi z niebezpiecznego źródła), WOLNO Ci naprawić WYŁĄCZNIE te dwie
funkcje — dodaj pobranie faktycznej roli użytkownika z bazy po `userId` i porównaj z przekazanym
`userRole` (albo usuń parametr `userRole` z sygnatury i pobieraj rolę wyłącznie z `userId` —
wybierz podejście minimalizujące zmianę kształtu odpowiedzi dla istniejących wołających, zgodnie
z regułą programu o niezmienianiu kształtu odpowiedzi). Dowód mutacyjny + para dowodowa jak
w dyżurze 245. W KAŻDYM innym przypadku — zgłaszasz, nie naprawiasz.

## R3 — RAPORT DYŻURU (rdzeń)

Streszczenie, `R0`-`R2` z pełnymi dowodami, tabela klasyfikacji wszystkich przeczytanych
kandydatów, jawne rozstrzygnięcie dla trzech przypadków referencyjnych, sekcja „TWIERDZENIA
NIEZWERYFIKOWANE" (obowiązkowa nawet pusta), sekcja „Korekty wobec instrukcji" (obowiązkowa nawet
pusta). Jeżeli podjąłeś się wąskiej naprawy — osobna sekcja z dowodem mutacyjnym w obie strony.

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (WARUNKOWO, tylko jeśli `R0` potwierdzi dziurę i podejmujesz wąską naprawę) | `server/src/services/tablePlatform/FieldPermissionService.ts` — WYŁĄCZNIE funkcje `canReadField`/`canWriteField` |
| Zapis (NOWE, testy, TYLKO przy naprawie) | `server/src/services/tablePlatform/__tests__/day249-fieldPermissionService.userScope.test.ts` |
| Zapis (WĄSKO, `J`) | `docs/program/funkcje/KSZTALT_23_SYGNATURA_BEZ_ZABEZPIECZENIA.md` — WYŁĄCZNIE nowa sekcja na końcu pliku |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY249_SYGNATURA_BEZ_OCHRONY_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/ai/proactiveNudges.ts` · `server/src/services/ai/abTesting.ts` · wszystkie 82 kandydatów z `§3 R1` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/StudioService.ts` — referencja naprawionego przypadku |
| Odczyt (ZAKAZ ZAPISU) | `server/migrations/*.sql` — WYŁĄCZNIE do sprawdzenia schematu `users.organization_id` |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` · każdy `MODULE_ACCEPTANCE.md` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **DOMYŚLNIE ZAKAZ NAPRAWY.** Jedyny wyjątek jest imiennie opisany w `POZYCJE_RDZENIA` i
  `ZAKAZ_WLASCIWY_TEMU_DYZUROWI` — wąska, jednoznaczna naprawa `FieldPermissionService`, TYLKO
  jeśli `R0` potwierdzi realne ryzyko.
- ★★ **NIE KAŻDY NIEUŻYTY PARAMETR JEST DZIURĄ.** Osądź, czy scoping przez inny parametr (np.
  `userId` samo w sobie) wystarcza — sprawdź schemat, nie zgaduj.
- ★★ **CZYTAJ CAŁĄ FUNKCJĘ, NIE TYLKO OKNO HEURYSTYKI.** 60 linii to przesiew, nie dowód —
  parametr może być użyty poza oknem.
- ★ **SZUKAJ RODZEŃSTWA.** `canReadField`/`canWriteField` to już znaleziona para — dla każdego
  innego kandydata sprawdź, czy plik ma podobne funkcje-siostry z tym samym kształtem.
- ★ **CEL 60-80 Z 82 KANDYDATÓW, NIE WSZYSTKIE ZA WSZELKĄ CENĘ.** Jeśli czasu zabraknie, rdzeniem
  jest przeczytać jak najwięcej i uczciwie opisać resztę jako niezrobioną.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.**
