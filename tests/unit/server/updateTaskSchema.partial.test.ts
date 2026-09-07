/**
 * P16-R2 · `PUT /api/tasks/:id` z JEDNYM polem nie może kasować pozostałych.
 *
 * POMIAR 07.09 (własne API 4155, kopia bazy `consultify_p16r2`, zadanie
 * `proba-r2-1`):
 *   PRZED: status=review · priority=critical · task_type=analysis
 *   `PUT /api/tasks/proba-r2-1` z ciałem `{"dueDate":"2026-10-09T10:00:00.000Z"}` → 200
 *   PO:    status=todo   · priority=medium   · task_type=execution
 *
 * Przyczyna: zod 4 — `.partial()` NIE zdejmuje `.default()`, więc walidator
 * dopisywał do ciała trzy pola, których nikt nie wysłał, a
 * `TaskController.updateTask` ma je na liście `allowedFields`.
 *
 * MUTACJA: usuń `.extend({ status/priority/taskType/source: … })`
 * z `UpdateTaskSchema` (server/src/validators/task.validators.ts) → RED.
 */
import { describe, expect, it } from 'vitest';

import { CreateTaskSchema, UpdateTaskSchema } from '../../../server/src/validators/task.validators';

describe('UpdateTaskSchema — aktualizacja częściowa', () => {
  it('nie dopisuje statusu, priorytetu ani typu, gdy ciało niesie tylko termin', () => {
    const parsed = UpdateTaskSchema.parse({ dueDate: '2026-10-09T10:00:00.000Z' });

    expect(Object.keys(parsed).sort()).toEqual(['dueDate']);
    expect(parsed).not.toHaveProperty('status');
    expect(parsed).not.toHaveProperty('priority');
    expect(parsed).not.toHaveProperty('taskType');
    expect(parsed).not.toHaveProperty('source');
  });

  it('nie dopisuje niczego, gdy ciało niesie tylko osobę', () => {
    const parsed = UpdateTaskSchema.parse({ assigneeId: 'user-1' });
    expect(Object.keys(parsed)).toEqual(['assigneeId']);
  });

  it('przepuszcza status, gdy naprawdę został wysłany', () => {
    expect(UpdateTaskSchema.parse({ status: 'in_progress' })).toEqual({ status: 'in_progress' });
  });

  it('odrzuca status spoza słownika serwera', () => {
    expect(UpdateTaskSchema.safeParse({ status: 'zamkniete' }).success).toBe(false);
  });

  it('TWORZENIE zadania nadal dostaje domyślki (kontrakt bez zmian)', () => {
    const created = CreateTaskSchema.parse({ title: 'Nowe zadanie' });
    expect(created.status).toBe('todo');
    expect(created.priority).toBe('medium');
    expect(created.taskType).toBe('execution');
  });
});
