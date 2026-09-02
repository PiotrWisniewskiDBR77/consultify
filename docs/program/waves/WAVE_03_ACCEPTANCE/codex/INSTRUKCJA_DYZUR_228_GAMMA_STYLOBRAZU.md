# INSTRUKCJA DYŻURU nr 228 — Codex — „Pole 'Styl obrazu' w motywie prezentacji doklejane do kazdego promptu generowania obrazu AI (Gamma: paleta nazwana slowami w poleceniu, nie obrobka po fakcie — GAMMA_G3_OBCHOD_MENU.md) + dwie bramki bezpieczenstwa OCR/twarz; jedyny wspolny punkt dyspozycji promptu to deckVisualsService.ts::generateImageVisual (~:599); deckImageResolverService.ts i iconSuggestionService.ts maja potwierdzone zero wolaczy — martwy kod, nie punkt zaczepienia"

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
> **wyłącznie** `/private/tmp/cx-day228-gamma-stylobrazu`.

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
Zakres: **Materialy / Prezentacje — generowanie obrazow AI do decka (deckVisualsService.ts) i pole stylu w motywie (presentation_templates)**.
Trasy front: ``src/components/Presentations/PresentationTemplateArchitectView.tsx` (nowe pole tekstowe 'Styl obrazu', dodatek analogiczny do istniejacych pol), `src/components/Presentations/wizard/types.ts` (`ImageStylePreset` :95-101, pole `imageStylePreset` :340 — juz istnieje, tylko do odczytu), `SetupStep.tsx` (:292-293), `ImageStyleSelector.tsx` (:27) — mechanizm presetu juz poprawny, nietykalny`. Trasy tył: ``server/src/services/ai/deckVisualsService.ts` — JEDYNY wspolny punkt dyspozycji `generateImageVisual` (~:599, dziala z `params.prompt` doslownie, wywoluje `generateWithOpenAI`~:222/`generateWithGemini`~:376/`generateWithReplicate`~:268 na liniach ~658/671/682); `generateCoverVisual` (~:738, prompt ~:773-781) i `generateBackgroundTextureVisual` (~:793, prompt ~:822-830) budujace prompt niezaleznie, `style` dzis wylacznie z `params.meta.template`; `server/src/routes/presentations.routes.ts` PUT handler (:1542-1606, wspolny z dyzurem 226 — koordynacja obowiazkowa); `server/src/services/presentationTemplateRuntimeService.ts::buildTemplateRuntimeFromRow` (:372-452, interfejs :174-195, wspolny z 226); `server/src/services/presentationGeneratorService.ts` (import `materializePlannedVisual` :16, wolania ~:2041,~:2058, `imageStylePreset` :2073); `server/src/services/organizationContext/ContextDocumentService.ts` (wzorzec OCR :1826-1991, NIETYKALNY, tylko do skopiowania)`.

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
WT=/private/tmp/cx-day228-gamma-stylobrazu
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
git -C "$VAULT" worktree add "$WT" -b codex/day228-gamma-stylobrazu-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day228-gamma-stylobrazu/config.worktree"
cat "$VAULT/worktrees/cx-day228-gamma-stylobrazu/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day228-gamma-stylobrazu-scratch
mkdir -p /private/tmp/cx-day228-gamma-stylobrazu-artefakty

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
git -C "$WT" push github-backup codex/day228-gamma-stylobrazu-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9fb7942a01..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `piec` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day228-gamma-stylobrazu

# (T1) POTWIERDZ JEDYNY PUNKT DYSPOZYCJI PROMPTU
sed -n '590,700p' server/src/services/ai/deckVisualsService.ts
#   oczekiwane: generateImageVisual wywoluje generateWithOpenAI/Gemini/Replicate z params.prompt doslownie, brak doklejania stylu.

# (T2) POTWIERDZ ZERO WOLACZY DLA DWOCH PLIKOW-KANDYDATOW
grep -rn "deckImageResolverService\|resolveDeckImages\|resolveImageBriefs" server/src --include='*.ts' | grep -v deckImageResolverService.ts
grep -rn "iconSuggestionService\|suggestIconFor\|suggestIconsForList" server/src --include='*.ts' | grep -v iconSuggestionService.ts
#   oczekiwane: oba grepy puste — potwierdzenie martwego kodu.

# (T3) POTWIERDZ ROZLACZENIE ImageStylePreset
sed -n '90,150p' src/components/Presentations/wizard/types.ts
grep -n "imageStylePreset\|meta.template" server/src/services/ai/deckVisualsService.ts
#   oczekiwane: ImageStylePreset istnieje w types.ts (6 wartosci), ale deckVisualsService.ts go nie czyta — prompt uzywa wylacznie meta.template.

# (T4) POTWIERDZ BRAK OCR/DETEKCJI TWARZY NA SCIEZCE OBRAZU DECKA
grep -rn "tesseract\|ocr" server/src/services/ai/deckVisualsService.ts
grep -rni "face.*detect\|rekognition\|faceapi" server/src --include='*.ts'
#   oczekiwane: pierwszy grep pusty (brak OCR w deckVisualsService.ts); drugi grep — same falszywe trafienia niezwiazane z twarzami.

