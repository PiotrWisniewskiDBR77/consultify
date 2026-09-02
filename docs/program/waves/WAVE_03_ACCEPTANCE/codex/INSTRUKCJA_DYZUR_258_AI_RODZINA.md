# INSTRUKCJA DYŻURU nr 258 — Codex — „★★ KROK 0 — WYPISZ CAŁĄ RODZINĘ MECHANIZMU „AI PROPONUJE, CZŁOWIEK AKCEPTUJE”, ZANIM COKOLWIEK SCALASZ. Zmierzone bezpośrednio w kodzie: `presentation_ai_operations` + trasy inline w `presentations.routes.ts` (propozycja→`INSERT status='pending'`→`PUT`/`resolve`→`UPDATE status`, np. linie 872-928) i `ai_actions` + `server/src/services/aiActionExecutor.ts` z dyżuru 207 są **dwiema całkowicie niezależnymi implementacjami tego samego kształtu** — zero wspólnego kodu. To NIE jest para, tylko próbka: wstępny przesiew tego dyżuru (SEED, nie wynik — `R1` musi go zweryfikować i rozszerzyć) znalazł już **cztery kolejne** niezależne rodziny tabel z własnym serwisem proponuj/zatwierdź: `swot_proposals` (`server/src/services/ai/swotProposalService.ts`, `server/src/sharedRuntime/config/swot/swotAcceptGate.ts`), `myw_agent_materialization_proposals`+`_approvals` (`server/src/services/myWork/agentApprovedMaterializationService.ts`), `v8_agent_proposal_versions`+`_scope_reviews`+`_governance_events` (`server/src/services/v8/agentProposalGovernanceService.ts`), `case_workspace_action_proposals`+`_decisions` (`server/src/services/caseWorkspace/proposalApprovalService.ts`) — czyli **co najmniej sześć** niezależnych kopii, nie dwie. Produkt tego dyżuru: **tabela pełnej rodziny + rekomendacja, którą implementację zostawić jako kanoniczną i dlaczego.** ★ ZAKAZ SCALANIA — to jest pomiar pod decyzję właściciela, nie przebudowa. Kontekst nienaruszalny (`CLAUDE.md`, lekcja „naprawa per-wywołanie odrasta”): punktowa naprawa tego kształtu w tym repo już raz odrosła po ośmiu tygodniach w dwunastu plikach, dlatego ZANIM ktokolwiek zacznie konsolidować, musi istnieć jedna, kompletna, zmierzona lista — nie domysł nadzorcy."

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
> **wyłącznie** `/private/tmp/cx-day258-ai-rodzina`.

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
Zakres: ****PRZEKROJOWE — MECHANIZM „AI PROPONUJE, CZŁOWIEK AKCEPTUJE” W CAŁYM PRODUKCIE.** Nie jeden moduł: ten mechanizm (model proponuje zmianę, wiersz zapisuje `status=pending`, człowiek klika approve/reject, dopiero wtedy materializacja) jest odtwarzany od nowa w kolejnych narzędziach zamiast być reużywany. Zmierzone jako fakt: `presentation_ai_operations` i trasy inline w `server/src/routes/presentations.routes.ts` (m.in. linie 872-928, 5159-5165, 6920-6930, 7067-7238, 7366-7540) są **niezależne** od `ai_actions`/`AIActionExecutor` z dyżuru 207 (`server/src/services/aiActionExecutor.ts`) — zero wspólnego kodu, zero wspólnej tabeli, zero wspólnego serwisu.**.
Trasy front: `brak w zakresie ZAPISU tego dyżuru — dla KAŻDEJ pozycji rodziny (`R1`) ustal i wpisz do raportu jako fakt, nie założenie: czy istnieje żywy front wołający ten konkretny mechanizm (szukaj w `src/services/api.ts` i w komponentach danego narzędzia wywołań ścieżek `/api/<nazwa>/...`), czy front istnieje ale mechanizm jest niedostępny z UI (widmo — `docs/program/funkcje/` ma już nazwany ten kształt), czy front w ogóle nie istnieje. Nie zmieniasz żadnego frontu`. Trasy tył: ``server/src/routes/presentations.routes.ts` (propozycje AI — odczyt) · `server/src/services/aiActionExecutor.ts` + `server/src/routes/ai.routes.ts` (dyżur 207, kanon odniesienia — odczyt) · `server/src/services/ai/swotProposalService.ts` + `server/src/sharedRuntime/config/swot/swotAcceptGate.ts` · `server/src/services/myWork/agentApprovedMaterializationService.ts` · `server/src/services/v8/agentProposalGovernanceService.ts` · `server/src/services/caseWorkspace/proposalApprovalService.ts` · dodatkowe kandydaty do samodzielnego domiaru w `R1`: `server/src/services/audits/aiProposalService.ts`, rodzina `table-platform`/`tablePlatform` (sprawdź, czy to WSPÓLNY silnik używany przez wiele narzędzi, czy kolejna niezależna kopia — to rozstrzyga `R1`, nie ta instrukcja) — WSZYSTKO WYŁĄCZNIE DO ODCZYTU`.

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
WT=/private/tmp/cx-day258-ai-rodzina
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
git -C "$VAULT" worktree add "$WT" -b codex/day258-ai-rodzina-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day258-ai-rodzina/config.worktree"
cat "$VAULT/worktrees/cx-day258-ai-rodzina/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day258-ai-rodzina-scratch
mkdir -p /private/tmp/cx-day258-ai-rodzina-artefakty

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
git -C "$WT" push github-backup codex/day258-ai-rodzina-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only df7f13056f..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `7` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: presentation_ai_operations jest w calosci inline w presentations.routes.ts,
#     nie w aiActionExecutor.ts ani w ai_actions
grep -n "presentation_ai_operations" server/src/routes/presentations.routes.ts | head -20
grep -n "presentation_ai_operations" server/src/services/aiActionExecutor.ts
#   oczekiwane: pierwsza komenda ma wiele trafien (min. 10), druga ZERO trafien

