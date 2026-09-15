/**
 * S1.14b / W11 — "Team Chat" did something else, silently.
 *
 * Measured on staging 13.09: clicking the kebab item on a `stage=seed` idea sent
 * `POST /api/my-work/my-ideas/:id/convert` (target team_chat), the idea moved
 * seed → promoted, and no chat opened — no confirmation, no explanation. The
 * server DOES create the conversation; the UI simply never used it and never said
 * the stage had changed.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { describe, expect, it } from 'vitest';

import { describeIdeaConversion } from '../ideaConversionOutcome';

describe('S1.14b/W11 — describeIdeaConversion', () => {
  it('sends the user to the conversation the action just created', () => {
    const outcome = describeIdeaConversion('team_chat', {
      created: { conversationId: 'conv-42' },
    });
    expect(outcome.href).toBe('/chat/conv-42');
  });

  it('names the stage change instead of saying only "Done"', () => {
    const outcome = describeIdeaConversion('team_chat', {
      created: { conversationId: 'conv-42' },
    });
    expect(outcome.toastDefault).toContain('Team chat thread created');
    expect(outcome.toastDefault).toContain('Promoted');
    expect(outcome.toastDefault).not.toBe('Done');
  });

  it('falls back to promotedEntityId when created.conversationId is absent', () => {
    const outcome = describeIdeaConversion('team_chat', { promotedEntityId: 'conv-7' });
    expect(outcome.href).toBe('/chat/conv-7');
  });

  it('stays on the list when the server returned no conversation id', () => {
    expect(describeIdeaConversion('team_chat', {}).href).toBeNull();
  });

  it.each([
    ['initiative', 'initiativeId', 'init-42', '/initiatives?'],
    ['decision', 'decisionId', 'dec-42', '/my-work?decisionId=dec-42'],
    ['report', 'reportId', 'rep-42', '/wordy?artifactId=rep-42'],
    ['presentation', 'presentationId', 'deck-42', '/prezentacje?artifactId=deck-42'],
  ] as const)(
    'returns a visible receipt and open link for %s',
    (target, createdKey, id, expectedPath) => {
      const outcome = describeIdeaConversion(target, { created: { [createdKey]: id } });
      expect(outcome.entityId).toBe(id);
      expect(outcome.toastDefault).toContain(id);
      expect(outcome.toastDefault).not.toBe('Done');
      expect(outcome.href).toContain(expectedPath);
    }
  );

  it('uses promotedEntityId as the receipt fallback', () => {
    const outcome = describeIdeaConversion('initiative', { promotedEntityId: 'init-fallback' });
    expect(outcome.entityId).toBe('init-fallback');
    expect(outcome.href).toContain('open=init-fallback');
  });

  it('does not invent an identifier or open link when the server omits the receipt', () => {
    const outcome = describeIdeaConversion('report', {});
    expect(outcome.entityId).toBeNull();
    expect(outcome.href).toBeNull();
    expect(outcome.toastDefault).toContain('no identifier');
  });
});

describe('S1.14b/W11 — the list uses the outcome', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/components/MyWork/MyIdeasListContent.tsx'),
    'utf8'
  );

  it('routes every conversion toast + navigation through describeIdeaConversion', () => {
    expect(source).toContain("from './ideaConversionOutcome'");
    expect(source).toContain('describeIdeaConversion(target, result)');
    expect(source).toContain('window.location.assign(outcome.href)');
  });
});
