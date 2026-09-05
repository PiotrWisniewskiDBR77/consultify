# INSTRUKCJA DYŻURU nr 371 — Codex — „★★ KARTY PROPOZYCJI W CZACIE — DWA DEFEKTY Z AUDYTU `AUDYT_CZAT_PRZYCISKI_20260905`, JEDEN RDZEŃ I JEDEN POMIAR+ORZECZENIE. **RDZEŃ (K9, D-3):** `ChatTableProposalCard.tsx` trzyma `executed`/`rejected` WYŁĄCZNIE w lokalnym `useState(false)` (linie **45-46**) i NIGDY nie czyta `currentProposal.status` (`grep -c '\.status\b'` w pliku daje **0**) — po odświeżeniu strony (F5) karta zawsze wraca do stanu „do zatwierdzenia”, nawet jeśli backend już wykonał propozycję. `MessageRenderer.tsx:903` przekazuje `onStatusChange={() => {}}` (no-op) — rodzic też nic nie zapisuje. Backend **JUŻ chroni przed podwójną mutacją** (`ChatToSchemaService.ts:481-482`: `if (proposal.status !== 'pending' && proposal.status !== 'approved') throw new Error(...)`), ale zwraca to jako goły **500** (`table-platform.routes.ts:1815-1817`, `mapAppErrorResponse` + `res.status(500)` na twardo) zamiast **409** z kodem czytelnym dla frontu — dokładnie to osłabiło werdykt D-3 z P1 do P2 w `V2_weryfikacja_P1_i_probka.md` pkt 2 („front pokazuje stary stan, ale backend BLOKUJE duplikat”). Naprawa ma DWIE nogi: **(1)** front ma pokazywać PRAWDZIWY, ŻYWY stan (nie zamrożony snapshot sprzed F5 — `src/services/chatHandoff/chatHandoffService.ts:45` przyznaje wprost, że `conversation_messages.metadata` **jest persystowane przez KLIENTA** i serwer nigdy go nie odświeża), więc karta MUSI dociągnąć aktualny status żywym zapytaniem (`TablePlatformApi.getSchemaProposal`, już istnieje, `tablePlatform.api.ts:385`, wołający `GET /schema/proposals/:proposalId`, już zamontowany, `table-platform.routes.ts:1931-1946`) — lokalny `useState` zostaje WYŁĄCZNIE jako optymistyczna nakładka na WŁASNĄ akcję w tej samej sesji, nigdy jako jedyne źródło prawdy po (re)montażu; **(2)** serwer ma zwrócić **409** z kodem (np. `PROPOSAL_ALREADY_EXECUTED`), używając ISTNIEJĄCEGO, używanego już w tym samym pliku przez kilkanaście innych handlerów wzorca `TablePlatformError`/`handleRouteError` (`server/src/services/tablePlatform/ErrorHandling.ts:7,55` — klasa bazowa niesie własny `code`/`statusCode`; `ConflictError:39` jest gotowym przykładem 409), zamiast dzisiejszego `mapAppErrorResponse` + `res.status(500)` na sztywno w TYM JEDNYM handlerze. **KROK 0 (rodzina, ★ obowiązkowy przed naprawą):** wykonawca MIERZY, który z pięciu kart propozycji w czacie z akcją zatwierdź/odrzuć — `ChatTableProposalCard`, `TeresaProposalCard`, `ExecutionProposalMessage`, `GovernedChatHandoffCard`, `GovernedInitiativeHandoffCard` (wszystkie w `src/components/AIChat/`) — trzyma status WYŁĄCZNIE lokalnie jak `ChatTableProposalCard`, a który już czyta stan z propsów/żywego magazynu (np. `ExecutionProposalMessage.tsx:337-338` już miesza `freshProposal?.lifecycleState` z `useProposalLifecycleStore`, `GovernedChatHandoffCard` już czyta `proposal.state` bezpośrednio z propsów w istniejącym teście `GovernedChatHandoffCard.test.tsx`) — i naprawia WYŁĄCZNIE potwierdzone dowodem miejsca tym samym wzorcem, nie całą piątkę „na wszelki wypadek”. **DRUGI TEMAT (K5, D-4, POMIAR + ORZECZENIE — ZAKAZ BUDOWY BEZ DECYZJI):** `CaseIntakeConfirmCard.tsx` nigdy się nie renderuje — w całym `src/`+`server/src/` dokładnie **2** wystąpienia stringa `case_intake_proposal` (`MessageRenderer.tsx:880` odczyt warunku, `CaseIntakeConfirmCard.tsx:26` komentarz), **zero producentów**. Backend ISTNIEJE i jest realny: `caseIntakeService.proposeConversationWorkOrder` ma zamontowaną, realną trasę `POST /api/v8/chat/conversations/:conversationId/case-intake/turn` (`server/src/routes/v8/chat.routes.ts:430-458`, gated `caseIntakeModuleGate`) — ale NIC w strumieniu składania odpowiedzi asystenta (ani `UnifiedChatPanel.tsx`, ani serwerowy `chatExecutionService.ts`) jej nie woła automatycznie i nie wpina wyniku jako `metadata.type='case_intake_proposal'` do wiadomości. Jedyny istniejący analogiczny wzorzec — `table_proposal` — TEŻ nie jest wpięty w główny strumień czatu: metadana `type:'table_proposal'` jest ustawiana po stronie KLIENTA w zupełnie osobnym panelu (`src/components/MyWork/table/ChatToSchemaPanel.tsx:496`), nie w `/chat`. Wykonawca ma ZMIERZYĆ (nie zgadywać), czy istnieje punkt wpięcia o koszcie ≤ 1 dnia PRACY W LICENCJI TEGO DYŻURU (`AIChat/**` — nagłówek `CaseIntakeConfirmCard.tsx:22-29` przyznaje wprost, że wpięcie wymaga zmiany w miejscu SKŁADAJĄCYM odpowiedź asystenta, **poza allowlistem tego pakietu**) i orzec: **A)** taki punkt istnieje w licencji — PODŁĄCZ za NOWĄ flagą `default OFF` (reguła 7 CLAUDE.md — Piotr nigdy pierwszym testerem) z parą dowodów; **B)** nie istnieje w tej licencji — USUŃ martwą gałąź renderu (`MessageRenderer.tsx:880-897` + import) i sam komponent, z dowodem `reachability-from-root.mjs` PRZED i PO (bez regresji gdzie indziej), a pytanie o samą FUNKCJĘ „potwierdzenie zlecenia z czatu” zapisz dla właściciela w sekcji PYTANIA. **Zakaz stanu pośredniego: albo A z flagą, albo B z usunięciem, żadne "zostawiam jak jest, bo się waham" bez wpisanego pytania do właściciela.**"

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
> **wyłącznie** `/private/tmp/cx-day371-karty-propozycji`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`**
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
Zakres: ****`13_CHAT`** — karty propozycji w rozmowie (tabela, sprawa). Dwa niezależne defekty na tym samym ekranie `/chat` (`UnifiedChatPanel mode="full"`, renderowany bezpośrednio przez `AppRoutes.tsx`, BEZ `SplitLayout`): **K9** — `ChatTableProposalCard` gubi stan wykonania po odświeżeniu i serwer maskuje to jako goły 500 zamiast czytelnego 409; **K5** — `CaseIntakeConfirmCard` jest martwym kodem (zero producentów `case_intake_proposal`), wymaga pomiaru i orzeczenia PODŁĄCZ/USUŃ, nie budowy na ślepo. Źródło: `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/E_wiadomosci.md` (D-3, D-4) i `V2_weryfikacja_P1_i_probka.md` (pkt 2, pkt 3) — oba TYLKO ODCZYT, to materiał źródłowy audytu, nie dokument do edycji**.
Trasy front: `**Rdzeń (K9):** `src/components/AIChat/ChatTableProposalCard.tsx` (PEŁNA LICENCJA — `useState(proposal)` l.44, `executed`/`rejected` l.45-46, `if(executed)` l.120, `if(rejected)` l.131, zero użyć `.status`) · `src/components/AIChat/MessageRenderer.tsx` (WĄSKA — wyłącznie `onStatusChange={() => {}}` l.903; ewentualnie usunięcie gałęzi l.880-897 TYLKO jeśli `R4` orzeknie `B`). **Pomiar rodziny (KROK 0, TYLKO ODCZYT chyba że `R1` udowodni identyczny defekt):** `src/components/AIChat/TeresaProposalCard.tsx`, `src/components/AIChat/ExecutionProposalMessage.tsx` (+`src/store/useProposalLifecycleStore.ts`, TYLKO ODCZYT), `src/components/AIChat/GovernedChatHandoffCard.tsx`, `src/components/AIChat/GovernedInitiativeHandoffCard.tsx`. **K5 (pomiar):** `src/components/AIChat/CaseIntakeConfirmCard.tsx` (TYLKO ODCZYT, chyba że `R4` orzeknie `A` w licencji tego pakietu — mało prawdopodobne, patrz nagłówek pliku l.22-29) · `src/components/CaseWorkspace/apiIntake.ts` (TYLKO ODCZYT — dowód istniejącego, curl-potwierdzonego backendu) · `src/components/MyWork/table/ChatToSchemaPanel.tsx:496` (TYLKO ODCZYT — dowód, że `table_proposal` też NIE jest wpięty w główny strumień `/chat`, tylko w osobnym panelu). Klient API: `src/services/api/tablePlatform.api.ts` (TYLKO ODCZYT — `getSchemaProposal` l.385, `executeSchemaProposal` l.325 już wystarczają) · `src/services/api/baseClient.ts` (TYLKO ODCZYT, cross-cutting — `handleResponse` l.194 już przenosi `err.status`/`err.data` z ciała JSON, l.268-270)`. Trasy tył: `★★ SEDNO K9: `server/src/services/tablePlatform/ChatToSchemaService.ts` (WĄSKA LICENCJA — WYŁĄCZNIE `throw new Error(...)` w linii **482** wewnątrz `executeProposal` l.470, strażnik statusu l.481; zakaz zmiany logiki stale-check l.485-517, logiki transakcji l.548-574, `UPDATE ... SET status` l.596, oraz metod `rejectProposal`/`refineProposal`/`getProposal`) · `server/src/routes/table-platform.routes.ts` (WĄSKA LICENCJA — WYŁĄCZNIE blok `catch` handlera `POST /schema/proposals/:proposalId/execute` l.1798-1818, konkretnie l.1815-1817; plik ma **~4800+ linii** i dziesiątki INNYCH handlerów — żadnego z nich nie dotykasz). **Wzorzec do reużycia, JUŻ W TYM SAMYM PLIKU, TYLKO ODCZYT jako przykład:** `server/src/services/tablePlatform/ErrorHandling.ts` — `TablePlatformError` l.7 (konstruktor `(message, code, statusCode, details)`), `ConflictError` l.39 (gotowy 409), `handleRouteError` l.55 (już wołany przez `handleRouteError(err, res, 'createBase')` i ~10 innych handlerów w TYM SAMYM pliku routingu — l.428, 462, 482, 499, 516, 534, 559, 574, 605…). **K5 (pomiar, TYLKO ODCZYT):** `server/src/services/caseWorkspace/caseIntakeService.ts` · `server/src/routes/v10/teresa.routes.ts:285-375` · `server/src/routes/v8/chat.routes.ts:408-565` (trasa `.../case-intake/turn` l.430-458, realna, zamontowana, gated `caseIntakeModuleGate` l.338-339) · `server/src/services/v8/chatExecutionService.ts:140-176` (komentarz opisujący kontrakt bezpieczeństwa `propose`≠`confirm`) — **żadnego z tych plików nie zmieniasz, wyłącznie czytasz i cytujesz `plik:linia` w raporcie**`.

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
WT=/private/tmp/cx-day371-karty-propozycji
MARKER=9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day371-karty-propozycji-20260905 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day371-karty-propozycji/config.worktree"
cat "$VAULT/worktrees/cx-day371-karty-propozycji/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day371-karty-propozycji-scratch
mkdir -p /private/tmp/cx-day371-karty-propozycji-artefakty

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
git -C "$VAULT" log --oneline 9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day371-karty-propozycji-20260905
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziesięć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) ★★★ K9 RDZEN: ChatTableProposalCard trzyma status WYLACZNIE lokalnie, zero .status
bash -c "grep -n 'useState(proposal)\|useState(false)\|if (executed)\|if (rejected)\|onStatusChange' src/components/AIChat/ChatTableProposalCard.tsx"
bash -c "grep -c '\.status\b' src/components/AIChat/ChatTableProposalCard.tsx || echo 0"
#   moje liczby: useState(proposal) l.44, executed l.45, rejected l.46, if(executed) l.120,
#   if(rejected) l.131; grep '.status' daje 0 (exit 1 = zero trafien, komenda 'lub echo 0' to pokazuje).

# (2) MessageRenderer: no-op onStatusChange + linie renderu obu kart
bash -c "grep -n 'onStatusChange\|CaseIntakeConfirmCard\|ChatTableProposalCard\|case_intake_proposal' src/components/AIChat/MessageRenderer.tsx"
#   moje liczby: warunek case_intake_proposal l.880, render CaseIntakeConfirmCard l.891,
#   render ChatTableProposalCard l.901, onStatusChange={() => {}} l.903

# (3) ★★★ Serwer JUZ blokuje powtorne wykonanie, ale golym 500 -- dokladne linie
sed -n '470,483p' server/src/services/tablePlatform/ChatToSchemaService.ts
sed -n '594,598p' server/src/services/tablePlatform/ChatToSchemaService.ts
sed -n '1798,1818p' server/src/routes/table-platform.routes.ts
#   moje liczby: strazniki statusu l.481 (if) / l.482 (throw plain Error);
#   UPDATE ... SET status l.596; catch handlera execute l.1815, res.status(500) na sztywno l.1817

# (4) Istniejacy w REPO wzorzec 409, ktorego route execute NIE uzywa (do reuzycia)
bash -c "grep -n 'class TablePlatformError\|class ConflictError\|export function handleRouteError' server/src/services/tablePlatform/ErrorHandling.ts"
bash -c "grep -c 'handleRouteError(' server/src/routes/table-platform.routes.ts"
#   moje liczby: TablePlatformError l.7, ConflictError l.39, handleRouteError l.55;
#   handleRouteError juz wywolywany 10+ razy w TYM SAMYM pliku (inne handlery)

# (5) Klient JUZ ma GET pojedynczej propozycji + przenoszenie statusu/kodu bledu
bash -c "grep -n 'export async function getSchemaProposal\|export async function executeSchemaProposal' src/services/api/tablePlatform.api.ts"
bash -c "grep -n 'err.status = res.status\|err.data = data' src/services/api/baseClient.ts"
#   moje liczby: getSchemaProposal l.385, executeSchemaProposal l.325;
#   err.status l.268, err.data l.270 w baseClient.ts (istnieja, TYLKO ODCZYT)

# (6) KROK 0 rodziny -- kto trzyma status lokalnie, kto czyta zywe/propsy
bash -c "grep -n 'useState' src/components/AIChat/TeresaProposalCard.tsx src/components/AIChat/GovernedInitiativeHandoffCard.tsx"
bash -c "grep -n 'freshProposal\|useProposalLifecycle' src/components/AIChat/ExecutionProposalMessage.tsx"
bash -c "grep -n 'proposal.state' src/components/AIChat/GovernedChatHandoffCard.tsx"
#   moje liczby: TeresaProposalCard ma useEffect(()=>setCurrentProposal(proposal),[proposal]) l.74-76
#   i czyta currentProposal.state (nie flagi lokalne) -- WYGLADA na wzorzec POPRAWNY, zweryfikuj sam;
#   ExecutionProposalMessage l.337-338 miesza freshProposal z magazynem -- WYGLADA POPRAWNIE;
#   GovernedChatHandoffCard czyta proposal.state bezposrednio z propsow (test istniejacy to potwierdza)

# (7) ★★★ K5: case_intake_proposal ma DOKLADNIE 2 wystapienia w repo, zero producentow
bash -c "grep -rn 'case_intake_proposal' src server"
sed -n '22,29p' src/components/AIChat/CaseIntakeConfirmCard.tsx
#   moje liczby: 2 trafienia (MessageRenderer.tsx:880 odczyt, CaseIntakeConfirmCard.tsx:26 komentarz)

# (8) K5: backend REALNY i zamontowany, ale table_proposal (jedyny analog) tez NIE jest w glownym strumieniu
bash -c "grep -n 'case-intake/turn' server/src/routes/v8/chat.routes.ts"
bash -c "grep -rn 'table_proposal' server/src src | grep -v __tests__"
#   moje liczby: trasa .../case-intake/turn istnieje (chat.routes.ts, ok. l.430-431);
#   'table_proposal' metadata ustawiana WYLACZNIE po stronie klienta w ChatToSchemaPanel.tsx:496
#   (osobny panel My Work, NIE glowny strumien /chat) -- zero wzorca do skopiowania 1:1

# (9) Warunki wspolne serii: liscie slownikow + 4 bezpieczniki (mierz oddzielnie, powtorz w jednej linii jesli sklejone)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   moje liczby (zmierzone 2026-09-05 przy PISANIU tej instrukcji, na WSPOLNEJ,
#   AKTYWNIE EDYTOWANEJ galezi m03): pl 35204, en 33071 (3 min pozniej przy weryfikacji
#   UROSLY do pl 35239 / en 33099 -- BEZ MOJEJ ANI TWOJEJ ZMIANY). focus=0, list=0, artefakt=0 --
#   TE TRZY POWINNY BYC 0 zarowno przed jak i po. ★★ reach=1 (NIE 0!) -- JUZ NA MARKERZE,
#   PRZED TWOJA JAKAKOLWIEK ZMIANA -- lista 'New test-only files' miala 3 pozycje przy
#   pierwszym pomiarze i 15 pozycji 3 minuty pozniej (pliki INNYCH, rownoleglych dyzurow
#   tej samej paczki 367-373 na tej samej galezi m03, NIE z tego dyzuru). To NIE jest
#   Twoja regresja i NIE naprawiasz tej bramki, i NIE ufasz zadnej z powyzszych liczb --
#   zmierz WLASNA, swiezo, TUZ PRZED swoim pierwszym commitem i TUZ PO ostatnim; licz PO
#   NAZWACH plikow (Z37), nie po samej liczbie -- Twoje wlasne nowe pliki testowe doloza
#   sie do listy, to oczekiwane, nazwij je jawnie w raporcie -- i nie dotykaj
#   docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json

# (10) zasoby: dysk, porty, kontener, litera rejestru znaleziska TUZ PRZED COMMITEM
df -h /
lsof -nP -iTCP:6442 -sTCP:LISTEN; lsof -nP -iTCP:5582 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day371 || true
bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"
#   oczekiwane przy wydaniu: >5 GB wolnego; oba porty puste; 0 kontenerow;
#   ostatnia litera na markerze: AF (dyzur 365) -- SPRAWDZ SAM tuz przed commitem, pisza rownolegle inni
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day371-karty-propozycji-20260905` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6442`. Twój JEDYNY port harnessu to `5582`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day371-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3000, 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki 05.09 (`AUDYT_CZAT_PRZYCISKI_20260905`, dyżury 367-373) — nie dotykasz: 367 (6438/5578), 368 (6439/5579), 369 (6440/5580), 370 (6441/5581), 372 (6443/5583), 373 (6444/5584). Twoje własne wyłącznie: baza **6442**, harness **5582**. Starsze rodzeństwo 04.09 (nie dotykasz, informacyjnie): 363-366 pracowały na 6434-6437/5574-5577; paczka 359-362 na 6430-6433/5570-5573. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `**K9: BRAK NOWYCH FLAG.** To jest naprawa POTWIERDZONEGO defektu (D-3, zweryfikowany niezależnie w `V2_weryfikacja_P1_i_probka.md` pkt 2), nie nowy ekran — reguła CLAUDE.md „NIE dla naprawy defektu potwierdzonego” ma zastosowanie wprost. **K5: WARUNKOWO.** Jeżeli `R4` orzeknie werdykt **A** (podłączenie `CaseIntakeConfirmCard` do żywego strumienia) — to JEST nowy, dotąd niewidoczny ekran w produkcji i wymaga NOWEJ flagi funkcyjnej `default OFF` do czasu zrzutu i akceptu Piotra (reguła 7 CLAUDE.md — Piotr nigdy pierwszym testerem wizualnym), NIE wolno włączyć jej domyślnie w tym dyżurze. W praktyce nagłówek `CaseIntakeConfirmCard.tsx:22-29` przyznaje, że wpięcie wymaga zmiany POZA licencją tego pakietu (`AIChat/**`), więc realistycznym wynikiem `R4` jest werdykt **B** (usunięcie martwej gałęzi, zero nowych flag) albo STOP z pytaniem do właściciela — **nie budujesz wpięcia "na próbę" bez flagi i bez tej decyzji**`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs`, `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts`, `server/src/middleware/appErrorMapper.ts`, `src/services/api/baseClient.ts`, `server/src/services/tablePlatform/PermissionsService.ts`, `public/locales/**`. Wszystkie **NIETYKALNE DO ZAPISU** — wolno je wołać/czytać w pomiarze`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY371_KARTY_PROPOZYCJI_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — na markerze ostatnia użyta sekcja to **`AF`** (`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`), więc następna PRAWDOPODOBNIE to `AG` — **ale równolegle piszą inni autorzy (dyżury 367-370, 372-373 tej samej paczki), więc sprawdzasz literę KOMENDĄ TUŻ PRZED COMMITEM, nie ufasz tej liczbie** — oraz nowy katalog dowodowy `evidence/day371-karty-propozycji/` (NIE ISTNIEJE na markerze — tworzysz go). ★★★ **MACIERZ ODBIORU JEST NIETYKALNA W TYM DYŻURZE** — żaden wiersz `G00`-`G20`, żaden moduł, w tym `13_CHAT`; bramkami i macierzą zajmują się równoległe dyżury tej paczki. Plik postępu `/private/tmp/cx-day371-postep.md` żyje POZA repo. Nowe pliki w `tests/` i w `__tests__/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day371-karty-propozycji-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day371-karty-propozycji-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ ASERCJI NA TEKŚCIE ŹRÓDŁA.** Nowy test broniący naprawy `R2` ma wywołać komponent/funkcję i sprawdzić WYNIK (wyrenderowany DOM albo zwrócony status), nigdy `readFileSync`+`toContain` na źródle. ★★★ **ZAKAZ TESTU, KTÓRY DOWODZI TYLKO POJEDYNCZEGO RENDERU.** Dowód na `D-3` MUSI obejmować (re)montaż komponentu z TĄ SAMĄ, już wykonaną propozycją w propsach (symulacja F5) — test, który sprawdza wyłącznie zachowanie PO kliknięciu w tej samej instancji komponentu, niczego nie dowodzi, bo to nie jest kształt zgłoszonego defektu. ★★★ **ZAKAZ ZMIANY INNEGO HANDLERA W `table-platform.routes.ts` NIŻ `execute`.** Plik ma dziesiątki tras; licencja obejmuje WYŁĄCZNIE `catch` handlera z linii ~1815-1817. ★★★ **ZAKAZ BUDOWY WPIĘCIA `case_intake_proposal` BEZ DECYZJI Z `R4`.** Zanim padnie jawny werdykt A/B z dowodem, zero zmian w `MessageRenderer.tsx` w tej gałęzi i zero nowych wywołań `caseIntakeService`/`apiIntake` z głównego strumienia czatu. ★★ **ZAKAZ MYLENIA PUŁAPKI FIKSTURY Z WYNIKIEM POMIARU** (`§0.2e` (e) poniżej) — pusta tablica `operations: []` w seedowanej propozycji daje `400 Cannot resolve baseId` w `requireRoles` (`PermissionsService.ts` ok. l.390-395), ZANIM kod dotrze do strażnika statusu z `R2`; to NIE jest dowód na `R2`, to jest błąd fikstury. ★ **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`, zmiany oczekiwanego kodu odpowiedzi w cudzej asercji** (`Z35`). **ZAKAZ porównania po liczbach** (`Z37`) | Bo oba defekty to ten sam kształt co reszta tej paczki audytowej: przycisk, który wygląda jak zepsuty, a jest tylko niedopięty na jednym z dwóch końców (front-po-refreshu bez żywego odczytu; backend-blokuje-ale-krzyczy-500-zamiast-mówić-po-ludzku), i przycisk, który wygląda jak martwy, a MA gotowy, curl-potwierdzony backend czekający na jeden przewód. Naprawa pierwszego jest tania i jednoznaczna. Naprawa drugiego BEZ pomiaru miejsca wpięcia kończy się albo martwym kodem udającym gotowy, albo — gorzej — próbą wpięcia w plik spoza licencji, co ten dyżur wprost zakazuje |

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
cd /private/tmp/cx-day371-karty-propozycji

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day371-pg psql -U postgres -d cx371 \
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
cd /private/tmp/cx-day371-karty-propozycji

docker run -d --name cx-day371-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx371 \
  -p 127.0.0.1:6442:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day371-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6442/cx371 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6442/cx371 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day371-karty-propozycji && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6442/cx371 \
JWT_SECRET=cx371-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Testy jednostkowe frontu (RTL, `ChatTableProposalCard`) z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, wzorzec mocków jak w `src/components/AIChat/__tests__/GovernedChatHandoffCard.test.tsx` (mock `react-i18next`, `render`/`fireEvent`/`screen` z `@testing-library/react`). Testy serwerowe (pg, real Postgres) z cwd `server/`, `--config server/vitest.config.ts`; wzorzec fikstury ACL jak w `server/src/routes/__tests__/table-platform.schema-proposals-acl-audit.test.ts` (ISTNIEJĄCY plik, TYLKO ODCZYT jako referencja — mockuje CAŁY `ChatToSchemaService`, więc NIE jest dowodem realpg, tylko przykładem struktury JWT/roli). Nowy pg test dla `R2` idzie do `server/src/routes/__tests__/day371.chatToSchema.executeConflict.pg.test.ts` (NOWY, `git add -f`), realny `ApiGateway`, podpisany JWT, `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6442/cx371 JWT_SECRET=cx371-test-secret-do-not-reuse-min-32-znaki`, `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day371-karty-propozycji-artefakty/<etykieta>.json`. Uruchomienie `vitest` z roota bez właściwego configu dla pliku serwerowego daje `No test files found` — to BŁĄD KOMENDY, nie PASS --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day371-karty-propozycji-artefakty/day371-karty-propozycji.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day371-karty-propozycji && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Testy jednostkowe frontu (RTL, `ChatTableProposalCard`) z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, wzorzec mocków jak w `src/components/AIChat/__tests__/GovernedChatHandoffCard.test.tsx` (mock `react-i18next`, `render`/`fireEvent`/`screen` z `@testing-library/react`). Testy serwerowe (pg, real Postgres) z cwd `server/`, `--config server/vitest.config.ts`; wzorzec fikstury ACL jak w `server/src/routes/__tests__/table-platform.schema-proposals-acl-audit.test.ts` (ISTNIEJĄCY plik, TYLKO ODCZYT jako referencja — mockuje CAŁY `ChatToSchemaService`, więc NIE jest dowodem realpg, tylko przykładem struktury JWT/roli). Nowy pg test dla `R2` idzie do `server/src/routes/__tests__/day371.chatToSchema.executeConflict.pg.test.ts` (NOWY, `git add -f`), realny `ApiGateway`, podpisany JWT, `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6442/cx371 JWT_SECRET=cx371-test-secret-do-not-reuse-min-32-znaki`, `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day371-karty-propozycji-artefakty/<etykieta>.json`. Uruchomienie `vitest` z roota bez właściwego configu dla pliku serwerowego daje `No test files found` — to BŁĄD KOMENDY, nie PASS --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day371-karty-propozycji-artefakty/day371-karty-propozycji.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day371-karty-propozycji/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day371-pg psql -U postgres -d cx371 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day371-pg`.
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
> **(e) CZTERY PUŁAPKI WŁAŚCIWE TEMU DYŻUROWI.** (1) **`conversation_messages.metadata` jest persystowane przez KLIENTA, serwer go nie odświeża** (`src/services/chatHandoff/chatHandoffService.ts:45`) — naiwna naprawa „czytaj `proposal.status` z propsów” NIC nie da po F5, bo prop dalej niesie zamrożony snapshot sprzed wykonania; naprawa MUSI dociągnąć żywy stan (`getSchemaProposal`), nie tylko przestawić źródło odczytu w komponencie. (2) **Pusta tablica `operations: []` w seedowanej propozycji nie dotrze do kodu pod testem** — `requireRoles` w `PermissionsService.ts` rozwiązuje `baseId` z `operations[0].target.base_id`; przy pustej tablicy dostaje `null` i middleware zwraca `400` PRZED strażnikiem statusu z `R2`. Operacja MUSI mieć co najmniej jeden element z realnym `target.base_id` wskazującym na zasianą wcześniej `tp_bases` (kolumna `organization_id` wystarcza do „legacy fallback” w `canAccessBase` — `PermissionsService.ts` ok. l.170-185 — nie trzeba osobnego wiersza w `tp_base_members`). Typ operacji może być dowolny (nawet nieistniejący) — `MutationExecutor.executeOperations` (`server/src/services/chatToSchema/mutationExecutor.ts`) łapie błąd PER OPERACJA i zwraca `allSucceeded:false`, NIGDY nie rzuca — trasa i tak odpowiada `200`, a `status` i tak przechodzi w `'failed'` (czyli poza `pending`/`approved`), co WYSTARCZA do zmierzenia drugiego wykonania. (3) **`tp_bases`/`tp_schema_proposals` nie mają FK na `workspace_id`** (sprawdź `server/migrations/700_table_platform_foundation.sql` i migracje późniejsze grepem po `tp_bases`/`ALTER TABLE.*tp_bases` na wypadek FK dodanych później) — fikstura jest przez to prostsza niż w rodzinie Finansów, ale SAM to zweryfikuj przed poleganiem na tym. (4) **Rodzina kart propozycji NIE jest jednorodna.** `ExecutionProposalMessage` już miesza `freshProposal` z `useProposalLifecycleStore` (żywy magazyn, `GET /api/ai/conversations/:id/proposals`) z zamrożonym `meta.lifecycleState` — ALE ten magazyn czyta `ai_actions`/`v8_action_proposals` (`server/src/services/v8/proposalUnificationService.ts`), NIE `tp_schema_proposals`; nie da się go „po prostu” reużyć dla `ChatTableProposalCard` bez rozszerzenia zakresu magazynu, czego ten dyżur NIE robi (osobne zapytanie `getSchemaProposal` per karta wystarczy i jest tańsze)**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day371-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day371-karty-propozycji-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: test broni zachowania z realnym remontem symulujacym F5, mutacja celuje w linie 481-482 ChatToSchemaService.ts, mianownik testow spojny, para dowodow: pierwsze wykonanie 200+mutacja / drugie 409+BRAK drugiej mutacji) · R1 (KROK 0: zmierz cala rodzine 5 kart propozycji, sklasyfikuj kazda jako 'zywy odczyt' / 'wylacznie lokalny', z dowodem — RDZEN POMIAROWY) · R2 (front: ChatTableProposalCard czyta zywy status przez getSchemaProposal, lokalny stan tylko jako optymistyczna nakladka, dowod przez (re)montaz — RDZEN) · R3 (serwer: 500→409 PROPOSAL_ALREADY_EXECUTED przez istniejacy TablePlatformError/handleRouteError w linii 482 i catch execute, pg test z para dowodow — RDZEN) · R4 (K5: pomiar punktu wpiecia case_intake_proposal + jawny werdykt A/flaga-OFF albo B/usuniecie z dowodem reachability, bez stanu posredniego) · R5 (raport, rejestr znaleziska, sekcja PYTANIA DO WLASCICIELA obowiazkowo niepusta)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6442` albo `5582` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6442` albo `5582`** (`Z7`).

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

