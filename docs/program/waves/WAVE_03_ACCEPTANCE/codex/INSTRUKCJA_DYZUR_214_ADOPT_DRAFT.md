# INSTRUKCJA DYŻURU nr 214 — Codex — „WYDANIE PONOWNE 208 — Inicjatywa z czatu → realizacja (17-D, §3 P4 ARCHITEKTURA_AGENTA_TERESY.md): most `initiative.adopt-chat-draft` (siostra ISTNIEJĄCEGO, ale NIEUŻYWANEGO poza SWOT mostu `initiative.adopt-accepted-classic`) + nowa karta czatu z bramką zgody, za WŁASNĄ flagą domyślnie OFF — reszta governance (definicja→analiza→portfel→harmonogram→handoff) zostaje w 100% w ISTNIEJĄCYCH, ręcznych ekranach"

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
> **wyłącznie** `/private/tmp/cx-day214-adopt-draft`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `fe33ce8036`**
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
Zakres: **Moduł 17, pozycja 17-D — §3 P4 z `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` ("Inicjatywa z czatu = sierota — draft bez wołania registerInitiative→handoff→execution_case"). Przekrojowy: backend `server/src/domain/initiatives-execution/**` (nowa komenda materialna) + `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` (nowa trasa) + jedna migracja addytywna (tabela paragonów, wzorem 20261061) + `server/src/config/FeatureFlags.ts` (nowa flaga, WYŁĄCZNIE wpis) + front `src/components/AIChat/**` (nowa karta czatu). Zero zmian w istniejącym łańcuchu governance (definitionDecision/analysisDecision/portfolioDecision/scheduleDecision/handoffAcceptance) i zero zmian ekranów Initiatives poza tym, że karta czatu na końcu do nich nawiguje.**.
Trasy front: `Front zmieniasz w DWÓCH miejscach: `src/components/AIChat/UnifiedChatPanel.tsx` — WYŁĄCZNIE gałąź `payloadKind === 'initiative'` (zmierzone `:2219-2237` na SHA `fe33ce8036` — dziś: auto-navigate `navigateToRoute('/initiatives?open=<id>&mode=doc')` + `toast.success(...'Initiative created from chat')`, ZERO bramki zgody, ZERO wzmianki o governance). NOWY plik `src/components/AIChat/GovernedInitiativeHandoffCard.tsx` (wzorem `GovernedChatHandoffCard.tsx` — 9803 bajtów, interfejs `GovernedChatHandoffCardProps` `:15`, stany pochodne z `proposal.state`: `isPending`/`isApproved`/`isDone` `:36-46` → `visualState` `pending|approved|working|materialized|failed|rejected`; NIE modyfikujesz wzorca). ★ Punkt wpięcia karty w istniejącym moście: `src/components/AIChat/MessageRenderer.tsx:1965-1970` — `{msg.role==='ai' && governedHandoff ? <GovernedChatHandoffCard proposal={governedHandoff} .../> : ...}` — `governedHandoff` to pole na WIADOMOŚCI, nie globalny stan; Twoja karta potrzebuje analogicznego pola (np. `initiativeHandoff`) na wiadomości i analogicznej gałęzi w `MessageRenderer.tsx`, LUB — jeśli zmierzysz, że prościej — wstrzyknięcia przez ten sam `onDeliverable`/store, którego dziś używa `payloadKind==='initiative'` (rozstrzygnij i zapisz w raporcie, nie zgaduj). Odczyt (kontekst, nie zmieniasz): `src/components/Initiatives/InitiativeDocumentView.tsx` (zmierzone `:793-819` i `:11301` — TRZY trafienia grepu na `InitiativeDraftJourney`, WSZYSTKIE trzy to komentarze, nie import/JSX — dowód że banner „co dalej” jest USUNIĘTY z renderu, zamierzenie „Etap 5 gridu n-Type”, cytat wprost: „był jedynym callerem InitiativeDraftJourney w repo”); `src/components/Initiatives/InitiativeDraftJourney.tsx` (plik i eksport ISTNIEJĄ, zero realnych callerów — zweryfikowane grepem bez obcięcia, `Z12` z części D szkieletu).`. Trasy tył: `Tył zmieniasz w CZTERECH miejscach (komenda, transakcja, trasa, migracja) — ale najpierw ★★ NAJPIERW OBALENIE TROPU Z ZAMÓWIENIA — `chatHandoffService`/`chatTargetMappingService`/`handoffSpineService`/`materializeClaimedChatTarget`/`TARGET_KINDS` to ISTNIEJĄCY, ale ZŁY dla tej pozycji most: `TARGET_KINDS = ['document','presentation','workbook','material']` (`handoffSpineService.ts:49-50`) — zamknięta lista ARTEFAKTÓW, bez `initiative`, bez `task`, bez `decision` (potwierdzone niezależnie przez dyżur 207, K4). Mechanizm pinuje BAJTY WIADOMOŚCI czatu i materializuje DOKUMENT/PREZENTACJĘ/ARKUSZ — to jest most WIADOMOŚĆ→ARTEFAKT, nie WYWOŁANIE-NARZĘDZIA→REKORD KANONICZNY. `dynamicSwot` (grep: `src/config/swot/`, `src/toolPacks/packs/dynamicSwot.pack.ts`) to config narzędzia Discovery Tools SWOT — jego `outcome` (pack, sekcja `library`) mówi wprost: SWOT produkuje „kandydatów na inicjatywy”, ale SAM plik nie ma żadnego mostu adopcyjnego. ★★ WŁAŚCIWY, ZMIERZONY MOST-SIOSTRA to `server/src/domain/initiatives-execution/adoptAcceptedClassicInitiative.ts` (3330 bajtów; payload `{candidateId,projectId,initiativeOwnerId,visibility}` `:9-13`; funkcja `:16-38`, `commandType!=='initiative.adopt-accepted-classic'` guard `:20-25`, woła `executeMaterialCommand`→`tx.adoptAcceptedClassicInitiative(...)`, zwraca stan `lifecycleState:'REGISTERED_DRAFT'`, `source.sourceType:'accepted_classic_swot_candidate'` DOSŁOWNIE zaszyte w kodzie — to jest most JAWNIE SWOT-owy) + trasa `POST /adoptions/accepted-classic` (`initiativesExecutionRuntime.routes.ts:1750-1808`, Zod `AdoptAcceptedClassicSchema` `:178`, DWIE bramki w kolejności: `deps.authorize(actor,projectId,'initiative.create')` → `403 CAPABILITY_REQUIRED`, potem `deps.reader.isEligibleInitiativeOwner(...)` → `422 INITIATIVE_OWNER_INELIGIBLE`) + metoda transakcji `PostgresMaterialCommandUnitOfWork.adoptAcceptedClassicInitiative` (`postgresMaterialCommandUnitOfWork.ts:90-150`, JOIN `initiative_candidates`+`swot_candidate_handoffs`+`tool_outputs`, wymaga `c.status='accepted'`, `o.status='approved'`) + paragon append-only `server/migrations/20261061_flow_accepted_classic_runtime_adoption.sql` (trigger `BEFORE INSERT` waliduje CAŁY graf tożsamości przez JOIN identyczny z transakcją, trigger `BEFORE UPDATE OR DELETE` rzuca wyjątkiem — tabela jest NIETYKALNA po zapisie). ★★ Ten most ma ZERO testów w całym repo (zmierzone: `find . -iname '*adoptAcceptedClassic*test*'` → pusto) — jesteś PIERWSZYM, kto go testuje, więc wzorca struktury testu NIE MASZ z tego katalogu; wzorzec BIERZESZ z sąsiada tej samej rodziny komend: `tests/integration/initiatives-execution/registerInitiative.realdb.test.ts` (Postgres realny przez `pg.Pool`, `PostgresMaterialCommandUnitOfWork`, `describe.skip` gdy brak `DATABASE_URL`) i `tests/unit/initiatives-execution/materialCommand.test.ts`. ★ Geneza draftu-sieroty, którą adoptujesz: `server/src/services/ai/tools/generateInitiative.ts` (nagłówek `:4-9`: „no approval gate, because a draft is fully reversible”; `sourceType` domyślnie `'teresa_chat'` `:294`, `sourceId` domyślnie SAM-SIEBIE (id inicjatywy) gdy caller nic nie poda `:296` — `context.conversationId`, mimo że jest dostarczany przez trasę `ai.routes.ts` (`conversationId: conversationId || null`, blok `deliverableTools.context`), NIGDY nie jest czytany w `generateInitiative()` — dowód, że dzisiejsza „proweniencja” to STAŁA `'teresa_chat'`, nie odwołanie do KONKRETNEJ rozmowy) → `initiativeGenerationService.createInitiative` (`:1451+`, WEWNĘTRZNIE woła `funnelCreateInitiative` z `createInitiativeService.js` — patrz DLACZEGO, „ten sam writer”) → `createInitiativeService.ts` (INSERT realny `:316-334` — kolumny `owner_business_id`/`owner_execution_id` ISTNIEJĄ w schemacie, `generateInitiative.ts` NIGDY ich nie wypełnia). Odczyt (kontekst, NIE zmieniasz): `registerInitiative.ts` (`:80-95` — wymaga PRZED-ISTNIEJĄCEJ propozycji w `initiative_candidates` z `status='pending'`/`evidenceState='READY'`/`duplicateState='CLEAR'` I dokładnej zgodności treści z propozycją, inaczej `MaterialCommandConflictError` — naiwne wywołanie tej komendy dla draftu czatowego PADNIE, dlatego wzorcem jest most BEZPOŚREDNI jak `adopt-accepted-classic`, nie dwuetapowy submit→register), `submitSourceProposal.ts`, `definitionDecision.ts`, `analysisDecision.ts`, `portfolioDecision.ts`, `scheduleDecision.ts`, `handoffAcceptance.ts`, `definitionReadiness.ts`/`analysisReadiness.ts` (trasy readiness `initiativesExecutionRuntime.routes.ts:2284` i `:2709` — czytają przez `deps.reader.findById` z magazynu KANONICZNEGO, dla niezarejestrowanego draftu zwracają `404`, więc karta czatu PRZED adopcją nie ma czego pokazać jako „braki definicji/analizy” — tylko braki PRE-adopcyjne z wiersza `initiatives`) — CAŁY istniejący łańcuch governance, poza zakresem zmian.`.

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
WT=/private/tmp/cx-day214-adopt-draft
MARKER=fe33ce8036

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day214-adopt-draft-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day214-adopt-draft/config.worktree"
cat "$VAULT/worktrees/cx-day214-adopt-draft/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day214-adopt-draft-scratch
mkdir -p /private/tmp/cx-day214-adopt-draft-artefakty

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
git -C "$VAULT" log --oneline fe33ce8036..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only fe33ce8036..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day214-adopt-draft-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only fe33ce8036..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziesięć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day214-adopt-draft

