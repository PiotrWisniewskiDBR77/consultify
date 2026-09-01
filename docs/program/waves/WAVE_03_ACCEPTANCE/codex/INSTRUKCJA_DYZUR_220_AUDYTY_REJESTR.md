# INSTRUKCJA DYŻURU nr 220 — Codex — „Trzy otwarte pozycje rejestru odbioru Audytów (AUD-OR-20260829-001 i18n seeda, -002/-005 surowe identyfikatory, -005 ucinanie wartości w Sesjach/Raportach/Ustaleniach) — kazda pozycja z testem i mutacja-gate, zrzuty dev-render PRZED pokazaniem wlascicielowi (regula 7)"

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
> **wyłącznie** `/private/tmp/cx-day220-audyty-rejestr`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `9fb7942a01`**
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
Zakres: **12 Audyty — trzy otwarte pozycje rejestru odbioru z `docs/program/waves/WAVE_03_ACCEPTANCE/modules/12_AUDITS/MODULE_ACCEPTANCE.md:117-121` (`AUD-OR-20260829-001` i18n, `-002` surowy identyfikator na karcie programu, `-005` surowe identyfikatory + ucinanie wartosci w Sesjach/Raportach/Ustaleniach). Poza zakresem: `AUD-OR-20260829-003` (brak dowodu pelnego/pustego wariantu dla SZESCIU ekranow — poza `Z13`, wymaga osobnego dyzuru inwentaryzacji) i `AUD-OR-20260829-004` (warsztat D-5 — to jest dyzur 221)**.
Trasy front: ``/audit-programs` (`src/routes/AppRoutes.tsx:1625`) -> `AuditsMethodHub.tsx` (szesc zakladek StandardModuleBar: `library`,`processes`(Sesje),`outputs`,`reports`(Raporty),`findings`(Ustalenia),`initiatives`, deklaracja `AuditsMethodHub.tsx:371-406`). Ekrany dotkniete: `src/components/Audit/method/tabs/AuditProcessesTab.tsx` (Sesje), `AuditReportsTab.tsx` (Raporty), `AuditFindingsTab.tsx` (Ustalenia). Fixture front-end nie renderuje danych bezposrednio z seeda — dane pochodza z bazy zaladowanej przez `scripts/dev/seed-wave3-audits-owner-review.mjs``. Trasy tył: ``GET /api/audits/programs` (lista Sesji, `server/src/services/audits/programService.ts` ok. `:963-964` liczy `applicableCriteria`/`concludedCriteria`), `GET /api/audits/reports`, `GET /api/audits/findings` (`server/src/services/audits/{reportService,outputService}.ts` — mapowanie wierszy). Fixture: `scripts/dev/seed-wave3-audits-owner-review.mjs` komendy `provision`/`seed`/`readback`/`reset`/`drop`, WYLACZNIE na lokalnej bazie `consultify_w3_audits_owner_*``.

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
WT=/private/tmp/cx-day220-audyty-rejestr
MARKER=9fb7942a01

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day220-audyty-rejestr-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day220-audyty-rejestr/config.worktree"
cat "$VAULT/worktrees/cx-day220-audyty-rejestr/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day220-audyty-rejestr-scratch
mkdir -p /private/tmp/cx-day220-audyty-rejestr-artefakty

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
git -C "$VAULT" log --oneline 9fb7942a01..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 9fb7942a01..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day220-audyty-rejestr-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9fb7942a01..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `osiem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day220-audyty-rejestr

# (W1) ile pozycji otwartych ma dzis rejestr modulu 12, i ktore
sed -n '113,122p' docs/program/waves/WAVE_03_ACCEPTANCE/modules/12_AUDITS/MODULE_ACCEPTANCE.md
#   oczekiwane: piec wierszy AUD-OR-20260829-001..005, status OPEN/EVIDENCE_MISSING; ten dyzur
#   dotyka 001/002/005, NIE dotyka 003/004

# (W2) i18n seeda — dokladne linie stringow angielskich
sed -n '45,50p;136,141p;168,172p' scripts/dev/seed-wave3-audits-owner-review.mjs
#   oczekiwane: PACK_TITLE/REQUIREMENT/EVIDENCE_TEXT (47-49), nazwy dwoch organizacji (ok. 139),
#   tytul/audience/confidentiality raportu (ok. 171) — wszystko po angielsku, literaly

# (W3) gdzie juz istnieje mechanizm rozwiazywania ID->nazwa, a gdzie go nie ma
grep -n "userNameById" src/components/Audit/method/tabs/*.tsx
#   oczekiwane: trafienia w AuditProcessesTab.tsx i AuditFindingsTab.tsx (i w AuditOutputsTab.tsx);
#   ZERO trafien w AuditReportsTab.tsx i AuditInitiativesTab.tsx — sprawdz, czy te dwa w ogole
#   pokazuja pole z ID czlowieka (jesli tak, to jest zywy przyklad AUD-OR-002/-005)

# (W4) gdzie jest CSS ucinajacy wartosc (truncate/line-clamp/max-w)
grep -n "truncate\|line-clamp\|max-w-\[" src/components/Audit/method/tabs/AuditProcessesTab.tsx src/components/Audit/method/tabs/AuditReportsTab.tsx src/components/Audit/method/tabs/AuditFindingsTab.tsx
#   oczekiwane: min. szesc trafien w trzech plikach; rozstrzygnij per trafienie, czy ucina WARTOSC
#   MERYTORYCZNA (np. tresc ustalenia) czy tylko etykiete pomocnicza (np. kod pakietu)

# (W5) czy "goly /" w postepie Sesji jest dzis realny, czy juz naprawiony gdzie indziej
sed -n '955,966p' server/src/services/audits/programService.ts
grep -n "concludedCriteria\|applicableCriteria" src/components/Audit/method/tabs/AuditProcessesTab.tsx
#   oczekiwane: backend domyslnie zwraca 0 (nie undefined) — zmierz REALNYM zapytaniem HTTP na
#   fixture, czy front dostaje liczby czy `NaN`/`undefined`; zapis 0/0 to NIE jest to samo co goly "/"

# (W6) rozbieznosc 5 vs 6 ekranow miedzy raportem DAY109 a dzisiejsza liczba zakladek
grep -n "id: '" src/components/Audit/method/AuditsMethodHub.tsx | grep -E "library|processes|outputs|reports|findings|initiatives"
grep -n "pieciu realnych powierzchni\|piec realnych powierzchni" docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY109_AUDYTY_OWNER_REPORT.md
#   oczekiwane: SZESC id zakladek w kodzie dzisiaj, raport DAY109 mowil o PIECIU — rozbieznosc
#   do wyjasnienia w raporcie, nie do zignorowania

# (W7) ktory numer ledgera naprawde odpowiada i18n — 001 czy jeden z 002/003/005
grep -n "AUD-OR-20260829-001" docs/program/waves/WAVE_03_ACCEPTANCE/modules/12_AUDITS/MODULE_ACCEPTANCE.md docs/program/waves/WAVE_03_ACCEPTANCE/codex/OWNER_REVIEW_AUDITS_CHAT_20260829.md
#   oczekiwane: 001 = i18n, OPEN w obu plikach — to jest wlasciwy numer do zamkniecia dla
#   pozycji jezykowej, NIE 002/003/005 (te trzy numery byly wskazane w zamowieniu jako
#   "karta modulu", nie jako 1:1 mapa na trzy tezy — dopasuj numery do tresci, nie na sile)

# (W8) czy seed jest uzywany gdziekolwiek poza wlasna procedura (zeby wykluczyc szersze skutki)
grep -rn "seed-wave3-audits-owner-review" scripts docs server src package.json 2>/dev/null | grep -v "scripts/dev/seed-wave3-audits-owner-review.mjs:"
#   oczekiwane: wolania wylacznie proceduralne/dokumentacyjne (provision/seed/readback/reset/drop
#   z linii komend), zero importu z kodu produkcyjnego lub innego seeda
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day220-audyty-rejestr-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6163`. Twój JEDYNY port harnessu to `5114 i 5115`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day220-pg`**. **ZAKAZANE:** `zajete: 6012, 5433, 6047, 6054-6162, 5010-5113, 6404-6411 · ZABRONIONE (rezerwacja innych dyzurow): 6165-6175, 5118-5139 · zakazane na stale: 5000 (macOS Control Center), 5037 (adb), 5060-5061`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyzur NIE wprowadza i NIE zmienia zadnej flagi funkcyjnej (`Z10`). Wszystkie trzy naprawy (i18n stringow seeda, rozwiazanie ID->nazwa, usuniecie/skorygowanie `truncate`/`max-w-[]`) sa bezflagowe: dane fixture i render kolumn, nie nowe zachowanie produktu`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**` w szczegolnosci `auth.middleware.ts` (`verifyToken`), `rbac.middleware.ts` (`requireOrgAccess`), `demoGuard.middleware.ts` (`demoContextMiddleware`), `rateLimiting.middleware.ts` (`apiAuthRateLimiter`) — wszystkie zamontowane w `server/src/routes/audit-programs.routes.ts:23-26,43`. Nie zmieniasz kolejnosci montazu ani semantyki zadnej z nich — Twoje poprawki (i18n/nazwy/CSS) maja przez nie PRZECHODZIC, nie omijac`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY220_AUDYTY_REJESTR_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/12_AUDITS/MODULE_ACCEPTANCE.md` — WYLACZNIE domykasz status wierszy `AUD-OR-20260829-001`, `-002`, `-005` w tabeli "Pakiet odbioru 2026-08-29" (linie 117-121) z `OPEN` na stan zmierzony przez Ciebie (`RESOLVED` tylko jesli test+mutacja-gate to potwierdzaja), z dopiskiem SHA commita i nazwa testu. Nie zmieniasz zadnego innego wiersza (w tym `-003` i `-004`, ktore NIE sa w zakresie tego dyzuru) ani zadnej innej sekcji pliku. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day220-audyty-rejestr-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day220-audyty-rejestr-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ZAKAZ_WLASCIWY_TEMU_DYZUROWI — Zakaz zmiany JAKIEJKOLWIEK innej stalej/wartosci w `scripts/dev/seed-wave3-audits-owner-review.mjs` poza polami cytowanymi w R1 (PACK_TITLE/REQUIREMENT/EVIDENCE_TEXT, nazwy dwoch organizacji, tytul/audience/confidentiality raportu) — plik obsluguje SoD, foreign-tenant i rights-boundary scenariusze dla `AUD-PF-001/002` i `AUD-OWN-*`; zadanie AUD-OR-003 (poza zakresem) WPROST zabrania zmiany seederow poza tym jednym, imiennie dozwolonym powodem | Fixture jest cudzym terenem dla wielu innych pozycji ledgera (SoD, foreign tenant, rights) — zmiana poza wskazanymi polami rozjezdzalaby inne, juz zamkniete dowody (`AUD-PF-001/002`, `AUD-OWN-001..004`) bez wiedzy nadzorcy |

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
cd /private/tmp/cx-day220-audyty-rejestr

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day220-pg psql -U postgres -d cx220 \
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
cd /private/tmp/cx-day220-audyty-rejestr

docker run -d --name cx-day220-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx220 \
  -p 127.0.0.1:6163:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day220-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6163/cx220 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6163/cx220 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day220-audyty-rejestr && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6163/cx220 \
JWT_SECRET=cx220-test-secret-do-not-reuse \
npx vitest run src/components/Audit/method/__tests__/day220-audyty-rejestr.*.test.tsx (NOWE, jeden plik per pozycja R1/R2/R3) src/components/Audit/method/__tests__/AuditProcessesTab.test.tsx AuditReportsTab.test.tsx AuditFindingsTab.test.tsx AuditsMethodHub.test.tsx (ISTNIEJACE, regresja calego katalogu src/components/Audit/method/__tests__/, 19 plikow, policz sam ile testow) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day220-audyty-rejestr-artefakty/day220-audyty-rejestr.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day220-audyty-rejestr && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/Audit/method/__tests__/day220-audyty-rejestr.*.test.tsx (NOWE, jeden plik per pozycja R1/R2/R3) src/components/Audit/method/__tests__/AuditProcessesTab.test.tsx AuditReportsTab.test.tsx AuditFindingsTab.test.tsx AuditsMethodHub.test.tsx (ISTNIEJACE, regresja calego katalogu src/components/Audit/method/__tests__/, 19 plikow, policz sam ile testow) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day220-audyty-rejestr-artefakty/day220-audyty-rejestr.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day220-audyty-rejestr/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day220-pg psql -U postgres -d cx220 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day220-pg`.
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
> **(e) nie dotyczy — modul 12 Audyty nie ma bramki `BETA_LOCKED`/`betaAccess*` na trasie `/audit-programs`; dowod: `grep -n "BETA_LOCKED\|betaAccess" server/src/routes/audit-programs.routes.ts` -> zero trafien (zmierzone na SHA 9fb7942a01, `router.use(verifyToken)` jest jedyna bramka montowana na calym routerze, `audit-programs.routes.ts:43`)**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day220-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day220-audyty-rejestr-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (i18n trzech literalow + dwoch nazw organizacji + trzech pol raportu) i R3-a (naprawa realnego bledu "golego /" w postepie Sesji, jesli W5 go potwierdzi) — te dwie pozycje maja najwiekszy widoczny wplyw na zrzut, ktory zobaczy wlasciciel. R2 (surowe identyfikatory) i R3-b (ucinanie CSS) robisz w drugiej kolejnosci; R4 (zrzuty dev-render) jest OBOWIAZKOWY niezaleznie od tego, ile pozycji zdazysz, bo to on jest dowodem dla wszystkiego, co juz naprawiles`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6163` albo `5114 i 5115` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6163` albo `5114 i 5115`** (`Z7`).

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

`docs/program/funkcje/FALA_Z1_2026-08-31.md:38` liczy moduł **12 Audyty** wprost:

> **12 Audyty** | **4-5** | i18n seeda + surowe identyfikatory + ucinanie wartości (3 pozycje
> rejestru, **dziś zero roboty**) · **warsztat D-5**: prototyp → akcept → budowa za flagą
> (decyzja zapadła 30.08, **postęp zerowy**)

To jest **jeden** z dwóch dyżurów, które zamykają tę pozycję planu. Ten (220) bierze **trzy
pozycje rejestru odbioru**. Drugi (221) bierze **warsztat D-5** — osobno, bo D-5 to inny
rodzaj pracy (projekt + prototyp, zero kodu produkcyjnego) i inny plik dotykany
(`dev-render/`, nie `src/components/Audit/method/tabs/`).

Karta modułu (`docs/program/waves/WAVE_03_ACCEPTANCE/modules/12_AUDITS/MODULE_ACCEPTANCE.md:113-121`,
sekcja „Pakiet odbioru 2026-08-29 — znaleziska otwarte") ma **pięć** wierszy, nie trzy:

| ID | Stan | Obserwacja |
|---|---|---|
| `AUD-OR-20260829-001` | `OPEN` | Po ustawieniu PL nazwa modułu, pakietu, programu, kryterium, zakres i część wartości zostają EN (`:117`) |
| `AUD-OR-20260829-002` | `OPEN` | Karta programu pokazuje surowy identyfikator audytora zamiast nazwy (`:118`) |
| `AUD-OR-20260829-003` | `EVIDENCE_MISSING` | Brak dowodu pustego/pełnego wariantu SZEŚCIU ekranów; zadanie zabrania zmiany seederów (`:119`) |
| `AUD-OR-20260829-004` | `OPEN` | Produkt to hub tabelaryczny, nie odtwarza „warsztat overview"; wymaga decyzji właściciela (`:120`) |
| `AUD-OR-20260829-005` | `OPEN` | Sesje/Raporty/Ustalenia ucinają wartości; Sesje pokazują postęp jako sam `/`; surowe ID (`:121`) |

★★ **Zamówienie tego dyżuru cytowało `-002/-003/-005` jako „karta modułu" dla trzech tez
(i18n / surowe ID / ucinanie).** Zmierzone: **i18n jest `-001`, nie jedną z cytowanych trójki**
(patrz `T7`). `-003` mówi o **dowodzie**, nie o kodzie, i wprost **zabrania zmiany seederów**
w kontekście, w jakim był pisany (dopełnienie macierzy 6×2×2 stanów) — to jest **inny rodzaj
zadania** niż R1 tego dyżuru (gdzie zmiana KONKRETNYCH pól seeda jest właśnie żądaną naprawą,
nie zabronioną „zmianą seedera"; rozstrzygnięcie w `Z40`/`ZAKAZ_WLASCIWY_TEMU_DYZUROWI`).
`-004` to warsztat D-5 — **zero punktu styku z tym dyżurem poza tym, że oba dotykają
`MODULE_ACCEPTANCE.md`**, patrz kolizja zasobowa w § 5.

**Zakres tego dyżuru — trzy pozycje, dokładnie zmierzone:**

- **(a) i18n seeda** — `AUD-OR-20260829-001`. Angielskie literały wstrzykiwane INSERT-ami
  fixture do bazy odbiorowej.
- **(b) surowe identyfikatory pokazywane zamiast nazw** — `AUD-OR-20260829-002` (karta
  programu) i część `-005` (Sesje/Raporty/Ustalenia).
- **(c) ucinanie wartości w interfejsie** — część `-005` (CSS `truncate`/`line-clamp`/
  `max-w-[]` na Sesjach/Raportach/Ustaleniach) + błąd postępu jako goły `/`.

`-003` i `-004` **NIE są w zakresie**. Nie zamykasz ich, nie dotykasz ich wierszy w
`MODULE_ACCEPTANCE.md`.

## ★★ Pomiar wykonany na SHA `9fb7942a01` — zweryfikuj sam, to rozkaz pomiarowy

**(K1) `-001` (i18n) to trzy literały jednej zmiennej + dwie nazwy organizacji + trzy pola
raportu, wszystko w JEDNYM pliku.** `scripts/dev/seed-wave3-audits-owner-review.mjs:47-49`:

```js
const PACK_TITLE = 'Transformation Audit Pack — internal operations';
const REQUIREMENT = 'Internal transformation decisions retain an accountable owner, dated evidence and independent review.';
const EVIDENCE_TEXT = 'Internal steering review sampled 12 decisions; 3 lacked a dated independent review record.';
```

`:139` — obie organizacje po angielsku: `'Wave 3 Audits Owner Review'`,
`'Wave 3 Audits Foreign Boundary'`. `:171` — raport: `'Transformation governance audit —
draft owner report'`, `'en'`, `'internal owner review'`, `'internal'`. Wszystkie te literały
trafiają WPROST do UI (Raporty pokazuje `audience`/`confidentiality` bez żadnej mapy i18n —
`AuditReportsTab.tsx:263-286` renderuje `row.audience || '—'` i `row.confidentiality || '—'`
surowo).

