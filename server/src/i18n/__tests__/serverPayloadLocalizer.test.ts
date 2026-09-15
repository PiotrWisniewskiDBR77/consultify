import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Request } from 'express';

import { SERVER_PAYLOAD_MESSAGES } from '../serverPayloadMessages/index.js';
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

  it.each([
    [
      "Job job-1 is 'succeeded' but has no committed compute_job_outputs row (data inconsistency) — refusing to report a false success for a duplicate request",
      "Zadanie job-1 ma status 'succeeded', ale nie ma zatwierdzonego wiersza compute_job_outputs (niespójność danych) — odmowa zgłoszenia fałszywego sukcesu dla powtórzonego żądania",
    ],
    [
      "Job job-2 (idempotency key already in use) is 'running', not 'queued' or 'succeeded' — a duplicate compute request cannot resume it (original may still be running, or it is terminally failed/cancelled)",
      "Zadanie job-2 (klucz idempotencji jest już używany) ma status 'running', a nie 'queued' ani 'succeeded' — powtórzone żądanie obliczeń nie może go wznowić (pierwotne może nadal działać albo zakończyło się statusem 'failed'/'cancelled')",
    ],
    [
      "Failed to self-claim job job-3 — row is no longer 'queued' (concurrent claim raced this call, or it went terminal between enqueue and claim)",
      "Nie udało się przejąć zadania job-3 — wiersz nie ma już statusu 'queued' (równoległe przejęcie wyprzedziło to wywołanie albo zadanie osiągnęło stan końcowy między enqueue a claim)",
    ],
  ])('recursively localizes a real DCF claim failure without losing its detail', (detail, localizedDetail) => {
    const output = localizeServerPayloadText(`runDcfFcffValuation: ${detail}`, 'pl');
    expect(output).toBe(`Wycena DCF/FCFF: ${localizedDetail}`);
    expect(output).not.toContain('Błąd operacji:');
    expect(output).not.toContain('duplicate compute request');
    expect(output).not.toContain('Failed to self-claim');
    expect(
      localizeServerPayload(
        { ok: false, code: 'JOB_NOT_RUNNING', status: 409, message: `runDcfFcffValuation: ${detail}` },
        request('pl')
      )
    ).toEqual({
      ok: false,
      code: 'JOB_NOT_RUNNING',
      status: 409,
      message: `Wycena DCF/FCFF: ${localizedDetail}`,
    });
  });

  it('keeps the executable message catalog unique', () => {
    expect(SERVER_PAYLOAD_MESSAGES).toHaveLength(new Set(SERVER_PAYLOAD_MESSAGES.map(({ en }) => en)).size);
  });

  it('fully localizes decision-field validation prose while preserving field identifiers', () => {
    expect(
      localizeServerPayload(
        { code: 'VALIDATION', error: 'Missing required decision fields: proposal_id' },
        request('pl')
      )
    ).toEqual({ code: 'VALIDATION', error: 'Brak wymaganych pól decyzyjnych: proposal_id' });
  });

  it('matches every classified b sink to its reviewed Polish catalog entry', () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.resolve('docs/program/JEZYK_EN_PL_20260908/K4_K8SEN_W73_CLASSIFICATION.json'),
        'utf8'
      )
    ) as {
      measurement: { fullPolishRows: number; fullPolishUnique: number };
      entries: Array<{ classification: string; text: string }>;
    };
    const reviewed = JSON.parse(
      fs.readFileSync(
        path.resolve('docs/program/JEZYK_EN_PL_20260908/K4_K8SEN_W73_V4_TRANSLATION_WORKING.json'),
        'utf8'
      )
    ) as { entries: Array<{ en: string; pl: string }> };
    const expected = new Map(reviewed.entries.map(({ en, pl }) => [en, pl]));
    const realSinks = manifest.entries.filter((entry) => entry.classification === 'b');
    const uniqueRealSinks = [...new Set(realSinks.map((entry) => entry.text))];
    const results = uniqueRealSinks.map((source) => ({
      source,
      expected: expected.get(source),
      actual: localizeServerPayloadText(source, 'pl'),
    }));

    expect(manifest.measurement).toMatchObject({ fullPolishRows: 1529, fullPolishUnique: 1271 });
    expect(realSinks).toHaveLength(manifest.measurement.fullPolishRows);
    expect(uniqueRealSinks).toHaveLength(manifest.measurement.fullPolishUnique);
    expect(results.filter(({ expected: pl }) => !pl)).toEqual([]);
    expect(results.filter(({ expected: pl, actual }) => actual !== pl)).toEqual([]);
    expect(results.filter(({ source, expected: pl }) => source === pl)).toEqual([]);
    const placeholders = (value: string) => (value.match(/\$\{[^}]*\}/g) || []).sort();
    expect(results.filter(({ source, actual }) =>
      JSON.stringify(placeholders(source)) !== JSON.stringify(placeholders(actual))
    )).toEqual([]);
    expect(results.filter(({ actual }) => actual.startsWith('Błąd operacji:'))).toEqual([]);
    const knownEnglishProse = /\b(?:already|missing|required|requires|failed|found|available|unavailable|expired|only|restore|versions|template|invitation|conversation|owners|roles|change|analysis|returned|cannot|should|would|unknown|invalid|fields|organization|operation|request|document|snapshot|report|title|source|target|current|expected|actual|before|after|during|while|without|within|outside|supported|unsupported|complete|completed|engine|feature|values|rows|insert|delete|create)\b/i;
    const visibleProse = (value: string) =>
      value
        // Preserve placeholder presence in the assertion. Dynamic prose-bearing
        // captures require a direct runtime probe above; they cannot disappear
        // from this scan and manufacture a static full-PL result.
        .replace(/\$\{[^}]*\}/g, ' DYNAMIC_CAPTURE ')
        .replace(/\[[A-Za-z0-9_-]+\]/g, ' ')
        .replace(/\b[A-Z][A-Z0-9_]{2,}\b/g, ' ')
        .replace(/\b[A-Za-z0-9]*_[A-Za-z0-9_]+\b/g, ' ')
        .replace(/\b(?=[A-Za-z0-9]*[a-z])(?=[A-Za-z0-9]*[A-Z])[A-Za-z0-9]+\b/g, ' ');
    expect(
      results.filter(({ actual }) => knownEnglishProse.test(visibleProse(actual)))
    ).toEqual([]);
    expect(
      results.filter(({ actual }) =>
        /\b(?:template is already published|missing required decision fields|can only restore versions|email address does not match invitation|code has expired|only conversation owners can|no scoped session data available)\b/i.test(
          actual
        )
      )
    ).toEqual([]);
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
