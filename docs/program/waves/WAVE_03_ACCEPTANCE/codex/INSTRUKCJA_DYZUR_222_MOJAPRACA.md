# INSTRUKCJA DYŻURU nr 222 — Codex — „Moja praca — dwa defekty zlokalizowane co do linii: komentarz generowany przez AI w zadaniu nie zapisuje się (TaskDetailView.tsx, generateAIComment) i przycisk pobierania w tabeli RACI rzuca wyjątkiem (DecisionDetailView.tsx:8909, zmienna a poza zasięgiem)"

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
> **wyłącznie** `/private/tmp/cx-day222-mojapraca`.

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
Zakres: **07 Moja praca (My Work) — TaskDetailView.tsx (komentarz generowany przez AI w zadaniu) i DecisionDetailView.tsx (tabela RACI w decyzji, przycisk pobierania załącznika). Kontrakt: docs/program/funkcje/POMIAR_MODULOW_2026-08-31_WIECZOR.md, sekcja „07 Moja praca — zostają dwa drobiazgi” + docs/program/funkcje/FALA_Z1_2026-08-31.md, wiersz 07 Moja praca (2 dyżury).**.
Trasy front: `src/components/MyWork/TaskDetailView.tsx (funkcja generateAIComment, zmierz aktualną linię definicji na swojej bazie — na markerze 9fb7942a01 to :2598; wywoływana przez onAIEnhance w CommentsCanvas wewnątrz prawego panelu N-mode, zmierz linię montażu — na markerze :5677, ORAZ przez onGenerateAIComment w starszym CommentsSection, zmierz linię montażu — na markerze :7171) i src/components/MyWork/DecisionDetailView.tsx (tabela RACI, wiersz stakeholders.map((s) => ...), przycisk pobierania onClick={() => handleDownloadAttachment(a)}, zmierz aktualną linię — na markerze :8909)`. Trasy tył: `POST /api/tasks/:taskId/comments -> TaskController.addTaskComment (server/src/routes/pmo/tasks.routes.ts, rejestracja trasy zmierz linię — na markerze ok. :1187-1192; kontroler server/src/controllers/TaskController.ts, zmierz linię — na markerze ok. :2297), zweryfikowana schematem AddTaskCommentSchema (server/src/validators/task.validators.ts). Trasa istnieje i działa poprawnie dla komentarzy ręcznych przez addTaskCommentAndReload (TaskDetailView.tsx, zmierz linię eksportu funkcji — na markerze ok. :186-193). Ten dyżur NIE dodaje nowej trasy backendowej — podłącza JUŻ istniejącą, poprawną trasę do drugiego, dotąd niepodłączonego wywołania (AI). DecisionDetailView.tsx pozycja RACI nie dotyka backendu w ogóle — to czysto frontowy błąd zasięgu zmiennej.`.

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
WT=/private/tmp/cx-day222-mojapraca
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
git -C "$VAULT" worktree add "$WT" -b codex/day222-mojapraca-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day222-mojapraca/config.worktree"
cat "$VAULT/worktrees/cx-day222-mojapraca/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day222-mojapraca-scratch
mkdir -p /private/tmp/cx-day222-mojapraca-artefakty

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
git -C "$WT" push github-backup codex/day222-mojapraca-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9fb7942a01..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day222-mojapraca

# (W1) TEZA 1: generateAIComment konczy sie WYLACZNIE na setComments, zero wolania API
grep -n "generateAIComment\|setComments((prev) => \[...prev, newComment\])" src/components/MyWork/TaskDetailView.tsx
sed -n '2680,2717p' src/components/MyWork/TaskDetailView.tsx
#   oczekiwane: definicja funkcji ok. linii 2598; blok isDuplicate ok. 2680-2689;
#   `newComment` budowany lokalnie ok. 2692; JEDYNY skutek to `setComments((prev) => [...prev, newComment])`
#   ok. linii 2703 — zero `await Api...`, zero `addTaskComment`, zero fetch.

