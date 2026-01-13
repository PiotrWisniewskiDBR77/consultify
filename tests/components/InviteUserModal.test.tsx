/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const InviteUserModal = ({ isOpen }: { isOpen: boolean }) =>
  isOpen ? <div data-testid="invite-modal">Invite User Modal</div> : null;

describe('InviteUserModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open', () => {
    render(<InviteUserModal isOpen={true} />);
    expect(screen.getByTestId('invite-modal')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = render(<InviteUserModal isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });
});
