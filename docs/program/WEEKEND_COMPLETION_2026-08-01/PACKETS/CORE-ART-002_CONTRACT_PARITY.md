---
doc_id: CORE-ART-002
truth_type: operations
status: GO
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-001
last_reviewed: 2026-07-31
---

# CORE-ART-002 — addytywne wyrównanie kontraktów Artifact

## Oczekiwany rezultat

Frontend poprawnie typuje wszystkie legalne odpowiedzi Artifact Run backendu, a schema `ArtifactRecord` waliduje `isDraft` kompatybilnie ze starymi rekordami.

## Dozwolone pliki

- `src/services/api/artifactRuns.ts`;
- `server/src/types/artifactRegistry.ts`;
- odpowiadające testy typu/schema/route;
- wyłącznie konieczne importy wspólnych typów.

## Wymagane zmiany

1. Dodać `template` do klientowego `ArtifactFamily`.
2. Dodać `sheet_template`, `document_template`, `work_canvas` do klientowego origin runtime.
3. Dodać opcjonalny, kompatybilny `operationContract` do klientowego recordu zgodnie z backendem.
4. Uzupełnić `ArtifactRecordSchema` o `isDraft` z bezpieczną kompatybilnością istniejących rekordów.
5. Dodać test parity/snapshot literal arrays albo inny test wykluczający ponowny dryf.

## Poza zakresem

Lifecycle, retry, preflight, publish quorum, migracje DB, rename pól, zmiana payloadów i UI.

## Kryteria akceptacji

- stary rekord bez `isDraft` parsuje się jako bezpieczny `false` albo jest normalizowany na granicy w jawnie przetestowany sposób;
- rekordy wszystkich origin runtime parsują się po stronie klienta;
- brak `as any` dodanego w celu ukrycia rozjazdu;
- dotychczasowe route/service tests przechodzą;
- brak zmian poza allowlistą;
- raport agenta podaje komendy testów i diff scope.

## Rollback

Zmiany są addytywne i typowe; rollback to odwrócenie commit/diff. Brak migracji danych.

## Raport odbioru Codex — 2026-07-31

- zakres: zgodny, wyłącznie dwa pliki kontraktu i jeden nowy test;
- klient: `template`, pełny `ArtifactOriginRuntime`, opcjonalny `operationContract`;
- backend schema: `isDraft` jako `optional().default(false)`;
- parity/schema: `5/5 PASS`;
- frontend `npm run type-check`: `PASS`;
- backend `npm --prefix server run typecheck`: `PASS`;
- `git diff --check`: `PASS`;
- DB/UI/lifecycle/retry/preflight/publish: bez zmian;
- werdykt: `GO`.
