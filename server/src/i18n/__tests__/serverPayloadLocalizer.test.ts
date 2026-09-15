import { describe, expect, it } from 'vitest';
import type { Request } from 'express';

import { localizeServerPayload, localizeServerPayloadText } from '../serverPayloadLocalizer.js';

function request(profileLanguage: string, headerLanguage = 'en-US'): Request {
  return {
    user: { language: profileLanguage },
    get: (name: string) => (name === 'Accept-Language' ? headerLanguage : undefined),
  } as unknown as Request;
}

describe('server payload localization', () => {
  it('leaves status and code intact while translating only message/error fields', () => {
    const payload = {
      status: 409,
      code: 'CONFLICT',
      message: 'Access denied to this table',
      nested: { error: 'Action is PENDING, not APPROVED', label: 'Unregistered label' },
    };

    expect(localizeServerPayload(payload, request('pl'))).toEqual({
      status: 409,
      code: 'CONFLICT',
      message: 'Odmowa dostępu do tej tabeli',
      nested: { error: 'Akcja to PENDING, nie ZATWIERDZONA', label: 'Unregistered label' },
    });
  });

  it('never translates a registered string for an English user', () => {
    expect(localizeServerPayloadText('Resource not found.', 'en')).toBe('Resource not found.');
  });

  it('preserves non-plain objects instead of changing their JSON contract', () => {
    const date = new Date('2026-09-15T00:00:00.000Z');
    const payload = { date, bytes: Buffer.from('test') };
    const localized = localizeServerPayload(payload, request('pl')) as typeof payload;
    expect(localized.date).toBe(date);
    expect(localized.bytes).toBe(payload.bytes);
  });
});
