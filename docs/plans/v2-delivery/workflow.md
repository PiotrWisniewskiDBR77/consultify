# Workflow pracy — branche, testy, merge, Codex (V2)

Cel: dowozic paczki szybko, ale tak, zeby **main zawsze dzialal**.

## TL;DR (najprosciej)
1. `main` = zawsze stabilny.
2. Kazda paczka = osobny branch.
3. Zmiany -> testy -> manual QA -> merge do `main`.

## Nazewnictwo branchy
Propozycja (czytelna dla wszystkich):
- `bundle-01-chat-core`
- `bundle-22-help-plumbing`
- `bundle-30-ops-p0-slice-30-4-billing`

## Minimalny rytual (krok po kroku)
### A) Start paczki
```bash
git switch main
git pull
git switch -c bundle-XX-krotka-nazwa
```

### B) Praca i checkpointy
- Rob male, logiczne commity (latwiejszy review i rollback).
- Po kazdym wiekszym kroku odpal:
```bash
npm run verify:quick
```

### C) Merge gate przed PR/merge
**Minimum (zawsze):**
```bash
npm run verify:quick
```

**Jesli paczka dotyka bezpieczenstwa / billing / auth / policy / middleware:**
```bash
npm run test:protect
```

**Jesli paczka dotyka krytycznych flow UI / routingu / deploy gate:**
```bash
npm run test:e2e:smoke
```

## Manual QA (zawsze)
Uzywamy checklisty:
- `docs/test-quality/V2_MANUAL_QA_CHECKLIST_122_TASKS.md`

Zasada: kazda paczka ma liste "top 5" manual checks (link do odpowiednich Txxx).

## PR Checklist (kopiuj do PR)
- **Scope**: link do specow (Txxx) z `docs/plans/V2_TASK_SPECS.md`
- **Bundle**: `bundle-XX`
- **Testy**:
  - [ ] `npm run verify:quick`
  - [ ] (jesli dotyczy) `npm run test:protect`
  - [ ] (jesli dotyczy) `npm run test:e2e:smoke`
- **Manual QA**:
  - [ ] wykonane punkty z checklisty dla Txxx
- **Ryzyka / rollout**:
  - [ ] czy dotyka stubs w prod? (NIE moze)
  - [ ] czy wymaga migracji DB? (tak/nie; link)

## Jak pracujemy z Codex (1 paczka naraz)
Codex ma dzialac jak "team-mate implementacyjny", ale bez chaosu:
- Codex dostaje **jedna paczke** i **tylko** zakres tej paczki.
- Wejscie do Codex zawsze zawiera:
  - taski Txxx,
  - Scope (V2) + DoD,
  - "manual QA bullets",
  - pliki, ktore dotykamy (pathy),
  - testy, ktore maja przejsc.

Wzor paczki dla Codex: patrz `agent-handoff.md` (sekcja "Codex packet").

## Anti-chaos (must)
- Nie robimy "wszystko naraz" na jednym branchu.
- WIP=3 (1 Codex + 2 Cursor).
- Nie merge'ujemy paczek, ktore nie przeszly minimalnego gate.
- Jesli paczka rosnie: **tnij na slice** (jak w Bundle 30).

## Co robic, gdy "cos sie gryzie"
Najczestsze sytuacje:
- Konflikty w PR: rozwiazujemy natychmiast, zanim dojda kolejne paczki.
- Regresja w smoke: revert tylko paczke (branch), nie "reczne dlubanie na main".
- Duza paczka: tnij na 2-3 slice'y i merge'uj po kolei.

## Dev env (skrot)
Najczestsze:
```bash
npm run dev
```

---

## Lekcje z Wave 1 (2026-02-19) — zasady dodane po review

### DB = PostgreSQL (nie SQLite)
- Serwisy: `?` jako placeholder (`adaptQuery` w `PostgresDatabase.ts` zamieni na `$1/$2`).
- Migracje SQL (`server/migrations/*.sql`): natywny PostgreSQL (DO $$ ... IF NOT EXISTS, NOW(), BOOLEAN).
- Boolean: `TRUE`/`FALSE`, nie `1`/`0`.
- Nie uzywaj: `datetime('now')`, `IFNULL`, `ADD COLUMN IF NOT EXISTS` (to SQLite).

### progress.md — edytuje TYLKO owner (nie agenty)
Agenty raportuja status w swoim raporcie koncowym. Owner (Piotr lub glowny agent) aktualizuje `progress.md` centralnie po review. Eliminuje konflikty merge.

### Pre-existing test failures
W repo sa pre-existing lint errors i test failures. Agenty je ignoruja. Liczy sie:
1. Nowe/zmienione pliki przechodza `npx tsc --noEmit`.
2. Brak nowych ESLint errors.
3. Jesli dotyczy security/billing: `npm run test:protect` przechodzi.

### i18n — unikanie konfliktow w translation.json
- Nowe klucze dodawaj NA KONCU pliku (przed `}`).
- Prefix: nazwa modulu (np. `trial.`, `legal.`, `onboarding.`).
- Jesli 2+ bundla dotykaja translation.json rownolegle — merge recznie (owner).

### Migracje — numeracja
- Sprawdz `server/migrations/` przed tworzeniem migracji.
- Uzyj kolejnego wolnego numeru. Aktualnie ostatni: ~552.

### Raport koncowy — wymagany format
Kazdy agent musi dostarczyc raport w formacie z `PROMPT_TEMPLATE_V2.md`. Bez tego paczka nie przechodzi review.

### Dane konfiguracyjne — nie hardcode
Plany, limity, ceny: z DB/config. Nie hardcode w komponentach UI.

### Szablon promptow
Uzywaj `PROMPT_TEMPLATE_V2.md` do generowania promptow dla kolejnych wave.
