/**
 * useInitiativeGenerator Hook
 * 
 * React hook for managing initiative generation from assessment gaps.
 * Provides state management and API calls for the Initiative Generator wizard.
 */

import { useState, useCallback, useEffect } from 'react';
import { 
    GapForGeneration, 
    GeneratedInitiative, 
    InitiativeGeneratorConstraints,
    DRDAxis 
} from '../types';

interface UseInitiativeGeneratorResult {
    // State
    gaps: GapForGeneration[];
    generatedInitiatives: GeneratedInitiative[];
    draftInitiatives: GeneratedInitiative[];
    isLoading: boolean;
    isGenerating: boolean;
    isSaving: boolean;
    error: string | null;

    // Actions
    fetchGaps: (assessmentId: string) => Promise<void>;
    selectGap: (axisId: DRDAxis, selected: boolean) => void;
    selectAllGaps: (selected: boolean) => void;
    generateWithAI: (constraints: InitiativeGeneratorConstraints) => Promise<void>;
    editInitiative: (id: string, updates: Partial<GeneratedInitiative>) => void;
    removeInitiative: (id: string) => void;
    addCustomInitiative: (initiative: Partial<GeneratedInitiative>) => void;
    saveDraft: () => Promise<void>;
    loadDraft: (assessmentId: string) => Promise<void>;
    approveAndTransfer: (projectId: string) => Promise<{ transferred: string[]; failed: string[] }>;
    validateInitiative: (initiative: GeneratedInitiative) => Promise<{ valid: boolean; errors: string[]; warnings: string[] }>;
    reset: () => void;
}