# (2) TEZA: ai_actions + AIActionExecutor sa uzywane przez dyzur 207 jako kanon
#     odniesienia i nie odwoluja sie do presentation_ai_operations
grep -n "ai_actions" server/src/services/aiActionExecutor.ts | head -10
grep -n "presentation_ai_operations\|presentations\.routes" server/src/services/aiActionExecutor.ts
#   oczekiwane: pierwsza ma trafienia, druga ZERO — potwierdza rozlacznosc

# (3) TEZA: cztery kolejne rodziny tabel istnieja i maja WLASNY serwis (nie dzielony)
grep -n "CREATE TABLE IF NOT EXISTS swot_proposals" server/migrations/20260802_swot_proposals.sql
grep -n "CREATE TABLE IF NOT EXISTS myw_agent_materialization_proposals\|CREATE TABLE IF NOT EXISTS myw_agent_materialization_approvals" server/migrations/20261001_myw_agent_approved_materialization.sql
grep -n "CREATE TABLE IF NOT EXISTS v8_agent_proposal_versions\|CREATE TABLE IF NOT EXISTS v8_agent_proposal_governance_events" server/migrations/20260807_v8_agent_proposal_governance.sql
grep -n "CREATE TABLE IF NOT EXISTS case_workspace_action_proposals\|CREATE TABLE IF NOT EXISTS case_workspace_action_proposal_decisions" server/migrations/20260809_case_workspace_proposals_approvals.sql
#   oczekiwane: wszystkie cztery znajduja definicje tabel

# (4) TEZA: kazda z czterech ma dedykowany plik serwisu, ktory ja konsumuje
grep -rl "swot_proposals" server/src --include="*.ts" | grep -v __tests__
grep -rl "myw_agent_materialization_proposals\|myw_agent_materialization_approvals" server/src --include="*.ts" | grep -v __tests__
grep -rl "v8_agent_proposal_versions\|v8_agent_proposal_governance_events" server/src --include="*.ts" | grep -v __tests__
grep -rl "case_workspace_action_proposals" server/src --include="*.ts" | grep -v __tests__
#   oczekiwane: kazda komenda zwraca liste plikow zawierajaca sciezke wskazana
#   w TRASY_TYL tej instrukcji — jesli NIE, zanotuj rozjazd w Korektach

