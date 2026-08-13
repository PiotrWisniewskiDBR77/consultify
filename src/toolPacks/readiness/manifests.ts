/**
 * Runtime Readiness Manifests — 19 narzędzi z realnym silnikiem, per-narzędzie,
 * NIGDY zbiorczo. STREAM H3, 2026-08-13, candidate SHA `91b562ea66`.
 *
 * ŹRÓDŁA (zweryfikowane TYM streamem, nie skopiowane z ROSTER_MATRIX.md —
 * ta linia jest prawdziwa dla każdego faktu poniżej; patrz komenda w
 * komentarzu przy każdym bloku dowodowym):
 *
 *  - `docs/program/METHOD_TOOLS_2026-08-13/ROSTER_MATRIX.md` (Stream G4,
 *    SHA 773c72d371) — użyty jako PUNKT WYJŚCIA. `773c72d371` jest
 *    przodkiem `91b562ea66` (`git merge-base --is-ancestor` potwierdzone),
 *    a jedyna zmiana w plikach dotykających tego obszaru między tymi SHA to
 *    DODANIE `engineBindingCoverage.test.ts` (git diff --stat, zero zmian w
 *    registry.ts / ToolCanvas.tsx / toolOutputSnapshotService.ts /
 *    consultingToolsStandard.ts) — więc strukturalne twierdzenia matrycy
 *    zostały PONOWNIE zweryfikowane grep-em i testami na `91b562ea66`, nie
 *    przepisane.
 *  - Re-run tym streamem (worktree `h3-manifest`, docker `cfy-h3-manifest`,
 *    port 56800, świeża migracja `migrate.postgres.ts`, exit 0):
 *      `CI=true npx vitest run src/toolPacks/__tests__/`
 *        → 4 pliki / 187 testów PASS (kontrakt: pack, engine binding,
 *          question bank coverage, validator).
 *      `CI=true RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=...:56800/...
 *        npx vitest run --config vitest.acceptance.config.ts
 *        tests/acceptance/h32-19tools.e2e.test.ts`
 *        → 19/19 PASS (session-level: create/save/reload/conclusion).
 *      `... npx vitest run
 *        tests/integration/tools-archetype-promote-characterization.realdb.test.ts
 *        --no-file-parallelism`
 *        → 8/8 PASS (1 tool per archetyp, do promote-initiative).
 *      `... npx vitest run tests/integration/tools-outputs-immutable.realdb.test.ts
 *        tests/integration/tls-007-swot-candidate-handoff.realdb.test.ts
 *        --no-file-parallelism`
 *        → 2 pliki / 18 testów PASS (dynamic-swot Output bridge).
 *      `... npx vitest run --config vitest.acceptance.config.ts
 *        tests/acceptance/tls04-swot-proposal-lifecycle.e2e.test.ts`
 *        → 33/33 PASS (dynamic-swot pełny cykl proposal->approval).
 *      Jednorazowy, NIEZACOMMITOWANY probe (utworzony i usunięty tym
 *      streamem — `tests/integration/_h3-scratch-report-presentation.realdb.test.ts`,
 *      log zachowany w `docs/program/METHOD_TOOLS_2026-08-13/readiness/evidence/`):
 *      sop-builder -> outputType 'report' HTTP 200 (report utworzony);
 *      capability-mapper -> outputType 'presentation' HTTP 200.
 *  - `grep -c "toolType ===" src/components/DiscoveryTools/ToolCanvas.tsx`
 *    → 16 (re-policzone na 91b562ea66).
 *  - `grep -n "CONSULTING_TOOL_STANDARD_OUTPUTS" src/config/consultingToolsStandard.ts`
 *    → `['initiative']` (re-potwierdzone na 91b562ea66).
 *  - `find docs/qa/screens -iname '*<toolType>*'` dla wszystkich 19 → 0
 *    trafień (re-policzone na 91b562ea66) — zero dowodu Light/Dark MPQ.
 *  - `grep -rn '<toolType>' tests/e2e/` dla wszystkich 19 (re-policzone) —
 *    patrz `EVIDENCE_BROWSER_E2E_*` niżej.
 *
 * DOKTRYNA (per instrukcja streamu): oczekywane jest, że WIĘKSZOŚĆ bramek
 * będzie FAIL albo NOT_VERIFIED. To jest poprawny, wartościowy wynik.
 * Prawdziwy FAIL > pochlebny PASS.
 */

