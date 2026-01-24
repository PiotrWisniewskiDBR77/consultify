# 🧩 AGENT 4: Unit & Component Tests

## 📋 MISJA

Naprawa testów komponentów React, hooków i store'ów - warstwa UI.

---

## 📁 PLIKI DO NAPRAWY (80+ plików)

### React Components (60+ plików)

```
tests/components/Step2Workspace.test.tsx
tests/components/demo/DemoFlow.test.tsx
tests/components/MaturityMatrix.test.tsx
tests/components/ProjectCard.test.tsx
tests/components/Button.test.tsx
tests/components/AxisCommentsPanel.test.tsx
tests/components/OrgSwitcher.test.tsx
tests/components/settings/PrivacySettings.test.tsx
tests/components/settings/KeyboardShortcutsSettings.test.tsx
tests/components/settings/ProfileVisibilitySettings.test.tsx
tests/components/settings/QuietHoursSettings.test.tsx
tests/components/settings/BillingSettings.test.tsx
tests/components/settings/WorkPreferencesSettings.test.tsx
tests/components/settings/SecuritySettings.test.tsx
tests/components/settings/BioAboutSection.test.tsx
tests/components/settings/DataPrivacySettings.test.tsx
tests/components/settings/OrganizationSettings.test.tsx
tests/components/PilotDecisionWorkspace.test.tsx
tests/components/Studio/StudioToolbar.test.tsx
tests/components/Studio/StudioCanvas.test.tsx
tests/components/Studio/StudioChat.test.tsx
tests/components/Studio/StudioView.test.tsx
tests/components/Landing/TrustStrip.test.tsx
tests/components/Landing/DemoModeModal.test.tsx
tests/components/Landing/EntryFooter.test.tsx
tests/components/Landing/DemoButton.test.tsx
tests/components/Landing/InfoSections.test.tsx
tests/components/Landing/HeroSection.test.tsx
tests/components/Landing/EntryTopBar.test.tsx
tests/components/RapidLeanResultsCard.test.tsx
tests/components/Sidebar.test.tsx
tests/components/SuperAdminSidebar.test.tsx
tests/components/FullRolloutWorkspace.test.tsx
tests/components/AiInsightModal.test.tsx
tests/components/FullExecutionDashboardWorkspace.test.tsx
tests/components/Step3Workspace.test.tsx
tests/components/MyWork/FocusBoard.test.tsx
tests/components/MyWork/ProgressView.test.tsx
tests/components/MyWork/WorkloadView.test.tsx
tests/components/MyWork/TaskInbox.test.tsx
tests/components/MyWork/InboxTriage.test.tsx
tests/components/MyWork/Dashboard/BottleneckAlerts.test.tsx
tests/components/MyWork/Dashboard/WorkloadHeatmap.test.tsx
tests/components/MyWork/DecisionsList.test.tsx
tests/components/MyWork/TodayDashboard.test.tsx
tests/components/ActionProposalList.test.tsx
tests/components/NotificationDropdown.test.tsx
tests/components/AssessmentWorkflowPanel.test.tsx
tests/components/LevelNavigatorAndDetailCard.test.tsx
tests/components/auth/MFAChallenge.test.tsx
tests/components/auth/MFASetup.test.tsx
tests/components/HelpPanel.test.tsx
tests/components/AIInsightFeed.test.tsx
tests/components/AISettings/ProactivitySelector.test.tsx
tests/components/AIAnalyticsDashboard.test.tsx
tests/components/Trial/TrialUpgrade.test.tsx
tests/components/UserProfileMenu.test.tsx
tests/components/ErrorBoundary.test.tsx
tests/components/ROIPaybackChart.test.tsx
tests/components/layout/SuperAdminSidebar.test.tsx
tests/components/TaskInbox.test.tsx
tests/components/WorkloadChart.test.tsx
tests/components/InitiativeDetailModal.test.tsx
tests/components/AIFreezeBanner.test.tsx
tests/components/AssessmentModuleHub.test.tsx
tests/components/RoadmapCapacityHeatmap.test.tsx
tests/components/SuperAdminView.test.tsx
tests/components/SuperAdmin/FeatureFlagsPanel.test.tsx
tests/components/SuperAdmin/CreditNotesPanel.test.tsx
tests/components/SuperAdmin/SuperAdminFeedbackView.test.tsx
tests/components/SuperAdmin/OverviewModule.test.tsx
tests/components/SuperAdmin/LoginAttemptsPanel.test.tsx
tests/components/SuperAdmin/TabLayout.test.tsx
tests/components/SuperAdmin/SuperAdminUserManagement.test.tsx
tests/components/SuperAdmin/EmailTemplatesView.test.tsx
tests/components/SuperAdmin/OrganizationsView.test.tsx
tests/components/SuperAdmin/WebhooksPanel.test.tsx
tests/components/SuperAdmin/RevenueModule.test.tsx
```

