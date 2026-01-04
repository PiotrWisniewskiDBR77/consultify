import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n'; // Ensure this points to your i18n instance or use a mock

// Mock Translation Provider
const MockI18nProvider = ({ children }: { children: React.ReactNode }) => (
    <I18nextProvider i18n={i18n}>
        {children}
    </I18nextProvider>
);

// Mock Store Provider (Placeholder - replace with actual StoreProvider if you have one)
// If you use Zustand or Context, wrap it here.
const MockStoreProvider = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
);

// Mock Theme Provider (Placeholder)
const MockThemeProvider = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
);

// Combined Providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    return (
        <MockI18nProvider>
            <MockStoreProvider>
                <MockThemeProvider>
                    <MemoryRouter>
                        {children}
                    </MemoryRouter>
                </MockThemeProvider>
            </MockStoreProvider>
        </MockI18nProvider>
    );
};

// Custom Render
const renderWithProviders = (
    ui: React.ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { renderWithProviders };