# (T5) POTWIERDZ pptxgenjs 4.0.1 I ZERO GRADIENTU
grep '"version"' node_modules/pptxgenjs/package.json
grep -ril gradient node_modules/pptxgenjs | wc -l
#   oczekiwane: 4.0.1 / 0.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day228-gamma-stylobrazu-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6172`. Twój JEDYNY port harnessu to `5132 i 5133`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day228-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6169 (odbiory nadzorcy i dyzury wczesniejsze) oraz 5010-5127, 6404-6411 (rezerwacje), 6170/5128-5129 (226, rownolegly), 6171/5130-5131 (227, rownolegly). ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center, 5037 przez `adb`, 5060-5061 zajete. ZABRONIONE (dyzury 229-232): 6173-6175, 5134-5139`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `R1+R2+R3+R4 razem, jedna flaga `ENABLE_PRESENTATION_IMAGE_STYLE` (nowa, default false) — bramki bezpieczenstwa R4 NIE sa oddzielnie przelaczalne, dzialaja zawsze gdy flaga ON`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY228_GAMMA_STYLOBRAZU_REPORT.md`. Nie zmieniasz zadnego MODULE_ACCEPTANCE.md — ten dyzur jest naprawa/rozbudowa silnika generowania obrazow, nie odbiorem ekranu modulu Materialy. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day228-gamma-stylobrazu-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day228-gamma-stylobrazu-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE WOLASZ REALNEGO MODELU OBRAZOWEGO ANI WIZYJNEGO BEZ OSOBNEJ ZGODY.** Caly dowod R2/R3/R4b budujesz na atrapach/wstrzykniete detektory. Wyjatek: R4a (OCR) uzywa REALNEGO `tesseract.js` na REALNYCH fixture'ach — biblioteka lokalna, nie model, dozwolona i oczekiwana. **NIE BUDUJESZ NA MARTWYM KODZIE** — `deckImageResolverService.ts`/`iconSuggestionService.ts` maja potwierdzone zero wolaczy, nie sa punktem zaczepienia. **NIE ZMIENIASZ TAKSONOMII presetow** — reuzywasz szesc istniejacych (`corporate_photography` itd.), nie przepisujesz na piec nazw Gammy. **NIE BUDUJESZ osobnego pola zgody na ludzi na zdjeciu** — domyslnie odrzucasz kazda wykryta twarz niezaleznie od stylu. **NIE MODYFIKUJESZ `ContextDocumentService.ts`** — to jest wzorzec do skopiowania, nie plik do zmiany. | Obchod konta wlasciciela w Gammie (GAMMA_G3_OBCHOD_MENU.md, established 2026-09-01) rozstrzygnal mechanizm, ktory wczesniejszy pomiar (GAMMA_G1_OBRAZY.md) zostawil jako nieustalony: motyw Gammy ma pole 'Style prompt' z opisem 'these keywords will be appended to your prompts when generating AI images', a w motywie wlasciciela wpisane jest doslownie 'utilizing a gradient of fuchsia, pink, and royal blue'. Paleta jest nazwana slowami w poleceniu, nie ma obrobki po fakcie. Zmierzone na SHA 9fb7942a01: jedyny wspolny punkt dyspozycji promptu obrazu to generateImageVisual (deckVisualsService.ts ~:599) — dopisanie stylu tam obejmuje wszystkie trzy sciezki dostawcy naraz. Istnieje juz dzialajacy, ale ROZLACZONY mechanizm nazwanych stylow (ImageStylePreset, szesc wartosci, persystuje sie poprawnie do bazy przez wizard, ale nigdy nie dociera do deckVisualsService.ts) — trzeci martwy kanal tej fali, obok dwoch z dyzuru 226. Dwie bramki bezpieczenstwa (OCR, detekcja twarzy) sa wymagane przez sama dokumentacje Gammy, ktora przyznaje, ze modele obrazowe dodaja niechciany tekst mimo zakazu w poleceniu — negatywny prompt nie jest zabezpieczeniem. |

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
cd /private/tmp/cx-day228-gamma-stylobrazu

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day228-pg psql -U postgres -d cx228 \
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
cd /private/tmp/cx-day228-gamma-stylobrazu

docker run -d --name cx-day228-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx228 \
  -p 127.0.0.1:6172:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day228-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6172/cx228 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6172/cx228 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day228-gamma-stylobrazu && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6172/cx228 \
JWT_SECRET=cx228-test-secret-do-not-reuse \
npx vitest run server/src/services/ai/__tests__, server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day228-gamma-stylobrazu-artefakty/day228-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day228-gamma-stylobrazu && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/ai/__tests__, server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day228-gamma-stylobrazu-artefakty/day228-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day228-gamma-stylobrazu/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day228-pg psql -U postgres -d cx228 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day228-pg`.
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
> **(e) ★★ **Jedyny wspolny punkt dyspozycji promptu to `generateImageVisual` (~:599), NIE `generateCoverVisual`/`generateBackgroundTextureVisual` osobno.** Te dwie funkcje budujace prompt (~:738/~:793) wolaja `generateImageVisual` jako dyspozytora, ktory dzis przekazuje `params.prompt` DOSLOWNIE do trzech galezi dostawcy (`:658,:671-677,:682-688`) — doklejenie stylu W TYM JEDNYM MIEJSCU obejmuje wszystkie sciezki naraz, wlacznie z `materializePlannedVisual`. Doklejanie w trzech miejscach osobno to podwojna robota i gwarantowany rozjazd. **Druga: `deckImageResolverService.ts` i `iconSuggestionService.ts` maja POTWIERDZONE zero wolaczy** — niezaleznym grepem po nazwie pliku i po nazwach eksportowanych symboli. Zamowienie pytalo, czy to punkt zaczepienia czy martwy kod — pomiar rozstrzyga jednoznacznie: martwy kod. Nie buduj na nich. **Trzecia, najwazniejsza: JUZ ISTNIEJE dzialajacy mechanizm nazwanych stylow (`ImageStylePreset`, `wizard/types.ts:95-149`, szesc wartosci), ktory persystuje sie poprawnie do bazy przez kreator, ale NIGDY nie dociera do `deckVisualsService.ts`.** To jest INNY mechanizm niz 'pole w motywie' z zamowienia (jest per-generacja w kreatorze, nie per-motyw) — zbuduj OBA jako osobne pozycje (R1 dla motywu, R3 dla naprawy tego rozlaczenia), nie myl ich, i nie przepisuj istniejacej taksonomii na piec nazw Gammy — to jest swiadoma decyzja architektoniczna tej instrukcji. **Czwarta: KOORDYNACJA Z DYZUREM 226 JEST OBOWIAZKOWA** — oba dyzury pracuja w DOKLADNIE TYCH SAMYCH DWOCH PLIKACH (`presentations.routes.ts` PUT-handler linie ok. 1566-1589, `presentationTemplateRuntimeService.ts::buildTemplateRuntimeFromRow` :372-452 i interfejs :174-195). Sprawdz `git log`/`git blame` PRZED KAZDYM commitem w ktorymkolwiek z tych plikow — jesli 226 juz wyladowal, dopisz swoje pole do ISTNIEJACEGO warunku; jesli nie, dopisz WYLACZNIE swoje pole, zostawiajac `customTemplate` dla 226. **Piata: detekcji twarzy NIE MA zadnej lokalnej biblioteki w repo** (potwierdzone: zero trafien na face-detect/rekognition/faceapi) — jedyna droga to model wizyjny, ktorego NIE wolasz sam bez osobnej zgody; budujesz wstrzykiwalny interfejs i dowodzisz logiki decyzji atrapa.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day228-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day228-gamma-stylobrazu-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1+R2 (pole stylu w motywie + doklejanie do promptu w generateImageVisual) i R4 (dwie bramki bezpieczenstwa OCR/twarz) — bez R4 kazdy wygenerowany obraz moze niesc niechciany tekst lub twarz wbrew stylowi, bez ostrzezenia`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6172` albo `5132 i 5133` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6172` albo `5132 i 5133`** (`Z7`).

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

