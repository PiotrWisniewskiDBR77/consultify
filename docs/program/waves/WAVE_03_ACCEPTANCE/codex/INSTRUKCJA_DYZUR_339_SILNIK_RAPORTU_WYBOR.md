# INSTRUKCJA DYŻURU nr 339 — Codex — „DEC-389 — wybór silnika raportu Oceny po POMIARZE: każdy żywy silnik produkuje raport dla TEJ SAMEJ sesji, wyniki lądują obok siebie razem z zaakceptowanym prototypem 21 stron, a produktem dyżuru są PLIKI DO OBEJRZENIA i rekomendacja — nie podłączenie ani wygaszenie czegokolwiek"

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
> **wyłącznie** `/private/tmp/cx-day339-silnik-raportu-wybor`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `74c07919ce`**
> **Gałąź bazowa: `github-backup/grafika/m03-20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-04.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **Ocena (Assessment / Method Core) — silniki raportu DRD: pomiar porównawczy trzech ścieżek i dwóch modułów bez wołaczy**.
Trasy front: ``src/components/assessment/report/AssessmentReportContractView.tsx` (montowana leniwie z `src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx`, ok. linii 88-90 i 1147), `src/views/DRDAuditReportView.tsx` pod `/audit-programs/drd-report/:reportId`, `src/services/api.ts` ok. linii 10463`. Trasy tył: ``GET /api/method/sessions/:sessionId/assessment-report-contract` i `GET /api/method/sessions/:sessionId/assessment-report.docx` (`server/src/routes/method-core.routes.ts`, ok. 535 i 553); `GET /api/assessment-reports/:reportId/drd-report` (`server/src/routes/assessment-reports.routes.ts`, ok. 1065)`.

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
WT=/private/tmp/cx-day339-silnik-raportu-wybor
MARKER=74c07919ce

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day339-silnik-raportu-wybor-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day339-silnik-raportu-wybor/config.worktree"
cat "$VAULT/worktrees/cx-day339-silnik-raportu-wybor/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day339-silnik-raportu-wybor-scratch
mkdir -p /private/tmp/cx-day339-silnik-raportu-wybor-artefakty

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
git -C "$VAULT" log --oneline 74c07919ce..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 74c07919ce..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day339-silnik-raportu-wybor-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 74c07919ce..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `osiem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

★ WSZYSTKIE grepy uruchamiasz w BASHU (`bash -lc '...'` albo skrypt `.sh`).
W `zsh` `grep --include=*.ts` zwraca `no matches found` ZAMIAST wyników — pustka
nie jest wynikiem, dopóki nie sprawdzisz, że polecenie w ogóle się wykonało.

