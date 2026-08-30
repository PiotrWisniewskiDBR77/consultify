# INSTRUKCJA DYŻURU nr 173 — Codex — „Trzy niedokonczone sprawy z odbiorow - przypiety config, przejmowanie cudzych notatek, ciche awarie zapisu"

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
> **wyłącznie** `/private/tmp/cx-day173-domkniecia`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `514c60b355`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-08-30.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **Przekrojowo - konfiguracja testow, karta decyzji (pamiec przegladarki), ciche awarie zapisu zadania**.
Trasy front: ``src/components/MyWork/DecisionDetailView.tsx` (tylko blok odczytu klucza), `src/components/InitiativeTasksTab.tsx`, `src/components/dashboard/UserTaskList.tsx`, `src/components/Initiatives/InitiativeSidePanel.tsx`, `src/components/Initiatives/InitiativeCalendar.tsx``. Trasy tył: `brak zmian po stronie serwera - ten dyzur dotyczy konfiguracji i frontu`.

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
WT=/private/tmp/cx-day173-domkniecia
MARKER=514c60b355

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day173-domkniecia-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day173-domkniecia/config.worktree"
cat "$VAULT/worktrees/cx-day173-domkniecia/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day173-domkniecia-scratch
mkdir -p /private/tmp/cx-day173-domkniecia-artefakty

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
git -C "$VAULT" log --oneline 514c60b355..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 514c60b355..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day173-domkniecia-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 514c60b355..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `cztery` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day173-domkniecia

# (T1) SKALA OBEJSCIA PRZYPIETEGO CONFIGU
sed -n '208,212p' vitest.config.ts
grep -rln "process.env.DB_TYPE = 'postgres'" tests/ | wc -l
#   oczekiwane: DB_TYPE: 'sqlite' na sztywno w linii 210, oraz 80 plikow z obejsciem.

# (T2) WZORZEC JUZ NAPRAWIONY — SKOPIUJ GO
sed -n '15,19p' server/vitest.config.ts
#   oczekiwane: DB_TYPE: process.env.DB_TYPE || 'sqlite' — naprawione dyzurem 167.
#   ★ TEGO PLIKU NIE ZMIENIASZ. Sluzy za wzorzec.

# (T3) PRZEJMOWANIE CUDZYCH NOTATEK
sed -n '2420,2430p' src/components/MyWork/DecisionDetailView.tsx
#   oczekiwane: stary klucz czytany, kopiowany pod nowy i KASOWANY.
#   Zapisany obiekt niesie tylko schemaVersion i savedAt — ZERO informacji o wlascicielu.

# (T4) CICHE AWARIE — jest ich WIECEJ niz trzy
grep -rn "Failed to create task\|Failed to save task" src/ --include='*.tsx' | head
#   Wzorzec UCZCIWY: useActionHandler.ts (toast.error).
#   Ciche: InitiativeTasksTab.tsx, UserTaskList.tsx, InitiativeSidePanel.tsx, InitiativeCalendar.tsx.
#   ★ Raport dyzuru 160 nazywa CZWARTY plik, ktorego zlecenie nie wymienialo. Przeczytaj go.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day173-domkniecia-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6071`. Twój JEDYNY port harnessu to `5016 i 5017`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day173-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6055 oraz 6061-6067 (odbiory nadzorcy), 6051/4994-4995 (163), 6068/5010-5011 (170), 6069/5012-5013 (171), 6070/5014-5015 (172). ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak - ten dyzur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartosci domyslnej zadnej istniejacej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY173_DOMKNIECIA_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day173-domkniecia-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day173-domkniecia-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE ROBISZ MASOWEJ PODMIANY.** `CLAUDE.md` ostrzega wprost, ze masowa operacja tego typu raz juz zniszczyla wydane instrukcje. **80 recznych obejsc to INWENTARZ, nie naprawa** - wypisz je i oddaj do osobnej decyzji wlasciciela. **NIE ZMIENIASZ `server/vitest.config.ts`** - naprawil go dyzur 167, sluzy Ci za wzorzec. Naprawiasz **wylacznie** config w korzeniu repo. ★ **NIE ZDEJMUJESZ I NIE ZAWEZASZ BRAMY 409** (`tasks.routes.ts:67`) - to osobna decyzja wlasciciela. Naprawiasz **komunikat dla uzytkownika**, nie brame. **NIE ZMIENIASZ TRESCI KOMUNIKATOW tam, gdzie juz sa** - dodajesz brakujace, wzorem `useActionHandler.ts`. **NIE ZMIENIASZ WYGLADU** poza dodaniem brakujacych komunikatow o bledzie. **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji.** | Trzy sprawy zmierzone i nazwane przy odbiorach innych dyzurow - zadna nie jest hipoteza. Root config nadal przypina sqlite, przez co **80 plikow testowych obchodzi ten sam blad recznie**. Stare notatki decyzji sa **cicho przejmowane i kasowane** przez pierwsza osobe logujaca sie na danym komputerze. A przy nieudanym zapisie zadania **okno znika bez slowa, jakby sie udalo** |

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
cd /private/tmp/cx-day173-domkniecia

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day173-pg psql -U postgres -d cx173 \
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
cd /private/tmp/cx-day173-domkniecia