Dwa defekty z tego samego ekranu (`/chat`, `UnifiedChatPanel mode="full"`), z tego samego
audytu (`docs/program/AUDYT_CZAT_PRZYCISKI_20260905/E_wiadomosci.md`, pozycje D-3 i D-4;
zweryfikowane niezależnie w `V2_weryfikacja_P1_i_probka.md`, punkty 2 i 3). Oba dotyczą
**kart propozycji w rozmowie** — miejsc, gdzie AI proponuje coś (schemat tabeli, nowe
zlecenie), a człowiek klika Zatwierdź/Odrzuć. Ale to są DWA różne kształty defektu i DWIE
różne odpowiedzi:

**D-3 — `ChatTableProposalCard` gubi stan po odświeżeniu (K9, RDZEŃ, naprawiasz).**
Komponent trzyma `executed`/`rejected` WYŁĄCZNIE w lokalnym `useState(false)`
(`ChatTableProposalCard.tsx:45-46`) i **nigdy** nie czyta pola `status` z propozycji —
`grep -c '\.status\b'` w tym pliku daje **0**. `MessageRenderer.tsx:903` przekazuje
`onStatusChange={() => {}}` — no-op — więc rodzic też niczego nie zapisuje. Po odświeżeniu
strony (F5), nowy mount komponentu startuje z `executed=false`/`rejected=false` niezależnie
od tego, co backend faktycznie zrobił z tą propozycją. `V2_weryfikacja_P1_i_probka.md`
punkt 2 sprawdził niezależnie, co się dzieje przy ponownym kliknięciu: backend **JUŻ
blokuje** drugie wykonanie (`ChatToSchemaService.ts:481-482`:
`if (proposal.status !== 'pending' && proposal.status !== 'approved') throw new Error(...)`),
ale trasa (`table-platform.routes.ts:1815-1817`) łapie ten błąd i zwraca **goły 500** —
front dostaje błąd bez kodu, którego mógłby użyć do pokazania czegoś sensowniejszego niż
czerwony banner. Werdykt V2: to zdegradowało D-3 z P1 do **P2** („front pokazuje stary stan,
backend NIE duplikuje mutacji, tylko krzyczy 500 zamiast po ludzku”). Naprawa ma dwie nogi
i obie są w tym dyżurze:

