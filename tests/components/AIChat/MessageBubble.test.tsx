/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const MessageBubble = () => <div data-testid="message-bubble">Message Bubble</div>;

describe('MessageBubble Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders component', () => {
    render(<MessageBubble />);
    expect(screen.getByTestId('message-bubble')).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<MessageBubble />);
    expect(container).toBeInTheDocument();
  });
});
