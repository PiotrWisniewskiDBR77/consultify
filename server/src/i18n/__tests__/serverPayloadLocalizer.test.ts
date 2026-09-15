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

  it('localizes real AI pipeline policy errors and preserves interpolated values', () => {
    expect(localizeServerPayloadText('Model not allowed by policy: gpt-x', 'pl')).toBe(
      'Model niedozwolony przez politykę: gpt-x'
    );
  });

  it('sanitizes uncatalogued English error prose at the authenticated HTTP boundary', () => {
    expect(
      localizeServerPayload(
        { code: 'VALIDATION', error: 'Missing required decision fields: proposal_id' },
        request('pl')
      )
    ).toEqual({ code: 'VALIDATION', error: 'Nie udało się wykonać operacji.' });
  });

  it('preserves non-plain objects instead of changing their JSON contract', () => {
    const date = new Date('2026-09-15T00:00:00.000Z');
    const payload = { date, bytes: Buffer.from('test') };
    const localized = localizeServerPayload(payload, request('pl')) as typeof payload;
    expect(localized.date).toBe(date);
    expect(localized.bytes).toBe(payload.bytes);
  });
});
