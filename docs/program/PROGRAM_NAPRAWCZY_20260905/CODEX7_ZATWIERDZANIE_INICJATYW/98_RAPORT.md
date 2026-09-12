# CODEX 7 — raport wykonania / STOP

## 1. Stanowisko

- worktree: `/Users/piotrwisniewski/Developer/codex-wt/codex7-zatwierdzanie`
- gałąź: `codex/zatwierdzanie-inicjatyw-20260913`
- marker/HEAD wejściowy: `45c07b024cf9731793cd306e415143cc97d6e1e1`
- baza instrukcji: `origin/integracja/20260911`
- `df -h /`: 58 GiB wolnego (warunek Z23 spełniony)
- marker: `git merge-base --is-ancestor 45c07b024c origin/integracja/20260911` = TAK
- zarezerwowane, ale nieuruchomione wskutek STOP: `cx-codex7-pg`/6458, API 4217,
  preview 5217, harness 5598, bazy `cx7_*`
- artefakty/logi: `/Users/piotrwisniewski/Developer/codex-wt/codex7-artefakty`

Nie wykonano żadnego połączenia do Railway, stagingu, demo ani produkcji. Nie wykonano pushu.

## 2. Stanowisko i wynik

**STOP zgodnie z §2.6 instrukcji.** W repo istnieje komponent pozwalający wystawić decyzję
Definition, ale nie jest zamontowany w aktywnym interfejsie. Co więcej, obowiązujący test właścicielski
jawnie klasyfikuje go jako wycofaną kolejkę i zabrania importu/montażu. Podpięcie go wymaga decyzji
produktowej o miejscu w istniejącym `DecisionsPanelContent`; instrukcja zabrania projektowania nowego
ekranu/panelu oraz nakazuje STOP, gdy takiego miejsca brakuje.

Nie zbudowano alternatywnego magazynu decyzji. Byłby to najgorszy wynik wskazany w §1 instrukcji.

## 3. KROK 0 — pomiar czterech przesłanek

### 3.1 Trasa `gates/definition/decisions` — POTWIERDZONE, ale to inny właściciel zapisu

- kontrakt wejścia (`expectedVersion`, `clientRequestId`, `decisionId`, `APPROVED|RETURNED`,
  `rationale`, opcjonalny quorum receipt):
  `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:387-394`;
- trasa POST: ten sam plik, `:2849-2899`;
- zapis idzie przez material command `initiative.definition.decide` do `ie_aggregate_state`, a nie do
  `initiative_lifecycle_gate_decisions` czytanego przez zmianę statusu inicjatywy;
- aktywny przycisk zatwierdzenia inicjatywy nie jest więc odblokowywany samym istnieniem tej trasy.

Wniosek: mechanika jest kompletniejsza niż sugeruje krótki opis, lecz istnieją dwa zastane konteksty
decyzji. Nie wolno dołożyć trzeciego ani uznać ich za równoważne bez jawnego mostu właściciela prawdy.

### 3.2 Bramka `initiative.review` i defekt D-1 — POTWIERDZONE

`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2862-2871` łączy dwa przypadki:

1. rekord nie istnieje / jest z obcej organizacji;
2. rekord istnieje i jest widoczny, ale `initiative.review` odmawia.

Oba kończą się `404 { error: { code: "NOT_FOUND" } }`. To potwierdza D-1: dla widocznego rekordu
brakuje 403, kodu przyczyny i lejka językowego. Nie naprawiono tego częściowo, ponieważ bez pełnego
przewodu decyzji powstałby nieweryfikowalny fragment wariantu V2, a §2.8 wymaga mutacyjnego dowodu
każdej bramki przez realny ApiGateway.

### 3.3 Lejek `initiativeReadinessCheckLabel` — POTWIERDZONE z korektą licznika

- funkcja lejka: `src/components/Initiatives/lifecycle/initiativeLifecycleMessages.ts:348-370`;
- rejestr etykiet ma 14 kluczy stałych i rodzinę dynamiczną `gate_role_*`:
  `initiativeLifecycleMessages.ts:202-246,339-369`;
