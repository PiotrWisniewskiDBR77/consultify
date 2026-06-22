# Self-Healing Test Runbook — Deliverables Quality Gates

> **Cel**: zwerifikować jakość generatorów B-series (B1 deck Layout Director / B2 warianty / B3 doc struktura / B4 table typed schema) przeciwko **90 scenariuszom** (30 × M18 raporty + 30 × M19 prezentacje + 30 × M20 tabele). Każdy ✗ test → automatyczna próba naprawy kodu/promptu → re-run. Pętla aż wszystkie ✓ lub max 3 prób.

## Architektura

```
docs/qa/deliverables/scenarios/         ← SSOT 90 scenariuszy (markdown)
├── M18_REPORTS.md   (30)
├── M19_DECKS.md     (30)
└── M20_TABLES.md    (30)

tests/integration/deliverables/
├── scoring/
│   ├── scoringTypes.ts                 ← wspólne typy + ReportBuilder DSL
│   ├── deckScoring.ts                  ← scoreDeck(plan, criteria) → ScoreReport
│   ├── docScoring.ts                   ← scoreDoc(document, criteria)
│   └── tableScoring.ts                 ← scoreTable(schema, criteria)
└── scenarioRunner.test.ts              ← vitest harness (9 pilotów green)

scripts/deliverables/
└── self-heal-workflow.js               ← multi-agent loop (Workflow tool)
```

## Tryby

### 1) Mock mode (CI / dev, ZERO koszty API)
- llmService.call mockowany; zwraca canned premium-quality JSON
- testuje **scoring engine** (czy wykrywa pass/fail dla znanych inputów)
- **NIE mierzy** jakości rzeczywistego LLM
- użyteczne: regresja scoringu, dev nowych scenariuszy

```bash
npx vitest run tests/integration/deliverables/scenarioRunner.test.ts
```

Pilot 9 scenariuszy (3 sml/med/lrg per moduł) — wszystkie zielone po self-healing meta-pętli (jeden bug w `requireSelectLabels` normalize/whitespace wyłapany w trakcie).

### 2) Live mode (mierzy faktyczną jakość B-series)

**Pre-requisites**:
1. `ENABLE_DELIVERABLES_PREMIUM=1` w env
2. `ANTHROPIC_API_KEY=sk-ant-...` (lub OpenAI/Groq zależnie od `modelRouter.select({tier:'PREMIUM'})`)
3. Decyzja Piotra: które klienty/org-id mogą być źródłem testowym (NIE prod centerbeam)

**Uruchomienie przez Workflow** (z Claude Code):

```javascript
Workflow({
  scriptPath: 'scripts/deliverables/self-heal-workflow.js',
  args: { mode: 'live', module: 'decks', tier: 'Sml' }  // start mały
})
```

**Skala uruchomienia**:
- `tier: 'Sml'` per moduł = 5 testów; ~$0.10-0.50 LLM cost (Claude Sonnet)
- `tier: 'Med'` = 10 testów; ~$0.30-1.50
- Full 90 testów × 1 attempt = ~$10-30
- Full 90 × max 3 attempts × max 1 heal iteration = ~$30-100 worst-case

Tracking: `cost-monitoring.service.ts` (X6 transactional outputs registry zapisuje per generation purpose).

## Pętla self-healing (single scenario)

```
┌─────────────────────────────────────────────────────────┐
│ 1. RUN — Agent woła generator B (B1/B3/B4) z scenario.intent│
│    → DeckLayoutDirectorResult / DocumentArtifact /      │
│      GeneratedTable                                     │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 2. SCORE — Agent woła scoreDeck/scoreDoc/scoreTable     │
│    → ScoreReport {passed, failures[], selfHealHints[]}  │
└──────────────────┬──────────────────────────────────────┘
                   ↓
              ┌────┴────┐
              │ passed? │
              └────┬────┘
              YES ↙    ↘ NO
                ✓       ┌─────────────────────────────────┐
              done      │ 3. HEAL — Agent (effort=high):   │
                        │    - czyta failures + hints      │
                        │    - identyfikuje root cause     │
                        │      (prompt? quality-gate? bug?)│
                        │    - Edit MINIMAL change         │
                        │    - re-run                      │
                        │    - attempt < MAX_ATTEMPTS=3 → loop │
                        │    - attempt = MAX → red flag    │
                        └─────────────────────────────────┘
```

