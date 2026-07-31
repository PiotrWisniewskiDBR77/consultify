---
doc_id: CORE-ART-007
truth_type: operations
status: BLOCKED_BY_CORE_ART_006
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-006
last_reviewed: 2026-07-31
---

# CORE-ART-007 — egzekwowane quorum review przed publikacją

## Problem

Endpoint publikacji może dziś dopisać pojedynczy gate aktualnego użytkownika i wykonać
`in_review → approved → published` bez sprawdzenia przypisanych reviewerów. Odrzucenia,
brak konfiguracji oraz wiele wymaganych osób nie blokują przejścia.

## Oczekiwany rezultat

Publikacja jest fail-closed. Domyślna polityka `ALL` wymaga aktualnej decyzji `approved`
każdego przypisanego reviewera. Serwis, a nie route, egzekwuje readiness przy przejściu
do `approved` i `published`.

## Dozwolone pliki

- `server/src/types/publishReviewSemantics.ts`;
- `server/src/services/v8/publishReviewService.ts`;
- `server/src/routes/artifacts.routes.ts`;
- testy publish/review i route integration.

## Kryteria

1. Addytywne `reviewReadiness`: policy, required, approved, pending, rejected, satisfied.
2. Reviewer IDs są deduplikowane; najnowsza decyzja danego reviewera jest wiążąca.
3. `rejected` i `changes_requested` blokują; późniejsze approved może je zastąpić.
4. Tylko przypisany reviewer może złożyć decyzję liczącą się do quorum.
5. Pusta lista reviewerów blokuje publikację kodem `REVIEW_CONFIGURATION_REQUIRED`.
6. Bez quorum bezpośrednie przejście do `approved` lub `published` jest niemożliwe również poza route.
7. Publish jest idempotentny i odporny na dwa równoległe ostatnie zatwierdzenia; jeden `publishedAt`.
8. Tenant scope obowiązuje dla recordu, reviewerów i gates.
9. Istniejące tabele i pola odpowiedzi pozostają kompatybilne.

## Macierz testów

- jeden oraz wielu reviewerów: 0, 1, N-1 i N approvals;
- reviewer nieprzypisany, self-review i reviewer z innej organizacji;
- duplicate reviewers i duplicate gates;
- rejected/changes_requested → późniejsze approved oraz odwrotna kolejność;
- legacy record z pustą listą;
- direct lifecycle calls bez quorum;
- concurrency i brak częściowego/orphan gate po failure;
- pełna regresja istniejącego publish flow.

## Poza zakresem

Nowa tabela polityk, sekwencyjne poziomy review, UI konfiguracji Admina i migracja
historycznych rekordów.

## Recovery

Zmiana jest addytywna. W razie rollbacku pozostają istniejące reviewers i gates; nie
wolno usuwać historii decyzji.