docker run -d --name cx-day173-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx173 \
  -p 127.0.0.1:6071:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day173-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6071/cx173 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6071/cx173 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day173-domkniecia && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6071/cx173 \
JWT_SECRET=cx173-test-secret-do-not-reuse \
npx vitest run tests/unit --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day173-domkniecia-artefakty/day173-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day173-domkniecia && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day173-domkniecia-artefakty/day173-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day173-domkniecia/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day173-pg psql -U postgres -d cx173 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day173-pg`.
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
> **(e) ★★ **Pierwsza, i to jest sedno R1: naprawa musi dzialac w OBIE STRONY.** Zmierz, **ile testow biegnie dzis na sqlite PRZED zmiana - i pokaz te sama liczbe PO**. Naprawa, ktora po cichu przelacza setki testow na inna baze, jest **gorsza od przypiecia**. Dowod mutacyjny ma pokazac oba kierunki: z `DB_TYPE=postgres` dostajesz postgres, a **bez podania niczego nadal dostajesz sqlite**. **Druga: cichych powierzchni jest WIECEJ niz trzy, ktore wymienilem.** Przeglad przy skladaniu tej instrukcji znalazl **co najmniej piec miejsc w czterech plikach** - `InitiativeTasksTab.tsx:67-68`, `UserTaskList.tsx:58-59`, `InitiativeSidePanel.tsx:208` i `InitiativeCalendar.tsx` (funkcja `persist`, okolice 147-171). **Sam raport dyzuru 160 nazywa czwarty plik**, ktorego zlecenie nadzorcy nie wymienialo. **Przeczytaj ten raport i napraw wszystkie ciche**, a w raporcie napisz, ile ich bylo i ktore naprawiles. **Trzecia: numery linii w zleceniu nadzorcy sa przesuniete.** Realne: `useActionHandler.ts:439-440` (nie 428), `UserTaskList.tsx:58-59` (nie 49), `InitiativeTasksTab.tsx:67-68` (nie 64). **Sprawdzaj kazda linie sam, zanim ja zacytujesz w raporcie.** **Czwarta, sciezkowa: `InitiativeTasksTab.tsx` lezy w `src/components/`, NIE w `src/components/Initiatives/`.** Nie pomyl go z `InitiativeDocumentView.tsx`, ktory jest w `Initiatives/` i **nalezy do dyzuru 172**. **Piata, dla R2: stare notatki sa NIEROZSTRZYGALNE co do wlasciciela** - zapisany obiekt niesie wylacznie `schemaVersion` i `savedAt`. **Rekomendacja: nie czytac starego klucza w ogole.** To dane szkicowe w przegladarce; bezpieczniej zostawic je martwe niz przypisac niewlasciwej osobie i skasowac oryginal. **Ale zmierz sam i uzasadnij wybor.** **Szosta, poza zakresem, ale odnotuj w raporcie:** klucz `consultify-decision-draft` (`DecisionDetailView.tsx:1824`) **w ogole nie jest zawezony** do organizacji ani uzytkownika. To osobna sprawa - **zglos, nie naprawiaj****
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day173-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day173-domkniecia-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycje R1 i R2 - konfiguracja przestaje uniemozliwiac odtworzenie dowodu, a nikt nie traci cudzych notatek`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6071` albo `5016 i 5017` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6071` albo `5016 i 5017`** (`Z7`).

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

