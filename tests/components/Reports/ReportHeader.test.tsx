/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportHeader } from '../../components/Reports/ReportHeader';

// Mock i18n

const defaultProps = {
    name: 'Q4 Assessment Report',
    status: 'DRAFT' as const,
    organizationName: 'Acme Corp',
    assessmentName: 'Digital Maturity Assessment',
    progress: 65,
    hasUnsavedChanges: false,
    isSaving: false,
    isLoading: false,
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-15T14:30:00Z',
    onBack: vi.fn(),
    onSave: vi.fn(),
    onFinalize: vi.fn(),
    onRegenerate: vi.fn(),
    onExportPdf: vi.fn(),
    onExportExcel: vi.fn()
};

describe('ReportHeader Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('renders report name', () => {
            render(<ReportHeader {...defaultProps} />);

            expect(screen.getByText('Q4 Assessment Report')).toBeInTheDocument();
        });

        it('renders organization name', () => {
            render(<ReportHeader {...defaultProps} />);

            expect(screen.getByText('Acme Corp')).toBeInTheDocument();
        });

        it('renders assessment name', () => {
            render(<ReportHeader {...defaultProps} />);

            expect(screen.getByText('Digital Maturity Assessment')).toBeInTheDocument();
        });

        it('uses fallback for missing name', () => {
            render(<ReportHeader {...defaultProps} name="" />);

            expect(screen.getByText('Untitled Report')).toBeInTheDocument();
        });
    });

    describe('Status Badge', () => {
        it('shows Draft badge for DRAFT status', () => {
            render(<ReportHeader {...defaultProps} status="DRAFT" />);

            expect(screen.getByText('Draft')).toBeInTheDocument();
        });

        it('shows Final badge for FINAL status', () => {
            render(<ReportHeader {...defaultProps} status="FINAL" />);

            expect(screen.getByText('Final')).toBeInTheDocument();
        });

        it('shows Archived badge for ARCHIVED status', () => {
            render(<ReportHeader {...defaultProps} status="ARCHIVED" />);

            expect(screen.getByText('Archived')).toBeInTheDocument();
        });
    });

    describe('Unsaved Changes Indicator', () => {
        it('shows Unsaved badge when hasUnsavedChanges is true', () => {
            render(<ReportHeader {...defaultProps} hasUnsavedChanges={true} />);

            expect(screen.getByText('Unsaved')).toBeInTheDocument();
        });

        it('hides Unsaved badge when hasUnsavedChanges is false', () => {
            render(<ReportHeader {...defaultProps} hasUnsavedChanges={false} />);

            expect(screen.queryByText('Unsaved')).not.toBeInTheDocument();
        });
    });

    describe('Back Button', () => {
        it('calls onBack when clicked', async () => {
            render(<ReportHeader {...defaultProps} />);

            const backButton = screen.getByTitle('Back');
            await user.click(backButton);

            expect(defaultProps.onBack).toHaveBeenCalled();
        });
    });

    describe('Save Button', () => {
        it('enables save button when hasUnsavedChanges', () => {
            render(<ReportHeader {...defaultProps} hasUnsavedChanges={true} />);

            const saveButton = screen.getByText('Save').closest('button');
            expect(saveButton).not.toBeDisabled();
        });

        it('disables save button when no unsaved changes', () => {
            render(<ReportHeader {...defaultProps} hasUnsavedChanges={false} />);

            const saveButton = screen.getByText('Save').closest('button');
            expect(saveButton).toBeDisabled();
        });

        it('disables save button when saving', () => {
            render(<ReportHeader {...defaultProps} hasUnsavedChanges={true} isSaving={true} />);

            const saveButton = document.querySelector('button:disabled');
            expect(saveButton).toBeTruthy();
        });

        it('calls onSave when clicked', async () => {
            render(<ReportHeader {...defaultProps} hasUnsavedChanges={true} />);

            await user.click(screen.getByText('Save'));

            expect(defaultProps.onSave).toHaveBeenCalled();
        });

        it('hides save button for FINAL status', () => {
            render(<ReportHeader {...defaultProps} status="FINAL" />);

            expect(screen.queryByText('Save')).not.toBeInTheDocument();
        });
    });

    describe('Finalize Button', () => {
        it('renders for DRAFT status', () => {
            render(<ReportHeader {...defaultProps} />);

            expect(screen.getByText('Finalize')).toBeInTheDocument();
        });

        it('hides for FINAL status', () => {
            render(<ReportHeader {...defaultProps} status="FINAL" />);

            expect(screen.queryByText('Finalize')).not.toBeInTheDocument();
        });

        it('disables when hasUnsavedChanges', () => {
            render(<ReportHeader {...defaultProps} hasUnsavedChanges={true} />);

            const finalizeButton = screen.getByText('Finalize').closest('button');
            expect(finalizeButton).toBeDisabled();
        });

        it('calls onFinalize when clicked', async () => {
            render(<ReportHeader {...defaultProps} />);

            await user.click(screen.getByText('Finalize'));

            expect(defaultProps.onFinalize).toHaveBeenCalled();
        });
    });

    describe('Export Menu', () => {
        it('shows export button', () => {
            render(<ReportHeader {...defaultProps} />);

            expect(screen.getByText('Export')).toBeInTheDocument();
        });

        it('opens export menu on click', async () => {
            render(<ReportHeader {...defaultProps} />);

            await user.click(screen.getByText('Export'));

            expect(screen.getByText('Export as PDF')).toBeInTheDocument();
            expect(screen.getByText('Export as Excel')).toBeInTheDocument();
        });

        it('calls onExportPdf when PDF option clicked', async () => {
            render(<ReportHeader {...defaultProps} />);

            await user.click(screen.getByText('Export'));
            await user.click(screen.getByText('Export as PDF'));

            expect(defaultProps.onExportPdf).toHaveBeenCalled();
        });

        it('calls onExportExcel when Excel option clicked', async () => {
            render(<ReportHeader {...defaultProps} />);

            await user.click(screen.getByText('Export'));
            await user.click(screen.getByText('Export as Excel'));

            expect(defaultProps.onExportExcel).toHaveBeenCalled();
        });

        it('closes menu after selection', async () => {
            render(<ReportHeader {...defaultProps} />);

            await user.click(screen.getByText('Export'));
            await user.click(screen.getByText('Export as PDF'));

            expect(screen.queryByText('Export as PDF')).not.toBeInTheDocument();
        });
    });

    describe('More Menu', () => {
        it('opens more menu on click', async () => {
            render(<ReportHeader {...defaultProps} />);

            const moreButton = document.querySelectorAll('button')[document.querySelectorAll('button').length - 1];
            await user.click(moreButton);

            expect(screen.getByText('Regenerate Report')).toBeInTheDocument();
        });

        it('shows regenerate option for DRAFT', async () => {
            render(<ReportHeader {...defaultProps} />);

            const moreButton = document.querySelectorAll('button')[document.querySelectorAll('button').length - 1];
            await user.click(moreButton);

            expect(screen.getByText('Regenerate Report')).toBeInTheDocument();
        });

        it('calls onRegenerate when clicked', async () => {
            render(<ReportHeader {...defaultProps} />);

            const moreButton = document.querySelectorAll('button')[document.querySelectorAll('button').length - 1];
            await user.click(moreButton);
            await user.click(screen.getByText('Regenerate Report'));

            expect(defaultProps.onRegenerate).toHaveBeenCalled();
        });

        it('shows created and updated dates', async () => {
            render(<ReportHeader {...defaultProps} />);

            const moreButton = document.querySelectorAll('button')[document.querySelectorAll('button').length - 1];
            await user.click(moreButton);

            expect(screen.getByText('Created:')).toBeInTheDocument();
            expect(screen.getByText('Updated:')).toBeInTheDocument();
        });
    });

    describe('Progress Bar', () => {
        it('renders progress bar', () => {
            render(<ReportHeader {...defaultProps} />);

            const progressBar = document.querySelector('[style*="width: 65%"]');
            expect(progressBar).toBeTruthy();
        });

        it('updates progress correctly', () => {
            render(<ReportHeader {...defaultProps} progress={80} />);

            const progressBar = document.querySelector('[style*="width: 80%"]');
            expect(progressBar).toBeTruthy();
        });
    });

    describe('Loading State', () => {
        it('shows loading overlay when isLoading', () => {
            render(<ReportHeader {...defaultProps} isLoading={true} />);

            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });

        it('hides loading overlay when not loading', () => {
            render(<ReportHeader {...defaultProps} isLoading={false} />);

            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });
    });

    describe('Fullscreen Button', () => {
        it('renders fullscreen button when onFullscreen provided', () => {
            const onFullscreen = vi.fn();
            render(<ReportHeader {...defaultProps} onFullscreen={onFullscreen} />);

            expect(screen.getByText('Fullscreen')).toBeInTheDocument();
        });

        it('does not render when onFullscreen not provided', () => {
            render(<ReportHeader {...defaultProps} />);

            expect(screen.queryByText('Fullscreen')).not.toBeInTheDocument();
        });

        it('shows Exit when isFullscreen true', () => {
            const onFullscreen = vi.fn();
            render(<ReportHeader {...defaultProps} onFullscreen={onFullscreen} isFullscreen={true} />);

            expect(screen.getByText('Exit')).toBeInTheDocument();
        });

        it('calls onFullscreen when clicked', async () => {
            const onFullscreen = vi.fn();
            render(<ReportHeader {...defaultProps} onFullscreen={onFullscreen} />);

            await user.click(screen.getByText('Fullscreen'));

            expect(onFullscreen).toHaveBeenCalled();
        });
    });

    describe('Accessibility', () => {
        it('has accessible back button with title', () => {
            render(<ReportHeader {...defaultProps} />);

            expect(screen.getByTitle('Back')).toBeInTheDocument();
        });

        it('uses semantic header element', () => {
            render(<ReportHeader {...defaultProps} />);

            const header = document.querySelector('header');
            expect(header).toBeTruthy();
        });

        it('has heading for report name', () => {
            render(<ReportHeader {...defaultProps} />);

            const heading = screen.getByRole('heading', { level: 1 });
            expect(heading).toHaveTextContent('Q4 Assessment Report');
        });
    });

    describe('Dark Mode Support', () => {
        it('includes dark mode classes', () => {
            render(<ReportHeader {...defaultProps} />);

            const header = document.querySelector('header');
            expect(header).toHaveClass('dark:bg-navy-900');
        });
    });
});











