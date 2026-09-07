// @vitest-environment node
/**
 * Kanban Realizacji — metoda zapisu przeciągnięcia karty (DEC-453, commit 91484aad7c).
 *
 * Zmierzone 07.09 na własnym API (kopia bazy): `PATCH /api/tasks/:id` → 404
 * (`API_ROUTE_NOT_FOUND`, router ma tylko `PUT /:id`), `PUT /api/tasks/:id` → 200
 * i status w tabeli `tasks` zmieniony. Przez trzy tygodnie maskowała to bramka 26A
 * (409 na każdy zapis routera), więc po jej zdjęciu przeciągnięcie nadal by nie
 * działało — tylko z innym kodem błędu.
 *
 * MUTACJA: zamień `Api.put` z powrotem na `Api.patch` w handlerze przeciągnięcia
 * → test czerwony.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../ExecutionHub.tsx', import.meta.url), 'utf8');

describe('Kanban Realizacji — zapis statusu zadania po przeciągnięciu', () => {
  it('woła PUT /tasks/:id (jedyna metoda zapisu tego routera)', () => {
    expect(source).toMatch(/await Api\.put\(`\/tasks\/\$\{activeId\}`, \{ status: newStatus \}\)/);
  });

  it('nie woła PATCH /tasks/:id — ta metoda nie istnieje na serwerze (404)', () => {
    expect(source).not.toMatch(/Api\.patch\(`\/tasks\/\$\{activeId\}`/);
  });
});
