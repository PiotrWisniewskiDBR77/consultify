/**
 * FIX-206 (pkt 3): trzy testy z tego pliku sprawdzały TEKST ŹRÓDŁOWY
 * (`readFileSync` + `toContain`) — przechodziły także wtedy, gdy pętla w ogóle
 * się nie wykonywała. Zostały zastąpione pomiarem ZACHOWANIA:
 *   · tests/unit/backend/ai/day206.toolLoopBehaviour.test.ts  (pipeline: flaga ON/OFF,
 *     realne wywołanie narzędzia i powrót wyniku — bramka dla dwóch mutacji),
 *   · tests/integration/ai/day206.toolLoopRoute.test.ts       (trasa: privateMode,
 *     timeout != completed, wycena kosztu, brak surowego wyniku w SSE).
 * Tutaj zostaje to, co i tak było wykonywalnym kontraktem modułów.
 */
import { describe, expect, it } from 'vitest';

import { loadFeatureFlags } from '../../../server/src/config/FeatureFlags';
import { AI_TOOLS, getReadToolDefinitions } from '../../../server/src/services/ai/toolDefinitions';
import { SIDE_EFFECT_TOOLS } from '../../../server/src/services/ai/sideEffectTools';
import { estimateAgentToolCostUsd } from '../../../server/src/services/ai/toolCostEstimates';

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



});