**(K2) Mechanizm rozwiązywania ID→nazwa CZĘŚCIOWO już istnieje — to zawęża `-002`/`-005`
do konkretnych ekranów, nie do całego modułu.** `userNameById` (mapa `Map<string,string>`
budowana w `AuditsMethodHub.tsx:452-471` z osobnego pobrania `Api.getUsers()`) jest
przekazywana i UŻYWANA w:

- `AuditProcessesTab.tsx:261` — `(row.leadAuditorId && userNameById.get(row.leadAuditorId))
  || row.leadAuditorName`
- `AuditFindingsTab.tsx:336` — `(row.ownerUserId && userNameById.get(row.ownerUserId)) ||
  (isPolish ? 'Nieprzypisany' : 'Unassigned')`
- `AuditOutputsTab.tsx:173` — `(row.finalizedBy && userNameById.get(row.finalizedBy)) ||
  row.finalizedByName`

`grep -n "userNameById" src/components/Audit/method/tabs/AuditReportsTab.tsx
src/components/Audit/method/tabs/AuditInitiativesTab.tsx` daje **ZERO trafień w oba pliki**.
Zmierz sam, czy te dwa ekrany w ogóle mają kolumnę z ID człowieka — jeśli tak, to jest żywy,
nienazwany dotąd przypadek `-002`/`-005`. „Karta programu" z `-002` wymaga osobnej lokalizacji
(nie znalazłem samodzielnego komponentu „karty programu" poza wierszem tabeli Sesji i nagłówkiem
`CriterionWorkspaceV2.tsx:1065`, który JUŻ resolwuje `leadAuditorName` przez `nameFor()` —
zmierz, czy `-002` jest już częściowo naprawione przez wcześniejszy, nieopisany w ledgerze
commit, czy nadal żywe).

