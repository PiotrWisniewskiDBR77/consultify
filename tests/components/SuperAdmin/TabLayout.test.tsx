/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabLayout } from '../../../components/SuperAdmin/TabLayout';
import { LayoutDashboard, Users } from 'lucide-react';

describe('TabLayout', () => {
    const mockOnTabChange = vi.fn();
    const tabs = [
        { id: 'tab1', label: 'Tab 1', icon: <LayoutDashboard size={16} /> },
        { id: 'tab2', label: 'Tab 2', icon: <Users size={16} />, badge: 5 },
        { id: 'tab3', label: 'Tab 3', disabled: true }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render tabs', () => {
        render(
            <TabLayout tabs={tabs} activeTab="tab1" onTabChange={mockOnTabChange}>
                <div>Content</div>
            </TabLayout>
        );
        
        expect(screen.getByText('Tab 1')).toBeInTheDocument();
        expect(screen.getByText('Tab 2')).toBeInTheDocument();
        expect(screen.getByText('Tab 3')).toBeInTheDocument();
    });

    it('should render title and subtitle', () => {
        render(
            <TabLayout 
                tabs={tabs} 
                activeTab="tab1" 
                onTabChange={mockOnTabChange}
                title="Test Title"
                subtitle="Test Subtitle"
            >
                <div>Content</div>
            </TabLayout>
        );
        
        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
    });

    it('should call onTabChange when tab is clicked', () => {
        render(
            <TabLayout tabs={tabs} activeTab="tab1" onTabChange={mockOnTabChange}>
                <div>Content</div>
            </TabLayout>
        );
        
        fireEvent.click(screen.getByText('Tab 2'));
        expect(mockOnTabChange).toHaveBeenCalledWith('tab2');
    });

    it('should not call onTabChange for disabled tabs', () => {
        render(
            <TabLayout tabs={tabs} activeTab="tab1" onTabChange={mockOnTabChange}>
                <div>Content</div>
            </TabLayout>
        );
        
        const disabledTab = screen.getByText('Tab 3').closest('button');
        expect(disabledTab).toBeDisabled();
        
        fireEvent.click(disabledTab!);
        expect(mockOnTabChange).not.toHaveBeenCalled();
    });

    it('should display badge on tab', () => {
        render(
            <TabLayout tabs={tabs} activeTab="tab2" onTabChange={mockOnTabChange}>
                <div>Content</div>
            </TabLayout>
        );
        
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should highlight active tab', () => {
        render(
            <TabLayout tabs={tabs} activeTab="tab1" onTabChange={mockOnTabChange}>
                <div>Content</div>
            </TabLayout>
        );
        
        const activeTab = screen.getByText('Tab 1').closest('button');
        expect(activeTab).toHaveClass('border-red-500');
    });

    it('should render children content', () => {
        render(
            <TabLayout tabs={tabs} activeTab="tab1" onTabChange={mockOnTabChange}>
                <div data-testid="content">Test Content</div>
            </TabLayout>
        );
        
        expect(screen.getByTestId('content')).toBeInTheDocument();
        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should render actions if provided', () => {
        render(
            <TabLayout 
                tabs={tabs} 
                activeTab="tab1" 
                onTabChange={mockOnTabChange}
                actions={<button>Action</button>}
            >
                <div>Content</div>
            </TabLayout>
        );
        
        expect(screen.getByText('Action')).toBeInTheDocument();
    });
});
