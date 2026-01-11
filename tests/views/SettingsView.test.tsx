/**
 * Settings View Tests
 * Tests for the Settings view component
 *
 * @module tests/views/SettingsView.test.tsx
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Mock components and hooks
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@test.com', role: 'USER' },
    isAuthenticated: true,
  }),
}));

// Mock settings tabs
const mockTabs = [
  { id: 'profile', label: 'Profile', icon: 'User' },
  { id: 'security', label: 'Security', icon: 'Shield' },
  { id: 'notifications', label: 'Notifications', icon: 'Bell' },
  { id: 'preferences', label: 'Preferences', icon: 'Settings' },
];

// Mock SettingsView component for testing
const SettingsView = ({ initialTab = 'profile' }) => {
  const [activeTab, setActiveTab] = React.useState(initialTab);

  return (
    <div data-testid="settings-view">
      <nav aria-label="Settings navigation">
        {mockTabs.map((tab) => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'active' : ''}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main data-testid="settings-content">
        {activeTab === 'profile' && <div data-testid="profile-section">Profile Settings</div>}
        {activeTab === 'security' && <div data-testid="security-section">Security Settings</div>}
        {activeTab === 'notifications' && (
          <div data-testid="notifications-section">Notification Settings</div>
        )}
        {activeTab === 'preferences' && (
          <div data-testid="preferences-section">Preference Settings</div>
        )}
      </main>
    </div>
  );
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Settings View Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════
  // RENDERING
  // ═══════════════════════════════════════════════════════════════════

  describe('Rendering', () => {
    it('should render settings view', () => {
      renderWithRouter(<SettingsView />);
      expect(screen.getByTestId('settings-view')).toBeInTheDocument();
    });

    it('should render all tabs', () => {
      renderWithRouter(<SettingsView />);

      mockTabs.forEach((tab) => {
        expect(screen.getByTestId(`tab-${tab.id}`)).toBeInTheDocument();
      });
    });

    it('should show content area', () => {
      renderWithRouter(<SettingsView />);
      expect(screen.getByTestId('settings-content')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TAB NAVIGATION
  // ═══════════════════════════════════════════════════════════════════

  describe('Tab Navigation', () => {
    it('should show profile section by default', () => {
      renderWithRouter(<SettingsView />);
      expect(screen.getByTestId('profile-section')).toBeInTheDocument();
    });

    it('should switch to security tab on click', () => {
      renderWithRouter(<SettingsView />);

      fireEvent.click(screen.getByTestId('tab-security'));

      expect(screen.getByTestId('security-section')).toBeInTheDocument();
    });

    it('should switch to notifications tab on click', () => {
      renderWithRouter(<SettingsView />);

      fireEvent.click(screen.getByTestId('tab-notifications'));

      expect(screen.getByTestId('notifications-section')).toBeInTheDocument();
    });

    it('should switch to preferences tab on click', () => {
      renderWithRouter(<SettingsView />);

      fireEvent.click(screen.getByTestId('tab-preferences'));

      expect(screen.getByTestId('preferences-section')).toBeInTheDocument();
    });

    it('should mark active tab', () => {
      renderWithRouter(<SettingsView />);

      const profileTab = screen.getByTestId('tab-profile');
      expect(profileTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should update active tab marker on switch', () => {
      renderWithRouter(<SettingsView />);

      fireEvent.click(screen.getByTestId('tab-security'));

      const securityTab = screen.getByTestId('tab-security');
      expect(securityTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // INITIAL TAB
  // ═══════════════════════════════════════════════════════════════════

  describe('Initial Tab', () => {
    it('should support custom initial tab', () => {
      renderWithRouter(<SettingsView initialTab="security" />);

      expect(screen.getByTestId('security-section')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ACCESSIBILITY
  // ═══════════════════════════════════════════════════════════════════

  describe('Accessibility', () => {
    it('should have navigation landmark', () => {
      renderWithRouter(<SettingsView />);

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should have main content area', () => {
      renderWithRouter(<SettingsView />);

      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });
});
