# INSTRUKCJA — Codex 2b — „SZEŚCIU PISARZY LEGACY → KANON"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify — bez rozmowy, w której powstał, i bez instrukcji poprzednich dyżurów.
**Ten blok ma JEDEN etap rdzeniowy (`E2`) i raport (`E9`)** — to świadoma zmiana wobec
bloku CODEX2 („Jeden magazyn, część 2"), który miał 2082 linie, dziewięć etapów
i dowiózł 1,5 z nich. Odbiór tamtego bloku (`CODEX2_JEDEN_MAGAZYN_2/97_ODBIOR_W1_W2.md`
§9) postawił regułę dosłownie: **blok = JEDEN etap rdzeniowy, nie dziewięć.** Nie
dobieraj sobie zakresu.

> ### ★★ ZAKAZ NR 1 — KATALOG WŁAŚCICIELA. CZYTASZ TO, ZANIM URUCHOMISZ COKOLWIEK.
> **Nie dotykasz `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani
> do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`, ani `fetch`, ani
> `worktree add`. To brudny checkout właściciela i jest **NIETYKALNY**. Jedyny
> dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86`, komenda
> w `§0.1`. **To najczęstsza przyczyna straconej godziny w tym programie** — dyżur 53
> zrobił `git worktree add` w katalogu właściciela i stanął na STOP-ie, który nie miał
> prawa powstać. **DRUGI ZAKAZ MIEJSCA: NIE PRACUJESZ W `/private/tmp`** — restart
> 08.09 wyczyścił ten katalog i skasował worktree, sekrety i zrzuty sześciu
> wykonawców naraz.

> ### ★★ MARKER I STAN WYDANIA
> **SHA markera: `<TIP>`** — wpisuje nadzorca przy wydaniu (tip linii integracyjnej
> `origin/integracja/20260911` po scaleniu i pushu).
> **Gałąź bazowa: `origin/integracja/20260911`** (w vaulcie). **NIE `origin/staging`,
> NIE `origin/demo`, NIE `Londyn`** — tamte nie mają ani `E1` Codexa 2 (zapis
> kanoniczny `PUT`), ani paczek `E3`, ani `E7` (seed pisze do kanonu).
> **Stan dokumentu: PROJEKT — marker do wpisania przez nadzorcę.**
> Widzisz `WYDANY` + konkretny SHA → zaczynasz. Widzisz `PROJEKT` albo `<TIP>` →
> **nie zaczynasz i zgłaszasz to nadzorcy**. Ta ramka jest jedynym miejscem,
> w którym rozstrzyga się stan wydania.

Data wystawienia: 2026-09-11. Autor: nadzorca sesji głównej (CTO), w imieniu
właściciela (Piotr). Język pracy i raportu: **polski**; kod, identyfikatory, nazwy
plików, komunikaty w kodzie i klucze i18n: **angielski** (`DEC-461`). Zakres modułowy:
`05_INITIATIVES` + `06_EXECUTION`, **warstwa danych i zapisu, zero zmian wyglądu**.

---

## 0.1. ★★ BAZA PRACY, MARKER I GAŁĄŹ — PROCEDURA DOSŁOWNA, Z VAULTA

Pracujesz z **BARE-vaulta**, nie z checkoutu właściciela:
`/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git`.
Vault ma `extensions.worktreeConfig=true` — **to obsługujesz w kroku (4)**.

```bash
VAULT=/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
WT=/Users/piotrwisniewski/Developer/codex-wt/codex2b-szesciu-pisarzy
MARKER=<TIP>

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego bloku
df -h /

# (1) fetch WYLACZNIE z `origin` (ODCZYT). NIGDY `--all` (remote `icloud-source`
#     jest martwy), NIGDY `git push` (Z1).
git -C "$VAULT" fetch origin --prune

# (2) marker — warunek rodowodu
git -C "$VAULT" log --oneline -15 origin/integracja/20260911
git -C "$VAULT" merge-base --is-ancestor "$MARKER" origin/integracja/20260911 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZYSZ GO SAM, Z VAULTA, w ~/Developer/codex-wt
mkdir -p /Users/piotrwisniewski/Developer/codex-wt
git -C "$VAULT" worktree add "$WT" -b codex/szesciu-pisarzy-legacy-20260911 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/codex2b-szesciu-pisarzy/config.worktree"
cat "$VAULT/worktrees/codex2b-szesciu-pisarzy/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem wlasciciela
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13) — i POZA /private/tmp
mkdir -p /Users/piotrwisniewski/Developer/codex-wt/codex2b-{scratch,artefakty}

# (7) sanity — wynik (2) i (7) wklejasz do raportu DOSLOWNIE
git -C "$WT" rev-parse HEAD
git -C "$WT" status --short | head -3
```

> **★★ REMOTE `icloud-source` JEST MARTWY.** Vault ma `origin` (żywy — stąd
> fetch, ale NIGDY push), `github-backup` i `icloud-source` wskazujący na
> nieistniejący katalog. **Nie wołasz `git fetch --all`.** Błąd `icloud-source`
> **NIE jest** negatywnym wynikiem markera i **NIE jest** powodem STOP-u. Jedyny
> negatywny wynik to napis `MARKER BRAK`.

**Kontrola bazy PO własnych commitach** (poprawka z dyżuru 133 — „`git log -1`
pokaże marker" jest prawdą tylko przed pierwszym commitem):
`git -C "$WT" merge-base --is-ancestor "$MARKER" HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"`.

**Reguła rozejścia (`DEC-2026-08-26-95`).** Marker **nie jest** przodkiem tipa →
**STOP całości**; nie improwizujesz bazy. Marker **JEST** przodkiem, ale tip uciekł do
przodu → **to NIE jest STOP**: startujesz dokładnie z markera i wpisujesz do raportu
`git -C "$VAULT" log --oneline <MARKER>..origin/integracja/20260911`. Scalenie
z nowszym tipem robi **nadzorca przy odbiorze**. **Rebase w trakcie pracy: ZAKAZANY** (`Z3`).

**Push: w TYM bloku NIE PUSHUJESZ NIC I NIGDZIE** (`Z1`; wiersz `Z34a` zostaje w tabeli
tylko dla ciągłości numeracji i jest wyłączony tym akapitem). Gałąź żyje we wspólnym
vaulcie, nadzorca ma do niej dostęp bez pushu. **Commitujesz po każdym kroku**
(`E2.0`…`E2.6`, `E9`). Lista plików do `§0.4a`: `git -C "$WT" diff --name-only <MARKER>..HEAD`.

---

## 0.1a. ★★ WERYFIKACJA STANU WEJŚCIOWEGO — OSIEM KOMEND, WSZYSTKIE OBOWIĄZKOWE

Każda ma mój wynik zmierzony 2026-09-11 na tipie linii integracyjnej. **Twój pomiar jest
wiążący, nie mój.** Rozbieżność idzie do „Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex2b-szesciu-pisarzy

# (1) ★★★ RDZEN: TRASY ZAPISU szesciu pisarzy
awk '/^router\.(post|put|patch|delete)\(/{m=NR; meth=$0} \
     /\x27\/:id\/(milestones|resources|staffing-plans|budget-items|gate-roles|move)/{ \
       if (NR-m<=2) print m" "meth" -> "NR": "$0}' server/src/routes/pmo/initiatives.routes.ts

# (2) ★★★ czy ktos je wola z `src/` (pytanie 1 procedury E2) — BEZ `| head` (Z34, pulapka 6)
for p in milestones resources staffing-plans budget-items gate-roles move; do \
  echo "--- $p: $(grep -rn "initiatives/.*/$p" src | grep -v __tests__ | wc -l)"; done

# (3) ★★★ ktora tabela czyta EKRAN (model odczytu z pytania 3)
grep -n "FROM initiative_milestones\|FROM initiative_resources\|FROM initiative_budget_items\|FROM initiative_gate_roles" \
  server/src/controllers/InitiativeController.ts | head
grep -oE "(FROM|INTO|UPDATE) [a-z_]+" server/src/services/staffingPlanService.ts | sort | uniq -c | sort -rn | head -5

# (4) ★★★ WZORZEC, KTORY JUZ ZADZIALAL — jedyny kanoniczny pisarz do tabeli modelu odczytu
grep -nE "async (create|update|delete)[A-Za-z]+\(" server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts
grep -nE "INSERT INTO [a-z_]+" server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts | head -3

# (5) kandydaci kanoniczni w runtime-v1
grep -nE "'/(initiatives|execution-cases|resource-commitments|capacity-scenarios)[^']*'" \
  server/src/routes/pmo/initiativesExecutionRuntime.routes.ts | grep -iE "milestone|resource|budget|gate-signoff|capacity|metadata"

# (6) flagi — obie MUSZA byc domyslnie OFF
grep -rn "ENABLE_INITIATIVE_UNIFIED_WRITE\|ENABLE_INITIATIVE_UNIFIED_READ" server/src src scripts | grep -v __tests__

# (7) gdzie siedzi middleware odpowiadajacy 409 PRZED handlerem
grep -n "requireCanonicalInitiativeExecutionWriter" server/src/routes/pmo/initiatives.routes.ts
grep -n "LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS" -A 6 server/src/middleware/executionSpineLegacyReadOnly.middleware.ts

