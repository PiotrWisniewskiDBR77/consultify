import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('AppRoutes chat shell wiring', () => {
  it('mounts /chat routes on the canonical UnifiedChatPanel shell', () => {
    const appRoutes = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.tsx'), 'utf8');

    expect(appRoutes).toContain("import('@/components/AIChat/UnifiedChatPanel')");
    expect(appRoutes).toContain('<UnifiedChatPanel mode="full" />');
    expect(appRoutes).not.toContain("import('@/views/AIChatWelcomeView')");
    expect(appRoutes).not.toContain('<AIChatWelcomeView />');
  });
});
