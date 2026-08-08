import { get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const EXPLICIT_CANONICAL_KEYS = new Set([
  'canonicalrunid', 'canonicalrun', 'canonicalrunref', 'agentcanonicalrunid',
  'transformationcaseid', 'transformationcase', 'transformationcaseref',
  'executionrunid', 'canonicalexecutionrunid',
]);
const RUN_KEYS = new Set(['runid', 'playbookid']);

function normalizeIdentityKey(key: string): string {
  return key.toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, '');
}

function valuesFor(input: unknown, keys: ReadonlySet<string>, depth = 0, seen = new WeakSet<object>()): string[] {
  if (!input || typeof input !== 'object' || depth > 5 || seen.has(input)) return [];
  seen.add(input);
  if (Array.isArray(input)) {
    return input.flatMap((value) => valuesFor(value, keys, depth + 1, seen));
  }
  const record = input as Record<string, unknown>;
  return [
    ...Object.entries(record)
      .filter(([key]) => keys.has(normalizeIdentityKey(key)))
      .map(([, value]) => String(value ?? '').trim())
      .filter(Boolean),
    ...Object.values(record).flatMap((value) => valuesFor(value, keys, depth + 1, seen)),
  ];
}

export async function assertLegacyNoncanonicalExecution(input: {
  entrypoint: 'playbook_executor' | 'action_execution_adapter' | 'async_job_service' | 'async_job_processor' | 'ai_playbook_executor';
  organizationId?: string | null;
  entityId?: string | null;
  payloads: unknown[];
}): Promise<{ classification: 'legacy_noncanonical' }> {
  const explicit = input.payloads.flatMap((payload) => valuesFor(payload, EXPLICIT_CANONICAL_KEYS));
  if (explicit.length > 0) throw new Error('legacy_noncanonical_canonical_identity_forbidden');

  const candidates = Array.from(new Set([
    String(input.entityId ?? '').trim(),
    ...input.payloads.flatMap((payload) => valuesFor(payload, RUN_KEYS)),
  ].filter(Boolean)));
  if (candidates.length > 0 && input.organizationId) {
    const placeholders = candidates.map(() => '?').join(',');
    try {
      const identity = await dbGet<{ canonical_run_id: string }>(
        `SELECT canonical_run_id FROM v8_agent_run_identities
          WHERE organization_id = ? AND canonical_run_id IN (${placeholders}) LIMIT 1`,
        [input.organizationId, ...candidates]
      );
      if (identity) throw new Error('legacy_noncanonical_canonical_identity_forbidden');
    } catch (error) {
      if (error instanceof Error && error.message === 'legacy_noncanonical_canonical_identity_forbidden') throw error;
      const code = String((error as { code?: unknown })?.code ?? '');
      const message = error instanceof Error ? error.message : String(error);
      const identityStoreMissing = code === '42P01' || /no such table:\s*v8_agent_run_identities/i.test(message);
      if (!identityStoreMissing) throw new Error('legacy_noncanonical_identity_check_failed', { cause: error });
      // A deployment without the canonical identity table is, by definition, legacy-only.
    }
  }
  logger.info('[LegacyExecution] classified legacy_noncanonical', {
    entrypoint: input.entrypoint,
    organizationId: input.organizationId ?? null,
    entityId: input.entityId ?? null,
  });
  return { classification: 'legacy_noncanonical' };
}