**(K3) Ucinanie CSS istnieje w trzech plikach, sześciu miejscach — nie każde ucina TREŚĆ.**

| Plik:linia | Klasa | Kolumna | Ucina wartość merytoryczną? |
|---|---|---|---|
| `AuditProcessesTab.tsx:211` | `truncate block max-w-[160px]` | Pakiet (`packTitleById`/`packTitle`) | tak, tytuł pakietu bywa długi |
| `AuditProcessesTab.tsx:262` | `truncate` (bez `max-w`, ale kolumna ma `width: '160px'`) | Audytor wiodący | nazwa człowieka, zwykle krótka — zmierz realny przypadek |
| `AuditReportsTab.tsx:275` | `truncate block max-w-[130px]` | Odbiorca (`audience`) | tak — `'internal owner review'` już dziś ucina się na 130px |
| `AuditReportsTab.tsx:285` | `truncate block max-w-[120px]` | Poufność (`confidentiality`) | wartość krótka, zmierz |
| `AuditFindingsTab.tsx:303` | `line-clamp-2` | `statement` (treść ustalenia) | **tak, to jest MERYTORYCZNA treść ustalenia** — dwuwierszowy klips na zdaniu, które bywa długie |
| `AuditFindingsTab.tsx:324` | `truncate block max-w-[190px]` | `sourceReference` | zmierz długość realnych wartości |

