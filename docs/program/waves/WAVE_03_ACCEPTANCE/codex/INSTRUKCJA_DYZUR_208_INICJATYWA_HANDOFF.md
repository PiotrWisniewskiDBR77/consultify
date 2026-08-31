# INSTRUKCJA DYŻURU nr 208 — Codex — „Inicjatywa z czatu → realizacja (17-D, §3 P4 ARCHITEKTURA_AGENTA_TERESY.md) — karta „Przekaż do realizacji” za zgodą, most z martwej draft-sieroty do kanonicznego REGISTERED_DRAFT, reszta governance (definicja→analiza→portfel→harmonogram→handoff) zostaje w 100% w ISTNIEJĄCYCH, ręcznych ekranach"

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
> **wyłącznie** `/private/tmp/cx-day208-inicjatywa-handoff`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `29f004c670`**
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
Zakres: **Moduł 17, pozycja 17-D — §3 P4 z `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` ("Inicjatywa z czatu = sierota — draft bez wołania registerInitiative→handoff→execution_case"). Przekrojowy: backend `server/src/domain/initiatives-execution/**` (nowa komenda materialna) + `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` (nowa trasa) + jedna migracja (tabela paragonów, wzorem 946/20261061) + front `src/components/AIChat/**` (nowa karta czatu, konsensus). Zero zmian w istniejącym łańcuchu governance (definitionDecision/analysisDecision/portfolioDecision/scheduleDecision/handoffAcceptance) i zero zmian ekranów Initiatives poza tym, że karta czatu na końcu do nich nawiguje.**.
Trasy front: ``src/components/AIChat/UnifiedChatPanel.tsx` — WYŁĄCZNIE gałąź `payloadKind === 'initiative'` (ok. linii 2219-2237, dziś: auto-navigate + toast, ZERO bramki zgody); NOWY plik `src/components/AIChat/GovernedInitiativeHandoffCard.tsx` (wzorem `GovernedChatHandoffCard.tsx`, ten sam katalog, NIE modyfikujesz wzorca). Odczyt (kontekst, nie zmieniasz): `src/components/Initiatives/InitiativeDocumentView.tsx` (ok. linii 793, 1448-1449, 5551-5570, 11299-11305 — `primaryLifecycleAction`/`nModePropertyFields`, dowód że `InitiativeDraftJourney` jest USUNIĘTA stąd, martwa); `src/components/Initiatives/InitiativeDraftJourney.tsx` (plik ISTNIEJE, export ISTNIEJE, ale ZERO callerów w `src/` poza samym sobą i testami — zweryfikuj to SAM przed założeniem, że cokolwiek go renderuje).`. Trasy tył: `NOWY plik `server/src/domain/initiatives-execution/adoptChatDraftInitiative.ts` (wzorem `adoptAcceptedClassicInitiative.ts`, ten sam katalog — czytasz, NIE modyfikujesz wzorca); nowa metoda transakcji w `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts` (wzorem `adoptAcceptedClassicInitiative` metody, linie 90-150 tego pliku — inny JOIN, patrz sekcja 3); nowa trasa `POST /adoptions/chat-draft` w `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` (wzorem `POST /adoptions/accepted-classic`, ok. linii 1750-1808, i schemą Zod wzorem `AdoptAcceptedClassicSchema`, linie 178-186); NOWA migracja tabeli paragonów, wzorem `server/migrations/20261061_flow_accepted_classic_runtime_adoption.sql` (append-only, trigger blokujący UPDATE/DELETE). Odczyt (kontekst, NIE zmieniasz): `server/src/services/ai/tools/generateInitiative.ts` (całość — geneza draftu-sieroty, linie 25-29 import `createInitiativeRecord`, linie ok. 267-330 wywołanie); `server/src/services/initiativeGenerationService.ts` (`createInitiative`, linie 1451+); `server/src/services/initiative/createInitiativeService.ts` (INSERT realny, linie 316-334 — kolumny `owner_business_id`/`owner_execution_id` istnieją w schemacie, ale generateInitiative.ts NIGDY ich nie wypełnia); `server/src/domain/initiatives-execution/registerInitiative.ts`, `submitSourceProposal.ts`, `definitionDecision.ts`, `analysisDecision.ts`, `portfolioDecision.ts`, `scheduleDecision.ts`, `handoffAcceptance.ts`, `definitionReadiness.ts`, `analysisReadiness.ts`, `materialCommand.ts` (`executeMaterialCommand`, linia 457) — CAŁY istniejący łańcuch governance, poza zakresem zmian.`.

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
WT=/private/tmp/cx-day208-inicjatywa-handoff
MARKER=29f004c670

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day208-inicjatywa-handoff-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day208-inicjatywa-handoff/config.worktree"
cat "$VAULT/worktrees/cx-day208-inicjatywa-handoff/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day208-inicjatywa-handoff-scratch
mkdir -p /private/tmp/cx-day208-inicjatywa-handoff-artefakty

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
git -C "$VAULT" log --oneline 29f004c670..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 29f004c670..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day208-inicjatywa-handoff-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 29f004c670..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `siedem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day208-inicjatywa-handoff

# (T1) Geneza draftu-sieroty: surowy INSERT, zero komendy materialnej, zero właściciela
sed -n '1,29p;250,335p' server/src/services/ai/tools/generateInitiative.ts | grep -n "createInitiativeRecord\|no approval gate\|import"
grep -n "owner_business_id\|owner_execution_id\|INSERT INTO initiatives" server/src/services/initiative/createInitiativeService.ts
#   oczekiwane: import `createInitiativeRecord` z `initiativeGenerationService.js` (linia 29);
#   INSERT w createInitiativeService.ts (linie ok. 316-334) MA kolumny owner_business_id/
#   owner_execution_id; generateInitiative.ts NIE przekazuje żadnej z nich w wywołaniu.

# (T2) Front dziś: auto-navigate + toast, zero bramki zgody
sed -n '2215,2240p' src/components/AIChat/UnifiedChatPanel.tsx
#   oczekiwane: gałąź `payloadKind === 'initiative'` nawiguje NATYCHMIAST do
#   `/initiatives?open=<id>&mode=doc` i pokazuje toast — bez żadnego pytania o zgodę.

# (T3) InitiativeDraftJourney — plik istnieje, ale ZERO callerów w src/
grep -rln "InitiativeDraftJourney" src/ --include='*.tsx' | grep -v __tests__
sed -n '790,820p' src/components/Initiatives/InitiativeDocumentView.tsx
#   oczekiwane: JEDYNE trafienia to InitiativeDraftJourney.tsx sam siebie;
#   komentarz w InitiativeDocumentView.tsx potwierdza USUNIĘCIE ("był jedynym callerem").

# (T4) Wzorzec do naśladowania: adoptAcceptedClassicInitiative — kształt komendy i trasy
sed -n '1,40p' server/src/domain/initiatives-execution/adoptAcceptedClassicInitiative.ts
sed -n '1750,1808p' server/src/routes/pmo/initiativesExecutionRuntime.routes.ts
sed -n '90,150p' server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts
#   oczekiwane: payload {candidateId, projectId, initiativeOwnerId, visibility};
#   trasa woła deps.authorize(...,'initiative.create') + isEligibleInitiativeOwner + resolvePolicy;
#   transakcja JOIN-uje initiative_candidates+swot_candidate_handoffs+tool_outputs (status='accepted'/'approved')
#   — to jest SWOT-specyficzne, Twoja komenda dla teresa_chat NIE robi tego JOIN-a.

# (T5) registerInitiative — dlaczego naiwne wywołanie by padło (content-match trap)
sed -n '82,130p' server/src/domain/initiatives-execution/registerInitiative.ts
#   oczekiwane: wymaga initiative_candidates ze status='pending'/evidenceState='READY'/
#   duplicateState='CLEAR' ORAZ dokładnej zgodności title/problem/proposedOutcome/projectId/
#   visibility/initiativeOwnerId z propozycją — draft czatowy nie ma takiej propozycji.

# (T6) Readiness endpoints 404 przed rejestracją — kanoniczny reader, nie legacy initiatives
sed -n '2283,2320p' server/src/routes/pmo/initiativesExecutionRuntime.routes.ts | grep -n "findById\|NOT_FOUND"
#   oczekiwane: deps.reader.findById zwraca null dla niezarejestrowanego id → 404;
#   karta czatu NIE MA co pokazać jako readiness przed adopcją.

# (T7) PORT I MIEJSCE NA DYSKU
df -h /
lsof -nP -iTCP:6148 -iTCP:5088 -iTCP:5089 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -E 'cx-day(204|205|206|207|208)'
#   oczekiwane: df >5GB wolnego; lsof PUSTY; docker ps może pokazać cx-day204/205/206/207-pg
#   żywe (dyżury równoległe) — NIE dotykaj ich, tylko cx-day208-pg jest Twój.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day208-inicjatywa-handoff-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6148`. Twój JEDYNY port harnessu to `5088 i 5089`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day208-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6127, 5010-5077, 6404-6411 (odbiory nadzorcy i dyżury wcześniejsze niż 204). Zmierzone WPROST z cfg/body dyżurów równoległych na tym torze: 6144/5078-5079 (dyżur 204), 6145/5080-5081 (dyżur 205), 6146/5084-5085 (dyżur 206 — jego WŁASNY cfg mówi `5084 i 5085`, NIE `5082-5083` jak zgadywał wcześniejszy cfg205; ufaj cfg206, nie cudzej prognozie). Dyżur 207: PORT_DB/PORT_HARNESS NIE ZNALEZIONY w żadnym cfg/body dostępnym z tego miejsca (katalog roboczy `w207` istnieje w scratchu nadzorcy, ale bez configu) — zakres `6147`/`5086-5087` podany Ci przez nadzorcę jako fakt zewnętrzny, NIE zweryfikowany przeze mnie w plikach; potwierdź `lsof`/`docker ps` sam w BLOKU 0 i zapisz wynik. Twój własny, wyłączny przydział: baza `6148`, harness `5088 i 5089`. ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 ZAJĘTY NA STAŁE przez adb. ★ PORTY 5060-5061 potwierdź jako wolne przed startem (dyżur 196, historyczny). Zmierzone TERAZ (2026-08-31, przed wydaniem tej instrukcji): `lsof -nP -iTCP:6144-6149 -iTCP:5078-5091 -sTCP:LISTEN` pokazuje WYŁĄCZNIE `127.0.0.1:6146` (kontener `cx-day206-pg` żywy — dyżur równoległy, NIE dotykaj) — Twoje porty 6148/5088/5089 były WOLNE w chwili pomiaru, ale to migawka, nie gwarancja; zweryfikuj ponownie sam w BLOKU 0.`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak nowych flag i zero zmiany wartości domyślnej istniejącej flagi. Karta czatu i nowa trasa `/adoptions/chat-draft` są ZAWSZE aktywne (żadna flaga ich nie osłania) — zgoda użytkownika (klik „Przekaż do realizacji”) JEST bramką, nie flaga. Jeśli podczas pracy okaże się, że potrzebujesz bramki wyłączającej (np. na czas odbioru), dodaj `ENABLE_CHAT_INITIATIVE_HANDOFF` z `z.boolean().default(true)` (wzorem `ENABLE_TERESA_RECORD_CREATE`, `server/src/config/FeatureFlags.ts:51`) i zapisz w raporcie DLACZEGO — to Twoja decyzja inżynierska, nie zamówienie tej instrukcji.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*`; DODATKOWO dla tego dyżuru: `deps.authorize(actor, projectId, 'initiative.create')` i `deps.reader.isEligibleInitiativeOwner(...)` w `initiativesExecutionRuntime.routes.ts` (wzorzec z trasy `/adoptions/accepted-classic`, linie ok. 1750-1770) — Twoja nowa trasa `/adoptions/chat-draft` MUSI wołać OBIE te same bramki, identycznie; nie wymyślaj własnej autoryzacji.`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY208_INICJATYWA_HANDOFF_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — ten dyżur jest przekrojowy silnik+czat (Moduł 17), nie jeden moduł z tabeli WAVE_03_ACCEPTANCE.. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day208-inicjatywa-handoff-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day208-inicjatywa-handoff-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE dotykasz ŻADNEGO pliku istniejącego łańcucha governance** — `registerInitiative.ts`, `submitSourceProposal.ts`, `definitionDecision.ts`, `analysisDecision.ts`, `portfolioDecision.ts`, `scheduleDecision.ts`, `handoffAcceptance.ts`, `definitionReadiness.ts`, `analysisReadiness.ts`. Twoja komenda `initiative.adopt-chat-draft` jest SIOSTRĄ `initiative.adopt-accepted-classic`, nie zmienia go, nie woła go, nie go rozszerza. ★★ **NIE modyfikujesz `adoptAcceptedClassicInitiative.ts`** — to wzorzec do CZYTANIA i naśladowania w NOWYM pliku, nie do generalizowania/parametryzowania pod dwa źródła naraz (SWOT-specyficzny JOIN zostaje SWOT-specyficzny). ★★ **NIE budujesz żadnego auto-uzupełniania `initiativeOwnerId`/`projectId` domyślną wartością** (np. aktorem wywołującym adopcję) — to decyzja człowieka; jeśli brakuje, karta pokazuje "co brakuje" i kieruje do ISTNIEJĄCEGO ekranu dokumentu inicjatywy (gdzie `canEditOwner`/właściwości są już edytowalne), NIE zgaduje. ★★ **NIE resurektujesz `InitiativeDraftJourney.tsx`** do renderowania — jest martwy celowo (decyzja "Etap 5 gridu n-Type"), Twoja karta żyje WYŁĄCZNIE w czacie (`AIChat/`), nie w dokumencie inicjatywy. ★★ **NIE wołasz `initiative.register`/`source-proposal.submit` bezpośrednio** z nowej trasy — most jest PRZEZ nową komendę `adopt-chat-draft`, wzorem `adopt-accepted-classic`, nie przez dwuetapowy submit→register (jego content-match trap, patrz T5, jest niepotrzebnym ryzykiem, którego wzorzec `adoptAcceptedClassicInitiative` unika). ★★ **Karta czatu NIE automatyzuje żadnej zgody governance poza samym wejściem do kanonu** — definicja (8 kart), analiza (10 kart), portfel, harmonogram, handoff zostają W CAŁOŚCI ręczne, przez ISTNIEJĄCE ekrany (`primaryLifecycleAction`, `GateReadinessSection`, `InitiativeGatesWorkflowTable`) — karta po udanej adopcji WYŁĄCZNIE nawiguje tam (`/initiatives?open=<id>&mode=doc`), nie wykonuje żadnego kolejnego kroku sama. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | Kontekst obowiązkowy: `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §3, wiersz P4: "Inicjatywa z czatu = sierota — draft bez wołania registerInitiative→handoff→execution_case", ruch nazwany wprost: "opcjonalny krok »przekaż do realizacji« za zgodą (łańcuch z planu migracji A4.0)". Zmierzone dziś (31.08, tip `29f004c670`): `server/src/services/ai/tools/generateInitiative.ts` — narzędzie czatu `generate_initiative` (nagłówek, linie 4-9: "no approval gate, because a draft is fully reversible and never promotes") tworzy wiersz w LEGACY tabeli `initiatives` przez `initiativeGenerationService.createInitiative` → `createInitiativeService.ts` (INSERT realny, linie 316-334) — SUROWY INSERT, nie przez żadną komendę materialną, nie przez `executeMaterialCommand`. Front (`UnifiedChatPanel.tsx`, gałąź `payloadKind === 'initiative'`, ok. linii 2219-2237) reaguje na to WYŁĄCZNIE deep-linkiem `/initiatives?open=<id>&mode=doc` + toastem "Initiative created from chat" — ZERO bramki zgody, ZERO wzmianki o governance. Dowód "sieroty": lifecycle kanoniczny (zmierzony w body dyżuru 204, T8: `REGISTERED_DRAFT` → `DEFINED` → `ANALYZING` → `READY_FOR_DECISION` → `APPROVED_BACKLOG` → `SCHEDULED` → `IN_EXECUTION`, każde przejście przez osobną komendę materialną w `initiatives-execution/`) w OGÓLE nie zna wiersza czatowego, bo `registerInitiative` (`registerInitiative.ts:82-129`) wymaga PRZED-ISTNIEJĄCEJ propozycji źródłowej w `initiative_candidates` (`status='pending'`, `evidenceState='READY'`, `duplicateState='CLEAR'`) ORAZ dokładnej zgodności treści (`title`/`problem`/`proposedOutcome`/`projectId`/`visibility`/`initiativeOwnerId` MUSZĄ być identyczne z propozycją, inaczej `MaterialCommandConflictError`) — czatowy draft nie ma takiej propozycji, więc naiwne wywołanie `initiative.register` PADNIE. Endpointy readiness (`GET /initiatives/:id/gates/definition/readiness`, trasa linia 2284; `GET /initiatives/:id/gates/analysis/readiness`, trasa linia 2709) czytają przez `deps.reader.findById` z KANONICZNEGO magazynu agregatów — dla niezarejestrowanego draftu zwrócą `404 NOT_FOUND`, więc karta czatu w OGÓLE nie ma co pokazać jako "co brakuje", dopóki draft nie wejdzie do kanonu. ★ ZNALEZISKO KLUCZOWE: repo JUŻ MA gotowy wzorzec dokładnie tego mostu — `server/src/domain/initiatives-execution/adoptAcceptedClassicInitiative.ts` + trasa `POST /adoptions/accepted-classic` (`initiativesExecutionRuntime.routes.ts`, ok. linii 1750-1808) — komenda materialna `initiative.adopt-accepted-classic`, która bierze ISTNIEJĄCY "klasyczny" wiersz (dziś: zaakceptowany kandydat SWOT z `initiative_candidates`+`swot_candidate_handoffs`+`tool_outputs`, zweryfikowane w transakcji `postgresMaterialCommandUnitOfWork.ts:90-150`, JOIN po `c.status='accepted'` i `o.status='approved'`) i WCHODZI z nim BEZPOŚREDNIO do stanu `REGISTERED_DRAFT`, z pominięciem dwuetapowego `submit-proposal→register` i jego pułapki dopasowania treści. To jest wzorzec do NAŚLADOWANIA (nowy plik-siostra, NIE modyfikacja wzorca) dla źródła `teresa_chat` zamiast `accepted_classic_swot_candidate` — most czytający wprost z wiersza `initiatives` (`source_type='teresa_chat'`, stemplowany w `generateInitiative.ts` funkcją `stampLineage`), bez zależności od SWOT/tool_outputs. Drugie zmierzone ograniczenie: `createInitiativeService.ts` (INSERT, linie 316-334) MA kolumny `owner_business_id`/`owner_execution_id` w schemacie, ale `generateInitiative.ts` NIGDY ich nie przekazuje — każdy draft czatowy jest dziś BEZ właściciela. To nie jest coś do naprawienia w tym dyżurze; to jest "co brakuje", które karta czatu MUSI pokazać uczciwie, zanim zaproponuje adopcję (właściciel i projekt to decyzja CZŁOWIEKA, nie coś do zgadnięcia domyślną wartością — zobacz PUŁAPKA druga w sekcji 3, zbieżna z ostrzeżeniem `selfApprovalAllowed` z dyżuru 204: `authorityId === actorId` bez jawnej zgody jest odrzucane w `definitionDecision.ts:124-126`/`scheduleDecision.ts:194-199`/`portfolioDecision.ts:62-65} — ten sam duch: nie zgaduj autorytetu za człowieka). Trzecie zmierzone: `InitiativeDraftJourney.tsx` (komponent "co dalej" z trzecim krokiem `advance`→"Advance in the process") ISTNIEJE jako plik i export, ale komentarz w `InitiativeDocumentView.tsx` (ok. linii 793-819) mówi wprost: USUNIĘTY z renderowania w ramach "Etap 5 gridu n-Type" (SSOT zakazuje instrukcyjnych pasków dublujących status/Properties/Actions) — "był jedynym callerem w repo". Dziś "następna brama" żyje WYŁĄCZNIE w `nModePropertyFields` (pole tylko-do-odczytu) i w `primaryLifecycleAction` (Menu 1, JEDEN przycisk = przejście stanu). Karta czatu z tego dyżuru MUSI nawigować do TEGO realnego miejsca (dokument inicjatywy, ISTNIEJĄCE UI), nie odtwarzać własnej wersji "co dalej". |

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
cd /private/tmp/cx-day208-inicjatywa-handoff

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day208-pg psql -U postgres -d cx208 \
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
cd /private/tmp/cx-day208-inicjatywa-handoff

docker run -d --name cx-day208-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx208 \
  -p 127.0.0.1:6148:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day208-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6148/cx208 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6148/cx208 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day208-inicjatywa-handoff && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6148/cx208 \
JWT_SECRET=cx208-test-secret-do-not-reuse \
npx vitest run server/src/domain/initiatives-execution/__tests__ server/src/routes/pmo/__tests__ src/components/AIChat/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day208-inicjatywa-handoff-artefakty/day208-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day208-inicjatywa-handoff && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/domain/initiatives-execution/__tests__ server/src/routes/pmo/__tests__ src/components/AIChat/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day208-inicjatywa-handoff-artefakty/day208-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day208-inicjatywa-handoff/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day208-pg psql -U postgres -d cx208 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day208-pg`.
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
> **(e) ★★ **Pierwsza: naiwne "po prostu wywołaj registerInitiative" nie zadziała.** `registerInitiative` wymaga PRZED-ISTNIEJĄCEJ propozycji źródłowej z dokładnym dopasowaniem treści (T5) — draft czatowy jej nie ma. Poprawny wzorzec to BEZPOŚREDNI most (jak `adoptAcceptedClassicInitiative`), nie dwuetapowy submit→register. ★★ **Druga: `initiativeOwnerId`/`projectId` są PUSTE dla każdego draftu czatowego z definicji dzisiejszego kodu** (T1) — to nie usterka do naprawienia w tym dyżurze, to fakt architektury, który karta MUSI pokazać jako "co brakuje" ZANIM zaproponuje adopcję. Pokusa wypełnienia ich domyślną wartością (np. `initiativeOwnerId = actorId`) jest ZAKAZANA — to przypisanie własności bez świadomej decyzji człowieka, w duchu tego samego ostrzeżenia co `selfApprovalAllowed` z dyżuru 204 (autorytet nie może być zgadywany). ★★ **Trzecia: `duplicateState` w `submitSourceProposal` jest ZAWSZE `'CLEAR'`, bez żadnej realnej detekcji duplikatów** (`submitSourceProposal.ts`, walidacja) — kolejny powód, żeby iść wzorcem `adoptAcceptedClassicInitiative` (który w ogóle omija tę ścieżkę) zamiast dwuetapowego submit→register, które dałoby złudne poczucie "sprawdzone". ★★ **Czwarta: readiness endpoints (definition/analysis) 404-ują przed rejestracją** (T6) — karta czatu NIE MOŻE pokazać "8/10 kart" jako pierwszego ekranu; kolejność jest: (a) sprawdź pre-adopcyjne "co brakuje" z samego wiersza `initiatives` (owner/project/problem), (b) jeśli OK, zaproponuj adopcję, (c) po adopcji nawiguj do dokumentu, GDZIE dopiero `GateReadinessSection`/`InitiativeGatesWorkflowTable` pokażą realne braki definicji/analizy. ★★ **Piąta: `InitiativeDraftJourney.tsx` istnieje w repo i może zmylić grepem "przecież już jest banner co dalej"** — jest martwy (T3), zero callerów, celowo usunięty. Nie buduj na nim, nie przywracaj go.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day208-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day208-inicjatywa-handoff-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`Jedna pozycja R1 (przekrojowa: nowa komenda materialna + trasa + migracja paragonu + karta czatu). Nie dziel na R1/R2 — most `draft→REGISTERED_DRAFT` i karta zgody w czacie to jeden nierozdzielny łańcuch dowodowy (bez trasy karta nie ma czego wołać; bez karty trasa nie ma wołacza produkcyjnego).`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6148` albo `5088 i 5089` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6148` albo `5088 i 5089`** (`Z7`).

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

`docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §3, wiersz P4:
**"Inicjatywa z czatu = sierota — draft bez wołania
registerInitiative→handoff→execution_case"**, stan `zerwane`, ruch nazwany
wprost: *"opcjonalny krok »przekaż do realizacji« za zgodą (łańcuch z planu
migracji A4.0)"*.

Zmierzone dziś (tip `29f004c670`): narzędzie czatu `generate_initiative`
(`server/src/services/ai/tools/generateInitiative.ts`, nagłówek linie 4-9:
*"no approval gate, because a draft is fully reversible and never
promotes"*) tworzy DRAFT surowym `INSERT INTO initiatives`
(`initiativeGenerationService.createInitiative` →
`createInitiativeService.ts`, linie 316-334) — **nie** przez żadną komendę
materialną, **nie** przez `executeMaterialCommand`. Front
(`UnifiedChatPanel.tsx`, gałąź `payloadKind === 'initiative'`, linie
2219-2237) reaguje wyłącznie deep-linkiem `/initiatives?open=<id>&mode=doc` +
toastem "Initiative created from chat" — **zero bramki zgody, zero wzmianki
o governance.**

Kanoniczny lifecycle inicjatywy (zmierzony w dyżurze 204, T8):
`REGISTERED_DRAFT → DEFINED → ANALYZING → READY_FOR_DECISION →
APPROVED_BACKLOG → SCHEDULED → IN_EXECUTION`, każde przejście przez osobną
komendę materialną w `server/src/domain/initiatives-execution/`. Draft
czatowy jest poza tym światem całkowicie: `registerInitiative.ts` (linie
82-129) wymaga PRZED-ISTNIEJĄCEJ propozycji źródłowej w
`initiative_candidates` (`status='pending'`, `evidenceState='READY'`,
`duplicateState='CLEAR'`) ORAZ dokładnej zgodności treści (`title`/
`problem`/`proposedOutcome`/`projectId`/`visibility`/`initiativeOwnerId`
identyczne z propozycją — inaczej `MaterialCommandConflictError`). Draft
czatowy takiej propozycji nie ma. Naiwne wywołanie `initiative.register`
padnie.

**Znalezisko kluczowe, które zmienia kształt tego dyżuru: wzorzec mostu już
istnieje w repo.** `server/src/domain/initiatives-execution/
adoptAcceptedClassicInitiative.ts` + trasa `POST /adoptions/accepted-classic`
(`initiativesExecutionRuntime.routes.ts`, linie 1750-1808) to komenda
materialna `initiative.adopt-accepted-classic`, która bierze ISTNIEJĄCY
"klasyczny" wiersz (dziś: zaakceptowany kandydat SWOT) i wchodzi z nim
BEZPOŚREDNIO do stanu `REGISTERED_DRAFT`, z pominięciem dwuetapowego
`submit-proposal→register` i jego pułapki dopasowania treści. To jest
wzorzec do **naśladowania w nowym pliku-siostrze** dla źródła `teresa_chat`
— nie do modyfikacji.

Drugie zmierzone ograniczenie: `createInitiativeService.ts` (INSERT, linie
316-334) MA kolumny `owner_business_id`/`owner_execution_id` w schemacie,
ale `generateInitiative.ts` **nigdy** ich nie przekazuje — każdy draft
czatowy jest dziś bez właściciela. To nie jest coś do naprawienia tutaj; to
jest fakt, który karta czatu musi pokazać uczciwie jako "co brakuje", zanim
zaproponuje adopcję.

Trzecie zmierzone: `InitiativeDraftJourney.tsx` (komponent "co dalej" z
krokiem "Advance in the process") istnieje jako plik i eksport, ale
komentarz w `InitiativeDocumentView.tsx` (linie 793-819) mówi wprost:
usunięty z renderowania w ramach "Etap 5 gridu n-Type" — "był jedynym
callerem w repo". Dziś "następna brama" żyje wyłącznie w
`nModePropertyFields` (pole tylko-do-odczytu) i `primaryLifecycleAction`
(Menu 1, jeden przycisk = przejście stanu). Karta z tego dyżuru musi
nawigować do TEGO realnego miejsca, nie odtwarzać własnej wersji "co dalej".

# 2. TEZY ZLECENIA

- **T1.** Zakres jest UCZCIWY: krok "przekaż do realizacji" prowadzi
  użytkownika przez ISTNIEJĄCE ekrany governance (definicja → analiza →
  portfel → harmonogram → handoff zostają w 100% ręczne). Automatyzujesz
  WYŁĄCZNIE mechaniczne wejście draftu do kanonu (`REGISTERED_DRAFT`) — nie
  automatyzujesz żadnej zgody governance za człowieka.
- **T2.** Wzorzec `adoptAcceptedClassicInitiative.ts` jest właściwym
  punktem odniesienia — nowa komenda `initiative.adopt-chat-draft` jest jego
  SIOSTRĄ (inny JOIN źródłowy: plain `initiatives` z `source_type='teresa_
  chat'`, zamiast `initiative_candidates`+`swot_candidate_handoffs`+
  `tool_outputs`), nie jego rozszerzeniem.
