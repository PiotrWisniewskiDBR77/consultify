# INSTRUKCJA DYŻURU nr 172 — Codex — „Dwa ekrany klamia - karta inicjatywy bez przycisku glownego i 'Zadanie ukonczone' obok licznika zero"

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
> **wyłącznie** `/private/tmp/cx-day172-ekrany-nieprawda`.

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
Zakres: **Inicjatywy (karta) oraz Czat/Teresa (arkusz, tabela, prezentacja)**.
Trasy front: ``src/components/Initiatives/InitiativeDocumentView.tsx`, `src/components/AIChat/KimiWorkspace/ExceleView.tsx`, `src/components/AIChat/KimiWorkspace/TabeleView.tsx`, `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx`, `src/services/initiativeWriteTruth.ts``. Trasy tył: ``server/src/routes/workbook.routes.ts` (zwrot logu krokow) oraz `server/src/routes/pmo/initiatives.routes.ts` - do odczytu`.

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
WT=/private/tmp/cx-day172-ekrany-nieprawda
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
git -C "$VAULT" worktree add "$WT" -b codex/day172-ekrany-nieprawda-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day172-ekrany-nieprawda/config.worktree"
cat "$VAULT/worktrees/cx-day172-ekrany-nieprawda/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day172-ekrany-nieprawda-scratch
mkdir -p /private/tmp/cx-day172-ekrany-nieprawda-artefakty

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
git -C "$WT" push github-backup codex/day172-ekrany-nieprawda-20260830
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
cd /private/tmp/cx-day172-ekrany-nieprawda

# (T1) FRONT RZUCA BEZWARUNKOWO, NIE PYTAJAC SERWERA
sed -n '268,284p' src/services/initiativeWriteTruth.ts
#   oczekiwane: rzut BEZ jakiegokolwiek wywolania sieciowego. To jest pewne.

# (T2) ★ A BACKEND MA ZYWY SILNIK PRZEJSC
sed -n '3109,3118p' server/src/routes/pmo/initiatives.routes.ts
#   oczekiwane: PATCH /:id/status -> InitiativeController.updateInitiativeStatus
#   -> executeInitiativeTransition (2080 linii, z wlasnymi testami).
#   ★ To sugeruje, ze DEC-104 mogla sie ZDEZAKTUALIZOWAC. Zmierz to realnym zadaniem.

# (T3) CZY SCIEZKA STATUSU JEST ZA BRAMA 409
sed -n '160p' server/src/routes/pmo/initiatives.routes.ts
grep -n "LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS" -A 6 server/src/middleware/executionSpineLegacyReadOnly.middleware.ts
#   oczekiwane: /status NIE jest na liscie blokowanych wzorcow. Potwierdz sam.

# (T4) LOG KROKOW ARKUSZA ISTNIEJE W BAZIE, ALE NIE WRACA
grep -n "pipeline_log" server/src/services/**/workbookCreationService.ts server/src/routes/workbook.routes.ts
#   oczekiwane: zapisywany przy tworzeniu, NIGDY nie zwracany przez GET.
#   Stad '0/8' mimo ze dane istnieja.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day172-ekrany-nieprawda-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6070`. Twój JEDYNY port harnessu to `5014 i 5015`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day172-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6055 oraz 6061-6067 (odbiory nadzorcy), 6051/4994-4995 (163), 6068/5010-5011 (170), 6069/5012-5013 (171), 6071/5016-5017 (173). ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak - ten dyzur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartosci domyslnej zadnej istniejacej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY172_EKRANY_NIEPRAWDA_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day172-ekrany-nieprawda-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day172-ekrany-nieprawda-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE ODSLANIASZ AKCJI, KTORA RZUCA BLEDEM.** Jesli pomiar R1 wykaze, ze zapis statusu nadal jest zepsuty - **naprawiasz zapis**, nie odslaniasz przycisk. Przycisk nad zepsuta sciezka to **pogorszenie**: uzytkownik traci zaufanie do ekranu. ★ **NIE ZMYSLASZ KROKOW ARKUSZA.** Dla Tabel i Prezentacji **nie ma z czego odtworzyc realnych krokow** - kolumny logu tam nie ma. Wariant 'pokaz kroki' jest tam **zmysleniem** i jest zakazany. **NIE ZMIENIASZ WYGLADU poza tym, co wynika z naprawy stanu.** Przywrocenie brakujacego przycisku i uzgodnienie napisu z licznikiem sa dozwolone. Uklad, kolory, typografia, pozostale teksty - **nie**. Odbior wizualny nalezy do tora grafiki i wejdzie osobno. **NIE ZDEJMUJESZ I NIE ZAWEZASZ BRAMY 409** (`initiatives.routes.ts:160`). **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji.** | Oba zgloszone przez tor GRAFIKI. Karta inicjatywy **nie ma przycisku glownego** - inicjatywy nie da sie popchnac do przodu z jej wlasnego ekranu. A przy ponownym otwarciu zapisanego arkusza naglowek pokazuje zielony ptaszek i napis 'Zadanie ukonczone' **obok licznika 0/8**. Wlasciciel nazwal to drugie pilnym: **to jedyna rzecz na szesciu ekranach arkusza, ktora na prawdziwym pokazie kaze klientowi zapytac 'to jest gotowe czy nie?'** |

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
cd /private/tmp/cx-day172-ekrany-nieprawda

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day172-pg psql -U postgres -d cx172 \
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
cd /private/tmp/cx-day172-ekrany-nieprawda

