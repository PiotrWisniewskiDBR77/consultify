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

  it('does not render when chat is already open', () => {
    aiContextState.isChatOpen = true;
    render(<ChatToggleButton />);
    expect(screen.queryByTitle('AI Assistant')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Asystent AI')).not.toBeInTheDocument();
  });

  it('falls back to English title for non-PL languages', () => {
    i18nState.language = 'fr';
    render(<ChatToggleButton />);
    expect(screen.getByTitle('AI Assistant')).toBeInTheDocument();
  });

  it('uses Polish title and shows green context dot when projectId is present', () => {
    i18nState.language = 'pl';
    aiContextState.pmoContext = { projectId: 'p1' };

    render(<ChatToggleButton />);
    expect(screen.getByTitle('Asystent AI')).toBeInTheDocument();

    // The dot is a tiny span with animate-pulse class
    expect(document.querySelector('span.animate-pulse')).toBeTruthy();
  });

  it('does not show context dot when projectId is missing', () => {
    render(<ChatToggleButton />);
    expect(document.querySelector('span.animate-pulse')).toBeFalsy();
  });
});