- **T3.** Karta czatu jest bramką zgody — dziś jej NIE MA (auto-navigate),
  więc nawet samo dodanie kroku "czy na pewno?" przed nawigacją jest częścią
  wartości tego dyżuru, niezależnie od tego, czy adopcja się powiedzie.
- **T4.** `initiativeOwnerId`/`projectId` puste = legalny, częsty stan
  "co brakuje" — nie usterka do naprawienia, tylko fakt do pokazania.
- **T5.** Readiness (definition/analysis) nie istnieje przed rejestracją —
  kolejność UI jest: pre-adopcyjne braki (owner/project/problem) → adopcja →
  dopiero wtedy realne braki definicji/analizy w dokumencie inicjatywy.

# 3. POZYCJA DYŻURU (R1 — jedna, przekrojowa)

## Krok 1 — nowa komenda materialna `initiative.adopt-chat-draft`

Nowy plik `server/src/domain/initiatives-execution/
adoptChatDraftInitiative.ts`, wzorem `adoptAcceptedClassicInitiative.ts`
(przeczytaj go W CAŁOŚCI przed pisaniem — struktura payloadu, walidacja
`envelope.commandType`/`createIfMissing`/`expectedVersion === 0`, wywołanie
`executeMaterialCommand`, kształt zwracanego stanu `RegisteredInitiative`-
podobnego z `lifecycleState: 'REGISTERED_DRAFT'`).

