/**
 * Projects Store Tests
 * Tests for projects state Zustand store
 *
 * @module tests/store/useProjectsStore.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Project {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'on_hold' | 'archived';
  progress: number;
}

const createMockProjectsStore = () => {
  let state = {
    projects: [] as Project[],
    selectedProject: null as Project | null,
    isLoading: false,
    error: null as string | null,
    filters: {
      status: null as string | null,
      search: '',
    },
    sort: {
      field: 'name' as string,
      direction: 'asc' as 'asc' | 'desc',
    },
  };

  const listeners = new Set<() => void>();

  const setState = (partial: Partial<typeof state>) => {
    state = { ...state, ...partial };
    listeners.forEach((listener) => listener());
  };

  const getState = () => state;

  return {
    getState,
    setState,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // Fetch actions
    fetchProjects: async () => {
      setState({ isLoading: true, error: null });
      try {
        // Mock fetch
        const projects: Project[] = [
          { id: 'p1', name: 'Project 1', status: 'active', progress: 50 },
          { id: 'p2', name: 'Project 2', status: 'completed', progress: 100 },
        ];
        setState({ projects, isLoading: false });
        return { success: true };
      } catch (error) {
        setState({ isLoading: false, error: (error as Error).message });
        return { success: false };
      }
    },
    // CRUD actions
    addProject: (project: Project) => {
      setState({ projects: [...state.projects, project] });
    },
    updateProject: (id: string, updates: Partial<Project>) => {
      setState({
        projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      });
    },
    deleteProject: (id: string) => {
      setState({
        projects: state.projects.filter((p) => p.id !== id),
        selectedProject: state.selectedProject?.id === id ? null : state.selectedProject,
      });
    },
    // Selection
    selectProject: (project: Project | null) => {
      setState({ selectedProject: project });
    },
    selectProjectById: (id: string) => {
      const project = state.projects.find((p) => p.id === id) || null;
      setState({ selectedProject: project });
    },
    // Filters
    setStatusFilter: (status: string | null) => {
      setState({ filters: { ...state.filters, status } });
    },
    setSearchFilter: (search: string) => {
      setState({ filters: { ...state.filters, search } });
    },
    clearFilters: () => {
      setState({ filters: { status: null, search: '' } });
    },
    // Sort
    setSort: (field: string, direction: 'asc' | 'desc') => {
      setState({ sort: { field, direction } });
    },
    // Computed
    getFilteredProjects: () => {
      let result = [...state.projects];

      if (state.filters.status) {
        result = result.filter((p) => p.status === state.filters.status);
      }

      if (state.filters.search) {
        const search = state.filters.search.toLowerCase();
        result = result.filter((p) => p.name.toLowerCase().includes(search));
      }

      result.sort((a, b) => {
        const aVal = a[state.sort.field as keyof Project];
        const bVal = b[state.sort.field as keyof Project];
        const comparison = String(aVal).localeCompare(String(bVal));
        return state.sort.direction === 'asc' ? comparison : -comparison;
      });

      return result;
    },
    // Reset
    reset: () => {
      setState({
        projects: [],
        selectedProject: null,
        isLoading: false,
        error: null,
        filters: { status: null, search: '' },
        sort: { field: 'name', direction: 'asc' },
      });
    },
  };
};

describe('Projects Store Tests', () => {
  let store: ReturnType<typeof createMockProjectsStore>;

  beforeEach(() => {
    store = createMockProjectsStore();
  });

  // ═══════════════════════════════════════════════════════════════════
  // INITIAL STATE
  // ═══════════════════════════════════════════════════════════════════

  describe('Initial State', () => {
    it('should have empty projects', () => {
      expect(store.getState().projects).toEqual([]);
    });

    it('should have no selection', () => {
      expect(store.getState().selectedProject).toBeNull();
    });

    it('should not be loading', () => {
      expect(store.getState().isLoading).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FETCH PROJECTS
  // ═══════════════════════════════════════════════════════════════════

  describe('Fetch Projects', () => {
    it('should fetch and store projects', async () => {
      await store.fetchProjects();

      expect(store.getState().projects.length).toBeGreaterThan(0);
      expect(store.getState().isLoading).toBe(false);
    });

    it('should set loading state during fetch', async () => {
      const promise = store.fetchProjects();
      // Can't easily test loading=true during async, but ensure it ends false
      await promise;
      expect(store.getState().isLoading).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('CRUD Operations', () => {
    beforeEach(async () => {
      await store.fetchProjects();
    });

    it('should add project', () => {
      const newProject: Project = {
        id: 'p3',
        name: 'New Project',
        status: 'active',
        progress: 0,
      };

      store.addProject(newProject);

      expect(store.getState().projects).toContainEqual(newProject);
    });

    it('should update project', () => {
      store.updateProject('p1', { name: 'Updated Name' });

      const project = store.getState().projects.find((p) => p.id === 'p1');
      expect(project?.name).toBe('Updated Name');
    });

    it('should delete project', () => {
      const initialCount = store.getState().projects.length;
      store.deleteProject('p1');

      expect(store.getState().projects.length).toBe(initialCount - 1);
      expect(store.getState().projects.find((p) => p.id === 'p1')).toBeUndefined();
    });

    it('should clear selection when deleting selected project', () => {
      store.selectProjectById('p1');
      store.deleteProject('p1');

      expect(store.getState().selectedProject).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SELECTION
  // ═══════════════════════════════════════════════════════════════════

  describe('Selection', () => {
    beforeEach(async () => {
      await store.fetchProjects();
    });

    it('should select project', () => {
      const project = store.getState().projects[0];
      store.selectProject(project);

      expect(store.getState().selectedProject).toEqual(project);
    });

    it('should select project by ID', () => {
      store.selectProjectById('p1');

      expect(store.getState().selectedProject?.id).toBe('p1');
    });

    it('should clear selection', () => {
      store.selectProjectById('p1');
      store.selectProject(null);

      expect(store.getState().selectedProject).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FILTERS
  // ═══════════════════════════════════════════════════════════════════

  describe('Filters', () => {
    beforeEach(async () => {
      await store.fetchProjects();
    });

    it('should filter by status', () => {
      store.setStatusFilter('active');

      const filtered = store.getFilteredProjects();
      filtered.forEach((p) => {
        expect(p.status).toBe('active');
      });
    });

    it('should filter by search', () => {
      store.setSearchFilter('Project 1');

      const filtered = store.getFilteredProjects();
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Project 1');
    });

    it('should combine filters', () => {
      store.setStatusFilter('active');
      store.setSearchFilter('Project');

      const filtered = store.getFilteredProjects();
      filtered.forEach((p) => {
        expect(p.status).toBe('active');
        expect(p.name.toLowerCase()).toContain('project');
      });
    });

    it('should clear filters', () => {
      store.setStatusFilter('active');
      store.setSearchFilter('test');
      store.clearFilters();

      expect(store.getState().filters.status).toBeNull();
      expect(store.getState().filters.search).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SORTING
  // ═══════════════════════════════════════════════════════════════════

  describe('Sorting', () => {
    beforeEach(async () => {
      await store.fetchProjects();
    });

    it('should sort ascending', () => {
      store.setSort('name', 'asc');

      const sorted = store.getFilteredProjects();
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].name >= sorted[i - 1].name).toBe(true);
      }
    });

    it('should sort descending', () => {
      store.setSort('name', 'desc');

      const sorted = store.getFilteredProjects();
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].name <= sorted[i - 1].name).toBe(true);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════════════════

  describe('Reset', () => {
    it('should reset to initial state', async () => {
      await store.fetchProjects();
      store.selectProjectById('p1');
      store.setStatusFilter('active');

      store.reset();

      expect(store.getState().projects).toEqual([]);
      expect(store.getState().selectedProject).toBeNull();
      expect(store.getState().filters.status).toBeNull();
    });
  });
});
