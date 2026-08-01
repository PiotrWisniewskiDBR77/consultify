---
doc_id: CORE-ART-006A
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-005
last_reviewed: 2026-07-31
---

# CORE-ART-006A — wspólny Artifact Content Envelope V1

## Oczekiwany rezultat

Backend i frontend korzystają z jednego zgodnego kontraktu envelope. Kontrakt jest
addytywny, walidowany na granicy i potrafi bezpiecznie opisać starszy payload jako
`legacy/v0`, bez fałszywego statusu synchronizacji.

## Wymagany kontrakt

- `envelopeVersion: 'artifact-content/v1'`;
- `canonicalFormat: 'markdown' | 'json'`;
- `canonicalKind: 'document' | 'presentation' | 'sheet' | 'canvas' | 'unknown'`;
- wymagany `contentSchemaVersion`, z fallbackiem `legacy/v0`;
- `contentMd`, opcjonalne `contentJson` i `blocks`;
- `projection`: status, projectedAt, error, completeness, projectedFromRevision/hash;
- `provenance`: originRuntime, originRecordId, originRevision;
- legacy aliases pozostają dostępne w okresie migracji.

## Kryteria

1. Jedna backendowa schema Zod i zgodny typ klienta.
2. Parse/serialize V1 zachowuje wszystkie pola.
3. Legacy payload normalizuje się deterministycznie do `legacy/v0`.
4. Pusty Markdown ma status `missing`, nie `synced`.
5. JSON z Markdownem bez zgodnej rewizji/hash ma status `stale`.
6. `projection.completeness` rozróżnia `full` i `truncated`.
7. Istniejące API zachowuje aliasy `contentMd`, `contentJson`, `blocks`.
8. Brak zmian schematu DB i brak zmian resolverów runtime w tej paczce.

## Dozwolone pliki

- nowy/wspólny typ w `server/src/types`;
- `server/src/services/artifacts/contentProjectionService.ts` tylko dla użycia kontraktu;
- `src/types/artifactContent.ts` i `src/types/canvasWorkspace.ts` tylko dla parytetu;
- testy kontraktu i projekcji.

## Recovery

Addytywna zmiana typów. Rollback usuwa V1 i zachowuje istniejące payloady oraz dane.

## Odbiór 2026-07-31

Decyzja: **GO**.

- V1 contract matrix: `18/18 PASS`;
- istniejąca projekcja content: `4/4 PASS`;
- łącznie: `22/22 PASS`;
- pełny frontend typecheck: PASS;
- `git diff --check`: PASS.

Pierwszy przebieg ujawnił regresję opcjonalnego `artifactType`; została naprawiona bez
zmiany konsumenta, a wymagany alias jest ponownie gwarantowany przez V1 i normalizer.
