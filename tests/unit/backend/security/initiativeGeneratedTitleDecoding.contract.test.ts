import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { decodeHtmlEntities } from '../../../../server/src/utils/htmlEntities';

type ProducerContract = {
  path: string;
  decodedVariable: 'decodedTitle' | 'decodedName';
  minimumUses: number;
};

const PRODUCERS: ProducerContract[] = [
  {
    path: 'server/src/services/ToolInitiativeService.ts',
    decodedVariable: 'decodedTitle',
    minimumUses: 4,
  },
  {
    path: 'server/src/services/aiActionExecutor.ts',
    decodedVariable: 'decodedName',
    minimumUses: 4,
  },
  {
    path: 'server/src/services/artifacts/ArtifactConversionService.ts',
    decodedVariable: 'decodedTitle',
    minimumUses: 5,
  },
  {
    path: 'server/src/services/assessmentInitiativeService.ts',
    decodedVariable: 'decodedTitle',
    minimumUses: 4,
  },
  {
    path: 'server/src/services/cqrs/initiative/CreateInitiative.ts',
    decodedVariable: 'decodedTitle',
    minimumUses: 3,
  },
  {
    path: 'server/src/services/initiative/InitiativeDefinitionService.ts',
    decodedVariable: 'decodedTitle',
    minimumUses: 4,
  },
  {
    path: 'server/src/services/notebookConversionService.ts',
    decodedVariable: 'decodedTitle',
    minimumUses: 4,
  },
  {
    path: 'server/src/services/reportImportService.ts',
    decodedVariable: 'decodedTitle',
    minimumUses: 4,
  },
  {
    path: 'server/src/services/reportInitiativeService.ts',
    decodedVariable: 'decodedTitle',
    minimumUses: 3,
  },
];

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('generated initiative title entity-integrity boundary', () => {
  it('reverses single and repeated input-sanitizer escaping before persistence', () => {
    expect(decodeHtmlEntities('Growth &amp; Efficiency')).toBe('Growth & Efficiency');
    expect(decodeHtmlEntities('Customer&#x27;s &quot;North Star&quot;')).toBe(
      `Customer's "North Star"`
    );
    expect(decodeHtmlEntities('R&amp;amp;D &amp; Operations')).toBe('R&D & Operations');
  });

  it.each(PRODUCERS)(
    '$path decodes once and reuses the decoded value across funnel and raw persistence',
    ({ path, decodedVariable, minimumUses }) => {
      const code = source(path);
      const declarations = code.match(
        new RegExp(`const\\s+${decodedVariable}\\s*=([\\s\\S]{0,240})decodeHtmlEntities|const\\s+${decodedVariable}\\s*=\\s*decodeHtmlEntities`, 'g')
      );
      const uses = code.match(new RegExp(`\\b${decodedVariable}\\b`, 'g')) ?? [];

      expect(code).toContain("utils/htmlEntities.js");
      expect(declarations, `${path} must decode at the producer boundary exactly once`).toHaveLength(1);
      expect(uses.length, `${path} must reuse the decoded value for every output path`).toBeGreaterThanOrEqual(
        minimumUses
      );
    }
  );

  it('does not resurrect the retired Finance direct-to-initiative write path', () => {
    const valuation = source('server/src/services/valuationService.ts');
    const conversion = valuation.slice(
      valuation.indexOf('export async function convertAdvisoryRecommendationToInitiative')
    );

    expect(conversion).toContain('confirmValuationRecommendationCandidateHandoff');
    expect(conversion).not.toContain('INSERT INTO initiatives');
    expect(conversion).not.toContain('funnelCreateInitiative');
  });
});