Obchód konta właściciela w Gammie (`docs/program/funkcje/GAMMA_G3_OBCHOD_MENU.md`) rozstrzygnął
mechanizm, którego wcześniejszy pomiar (`GAMMA_G1_OBRAZY.md §6`) zostawił jako „nieustalone":
motyw ma pole **„Style prompt"** z opisem wprost w interfejsie Gammy —

> *„these keywords will be appended to your prompts when generating AI images"*

— a w motywie właściciela wpisane jest dosłownie *„…utilizing a gradient of fuchsia, pink,
and royal blue…"*. **Paleta jest nazwana słowami w poleceniu. Nie ma obróbki po fakcie.** To
jest mechanizm, o który właściciel walczy najmocniej („obraz pasuje kolorem"), i jest to
**najtańsza rzecz o największym efekcie** w całym marzeniu (`GAMMA_G3_OBCHOD_MENU.md`,
sekcja „Co z tego bierzemy"). Ten dyżur ją buduje.

## ★★ Pomiar wykonany na SHA `9fb7942a0117aaf4001836f00bf8bbdc4e717669` — zweryfikuj sam

**(K1) ★★ Miejsce, w którym prompt obrazu naprawdę powstaje: `deckVisualsService.ts`.**
`server/src/services/ai/deckVisualsService.ts` — trzy funkcje budują prompt, jedna
dysponuje:

- `generateCoverVisual` (linia ok. 738): prompt sklejany tablicą (linie ok. 773-781):
  ```ts
  const prompt = [
    `${style}.`,
    `A premium 16:9 hero cover image for a consulting PowerPoint deck.`,
    `Topic: "${params.title}".`,
    `Audience: ${params.audience}. Goal: ${params.goal}.`,
    params.brandColor ? `Color palette anchored on #${params.brandColor.replace('#','')}.` : '',
    `Feel: confident, sharp, business, high-end.`,
    langHint,
    `No logos, no watermarks.`,
  ].filter(Boolean).join(' ');
  ```
  `style` (linie ok. 763-767) pochodzi WYŁĄCZNIE z `params.meta.template` — trzy zaszyte na
  sztywno stringi (`'minimal'` / `'modern'` / domyślny), **nie jest polem swobodnego tekstu.**
- `generateBackgroundTextureVisual` (linia ok. 793): identyczny wzorzec sklejania (linie
  ok. 822-830), `style` znowu z `params.meta.template` (linie ok. 811-815).
- `materializePlannedVisual` (linia ok. 854): bierze GOTOWY `prompt` z zaplanowanego
  `SlideVisualSpec` i przekazuje go bez zmian dalej — brak logiki sklejania.
- ★★ **`generateImageVisual` (linia ok. 599) — JEDYNY, wspólny punkt dyspozycji.** Wywołuje
  `generateWithOpenAI`/`generateWithGemini`/`generateWithReplicate` z `params.prompt`
  **dosłownie, bez modyfikacji** (linie ok. 658, 671-677, 682-688). **To jest jedyne miejsce,
  w którym dopisanie stylu obejmie WSZYSTKIE trzy ścieżki dostawców I ścieżkę
  `materializePlannedVisual` naraz** — nie doklejasz stylu w trzech miejscach osobno.

Caller potwierdzony: `presentationGeneratorService.ts:16` importuje `materializePlannedVisual`,
wołane na liniach ok. `2041` i `2058` — to jest żywa, produkcyjna ścieżka generowania decka,
nie martwy kod.

**(K2) ★★ `deckImageResolverService.ts` i `iconSuggestionService.ts` — POTWIERDZONE zero
wołaczy. To NIE jest punkt zaczepienia, tylko martwy kod.** Zamówienie pytało wprost, które z
dwóch. Pomiar rozstrzyga jednoznacznie:

- `server/src/services/deliverables/deckImageResolverService.ts` (270 linii):
  `resolveImageBriefs` (eksport, linia 148), `resolveDeckImages` (eksport, linia 214).
  `grep -rn "deckImageResolverService\|resolveDeckImages\|resolveImageBriefs" server/src`
  poza samym plikiem → **puste**. Zero importerów gdziekolwiek.
- `server/src/services/deliverables/iconSuggestionService.ts`: `suggestIconFor` (109),
  `suggestIconsForList` (125), `ICON_FALLBACK` (139). Ten sam wynik: **zero importerów.**

**Nie budujesz na nich.** Są kandydatami do usunięcia (opcjonalnie, patrz §5), nie do
rozbudowy — realny punkt zaczepienia to `deckVisualsService.ts::generateImageVisual` (K1).

**(K3) ★ Istnieje już mechanizm nazwanych stylów — ale to jest INNY mechanizm niż „pole w
motywie", i jest ROZŁĄCZONY od realnego promptu.** `ImageStylePreset`
(`src/components/Presentations/wizard/types.ts:95-101`), sześć wartości:
`corporate_photography · abstract_geometric · flat_illustration · data_focused ·
industry_realistic · minimal_no_images`. Pole na ustawieniach kreatora
(`types.ts:340`), UI w `SetupStep.tsx:292-293` i `ImageStyleSelector.tsx:27`, przewód:
`PresentationWizard.tsx:199,236` → `presentationGeneratorService.ts:2073`
(`imageStylePreset: v.styleHint || 'corporate'`) → `presentationDeckDocumentService.ts:550`
(`image_style_preset: setup.imageStylePreset`, persystowane). **Ale to pole NIE dociera do
`deckVisualsService.ts`** — prompt tam czyta wyłącznie węższe `params.meta.template` (K1).
To jest **trzeci martwy kanał** tej fali (obok dwóch z dyżuru 226): dane persystują się
poprawnie, tylko nikt ich po drodze nie czyta tam, gdzie się liczy.

To jest **inny mechanizm** niż to, o co prosi zamówienie („pole w MOTYWIE" — ustawiane raz,
obowiązujące dla wszystkich decków pod tym motywem, jak w Gammie). `ImageStylePreset` jest
ustawieniem PER-GENERACJA w kreatorze, nie per-motyw. Oba mają wartość — zbuduj OBA jako
osobne pozycje (R1 dla motywu, R3 dla naprawy tego rozłączenia), nie myl ich.

**(K4) Provider obrazów — trzej realni dostawcy, potwierdzone.** `generateImageVisual`
rozgałęzia się na: OpenAI/DALL-E-3 (`generateWithOpenAI`, linia 222; `modelId` domyślnie
`'dall-e-3'`, linia ok. 502), Gemini „nano-banana" `gemini-2.5-flash-image`
(`generateWithGemini`, linia 376), Replicate (`generateWithReplicate`, linia 268). Wybór
dostawcy: zmienna środowiskowa **`DELIVERABLE_IMAGE_PROVIDER`** (`gemini | replicate |
openai | off`, domyślnie `gemini`, linia ok. 467) — **poza `FeatureFlags.ts` całkowicie**
(`grep -ni "image" FeatureFlags.ts` → 0 wyników). Nie ma flagi obrazów w ogóle dziś.

**(K5) ★ OCR — ISTNIEJE lokalny mechanizm do skopiowania, ale dla innego celu.**
`tesseract.js` (`^7.0.0`) jest realną zależnością (`server/package.json:65`). Żywe użycie w
`server/src/services/organizationContext/ContextDocumentService.ts`:
`getImageOcrProvider()` (linia 1826, zwraca `'disabled' | 'tesseract' | 'openai_vision'`),
ścieżka `tesseract` (linia 1911, dynamiczny import + `tesseract.recognize(buffer,
languages)`, linie 1913-1918), ścieżka zapasowa `openai_vision` (linie 1986-1991, prompt do
modelu każący wypisać `ocr_text`). **To jest OCR dla dokumentów wgrywanych do kontekstu
organizacji — NIE dla obrazów generowanych do decka.** Dziś **żadna bramka OCR nie istnieje
na ścieżce generowania obrazu decka.** `tesseract.js` jest lokalną biblioteką (nie modelem
językowym) — użycie jej NIE narusza `Z15`.

**(K6) ★★ Detekcja twarzy — POTWIERDZONE ABSOLUTNIE BRAK.** `grep -rn` za
`face.*detect|rekognition|faceapi` (case-insensitive) w `server/src` i w obu `package.json`
→ same fałszywe trafienia (nazwy interfejsów niezwiązane z twarzami — detekcja anomalii, PII,
konfliktów). **Zero infrastruktury.** Musisz zbudować od zera — lokalnej biblioteki nie ma,
jedyna dostępna droga to wywołanie modelu wizyjnego (ten sam rodzaj klienta, którego już
używa `generateWithGemini`/`generateWithOpenAI` do GENEROWANIA — tu potrzebny do ANALIZY).

**(K7) `pptxgenjs` 4.0.1, zero „gradient" w paczce — potwierdzone identycznie jak w dyżurach
226/227.** Nieistotne dla tej pozycji poza jednym wnioskiem: skoro nie możemy renderować
gradientu w PPTX, to KOLOR w stylu obrazu (`fuchsia, pink, royal blue` z motywu właściciela)
musi wejść przez SŁOWA w prompcie obrazu (dokładnie to, co robi Gamma — K-cytat wyżej), nie
przez próbę symulacji gradientu kształtami OOXML na samym slajdzie.

**(K8) Reguła bezpieczeństwa z dokumentacji Gammy — cytat, nie hipoteza.**
`GAMMA_G1_OBRAZY.md §2.4` cytuje samą Gammę: modele obrazowe *„sometimes add unwanted text
elements even when prompts explicitly avoid mentioning any text content"* i instrukcje
„DO NOT" bywają łamane. **Negatywny prompt nie jest zabezpieczeniem.** Stąd dwie bramki
automatyczne w zamówieniu (B-IMG-1 OCR, B-IMG-2 twarz) — nie są ozdobą, są jedynym realnym
zabezpieczeniem, skoro sam prompt nie wystarcza.

# 2. TEZY ZLECENIA

- **T1.** Jedyny wspólny punkt dyspozycji promptu obrazu to `generateImageVisual`
  (`deckVisualsService.ts:~599`) — doklejanie stylu TU obejmuje wszystkie ścieżki naraz.
- **T2.** `deckImageResolverService.ts` i `iconSuggestionService.ts` mają **zero** wołaczy —
  potwierdzone niezależnym grepem po nazwie pliku i po nazwach eksportowanych symboli. Nie są
  punktem zaczepienia.
- **T3.** Istnieje JUŻ działający, ale ROZŁĄCZONY mechanizm nazwanych stylów
  (`ImageStylePreset`, `wizard/types.ts:95-149`) — persystuje się poprawnie do bazy, ale nigdy
  nie dociera do `deckVisualsService.ts`.
- **T4.** Trzej realni dostawcy obrazu (OpenAI/Gemini/Replicate), sterowani zmienną
  `DELIVERABLE_IMAGE_PROVIDER`, POZA `FeatureFlags.ts`.
- **T5.** `tesseract.js` istnieje jako zależność i ma żywy wzorzec użycia
  (`ContextDocumentService.ts:1826-1991`) — dla dokumentów, nie dla obrazów decka. Reużywasz
  WZORZEC (nową funkcję modelowaną na nim), nie modyfikujesz ten plik.
- **T6.** Detekcji twarzy nie ma nigdzie w repo — budujesz od zera, jedyna droga to model
  wizyjny.
- **T7.** Żadna flaga funkcyjna dot. obrazów nie istnieje dziś — dodajesz pierwszą.

# 3. POZYCJE DYŻURU

## R1 — Pole „Styl obrazu" (tekst) w motywie + doklejanie do KAŻDEGO promptu

**Cel:** motyw (`presentation_templates`) dostaje nowe, wolnotekstowe pole
`imageStylePrompt`, ustawiane raz i doklejane do KAŻDEGO polecenia generowania obrazu
wygenerowanego pod tym motywem — dokładnie wzorzec Gammy z K-cytatu.

Persystencja — **tym samym wzorcem co `colorTemplateId`/`customTemplate`**, wolna kolumna
JSON `layout_policy_json` (`server/migrations/20260719_baseline_gap.sql:7788,7794`, `text`,
`default '{}'`), NIE nowa migracja:

- `server/src/routes/presentations.routes.ts`, handler `PUT /templates/:id` (dziś destrukturyzacja
  `req.body` w okolicy `:1566-1567`): dopisujesz `imageStylePrompt` do listy pól i do warunku
  scalania `layoutPolicyJson` (dziś `if (colorTemplateId !== undefined)`, okolice `:1576`).
  ★★ **KOORDYNACJA OBOWIĄZKOWA:** dyżur 226 pracuje w TYM SAMYM handlerze nad polem
  `customTemplate`. **Przed edycją zmierz aktualny stan pliku**: jeśli warunek już zawiera
  `customTemplate !== undefined` (226 wylądował pierwszy) — dopisz swój człon do ISTNIEJĄCEGO
  warunku (`colorTemplateId !== undefined || customTemplate !== undefined ||
  imageStylePrompt !== undefined`). Jeśli 226 jeszcze nie wylądował — dopisujesz WYŁĄCZNIE
  swój człon (`colorTemplateId !== undefined || imageStylePrompt !== undefined`), zostawiając
  `customTemplate` dla 226. **Nigdy nie usuwasz i nie odtwarzasz cudzej gałęzi warunku.**
  Sprawdź `git log`/`git blame` na tej linii przed commitem i zgłoś kolizję, jeśli oba dyżury
  chcą pisać jednocześnie.
- odczyt: `server/src/services/presentationTemplateRuntimeService.ts::buildTemplateRuntimeFromRow`
  (`:372-452`) dostaje nowe pole `imageStylePrompt: string | null` w zwracanym
  `PresentationTemplateRuntime` (interfejs `:174-195`), czytane z
  `layoutPolicy?.imageStylePrompt ?? null` (ten sam `layoutPolicy` już sparsowany na `:404` —
  nie parsujesz JSON drugi raz). **To jest TRZECIE pole w tym samym wzorcu co `customTemplate`
  z dyżuru 226 — jeśli 226 jeszcze nie wylądował, dopisujesz TYLKO swoje pole, nie odtwarzasz
  jego pracy.**

Za flagą `ENABLE_PRESENTATION_IMAGE_STYLE` (nowa, `default false`, wzorem
`ENABLE_DECK_CONCLUSION_SLIDE`). Przy OFF: pole może istnieć w bazie (zapis jest
nieszkodliwy), ale **`generateImageVisual` go nie czyta** — prompt bajt w bajt dzisiejszy.

**Ukończone, gdy:** zapis/odczyt `imageStylePrompt` działa przez realną trasę HTTP (ten sam
wzorzec bramki co dyżur 226 R3 — zapis → odczyt zwraca tę samą wartość); kolizja z 226
sprawdzona i opisana w raporcie, nie odgadnięta.

## R2 — Doklejanie do promptu: jeden punkt wpięcia w `generateImageVisual`

**Cel:** `generateImageVisual` (`deckVisualsService.ts:~599`) dostaje nowy opcjonalny
parametr (np. `styleAppendix?: string`), budowany raz na poziomie wywołującego
(`presentationGeneratorService.ts:~2041,~2058` — **zmierz dokładnie, jak dziś template/theme
dociera do tych wywołań**, to jest Twój krok pomiarowy, nie założenie z tej instrukcji) z
`templateRuntime.imageStylePrompt` (R1) + (jeśli R3 wdrożony i preset ustawiony) fragment
promptu dla nazwanego stylu. Wewnątrz `generateImageVisual`, PRZED wywołaniem
`generateWithOpenAI`/`generateWithGemini`/`generateWithReplicate`, finalny prompt to
`[params.prompt, styleAppendix].filter(Boolean).join(' ')` — **jedna zmiana w jednym
miejscu**, nie trzy kopie w `generateCoverVisual`/`generateBackgroundTextureVisual`.

Za tą samą flagą `ENABLE_PRESENTATION_IMAGE_STYLE`. Przy OFF: `params.prompt` bez zmian,
identyczne dzisiejszemu zachowaniu — zasercjonuj to wprost (dowód mutacyjny: włącz → prompt
zawiera tekst stylu; wyłącz → nie zawiera, identyczny z dzisiejszym).

**Ukończone, gdy:** test na poziomie funkcji (nie przez realny model — `Z15`, dostawcę
podmieniasz na atrapę przyjmującą prompt i zwracającą deterministyczny bufor) wykazuje, że
finalny string wysłany do „dostawcy" zawiera treść `imageStylePrompt` przy ON i nie zawiera
przy OFF, dla WSZYSTKICH trzech gałęzi dostawcy (OpenAI/Gemini/Replicate) jednym testem
parametryzowanym, nie trzema kopiami.

## R3 — Naprawa rozłączenia `ImageStylePreset` (opcjonalne nazwane style)

**Cel:** istniejący, już działający mechanizm nazwanych stylów kreatora (K3, sześć wartości:
`corporate_photography · abstract_geometric · flat_illustration · data_focused ·
industry_realistic · minimal_no_images`) przestaje być rozłączony od realnego promptu.

★ **Decyzja architektoniczna tego dyżuru — zapisz ją jednym zdaniem w raporcie:** zamiast
przepisywać istniejącą taksonomię na dokładnie pięć nazw Gammy (`photography / illustration /
abstract / 3D / line art` + `Custom`), **reużywasz sześć już istniejących, już
zaimplementowanych w UI presetów** i doklejasz do każdego krótki fragment promptu, wzorowany
na szkicach z `GAMMA_G1_OBRAZY.md §1` (np. dla `abstract_geometric` — sekcja 1.1, „large-scale
abstract composition, soft organic forms…"; dla `corporate_photography`/`industry_realistic`
— sekcja 1.2 z REGUŁĄ TWARDĄ „zero ludzi" na okładce; dla `flat_illustration` — sekcja 1.4).
`minimal_no_images` i `data_focused` nie dostają fragmentu promptu obrazu — z definicji nazwy
oznaczają brak/ograniczenie obrazu, nie styl wizualny. To jest **tańsze i mniej ryzykowne**
niż budowa nowej taksonomii od zera, bo UI i persystencja (`SetupStep.tsx`,
`ImageStyleSelector.tsx`, `presentationDeckDocumentService.ts:550`) już istnieją i działają —
naprawiasz WYŁĄCZNIE brakujący przewód do `deckVisualsService.ts`.

Wymogi:
- mapa preset→fragment promptu jako osobna, nazwana stała (np. `IMAGE_STYLE_PRESET_PROMPTS`)
  w `deckVisualsService.ts` albo pliku sąsiednim — NIE w `wizard/types.ts` (front i backend
  mają osobne odpowiedzialności, `types.ts` zostaje czystym typem);
- gdy zarówno `imageStylePrompt` z motywu (R1), JAK i `imageStylePreset` z kreatora są
  ustawione — **oba doklejasz, motyw pierwszy** (marka jest stała, generacja jest
  incydentalna) — zapisz to jednym zdaniem w raporcie i przetestuj kolejność;
- za tą samą flagą `ENABLE_PRESENTATION_IMAGE_STYLE`.

**Ukończone, gdy:** dla każdego z czterech presetów niosących fragment promptu (K3 minus
`minimal_no_images`/`data_focused`) test wykazuje, że finalny prompt zawiera oczekiwany
fragment; kolejność motyw+preset przetestowana.

## R4 — ★★ Dwie bramki bezpieczeństwa, obowiązkowe, nie opcjonalne

Zamówienie jest jednoznaczne: te bramki są WYMAGANE przez samą dokumentację Gammy (K8), nie
są ulepszeniem do rozważenia. Obie działają na buforze obrazu ZANIM trafi on do pliku decka,
w `generateImageVisual`, PO otrzymaniu `buf` od dostawcy, PRZED zapisaniem do
`assetsDir`/dodaniem do `SlideVisualSpec`.

### R4a — B-IMG-1: OCR, odrzucenie obrazu z tekstem

Nowa funkcja (np. `detectTextInGeneratedImage(buf: Buffer): Promise<{hasText: boolean}>`),
wzorowana 1:1 na `ContextDocumentService.ts` (`getImageOcrProvider`/ścieżka `tesseract`,
`:1826,:1911-1918`) — **nie modyfikujesz ten plik**, budujesz nową funkcję obok
`generateImageVisual` używającą `tesseract.js` bezpośrednio na buforze wygenerowanego obrazu.
Próg: jeśli rozpoznany tekst po `trim()` ma długość powyżej progu (ustal i uzasadnij liczbą,
np. `> 2` znaki, żeby odrzucić szum, nie prawdziwy napis) → `hasText: true` → odrzuć i
wygeneruj ponownie (bounded retry, patrz R4c).

**tesseract.js jest lokalną biblioteką — użycie jej w teście NIE narusza `Z15`.** Dowód:
prawdziwy przebieg `tesseract.js` na (a) fixture z wypalonym tekstem (zbudowanym
deterministycznie w teście, np. render małego SVG z napisem do PNG, albo gotowy plik
`tests/fixtures/`) → `hasText: true`; (b) fixture jednokolorowy/abstrakcyjny bez tekstu →
`hasText: false`. Dwa realne przebiegi, zero atrapy.

### R4b — B-IMG-2: detekcja twarzy, odrzucenie gdy styl na to nie pozwala

Nowa funkcja (np. `detectFaceInGeneratedImage(buf: Buffer): Promise<{hasFace: boolean}>`).
K6 potwierdził: **zero lokalnej biblioteki w repo.** Jedyna droga to wywołanie modelu
wizyjnego — reużyj KLIENTA (nie logikę), którego już mają `generateWithGemini`/
`generateWithOpenAI` do rozmowy z tym samym dostawcą, w trybie analizy zamiast generacji
(krótkie pytanie tak/nie o obecność twarzy ludzkiej).

★★ **`Z15` w WERSJI DLA TEGO DYŻURU:** funkcję piszesz z **wstrzykiwalnym detektorem**
(parametr/interfejs, domyślna implementacja woła model, testowa implementacja go podmienia).
Dowód logiki decyzji (zero wystąpień twarzy → przechodzi; wystąpienie + styl bez zgody na
ludzi → odrzuca; wystąpienie + styl `corporate_photography`/`industry_realistic` **jawnie
zezwalający** na ludzi po ludzkiej akceptacji — patrz `GAMMA_G1_OBRAZY.md §1.2` REGUŁA TWARDA
„zero ludzi" na okładce mimo wszystko — **domyślnie odrzucasz nawet dla stylów fotograficznych,
zgoda na ludzi wymaga osobnego, jawnego pola, którego dziś nie ma; nie buduj go w tym
dyżurze, po prostu odrzucaj**) budujesz przez wstrzyknięty atrapowy detektor, **zero
wołania realnego modelu w Twoich testach.** **Nie wołasz realnego modelu obrazowego/
wizyjnego bez osobnej zgody właściciela** — przygotuj grunt (wiring kompletny, flaga
istnieje, funkcja gotowa) pod JEDEN realny przebieg, którego NIE wykonujesz sam. W raporcie
napisz wprost „modelu nie wołałem" albo, jeśli dostałeś osobną zgodę w trakcie dyżuru, podaj
dokładnie jeden przebieg i jego wynik.

### R4c — Pętla ponawiania i fallback

Bounded retry: **maksymalnie 2 dodatkowe próby** wygenerowania obrazu po odrzuceniu przez
którąkolwiek bramkę (łącznie 3 próby), potem **fallback na `tryStockFallback`** — funkcja już
istniejąca w tym pliku (widoczna w gałęzi „brak selection" wcześniej w kodzie) — reużyj ją,
nie buduj drugiej. Jeśli fallback też zawiedzie: zwróć `warning`, tak jak dziś robi funkcja
przy braku dostawcy — **zero atrapy, zero cichego sukcesu z pustym obrazem** (`Z23`).

**Ukończone, gdy (całe R4):** obie bramki mają dowód mutacyjny (fixture z tekstem → odrzucone;
fixture bez tekstu → przyjęte; wstrzyknięty detektor twarzy zwracający `true`+styl-bez-zgody
→ odrzucone; `false` → przyjęte); pętla retry zmierzona (dokładnie 3 próby, nie więcej);
fallback na `tryStockFallback` udowodniony; przy fladze OFF żadna z bramek się nie uruchamia
(dzisiejsze zachowanie, zero regresji wydajności dla klientów, którzy jeszcze nie zaakceptowali
funkcji).

# 4. TABELA LICENCJI PLIKOWEJ

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/config/FeatureFlags.ts` — WYŁĄCZNIE `ENABLE_PRESENTATION_IMAGE_STYLE` (schemat wzorem `:50`, blok ładujący wzorem `:205`) |
| Zapis | `server/src/routes/presentations.routes.ts` — WYŁĄCZNIE handler `PUT /templates/:id` (`~:1542-1606`): dopisanie `imageStylePrompt` do destrukturyzacji i warunku scalania `layoutPolicyJson`, ze skoordynowanym scaleniem wobec dyżuru 226 (patrz R1) |
| Zapis | `server/src/services/presentationTemplateRuntimeService.ts` — WYŁĄCZNIE `buildTemplateRuntimeFromRow` (`:372-452`) i interfejs `PresentationTemplateRuntime` (`:174-195`): dodanie pola `imageStylePrompt`, skoordynowane wobec 226 jak wyżej |
| Zapis | `server/src/services/ai/deckVisualsService.ts` — WYŁĄCZNIE `generateImageVisual` (nowy parametr, doklejanie stylu przed dyspozycją do dostawcy, dwie nowe funkcje bramek R4a/R4b, pętla retry R4c). **Zakaz zmiany logiki `generateCoverVisual`/`generateBackgroundTextureVisual` poza przekazaniem nowego parametru w dół** i zakaz zmiany kontraktów `generateWithOpenAI`/`generateWithGemini`/`generateWithReplicate` |
| Zapis | `server/src/services/presentationGeneratorService.ts` — WYŁĄCZNIE budowa `styleAppendix` w okolicy wywołań `materializePlannedVisual` (`~:2041,~:2058`) i przekazanie `templateRuntime.imageStylePrompt`/presetu w dół. Zakaz zmian poza tym zakresem |
| Zapis | `src/components/Presentations/PresentationTemplateArchitectView.tsx` — dozwolone WYŁĄCZNIE dodanie pola tekstowego „Styl obrazu" analogicznego do istniejących pól (wzorem `editTheme`), za flagą UI jeśli dyżur 226 już wprowadził wzorzec warunkowego renderu pól — **jeśli 226 nie wylądował, budujesz najprostszy możliwy dodatek, bez zależności od jego pracy** |
| Zapis (nowy plik) | funkcje bramek R4a/R4b — dozwolone jako nowy plik pomocniczy (np. `server/src/services/ai/deckImageSafetyGates.ts`) zamiast rozdymania `deckVisualsService.ts`, jeśli uznasz to za czystsze — uzasadnij wybór w raporcie |
| Zapis | NOWE pliki testowe `day228.*` w `server/src/services/ai/__tests__/`, `server/src/routes/__tests__/`, `tests/integration/` — pełna licencja (`Z18`/`Z31`). Nowe pliki w `tests/` wymagają `git add -f`. Fixture'y obrazów w `tests/fixtures/day228-*` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY228_GAMMA_STYLOBRAZU_REPORT.md` |
| Zapis (opcjonalne, uzasadnij) | usunięcie `server/src/services/deliverables/deckImageResolverService.ts` i `iconSuggestionService.ts` — dozwolone WYŁĄCZNIE po powtórnym potwierdzeniu pomiarem zera importerów na Twojej bazie, w commicie oddzielnym od reszty dyżuru, z uzasadnieniem. Jeśli wolisz zostawić — zostaw i odnotuj w raporcie „martwy kod, poza zakresem usunięcia" |
| Odczyt (ZAKAZ ZAPISU) | `src/components/Presentations/wizard/types.ts` (`:95-149`) · `SetupStep.tsx` · `ImageStyleSelector.tsx` · `PresentationWizard.tsx` — mechanizm `ImageStylePreset` jest już poprawny; czytasz wartość, nie zmieniasz UI kreatora |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/presentationDeckDocumentService.ts` (`:550`) — persystencja presetu jest już poprawna |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/organizationContext/ContextDocumentService.ts` — wzorzec OCR do skopiowania, NIE modyfikujesz go |
| Odczyt (ZAKAZ ZAPISU) | `server/src/controllers/ai/LLMController.ts` — konfiguracja kluczy dostawców, czytasz jako wzorzec klienta, nie zmieniasz |
| Odczyt (ZAKAZ ZAPISU) | `server/migrations/20260719_baseline_gap.sql` — schemat `layout_policy_json` ustalony, zero nowej migracji |
| Odczyt | `docs/program/funkcje/GAMMA_G1_OBRAZY.md` · `GAMMA_G3_OBCHOD_MENU.md` — źródło szkiców promptów i uzasadnienia mechanizmu; nie edytujesz |

**Nietykalne imiennie:** `ContextDocumentService.ts` (wzorzec OCR, nie cel zmiany) ·
`wizard/types.ts`/`SetupStep.tsx`/`ImageStyleSelector.tsx` (mechanizm presetu już poprawny) ·
kontrakty `generateWithOpenAI`/`generateWithGemini`/`generateWithReplicate` ·
`server/migrations/**` · geometria PPTX (dyżur 227) · zapis `customTemplate`/`colorTemplateId`
(dyżur 226 — Ty dopisujesz TRZECIE pole obok, nie zmieniasz ich dwóch) · każdy
`MODULE_ACCEPTANCE.md`.

**Rozłączność z partią równoległą — NAJWAŻNIEJSZA W TYM DYŻURZE:** 226 i 228 pracują w
DOKŁADNIE TYCH SAMYCH DWÓCH PLIKACH (`presentations.routes.ts` PUT-handler,
`presentationTemplateRuntimeService.ts`). To jest zamierzone (ten sam wzorzec JSON-bucket,
trzy pola obok siebie) i wymaga koordynacji opisanej w R1 — **sprawdź `git log` PRZED
pierwszym commitem w każdym z tych dwóch plików, za każdym razem**, nie tylko raz na
początku. 227 pracuje w `DeckStyler.ts`/`designTokens.ts`/`presentationVisualDirectorService.ts`
— rozłączne z 228.

# 5. TWARDE ZASADY

- ★★ **JEDNA FLAGA NA CAŁĄ POZYCJĘ.** `ENABLE_PRESENTATION_IMAGE_STYLE` gasi/włącza R1-R4
  razem — **bramek bezpieczeństwa (R4) NIE WOLNO włączać osobno ani wyłączać osobno od
  doklejania stylu.** Jeśli flaga jest ON, obie bramki działają zawsze — to nie jest opcja do
  wyłączenia, to jest warunek wejścia.
- ★★ **NIE WOŁASZ REALNEGO MODELU OBRAZOWEGO ANI WIZYJNEGO BEZ OSOBNEJ ZGODY.** Cały dowód
  R2/R3/R4b budujesz na atrapach/wstrzykniętych detektorach. Wyjątek: R4a (OCR) używa
  REALNEGO `tesseract.js` na REALNYCH fixture'ach — to jest biblioteka lokalna, nie model, i
  jest dozwolona/oczekiwana. Jeśli w trakcie dyżuru dostaniesz osobną zgodę na jeden realny
  przebieg modelu obrazowego — DOKŁADNIE JEDEN, w raporcie podaj nazwę modelu (nigdy klucza)
  i wynik.
- ★★ **KOORDYNACJA Z DYŻUREM 226 JEST WARUNKIEM, NIE SUGESTIĄ.** Dwa wspólne pliki. Zmierz
  stan PRZED KAŻDYM commitem w którymkolwiek z nich, nie tylko raz na starcie.
- ★★ **NIE BUDUJESZ NA MARTWYM KODZIE (T2).** `deckImageResolverService.ts` i
  `iconSuggestionService.ts` nie są punktem zaczepienia — jeśli poczujesz pokusę „przecież tu
  już coś jest", to jest sygnał błędu.
- ★★ **`Z15` — model wywołujesz WYŁĄCZNIE za osobną, jawną zgodą, dokładnie raz, i piszesz to
  w raporcie.** Domyślne założenie dyżuru: „modelu nie wołałem".
- ★ **NIE ZMIENIASZ TAKSONOMII NAZWANYCH STYLÓW.** R3 reużywa sześć istniejących presetów
  (K3) — nie przepisujesz ich na pięć nazw Gammy. To jest świadoma decyzja architektoniczna
  tej instrukcji, nie do podważenia bez zgody właściciela.
- ★ **Domyślnie odrzucasz twarze nawet dla stylów „fotograficznych"** (R4b) — zgoda na ludzi
  na zdjęciu wymaga pola, którego dziś nie ma; nie buduj go, po prostu bądź konserwatywny.
- ★ **`Z31`** — `assertRealPostgresTestEnvironment()` bez argumentów.
- ★ **Sprzątanie kontenera: `docker rm -f -v`.**
- ★ **`Z27`** — zakaz `git stash`, dowody przez `cp` do
  `/private/tmp/cx-day228-gamma-stylobrazu-scratch`.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji** (`Z28`).
- **Zakaz naprawiania przez wyciszanie**, zakaz usuwania zastanych testów.
- ★ **`§0.4a` — pomiar zasięgu testów jest warunkiem oddania raportu** (`Z24`).
- ★ **Zrzuty: `mean_luma` jasny/ciemny >150 różnicy.** Wymagane: pole „Styl obrazu" w
  edytorze motywu, ×2 motywy, ustawione i zapisane. Napisz wprost, czy to realny przebieg
  przez `ApiGateway`, czy propsy w harnessie.
- ★ **`Z13`** — logi, zrzuty, fixture'y obrazów z dowodu NIE wchodzą do repo (poza samymi
  plikami fixture w `tests/fixtures/`, które SĄ kodem testowym i wchodzą), leżą w
  `/private/tmp/cx-day228-gamma-stylobrazu-artefakty`, raport podaje ścieżki i `shasum -a 256`.