docker run -d --name cx-day172-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx172 \
  -p 127.0.0.1:6070:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day172-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6070/cx172 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6070/cx172 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day172-ekrany-nieprawda && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6070/cx172 \
JWT_SECRET=cx172-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day172-ekrany-nieprawda-artefakty/day172-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day172-ekrany-nieprawda && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day172-ekrany-nieprawda-artefakty/day172-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day172-ekrany-nieprawda/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day172-pg psql -U postgres -d cx172 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day172-pg`.
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
> **(e) ★★ **Pierwsza, i zmienia caly ksztalt R1: front rzuca wyjatkiem BEZ PYTANIA SERWERA.** `updateInitiativeStatusWriteTruth` (`src/services/initiativeWriteTruth.ts:268-284`) rzuca **bezwarunkowo, bez jakiegokolwiek wywolania sieciowego**. A backend ma **zywy silnik przejsc**: `PATCH /api/initiatives/:id/status` (`initiatives.routes.ts:3109-3118`) -> `InitiativeController.updateInitiativeStatus` -> `executeInitiativeTransition` (2080 linii, z wlasnymi testami jednostkowymi). **Front nigdy nie dzwoni do dzialajacego backendu.** To mocno sugeruje, ze decyzja `DEC-104` **sie zdezaktualizowala** - ale **to jest hipoteza i masz ja ZMIERZYC realnym zadaniem HTTP**, nie zalozyc. Sprawdz tez, czy sciezka `/status` nie wpada w brame z `initiatives.routes.ts:160` - statycznie **nie** jest na liscie blokowanych wzorcow. ★★ **Druga: ten sam blad jest w TRZECH ekranach, nie w jednym.** Zgloszenie grafika wymienialo tylko `ExceleView.tsx:312`, ale identyczny wzorzec `effectiveCompleted` siedzi w `TabeleView.tsx:294` i `PrezentacjeView.tsx:664`. **Naprawa jednego zostawilaby dwie siostry dalej klamiace** - a to jest dokladnie ten ksztalt, ktory dzis wielokrotnie udawal gotowe. ★★ **Trzecia, rozstrzygajaca dla R3: dane SA w bazie, ale tylko dla arkusza.** `generated_workbooks.pipeline_log` jest realnie zapisywany przy tworzeniu (`workbookCreationService.ts:96-107`), ale `GET /api/workbook/:id` (`workbook.routes.ts:4129-4213`) **nigdy go nie zwraca**. Stad '0/8' mimo ze prawda istnieje. Dla `tp_tables` i `presentation_decks` **kolumny logu NIE MA w ogole** - sprawdzone we wszystkich `CREATE TABLE` i `ALTER TABLE`. **Wniosek: wariant (a) 'pokaz realne kroki' jest wlasciwy WYLACZNIE dla arkusza.** Dla tabel i prezentacji wybierz (b) albo (c) i **uzasadnij** - tam wariant (a) bylby zmysleniem. **Czwarta: `DB_TYPE` przypiety do `sqlite` w `vitest.config.ts:210` ORAZ `server/vitest.config.ts:17` (ten drugi naprawiony dyzurem 167). **W raporcie napisz WPROST, jakiego configu uzyles i gdzie lezy****
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day172-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day172-ekrany-nieprawda-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycje R2 i R3 - inicjatywe da sie popchnac z jej wlasnego ekranu, a napis o ukonczeniu przestaje stac obok zera`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6070` albo `5014 i 5015` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6070` albo `5014 i 5015`** (`Z7`).

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