# (W2) TEZA 1 c.d.: manualna sciezka NAPRAWDE woła API (kontrast)
grep -n "addTaskCommentAndReload\|handleAddComment" src/components/MyWork/TaskDetailView.tsx
sed -n '186,193p' src/components/MyWork/TaskDetailView.tsx
#   oczekiwane: `addTaskCommentAndReload` (ok. :186-193) woła `api.addTaskComment` NAJPIERW,
#   dopiero potem `api.getTaskComments` (odczyt z serwera, nie z pamieci lokalnej);
#   `handleAddComment` (ok. :1600-1610) uzywa tej funkcji.

# (W3) TEZA 1 c.d.: generateAIComment ma DWA realne miejsca montazu (nie jest sierota)
grep -n "onAIEnhance={generateAIComment}\|onGenerateAIComment={generateAIComment}" src/components/MyWork/TaskDetailView.tsx
#   oczekiwane: dwa trafienia — CommentsCanvas (N-mode, prawy panel, zawsze widoczny)
#   i starszy CommentsSection.

# (W4) TEZA 2: DecisionDetailView.tsx:8909 wola handleDownloadAttachment(a)
grep -n "handleDownloadAttachment" src/components/MyWork/DecisionDetailView.tsx
#   oczekiwane: DWA trafienia — definicja ok. :4518, JEDYNE wywolanie ok. :8909.

# (W5) TEZA 2 c.d.: `a` nie istnieje w zasiegu — wiersz iteruje po `s`, nie po `a`
sed -n '8853,8918p' src/components/MyWork/DecisionDetailView.tsx | grep -n "stakeholders.map\|handleDownloadAttachment\|attachments.map"
#   oczekiwane: `stakeholders.map((s) => (` otwiera blok, `handleDownloadAttachment(a)`
#   jest W SRODKU tego bloku — zero `attachments.map((a) =>` w tym samym zasiegu.
#   Jedyne wystapienia `attachments.map((a) =>` w calym pliku sa gdzie indziej (grep -n "attachments.map((a)" DecisionDetailView.tsx).

# (W6) rozmiar plikow (kontekst skali, do licencji waskiej)
wc -l src/components/MyWork/TaskDetailView.tsx src/components/MyWork/DecisionDetailView.tsx
#   oczekiwane: TaskDetailView.tsx ok. 8828 linii, DecisionDetailView.tsx ok. 9844 linii —
#   OBA to pliki wspoldzielone przez wiele funkcji, stad licencja WASKA, nie PELNA.

# (W7) wzorzec istniejacego testu person. dla komentarzy (do naslodowania w nowym tescie)
test -f src/components/MyWork/__tests__/CommentPersistence.day140.test.ts && echo "wzorzec obecny"
grep -c "it(" src/components/MyWork/__tests__/CommentPersistence.day140.test.ts
#   oczekiwane: plik obecny, przynajmniej 4 przypadki testowe — wzorzec do rozszerzenia
#   o AI-generowany komentarz.

# (W8) karta modulu 07 nie jest zamknieta CLOSED_FINAL (bezpieczne dopisanie wpisu)
grep -n "Current gate" docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md
#   oczekiwane: gate inny niz CLOSED_FINAL (na markerze: zawiera NOT_ACCEPTED) — wolno dopisac.

