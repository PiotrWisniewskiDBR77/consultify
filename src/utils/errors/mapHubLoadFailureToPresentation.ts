type HubLoadFailureLike = {
  data?: {
    code?: unknown;
  };
};

const CODE_MESSAGE_MAP: Record<string, string> = {
  RESULTS_KPI_CATALOG_UNAVAILABLE: 'Failed to load KPI catalog.',
  EXECUTION_INITIATIVES_READ_FAILED: 'Failed to load execution initiatives.',
};

function resolveSafeCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const normalized = input.trim();
  return normalized ? normalized : null;
}

export function mapHubLoadFailureToPresentation(
  error: unknown,
  fallbackMessage: string
): { message: string; code: string | null } {
  const failure = (error || {}) as HubLoadFailureLike;
  const code = resolveSafeCode(failure?.data?.code);
  if (code && CODE_MESSAGE_MAP[code]) {
    return { message: CODE_MESSAGE_MAP[code], code };
  }
  return { message: fallbackMessage, code };
}

