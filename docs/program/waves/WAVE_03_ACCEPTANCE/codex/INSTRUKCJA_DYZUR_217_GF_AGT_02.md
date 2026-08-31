> ★★ **AKTUALIZACJA MARKERA (31.08, nadzorca).** Marker podniesiony do `89630f9a8a`.
> Powód: od pierwotnego markera scalono dyżury **211, 213, 214, 215** oraz FIX-y do
> 204/207/209/210. GF-AGT-02 sprawdza CAŁY łańcuch, więc musi jechać na stanie, który
> te scalenia zawiera — inaczej testowałby produkt sprzed połowy dzisiejszej pracy.
> **Stan wejściowy jest NOWSZY niż opisy w treści tej instrukcji.** Zmierz go sam na
> starcie (numery linii mogły się przesunąć) i nie ufaj listom plików w treści.
> W szczególności obowiązuje już: zapis zadania z czatu przez wspólny writer
> `personalTask/createPersonalTaskService.ts`, wspólny filtr zasięgu
> `ai/knowledgeDocAccessFilter.ts`, indeksacja raportów, adopcja szkicu za flagą
> `ENABLE_TERESA_ADOPT_CHAT_DRAFT`.

# INSTRUKCJA DYŻURU nr 217 — Codex — „GF-AGT-02 — pierwszy pelny przebieg procesu konsultingowego, jeden dyzur, osiem ogniw: rozmowa z Teresa -> narzedzia READ (206) -> kontekst organizacji w promptcie (205) -> propozycja zapisu (207, scalona PO markerze — wymaga fast-forward Twojego worktree) -> zatwierdzenie -> zadanie realna droga przez createPersonalTaskService (ta sama co My Work) + dokument realna droga przez Document Studio -> indeksacja do bazy wiedzy z poprawnym zasiegiem (209+210) -> DRUGA rozmowa cytuje to, co powstalo w pierwszej. Zawiera R3 dyzuru 206 (dowod REALNYM modelem, budzet DEC-317 dotad 0/2 wykorzystany). Uczciwy werdykt dopuszcza slowo 'nie dziala' per ogniwo"

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
> **wyłącznie** `/private/tmp/cx-day217-gf-agt-02`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `89630f9a8a`**
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
Zakres: **17_AGENT_TERESA — pierwszy pelny przebieg E2E lancucha konsultingowego, spinajacy dyzury 205 (`server/src/services/ai/AIPipeline.ts` `buildOrganizationSection` — kontekst organizacji w promptcie), 206 (petla READ: `ai.routes.ts`, `AIPipeline.ts`, `llmService.ts`, dyspozytor `executeToolCall` w `toolDefinitions.ts`), 207 (propozycja zapisu: `aiActionExecutor.ts`, `server/src/services/personalTask/createPersonalTaskService.ts`), 209 (indeksacja artefaktow: `documentStudioService.ts`, `artifactKnowledgeIndexer.ts`) i 210 (zasieg embeddingow: `embeddingService.ts`). CZTERY z pieciu (205/206/209/210) sa scalone NA MARKERZE `89630f9a8a` (zweryfikowane `git merge-base --is-ancestor`). ★★ PIATE, 207, NIE BYLO scalone na markerze — ale ZOSTALO scalone PO nim, DWIEMA rundami FIX, na tej samej, LINIOWEJ historii galezi bazowej (merge `68e8cd1ead`, poprzedzony `627e416cfd` FIX-207 pkt1-2 i `ad677e1d2c` FIX-207b — `89630f9a8a` jest scislym przodkiem `68e8cd1ead`, zweryfikowane `git merge-base 89630f9a8a 68e8cd1ead` = `89630f9a8a`, czyli zwykly fast-forward, NIE rozjazd na obca galaz). Kontrakt: `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` §6 (scenariusz GF-AGT-02) i §9 (petla madrosci organizacji) + `docs/program/funkcje/STAN_MODUL_17_2026-08-31.md` (`Do domkniecia modulu 17 zostaje: ... R3 dyzuru 206 ... GF-AGT-02`) + `docs/program/funkcje/LISTA_DYZUROW_211_222.md` (pozycja 217: `to jest dyzur, ktory zamyka modul 17`) + `docs/program/funkcje/ODBIOR_207.md` (werdykt koncowy po FIX-207b)**.
Trasy front: `Ten dyzur NIE projektuje nowego ekranu — komponenty juz istnieja i sa realnie wpiete (potwierdzone przez audyt 207): `src/components/AIChat/ExecutionProposalMessage.tsx` (karta propozycji, przechwycenie w `src/components/AIChat/MessageRenderer.tsx` — zbior `V8_EXECUTION_MESSAGE_TYPES`, zmierz aktualne linie na swojej bazie po fast-forward, bo 207 mogl je przesunac), `src/components/AIChat/UnifiedChatPanel.tsx` (handlery `onExecutionProposal`/approve/reject), `src/hooks/useAIStream.ts` (obsluga SSE `execution_proposal`). Twoja praca frontowa w tym dyzurze to WYLACZNIE obserwacja i dowod — zero nowego kodu frontowego, chyba ze zrzut wymaga zmontowania karty WEWNATRZ realnego `UnifiedChatPanel` (nie izolowanego harnessu — audyt 207 punkt 7 uznal `dev-render/screens/day207-write-proposal.tsx` za storybook, nie za dowod renderu). ★ CLAUDE.md §7: wlasciciel nigdy nie jest pierwszym testerem wizualnym — zrzut robisz Ty`. Trasy tył: `Piec ogniw, piec grup tras, wszystkie juz zamontowane po fast-forwardzie (R0) — sprawdz montaz, nie buduj nowych tras: (1) `POST /api/ai/chat/stream` (`server/src/routes/ai.routes.ts:1561` na markerze, zmierz po fast-forwardzie czy sie przesunelo) — wejscie lancucha, wiaze READ i (po fast-forwardzie) WRITE (`proposalTools`, `AIPipeline.ts` ok. `:575-580` na aktualnym tipie po 207: `readToolDefs || writeProposalToolDefs`); (2) cykl `ai_actions`: `POST /api/ai/actions/draft`, `PATCH .../approve`, `PATCH .../execute` — `aiActionExecutor.requestChatToolProposal` -> `requestAction` (`AIRoleGuard.isActionBlocked`, `AIPolicyEngine.canPerformAction`) -> `approveAction` -> `executeAction` (bramka statusu) -> `_executeCreateTask` (na aktualnym tipie po 207: ok. `:1176`) -> ★★ `createPersonalTask()` (NOWY plik `server/src/services/personalTask/createPersonalTaskService.ts`, wyodrebniony 1:1 z `POST /api/my-work/personal-tasks`) — REALNY zapis do `tasks`, `sourceType:'ai_chat_proposal'`, `sourceId:action.id` (ok. `:1222`); (3) odczyt zadania — `GET /api/my-work/personal-tasks` (`my-work.routes.ts:1170` na aktualnym tipie), scope po `(userId, orgId)`; (4) dokument realna droga — `POST /api/document-studio/generate` -> `materializeDocumentArtifact` (`documentStudioService.ts:869`) -> fire-and-forget `indexDocumentArtifactForKnowledge` (`:1264`); (5) zasieg przy wyszukiwaniu — `buildKnowledgeDocAccessFilter` (`embeddingService.ts:341`) wolane z `executeToolCall('search_knowledge_base', ...)`; (6) druga rozmowa — kolejne, NIEZALEZNE `POST /api/ai/chat/stream` (ten sam uzytkownik, NOWY `conversationId`), READ ON, model MA moznosc wywolac `search_knowledge_base``.

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
WT=/private/tmp/cx-day217-gf-agt-02
MARKER=89630f9a8a

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day217-gf-agt-02-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day217-gf-agt-02/config.worktree"
cat "$VAULT/worktrees/cx-day217-gf-agt-02/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day217-gf-agt-02-scratch
mkdir -p /private/tmp/cx-day217-gf-agt-02-artefakty

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
git -C "$VAULT" log --oneline 89630f9a8a..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 89630f9a8a..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day217-gf-agt-02-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 89630f9a8a..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `szesnascie` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day217-gf-agt-02

# (W1) CZY DYZURY 205/206/209/210 SA SCALONE NA MARKERZE — policz sam
git merge-base --is-ancestor 60d2be8793 HEAD && echo "205 scalone" || echo "205 BRAK"
git merge-base --is-ancestor 15d8889546 HEAD && echo "206 scalone" || echo "206 BRAK"
git merge-base --is-ancestor b5aa4dae54 HEAD && echo "209 scalone" || echo "209 BRAK"
git merge-base --is-ancestor cba567b913 HEAD && echo "210 scalone" || echo "210 BRAK"
#   oczekiwane: WSZYSTKIE CZTERY "scalone" NA MARKERZE, PRZED fast-forwardem.

# (W2) ★★ CZY 207 JEST SCALONY NA GALEZI BAZOWEJ (poza markerem) — fast-forward, nie merge obcej galezi
git fetch github-backup
git merge-base --is-ancestor 89630f9a8a github-backup/codex/m03-admin-20260824 \
  && echo "marker jest przodkiem tipa — fast-forward mozliwy" || echo "STOP: marker nie jest przodkiem"
git merge-base --is-ancestor 68e8cd1ead github-backup/codex/m03-admin-20260824 \
  && echo "207 (68e8cd1ead) jest na galezi bazowej" || echo "207 NIE jest jeszcze scalone — zglos, zmienia zakres"
#   oczekiwane: OBA "jest przodkiem"/"jest na galezi" — to jest warunek wstepny R0.