Tor GRAFIKI zgłosił do toru FUNKCJI dwie rzeczy, które nie są sprawą wyglądu — `docs/program/KOORDYNACJA.md`, sekcje z 2026-08-30 „Karta inicjatywy nie ma przycisku głównego” i „Zadanie ukończone 0/8”. W obu przypadkach grafika **znalazła przyczynę czytaniem kodu i świadomie się zatrzymała**, bo naprawa wymaga decyzji o stanie, nie o pikselu.

**Karta inicjatywy.** `statusActions` w `InitiativeDocumentView.tsx:1431-1433` jest twardo `[]` od DEC-104 (komentarz `InitiativeDocumentView.tsx:1416-1430`, 2026-08-26). Powód zapisany w kodzie: `updateInitiativeStatusWriteTruth` (`src/services/initiativeWriteTruth.ts:268-284`) rzucał wyjątkiem dla KAŻDEGO statusu docelowego, więc każdy przycisk zmiany statusu na karcie był gwarantowaną porażką pokazywaną jako surowy toast. Wyłączenie przycisków było wtedy słuszne. Ale minęły cztery dni robocze i backend mógł się zmienić — a jeśli DEC-104 dziś nie jest już prawdą, inicjatywy nie da się popchnąć do przodu z jej własnego ekranu bez powodu.

**Arkusz „ukończony” przy zerze kroków.** `ExceleView.tsx:312`:
```
const effectiveCompleted = pipeline.isCompleted || (!!reopenPreview && !pipeline.currentRun);
```
Ponowne otwarcie zapisanego pliku ustawia `effectiveCompleted = true` (zielony ptaszek, napis „Task completed” — klucz i18n `kimi.taskCompleted`, render w `KimiWorkspaceShell.tsx:354-355`), ale licznik obok (`KimiWorkspaceShell.tsx:360-362`, `{completed}/{total}`) dalej czyta `pipeline.completedSteps`/`pipeline.totalSteps` — a te liczą kroki z `currentRun`, który przy ponownym otwarciu **nie istnieje** (`useKimiArtifactPipeline.ts:514-516`: `effectiveStatus` jest `null` bez `currentRun`; `mapRunToSteps(null, …)` w linii 236-238 zwraca wszystkie 8 kroków z `PIPELINE_STEPS` — lista zdefiniowana w liniach 207-216 — jako `pending`). Stąd dokładnie `0/8` obok zielonego „ukończone”. Grafika napisała wprost, dlaczego nie naprawiła tego sama: *„naprawa w torze grafiki byłaby zgadywaniem, który licznik jest prawdziwy”* — i to jest właściwe pytanie na ten dyżur.

## Czym ten dyżur NIE jest

Nie jest przeprojektowaniem karty inicjatywy ani szyny arkusza — layout, kolory, typografia i pozostałe teksty zostają dokładnie takie, jak są. Odbiór wizualny wraca do toru grafiki osobno, po tym dyżurze. Nie jest też zamknięciem tematu gate-workflow jako całości (kolejki `GateSignoffQueue`, `AnalysisDecisionQueue` itd. w My Work) — te zostają nietknięte; ten dyżur dotyka wyłącznie ścieżki zapisu, którą karuje `statusActions` na samej karcie inicjatywy.

# 2. TEZY ZLECENIA

- **T1.** DEC-104 mogła się zdezaktualizować. Backend ma realny silnik przejść (`server/src/services/initiative/initiativeTransitionService.ts`, 2080 linii, wpięty pod `PATCH /api/initiatives/:id/status` — `server/src/routes/pmo/initiatives.routes.ts:3109-3118`) z własnymi testami jednostkowymi (`server/src/services/initiative/__tests__/initiativeTransitionService.*.test.ts`). Cała otoczka na froncie — preflight (`getInitiativeStatusPreflightTruth`, `initiativeWriteTruth.ts:95-120`), miękka bramka dowodowa, `gate-ai-check` (`InitiativeDocumentView.tsx:3120-3139`) — zakłada, że na końcu jest prawdziwy zapis. Jedyne ogniwo, które NIGDY nie sięga do sieci, to `updateInitiativeStatusWriteTruth` — rzuca `throw` zanim cokolwiek wywoła. To trzeba zmierzyć realnym żądaniem, nie założyć z żadnej strony.
- **T2.** Jeśli pomiar pokaże, że zapis nadal jest zepsuty (dla wszystkich albo części statusów), przywrócenie przycisku nad zepsutą ścieżką jest pogorszeniem — użytkownik traci zaufanie do całego ekranu, nie tylko do jednego przycisku. Naprawa idzie przed odsłonięciem.
- **T3.** „Zadanie ukończone 0/8” to fałsz o stanie, nie o kolorze. Zielony ptaszek i pusty licznik nie mogą współistnieć niezależnie od tego, który z nich jest „bardziej prawdziwy” — trzeba rozstrzygnąć, co ekran ma pokazywać przy ponownym otwarciu, i to rozstrzygnięcie musi wynikać z tego, co faktycznie da się odtworzyć z danych, nie z domysłu.
- **T4.** Kroki przebiegu generowania arkusza MOGĄ być zapisane w bazie z chwili tworzenia pliku (kolumna istnieje) — ale czy faktycznie tam są i czy da się je bezpiecznie odczytać przy ponownym otwarciu, to osobne pytanie od tego, czy kolumna istnieje. Zmierz, nie zakładaj.

