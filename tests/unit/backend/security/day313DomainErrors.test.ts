import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { mapAppErrorResponse } from '../../../../server/src/middleware/appErrorMapper.js';
import { TemplateNotFoundError } from '../../../../server/src/services/deliverableTemplateService.js';
import { FinanceSettingsCommandError } from '../../../../server/src/services/finance/canonical/financeSettingsCommandService.js';
import { OkrCycleProgramNotActiveError } from '../../../../server/src/services/resultsVnext/okr/okrCycleCommands.js';
import { CommandCapabilityDeniedError } from '../../../../server/src/services/resultsVnext/platform/commandCapabilityGuard.js';

describe('day313 named domain errors', () => {
  it('keeps OkrCycleProgramNotActiveError operational at HTTP 409', () => {
    const error = new OkrCycleProgramNotActiveError('program-1', 'draft');
    expect(error).toMatchObject({ statusCode: 409, code: 'PROGRAM_NOT_ACTIVE', isOperational: true });
    expect(mapAppErrorResponse(error).error).toContain('program-1');
  });

  it('keeps FinanceSettingsCommandError operational at its existing HTTP status', () => {
    const error = new FinanceSettingsCommandError('FINANCE_SETTINGS_INVALID', 400, 'Invalid WACC');
    expect(error).toMatchObject({ statusCode: 400, code: 'FINANCE_SETTINGS_INVALID', isOperational: true });
    expect(mapAppErrorResponse(error).error).toBe('Invalid WACC');
  });

  it('maps TemplateNotFoundError to HTTP 404 and a non-INTERNAL errorCode', () => {
    const error = new TemplateNotFoundError('template-1');
    const response = mapAppErrorResponse(error);
    expect(error.statusCode).toBe(404);
    expect(response).toMatchObject({ error: 'Template not found: template-1', errorCode: 'NOT_FOUND' });
    expect(response.errorCode).not.toBe('INTERNAL');
  });

  it('keeps CommandCapabilityDeniedError operational at HTTP 403', () => {
    const error = new CommandCapabilityDeniedError('results.example.write');
    expect(error).toMatchObject({
      statusCode: 403,
      code: 'COMMAND_CAPABILITY_DENIED',
      isOperational: true,
    });
    expect(mapAppErrorResponse(error).error).toBe('You are not authorized to perform this action.');
  });

  it('does not grow the remaining exported domain Error debt', () => {
    const names = new Set<string>();
    const visit = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === '__tests__' || entry.name === '_backup') continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) visit(path);
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          for (const match of readFileSync(path, 'utf8').matchAll(/export class ([A-Za-z]+Error) extends Error/g)) {
            names.add(match[1]);
          }
        }
      }
    };
    visit(resolve(process.cwd(), 'server/src'));
    expect(names.size).toBeLessThanOrEqual(251);
  });
});