# (W3) ★★ FAST-FORWARD (R0) — wykonaj i zweryfikuj
git merge --ff-only github-backup/codex/m03-admin-20260824
#   oczekiwane: "Fast-forward", ZERO plikow konfliktu, ZERO nowego commita mergujacego
#   (git po prostu przesuwa wskaznik galezi). Jesli NIE jest to fast-forward — STOP,
#   zglos: oznacza to, ze zalozenie K2 (liniowa historia) jest obalone.

# (W4) PO FAST-FORWARDZIE — czy mechanizm 207 realnie jest na miejscu
grep -n "ENABLE_TERESA_TOOL_LOOP_WRITE" server/src/config/FeatureFlags.ts
grep -n "createPersonalTask" server/src/services/aiActionExecutor.ts
test -f server/src/services/personalTask/createPersonalTaskService.ts && echo "plik obecny"
grep -n "sourceType.*ai_chat_proposal\|source_type.*ai_chat_proposal" server/src/services/aiActionExecutor.ts
#   oczekiwane: flaga (2 trafienia: schemat+loader), import+wywolanie createPersonalTask,
#   plik obecny, sourceType='ai_chat_proposal' obecny — to jest dowod ze zadanie z czatu
#   idzie TA SAMA droga co My Work.

# (W5) READ i WRITE WSPOLISTNIEJA (nie jedno wyparlo drugie)
grep -n "readToolDefs\|writeProposalToolDefs" server/src/services/ai/AIPipeline.ts
grep -n "params.readTools\|params.proposalTools" server/src/services/ai/llmService.ts
#   oczekiwane: OBIE nazwy obecne w kazdym pliku.

# (W6) DOKUMENT REALNA DROGA — czy Document Studio generate jest zamontowane i dziala
grep -n "document-studio/generate\|router.post" server/src/routes/documentStudio.routes.ts 2>/dev/null | head -5
grep -n "materializeDocumentArtifact" server/src/services/documentStudio/documentStudioService.ts | head -3
sed -n '1260,1270p' server/src/services/documentStudio/documentStudioService.ts
#   oczekiwane: trasa zamontowana, materializeDocumentArtifact istnieje, linia ok. 1264
#   wola indexDocumentArtifactForKnowledge fire-and-forget PO trwalym zapisie.

# (W7) INDEKSACJA I ZASIEG — czy hook i filtr sa na miejscu
grep -n "indexDocumentArtifactForKnowledge" server/src/services/knowledge/artifactKnowledgeIndexer.ts | head -3
sed -n '335,345p' server/src/services/ai/embeddingService.ts
#   oczekiwane: eksport funkcji; buildKnowledgeDocAccessFilter ok. linii 341.

# (W8) PUŁAPKA clearAllMocks — zmierz DOKLADNA linie na swojej bazie
grep -n "clearAllMocks" tests/setup.ts
sed -n '785,812p' tests/setup.ts
#   oczekiwane: DWA wystapienia — beforeAll (~793, niegrozne), globalny beforeEach
#   (~809-811, PULAPKA — kasuje implementacje ustawione w beforeAll innych plikow).

# (W9) BUDZET REALNEGO MODELU — R3 dyzuru 206 nigdy nie wykonany, zero zuzyte
grep -n "R3b\|0 przebiegow\|NOT_PROVEN" docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY206_TOOL_LOOP_REPORT.md
#   oczekiwane: potwierdzenie "0 przebiegow / 0 rund modelu" — budzet DEC-317 caly dostepny.

# (W10) DLACZEGO REALNY MODEL WYMAGA SKRYPTU tsx, NIE vitest
sed -n '1,15p' server/scripts/day195-real-llm-docx-probe.ts
#   oczekiwane: naglowek mowi wprost, ze tests/setup.ts podmienia global.fetch atrapa
#   dla KAZDEGO przebiegu vitest — jedyna droga to samodzielny skrypt tsx.

# (W11) LICENCJA NA KLUCZ — dokladnie ten sam mechanizm co dyzur 190/206
test -f ~/.consultify-openrouter && echo "plik klucza obecny" || echo "BRAK — R5 STOP z opisem"
env | sed 's/=.*//' | grep -x 'OPENROUTER_API_KEY' && echo "zmienna obecna" || echo "zmienna nieobecna (oczekiwane przed source)"
#   NIGDY nie wypisuj wartosci. Jedyna dozwolona komenda: set -a; . ~/.consultify-openrouter; set +a

# (W12) PORTY I KONTENERY
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(6157|5104|5105)\b' || echo "6157/5104/5105 wolne"
docker ps --format '{{.Names}} {{.Ports}}' | grep -i cx-day2
#   oczekiwane: wolne; jesli zajete, STOP i zglos kolizje zasobowa.

# (W13) GET /personal-tasks — trasa istnieje i scopuje po uzytkowniku
grep -n "'/personal-tasks'" server/src/routes/my-work.routes.ts
#   oczekiwane: co najmniej dwie rejestracje (GET i POST).

# (W14) GENERATE_REPORT W executeAction — czy to realny producent czy widmo (nadal atrapa)
grep -n "GENERATE_REPORT" server/src/services/aiActionExecutor.ts | head -5
#   oczekiwane: nadal atrapa bez realnego zapisu. NIE uzywaj GENERATE_REPORT jako
#   'dokumentu' w R3 — uzyj Document Studio (W6), ktore realnie zapisuje.

# (W15) STARA GALAZ 207 JEST MARTWA — nie scalaj jej
git log --oneline 89630f9a8a..github-backup/codex/day207-write-proposal-20260831 | wc -l
#   oczekiwane: 6 (stare commity), ale galaz TA jest zastapiona przez to, co przyszlo
#   przez fast-forward (W2-W3). Nie scalaj jej — zawiera starszy, gorszy mechanizm.

