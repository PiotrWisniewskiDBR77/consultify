# INSTRUKCJA DYŻURU nr 253 — Codex — „★★ FAŁSZYWA OBIETNICA ZAPISU — DZIEWIĄTY PRZYPADEK JUŻ NAPRAWIONY (zweryfikuj, nie zakładaj), DZIESIĄTY WCIĄŻ ŻYWY: `ConversationalPanel.tsx:182-192` (`applyDraftMappings`, komponent trybu `conversational` Wywiadu, montowany bezwarunkowo w `InterviewWorkspace.tsx:2721-2733` gdy `runtimeMode==='conversational'` — TRYB NIE JEST ZA FLAGĄ, jest wyborem w `RuntimeModeSelector`) woła `onQuestionAnswered?.(mapping.questionId, mapping.answerText)` w pętli BEZ `await` (prop typowany jako `(q,a)=>void`, `InterviewWorkspace.tsx:2730` przekazuje `(questionId, answerText) => { handleUpdateQuestion(questionId, {...}); }` — TAKŻE bez `await`/`return`, mimo że `handleUpdateQuestion` (`:1088`) JEST `async` i woła realny `Api.patch('/interview/questions/:id', ...)` z kontrolą wersji optymistycznej (409/428)) — po pętli od razu `toast.success('Applied N answers')` (linia ok. 192), NIEZALEŻNIE od tego, czy którykolwiek `Api.patch` zwrócił błąd sieciowy, 409 (konflikt wersji) czy 428 (brak tokenu wersji). Bliźniaczy, lżejszy przypadek tego samego korzenia (nie-`await`-owany `onUpdateQuestion` w akcji porzucania transkryptu) w `InterviewSingleQuestionRuntime.tsx:2487-2494`. Zero pokrycia testowego dla `ConversationalPanel.tsx` (`find` → brak `__tests__`)."

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
> **wyłącznie** `/private/tmp/cx-day253-falszywe-zapisy`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `df7f13056f`**
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
Zakres: ****Fałszywa obietnica zapisu — wzorzec „pokazuje sukces bez realnego zapisu/dokończenia zapisu”, przemiatanie poza Moją Pracą i Portalem Partnerskim.** Dziewiąty potwierdzony przypadek rodziny (`IdeaTableTool.tsx` Form Builder) jest już naprawiony na Twoim markerze (`git log` → commit `d0ef02897b`, poprzedza `df7f13056f`) — **KROK 0 tego dyżuru potwierdza to samodzielnie**, zanim przejdziesz do dziesiątego przypadku, który NIE jest naprawiony: `src/components/Interview/ConversationalPanel.tsx:182-192` (`applyDraftMappings`) pokazuje `toast.success` PRZED rozstrzygnięciem promise'ów zapisu, nie po nim — więc częściowe/pełne niepowodzenie zapisu ginie po cichu za komunikatem sukcesu.**.
Trasy front: ``src/components/Interview/ConversationalPanel.tsx` (rdzeń naprawy — `applyDraftMappings`, propsy `onQuestionAnswered`) · `src/components/Interview/InterviewWorkspace.tsx:2721-2733` (wołający, przekazuje nie-await-owany callback) · `src/components/Interview/InterviewSingleQuestionRuntime.tsx:2487-2494` (bliźniak, ta sama rodzina) · `src/components/MyWork/IdeaTableTool.tsx` (TYLKO ODCZYT — wzorzec do potwierdzenia w `R1`, już naprawiony) · `src/components/MyWork/table/forms/FormsIndex.tsx` (TYLKO ODCZYT — poprawny wzorzec do naśladowania)`. Trasy tył: ``server/src/routes/interview*.routes.ts` (odczyt — endpoint `PATCH /interview/questions/:id`, weryfikacja że realnie istnieje i wymaga `expectedUpdatedAt`) · `server/src/services/interview*` (odczyt, kontrola wersji optymistycznej) · `src/services/api/tablePlatform.api.ts:796-846` (TYLKO ODCZYT — `createForm`/`updateForm`/`deleteForm`, wzorzec API już używany poprawnie przez `FormsIndex.tsx`)`.

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
WT=/private/tmp/cx-day253-falszywe-zapisy
MARKER=df7f13056f

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day253-falszywe-zapisy-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day253-falszywe-zapisy/config.worktree"
cat "$VAULT/worktrees/cx-day253-falszywe-zapisy/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day253-falszywe-zapisy-scratch
mkdir -p /private/tmp/cx-day253-falszywe-zapisy-artefakty

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
git -C "$VAULT" log --oneline df7f13056f..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only df7f13056f..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day253-falszywe-zapisy-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only df7f13056f..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: przypadek #9 (IdeaTableTool Form Builder) jest JUZ naprawiony na Twoim markerze
git log --oneline -3 -- src/components/MyWork/IdeaTableTool.tsx
grep -n "showFormBuilder\|<FormBuilder" src/components/MyWork/IdeaTableTool.tsx
#   oczekiwane: commit d0ef02897b w historii; grep -> PUSTO (modal usuniety, wszystkie 3
#   wejscia przekierowane na setPlatformTab('forms'))

