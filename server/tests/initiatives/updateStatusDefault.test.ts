/**
 * BEZPIECZNIK: schemat EDYCJI inicjatywy nie wstrzykuje statusu.
 *
 * POWÓD (09.09.2026, kontrola po naprawach): ekran-artefakt autozapisuje samo
 * `summary`/`description` co 1,5 s. Baza schematu miała `status … .default('DRAFT')`,
 * a `validateBody` podmienia `req.body` na obiekt PO parsowaniu — więc do kontrolera
 * trafiał status, którego klient nigdy nie wysłał. Bramka M13 odrzucała to jako
 * przejście statusu: 400 STATUS_TRANSITION_REQUIRES_GATE dla 12 z 13 inicjatyw
 * i stała plakietka „Unsaved" na ekranie właściciela.
 */
import { describe, expect, it } from 'vitest';

import {
  CreateInitiativeSchema,
  UpdateInitiativeSchema,
} from '../../src/validators/initiative.validators.js';

describe('UpdateInitiativeSchema — status', () => {
  it('edycja samego streszczenia NIE niesie statusu', () => {
    const r = UpdateInitiativeSchema.safeParse({ summary: 'tylko streszczenie' });
    expect(r.success).toBe(true);
    expect(r.success && 'status' in r.data).toBe(false);
  });

  it('edycja samego opisu NIE niesie statusu', () => {
    const r = UpdateInitiativeSchema.safeParse({ description: 'opis' });
    expect(r.success && 'status' in r.data).toBe(false);
  });

  it('swiadoma zmiana statusu przechodzi dalej', () => {
    const r = UpdateInitiativeSchema.safeParse({ status: 'APPROVED' });
    expect(r.success && (r.data as { status?: string }).status).toBe('APPROVED');
  });

  it('tworzenie nadal domyslnie DRAFT (zachowanie bez zmian)', () => {
    const r = CreateInitiativeSchema.safeParse({ title: 'x', projectId: 'p' });
    expect(r.success && (r.data as { status?: string }).status).toBe('DRAFT');
  });
});
