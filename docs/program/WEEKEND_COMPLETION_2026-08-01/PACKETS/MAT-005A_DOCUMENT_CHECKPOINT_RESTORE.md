---
doc_id: MAT-005A
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: MAT-002
last_reviewed: 2026-07-31
---

# MAT-005A — Document checkpoint i restore

## Problem

Backend Document Studio obsługiwał snapshoty i rollback, lecz UI pokazywało wyłącznie
listę i read-only diff. Użytkownik nie mógł utworzyć checkpointu ani bezpiecznie wrócić
do wybranej wersji z poziomu dokumentu.

## Rezultat

Istniejący panel historii/diff umożliwia:

1. utworzenie trwałego checkpointu;
2. wybranie snapshotu;
3. jawne, dwustopniowe potwierdzenie restore;
4. ponowny odczyt kanonicznego dokumentu po rollbacku;
5. aktualizację żywego edytora i odświeżenie snapshotów oraz diffu.

Zmiana wyboru snapshotu anuluje rozpoczęte potwierdzenie, więc użytkownik nie może
przypadkowo zatwierdzić innej wersji niż tę, dla której rozpoczął operację.

## Zmienione pliki

- `src/components/DocumentStudio/api.ts`;
- `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx`;
- `src/components/DocumentStudio/__tests__/DocumentStudioDocumentPanel.test.tsx`.

## Odbiór 2026-07-31

Decyzja: **GO**.

- capture→select→confirm→rollback→canonical GET→schema update: `1/1 PASS`;
- frontend `npm run type-check`: PASS;
- `git diff --check`: PASS;
- rollback nadal wykonuje tenant-scoped backend i zapisuje wersję odwracającą operację;
- konflikt z zaległym autosave jest fail-closed przez istniejący expected-version/409 flow.

## Pozostałe luki

Backend rollback nie przyjmuje jeszcze jawnego `expectedVersion`. Pełny Document golden
E2E, zarządzanie revoke/rotate linków i immutable export receipt pozostają w `MAT-005B`.