Payload:

```ts
export type AdoptChatDraftPayload = {
  chatInitiativeId: string; // id wiersza w LEGACY `initiatives` (source_type='teresa_chat')
  projectId: string;
  initiativeOwnerId: string;
  visibility: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
};
```

Transakcja (nowa metoda w `postgresMaterialCommandUnitOfWork.ts`, wzorem
`adoptAcceptedClassicInitiative` — linie 90-150 tego pliku — ale **inny
JOIN**, bez `swot_candidate_handoffs`/`tool_outputs`):

```sql
SELECT id, organization_id, project_id, title, problem_statement,
       source_type, source_id, owner_business_id, owner_execution_id
  FROM initiatives
 WHERE organization_id = $1 AND id = $2 AND source_type = 'teresa_chat'
   AND project_id IS NOT NULL
 FOR UPDATE
```

Jeśli `project_id`/tytuł/`problem_statement` puste lub `source_type !=
'teresa_chat'` → `MaterialCommandValidationError` (dokładny komunikat: Twój
wybór, ale musi nazwać CO brakuje, nie ogólne "invalid"). Advisory lock
wzorem `pg_advisory_xact_lock(hashtextextended($1, 0))` z kluczem
`${organizationId}:chat-draft:${chatInitiativeId}` (mirror linii 100-102
wzorca — zapobiega podwójnej adopcji tego samego draftu w wyścigu).

