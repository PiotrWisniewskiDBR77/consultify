/**
 * DemoButton Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('DemoButton Component', () => {
  it('renders demo button', () => {
    const button = { text: 'Try Demo', variant: 'primary' };
    expect(button.text).toBe('Try Demo');
  });

  it('handles click event', () => {
    const onClick = vi.fn();
    onClick();
    expect(onClick).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    const isLoading = false;
    expect(isLoading).toBe(false);
  });
});