# (W1) HISTORIA 208 — potwierdz sam, ze gniazdo jest puste
git branch -a | grep -i day208
git log --oneline codex/m03-admin-20260824..codex/day208-inicjatywa-handoff-20260831 | grep -v "^[0-9a-f]* docs(codex): dyzur"
git log --all --oneline | grep -i day208
#   oczekiwane: gałąź ISTNIEJE, ale pierwsza komenda (po odfiltrowaniu commitów
#   'docs(codex): dyzur ... wydany') zwraca PUSTO — zero realnej pracy 208.
#   Druga komenda pokazuje TYLKO jeden commit wydania (15c7a68b9d).

# (W2) WLASCIWY MOST-SIOSTRA — adoptAcceptedClassicInitiative, nie chatHandoffService
sed -n '1,40p' server/src/domain/initiatives-execution/adoptAcceptedClassicInitiative.ts
grep -n "router.post\|AdoptAcceptedClassicSchema" server/src/routes/pmo/initiativesExecutionRuntime.routes.ts | sed -n '1,10p'
grep -n "adoptAcceptedClassicInitiative\b" server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts
#   oczekiwane: payload {candidateId,projectId,initiativeOwnerId,visibility} (:9-13);
#   trasa '/adoptions/accepted-classic' (:1751); metoda transakcji w UoW (:90).

# (W3) OBALENIE TROPU chatHandoffService/TARGET_KINDS — to NIE jest most dla inicjatyw
sed -n '49,51p' server/src/services/artifactHandoff/handoffSpineService.ts
grep -rn "createCandidateFromSource\|swot_recommendation" server/src/services/tools/swotCandidateHandoffService.ts | head -3
#   oczekiwane: TARGET_KINDS = ['document','presentation','workbook','material'] — BEZ
#   'initiative'. swotCandidateHandoffService tworzy 'initiative_candidates' (klasyczna
#   tabela), nie ma nic wspolnego z TARGET_KINDS — to DWA rozne, niepowiazane mosty.

# (W4) GENEZA DRAFTU-SIEROTY: ten sam writer co wizard, ale bez rozmowy/wlasciciela
sed -n '1,10p' server/src/services/ai/tools/generateInitiative.ts
sed -n '290,300p' server/src/services/ai/tools/generateInitiative.ts
grep -n "funnelCreateInitiative\|createInitiative as" server/src/services/initiativeGenerationService.ts | head -3
sed -n '245,251p;316,336p' server/src/services/initiative/createInitiativeService.ts
#   oczekiwane: naglowek 'no approval gate...'; sourceType domyslnie 'teresa_chat',
#   sourceId domyslnie SAM id inicjatywy (nie conversationId); initiativeGenerationService
#   IMPORTUJE funnelCreateInitiative z createInitiativeService.js (ten sam writer co
#   wizard/candidate-accept); INSERT ma owner_business_id/owner_execution_id, nigdy
#   nie wypelnione przez generateInitiative.ts.

# (W5) FRONT DZIS: auto-navigate + toast, zero bramki
sed -n '2219,2240p' src/components/AIChat/UnifiedChatPanel.tsx
#   oczekiwane: galaz payloadKind==='initiative' nawiguje NATYCHMIAST, bez pytania o zgode.

# (W6) InitiativeDraftJourney — plik istnieje, zero realnych callerow (tylko komentarze)
grep -n "InitiativeDraftJourney" src/components/Initiatives/InitiativeDocumentView.tsx
grep -rln "InitiativeDraftJourney" src/ --include='*.tsx' | grep -v __tests__
#   oczekiwane: WSZYSTKIE trafienia w InitiativeDocumentView.tsx to komentarze (//, /* */);
#   jedyny inny plik z nazwa to sam InitiativeDraftJourney.tsx.

# (W7) WZORZEC KARTY CZATU I PUNKT WPIECIA
ls -la src/components/AIChat/GovernedChatHandoffCard.tsx
grep -n "GovernedChatHandoffCard" src/components/AIChat/MessageRenderer.tsx
#   oczekiwane: plik istnieje; wpiecie w MessageRenderer.tsx ok. linii 1965-1970,
#   warunek 'msg.role==="ai" && governedHandoff'.

# (W8) TESTY ISTNIEJACE DLA MOSTU-WZORCA — sprawdz PRZED zalozeniem katalogu
find . -iname "*adoptAcceptedClassic*test*" 2>/dev/null
find . -iname "*registerInitiative*test*" -o -iname "*materialCommand*test*" 2>/dev/null
#   oczekiwane: PIERWSZA komenda PUSTA (zero testow mostu-wzorca — jestes pierwszy);
#   DRUGA pokazuje tests/integration/initiatives-execution/*.realdb.test.ts —
#   to jest KATALOG i wzorzec struktury, ktory naprawde uzywasz.

# (W9) ai_actions/207 na TWOJEJ bazie — czy jest czym sie oprzec
grep -n "requestAction" server/src/services/aiActionExecutor.ts | head -3
git log --oneline --all | grep -i "day207"
#   oczekiwane: requestAction (:295) ma zero wolaczy produkcyjnych poza createDraft;
#   jedyny commit day207 to 'wip(day207): ... NIEZWERYFIKOWANA' — nie wszedl.