# (W9) PORTY I KONTENERY
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(6165|5118|5119)\b' || echo "6165/5118/5119 wolne"
docker ps --format '{{.Names}} {{.Ports}}' | grep -i cx-day22
#   oczekiwane: wolne; jesli zajete, STOP i zglos kolizje zasobowa.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day222-mojapraca-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6165`. Twój JEDYNY port harnessu to `5118 i 5119`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day222-pg`**. **ZAKAZANE:** `na stałe: 5000, 5037, 5060-5061; zajęte przez dyżury wcześniejsze i odbiory nadzorcy: 6012, 5433, 6047, 6054-6164, 5010-5117, 6404-6411; zabronione na przód (fala 18): 6170-6175, 5128-5139; CUDZE w TEJ SAMEJ fali Z1 (222-225, pomijasz własne): baza 6166 (dyżur 223) / 6167 (224) / 6168 (225), harness 5120-5121 (223) / 5122-5123 (224) / 5124-5125 (225). Twój wyłączny przydział: baza 6165, harness 5118 i 5119, kontener cx-day222-pg`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur nie tworzy, nie włącza i nie wyłącza żadnej flagi funkcyjnej; obie pozycje są naprawą okablowania istniejącego kodu, nie nowym wizualium za flagą`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: `server/src/middleware/auth.middleware.ts (verifyToken) · server/src/Gateway.ts (ApiGateway.initializeRoutes) · server/src/middleware/v8FeatureGate.middleware.ts · server/src/middleware/resultsInternalBetaVisibility.middleware.ts · server/src/services/aiRoleGuard.ts · server/src/services/aiPolicyEngine.ts — żadnej z nich ten dyżur nie potrzebuje dotykać (obie pozycje są frontowe, backend już istnieje i działa dla ścieżki manualnej)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY222_MOJAPRACA_REPORT.md`. docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md — WYŁĄCZNIE dopisanie wiersza/notatki w sekcji ewidencji o naprawie dwóch pozycji z POMIAR_MODULOW_2026-08-31_WIECZOR.md (§R.1), zero zmiany gate'u G00-G20 bez decyzji właściciela, zero usuwania istniejącej treści. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day222-mojapraca-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day222-mojapraca-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | zakaz zmiany promptu/logiki generowania treści komentarza AI (TaskDetailView.tsx, ok. linii 2613-2663) i zakaz migracji schematu `task_comments` (nowa kolumna typu `is_ai_generated` itp.) — obie pozycje tego dyżuru są wyłącznie o podłączeniu istniejącej trasy zapisu do drugiego wywołania i o usunięciu błędnej zmiennej w JSX, nie o zmianie zachowania modelu ani schematu bazy | rozszerzenie zakresu o prompt albo o nową kolumnę bazy zamieniłoby naprawę okablowania (dwa zmierzone, zlokalizowane defekty) w projekt produktowy wykraczający poza to, co zmierzył rekonesans 31.08 i FALA_Z1_2026-08-31.md |

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
cd /private/tmp/cx-day222-mojapraca

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day222-pg psql -U postgres -d cx222 \
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
cd /private/tmp/cx-day222-mojapraca

docker run -d --name cx-day222-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx222 \
  -p 127.0.0.1:6165:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day222-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6165/cx222 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6165/cx222 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day222-mojapraca && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6165/cx222 \