# (2) TEZA: FormsIndex uzywa realnego API tablePlatform (wzorzec poprawny)
grep -n "createForm\|updateForm\|deleteForm\|listForms" src/components/MyWork/table/forms/FormsIndex.tsx
#   oczekiwane: wszystkie cztery wywolane, z await

# (3) TEZA: ConversationalPanel.applyDraftMappings NIE czeka na zapis przed toastem
sed -n '160,196p' src/components/Interview/ConversationalPanel.tsx
#   oczekiwane: petla `for (const mapping of accepted) { onQuestionAnswered?.(...) }` bez await,
#   nastepnie `toast.success` bezposrednio po petli

# (4) TEZA: wolajacy w InterviewWorkspace tez nie czeka (async funkcja wolana bez await)
sed -n '2725,2733p' src/components/Interview/InterviewWorkspace.tsx
sed -n '1088,1112p' src/components/Interview/InterviewWorkspace.tsx
#   oczekiwane: `onQuestionAnswered={(questionId, answerText) => { handleUpdateQuestion(...) }}`
#   bez await/return; handleUpdateQuestion jest `async` i woła `Api.patch`

# (5) TEZA: tryb conversational NIE jest za flaga, jest zywy wybor
grep -n "runtimeMode === 'conversational'" src/components/Interview/InterviewWorkspace.tsx
grep -rn "conversational" src/components/Interview/RuntimeModeSelector.tsx 2>/dev/null | head -5
#   oczekiwane: warunek montowania istnieje bez otoczenia flaga; selector oferuje ten tryb

# (6) TEZA: zero pokrycia testowego dla ConversationalPanel.tsx
find src/components/Interview -iname "*ConversationalPanel*"
#   oczekiwane: tylko plik zrodlowy, brak __tests__/ConversationalPanel*

# (7) TEZA: blizniaczy przypadek w InterviewSingleQuestionRuntime.tsx
sed -n '2480,2496p' src/components/Interview/InterviewSingleQuestionRuntime.tsx
#   oczekiwane: `void onUpdateQuestion(...)` albo rownowazny brak await, potem toast.success