# 3. POZYCJE DYŻURU

## R1 — czy przejście statusu inicjatywy dziś naprawdę rzuca wyjątkiem

Nie czytaj tylko kodu — **wywołaj prawdziwe żądanie** na lokalnym serwerze + Postgresie tego dyżuru.

1. Zasiej lokalnie inicjatywę w statusie `DRAFT` należącą do organizacji testowego aktora z rolą `CONSULTANT` albo `INITIATIVE_OWNER` (rola wystarcza do `SUBMIT_FOR_REVIEW` bez zewnętrznego zatwierdzającego — `server/src/constants/initiativeStatuses.ts:119`, `:151-153`: `DRAFT → PENDING_REVIEW`, brak `assignedApprovers`). To najprostszy, samoobsługowy przypadek — jeśli on nie działa, żaden inny nie zadziała.
2. Wywołaj `PATCH /api/initiatives/:id/status` z `{ status: 'PENDING_REVIEW' }` bezpośrednio (Twoim testem/curlem), **z pominięciem** obecnego frontendowego stubu — bo ten rzuca zawsze, bez sięgania do sieci (`initiativeWriteTruth.ts:268-284`, weryfikowalne statycznie: `throw new Error(...)` na pierwszej linii ciała funkcji, żadnego `await` przed nim).
3. Zapisz dosłowny status HTTP i treść odpowiedzi. Sprawdź `initiatives.status`, `initiative_status_history`, `initiative_history` w bazie przed i po.
4. Sprawdź też, czy `router.use(requireCanonicalInitiativeExecutionWriter)` (`initiatives.routes.ts:160`, implementacja `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:52-75`) blokuje tę ścieżkę — statycznie NIE powinien: lista `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS` (linie 52-56) obejmuje `start-execution|block|unblock|move`, `milestones|resources|staffing-plans|budget-items|raid|gate-roles`, `lifecycle-transition-*`, `apply-template|apply-blueprint` — **nie** `/status`. Potwierdź to realnym żądaniem, nie tylko regexem na oko.
5. Powtórz próbę dla przejścia, które WYMAGA zewnętrznego zatwierdzającego (np. `APPROVE`, rola `STEERING_COMMITTEE`, `initiativeStatuses.ts:127`) wykonanego przez aktora BEZ tej roli — oczekiwany wynik to jawne `403`/`422` z powodem, nie `500` ani cichy sukces.

**Ukończone, gdy:** masz tabelę: `targetStatus → HTTP status → czy zapis w `initiatives`/`initiative_status_history` się wykonał`, dla co najmniej dwóch przypadków (self-service i wymagający approvera), z dowodem SQL przed/po. Wynik R1 decyduje R2 wprost:
- **Gałąź A — zapis działa dla self-service przejść:** R2 = przywrócenie `statusActions` ograniczone do przejść, które `gateReadiness.availableTransitions[].canCurrentUserExecute` faktycznie oznacza jako wykonalne, ORAZ przepięcie `updateInitiativeStatusWriteTruth` tak, by wołała `PATCH /api/initiatives/:id/status` zamiast rzucać na starcie.
- **Gałąź B — zapis nadal rzuca (backend, nie tylko stub):** R2 = naprawa backendu (`executeInitiativeTransition` albo trasy), z tym samym dowodem mutacyjnym, i DOPIERO PO tym odsłonięcie przycisku. Jeśli w czasie dyżuru B nie da się domknąć, `statusActions` ZOSTAJE `[]` — zgłoś to jako otwartą pozycję w raporcie, nie jako zamkniętą.

## R2 — przywrócenie możliwości popchnięcia inicjatywy (kształt zależny od R1)

