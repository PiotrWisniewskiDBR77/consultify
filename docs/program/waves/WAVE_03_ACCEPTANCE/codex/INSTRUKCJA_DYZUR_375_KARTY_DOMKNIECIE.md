# INSTRUKCJA DYŻURU nr 375 — Codex — „★★ KARTY PROPOZYCJI W CZACIE — DOMKNIĘCIE PO ODBIORZE DYŻURU 371, TRZY ZASTRZEŻENIA, TRZY POZYCJE. **R1 (dowód, nie kod) — brak niezależnie odtwarzalnego GREEN dla naprawy 500→409.** Kod naprawy jest już na markerze i zweryfikowany źródłowo: `ChatToSchemaService.ts:483-486` rzuca `TablePlatformError(..., 'PROPOSAL_ALREADY_EXECUTED', 409, ...)`, `table-platform.routes.ts:1816` woła `handleRouteError(e, res, 'schema/execute')`. Test istnieje i jest dobrze skonstruowany — `server/src/routes/__tests__/day371.chatToSchema.executeConflict.pg.test.ts` (realny `ApiGateway`, podpisany JWT, odczyt `resolved_at` z bazy) — ale odbiór adwersaryjny 371 sprawdził WSZYSTKIE trzy zapisane artefakty JSON reportera z tamtej pracy (`r3-mutation-red.json`, `r3-post.json`, `r3-final-green.json`) i każdy pokazuje `numPassedTests:0, numFailedTests:0, status:'skipped'` — kontener `cx-day371-pg` już nie istnieje, więc GREEN dla R3/371 jest wyłącznie zdaniem w raporcie, nie artefaktem. Zadanie: uruchomić TEN SAM plik testu na WŁASNYM, świeżym kontenerze PostgreSQL tego dyżuru (port 6446, baza `cx375`), dwa razy (podstawowy przebieg PASS z zapisanym JSON-em reportera faktycznie pokazującym `numPassedTests:1`, oraz przebieg z tymczasową mutacją odwrotną — cofnięciem typowanego 409 z powrotem na goły `mapAppErrorResponse`+`res.status(500)` przez `cp` — który ma dać RED z zapisanym JSON-em), obie kopie osobno nazwane, ten sam mianownik (nazwa testu `'returns 200 once, then typed 409 without changing resolved_at again'` w obu plikach). **R2 (pomiar + naprawa, RDZEŃ) — `TeresaProposalCard` ma bardzo prawdopodobnie DOKŁADNIE ten sam kształt defektu co D-3/371, tylko niewykryty metodą R1/371.** `TeresaProposalCard.tsx:71` trzyma `currentProposal` w `useState(proposal)`, zsynchronizowanym WYŁĄCZNIE przez `useEffect(() => setCurrentProposal(proposal), [proposal])` (l.74-76) — czyli źródłem prawdy PO (re)moncie jest wyłącznie prop `proposal`, a ten prop pochodzi z `msg.metadata.proposal`, czyli z `conversation_messages.metadata`, które (jak już ustalono w 371, `chatHandoffService.ts:45`) jest PERSYSTOWANE PRZEZ KLIENTA i serwer go nigdy nie odświeża. Test rodziny z 371 (`day371.proposalFamily.remount.test.tsx:117-124`) oznaczył tę kartę jako 'już poprawna', ale zrobił to WYŁĄCZNIE przez podanie DWÓCH RÓŻNYCH propsów przy dwóch osobnych mountach — co dowodzi tylko, że komponent poprawnie reaguje na ZMIANĘ propsa, nie że po prawdziwym F5 (TEN SAM, zamrożony prop) pokaże żywy stan. Backend TEN RAZ jest już poprawny i nie wymaga zmiany: akcje karty (`Api.approveTeresaProposal`/`rejectTeresaProposal`/`executeTeresaProposal`/`undoTeresaProposal`, `src/services/api.ts:2564-2604`) idą przez `POST /api/v8/teresa/proposal/:id/{approve,reject,execute,undo}` (`server/src/routes/v8/teresa.routes.ts:211,238,266,294`) do `teresaCopilotService.{approveProposal,...}` (`server/src/services/v8/teresaCopilotService.ts`), operującego na tabeli `teresa_proposals` z jawnymi strażnikami przejść stanu (`TeresaCopilotError('...', 'P08_INVALID_STATE_TRANSITION')`, l.1583-1589 i analogiczne w reject/execute/undo) — to NIE jest ślepy plain-Error-500 jak w K9/371; typowany błąd już tam jest. UWAGA — poprzedni odbiór (`ODBIOR_371.md`, Zastrzeżenie 1) napisał, że ta karta idzie przez `workCanvasService`/`work_canvas_proposals` — TO JEST NIEPOTWIERDZONE ŹRÓDŁOWO i, wedle świeżego odczytu przy pisaniu tej instrukcji, WYGLĄDA NA POMYŁKĘ: `workCanvasService`/`work_canvas_proposals` jest wpięty wyłącznie w zupełnie inny plik routingu, `server/src/routes/work-canvas.routes.ts` (l.3727-3823), którego `teresa.routes.ts` w ogóle nie importuje — ZWERYFIKUJ TO SAM, PIERWSZA KOMENDA `§0.3` (1), zanim uwierzysz którejkolwiek wersji, mojej czy odbiorcy. Żywy odczyt statusu JUŻ ISTNIEJE po stronie serwera: `GET /v8/teresa/proposal/:id` (`server/src/routes/v8/teresa.routes.ts:325-333`, woła `teresaService.getProposal` + `toChatProposalEnvelope`) — DOKŁADNY analog `getSchemaProposal`, którego w 371 użyto do naprawy `ChatTableProposalCard`. Klient NIE MA jeszcze wrappera na ten GET (`src/services/api.ts` ma tylko approve/reject/execute/undo, l.2564-2604, zero `getTeresaProposal`). Naprawa: dopisać `Api.getTeresaProposal` (nowa funkcja, wąska licencja) i wywołać ją przy (re)moncie `TeresaProposalCard`, tym samym wzorcem co `ChatTableProposalCard.tsx:60-76` (aktywny `useEffect` z flagą `active`, `.catch()` łykający błąd bez wywalenia komponentu, lokalny `useState` jako WYŁĄCZNIE optymistyczna nakładka na własną akcję w tej samej sesji). **R3 (pomiar + orzeczenie + naprawa jeśli w licencji) — `GovernedInitiativeHandoffCard` ma PRAWDZIWEGO, żywego producenta i żywy backend (NIE jest martwa jak `CaseIntakeConfirmCard` z 371), ale zero odczytu stanu przy (re)moncie.** Karta startuje ZAWSZE z `useState('idle')` (`GovernedInitiativeHandoffCard.tsx:38`) niezależnie od tego, czy inicjatywa była już zaadoptowana. Producent jest realny: `UnifiedChatPanel.tsx:2321-2346` (gałąź `payloadKind === 'initiative'`), za flagą `teresaAdoptChatDraftEnabled = isEnabled('ENABLE_TERESA_ADOPT_CHAT_DRAFT')` (`UnifiedChatPanel.tsx:815`) — flaga jest PRAWDZIWA, NIE fantom: `server/src/config/FeatureFlags.ts:35,166` (`z.boolean().default(false)`, czytana z `process.env`) ORAZ backend (`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:1820`, ta sama zmienna, ten sam default false) obie strony zgodne. Backend POST `.../runtime-v1/adoptions/chat-draft` (l.1817-1818, zamontowany pod `/api/initiatives/runtime-v1`, `initiatives.routes.ts:156`) woła `adoptChatDraftInitiative` (`server/src/domain/initiatives-execution/adoptChatDraftInitiative.ts`), który materializuje realny wiersz agregatu `initiative` PRZEZ `MaterialCommandUnitOfWork` z deterministycznym `clientRequestId` (front buduje go jako `chat-draft-adopt:${initiativeId}`, `GovernedInitiativeHandoffCard.tsx` w `adopt()`). Dokładnie ten deterministyczny `clientRequestId` jest kluczem do naprawy: w TYM SAMYM pliku routingu istnieje JUŻ gotowy, generyczny odczyt kwitu komendy — `GET /command-receipts/:clientRequestId/read-back` (`initiativesExecutionRuntime.routes.ts:4692-4730`), który zwraca `readBackState: 'CONFIRMED'`, gdy komenda o danym `clientRequestId` już się zmaterializowała, albo `404`, gdy nigdy nie została wysłana. To NIE jest nowy endpoint do zbudowania — jest już zamontowany i używany generycznie przez inne polecenia w tym samym pliku. Naprawa (jeśli `R3` to potwierdzi pomiarem, nie moim zdaniem): przy (re)moncie karta odpytuje `GET /api/initiatives/runtime-v1/command-receipts/${encodeURIComponent('chat-draft-adopt:'+initiativeId)}/read-back` (ten sam wzorzec surowego `fetch` z `credentials:'include'`, jakiego karta już używa w `checkReadiness`/`adopt`, l.50 i l.83) — `CONFIRMED` ⇒ stan startowy `adopted` zamiast `idle`; `404`/błąd ⇒ zostaje dzisiejsze `idle`. Zero nowej flagi (naprawa defektu potwierdzonego, flaga zapisu zostaje jak jest, OFF domyślnie — reguła CLAUDE.md 'NIE dla naprawy defektu potwierdzonego' ma zastosowanie). Istniejący test rodziny z 371 (`day371.proposalFamily.remount.test.tsx:178-191`) dla tej karty jest DZIŚ czerwony CELOWO (udokumentowane jako STOP z licencją w `CODEX_DAY371_KARTY_PROPOZYCJI_REPORT.md`), ale dowodzi niewłaściwego mechanizmu — podaje fikcyjny prop `state:'adopted'`, którego komponent w ogóle nie przyjmuje (`as any` obchodzi typy) — więc po naprawdziwej naprawie ten test ma zostać PRZEPISANY na dowód zgodny z REALNYM mechanizmem (mock `fetch` do read-back), nie usunięty. **Jeśli pomiar `R3` obali cokolwiek z powyższego (np. `canViewAggregate`/`resolveProjectIdsForAggregate` nie przepuszcza zwykłego aktora, albo read-back nie rozróżnia stanów tak jak opisano) — to jest STOP merytoryczny z dowodem, nie budowa na siłę.** CaseIntakeConfirmCard NIE JEST częścią tego dyżuru — decyzja nadzorcy jest już rozstrzygnięta: zostaje jak na markerze (zastany dług), funkcja 'Teresa rozpoznaje sprawę' to pytanie do właściciela POZA tym pakietem — zero zmian w tym pliku."

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
> **wyłącznie** `/private/tmp/cx-day375-karty-domkniecie`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `8f60ab998734adcdf61a080f4e1270c3dbdffceb`**
> **Gałąź bazowa: `github-backup/grafika/m03-20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-05.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****`13_CHAT`** — karty propozycji w rozmowie (tabela, Teresa, inicjatywa), domknięcie trzech zastrzeżeń z odbioru adwersaryjnego dyżuru 371 (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY371_KARTY_PROPOZYCJI_REPORT.md` + odbiór zewnętrzny cytowany w briefie tego dyżuru). **R1** — brak niezależnie odtwarzalnego dowodu GREEN dla naprawy 500→409 (kod jest gotowy, dowód nie jest). **R2** — `TeresaProposalCard` prawdopodobnie ma ten sam kształt defektu co K9/371 (zamrożony status po F5), niewykryty słabszą metodą testu z 371. **R3** — `GovernedInitiativeHandoffCard` ma żywego producenta i żywy backend (nie jest martwa jak Case Intake), ale zero odczytu stanu przy remoncie — wymaga pomiaru punktu odczytu i, jeśli w licencji, naprawy tym samym wzorcem**.
Trasy front: `**R2 (Teresa, PEŁNA LICENCJA w zakresie R2):** `src/components/AIChat/TeresaProposalCard.tsx` (`useState(proposal)` l.71, `useEffect` sync l.74-76, brak żywego odczytu). **R2, wąska licencja warunkowa:** `src/services/api.ts` — WYŁĄCZNIE dopisanie nowej funkcji `getTeresaProposal` obok istniejących `approveTeresaProposal`/`rejectTeresaProposal`/`executeTeresaProposal`/`undoTeresaProposal` (l.2564-2604), zero zmian w innych funkcjach (plik ma tysiące linii, dziesiątki innych endpointów). **R3 (Inicjatywa, PEŁNA LICENCJA w zakresie R3):** `src/components/AIChat/GovernedInitiativeHandoffCard.tsx` (`useState('idle')` l.38, `checkReadiness` l.46-75 z surowym `fetch('/api/initiatives/:id')`, `adopt` l.80-105 z surowym `fetch('/api/initiatives/runtime-v1/adoptions/chat-draft')` i deterministycznym `clientRequestId`). **Pomiar producenta (TYLKO ODCZYT):** `src/components/AIChat/UnifiedChatPanel.tsx` (flaga `teresaAdoptChatDraftEnabled` l.815, gałąź `payloadKind==='initiative'` l.2321-2346, `initiativeHandoffByMessageId` state l.1132) · `src/components/AIChat/MessageRenderer.tsx` (derywacja `initiativeHandoff` l.524-527, render karty l.2027-2032) — ŻADNEGO z tych dwóch plików NIE zmieniasz w tym dyżurze, niezależnie od werdyktu `R3` (naprawa mieści się CAŁA wewnątrz karty). **Wspólny test rodziny (WĄSKA LICENCJA, edycja uzasadniona R2+R3):** `src/components/AIChat/__tests__/day371.proposalFamily.remount.test.tsx` — dopisanie `getTeresaProposal: vi.fn()` do istniejącego `vi.mock('@/services/api', ...)` (inaczej R2 wywali istniejący przypadek testowy Teresy błędem `undefined is not a function`), ewentualna korekta istniejącego przypadku Teresy (l.117-124) pod nowy mechanizm, przepisanie przypadku `GovernedInitiativeHandoffCard` (l.178-191) z fikcyjnego propsa `state` na mock realnego `fetch` read-back. Zakaz zmiany pozostałych czterech przypadków w tym pliku (ChatTableProposalCard×2, ExecutionProposalMessage, GovernedChatHandoffCard) — one dotyczą zamkniętego 371 i już są zielone`. Trasy tył: `**R1 (TYLKO ODCZYT — kod naprawy już gotowy, dowód to zadanie):** `server/src/services/tablePlatform/ChatToSchemaService.ts` (`throw new TablePlatformError(...)` l.483-486) · `server/src/routes/table-platform.routes.ts` (`handleRouteError(e, res, 'schema/execute')` l.1816) · istniejący test `server/src/routes/__tests__/day371.chatToSchema.executeConflict.pg.test.ts` (URUCHAMIASZ na WŁASNYM kontenerze, NIE zmieniasz treści, chyba że dowiedziesz literalnego błędu w nim samym — wtedy poprawka jest wąską licencją z uzasadnieniem w raporcie). **R2 (TYLKO ODCZYT — reużywasz istniejący GET):** `server/src/routes/v8/teresa.routes.ts` (`GET /proposal/:id` l.325-333, woła `teresaService.getProposal` + `toChatProposalEnvelope`; POST approve/reject/execute/undo l.211-304 — TYLKO CYTUJESZ jako dowód, że backend już ma typowane błędy, nie zmieniasz) · `server/src/services/v8/teresaCopilotService.ts` (TYLKO ODCZYT — `approveProposal` l.1565, strażniki przejść l.1583-1589 i analogiczne, `getProposal` l.2099-2111; dowód, że backend NIE wymaga naprawy w tym dyżurze). **R3 (TYLKO ODCZYT — mierzysz kontrakt, nie zmieniasz backendu):** `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` (POST `/adoptions/chat-draft` l.1817-1868 z bramką flagi l.1820; GET `/command-receipts/:clientRequestId/read-back` l.4692-4730 — TO JEST TWÓJ DOWÓD ŹRÓDŁA PRAWDY, czytasz go bardzo dokładnie: `canViewAggregate` l.1312-1324, `findReceipt`/`getAggregateVersion` przez `unitOfWork.transaction`) · `server/src/domain/initiatives-execution/adoptChatDraftInitiative.ts` (CAŁY plik, TYLKO ODCZYT — `claimRelation` z `relationType:'TERESA_CHAT_DRAFT_ADOPTION'`) · `server/src/config/FeatureFlags.ts` (TYLKO ODCZYT — l.35,166, dowód że flaga jest realna, nie fantom) · `server/src/routes/pmo/initiatives.routes.ts` (TYLKO ODCZYT — l.156, dowód mount-prefixu `/runtime-v1` pod `/api/initiatives`). ŻADNEGO pliku serwerowego w tej sekcji NIE zapisujesz w tym dyżurze — cała naprawa `R3`, jeśli się zdarzy, mieści się w jednym pliku frontu`.

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
WT=/private/tmp/cx-day375-karty-domkniecie
MARKER=8f60ab998734adcdf61a080f4e1270c3dbdffceb

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day375-karty-domkniecie-20260905 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day375-karty-domkniecie/config.worktree"
cat "$VAULT/worktrees/cx-day375-karty-domkniecie/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day375-karty-domkniecie-scratch
mkdir -p /private/tmp/cx-day375-karty-domkniecie-artefakty

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
git -C "$VAULT" log --oneline 8f60ab998734adcdf61a080f4e1270c3dbdffceb..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 8f60ab998734adcdf61a080f4e1270c3dbdffceb..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day375-karty-domkniecie-20260905
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 8f60ab998734adcdf61a080f4e1270c3dbdffceb..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `jedenaście` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) ★★★ R2 RDZEN SPORU: ktory backend NAPRAWDE stoi za Api.approveTeresaProposal — zmierz SAM,
#     nie ufaj ani tej instrukcji, ani ODBIOR_371.md
bash -c "grep -n \"approveTeresaProposal\\|rejectTeresaProposal\\|executeTeresaProposal\\|undoTeresaProposal\" src/services/api.ts"
bash -c "grep -n \"router.post(\\|teresaService\\.\\|import \\* as teresaService\" server/src/routes/v8/teresa.routes.ts | head -20"
bash -c "grep -rn \"workCanvasService\" server/src/routes/v8/teresa.routes.ts || echo 'ZERO_WORKCANVAS_W_TERESA_ROUTES'"
#   moje liczby (autor, do zweryfikowania): approveTeresaProposal l.2564, rejectTeresaProposal l.2574,
#   executeTeresaProposal l.2585, undoTeresaProposal l.2595 w api.ts; teresa.routes.ts importuje
#   'teresaService' jako '../../services/v8/teresaCopilotService.js' (l.43), POST /proposal/:id/approve
#   l.211 wola teresaService.approveProposal (czyli teresaCopilotService, NIE workCanvasService);
#   grep workCanvasService w teresa.routes.ts daje ZERO trafien.

