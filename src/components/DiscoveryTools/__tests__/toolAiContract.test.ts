import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { TOOL_AI_CONTRACTS } from '@/hooks/discovery/toolAi/systemPrompts';
import { TOOLS_WITH_APPLY_HANDLER } from '../toolAiActions';

describe('Discovery tool AI contracts', () => {
  it('covers every apply-enabled tool with a role and a prohibition', () => {
    for (const toolType of TOOLS_WITH_APPLY_HANDLER) {
      const contract = TOOL_AI_CONTRACTS[toolType];
      expect(contract, `${toolType} contract`).toBeTruthy();
      expect(contract, `${toolType} prohibition`).toMatch(/Nie |nie /);
    }
  });

  it('keeps apply handlers in the runtime implementation', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/hooks/discovery/useToolAI.ts'), 'utf8');
    for (const handler of ['applyDynamicSwotPendingAction', 'applyAmbitionDecomposerPendingAction', 'applyCapabilityMapperPendingAction', 'applyFocusTradeoffPendingAction', 'applyGrowthPathsPendingAction', 'applyMarketForcesPendingAction', 'applyNarrativeEnginePendingAction', 'applyOperationalPendingAction', 'applyPortfolioPendingAction', 'applyRiskPendingAction', 'applyValueChainPendingAction']) {
      expect(source, handler).toContain(handler);
    }
  });
});
