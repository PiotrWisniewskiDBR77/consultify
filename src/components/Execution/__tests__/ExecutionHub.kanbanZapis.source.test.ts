// @vitest-environment node
/**
 * Zapis statusu zadania w Realizacji — gdzie mieszka i jaką metodą pisze (DEC-453).
 *
 * HISTORIA. Do 07.09 ten plik pilnował, że kanban Realizacji zapisuje przez
 * `Api.put('/tasks/${activeId}')`, bo `PATCH /api/tasks/:id` odpowiada 404
 * (router `server/src/routes/pmo/tasks.routes.ts` ma wyłącznie `PUT /:id`;
 * zmierzone 07.09 na własnym API). Twierdzenie o metodzie było prawdziwe —
 * ale kanban, którego pilnowało, NIE BYŁ RENDEROWANY: `renderTaskBoard`
 * i `handleDragEnd` w `ExecutionHub.tsx` nie miały ani jednego wołacza
 * (jedyne wystąpienie w repo to własna deklaracja). Test zielony bronił kodu,
 * którego użytkownik nie mógł uruchomić — kształt „biblioteka bez wywołania".
 *
 * P16-R2: martwy kanban usunięty, a zapis statusu przeniesiony tam, gdzie
 * użytkownik naprawdę klika — edycja w wierszu zakładki „Praca"
 * (`ExecutionWorkSurface.tsx`). Ten plik pilnuje teraz JEDNEGO I DRUGIEGO:
 * że martwy kod nie wrócił i że żywa ścieżka pisze metodą, którą serwer zna.
 *
 * MUTACJE:
 *   · przywrócenie `renderTaskBoard`/`handleDragEnd` w `ExecutionHub.tsx` → RED,
 *   · zamiana `Api.updateTask` na `Api.patch` w `ExecutionWorkSurface` → RED,
 *   · wysłanie pełnego obiektu zamiast `{ [pole]: … }` → RED.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const hub = readFileSync(new URL('../ExecutionHub.tsx', import.meta.url), 'utf8');
const praca = readFileSync(new URL('../ExecutionWorkSurface.tsx', import.meta.url), 'utf8');

describe('Realizacja — martwy kanban usunięty', () => {
  it('ExecutionHub nie deklaruje już tablicy kanban ani obsługi przeciągania', () => {
    expect(hub).not.toMatch(/const renderTaskBoard\s*=/);
    expect(hub).not.toMatch(/const handleDragEnd\s*=/);
    expect(hub).not.toMatch(/<DndContext/);
  });

  it('ExecutionHub nie importuje już @dnd-kit (zależność bez konsumenta w tym pliku)', () => {
    expect(hub).not.toMatch(/from '@dnd-kit\//);
  });

  it('ExecutionHub nie pisze już statusu zadania własną trasą', () => {
    expect(hub).not.toMatch(/Api\.put\(`\/tasks\/\$\{activeId\}`/);
    expect(hub).not.toMatch(/Api\.patch\(`\/tasks\//);
  });
});

describe('Realizacja → Praca — edycja w wierszu pisze PUT /tasks/:id', () => {
  it('woła Api.updateTask (kanoniczny wrapper PUT /api/tasks/:id)', () => {
    expect(praca).toMatch(/await Api\.updateTask\(id, \{ \[pole\]: doWyslania \}\)/);
  });

  it('wysyła DOKŁADNIE jedno pole — nie pełny obiekt zadania', () => {
    // `{ [pole]: … }` ma jeden klucz z definicji; pełny payload kasowałby
    // wartości, których użytkownik nie dotknął.
    expect(praca).not.toMatch(/Api\.updateTask\(id, \{\s*\.\.\.(row|source|zadanie)/);
  });

  it('NIE woła PATCH /tasks/:id — ta metoda nie istnieje na serwerze (404)', () => {
    expect(praca).not.toMatch(/Api\.patch\(['"`]\/tasks\//);
  });
});
