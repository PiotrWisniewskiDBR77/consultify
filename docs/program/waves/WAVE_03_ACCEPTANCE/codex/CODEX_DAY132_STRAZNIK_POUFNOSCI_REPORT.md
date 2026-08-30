# CODEX DAY 132 — jeden strażnik poufności

Data pomiaru: 2026-08-30  
Marker: `c05c4c3910`  
Gałąź: `codex/day132-straznik-poufnosci-20260830`  
Werdykt wykonawcy: `IMPLEMENTED / TESTED BEHAVIORALLY / RUNTIME HTTP NOT PROVEN`

## 1. Stan wejściowy

### §0.1-BIS — sanity

```text
c05c4c3910 docs(funkcje): tor A do rejestru + korekta liczby wykonawcy (24 'dziala' nie spelnia definicji W3)

codex/day132-straznik-poufnosci-20260830
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 06:25 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
Filesystem        Size    Used   Avail Capacity iused ifree %iused Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    35Gi    26%    459k  367M    0% /
```

`git status --short` nie wypisał nic. Porty `6015`, `4930`, `4931` i nazwa
`cx-day132-pg` były wolne. Kroki §0.1 `(1)`, `(3)`, `(4)`, `(5)`, `(6)` zostały
pominięte zgodnie z §0.1-BIS; nie wykonywałem fetch ani operacji na vaulcie.

### T1 — trafienia strażnika na markerze

```text
server/src/services/aiContextBuilder.ts:974:      const filterDocumentsByVisibility =
server/src/services/aiContextBuilder.ts:975:        dgMod.filterDocumentsByVisibility || dgMod.default?.filterDocumentsByVisibility;
server/src/services/aiContextBuilder.ts:976:      if (typeof filterDocumentsByVisibility === 'function' && Array.isArray(documents)) {
server/src/services/aiContextBuilder.ts:978:        const access = await filterDocumentsByVisibility(
server/src/services/ai/documentGovernance.ts:18:export async function filterDocumentsByVisibility(
server/src/services/ai/documentGovernance.ts:109:    logger.warn('[DocGov] filterDocumentsByVisibility failed — fail-closed');
server/src/services/ai/documentGovernance.ts:232:  filterDocumentsByVisibility,
server/src/services/organizationContext/ContextRetrievalService.ts:22:import { filterDocumentsByVisibility } from '../ai/documentGovernance.js';
server/src/services/organizationContext/ContextRetrievalService.ts:333:      const access = await filterDocumentsByVisibility(ids, projectId || undefined);
```

Wynik semantyczny: dokładnie dwa wywołania (`aiContextBuilder.ts:978`,
`ContextRetrievalService.ts:333`). Pozostałe siedem wierszy to aliasy, definicja,
log, eksport i import.

### T2

```text
        };
      }
    } catch {
      // fail-open
    }

    return {
```

### T3

```text
async function fetchAccessibleDocuments(
  ids: string[],
  organizationId: string,
  userId: string,
  agentProjectId?: string | null
): Promise<{ accessible: KnowledgeDocRow[]; missingIds: string[] }> {
  if (ids.length === 0) return { accessible: [], missingIds: [] };
  const placeholders = ids.map(() => '?').join(',');
  const agentScopeSql = agentProjectId
    ? `AND ((scope = 'user' AND owner_id = ?) OR
            (scope = 'project' AND project_id = ? AND EXISTS (
              SELECT 1 FROM project_members pm WHERE pm.project_id = knowledge_docs.project_id AND pm.user_id = ?
            )))`
    : `AND (scope = 'project' OR (scope = 'user' AND owner_id = ?))`;
  const scopeParams = agentProjectId ? [userId, agentProjectId, userId] : [userId];
  const rows = (await dbAll(
    `SELECT id, filename, status, scope, project_id, owner_id, version, created_at
     FROM knowledge_docs
     WHERE id IN (${placeholders})
       AND organization_id = ?
       AND deleted_at IS NULL
       ${agentScopeSql}`,
```

