# INSTRUKCJA DYŻURU nr 378 — Codex — „★★ CASE INTAKE PRODUCER — DEC-2026-09-05-396 ("tak"): Teresa ma SAMA rozpoznawać w rozmowie nową sprawę i proponować jej założenie. Karta `CaseIntakeConfirmCard.tsx` renderuje się na `metadata.type === 'case_intake_proposal'` (`MessageRenderer.tsx:884`) od dyżuru R4-P1 i backend jest REALNY — `caseIntakeService.proposeConversationWorkOrder`/`confirmConversationWorkOrder` zamontowane BLIŹNIACZO w dwóch miejscach: `server/src/routes/v10/teresa.routes.ts` (router zamontowany BEZWARUNKOWO w `Gateway.ts:1246`, jedyny router Teresy) i `server/src/routes/v8/chat.routes.ts` (`/conversations/:id/case-intake/*`, ZA `caseIntakeModuleGate = createModuleGate('MODULE_CASE_WORKSPACE')`) — ale **zero producentów w całym repo** (`grep -rn 'case_intake_proposal' src server` = dokładnie 2 trafienia: odczyt + komentarz, zmierzone dziś na marker, dyżur 371 zmierzył identycznie na swoim marketrze i zakończył R4 STOP-em właśnie z powodu braku licencji na producenta — pytanie 2 z jego raportu: "czy osobny dyżur może objąć producenta wiadomości i `apiIntake.ts`" — TEN dyżur jest tą odpowiedzią). **DWA REALNE ZNALEZISKA, których 371 nie miał (zmierzone dziś, PO scaleniu 367-373):** (1) `chatExecutionService.classifyIntent` NIE JEST już "heuristic stub (LLM call placeholder)" jak twierdzi STARY, nieaktualny komentarz w `caseIntakeService.ts` (pyt. otwarte #4, cytujący "chatExecutionService.ts:132") — od **2026-08-11 (Stream B / CW-T-B)** to REALNY, deterministyczny klasyfikator PL/EN oparty na wzorcach regex (`chatExecutionService.ts:178-261`), zwracający `intentType: 'governed_work'|'conversational'|'ambiguous'` — ALE nadal NIE potrafi wyciągnąć z rozmowy `goal`/`scope`/`expectedOutcome` (to zadanie zostaje, cytowane wprost w `caseIntakeService.ts` jako "the caller's job", bo `proposeWorkOrder` MUSI zostać deterministyczne — LLM w środku zniszczyłby gwarancję identycznego digestu). (2) trasa v8 `/case-intake/turn`, jedyna dziś wołająca `classifyIntent`, stoi ZA `caseIntakeModuleGate('MODULE_CASE_WORKSPACE')`, który w `betaGate.middleware.ts` jest DOMYŚLNIE ZAMKNIĘTY dla zwykłego usera (`createModuleGate`: przepuszcza tylko gdy `BETA_MENU_STATUS['MODULE_CASE_WORKSPACE'] === 'open'` ALBO rola OWNER/ADMIN/ADMINISTRATOR/SUPERADMIN) — komentarz w pliku wprost wymienia `MODULE_CASE_WORKSPACE` jako DZIŚ ZAMKNIĘTY. Producent zbudowany na tej trasie byłby **flagą-fantomem drugiego stopnia**: włączona flaga funkcyjna, ale zwykły user i tak dostaje odmowę na poziomie bramy modułu, zanim classifyIntent w ogóle się wykona. Router v10 (`teresa.routes.ts`) NIE MA tej bramy ("mounted unconditionally", cytat z nagłówka pliku) — stąd R2/R3 tego dyżuru budują NOWĄ trasę na v10, nie rozszerzają v8. **Zakres dyżuru: zbudować producenta (nie tylko zmierzyć i STOP jak 371), bo DEC-396 to jawna zgoda właściciela** — ale za NOWĄ flagą domyślnie OFF po obu stronach (klient `useFeatureFlags.tsx` DEFAULT_FLAGS + serwer `server/src/config/FeatureFlags.ts`, ten sam podwójny wzorzec co `ENABLE_TERESA_MINDMAP`), bo to nowy, dotąd niewidoczny w produkcji ekran (reguła 7 CLAUDE.md)."

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
> **wyłącznie** `/private/tmp/cx-day378-case-intake-producer`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `c7f8b53660d227ab79797ec0f64ea9e187b50006`**
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
Zakres: ****`13_CHAT`** (+ `CaseWorkspace`) — Teresa ma SAMA rozpoznać w rozmowie nową sprawę i zaproponować jej założenie (DEC-2026-09-05-396, ostatni wiersz `OWNER_DECISION_LEDGER_2026-08-24.md`). Ekran: `/chat` (`UnifiedChatPanel mode="full"`, ta sama produkcyjna ścieżka co dyżur 371). Karta `CaseIntakeConfirmCard.tsx` i cały łańcuch backendu (`caseIntakeService`, dwa zamontowane routery) już istnieją i są realne (curl-potwierdzone przez R4-P1) — brakuje WYŁĄCZNIE producenta: kroku w orkiestracji czatu, który po turze Teresy decyduje "to wygląda na nową sprawę" i doczepia `metadata.type='case_intake_proposal'` do wiadomości asystenta. Źródło zlecenia: `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/E_wiadomosci.md` (D-4, TYLKO ODCZYT — materiał źródłowy audytu) + raport `CODEX_DAY371_KARTY_PROPOZYCJI_REPORT.md` (TYLKO ODCZYT — sekcja "CASE INTAKE — WERDYKT I DLACZEGO", STOP z 05.09) + `ODBIOR_371.md` pytanie 2 (TYLKO ODCZYT) + `DEC-2026-09-05-396` (TYLKO ODCZYT — decyzja, nie dokument do edycji)**.
Trasy front: `**Nowa funkcja (R1/R2, PEŁNA LICENCJA — plik NIE ISTNIEJE):** `src/components/CaseWorkspace/apiIntake.ts` — DOPISZ nową eksportowaną funkcję (np. `autoDetectCaseFromConversation`), wzorem istniejących `proposeConversationWorkOrder`/`confirmConversationWorkOrder` w TYM SAMYM pliku (ten sam `fetchWithRetry`/`getHeaders`/`handleResponse`/`toCommandFailure`, TA SAMA `BASE`), wołająca NOWĄ trasę v10 (patrz `TRASY_TYL`). Zakaz zmiany istniejących pięciu eksportów tego pliku. **Producent (R3, WĄSKA LICENCJA):** `src/components/AIChat/UnifiedChatPanel.tsx` — WYŁĄCZNIE wewnątrz `onStreamDone` (zmierzone dziś: zaczyna się `async (fullText, thinking, artifacts, meta) => {` w okolicy **l.1698**, buduje `persistConversationId` ok. **l.1721-1727**, woła `addMessageToConversation({... metadata: buildPersistedAiResponseMetadata({...}) })` ok. **l.1733-1789** i osobno `addChatMessage({... metadata: {...} })` ok. **l.1797-1830** — zweryfikuj DOKŁADNE numery na swoim markerze, plik ma **~7600 linii**, ŻADNEGO INNEGO fragmentu nie dotykasz) — dopisujesz WYŁĄCZNIE: (a) wywołanie nowej funkcji klienta z `apiIntake.ts` gdy flaga klienta ON, PO obliczeniu `safeText`/`persistConversationId`, PRZED oboma wywołaniami zapisu; (b) jeśli wynik `mode === 'work_order_proposed'`, spread `{ type: 'case_intake_proposal', proposal: { conversationId, workOrder, workOrderDigest } }` DO obiektu `metadata` w OBU miejscach zapisu (persystowanym i lokalnym `addChatMessage`) — NIE zmieniasz `buildPersistedAiResponseMetadata` w `src/utils/chatPersistence.ts` (zostaje TYLKO ODCZYT, merge robisz w miejscu wywołania przez spread). Błąd wywołania (sieć/timeout/flaga OFF po stronie serwera) = cichy `console.error` + kontynuacja BEZ metadanych case-intake — normalna tura czatu NIGDY nie może się wywalić przez ten dodatek. **Flaga klienta (R4, WĄSKA LICENCJA):** `src/hooks/useFeatureFlags.tsx` — jeden NOWY wpis w `DEFAULT_FLAGS` (wzorzec `ENABLE_TERESA_MINDMAP` l.354-361 — TYLKO ODCZYT jako przykład), `defaultValue: false`. **Odczyt flagi w komponencie:** `useFeatureFlagsContext` już importowany w `UnifiedChatPanel.tsx` (l.49, TYLKO ODCZYT importu) — użyj istniejącego hooka, nie dodawaj nowego mechanizmu odczytu. **MessageRenderer.tsx — TYLKO ODCZYT.** Gałąź `case_intake_proposal` (ok. **l.884-897**, zweryfikuj) już poprawnie renderuje `CaseIntakeConfirmCard` z properami `conversationId`/`workOrder`/`workOrderDigest` — dyżur 375 (równoległy, ten sam marker) ma ten plik jako "cudze tereny"/TYLKO ODCZYT identycznie; NIE dotykasz tej gałęzi chyba że R1 wykaże w niej realny defekt (wtedy WĄSKA LICENCJA wyłącznie na naprawę tego konkretnego defektu, opisz w raporcie dlaczego). **CaseIntakeConfirmCard.tsx — TYLKO ODCZYT.** R1 mierzy jej realny kontrakt akcji (ma WYŁĄCZNIE przycisk "Potwierdź", BRAK przycisku "Odrzuć" — zweryfikuj to sam, to zmienia kształt dowodu w R5) — nie dodajesz nowego przycisku w tym dyżurze bez wpisania tego jako pytania do właściciela (patrz R5).`. Trasy tył: `**Nowa trasa (R2, PEŁNA LICENCJA — blok NIE ISTNIEJE):** `server/src/routes/v10/teresa.routes.ts` (**380 linii dziś** — WĄSKA LICENCJA na dodanie JEDNEGO nowego bloku `router.post('/case-intake/conversations/:conversationId/auto-detect', ...)` obok istniejących pięciu tras case-intake, ok. **l.270-380**, TEN SAM kształt/middleware co `/summary` (l.277-307: `verifyToken, attachV8Context, caseWorkspaceHandler(...)`) — DLACZEGO v10, nie v8: v10 jest zamontowany BEZWARUNKOWO (`Gateway.ts:1246`, cytat nagłówka pliku l.191-192), v8 `/case-intake/*` stoi za `caseIntakeModuleGate('MODULE_CASE_WORKSPACE')`, który jest DOMYŚLNIE ZAMKNIĘTY dla zwykłego usera — zweryfikuj to sam w `betaGate.middleware.ts` i `BETA_MENU_STATUS` PRZED budową, to jest twardy warunek architektury tej pozycji, nie sugestia). Nowa trasa: parsuje `{ message: string, contextSnapshotId?: string }`, woła `chatExecutionService.classifyIntent` + NOWĄ `chatExecutionService.draftCaseWorkOrderFromConversation` (patrz niżej) TYLKO gdy serwerowa flaga ON, i gdy dostanie pewny draft — woła ISTNIEJĄCE, NIETKNIĘTE `caseIntakeService.proposeConversationWorkOrder` (identyczne wywołanie jak w `/summary` l.285-290) — zwraca `{ mode: 'informational'|'work_order_required'|'work_order_proposed', ... }`, TEN SAM kształt co `/case-intake/turn` w `chat.routes.ts:442-482` (TYLKO ODCZYT jako wzorzec odpowiedzi, nie kopiujesz pliku). **Nowa funkcja (R2, RDZEŃ, PEŁNA LICENCJA):** `server/src/services/v8/chatExecutionService.ts` (**481 linii dziś**) — DOPISZ `draftCaseWorkOrderFromConversation(message, organizationId, contextSnapshotId)` UŻYWAJĄCY `llmService.callStructured` (wzorzec DOSŁOWNY z `server/src/routes/ai.routes.ts` trasa `/chat/confirm`, blok `ConfirmSchema`+`llmService.callStructured({type, modelConfig, systemPrompt, messages, schema})` ok. **l.1490-1600**, TYLKO ODCZYT jako wzorzec) ze schematem zod zwracającym `{ looksLikeNewCase: boolean, confidence: number, goal, scope: string[], expectedOutcome, caseName } | { looksLikeNewCase: false }`. Wołaj `classifyIntent` NAJPIERW jako tani, deterministyczny filtr (regex, zero kosztu LLM) — wołaj strukturalny LLM TYLKO gdy `classifyIntent` zwróci `governed_work` LUB `ambiguous` (NIGDY dla `conversational` — to jest właśnie mechanizm bezpieczeństwa opisany w komentarzu `classifyIntent` l.156-177: "ambiguous" jest bezpieczne, bo tylko PROPONUJE, nigdy nie POTWIERDZA). Zakaz zmiany istniejącego ciała `classifyIntent` (l.178-261) — nowa funkcja jest SIOSTRĄ, nie modyfikacją. **`caseIntakeService.ts` — BEZWZGLĘDNIE TYLKO ODCZYT.** Plik sam dokumentuje zakaz (pyt. otwarte #4, ok. l.166-169): "No LLM extraction lives here... Putting a model call in here would make the digest non-deterministic and destroy the entire guarantee" — żadna litera się tam nie zmienia, niezależnie od tego jak kuszące. **Flaga serwera (R2, WĄSKA LICENCJA):** `server/src/config/FeatureFlags.ts` — jeden nowy wpis w `FeatureFlagsSchema` (wzorzec `ENABLE_TERESA_MINDMAP_SEARCH` l.48, komentarz l.41-47 o realnym gate'owaniu per-call przez helper — TYLKO ODCZYT jako przykład) + jeden wpis w obiekcie budującym runtime flags (wzorzec l.190/196, `process.env.<TWOJA_NAZWA> === 'true'`, default OFF). Ten sam identyfikator (camelCase czy `ENABLE_*` — dobierz spójnie) w OBU plikach flag (klient+serwer), sprawdzony grepem że nie istnieje PRZED dodaniem. **v8 `chat.routes.ts`, `caseIntakeModuleGate`, `betaGate.middleware.ts`, `Gateway.ts` — TYLKO ODCZYT.** Zero zmian w bramie modułu — to świadoma decyzja architektoniczna tego dyżuru (buduj na v10, omiń bramę), nie coś do naprawienia.`.

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
WT=/private/tmp/cx-day378-case-intake-producer
MARKER=c7f8b53660d227ab79797ec0f64ea9e187b50006

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day378-case-intake-producer-20260905 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day378-case-intake-producer/config.worktree"
cat "$VAULT/worktrees/cx-day378-case-intake-producer/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day378-case-intake-producer-scratch
mkdir -p /private/tmp/cx-day378-case-intake-producer-artefakty

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
git -C "$VAULT" log --oneline c7f8b53660d227ab79797ec0f64ea9e187b50006..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only c7f8b53660d227ab79797ec0f64ea9e187b50006..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day378-case-intake-producer-20260905
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only c7f8b53660d227ab79797ec0f64ea9e187b50006..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `jedenaście` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) ★★★ RDZEN: zero producentow case_intake_proposal, dokladnie jak w dyzurze 371
bash -c "grep -rn 'case_intake_proposal' src server"
#   moje liczby (marker c7f8b53660): dokladnie 2 -- MessageRenderer.tsx:884 (odczyt),
#   CaseIntakeConfirmCard.tsx:26 (komentarz w naglowku). Zero producentow.

# (2) Kontrakt karty -- TYLKO 'Potwierdz', BRAK 'Odrzuc'
bash -c "grep -n 'handleConfirm\|handleReject\|Odrzuc\|Reject\|button' src/components/AIChat/CaseIntakeConfirmCard.tsx"
#   moje liczby: jeden handler akcji (handleConfirm), jeden przycisk stanu idle/stale;
#   zero wystapien 'Odrzuc'/'Reject' -- zweryfikuj SAM, to zmienia ksztalt dowodu R5.

# (3) Backend REALNY, zamontowany DWA RAZY -- v10 bezwarunkowo, v8 za brama
bash -c "grep -n 'router.post\|router.get' server/src/routes/v10/teresa.routes.ts | grep -i case-intake"
bash -c "grep -n 'case-intake' server/src/routes/v8/chat.routes.ts | head -20"
bash -c "grep -n 'caseIntakeModuleGate = createModuleGate' server/src/routes/v8/chat.routes.ts"
#   moje liczby: v10 ma 5 tras case-intake (summary/work-order/confirm/case/conversation);
#   v8 ma odpowiadajace 5 + /turn, za caseIntakeModuleGate('MODULE_CASE_WORKSPACE') l.337-339 (Twoje numery moga sie przesunac -- sprawdz).

# (4) ★★★ Brama modulu jest DOMYSLNIE ZAMKNIETA dla zwyklego usera -- przeczytaj cale cialo
sed -n '1,60p' server/src/middleware/betaGate.middleware.ts
bash -c "grep -n \"MODULE_CASE_WORKSPACE\" server/src/sharedRuntime/utils/betaMenuStatus.ts\|grep -rn MODULE_CASE_WORKSPACE server/src/sharedRuntime"
#   potwierdz SAM aktualny status ('open'/'closed') w BETA_MENU_STATUS -- jesli status
#   zmienil sie na 'open' od pisania tej instrukcji, to jest WYNIK, nie sprzecznosc -- zapisz go.

# (5) ★★★ classifyIntent JEST REALNY (regex PL/EN), nie stub -- komentarz w caseIntakeService.ts jest NIEAKTUALNY
sed -n '125,180p' server/src/services/v8/chatExecutionService.ts
bash -c "grep -n 'chatExecutionService.classifyIntent\|heuristic stub' server/src/services/caseWorkspace/caseIntakeService.ts"
#   moje liczby: chatExecutionService.ts l.134-154 opisuje ZAMIANE stubu na regex PL/EN
#   z 2026-08-11 (CW-T-B); caseIntakeService.ts nadal cytuje STARY stan ("self-declared
#   heuristic stub") jako aktualny -- to jest STALE, zweryfikuj numery linii SAM.

# (6) Wzorzec do reuzycia: llmService.callStructured, JUZ w ai.routes.ts, inna trasa
bash -c "grep -n \"router.post(\\|'/chat/confirm'\\|callStructured\" server/src/routes/ai.routes.ts | sed -n '1,15p'"
#   moje liczby: trasa /chat/confirm ok. l.1386; ConfirmSchema + llmService.callStructured
#   ok. l.1490-1600 -- wzorzec strukturalnego wywolania LLM z modelRouter.select + schema zod.

# (7) Punkt skladania metadanych w produkcyjnym /chat -- onStreamDone, DWA miejsca zapisu
bash -c "grep -n 'onStreamDone\|addMessageToConversation\|buildPersistedAiResponseMetadata\|addChatMessage(' src/components/AIChat/UnifiedChatPanel.tsx | head -20"
#   moje liczby: onStreamDone ok. l.1698; addMessageToConversation(...) ok. l.1733;
#   addChatMessage(...) legacy/local ok. l.1797 -- oba buduja WLASNY obiekt metadata,
#   Twoj spread musi trafic w OBA albo udowodnic ze jeden jest martwy dla /chat.

# (8) Wzorzec podwojnej flagi klient+serwer, juz dzialajacy (ENABLE_TERESA_MINDMAP)
bash -c "grep -n \"id: 'ENABLE_TERESA_MINDMAP'\" src/hooks/useFeatureFlags.tsx"
bash -c "grep -n 'ENABLE_TERESA_MINDMAP' server/src/config/FeatureFlags.ts"
bash -c "grep -rn 'ENABLE_CASE_INTAKE' server/src src" ; echo "(pusty wynik = nazwa wolna, potwierdz SAM tuz przed uzyciem)"

# (9) Warunki wspolne serii: liscie slownikow + 4 bezpieczniki
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   moje liczby (zmierzone 2026-09-05 na marker c7f8b53660, galaz WSPOLNA z 374-377
#   aktywnie pracujacymi rownolegle): pl=35312, en=33172; focus=0, list=0, artefakt=0;
#   reach=1 (lista 'New test-only files' zawiera juz pliki INNYCH rownoleglych dyzurow
#   tej rundy -- NIE Twoja regresja, licz WLASNA liste PO NAZWACH tuz przed/po, nie ufaj tej liczbie).

# (10) zasoby: dysk, porty, kontener, litera rejestru TUZ PRZED COMMITEM
df -h /
lsof -nP -iTCP:6449 -sTCP:LISTEN; lsof -nP -iTCP:5589 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day378 || true
bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"
#   oczekiwane: >5 GB wolnego (zmierzone dzis: 29 GiB); oba porty puste (potwierdzone);
#   0 kontenerow; ostatnia litera na markerze: AM -- rownolegle dyzury 374-377 moga
#   dopisac AN-AQ zanim Ty commitujesz -- sprawdz SAM, nie ufaj tej liczbie.

# (11) Rozlacznosc z rownoleglym rodzenstwem tej samej rundy (374-377) -- NIE ich pliki
bash -c "grep -l 'chatExecutionService.ts\|teresa.routes.ts\|apiIntake.ts' _instr_src/cfg37[4-7].json _instr_src/body37[4-7].md 2>/dev/null" || echo "brak nakladania na te 3 pliki (potwierdzone przy pisaniu tej instrukcji)"
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day378-case-intake-producer-20260905` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6449`. Twój JEDYNY port harnessu to `5589`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day378-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP), 6000, 6665-6669. Zajęte przez hosta: 3000, 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Paczka `AUDYT_CZAT_PRZYCISKI_20260905` scalona 367-373 (NIE dotykasz, informacyjnie, porty już zwolnione): 6438-6444/5578-5584. Rodzeństwo RÓWNOLEGŁE tej samej rundy 05.09, na TYM SAMYM markerze `c7f8b53660`, PRACUJĄCE RÓWNOCZEŚNIE z Tobą — NIE dotykasz ich portów: 374 (DB 6445/harness 5585), 375 (6446/5586 — zmierzone dziś: **6446 ZAJĘTY**, sesja aktywna), 376 (6447/5587), 377 (6448/5588 — zmierzone dziś: **6448 ZAJĘTY**, sesja aktywna). Twoje własne WYŁĄCZNIE: baza **6449**, harness **5589** (zmierzone dziś: oba WOLNE, `lsof` puste). ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `**CAŁY producent za NOWĄ flagą, domyślnie OFF, PO OBU STRONACH.** To jest dokładnie odwrotna sytuacja niż w dyżurze 371 (tam K9 nie miał flagi, bo naprawiał potwierdzony defekt) — tu budujesz NOWY, dotąd niewidoczny w produkcji ekran (karta `CaseIntakeConfirmCard` nigdy się nie renderowała żadnemu userowi), więc reguła 7 CLAUDE.md ("Piotr nigdy pierwszym testerem wizualnym") stosuje się wprost: flaga klienta w `useFeatureFlags.tsx` DEFAULT_FLAGS (`defaultValue: false`) steruje wywołaniem z `UnifiedChatPanel.tsx`; flaga serwera w `server/src/config/FeatureFlags.ts` (default OFF, env `process.env.<NAZWA> === 'true'`) steruje czy `draftCaseWorkOrderFromConversation` w ogóle wykonuje wywołanie LLM — OFF po stronie serwera musi dawać ZERO dodatkowych wywołań modelu i ZERO nowych wierszy `case_core`, zmierzone dowodem (licznik wywołań `llmService`/mock przed i po, przy fladze OFF = 0). Zakaz włączenia domyślnie w tym dyżurze; zrzuty dev-render (R6) idą z flagą wymuszoną ON WYŁĄCZNIE w harnessie, nigdy w produkcyjnym configu.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs`, `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/middleware/betaGate.middleware.ts`, `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts`, `server/src/services/caseWorkspace/caseIntakeService.ts`, `server/src/services/caseWorkspace/_shared/**`, `src/services/api/baseClient.ts`, `public/locales/**` (poza NOWYMI kluczami `aiChat.caseIntake.*`, patrz R4a). Wszystkie **NIETYKALNE DO ZAPISU** poza jawnie wymienionym wyjątkiem — wolno je wołać/czytać w pomiarze`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY378_CASE_INTAKE_PRODUCER_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — na markerze ostatnia użyta to **`AM`** (`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`, zmierzone dziś), rodzeństwo równoległe 374-377 najprawdopodobniej zajmie `AN`-`AQ` w NIEZNANEJ Tobie kolejności — **sprawdzasz literę KOMENDĄ TUŻ PRZED COMMITEM**, nie ufasz tej liczbie ani liczbie z tej instrukcji; nowy katalog dowodowy `evidence/day378-case-intake-producer/` (NIE ISTNIEJE na markerze — tworzysz go); nowe klucze i18n `aiChat.caseIntake.*` WYŁĄCZNIE w `public/locales/pl/translation.json` i `public/locales/en/translation.json` (rozłączne z kluczami dyżuru 374, który pracuje na INNYCH kluczach tego samego ekranu — sprawdź grepem że Twój prefiks nie istnieje przed dodaniem). ★★★ **MACIERZ ODBIORU JEST NIETYKALNA W TYM DYŻURZE** — żaden wiersz, żaden moduł, w tym `13_CHAT`. Plik postępu `/private/tmp/cx-day378-postep.md` żyje POZA repo. Nowe pliki w `tests/`/`__tests__/` wymagają `git add -f`. Dev-render: nowy plik `dev-render/screens/chat-case-intake-proposal.tsx` (NIE ISTNIEJE — tworzysz, wzorzec `chat-split-teresa-right.tsx`, TYLKO ODCZYT jako wzorzec). **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day378-case-intake-producer-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day378-case-intake-producer-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ BUDOWY NA TRASIE v8 `/case-intake/turn`.** Ta trasa stoi za `caseIntakeModuleGate('MODULE_CASE_WORKSPACE')`, domyślnie ZAMKNIĘTĄ dla zwykłego usera (`betaGate.middleware.ts`) — producent zbudowany tam działałby TYLKO dla OWNER/ADMIN, nigdy dla realnego klienta, i byłby flagą-fantomem drugiego stopnia mimo poprawnej flagi funkcyjnej. Nowa trasa idzie WYŁĄCZNIE na `routes/v10/teresa.routes.ts` (bezwarunkowo zamontowany). ★★★ **ZAKAZ DODANIA LLM DO `caseIntakeService.ts`.** Ten plik MUSI zostać deterministyczny (digest = f(workOrder), zawsze ten sam wynik dla tego samego inputu) — jakikolwiek model w środku niszczy tę gwarancję. Cała nowa logika ekstrakcji/klasyfikacji żyje w `chatExecutionService.ts` (caller), nigdy w `caseIntakeService.ts`. ★★★ **ZAKAZ WOŁANIA STRUKTURALNEGO LLM DLA WIADOMOŚCI, KTÓRE `classifyIntent` OZNACZYŁ JAKO `conversational`.** To jest zarówno oszczędność kosztu jak i bezpiecznik: rozmowa czysto informacyjna ma zero szans na propozycję Case, PRZED jakimkolwiek wywołaniem modelu, nie tylko po. ★★★ **ZAKAZ DODANIA PRZYCISKU „ODRZuć” DO `CaseIntakeConfirmCard.tsx` BEZ WPISANIA TEGO JAKO ZMIANY UI W RAPORCIE.** Karta dziś ma WYŁĄCZNIE „Potwierdź” — jeśli R1 potwierdzi ten kształt, dowód R5 dla ścieżki „user nie klika” to BRAK wiersza `case_core` po nieskończonym czasie, NIE osobny stan „odrzucono” (chyba że R1 znajdzie w kodzie coś innego — wtedy opisz i dostosuj). ★★★ **ZAKAZ ZMIANY ISTNIEJĄCYCH PIĘCIU EKSPORTÓW `apiIntake.ts` I ISTNIEJĄCEGO CIAŁA `classifyIntent`.** Dopisujesz WYŁĄCZNIE nowe funkcje obok. ★ **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`** (`Z35`). **ZAKAZ porównania po liczbach zamiast po pełnych nazwach** (`Z37`) dla reachability. | Bo DEC-396 to jawna, jednoznaczna zgoda właściciela na dokładnie tę funkcję, po tym jak dyżur 371 poprawnie odmówił jej zbudowania bez decyzji i bez licencji na producenta — ten dyżur ISTNIEJE, żeby tę lukę domknąć, nie żeby ją zmierzyć po raz trzeci. Ale "zgoda właściciela" nie znaczy "zbuduj cokolwiek działa na pierwszy rzut oka": karta czekała miesiącami na producenta właśnie dlatego, że naiwne podłączenie (np. na trasie zamkniętej bramą modułu, albo z LLM wepchniętym do serwisu, który MUSI być deterministyczny) wyglądałoby na "gotowe" w demie z kontem admina, a byłoby martwe dla każdego realnego usera — dokładnie ten kształt fałszywego "gotowe", którego ta metodyka pracy uczy się unikać od miesięcy. |

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
cd /private/tmp/cx-day378-case-intake-producer

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day378-pg psql -U postgres -d cx378 \
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
cd /private/tmp/cx-day378-case-intake-producer

docker run -d --name cx-day378-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx378 \
  -p 127.0.0.1:6449:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day378-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6449/cx378 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6449/cx378 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day378-case-intake-producer && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6449/cx378 \
JWT_SECRET=cx378-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Testy jednostkowe frontu (RTL) z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, wzorzec mocków jak `src/components/AIChat/__tests__/day371.proposalFamily.remount.test.tsx` (ISTNIEJĄCY, TYLKO ODCZYT jako wzorzec — montaż komponentu, mock modułu API). Testy serwerowe (pg, real Postgres) z cwd `server/`, `--config server/vitest.config.ts`; wzorzec fikstury Case Workspace jak w `server/src/services/caseWorkspace/__tests__/integration/teresaProductionIntake.pg.test.ts` i `chatIntake.pg.test.ts` (ISTNIEJĄCE, TYLKO ODCZYT jako wzorzec — org+actor+conversation seed, `requireOrgMember`/`requireCaseAccess`). Nowy pg test idzie do `server/src/routes/__tests__/day378.caseIntakeAutoDetect.pg.test.ts` (NOWY, `git add -f`), realny `ApiGateway`, podpisany JWT roli zwykłego membera (NIE admina — patrz pułapka 1), `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6449/cx378 JWT_SECRET=cx378-test-secret-do-not-reuse-min-32-znaki <TWOJA_FLAGA_SERWERA>=true`, `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day378-case-intake-producer-artefakty/<etykieta>.json`. Uruchomienie z roota bez właściwego configu daje `No test files found` — to BŁĄD KOMENDY, nie PASS. --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day378-case-intake-producer-artefakty/day378-case-intake-producer.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day378-case-intake-producer && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Testy jednostkowe frontu (RTL) z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, wzorzec mocków jak `src/components/AIChat/__tests__/day371.proposalFamily.remount.test.tsx` (ISTNIEJĄCY, TYLKO ODCZYT jako wzorzec — montaż komponentu, mock modułu API). Testy serwerowe (pg, real Postgres) z cwd `server/`, `--config server/vitest.config.ts`; wzorzec fikstury Case Workspace jak w `server/src/services/caseWorkspace/__tests__/integration/teresaProductionIntake.pg.test.ts` i `chatIntake.pg.test.ts` (ISTNIEJĄCE, TYLKO ODCZYT jako wzorzec — org+actor+conversation seed, `requireOrgMember`/`requireCaseAccess`). Nowy pg test idzie do `server/src/routes/__tests__/day378.caseIntakeAutoDetect.pg.test.ts` (NOWY, `git add -f`), realny `ApiGateway`, podpisany JWT roli zwykłego membera (NIE admina — patrz pułapka 1), `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6449/cx378 JWT_SECRET=cx378-test-secret-do-not-reuse-min-32-znaki <TWOJA_FLAGA_SERWERA>=true`, `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day378-case-intake-producer-artefakty/<etykieta>.json`. Uruchomienie z roota bez właściwego configu daje `No test files found` — to BŁĄD KOMENDY, nie PASS. --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day378-case-intake-producer-artefakty/day378-case-intake-producer.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day378-case-intake-producer/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day378-pg psql -U postgres -d cx378 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day378-pg`.
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
> **(e) **CZTERY PUŁAPKI WŁAŚCIWE TEMU DYŻUROWI.** (1) **Brama modułu jest cichym blokerem, nie błędem.** `caseIntakeModuleGate('MODULE_CASE_WORKSPACE')` na v8 zwraca 403 dla zwykłego usera, gdy moduł jest `closed` w `BETA_MENU_STATUS` — Twój test z kontem OWNER/ADMIN przejdzie przez v8 i niczego nie wykryje; test MUSI użyć roli zwykłego membera, żeby udowodnić, że nowa trasa v10 faktycznie działa TAM, gdzie v8 by odmówiła. (2) **Stary komentarz w `caseIntakeService.ts` o `chatExecutionService.classifyIntent` jest NIEAKTUALNY.** Mówi "self-declared heuristic stub (LLM call placeholder)" — to było prawdą przed 2026-08-11; dziś to realny regex PL/EN. Nie cytuj tego komentarza jako aktualnego stanu w swoim raporcie bez własnej weryfikacji linii `chatExecutionService.ts:132` (numer mógł się przesunąć, treść na pewno). (3) **`onStreamDone` zapisuje metadane w DWÓCH miejscach niezależnie** (`addMessageToConversation` z `buildPersistedAiResponseMetadata` — trwałe, i `addChatMessage` do `useAppStore` — lokalne/legacy) — dopisanie `case_intake_proposal` tylko do jednego z nich da kartę, która znika po odświeżeniu (dokładnie kształt D-3 z dyżuru 371, tym razem w NOWYM kodzie, którego sam napiszesz — spread w OBU miejscach albo dowód, że jedno z nich jest martwe i faktycznie nieużywane przez `/chat`). (4) **`classifyIntent` zwraca `ambiguous` bardzo często** (fallback, gdy żaden wzorzec regex nie trafi) — jeśli Twój strukturalny LLM-draft wywołuje się dla KAŻDEGO `ambiguous`, koszt/częstość może być wysoki; zmierz na próbce realnych wiadomości testowych, jaki odsetek trafia w `ambiguous`, i opisz to w raporcie jako świadomy kompromis (nie musisz go rozwiązywać w tym dyżurze, ale nie możesz go przemilczeć).**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day378-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day378-case-intake-producer-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: producent na v10 nigdy v8, zero LLM w caseIntakeService.ts, klasyfikator regex JAKO TANI FILTR przed strukturalnym LLM, test dowodzi zachowania roli zwyklego membera nie admina) · R1 (KROK 0 pomiarowy: potwierdz zero producentow, kontrakt karty tylko-Potwierdz, status bramy modulu, aktualnosc classifyIntent, dokladny punkt skladania metadanych w onStreamDone -- RDZEN POMIAROWY, bez tego R2/R3 nie maja gdzie wpiac) · R2 (serwer: nowa trasa v10 auto-detect + nowa funkcja draftCaseWorkOrderFromConversation w chatExecutionService.ts uzywajaca llmService.callStructured, gate serwerowa flaga -- RDZEN) · R3 (klient: nowy wrapper w apiIntake.ts + wpiecie w UnifiedChatPanel.tsx onStreamDone w OBU miejscach zapisu metadanych, gate kliencka flaga -- RDZEN) · R4 (dwie flagi domyslnie OFF, dowod ze OFF = zero wywolan LLM i zero nowych wierszy case_core) · R5 (para dowodow na realnym PG z rola zwyklego membera: potwierdzenie tworzy wiersz case_core trwaly po odswiezeniu via getCaseForConversation; brak potwierdzenia = zero wierszy nawet po odswiezeniu i drugiej turze rozmowy (alreadyProposed); izolacja organizacji) · R6 (zrzuty dev-render PL/EN, light/dark, flaga wymuszona ON tylko w harnessie, stan przed-potwierdzeniem i po-potwierdzeniu) · R7 (raport, rejestr znaleziska, sekcja PYTANIA DO WLASCICIELA obowiazkowo niepusta -- w tym pytanie o brak przycisku Odrzuc)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6449` albo `5589` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6449` albo `5589`** (`Z7`).

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

Dyżur 371 (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY371_KARTY_PROPOZYCJI_REPORT.md`,
TYLKO ODCZYT) zmierzył precyzyjnie, że karta `CaseIntakeConfirmCard.tsx` nigdy się nie
renderuje — w całym `src/`+`server/src/` dokładnie **2** wystąpienia stringa
`case_intake_proposal` (odczyt w `MessageRenderer.tsx`, komentarz w nagłówku samej karty),
**zero producentów** — mimo że backend (`caseIntakeService`) jest realny i curl-potwierdzony.
371 poprawnie ODMÓWIŁ budowy producenta bez decyzji właściciela i bez licencji, która
obejmowałaby plik składający odpowiedź asystenta (`CaseIntakeConfirmCard.tsx:22-29` przyznaje
to wprost we własnym nagłówku). Zamiast budować połowicznie, 371 zostawił kartę DOKŁADNIE
w takim stanie, w jakim była przed dyżurem (diff netto zerowy, potwierdzone w
`ODBIOR_371.md`), i zadał właścicielowi wprost pytanie 2: „czy osobny dyżur może objąć
producenta wiadomości oraz `src/components/CaseWorkspace/apiIntake.ts`, aby wariant A lub
pełne usunięcie B nie łamały granic i reachability?”

Właściciel odpowiedział **DEC-2026-09-05-396** („tak”, 05.09 popołudnie, ostatni wiersz
`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`, TYLKO ODCZYT):
Teresa ma SAMA rozpoznawać w rozmowie nową sprawę i proponować jej założenie. Wykonanie
zapisane w tym samym wierszu ledgera: „dyżur 378 `case-intake-producer` — producent w
orkiestracji czatu przez istniejący `caseIntakeService`, za flagą domyślnie OFF, zrzut przez
dev-render do akceptu właściciela, dopiero potem flaga ON”.

**Ten dyżur jest tą odpowiedzią.** W przeciwieństwie do 371 (który miał ZMIERZYĆ i
ODMÓWIĆ/USUNĄĆ bez decyzji), ten dyżur ma ZBUDOWAĆ — bo decyzja już zapadła. Ale „zgoda
właściciela” nie zwalnia z tej samej dyscypliny pomiaru: poniżej są DWA realne znaleziska,
zmierzone dzisiaj (05.09, na marker `c7f8b53660`, PO scaleniu 367-373), których 371 nie
miał, bo powstały/zostały udokumentowane później:

**Znalezisko 1 — `classifyIntent` przestał być stubem.** `caseIntakeService.ts` (pytanie
otwarte #4 w jego własnym nagłówku) cytuje `chatExecutionService.classifyIntent` jako
„self-declared heuristic stub (LLM call placeholder)” pod linią ok. 132. To było prawdą
PRZED 2026-08-11. Od CW-T-B (Stream B) `classifyIntent` (`chatExecutionService.ts:178-261`,
zweryfikuj dokładne linie sam) jest REALNYM, deterministycznym klasyfikatorem PL/EN opartym
na wzorcach regex — zwraca `intentType: 'governed_work'|'conversational'|'ambiguous'` z
`confidence`/`reasoning`. To NIE jest LLM i NIE potrafi wyciągnąć z rozmowy `goal`/`scope`/
`expectedOutcome` — to zostaje prawdziwą luką (patrz Znalezisko 2 poniżej i R2). Ale
cytowanie komentarza `caseIntakeService.ts` jako aktualnego opisu stanu `classifyIntent`
byłoby dokładnie tym błędem, przed którym ostrzega CLAUDE.md („audyty starzeją się w ~3 dni”)
— zweryfikuj to sam, nie przepisuj cudzego komentarza.

**Znalezisko 2 — jedyna trasa, która dziś woła `classifyIntent` (`/case-intake/turn` w
`server/src/routes/v8/chat.routes.ts`), stoi za bramą modułu domyślnie ZAMKNIĘTĄ dla
zwykłego usera.** `router.use('/case-intake', caseIntakeModuleGate)` (`chat.routes.ts`, ok.
l.339), gdzie `caseIntakeModuleGate = createModuleGate('MODULE_CASE_WORKSPACE')`
(`server/src/middleware/betaGate.middleware.ts`). `createModuleGate` przepuszcza requesta
TYLKO gdy `BETA_MENU_STATUS['MODULE_CASE_WORKSPACE'] === 'open'` ALBO rola requestera to
OWNER/ADMIN/ADMINISTRATOR/SUPERADMIN — a komentarz w samym pliku middleware wymienia
`MODULE_CASE_WORKSPACE` wprost jako jeden z modułów, które SĄ dziś zamknięte. Producent
zbudowany na v8 wyglądałby na demie z kontem admina jak gotowa funkcja, a byłby martwy dla
każdego realnego, nie-adminowego usera — dokładnie kształt fałszywego „gotowe”, jaki ta
metodyka pracy uczy się wyłapywać. **Router v10** (`server/src/routes/v10/teresa.routes.ts`)
NIE MA tej bramy — jego własny nagłówek mówi wprost: „mounted unconditionally in
`Gateway.ts:1246` — the ONLY Teresa router `Gateway.ts` imports”. Dlatego cała nowa logika
tego dyżuru idzie na v10, nie na v8. `R1` wymaga, żebyś to zweryfikował samodzielnie, zanim
napiszesz jedną linię kodu — status bramy mógł się zmienić między napisaniem tej instrukcji
a Twoją pracą.

**Co dokładnie brakuje (i tylko to buduje ten dyżur).** Cały łańcuch backendu jest realny i
NIETKNIĘTY w tym dyżurze: `caseIntakeService.proposeConversationWorkOrder` /
`confirmConversationWorkOrder` / `getCurrentConversationWorkOrder` / `findCaseForConversation`
— wszystko już istnieje, jest curl-potwierdzone i zamontowane DWA razy (v10 bezwarunkowo, v8
za bramą). Karta `CaseIntakeConfirmCard.tsx` już poprawnie renderuje się na
`metadata.type === 'case_intake_proposal'` i już poprawnie woła `confirmConversationWorkOrder`
z `apiIntake.ts` po kliknięciu „Potwierdź”. **Brakuje WYŁĄCZNIE producenta**: kroku w
orkiestracji czatu, który po realnej turze Teresy na `/chat` (1) tanim, deterministycznym
filtrem (`classifyIntent`, już istniejący) decyduje, czy w ogóle warto pytać model o więcej;
(2) jeśli tak, jednym dodatkowym, strukturalnym wywołaniem LLM (wzorzec z `ai.routes.ts`
`/chat/confirm`, już istniejący) próbuje wyciągnąć `goal`/`scope`/`expectedOutcome`; (3) jeśli
dostanie pewny wynik, woła ISTNIEJĄCE `proposeConversationWorkOrder` i doczepia
`metadata.type='case_intake_proposal'` do wiadomości asystenta — dokładnie tak, jak dziś
robi to ręcznie ekran Case Workspace (formularz), tylko automatycznie, z treści rozmowy.

## ★ Stan zastany, zmierzony przeze mnie na markerze `c7f8b53660d227ab79797ec0f64ea9e187b50006`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| Wystąpienia `case_intake_proposal` w `src`+`server/src` | **2** (odczyt + komentarz), **0 producentów** | `MessageRenderer.tsx:884`, `CaseIntakeConfirmCard.tsx:26` |
| `CaseIntakeConfirmCard`: akcje dostępne na karcie | WYŁĄCZNIE „Potwierdź” (`handleConfirm`) — **brak** „Odrzuć” | `CaseIntakeConfirmCard.tsx` |
| Backend case-intake, router v10 (bezwarunkowy) | 5 tras: `summary`/`work-order`/`confirm`/`case`/`conversation` | `teresa.routes.ts` ok. l.277-380 |
| Backend case-intake, router v8 (za bramą) | 5 tras + `/turn` (jedyna wołająca `classifyIntent`) | `chat.routes.ts` ok. l.408-565 |
| Brama modułu na v8 | `caseIntakeModuleGate = createModuleGate('MODULE_CASE_WORKSPACE')`, DOMYŚLNIE ZAMKNIĘTA dla zwykłego usera | `chat.routes.ts:337-339`, `betaGate.middleware.ts` |
| `classifyIntent` — realny stan | regex PL/EN, deterministyczny, OD 2026-08-11 (CW-T-B) — NIE stub, NIE LLM, NIE drafuje work order | `chatExecutionService.ts:178-261` |
| `caseIntakeService.ts` — zakaz LLM wewnątrz | jawny, w nagłówku (pyt. otwarte #4): ekstrakcja to „the caller's job” | `caseIntakeService.ts` ok. l.166-169 |
| Wzorzec strukturalnego LLM już w repo, inna trasa | `ConfirmSchema` + `llmService.callStructured({...})` | `ai.routes.ts` ok. l.1490-1600, trasa `/chat/confirm` |
| Punkt składania metadanych dla realnej tury `/chat` | `onStreamDone`, DWA zapisy: `addMessageToConversation(...)` (trwały) i `addChatMessage(...)` (lokalny/legacy) | `UnifiedChatPanel.tsx` ok. l.1698, l.1733, l.1797 |
| Klient wywołujący `/chat/stream` | `UnifiedChatPanel` → `useAIStream.startStream` → `Api.chatWithAIStream` → `POST ${API_URL}/ai/chat/stream` | `useAIStream.ts:1363`, `api.ts` ok. l.2609+2708 |
| Klient apiIntake.ts — eksporty istniejące | `proposeConversationWorkOrder`, `getCurrentConversationWorkOrder`, `confirmConversationWorkOrder`, `getCaseForConversation`, `getConversationForCase` — **brak** wrappera dla `/turn`/nowej trasy | `apiIntake.ts` |
| Flaga klienta, wzorzec podwójny (klient+serwer) już działający | `ENABLE_TERESA_MINDMAP` | `useFeatureFlags.tsx:354-361`, `FeatureFlags.ts:39,190` |
| Słowniki PL/EN | pl **35312**, en **33172** (gałąź współdzielona z 374-377, RUCHOMA) | `public/locales/**` |
| Cztery bramki kanonu | `focus=0`, `list=0`, `artefakt=0`, `reach=1` (czerwona z przyczyn niezwiązanych — pliki test-only innych, równoległych dyżurów tej rundy) | patrz `§0.3` |
| Rejestr znalezisk, ostatnia sekcja | `AM` (Dyżur 373) | `docs/program/REJESTR_ZNALEZISK_20260903.md` |

**★★ Rodzeństwo równoległe tej samej rundy.** Dyżury 374, 375, 376, 377 pracują NA TYM SAMYM
markerze `c7f8b53660`, w OSOBNYCH worktree, RÓWNOCZEŚNIE z Tobą (potwierdzone: przy pisaniu
tej instrukcji porty 6446 i 6448 były ZAJĘTE — sesje 375 i 377 aktywne). Sprawdziłem
rozłączność plików: 375 ma `CaseIntakeConfirmCard.tsx`, `MessageRenderer.tsx` i
`UnifiedChatPanel.tsx` jawnie jako „cudze tereny”/TYLKO ODCZYT w swojej własnej instrukcji —
nie koliduje z Twoim zapisem. 376 ma `UnifiedChatPanel.tsx` i `useFeatureFlags.tsx` jako
TYLKO ODCZYT (cel: zrzut, nie zmiana). 374 pracuje na kluczach i18n INNYCH niż
`aiChat.caseIntake.*`. Żaden z nich nie wspomina `chatExecutionService.ts`, `teresa.routes.ts`
ani `apiIntake.ts` — te trzy pliki są Twoje wyłącznie w tej rundzie. Mimo to: gałąź `m03` jest
WSPÓLNA i w ruchu — liczby słowników i lista reachability BĘDĄ się zmieniać niezależnie od
Ciebie, dokładnie jak w dyżurze 371.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **2** wystąpienia `case_intake_proposal` w całym repo, **0**
producentów; `CaseIntakeConfirmCard` ma wyłącznie akcję Potwierdź, zero „Odrzuć”; router v10
ma 5 tras case-intake, router v8 ma te same 5 + `/turn`; `MODULE_CASE_WORKSPACE` jest dziś
zamknięty w `BETA_MENU_STATUS`; `classifyIntent` jest realnym regexem PL/EN od 2026-08-11, nie
stubem; wzorzec `llmService.callStructured` istnieje w `ai.routes.ts` przy trasie
`/chat/confirm`; `onStreamDone` zapisuje metadane w dwóch miejscach w `UnifiedChatPanel.tsx`;
słowniki pl **35312**/en **33172**; bramki `focus`/`list`/`artefakt` = 0, `reach` = 1.

**Jeśli Twój pomiar przeczy którejkolwiek z tych liczb — obowiązuje TWÓJ pomiar. Status bramy
modułu w szczególności może się zmienić bez ostrzeżenia (to jest przełącznik cross-cutting,
poza Twoją licencją) — jeśli okaże się `open`, zapisz to jako WYNIK, nie sprzeczność, i
zdecyduj, czy budowa na v10 nadal ma sens (odpowiedź: TAK, bo router v10 jest i tak
prostszy/bez zależności od stanu bramy — ale zapisz fakt).**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: KLIENT · TRASA · SERWIS · FLAGI · TESTY

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest
**ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Klient, nowy wrapper API** | `src/components/CaseWorkspace/apiIntake.ts` | **★ PEŁNA LICENCJA na DOPISANIE** nowej eksportowanej funkcji (np. `autoDetectCaseFromConversation`), wzorem istniejących 5 eksportów w tym samym pliku. Zakaz zmiany istniejących 5 eksportów | Brief |
| **Klient, producent** | `src/components/AIChat/UnifiedChatPanel.tsx` (**~7600 linii**) | **★ WĄSKA LICENCJA:** wyłącznie wewnątrz `onStreamDone` (ok. l.1698-1830, zweryfikuj) — wywołanie nowego wrappera gdy flaga klienta ON, i spread wyniku do `metadata` w OBU miejscach zapisu (`addMessageToConversation` i `addChatMessage`). Zero zmian gdziekolwiek indziej w tym pliku | Brief z `plik:linia` |
| **Klient, flaga** | `src/hooks/useFeatureFlags.tsx` | **★ WĄSKA LICENCJA:** jeden nowy wpis w `DEFAULT_FLAGS`, `defaultValue: false`, wzorem `ENABLE_TERESA_MINDMAP`. Zakaz zmiany istniejących wpisów | — |
| **Klient, metadane (reużywasz, nie zmieniasz)** | `src/utils/chatPersistence.ts` (`buildPersistedAiResponseMetadata`) | **TYLKO ODCZYT** — merge robisz spreadem w miejscu wywołania w `UnifiedChatPanel.tsx`, nie zmieniasz tej funkcji | — |
| **Klient, render karty (reużywasz, nie zmieniasz)** | `src/components/AIChat/MessageRenderer.tsx` | **TYLKO ODCZYT domyślnie.** Gałąź `case_intake_proposal` (ok. l.884-897) już poprawnie renderuje kartę z właściwymi properami. **WĄSKA LICENCJA WARUNKOWA:** wolno naprawić WYŁĄCZNIE jeśli `R1` udowodni w niej realny, konkretny defekt (np. zły prop) — z dowodem w raporcie | Brief |
| **Klient, sama karta (reużywasz, nie zmieniasz)** | `src/components/AIChat/CaseIntakeConfirmCard.tsx` | **TYLKO ODCZYT** — jej kontrakt (Potwierdź, brak Odrzuć) jest DANY, nie zmieniasz go w tym dyżurze bez wpisania jako pytania w R7 | Brief |
| **Serwer, nowa trasa** | `server/src/routes/v10/teresa.routes.ts` (**380 linii**) | **★ WĄSKA LICENCJA:** wyłącznie DOPISANIE jednego nowego bloku `router.post('/case-intake/conversations/:conversationId/auto-detect', ...)`, tym samym middleware/kształtem co istniejące 5 tras obok. Zakaz zmiany istniejących 5 tras | Brief z `plik:linia` |
| **Serwer, nowa funkcja (RDZEŃ)** | `server/src/services/v8/chatExecutionService.ts` (**481 linii**) | **★ PEŁNA LICENCJA na DOPISANIE** `draftCaseWorkOrderFromConversation` (nowa funkcja, siostra `classifyIntent`, nie modyfikacja). Zakaz zmiany ciała `classifyIntent` (l.178-261) | Brief |
| **Serwer, `caseIntakeService.ts`** | `server/src/services/caseWorkspace/caseIntakeService.ts` | **★★★ TYLKO ODCZYT — BEZWZGLĘDNIE.** Plik sam dokumentuje zakaz LLM wewnątrz (musi zostać deterministyczny). Żadna litera się nie zmienia | Brief z `plik:linia`, cytat pyt. otwartego #4 |
| **Serwer, wzorzec LLM (reużywasz, nie zmieniasz)** | `server/src/routes/ai.routes.ts` (trasa `/chat/confirm`, ok. l.1386-1624) | **TYLKO ODCZYT** — `ConfirmSchema`+`llmService.callStructured` już wystarczają jako wzorzec | — |
| **Serwer, flaga** | `server/src/config/FeatureFlags.ts` | **★ WĄSKA LICENCJA:** jeden nowy wpis w `FeatureFlagsSchema` + jeden wpis w runtime-flags object, wzorem `ENABLE_TERESA_MINDMAP_SEARCH`, default OFF | — |
| **Serwer, brama modułu (reużywasz, nie zmieniasz)** | `server/src/middleware/betaGate.middleware.ts`, `Gateway.ts`, `server/src/routes/v8/chat.routes.ts` | **TYLKO ODCZYT** — świadoma decyzja: buduj na v10, omiń bramę. Zero zmian tutaj | Brief |
| **Nowe testy** | `server/src/routes/__tests__/day378.*.pg.test.ts`, `src/components/AIChat/__tests__/day378.*.test.tsx` (NOWE, `git add -f`) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18`/`Z31` | — |
| **Dev-render** | `dev-render/screens/chat-case-intake-proposal.tsx` (**NOWY**) | **★ PEŁNA LICENCJA**, wzorzec `chat-split-teresa-right.tsx` (TYLKO ODCZYT jako wzorzec) | — |
| **Nowe dowody** | `evidence/day378-case-intake-producer/**` (**NIE ISTNIEJE — tworzysz**) | **★ PEŁNA LICENCJA**; `git add -f` | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja, litera sprawdzona TUŻ PRZED COMMITEM | — |
| **Słowniki, WYŁĄCZNIE nowe klucze** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **WĄSKA LICENCJA:** wyłącznie NOWE klucze pod prefiksem `aiChat.caseIntake.*` (sprawdź grepem, że prefiks nie istnieje, przed dodaniem). Zakaz zmiany istniejących kluczy | Brief |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY378_CASE_INTAKE_PRODUCER_REPORT.md` (**NOWY**) | `R7` — jedyny nowy dokument rejestrowy (`Z13`) | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł** | Rekomendacja w raporcie |
| **Materiał źródłowy** | `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**`, `CODEX_DAY371_KARTY_PROPOZYCJI_REPORT.md`, `ODBIOR_371.md`, ledger `OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** — wejście, nie dokument do edycji | — |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia`, idziesz dalej |

**★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Plik opisany jako „PEŁNA/WĄSKA
LICENCJA” — masz pozwolenie, STOP z tytułu „nie wolno mi” jest NIEZASADNY. Plik nieopisany w
ogóle — domyślnie TYLKO DO ODCZYTU.

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC (ale MOGA rosnac niezaleznie od Ciebie -- galaz wspoldzielona z 374-377)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby (chwiejne): pl 35312+, en 33172+ (rosnace, bo rownolegle pracuja 374-377)

# (b) trzy bezpieczniki MAJA konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby: wszystkie 0

# (c) reach JEST JUZ CZERWONY na markerze -- notujesz liste PO NAZWACH, nie naprawiasz
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   oczekiwane: exit 1, lista "New test-only files" rosnaca niezaleznie od Ciebie (pliki
#   rownoleglych dyzurow 374-377) -- PO Twoich zmianach lista ma zawierac DODATKOWO Twoje
#   wlasne nowe pliki testowe, nazwane jawnie w raporcie, i ZERO plikow zniknietych sprzed
#   Twojej pracy
```

**Jeżeli `focus-canon`/`list-canon`/`artefakt` zaczerwienią się OD TWOJEJ zmiany — naprawiasz
KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`). **`reach` zostaje czerwony niezależnie od
Ciebie — nie jest to Twoja bramka do gaszenia w tym dyżurze.**

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | producenci `case_intake_proposal` w repo | `0` | komenda (1) z `§0.3` | TAK — `grep -rn` bez wycinania |
| 2 | akcje na `CaseIntakeConfirmCard` (przyciski/handlery) | `1` (tylko Potwierdź) | komenda (2) | TAK — czyta plik komponentu wprost |
| 3 | trasy case-intake na v10 vs v8 | `5` / `5+1` | komenda (3) | TAK |
| 4 | status bramy `MODULE_CASE_WORKSPACE` | `closed` (na dzień pisania) | komenda (4), ręczna lektura | TAK — **zweryfikuj, to jest cross-cutting i może się zmienić bez ostrzeżenia** |
| 5 | linie realnego ciała `classifyIntent` | `178`-`261` (regex PL/EN, nie stub) | komenda (5) | TAK |
| 6 | linie wzorca `llmService.callStructured` w `ai.routes.ts` | ok. `1490`-`1600` | komenda (6) | TAK — dowód, że wzorzec istnieje i jest używany gdzie indziej |
| 7 | miejsca zapisu metadanych w `onStreamDone` | `2` (`addMessageToConversation`, `addChatMessage`) | komenda (7) | TAK — **to jest `R3`, oba miejsca muszą dostać spread, inaczej karta zniknie po F5 (kształt D-3 z 371, w NOWYM kodzie)** |
| 8 | liście słowników PL/EN | rosnące, patrz wyżej | blok (a) „WARUNKÓW WSPÓLNYCH” | TAK, wartość CHWIEJNA — licz PRZED i PO |
| 9 | `reach` exit code i lista nazw | `1`, rosnąca niezależnie od Ciebie | blok (c) | TAK — mianownik już zepsuty PRZED Tobą |
| 10 | wywołania `llmService`/mock przy fladze serwera OFF | `0` (Ty tworzysz dowód) | Twój nowy test/licznik | TAK — **to jest `R4`, dowód że OFF = zero kosztu** |
| 11 | wierszy `case_core` po nie-potwierdzeniu propozycji | `0`, nawet po refresh/drugiej turze | Twój nowy pg-test | TAK — **to jest `R5`** |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`src/components/CaseWorkspace/apiIntake.ts` (nowa funkcja, dopisana) ·
`server/src/routes/v10/teresa.routes.ts` (nowa trasa, dopisana) ·
`server/src/services/v8/chatExecutionService.ts` (nowa funkcja, dopisana) ·
`src/hooks/useFeatureFlags.tsx` (nowy wpis) ·
`server/src/config/FeatureFlags.ts` (nowy wpis) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY378_CASE_INTAKE_PRODUCER_REPORT.md` (NOWY) ·
`evidence/day378-case-intake-producer/**` (NOWY) ·
`dev-render/screens/chat-case-intake-proposal.tsx` (NOWY) ·
nowe pliki testowe front i serwer.

**Zapisujesz WARUNKOWO:**
`src/components/AIChat/UnifiedChatPanel.tsx` (WYŁĄCZNIE wewnątrz `onStreamDone`) ·
`public/locales/{pl,en}/translation.json` (WYŁĄCZNIE nowe klucze `aiChat.caseIntake.*`) ·
`src/components/AIChat/MessageRenderer.tsx` (TYLKO jeśli `R1` udowodni konkretny defekt w
gałęzi `case_intake_proposal`, z dowodem) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `server/src/services/caseWorkspace/caseIntakeService.ts`,
`server/src/routes/v8/chat.routes.ts`, `server/src/middleware/betaGate.middleware.ts`,
`server/src/Gateway.ts`, `server/src/services/ApiGateway.ts`,
`src/components/AIChat/CaseIntakeConfirmCard.tsx`,
`src/utils/chatPersistence.ts`, `src/services/api/baseClient.ts`,
istniejące 5 eksportów `apiIntake.ts`, istniejące ciało `classifyIntent`
(`chatExecutionService.ts:178-261`), `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`
(wszystkie 16), `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`,
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `.github/workflows/**`, `server/migrations/**` (ten dyżur nie
tworzy migracji — schemat `case_core`/outbox jest niezmieniony), `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day378-case-intake-producer
git diff --name-only --cached | tee /private/tmp/cx-day378-case-intake-producer-artefakty/staged.txt
bash -c "grep -iE 'caseIntakeService\.ts|chat\.routes\.ts|betaGate\.middleware|Gateway\.ts|ApiGateway\.ts|CaseIntakeConfirmCard\.tsx|chatPersistence\.ts|baseClient\.ts|MODULE_ACCEPTANCE|reachability\.baseline|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|AUDYT_CZAT_PRZYCISKI' /private/tmp/cx-day378-case-intake-producer-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
git diff --cached -- src/components/AIChat/UnifiedChatPanel.tsx | grep -c "^[+-]"
#   oczekiwane: male (jeden blok w onStreamDone) -- duzy diff = naruszenie waskiej licencji
git diff --cached -- server/src/services/v8/chatExecutionService.ts | grep -c "^[+-]"
#   oczekiwane: wylacznie DODANE linie nowej funkcji, ZERO usunietych/zmienionych linii classifyIntent
```

---

## R0 — TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Producent idzie WYŁĄCZNIE na router v10, nigdy na v8.** `caseIntakeModuleGate` na v8
jest domyślnie zamknięta dla zwykłego usera — flaga funkcyjna ON na trasie zamkniętej bramą
to flaga-fantom drugiego stopnia. Zweryfikuj status bramy SAM przed budową (komenda 4).

**(2) Zero LLM w `caseIntakeService.ts`, zawsze i bezwzględnie.** Ten plik musi zostać
deterministyczny (ten sam `workOrder` → ten sam digest, zawsze). Cała nowa logika
klasyfikacji/ekstrakcji żyje w `chatExecutionService.ts` (caller), nigdy tam.

**(3) `classifyIntent` (regex, tani) jest filtrem PRZED strukturalnym LLM, nie zamiennikiem.**
Wołaj drogi krok (LLM) tylko dla `governed_work`/`ambiguous`, nigdy dla `conversational` — to
jest jednocześnie oszczędność kosztu i bezpiecznik zgodny z filozofią samego `classifyIntent`
(cytat w jego nagłówku: „ambiguous” jest bezpieczne, bo może tylko PROPONOWAĆ, nigdy
POTWIERDZAĆ).

**(4) Metadane muszą przetrwać F5 — spread w OBU miejscach zapisu `onStreamDone`.** Jeżeli
dopiszesz `metadata.type='case_intake_proposal'` tylko do `addChatMessage` (lokalny store) a
nie do `addMessageToConversation` (trwały zapis) — albo odwrotnie — karta zniknie po
odświeżeniu strony. To jest DOKŁADNIE kształt defektu D-3 z dyżuru 371, tym razem w kodzie,
który sam piszesz. Dowód: (re)załaduj konwersację z serwera po propozycji, karta MUSI się
nadal renderować.

**(5) Awaria wywołania auto-detect NIGDY nie wywala normalnej tury czatu.** Sieć/timeout/
serwer OFF/model niedostępny = cichy `console.error`, kontynuacja bez metadanych case-intake.
Test na to jest obowiązkowy.

**(6) Dwie flagi, obie domyślnie OFF, obie realne (nie fantomy).** Dowód: flaga klienta ON +
flaga serwera OFF = zero wywołań `draftCaseWorkOrderFromConversation` (klient próbuje wywołać
trasę, serwer odmawia/zwraca `informational` bez LLM). Flaga serwera ON + flaga klienta OFF =
klient nigdy nie woła trasy. Obie ON = pełny przepływ.

**Wymagany dowód:** sześć zdań w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita.

## R1 — KROK 0: POMIAR ARCHITEKTURY (rdzeń pomiarowy, obowiązkowy przed R2/R3)

Zanim napiszesz jedną linię produkcyjnego kodu, zmierz i zapisz z dowodem `plik:linia`:

1. Świeży `grep -rn 'case_intake_proposal' src server` — potwierdź **2** trafienia, zero
   producentów (albo zapisz swój wynik, jeśli inny).
2. Realny kontrakt akcji `CaseIntakeConfirmCard.tsx` — czy jest WYŁĄCZNIE „Potwierdź”, czy
   coś się zmieniło. To determinuje kształt dowodu w `R5` (brak wiersza = brak akcji, nie
   osobny stan „odrzucono”, chyba że znajdziesz inaczej).
3. Aktualny status `BETA_MENU_STATUS['MODULE_CASE_WORKSPACE']` — `open` czy `closed`. Jeśli
   `open`, zapisz to jako WYNIK (nie zmienia decyzji budować na v10 — v10 jest i tak prostszy
   i nie zależy od stanu tej bramy — ale zapisz fakt uczciwie).
4. Dokładne linie realnego ciała `classifyIntent` na TWOIM markerze — potwierdź, że to
   regex PL/EN, nie LLM, nie stub. Zacytuj 2-3 zdania z jego własnego komentarza o zamianie
   z 2026-08-11.
5. Dokładne linie `onStreamDone` w `UnifiedChatPanel.tsx` i OBU miejsc zapisu metadanych
   (`addMessageToConversation`, `addChatMessage`) — to jest punkt wpięcia dla `R3`.
6. Dokładne linie wzorca `llmService.callStructured` w `ai.routes.ts` (trasa `/chat/confirm`)
   — `modelRouter.select`, `ConfirmSchema`, wywołanie, obsługa błędu.
7. Potwierdź nazwę nowej flagi jest wolna (`grep -rn '<TWOJA_NAZWA>' server/src src` = 0
   trafień) w OBU plikach flag.

**Wymagany dowód:** tabela siedmiu wierszy (pomiar · wynik · zgodność z instrukcją TAK/NIE ·
`plik:linia`). **Commit po `R1`** (dopuszczalny commit tylko-dokumentacyjny, np. notatka w
`evidence/`, jeśli nie ma jeszcze kodu do zacommitowania).

## R2 — SERWER: `draftCaseWorkOrderFromConversation` + nowa trasa v10 (rdzeń)

1. **Nowa funkcja w `chatExecutionService.ts`** (siostra `classifyIntent`, NIE modyfikacja):
   `draftCaseWorkOrderFromConversation(message, organizationId, contextSnapshotId)` —
   wywołuje NAJPIERW `classifyIntent` (tani filtr); jeśli wynik to `conversational`, zwraca
   natychmiast `{ looksLikeNewCase: false }` BEZ żadnego wywołania LLM. W przeciwnym razie
   (`governed_work`/`ambiguous`) woła `llmService.callStructured` (wzorzec z `ai.routes.ts`
   `/chat/confirm`: `modelRouter.select`, zod schema, `systemPrompt`+`messages`) z schematem
   zwracającym `{ looksLikeNewCase: boolean, confidence: number, goal?, scope?: string[],
   expectedOutcome?, caseName? }`. Cała funkcja jest osłonięta serwerową flagą (patrz `R4`) —
   flaga OFF = funkcja zwraca `{ looksLikeNewCase: false }` NATYCHMIAST, przed jakimkolwiek
   wywołaniem `classifyIntent` czy LLM.
2. **Nowa trasa `POST /case-intake/conversations/:conversationId/auto-detect`** w
   `teresa.routes.ts`, TEN SAM kształt middleware co istniejące trasy obok (`verifyToken,
   attachV8Context, caseWorkspaceHandler(...)`). Ciało: `{ message: string, contextSnapshotId?:
   string }`. Woła `draftCaseWorkOrderFromConversation`; jeśli `looksLikeNewCase === true` i
   pola work orderu są kompletne (goal/scope/expectedOutcome niepuste), woła ISTNIEJĄCE
   `caseIntakeService.proposeConversationWorkOrder` (identyczne wywołanie jak w `/summary`) i
   zwraca `{ mode: 'work_order_proposed', workOrder, workOrderId, workOrderDigest,
   alreadyProposed, caseCreated: false }`. W przeciwnym razie zwraca `{ mode: 'informational'
   | 'work_order_required', ... }` (ZERO zapisu do `caseIntakeService` w tej gałęzi).
3. **Dowód idempotencji.** Ta sama treść rozmowy wywołana dwa razy → drugie wywołanie dostaje
   `alreadyProposed: true` z TYM SAMYM digestem (własność już wbudowana w
   `proposeConversationWorkOrder`, Ty tylko dowodzisz, że Twoja nowa trasa jej nie psuje).
4. **Dowód roli.** Test z JWT zwykłego membera (NIE OWNER/ADMIN) przechodzi przez nową trasę
   v10 bez 403 — kontrastowo, ten sam JWT na `/api/v8/chat/.../case-intake/turn` dostaje 403
   (dowód, że decyzja „buduj na v10” była słuszna, nie tylko deklaratywna).

**Wymagany dowód:** diff nowej funkcji + nowej trasy · trzy przebiegi (conversational→zero
LLM, governed_work z pewnym draftem→proposal, governed_work z niepewnym draftem→
work_order_required) z dosłownymi odpowiedziami · dowód idempotencji · dowód roli (membera
vs 403 na v8). **Commit po `R2`.**

## R3 — KLIENT: producent w `UnifiedChatPanel.tsx` (rdzeń)

1. **Nowy wrapper w `apiIntake.ts`**: `autoDetectCaseFromConversation(conversationId, message,
   contextSnapshotId)` wołający nową trasę v10, wzorem istniejących pięciu funkcji (ten sam
   `fetchWithRetry`/`getHeaders`/`handleResponse`/`toCommandFailure`).
2. **Wpięcie w `onStreamDone`**: PO obliczeniu `safeText`/`persistConversationId`, PRZED
   oboma wywołaniami zapisu, GDY flaga klienta ON: wywołaj wrapper (best-effort, `try/catch`,
   błąd = cichy `console.error` + kontynuacja). Jeśli `mode === 'work_order_proposed'`,
   zbuduj `caseIntakeMeta = { type: 'case_intake_proposal', proposal: { conversationId:
   persistConversationId, workOrder, workOrderDigest } }`.
3. **Spread w OBU miejscach zapisu**: `metadata: { ...buildPersistedAiResponseMetadata({...}),
   ...(caseIntakeMeta || {}) }` w wywołaniu `addMessageToConversation`, ORAZ analogiczny
   spread w obiekcie `metadata` przekazywanym do `addChatMessage`. Zero zmian w
   `buildPersistedAiResponseMetadata` samej (`chatPersistence.ts` zostaje TYLKO ODCZYT).
4. **Dowód przetrwania F5.** Po propozycji: (re)załaduj konwersację z serwera (symulacja
   odświeżenia — test RTL montujący `MessageRenderer`/`UnifiedChatPanel` z wiadomością
   pobraną PONOWNIE, nie z tej samej instancji) — karta `CaseIntakeConfirmCard` nadal się
   renderuje.
5. **Dowód niezawodności.** Symuluj błąd sieci/500 z nowej trasy — normalna odpowiedź Teresy
   nadal się zapisuje i wyświetla, bez wyjątku nieobsłużonego, bez utraty wiadomości.
6. **Dowód mutacyjny.** Cofnij `R3` (usuń wywołanie wrappera) — test z punktu 4 ma
   ZACZERWIENIĆ SIĘ; przywróć — ma ZZIELENIEĆ; `git diff` po cofnięciu pusty.

**Wymagany dowód:** diff wrappera + wpięcia · test przetrwania F5 (RED→GREEN) · test
niezawodności na błędzie sieci · dowód mutacyjny. **Commit po `R3`.**

## R4 — DWIE FLAGI, DOMYŚLNIE OFF, REALNE

1. Klient: nowy wpis w `DEFAULT_FLAGS` (`useFeatureFlags.tsx`), `defaultValue: false`.
2. Serwer: nowy wpis w `FeatureFlagsSchema` + runtime-flags object (`FeatureFlags.ts`),
   default `false`, czytany PER-CALL (nie cache'owany na starcie procesu) wewnątrz
   `draftCaseWorkOrderFromConversation` — wzorem `isTeresaMindmapSearchEnabled()`
   (`orgRetrievalShared.ts`, TYLKO ODCZYT jako przykład stylu, nie kopiujesz 1:1 jeśli kształt
   nie pasuje).
3. **Dowód „OFF = zero kosztu”**: z flagą serwera OFF, wywołaj nową trasę v10 z treścią
   ewidentnie opisującą nową sprawę (np. „Chcę zlecić przygotowanie planu restrukturyzacji
   działu X”) — zero wywołań `llmService`/mocka (licznik w teście), odpowiedź
   `mode: 'informational'` lub `'work_order_required'`, zero nowych wierszy w tabeli
   zdarzeń `caseIntakeService` używa (outbox/`case_intake_*` — zweryfikuj nazwę w `R1`).
4. **Dowód „obie ON = pełny przepływ”**: z obiema flagami ON, ta sama treść → `mode:
   'work_order_proposed'`, karta renderuje się w kliencie (test RTL z flagą wymuszoną ON przez
   `FeatureFlagsProvider`/kontekst testowy).

**Wymagany dowód:** cztery kombinacje flag (OFF/OFF, ON/OFF, OFF/ON, ON/ON) z dosłownym
zachowaniem każdej, w tym licznik wywołań LLM dla przypadku serwer-OFF. **Commit po `R4`.**

## R5 — PARA DOWODÓW NA REALNYM POSTGRESIE (rdzeń)

**Rola aktora we WSZYSTKICH testach tej pozycji: zwykły member organizacji, NIGDY
OWNER/ADMIN** — bo to jest dokładnie scenariusz, w którym brama modułu na v8 (gdyby ktoś
przez pomyłkę budował tam) by ukryła defekt.

1. **Fikstura minimalna**: org + zwykły member + konwersacja realna (wzorem
   `teresaProductionIntake.pg.test.ts`/`chatIntake.pg.test.ts`, TYLKO ODCZYT jako przykład).
2. **Ścieżka potwierdzenia (para dowodów)**: (a) auto-detect proponuje pracę → wiadomość z
   `metadata.type='case_intake_proposal'` → kliknięcie/wywołanie `confirmConversationWorkOrder`
   (ISTNIEJĄCE, nietknięte) → `201`, wiersz w `case_core` → (re)odczyt konwersacji z serwera →
   karta nadal pokazuje stan „utworzono”/otwiera Case (via `getCaseForConversation`,
   ISTNIEJĄCE); (b) BRAK potwierdzenia (user nie klika) → nawet po kolejnej turze rozmowy i
   odświeżeniu, ZERO wierszy `case_core` dla tej konwersacji, a druga próba auto-detect na
   TEJ SAMEJ treści zwraca `alreadyProposed: true` z TYM SAMYM digestem (nie tworzy DRUGIEJ
   propozycji).
3. **Izolacja organizacji**: aktor z organizacji B nie widzi/nie może potwierdzić propozycji
   z organizacji A (ISTNIEJĄCE `requireOrgMember`/`requireCaseAccess` w `caseIntakeService.ts`
   — dowodzisz, że Twoja nowa trasa v10 ich NIE omija, nie budujesz nowej logiki izolacji).
4. **Mutacja odwrotna**: cofnij `R2`/`R3` przez `cp` ze `SCRATCH` — nowy pg-test ma
   ZACZERWIENIĆ SIĘ; przywróć — ma ZZIELENIEĆ; `git diff` po cofnięciu pusty.

**Wymagany dowód:** dosłowne komendy i odpowiedzi obu ścieżek · odczyt `case_core` z bazy
potwierdzający (a) dokładnie jeden wiersz, (b) zero wierszy · dowód izolacji organizacji ·
dowód mutacyjny. **Commit po `R5`.**

## R6 — ZRZUTY DEV-RENDER (bez logowania Piotra, flaga OFF w produkcie)

Wzorem `dev-render/screens/chat-split-teresa-right.tsx` (montuje realny `UnifiedChatPanel`,
TYLKO ODCZYT jako wzorzec): nowy plik `dev-render/screens/chat-case-intake-proposal.tsx`
montujący realny `UnifiedChatPanel` z flagą klienta wymuszoną ON WYŁĄCZNIE w tym harnessie
(nigdy w configu produktu) i z wiadomością mockującą propozycję Case (albo realnym
wywołaniem przeciw lokalnemu serwerowi z flagą serwera ON — wybierz taniej). Zrzuty: PL i EN,
light i dark, stan „do potwierdzenia” i stan „zatwierdzono/otwórz zlecenie” — CZTERY zrzuty
minimum, zgodnie z 40-punktową listą czekowania triady jeśli dotyczy (to jest karta w
strumieniu czatu, nie ekran listowy — jeśli triada nie ma zastosowania, zapisz to w raporcie
jednym zdaniem z uzasadnieniem). Flaga zostaje `OFF` w domyślnym configu produktu — akcept
Piotra to osobny krok nadzorcy, NIE część tego dyżuru.

**Wymagany dowód:** cztery zrzuty w `evidence/day378-case-intake-producer/dev-render/`,
ścieżka pliku dev-render, potwierdzenie że flaga w produkcyjnym configu (`useFeatureFlags.tsx`
`DEFAULT_FLAGS`) zostaje `false`. **Commit po `R6`.**

## R7 — RAPORT, REJESTR ZNALEZISK, PYTANIA DO WŁAŚCICIELA

Raport zawiera: pomiar `R1` w całości · diff i dowody `R2`/`R3` · cztery kombinacje flag z
`R4` · parę dowodów `R5` (potwierdzenie/brak potwierdzenia, izolacja, mutacja) · cztery
zrzuty `R6` · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE”** · obowiązkowy akapit `§0.2e`
dla każdego uruchomionego pakietu testów.

★★ **Osobna, obowiązkowa sekcja: „DLACZEGO v10, NIE v8”.** Cytat statusu bramy modułu
zmierzony w `R1` + dowód roli z `R2` punkt 4 (member przechodzi v10, dostaje 403 na v8).

★★ **Osobna, obowiązkowa sekcja: „KOSZT I CZĘSTOŚĆ LLM”.** Jaki odsetek próbki testowych
wiadomości trafia w `governed_work`/`ambiguous` (czyli wywołuje drogi krok) — nawet zgrubny
pomiar na testowych fikstury wystarczy, ale MUSI być zmierzony, nie zgadnięty.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** NIE MOŻE być pusta. Obowiązkowo
zawiera: (1) „Karta `CaseIntakeConfirmCard` ma dziś WYŁĄCZNIE przycisk «Potwierdź» — czy
brak jawnego «Odrzuć» jest zamierzony (user po prostu nie klika, propozycja wisi bez
skutku), czy potrzebny jest jawny stan «odrzucono», żeby karta nie wracała/nie mieszała się
w kolejnych turach rozmowy?”; (2) „Ilu-krotnie w jednej rozmowie auto-detect ma próbować
proponować Case, jeśli user zignoruje pierwszą propozycję i kontynuuje rozmowę o tym samym
temacie — raz na konwersację, czy przy każdej turze klasyfikowanej jako `governed_work`?”
(ten dyżur implementuje najprostszy bezpieczny wariant — `alreadyProposed` chroni przed
duplikatem TEJ SAMEJ treści, ale NIE chroni przed nową propozycją dla ZMIENIONEJ treści tej
samej rozmowy — opisz to wprost jako granicę tego, co zbudowałeś).

★ Zanim dopiszesz cokolwiek do `REJESTR_ZNALEZISK_20260903.md`, sprawdź literę TUŻ PRZED
COMMITEM: `bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
— piszą równolegle inni autorzy tej samej rundy (374-377).

**Commit po `R7`.**

## Próg odbioru

**Producent działa end-to-end za dwiema fladami domyślnie OFF:** rozmowa opisująca nową
sprawę, po realnej turze Teresy na `/chat`, z obiema flagami ON, produkuje wiadomość z
`metadata.type='case_intake_proposal'`, która PRZETRWA odświeżenie strony. Kliknięcie
„Potwierdź” tworzy DOKŁADNIE jeden wiersz `case_core`, trwały po odświeżeniu. Brak kliknięcia
= zero wierszy, nawet po kolejnej turze. Zwykły member (nie admin) ma pełny dostęp — dowód
kontrastowy z 403 na v8. `caseIntakeService.ts` pozostaje bajtowo identyczny z markerem.
Obie flagi domyślnie OFF w kodzie wydanym. Cztery zrzuty dev-render dostarczone. Sekcja
„PYTANIA DO WŁAŚCICIELA” niepusta.

Odbiorca odrzuci dyżur, w którym: producent zbudowany na trasie v8 za bramą modułu (dowód
403 dla zwykłego usera z fladze ON); `caseIntakeService.ts` zmieniony w jakikolwiek sposób;
metadana dopisana tylko do jednego z dwóch miejsc zapisu w `onStreamDone` (karta znika po
F5); flaga serwera ON generuje wywołania LLM nawet dla wiadomości `conversational`; flaga
którejkolwiek strony domyślnie ON w wydanym kodzie; brak dowodu na realnym PostgreSQL z rolą
zwykłego membera; sekcja pytań pusta.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „R1 zmierzony w całości (brama
modułu: closed, classifyIntent: realny regex, punkt wpięcia: onStreamDone dwa miejsca), R2/R3
zbudowane i połączone, R4 obie flagi OFF z dowodem zero-kosztu, R5 para dowodów na realnym PG
z rolą membera, R6 cztery zrzuty dostarczone” — **jest pełnowartościowym wynikiem**, nawet
jeśli zatrzymasz się po R5 z R6/R7 do dokończenia w kolejnej sesji (zapisz to jawnie w pliku
postępu).

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: sprawdzasz warunek
NA BIEŻĄCEJ LINII, nie ponownie na starym markerze. Status bramy `MODULE_CASE_WORKSPACE` w
szczególności — sprawdź go na nowo, mógł się zmienić. Liczby słowników i lista reachability —
ta gałąź jest w ruchu (374-377 równolegle), licz na nowo.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Zbuduj producenta na istniejącym `caseIntakeService`” vs „zero LLM w `caseIntakeService.ts`” | `R2`: nowa funkcja ekstrakcji żyje w `chatExecutionService.ts` (caller), `caseIntakeService.ts` woła się identycznie jak dziś, z gotowym `workOrder` |
| „Teresa ma rozpoznawać z treści rozmowy” vs „minimalizuj koszt LLM” | `R2` punkt 1: `classifyIntent` (regex, darmowy) jako filtr PRZED strukturalnym LLM; LLM tylko dla `governed_work`/`ambiguous` |
| „Producent ma działać dla realnego usera” vs „istniejąca trasa `/case-intake/turn` już woła `classifyIntent`” | `R1`/`R0.1`: `/turn` stoi za bramą domyślnie zamkniętą — nowa trasa idzie na v10 (bezwarunkowy), nie rozszerza v8 |
| „Metadana ma przetrwać F5” vs „dwa niezależne miejsca zapisu w `onStreamDone`” | `R3` punkt 3: spread w OBU miejscach, dowód (re)odczytu z serwera w punkcie 4 |
| „Nowy ekran wymaga flagi” vs „backend ma działać dla dowodów R5 na realnym PG” | `R4`/`R5`: testy PG wołają trasę bezpośrednio z flagą serwera wymuszoną ON w env testu — produkt wydany ma obie flagi OFF, to się nie wyklucza |
| „Karta ma stan „odrzucono”” (założenie z brief nadzorcy) vs „karta ma dziś wyłącznie Potwierdź” | `R1` pkt 2 + `R7`: zmierzony realny kontrakt karty, „odrzucenie” = brak wiersza po nieskończonym czasie, NIE osobny stan UI; pytanie do właściciela wpisane wprost |
| „Dopisz sekcję do rejestru znalezisk” vs „równolegle piszą 374-377” | `R7`: literę sprawdzasz komendą tuż przed commitem |
| „Zmierz liczby z instrukcji” vs „gałąź współdzielona z czterema równoległymi dyżurami” | „Zmierz moje liczby sam”: dla słowników/reach liczy się WŁASNY świeży pomiar |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 8 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — wszystkie ścieżki `plik:linia` sprawdzone `grep -n`/`sed -n` na worktree z markera `c7f8b53660`; nowa trasa/funkcja/plik dev-render/pliki testowe jawnie oznaczone NIE ISTNIEJĄ |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 11 wierszy, wszystkie zmierzone przy wydaniu poza wierszami 10-11 (jawnie oznaczone „Ty tworzysz dowód”) |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — klient (wrapper/producent/flaga/metadane/render/karta) · serwer (trasa/funkcja/serwis-zakaz/wzorzec-odczyt/flaga/brama-odczyt) · testy · dev-render · dowody · rejestr · słowniki · raport · macierz · materiał źródłowy · reszta |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R2` dotyka wyłącznie `chatExecutionService.ts` (nowa funkcja) + `teresa.routes.ts` (nowy blok); `R3` wyłącznie `apiIntake.ts` (nowa funkcja) + `UnifiedChatPanel.tsx` (`onStreamDone`); `R4` dwa pliki flag; `R5`/`R6` tylko nowe pliki |
| 6 | Przydział zasobów wyłącznych sprawdzony wobec dyżurów równoległych | TAK — 6449/5589 wolne (`lsof` przy wydaniu, 6446/6448 zajęte przez 375/377 potwierdzone), brak kontenera/worktree `cx-day378`/`codex/day378-*`; sprawdzone grepem że 374-377 NIE deklarują zapisu do `chatExecutionService.ts`/`teresa.routes.ts`/`apiIntake.ts` |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — cztery pułapki w `PULAPKA_WLASCIWA_TEMU_MODULOWI`: brama modułu cichym blokerem, stary komentarz `caseIntakeService.ts` nieaktualny, dwa miejsca zapisu metadanych, częstość `ambiguous` a koszt LLM |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów spoza repo; każdy kontekst ma ścieżkę albo komendę |
| 10 | Klauzula sprzeczności obecna, zero pól szablonu | TAK — kontrola generatora przy wydaniu: zero pozostałych niewypełnionych pól szablonu |