# (8) zasoby wylaczne
lsof -nP -iTCP -sTCP:LISTEN | grep -E ":(6454|5594)\b"      # oczekiwane: pusto
docker ps -a --format '{{.Names}}' | grep -c "cx-codex2b"    # oczekiwane: 0
ls server/migrations | grep -cE "^2026216[0-9]"              # oczekiwane: 0
ls server/migrations | grep -oE "^[0-9]{8}" | sort -u | tail -1
```

| # | Mój wynik (tip, 11.09) |
| --- | --- |
| (1) | **19 tras zapisu** — `move` POST `:3330` · `milestones` POST `:3456`/PUT `:3466`/DELETE `:3476` · `resources` POST `:3521`/DELETE `:3531`/PUT `:3541`/POST `ai-apply-log` `:3551` · `staffing-plans` POST `:3563`/PUT `:3570`/DELETE `:3576`/POST roles `:3583`/PUT roles `:3589`/DELETE roles `:3595`/POST `sync-capacity` `:3603` · `budget-items` POST `:3624`/PUT `:3634`/DELETE `:3644` · `gate-roles` PUT `:3808` |
| (2) | **6/6 mają realnych wołaczy**: milestones 6 · resources 6 · staffing-plans 10 · budget-items 5 · gate-roles 4 · move 1 = **32**. **Odpowiedź na pytanie 1 brzmi TAK dla każdej z sześciu.** |
| (3) | `initiative_milestones` `:3696` · `initiative_resources` `:4326` · `initiative_budget_items` `:4697` · `initiative_gate_roles` `:5904`; staffing: `staffing_plans` + `staffing_plan_roles`; move: `UPDATE initiatives SET project_id` (`InitiativeController.ts:2939` + 59 linii niżej) |
| (4) | **DOKŁADNIE TRZY** metody piszące do tabeli modelu odczytu: `createRaidItem :51`, `updateRaidItem :108`, `deleteRaidItem :167` — `INSERT INTO raid_items :83`. **Dla pozostałych pięciu rodzin pisarzy: ZERO.** To jest luka, którą zamykasz |
| (5) | metadata `:2199` · capacity-scenarios `:4221`/`:4322`/`:4449`/`:4468`/`:4725` · resource-commitments `:4484`/`:4522`/`:4551` · execution-cases milestones `:4978`/`:5021` · budget-entries `:5632` (void)/`:5664` · gate-signoffs `:7405` · raid-items `:5756`/`:5793`/`:5836` |
| (6) | 2 trafienia, oba `=== 'true'` (domyślnie OFF): `InitiativeController.ts:143` (WRITE), `initiativeUnifiedReader.ts:238` (READ) |
| (7) | montaż `:193` (**stara instrukcja mówiła `:161` — plik odjechał; to KOREKTA, nie sprzeczność**). Lista wzorców: middleware `:82-87`, **cztery** wzorce (`start-execution\|block\|unblock`, `raid`, `lifecycle-*`, `apply-*`). **Sześciu pisarzy na tej liście NIE MA — są PRZYWRÓCENI**, komentarz `:52-81` |
| (8) | porty `6454` i `5594` **WOLNE**; 0 kontenerów `cx-codex2b`; 0 zajętych numerów w `20262160`–`20262169`; najwyższy zajęty numer migracji: **20262108** |

---

## 0.2. Bezwzględne ZAKAZY — `Z1`–`Z46`

Numeracja `Z` jest wspólna dla całego programu i **nie wolno jej przestawiać**.
Zakazy o mniejszym ostrzu w tym bloku są zgrupowane; obowiązują tak samo.

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push`** — żaden remote, żadna gałąź. `git fetch origin` (odczyt) dozwolony i wymagany | Krach 3/4 wyszedł z pushu wykonawcy |
| `Z2`·`Z3` | Nie zmieniasz `origin/demo`, `Londyn`, `origin/staging`, `origin/integracja/20260911` ani cudzych gałęzi; żadnego `--force`, `reset --hard`, `rebase` w trakcie pracy. Odczyt (`git show/diff/log`) dozwolony | Kilkanaście stanowisk równolegle; krach 3/4 |
| `Z4` | Nie czytasz i nie kopiujesz `PRESERVED_PRODUCT_WIP`/`NO_COPY` ani `server/src/_backup/**` — **ma trafienia `FROM initiatives`, NIE liczysz ich i NIE ruszasz** | Śmietnik kolizji TS/JS |
| `Z5`·`Z6` | **★★ Nie dotykasz `/Users/piotrwisniewski/Developer/Consultify`** poza symlinkiem `node_modules` (odczyt). Nie dotykasz cudzych worktree w `~/Developer/wt/**`, `~/Developer/codex-wt/codex1-*`, `codex2-*`, `codex3-*` ani `/private/tmp/**`; katalogi z `§0.1` są Twoje | STOP dyżuru 53 kosztował godzinę; 26 równoległych worktree |
| `Z7` | **★★ Twój JEDYNY port bazy `6454`, harnessu `5594`, kontener `cx-codex2b-pg`. ZAKAZANE (zajęte, 11.09): `5432`, `5433`, `5461`, `5462`, `5465`, `6451`, `6452`, `6453`, `54400`, `54410`, `54418`, `55432`, `55439`, `55441`, `55461`** | Trzy incydenty zapisu do cudzej bazy |
| `Z8`·`Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem**: `railway` CLI, `psql` do hosta ≠ `127.0.0.1`, `curl`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | **Jedyny zakaz, którego naruszenie zatrzymuje CAŁY blok.** „To był tylko SELECT" nie łagodzi |
| `Z9` | Żadnej bazy poza Twoim kontenerem. **`consultify_staging_1009` w `consultify-pg18` (`54418`) to ŹRÓDŁO SZABLONU — `pg_dump` i `SELECT`, zero zapisu** | Demo i staging mają osobne żywe bazy |
| `Z10` | **★★ Zero nowych flag i zero zmian wartości domyślnej.** Używasz **istniejącej** `ENABLE_INITIATIVE_UNIFIED_WRITE` (default OFF) i jej domyślnej NIE zmieniasz; `ENABLE_INITIATIVE_UNIFIED_READ` też zostaje OFF | Krach 07-12: masowe włączenie flag na żywo |
| `Z11` | **★★ Nie odsłaniasz nowego ekranu.** Ten blok nie tworzy żadnego — uznasz, że musisz coś narysować → STOP MERYTORYCZNY | `CLAUDE.md` §7 |
| `Z12` | **★★ Nie zmieniasz modelu uprawnień ani bramek platformowych:** `auth.middleware.ts`, `Gateway.ts`, `v8FeatureGate.middleware.ts`, `betaGate.middleware.ts`, `pmoValidation.middleware.ts`, `effectiveAccessService.ts`, `assessmentPermissionService.ts` | Dyżury 37/43/46/52 rozjechały się na nich |
| `Z13`·`Z17` | Nie tworzysz nowych dokumentów rejestrowych — **dokładnie JEDEN plik raportu** (`E9`); zrzuty, logi i manifesty leżą poza repo, w `codex2b-artefakty`, z `shasum -a 256` w raporcie. **Zakaz wszystkiego poza zakresem tego bloku** — wg tabeli licencji | Dokumentacja rośnie szybciej niż produkt; rozłączność ze stanowiskami równoległymi |
| `Z14`·`Z16`·`Z19`·`Z38`·`Z39` | Nie zmieniasz `OWNER_DECISION_LEDGER`; nie „naprawiasz" uczciwych `503 not_configured`/`null`/`UNKNOWN`/nagrobków `410`; nie odmontowujesz routerów, middleware ani jobów CI; nie uruchamiasz realnych workflow GitHub Actions | Uczciwy `503` jest wzorcem POPRAWNYM; bramki znikają łatwiej, niż wracają |
| `Z15` | Zero modelu językowego — żaden pomiar ani test nie woła `llmService`, `/api/ai/**`, `GoogleGenerativeAI` | `DEC-51` |
| `Z18` | **★★ NAJOSTRZEJSZY — absolutny zakaz zmiany globalnej infrastruktury testowej:** `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `playwright*.config.ts`, `assertRealPostgres.ts` | Jedna zmiana globalnego mocka fałszuje cały korpus |
| `Z20`·`Z25`·`Z26` | **★★ Zero testów DB bez jawnego kompletu env W TEJ SAMEJ LINII, z `DATABASE_URL` na port `6454`** (`§0.2c`). Kolejność: NAJPIERW kontener + pełne migracje, DOPIERO potem pomiar | Trzy incydenty zapisu do cudzej bazy; tak zginął dzień 23 |
| `Z21`·`Z22` | **DoD wymaga DOWODU OSIĄGALNOŚCI**: HTTP → realny `ApiGateway` → `verifyToken` → trasa → handler → zapytanie → **wiersz w Twojej bazie** → odczyt, który ten wiersz podnosi → konsument w `src/` albo jawne „brak konsumenta". **Test wstrzykujący zależności albo montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej** — dowodem jest `ApiGateway.getInstance().initializeRoutes(app)` | Istnienie kodu ≠ działanie; replika rozjeżdża się z produkcją |
| `Z23`·`Z24` | **★★ ZERO ATRAP.** `200` z pustą kopertą tam, gdzie zapytanie padło, jest atrapą; **`200` bez identyfikatora i bez treści NIE JEST zaliczeniem powierzchni**. **Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu**, przepisanie cudzej liczby = zawyżenie | Odbiór C2 nazwał to „kryterium słabym" i odrzucił; liczby autora krążą po dokumentach jako „fakt" |
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci.** Stan odkładasz przez `cp` do `codex2b-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree repozytorium** |
| `Z29` | **★★ `--retry=0` w KAŻDEJ komendzie testowej** i `retry: 0` w `describe`/`it` | Test „409 dla pisarza zastanego" leczy się skutkiem własnego ataku |
| `Z30` | **★★ ZAKAZ REALNEJ WYSYŁKI E-MAILI, ZAPROSZEŃ I POWIADOMIEŃ.** Przed pierwszym przebiegiem zapisującym udowodnij protokół `§0.2b`. **Ostrze tego bloku: KAŻDA komenda kanoniczna produkuje `ie_outbox_events`** | Wysłany e-mail jest nieodwracalny |
| `Z31` | **★★ Zakaz przypinania strażnika realdb do hosta, portu i nazwy bazy.** Wołasz `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW** | Dyżur 43: 30 przypadków stało się trwałym `SKIP`, pakiet raportował `exit 0` |
| `Z32` | **★★ ZAKAZ `FIXED`/`VERIFIED`/`ZROBIONE_WG_DoD` BEZ DOWODU MUTACYJNEGO W OBIE STRONY.** Psujesz kod → test CZERWONY; cofasz przez `cp` → ZIELONY; `git diff` pusty. Obie komendy i oba wyniki dosłownie w raporcie | **CODEX1 i CODEX2 oddały etapy bez dowodów mutacyjnych — oba odbiory uznały DoD za niespełnione. Nie powtarzasz tego** |
| `Z33`·`Z34` | **★★ Przed każdym pomiarem sprawdzasz, czy strażnik nie wyłącza się sam w trybie testowym** (ramka `§0.2e`). **GREP DOWODZI, ŻE ŁAŃCUCH ISTNIEJE, NIE ŻE DZIAŁA** — „działa" piszesz wyłącznie po realnym żądaniu HTTP z podpisanym JWT na realnym Postgresie po pełnych migracjach, **z zapisanym kodem odpowiedzi** | 416 fałszywych twierdzeń na jednym strażniku; 28.08 zmierzono kompletny łańcuch, a każdy `POST` zwracał `500` |
| `Z34a` | **WYŁĄCZONY W TYM BLOKU** — nie pushujesz nic i nigdzie (`§0.1`) | Numeracji nie przestawiamy |
| `Z35`·`Z36`·`Z37` | Zakaz „naprawiania" przez wyciszanie (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `.skip`, poszerzanie `exclude`, obniżanie progów, `continue-on-error: true`) — jedyne wyjście → **STOP z uzasadnieniem**; `it.todo` wyłącznie w kształcie `Z43`, a **`it.fails` NIGDY na asercji bezpieczeństwa ani izolacji tenanta**. Zakaz `eslint --fix`/`prettier --write` szerzej niż plik, który i tak zmieniasz. **Porównania testów po NAZWACH (`fullName`), NIGDY po liczbach** | To choroba, którą program leczy; autofix skasowałby pracę wszystkich stanowisk; liczby maskują regresję |
| `Z40` | **★★ NIE KASUJESZ I NIE PRZEMIANOWUJESZ ŻADNEJ TABELI ZASTANEJ** (`initiatives`, każda `initiative_*`, `staffing_plan*`, `raid_items`). Migracje **wyłącznie addytywne**: zero `DROP`, `RENAME`, `DELETE` na danych zastanych, `TRUNCATE`, zero zmian istniejących plików w `server/migrations/**` | 09.09 czystka „sierot" skasowała 319 wierszy konfiguracji: każde tworzenie inicjatywy zwracało `500` |
| `Z41`·`Z42` | **Nazwa bazy jest PARAMETREM (`--baza=`), nigdy stałą; zakaz `if (database !== '<moja>') throw`** — bezpieczeństwo daje czarna lista hostów z `assertRealPostgres.ts` + `--oczekiwany-host 127.0.0.1`. **Manifest i pliki z danymi klienta wyłącznie w trybie zapisującym** (`--zapisz-manifest`, tryb `0600`); `--dry-run` nie zapisuje ani jednego wiersza danych klienta | `FIX-E3-1`: twardy `throw` uczynił skrypt bezużytecznym poza jednym kontenerem. `FIX-E3-2`: `--dry-run` wyprodukował 920 KB ze 105 pełnymi wierszami klienta |
| `Z43` | **★★ Test nie przybija stanu zastanego.** Asercja celu: `expect(widoczne).toEqual(expect.arrayContaining([...]))`. Snapshot złego stanu — osobno, jawnie nazwany `it('SNAPSHOT STANU ZASTANEGO — …')`, z komentarzem, kiedy ma zniknąć | `FIX-E5-1`: test **karał za postęp** i siedział w domyślnej suicie CI |
| `Z44` | **★★ Akapit `§0.2e` mieszka W PLIKU TESTU, nie tylko w raporcie:** komentarz nagłówkowy rozstrzygający pułapki (a)–(f) **oraz** twarde asercje w `beforeAll` — `DB_TYPE='postgres'`, `ENABLE_V8_GLOBAL='true'`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE='enforce'`, `ENABLE_TEST_AUTH_BYPASS` ≠ `'true'`. **Pomiar bez tego akapitu nie liczy się jako dowód** | `FIX-E5-2`/`FIX-8`: odbierający musiał zrobić dowód za wykonawcę |
| `Z45` | **★★ Zero `.catch(() => {})` i zero cichego połknięcia w każdej ścieżce, której dotykasz** — też `try {…} catch {}` bez logu. Każda ścieżka zapisu kończy się sukcesem albo **widocznym dla człowieka** komunikatem | Cisza po nieudanym zapisie kosztowała odbiór dwóch modułów 07.09 |
| `Z46` | **★★ Klucze i18n w parytecie PL + EN, w tym samym commicie, wartość realnie przetłumaczona.** Klucz w `pl` z angielską wartością **nie jest tłumaczeniem**. Zakaz zmiany wartości istniejących kluczy | „Klucz istnieje ≠ przetłumaczony" |


## 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**Ostrze tego bloku: każda komenda kanoniczna zapisuje `ie_outbox_events`.** Zdarzenie
może **leżeć** w outboksie — nie może zostać **doręczone**. Przed pierwszym przebiegiem
zapisującym wykonujesz i wklejasz do raportu:

```bash
env | grep -iE "smtp|sendgrid|mailgun|postmark|ses_"                      # (a) oczekiwane: pusto
docker exec cx-codex2b-pg psql -U postgres -d cx_codex2b -Atc \
  "SELECT count(*) FROM settings WHERE key ILIKE '%smtp%'"                # (b) 0; brak tabeli -> wklej blad
grep -rn "startOutboxDrain\|outboxDrain\|drainOutbox" server/src | grep -v __tests__   # (c) drenaze startuja w index.ts, ktorego NIE uruchamiasz
docker exec cx-codex2b-pg psql -U postgres -d cx_codex2b -Atc \
  "SELECT count(*) FROM ie_outbox_delivery_receipts"                      # (d) po KAZDYM kroku zapisujacym: 0
```

**★ DRUGIE DNO w (b): `emailService` czyta SMTP NAJPIERW Z BAZY**, nie tylko ze
środowiska. Zdanie do raportu (sekcja 7), dosłownie: „Zero realnych wysyłek. Zdarzenia
leżą w `ie_outbox_events` (N sztuk), `ie_outbox_delivery_receipts` = 0, żaden drenaż
nie działał w procesie testowym."


## 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — ZAWSZE W JEDNEJ LINII

**Zmienna postawiona `export`-em wcześniej NIE LICZY SIĘ.** `vitest.config.ts` przybija
`DB_TYPE='sqlite'`, więc komplet musi stać **w tej samej linii komendy** — i masz
**udowodnić asercją, że nadpisał** (`Z44`), a nie założyć. **★ `zsh` nie dzieli zmiennej
na słowa**: `$SCIEZKI="a b"` trafi do `vitest` jako JEDEN argument — ścieżki wypisujesz
dosłownie.

**(A) MIGRACJE — przed jakimkolwiek pomiarem (`Z20`):**

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex2b-szesciu-pisarzy
docker run -d --name cx-codex2b-pg -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_codex2b \
  -p 127.0.0.1:6454:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`
until docker exec cx-codex2b-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6454/cx_codex2b \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
#   DRUGI przebieg tą samą komendą musi byc bezbledny i bez zmian (idempotencja).
```

**(A2) KOPIA DANYCH ZASTANYCH — z lokalnego szablonu, bez sieci** (do mianowników 7–8;
`consultify-pg18` to **lokalna** kopia stagingu z 10.09, więc `Z28` nie jest naruszone;
nazwa bazy **parametrem**, `Z41`):

```bash
ART=/Users/piotrwisniewski/Developer/codex-wt/codex2b-artefakty; BAZA_MOJA=codex2b_kopia_1009
docker exec consultify-pg18 pg_dump -U postgres -Fc consultify_staging_1009 > "$ART/zrodlo.dump"
shasum -a 256 "$ART/zrodlo.dump"
docker exec cx-codex2b-pg psql -U postgres -c "CREATE DATABASE $BAZA_MOJA;"
docker exec -i cx-codex2b-pg pg_restore --no-owner --no-privileges -U postgres -d "$BAZA_MOJA" < "$ART/zrodlo.dump" 2>&1 | tail -5
```

**Do `consultify_staging_1009` piszesz ZERO razy** — wyłącznie `pg_dump` i `SELECT` (`Z9`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy:**

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex2b-szesciu-pisarzy && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6454/cx_codex2b \
JWT_SECRET=codex2b-szesciu-pisarzy-lokalny-sekret-testowy \
npx vitest run <ŚCIEŻKI> --config server/vitest.config.ts --retry=0 \
  --reporter=json --outputFile=/Users/piotrwisniewski/Developer/codex-wt/codex2b-artefakty/<NAZWA>.json
```

**Dla testów serwerowych `--config server/vitest.config.ts` jest obowiązkowy.** Uruchomienie
z roota bez właściwego configu daje `No test files found` — **to NIE jest `PASS`, to brak
pomiaru**; root-config ma do tego timeout 120 s, więc pakiet realdb potrafi paść na czasie,
a to też nie jest wynik merytoryczny. **Pakiety czysto jednostkowe** (mockują `dbGet`):
`RUN_DB_TESTS=0 MOCK_DB=true …`. **Nigdy nie mieszasz — pakiet jednostkowy NIE jest
dowodem egzekucji.**

| Zmienna | Co się stanie, gdy jej zabraknie |
| --- | --- |
| `RUN_DB_TESTS=1` | `tests/setup.ts` pomija testy bazodanowe; pakiet raportuje `exit 0` |
| `MOCK_DB=false` | odczyty idą **cicho** na atrapę. **`Database.ts:686` zwraca `changes:1` dla KAŻDEGO `UPDATE` niezależnie od `WHERE`** — test „zapis się udał" przeszedłby zawsze |
| `DB_TYPE=postgres` / `NODE_ENV=test` | `vitest.config.ts` przybija `sqlite` (mierzysz inny silnik, niż myślisz); runner migracji odmawia albo zwraca MOCK przy bazie lokalnej |
| `ENABLE_V8_GLOBAL=true` / `ENABLE_TEST_AUTH_BYPASS=false` | część tras daje **fałszywe `404` PRZED uwierzytelnieniem**; **`verifyToken` JEST OMIJANY** |
| `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` | strażnik Wyników przepuszcza wszystko przy `NODE_ENV=test` |
| `DATABASE_URL` / `JWT_SECRET` | fallback na `localhost:5432`, który **nasłuchuje i nie jest Twój**; podpisany JWT nie przejdzie `verifyToken` i dostaniesz `401` z niewłaściwego powodu |
| `--retry=0` | test „zapis zastany odrzucony" **leczy się skutkiem własnego ataku** |

---

## 0.2d. ★★ ZNANE PUŁAPKI — CZYTAJ, ZANIM UZNASZ COKOLWIEK ZA ZEPSUTE

1. **Vault jest BARE + `worktreeConfig`** — bez pliku `config.worktree` z kroku (4) `git` odmawia pracy w worktree. **Remote `icloud-source` jest martwy** — nie wołaj `fetch --all`, jego błąd nie jest STOP-em.
2. **Host NIE MA binarki `psql`.** Każde zapytanie: `docker exec cx-codex2b-pg psql -U postgres -d <baza> -c '…'`. **`docker rm -f` bez `-v` nie kasuje wolumenu** — sprzątasz `docker rm -fv`.
3. **`JSON.parse` na kolumnie `json` działa na SQLite i wywala `500` na PostgreSQL** — sterownik `pg` zwraca już obiekt. Dotyczy wprost `ie_aggregate_state.payload_json`.
4. **CI NIE URUCHAMIA TESTÓW dla naszych gałęzi** — „CI zielone" nie jest dowodem. **Reporter `basic` NIE ISTNIEJE** w tej wersji vitest, a **`npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów** — liczby i nazwy czytasz z JSON-a, nie z kodu wyjścia.
5. **Nowe pliki w `tests/` wymagają `git add -f`.** Sprawdzasz `git status --short` po każdym commicie.
6. **`| head` na grepie produkuje FAŁSZYWE SIEROTY** — werdykt „nikt tego nie woła" wymaga grepu **bez obcięcia**. **`grep -rn … --include='*.ts'` w `zsh` zwraca PUSTKĘ zamiast wyników; pustka nie jest wynikiem** — filtruj potokiem (`| grep -v __tests__`), nie `--include`.
7. **`prettier` na wielkich plikach przepisuje cały plik.** `initiatives.routes.ts` ma ponad 4 000 linii — reformat większy niż ~3× Twoje linie merytoryczne **cofasz** (`cp`, nie `stash`).
8. **`information_schema` w tej bazie zwraca kolumny Z DWÓCH SCHEMATÓW** (`public` i `fala5_backup`, oba z tabelą `initiatives`) — każde zapytanie ma mieć jawny `table_schema='public'`.
9. **Identyfikator inicjatywy ma DWA KSZTAŁTY** — kanon nadaje `initiative-<uuid>`, tabela zastana trzyma dowolny `TEXT`. Nie zakładaj wspólnego formatu.
10. **★ `409` z tras zastanych WYCHODZI Z MIDDLEWARE, PRZED handlerem.** `requireCanonicalInitiativeExecutionWriter` zamontowany w `routes/pmo/initiatives.routes.ts:193`, lista wzorców w `executionSpineLegacyReadOnly.middleware.ts:82`. Twój test „POST do trasy zastanej daje 409" **przejdzie także wtedy, gdy handler w ogóle nie istnieje**. Dowód **musi** rozróżniać `409` z middleware (`code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED'` **oraz** `canonicalWriter`) od `409` z Twojej logiki.
11. **★ Nie ma taniego, `Z30`-bezpiecznego hosta dla przeglądarki** — `playwright.config.ts` domyślnie nie startuje backendu, a minimalny nasłuch `ApiGateway.initializeRoutes` nie montuje `/api/csrf-token`. **Warstwy przeglądarki w tym bloku NIE robisz**; HTTP + SQL wystarczą i są wymagane.

> ### ★★ RAMKA DO `Z33` (`§0.2e`) — PUŁAPKI, KTÓRE FAŁSZUJĄ ZIELONY PRZEBIEG
> **Zielona suita NIE JEST DOWODEM, dopóki nie wiesz, którą pułapkę omija.**
> `Z44` czyni tę ramkę obowiązkową **w pliku testu**, nie tylko w raporcie.
> **(a)** `ENABLE_V8_GLOBAL` nieustawione → fałszywe `404` **przed** uwierzytelnieniem
> (`v8FeatureGate.middleware.ts`, `=== 'true'`). Odbiór C2 zmierzył, że po `=true`
> część powierzchni **dalej** daje `404` z treścią `INITIATIVE_NOT_FOUND` — to bramka
> **domenowa**, nie platformowa. **Rozróżnienie po treści odpowiedzi jest obowiązkowe.**
> **(b)** `resultsInternalBetaVisibility.middleware.ts` przepuszcza wszystko przy
> `NODE_ENV=test`, dopóki nie ustawisz `…_TEST_MODE=enforce` — zmierzono na nim
> **416 fałszywych twierdzeń**. **(c)** `vitest.config.ts` przybija `DB_TYPE='sqlite'`;
> nadpisanie w linii to jedyne wyjście (`Z18`) i **udowadniasz je asercją**.
> **(d)** `auth.middleware.ts` ma gałąź `if (NODE_ENV === 'test' && ENABLE_TEST_AUTH_BYPASS === 'true')`
> — **`verifyToken` potrafi wyłączyć się sam**. **(e)** middleware odpowiada `409`
> **przed** handlerem (pkt 10). **(f) ★ WŁAŚCIWA TEMU BLOKOWI:**
> `ENABLE_INITIATIVE_UNIFIED_READ` zmienia wynik **każdego** pomiaru odczytu,
> a `ENABLE_INITIATIVE_UNIFIED_WRITE` — zapisu; obie domyślnie `OFF`. **Każdy pakiet
> mierzący widoczność rekordu biegnie w OBU ustawieniach**, raport podaje oba wyniki.
> **Obowiązek dowodowy:** dla **każdego** pakietu raport ma akapit *która z pułapek
> (a)–(f) dotyczy, jak ją wyłączyłem, co dowodzi, że wyłączyłem*. „Nie dotyczy" wolno
> napisać **tylko** z komendą pokazującą, że dany strażnik nie leży na ścieżce.


## 0.4a. Pomiar zasięgu testów (warunek oddania raportu, `Z24`)

1. **PRZED** zmianami: pakiety z licencji z `--reporter=json` → `codex2b-artefakty/przed-nazwy.txt`,
   po jednej **PEŁNEJ nazwie** testu na wiersz. 2. **PO** zmianach → `po-nazwy.txt`.
3. Do raportu wchodzi `diff przed-nazwy.txt po-nazwy.txt`: nazwy **DODANE** (Twoje)
i **ZNIKNIĘTE** (każda zniknięta = wyjaśnienie albo STOP). 4. **`N passed` bez nazw NIE
jest pomiarem** — ta sama liczba przy innym składzie nazw to fałszywa zieleń (`Z37`);
przepisanie liczby z tej instrukcji, cudzego raportu albo rejestru = zawyżenie
i podstawa odrzucenia raportu.


## 0.5. Reguła STOP

**Przy wątpliwości MERYTORYCZNEJ: STOP tego KROKU i wpis w raporcie — nigdy improwizacja.
Zasadny STOP jest NAGRADZANY, zgadywanie karane.** **STOP MERYTORYCZNY** (mile widziany):
zmierzyłeś i wyszło inaczej; brakuje informacji, której nikt poza właścicielem nie
dostarczy; naprawa wymaga decyzji produktowej → **wpisujesz do raportu i IDZIESZ DALEJ**.
**STOP PROCEDURALNY** (zakazany): „instrukcja sprzeczna", „ścieżka nie istnieje", „nie
mam licencji".

| Powód, dla którego chciałbyś stanąć | Co robisz ZAMIAST STOP-u |
| --- | --- |
| „Musiałbym zmienić plik przekrojowy / bramkę platformową" | **Czerwony kontrakt testowy + brief w raporcie.** Krok jest **ZROBIONY**, nie STOP |
| „Plik, którego potrzebuję, nie jest w tabeli licencji" | Traktujesz go jako **tylko do odczytu**, dajesz czerwony kontrakt + brief. Krok **ZROBIONY** |
| „Instrukcja jest wewnętrznie sprzeczna" / „numer linii się nie zgadza" | Sekcja „JEŚLI COŚ JEST SPRZECZNE" na końcu: interpretacja **bezpieczniejsza**, **swój wynik** do „Korekt", **kontynuujesz**. **Rozbieżność pomiaru nie jest sprzecznością — jest WYNIKIEM** |
| „`git fetch` zwrócił błąd `icloud-source`" / „nie ma `psql`" | To nie są błędy — `§0.2d` pkt 1 i 2 |
| „Hook `commit-msg` blokuje commit" / „muszę odłożyć stan roboczy" | **Naprawiasz komunikatem, nie omijasz** (`§0.6`); stan odkładasz przez `cp` do `codex2b-scratch`. `--no-verify` i `git stash` to zakazy, nie STOP-y |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie kroku |
| „Nie zdążę zrobić wszystkich sześciu pisarzy" | Robisz **minimum obowiązkowe** z `E2.3` i **uczciwie opisujesz resztę jako niezrobioną, z projektem komendy**. Odwrotna kolejność (sześć projektów, zero działającego kodu) = odrzucenie |
| „Port `6454` albo `5594` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO bloku wyłącznie przy:** (1) `MARKER BRAK`; (2) faktycznym
połączeniu do bazy zdalnej/demo/stagingu/produkcji (`Z28`); (3) ryzyku utraty
danych albo realnej wysyłki e-maila (`Z30`); (4) mniej niż 5 GB wolnego dysku;
(5) zajętym porcie `6454` albo `5594`.

```
### STOP — <krok>
Rodzaj: MERYTORYCZNY / PROCEDURALNY
Powód: <jedno zdanie>
Licencja, którą sprawdziłem: <cytat wiersza z tabeli licencji + wynik>
Dowód: <plik:linia albo komenda + wynik>
Co dostarczyłem ZAMIAST zmiany: <czerwony kontrakt / pomiar / gotowy diff / brief>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Rekomendacja dla nadzorcy: <co zmienić, gdzie, jaki promień rażenia>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
Czy kontynuowałem pozostałe kroki: TAK / NIE + dlaczego
```

**STOP bez wypełnionego pola „Licencja" albo „Co dostarczyłem ZAMIAST zmiany"
jest NIEZASADNY z definicji.**

---

## 0.6. ★★ ZAMROŻENIE I ZNACZNIKI ODMROŻENIA — PRZED PIERWSZYM COMMITEM

Właściciel odbierał MVP moduł po module i po jego „tak" moduł został **zamrożony**
(rejestr `docs/program/MVP_FINAL_ZAMROZONE.json` — **nie edytujesz go ręcznie**, `Z13`).
`.husky/pre-commit` **tylko ostrzega**; `.husky/commit-msg` **blokuje** — woła
`scripts/mvp-final/check-freeze.sh` i przy braku znacznika kończy `exit 1`. Wzorzec
dosłowny: `\[ODMROZENIE[[:space:]]+<MODUL>[[:space:]]+DEC-[0-9]+\]`.

**Zmierzone 11.09 na tipie — zweryfikuj sam:** komplet plików serwerowych tego bloku
(`server/src/middleware/…`, `routes/pmo/…`, `domain/initiatives-execution/…`) **nie jest
zamrożony** i hook przepuszcza go bez znacznika (`exit 0`). **Zamrożony jest front:**
`src/components/Initiatives/**` → `05_INITIATIVES`, `src/components/Execution/**` →
`06_EXECUTION`, `src/services/initiativeWriteTruth.ts` i
`src/services/initiatives-execution/**` → `WSPOLNE`; `public/locales/**` —
**niezamrożone**. **Mimo to każdy Twój commit niesie trzy znaczniki** (`CLAUDE.md`;
nadmiarowy nic nie psuje, brakujący blokuje):

```
[ODMROZENIE 05_INITIATIVES DEC-453] [ODMROZENIE 06_EXECUTION DEC-453] [ODMROZENIE WSPOLNE DEC-453]
```

Sprawdzenie własne **przed każdym commitem** (lista zamrożeń mogła się zmienić):
`bash scripts/mvp-final/check-freeze.sh --pliki $(git diff --cached --name-only) --komunikat="proba"`.
**Skrypt wymieni moduł spoza tych trzech → dopisujesz czwarty znacznik i wpisujesz
to do „Korekt".** `--no-verify` jest **ZAKAZEM**, nie obejściem.


## ★ PO CO TEN BLOK ISTNIEJE

07.09 właściciel **cofnął odbiór dwóch modułów** (`DEC-453`). Powód, dosłownie
z komentarza w `executionSpineLegacyReadOnly.middleware.ts:52-81`: przez 19 dni lista
wycofanych ścieżek wymieniała zasoby, **dla których kanoniczny pisarz nie istniał albo
pisał do innego modelu odczytu niż ten, który czyta ekran**. Skutek zmierzony na żywo:
**„Dodaj element" w RAID, kamieniach milowych, zasobach, planach obsady, pozycjach
budżetu, rolach bram i przeniesieniu inicjatywy odpowiadało `409` i NIC SIĘ NIE
DZIAŁO.** Gaszenie pożaru polegało na **przywróceniu** sześciu ścieżek — dziś działają,
ale piszą **wyłącznie do magazynu zastanego**, więc każde „Dodaj kamień milowy"
powiększa rozjazd dwóch magazynów, który cały program zamyka.

**Reguła ważniejsza niż sam cel, wpisana krwią 07.09:**

> **Ścieżkę wolno wycofać WYŁĄCZNIE wtedy, gdy istnieje kanoniczna komenda
> runtime-v1 pisząca do TEGO SAMEGO modelu odczytu, który czyta ekran — albo
> gdy nikt tej ścieżki nie woła.**

Ten blok **buduje brakujących następców**, a nie wycofuje ścieżki „bo wypada".
**Poprzedni blok nie wykonał tego etapu w ogóle** — `CODEX2_JEDEN_MAGAZYN_2/98_RAPORT.md`
§K5: *„sześć ścieżek legacy: 0/6 wycofanych; 6/6 ma wołaczy"*.


## ★ STAN ZMIERZONY — 2026-09-11, na tipie linii integracyjnej

**To rozkaz pomiarowy, nie prawda objawiona. Obalenie którejkolwiek tezy poniżej jest SUKCESEM tego bloku.**

### (a) Sześciu pisarzy — trasy, wołacze, model odczytu, kandydat

| # | Pisarz | Trasy zapisu (`routes/pmo/initiatives.routes.ts`) | Wołacze `src/` | Tabela, którą czyta EKRAN | Kandydat kanoniczny (`initiativesExecutionRuntime.routes.ts`) |
| --- | --- | --- | --- | --- | --- |
| 1 | **budget-items** | POST `:3624` · PUT `:3634` · DELETE `:3644` | **5** | `initiative_budget_items` (`InitiativeController.ts:4697`) | `POST /initiatives/:id/budget-entries/:entryId` `:5664`, `…/void` `:5632` — **ten sam agregat `initiative`, najbardziej obiecujący** |
| 2 | **milestones** | POST `:3456` · PUT `:3466` · DELETE `:3476` | **6** | `initiative_milestones` (`:3696`) | `POST /execution-cases/:caseId/milestones/:milestoneId` `:4978`, lista `:5021` — agregat `execution_milestone`, **prawie na pewno INNY model odczytu** |
| 3 | **resources** | POST `:3521` · DELETE `:3531` · PUT `:3541` · POST `ai-apply-log` `:3551` | **6** | `initiative_resources` (`:4326`) | `POST /resource-commitments/:commitmentId` `:4484` — agregat `resource_commitment` |
| 4 | **gate-roles** | PUT `:3808` | **4** | `initiative_gate_roles` (`:5904`) | `POST /initiatives/:id/gate-signoffs` `:7405` — agregaty `gate_signoff`/`gate_quorum` |
| 5 | **staffing-plans** | POST `:3563` · PUT `:3570` · DELETE `:3576` · POST roles `:3583` · PUT roles `:3589` · DELETE roles `:3595` · POST `sync-capacity` `:3603` | **10** | `staffing_plans` + `staffing_plan_roles` (`services/staffingPlanService.ts`) | **brak oczywistego** — sprawdź `capacity-scenarios` `:4221`/`:4322` |
| 6 | **move** | POST `:3330` | **1** | `UPDATE initiatives SET project_id` (`InitiativeController.ts:2939`+59) | **brak** |

**Razem 19 tras zapisu i 32 wołaczy. Pytanie 1 procedury `E2` brzmi TAK dla każdej
z sześciu** — żadnej nie wolno wycofać jako martwej.

### (b) ★★★ NAJWAŻNIEJSZE ZNALEZISKO — wzorzec, który już zadziałał

`raid` wycofano zgodnie z prawem, bo komenda kanoniczna **pisze do tej samej tabeli
`raid_items`, którą czyta `GET .../raid`**. Łańcuch, dosłownie:

```
routes/pmo/initiativesExecutionRuntime.routes.ts:5756   POST .../raid-items/:raidItemId
  -> domain/initiatives-execution/raidItem.ts:25        createRaidItem
    -> materialCommand.ts executeMaterialCommand        koperta + CAS + receipt + outbox + audit
      -> postgresMaterialCommandUnitOfWork.ts:51        createRaidItem
        -> INSERT INTO raid_items                :83    <-- TABELA MODELU ODCZYTU
dowod: server/src/routes/pmo/__tests__/zapisyInicjatyw.raidCanonical.pg.test.ts
```

**Zmierzone: `postgresMaterialCommandUnitOfWork.ts` ma DOKŁADNIE TRZY metody piszące do
tabeli modelu odczytu (`:51`, `:108`, `:167`) i wszystkie dotyczą `raid_items`. Dla
pozostałych PIĘCIU rodzin: ZERO.** To jest luka, którą ten blok zamyka — **cały projekt
następcy jest skopiowaniem tego kształtu**, nie wymyślaniem architektury.

### (c) Flagi i stan linii

| Co | Wynik |
| --- | --- |
| `ENABLE_INITIATIVE_UNIFIED_WRITE` / `…_READ` | `InitiativeController.ts:143` / `initiativeUnifiedReader.ts:238`, oba `=== 'true'` → **domyślnie OFF** |
| Wzorzec gałęzi flagowej (E1 Codexa 2) | `InitiativeController.ts:885-965`, gałąź kanoniczna wewnątrz `if (!existing)` |
| Bramki istnienia inicjatywy (`K1`, definicja z `FIX-6`) | **50 kandydatów, 15 nadal zastanych** (35 przełączonych paczkami `E3`) |
| Lista wycofanych ścieżek | `executionSpineLegacyReadOnly.middleware.ts:82-87` — **cztery wzorce; sześciu pisarzy na niej NIE MA** |

---

## ★ ZAKRES I POZA ZAKRESEM

**W zakresie:** (1) zmierzenie sześciu pisarzy — cztery pytania procedury `E2` z dowodem
dla **każdej** ścieżki; (2) kanoniczny następca przez `executeMaterialCommand`,
**deterministyczny `clientRequestId`**, idempotencja przez `findReceipt`, zapis **do tej
samej tabeli, którą czyta ekran**; (3) przełączenie trasy zastanej **za flagą
`ENABLE_INITIATIVE_UNIFIED_WRITE`**, przy `OFF` **bit w bit jak dziś**; (4) test realdb
przez realny `ApiGateway` per pisarz (OFF, ON, tenant); (5) dowód mutacyjny per pisarz
(`Z32`); (6) K-punkty i zasięg testów; (7) raport w układzie 14 sekcji.

**POZA ZAKRESEM — imiennie:**

- **`E4` — projekcja serwerowa Ocen** → osobny blok **Codex 2c**. Nie dotykasz
  `server/src/services/assessment/**`, `AssessmentController.ts`,
  `routes/v8/assessment.routes.ts`, `src/components/assessment/**`.
- **`E8` — test „nowy rekord z UI widać wszędzie" 7/7** → robiony **wewnętrznie**;
  nie zmieniasz `nowyRekordSiedemPowierzchni.pg.test.ts`. **`E7` (seed demo) —
  ZROBIONE** (`75e2652de5`), nie ruszasz `demoSeedService.ts`.
- **`E3` — bramki istnienia inicjatyw** → paczki 1–2 scalone, paczka 3 **w toku
  u robotnika wewnętrznego**. **Nie dotykasz żadnej bramki istnienia**, nawet gdy
  Twój pisarz przez nią przechodzi — trafisz na taką, robisz wpis do raportu.
- **`src/**` w całości.** Blok jest serwerowy; przy `OFF` front działa jak dziś, więc
  **nie ma powodu go dotykać**. Uznasz, że musisz → **STOP MERYTORYCZNY z gotowym,
  nienałożonym diffem**. To obejmuje **zero zmian wyglądu**: układu, kolorów, odstępów,
  ikon, tekstów na ekranie, `src/components/standard/**`, tokenów `c-*`.
- **Bramki platformowe** (`Z12`) i **Finanse** (`financial_*`, `finance_*`,
  `server/src/services/finance/**` — pracuje tam inne stanowisko). **Zero nowych
  ekranów** (`Z11`), **zero kasowania tabel zastanych** (`Z40`), **zero zmian
  istniejących plików w `server/migrations/**`**.

---

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: KLIENT · TRASA · KONTROLER · SERWIS · REPOZYTORIUM

> **Ta tabela JEST licencją.** Plik opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz
> pozwolenie, a STOP z tytułu »nie wolno mi« jest NIEZASADNY**. Pliku nie ma
> w tabeli → **TYLKO DO ODCZYTU**, a Twoim produktem jest czerwony kontrakt + brief,
> **nie zatrzymanie bloku**.

| Warstwa | Plik / wzorzec | Licencja |
| --- | --- | --- |
| **klient** | `src/**` (komponenty, `services`, `contracts`) | **TYLKO ODCZYT** — blok nie dotyka frontu. Potrzeba zmiany = STOP MERYTORYCZNY z gotowym, nienałożonym diffem |
| **trasa zastana** | `server/src/routes/pmo/initiatives.routes.ts` | **★ WĄSKA:** wyłącznie **delegacja za flagą** w handlerach sześciu pisarzy. Zakaz zmiany ścieżek, kolejności middleware i kształtu odpowiedzi przy `OFF` |
| **trasa kanoniczna** | `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` | **★ WĄSKA:** wyłącznie **DODANIE** komend wymaganych przez `E2`. **Zakaz zmiany istniejących komend, ich odpowiedzi i kodów błędów** |
| **middleware** | `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` | **★ WĄSKA:** wyłącznie lista `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS` (`:82`) i komentarz przy niej. **Zakaz zmiany kodu odpowiedzi, kodu błędu i sygnatur.** Dopisanie wzorca **bez kompletu z `E2.6` zakazane** |
| **kontroler·serwis** | `server/src/controllers/InitiativeController.ts`; `StaffingPlanController.ts` i `services/staffingPlanService.ts` (w zakresie `staffing-plans`) | **★ WĄSKA:** wyłącznie handlery sześciu pisarzy i gałąź delegacji. **Zakaz dotykania bramek istnienia** (`E3` u kogo innego) i handlerów `GET` |
| **domena (NOWE)** | `server/src/domain/initiatives-execution/<pisarz>.ts` | **★ PEŁNA** — tu mieszka rdzeń, po jednym pliku na pisarza |
| **domena (wzorzec)** | `raidItem.ts`, `materialCommand.ts`, `initiativeUnifiedReader.ts` | **TYLKO ODCZYT — WZORZEC.** Kopiujesz kształt, nie zmieniasz ani litery |
| **repozytorium** | `postgresMaterialCommandUnitOfWork.ts` | **★ WĄSKA:** wyłącznie **DODANIE** metod piszących do tabel modelu odczytu, wzorowanych na `createRaidItem :51`. **Zakaz zmiany istniejących metod, `findReceipt :419`, obsługi `ie_aggregate_state`/`ie_outbox_events`** |
| **bramki platformowe** | `auth.middleware.ts`, `Gateway.ts`, `v8FeatureGate`, `betaGate`, `pmoValidation`, `effectiveAccessService`, `assessmentPermissionService` | **TYLKO ODCZYT — BEZWZGLĘDNIE** (`Z12`). Produkt: **czerwony kontrakt** `it('KONTRAKT CODEX2B — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego bloku` + brief (plik:linia · dlaczego nie da się w module · promień rażenia · jak wyglądałby dowód mutacyjny). **Krok z takim produktem jest ZROBIONY** |
| **migracje** | `server/migrations/20262160_*.sql` … `20262169_*.sql` (**NOWE**) | **★ PEŁNA** w tym przedziale, **wyłącznie addytywne** (`Z40`). Istniejące pliki migracji: **TYLKO ODCZYT — BEZWZGLĘDNIE** |
| **i18n** | `public/locales/{pl,en}/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie, wartość realnie przetłumaczona (`Z46`) |
| **testy (NOWE)** | `server/src/**/__tests__/**`, `tests/**` | **★ PEŁNA**, z zastrzeżeniem `Z18`, `Z31`, `Z43`, `Z44`. **Nowe pliki w `tests/` wymagają `git add -f`** |
| **testy (infra)** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `playwright*.config.ts`, `assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY.** Produkt: opis w raporcie, co blokuje pomiar i jak obszedłeś to zmiennymi w linii komendy |
| **testy cudze** | `nowyRekordSiedemPowierzchni.pg.test.ts`, `initiativeCanonicalPut*.pg.test.ts`, `zapisyInicjatyw.raidCanonical.pg.test.ts` | **TYLKO ODCZYT — WZORZEC I CUDZA ROBOTA** |
| **dokumenty** | `docs/…/CODEX2B_SZESCIU_PISARZY/98_RAPORT.md` | **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) |
| **dokumenty** | `docs/…/CODEX1_INICJATYWY/**`, `docs/…/CODEX2_JEDEN_MAGAZYN_2/**`, `MVP_FINAL_ZAMROZONE.json`, `OWNER_DECISION_LEDGER…md` | **TYLKO ODCZYT — TWÓJ DŁUG WEJŚCIOWY.** Przed `E2` czytasz `CODEX2_JEDEN_MAGAZYN_2/97_ODBIOR_W1_W2.md` §6 i §9 |
| **reszta** | `server/src/_backup/**` i warianty `PRESERVED_PRODUCT_WIP` — **NIETYKALNE** (`Z4`); **wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

**★ Zanim zmienisz sygnaturę czegokolwiek wspólnego:**
`grep -rln "MaterialCommandUnitOfWork" server/src | grep -v __tests__` — dodanie
metody do interfejsu łamie **każdą inną implementację**; policz je **zanim**
zaczniesz. Każdy konsument albo wchodzi do licencji, albo zmianę trzeba
zaprojektować inaczej.

---

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora (tip, 11.09) | Komenda |
| --- | --- | --- | --- |
| 1 | trasy **zapisu** sześciu pisarzy | **19** | `§0.1a` (1) |
| 2 | wołacze w `src/` — razem / per pisarz / pisarze z wołaczem (pytanie 1 = TAK) | **32** / 6·6·10·5·4·1 / **6 z 6** | `§0.1a` (2) |
| 3 | **metody UoW piszące do tabeli modelu odczytu** / rodziny pisarzy z takim zapisem | **3** (wszystkie `raid_items`) / **1 z 7** | `§0.1a` (4) |
| 4 | wzorce na liście wycofanych ścieżek / flagi używane przez blok | **4** / **2**, obie domyślnie OFF | `§0.1a` (7) i (6) |
| 5 | bramki istnienia inicjatywy: kandydaci / nadal zastane | **50 / 15** | `git grep -nE "SELECT (id\|1 AS found) FROM initiatives WHERE id" <SHA> -- server/src` + okno ±20 linii na `initiativeExists(`/`readInitiativeHeader(`/`isInitiativeUnifiedReadEnabled(` — **definicja `FIX-6`, nie literał SQL** |
| 6 | wolne numery migracji w MOIM przedziale / najwyższy zajęty | **10 (0 zajętych)** / **20262108** | `§0.1a` (8) |
| 7 | wiersze w sześciu tabelach modelu odczytu | **do zmierzenia przez Ciebie** | `docker exec cx-codex2b-pg psql -U postgres -d codex2b_kopia_1009 -Atc "SELECT count(*) FROM <tabela>"` |
| 8 | agregaty kanoniczne per typ | **do zmierzenia** | `… -Atc "SELECT aggregate_type, count(*) FROM ie_aggregate_state GROUP BY 1 ORDER BY 2 DESC"` |

**Reguła kontrolna: komenda, której sam nie uruchomiłeś, nie wchodzi do raportu.
Rozbieżność z moją liczbą NIE JEST sprzecznością — jest WYNIKIEM.**

---

## ★★ ROZŁĄCZNOŚĆ I ZASOBY WYŁĄCZNE

**Pliki zapisywane NA PEWNO:** nowe `domain/initiatives-execution/<pisarz>.ts`
(ryzyko ZEROWE) · `postgresMaterialCommandUnitOfWork.ts` (ŚREDNIE — dodajesz metody,
nie zmieniasz istniejących) · `initiativesExecutionRuntime.routes.ts` (ŚREDNIE) ·
`routes/pmo/initiatives.routes.ts` (**WYSOKIE** — ponad 4 000 linii, kilka torów;
commituj małymi krokami) · `InitiativeController.ts` (**WYSOKIE** — `E3` paczka 3
biegnie tu równolegle; **trzymaj się handlerów sześciu pisarzy, nie dotykaj bramek
istnienia**) · nowe pliki testowe · raport `98_RAPORT.md`.

**Pliki zapisywane WARUNKOWO:** `executionSpineLegacyReadOnly.middleware.ts` — **dopiero
po** komplecie z `E2.6` dla danej ścieżki; `StaffingPlanController.ts` i
`staffingPlanService.ts` — tylko jeżeli `staffing-plans` dostanie następcę;
`server/migrations/2026216*.sql` — tylko jeżeli udowodnisz, że nie da się w serwisie;
`public/locales/{pl,en}` — tylko NOWE klucze odmowy, parytet w tym samym commicie.

**Pliki, których ten blok JAWNIE NIE ZAPISZE — imiennie:**

```
src/**   (caly front)                     server/src/Gateway.ts
server/src/middleware/{auth,v8FeatureGate,betaGate,pmoValidation}.middleware.ts
server/src/services/{effectiveAccessService,assessmentPermissionService}.ts
server/src/services/assessment/**         server/src/services/demo/demoSeedService.ts
server/src/services/finance/**            server/src/**/financial*
server/src/domain/initiatives-execution/{initiativeUnifiedReader,raidItem,materialCommand}.ts
server/src/domain/initiatives-execution/__tests__/nowyRekordSiedemPowierzchni.pg.test.ts
server/src/_backup/**                     tests/{setup.ts,helpers/**,__mocks__/**}
vitest*.config.ts  server/vitest.config*.ts  playwright*.config.ts
docs/program/MVP_FINAL_ZAMROZONE.json
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
docs/program/PROGRAM_NAPRAWCZY_20260905/{CODEX1_INICJATYWY,CODEX2_JEDEN_MAGAZYN_2}/**
```

**Zasoby wyłączne:** port PostgreSQL **`6454`** · port harnessu **`5594`** · kontener
**`cx-codex2b-pg`** · bazy `cx_codex2b` i `codex2b_kopia_1009` (**parametrem**, `Z41`) ·
przedział migracji **`20262160`–`20262169`** · gałąź `codex/szesciu-pisarzy-legacy-20260911` ·
worktree `~/Developer/codex-wt/codex2b-szesciu-pisarzy` · katalogi `codex2b-artefakty`
i `codex2b-scratch` · flaga **`ENABLE_INITIATIVE_UNIFIED_WRITE` (istniejąca, default OFF,
domyślnej NIE zmieniasz)**. **Cudze, NIETYKALNE:** `cx-codex1-inicjatywy-pg` (`6451`),
`cx-codex2-pg` (`6452`), `cx-codex3-pg` (`6453`), `consultify-pg18` (`54418` —
**wyłącznie `pg_dump` i `SELECT`**).

**Kontrola przed KAŻDYM commitem:**

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex2b-szesciu-pisarzy
ART=/Users/piotrwisniewski/Developer/codex-wt/codex2b-artefakty
git diff --name-only --cached | tee "$ART/staged.txt"
grep -iE '^src/|auth\.middleware|Gateway\.ts|pmoValidation|betaGate|v8FeatureGate|effectiveAccess|assessment|demoSeedService|initiativeUnifiedReader|raidItem\.ts|materialCommand\.ts|nowyRekordSiedemPowierzchni|finance|_backup/|vitest.*config|playwright.*config|tests/setup|MVP_FINAL_ZAMROZONE|OWNER_DECISION_LEDGER|CODEX1_INICJATYWY/|CODEX2_JEDEN_MAGAZYN_2/' \
  "$ART/staged.txt" && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" || echo "rozlacznosc OK"
bash scripts/mvp-final/check-freeze.sh --pliki $(git diff --cached --name-only) --komunikat="proba"
```

---

# E2 — SZEŚCIU PISARZY LEGACY → KANON (jedyny etap rdzeniowy)

**Jeden krok = jeden commit = jeden werdykt.** Każdy commit niesie trzy znaczniki
odmrożenia (`§0.6`).

## E2.0 — KROK ZEROWY: ZMIERZ PREMISĘ (przed jedną linią kodu)

1. Uruchom **wszystkie osiem komend `§0.1a`** i wklej wyniki do raportu obok moich.
2. **Zweryfikuj każdy numer linii z tabeli „(a) Sześciu pisarzy".** Plik odjechał → podaj
   **nowy** numer i wpisz do „Korekt". (Przykład, który już wystąpił: montaż middleware
   to `:193`, a stara instrukcja mówiła `:161`.)
3. Zmierz wiersze w sześciu tabelach modelu odczytu i w `ie_aggregate_state` na kopii
   `codex2b_kopia_1009` (mianowniki 7–8).

**Commit:** `pomiar(e2.0): stan wejsciowy szesciu pisarzy` + trzy znaczniki.

## E2.1 — CZTERY PYTANIA, SZEŚĆ ŚCIEŻEK, KAŻDA ODPOWIEDŹ Z DOWODEM

| # | Pytanie | Dowód |
| --- | --- | --- |
| 1 | Czy ktoś ją woła z `src/`? | `grep -rn "initiatives/.*/<ścieżka>" src \| grep -v __tests__` — **bez `\| head`** |
| 2 | Czy istnieje komenda kanoniczna robiąca to samo? | `plik:linia` w `initiativesExecutionRuntime.routes.ts` |
| 3 | Czy ta komenda pisze do **tego samego** modelu odczytu, który czyta ekran? | **test na realnym Postgresie**: zapis komendą → odczyt **trasą, którą woła ekran** → **rekord widoczny, z identyfikatorem i treścią** (`Z23`). Plus **dwa zapytania SQL**: tabela ekranu i `ie_aggregate_state` |
| 4 | Czy odmowa/komunikat dociera do człowieka po polsku i po angielsku? | żądanie HTTP + wpis w `public/locales/{pl,en}` (`Z46`) |

