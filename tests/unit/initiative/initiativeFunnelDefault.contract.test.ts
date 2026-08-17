import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const activeCreatorFiles = [
  'server/src/controllers/InitiativeController.ts',
  'server/src/controllers/ToolController.ts',
  'server/src/routes/assessment-workflow-v2.routes.ts',
  'server/src/routes/economics.routes.ts',
  'server/src/routes/my-work.routes.ts',
  'server/src/routes/report-builder.routes.ts',
  'server/src/services/ToolInitiativeService.ts',
  'server/src/services/aiActionExecutor.ts',
  'server/src/services/artifacts/ArtifactConversionService.ts',
  'server/src/services/assessmentInitiativeService.ts',
  'server/src/services/cqrs/initiative/CreateInitiative.ts',
  'server/src/services/initiative/InitiativeDefinitionService.ts',
  'server/src/services/notebookConversionService.ts',
  'server/src/services/onboardingService.ts',
  'server/src/services/reportImportService.ts',
  'server/src/services/reportInitiativeService.ts',
];

describe('INI-MVP-PROFILE-001 canonical initiative creation cutover', () => {
  it('routes every flag-governed production creator through the funnel by default', () => {
    for (const relativePath of activeCreatorFiles) {
      const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
      expect(source, relativePath).not.toContain("INITIATIVE_FUNNEL_ENABLED === 'true'");
      expect(source, relativePath).toContain("INITIATIVE_FUNNEL_ENABLED !== 'false'");
    }
  });

  it('removes the unconditional Assessment Workbench INSERT writer', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'server/src/services/assessment/AssessmentWorkbenchService.ts'),
      'utf8'
    );
    expect(source).toContain('funnelCreateInitiative(');
    expect(source).not.toMatch(/INSERT\s+INTO\s+initiatives/i);
  });

  it('enforces Initiative capability gates regardless of the global shadow default', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'server/src/routes/pmo/initiatives.routes.ts'),
      'utf8'
    );
    expect(source).toContain('requireInitiativeCapability(capability, { ...options, shadow: false })');
    expect(source).not.toMatch(/\brequireInitiativeCapability\(['"]/);
  });

  it('keeps duplication inside the canonical persistence owner instead of a route writer', () => {
    const route = fs.readFileSync(
      path.join(ROOT, 'server/src/routes/pmo/initiatives.routes.ts'),
      'utf8'
    );
    const owner = fs.readFileSync(
      path.join(ROOT, 'server/src/services/initiative/createInitiativeService.ts'),
      'utf8'
    );
    expect(route).toContain('duplicateInitiative(');
    expect(route).not.toMatch(/INSERT\s+INTO\s+initiatives/i);
    expect(owner).toContain('export async function duplicateInitiative(');
  });
});