★ **Nie odsłaniasz akcji, która wywoła błąd.** Jeżeli po naprawie/potwierdzeniu części przejść inne przejścia nadal nie działają (np. brakuje ról testowych do zmierzenia), `statusActions` filtruje TYLKO potwierdzone realnym żądaniem — nie „prawdopodobnie działające”.

Zmiana ograniczona do:
- `src/components/Initiatives/InitiativeDocumentView.tsx` — zdjęcie hardkodu `[]` (linie 1431-1433) na obliczenie z `gateReadiness.availableTransitions`, zgodnie z tym, co już robi reszta pliku (kebab/pill/CTA czytają `statusActions`/`stripStatusActions`/`primaryLifecycleAction` bez zmian kształtu — te trzy pochodne zostają, zmienia się tylko źródło).
- `src/services/initiativeWriteTruth.ts` — `updateInitiativeStatusWriteTruth` (linie 268-284) zaczyna faktycznie wołać `PATCH /api/initiatives/:id/status` (klient `Api.patch`, `src/services/api.ts:12159`) zamiast rzucać bezwarunkowo. Zachowaj obecny kontrakt zwrotny (`InitiativeWriteTruthBundle`) — reszta `commitStatusTransition` (linie 3153-3169) go już konsumuje.
- Ewentualna naprawa w `server/src/services/initiative/initiativeTransitionService.ts` — TYLKO jeśli R1 gałąź B to wykaże, i tylko punktowo (nie przepisujesz silnika).

Zero zmiany układu/kolorów/etykiet poza tym, co wynika z pojawienia się realnych przycisków (np. usunięcie martwego `readMode`-only stanu, jeśli istniał tylko dlatego, że akcji nigdy nie było — sprawdź, nie zakładaj).

**Ukończone, gdy:** karta inicjatywy w stanie `DRAFT` (lokalnie, Twoim aktorem testowym) pokazuje realny przycisk `Submit for Review`, klik wykonuje `PATCH .../status`, status w bazie i na ekranie się zgadza, i toast sukcesu/błędu odpowiada rzeczywistemu wynikowi serwera — nie zaślepce.

## R3 — uczciwy stan arkusza przy ponownym otwarciu

**Zanim wybierzesz wariant — sprawdź bazę, nie zgaduj.** Kolumna `generated_workbooks.pipeline_log` (`server/migrations/756_interview_insight_downstream_lineage.sql:24`, potwierdzona ponownie w `20260802_mat006_workbook_lifecycle.sql:46`) jest zapisywana PRZY TWORZENIU arkusza — `server/src/services/workbook/workbookCreationService.ts:96-107`, kolumna nr 12 w INSERT, wartość `JSON.stringify(input.pipelineLog??[])` (linia 104), realne fazy budowane przez `WorkbookGeneratorService.ts` (`pipelineLog.push({...})`, np. linie 761-871). To dane, nie martwa kolumna. Ale `GET /api/workbook/:id` (`server/src/routes/workbook.routes.ts:4129-4213`) — endpoint, którego reopen faktycznie używa (`src/utils/spreadsheetArtifactIdentity.ts:34`, `loadWorkbook: (id) => Api.get('/workbook/'+id)`) — **nie selekcjonuje ani nie zwraca `pipeline_log`** (SELECT w liniach 4166, response w liniach 4184-4211: obu brak). Dane są w bazie, ale nie docierają do przeglądarki.

**Dla Tabel i Prezentacji sytuacja jest inna — zmierz osobno.** Ten sam wzorzec `effectiveCompleted = pipeline.isCompleted || (!!reopenPreview && !pipeline.currentRun)` istnieje identycznie w `TabeleView.tsx:294` i `PrezentacjeView.tsx:664` (oba karmią `KimiWorkspaceShell` tymi samymi `pipeline.totalSteps`/`pipeline.completedSteps` — `TabeleView.tsx:478-481`, `PrezentacjeView.tsx:879-882`), więc „0/8 gotowe” pojawi się tam identycznie. Ale tabele (`tp_tables`, `server/migrations/700_table_platform_foundation.sql`) i decki (`presentation_decks`, `server/migrations/750_presentation_decks_00base.sql`) **nie mają** kolumny odpowiadającej `pipeline_log` — sprawdzone grepem po wszystkich `ALTER TABLE`/`CREATE TABLE` dla obu nazw, zero trafień z `log`/`step`/`phase`. Potwierdź to sam na żywym schemacie (`\d tp_tables`, `\d presentation_decks`) zanim zdecydujesz — migracje mogły się zmienić.

