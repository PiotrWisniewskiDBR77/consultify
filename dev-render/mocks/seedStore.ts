/**
 * Shared store seed for dev-render "legacy hub" stories.
 *
 * These screens (FinanceHub, NotebookContent, DiscoveryToolsHub, AssessmentHub,
 * InterviewHub, UnifiedChatPanel) are the REAL production components — not
 * re-implementations. They read `currentUser` / `currentOrganization` directly
 * from the real `useAppStore` (zustand — no Provider needed, just a shared
 * singleton), and `AppProviders` (src/providers/AppProviders.tsx) decides
 * whether to mount the "heavy" provider tree (V8Provider/OrgProvider/
 * AccessPolicyProvider/TrialProvider/AIProvider/TeresaVoiceProvider) based on
 * `Boolean(currentUser?.id)` — so seeding a currentUser here is what unlocks
 * the full real provider tree the same way a logged-in session would.
 *
 * IMPORTANT: no auth token is written to localStorage, so any code path that
 * gates a network call on `getAuthToken()` (e.g. AccessPolicyContext,
 * OrgContext) safely no-ops instead of hitting a real (absent) backend.
 *
 * Ported from commit 29cb7f2f46 (dev-render: add AssessmentHub legacy story)
 * which lived on a since-pruned branch — this worktree is based on
 * origin/demo and never had dev-render/mocks/seedStore.ts.
 */
import { useAppStore } from '../../src/store/useAppStore';

let seeded = false;

export function seedRealisticSession(): void {
  if (seeded) return;
  seeded = true;

  useAppStore.setState({
    isDemoMode: true,
    currentUser: {
      id: 'user-piotr-demo',
      firstName: 'Piotr',
      lastName: 'Wiśniewski',
      email: 'piotr.wisniewski@dbr77.com',
      companyName: 'DBR77 Sp. z o.o.',
      role: 'ADMIN',
      status: 'active',
      isAuthenticated: true,
      accessLevel: 'full',
      preferredLanguage: 'pl',
      organizationId: 'org-dbr77-demo',
      organizationName: 'DBR77 Sp. z o.o.',
      isDemo: true,
    } as any,
    currentOrganization: {
      id: 'org-dbr77-demo',
      name: 'DBR77 Sp. z o.o.',
      plan: 'enterprise',
      status: 'active',
      created_at: '2025-01-15T09:00:00Z',
      createdAt: '2025-01-15T09:00:00Z',
      user_count: 24,
      userCount: 24,
    } as any,
  } as any);
}
