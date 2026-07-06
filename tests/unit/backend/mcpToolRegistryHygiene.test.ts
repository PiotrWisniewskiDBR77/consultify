/**
 * T-hig (Teresa "all 8 tools" higiena) — the legacy `create_initiative`
 * MUTATION tool (SQLite-era, approval-gated, never exposed to the chat
 * pipeline) was removed from ToolSchemas. `generate_initiative` is now the
 * single canonical create-initiative path for Teresa.
 *
 * This test asserts the registry no longer advertises the dead tool, while
 * confirming the live tools it was never meaningfully distinct from
 * (generate_initiative, generate_deliverable) are still registered with a
 * handler wired.
 */

import { describe, it, expect } from 'vitest';

describe('MCP tool registry — create_initiative removal (T-hig)', () => {
  it('does NOT list create_initiative in ToolSchemas', async () => {
    const mod = await import('../../../server/src/services/ai/mcpServer.js');
    const schemas = (mod as any).ToolSchemas;
    expect(Object.keys(schemas)).not.toContain('create_initiative');
  });

  it('still lists generate_initiative and generate_deliverable with a registered handler', async () => {
    await import('../../../server/src/services/ai/tools/index.js');
    const mod = await import('../../../server/src/services/ai/mcpServer.js');
    const mcpServer = (mod as any).mcpServer;
    expect(mcpServer.tools.has('generate_initiative')).toBe(true);
    expect(mcpServer.tools.get('generate_initiative').handler).toBeTruthy();
    expect(mcpServer.tools.has('generate_deliverable')).toBe(true);
    expect(mcpServer.tools.get('generate_deliverable').handler).toBeTruthy();
    expect(mcpServer.tools.has('create_initiative')).toBe(false);
  });
});
