import fs from 'node:fs';
import path from 'node:path';
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
    ).toEqual({ code: 'VALIDATION', error: 'brak wymaganych decision fields: proposal_id' });
  });

  it('changes every classified b sink for PL without collapsing domain details', () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.resolve('docs/program/JEZYK_EN_PL_20260908/K4_K8SEN_W73_CLASSIFICATION.json'),
        'utf8'
      )
    ) as { entries: Array<{ classification: string; text: string }> };
    const realSinks = manifest.entries.filter((entry) => entry.classification === 'b');
    const localized = realSinks.map((entry) => localizeServerPayloadText(entry.text, 'pl') === entry.text
      ? localizeServerPayload({ error: entry.text }, request('pl')) as { error: string }
      : { error: localizeServerPayloadText(entry.text, 'pl') });
    expect(realSinks).toHaveLength(1577);
    expect(localized.filter((value, index) => value.error === realSinks[index].text)).toHaveLength(0);
    expect(new Set(localized.map((value) => value.error)).size).toBeGreaterThan(1200);
    expect(localized.some((value) => value.error === 'Nie udało się wykonać operacji.')).toBe(false);
  });

  it('keeps runtime:false source honest while translating both expanded OTP outcomes', () => {
    expect(localizeServerPayloadText('Invalid code. 2 attempts remaining.', 'pl')).toBe(
      'Nieprawidłowy kod. Pozostało prób: 2.'
    );
    expect(localizeServerPayloadText('Invalid code. Please request a new code.', 'pl')).toBe(
      'Nieprawidłowy kod. Poproś o nowy kod.'
    );
  });

  it('localizes the real Meeting executor HTTP 400 payload without changing status/code', () => {
    const payload = {
      success: false,
      error: 'Meeting execution requires organizationId',
      status: 400,
      code: 'BAD_REQUEST',
    };
    expect(localizeServerPayload(payload, request('pl'))).toEqual({
      success: false,
      error: 'Wykonanie spotkania wymaga organizationId',
      status: 400,
      code: 'BAD_REQUEST',
    });
  });

  it('preserves non-plain objects instead of changing their JSON contract', () => {
    const date = new Date('2026-09-15T00:00:00.000Z');
    const payload = { date, bytes: Buffer.from('test') };
    const localized = localizeServerPayload(payload, request('pl')) as typeof payload;
    expect(localized.date).toBe(date);
    expect(localized.bytes).toBe(payload.bytes);
  });
});