# (W10) PORT I MIEJSCE NA DYSKU
df -h /
lsof -nP -iTCP:6154 -iTCP:5098 -iTCP:5099 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -E 'cx-day2(0[6-9]|1[0-9])'
#   oczekiwane: df >5GB wolnego; lsof PUSTY na Twoich portach; docker ps moze pokazac
#   zywe kontenery rownoleglych dyzurow — NIE dotykaj ich, tylko cx-day214-pg jest Twoj.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day214-adopt-draft-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6154`. Twój JEDYNY port harnessu to `5098 i 5099`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day214-pg`**. **ZAKAZANE:** `zajęte 6012, 5433, 6047, 6054-6153, 5010-5097, 6404-6411 (odbiory nadzorcy i dyżury wcześniejsze niż 214, w tym 206/207 na tym samym torze modułu 17). ★★ ZABRONIONE NA PRZÓD: 6155-6157, 5100-5105 (dyżury 215-217, biegną RÓWNOLEGLE w tej samej fali B — patrz `docs/program/funkcje/LISTA_DYZUROW_211_222.md`). ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 ZAJĘTY NA STAŁE przez `adb`. ★ PORTY 5060-5061 ZAJĘTE (ERR_UNSAFE_PORT/SIP — nie próbuj, nawet jeśli `lsof` je pokaże jako wolne). Twój WYŁĄCZNY przydział: baza `6154`, harness `5098 i 5099`, kontener `cx-day214-pg`. Ta lista jest rozkazem pomiarowym, nie gwarancją — `lsof -nP -iTCP -sTCP:LISTEN` i `docker ps -a` PRZED startem, wynik wklej do raportu.`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `★★ TAK — CAŁA pozycja (nowa komenda + nowa trasa + nowa karta czatu) idzie za WŁASNĄ, NOWĄ flagą `ENABLE_TERESA_ADOPT_CHAT_DRAFT`, domyślnie OFF. ★★ TO JEST ŚWIADOMA KOREKTA wobec pierwszego wydania 208 (`cfg208.json`/`body208.md` w scratchu, POZYCJE_Z_FLAGAMI): tamto wydanie zakładało „karta czatu i nowa trasa są ZAWSZE aktywne — zgoda użytkownika (klik) JEST bramką, nie flaga”. To myli DWIE różne rzeczy: bramkę WYKONANIA (słusznie: klik człowieka) z bramką WIDOCZNOŚCI NOWEGO EKRANU (`CLAUDE.md` §7/§9, `Z10`/`Z11` z części A szkieletu: „właściciel NIGDY nie jest pierwszym testerem wizualnym”, „nic nie wchodzi na demo bez akceptacji właściciela na zrzutach”). Ta pozycja ZASTĘPUJE dzisiejsze zachowanie (auto-navigate + toast) NOWYM EKRANEM (karta w dymku czatu) — to jest dokładnie klasa zmiany, którą flaga musi osłaniać, niezależnie od tego, że sama akcja wewnątrz karty ma swoją bramkę zgody. Przy fladze OFF: `payloadKind==='initiative'` w `UnifiedChatPanel.tsx` zachowuje się BAJT W BAJT jak dziś (auto-navigate + toast, zero karty, zero nowej trasy wołanej). Przy ON: renderuje się `GovernedInitiativeHandoffCard` zamiast auto-navigate. Dwa miejsca do dopisania w `server/src/config/FeatureFlags.ts`: wpis w `FeatureFlagsSchema` (wzorzec `ENABLE_TERESA_RETRIEVAL`, zmierzone `:34`, `z.boolean().default(false)`) i wpis w bloku ładującym (wzorzec zmierzony `:149`, `process.env.ENABLE_TERESA_RETRIEVAL === 'true'`). ★★ FLAGA MA BYĆ DOWIEDZIONA ZACHOWANIEM: test przy OFF dowodzi, że `generate_initiative` NADAL tworzy DRAFT i NADAL auto-nawiguje (zero regresji), test przy ON dowodzi, że zamiast tego renderuje się karta i ŻADEN wiersz w kanonicznym `ie_aggregate_state` nie powstaje przed kliknięciem zgody.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*` — ŻADNEJ nie zmieniasz. ★★ DODATKOWO, WŁAŚCIWE TEJ POZYCJI: `deps.authorize(actor, projectId, 'initiative.create')` i `deps.reader.isEligibleInitiativeOwner(organizationId, projectId, initiativeOwnerId)` w `initiativesExecutionRuntime.routes.ts` (wzorzec zmierzony w trasie `/adoptions/accepted-classic`, `:1758-1770` — kolejność: authorize→403, potem isEligibleInitiativeOwner→422, potem `deps.resolvePolicy(...)`) — Twoja nowa trasa `POST /adoptions/chat-draft` MUSI wołać OBIE te same bramki, w tej samej kolejności; nie wymyślasz własnej autoryzacji. ★★ BRAMA ZATWIERDZENIA Z TESTEM OMIJAJĄCYM (`Z29`-analog, obowiązkowe): napisz test, w którym POMIJASZ klik zgody (wołasz `POST /adoptions/chat-draft` NIE wołając wcześniej karty/klik) na draft BEZ wypełnionego `owner`/`project` (stan `blocked`) — asercja MUSI być CZERWONA gdyby trasa i tak zmaterializowała wiersz w `ie_aggregate_state` (0 nowych wierszy jest oczekiwane; test dowodzi, że próba ZOSTAJE odrzucona, nie że `200` przyszedł z pustą kopertą). Drugi test omijający: dwa równoległe wywołania `POST /adoptions/chat-draft` tym samym `clientRequestId` na tym samym `chatInitiativeId` — advisory lock (wzorzec `pg_advisory_xact_lock`, `postgresMaterialCommandUnitOfWork.ts` ok. `:100-102` w metodzie `adoptAcceptedClassicInitiative`) MUSI dopuścić dokładnie JEDEN zapis do paragonu, nie dwa — mutuj (usuń lock/klucz idempotencji) → test musi zaczerwienić się, przywróć → zielony, oba wyniki i obie komendy w raporcie (`Z32`).`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY214_ADOPT_DRAFT_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — ten dyżur jest przekrojowy silnik+czat (Moduł 17), nie jeden moduł z tabeli WAVE_03_ACCEPTANCE. ★ Jedyny inny dokument do zmiany: `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` — DOPISUJESZ WYŁĄCZNIE nowy rozdział `Wykonanie — 17-D (Day214)` na KOŃCU pliku (numer ustalasz pomiarem: `grep -n '^## ' docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` — na Twoim marker plik kończy się na `## 10. Wykonanie — 17-B (Day206)`, więc Twój rozdział to najpewniej `## 11`, ale ZWERYFIKUJ SAM, bo dyżury 211-213/215-222 mogą dopisywać równolegle) i WYŁĄCZNIE odsyłacz w wierszu `P4` tabeli §3. ★★ ZAKAZ zmiany treści P1-P3, P5, §4, §6, §8, §9 i rozdziałów innych dyżurów (`## 9`, `## 10`) — to jest dokument ZAAKCEPTOWANY przez właściciela.. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day214-adopt-draft-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day214-adopt-draft-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE dotykasz ŻADNEGO pliku istniejącego łańcucha governance** — `registerInitiative.ts`, `submitSourceProposal.ts`, `definitionDecision.ts`, `analysisDecision.ts`, `portfolioDecision.ts`, `scheduleDecision.ts`, `handoffAcceptance.ts`, `definitionReadiness.ts`, `analysisReadiness.ts`. Twoja komenda `initiative.adopt-chat-draft` jest SIOSTRĄ `initiative.adopt-accepted-classic`, nie zmienia go, nie woła go, nie go rozszerza. ★★ **NIE modyfikujesz `adoptAcceptedClassicInitiative.ts`** — czytasz i naśladujesz w NOWYM pliku; SWOT-specyficzny JOIN (`swot_candidate_handoffs`+`tool_outputs`) zostaje SWOT-specyficzny, nie generalizujesz go pod dwa źródła naraz. ★★ **ZERO auto-uzupełniania `initiativeOwnerId`/`projectId` domyślną wartością** (np. aktorem klikającym adopcję) — to decyzja człowieka; brak → karta pokazuje „co brakuje” i kieruje do ISTNIEJĄCEGO dokumentu inicjatywy, nie zgaduje. ★★ **NIE resurektujesz `InitiativeDraftJourney.tsx`** do renderowania — martwy celowo. Twoja karta żyje WYŁĄCZNIE w czacie. ★★ **NIE wołasz `initiative.register`/`source-proposal.submit` bezpośrednio** z nowej trasy — most jest PRZEZ nową komendę adopcji, wzorem bezpośredniego mostu SWOT, omijając content-match trap `registerInitiative`. ★★ **Karta czatu NIE automatyzuje żadnej zgody governance poza samym wejściem do kanonu** — definicja/analiza/portfel/harmonogram/handoff zostają w 100% ręczne przez istniejące ekrany; karta po udanej adopcji WYŁĄCZNIE nawiguje tam, nie wykonuje kolejnego kroku sama. ★★ **ZAKAZ BUDOWY PIĄTEGO MECHANIZMU PROPOZYCJI ARTEFAKTÓW** — jeśli w trakcie pracy skusi Cię reużycie `chatHandoffService`/`TARGET_KINDS` przez poszerzenie zamkniętej listy o `initiative` — to jest ZAKAZANE (zmiana kontraktu między pasami 179/195, poza licencją tego dyżuru); Twój most jest odrębny, przez `initiatives-execution/`, nie przez `artifactHandoff/`. ★★ **Nie zmieniasz wartości domyślnej `ENABLE_TERESA_RECORD_CREATE` ani żadnej innej istniejącej flagi.** ★★ **`aiActionExecutor.ts` MA `// @ts-nocheck`** w pierwszej linii — jeśli w ogóle go dotykasz (nie powinieneś — patrz tabela licencji), typy Cię nie osłonią, odnotuj to jako ryzyko. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji** (`Z28`). ★★ **`Z31` — zakaz pinowania strażnika realdb do hosta/portu/nazwy bazy** — `await assertRealPostgresTestEnvironment()` BEZ argumentów. ★★ **`Z29`-analog dla bramy zgody: dowód mutacyjny w obie strony, per ogniwo** (flaga OFF→zachowanie dzisiejsze; flaga ON+brak zgody→zero mutacji w `ie_aggregate_state`; klik zgody→dokładnie jeden wiersz; podwójny klik→nadal jeden). ★ **Migracja WYŁĄCZNIE addytywna, w przedziale `20261900`-`20261909`** — zweryfikuj pustkę SAM (`ls server/migrations | grep -E '^202619'`), nie ufaj ślepo tej instrukcji (dyżury 211-213/215-222 piszą równolegle, mogą sięgnąć w pobliże). | ★★ HISTORIA, KTÓRĄ MUSISZ ZNAĆ PRZED STARTEM: ten dyżur był już RAZ wydany jako **208** (`docs/program/funkcje/LISTA_DYZUROW_211_222.md`, sekcja FALA B: „214 · 208 ponownie — adopt-chat-draft (17-D). Jedyny dyżur, który nie wrócił wcale (brak gałęzi, zero commitów)”). Zmierzone przeze mnie NIEZALEŻNIE, żebyś nie musiał wierzyć na słowo: `git branch -a | grep day208` POKAZUJE gałąź `codex/day208-inicjatywa-handoff-20260831` — ale `git log --oneline codex/m03-admin-20260824..codex/day208-inicjatywa-handoff-20260831` zwraca WYŁĄCZNIE cudze commity dokumentacyjne z linii integracyjnej (`docs(codex): dyzur XXX wydany`, w tym sam commit wydania 208/209 `15c7a68b9d`) — ANI JEDNEGO commitu z realną pracą tego dyżuru (kod/testy/migrację). `git log --all --oneline | grep -i day208` daje TYLKO ten sam jeden commit wydania. Wcześniej doszło do POMYŁKI NADZORCY: pierwotny marker `e96e003abd` wskazywał commit LOKALNY toru grafiki, nigdy niewypchnięty na `github-backup` — wykonawca słusznie zgłosiłby `MARKER BRAK`. Marker poprawiono commitem `529c12a707` („marker 208/209 poprawiony na TIP ZDALNY 29f004c670”), ale i tak nikt nie zaczął. **Ten dyżur zaczyna OD ZERA — nie wznawiasz niczyjej pracy, nie szukasz jej na żadnej gałęzi `codex/day208-*`, nie zakładaj że cokolwiek z poprzedniego podejścia jest w kodzie.** Jedyny ślad poprzedniej próby to DOKUMENT instrukcji w scratchu nadzorcy (nie w repo produktu) — ten dyżur go WYKORZYSTUJE jako zweryfikowany PUNKT WYJŚCIA (wszystkie cytowane linie sprawdziłem PONOWNIE na SWOIM marker `fe33ce8036` i są nadal trafne — kod w tych plikach nie ruszył się między `e96e003abd` a `fe33ce8036`), ale poprawia DWIE rzeczy, które poprzednie podejście zrobiło źle (patrz POZYCJE_Z_FLAGAMI: brak własnej flagi wizualnej) i doprecyzowuje lokalizację testów (patrz TRASY_TYL: `server/src/domain/initiatives-execution/__tests__/` nie istnieje jako katalog testów tej rodziny komend — prawdziwa lokalizacja to `tests/integration/initiatives-execution/` i `tests/unit/initiatives-execution/`, zmierzone `find`). ★★ KONTRAKT MERYTORYCZNY: `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §3, wiersz P4: „Inicjatywa z czatu = sierota — draft bez wołania registerInitiative→handoff→execution_case”, stan `zerwane`, ruch nazwany wprost: „opcjonalny krok »przekaż do realizacji« za zgodą (łańcuch z planu migracji A4.0)”; §7: „17-D inicjatywa→handoff (P4)”. ★★ ODKRYCIE, KTÓRE ZMIENIA KSZTAŁT TEGO DYŻURU: zamówienie sugerowało szukać mostu w `chatHandoffService`/`chatTargetMappingService`/`handoffSpineService`/`TARGET_KINDS`/`dynamicSwot` — ZMIERZONE I OBALONE: to jest most WIADOMOŚĆ CZATU→ARTEFAKT (`document`/`presentation`/`workbook`/`material`, `TARGET_KINDS` zamknięte, `handoffSpineService.ts:49-50`), bez `initiative` w ogóle, i nie ma nic wspólnego z SWOT poza tym, że OBA mechanizmy istnieją w tym samym module 17. ★★ PRAWDZIWY, DZIAŁAJĄCY (choć bez wołacza produkcyjnego) most-siostra, z którego BUDUJESZ PRZEZ ANALOGIĘ: `server/src/domain/initiatives-execution/adoptAcceptedClassicInitiative.ts` + trasa `POST /adoptions/accepted-classic` — komenda materialna, która bierze ISTNIEJĄCY zaakceptowany kandydat SWOT (`initiative_candidates`+`swot_candidate_handoffs`+`tool_outputs`, `postgresMaterialCommandUnitOfWork.ts:90-150`) i wchodzi z nim BEZPOŚREDNIO do kanonicznego stanu `REGISTERED_DRAFT`, z pominięciem dwuetapowego `submit-proposal→register` i jego pułapki dopasowania treści (`registerInitiative.ts:80-95` wymaga identyczności `title`/`problem`/`proposedOutcome`/`projectId`/`visibility`/`initiativeOwnerId` z WCZEŚNIEJSZĄ propozycją, inaczej `MaterialCommandConflictError` — czatowy draft takiej propozycji nie ma, więc naiwne `initiative.register` PADA). ★★ CZY TO JEST »TEN SAM WRITER« CO MY WORK (lekcja z dyżuru 207 o `create_task` mającym DWIE różne implementacje w DWÓCH rejestrach)? ZMIERZONE I DOBRA WIADOMOŚĆ — TAK, na poziomie klasycznej tabeli `initiatives`: `initiativeGenerationService.createInitiative` (`:1451+`, wołany przez narzędzie czatu `generate_initiative`) WEWNĘTRZNIE importuje i woła `funnelCreateInitiative` z `createInitiativeService.js` (`initiativeGenerationService.ts:24` — `import { createInitiative as funnelCreateInitiative } from './initiative/createInitiativeService.js'`), TEN SAM writer, którego używa `initiativeCandidateService.acceptCandidate` (droga SWOT/interview/assessment/finance/org-snapshot/idea-process-flow) i wizard (`InitiativeController.createInitiative`). Komentarz w samym `createInitiativeService.ts` (`:245-251`) nazywa to wprost: „THE single canonical creation funnel (F1.1 — replaces ~23 formerly scattered INSERTs) … covers wizard, Teresa handoff, candidate accept, report/assessment import, onboarding … in one place”. Czyli w OD RAZU: draft z czatu i inicjatywa z wizarda już dziś lądują w tej samej tabeli tym samym writerem — nie ma tu kolizji dwóch implementacji jak przy `create_task`. ALE — i to jest SEDNO tego dyżuru — klasyczna tabela `initiatives` to NIE to samo co kanoniczny magazyn wykonawczy `ie_aggregate_state`/`REGISTERED_DRAFT` (world z dyżuru 204: `REGISTERED_DRAFT→DEFINED→ANALYZING→READY_FOR_DECISION→APPROVED_BACKLOG→SCHEDULED→IN_EXECUTION`), do którego draft czatowy NIGDY nie trafia bez tej pozycji. ★ Drugie zmierzone ograniczenie provenance: `ai.routes.ts` przekazuje `context.conversationId` do narzędzia (blok `deliverableTools.context`), ale `generateInitiative()` NIGDY go nie czyta — `sourceType` to zawsze stała `'teresa_chat'`, `sourceId` domyślnie SAMOREFERENCYJNY (id inicjatywy), więc „z której rozmowy” NIE jest dziś zapisywane nigdzie, mimo że dane są pod ręką. Trzecie zmierzone: `createInitiativeService.ts` INSERT (`:316-334`) MA kolumny `owner_business_id`/`owner_execution_id`, ale `generateInitiative.ts` NIGDY ich nie przekazuje — każdy draft czatowy jest DZIŚ bez właściciela. To NIE jest coś do naprawienia w tej pozycji — to jest fakt, który karta czatu MUSI pokazać uczciwie jako „co brakuje”, zanim zaproponuje adopcję (właściciel i projekt to decyzja CZŁOWIEKA — zakaz zgadywania domyślną wartością, w duchu ostrzeżenia `selfApprovalAllowed` z dyżuru 204). ★★ CZY ADOPCJA MA IŚĆ PRZEZ CYKL `ai_actions` Z DYŻURU 207? ZMIERZONE: NIE — `requestAction` (`aiActionExecutor.ts:295`) na TWOIM marker `fe33ce8036` WCIĄŻ ma zero wołaczy produkcyjnych (dyżur 207 jest na tej bazie WYŁĄCZNIE commitem `wip(day207): stan przerwany okna Codexa … NIEZWERYFIKOWANA` — nie wszedł). Nie buduj na nim i nie czekaj na niego: TWOJA własna para bramek trasy (`authorize`+`isEligibleInitiativeOwner`) + klik karty w czacie JEST kompletną, samodzielną bramką zgody dla tej pozycji. |

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
cd /private/tmp/cx-day214-adopt-draft

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day214-pg psql -U postgres -d cx214 \
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
cd /private/tmp/cx-day214-adopt-draft

