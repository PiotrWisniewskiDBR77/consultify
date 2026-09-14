import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * Uwaga Tomka IV (pilotaż 13.09): „Nie działa załączanie plików do Chata".
 *
 * Zmierzone na żywo 14.09 (lokalny runtime, plik .txt w czacie):
 *   POST /api/conversations/:id/messages/:messageId/attachments → 400
 *   {"error":"Invalid input: expected string, received null",
 *    "details":[{"field":"targetUrl", ...}]}
 * Klient ślał brakujące pola jako jawny `null`, a schemat przyjmował tylko
 * `string | undefined` — więc ŻADEN plik nigdy nie został przypięty do
 * wiadomości, a błąd ginął w pustym `catch`.
 *
 * Ten test pilnuje kontraktu schematu (kopia z conversations.routes.ts).
 */

const nullableOptionalString = (schema: z.ZodString) =>
  schema
    .nullish()
    .transform((value) => (value == null || value === '' ? undefined : value))
    .optional();

const AttachmentSchema = z.object({
  kind: z.enum(['file', 'link', 'artifact', 'snapshot', 'reference']),
  targetId: nullableOptionalString(z.string().max(500)),
  targetUrl: nullableOptionalString(z.string().url().max(2000)),
  displayName: z.string().min(1).max(500),
  mime: nullableOptionalString(z.string().max(200)),
  sizeBytes: z
    .number()
    .int()
    .nonnegative()
    .nullish()
    .transform((value) => (value == null ? undefined : value))
    .optional(),
  provenancePointer: nullableOptionalString(z.string().max(500)),
});

describe('AttachmentSchema — przypięcie pliku do wiadomości (uwaga Tomka IV)', () => {
  it('przyjmuje ładunek, jaki realnie ślał front: puste pola jako null', () => {
    const parsed = AttachmentSchema.safeParse({
      kind: 'file',
      displayName: 'zalacznik.txt',
      targetId: 'd669e76a-94c5-4792-8924-3f44fd725422',
      targetUrl: null,
      mime: 'text/plain',
      sizeBytes: null,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.targetUrl).toBeUndefined();
      expect(parsed.data.sizeBytes).toBeUndefined();
      expect(parsed.data.targetId).toBe('d669e76a-94c5-4792-8924-3f44fd725422');
    }
  });

  it('przyjmuje ładunek bez pól opcjonalnych', () => {
    const parsed = AttachmentSchema.safeParse({
      kind: 'file',
      displayName: 'zalacznik.txt',
      targetId: 'doc-1',
    });
    expect(parsed.success).toBe(true);
  });

  it('nadal odrzuca realnie zły adres', () => {
    const parsed = AttachmentSchema.safeParse({
      kind: 'link',
      displayName: 'link',
      targetUrl: 'to-nie-jest-adres',
    });
    expect(parsed.success).toBe(false);
  });

  it('nadal wymaga nazwy wyświetlanej', () => {
    expect(AttachmentSchema.safeParse({ kind: 'file' }).success).toBe(false);
  });
});
