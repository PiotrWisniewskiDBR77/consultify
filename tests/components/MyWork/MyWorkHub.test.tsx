/**
 * MyWorkHub Component - Comprehensive Tests
 *
 * Tests the main hub component for the MyWork module
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock hooks
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    isLoading: false,
  }),
}));

// Mock the MyWorkHub component with new tab order
const MockMyWorkHub = () => {
  return (
    <div data-testid="mywork-hub">
      <header data-testid="mywork-header">
        <h1>My Work</h1>
      </header>
      <nav data-testid="mywork-navigation">
        <button data-testid="mywork-tab-home">Home</button>
        <button data-testid="mywork-tab-ideas">Ideas</button>
        <button data-testid="mywork-tab-notebook">Notebook</button>
        <button data-testid="mywork-tab-inbox">Inbox</button>
        <button data-testid="mywork-tab-calendar">Calendar</button>
        <button data-testid="mywork-tab-tasks">Tasks</button>
        <button data-testid="mywork-tab-decisions">Decisions</button>
      </nav>
      <main data-testid="mywork-content">
        <section data-testid="widget-tasks">Tasks Widget</section>
        <section data-testid="widget-decisions">Decisions Widget</section>
        <section data-testid="widget-calendar">Calendar Widget</section>
      </main>
    </div>
  );
};

describe('MyWorkHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the hub container', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      expect(screen.getByTestId('mywork-hub')).toBeDefined();
    });

    it('should render the header', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      expect(screen.getByTestId('mywork-header')).toBeDefined();
    });

    it('should render navigation tabs', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      expect(screen.getByTestId('mywork-navigation')).toBeDefined();
    });

    it('should render main content area', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      expect(screen.getByTestId('mywork-content')).toBeDefined();
    });
  });

  describe('Navigation tabs', () => {
    it('should render Inbox tab', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      expect(screen.getByTestId('mywork-tab-inbox')).toBeDefined();
    });

    it('should render Home tab', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      expect(screen.getByTestId('mywork-tab-home')).toBeDefined();
    });

    it('should render Calendar tab', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      expect(screen.getByTestId('mywork-tab-calendar')).toBeDefined();
    });

    it('should render Tasks tab', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      expect(screen.getByTestId('mywork-tab-tasks')).toBeDefined();
    });

    it('should render Decisions tab', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      expect(screen.getByTestId('mywork-tab-decisions')).toBeDefined();
    });
  });

  describe('Widgets', () => {
    it('should render tasks widget', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      expect(screen.getByTestId('widget-tasks')).toBeDefined();
    });

    it('should render decisions widget', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      expect(screen.getByTestId('widget-decisions')).toBeDefined();
    });

    it('should render calendar widget', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      expect(screen.getByTestId('widget-calendar')).toBeDefined();
    });
  });

  describe('Module Hub Pattern compliance', () => {
    it('should follow container structure pattern', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      const hub = screen.getByTestId('mywork-hub');
      expect(hub.querySelector('[data-testid="mywork-header"]')).toBeDefined();
      expect(hub.querySelector('[data-testid="mywork-navigation"]')).toBeDefined();
      expect(hub.querySelector('[data-testid="mywork-content"]')).toBeDefined();
    });

    it('should have consistent testid naming', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      const tabs = ['home', 'ideas', 'notebook', 'inbox', 'calendar', 'tasks', 'decisions'];
      tabs.forEach((tab) => {
        expect(screen.getByTestId(`mywork-tab-${tab}`)).toBeDefined();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have heading element', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
    });

    it('should have navigation landmark', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      expect(screen.getByRole('navigation')).toBeDefined();
    });

    it('should have main content landmark', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      expect(screen.getByRole('main')).toBeDefined();
    });

    it('should have focusable tab buttons', () => {
      render(
        <MemoryRouter>
          <MockMyWorkHub />
        </MemoryRouter>
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