1. Front ma pokazywać **żywy** stan propozycji, nie zamrożony snapshot. Ważne: to NIE jest
   tak proste jak „czytaj `proposal.status` z propsów zamiast z lokalnego state” — bo prop
   `proposal`, który dostaje karta, pochodzi z `msg.metadata.proposal`, a
   `src/services/chatHandoff/chatHandoffService.ts:45` przyznaje wprost, że
   `conversation_messages.metadata` **jest persystowane przez KLIENTA** i serwer NIGDY go
   nie odświeża. Czyli po F5 prop dalej niesie to, co było w momencie utworzenia wiadomości
   (najczęściej `status: 'pending'`), niezależnie od tego, co się stało później. Naprawa
   musi dociągnąć **aktualny** stan żywym zapytaniem — `TablePlatformApi.getSchemaProposal`
   już istnieje (`src/services/api/tablePlatform.api.ts:385`, woła
   `GET /schema/proposals/:proposalId`, już zamontowane i działające,
   `table-platform.routes.ts:1931-1946`). Lokalny `useState` zostaje, ale WYŁĄCZNIE jako
   optymistyczna nakładka na WŁASNĄ akcję użytkownika w tej samej instancji komponentu —
   nigdy jako jedyne źródło prawdy po (re)montażu.
2. Backend ma zwrócić **409** z rozpoznawalnym kodem (np. `PROPOSAL_ALREADY_EXECUTED`)
   zamiast 500 — używając wzorca, który **już istnieje w tym samym pliku serwisu i jest
   już używany przez kilkanaście innych handlerów w tym samym pliku routingu**:
   `server/src/services/tablePlatform/ErrorHandling.ts` eksportuje `TablePlatformError`
   (l.7, konstruktor `(message, code, statusCode, details)`) i gotową `ConflictError`
   (l.39, 409), a `handleRouteError` (l.55) mapuje `statusCode`/`code` na odpowiedź HTTP.
   `table-platform.routes.ts` woła `handleRouteError(err, res, '<nazwa>')` już **10+ razy**
   dla innych handlerów w tym samym pliku (l.428, 462, 482, 499, 516, 534, 559, 574, 605…) —
   handler `execute` (l.1798-1818) jest jednym z niewielu, które tego NIE robią i zamiast
   tego mają `mapAppErrorResponse(e, req, 'error')` + `res.status(500)` na sztywno
   (l.1815-1817). To nie jest nowy mechanizm do wynalezienia — to jest dociągnięcie jednego
   handlera do konwencji, której reszta pliku już przestrzega.