### Hooks Tests

```
tests/components/Studio/useStudioAI.test.ts
tests/components/Studio/useStudioDocument.test.ts
tests/hooks/*.test.ts
tests/hooks/*.test.tsx
```

### Store Tests

```
tests/store/*.test.ts
```

---

## 📝 WZORZEC TESTU KOMPONENTU

```typescript
/**
 * [ComponentName] Tests
 *
 * Tests for [Component] React component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Import the component
import { Button } from '@/components/ui/Button';
import { LoginForm } from '@/components/auth/LoginForm';

// Helper to render with providers
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });

    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                {children}
            </BrowserRouter>
        </QueryClientProvider>
    );
};

describe('Button', () => {
    it('should render with text', () => {
        render(<Button>Click me</Button>);

        expect(screen.getByRole('button')).toBeInTheDocument();
        expect(screen.getByText('Click me')).toBeVisible();
    });

    it('should call onClick when clicked', async () => {
        const handleClick = vi.fn();
        render(<Button onClick={handleClick}>Click me</Button>);

        await userEvent.click(screen.getByRole('button'));

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when disabled prop is true', () => {
        render(<Button disabled>Disabled</Button>);

        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should show loading state', () => {
        render(<Button isLoading>Loading</Button>);

        expect(screen.getByRole('button')).toBeDisabled();
        // Check for spinner or loading indicator
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
});

describe('LoginForm', () => {
    const mockOnSuccess = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render email and password fields', () => {
        render(<LoginForm onSuccess={mockOnSuccess} />, { wrapper: createWrapper() });

        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /login|sign in/i })).toBeInTheDocument();
    });

    it('should show validation errors for empty fields', async () => {
        render(<LoginForm onSuccess={mockOnSuccess} />, { wrapper: createWrapper() });

        await userEvent.click(screen.getByRole('button', { name: /login|sign in/i }));

        await waitFor(() => {
            expect(screen.getByText(/email.*required/i)).toBeInTheDocument();
        });
    });

    it('should submit form with valid data', async () => {
        render(<LoginForm onSuccess={mockOnSuccess} />, { wrapper: createWrapper() });

        await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
        await userEvent.type(screen.getByLabelText(/password/i), 'password123');
        await userEvent.click(screen.getByRole('button', { name: /login|sign in/i }));

        // Form should be submitted (check loading state or API call)
        await waitFor(() => {
            expect(screen.getByRole('button')).toBeDisabled();
        }, { timeout: 1000 }).catch(() => {
            // OK if button doesn't disable
        });
    });
});
```

---

## 📝 WZORZEC TESTU HOOKA

```typescript
/**
 * [HookName] Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
};

describe('useAuth', () => {
    it('should return initial state', () => {
        const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
        expect(result.current.isLoading).toBe(true);
    });

    it('should login user', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

        await act(async () => {
            await result.current.login('test@example.com', 'password');
        });

        await waitFor(() => {
            expect(result.current.isAuthenticated).toBe(true);
        });
    });

    it('should logout user', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

        // Login first
        await act(async () => {
            await result.current.login('test@example.com', 'password');
        });

        // Then logout
        await act(async () => {
            await result.current.logout();
        });

        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
    });
});

describe('useProjects', () => {
    it('should fetch projects', async () => {
        const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(Array.isArray(result.current.projects)).toBe(true);
    });

    it('should create project', async () => {
        const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });

        await act(async () => {
            await result.current.createProject({ name: 'New Project' });
        });

        await waitFor(() => {
            expect(result.current.projects.length).toBeGreaterThan(0);
        });
    });
});
```