# (W16) ROZDZIAL ARCHITEKTURY — numer nastepny wolny, zmierz sam po fast-forwardzie
grep -n "^## " docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md
#   oczekiwane: bierz NASTEPNY wolny numer po tym, co juz jest po fast-forwardzie.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day217-gf-agt-02-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6157`. Twój JEDYNY port harnessu to `5104 i 5105`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day217-pg`**. **ZAKAZANE:** `Zajete: 6012, 5433, 6047, 6054-6156, 5010-5103, 6404-6411 (dyzury wczesniejsze i odbiory nadzorcy — w tym 6147/5086-5087 dyzur 207, 6150 dyzur 210, 6209 audyt 209). Zakazane na stale: **5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP/ERR_UNSAFE_PORT)**. Twoj WYLACZNY przydzial: baza `6157`, harness `5104 i 5105`. ★ Ta lista jest rozkazem pomiarowym, nie gwarancja — zweryfikuj `lsof -i` i `docker ps` przed startem i wpisz wynik `X z 3` do raportu`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `★★ TRZY flagi wlaczane WYLACZNIE lokalnie, przez zmienne srodowiskowe, na czas tego przebiegu — ZAKAZ zmiany ktorejkolwiek wartosci domyslnej w kodzie: (1) `ENABLE_TERESA_TOOL_LOOP` (petla READ, 206) — istnieje na markerze `89630f9a8a`, `FeatureFlags.ts:35` (schemat, `z.boolean().default(false)`) i `:150` (loader); (2) `ENABLE_TERESA_TOOL_LOOP_WRITE` (propozycja zapisu, 207) — NIE istnieje na markerze, ale JUZ istnieje na aktualnym tipie galezi bazowej po scaleniu 207 (`FeatureFlags.ts:36` na aktualnym tipie, `z.boolean().default(false)`, loader `:155`) — pojawi sie na Twojej bazie automatycznie po fast-forwardzie R0, zero rozwiazywania konfliktow (czysty fast-forward, ta sama linia historii); (3) `ENABLE_ARTIFACT_KNOWLEDGE_INDEX` (indeksacja, 209) — istnieje na markerze, `FeatureFlags.ts:53` (schemat), `:240-241` (loader), `:272` (helper). Zadnej z trzech NIE dotykasz w kodzie — flagi ida za Toba automatycznie przez fast-forward, Ty WYLACZNIE ustawiasz zmienne srodowiskowe na czas przebiegu. `.env`/`.env.*` diff MA byc pusty. `CLAUDE.md` §7 i §9: wlaczenie WYLACZNIE za flaga do akceptu wlasciciela na zrzutach, jeden ekran po drugim, zakaz masowego wlaczania na zywo`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/services/aiRoleGuard.ts` (`isActionBlocked`, wolane z `aiActionExecutor.ts` — zmierz linie po fast-forwardzie, na markerze `:328`) · `server/src/services/aiPolicyEngine.ts` (`canPerformAction`) · `server/src/services/chatPermissionService.ts` (`checkChatPermission`) · `server/src/services/aiRunLedgerService.ts` (audyt: `ensureRunForAction`/`recordAIRunEvent`) · `server/src/services/ai/toolCostEstimates.ts` (`estimateAgentToolCostUsd`, cennik + `UnknownToolCostError`) · `server/src/services/ai/embeddingService.ts` (`buildKnowledgeDocAccessFilter`, `:341` na markerze, obie sciezki `searchPg`/`searchSqlite`) · `server/src/services/KnowledgeService.ts` (walidacja `scope` `:640`, `skipGlobalEmbeddingIndex` `:676-717`) · ★★ `server/src/services/personalTask/createPersonalTaskService.ts` (NOWY plik po fast-forwardzie — jedyny writer `tasks` dla zadan osobistych, wspolny dla My Work i czatu; NIE zmieniasz jego logiki, wywolujesz i obserwujesz) · `server/src/routes/my-work.routes.ts` (`GET /personal-tasks`, scope po `userId`+`orgId` — czytasz jako punkt weryfikacji ogniwa 3, nie zmieniasz). ★★ ZADNEJ Z NICH NIE ZMIENIASZ w tym dyzurze — przebieg ma przez nie PRZECHODZIC, nie omijac ich i nie poszerzac`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY217_GF_AGT_02_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md` — ten dyzur jest dowodem miedzymodulowym (spina 13_CHAT z baza wiedzy), nie odbiorem pojedynczego modulu z rejestru. ★ Jedyny inny dokument do zmiany: `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` — DOPISUJESZ nowy rozdzial `Wykonanie — GF-AGT-02 (Day217)` na KONCU pliku (numer ustalasz pomiarem: `grep -n '^## ' docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` — bierzesz NASTEPNY wolny numer po fast-forwardzie i wpisujesz do raportu, ktory to byl), z werdyktem per ogniwo (szesc zdan 'dziala'/'nie dziala' z R5-R6) i odsylaczem w §6. ★★ ZAKAZ zmiany tresci §1-§5, §7, §8 — to jest dokument zaakceptowany przez wlasciciela. Dodatkowo: `docs/program/funkcje/STAN_MODUL_17_2026-08-31.md` — WYLACZNIE dopisanie statusu w sekcji 'Do domkniecia zostaje' punkty 3-4, zero usuwania tresci. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day217-gf-agt-02-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day217-gf-agt-02-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **R0 (fast-forward do stanu z dyzurem 207) JEST WARUNKIEM WSTEPNYM, NIE OPCJA.** Bez niego flaga `ENABLE_TERESA_TOOL_LOOP_WRITE` i writer `createPersonalTask` nie istnieja na Twojej bazie i ogniwo 3 jest niewykonalne. ★★ **R0 TO FAST-FORWARD, NIE MERGE OBCEJ GALEZI.** `git merge --ff-only github-backup/GALAZ_BAZOWA` — zero konfliktow z definicji, bo marker jest scislym przodkiem. Jesli git odmowi fast-forwardu — STOP, nie probuj zwyklego merge'a ani rebase'u (`Z3`), zglos rozjazd zalozen. ★★ **ZAKAZ scalania starej, izolowanej galezi `github-backup/codex/day207-write-proposal-20260831`.** Niesie WYLACZNIE zastapiony, gorszy mechanizm (fail-closed bez realnego writera) sprzed FIX-207b — scalenie do niej cofnieoby prace. ★★ **ZAKAZ 'NAPRAWY' albo 'ULEPSZANIA' `createPersonalTask`/`_executeCreateTask`.** To gotowy, scalony mechanizm z dyzuru 207 — Twoim zadaniem jest go WYWOLAC i ZAOBSERWOWAC, nie modyfikowac. Jesli w trakcie zauwazysz defekt — wpis do raportu, nie zmiana kodu poza zakresem R0. ★★ **ZAKAZ UZYWANIA `GENERATE_REPORT` (ai_actions) JAKO 'DOKUMENTU' W OGNIWIE 4.** To nadal atrapa — nie zapisuje niczego trwalego i nie triggeruje indeksacji 209. Dokument w ogniwie 4 MUSI powstac przez Document Studio (`POST /api/document-studio/generate`). ★★ **TASK I DOCUMENT SA DWOMA NIEZALEZNYMI DOWODAMI, NIE JEDNYM LANCUCHEM.** `TARGET_KINDS` governed handoff nie obejmuje `task`/`decision` — zatwierdzone zadanie NIE STAJE SIE dokumentem. Zdanie w raporcie sugerujace ciaglosc miedzy nimi jest zawyzeniem. ★★ **`Z15` OBOWIAZUJE W R0-R4 I R6 — modelu nie wolasz.** Zniesione WYLACZNIE dla R5, budzet DOKLADNIE DWA PRZEBIEGI (1x READ ON, 1x READ OFF jako mutacja), sufit 5 rund modelu W CALYM DYZURZE, jednostka limitu = przebieg (`stopWhen: stepCountIs(4)`, `llmService.ts:1343`). Zakaz ponawiania nieudanego przebiegu. Licencja na klucz: WYLACZNIE `set -a; . ~/.consultify-openrouter; set +a`. `Z40` bez wyjatku: wartosc klucza nie pojawia sie NIGDZIE. Jesli nie skorzystasz — napisz WPROST "modelu nie wolalem". ★★ **ZAKAZ WYMUSZANIA WYBORU NARZEDZIA W R5** — zakaz nazw narzedzi w promptcie, zakaz dyrektywy "MUSISZ wywolac X" (wzorzec `AIPipeline.ts:414-427`, intencja `table`, tu ZAKAZANY). ★★ **REALNY MODEL WYLACZNIE PRZEZ SKRYPT `tsx`**, NIGDY przez `*.test.ts` — `tests/setup.ts` podmienia `global.fetch` atrapa dla kazdego przebiegu vitest. ★★ **PUŁAPKA `clearAllMocks`:** kazdy NOWY test tego dyzuru instaluje mock w `beforeEach`, nie `beforeAll` — globalny `tests/setup.ts:809-811` kasuje implementacje miedzy testami. ★★ **R6 (trzy powtorzenia) DOTYCZY WYLACZNIE lancucha wstrzyknietego R1-R4** — nie mnozysz przez trzy realnego modelu z R5. ★★ **ZAKAZ ZALICZANIA OGNIWA, KTOREGO NIE WIDZIALES NA WLASNE OCZY.** ★★ **DOZWOLONY WERDYKT KONCOWY: 'NIE DZIALA' DLA POJEDYNCZEGO OGNIWA.** ★★ **`Z31`** — `assertRealPostgresTestEnvironment()` BEZ argumentow. ★★ **`Z29`** — dowod mutacyjny w obie strony per ogniwo (R2: bramka statusu; R4: mutacja zasiegu; R5: mutacja OFF). ★★ **Zakaz retry w testach bezpieczenstwa.** ★ **Sprzatanie kontenera:** `docker rm -f -v`. ★ **`Z27` — zakaz `git stash`**; dowody przez `cp` do `/private/tmp/cx-day217-gf-agt-02-scratch`. ★ **Zero polaczen do bazy zdalnej/demo/stagingu/produkcji** (`Z28`). ★ **Zakaz naprawiania przez wyciszanie** i zakaz usuwania zastanych testow. ★ **Zrzuty: `mean_luma` kazdego, para jasny/ciemny >150 roznicy.** ★ **`Z13`:** logi/zrzuty/wyjscia bramek NIE wchodza do repo — leza w `/private/tmp/cx-day217-gf-agt-02-artefakty`, raport podaje sciezki i `shasum -a 256`. ★ **NOWE pliki w `tests/` wymagaja `git add -f`.** | Wlasciciel zaakceptowal architekture modulu 17 (`docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md`, status canonical, 31.08.2026). §6 opisuje test akceptacyjny GF-AGT-02 jako 'pierwszy w historii' dowod, ze lancuch dziala jako calosc; `STAN_MODUL_17_2026-08-31.md` wymienia GF-AGT-02 i R3 dyzuru 206 jako dwie z czterech pozycji pozostajacych do domkniecia modulu; `LISTA_DYZUROW_211_222.md` (pozycja 217) mowi wprost: 'to jest dyzur, ktory zamyka modul 17'. ★★ POMIAR WYKONANY PRZY PISANIU TEJ INSTRUKCJI ZMIENIA TRESC ZAMOWIENIA W SIEDMIU MIEJSCACH: (K1) Dyzury 205/206/209/210 sa scalone NA MARKERZE `89630f9a8a` (zweryfikowane `git merge-base --is-ancestor`); dyzur 207 (potrzebny do ogniwa 3) NIE byl scalony na markerze. (K2) ★★ ALE 207 zostal scalony PO markerze, w miedzyczasie, DWIEMA rundami FIX — merge `68e8cd1ead` (poprzedzony `627e416cfd` FIX-207 pkt1-2 i `ad677e1d2c` FIX-207b) — i `89630f9a8a` jest SCISLYM PRZODKIEM tego mergu (`git merge-base 89630f9a8a 68e8cd1ead` = `89630f9a8a`). To jest zwykly, LINIOWY postep tej samej galezi, NIE rozjazd na obca galaz — doprowadzenie Twojego worktree do stanu z 207 jest wiec CZYSTYM FAST-FORWARD (zero konfliktow), fundamentalnie inna sytuacja niz scalanie zdywergowanej galezi. Marker zostaje `89630f9a8a` dla spojnosci calej fali dyzurow — Twoim obowiazkiem (R0) jest fast-forward jako pierwszy krok, nie improwizacja bazy. (K3) ★★ NAJWAZNIEJSZE: PO fast-forwardzie, zatwierdzony `create_task`/`create_decision` z czatu NAPRAWDE TWORZY zadanie. FIX-207b przekierowal `_executeCreateTask`/`_executeCreateDecision` na NOWY, wspolny writer `createPersonalTask()` (`server/src/services/personalTask/createPersonalTaskService.ts`), wyodrebniony 1:1 z jedynego dotad wolajacego `POST /api/my-work/personal-tasks` — zadanie z czatu i zadanie z ekranu My Work ida TERAZ TA SAMA droga, jednym writerem, zamiast dwoma kopiami tej samej reguly INSERT (dokladnie wzorzec `naprawa per-wywolanie odrasta`, ktorego unikniecie bylo celem FIX-207b). Zadanie niesie `sourceType:'ai_chat_proposal'`, `sourceId:action.id` — jawny slad pochodzenia, sprawdzalny i widoczny przez `GET /api/my-work/personal-tasks`. To jest inny, LEPSZY wynik niz to, co bylo widac na starej, izolowanej galezi `day207-write-proposal-20260831` (tip `627e416cfd`), ktora miala WYLACZNIE starszy fix (fail-closed `CanonicalExecutionWriterRequiredError`, bez realnego writera) — TA galaz jest dzis MARTWA/ZASTAPIONA i scalanie do niej byloby cofnieciem, nie postepem. (K4) Lancuch GF-AGT-02 ma teraz DWA NIEZALEZNE, ale OBA REALNIE DZIALAJACE obiekty: TASK (przez write-proposal 207 -> `createPersonalTask`) i DOCUMENT (przez governed handoff/Document Studio, 179/195, zasilajacy indeksacje 209/210) — nie laczy ich most w kodzie (`TARGET_KINDS` governed handoff nadal nie obejmuje `task`), ale zaden z nich juz nie konczy sie porazka; testujesz je jako dwa rownolegle, realne dowody w tym samym scenariuszu, nie jako jeden ciag przyczynowy. (K5) `tests/setup.ts` podmienia `global.fetch` atrapa DLA KAZDEGO przebiegu vitest (naglowek `server/scripts/day195-real-llm-docx-probe.ts:4-9` mowi to wprost) — realny model wymagany w R5 (R3 dyzuru 206) MUSI wiec isc przez samodzielny skrypt `tsx`, NIGDY przez plik `*.test.ts`. (K6) R3 dyzuru 206 (dowod realnym modelem) NIGDY nie zostal wykonany — `CODEX_DAY206_TOOL_LOOP_REPORT.md:93-121`: '0 przebiegow / 0 rund modelu (...) NOT_PROVEN'. Budzet DEC-317 (dwa realne wywolania modelu) jest w calosci NIEWYKORZYSTANY i nalezy do tego dyzuru. (K7) Zmierzone: globalny `beforeEach(vi.clearAllMocks())` w `tests/setup.ts:809-811` (ZWERYFIKOWANE dokladnie na tych liniach — jest tez NIESZKODLIWY `vi.clearAllMocks()` w `beforeAll` na linii 793) kasuje implementacje mockow ustawionych w `beforeAll` innych plikow — dokladnie ten defekt, ktory dyzur 209 zdiagnozowal jako prawdziwa przyczyne swojej zawodnosci. Kazdy NOWY test tego dyzuru zalezny od mocka w `beforeAll` musi przeniesc instalacje do `beforeEach` |

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
cd /private/tmp/cx-day217-gf-agt-02

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day217-pg psql -U postgres -d cx217 \
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
cd /private/tmp/cx-day217-gf-agt-02