**KROK 0 — rodzina kart propozycji (obowiązkowy przed naprawą, patrz `R1`).** W czacie jest
pięć komponentów z akcją zatwierdź/odrzuć na propozycji AI, wszystkie w
`src/components/AIChat/`: `ChatTableProposalCard`, `TeresaProposalCard`,
`ExecutionProposalMessage`, `GovernedChatHandoffCard`, `GovernedInitiativeHandoffCard`.
Przy pisaniu tej instrukcji zmierzyłem pobieżnie (Ty mierzysz DOKŁADNIE, to jest `R1`):
`TeresaProposalCard` ma `useEffect(() => setCurrentProposal(proposal), [proposal])`
(l.74-76) i renderuje na podstawie `currentProposal.state` — wygląda na wzorzec POPRAWNY.
`ExecutionProposalMessage` miesza `freshProposal?.lifecycleState` z magazynem
`useProposalLifecycleStore` (l.337-338) z zamrożonym `meta.lifecycleState` — wygląda
POPRAWNIE, ale ten magazyn czyta `GET /api/ai/conversations/:id/proposals`, czyli
`ai_actions`/`v8_action_proposals` (`server/src/services/v8/proposalUnificationService.ts`),
**nie** `tp_schema_proposals` — nie da się go reużyć dla `ChatTableProposalCard` bez
rozszerzenia zakresu magazynu, czego ten dyżur NIE robi. `GovernedChatHandoffCard` czyta
`proposal.state` bezpośrednio z propsów (potwierdzone istniejącym testem
`GovernedChatHandoffCard.test.tsx`) — wygląda POPRAWNIE. `GovernedInitiativeHandoffCard`
ma lokalny `useState<GovernedInitiativeHandoffState>('idle')` (l.38) i przy każdej akcji
robi **świeży** `fetch` do `/api/initiatives/:id` — inny kształt ryzyka niż D-3 (nie
pokazuje starego stanu, ale też nie sprawdza „czy to już zaadoptowane” przed ponownym
kliknięciem `Adopt`). **To są MOJE wstępne obserwacje z pisania instrukcji, nie Twój
pomiar — `R1` każe Ci zmierzyć to samodzielnie i dopiero na tej podstawie decydować, co
naprawiasz.**

**D-4 — `CaseIntakeConfirmCard` nigdy się nie renderuje (K5, POMIAR + ORZECZENIE, ZAKAZ
BUDOWY BEZ DECYZJI).** W całym `src/`+`server/src/` dokładnie **2** wystąpienia stringa
`case_intake_proposal`: `MessageRenderer.tsx:880` (warunek renderu) i
`CaseIntakeConfirmCard.tsx:26` (komentarz w nagłówku komponentu). **Zero producentów.**
Backend jest realny i zamontowany: `caseIntakeService.proposeConversationWorkOrder` ma
trasę `POST /api/v8/chat/conversations/:conversationId/case-intake/turn`
(`server/src/routes/v8/chat.routes.ts:430-458`, za `caseIntakeModuleGate`,
l.338-339) i — wg nagłówka `src/components/CaseWorkspace/apiIntake.ts:1-29` — jest
**curl-potwierdzony**: `POST .../turn` → `POST .../confirm` → `201`, realny wiersz
w `case_core`. Ale **nic w strumieniu składania odpowiedzi asystenta** (ani
`UnifiedChatPanel.tsx`, ani serwerowy `chatExecutionService.ts`) nie woła tej trasy
automatycznie i nie wpina wyniku jako `metadata.type='case_intake_proposal'` do wiadomości.
Nagłówek `CaseIntakeConfirmCard.tsx:22-29` przyznaje to wprost i mówi, że wpięcie „wymaga
zmiany w miejscu, które SKŁADA odpowiedź asystenta — poza allowlistem tego pakietu”.
Sprawdziłem, czy istnieje analogiczny, gotowy do skopiowania wzorzec: `table_proposal`
(jedyny inny typ karty z podobnym kształtem) **TEŻ nie jest wpięty w główny strumień
`/chat`** — metadana `type:'table_proposal'` jest ustawiana po stronie KLIENTA w zupełnie
osobnym panelu, `src/components/MyWork/table/ChatToSchemaPanel.tsx:496`, nie w
`UnifiedChatPanel.tsx`. Czyli nie ma gotowego wzorca „jak wpiąć nowy typ karty w główny
strumień czatu” do skopiowania 1:1 — **to jest realna, nietrywialna zmiana architektury
składania wiadomości**, nie jeden dopisany `if`.

**Zadanie `R4` NIE jest „zbuduj wpięcie”.** Jest: zmierz, gdzie dokładnie leży punkt, w
którym trzeba by wywołać `proposeConversationWorkOrder` i ustawić metadanę na wiadomości
asystenta; sprawdź, czy ten punkt leży w licencji tego pakietu (`AIChat/**`) czy poza nią;
i orzeknij jawnym werdyktem:

- **A)** punkt wpięcia istnieje w licencji tego dyżuru, koszt ≤ 1 dzień pracy — PODŁĄCZ,
  za NOWĄ flagą funkcyjną `default OFF` (to jest nowy, dotąd niewidoczny ekran w produkcji —
  reguła 7 CLAUDE.md: Piotr nigdy pierwszym testerem wizualnym), z parą dowodów;
- **B)** nie istnieje w tej licencji (na dzień pisania tej instrukcji to wygląda jak
  realny, przeważający scenariusz — ale TY to potwierdzasz pomiarem, nie moim zdaniem) —
  USUŃ martwą gałąź renderu (`MessageRenderer.tsx:880-897` + import komponentu) i sam plik
  `CaseIntakeConfirmCard.tsx`, z dowodem `reachability-from-root.mjs` PRZED i PO (bez
  regresji gdzie indziej), a pytanie o samą funkcję „potwierdzenie zlecenia z czatu” idzie
  do właściciela jako pytanie, nie jako milczące porzucenie.

**Zakaz stanu pośredniego.** Nie wolno zostawić karty tak, jak jest (martwa, ale
niewspomniana) ani zbudować połowicznego wpięcia „na próbę” bez flagi. Musi paść A albo B,
z dowodem.

