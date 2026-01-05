/**
 * Multi-Framework Assessment Store
 *
 * Zustand store for managing assessment data across all frameworks:
 * - SIRI (Smart Industry Readiness Index)
 * - ADMA (Advanced Digital Maturity Assessment)
 * - CMMI (Capability Maturity Model Integration)
 * - LEAN (DBR77 Lean 4.0)
 *
 * Provides unified state management with framework-specific data structures.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { ADMAAssessmentData } from '../services/admaStructure';
import { CMMIAssessmentData } from '../services/cmmiStructure';
import { DBR77AssessmentData } from '../services/dbr77LeanStructure';
import { SIRIAssessmentData } from '../services/siriStructure';

// ============================================
// TYPES
// ============================================

export type AssessmentFramework = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

export type WorkflowStatus = 'DRAFT' | 'IN_REVIEW' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface AssessmentMetadata {
    id: string;
    projectId: string;
    organizationId: string;
    name: string;
    framework: AssessmentFramework;
    status: WorkflowStatus;
    version: number;
    overallScore?: number;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    importSource?: {
        fileName: string;
        uploadedAt: string;
        confidence: number;
    };
}

export interface MultiFrameworkState {
    // Active assessment context
    activeAssessmentId: string | null;
    activeFramework: AssessmentFramework | null;
    activeMetadata: AssessmentMetadata | null;

    // Framework-specific data
    siriData: SIRIAssessmentData | null;
    admaData: ADMAAssessmentData | null;
    cmmiData: CMMIAssessmentData | null;
    leanData: DBR77AssessmentData | null;

    // State flags
    isDirty: boolean;
    isLoading: boolean;
    isSaving: boolean;
    lastSaved: Date | null;
    error: string | null;

    // Recently accessed assessments (for quick switching)
    recentAssessments: AssessmentMetadata[];
}

export interface MultiFrameworkActions {
    // Framework data setters
    setFrameworkData: (framework: AssessmentFramework, data: any) => void;
    setSIRIData: (data: Partial<SIRIAssessmentData>) => void;
    setADMAData: (data: Partial<ADMAAssessmentData>) => void;
    setCMMIData: (data: Partial<CMMIAssessmentData>) => void;
    setLeanData: (data: Partial<DBR77AssessmentData>) => void;

    // Assessment lifecycle
    createAssessment: (
        projectId: string,
        organizationId: string,
        framework: AssessmentFramework,
        name: string,
    ) => Promise<string>;
    loadAssessment: (id: string, framework: AssessmentFramework) => Promise<void>;
    saveAssessment: () => Promise<void>;
    deleteAssessment: (id: string) => Promise<void>;
    duplicateAssessment: (id: string, newName: string) => Promise<string>;

    // Workflow actions
    submitForReview: (reviewerIds: string[]) => Promise<void>;
    approve: (feedback?: string) => Promise<void>;
    reject: (reason: string) => Promise<void>;

    // State management
    setActiveAssessment: (id: string | null, framework: AssessmentFramework | null) => void;
    setMetadata: (metadata: Partial<AssessmentMetadata>) => void;
    markDirty: () => void;
    markClean: () => void;
    setError: (error: string | null) => void;
    resetStore: () => void;

    // Utility
    getActiveData: () => SIRIAssessmentData | ADMAAssessmentData | CMMIAssessmentData | DBR77AssessmentData | null;
    addToRecent: (assessment: AssessmentMetadata) => void;
}

export type MultiFrameworkStore = MultiFrameworkState & MultiFrameworkActions;

// ============================================
// INITIAL STATE
// ============================================

const initialState: MultiFrameworkState = {
    activeAssessmentId: null,
    activeFramework: null,
    activeMetadata: null,
    siriData: null,
    admaData: null,
    cmmiData: null,
    leanData: null,
    isDirty: false,
    isLoading: false,
    isSaving: false,
    lastSaved: null,
    error: null,
    recentAssessments: [],
};

// ============================================
// STORE
// ============================================

export const useMultiFrameworkStore = create<MultiFrameworkStore>()(
    persist(
        immer((set, get) => ({
            ...initialState,

            // ============================================
            // FRAMEWORK DATA SETTERS
            // ============================================

            setFrameworkData: (framework: AssessmentFramework, data: any) => {
                set((state) => {
                    switch (framework) {
                        case 'SIRI':
                            state.siriData = data;
                            break;
                        case 'ADMA':
                            state.admaData = data;
                            break;
                        case 'CMMI':
                            state.cmmiData = data;
                            break;
                        case 'LEAN':
                            state.leanData = data;
                            break;
                    }
                    state.isDirty = true;
                });
            },

            setSIRIData: (data: Partial<SIRIAssessmentData>) => {
                set((state) => {
                    state.siriData = { ...state.siriData, ...data } as SIRIAssessmentData;
                    state.isDirty = true;
                });
            },

            setADMAData: (data: Partial<ADMAAssessmentData>) => {
                set((state) => {
                    state.admaData = { ...state.admaData, ...data } as ADMAAssessmentData;
                    state.isDirty = true;
                });
            },

            setCMMIData: (data: Partial<CMMIAssessmentData>) => {
                set((state) => {
                    state.cmmiData = { ...state.cmmiData, ...data } as CMMIAssessmentData;
                    state.isDirty = true;
                });
            },

            setLeanData: (data: Partial<DBR77AssessmentData>) => {
                set((state) => {
                    state.leanData = { ...state.leanData, ...data } as DBR77AssessmentData;
                    state.isDirty = true;
                });
            },

            // ============================================
            // ASSESSMENT LIFECYCLE
            // ============================================

            createAssessment: async (projectId, organizationId, framework, name) => {
                set({ isLoading: true, error: null });

                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`/api/mf-assessments/${projectId}/${framework}`, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ name, organizationId }),
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.message || 'Failed to create assessment');
                    }

                    const result = await response.json();

                    set((state) => {
                        state.activeAssessmentId = result.id;
                        state.activeFramework = framework;
                        state.activeMetadata = {
                            id: result.id,
                            projectId,
                            organizationId,
                            name,
                            framework,
                            status: 'DRAFT',
                            version: 1,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        };
                        state.isDirty = false;
                        state.isLoading = false;
                    });

                    return result.id;
                } catch (error: any) {
                    set({ error: error.message, isLoading: false });
                    throw error;
                }
            },

            loadAssessment: async (id, framework) => {
                set({ isLoading: true, error: null });

                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`/api/mf-assessments/${id}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });

                    if (!response.ok) {
                        throw new Error('Failed to load assessment');
                    }

                    const result = await response.json();

                    set((state) => {
                        state.activeAssessmentId = id;
                        state.activeFramework = framework;
                        state.activeMetadata = {
                            id: result.id,
                            projectId: result.project_id,
                            organizationId: result.organization_id,
                            name: result.name,
                            framework: result.framework,
                            status: result.status,
                            version: result.version,
                            overallScore: result.overall_score,
                            createdAt: result.created_at,
                            updatedAt: result.updated_at,
                            importSource: result.import_source,
                        };

                        // Set framework-specific data
                        switch (framework) {
                            case 'SIRI':
                                state.siriData = result.data;
                                break;
                            case 'ADMA':
                                state.admaData = result.data;
                                break;
                            case 'CMMI':
                                state.cmmiData = result.data;
                                break;
                            case 'LEAN':
                                state.leanData = result.data;
                                break;
                        }

                        state.isDirty = false;
                        state.isLoading = false;
                        state.lastSaved = new Date(result.updated_at);
                    });

                    // Add to recents
                    get().addToRecent(get().activeMetadata!);
                } catch (error: any) {
                    set({ error: error.message, isLoading: false });
                    throw error;
                }
            },

            saveAssessment: async () => {
                const state = get();
                if (!state.activeAssessmentId || !state.activeFramework) {
                    throw new Error('No active assessment to save');
                }

                set({ isSaving: true, error: null });

                try {
                    const token = localStorage.getItem('token');
                    const data = state.getActiveData();

                    const response = await fetch(`/api/mf-assessments/${state.activeAssessmentId}`, {
                        method: 'PUT',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            data,
                            name: state.activeMetadata?.name,
                        }),
                    });

                    if (!response.ok) {
                        throw new Error('Failed to save assessment');
                    }

                    const result = await response.json();

                    set((state) => {
                        state.isDirty = false;
                        state.isSaving = false;
                        state.lastSaved = new Date();
                        if (state.activeMetadata) {
                            state.activeMetadata.version = result.version;
                            state.activeMetadata.updatedAt = result.updated_at;
                            state.activeMetadata.overallScore = result.overall_score;
                        }
                    });
                } catch (error: any) {
                    set({ error: error.message, isSaving: false });
                    throw error;
                }
            },

            deleteAssessment: async (id) => {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/mf-assessments/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) {
                    throw new Error('Failed to delete assessment');
                }

                // If deleting active assessment, reset state
                if (get().activeAssessmentId === id) {
                    get().resetStore();
                }

                // Remove from recents
                set((state) => {
                    state.recentAssessments = state.recentAssessments.filter((a) => a.id !== id);
                });
            },

            duplicateAssessment: async (id, newName) => {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/mf-assessments/${id}/duplicate`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: newName }),
                });

                if (!response.ok) {
                    throw new Error('Failed to duplicate assessment');
                }

                const result = await response.json();
                return result.id;
            },

            // ============================================
            // WORKFLOW ACTIONS
            // ============================================

            submitForReview: async (reviewerIds) => {
                const state = get();
                if (!state.activeAssessmentId) {
                    throw new Error('No active assessment');
                }

                // Save first if dirty
                if (state.isDirty) {
                    await state.saveAssessment();
                }

                const token = localStorage.getItem('token');
                const response = await fetch(
                    `/api/assessment-workflow/${state.activeAssessmentId}/submit-for-review?framework=${state.activeFramework}`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ reviewerIds }),
                    },
                );

                if (!response.ok) {
                    throw new Error('Failed to submit for review');
                }

                set((state) => {
                    if (state.activeMetadata) {
                        state.activeMetadata.status = 'IN_REVIEW';
                    }
                });
            },

            approve: async (feedback) => {
                const state = get();
                if (!state.activeAssessmentId) {
                    throw new Error('No active assessment');
                }

                const token = localStorage.getItem('token');
                const response = await fetch(
                    `/api/assessment-workflow/${state.activeAssessmentId}/approve?framework=${state.activeFramework}`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ feedback }),
                    },
                );

                if (!response.ok) {
                    throw new Error('Failed to approve');
                }

                set((state) => {
                    if (state.activeMetadata) {
                        state.activeMetadata.status = 'APPROVED';
                    }
                });
            },

            reject: async (reason) => {
                const state = get();
                if (!state.activeAssessmentId) {
                    throw new Error('No active assessment');
                }

                const token = localStorage.getItem('token');
                const response = await fetch(
                    `/api/assessment-workflow/${state.activeAssessmentId}/reject?framework=${state.activeFramework}`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ reason }),
                    },
                );

                if (!response.ok) {
                    throw new Error('Failed to reject');
                }

                set((state) => {
                    if (state.activeMetadata) {
                        state.activeMetadata.status = 'REJECTED';
                    }
                });
            },

            // ============================================
            // STATE MANAGEMENT
            // ============================================

            setActiveAssessment: (id, framework) => {
                set((state) => {
                    state.activeAssessmentId = id;
                    state.activeFramework = framework;
                });
            },

            setMetadata: (metadata) => {
                set((state) => {
                    if (state.activeMetadata) {
                        Object.assign(state.activeMetadata, metadata);
                    }
                });
            },

            markDirty: () => set({ isDirty: true }),
            markClean: () => set({ isDirty: false }),
            setError: (error) => set({ error }),

            resetStore: () => {
                set((state) => {
                    state.activeAssessmentId = null;
                    state.activeFramework = null;
                    state.activeMetadata = null;
                    state.siriData = null;
                    state.admaData = null;
                    state.cmmiData = null;
                    state.leanData = null;
                    state.isDirty = false;
                    state.isLoading = false;
                    state.isSaving = false;
                    state.lastSaved = null;
                    state.error = null;
                });
            },

            // ============================================
            // UTILITY
            // ============================================

            getActiveData: () => {
                const state = get();
                switch (state.activeFramework) {
                    case 'SIRI':
                        return state.siriData;
                    case 'ADMA':
                        return state.admaData;
                    case 'CMMI':
                        return state.cmmiData;
                    case 'LEAN':
                        return state.leanData;
                    default:
                        return null;
                }
            },

            addToRecent: (assessment) => {
                set((state) => {
                    // Remove if already exists
                    state.recentAssessments = state.recentAssessments.filter((a) => a.id !== assessment.id);
                    // Add to front
                    state.recentAssessments.unshift(assessment);
                    // Keep only last 10
                    state.recentAssessments = state.recentAssessments.slice(0, 10);
                });
            },
        })),
        {
            name: 'multi-framework-assessment-store',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                // Only persist recent assessments and active IDs
                recentAssessments: state.recentAssessments,
                activeAssessmentId: state.activeAssessmentId,
                activeFramework: state.activeFramework,
            }),
        },
    ),
);

// ============================================
// SELECTORS (for performance)
// ============================================

export const selectActiveFramework = (state: MultiFrameworkStore) => state.activeFramework;
export const selectActiveData = (state: MultiFrameworkStore) => state.getActiveData();
export const selectIsDirty = (state: MultiFrameworkStore) => state.isDirty;
export const selectIsLoading = (state: MultiFrameworkStore) => state.isLoading;
export const selectIsSaving = (state: MultiFrameworkStore) => state.isSaving;
export const selectActiveMetadata = (state: MultiFrameworkStore) => state.activeMetadata;
export const selectRecentAssessments = (state: MultiFrameworkStore) => state.recentAssessments;

// ============================================
// HOOKS
// ============================================

/**
 * Hook for accessing framework-specific data
 */
export function useFrameworkData<T>(framework: AssessmentFramework): T | null {
    return useMultiFrameworkStore((state) => {
        switch (framework) {
            case 'SIRI':
                return state.siriData as T | null;
            case 'ADMA':
                return state.admaData as T | null;
            case 'CMMI':
                return state.cmmiData as T | null;
            case 'LEAN':
                return state.leanData as T | null;
            default:
                return null;
        }
    });
}

/**
 * Hook for auto-save functionality
 */
export function useAutoSave(intervalMs: number = 30000) {
    const isDirty = useMultiFrameworkStore(selectIsDirty);
    const isSaving = useMultiFrameworkStore(selectIsSaving);
    const saveAssessment = useMultiFrameworkStore((state) => state.saveAssessment);

    // Auto-save effect would be implemented in the component using this hook
    return { isDirty, isSaving, saveAssessment };
}

export default useMultiFrameworkStore;




