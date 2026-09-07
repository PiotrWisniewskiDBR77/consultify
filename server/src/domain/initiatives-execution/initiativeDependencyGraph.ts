/**
 * REGUŁA GRAFU ZALEŻNOŚCI INICJATYW (P15-K3, DEC-421, §4.7 D3').
 *
 * Czysta funkcja — bez bazy, bez Expressa. Zapis „A idzie po B" jest odrzucany,
 * zanim dotknie tabeli `initiative_dependencies`, jeżeli domknąłby cykl:
 * `validatePlanScenario` i tak przewróciłby wtedy KAŻDY kolejny zapis planu
 * (reguła „Plan dependency cycle detected"), a użytkownik nie dowiedziałby się,
 * która krawędź to zrobiła.
 *
 * Orientacja krawędzi jest ta sama, co w tabeli i w `dependencySnapshot` okna:
 * klucz mapy = inicjatywa, która idzie PO; wartości = jej poprzednicy.
 */

export const INITIATIVE_DEPENDENCY_CYCLE_RULE = 'INITIATIVE_DEPENDENCY_CYCLE';

/**
 * Zwraca ścieżkę cyklu (od powtórzonego wierzchołka do niego samego), albo
 * `null`, gdy graf jest acykliczny. Krawędzie do inicjatyw spoza mapy są
 * pomijane — brak poprzednika nie jest cyklem.
 */
export function findInitiativeDependencyCycle(
  edges: Map<string, string[]>
): string[] | null {
  const visiting = new Set<string>();
  const done = new Set<string>();
  const walk = (id: string, path: string[]): string[] | null => {
    if (visiting.has(id)) return [...path.slice(path.indexOf(id)), id];
    if (done.has(id)) return null;
    visiting.add(id);
    for (const predecessor of edges.get(id) ?? []) {
      const cycle = walk(predecessor, [...path, id]);
      if (cycle) return cycle;
    }
    visiting.delete(id);
    done.add(id);
    return null;
  };
  for (const id of [...edges.keys()].sort()) {
    const cycle = walk(id, []);
    if (cycle) return cycle;
  }
  return null;
}

/**
 * Graf po zamierzonej zmianie: `dependsOn` ZASTĘPUJE listę poprzedników jednej
 * inicjatywy (pusta lista = usunięcie wszystkich jej zależności).
 */
export function withReplacedDependencies(
  edges: Map<string, string[]>,
  initiativeId: string,
  dependsOn: string[]
): Map<string, string[]> {
  const next = new Map(edges);
  const unique = [...new Set(dependsOn.filter((id) => id && id !== initiativeId))].sort();
  if (unique.length) next.set(initiativeId, unique);
  else next.delete(initiativeId);
  return next;
}
