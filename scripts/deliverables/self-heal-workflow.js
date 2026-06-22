/**
 * Self-Healing Workflow — automatyczne testowanie i naprawa B-series generatorów
 * przeciwko 90 scenariuszom (M18 raporty / M19 prezentacje / M20 tabele).
 *
 * USAGE (z poziomu Claude Code, Workflow tool):
 *   Workflow({ scriptPath: 'scripts/deliverables/self-heal-workflow.js' })
 *
 * USAGE (named):
 *   .claude/workflows/deliverables-self-heal.js  (symlink lub kopia)
 *
 * Pętla per scenariusz:
 *   1. RUN: wywołaj odpowiedni generator B (B1 deck / B3 doc / B4 table)
 *      z input = scenariusz.intent + context
 *   2. SCORE: scoreDeck/scoreDoc/scoreTable → ScoreReport
 *   3. IF ✓ → mark green, next
 *   4. IF ✗ → spawnij Agent z:
 *      - listą failures + selfHealHints
 *      - dostępem do plików B-series (Edit)
 *      - misją: zmodyfikuj prompt/quality-gate aby ten konkretny scenariusz przeszedł
 *        BEZ łamania innych zielonych
 *   5. RE-RUN: powtórz krok 1
 *   6. MAX_ATTEMPTS=3 — po 3 nieudanych próbach zostaw scenariusz na czerwono
 *      z pełnym raportem (decyzja człowieka)
 *
 * MODES:
 *   - mock: llmCall zwraca canned JSON; testuje scoring engine, NIE jakość LLM
 *   - live: prawdziwy LLM (wymaga ENABLE_DELIVERABLES_PREMIUM=1 + Anthropic API key);
 *     mierzy rzeczywistą jakość B-series, feeduje real self-healing
 */

export const meta = {
  name: 'deliverables-self-heal',
  description:
    'Automatyczne testowanie 90 scenariuszy M18/M19/M20 + naprawa B-series gdy fail (loop until pass lub max 3 prób)',
  whenToUse:
    'Po wpięciu B-series w żywy pipeline; gdy Piotr aktywuje ENABLE_DELIVERABLES_PREMIUM na staging i chce zwerifikować jakość przed →UI.',
  phases: [
    { title: 'Load', detail: 'wczytaj 90 scenariuszy z docs/qa/deliverables/scenarios/' },
    { title: 'Run', detail: 'per scenariusz: generuj → scoruj' },
    { title: 'Heal', detail: 'dla każdego ❌: Agent naprawia prompt/code → re-run' },
    { title: 'Report', detail: 'finalny raport: ✓ / ⚠️ / ❌ + recommendations' },
  ],
}

// ──────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────

const MAX_ATTEMPTS_PER_SCENARIO = 3
const SCENARIO_FILES = {
  decks: 'docs/qa/deliverables/scenarios/M19_DECKS.md',
  reports: 'docs/qa/deliverables/scenarios/M18_REPORTS.md',
  tables: 'docs/qa/deliverables/scenarios/M20_TABLES.md',
}
const MODE = (args && args.mode) || 'mock'  // 'mock' | 'live'
const ONLY_TIER = args && args.tier         // 'Sml' | 'Med' | 'Lrg' | 'Xtr' (opcjonalne filtrowanie)
const ONLY_MODULE = args && args.module     // 'decks' | 'reports' | 'tables'

// ──────────────────────────────────────────────────────────────
// PHASE 1 — Load scenarios
// ──────────────────────────────────────────────────────────────

phase('Load')
log(`Mode: ${MODE} | Tier: ${ONLY_TIER || 'all'} | Module: ${ONLY_MODULE || 'all'}`)

const SCENARIO_INDEX_SCHEMA = {
  type: 'object',
  required: ['scenarios'],
  properties: {
    scenarios: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'tier', 'module', 'title', 'intent'],
        properties: {
          id: { type: 'string' },
          tier: { type: 'string', enum: ['Sml', 'Med', 'Lrg', 'Xtr'] },
          module: { type: 'string', enum: ['decks', 'reports', 'tables'] },
          title: { type: 'string' },
          intent: { type: 'string' },
        },
      },
    },
  },
}