Trzy warianty z zadania, z rekomendacją per artefakt:
- **(a) Pokaż rzeczywiste kroki zapisanego przebiegu.** Rekomendowane dla **Excele/workbook** — dane są w `pipeline_log`, wystarczy je zwrócić z `GET /:id` i zmapować na `taskSteps`-kształt przy `reopenPreview` (miejsce: `ExceleView.tsx` — nowy `effectiveCompletedSteps`/`effectiveTotalSteps` obok `effectiveCompleted`, karmiony z odpowiedzi reopena zamiast z `pipeline.*` gdy `currentRun` jest `null`).
- **(b) Nie pokazuj licznika przy ponownym otwarciu** albo **(c) pokaż stan „zapisany plik” zamiast „ukończone zadanie”** — jeden z tych dwóch dla **Tabel i Prezentacji**, skoro tam nie ma z czego odtworzyć realnych kroków, a wymyślanie liczby byłoby dokładnie tym błędem, przed którym ostrzega zlecenie („zmyślenie byłoby gorsze niż jego brak” — ten sam standard, którym grafika już osądziła sprawę walut w Finansach, `KOORDYNACJA.md` linia 42). Wybierz jeden i uzasadnij pisemnie w raporcie który i dlaczego — nie zostawiaj otwarte.

Zmiana obejmuje (jeśli wybierzesz (a) dla Excele): `server/src/routes/workbook.routes.ts` (SELECT + pole w odpowiedzi `GET /:id`), `src/utils/spreadsheetArtifactIdentity.ts` (przeniesienie pola przez typ), `src/components/AIChat/KimiWorkspace/ExceleView.tsx` (użycie przy reopen). Dla Tabel/Prezentacji — wyłącznie `TabeleView.tsx`/`PrezentacjeView.tsx` (zmiana `effectiveCompleted`/etykiety źródła danych, bez dotykania `KimiWorkspaceShell.tsx` układu). Jeśli `KimiWorkspaceShell.tsx` wymaga nowego propa (np. `progressLabel`) żeby wariant (c) się dało wyrazić bez kłamania — dopisz prop, nie zmieniaj layoutu wokół niego.

**Ukończone, gdy:** dla KAŻDEGO z trzech ekranów (Excele/Tabele/Prezentacje) po ponownym otwarciu zapisanego pliku napis i licznik obok siebie opisują TEN SAM stan — nie dwa różne. Excele pokazuje realne kroki z bazy (jeśli wariant (a) potwierdzony jako wykonalny) lub żaden z trzech ekranów nie twierdzi „ukończone” obok zera.

## R4 — dowody

Dla R1/R2 (status inicjatywy): dowód mutacyjny na `PATCH /api/initiatives/:id/status` — zepsuj celowo (np. przywróć chwilowo `throw` w `updateInitiativeStatusWriteTruth`), pokaż że test/klik pada z jawnym komunikatem, przywróć, pokaż zielone drzewo i `SELECT` na `initiatives.status` przed/po.

Dla R3 (arkusz): dowód renderu — zrzut albo output testu komponentowego pokazujący nagłówek `KimiWorkspaceShell` PO ponownym otwarciu zapisanego pliku, na wszystkich trzech ekranach, z napisem i licznikiem w zgodzie. Migawka DOM/testing-library snapshot wystarcza, jeśli nie masz zrzutu ekranu z realnego harnessu — ale musi pokazywać oba elementy (ikona/napis + `{completed}/{total}`) naraz, nie osobno.

# 4. TABELA LICENCJI PLIKOWYCH

★ Pełna ścieżka danych — wypisana, nie streszczona.

**Ścieżka A — status inicjatywy (repo → ekran):**

| Warstwa | Plik |
|---|---|
| Tabele | `initiatives` (kolumna `status`), `initiative_status_history`, `initiative_history` (schemat: `server/migrations-v2/001_baseline_20260413.sql` i późniejsze ALTER — odczytaj, nie zgaduj nazw kolumn) |
| Silnik domenowy | `server/src/services/initiative/initiativeTransitionService.ts` (`executeInitiativeTransition`) |
| Kontroler | `server/src/controllers/InitiativeController.ts:1207-1250` (`updateInitiativeStatus`) |
| Trasa | `server/src/routes/pmo/initiatives.routes.ts:3109-3118` (`PATCH /:id/status`), middleware bramkujące: `:84-90` (`requireGovernedInitiativeCapability`), `:160` + `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` (`requireCanonicalInitiativeExecutionWriter`) |
| Walidator | `server/src/validators/initiative.validators.ts` (`UpdateInitiativeStatusSchema`) |
| Odczyt gotowości (przed zapisem) | `server/src/routes/v8/planning.routes.ts:368-396` (`GET /gate-readiness-check`) → `server/src/services/v8/planningPortfolioReadService.ts` (`getInitiativeGateReadinessRead`) |
| Klient API (FE) | `src/services/api/v8/planning.ts` (`V8PlanningApi.getGateReadiness`), `src/services/initiativeWriteTruth.ts` (`getInitiativeStatusPreflightTruth:95-120`, `updateInitiativeStatusWriteTruth:268-284`, `getInitiativeGateReadinessTruth:39-57`) |
| Komponent | `src/components/Initiatives/InitiativeDocumentView.tsx` (`statusActions:1431-1433`, `handleStatusAction:3031-3149`, `commitStatusTransition:3153-3169`) |