docker run -d --name cx-day217-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx217 \
  -p 127.0.0.1:6157:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day217-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6157/cx217 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6157/cx217 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day217-gf-agt-02 && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6157/cx217 \
JWT_SECRET=cx217-test-secret-do-not-reuse \
npx vitest run tests/integration/day217-gf-agt-02.realdb.test.ts (nowy, wstrzykniety lancuch scenariusza, 3x powtorzenie) · tests/unit/backend/day217.* (nowe, testy jednostkowe per ogniwo, jesli potrzebne) · server/scripts/day217-real-model-probe.ts (NOWY, skrypt tsx wzorem server/scripts/day195-real-llm-docx-probe.ts — jedyna droga do realnego wywolania modelu, bo tests/setup.ts podmienia global.fetch atrapa dla KAZDEGO przebiegu vitest) · dev-render/screens/ (WYLACZNIE jesli montujesz karte propozycji w realnym UnifiedChatPanel, patrz TRASY_FRONT) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day217-gf-agt-02-artefakty/day217-gf-agt-02.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day217-gf-agt-02 && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/integration/day217-gf-agt-02.realdb.test.ts (nowy, wstrzykniety lancuch scenariusza, 3x powtorzenie) · tests/unit/backend/day217.* (nowe, testy jednostkowe per ogniwo, jesli potrzebne) · server/scripts/day217-real-model-probe.ts (NOWY, skrypt tsx wzorem server/scripts/day195-real-llm-docx-probe.ts — jedyna droga do realnego wywolania modelu, bo tests/setup.ts podmienia global.fetch atrapa dla KAZDEGO przebiegu vitest) · dev-render/screens/ (WYLACZNIE jesli montujesz karte propozycji w realnym UnifiedChatPanel, patrz TRASY_FRONT) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day217-gf-agt-02-artefakty/day217-gf-agt-02.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day217-gf-agt-02/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day217-pg psql -U postgres -d cx217 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day217-pg`.
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
> **(e) ★★ **Pierwsza, najgrozniejsza: pomylenie fast-forwardu z merge'em obcej galezi i probe scalenia starej `day207-write-proposal-20260831`.** Ta galaz niesie STARSZY, ZASTAPIONY mechanizm (fail-closed bez realnego writera) sprzed FIX-207b — scalenie do niej cofnieloby prace juz obecna na galezi bazowej przez zwykly fast-forward. Zawsze `git merge --ff-only github-backup/GALAZ_BAZOWA`, nigdy nazwana galaz feature. ★★ **Druga: zalozenie, ze `create_task` z czatu 'i tak nie zadziala', bo tak bylo w starszej wersji audytu.** Po fast-forwardzie mechanizm REALNIE dziala — zadanie powstaje, jest widoczne w My Work, niesie provenance. Zaniechanie proby zatwierdzenia bo 'wiadomo, ze i tak zawiedzie' jest bledem pomiarowym — sprawdz sam, na swiezym fast-forwardzie. ★★ **Trzecia: proba polaczenia zadania z dokumentem w jeden lancuch przyczynowy.** `create_task` (`createPersonalTask`) i `materializeDocumentArtifact` (governed handoff) to DWA ROZLACZNE mechanizmy z rozna tabela docelowa — zatwierdzone zadanie NIE STAJE SIE dokumentem. Sa to dwa osobne, rownolegle dowody w jednym scenariuszu, nie jeden ciag. ★★ **Czwarta: uzycie `GENERATE_REPORT` (atrapa) jako dokumentu.** Nie zapisuje niczego, nie triggeruje indeksacji. ★★ **Piata: proba realnego wywolania modelu przez `vitest`.** `tests/setup.ts` globalnie podmienia `fetch` — jedyna droga to skrypt `tsx` uruchomiony recznie. ★★ **Szosta: policzenie trzykrotnego powtorzenia (R6) razem z przebiegami realnego modelu (R5) w jeden budzet.** R6 jest deterministyczny i moze biec dowolnie wiele razy; R5 ma sztywny sufit 2 przebiegow/5 rund z DEC-317, nie jest mnozony przez R6. ★★ **Siodma: zaufanie kartom `ODBIOR_207.md`/`ODBIOR_209.md`/`ODBIOR_210.md` bez wlasnego pomiaru na SWOJEJ, fast-forwardowanej bazie.** Te karty opisuja stan zmierzony na innych galeziach/workree'ach — Twoj obowiazek to powtorzyc kluczowe pomiary NA WLASNYM worktree, nie przepisac cudzych liczb. ★★ **Osma: pomylenie `notes.manualContext` (205, kontekst organizacji, ogniwo 1-2) z indeksacja artefaktow (209/210, wyszukiwalnosc dokumentu, ogniwo 5-6).** To dwa rozne mechanizmy zasilajace prompt/wyszukiwanie roznymi drogami — nie wolno ich zlac w jeden dowod.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day217-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day217-gf-agt-02-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 — SETUP OBOWIAZKOWY, FAST-FORWARD (NIE scalenie obcej galezi): Twoj worktree, zbudowany per standardowa procedura `§0.1` dokladnie na markerze `89630f9a8a`, NIE zawiera dyzuru 207 — ale 207 wszedl na TA SAMA, LINIOWA historie galezi bazowej PO markerze (merge `68e8cd1ead`, `89630f9a8a` jest jego scislym przodkiem). To NIE jest scalanie z rozbiezna galezia — to zwykly fast-forward wzdluz jednej linii, zero konfliktow z definicji. Wykonaj: `git fetch github-backup && git merge --ff-only github-backup/GALAZ_BAZOWA` w swoim worktree. Oczekiwany wynik: "Fast-forward", zero plikow konfliktu. Jesli NIE jest to fast-forward (marker przestal byc przodkiem tipa) — STOP calego dyzuru, zglos, to zmienia zalozenia. ★★ ZAKAZ scalania starej, izolowanej galezi `github-backup/codex/day207-write-proposal-20260831` (tip `627e416cfd`) — niesie WYLACZNIE starszy, ZASTAPIONY mechanizm (fail-closed `CanonicalExecutionWriterRequiredError` bez realnego writera, sprzed FIX-207b) i scalenie do niej COFNELOBY mechanizm zamiast go posunac. Po fast-forwardzie zweryfikuj: `grep -n 'ENABLE_TERESA_TOOL_LOOP_WRITE' server/src/config/FeatureFlags.ts` (2 trafienia), `grep -n 'createPersonalTask' server/src/services/aiActionExecutor.ts` (import + wywolanie), `test -f server/src/services/personalTask/createPersonalTaskService.ts`. R1 — OGNIWO 1+2: real HTTP `/chat/stream` z `ENABLE_TERESA_TOOL_LOOP=true`, model (albo wstrzykniete wywolanie, `Z15` domyslnie obowiazuje poza R5) siega po co najmniej jedno narzedzie READ przez dyspozytor `executeToolCall`, a wyrenderowany prompt tej tury zawiera sekcje organizacji z `notes.manualContext` (`AIPipeline.ts` `buildOrganizationSection`, dowod na STRINGU promptu, standard z dyzuru 205). R2 — OGNIWO 3: propozycja zapisu `create_task` przez `/chat/stream` z `ENABLE_TERESA_TOOL_LOOP_WRITE=true` -> karta propozycji w watku -> `PATCH .../approve` -> `PATCH .../execute`. ★★ OCZEKIWANY WYNIK PO FAST-FORWARDZIE: zadanie POWSTAJE REALNIE — `_executeCreateTask` wola `createPersonalTask()`, ktory pisze do `tasks` z `sourceType:'ai_chat_proposal'`, `sourceId:<actionId>` — zweryfikuj TRZY rzeczy: (a) przed zatwierdzeniem 0 nowych wierszy w `tasks` (bramka dziala); (b) po `execute` DOKLADNIE 1 nowy wiersz, z `source_type='ai_chat_proposal'` i `source_id` rownym Twojemu `actionId` — to jest sprawdzalny znacznik pochodzenia, uzyj go; (c) zadanie widoczne przez `GET /api/my-work/personal-tasks` dla tego samego uzytkownika (real HTTP). Mutacja `Z29`: zdejmij bramke statusu (`if (action.status !== ACTION_STATUS.APPROVED)`) i wywolaj `executeAction` na propozycji `PENDING` bez `approve` — MUSI przejsc (bramka zdjeta) i utworzyc zadanie; przywroc bramke, potwierdz ze bez niej (przywroconej) wykonanie na `PENDING` jest odrzucane. R3 — OGNIWO 4: DOKUMENT powstaje NIEZALEZNA, rownolegla droga (nie kontynuacja R2) — `POST /api/document-studio/generate` (governed handoff, dowiedziony end-to-end przez dyzur 209 samodzielnie), z UNIKALNYM znacznikiem tekstowym w tresci (`ZNACZNIK-DAY217-<losowy-ciag>`). R4 — OGNIWO 5: po wygenerowaniu dokumentu z `ENABLE_ARTIFACT_KNOWLEDGE_INDEX=true`, `materializeDocumentArtifact` (`documentStudioService.ts:869`) wola `indexDocumentArtifactForKnowledge` (`:1264`) -> wpis w `knowledge_docs`+`ai_knowledge_embeddings` z poprawnym `scope`; zapytaniem SQL potwierdz wiersz i jego `scope`/`owner_id`. R5 — OGNIWO 6 (SEDNO) + R3 DYZURU 206 POLACZONE W JEDNYM SCENARIUSZU: DRUGA, niezalezna rozmowa (nowy `conversationId`, ten sam uzytkownik) z REALNYM modelem (`Z15` zniesione WYLACZNIE tutaj, wzorem 206 R3b: `~/.consultify-openrouter`, `set -a; . ~/.consultify-openrouter; set +a`, budzet DEC-317 DOKLADNIE DWA PRZEBIEGI: przebieg 1 flaga READ ON — model SAM decyduje wywolac `search_knowledge_base` z zapytaniem dotykajacym tematu dokumentu z R3 i CYTUJE w odpowiedzi znacznik z R3 (rzecz, ktorej NIE MOGL znac bez indeksacji); przebieg 2 flaga OFF jako mutacja — zero wywolan narzedzia, zero znacznika w odpowiedzi), sufit 5 rund modelu w calym dyzurze, jednostka limitu = przebieg. Skrypt WYLACZNIE `tsx` (`server/scripts/day217-real-model-probe.ts`), NIGDY `*.test.ts` (tests/setup.ts podmienia global.fetch atrapa dla kazdego przebiegu vitest — dowod bylby falszywie negatywny). R6 — TRZYKROTNE POWTORZENIE: caly wstrzykniety (nie-modelowy) lancuch R1-R4 uruchomiony 3x od swiezej bazy, z osobnym znacznikiem za kazdym razem i osobnym `actionId` w R2, wszystkie trzy przebiegi zielone (w tym R2 realnie tworzace zadanie za kazdym razem, nie 'oczekiwany FAILED' jak w stanie sprzed fast-forwardu). Werdykt koncowy: dla kazdego z szesciu ogniw jedno zdanie 'dziala' albo 'nie dziala' z dowodem — zakaz zaliczania ogniwa bez wlasnych oczu`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6157` albo `5104 i 5105` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6157` albo `5104 i 5105`** (`Z7`).

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