// Parser markdown → JSON list — robi jeden parsowy agent per moduł.
const scenarioLists = await parallel(
  Object.entries(SCENARIO_FILES).map(([modName, path]) => () =>
    agent(
      `Wczytaj plik ${path}. Wyparsuj wszystkie scenariusze (S01-S30) z markdown. ` +
        `Zwróć JSON {scenarios: [...]} gdzie każdy scenariusz ma {id: "M19.S01" format, tier: Sml/Med/Lrg/Xtr, module: "${modName}", title, intent}.`,
      { label: `parse:${modName}`, schema: SCENARIO_INDEX_SCHEMA, effort: 'low' }
    )
  )
)

const allScenarios = scenarioLists
  .filter(Boolean)
  .flatMap((r) => r.scenarios)
  .filter((s) => !ONLY_TIER || s.tier === ONLY_TIER)
  .filter((s) => !ONLY_MODULE || s.module === ONLY_MODULE)

log(`Loaded ${allScenarios.length} scenarios`)

// ──────────────────────────────────────────────────────────────
// PHASE 2+3 — Run + Heal per scenariusz (pipeline)
// ──────────────────────────────────────────────────────────────

const SCORE_SCHEMA = {
  type: 'object',
  required: ['scenarioId', 'passed', 'failures', 'attempts'],
  properties: {
    scenarioId: { type: 'string' },
    passed: { type: 'boolean' },
    attempts: { type: 'integer', minimum: 1, maximum: 10 },
    finalScorePct: { type: 'integer', minimum: 0, maximum: 100 },
    failures: {
      type: 'array',
      items: {
        type: 'object',
        required: ['criterion', 'expected', 'got'],
        properties: {
          criterion: { type: 'string' },
          expected: { type: 'string' },
          got: { type: 'string' },
        },
      },
    },
    appliedFixes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'description'],
        properties: {
          file: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  },
}

const results = await pipeline(
  allScenarios,
  // STAGE 1: Run + Score (single attempt)
  async (scenario) => {
    const phaseTag = `Run`
    return agent(
      buildRunScorePrompt(scenario, MODE),
      {
        label: `run:${scenario.id}`,
        phase: phaseTag,
        schema: SCORE_SCHEMA,
        effort: 'medium',
      }
    )
  },
  // STAGE 2: Heal if needed (loop until pass or MAX_ATTEMPTS)
  async (firstAttempt, scenario) => {
    if (!firstAttempt) return null  // STAGE 1 errored
    if (firstAttempt.passed) return firstAttempt

    let lastReport = firstAttempt
    for (let attempt = 2; attempt <= MAX_ATTEMPTS_PER_SCENARIO; attempt++) {
      log(`[${scenario.id}] attempt ${attempt} — last failures: ${lastReport.failures.length}`)
      lastReport = await agent(
        buildHealPrompt(scenario, lastReport, attempt, MODE),
        {
          label: `heal:${scenario.id}:a${attempt}`,
          phase: 'Heal',
          schema: SCORE_SCHEMA,
          effort: 'high',  // healing wymaga deep reasoning o promptach + kodzie
        }
      )
      if (!lastReport) break
      if (lastReport.passed) return lastReport
    }
    return lastReport
  }
)

// ──────────────────────────────────────────────────────────────
// PHASE 4 — Final report
// ──────────────────────────────────────────────────────────────

phase('Report')

const clean = results.filter(Boolean)
const greens = clean.filter((r) => r.passed)
const reds = clean.filter((r) => !r.passed)

log(`✓ ${greens.length} / ${clean.length}`)
log(`✗ ${reds.length} failed after ${MAX_ATTEMPTS_PER_SCENARIO} attempts`)

const summary = {
  total: clean.length,
  passed: greens.length,
  failed: reds.length,
  passRate: clean.length ? Math.round((greens.length / clean.length) * 100) : 0,
  byTier: groupByTier(clean),
  byModule: groupByModule(clean),
  failuresStillOpen: reds.map((r) => ({
    id: r.scenarioId,
    finalScorePct: r.finalScorePct,
    topGaps: r.failures.slice(0, 3).map((f) => f.criterion),
  })),
}