```bash
# (1) TEZA: trzy zywe trasy raportu Oceny
grep -rn "assessment-report-contract\|assessment-report.docx\|drd-report" server/src/routes/ | grep -v __tests__
#   oczekiwane: method-core.routes.ts ok. 535 i 553; assessment-reports.routes.ts ok. 1065

# (2) TEZA: silnik DOCX ma realnego konsumenta we froncie
grep -rn "assessment-report.docx" src/ | grep -v __tests__
grep -rn "AssessmentReportContractView" src/ | grep -v __tests__ | grep -v "report/AssessmentReportContractView.tsx:"
#   oczekiwane: wolacz w src/components/assessment/report/AssessmentReportContractView.tsx ok. 360,
#   a sam komponent montowany LENIWIE z DrdHttpMethodWorkspaceScreen.tsx ok. 88-90 i 1147.
#   ★ SPROSTOWANIE: zlecenie nazywalo konsumenta „AssessmentReportDocxDownload" — taki KOMPONENT
#   NIE ISTNIEJE; ta nazwa nosi wylacznie plik testu
#   src/components/assessment/report/__tests__/AssessmentReportDocxDownload.day50.test.tsx.

# (3) TEZA: silnik HTML z narratorem
grep -rln "buildDrdReportHtmlServer\|generateDrdReport\|drdLlmNarrator" server/src src | sort
#   oczekiwane: co najmniej assessment-reports.routes.ts, services/report/drdReportGenerator.ts,
#   services/report/drdReportService.ts, services/report/drdReportGrounding.ts

# (4) ★ TEZA GLOWNA: osierocony model 298 jest tym, ktory pasuje do prototypu
grep -rn "buildAcceptedDrdReportModel" server/src src tests
#   oczekiwane: DOKLADNIE dwa pliki — acceptedDrdReportModel.ts (definicja) i jego wlasny test.
#   Zero wolaczy produkcyjnych. To jest DLUG INTEGRACYJNY, nie werdykt o jakosci.

# (5) TEZA: serwis metadanych bez wolaczy, z WHERE EXISTS w samym zapisie
grep -rn "methodSessionReportMetadataService" server/src src tests
sed -n '69,95p' server/src/services/report/methodSessionReportMetadataService.ts
#   oczekiwane: jedyny wolacz to test day331; w `save` widac `WHERE EXISTS (SELECT 1 FROM
#   method_sessions WHERE id = ? AND organization_id = ?)` PRZED `ON CONFLICT`

# (6) TEZA: prototyp 21 stron istnieje w repo jako PLIK
ls -la docs/program/prototypy/
#   oczekiwane: RAPORT_OCENY_DRD_PROTOTYP_20260903.md, .docx i .pdf oraz szkielet SIRI

# (7) TEZA: liscie i18n
node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'
#   oczekiwane: 35198 33065 — te liczby NIE MOGA zmalec

# (8) zasoby wolne
df -h /
lsof -nP -iTCP:6375 -sTCP:LISTEN; lsof -nP -iTCP:5515 -sTCP:LISTEN
docker ps --format '{{.Names}}' | grep cx-day339 || echo "brak kontenera 339"
#   oczekiwane: powyzej 5 GB wolnego; oba porty puste; brak kontenera
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day339-silnik-raportu-wybor-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6375`. Twój JEDYNY port harnessu to `5515`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day339-pg`**. **ZAKAZANE:** `6374, 6376 (bazy dyżurów 338 i 340), 5514, 5516 (runtime dyżurów 338 i 340), 5432 (cudzy nasłuch na hoście), a także wszystkie porty dyżurów 334-337, które biegną równolegle w tej serii`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNA — ten dyżur nie zakłada ani jednej flagi i nie zmienia wartości domyślnej żadnej zastanej. W szczególności NIE dokłada flagi narratora LLM: `DEC-390` mówi, że narrator ZOSTAJE włączony`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/resultsInternalBetaVisibility.middleware.ts`, `server/src/middleware/appErrorMapper.ts`, `src/services/api.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY339_SILNIK_RAPORTU_WYBOR_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SILNIK_RAPORTU_OCENY_20260903.md` (istnieje na markerze; dopisujesz sekcję „Pomiar porównawczy — dyżur 339", niczego nie kasujesz). **ZAKAZ edycji `MODULE_ACCEPTANCE.md`.**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day339-silnik-raportu-wybor-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day339-silnik-raportu-wybor-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **★★ ZAKAZ PODŁĄCZANIA I ZAKAZ WYGASZANIA JAKIEGOKOLWIEK SILNIKA RAPORTU.** Nie dopisujesz wołacza do `buildAcceptedDrdReportModel` ani do `methodSessionReportMetadataService`, nie odmontowujesz żadnej z trzech tras, nie kasujesz i nie oznaczasz niczego jako martwe. **ZAKAZ dodawania flagi narratora LLM i zakaz jego wyłączania** (`DEC-390`). **ZAKAZ zmiany struktury zaakceptowanego prototypu 21 stron** — jest punktem odniesienia pomiaru, nie materiałem do poprawiania. **ZAKAZ kluczy dostawców modeli w środowisku, w plikach i w komendach.** | Właściciel oddał wybór CTO słowami „Zdecyduj sam po pomiarze" (`DEC-389`). Dyżur ma DOSTARCZYĆ POMIAR, nie zdecydować za nadzorcę. Podłączenie albo wygaszenie silnika przed decyzją zamienia pomiar w fakt dokonany i odbiera nadzorcy przedmiot wyboru |

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
cd /private/tmp/cx-day339-silnik-raportu-wybor

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day339-pg psql -U postgres -d cx339 \
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
cd /private/tmp/cx-day339-silnik-raportu-wybor

docker run -d --name cx-day339-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx339 \
  -p 127.0.0.1:6375:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day339-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6375/cx339 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6375/cx339 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day339-silnik-raportu-wybor && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6375/cx339 \
JWT_SECRET=cx339-test-secret-do-not-reuse \
npx vitest run server/src/services/report/__tests__ server/src/services/assessment/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day339-silnik-raportu-wybor-artefakty/day339-silniki.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day339-silnik-raportu-wybor && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/report/__tests__ server/src/services/assessment/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day339-silnik-raportu-wybor-artefakty/day339-silniki.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day339-silnik-raportu-wybor/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day339-pg psql -U postgres -d cx339 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day339-pg`.
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
> **(e) OSIEROCONY MODUŁ POTRAFI BYĆ NAJLEPSZYM SILNIKIEM. `server/src/services/report/acceptedDrdReportModel.ts` ma zero wołaczy poza własnym testem — i jednocześnie to właśnie on powstał w dyżurze 298 pod zaakceptowany prototyp, a odbiór zapisał, że jego DOCX jest **piksel-w-piksel identyczny z prototypem na wszystkich 21 stronach** (`docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SILNIK_RAPORTU_OCENY_20260903.md`, sekcja „Różnice strona po stronie"). „Zero wołaczy" jest tu miarą DŁUGU INTEGRACYJNEGO, nie miarą jakości. Nie odrzuć go dlatego, że nikt go nie woła — to jest dokładnie ten kształt fałszywego wnioskowania, przez który program stracił tygodnie. Druga pułapka: `methodSessionReportMetadataService.ts` ma `WHERE EXISTS (... organization_id = ?)` **w samym zapisie**, przed `ON CONFLICT` (ok. linii 78-88), a poprzedni STOP na tym module był ZASADNY — premisa poprzedniej instrukcji była błędna. Nie powtarzaj tamtego błędu: najpierw przeczytaj zapytanie, potem twierdź cokolwiek o dziurze dzierżawcy**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day339-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day339-silnik-raportu-wybor-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R2, R3, R4`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6375` albo `5515` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6375` albo `5515`** (`Z7`).

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

## Po co ten dyżur istnieje

Właściciel oddał decyzję CTO trzema słowami: **„Zdecyduj sam po pomiarze”** (`DEC-389`, zapis
w `docs/program/REJESTR_ZNALEZISK_20260903.md`, wiersz N2). **Ten dyżur ma dostarczyć POMIAR, nie
wybrać za nadzorcę.** Produktem jest komplet plików do obejrzenia i rekomendacja z uzasadnieniem.
Wybór podejmie nadzorca po Twoim raporcie.

### Dlaczego to jest w ogóle problem

Aplikacja ma dziś **trzy żywe trasy raportu Oceny na dwóch różnych silnikach** i **dwa moduły bez
ani jednego wołacza produkcyjnego**. Nikt nie wie, który z nich zobaczy klient — bo nikt nie
położył ich wyników obok siebie.

| # | Ścieżka | Silnik | Konsument we froncie |
| --- | --- | --- | --- |
| 1 | `GET /api/method/sessions/:sessionId/assessment-report-contract` | `assessmentReportContractService` | `src/method-core/api/methodCoreApi.ts` ok. 234 |
| 2 | `GET /api/method/sessions/:sessionId/assessment-report.docx` | `buildAssessmentDrdReportSchema` → DOCX | `AssessmentReportContractView.tsx` ok. 360, montowany leniwie z `DrdHttpMethodWorkspaceScreen.tsx` ok. 1147 |
| 3 | `GET /api/assessment-reports/:reportId/drd-report` | `buildDrdReportHtmlServer` → `generateDrdReport` (+ `drdLlmNarrator`) | `src/services/api.ts` ok. 10463 → `src/views/DRDAuditReportView.tsx` |
| 4 | brak trasy | `buildAcceptedDrdReportModel` (`server/src/services/report/acceptedDrdReportModel.ts`) | **ZERO wołaczy** poza własnym testem |
| 5 | brak trasy | `methodSessionReportMetadataService` | **ZERO wołaczy** poza testem `day331` |

### ★ Sprostowanie zlecenia — trzy rzeczy, które zmierzyłem inaczej niż nadzorca

**Zapisuję je wprost, żebyś nie szukał nieistniejących obiektów:**

1. **„`AssessmentReportDocxDownload` — jedyny z realnym konsumentem w `src/`”.**
   **Taki KOMPONENT nie istnieje.** `grep -rn "AssessmentReportDocxDownload" src/` trafia wyłącznie
   w **nazwę pliku testu** `src/components/assessment/report/__tests__/AssessmentReportDocxDownload.day50.test.tsx`.
   Realnym konsumentem trasy `.docx` jest `AssessmentReportContractView.tsx` (ok. linii 360),
   montowany leniwie z `DrdHttpMethodWorkspaceScreen.tsx`. **Zweryfikuj to sam** i zapisz, czy ten
   ekran jest osiągalny od korzenia produktu — bo „wołacz istnieje” to nie to samo, co „komponent
   się renderuje”.
2. **„`buildAcceptedDrdReportModel` — osierocony moduł”.** Prawda co do wołaczy, **myląca co do
   wagi**. To jest silnik zbudowany w dyżurze 298 **pod zaakceptowany prototyp**, a odbiór zapisał
   pomiar: **każda z 21 stron piksel-w-piksel identyczna z prototypem**
   (`docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SILNIK_RAPORTU_OCENY_20260903.md`, sekcja
   „Różnice strona po stronie”, `mean_abs_rgb = 0.0000` dla stron 1-21). Odbiór dyżuru 298 nazwał
   to wprost: **„DOCX identyczny z prototypem 21/21, brak wołaczy silnika”**. Zero wołaczy jest tu
   miarą **długu integracyjnego**, nie miarą jakości.
3. **„`methodSessionReportMetadataService.ts:72-88`”.** Interfejs zaczyna się ok. linii 14, klasa
   ok. 59, a `WHERE EXISTS` stoi w `save` ok. linii **78-88**. Przedział z mojego zlecenia był
   przesunięty. Odczytaj plik i podaj **swoje** numery.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

### Punkt odniesienia: zaakceptowany prototyp 21 stron

`docs/program/prototypy/RAPORT_OCENY_DRD_PROTOTYP_20260903.md` / `.docx` / `.pdf`. Właściciel
ocenił **gotowy plik, nie kod**, i powiedział: **„Ten raport jest po prostu fantastyczny”**
(`DEC-385`). Struktura kontraktowa: **okładka i wstęp → 7 osi po 2 strony → odpowiedzi i wnioski →
podsumowanie**, plus czterostronicowy wyciąg zarządczy z tego samego modelu.

**Prototyp jest miarą, nie materiałem do poprawiania** (`Z40`). Jeżeli któryś silnik odbiega od
niego — to jest wynik pomiaru, a nie powód do zmiany prototypu.

### Co ten dyżur ma zrobić

**Dla TEJ SAMEJ sesji Oceny wyprodukować raport każdym żywym silnikiem i położyć wyniki obok
siebie, razem z prototypem.** Porównanie ma odpowiadać na pięć pytań:

1. **Ile stron** wychodzi z każdego silnika?
2. **Czy struktura zgadza się z prototypem** (wstęp → 7 osi po 2 strony → odpowiedzi/wnioski →
   podsumowanie)?
3. **Czy treść jest po polsku?** (Uwaga: rejestr 298 zapisał, że osie 1-4 i 7 nadal mają angielskie
   tytuły poziomów. Sprawdź, czy to dalej prawda.)
4. **Czy są gniazda niewypełnione** — miejsca, w których dokument pokazuje pustkę, zaślepkę albo
   napis w stylu „brak danych”?
5. **Ile czasu zajmuje generowanie?**

**Wynik = PLIK DO OBEJRZENIA, nie tabela liczb.** Nadzorca ma otworzyć jeden dokument i zobaczyć
strony obok siebie.

## ★ Zmierz moje liczby sam

Twierdzę: żywych tras jest **3**; silników **2** na tych trasach, plus **2** moduły bez wołaczy;
`buildAcceptedDrdReportModel` ma **0** wołaczy produkcyjnych; `methodSessionReportMetadataService`
ma **0** wołaczy produkcyjnych; `WHERE EXISTS` w `save` stoi ok. linii **78-88**; prototyp ma
**21** stron pełnych i **4** strony wyciągu; liście `public/locales/pl/translation.json` = **35198**,
`en` = **33065**.

**Każdą z tych liczb policz sam. Przepisanie mojej liczby jest zawyżeniem i podstawą odrzucenia
raportu (`Z24`).**

---

## B.1. TABELA LICENCJI PLIKOWYCH — CAŁA ŚCIEŻKA

> **★★ ZASTRZEŻENIE.** Poniższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
> opisany jako „PEŁNA/WĄSKA LICENCJA” — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
> NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

> **★★ TEN DYŻUR JEST POMIAREM.** Licencja jest celowo wąska: **żaden plik produkcyjny silnika nie
> jest w niej do zapisu.** To nie jest przeoczenie ani powód do STOP-u — produktem dyżuru są pliki
> wynikowe, rejestr i rekomendacja.

| Warstwa | Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- | --- |
| **trasa (tył)** | `server/src/routes/method-core.routes.ts`, `server/src/routes/assessment-reports.routes.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** Odmontowanie albo dopięcie trasy zamienia pomiar w fakt dokonany (`Z19`, `Z40`) | **CZERWONY KONTRAKT TESTOWY**: nowy plik testu, który **dziś PADA** i opisuje żądane zachowanie, oznaczony `it('KONTRAKT DLA DYŻURU 339 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`, + brief: plik:linia · promień rażenia · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| **silnik DOCX** | `server/src/services/assessment/assessmentDrdReportSchemaService.ts`, `assessmentReportContractService.ts` | **TYLKO ODCZYT** — mierzysz jego wynik, nie zmieniasz go | Gotowy diff w bloku kodu, **nienałożony**, + brief |
| **silnik HTML + narrator** | `server/src/services/report/drdReportGenerator.ts`, `drdReportService.ts`, `drdReportGrounding.ts`, `drdConclusionContract.ts`, `src/services/report/drdReportGenerator.ts`, `drdReportClient.ts` | **TYLKO ODCZYT.** **ZAKAZ dodania flagi narratora i zakaz jego wyłączenia** (`DEC-390`, `Z40`) | Opis w raporcie z dowodem plik:linia + gotowy diff nienałożony |
| **silnik 298 (osierocony)** | `server/src/services/report/acceptedDrdReportModel.ts` | **TYLKO ODCZYT.** **ZAKAZ dopisania wołacza** — podłączenie jest decyzją nadzorcy po tym pomiarze | Pomiar + wpis do rejestru + gotowy diff nienałożony, **z jawnym zdaniem, ile pracy kosztowałoby podłączenie** |
| **metadane (osierocone)** | `server/src/services/report/methodSessionReportMetadataService.ts` | **TYLKO ODCZYT.** Poprzedni STOP na tym module był ZASADNY — nie powtarzaj błędnej premisy | Pomiar zapytania + brief: co realnie chroni `WHERE EXISTS`, czego nie chroni, i czy istnieje trasa, która ten zapis w ogóle wywołuje |
| **model danych** | `server/src/services/report/drdReportModel.ts`, `server/src/data/drdStructure.ts`, `src/services/drdStructure.ts`, `server/src/services/report/drdIndustryBenchmark.ts` | **TYLKO ODCZYT** | Opis w raporcie |
| **front raportu** | `src/components/assessment/report/**`, `src/components/assessment/drd/**`, `src/views/DRDAuditReportView.tsx`, `src/services/api.ts`, `src/method-core/api/methodCoreApi.ts` | **TYLKO ODCZYT** — dowód osiągalności robisz przez `grep` od korzenia i przez uruchomienie, nie przez zmianę | Opis w raporcie z dowodem plik:linia |
| **prototyp** | `docs/program/prototypy/**` | **TYLKO ODCZYT — BEZWZGLĘDNIE** (`Z40`). To jest miara, nie materiał | Errata w raporcie |
| **narzędzie pomiarowe (NOWE)** | `scripts/dev/day339-porownanie-silnikow.mjs` (**NOWY**) | **★ PEŁNA LICENCJA** — skrypt, który dla jednej sesji woła każdy silnik i składa zestawienie. **ZAKAZ pisania własnego skryptu ZRZUTOWEGO obok kanonicznego `scripts/dev/grafika-zrzuty.mjs`** — jeżeli potrzebujesz zrzutu, brakującą zdolność dokładasz do kanonicznego, addytywnie i opt-in | — |
| **narzędzie zrzutów** | `scripts/dev/grafika-zrzuty.mjs` | **★ WĄSKA LICENCJA — WYŁĄCZNIE zmiany ADDYTYWNE i OPT-IN**, domyślnie wyłączone. **ZAKAZ zmiany zachowania domyślnego** | Opis brakującej zdolności + gotowy diff |
| **walidator (NOWE pliki)** | `server/src/services/report/__tests__/**`, `server/src/services/assessment/__tests__/**`, `tests/**` (NOWE) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31`. Nowe pliki w `tests/` wymagają `git add -f` | — |
| **walidator (ZASTANE)** | `server/src/services/report/__tests__/acceptedDrdReportModel.test.ts`, `day331.methodSessionReportMetadataTenant.pg.test.ts`, `server/src/services/assessment/__tests__/day32.drdSchema.test.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisywanie NOWYCH przypadków `it(...)`.** Zakaz zmiany i osłabiania istniejących asercji | Nowy plik testowy obok, z nagłówkiem `// KONTRAKT DYŻURU 339` |
| **migracje** | `server/migrations/**` | **BEZ LICENCJI — ten dyżur nie dodaje ani nie zmienia żadnej migracji.** Przedział nie jest mu przydzielony. Migracje **uruchamiasz** w całości na swojej bazie — to nie jest zmiana pliku | Uznasz migrację za potrzebną → **STOP MERYTORYCZNY z briefem**, przechodzisz do następnej pozycji |
| **i18n** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. **Liczba liści nie może zmaleć** (35198 / 33065). ★ Klucz w `pl` trzymający angielskie słowo NIE jest przetłumaczony — jeśli taki znajdziesz w raporcie Oceny, to jest **wynik pomiaru** do zapisania, nie zadanie do wykonania w tym dyżurze | — |
| **rejestr** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SILNIK_RAPORTU_OCENY_20260903.md` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie sekcji „Pomiar porównawczy — dyżur 339”.** Zakaz kasowania i przeredagowywania zastanych sekcji | — |
| **dowody** | `evidence/silniki-raportu-oceny-20260904/**` (**NOWY**) | **★ PEŁNA LICENCJA**, `git add -f`. Tu ląduje **zestawienie do obejrzenia** | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY339_SILNIK_RAPORTU_WYBOR_REPORT.md` (**NOWY**) | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **decyzje** | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`, `docs/program/REJESTR_ZNALEZISK_20260903.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar, jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja jest **ZROBIONA** z takim opisem |
| **cudzy teren** | `src/components/Initiatives/**`, `src/components/Initiatives/sections/initiativeCardContract.ts` — **teren dyżuru 338**; `src/layouts/MainLayout.tsx`, `src/components/AIChat/**` — **teren dyżuru 340**; wszystko dotknięte przez dyżury 334-337 tej serii | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, treść problemu, **gotowa rekomendacja jako diff w bloku kodu, nienałożony**. Pozycja idzie dalej |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit robisz PO KAŻDEJ pozycji,
push na `github-backup` po pierwszym commicie i po każdej kolejnej (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Inwentarz silników i ich wołaczy — pełna ścieżka od korzenia | NIE | NIE — dowód: `grep -rn 'buildAcceptedDrdReportModel' server/src src tests` jest odczytem | bazowe | Tabela: silnik · plik:linia · trasa · konsument we froncie · **czy komponent jest osiągalny od korzenia produktu**. Sprostowanie nazwy `AssessmentReportDocxDownload` zapisane | `grep -rn … \| grep -v __tests__` (w `bash`, **bez `\| head`**) | `docs(day339): inwentarz silnikow raportu Oceny i ich wolaczy (339 R1)` |
| R2 | **RDZEŃ:** jedna realna sesja Oceny na własnej bazie | TAK | NIE | +1 test | Sesja z realnymi odpowiedziami, założona przez **realny łańcuch** `ApiGateway` → podpisany JWT → PostgreSQL po pełnych migracjach; identyfikator sesji zapisany; readback SQL potwierdza wiersze | `npx vitest run --retry=0` z pełnym kompletem env w tej samej linii + `docker exec cx-day339-pg psql -U postgres -d cx339 -c '…'` | `test(day339): realna sesja Oceny na wlasnej bazie (339 R2)` |
| R3 | **RDZEŃ:** raport z KAŻDEGO żywego silnika dla TEJ SAMEJ sesji | TAK | NIE | n/d | Dla każdego silnika: plik wynikowy w katalogu artefaktów, `shasum -a 256`, liczba stron, czas generowania. Silnik, który **nie da się uruchomić**, ma to zapisane wprost z komunikatem błędu — to też jest wynik | `node scripts/dev/day339-porownanie-silnikow.mjs …` | `feat(day339): skrypt porownania silnikow raportu Oceny (339 R3)` |
| R4 | **RDZEŃ:** zestawienie obok siebie z prototypem 21 stron — PLIK DO OBEJRZENIA | TAK | NIE | n/d | Jeden dokument w `evidence/silniki-raportu-oceny-20260904/`, w którym strony każdego silnika stoją obok odpowiadających stron prototypu; pięć pytań z sekcji „Co ten dyżur ma zrobić” odpowiedziane per silnik | `shasum -a 256` wszystkich plików + odczyt własnymi oczami, opisany z nazwy | `docs(day339): zestawienie silnikow obok prototypu 21 stron (339 R4)` |
| R5 | Narrator LLM — co realnie dopisuje do raportu | NIE | NIE | n/d | Tabela: pole/sekcja raportu · czy narrator ją nadpisuje · plik:linia · co konkretnie wstawia. **Pomiar statyczny plus przebieg bez klucza dostawcy** (patrz `R5` niżej — to nie jest złamanie `Z15`) | `grep -rn "drdLlmNarrator" server/src` + przebieg silnika 3 z `R3` | `docs(day339): pomiar wkladu narratora LLM do raportu (339 R5)` |
| R6 | Metadane raportu — `WHERE EXISTS` i brak wołaczy | NIE | NIE | +1 test | Odczyt zapytania z własnymi numerami linii; odpowiedź na pytanie **„czy istnieje trasa, która ten zapis w ogóle wywołuje”**; werdykt: dług integracyjny czy martwy kod. **Nie podłączasz** | `grep -rn "methodSessionReportMetadataService" server/src` + `npx vitest run server/src/services/report/__tests__ --retry=0` | `docs(day339): rozliczenie serwisu metadanych raportu (339 R6)` |
| R7 | Rekomendacja dla nadzorcy | NIE | NIE | n/d | Jedno zdanie werdyktu na silnik + jedno zdanie rekomendacji + **jawna lista tego, czego nie zmierzyłeś**. Rekomendacja **nie jest wykonana** — jest przedmiotem decyzji nadzorcy | — | `docs(day339): rekomendacja wyboru silnika raportu (339 R7)` |
| R8 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE” **niepusta** | — | `docs(day339): raport` |

> **Kolumna „Wymaga plików przekrojowych?” jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Żadna pozycja nie wymaga zmiany pliku, którego nie masz prawa dotknąć —
> **ten dyżur z założenia nie zmienia kodu produkcyjnego silników.** Jeśli uznasz, że musi,
> produktem jest czerwony kontrakt + brief, a pozycja jest **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą z tych liczb mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz
w `bash`, nigdy w `zsh`.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Żywe trasy raportu Oceny | 3 | `grep -rn "assessment-report-contract\|assessment-report.docx\|drd-report" server/src/routes/ \| grep -v __tests__` | TAK — uruchomione na markerze |
| 2 | Wołacze `buildAcceptedDrdReportModel` poza własnym testem | 0 | `grep -rn "buildAcceptedDrdReportModel" server/src src tests` | TAK — **zero jest wynikiem, nie brakiem pomiaru** |
| 3 | Wołacze `methodSessionReportMetadataService` poza testem | 0 | `grep -rn "methodSessionReportMetadataService" server/src src tests` | TAK |
| 4 | Wystąpienia `AssessmentReportDocxDownload` w `src/` poza `__tests__` | 0 | `grep -rn "AssessmentReportDocxDownload" src/ \| grep -v __tests__` | TAK — **to jest sprostowanie zlecenia** |
| 5 | Strony zaakceptowanego prototypu | 21 pełnych + 4 wyciągu | `ls -la docs/program/prototypy/` + odczyt `.pdf` | TAK |
| 6 | Linie `WHERE EXISTS` w `save` serwisu metadanych | ok. 78-88 | `sed -n '69,95p' server/src/services/report/methodSessionReportMetadataService.ts` | TAK — **podaj SWOJE numery, moje pochodzą z przybliżenia** |
| 7 | Migracje na świeżej bazie | ok. 893 w pierwszym przebiegu, 0 w drugim | pełny przebieg migratora + powtórzenie | TAK — drugi przebieg **musi** być bezbłędny i bez zmian |
| 8 | Liście `translation.json` | pl 35198 / en 33065 | `node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'` | TAK — **liczba nie może zmaleć** |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY339_SILNIK_RAPORTU_WYBOR_REPORT.md` | NOWY | R8 | ZEROWE |
| 2 | `evidence/silniki-raportu-oceny-20260904/**` | NOWY | R3/R4 | ZEROWE |
| 3 | `scripts/dev/day339-porownanie-silnikow.mjs` | NOWY | R3 | ZEROWE |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SILNIK_RAPORTU_OCENY_20260903.md` | ZASTANY — dopisanie sekcji | R1/R4/R5/R6 | ŚREDNIE — plik zastany z dyżuru 298; **dopisujesz sekcję, nie przepisujesz dokumentu** |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/src/services/report/__tests__/**` (NOWE) | R2/R6 | `git add -f`; test realdb wyłącznie z jawnym `DATABASE_URL` wskazującym Twój kontener; `assertRealPostgresTestEnvironment()` **bez argumentów** (`Z31`) |
| `server/src/services/assessment/__tests__/**` (NOWE) | R3 | jw. |
| `scripts/dev/grafika-zrzuty.mjs` | R4 | Tylko addytywnie i opt-in, jeśli zestawienie wymaga zdolności, której narzędzie nie ma; zachowanie domyślne bit w bit jak dziś |
| `public/locales/{pl,en}/translation.json` | R5 | Tylko dopisanie kluczy, parytet w tym samym commicie, liczba liści nie maleje |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/src/routes/method-core.routes.ts                              — trasa mierzona, nie zmieniana
server/src/routes/assessment-reports.routes.ts                       — jw.
server/src/services/assessment/assessmentDrdReportSchemaService.ts   — silnik DOCX
server/src/services/assessment/assessmentReportContractService.ts    — kontrakt raportu
server/src/services/report/drdReportGenerator.ts                     — silnik HTML + narrator
server/src/services/report/drdReportService.ts                       — jw.
server/src/services/report/drdReportGrounding.ts                     — jw.
server/src/services/report/acceptedDrdReportModel.ts                 — silnik 298, ZAKAZ dopiecia wolacza
server/src/services/report/methodSessionReportMetadataService.ts     — ZAKAZ dopiecia wolacza
docs/program/prototypy/**                                            — miara pomiaru, nietykalna
src/components/Initiatives/**                                        — teren dyzuru 338
src/layouts/MainLayout.tsx, src/components/AIChat/**                 — teren dyzuru 340
server/migrations/**                                                 — przedzial nieprzydzielony
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6375 | `lsof -nP -iTCP:6375 -sTCP:LISTEN` → puste (sprawdzone przy pisaniu instrukcji) |
| Port harnessu | 5515 | `lsof -nP -iTCP:5515 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day339-pg` | `docker ps --format '{{.Names}}' \| grep cx-day339` → brak |
| Nazwa bazy | `cx339` | n/d |
| **Przedział migracji** | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | n/d |
| Gałąź | `codex/day339-silnik-raportu-wybor-20260904` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day339-silnik-raportu-wybor` | nie istnieje |
| Flagi funkcyjne | **ŻADNE** — dyżur nie zakłada flagi i nie zmienia żadnej domyślnej | `git diff --name-only` nie może zawierać `.env*`, `docker-compose*`, `railway*` |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day339-silnik-raportu-wybor
git diff --name-only --cached | tee /private/tmp/cx-day339-silnik-raportu-wybor-artefakty/staged.txt
grep -iE 'method-core\.routes|assessment-reports\.routes|assessmentDrdReportSchemaService|assessmentReportContractService|drdReportGenerator|drdReportService|drdReportGrounding|acceptedDrdReportModel\.ts|methodSessionReportMetadataService\.ts|docs/program/prototypy/|components/Initiatives/|layouts/MainLayout|components/AIChat/|server/migrations/|\.env|docker-compose|railway' \
  /private/tmp/cx-day339-silnik-raportu-wybor-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"
```

---

## R1 — INWENTARZ SILNIKÓW I ICH WOŁACZY

Tabela w rejestrze: **silnik · plik:linia · trasa · konsument we froncie · czy komponent jest
osiągalny od korzenia produktu**.

★ **Ostatnia kolumna jest najważniejsza i najczęściej pomijana.** „Wołacz istnieje” to nie to samo,
co „komponent się renderuje”. Warstw jest cztery: trasa istnieje → serwis ją obsługuje → front ma
wołacza → **komponent z tym wołaczem jest naprawdę montowany na ekranie, do którego użytkownik
dojdzie**. Dowodem czwartej warstwy jest **łańcuch importów od korzenia** (`src/index.tsx` → `src/App.tsx` →
`src/routes/AppRoutes.tsx` — sprawdź nazwy sam, `src/main.tsx` w tym repo NIE ISTNIEJE), nie sam `grep` po nazwie funkcji.

W tej pozycji zapisujesz też **sprostowanie nazwy `AssessmentReportDocxDownload`** — z komendą
i wynikiem.

Prawo zatrzymania po tej pozycji.

## R2 — JEDNA REALNA SESJA OCENY NA WŁASNEJ BAZIE

**To jest rdzeń: bez wspólnej sesji porównanie silników jest bezwartościowe.**

Sesja ma powstać przez **realny łańcuch** (`Z21`, `Z22`, `Z34`): realne żądanie HTTP →
`ApiGateway.getInstance().initializeRoutes(app)` → `verifyToken` z podpisanym JWT → trasa → handler
→ zapytanie → **wiersz w Twojej bazie** → odczyt, który ten wiersz podnosi. Test wstrzykujący
zależności albo montujący router w gołym `express()` **nie dowodzi niczego**.

Zapisujesz: identyfikator sesji, identyfikator organizacji, liczbę odpowiedzi, liczbę zdarzeń
dowodowych i **kod odpowiedzi HTTP przy każdym kroku** — nie samo „udało się”.

Jeżeli sesji nie da się założyć przez realną trasę (bo trasy nie ma albo wymaga danych, których nie
da się wytworzyć) — **napisz to wprost jako wynik**, wskaż brakujące ogniwo z dowodem plik:linia
i przejdź do `R3` na tym, co masz. To jest pełnowartościowy wynik, nie porażka.

Prawo zatrzymania po tej pozycji.

## R3 — RAPORT Z KAŻDEGO ŻYWEGO SILNIKA DLA TEJ SAMEJ SESJI

Dla każdego silnika z `R1`: uruchom, zapisz plik wynikowy do katalogu artefaktów, policz
`shasum -a 256`, zanotuj liczbę stron i **czas generowania mierzony zegarem**, nie szacowany.

**Silnik, którego nie da się uruchomić, ma to zapisane wprost — z komunikatem błędu, dosłownie.**
To jest wynik pomiaru, nie brak wyniku. „Nie zmierzyłem, bo…” z konkretnym powodem jest jedną
z trzech najcenniejszych rzeczy, jakie możesz oddać.

★ **Silnik 298 (`buildAcceptedDrdReportModel`) nie ma trasy.** Uruchamiasz go **z poziomu testu
albo skryptu pomiarowego**, na modelu zbudowanym z Twojej realnej sesji — **bez dopinania go do
trasy** (`Z40`). To jest dozwolone i jawnie zamówione.

Prawo zatrzymania po tej pozycji.

## R4 — ZESTAWIENIE OBOK SIEBIE: PLIK DO OBEJRZENIA

**Nadzorca ma otworzyć jeden dokument i zobaczyć, co dostanie klient z każdego silnika.**

Wymagania:

- strony każdego silnika stoją **obok odpowiadających stron prototypu**;
- pięć pytań z sekcji „Co ten dyżur ma zrobić” odpowiedziane **per silnik**, jednym zdaniem każde;
- gniazda niewypełnione **nazwane imiennie** — nie „są braki”, tylko które pola i na której stronie;
- każdy plik ma `shasum -a 256`, a Ty **otworzyłeś go własnymi oczami** i opisałeś z nazwy;
- **para stron bajtowo identyczna nie jest dowodem** — chyba że identyczność jest właśnie tezą
  (silnik 298 vs prototyp): wtedy dowodem są liczby, nie obraz, i musisz je podać.

Jeżeli do złożenia zestawienia potrzebujesz zrzutów — używasz **kanonicznego**
`scripts/dev/grafika-zrzuty.mjs`. **Zakaz pisania własnego skryptu zrzutowego obok kanonicznego**;
brakującą zdolność dokładasz do niego addytywnie i opt-in.

Prawo zatrzymania po tej pozycji.

## R5 — NARRATOR LLM: CO REALNIE DOPISUJE DO RAPORTU

**`DEC-390`: narrator LLM ZOSTAJE włączony.** Właściciel zdecydował świadomie. **Nie dodajesz
flagi, nie wyłączasz go, nie zmieniasz jego wartości domyślnej** (`Z40`).

Zadaniem tej pozycji jest **zmierzyć i zapisać, co narrator realnie dopisuje do raportu** — żeby
było wiadomo, co idzie do klienta.

**★ Rozstrzygnięcie sprzeczności z `Z15` („zero modelu językowego w tym dyżurze”):** oba wymagania
obowiązują i nie kolidują, bo pomiar robisz **bez ani jednego wywołania modelu**:

1. **Statycznie:** przeczytaj `drdLlmNarrator` i moduły `drdReportGrounding` / `drdConclusionContract`
   i wypisz tabelę **pole/sekcja raportu · czy narrator ją nadpisuje · plik:linia · co konkretnie
   wstawia (prompt, szablon, ograniczenia)**.
2. **Wykonawczo, bez klucza:** przebieg silnika HTML z `R3` biegnie w środowisku **bez ani jednego
   klucza dostawcy** (`Z40`). Zapisz, **co robi narrator, gdy klucza nie ma** — czy fail-safe
   oddaje wersję deterministyczną, czy wysypuje raport, czy zostawia puste gniazdo. To jest realne
   zachowanie produkcyjne przy awarii dostawcy i nikt go dotąd nie zmierzył.
3. **Zapisz jednym zdaniem, co klient dostanie, gdy klucz JEST** — na podstawie punktu 1, oznaczone
   jako **twierdzenie niezweryfikowane**, w sekcji do tego przeznaczonej.

**Nie ustawiasz żadnego klucza dostawcy. Nie wołasz `llmService` ani `/api/ai/**`.**

Prawo zatrzymania po tej pozycji.

## R6 — METADANE RAPORTU: `WHERE EXISTS` I BRAK WOŁACZY

`server/src/services/report/methodSessionReportMetadataService.ts` ma w metodzie `save`
`WHERE EXISTS (SELECT 1 FROM method_sessions WHERE id = ? AND organization_id = ?)` **w samym
zapisie**, przed `ON CONFLICT`. **Poprzedni STOP na tym module był ZASADNY, a premisa poprzedniej
instrukcji błędna. Nie powtarzaj tamtego błędu:** najpierw przeczytaj zapytanie i podaj **swoje**
numery linii, dopiero potem twierdź cokolwiek o dziurze dzierżawcy.

Odpowiedz na trzy pytania, każde z dowodem:

1. **Co realnie chroni ten `WHERE EXISTS`, a czego nie chroni?** (Pamiętaj: atrapa bazy potrafi
   zwrócić `changes: 1` dla każdego `UPDATE` niezależnie od `WHERE` — dowód zapisu warunkowego robi
   się **wyłącznie na realnym PostgreSQL**.)
2. **Czy istnieje trasa, która ten zapis w ogóle wywołuje?** Jeżeli nie — to jest **dług
   integracyjny**, i tak to nazwij.
3. **Czy `get` po `save` jest jedynym potwierdzeniem?** Jeżeli tak, opisz, co się stanie przy
   równoległym zapisie z innej organizacji.

**Nie podłączasz serwisu.** Produktem jest pomiar + brief + ewentualny gotowy diff nienałożony.

Prawo zatrzymania po tej pozycji.

## R7 — REKOMENDACJA DLA NADZORCY

Jedno zdanie werdyktu **na silnik**, jedno zdanie rekomendacji, i **jawna lista tego, czego nie
zmierzyłeś**.

Rekomendacja **nie jest wykonywana w tym dyżurze**. Nadzorca podejmie decyzję po Twoim raporcie
(`DEC-389`). Jeżeli uważasz, że rekomendacja jest oczywista — tym bardziej jej nie wykonuj; napisz,
dlaczego jest oczywista, i zostaw decyzję.

## R8 — RAPORT

Struktura `§R.2`. Obowiązkowo: tabela silników z `R1` z kolumną osiągalności; identyfikator sesji
z `R2` z kodami odpowiedzi HTTP; ścieżki i sumy kontrolne wszystkich plików z `R3`; ścieżka
zestawienia z `R4` z odpowiedziami na pięć pytań; tabela narratora z `R5` wraz z zachowaniem bez
klucza; trzy odpowiedzi z `R6`; rekomendacja z `R7`; sekcja **TWIERDZENIA NIEZWERYFIKOWANE**
niepusta — i **musi** zawierać zdanie o zachowaniu narratora przy obecnym kluczu dostawcy.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobione, R2 zrobione, R3 zrobione dla dwóch z trzech
silników (trzeci opisany z komunikatem błędu), R4 rozpoczęte” jest pełnowartościowym wynikiem.

**Odwrotna kolejność — inwentarze (R1/R6) zrobione, rdzeń (R2/R3/R4) „częściowo” — jest podstawą
odrzucenia.**

**Ten dyżur kończy się bez podłączenia i bez wygaszenia czegokolwiek.** Jeżeli w raporcie
znajdzie się nowy wołacz silnika albo odmontowana trasa — pozycja jest odrzucona, niezależnie od
jakości pomiaru.

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela niżej | TAK |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na worktree z markera; zero `BRAK` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, osiem wierszy |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — każdy wiersz „tylko odczyt” ma rzeczownik-produkt (kontrakt · diff · brief · pomiar · wpis) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4; dyżur z założenia nie zmienia kodu silników |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (334-338, 340) | TAK — `B.4.4`; porty 5515/6375 zmierzone jako wolne, kontener nie istnieje |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK |
| 8 | Pułapki środowiska w całości + pułapka właściwa temu modułowi | TAK |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru” bez ścieżki | TAK |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK |

### AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| Zakaz `Z15` „zero modelu językowego w tym dyżurze” **vs** `DEC-390` „narrator LLM zostaje włączony” | `R5` — narrator **nie jest** wyłączany w produkcie ani osłaniany flagą; pomiar jest **statyczny plus przebieg bez klucza dostawcy**, więc ani jedno wywołanie modelu nie następuje |
| Zakaz `Z23` „zero atrap” **vs** przebieg narratora bez klucza | `R5` punkt 2 — brak klucza to **realny warunek produkcyjny**, a nie atrapa; mierzysz zachowanie fail-safe i tak je nazywasz |
| „Zmierz każdy silnik” **vs** `Z40` „zakaz podłączania” (silnik 298 nie ma trasy) | `R3` — silnik bez trasy uruchamiasz z poziomu testu albo skryptu pomiarowego, **bez dopinania go do trasy**; to jest jawnie dozwolone |
| Zakaz `Z13` „dokładnie JEDEN nowy dokument” **vs** `R4` produkuje zestawienie, a `R3` skrypt | `Z13` (pole „jedyny inny dokument”) + `B.1` — raport i jeden zastany rejestr są jedynymi DOKUMENTAMI; zestawienie i pliki wynikowe to **dowody w `evidence/`**, a skrypt to **kod**, nie dokument rejestrowy |
| Zakaz `Z19` „nie odmontowujesz routera” **vs** rekomendacja może brzmieć „wygaś silnik” | `R7` — rekomendacja jest **tekstem dla nadzorcy**, nie działaniem; dyżur nie wykonuje własnej rekomendacji |
| Zakaz `Z30` „zero wysyłki” **vs** `R3` uruchamia pełny łańcuch generowania raportu | `§0.2b` — dowody (a) i (b) przed pierwszym przebiegiem zapisującym; generowanie raportu nie tworzy wiadomości ani powiadomienia, a deklaracja obowiązkowa idzie do raportu dosłownie |
| Zlecenie: „`methodSessionReportMetadataService.ts:72-88`” **vs** mój odczyt: ok. 78-88 | Sekcja „★ Sprostowanie zlecenia” punkt 3 i `R6` — podajesz **swoje** numery |
| Zlecenie: „`AssessmentReportDocxDownload` — konsument w `src/`” **vs** mój `grep`: 0 trafień poza testem | Sekcja „★ Sprostowanie zlecenia” punkt 1, `B.3` wiersz 4 i `R1` |
