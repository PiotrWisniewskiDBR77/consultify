
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MyWorkView } from '../../../views/MyWorkView';

// Mock child components
vi.mock('../../../components/SplitLayout', () => ({
    SplitLayout: ({ children, title }: any) => <div data-testid="split-layout"><h3>{title}</h3>{children}</div>
}));

vi.mock('../../../components/MyWork/WorkCenter', () => ({
    WorkCenter: ({ onCreateTask }: any) => (
        <div data-testid="work-center">
            <button onClick={onCreateTask}>Create Task</button>
        </div>
    )
}));

vi.mock('../../../components/MyWork/NotificationsHub', () => ({
    NotificationsHub: () => <div data-testid="notifications-hub">Notifications</div>
}));

vi.mock('../../../components/MyWork/TaskDetailModal', () => ({
    TaskDetailModal: ({ isOpen, onClose }: any) => (
        isOpen ? <div data-testid="task-modal"><button onClick={onClose}>Close</button></div> : null
    )
}));

// Mock translations
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultVal: string) => defaultVal,
    }),
}));

describe('MyWorkView', () => {
    it('renders the layout with main sections', () => {
        render(<MyWorkView />);

        expect(screen.getByTestId('split-layout')).toBeTruthy();
        expect(screen.getByTestId('work-center')).toBeTruthy();
        expect(screen.getByTestId('notifications-hub')).toBeTruthy();
    });

    it('opens task modal when Create Task is clicked', () => {
        render(<MyWorkView />);

        const createBtn = screen.getByText('Create Task');
        fireEvent.click(createBtn);

        expect(screen.getByTestId('task-modal')).toBeTruthy();
    });

    it('closes task modal when Close is clicked', () => {
        render(<MyWorkView />);

        // Open it first
        fireEvent.click(screen.getByText('Create Task'));
        expect(screen.getByTestId('task-modal')).toBeTruthy();

        // Close it
        fireEvent.click(screen.getByText('Close'));
        expect(screen.queryByTestId('task-modal')).toBeNull();
    });
});