# (8) miejsce na dysku
df -h /
#   oczekiwane: powyzej 5 GB wolnego
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day253-falszywe-zapisy-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6246`. Twój JEDYNY port harnessu to `5226 i 5227`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day253-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6239, 5010-5219, 6404-6411, 6600-6830. Twoje własne: baza 6246, harness 5226 i 5227. Cudze — siostrzane dyżury TEJ SAMEJ paczki, nie dotykasz: baza 6240 i harness 5220-5221 (dyżur 250 Ustawienia AI), baza 6242 i harness 5222-5223 (dyżur 251 Audyty), baza 6244 i harness 5224-5225 (dyżur 252 Przemiatanie), baza 6248 i harness 5228-5229 (dyżur 254 Sprzeczności rejestru). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi. Tryb `conversational` NIE jest za flagą domyślnie wyłączoną — jest wyborem w `RuntimeModeSelector`, żywym dziś. Naprawa NIE wprowadza żadnej flagi.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts` · `src/components/MyWork/shared/__tests__/MutationResult.redContract.test.tsx` (odczyt — wzorzec zabezpieczenia, nie zmieniasz)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY253_FALSZYWE_ZAPISY_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć: `docs/program/funkcje/REGULA_NARZEDZIE_KONTROLNE.md` — WYŁĄCZNIE dopisanie jednego zdania w istniejącej liście trzech dzisiejszych spraw („Fałszywa obietnica zapisu... przemiatanie WYKONANE w Mojej Pracy i Portalu Partnerskim; reszta produktu NIEPRZEMIECIONA”), aktualizującego stan po Twoim `R3` (np. „+ Interview i część Documents/Materials/Admin, reszta nadal nieprzemieciona”) — zakaz zmiany reszty pliku. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day253-falszywe-zapisy-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day253-falszywe-zapisy-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ zmiany `IdeaTableTool.tsx`/`FormsIndex.tsx`/`FormBuilder.tsx`** — przypadek #9 jest już naprawiony i chroniony kontraktem regresyjnym (`IdeaTableTool.formBuilderWiring.contract.test.ts`), dotykasz ich WYŁĄCZNIE do odczytu jako dowodu w `R1`. **ZAKAZ pełnego przemiatania całego pozostałego produktu** — `R3` bierze BOUNDED, imiennie wskazaną kolejną próbkę (Documents/Wordy + Materials/Tools + reszta Admina), reszta zostaje policzonym, opisanym długiem w raporcie, nie ukrytym. **ZAKAZ tworzenia nowego, trwałego rejestru** „lista fałszywych obietnic zapisu” jako osobnego pliku w `docs/` — `Z13` pozwala na dokładnie JEDEN nowy dokument (raport tego dyżuru); zbiorczą listę przypadków 1-10 wpisujesz W RAPORCIE, nie jako nowy plik rejestru. | `docs/program/funkcje/REGULA_NARZEDZIE_KONTROLNE.md` zapisało wprost: „Fałszywa obietnica zapisu (kreator formularzy, dziewiąty przypadek) — przemiatanie WYKONANE w Mojej Pracy i Portalu Partnerskim; reszta produktu NIEPRZEMIECIONA.” `docs/program/funkcje/ODBIOR_ZALACZNIKI_INICJATYW.md` (ósmy przypadek, Załączniki Inicjatyw) ustaliło metodę: przewód bywa przerwany w WIĘCEJ niż jednym miejscu naraz (front nie woła / zaplecze odrzuca / widok nie doczytuje) i naprawa dwóch z trzech ogniw wciąż gubi dane — każda naprawa w tym dyżurze musi przejść ten sam trójstronny test, nie tylko „front teraz woła coś”. Ten dyżur kontynuuje przemiatanie w NOWYM, jeszcze nie sprawdzonym obszarze (Interview), tym samym wzorcem sygnatury (`toast.success`/komunikat sukcesu nie poprzedzony `await` realnego wywołania zaplecza, albo poprzedzony wywołaniem, którego wynik jest odrzucany). |

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
cd /private/tmp/cx-day253-falszywe-zapisy

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day253-pg psql -U postgres -d cx253 \
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
cd /private/tmp/cx-day253-falszywe-zapisy

docker run -d --name cx-day253-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx253 \
  -p 127.0.0.1:6246:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day253-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6246/cx253 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6246/cx253 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day253-falszywe-zapisy && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6246/cx253 \
