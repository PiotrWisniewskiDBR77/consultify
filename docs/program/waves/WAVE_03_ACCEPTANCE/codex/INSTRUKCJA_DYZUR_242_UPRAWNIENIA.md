# INSTRUKCJA DYŻURU nr 242 — Codex — „★★ UPRAWNIENIA — TRZY (NIE SZEŚĆ) ŻYWE DZIURY IDOR DZIŚ, WZORZEC NAPRAWY JUŻ CZTERY RAZY UŻYTY W TYM REPO. Zweryfikowane bezpośrednio w kodzie na SHA `df7f13056f` (nie z cudzego audytu): `PUT /api/permission-requests/:id/approve` i `/:id/reject` (`server/src/routes/permissionRequests.routes.ts:67-102`, `UPDATE permission_requests SET status=... WHERE id = ? AND status = 'pending'`, ZERO porównania z `organization_id` wołającego mimo że kolumna istnieje i jest indeksowana — `server/migrations/794_permission_requests_00base.sql:4,20`) pozwala dowolnemu adminowi zatwierdzić/odrzucić wniosek o uprawnienia złożony w CUDZEJ organizacji; `DELETE /api/videos/:id` (`server/src/routes/videos.routes.ts:56-63`, `DELETE FROM videos WHERE id = ?`) pozwala skasować cudze wideo; `PUT /api/context/:id` ORAZ `DELETE /api/context/:id` (`server/src/routes/context.routes.ts:65-113,116-123`, dwie trasy, nie jedna jak podawał wczorajszy audyt — `UPDATE`/`DELETE FROM ai_contexts WHERE id = ?`) pozwalają nadpisać i skasować cudzy kontekst AI. Wzorzec naprawy (dodanie ownership-check przed handlerem, zwrot `404` nie `403`) jest już CZTERY razy zastosowany w tym repo dziś (`table-platform.routes.ts:2839` `requireFormAccess`, `pmo/project-members.routes.ts:52-67` `projectBelongsToOrg`, `services/StudioService.ts:122-123` inline check, `services/escalationService.ts:169-177` `projectBelongsToOrg`) — to jest PIĄTE, SZÓSTE i SIÓDME zastosowanie tego samego, sprawdzonego kształtu, nie nowy mechanizm."

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
> **wyłącznie** `/private/tmp/cx-day242-uprawnienia`.

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
Zakres: ****PRZEKROJOWE — IZOLACJA ORGANIZACJI (`server/src/routes/**`). Naprawa trzech potwierdzonych DZIŚ, WCIĄŻ ŻYWYCH dziur IDOR (Permission Requests approve/reject, Videos DELETE, AI Context PUT+DELETE) + ograniczony, imiennie wyliczony przesiew kolejnej próbki z ~168 nieprzeczytanych kandydatów tras.** Audyt z dzisiejszego rana (`docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md`) zgłosił SZEŚĆ dziur tej klasy. Zanim wydano tę instrukcję, TRZY z sześciu (PMO Project Members, Consultify Studio, Notifications Escalations) zostały już naprawione przez inny tor tego samego dnia — zweryfikowane bezpośrednio w kodzie na SHA `df7f13056f` (patrz `§1`, dowód negatywny). Pozostałe TRZY są dziś wciąż otwarte i to jest rdzeń tego dyżuru.**.
Trasy front: `brak w zakresie ZAPISU tego dyżuru — trzy naprawiane rodziny tras są dziś albo bez frontu (Videos, AI Context — sprawdź samodzielnie w `R1`, czy istnieje żywy konsument w `src/`, i wpisz wynik do raportu jako fakt, nie założenie), albo mają front administracyjny do zweryfikowania (`Permission Requests` — poszukaj wołających `/api/permission-requests` w `src/services/api.ts` i `src/components/Admin/**`, opisz w raporcie, nie zmieniaj)`. Trasy tył: ``server/src/routes/permissionRequests.routes.ts` (naprawiane: `:67-102`) · `server/src/routes/videos.routes.ts` (naprawiane: `:56-63`) · `server/src/routes/context.routes.ts` (naprawiane: `:65-113,116-123`) · wzorce do powielenia: `server/src/routes/table-platform.routes.ts:2839,2851,2869` (`requireFormAccess`, definicja w `server/src/services/tablePlatform/PermissionsService.ts`) · `server/src/routes/pmo/project-members.routes.ts:52-67` (`projectBelongsToOrg`) · `server/src/services/StudioService.ts:104-129` (`getDocument` inline check) · `server/src/services/escalationService.ts:160-177` (`projectBelongsToOrg`) · montaż: `server/src/Gateway.ts:920,1070,1319` (`mountStub`), `:485-516` (`STUB_NAMES_WITH_LIVE_UI_ON_DEMO`) · R2 (przesiew): pliki wypisane imiennie w `§3``.

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
WT=/private/tmp/cx-day242-uprawnienia
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
git -C "$VAULT" worktree add "$WT" -b codex/day242-uprawnienia-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day242-uprawnienia/config.worktree"
cat "$VAULT/worktrees/cx-day242-uprawnienia/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day242-uprawnienia-scratch
mkdir -p /private/tmp/cx-day242-uprawnienia-artefakty

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
git -C "$WT" push github-backup codex/day242-uprawnienia-20260901
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

# (1) TEZA: trzy dziury zgloszone wczoraj (Project Members, Studio, Notifications Escalations) sa JUZ naprawione na tym SHA
grep -n "projectBelongsToOrg" server/src/routes/pmo/project-members.routes.ts
grep -n "organization_id !== organizationId" server/src/services/StudioService.ts
grep -n "projectBelongsToOrg" server/src/services/escalationService.ts
#   oczekiwane: trafienia we wszystkich trzech plikach — jesli KTOREGOS brakuje, ta
#   teza jest OBALONA na Twoim SHA i musisz to opisac w "Korektach wobec instrukcji"
#   PRZED kontynuacja (mogl to byc revert albo Twoj SHA jest starszy niz marker)

# (2) TEZA: PUT approve/reject w permissionRequests.routes.ts nie porownuje organization_id
sed -n '67,102p' server/src/routes/permissionRequests.routes.ts
grep -n "organization_id" server/src/routes/permissionRequests.routes.ts
#   oczekiwane: GET (~linia 32) i POST (~linia 57) MAJA 'organization_id'; oba PUT
#   (67-102) NIE MAJA go w ogole w zapytaniu UPDATE

# (3) TEZA: DELETE /api/videos/:id nie porownuje organization_id, mimo ze kolumna
#     istnieje i jest uzywana w GET/POST tego samego pliku
sed -n '56,63p' server/src/routes/videos.routes.ts
grep -n "organization_id" server/src/routes/videos.routes.ts
#   oczekiwane: GET i POST maja 'organization_id', DELETE (linia 61) nie ma

# (4) TEZA: PUT i DELETE /api/context/:id NIE porownuja organization_id (audyt zrodlowy
#     zglaszal TYLKO DELETE — sprawdz, czy PUT ma ten sam brak)
sed -n '65,123p' server/src/routes/context.routes.ts
#   oczekiwane: PUT (~linia 89, 'UPDATE ai_contexts SET ... WHERE id = ?') i DELETE
#   (linia 121) obie bez organization_id w zapytaniu; GET (~linia 28) ma go

# (5) TEZA: kolumna organization_id istnieje w kazdej z trzech tabel (naprawa nie
#     wymaga migracji)
grep -n "organization_id" server/migrations/794_permission_requests_00base.sql
grep -rn "organization_id" server/migrations/*.sql | grep -i "CREATE TABLE videos\|videos.*organization_id" | head -3
grep -rn "organization_id" server/migrations/*.sql | grep -i "ai_contexts" | head -3
#   oczekiwane: kolumna istnieje w schemacie wszystkich trzech tabel — nie zgaduj,
#   znajdz definicje

# (6) TEZA: trzy montowania to mountStub — maskowanie na demo, NIE naprawa
grep -n "mountStub('/api/permission-requests'\|mountStub('/api/videos'\|mountStub('/api/context'" server/src/Gateway.ts
sed -n '483,517p' server/src/Gateway.ts
#   oczekiwane: wszystkie trzy montowane przez mountStub(); 'contextRoutes' jest na
#   liscie STUB_NAMES_WITH_LIVE_UI_ON_DEMO (501 na demo), pozostale dwie nie sa (404)

# (7) TEZA: wzorzec naprawy z table-platform.routes.ts jest gotowy do skopiowania
sed -n '2830,2875p' server/src/routes/table-platform.routes.ts
grep -n "requireFormAccess" server/src/services/tablePlatform/PermissionsService.ts
#   oczekiwane: middleware sprawdza wlasciciela PRZED handlerem, zwraca 404 (nie 403)
#   przy niezgodnosci

# (8) TEZA: zaden z trzech plikow nie ma dzis wlasnego testu izolacji organizacji
find server/src/routes/__tests__ -iname "*permission-request*" -o -iname "*videos*org*" -o -iname "*context*org*" 2>/dev/null
find tests -iname "*permission-request*org*" -o -iname "*videos*org*isolation*" -o -iname "*context*org*isolation*" 2>/dev/null
#   oczekiwane: zero plikow — to Ty je tworzysz w R2

# (9) TEZA: miejsce na dysku wystarcza na dyzur
df -h /
#   oczekiwane: powyzej 5 GB wolnego — ponizej tego STOP calego dyzuru
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day242-uprawnienia-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6221`. Twój JEDYNY port harnessu to `5196 i 5197`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day242-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6220, 5010-5195, 6404-6411, 6600-6830. Twoje własne: baza 6221, harness 5196 i 5197. Cudze — siostrzane dyżury TEJ SAMEJ ostatniej paczki, nie dotykasz: baza 6223 i harness 5198-5199 (dyżur 243 Podgląd), baza 6225 i harness 5200-5201 (dyżur 244 Organizacja/Ustawienia). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. `Z10` obowiązuje bez wyjątku. W szczególności: **ZAKAZ zmiany `ENABLE_STUB_ROUTES`, `mountStub`, `STUB_NAMES_WITH_LIVE_UI_ON_DEMO`** (`Gateway.ts:485-516`) w jakąkolwiek stronę — naprawiasz dziurę POD spodem, nie zmieniasz, czy trasa jest zamontowana na demo. To dwa niezależne mechanizmy (maskowanie ≠ naprawa, patrz `PULAPKA` audytu źródłowego) i mylenie ich było już raz błędem w tym programie.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/admin.middleware.ts` · `server/src/middleware/rbac.middleware.ts` · `server/src/middleware/effectiveCapability.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY242_UPRAWNIENIA_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć, to jeden nowy wpis (nie edycja istniejących wierszy) w rejestrze dowodowym `docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` — WYŁĄCZNIE nowa sekcja na końcu pliku „## Dzień 242 — stan po weryfikacji i naprawie” ze zmierzonym stanem z `R1`-`R3`, każde zdanie z dowodem `plik:linia` albo kodem odpowiedzi HTTP. Zakaz kasowania, nadpisywania lub przepisywania istniejącej treści tego pliku. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day242-uprawnienia-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day242-uprawnienia-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ dotykania trzech JUŻ naprawionych plików** (`pmo/project-members.routes.ts`, `StudioService.ts`, `escalationService.ts`) poza odczytem — służą WYŁĄCZNIE jako wzorzec do skopiowania, weryfikujesz ich stan, nie zmieniasz ani linii. **ZAKAZ zmiany `mountStub`/`ENABLE_STUB_ROUTES`/`STUB_NAMES_WITH_LIVE_UI_ON_DEMO`** w `Gateway.ts` — to osobny mechanizm (widoczność na demo), nie kontrola dostępu; nie mylisz naprawy z odsłonięciem. **ZAKAZ rozszerzania zakresu naprawy poza trzy imiennie wskazane pliki** (`permissionRequests.routes.ts`, `videos.routes.ts`, `context.routes.ts`) — jeśli `R2` znajdzie CZWARTĄ żywą dziurę, opisujesz ją w raporcie z pełnym dowodem, ale NIE naprawiasz jej w tym dyżurze (to nowa pozycja dla kolejnej paczki, nie scope creep tej). **ZAKAZ zwracania `403` zamiast `404`** przy niezgodności organizacji — konwencja tego repo (już użyta w czterech poprzednich naprawach) to `404`, żeby nie ujawniać istnienia cudzego obiektu. | Audyt z dzisiejszego rana znalazł sześć dziur tej klasy w jednym przebiegu i uprzedził, że są to dopiero 30 z 198 przesianych kandydatów — reszta programu ma z definicji więcej. Ale ZANIM ta instrukcja została napisana, inny równoległy tor tego samego dnia już naprawił trzy z sześciu (dokładnie ten sam wzorzec, który audyt rekomendował) — sprawdzone wprost w kodzie, nie na słowo. Pisanie dyżuru na podstawie samego audytu, bez ponownego zmierzenia stanu na aktualnym SHA, powtórzyłoby dokładnie błąd, przed którym ostrzega cała metodyka programu: „audyty starzeją się w ~3 dni i zawyżają” — tu starzały się w mniej niż jeden dzień. Ten dyżur naprawia TYLKO to, co jest naprawdę wciąż otwarte, i rozszerza przesiew o kolejną, imiennie wyliczoną próbkę nieprzeczytanych kandydatów. |

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
cd /private/tmp/cx-day242-uprawnienia

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day242-pg psql -U postgres -d cx242 \
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
cd /private/tmp/cx-day242-uprawnienia

docker run -d --name cx-day242-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx242 \
  -p 127.0.0.1:6221:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day242-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6221/cx242 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6221/cx242 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day242-uprawnienia && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6221/cx242 \
JWT_SECRET=cx242-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__/day242-permission-requests-org-isolation.realpg.test.ts server/src/routes/__tests__/day242-videos-org-isolation.realpg.test.ts server/src/routes/__tests__/day242-context-org-isolation.realpg.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day242-uprawnienia-artefakty/day242-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day242-uprawnienia && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__/day242-permission-requests-org-isolation.realpg.test.ts server/src/routes/__tests__/day242-videos-org-isolation.realpg.test.ts server/src/routes/__tests__/day242-context-org-isolation.realpg.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day242-uprawnienia-artefakty/day242-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day242-uprawnienia/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day242-pg psql -U postgres -d cx242 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day242-pg`.
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
> **(e) ★★ AUDYT SPRZED JEDNEGO DNIA JUŻ SIĘ ZDEZAKTUALIZOWAŁ — NIE UFAJ ŻADNEJ LIŚCIE „ŻYWYCH DZIUR” BEZ WŁASNEGO PONOWNEGO POMIARU NA SWOIM SHA. `docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` opisywał sześć dziur jako otwarte; na SHA tej instrukcji trzy z nich (`pmo/project-members.routes.ts`, `StudioService.ts`, `escalationService.ts`) mają już poprawny `organizationId`-check z tym samym komentarzem-wzorcem („A projectId alone carries no org context...”). **Zanim naprawisz KTÓRYKOLWIEK z trzech pozostałych, powtórz to samo sprawdzenie na SWOIM `git rev-parse HEAD`** — możliwe, że między wydaniem tej instrukcji a Twoim startem ktoś naprawił kolejny. Nie zakładaj, nie kopiuj cudzego wyniku — `grep`/`sed -n` na żywym pliku, zawsze. Druga pułapka, złapana przy pisaniu tej instrukcji: audyt źródłowy wymieniał dla `context.routes.ts` WYŁĄCZNIE `DELETE` jako dziurawe — **PUT `/:id` w TYM SAMYM pliku ma dokładnie ten sam brak kontroli i audyt go nie zgłosił.** To jest dokładny przykład reguły „zgłoszona pozycja jest PRÓBKĄ rodziny, nie zakresem” z `CLAUDE.md` — zastosowanej w obrębie JEDNEGO pliku.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day242-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day242-uprawnienia-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (weryfikacja stanu na własnym SHA — dowód negatywny dla 3 już naprawionych, dowód pozytywny dla 3 otwartych) · R2 (naprawa trzech dziur + dowód mutacyjny+live-proof każda) · R3 (przesiew rozszerzony, imiennie wyliczona próbka) · R4 (raport dyżuru)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6221` albo `5196 i 5197` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6221` albo `5196 i 5197`** (`Z7`).

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

Dziś rano (`docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md`) audyt przesiał
statycznie 291 plików tras niedotkniętych wcześniejszą historią napraw cross-org/IDOR,
przeczytał ok. 30 do końca i znalazł **sześć** rodzin, w których obca organizacja mogła
zmienić lub skasować cudze dane bez żadnej kontroli `organization_id`. Trzy z nich
(PMO Project Members, Consultify Studio, Notifications Escalations) opisał jako **żywe
bezwarunkowo na demo/produkcji dziś**, trzy (Permission Requests, Videos, AI Context) jako
**wygaszone na demo przez `mountStub`/`ENABLE_STUB_ROUTES`, ale żywe kodowo i na każdym
innym środowisku** (lokalny dev, CI, staging bez `NODE_ENV=production`, albo natychmiast
po jednym flipie zmiennej).

**Zanim ta instrukcja powstała, sprawdzono stan na aktualnym SHA `df7f13056f` — nie
przepisano audytu bez weryfikacji.** Wynik: **trzy z sześciu dziur są już naprawione**
przez inny, równoległy tor tego samego dnia — dokładnie tym samym wzorcem, który audyt
rekomendował (`projectBelongsToOrg`/inline ownership-check, `404` przy niezgodności).
Sprawdzone bezpośrednio w kodzie:

- `server/src/routes/pmo/project-members.routes.ts:52-67` — funkcja `projectBelongsToOrg`
  z komentarzem *„A projectId alone carries no org context — without this check, any
  authenticated caller who knows (or guesses) a projectId belonging to another
  organization could read, add (including as ADMIN), update, or remove members..."*,
  wołana w każdym handlerze GET/POST/PUT/DELETE tego pliku.
- `server/src/services/StudioService.ts:104-129` — `getDocument(documentId, userId,
  organizationId)` ma dziś `if (row.organization_id !== organizationId && row.created_by
  !== userId) return null;` (linia 123), z komentarzem opisującym dokładnie ten sam
  wcześniejszy defekt jako naprawiony.
- `server/src/services/escalationService.ts:160-177` — `projectBelongsToOrg`, wołana na
  początku zarówno `getEscalations` jak i `runAutoEscalation` (linie 184, 207), z tym samym
  wzorcem komentarza.

**To NIE jest powód do samozadowolenia — to jest dowód, że audyty tej klasy starzeją się
w GODZINACH, nie dniach, i że pisanie dyżuru na podstawie nieodświeżonego audytu
naprawiłoby coś, co już naprawiono, marnując cały budżet dyżuru.** Stąd `R1` tego dyżuru
zaczyna od ponownej weryfikacji na WŁASNYM `git rev-parse HEAD` — jeśli między wydaniem
tej instrukcji a Twoim startem ktoś naprawił jeszcze jedną z trzech pozostałych, zgłaszasz
to w „Korektach wobec instrukcji" i przechodzisz do `R3` (przesiew) zamiast do martwej
naprawy.

## Trzy dziury, które NA DZIEŃ WYDANIA TEJ INSTRUKCJI są wciąż otwarte

### 1. Permission Requests — zatwierdzanie/odrzucanie cudzych wniosków o uprawnienia

`server/src/routes/permissionRequests.routes.ts:67-102`. Plik ma pięć tras. `GET /`
(linia 19-39) i `POST /` (linia 41-65) **poprawnie** filtrują przez
`pr.organization_id = ?` / zapisują `organization_id`. `PUT /:id/approve` (linia 67-83)
i `PUT /:id/reject` (linia 85-102) **nie porównują `organization_id` wcale**:

```ts
await dbRun(`
  UPDATE permission_requests SET status = 'approved', resolved_by = ?, resolved_at = datetime('now')
  WHERE id = ? AND status = 'pending'
`, [userId, id]);
```

Kolumna `organization_id` istnieje i jest indeksowana
(`server/migrations/794_permission_requests_00base.sql:4,20`) — nie brakuje schematu,
brakuje wyłącznie sprawdzenia. Skutek: dowolny administrator DOWOLNEJ organizacji, znający
albo zgadujący `id` wniosku, może zatwierdzić lub odrzucić wniosek o podniesienie uprawnień
złożony przez pracownika **innej firmy**.

### 2. Videos — kasowanie cudzego materiału wideo

`server/src/routes/videos.routes.ts:56-63`. `GET /` i `POST /` filtrują/zapisują
`organization_id` poprawnie. `DELETE /:id`:

```ts
router.delete('/:id', verifyToken, isAuthenticated, asyncHandler(async (req, res) => {
  await dbRun('DELETE FROM videos WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));
```

Zero warunku poza `id`. Dowolny uwierzytelniony użytkownik może trwale skasować wideo
dowolnej organizacji, znając samo `id`.

### 3. AI Context — nadpisywanie I kasowanie cudzego kontekstu AI (★ druga trasa, nie tylko jedna)

`server/src/routes/context.routes.ts`. `GET /` (linia 17-33) filtruje poprawnie po
`(user_id = ? OR organization_id = ?)`. **Audyt źródłowy zgłosił jako dziurawą wyłącznie
`DELETE /:id`** (linia 116-123: `DELETE FROM ai_contexts WHERE id = ?`). **Sprawdzenie tego
samego pliku pod kątem reguły „zgłoszona pozycja jest próbką rodziny" znalazło DRUGĄ trasę
o identycznym kształcie, którą audyt pominął: `PUT /:id`** (linia 65-113):

```ts
router.put('/:id', verifyToken, isAuthenticated, asyncHandler(async (req, res) => {
  const id = ...;
  // buduje `updates`/`params` z ciała żądania — zero porównania organization_id
  await dbRun(`UPDATE ai_contexts SET ${updates.join(', ')} WHERE id = ?`, params);
  ...
}));
```

Skutek: dowolny uwierzytelniony użytkownik może nadpisać treść (`content`), nazwę,
priorytet i status aktywności CUDZEGO kontekstu AI — nie tylko go skasować.

## Czego ten dyżur świadomie NIE robi

- **Nie dotyka trzech już naprawionych plików** poza odczytem weryfikacyjnym w `R1`.
- **Nie zmienia mechanizmu `mountStub`/`ENABLE_STUB_ROUTES`.** To osobny wymiar
  (widoczność trasy na danym środowisku) od kontroli dostępu wewnątrz handlera —
  mylenie ich było już raz przedmiotem ostrzeżenia w audycie źródłowym.
- **Nie próbuje domknąć wszystkich ~168 nieprzeczytanych kandydatów.** `R3` wyznacza
  ograniczoną, imiennie wyliczoną próbkę kolejnego kroku — reszta zostaje jako znany,
  policzony dług dla kolejnej paczki dyżurów.
- **Nie zmienia zachowania na `403`.** Konwencja tego repo, użyta konsekwentnie w
  czterech poprzednich naprawach tej klasy, to `404` — nie ujawniać istnienia cudzego
  obiektu.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Trzy dziury zgłoszone wczoraj (Project Members, Studio, Notifications Escalations) są już naprawione na SHA `df7f13056f` tym samym wzorcem (`projectBelongsToOrg`/inline check) | komenda (1) |
| T2 | `PUT /api/permission-requests/:id/approve` i `/reject` nie porównują `organization_id`, mimo że `GET`/`POST` tego samego pliku to robią | komenda (2) |
| T3 | `DELETE /api/videos/:id` nie porównuje `organization_id`, mimo że `GET`/`POST` tego samego pliku to robią | komenda (3) |
| T4 | ZARÓWNO `PUT` JAK I `DELETE /api/context/:id` nie porównują `organization_id` — audyt źródłowy zgłosił tylko `DELETE` | komenda (4) |
| T5 | Kolumna `organization_id` istnieje już w schemacie wszystkich trzech tabel — naprawa nie wymaga migracji | komenda (5) |
| T6 | Wszystkie trzy trasy są montowane przez `mountStub()` — dziś wygaszone na demo/produkcji, żywe kodowo wszędzie indziej | komenda (6) |
| T7 | Wzorzec naprawy `requireFormAccess` z `table-platform.routes.ts` jest gotowy do powielenia na te trzy przypadki | komenda (7) |
| T8 | Żaden z trzech plików nie ma dziś własnego testu izolacji organizacji | komenda (8) |
| T9 | Miejsce na dysku wystarcza | komenda (9) |

---

# 3. POZYCJE DYŻURU

## R1 — WERYFIKACJA STANU NA WŁASNYM SHA (rdzeń, warunek wejścia)

Zanim tkniesz jakikolwiek plik, wykonaj **wszystkie 9 komend weryfikacji stanu
wejściowego** z `§0.1`. Jeżeli komenda (1) pokaże, że KTÓRAŚ z trzech „już naprawionych"
dziur jest jednak wciąż otwarta na Twoim `HEAD` (np. revert, albo Twój marker jest starszy
niż stan opisany w tej instrukcji) — zatrzymujesz się, zapisujesz to jako „Korektę wobec
instrukcji" z pełnym dowodem (`plik:linia`, treść handlera) i **traktujesz ją jak CZWARTĄ
pozycję do naprawy w `R2`**, tym samym wzorcem. Jeżeli komendy (2)-(4) pokażą, że
KTÓRAŚ z trzech zgłoszonych w tej instrukcji dziur jest JEDNAK już naprawiona (ktoś
naprawił ją między wydaniem instrukcji a Twoim startem) — pomijasz ją w `R2`, zapisujesz
fakt i dowód, i przechodzisz do pozostałych.

## R2 — NAPRAWA TRZECH DZIUR + DOWÓD MUTACYJNY + LIVE-PROOF (rdzeń)

Dla KAŻDEJ z trzech pozycji (Permission Requests approve+reject, Videos delete, Context
put+delete) — wzorując się dosłownie na `server/src/routes/pmo/project-members.routes.ts:52-67`
(nazwij funkcję analogicznie, np. `permissionRequestBelongsToOrg`,
`videoBelongsToOrg`, `contextBelongsToOrg` — jedna funkcja pomocnicza na plik, wołana we
WSZYSTKICH mutujących handlerach tego pliku, nie tylko w jednym):

1. **Dodaj ownership-check PRZED zapytaniem mutującym.** Pobierz `organization_id`
   docelowego wiersza (`SELECT organization_id FROM <tabela> WHERE id = ?`), porównaj z
   `req.user?.organizationId`. Przy braku wiersza albo niezgodności organizacji: `404`
   (styl komunikatu zgodny z resztą pliku — sprawdź istniejące odpowiedzi błędów w tym
   samym pliku i dopasuj kształt JSON), **zero wykonania UPDATE/DELETE**.
2. **Nowy plik testowy per pozycja** (`Z18` zabrania dotykania istniejącej infrastruktury
   testowej, ale NOWE pliki są dozwolone i wymagane): dwie organizacje przez realny
   `POST /api/auth/register`, podpisane JWT, realny `ApiGateway.getInstance().initializeRoutes(app)`
   (`Z22`), realny Postgres (`Z25`/`Z26`), `--retry=0` (`Z29`). Para dowodowa **obca
   organizacja nie może** (żądanie zwraca `404`, readback pokazuje wiersz BEZ zmiany) **+
   właścicielska organizacja nadal może** (to samo żądanie z prawidłowym tokenem
   przechodzi, readback pokazuje zmianę).
3. **Dowód mutacyjny w obie strony** (`Z32`): psujesz fix (komentujesz ownership-check) →
   test „obca organizacja nie może" **CZERWONY**; przywracasz (`cp` z kopii, `Z27`) → test
   **ZIELONY**; `git diff` po przywróceniu **pusty**. Obie komendy i oba wyniki dosłownie
   w raporcie.
4. **Push po każdej pozycji** (`Z34a`).

## R3 — PRZESIEW ROZSZERZONY: IMIENNIE WYLICZONA PRÓBKA (rdzeń, dowodowy)

Audyt źródłowy zostawił **~168 kandydatów tras nieprzeczytanych** i wymienił imiennie
podzbiór wysokiego ryzyka w sekcji „Czego NIE dało się sprawdzić". Ten dyżur bierze
**dokładnie tę wymienioną próbkę** — nie cały zbiór 168, żeby dyżur miał skończony
zakres:

```
server/src/routes/ai/ai-ab-testing.routes.ts
server/src/routes/ai/ai-budgets.routes.ts
server/src/routes/ai/ai-drafts.routes.ts
server/src/routes/ai/ai-training.routes.ts
server/src/routes/ai/aiExplain.routes.ts
server/src/routes/ai/aiAnalytics.routes.ts
server/src/routes/ai/aiAsync.routes.ts
server/src/routes/assessment/assessment-ai.routes.ts
server/src/routes/billing/settlements.routes.ts
server/src/routes/billing/tokenBilling.routes.ts
server/src/routes/revenue.routes.ts
server/src/routes/knowledgeBase.routes.ts
server/src/routes/scenarios.routes.ts
server/src/routes/baselines.routes.ts
server/src/routes/assessmentEvidence.routes.ts
server/src/routes/core-docs.routes.ts
server/src/routes/caseWorkspace/intake.routes.ts
server/src/routes/v8/admin/partner-review.routes.ts
server/src/routes/organization/rbac.routes.ts (warianty `/roles/:roleId/permissions`, NIE `/roles/:id` DELETE — ten już sprawdzony)
```

Dla każdego pliku: policz endpointy GET-jeden/PUT/PATCH/DELETE/POST-na-obiekcie
przyjmujące identyfikator wprost, dla każdego prześledź trasa → kontroler/serwis →
zapytanie SQL (nie zatrzymuj się na trasie — audyt źródłowy pokazał, że duża część
poprawnie deleguje kontrolę do warstwy serwisu, więc **brak `organization_id` w SAMEJ
trasie NIE jest jeszcze dowodem dziury**, musisz dojść do zapytania). Klasyfikuj każdy:
**bezpieczny** (kontrola istnieje, cytat `plik:linia`), **dziurawy** (potwierdzony
statycznie, opisz kod odpowiedzi jaki by dał live-proof, ale **NIE naprawiaj** — to
poza `Z17` tego dyżuru, zgłoś jako nową pozycję dla kolejnej paczki), albo **globalny/
platformowy** (brak kolumny `organization_id` z definicji, np. konfiguracja SuperAdmin —
poza zakresem tej klasy dziury). Wynik: jedna tabela, N plików × klasyfikacja × dowód.

## R4 — RAPORT DYŻURU (rdzeń)

Struktura z `§R.2` (jeśli dostępna w Twoim środowisku) albo: streszczenie, `R1`-`R3` z
pełnymi dowodami, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" (obowiązkowa nawet pusta),
sekcja „Korekty wobec instrukcji" (obowiązkowa nawet pusta). Dołącz pełne wyjścia komend
z `§0` i `R1`-`R3`, ścieżki artefaktów w `/private/tmp/cx-day242-uprawnienia-artefakty` z `shasum -a 256`.

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (naprawa, `R2`) | `server/src/routes/permissionRequests.routes.ts` · `server/src/routes/videos.routes.ts` · `server/src/routes/context.routes.ts` — WYŁĄCZNIE dodanie ownership-check przed mutującymi handlerami, zero innych zmian w tych plikach |
| Zapis (NOWE, testy dowodowe `R2`) | `server/src/routes/__tests__/day242-permission-requests-org-isolation.realpg.test.ts` · `server/src/routes/__tests__/day242-videos-org-isolation.realpg.test.ts` · `server/src/routes/__tests__/day242-context-org-isolation.realpg.test.ts` (nowe pliki, `git add -f` jeśli katalog ignorowany) |
| Zapis (WĄSKO, `J`) | `docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` — WYŁĄCZNIE nowa sekcja na końcu pliku, zakaz kasowania/przepisywania istniejącej treści |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY242_UPRAWNIENIA_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/pmo/project-members.routes.ts` · `server/src/services/StudioService.ts` · `server/src/services/escalationService.ts` — wzorzec, weryfikujesz stan w `R1`, nie zmieniasz |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/table-platform.routes.ts` (referencja `requireFormAccess`) · `server/src/services/tablePlatform/PermissionsService.ts` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/Gateway.ts` — WYŁĄCZNIE odczyt mechanizmu `mountStub`/`STUB_NAMES_WITH_LIVE_UI_ON_DEMO`, zero zmian |
| Odczyt (ZAKAZ ZAPISU) | wszystkie 19 plików wymienione w `R3` · `server/migrations/794_permission_requests_00base.sql` i inne migracje cytowane w dowodach |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` · każdy `MODULE_ACCEPTANCE.md` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **NAJPIERW ZWERYFIKUJ NA WŁASNYM SHA, DOPIERO POTEM NAPRAWIAJ.** `R1` jest
  warunkiem wejścia do `R2`, nie formalnością. Audyt źródłowy tej instrukcji zdezaktualizował
  się w mniej niż jeden dzień — Twój może się zdezaktualizować w godzinach.
- ★★ **JEDNA FUNKCJA POMOCNICZA NA PLIK, WOŁANA WE WSZYSTKICH MUTUJĄCYCH HANDLERACH TEGO
  PLIKU.** Nie łataj pojedynczego endpointu, jeśli plik ma więcej niż jeden z tym samym
  brakiem — `context.routes.ts` miał DWIE (`PUT` i `DELETE`), audyt zgłosił jedną.
  Zanim uznasz naprawę pliku za skończoną, **przeczytaj cały plik jeszcze raz** i policz,
  ile mutujących handlerów ma teraz ownership-check.
- ★★ **DOWÓD ZAPISU: PORÓWNANIE WARTOŚCI PO PONOWNYM ODCZYCIE, NIE KOD HTTP.** `404` na
  żądaniu obcej organizacji jest połową dowodu. Druga połowa: `SELECT` bezpośrednio z
  bazy pokazujący, że wiersz NIE zmienił się (dla approve/reject/PUT) albo NADAL istnieje
  (dla DELETE) po odrzuconej próbie ataku.
- ★★ **PARA DOWODOWA OBOWIĄZKOWA: „OBCY NIE MOŻE" + „WŁAŚCICIEL NADAL MOŻE".** Test, który
  sprawdza tylko odrzucenie ataku, nie dowodzi, że naprawa nie zablokowała też prawidłowego
  użytkownika (dokładnie ten wzorzec złapał wcześniej regresję w naprawie bramki Ustawień —
  patrz `docs/functional/POMIAR_2026-09-01_ORGANIZACJA_SPOTKANIA_USTAWIENIA.md`, mutacja
  usuwająca warunek roli wywróciła też drugi człon dowodu).
- ★ **`--retry=0` OBOWIĄZKOWE NA WSZYSTKICH TRZECH NOWYCH PAKIETACH** (`Z29`) — test
  kształtu „atak odrzucony, readback bez zmian" leczy się skutkiem własnego ataku przy
  ponawianiu.
- ★ **PUŁAPKI ŚRODOWISKA — SPRAWDŹ KAŻDĄ U SIEBIE:** `Database.ts:80-88` cicho podstawia
  atrapę bazy bez `RUN_DB_TESTS=1`; `Database.ts:686` atrapa zwraca `changes:1` dla
  KAŻDEGO `UPDATE` niezależnie od `WHERE` — **to unieważniłoby cały dowód mutacyjny tego
  dyżuru**, MUSISZ być na realnym Postgresie; `vitest.config.ts:210` przypina
  `DB_TYPE='sqlite'`; `tests/setup.ts:896` podmienia `global.fetch`.
- ★ **`Z13`/`J`:** logi i pliki wynikowe NIE wchodzą do repo — leżą w
  `/private/tmp/cx-day242-uprawnienia-artefakty`, raport podaje ścieżki i `shasum -a 256`.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej sekcji
  jest podstawą odrzucenia dyżuru.
