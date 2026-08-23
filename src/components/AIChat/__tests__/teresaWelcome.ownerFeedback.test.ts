import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getSafeTeresaWelcomeFirstName } from '../teresaWelcome';

describe('Teresa welcome owner feedback', () => {
  it('normalizes a safe first name and falls back without leaking stale identity', () => {
    expect(getSafeTeresaWelcomeFirstName('  Piotr Wiśniewski  ')).toBe('Piotr');
    expect(getSafeTeresaWelcomeFirstName('')).toBeNull();
    expect(getSafeTeresaWelcomeFirstName(undefined)).toBeNull();
    expect(getSafeTeresaWelcomeFirstName('A'.repeat(80))).toHaveLength(40);
  });

  it('uses the broader personalized Teresa direction and keeps punctuation neutral', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../UnifiedChatPanel.tsx'), 'utf8');
    expect(source).toContain("t('aiChat.teresaWelcome', 'Talk to Teresa')");
    expect(source).toContain('<span className="text-c-ai">{teresaWelcomeFirstName}</span>');
    expect(source).toContain('<span className="text-c-text">.</span>');
    expect(source).not.toContain("Let's start your transformation");
    expect(source).toContain('Bring a challenge, decision, idea, or document.');
    expect(source).toContain('text-4xl font-semibold tracking-tight text-c-text/70');

    const en = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../../../../public/locales/en/translation.json'),
        'utf8'
      )
    );
    const pl = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../../../../public/locales/pl/translation.json'),
        'utf8'
      )
    );
    expect(en.aiChat.teresaWelcome).toBe('Talk to Teresa');
    expect(pl.aiChat.teresaWelcome).toBe('Porozmawiaj z Teresą');
    expect(en.aiChat.teresaWelcomeSubtitle).not.toMatch(/transformation/i);
    expect(pl.aiChat.teresaWelcomeSubtitle).not.toMatch(/transformacj/i);
  });
});