# (5) TEZA: aiProposalService.ts w audits/ to kolejny (siodmy?) kandydat, nie zbadany
grep -n "ANTHROPIC_API_KEY\|class \|proposal" server/src/services/audits/aiProposalService.ts | head -20
#   oczekiwane: plik istnieje i ma wlasna logike propozycji — Twoje zadanie w R1
#   to rozstrzygnac, czy to siodma niezalezna kopia, czy wolacz jednej z szesciu

# (6) TEZA: barrel routes/index.ts jest martwy i nie czyni zadnej z tych rodzin
#     'zywa' tylko przez reeksport (ta sama pulapka co w dyzurze 246)
grep -rn "from '\./routes/index'\|require('\./routes/index')" server/src/Gateway.ts server/src/index.ts
#   oczekiwane: zero trafien — potwierdza, ze montaz idzie przez bezposrednie
#   importy w Gateway.ts, nie przez barrel

# (7) TEZA: miejsce na dysku wystarcza (dyzur nie uruchamia bazy, ale worktree
#     i artefakty tekstowe tez zajmuja miejsce)
df -h /
#   oczekiwane: powyzej 2 GB wolnego
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day258-ai-rodzina-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6256`. Twój JEDYNY port harnessu to `5236 i 5237`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day258-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6220, 5010-5195, 6404-6411, 6600-6830. Twoje własne: baza 6256, harness 5236 i 5237. Cudze — siostrzane dyżury tej samej paczki, nie dotykasz: baza 6250 i harness 5230-5231 (dyżur 255), baza 6252 i harness 5232-5233 (dyżur 256), baza 6254 i harness 5234-5235 (dyżur 257), baza 6258 i harness 5238-5239 (dyżur 259). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. `Z10` obowiązuje bez wyjątku — ten dyżur nie zmienia zachowania żadnego z sześciu mechanizmów, wyłącznie je opisuje.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/admin.middleware.ts` · `server/src/middleware/rbac.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY258_AI_RODZINA_REPORT.md`. Dozwolony dokładnie JEDEN nowy plik rejestrowy (nie edycja istniejącego — nic w repo dziś nie spisuje tej rodziny): `docs/program/funkcje/RODZINA_AI_PROPONUJE_AKCEPTUJE_2026-09-01.md`, WYŁĄCZNIE z treścią tabeli `R3` i rekomendacją z pełnymi dowodami `plik:linia`. Jeżeli w trakcie pracy okaże się, że taki rejestr już istnieje pod inną nazwą — nie twórz duplikatu, dopisz do istniejącego WYŁĄCZNIE nową sekcję na końcu i zgłoś to w „Korektach wobec instrukcji”. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day258-ai-rodzina-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day258-ai-rodzina-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **ZAKAZ SCALANIA, REFAKTORYZACJI, USUWANIA I ZMIANY DOMYŚLNEGO ZACHOWANIA którejkolwiek z sześciu (lub więcej, jeśli `R1` znajdzie kolejne) implementacji.** Zero zmian w kodzie produkcyjnym — ten dyżur jest wyłącznie pomiarowy. **ZAKAZ rekomendowania scalenia w tym samym dyżurze, w którym mierzysz** — rekomendacja idzie do raportu jako osobna, jawnie oznaczona sekcja „REKOMENDACJA (do decyzji właściciela, NIE wykonana)”, nie jako zrealizowana zmiana. **ZAKAZ traktowania sześciu pozycji z tej instrukcji jako zamkniętej listy** — patrz `PULAPKA` powyżej. | Ten mechanizm — model proponuje, wiersz ląduje jako `pending`, człowiek klika approve/reject, dopiero wtedy materializacja — jest jednym z najważniejszych wzorców bezpieczeństwa produktu (nic nie zmienia się w danych klienta bez jawnej zgody człowieka). Zmierzono dziś wprost, że przynajmniej dwie implementacje (`ai_actions`/`AIActionExecutor` z dyżuru 207 i `presentation_ai_operations` inline w `presentations.routes.ts`) nie mają ze sobą NIC wspólnego — każda ma własny kształt tabeli, własne nazwy statusów, własną logikę materializacji. Przesiew wykonany PRZED wydaniem tej instrukcji znalazł jeszcze cztery takie rodziny. To jest dokładnie kształt, który w tym repo już raz kosztował osiem tygodni: naprawa/ulepszenie zrobione w jednej kopii nie dotyka pozostałych, bo nikt nie wiedział, że pozostałe istnieją. Zanim właściciel podejmie decyzję, którą implementację uczynić kanoniczną (i czy w ogóle konsolidować), musi zobaczyć PEŁNĄ listę, nie próbkę dwóch przykładów — stąd ten dyżur zaczyna się od KROKU 0, nie od naprawy. |

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
cd /private/tmp/cx-day258-ai-rodzina

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day258-pg psql -U postgres -d cx258 \
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
cd /private/tmp/cx-day258-ai-rodzina

