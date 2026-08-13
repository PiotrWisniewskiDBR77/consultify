import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const layoutSource = fs.readFileSync(path.resolve(__dirname, '../MainLayout.tsx'), 'utf8');
const chatPanelSource = fs.readFileSync(
  path.resolve(__dirname, '../../components/layout/ChatPanel.tsx'),
  'utf8'
);

describe('global Teresa close-control layout contract', () => {
  it.each([
    ['/document-studio', 'document'],
    ['/presentations/builder/', 'presentation'],
    ['/excele', 'spreadsheet'],
  ])('uses the global Teresa surface for %s (%s)', (routePrefix, lane) => {
    expect(layoutSource).toContain(`path.startsWith('${routePrefix}')`);
    expect(layoutSource).toContain(`isArtifactStudioLaneEnabled('${lane}')`);
  });

  it('keeps the close control above the sticky voice header', () => {
    expect(layoutSource).toMatch(
      /className="absolute top-2 right-2 z-30[\s\S]*?aria-label=\{t\('layout\.aiPanel\.close'/
    );
    expect(chatPanelSource).toContain('pl-4 pr-14 py-3');
    expect(chatPanelSource).toContain('sticky top-0 z-10');
  });
});
