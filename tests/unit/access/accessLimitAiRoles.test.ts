import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../server/src/utils/Logger.js', () => {
  const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), http: vi.fn(), debug: vi.fn() };
  return { default: logger, logger };
});

import loggerMock from '../../../server/src/utils/Logger.js';
import { parseAiRolesEnabled } from '../../../server/src/services/access/AccessLimitService.js';

describe('parseAiRolesEnabled — odporność na zepsutą kolumnę ai_roles_enabled_json', () => {
  beforeEach(() => {
    vi.mocked(loggerMock.warn).mockClear();
  });

  it('parsuje poprawną tablicę JSON', () => {
    expect(parseAiRolesEnabled('["ADVISOR","ANALYST"]', 'org-1')).toEqual(['ADVISOR', 'ANALYST']);
  });

  it('pusta/nullowa wartość → fallback ADVISOR, bez wyjątku', () => {
    expect(parseAiRolesEnabled(null, 'org-1')).toEqual(['ADVISOR']);
    expect(parseAiRolesEnabled('', 'org-1')).toEqual(['ADVISOR']);
  });

  it('odzyskuje wartość podwójnie zaescapowaną (awaria stagingu 14.09 04:44 UTC)', () => {
    const broken = '[\\"ADVISOR\\",\\"ANALYST\\"]';
    expect(parseAiRolesEnabled(broken, 'org-broken')).toEqual(['ADVISOR', 'ANALYST']);
  });

  it('kompletnie zepsuty znak → fallback + logger.warn z organization_id, bez wyjątku', () => {
    expect(() => parseAiRolesEnabled('[ADVISOR', 'org-zepsuta')).not.toThrow();
    expect(parseAiRolesEnabled('[ADVISOR', 'org-zepsuta')).toEqual(['ADVISOR']);
    expect(loggerMock.warn).toHaveBeenCalled();
    const meta = vi.mocked(loggerMock.warn).mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(meta.organization_id).toBe('org-zepsuta');
  });

  it('poprawny JSON, ale nie tablica stringów → fallback', () => {
    expect(parseAiRolesEnabled('{"a":1}', 'org-1')).toEqual(['ADVISOR']);
    expect(parseAiRolesEnabled('[1,2]', 'org-1')).toEqual(['ADVISOR']);
  });
});