docker run -d --name cx-day214-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx214 \
  -p 127.0.0.1:6154:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day214-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6154/cx214 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6154/cx214 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day214-adopt-draft && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6154/cx214 \
JWT_SECRET=cx214-test-secret-do-not-reuse \
npx vitest run tests/integration/initiatives-execution tests/unit/initiatives-execution server/src/routes/pmo/__tests__ src/components/AIChat/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day214-adopt-draft-artefakty/day214-adopt-chat-draft.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day214-adopt-draft && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/integration/initiatives-execution tests/unit/initiatives-execution server/src/routes/pmo/__tests__ src/components/AIChat/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day214-adopt-draft-artefakty/day214-adopt-chat-draft.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day214-adopt-draft/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day214-pg psql -U postgres -d cx214 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day214-pg`.
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
> **(e) ★★ **Pierwsza: naiwne „po prostu wywołaj registerInitiative” nie zadziała.** Wymaga PRZED-ISTNIEJĄCEJ propozycji źródłowej z dokładnym dopasowaniem treści (`registerInitiative.ts:80-95`) — draft czatowy jej nie ma. Poprawny wzorzec to most BEZPOŚREDNI (jak `adoptAcceptedClassicInitiative`), nie dwuetapowy submit→register. ★★ **Druga: `initiativeOwnerId`/`projectId` są PUSTE dla każdego draftu czatowego Z DEFINICJI dzisiejszego kodu** — to nie usterka do naprawienia tutaj, to fakt architektury, który karta MUSI pokazać jako „co brakuje” ZANIM zaproponuje adopcję. Pokusa wypełnienia ich domyślną wartością jest ZAKAZANA (patrz `selfApprovalAllowed` z dyżuru 204 — autorytet nie może być zgadywany za człowieka). ★★ **Trzecia: `chatHandoffService`/`TARGET_KINDS` to PUŁAPKA NAZEWNICZA, nie wzorzec.** Nazwa „handoff” i obecność w tym samym module 17 sugerują pokrewieństwo, ale kontrakt (`TARGET_KINDS` zamknięte do artefaktów) wyklucza `initiative` z definicji — jeśli spędzisz czas próbując „dociągnąć” inicjatywę do tego mostu, to jest strata; właściwy wzorzec żyje gdzie indziej (`initiatives-execution/`). ★★ **Czwarta: `context.conversationId` ISTNIEJE na ToolContext, ale `generateInitiative()` go nie czyta** — pokusa „szybkiej naprawy przy okazji” (podłączenia conversationId do `sourceId`) jest ZAKAZANA w TYM dyżurze bez flagi: to zmiana dzisiejszego zachowania `generate_initiative` (Z10/Z11); jeśli chcesz to naprawić, rób to WEWNĄTRZ nowej ścieżki za `ENABLE_TERESA_ADOPT_CHAT_DRAFT` (np. Twoja nowa komenda pinuje `conversationId` we WŁASNYM paragonie), nie w `generateInitiative.ts` bezwarunkowo. ★★ **Piąta: zero testów istniejących dla wzorca `adoptAcceptedClassicInitiative`** — nie znajdziesz gotowej struktury w `server/src/domain/initiatives-execution/__tests__/` (ten katalog ma testy INNEJ rodziny — `capacityOptionsAdvisor`/`planSolver`/`reportReconstruction`, nie `adopt*`); prawdziwy wzorzec struktury bierzesz z `tests/integration/initiatives-execution/registerInitiative.realdb.test.ts` (Postgres realny, `pg.Pool`, `describe.skip` bez `DATABASE_URL`). ★★ **Szósta: readiness endpoints 404-ują PRZED rejestracją** — karta czatu NIE MOŻE pokazać „8/10 kart” jako pierwszego ekranu; kolejność jest: (a) braki pre-adopcyjne z samego wiersza `initiatives` (owner/project/problem) → (b) jeśli OK, propozycja adopcji → (c) po adopcji nawigacja do dokumentu, gdzie DOPIERO `GateReadinessSection` pokaże realne braki definicji/analizy. ★★ **Siódma: harness `dev-render` nie montuje realnego `UnifiedChatPanel`/`MessageRenderer`.** `dev-render/screens/chat-split-teresa-right.tsx` mówi w nagłówku WPROST: „Realny `<UnifiedChatPanel>` ciągnie store/API/logowanie i nie zmontuje się w harnessie, więc TREŚĆ jest mockowana”. Zrzut zamockowanej powłoki NIE JEST dowodem renderu Twojej nowej karty. Zmierz, czy to nadal prawda (jest — sprawdziłem nagłówek na Twoim marker), i zbuduj zrzut inaczej: albo (i) osobny dev-render ekran, który montuje TYLKO `GovernedInitiativeHandoffCard` (jak realny komponent, nie atrapa) zasilony propsami w KSZTAŁCIE realnej odpowiedzi `POST /adoptions/chat-draft` — i w raporcie piszesz WPROST, że dane pochodzą z propsów w harnessie, nie z realnego przebiegu; albo (ii) realny przebieg HTTP + zrzut przeglądarki uruchomionej przez `scripts/dev/start-wave3-owner-runtime.mjs` (protokół `§0.2b` (4), z pełnym dowodem braku SMTP). Wybierz i napisz to jednym zdaniem w raporcie — atrapa powłoki bez tego zdania NIE JEST dowodem.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day214-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day214-adopt-draft-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`Jedna pozycja R1 (przekrojowa, nie dziel: most `draft→REGISTERED_DRAFT` i karta zgody w czacie to jeden nierozdzielny łańcuch dowodowy — bez trasy karta nie ma czego wołać, bez karty trasa nie ma wołacza produkcyjnego). Kroki: (1) nowa komenda materialna `initiative.adopt-chat-draft` w NOWYM pliku `adoptChatDraftInitiative.ts`, siostra `adoptAcceptedClassicInitiative.ts` (INNY JOIN — plain `initiatives` z `source_type='teresa_chat'`, BEZ `swot_candidate_handoffs`/`tool_outputs`); (2) nowa metoda transakcji w `postgresMaterialCommandUnitOfWork.ts`, wzorem `:90-150`; (3) nowa trasa `POST /adoptions/chat-draft` obok `:1750-1808`, te same dwie bramki w tej samej kolejności; (4) nowa migracja addytywna paragonu append-only (zakres `20261900`-`20261909`), wzorem dosłownym `20261061_flow_accepted_classic_runtime_adoption.sql` (trigger walidujący graf tożsamości PRZED INSERT, trigger blokujący UPDATE/DELETE); (5) nowa flaga `ENABLE_TERESA_ADOPT_CHAT_DRAFT` w `FeatureFlags.ts` (schema `:34`-wzorem, load `:149`-wzorem), default OFF; (6) nowa karta czatu `GovernedInitiativeHandoffCard.tsx`, wzorem `GovernedChatHandoffCard.tsx`, stany `idle→checking→blocked|ready→adopting→adopted|failed`; (7) podmiana gałęzi `payloadKind==='initiative'` w `UnifiedChatPanel.tsx` (`:2219-2237`) ZA FLAGĄ — przy OFF bez zmian, przy ON karta zamiast auto-navigate; (8) sprawdzenie braków pre-adopcyjnych (owner/project/problem) — NAJPIERW sprawdź, czy istniejący endpoint odczytu inicjatywy już zwraca `owner_business_id`/`owner_execution_id`/`project_id`/`problem_statement`, licz braki po stronie frontu z TEJ odpowiedzi; jeśli nie zwraca — nazwij to w raporcie jako „wymaga doprecyzowania”, nie buduj nowego GET bez sprawdzenia. Dowód: (a) OFF→zero regresji `generate_initiative` (auto-navigate identyczne jak dziś, zasercjonowane, nie założone); (b) draft z pustym ownerem/projektem → karta `blocked`, ZERO wywołania `/adoptions/chat-draft`, ZERO wiersza w `ie_aggregate_state`; (c) braki uzupełnione (test ustawia je bezpośrednio w bazie) → klik zgody woła trasę, tworzy DOKŁADNIE JEDEN wiersz paragonu i DOKŁADNIE JEDEN agregat `initiative` w stanie `REGISTERED_DRAFT` (dowód: `deps.reader.findById` ZNAJDUJE go — wcześniej `404`); (d) `GET .../gates/definition/readiness` PO adopcji zwraca realną listę braków, nie `404`; (e) podwójny klik/powtórzone wywołanie tym samym `clientRequestId` NIE tworzy drugiego wiersza (idempotencja, dowód mutacyjny w obie strony).`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6154` albo `5098 i 5099` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6154` albo `5098 i 5099`** (`Z7`).

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

## 1.1. Ten dyżur już raz nie wrócił — czytaj to zanim zaczniesz

To jest **WYDANIE PONOWNE** dyżuru wydanego wcześniej jako **208**. Zapisane
wprost w planie fali, `docs/program/funkcje/LISTA_DYZUROW_211_222.md`, sekcja
FALA B: *„214 · 208 ponownie — adopt-chat-draft (17-D). Jedyny dyżur, który
nie wrócił wcale (brak gałęzi, zero commitów)."*

Zmierzone niezależnie, żebyś nie musiał wierzyć nadzorcy na słowo:

```bash
git branch -a | grep -i day208
# → codex/day208-inicjatywa-handoff-20260831   (gałąź ISTNIEJE)

