export function normalizeExecutionArrayEnvelope<T>(
  value: unknown,
  keys: string[]
): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key] as T[];
    }
  }

  const nestedData = record.data;
  if (Array.isArray(nestedData)) return nestedData as T[];
  if (!nestedData || typeof nestedData !== 'object') return [];

  const nestedRecord = nestedData as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(nestedRecord[key])) {
      return nestedRecord[key] as T[];
    }
  }

  return [];
}
