# INSTRUKCJA DYŻURU nr 232 — Codex — „★ AGENT REDAGUJĄCY DECK — operacje na gotowym decku (przeredaguj slajd, skróć, rozbij na dwa, zmień archetyp, dodaj źródło) przez mechanizm „model proponuje, człowiek zatwierdza". ★★ POMIAR ZMIENIA ZAMÓWIENIE: mechanizm propozycji dla decków JUŻ ISTNIEJE (`POST /decks/:deckId/agent-edit` → `/accept` → `/reject`, tabela `presentation_ai_operations`), ale (a) „agent" jest parserem słów kluczowych, nie modelem (`parsePresentationEditIntent` — regexy), oraz (b) **trasa `/accept` NIE SPRAWDZA STANU OPERACJI: `getAiOperation` nie zwraca `status`, a jedyne odwołanie do `op.status` w całym pliku tras to licznik statystyk** — czyli operacja już zastosowana albo już ODRZUCONA daje się zatwierdzić ponownie. Bramy nie ma czego usuwać, bo jej nie ma. Ten dyżur ją stawia i dowodzi mutacją"

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
> **wyłącznie** `/private/tmp/cx-day232-gamma-agent`.

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
Zakres: ****PREZENTACJE × AGENT — BRAMA ZATWIERDZENIA I OPERACJE REDAKCYJNE.** Zmierzone na markerze `9fb7942a01`. Istniejący tor decku: propozycja `server/src/routes/presentations.routes.ts:4004` (`POST /decks/:deckId/agent-edit`, wymaga `presentation_edit`), plan `server/src/services/presentationAgentEditService.ts:53` (`parsePresentationEditIntent` — **regexy i słowa kluczowe, zero modelu**; pole `requiresApproval` ustawiane na sztywno `:62`, `:157`, `:168`), zastosowanie planu `:388` (`applyPresentationEditPlan`), zapis propozycji `presentations.routes.ts:860` (`saveAiOperation` → `INSERT INTO presentation_ai_operations` `:864`), odczyt `:886` (`getAiOperation` — **nie zwraca `status`**), rozwiązanie `:914` (`resolveAiOperation`, `UPDATE … SET status = ?` `:921`), zatwierdzenie `:4128` (`POST /decks/:deckId/agent-edit/:operationId/accept`, wymaga `presentation_approve`), odrzucenie `:4218` (`/reject`). Dziennik: `recordPresentationRuntimeEvent` (`agent_edit_proposal_created`, `agent_edit_applied`, `agent_edit_rejected`, `agent_edit_noop`), historia agenta `presentations.routes.ts:6699`, `:6838`, `:7099`. Wzorzec, który kopiujesz: **brama zatwierdzenia z dyżuru 207** — `server/src/services/aiActionExecutor.ts:867-868` (`if (action.status !== ACTION_STATUS.APPROVED) return { success: false, error: … }`) plus druga warstwa `:887-889` (`UPDATE … SET status='EXECUTING' WHERE id = ? AND status = 'APPROVED'`) plus trzecia w `approveAction` `:668-669` i `:675`; producent propozycji `:331` (`requestChatToolProposal`, `_forceApproval: true` `:355`), `:389` (`requestAction`, `requiresApproval` `:455-457`, status końcowy `:511`), `:863` (`executeAction`). Test, który czerwienieje po usunięciu bramy: `tests/unit/backend/day207.write-proposal.contract.test.ts:238-258`. Kontrakt: `docs/program/funkcje/GAMMA_G3_OBCHOD_MENU.md` (panel `Agent`: dziennik „Created slide 1… 10" + propozycje następnych ruchów „Add 2 more slides", „Find related case studies", „Visualize text-heavy slides") i `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §12**.
Trasy front: `Nie budujesz nowego panelu od zera — zmierz, co jest zamontowane. Punkty wejścia: `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` (`:48`, `:386`, `:668`), `src/components/Presentations/DeckBuilder/DeckBuilderMelsRightRail.tsx`, `src/components/Presentations/DeckBuilder/DeckAuditLogModal.tsx`, `src/components/Presentations/DeckBuilder/DeckGovernanceCardModal.tsx`, `src/services/presentationAgentHistory.ts`, `src/services/presentationRuntimeEvents.ts`. ★★ **Ósmy kształt fałszywego gotowe:** wołacz API istnieje, a komponent nigdy nie jest renderowany — **udowodnij montaż realnym renderem**, nie grepem. Kanon prawego panelu artefaktu: `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` (powłoka wspólna, `ArtifactRightPanel`) — deck to archetyp E (Deck). Zrzut: `dev-render/screens/day232-agent-decku.tsx` + wpis w `dev-render/main.tsx` — panel w trzech stanach (propozycja oczekująca / zastosowana / odrzucona), dwa motywy. Tokeny `c-*`, **zero `primary-*` — każdy numer `primary` w tym tailwindzie to crimson `#85182F`** (`CLAUDE.md` §3, §6; hook `scripts/check-artefakt.sh` blokuje w powłoce)`. Trasy tył: ``POST /api/presentations/decks/:deckId/agent-edit` (`server/src/routes/presentations.routes.ts:4004`) · `POST /api/presentations/decks/:deckId/agent-edit/:operationId/accept` (`:4128`) · `POST /api/presentations/decks/:deckId/agent-edit/:operationId/reject` (`:4218`) · `PUT /api/presentations/decks/:deckId/autosave` (`:3907`) · `GET /api/presentations/decks/:deckId/versions` (`:8023`) · historia i statystyki agenta (`:6699`, `:6838`, `:7099`; licznik statusów `:4608`) · `POST /api/presentation-studio/decks/:deckId/slides/:slideIndex/regenerate` (`server/src/routes/presentationStudio.routes.ts:1105`). Tor 207, przez który mają iść propozycje modelu: `POST /api/ai/chat/stream` (`server/src/routes/ai.routes.ts`, `onProposalToolCall` `:4808-4864`), cykl `ai_actions` (`draft`/`approve`/`execute`) w `server/src/services/aiActionExecutor.ts:331`, `:389`, `:664`, `:863`. Routery: `server/src/Gateway.ts:1201` i `:1226``.

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
WT=/private/tmp/cx-day232-gamma-agent
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
git -C "$VAULT" worktree add "$WT" -b codex/day232-gamma-agent-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day232-gamma-agent/config.worktree"
cat "$VAULT/worktrees/cx-day232-gamma-agent/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day232-gamma-agent-scratch
mkdir -p /private/tmp/cx-day232-gamma-agent-artefakty

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
git -C "$WT" push github-backup codex/day232-gamma-agent-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9fb7942a01..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: mechanizm propozycji dla deckow JUZ ISTNIEJE — nie budujesz go od zera
grep -n "agent-edit" server/src/routes/presentations.routes.ts
#   oczekiwane: trzy trasy — propozycja ok. :4004, /accept ok. :4128, /reject ok. :4218

# (2) TEZA: „agent" jest dzis PARSEREM SLOW KLUCZOWYCH, nie modelem
grep -n "export function parsePresentationEditIntent\|requiresApproval" server/src/services/presentationAgentEditService.ts
grep -n "llmService\|callStream\|openrouter\|OPENROUTER" server/src/services/presentationAgentEditService.ts
#   oczekiwane: parser ok. :53, requiresApproval na sztywno ok. :62, :157, :168;
#   ZERO wolan modelu w tym pliku

# (3) ★★ TEZA GLOWNA: trasa /accept NIE SPRAWDZA STANU OPERACJI
sed -n '4128,4150p' server/src/routes/presentations.routes.ts
grep -n "op\.status\|operation\.status" server/src/routes/presentations.routes.ts
#   oczekiwane: w /accept po pobraniu operacji sprawdzane sa TYLKO deckId i organizationId;
#   jedyne trafienie `op.status` w calym pliku to licznik statystyk ok. :4608.
#   To znaczy: operacja zastosowana albo ODRZUCONA daje sie zatwierdzic ponownie

# (4) TEZA: `getAiOperation` w ogole nie zwraca pola `status` — dlatego naiwny warunek NIE ZADZIALA
sed -n '886,912p' server/src/routes/presentations.routes.ts
#   oczekiwane: zwracany obiekt ma operationId/deckId/organizationId/userId/originalDeckJson/
#   proposedDeckJson/reply/actions/diff/createdAt — i ANI SLOWA o `status`.
#   Dodatkowo cache w procesie: `pendingDeckAiOperations` czytany ok. :888

# (5) TEZA (207): wzorzec bramy, ktory kopiujesz, istnieje i JEST przetestowany mutacja
sed -n '863,890p' server/src/services/aiActionExecutor.ts
sed -n '238,258p' tests/unit/backend/day207.write-proposal.contract.test.ts
#   oczekiwane: brama ok. :867-868 (status !== APPROVED -> success:false) + druga warstwa
#   ok. :887-889 (WHERE ... AND status='APPROVED'); test asertuje success=false,
#   /not APPROVED/, status pozostaje PENDING i brak zdarzen wykonania

# (6) TEZA: dziennik dzialan agenta ISTNIEJE — rozszerzasz go, nie tworzysz
grep -n "agent_edit_proposal_created\|agent_edit_applied\|agent_edit_rejected\|agent_edit_noop" server/src/routes/presentations.routes.ts
#   oczekiwane: cztery typy zdarzen przez recordPresentationRuntimeEvent

# (7) TEZA: tabela propozycji decku istnieje i ma kolumne `status`
grep -rn "presentation_ai_operations" server/migrations/ | head -3
#   oczekiwane: definicja tabeli z kolumnami id/deck_id/organization_id/user_id/operation_type/
#   status/prompt/reply/actions_json/diff_json/original_deck_json/proposed_deck_json/
#   version_before/version_after/created_at/resolved_at (porownaj z INSERT-em ok. :864)

# (8) TEZA: uprawnienia sa rozdzielone — propozycja i zatwierdzenie to DWIE rozne zdolnosci
grep -n "ensurePresentationCapability(req, res, 'presentation_edit')\|ensurePresentationCapability(req, res, 'presentation_approve')" server/src/routes/presentations.routes.ts | sed -n '1,12p'
#   oczekiwane: /agent-edit wymaga 'presentation_edit', /accept i /reject wymagaja
#   'presentation_approve'. TEJ rozdzielnosci NIE WOLNO Ci zmienic
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day232-gamma-agent-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6176`. Twój JEDYNY port harnessu to `5140 i 5141`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day232-pg`**. **ZAKAZANE:** `5000 (macOS Control Center, zajety na stale), 5037 (adb), 5060-5061, 6012, 5433, 6047, 6054-6172, 5010-5133, 6404-6411 — oraz porty pozostalych dyzurow fali 18, ktore sa cudze: bazy 6173-6176 i harness 5134-5141 z wyjatkiem Twoich, wymienionych w tym wierszu wyzej. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w ``R2`-`R4` — dokładnie JEDNA nowa flaga `ENABLE_TERESA_DECK_EDIT`, **default OFF**, wzorem `server/src/config/FeatureFlags.ts:55` i `:247-248`. ★★ **`R1` (brama stanu na `/accept` i `/reject`) idzie BEZ FLAGI, na stałe** — brakująca kontrola stanu jest usterką, a usterek nie chowa się za flagą. Zakaz zmiany domyślek istniejących flag, w szczególności `ENABLE_TERESA_TOOL_LOOP_WRITE` (`:37`, `:157`, dziś OFF)`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/services/aiRoleGuard.ts` · `server/src/services/chatPermissionService.ts` · `server/src/services/aiPolicyEngine.ts` · `server/src/services/aiRunLedgerService.ts` · `server/src/services/ai/chatPolicyGateway.ts` · `server/src/services/ai/webSearchGovernance.ts` · `server/src/services/ai/sideEffectTools.ts` · `server/src/services/ai/knowledgeDocAccessFilter.ts` · `server/src/routes/presentationExportGate.ts` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/v8FeatureGate.middleware.ts` · `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY232_GAMMA_AGENT_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — ten dyżur buduje za flagą domyślnie WYŁĄCZONĄ i **nie domyka odbioru żadnego modułu**; odbiór należy do nadzorcy po akcepcie właściciela na zrzucie. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day232-gamma-agent-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day232-gamma-agent-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ BUDOWY SZÓSTEGO MECHANIZMU PROPOZYCJI.** W produkcie jest ich dziś pięć: cztery w czacie (opisane w instrukcji dyżuru 207) i **piąty, własny dla decków** (`presentation_ai_operations`, `presentations.routes.ts:860`, `:886`, `:914`, `:4004`, `:4128`, `:4218`). Wybierasz JEDEN z istniejących, uzasadniasz liczbami i przez niego przechodzisz. Jeżeli uznasz, że żaden nie pasuje — to jest **STOP MERYTORYCZNY pozycji z opisem**, a nie szósty mechanizm | Rozstrzygnięcie z dyżuru 207 brzmiało „mapować, nie kasować" i „zakaz budowy piątego mechanizmu". Piąty jednak istnieje — bo powstał wcześniej, osobno, dla decków. Twoim zadaniem jest **postawić w nim brakującą bramę stanu na wzór 207**, a nie zbudować obok szósty. Kasowanie piątego też jest zakazane: ma żywe trasy, żywą tabelę i żywych konsumentów front-endowych |

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
cd /private/tmp/cx-day232-gamma-agent

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day232-pg psql -U postgres -d cx232 \
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
cd /private/tmp/cx-day232-gamma-agent

docker run -d --name cx-day232-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx232 \
  -p 127.0.0.1:6176:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day232-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6176/cx232 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6176/cx232 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day232-gamma-agent && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6176/cx232 \
JWT_SECRET=cx232-lokalny-sekret-testowy-nie-uzywany-nigdzie-indziej \
npx vitest run server/src/routes/__tests__ tests/unit/backend tests/integration tests/unit/deliverables --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day232-gamma-agent-artefakty/day232-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day232-gamma-agent && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__ tests/unit/backend tests/integration tests/unit/deliverables --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day232-gamma-agent-artefakty/day232-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day232-gamma-agent/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day232-pg psql -U postgres -d cx232 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day232-pg`.
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
> **(e) **`server/src/routes/presentations.routes.ts:886-910` (`getAiOperation`) NIE ODCZYTUJE kolumny `status`** — zwracany obiekt nie ma tego pola w ogóle. Dlatego napisanie w `/accept` warunku `if (op.status !== 'pending')` **przejdzie kompilację i będzie zawsze fałszywe** (`undefined !== 'pending'` → odrzuci WSZYSTKO) albo — po drobnej pomyłce — zawsze prawdziwe. Dodatkowo istnieje **pamięć podręczna w procesie** (`pendingDeckAiOperations`, czytana `:888`, czyszczona w `resolveAiOperation` `:916`), więc ta sama operacja potrafi wracać z cache'u **bez dotknięcia bazy**. Bramę stawiasz na **stanie z BAZY**, nie z cache'u, i dowodzisz **stanem tabeli**, nie logiem**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day232-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day232-gamma-agent-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (brama stanu + para dowodowa) · R2 (operacje redakcyjne przez propozycję) · R3 (dziennik)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6176` albo `5140 i 5141` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6176` albo `5140 i 5141`** (`Z7`).

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

