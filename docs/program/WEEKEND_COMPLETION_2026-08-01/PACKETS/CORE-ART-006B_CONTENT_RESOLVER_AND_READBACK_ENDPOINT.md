---
doc_id: CORE-ART-006B
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-006A
last_reviewed: 2026-07-31
---

# CORE-ART-006B — resolver treści i endpoint read-back

## Oczekiwany rezultat

Registry rozwiązuje artefakt do jego primary origin i deleguje odczyt przez jawny adapter.
Nowy endpoint `GET /api/artifacts/:id/content` zwraca Envelope V1 oraz read-back metadata.
W tej paczce adaptery mogą być rejestrowane jako interfejs; pełne implementacje runtime
powstają w `006C–006E`.

## Kryteria

1. Tenant-scoped lookup artefaktu i primary origin.
2. Jawny rejestr adapterów po `originRuntime`, bez substring heuristics.
3. Stabilne błędy: artifact not found, origin missing, runtime unsupported, origin not found.
4. Odpowiedź zawiera artifactId, origin, originRevision, contentHash, resolvedAt i envelope V1.
5. `ETag` wynika z originRevision/contentHash i obsługuje `If-None-Match` → 304.
6. Resolver nie zapisuje kopii treści w `v8_output_artifacts`.
7. Unknown runtime fail-closed; placeholder nie jest zwracany jako canonical content.
8. Testy: tenant isolation, missing/unknown origin, deterministyczny hash/ETag, 304 oraz adapter dispatch.

## Dozwolone pliki

- nowy resolver/adapter contract w `server/src/services/v8` lub `server/src/services/artifacts`;
- właściwy artifacts route;
- typy odpowiedzi i testy route/service;
- bez implementacji report/presentation/sheet/canvas adapterów poza prostym test adapterem.

## Recovery

Nowy endpoint i resolver są addytywne; rollback nie zmienia danych ani obecnych tras.

## Odbiór 2026-07-31

Decyzja: **GO**.

- resolver: `7/7 PASS`;
- route ETag/304: `2/2 PASS`;
- razem z kontraktem V1: `27/27 PASS`;
- `git diff --check`: PASS.

Hash obejmuje wyłącznie treść kanoniczną, a ETag wiąże go z revision. `resolvedAt` nie
wpływa na cache identity. Registry przechowuje wyłącznie wskaźnik origin.