**Rozstrzygnięcie:**
**1 = NIE** → ścieżka martwa, wolno wycofać; wpis do raportu. *(Na moim pomiarze taka
nie występuje — u Ciebie inny wynik jest WYNIKIEM, nie sprzecznością.)*
**1 = TAK, 2 = NIE** → **NIE WYCOFUJESZ.** Budujesz następcę (`WARIANT P`) albo — gdy
budżet nie pozwala — wpisujesz „brakujący następca" z **projektem kształtu komendy**
i **czerwonym kontraktem** (`WARIANT N`).
**1 = TAK, 2 = TAK, 3 = NIE** → **NIE WYCOFUJESZ.** To dokładnie pułapka z 07.09.
Wpisujesz, **czym różni się model odczytu**, z dwoma zapytaniami SQL, i budujesz zapis
do tabeli ekranu wg `WARIANT P`. **1 = TAK, 2 = TAK, 3 = TAK** → następca działa:
**wolno dopisać wzorzec** do listy wycofanych, ale wyłącznie z kompletem z `E2.6`.

**Produkt `E2.1`: tabela w raporcie — sześć ścieżek × cztery odpowiedzi × werdykt,
każda odpowiedź z komendą i wynikiem.**

## E2.2 — KANONICZNY NASTĘPCA: WARIANT P (domyślny, wiążący)