import {
  emptyReadinessManifest,
  evaluateRuntimeReadiness,
  type ReadinessGate,
  type RuntimeReadinessManifest,
} from '../runtimeReadiness';
import type { CriterionRecord, ToolReadinessCriteria, ToolReadinessRecord } from './types';

/** Jedyny ważny SHA dla dowodów w tym streamie — patrz nagłówek zadania. */
export const CANDIDATE_SHA = '91b562ea66';

export const VERIFIED_AT = '2026-08-13T20:40:00Z';

const PASS: CriterionStatusPass = 'PASS';
type CriterionStatusPass = 'PASS';

function rec(status: CriterionRecord['status'], evidence: string): CriterionRecord {
  return { status, evidence };
}

// --- Dowody wspólne dla wszystkich 19 (identyczna komenda/plik, różny wynik per narzędzie) ---

const EV_PACK =
  'src/toolPacks/registry.ts (AUTHORED_PACKS) + src/toolPacks/__tests__/registry.test.ts + ' +
  'validator.test.ts — re-run ten stream: `CI=true npx vitest run src/toolPacks/__tests__/` ' +
  '→ 4 pliki / 187 testów PASS na 91b562ea66 (nie skopiowane z ROSTER_MATRIX.md, uruchomione ponownie).';

const EV_ENGINE =
  'src/toolPacks/__tests__/engineBindingCoverage.test.ts (136 testów) — engine.engineDir i ' +
  'engine.questionBankModule istnieją na dysku; re-run ten stream, zielone na 91b562ea66.';

const EV_QUESTION_WORKFLOW =
  'engineBindingCoverage.test.ts: "fazy packa zgadzają się DOKŁADNIE z realnym ' +
  'TOOL_STEP_DEFINITIONS" — pack.phases id == src/store/useToolStore.ts ' +
  'TOOL_STEP_DEFINITIONS[toolType], w tej samej kolejności. Re-run ten stream, PASS.';

const EV_PERSISTENCE =
  'tests/acceptance/h32-19tools.e2e.test.ts — re-run ten stream przeciwko REALNEMU Postgresowi ' +
  '(cfy-h3-manifest, port 56800, świeża migracja) na 91b562ea66: 19/19 PASS. RELOAD (GET po PUT) ' +
  'zwraca answers.summary.verdict bajt-w-bajt.';

const EV_RESTART_REOPEN =
  EV_PERSISTENCE +
  ' UWAGA: to dowód na poziomie HTTP (GET po PUT na realnym Postgresie), NIE przejechany test ' +
  'zamknięcia/otwarcia karty w realnej przeglądarce — patrz browserE2E.';

const EV_VALIDATION =
  'src/toolPacks/__tests__/validator.test.ts — re-run ten stream (w ramach tych samych 4 plików/' +
  '187 testów): pack.rights wypełnione, commercialUseStatus nigdy "Free", provenance niepuste, ' +
  'validateToolPack() zero błędów.';

const EV_LIGHT_MPQ =
  'Brak wpisu w docs/qa/screens/ dla tego workspace narzędzia — re-policzone ten stream: ' +
  '`find docs/qa/screens -iname "*<toolType>*"` → 0 trafień dla wszystkich 19. Żaden pack nie ' +
  'ustawia lightMpq. Nigdy nie oceniane — nie "niski wynik", dosłownie brak oceny.';

const EV_DARK_MPQ = EV_LIGHT_MPQ.replace('lightMpq', 'darkMpq');

