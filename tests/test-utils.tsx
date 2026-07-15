import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
import { AppProviders } from '../src/providers/AppProviders';
import { useAppStore } from '../store/useAppStore';

// Mock useAppStore hook
vi.mock('../store/useAppStore', () => ({
  useAppStore: vi.fn(() => ({
    currentView: 'dashboard',
    currentUser: null,
    sessionMode: 'free',
    language: 'en',
    isSidebarOpen: false,
    isSidebarCollapsed: false,
    setCurrentView: vi.fn(),
    setSessionMode: vi.fn(),
    setLanguage: vi.fn(),
    toggleSidebar: vi.fn(),
    toggleSidebarCollapse: vi.fn(),
  })),
}));

// Mock Translation Provider
const MockI18nProvider = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

// Mock Store Provider using Zustand
const MockStoreProvider = ({ children }: { children: React.ReactNode }) => {
  // Store is already mocked via vi.mock above
  return <>{children}</>;
};

// Mock Theme Provider
const MockThemeProvider = ({ children }: { children: React.ReactNode }) => (
  <div data-theme="light">{children}</div>
);

// Combined Providers - using AppProviders structure
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <MockI18nProvider>
      <MockStoreProvider>
        <MockThemeProvider>
          <MemoryRouter>{children}</MemoryRouter>
        </MockThemeProvider>
      </MockStoreProvider>
    </MockI18nProvider>
  );
};

// Custom Render
const renderWithProviders = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { renderWithProviders };
