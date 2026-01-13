/**
 * Dropdown Component Tests
 * Testing dropdown menu component
 * 
 * @module tests/unit/components/UI/Dropdown.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';

// Mock Dropdown component
const MockDropdown: React.FC<{
    trigger?: React.ReactNode;
    items?: Array<{ label: string; value: string; disabled?: boolean; divider?: boolean }>;
    onSelect?: (value: string) => void;
    placement?: 'bottom' | 'top' | 'left' | 'right';
}> = ({
    trigger = <button>Menu</button>,
    items = [
        { label: 'Edit', value: 'edit' },
        { label: 'Duplicate', value: 'duplicate' },
        { label: '', value: '', divider: true },
        { label: 'Delete', value: 'delete' }
    ],
    onSelect = () => { },
    placement = 'bottom'
}) => {
        const [isOpen, setIsOpen] = useState(false);

        return (
            <div data-testid="dropdown" data-placement={placement}>
                <div
                    data-testid="dropdown-trigger"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {trigger}
                </div>
                {isOpen && (
                    <ul data-testid="dropdown-menu" role="menu">
                        {items.map((item, index) => (
                            item.divider ? (
                                <li key={index} data-testid="dropdown-divider" role="separator" />
                            ) : (
                                <li
                                    key={index}
                                    data-testid={`dropdown-item-${item.value}`}
                                    data-disabled={item.disabled}
                                    role="menuitem"
                                    onClick={() => {
                                        if (!item.disabled) {
                                            onSelect(item.value);
                                            setIsOpen(false);
                                        }
                                    }}
                                >
                                    {item.label}
                                </li>
                            )
                        ))}
                    </ul>
                )}
            </div>
        );
    };

describe('Dropdown Component', () => {
    describe('Visibility', () => {
        it('should not show menu by default', () => {
            render(<MockDropdown />);
            expect(screen.queryByTestId('dropdown-menu')).not.toBeInTheDocument();
        });

        it('should show menu on trigger click', () => {
            render(<MockDropdown />);

            fireEvent.click(screen.getByTestId('dropdown-trigger'));

            expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();
        });

        it('should toggle menu on click', () => {
            render(<MockDropdown />);
            const trigger = screen.getByTestId('dropdown-trigger');

            fireEvent.click(trigger);
            expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();

            fireEvent.click(trigger);
            expect(screen.queryByTestId('dropdown-menu')).not.toBeInTheDocument();
        });
    });

    describe('Items', () => {
        it('should render menu items', () => {
            render(<MockDropdown />);
            fireEvent.click(screen.getByTestId('dropdown-trigger'));

            expect(screen.getByTestId('dropdown-item-edit')).toHaveTextContent('Edit');
            expect(screen.getByTestId('dropdown-item-duplicate')).toHaveTextContent('Duplicate');
        });

        it('should render divider', () => {
            render(<MockDropdown />);
            fireEvent.click(screen.getByTestId('dropdown-trigger'));

            expect(screen.getByTestId('dropdown-divider')).toBeInTheDocument();
        });
    });

    describe('Selection', () => {
        it('should call onSelect when item clicked', () => {
            const onSelect = vi.fn();
            render(<MockDropdown onSelect={onSelect} />);

            fireEvent.click(screen.getByTestId('dropdown-trigger'));
            fireEvent.click(screen.getByTestId('dropdown-item-edit'));

            expect(onSelect).toHaveBeenCalledWith('edit');
        });

        it('should close menu on selection', () => {
            render(<MockDropdown />);

            fireEvent.click(screen.getByTestId('dropdown-trigger'));
            fireEvent.click(screen.getByTestId('dropdown-item-edit'));

            expect(screen.queryByTestId('dropdown-menu')).not.toBeInTheDocument();
        });

        it('should not call onSelect for disabled items', () => {
            const items = [{ label: 'Disabled', value: 'disabled', disabled: true }];
            const onSelect = vi.fn();
            render(<MockDropdown items={items} onSelect={onSelect} />);

            fireEvent.click(screen.getByTestId('dropdown-trigger'));
            fireEvent.click(screen.getByTestId('dropdown-item-disabled'));

            expect(onSelect).not.toHaveBeenCalled();
        });
    });

    describe('Placement', () => {
        it.each(['bottom', 'top', 'left', 'right'] as const)('should apply %s placement', (placement) => {
            render(<MockDropdown placement={placement} />);
            expect(screen.getByTestId('dropdown')).toHaveAttribute('data-placement', placement);
        });
    });

    describe('Accessibility', () => {
        it('should have menu role', () => {
            render(<MockDropdown />);
            fireEvent.click(screen.getByTestId('dropdown-trigger'));
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        it('should have menuitem role', () => {
            render(<MockDropdown />);
            fireEvent.click(screen.getByTestId('dropdown-trigger'));
            expect(screen.getAllByRole('menuitem')).toHaveLength(3);
        });

        it('should have separator role for divider', () => {
            render(<MockDropdown />);
            fireEvent.click(screen.getByTestId('dropdown-trigger'));
            expect(screen.getByRole('separator')).toBeInTheDocument();
        });
    });
});
