/** Only transport failures are retryable. Projection and contract defects must
 * surface immediately instead of being mislabeled as a network outage. */
export const isInitiativesNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return /failed to fetch|networkerror|network request failed|load failed/i.test(error.message);
};

export const initiativeLoadErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as {
    code?: unknown;
    data?: { code?: unknown };
  };
  if (typeof candidate.data?.code === 'string' && candidate.data.code.trim()) {
    return candidate.data.code.trim();
  }
  if (typeof candidate.code === 'string' && candidate.code.trim()) {
    return candidate.code.trim();
  }
  return isInitiativesNetworkError(error) ? 'NETWORK_ERROR' : 'INITIATIVE_DATA_CONTRACT_ERROR';
};
