import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  resolveFinanceWorkspace,
  type FinanceArtifactTypeId,
  type FinanceResolveResult,
  type FinanceWorkspaceId,
} from '../financeWorkspaceResolver';

const mappings: [FinanceArtifactTypeId, FinanceWorkspaceId][] = [
  ['STATEMENT_PACK', 'statementPackV2'],
  ['BASELINE_MODEL', 'baseline'],
  ['HISTORICAL_ANALYSIS', 'analysis'],
  ['PREDICTION_SCENARIO', 'prediction'],
  ['VALUATION_CASE', 'valuation'],
];

const idCases = [
  ['complete', 'artifact-1', 'version-1'],
  ['missing artifactId', '', 'version-1'],
  ['missing businessVersionId', 'artifact-1', ''],
  ['both missing', '', ''],
  ['ID collision', 'same-id', 'same-id'],
] as const;

const cases: {
  name: string;
  artifactType: FinanceArtifactTypeId;
  artifactId: string;
  businessVersionId: string;
  expected: FinanceResolveResult;
}[] = [];

for (const [artifactType, workspace] of mappings) {
  for (const flag of ['OFF', 'ON'] as const) {
    for (const [idCase, artifactId, businessVersionId] of idCases) {
      const expected: FinanceResolveResult = !artifactId
        ? { kind: 'error', reason: 'MISSING_ARTIFACT_ID' }
        : !businessVersionId
          ? { kind: 'error', reason: 'MISSING_BUSINESS_VERSION_ID' }
          : artifactId === businessVersionId
            ? { kind: 'error', reason: 'ID_COLLISION' }
            : { kind: 'workspace', workspace, artifactId, businessVersionId, artifactType };
      cases.push({
        name: `${artifactType} flag=${flag} IDs=${idCase}`,
        artifactType,
        artifactId,
        businessVersionId,
        expected,
      });
    }
  }
}

describe('resolveFinanceWorkspace deterministic table', () => {
  it.each(cases)('$name', ({ artifactType, artifactId, businessVersionId, expected }) => {
    expect(resolveFinanceWorkspace({ artifactType, artifactId, businessVersionId })).toEqual(
      expected
    );
  });

  it.each([null, '', 'BUDGET'] as const)('rejects unknown artifact type %s', (artifactType) => {
    expect(
      resolveFinanceWorkspace({
        artifactType,
        artifactId: 'artifact-1',
        businessVersionId: 'version-1',
      })
    ).toEqual({ kind: 'error', reason: 'UNKNOWN_ARTIFACT_TYPE' });
  });

  it('contains no path to a Benefits workspace', () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, '../financeWorkspaceResolver.ts'),
      'utf8'
    );
    for (const forbidden of [
      'Benefits',
      'BudgetWorkspace',
      'FinancialAnalysisWorkspace',
      'ValuationWorkspace',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