# (2) R2: TeresaProposalCard trzyma stan WYLACZNIE przez useEffect sync z propsa, zero live GET
bash -c "grep -n 'useState<TeresaChatProposal>\\|useEffect(() => {\\|setCurrentProposal(proposal)' src/components/AIChat/TeresaProposalCard.tsx"
bash -c "grep -c 'getTeresaProposal\\|fetch(' src/components/AIChat/TeresaProposalCard.tsx || echo 0"
#   moje liczby: useState l.71, useEffect l.74-76 (setCurrentProposal(proposal) w ciele); zero fetch/GET.

# (3) R2: GET /v8/teresa/proposal/:id JUZ istnieje po stronie serwera, klient go NIE ma
bash -c "grep -n \"router.get(\\|'/proposal/:id'\\|toChatProposalEnvelope\" server/src/routes/v8/teresa.routes.ts | head -6"
bash -c "grep -c 'getTeresaProposal' src/services/api.ts || echo 0"
#   moje liczby: router.get l.325, path l.326, teresaService.getProposal wolany w ciele (l.~332);
#   getTeresaProposal w api.ts: 0 wystapien (nie istnieje jeszcze).

# (4) R3: GovernedInitiativeHandoffCard startuje ZAWSZE z 'idle', zero odczytu przy montazu
bash -c "grep -n \"useState<GovernedInitiativeHandoffState>\\|const checkReadiness\\|const adopt = \" src/components/AIChat/GovernedInitiativeHandoffCard.tsx"
#   moje liczby: useState('idle') l.38, checkReadiness l.46, adopt l.80 — zaden nie jest wolany
#   automatycznie przy montazu (oba wymagaja klikniecia).

# (5) R3: producent jest REALNY i za PRAWDZIWA (nie fantomowa) flaga, zgodna po obu stronach
bash -c "grep -n \"teresaAdoptChatDraftEnabled\\|payloadKind === 'initiative'\" src/components/AIChat/UnifiedChatPanel.tsx | head -5"
bash -c "grep -n 'ENABLE_TERESA_ADOPT_CHAT_DRAFT' server/src/config/FeatureFlags.ts server/src/routes/pmo/initiativesExecutionRuntime.routes.ts"
#   moje liczby: teresaAdoptChatDraftEnabled l.815, gałąź initiative l.2321-2325 w UnifiedChatPanel.tsx;
#   FeatureFlags.ts: default(false) l.35, czytanie env l.166; routes: bramka l.1820 (!=='true' -> 404).
#   Obie strony zgodne co do nazwy flagi i wartosci domyslnej.

# (6) R3: kwit komendy z deterministycznym clientRequestId — dowod materializacji + istniejacy odczyt
bash -c "grep -n 'clientRequestId\\|chat-draft-adopt' src/components/AIChat/GovernedInitiativeHandoffCard.tsx"
bash -c "grep -n \"'/command-receipts/:clientRequestId/read-back'\\|readBackState\\|CONFIRMED\" server/src/routes/pmo/initiativesExecutionRuntime.routes.ts"
#   moje liczby: clientRequestId zbudowany w adopt() jako `chat-draft-adopt:${initiativeId}`;
#   GET /command-receipts/:clientRequestId/read-back l.4692-4693, readBackState CONFIRMED/PENDING
#   zdefiniowane w ciele handlera (ok. l.4716-4719).

# (7) R3: mount-prefix runtime-v1 pod /api/initiatives — sciezka pelna zgadza sie miedzy adopt() a read-back
bash -c "grep -n \"runtime-v1\" server/src/routes/pmo/initiatives.routes.ts"
#   moje liczby: router.use('/runtime-v1', initiativesExecutionRuntimeRouter) l.156.