Właściciel wskazał to jako bonus Gammy: *„jest tam agent, któremu mówisz, co ma zmienić,
i się zmienia"*. Zaobserwowane w działaniu na jego koncie
(`docs/program/funkcje/GAMMA_G3_OBCHOD_MENU.md`): panel `Agent` pokazuje **dziennik tego, co
zrobił** („Created slide 1… 10") i po zakończeniu **sam proponuje następne ruchy** — „Add 2 more
slides", „Find related case studies", **„Visualize text-heavy slides"**. Pole: *„Ask me to edit,
create, or style anything"* + przycisk `Quick edits`.

U nas to jest **najbliżej gotowe**: pętla narzędziowa (206) i **propozycje zapisu
z zatwierdzeniem człowieka** (207) zostały zamknięte 31.08.

## ★★ POMIAR ZMIENIA TREŚĆ ZAMÓWIENIA — wykonany na SHA `9fb7942a01`

Zamówienie brzmiało „zbuduj operacje na gotowym decku przez mechanizm propozycji".
**Pomiar pokazał, że mechanizm propozycji dla decków JUŻ ISTNIEJE — i że brakuje w nim bramy.**
Sprawdź każdą z tych rzeczy u siebie (komendy w `§0`).

### 1. Tor propozycja → zatwierdzenie dla decków jest zbudowany i żywy

`POST /api/presentations/decks/:deckId/agent-edit` (`server/src/routes/presentations.routes.ts:4004`,
wymaga zdolności `presentation_edit`) → plan
(`server/src/services/presentationAgentEditService.ts:53`, `parsePresentationEditIntent`) →
zastosowanie planu **do kopii** (`:388`, `applyPresentationEditPlan`) → zapis propozycji
(`presentations.routes.ts:860`, `saveAiOperation` → `INSERT INTO presentation_ai_operations` `:864`)
→ odpowiedź `status: 'proposal'` z `diff`-em i `operationId`.
Zatwierdzenie: `POST …/agent-edit/:operationId/accept` (`:4128`, wymaga `presentation_approve`).
Odrzucenie: `POST …/agent-edit/:operationId/reject` (`:4218`).
Dziennik: `recordPresentationRuntimeEvent` z typami `agent_edit_noop`,
`agent_edit_proposal_created`, `agent_edit_applied`, `agent_edit_rejected`; audyt przez
`emitAuditEvent` (`actorType:'AI_AGENT', action:'propose'` przy propozycji;
`actorType:'USER', action:'approve'` przy zatwierdzeniu). Historia agenta: `:6699`, `:6838`, `:7099`.

**Rozdzielność uprawnień jest poprawna i NIETYKALNA:** propozycja wymaga `presentation_edit`,
zatwierdzenie i odrzucenie — `presentation_approve`.

### 2. „Agent" jest dziś parserem słów kluczowych, nie modelem

`presentationAgentEditService.ts` (731 linii) nie woła modelu ani razu.
`parsePresentationEditIntent` (`:53`) rozpoznaje intencje regexami; pole `requiresApproval`
jest ustawiane **na sztywno**: `false` w `:62` i `:157`, `true` w `:168`.
Słowo „dark" w `:113` i `:560` to rozpoznawany wyraz w poleceniu użytkownika, nie motyw.

### 3. ★★★ BRAMY ZATWIERDZENIA NIE MA CZEGO USUWAĆ, BO JEJ NIE MA

To jest **najważniejsze ustalenie tego dyżuru** i sedno Twojej pierwszej pozycji.

- **`/accept` (`presentations.routes.ts:4128`) nie sprawdza stanu operacji.** Po pobraniu
  operacji weryfikuje **wyłącznie** `op.deckId === deckId` i `op.organizationId === orgId`
  (`:4136-4139`), po czym **bezwarunkowo** zapisuje `proposedDeckJson` do decku
  (`UPDATE presentation_decks SET deck_json = ?, version = ?` `:4173-4176`).
- **`getAiOperation` (`:886-910`) w ogóle nie odczytuje kolumny `status`** — zwracany obiekt ma
  `operationId`, `deckId`, `organizationId`, `userId`, `originalDeckJson`, `proposedDeckJson`,
  `reply`, `actions`, `diff`, `createdAt` i **ani słowa o stanie**.
- **Jedyne odwołanie do `op.status` w całym pliku (8187 linii) to licznik statystyk (`:4608`).**
- `resolveAiOperation` (`:914`) ustawia stan **po fakcie** (`UPDATE … SET status = ?` `:921`),
  a `/reject` (`:4218`) tylko go zapisuje.

**Konsekwencja mierzalna:** operacja **już zastosowana** albo **już odrzucona** daje się
zatwierdzić **ponownie**. Odrzucenie nie jest wiążące. Zatwierdzenie nie jest jednorazowe.
**Zmierz to i pokaż liczbą**, nie przepisuj z tej instrukcji.

### 4. Wzorzec, który kopiujesz — brama z dyżuru 207, w trzech warstwach

`server/src/services/aiActionExecutor.ts:867-868`:

```
867:    if (action.status !== ACTION_STATUS.APPROVED)
868:      return { success: false, error: `Action is ${action.status}, not APPROVED` };
```

Druga warstwa — **warunek w samym `UPDATE`**, żeby wyścig nie przeszedł bokiem (`:887-889`):
`UPDATE … SET status='EXECUTING' WHERE id = ? AND status = 'APPROVED'`.
Trzecia — `approveAction` odrzuca nie-`PENDING` (`:668-669`) i jego `UPDATE` ma `AND status='PENDING'`
(`:675`).
Producent: `requestChatToolProposal` (`:331`) wymusza zatwierdzenie przez `_forceApproval:true`
(`:355`); `requestAction` (`:389`) liczy `requiresApproval` w `:455-457`
(`isGovernedMutationAction` — `:126-128`) i ustawia status w `:511`.

**Test, który czerwienieje po usunięciu bramy — istnieje i jest wzorcowy:**
`tests/unit/backend/day207.write-proposal.contract.test.ts:238-258` — celowo omija `approveAction`,
żeby izolować **samą** bramę (uzasadnienie inline `:224-236`):

```
254:    expect(result.success).toBe(false);
255:    expect(result.error).toMatch(/not APPROVED/);
256:    expect(state.actions.get(actionId).status).toBe('PENDING');
257:    expect(state.events).not.toContain('execution_started');
```

Drugi, na realnym Postgresie: `tests/integration/day217-gf-agt-02.realdb.test.ts:120-133` —
`expect(result.success).toBe(false)` **plus** `SELECT count(*) FROM tasks WHERE source_id=$1` → `0`.
**Dowodem braku zapisu jest stan bazy, nie brak logu.**

### 5. Mechanizmów propozycji jest już PIĘĆ

Cztery w czacie (zinwentaryzowane w dyżurze 207) i **piąty, własny dla decków**
(`presentation_ai_operations`). Rozstrzygnięcie 207 brzmiało „zakaz budowy piątego mechanizmu" —
piąty jednak istnieje, bo powstał wcześniej i osobno. **Twoim zadaniem jest postawić w nim
brakującą bramę na wzór 207, a nie zbudować obok szósty.** Kasowanie piątego też jest zakazane:
ma żywe trasy, żywą tabelę i żywych konsumentów front-endowych.

## Czego ten dyżur świadomie NIE robi

- **Nie robi wyglądu** (229), **nie robi ostrzeżeń o przepełnieniu** (230), **nie robi treści
  z wiedzy organizacji** (231).
- **Nie zmienia rozdzielności uprawnień** `presentation_edit` / `presentation_approve`.
- **Nie kasuje ani nie zastępuje istniejącego toru `agent-edit`.**

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Mechanizm propozycji dla decków już istnieje (trzy trasy) | komenda (1) |
| T2 | „Agent" jest parserem słów kluczowych, nie modelem | komenda (2) |
| T3 | **`/accept` nie sprawdza stanu operacji** — replay możliwy | komenda (3) |
| T4 | `getAiOperation` nie zwraca `status` — naiwny warunek nie zadziała | komenda (4) |
| T5 | Wzorzec bramy z 207 istnieje i jest przetestowany mutacją | komenda (5) |
| T6 | Dziennik działań agenta istnieje — rozszerzasz, nie tworzysz | komenda (6) |
| T7 | Tabela `presentation_ai_operations` ma kolumnę `status` | komenda (7) |
| T8 | Uprawnienia są rozdzielone i tej rozdzielności nie zmieniasz | komenda (8) |

---

# 3. POZYCJE DYŻURU

## R1 — ★★ BRAMA STANU NA `/accept` I `/reject` (rdzeń; **BEZ FLAGI, na stałe**)

**Dlaczego bez flagi:** brakująca kontrola stanu jest **usterką**, a usterek nie chowa się
za flagą. Flaga chroni **nowe zachowanie**, którego użytkownik jeszcze nie widział; tu chodzi
o to, żeby „odrzucone" znaczyło odrzucone.

### R1a — pomiar PRZED naprawą (obowiązkowy, to jest dowód, że dziura była)

Na realnym Postgresie, przez realny `ApiGateway` i podpisany JWT:

| przypadek | zmierz DZIŚ | wpisz do raportu |
|---|---|---|
| `/accept` → `/accept` (ta sama operacja dwa razy) | czy drugie wywołanie przechodzi; jaka jest wersja decku po każdym | wynik + `version` przed/po |
| `/reject` → `/accept` (odrzucona operacja zatwierdzona) | czy przechodzi; czy `deck_json` się zmienił | wynik + `SELECT status FROM presentation_ai_operations` |
| `/accept` operacji z **cudzego** decku / **cudzej** organizacji | czy `404` | wynik |

★★ **To jest pomiar, nie hipoteza.** Jeżeli którykolwiek przypadek zachowa się inaczej, niż
opisuje `§1` — **Twój pomiar jest wiążący** i idzie do „Korekt wobec instrukcji". Nadzorca czytał
kod, nie uruchamiał go.

### R1b — brama, trzy warstwy, wzorem 207

1. **Odczyt stanu.** `getAiOperation` (`:886`) **musi zwracać `status`** — dziś nie zwraca
   (`:891-909`).
   ★★ **PUŁAPKA, KTÓRA ZJE CI GODZINĘ, JEŻELI JEJ NIE PRZECZYTASZ:** dopisanie w `/accept`
   warunku `if (op.status !== 'pending')` **bez** poprawienia `getAiOperation` skompiluje się
   i **odrzuci wszystko** (`undefined !== 'pending'`). Po drobnej pomyłce w drugą stronę —
   przepuści wszystko. **Najpierw odczyt, potem warunek.**
2. **Warunek w trasie.** `/accept` i `/reject` odmawiają, gdy operacja nie jest w stanie
   oczekującym. Kod odpowiedzi ustalasz Ty i uzasadniasz (`409` czy `400`) — ale **nie `404`**,
   bo operacja istnieje, tylko jest rozstrzygnięta.
3. **Warunek w samym `UPDATE`.** Wzorem `aiActionExecutor.ts:887-889`: zmiana stanu następuje
   **tylko** wtedy, gdy stan wyjściowy jest oczekiwany (`WHERE id = ? AND status = ?`), a liczba
   zmienionych wierszy jest sprawdzana. Bez tego dwa równoległe `/accept` przejdą oba.

★★ **PAMIĘĆ PODRĘCZNA W PROCESIE JEST TU MINĄ.** `getAiOperation` czyta najpierw
`pendingDeckAiOperations` (`:888`), a `resolveAiOperation` usuwa wpis z cache'u (`:916`).
**Bramę stawiasz na stanie z BAZY, nie z cache'u.** Test, który przechodzi tylko dlatego, że
cache został wyczyszczony, nie dowodzi bramy — dowodzi cache'u. **Zmierz oba tory** (z cache'em
i po restarcie procesu / z pominięciem cache'u) i opisz.

### R1c — ★★ PARA DOWODOWA (to jest bramka dyżuru)

| przebieg | oczekiwane |
|---|---|
| **ZIELONY** | `/accept` na operacji oczekującej → deck zmieniony, `version` +1, status `applied` |
| **CZERWONY — test omijający** | `/accept` na operacji **już zastosowanej** → **odmowa**; `deck_json` **bajt w bajt identyczny**; `version` **niezmieniona** |
| **CZERWONY — test omijający** | `/accept` na operacji **odrzuconej** → **odmowa**; `deck_json` niezmieniony |
| **MUTACJA** | usunięcie bramy (jednej z trzech warstw, po kolei) → **każdy z powyższych testów czerwony** |

★★ **DOWODEM BRAKU ZMIANY JEST STAN BAZY, NIE BRAK LOGU.** Asercja porównuje `deck_json`
i `version` **przed i po**, odczytane z bazy. „Nie widziałem wpisu" nie jest dowodem.
To jest ta sama pułapka, która **31.08 cztery razy dała zielone testy przy skasowanym
zabezpieczeniu**.

**Do raportu wchodzą wyjścia wszystkich przebiegów, dosłownie, z pełnymi nazwami testów.**

★ **Zakaz `--retry`** w tym pakiecie: zmierzono w tym programie wektor, w którym test
bezpieczeństwa **leczy się skutkiem własnego ataku** — pierwsze `/accept` powodzi się, drugie
odmawia, i przy `--retry` całość raportuje `PASS` z fałszywego powodu.

## R2 — OPERACJE REDAKCYJNE PRZEZ PROPOZYCJĘ, ZA FLAGĄ `ENABLE_TERESA_DECK_EDIT` (rdzeń)

Pięć operacji na gotowym decku: **przeredaguj slajd** · **skróć** · **rozbij na dwa** ·
**zmień archetyp** · **dodaj źródło**.

### R2a — TABELA OBOWIĄZKOWA nr 1: pięć operacji

Dla każdej: co dokładnie zmienia w `deck_json`, jakie ma parametry, co robi przy fladze OFF
(odpowiedź: **nic — operacja nie istnieje**), i **jak wygląda jej wpis w `diff`-ie propozycji**.

### R2b — WYBÓR MECHANIZMU: rozstrzygasz Ty, z liczbami

Dwie drogi. **Wybierasz jedną i uzasadniasz pomiarem**, nie preferencją:

- **(A) przez istniejący tor decku** (`presentation_ai_operations` + `/agent-edit` + `/accept`) —
  zaleta: `diff` całego decku, wersjonowanie (`presentation_deck_versions`, wstawiane `:4148-4162`),
  gotowy dziennik i audyt, gotowe uprawnienia. Wada: to piąty mechanizm, osobny od `ai_actions`.
- **(B) przez tor 207** (`ai_actions`: `requestChatToolProposal` → `requestAction` →
  `approveAction` → `executeAction`) — zaleta: jedna brama dla wszystkich propozycji modelu,
  gotowa polityka i role. Wada: `ai_actions` nie zna `diff`-a decku ani wersji.

★★ **Zakaz drogi (C) — „zbudujmy trzecią, lepszą".** Szósty mechanizm jest zakazany.
Jeżeli uznasz, że żaden nie pasuje — **STOP MERYTORYCZNY pozycji z opisem**.

### R2c — model proponuje, człowiek zatwierdza

Jeżeli podpinasz model (a nie tylko rozszerzasz parser), robisz to **przez istniejącą pętlę
narzędziową** — `executeToolCall` (`server/src/services/ai/toolDefinitions.ts:583`) i rejestrację
narzędzi propozycji wzorem `ai.routes.ts:4808-4864` (`onProposalToolCall` → zwrot
`{status:'PENDING_APPROVAL'}`, **bez mutacji**).
★ Fail-closed jest już wbudowany: brak callbacku propozycji ⇒ `PROPOSAL_REJECTED`
(`server/src/services/ai/llmService.ts:1346-1352`). **Nie osłabiasz tego.**
★★ **Model wołasz WYŁĄCZNIE ze skryptu `tsx`, NIGDY z `*.test.ts`** — `tests/setup.ts:896`
bezwarunkowo podmienia `global.fetch`. Budżet: **JEDEN PRZEBIEG**, i tylko jeśli jest potrzebny.
Jeżeli nie wołałeś — napisz „modelu nie wołałem".

## R3 — DZIENNIK TEGO, CO AGENT ZROBIŁ (rdzeń warunkowy)

Wzorzec Gammy: panel pokazuje **listę wykonanych czynności**, nie pasek postępu.
U nas zdarzenia **już są** (`agent_edit_proposal_created`, `agent_edit_applied`,
`agent_edit_rejected`, `agent_edit_noop`) i historia agenta ma trasy (`:6699`, `:6838`, `:7099`).

**Zmierz, czy którykolwiek ekran to dziś RENDERUJE.** Kandydaci:
`src/services/presentationAgentHistory.ts`, `src/services/presentationRuntimeEvents.ts`,
`src/components/Presentations/DeckBuilder/DeckAuditLogModal.tsx`,
`src/components/Presentations/DeckBuilder/DeckBuilderMelsRightRail.tsx`.
★★ **Ósmy kształt fałszywego gotowe:** wołacz API istnieje, a komponent nigdy nie jest
renderowany — warstw jest cztery, nie trzy. **Udowodnij montaż realnym renderem, nie grepem.**
Jeżeli nic tego nie renderuje — **to jest ustalenie do raportu**, a Ty pokazujesz dziennik
w harnessie i mówisz wprost, że nie jest wpięty w produkt.

## R4 — PROPOZYCJE NASTĘPNYCH RUCHÓW (nie-rdzeń)

Trzy, wzorem Gammy: „dodaj 2 slajdy" · „znajdź powiązane studia przypadku" ·
**„zwizualizuj slajdy przeładowane tekstem"**.

★ **Trzecia spina się wprost z dyżurem 230** (detektor przepełnienia). **Nie implementujesz jej
detektora u siebie** — jeżeli 230 nie jest jeszcze scalony, propozycja pozostaje **nieaktywna**
i opisujesz zależność. Duplikat detektora to dwa źródła prawdy o tym samym.
★ Propozycja jest **propozycją**: kliknięcie prowadzi do **karty propozycji do zatwierdzenia**,
nigdy do wykonania.

## R5 — ZRZUTY (rdzeń dowodowy, `CLAUDE.md` §7)

`dev-render/screens/day232-agent-decku.tsx` + wpis w `dev-render/main.tsx`.
**Sześć obrazów:** {propozycja oczekująca, propozycja zastosowana, propozycja odrzucona}
× {jasny, ciemny}. `mean_luma` każdego, różnica w parze **> 150**.
★ Kanon powłoki artefaktu (deck = archetyp **E — Deck**):
`Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` §10.2/§11.2 (powłoka wspólna,
`ArtifactRightPanel`), §13 (per archetyp), §18.1 (DoD odbioru).
★★ Tokeny `c-*`, **zero `primary-*` — KAŻDY numer `primary` w tym tailwindzie to crimson
`#85182F`** (`CLAUDE.md` §3, §6). Hook `scripts/check-artefakt.sh` blokuje naruszenia w powłoce;
uruchom go przed commitem.
★ W raporcie piszesz **wprost**, czy dane na zrzucie pochodzą z realnego przebiegu, czy z propsów.

---

# 4. TABELA LICENCJI PLIKOWYCH

Licencja obejmuje całą ścieżkę: brama stanu → operacje → propozycja → zatwierdzenie → audyt →
dziennik → zrzut.

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/routes/presentations.routes.ts` — WYŁĄCZNIE: (a) `getAiOperation` (`:886-910`) — dodanie odczytu `status`; (b) `/agent-edit/:operationId/accept` (`:4128`) i `/reject` (`:4218`) — brama stanu z `R1b`; (c) `resolveAiOperation` (`:914`) — warunek stanu w `UPDATE`; (d) gałąź za flagą dla operacji z `R2`. **ZAKAZ zmiany rozdzielności uprawnień** (`presentation_edit` przy propozycji, `presentation_approve` przy `/accept` i `/reject`), **zakaz dotykania tras eksportu** (`:2569`, `:2832`, `:3649`, `:7657` — dyżur 230) **i tras generowania** (`:1912`, `:1923` — dyżur 231) |
| Zapis | `server/src/services/presentationAgentEditService.ts` — WYŁĄCZNIE addytywne rozszerzenie o operacje z `R2`. **Zakaz zmiany semantyki `parsePresentationEditIntent` (`:53`) dla intencji, które dziś rozpoznaje**, i zakaz zmiany dzisiejszych wartości `requiresApproval` (`:62`, `:157`, `:168`) |
| Zapis | `server/src/config/FeatureFlags.ts` — WYŁĄCZNIE dodanie `ENABLE_TERESA_DECK_EDIT` (schemat wzorem `:55`, blok ładujący wzorem `:247-248`). **Zakaz zmiany wartości domyślnej jakiejkolwiek istniejącej flagi**, w szczególności `ENABLE_TERESA_TOOL_LOOP_WRITE` (`:37`, `:157`) |
| Zapis | `server/src/services/ai/toolDefinitions.ts` — dozwolone WYŁĄCZNIE, jeżeli wybierzesz drogę (B) w `R2b`: **addytywna** definicja narzędzi redakcyjnych. **Zakaz zmiany semantyki któregokolwiek istniejącego executora — READ i WRITE** — i zakaz zmiany `executeToolCall` (`:583`) poza dopisaniem `case` |
| Zapis | `server/src/services/aiActionExecutor.ts` — dozwolone WYŁĄCZNIE przy drodze (B): **wywołanie** `requestAction` z nowego producenta i addytywne rozszerzenie mapowania typów akcji. **ZAKAZ ZMIANY SEMANTYKI `approveAction`/`rejectAction`/`executeAction` i zakaz zmiany kolejności bramek w `requestAction`.** ★ Plik ma `// @ts-nocheck` w pierwszej linii — pracujesz bez osłony typów i **odnotowujesz to w raporcie jako podjęte ryzyko** |
| Zapis | NOWA migracja `server/migrations/20260901_*.sql` — **wyłącznie addytywna**, wyłącznie jeżeli pomiar `R1a` pokaże brak kolumny/indeksu potrzebnego bramie; `ADD COLUMN IF NOT EXISTS`, pełny przebieg na pustej bazie + drugi przebieg |
| Zapis | Front — WYŁĄCZNIE w zakresie `R3`/`R4`: dziennik i propozycje ruchów w JEDNYM miejscu ustalonym pomiarem. **Zakaz przebudowy `DeckBuilder.tsx`**, zakaz zmiany zachowania bramek jakości (`:386`, `:668`) |
| Zapis | NOWY ekran `dev-render/screens/day232-agent-decku.tsx` + wpis w `dev-render/main.tsx` |
| Zapis | NOWE pliki testowe `day232.*` w `server/src/routes/__tests__/`, `tests/unit/backend/`, `tests/integration/`. ★ Nowe pliki w `tests/` wymagają `git add -f` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY232_GAMMA_AGENT_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `tests/unit/backend/day207.write-proposal.contract.test.ts` · `tests/integration/day217-gf-agt-02.realdb.test.ts` — **wzorzec testu bramy, który kopiujesz**; nie zmieniasz ich |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/aiRoleGuard.ts` · `chatPermissionService.ts` · `aiPolicyEngine.ts` · `aiRunLedgerService.ts` · `server/src/services/ai/chatPolicyGateway.ts` · `server/src/services/ai/sideEffectTools.ts` — bramek, macierzy i list side-effect **nie zmieniasz**; masz przez nie PRZECHODZIĆ |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/ai/AIPipeline.ts` · `llmService.ts` · `server/src/routes/ai.routes.ts` — pętla 206/207 nietykalna poza addytywną rejestracją narzędzi przy drodze (B) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/report/pptx/**` · `server/src/services/deliverables/**` — teren dyżurów 229 i 230 |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/presentationGeneratorService.ts` — teren dyżuru 231 |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` · `server/src/database/Database.ts` (`Z18`) |
| Odczyt | `docs/program/funkcje/GAMMA_G3_OBCHOD_MENU.md` (panel `Agent`) · `ARCHITEKTURA_AGENTA_TERESY.md` §12 · `MODUL17_DOWOD_REALNYM_MODELEM.md` · `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` (§10.2, §11.2, §13, §18.1) · `docs/ui-standards/TRIADA_KANON.md` |
| Odczyt | `~/.consultify-openrouter` — WYŁĄCZNIE jeżeli wołasz model w `R2c`, WYŁĄCZNIE przez `set -a; . ~/.consultify-openrouter; set +a`; nigdy nie wypisujesz zawartości |

**Nietykalne imiennie:** `sideEffectTools.ts` · `aiRoleGuard.ts` · `chatPermissionService.ts` ·
`aiPolicyEngine.ts` · `aiRunLedgerService.ts` · `chatPolicyGateway.ts` · rozdzielność
`presentation_edit` / `presentation_approve` · `presentationExportGate.ts` ·
`server/src/services/report/pptx/**` · `server/src/services/deliverables/**` ·
`presentationGeneratorService.ts` · `vitest.config.ts` · `tests/setup.ts` · `Database.ts` ·
każdy `MODULE_ACCEPTANCE.md`.

**★★ ROZŁĄCZNOŚĆ Z PARTIĄ RÓWNOLEGŁĄ.**
**Cztery dyżury wydane 01.09 pracują w tym samym module. Granice imienne:**

| dyżur | zakres | Twoja granica wobec niego |
|---|---|---|
| **226** | martwy edytor motywu: `presentations.routes.ts:1566-1567`, `presentationTemplateRuntimeService.ts:372-452` | nie dotykasz tras szablonów |
| **227** | geometria dwóch rendererów: `GRID` w `designTokens.ts`, `DECK_GRID` w `DeckStyler.ts`, `initiativeMaterializeService.ts:488` | nie dotykasz siatki, marginesów ani pola treści |
| **228** | styl obrazu w motywie: `deckVisualsService.ts` (~`:599`), `deckImageResolverService.ts` | nie dokładasz generowania obrazów |
| **229** | ciemny motyw i typografia: `designTokens.ts` (tusz, kroje, stopnie, wagi, interlinia), `atomics/*.ts` | nie dotykasz kolorów, stopni, wag ani interlinii |
| **230** | przepełnienie: `fit: 'shrink'`, detektor, ostrzeżenie | nie dokładasz i nie usuwasz `fit: 'shrink'`, nie duplikujesz detektora |
| **231** | treść z wiedzy: `generateOutline`, prowieniencja decku | nie dotykasz drogi powstawania treści |
| **232** | agent redagujący: trasy `agent-edit`, brama stanu | nie dotykasz tras `agent-edit` |

**Wiersz opisujący TWÓJ dyżur pomijasz — reszta obowiązuje.**
 `presentations.routes.ts` ma **8187 linii** i wchodzą
w niego równolegle dyżury **230** (trasy eksportu) i **231** (trasy generowania).
Twoja granica: **wyłącznie trasy `agent-edit` (`:4004`, `:4128`, `:4218`) i trzy funkcje pomocnicze
(`:860`, `:886`, `:914`)**. Przed pierwszym commitem:

```bash
git -C "$WT" log --oneline 9fb7942a01..github-backup/codex/m03-admin-20260824 -- \
  server/src/routes/presentations.routes.ts server/src/services/presentationAgentEditService.ts
```

i **zgłoś kolizję zasobową ZANIM zaczniesz pisać, nie po.**

---

# 5. TWARDE ZASADY

- ★★ **BRAMA MA CZERWIENIEĆ PO USUNIĘCIU — TO JEST CAŁA BRAMKA TEGO DYŻURU.**
  Test omijający (**wykonanie BEZ zatwierdzenia / na operacji już rozstrzygniętej**) musi dać
  **odmowę**, a mutacja usuwająca którąkolwiek z trzech warstw bramy — **czerwień**.
  Warstwy testujesz **po kolei, osobno**: sam warunek w trasie, sam warunek w `UPDATE`,
  sam odczyt `status`. Mutacja psująca wszystkie naraz nie dowodzi, że warstwy są trzy.
- ★★ **DOWODEM BRAKU ZMIANY JEST STAN BAZY, NIE BRAK LOGU.** Asercja porównuje `deck_json`
  i `version` **odczytane z bazy** przed i po. „Nie widziałem wpisu" nie jest dowodem.
  **To jest ta sama pułapka, która 31.08 cztery razy dała zielone testy przy skasowanym
  zabezpieczeniu.**
- ★★ **NAJPIERW ODCZYT `status`, POTEM WARUNEK.** `getAiOperation`
  (`server/src/routes/presentations.routes.ts:886-910`) **nie zwraca dziś pola `status`**.
  Dopisanie w `/accept` warunku `if (op.status !== 'pending')` bez poprawienia odczytu
  **skompiluje się** i odrzuci **wszystko** (`undefined !== 'pending'`) — albo, po drobnej
  pomyłce, przepuści wszystko. Obie pomyłki dadzą „zielone" testy przy złym zachowaniu.
- ★★ **BRAMĘ STAWIASZ NA STANIE Z BAZY, NIE Z PAMIĘCI PODRĘCZNEJ.** `getAiOperation` czyta
  najpierw `pendingDeckAiOperations` (`:888`), a `resolveAiOperation` usuwa wpis z cache'u
  (`:916`). Test, który przechodzi tylko dlatego, że cache został wyczyszczony, **dowodzi
  cache'u, nie bramy**. Zmierz oba tory i opisz.
- ★★ **ZAKAZ BUDOWY SZÓSTEGO MECHANIZMU PROPOZYCJI.** Jest ich pięć: cztery w czacie
  i piąty własny dla decków (`presentation_ai_operations`). Wybierasz jeden z istniejących
  i uzasadniasz **liczbami**. Jeżeli żaden nie pasuje — **STOP MERYTORYCZNY pozycji z opisem**,
  nie szósty mechanizm. **Kasowanie piątego jest równie zakazane** — ma żywe trasy, żywą tabelę
  i żywych konsumentów front-endowych.
- ★★ **ROZDZIELNOŚĆ UPRAWNIEŃ JEST NIETYKALNA.** Propozycja wymaga `presentation_edit`,
  zatwierdzenie i odrzucenie — `presentation_approve`. Tego podziału **nie zmieniasz w żadną
  stronę**, także „przy okazji" ani „dla uproszczenia testu".
- ★★ **`R1` IDZIE BEZ FLAGI, `R2`-`R4` ZA FLAGĄ.** Brakująca kontrola stanu to **usterka**,
  a usterek nie chowa się za flagą — po naprawie „odrzucone" ma znaczyć odrzucone
  natychmiast i dla wszystkich. Nowe operacje redakcyjne to **nowe zachowanie** i idą za flagą
  `ENABLE_TERESA_DECK_EDIT`, **default OFF**.
- ★★ **MODEL WYŁĄCZNIE ZE SKRYPTU `tsx`, NIGDY Z `*.test.ts`** — `tests/setup.ts:896`
  bezwarunkowo podmienia `global.fetch` na atrapę zwracającą `200` z pustą treścią.
  Budżet: **JEDEN PRZEBIEG**, i tylko jeżeli jest potrzebny.
  **Jeżeli nie wołałeś modelu — napisz „modelu nie wołałem".** `Z40` bez wyjątku: wartość klucza
  nie pojawia się nigdzie; pokazujesz `obecny`/`nieobecny`.
- ★★ **FAIL-CLOSED PROPOZYCJI JEST NIETYKALNY.** Brak callbacku propozycji daje dziś
  `PROPOSAL_REJECTED` (`server/src/services/ai/llmService.ts:1346-1352`). **Nie osłabiasz tego**
  — ani „tymczasowo do testu", ani przez domyślkę „jak nie ma callbacku, to wykonaj".
- ★★ **STRAŻNIK POUFNOŚCI NIETYKALNY.** Karta propozycji nie może nieść do UI ani jednego bajtu
  treści, której wołający nie zobaczyłby bez niej. Surowe wyniki narzędzi **nie wchodzą** do SSE
  ani do payloadu karty.
- ★★ **ZAKAZ `--retry` W PAKIECIE BRAMY.** Zmierzony wektor: test bezpieczeństwa **leczy się
  skutkiem własnego ataku** — pierwsze `/accept` się powodzi, drugie odmawia, a przy `--retry`
  całość raportuje `PASS` z fałszywego powodu. Każde `X/X PASS` bez asercji na stan bazy
  i bez dowodu mutacyjnego jest w tym programie **podejrzane z urzędu**.
- ★ **NIE DUPLIKUJESZ DETEKTORA PRZEPEŁNIENIA.** Propozycja „zwizualizuj slajdy przeładowane
  tekstem" (`R4`) należy do dyżuru **230**. Jeżeli 230 nie jest scalony — propozycja pozostaje
  **nieaktywna**, a Ty opisujesz zależność. Dwa detektory to dwa źródła prawdy o tym samym.
- ★ **`server/src/services/aiActionExecutor.ts` MA `// @ts-nocheck` W PIERWSZEJ LINII.**
  Jeżeli w nim pracujesz (droga (B) w `R2b`), **typy Cię nie osłonią** — odnotuj to w raporcie
  jako podjęte ryzyko.
- ★ **KOD ODPOWIEDZI PRZY ODMOWIE NIE MOŻE BYĆ `404`.** Operacja istnieje, tylko jest
  rozstrzygnięta. `404` skłamie wołającemu i zepsuje odróżnienie „cudza operacja" od
  „operacja już zamknięta". Wybór (`409` czy `400`) uzasadniasz w raporcie.
- ★★ **SUFIT FORMATU JEST TWARDY I ZMIERZONY, NIE ZAKŁADANY.** `pptxgenjs 4.0.1`
  (`package.json`, blok `dependencies`): **gradienty NIEMOŻLIWE** (zero wystąpień słowa
  „gradient" w całej zainstalowanej paczce — typy i wszystkie bundle),
  **osadzanie krojów NIEMOŻLIWE** (biblioteka tego nie oferuje). Dostępne i już używane:
  przezroczystość, pełny zestaw kształtów OOXML, auto-dopasowanie tekstu, obrazy w tle
  (`docs/program/funkcje/GAMMA_G0_POMIAR.md`, rozdział „Sufit biblioteki"). Gradient
  wolno **udawać kształtami** albo **wypalić w PNG**. **Nie obiecujesz gradientu w PPTX.**
- ★★ **GRANICA: RASTER DLA MATERIAŁU, WEKTOR DLA ZNACZENIA**
  (`docs/program/funkcje/GAMMA_G1_OBRAZY.md` §5). W PNG wolno wypalić WYŁĄCZNIE to, co nie
  niesie informacji: pole koloru, gradient, ziarno, teksturę, welon. **NIGDY** nie wypalasz:
  tekstu, liczb, macierzy kropek, pasków, pierścieni, wykresów — one zostają kształtami
  OOXML, **bo agent redagujący (dyżur 232) musi móc je zmienić**.
- ★★ **ZABEZPIECZENIE BEZ TESTU, KTÓRY CZERWIENIEJE PO JEGO USUNIĘCIU, JEST NIEUDOWODNIONE.**
  Każda bramka w tym dyżurze ma **parę dowodową**: przebieg zielony (mechanizm działa) +
  przebieg czerwony po mutacji (mechanizm jest naprawdę tym, co trzyma). Wyjście OBU
  przebiegów wchodzi do raportu dosłownie. „Testy przeszły" nie jest dowodem.
- ★★ **PUŁAPKI ZMIERZONE 31.08 — SPRAWDŹ KAŻDĄ U SIEBIE, NIE PRZEPISUJ TEJ LISTY:**
  (1) `server/src/config/Database.ts` ok. `:79-85` **cicho podstawia atrapę bazy** — bez
  `MOCK_DB=false` Twoje „zapisy" nie lądują nigdzie, a odczyty kłamią;
  (2) `vitest.config.ts` ok. `:210` **przypina `DB_TYPE`** — mierzysz inny silnik, niż myślisz;
  (3) `tests/setup.ts` **podmienia `global.fetch`** — dlatego **realny model wolno wołać
  WYŁĄCZNIE ze skryptu `tsx`, NIGDY z pliku `*.test.ts`**; test z realnym modelem to test
  z atrapą, która udaje model;
  (4) atrapy zakładane w `beforeEach` przeżywają dłużej, niż wygląda;
  (5) czytasz `Test Files` **i kod wyjścia** — `No test files found` przy `exit 0` **nie jest
  `PASS`**, a `npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów.
  Numery linii w (1) i (2) **zmierz na swojej bazie** — mogły się przesunąć; jeżeli się
  przesunęły, wpisz zmierzone do „Korekt wobec instrukcji".
- ★★ **FLAGA DOMYŚLNIE WYŁĄCZONA** (`CLAUDE.md` §7, §9). Przy fladze OFF zachowanie produktu
  ma być **bajt w bajt dzisiejsze** — to jest osobna asercja, nie domysł. Zakaz włączania
  czegokolwiek na żywo bez akceptu właściciela na zrzucie.
- ★★ **WŁAŚCICIEL NIGDY NIE JEST PIERWSZYM TESTEREM WIZUALNYM** (`CLAUDE.md` §7 —
  powód nazwany imiennie: załamanie 07-11). Zrzuty robisz **Ty**, przed nim.
  **Para jasny/ciemny musi się REALNIE różnić**: podajesz `mean_luma` obu obrazów i różnicę
  **> 150**. Zdarzył się w tym programie przypadek dwóch identycznych obrazów pod dwiema
  nazwami (kształt „duplikat zamiast motywu") — `shasum` tego nie wykrywa, bo plakietka
  zmienia SHA. Pomiar jednolinijkowy (`sharp` jest w `devDependencies`):
  ```bash
  node -e "const s=require('sharp');s(process.argv[1]).stats().then(r=>console.log(process.argv[1], (0.2126*r.channels[0].mean+0.7152*r.channels[1].mean+0.0722*r.channels[2].mean).toFixed(1)))" <plik.png>
  ```
  Harness sam ustawia motyw z adresu (`dev-render/main.tsx:1637-1660`: klasa `.dark`,
  `useAppStore.setState({theme})` **oraz** `MutationObserver` przywracający klasę) — więc
  identyczna para **nie ma prawa** wyjść; jeśli wyjdzie, to jest usterka Twojego przebiegu,
  nie harnessu, i masz ją opisać.
- ★★ **W RAPORCIE PISZESZ WPROST, CZY DANE NA ZRZUCIE POCHODZĄ Z REALNEGO PRZEBIEGU, CZY
  Z PROPSÓW W HARNESSIE.** Zrzut zamockowanej powłoki **nie jest dowodem renderu**
  (kształt „przyrząd kłamie, a oko przywyka"; audyt 207 uznał izolowany ekran dev-render za
  storybook, nie za dowód).
- ★ **`Z13`:** logi, dzienniki przebiegu, zrzuty, pliki `.pptx` i wyjścia bramek **nie wchodzą
  do repo** — leżą w katalogu artefaktów, a raport podaje ścieżki i `shasum -a 256`.
- ★ **`Z27` — zakaz `git stash`** w każdej postaci; stan odkładasz przez `cp` do katalogu
  scratch i wracasz przez `cp`. Schowek jest współdzielony między wszystkimi worktree tego
  repozytorium.
- ★ **`Z28`** — zero połączeń do bazy zdalnej, demo, stagingu i produkcji, w każdą stronę
  i każdym narzędziem.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest **PUBLICZNY** (`Z1`).
- ★ **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie `exclude`,
  `--no-verify`) i zakaz usuwania zastanych testów — asercję wolno **ZMIENIĆ**
  z uzasadnieniem w treści commita, nigdy skasować.
- ★ **`§0.4a` — pomiar zasięgu testów PEŁNYMI NAZWAMI jest warunkiem oddania raportu**
  (`Z24`). Przepisanie cudzej liczby = zawyżenie i podstawa odrzucenia.
- ★ **`Z31`** — `assertRealPostgresTestEnvironment()` wołasz **BEZ ARGUMENTÓW**; zakaz
  asercji na `DATABASE_URL`, na porcie i na nazwie kontenera. Sześć incydentów w programie;
  nie dokładaj siódmego.
- ★ **Sprzątanie kontenera: `docker rm -f -v`** — z flagą `-v`, inaczej wolumen zostaje.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.**
  Brak tej sekcji jest podstawą odrzucenia dyżuru.