docker run -d --name cx-day258-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx258 \
  -p 127.0.0.1:6256:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day258-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6256/cx258 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6256/cx258 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day258-ai-rodzina && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6256/cx258 \
JWT_SECRET=cx258-test-secret-do-not-reuse \
npx vitest run brak — ten dyżur nie tworzy testów, jest wyłącznie pomiarowy (statyczne czytanie kodu, zero uruchamiania bazy) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day258-ai-rodzina-artefakty/day258-pomiar.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day258-ai-rodzina && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run brak — ten dyżur nie tworzy testów, jest wyłącznie pomiarowy (statyczne czytanie kodu, zero uruchamiania bazy) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day258-ai-rodzina-artefakty/day258-pomiar.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day258-ai-rodzina/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day258-pg psql -U postgres -d cx258 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day258-pg`.
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
> **(e) ★★ SEED, NIE WYNIK — sześć pozycji wypisanych w tej instrukcji (`TYTUL_JEDNYM_ZDANIEM`, `TRASY_TYL`) to punkt startowy mojego własnego, ograniczonego przesiewu (jedno-dwa zapytania grepa na kandydata), NIE zamknięta lista. Twoim zadaniem w `R1` jest: (a) zweryfikować każdą z sześciu pozycji do poziomu `plik:linia` z cytatem realnego zapytania SQL `INSERT ... status = 'pending'`/`UPDATE ... status = 'approved'/'rejected'`, bo sama nazwa tabeli zawierająca słowo `proposal`/`approval` NIE jest dowodem, że to ten mechanizm (może to być np. dziennik audytowy bez cyklu życia); (b) rozszerzyć przesiew — szukaj też wzorców `pending_review`, `awaiting_approval`, `requires_approval`, `hitl`, `human_in_the_loop`, `draft`→`approved` w kolumnach `status`/`state` powiązanych z tabelami, których nazwa zawiera `ai_`/`agent_`/`copilot_`, oraz w katalogach `server/src/services/**`, nie tylko w migracjach. Druga pułapka: **nie myl WSPÓLNEGO SILNIKA z NIEZALEŻNĄ KOPIĄ.** Jeśli dwie pozycje na Twojej liście wołają dokładnie ten sam serwis (np. przez wspólny `tablePlatform`/`PermissionsService`), to jest JEDNA pozycja z dwoma wołaczami, nie dwie kopie — rozstrzygasz to czytając kod, nie nazwę pliku.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day258-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day258-ai-rodzina-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (weryfikacja i rozszerzenie SEED listy do poziomu plik:linia + realny przesiew całego `server/src` i `server/migrations` pod kątem kolejnych kopii) · R2 (dla każdej potwierdzonej pozycji: co robi inaczej, kto ją woła z frontu, czy ma żywego konsumenta — Z21) · R3 (tabela końcowa + rekomendacja, nienałożona) · R4 (raport dyżuru)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6256` albo `5236 i 5237` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6256` albo `5236 i 5237`** (`Z7`).

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

„AI proponuje, człowiek akceptuje” jest jednym z najważniejszych mechanizmów bezpieczeństwa
tego produktu: model nigdy nie zmienia danych klienta wprost, tylko zapisuje propozycję jako
wiersz `pending`, a materializacja następuje dopiero po jawnym kliknięciu człowieka
(approve/reject). Zmierzono dziś wprost, że co najmniej **dwie** implementacje tego kształtu
nie mają ze sobą **nic wspólnego**:

- `ai_actions` + `server/src/services/aiActionExecutor.ts` — kanon z dyżuru 207, kolejka
  akcji AI z jawnym stanem `pending_approval`/`approved`/`rejected`, wołana z
  `server/src/routes/ai.routes.ts`.
- `presentation_ai_operations` — tabela i logika **w całości inline** w
  `server/src/routes/presentations.routes.ts` (m.in. `INSERT ... status='pending'` w
  liniach 872-928, odczyt/status w 5159-5165, 6920-6930, 7067-7238, 7366-7540). Zero importu
  `aiActionExecutor`, zero wspólnej tabeli.

**To nie jest para przykładów — to próbka.** Przesiew wykonany przed wydaniem tej instrukcji
(SEED, opisany w `§0.1` jako tezy do zweryfikowania, NIE gotowy wynik) znalazł **cztery
kolejne** rodziny tabel z własnym, dedykowanym serwisem proponuj/zatwierdź:

| # | Tabela(e) | Serwis konsumujący |
| --- | --- | --- |
| 3 | `swot_proposals` | `server/src/services/ai/swotProposalService.ts` + `server/src/sharedRuntime/config/swot/swotAcceptGate.ts` |
| 4 | `myw_agent_materialization_proposals` + `myw_agent_materialization_approvals` | `server/src/services/myWork/agentApprovedMaterializationService.ts` |
| 5 | `v8_agent_proposal_versions` + `v8_agent_proposal_scope_reviews` + `v8_agent_proposal_governance_events` | `server/src/services/v8/agentProposalGovernanceService.ts` |
| 6 | `case_workspace_action_proposals` + `case_workspace_action_proposal_decisions` | `server/src/services/caseWorkspace/proposalApprovalService.ts` |

Czyli **co najmniej sześć** niezależnie zaimplementowanych kopii tego samego wzorca, nie dwie.
To jest dokładnie kształt, który w tym repo już raz kosztował osiem tygodni: naprawa albo
ulepszenie zrobione w jednej kopii (np. lepsze komunikaty błędu, audytowalność, retry) nie
dotyka pozostałych pięciu, bo nikt nie miał pełnej listy. Zanim właściciel zdecyduje, którą
implementację uznać za kanoniczną — albo czy w ogóle konsolidować — musi zobaczyć **całą
rodzinę**, nie dwa przykłady.

## Czego ten dyżur świadomie NIE robi

- **Nie scala, nie refaktoryzuje, nie usuwa żadnej z sześciu implementacji.** Zero zmian w
  kodzie produkcyjnym.
- **Nie decyduje, która implementacja zostaje kanoniczna.** To decyzja właściciela — dyżur
  dostarcza materiał (tabelę + rekomendację), nie wykonuje jej.
- **Nie zamyka listy na sześciu pozycjach z tej instrukcji.** One są punktem startowym
  jednego wąskiego przesiewu wykonanego przy pisaniu instrukcji — `R1` ma obowiązek go
  rozszerzyć, nie tylko zweryfikować.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | `presentation_ai_operations` jest w całości inline w `presentations.routes.ts`, zero wspólnego kodu z `aiActionExecutor.ts`/`ai_actions` | komenda (1) |
| T2 | `ai_actions`+`AIActionExecutor` (dyżur 207) nie odwołują się do `presentation_ai_operations` | komenda (2) |
| T3 | Cztery kolejne rodziny tabel (`swot_proposals`, `myw_agent_materialization_*`, `v8_agent_proposal_*`, `case_workspace_action_proposal*`) istnieją w schemacie | komenda (3) |
| T4 | Każda z czterech ma dedykowany plik serwisu, który ją konsumuje — nie jest to wołacz jednego z pozostałych pięciu mechanizmów | komenda (4) |
| T5 | `server/src/services/audits/aiProposalService.ts` jest kolejnym, jeszcze nie zbadanym kandydatem na tę samą rodzinę | komenda (5) |
| T6 | Montaż tras idzie wyłącznie przez bezpośrednie importy w `Gateway.ts`, nie przez martwy barrel `routes/index.ts` (ta sama pułapka co w dyżurze 246) | komenda (6) |
| T7 | Miejsce na dysku wystarcza | komenda (7) |

---

# 3. POZYCJE DYŻURU

## R1 — WERYFIKACJA I ROZSZERZENIE LISTY RODZINY (rdzeń, warunek wejścia)

1. **Zweryfikuj każdą z sześciu pozycji T1-T4 do poziomu `plik:linia` z cytatem realnego
   zapytania SQL** (`INSERT ... status = 'pending'` / odpowiednik, `UPDATE ... status =
   'approved'`/`'rejected'` lub materializacja po stronie serwisu). Sama nazwa tabeli
   zawierająca `proposal`/`approval` NIE jest dowodem — może to być dziennik audytowy bez
   cyklu życia albo tabela bez rzeczywistej ścieżki approve/reject. Jeżeli którakolwiek z
   sześciu pozycji nie ma realnego cyklu proponuj→zatwierdź (np. jest tylko logiem), zapisz
   to jako obalenie tej pozycji z dowodem — nie usuwaj cicho z tabeli końcowej, pokaż że
   sprawdziłeś i dlaczego odpada.
2. **Rozszerz przesiew poza sześć pozycji startowych.** Szukaj w `server/migrations/**` i
   `server/src/services/**`:
   - wzorców kolumn `status`/`state` z wartościami typu `pending_review`, `awaiting_approval`,
     `requires_approval`, `draft`→`approved`, w tabelach, których nazwa zawiera
     `ai_`/`agent_`/`copilot_`/`_proposal`/`_suggestion`;
   - frazy `hitl`/`human_in_the_loop`/`humanInTheLoop` w kodzie serwisów;
   - `server/src/services/audits/aiProposalService.ts` (T5) — rozstrzygnij, czy to SIÓDMA
     niezależna kopia, czy wołacz jednego z sześciu już zidentyfikowanych mechanizmów;
   - rodzinę `table-platform`/`tablePlatform` — **osobno rozstrzygnij, czy to WSPÓLNY silnik
     używany przez wiele narzędzi (jedna pozycja, wiele wołaczy) czy kolejna niezależna
     kopia** — czytasz kod, nie zgadujesz z nazwy pliku.
3. Dla każdej NOWEJ pozycji znalezionej w kroku 2, zastosuj tę samą weryfikację `plik:linia`
   co w kroku 1.

## R2 — CHARAKTERYSTYKA KAŻDEJ POTWIERDZONEJ POZYCJI (rdzeń)

Dla każdej pozycji, która przeszła `R1` (nie odpadła), ustal i zapisz:

- **Gdzie żyje** — tabela(e) + plik(i) serwisu/routera, `plik:linia` definicji cyklu życia.
- **Co robi inaczej** — kształt statusów (nazwy, liczba stanów), czy ma wersjonowanie
  (`version_before`/`version_after` jak `presentation_ai_operations`), czy ma
  receipt/audit-trail osobny od samego wiersza propozycji, czy materializacja jest
  synchroniczna czy przez outbox/kolejkę.
- **Kto ją woła** — front: przeszukaj `src/services/api.ts` i komponenty właściwego narzędzia
  pod kątem wywołań tej konkretnej ścieżki API; zapisz czy front istnieje i faktycznie
  renderuje przycisk approve/reject, czy mechanizm jest dostępny wyłącznie backendowo
  (widmo — brak producenta w UI, ten kształt ma już nazwę w dokumentacji programu), czy nie
  ma frontu wcale. To jest fakt do zmierzenia (`Z21` — dowód osiągalności, nie istnienia
  kodu), nie założenie.

## R3 — TABELA KOŃCOWA + REKOMENDACJA (rdzeń, produkt dyżuru)

Jedna tabela, wiersz na każdą potwierdzoną pozycję rodziny (kolumny: nazwa/lokalizacja,
tabela(e), serwis, front tak/nie, ostatnia data modyfikacji pliku serwisu wg `git log -1
--format=%ad -- <plik>`, ocena dojrzałości w 1 zdaniu z dowodem). Pod tabelą: **sekcja
„REKOMENDACJA (do decyzji właściciela, NIE wykonana)”** — którą implementację warto uczynić
kanoniczną i dlaczego (kryteria: najszersze pokrycie frontowe, najmłodsza/najbardziej
utrzymywana, najpełniejszy audit-trail — uzasadnij wybrane kryterium), oraz jawne zdanie, że
**żadna zmiana kodu nie została w tym dyżurze wykonana**.

## R4 — RAPORT DYŻURU (rdzeń)

Streszczenie, `R1`-`R3` z pełnymi dowodami, sekcja „TWIERDZENIA NIEZWERYFIKOWANE”
(obowiązkowa nawet pusta), sekcja „Korekty wobec instrukcji” (obowiązkowa nawet pusta —
zwłaszcza jeśli któraś z sześciu pozycji startowych odpadła w `R1`, albo jeśli `aiProposalService.ts`/
`table-platform` okazały się czymś innym niż przewidywano).

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (NOWY plik, `J`) | `docs/program/funkcje/RODZINA_AI_PROPONUJE_AKCEPTUJE_2026-09-01.md` — WYŁĄCZNIE nowy plik z tabelą `R3` i rekomendacją; jeśli taki rejestr już istnieje pod inną nazwą, dopisujesz nową sekcję na końcu istniejącego, nie tworzysz duplikatu |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY258_AI_RODZINA_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | wszystkie pliki wymienione w `TRASY_TYL`, `R1`, `R2` tej instrukcji — cały mechanizm rodziny „AI proponuje, człowiek akceptuje” |
| Odczyt (ZAKAZ ZAPISU) | `server/src/Gateway.ts` — wyłącznie odczyt montowania tras, zero zmian |
| Odczyt (ZAKAZ ZAPISU) | `server/migrations/**` — wszystkie migracje cytowane jako dowód schematu |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` · każdy `MODULE_ACCEPTANCE.md` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **TEN DYŻUR NIE URUCHAMIA KONTENERA BAZY DANYCH.** Jest wyłącznie pomiarowy (statyczne
  czytanie kodu) — blok migracji/env `§0.2c` NIE MA ZASTOSOWANIA, pomijasz go w całości.
- ★★ **SEED, NIE WYNIK.** Sześć pozycji z `§1` tej instrukcji to punkt startowy, nie zamknięta
  lista — `R1` musi je zweryfikować DO `plik:linia` i aktywnie szukać kolejnych, nie tylko
  potwierdzić to, co już napisano.
- ★★ **NIE MYL WSPÓLNEGO SILNIKA Z NIEZALEŻNĄ KOPIĄ.** Jeśli dwie pozycje wołają dokładnie ten
  sam serwis pod spodem, to jedna pozycja z dwoma wołaczami — rozstrzygasz to czytając kod
  wywołań, nie porównując nazwy pliku czy tabeli.
- ★★ **ZAKAZ SCALANIA.** Nawet jednoznaczna, oczywista konsolidacja zostaje w raporcie jako
  rekomendacja, nigdy jako wykonana zmiana. Ten dyżur mierzy pod decyzję właściciela.
- ★ **ZANIM ZACYTUJESZ `plik:linia`, SPRAWDŹ CZY PLIK JEST FAKTYCZNIE ŻYWY** (importowany z
  `Gateway.ts`, nie martwy bliźniak — `docs/program/funkcje/ZNALEZISKO_41_MARTWYCH_BLIZNIAKOW.md`,
  komenda (6) w `§0.1`).
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE” W RAPORCIE JEST OBOWIĄZKOWA.**
