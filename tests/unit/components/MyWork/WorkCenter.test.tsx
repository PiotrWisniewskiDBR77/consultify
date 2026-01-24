import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorkCenter } from '@/components/MyWork/WorkCenter';

// Mock child components
vi.mock('@/components/MyWork/PillNavigation', () => ({
  PillNavigation: ({ activeTab, onTabChange, onCreateNew }: any) => (
    <div data-testid="pill-nav">
      <button onClick={() => onTabChange('tasks')}>Tasks Tab</button>
      <button onClick={() => onTabChange('decisions')}>Decisions Tab</button>
      <button onClick={() => onTabChange('projects')}>Projects Tab</button>
      <button onClick={onCreateNew}>Create New</button>
      <span>Active: {activeTab}</span>
    </div>
  ),
}));

vi.mock('@/components/MyWork/QuickFilterBar', () => ({
  QuickFilterBar: ({ activeFilter, onFilterChange, visible }: any) =>
    visible ? (
      <div data-testid="quick-filter">
        <button onClick={() => onFilterChange('overdue')}>Overdue Filter</button>
        <span>Active Filter: {activeFilter}</span>
      </div>
    ) : null,
}));

vi.mock('@/components/MyWork/MyTasksList', () => ({
  MyTasksList: ({ activeTimeGroup }: any) => (
    <div data-testid="tasks-list">Tasks: {activeTimeGroup}</div>
  ),
}));

vi.mock('@/components/MyWork/DecisionsPanel', () => ({
  DecisionsPanel: () => <div data-testid="decisions-list">Decisions List</div>,
}));

vi.mock('@/components/MyWork/MyProjects', () => ({
  MyProjects: () => <div data-testid="projects-list">Projects List</div>,
}));

vi.mock('@/components/MyWork/DecisionDetailModal', () => ({
  DecisionDetailModal: ({ onClose }: any) => (
    <div data-testid="decision-modal">
      <button onClick={onClose}>Close Modal</button>
    </div>
  ),
}));

vi.mock('@/components/MyWork/DecisionBottleneckPanel', () => ({
  DecisionBottleneckPanel: () => <div data-testid="bottleneck-panel">Bottleneck Panel</div>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('WorkCenter', () => {
  const mockOnTaskClick = vi.fn();
  const mockOnCreateTask = vi.fn();

  it('renders with tasks tab active by default', () => {
    render(<WorkCenter onTaskClick={mockOnTaskClick} onCreateTask={mockOnCreateTask} />);

    expect(screen.getByTestId('pill-nav')).toBeTruthy();
    expect(screen.getByText('Active: tasks')).toBeTruthy();
    expect(screen.getByTestId('quick-filter')).toBeTruthy();
    expect(screen.getByTestId('tasks-list')).toBeTruthy();
  });

  it('switches tabs and hides quick filter', async () => {
    render(<WorkCenter onTaskClick={mockOnTaskClick} onCreateTask={mockOnCreateTask} />);

    // Switch to decisions
    fireEvent.click(screen.getByText('Decisions Tab'));

    expect(screen.getByText('Active: decisions')).toBeTruthy();
    expect(screen.queryByTestId('quick-filter')).toBeNull();
    expect(screen.getByTestId('decisions-list')).toBeTruthy();
    expect(screen.getByTestId('bottleneck-panel')).toBeTruthy();
  });

  it('switches to projects tab', async () => {
    render(<WorkCenter onTaskClick={mockOnTaskClick} onCreateTask={mockOnCreateTask} />);

    // Switch to projects
    fireEvent.click(screen.getByText('Projects Tab'));

    expect(screen.getByText('Active: projects')).toBeTruthy();
    expect(screen.getByTestId('projects-list')).toBeTruthy();
  });

  it('handles quick filter selection for tasks', async () => {
    render(<WorkCenter onTaskClick={mockOnTaskClick} onCreateTask={mockOnCreateTask} />);

    fireEvent.click(screen.getByText('Overdue Filter'));

    expect(screen.getByText('Active Filter: overdue')).toBeTruthy();
    expect(screen.getByText('Tasks: overdue')).toBeTruthy();
  });

  it('calls onCreateTask when Create New is clicked on tasks tab', () => {
    render(<WorkCenter onTaskClick={mockOnTaskClick} onCreateTask={mockOnCreateTask} />);

    fireEvent.click(screen.getByText('Create New'));
    expect(mockOnCreateTask).toHaveBeenCalled();
  });

  it('resets quick filter when switching tabs', () => {
    render(<WorkCenter onTaskClick={mockOnTaskClick} onCreateTask={mockOnCreateTask} />);

    // Set filter to overdue
    fireEvent.click(screen.getByText('Overdue Filter'));
    expect(screen.getByText('Active Filter: overdue')).toBeTruthy();

    // Switch to decisions
    fireEvent.click(screen.getByText('Decisions Tab'));

    // Switch back to tasks
    fireEvent.click(screen.getByText('Tasks Tab'));

    expect(screen.getByText('Active Filter: all')).toBeTruthy();
  });
});