Paragon append-only: nowa migracja `server/migrations/
20261730_flow_teresa_chat_draft_adoption.sql`, **wzorem dosłownym**
`20261061_flow_accepted_classic_runtime_adoption.sql` (przeczytaj go w
całości — kształt tabeli, trigger blokujący `UPDATE`/`DELETE`, indeksy).
Nazwij tabelę `flow_teresa_chat_runtime_adoptions`, kolumny analogiczne
(`receipt_id`, `chat_initiative_id`, `runtime_initiative_id`, `project_id`,
zamiast `candidate_id`/`classic_initiative_id`/`swot_handoff_receipt_id`).

Zwracany stan: `lifecycleState: 'REGISTERED_DRAFT'`, `source: {sourceType:
'teresa_chat', sourceId: <chatInitiativeId>, freshness: 'CURRENT', ...}`,
`governance: {policyId, policyVersion}`, `readiness: 'NOT_EVALUATED'` —
identyczny kształt do `adoptAcceptedClassicInitiative`, tak żeby front
dostał ten sam kontrakt niezależnie od źródła adopcji.

## Krok 2 — nowa trasa `POST /adoptions/chat-draft`

W `initiativesExecutionRuntime.routes.ts`, tuż obok `/adoptions/accepted-
classic` (linie 1750-1808) — **wzorem dosłownym** tej trasy: ten sam
`AdoptAcceptedClassicSchema`-styl Zod (nowy `AdoptChatDraftSchema`), te same
DWIE bramki w tej samej kolejności:

