# ODBIÓR TRÓJWARSTWOWY — CODEX1 „Inicjatywy: jeden magazyn danych"

Warstwa 1 (kod vs kontrakt) + warstwa 2 (runtime na żywym stanowisku).
Odbierający: robotnik Opus C1-ODBIÓR. Data: 2026-09-10.

## 0. STANOWISKO (odtwarzalne)

| Element | Wartość |
| --- | --- |
| Worktree | `/Users/piotrwisniewski/Developer/wt/c1-odbior` |
| Odbierany SHA | `49cd114773` (wierzch `codex/inicjatywy-jeden-magazyn-20260910`) |
| Marker (baza) | `4630b1ee4c` |
| Gałąź odbioru | `mvp/c1-odbior-20260910` |
| Baza | `consultify_kopia_c1` = `TEMPLATE consultify_staging_1009`, kontener `consultify-pg18` (54418) |
| Dane wejściowe | 8 organizacji · `initiatives` 121 · `ie_aggregate_state(initiative)` 31 |
| DBR77 `a3e05d4a-…` | legacy 106 · kanon 21 · **kolizji id 6** · kanon-only 15 |
| API ON | `127.0.0.1:4227`, `ENABLE_INITIATIVE_UNIFIED_READ=true` |
| API OFF | `127.0.0.1:4237`, flaga nieustawiona |
| Vite | 3247 → 4227 (ON) · 3257 → 4237 (OFF) |
| Konto | `audyt@dbr77.local` (OWNER DBR77, onboarding ukończony) |
| Silnik | realny PostgreSQL 18 (`DB_TYPE=postgres`, `MOCK_DB=false`) — atrapa `Database.ts:686` NIE bierze udziału w żadnym dowodzie |

Wszystkie liczby poniżej pochodzą z pomiaru na tym stanowisku, nie z raportu Codexa.

---

## 1. WARSTWA 1 — KOD vs KONTRAKT

