import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Day207 tool-loop wiring and navigation contracts', () => {
  it('keeps WRITE opt-in and separate from the READ loop', () => {
    const flags = read('server/src/config/FeatureFlags.ts');
    expect(flags).toContain('ENABLE_TERESA_TOOL_LOOP_WRITE: z.boolean().default(false)');
    expect(flags).toContain("process.env.ENABLE_TERESA_TOOL_LOOP_WRITE === 'true'");
    expect(flags).not.toContain(
      'ENABLE_TERESA_TOOL_LOOP_WRITE && featureFlags.ENABLE_TERESA_TOOL_LOOP'
    );
  });

  it('registers proposal tools without executing MCP and emits a same-turn proposal', () => {
    const llm = read('server/src/services/ai/llmService.ts');
    const route = read('server/src/routes/ai.routes.ts');
    expect(llm).toContain('params.proposalTools?.length');
    expect(llm).toContain('return onProposalToolCall(def.name, args)');
    expect(route).toContain("type: 'execution_proposal'");
    expect(route).toContain("checkChatPermission(");
  });

  it('routes the four producer families to current canonical surfaces', () => {
    const handler = read('src/services/chatActionHandler.ts');
    const panel = read('src/components/AIChat/UnifiedChatPanel.tsx');
    expect(handler).toContain("deps.navigate('/document-studio')");
    expect(handler).toContain("'/prezentacje'");
    expect(handler).toContain('`/results/kpi/${encodeURIComponent(kpiId)}`');
    for (const type of [
      'GENERATE_REPORT',
      'GENERATE_PRESENTATION',
      'USE_TEMPLATE',
      'BROWSE_TEMPLATES',
      'RECORD_KPI',
    ]) {
      expect(panel).toContain(`type: '${type}'`);
    }
  });
});