```ts
if (!(await deps.authorize(actor, parsed.data.projectId, 'initiative.create'))) {
  res.status(403).json({ error: { code: 'CAPABILITY_REQUIRED' } });
  return;
}
if (!(await deps.reader.isEligibleInitiativeOwner(
  actor.organizationId, parsed.data.projectId, parsed.data.initiativeOwnerId
))) {
  res.status(422).json({ error: { code: 'INITIATIVE_OWNER_INELIGIBLE' } });
  return;
}
```

Potem `deps.resolvePolicy(...)` i wywołanie `adoptChatDraftInitiative(deps.
unitOfWork, {..., commandType: 'initiative.adopt-chat-draft', createIfMissing:
true, expectedVersion: 0})`. `aggregateId` (initiativeId nowego kanonicznego
agregatu) — **decyzja do podjęcia przez Ciebie**: reużyj `chatInitiativeId`
jako `aggregateId` (jedna inicjatywa, jeden id, od draftu do kanonu) czy
wygeneruj nowy id? Wzorzec `adopt-accepted-classic` generuje NOWY
`aggregateId` (bo klasyczna inicjatywa i kanoniczna to inne encje). Dla
czatowego draftu jest tylko JEDEN wiersz `initiatives` od początku do końca
— silny argument za reużyciem `chatInitiativeId`. Zapisz wybór i uzasadnienie
w raporcie.