- Pułapka: `No test files found` nie jest `PASS`. Pułapka: liczby i NAZWY testów z JSON-a
  (`Z37`).
- ★ Porty **6172/5132-5133 wyłącznie Twoje**. Porty **6170/5128-5129** (226) i
  **6171/5130-5131** (227) zarezerwowane dla dyżurów równoległych. Porty **5000, 5037,
  5060-5061** zajęte na stałe. Porty **6173-6175, 5134-5139** zabronione (dyżury 229-232).
- ★★ **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest OBOWIĄZKOWA.** Wypisz co
  najmniej: czy `deckImageResolverService.ts`/`iconSuggestionService.ts` nadal mają zero
  importerów na Twojej bazie przed jakąkolwiek decyzją o usunięciu; czy zmierzyłeś, jak
  template/theme dociera do `presentationGeneratorService.ts:~2041/~2058` (T-do-zmierzenia z
  R2), czy założyłeś; czy koordynacja z dyżurem 226 wystąpiła i jaki był jej wynik (kto
  wylądował pierwszy, jak scaliłeś warunek); czy wołałeś realny model — jeśli tak, dokładnie
  ile razy i z czyją zgodą; czy dowód OCR używał realnego `tesseract.js` na realnym
  fixture, czy atrapy; czy detektor twarzy jest wstrzykiwalny i czy Twoje testy naprawdę
  omijają realny model; czy zrzuty pochodzą z realnego przebiegu. **Brak tej sekcji jest
  podstawą odrzucenia dyżuru.**