const EV_REPORT_ALL =
  'src/config/consultingToolsStandard.ts:35 CONSULTING_TOOL_STANDARD_OUTPUTS = [\'initiative\'] ' +
  '— re-potwierdzone ten stream (grep na 91b562ea66) — żaden frontendowy CTA nie oferuje ' +
  '"report" dla ŻADNEGO z 19 narzędzi. Backend (ToolController.promoteToOutput, ' +
  'outputType===\'report\') first-party sprawdzony TYM streamem tylko dla sop-builder: HTTP 200, ' +
  'wiersz report_builder_reports utworzony (scratch test, uruchomiony i usunięty, log w ' +
  'readiness/evidence/h3-scratch-report-presentation.txt). Nie sprawdzone dla pozostałych 18. ' +
  'DoD na poziomie użytecznym dla klienta = FAIL dla wszystkich 19, bo brak ścieżki UI.';

const EV_PRESENTATION_ALL =
  'src/config/consultingToolsStandard.ts:35 — jak wyżej, ten sam brak CTA. Backend ' +
  '(outputType===\'presentation\') first-party sprawdzony tym streamem tylko dla ' +
  'capability-mapper: HTTP 200 (log jw.). Nie sprawdzone dla pozostałych 18. FAIL dla wszystkich ' +
  '19 na poziomie użytecznym dla klienta.';

const EV_EVIDENCE_LEDGER =
  'Ten manifest sam niesie evidenceLedgerRefs — wskaźniki na realne, istniejące w repo pliki ' +
  '(testy + logi tego streamu + ROSTER_MATRIX.md), zweryfikowane ten stream. Patrz pole ' +
  'runtimeReadiness.evidenceLedgerRefs poniżej.';

// --- Dowody, które różnią się per warstwa (renderer, output, initiative/approval, browser E2E) ---

const EV_RENDERER_PASS =
  'src/components/DiscoveryTools/ToolCanvas.tsx — dedykowana gałąź "toolType === ..." istnieje ' +
  '(re-policzone ten stream: `grep -c "toolType ===" ToolCanvas.tsx` = 16, to narzędzie wśród nich).';

const EV_RENDERER_FAIL =
  'src/components/DiscoveryTools/ToolCanvas.tsx — to narzędzie jest is_coming_soon=0 (Library ' +
  'pokazuje je jako w pełni dostępne) i ma pełny silnik RICH w src/config/, ale NIE jest wśród ' +
  '16 dedykowanych gałęzi ToolCanvas.tsx (re-policzone ten stream) — spada do renderera ' +
  'generycznego. FAIL, nie "uzasadniony generic" (treść istnieje, tylko nieobsłużona).';

const EV_OUTPUT_SWOT =
  'server/src/services/tools/toolOutputSnapshotService.ts:179 — jedyna gałąź ' +
  'tool_type-specyficzna (`if (session.tool_type === \'dynamic-swot\')`), wywołuje realny most ' +
  'buildSwotOutput (treść bogata, nie generyczna). Re-run ten stream: ' +
  'tests/integration/tools-outputs-immutable.realdb.test.ts + ' +
  'tests/integration/tls-007-swot-candidate-handoff.realdb.test.ts → 2 pliki / 18 testów PASS na ' +
  '91b562ea66.';

const EV_OUTPUT_GENERIC_EMPTY_PROVEN =
  'tests/integration/tools-archetype-promote-characterization.realdb.test.ts — re-run ten stream ' +
  '(8/8 PASS na 91b562ea66, port 56800): wiersz tool_outputs UTWORZONY, ale ' +
  'payload_json.items=[] i payload_json.engineVersion=\'generic-fallback-1.0.0\' — DOWIEDZIONE ' +
  'puste-ale-uczciwe. Nie spełnia DoD dla realnej treści klienckiej mimo że mechanizm działa.';

const EV_OUTPUT_NOT_DRIVEN =
  'Nie odpalone tym streamem dla tego konkretnego narzędzia. Kod (buildOutputForSession, ' +
  'toolOutputSnapshotService.ts) nie ma gałęzi tool_type poza dynamic-swot (przeczytane na ' +
  '91b562ea66) — ten sam los generic-empty jest OCZEKIWANY, ale "oczekiwane" ≠ "zweryfikowane". ' +
  'NOT_VERIFIED, nie PASS na wnioskowaniu.';

