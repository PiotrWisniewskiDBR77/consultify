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