# (8) Stan istniejacego testu rodziny (z dyzuru 371) — ktory przypadek jest dzis RED
node -e "console.log('uruchom (9) zamiast recznie liczyc — to jest tylko orientacyjny grep')" 2>/dev/null
bash -c "grep -n \"it('\" src/components/AIChat/__tests__/day371.proposalFamily.remount.test.tsx"
#   moje liczby: 6 przypadkow (l.101,117,127,147,165,178); wedle raportu 371 przypadek z l.178
#   (GovernedInitiativeHandoffCard) jest dzis RED, pozostale 5 GREEN — ZWERYFIKUJ SAM uruchomieniem (9).

# (9) uruchom cala rodzine BEZ zmian, zapisz stan WEJSCIOWY (przed Twoja praca) jako artefakt
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/components/AIChat/__tests__/day371.proposalFamily.remount.test.tsx --pool=threads --retry=0 --reporter=json --outputFile="$ARTEFAKTY/przed-rodzina.json"
python3 -c "import json;d=json.load(open('$ARTEFAKTY/przed-rodzina.json'));print('numPassedTests',d.get('numPassedTests'),'numFailedTests',d.get('numFailedTests'))"
#   oczekiwane: numPassedTests 5, numFailedTests 1 (zgodnie z raportem 371) — jesli inaczej, to jest
#   TWOJ wynik, nadpisuje moj, zapisz go w raporcie wprost.