const EV_INITIATIVE_PASS =
  'tests/integration/tools-archetype-promote-characterization.realdb.test.ts (8/8, re-run ten ' +
  'stream) + dynamic-swot: tests/acceptance/tls04-swot-proposal-lifecycle.e2e.test.ts (33/33, ' +
  're-run ten stream) — wiersz tool_initiative_links (batch_id=\'promote-initiative\') + realny ' +
  'wiersz initiatives utworzony. Frontend CTA też oferuje \'initiative\' (jedyny wystawiony ' +
  'outputType — CONSULTING_TOOL_STANDARD_OUTPUTS).';

const EV_INITIATIVE_NOT_DRIVEN =
  'Nie odpalone tym streamem dla tego narzędzia. Gałąź outputType===\'initiative\' w ' +
  'ToolController.promoteToOutput nie ma logiki warunkowej po tool_type poza wpisem do ' +
  'toolTrace (przeczytane na 91b562ea66) — oczekiwane identyczne zachowanie, ale NOT_VERIFIED, ' +
  'nie PASS na wnioskowaniu.';

const EV_APPROVAL_PASS =
  'tests/integration/tools-archetype-promote-characterization.realdb.test.ts (8/8, re-run ten ' +
  'stream) — kroki SUBMIT FOR REVIEW + APPROVE, przejścia statusu IN_PROGRESS→REVIEW→APPROVED ' +
  'dowiedzione na realnym Postgresie. Dla dynamic-swot dodatkowo ' +
  'tls04-swot-proposal-lifecycle.e2e.test.ts (33/33, re-run ten stream) — pełny cykl propozycji.';

const EV_APPROVAL_NOT_DRIVEN =
  'h32-19tools.e2e.test.ts (jedyny automatyczny test tego narzędzia na poziomie sesji) ' +
  'sprawdza tylko CREATE/SAVE/RELOAD/conclusion — NIE dochodzi do REVIEW→APPROVE. Krok approve ' +
  'nie był odpalony tym streamem dla tego narzędzia.';

const EV_BROWSER_E2E_SWOT =
  'tests/e2e/tools/swot-real-pg-resume.spec.ts (Playwright: page.goto + kliknięcia + ' +
  'page.reload — TLS-02/03/05, w tym hard-reload resume) i tests/e2e/tools-to-initiatives.spec.ts ' +
  'ISTNIEJĄ i celują w dynamic-swot (grep potwierdzony ten stream), ale NIE zostały odpalone tym ' +
  'streamem (wymagałoby żywego serwera dev + zainstalowanej przeglądarki Playwright — poza ' +
  'zakresem tego przebiegu). Plik istnieje, nie uruchomiony = NOT_VERIFIED, nie PASS.';

const EV_BROWSER_E2E_NONE =
  'Zero plików w tests/e2e/ odwołuje się do tego toolType z faktyczną nawigacją przeglądarki ' +
  '(re-policzone ten stream: `grep -rn "<toolType>" tests/e2e/`) — zweryfikowany, ostateczny brak, ' +
  'nie "nieodpalone, może istnieje".';

const EV_BROWSER_E2E_API_ONLY =
  'tests/e2e/smoke/deploy-gate-api-tools-workflow.spec.ts odwołuje się do tego toolType, ALE ' +
  'wyłącznie przez fixture `request` Playwrighta (wywołania API, zero page.goto/interakcji UI) — ' +
  'sprawdzone ten stream czytając plik. To smoke-test API w kostiumie Playwrighta, nie ' +
  'faktyczny dowód przeglądarkowy. FAIL na kryterium "browser E2E".';

// --- Definicje 19 narzędzi -----------------------------------------------

type Tier = 1 | 2 | 3;

interface ToolDef {
  toolType: string;
  displayName: string;
  archetype: string;
  tier: Tier;
  rendererPass: boolean;
  outputStatus: 'PASS' | 'FAIL' | 'NOT_VERIFIED';
  outputEvidence: string;
  browserE2E: CriterionRecord;
}

