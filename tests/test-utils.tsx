import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
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
    setCurrentView: vi.fn(),
    setSessionMode: vi.fn(),
    setLanguage: vi.fn(),
    toggleSidebar: vi.fn(),
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