| # | Wymaganie instrukcji | Spełnione | Dowód (plik:linia / pomiar) |
| --- | --- | --- | --- |
| W1.1 | Tenant-scoping obu magazynów — każde zapytanie z `organization_id` | **TAK** | `initiativeUnifiedReader.ts:118,121` (UNION ALL, oba ramiona z org), `:136` (kanon), `:143` (legacy), `:157` (kanon lista), `:163` (legacy lista). Ścieżki bez filtra: **0**. Potwierdzone runtime — p. W2.6 |
| W1.2 | Deduplikacja z priorytetem kanonu | **TAK w czytniku**, ale **nie na wyjściu HTTP** | `initiativeUnifiedReader.ts:168-175` — legacy wpisane pierwsze, kanon nadpisuje (`byId.set`). ALE `InitiativeController.ts:447-449` odwraca to: `present.has(header.id) → continue`, więc na liście HTTP wygrywa **wiersz klasyczny**. Karta: `:494` woła czytnik dopiero `if (!initiative)`, więc też wygrywa klasyczny |
| W1.3 | Jawne `source` | **TAK, ale wadliwie osadzone** | `initiativeUnifiedReader.ts:12,65,91` — pole `source: 'CANONICAL'\|'LEGACY'`. Wada: `InitiativeController.ts:456` wpisuje je do pola **`sourceType`**, które w tym kontrakcie niesie pochodzenie biznesowe (`manual`, `tool`, `teresa_chat`, `assessment`). Zmierzone: w odpowiedzi ON pojawia się `sourceType:"CANONICAL"` ×15 — kod techniczny w polu plakietki źródła (DEC 02.09 „Assessment = plakietka źródła") |
| W1.4 | Flaga default OFF, ścieżka OFF bit-identyczna z markerem | **TAK — dowiedzione** | `initiativeUnifiedReader.ts:107-109` (`=== 'true'`, brak `??`, brak wczesnego `return true`). Dowód identyczności: po usunięciu z pliku Codexa importu czytnika i 3 bloków za flagą, porównanie `InitiativeController.ts` z markerem po usunięciu białych znaków daje różnicę **4 znaków** — dwie pary zbędnych nawiasów w `hasMilestoneBaseline ? (Number(x)\|\|0) : null` (`\|\|` wiąże silniej niż `?:`, semantyka identyczna). Runtime OFF: reader nie zawołany ani razu (`grep -c initiativeUnifiedReader` w logu API OFF = **0**) |
| W1.5 | Drugi egzemplarz słownika statusów — zgodny z klientowym SSOT | **NIE** | `initiativeUnifiedReader.ts:21-30` (8 wpisów) vs `src/contracts/initiatives-execution/statusMapping.ts:40-49` (19 wpisów + przepuszczanie 12 wartości `INITIATIVE_LIFECYCLE`). Tabela rozjazdu w §1a |
| W1.6 | Logowanie braków mapowania, fail-closed | **CZĘŚCIOWO / NIE** | Logowane są tylko braki `title/projectId/ownerId` (`:68-77`, `:94-102`). **Nieznany STATUS przechodzi surowy** (`:57`, `:88`: `LEGACY_TO_RUNTIME[x] \|\| rawState`) — fail-**open**, bez żadnego logu. Dodatkowo log jest hałaśliwy: **106 linii WARN na JEDNO `GET /api/initiatives`** (pomiar) — 4 770 linii w 25 min pracy stanowiska |
| W1.7 | Test `dwaMagazynyRozjazd.pg.test.ts` — asercje na stanie bazy/odpowiedzi, nie na kodzie HTTP | **CZĘŚCIOWO** | Stan bazy: `:131-136` (`count(*)` w `ie_aggregate_state`), `:162-165` (`count(*)=0` w `initiatives`). Treść odpowiedzi: `:144-148`, `:155`, `:176`. Sam kod HTTP: `:184-187` (KPI), `:193` (kamienie) |
| W1.8 | Pułapki §0.2e (a)–(d) wyłączone **jawnie** | **CZĘŚCIOWO** | (c) jawnie w pliku: `:30` i `:79` `expect(process.env.DB_TYPE).toBe('postgres')` + `:31` `assertRealPostgresTestEnvironment()`. (a) `ENABLE_V8_GLOBAL`, (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE`, (d) `ENABLE_TEST_AUTH_BYPASS` — **nie ma ich w pliku testu**, zależą od env wywołania. Test nie broni się sam |
| W1.9 | Test uruchomiony na realnym PG | **TAK — 10/10 ON i 10/10 OFF** | `RUN_DB_TESTS=1 DB_TYPE=postgres` na `consultify_kopia_c1`. Sprzątanie po sobie kompletne: przed 8 org/121/31 → po 8 org/121/31 |
| W1.10 | Bezpieczeństwo: brak ujawnienia rekordów innej organizacji | **TAK — zmierzone** | p. W2.6: 0 wycieków na 17 obcych id; karta/KPI/kamienie dla 3 obcych id → 404 |
| W1.11 | Wydajność `GET /api/initiatives` ON vs OFF (121 rekordów, 10 pomiarów) | **TAK, bez ryzyka** | ON mediana **26 ms** (25–28) · OFF mediana **24,5 ms** (23–36). Narzut ok. +1,5 ms |
| W1.12 | DoD E2: podmiana bramek zastanych | **NIE (Codex sam melduje PARTIAL)** | `grep -rn "SELECT id FROM initiatives WHERE id" server/src \| grep -v __tests__` = **50** w **19 plikach** — bez zmiany wobec markera. Podmieniono 3 (lista, karta, KPI/kamienie) |

### 1a. Słownik statusów — klient vs serwer Codexa

| stan zastany | klient (`statusMapping.ts:40-49`) | serwer (`initiativeUnifiedReader.ts:21-30`) | zgodne | w bazie kopii |
| --- | --- | --- | --- | --- |
| DRAFT | REGISTERED_DRAFT | REGISTERED_DRAFT | TAK | 74 |
| PENDING_APPROVAL | READY_FOR_DECISION | READY_FOR_DECISION | TAK | 6 |
| APPROVED | APPROVED_BACKLOG | APPROVED_BACKLOG | TAK | 6 |
| IN_EXECUTION | IN_EXECUTION | IN_EXECUTION | TAK | 12 |
| CLOSED | CLOSED | CLOSED | TAK | 6 |
| EXECUTING | IN_EXECUTION | IN_EXECUTION | TAK | 0 (1 w kanonie) |
| **PROPOSED** | REGISTERED_DRAFT | **DEFINED** | **NIE** | **1** |
| **REJECTED** | **CLOSED** | **ARCHIVED** (u klienta `archived:true`) | **NIE** | **16** |
| PENDING_REVIEW / REVIEW / PROMOTED / PLANNING | READY_FOR_DECISION | brak → przepuszcza surowo | NIE | 0 |
| IN_PROGRESS / BLOCKED | IN_EXECUTION | brak → surowo | NIE | 0 |
| DONE / CANCELLED | CLOSED | brak → surowo | NIE | 0 (1 `CANCELLED` w kanonie org 468) |
| TRACKING | BENEFITS_TRACKING | brak → surowo | NIE | 0 |
| SCHEDULED / ARCHIVED | SCHEDULED / ARCHIVED | brak, ale przepuszczenie daje tę samą wartość | przypadkiem TAK | 1 / 1 (kanon) |

Dwa realne rozjazdy na dzisiejszych danych: **REJECTED ×16** i **PROPOSED ×1**.
Dziś nie widać ich na drucie (wiersze zastane nie przechodzą przez czytnik na liście — p. W1.2),
ale każde kolejne podłączenie czytnika je odsłoni.

### 1b. KONFLIKT DOMENOWY E1a vs CODEX — werdykt

- **E1a** (`a50bc977fc`, `initiativeRegisterProjection.ts:482-511`, linia integracyjna, **NIE ma go w worktree Codexa**):
  przy kolizji id **STATUS bierze się z tabeli klasycznej**, reszta pól z bogatszego wiersza kanonicznego.
- **Czytnik Codexa** (`initiativeUnifiedReader.ts:172-175`): przy kolizji **wygrywa kanon** — i jego test
  `dwaMagazynyRozjazd.pg.test.ts:200-203` nazywa się „przy kolizji zrodlem rozstrzygajacym jest kanon".
- **Ale na wyjściu HTTP** (`InitiativeController.ts:447-449` i `:491`) kanon jest pomijany, gdy id już jest —
  więc obie warstwy dają **TEN SAM** status.

Pomiar rozstrzygający (3 wiersze N2 z uzasadnienia E1a, DBR77):

| id | `initiatives.status` | kanon `lifecycleState` | `GET /api/initiatives` ON |
| --- | --- | --- | --- |
| `84baaa08-…` Customer Portal Redesign | PENDING_APPROVAL | APPROVED_BACKLOG | **PENDING_APPROVAL** |
| `7eb944f9-…` Cybersecurity Enhancement | PENDING_APPROVAL | APPROVED_BACKLOG | **PENDING_APPROVAL** |
| `e3b0a66a-…` IoT Sensor Network | PENDING_APPROVAL | APPROVED_BACKLOG | **PENDING_APPROVAL** |

**WERDYKT: NIE JEST TO BLOKER SCALENIA.** Zachowanie na drucie jest zgodne z E1a
(status z tabeli klasycznej), więc scalenie nie cofa naprawy N2.
**JEST TO MINA:** kontrakt czytnika i jego test mówią coś przeciwnego niż realne wyjście.
Pierwszy kolejny konsument, który zawoła `listInitiativeHeaders()`/`readInitiativeHeader()` bezpośrednio
— zgodnie z ich udokumentowanym i przetestowanym kontraktem — odtworzy defekt N2.
Do tego test `:200-203` **nie konstruuje żadnej kolizji** (ten sam test asertuje wcześniej
`count(*)=0` w `initiatives`), więc jego nazwa nie jest pokryta asercją.

---

## 2. WARSTWA 2 — RUNTIME

### 2.1 Nowa inicjatywa z UI (4227, ON) — „Nowa inicjatywa → Wypełnij formularz"

Utworzona przez UI: `initiative-23371ce8-7593-4dc9-a247-b621a990a1e1`.
Ścieżka zapisu: `201 POST /api/initiatives/runtime-v1/source-proposals` → `201 POST /api/initiatives/runtime-v1/registrations`.
Stan bazy: `initiatives` = **0** · `ie_aggregate_state` = **1** → rekord powstaje **wyłącznie w kanonie**
(potwierdzenie tezy całego bloku).

| sprawdzenie | ON 4227 | OFF 4237 |
| --- | --- | --- |
| `GET /api/initiatives` zawiera rekord | **TAK** | NIE |
| `GET /api/initiatives/:id` (karta) | **200** | 404 |
| `GET /api/initiatives/:id/kpis` | **200** | 404 |
| `GET /api/initiatives/:id/milestones` | 200 | 200 (istniejący fallback) |
| **`PUT /api/initiatives/:id` (zapis karty)** | **404** | **404** |

### 2.2 Karta NIE ZAPISUJE — pętla PUT 404 (pomiar na żywo)

Otwarcie karty z rejestru (podwójny klik) + **jeden** ciąg znaków w polu tekstowym:

| stanowisko | PUT/PATCH w 12 s po edycji |
| --- | --- |
| ON 3247/4227 | **6 × `404 PUT /api/initiatives/initiative-23371ce8-…`** |
| OFF 3257/4237 | **7 × `404 PUT /api/initiatives/initiative-23371ce8-…`** |

**Uczciwe rozliczenie: pętla NIE jest winą Codexa i nie jest przez niego naprawiona.**
Występuje identycznie przy fladze OFF, bo rejestr otwiera kartę przez most kliencki niezależnie od flagi.
Czytnik Codexa poszerza wyłącznie ODCZYT. Bramka zapisu została nietknięta:
`InitiativeController.ts:823` `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?` → `:828` `404`.
Na linii integracyjnej E1a dołożyło po stronie klienta bezpiecznik gaszący pętlę — w tym worktree go nie ma.

### 2.3 Tabela 7 powierzchni ON/OFF (żywe stanowisko, pełny reload)

| # | Powierzchnia | OFF | ON | Zmiana z flagi |
| --- | --- | --- | --- | --- |
| 1 | Rejestr Inicjatyw `/initiatives` | widzi kanon + nową (most kliencki) | to samo, tekst strony bajt w bajt identyczny | **ŻADNA** — rejestr był już naprawiony po stronie klienta |
| 2 | Karta inicjatywy (`GET /api/initiatives/:id`) | 404 | **200** | **ZYSK** |
| 3 | KPI inicjatywy (`/kpis`) | 404 | **200** | **ZYSK** |
| 4 | `GET /api/initiatives` (kontrakt listy) | 106 rekordów | **121** (+15 kanon-only) | **ZYSK + REGRESJE filtrów, p. 2.4** |
| 5 | Kokpit Realizacji `/execution` | licznik „All **8**", brak rekordów kanonicznych | licznik „All **12**", widoczne „Program poprawy OEE", „Optymalizacja zapasów komponentów" i in. | **ZYSK** |
| 6 | Moja Praca `/my-work` | brak listy inicjatyw (skrzynka pusta) | bez zmian | brak (ekran nie czyta inicjatyw) |
| 7 | Wyniki `/results/kpi`, `/results/roi` + Raporty `/management-reports` | ROI czyta własne przypadki (5), KPI/raporty nie listują inicjatyw | bez zmian | brak (ekrany nie czytają listy inicjatyw) |

Nowo utworzona inicjatywa (`REGISTERED_DRAFT`) widoczna w rejestrze i na karcie;
w Realizacji nie — bo kokpit filtruje po `IN_EXECUTION` (zachowanie poprawne).

### 2.4 REGRESJE ZMIERZONE PRZY ON — filtry i stronicowanie `GET /api/initiatives`

Blok czytnika jest doklejany **po** `ORDER BY`, `LIMIT/OFFSET` i po wszystkich klauzulach `WHERE`
bazowego zapytania, a `listInitiativeHeaders` zna tylko `projectId`/`status`/`search`.
Skutek — każdy filtr nieobsłużony przez czytnik **przestaje działać dla całej odpowiedzi**:

| zapytanie | OFF | ON | ocena |
| --- | --- | --- | --- |
| `?limit=10` | 10 | **121** | stronicowanie zniszczone |
| `?source=assessment` | 3 | **121** | filtr źródła zignorowany (moduł Assessment pokaże cały portfel) |
| `?priority=high` | 13 | **121** | filtr priorytetu zignorowany |
| `?projectId=unassigned` | 73 | **121** | „bez projektu" pokazuje wszystko |
| `?status=DRAFT` | 71 | 74 | poprawne (mapowanie DRAFT→REGISTERED_DRAFT) |
| `?search=IoT` | 6 | 6 | poprawne (asymetria: baza szuka w tytule+streszczeniu+hipotezie, czytnik tylko w tytule) |

Dodatkowo `sortowanie ORDER BY created_at DESC` nie obejmuje 15 rekordów kanonicznych — lądują na końcu listy.

### 2.5 Mieszany słownik statusów w jednym polu odpowiedzi

`GET /api/initiatives` przy ON zwraca w polu `status` **dwa różne słowniki naraz**:

- ze ścieżki zastanej: `DRAFT 71`, `IN_EXECUTION 8`, `REJECTED 15`, `CLOSED 5`, `PENDING_APPROVAL 5`, `APPROVED 2`
- z czytnika (nowe, nieobecne przy OFF): `IN_EXECUTION +4`, `READY_FOR_DECISION 3`, `REGISTERED_DRAFT 3`,
  `APPROVED_BACKLOG 1`, `SCHEDULED 1`, `DELIVERED 1`, `DEFINED 1`, `ARCHIVED 1`

10 z 15 nowych wierszy niesie wartość spoza słownika, którym posługują się zastane konsumenty tego kontraktu
(`Api.getInitiatives()` woła m.in. `ExecutionHub.tsx:1322`, `ExecutionWorkSurface.tsx:714`,
`ResultsRoiHub.tsx:396`, `IdeaMapWorkspace.tsx:2980`, `InsightViewer.tsx:3253`,
`ValueCapturePipelinePanel.tsx:106`). W Realizacji wyszło to dobrze (kolumna STATUS pokazała „In execution"),
bo `IN_EXECUTION` jest wspólne dla obu słowników — ale to zbieg okoliczności, nie kontrakt.

### 2.6 Bezpieczeństwo — izolacja organizacji (pomiar na drucie, token DBR77)

| sprawdzenie | wynik |
| --- | --- |
| obce id w bazie (org 468 + 3935) | 17 |
| wycieki na `GET /api/initiatives` przy ON | **0** |
| `GET /api/initiatives/<kanon org 468>` | **404** ×2 |
| `GET /api/initiatives/<legacy org 468>` | **404** |
| `…/kpis`, `…/milestones` dla obcych id | **404** |
| test `E2 — projekcja nie przekracza granicy organizacji` | zielony |

Ścieżka `project_id` bez organizacji: **nie występuje** — czytnik nie filtruje po `project_id` w SQL,
tylko po `organization_id`, a `projectId` jest odsiewany dopiero w pamięci (`:178`).

### 2.7 Błędy konsoli i 5xx

| stanowisko | błędy konsoli | odpowiedzi ≥400 | **5xx** |
| --- | --- | --- | --- |
| ON (6 ekranów) | 5 | 5 | **0** |
| OFF (6 ekranów) | 6 | 5 | **0** |

Wszystkie 404 są identyczne po obu stronach i nie dotyczą inicjatyw:
`GET /api/vnext/results/kpi/scorecards/<id>/review-snapshots/published` ×5 (dług zastany).
W logu API: 0 wpisów 5xx; jedyne `error` to `NOT_FOUND` z `objectAttachmentService.ts:98` (zastane).

### 2.8 Hałas w logu (nowe, wprowadzone przez ten blok)

`GET /api/initiatives` przy ON emituje **106 linii `warn [initiativeUnifiedReader] legacy record has unmapped header fields`
na JEDNO wywołanie** (mierzone: 4 664 → 4 770). Przy OFF: **0**.
To nie jest „logowanie braków mapowania" w sensie kontraktu — to log per-wiersz-per-żądanie,
proporcjonalny do ruchu × liczby rekordów.

---

## 3. WERDYKT PER POZYCJA

| Pozycja | Werdykt |
| --- | --- |
| `initiativeUnifiedReader.ts` — tenant-scoping | **SCAL** |
| `initiativeUnifiedReader.ts` — dedup / `source` | **SCAL Z FIX-EM** (FIX-1, FIX-2) |
| `initiativeUnifiedReader.ts` — słownik statusów | **SCAL Z FIX-EM** (FIX-3, FIX-4) |
| `initiativeUnifiedReader.ts` — logowanie | **SCAL Z FIX-EM** (FIX-5) |
| `InitiativeController.ts` — flaga OFF / ścieżka zastana | **SCAL** (dowiedziona identyczność z markerem) |
| `InitiativeController.ts` — blok listy za flagą | **SCAL Z FIX-EM — FIX BLOKUJĄCY WŁĄCZENIE FLAGI** (FIX-6) |
| `InitiativeController.ts` — karta / bramka KPI | **SCAL** |
| `initiativeKpiAssignmentService.ts` | **SCAL** |
| `dwaMagazynyRozjazd.pg.test.ts` | **SCAL Z FIX-EM** (FIX-7, FIX-8) |
| Wydajność | **SCAL** (+1,5 ms mediany) |
| Bezpieczeństwo | **SCAL** (0 wycieków zmierzone) |

**WERDYKT ZBIORCZY: SCAL Z FIX-AMI, FLAGA ZOSTAJE OFF.**
Kod za flagą OFF jest dowiedzenie obojętny dla dzisiejszego zachowania, więc scalenie samo w sobie
nie niesie ryzyka i domyka trzy powierzchnie (karta, KPI, Realizacja) w chwili włączenia.
Włączenie flagi **przed FIX-6 byłoby regresją produktową**, nie postępem.

### FIX-y dla robotnika Sonnet (plik:linia)

| FIX | Waga | Plik:linia | Co zrobić |
| --- | --- | --- | --- |
| **FIX-6** | **BLOKUJE ON** | `server/src/controllers/InitiativeController.ts:446-467` | Blok czytnika doklejany po `ORDER BY`/`LIMIT`/`WHERE` unieważnia filtry. Minimum: **nie doklejać nagłówków, gdy zapytanie niesie filtr nieobsługiwany przez czytnik** (`limit`, `offset`, `source`, `sourceAssessmentId`, `priority`, `projectId=unassigned`) — wtedy odpowiedź zostaje dzisiejsza. Docelowo: przenieść scalanie przed sortowanie i stronicowanie |
| FIX-1 | wysoka | `server/src/domain/initiatives-execution/initiativeUnifiedReader.ts:167-175` | Uzgodnić priorytet kolizji z E1a: przy kolizji id **status z magazynu klasycznego**, reszta pól z kanonu. Inaczej pierwszy nowy konsument czytnika odtworzy defekt N2 |
| FIX-2 | wysoka | `server/src/controllers/InitiativeController.ts:456` | `sourceType: header.source` wpisuje `CANONICAL` do pola plakietki źródła. Przenieść do osobnego pola (np. `readSource`), zostawić `sourceType` niezmienione |
| FIX-3 | wysoka | `initiativeUnifiedReader.ts:21-30` | Uzupełnić słownik do parytetu z `src/contracts/initiatives-execution/statusMapping.ts:40-49`. Dwa realne rozjazdy: `REJECTED` (klient CLOSED, serwer ARCHIVED) i `PROPOSED` (klient REGISTERED_DRAFT, serwer DEFINED) |
| FIX-4 | średnia | `initiativeUnifiedReader.ts:57,88` | `LEGACY_TO_RUNTIME[x] \|\| rawState` = fail-open. Nieznany stan ma trafić do jednej jawnej wartości i **zostać zalogowany raz na żądanie**, nie przechodzić surowo do UI |
| FIX-5 | średnia | `initiativeUnifiedReader.ts:68-77, 94-102` | 106 linii WARN na jedno żądanie. Zagregować do jednej linii na żądanie (licznik + kilka przykładowych id) |
| FIX-7 | średnia | `dwaMagazynyRozjazd.pg.test.ts:200-203` | Test „przy kolizji zrodlem rozstrzygajacym jest kanon" **nie tworzy kolizji**. Dopisać wiersz do `initiatives` o tym samym id i o INNYM statusie, potem asertować rozstrzygnięcie zgodne z FIX-1 |
| FIX-8 | niska | `dwaMagazynyRozjazd.pg.test.ts:29-62` | Pułapki (a), (b), (d) ustawić **jawnie w pliku** (`ENABLE_V8_GLOBAL`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `ENABLE_TEST_AUTH_BYPASS=false`), tak jak zrobiono to dla (c) w `:30` |
| FIX-9 | poza blokiem | `InitiativeController.ts:823` | Zapis karty rekordu kanonicznego (`PUT`) dalej 404. To osobna robota (ścieżka zapisu, nie odczytu) — do bloku „jeden magazyn, część zapisowa" |

---

## 4. REKOMENDACJA — czy włączać flagę ON na stagingu po scaleniu

**NIE — nie przed FIX-6.** Uzasadnienie mierzone, nie szacowane:

**Za włączeniem (zysk):** 15 rekordów DBR77 istniejących wyłącznie w kanonie przestaje być niewidocznych;
karta i KPI przestają zwracać 404; Realizacja pokazuje 12 zamiast 8 inicjatyw. Koszt wydajnościowy +1,5 ms.
Zero wycieków między organizacjami. Zero 5xx.

**Ryzyko dziś (bez FIX-6) — cztery zmierzone regresje na wszystkich konsumentach `GET /api/initiatives`:**
stronicowanie (`limit=10` → 121), filtr źródła (`source=assessment` → cały portfel zamiast 3),
filtr priorytetu (→ cały portfel zamiast 13), filtr „bez projektu" (→ 121 zamiast 73).
Do tego 10 wierszy z wartością `status` spoza słownika zastanych konsumentów
i 106 linii WARN na każde żądanie listy.

**Kolejność:** (1) scalić z flagą OFF; (2) FIX-6 + FIX-1 + FIX-2 + FIX-3; (3) dopiero wtedy ON na stagingu,
na jednym ekranie naraz, z ponownym pomiarem tabeli §2.4;
(4) FIX-9 (zapis karty) zanim ktokolwiek zobaczy kartę rekordu kanonicznego jako „gotową" —
inaczej właściciel dostaje kartę, która wygląda na edytowalną i przy każdym znaku robi 404.

---

## 5. STOP-y i rozliczenie meldunku Codexa

| Twierdzenie Codexa | Weryfikacja C1 |
| --- | --- |
| „tenant-scoped odczyt obu magazynów" | **POTWIERDZONE** (kod + druk, 0 wycieków na 17 obcych id) |
| „deduplikacja z priorytetem kanonu" | **POTWIERDZONE w czytniku, OBALONE na wyjściu HTTP** — na drucie wygrywa magazyn klasyczny |
| „flaga default OFF" | **POTWIERDZONE**, ścieżka OFF dowiedzenie identyczna z markerem (różnica 4 znaków nawiasów) |
| „ON: 10/10; OFF: 10/10" | **POTWIERDZONE** na moim PG, oba przebiegi |
| „E2 jest PARTIAL, K1 = 50" | **POTWIERDZONE** — 50 bramek w 19 plikach, bez zmian |
| „powstał drugi egzemplarz słownika statusów" (§12) | **POTWIERDZONE i poważniejsze niż zgłoszone** — słownik jest nie tylko zduplikowany, ale **niezgodny** w 2 stanach obecnych w danych |
| „logowanie braków mapowania" | **CZĘŚCIOWO** — dotyczy pól nagłówka, nie statusu; i generuje 106 linii na żądanie |
| STOP E3 (brak lokalnej kopii stagingu) | **ZASADNY co do faktu, ale przesłanka nieaktualna** — kopia stagingu z 10.09 była dostępna lokalnie (`consultify_staging_1009`, 8 org / 121 / 31); instrukcja nie podała jej ścieżki. To brak instrukcji, nie wykonawcy |
| STOP E4 (6 ścieżek zastanych bez następcy) | **nie weryfikowany w tym odbiorze** (poza zakresem W1/W2) |
| „Nie zmierzono Execution, My Work, Reports" (§10) | **ZMIERZONE w tym odbiorze** — tabela §2.3 |

**STOP-y odbioru: BRAK.** Wszystkie zaplanowane pomiary wykonane na realnym PostgreSQL.

### Sprzątanie

Kopia `consultify_kopia_c1` (wraz z kontem `audyt@dbr77.local` i rekordem testowym
`initiative-23371ce8-…`) usunięta po zakończeniu pracy. Bazy `consultify_staging_1009`
nie dotykano. Procesy 4227/4237/3247/3257 zatrzymane.
