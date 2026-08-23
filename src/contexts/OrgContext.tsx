/**
 * OrgContext - React Context for Organization Management
 *
 * Provides:
 * - currentOrg: Currently selected organization
 * - availableOrgs: List of orgs user has access to
 * - switchOrg: Function to change current org (token exchange + full state reset)
 * - isLoading / isSwitching: Loading states
 *
 * Integrates with:
 * - POST /api/auth/switch-organization (token exchange)
 * - GET /api/organizations/current (list user orgs)
 * - Zustand authSlice (currentOrganization)
 * - tokenService (token persistence)
 */

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import toast from 'react-hot-toast';

import { tokenService } from '@/services/tokenService';
import { useAppStore } from '@/store/useAppStore';

export interface Organization {
  id: string;
  name: string;
  role: string;
  access_type: 'MEMBER' | 'CONSULTANT';
  billing_status?: string;
  is_current?: boolean;
}

interface OrgContextValue {
  currentOrg: Organization | null;
  availableOrgs: Organization[];
  isLoading: boolean;
  isSwitching: boolean;
  error: string | null;
  switchOrg: (orgId: string) => Promise<void>;
  refreshOrgs: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

const STORAGE_KEY = 'consultify_current_org_id';

interface OrgProviderProps {
  children: ReactNode;
}

export const OrgProvider: React.FC<OrgProviderProps> = ({ children }) => {
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentOrganization = useAppStore((s) => s.setCurrentOrganization);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const demoSessionOrgId = useAppStore((s) => s.demoSessionOrgId);

  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [availableOrgs, setAvailableOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchOrganizations = useCallback(async () => {
    if (!currentUser?.id) {
      setIsLoading(false);
      return;
    }

    // A public demo principal is server-bound to exactly one isolated session
    // tenant. `/organizations/current` describes the account's base membership,
    // so resolving from it would persist `demo-org` as an ordinary org context;
    // the backend correctly rejects that tenant-steering header. Keep the demo
    // tenant in memory and deliberately leave the ordinary org key absent.
    if (isDemoMode && demoSessionOrgId) {
      const demoOrg: Organization = {
        id: demoSessionOrgId,
        name: 'Demo workspace',
        role: String(currentUser.role || 'CONSULTANT'),
        access_type: 'CONSULTANT',
        is_current: true,
      };
      localStorage.removeItem(STORAGE_KEY);
      setAvailableOrgs([demoOrg]);
      setCurrentOrg(demoOrg);
      setCurrentOrganization({ id: demoOrg.id, name: demoOrg.name });
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const token = tokenService.getToken();
      const response = await fetch('/api/organizations/current', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        // Organization membership is authenticated, tenant-sensitive context.
        // A cached conditional GET can resolve to 304 (Response.ok === false),
        // which used to surface as a fake "Failed to fetch organizations".
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }

      const data = await response.json();
      // Kształt odpowiedzi bywa inny niż oczekiwany (starsze wersje API, harness
      // dev-render, proxy zwracające kopertę) — wtedy traktujemy to jak brak
      // organizacji zamiast wysypywać kontekst na `orgs.find is not a function`.
      const surowe = data?.organizations ?? data ?? [];
      const orgs: Organization[] = Array.isArray(surowe) ? surowe : [];
      setAvailableOrgs(orgs);

      const savedOrgId = localStorage.getItem(STORAGE_KEY);
      const currentFromToken = orgs.find((o) => o.is_current);
      const savedOrg = orgs.find((o) => o.id === savedOrgId);

      const resolved = savedOrg || currentFromToken || orgs[0] || null;
      if (resolved) {
        setCurrentOrg(resolved);
        localStorage.setItem(STORAGE_KEY, resolved.id);
        setCurrentOrganization({ id: resolved.id, name: resolved.name });
      } else if (savedOrgId) {
        // QA-2026-06-08 (BUG-02/15): a stale `consultify_current_org_id` (e.g. an org the
        // user left) was kept in localStorage and sent as `x-org-context`, resolving
        // server-side to an org without ACTIVE membership → 403 ORG_MEMBERSHIP_REVOKED
        // (surfaced first by the voice path, which force-creates a conversation on click).
        // When no valid org resolves, drop the stale id so we stop sending a dead context.
        localStorage.removeItem(STORAGE_KEY);
        setCurrentOrg(null);
      }

      setError(null);
    } catch (err) {
      console.error('[OrgContext] Error fetching orgs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, demoSessionOrgId, isDemoMode, setCurrentOrganization]);

  const switchOrg = useCallback(
    async (orgId: string) => {
      if (!currentUser?.id || isDemoMode) return;
      if (orgId === currentOrg?.id) return;

      const targetOrg = availableOrgs.find((o) => o.id === orgId);
      if (!targetOrg) return;

      try {
        setIsSwitching(true);
        setError(null);

        const token = tokenService.getToken();
        const response = await fetch('/api/auth/switch-organization', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ organizationId: orgId }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to switch organization');
        }

        const data = await response.json();

        tokenService.saveTokens(data.token, data.refreshToken);
        localStorage.setItem(STORAGE_KEY, orgId);

        setCurrentOrg({ ...targetOrg, is_current: true });
        setCurrentOrganization({
          id: data.organization.id,
          name: data.organization.name,
        });

        toast.success(`Switched to ${data.organization.name}`);

        // Broadcast to other tabs
        try {
          const bc = new BroadcastChannel('org-switch');
          bc.postMessage({ orgId, orgName: data.organization.name });
          bc.close();
        } catch {
          // BroadcastChannel not supported
        }

        // Hard reload to reset all cached data. Drop conversation/entity deep links:
        // staying on /chat/<id> after the switch would resume a conversation from
        // the PREVIOUS organization (feedback 79802ad8 — Elkomtech user landed back
        // in an old dbr77 thread). The server now 404s those, but landing on a
        // "conversation not found" screen right after switching is still bad UX.
        setTimeout(() => {
          const path = window.location.pathname;
          window.location.href = path.startsWith('/chat/') ? '/chat' : path;
        }, 300);
      } catch (err) {
        console.error('[OrgContext] Switch org error:', err);
        const message = err instanceof Error ? err.message : 'Failed to switch organization';
        setError(message);
        toast.error(message);
      } finally {
        setIsSwitching(false);
      }
    },
    [currentUser?.id, currentOrg?.id, availableOrgs, isDemoMode, setCurrentOrganization]
  );

  useEffect(() => {
    if (currentUser?.id && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchOrganizations();
    }
    if (!currentUser?.id) {
      fetchedRef.current = false;
      setAvailableOrgs([]);
      setCurrentOrg(null);
    }
  }, [currentUser?.id, demoSessionOrgId, fetchOrganizations]);

  // Listen for cross-tab org switches
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && e.newValue !== currentOrg?.id) {
        window.location.reload();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [currentOrg?.id]);

  const value: OrgContextValue = {
    currentOrg,
    availableOrgs,
    isLoading,
    isSwitching,
    error,
    switchOrg,
    refreshOrgs: fetchOrganizations,
  };

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
};

export const useOrgContext = (): OrgContextValue => {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error('useOrgContext must be used within an OrgProvider');
  }
  return context;
};

export const useCurrentOrg = (): Organization | null => {
  const { currentOrg } = useOrgContext();
  return currentOrg;
};
