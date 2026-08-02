import { describe, expect, it } from 'vitest';

import { IDEA_ACTION_REGISTRY } from '@/actions/ideaActionRegistry';
import {
  buildTeresaToolManifest,
  executeTeresaTool,
  resolveTeresaTool,
  shouldUseLegacyIdeaIntentFallback,
  toServerIdeaActionManifest,
  toolNameForAction,
} from '@/actions/teresaActionManifest';

describe('Teresa idea action manifest governance', () => {
  it('generates one unique governed tool for every registry action', () => {
    const manifest = buildTeresaToolManifest();
    const names = manifest.map((tool) => tool.function.name);

    expect(manifest).toHaveLength(IDEA_ACTION_REGISTRY.length);
    expect(new Set(names).size).toBe(names.length);
    for (const action of IDEA_ACTION_REGISTRY) {
      const name = toolNameForAction(action.id);
      expect(names).toContain(name);
      expect(resolveTeresaTool(name)?.id).toBe(action.id);
    }
  });

  it('filters tools by the active representation using registry availability', () => {
    const manifest = buildTeresaToolManifest({ tool: 'table' });
    const expected = IDEA_ACTION_REGISTRY.filter(
      (action) => action.tools === 'all' || action.tools.includes('table')
    );

    expect(manifest).toHaveLength(expected.length);
    expect(manifest.map((tool) => tool.function.name)).toEqual(
      expected.map((action) => toolNameForAction(action.id))
    );
  });

  it('serializes the OpenAI tool wrapper to the exact server bridge shape', () => {
    const serverManifest = toServerIdeaActionManifest(buildTeresaToolManifest({ tool: 'mindmap' }));

    expect(serverManifest.length).toBeGreaterThan(0);
    expect(serverManifest[0]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        description: expect.any(String),
        parameters: expect.objectContaining({ type: 'object' }),
      })
    );
    expect(serverManifest[0]).not.toHaveProperty('function');
  });

  it('disables local regex bypasses when the governed transport is enabled', () => {
    expect(shouldUseLegacyIdeaIntentFallback(false)).toBe(true);
    expect(shouldUseLegacyIdeaIntentFallback(true)).toBe(false);
  });

  it('fails closed for a hallucinated tool name', async () => {
    const result = await executeTeresaTool('not_in_the_registry', {
      ideaId: 'idea-1',
      tool: 'mindmap',
      selection: { type: 'none', count: 0, ids: [] },
    });

    expect(result.ok).toBe(false);
    expect(result.actionId).toBe('not_in_the_registry');
  });
});
