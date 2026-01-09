/**
 * Portfolio Store
 *
 * Zustand state management for Portfolio & Roadmap view.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { PortfolioFilters, PortfolioSortConfig, PortfolioViewMode } from '../types';

interface PortfolioState {
    // View state
    viewMode: PortfolioViewMode;

    // Filter state
    filters: PortfolioFilters;

    // Sort state
    sortConfig: PortfolioSortConfig;

    // Selection state
    selectedInitiativeId: string | null;
    selectedInitiativeIds: string[]; // For bulk actions

    // Side panel state
    isSidePanelOpen: boolean;

    // Actions
    setViewMode: (mode: PortfolioViewMode) => void;
    setFilters: (filters: Partial<PortfolioFilters>) => void;
    clearFilters: () => void;
    setSortConfig: (config: PortfolioSortConfig) => void;
    selectInitiative: (id: string | null) => void;
    toggleInitiativeSelection: (id: string) => void;
    clearSelection: () => void;
    openSidePanel: (initiativeId: string) => void;
    closeSidePanel: () => void;
}

const initialFilters: PortfolioFilters = {};

const initialSortConfig: PortfolioSortConfig = {
    field: 'priority',
    direction: 'asc',
};

export const usePortfolioStore = create<PortfolioState>()(
    persist(
        (set) => ({
            // Initial state
            viewMode: 'kanban',
            filters: initialFilters,
            sortConfig: initialSortConfig,
            selectedInitiativeId: null,
            selectedInitiativeIds: [],
            isSidePanelOpen: false,

            // Actions
            setViewMode: (mode) => set({ viewMode: mode }),

            setFilters: (filters) =>
                set((state) => ({
                    filters: { ...state.filters, ...filters },
                })),

            clearFilters: () => set({ filters: initialFilters }),

            setSortConfig: (config) => set({ sortConfig: config }),

            selectInitiative: (id) =>
                set({
                    selectedInitiativeId: id,
                    isSidePanelOpen: id !== null,
                }),

            toggleInitiativeSelection: (id) =>
                set((state) => {
                    const newSelection = [...state.selectedInitiativeIds];
                    const index = newSelection.indexOf(id);
                    if (index === -1) {
                        newSelection.push(id);
                    } else {
                        newSelection.splice(index, 1);
                    }
                    return { selectedInitiativeIds: newSelection };
                }),

            clearSelection: () =>
                set({
                    selectedInitiativeIds: [],
                }),

            openSidePanel: (initiativeId) =>
                set({
                    selectedInitiativeId: initiativeId,
                    isSidePanelOpen: true,
                }),

            closeSidePanel: () =>
                set({
                    isSidePanelOpen: false,
                    selectedInitiativeId: null,
                }),
        }),
        {
            name: 'consultinity-portfolio',
            partialize: (state) => ({
                viewMode: state.viewMode,
                sortConfig: state.sortConfig,
            }),
        },
    ),
);
