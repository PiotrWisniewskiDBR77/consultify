/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VersionHistory } from '../../../../components/Reports/Management/VersionHistory';

const mockVersions = [
    { id: 'v1', version: 1, createdAt: '2025-12-01T10:00:00Z', createdBy: 'John', status: 'DRAFT', changeSummary: 'Initial draft' },
    { id: 'v2', version: 2, createdAt: '2025-12-05T14:30:00Z', createdBy: 'Sarah', status: 'FINAL', changeSummary: 'Added ROI section' }
];

describe('VersionHistory Component', () => {
    const defaultProps = {
        versions: mockVersions,
        onViewVersion: vi.fn(),
        onRestoreVersion: vi.fn(),
        onCompareVersions: vi.fn()
    };

    it('renders the version list', () => {
        render(<VersionHistory {...defaultProps} />);
        expect(screen.getByText('Version 1')).toBeInTheDocument();
        expect(screen.getByText('Version 2')).toBeInTheDocument();
        expect(screen.getByText('Initial draft')).toBeInTheDocument();
        expect(screen.getByText('Added ROI section')).toBeInTheDocument();
    });

    it('allows selecting two versions for comparison', () => {
        const onCompareVersions = vi.fn();
        render(<VersionHistory {...defaultProps} onCompareVersions={onCompareVersions} />);

        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[1]);

        const compareButton = screen.getByRole('button', { name: /compare selected/i });
        fireEvent.click(compareButton);

        expect(onCompareVersions).toHaveBeenCalledWith('v1', 'v2');
    });

    it('calls onViewVersion when a version is clicked', () => {
        const onViewVersion = vi.fn();
        render(<VersionHistory {...defaultProps} onViewVersion={onViewVersion} />);

        const viewButton = screen.getAllByRole('button', { name: /view/i })[0];
        fireEvent.click(viewButton);

        expect(onViewVersion).toHaveBeenCalledWith('v1');
    });
});
