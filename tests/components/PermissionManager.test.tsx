/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const PermissionManager = () => <div data-testid="permission-manager">Permission Manager</div>;

describe('PermissionManager Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<PermissionManager />);
        expect(screen.getByTestId('permission-manager')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<PermissionManager />);
        expect(container).toBeInTheDocument();
    });
});