- osobne rejestry podpowiedzi i wykonawców znajdują się odpowiednio w `:249-306` i `:313-337`;
- oba języki mają trzy odpowiadające sekcje tłumaczeń:
  `public/locales/en/translation.json:14505-14558` i
  `public/locales/pl/translation.json:13665-13718`.

Instrukcyjne „40 kluczy” opisuje łączną rodzinę komunikatów, nie 40 pozycji samej mapy
`INITIATIVE_READINESS_CHECK_KEYS`. Sama mapa etykiet ma 14 stałych wpisów plus rodzinę dynamiczną.

### 3.4 Bramka aktualnej decyzji GO — POTWIERDZONE; istnieje kanoniczny magazyn

- tabela `initiative_lifecycle_gate_decisions` jest osobnym rekordem, wersjonowanym per
  organizacja/inicjatywa/domena, z unikalną idempotencją i łańcuchem `supersedes_decision_id`:
  `server/migrations/20260810_t01_initiative_lifecycle_gate_decisions.sql:9-45`;
- trigger zabrania UPDATE/DELETE: ten sam plik `:51-66`;
- writer serializuje zapis advisory lockiem, odtwarza identyczne żądanie i odmawia konfliktu payloadu:
  `server/src/services/initiative/initiativeLifecycleGateDecisionService.ts:272-355`;
- rekord niesie autora, czas, uzasadnienie, wersję i odwołania źródłowe:
  `initiativeLifecycleGateDecisionService.ts:28-71`;
- zatwierdzenie czyta wyłącznie najwyższą wersję tego magazynu:
  `server/src/services/initiative/initiativeTransitionService.ts:117-142`;
- brak aktualnego GO blokuje przejście kodem `GATE_DECISION_REQUIRED`:
  `initiativeTransitionService.ts:834-860`.

To obala potrzebę nowej tabeli decyzji. Istniejący właściciel ma już wersjonowanie, audyt,
idempotencję i tenant scope. Brakuje bezpiecznego, aktywnego przewodu UI oraz jednoznacznej definicji
wersji treści inicjatywy, z którą `source_digest` ma być porównywany przy odczycie bramki.

## 4. Dlaczego implementacja bez decyzji właściciela narusza instrukcję

1. Osierocony komponent `DefinitionDecisionQueue` ma uzasadnienie oraz akcje Return/Approve
   (`src/components/MyWork/DefinitionDecisionQueue.tsx:38-104,186-215`), ale nie jest montowany.
2. Test produktu wymaga `DecisionsPanelContent` i jawnie zabrania importu/montażu
   `DefinitionDecisionQueue` (`src/components/MyWork/__tests__/MyWorkHub.decisionsOwnerFeedback.test.ts:7-28`).
3. Kanoniczny writer decyzji lifecycle wymaga dziś Transformation Case, wersji case, baseline refs,
   A05 proposal version i scope-review receipt
   (`initiativeLifecycleGateDecisionService.ts:74-92,383-430`). Aktywny panel decyzji nie wystawia
   tego kontraktu.
4. Uproszczenie istniejącej tabeli wymagałoby usunięcia `NOT NULL`/FK albo fabrykowania rekordów A05.
   Pierwsze narusza Z14 (`ALTER ... DROP`), drugie fałszuje ślad audytu.
5. Nowa tabela byłaby drugim magazynem obok kanonicznego i wprost narusza §1.

## 5. Model danych — stan zastany, bez nowej migracji

Nie dodano migracji z zakresu 20262190–20262199. Wiążący kandydat do dalszego użycia to istniejąca
`initiative_lifecycle_gate_decisions`; nie należy tworzyć nowej tabeli. Przed wznowieniem potrzebna jest
decyzja, czy aktywny `DecisionsPanelContent` ma wystawiać pełny kontrakt tej tabeli, czy istniejący
kontrakt zostanie addytywnie rozszerzony o jawny snapshot istotnych pól bez osłabiania istniejących
więzów A05/Case.

## 6. „Istotna zmiana” — NIEUSTALONE / propozycja do decyzji

