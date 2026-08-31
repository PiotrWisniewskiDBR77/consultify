import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadFeatureFlags } from '../../../server/src/config/FeatureFlags';
import { AI_TOOLS, getReadToolDefinitions } from '../../../server/src/services/ai/toolDefinitions';
import { SIDE_EFFECT_TOOLS } from '../../../server/src/services/ai/sideEffectTools';
import { estimateAgentToolCostUsd } from '../../../server/src/services/ai/toolCostEstimates';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Day206 Teresa READ tool loop contract', () => {
  it('keeps ENABLE_TERESA_TOOL_LOOP default OFF', () => {
    const previous = process.env.ENABLE_TERESA_TOOL_LOOP;
    delete process.env.ENABLE_TERESA_TOOL_LOOP;
    expect(loadFeatureFlags().ENABLE_TERESA_TOOL_LOOP).toBe(false);
    if (previous === undefined) delete process.env.ENABLE_TERESA_TOOL_LOOP;
    else process.env.ENABLE_TERESA_TOOL_LOOP = previous;
  });

  it('exposes exactly AI_TOOLS minus SIDE_EFFECT_TOOLS', () => {
    const expected = AI_TOOLS.map((tool) => tool.function.name).filter(
      (name) => !SIDE_EFFECT_TOOLS.has(name)
    );
    expect(getReadToolDefinitions().map((tool) => tool.name)).toEqual(expected);
    expect(expected).toHaveLength(11);
    expect(expected).not.toContain('query_structured_data');
  });

  it('has an explicit price for every READ tool', () => {
    const definitions = getReadToolDefinitions();
    expect(definitions.map((tool) => estimateAgentToolCostUsd(tool.name))).toHaveLength(
      definitions.length
    );
  });

  it('uses the governed READ dispatcher and gives it collision precedence', () => {
    const llm = source('server/src/services/ai/llmService.ts');
    expect(llm).toContain('executeReadTool(def.name');
    expect(llm).toContain('READ intentionally wins collisions');
    expect(llm).not.toContain(
      'mcpServer.execute(def.name, args, params.context as any);\n            // READ'
    );
  });

  it('emits only sanitized tool_step fields and enforces the paid-cost ceiling', () => {
    const route = source('server/src/routes/ai.routes.ts');
    expect(route).toContain("type: 'tool_step'");
    expect(route).toContain('paidCostUsd + estimatedCostUsd > maxPaidCostUsd');
    expect(route).not.toMatch(/type: 'tool_step'[^\n]*result/);
  });

  it('keeps the READ binding fully behind the OFF-by-default feature flag', () => {
    const pipeline = source('server/src/services/ai/AIPipeline.ts');
    const route = source('server/src/routes/ai.routes.ts');
    expect(pipeline).toContain('featureFlags.ENABLE_TERESA_TOOL_LOOP &&');
    expect(route).toContain('if (featureFlags.ENABLE_TERESA_TOOL_LOOP && !aiModes?.deepResearch)');
  });
});
