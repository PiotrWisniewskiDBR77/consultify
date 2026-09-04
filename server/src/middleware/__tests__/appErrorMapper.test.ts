import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/Logger.js', () => ({ default: { error: vi.fn() } }));

import { AppError } from '../../utils/ErrorHandler.js';
import logger from '../../utils/Logger.js';
import { mapAppErrorResponse } from '../appErrorMapper.js';

const req = (language = 'en') =>
  ({
    correlationId: 'corr-day296',
    method: 'GET',
    path: '/api/test',
    get: (name: string) => (name === 'Accept-Language' ? language : undefined),
  }) as any;

describe('appErrorMapper', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
    vi.clearAllMocks();
  });

  it('keeps raw database detail in the log and returns a safe English response', () => {
    process.env.NODE_ENV = 'production';
    const result = mapAppErrorResponse(Object.assign(new Error('column category_id does not exist'), { code: '42703' }), req());
    expect(result).toEqual({ error: 'The data could not be processed.', errorCode: 'DB_ERROR', correlationId: 'corr-day296' });
    expect(JSON.stringify(result)).not.toContain('category_id');
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ correlationId: 'corr-day296', message: 'column category_id does not exist' }));
  });

  it('selects Polish safe messages from Accept-Language', () => {
    process.env.NODE_ENV = 'production';
    expect(mapAppErrorResponse(Object.assign(new Error('secret'), { statusCode: 403 }), req('pl-PL')).error).toBe('Brak uprawnien do tej operacji.');
  });

  it('preserves an explicit operational AppError message and code', () => {
    process.env.NODE_ENV = 'production';
    const result = mapAppErrorResponse(new AppError('Dokument wygasl.', 404, 'DOCUMENT_EXPIRED'), req('pl'));
    expect(result).toMatchObject({ error: 'Dokument wygasl.', errorCode: 'DOCUMENT_EXPIRED' });
  });

  it.each([
    ['PROGRAM_NOT_ACTIVE', 409, 'The OKR program is not active, so a new cycle cannot be opened.', 'Program OKR nie jest aktywny, dlatego nie mozna otworzyc nowego cyklu.'],
    ['FINANCE_SETTINGS_INVALID', 400, 'The finance settings are invalid.', 'Ustawienia finansowe sa nieprawidlowe.'],
    ['NOT_FOUND', 404, 'Template not found.', 'Nie znaleziono szablonu.'],
    ['COMMAND_CAPABILITY_DENIED', 403, 'You are not authorized to perform this action.', 'Nie masz uprawnien do wykonania tej operacji.'],
  ])('localizes the %s operational contract without changing its code', (code, status, english, polish) => {
    process.env.NODE_ENV = 'production';
    const error = new AppError('raw English business detail', status, code);
    expect(mapAppErrorResponse(error, req())).toMatchObject({ error: english, errorCode: code });
    expect(mapAppErrorResponse(error, req('pl-PL'))).toMatchObject({ error: polish, errorCode: code });
  });

  it('never includes debug detail in production', () => {
    process.env.NODE_ENV = 'production';
    expect(mapAppErrorResponse(new Error('/private/secret/path'), req())).not.toHaveProperty('debug');
  });

  it('includes debug detail only in development', () => {
    process.env.NODE_ENV = 'development';
    expect(mapAppErrorResponse(new Error('developer detail'), req())).toHaveProperty('debug', 'developer detail');
  });
});
