import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const mocks = vi.hoisted(() => ({ dbGet: vi.fn(), validate: vi.fn() }));

vi.mock('../../../utils/DbPromise.js', () => ({ all: vi.fn(), get: mocks.dbGet, run: vi.fn() }));
vi.mock('../../../ai/templateValidationService.js', () => ({ default: { validate: mocks.validate } }));
vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import AIPlaybookService from '../../../ai/aiPlaybookService.js';
import { AIPlaybooksController } from '../AIPlaybooksController.js';
import { serverPayloadLocale } from '../../../middleware/serverPayloadLocale.js';

describe('Superadmin playbook publish locale boundary', () => {
  beforeEach(() => {
    mocks.dbGet.mockReset();
    mocks.validate.mockReset();
    mocks.dbGet.mockResolvedValue({ id: 'tpl-published', template_graph: null, trigger_signal: null });
    mocks.validate.mockReturnValue({ ok: true, errors: [] });
    AIPlaybookService.setDependencies({
      db: {
        get: (_sql: string, _params: unknown[], callback: (error: null, row: unknown) => void) =>
          callback(null, { id: 'tpl-published', status: 'PUBLISHED' }),
      },
    });
  });

  it('returns fully Polish error prose while preserving HTTP status', async () => {
    const req = {
      params: { id: 'tpl-published' },
      user: { id: 'superadmin-1', role: 'SUPERADMIN', language: 'pl' },
      get: () => 'en-US',
    } as unknown as Request;
    let status = 200;
    let body: unknown;
    const res = {
      status(code: number) { status = code; return this; },
      json(payload: unknown) { body = payload; return this; },
    } as unknown as Response;

    serverPayloadLocale(req, res, vi.fn() as unknown as NextFunction);
    await AIPlaybooksController.publishTemplate(req as never, res);

    expect(status).toBe(500);
    expect(body).toEqual({ error: 'Szablon zosta\u0142 ju\u017c opublikowany', code: 'PLAYBOOK_PUBLISHED' });
    expect(JSON.stringify(body)).not.toContain('Template is already published');
  });
});