JWT_SECRET=cx222-test-secret-do-not-reuse \
npx vitest run src/components/MyWork/__tests__/CommentPersistence.day222.aiComment.test.ts (NOWY, jednostkowy, mockuje Api jak CommentPersistence.day140.test.ts) · src/components/MyWork/__tests__/DecisionDetailView.raciDownload.day222.test.tsx (NOWY, render + klik, dowód na czerwono/zielono) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day222-mojapraca-artefakty/day222-mojapraca.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day222-mojapraca && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/MyWork/__tests__/CommentPersistence.day222.aiComment.test.ts (NOWY, jednostkowy, mockuje Api jak CommentPersistence.day140.test.ts) · src/components/MyWork/__tests__/DecisionDetailView.raciDownload.day222.test.tsx (NOWY, render + klik, dowód na czerwono/zielono) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day222-mojapraca-artefakty/day222-mojapraca.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day222-mojapraca/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day222-pg psql -U postgres -d cx222 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day222-pg`.
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
> **(e) nie dotyczy — obie pozycje są czysto frontowe i nie przechodzą przez żaden strażnik bezpieczeństwa/uprawnień; dowód: `grep -n "requireAudit\|AIRoleGuard\|isActionBlocked\|verifyToken" src/components/MyWork/TaskDetailView.tsx src/components/MyWork/DecisionDetailView.tsx` → zero trafień w zmienianych fragmentach (obie funkcje działają wyłącznie na już-zalogowanej sesji przeglądarki, backend trasy komentarzy ma własne, niezmieniane w tym dyżurze uwierzytelnienie)**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day222-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day222-mojapraca-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`obie pozycje (§A.1 komentarz AI, §A.2 przycisk RACI) są rdzeniem — to jest cały zakres dyżuru, żadna nie jest opcjonalna`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6165` albo `5118 i 5119` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6165` albo `5118 i 5119`** (`Z7`).

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

`docs/program/funkcje/POMIAR_MODULOW_2026-08-31_WIECZOR.md` (sekcja „07 Moja praca —
zostają dwa drobiazgi, oba zlokalizowane co do linii") i `docs/program/funkcje/FALA_Z1_2026-08-31.md`
(wiersz „07 Moja praca | **2** | komentarz generowany przez AI nie zapisuje się
(`TaskDetailView.tsx:~2691` — zero wywołania API) · błąd `handleDownloadAttachment(a)`
w tabeli RACI (`DecisionDetailView.tsx:8909`)") mówią, że z czterech pozycji rekonesansu
modułu 07 zostały dokładnie DWIE, obie zlokalizowane co do linii. Ten dyżur jest tymi
dwiema pozycjami — nic więcej, nic mniej.

**Zweryfikowane przy pisaniu tej instrukcji (nadzorca, na tipie `9fb7942a01`, 01.09):**

1. **`generateAIComment` istnieje realnie i JEST podłączona do UI w dwóch miejscach** —
   nie jest sierotą. Definicja: `src/components/MyWork/TaskDetailView.tsx:2598`.
   Montaż: `onAIEnhance={generateAIComment}` w `CommentsCanvas` wewnątrz prawego panelu
   N-mode (`:5677` — sekcja komentarzy renderowana ZAWSZE, niezależnie od aktywnej
   sekcji lewej nawigacji, komentarz w kodzie `:5974-5978` mówi to wprost) oraz
   `onGenerateAIComment={generateAIComment}` w starszym `CommentsSection` (`:7171`).
   Funkcja buduje `newComment` lokalnie (`:2692-2701`) i JEDYNYM jej skutkiem jest
   `setComments((prev) => [...prev, newComment])` (`:2703`) — zero `await Api...`,
   zero `fetch`, zero wywołania funkcji persystującej. Kontrast: komentarz ręczny
   (`handleAddComment`, `:1600-1610`) woła `addTaskCommentAndReload(Api, taskId, content)`
   (zdefiniowaną `:186-193`), która NAJPIERW robi `await api.addTaskComment(taskId, content)`,
   DOPIERO POTEM `api.getTaskComments(taskId)` — realny zapis + odczyt z serwera.
2. **`DecisionDetailView.tsx:8909`** — `onClick={() => handleDownloadAttachment(a)}` leży
   WEWNĄTRZ `stakeholders.map((s) => (...))` (otwarcie bloku `:8853`), która iteruje po
   zmiennej `s`, nie `a`. W całym pliku istnieje dokładnie JEDNO wywołanie
   `handleDownloadAttachment(...)` (grep `-n "handleDownloadAttachment"` → dwa trafienia:
   definicja `:4518`, wywołanie `:8909`) i ZERO deklaracji zmiennej `a` w otaczającym
   zasięgu (funkcja komponentu, moduł). Wzorzec `attachments.map((a) => ...)` istnieje
   w pliku dwukrotnie (`:5549`, `:9417`), ale w OBU przypadkach to inne, niezwiązane bloki
   JSX — przycisk na `:8909` został najwyraźniej skopiowany z jednego z nich bez zmiany
   nazwy zmiennej. Kliknięcie rzuca `ReferenceError: a is not defined`. Stakeholder (`s`)
   nie niesie żadnego pola typu załącznik — przycisk pobierania nie ma tu żadnego sensownego
   celu; poprawka NIE jest zmianą `a`→`s`, bo `s` i tak nie ma czego pobrać.

**Rozstrzygnięcie architektoniczne, które MUSISZ podjąć w §A.2 (nie jest z góry
narzucone przez tę instrukcję):** usunąć przycisk pobierania z wiersza RACI (bo
stakeholder nie ma załącznika) ALBO — jeśli w trakcie pomiaru odkryjesz, że produkt
rzeczywiście miał w zamyśle jakiś załącznik per-stakeholder, którego dziś nie ma w typie
`Stakeholder` — STOP MERYTORYCZNY tej pod-pozycji z opisem, co znalazłeś, i usunięcie
przycisku jako bezpieczniejsza z dwóch opcji (patrz „nie kasuj… nie wiesz → zostaw
uczciwy pusty stan" w klauzuli sprzeczności `A.8`, zastosowanej tu per analogię: skoro
danych nie ma, przycisk do nich też nie powinien istnieć).

---

# 2. TEZY ZLECENIA

| # | Teza (co twierdzi rekonesans/nadzorca) | Jak weryfikujesz | Co, jeśli teza padnie |
| --- | --- | --- | --- |
| T1 | `generateAIComment` (`TaskDetailView.tsx`) nie zapisuje komentarza AI do backendu, tylko do lokalnego stanu React | `W1`-`W3` niżej + Twój własny odczyt funkcji na Twojej bazie | Jeśli już zapisuje (np. inny dyżur to naprawił między 31.08 a Twoim markerem) — wpisz to jako sukces w „Korektach", pozycja `§A.1` staje się WYŁĄCZNIE testem regresyjnym, bez zmiany produktu |
| T2 | `DecisionDetailView.tsx:8909` woła `handleDownloadAttachment(a)` ze zmienną `a` nieistniejącą w zasięgu | `W4`-`W5` niżej | Jeśli linia się przesunęła lub kod już naprawiony — zmierz nową linię, wpisz do „Korekt", pozycja staje się testem regresyjnym |
| T3 | Komentarze ręczne (nie-AI) zapisują się poprawnie i przeżywają odświeżenie | `W2` niżej + Twój własny test manualny w harnessie | Jeśli manualna ścieżka też jest zepsuta — to jest odkrycie SZERSZE niż zakres tego dyżuru; opisz je w raporcie, ale NIE naprawiaj poza `§A.1`/`§A.2` (`Z17`) |

---

# 3. POZYCJE DYŻURU

## §A.1 — Komentarz generowany przez AI ma przeżywać odświeżenie strony

**Cel:** po kliknięciu „Generate AI comment" i pomyślnym wygenerowaniu treści, komentarz
ma trafić do bazy tą samą drogą co komentarz ręczny, i ma być widoczny po
`location.reload()` / ponownym pobraniu `GET /api/tasks/:taskId/comments`.

**Rekomendowany kształt naprawy** (nie jedyny dopuszczalny — jeśli znajdziesz lepszy,
uzasadnij w raporcie): w `generateAIComment`, zamiast `setComments((prev) => [...prev,
newComment])` (`:2703`), wywołać ścieżkę persystującą analogiczną do `handleAddComment`
— np. `setComments(await addTaskCommentAndReload(Api, taskId, generatedComment))` — i
DOPIERO PO sukcesie zapisu wołać `addActivityLogEntry(...)` i `toast.success(...)`.

**★★ Nieoczywisty fakt, który MUSISZ opisać w raporcie, nie zgadywać:** trasa
`POST /api/tasks/:taskId/comments` (`AddTaskCommentSchema`,
`server/src/validators/task.validators.ts:131-133`) przyjmuje WYŁĄCZNIE `content`
(+ opcjonalne `mentions`) — brak pola autorstwa. `TaskController.addTaskComment`
(`server/src/controllers/TaskController.ts:2297-2345`) zapisuje komentarz z
`user_id = req.user.id` (zalogowany użytkownik), NIE z `authorId: 'ai-assistant'`.
Oznacza to, że po naprawie przez prostą zmianę wywołania, persystowany komentarz AI
będzie w bazie przypisany DO ZALOGOWANEGO UŻYTKOWNIKA, nie do person'y „AI Assistant" —
tożsamość `isAIGenerated`/`authorName: 'AI Assistant'` jest dziś WYŁĄCZNIE cechą
lokalnego obiektu `Comment` w pamięci przeglądarki, nie ma odpowiednika w schemacie
`task_comments`. Masz DWIE uczciwe drogi, wybierz jedną i uzasadnij:
(a) zaakceptować, że po odświeżeniu komentarz AI wygląda jak komentarz zalogowanego
użytkownika (utrata etykiety „AI Assistant" po reload) — najmniejsza zmiana, zero
migracji; (b) oznaczyć treść w samym `content` (np. prefiks), zachowując etykietę
kosztem czystości tekstu. **Migracja schematu (nowa kolumna `is_ai_generated` w
`task_comments`) jest POZA zakresem tego dyżuru** — `server/migrations/**` poza
przedziałem `Z13`/licencji niżej, NIE dotykasz.

**DoD `§A.1`:**
- `generateAIComment` po sukcesie modelu woła realną trasę zapisu (dowód: `grep` na
  Twojej zmianie pokazuje `await api.addTaskComment` albo `addTaskCommentAndReload` na
  ścieżce AI, nie tylko na ścieżce manualnej);
- nowy test `src/components/MyWork/__tests__/CommentPersistence.day222.aiComment.test.ts`
  (wzorem `CommentPersistence.day140.test.ts`, patrz `W7`) dowodzi mutacyjnie: **PRZED**
  naprawą (uruchom na czystym markerze/`git stash`-owolnym `cp` kopii — `Z27`) test
  jest CZERWONY (bo funkcja nie woła API); **PO** naprawie test jest ZIELONY; cofnięcie
  zmiany produktu przez `cp` kopii sprzed naprawy z powrotem czyni go ponownie
  CZERWONYM. Oba przebiegi i oba wyniki dosłownie w raporcie (`Z32`);
- toast błędu (`notifyAiUnavailable`) nadal działa, gdy zapis padnie (nie zaszywasz
  nowego fallbacku maskującego błąd — `catch` ma zostać uczciwy, zgodnie z komentarzem
  już obecnym w kodzie `:2710-2712` o zakazie „zaszytych fallbacków").

## §A.2 — Przycisk pobierania w tabeli RACI nie ma rzucać wyjątkiem

**Cel:** kliknięcie ikony pobierania w wierszu RACI (`DecisionDetailView.tsx`, kolumna
„akcje" w tabeli stakeholderów) nie wywołuje `ReferenceError`.

**Rekomendowany kształt naprawy:** usunąć przycisk `onClick={() =>
handleDownloadAttachment(a)}` (`:8908-8917`) z wiersza `stakeholders.map((s) => ...)` —
`Stakeholder` (sprawdź definicję typu, `grep -n "interface Stakeholder" DecisionDetailView.tsx`)
nie niesie pola załącznika, więc przycisk pobierania w tym wierszu nie ma za sobą żadnych
danych. Jeśli Twój pomiar (patrz „Rozstrzygnięcie architektoniczne" w sekcji 1) pokaże
inaczej — STOP MERYTORYCZNY z opisem, nie improwizuj nowego pola.

**DoD `§A.2`:**
- nowy test `src/components/MyWork/__tests__/DecisionDetailView.raciDownload.day222.test.tsx`
  renderuje widok decyzji z co najmniej jednym stakeholderem i klika przycisk pobierania
  w jego wierszu (albo, jeśli przycisk został usunięty, asertuje jego NIEOBECNOŚĆ w DOM-ie
  tego wiersza) — dowód mutacyjny: na kopii SPRZED naprawy (`cp`, `Z27`) test odtwarza
  `ReferenceError` (czerwony — użyj `expect(() => ...).toThrow()` albo złap błąd z
  `console.error`/error boundary, w zależności od tego, jak RTL surfacuje błąd renderu/handlera);
  PO naprawie — zielony;
  cofnięcie naprawy przez `cp` przywraca czerwień. Oba przebiegi w raporcie (`Z32`);
- reszta wiersza RACI (rola, imię, e-mail, kanały powiadomień, usuwanie stakeholdera)
  działa bez zmian — **licencja jest WĄSKA, nie ruszasz nic poza tym jednym przyciskiem**.

## §R.1 — podniesienie karty modułu 07 do stanu faktycznego

Dopisz do `docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md`
krótką notatkę (nowy wiersz/akapit w istniejącej strukturze ewidencji, nie nowa sekcja
gate'u) odnotowującą naprawę obu pozycji z `POMIAR_MODULOW_2026-08-31_WIECZOR.md`, z
odsyłaczem do raportu `§R.2`. **Zakaz zmiany `Current gate` bez decyzji właściciela** —
karta ma dziś `NOT_ACCEPTED`, to się nie zmienia przez ten dyżur.

## §R.2 — raport dyżuru

`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY222_MOJAPRACA_REPORT.md`. Struktura
obowiązkowa: (1) wynik komend `(2)` i `(7)` z `§0.1` dosłownie; (2) wynik `W1`-`W9`
dosłownie; (3) per pozycja (`§A.1`, `§A.2`): dowód mutacyjny czerwony→zielony→czerwony,
diff, commit SHA; (4) `§0.4a` — `przed-nazwy.txt`/`po-nazwy.txt`, diff nazw testów; (5)
sekcja „Korekty wobec instrukcji" (nawet pusta — wtedy napisz wprost „brak korekt"); (6)
sekcja „TWIERDZENIA NIEZWERYFIKOWANE" (nawet pusta — wtedy napisz wprost „brak"); (7)
deklaracja `Z30` (patrz `§0.2b`) — ten dyżur NIE wysyła żadnej poczty, ale deklaracja
i tak jest obowiązkowa, bo dotykasz kodu, który technicznie mógłby (komentarz → powiadomienie
— zmierz, czy `addTaskComment` triggeruje jakiekolwiek powiadomienie/e-mail, zanim
napiszesz zdanie z `§0.2b`).

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
| --- | --- |
| Zapis — WĄSKA, wyłącznie `generateAIComment` (definicja + wywołanie zapisu, ok. `:2598-2717`) | `src/components/MyWork/TaskDetailView.tsx` (plik ma ok. 8828 linii, współdzielony przez dziesiątki niezwiązanych funkcji — zakaz dotykania czegokolwiek poza tą jedną funkcją i jej bezpośrednimi importami) |
| Zapis — WĄSKA, wyłącznie wiersz `stakeholders.map` w tabeli RACI, przycisk pobierania (ok. `:8853-8917`) | `src/components/MyWork/DecisionDetailView.tsx` (plik ma ok. 9844 linii — zakaz dotykania czegokolwiek poza tym jednym wierszem/przyciskiem) |
| Zapis — NOWY plik | `src/components/MyWork/__tests__/CommentPersistence.day222.aiComment.test.ts` |
| Zapis — NOWY plik | `src/components/MyWork/__tests__/DecisionDetailView.raciDownload.day222.test.tsx` |
| Zapis — WYŁĄCZNIE dopisanie notatki (`§R.1`) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md` |
| Zapis | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY222_MOJAPRACA_REPORT.md` |
| Odczyt (wzorzec, ZAKAZ ZAPISU) | `src/components/MyWork/__tests__/CommentPersistence.day140.test.ts` — wzorzec mockowania `Api`, KOPIUJESZ styl, nie rozszerzasz tego pliku |
| Odczyt (ZAKAZ ZAPISU — `Z18`, bez wyjątku) | `tests/setup.ts` · `tests/helpers/**` · `tests/__mocks__/**` · `vitest.config.ts` · każdy `vitest.*.config.ts` · `server/vitest.config*.ts` · `tests/integration/_helpers/assertRealPostgres.ts` |
| Odczyt | `server/src/controllers/TaskController.ts` · `server/src/validators/task.validators.ts` · `server/src/routes/pmo/tasks.routes.ts` — istniejąca trasa, wzorzec do zrozumienia, NIE dotykasz backendu w tym dyżurze (żadna z dwóch pozycji tego nie wymaga) |

**Nietykalne imiennie:** `tests/setup.ts` i sąsiedzi (`Z18`) · cały `server/src/**` (obie
pozycje są czysto frontowe — jeśli Twój pomiar pokaże, że backend jednak wymaga zmiany,
STOP MERYTORYCZNY z opisem, nie improwizuj) · `server/migrations/**` (zero nowych migracji
w tym dyżurze) · `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`
(`Z14`).

**Rozłączność z partią równoległą:** dyżury `223`-`225` tej samej fali dotyczą modułów
13/16/03 — zero wspólnych plików produktowych z tym dyżurem. Jedyny współdzielony obszar
to `docs/program/waves/WAVE_03_ACCEPTANCE/codex/` (katalog raportów) — każdy dyżur pisze
WYŁĄCZNIE swój plik, zero edycji cudzych raportów.

---

# 5. TWARDE ZASADY

- ★★ **Nie myl `CommentsCanvas` (N-mode, prawy panel, `:5677`) z `CommentsSection`
  (starszy widok, `:7171`).** OBIE wołają `generateAIComment` — napraw funkcję RAZ,
  efekt musi być widoczny w OBU miejscach montażu. Test dowodowy uderza w samą funkcję
  (jednostkowo), nie musi renderować obu powłok osobno, ale raport wymienia oba miejsca
  montażu jako „konsumentów tej samej naprawy".
- ★★ **Zakaz migracji schematu w tym dyżurze** — problem z utratą etykiety „AI Assistant"
  po reload (opisany w `§A.1`) jest ŚWIADOMIE zostawiony jako kompromis do udokumentowania,
  nie do naprawienia nową kolumną.
- ★ **`Z40` — dodatkowy zakaz właściwy temu dyżurowi: nie „ulepszasz" promptu ani logiki
  generowania treści komentarza AI** (linie `2613-2663`) — to poza zakresem, jedyna zmiana
  to SKUTEK udanego wygenerowania (co się dzieje z `generatedComment` PO jego otrzymaniu).
- ★ **Dowód mutacyjny w obie strony (`Z32`) jest obowiązkowy dla OBU pozycji** — nie tylko
  dla jednej. Brak dowodu dla którejkolwiek czyni tę pozycję NIEUKOŃCZONĄ, nie „częściowo
  zrobioną".
- ★ **Zrzuty: opcjonalne, nie są bramką tego dyżuru** — obie naprawy są weryfikowalne
  testem jednostkowym/komponentowym; jeśli chcesz dołączyć zrzut ekranu komentarza
  przeżywającego reload, dodaj go do `/private/tmp/cx-day222-mojapraca-artefakty` jako dodatkowy dowód, ale brak zrzutu
  nie blokuje odbioru przy zielonych testach mutacyjnych.
- ★ **`Z13`:** wyjścia `--reporter=json`, `przed-nazwy.txt`/`po-nazwy.txt` i ewentualne
  zrzuty NIE wchodzą do repo — leżą w `/private/tmp/cx-day222-mojapraca-artefakty`, raport
  podaje ścieżki i `shasum -a 256`.
- ★ **Pułapka komentarzy, które kłamią (31.08, `ZNALEZISKO_TOOL_OUTPUTS.md`):** zanim
  uznasz jakikolwiek komentarz w kodzie za prawdziwy opis stanu (np. komentarz `:2710-2712`
  o „zero zaszytych fallbacków"), zweryfikuj go swoim pomiarem — w tym konkretnym przypadku
  komentarz opisuje `catch`, nie `try`, więc nie koliduje z naprawą `§A.1`, ale zasada
  dotyczy każdego kolejnego komentarza, na jaki trafisz.