**Kształt do skopiowania, nie do wymyślenia** — dosłownie łańcuch `raid`
ze „STANU ZMIERZONEGO (b)":

```
1. domain/initiatives-execution/<pisarz>.ts  (NOWY): typy ładunku create/update/delete;
   funkcja przez `executeMaterialCommand(uow, envelope, async (tx) => …)`; walidacja celu
   (`commandType` + `aggregateType`, inaczej `MaterialCommandValidationError`); zwraca
   `{ mutation, response, eventType, eventPayload, auditPayload }`.
2. postgresMaterialCommandUnitOfWork.ts — NOWA metoda `create<X>/update<X>/delete<X>`
   piszaca do **TEJ SAMEJ TABELI, KTORA CZYTA EKRAN** (wzorzec `createRaidItem :51`,
   `INSERT INTO raid_items :83`). To jest caly sens tego bloku.
3. initiativesExecutionRuntime.routes.ts — NOWA komenda runtime-v1, autoryzacja jak
   w `:5756`: `resolveProjectIdsForAggregate` + `authorizeProjects`, brak uprawnienia
   -> `404 NOT_FOUND` (nie `403`), `safeParse` -> `400 VALIDATION_FAILED`,
   brak aktora -> `401 AUTH_REQUIRED`.
4. routes/pmo/initiatives.routes.ts (+ kontroler) — handler zastany:
   `if (ENABLE_INITIATIVE_UNIFIED_WRITE) { deleguj do komendy } else { dzisiejszy kod }`
   Wzorzec galezi flagowej: `InitiativeController.ts:885-965` (E1 Codexa 2).
```

