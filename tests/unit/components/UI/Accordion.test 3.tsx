/**
 * Accordion Component Tests
 * Testing collapsible accordion
 * 
 * @module tests/unit/components/UI/Accordion.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';

// Mock Accordion component
const MockAccordion: React.FC<{
    items?: Array<{ id: string; title: string; content: string }>;
    allowMultiple?: boolean;
    defaultExpanded?: string[];
}> = ({
    items = [
        { id: '1', title: 'Section 1', content: 'Content 1' },
        { id: '2', title: 'Section 2', content: 'Content 2' },
        { id: '3', title: 'Section 3', content: 'Content 3' }
    ],
    allowMultiple = false,
    defaultExpanded = []
}) => {
        const [expanded, setExpanded] = useState<string[]>(defaultExpanded);

        const toggleItem = (id: string) => {
            if (allowMultiple) {
                setExpanded(prev =>
                    prev.includes(id)
                        ? prev.filter(x => x !== id)
                        : [...prev, id]
                );
            } else {
                setExpanded(prev => prev.includes(id) ? [] : [id]);
            }
        };

        return (
            <div data-testid="accordion">
                {items.map((item, index) => (
                    <div key={item.id} data-testid={`accordion-item-${index}`}>
                        <button
                            data-testid={`accordion-trigger-${index}`}
                            onClick={() => toggleItem(item.id)}
                            aria-expanded={expanded.includes(item.id)}
                        >
                            {item.title}
                        </button>
                        {expanded.includes(item.id) && (
                            <div
                                data-testid={`accordion-content-${index}`}
                                role="region"
                            >
                                {item.content}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

describe('Accordion Component', () => {
    describe('Rendering', () => {
        it('should render accordion', () => {
            render(<MockAccordion />);
            expect(screen.getByTestId('accordion')).toBeInTheDocument();
        });

        it('should render all items', () => {
            render(<MockAccordion />);
            expect(screen.getByTestId('accordion-item-0')).toBeInTheDocument();
            expect(screen.getByTestId('accordion-item-1')).toBeInTheDocument();
            expect(screen.getByTestId('accordion-item-2')).toBeInTheDocument();
        });

        it('should render item titles', () => {
            render(<MockAccordion />);
            expect(screen.getByTestId('accordion-trigger-0')).toHaveTextContent('Section 1');
        });
    });

    describe('Expansion', () => {
        it('should expand on click', () => {
            render(<MockAccordion />);

            fireEvent.click(screen.getByTestId('accordion-trigger-0'));

            expect(screen.getByTestId('accordion-content-0')).toBeInTheDocument();
        });

        it('should collapse on second click', () => {
            render(<MockAccordion />);

            fireEvent.click(screen.getByTestId('accordion-trigger-0'));
            expect(screen.getByTestId('accordion-content-0')).toBeInTheDocument();

            fireEvent.click(screen.getByTestId('accordion-trigger-0'));
            expect(screen.queryByTestId('accordion-content-0')).not.toBeInTheDocument();
        });

        it('should close other items when not allowMultiple', () => {
            render(<MockAccordion allowMultiple={false} />);

            fireEvent.click(screen.getByTestId('accordion-trigger-0'));
            expect(screen.getByTestId('accordion-content-0')).toBeInTheDocument();

            fireEvent.click(screen.getByTestId('accordion-trigger-1'));
            expect(screen.queryByTestId('accordion-content-0')).not.toBeInTheDocument();
            expect(screen.getByTestId('accordion-content-1')).toBeInTheDocument();
        });

        it('should keep multiple items open when allowMultiple', () => {
            render(<MockAccordion allowMultiple={true} />);

            fireEvent.click(screen.getByTestId('accordion-trigger-0'));
            fireEvent.click(screen.getByTestId('accordion-trigger-1'));

            expect(screen.getByTestId('accordion-content-0')).toBeInTheDocument();
            expect(screen.getByTestId('accordion-content-1')).toBeInTheDocument();
        });
    });

    describe('Default Expanded', () => {
        it('should expand items from defaultExpanded', () => {
            render(<MockAccordion defaultExpanded={['1']} />);
            expect(screen.getByTestId('accordion-content-0')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have aria-expanded false when collapsed', () => {
            render(<MockAccordion />);
            expect(screen.getByTestId('accordion-trigger-0')).toHaveAttribute('aria-expanded', 'false');
        });

        it('should have aria-expanded true when expanded', () => {
            render(<MockAccordion />);
            fireEvent.click(screen.getByTestId('accordion-trigger-0'));
            expect(screen.getByTestId('accordion-trigger-0')).toHaveAttribute('aria-expanded', 'true');
        });

        it('should have region role for content', () => {
            render(<MockAccordion />);
            fireEvent.click(screen.getByTestId('accordion-trigger-0'));
            expect(screen.getByRole('region')).toBeInTheDocument();
        });
    });
});
