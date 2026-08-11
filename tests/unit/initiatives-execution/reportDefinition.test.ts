import { describe, expect, it } from 'vitest';
import { publishedReportDefinitionVersion } from '../../../server/src/domain/initiatives-execution/reportDefinition';

describe('Report Definition published truth', () => {
  it('resolves only the exact PUBLISHED business version', () => {
    const definition: any = {
      currentVersion: 2,
      versions: [
        { definitionVersion: 1, state: 'SUPERSEDED' },
        { definitionVersion: 2, state: 'PUBLISHED' },
      ],
    };
    expect(publishedReportDefinitionVersion(definition, 1)).toBeNull();
    expect(publishedReportDefinitionVersion(definition, 2)).toMatchObject({ state: 'PUBLISHED' });
    expect(publishedReportDefinitionVersion(definition, 3)).toBeNull();
  });
});