git log --oneline codex/m03-admin-20260824..codex/day208-inicjatywa-handoff-20260831 \
  | grep -v "docs(codex): dyzur"
# → PUSTO — zero commitów z realną pracą (kod/testy/migracja)
```

Gałąź istnieje, ale jej HEAD to zwykły commit dokumentacyjny z linii
integracyjnej (`15c7a68b9d`, wydanie instrukcji 208/209) — nikt na niej nigdy
nie pracował. Wcześniej doszło też do pomyłki nadzorcy: pierwotny marker
`e96e003abd` wskazywał commit **lokalny** toru grafiki, nigdy niewypchnięty na
`github-backup` — właściwy wykonawca zgłosiłby tu `MARKER BRAK` i słusznie by
stanął. Marker poprawiono kommitem `529c12a707` na TIP zdalny `29f004c670`, ale
i tak nikt nie zaczął pracy.

**Wniosek dla Ciebie: nie wznawiasz niczyjej pracy. Nie szukasz kodu na
żadnej gałęzi `codex/day208-*`. Zaczynasz od zera**, na SWOIM markerze
`fe33ce8036` i SWOJEJ gałęzi `codex/day214-adopt-draft-20260831`.

Jedyne, co PRZETRWAŁO z próby 208, to dokument instrukcji leżący w scratchu
nadzorcy (nie w repozytorium produktu) — ta instrukcja go **wykorzystuje jako
zweryfikowany punkt wyjścia**: każdą cytowaną w nim linię sprawdziłem PONOWNIE
na marker `fe33ce8036` (kod w cytowanych plikach nie ruszył się między
`e96e003abd` a `fe33ce8036` — sprawdzone bezpośrednio, nie założone) i
poprawiłem w niej dwie rzeczy, które poprzednie podejście zrobiło źle: brak
własnej flagi wizualnej (sekcja 1.4 niżej) i błędną lokalizację katalogu
testów (sekcja 1.3).

## 1.2. Kontrakt merytoryczny — architektura modułu 17, pozycja P4

`docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §3, wiersz `P4`:

> **„Inicjatywa z czatu = sierota — draft bez wołania
> registerInitiative→handoff→execution_case"**, stan `zerwane`, ruch: *„opcjonalny
> krok »przekaż do realizacji« za zgodą (łańcuch z planu migracji A4.0)"*.

§7 (plan dyżurów modułu 17) nazywa tę pozycję wprost: *„17-D
inicjatywa→handoff (P4)"*.

Zmierzone dziś (marker `fe33ce8036`): narzędzie czatu `generate_initiative`
(`server/src/services/ai/tools/generateInitiative.ts`, nagłówek linie 4-9:
*„no approval gate, because a draft is fully reversible and never
promotes"*) tworzy DRAFT w tabeli `initiatives` — realny wiersz, nie atrapa —
i front (`UnifiedChatPanel.tsx`, gałąź `payloadKind === 'initiative'`, linie
2219-2237) reaguje wyłącznie deep-linkiem
`/initiatives?open=<id>&mode=doc` + toastem *„Initiative created from
chat"*. **Zero bramki zgody, zero wzmianki o governance.** Kanoniczny
lifecycle inicjatywy (zmierzony w dyżurze 204): `REGISTERED_DRAFT → DEFINED →
ANALYZING → READY_FOR_DECISION → APPROVED_BACKLOG → SCHEDULED →
IN_EXECUTION`, każde przejście przez osobną komendę materialną w
`server/src/domain/initiatives-execution/`. Draft czatowy jest poza tym
światem całkowicie: `registerInitiative.ts` (linie 80-95) wymaga
PRZED-ISTNIEJĄCEJ propozycji źródłowej w `initiative_candidates`
(`status='pending'`, `evidenceState='READY'`, `duplicateState='CLEAR'`) ORAZ
dokładnej zgodności treści (`title`/`problem`/`proposedOutcome`/`projectId`/
`visibility`/`initiativeOwnerId` identyczne z propozycją — inaczej
`MaterialCommandConflictError`). Draft czatowy takiej propozycji nie ma.
Naiwne wywołanie `initiative.register` **padnie**.

## 1.3. Obalenie tropu zamówienia — `chatHandoffService`/`TARGET_KINDS` to ZŁY most

Zamówienie tego dyżuru sugerowało szukać „mostu-siostry" wśród
`chatHandoffService`, `chatTargetMappingService`, `handoffSpineService`,
`materializeClaimedChatTarget`, `TARGET_KINDS`, `dynamicSwot`. **Zmierzone i
obalone.**

`TARGET_KINDS` (`server/src/services/artifactHandoff/handoffSpineService.ts:49-50`):

```ts
export const TARGET_KINDS = ['document', 'presentation', 'workbook', 'material'] as const;
```

Zamknięta lista **artefaktów**. Bez `initiative`, bez `task`, bez `decision`
(niezależnie potwierdzone przez dyżur 207, ustalenie K4). Mechanizm
`chatHandoffService`/`chatTargetMappingService.materializeClaimedChatTarget`
pinuje **bajty WIADOMOŚCI czatu** i materializuje **dokument/prezentację/
arkusz** — to jest most **WIADOMOŚĆ → ARTEFAKT**, strukturalnie inny problem
niż ten, który masz rozwiązać (**WYWOŁANIE NARZĘDZIA → REKORD KANONICZNY**).
`dynamicSwot` (`src/config/swot/`, `src/toolPacks/packs/dynamicSwot.pack.ts`)
to config narzędzia Discovery Tools SWOT — jego sekcja `library.outcome` mówi
wprost, że SWOT produkuje *„kandydatów na inicjatywy"*, ale sam ten plik nie
ma żadnego mostu adopcyjnego; to opis narzędzia, nie kod bramy.

**Właściwy, zmierzony most-siostra** — ten, który naprawdę robi to, co Ty
masz zrobić, dla jednego, konkretnego źródła — to
`server/src/domain/initiatives-execution/adoptAcceptedClassicInitiative.ts`
+ trasa `POST /adoptions/accepted-classic`
(`initiativesExecutionRuntime.routes.ts:1750-1808`). Kontrakt tego mostu,
zmierzony w całości:

```ts
export type AdoptAcceptedClassicPayload = {
  candidateId: string;
  projectId: string;
  initiativeOwnerId: string;
  visibility: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
};
```

(`adoptAcceptedClassicInitiative.ts:9-13`). Funkcja (`:16-38`) sprawdza
`envelope.commandType === 'initiative.adopt-accepted-classic'`, woła
`executeMaterialCommand(unitOfWork, envelope, tx => tx.adoptAcceptedClassicInitiative(...))`
i zwraca stan `{ lifecycleState: 'REGISTERED_DRAFT', source: { sourceType:
'accepted_classic_swot_candidate', ... } }` — `sourceType` jest DOSŁOWNIE
zaszyty w kodzie jako `'accepted_classic_swot_candidate'`, dowód że ten most
jest **jawnie SWOT-owy**, nie generyczny. Trasa
(`initiativesExecutionRuntime.routes.ts:1750-1808`, Zod
`AdoptAcceptedClassicSchema` na `:178`) woła DWIE bramki w tej kolejności:
`deps.authorize(actor, projectId, 'initiative.create')` → `403
CAPABILITY_REQUIRED`, potem `deps.reader.isEligibleInitiativeOwner(...)` →
`422 INITIATIVE_OWNER_INELIGIBLE`. Transakcja
(`postgresMaterialCommandUnitOfWork.ts:90-150`, metoda
`adoptAcceptedClassicInitiative`) robi JOIN `initiative_candidates` +
`swot_candidate_handoffs` + `tool_outputs`, wymagając `c.status='accepted'`
oraz `o.status='approved'`. Paragon jest w osobnej, append-only tabeli
(`server/migrations/20261061_flow_accepted_classic_runtime_adoption.sql`):
trigger `BEFORE INSERT` waliduje CAŁY graf tożsamości powtórnym JOIN-em
identycznym z transakcją, trigger `BEFORE UPDATE OR DELETE` bezwarunkowo
rzuca wyjątkiem — tabela jest nietykalna po zapisie.

**Ten most ma zero testów w całym repozytorium** — zmierzone:

```bash
find . -iname "*adoptAcceptedClassic*test*"
# → PUSTO
```

Jesteś pierwszą osobą, która go testuje. Wzorca STRUKTURY testu (nie samego
mostu) bierzesz z sąsiedniej rodziny komend materialnych, która testy MA:
`tests/integration/initiatives-execution/registerInitiative.realdb.test.ts`
(Postgres realny przez `pg.Pool`, `PostgresMaterialCommandUnitOfWork`,
`describe.skip` gdy brak `DATABASE_URL`) i
`tests/unit/initiatives-execution/materialCommand.test.ts`. **Nie** w
`server/src/domain/initiatives-execution/__tests__/` — ten katalog istnieje,
ale ma testy zupełnie innej rodziny (`capacityOptionsAdvisor`,
`planSolver`, `reportReconstruction`) — pierwsze podejście (208) błędnie
zakładało, że to właściwy katalog; nie zakładaj tego samego.

## 1.4. Czy to „ten sam writer" co reszta produktu? Dobra wiadomość — na poziomie klasycznej tabeli TAK

Dyżur 207 nauczył program kosztownej lekcji: `create_task` z czatu i
`create_task` z planu to DWIE różne implementacje w DWÓCH rejestrach —
klasyczna pułapka „naprawa per-wywołanie odrasta" (patrz notatka o tej samej
nazwie w repozytorium wiedzy). Zanim zbudujesz cokolwiek, sprawdziłem, czy
inicjatywy mają tę samą chorobę. **Zmierzone: NIE, na poziomie klasycznej
tabeli `initiatives`.**

`initiativeGenerationService.createInitiative` (`:1451+`, wołany przez
narzędzie czatu `generate_initiative`) **wewnętrznie importuje i woła**
`funnelCreateInitiative` z `createInitiativeService.js`:

```ts
// initiativeGenerationService.ts:24
import { createInitiative as funnelCreateInitiative } from './initiative/createInitiativeService.js';
```

To jest **DOKŁADNIE TEN SAM writer**, którego używa
`initiativeCandidateService.acceptCandidate` (droga SWOT/interview/
assessment/finance/organization-snapshot/idea-process-flow — sześciu
udokumentowanych sióstr wołających `createCandidateFromSource`) oraz wizard
(`InitiativeController.createInitiative`). Sam plik `createInitiativeService.ts`
nazywa siebie wprost w komentarzu (linie 245-251):

> *„THE single canonical creation funnel (F1.1 — replaces ~23 formerly
> scattered INSERTs) … covers wizard, Teresa handoff, candidate accept,
> report/assessment import, onboarding … in one place."*