## ★ Stan zastany, zmierzony przeze mnie na markerze `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| `ChatTableProposalCard`: `useState` statusu | l.44 (`currentProposal`), l.45 (`executed`), l.46 (`rejected`) | `ChatTableProposalCard.tsx` |
| `ChatTableProposalCard`: użycia `.status` | **0** | cały plik |
| `MessageRenderer`: `onStatusChange` przekazany do karty | no-op `() => {}` | `MessageRenderer.tsx:903` |
| Strażnik statusu w `executeProposal` | l.481 (if) / l.482 (throw plain `Error`) | `ChatToSchemaService.ts` |
| `UPDATE tp_schema_proposals SET status` | l.596 | `ChatToSchemaService.ts` |
| Handler `execute`: `catch` z gołym 500 | l.1815 (catch) / l.1817 (`res.status(500)`) | `table-platform.routes.ts` |
| Wzorzec 409 już istniejący w repo, NIEUŻYWANY przez ten handler | `TablePlatformError` l.7, `ConflictError` l.39, `handleRouteError` l.55 | `ErrorHandling.ts` |
| `handleRouteError` już wywoływany w TYM SAMYM pliku routingu | **10+** razy (inne handlery) | `table-platform.routes.ts` |
| Klient: pobranie żywego stanu jednej propozycji | `getSchemaProposal` l.385 (woła `GET /schema/proposals/:proposalId`, l.1931-1946) | `tablePlatform.api.ts` |
| `err.status`/`err.data` z ciała JSON błędu | l.268 / l.270 (istnieją, TYLKO ODCZYT) | `baseClient.ts` |
| Wystąpienia `case_intake_proposal` w repo | **2** (odczyt + komentarz), **0 producentów** | `MessageRenderer.tsx:880`, `CaseIntakeConfirmCard.tsx:26` |
| Trasa backendu case-intake, realna i zamontowana | `POST .../case-intake/turn`, l.430-458, za `caseIntakeModuleGate` | `chat.routes.ts` |
| `table_proposal` (jedyny analog) — czy wpięty w główny strumień `/chat`? | NIE — ustawiany klientem w osobnym panelu | `ChatToSchemaPanel.tsx:496` |
| Rodzina kart propozycji (KROK 0, wstępnie, TY mierzysz dokładnie) | 5 plików, patrz `R1` | `src/components/AIChat/*.tsx` |