Właściciel zaakceptował architekturę modułu 17 (`docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md`,
`status: canonical`, 31.08.2026). Jej §6 opisuje **GF-AGT-02** jako pierwszy w historii produktu
test akceptacyjny całego łańcucha, jej §9 stwierdza, że pętla „praca → wiedza → kontekst" jest
**prawdą, nie mitem** — ale z trzema dziurami. `docs/program/funkcje/STAN_MODUL_17_2026-08-31.md`
wymienia do domknięcia modułu 17: *(3) R3 dyżuru 206 — dowód pętli narzędziowej realnym modelem
(0/2 budżetu); (4) GF-AGT-02 — pierwszy pełny test E2E procesu konsultingowego*.
`docs/program/funkcje/LISTA_DYZUROW_211_222.md`, pozycja 217, mówi wprost:

> **to jest dyżur, który zamyka moduł 17.** Pierwszy dowód, że produkt działa jako całość, a nie
> jako 17 działających części.

Mamy siedemnaście działających części i ani jednego dowodu, że działają jako całość. Ten dyżur
albo dostarcza ten dowód, albo uczciwie mówi, w którym miejscu łańcuch się urywa — obie odpowiedzi
są dopuszczalnym wynikiem tego dyżuru; naciągnięty sukces nie jest.

## ★★ Pomiar, który zmienia treść zamówienia — wykonany przy pisaniu tej instrukcji

Zamówienie zakłada, że pięć domkniętych dyżurów (205, 206, 207, 209, 210) siedzi razem na Twojej
bazie i wystarczy je spiąć. **Prawda jest bardziej ziarnista, w siedmiu miejscach — zweryfikuj
sam, to jest rozkaz pomiarowy, nie prawda objawiona.**

**(K1) Cztery z pięciu ogniw są scalone NA MARKERZE, jedno nie było.** `git merge-base
--is-ancestor` (uruchom sam, `W1` niżej) potwierdza, że merge-commity dyżurów 205 (`60d2be8793`),
206 (`15d8889546`), 209 (`b5aa4dae54`+`3979881175`) i 210 (`3bec3b3347`+`cba567b913`) są przodkami
markera `89630f9a8a`. **Dyżur 207, potrzebny do ogniwa 3, nie był** przodkiem markera w chwili
jego ustalenia.

**(K2) ★★ Ale 207 wszedł na linię integracyjną PO markerze — i to jest zwykły postęp trunk, nie
rozjazd na obcą gałąź.** Zmierzone: `git merge-base 89630f9a8a 68e8cd1ead` zwraca `89630f9a8a` —
czyli marker jest **ścisłym przodkiem** merge-commitu dyżuru 207 (`68e8cd1ead`, poprzedzonego
dwiema rundami napraw: `627e416cfd` FIX-207 pkt 1-2, `ad677e1d2c` FIX-207b). To oznacza: Twój
worktree, zbudowany per standardowa procedura `§0.1` **dokładnie na markerze** `89630f9a8a`,
**nie będzie zawierał** mechanizmu 207 od razu — ale doprowadzenie go do stanu, który go zawiera,
jest **czystym fast-forwardem** (`git merge --ff-only`), zero konfliktów z definicji, fundamentalnie
inna sytuacja niż scalanie zdywergowanej gałęzi. To jest pozycja **R0** niżej i jest warunkiem
wstępnym całego dyżuru — bez niej flaga `ENABLE_TERESA_TOOL_LOOP_WRITE` nie istnieje na Twojej
bazie i ogniwo 3 jest niewykonalne.

**(K3) ★★ Najważniejsze odkrycie: PO fast-forwardzie, zatwierdzony `create_task`/`create_decision`
NAPRAWDĘ TWORZY zadanie — to jest wynik POZYTYWNY, inny niż wcześniejszy stan naprawy.**
`FIX-207b` przekierował `_executeCreateTask`/`_executeCreateDecision` (`aiActionExecutor.ts`) na
NOWY, wspólny writer — `createPersonalTask()` (`server/src/services/personalTask/
createPersonalTaskService.ts`), wyodrębniony **1:1** z jedynego dotąd wołającego, `POST
/api/my-work/personal-tasks`. Cytat z komentarza w kodzie:

> „skoro to ten sam obiekt biznesowy co ręcznie tworzone zadanie w My Work, zapis idzie TĄ SAMĄ
> drogą (…) Jedno źródło prawdy dla `INSERT INTO tasks` zamiast dwóch kopii tej samej reguły."

Zadanie z czatu i zadanie z ekranu My Work idą teraz **tą samą drogą, jednym writerem** —
dokładnie unikając wzorca „naprawa per-wywołanie odrasta" z pamięci programu. Zadanie niesie
**jawny ślad pochodzenia**: `sourceType: 'ai_chat_proposal'`, `sourceId: action.id` — sprawdzalny
znacznik, którego użyjesz w R2 jako dowodu, i widoczny przez real HTTP `GET
/api/my-work/personal-tasks`.

**(K4) Z (K3) wynika, że łańcuch GF-AGT-02 ma teraz DWA niezależne, ale OBA realnie działające
obiekty**, nie jeden łańcuch przyczynowy:

- **TASK** — przez write-proposal (207) → `createPersonalTask()` → realny wiersz w `tasks`,
  widoczny w My Work. To jest **ogniwo 3**.