Trzy sprawy zostały zmierzone i nazwane przy odbiorach innych dyżurów tego samego dnia —
żadna nie jest hipotezą postawioną teraz, każda ma źródło i cytat.

**Pierwsza.** Dyżur 167 naprawił `server/vitest.config.ts:17`
(`DB_TYPE: process.env.DB_TYPE || 'sqlite'`), ale root `vitest.config.ts:210` ma nadal
`DB_TYPE: 'sqlite',` wpisane na sztywno. To błąd licencji nadzorcy z 167, nie wykonawcy —
instrukcja tamtego dyżuru wymieniała tylko plik serwerowy, mimo że pułapka w tej samej
instrukcji mówiła o obu configach. Skala obejścia zmierzona w repo:

```
grep -rln "process.env.DB_TYPE = 'postgres'" tests/ | wc -l   →  80
```

Osiemdziesiąt plików testowych ręcznie nadpisuje `process.env.DB_TYPE` po starcie Vitest, bo
inaczej config i tak przypina `sqlite`. Jeden z nich dokumentuje to wprost —
`tests/integration/auth/day56.session-idle-contract.realpg.test.ts:14-16`:

```ts
// vitest.config pins sqlite after reading the shell; restore the explicitly
// requested real-PG mode for this isolated evidence package.
process.env.DB_TYPE = 'postgres';
```

Defekt jest znany i obchodzony osiemdziesiąt razy zamiast naprawiony raz, w jednym miejscu.

**Druga.** Dyżur 166 (commit `4fecf5bac2`, „fix(day166): persist decision risk fields and
RACI”) zawęził klucz pamięci przeglądarki dla notatek decyzji do organizacji i użytkownika —
dla nowych zapisów działa poprawnie. Ale odczyt w
`src/components/MyWork/DecisionDetailView.tsx:2420-2428` nadal zna i migruje stary,
niezawężony klucz:

```ts
const storageKey = `consultify-decision-enhancements:${currentUser?.organizationId || 'no-organization'}:${currentUser?.id || 'anonymous'}:${id}`;
const legacyStorageKey = `consultify-decision-enhancements:${id}`;
let raw = localStorage.getItem(storageKey);
if (!raw && currentUser?.id) {
  raw = localStorage.getItem(legacyStorageKey);
  if (raw) {
    localStorage.setItem(storageKey, raw);
    localStorage.removeItem(legacyStorageKey);
  }
}
```

Obiekt, który się tam zapisuje (patrz zapis w tym samym pliku, linie 2474–2479), niesie
wyłącznie `schemaVersion`, `savedAt` i treść — zero informacji o właścicielu. Nie ma czym
zweryfikować, czyje to notatki. Skutek: pierwsza osoba, która po wdrożeniu 166 otworzy dowolną
decyzję na tym komputerze, cicho **przejmuje i kasuje** (`removeItem`) cudzy wpis pod starym
kluczem — bez ostrzeżenia, bez kopii.