**★★ Bramka `reachability-from-root.mjs --check-baseline` jest CZERWONA (exit 1) już na
markerze, PRZED Twoją jakąkolwiek zmianą** — z powodu plików testowych innych,
równoległych dyżurów tej samej paczki (367-373) na tej samej, współdzielonej gałęzi `m03`.
Lista „New test-only files” miała **3** pozycje przy pierwszym pomiarze i **15** pozycji
trzy minuty później, bez żadnej mojej ani Twojej zmiany. **To NIE jest Twoja regresja i NIE
naprawiasz tej bramki** — patrz `§0.2e` (e) niżej i „WARUNKI WSPÓLNE SERII”.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **2** wystąpienia `case_intake_proposal` w całym repo; **0** użyć
`.status` w `ChatTableProposalCard.tsx`; strażnik statusu w `ChatToSchemaService.ts` w
liniach **481-482**; handler `execute` łapie błąd w linii **1815** i zwraca sztywny **500**
w linii **1817**; `handleRouteError` już wywoływany **10+** razy w `table-platform.routes.ts`
dla INNYCH handlerów; liście słowników **pl ~35200+**, **en ~33070+** — rosnące w czasie
rzeczywistym, bo gałąź jest współdzielona z sześcioma innymi dyżurami tej paczki; trzy
bezpieczniki kanonu (`focus`/`list`/`artefakt`) kończą się kodem **0**; bezpiecznik
`reach` kończy się kodem **1** JUŻ NA MARKERZE (nie Twoja sprawa, patrz wyżej).

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost. Liczby słowników w szczególności BĘDĄ inne — to nie jest błąd
instrukcji, to jest współdzielona gałąź w ruchu.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest
**ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Front, rdzeń K9** | `src/components/AIChat/ChatTableProposalCard.tsx` | **★ PEŁNA LICENCJA** w zakresie `R2` | — |
| **Front, wiązanie statusu** | `src/components/AIChat/MessageRenderer.tsx` | **★ WĄSKA LICENCJA:** wyłącznie linia `onStatusChange={() => {}}` (l.903) w `R2`; **oraz** — TYLKO jeśli `R4` orzeknie werdykt `B` — usunięcie gałęzi `case_intake_proposal` (l.880-897) i importu `CaseIntakeConfirmCard`. Zakaz zmiany czegokolwiek innego w tym pliku (ma **2000+** linii) | Brief z `plik:linia` |
| **Serwer, strażnik statusu** | `server/src/services/tablePlatform/ChatToSchemaService.ts` | **★ WĄSKA LICENCJA:** wyłącznie `throw new Error(...)` w linii **482** wewnątrz `executeProposal` (zamiana na `TablePlatformError`/pochodną z kodem `PROPOSAL_ALREADY_EXECUTED`, 409). Zakaz zmiany stale-check (l.485-517), logiki transakcji (l.548-574), `UPDATE ... SET status` (l.596), oraz metod `rejectProposal`/`refineProposal`/`getProposal`/`undoExecution`/`redoExecution` | Brief z `plik:linia` |
| **Serwer, trasa execute** | `server/src/routes/table-platform.routes.ts` | **★ WĄSKA LICENCJA:** wyłącznie blok `catch` handlera `POST /schema/proposals/:proposalId/execute` (l.1798-1818, konkretnie l.1815-1817) — zamiana `mapAppErrorResponse`+`res.status(500)` na `handleRouteError(e, res, 'schema/execute')`, wzorem l.428 i innych w tym samym pliku. Plik ma **~4800+ linii** i dziesiątki innych handlerów — **żadnego innego nie dotykasz** | Brief z `plik:linia` |
| **Wzorzec błędów (reużywasz, nie zmieniasz)** | `server/src/services/tablePlatform/ErrorHandling.ts` | **TYLKO ODCZYT** — `TablePlatformError`, `ConflictError`, `handleRouteError` już istnieją i wystarczają | — |
| **Klient API (reużywasz, nie zmieniasz)** | `src/services/api/tablePlatform.api.ts` | **TYLKO ODCZYT** — `getSchemaProposal` (l.385) i `executeSchemaProposal` (l.325) już wystarczają. **WĄSKA LICENCJA WARUNKOWA:** jeśli `R2` udowodni, że brakuje pola w zwracanym typie (np. `resolvedAt`), wolno dodać WYŁĄCZNIE pole typu — zakaz zmiany istniejących sygnatur i zachowania | Brief |
| **Klient, mapowanie błędów HTTP** | `src/services/api/baseClient.ts` | **TYLKO ODCZYT — cross-cutting**, używany przez CAŁY front. `err.status`/`err.data` już istnieją i wystarczają | Brief |
| **Rodzina kart (KROK 0, `R1`)** | `src/components/AIChat/{TeresaProposalCard,ExecutionProposalMessage,GovernedChatHandoffCard,GovernedInitiativeHandoffCard}.tsx` | **TYLKO ODCZYT domyślnie.** **WĄSKA LICENCJA WARUNKOWA:** naprawa tym samym wzorcem co `R2` (żywy odczyt statusu zamiast wyłącznie lokalnego) wolno WYŁĄCZNIE dla pliku, dla którego `R1` przedstawi dowód IDENTYCZNEGO defektu (remount z wykonaną propozycją pokazuje stan „do zatwierdzenia”). Zakaz naprawy „na wszelki wypadek” bez tego dowodu | Tabela klasyfikacji w raporcie |
| **Magazyn żywych propozycji (czytasz jako kontekst dla `R1`)** | `src/store/useProposalLifecycleStore.ts` | **TYLKO ODCZYT** | Brief |
| **K5, komponent martwy** | `src/components/AIChat/CaseIntakeConfirmCard.tsx` | **TYLKO ODCZYT dla pomiaru.** Jeśli `R4` = **B**: **★ PEŁNA LICENCJA NA USUNIĘCIE** pliku. Jeśli `R4` = **A**: plik zostaje jak jest (już gotowy wg własnego nagłówka) — zmiana idzie POZA ten pakiet i POZA ten dyżur (brief + pytanie) | Brief + (jeśli `B`) diff usunięcia |
| **K5, backend (pomiar, TYLKO ODCZYT)** | `server/src/services/caseWorkspace/caseIntakeService.ts`, `server/src/routes/v10/teresa.routes.ts`, `server/src/routes/v8/chat.routes.ts`, `server/src/services/v8/chatExecutionService.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** Żadna litera w tych plikach się nie zmienia w tym dyżurze, niezależnie od werdyktu `R4` | Brief z `plik:linia`, cytat kontraktu bezpieczeństwa z `chatExecutionService.ts:140-176` |
| **K5, panel-analog (pomiar, TYLKO ODCZYT)** | `src/components/MyWork/table/ChatToSchemaPanel.tsx` | **TYLKO ODCZYT** — dowód, że `table_proposal` też nie jest wzorcem do skopiowania | Brief |
| **Nowe testy** | `tests/**`, `src/components/AIChat/__tests__/**`, `server/src/routes/__tests__/**`, `server/src/services/tablePlatform/__tests__/**` (NOWE pliki, `git add -f`) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31` | — |
| **Produkt poza licznikiem tego dyżuru** | `src/**` (reszta) | **TYLKO ODCZYT** | Opis w raporcie |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Rejestr bazowy `reachability`** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`, `scripts/dev/reachability-from-root.mjs` | **TYLKO ODCZYT** — bramka jest już czerwona z przyczyn niezwiązanych z tym dyżurem, patrz „Stan zastany” | Opis w raporcie, NIE naprawa |
| **Słowniki** | `public/locales/**` | **TYLKO ODCZYT.** Ten dyżur NIE wymaga nowych kluczy i18n — `ChatTableProposalCard.tsx` już używa wzorca `isPl ? '...pl...' : '...en...'` inline (patrz np. l.68-70) dla wszystkich swoich komunikatów; nowy komunikat „już wykonano” ma iść TYM SAMYM wzorcem, w tym samym pliku, bez dotykania `translation.json` | Opis w raporcie |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł**, w tym `13_CHAT` | Rekomendacja w raporcie |
| **Materiał źródłowy audytu** | `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**` | **TYLKO ODCZYT** — to jest wejście do tego dyżuru, nie dokument do edycji | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem (na markerze ostatnia to `AF`, ale piszą równolegle inni autorzy tej samej paczki 367-373) | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY371_KARTY_PROPOZYCJI_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Nowe dowody** | `evidence/day371-karty-propozycji/**` (**NIE ISTNIEJE — tworzysz**) | **★ PEŁNA LICENCJA**; commitujesz przez `git add -f` | — |
| **Cudze tereny tej paczki** | pozostałe pliki `src/components/AIChat/**` niewymienione wyżej i cały `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/A1,A2,B,C,D,F,V1.md` — dotyczą pozostałych dyżurów 367-370, 372-373 | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

**★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
jest opisany jako „PEŁNA/WĄSKA LICENCJA" — masz pozwolenie i STOP z tytułu „nie wolno mi"
jest NIEZASADNY. Jeżeli pliku nie ma w tabeli w ogóle — domyślnie jest TYLKO DO ODCZYTU.

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC (ale BEDA rosly niezaleznie od Ciebie -- galaz wspoldzielona)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby (chwiejne, patrz "Stan zastany"): pl 35204..35239+, en 33071..33099+

# (b) trzy bezpieczniki MAJA konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby: wszystkie 0

# (c) reach JEST JUZ CZERWONY na markerze -- notujesz liste PO NAZWACH, nie naprawiasz
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   oczekiwane: exit 1, lista "New test-only files" rosnaca w czasie (nie Twoja sprawa) --
#   PO Twoich zmianach lista ma zawierac dodatkowo TWOJE nowe pliki testowe, nazwane
#   jawnie w raporcie, i ZERO plikow zniknietych z listy sprzed Twojej pracy
```

**Jeżeli `focus-canon`/`list-canon`/`artefakt` zaczerwienią się OD TWOJEJ zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`). **`reach` zostaje czerwony
niezależnie od Ciebie — to nie jest Twoja bramka do gaszenia w tym dyżurze.**

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | użycia `.status` w `ChatTableProposalCard.tsx` | `0` | komenda (1) z `§0.3` | TAK — czyta plik komponentu wprost |
| 2 | linia strażnika statusu w `executeProposal` | `481`-`482` | komenda (3) | TAK |
| 3 | linia `catch` z gołym 500 w handlerze `execute` | `1815`/`1817` | komenda (3) | TAK |
| 4 | wywołania `handleRouteError` w `table-platform.routes.ts` (INNE handlery) | `10+` | komenda (4) | TAK — dowód, że wzorzec już istnieje i jest używany |
| 5 | wystąpienia `case_intake_proposal` w `src`+`server/src` | `2` | komenda (7) | TAK — `grep -rn` bez wycinania |
| 6 | producenci `case_intake_proposal` | `0` | komenda (7), ręczna klasyfikacja trafień | TAK |
| 7 | karty z rodziny trzymające status WYŁĄCZNIE lokalnie | — (Ty mierzysz) | komenda (6) + własna lektura każdego pliku | TAK — **to jest `R1`, nie licz pobieżnie jak ja we wstępie** |
| 8 | liście słowników PL/EN | rosnące, patrz wyżej | blok (a) „WARUNKÓW WSPÓLNYCH” | TAK, ale wartość CHWIEJNA — licz PRZED i PO swojej pracy, nie ufaj mojej |
| 9 | `reach` exit code i lista nazw | `1`, rosnąca lista niezależnie od Ciebie | blok (c) „WARUNKÓW WSPÓLNYCH” | TAK — mianownik już zepsuty PRZED Tobą, nie Twoja naprawa |
| 10 | testów w nowym pg-teście `R3` (bazowy vs po mutacji vs po naprawie) | — (Ty tworzysz i liczysz) | Twój nowy plik testu | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`src/components/AIChat/ChatTableProposalCard.tsx` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY371_KARTY_PROPOZYCJI_REPORT.md` (NOWY) ·
`evidence/day371-karty-propozycji/**` (NOWY) ·
nowe pliki testowe front (`src/components/AIChat/__tests__/ChatTableProposalCard.*.test.tsx`)
i serwer (`server/src/routes/__tests__/day371.*.pg.test.ts`).

**Zapisujesz WARUNKOWO:**
`src/components/AIChat/MessageRenderer.tsx` (WYŁĄCZNIE linia `onStatusChange` w `R2`;
usunięcie gałęzi `case_intake_proposal` TYLKO jeśli `R4`=`B`) ·
`server/src/services/tablePlatform/ChatToSchemaService.ts` (WYŁĄCZNIE linia 482, `R3`) ·
`server/src/routes/table-platform.routes.ts` (WYŁĄCZNIE catch handlera execute, `R3`) ·
`src/components/AIChat/CaseIntakeConfirmCard.tsx` (USUNIĘCIE TYLKO jeśli `R4`=`B`) ·
`src/components/AIChat/{TeresaProposalCard,ExecutionProposalMessage,GovernedChatHandoffCard,GovernedInitiativeHandoffCard}.tsx`
(WYŁĄCZNIE plik, dla którego `R1` udowodni identyczny defekt) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `public/locales/**`, `server/src/services/tablePlatform/ErrorHandling.ts`,
`src/services/api/tablePlatform.api.ts`, `src/services/api/baseClient.ts`,
`src/store/useProposalLifecycleStore.ts`, `server/src/services/caseWorkspace/caseIntakeService.ts`,
`server/src/routes/v10/teresa.routes.ts`, `server/src/routes/v8/chat.routes.ts`,
`server/src/services/v8/chatExecutionService.ts`,
`src/components/MyWork/table/ChatToSchemaPanel.tsx`,
`server/src/services/tablePlatform/PermissionsService.ts`, `server/src/middleware/**`,
`server/src/services/ApiGateway.ts`, `server/src/Gateway.ts`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16),
`docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`,
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `.github/workflows/**`, `server/migrations/**` (ten dyżur nie
tworzy migracji — brak zmian schematu), `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day371-karty-propozycji
git diff --name-only --cached | tee /private/tmp/cx-day371-karty-propozycji-artefakty/staged.txt
bash -c "grep -iE '^public/locales/|ErrorHandling\.ts|tablePlatform\.api\.ts|baseClient\.ts|useProposalLifecycleStore|caseIntakeService|teresa\.routes|v8/chat\.routes|chatExecutionService|ChatToSchemaPanel|PermissionsService|^server/src/middleware/|ApiGateway|^server/src/Gateway\.ts|MODULE_ACCEPTANCE|reachability\.baseline|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|AUDYT_CZAT_PRZYCISKI' /private/tmp/cx-day371-karty-propozycji-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
# osobno: zmiana w ChatToSchemaService.ts/table-platform.routes.ts poza dozwolonymi liniami?
git diff --cached -- server/src/services/tablePlatform/ChatToSchemaService.ts | grep -c "^[+-]" 
#   oczekiwane: male (jedna linia throw zmieniona + import) -- duzy diff = naruszenie waskiej licencji
git diff --cached -- server/src/routes/table-platform.routes.ts | grep -c "^[+-]"
#   oczekiwane: male (jeden blok catch) -- duzy diff = naruszenie waskiej licencji
```

---

## R0 — TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Asercja na ZACHOWANIU, nigdy na tekście źródła.** Nowy test wywołuje/renderuje i
sprawdza wynik. `readFileSync` + `toContain` nie jest dowodem.

**(2) Dowód na D-3 MUSI symulować F5, nie tylko kliknięcie w tej samej instancji.** Test,
który klika Zatwierdź i sprawdza render PO kliknięciu w TEJ SAMEJ instancji komponentu,
niczego nie dowodzi — to nie jest kształt zgłoszonego defektu. Dowód wymaga (re)montażu
komponentu z propsem `proposal` niosącym stary status (np. `'pending'`) i z zamockowanym
`getSchemaProposal` zwracającym AKTUALNY, wykonany status — dokładnie tak, jak wyglądałby
świeży mount po F5.

**(3) Mutacja celuje w linię 482 `ChatToSchemaService.ts` (strażnik statusu), nie w coś
obok.** Jeżeli mutacja (np. usunięcie warunku, cofnięcie na plain `Error`) nie zaczerwieni
nowego pg-testu z `R3` — NAJPIERW sprawdzasz, czy trafiła w to, co miała trafić, dopiero
potem orzekasz.

**(4) Para dowodów, obowiązkowa dla `R3`:** **(a)** pierwsze wykonanie propozycji → `200`,
status w bazie faktycznie zmienia się z `pending`/`approved` na coś innego, z zapisanym
`resolved_at`; **(b)** drugie wykonanie TEJ SAMEJ propozycji → `409` z kodem
`PROPOSAL_ALREADY_EXECUTED` (albo równoważnym, nazwij go w raporcie), i `resolved_at` w
bazie **NIE ZMIENIŁ SIĘ** względem (a) — dowód, że druga próba nie uruchomiła drugiej
mutacji, tylko została odrzucona PRZED transakcją.

**(5) `R4` kończy się jawnym werdyktem A albo B, nigdy milczeniem.** Brak decyzji nie jest
opcją — jeśli oba wydają się niemożliwe do rozstrzygnięcia bez właściciela, piszesz to
jako STOP merytoryczny na `R4` z konkretnym pytaniem, nie zostawiasz karty tak, jak jest,
bez wzmianki.

**Wymagany dowód:** pięć zdań w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita.

## R1 — KROK 0: ZMIERZ RODZINĘ KART PROPOZYCJI (rdzeń pomiarowy)

Zanim naprawisz `ChatTableProposalCard`, zmierz WSZYSTKIE pięć kart z tej samej rodziny
(akcja zatwierdź/odrzuć na propozycji AI w czacie), nie tylko zgłoszoną.

1. Dla każdego z pięciu plików (`ChatTableProposalCard`, `TeresaProposalCard`,
   `ExecutionProposalMessage`, `GovernedChatHandoffCard`, `GovernedInitiativeHandoffCard`)
   odpowiedz na DWA pytania z dowodem `plik:linia`: **(i)** skąd komponent bierze
   wyświetlany stan propozycji — wyłącznie z lokalnego `useState` zainicjowanego raz z
   propsa, czy z czegoś, co odświeża się po (re)montażu (props zsynchronizowany
   `useEffect`, żywy magazyn, świeży `fetch`)? **(ii)** czy istnieje scenariusz „(re)mount
   z już rozstrzygniętą propozycją pokazuje stan NIEROZSTRZYGNIĘTY” — analogiczny do D-3?
2. Dla KAŻDEGO z pięciu — napisz krótki test renderu (RTL), który (re)montuje komponent z
   propsem niosącym stan „już rozstrzygnięte” i sprawdza, czy UI to pokazuje BEZ kliknięcia.
   Jeżeli test jest ZIELONY od razu (komponent już poprawny) — to jest Twój dowód, że plik
   NIE wymaga naprawy w tym dyżurze; zapisz go i idź dalej. Jeżeli CZERWONY — masz drugi
   potwierdzony defekt tej samej rodziny.
3. Napraw TYLKO pliki z potwierdzonym (czerwonym) testem z punktu 2, tym samym wzorcem co
   `R2` (żywy odczyt zamiast wyłącznie lokalnego stanu) — o ile żywe źródło prawdy jest
   dostępne w licencji tego dyżuru (patrz uwaga o `useProposalLifecycleStore` niżej). Jeżeli
   naprawa wymagałaby pliku spoza licencji — STOP merytoryczny na TĘ kartę, brief + diff
   nienałożony, kontynuujesz resztę.
4. **Uwaga udokumentowana przy pisaniu tej instrukcji, zweryfikuj sam:** `ExecutionProposalMessage`
   miesza `freshProposal` z `useProposalLifecycleStore`, ale ten magazyn czyta
   `ai_actions`/`v8_action_proposals`, NIE `tp_schema_proposals` — nie rozszerzasz zakresu
   tego magazynu w tym dyżurze (to byłaby zmiana poza licencją). Jeśli Twój test w punkcie 2
   dla tego pliku wyjdzie czerwony mimo tego mechanizmu — to jest STOP merytoryczny do
   opisania, nie naprawa przez rozszerzenie magazynu.

**Wymagany dowód:** tabela pięciu wierszy (plik · źródło stanu · wynik testu remontu ·
decyzja: naprawiam / nie wymaga / STOP z licencją) · pięć nowych testów (jeden na plik,
mogą być w jednym pliku `tests`) · diff naprawy dla każdego potwierdzonego przypadku.
**Commit po `R1`.**

## R2 — `ChatTableProposalCard`: ŻYWY ODCZYT STATUSU (rdzeń)

1. **Pokaż defekt na (re)mount.** Nowy test RTL: (re)montuje `ChatTableProposalCard` z
   propsem `proposal.status='pending'`, zamockowanym `TablePlatformApi.getSchemaProposal`
   zwracającym `{ ...proposal, status: 'executed' }`. Dzisiejszy kod (przed naprawą) ma
   pokazać przyciski Zatwierdź/Odrzuć mimo że „serwer” mówi `executed` — to jest dowód
   defektu, zapisz komendę i wynik dosłownie (test ma być CZERWONY na kodzie sprzed naprawy).
2. **Napraw.** Przy mount (i przy zmianie `proposal.id`) komponent woła
   `TablePlatformApi.getSchemaProposal(proposal.id)` i renderuje na podstawie
   NAJŚWIEŻSZEGO znanego statusu (wynik zapytania, jeśli dostępny; propsa, jeśli zapytanie
   jeszcze w locie; własnej optymistycznej akcji, jeśli użytkownik dopiero co kliknął W TEJ
   SESJI). Obsłuż błąd zapytania (np. offline) bez wywalenia komponentu — pokaż istniejący
   stan optymistyczny/propsowy z cichym `console.error`, tak jak reszta pliku dziś robi dla
   błędów akcji.
3. **Rozróżnij 409 od innych błędów w `handleAccept`.** Gdy `TablePlatformApi.executeSchemaProposal`
   rzuci błąd z `err.status === 409` (sprawdź faktyczny kształt po naprawie `R3` — `err.data.code`
   powinno nieść Twój kod z serwera), NIE pokazuj generycznego czerwonego banneru „Nie udało
   się utworzyć tabeli” — przełącz kartę w stan **wykonano**, tym samym wzorcem
   `isPl ? '...' : '...'`, jakim plik dziś renderuje inne komunikaty (np. l.68-70). Dla
   innych kodów/statusów zostaje dzisiejsze zachowanie (czerwony banner z `error`).
4. **Wywołaj `onStatusChange` naprawdę** (nie no-op) przy zmianie stanu — z `MessageRenderer.tsx:903`
   usuwasz `() => {}}` i przekazujesz realny handler (może być prosty, np. tylko
   `console.debug`/no-op udokumentowany jako świadomy wybór, JEŚLI rodzic i tak nie ma gdzie
   zapisać wyniku trwale — ale to musi być ŚWIADOME zdanie w raporcie, nie przeoczenie).
5. **Powtórz dowód mutacyjny.** Cofnij naprawę przez `cp` ze `SCRATCH` do stanu z punktu 1
   — test ma ZACZERWIENIĆ SIĘ; przywróć — ma ZZIELENIEĆ; `git diff` po cofnięciu **pusty**.
6. **Nie osłabiasz reszty pliku.** `diff` listy pełnych nazw testów przed/po — istniejące
   zachowania (Doprecyzuj, Anuluj, błąd sieciowy przy Accept/Reject) zostają nietknięte.

**Wymagany dowód:** test remontu czerwony na starym kodzie, zielony po naprawie · diff
naprawy · dowód mutacyjny w obie strony · zdanie o `onStatusChange` · `diff` list pełnych
nazw. **Commit po `R2`.**

## R3 — SERWER: 500 → 409 `PROPOSAL_ALREADY_EXECUTED` (rdzeń)

**Uważaj na pułapkę fikstury — `§0.2e` (e) niżej: pusta tablica `operations` w seedowanej
propozycji zatrzyma żądanie w `requireRoles` (`400 Cannot resolve baseId`), ZANIM dotrze
do kodu pod testem. Operacja musi mieć `target.base_id` wskazujący na realny wiersz
`tp_bases`.**

1. **Fikstura minimalna.** Zasiej: użytkownika + organizację (jak w innych pg-testach tego
   repo) · wiersz `tp_bases` z `organization_id` równym organizacji aktora (legacy fallback
   w `canAccessBase` wystarcza — nie musisz osobnego wiersza w `tp_base_members`) · wiersz
   `tp_schema_proposals` ze `status='pending'`, `operations` zawierającym JEDEN element z
   `target.base_id` wskazującym na zasianą bazę (typ operacji może być dowolny, nawet
   nieistniejący — `MutationExecutor` łapie błąd per-operację i nie rzuca, `status` i tak
   przejdzie w `'failed'`, co wystarcza do zmierzenia drugiego wykonania). Sprawdź SAM, czy
   `tp_bases`/`tp_schema_proposals` mają FK dodane w migracjach PO `700_table_platform_foundation.sql`
   (`bash -c "grep -rn 'tp_bases\|tp_schema_proposals' server/migrations/ | grep -i 'FOREIGN KEY\|REFERENCES'"`)
   — jeśli tak, dopisz brakujące wiersze rodzicielskie do fikstury.
2. **Przebieg PRZED naprawą.** Realny `ApiGateway`, podpisany JWT, `POST .../execute` raz →
   zapisz kod odpowiedzi i `status`/`resolved_at` propozycji w bazie. `POST .../execute`
   drugi raz, ten sam `proposalId` → zapisz kod odpowiedzi (dziś: **500**, bez kodu).
3. **Napraw** `ChatToSchemaService.ts:482`: `throw new TablePlatformError(message, 'PROPOSAL_ALREADY_EXECUTED', 409, { status: proposal.status })`
   (albo `ConflictError` z dopisanym `details.code`, jeśli wolisz — uzasadnij wybór w
   raporcie) i `table-platform.routes.ts` (catch handlera execute): zamień na
   `handleRouteError(e, res, 'schema/execute')`, wzorem innych handlerów w tym pliku.
4. **Przebieg PO naprawie, ta sama fikstura.** Pierwsze wykonanie → `200`, `resolved_at`=T1.
   Drugie wykonanie → **409**, ciało zawiera `code: 'PROPOSAL_ALREADY_EXECUTED'` (albo Twoją
   nazwę). Odczytaj propozycję z bazy jeszcze raz — `resolved_at` **wciąż T1** (dowód braku
   drugiej mutacji), `status` niezmieniony względem (a).
5. **Mutacja odwrotna — dowód, że test broni NAPRAWY, nie przypadku.** Cofnij `R3` przez
   `cp` ze `SCRATCH` do stanu sprzed naprawy — nowy test ma ZACZERWIENIĆ SIĘ (bo znów
   dostanie 500 zamiast 409, albo `code` będzie inny/brak); przywróć — ma ZZIELENIEĆ;
   `git diff` po cofnięciu **pusty**.
6. **Nie poszerzasz statusów, które omijają strażnik.** Warunek zostaje
   `!== 'pending' && !== 'approved'` — zmieniasz WYŁĄCZNIE typ/kod rzucanego błędu, nigdy
   warunek, który decyduje, kiedy błąd pada.

**Wymagany dowód:** dosłowne komendy i odpowiedzi obu przebiegów (przed i po naprawie) ·
diff naprawy (dwa pliki, wąski) · dowód mutacyjny w obie strony · odczyt `resolved_at`
z bazy potwierdzający brak drugiej mutacji · zdanie o FK sprawdzonych w migracjach.
**Commit po `R3`.**

## R4 — K5: `CaseIntakeConfirmCard` — POMIAR PUNKTU WPIĘCIA I JAWNY WERDYKT

**To NIE jest pozycja „napraw kod”. To jest pozycja „zmierz i zdecyduj”.**

1. **Potwierdź martwotę.** `grep -rn 'case_intake_proposal' src server` → oczekiwane **2**
   trafienia (odczyt w `MessageRenderer.tsx:880`, komentarz w `CaseIntakeConfirmCard.tsx:26`).
   Jeśli Twój wynik jest inny — to jest WYNIK, nie sprzeczność; zapisz go i kontynuuj z
   Twoją liczbą.
2. **Zlokalizuj punkt składania odpowiedzi asystenta.** Znajdź, w którym miejscu front
   (`UnifiedChatPanel.tsx`) albo backend (strumień odpowiedzi AI) konstruuje `metadata`
   wiadomości asystenta, którą później czyta `MessageRenderer.tsx`. Sprawdź, czy ten punkt
   leży w `src/components/AIChat/**` (licencja tego pakietu) czy poza nią (np. w warstwie
   strumieniowania SSE, w serwisie AI, w innym module). Podaj `plik:linia`.
3. **Zmierz koszt wpięcia w TEJ licencji.** Ile plików SPOZA `AIChat/**` musiałbyś
   zmienić, żeby po odpowiedzi asystenta wywołać `proposeConversationWorkOrder` (przez
   `/case-intake/turn`) i doczepić wynik jako `metadata.type='case_intake_proposal'` do
   wiadomości? Jeżeli odpowiedź to „zero, wystarczy zmiana w `AIChat/**`” — to jest droga
   `A`. Jeżeli wymaga zmiany strumienia odpowiedzi AI, orkiestracji serwera albo innego
   modułu — to jest droga `B`, niezależnie od tego, jak małą wydaje się ta zmiana „w
   teorii” — bo taka zmiana jest POZA licencją tego dyżuru.
4. **Werdykt `A` (jeśli koszt mieści się w licencji):** wpiąć za NOWĄ flagą
   `default OFF` (np. `ENABLE_CASE_INTAKE_CHAT_CARD` — nazwę dobierz sam, sprawdź że nie
   istnieje: `grep -rn '<TWOJA_NAZWA>' server/src src`), z parą dowodów: **(a)** rozmowa BEZ
   pracy governed → zero propozycji Case (kanon CW-CANON-01, cytowany w nagłówku
   `apiIntake.ts`); **(b)** rozmowa z rozpoznaną pracą → karta się renderuje za flagą `ON`
   w teście, `OFF` domyślnie w produkcie. Zrzut dla Piotra NIE wchodzi w ten dyżur (flaga
   zostaje `OFF` do jego akceptu, reguła 7 CLAUDE.md).
5. **Werdykt `B` (realistyczny scenariusz na dzień pisania tej instrukcji, ale TY to
   potwierdzasz):** usuń gałąź `MessageRenderer.tsx:880-897` (warunek + render
   `CaseIntakeConfirmCard`) i import komponentu; usuń plik `CaseIntakeConfirmCard.tsx`.
   Dowód: `node scripts/dev/reachability-from-root.mjs --check-baseline` PRZED i PO —
   usunięcie ma zmniejszyć liczbę osiągalnych-ale-martwych ścieżek, nie zepsuć nic innego
   (porównaj PEŁNE listy, nie same liczby, `Z37`). Sprawdź też, czy usunięcie importu nie
   zostawia nieużywanych innych importów w `MessageRenderer.tsx` (np. typów używanych tylko
   przez tę gałąź).
6. **Zero stanu pośredniego.** Jeśli po pomiarze nie potrafisz jednoznacznie wybrać `A` ani
   `B` (np. koszt wpięcia jest niejasny bez decyzji produktowej o TYM, kiedy Teresa ma w
   ogóle próbować rozpoznawać „nową sprawę”) — to jest STOP merytoryczny na `R4`: karta
   ZOSTAJE jak jest (martwa), ale piszesz to WPROST w raporcie jako pytanie do właściciela
   z konkretnym „czego mi zabrakło, żeby rozstrzygnąć samodzielnie” — nie milczysz.

**Wymagany dowód:** cytat `plik:linia` punktu składania metadanych · rachunek kosztu
(pliki spoza `AIChat/**`, którymi trzeba by ruszyć) · jawny werdykt A/B/STOP z uzasadnieniem
odrzucenia pozostałych opcji · (jeśli `B`) dowód reachability przed/po · (jeśli `A`) para
dowodów + nazwa i wartość domyślna nowej flagi. **Commit po `R4`.**

## R5 — RAPORT, REJESTR ZNALEZISK, PYTANIA DO WŁAŚCICIELA

Raport zawiera: dowód defektu D-3 na (re)moncie i diff naprawy `R2` · tabelę pięciu kart
z `R1` (źródło stanu · wynik testu remontu · decyzja) · dowód pary 200/409 z `R3`, z
`resolved_at` niezmienionym po drugiej próbie · werdykt `R4` (A/B/STOP) z uzasadnieniem ·
listę rozbieżności wobec liczb tej instrukcji (słowniki PL/EN w szczególności — oczekiwana
rozbieżność, nie błąd) · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE”** · obowiązkowy
akapit `§0.2e` dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „RODZINA KART PROPOZYCJI — STAN PO DYŻURZE”.** Pięć
wierszy (jeden na komponent), z kolumną „naprawiony w tym dyżurze / już był poprawny /
STOP z licencją”.

★★ **Osobna, obowiązkowa sekcja: „CASE INTAKE — WERDYKT I DLACZEGO”.** Jedno zdanie
werdyktu (A/B/STOP) plus rachunek kosztu z `R4` punkt 3, dosłownie.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** NIE MOŻE być pusta. Jeśli
`R4` zakończył się `A` lub `B` z pewnością — nadal wpisz pytanie: „czy funkcja
'potwierdzenie nowej sprawy wprost z czatu' ma w ogóle wejść do produktu w obecnym
kształcie (Teresa sama rozpoznaje 'nową sprawę' z treści rozmowy), czy to zbyt ryzykowne
bez jawnej komendy użytkownika?” — to pytanie produktowe niezależne od tego, czy kod dziś
jest podłączony czy usunięty. Jeśli `R4` zakończył się STOP-em, dopisz DRUGIE, konkretne
pytanie z `R4` punkt 6.

★ Zanim dopiszesz cokolwiek do `REJESTR_ZNALEZISK_20260903.md`, sprawdź literę TUŻ PRZED
COMMITEM: `bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
— piszą równolegle inni autorzy tej samej paczki (367-370, 372-373).

**Commit po `R5`.**

## Próg odbioru

**D-3 domknięty:** `ChatTableProposalCard` pokazuje żywy status po (re)moncie (dowód
symulujący F5, nie tylko klik w tej samej instancji), backend zwraca `409` z kodem zamiast
`500` na drugie wykonanie, z parą dowodów (pierwsza mutacja przechodzi, druga nie
powtarza się — `resolved_at` niezmieniony). **Rodzina zmierzona** (`R1`), naprawiona tam,
gdzie dowód to potwierdził. **D-4 rozstrzygnięty** jawnym werdyktem A/B/STOP z dowodem, nie
zostawiony w milczeniu. Sekcja „PYTANIA DO WŁAŚCICIELA” niepusta.

Odbiorca odrzuci dyżur, w którym: nowy test dowodzi tylko zachowania po kliknięciu w tej
samej instancji (nie symuluje F5); backend dalej zwraca goły 500; naprawiono kartę spoza
`R1`-potwierdzonej listy „na wszelki wypadek”; `CaseIntakeConfirmCard` został zbudowany bez
flagi albo pozostawiony bez werdyktu; zmieniono plik spoza wąskiej licencji w
`ChatToSchemaService.ts`/`table-platform.routes.ts`; albo zmienił się stan choćby jednego
wiersza macierzy odbioru.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „D-3 naprawiony i
udowodniony mutacyjnie, rodzina zmierzona (3 z 5 już poprawne, 1 naprawiony, 1 STOP z
licencją), D-4 zakończony werdyktem B z dowodem reachability” — **jest pełnowartościowym
wynikiem**, nawet jeśli werdykt `R4` to STOP.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną. **Liczby słowników w
szczególności — ta gałąź jest w ruchu, licz na nowo.**

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Napraw D-3 czytając status z serwera” vs „nie zmieniaj architektury magazynu propozycji” | `R2`: nowe zapytanie `getSchemaProposal` per-karta, BEZ rozszerzania `useProposalLifecycleStore`; ten drugi zostaje `tp_schema_proposals`-ślepy |
| „Napraw całą rodzinę (KROK 0)” vs „nie naprawiaj bez dowodu” | `R1`: naprawa TYLKO plików z czerwonym testem remontu; reszta zostaje z dowodem „już poprawne” |
| „Serwer ma zwrócić 409” vs „nie zmieniaj strażnika/warunku” | `R3` punkt 6: zmieniasz WYŁĄCZNIE typ/kod błędu, warunek `!== pending && !== approved` zostaje identyczny |
| „Podłącz Case Intake” vs „AIChat/** to Twoja jedyna licencja frontowa” | `R4`: werdykt `A` tylko jeśli cały koszt mieści się w tej licencji; inaczej `B` albo STOP, nigdy zmiana poza pakietem |
| „Nowy ekran wymaga flagi” vs „usuwasz martwy kod” | `R4`: flaga dotyczy WYŁĄCZNIE werdyktu `A` (coś zaczyna się renderować); werdykt `B` usuwa, nie dodaje niczego widocznego, więc flaga nie ma zastosowania |
| „`reach` musi być 0” vs „`reach`=1 już na markerze” | „Stan zastany” i „Warunki wspólne”: bramka czerwona z przyczyn niezwiązanych z tym dyżurem; mierzysz deltę po nazwach, nie naprawiasz cudzej czerwieni |
| „Fikstura pg-testu ma być minimalna” vs „`requireRoles` wymaga rozwiązywalnego `baseId`” | `R3` punkt 1 i `§0.2e` (e): operacja z realnym `target.base_id` jest MINIMUM, pusta tablica `operations` nie przechodzi przez middleware w ogóle |
| „Dopisz sekcję do rejestru znalezisk” vs „równolegle piszą inni autorzy” | `R5`: literę sprawdzasz komendą tuż przed commitem |
| „Zmierz liczby z instrukcji” vs „gałąź jest współdzielona i liczby rosną” | „Zmierz moje liczby sam”: dla słowników i `reach` liczy się WŁASNY świeży pomiar, nie zgodność z liczbą autora |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 9 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — wszystkie ścieżki `plik:linia` w tym dokumencie sprawdzone `sed -n`/`grep -n` na worktree z markera `9715bab7…`; `evidence/day371-karty-propozycji/` i nowe pliki testowe jawnie oznaczone jako NIE ISTNIEJĄ |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 10 wierszy; wiersze 1-6 zmierzone przy wydaniu; słowniki i `reach` jawnie oznaczone jako CHWIEJNE z dwoma pomiarami w odstępie 3 minut jako dowód |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — front rdzeń · wiązanie statusu · serwer strażnik · serwer trasa · wzorzec błędów (odczyt) · klient API (odczyt) · klient mapowanie błędów (odczyt) · rodzina kart (warunkowa) · magazyn (odczyt) · K5 komponent · K5 backend (odczyt) · K5 panel-analog (odczyt) · nowe testy · reszta produktu · infrastruktura testów · rejestr reachability · słowniki · macierz · audyt źródłowy · rejestr znalezisk · raport · nowe dowody · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` dotyka wyłącznie plików `AIChat/**` + nowych testów; `R2` jednego komponentu + jednej linii w `MessageRenderer.tsx`; `R3` jednej linii serwisu + jednego bloku catch; `R4` mierzy i orzeka, kod tylko w wariancie `B` (usunięcie, zero plików przekrojowych) |
| 6 | Przydział zasobów wyłącznych sprawdzony wobec dyżurów równoległych | TAK — 6442/5582 wolne (`lsof` przy wydaniu), brak kontenera `cx-day371-pg`, brak gałęzi/worktree `codex/day371-*`; rodzeństwo 367-370, 372-373 ma rozłączne porty (6438-6441, 6443-6444 / 5578-5581, 5583-5584) i rozłączne pliki źródłowe (`ChatTableProposalCard`/`CaseIntakeConfirmCard` nie występują w innych częściach audytu `A1,A2,B,C,D,F,V1.md`) |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera, w tym poprawiona wersja komendy (8) po naprawieniu błędu cudzysłowów wykrytego przy walidacji |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: metadana persystowana przez klienta (nie serwer), pusta `operations` blokuje `requireRoles` przed strażnikiem, brak FK ale sprawdź migracje późniejsze, `reach` czerwony z cudzej przyczyny, rodzina kart niejednorodna (dwie już poprawne, jedna inny kształt ryzyka) |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu: znaczników niepodmienionego pola szablonu zero |
