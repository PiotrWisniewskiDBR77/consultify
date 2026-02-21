/**
 * ChatToggleButton Component Tests
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ChatToggleButton } from '../../../src/components/AIChat/ChatToggleButton';

const aiContextState: any = {
  toggleChat: vi.fn(),
  pmoContext: { projectId: undefined },
  isChatOpen: false,
};

vi.mock('../../../src/contexts/AIContext', () => ({
  useAIContext: () => aiContextState,
}));

const i18nState: any = { language: 'en' };
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: i18nState }),
}));

describe('ChatToggleButton (L2)', () => {
  beforeEach(() => {
    aiContextState.toggleChat.mockClear();
    aiContextState.pmoContext = { projectId: undefined };
    aiContextState.isChatOpen = false;
    i18nState.language = 'en';
  });

  it('renders when chat is closed and calls toggleChat on click (EN title)', () => {
    render(<ChatToggleButton />);
    const btn = screen.getByTitle('AI Assistant');
    fireEvent.click(btn);
    expect(aiContextState.toggleChat).toHaveBeenCalledTimes(1);
  });

  it('uses Polish title and shows green context dot when projectId is present', () => {
    i18nState.language = 'pl';
    aiContextState.pmoContext = { projectId: 'p1' };

    render(<ChatToggleButton />);
    expect(screen.getByTitle('Asystent AI')).toBeInTheDocument();

    // The dot is a tiny span with animate-pulse class
    expect(document.querySelector('span.animate-pulse')).toBeTruthy();
  });
});

