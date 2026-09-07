import { describe, expect, it } from 'vitest';

import appRoutesSource from '../AppRoutes.tsx?raw';

describe('P14-B template architect identity routes', () => {
  it('mounts document and deck template routes with a concrete template id', () => {
    expect(appRoutesSource).toContain('path="/presentations/templates/document/:templateId"');
    expect(appRoutesSource).toContain('path="/presentations/templates/deck/:templateId"');
    expect(appRoutesSource).toContain('initialTemplateId={templateId}');
  });
});