## Krok 3 — nowa karta czatu, konsensus zamiast auto-navigate

Nowy plik `src/components/AIChat/GovernedInitiativeHandoffCard.tsx`, wzorem
`GovernedChatHandoffCard.tsx` (przeczytaj go w całości — stany `pending`/
`materializable`/`working`/`materialized`/`rejected`/`failed`/`approved`,
styl karty, `data-testid` konwencja). Stany dla tej karty:
- `idle` — draft utworzony, karta pokazuje "Przekaż do realizacji?" z
  przyciskiem zgody (domyślny stan po `onDeliverable` z `kind: 'initiative'`).
- `checking` — wywołanie sprawdzenia pre-adopcyjnych braków (patrz niżej).
- `blocked` — braki wykryte (brak ownera/projektu/treści problemu), CTA
  "Uzupełnij w module Initiatives" → nawiguje do `/initiatives?open=<id>&
  mode=doc` (ten sam deep-link co dziś), BEZ wywołania adopcji.
- `ready` → `adopting` → `adopted` — po zgodzie i braku blokad, wywołuje
  `POST /adoptions/chat-draft`, potem nawiguje do
  `/initiatives?open=<runtimeInitiativeId>&mode=doc`.
- `failed` — błąd adopcji (konflikt, walidacja) pokazany w karcie, bez
  automatycznego retry.

