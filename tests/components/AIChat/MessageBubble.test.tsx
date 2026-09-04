/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { MessageBubble } from '../../../src/components/AIChat/Messages/MessageBubble';

const message = {
  id: 'message-332',
  role: 'user' as const,
  content: 'Treść wiadomości dyżuru 332',
  timestamp: new Date('2026-09-04T08:00:00Z'),
};

describe('MessageBubble Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<MessageBubble message={message} />);
    expect(screen.getByText('Treść wiadomości dyżuru 332')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<MessageBubble message={message} />);
    expect(container).toBeInTheDocument();
  });
});
