/* eslint-disable */
/**
 * Generator fikstury dla harnessu dev-render „F2-1 Analiza portfela".
 *
 * NIE wymysla danych: buduje migawke portfela, przepuszcza ja przez PRODUKCYJNA
 * deterministyczna brame modelu (`DeterministicPortfolioConsultingModelGateway`)
 * i przez PRODUKCYJNY walidator domeny (`parsePortfolioAnalysisItems`), a dopiero
 * wynik zapisuje do `dev-render/mocks/f2PortfolioAnalysisFixture.json`.
 * Dzieki temu to, co widac na zrzucie, jest tym, co zwraca serwer — a nie
 * recznie napisanym obrazkiem (nauczka „Przyrzad pokazuje nie produkt").
 *
 * Uruchomienie: npx tsx scripts/dev/f2-analiza-portfela-fikstura.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const { DeterministicPortfolioConsultingModelGateway } = await import(
  resolve(root, 'server/src/services/initiative/deterministicPortfolioConsultingModelGateway.ts')
);
const { parsePortfolioAnalysisItems } = await import(
  resolve(root, 'server/src/domain/initiatives-execution/portfolioConsultingAnalysis.ts')
);

const INITIATIVES = [
  { name: 'Warehouse picking automation', priority: 'HIGH', status: 'PROPOSED', area: 'Operations' },
  { name: 'Second warehouse robotics pilot', priority: 'HIGH', status: 'PROPOSED', area: 'Operations' },
  { name: 'Supplier quality scorecard', priority: 'MEDIUM', status: 'PROPOSED', area: 'Procurement' },
  { name: 'Shift planning rework', priority: 'MEDIUM', status: 'PROPOSED', area: 'People' },
  { name: 'Energy metering rollout', priority: 'LOW', status: 'PROPOSED', area: 'Maintenance' },
];

const asOf = '2026-09-14T00:00:00.000Z';
const snapshot = {
  snapshotVersion: 1,
  organizationId: 'org-harness',
  asOf,
  source: { system: 'initiativeUnifiedReader', version: '1', capturedAt: asOf },
  portfolio: {
    scenarioId: 'scenario-published-1',
    aggregateVersion: 4,
    scenarioVersion: 2,
    facts: { name: 'Operations portfolio 2026', asOf },
  },
  initiatives: INITIATIVES.map((facts, index) => ({
    initiativeId: `initiative-${index + 1}`,
    initiativeVersion: 1,
    projectId: 'project-1',
    source: 'CANONICAL',
    facts,
    evidenceRefs: [`initiative:initiative-${index + 1}:1`],
  })),
  decisionHistory: [
    {
      decisionId: 'decision-historic-1',
      version: 2,
      initiativeId: 'initiative-2',
      sourceRef: 'decision:decision-historic-1:2',
      facts: {
        outcome: 'REJECTED',
        disposition: 'PARKING',
        reason: 'Robotics pilot was parked while the first automation wave was still running.',
        returnCondition: 'Returns when the first automation wave closes its acceptance.',
      },
    },
  ],
  runningWork: [
    {
      aggregateType: 'execution_case',
      aggregateId: 'case-1',
      version: 3,
      sourceRef: 'execution_case:case-1:3',
      facts: { name: 'Automation wave 1', state: 'ACTIVE' },
    },
  ],
  organizationContext: {
    snapshotId: 'ctx-harness-1',
    version: 3,
    contentHash: 'harness-content-hash',
    facts: { industry: 'Manufacturing' },
  },
};

const { provenance, output } = await new DeterministicPortfolioConsultingModelGateway().analyze({
  rubricVersion: 'portfolio-consulting-v1',
  requestDigest: 'harness-digest',
  snapshot,
});
const items = parsePortfolioAnalysisItems(output, snapshot);

const fixture = {
  scenarios: [
    {
      id: 'scenario-published-1',
      name: 'Operations portfolio 2026',
      state: 'PUBLISHED',
      version: 2,
      scope: { portfolioId: 'project-1', asOf },
      updatedAt: asOf,
    },
  ],
  contextVersions: [
    {
      snapshotId: 'ctx-harness-1',
      version: 3,
      schemaVersion: 1,
      contentHash: 'harness-content-hash',
      claimCount: 42,
      createdAt: asOf,
    },
  ],
  analysis: {
    analysisId: 'analysis-harness-1',
    aggregateVersion: 2,
    status: 'PENDING_REVIEW',
    rubricVersion: 'portfolio-consulting-v1',
    requestDigest: 'harness-digest',
    snapshot,
    model: provenance,
    items,
    requestedBy: 'user-harness',
  },
};

const out = resolve(root, 'dev-render/mocks/f2PortfolioAnalysisFixture.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(
  `fikstura zapisana: ${out} — ${items.length} pozycji (${items.filter((i) => i.kind === 'DECISION').length} decyzji)`
);