- **DOCUMENT** — przez governed handoff / Document Studio (dyżur 179/195), `POST
  /api/document-studio/generate` → `materializeDocumentArtifact` → hak indeksacji z dyżuru 209.
  To jest **ogniwo 4**, i to ono zasila ogniwa 5-6.

**Te dwie ścieżki nie są tym samym mechanizmem i nie ma między nimi mostu w dzisiejszym kodzie.**
`TARGET_KINDS` governed handoff (`server/src/services/artifactHandoff/handoffSpineService.ts:49-50`)
to zamknięta lista `['document','presentation','workbook','material']` — nie ma w niej `task` ani
`decision`. Zatwierdzone zadanie **nie staje się** dokumentem — testujesz je jako **dwa osobne,
równoległe dowody** w jednym scenariuszu, nie jako jeden ciąg przyczynowy. Zdanie w raporcie
sugerujące ciągłość między nimi jest zawyżeniem.

**(K5) ★★ Stara, izolowana gałąź `github-backup/codex/day207-write-proposal-20260831` (tip
`627e416cfd`) jest dziś martwa, zastąpiona.** Niesie WYŁĄCZNIE starszy, gorszy mechanizm —
`_executeCreateTask` rzucający `CanonicalExecutionWriterRequiredError` bez żadnego realnego
writera, sprzed FIX-207b. Scalenie do tej gałęzi **cofnęłoby** pracę już obecną na gałęzi bazowej
przez zwykły fast-forward. **Zakaz jej dotykania** — patrz R0 i `ZAKAZ_WLAŚCIWY_TEMU_DYŻUROWI`.

**(K6) Realny model w R5 wymaga skryptu `tsx`, nie pliku `*.test.ts`.** Nagłówek
`server/scripts/day195-real-llm-docx-probe.ts:4-9` mówi wprost: `tests/setup.ts` podmienia
`global.fetch` atrapą **dla każdego przebiegu vitest**, więc żaden test vitest nie dobija do
prawdziwego dostawcy — dzień-190/195/206 (R3b, nigdy niewykonane) ustaliły jedyną działającą drogę:
samodzielny skrypt uruchomiony `npx tsx`, commitowany do repo dla odtwarzalności.

**(K7) Budżet realnego modelu z dyżuru 206 jest w całości niewykorzystany.**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY206_TOOL_LOOP_REPORT.md:93-121`: „R3b:
wykonano **0 przebiegów / 0 rund modelu**; (…) NOT_PROVEN." `DEC-2026-08-29-317` daje dokładnie
dwa realne wywołania modelu jako dowód programu — oba należą dziś do tego dyżuru.

**(K8) Pułapka `clearAllMocks` jest zmierzona dokładnie, nie „w okolicy".** `tests/setup.ts` ma
**dwa** wystąpienia `vi.clearAllMocks()`: linia **793** w globalnym `beforeAll` (niegroźna) i linia
**811** w globalnym `beforeEach` (**pułapka** — kasuje implementacje mocków ustawionych w lokalnym
`beforeAll`, nie tylko historię wywołań; dokładnie ten defekt, który dyżur 209 zdiagnozował jako
prawdziwą przyczynę swojej zawodności). Każdy nowy test tego dyżuru zależny od mocka w `beforeAll`
ma instalować go w `beforeEach`.

# 2. TEZY ZLECENIA

Każda z nich to **rozkaz pomiarowy**. Numery linii oznaczone „na markerze" pochodzą z `89630f9a8a`
i pozostają niezmienione po fast-forwardzie (207 nie dotyka tych plików). Numery oznaczone „na
tipie po 207" pochodzą z pomiaru wykonanego na aktualnej gałęzi bazowej po scaleniu 207 i **mogą
się przesunąć**, jeśli inne dyżury równoległe też scalą się w międzyczasie — zmierz sam, wiążący
jest plik.

- **T1.** Dyżury 205/206/209/210 są scalone na markerze `89630f9a8a`; dyżur 207 nie był.
- **T2.** `89630f9a8a` jest ścisłym przodkiem merge-commitu dyżuru 207 (`68e8cd1ead`) — fast-forward
  bez konfliktów, nie merge zdywergowanej gałęzi.
- **T3.** Po fast-forwardzie, `_executeCreateTask` woła `createPersonalTask()` (NOWY plik
  `server/src/services/personalTask/createPersonalTaskService.ts`), pisze realny wiersz do
  `tasks` z `sourceType: 'ai_chat_proposal'`, `sourceId: action.id`.
- **T4.** Zadanie utworzone tą drogą jest widoczne przez real HTTP `GET
  /api/my-work/personal-tasks` (`my-work.routes.ts`, na tipie po 207 ok. `:1170`), scope po
  `(userId, orgId)`.
- **T5.** `GENERATE_REPORT` w `executeAction` pozostaje atrapą — nic nie zapisuje, nie triggeruje
  indeksacji. Nie nadaje się jako „dokument" w tym dyżurze.
- **T6.** `POST /api/document-studio/generate` → `materializeDocumentArtifact`
  (`documentStudioService.ts:869` na markerze) → fire-and-forget `indexDocumentArtifactForKnowledge`
  (`:1264`) → wpis w `knowledge_docs`+`ai_knowledge_embeddings` — mechanizm dowiedziony end-to-end
  samodzielnie przez dyżur 209.
- **T7.** `buildKnowledgeDocAccessFilter` (`embeddingService.ts:341` na markerze) egzekwuje zasięg
  na obu ścieżkach (`searchPg`/`searchSqlite`) — dowiedzione mutacyjnie przez dyżur 210.
- **T8.** `buildOrganizationSection` (`AIPipeline.ts:1767` na markerze) renderuje
  `org.notes.manualContext` od linii ok. `1862` — dowód na wyrenderowanym prompcie, standard
  dyżuru 205.
- **T9.** READ tool loop (206) jest gotowy na markerze: `ENABLE_TERESA_TOOL_LOOP`
  (`FeatureFlags.ts:35`,`:150`), dyspozytor `executeToolCall`, zawiera `search_knowledge_base`
  (`toolDefinitions.ts:58`, dyspozytor `:595`).
- **T10.** Po fast-forwardzie, `readToolDefs` (206) i `writeProposalToolDefs` (207) współistnieją
  w `AIPipeline.ts` (ok. `:575-580` na tipie po 207); `readTools` i `proposalTools` współistnieją
  jako dwa niezależne pola/bloki dyspozytora w `llmService.ts` (typ ok. `:174-176`, dyspozytor ok.
  `:1309-1340`) — żadna rodzina nie wyparła drugiej.
- **T11.** `tests/setup.ts` podmienia `global.fetch` atrapą dla każdego przebiegu vitest — realny
  model w R5 wymaga skryptu `tsx`.
- **T12.** R3 dyżuru 206 (dowód realnym modelem) nigdy nie wykonano — `0 przebiegów / 0 rund`.
  Budżet DEC-317 (dwa przebiegi) jest cały dostępny.
- **T13.** `tests/setup.ts:793` (`beforeAll`) jest niegroźny; `tests/setup.ts:809-811`
  (`beforeEach`) kasuje implementacje mocków między testami tego samego pliku.
- **T14.** Stara gałąź `github-backup/codex/day207-write-proposal-20260831` (tip `627e416cfd`)
  niesie wyłącznie mechanizm sprzed FIX-207b (fail-closed, bez realnego writera) i jest dziś
  zastąpiona — nie scalasz jej.

# 3. POZYCJE DYŻURU

## R0 — SETUP OBOWIĄZKOWY: FAST-FORWARD do stanu z dyżurem 207 (NIE merge obcej gałęzi)

**Cel:** Twój worktree, zbudowany per standardowa procedura `§0.1` dokładnie na markerze
`89630f9a8a`, dostaje mechanizm dyżuru 207 (flagę `ENABLE_TERESA_TOOL_LOOP_WRITE`, writer
`createPersonalTask`), bez konfliktów, bo to zwykły postęp tej samej linii historii — nie scalanie
osobnej gałęzi.

```bash
cd /private/tmp/cx-day217-gf-agt-02
git fetch github-backup
git merge-base --is-ancestor 89630f9a8a github-backup/codex/m03-admin-20260824 \
  && echo "marker jest przodkiem tipa" || echo "STOP: marker nie jest przodkiem — zglos"
git merge --ff-only github-backup/codex/m03-admin-20260824
#   oczekiwane: "Fast-forward", ZERO plikow konfliktu, ZERO nowego commita mergujacego.
#   Jesli to NIE jest fast-forward — STOP calego dyzuru (zakaz zwyklego merge'a i zakaz
#   rebase'u, Z3), zglos: zalozenie K2 (liniowa historia) jest obalone.

