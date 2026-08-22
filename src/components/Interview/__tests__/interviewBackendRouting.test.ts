import { describe, expect, it, vi } from 'vitest';

import {
  INTERVIEW_BACKEND_SELECTION,
  InterviewCapabilityError,
  loadInterviewV8Capability,
} from '../interviewBackendRouting';

describe('Interview backend selection contract', () => {
  it('keeps authoring on legacy, capabilities on V8, and public respondent on V4', () => {
    expect(INTERVIEW_BACKEND_SELECTION).toEqual({
      authoring: 'legacy-authoring',
      assignments: 'v8',
      insights: 'v8',
      publicRespondent: 'public-v4',
    });
  });

  it('returns a typed unavailable error and never invokes a hidden fallback', async () => {
    const v8Loader = vi.fn().mockRejectedValue({ status: 503 });
    const legacyFallback = vi.fn();

    await expect(loadInterviewV8Capability('insights', v8Loader)).rejects.toMatchObject({
      name: 'InterviewCapabilityError',
      capability: 'insights',
      kind: 'unavailable',
      status: 503,
    } satisfies Partial<InterviewCapabilityError>);
    expect(v8Loader).toHaveBeenCalledOnce();
    expect(legacyFallback).not.toHaveBeenCalled();
  });

  it('classifies permission denial separately from capability availability', async () => {
    await expect(
      loadInterviewV8Capability('assignments', async () => {
        throw { response: { status: 403 } };
      })
    ).rejects.toMatchObject({ kind: 'forbidden', status: 403 });
  });

  it('fails evaluation closed on provider unavailability without a compatibility retry', async () => {
    const canonicalEvaluation = vi.fn().mockRejectedValue({ status: 503 });
    const compatibilityEvaluation = vi.fn();

    await expect(
      loadInterviewV8Capability('evaluation', canonicalEvaluation)
    ).rejects.toMatchObject({ capability: 'evaluation', kind: 'unavailable', status: 503 });
    expect(canonicalEvaluation).toHaveBeenCalledOnce();
    expect(compatibilityEvaluation).not.toHaveBeenCalled();
  });
});