Brak `ai_visibility` i `sensitivity` w tej funkcji na markerze.

### T4

```text
        // Fallback: if RAG returned no chunks (e.g. embedding failure, query mismatch),
        // load raw chunks directly from DB to ensure the AI always sees attachment content.
        if (!attachmentChunksInjected) {
          try {
            const organizationIdForAttachmentFallback = req.organizationId || '';
            if (!organizationIdForAttachmentFallback) {
              throw new Error('organization_id_required_for_attachment_fallback');
            }
            const placeholders = attachmentDocIds.map(() => '?').join(',');
            const rows = await dbAll(
              `SELECT c.content, d.filename
               FROM knowledge_chunks c
               JOIN knowledge_docs d ON c.doc_id = d.id
               WHERE d.id IN (${placeholders})
                 AND d.organization_id = ?
                 AND (d.status IS NULL OR d.status IN ('ready', 'indexed'))
```

### T5

```text
      // F3: merge the conversation's PROJECT knowledge files into the RAG scope so
      // Teresa can retrieve from project-shared documents. Guarded — table may not
      // exist yet. Only widens retrieval; never throws.
      try {
        if (conversationId) {
          const { all: dbAll } = await import('../utils/DbPromise.js');
          const kRows = (await dbAll(
            `SELECT k.doc_id FROM conversations c
             JOIN project_knowledge k ON k.project_id = c.chat_project_id
             WHERE c.id = ? AND k.kind = 'file' AND k.doc_id IS NOT NULL`,
            [conversationId]
          )) as Array<{ doc_id?: string }>;
```

### T6

```text
4077:        process.env.ENABLE_ORG_KNOWLEDGE_RETRIEVAL === 'true';
```

Tezy T1–T6 potwierdziły się.

## 2. Korekty wobec instrukcji

1. §0.1/Z34a mówi o pushu po każdym commicie, lecz §9 kończy instrukcję słowami
   **„Nie pushujesz”**, a zlecenie użytkownika powtarza **„NIE PUSHUJESZ”**.
   Wybrałem bezpieczniejszą i późniejszą regułę: nie wykonałem żadnego pushu.
2. Z24 i inne miejsca odwołują się do `§0.4a`, ale w instrukcji (949 linii) nie
   istnieje taki paragraf (`rg -n "0\\.4a"` znajduje tylko odwołania). Zamiast
   zgadywać mianownik uruchomiłem pełne trzy katalogi testowe wskazane w §0.2c(C).
3. §0.2c twierdzi, że `DB_TYPE=postgres` w tej samej linii nadpisze config.
   Pomiar z `server/vitest.config.ts` dał `expected 'sqlite' to be 'postgres'`.
   Chronionego configu nie zmieniłem. Real-DB R1 uruchomiłem z configiem poza repo,
   dziedziczącym resolver serwera i nieprzypinającym `DB_TYPE`; pierwszy test
   potwierdził efektywne `postgres`.
4. Prettier przepisałby 230 linii `ai.routes.ts`; reformat został cofnięty przez
   `cp` zgodnie z §0.2d(16). Został wyłącznie wąski diff merytoryczny.

## 3. Pozycje R1–R4

### R1

`fetchAccessibleDocuments` grupuje kandydatów według projektu, woła istniejący
`filterDocumentsByVisibility` z `conversationId` i zwraca tylko `allowed`.
Poufne/blokowane dokumenty dostają powód
`document_confidentiality_governance_blocked`; wymagające zatwierdzenia mają
odrębny `document_governance_requires_approval`.

Commit: `46f9aacf34 fix(ai): guard selected attachment retrieval`.

### R2

Wybrałem dozwolone rozwiązanie „lista `attachmentDocIds` przefiltrowana przed
zapytaniem”. `selectedDocumentIds` z E1 staje się `governedAttachmentDocIds`.
Legacy RAG i surowy fallback DB używają wyłącznie tej listy. Awaria E1 pozostawia
listę pustą, więc fallback jest fail-closed. Nie powielono polityki w SQL.

### R3

Blok metadata-only powstaje tylko dla `governedAttachmentDocIds`; nazwy z
`context.attachments` są filtrowane po dozwolonych `docId`. Gdy lista jest pusta,
nie powstaje blok ani zdarzenie z nazwą poufnego pliku.

R2/R3 commit: `2ed8e111eb fix(ai): reuse governed attachment scope in chat`.

### R4

Catch w `AIContextBuilder` ustawia `documents=[]` i loguje awarię strażnika.

Commit: `072f129c66 fix(ai): fail closed on document governance errors`.

## 4. Cztery pary W-A

Wszystkie komendy używały `--retry=0`. JSON-y są poza repo.

### R1 — przed (marker)

```json
{"success":false,"numTotalTests":2,"numPassedTests":1,"numFailedTests":1,
 "fullName":"Day 132 R1 — attachment confidentiality governance (real PostgreSQL) excludes an explicitly confidential selected document with a distinguishable reason",
 "status":"failed",
 "failureMessage":"AssertionError: expected [ { …(11) } ] to deeply equal []"}
```

### R1 — po

```json
{"success":true,"numTotalTests":2,"numPassedTests":2,"numFailedTests":0,
 "fullName":"Day 132 R1 — attachment confidentiality governance (real PostgreSQL) excludes an explicitly confidential selected document with a distinguishable reason",
 "status":"passed"}
```

### R2 — przed (marker)

```json
{"success":false,
 "fullName":"Day 132 R2/R3 — AI chat attachment confidentiality R2 keeps confidential raw fallback content out when E1 fails",
 "status":"failed",
 "failureMessage":"AssertionError: expected '## ASSISTANT SURFACE: workspace_copil…' not to contain 'DAY132 ROUTE CONFIDENTIAL CONTENT'"}
```

### R2 — po

```json
{"success":true,
 "fullName":"Day 132 R2/R3 — AI chat attachment confidentiality R2 keeps confidential raw fallback content out when E1 fails",
 "status":"passed"}
```

### R3 — przed (marker)

```json
{"success":false,
 "fullName":"Day 132 R2/R3 — AI chat attachment confidentiality R3 omits confidential metadata names when governance allows no attachment",
 "status":"failed",
 "failureMessage":"AssertionError: expected '## ASSISTANT SURFACE: workspace_copil…' not to contain 'day132-secret-acquisition-target.txt'"}
```

### R3 — po

```json
{"success":true,
 "fullName":"Day 132 R2/R3 — AI chat attachment confidentiality R3 omits confidential metadata names when governance allows no attachment",
 "status":"passed"}
```

### R4 — przed (marker)

```json
{"success":false,"numTotalTests":1,"numPassedTests":0,"numFailedTests":1,
 "fullName":"Day 132 R4 — AIContextBuilder governance failure drops every document when the shared governance guard throws",
 "status":"failed",
 "failureMessage":"AssertionError: expected [ { …(4) } ] to deeply equal []"}
```

### R4 — po

```json
{"success":true,
 "fullName":"Day 132 R4 — AIContextBuilder governance failure drops every document when the shared governance guard throws",
 "status":"passed"}
```

Mutacje cofnięto przez `cp`; `git diff --exit-code HEAD -- <3 pliki produkcyjne>`
nie wypisał nic.

## 5. W-C — jawna poufność

R1 używa `day132_r1_confidential_proof`; R2 i R3 osobno używają wspólnego
`day132_r23_confidential_proof`; R4 używa `day132_r4_confidential_proof`.

```text
              id               | ai_visibility | sensitivity
-------------------------------+---------------+--------------
 day132_r1_confidential_proof  | allowed       | confidential
 day132_r23_confidential_proof | allowed       | confidential
 day132_r4_confidential_proof  | allowed       | confidential
(3 rows)
```

## 6. W-D — przeliczenie po zmianach

```text
server/src/services/aiContextBuilder.ts:974:      const filterDocumentsByVisibility =
server/src/services/aiContextBuilder.ts:975:        dgMod.filterDocumentsByVisibility || dgMod.default?.filterDocumentsByVisibility;
server/src/services/aiContextBuilder.ts:976:      if (typeof filterDocumentsByVisibility === 'function' && Array.isArray(documents)) {
server/src/services/aiContextBuilder.ts:978:        const access = await filterDocumentsByVisibility(
server/src/services/ai/documentGovernance.ts:18:export async function filterDocumentsByVisibility(
server/src/services/ai/documentGovernance.ts:109:    logger.warn('[DocGov] filterDocumentsByVisibility failed — fail-closed');
server/src/services/ai/documentGovernance.ts:232:  filterDocumentsByVisibility,
server/src/services/organizationContext/ContextRetrievalService.ts:22:import { filterDocumentsByVisibility } from '../ai/documentGovernance.js';
server/src/services/organizationContext/ContextRetrievalService.ts:189:    const access = await filterDocumentsByVisibility(
server/src/services/organizationContext/ContextRetrievalService.ts:379:      const access = await filterDocumentsByVisibility(ids, projectId || undefined);
```

Wywołania wzrosły z 2 do 3. Jedno nowe wywołanie w E1 ustanawia dozwolony zakres,
którego ponownie używają E2 i E3; nie powstała nowa droga do promptu.

## 7. R5 — inwentarz dróg dokumentu do promptu

| Droga | Źródło | Stan po zmianie |
| --- | --- | --- |
| E1 selected context | `ContextRetrievalService.retrieveContext` → RAG/fallback chunks | woła strażnika w `fetchAccessibleDocuments` |
| E2 legacy RAG + raw DB fallback | `ai.routes.ts` | przyjmuje wyłącznie `governedAttachmentDocIds` z E1 |
| E3 metadata-only | `ai.routes.ts` | przyjmuje wyłącznie `governedAttachmentDocIds`; brak bloku dla pustej listy |
| korpus organizacji | `fetchOrgApprovedContext` | istniejący strażnik; flaga nadal default OFF |
| `AIContextBuilder` → `AIPipeline`/`aiOrchestrator` | `KnowledgeService.getDocuments` | istniejący strażnik, teraz fail-closed |

`AIPipeline.ts` i `aiOrchestrator.ts` nie mają bezpośredniego SELECT z
`knowledge_chunks` ani treści `knowledge_docs`; oba biorą kontekst z
`AIContextBuilder`. Plik/usługa `aiCoach` nie istnieje na markerze.

Sąsiednia ścieżka: `AIPipeline` dokłada teksty z `project_knowledge(kind='text')`.
Nie jest to `knowledge_docs`/`knowledge_chunks`, więc nie zmieniałem jej w R5.

## 8. Pułapki i zakres testów

- R1 real-DB: (c) efektywne `DB_TYPE=postgres` potwierdza pierwszy `it`; użyto
  configu poza repo. (e) jawny SQL powyżej. (a), (b), (d) nie leżą na ścieżce
  bezpośredniego wywołania serwisu. Strażnik real-DB wywołano bez argumentów.
- R2/R3: to test faktycznego końcowego handlera routera z przechwyceniem requestu
  przed startem providera. (c) `MOCK_DB=true`, więc nie jest dowodem DB. (e)
  fixture jawnie ma `sensitivity='confidential'`, a w bazie istnieje odpowiadający
  wiersz. (a), (b), (d) nie są dowiedzione, bo test omija middleware routera.
- R4: czysty unit; (c) `MOCK_DB=true`; (e) dokument mocka jawnie ma
  `sensitivity='confidential'`. Pozostałe bramki nie leżą na `_buildKnowledgeContext`.
- Nie ustawiono SMTP ani flagi wysyłki; baza miała 0 kluczy `smtp%`; nie
  uruchomiono `server/src/index.ts` ani drenażu outboxu. Nic nie wysłano.

Pełny mianownik trzech katalogów: 444 suit, 1374 testy; 1003 PASS, 220 FAIL,
151 pending. Jest to zastany czerwony korpus, nie wynik Day132. Pełne nazwy i
failures są w JSON. `npx tsc --noEmit -p server/tsconfig.json --pretty false`
zakończył się bez wyjścia i kodem 0. Wszystkie zmienione/testowe pliki poza
`ai.routes.ts` przeszły `prettier --check`; jego szeroki reformat cofnięto.

## 9. Artefakty i SHA-256

```text
b43bf6252b981814c7e0d9c6991bd983b9b820fb6d57ae027567e66427312651  day132-full-licensed-dirs-unit.json
926e297377965edfa2a8b7dfd26adeb0d7108e88641b8b05b69ae4a7265bcb73  r1-after.json
b20209f3b795ed3a1e2278a75d2c3ca9976073357ce34dfaea628573d7e351b2  r1-before.json
ca09273c926e562c9acd1dd21da02ad94945e54884b5ab13cceab4ade9398c40  r23-before.json
4912d32e31b7068f72f8c3922aed40db805dace43c8619b615866b3c793c7b2a  r4-before.json
4353b33f83a99fd48b8e4e0186adf326ff2783cf91bd5bccc1a33e7ccc1acb18  unit-after.json
01fd8d7b83fe4210a0fc256ca74015e60b963d41a930d6b24042fa0f37f90f8d  migrate-1.log
23d98fa5a7930ed1b6ad4d32994541bd779eac1ba04c7e2b375908d48ab6cf53  migrate-2.log
8a0936dee6c46abdb58cc94311df974c946e0a0ba3b05fed729da50d084a1eb0  wc-confidentiality-select.log
```

Ścieżka bazowa: `/private/tmp/cx-day132-straznik-poufnosci-artefakty/`.
Hashy czerwonych JSON-ów powyżej przeliczono po finalnym powtórzeniu W-A ze
stałymi identyfikatorami fixture'ów.

## 10. TWIERDZENIA NIEZWERYFIKOWANE

1. Nie udowodniłem pełnego realnego `POST /api/ai/chat/stream` przez
   `ApiGateway.initializeRoutes`, podpisany JWT i realny PostgreSQL: Z15 zabrania
   uruchomienia providera, a test R2/R3 celowo przechwytuje pipeline przed startem.
2. Nie udowodniłem, że żadne inne narzędzie poza przeszukanymi klasami nie
   konwertuje pośrednio danych z `project_knowledge(kind='text')` do dokumentu.
3. Nie rozstrzygnąłem 220 zastanych czerwonych testów pełnego mianownika; ich
   naprawa jest poza licencją Day132.
4. Nie twierdzę, że `aiCoach` jest bezpieczny; stwierdzam jedynie, że pliku/usługi
   o tej nazwie nie ma na markerze.
5. Nie wykonano runtime'ów 4930/4931 ani zrzutów, ponieważ dyżur nie zmienia UI.

## 11. Pliki i stan gałęzi

```text
server/src/routes/__tests__/day132.aiChatAttachmentConfidentiality.test.ts
server/src/routes/ai.routes.ts
server/src/services/ai/__tests__/day132.aiContextBuilderFailClosed.test.ts
server/src/services/aiContextBuilder.ts
server/src/services/organizationContext/ContextRetrievalService.ts
server/src/services/organizationContext/__tests__/day132.documentConfidentiality.pg.test.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY132_STRAZNIK_POUFNOSCI_REPORT.md
```

Nie wykonano pushu. Gotowe do odbioru adwersaryjnego przez nadzorcę.
