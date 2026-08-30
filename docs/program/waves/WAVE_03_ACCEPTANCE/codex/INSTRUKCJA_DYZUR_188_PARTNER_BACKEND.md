# INSTRUKCJA DYŻURU nr 188 — Codex — „Partner backend — polityka rozliczeń nieustawiona 500-uje /earnings-summary zamiast uczciwej odpowiedzi + JOIN uuid=text w projects cicho zwraca pustkę zamiast błędu"

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
> **wyłącznie** `/private/tmp/cx-day188-partner-backend`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `b4651675f6`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-08-31.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **16_PARTNER — dwa defekty backendu potwierdzone przy odbiorze dyżuru 177 (WZNOWIENIE, ocena B, SCALONO); to NIE jest nowy odbiór wizualny, to naprawa dwóch konkretnych awarii serwera**.
Trasy front: ``src/views/partner/PartnerPortalView.tsx` — WYŁĄCZNIE blok `fetchData` dla `subsection === 'projects'` (linie ok. 1144-1158, zweryfikuj), żeby odróżnić `degraded`/błąd od realnej pustki; zero zmian layoutu/kolorów`. Trasy tył: ``server/src/services/partnerAccrualPolicy.ts` (`readApprovedPartnerAccrualPolicy`, `PartnerAccrualPolicyBlockedError`), `server/src/services/partnerCommissionService.ts` (`getPayoutEligibility`, linia 191 — zweryfikuj), `server/src/routes/v8/partner.routes.ts` (handler `GET /earnings-summary`, wywołanie w linii 1098 — zweryfikuj), `server/src/services/partnerReferralService.ts` (`getPartnerProjects`, linie ok. 1519-1571 — zweryfikuj, zapytanie SQL z INNER JOIN i catch-swallow)`.

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
WT=/private/tmp/cx-day188-partner-backend
MARKER=b4651675f6

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day188-partner-backend-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day188-partner-backend/config.worktree"
cat "$VAULT/worktrees/cx-day188-partner-backend/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day188-partner-backend-scratch
mkdir -p /private/tmp/cx-day188-partner-backend-artefakty

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
git -C "$VAULT" log --oneline b4651675f6..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only b4651675f6..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day188-partner-backend-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only b4651675f6..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `pięć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day188-partner-backend

# (T1) R1 — throw bez try/catch w handlerze /earnings-summary
sed -n '1080,1116p' server/src/routes/v8/partner.routes.ts
#   oczekiwane: Promise.all([...PartnerCommissionService.getPayoutEligibility(partnerOrgId)])
#   BEZ żadnego try/catch wokół; jeśli readApprovedPartnerAccrualPolicy rzuci —
#   asyncHandler przepuszcza wyjątek do globalnego error-handlera -> 500 dla
#   CAŁEGO endpointu (nie tylko payoutEligibility).

grep -n "getPayoutEligibility" server/src/services/partnerCommissionService.ts
sed -n '188,203p' server/src/services/partnerCommissionService.ts
#   oczekiwane: linia ~191 `const policy = readApprovedPartnerAccrualPolicy();` bez try/catch.

sed -n '1,45p' server/src/services/partnerAccrualPolicy.ts
#   oczekiwane: PartnerAccrualPolicyBlockedError extends Error, kod
#   'PARTNER_ACCRUAL_POLICY_BLOCKED_OWNER'; rzucany gdy PARTNER_ACCRUAL_POLICY_JSON
#   puste/niepoprawne/status!=='APPROVED'.

# (T2) potwierdzenie: zmienna świadomie nieustawiona (decyzja właściciela)
grep -n "PARTNER_ACCRUAL_POLICY_JSON" docs/program/evidence/closure/codex/PRT-MVP-ACCRUAL-001/DECISION_PACKET.md
grep -n "PARTNER_ACCRUAL_POLICY_JSON" docs/program/evidence/closure/codex/PRT-POL-001/TASK_EVIDENCE.json
#   oczekiwane: "preserve ... absent", "economics compile-time constant false".

# (T3) R2 — KIERUNEK TYPÓW: partner_attributions.organization_id jest UUID,
#   projects.organization_id jest TEXT (SPRAWDŹ SAM, nie ufaj streszczeniu)
grep -n 'organization_id' server/migrations/216_partner_referral_system.sql | head -5
#   oczekiwane: "organization_id UUID NOT NULL" w CREATE TABLE partner_attributions.
grep -n '"organization_id" uuid' server/migrations/20260719_baseline_gap.sql | head -3
#   oczekiwane: potwierdzenie tego samego typu w konsolidacji baseline.
grep -n 'organization_id TEXT' server/migrations/000_z_core_baseline.sql server/migrations/000_initdb_core_tables.sql
#   oczekiwane: projects.organization_id TEXT w obu wariantach bootstrapu; organizations.id TEXT również.

# (T4) zapytanie i catch-swallow w getPartnerProjects
grep -n "export async function getPartnerProjects" server/src/services/partnerReferralService.ts
sed -n '1519,1575p' server/src/services/partnerReferralService.ts
#   oczekiwane: INNER JOIN (SELECT DISTINCT organization_id FROM partner_attributions
#   WHERE partner_org_id = ?) pa ON pa.organization_id = p.organization_id — UUID = TEXT,
#   Postgres rzuca 'operator does not exist: uuid = text'; catch (err) loguje i `return [];`

# (T5) front dziś nie odróżnia błędu od pustki
grep -n "getProjects\|subsection === 'projects'" src/views/partner/PartnerPortalView.tsx
sed -n '1144,1160p' src/views/partner/PartnerPortalView.tsx
#   oczekiwane: `setProjects((response?.projects || []).map(...))` — brak flagi degraded/error,
#   200 z pustą tablicą wygląda identycznie jak realna pustka.

# (T6) dowód odbioru 177 (liczby w raporcie)
grep -n "PRT-D62-005\|PRT-D62-006\|24×\|28×" docs/program/funkcje/ODBIOR_177_PARTNER_STOP.md
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day188-partner-backend-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6108`. Twój JEDYNY port harnessu to `5048 i 5049`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day188-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6107 (odbiory nadzorcy + dyżury 170-187), 5010-5047 (dyżury 170-187), 6404-6411, 6109/5050-5051 (day189, ta sama partia), 6113/5058-5059 (day193, ta sama partia), 6110-6112/5052-5057 (rezerwacja partii, dyżury 190-192, NIE używaj). ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 zajęty przez adb`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartości domyślnej żadnej istniejącej. W szczególności: NIE ustawiasz `PARTNER_ACCRUAL_POLICY_JSON` — jej brak jest ŚWIADOMĄ decyzją właściciela (dowód: `docs/program/evidence/closure/codex/PRT-MVP-ACCRUAL-001/DECISION_PACKET.md:70` — "preserve PARTNER_ACCRUAL_POLICY_JSON absent", `PRT-POL-001/TASK_EVIDENCE.json` — "economics compile-time constant false"). Naprawiasz WYŁĄCZNIE to, co serwer odpowiada, gdy ta zmienna jest pusta — nie włączasz ekonomii partnera`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY188_PARTNER_BACKEND_REPORT.md`. Nie zmieniasz `docs/program/waves/WAVE_03_ACCEPTANCE/modules/16_PARTNER/MODULE_ACCEPTANCE.md` — to naprawa dwóch awarii backendu, nie ponowny odbiór wizualny 25 ekranów. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day188-partner-backend-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day188-partner-backend-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE WŁĄCZASZ ekonomii partnera.** `PARTNER_ACCRUAL_POLICY_JSON` zostaje nieustawiona — to świadoma decyzja właściciela (dowód w T2), nie usterka do naprawienia. Naprawiasz WYŁĄCZNIE kształt odpowiedzi serwera, gdy ta zmienna jest pusta: 200 z jawnym stanem ("polityka niezatwierdzona"/"ekonomia wyłączona"), NIGDY 500. **NIE ZMIENIASZ `readApprovedPartnerAccrualPolicy`/`PartnerAccrualPolicyBlockedError`** w `partnerAccrualPolicy.ts` — ten kod poprawnie odmawia bez polityki; łapiesz jego wyjątek WYŻEJ (w `getPayoutEligibility` albo w handlerze routingu), nie zmieniasz warunku odmowy. **NIE DOTYKASZ innych pięciu wywołań `readApprovedPartnerAccrualPolicy`** w `partnerCommissionService.ts` (linie 360, 524, 697, 885 — zweryfikuj) — licencja obejmuje WYŁĄCZNIE ścieżkę `getPayoutEligibility`→`/earnings-summary`. **Dla R2: NIE zgadujesz kierunku rzutowania na pamięć** — T3 każe ci to zmierzyć samodzielnie; jeśli Twój pomiar da inny wynik niż UUID(partner_attributions)/TEXT(projects) opisany w DLACZEGO, napraw wg TEGO, co zmierzyłeś, i zapisz rozbieżność w raporcie. **NIE migrujesz typu kolumny bez pomiaru kosztu** — masz dwie opcje (rzutowanie w zapytaniu `::text`/`::uuid`, LUB migracja addytywna zmiany typu) — wybierz i uzasadnij, migracja MUSI przejść od pustej bazy (pełny łańcuch migracji, nie tylko nowy plik). **NIE kasujesz try/catch w `getPartnerProjects`** — zostaje jako siatka bezpieczeństwa, ale MUSI przestać maskować realny błąd jako pustkę (patrz pułapka). **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | Odbiór dyżuru 177 po wznowieniu (`docs/program/funkcje/ODBIOR_177_PARTNER_STOP.md`, sekcja "★ WZNOWIENIE WYKONANE") zmierzył 50/50 zrzutów, 25/25 DOM-ów, i wprost wypisał dwóch "kandydatów na dyżur 188": **PRT-D62-005** — `readApprovedPartnerAccrualPolicy` rzuca `PartnerAccrualPolicyBlockedError` (za 4 ekranami rozliczeń, banerem blokady w konsoli, liczba w logach dyżuru 177: 24× wpis) — i **PRT-D62-006** — JOIN `partner_attributions.organization_id` z tabelą `projects` przez niezgodne typy kolumn, cichy błąd przebrany za "Brak aktywnych projektów" (28× wpis w logach 177). Kod dziś potwierdza obie przyczyny z dokładnością do linii — ale UWAGA: kierunek typów w R2 jest ODWROTNY od tego, co sugerował dotychczasowy opis — zweryfikuj sam w §0 poniżej, nie ufaj przelotnej notatce. |

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
cd /private/tmp/cx-day188-partner-backend

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day188-pg psql -U postgres -d cx188 \
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
cd /private/tmp/cx-day188-partner-backend

docker run -d --name cx-day188-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx188 \
  -p 127.0.0.1:6108:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day188-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6108/cx188 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6108/cx188 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day188-partner-backend && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6108/cx188 \
JWT_SECRET=cx188-test-secret-do-not-reuse \
npx vitest run server/src/routes/v8/__tests__, server/src/services/__tests__, tests/unit --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day188-partner-backend-artefakty/day188-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day188-partner-backend && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/v8/__tests__, server/src/services/__tests__, tests/unit --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day188-partner-backend-artefakty/day188-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day188-partner-backend/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day188-pg psql -U postgres -d cx188 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day188-pg`.
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
> **(e) ★★ **Pierwsza: kierunek typów w R2 jest odwrotny od intuicji.** Nie zakładaj, które pole jest UUID a które TEXT — `partner_attributions.organization_id` jest UUID (216_partner_referral_system.sql, potwierdzone w konsolidacji baseline_gap), a `projects.organization_id` ORAZ `organizations.id` są TEXT (000_z_core_baseline.sql, 000_initdb_core_tables.sql) — to schemat mieszany SQLite-dziedziczony/Postgres-natywny w tej samej bazie, nierzadki w tym repo. Zmierz to sam przed pisaniem poprawki (T3); jeśli rzutujesz w złą stronę, zapytanie nadal się wywali, tylko inaczej. **Druga: `getPartnerProjects` ma DWA niezależne miejsca do naprawy, nie jedno.** (a) sam JOIN musi przestać rzucać wyjątek typu (naprawa właściwa — po niej realne projekty się pokażą); (b) `catch` wokół całej funkcji dziś zwraca `[]` przy KAŻDYM błędzie zapytania, nie tylko tym jednym — po naprawie (a) błąd tego konkretnego JOIN-a zniknie, ale catch nadal maskowałby INNY przyszły błąd tej samej funkcji jako pustkę; zdecyduj, czy dorzucasz sygnał degraded (np. rzuć dalej / oznacz wynik), żeby front mógł to pokazać, zamiast pozostawić pułapkę dla następnego incydentu. **Trzecia: front NIE jest bez zasobów.** `EarningsSection.tsx` (linie ok. 560-620, sprawdź `partner.earnings.policyUnavailableTitle`/`AMD-PRT-ECONOMICS-002`) MA JUŻ gotowy bursztynowy baner na dokładnie ten scenariusz (polityka niezatwierdzona) — renderuje się, gdy `programStatus` (osobny endpoint `getProgramStatus()`) się powiedzie, a `summaryResponse` zawiedzie, bo `fetchEarnings` w tym pliku używa `Promise.allSettled`. To jest ISTNIEJĄCY BANER, o którym mówi WYDANY brief — NIE buduj nowego, zweryfikuj że po Twojej naprawie backendu nadal się pokazuje (albo pokazuje się lepiej, bo endpoint już nie 500-uje) I że w konsoli przeglądarki nie zostaje czerwony wpis sieciowy dla `/earnings-summary`. **Czwarta: NIE każdy front-konsument earnings-summary ma tę samą odporność.** `PartnerRuntimeSummaryStrip.tsx` (`loadPartnerRuntimeSummary`, linie ok. 90-96) woła `getEarningsSummaryWithFallback()` wewnątrz zwykłego `Promise.all` (NIE `allSettled`) — dziś, jeśli endpoint rzuca, CAŁY pasek (i cokolwiek go osadza) pada, nie tylko sekcja zarobków; to prawdopodobnie jeden z "4 ekranów rozliczeń" z raportu 177, zmierz które dokładnie po naprawie. **Piąta: `policy_gated` istnieje jako typ i styl w `PartnerCanonicalRuntimePanel.tsx` (`SurfaceState`, linia ok. 20 i `stateClass`, linia ok. 116) ale NIGDY nie jest faktycznie przypisywany w `loadPartnerCanonicalRuntime`** — to martwa gałąź stanu, zainwentaryzuj w raporcie, nie musisz jej podłączać (poza licencją), ale nie myl jej z działającym bursztynowym banerem z `EarningsSection.tsx`, to dwa różne miejsca.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day188-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day188-partner-backend-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — `/earnings-summary` przestaje 500-ować, gdy polityka rozliczeń jest nieustawiona; pozycja R2 — `projects` przestaje mylić błąd zapytania z pustą listą`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6108` albo `5048 i 5049` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6108` albo `5048 i 5049`** (`Z7`).

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

Dwa defekty backendu, żaden nie jest dzisiejszą hipotezą — oba zmierzone przy odbiorze
dyżuru 177 po wznowieniu (`docs/program/funkcje/ODBIOR_177_PARTNER_STOP.md`, sekcja
"★ WZNOWIENIE WYKONANE — przejazd odebrany"). Ten odbiór odtworzył 50/50 zrzutów,
25/25 DOM-ów `active+pl+theme`, i policzył liczby wprost z surowych logów: **24× wpis
accrual-500, 28× wpis uuid=text**. Zero rozjazdu tabela↔zrzut na 9 obejrzanych. Odbiór
sam wypisał oba defekty jako "kandydatów na dyżur 188" — to jest ten dyżur.

**Pierwszy: PRT-D62-005.** `readApprovedPartnerAccrualPolicy()`
(`server/src/services/partnerAccrualPolicy.ts:17`) rzuca `PartnerAccrualPolicyBlockedError`
(kod `PARTNER_ACCRUAL_POLICY_BLOCKED_OWNER`), gdy `PARTNER_ACCRUAL_POLICY_JSON` jest
puste, niepoprawne albo `status !== 'APPROVED'`. Woła ją `getPayoutEligibility`
(`partnerCommissionService.ts:191`), a tę woła handler `GET /earnings-summary`
(`server/src/routes/v8/partner.routes.ts:1098`) wewnątrz zwykłego `Promise.all` —
BEZ jakiegokolwiek `try/catch`. Rzut wyjątku tutaj wywala CAŁY endpoint (nie tylko pole
`payoutEligibility`) przez `asyncHandler` do globalnego error-handlera → 500.

To NIE jest bug wymagający włączenia ekonomii partnera. `PARTNER_ACCRUAL_POLICY_JSON`
jest świadomie nieustawiona — dowód w `docs/program/evidence/closure/codex/PRT-MVP-ACCRUAL-001/DECISION_PACKET.md:70`
("preserve `PARTNER_ACCRUAL_POLICY_JSON` absent...") oraz `PRT-POL-001/TASK_EVIDENCE.json`
("economics compile-time constant false"). Właściciel zdecydował: ekonomia partnera
zostaje OFF. Defekt polega na tym, że serwer odpowiada na to 500-ką zamiast uczciwym
200 z jawnym stanem — CLAUDE.md nazywa to wprost: ekran (i API pod nim) ma mówić,
nie milczeć/wywalać się.

**Drugi: PRT-D62-006.** `getPartnerProjects` (`partnerReferralService.ts:1519`) buduje
zapytanie z `INNER JOIN (SELECT DISTINCT organization_id FROM partner_attributions
WHERE partner_org_id = ?) pa ON pa.organization_id = p.organization_id`. Typy się nie
zgadzają: `partner_attributions.organization_id` jest **UUID**
(`server/migrations/216_partner_referral_system.sql:62` — `organization_id UUID NOT NULL`,
potwierdzone w konsolidacji `20260719_baseline_gap.sql`), a `projects.organization_id`
jest **TEXT** (`000_z_core_baseline.sql:155`, `000_initdb_core_tables.sql:84`) —
tak samo jak `organizations.id` (TEXT w obu wariantach bootstrapu). Postgres rzuca
`operator does not exist: uuid = text` bez jawnego rzutowania. Funkcja ma `catch (err)`
dookoła całego zapytania, który loguje błąd i **zwraca `[]`** — endpoint odpowiada 200
z pustą listą, front renderuje standardowy stan pustki, użytkownik widzi "brak aktywnych
projektów" zamiast informacji, że zapytanie się wywaliło.

★ **Uwaga do siebie samego, wykonawco: kierunek typów opisany wyżej (UUID w
`partner_attributions`, TEXT w `projects`/`organizations`) jest ODWROTNY od tego, co
sugerowałaby intuicyjna nazwa "uuid=text mismatch" bez sprawdzenia, która strona jest
którym typem.** Zmierz to sam w §0 przed napisaniem jakiejkolwiek poprawki — jeśli Twój
pomiar da inny wynik, napraw wg tego, co zmierzyłeś, i zapisz rozbieżność w raporcie.

# 2. TEZY ZLECENIA

- **T1.** `PARTNER_ACCRUAL_POLICY_JSON` zostaje nieustawiona — to nie podlega zmianie w
  tym dyżurze. Zmienia się WYŁĄCZNIE kod odpowiedzi i kształt payloadu, gdy polityka jest
  nieustawiona: 200 z jawnym `payoutEligibility` w stanie "niezatwierdzona/wyłączona",
  nigdy 500.
- **T2.** JOIN w `getPartnerProjects` ma dwa legalne sposoby naprawy — rzutowanie w
  zapytaniu (`::text` po stronie UUID, najbezpieczniejsze bo nie rusza schematu) albo
  migracja addytywna zmiany typu kolumny. Wybierasz i uzasadniasz w raporcie; migracja
  (jeśli wybrana) musi przejść od pustej bazy pełnym łańcuchem, nie jako izolowany plik.
- **T3.** Front ma dziś częściową odporność (nie zero) — `EarningsSection.tsx` już
  obsługuje ten dokładny scenariusz przez istniejący bursztynowy baner
  (`partner.earnings.policyUnavailableTitle`), ale inne miejsca (np.
  `PartnerRuntimeSummaryStrip.tsx`) używają `Promise.all` bez `allSettled` i padają
  całościowo. Napraw backend tak, żeby WSZYSTKIE konsumenty dostały 200, nie tylko ten
  jeden plik z gotowym banerem.

# 3. POZYCJE DYŻURU

## R1 — `/earnings-summary` przestaje 500-ować bez polityki rozliczeń

Zmień `getPayoutEligibility` (`partnerCommissionService.ts`, wywołanie w linii ~191) albo
punkt wywołania w handlerze `/earnings-summary` (`partner.routes.ts`, linia ~1098) tak,
żeby przechwytywał `PartnerAccrualPolicyBlockedError` i zwracał jawny, ubogi
`PayoutEligibility` (np. `{ eligible: false, reason: 'POLICY_NOT_APPROVED', ... }` —
dopasuj kształt do istniejącego interfejsu `PayoutEligibility`, nie wymyślaj nowych pól
bez potrzeby) zamiast przepuszczać wyjątek dalej. NIE zmieniaj `readApprovedPartnerAccrualPolicy`
ani klasy błędu — łap wyjątek WYŻEJ, tylko na tej jednej ścieżce wywołania
(`getPayoutEligibility` używana przez `/earnings-summary`); pozostałe pięć wywołań
`readApprovedPartnerAccrualPolicy` w tym pliku (linie ~360, 524, 697, 885 — zweryfikuj)
zostają nietknięte, bo są poza licencją tego dyżuru.

Po naprawie zweryfikuj w przeglądarce (harness lokalny, nie demo): `GET
/api/v8/partner/earnings-summary` zwraca 200, konsola nie pokazuje czerwonego wpisu
sieciowego dla tego requestu, a `EarningsSection.tsx` nadal (albo lepiej niż dziś)
pokazuje bursztynowy baner "Partner economics unavailable" — nie nowy, ten sam co dziś,
tylko bez towarzyszącego mu błędu w konsoli.

Sprawdź też `PartnerRuntimeSummaryStrip.tsx` (`loadPartnerRuntimeSummary`, `Promise.all`
bez `allSettled`) i wszystkie inne miejsca wołające `V8PartnerApi.getEarningsSummary()` —
po naprawie backendu żadne z nich nie powinno już dostawać odrzuconej obietnicy z tego
powodu. Wypisz w raporcie, ile realnie było "4 ekranów rozliczeń" z raportu 177 i które
konkretnie.

**Ukończone, gdy:** `/earnings-summary` zwraca 200 z pustym środowiskiem (bez
`PARTNER_ACCRUAL_POLICY_JSON`), zero wpisu 500 w logach serwera i w konsoli przeglądarki
dla tego requestu, a istniejący baner "policy unavailable" nadal się renderuje.

## R2 — `projects` przestaje mylić błąd zapytania z pustą listą

Napraw JOIN w `getPartnerProjects` (`partnerReferralService.ts:1519`) tak, żeby typy się
zgadzały — zmierz kierunek w §0 (T3 tej instrukcji) i albo dodaj rzutowanie w zapytaniu
(prawdopodobnie `pa.organization_id::text = p.organization_id`, bo `partner_attributions`
jest po stronie UUID a `projects` po stronie TEXT — ale ZWERYFIKUJ, nie kopiuj ślepo),
albo napisz migrację addytywną ujednolicającą typ, uzasadniając wybór w raporcie
(koszt: ile innych zapytań/kluczy obcych dotyka `partner_attributions.organization_id`
jako UUID — sprawdź przed decyzją o zmianie typu kolumny, migracja nie może wywrócić
innych ścieżek).

Osobno: `catch (err)` wokół całego zapytania w tej funkcji dziś zamienia KAŻDY błąd w
`[]` — po naprawie JOIN-a ten konkretny błąd zniknie, ale funkcja nadal maskowałaby
przyszły błąd tej samej klasy identycznie jako dziś. Zdecyduj i zaimplementuj sposób,
żeby front mógł odróżnić "zapytanie się wywaliło" od "naprawdę zero projektów" — np.
sygnał `degraded`/rzut dalej z osobnym kodem, dopasowany do wzorca już istniejącego w
tym samym API (`degraded` pole w odpowiedzi `/earnings-summary`, patrz `partner.routes.ts`
linia ok. 1112 `...(detail.degraded ? { degraded: detail.degraded } : {})`).

Zmień front (`PartnerPortalView.tsx`, blok `fetchData` dla `subsection === 'projects'`,
linie ok. 1144-1158) tak, żeby renderował inny stan dla "błąd/degraded" niż dla
"lista pusta, zero błędu" — bez zmiany wyglądu pustego stanu tam, gdzie pustka jest
realna.

**Ukończone, gdy:** partner z realnymi projektami przypisanymi przez
`partner_attributions` widzi je na liście (dowód: mutacja — usuń/przywróć rzutowanie,
zapytanie ma się wywalać czerwono bez naprawy i zwracać wiersze po naprawie), a partner
bez żadnych przypisań nadal widzi uczciwy pusty stan, nie błąd.

## R3 — dowody

Dla R1: test integracyjny przez realny Gateway (nie mock) wołający
`GET /api/v8/partner/earnings-summary` bez ustawionej `PARTNER_ACCRUAL_POLICY_JSON` i
asercja kodu 200 + jawnego pola stanu polityki w odpowiedzi (nie 500, nie wyjątek).
Osobna mutacja: ustaw `PARTNER_ACCRUAL_POLICY_JSON` na poprawny JSON w teście i sprawdź,
że ścieżka "zatwierdzona polityka" nadal działa identycznie jak dziś (zero regresji na
happy path).

Dla R2: test integracyjny z prawdziwym seedem — partner z `partner_attributions` wskazującą
realny `organization_id`, projekt tej organizacji w `projects` — asercja, że
`GET /api/v8/partner/projects` zwraca niepustą listę. Mutacja w obie strony: cofnij
rzutowanie → test czerwony z dowodem błędu typu w logu zapytania; przywróć → zielony.
Osobny test dla `catch`-swallow: wymuś inny błąd zapytania (np. przez tymczasowe zerwanie
połączenia albo złą kolumnę w mocku) i sprawdź, że odpowiedź niesie sygnał degraded, nie
milczącą pustą listę.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/services/partnerCommissionService.ts` — wyłącznie ścieżka `getPayoutEligibility` (linia ~191 i jej bezpośrednie sąsiedztwo obsługi błędu) |
| Zapis | `server/src/routes/v8/partner.routes.ts` — wyłącznie handler `GET /earnings-summary` (linie ok. 1078-1116) |
| Zapis | `server/src/services/partnerReferralService.ts` — wyłącznie `getPartnerProjects` (linie ok. 1519-1575) |
| Zapis | `src/views/partner/PartnerPortalView.tsx` — wyłącznie blok `fetchData` dla `subsection === 'projects'` (linie ok. 1144-1158) |
| Zapis (warunkowo) | nowa migracja addytywna pod `server/migrations/` — TYLKO jeśli wybierzesz opcję migracji zamiast rzutowania w zapytaniu, uzasadnione w raporcie |
| Zapis | testy `day188.*` — lokalizację potwierdź wg konwencji sąsiadującej z każdym zmienianym plikiem (`server/src/routes/v8/__tests__/`, `server/src/services/__tests__/`) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY188_PARTNER_BACKEND_REPORT.md` |
| Odczyt | `server/src/services/partnerAccrualPolicy.ts` — źródło błędu; **nie zmieniasz** |
| Odczyt | `src/views/partner/sections/EarningsSection.tsx` — istniejący baner, kontekst R1; **nie zmieniasz** |
| Odczyt | `src/components/Partner/PartnerRuntimeSummaryStrip.tsx`, `src/components/Partner/PartnerCanonicalRuntimePanel.tsx` — kontekst odporności frontu; **nie zmieniasz** poza licencją |
| Odczyt | `server/migrations/216_partner_referral_system.sql`, `20260719_baseline_gap.sql`, `000_z_core_baseline.sql`, `000_initdb_core_tables.sql` — dowód typów kolumn |
| Odczyt | `docs/program/funkcje/ODBIOR_177_PARTNER_STOP.md` — dowód R1/R2; nie zmieniasz |
| Odczyt | `docs/program/evidence/closure/codex/PRT-MVP-ACCRUAL-001/DECISION_PACKET.md`, `PRT-POL-001/TASK_EVIDENCE.json` — dowód decyzji "ekonomia OFF"; nie zmieniasz |

**Nietykalne imiennie:** `docs/program/waves/WAVE_03_ACCEPTANCE/modules/16_PARTNER/MODULE_ACCEPTANCE.md`
(werdykt bez zmian — to naprawa backendu, nie ponowny odbiór wizualny); zmienna
`PARTNER_ACCRUAL_POLICY_JSON` w jakimkolwiek pliku env/konfiguracji (zostaje nieustawiona);
`readApprovedPartnerAccrualPolicy`/`PartnerAccrualPolicyBlockedError` (warunek odmowy
się nie zmienia, tylko obsługa wyżej).

★ **Rozłączność z dyżurami działającymi równolegle w tej samej partii:** 189 (i18n
Partnera — dotyka `PartnerPortalView.tsx` w INNYCH miejscach: mapy breadcrumbów, etykiety
KPI, statusy; jeśli oba dyżury modyfikują ten sam plik równolegle, TWOJA licencja jest
wąska do bloku `fetchData`/`subsection === 'projects'` — nie ruszaj breadcrumbów, etykiet
KPI ani statusów przy okazji), 193 (piny testów — zero pokrycia plikowego z tym dyżurem).

# 5. TWARDE ZASADY

- ★ **NIE WŁĄCZASZ ekonomii partnera.** `PARTNER_ACCRUAL_POLICY_JSON` zostaje pusta —
  to decyzja właściciela, nie usterka.
- **Nie zmieniasz warunku odmowy w `partnerAccrualPolicy.ts`** — łapiesz wyjątek wyżej,
  tylko na ścieżce `/earnings-summary`.
- **Nie zgadujesz kierunku typów w R2** — zmierz sam przed poprawką (§0/T3), zapisz co
  zmierzyłeś w raporcie nawet jeśli zgadza się z opisem w tej instrukcji.
- **Migracja (jeśli wybrana) musi przejść od pustej bazy pełnym łańcuchem** — nie testujesz
  jako izolowany plik na już-zmigrowanej bazie.
- **Nie kasujesz `try/catch` w `getPartnerProjects`** — zostaje jako siatka bezpieczeństwa,
  ale przestaje maskować błąd jako pustkę.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wszystko lokalnie, własny
  kontener `cx-day188-pg`, port DB 6108.
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0 w każdym
  wyniku, który przywołujesz jako dowód.
- ★ Port **5000 zajęty na stałe przez macOS Control Center**, port **5037 przez adb** —
  nie używaj ich do żadnego serwera pomocniczego.
- Wymóg sekcji „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie końcowym — wypisz w niej wprost,
  jeśli nie zdążyłeś zmierzyć dokładnie, które 4 ekrany rozliczeń były dotknięte 500-ką z
  raportu 177, albo jeśli migracja typu (jeśli wybrana) nie została przetestowana od
  zupełnie pustej bazy.