Czyli: draft z czatu i inicjatywa z wizarda **już dziś lądują w tej samej
tabeli, tym samym writerem**. Nie ma tu kolizji dwóch implementacji jak przy
`create_task` w dyżurze 207 — **to jest ustalenie do potwierdzenia w Twoim
raporcie, nie do ponownego odkrywania**.

**Ale to nie jest cała odpowiedź.** Klasyczna tabela `initiatives` to NIE to
samo co kanoniczny magazyn wykonawczy `ie_aggregate_state`/`REGISTERED_DRAFT`
z dyżuru 204. Draft czatowy trafia dziś do PIERWSZEGO świata (writer
wspólny), ale nigdy do DRUGIEGO (writer zerowy — sekcja 1.2). **To jest luka,
którą ten dyżur zamyka: most z pierwszego świata do drugiego, nie naprawa
writer-a w pierwszym.**

Drugie zmierzone ograniczenie, o innym kształcie niż writer-collision:
`server/src/routes/ai.routes.ts` przekazuje `context.conversationId` do
narzędzia (blok `deliverableTools.context`, pole `conversationId:
conversationId || null`), ale `generateInitiative()` **nigdy go nie czyta**
— `sourceType` domyślnie to stała `'teresa_chat'` (linia 294), `sourceId`
domyślnie to **sam identyfikator tworzonej inicjatywy** (samoreferencja,
linia 296), gdy caller nic nie poda. Skutek: „z której rozmowy" NIE jest
dziś zapisywane NIGDZIE, mimo że dane leżą pod ręką na obiekcie kontekstu.
To nie jest usterka do naprawienia w `generateInitiative.ts` bezwarunkowo
(zmiana zachowania dzisiejszej, żywej ścieżki bez flagi — zakazane, `Z10`/
`Z11`) — to jest fakt, który Twoja NOWA, flagowana ścieżka adopcji ma
naprawić WE WŁASNYM paragonie (pinując `conversationId`/`messageId`, jeśli
je masz w momencie adopcji).

Trzecie zmierzone ograniczenie: `createInitiativeService.ts`, INSERT (linie
316-334), MA kolumny `owner_business_id`/`owner_execution_id` w schemacie —
ale `generateInitiative.ts` **nigdy** ich nie przekazuje. Każdy draft
czatowy jest dziś BEZ właściciela. To nie jest coś do naprawienia w tym
dyżurze; to jest fakt architektury, który Twoja karta czatu MUSI pokazać
uczciwie jako „co brakuje", ZANIM zaproponuje adopcję.

## 1.5. Czy adopcja ma iść przez cykl `ai_actions` z dyżuru 207?

Zamówienie każe sprawdzić, czy adopcja przechodzi przez ten sam cykl
`ai_actions` (propozycja→zatwierdzenie→wykonanie), który dyżur 207 miał
domknąć. **Zmierzone: NIE, i to jest poprawna odpowiedź, nie luka.**

```bash
grep -n "requestAction" server/src/services/aiActionExecutor.ts | head -3
# → :295  requestAction: async (...)
# → :544  const result = await AIActionExecutor.requestAction(...)   [wołacz WEWNĘTRZNY, createDraft]

git log --oneline --all | grep -i "day207"
# → c637cc2bde wip(day207): stan przerwany okna Codexa — ... NIEZWERYFIKOWANA
```

Na TWOIM markerze `fe33ce8036` dyżur 207 jest wyłącznie commitem `wip`
(„stan przerwany", „NIEZWERYFIKOWANA") — nie wszedł. `requestAction`
(`aiActionExecutor.ts:295`) nadal ma zero wołaczy produkcyjnych poza
`createDraft` w tym samym pliku. **Nie buduj na tym mechanizmie i nie czekaj
na niego.** Twoja własna para bramek trasy (`authorize` +
`isEligibleInitiativeOwner`, identyczna z `/adoptions/accepted-classic`) plus
klik w karcie czatu to KOMPLETNA, samodzielna bramka zgody dla tej pozycji —
budowa piątego/szóstego mechanizmu propozycji tylko po to, żeby „pasował do
207", byłaby stratą i złamaniem zasady jednego mostu na jedno zadanie.

## 1.6. Czwarta warstwa — pułapka renderu, którą MUSISZ obejść świadomie

`dev-render/screens/chat-split-teresa-right.tsx` (nagłówek, zmierzone na tym
markerze — pułapka wciąż żywa):

> *„Realny `<UnifiedChatPanel>` ciągnie store/API/logowanie i nie zmontuje
> się w harnessie, więc TREŚĆ jest mockowana."*

Zrzut zamockowanej powłoki **nie jest dowodem renderu** Twojej nowej karty
(`CLAUDE.md` §7: właściciel nigdy nie jest pierwszym testerem wizualnym —
zrzut robisz Ty, sam, i musi być prawdziwy). Co WOLNO uznać za dowód —
wybierz jedną z dwóch dróg i napisz to jednym zdaniem w raporcie:

1. **Dedykowany dev-render ekran, który montuje WYŁĄCZNIE
   `GovernedInitiativeHandoffCard`** (nie cały `UnifiedChatPanel`) jak
   realny komponent — bez mocka jego wnętrza — zasilony propsami w
   **kształcie realnej odpowiedzi** `POST /adoptions/chat-draft` (nie
   wymyślonymi polami). W raporcie piszesz wprost: dane pochodzą z propsów w
   harnessie, nie z realnego przebiegu.