Rozstrzygnij **per wiersz**, czy naprawa to (i) usunięcie `max-w`/zwiększenie szerokości
kolumny, (ii) `title=` atrybut z pełną wartością na hover, czy (iii) `StandardPreview` z pełną
treścią — **nie jedna uniwersalna łatka na sześć różnych przypadków.**

**(K4) „Goły `/`" wymaga potwierdzenia REALNYM zapytaniem, nie tylko czytaniem kodu.**
`AuditProcessesTab.tsx` render kolumny `progress`:

```tsx
{row.concludedCriteria}/{row.applicableCriteria}
```

Backend (`programService.ts:963-964`): `applicableCriteria: Number(critRow?.applicable_criteria
?? 0)`, `concludedCriteria: Number(critRow?.concluded_criteria ?? 0)` — **domyślnie zwraca
`0`, nie `undefined`.** Renderowany wynik przy braku danych powinien być `0/0`, nie goły `/`.
Trzy możliwości: (i) defekt już nieaktualny (ledger z 29.08, kod się zmienił), (ii)
`critRow` bywa `null` w sposób, który omija `??`, (iii) inna ścieżka renderuje ten sam
komponent z innymi propsami. **Zmierz HTTP-em na fixture, zanim cokolwiek zmienisz** — to
jest dokładnie ten rodzaj roszczenia, które CLAUDE.md każe liczyć samemu, nie przepisywać.

