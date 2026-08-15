export interface AssumptionCaveat {
  key: string;
  status: string;
  note?: string;
}

const STATUS_SUFFIX = 'AssumptionStatus';
const NOTE_SUFFIX = 'AssumptionNote';

/**
 * Extracts explicit caveats persisted alongside Finance model assumptions.
 * This is deliberately a read-only projection: it neither validates nor
 * resolves an assumption, and malformed inputs cannot fabricate a caveat.
 */
export function extractAssumptionCaveats(
  assumptions: Record<string, unknown> | null | undefined
): AssumptionCaveat[] {
  if (!assumptions || typeof assumptions !== 'object') return [];

  const caveats: AssumptionCaveat[] = [];
  for (const [field, value] of Object.entries(assumptions)) {
    if (!field.endsWith(STATUS_SUFFIX) || typeof value !== 'string' || value.length === 0) {
      continue;
    }
    const key = field.slice(0, -STATUS_SUFFIX.length);
    const note = assumptions[`${key}${NOTE_SUFFIX}`];
    caveats.push({
      key,
      status: value,
      note: typeof note === 'string' ? note : undefined,
    });
  }

  return caveats.sort((left, right) => left.key.localeCompare(right.key));
}
