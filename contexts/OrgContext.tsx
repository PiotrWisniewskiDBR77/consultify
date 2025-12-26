/**
 * OrgContext - React Context for Organization Management
 * 
 * Provides:
 * - currentOrg: Currently selected organization
 * - availableOrgs: List of orgs user has access to
 * - switchOrg: Function to change current org
 * - isLoading: Loading state
 * 
 * Persists selection to localStorage.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Types
export interface Organization {
    id: string;
    name: string;
    role: string;
    access_type: 'MEMBER' | 'CONSULTANT';
}

interface OrgContextValue {
    currentOrg: Organization | null;
    availableOrgs: Organization[];
    isLoading: boolean;
    error: string | null;
    switchOrg: (orgId: string) => void;
    refreshOrgs: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

const STORAGE_KEY = 'consultify_current_org_id';

interface OrgProviderProps {
    children: ReactNode;
    userId?: string;
}

export const OrgProvider: React.FC<OrgProviderProps> = ({ children, userId }) => {
    const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
    const [availableOrgs, setAvailableOrgs] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch available organizations
    const fetchOrganizations = useCallback(async () => {
        if (!userId) {
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            const response = await fetch('/api/users/me/organizations', {
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch organizations');
            }

            const data = await response.json();
            const orgs: Organization[] = data.organizations || [];
            setAvailableOrgs(orgs);

            // Restore from localStorage or use first org
            const savedOrgId = localStorage.getItem(STORAGE_KEY);
            const savedOrg = orgs.find(o => o.id === savedOrgId);

            if (savedOrg) {
                setCurrentOrg(savedOrg);
            } else if (orgs.length > 0) {
                setCurrentOrg(orgs[0]);
                localStorage.setItem(STORAGE_KEY, orgs[0].id);
            }

            setError(null);
        } catch (err) {
            console.error('[OrgContext] Error fetching orgs:', err);
            setError(err instanceof Error ? err.message : 'Failed to load organizations');
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    // Switch organization
    const switchOrg = useCallback((orgId: string) => {
        const org = availableOrgs.find(o => o.id === orgId);
        if (org) {
            setCurrentOrg(org);
            localStorage.setItem(STORAGE_KEY, orgId);

            // Optionally notify backend of org switch
            fetch('/api/users/me/current-org', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ organizationId: orgId })
            }).catch(err => console.warn('[OrgContext] Failed to update backend org:', err));
        }
    }, [availableOrgs]);

    // Initial load
    useEffect(() => {
        fetchOrganizations();
    }, [fetchOrganizations]);

    const value: OrgContextValue = {
        currentOrg,
        availableOrgs,
        isLoading,
        error,
        switchOrg,
        refreshOrgs: fetchOrganizations
    };

    return (
        <OrgContext.Provider value={value}>
            {children}
        </OrgContext.Provider>
    );
};

// Hook
export const useOrgContext = (): OrgContextValue => {
    const context = useContext(OrgContext);
    if (!context) {
        throw new Error('useOrgContext must be used within an OrgProvider');
    }
    return context;
};

// Optional: Hook for just the current org (simpler API)
export const useCurrentOrg = (): Organization | null => {
    const { currentOrg } = useOrgContext();
    return currentOrg;
};