**Trzy rzeczy, które muszą być zrobione INACZEJ niż w `E1` Codexa 2** — `FIX-3` i `FIX-4`
z odbioru, przeniesione tu jako wymóg wejściowy:

1. **`clientRequestId` DETERMINISTYCZNY z żądania**, nigdy `uuidv4()`: stabilny hash
   z `(aggregateId + organizationId + commandType + posortowany ładunek)` albo nagłówek
   `Idempotency-Key`/`X-Correlation-ID`, gdy klient go wysyła. **Zmierzone na `PUT`: dwa
   identyczne żądania dały `version 2 → 3` i cztery pokwitowania.** Podwójne kliknięcie
   „Dodaj element" nie ma prawa mnożyć wersji agregatu.
2. **Idempotencja przez `findReceipt`** (`materialCommand.ts:525`,
   `postgresMaterialCommandUnitOfWork.ts:419`) — drugie żądanie z tym samym
   `clientRequestId` zwraca **to samo pokwitowanie**. Dowód w teście: brak przyrostu
   `ie_command_receipts` i `ie_aggregate_state.version`.
3. **`expectedVersion`**: albo przyjmujesz je od klienta, albo **jawnie dokumentujesz
   w raporcie utratę ochrony przed nadpisaniem** („ostatni wygrywa") wraz z ryzykiem —
   ciche dociągnięcie `expectedVersion: canonical.version` wyłącza `409` przy kolizji
   redaktorów, **tak zrobiono w `E1` i odbiór zapisał to jako dług**.

**PARYTET `OFF` — warunek bezwzględny.** Przy fladze nieustawionej albo `!== 'true'`
zachowanie sześciu tras jest **bit w bit jak dziś**: ten sam kod odpowiedzi, ten sam
kształt koperty, ten sam zapis do tej samej tabeli, te same kody błędów. **Dowód:
pakiet przy `OFF` przed i po Twojej zmianie daje IDENTYCZNĄ listę nazw** (`§0.4a`).

## E2.2b — WARIANT N (gdy `P` jest niewykonalny dla danego pisarza)

Produkt: **projekt komendy w raporcie** (ścieżka · ładunek · kody błędów · agregat ·
tabela modelu odczytu · szacowany rozmiar w liniach i godzinach) **plus czerwony kontrakt
testowy** — plik, który **dziś PADA**, oznaczony `it('KONTRAKT CODEX2B — <pisarz> ma
kanonicznego nastepce')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego
bloku`. **Ścieżka zastana zostaje nietknięta.** Krok jest **ZROBIONY**, nie STOP.

## E2.3 — KOLEJNOŚĆ WIĄŻĄCA I MINIMUM OBOWIĄZKOWE

| Kolejność | Pisarz | Dlaczego tu |
| --- | --- | --- |
| 1 | **budget-items** | kandydat pisze do **tego samego agregatu `initiative`** — najkrótsza droga do dowodu |
| 2 | **milestones** | największy zbiór danych zastanych, wołacze w dwóch komponentach |
| 3 | **resources** | agregat `resource_commitment` istnieje, ładunek prosty |
| 4 | **gate-roles** | jedna trasa (`PUT`), ale ładunek zbiorczy (`{ roles: [...] }`) — sprawdź, czy komenda ma kształt „zastąp listę" |
| 5 | **staffing-plans** | siedem tras i dwie tabele — **najdroższy**; `WARIANT N` w pełni akceptowalny |
| 6 | **move** | brak kandydata; zmienia `initiatives.project_id`, czyli **dotyka tożsamości rekordu** — cokolwiek pachnie decyzją produktową → **STOP MERYTORYCZNY**, nie improwizacja |

**MINIMUM OBOWIĄZKOWE:** pisarze **1–3 w `WARIANCIE P`**, kompletnie (komenda +
delegacja + test realdb + dowód mutacyjny); pisarze **4–6 co najmniej w `WARIANCIE N`**
(cztery odpowiedzi + projekt + czerwony kontrakt). **Sześć projektów bez ani jednego
działającego następcy = odrzucenie; trzy działające + trzy uczciwe projekty = przyjęcie.**

## E2.4 — TEST REALDB PER PISARZ (obowiązkowy dla każdego `WARIANTU P`)

Jeden plik na pisarza:
`server/src/domain/initiatives-execution/__tests__/<pisarz>Canonical.pg.test.ts`. Każdy
ma **nagłówek `§0.2e` i twarde asercje env w `beforeAll`** (`Z44`), `retry: 0` (`Z29`),
`await assertRealPostgresTestEnvironment()` **bez argumentów** (`Z31`), `try/finally`
w `beforeAll` i **`afterAll` bezwarunkowo sprzątający po `organizationId`** (przerwany
setup nie ma prawa zostawić organizacji i użytkownika w bazie). Wzorzec:
`server/src/routes/pmo/__tests__/zapisyInicjatyw.raidCanonical.pg.test.ts`.

| # | Co dowodzi | Kryterium |
| --- | --- | --- |
| 1 | **OFF = jak dziś** | trasa zastana, flaga nieustawiona → ten sam kod odpowiedzi i ten sam wiersz w tabeli zastanej, co na markerze |
| 2 | **ON = zapis kanoniczny** | ta sama trasa, flaga `'true'` → `200`/`201` **oraz** SQL: wiersz w **tabeli ekranu** `AND` wiersz w `ie_aggregate_state` `AND` wpis w `ie_command_receipts` |
| 3 | **widoczność po treści** | `GET` **trasą, którą woła ekran** → odpowiedź zawiera **identyfikator i treść** (`Z23`; `200` z pustą kopertą **nie zalicza**). Przebieg w **obu** ustawieniach `ENABLE_INITIATIVE_UNIFIED_READ`, oba wyniki do raportu |
| 4 | **idempotencja** | drugi identyczny `POST` z tym samym deterministycznym `clientRequestId` → **brak przyrostu** `ie_command_receipts` i `version` |
| 5 | **izolacja tenanta** | to samo żądanie z JWT **innej organizacji** → `404` (nie `403`, nie `200` z cudzym wierszem), przy `ON` **i** `OFF` |

**Dowód osiągalności (`Z21`, `Z22`) jest warunkiem:** żądanie idzie przez
`ApiGateway.getInstance().initializeRoutes(app)` z podpisanym JWT. **Test montujący
router w gołym `express()` nie dowodzi niczego.**

**Uwaga do „widoczności na siedmiu powierzchniach".** Siedem powierzchni z `E8` (lista,
karta, KPI, kokpit Realizacji, Moja Praca, Wyniki, Raporty) dotyczy **rekordu
inicjatywy**, nie kamienia milowego czy pozycji budżetu. W raporcie **wypisujesz, które
z siedmiu czytają encję Twojego pisarza** (trasa + wynik), a przy pozostałych piszesz
„nie dotyczy — powierzchnia nie czyta tej encji" **z komendą, która to pokazuje**.
**Puste pole z uzasadnieniem jest WYNIKIEM; puste pole bez uzasadnienia jest brakiem
pomiaru.** Pliku `nowyRekordSiedemPowierzchni.pg.test.ts` **nie zmieniasz**.

