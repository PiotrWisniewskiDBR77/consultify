import { describe, expect, it } from 'vitest';

import {
  __private__,
  transformationCaseReadyMessage,
  transformationIntakeMissingLabels,
} from '../../../src/components/AIChat/UnifiedChatPanel';

const {
  firstMatchIndex,
  isLikelyAiFailureText,
  extractSlashPayload,
  parseChatSaveIntent,
  resolveWorkspaceArtifactKind,
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
    expect(parseChatSaveIntent('/note')).toEqual(expect.objectContaining({ target: 'note' }));
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

  it('forces Deck Builder context to presentation even when the prompt contains workbook signals', () => {
    const deckContext = {
      type: 'presentation',
      entityData: { artifactKind: 'deck', moduleKey: 'deckBuilder' },
    } as any;
    expect(resolveWorkspaceArtifactKind(deckContext)).toBe('presentation');
    expect(
      resolveWorkspaceArtifactKind({
        type: 'spreadsheet',
        entityData: { artifactKind: 'workbook' },
      } as any)
    ).toBe('sheet');
  });

  it('isLikelyAiFailureText flags empty/error strings', () => {
    expect(isLikelyAiFailureText('')).toBe(true);
    expect(isLikelyAiFailureText('AI returned no output')).toBe(true);
    expect(isLikelyAiFailureText('All good')).toBe(false);
  });

  it('localizes transformation follow-up keys without hiding unknown fields', () => {
    expect(transformationIntakeMissingLabels(['measurable_outcomes', 'scope'], 'pl')).toBe(
      'mierzalny wynik, zakres'
    );
    expect(transformationIntakeMissingLabels(['sponsor', 'custom_field'], 'en')).toBe(
      'sponsor, custom field'
    );
  });

  it('builds localized Case links with encoded query values', () => {
    const en = transformationCaseReadyMessage('case/with spaces&scope=1', 'en');
    expect(en).toContain('The plan was created');
    expect(en).toContain('/my-work?tab=agent&transformationCaseId=case%2Fwith+spaces%26scope%3D1');
    expect(transformationCaseReadyMessage('case-1', 'pl')).toContain('Plan został utworzony');
  });
});