**(K5) Rozbieżność 5 vs 6 ekranów w `-003`/`-004` dotyczy TEGO SAMEGO hubu co Twoja praca —
zapisz ją, nawet jeśli nie naprawiasz `-003`.** `AuditsMethodHub.tsx:371-406` deklaruje
**sześć** `id` zakładek: `library`, `processes`, `outputs`, `reports`, `findings`,
`initiatives`. `CODEX_DAY109_AUDYTY_OWNER_REPORT.md:10` mówi o „**pięciu** realnych
powierzchniach × dwa motywy × pełny/pusty" = 20 stanów. Jedna z sześciu zakładek nie była
liczona 23.08 — możliwe, że warunkowo ukryta (`if` przed `base.push`), możliwe że pominięta.
**Nie musisz tego rozwiązywać** (poza zakresem `-003`), ale **zapisz obserwację w raporcie**
— to jest dokładnie klasa błędu, którą program już raz nazwał „próbka zamiast zbioru".

# 2. TEZY ZLECENIA

Każda z nich to **rozkaz pomiarowy** z komendą w `§0` (`W1`-`W8`). Jeśli u Ciebie linie się
przesunęły — wiążący jest plik (`Z24`), rozbieżność idzie do raportu.

- **T1.** Rejestr modułu 12 ma **pięć** otwartych pozycji (`MODULE_ACCEPTANCE.md:117-121`),
  nie trzy. Ten dyżur zamyka wyłącznie `-001`, `-002`, `-005`.
- **T2.** Źródło i18n to trzy stałe + dwie nazwy org + trzy pola raportu, wszystko w
  `scripts/dev/seed-wave3-audits-owner-review.mjs:47-49,139,171` — jeden plik, jasno
  wyznaczone linie.
- **T3.** Mechanizm `userNameById` **istnieje i działa** w `AuditProcessesTab.tsx:261`,
  `AuditFindingsTab.tsx:336`, `AuditOutputsTab.tsx:173`; **zero wystąpień** w
  `AuditReportsTab.tsx` i `AuditInitiativesTab.tsx` — zmierz, czy te dwa w ogóle potrzebują
  resolwera (czy pokazują ID człowieka w ogóle).
