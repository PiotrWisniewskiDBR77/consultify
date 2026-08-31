# CODEX DAY214 — ADOPT CHAT DRAFT

Data: 2026-08-31  
Gałąź: `codex/day214-adopt-draft-20260831`  
Marker: `fe33ce8036`  
Werdykt: **PARTIAL — rdzeń, realny HTTP i karta działają; wymagana mutacja locka i zrzut odbiorowy nie zostały dowiedzione.**

## Stan wejściowy

Wynik markera (§0.1 pkt 2), dosłownie:

```text
MARKER OK
```

Wynik sanity (§0.1 pkt 7), dosłownie:

```text
fe33ce80360ac0b6751a5f605d6c758853a4dfa3
```

`df -h /` przed startem pokazał 13 GiB wolnego (>5 GiB). `lsof` nie wykazał
listenerów na 6154, 5098 ani 5099. Zakres `server/migrations/20261900-20261909`
był pusty. Tip `github-backup/codex/m03-admin-20260824` był do przodu; zgodnie z
DEC-2026-08-26-95 praca została rozpoczęta dokładnie z markera, bez rebase.

## Korekty wobec instrukcji

- W1 nie potwierdził opisu „zero zakresu” gałęzi 208 względem lokalnej referencji:
  `git log codex/m03-admin-20260824..codex/day208-inicjatywa-handoff-20260831`
  zwrócił szeroki zakres historyczny. Nie wykorzystano żadnego kodu z day208.
- Szeroki pakiet serwerowy na właściwym configu był czerwony już przed zmianą:
  199 testów: 93 pass, 46 fail, 60 pending. Po zmianie: 207 testów: 114 pass,
  30 fail, 63 pending. Nie nazywam żadnego z tych przebiegów PASS.
- Równoległe dwa wywołania tego samego `clientRequestId` ujawniły wspólną lukę:
  drugie żądanie po locku agregatu dostaje `aggregate version conflict`, ponieważ
  `executeMaterialCommand` nie ponawia `findReceipt`. Naprawa wymaga zmiany
  `materialCommand.ts` lub istniejącej metody `findReceipt`, obu poza licencją.

## Wykonanie

- `initiative.adopt-chat-draft` jest siostrą, nie modyfikacją mostu SWOT.
- `aggregateId = chatInitiativeId`: oba magazyny opisują tę samą inicjatywę;
  migracja wymusza tę tożsamość CHECK-em.
- Transakcja wymaga `source_type='teresa_chat'`, projektu, tytułu, problemu i
  właściciela oraz stosuje advisory lock `${organizationId}:chat-draft:${id}`.
- `flow_teresa_chat_draft_adoptions` ma walidujący trigger i blokadę UPDATE/DELETE.
- `POST /api/initiatives/runtime-v1/adoptions/chat-draft` ma kolejno
  `initiative.create`, eligibility ownera i policy resolver; przy fladze OFF
  zwraca `404 FEATURE_DISABLED`.
- Karta w wiadomości czatu ma stany `idle/checking/blocked/ready/adopting/adopted/failed`.
  `ready` wymaga drugiego, jawnego kliknięcia. `blocked` nie woła POST i prowadzi
  do istniejącego dokumentu inicjatywy.
- Nie zmieniono żadnej komendy późniejszego governance.

Świadoma decyzja licencyjna: `MessageRenderer.tsx` rozszerzono wyłącznie o
analogiczne pole wiadomości `initiativeHandoff`; stan jest również odtwarzany z
`msg.metadata.initiativeHandoff`, więc karta przeżywa ponowne wczytanie rozmowy.

## Dowody

Migracje na `pgvector/pgvector:pg16`, `127.0.0.1:6154/cx214`:

```text
Applying migrations: 1
→ 20261900_flow_teresa_chat_draft_adoption.sql
✅ Postgres migrations complete
Applying migrations: 0
✅ Postgres migrations complete
```

Focused, `--retry=0`:

- serwer: 8/8 (komenda realdb + produkcyjny `ApiGateway`, podpisany JWT,
  route OFF, direct POST blocked, 201, SQL readback, canonical readback,
  definition readiness ośmiu kart);
