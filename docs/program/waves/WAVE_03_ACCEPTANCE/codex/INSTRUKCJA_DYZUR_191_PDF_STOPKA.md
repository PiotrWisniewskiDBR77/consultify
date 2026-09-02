# INSTRUKCJA DYŻURU nr 191 — Codex — „Renderer PDF — paginacja stopki produkuje strony-śmieci (6 z 9 stron w dowodzie 187), naprawa w `drawHeaderFooter` + regresja obu konsumentów (Audyty, Materiały)"

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
> **wyłącznie** `/private/tmp/cx-day191-pdf-stopka`.

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
Zakres: **Document Studio — silnik renderowania PDF (`documentPdfRenderer.ts`), współdzielony przez Audyty (12_AUDITS) i Materiały (Document Studio); dyżur techniczny, przekrojowy, nie odbiór wizualny jednego modułu**.
Trasy front: `brak — ten dyżur nie dotyka żadnego pliku `src/**`. Naprawa jest wyłącznie w rendererze backendu; oba UI-konsumenty (przycisk „Pobierz PDF” w `AuditReportDocumentView.tsx`/`AuditReportsTab.tsx` z FIX-187, i eksport z `DocumentStudioView.tsx`/`DocumentStudioDocumentPanel.tsx` w Materiałach) zostają nietknięte i automatycznie skorzystają z naprawy przez wspólny renderer`. Trasy tył: ``server/src/services/documentStudio/documentPdfRenderer.ts` — funkcja `drawHeaderFooter` (deklaracja ok. linii 1052-1129) i pętla stemplowania w `renderDocumentSchemaToPdfBuffer` (`doc.bufferedPageRange()`/`switchToPage`/wywołanie `drawHeaderFooter` — dziś ok. linii 1187-1191, ZWERYFIKUJ SAM przed edycją, numeracja przesuwa się). Konsument 1: `GET /api/audits/reports/:id/export.pdf` (`server/src/routes/audits/reports.routes.ts:123-150`, wołanie `renderDocumentSchemaToPdfBuffer` linia 135). Konsument 2: `GET /api/document-studio/:artifactId/export/:format` (`server/src/routes/document-studio.routes.ts`, handler ok. linii 4888-4918) → `exportDocumentArtifact` (`documentStudioService.ts:1378`, wywołanie renderera ok. linii 1610-1613), montowana w `server/src/Gateway.ts` (ok. linii 1048-1054, `gatewayVerifyToken, betaGate, highRiskSurfaceGuard`) — to trasa Materiałów (`DocumentStudioView.tsx`)`.

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
WT=/private/tmp/cx-day191-pdf-stopka
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
git -C "$VAULT" worktree add "$WT" -b codex/day191-pdf-stopka-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day191-pdf-stopka/config.worktree"
cat "$VAULT/worktrees/cx-day191-pdf-stopka/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day191-pdf-stopka-scratch
mkdir -p /private/tmp/cx-day191-pdf-stopka-artefakty

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
git -C "$WT" push github-backup codex/day191-pdf-stopka-20260831
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
cd /private/tmp/cx-day191-pdf-stopka

# (T1) DOKŁADNY MECHANIZM I NUMERACJA LINII DZIŚ — brief cytuje 1141-1150, ZWERYFIKUJ, nie ufaj
grep -n "bufferedPageRange\|switchToPage\|drawHeaderFooter(doc" server/src/services/documentStudio/documentPdfRenderer.ts
sed -n '1052,1129p' server/src/services/documentStudio/documentPdfRenderer.ts
#   oczekiwane: funkcja `drawHeaderFooter` rysuje `.text()` dla etykiety poufności i numeracji
#   strony przy `footerY = doc.page.height - 34`; pętla stemplowania (`bufferedPageRange`) jest
#   w INNEJ okolicy linii niż podane w briefie 187 — zanotuj realny numer w raporcie.

# (T2) ŻADEN ISTNIEJĄCY TEST NIE LICZY STRON — to dlatego bug przeszedł niezauważony
grep -n "footers:\|pageNumbering\|confidentialityLabel\|getInfo\|numpages\|pages" server/src/services/documentStudio/__tests__/documentPdfRendererParity.test.ts
#   oczekiwane: `footers: { enabled: true, pageNumbering: true, confidentialityLabel: true }` w
#   `makeFormattingSchema` (domyślny schemat testu!), ale `getInfo()` użyte raz, wyłącznie po
#   `Subject` — zero asercji liczby stron mimo że test od zawsze wykonuje ścieżkę z bugiem.

# (T3) DWAJ KONSUMENCI TEGO SAMEGO RENDERERA
grep -n "renderDocumentSchemaToPdfBuffer" server/src/routes/audits/reports.routes.ts server/src/services/documentStudio/documentStudioService.ts
grep -n "documentStudioRoutes\|'/api/document-studio'" server/src/Gateway.ts
#   oczekiwane: audyty wołają renderer BEZPOŚREDNIO w trasie (`reports.routes.ts`); Materiały przez
#   `exportDocumentArtifact` (`documentStudioService.ts`), montowane w Gateway z `gatewayVerifyToken,
#   betaGate, highRiskSurfaceGuard`. Oba mają identyczny sygnał wejścia (`DocumentSchema`).

# (T4) PDFKIT — WERSJA I BRAK ISTNIEJĄCEGO OBEJŚCIA W REPO
grep -n '"pdfkit"' package.json server/package.json
grep -rn "margins.bottom = 0\|lineBreak: false" server/src/services/documentStudio/*.ts
#   oczekiwane: `pdfkit ^0.17.2`; zero istniejącego wzorca „wyzeruj margines na czas stopki” w
#   repo — to typowa, znana pułapka pdfkit, ale NIKT jej tu jeszcze nie rozwiązał, doczytaj
#   mechanizm w `node_modules/pdfkit` przed napisaniem fixu.

# (T5) REGRESJA OBU KONSUMENTÓW DZIŚ NIE ISTNIEJE — Twój punkt odniesienia przed naprawą
grep -n "getInfo\|pages\|Content-Length" server/src/routes/audits/__tests__/day187.reportExportPdf.pg.test.ts
grep -n "'pdf'" server/src/services/documentStudio/__tests__/documentStudioExportQaGate.test.ts | head -5
#   oczekiwane: żaden z dwóch testów nie liczy stron ani nie sprawdza braku stron-śmieci — oba
#   dziś przechodzą MIMO buga, bo o niego nie pytają. Rozszerzysz oba w R3.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day191-pdf-stopka-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6111`. Twój JEDYNY port harnessu to `5054 i 5055`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day191-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6110, 5010-5053, 6404-6411 (odbiory nadzorcy i wcześniejsze dyżury). ★ WZAJEMNIE z dyżurem 192 (równoległym, ten sam silnik Document Studio, ale ZERO wspólnych plików zapisu — patrz §4 rozłączność): 6112/5056-5057. Zajęte też: 6108-6109-6113/5048-5051-5058-5059. Twoje własne to WYŁĄCZNIE 6111 i 5054/5055. ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 zajęty przez adb — nie używaj`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartości domyślnej żadnej istniejącej. Naprawa jest bezwarunkowa (bug dotyczy każdego PDF-a z włączoną stopką, nie ma sensu chować go za flagą)`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY191_PDF_STOPKA_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — to naprawa silnika przekrojowego (Document Studio), nie odbiór wizualny pojedynczego modułu (12_AUDITS czy Materiałów). **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day191-pdf-stopka-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day191-pdf-stopka-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **Plik był imiennie nietykalny w dyżurach 185/187 — teraz jest licencjonowany do zapisu TYLKO w obrębie mechanizmu stopki/paginacji.** Zapis ograniczony do `drawHeaderFooter` i pętli stemplowania (`doc.bufferedPageRange()`/`switchToPage`) w `renderDocumentSchemaToPdfBuffer`. **Zero zmian w `drawCover`, `drawSection`, `drawNotesAppendix`, `drawSources`, `buildPdfRenderContext`, `pruneUnrenderableBlocks`, `partitionSections`, `formatBodyHeading`/`formatAppendixHeading`** ani w jakiejkolwiek funkcji odpowiadającej za TREŚĆ lub STYL bloków — to jest naprawa mechanizmu paginacji, nie redesign renderera. **Zero zmian w `documentDocxRenderer.ts`** (bliźniak DOCX — inny format, inny mechanizm, poza zakresem). **Zero zmian w `server/src/routes/audits/reports.routes.ts` ani `documentStudioService.ts`/`document-studio.routes.ts`** — konsumenci wołają renderer bez zmian, naprawa jest w jednym miejscu i automatycznie obejmuje oba. **Zero nowej flagi.** **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | Zastrzeżenie 2 z `docs/program/funkcje/ODBIOR_187_AUDYTY_PDF.md` (odbiór backendu eksportu PDF Audytów, SCALONO): „★ ODZIEDZICZONY defekt renderera PDF, ujawniony przez odbiór: 6 z 9 stron pliku to śmieci paginacji (naprzemiennie «restricted» i «N/3») — podejrzenie: `documentPdfRenderer.ts:1141-1150` stempluje stopkę po `bufferedPageRange()` i dokłada strony. Dotyczy WSZYSTKICH PDF-ów (też Materiałów). → dyżur 191”. Weryfikacja dzisiejsza (SHA `b4651675f6`) potwierdza mechanizm, ale NIE dokładne linie z zastrzeżenia (przesunięte — realny kod jest w `drawHeaderFooter`, ok. linii 1052-1129, wołana z pętli ok. linii 1187-1191): funkcja rysuje etykietę poufności i numerację strony przez `.text(..., margins.left, footerY, ...)` z `footerY = doc.page.height - 34`, czyli WEWNĄTRZ obszaru pod `page.margins.bottom` (dla A4 z marginesem 2 cm ≈ 57 pt to ok. 23 pt poniżej `page.maxY()`). pdfkit domyślnie sprawdza, czy zapis tekstu mieści się w `page.maxY()` i — jeśli nie — wywołuje niezamierzony `doc.addPage()` PRZED zapisaniem tekstu, zamiast pisać poza marginesem tak jak zamierzono. Dwa wywołania `.text()` na wpis stopki (etykieta poufności + numeracja) mogą więc wygenerować do dwóch stron-śmieci NA KAŻDĄ oryginalną stronę — co dokładnie zgadza się z dowodem 187 (3 strony realnej treści × 2 = 6 stron-śmieci, razem 9). Żaden istniejący test tego nie łapie: `documentPdfRendererParity.test.ts` buduje schemat z `footers.pageNumbering=true`/`confidentialityLabel=true`, ale liczy strony ZERO razy (`parser.getInfo()` użyte raz, wyłącznie do metadanych `Subject`); `day187.reportExportPdf.pg.test.ts` (HTTP, realny Gateway+PG) sprawdza `Content-Type`/treść tekstową, też nie liczbę stron. |

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
cd /private/tmp/cx-day191-pdf-stopka

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day191-pg psql -U postgres -d cx191 \
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
cd /private/tmp/cx-day191-pdf-stopka

docker run -d --name cx-day191-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx191 \
  -p 127.0.0.1:6111:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day191-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6111/cx191 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6111/cx191 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day191-pdf-stopka && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6111/cx191 \
JWT_SECRET=cx191-test-secret-do-not-reuse \
npx vitest run server/src/services/documentStudio/__tests__ server/src/routes/audits/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day191-pdf-stopka-artefakty/day191-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day191-pdf-stopka && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/documentStudio/__tests__ server/src/routes/audits/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day191-pdf-stopka-artefakty/day191-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day191-pdf-stopka/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day191-pg psql -U postgres -d cx191 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day191-pg`.
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
> **(e) ★★ **Pierwsza: linie z zastrzeżenia 187 (`1141-1150`) są PODEJRZENIEM DO ZWERYFIKOWANIA, nie faktem — brief mówi to wprost.** Realny kod dziś (T1) ma pętlę stemplowania i deklarację `drawHeaderFooter` w innej okolicy; nie kopiuj numerów z zastrzeżenia do raportu bez własnego `grep`/`sed`. ★★ **Druga, mechanizm dokładny: `footerY = doc.page.height - 34` leży POZA `page.maxY()` (`page.height - margins.bottom`) dla każdego marginesu dolnego większego niż 34 pt — a domyślny margines w tym repo to 2 cm ≈ 57 pt (patrz `marginsInPoints`, `POINTS_PER_CM`).** pdfkit sprawdza to przy KAŻDYM `.text()` i, jeśli przekroczone, wywołuje `doc.addPage()` PRZED zapisaniem tekstu zamiast po prostu pisać w marginesie (którym stopka z zamierzenia jest). Dwa wywołania `.text()` w `drawHeaderFooter` (etykieta poufności, numeracja strony) mogą więc dodać do DWÓCH stron-śmieci na każdą oryginalną stronę pętli — to tłumaczy dokładnie „6 z 9” i naprzemienność „restricted”/„N/3” z dowodu 187 (jedna strona-śmieć na wywołanie, nie jedna na całą stopkę). Typowy, znany wzorzec naprawy pdfkit: tymczasowo wyzerować `doc.page.margins.bottom` (zapamiętać, wyzerować, narysować stopkę, przywrócić) na czas DOKŁADNIE tych dwóch wywołań `.text()` — ale ZWERYFIKUJ SAM w źródłach `pdfkit` 0.17.2 (nie w pamięci/dokumentacji ogólnej), czy to jedyny/najlepszy mechanizm w tej wersji, zanim go zastosujesz; jeśli znajdziesz inny, poprawny sposób (np. opcja per-wywołanie), użyj go i opisz wybór w raporcie. ★★ **Trzecia: `bufferedPageRange()` jest wołane RAZ, przed pętlą — `range.count` (czyli `totalPages` przekazywane do `drawHeaderFooter`) jest liczbą stron SPRZED naprawy pętli stemplowania.** Jeśli Twoja naprawa nadal (przypadkiem) dodaje choć jedną stronę wewnątrz pętli, `totalPages` w numeracji „N / M” będzie kłamać (M za małe) nawet gdy strony-śmieci znikną z treści — sprawdź to osobno w dowodzie R2, nie tylko liczbę stron całkowitą. ★★ **Czwarta: żaden istniejący test nie łapie tego buga (T2/T5)** — Twoja reprodukcja (R1) MUSI pokazać czerwony wynik PRZED naprawą (liczba stron większa niż oczekiwana dla znanego schematu 2-3 sekcji), inaczej nie masz dowodu regresji. ★★ **Piąta: dwaj konsumenci mają różne testy referencyjne** — `day187.reportExportPdf.pg.test.ts` (Audyty, realny PG+Gateway) i `documentStudioExportQaGate.test.ts` (Materiały, wywołanie `exportDocumentArtifact(..., 'pdf')` bezpośrednio na serwisie) — rozszerz OBA, nie tylko jeden; jeden bez drugiego to niepełna regresja dla „dotyczy WSZYSTKICH PDF-ów” z zastrzeżenia 187.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day191-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day191-pdf-stopka-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — reprodukcja czerwona PRZED naprawą (liczba stron za duża, strony-śmieci istnieją), R2 — naprawa w `drawHeaderFooter`/pętli stemplowania, bez zmiany treści/stylu bloków`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6111` albo `5054 i 5055` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6111` albo `5054 i 5055`** (`Z7`).

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

Zastrzeżenie 2 z odbioru 187 (`docs/program/funkcje/ODBIOR_187_AUDYTY_PDF.md`, „ODBIÓR 187 —
Audyty: eksport PDF · SCALONO (backend) · D-3 DOMKNIĘTE"):

> ★ **ODZIEDZICZONY defekt renderera PDF, ujawniony przez odbiór:** 6 z 9 stron pliku to śmieci
> paginacji (naprzemiennie „restricted" i „N/3") — podejrzenie: `documentPdfRenderer.ts:1141-1150`
> stempluje stopkę po `bufferedPageRange()` i dokłada strony. **Dotyczy WSZYSTKICH PDF-ów (też
> Materiałów).** → dyżur 191.

Odbiór 187 sam ocenił trasę Audytów wysoko (trasa 9/10, reużycie 10/10) właśnie DLATEGO, że `.pdf`
jest strukturalnym bliźniakiem `.docx` — ten sam schemat, ten sam renderer współdzielony z
Materiałami. To zaleta reużycia i jego koszt naraz: defekt w jednym miejscu (renderer) dotyka
KAŻDEGO PDF-a wytwarzanego przez Document Studio, nie tylko audytów.

Weryfikacja dzisiejsza (SHA `b4651675f6`) potwierdza mechanizm zastrzeżenia, ale **nie dokładne
linie** — numeracja przesunęła się od czasu, gdy pisano zastrzeżenie. Realny kod dziś:

```ts
// server/src/services/documentStudio/documentPdfRenderer.ts — drawHeaderFooter (ok. linii 1052-1129)
if (formatting.footers.pageNumbering) {
  const numberingText = /* ... */ `${pageNumber} / ${totalPages}`;
  doc.save().fontSize(8).fillColor('#94A3B8').font(PDF_FONT.regular)
    .text(numberingText, margins.left, footerY, { align: 'right', width: /* ... */ })
    .restore();
}
```

```ts
// renderDocumentSchemaToPdfBuffer — pętla stemplowania (ok. linii 1187-1191, ZWERYFIKUJ numer sam)
const range = doc.bufferedPageRange();
const totalPages = range.count;
for (let i = 0; i < totalPages; i += 1) {
  doc.switchToPage(range.start + i);
  drawHeaderFooter(doc, schema, i + 1, totalPages);
}
```

`footerY = doc.page.height - 34` (ok. 24 pt od dołu strony). Domyślny margines dolny w tym
repo to 2 cm ≈ 57 pt (`marginsInPoints`, `POINTS_PER_CM`) — czyli `footerY` leży **poza**
`page.maxY()` (`page.height - margins.bottom`), o mniej więcej 23 pt. pdfkit sprawdza to przy
KAŻDYM `.text()`: jeśli zapis nie mieści się w `maxY()`, wywołuje `doc.addPage()` **przed**
zapisaniem tekstu, zamiast po prostu napisać w marginesie — tam, gdzie stopka z zamierzenia ma
być. `drawHeaderFooter` robi dwa takie wywołania `.text()` na wpis stopki (etykieta poufności,
numeracja strony) — każde z nich osobno może dołożyć stronę-śmieć. To tłumaczy dokładnie
proporcję z dowodu 187: 3 strony realnej treści × 2 wywołania `.text()` w pętli = 6 stron-śmieci,
razem 9; i naprzemienność „restricted"/„N/3" — jedna strona-śmieć na jedno wywołanie, nie jedna
zbiorcza strona na całą stopkę.

**Znalezisko ponad brief:** żaden istniejący test tego nie łapie. `documentPdfRendererParity.test.ts`
buduje domyślny schemat testu z `footers: { enabled: true, pageNumbering: true,
confidentialityLabel: true }` — czyli od zawsze wykonuje dokładnie tę ścieżkę z bugiem — ale
`parser.getInfo()` jest użyte raz, wyłącznie żeby sprawdzić metadane `Subject`; zero asercji
liczby stron. `day187.reportExportPdf.pg.test.ts` (HTTP, realny Gateway + PostgreSQL) sprawdza
`Content-Type`, długość bufora i obecność tekstu — też nie liczbę stron. Oba testy dziś przechodzą
MIMO buga, bo o niego nie pytają.

# 2. TEZY ZLECENIA

- **T1.** Linie `1141-1150` z zastrzeżenia 187 są PODEJRZENIEM DO ZWERYFIKOWANIA, nie faktem —
  brief mówi to wprost słowem „(zweryfikuj!)". Ustal realne linie dziś i użyj ich w raporcie, nie
  numerów z zastrzeżenia.
- **T2.** Mechanizm to nie „stemplowanie po `bufferedPageRange()`" samo w sobie (to poprawny,
  standardowy wzorzec pdfkit dla stopek na buforowanych stronach) — problem jest w tym, że
  `.text()` wywołane przy `footerY` leżącym poza `page.maxY()` domyślnie wywołuje `addPage()`.
  Potwierdź to jako przyczynę źródłową przed napisaniem naprawy, nie tylko powtórz cytat z 187.
- **T3.** Naprawa dotyczy WYŁĄCZNIE mechanizmu paginacji/stopki (`drawHeaderFooter` + pętla
  stemplowania) — treść i styl bloków (nagłówki, tabele, wykresy, przypisy, TOC) są poza zakresem
  i poza licencją tego dyżuru, zgodnie z zastrzeżeniem nietykalności imiennej z 185/187 zdjętym
  TYLKO w tym wąskim obszarze.
- **T4.** Dwaj konsumenci (Audyty: `reports.routes.ts` wołający renderer bezpośrednio; Materiały:
  `documentStudioService.ts`/`exportDocumentArtifact` przez trasę `document-studio.routes.ts`)
  używają dokładnie tego samego renderera na dokładnie tym samym kontrakcie `DocumentSchema` — Twój
  dowód mutacyjny i regresja muszą pokryć OBA, nie tylko ten, przez który defekt został odkryty
  (Audyty).

# 3. POZYCJE DYŻURU

## R1 — reprodukcja minimalna (czerwona przed naprawą)

Napisz test (nowy plik `server/src/services/documentStudio/__tests__/day191.footerPagination.test.ts`
lub rozszerzenie `documentPdfRendererParity.test.ts` — wybierz sam, uzasadnij w raporcie) budujący
schemat z 2-3 sekcjami tekstowymi i stopką włączoną (`footers: { enabled: true, pageNumbering:
true, confidentialityLabel: true }` — dokładnie ten sam kształt co domyślny schemat testu parity,
żeby pokazać, że bug dotyka już testowanej ścieżki). Policz strony przez `pdf-parse`
(`parser.getInfo()`, wzorem istniejącego testu metadanych `Subject` w tym samym pliku) PRZED
naprawą kodu produktu — wynik ma pokazać liczbę stron WIĘKSZĄ niż liczba sekcji + ewentualna
okładka/TOC, potwierdzając strony-śmieci istnieją. To jest Twój dowód czerwony.

## R2 — naprawa w `drawHeaderFooter`/pętli stemplowania

Napraw wyłącznie mechanizm, który powoduje niezamierzony `addPage()` przy zapisie stopki blisko
dołu strony. Zweryfikuj SAM w źródłach `pdfkit` 0.17.2 (`node_modules/pdfkit`, nie z pamięci ani
dokumentacji ogólnej), jaki mechanizm w tej konkretnej wersji odpowiada za sprawdzanie
`page.maxY()` przy `.text()`, i wybierz najmniejszą poprawną interwencję — typowy, znany wzorzec
dla tej klasy błędu w pdfkit to tymczasowe zerowanie `doc.page.margins.bottom` na czas dokładnie
tych dwóch wywołań `.text()` w `drawHeaderFooter` (zapamiętaj wartość, wyzeruj, narysuj stopkę,
przywróć), ale to DO POTWIERDZENIA przez Ciebie, nie do skopiowania na ślepo — jeśli znajdziesz
inny, poprawniejszy sposób w tej wersji biblioteki, użyj go i uzasadnij wybór w raporcie.

Zero zmian poza `drawHeaderFooter` i pętlą stemplowania. Po naprawie sprawdź OSOBNO, że
`totalPages` (parametr `M` w „N / M") nadal odpowiada realnej liczbie stron — `bufferedPageRange()`
jest wołane RAZ, przed pętlą, więc jeśli naprawa przypadkiem nadal dokłada choćby jedną stronę
wewnątrz pętli, numeracja „N / M" będzie kłamać (M za małe) nawet gdy strony-śmieci znikną z
treści widocznej.

**Ukończone, gdy:** ten sam test z R1, uruchomiony PO naprawie, pokazuje liczbę stron dokładnie
zgodną z zawartością (bez stron-śmieci), a żadna strona nie składa się wyłącznie z etykiety
poufności lub samej numeracji.

## R3 — dowód mutacyjny i regresja na OBU konsumentach

Rozszerz **oba** istniejące testy referencyjne o asercję liczby stron / braku stron-śmieci —
nie twórz równoległych, osobnych testów tam, gdzie już istnieje test trasy:

1. **Audyty** — `server/src/routes/audits/__tests__/day187.reportExportPdf.pg.test.ts` (HTTP,
   realny Gateway + PostgreSQL, `RUN_DB_TESTS=1`). Dodaj asercję liczby stron zwróconego bufora
   dla `REPORT` (payload z jedną sekcją) i upewnij się, że żadna strona nie jest samą etykietą
   „restricted"/numeracją.
2. **Materiały** — `server/src/services/documentStudio/__tests__/documentStudioExportQaGate.test.ts`
   (wywołuje `exportDocumentArtifact(artifactId, orgId, 'pdf')` bezpośrednio na serwisie) — dodaj
   analogiczną asercję liczby stron dla istniejącego fixture tego pliku.

Dla obu: mutacja w obie strony (cofnij naprawę lokalnie, potwierdź że test czerwienieje z tą samą
przyczyną co R1; przywróć naprawę, potwierdź zielone). **Obejrzyj wynikowy PDF własnymi oczami**
(zostaw plik w `/private/tmp/cx-day191-pdf-stopka-artefakty`, otwórz go) i napisz w raporcie dosłownie, co widzisz na każdej
stronie — liczbę stron, czy któraś jest pusta/śmieciowa, czy numeracja „N / M" jest spójna z
realną liczbą stron.

**Ukończone, gdy:** oba testy referencyjne mają nową, przechodzącą asercję liczby stron; mutacja
pokazuje czerwony wynik bez naprawy; plik PDF z obu tras (Audyty i Materiały) obejrzany i opisany
w raporcie.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/services/documentStudio/documentPdfRenderer.ts` — wyłącznie funkcja `drawHeaderFooter` i pętla stemplowania (`doc.bufferedPageRange()`/`switchToPage`) w `renderDocumentSchemaToPdfBuffer`; zakaz zmian w każdej innej funkcji tego pliku |
| Zapis | `server/src/services/documentStudio/__tests__/day191.footerPagination.test.ts` (nowy) LUB rozszerzenie `documentPdfRendererParity.test.ts` — wybierz jedno, uzasadnij |
| Zapis | `server/src/routes/audits/__tests__/day187.reportExportPdf.pg.test.ts` — rozszerzenie o asercję liczby stron (regresja konsument 1) |
| Zapis | `server/src/services/documentStudio/__tests__/documentStudioExportQaGate.test.ts` — rozszerzenie o asercję liczby stron (regresja konsument 2) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY191_PDF_STOPKA_REPORT.md` |
| Odczyt | `server/src/routes/audits/reports.routes.ts` — konsument 1, kontekst wywołania renderera; nie zmieniasz |
| Odczyt | `server/src/services/documentStudio/documentStudioService.ts` — konsument 2 (`exportDocumentArtifact`); nie zmieniasz |
| Odczyt | `server/src/services/documentStudio/documentDocxRenderer.ts` — bliźniak DOCX, poza zakresem; nie zmieniasz |
| Odczyt | `docs/program/funkcje/ODBIOR_187_AUDYTY_PDF.md` — źródło zlecenia (zastrzeżenie 2); nie zmieniasz |

**Nietykalne imiennie:** `documentDocxRenderer.ts` (inny format, inny mechanizm); wszystkie
funkcje `documentPdfRenderer.ts` poza `drawHeaderFooter` i pętlą stemplowania (`drawCover`,
`drawSection`, `drawNotesAppendix`, `drawSources`, `buildPdfRenderContext`,
`pruneUnrenderableBlocks`, `partitionSections`, formatowanie nagłówków sekcji/aneksów); trasy
konsumentów (`reports.routes.ts`, `documentStudioService.ts`, `document-studio.routes.ts`).

★ **Rozłączność:** ten dyżur nie dotyka żadnego pliku `src/**` ani żadnej trasy poza samym
rendererem — konsumenci są tylko odczytywani, żeby potwierdzić kontrakt wejścia i napisać
regresję. Przed startem sprawdź samodzielnie (branże/worktree równoległe), czy jakiś inny dyżur w
toku modyfikuje `documentPdfRenderer.ts` — jeśli tak, STOP i zgłoś kolizję zamiast pracować
równolegle na tym samym pliku.

# 5. TWARDE ZASADY

- ★ **Licencja obejmuje wyłącznie mechanizm stopki/paginacji** — nie treść, nie styl bloków. Plik
  był imiennie nietykalny w 185/187; to zdjęcie nietykalności jest wąskie i celowe.
- **Nie zmieniasz `documentDocxRenderer.ts`.** Format DOCX ma inny mechanizm paginacji (Word, nie
  pdfkit) i nie jest dotknięty tym bugiem.
- **Reprodukcja PRZED naprawą jest obowiązkowa** (R1) — bez czerwonego wyniku nie masz dowodu, że
  naprawiłeś realny defekt, nie coś innego.
- **Regresja na OBU konsumentach jest obowiązkowa** (R3) — zastrzeżenie 187 mówi wprost „dotyczy
  WSZYSTKICH PDF-ów (też Materiałów)"; dowód tylko na Audytach jest niepełny.
- **Obejrzyj wynikowy PDF własnymi oczami** i opisz to w raporcie — sam zielony test liczący
  strony nie wystarcza, jeśli nie potwierdzisz wzrokiem, że treść jest tam, gdzie ma być.
- Pułapka ogólna programu: bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB — dowód dla
  konsumenta Audytów MUSI być na realnym PostgreSQL, przez pełny Gateway.
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0 w każdym wyniku.
- ★ Port **5000 jest zajęty na stałe przez macOS Control Center**; **5037 przez adb** — nie
  używaj ich do żadnego serwera pomocniczego.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wszystko lokalnie, na
  `cx-day191-pg`.
- Wymóg sekcji „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie końcowym — wypisz w niej wprost, jeśli
  nie zdążyłeś zweryfikować mechanizmu pdfkit w źródłach biblioteki (a oparłeś naprawę wyłącznie
  na analizie z tej instrukcji), albo jeśli regresja pokryła tylko jednego z dwóch konsumentów.
