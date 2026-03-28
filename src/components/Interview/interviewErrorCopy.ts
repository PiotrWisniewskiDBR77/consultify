export function isSafeInterviewUserMessage(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.length > 180) return false;
  if (/[{}[\]<>]/.test(normalized)) return false;
  if (
    /(stack|exception|trace|axios|sql|select\s|insert\s|update\s|delete\s|syntaxerror)/i.test(
      normalized
    )
  ) {
    return false;
  }
  return true;
}

export function getSafeInterviewErrorMessage(error: any, defaultMessage: string): string {
  const candidates = [
    typeof error === 'string' ? error : null,
    typeof error?.response?.data?.error === 'string' ? error.response.data.error : null,
    typeof error?.message === 'string' ? error.message : null,
    typeof error?.error === 'string' ? error.error : null,
  ];

  const safeCandidate = candidates.find((candidate) =>
    candidate ? isSafeInterviewUserMessage(candidate) : false
  );

  return safeCandidate || defaultMessage;
}