## E2.5 — DOWÓD MUTACYJNY PER PISARZ (`Z32`, w obie strony)

**Bez tego wpis `ZROBIONE` jest nieważny. CODEX1 i CODEX2 oddały etapy bez dowodów
mutacyjnych i oba odbiory uznały DoD za niespełnione.** Dla **każdego** pisarza `P`
minimum trzy mutacje:

| Mutacja | Oczekiwanie |
| --- | --- |
| usuwasz zapis do **tabeli modelu odczytu** w nowej metodzie UoW | sprawdzenia 2 i 3 **CZERWONE** |
| usuwasz `organization_id` z zapytania odczytu albo z warunku zapisu | sprawdzenie 5 (tenant) **CZERWONE** |
| zawsze-`false` w gałęzi flagi `ENABLE_INITIATIVE_UNIFIED_WRITE` | sprawdzenie 2 **CZERWONE**, sprawdzenie 1 (OFF) **dalej ZIELONE** |

Po każdej: **cofasz przez `cp`** ze `scratch` (`Z27` — `git stash` zakazany), test
**ZIELONY**, `git diff` **pusty**. **Obie komendy i oba wyniki dosłownie w raporcie.**

## E2.6 — WYCOFANIE ŚCIEŻKI (wyłącznie przy 1=TAK, 2=TAK, 3=TAK)

