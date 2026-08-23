import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  getHydratedTeresaWelcomeFirstName,
  getSafeTeresaWelcomeFirstName,
} from '../teresaWelcome';

describe('Teresa welcome owner feedback', () => {
  it('normalizes a safe first name and falls back without leaking stale identity', () => {
    expect(getSafeTeresaWelcomeFirstName('  Piotr Wiśniewski  ')).toBe('Piotr');
    expect(getSafeTeresaWelcomeFirstName('')).toBeNull();
    expect(getSafeTeresaWelcomeFirstName(undefined)).toBeNull();
    expect(getSafeTeresaWelcomeFirstName('A'.repeat(80))).toBeNull();
    expect(getSafeTeresaWelcomeFirstName('Anne-Marie Example')).toBe('Anne-Marie');
    expect(getSafeTeresaWelcomeFirstName('Łukasz Żółć')).toBe('Łukasz');
    expect(getSafeTeresaWelcomeFirstName('piotr@example.com')).toBeNull();
    expect(getSafeTeresaWelcomeFirstName('user_123')).toBeNull();
    expect(getSafeTeresaWelcomeFirstName('<script>')).toBeNull();
    expect(getSafeTeresaWelcomeFirstName('undefined')).toBeNull();
    expect(getSafeTeresaWelcomeFirstName('guest')).toBeNull();
    expect(getSafeTeresaWelcomeFirstName('test')).toBeNull();
    expect(getSafeTeresaWelcomeFirstName('demo')).toBeNull();
  });

  it('personalizes only after authenticated identity hydration completes', () => {
    const readyIdentity = {
      firstName: 'Piotr',
      userId: 'user-1',
      isAuthenticated: true,
      isAuthInitializing: false,
    };
    expect(getHydratedTeresaWelcomeFirstName(readyIdentity)).toBe('Piotr');
    expect(
      getHydratedTeresaWelcomeFirstName({ ...readyIdentity, isAuthInitializing: true })
    ).toBeNull();
    expect(
      getHydratedTeresaWelcomeFirstName({ ...readyIdentity, isAuthenticated: false })
    ).toBeNull();
    expect(getHydratedTeresaWelcomeFirstName({ ...readyIdentity, userId: '' })).toBeNull();
    expect(getHydratedTeresaWelcomeFirstName({ ...readyIdentity, firstName: '' })).toBeNull();
  });

  it('uses the broader personalized Teresa direction and keeps punctuation neutral', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../UnifiedChatPanel.tsx'), 'utf8');
    expect(source).toContain("t('aiChat.teresaWelcome', 'Talk to Teresa')");
    expect(source).toContain('getHydratedTeresaWelcomeFirstName({');
    expect(source).toContain('isAuthInitializing,');
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
