import { describe, expect, it } from 'vitest';

import {
  ARTIFACT_TYPE_MAPPING_INVALID,
  mapCanonicalArtifactType,
  mapExplicitArtifactRunType,
} from '../v8/artifactTypeMapper.js';

describe('canonical Artifact Run type mapping', () => {
  it.each([
    [
      'document',
      'report',
      'report',
      ['report', 'native_artifact', 'assessment_report', 'work_canvas'],
    ],
    ['presentation', 'presentation', 'presentation', ['presentation']],
    ['sheet', 'sheet', 'sheet', ['sheet']],
    ['template', 'report', 'report', ['report_template', 'document_template']],
    ['template', 'presentation', 'presentation', ['presentation_template']],
    ['template', 'sheet', 'sheet', ['sheet_template']],
  ] as const)(
    'maps %s/%s to publish type and allowed origins',
    (artifactFamily, outputType, publishArtifactType, allowedOriginRuntimes) => {
      expect(mapCanonicalArtifactType({ artifactFamily, outputType })).toEqual({
        artifactFamily,
        outputType,
        publishArtifactType,
        allowedOriginRuntimes,
      });
    }
  );

  it.each([
    ['document', 'presentation'],
    ['document', 'sheet'],
    ['presentation', 'report'],
    ['presentation', 'sheet'],
    ['sheet', 'report'],
    ['sheet', 'presentation'],
  ] as const)('rejects contradictory pair %s/%s', (artifactFamily, outputType) => {
    expect(() => mapCanonicalArtifactType({ artifactFamily, outputType })).toThrowError(
      expect.objectContaining({ statusCode: 400, code: ARTIFACT_TYPE_MAPPING_INVALID })
    );
  });

  it('requires explicit template output while allowing every explicit template subtype', () => {
    expect(() => mapExplicitArtifactRunType({ artifactFamily: 'template' })).toThrowError(
      expect.objectContaining({ statusCode: 400, code: ARTIFACT_TYPE_MAPPING_INVALID })
    );
    expect(
      mapExplicitArtifactRunType({ artifactFamily: 'template', outputType: 'report' })?.outputType
    ).toBe('report');
    expect(
      mapExplicitArtifactRunType({ artifactFamily: 'template', outputType: 'presentation' })
        ?.outputType
    ).toBe('presentation');
    expect(
      mapExplicitArtifactRunType({ artifactFamily: 'template', outputType: 'sheet' })?.outputType
    ).toBe('sheet');
  });

  it.each(['finance_output', 'results_artifact'])(
    'does not map publish extension %s into an Artifact Run family',
    (artifactFamily) => {
      expect(() =>
        mapCanonicalArtifactType({ artifactFamily: artifactFamily as any, outputType: 'report' })
      ).toThrowError(expect.objectContaining({ code: ARTIFACT_TYPE_MAPPING_INVALID }));
    }
  );
});
