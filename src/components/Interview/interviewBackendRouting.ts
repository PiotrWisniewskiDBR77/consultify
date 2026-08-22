export const INTERVIEW_BACKEND_SELECTION = {
  authoring: 'legacy-authoring',
  assignments: 'v8',
  insights: 'v8',
  publicRespondent: 'public-v4',
} as const;

export type InterviewV8Capability = 'assignments' | 'insights' | 'evaluation';
export type InterviewCapabilityFailureKind = 'forbidden' | 'unavailable' | 'request_failed';

export class InterviewCapabilityError extends Error {
  readonly capability: InterviewV8Capability;
  readonly kind: InterviewCapabilityFailureKind;
  readonly status?: number;

  constructor(
    capability: InterviewV8Capability,
    kind: InterviewCapabilityFailureKind,
    status: number | undefined,
    cause: unknown
  ) {
    super(`Interview ${capability} capability failed (${kind})`, { cause });
    this.name = 'InterviewCapabilityError';
    this.capability = capability;
    this.kind = kind;
    this.status = status;
  }
}

const readStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { status?: unknown; response?: { status?: unknown } };
  if (typeof candidate.status === 'number') return candidate.status;
  return typeof candidate.response?.status === 'number' ? candidate.response.status : undefined;
};

export const classifyInterviewV8Failure = (
  capability: InterviewV8Capability,
  error: unknown
): InterviewCapabilityError => {
  if (error instanceof InterviewCapabilityError) return error;
  const status = readStatus(error);
  const kind: InterviewCapabilityFailureKind =
    status === 401 || status === 403
      ? 'forbidden'
      : status === 404 || status === 501 || status === 503
        ? 'unavailable'
        : 'request_failed';
  return new InterviewCapabilityError(capability, kind, status, error);
};

/**
 * V8 capability reads are deliberately fail-closed. In particular, this helper
 * must never probe a legacy endpoint after a V8 failure: the caller gets a
 * typed error and can render an honest capability state.
 */
export const loadInterviewV8Capability = async <T>(
  capability: InterviewV8Capability,
  loader: () => Promise<T>
): Promise<T> => {
  try {
    return await loader();
  } catch (error) {
    throw classifyInterviewV8Failure(capability, error);
  }
};

export const isInterviewCapabilityForbidden = (error: unknown): boolean =>
  error instanceof InterviewCapabilityError && error.kind === 'forbidden';