# WERYFIKACJA — mechanizm 207 realnie na miejscu
grep -n "ENABLE_TERESA_TOOL_LOOP_WRITE" server/src/config/FeatureFlags.ts
grep -n "createPersonalTask" server/src/services/aiActionExecutor.ts
test -f server/src/services/personalTask/createPersonalTaskService.ts && echo "plik obecny"
grep -n "readToolDefs\|writeProposalToolDefs" server/src/services/ai/AIPipeline.ts
grep -n "params.readTools\|params.proposalTools" server/src/services/ai/llmService.ts
#   oczekiwane: flaga (2 trafienia), createPersonalTask (import+wywolanie), plik obecny,
#   OBIE rodziny narzedzi (READ z 206, WRITE z 207) obecne w kazdym pliku.
```

★★ **ZAKAZ scalania `github-backup/codex/day207-write-proposal-20260831`.** Ta gałąź niesie
wyłącznie starszy, zastąpiony mechanizm (K5) — jej scalenie cofnęłoby pracę, którą fast-forward
już dostarcza.

**Ukończone, gdy:** `git status -sb` pokazuje `GALAZ_DYZURU` przesuniętą fast-forwardem, drzewo
czyste, wszystkie cztery weryfikacje wyżej zwracają oczekiwany wynik, nic nie zostało wypchnięte
poza `GALAZ_DYZURU` (gałąź 207 nienaruszona, nigdzie niepushowana).

## R1 — OGNIWO 1+2: rozmowa → narzędzia READ (206) → kontekst organizacji w promptcie (205)

**Cel:** jedna realna tura `/chat/stream` z `ENABLE_TERESA_TOOL_LOOP=true`, w której (a) model
(albo wstrzyknięte wywołanie — `Z15` obowiązuje tu domyślnie) sięga po co najmniej jedno narzędzie
READ przez dyspozytor `executeToolCall`, i (b) wyrenderowany prompt tej tury zawiera sekcję
organizacji z `notes.manualContext` (dowód na STRINGU promptu, nie na strukturze danych — standard
dyżuru 205).

Wejście: real HTTP `POST /api/ai/chat/stream`, realny JWT, realny Postgres, organizacja z co
najmniej jednym zapisanym `organization_context_claim` typu notatki, z unikalnym markerem
tekstowym w treści notatki (wstrzyknij go sam przez istniejący writer zapis-obok z 205).

**Dowód wymagany:** (1) log kroków narzędzia READ z nazwą i statusem; (2) przechwycony **pełny
tekst promptu** wysłanego do modelu (nie podsumowanie), z widocznym markerem notatki organizacji.

## R2 — OGNIWO 3: propozycja zapisu → zatwierdzenie → wykonanie, zadanie realnie powstaje (207)

**Cel:** dowieść, że po fast-forwardzie cały cykl **działa poprawnie od początku do końca** —
propozycja nie pisze bez zgody, a po zgodzie zadanie **realnie powstaje**, tą samą drogą co ekran
My Work.

Scenariusz: real HTTP `/chat/stream` z `ENABLE_TERESA_TOOL_LOOP_WRITE=true`, model (albo
wstrzyknięte wywołanie) woła `create_task` → karta propozycji `execution_proposal` w wątku (SSE)
→ `PATCH /api/ai/actions/:id/approve` (real HTTP) → `PATCH /api/ai/actions/:id/execute` (real
HTTP).

**Dowód wymagany, cztery punkty:**

1. Przed zatwierdzeniem: `tasks` ma **0 nowych** wierszy (dowód stanu bazy, nie brak logu — `Z29`).
2. Po `approve`, przed `execute`: status akcji `APPROVED`, `tasks` nadal **0 nowych**.
3. Po `execute`: odpowiedź niesie `success: true`, **dokładnie 1** nowy wiersz w `tasks`, z
   `source_type = 'ai_chat_proposal'` i `source_id` równym Twojemu `actionId` — to jest sprawdzalny
   znacznik pochodzenia, użyj go w werdykcie.
4. Real HTTP `GET /api/my-work/personal-tasks` (ten sam użytkownik) zwraca to zadanie na liście.

Mutacja `Z29` (obie strony): tymczasowo zdejmij bramkę `if (action.status !==
ACTION_STATUS.APPROVED)` i wywołaj `executeAction` na propozycji wciąż `PENDING`, bez `approve` —
MUSI przejść (bramka zdjęta) i utworzyć zadanie (drugie `0 nowych` w punkcie 1 przestaje chronić).
Przywróć bramkę natychmiast, `git diff` puste, i potwierdź, że z przywróconą bramką to samo
wywołanie na `PENDING` jest **odrzucane**.

**Ukończone, gdy:** wszystkie cztery punkty zmierzone z dowodem, mutacja w obie strony wykonana i
przywrócona, raport jednym zdaniem stwierdza: „propozycja→zgoda→wykonanie działa od początku do
końca; zadanie powstaje realnie, tą samą drogą co My Work, z jawnym śladem pochodzenia".

## R3 — OGNIWO 4: dokument powstaje realną drogą (governed handoff / Document Studio)

**Cel:** niezależnie od R2 (nie jako jego kontynuacja — patrz K4), „dokument" w łańcuchu GF-AGT-02
powstaje przez już żywy, w pełni dowiedziony mechanizm.

Scenariusz: real HTTP `POST /api/document-studio/generate` (real JWT, real Postgres), treść/brief
niosący **unikalny znacznik** `ZNACZNIK-DAY217-<losowy-ciąg-8-znaków>` (świeży ciąg na każdy z
trzech przebiegów R6). Poczekaj na zakończenie generacji (real, nie mock — wzorzec oczekiwania z
`ODBIOR_209.md`).

**Dowód:** zapytaniem SQL potwierdź wiersz artefaktu z Twoim znacznikiem w treści, i że
`materializeDocumentArtifact` faktycznie się wykonał.

## R4 — OGNIWO 5: indeksacja do bazy wiedzy z poprawnym zasięgiem (209+210)

**Cel:** dokument z R3, z `ENABLE_ARTIFACT_KNOWLEDGE_INDEX=true`, trafia do
`knowledge_docs`/`ai_knowledge_embeddings` z poprawnym `scope`.

**Dowód:**
1. Zapytanie SQL: wiersz w `knowledge_docs` z treścią zawierającą Twój znacznik, `scope` zgodny
   z klasyfikacją poufności dokumentu.
2. Zapytanie SQL: odpowiadający wiersz/wiersze w `ai_knowledge_embeddings`.
3. Mutacja `Z29`: zepsuj klasyfikację zasięgu (`inferKnowledgeScope` na sztywno `'organization'`)
   i sprawdź, że test wycieku prywatnej treści między użytkownikami **czerwienieje** — wzorzec z
   `ODBIOR_209.md` mutacja 1. Przywróć natychmiast.

## R5 — OGNIWO 6 (SEDNO) + R3 DYŻURU 206, W JEDNYM SCENARIUSZU Z REALNYM MODELEM

**Cel, dosłownie:** druga, niezależna rozmowa (nowy `conversationId`, ten sam użytkownik) z
**realnym modelem** cytuje w odpowiedzi coś, co powstało w R3/R4 — rzecz, której nie mogła znać
przed indeksacją. **To samo ćwiczenie jednocześnie dowodzi R3 dyżuru 206** (model sam decyduje
wywołać narzędzie, dostaje wynik, używa go w odpowiedzi) — świadomy wybór projektowy, uzasadniony
budżetem: DEC-317 daje dokładnie dwa realne wywołania modelu w całym programie, sklejenie dwóch
wymogów w jeden scenariusz nie mnoży zużycia.

★★ **`Z15` NIE OBOWIĄZUJE WYŁĄCZNIE TUTAJ.** W R0–R4 i R6 modelu nie wołasz w ogóle.

**Licencja na klucz — mechanizm dnia 190/206, dosłownie:**

```
~/.consultify-openrouter
```

jedna linia `OPENROUTER_API_KEY=<wartość>`. **Jedyna dozwolona komenda źródłowa:**

```bash
set -a; . ~/.consultify-openrouter; set +a
```

Nie kopiujesz pliku, nie przenosisz do repo, nie wpisujesz treści do `.env`/`docker-compose*`/żadnej
komendy. `Z40` bez wyjątku: wartość klucza nie pojawia się nigdzie. Pokazujesz wyłącznie:

```bash
env | sed 's/=.*//' | grep -x 'OPENROUTER_API_KEY' && echo "DOSTAWCA OBECNY" || echo "BRAK ZMIENNEJ"
```

Zmierz dostawcę w bazie (`llm_providers`, wyłącznie nazwa + TAK/NIE) i w środowisku, w tej
kolejności.

★★ **Model musi wspierać function-calling** (OpenRouter jest dostawcą OpenAI-kompatybilnym —
obsługa narzędzi zależy od modelu routowanego, nie od OpenRoutera samego). Wybierz model ze
wsparciem narzędzi, wpisz do raportu **nazwę modelu, nigdy klucza**.

**Skrypt: WYŁĄCZNIE `tsx`, wzorem `server/scripts/day195-real-llm-docx-probe.ts`.** Nowy plik
`server/scripts/day217-real-model-probe.ts`, uruchamiany:

```bash
set -a; . ~/.consultify-openrouter; set +a
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6157/cx217 \
ENABLE_TEST_AUTH_BYPASS=false ENABLE_TERESA_TOOL_LOOP=true \
npx tsx server/scripts/day217-real-model-probe.ts
```

**Budżet — arytmetyka DEC-317, wiążąca dla tego dyżuru (wzorzec 206):** jednostka limitu =
**PRZEBIEG** (jedna tura czatu, do 4 rund modelu, bo `stopWhen: stepCountIs(4)`,
`llmService.ts:1343`). **Budżet: dokładnie DWA przebiegi.** Przebieg 1 — flaga READ **ON**: model
dostaje pełny zestaw narzędzi READ (w tym `search_knowledge_base`) i wejście w rodzaju „Co wiadomo
o «<temat dokumentu z R3>»? Sprawdź w bazie wiedzy." — **bez** wymuszania nazwy narzędzia (zakaz
per-turowej dyrektywy „MUSISZ wywołać X", wzorzec zakazany istnieje w `AIPipeline.ts:414-427`).
Model SAM decyduje wywołać `search_knowledge_base`; odpowiedź MUSI zawierać znacznik z R3/R4.
Przebieg 2 — flaga READ **OFF**, to samo wejście, jako mutacja: **zero** wywołań narzędzia,
odpowiedź **nie** zawiera znacznika. Sufit: **5 rund modelu w całym dyżurze.** Zakaz ponawiania
nieudanego przebiegu — nieudany przebieg = **STOP pozycji z opisem**, nie trzeci przebieg. Jeśli
musisz zmienić model — to jest przebieg dodatkowy, policz go jawnie.

Do raportu: **zmierzona** (nie deklarowana) liczba rund z logu (`LLM call success` z realnym
`tokens`/`durationMs`), nazwa modelu, treść odpowiedzi (z widocznym cytowaniem znacznika),
transkrypt kroków narzędzia.

**Jeśli nie skorzystasz z tej pozycji w ogóle** (np. brak klucza) — napisz w raporcie WPROST
„modelu nie wołałem", z powodem. To jest wynik, nie brak.

**Ukończone, gdy:** przebieg 1 pokazuje model SAM wybierający `search_knowledge_base` i cytujący
znacznik z R3/R4 w odpowiedzi; przebieg 2 (OFF) pokazuje zero wywołań i brak znacznika; liczba rund
zmierzona i w budżecie (albo przekroczenie jawnie zgłoszone); nazwa modelu w raporcie.

## R6 — TRZYKROTNE POWTÓRZENIE ŁAŃCUCHA WSTRZYKNIĘTEGO + WERDYKT KOŃCOWY

★★ **Dotyczy WYŁĄCZNIE łańcucha R1–R4 (nie-modelowego, wstrzykniętego).** Nie mnożysz R5 przez
trzy — to złamałoby budżet DEC-317. R1–R4 są deterministyczne, więc mogą biec dowolną liczbę razy
bez kosztu modelu.

Uruchom cały łańcuch R1→R2→R3→R4 **trzy razy**, od świeżej bazy (albo z jawnym czyszczeniem między
przebiegami — opisz które), z osobnym, świeżym znacznikiem `ZNACZNIK-DAY217-…` i osobnym `actionId`
za każdym razem. Wszystkie trzy przebiegi mają dać **ten sam, zgodny z opisem** wynik na każdym
ogniwie — w tym R2 realnie tworzące zadanie za każdym razem.

**Werdykt końcowy — obowiązkowy, dosłownie sześć zdań, jedno na ogniwo:**

1. Ogniwo 1 (READ w rozmowie): działa / nie działa — dowód.
2. Ogniwo 2 (kontekst organizacji w promptcie): działa / nie działa — dowód.
3. Ogniwo 3 (propozycja zapisu → zgoda → wykonanie → realne zadanie w My Work): działa / nie
   działa — dowód, w tym `source_type`/`source_id`.
4. Ogniwo 4 (dokument realną drogą): działa / nie działa — dowód.
5. Ogniwo 5 (indeksacja z zasięgiem): działa / nie działa — dowód.
6. Ogniwo 6 (druga rozmowa cytuje znalezisko z pierwszej): działa / nie działa — dowód, w tym
   wynik R5.

Zakaz zaliczania ogniwa, którego nie widziałeś na własne oczy. Zakaz jednego zbiorczego zdania
„wszystko działa" bez rozbicia na sześć. Werdykt ma prawo brzmieć „moduł 17 nie jest zamknięty,
bo ogniwo N nie działa" — to jest lepszy, uczciwszy wynik niż naciągnięty sukces.

# 4. TABELA LICENCJI PLIKOWYCH

Licencja obejmuje CAŁĄ ścieżkę: fast-forward → READ → kontekst → propozycja → wykonanie → zadanie
→ dokument → indeksacja → zasięg → druga rozmowa → skrypt realnego modelu. Pominięcie ogniwa
zmusiłoby Cię do złamania licencji albo do połowy roboty.

| Zakres | Ścieżki |
|---|---|
| Zapis (R0) | Wyłącznie `git merge --ff-only` — żaden plik nie jest ręcznie edytowany w tym kroku (fast-forward nie tworzy konfliktów). Jeśli git jednak zgłosi konflikt, to sygnał, że założenie K2 jest obalone — STOP, nie edytuj ręcznie |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/aiActionExecutor.ts`, `server/src/services/personalTask/createPersonalTaskService.ts`, `server/src/config/FeatureFlags.ts`, `server/src/services/ai/AIPipeline.ts`, `server/src/services/ai/llmService.ts` — mechanizm dyżuru 207 jest gotowy po fast-forwardzie; R2 go WYWOŁUJE i OBSERWUJE, nie modyfikuje. `aiActionExecutor.ts` ma `// @ts-nocheck` w pierwszej linii — jeśli w nim pracujesz przy diagnozie, typy Cię nie osłonią |
| Odczyt (ZAKAZ ZAPISU) | `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts`, `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`, `server/src/routes/my-work.routes.ts` — bramy i writer kanoniczny; czytasz jako punkt weryfikacji, nie modyfikujesz |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/aiRoleGuard.ts`, `server/src/services/aiPolicyEngine.ts`, `server/src/services/chatPermissionService.ts`, `server/src/services/aiRunLedgerService.ts`, `server/src/services/ai/toolCostEstimates.ts` — bramek i cennika nie zmieniasz, masz przez nie PRZECHODZIĆ |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/documentStudio/documentStudioService.ts`, `server/src/services/knowledge/artifactKnowledgeIndexer.ts`, `server/src/services/ai/embeddingService.ts`, `server/src/services/KnowledgeService.ts` — mechanizm dokumentu/indeksacji/zasięgu jest domknięty przez 209/210; czytasz i wywołujesz, nie zmieniasz |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/ai/toolDefinitions.ts`, `server/src/services/ai/mcpServer.ts` — rejestry narzędzi READ; nie zmieniasz semantyki |
| Odczyt (ZAKAZ SCALANIA) | `github-backup/codex/day207-write-proposal-20260831` — martwa, zastąpiona gałąź (K5); czytasz co najwyżej dla porównania, nigdy nie scalasz |
| Zapis (NOWY) | `server/scripts/day217-real-model-probe.ts` — pełna licencja, wzorzec `day195-real-llm-docx-probe.ts` |
| Zapis (NOWY, testy) | `tests/integration/day217-gf-agt-02.realdb.test.ts`, `tests/unit/backend/day217.*` — pełna licencja, z zastrzeżeniem `Z18`/`Z31`/pułapki `clearAllMocks` (K8). Nowe pliki w `tests/` wymagają `git add -f` |
| Zapis (ograniczony) | `docs/program/funkcje/ARCHITEKTURA_AGENTA_TERESY.md` — WYŁĄCZNIE nowy rozdział na końcu pliku (numer ustalasz pomiarem, `grep -n '^## '`, po fast-forwardzie) + jeden odsyłacz w §6. Zakaz zmiany §1-§5,§7-§9 |
| Zapis (ograniczony) | `docs/program/funkcje/STAN_MODUL_17_2026-08-31.md` — WYŁĄCZNIE dopisanie statusu w sekcji „Do domknięcia zostaje" punkty 3-4, zero usuwania treści |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY217_GF_AGT_02_REPORT.md` |
| Odczyt | `docs/program/funkcje/ODBIOR_205_206.md`, `ODBIOR_207.md`, `ODBIOR_209.md`, `ODBIOR_210.md`, `WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md`, `LISTA_DYZUROW_211_222.md`, `CODEX_DAY206_TOOL_LOOP_REPORT.md` |
| Odczyt | `~/.consultify-openrouter` — WYŁĄCZNIE przez `set -a; . ~/.consultify-openrouter; set +a`, wyłącznie w R5; nigdy nie wypisujesz zawartości |
| Wszystko inne | TYLKO ODCZYT |