Dopisanie wzorca do `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS`
(`executionSpineLegacyReadOnly.middleware.ts:82`) wymaga **łącznie czterech rzeczy**.

1. test, że trasa zastana odpowiada `409` **z rozróżnieniem źródła**: asercja na
   `code === 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED'` **oraz** na `canonicalWriter`
   (`§0.2d` pkt 10 — bez tego test przechodzi także wtedy, gdy handler nie istnieje);
2. **dowód osiągalności następcy** (`Z21`): zapis komendą → odczyt trasą ekranu →
   **rekord z identyfikatorem i treścią**;
3. **komunikat po polsku i po angielsku** (`Z46`) — kod błędu ma klucz w
   `public/locales/pl` **i** `public/locales/en` z realnym tłumaczeniem. **Zmierzone
   przy `E1`: bez tego użytkownik widzi toast `HTTP 409 Conflict`** i nie wie, co robić;
4. **komentarz przy wzorcu** w kształcie, który jest tam dla `raid`: *nazwa wspólnej
   tabeli + nazwa pliku testu*.

**Zero nowych wzorców bez tych czterech rzeczy.** Wątpliwość → **nie wycofujesz**.

## Definicja ukończenia `E2` (mierzalna)

- tabela **sześć ścieżek × cztery odpowiedzi × werdykt**, każda z komendą i wynikiem;
- **co najmniej trzy** kanoniczne komendy działające (`WARIANT P`), każda
  z deterministycznym `clientRequestId` i dowodem idempotencji;
