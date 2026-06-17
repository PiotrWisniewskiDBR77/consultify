import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * M01 / L-01 (D-01 → DP-5) — client AI-memory "rozjazd".
 *
 * Decision DP-5: HIDE the AI-memory surface behind a flag (don't expose a
 * client CTA that 404s against an internal-only route). The fix has two halves
 * that this regression lock pins:
 *
 *   1. Backend `/api/ai-memory` is registered ONLY behind `internalToolsGuard`
 *      (superadmin/internal) AND `highRiskSurfaceGuard({categories:['ai_memory']})`
 *      whose kill-switch is the `TRIAL_AI_MEMORY_DISABLED` flag.
 *   2. Frontend `UnifiedChatPanel` no longer imports/renders
 *      `OrganizationMemoryPanel`, so no client-facing CTA reaches the 404 route.
 *
 * Source-level lock: the handlers/wiring are inline, so we assert the wiring in
 * Gateway.ts, the flag mapping in the guard middleware, and the absence of the
 * panel in the chat surface.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) =>
  readFileSync(path.resolve(here, '../../../', rel), 'utf8');

const gateway = read('server/src/Gateway.ts');
const guard = read('server/src/middleware/highRiskSurfaceGuard.middleware.ts');
const chatPanel = read('src/components/AIChat/UnifiedChatPanel.tsx');

describe('AI-memory gating (M01/L-01 · DP-5 hide-behind-flag)', () => {
  it('mounts /api/ai-memory behind internalToolsGuard', () => {
    expect(gateway).toMatch(/app\.use\(\s*['"]\/api\/ai-memory['"],\s*\.\.\.internalToolsGuard\s*\)/);
  });

  it('mounts /api/ai-memory behind the ai_memory high-risk surface guard', () => {
    expect(gateway).toMatch(
      /app\.use\(\s*['"]\/api\/ai-memory['"],\s*highRiskSurfaceGuard\(\{\s*categories:\s*\[\s*['"]ai_memory['"]\s*\]/
    );
  });

  it('maps the ai_memory surface to the TRIAL_AI_MEMORY_DISABLED kill-switch flag', () => {
    expect(guard).toMatch(/ai_memory:\s*['"]TRIAL_AI_MEMORY_DISABLED['"]/);
  });

  it('does not render OrganizationMemoryPanel in the client chat surface', () => {
    expect(chatPanel).not.toMatch(/<OrganizationMemoryPanel\b/);
    expect(chatPanel).not.toMatch(/from\s+['"].*OrganizationMemoryPanel['"]/);
  });
});