- front DOM: 3/3 (idle bez mutacji, blocked bez POST, ready + osobny klik).
- `npx tsc -p server/tsconfig.json --noEmit`: exit 0.
- root `npx tsc --noEmit`: OOM przy ~4 GiB; brak wyniku, nie PASS.

Pomiar nazw: 11 nowych pełnych nazw, 0 znikniętych. Front szeroki: przed
337/337, po 340/340. Artefakty:

- `/private/tmp/cx-day214-adopt-draft-artefakty/przed-nazwy.txt` — `9c39c771f3d81e9690364560a7717cf44eebbc6cd7b46a3ef5fc986e2aa0b1b4`
- `/private/tmp/cx-day214-adopt-draft-artefakty/po-nazwy.txt` — `439a4f2694d378c4049ab19b2bc066a7c438141c3df6a6c264fc0a995df11cb7`
- `/private/tmp/cx-day214-adopt-draft-artefakty/nazwy.diff` — `9ea52ae79f7e5fbe5cb118770ad82d178bb62f3f72d3a683f693805a9bc76146`
- `day214-server-focused.json` — `1bffaff36aa38974c5161fd4664b878c8752c57d4a2b3c1f8dc08476058a7628`
- `day214-front-focused.json` — `b7eb1baeaaff646428b48e3b27bd5aca3e9168c1f12454a8204b84e6cd49a42e`

Pułapki Z33: test Gateway ustawia jawnie `ENABLE_V8_GLOBAL=true`,
`ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`,
`MOCK_DB=false`, `DB_TYPE=postgres`; każdy nowy pakiet realdb asertuje realny PG.

## Dowód mutacyjny i otwarte bramy

Próba równoległego identycznego replay była **CZERWONA**:

```text
Error: aggregate version conflict
materialCommand.ts:509
```

Po przejściu na sekwencyjny retry: `APPLIED` + `REPLAYED`, dokładnie jeden agregat
i jeden paragon. To nie dowodzi wymaganego concurrency replay. Usunięcie samego
locka adopcji nie daje niezależnej czerwieni, ponieważ wspólny lock agregatu nadal
serializuje zapis; nie zmieniałem wspólnego silnika poza licencją. Dowód mutacyjny
`Z32` w obie strony dla locka: **NIEZROBIONY**.

Zrzut karty: **NIEZROBIONY**. Test DOM montuje realny komponent z realnym kształtem
odpowiedzi, ale nie jest zrzutem akceptacyjnym. Flaga pozostaje default OFF.

## TWIERDZENIA NIEZWERYFIKOWANE

- Endpoint używany przez `InitiativeDocumentView` zwraca `SELECT i.*`; bezpośrednio
  zweryfikowano obecność `project_id`, `owner_business_id`, `owner_execution_id` i
  `problem_statement` w payloadzie usługi odczytowej.
- Nie znaleziono założenia wymagającego rozłącznych ID obu magazynów; dodatkowo
  istniejący most accepted-classic już wymusza równość classic/runtime. Pełny grep
  wszystkich konsumentów nie jest dowodem braku przyszłego założenia.
- Mechanizm pola wiadomości prześledzono do `addMessageToConversation` → metadata →
  mapowania `activeMessages` → `MessageRenderer`; nie jest to wyłącznie wzorzec z grepu.
- Dowód renderu pochodzi wyłącznie z testu DOM, nie z realnego przebiegu przeglądarki.
- Test bramy omijającej woła realny POST bez karty i dowodzi 0/0 SQL, ale nie wykonano
  wymaganej mutacji samego warunku `project_id IS NOT NULL`.
- `initiativeGenerationService.createInitiative → funnelCreateInitiative` zweryfikowano
  bezpośrednio w kodzie (`initiativeGenerationService.ts`, import i wywołanie).

## Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## Commity i backup

- `2feb3a08aa` — rdzeń produktu i testy; wypchnięty natychmiast po commicie na
  `github-backup/codex/day214-adopt-draft-20260831`.