Sprawdzenie pre-adopcyjnych braków: **nie buduj nowego endpointu GET tylko
dla tego** — sprawdź NAJPIERW, czy istniejący endpoint pobierania inicjatywy
(ten, którego dziś używa `InitiativeDocumentView.tsx` przy otwarciu) już
zwraca `owner_business_id`/`owner_execution_id`/`project_id`/
`problem_statement` w payloadzie; jeśli tak, oblicz braki po stronie
frontu z tej samej odpowiedzi (zero nowego backendu na tym kroku). Jeśli
NIE zwraca — to jest pozycja do nazwania w raporcie jako "wymaga
doprecyzowania", NIE do domyślnego budowania nowej trasy bez sprawdzenia.

Podmień gałąź `payloadKind === 'initiative'` w `UnifiedChatPanel.tsx` (linie
2219-2237): zamiast natychmiastowego `navigateToRoute(...)` + toast, renderuj
`GovernedInitiativeHandoffCard` w wiadomości czatu (wzorem tego, jak inne
karty governed handoff są wstrzykiwane do strumienia wiadomości — sprawdź
`GovernedChatHandoffCard`'s caller w `UnifiedChatPanel.tsx`/`WorkCanvasDocumentPanel.tsx`
dla dokładnego mechanizmu wstrzykiwania, NIE zgaduj). Toast "Initiative
created from chat" może zostać (informacja, że DRAFT powstał, prawdziwa) —
ale nawigacja do modułu Initiatives przestaje być automatyczna; dzieje się
WYŁĄCZNIE po interakcji z kartą.

**Ukończone, gdy:** test mutacyjny pokazuje: (1) `generate_initiative` nadal
tworzy draft identycznie jak dziś (zero regresji legacy ścieżki); (2) karta
czatu renderuje się zamiast auto-navigate, z przyciskiem zgody; (3) gdy
draft ma pusty `owner_execution_id`/`project_id`, karta pokazuje stan
`blocked` z konkretnymi brakami, BEZ wywołania `/adoptions/chat-draft`; (4)
gdy braki są uzupełnione (test ustawia je bezpośrednio w bazie, symulując
że użytkownik uzupełnił je w dokumencie), klik zgody woła
`/adoptions/chat-draft`, tworzy wiersz w `flow_teresa_chat_runtime_
adoptions`, agregat `initiative` w stanie `REGISTERED_DRAFT` istnieje w
kanonicznym magazynie (`deps.reader.findById` go teraz ZNAJDUJE — wcześniej
404); (5) `GET /initiatives/:id/gates/definition/readiness` PO adopcji
zwraca prawdziwą listę braków (osiem kart), nie 404; (6) podwójne kliknięcie
zgody / powtórzone wywołanie z tym samym `clientRequestId` nie tworzy
drugiego wiersza w tabeli paragonów (test na `executeMaterialCommand`
idempotencji, wzorem testów `adopt-accepted-classic`).

**Test:** nowy plik `.pg.test.ts` w `server/src/domain/initiatives-
execution/__tests__/` wzorem testów `adoptAcceptedClassicInitiative` (jeśli
istnieją — sprawdź `__tests__/` katalog przed pisaniem) dla backendu; nowy
test frontowy (`__tests__/GovernedInitiativeHandoffCard.test.tsx` lub
rozszerzenie istniejącego testu `UnifiedChatPanel`) dla trzech stanów karty
(idle/blocked/ready).

