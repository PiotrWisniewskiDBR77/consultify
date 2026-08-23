import { describe, expect, it } from 'vitest';

import {
  CHAT_HEADER_ICON_CONTROL_CLASS,
  CHAT_HEADER_SELECTOR_CLASS,
} from '../chatHeaderControlStyles';

describe('Chat header owner feedback', () => {
  it('shares one measured geometry and Liquid Glass focus contract', () => {
    for (const className of [CHAT_HEADER_ICON_CONTROL_CLASS, CHAT_HEADER_SELECTOR_CLASS]) {
      expect(className).toContain('h-8');
      expect(className).toContain('rounded-xl');
      expect(className).toContain('border-white/30');
      expect(className).toContain('backdrop-blur-xl');
      expect(className).toContain('focus-visible:ring-2');
      expect(className).toContain('focus-visible:ring-c-focus');
    }
  });

  it('keeps icon and selector sizing intentionally distinct without changing radius', () => {
    expect(CHAT_HEADER_ICON_CONTROL_CLASS).toContain('w-8');
    expect(CHAT_HEADER_SELECTOR_CLASS).toContain('px-3');
    expect(CHAT_HEADER_SELECTOR_CLASS).not.toContain('w-8');
  });
});