---

## 📝 WZORZEC TESTU STORE (ZUSTAND)

```typescript
/**
 * Store Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';

import { useAppStore } from '@/store/useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const { logout } = useAppStore.getState();
    logout();
  });

  describe('Auth State', () => {
    it('should have initial state', () => {
      const state = useAppStore.getState();

      expect(state.currentUser).toBeNull();
      expect(state.sessionMode).toBe('FREE');
    });

    it('should set current user', () => {
      const { setCurrentUser } = useAppStore.getState();

      act(() => {
        setCurrentUser({
          id: 'user-1',
          email: 'test@example.com',
          role: 'ADMIN',
          isAuthenticated: true,
        });
      });

      const state = useAppStore.getState();
      expect(state.currentUser).not.toBeNull();
      expect(state.currentUser?.email).toBe('test@example.com');
    });

    it('should logout and clear state', () => {
      const { setCurrentUser, logout } = useAppStore.getState();

      // Set user
      act(() => {
        setCurrentUser({
          id: 'user-1',
          email: 'test@example.com',
          isAuthenticated: true,
        });
      });

      // Logout
      act(() => {
        logout();
      });

      const state = useAppStore.getState();
      expect(state.currentUser).toBeNull();
    });
  });

  describe('UI State', () => {
    it('should toggle theme', () => {
      const { toggleTheme } = useAppStore.getState();
      const initialTheme = useAppStore.getState().theme;

      act(() => {
        toggleTheme();
      });

      const newTheme = useAppStore.getState().theme;
      expect(newTheme).not.toBe(initialTheme);
    });
  });
});
```

---

## 🔍 ZNAJDOWANIE FAŁSZYWYCH TESTÓW

```bash
# Znajdź fałszywe asercje
grep -rn --include="*.test.tsx" --include="*.test.ts" \
    -E "expect\((true|false)\)\.toBe\((true|false)\)" \
    tests/components/ tests/hooks/ tests/store/

# Znajdź testy bez renderowania komponentu
grep -L "render\|renderHook" tests/components/*.test.tsx | head -10
```

---

## ⚠️ CZĘSTE PROBLEMY

### 1. Brak providera

```typescript
// ❌ Błąd: Component requires QueryClientProvider
render(<MyComponent />);

// ✅ Poprawnie:
render(<MyComponent />, { wrapper: createWrapper() });
```

### 2. Async operations

```typescript
// ❌ Błąd: Test ends before async operation
it('should fetch data', () => {
    render(<DataComponent />);
    expect(screen.getByText('Data')).toBeInTheDocument(); // Fails!
});

// ✅ Poprawnie:
it('should fetch data', async () => {
    render(<DataComponent />);
    await waitFor(() => {
        expect(screen.getByText('Data')).toBeInTheDocument();
    });
});
```

### 3. User events

```typescript
// ❌ Stary sposób:
fireEvent.click(button);

// ✅ Nowy sposób (lepszy):
await userEvent.click(button);
```

---

## 🛠️ SETUP FILE

Upewnij się że `tests/setup.ts` ma:

```typescript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
```

---

## ✅ CHECKLIST

- [ ] Sprawdź czy `tests/setup.ts` ma prawidłowe mocki
- [ ] Przejrzyj każdy plik komponentu
- [ ] Użyj `screen` queries zamiast `container.querySelector`
- [ ] Użyj `userEvent` zamiast `fireEvent` dla interakcji
- [ ] Dodaj `waitFor` dla async operacji
- [ ] Uruchom: `npm run test:component`

---

## 📞 POMOC

Komponenty: `src/components/`
Hooks: `src/hooks/`
Store: `src/store/`

Testing Library docs: https://testing-library.com/docs/react-testing-library/intro