export function useInitiativeGenerator(assessmentId?: string): UseInitiativeGeneratorResult {
    // State
    const [gaps, setGaps] = useState<GapForGeneration[]>([]);
    const [generatedInitiatives, setGeneratedInitiatives] = useState<GeneratedInitiative[]>([]);
    const [draftInitiatives, setDraftInitiatives] = useState<GeneratedInitiative[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get auth token
    const getToken = () => localStorage.getItem('token');

    // Fetch gaps for assessment
    const fetchGaps = useCallback(async (assessmentIdToFetch: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/initiatives/gaps/${assessmentIdToFetch}`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch gaps');
            }

            const data = await response.json();
            
            // Map to GapForGeneration format with selected = false initially
            const mappedGaps: GapForGeneration[] = data.gaps.map((gap: any) => ({
                axisId: gap.axisId,
                axisName: gap.axisName,
                currentScore: gap.currentScore,
                targetScore: gap.targetScore,
                gap: gap.gap,
                priority: gap.priority,
                selected: false
            }));

            setGaps(mappedGaps);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Select/deselect gap
    const selectGap = useCallback((axisId: DRDAxis, selected: boolean) => {
        setGaps(prev => prev.map(gap => 
            gap.axisId === axisId ? { ...gap, selected } : gap
        ));
    }, []);

    // Select/deselect all gaps
    const selectAllGaps = useCallback((selected: boolean) => {
        setGaps(prev => prev.map(gap => ({ ...gap, selected })));
    }, []);

    // Generate initiatives with AI
    const generateWithAI = useCallback(async (constraints: InitiativeGeneratorConstraints) => {
        setIsGenerating(true);
        setError(null);

        try {
            const selectedGaps = gaps.filter(g => g.selected);
            
            if (selectedGaps.length === 0) {
                throw new Error('Please select at least one gap');
            }

            const response = await fetch('/api/initiatives/generate/ai', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    gaps: selectedGaps,
                    constraints,
                    context: {
                        assessmentId
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate initiatives');
            }

            const data = await response.json();
            setGeneratedInitiatives(data.initiatives);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsGenerating(false);
        }
    }, [gaps, assessmentId]);

    // Edit initiative
    const editInitiative = useCallback((id: string, updates: Partial<GeneratedInitiative>) => {
        setGeneratedInitiatives(prev => prev.map(init =>
            init.id === id ? { ...init, ...updates } : init
        ));
    }, []);

    // Remove initiative
    const removeInitiative = useCallback((id: string) => {
        setGeneratedInitiatives(prev => prev.filter(init => init.id !== id));
    }, []);

    // Add custom initiative
    const addCustomInitiative = useCallback((initiative: Partial<GeneratedInitiative>) => {
        const newInitiative: GeneratedInitiative = {
            id: `custom-${Date.now()}`,
            assessmentId: assessmentId || '',
            sourceAxisId: initiative.sourceAxisId || 'processes',
            name: initiative.name || 'Custom Initiative',
            description: initiative.description || '',
            objectives: initiative.objectives || [],
            estimatedROI: initiative.estimatedROI || 1.5,
            estimatedBudget: initiative.estimatedBudget || 100000,
            timeline: initiative.timeline || '3-6 months',
            riskLevel: initiative.riskLevel || 'MEDIUM',
            priority: initiative.priority || 5,
            status: 'DRAFT',
            aiGenerated: false,
            createdAt: new Date()
        };

        setGeneratedInitiatives(prev => [...prev, newInitiative]);
    }, [assessmentId]);

    // Save draft
    const saveDraft = useCallback(async () => {
        if (!assessmentId) {
            setError('No assessment ID provided');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const response = await fetch(`/api/initiatives/draft/${assessmentId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    initiatives: generatedInitiatives
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save draft');
            }

            setDraftInitiatives(generatedInitiatives);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsSaving(false);
        }
    }, [assessmentId, generatedInitiatives]);

    // Load draft
    const loadDraft = useCallback(async (assessmentIdToLoad: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/initiatives/draft/${assessmentIdToLoad}`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load draft');
            }

            const data = await response.json();
            setDraftInitiatives(data.initiatives || []);
            
            // If we have draft initiatives, use them as generated
            if (data.initiatives && data.initiatives.length > 0) {
                setGeneratedInitiatives(data.initiatives);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Approve and transfer to Module 3
    const approveAndTransfer = useCallback(async (projectId: string) => {
        setIsSaving(true);
        setError(null);

        try {
            const response = await fetch('/api/initiatives/approve', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    initiatives: generatedInitiatives,
                    projectId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to approve initiatives');
            }

            const data = await response.json();
            
            // Clear generated initiatives on success
            if (data.transferred && data.transferred.length > 0) {
                setGeneratedInitiatives([]);
                setDraftInitiatives([]);
            }

            return {
                transferred: data.transferred?.map((t: any) => t.id) || [],
                failed: data.failed?.map((f: any) => f.id) || []
            };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            return { transferred: [], failed: [] };
        } finally {
            setIsSaving(false);
        }
    }, [generatedInitiatives]);

    // Validate initiative
    const validateInitiative = useCallback(async (initiative: GeneratedInitiative) => {
        try {
            const response = await fetch('/api/initiatives/validate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ initiative })
            });

            if (!response.ok) {
                throw new Error('Validation failed');
            }

            return await response.json();
        } catch (err) {
            return {
                valid: false,
                errors: [err instanceof Error ? err.message : 'Validation error'],
                warnings: []
            };
        }
    }, []);

    // Reset state
    const reset = useCallback(() => {
        setGaps([]);
        setGeneratedInitiatives([]);
        setDraftInitiatives([]);
        setError(null);
    }, []);

    // Auto-load gaps if assessmentId is provided
    useEffect(() => {
        if (assessmentId) {
            fetchGaps(assessmentId);
            loadDraft(assessmentId);
        }
    }, [assessmentId, fetchGaps, loadDraft]);

    return {
        // State
        gaps,
        generatedInitiatives,
        draftInitiatives,
        isLoading,
        isGenerating,
        isSaving,
        error,

        // Actions
        fetchGaps,
        selectGap,
        selectAllGaps,
        generateWithAI,
        editInitiative,
        removeInitiative,
        addCustomInitiative,
        saveDraft,
        loadDraft,
        approveAndTransfer,
        validateInitiative,
        reset
    };
}

export default useInitiativeGenerator;