Nie zakodowano listy. Pomiar writerów pokazuje co najmniej dwa różne modele treści (legacy
`initiatives` i kanoniczne karty `ie_*`), więc wybranie jednego bez decyzji grozi unieważnianiem decyzji
na ekranie innym niż ten, który zatwierdzono. Minimalna propozycja do zatwierdzenia przez właściciela:
`title/name`, `summary`, `description/hypothesis`, `problem_statement`, `scope_in`, `scope_out`,
`deliverables`, `success_criteria`, `owner_business_id`, `owner_execution_id`, `sponsor_id`,
`planned_start_date`, `planned_end_date`, `estimated_budget` oraz odpowiadające im opublikowane wersje
kart kanonicznych. Snapshot musi mieć jeden deterministyczny digest i być liczony tym samym kodem przy
wystawieniu oraz przy zatwierdzeniu.

## 7. Punkty §2 — stan dowodów

1. Wystawienie decyzji: **PARTIAL / zastane** — writer wersjonowany i idempotentny istnieje, brak
   aktywnego przewodu UI do jego kontraktu.
2. Zatwierdzenie: **PARTIAL / zastane** — bramka czyta kanoniczną najwyższą wersję, lecz nie udowodniono
   nowego end-to-end wystawienia przez aktywny ekran.
3. Unieważnienie po zmianie: **NOT_PROVEN** — `source_digest` istnieje, ale bieżący checker nie porównuje
   go z jednym ustalonym digestem treści inicjatywy.
4. Cztery ludzkie odmowy en+pl: **NOT_IMPLEMENTED** — D-1 potwierdzony; częściowej zmiany bez pełnego
   realdb/API/mutacyjnego dowodu nie wykonano.
5. Ślad audytu: **PARTIAL / zastane** — tabela przechowuje wymagane pola i jest append-only; brak nowego
   readbacku na bazie `cx7_*` wskutek STOP.
6. Przewód UI: **STOP** — brak dozwolonego miejsca; osierocony komponent jest jawnie wycofany.
7. Parytet OFF: **NIE DOTYCZY** — flaga nie została dodana, zachowanie markera pozostało bit w bit.
8. Realdb/ApiGateway/mutacje/obca organizacja: **NIE URUCHOMIONO** po wiążącym STOP.

## 8. Testy RED→GREEN, SHA i commity

- RED→GREEN: nie rozpoczęto; nie istnieje uczciwy zakres GREEN bez decyzji o przewodzie i SSOT.
- testy per plik: nie uruchomiono po STOP.
- `tsc` serwera: nie uruchomiono, ponieważ nie zmieniono kodu serwera.
- esbuild frontu: nie uruchomiono, ponieważ nie zmieniono kodu frontu.
- SHA etapu: brak commita implementacyjnego; raport STOP zostanie zapisany osobnym commitem z wymaganymi
  znacznikami.

## 9. Pytanie blokujące do właściciela

W którym **istniejącym** miejscu aktywnego `DecisionsPanelContent` ma zostać udostępnione wystawienie
decyzji GO i który kontrakt jest wiążącym SSOT dla tej akcji:

- pełny `initiative_lifecycle_gate_decisions` (Case + A05 + snapshot), czy
- addytywne rozszerzenie tego samego magazynu o prostszy, ale nadal prawdziwy human-committee receipt?

Bez tej decyzji nie wolno montować wycofanej kolejki, osłabiać więzów A05 ani tworzyć drugiej tabeli.

## 10. Czego nie sprawdzono

- nie uruchomiono lokalnej kopii PostgreSQL ani migracji;
- nie uruchomiono realnego ApiGateway/JWT/PG readback;
- nie sprawdzono zachowania po pełnym przeładowaniu;
- nie wykonano dowodów mutacyjnych bramek;
- nie wykonano kontroli obcej organizacji na `cx7_*`;
- nie wykonano wizualnego odbioru, ponieważ brak dozwolonego przewodu UI;
- nie potwierdzono, czy aktywny `DecisionsPanelContent` ma już ukryty adapter zdolny dostarczyć pełny
  kontrakt lifecycle gate — grep potwierdził jedynie brak montażu `DefinitionDecisionQueue`.