# (10) Warunki wspolne serii: liscie slownikow + 4 bezpieczniki
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   moje liczby (zmierzone 2026-09-05 przy PISANIU tej instrukcji, na WSPOLNEJ galezi m03,
#   PO scaleniu 367-373): pl 35294, en 33154. focus=0, list=0, artefakt=0. reach=1 — TA GALAZ dalej
#   ma czerwona bramke reachability z powodu plikow test-only rownoleglych dyzurow (367-373 i
#   ewentualnie 374/376/377 rownolegle 05.09) — NIE Twoja regresja, NIE naprawiasz jej w tym dyzurze,
#   ale mierzysz WLASNA liste PRZED i PO, PO NAZWACH (Z37), Twoje nowe pliki testowe doloza sie do
#   listy (oczekiwane), zero plikow ma zniknac z listy sprzed Twojej pracy.

# (11) zasoby: dysk, porty, kontener, litera rejestru znaleziska TUZ PRZED COMMITEM
df -h /
lsof -nP -iTCP:6446 -sTCP:LISTEN; lsof -nP -iTCP:5586 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day375 || true
bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"
#   oczekiwane przy wydaniu: >5 GB wolnego (zmierzone 34Gi); oba porty puste; 0 kontenerow;
#   ostatnia litera na markerze: AM (dyzur 373) — SPRAWDZ SAM tuz przed commitem, pisza rownolegle inni.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day375-karty-domkniecie-20260905` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6446`. Twój JEDYNY port harnessu to `5586`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day375-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3000, 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki (`AUDYT_CZAT_PRZYCISKI_20260905`, dyżury 367-373, WSZYSTKIE JUŻ SCALONE do `m03`, nie dotykasz ponownie): 367 (6438/5578), 368 (6439/5579), 369 (6440/5580), 370 (6441/5581), 371 (6442/5582), 372 (6443/5583), 373 (6444/5584). Bezpośrednie rodzeństwo dnia 05.09 tej rundy domykającej — NIE dotykasz: 374 (6445/5585), 376 (6447/5587), 377 (6448/5588). Twoje własne wyłącznie: baza **6446**, harness **5586** (zweryfikowane wolne przy pisaniu tej instrukcji, `lsof` — zero LISTEN na obu). ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `**BRAK NOWYCH FLAG w całym tym dyżurze.** Wszystkie trzy pozycje to naprawa POTWIERDZONEGO defektu albo dowód dla już zaakceptowanej naprawy — reguła CLAUDE.md 'NIE dla naprawy defektu potwierdzonego' ma zastosowanie wprost do R1 i R2. `R3` dotyka kodu, który JUŻ jest za istniejącą flagą `ENABLE_TERESA_ADOPT_CHAT_DRAFT` (default `false`, ustawioną w 08/09.2026, poza tym dyżurem) — naprawa poprawia CO SIĘ DZIEJE, gdy ta flaga jest ON, nie WŁĄCZA jej i nie dodaje nowej. Jeżeli w trakcie pomiaru `R3` okaże się, że proponowana naprawa wymagałaby pokazania czegoś NOWEGO, czego dziś nie ma nawet za tą flagą — to jest sygnał, że wykroczyłeś poza naprawę defektu, i pozycja ma się zakończyć STOP-em z pytaniem, nie nową flagą dopisaną na własną rękę`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs`, `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts`, `server/src/middleware/appErrorMapper.ts`, `server/src/services/tablePlatform/PermissionsService.ts`, `public/locales/**`. Wszystkie **NIETYKALNE DO ZAPISU** — wolno je wołać/czytać w pomiarze`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY375_KARTY_DOMKNIECIE_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — na markerze ostatnia użyta sekcja to **`AM`** (`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`), więc następna PRAWDOPODOBNIE to `AN` — **ale równolegle piszą inni autorzy (dyżury 374, 376, 377 tej samej rundy domykającej), więc sprawdzasz literę KOMENDĄ TUŻ PRZED COMMITEM, nie ufasz tej liczbie** — oraz nowy katalog dowodowy `evidence/day375-karty-domkniecie/` (NIE ISTNIEJE na markerze — tworzysz go). ★★★ **MACIERZ ODBIORU JEST NIETYKALNA W TYM DYŻURZE** — żaden wiersz `G00`-`G20`, żaden moduł, w tym `13_CHAT`; bramkami i macierzą zajmują się inne dyżury. Plik postępu `/private/tmp/cx-day375-postep.md` żyje POZA repo. Nowe pliki w `tests/` i w `__tests__/` wymagają `git add -f`. Edycja `day371.proposalFamily.remount.test.tsx` jest jedynym dozwolonym dotknięciem CUDZEGO pliku testowego — uzasadnionym tym, że Twoja naprawa realnie zmienia zachowanie, które ten test sprawdza; zapisz w raporcie DOKŁADNIE co i dlaczego zmieniłeś w tym pliku. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day375-karty-domkniecie-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day375-karty-domkniecie-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | Produkcja NIETYKALNA; demo i staging są jedną bazą. **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur** |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it`, jeśli plik je ustawia | **Historycznie** `vitest.config.ts` ustawiał `retry: CI ? 3 : 1` i to unieważniało całą rodzinę testów izolacji: przy otwartej dziurze pierwszy przebieg realnie zmieniał stan, asercja padała, Vitest ponawiał — i test **raportował `PASS` mimo otwartej dziury** (dowód: `tests/integration/_retrymask/`, archetyp dyżuru 42). **Stan na 04.09: `vitest.config.ts:339` ustawia `retry: 0`, a `server/vitest.config.ts` nie ustawia `retry` wcale.** Zakaz zostaje w mocy — dotyczy `--retry=N` w CLI i `retry` w opcjach `describe`/`it` — ale **nie szukaj tu przyczyny niestabilności**: ponowień w konfiguracji już nie ma |
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
| `Z40` | ★★★ **ZAKAZ WIERZENIA CUDZEJ HIPOTEZIE BEZ WŁASNEGO GREPA.** Poprzedni odbiór (`ODBIOR_371.md`) twierdzi, że `TeresaProposalCard` idzie przez `workCanvasService`/`work_canvas_proposals` — TA INSTRUKCJA twierdzi coś przeciwnego (`teresaCopilotService`/`teresa_proposals`, `server/src/routes/v8/teresa.routes.ts`) na podstawie świeżego odczytu. OBIE wersje mogą być nieaktualne względem TWOJEGO markera — pierwsza komenda `§0.3` (1) każe Ci to zmierzyć SAMEMU, grepem, zanim napiszesz choć jedną linię naprawy `R2`. Jeśli Twój wynik pokaże trzecią możliwość — napraw wedle TEGO, co faktycznie zobaczysz, nie wedle żadnej z dwóch hipotez w dokumentach. ★★★ **ZAKAZ ASERCJI NA TEKŚCIE ŹRÓDŁA.** Każdy nowy/przepisany test wywołuje/renderuje i sprawdza wynik (DOM, kod HTTP, wiersz w bazie), nigdy `readFileSync`+`toContain` na źródle. ★★★ **ZAKAZ TESTU, KTÓRY DOWODZI TYLKO ZMIANY PROPSA MIĘDZY DWOMA MOUNTAMI.** Dowód na `R2` MUSI (re)montować `TeresaProposalCard` z TYM SAMYM, przestarzałym propem `proposal` (np. `state:'pending_approval'`) w obu mountach, przy zamockowanym `getTeresaProposal` zwracającym INNY, świeższy stan (np. `'completed'`) — to jest jedyny kształt, który odpowiada realnemu F5. Test, który podaje dwa różne propsy (jak istniejący `day371...:117-124`), NIE jest dowodem na tę naprawę, tylko na coś innego (poprawną reakcję na zmianę propsa) — nie podmieniaj jednego dowodu drugim, potrzebujesz OBU: starego (zostaje) i nowego (dopisujesz). ★★★ **ZAKAZ NAPRAWY `R3` POZA JEDNYM PLIKIEM FRONTU.** Jeśli pomiar pokaże, że naprawa `GovernedInitiativeHandoffCard` wymaga choćby jednej linii w pliku spoza `src/components/AIChat/GovernedInitiativeHandoffCard.tsx` (poza wąską licencją na nowy test) — to jest automatycznie poza licencją tego dyżuru i kończy się STOP-em, nie próbą 'małej' zmiany gdzie indziej. ★★★ **ZAKAZ DOTYKANIA `CaseIntakeConfirmCard.tsx`/`MessageRenderer.tsx` w sprawie Case Intake.** Decyzja nadzorcy jest już podjęta i zamknięta — karta zostaje jak na markerze; nie wracasz do tematu, nie dopisujesz nowego pytania o nią ponad to, co ewentualnie już istnieje w rejestrze. ★★ **ZAKAZ ZOSTAWIENIA `day371.proposalFamily.remount.test.tsx` W STANIE 1 RED PO TYM DYŻURZE bez wyjaśnienia.** Jeżeli `R3` zakończy się STOP-em (naprawa niemożliwa w licencji), test dla `GovernedInitiativeHandoffCard` w tym pliku MA PRAWO zostać czerwony — ale wtedy dopisujesz w tym samym pliku komentarz nad `it(...)` tłumaczący DLACZEGO (odsyłacz do raportu), zamiast milczeć. ★ **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`, zmiany oczekiwanego kodu odpowiedzi w cudzej asercji** (`Z35`). **ZAKAZ porównania po liczbach zamiast po nazwach** (`Z37`) — dotyczy zwłaszcza `reach` i pełnej listy nazw testów w pliku rodzinnym | Bo odbiór adwersaryjny 371 znalazł DWA realne zastrzeżenia i JEDNO pytanie proceduralne, i żadne z nich nie jest kosmetyczne. R1 bez artefaktu PASS oznacza, że jedyny dowód naprawy 500→409 to zdanie w raporcie — dokładnie ten kształt fałszywego 'gotowe', przed którym ostrzega metodyka tego repo. R2, jeśli się potwierdzi, to DOKŁADNIE ten sam defekt, który właśnie naprawiliśmy w `ChatTableProposalCard`, tylko w INNYM komponencie tej samej rodziny — a rodzina istnieje po to, żeby taki defekt złapać RAZ, nie odkrywać go component-po-component przez kolejne tygodnie. R3 to test na to, czy umiemy odróżnić 'jest bug' od 'jest martwe' od 'jest bug, ale bez taniej naprawy' — trzy różne odpowiedzi na trzy różne przyciski, które z zewnątrz wyglądają identycznie (klik nic nie zmienia po odświeżeniu) |

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
cd /private/tmp/cx-day375-karty-domkniecie

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day375-pg psql -U postgres -d cx375 \
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
cd /private/tmp/cx-day375-karty-domkniecie

docker run -d --name cx-day375-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx375 \
  -p 127.0.0.1:6446:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day375-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6446/cx375 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6446/cx375 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day375-karty-domkniecie && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6446/cx375 \
JWT_SECRET=cx375-test-secret-do-not-reuse-min-32-znaki \
npx vitest run **R1** — testy serwerowe (pg, real Postgres) z cwd `server/`, `--config server/vitest.config.ts`. Plik: `server/src/routes/__tests__/day371.chatToSchema.executeConflict.pg.test.ts` (ISTNIEJĄCY, uruchamiasz jak jest). `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6446/cx375 JWT_SECRET=cx375-test-secret-do-not-reuse-min-32-znaki`, `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day375-karty-domkniecie-artefakty/<etykieta>.json`. **Kontrola obowiązkowa PRZED wpisaniem GREEN do raportu:** otwórz zapisany JSON i sprawdź polem, nie tylko kodem wyjścia procesu — `numPassedTests` musi być `1` i `status`/`state` testu musi być `'passed'`, NIE `'skipped'`. Jeżeli proces zwróci kod 0, ale JSON pokaże `skipped` — to NIE JEST PASS, to jest dokładnie ta sama pułapka, którą złapał odbiór 371; napraw przyczynę (typowo: zbyt krótki timeout inicjalizacji `ApiGateway`, zwiększ w `beforeAll(..., 60_000)` albo wyżej, zanim ogłosisz cokolwiek). **R2** — testy jednostkowe frontu (RTL) z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, plik `src/components/AIChat/__tests__/day371.proposalFamily.remount.test.tsx` (edytujesz istniejący, zgodnie z licencją) — wzorzec mocków jak już w tym pliku (`vi.mock('react-i18next', ...)`, `vi.mock('@/services/api', ...)`). **R3** — testy jednostkowe frontu (RTL) z roota, w TYM SAMYM pliku `day371.proposalFamily.remount.test.tsx`, mock globalnego `fetch` (`vi.stubGlobal('fetch', vi.fn())` albo lokalny `global.fetch = vi.fn()...` — sprawdź, czy plik już ma wzorzec mockowania `fetch` gdzie indziej w repo dla podobnych kart, np. `GovernedInitiativeHandoffCard.test.tsx` jeśli istnieje gdzie indziej w repo — jeśli nie istnieje, zbuduj wg wzorca Testing Library + `vi.fn()` na `global.fetch`, z osobnymi `mockResolvedValueOnce` per wywołanie w kolejności `checkReadiness → adopt → read-back`. Uruchomienie testu PG z roota bez właściwego configu dla pliku serwerowego daje `No test files found` — to BŁĄD KOMENDY, nie PASS --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day375-karty-domkniecie-artefakty/day375-karty-domkniecie.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day375-karty-domkniecie && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run **R1** — testy serwerowe (pg, real Postgres) z cwd `server/`, `--config server/vitest.config.ts`. Plik: `server/src/routes/__tests__/day371.chatToSchema.executeConflict.pg.test.ts` (ISTNIEJĄCY, uruchamiasz jak jest). `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6446/cx375 JWT_SECRET=cx375-test-secret-do-not-reuse-min-32-znaki`, `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day375-karty-domkniecie-artefakty/<etykieta>.json`. **Kontrola obowiązkowa PRZED wpisaniem GREEN do raportu:** otwórz zapisany JSON i sprawdź polem, nie tylko kodem wyjścia procesu — `numPassedTests` musi być `1` i `status`/`state` testu musi być `'passed'`, NIE `'skipped'`. Jeżeli proces zwróci kod 0, ale JSON pokaże `skipped` — to NIE JEST PASS, to jest dokładnie ta sama pułapka, którą złapał odbiór 371; napraw przyczynę (typowo: zbyt krótki timeout inicjalizacji `ApiGateway`, zwiększ w `beforeAll(..., 60_000)` albo wyżej, zanim ogłosisz cokolwiek). **R2** — testy jednostkowe frontu (RTL) z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, plik `src/components/AIChat/__tests__/day371.proposalFamily.remount.test.tsx` (edytujesz istniejący, zgodnie z licencją) — wzorzec mocków jak już w tym pliku (`vi.mock('react-i18next', ...)`, `vi.mock('@/services/api', ...)`). **R3** — testy jednostkowe frontu (RTL) z roota, w TYM SAMYM pliku `day371.proposalFamily.remount.test.tsx`, mock globalnego `fetch` (`vi.stubGlobal('fetch', vi.fn())` albo lokalny `global.fetch = vi.fn()...` — sprawdź, czy plik już ma wzorzec mockowania `fetch` gdzie indziej w repo dla podobnych kart, np. `GovernedInitiativeHandoffCard.test.tsx` jeśli istnieje gdzie indziej w repo — jeśli nie istnieje, zbuduj wg wzorca Testing Library + `vi.fn()` na `global.fetch`, z osobnymi `mockResolvedValueOnce` per wywołanie w kolejności `checkReadiness → adopt → read-back`. Uruchomienie testu PG z roota bez właściwego configu dla pliku serwerowego daje `No test files found` — to BŁĄD KOMENDY, nie PASS --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day375-karty-domkniecie-artefakty/day375-karty-domkniecie.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day375-karty-domkniecie/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day375-pg psql -U postgres -d cx375 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day375-pg`.
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
> **(e) **CZTERY PUŁAPKI WŁAŚCIWE TEMU DYŻUROWI.** (1) **Dwie sprzeczne hipotezy o backendzie Teresy w dokumentach — żadnej nie wolno Ci uwierzyć bez własnego grepa** (patrz `ZAKAZ_WLASCIWY_TEMU_DYZUROWI`, pierwszy punkt) — to nie jest błąd tej instrukcji do zignorowania, to jest dokładnie sytuacja, w której 'hipoteza nadzorcy staje się faktem', jeśli przepiszesz cudze zdanie zamiast zmierzyć. (2) **`vi.fn()` bez `.mockResolvedValue` zwraca `undefined`, nie Promise** — jeśli dopiszesz w `TeresaProposalCard` wywołanie `Api.getTeresaProposal(id).then(...)` bez opakowania w bezpieczny wzorzec (patrz `ChatTableProposalCard.tsx:60-76` — `.catch()` na końcu łańcucha, `active` flaga), ISTNIEJĄCY test rodziny (`day371...:117-124`), który nie mockuje tej nowej funkcji, wybuchnie `TypeError: Cannot read properties of undefined (reading 'then')` zamiast zwyczajnie failować asercją — musisz DOPISAĆ mock `getTeresaProposal: vi.fn()` do wspólnego `vi.mock('@/services/api', ...)` w tym pliku RÓWNOCZEŚNIE z dopisaniem wywołania w komponencie, w tym samym commicie. (3) **`clientRequestId` w read-back musi być URL-encoded identycznie jak w `adopt()`** — front buduje go jako string `chat-draft-adopt:${initiativeId}` zawierający dwukropek; upewnij się, że `encodeURIComponent` w nowym odczycie koduje TĘ SAMĄ wartość co POST w `adopt()`, inaczej read-back nigdy nie znajdzie kwitu mimo że komenda faktycznie przeszła (fałszywy 404 zamiast `CONFIRMED`) — zweryfikuj to osobnym test-case'em, nie zakładaj zgodności. (4) **`canViewAggregate` w read-back wymaga `initiative.view` na projekcie inicjatywy** (`initiativesExecutionRuntime.routes.ts:1312-1324`, `resolveProjectIdsForAggregate`) — jeśli aktor testowy/produkcyjny nie ma tej autoryzacji dla danego `projectId`, read-back zwróci `404` NIEZALEŻNIE od tego, czy komenda się zmaterializowała — to wygląda IDENTYCZNIE jak 'nigdy nie zaadoptowane' i może dać fałszywy STOP albo fałszywy 'naprawione, działa' na słabej fiksturze testowej. Zmierz to jawnie (dwa scenariusze: autoryzowany aktor po adopcji → `CONFIRMED`; NIEautoryzowany aktor po tej samej adopcji → `404`, i to jest OCZEKIWANE, nie błąd) zamiast wnioskować z jednego przebiegu**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day375-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day375-karty-domkniecie-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: zero wiary w cudza hipoteze bez wlasnego grepa, test broni zachowania z realnym remontem symulujacym F5 z TYM SAMYM propem, mutacja celuje we wlasciwa linie, mianownik testow spojny, para dowodow przed/po dla kazdej zmiany zachowania) · R1 (dowod: uruchom istniejacy pg-test 409 na WLASNYM kontenerze, artefakt PASS z polem numPassedTests=1 nie samym kodem wyjscia, mutacja odwrotna do 500 -> RED, przywrocenie -> GREEN, git diff po cofnieciu pusty — BEZ ZMIANY KODU PRODUKTU) · R2 (RDZEN: zmierz realny backend Teresy grepem, zamontuj TeresaProposalCard z zamrozonym propem i zamockowanym swiezym stanem — dowod RED na dzisiejszym kodzie — dopisz getTeresaProposal + wywolanie na moncie tym samym wzorcem co ChatTableProposalCard, dowod GREEN + mutacyjny w obie strony, aktualizacja wspolnego mocka w tescie rodziny) · R3 (pomiar zywego kontraktu GovernedInitiativeHandoffCard — producent, flaga, backend, kwit komendy z deterministycznym clientRequestId, istniejacy odczyt read-back — jawny werdykt NAPRAW/STOP z dowodem; jesli NAPRAW: wywolanie read-back na moncie WYLACZNIE w tym jednym pliku frontu, przepisanie istniejacego testu-widma z fikcyjnym propsem na dowod zgodny z realnym mechanizmem) · R4 (raport, rejestr znaleziska, sekcja PYTANIA DO WLASCICIELA obowiazkowo niepusta, potwierdzenie ze CaseIntake pozostal nietkniety)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6446` albo `5586` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6446` albo `5586`** (`Z7`).

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

Odbiór adwersaryjny dyżuru 371 (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/
CODEX_DAY371_KARTY_PROPOZYCJI_REPORT.md`, werdykt „SCALIĆ Z ZASTRZEŻENIEM") zostawił trzy
otwarte sprawy na tym samym ekranie (`/chat`, rodzina kart propozycji w
`src/components/AIChat/`). Ten dyżur je zamyka, jedną po drugiej, w kolejności rosnącego
ryzyka.

**R1 — dowód, nie kod (niskie ryzyko, ale musi paść).** Naprawa 500→409 z dyżuru 371 jest
w kodzie i jest logicznie poprawna (`ChatToSchemaService.ts:483-486`,
`table-platform.routes.ts:1816`). Test istnieje
(`server/src/routes/__tests__/day371.chatToSchema.executeConflict.pg.test.ts`) i jest
dobrze skonstruowany. Ale odbiór adwersaryjny sprawdził wszystkie trzy zapisane artefakty
JSON z tamtej pracy — każdy pokazuje `numPassedTests:0, numFailedTests:0, status:'skipped'`.
Kontener z tamtej pracy już nie istnieje. „GREEN" dla tej naprawy istnieje dziś wyłącznie
jako zdanie w raporcie, nie jako artefakt. Zadanie: odtworzyć dowód na własnym, świeżym
Postgresie, z zapisanym JSON-em, który FAKTYCZNIE pokazuje przejście testu, plus dowód
mutacyjny w obie strony.

**R2 — rdzeń tego dyżuru. `TeresaProposalCard` ma najprawdopodobniej dokładnie ten sam
kształt defektu co `ChatTableProposalCard` przed naprawą w 371 (K9/D-3), tylko nie został
wykryty metodą testu z 371.** `TeresaProposalCard.tsx:71` inicjalizuje
`currentProposal` z propsa `proposal` i synchronizuje go WYŁĄCZNIE przez
`useEffect(() => setCurrentProposal(proposal), [proposal])` (l.74-76) — źródłem prawdy po
(re)moncie jest wyłącznie ten props. Props `proposal` pochodzi z `msg.metadata.proposal`,
czyli z `conversation_messages.metadata` — pola, które (ustalone już w 371,
`chatHandoffService.ts:45`) jest PERSYSTOWANE PRZEZ KLIENTA i serwer go nigdy nie
odświeża. Po F5 ten props niesie dokładnie to, co było w momencie utworzenia wiadomości,
niezależnie od tego, co się stało później z propozycją po stronie serwera.

Test rodziny z 371 (`src/components/AIChat/__tests__/day371.proposalFamily.remount.test.tsx:117-124`)
oznaczył tę kartę jako „już poprawna" — ale zrobił to metodą, która dowodzi czegoś innego:
(re)montuje komponent DWA RAZY z DWOMA RÓŻNYMI propsami (`teresaProposal('proposal')`, potem
`teresaProposal('completed')`). To dowodzi, że komponent poprawnie reaguje na ZMIANĘ propsa
między mountami — nie że po prawdziwym F5, gdzie props jest TEN SAM zamrożony obiekt w obu
mountach, komponent pokaże żywy stan. To dokładnie ten sam błąd metodologiczny, jaki odbiór
371 nazwał „Zastrzeżeniem 1".

Dobra wiadomość: backend Teresy NIE wymaga naprawy. Zweryfikuj to jednak SAM, pierwszą
komendą tej instrukcji — poprzedni odbiór (`ODBIOR_371.md`, cytowany w briefie tego dyżuru)
twierdzi, że karta idzie przez `workCanvasService`/`work_canvas_proposals`; świeży odczyt
przy pisaniu TEJ instrukcji pokazuje coś innego: `Api.approveTeresaProposal` (i
reject/execute/undo, `src/services/api.ts:2564-2604`) wołają
`POST /api/v8/teresa/proposal/:id/{approve,reject,execute,undo}`
(`server/src/routes/v8/teresa.routes.ts:211,238,266,294`), które importują
`teresaService` jako `../../services/v8/teresaCopilotService.js` (l.43) — NIE
`workCanvasService` (ten jest wpięty wyłącznie w zupełnie inny plik routingu,
`work-canvas.routes.ts`, którego `teresa.routes.ts` w ogóle nie importuje).
`teresaCopilotService` operuje na tabeli `teresa_proposals` z jawnymi, typowanymi
strażnikami przejść stanu (`TeresaCopilotError('...', 'P08_INVALID_STATE_TRANSITION')`,
l.1583-1589 w `approveProposal` i analogiczne w reject/execute/undo) — to NIE jest ślepy
plain-Error-500 jak K9 przed naprawą; typowany błąd już tam jest, backend nie jest w
zakresie tego dyżuru. **Ty mierzysz to SAM, komendą (1) z `§0.3` — jeśli Twój wynik przeczy
którejkolwiek z dwóch wersji (mojej albo poprzedniego odbioru), naprawiasz wedle tego, co
SAM zobaczysz.**

Naprawa frontowa jest tania, bo serwer już ma dokładny analog tego, co naprawiło K9:
`GET /v8/teresa/proposal/:id` (`teresa.routes.ts:325-333`, woła `teresaService.getProposal`
+ `toChatProposalEnvelope`) już istnieje i już jest zamontowany. Klient go po prostu nie ma
(`src/services/api.ts` ma approve/reject/execute/undo, zero `getTeresaProposal`). Dopisz tę
jedną funkcję i wywołaj ją przy (re)moncie `TeresaProposalCard`, dokładnie wzorcem, jaki już
istnieje w `ChatTableProposalCard.tsx:60-76` — aktywny `useEffect` z flagą `active`
(unikanie wycieku po odmontowaniu), `.catch()` łykający błąd sieci bez wywalenia komponentu,
lokalny stan jako WYŁĄCZNIE optymistyczna nakładka na własną akcję w tej samej sesji.

**R3 — pomiar + orzeczenie + naprawa jeśli w licencji. `GovernedInitiativeHandoffCard` ma
prawdziwego, żywego producenta i żywy, zamontowany backend — to NIE jest martwy kod jak
`CaseIntakeConfirmCard` z 371.** Karta startuje zawsze z `useState('idle')`
(`GovernedInitiativeHandoffCard.tsx:38`), niezależnie od tego, czy dana inicjatywa była już
zaadoptowana wcześniej (np. w poprzedniej sesji, przed F5). Producent jest realny:
`UnifiedChatPanel.tsx:2321-2346` (gałąź `payloadKind === 'initiative'`), za flagą
`teresaAdoptChatDraftEnabled = isEnabled('ENABLE_TERESA_ADOPT_CHAT_DRAFT')`
(`UnifiedChatPanel.tsx:815`). Ta flaga NIE jest fantomem — ma realną implementację po obu
stronach: `server/src/config/FeatureFlags.ts:35,166` (`z.boolean().default(false)`, czytana
z `process.env.ENABLE_TERESA_ADOPT_CHAT_DRAFT`) i backend
(`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:1820`, ta sama zmienna, ten
sam default `false`, ta sama semantyka `!== 'true'` → 404). Backend
`POST .../runtime-v1/adoptions/chat-draft` (l.1817-1868, zamontowany pod
`/api/initiatives/runtime-v1`, `initiatives.routes.ts:156`) woła `adoptChatDraftInitiative`
(`server/src/domain/initiatives-execution/adoptChatDraftInitiative.ts`), która materializuje
prawdziwy wiersz agregatu `initiative` przez `MaterialCommandUnitOfWork`, z deterministycznym
`clientRequestId` zbudowanym przez front jako `chat-draft-adopt:${initiativeId}`
(w `adopt()` tego samego pliku karty).

Ten deterministyczny `clientRequestId` jest kluczem do taniej naprawy: w TYM SAMYM pliku
routingu istnieje już generyczny, gotowy odczyt kwitu komendy —
`GET /command-receipts/:clientRequestId/read-back`
(`initiativesExecutionRuntime.routes.ts:4692-4730`) — który zwraca
`readBackState: 'CONFIRMED'`, gdy komenda o danym `clientRequestId` już się
zmaterializowała (porównuje `currentVersion` agregatu z `receipt.aggregateVersion`), albo
`404`, gdy nigdy nie została wysłana. To NIE jest nowy endpoint do zbudowania w tym
dyżurze — jest już zamontowany i generycznie używany przez inne polecenia w tym samym
pliku (widoczne w liście `router.get(...)` obok). Jeśli pomiar to potwierdzi: karta przy
(re)moncie odpytuje ten sam endpoint (surowym `fetch` z `credentials:'include'`, dokładnie
tym wzorcem, jakiego karta już używa w `checkReadiness`/`adopt`) i, gdy dostanie
`CONFIRMED`, startuje od razu w stanie `adopted` zamiast `idle`. Zero nowej flagi — to jest
naprawa defektu wewnątrz JUŻ ISTNIEJĄCEJ, wyłączonej domyślnie funkcji, nie nowy ekran.

**Case Intake NIE jest częścią tego dyżuru.** Decyzja nadzorcy jest już podjęta:
`CaseIntakeConfirmCard` zostaje dokładnie taka, jak jest na markerze (zastany dług z 371),
a pytanie o samą funkcję „Teresa rozpoznaje nową sprawę z treści rozmowy" idzie do
właściciela poza tym pakietem. Zero zmian w `CaseIntakeConfirmCard.tsx` i
`MessageRenderer.tsx` w tej sprawie.

## ★ Stan zastany, zmierzony przeze mnie na markerze `8f60ab998734adcdf61a080f4e1270c3dbdffceb`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| K9/D-3 (371): naprawa 500→409 | w kodzie, ZWERYFIKOWANA ŹRÓDŁOWO | `ChatToSchemaService.ts:483-486`, `table-platform.routes.ts:1816` |
| K9/D-3 (371): dowód GREEN niezależnie odtwarzalny | NIE — 3/3 zapisane JSON-y `status:'skipped'` | opis w `CODEX_DAY371_..._REPORT.md`, ODBIOR_371.md Zastrzeżenie 2 |
| `TeresaProposalCard`: źródło stanu po (re)moncie | wyłącznie `useEffect` sync z propsa | `TeresaProposalCard.tsx:71,74-76` |
| `TeresaProposalCard`: żywy odczyt (GET) przy moncie | **0** (brak) | cały plik |
| Backend Teresy (approve/reject/execute/undo) | `teresaCopilotService` (import `teresaService`), NIE `workCanvasService` | `teresa.routes.ts:43,211,238,266,294` |
| Backend Teresy: typowane błędy przejść stanu | już istnieją (`TeresaCopilotError`, kod `P08_INVALID_STATE_TRANSITION`) | `teresaCopilotService.ts:1583-1589` i analogiczne |
| GET pojedynczej propozycji Teresy, już zamontowany | `router.get('/proposal/:id', ...)` l.325, woła `getProposal`+`toChatProposalEnvelope` | `teresa.routes.ts:325-333` |
| Klient: wrapper na ten GET | **0** (nie istnieje) | `src/services/api.ts` (ma tylko approve/reject/execute/undo, l.2564-2604) |
| `GovernedInitiativeHandoffCard`: stan startowy | zawsze `useState('idle')`, zero odczytu przy moncie | `GovernedInitiativeHandoffCard.tsx:38` |
| Producent karty inicjatywy | realny, za flagą | `UnifiedChatPanel.tsx:815` (flaga), `:2321-2346` (gałąź) |
| Flaga `ENABLE_TERESA_ADOPT_CHAT_DRAFT` | realna, NIE fantom — obie strony zgodne, default `false` | `FeatureFlags.ts:35,166`, `initiativesExecutionRuntime.routes.ts:1820` |
| Backend adopcji, materializacja realnego agregatu | `adoptChatDraftInitiative` przez `MaterialCommandUnitOfWork` | `adoptChatDraftInitiative.ts` (cały plik) |
| Deterministyczny `clientRequestId` adopcji | `chat-draft-adopt:${initiativeId}` | `GovernedInitiativeHandoffCard.tsx` w `adopt()` |
| Istniejący, zamontowany odczyt kwitu komendy po `clientRequestId` | `GET /command-receipts/:clientRequestId/read-back`, `readBackState: CONFIRMED\|PENDING` | `initiativesExecutionRuntime.routes.ts:4692-4730` |
| Mount-prefix runtime | `/runtime-v1` pod `/api/initiatives` | `initiatives.routes.ts:156` |
| Test rodziny (371): stan dziś | 5 GREEN, 1 RED (`GovernedInitiativeHandoffCard`, dowód na fikcyjnym propsie `state`) | `day371.proposalFamily.remount.test.tsx:101-191` |

**★★ Bramka `reachability-from-root.mjs --check-baseline` jest CZERWONA (exit 1) już na
markerze, PRZED Twoją jakąkolwiek zmianą** — z powodu plików testowych innych, równoległych
dyżurów tej rundy (367-373 scalone, oraz ewentualnie 374/376/377 pracujące równolegle
05.09). **To NIE jest Twoja regresja i NIE naprawiasz tej bramki** — mierzysz własną listę
PRZED i PO, po nazwach (`Z37`), nie po samej liczbie.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: `useState`/`useEffect` w `TeresaProposalCard.tsx` w liniach
**71/74-76**; zero `getTeresaProposal` w `api.ts` i zero żywego odczytu w
`TeresaProposalCard.tsx`; `useState('idle')` w `GovernedInitiativeHandoffCard.tsx` w linii
**38**; flaga `ENABLE_TERESA_ADOPT_CHAT_DRAFT` zdefiniowana w `FeatureFlags.ts:35,166` i
`initiativesExecutionRuntime.routes.ts:1820`; odczyt kwitu komendy w
`initiativesExecutionRuntime.routes.ts:4692-4730`; test rodziny ma dziś **5 GREEN, 1 RED**;
liście słowników **pl 35294**, **en 33154**; trzy bezpieczniki kanonu kończą się kodem
**0**; `reach` kończy się kodem **1** JUŻ NA MARKERZE (nie Twoja sprawa, patrz wyżej).

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.** Backend Teresy w szczególności: dwa dokumenty (ta instrukcja i
`ODBIOR_371.md`) twierdzą co innego — Ty rozstrzygasz grepem, nie wyborem, któremu
dokumentowi wierzysz.

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest **ZROBIONA,
nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Front, R2 rdzeń** | `src/components/AIChat/TeresaProposalCard.tsx` | **★ PEŁNA LICENCJA** w zakresie `R2` | — |
| **Klient API, R2** | `src/services/api.ts` | **★ WĄSKA LICENCJA:** wyłącznie dopisanie NOWEJ funkcji `getTeresaProposal` obok istniejących proposal-akcji (l.2564-2604). Zakaz zmiany istniejących funkcji — plik ma tysiące linii i dziesiątki innych endpointów | Brief z `plik:linia` |
| **Front, R3 rdzeń** | `src/components/AIChat/GovernedInitiativeHandoffCard.tsx` | **★ PEŁNA LICENCJA** w zakresie `R3` | — |
| **Wspólny test rodziny (371), R2+R3** | `src/components/AIChat/__tests__/day371.proposalFamily.remount.test.tsx` | **★ WĄSKA LICENCJA:** (a) dopisanie `getTeresaProposal: vi.fn()` do istniejącego `vi.mock('@/services/api', ...)`; (b) korekta istniejącego przypadku Teresy (l.117-124) jeśli nowy mount tego wymaga; (c) przepisanie przypadku `GovernedInitiativeHandoffCard` (l.178-191) z fikcyjnego propsa `state` na mock realnego `fetch` read-back, TYLKO jeśli `R3`=NAPRAW. Zakaz zmiany pozostałych czterech przypadków (ChatTableProposalCard×2, ExecutionProposalMessage, GovernedChatHandoffCard) | Diff wąski, opisany w raporcie |
| **Serwer, R1 — TYLKO ODCZYT** | `server/src/services/tablePlatform/ChatToSchemaService.ts`, `server/src/routes/table-platform.routes.ts` | **TYLKO ODCZYT** — naprawa gotowa, zadaniem jest dowód, nie kod. Wolno TYMCZASOWO cofnąć przez `cp` do mutacji i przywrócić (`R0`/`R1`), ale trwały stan repo zostaje niezmieniony | — |
| **Istniejący pg-test, R1** | `server/src/routes/__tests__/day371.chatToSchema.executeConflict.pg.test.ts` | **URUCHAMIASZ jak jest.** Poprawka treści testu dozwolona WYŁĄCZNIE jeśli dowiedziesz literalnego błędu w nim samym (np. zbyt krótki `beforeAll` timeout) — z uzasadnieniem w raporcie | Opis usterki w raporcie, jeśli jest |
| **Serwer, R2 — TYLKO ODCZYT reuse** | `server/src/routes/v8/teresa.routes.ts`, `server/src/services/v8/teresaCopilotService.ts` | **TYLKO ODCZYT** — GET już istnieje i wystarcza, backend nie wymaga zmiany w tym dyżurze | Brief z `plik:linia` |
| **Serwer, R3 — TYLKO ODCZYT (mierzysz kontrakt)** | `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`, `server/src/domain/initiatives-execution/adoptChatDraftInitiative.ts`, `server/src/config/FeatureFlags.ts`, `server/src/routes/pmo/initiatives.routes.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** Żadna litera się nie zmienia w tym dyżurze, niezależnie od werdyktu `R3` — cała naprawa (jeśli będzie) mieści się w jednym pliku frontu | Brief z `plik:linia`, cytat kontraktu read-back |
| **Produkt poza licznikiem tego dyżuru** | `src/**` (reszta), w tym `CaseIntakeConfirmCard.tsx`, `MessageRenderer.tsx`, `UnifiedChatPanel.tsx` | **TYLKO ODCZYT** | Opis w raporcie |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Rejestr bazowy `reachability`** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`, `scripts/dev/reachability-from-root.mjs` | **TYLKO ODCZYT** — bramka już czerwona z przyczyn niezwiązanych z tym dyżurem | Opis w raporcie, NIE naprawa |
| **Słowniki** | `public/locales/**` | **TYLKO ODCZYT.** Ten dyżur nie wymaga nowych kluczy i18n — jeśli naprawa `R2`/`R3` potrzebuje nowego komunikatu, użyj wzorca inline `isPl ? '...' : '...'`, jaki już istnieje w tych plikach, bez dotykania `translation.json` | Opis w raporcie |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł**, w tym `13_CHAT` | Rekomendacja w raporcie |
| **Materiał źródłowy** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY371_KARTY_PROPOZYCJI_REPORT.md`, `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**` | **TYLKO ODCZYT** — wejście do tego dyżuru, nie dokument do edycji | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o pierwszej wolnej literze, sprawdzonej komendą tuż przed commitem (na markerze ostatnia to `AM`, ale piszą równolegle inni autorzy 05.09) | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY375_KARTY_DOMKNIECIE_REPORT.md` (**NOWY**) | `R4` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Nowe dowody** | `evidence/day375-karty-domkniecie/**` (**NIE ISTNIEJE — tworzysz**) | **★ PEŁNA LICENCJA**; commitujesz przez `git add -f` | — |
| **Cudze tereny tej rundy** | `src/components/AIChat/CaseIntakeConfirmCard.tsx`, pozostałe pliki niewymienione wyżej w `AIChat/**` | **TYLKO ODCZYT** | Wpis do raportu, jeśli istotny |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

**★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
jest opisany jako „PEŁNA/WĄSKA LICENCJA" — masz pozwolenie i STOP z tytułu „nie wolno mi"
jest NIEZASADNY. Jeżeli pliku nie ma w tabeli w ogóle — domyślnie jest TYLKO DO ODCZYTU.

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35294, en 33154 (moga byc wyzsze, jesli rownolegle dyzury 374/376/377 dopisza klucze)

# (b) trzy bezpieczniki MAJA konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby: wszystkie 0

# (c) reach JEST JUZ CZERWONY na markerze -- notujesz liste PO NAZWACH, nie naprawiasz
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   oczekiwane: exit 1, lista rosnaca niezaleznie od Ciebie (nie Twoja sprawa) -- PO Twoich zmianach
#   lista ma zawierac dodatkowo TWOJE nowe pliki testowe, nazwane jawnie w raporcie, i ZERO plikow
#   zniknietych z listy sprzed Twojej pracy
```

**Jeżeli `focus-canon`/`list-canon`/`artefakt` zaczerwienią się OD TWOJEJ zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`). **`reach` zostaje czerwony
niezależnie od Ciebie — to nie jest Twoja bramka do gaszenia w tym dyżurze.**

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | linia backendu, którą faktycznie woła `Api.approveTeresaProposal` | `teresaCopilotService` (NIE `workCanvasService`) | komenda (1) z `§0.3` | TAK — rozstrzyga spór dwóch dokumentów |
| 2 | linia `useState`/`useEffect` w `TeresaProposalCard.tsx` | `71`/`74-76` | komenda (2) | TAK |
| 3 | żywe wywołania GET w `TeresaProposalCard.tsx` przed naprawą | `0` | komenda (2) | TAK |
| 4 | linia GET `/proposal/:id` w `teresa.routes.ts` | `325-333` | komenda (3) | TAK |
| 5 | wystąpienia `getTeresaProposal` w `api.ts` przed naprawą | `0` | komenda (3) | TAK |
| 6 | linia `useState('idle')` w `GovernedInitiativeHandoffCard.tsx` | `38` | komenda (4) | TAK |
| 7 | linie flagi `ENABLE_TERESA_ADOPT_CHAT_DRAFT` (front gałąź + serwer bramka) | `UnifiedChatPanel.tsx:815,2321-2325`; `FeatureFlags.ts:35,166`; `routes:1820` | komenda (5) | TAK — dowód, że flaga nie jest fantomem |
| 8 | linia GET `/command-receipts/:clientRequestId/read-back` | `4692-4730` | komenda (6) | TAK |
| 9 | mount-prefix `/runtime-v1` | `156` w `initiatives.routes.ts` | komenda (7) | TAK |
| 10 | stan testu rodziny (371) PRZED tym dyżurem | `5 GREEN / 1 RED` | komenda (9) | TAK — artefakt JSON, nie zgadywanie |
| 11 | liście słowników PL/EN | rosnące, patrz „Warunki wspólne" | blok (a) | TAK, wartość CHWIEJNA — licz PRZED i PO |
| 12 | `reach` exit code i lista nazw | `1`, lista niezależna od Ciebie | blok (c) | TAK — mianownik już zepsuty PRZED Tobą |
| 13 | `numPassedTests` w JSON-ie reportera dla `R1` po naprawionym dowodzie | `1` (musisz to zobaczyć w pliku, nie w kodzie wyjścia) | Twój nowy artefakt JSON | TAK — to jest sedno naprawy tego dyżuru |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`src/components/AIChat/TeresaProposalCard.tsx` ·
`src/services/api.ts` (WYŁĄCZNIE nowa funkcja `getTeresaProposal`) ·
`src/components/AIChat/__tests__/day371.proposalFamily.remount.test.tsx` (edycja licencjonowana) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY375_KARTY_DOMKNIECIE_REPORT.md` (NOWY) ·
`evidence/day375-karty-domkniecie/**` (NOWY) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**Zapisujesz WARUNKOWO:**
`src/components/AIChat/GovernedInitiativeHandoffCard.tsx` (WYŁĄCZNIE jeśli `R3`=NAPRAW).

**JAWNIE NIE ZAPISZESZ:** `server/src/services/tablePlatform/ChatToSchemaService.ts`,
`server/src/routes/table-platform.routes.ts` (trwale — tylko tymczasowy `cp` w mutacji),
`server/src/routes/__tests__/day371.chatToSchema.executeConflict.pg.test.ts` (chyba że
dowiedziesz błędu w nim samym), `server/src/routes/v8/teresa.routes.ts`,
`server/src/services/v8/teresaCopilotService.ts`,
`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`,
`server/src/domain/initiatives-execution/adoptChatDraftInitiative.ts`,
`server/src/config/FeatureFlags.ts`, `server/src/routes/pmo/initiatives.routes.ts`,
`src/components/AIChat/CaseIntakeConfirmCard.tsx`, `src/components/AIChat/MessageRenderer.tsx`,
`src/components/AIChat/UnifiedChatPanel.tsx`, `public/locales/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16),
`docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`,
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `.github/workflows/**`, `server/migrations/**` (ten dyżur nie
tworzy migracji — brak zmian schematu).

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day375-karty-domkniecie
git diff --name-only --cached | tee /private/tmp/cx-day375-karty-domkniecie-artefakty/staged.txt
bash -c "grep -iE '^public/locales/|ChatToSchemaService\.ts|table-platform\.routes\.ts|teresa\.routes\.ts|teresaCopilotService|initiativesExecutionRuntime|adoptChatDraftInitiative|FeatureFlags\.ts|initiatives\.routes\.ts|CaseIntakeConfirmCard|MessageRenderer\.tsx|UnifiedChatPanel\.tsx|MODULE_ACCEPTANCE|reachability\.baseline|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/' /private/tmp/cx-day375-karty-domkniecie-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
git diff --cached -- src/services/api.ts | grep -c "^[+-]"
#   oczekiwane: male (jedna nowa funkcja) -- duzy diff = naruszenie waskiej licencji
```

---

## R0 — TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Zero wiary w cudzą hipotezę bez własnego grepa.** Ta instrukcja i `ODBIOR_371.md`
twierdzą co innego o backendzie Teresy. Zmierz komendą (1) z `§0.3`, PIERWSZĄ rzeczą, zanim
napiszesz linię naprawy `R2`. Naprawiasz wedle tego, co SAM zobaczysz.

**(2) Asercja na ZACHOWANIU, nigdy na tekście źródła.** Nowy/przepisany test wywołuje i
sprawdza wynik. `readFileSync` + `toContain` nie jest dowodem.

**(3) Dowód na `R2` MUSI symulować F5 z TYM SAMYM propem, nie zmianą propsa między
mountami.** Test, który (re)montuje z DWOMA RÓŻNYMI propsami, dowodzi tylko reakcji na
zmianę propsa — nie jest to kształt zgłoszonego defektu. Wymagany kształt: dwa mounty,
IDENTYCZNY, przestarzały `proposal`, zamockowany `getTeresaProposal` zwracający inny,
świeższy stan.

**(4) `R3` kończy się jawnym werdyktem NAPRAW albo STOP, nigdy milczeniem.** Jeśli pomiar
obali którykolwiek z faktów opisanych w „Po co ten dyżur istnieje" (np. `canViewAggregate`
blokuje zwykłego aktora, albo `clientRequestId` w read-back nie da się dopasować) — to jest
STOP merytoryczny z dowodem, opisany w raporcie, nie próba naprawy na siłę.

**(5) Naprawa `R3`, jeśli się zdarzy, mieści się CAŁA w jednym pliku frontu**
(`GovernedInitiativeHandoffCard.tsx`) plus licencjonowanym teście. Jeśli wymaga choćby
jednej linii gdzie indziej (poza nowym testem) — to jest automatycznie poza licencją i
kończy się STOP-em.

**Wymagany dowód:** pięć zdań w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita.

## R1 — DOWÓD SERWEROWY 500→409: NIEZALEŻNIE ODTWARZALNY GREEN

**To NIE jest pozycja „napraw kod". Kod jest już poprawny. Zadaniem jest zdobyć dowód,
którego brakuje.**

1. Postaw własny kontener PostgreSQL na porcie **6446**, bazę `cx375`, uruchom migracje.
2. Uruchom **ISTNIEJĄCY** test `server/src/routes/__tests__/day371.chatToSchema.executeConflict.pg.test.ts`
   bez żadnych zmian, ze zmiennymi z sekcji „ŚCIEŻKI", `--reporter=json
   --outputFile=<ARTEFAKTY>/r1-green.json`. Otwórz plik i sprawdź POLE `numPassedTests` —
   musi być `1`, nie sam kod wyjścia procesu. Jeśli plik pokazuje `status:'skipped'` mimo
   kodu wyjścia 0 — to NIE JEST PASS (dokładnie ta sama pułapka, którą złapał odbiór 371).
   Zdiagnozuj przyczynę (typowo: zbyt krótki `beforeAll(..., 60_000)` przy ciężkiej
   inicjalizacji `ApiGateway` — zwiększ, jeśli trzeba) i powtarzaj, aż JSON pokaże realny
   PASS.
3. **Mutacja odwrotna.** Skopiuj (`cp`) do `SCRATCH` bieżący stan
   `ChatToSchemaService.ts`/`table-platform.routes.ts`, po czym TYMCZASOWO cofnij naprawę:
   przywróć plain `Error`+goły `res.status(500)` sprzed 371. Uruchom test ponownie,
   `--outputFile=<ARTEFAKTY>/r1-mutation-red.json` — ma być RED (druga asercja, oczekująca
   `409`+`code`, dostanie `500` bez kodu). Zapisz dosłowną treść niepowodzenia.
4. Przywróć naprawę z `SCRATCH` (`cp` z powrotem). `git diff` po przywróceniu musi być
   **pusty** — potwierdza, że trwały stan repo jest niezmieniony. Uruchom test trzeci raz,
   `--outputFile=<ARTEFAKTY>/r1-restored-green.json` — ma być GREEN, z tym samym
   `numPassedTests:1`.
5. **Nie zmieniasz produktu w tej pozycji.** Jedyne zapisane pliki to trzy JSON-y w
   `ARTEFAKTY` i (jeśli w ogóle) opis w raporcie.

**Wymagany dowód:** trzy JSON-y reportera (green/mutation-red/restored-green), każdy z
polem `numPassedTests` odczytanym i zacytowanym w raporcie · `git diff` po przywróceniu
pusty · SHA-256 wszystkich trzech JSON-ów w raporcie. **Commit po `R1`** (tylko artefakty w
`evidence/`, zero zmian w kodzie produktu).

## R2 — `TeresaProposalCard`: ŻYWY ODCZYT STATUSU (RDZEŃ)

1. **Rozstrzygnij spór backendu.** Komenda (1) z `§0.3`. Zapisz w raporcie dosłowny wynik i
   który dokument (ta instrukcja czy `ODBIOR_371.md`) się mylił, jeśli któryś się mylił.
2. **Pokaż defekt na (re)mount, z TYM SAMYM propem.** Nowy przypadek testowy w
   `day371.proposalFamily.remount.test.tsx` (albo osobny plik, jeśli wolisz — ale wtedy
   dopisz go do listy „zapisujesz na pewno"): (re)montuje `TeresaProposalCard` z propsem
   `proposal` niosącym `state: 'pending_approval'` w OBU mountach (identyczny obiekt/wartości),
   z zamockowanym `getTeresaProposal` zwracającym `{ ...proposal, state: 'completed' }` (albo
   inny „świeższy" stan). Dzisiejszy kod ma pokazać przyciski akcji mimo że „serwer" mówi
   `completed` — to jest dowód defektu, zapisz komendę i wynik dosłownie (RED na kodzie
   sprzed naprawy).
3. **Napraw.** Dopisz `Api.getTeresaProposal(proposalId)` w `src/services/api.ts` (GET
   `/v8/teresa/proposal/:id`, ten sam wzorzec `fetchWithRetry`/`getHeaders`/`handleResponse`
   co sąsiednie funkcje). W `TeresaProposalCard.tsx`, przy (re)moncie i przy zmianie
   `currentProposal.proposalId`, wywołaj tę funkcję i zaktualizuj `currentProposal` na
   podstawie najświeższego znanego stanu — tym samym wzorcem co
   `ChatTableProposalCard.tsx:60-76` (flaga `active`, `.catch()` łykający błąd bez wywalenia
   komponentu, lokalny stan jako WYŁĄCZNIE optymistyczna nakładka na WŁASNĄ akcję w tej samej
   sesji, nigdy jedyne źródło prawdy po (re)moncie).
4. **Napraw ISTNIEJĄCY mock, żeby nie zepsuć rodziny.** Dopisz `getTeresaProposal: vi.fn()`
   do wspólnego `vi.mock('@/services/api', ...)` w `day371.proposalFamily.remount.test.tsx`
   W TYM SAMYM COMMICIE co zmianę komponentu — inaczej istniejący przypadek Teresy (l.117-124)
   eksploduje `TypeError` zamiast po prostu failować asercją. Jeśli ten istniejący przypadek
   wymaga korekty pod nowy mechanizm (np. jawnego `mockResolvedValue` zgodnego z drugim
   propsem) — popraw go, zapisz w raporcie co i dlaczego.
5. **Powtórz dowód mutacyjny.** Cofnij naprawę przez `cp` ze `SCRATCH` do stanu z punktu 2 —
   nowy test ma ZACZERWIENIĆ SIĘ; przywróć — ma ZZIELENIEĆ; `git diff` po cofnięciu **pusty**.
6. **Nie osłabiasz reszty pliku ani reszty rodziny.** `diff` pełnych nazw testów w
   `day371.proposalFamily.remount.test.tsx` przed/po Twoją zmianą — cztery pozostałe
   przypadki (ChatTableProposalCard×2, ExecutionProposalMessage, GovernedChatHandoffCard)
   zostają zielone i nietknięte; przypadek `GovernedInitiativeHandoffCard` zostaje jak jest w
   tej pozycji (to `R3`).

**Wymagany dowód:** rozstrzygnięcie sporu backendu z cytatem `plik:linia` · test remontu
czerwony na starym kodzie, zielony po naprawie, z TYM SAMYM propem w obu mountach · diff
naprawy (komponent + nowa funkcja klienta + poprawka mocka) · dowód mutacyjny w obie strony
· `diff` pełnych nazw testów całej rodziny, zero ubytków. **Commit po `R2`.**

## R3 — `GovernedInitiativeHandoffCard`: POMIAR ŻYWEGO KONTRAKTU I WERDYKT

**To jest pozycja „zmierz i orzeknij", z naprawą TYLKO jeśli mieści się w jednym pliku
frontu.**

1. **Potwierdź żywotność (nie jest martwa jak Case Intake).** Komendy (4)-(7) z `§0.3`.
   Zapisz w raporcie cytaty `plik:linia` producenta (`UnifiedChatPanel.tsx`), flagi (obie
   strony), backendu adopcji i odczytu kwitu.
2. **Zmierz semantykę read-back na realnym przykładzie.** Zweryfikuj (RTL z mockiem `fetch`
   albo, jeśli wolisz mocniejszy dowód, curl na realnym środowisku dev z włączoną flagą —
   Twój wybór, opisz w raporcie): po wywołaniu `adopt()` z danym `initiativeId`, zapytanie
   `GET /api/initiatives/runtime-v1/command-receipts/<encodeURIComponent('chat-draft-adopt:'+initiativeId)>/read-back`
   zwraca `readBackState: 'CONFIRMED'`; BEZ wcześniejszego `adopt()` dla INNEGO
   `initiativeId` — `404`. Sprawdź `encodeURIComponent` na dwukropku w `clientRequestId` —
   te same bajty muszą trafić do backendu w obu miejscach (`adopt()` i nowym odczycie).
3. **Zmierz autoryzację.** Sprawdź `canViewAggregate`/`resolveProjectIdsForAggregate`
   (`initiativesExecutionRuntime.routes.ts:1312-1324`) — czy zwykły aktor z dostępem do
   projektu inicjatywy dostaje `CONFIRMED` po adopcji, a aktor BEZ tego dostępu dostaje `404`
   (oczekiwane, nie błąd) dla TEJ SAMEJ, faktycznie zmaterializowanej komendy. Zapisz oba
   scenariusze osobno — mylenie ich da fałszywy STOP albo fałszywe „naprawione".
4. **Werdykt NAPRAW** (jeśli punkty 2-3 się potwierdzą): przy (re)moncie karta odpytuje
   read-back (surowy `fetch`, `credentials:'include'`, ten sam wzorzec co `checkReadiness`/
   `adopt` w tym samym pliku) i, gdy dostanie `CONFIRMED`, ustawia stan startowy na `adopted`
   zamiast `idle` (błąd/404 → zostaje dzisiejsze `idle`, cicho, bez wywalenia komponentu).
   Zero nowej flagi. Przepisz istniejący przypadek testowy w
   `day371.proposalFamily.remount.test.tsx:178-191` z fikcyjnego propsa `state:'adopted'`
   (który komponent ignoruje) na mock realnego `fetch` do read-back — dowód RED na starym
   kodzie (dzisiejsza sytuacja), GREEN po naprawie, mutacyjny w obie strony.
5. **Werdykt STOP** (jeśli którykolwiek z punktów 2-3 nie da się potwierdzić w licencji tego
   pakietu, albo naprawa wymagałaby pliku spoza `GovernedInitiativeHandoffCard.tsx`): karta
   zostaje jak jest. Istniejący czerwony przypadek w `day371.proposalFamily.remount.test.tsx:178-191`
   MA PRAWO zostać czerwony — ale dopisz nad `it(...)` krótki komentarz odsyłający do raportu
   z powodem, zamiast milczeć. Sekcja PYTANIA DO WŁAŚCICIELA musi zawierać konkretne „czego mi
   zabrakło, żeby rozstrzygnąć samodzielnie".
6. **Zero stanu pośredniego.** Nie zostawiasz karty bez wzmianki i nie budujesz połowicznego
   mechanizmu „na próbę".

**Wymagany dowód:** cytaty `plik:linia` żywotności · pomiar read-back (CONFIRMED/404,
poprawność `encodeURIComponent`) · pomiar autoryzacji (dwa scenariusze) · jawny werdykt
NAPRAW/STOP z uzasadnieniem · (jeśli NAPRAW) test RED→GREEN + mutacyjny, przepisany
przypadek w pliku rodziny · (jeśli STOP) komentarz w teście + pytanie do właściciela.
**Commit po `R3`.**

## R4 — RAPORT, REJESTR ZNALEZISK, PYTANIA DO WŁAŚCICIELA

Raport zawiera: rozstrzygnięcie sporu backendu Teresy z `R2` punkt 1 · trzy JSON-y `R1` z
polem `numPassedTests` zacytowanym dosłownie · dowód defektu i naprawy `R2` z TYM SAMYM
propem w obu mountach · werdykt `R3` (NAPRAW/STOP) z pełnym uzasadnieniem punktów 2-3 ·
listę rozbieżności wobec liczb tej instrukcji (słowniki PL/EN w szczególności) · niepustą
sekcję „TWIERDZENIA NIEZWERYFIKOWANE" · potwierdzenie, że `CaseIntakeConfirmCard.tsx` i
`MessageRenderer.tsx` pozostały nietknięte (diff pusty).

★★ **Osobna, obowiązkowa sekcja: „R1 — DOWÓD ODTWORZONY".** Trzy SHA-256 JSON-ów, trzy
wartości `numPassedTests`/`numFailedTests` zacytowane wprost.

★★ **Osobna, obowiązkowa sekcja: „R2 — SPÓR BACKENDU ROZSTRZYGNIĘTY".** Jedno zdanie: który
serwis faktycznie stoi za akcjami Teresy, z cytatem `plik:linia`, i czy to zgadzało się z tą
instrukcją, z `ODBIOR_371.md`, z obydwoma, czy z żadnym.

★★ **Osobna, obowiązkowa sekcja: „R3 — WERDYKT I DLACZEGO".** NAPRAW albo STOP, z rachunkiem
pomiaru punktów 2-3 dosłownie.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA".** NIE MOŻE być pusta. Jeśli `R3`
zakończył się STOP-em, pytanie z `R3` punkt 5 jest obowiązkowe. Niezależnie od werdyktu `R3`,
dopisz też: „czy `GovernedInitiativeHandoffCard` (przekazanie inicjatywy z czatu do
realizacji) ma w ogóle wejść do produktu z domyślnie włączoną flagą w najbliższym czasie, czy
zostaje wyłączona do dalszych decyzji?" — to pytanie produktowe, niezależne od stanu kodu.

★ Zanim dopiszesz cokolwiek do `REJESTR_ZNALEZISK_20260903.md`, sprawdź literę TUŻ PRZED
COMMITEM: `bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
— piszą równolegle inni autorzy tej samej rundy (374, 376, 377).

**Commit po `R4`.**

## Próg odbioru

**R1 domknięty:** trzy JSON-y reportera na WŁASNYM kontenerze, z polem `numPassedTests`
faktycznie pokazującym PASS/RED/PASS, nie samym kodem wyjścia procesu. **R2 domknięty:**
spór backendu rozstrzygnięty grepem (nie wyborem dokumentu), test remontu z TYM SAMYM propem
w obu mountach czerwony na starym kodzie i zielony po naprawie, mutacja w obie strony,
rodzina (4 pozostałe przypadki) nietknięta i zielona. **R3 rozstrzygnięty** jawnym werdyktem
NAPRAW/STOP z dowodem pomiaru read-back i autoryzacji, nie zostawiony w milczeniu. Sekcja
„PYTANIA DO WŁAŚCICIELA" niepusta. `CaseIntakeConfirmCard.tsx`/`MessageRenderer.tsx`
nietknięte.

Odbiorca odrzuci dyżur, w którym: JSON „PASS" dla `R1` pokazuje `status:'skipped'` po
zajrzeniu do pliku; nowy test `R2` dowodzi tylko reakcji na zmianę propsa (nie na TEN SAM
zamrożony props); backend Teresy został zmieniony mimo licencji TYLKO ODCZYT; `R3` zbudował
coś poza jednym plikiem frontu; `R3` zakończył się milczeniem zamiast jawnym
NAPRAW/STOP; zmieniono `CaseIntakeConfirmCard.tsx` albo `MessageRenderer.tsx`; zmienił się
stan choćby jednego wiersza macierzy odbioru.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „R1 odtworzony z realnym
artefaktem PASS, R2 naprawiony i udowodniony mutacyjnie z poprawnym propem, R3 zakończony
STOP-em z dowodem pomiaru read-back" — **jest pełnowartościowym wynikiem**, nawet jeśli
werdykt `R3` to STOP.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: sprawdzasz warunek
NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku. Wynik
ponownego sprawdzenia wklejasz do raportu z datą i godziną. **Liczby słowników i stan testu
rodziny w szczególności — ta gałąź może być w ruchu, licz na nowo.**

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Ta instrukcja mówi backend X" vs „`ODBIOR_371.md` mówi backend Y" | `R0`(1)/`R2`(1): rozstrzyga własny grep wykonawcy, nie żaden z dwóch dokumentów z góry |
| „Napraw D-3-podobny defekt w Teresie" vs „nie zmieniaj architektury magazynu propozycji" | `R2`: nowe zapytanie `getTeresaProposal` per-karta, BEZ dotykania `useProposalLifecycleStore`/`teresaCopilotService` |
| „Podłącz żywy odczyt w `R3`" vs „naprawa mieści się w jednym pliku frontu" | `R3` punkt 4: read-back JUŻ istnieje i jest generyczny — front tylko go odpytuje, zero zmian backendu |
| „Nowy ekran wymaga flagi" vs „`R3` nie dodaje nowej flagi" | `R3`: kod jest JUŻ za istniejącą flagą `ENABLE_TERESA_ADOPT_CHAT_DRAFT`; naprawa poprawia zachowanie pod flagą ON, nie włącza jej |
| „Dopisz test do wspólnego pliku rodziny" vs „nie psuj istniejących czterech przypadków" | `R2`/`R3`: `diff` pełnych nazw testów obowiązkowy po każdej zmianie w tym pliku |
| „`reach` musi nie regresować" vs „`reach`=1 już na markerze, cudza sprawa" | „Stan zastany": mierzysz deltę po nazwach, nie naprawiasz cudzej czerwieni |
| „Dopisz sekcję do rejestru znalezisk" vs „równolegle piszą inni autorzy" | `R4`: literę sprawdzasz komendą tuż przed commitem |
| „Zmierz liczby z instrukcji" vs „gałąź może być w ruchu" | „Zmierz moje liczby sam": dla słowników i `reach` liczy się WŁASNY świeży pomiar |
| „R3 może zakończyć się STOP" vs „zakaz stanu pośredniego bez wzmianki" | `R3` punkt 5: STOP dozwolony, ale WYŁĄCZNIE z komentarzem w teście i pytaniem do właściciela |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 9 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — wszystkie ścieżki `plik:linia` sprawdzone `grep -n`/`sed -n` na worktree z markera `8f60ab9987`; `evidence/day375-karty-domkniecie/` jawnie oznaczone jako NIE ISTNIEJE |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 13 wierszy, wszystkie zmierzone przy wydaniu; spór backendu Teresy jawnie oznaczony jako ROZSTRZYGANY PRZEZ WYKONAWCĘ, nie przez autora |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — front R2 · klient API R2 · front R3 · test rodziny (warunkowa) · serwer R1 (odczyt) · pg-test R1 (warunkowa) · serwer R2 (odczyt) · serwer R3 (odczyt) · reszta produktu · infrastruktura testów · reachability · słowniki · macierz · materiał źródłowy · rejestr znalezisk · raport · nowe dowody · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` zero zmian produktu, tylko artefakty; `R2` jeden komponent + jedna nowa funkcja klienta + jeden wspólny test; `R3` jeden plik frontu + ten sam wspólny test, zero zmian backendu w obu werdyktach |
| 6 | Przydział zasobów wyłącznych sprawdzony wobec dyżurów równoległych | TAK — 6446/5586 wolne (`lsof` przy wydaniu), brak kontenera `cx-day375-pg`, brak gałęzi/worktree `codex/day375-*`; rodzeństwo 367-373 scalone i nietykane, 374/376/377 mają rozłączne porty |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera przy pisaniu tej instrukcji |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — cztery pułapki właściwe: dwie sprzeczne hipotezy o backendzie, `vi.fn()` bez mocka rzuca zamiast failować asercją, kodowanie `clientRequestId` musi być identyczne w obu miejscach, autoryzacja `canViewAggregate` może dać fałszywy `404` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, zero pól szablonu | TAK — kontrola generatora przy wydaniu: znaczników niepodmienionego pola szablonu zero |