- **test realdb per pisarz `P`** — pięć sprawdzeń, przez realny `ApiGateway`,
  `--retry=0`, bez `it.todo`; **parytet `OFF`**: `diff przed-nazwy.txt po-nazwy.txt`
  bez ani jednej nazwy ZNIKNIĘTEJ;
- **dowody mutacyjne w obie strony** — minimum trzy na pisarza `P`; dla każdego
  pisarza `N`: projekt komendy + czerwony kontrakt;
- `K5` i `K6` przed/po z komendą; zero nowych wzorców na liście wycofanych bez
  kompletu z `E2.6`.

## Możliwe STOP-y w `E2` (wszystkie MERYTORYCZNE — wpisujesz i idziesz dalej)

- **komenda kanoniczna ma inny kształt danych niż trasa zastana** → STOP z **tabelą
  pól** (zastane ↔ kanoniczne) i propozycją odwzorowania;
- **następca wymagałby zmiany interfejsu `MaterialCommandUnitOfWork`, a implementacji
  jest więcej niż jedna** → STOP z listą implementacji i promieniem rażenia;
- **wycofanie zmieniłoby zachowanie widoczne dla użytkownika** → nie wycofujesz, STOP;
- **★ uprawnienia się rozjeżdżają**: trasa zastana autoryzuje szerzej (sponsor, role
  bramkowe, RACI) niż komenda kanoniczna (`requireOwnership` + właściciel). **To jest
  zmierzone przy `E1` i NIE zostało zgłoszone — Ty zgłaszasz**, z tabelą: kto może
  dziś, kto będzie mógł po `ON`, kogo to odetnie;
- **ekran woła trasę zastaną z pliku, którego licencja nie obejmuje** → czerwony
  kontrakt + brief.

---

## E9 — RAPORT (drugi i ostatni etap)

**Jedyny nowy dokument w repo** (`Z13`):
`docs/…/CODEX2B_SZESCIU_PISARZY/98_RAPORT.md`. **Układ narzucony — nie zmieniasz
kolejności ani nagłówków. Raport po polsku.**

| # | Sekcja | Co musi zawierać |
| --- | --- | --- |
| 0 | **Metryka** | marker · gałąź · SHA po każdym kroku · wynik `merge-base --is-ancestor` · dosłowny wynik `rev-parse HEAD` i `status --short` z `§0.1` (7) · kontener/bazy/porty · liczba migracji w przebiegu 1 i 2 + idempotencja · znaczniki odmrożenia + wynik `check-freeze.sh` |
| 1 | **K-PUNKTY przed/po** | `K5` sześć ścieżek (wycofane / z następcą / bez następcy; **wejście: 0/6 wycofanych, 6/6 ma wołaczy**) · `K6` powierzchnie widzące rekord per pisarz (po treści / „nie dotyczy") · `K7` metody UoW piszące do tabeli modelu odczytu (**wejście: 3**) · `K8` wzorce na liście wycofanych (**wejście: 4**) · `K9` wiersze w sześciu tabelach. **Obok każdej mojej liczby wpisz swoją i zaznacz rozbieżność** |
| 2 | **Stan wejściowy** | wynik ośmiu komend `§0.1a` dosłownie, obok moich |
| 3 | **SZEŚĆ ŚCIEŻEK — tabela rdzeniowa** | sześć wierszy × cztery odpowiedzi × werdykt (`P`/`N`/martwa/wycofana), każda odpowiedź z komendą i wynikiem; dla `N` — projekt komendy (ścieżka · ładunek · kody błędów · agregat · tabela · rozmiar) |
| 4 | **Kroki `E2.0`…`E2.6`, `E9`** | co zrobiłem · definicja ukończenia i czy spełniona · komendy dowodowe z wynikami · **akapit `§0.2e`** (która pułapka, jak wyłączona) · SHA commita |
| 5 | **Dowody mutacyjne (`Z32`)** | komenda psująca · wynik CZERWONY · komenda cofająca (`cp`) · wynik ZIELONY · `git diff` pusty. **Minimum trzy na każdego pisarza `P`** |
| 6 | **Zasięg testów (`§0.4a`)** | `diff przed-nazwy.txt po-nazwy.txt`: nazwy DODANE i ZNIKNIĘTE, każda zniknięta z wyjaśnieniem. **Osobno parytet przy `OFF`** |
| 7 | **Deklaracja `Z30`** | dosłowny akapit z `§0.2b` + `ie_outbox_delivery_receipts` po każdym kroku zapisującym |
| 8 | **Migracje i manifesty** | ścieżka manifestu · `ls -l` · `shasum -a 256` · liczby przed/po · wynik `--verify` · dowód, że tabela zastana się nie zmieniła. **Żadnej migracji nie było → napisz to wprost** |
| 9 | **Korekty wobec instrukcji** | każda rozbieżność jako WYNIK, nie sprzeczność. **Obowiązkowo: zweryfikowane numery linii sześciu pisarzy** |
| 10 | **STOP-y** | format z `§0.5`, każdy z wypełnionymi polami „Licencja" i „Co dostarczyłem ZAMIAST" |
| 11 | **TWIERDZENIA NIEZWERYFIKOWANE** | **sekcja NIEPUSTA** — wszystko, co napisałem, a czego nie zmierzyłem u siebie |
| 12 | **DO DECYZJI WŁAŚCICIELA** | każdy wiersz ze zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie". Minimum: (a) czy `move` (zmiana `project_id`) ma mieć komendę kanoniczną; (b) rozjazd uprawnień zastane↔kanon — kogo odetnie `ON`; (c) czy `expectedVersion` idzie od klienta, czy „ostatni wygrywa" |
| 13·14 | **ZNALEZISKA POBOCZNE** i **Artefakty** | wszystko, co zobaczyłem po drodze, a co nie należy do tego bloku; ścieżki artefaktów poza repo + `shasum -a 256` każdego pliku |

**Definicja ukończenia `E9`:** wszystkie 14 sekcji obecne, sekcje 11 i 12 niepuste,
każda liczba z komendą.

---

## Próg odbioru

Nadzorca przyjmuje blok, gdy **wszystkie** poniższe są prawdziwe:

1. Tabela **sześć ścieżek × cztery odpowiedzi × werdykt** kompletna, każda odpowiedź
   z komendą i wynikiem.
2. **Co najmniej trzy** kanoniczne komendy działają: zapis przez realny `ApiGateway` →
   wiersz w **tabeli, którą czyta ekran** → odczyt trasą ekranu pokazuje **identyfikator
   i treść**.
3. **Idempotencja udowodniona**: dwa identyczne żądania → brak przyrostu
   `ie_command_receipts` i `version`. **Izolacja tenanta** zielona dla każdego
   pisarza `P`, przy `ON` i `OFF`.
4. **Parytet `OFF`**: `§0.4a` nie pokazuje ani jednej nazwy, która ZNIKNĘŁA;
   zachowanie sześciu tras przy `OFF` bit w bit jak na markerze.
5. **Minimum trzy dowody mutacyjne na pisarza `P`**, w obie strony, z komendami i wynikami.
6. Każdy pisarz `N` ma projekt komendy **i** czerwony kontrakt.
7. `git diff --name-only <MARKER>..HEAD` **nie zawiera ani jednego pliku** z listy
   „JAWNIE NIE ZAPISZE" — w szczególności **ani jednego pliku z `src/`**.
8. Żaden nowy wzorzec na liście wycofanych ścieżek bez kompletu z `E2.6`.
9. **Parytet i18n**: każdy nowy klucz w `pl` i `en`, z realnym tłumaczeniem,
   w tym samym commicie (`Z46`). **Żaden nowy test nie przybija stanu zastanego**
   (`Z43`): `grep -rn "toEqual(\[\])" <nowe pliki testów>` z wyjaśnieniem trafień.
10. Raport ma wszystkie 14 sekcji, sekcje 11 i 12 niepuste.

**Prawo zatrzymania.** Masz prawo **zatrzymać dowolny krok** i oddać zamiast niego
pomiar, czerwony kontrakt albo brief. **Nie masz prawa** zatrzymać całego bloku z innego
powodu niż pięć z `§0.5`. **★ Trzy najcenniejsze rzeczy, jakie możesz oddać:** dowód, że
coś, co uchodziło za działające, nie działa; dowód, że coś, co uchodziło za zepsute, jest
sprawne; i uczciwe zdanie „tego nie zmierzyłem, bo…".

---

## ★★ JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE LUB NIEWYKONALNE

**Ta instrukcja była pisana i sprawdzana przez człowieka i model. Może mieć błędy.
Nie zatrzymuj przez nie pracy.**

1. **Opisz sprzeczność w raporcie** (sekcja 9): cytat obu wykluczających się zdań
   z numerami paragrafów, konflikt, dowód, co zrobiłeś.
2. **Wybierz interpretację BEZPIECZNIEJSZĄ.** Reguły rozstrzygające: **nie ruszaj
   cudzego pliku** (nie wiesz, czy masz licencję → **nie masz**) · **nie osłabiaj
   asercji** · **nie przybijaj stanu zastanego** (`arrayContaining`, nie `toEqual`) ·
   **nie wycofuj** (nie wiesz, czy następca jest równoważny → ścieżka zostaje) ·
   **nie włączaj** (nie wiesz, czy flaga ma być `ON` → zostaje `OFF`) · **nie kasuj**
   (wpisz `DO DECYZJI WŁAŚCICIELA` ze zdaniem „czego konkretnie mi zabrakło") ·
   **nie wysyłaj niczego na zewnątrz** · **nie poszerzaj dostępu** (bramka
   niejednoznaczna → **odmawiasz zamiast przepuszczać**) · **nie połykaj po cichu**
   (`Z45`) · **mierz zamiast zgadywać** (Twój pomiar z komendą jest wiążący, `Z24`).
3. **KONTYNUUJESZ POZOSTAŁE KROKI.** Zatrzymanie CAŁEGO bloku — wyłącznie z pięciu
   powodów z `§0.5`. **Nigdy nie „naprawiaj" instrukcji przez improwizację w kodzie.**

**★ Ostatnie zdanie tej instrukcji i najważniejsze: obalenie którejkolwiek tezy
z sekcji „STAN ZMIERZONY" jest SUKCESEM tego bloku, a nie porażką. Zapisz to
w „Korektach" z dowodem i idź dalej.**
