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

  it('never includes debug detail in production', () => {
    process.env.NODE_ENV = 'production';
    expect(mapAppErrorResponse(new Error('/private/secret/path'), req())).not.toHaveProperty('debug');
  });

  it('includes debug detail only in development', () => {
    process.env.NODE_ENV = 'development';
    expect(mapAppErrorResponse(new Error('developer detail'), req())).toHaveProperty('debug', 'developer detail');
  });
});