# 4. TABELA LICENCJI PLIKOWEJ

| Zakres | Ścieżki |
|---|---|
| Zapis (nowy plik) | `server/src/domain/initiatives-execution/adoptChatDraftInitiative.ts` |
| Zapis | `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts` — wyłącznie NOWA metoda (wzorem `adoptAcceptedClassicInitiative`, linie 90-150 jako referencja, nie do zmiany) |
| Zapis | `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` — nowy import + nowy Zod schema + nowa trasa `POST /adoptions/chat-draft` (obok linii 1750-1808, bez zmiany istniejącej trasy) |
| Zapis (nowy plik) | `server/migrations/20261730_flow_teresa_chat_draft_adoption.sql` |
| Zapis (nowy plik) | `src/components/AIChat/GovernedInitiativeHandoffCard.tsx` |
| Zapis | `src/components/AIChat/UnifiedChatPanel.tsx` — wyłącznie gałąź `payloadKind === 'initiative'` (linie ok. 2219-2237) |
| Zapis | testy nowych plików (lokalizację/konwencję potwierdź wg sąsiadów w każdym katalogu) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY208_INICJATYWA_HANDOFF_REPORT.md` |
| Odczyt | `adoptAcceptedClassicInitiative.ts`, `20261061_flow_accepted_classic_runtime_adoption.sql`, trasa `/adoptions/accepted-classic` — wzorce; **nie zmieniasz** |
| Odczyt | `registerInitiative.ts`, `submitSourceProposal.ts`, `definitionDecision.ts`, `analysisDecision.ts`, `portfolioDecision.ts`, `scheduleDecision.ts`, `handoffAcceptance.ts`, `definitionReadiness.ts`, `analysisReadiness.ts` — istniejący łańcuch governance; **nie zmieniasz** |
| Odczyt | `server/src/services/ai/tools/generateInitiative.ts`, `initiativeGenerationService.ts`, `createInitiativeService.ts` — geneza draftu; **nie zmieniasz** |
| Odczyt | `src/components/Initiatives/InitiativeDocumentView.tsx`, `InitiativeDraftJourney.tsx` — kontekst "następnej bramy"; **nie zmieniasz** |
| Odczyt | `src/components/AIChat/GovernedChatHandoffCard.tsx` — wzorzec wizualny/strukturalny karty; **nie zmieniasz** |
| Odczyt | `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §3 P4 — kontrakt tego dyżuru; **nie zmieniasz** |

★ **Rozłączność z dyżurami 204-207 (równoległe):** ich zakres plikowy poza
tym co jest cytowane tu jako wzorzec-do-odczytu NIE był znany przy składaniu
tej instrukcji. Jeśli przy starcie zobaczysz w swoim worktree zmiany poza
plikami z tabeli powyżej, STOP i zgłoś w raporcie zamiast zgadywać.

# 5. TWARDE ZASADY

- ★★ **Wzorzec `adoptAcceptedClassicInitiative.ts` czytasz, nie
  modyfikujesz.** Nowa komenda jest SIOSTRĄ, nie rozszerzeniem.
- ★★ **Zero domyślnego wypełniania `initiativeOwnerId`/`projectId`.** Braki
  pokazujesz w karcie, kierujesz do istniejącego ekranu — nie zgadujesz.
- ★★ **Zero automatyzacji governance poza wejściem do kanonu.** Definicja,
  analiza, portfel, harmonogram, handoff zostają w 100% ręczne, przez
  istniejące ekrany.
- ★★ **Nie wołasz `initiative.register`/`source-proposal.submit`
  bezpośrednio** — most jest przez nową komendę adopcji, wzorem bezpośredniego
  mostu SWOT.
- ★★ **`InitiativeDraftJourney.tsx` jest martwy celowo** — nie przywracaj go
  do renderowania.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.**
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0.
- ★ Port **5000 zajęty na stałe przez macOS Control Center**, **5037 przez
  adb**. Sprawdź porty dyżurów równoległych (204-207) przed startem —
  `LISTA_PORTOW_ZAJETYCH` w cfg208 nazywa wprost, co jest zmierzone a co
  podane jako niezweryfikowany fakt zewnętrzny (dyżur 207).
- **Każdą cytowaną linię kodu/dokumentu sprawdzasz sam przed wklejeniem do
  raportu.** Numery w tej instrukcji zweryfikowano wobec markera
  `29f004c670`, ale pliki żyją (repo dzielone z dyżurami równoległymi) —
  jeśli linia się przesunęła, zaufaj SWOJEMU pomiarowi.
- **Sekcja "TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest obowiązkowa.**
  Wypisz w niej wprost co najmniej: (a) czy istniejący endpoint pobierania
  inicjatywy faktycznie zwraca `owner_business_id`/`owner_execution_id`/
  `project_id` w payloadzie dziś — nie sprawdziłem tego bezpośrednio, tylko
  wywnioskowałem z INSERT-a; (b) czy w repo istnieją już testy dla
  `adoptAcceptedClassicInitiative` do wzorowania struktury Twojego testu —
  nie sprawdziłem `__tests__/` katalogu tego pliku; (c) czy Twój wybór
  `aggregateId` (reużyty `chatInitiativeId` vs nowy) koliduje z czymkolwiek
  innym w kodzie, co zakłada, że `initiatives.id` i kanoniczny `initiativeId`
  nigdy nie są tym samym stringiem — zweryfikuj przed decyzją; (d) mechanizm
  wstrzykiwania kart governed handoff do strumienia wiadomości w
  `UnifiedChatPanel.tsx` — nie prześledziłem go do końca, tylko wskazałem,
  że wzorzec (`GovernedChatHandoffCard`) ma jakiegoś callera do naśladowania.
