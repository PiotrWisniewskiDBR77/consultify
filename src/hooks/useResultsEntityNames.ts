import { useCallback, useMemo } from 'react';

export type ResultsEntityNameResolver = (entityId: string) => string | null;
type RawEntity = object;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function readResultsEntityId(entity: RawEntity): string {
  const value = entity as Record<string, unknown>;
  return (
    text(value.objectiveId) ||
    text(value.objective_id) ||
    text(value.setId) ||
    text(value.set_id) ||
    text(value.programId) ||
    text(value.program_id) ||
    text(value.organizationId) ||
    text(value.organization_id) ||
    text(value.id)
  );
}

export function readResultsEntityName(entity: RawEntity): string | null {
  const value = entity as Record<string, unknown>;
  return text(value.name) || text(value.title) || text(value.label) || null;
}

export function buildResultsEntityNameMap(
  entities: ReadonlyArray<RawEntity> | null | undefined
): Record<string, string> {
  const map: Record<string, string> = {};
  (entities ?? []).forEach((entity) => {
    if (!entity || typeof entity !== 'object') return;
    const id = readResultsEntityId(entity);
    const name = readResultsEntityName(entity);
    if (id && name) map[id] = name;
  });
  return map;
}

export function resultsEntityNameOrUnknown(
  resolver: ResultsEntityNameResolver | null | undefined,
  entityId: string | null | undefined,
  isPolish: boolean,
  kind: 'scope' | 'program' | 'indicator' = 'scope'
): string {
  const id = text(entityId);
  if (!id) return '—';
  const resolved = resolver?.(id);
  if (resolved) return resolved;
  const fallback = {
    scope: { pl: 'Nieznany cel', en: 'Unknown target' },
    program: { pl: 'Nieznany program', en: 'Unknown program' },
    indicator: { pl: 'Nieznany wskaźnik', en: 'Unknown indicator' },
  } as const;
  return fallback[kind][isPolish ? 'pl' : 'en'];
}

export function useResultsEntityNames(
  entities: ReadonlyArray<RawEntity> | null | undefined
): ResultsEntityNameResolver {
  const names = useMemo(() => buildResultsEntityNameMap(entities), [entities]);
  return useCallback((entityId: string) => names[entityId] || null, [names]);
}