- **T4.** Ucinanie CSS (`truncate`/`line-clamp`/`max-w-[]`) występuje w **sześciu** miejscach
  trzech plików (`AuditProcessesTab.tsx:211,262`, `AuditReportsTab.tsx:275,285`,
  `AuditFindingsTab.tsx:303,324`) — **nie każde ucina wartość merytoryczną**, rozstrzygnij
  per wiersz (tabela `K3`).
- **T5.** Render postępu Sesji to `{row.concludedCriteria}/{row.applicableCriteria}`
  (`AuditProcessesTab.tsx` ok. `:244`); backend domyślnie zwraca `0`, nie `undefined`
  (`programService.ts:963-964`) — „goły `/`" wymaga potwierdzenia REALNYM zapytaniem HTTP na
  fixture, nie tylko czytania kodu.
- **T6.** Zakładek w `AuditsMethodHub.tsx` jest **sześć** (`:371-406`), a raport DAY109 mówił
  o „**pięciu** realnych powierzchniach" — rozbieżność do zapisania w raporcie, nie do
  ignorowania i nie do samodzielnego rozstrzygania w tym dyżurze.
- **T7.** Właściwy numer ledgera dla i18n to `AUD-OR-20260829-001` (potwierdzone w DWÓCH
  plikach: `MODULE_ACCEPTANCE.md:117` i `OWNER_REVIEW_AUDITS_CHAT_20260829.md:84`), **nie**
  jedna z liczb `-002/-003/-005` cytowanych w zamówieniu jako „karta modułu". Zamykasz `-001`
  jako i18n, nie dopasowujesz numeru na siłę do trzech cytowanych.
- **T8.** Fixture `seed-wave3-audits-owner-review.mjs` obsługuje WYŁĄCZNIE jedną, dedykowaną
  bazę odbiorową (`consultify_w3_audits_owner_*`) — tłumaczenie jego stałych nie dotyka
  żadnego innego modułu, żadnej innej bazy i żadnego demo/produkcji.

# 3. POZYCJE DYŻURU

