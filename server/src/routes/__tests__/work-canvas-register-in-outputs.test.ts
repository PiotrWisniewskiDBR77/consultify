import { describe, expect, it } from 'vitest';

import {
  ArtifactFamilyValues,
  ArtifactOriginRuntimeValues,
  RegisterArtifactOriginParamsSchema,
} from '../../types/artifactRegistry';

/**
 * Regression for M-5 (POST /work-canvas/drafts/:draftId/register-in-outputs).
 *
 * The endpoint used to pass originRuntime/artifactFamily 'work_canvas' (cast
 * with `as any`), which RegisterArtifactOriginParamsSchema rejects — so every
 * call threw ZodError inside registerArtifactOrigin and the endpoint returned
 * 500. It now registers under the DocumentStudio/doc-runtime convention:
 * outputType 'report' + family 'document' + runtime 'native_artifact', with
 * canvas provenance in originSummary. This mirrors the exact params literal
 * built in work-canvas.routes.ts (register-in-outputs handler).
 */
describe('work-canvas register-in-outputs registry params', () => {
  const endpointParams = {
    organizationId: 'org_1',
    outputType: 'report' as const,
    artifactFamily: 'document' as const,
    originRuntime: 'native_artifact' as const,
    originRecordId: 'draft_abc123',
    titleSnapshot: 'Canvas output',
    ownerUserId: 'user_1',
    createdBy: 'user_1',
    visibilityScope: undefined,
    projectId: null,
    originSummary: {
      sourceType: 'work_canvas',
      sourceTable: 'work_canvas_drafts',
      contentMdLength: 1234,
    },
  };

  it('passes RegisterArtifactOriginParamsSchema.parse', () => {
    const parsed = RegisterArtifactOriginParamsSchema.parse(endpointParams);
    expect(parsed.artifactFamily).toBe('document');
    expect(parsed.originRuntime).toBe('native_artifact');
    expect(parsed.visibilityScope).toBe('organization'); // schema default
    expect(parsed.originSummary).toEqual(endpointParams.originSummary);
  });

  it('uses enum members that are valid registry values', () => {
    expect(ArtifactFamilyValues).toContain(endpointParams.artifactFamily);
    expect(ArtifactOriginRuntimeValues).toContain(endpointParams.originRuntime);
  });

  it("rejects the old 'work_canvas' runtime/family (the bug this guards against)", () => {
    expect(() =>
      RegisterArtifactOriginParamsSchema.parse({
        ...endpointParams,
        artifactFamily: 'work_canvas',
        originRuntime: 'work_canvas',
      })
    ).toThrow();
  });
});
