import type { QueryClient } from '@tanstack/react-query';

const QUERY_ERROR_PREFIX = 'consultify:rq-error';
const MUTATION_ERROR_PREFIX = 'consultify:mt-error';
const MAX_KEY_FINGERPRINT_LENGTH = 80;

function toKeyFingerprint(input: unknown): string {
  try {
    const serialized = JSON.stringify(input ?? 'unknown');
    return serialized
      .slice(0, MAX_KEY_FINGERPRINT_LENGTH)
      .replace(/[^a-zA-Z0-9:/?&=._-]/g, '_');
  } catch {
    return 'unknown';
  }
}

function markSafe(name: string): void {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') {
    return;
  }
  try {
    performance.mark(name);
  } catch {
    // Keep telemetry path fail-soft.
  }
}

export function installQueryFailureWebPerf(client: QueryClient): () => void {
  const seenQueryErrors = new Set<string>();
  const seenMutationErrors = new Set<string>();

  const queryUnsubscribe = client.getQueryCache().subscribe((event) => {
    if (!event || event.type !== 'updated') return;
    const query = event.query;
    if (!query) return;
    if (query.state.status !== 'error' || query.state.fetchStatus !== 'idle') return;

    const signature = `${query.queryHash}:${query.state.errorUpdatedAt}`;
    if (seenQueryErrors.has(signature)) return;
    seenQueryErrors.add(signature);
    const key = toKeyFingerprint(query.queryKey);
    markSafe(`${QUERY_ERROR_PREFIX}:${key}`);
  });

  const mutationUnsubscribe = client.getMutationCache().subscribe((event) => {
    if (!event || event.type !== 'updated') return;
    const mutation = event.mutation;
    if (!mutation) return;
    if (mutation.state.status !== 'error') return;

    const keyBase =
      mutation.options.mutationKey && mutation.options.mutationKey.length
        ? mutation.options.mutationKey
        : ['anonymous'];
    const signature = `${toKeyFingerprint(keyBase)}:${mutation.state.submittedAt}`;
    if (seenMutationErrors.has(signature)) return;
    seenMutationErrors.add(signature);

    const key = toKeyFingerprint(keyBase);
    markSafe(`${MUTATION_ERROR_PREFIX}:${key}`);
  });

  return () => {
    queryUnsubscribe();
    mutationUnsubscribe();
  };
}