Każda pozycja kończy się **testem, który udowadnia naprawę, PLUS mutacją, która przywraca
defekt i musi zaczerwienić dokładnie ten test** (`Z29`-analog, wymóg zamówienia „bramka per
pozycja"). Bez pary (dowód+mutacja) pozycja jest **nieukończona**, niezależnie od tego, jak
wygląda zrzut.

## R1 — i18n seeda (`AUD-OR-20260829-001`)

Tłumaczysz na polski **wyłącznie** siedem literałów zmierzonych w `K1`/`T2`: `PACK_TITLE`,
`REQUIREMENT`, `EVIDENCE_TEXT` (`:47-49`), dwie nazwy organizacji (`:139`), tytuł raportu +
`audience` + `confidentiality` (`:171`). Fixture istnieje wyłącznie po to, by wyprodukować
polski dowód dla przeglądu właściciela — angielska treść w niej jest samym defektem, nie
danymi produkcyjnymi do zachowania. Zostaw `language: 'en'` **jeśli** to pole steruje realną
logiką i18n gdzie indziej w produkcie (zmierz — `grep -rn "report.language\|\.language ===" server/src
src/components/Audit`); jeśli nie steruje niczym poza wyświetlaniem etykiety `Język`
(`AuditReportsTab.tsx` `{row.language?.toUpperCase() || '—'}`), zostaw jak jest — to jest kod
języka, nie treść do tłumaczenia.

**Test dowodzący:** nowy test integracyjny/komponentowy, który seeduje fixture i asercjuje, że
`GET /api/audits/{programs,reports}` (albo bezpośrednio wyrenderowany wiersz tabeli) **NIE
zawiera** żadnego z angielskich literałów z `K1` po ustawieniu `isPolish=true`.
**Mutacja-gate:** przywróć jeden z siedmiu literałów na angielski (`cp` z kopii `.orig`, `Z27`)
— test musi zaczerwienić się. Przywróć plik, `git diff` musi być pusty.

## R2 — surowe identyfikatory (`AUD-OR-20260829-002` + część `-005`)

Rozszerz `userNameById` (albo równoważny resolwer) na **każdy** ekran, który dziś pokazuje
pole zawierające ID człowieka bez rozwiązania — zacznij od `T3`: zmierz `AuditReportsTab.tsx`
i `AuditInitiativesTab.tsx`, i jeśli faktycznie renderują surowy ID (np. `createdBy`,
`proposedOwnerId`), dołóż im ten sam wzorzec `(id && userNameById.get(id)) || fallback`, **nie
nowy mechanizm**. Zlokalizuj „kartę programu" z `-002` dokładnie — jeśli to już
`AuditProcessesTab.tsx` (Sesje, gdzie `leadAuditor` już ma resolwer od `AUD-OWN-002/003`,
`MODULE_ACCEPTANCE.md:95`), sprawdź, czy defekt jest już zamknięty i zapisz to jawnie zamiast
naprawiać nieistniejący problem.

**Test dowodzący:** render z fixture, assert `screen.queryByText(/^w3-aud-.*-v1$/)` (wzorzec ID
fixture, `IDS.*` w seederze) jest `null` na każdym dotkniętym ekranie.
**Mutacja-gate:** w teście podmień `userNameById` na pustą mapę (`new Map()`) — komponent musi
albo pokazać `Nieprzypisany`/`—` (fallback), albo (jeśli to jest dokładnie defekt `-002`) test
musi pokazać surowy ID i **to jest oczekiwany czerwony wynik przed naprawą** — udokumentuj oba
stany w raporcie.

## R3 — ucinanie wartości (część `AUD-OR-20260829-005`)

Per wiersz tabeli `K3`: dla `AuditFindingsTab.tsx:303` (`line-clamp-2` na `statement` —
merytoryczna treść ustalenia) zamień na `title={row.statement}` (pełny tekst w tooltipie) +
rozważ, czy `StandardPreview` (kanon triady, `docs/ui-standards/TRIADA_KANON.md`) nie jest
lepszym miejscem na pełną treść zamiast klipsu w tabeli. Dla `AuditReportsTab.tsx:275,285`
(`audience`/`confidentiality`) — zmierz realne długości wartości (po R1 będą polskie) i albo
poszerz `max-w`, albo dodaj `title=`. Dla `AuditProcessesTab.tsx:211` (pakiet) — analogicznie.
**Zero zmian w `StandardTable`/`StandardModuleBar` samych** (`CLAUDE.md` §1) — poprawki są w
`render:` callbackach kolumn per-tab, nie w komponencie standardu.

Jeśli `T5`/`W5` potwierdzi realny defekt postępu (goły `/`, nie `0/0`) — napraw w
`AuditProcessesTab.tsx` (front) albo `programService.ts` (backend), zależnie od tego, gdzie
`W5` pokaże źródło. **Jeśli `W5` pokaże, że defekt już nie istnieje** (renderuje się `0/0`
albo poprawne liczby) — zapisz to w raporcie jako „nieaktualne od ledgera 29.08", nie udawaj
naprawy czegoś, co już działa.

**Test dowodzący:** render z długą, realną wartością (>40 znaków dla `statement`, >20 dla
`audience`/`confidentiality`/tytułu pakietu) — assert że pełna wartość jest dostępna (przez
`title=` attribute, `getByTitle`, albo widoczny tekst bez `…`).
**Mutacja-gate:** przywróć usunięty `max-w-[]`/`line-clamp` — test musi zaczerwienić się.

## R4 — ★★ dowód wizualny, `CLAUDE.md` §7 (właściciel nigdy pierwszym testerem)

To NIE jest formalność — to pozycja dyżuru z własną definicją ukończenia. Dla **każdego** z
trzech dotkniętych ekranów (Sesje/Raporty/Ustalenia): zrzut w `dev-render` (mock-dane
realistyczne — długie wartości, PL, bez logowania właściciela), motyw jasny + ciemny, PRZED
pokazaniem właścicielowi. Zrzuty idą do `/private/tmp/cx-day220-audyty-rejestr-artefakty`, **nie do repo** (`Z13`). W raporcie:
`shasum -a 256` każdego pliku + `mean_luma` pary jasny/ciemny (różnica > 150, `duplikat
zamiast motywu` bezpiecznik — dwa zrzuty pod dwiema nazwami tego samego obrazu to znany,
policzony kształt fałszywego „gotowe"). Napisz WPROST, czy dane na zrzucie pochodzą z
realnego przebiegu API na fixture, czy z propsów zamockowanych w harnessie dev-render — jeśli
to drugie, to NIE jest dowodem, że produkcyjny render działa (ten sam wzorzec co
`dev-render/screens/day207-write-proposal.tsx`, uznany za storybook w audycie 207).

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `scripts/dev/seed-wave3-audits-owner-review.mjs` — WYŁĄCZNIE siedem literałów z `K1`/`T2` (`:47-49,139,171`). **Zakaz** zmiany struktury INSERT-ów, kolejności pól, `IDS.*`, logiki `provision`/`seed`/`readback`/`reset`/`drop` — patrz `Z40` |
| Zapis | `src/components/Audit/method/tabs/AuditProcessesTab.tsx` — kolumny `pack`(`:211`), `progress`(jeśli `W5` potwierdzi defekt), `leadAuditor`(`:253-264`) |
| Zapis | `src/components/Audit/method/tabs/AuditReportsTab.tsx` — kolumny `audience`(`:270-277`), `confidentiality`(`:280-288`); dodanie `userNameById` prop **wyłącznie jeśli** `T3`/`W3` potwierdzi, że ekran pokazuje ID człowieka |
| Zapis | `src/components/Audit/method/tabs/AuditFindingsTab.tsx` — kolumna `statement`(`:303`), `sourceReference`(`:324`) |
| Zapis | `src/components/Audit/method/tabs/AuditInitiativesTab.tsx` — WYŁĄCZNIE jeśli `T3`/`W3` potwierdzi surowy ID na tym ekranie |
| Zapis (warunkowy) | `server/src/services/audits/programService.ts` — WYŁĄCZNIE jeśli `W5` potwierdzi realny defekt postępu w backendzie; jeśli defekt jest we froncie, ten plik zostaje nietknięty |
| Zapis | NOWE pliki testowe `day220-audyty-rejestr.*.test.tsx` w `src/components/Audit/method/__tests__/` — pełna licencja, `git add -f` jeśli katalog `tests/` |
| Zapis | NOWY ekran `dev-render/screens/day220-audyty-rejestr-*.tsx` (jeden na ekran albo jeden zbiorczy) + wpis w `dev-render/main.tsx` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY220_AUDYTY_REJESTR_REPORT.md` |
| Zapis (ograniczony) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/12_AUDITS/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE wiersze `-001`,`-002`,`-005` w tabeli linii 117-121, patrz `§0` pole „Jedyny inny dokument" |
| Odczyt (ZAKAZ ZAPISU) | `src/components/Audit/method/AuditsMethodHub.tsx` — `userNameById`/`programNameById`/`packTitleById` to WZORZEC do naśladowania w R2, nie do zmiany. Wyjątek: jeśli `T6`/`W6` wymusi drobną korektę licznika zakładek — **nie w tym dyżurze**, tylko zapis obserwacji w raporcie |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/audit-programs.routes.ts`, `server/src/middleware/**` — patrz `Z12`/`LISTA_BRAMEK` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/Audit/method/workspace/v2/CriterionWorkspaceV2.tsx` — ma już własny resolwer `nameFor()`/`leadAuditorName` (`:866,1065`); wzorzec do PORÓWNANIA z `userNameById`, nie do zmiany |
| Odczyt | `docs/program/funkcje/FALA_Z1_2026-08-31.md`, `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY109_AUDYTY_OWNER_REPORT.md`, `docs/program/waves/WAVE_03_ACCEPTANCE/codex/OWNER_REVIEW_AUDITS_CHAT_20260829.md` |

**Nietykalne imiennie:** `server/src/middleware/**` · `server/src/routes/audit-programs.routes.ts`
· `AuditsMethodHub.tsx` (poza obserwacją `T6`) · `CriterionWorkspaceV2.tsx` · każdy inny wiersz
`MODULE_ACCEPTANCE.md` poza `-001/-002/-005` · `StandardTable`/`StandardModuleBar`/
`StandardPreview` same w sobie (`src/components/standard/`).

**Kolizja zasobowa z dyżurem 221:** oba dyżury dopisują do
`MODULE_ACCEPTANCE.md` (Ty wiersze `-001/-002/-005`, 221 notatkę przy `-004`). **Przed
pierwszym commitem do tego pliku** sprawdź `git log` gałęzi bazowej, czy 221 już scalił swoją
zmianę — jeśli tak, edytujesz PO nim (patch na aktualny stan pliku), nie nadpisujesz.

# 5. TWARDE ZASADY

- ★★ **Trzy pozycje, trzy bramki.** Raport MUSI mieć osobną sekcję na `R1`/`R2`/`R3`, każda z
  parą (test PASS po naprawie) + (mutacja → ten sam test RED). Brak pary dla którejkolwiek
  pozycji = ta pozycja jest **niezrobiona**, nawet jeśli kod wygląda poprawiony.
- ★★ **Zakaz zamykania `-003` i `-004` w `MODULE_ACCEPTANCE.md`.** Nie są w zakresie. Jeśli
  Twoja praca nad `-001/-002/-005` przypadkiem dostarczy część dowodu dla `-003` (np. jeden z
  sześciu ekranów ma teraz zrzut pełny+pusty) — zapisz to jako obserwację w raporcie, **nie**
  zmieniaj statusu `-003`.
- ★★ **Regula 7 obowiązuje NIEZALEŻNIE od tego, ile z trzech pozycji zdążysz.** Nawet jeśli
  zrobisz tylko `R1`, zrzut dev-render przed-i-po dla tego, co naprawiłeś, jest obowiązkowy.
- ★ **`T7`/`K1`: nie dopasowuj numeru ledgera na siłę.** Jeśli w raporcie piszesz „naprawiłem
  i18n (`AUD-OR-20260829-002`)" bo tak brzmiało zamówienie, to jest błąd raportu — właściwy
  numer to `-001`, zmierzony w dwóch niezależnych plikach.
- ★ **Fixture jest cudzym terenem poza siedmioma polami z `K1`.** `Z40` w `§0` wylicza dlaczego
  — SoD, foreign-tenant i rights-boundary dowody innych pozycji ledgera zależą od reszty
  fixture bez zmian.
- ★ **Zero nowych flag** (`Z10`, `POZYCJE_Z_FLAGAMI` = brak) — wszystkie trzy naprawy są
  bezflagowe.
- ★★ **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest OBOWIĄZKOWA.** Wypisz wprost co
  najmniej: czy `-002` na „karcie programu" był już częściowo naprawiony przed tym dyżurem,
  czy zmierzyłeś to czy założyłeś; czy „goły `/`" (`T5`/`W5`) jest dziś realny czy nieaktualny
  — i na jakiej podstawie (zapytanie HTTP czy tylko czytanie kodu); czy `AuditReportsTab.tsx`
  i `AuditInitiativesTab.tsx` faktycznie pokazują surowy ID (`T3`/`W3`); czy rozbieżność 5 vs 6
  ekranów (`T6`/`W6`) została zapisana; ile z sześciu miejsc ucinania (`K3`) naprawiłeś i ile
  świadomie zostawiłeś. Brak tej sekcji jest podstawą odrzucenia dyżuru.
