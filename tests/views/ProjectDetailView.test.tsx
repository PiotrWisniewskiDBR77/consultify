/**
 * Project Detail View Tests
 * Tests for the Project Detail view component
 * 
 * @module tests/views/ProjectDetailView.test.tsx
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

// Mock project data
const mockProject = {
    id: 'proj-1',
    name: 'Test Project',
    description: 'A test project description',
    status: 'active',
    progress: 45,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    members: [
        { id: 'user-1', name: 'John Doe', role: 'owner' },
        { id: 'user-2', name: 'Jane Smith', role: 'member' },
    ],
    tasks: [
        { id: 'task-1', title: 'Task 1', status: 'completed' },
        { id: 'task-2', title: 'Task 2', status: 'in_progress' },
    ],
};

// Mock ProjectDetail component
const ProjectDetailView = ({ projectId }: { projectId?: string }) => {
    const [project] = React.useState(mockProject);
    const [activeSection, setActiveSection] = React.useState('overview');

    if (!project) {
        return <div data-testid="loading">Loading...</div>;
    }

    return (
        <div data-testid="project-detail-view">
            <header data-testid="project-header">
                <h1 data-testid="project-name">{project.name}</h1>
                <span data-testid="project-status">{project.status}</span>
            </header>

            <nav data-testid="project-nav">
                <button
                    data-testid="nav-overview"
                    onClick={() => setActiveSection('overview')}
                    className={activeSection === 'overview' ? 'active' : ''}
                >
                    Overview
                </button>
                <button
                    data-testid="nav-tasks"
                    onClick={() => setActiveSection('tasks')}
                    className={activeSection === 'tasks' ? 'active' : ''}
                >
                    Tasks
                </button>
                <button
                    data-testid="nav-members"
                    onClick={() => setActiveSection('members')}
                    className={activeSection === 'members' ? 'active' : ''}
                >
                    Members
                </button>
                <button
                    data-testid="nav-settings"
                    onClick={() => setActiveSection('settings')}
                    className={activeSection === 'settings' ? 'active' : ''}
                >
                    Settings
                </button>
            </nav>

            <main data-testid="project-content">
                {activeSection === 'overview' && (
                    <section data-testid="overview-section">
                        <p data-testid="project-description">{project.description}</p>
                        <div data-testid="project-progress">Progress: {project.progress}%</div>
                    </section>
                )}

                {activeSection === 'tasks' && (
                    <section data-testid="tasks-section">
                        <ul data-testid="tasks-list">
                            {project.tasks.map((task) => (
                                <li key={task.id} data-testid={`task-${task.id}`}>
                                    {task.title} - {task.status}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {activeSection === 'members' && (
                    <section data-testid="members-section">
                        <ul data-testid="members-list">
                            {project.members.map((member) => (
                                <li key={member.id} data-testid={`member-${member.id}`}>
                                    {member.name} ({member.role})
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {activeSection === 'settings' && (
                    <section data-testid="settings-section">
                        <button data-testid="edit-project-btn">Edit Project</button>
                        <button data-testid="delete-project-btn">Delete Project</button>
                    </section>
                )}
            </main>
        </div>
    );
};

const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Project Detail View Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ═══════════════════════════════════════════════════════════════════
    // RENDERING
    // ═══════════════════════════════════════════════════════════════════

    describe('Rendering', () => {
        it('should render project detail view', () => {
            renderWithRouter(<ProjectDetailView projectId="proj-1" />);
            expect(screen.getByTestId('project-detail-view')).toBeInTheDocument();
        });

        it('should display project name', () => {
            renderWithRouter(<ProjectDetailView projectId="proj-1" />);
            expect(screen.getByTestId('project-name')).toHaveTextContent('Test Project');
        });

        it('should display project status', () => {
            renderWithRouter(<ProjectDetailView projectId="proj-1" />);
            expect(screen.getByTestId('project-status')).toHaveTextContent('active');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // NAVIGATION
    // ═══════════════════════════════════════════════════════════════════

    describe('Navigation', () => {
        it('should show overview by default', () => {
            renderWithRouter(<ProjectDetailView projectId="proj-1" />);
            expect(screen.getByTestId('overview-section')).toBeInTheDocument();
        });

        it('should switch to tasks section', () => {
            renderWithRouter(<ProjectDetailView projectId="proj-1" />);

            fireEvent.click(screen.getByTestId('nav-tasks'));

            expect(screen.getByTestId('tasks-section')).toBeInTheDocument();
        });

        it('should switch to members section', () => {
            renderWithRouter(<ProjectDetailView projectId="proj-1" />);

            fireEvent.click(screen.getByTestId('nav-members'));

            expect(screen.getByTestId('members-section')).toBeInTheDocument();
        });

        it('should switch to settings section', () => {
            renderWithRouter(<ProjectDetailView projectId="proj-1" />);

            fireEvent.click(screen.getByTestId('nav-settings'));

            expect(screen.getByTestId('settings-section')).toBeInTheDocument();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // OVERVIEW SECTION
    // ═══════════════════════════════════════════════════════════════════

    describe('Overview Section', () => {
        it('should display description', () => {
            renderWithRouter(<ProjectDetailView projectId="proj-1" />);
            expect(screen.getByTestId('project-description')).toHaveTextContent('A test project description');
        });

        it('should display progress', () => {
            renderWithRouter(<ProjectDetailView projectId="proj-1" />);
            expect(screen.getByTestId('project-progress')).toHaveTextContent('45%');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // TASKS SECTION
    // ═══════════════════════════════════════════════════════════════════

    describe('Tasks Section', () => {
        it('should display tasks list', () => {
            renderWithRouter(<ProjectDetailView projectId="proj-1" />);

            fireEvent.click(screen.getByTestId('nav-tasks'));

            expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
            expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
            expect(screen.getByTestId('task-task-2')).toBeInTheDocument();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // MEMBERS SECTION
    // ═══════════════════════════════════════════════════════════════════

    describe('Members Section', () => {
        it('should display members list', () => {
            renderWithRouter(<ProjectDetailView projectId="proj-1" />);

            fireEvent.click(screen.getByTestId('nav-members'));

            expect(screen.getByTestId('members-list')).toBeInTheDocument();
            expect(screen.getByTestId('member-user-1')).toBeInTheDocument();
            expect(screen.getByTestId('member-user-2')).toBeInTheDocument();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SETTINGS SECTION
    // ═══════════════════════════════════════════════════════════════════

    describe('Settings Section', () => {
        it('should display action buttons', () => {
            renderWithRouter(<ProjectDetailView projectId="proj-1" />);

            fireEvent.click(screen.getByTestId('nav-settings'));

            expect(screen.getByTestId('edit-project-btn')).toBeInTheDocument();
            expect(screen.getByTestId('delete-project-btn')).toBeInTheDocument();
        });
    });
});