2. **Realny przebieg HTTP + zrzut przeglądarki** uruchomionej przez
   kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, zgodnie z
   protokołem `§0.2b` (4) — z pełnym dowodem, że dostawca poczty jest atrapą
   (Twoja pozycja niczego nie wysyła, ale protokół obowiązuje przy każdym
   uruchomieniu pełnego runtime'u).

# 2. TEZY ZLECENIA

Rozkazy pomiarowe — każdą sprawdzasz sam na SWOIM markerze; obalenie
którejkolwiek jest sukcesem dyżuru, nie porażką.

- **T1.** Gałąź `codex/day208-inicjatywa-handoff-20260831` istnieje, ale
  zawiera ZERO commitów z realną pracą tego dyżuru — cały jej „unikalny"
  zakres wobec `codex/m03-admin-20260824` to cudze commity dokumentacyjne z
  linii integracyjnej.
- **T2.** `TARGET_KINDS` (`handoffSpineService.ts:49-50`) to zamknięta lista
  CZTERECH rodzajów artefaktów, bez `initiative` — mechanizm
  `chatHandoffService`/`chatTargetMappingService` jest ZŁYM wzorcem dla tej
  pozycji.
- **T3.** `adoptAcceptedClassicInitiative.ts` + `POST
  /adoptions/accepted-classic` to WŁAŚCIWY, zmierzony most-siostra — istnieje,
  działa (ma wołacza produkcyjnego w postaci trasy), ale jest jawnie
  SWOT-specyficzny (`sourceType: 'accepted_classic_swot_candidate'` zaszyte w
  kodzie) i ma ZERO testów w repozytorium.
- **T4.** `initiativeGenerationService.createInitiative` (writer za
  `generate_initiative`) i `initiativeCandidateService.acceptCandidate`
  (writer za SWOT/interview/…) używają TEGO SAMEGO ostatecznego writera —
  `createInitiativeService.createInitiative` — więc na poziomie klasycznej
  tabeli `initiatives` NIE MA kolizji dwóch implementacji.
- **T5.** Mimo T4, draft czatowy NIGDY nie trafia do kanonicznego
  `ie_aggregate_state`/`REGISTERED_DRAFT` — `registerInitiative.ts` wymaga
  przed-istniejącej, treściowo identycznej propozycji, której draft czatowy
  nie ma; naiwne `initiative.register` padnie.
- **T6.** `context.conversationId` jest dostarczany do narzędzia
  `generate_initiative` przez trasę czatu, ale `generateInitiative()` go nie
  czyta — proweniencja „z której rozmowy" nie jest dziś zapisywana nigdzie.
- **T7.** `createInitiativeService.ts` ma kolumny `owner_business_id`/
  `owner_execution_id` w INSERT-cie, ale `generateInitiative.ts` nigdy ich
  nie wypełnia — każdy draft czatowy jest dziś bez właściciela.
- **T8.** `requestAction`/`ai_actions` (dyżur 207) nie ma na tym markerze
  ŻADNEGO wołacza produkcyjnego (dyżur 207 jest tylko `wip`,
  NIEZWERYFIKOWANY) — ta pozycja buduje WŁASNĄ, samodzielną bramkę zgody,
  nie opiera się na 207.
- **T9.** `InitiativeDraftJourney.tsx` istnieje jako plik i eksport, ale ma
  zero realnych callerów w `src/` — jedyne trzy trafienia grepu poza samym
  plikiem to KOMENTARZE w `InitiativeDocumentView.tsx`, nie import/JSX.
- **T10.** Katalog `server/src/domain/initiatives-execution/__tests__/`
  istnieje, ale zawiera testy INNEJ rodziny komend — prawdziwym wzorcem
  struktury testu dla tej rodziny jest
  `tests/integration/initiatives-execution/*.realdb.test.ts`.
- **T11.** Harness `dev-render` nadal (zmierzone na tym markerze) nie
  montuje realnego `UnifiedChatPanel` — zrzut zamockowanej powłoki nie jest
  dowodem renderu.

# 3. POZYCJA DYŻURU (R1 — jedna, przekrojowa)

Most `draft→REGISTERED_DRAFT` i karta zgody w czacie to jeden nierozdzielny
łańcuch dowodowy: bez trasy karta nie ma czego wołać, bez karty trasa nie ma
wołacza produkcyjnego (dokładnie ten sam kształt „biblioteki bez wywołania",
który dyżury 206/207 znalazły gdzie indziej w tym module — nie powielaj go
tutaj).

## Krok 1 — nowa komenda materialna `initiative.adopt-chat-draft`

Nowy plik `server/src/domain/initiatives-execution/adoptChatDraftInitiative.ts`,
wzorem `adoptAcceptedClassicInitiative.ts` (przeczytaj go W CAŁOŚCI przed
pisaniem — struktura payloadu, walidacja `envelope.commandType`/
`createIfMissing`/`expectedVersion === 0`, wywołanie `executeMaterialCommand`,
kształt zwracanego stanu z `lifecycleState: 'REGISTERED_DRAFT'`).

Payload:

```ts
export type AdoptChatDraftPayload = {
  chatInitiativeId: string; // id wiersza w klasycznej `initiatives` (source_type='teresa_chat')
  projectId: string;
  initiativeOwnerId: string;
  visibility: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
};
```

Nowa metoda transakcji w `postgresMaterialCommandUnitOfWork.ts`, wzorem
`adoptAcceptedClassicInitiative` (linie 90-150 tego pliku jako referencja,
**nie do zmiany**) — ale **INNY JOIN**, bez `swot_candidate_handoffs`/
`tool_outputs`:

```sql
SELECT id, organization_id, project_id, title, problem_statement,
       source_type, source_id, owner_business_id, owner_execution_id
  FROM initiatives
 WHERE organization_id = $1 AND id = $2 AND source_type = 'teresa_chat'
   AND project_id IS NOT NULL
 FOR UPDATE
```

Jeśli `project_id`/tytuł/`problem_statement` puste lub `source_type !=
'teresa_chat'` → `MaterialCommandValidationError` z komunikatem nazywającym
KONKRETNY brak, nie ogólne „invalid". Advisory lock wzorem
`pg_advisory_xact_lock(hashtextextended($1, 0))` z kluczem
`${organizationId}:chat-draft:${chatInitiativeId}` (mirror wzorca, zapobiega
podwójnej adopcji tego samego draftu w wyścigu — patrz test omijający w §5).

Paragon append-only: NOWA migracja, zakres **`20261900`-`20261909`**
(zweryfikuj pustkę sam — `ls server/migrations | grep -E '^202619'`; dyżury
211-213/215-222 piszą równolegle), **wzorem dosłownym**
`20261061_flow_accepted_classic_runtime_adoption.sql` (przeczytaj go w
całości — kształt tabeli, trigger `BEFORE INSERT` walidujący graf
tożsamości, trigger `BEFORE UPDATE OR DELETE` blokujący, indeksy `UNIQUE`).
Nazwij tabelę `flow_teresa_chat_draft_adoptions`, kolumny analogiczne
(`receipt_id`, `chat_initiative_id`, `runtime_initiative_id`, `project_id`,
`adopted_by`, `adopted_at`, `policy_id`, `policy_version`,
`correlation_id`) — bez kolumn SWOT-specyficznych
(`swot_handoff_receipt_id`/`tool_output_id`/…), bo Twój most nie ma tego
źródła.

Zwracany stan: identyczny kształt do `adoptAcceptedClassicInitiative`
(`lifecycleState: 'REGISTERED_DRAFT'`, `source: {sourceType: 'teresa_chat',
sourceId: <chatInitiativeId>, freshness: 'CURRENT', ...}`, `governance:
{policyId, policyVersion}`, `readiness: 'NOT_EVALUATED'`) — front dostaje ten
sam kontrakt niezależnie od źródła adopcji.

`aggregateId` (initiativeId nowego kanonicznego agregatu) — **decyzja do
podjęcia przez Ciebie**: reużyj `chatInitiativeId` jako `aggregateId` (jedna
inicjatywa, jeden id, od draftu do kanonu) czy wygeneruj nowy? Wzorzec
`adopt-accepted-classic` generuje NOWY `aggregateId` (klasyczna inicjatywa i
kanoniczna to tam inne encje — SWOT-owy `candidateId` != `initiativeId`).
Dla czatowego draftu jest tylko JEDEN wiersz `initiatives` od początku do
końca — silny argument za reużyciem `chatInitiativeId`. Zanim zdecydujesz,
zweryfikuj, czy istnieje w kodzie założenie, że `initiatives.id` i
kanoniczny `initiativeId` nigdy nie są tym samym stringiem (grep po obu
magazynach) — zapisz wybór i uzasadnienie w raporcie.

## Krok 2 — nowa trasa `POST /adoptions/chat-draft`

W `initiativesExecutionRuntime.routes.ts`, tuż obok `/adoptions/accepted-
classic` (linie 1750-1808) — **wzorem dosłownym** tej trasy: ten sam styl
Zod (`AdoptChatDraftSchema`, wzorem `AdoptAcceptedClassicSchema` z linii
178), te same DWIE bramki w tej samej kolejności:

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
unitOfWork, {..., commandType: 'initiative.adopt-chat-draft',
createIfMissing: true, expectedVersion: 0})`.

## Krok 3 — flaga `ENABLE_TERESA_ADOPT_CHAT_DRAFT`, domyślnie OFF

★★ **Korekta wobec podejścia z próby 208.** Pierwsza wersja tej instrukcji
zakładała, że nie potrzeba żadnej flagi, bo „zgoda użytkownika (klik) JEST
bramką". To myli DWIE różne rzeczy: bramkę WYKONANIA (słusznie — klik
człowieka) z bramką WIDOCZNOŚCI NOWEGO EKRANU. `CLAUDE.md` §7/§9 i `Z10`/
`Z11` tej instrukcji mówią wprost: właściciel nigdy nie jest pierwszym
testerem wizualnym, nic nie wchodzi na demo bez akceptacji na CZYSTYM
zrzucie. Ta pozycja ZASTĘPUJE dzisiejsze zachowanie (auto-navigate + toast)
NOWYM EKRANEM (karta w dymku czatu) — to jest dokładnie klasa zmiany, którą
flaga musi osłaniać, niezależnie od tego, że akcja WEWNĄTRZ karty ma swoją
bramkę zgody.

Dwa miejsca do dopisania w `server/src/config/FeatureFlags.ts`: wpis w
`FeatureFlagsSchema` (wzorzec `ENABLE_TERESA_RETRIEVAL`, zmierzone `:34`,
`z.boolean().default(false)`) i wpis w bloku ładującym (wzorzec zmierzony
`:149`, `process.env.ENABLE_TERESA_RETRIEVAL === 'true'`).

**Przy OFF:** `payloadKind === 'initiative'` w `UnifiedChatPanel.tsx`
zachowuje się BAJT W BAJT jak dziś — auto-navigate + toast, ZERO renderu
nowej karty, ZERO wywołania nowej trasy. To jest osobna asercja w teście, nie
założenie.

**Przy ON:** zamiast auto-navigate renderuje się
`GovernedInitiativeHandoffCard`.

## Krok 4 — nowa karta czatu

Nowy plik `src/components/AIChat/GovernedInitiativeHandoffCard.tsx`, wzorem
`GovernedChatHandoffCard.tsx` (przeczytaj go w całości — interfejs
`GovernedChatHandoffCardProps` na `:15`, stany pochodne z `proposal.state`
na `:36-46`, styl karty, `data-testid` konwencja). Punkt wpięcia w
istniejącym moście do naśladowania: `MessageRenderer.tsx:1965-1970` —
`{msg.role === 'ai' && governedHandoff ? <GovernedChatHandoffCard
proposal={governedHandoff} .../> : ...}` — `governedHandoff` to pole NA
WIADOMOŚCI, nie globalny stan. Zmierz, skąd dokładnie to pole trafia na
wiadomość (store czatu w `UnifiedChatPanel.tsx`), zanim zaprojektujesz
analogiczne pole dla swojej karty — **nie zgaduj mechanizmu wstrzykiwania**.

Stany karty:
- `idle` — draft utworzony, karta pokazuje „Przekaż do realizacji?" z
  przyciskiem zgody (stan po zdarzeniu `onDeliverable` z `kind:
  'initiative'`, za flagą ON).
- `checking` — sprawdzenie pre-adopcyjnych braków.
- `blocked` — braki wykryte (brak ownera/projektu/treści problemu), CTA
  „Uzupełnij w module Initiatives" → nawiguje do
  `/initiatives?open=<id>&mode=doc` (ten sam deep-link co dziś), BEZ
  wywołania adopcji.
- `ready` → `adopting` → `adopted` — po zgodzie i braku blokad, wywołuje
  `POST /adoptions/chat-draft`, potem nawiguje do
  `/initiatives?open=<runtimeInitiativeId>&mode=doc`.
- `failed` — błąd adopcji (konflikt, walidacja) pokazany w karcie, bez
  automatycznego retry.

Sprawdzenie pre-adopcyjnych braków: **nie buduj nowego endpointu GET tylko
dla tego** — sprawdź NAJPIERW, czy istniejący endpoint pobierania inicjatywy
(ten, którego dziś używa `InitiativeDocumentView.tsx` przy otwarciu) już
zwraca `owner_business_id`/`owner_execution_id`/`project_id`/
`problem_statement` w payloadzie; jeśli tak, oblicz braki po stronie frontu
z tej samej odpowiedzi (zero nowego backendu na tym kroku). Jeśli NIE
zwraca — to jest pozycja do nazwania w raporcie jako „wymaga
doprecyzowania", nie do domyślnego budowania nowej trasy bez sprawdzenia.

Podmień gałąź `payloadKind === 'initiative'` w `UnifiedChatPanel.tsx` (linie
2219-2237), ZA FLAGĄ: przy OFF bez zmian; przy ON zamiast natychmiastowego
`navigateToRoute(...)` + toast, renderuj `GovernedInitiativeHandoffCard` w
wiadomości czatu. Toast „Initiative created from chat" może zostać
(informacja, że DRAFT powstał, prawdziwa niezależnie od flagi) — ale
nawigacja do modułu Initiatives przestaje być automatyczna PRZY ON; dzieje
się WYŁĄCZNIE po interakcji z kartą.

## Krok 5 — dowód, cztery ogniwa + brama omijająca

**Ukończone, gdy** test mutacyjny pokazuje:

1. **Flaga OFF → zero regresji.** `generate_initiative` nadal tworzy draft
   identycznie jak dziś; `payloadKind === 'initiative'` nadal auto-nawiguje
   + toastuje; ZERO renderu karty; ZERO wywołania `/adoptions/chat-draft`.
   Zasercjonowane, nie założone.
2. **Braki → `blocked`, zero mutacji.** Gdy draft ma pusty
   `owner_execution_id`/`project_id`, karta pokazuje stan `blocked` z
   konkretnymi brakami, BEZ wywołania `/adoptions/chat-draft`, BEZ wiersza w
   `ie_aggregate_state` (dowód: policz wiersze przed i po — `0 nowych`).
3. **Brama omijająca (`Z29`-analog).** Test, w którym POMIJASZ klik zgody i
   wołasz `POST /adoptions/chat-draft` na draft w stanie `blocked`
   (bez ownera/projektu) — próba MUSI zostać odrzucona (walidacja komendy),
   `0 nowych` wierszy w `ie_aggregate_state` i w tabeli paragonu. Mutuj
   walidację (usuń warunek `project_id IS NOT NULL` w JOIN-ie z Kroku 1) →
   test MUSI zaczerwienić się (zaczyna przepuszczać); przywróć → zielony.
   Oba wyniki i obie komendy w raporcie.
4. **Zgoda → dokładnie jeden zapis.** Gdy braki są uzupełnione (test ustawia
   je bezpośrednio w bazie, symulując że użytkownik uzupełnił je w
   dokumencie), klik zgody woła `/adoptions/chat-draft`, tworzy DOKŁADNIE
   JEDEN wiersz w `flow_teresa_chat_draft_adoptions` i DOKŁADNIE JEDEN
   agregat `initiative` w stanie `REGISTERED_DRAFT` (dowód:
   `deps.reader.findById` go teraz ZNAJDUJE — wcześniej `404`).
5. **Readiness po adopcji.** `GET /initiatives/:id/gates/definition/
   readiness` (linia 2284) PO adopcji zwraca prawdziwą listę braków (osiem
   kart), nie `404`.
6. **Idempotencja.** Podwójny klik zgody / powtórzone wywołanie z tym samym
   `clientRequestId` NIE tworzy drugiego wiersza w tabeli paragonu — advisory
   lock (wzorzec `pg_advisory_xact_lock`) MUSI dopuścić dokładnie JEDEN
   zapis. Mutuj (usuń lock) → test czerwony; przywróć → zielony (`Z32`, oba
   wyniki i obie komendy w raporcie).

**Test:** nowe pliki w `tests/integration/initiatives-execution/` (wzorem
`registerInitiative.realdb.test.ts` — Postgres realny, `pg.Pool`,
`describeRealDb = databaseUrl ? describe : describe.skip`) dla backendu i
trasy; nowy test frontowy
(`src/components/AIChat/__tests__/GovernedInitiativeHandoffCard.test.tsx`
lub rozszerzenie istniejącego testu `UnifiedChatPanel`) dla trzech stanów
karty (idle/blocked/ready) i dla zachowania przy fladze OFF.

# 4. TABELA LICENCJI PLIKOWEJ

| Zakres | Ścieżki |
|---|---|
| Zapis (nowy plik) | `server/src/domain/initiatives-execution/adoptChatDraftInitiative.ts` |
| Zapis | `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts` — wyłącznie NOWA metoda (wzorem `adoptAcceptedClassicInitiative`, linie 90-150 jako referencja, nie do zmiany) |
| Zapis | `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` — nowy import + nowy Zod schema + nowa trasa `POST /adoptions/chat-draft` (obok linii 1750-1808, bez zmiany istniejącej trasy) |
| Zapis (nowy plik) | `server/migrations/20261900_flow_teresa_chat_draft_adoption.sql` (zweryfikuj pustkę przedziału `20261900`-`20261909` sam przed użyciem) |
| Zapis | `server/src/config/FeatureFlags.ts` — WYŁĄCZNIE dodanie `ENABLE_TERESA_ADOPT_CHAT_DRAFT` (wpis w `FeatureFlagsSchema` wzorem `:34` + wpis w bloku ładującym wzorem `:149`). Zakaz zmiany wartości domyślnej jakiejkolwiek istniejącej flagi |
| Zapis (nowy plik) | `src/components/AIChat/GovernedInitiativeHandoffCard.tsx` |
| Zapis | `src/components/AIChat/UnifiedChatPanel.tsx` — wyłącznie gałąź `payloadKind === 'initiative'` (linie ok. 2219-2237), za flagą |
| Zapis | testy nowych plików: `tests/integration/initiatives-execution/**` (NOWE), `tests/unit/initiatives-execution/**` (NOWE jeśli potrzebne), `src/components/AIChat/__tests__/**`. Nowe pliki w `tests/` wymagają `git add -f` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY214_ADOPT_DRAFT_REPORT.md` |
| Zapis (ograniczony) | `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` — WYŁĄCZNIE nowy rozdział `Wykonanie — 17-D (Day214)` na końcu pliku (numer ustalasz pomiarem: `grep -n '^## ' ...`) + odsyłacz w wierszu `P4` tabeli §3. Zakaz zmiany treści P1-P3, P5, §4, §6, §8, §9 i rozdziałów innych dyżurów |
| Odczyt | `adoptAcceptedClassicInitiative.ts`, `20261061_flow_accepted_classic_runtime_adoption.sql`, trasa `/adoptions/accepted-classic` — wzorce; **nie zmieniasz** |
| Odczyt | `registerInitiative.ts`, `submitSourceProposal.ts`, `definitionDecision.ts`, `analysisDecision.ts`, `portfolioDecision.ts`, `scheduleDecision.ts`, `handoffAcceptance.ts`, `definitionReadiness.ts`, `analysisReadiness.ts` — istniejący łańcuch governance; **nie zmieniasz** |
| Odczyt | `server/src/services/ai/tools/generateInitiative.ts`, `initiativeGenerationService.ts`, `createInitiativeService.ts` — geneza draftu; **nie zmieniasz** (poza dodaniem flagi w `FeatureFlags.ts` opisanym wyżej) |
| Odczyt | `src/components/Initiatives/InitiativeDocumentView.tsx`, `InitiativeDraftJourney.tsx` — kontekst „następnej bramy"; **nie zmieniasz** |
| Odczyt | `src/components/AIChat/GovernedChatHandoffCard.tsx`, `src/components/AIChat/MessageRenderer.tsx` — wzorzec wizualny/strukturalny karty i punkt wpięcia; **nie zmieniasz** wzorca (dozwolony wyłącznie odczyt punktu wpięcia, jeśli decydujesz się analogicznie rozszerzyć `MessageRenderer.tsx` — jeśli tak, wpisz to jako ŚWIADOMĄ decyzję w raporcie, bo domyślnie ta ścieżka jest odczytowa) |
| Odczyt | `server/src/services/artifactHandoff/handoffSpineService.ts`, `server/src/services/chatHandoff/**` — obalony trop (sekcja 1.3); czytasz jako dowód, że to ZŁY wzorzec, nie modyfikujesz |
| Odczyt | `server/src/services/aiActionExecutor.ts` — kontekst `ai_actions`/207 (sekcja 1.5); **nie zmieniasz**. Plik ma `// @ts-nocheck` w pierwszej linii — jeśli mimo licencji odczytu okaże się, że coś w nim musisz zweryfikować, typy Cię nie osłonią |
| Odczyt | `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §3 P4, §7 — kontrakt tego dyżuru; **nie zmieniasz** (poza dopisaniem rozdziału jak wyżej) |
| Odczyt | `docs/program/funkcje/LISTA_DYZUROW_211_222.md` — kontekst historii/kolejności fali; **nie zmieniasz** |

★ **Rozłączność z dyżurami 211-213/215-222 (fala 211-222, mogą biec
równolegle):** ich dokładny zakres plikowy nie był znany przy składaniu tej
instrukcji (nie mają jeszcze wydanych instrukcji szczegółowych — plan fali
istnieje, instrukcje per-dyżur nie). Jeśli przy starcie zobaczysz w swoim
worktree zmiany poza plikami z tabeli powyżej, STOP i zgłoś w raporcie
zamiast zgadywać, zamiast automatycznie zakładać kolizję lub jej brak.

# 5. TWARDE ZASADY

- ★★ **Wzorzec `adoptAcceptedClassicInitiative.ts` czytasz, nie
  modyfikujesz.** Nowa komenda jest SIOSTRĄ, nie rozszerzeniem — SWOT-owy
  JOIN zostaje SWOT-owy.
- ★★ **Cała pozycja idzie za NOWĄ, WŁASNĄ flagą `ENABLE_TERESA_ADOPT_CHAT_DRAFT`,
  domyślnie OFF.** Przy OFF: `generate_initiative`/`payloadKind==='initiative'`
  bajt w bajt jak dziś. To jest korekta wobec pierwszego wydania (208), które
  tej flagi nie miało — patrz sekcja 3, Krok 3.
- ★★ **Zero domyślnego wypełniania `initiativeOwnerId`/`projectId`.** Braki
  pokazujesz w karcie, kierujesz do istniejącego ekranu — nie zgadujesz
  (duch ostrzeżenia `selfApprovalAllowed` z dyżuru 204).
- ★★ **Zero automatyzacji governance poza wejściem do kanonu.** Definicja,
  analiza, portfel, harmonogram, handoff zostają w 100% ręczne, przez
  istniejące ekrany (`primaryLifecycleAction`, `GateReadinessSection`,
  `InitiativeGatesWorkflowTable`) — karta po udanej adopcji WYŁĄCZNIE
  nawiguje tam, nie wykonuje kolejnego kroku sama.
- ★★ **Nie wołasz `initiative.register`/`source-proposal.submit`
  bezpośrednio** — most jest przez nową komendę adopcji, omijając
  content-match trap `registerInitiative` (sekcja 1.2).
- ★★ **`InitiativeDraftJourney.tsx` jest martwy celowo** — nie przywracaj go
  do renderowania.
- ★★ **Nie poszerzasz `TARGET_KINDS`/`chatHandoffService` o `initiative`.**
  To jest zamknięty kontrakt między pasami 179/195/artifactHandoff, poza
  licencją tego dyżuru — pokusa „skoro już most istnieje, dorzućmy typ" jest
  ZAKAZANA (sekcja 1.3 wyjaśnia dlaczego to zły dopasowany kontrakt).
- ★★ **Brama zgody ma test OMIJAJĄCY z dowodem mutacyjnym w obie strony**
  (`Z29`-analog, Krok 5 pkt 3) — samo „test zielony" bez próby ominięcia
  klika/zgody nie jest dowodem bramy.
- ★★ **Dowód renderu karty — wybierz i nazwij drogę** (sekcja 1.6): dev-render
  ekran montujący WYŁĄCZNIE nową kartę z propsami w kształcie realnej
  odpowiedzi, LUB realny przebieg przez kanoniczny runtime. Atrapa powłoki
  `chat-split-teresa-right.tsx` NIE jest dowodem.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji** (`Z28`).
- **`Z31`** — `assertRealPostgresTestEnvironment()` BEZ argumentów, bez
  pinowania do hosta/portu/nazwy bazy.
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0.
- ★ Port **5000 zajęty na stałe przez macOS Control Center**, **5037 przez
  `adb`**, **5060-5061 zajęte**. Sprawdź porty dyżurów równoległych (215-217
  zarezerwowane na przód, 206/207 mogły zostawić żywe kontenery) przed
  startem — `docker ps -a` i `lsof`, wynik do raportu.
- **Każdą cytowaną linię kodu/dokumentu sprawdzasz sam przed wklejeniem do
  raportu.** Numery w tej instrukcji zweryfikowano wobec markera
  `fe33ce8036` — ale worktree jest dzielone z dyżurami równoległymi; jeśli
  linia się przesunęła, zaufaj SWOJEMU pomiarowi.
- **Migracja WYŁĄCZNIE addytywna, przedział `20261900`-`20261909`** —
  zweryfikuj pustkę sam (dyżury równoległej fali mogą sięgnąć w pobliże).
- ★★ **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest OBOWIĄZKOWA.**
  Wypisz w niej wprost co najmniej: (a) czy istniejący endpoint pobierania
  inicjatywy faktycznie zwraca `owner_business_id`/`owner_execution_id`/
  `project_id` w payloadzie dziś — jeśli nie sprawdziłeś tego bezpośrednio
  przed pisaniem karty, napisz to wprost; (b) czy Twój wybór `aggregateId`
  (reużyty `chatInitiativeId` vs nowy) koliduje z czymkolwiek w kodzie, co
  zakłada rozłączność `initiatives.id` i kanonicznego `initiativeId`; (c)
  mechanizm wstrzykiwania `governedHandoff`-podobnego pola do wiadomości w
  `UnifiedChatPanel.tsx`/`MessageRenderer.tsx` — czy prześledziłeś go do
  końca, czy tylko wskazałeś wzorzec; (d) czy dowód renderu karty (sekcja
  1.6) pochodzi z realnego przebiegu czy z propsów w harnessie — zapisz to
  wprost, którą z dwóch dróg wybrałeś i dlaczego; (e) czy test bramy
  omijającej (Krok 5 pkt 3) rzeczywiście mutował walidację komendy, czy tylko
  sprawdził happy-path; (f) czy `initiativeGenerationService.createInitiative`
  →`funnelCreateInitiative` (sekcja 1.4, „ten sam writer") to ustalenie
  faktycznie zweryfikowałeś czytając kod, czy przepisałeś z tej instrukcji
  bez sprawdzenia. Brak tej sekcji jest podstawą odrzucenia dyżuru.
