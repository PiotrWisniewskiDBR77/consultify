---
packet_id: WK-P0-001
module: cross-cutting
priority: P0
status: READY
owner: codex
implementer: claude
last_reviewed: 2026-07-30
---

# WK-P0-001 — stabilny baseline

## Problem

Repo zawiera istniejące zmiany użytkownika, rozbudowany zestaw testów i znane
regresje. Bez jednego revision oraz raportu bazowego nie da się odróżnić nowej
regresji od wcześniejszego długu.

## Oczekiwany rezultat

Powstaje odtwarzalny raport stanu startowego, który wskazuje revision, zakres
zmian, działające bramki i znane awarie bez naprawiania ich w tym pakiecie.

## Zakres

- zapisać branch, HEAD i relację do `origin/demo`;
- zinwentaryzować tracked/untracked/modified bez usuwania;
- uruchomić type-check i build;
- uruchomić uzgodniony krytyczny zestaw testów;
- uruchomić `check:ssot`, `docs:links`, `docs:check`;
- sklasyfikować każdą awarię jako pre-existing, new albo infrastructure;
- zapisać czas, środowisko i dokładne polecenia.

## Poza zakresem

- naprawa testów;
- formatowanie całego repo;
- migracje;
- commit, push, merge i deploy;
- usuwanie artefaktów.

## Kryteria akceptacji

1. Raport zawiera pełne ID rewizji.
2. Nie zmieniono kodu produktu.
3. Każda bramka ma wynik i link/log.
4. Znane awarie mają właściciela lub pozycję boardu.
5. Raport umożliwia porównanie z końcową bramką weekendu.

## Dowody

- `git status` i `git diff --stat`;
- wynik type-check/build;
- wyniki testów;
- wynik kontroli dokumentacji;
- lista wygenerowanych artefaktów.

## Rollback

Pakiet jest diagnostyczny i nie powinien wymagać rollbacku. Artefakty
wygenerowane przez testy mają pozostać ignorowane lub trafić do wyznaczonego
katalogu evidence.
