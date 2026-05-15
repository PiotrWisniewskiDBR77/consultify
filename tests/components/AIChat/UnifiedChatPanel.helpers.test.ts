import { describe, expect, it } from 'vitest';

import { __private__ } from '../../../src/components/AIChat/UnifiedChatPanel';

const {
  firstMatchIndex,
  isLikelyAiFailureText,
  extractSlashPayload,
  parseChatSaveIntent,
  detectCoreNavigationIntent,
} = __private__;

describe('UnifiedChatPanel helpers (L2)', () => {
  it('firstMatchIndex returns the earliest match across patterns', () => {
    const text = 'save idea then note';
    const idx = firstMatchIndex(text, [/note/i, /idea/i]);
    expect(idx).toBe(text.indexOf('idea'));
  });

  it('extractSlashPayload returns payload or empty string for bare commands', () => {
    expect(extractSlashPayload('/note hello', ['/note'])).toBe('hello');
    expect(extractSlashPayload('/note', ['/note'])).toBe('');
    expect(extractSlashPayload('random', ['/note'])).toBeNull();
  });

  it('parseChatSaveIntent handles slash commands and save phrases', () => {
    expect(parseChatSaveIntent('/note')).toEqual(
      expect.objectContaining({ target: 'note' })
    );
    expect(parseChatSaveIntent('/idea Build')).toEqual(
      expect.objectContaining({ target: 'idea', cleanPrompt: 'Build' })
    );
    expect(parseChatSaveIntent('zapisz notatke z tego')).toEqual(
      expect.objectContaining({ target: 'note' })
    );
    expect(parseChatSaveIntent('please save idea now')).toEqual(
      expect.objectContaining({ target: 'idea' })
    );
    expect(parseChatSaveIntent('just chatting')).toBeNull();
  });

  it('parseChatSaveIntent chooses first match when both idea and note exist', () => {
    const noteFirst = parseChatSaveIntent('zapisz notatke i pomysl');
    expect(noteFirst).toEqual(expect.objectContaining({ target: 'note' }));

    const ideaFirst = parseChatSaveIntent('zapisz pomysl i notatke');
    expect(ideaFirst).toEqual(expect.objectContaining({ target: 'idea' }));
  });

  it('isLikelyAiFailureText flags empty/error strings', () => {
    expect(isLikelyAiFailureText('')).toBe(true);
    expect(isLikelyAiFailureText('AI returned no output')).toBe(true);
    expect(isLikelyAiFailureText('All good')).toBe(false);
  });

  it('detectCoreNavigationIntent maps explicit Teresa navigation requests', () => {
    expect(detectCoreNavigationIntent('open my work inbox')).toEqual(
      expect.objectContaining({ target: 'my_work', route: '/my-work?source=teresa&tab=inbox' })
    );
    expect(detectCoreNavigationIntent('go to interview assignments')).toEqual(
      expect.objectContaining({
        target: 'interview',
        route: '/interview?source=teresa&tab=my_assignments',
      })
    );
    expect(detectCoreNavigationIntent('show me portfolio')).toEqual(
      expect.objectContaining({ target: 'portfolio', route: '/portfolio?source=teresa' })
    );
    expect(detectCoreNavigationIntent('open benefits module')).toEqual(
      expect.objectContaining({ target: 'benefits', route: '/benefits?source=teresa' })
    );
    expect(detectCoreNavigationIntent('draft a quarterly report')).toBeNull();
  });
});
