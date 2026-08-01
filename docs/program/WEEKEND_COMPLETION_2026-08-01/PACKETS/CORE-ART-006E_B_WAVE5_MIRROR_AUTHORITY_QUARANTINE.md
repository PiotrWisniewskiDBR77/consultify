---
doc_id: CORE-ART-006E-B
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-006E-A
last_reviewed: 2026-07-31
---

# CORE-ART-006E-B — kwarantanna placeholderów Wave5 mirror

## Problem

`mirrorLegacyArtifactIntoWave5` zapisuje Markdown „Legacy artifact mirrored…” pod ID
prawdziwego artefaktu. Taki placeholder może wyglądać jak kanoniczna treść i pozostaje
trwale nieaktualny.

## Oczekiwany rezultat

Legacy mirror jest wyłącznie indeksem/linkiem. Registry zawsze odczytuje prawdziwy
origin runtime; placeholder nigdy nie jest content authority.

## Kryteria

1. Nowe mirrory nie zapisują placeholdera jako synced canonical content.
2. Existing placeholder jest oznaczony `contentAuthority: origin_runtime` i quarantined.
3. Brak originu kończy się kontrolowanym content unavailable, bez fallbacku do placeholdera.
4. Aktualizacja report/deck/sheet jest widoczna w kolejnym Registry read-back bez refresh mirroru.
5. Native Wave5 artifact niebędący mirrorem zachowuje Wave5 jako authority.
6. Tenant scope obowiązuje na mirror i origin.
7. Materialization pozostaje completed przy best-effort mirror failure.
8. Istniejące mirrory nie są kasowane; brak migracji destrukcyjnej.

## Recovery

Rollback przywraca stary mirror writer, nie usuwa ani nie przepisuje historycznych rekordów.

## Odbiór 2026-08-01

Decyzja: **GO**.

- Wave5 runtime + quarantine + origin adapters: `26/26 PASS`;
- frontend typecheck: PASS;
- `git diff --check`: PASS.

Nowe mirrory są linkami z projekcją `missing`. Historyczna treść placeholdera pozostaje
w bazie, ale jest wykrywana i omijana. Native Wave5 niebędący mirrorem zachowuje własne
content authority.
