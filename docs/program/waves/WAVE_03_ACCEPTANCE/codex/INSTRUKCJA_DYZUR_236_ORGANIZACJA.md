# INSTRUKCJA DYŻURU nr 236 — Codex — „★★ ORGANIZACJA — KOMPLET 11 EKRANÓW REDESIGNU DO ZRZUTÓW WŁAŚCICIELA. Zero nowego mechanizmu: tylko dev-render harness montujący REALNE komponenty `redesign/` i rozstrzygnięcie sprzeczności między dwoma dokumentami kanonicznymi programu (`REKONESANS...md` mówi „0 dyżurów potrzeba”, `FUNCTIONAL_DOCUMENTATION.md`+`DEC-2026-08-25-74` nazywają Organizację przykładem wzorca RUNTIME-IDENTITY-MISMATCH) — dziś zmierzone: flaga ISTNIEJE na tej gałęzi (wbrew starszej części DEC-74), ale jej REALNY default w kodzie (`orgRedesignFlag.ts:57-58`) jest OFF, mimo że nagłówek tego samego pliku (`:18,34`) twierdzi ON"

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
> **wyłącznie** `/private/tmp/cx-day236-organizacja`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `e99e81301a`**
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
Zakres: ****01 ORGANIZACJA (`/organization`) — moduł bez ŻADNEGO dyżuru w fali WAVE_03 (218-235), z dokumentacyjną sprzecznością co do jego stanu.** Zmierzone na markerze `e99e81301a`: `src/utils/orgRedesignFlag.ts` (98 linii, kompletny) implementuje flagę `orgRedesignV1` z kolejnością query→localStorage→env→default (`:30-34`), realny gate w `src/views/OrganizationView.tsx:51,132` (czytany raz na mount). Katalog `src/components/Organization/redesign/` ma 14 plików `.tsx`: 11 realnych ekranów (`OrganizationIdentityOperatingScreen`, `OrganizationGoalsMetricsScreen`, `OrganizationChallengesEvidenceScreen`, `OrganizationRisksOpportunitiesScreen`, `OrganizationSourcesClaimsScreen`, `OrganizationScopeCollaborationScreen`, `OrganizationDirectionConstraintsScreen`, `OrganizationRootCausesBlockersScreen`, `OrganizationScenariosBriefScreen`, `OrganizationKnowledgeGraphScreen`, `OrganizationReadinessScreen`) + 3 współdzielone (`OrganizationScreenShell`, `OrganizationCardPrimitives`, `OrganizationStatePanel`). **Domyślny stan flagi jest sprzeczny wewnątrz jednego pliku — patrz `§1.2` ciała dyżuru.** Karta modułu (`MODULE_ACCEPTANCE.md`, G08-G10) potwierdza: captured evidence z Day85 istnieje (20/20 plików), ale `OWNER_NOT_REVIEWED`, i tylko 2 z 5 sekcji mają prawdziwy pełny fixture (Goals/Challenges/Risks puste).**.
Trasy front: ``src/views/OrganizationView.tsx` (gate `:132`, router zagnieżdżony `resolveOrganizationLocation` `:94-117`) · `src/components/Organization/redesign/*.tsx` (14 plików, 11 ekranów) · `src/components/Organization/OrganizationSidebar.tsx` (stara nawigacja 21×6, komentarz `:80-81` o nadpisaniu IA pod flagą) · `src/utils/orgRedesignFlag.ts`. ★★ Ósmy kształt fałszywego gotowe: komponent zaimportowany ≠ realnie renderowany z danymi — każdy zrzut musi pochodzić z realnego montażu przez `dev-render` harness z fixture danych, nigdy z atrapy propsów. Kanon: `docs/ui-standards/TRIADA_KANON.md` i `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` (Organizacja to ekrany-rekordy/artefakty, nie lista) — **nie przebudowujesz powłoki**, tylko montujesz do zrzutu`. Trasy tył: ``server/src/routes/` rodzina organizacyjna (profil/claims/snapshoty — governed publish flow z G02 karty modułu: `profile/source -> claim proposals -> human approve/reject -> immutable snapshot -> exact version/hash reopen`) · `server/src/middleware/auth.middleware.ts`. Ten dyżur NIE dotyka backendu (patrz `§4` tabela licencji) — trasy backendowe są tu wyłącznie kontekstem dla fixture'u w `R1`/`R2`, nie przedmiotem zmian`.

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
WT=/private/tmp/cx-day236-organizacja
MARKER=e99e81301a

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day236-organizacja-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day236-organizacja/config.worktree"
cat "$VAULT/worktrees/cx-day236-organizacja/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day236-organizacja-scratch
mkdir -p /private/tmp/cx-day236-organizacja-artefakty

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
git -C "$VAULT" log --oneline e99e81301a..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only e99e81301a..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day236-organizacja-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only e99e81301a..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `7` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: flaga orgRedesignV1 istnieje na m03 (wbrew starszej czesci DEC-74 "na m03 flagi w ogole brak")
wc -l src/utils/orgRedesignFlag.ts
grep -n "export function isOrgRedesignV1Enabled" src/utils/orgRedesignFlag.ts
#   oczekiwane: plik istnieje, ~98 linii, funkcja wyeksportowana

# (2) TEZA: naglowek pliku (ON) i realny kod (OFF) sa ze soba sprzeczne
sed -n '1,35p' src/utils/orgRedesignFlag.ts | grep -n "Default"
sed -n '49,58p' src/utils/orgRedesignFlag.ts
#   oczekiwane: naglowek mowi \"Default ON\", linia \"return parsed === null ? false : parsed;\"
#   w kodzie i komentarz obok tlumaczacy swiadome cofniecie do OFF 29.08

# (3) TEZA: realny gate to OrganizationView.tsx, czytany raz na mount
grep -n "isOrgRedesignV1Enabled\|useState(() =>" src/views/OrganizationView.tsx
#   oczekiwane: import w okolicy linii 51, useState w okolicy linii 132

# (4) TEZA: 11 ekranow + 3 wspoldzielone w redesign/, nie inna liczba
find src/components/Organization/redesign -maxdepth 1 -name "*.tsx" | grep -v __tests__ | wc -l
find src/components/Organization/redesign -maxdepth 1 -name "*.tsx" | grep -v __tests__ | sort
#   oczekiwane: 14 plikow, z czego 3 wspoldzielone (Shell/Primitives/StatePanel) = 11 ekranow

# (5) TEZA: routing redesignu jest zagniezdzony przez resolveOrganizationLocation, nie plaski
grep -n "function resolveOrganizationLocation\|ORGANIZATION_REDESIGN_MODULES\|LEGACY_LOCATIONS" src/views/OrganizationView.tsx | head -10
#   oczekiwane: funkcja obecna, dwie osobne tablice modulow, warstwa legacy

# (6) TEZA: karta modulu potwierdza captured-ale-nieprzejrzane, i tylko 2/5 sekcji ma prawdziwy pelny fixture
grep -n "OWNER_NOT_REVIEWED\|2 z 5\|14 z 20" docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md
#   oczekiwane: co najmniej dwa trafienia (G08/G09/G10)

# (7) TEZA: miejsce na dysku wystarcza na dyzur (~1,7 GB)
df -h /
#   oczekiwane: powyzej 5 GB wolnego — ponizej tego STOP calego dyzuru (patrz Z incydentow)
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day236-organizacja-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6184`. Twój JEDYNY port harnessu to `5156 i 5157`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day236-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6183, 5010-5155, 6404-6411, 6600-6830. Twoje własne: baza 6184, harness 5156 i 5157. Cudze — siostrzane dyżury TEJ SAMEJ fali, nie dotykasz: baza 6185 i harness 5158-5159 (dyżur 237 Spotkania), baza 6186 i harness 5160-5161 (dyżur 238 Ustawienia). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. Ten dyżur jest pomiarowo-dowodowy: harness `dev-render` wymusza `orgRedesignV1` WYŁĄCZNIE przez query-param (`?ff_org_redesign_v1=1`) przy renderze zrzutu, nigdy przez zmianę kodu domyślnej wartości w `orgRedesignFlag.ts:57-58`. `Z10` obowiązuje bez wyjątku`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/orgRedesignFlag.ts` · `src/views/OrganizationView.tsx` · `src/components/Organization/OrganizationSidebar.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY236_ORGANIZACJA_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć, to `docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md` (§R.1) — WYŁĄCZNIE dopisanie nowej sekcji na końcu pliku ze zmierzonym stanem (flaga/ekrany/routing), każde zdanie z dowodem `plik:linia`. Zakaz kasowania, nadpisywania lub przepisywania istniejących wierszy tabel. Zakaz wpisywania `FIXED`/`VERIFIED` — ten dyżur nie naprawia mechanizmu (poza jednym wąskim wyjątkiem R4 — komentarz, nie logika), tylko mierzy i dokumentuje. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day236-organizacja-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day236-organizacja-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ ZMIANY LOGIKI `orgRedesignFlag.ts`.** Wolno wyłącznie dopisać jedno zdanie do nagłówka (`R4`), zero zmian w kodzie `:37-98`. **ZAKAZ DOBUDOWY BACKENDU DLA GOALS/CHALLENGES/RISKS**, jeśli `R2` wykaże, że to kwestia brakującej trasy zapisu, nie brakującego seeda — opisujesz w raporcie, nie budujesz. **ZAKAZ ROZSTRZYGANIA `ORG-Q-001..007`** (otwarte pytania właściciela z `OWNER_FEEDBACK_REGISTER.md`) — to nie jest przedmiot tego dyżuru. **ZAKAZ EDYCJI `REKONESANS_ZAMKNIECIA_16_MODULOW.md` i `FUNCTIONAL_DOCUMENTATION.md`** — jeśli uważasz że wymagają korekty po Twoim pomiarze, piszesz rekomendację w raporcie, nadzorca decyduje | Dwa dokumenty kanoniczne programu mówią o Organizacji coś przeciwnego. `REKONESANS_ZAMKNIECIA_16_MODULOW.md:84` (tablica zamknięć, wiersz `01 | Organizacja | CLOSED_FINAL | ... | 0`): moduł gotowy, zero dyżurów potrzeba. `docs/FUNCTIONAL_DOCUMENTATION.md:70-75` + `DEC-2026-08-25-74` (`OWNER_DECISION_LEDGER_2026-08-24.md:126`): Organizacja jest NAZWANYM przykładem wzorca „zrobione za flagą OFF, którego użytkownik nie widzi” — redesign 21→11 istnieje w kodzie, ale runtime domyślnie pokazuje stary układ. Ten dyżur istnieje, żeby zmierzyć, które z tych dwóch zdań jest dziś prawdziwe (odpowiedź: DEC-74 częściowo, tablica zamknięć NIE), dać właścicielowi pierwszy realny widok wszystkich 11 ekranów redesignu, i uczciwie skorygować kartę modułu, zanim ktoś zaplanuje kolejny dyżur na błędnej przesłance „0 potrzeba” |

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
cd /private/tmp/cx-day236-organizacja

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day236-pg psql -U postgres -d cx236 \
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
cd /private/tmp/cx-day236-organizacja

docker run -d --name cx-day236-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx236 \
  -p 127.0.0.1:6184:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day236-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6184/cx236 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6184/cx236 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day236-organizacja && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6184/cx236 \
JWT_SECRET=cx236-test-secret-do-not-reuse \
npx vitest run src/components/Organization/__tests__ src/components/Organization/redesign/__tests__ src/utils/__tests__ dev-render/screens --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day236-organizacja-artefakty/day236-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day236-organizacja && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/Organization/__tests__ src/components/Organization/redesign/__tests__ src/utils/__tests__ dev-render/screens --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day236-organizacja-artefakty/day236-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day236-organizacja/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day236-pg psql -U postgres -d cx236 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day236-pg`.
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
> **(e) ★★ **NAGŁÓWEK PLIKU I JEGO WŁASNY KOD SĄ ZE SOBĄ SPRZECZNE — NIE UFAJ PIERWSZYM 35 LINIOM.** `orgRedesignFlag.ts:18,34` (docblock, napisany 26.08): „Default ON”. `orgRedesignFlag.ts:49-58` (realny kod + świeższy wewnętrzny komentarz, dopisany 29.08): domyślnie `false`, bo odbiór wizualny realnego builda nigdy nie wrócił do rejestru jako akcept właściciela (reguła 7 `CLAUDE.md`). To jest odwrotność znanego wzorca „komentarz mówi wyłączone, kod daje włączone” — tu NAGŁÓWEK kłamie o włączone, a WEWNĘTRZNY kod+komentarz (poprawny) mówi wyłączone. Każdy dokument, który cytuje TYLKO nagłówek (w tym prawdopodobnie karty i raporty z 26-28.08), odziedziczył ten błąd. Druga pułapka: routing redesignu NIE jest płaską listą tras do wygrepowania z `AppRoutes.tsx` — jest funkcją `resolveOrganizationLocation()` mapującą segmenty URL na `{module, screen}` z dwóch różnych tablic zależnie od stanu flagi, plus warstwa `LEGACY_LOCATIONS` dla starych linków**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day236-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day236-organizacja-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (harness 11 ekranów redesignu, zrzuty) · R2 (weryfikacja realnej zawartości fixture'u dla Goals/Challenges/Risks) · R3 (korekta MODULE_ACCEPTANCE.md — flaga istnieje, default OFF, routing zagnieżdżony)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6184` albo `5156 i 5157` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6184` albo `5156 i 5157`** (`Z7`).

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

Moduł **01 Organizacja** to jeden z siedmiu modułów tej fali (Z2b) bez ŻADNEGO dyżuru
w programie WAVE_03 — sprawdzone wyliczeniem plików `docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_2{18..35}_*.md`:
żaden nie dotyczy Organizacji. Tablica zamknięć modułów
(`docs/program/funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md:84` i wiersz `01 | Organizacja
| CLOSED_FINAL | ... | 0`) twierdzi, że moduł potrzebuje **zera** dodatkowych dyżurów.
**To twierdzenie jest sprzeczne z drugim dokumentem kanonicznym tego samego programu**
(`docs/FUNCTIONAL_DOCUMENTATION.md:70-75`), który nazywa Organizację **wprost, imiennie**
przykładem wzorca `RUNTIME-IDENTITY-MISMATCH` (`DEC-2026-08-25-74`,
`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md:126`): *„redesign
21→11 leży na m01-organization za `orgRedesignV1=OFF`, na m03 flagi w ogóle brak → runtime
pokazuje 21 ekranów"*. Cel tego dyżuru **nie jest „napraw wszystko"** — jest nim rozstrzygnąć
tę sprzeczność pomiarem na dzisiejszym kodzie i doprowadzić moduł do stanu, w którym da się
pokazać **komplet ekranów na czystych zrzutach**.

## ★★ POMIAR NA MARKERZE `e99e81301a` — DEC-74 JEST CZĘŚCIOWO NIEAKTUALNY, NIE CAŁKOWICIE FAŁSZYWY

Sprawdź każde zdanie u siebie (komendy w `§0`) — poniżej wynik.

### 1. „Na m03 flagi w ogóle brak" (DEC-74, 25.08) — DZIŚ NIEPRAWDA, flaga ISTNIEJE

`src/utils/orgRedesignFlag.ts` (98 linii) jest na gałęzi bazowej `codex/m03-admin-20260824`
i jest kompletny: eksportuje `isOrgRedesignV1Enabled()` (`:86-92`) z kolejnością
query→localStorage→env→default, dokładnie jak opisuje własny docblock (`:30-34`). Realny
gate: `src/views/OrganizationView.tsx:51` (import) i `:132` (`useState(() =>
isOrgRedesignV1Enabled())`, czytane RAZ na mount, komentarz `:130-131` tłumaczy dlaczego nie
częściej). DEC-74 miało rację 25.08 (opisywało wcześniejszy stan innej gałęzi), nie ma racji
dziś na m03 — **skoryguj to w `R3`, nie kasując oryginalnego wpisu**.

### 2. ★★★ Domyślny stan flagi — nagłówek pliku i realny kod SĄ ZE SOBĄ SPRZECZNE

To jest najważniejsze ustalenie tego dyżuru, i to **inny kształt** znanego wzorca „komentarze
kłamią" niż dotąd notowane pięć przypadków — tu nie kłamie POJEDYNCZY komentarz, tylko
NAGŁÓWEK pliku (napisany 26.08) jest przestarzały względem WEWNĘTRZNEGO komentarza i kodu
(dopisanych 29.08 w tym samym pliku, bez aktualizacji nagłówka):

- Nagłówek `orgRedesignFlag.ts:18` i `:34`: *„Od tego odbioru flaga jest DEFAULT ON"* /
  *„4. Default: ON (DEC-2026-08-26-78)"*.
- Realny kod, ten sam plik, `:49-58` (`readEnvFlag()`): `return parsed === null ? false :
  parsed;` — **domyślnie `false`**. Komentarz TUŻ PRZY tym kodzie (`:53-57`) wyjaśnia
  dlaczego: *„DEC-2026-08-26-78 autoryzował flip ON na PROTOTYPIE, a nie na realnym ekranie...
  krok (d) reguły 7 z CLAUDE.md nie został wykonany. Do czasu jego wykonania domyślną
  wartością jest OFF (2026-08-29, nadzorca)"*.

Innymi słowy: **kod i wewnętrzny komentarz są ze sobą zgodne i aktualne** (nadzorca świadomie
cofnął default do OFF 29.08, bo odbiór wizualny realnego builda nigdy nie wrócił do rejestru
jako akcept właściciela — dokładnie reguła 7 z `CLAUDE.md`). Kłamie **nagłówek**, napisany
trzy dni wcześniej i nigdy nie zaktualizowany. Każdy, kto przeczyta TYLKO nagłówek (co jest
naturalne — to pierwsze 35 linii pliku), wyjdzie z fałszywym przekonaniem „ON domyślnie".
**SSOT tego pliku to `:49-58`, nie `:1-34`.**

### 3. Ile realnie jest ekranów redesignu — 11, zgadza się

`src/components/Organization/redesign/` ma **14** plików `.tsx` poza `__tests__`. Trzy to
elementy współdzielone, nie osobne ekrany: `OrganizationScreenShell.tsx` (wspólny szkielet),
`OrganizationCardPrimitives.tsx`, `OrganizationStatePanel.tsx` (prawy panel „Zapisz zmiany").
Pozostałe **11** to faktyczne ekrany: `OrganizationIdentityOperatingScreen`,
`OrganizationGoalsMetricsScreen`, `OrganizationChallengesEvidenceScreen`,
`OrganizationRisksOpportunitiesScreen`, `OrganizationSourcesClaimsScreen`,
`OrganizationScopeCollaborationScreen`, `OrganizationDirectionConstraintsScreen`,
`OrganizationRootCausesBlockersScreen`, `OrganizationScenariosBriefScreen`,
`OrganizationKnowledgeGraphScreen`, `OrganizationReadinessScreen`. Liczba „21→11" z obu
dokumentów kanonicznych **zgadza się z kodem**.

### 4. Routing pod redesignem jest zagnieżdżony (moduł/ekran), nie płaski

`src/routes/routeConfig.ts:95-107` deklaruje tylko **starą, płaską** listę
(`ROOT/PROFILE/GOALS/CHALLENGES/MEGATRENDS/STRATEGY/MEMBERS/BILLING/LIMITS/DOMAINS/BRANDING`
— 11 wpisów, ale to adresy sprzed redesignu, częściowo administracyjne i przekierowywane do
`/settings/organization` czy `/admin/*`). Realny router ekranów redesignu to
`resolveOrganizationLocation()` (`src/views/OrganizationView.tsx:94-117`) — mapuje segmenty
URL na parę `{module, screen}` z dwóch OSOBNYCH tablic (`ORGANIZATION_REDESIGN_MODULES` vs
`ORGANIZATION_MODULES`, wybór zależny od `redesign` bool), z warstwą kompatybilności starych
adresów (`LEGACY_LOCATIONS`, `resolveRedesignScreen` — stary link do ekranu „wchłoniętego"
przez redesign nadal działa). **To NIE jest lista tras do wyliczenia z `AppRoutes.tsx` jednym
grepem** — musisz przejść przez `resolveOrganizationLocation` i wypisać wynikowe pary
`{module, screen}` dla obu wartości `redesign` osobno.

### 5. Owner review pending mimo captured evidence — G08-G11, PACKET_READY / OWNER_NOT_REVIEWED

`docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md`, G08:
*„Day 85 captured... `20 z 20`... Piotr has not performed the review; technical evidence is
not owner acceptance"*. G09: *„fixture supplies a true full state for only `2 z 5`
surfaces; Goals, Challenges and Risks remain empty"*. G10: *„only `14 z 20` required
surface/theme/state cells are truthful; six nominal `full` images are empty and are not
relabeled"*. **Ten dyżur nie jest zwolniony z reguły 7 `CLAUDE.md` przez istnienie Day85 —
Day85 był na FLADZE OFF (stary layout) albo na prototypie HTML, nie na realnym redesignie z
fixture'em pełnym dla wszystkich 5 sekcji.** Zmierz, na czym dokładnie były zrobione zrzuty
Day85 (`plik:linia` w raporcie `CODEX_DAY85_ORGANIZATION_OWNER_REPORT.md`), zanim zdecydujesz
czy je odtwarzasz, czy generujesz od nowa.

## Czego ten dyżur świadomie NIE robi

- **Nie przełącza domyślnej wartości flagi w kodzie.** `orgRedesignFlag.ts:57-58` zostaje
  `false` — harness wymusza ON wyłącznie przez `?ff_org_redesign_v1=1` przy renderze zrzutu.
- **Nie buduje pełnego fixture'u dla Goals/Challenges/Risks**, jeśli to wymaga nowej logiki
  backendu — jeśli brakujące dane to kwestia SEED-a (nie kodu), uzupełniasz seed; jeśli to
  kwestia brakującej trasy zapisu, opisujesz w raporcie i zatrzymujesz się.
- **Nie rozstrzyga, czy Goals/Challenges/Risks w ogóle wchodzą w zakres redesignu v1** —
  jeśli w kodzie widzisz świadomy wyjątek (np. te trzy ekrany są celowo poza `R1`
  redesignu), opisujesz to jako ustalenie, nie jako defekt.
- **Nie poprawia treści merytorycznej `ORG-Q-001..007`** (otwarte pytania właściciela z
  `OWNER_FEEDBACK_REGISTER.md`) — to decyzje właściciela, nie kod.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Flaga `orgRedesignV1` istnieje na m03 (wbrew starszej części DEC-74) | komenda (1) |
| T2 | Nagłówek pliku (ON) i realny kod (OFF) flagi są ze sobą sprzeczne | komenda (2) |
| T3 | Realny gate to `OrganizationView.tsx:132`, czytany raz na mount | komenda (3) |
| T4 | 11 plików ekranów + 3 współdzielone w `redesign/`, nie inna liczba | komenda (4) |
| T5 | Routing redesignu jest zagnieżdżony przez `resolveOrganizationLocation`, nie płaski grep tras | komenda (5) |
| T6 | G08-G10 karty modułu: captured evidence istnieje, ale owner review = NOT_REVIEWED, i tylko 2/5 sekcji ma prawdziwy pełny fixture | komenda (6) |
| T7 | Miejsce na dysku wystarcza (próg z incydentów fali Z1) | komenda (7) |

---

# 3. POZYCJE DYŻURU

## R1 — HARNESS 11 EKRANÓW REDESIGNU (rdzeń, dowodowy)

**Cel:** pierwszy realny, kompletny widok redesignu Organizacji, jaki właściciel kiedykolwiek
zobaczy — wszystkich 11 ekranów, nie tylko wzorcowego „Tożsamość i model działania" z
Day85/86.

Montujesz `dev-render/screens/day236-organizacja.tsx` (+ wpis w `dev-render/main.tsx`),
renderujący **realny** `OrganizationView` (albo bezpośrednio poszczególne ekrany `redesign/`
opakowane w `OrganizationScreenShell`, jeśli montaż całego widoku wymaga zbyt dużo
infrastruktury routingu) z fixture'em danych. Wymuszasz redesign przez
`?ff_org_redesign_v1=1` na poziomie harnessu, **nigdy** zmianą domyślnej wartości w kodzie
(`Z10`).

### R1a — PARA DOWODOWA „obcy nie widzi / właściciel widzi"

| przebieg | oczekiwane |
|---|---|
| bez `?ff_org_redesign_v1` (domyślny runtime, `Z16` — to jest PRAWDZIWY dzisiejszy stan produkcyjny) | stary layout: 21 pozycji nawigacji w 6 grupach, nagłówek „Save Changes" przez `SettingsHeaderActionPortal` |
| z `?ff_org_redesign_v1=1` | 11 skonsolidowanych ekranów, wspólny szkielet `OrganizationScreenShell`, jeden przycisk „Zapisz zmiany" w prawym panelu stanu |
| dwa różne persony (OWNER pełny profil vs MEMBER ograniczony dostęp — patrz `G03` karty modułu) | opisz różnicę uprawnień na zrzucie, jeśli widoczna |

### R1b — zrzuty

11 ekranów × dwa motywy = **22 obrazy**, plus reprezentatywny stan pusty dla Goals/Challenges/
Risks (jeśli fixture rzeczywiście ich nie ma — patrz `§1.5`) i jeden zrzut STAREGO layoutu
(flaga OFF) dla porównania „przed/po". `mean_luma` każdej pary jasny/ciemny, różnica **> 150**
(komenda w `§5`).

## R2 — WERYFIKACJA CO NAPRAWDĘ JEST W FIXTURZE (rdzeń, dowodowy)

**Cel:** rozstrzygnąć `§1.5` — czy Goals/Challenges/Risks są puste bo (a) fixture ich nie ma,
(b) redesign świadomie ich jeszcze nie obsługuje, czy (c) jest błąd odczytu. Sprawdź fixture
`consultify_w3_organization_owner_return_20260821` (jeśli odtwarzalny lokalnie) albo
odpowiadający mu skrypt seeda, i porównaj z tym, co faktycznie renderuje każdy z 11 ekranów
w `R1`. Zapisz wynik jako tabelę: ekran → dane w fixture (tak/nie) → co renderuje (pełny/
pusty/błąd).

## R3 — KOREKTA DWÓCH DOKUMENTÓW KANONICZNYCH (rdzeń, dokumentacyjny)

Dopisujesz na końcu `docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md`
nową sekcję (np. `## Dzień 236 — pomiar flagi i routingu redesignu`) ze zmierzonym stanem z
`§1`: flaga istnieje na m03, domyślnie OFF (SSOT = kod, nie nagłówek), 11 ekranów potwierdzone,
routing zagnieżdżony. **Nie kasujesz i nie przepisujesz** istniejących wierszy — to dopisek.
Link do `DEC-2026-08-25-74` jako pierwotne źródło, z adnotacją które jego zdanie jest dziś
nieaktualne, a które nadal prawdziwe (mismatch trwa, tylko z innego powodu: flaga jest, ale
default OFF, nie „flagi brak"). **Nie dotykasz** `REKONESANS_ZAMKNIECIA_16_MODULOW.md` ani
`FUNCTIONAL_DOCUMENTATION.md` — to nie są Twoje pliki w tym dyżurze (patrz `§4`); jeśli
uważasz, że wymagają korekty, opisz to w raporcie jako rekomendację dla nadzorcy.

## R4 — NAPRAWA NAGŁÓWKA (nie-rdzeń, wąska)

Nagłówek `orgRedesignFlag.ts:18,34` wprowadza w błąd — dopisujesz JEDNO zdanie do docblocka
(nie usuwając historii DEC-2026-08-26-78), wskazujące, że realny default od 29.08 to OFF i
odsyłające do komentarza `:53-57`. **Zero zmiany logiki**, wyłącznie komentarz. Jeśli nie
starczy czasu — pomijasz i zgłaszasz w raporcie jako otwarte.

## R5 — RAPORT DYŻURU (rdzeń)

Struktura z `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" obowiązkowa nawet jeśli pusta.
Dołącz tabelę mianowników (`§0.4a`) i pełne wyjścia komend z `§0`.

---

# 4. TABELA LICENCJI PLIKOWYCH

Ten dyżur jest **pomiarowo-dowodowy**, nie buduje mechanizmu — licencja zapisu jest świadomie
wąska.

| Zakres | Ścieżki |
|---|---|
| Zapis (NOWE) | `dev-render/screens/day236-organizacja.tsx` + wpis w `dev-render/main.tsx` |
| Zapis (WĄSKO) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowa sekcja na końcu pliku (`R3`), zakaz kasowania/przepisywania istniejących wierszy |
| Zapis (WĄSKO, `R4`) | `src/utils/orgRedesignFlag.ts` — WYŁĄCZNIE komentarz nagłówka `:1-35`. Zakaz zmiany jakiejkolwiek linii kodu `:37-98` |
| Zapis (WĄSKO, tylko jeśli `R2` tego wymaga i to seed, nie kod) | skrypt seeda odpowiadający fixture'owi Organizacji, jeśli istnieje w repo pod `server/scripts/` — dopisanie brakujących pól Goals/Challenges/Risks, zakaz zmiany schematu |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY236_ORGANIZACJA_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/Organization/redesign/*.tsx` (wszystkie 14 plików) · `src/views/OrganizationView.tsx` · `src/components/Organization/OrganizationSidebar.tsx` — montujesz je w harnessie, **nie zmieniasz ich logiki** |
| Odczyt (ZAKAZ ZAPISU) | `src/routes/routeConfig.ts` · `server/src/database/Database.ts` (`Z18`) · `vitest.config.ts` · `tests/setup.ts` |
| Odczyt | `docs/program/funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md` · `docs/FUNCTIONAL_DOCUMENTATION.md` · `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` (`Z14` — odczyt, zakaz zapisu) · `CODEX_DAY85_ORGANIZATION_OWNER_REPORT.md` · `docs/program/owner_feedback/01_ORGANIZATION/OWNER_FEEDBACK_REGISTER.md` |

**Nietykalne imiennie:** `vitest.config.ts` · `tests/setup.ts` · `Database.ts` ·
`docs/FUNCTIONAL_DOCUMENTATION.md` · `docs/program/funkcje/REKONESANS_ZAMKNIECIA_16_MODULOW.md`
(czytasz, nie edytujesz — korektę zgłaszasz w raporcie) · każdy inny `MODULE_ACCEPTANCE.md`
poza Organizacji.

---

# 5. TWARDE ZASADY

- ★★ **CEL JEST ZRZUT, NIE NAPRAWA.** Jeżeli w harnessie znajdziesz błąd głębszy niż „stan
  pusty renderuje się źle" (np. ekran redesignu rzuca wyjątkiem) — nie naprawiasz w locie.
  Opisujesz w raporcie z `plik:linia`, robisz zrzut najbliższego uczciwego stanu, idziesz dalej.
- ★★ **SSOT DOMYŚLNEJ WARTOŚCI FLAGI TO KOD, NIE NAGŁÓWEK KOMENTARZA.** Patrz `§1.2` — jeśli
  gdziekolwiek indziej w tym dyżurze natrafisz na podobny rozjazd (docblock vs implementacja),
  ufaj implementacji i miejscowemu, świeższemu komentarzowi, opisz rozjazd w raporcie.
- ★★ **FLAGA DOMYŚLNIE WYŁĄCZONA POZOSTAJE WYŁĄCZONA** (`CLAUDE.md` §7, §9). Harness wymusza
  stan WYŁĄCZNIE przez query-param przy renderze, nigdy zmianą kodu domyślnej wartości.
- ★★ **WŁAŚCICIEL NIGDY NIE JEST PIERWSZYM TESTEREM WIZUALNYM.** Zrzuty robisz Ty. Para
  jasny/ciemny musi się REALNIE różnić — `mean_luma` obu obrazów i różnica **> 150**:
  ```bash
  node -e "const s=require('sharp');s(process.argv[1]).stats().then(r=>console.log(process.argv[1], (0.2126*r.channels[0].mean+0.7152*r.channels[1].mean+0.0722*r.channels[2].mean).toFixed(1)))" <plik.png>
  ```
- ★★ **W RAPORCIE PISZESZ WPROST, CZY DANE NA ZRZUCIE POCHODZĄ Z REALNEGO PRZEBIEGU (fixture
  przez `dev-render` montujący prawdziwy komponent) CZY Z RĘCZNYCH PROPSÓW.** Zrzut
  zamockowanej powłoki nie jest dowodem renderu.
- ★★ **ZERO KOREKTY BEZ DOWODU.** Sekcja `R3` — każde zdanie ma `plik:linia`. Zakaz
  przepisywania liczby „11 ekranów" bez samodzielnego przeliczenia komendami z `§0`.
- ★ **PUŁAPKI ŚRODOWISKA — SPRAWDŹ KAŻDĄ U SIEBIE:** `server/src/database/Database.ts` ok.
  `:80-88` cicho podstawia atrapę bazy bez `RUN_DB_TESTS=1`; `Database.ts:686` atrapa zwraca
  `changes:1` dla KAŻDEGO `UPDATE`; `vitest.config.ts:210` przypina `DB_TYPE='sqlite'`;
  `tests/setup.ts:896` podmienia `global.fetch`; **komentarze w kodzie bywają nieaktualne — ten
  dyżur sam jest tego dowodem (`§1.2`)** — sprawdzaj logikę, nie ufaj opisowi ani nagłówkowi.
- ★ **`Z13`:** logi, zrzuty i pliki wynikowe NIE wchodzą do repo — leżą w `/private/tmp/cx-day236-organizacja-artefakty`,
  raport podaje ścieżki i `shasum -a 256`.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej sekcji
  jest podstawą odrzucenia dyżuru.
