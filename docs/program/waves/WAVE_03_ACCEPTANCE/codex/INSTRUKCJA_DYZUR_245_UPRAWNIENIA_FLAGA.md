# INSTRUKCJA DYŻURU nr 245 — Codex — „★★ UPRAWNIENIA — TRZY DZIURY WYGASZONE FLAGĄ `mountStub`, WCIĄŻ ŻYWE KODOWO NA KAŻDYM ŚRODOWISKU POZA DEMO/PRODUKCJĄ. Zweryfikowane bezpośrednio w kodzie na SHA `818e9cec0b` (świeższy niż marker `df7f13056f`, marker JEST jego przodkiem — `git merge-base --is-ancestor` potwierdza): `PUT /api/permission-requests/:id/approve` (`server/src/routes/permissionRequests.routes.ts:67-83`) i `PUT /:id/reject` (`:85-102`) nadal wykonują `UPDATE permission_requests SET status=... WHERE id = ? AND status = 'pending'` BEZ `organization_id` w zapytaniu, mimo że `GET /` (`:19-39`) i `POST /` (`:41-65`) tego samego pliku poprawnie go używają; `DELETE /api/videos/:id` (`server/src/routes/videos.routes.ts:56-63`) nadal wykonuje `DELETE FROM videos WHERE id = ?` bez `organization_id`, mimo że `GET`/`POST` tego pliku (`:16-52`) go używają; `PUT /api/context/:id` (`server/src/routes/context.routes.ts:66-114`) i `DELETE /api/context/:id` (`:116-124`) nadal wykonują `UPDATE`/`DELETE FROM ai_contexts WHERE id = ?` bez `organization_id` — na `PUT` zmienna `orgId` jest wręcz POBRANA (linia 72) i użyta wyłącznie do zapisu logu kontekstu (`recordManualAIContext`, linia 98-111), NIGDY do samego `WHERE` zapytania `UPDATE` (linia 94) — to jest dokładnie kształt 23 (`docs/program/funkcje/KSZTALT_23_SYGNATURA_BEZ_ZABEZPIECZENIA.md`), sygnatura sugeruje kontrolę, kontroli nie ma. ★★ TEN SAM DOKŁADNIE ZAKRES JEST JUŻ OPISANY W WYDANEJ INSTRUKCJI DYŻURU 242 (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_242_UPRAWNIENIA.md`) — na SHA `818e9cec0b` naprawa z 242 JESZCZE NIE WYLĄDOWAŁA w kodzie (zweryfikowane grepem na wszystkich trzech plikach, zero wystąpień ownership-check). `R0` tego dyżuru sprawdza to jako PIERWSZĄ czynność, PRZED jakąkolwiek zmianą, i rozstrzyga, czy naprawiasz, czy tylko niezależnie weryfikujesz."

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
> **wyłącznie** `/private/tmp/cx-day245-uprawnienia-flaga`.

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
Zakres: ****PRZEKROJOWE — IZOLACJA ORGANIZACJI, trzy trasy wygaszone flagą `mountStub`/`ENABLE_STUB_ROUTES` na demo, ale ŻYWE kodowo na każdym innym środowisku (`server/src/routes/**`).** Naprawa (lub, jeśli już naprawione przez równoległy tor, NIEZALEŻNA weryfikacja z własnym dowodem mutacyjnym) trzech rodzin: Permission Requests approve/reject, Videos DELETE, AI Context PUT+DELETE (DWIE trasy, nie jedna — audyt źródłowy zgłosił tylko `DELETE`).**.
Trasy front: `brak w zakresie ZAPISU tego dyżuru — sprawdź samodzielnie w `R0`, czy istnieje żywy konsument w `src/` dla `/api/permission-requests`, `/api/videos`, `/api/context` (szukaj wołających w `src/services/api.ts` i `src/components/**`), i wpisz wynik do raportu jako fakt zmierzony, nie założenie. Nie zmieniasz frontu w żadnym wariancie`. Trasy tył: ``server/src/routes/permissionRequests.routes.ts` (naprawiane, jeśli wciąż otwarte: `:67-102`) · `server/src/routes/videos.routes.ts` (naprawiane, jeśli wciąż otwarte: `:56-63`) · `server/src/routes/context.routes.ts` (naprawiane, jeśli wciąż otwarte: `:66-124`) · wzorzec do powielenia: `server/src/routes/pmo/project-members.routes.ts:55-90` (`projectBelongsToOrg`) · `server/src/services/StudioService.ts:104-129` (inline check) · `server/src/services/escalationService.ts:160-208` (`projectBelongsToOrg`) · `server/src/routes/table-platform.routes.ts:2839,2851,2869` (`requireFormAccess`) · montaż: `server/src/Gateway.ts:920` (`permission-requests`), `:1070` (`context`), oraz Twoje własne `grep -n "mountStub('/api/videos'" server/src/Gateway.ts` w `R0``.

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
WT=/private/tmp/cx-day245-uprawnienia-flaga
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
git -C "$VAULT" worktree add "$WT" -b codex/day245-uprawnienia-flaga-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day245-uprawnienia-flaga/config.worktree"
cat "$VAULT/worktrees/cx-day245-uprawnienia-flaga/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day245-uprawnienia-flaga-scratch
mkdir -p /private/tmp/cx-day245-uprawnienia-flaga-artefakty

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
git -C "$WT" push github-backup codex/day245-uprawnienia-flaga-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only df7f13056f..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: dyzur 242 (identyczny zakres) JESZCZE NIE wyladowal w kodzie na Twoim SHA
grep -n "organization_id" server/src/routes/permissionRequests.routes.ts
grep -n "organization_id" server/src/routes/videos.routes.ts | grep -i delete -A2 -B2
sed -n '60,125p' server/src/routes/context.routes.ts
#   oczekiwane: PUT approve/reject w permissionRequests NADAL bez organization_id;
#   DELETE w videos NADAL bez organization_id; PUT+DELETE w context NADAL bez
#   organization_id w zapytaniu (PUT MOZE miec 'orgId' w zmiennej, ale nie w WHERE).
#   Jesli KTOREKOLWIEK z trzech JUZ MA ownership-check — dyzur 242 wyladowal
#   czesciowo/w calosci PRZED Twoim startem: zapisz to w "Korektach" i pomin R1
#   dla tej pozycji, przejdz od razu do R2 (niezalezna regresja) dla niej

# (2) TEZA: trzy dziury naprawione WCZESNIEJ (Project Members, Studio, Escalations)
#     sa JUZ naprawione i pozostaja naprawione na Twoim SHA
grep -n "projectBelongsToOrg" server/src/routes/pmo/project-members.routes.ts
grep -n "organization_id !== organizationId" server/src/services/StudioService.ts
grep -n "projectBelongsToOrg" server/src/services/escalationService.ts
#   oczekiwane: trafienia we wszystkich trzech — to Twoj wzorzec do skopiowania

# (3) TEZA: kolumna organization_id istnieje w schemacie wszystkich trzech tabel
grep -n "organization_id" server/migrations/794_permission_requests_00base.sql
grep -rn "CREATE TABLE videos\|organization_id" server/migrations/*.sql | grep -i videos | head -3
grep -rn "ai_contexts" server/migrations/*.sql | grep -i organization_id | head -3
#   oczekiwane: kolumna istnieje wszedzie — naprawa (jesli potrzebna) nie wymaga migracji

# (4) TEZA: trzy trasy montowane przez mountStub — wygaszone na demo, zywe kodowo indziej
grep -n "mountStub('/api/permission-requests'\|mountStub('/api/videos'\|mountStub('/api/context'" server/src/Gateway.ts
sed -n '483,517p' server/src/Gateway.ts
#   oczekiwane: wszystkie trzy przez mountStub(); 'contextRoutes' na liscie
#   STUB_NAMES_WITH_LIVE_UI_ON_DEMO (501 na demo), pozostale dwie nie (404 na demo)

# (5) TEZA: wzorzec requireFormAccess z table-platform.routes.ts gotowy do skopiowania
sed -n '2830,2875p' server/src/routes/table-platform.routes.ts
#   oczekiwane: middleware sprawdza wlasciciela PRZED handlerem, zwraca 404

# (6) TEZA: zaden z trzech plikow nie ma dzis wlasnego testu izolacji organizacji
#     pod nazwa day245-* ani day242-*
find server/src/routes/__tests__ -iname "day24*-permission-request*" -o -iname "day24*-videos*org*" -o -iname "day24*-context*org*" 2>/dev/null
#   oczekiwane: zero plikow — jesli day242-* juz istnieja (naprawa 242 wyladowala
#   razem z testami), Twoje pliki naprawy R1 sa zbedne, ale R2 (regresja) nadal
#   tworzysz pod nazwa day245-*, jako niezalezna, DRUGA para dowodowa

# (7) TEZA: front nie ma zywego konsumenta tych trzech tras (opisz stan, nie zakladaj)
grep -rn "permission-requests\|/api/videos\|/api/context" src/services/api.ts src/components --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v __tests__ | head -20
#   oczekiwane: wpisz w raporcie DOKLADNIE co znalazles — brak wolacza jest
#   rownie wazna informacja jak jego obecnosc

# (8) TEZA: dyzur 242 (jesli jego branch istnieje na github-backup) mial identyczny
#     zakres — porownaj tresc, nie polegaj na pamieci
git -C "$VAULT" branch -r --list 'github-backup/codex/day242-*' 2>/dev/null
#   oczekiwane: albo istnieje gotowa galaz 242 do porownania (git diff), albo nie
#   istnieje jeszcze — oba wyniki sa OK, zapisz ktory

# (9) TEZA: miejsce na dysku wystarcza
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day245-uprawnienia-flaga-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6230`. Twój JEDYNY port harnessu to `5210 i 5211`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day245-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6229, 5010-5209, 6404-6411, 6600-6830 (ten przedział obejmuje też dyżury 242 baza 6221/harness 5196-97, 243 baza 6223/harness 5198-99, 244 baza 6225/harness 5200-01 — nie licz ich osobno, mieszczą się w przedziale). Twoje własne: baza 6230, harness 5210 i 5211. Cudze — siostrzane dyżury TEJ SAMEJ paczki (245-249, wydane 2026-09-01), nie dotykasz: baza 6232/harness 5212-13 (dyżur 246 Domiar Audytu), baza 6234/harness 5214-15 (dyżur 247 Próbka Naprawione), baza 6236/harness 5216-17 (dyżur 248 Martwe Bliźniaki), baza 6238/harness 5218-19 (dyżur 249 Sygnatura Bez Zabezpieczenia). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. `Z10` obowiązuje bez wyjątku. W szczególności: **ZAKAZ zmiany `ENABLE_STUB_ROUTES`, `mountStub`, `STUB_NAMES_WITH_LIVE_UI_ON_DEMO`** (`Gateway.ts:485-516`) w jakąkolwiek stronę — naprawiasz dziurę POD spodem, nie zmieniasz, czy trasa jest zamontowana na demo. To dwa niezależne mechanizmy (maskowanie ≠ naprawa) i mylenie ich było już raz błędem w tym programie (patrz audyt źródłowy, sekcja „PUŁAPKA").`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/admin.middleware.ts` · `server/src/middleware/rbac.middleware.ts` · `server/src/middleware/effectiveCapability.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY245_UPRAWNIENIA_FLAGA_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć, to jeden nowy wpis (nie edycja istniejących wierszy) w rejestrze dowodowym `docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` — WYŁĄCZNIE nowa sekcja na końcu pliku „## Dzień 245 — stan wobec dyżuru 242 i niezależna weryfikacja” ze zmierzonym stanem z `R0`-`R2`, każde zdanie z dowodem `plik:linia` albo kodem odpowiedzi HTTP. Zakaz kasowania, nadpisywania lub przepisywania istniejącej treści tego pliku. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day245-uprawnienia-flaga-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day245-uprawnienia-flaga-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ dotykania trzech JUŻ naprawionych plików poza odczytem** (`pmo/project-members.routes.ts`, `StudioService.ts`, `escalationService.ts`) — służą WYŁĄCZNIE jako wzorzec, weryfikujesz ich stan w `R0`, nie zmieniasz ani linii. **ZAKAZ zmiany `mountStub`/`ENABLE_STUB_ROUTES`/`STUB_NAMES_WITH_LIVE_UI_ON_DEMO`** w `Gateway.ts`. **ZAKAZ rozszerzania zakresu poza trzy imiennie wskazane pliki** (`permissionRequests.routes.ts`, `videos.routes.ts`, `context.routes.ts`) — jeśli przy okazji zauważysz CZWARTĄ żywą dziurę tej klasy, opisujesz ją w raporcie z dowodem `plik:linia`, ale NIE naprawiasz jej tutaj (to pozycja dla dyżuru 246/247/249, nie scope creep tego). **ZAKAZ zwracania `403` zamiast `404`** przy niezgodności organizacji — konwencja tego repo to `404`. **ZAKAZ tworzenia plików testowych `day242-*`** — jeśli 242 już je stworzył, Twoje pliki muszą nosić prefiks `day245-*`, żeby uniknąć kolizji nazw przy scaleniu (nie jest to naruszenie rozłączności, bo to inna gałąź, ale nadzorca scala oba tory i dwa pliki o identycznej nazwie w dwóch gałęziach to konflikt scalania, którego łatwo uniknąć nazwą). | Audyt z 2026-09-01 (`docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md`) znalazł sześć dziur tej klasy; trzy (PMO Project Members, Studio, Notifications Escalations) są dziś ZWERYFIKOWANE jako naprawione bezpośrednio w kodzie na SHA `818e9cec0b` — `projectBelongsToOrg`/inline-check obecne i wołane we wszystkich mutujących handlerach. Pozostałe trzy (Permission Requests, Videos, Context) są dziś WCIĄŻ dziurawe kodowo — sprawdzone bezpośrednio, nie na podstawie samego audytu. Instrukcja dyżuru 242, wydana tego samego dnia, ma dokładnie ten sam zakres naprawy, ale na SHA `818e9cec0b` jej praca NIE WYLĄDOWAŁA jeszcze w kodzie (dyżury tego programu są instrukcjami do wykonania później, nie raportami wykonania — wydanie ≠ wykonanie). Ten dyżur istnieje jako niezależna, samodzielna ścieżka do tego samego celu: jeżeli 242 wyląduje pierwszy, `R0` to wykrywa i ten dyżur przechodzi do NIEZALEŻNEJ weryfikacji z własnym dowodem mutacyjnym (wartość: druga, niezależna para oczu na krytycznej ścieżce bezpieczeństwa) zamiast zduplikowanej naprawy; jeżeli 242 nie wylądował, ten dyżur naprawia sam, tym samym sprawdzonym wzorcem. |

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
cd /private/tmp/cx-day245-uprawnienia-flaga

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day245-pg psql -U postgres -d cx245 \
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
cd /private/tmp/cx-day245-uprawnienia-flaga

docker run -d --name cx-day245-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx245 \
  -p 127.0.0.1:6230:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day245-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6230/cx245 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6230/cx245 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day245-uprawnienia-flaga && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6230/cx245 \
JWT_SECRET=cx245-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__/day245-permission-requests-org-isolation.realpg.test.ts server/src/routes/__tests__/day245-videos-org-isolation.realpg.test.ts server/src/routes/__tests__/day245-context-org-isolation.realpg.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day245-uprawnienia-flaga-artefakty/day245-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day245-uprawnienia-flaga && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__/day245-permission-requests-org-isolation.realpg.test.ts server/src/routes/__tests__/day245-videos-org-isolation.realpg.test.ts server/src/routes/__tests__/day245-context-org-isolation.realpg.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day245-uprawnienia-flaga-artefakty/day245-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day245-uprawnienia-flaga/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day245-pg psql -U postgres -d cx245 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day245-pg`.
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
> **(e) ★★ ISTNIEJĄCY PLIK WZORCOWY `tests/integration/uprawnienia-trzy-zywe.idor.realdb.test.ts` (wskazany jako wzorzec w zleceniu) MONTUJE ROUTER W GOŁYM `express()` (`import express from 'express'; ... app.use('/api/...', someRoutes)`), NIE PRZEZ `ApiGateway.getInstance().initializeRoutes(app)`. To NARUSZA `Z22` dla NOWYCH testów tego dyżuru („test wstrzykujący zależności albo montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej"). **Możesz czytać ten plik jako wzorzec stylu asercji i budowy danych testowych (dwie organizacje przez realny `POST /api/auth/register`, JWT, readback SQL), ale Twoje WŁASNE nowe testy MUSZĄ montować przez `ApiGateway.getInstance().initializeRoutes(app)`** — dokładnie jak zrobił to dyżur 242 we własnej specyfikacji (patrz `body242`, teraz część tej instrukcji w `§3`). Druga pułapka: w `context.routes.ts` PUT (linia 72) zmienna `orgId` JEST pobrana i UŻYTA — tylko nie w zapytaniu SQL, tylko w wywołaniu `recordManualAIContext` (linia 98-111). Nie daj się zwieść: obecność `orgId` w funkcji NIE jest dowodem kontroli (kształt 23) — dowodem jest jego obecność w klauzuli `WHERE`/tablicy `params` zapytania `UPDATE` (linia 94), gdzie go nie ma.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day245-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day245-uprawnienia-flaga-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (dedup — stan wobec dyżuru 242, warunek wejścia) · R1 (naprawa trzech dziur, TYLKO te wciąż otwarte na Twoim SHA) · R2 (niezależna regresja testowa dla WSZYSTKICH trzech, niezależnie od tego, kto naprawił) · R3 (raport)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6230` albo `5210 i 5211` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6230` albo `5210 i 5211`** (`Z7`).

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

Audyt z 2026-09-01 (`docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md`) znalazł **sześć**
rodzin tras z tym samym brakiem: obca organizacja mogła zmienić lub skasować cudze dane bez
żadnej kontroli `organization_id`. Trzy (PMO Project Members, Consultify Studio, Notifications
Escalations) są **żywe bezwarunkowo na demo/produkcji** i **na SHA `818e9cec0b` już naprawione**
(zweryfikowane bezpośrednio w kodzie, nie na słowo audytu — patrz `R0`). Trzy pozostałe
(Permission Requests, Videos, AI Context) są **wygaszone na demo/produkcji przez
`mountStub`/`ENABLE_STUB_ROUTES`, ale żywe kodowo na każdym innym środowisku** (dev lokalny, CI,
staging bez `NODE_ENV=production`, albo natychmiast po jednym flipie zmiennej na Railway) — i na
SHA `818e9cec0b` **nadal dziurawe**.

## ★★ Ten sam zakres jest już opisany w wydanej instrukcji dyżuru 242

`docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_242_UPRAWNIENIA.md`, wydana tego
samego dnia, ma **dokładnie ten sam cel naprawy**: te same trzy pliki, ten sam wzorzec
(`ownership-check` przed handlerem, `404` przy niezgodności). Na SHA `818e9cec0b` — świeższym niż
marker obu instrukcji `df7f13056f` — **praca dyżuru 242 jeszcze nie wylądowała w kodzie**:
zero wystąpień jakiegokolwiek ownership-check w żadnym z trzech plików. To NIE jest sprzeczność
ani błąd planowania — instrukcje dyżurów w tym programie są **poleceniami do wykonania później**,
nie raportami wykonania; „wydana" znaczy „gotowa do podjęcia przez wykonawcę", nie „zrobiona".

**Dlatego ten dyżur ma podwójny cel, rozstrzygany przez `R0` jako pierwszą czynność:**

1. Jeżeli na Twoim własnym `git rev-parse HEAD` żadna z trzech dziur nie jest naprawiona (najbardziej
   prawdopodobny stan, bo 242 mógł jeszcze nie zostać podjęty) — **naprawiasz sam, tym samym
   wzorcem**, dokładnie jak zrobiłby to wykonawca 242.
2. Jeżeli KTÓRAŚ już jest naprawiona (bo 242 albo inny tor zdążył wylądować między wydaniem tej
   instrukcji a Twoim startem) — **nie duplikujesz naprawy**. Zamiast tego dostarczasz **niezależną
   regresję testową** (`R2`) — druga, niezależna para oczu na krytycznej ścieżce bezpieczeństwa jest
   wartością samą w sobie, nie marnotrawstwem. Zapisujesz fakt i dowód w „Korektach wobec instrukcji".

## Trzy dziury — stan zmierzony na SHA `818e9cec0b`

### 1. Permission Requests — zatwierdzanie/odrzucanie cudzych wniosków o uprawnienia

`server/src/routes/permissionRequests.routes.ts`. `GET /` (linia 19-39) i `POST /` (linia 41-65)
**poprawnie** filtrują/zapisują `organization_id`. `PUT /:id/approve` (linia 67-83) i
`PUT /:id/reject` (linia 85-102) wykonują:

```ts
await dbRun(`
  UPDATE permission_requests SET status = 'approved', resolved_by = ?, resolved_at = datetime('now')
  WHERE id = ? AND status = 'pending'
`, [userId, id]);
```

Zero porównania z `organization_id`. Kolumna istnieje i jest indeksowana
(`server/migrations/794_permission_requests_00base.sql:4,20`). Skutek: dowolny administrator
DOWOLNEJ organizacji, znający albo zgadujący `id` wniosku, może zatwierdzić lub odrzucić wniosek
o podniesienie uprawnień złożony przez pracownika **innej firmy**.

### 2. Videos — kasowanie cudzego materiału wideo

`server/src/routes/videos.routes.ts:56-63`:

```ts
router.delete('/:id', verifyToken, isAuthenticated, asyncHandler(async (req, res) => {
  await dbRun('DELETE FROM videos WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));
```

`GET`/`POST` tego samego pliku (linie 16-52) filtrują/zapisują `organization_id` poprawnie.
Zero warunku poza `id` na `DELETE`. Dowolny uwierzytelniony użytkownik może trwale skasować wideo
dowolnej organizacji, znając samo `id`.

### 3. AI Context — nadpisywanie I kasowanie cudzego kontekstu (★ druga trasa, nie tylko jedna)

`server/src/routes/context.routes.ts`. `GET /` (linia 18-35) filtruje poprawnie po
`(user_id = ? OR organization_id = ?)`. Audyt źródłowy zgłosił jako dziurawą wyłącznie
`DELETE /:id` (linia 116-124). **Sprawdzenie tego samego pliku pod kątem reguły „zgłoszona pozycja
jest próbką rodziny" znalazło DRUGĄ trasę o identycznym kształcie: `PUT /:id`** (linia 66-114) —
i ta trasa jest szczególnie pouczająca, bo to **żywy przykład kształtu 23**
(`docs/program/funkcje/KSZTALT_23_SYGNATURA_BEZ_ZABEZPIECZENIA.md`, „sygnatura zabezpieczenia bez
zabezpieczenia"):

```ts
router.put('/:id', verifyToken, isAuthenticated, asyncHandler(async (req, res) => {
  const id = ...;
  const orgId = req.user?.organizationId;              // ← POBRANE (linia 72)
  // ...buduje `updates`/`params` z ciała żądania...
  await dbRun(`UPDATE ai_contexts SET ${updates.join(', ')} WHERE id = ?`, params);   // ← linia 94, orgId NIEUŻYTE tutaj
  const row = await dbGet(`SELECT ... FROM ai_contexts WHERE id = ?`, [id]);
  if (orgId && row) {
    await organizationContextService.recordManualAIContext({ organizationId: orgId, ... }); // ← orgId uzyte TYLKO tutaj, do logu
  }
  res.json({ success: true });
}));
```

`orgId` jest pobrane i UŻYTE — ale wyłącznie w wywołaniu logującym `recordManualAIContext`
(linia 98-111), **nigdy w klauzuli `WHERE` samego `UPDATE`** (linia 94). Obecność zmiennej `orgId`
w funkcji NIE jest dowodem kontroli dostępu — dowodem jest jej obecność w warunku zapytania.
Skutek: dowolny uwierzytelniony użytkownik może nadpisać treść, nazwę, priorytet i status
aktywności CUDZEGO kontekstu AI.

## Czego ten dyżur świadomie NIE robi

- **Nie dotyka trzech już naprawionych plików** (Project Members, Studio, Escalations) poza
  odczytem weryfikacyjnym w `R0` — służą wyłącznie jako wzorzec.
- **Nie zmienia mechanizmu `mountStub`/`ENABLE_STUB_ROUTES`** — to osobny wymiar (widoczność na
  danym środowisku) od kontroli dostępu wewnątrz handlera.
- **Nie próbuje domknąć ~168 nieprzeczytanych kandydatów ani próbki 290 „już naprawionych".** To
  zakres dyżurów 246/247, nie tego.
- **Nie zmienia zachowania na `403`.** Konwencja tego repo, użyta konsekwentnie w naprawach tej
  klasy dziś, to `404` — nie ujawniać istnienia cudzego obiektu.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Dyżur 242 (identyczny zakres) NIE wylądował jeszcze w kodzie na SHA `818e9cec0b` | komenda (1) |
| T2 | Trzy dziury naprawione wcześniej dziś (Project Members, Studio, Escalations) są nadal naprawione | komenda (2) |
| T3 | Kolumna `organization_id` istnieje w schemacie wszystkich trzech tabel — naprawa nie wymaga migracji | komenda (3) |
| T4 | Wszystkie trzy trasy montowane przez `mountStub()` — wygaszone na demo, żywe kodowo indziej | komenda (4) |
| T5 | Wzorzec `requireFormAccess` z `table-platform.routes.ts` jest gotowy do powielenia | komenda (5) |
| T6 | Żaden z trzech plików nie ma dziś testu izolacji organizacji pod nazwą `day242-*` ani `day245-*` | komenda (6) |
| T7 | Front nie ma dziś (albo ma) żywego konsumenta tych trzech tras — do zmierzenia, nie założenia | komenda (7) |
| T8 | Gałąź dyżuru 242 istnieje (lub nie) na `github-backup` w chwili Twojego startu | komenda (8) |
| T9 | Miejsce na dysku wystarcza | komenda (9) |

---

# 3. POZYCJE DYŻURU

## R0 — DEDUPLIKACJA WOBEC DYŻURU 242 (rdzeń, warunek wejścia)

Wykonaj **wszystkie 9 komend** z `§0.1`. Dla KAŻDEJ z trzech dziur osobno rozstrzygnij: **otwarta
na moim SHA** (idzie do `R1`) albo **już naprawiona** (pomijasz `R1` dla niej, idzie od razu do
`R2`). Zapisz rozstrzygnięcie per dziura w raporcie, z cytatem `plik:linia` jako dowodem. Jeżeli
WSZYSTKIE trzy okażą się już naprawione — to jest **SUKCES tego dyżuru**, nie porażka: `R1` staje
się pusty, a `R2` (niezależna regresja) i tak dostarcza wartość.

## R1 — NAPRAWA DZIUR WCIĄŻ OTWARTYCH (rdzeń, warunkowy)

Dla KAŻDEJ pozycji, którą `R0` zaklasyfikował jako otwartą — wzorując się dosłownie na
`server/src/routes/pmo/project-members.routes.ts:55-90` (`projectBelongsToOrg`; nazwij funkcję
analogicznie: `permissionRequestBelongsToOrg`, `videoBelongsToOrg`, `contextBelongsToOrg` — jedna
funkcja pomocnicza na plik, wołana we WSZYSTKICH mutujących handlerach tego pliku, nie tylko
w jednym):

1. **Ownership-check PRZED zapytaniem mutującym.** `SELECT organization_id FROM <tabela> WHERE
   id = ?`, porównaj z `req.user?.organizationId`. Brak wiersza albo niezgodność → `404`
   (dopasuj kształt JSON do istniejących błędów w tym samym pliku), zero wykonania UPDATE/DELETE.
2. **Dla `context.routes.ts` PUT: napraw OBIE trasy pliku razem** (`PUT` i `DELETE`) w jednym
   commicie tego pliku — nie łataj jednej, zostawiając drugą, to dokładnie błąd, który złapał
   audyt źródłowy.
3. Push po każdej pozycji (`Z34a`).

## R2 — NIEZALEŻNA REGRESJA TESTOWA DLA WSZYSTKICH TRZECH (rdzeń, zawsze wykonywany)

Niezależnie od wyniku `R0`/`R1` — nawet jeśli wszystkie trzy były już naprawione przez inny tor —
tworzysz **nowy plik testowy per pozycja** (`day245-*`, `Z18` zabrania dotykania istniejącej
infrastruktury testowej, ale NOWE pliki są dozwolone i wymagane):

1. Dwie organizacje przez realny `POST /api/auth/register`, podpisane JWT, realny
   `ApiGateway.getInstance().initializeRoutes(app)` (`Z22` — **NIE** goły `express()`, patrz
   pułapka w `§0.2e` (e) tej instrukcji), realny Postgres (`Z25`/`Z26`), `--retry=0` (`Z29`).
2. **Para dowodowa obowiązkowa:** obca organizacja NIE MOŻE (żądanie zwraca `404`, readback SQL
   pokazuje wiersz BEZ zmiany/nadal istniejący) + właścicielska organizacja NADAL MOŻE (to samo
   żądanie z prawidłowym tokenem przechodzi, readback pokazuje zmianę/usunięcie).
3. **Dowód mutacyjny w obie strony** (`Z32`): jeśli naprawiłeś w `R1` — komentujesz swój
   ownership-check → test „obca organizacja nie może" CZERWONY; przywracasz (`cp`, `Z27`) →
   ZIELONY, `git diff` pusty. Jeśli fix już istniał od 242 — ten sam eksperyment na CUDZYM
   fixie: komentujesz JEGO ownership-check → CZERWONY; przywracasz → ZIELONY. Oba wyniki
   dosłownie w raporcie w obu przypadkach.
4. Push po każdej pozycji.

## R3 — RAPORT DYŻURU (rdzeń)

Streszczenie, `R0`-`R2` z pełnymi dowodami, jawne rozstrzygnięcie per dziura (naprawiona przeze
mnie / już naprawiona przez 242, potwierdzona niezależnie), sekcja „TWIERDZENIA NIEZWERYFIKOWANE"
(obowiązkowa nawet pusta), sekcja „Korekty wobec instrukcji" (obowiązkowa nawet pusta). Pełne
wyjścia komend z `§0` i `R0`-`R2`, ścieżki artefaktów w `/private/tmp/cx-day245-uprawnienia-flaga-artefakty` z `shasum -a 256`.

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (naprawa, `R1`, WARUNKOWO — tylko pozycje otwarte na Twoim SHA) | `server/src/routes/permissionRequests.routes.ts` · `server/src/routes/videos.routes.ts` · `server/src/routes/context.routes.ts` — WYŁĄCZNIE dodanie ownership-check przed mutującymi handlerami, zero innych zmian |
| Zapis (NOWE, testy dowodowe `R2`, ZAWSZE) | `server/src/routes/__tests__/day245-permission-requests-org-isolation.realpg.test.ts` · `server/src/routes/__tests__/day245-videos-org-isolation.realpg.test.ts` · `server/src/routes/__tests__/day245-context-org-isolation.realpg.test.ts` (nowe pliki, `git add -f` jeśli katalog ignorowany) |
| Zapis (WĄSKO, `J`) | `docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` — WYŁĄCZNIE nowa sekcja na końcu pliku |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY245_UPRAWNIENIA_FLAGA_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/pmo/project-members.routes.ts` · `server/src/services/StudioService.ts` · `server/src/services/escalationService.ts` — wzorzec |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/table-platform.routes.ts` (referencja `requireFormAccess`) · `server/src/services/tablePlatform/PermissionsService.ts` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/Gateway.ts` — WYŁĄCZNIE odczyt `mountStub`/`STUB_NAMES_WITH_LIVE_UI_ON_DEMO`, zero zmian |
| Odczyt (ZAKAZ ZAPISU) | `tests/integration/uprawnienia-trzy-zywe.idor.realdb.test.ts` (wzorzec stylu, patrz pułapka `Z22` w `§0`) · `tests/integration/table-platform.idor.realdb.test.ts` |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` · każdy `MODULE_ACCEPTANCE.md` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **`R0` JEST WARUNKIEM WEJŚCIA DO `R1`, NIE FORMALNOŚCIĄ.** Ten dyżur ma zidentyczny zakres do
  wydanej instrukcji 242 — dedup jest rdzeniem, nie procedurą do odhaczenia.
- ★★ **NAWET GDY WSZYSTKO JUŻ NAPRAWIONE, `R2` JEST OBOWIĄZKOWY.** Niezależna regresja testowa nie
  jest zbędna, gdy fix już istnieje — jest **drugim, niezależnym dowodem**, że fix jest poprawny.
- ★★ **JEDNA FUNKCJA POMOCNICZA NA PLIK, WOŁANA WE WSZYSTKICH MUTUJĄCYCH HANDLERACH TEGO PLIKU.**
  `context.routes.ts` ma DWIE trasy z tym samym brakiem (`PUT` i `DELETE`) — napraw obie razem.
- ★★ **DOWÓD ZAPISU: PORÓWNANIE WARTOŚCI PO PONOWNYM ODCZYCIE, NIE KOD HTTP.** `404` na żądaniu
  obcej organizacji jest połową dowodu. Druga połowa: `SELECT` bezpośrednio z bazy pokazujący, że
  wiersz NIE zmienił się (approve/reject/PUT) albo NADAL istnieje (DELETE).
- ★★ **PARA DOWODOWA OBOWIĄZKOWA: „OBCY NIE MOŻE" + „WŁAŚCICIEL NADAL MOŻE".** Sama odmowa dla
  wszystkich jest też „zielona" — a znaczy, że naprawa zepsuła funkcję właścicielom.
- ★ **`--retry=0` OBOWIĄZKOWE** (`Z29`) na wszystkich trzech nowych pakietach.
- ★ **PUŁAPKI ŚRODOWISKA:** `Database.ts:80-88` cicho podstawia atrapę bazy bez `RUN_DB_TESTS=1`;
  `Database.ts:686` atrapa zwraca `changes:1` dla KAŻDEGO `UPDATE` niezależnie od `WHERE` — to
  unieważniłoby cały dowód mutacyjny, MUSISZ być na realnym Postgresie; `vitest.config.ts:210`
  przypina `DB_TYPE='sqlite'`; `tests/setup.ts:896` podmienia `global.fetch`.
- ★ **`Z13`/`J`:** logi i pliki wynikowe NIE wchodzą do repo — leżą w `/private/tmp/cx-day245-uprawnienia-flaga-artefakty`, raport
  podaje ścieżki i `shasum -a 256`.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.**