JWT_SECRET=cx253-test-secret-do-not-reuse \
npx vitest run src/components/Interview/__tests__/ConversationalPanel.applyDraftMappings.contract.test.tsx --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day253-falszywe-zapisy-artefakty/day253-falszywe-zapisy.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day253-falszywe-zapisy && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/Interview/__tests__/ConversationalPanel.applyDraftMappings.contract.test.tsx --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day253-falszywe-zapisy-artefakty/day253-falszywe-zapisy.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day253-falszywe-zapisy/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day253-pg psql -U postgres -d cx253 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day253-pg`.
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
> **(e) ★★ ZANIM ZACZNIESZ NAPRAWIAĆ, POTWIERDŹ ŻE PRZYPADEK #9 (`IdeaTableTool.tsx` Form Builder) JEST JUŻ NAPRAWIONY NA TWOIM MARKERZE — jeśli w Twojej instrukcji jest napisane, że to wciąż otwarty defekt, a Twój `git log -1 -- src/components/MyWork/IdeaTableTool.tsx` pokazuje commit `d0ef02897b` ("fix(idea-table): stop discarding Form Builder saves — reuse FormsIndex") jako przodka Twojego markera — **NIE PRÓBUJESZ NAPRAWIAĆ CZEGOŚ, CO JUŻ DZIAŁA.** Zamiast tego potwierdzasz to w `R1` i przechodzisz do przypadku #10 (`ConversationalPanel.tsx`), który JEST wciąż otwarty. Druga pułapka: `onQuestionAnswered` to WSPÓLNY prop typu współdzielonego przez WIĘCEJ niż jeden komponent trybu Wywiadu (co najmniej `conversational` i `single_question`) — zmiana jego sygnatury z `(q,a)=>void` na `(q,a)=>Promise<void>` (albo dodanie osobnego async wariantu) musi utrzymać zgodność z KAŻDYM istniejącym wołającym; sprawdź WSZYSTKICH konsumentów tego propu w `InterviewWorkspace.tsx` przed zmianą typu, nie tylko ten jeden, który naprawiasz.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day253-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day253-falszywe-zapisy-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (KROK 0 — potwierdź, że przypadek #9 jest naprawiony na Twoim markerze, z dowodem `git log`+odczytem kodu; jeśli NIE jest naprawiony, przełącz się na naprawę #9 wzorcem `d0ef02897b` i zapisz to jako Korektę wobec instrukcji) · R2 (napraw przypadek #10 — `ConversationalPanel.tsx` `applyDraftMappings` + bliźniak `InterviewSingleQuestionRuntime.tsx`, z dowodem trójstronnym: front realnie woła + zaplecze przyjmuje + widok po przeładowaniu pokazuje nowe wartości, PLUS dowód częściowej porażki — jeden z N zapisów pada, toast informuje o realnym wyniku, nie o zamiarze) · R3 (bounded kolejna próbka — Documents/Wordy + Materials/Tools + reszta Admina — tym samym wzorcem sygnatury, z jawnym „co NIE zostało objęte”) · R4 (raport dyżuru, zbiorcza tabela przypadków 1-10)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6246` albo `5226 i 5227` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6246` albo `5226 i 5227`** (`Z7`).

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

`docs/program/funkcje/ODBIOR_ZALACZNIKI_INICJATYW.md` (ósmy potwierdzony przypadek)
i commit `47d78dcaba` (dziewiąty przypadek, Form Builder w `IdeaTableTool.tsx`)
ustaliły wspólny wzorzec tej rodziny defektu: **komunikat sukcesu pokazywany
bezwarunkowo, bez poprzedzającego realnego wywołania zaplecza — albo z wywołaniem,
którego wynik jest odrzucany.** `docs/program/funkcje/REGULA_NARZEDZIE_KONTROLNE.md`
zapisało stan przemiatania: **wykonane w Mojej Pracy i Portalu Partnerskim, reszta
produktu NIEPRZEMIECIONA.**

**Na Twoim markerze (`df7f13056f`) dziewiąty przypadek jest już naprawiony** — commit
`d0ef02897b` ("fix(idea-table): stop discarding Form Builder saves — reuse
FormsIndex") usunął zepsuty modal, przekierował wszystkie trzy wejścia na `FormsIndex`
(komponent, który już poprawnie woła `TablePlatformApi.createForm`/`updateForm`/
`deleteForm` i toastuje dopiero po rozstrzygnięciu promise'a), i dodał kontrakt
regresyjny (`IdeaTableTool.formBuilderWiring.contract.test.ts`). **To NIE jest praca do
wykonania w tym dyżurze — to jest Twój punkt odniesienia i dowód, że metoda
przemiatania działa**, kiedy jest zastosowana konsekwentnie.

## ★★ Dlaczego nie ufasz zgłoszeniu „ostatni przypadek to kreator formularzy" bez sprawdzenia

To jest DRUGI raz tego dnia (patrz dyżur 250, dyżur 251), kiedy zgłoszenie napisane
wcześniej w ciągu 2026-09-01 opisuje defekt, który między napisaniem zgłoszenia a
wydaniem tej instrukcji **został już naprawiony przez równoległy tor tego samego
repozytorium**. `R1` tego dyżuru jest zaprojektowane tak, żeby to zmierzyć jako
PIERWSZĄ czynność — zanim zaczniesz pisać jakikolwiek kod, potwierdzasz, gdzie realnie
jesteś.

Dziesiąty przypadek, który znaleziono PRZY PISANIU tej instrukcji (nie w cudzym
zgłoszeniu — zmierzony bezpośrednio na tym markerze) to
`src/components/Interview/ConversationalPanel.tsx:182-192` — `applyDraftMappings`
woła realny, działający mechanizm zapisu (`onQuestionAnswered` → `handleUpdateQuestion`
→ `Api.patch('/interview/questions/:id')` z kontrolą wersji optymistycznej), ale **nie
czeka na jego wynik** przed pokazaniem `toast.success('Applied N answers')`. To jest
WARIANT tej samej rodziny defektu, subtelniejszy niż przypadki 1-9: front NIE ignoruje
zaplecza całkowicie (jak w przypadku #9), tylko **odrzuca informację o tym, czy
zaplecze się zgodziło**.

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Przypadek #9 (`IdeaTableTool.tsx` Form Builder) jest naprawiony na Twoim markerze | komenda (1) |
| T2 | `FormsIndex.tsx` poprawnie woła realne API `createForm`/`updateForm`/`deleteForm` | komenda (2) |
| T3 | `ConversationalPanel.applyDraftMappings` nie czeka na zapis przed toastem sukcesu | komenda (3) |
| T4 | Wołający w `InterviewWorkspace.tsx` też nie czeka (funkcja `async`, wołana bez `await`) | komenda (4) |
| T5 | Tryb `conversational` nie jest za flagą — jest żywym wyborem w `RuntimeModeSelector` | komenda (5) |
| T6 | Zero pokrycia testowego dla `ConversationalPanel.tsx` | komenda (6) |
| T7 | Bliźniaczy przypadek w `InterviewSingleQuestionRuntime.tsx` (akcja porzucenia transkryptu) | komenda (7) |
| T8 | Miejsce na dysku wystarcza | komenda (8) |

---

# 3. POZYCJE DYŻURU

## R1 — KROK 0: POTWIERDŹ STAN PRZYPADKU #9 (rdzeń, warunek wejścia)

Wykonaj wszystkie 8 komend `§0.1`. **Jeśli komenda (1) potwierdza, że `d0ef02897b` jest
przodkiem Twojego markera i `showFormBuilder`/`<FormBuilder` nie występują już w
`IdeaTableTool.tsx`** — zapisz to w raporcie jako „przypadek #9: POTWIERDZONO
NAPRAWIONY, dowód: [wklej wynik komend 1-2]" i przejdź do `R2`. **Jeśli komenda (1)
pokazuje coś INNEGO** (np. `d0ef02897b` nie istnieje w historii Twojej gałęzi, albo
zepsuty modal wrócił) — zatrzymaj się, zapisz to jako „★★ Korekta wobec instrukcji" z
pełnym dowodem, i **napraw przypadek #9 wzorcem dokładnie z commitu `d0ef02897b`**
(`git show d0ef02897b` na dowolnym repo z dostępem do historii, albo odtwórz z opisu w
`§1` tego dokumentu) PRZED przejściem do `R2` — to staje się rdzeniem dyżuru zamiast
`R2`, a `R2`/`R3` przesuwają się o jedną pozycję.

## R2 — NAPRAW PRZYPADEK #10: `ConversationalPanel.applyDraftMappings` (rdzeń)

**Obecny kod** (`ConversationalPanel.tsx:182-192`, w przybliżeniu):

```ts
const applyDraftMappings = useCallback(() => {
  if (!draftMappings) return;
  const accepted = draftMappings.filter((m) => m.accepted);
  for (const mapping of accepted) {
    onQuestionAnswered?.(mapping.questionId, mapping.answerText);
  }
  trackFunnelEvent('interview_ai_parse_applied', { ... });
  setDraftMappings(null);
  toast.success(`Applied ${accepted.length} answers`);
}, [draftMappings, sessionId, onQuestionAnswered]);
```

`onQuestionAnswered` jest dziś typowany jako `(questionId: string, answerText: string)
=> void` i w `InterviewWorkspace.tsx:2730` przekazywany jako `(questionId, answerText)
=> { handleUpdateQuestion(questionId, {...}); }` — synchronicznie, bez `await`/`return`,
mimo że `handleUpdateQuestion` (`:1088`) jest `async` i realnie woła zaplecze.

**Zanim zmienisz typ `onQuestionAnswered`, wypisz WSZYSTKICH jego konsumentów**
(`grep -n "onQuestionAnswered" src/components/Interview/**/*.tsx`) — jest to WSPÓLNY
prop przekazywany do więcej niż jednego komponentu trybu Wywiadu. Zmiana sygnatury z
`(q,a)=>void` na `(q,a)=>Promise<void>` musi zachować zgodność z każdym istniejącym
wołającym (TypeScript to złapie przy kompilacji — potraktuj czerwony `tsc` na plikach,
które dotykasz, jako część dowodu, nie jako coś do wyciszenia — `Z35`).

**Kierunek naprawy** (szkic, dostosuj do realnych typów po `grep` z akapitu wyżej):

1. `handleUpdateQuestion` w `InterviewWorkspace.tsx` już zwraca `Promise` (jest
   `async`) — spraw, żeby wołający callback (linia 2730) **zwracał** ten promise
   (`onQuestionAnswered={(questionId, answerText) => handleUpdateQuestion(questionId,
   {...})}` — usuń nawiasy klamrowe blokujące niejawny `return`, albo dodaj jawny
   `return`).
2. W `ConversationalPanel.applyDraftMappings` zbierz wyniki wszystkich wywołań przez
   `Promise.allSettled`, NIE przez pętlę `for` z odrzucanymi promise'ami:
   ```ts
   const results = await Promise.allSettled(
     accepted.map((m) => onQuestionAnswered?.(m.questionId, m.answerText))
   );
   const failed = results.filter((r) => r.status === 'rejected').length;
   ```
3. Toast musi zależeć od realnego wyniku: pełny sukces → `toast.success` z
   RZECZYWISTĄ liczbą zapisanych (`accepted.length - failed`), częściowa porażka →
   osobny komunikat (np. `toast.error`/ostrzeżenie) wymieniający, ile pytań NIE
   zostało zapisanych, żeby użytkownik wiedział, które odpowiedzi wprowadzić ponownie.
   Zero porażek NIE MOŻE wyglądać identycznie jak pełny sukces w komunikacie.
4. `applyDraftMappings` musi stać się `async` (albo zwracać obsłużony promise) — sprawdź
   każde miejsce, gdzie jest wołana (`onClick`), i upewnij się, że UI pokazuje stan
   ładowania/blokady podwójnego kliku w trakcie zapisu (ten sam wzorzec co `isSaving`
   już istniejący w `InterviewWorkspace.tsx:1091`).

**Dowód (trójstronny, wzorem `ODBIOR_ZALACZNIKI_INICJATYW.md`):**
- **Front realnie woła** — potwierdź `await`/`Promise.allSettled` w kodzie (czytanie).
- **Zaplecze przyjmuje** — realny `PATCH /interview/questions/:id` na Twoim
  Postgresie, z podpisanym JWT, przez realny `ApiGateway`, sprawdza że
  `answerText`/`status` faktycznie się zmieniają w bazie (SQL SELECT niezależny od
  odpowiedzi API).
- **Częściowa porażka jest widoczna użytkownikowi** — test/scenariusz, w którym JEDNO
  z N pytań ma nieaktualny `expectedUpdatedAt` (konflikt 409/428) — komunikat musi
  odzwierciedlić, że N-1 się zapisało, a 1 nie, NIE „Applied N answers" dla wszystkich.

Zastosuj analogiczną poprawkę do bliźniaka w `InterviewSingleQuestionRuntime.tsx:2487-
2494` (`void onUpdateQuestion(...)` przed `toast.success('transcriptDiscarded')`) —
to jest akcja porzucenia, więc konsekwencja porażki jest mniejsza (nic wartościowego
nie ginie — użytkownik i tak zamierzał to odrzucić), ale sygnatura defektu jest
identyczna i naprawa jest tania: `await onUpdateQuestion(...)` przed toastem,
`toast.error` zamiast `toast.success` jeśli `await` rzuci.

## R3 — BOUNDED KOLEJNA PRÓBKA: DOCUMENTS/WORDY, MATERIAŁY/NARZĘDZIA, RESZTA ADMINA (rdzeń)

Metoda już zwalidowana dwa razy (przypadek #9, przypadek #10): grep uchwytów
`onSave`/`onUpload`/`onDelete`/`onSubmit`/`onCreate`/`onPublish`/`onApprove`, sprawdź
każdy pod kątem (a) czy poprzedza `toast.success`/komunikat sukcesu realnym `await` do
`Api.`/`fetch`/`axios`, (b) czy wynik tego wywołania jest w ogóle SPRAWDZANY przed
komunikatem, nie tylko wywołany. Zawężony zakres: `src/components/Documents/**`,
`src/views/vault/**` (jeśli nie pokryte już przez sprawdzenie Mojej Pracy — potwierdź w
raporcie), `src/components/MaterialsTools/**` albo odpowiadający katalog (zlokalizuj
sam po realnej nazwie w `src/`), oraz katalogi `src/views/admin/**`
NIEobjęte poprzednim przemiataniem (sprawdź w raporcie ósmego/dziewiątego przypadku,
które konkretnie już sprawdzono, żeby nie duplikować pracy).

Dla każdego znalezionego kandydata: albo **NAPRAW** tym samym wzorcem co `R2` (jeśli
mieści się w czasie dyżuru), albo **ZGŁOŚ, ŚWIADOMIE NIE NAPRAWIAJĄC** z pełnym
`plik:linia`, dowodem że realne API istnieje i jest nieużywane, i uzasadnieniem
dlaczego nie mieściło się w zakresie — **nie zostawiasz cichej luki, zapisujesz ją
jawnie**, wzorem commitu `47d78dcaba` ("zgłoszone, świadomie NIE naprawione zgodnie z
zasadą »opisz, nie napraw«" — ale w TYM dyżurze masz licencję naprawy, więc naprawiaj
gdziekolwiek się mieści, zgłaszaj tylko to, co przekracza czas).

**Obszar, którego NIE dotykasz w tym dyżurze** (imiennie, do raportu): Assessment,
Execution, Finance, Meeting, ReportsAndPresentations, Audit/method — te zostały już
sprawdzone tym samym wzorcem przy przygotowaniu tej instrukcji i wyszły CZYSTE (każdy
sprawdzony `handleSave`/`handleCreate`/`handleDelete` czeka na realny `Api.`/`fetch`
przed komunikatem sukcesu) — **nie musisz ich powtarzać**, ale jeśli natkniesz się na
coś podejrzanego przy okazji, zapisz to jako PODEJRZENIE, nie ZMIERZONE.

## R4 — RAPORT DYŻURU (rdzeń)

Sekcje: streszczenie, `R1`-`R3` z pełnymi dowodami, **zbiorcza tabela przypadków 1-10**
tej rodziny defektu (numer, ekran, plik:linia, status naprawiony/zgłoszony, dyżur/commit
naprawy), sekcja „TWIERDZENIA NIEZWERYFIKOWANE" (obowiązkowa nawet pusta), sekcja
„Korekty wobec instrukcji" (obowiązkowa nawet pusta).

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (PEŁNA, `R2`) | `src/components/Interview/ConversationalPanel.tsx` · `src/components/Interview/InterviewSingleQuestionRuntime.tsx` · `src/components/Interview/InterviewWorkspace.tsx` — WYŁĄCZNIE handlery `applyDraftMappings`/`onQuestionAnswered`/wywołanie przekazania callbacku, zakaz zmian poza tym zakresem |
| Zapis (PEŁNA, NOWY PLIK, `R2`) | `src/components/Interview/__tests__/ConversationalPanel.applyDraftMappings.contract.test.tsx` (`git add -f`) |
| Zapis (WARUNKOWO, `R3`) | pliki znalezione w bounded sweep — WYŁĄCZNIE handlery pasujące do sygnatury z `R3`, jeden plik = jeden commit |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY253_FALSZYWE_ZAPISY_REPORT.md` |
| Zapis (WĄSKO, `J`) | `docs/program/funkcje/REGULA_NARZEDZIE_KONTROLNE.md` — WYŁĄCZNIE jedno zdanie aktualizujące stan przemiatania |
| Zapis (WARUNKOWO, `R1`, tylko jeśli #9 NIE jest naprawiony) | `src/components/MyWork/IdeaTableTool.tsx` — wzorcem `d0ef02897b` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/MyWork/table/forms/FormsIndex.tsx` · `src/components/MyWork/table/FormBuilder.tsx` · `src/services/api/tablePlatform.api.ts` · `src/components/MyWork/shared/__tests__/MutationResult.redContract.test.tsx` |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/funkcje/ODBIOR_ZALACZNIKI_INICJATYW.md` · `docs/program/funkcje/AUDYT_ROZJAZDY_NAZW_POL.md` (`Z14`-sąsiedztwo) |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **KROK 0 (`R1`) ROZSTRZYGA, CZY PRZYPADEK #9 W OGÓLE JEST TWOJĄ PRACĄ.** Nie
  zakładasz stanu ze zgłoszenia — mierzysz go pierwszą czynnością.
- ★★ **DOWÓD TRÓJSTRONNY DLA `R2`:** front woła + zaplecze przyjmuje + częściowa
  porażka jest WIDOCZNA użytkownikowi, nie tylko „ukryta w konsoli". Dwa z trzech ogniw
  wystarczą, żeby DALEJ gubić dane po cichu.
- ★ **`onQuestionAnswered` jest WSPÓLNYM propem** — sprawdź wszystkich konsumentów
  przed zmianą sygnatury.
- ★ **Zero placebo:** komunikat sukcesu po `Promise.allSettled` z częściową porażką
  MUSI różnić się treścią od pełnego sukcesu — sama poprawność typu (Promise zamiast
  void) nie wystarcza, jeśli UI dalej pokazuje jeden zielony toast niezależnie od
  wyniku.
- ★ **`R3` jest BOUNDED — nie przemiata całego produktu.** Jawna lista „co NIE zostało
  objęte" w raporcie jest obowiązkowa.
- ★ **`Z10`/`Z11`:** zero nowych flag. Tryb `conversational` jest już żywy bez flagi.
- ★ **Pułapki środowiska — sprawdź każdą u siebie:** `Database.ts:80-88` atrapa bazy ·
  `vitest.config.ts:210` przypina `DB_TYPE='sqlite'` · `tests/setup.ts:896` podmienia
  `global.fetch` · `Z35` (zakaz `@ts-ignore`/`eslint-disable` żeby ominąć błąd typu po
  zmianie sygnatury `onQuestionAnswered` — jeśli typ się nie zgadza, napraw wołających,
  nie wyciszaj).
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej
  sekcji jest podstawą odrzucenia dyżuru.
