# Workflow pracy — branche, testy, merge, Codex (V2)

Cel: dowozić paczki szybko, ale tak, żeby **main zawsze działał**.

## TL;DR (najprościej)
1. `main` = zawsze stabilny.
2. Każda paczka = osobny branch.
3. Zmiany → testy → manual QA → merge do `main`.

## Nazewnictwo branchy
Propozycja (czytelna dla wszystkich):
- `bundle-01-chat-core`
- `bundle-22-help-plumbing`
- `bundle-30-ops-p0-slice-30-4-billing`

## Minimalny rytuał (krok po kroku)
### A) Start paczki
```bash
git switch main
git pull
git switch -c bundle-XX-krótka-nazwa
```

### B) Praca i checkpointy
- Rób małe, logiczne commity (łatwiejszy review i rollback).
- Po każdym większym kroku odpal:
```bash
npm run verify:quick
```

### C) Merge gate przed PR/merge
**Minimum (zawsze):**
```bash
npm run verify:quick
```

**Jeśli paczka dotyka bezpieczeństwa / billing / auth / policy / middleware:**
```bash
npm run test:protect
```

**Jeśli paczka dotyka krytycznych flow UI / routingu / deploy gate:**
```bash
npm run test:e2e:smoke
```

## Manual QA (zawsze)
Używamy checklisty:
- `docs/test-quality/V2_MANUAL_QA_CHECKLIST_122_TASKS.md`

Zasada: każda paczka ma listę “top 5” manual checks (link do odpowiednich Txxx).

## PR Checklist (kopiuj do PR)
- **Scope**: link do speców (Txxx) z `docs/plans/V2_TASK_SPECS.md`
- **Bundle**: `bundle-XX`
- **Testy**:
  - [ ] `npm run verify:quick`
  - [ ] (jeśli dotyczy) `npm run test:protect`
  - [ ] (jeśli dotyczy) `npm run test:e2e:smoke`
- **Manual QA**:
  - [ ] wykonane punkty z checklisty dla Txxx
- **Ryzyka / rollout**:
  - [ ] czy dotyka stubs w prod? (NIE może)
  - [ ] czy wymaga migracji DB? (tak/nie; link)

## Jak pracujemy z Codex (1 paczka naraz)
Codex ma działać jak “team-mate implementacyjny”, ale bez chaosu:
- Codex dostaje **jedną paczkę** i **tylko** zakres tej paczki.
- Wejście do Codex zawsze zawiera:
  - taski Txxx,
  - Scope (V2) + DoD,
  - “manual QA bullets”,
  - pliki, które dotykamy (pathy),
  - testy, które mają przejść.

Wzór paczki dla Codex: patrz `agent-handoff.md` (sekcja “Codex packet”).

## Anti‑chaos (must)
- Nie robimy “wszystko naraz” na jednym branchu.
- WIP=3 (1 Codex + 2 Cursor).
- Nie merge’ujemy paczek, które nie przeszły minimalnego gate.
- Jeśli paczka rośnie: **tnij na slice** (jak w Bundle 30).

## Co robić, gdy “coś się gryzie”
Najczęstsze sytuacje:
- Konflikty w PR: rozwiązujemy natychmiast, zanim dojdą kolejne paczki.
- Regresja w smoke: revert tylko paczkę (branch), nie “ręczne dłubanie na main”.
- Duża paczka: tnij na 2–3 slice’y i merge’uj po kolei.

## Dev env (skrót)
Najczęstsze:
```bash
npm run dev
```
Jeśli potrzeba seeded SQLite demo:
```bash
npm run dev:backend:sqlite:seeded
```

