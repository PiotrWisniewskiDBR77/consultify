import { useState, useEffect, useCallback } from 'react';
import { Api } from '../services/api';
import { ACTIVATION_MILESTONES, isPhaseActivated } from '../config/activationMilestones';

/**
 * useJourneyProgress — Track user's journey progress
 * 
 * Features:
 * - Fetches journey data from API
 * - Calculates phase completion
 * - Provides next best action
 */

export interface PhaseProgress {
    phase: string;
    phaseName: string;
    isCompleted: boolean;
    isActivated: boolean;
    completedMilestones: string[];
    totalMilestones: number;
    progress: number; // 0-100
}

export interface JourneyProgress {
    currentPhase: string;
    phases: Record<string, PhaseProgress>;
    overallProgress: number;
    timeToValue: {
        total: number | null;
        breakdown: Record<string, number | null>;
    } | null;
    nextAction: {
        label: string;
        description: string;
        phase: string;
        milestoneId: string;
    } | null;
}

const PHASE_NAMES: Record<string, string> = {
    A: 'Pre-Entry',
    B: 'Demo',
    C: 'Trial Entry',
    D: 'Organization Setup',
    E: 'First Value',
    F: 'Team Expansion',
};

const PHASE_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'];

const getNextAction = (phases: Record<string, PhaseProgress>): JourneyProgress['nextAction'] => {
    // Find first incomplete phase
    for (const phaseKey of PHASE_ORDER) {
        const phase = phases[phaseKey];
        if (!phase.isActivated) {
            // Find first incomplete milestone
            const milestones = ACTIVATION_MILESTONES[phaseKey]?.milestones || [];
            const incomplete = milestones.find(
                m => !phase.completedMilestones.includes(m.id)
            );

            if (incomplete) {
                return {
                    label: incomplete.name,
                    description: incomplete.description,
                    phase: phaseKey,
                    milestoneId: incomplete.id,
                };
            }
        }
    }

    return null;
};

export const useJourneyProgress = () => {
    const [progress, setProgress] = useState<JourneyProgress | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProgress = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await Api.get('/analytics/journey/me');
            const data = response.data;

            if (!data.success) {
                throw new Error('Failed to fetch journey data');
            }

            // Build phase progress map
            const completedMilestoneIds = (data.journey || []).map((e: any) => e.event_name);
            const phases: Record<string, PhaseProgress> = {};

            let currentPhase = 'A';
            let totalCompleted = 0;
            let totalMilestones = 0;

            PHASE_ORDER.forEach(phaseKey => {
                const phaseConfig = ACTIVATION_MILESTONES[phaseKey];
                if (!phaseConfig) return;

                const milestones = phaseConfig.milestones || [];
                const completed = milestones.filter(m => completedMilestoneIds.includes(m.id));
                const isActivated = isPhaseActivated(phaseKey, completedMilestoneIds);

                phases[phaseKey] = {
                    phase: phaseKey,
                    phaseName: PHASE_NAMES[phaseKey],
                    isCompleted: isActivated,
                    isActivated,
                    completedMilestones: completed.map(m => m.id),
                    totalMilestones: milestones.length,
                    progress: milestones.length > 0
                        ? Math.round((completed.length / milestones.length) * 100)
                        : 0,
                };

                if (isActivated) {
                    currentPhase = phaseKey;
                }

                totalCompleted += completed.length;
                totalMilestones += milestones.length;
            });

            // Find actual current phase (first non-completed)
            for (const phaseKey of PHASE_ORDER) {
                if (!phases[phaseKey]?.isActivated) {
                    currentPhase = phaseKey;
                    break;
                }
            }

            const journeyProgress: JourneyProgress = {
                currentPhase,
                phases,
                overallProgress: totalMilestones > 0
                    ? Math.round((totalCompleted / totalMilestones) * 100)
                    : 0,
                timeToValue: data.timeToValue || null,
                nextAction: getNextAction(phases),
            };

            setProgress(journeyProgress);
            setError(null);
        } catch (err) {
            console.error('Journey progress fetch error:', err);
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProgress();
    }, [fetchProgress]);

    return {
        progress,
        isLoading,
        error,
        refresh: fetchProgress,
    };
};

export default useJourneyProgress;
