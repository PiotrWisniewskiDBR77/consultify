/**
 * Tests for useOrganizationContext hook
 *
 * Tests organization context aggregation and formatting for AI prompts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useOrganizationContext } from '@/hooks/discovery/useOrganizationContext';
import { Api } from '@/services/api';

// Mock the API
vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

describe('useOrganizationContext', () => {
  const mockOrgData = {
    name: 'Test Organization',
    industry: 'Technology',
    size: 'Medium (50-200)',
    description: 'A technology company',
    strategicGoals: ['Expand market share', 'Improve customer satisfaction'],
    challenges: ['Competition', 'Talent acquisition'],
  };

  const mockProjects = {
    projects: [
      { id: 'p1', name: 'Project Alpha', status: 'active', progress: 75 },
      { id: 'p2', name: 'Project Beta', status: 'planning', progress: 20 },
    ],
  };

  const mockInitiatives = {
    initiatives: [
      { id: 'i1', title: 'Digital Transformation', status: 'active', type: 'strategic' },
      { id: 'i2', title: 'Process Optimization', status: 'draft', type: 'operational' },
    ],
  };

  const mockAssessment = {
    scores: { innovation: 3.5, operations: 4.0, culture: 3.8 },
    maturityLevel: 'Developing',
  };

  const mockKpis = {
    kpis: [
      { name: 'Revenue Growth', value: 15, target: 20, trend: 'up' },
      { name: 'Customer NPS', value: 42, target: 50, trend: 'stable' },
    ],
  };

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    localStorage.setItem('currentOrganization', JSON.stringify({ id: 'org-123', name: 'Test Org' }));

    // Reset mocks
    vi.clearAllMocks();

    // Setup default mock responses
    (Api.get as any).mockImplementation((url: string) => {
      if (url.includes('/profile')) return Promise.resolve(mockOrgData);
      if (url.includes('/projects')) return Promise.resolve(mockProjects);
      if (url.includes('/initiatives')) return Promise.resolve(mockInitiatives);
      if (url.includes('/assessment')) return Promise.resolve(mockAssessment);
      if (url.includes('/kpis')) return Promise.resolve(mockKpis);
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Context Loading', () => {
    it('should load organization context on mount', async () => {
      const { result } = renderHook(() => useOrganizationContext());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.context).not.toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should populate context with API data', async () => {
      const { result } = renderHook(() => useOrganizationContext());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.context?.companyName).toBe('Test Organization');
      expect(result.current.context?.industry).toBe('Technology');
      expect(result.current.context?.activeProjects.length).toBe(2);
      expect(result.current.context?.initiatives.length).toBe(2);
    });

    it('should handle API errors gracefully', async () => {
      (Api.get as any).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useOrganizationContext());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have default context on error
      expect(result.current.context).not.toBeNull();
      expect(result.current.context?.companyName).toBe('Test Org');
    });

    it('should use fallback org name from localStorage', async () => {
      (Api.get as any).mockImplementation((url: string) => {
        if (url.includes('/profile')) return Promise.resolve(null);
        return Promise.resolve({});
      });

      const { result } = renderHook(() => useOrganizationContext());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.context?.companyName).toBe('Test Org');
    });
  });

  describe('formatForPrompt', () => {
    it('should format context for AI prompt', async () => {
      const { result } = renderHook(() => useOrganizationContext());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const prompt = result.current.formatForPrompt();

      expect(prompt).toContain('## Organization Overview');
      expect(prompt).toContain('Test Organization');
      expect(prompt).toContain('Technology');
    });

    it('should include strategic goals in prompt', async () => {
      const { result } = renderHook(() => useOrganizationContext());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const prompt = result.current.formatForPrompt();

      expect(prompt).toContain('## Strategic Goals');
      expect(prompt).toContain('Expand market share');
    });

    it('should include challenges in prompt', async () => {
      const { result } = renderHook(() => useOrganizationContext());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const prompt = result.current.formatForPrompt();

      expect(prompt).toContain('## Current Challenges');
      expect(prompt).toContain('Competition');
    });

    it('should include maturity assessment in prompt', async () => {
      const { result } = renderHook(() => useOrganizationContext());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const prompt = result.current.formatForPrompt();

      expect(prompt).toContain('## Maturity Assessment');
      expect(prompt).toContain('Developing');
    });

    it('should include active projects in prompt', async () => {
      const { result } = renderHook(() => useOrganizationContext());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const prompt = result.current.formatForPrompt();

      expect(prompt).toContain('## Active Projects');
      expect(prompt).toContain('Project Alpha');
      expect(prompt).toContain('75% complete');
    });

    it('should include initiatives in prompt', async () => {
      const { result } = renderHook(() => useOrganizationContext());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const prompt = result.current.formatForPrompt();

      expect(prompt).toContain('## Current Initiatives');
      expect(prompt).toContain('Digital Transformation');
      expect(prompt).toContain('[strategic]');
    });

    it('should include KPIs in prompt', async () => {
      const { result } = renderHook(() => useOrganizationContext());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const prompt = result.current.formatForPrompt();

      expect(prompt).toContain('## Key Performance Indicators');
      expect(prompt).toContain('Revenue Growth');
      expect(prompt).toContain('target: 20');
    });

    it('should return placeholder when no context', async () => {
      // Don't set localStorage org
      localStorage.clear();

      const { result } = renderHook(() => useOrganizationContext());

      // Before context loads
      const prompt = result.current.formatForPrompt();
      expect(prompt).toContain('No organization context available');
    });
  });

  describe('refresh', () => {
    it('should refresh context data', async () => {
      const { result } = renderHook(() => useOrganizationContext());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Update mock to return different data
      (Api.get as any).mockImplementation((url: string) => {
        if (url.includes('/profile')) {
          return Promise.resolve({ ...mockOrgData, name: 'Updated Organization' });
        }
        return Promise.resolve({});
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.context?.companyName).toBe('Updated Organization');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays from API', async () => {
      (Api.get as any).mockImplementation((url: string) => {
        if (url.includes('/profile')) return Promise.resolve(mockOrgData);
        if (url.includes('/projects')) return Promise.resolve({ projects: [] });
        if (url.includes('/initiatives')) return Promise.resolve({ initiatives: [] });
        if (url.includes('/kpis')) return Promise.resolve({ kpis: [] });
        return Promise.resolve({});
      });

      const { result } = renderHook(() => useOrganizationContext());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.context?.activeProjects).toEqual([]);
      expect(result.current.context?.initiatives).toEqual([]);
      expect(result.current.context?.kpis).toEqual([]);
    });

    it('should limit projects to 10', async () => {
      const manyProjects = Array.from({ length: 20 }, (_, i) => ({
        id: `p${i}`,
        name: `Project ${i}`,
        status: 'active',
        progress: 50,
      }));

      (Api.get as any).mockImplementation((url: string) => {
        if (url.includes('/projects')) return Promise.resolve({ projects: manyProjects });
        return Promise.resolve({});
      });

      const { result } = renderHook(() => useOrganizationContext());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.context?.activeProjects.length).toBe(10);
    });

    it('should handle partial API failures', async () => {
      (Api.get as any).mockImplementation((url: string) => {
        if (url.includes('/profile')) return Promise.resolve(mockOrgData);
        if (url.includes('/projects')) return Promise.reject(new Error('Projects API failed'));
        if (url.includes('/initiatives')) return Promise.resolve(mockInitiatives);
        return Promise.resolve({});
      });

      const { result } = renderHook(() => useOrganizationContext());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still have other data
      expect(result.current.context?.companyName).toBe('Test Organization');
      expect(result.current.context?.initiatives.length).toBe(2);
      expect(result.current.context?.activeProjects).toEqual([]);
    });
  });
});
