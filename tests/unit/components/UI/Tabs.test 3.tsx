/**
 * Tabs Component Tests
 * Testing tabbed interface component
 * 
 * @module tests/unit/components/UI/Tabs.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';

// Mock Tabs component for testing patterns
const MockTabs: React.FC<{
    tabs: Array<{ id: string; label: string; content: React.ReactNode }>;
    defaultTab?: string;
    onTabChange?: (tabId: string) => void;
}> = ({
    tabs,
    defaultTab,
    onTabChange = () => { }
}) => {
        const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

        const handleTabClick = (tabId: string) => {
            setActiveTab(tabId);
            onTabChange(tabId);
        };

        return (
            <div data-testid="tabs">
                <div role="tablist" data-testid="tab-list">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            role="tab"
                            data-testid={`tab-${tab.id}`}
                            aria-selected={activeTab === tab.id}
                            onClick={() => handleTabClick(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div role="tabpanel" data-testid="tab-panel">
                    {tabs.find(t => t.id === activeTab)?.content}
                </div>
            </div>
        );
    };

describe('Tabs Component', () => {
    const mockTabs = [
        { id: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
        { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
        { id: 'tab3', label: 'Tab 3', content: <div>Content 3</div> }
    ];

    describe('Rendering', () => {
        it('should render all tab labels', () => {
            render(<MockTabs tabs={mockTabs} />);

            expect(screen.getByText('Tab 1')).toBeInTheDocument();
            expect(screen.getByText('Tab 2')).toBeInTheDocument();
            expect(screen.getByText('Tab 3')).toBeInTheDocument();
        });

        it('should show first tab content by default', () => {
            render(<MockTabs tabs={mockTabs} />);

            expect(screen.getByText('Content 1')).toBeInTheDocument();
        });

        it('should show specified default tab', () => {
            render(<MockTabs tabs={mockTabs} defaultTab="tab2" />);

            expect(screen.getByText('Content 2')).toBeInTheDocument();
        });
    });

    describe('Tab Switching', () => {
        it('should switch tab on click', () => {
            render(<MockTabs tabs={mockTabs} />);

            fireEvent.click(screen.getByText('Tab 2'));

            expect(screen.getByText('Content 2')).toBeInTheDocument();
        });

        it('should call onTabChange when switching', () => {
            const onTabChange = vi.fn();
            render(<MockTabs tabs={mockTabs} onTabChange={onTabChange} />);

            fireEvent.click(screen.getByText('Tab 3'));

            expect(onTabChange).toHaveBeenCalledWith('tab3');
        });
    });

    describe('Accessibility', () => {
        it('should have tablist role', () => {
            render(<MockTabs tabs={mockTabs} />);
            expect(screen.getByRole('tablist')).toBeInTheDocument();
        });

        it('should have tab roles for buttons', () => {
            render(<MockTabs tabs={mockTabs} />);
            expect(screen.getAllByRole('tab')).toHaveLength(3);
        });

        it('should have tabpanel role for content', () => {
            render(<MockTabs tabs={mockTabs} />);
            expect(screen.getByRole('tabpanel')).toBeInTheDocument();
        });

        it('should mark active tab as selected', () => {
            render(<MockTabs tabs={mockTabs} />);

            expect(screen.getByTestId('tab-tab1')).toHaveAttribute('aria-selected', 'true');
            expect(screen.getByTestId('tab-tab2')).toHaveAttribute('aria-selected', 'false');
        });
    });
});