const TOOL_DEFS: ToolDef[] = [
  {
    toolType: 'dynamic-swot',
    displayName: 'Dynamic SWOT',
    archetype: 'quadrant-strategic-field',
    tier: 1,
    rendererPass: true,
    outputStatus: 'PASS',
    outputEvidence: EV_OUTPUT_SWOT,
    browserE2E: rec('NOT_VERIFIED', EV_BROWSER_E2E_SWOT),
  },
  {
    toolType: 'growth-paths',
    displayName: 'Growth Paths (Ansoff)',
    archetype: 'quadrant-strategic-field',
    tier: 2,
    rendererPass: true,
    outputStatus: 'FAIL',
    outputEvidence: EV_OUTPUT_GENERIC_EMPTY_PROVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
  {
    toolType: 'market-forces',
    displayName: 'Market Forces (Porter)',
    archetype: 'force-radial',
    tier: 2,
    rendererPass: true,
    outputStatus: 'FAIL',
    outputEvidence: EV_OUTPUT_GENERIC_EMPTY_PROVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_API_ONLY),
  },
  {
    toolType: 'portfolio-priority',
    displayName: 'Portfolio Prioritization',
    archetype: 'decision-matrix-portfolio',
    tier: 2,
    rendererPass: true,
    outputStatus: 'FAIL',
    outputEvidence: EV_OUTPUT_GENERIC_EMPTY_PROVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
  {
    toolType: 'value-chain',
    displayName: 'Value Chain Analysis',
    archetype: 'flow-value-stream',
    tier: 2,
    rendererPass: true,
    outputStatus: 'FAIL',
    outputEvidence: EV_OUTPUT_GENERIC_EMPTY_PROVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
  {
    toolType: 'a3-problem-solving',
    displayName: 'A3 Problem Solving',
    archetype: 'causal-problem-solving',
    tier: 2,
    rendererPass: true,
    outputStatus: 'FAIL',
    outputEvidence: EV_OUTPUT_GENERIC_EMPTY_PROVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
  {
    toolType: 'capability-mapper',
    displayName: 'Capability Mapper',
    archetype: 'architecture-capability',
    tier: 2,
    rendererPass: true,
    outputStatus: 'FAIL',
    outputEvidence: EV_OUTPUT_GENERIC_EMPTY_PROVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
  {
    toolType: 'sop-builder',
    displayName: 'SOP Builder',
    archetype: 'operating-model-standard',
    tier: 2,
    rendererPass: true,
    outputStatus: 'FAIL',
    outputEvidence: EV_OUTPUT_GENERIC_EMPTY_PROVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
  {
    toolType: 'ai-discovery',
    displayName: 'AI Discovery',
    archetype: 'discovery-candidate-funnel',
    tier: 2,
    rendererPass: false,
    outputStatus: 'FAIL',
    outputEvidence: EV_OUTPUT_GENERIC_EMPTY_PROVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
  {
    toolType: 'risk-uncertainty',
    displayName: 'Risk & Uncertainty',
    archetype: 'decision-matrix-portfolio',
    tier: 3,
    rendererPass: true,
    outputStatus: 'NOT_VERIFIED',
    outputEvidence: EV_OUTPUT_NOT_DRIVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_API_ONLY),
  },
  {
    toolType: 'ambition-decomposer',
    displayName: 'Ambition Decomposer',
    archetype: 'architecture-capability',
    tier: 3,
    rendererPass: true,
    outputStatus: 'NOT_VERIFIED',
    outputEvidence: EV_OUTPUT_NOT_DRIVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
  {
    toolType: 'focus-tradeoff',
    displayName: 'Focus & Trade-offs',
    archetype: 'decision-matrix-portfolio',
    tier: 3,
    rendererPass: true,
    outputStatus: 'NOT_VERIFIED',
    outputEvidence: EV_OUTPUT_NOT_DRIVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
  {
    toolType: 'narrative-engine',
    displayName: 'Narrative & Alignment',
    archetype: 'architecture-capability',
    tier: 3,
    rendererPass: true,
    outputStatus: 'NOT_VERIFIED',
    outputEvidence: EV_OUTPUT_NOT_DRIVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
  {
    toolType: 'smed-planner',
    displayName: 'SMED Planner',
    archetype: 'flow-value-stream',
    tier: 3,
    rendererPass: true,
    outputStatus: 'NOT_VERIFIED',
    outputEvidence: EV_OUTPUT_NOT_DRIVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
  {
    toolType: 'dms-builder',
    displayName: 'Daily Management System',
    archetype: 'operating-model-standard',
    tier: 3,
    rendererPass: true,
    outputStatus: 'NOT_VERIFIED',
    outputEvidence: EV_OUTPUT_NOT_DRIVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
  {
    toolType: 'inventory-autopilot',
    displayName: 'Inventory Autopilot',
    archetype: 'decision-matrix-portfolio',
    tier: 3,
    rendererPass: true,
    outputStatus: 'NOT_VERIFIED',
    outputEvidence: EV_OUTPUT_NOT_DRIVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
  {
    toolType: 'rpa-scanner',
    displayName: 'RPA Scanner',
    archetype: 'discovery-candidate-funnel',
    tier: 3,
    rendererPass: false,
    outputStatus: 'NOT_VERIFIED',
    outputEvidence: EV_OUTPUT_NOT_DRIVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
  {
    toolType: 'pain-explorer',
    displayName: 'Pain Explorer',
    archetype: 'causal-problem-solving',
    tier: 3,
    rendererPass: false,
    outputStatus: 'NOT_VERIFIED',
    outputEvidence: EV_OUTPUT_NOT_DRIVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
  {
    toolType: 'process-automation',
    displayName: 'Process Automation',
    archetype: 'flow-value-stream',
    tier: 3,
    rendererPass: true,
    outputStatus: 'NOT_VERIFIED',
    outputEvidence: EV_OUTPUT_NOT_DRIVEN,
    browserE2E: rec('FAIL', EV_BROWSER_E2E_NONE),
  },
];

export const ENGINE_BACKED_TOOL_TYPES: string[] = TOOL_DEFS.map((d) => d.toolType);

const DRIVEN_9 = new Set<string>([
  'dynamic-swot',
  'growth-paths',
  'market-forces',
  'portfolio-priority',
  'value-chain',
  'a3-problem-solving',
  'capability-mapper',
  'sop-builder',
  'ai-discovery',
]);

/** Ścieżki dowodowe wspólne dla wszystkich 19 — realne pliki w repo. */
const COMMON_EVIDENCE_REFS = [
  'docs/program/METHOD_TOOLS_2026-08-13/ROSTER_MATRIX.md',
  'src/toolPacks/__tests__/engineBindingCoverage.test.ts',
  'src/toolPacks/__tests__/registry.test.ts',
  'src/toolPacks/__tests__/validator.test.ts',
  'tests/acceptance/h32-19tools.e2e.test.ts',
  'docs/program/METHOD_TOOLS_2026-08-13/readiness/evidence/h3-h32.txt',
  'docs/program/METHOD_TOOLS_2026-08-13/readiness/evidence/h3-contract-tests.txt',
];

function buildRecord(def: ToolDef): ToolReadinessRecord {
  const gates: RuntimeReadinessManifest['gates'] = {
    sessionImplemented: 'PASS',
    persistenceVerified: 'PASS',
    reopenVerified: 'PASS',
    rendererImplemented: def.rendererPass ? 'PASS' : 'FAIL',
    outputImplemented: toGate(def.outputStatus),
    reportImplemented: 'FAIL',
    approvalVerified: DRIVEN_9.has(def.toolType) ? 'PASS' : 'NOT_RUN',
    initiativeHandoffVerified: DRIVEN_9.has(def.toolType) ? 'PASS' : 'NOT_RUN',
    automatedTestsPassed: DRIVEN_9.has(def.toolType) ? 'PASS' : 'NOT_RUN',
    manualAcceptancePassed: 'NOT_RUN',
  };

  const evidenceRefs = [...COMMON_EVIDENCE_REFS];
  if (DRIVEN_9.has(def.toolType)) {
    evidenceRefs.push(
      'tests/integration/tools-archetype-promote-characterization.realdb.test.ts',
      'docs/program/METHOD_TOOLS_2026-08-13/readiness/evidence/h3-archetype-promote.txt'
    );
  }
  if (def.toolType === 'dynamic-swot') {
    evidenceRefs.push(
      'tests/integration/tools-outputs-immutable.realdb.test.ts',
      'tests/integration/tls-007-swot-candidate-handoff.realdb.test.ts',
      'tests/acceptance/tls04-swot-proposal-lifecycle.e2e.test.ts',
      'tests/e2e/tools/swot-real-pg-resume.spec.ts',
      'docs/program/METHOD_TOOLS_2026-08-13/readiness/evidence/h3-swot-integ.txt',
      'docs/program/METHOD_TOOLS_2026-08-13/readiness/evidence/h3-tls04.txt'
    );
  }
  if (def.toolType === 'sop-builder' || def.toolType === 'capability-mapper') {
    evidenceRefs.push(
      'docs/program/METHOD_TOOLS_2026-08-13/readiness/evidence/h3-scratch-report-presentation.txt'
    );
  }

  const runtimeReadiness: RuntimeReadinessManifest = {
    ...emptyReadinessManifest(def.toolType, def.rendererPass),
    gates,
    lightMpq: null,
    darkMpq: null,
    hasSignatureSurface: def.rendererPass,
    evidenceLedgerRefs: evidenceRefs,
    verifiedAt: VERIFIED_AT,
    verifiedAgainstSha: CANDIDATE_SHA,
  };

  const verdict = evaluateRuntimeReadiness(runtimeReadiness, CANDIDATE_SHA);

  const criteria: ToolReadinessCriteria = {
    pack: rec(PASS, EV_PACK),
    engine: rec(PASS, EV_ENGINE),
    questionWorkflowMapping: rec(PASS, EV_QUESTION_WORKFLOW),
    persistence: rec(PASS, EV_PERSISTENCE),
    renderer: rec(def.rendererPass ? 'PASS' : 'FAIL', def.rendererPass ? EV_RENDERER_PASS : EV_RENDERER_FAIL),
    validationEvidence: rec(PASS, EV_VALIDATION),
    output: rec(def.outputStatus, def.outputEvidence),
    report: rec('FAIL', EV_REPORT_ALL),
    presentation: rec('FAIL', EV_PRESENTATION_ALL),
    initiative: rec(
      DRIVEN_9.has(def.toolType) ? 'PASS' : 'NOT_VERIFIED',
      DRIVEN_9.has(def.toolType) ? EV_INITIATIVE_PASS : EV_INITIATIVE_NOT_DRIVEN
    ),
    approval: rec(
      DRIVEN_9.has(def.toolType) ? 'PASS' : 'NOT_VERIFIED',
      DRIVEN_9.has(def.toolType) ? EV_APPROVAL_PASS : EV_APPROVAL_NOT_DRIVEN
    ),
    browserE2E: def.browserE2E,
    restartReopen: rec(PASS, EV_RESTART_REOPEN),
    lightMpq: rec('NOT_VERIFIED', EV_LIGHT_MPQ),
    darkMpq: rec('NOT_VERIFIED', EV_DARK_MPQ),
    evidenceLedger: rec(PASS, EV_EVIDENCE_LEDGER),
  };

  return {
    toolType: def.toolType,
    displayName: def.displayName,
    signatureArchetype: def.archetype,
    tier: def.tier,
    candidateSha: CANDIDATE_SHA,
    verifiedAt: VERIFIED_AT,
    criteria,
    runtimeReadiness,
    recordedVerdict: { publishable: verdict.publishable, failureCount: verdict.failures.length },
  };
}

function toGate(status: 'PASS' | 'FAIL' | 'NOT_VERIFIED'): ReadinessGate {
  if (status === 'PASS') return 'PASS';
  if (status === 'FAIL') return 'FAIL';
  return 'NOT_RUN';
}

export const TOOL_READINESS_MANIFESTS: Record<string, ToolReadinessRecord> = Object.fromEntries(
  TOOL_DEFS.map((def) => [def.toolType, buildRecord(def)])
);

export function getToolReadinessRecord(toolType: string): ToolReadinessRecord | undefined {
  return TOOL_READINESS_MANIFESTS[toolType];
}

export function listToolReadinessRecords(): ToolReadinessRecord[] {
  return ENGINE_BACKED_TOOL_TYPES.map((t) => TOOL_READINESS_MANIFESTS[t]);
}