**Ścieżka B — arkusz, licznik kroków przy ponownym otwarciu:**

| Warstwa | Plik |
|---|---|
| Tabela | `generated_workbooks` (kolumna `pipeline_log` — `server/migrations/756_interview_insight_downstream_lineage.sql:24`, `20260802_mat006_workbook_lifecycle.sql`, `20260912_claude_c_workbook_schema.sql`) |
| Zapis przy tworzeniu | `server/src/services/workbook/workbookCreationService.ts:96-107`; fazy budowane w `server/src/services/workbook/WorkbookGeneratorService.ts` |
| Trasa odczytu | `server/src/routes/workbook.routes.ts:4129-4213` (`GET /:id`) |
| Klient API (FE) | `src/utils/spreadsheetArtifactIdentity.ts` (`resolveSpreadsheetArtifactIdentity`, `defaultDependencies.loadWorkbook`) |
| Hook stanu pipeline'u | `src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts` (`PIPELINE_STEPS:207-216`, `mapRunToSteps:218-…`, `completedSteps/isCompleted/totalSteps:512-550`, zwrot hooka `:1375-1391`) |
| Komponenty-ekrany | `src/components/AIChat/KimiWorkspace/ExceleView.tsx:106-107,200-269,311-312,537-540`; `src/components/AIChat/KimiWorkspace/TabeleView.tsx:99,289-294,475-481`; `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx:204,661-664,875-882` |
| Powłoka renderu | `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` (`TaskProgressBar:317-402`, wywołanie `:1070-1080`) — **odczyt**, edytuj tylko gdy wariant (c) wymaga nowego propa |
| Tabele porównawcze (bez logu kroków — zmierz sam) | `tp_tables` (`server/migrations/700_table_platform_foundation.sql`), `presentation_decks` (`server/migrations/750_presentation_decks_00base.sql`) |

**Zapis (nowe/zmieniane pliki tego dyżuru):**