## Bezpieczniki

- **MAX_ATTEMPTS=3 per scenariusz** — po 3 nieudanych próbach scenariusz zostaje na czerwono z pełnym raportem (decyzja człowieka, nie endless loop)
- **NIE wpina generatorów w żywy pipeline** — testy działają na izolowanych wywołaniach
- **NIE łamie publicznych kontraktów** — heal agent ma instrukcję "raczej zostaw na czerwono niż wprowadź wątpliwą zmianę"
- **Regresja-guard**: każdy heal musi zakończyć się `npx vitest run tests/unit/deliverables/` z 0 fail przed commitem zmiany
- **Wyłącznie staging/dev DB**: live mode nie dotyka prod (centerbeam) — Q1/Q3 golden-prompty na izolowanym org-id

## Raport końcowy

Workflow zwraca obiekt:

```typescript
{
  total: 90,
  passed: 87,
  failed: 3,
  passRate: 96,
  byTier: {
    Sml: { passed: 15, failed: 0 },
    Med: { passed: 30, failed: 0 },
    Lrg: { passed: 28, failed: 2 },
    Xtr: { passed: 14, failed: 1 },
  },
  byModule: {
    decks: { passed: 30, failed: 0 },
    reports: { passed: 29, failed: 1 },
    tables: { passed: 28, failed: 2 },
  },
  failuresStillOpen: [
    {
      id: 'M20.S28',
      finalScorePct: 80,
      topGaps: ['forbidFieldType singleLineText', 'distinct field types', '...'],
    },
    // ...
  ],
}
```

Failures pozostawione na czerwono → wpisać do `docs/qa/deliverables/REGRESSION_QUEUE.md` z proponowanym fixem od heal-agenta (do ręcznego ramienia człowieka).

## Mapowanie na bramki acceptance (FT)

| Scenariusz tier | FT-mapping | Co testuje |
|---|---|---|
| **Sml** (S01-S05) | FT-1 (unit) | Podstawowy kontrakt generatora — typed result, valid catalog, fail-open |
| **Med** (S06-S15) | FT-2 (integration) | Pełen flow z bramkami quality-gate; layouty/typy biznesowe |
| **Lrg** (S16-S25) | FT-6 (jakość) | Head-to-head vs ideał kanonu (≥8 distinct layouts, palette discipline, CF rules) |
| **Xtr** (S26-S30) | FT-6 + FT-7 manual | Constraint/adversarial; edge case'y |

Po przejściu wszystkich 90 → **FT-6 formal acceptance** dla B1-B4 zamknięte. Pozostaje tylko FT-7 (manual screenshots) i FT-5 (pixel-diff dla X1) z bramką Q2.

## Roadmap

1. **Faza 0** (zrobiona): scoring engine + 9 pilotów green w mock mode
2. **Faza 1**: live mode pilot — 5 Sml decków × $0.10 = quick sanity check; mierzy faktyczną jakość B1
3. **Faza 2**: gdy Piotr akceptuje Q1 próg jakości — pełen sweep 90 scenariuszy w live mode
4. **Faza 3**: scenariusze które nie przejdą po 3 attempts → ręczne backlog + decyzja czy "ship as is" czy "refactor B-series"
5. **Faza 4**: gdy 90/90 zielone → wpięcie B-series w żywy pipeline (osobny krok per klient, opt-in flaga per-org)

## TL;DR

- 90 scenariuszy w SSOT markdown ✓
- 3 scoring engines TypeScript ✓
- 9 pilotów green w mock mode ✓ (meta-pętla wykryła i naprawiła 1 self-bug w scoringu)
- Workflow auto-heal gotowy do uruchomienia ✓
- Live mode czeka decyzji Piotra (Q1 próg jakości + API budget + wybór staging org-id)