return summary

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function buildRunScorePrompt(scenario, mode) {
  return [
    `# Test scenariusza ${scenario.id} (${scenario.tier} • ${scenario.module})`,
    ``,
    `**Tytuł**: ${scenario.title}`,
    `**Intent**: "${scenario.intent}"`,
    `**Tryb**: ${mode}`,
    ``,
    `## Co masz zrobić`,
    `1. Wczytaj DOKŁADNE kryteria scenariusza z pliku ${SCENARIO_FILES[scenario.module]} (sekcja ${scenario.id}).`,
    `2. Wywołaj odpowiedni generator:`,
    `   - decks → planDeckLayout / generateDeckVariants (B1/B2 w server/src/services/presentationLayout*.ts)`,
    `   - reports → documentStructureGenerator.ts (B3)`,
    `   - tables → tableSchemaGeneratorService.ts (B4)`,
    `   ${mode === 'mock' ? 'W MOCK mode: mock llmService.call zwracając canned premium-quality JSON pasujący do scenariusza.' : 'W LIVE mode: NIE mockuj; rzeczywiste API key wymagane.'}`,
    `3. Oceń wynik przez scoring engine (tests/integration/deliverables/scoring/${pickScorer(scenario.module)}).`,
    `4. Zwróć ScoreReport JSON {scenarioId, passed, attempts=1, finalScorePct, failures[], appliedFixes=[]}.`,
    ``,
    `Reguły:`,
    `- NIE modyfikuj plików B-series w tym wywołaniu (sam test, nie heal).`,
    `- NIE używaj Edit/Write tool tutaj.`,
    `- Failures = z ScoreReport.failures po wykonaniu scorera.`,
  ].join('\n')
}

function buildHealPrompt(scenario, lastReport, attemptNumber, mode) {
  return [
    `# Self-heal — scenariusz ${scenario.id}, attempt ${attemptNumber}/${MAX_ATTEMPTS_PER_SCENARIO}`,
    ``,
    `Poprzednia próba ZAWIODŁA. Lista braków:`,
    ...lastReport.failures.map((f) => `- **${f.criterion}**: expected ${f.expected}, got ${f.got}`),
    ``,
    `Self-heal hints z scorera:`,
    ...(lastReport.selfHealHints || []).map((h) => `- ${h}`),
    ``,
    `## Co masz zrobić`,
    `1. Zidentyfikuj ROOT CAUSE — czy to brak hintu w systemPrompt B-series, brak quality-gate, brak typu w schema, czy bug w post-processing?`,
    `2. Zmodyfikuj kod (Edit tool) MINIMALNIE — najmniejsza zmiana która naprawi te konkretne failures BEZ łamania innych zielonych scenariuszy.`,
    `3. Reguły bezpieczeństwa:`,
    `   - NIE modyfikuj wpięcia B-series w żywy pipeline (flaga OFF)`,
    `   - NIE zmieniaj kontraktów publicznych (typy eksportowane)`,
    `   - NIE łam istniejących testów unit (npx vitest run tests/unit/deliverables/)`,
    `4. Re-run scenariusz (jak w stage 1).`,
    `5. Zwróć nowy ScoreReport JSON {scenarioId, passed, attempts=${attemptNumber}, finalScorePct, failures[], appliedFixes=[{file, description}]}.`,
    ``,
    `Gdy NIE jesteś pewien root cause lub fix ryzykuje regresję — RACZEJ pozostaw na czerwono (passed=false) niż wprowadź wątpliwą zmianę.`,
  ].join('\n')
}

function pickScorer(moduleName) {
  if (moduleName === 'decks') return 'deckScoring.ts'
  if (moduleName === 'reports') return 'docScoring.ts'
  return 'tableScoring.ts'
}

function groupByTier(reports) {
  const out = {}
  for (const r of reports) {
    const tier = r.scenarioId.split('.')[1]?.match(/^S(\d+)/) ? deriveTier(r.scenarioId) : 'unknown'
    out[tier] = out[tier] || { passed: 0, failed: 0 }
    out[tier][r.passed ? 'passed' : 'failed']++
  }
  return out
}

function groupByModule(reports) {
  const out = { decks: { passed: 0, failed: 0 }, reports: { passed: 0, failed: 0 }, tables: { passed: 0, failed: 0 } }
  for (const r of reports) {
    const mod = r.scenarioId.startsWith('M19') ? 'decks' : r.scenarioId.startsWith('M18') ? 'reports' : 'tables'
    out[mod][r.passed ? 'passed' : 'failed']++
  }
  return out
}

function deriveTier(scenarioId) {
  const m = scenarioId.match(/S(\d+)/)
  if (!m) return 'unknown'
  const n = parseInt(m[1], 10)
  if (n <= 5) return 'Sml'
  if (n <= 15) return 'Med'
  if (n <= 25) return 'Lrg'
  return 'Xtr'
}