**Trzecia.** Dyżur 160 (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY160_BRAMA_ZADANIA_REPORT.md`,
sekcja R2) zinwentaryzował **32 miejsca konsumenckie** obsługujące `409` z bramy
`requireCanonicalExecutionWriter` na `/api/tasks`. Wniosek raportu wprost: „co najmniej cztery
powierzchnie są ciche dla użytkownika (`InitiativeTasksTab`, `UserTaskList`,
`InitiativeSidePanel`, `InitiativeCalendar`)”. To są cztery pliki, nie trzy — czwarty,
`InitiativeSidePanel.tsx`, jest w raporcie nazwany wprost, choć nie trafił jeszcze na żadną
listę napraw. Zweryfikowany dziś stan (linie przesunęły się od pomiaru 160, bo plik żył dalej):

- `src/hooks/useActionHandler.ts:439-440` — `toast.error('Failed to create task')` w bloku
  `catch` obejmującym `await` — **wzorzec do naśladowania**, użytkownik widzi błąd.
- `src/components/InitiativeTasksTab.tsx:67-68` (`handleCreateTask`) — `catch (error) {
  console.error('Failed to create task', error); }`. `setIsCreateModalOpen(false)` jest
  wywoływane tylko przy sukcesie (linia 65) — przy błędzie okno zostaje otwarte, a użytkownik
  nie dostaje żadnego komunikatu.
- `src/components/dashboard/UserTaskList.tsx:58-59` (`handleSaveTask`) — `catch (error) {
  setShowModal(false); }`. Modal znika, jakby operacja się udała; brak jakiegokolwiek
  komunikatu o błędzie.
- `src/components/Portfolio/InitiativeSidePanel.tsx:200-209` (`handleTaskSave`) — `catch
  (error: any) { console.error('[InitiativeSidePanel] Failed to save task:', error); }`. Modal
  zostaje otwarty, brak komunikatu.
- `src/components/Initiatives/calendar/InitiativeCalendar.tsx:147-171` (`persist`, reschedule
  przez `PUT /api/pmo/tasks/:id`) — `catch { /* Rollback the optimistic move. */ ... }`. Ruch w
  kalendarzu cofa się wizualnie, ale bez jednego słowa wyjaśnienia dlaczego.

Uwaga na numerację: raport 160 cytuje `InitiativeSidePanel.tsx:203` — dziś ten sam blok jest na
linii 208 (`console.error`), bo plik zmienił się pod wpływem innych dyżurów. Weryfikuj linię w
swoim checkoucie przed edycją, nie ufaj liczbie z raportu.

## Czym ten dyżur NIE jest

Nie jest masową podmianą 80 obejść `DB_TYPE` w testach — to osobna, ryzykowna operacja, którą
`CLAUDE.md` wprost zakazuje robić hurtowo; ten dyżur ją tylko inwentaryzuje i zgłasza do
osobnej decyzji właściciela. Nie jest zdjęciem ani zawężeniem bramy 409 na
`tasks.routes.ts:67` (`requireCanonicalExecutionWriter`) — to decyzja właściciela z osobnego
dyżuru (patrz Wariant A/B w raporcie 160), tu naprawiasz wyłącznie to, co widzi użytkownik po
409, nie samą bramę. Nie jest przeglądem pozostałych 25 pozycji inwentarza 160, które już mają
komunikat (toast/alert) — te zostają nietknięte, zmienia treść tylko tam, gdzie dziś nie ma nic.
Nie jest naprawą `server/vitest.config.ts` — ten plik naprawił 167 i jest nietykalny w tym
dyżurze.

# 2. TEZY ZLECENIA

- **T1.** Poprawka root `vitest.config.ts` (wygrywa zmienna z linii komend, domyślnie
  `sqlite`) nie może po cichu przełączyć istniejących testów na inną bazę. Trzeba zmierzyć
  liczbę testów uruchamianych dziś bez żadnej zmiennej środowiskowej i pokazać identyczną
  liczbę po zmianie — w obu kierunkach (bez zmiennej → nadal `sqlite`; z `DB_TYPE=postgres` w
  powłoce → realnie `postgres`).
- **T2.** 80 ręcznych obejść w `tests/` to fakt do zainwentaryzowania, nie do skasowania w tym
  dyżurze. Naprawa configu nie czyni tych linii nielegalnymi ani błędnymi — zostają, dopóki
  ktoś świadomie nie zdecyduje o ich usunięciu osobno.
- **T3.** Brak informacji o właścicielu w zapisanym obiekcie `consultify-decision-enhancements`
  jest strukturalny, nie przypadkowy — sprawdź to w kodzie zapisu, nie zakładaj. Skoro
  nierozstrzygalne, decyzja projektowa o tym, co zrobić ze starym kluczem, musi wynikać z tego
  faktu, nie z wygody implementacyjnej.
- **T4.** „Cicha powierzchnia” to konkretny, sprawdzalny stan: brak dowolnego komunikatu
  widocznego dla użytkownika (toast/alert/banner) w gałęzi `catch` obsługującej mutację z
  rodziny `/api/tasks`. `console.error` się nie liczy — trafia do konsoli deweloperskiej, nie do
  ekranu użytkownika.

# 3. POZYCJE DYŻURU

## R1 — root config wygrywa zmienną z powłoki, nie zmienia domyślnego zachowania

Zmień `vitest.config.ts:210` z `DB_TYPE: 'sqlite',` na wzorzec identyczny z tym, który 167 już
wprowadził w `server/vitest.config.ts:17`: `DB_TYPE: process.env.DB_TYPE || 'sqlite'`. Nic
więcej w tym bloku `test.env` się nie rusza.

Dowód przed zmianą: uruchom pełny przebieg root Vitest (albo reprezentatywny podzbiór, jeśli
pełny przebieg jest zbyt długi na budżet tego dyżuru — ale wtedy wybierz podzbiór świadomie i
nazwij go w raporcie) bez żadnej zmiennej `DB_TYPE` w powłoce, zapisz `numTotalTests` i
`numPassedTests`. Dowód po zmianie: ten sam przebieg, ten sam brak zmiennej w powłoce — te same
dwie liczby. To dowodzi, że domyślne zachowanie się nie zmieniło.

Drugi kierunek: ustaw `DB_TYPE=postgres` w powłoce przed uruchomieniem i pokaż, że po zmianie
config rzeczywiście to respektuje (np. przez test kontrolny odczytujący
`process.env.DB_TYPE` wewnątrz `test.env`, albo przez istniejący test, który zachowuje się
inaczej na `postgres`). Przed zmianą ten sam eksperyment musi pokazać, że zmienna z powłoki jest
ignorowana — inaczej nie masz dowodu, że naprawiasz cokolwiek.

Zinwentaryzuj (nie napraw) 80 plików z ręcznym `process.env.DB_TYPE = 'postgres'` — lista pełna,
z podziałem: ile z nich jest w `tests/integration/`, ile poza. Zgłoś jako pozycję do osobnej
decyzji właściciela: czy po naprawie configu te 80 linii to teraz martwy, niegroźny balast, czy
jest w nich coś, co realnie zależy od kolejności ustawienia zmiennej (ustawienie po imporcie
modułów, które już przeczytały `process.env` przy starcie) i backfill configu tego nie naprawia.

**Ukończone, gdy:** masz cztery liczby (`numTotalTests`/`numPassedTests` przed i po, bez
zmiennej w powłoce) identyczne parami, dowód że `DB_TYPE=postgres` z powłoki działa po zmianie
i nie działał przed, oraz listę 80 plików z rozbiciem katalogowym.

## R2 — koniec cichego przejmowania notatek decyzji

Zmień wyłącznie blok odczytu w `src/components/MyWork/DecisionDetailView.tsx:2420-2428`.
Zamawiający rekomenduje wariant (b) — **nie czytaj starego klucza w ogóle** — bo dane pod
`consultify-decision-enhancements:${id}` są danymi szkicowymi w przeglądarce, nierozstrzygalnymi
co do właściciela (sam zapisany obiekt, patrz sekcja 1, nie niesie identyfikatora użytkownika),
więc bezpieczniej zostawić je nietknięte niż zgadywać i przypisać niewłaściwej osobie. Zmierz
sam, zanim zdecydujesz ostatecznie — rozważ i uzasadnij (albo obal) warianty:

- (a) kopiować bez kasowania (`setItem` na nowym kluczu, ale bez `removeItem` starego) — problem:
  następna osoba nadal widzi i migruje ten sam stary klucz, tylko już nie kasuje go za pierwszym
  razem; ryzyko przesuwa się w czasie, nie znika.
- (b) nie czytać starego klucza w ogóle — dane pod starym kluczem stają się martwe (nikt ich nie
  odczyta), ale też nikt ich nie skasuje i nikt nie przejmie cudzej notatki.
- (c) czytać, ale nie migrować automatycznie — pokazać w UI ostrzeżenie/pytanie zamiast cichego
  `setItem`+`removeItem`. Rozważ koszt: to zmiana zachowania widoczna dla użytkownika, a licencja
  ogranicza cię do bloku odczytu, nie do zmian wyglądu.

Cokolwiek wybierzesz, `localStorage.removeItem(legacyStorageKey)` nie może wykonać się jako
efekt uboczny odczytu przez kogoś, kto nie jest zweryfikowanym właścicielem tego wpisu.

Poza zakresem, ale zauważone przy okazji: `consultify-decision-draft` (linia 1824,
`` `consultify-decision-draft:${decisionId || 'new'}` ``) nie jest scopowany po organizacji ani
użytkowniku wcale — to osobny klucz, osobna funkcja (`persistDraft`), i nie jest częścią bloku
2420-2428 objętego licencją tego dyżuru. Nie dotykaj go — zapisz w raporcie jako odkrycie do
osobnej decyzji, nie rozszerzaj zakresu na własną rękę.

**Ukończone, gdy:** masz dowód mutacyjny — scenariusz z dwoma symulowanymi użytkownikami na tym
samym stanie `localStorage` (stary klucz zapisany przez „użytkownika A”), pokazujący, że po
Twojej zmianie „użytkownik B” nie nadpisuje ani nie kasuje wpisu A — i masz jedno zdanie
uzasadnienia, dlaczego wybrany wariant jest bezpieczniejszy niż pozostałe dwa.

## R3 — cztery ciche powierzchnie z inwentarza dyżuru 160

Sprawdź pozostałe pozycje raportu `CODEX_DAY160_BRAMA_ZADANIA_REPORT.md` (tabela sekcji R2, 32
wiersze) i potwierdź w dzisiejszym stanie repo, które są nadal ciche. Zweryfikowany dziś stan:
cztery pliki, pięć miejsc — `InitiativeTasksTab.tsx:67-68` (create), `UserTaskList.tsx:58-59`
(create), `InitiativeSidePanel.tsx:208` (update zadania z panelu bocznego),
`InitiativeCalendar.tsx` (`persist`, ok. linii 147-171, rollback reschedule). Dla każdego dodaj
widoczny komunikat błędu wzorem `useActionHandler.ts:439-440` — użytkownik ma zobaczyć, że zapis
się nie udał. Nie zmieniaj treści komunikatów tam, gdzie już istnieją (pozostałe ~27 pozycji
inwentarza 160 z toastem/alertem zostają nietknięte).

Dopasuj formę komunikatu do konwencji pliku, nie do jednego sztywnego wzorca:
`InitiativeTasksTab.tsx` i `UserTaskList.tsx` nie importują dziś ani `react-hot-toast`, ani
`react-i18next` — dodaj `import toast from 'react-hot-toast'` i prosty angielski string, wzorem
`useActionHandler.ts` (`toast.error('Failed to create task')` /
`toast.error('Failed to save task')`). `InitiativeSidePanel.tsx` już importuje oba
(`toast` w linii 32, `useTranslation`/`t` w linii 33) i ma istniejący wzorzec w tym samym pliku
(`toast.error(t('portfolio.toast.gateDecisionError', 'Nie udało się utworzyć decyzji bramki'))`,
linia 277) — nowy komunikat dla `handleTaskSave` ma iść przez `t()` z polskim tekstem, tym samym
kluczem-konwencją (`portfolio.toast.*`), nie angielskim stringiem na sztywno.
`InitiativeCalendar.tsx` nie importuje dziś `toast` — sprawdź, czy plik ma dostęp do
`useTranslation` (ma, linia 14) i zdecyduj, czy toast idzie przez `t()` czy zwykły string, patrząc
na to, co robią sąsiednie komponenty kalendarza w tym samym katalogu; nie zgaduj wzorca, sprawdź
go.

Nie ruszaj pozostałych `console.error` w tych samych plikach, które nie są w inwentarzu 160 (np.
`fetchTasks`/`fetchDecisions` w `InitiativeSidePanel.tsx` na liniach 155 i 177, czy `handleUpdateTask`/
bulk update/AI-generation w `InitiativeTasksTab.tsx`) — to inne mutacje, poza `409` z bramy
`/api/tasks`, i naprawianie ich przy okazji jest dokładnie tym rozlewaniem się zakresu, którego
ten dyżur ma unikać. Jeśli po weryfikacji stwierdzisz, że w inwentarzu 160 jest więcej niż te
pięć cichych miejsc (raport mówi „co najmniej cztery” — nie zamyka listy), dopisz je do raportu z
cytatem plik:linia i albo napraw wzorem powyższym, albo — jeśli wychodzisz poza cztery imiennie
wskazane pliki — zatrzymaj się i zgłoś jako osobną pozycję zamiast rozszerzać tabelę licencji na
własną rękę.

**Ukończone, gdy:** wszystkie potwierdzone dziś ciche miejsca (minimum pięć, w czterech plikach)
pokazują użytkownikowi komunikat błędu przy 409, a raport wymienia dokładną liczbę sprawdzonych
pozycji z inwentarza 160, dokładną liczbę cichych i dokładną liczbę naprawionych — z uzasadnieniem
każdej rozbieżności między tymi trzema liczbami.

## R4 — dowody

Dla R1: patrz „Ukończone, gdy” w R1 — dowód liczbowy przed/po w obu kierunkach (domyślne
zachowanie niezmienione + `DB_TYPE=postgres` z powłoki respektowane).

Dla R2: patrz „Ukończone, gdy” w R2 — scenariusz dwóch użytkowników na współdzielonym
`localStorage`, dowodzący braku przejęcia/kasowania cudzego wpisu po zmianie.

Dla R3: test (lokalizację i konwencję zweryfikuj sam — w repo współistnieją co najmniej dwie:
pliki `*.test.tsx` w `tests/components/<ścieżka>/`, jak istniejący
`tests/components/dashboard/UserTaskList.test.tsx`, oraz katalogi `__tests__` obok komponentu,
jak `src/components/MyWork/__tests__/`; dopasuj do tego, co już istnieje najbliżej zmienianego
pliku, a jeśli nic nie istnieje — użyj `tests/components/<katalog-komponentu>/day173.<nazwa>.silent-failure.test.tsx`),
który dla każdego z czterech naprawionych plików symuluje odpowiedź `409` z mocka API i
sprawdza, że na ekranie/w warstwie `toast` pojawia się komunikat błędu — nie tylko że
`console.error` został wywołany.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `vitest.config.ts` (korzeń repo) — wyłącznie linia `DB_TYPE` w bloku `test.env` |
| Zapis | `src/components/MyWork/DecisionDetailView.tsx` — wyłącznie blok odczytu klucza pamięci, linie 2420-2428; **zakaz innych zmian w tym pliku**, w tym `consultify-decision-draft` (linia 1824) |
| Zapis | `src/components/InitiativeTasksTab.tsx` — wyłącznie `handleCreateTask` (catch, ok. linii 67-68) i jego import `toast` |
| Zapis | `src/components/dashboard/UserTaskList.tsx` — wyłącznie `handleSaveTask` (catch, ok. linii 58-59) i jego import `toast` |
| Zapis | `src/components/Portfolio/InitiativeSidePanel.tsx` — wyłącznie `handleTaskSave` (catch, ok. linii 200-209); zakaz zmian w `fetchTasks`/`fetchDecisions`/`handleRequestGate` w tym samym pliku |
| Zapis | `src/components/Initiatives/calendar/InitiativeCalendar.tsx` — wyłącznie `persist` (catch, ok. linii 147-171) |
| Zapis | ewentualne dodatkowe pliki z inwentarza 160 potwierdzone jako ciche podczas weryfikacji R3 — dopisz je tu imiennie w raporcie z cytatem plik:linia, zanim je zmienisz; nie rozszerzaj poza cztery wskazane pliki bez takiego zapisu |
| Zapis | testy `day173.*` — lokalizację potwierdź wg konwencji sąsiadującej z każdym zmienianym plikiem (patrz R4) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY173_DOMKNIECIA_REPORT.md` |
| Odczyt | `server/vitest.config.ts` — wzorzec do skopiowania; **nie zmieniasz tego pliku**, naprawił go dyżur 167 |
| Odczyt | `tests/integration/auth/day56.session-idle-contract.realpg.test.ts` — dowód istnienia obejścia; nie zmieniasz |
| Odczyt | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY160_BRAMA_ZADANIA_REPORT.md` — źródło inwentarza R3; nie zmieniasz |
| Odczyt | `src/hooks/useActionHandler.ts` (linie 439-440) — wzorzec komunikatu; nie zmieniasz |
| Odczyt | 80 plików z `tests/` ustawiających ręcznie `process.env.DB_TYPE = 'postgres'` — tylko inwentaryzacja, zero zmian |

**Nietykalne imiennie:** `server/vitest.config.ts` (własność dyżuru 167); brama
`server/src/routes/pmo/tasks.routes.ts:67` (`requireCanonicalExecutionWriter`) i cała logika
409 — zmieniasz komunikat po stronie klienta, nie bramę; pozostałe ~27 pozycji inwentarza 160,
które już mają toast/alert; `consultify-decision-draft` w `DecisionDetailView.tsx`.

★ **Rozłączność z dyżurami działającymi równolegle:** 163 (`TaskDetailView.tsx`,
`tasks.routes.ts`, `TaskController.ts`, `task.validators.ts`), 165 (`agent-plan.routes.ts`,
`aiWorker.ts`, `AgentPlanPanel.tsx`), 170 (`okr.routes.ts`, `OkrCheckInRecordDialog.tsx`), 171
(`kpiScorecards/**`, `Economics/**`), 172 (`InitiativeDocumentView.tsx`, `ExceleView.tsx`). Nie
dotykasz żadnego z tych plików.

★ **Pułapka nazw i ścieżek, zweryfikowana w repo — dwie różne rzeczy o podobnej nazwie:**
`InitiativeTasksTab.tsx` (Twój, ten dyżur) leży w `src/components/InitiativeTasksTab.tsx` —
**bezpośrednio w `src/components/`, NIE w `src/components/Initiatives/`**. `InitiativeDocumentView.tsx`
(własność dyżuru 172) leży w `src/components/Initiatives/InitiativeDocumentView.tsx` —
osobny katalog. Nie pomyl ścieżek — to nie jest ten sam folder, mimo bardzo podobnych nazw
plików.

# 5. TWARDE ZASADY

- ★ **NIE ROBISZ MASOWEJ PODMIANY.** `CLAUDE.md` ostrzega wprost — masowa podmiana raz już
  zniszczyła wydane instrukcje. 80 obejść `DB_TYPE` w `tests/` to inwentarz do zgłoszenia
  właścicielowi, nie operacja tego dyżuru. R3 dotyczy imiennie wskazanych plików; jeśli podczas
  weryfikacji znajdziesz więcej niż pięć cichych miejsc, dopisz je do raportu zamiast naprawiać
  bez zapisu.
- ★ **NIE ZDEJMUJESZ I NIE ZAWĘŻASZ BRAMY 409** (`requireCanonicalExecutionWriter` w
  `server/src/routes/pmo/tasks.routes.ts`, montaż w `Gateway.ts`) — to osobna decyzja
  właściciela (Wariant A/B z raportu 160). Naprawiasz komunikat po stronie klienta, nie bramę.
- **NIE ZMIENIASZ `server/vitest.config.ts`.** Naprawił go dyżur 167; ten dyżur naprawia
  wyłącznie root `vitest.config.ts`.
- **Nie zmieniasz wyglądu** poza dodaniem brakujących komunikatów o błędzie tam, gdzie dziś nie
  ma żadnego.
- **Nie zmieniasz treści istniejących komunikatów** — dodajesz tylko tam, gdzie ich nie ma.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wszystko lokalnie.
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0 w każdym
  wyniku, który przywołujesz jako dowód.
- Pułapka ogólna programu: `migrate.postgres.ts` uruchamiany z korzenia repo; bez
  `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB — ten dyżur jest frontendowy/config, ale
  jeśli którykolwiek dowód dotknie backendu, pamiętaj o tym przełączniku.
- ★ Port **5000 jest zajęty na stałe przez macOS Control Center** — nie używaj go do żadnego
  serwera pomocniczego.
- Wymóg sekcji „TWIERDZENIA NIEZWERYFIKOWANE” w raporcie końcowym — wypisz w niej wprost, jeśli
  nie zdążyłeś zweryfikować pełnych 32 pozycji inwentarza 160 albo jeśli test R4 dla R3 pokrył
  mniej niż wszystkie cztery pliki.
