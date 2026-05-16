import { describe, expect, it } from 'vitest';

import {
  parseArtifactsFromResponse,
  stripArtifactsFromResponse,
} from '../../src/store/useArtifactsStore';

describe('AI chat artifact contract', () => {
  it('accepts artifact:comparison as comparison-matrix and strips raw block from visible text', () => {
    const response = [
      'Oto porównanie:',
      '```artifact:comparison:Porównanie kierunków rozwoju marketplace DBR77',
      '{"options":[{"name":"Partnerzy","summary":"Rozwój przez partnerów"}],"recommendation":"Start with partner modules"}',
      '```',
      'Rekomendacja jest powyżej.',
    ].join('\n');

    const artifacts = parseArtifactsFromResponse(response);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toEqual(
      expect.objectContaining({
        type: 'comparison-matrix',
        title: 'Porównanie kierunków rozwoju marketplace DBR77',
      })
    );
    expect(stripArtifactsFromResponse(response)).toBe('Oto porównanie:\n\nRekomendacja jest powyżej.');
  });
});
