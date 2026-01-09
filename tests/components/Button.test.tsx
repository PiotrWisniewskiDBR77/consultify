/**
 * Button Component Tests
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../../src/components/ui/Button';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        button: ({ children, className, disabled, whileTap, transition, ...props }: any) => (
            <button className={className} disabled={disabled} {...props}>
                {children}
            </button>
        ),
    },
}));

describe('Button Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render button with text', () => {
            render(<Button>Click Me</Button>);

            expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
        });

        it('should render as button element', () => {
            render(<Button>Test</Button>);

            expect(screen.getByRole('button')).toBeInTheDocument();
        });

        it('should render children correctly', () => {
            render(<Button>Save Changes</Button>);

            expect(screen.getByText('Save Changes')).toBeInTheDocument();
        });
    });

    describe('Variants', () => {
        it('should apply primary variant by default', () => {
            render(<Button>Primary</Button>);

            const button = screen.getByRole('button');
            expect(button).toHaveClass('text-white');
        });

        it('should apply secondary variant styles', () => {
            render(<Button variant="secondary">Secondary</Button>);

            const button = screen.getByRole('button');
            expect(button.className).toContain('bg-slate');
        });

        it('should apply ghost variant styles', () => {
            render(<Button variant="ghost">Ghost</Button>);

            const button = screen.getByRole('button');
            expect(button).toHaveClass('bg-transparent');
        });

        it('should apply danger variant styles', () => {
            render(<Button variant="danger">Delete</Button>);

            const button = screen.getByRole('button');
            expect(button).toHaveClass('text-white');
        });

        it('should apply outline variant styles', () => {
            render(<Button variant="outline">Outline</Button>);

            const button = screen.getByRole('button');
            expect(button).toHaveClass('bg-transparent');
        });
    });

    describe('Sizes', () => {
        it('should apply medium size by default', () => {
            render(<Button>Medium</Button>);

            const button = screen.getByRole('button');
            expect(button).toHaveClass('text-sm');
        });

        it('should apply small size', () => {
            render(<Button size="sm">Small</Button>);

            const button = screen.getByRole('button');
            expect(button).toHaveClass('text-xs');
        });

        it('should apply large size', () => {
            render(<Button size="lg">Large</Button>);

            const button = screen.getByRole('button');
            expect(button).toHaveClass('text-base');
        });
    });

    describe('Click Handling', () => {
        it('should call onClick when clicked', async () => {
            const handleClick = vi.fn();
            const user = userEvent.setup();
            render(<Button onClick={handleClick}>Click</Button>);

            await user.click(screen.getByRole('button'));

            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        it('should not call onClick when disabled', async () => {
            const handleClick = vi.fn();
            const user = userEvent.setup();
            render(<Button onClick={handleClick} disabled>Disabled</Button>);

            await user.click(screen.getByRole('button'));

            expect(handleClick).not.toHaveBeenCalled();
        });
    });

    describe('Disabled State', () => {
        it('should apply disabled attribute', () => {
            render(<Button disabled>Disabled</Button>);

            expect(screen.getByRole('button')).toBeDisabled();
        });

        it('should have disabled styles', () => {
            render(<Button disabled>Disabled</Button>);

            expect(screen.getByRole('button')).toHaveClass('disabled:opacity-50');
        });
    });

    describe('Loading State', () => {
        it('should be disabled when loading', () => {
            render(<Button loading>Loading</Button>);

            expect(screen.getByRole('button')).toBeDisabled();
        });

        it('should show spinner when loading', () => {
            render(<Button loading>Loading</Button>);

            // Loader2 icon has animate-spin class
            const spinner = screen.getByRole('button').querySelector('.animate-spin');
            expect(spinner).toBeInTheDocument();
        });
    });

    describe('Full Width', () => {
        it('should apply full width class', () => {
            render(<Button fullWidth>Full Width</Button>);

            expect(screen.getByRole('button')).toHaveClass('w-full');
        });
    });

    describe('Icons', () => {
        it('should render left icon', () => {
            render(<Button icon={<span data-testid="left-icon">👈</span>}>With Icon</Button>);

            expect(screen.getByTestId('left-icon')).toBeInTheDocument();
        });

        it('should render right icon', () => {
            render(<Button iconRight={<span data-testid="right-icon">👉</span>}>With Icon</Button>);

            expect(screen.getByTestId('right-icon')).toBeInTheDocument();
        });

        it('should not show icons when loading', () => {
            render(
                <Button
                    loading
                    icon={<span data-testid="left-icon">👈</span>}
                    iconRight={<span data-testid="right-icon">👉</span>}
                >
                    Loading
                </Button>
            );

            expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument();
            expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should be focusable', () => {
            render(<Button>Focus Me</Button>);

            const button = screen.getByRole('button');
            button.focus();

            expect(document.activeElement).toBe(button);
        });

        it('should accept custom className', () => {
            render(<Button className="custom-class">Custom</Button>);

            expect(screen.getByRole('button')).toHaveClass('custom-class');
        });
    });
});