| Zakres | Ścieżki |
|---|---|
| Zapis | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY172_EKRANY_NIEPRAWDA_REPORT.md` |
| Zapis | `src/components/Initiatives/InitiativeDocumentView.tsx` |
| Zapis | `src/services/initiativeWriteTruth.ts` |
| Zapis | `src/components/AIChat/KimiWorkspace/ExceleView.tsx` |
| Zapis | `src/components/AIChat/KimiWorkspace/TabeleView.tsx` |
| Zapis | `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` |
| Zapis (tylko jeśli wariant (a) potwierdzony) | `server/src/routes/workbook.routes.ts`, `src/utils/spreadsheetArtifactIdentity.ts` |
| Zapis (tylko jeśli wariant (c) wymaga propa) | `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` |
| Zapis (tylko jeśli R1 gałąź B) | punktowa naprawa w `server/src/services/initiative/initiativeTransitionService.ts` |
| Zapis | test `server/src/routes/__tests__/day172.initiative-status.pg.test.ts` |
| Zapis | testy komponentowe `src/components/AIChat/KimiWorkspace/__tests__/day172.*` (arkusz — trzy ekrany) |

**Nietykalne imiennie (rozłączność z dyżurami biegnącymi równolegle):** `TaskDetailView.tsx`, `tasks.routes.ts`, `TaskController.ts`, `task.validators.ts` (163); `agent-plan.routes.ts`, `aiWorker.ts`, `AgentPlanPanel.tsx` (165); `okr.routes.ts`, `OkrCheckInRecordDialog.tsx` (170); `kpiScorecards/**`, `Economics/**` (171); configi/`DecisionDetailView.tsx` (173). Nie dotykasz żadnego z tych plików, nawet jeśli po drodze zobaczysz w nich coś ciekawego — zgłoś w raporcie, nie napraw.

**Zasoby wyłączne:** baza na porcie `6070`, kontener `cx-day172-pg`, harness na portach `5014` i `5015`. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6055 oraz 6061-6067 (odbiory nadzorcy), 6051/4994-4995 (163), 6056/4998-4999 (165), 6068/5010-5011 (170), 6069/5012-5013 (171), 6071/5016-5017 (173)`. Sprawdzasz sam przed startem, że `6070`/`5014`/`5015` są wolne — jeśli zajęte, to powód do STOP-u całości, nie do wzięcia innego portu. ★ Port `5000` zajęty na stałe przez macOS Control Center. ★ `POST /api/tasks` i wszystkie mutacje w `tasks.routes.ts` zwracają `409` (brama w linii 67) — Twoja ścieżka (`/api/initiatives/:id/status`) jej nie przechodzi, ale jeśli test-seeding przypadkiem dotknie zadań, użyj `POST /api/my-work/personal-tasks`.

# 5. BRAMKI ODBIORU

- **B1.** Raport podaje dosłowny wynik realnego żądania `PATCH /api/initiatives/:id/status` dla co najmniej dwóch przejść (self-service i wymagającego approvera) — status HTTP, treść odpowiedzi, stan `initiatives`/`initiative_status_history` przed/po. Nie samo czytanie kodu.
- **B2. Zakaz odsłonięcia zepsutego przycisku.** Jeśli którekolwiek przejście nie zostało potwierdzone realnym żądaniem jako działające, `statusActions` go nie zawiera. Diff pokazuje filtr oparty o zmierzony, nie zakładany, zbiór.
- **B3.** Jeśli R1 wykazał, że zapis nadal jest zepsuty na poziomie backendu (nie tylko frontendowego stubu) — naprawa backendu poprzedza jakiekolwiek odsłonięcie UI, z osobnym dowodem mutacyjnym na `initiativeTransitionService.ts`.
- **B4.** Dla arkusza: na WSZYSTKICH trzech ekranach (Excele, Tabele, Prezentacje) napis „ukończone”/label i licznik kroków opisują ten sam stan po ponownym otwarciu zapisanego pliku — zero kombinacji „zielony ptaszek + zero z N”.
- **B5.** Wybór wariantu R3 (a/b/c) jest uzasadniony PISEMNIE per typ artefaktu, z odniesieniem do tego, czy dana tabela (`generated_workbooks` / `tp_tables` / `presentation_decks`) faktycznie ma dane źródłowe do pokazania — nie jest to samo uzasadnienie skopiowane trzy razy.
- **B6. Zero zmiany wyglądu poza tym, co wynika z naprawy stanu.** Diff nie dotyka layoutu, kolorów, typografii ani tekstów spoza etykiety ukończenia/licznika i przywróconego przycisku statusu.
- **B7. Rozłączność.** Diff nie zawiera żadnego pliku z listy „Nietykalne imiennie” w sekcji 4.
- **B8.** Migracja (jeśli R3 wariant (a) wymaga nowego pola w odpowiedzi API — bez zmiany schematu, bo `pipeline_log` już istnieje) — jeśli mimo to jakakolwiek migracja powstanie, pełny przebieg od PUSTEJ bazy przez `scripts/dev/day161-fresh-migration-check.sh` (z `DAY161_CONTAINER_NAME=cx-day172-pg DAY161_PG_PORT=6070`), wynik wklejony w raporcie.
- **B9.** Testy `day172.*` przechodzą na lokalnym Postgresie (kontener `cx-day172-pg`, port `6070`), z jawnym wskazaniem którego configu użyto i skąd uruchomiono komendę (pułapka `DB_TYPE` przypięty do `sqlite` w `vitest.config.ts:210` i `server/vitest.config.ts:17`; `No test files found` nie liczy się jako PASS).
- **B10.** Raport ma sekcję „TWIERDZENIA NIEZWERYFIKOWANE” wypisującą wprost każde ustalenie z tego pliku, którego NIE zdążyłeś potwierdzić realnym żądaniem/bazą (np. jeśli nie zmierzyłeś przejścia wymagającego approvera — napisz to, nie przemilcz).
- **B11.** Raport kończy się jednym akapitem: czy przejście statusu inicjatywy nadal rzuca wyjątkiem (tak/nie, dla jakich przejść), czy kroki zapisanego przebiegu arkusza są w bazie dla każdego z trzech typów artefaktu, i który wariant R3 wybrałeś dla Excele a który dla Tabel/Prezentacji.