**Rozłączność z partią równoległą:** ten dyżur po fast-forwardzie dotyka plików wysokiego ruchu
(`ai.routes.ts`, `AIPipeline.ts`, `llmService.ts`, `FeatureFlags.ts`, `aiActionExecutor.ts`), które
mogą być też dotknięte przez dyżury równoległe z fali B/C
(`docs/program/funkcje/LISTA_DYZUROW_211_222.md`). **Przed pierwszym commitem** sprawdź `git log
--all --oneline` pod kątem innych niescalonych gałęzi dotykających tych samych plików i zgłoś
kolizję zasobową ZANIM zaczniesz pisać, nie po.

# 5. TWARDE ZASADY

Poza kompletem `Z1`–`Z40` z części wspólnej (patrz pole `ZAKAZ_WLASCIWY_TEMU_DYZUROWI`, te same
zakazy wchodzą do wygenerowanego dokumentu przez wiersz `Z40`), dla tego dyżuru obowiązują
dodatkowo, w skrócie (pełna treść w `Z40`):

- R0 (fast-forward) jest warunkiem wstępnym, nie krokiem opcjonalnym; to fast-forward, nie merge —
  zero konfliktów z definicji, a jeśli git zgłosi konflikt, to STOP, nie ręczna edycja.
- Zakaz scalania starej, zastąpionej gałęzi `day207-write-proposal-20260831`.
- Zakaz „naprawy" mechanizmu 207 — jest gotowy, wywołujesz go i obserwujesz.
- Zakaz używania `GENERATE_REPORT` (atrapa) jako „dokumentu".
- Zakaz mieszania zadania (ogniwo 3) i dokumentu (ogniwo 4) w jeden łańcuch przyczynowy w raporcie
  — to dwa równoległe, niepołączone dowody.
- Realny model wyłącznie przez skrypt `tsx`, nigdy przez `*.test.ts`.
- R6 (trzy powtórzenia) dotyczy wyłącznie łańcucha wstrzykniętego, nie mnoży R5.
- Dozwolony werdykt końcowy: „nie działa" dla pojedynczego ogniwa, z dowodem.
