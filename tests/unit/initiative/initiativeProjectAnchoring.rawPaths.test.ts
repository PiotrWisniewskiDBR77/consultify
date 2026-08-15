import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { queryOne, queryRun } = vi.hoisted(() => ({
  queryOne: vi.fn(),
  queryRun: vi.fn(),
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne,
  queryRun,
}));

import { resolveInitiativeProjectId } from '../../../server/src/services/initiativeProjectPolicyService.js';

const RAW_FALLBACK_SOURCES = [
  'server/src/routes/my-work.routes.ts',
  'server/src/services/ToolInitiativeService.ts',
  'server/src/services/aiActionExecutor.ts',
  'server/src/services/artifacts/ArtifactConversionService.ts',
  'server/src/services/assessmentInitiativeService.ts',
  'server/src/services/initiative/InitiativeDefinitionService.ts',
  'server/src/services/notebookConversionService.ts',
  'server/src/services/reportImportService.ts',
];

describe('initiative project anchoring across funnel and raw fallbacks', () => {
  const previousRequireProject = process.env.REQUIRE_INITIATIVE_PROJECT;
  const previousFunnel = process.env.INITIATIVE_FUNNEL_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REQUIRE_INITIATIVE_PROJECT = 'true';
  });

  afterEach(() => {
    if (previousRequireProject === undefined) delete process.env.REQUIRE_INITIATIVE_PROJECT;
    else process.env.REQUIRE_INITIATIVE_PROJECT = previousRequireProject;
    if (previousFunnel === undefined) delete process.env.INITIATIVE_FUNNEL_ENABLED;
    else process.env.INITIATIVE_FUNNEL_ENABLED = previousFunnel;
  });

  it('preserves an explicit project without querying or creating a system portfolio', async () => {
    await expect(resolveInitiativeProjectId('org-1', ' project-1 ')).resolves.toBe('project-1');
    expect(queryOne).not.toHaveBeenCalled();
    expect(queryRun).not.toHaveBeenCalled();
  });

  it('anchors a null project to the existing tenant system portfolio', async () => {
    queryOne.mockResolvedValueOnce({ id: 'portfolio-org-1' });

    await expect(resolveInitiativeProjectId('org-1', null, { createdBy: 'user-1' })).resolves.toBe(
      'portfolio-org-1'
    );
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('organization_id = ? AND is_system = TRUE'),
      ['org-1']
    );
    expect(queryRun).not.toHaveBeenCalled();
  });

  it('retains the explicit rollback posture when project anchoring is disabled', async () => {
    process.env.REQUIRE_INITIATIVE_PROJECT = 'false';

    await expect(resolveInitiativeProjectId('org-1', null)).resolves.toBeNull();
    expect(queryOne).not.toHaveBeenCalled();
    expect(queryRun).not.toHaveBeenCalled();
  });

  it.each(['true', 'false'])('keeps every live producer covered with funnel=%s', (funnel) => {
    process.env.INITIATIVE_FUNNEL_ENABLED = funnel;

    for (const relativePath of RAW_FALLBACK_SOURCES) {
      const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
      expect(source, relativePath).toContain("process.env.INITIATIVE_FUNNEL_ENABLED === 'true'");
      expect(source, relativePath).toContain('resolveInitiativeProjectId');
    }
  });
});
