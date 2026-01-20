import { useMemo } from 'react';

export interface PhaseProgress {
  phase: string;
  phaseName: string;
  progress: number;
  isActivated: boolean;
  isCompleted?: boolean;
  completedMilestones?: string[];
  totalMilestones?: number;
}

export interface JourneyProgressState {
  phases: Record<string, PhaseProgress>;
  currentPhase: string;
  overallProgress: number;
  nextAction?: { label: string; phase: string };
}

export const useJourneyProgress = () => {
  const progress = useMemo<JourneyProgressState>(() => {
    const phases: Record<string, PhaseProgress> = {
      A: { phase: 'A', phaseName: 'Discovery', progress: 100, isActivated: true, isCompleted: true },
      B: { phase: 'B', phaseName: 'Assessment', progress: 80, isActivated: true },
      C: { phase: 'C', phaseName: 'Initiatives', progress: 45, isActivated: false },
      D: { phase: 'D', phaseName: 'Roadmap', progress: 0, isActivated: false },
      E: { phase: 'E', phaseName: 'Execution', progress: 0, isActivated: false },
      F: { phase: 'F', phaseName: 'Results', progress: 0, isActivated: false },
    };

    return {
      phases,
      currentPhase: 'B',
      overallProgress: 64,
      nextAction: {
        label: 'Complete assessment recommendations',
        phase: 'B',
      },
    };
  }, []);

  return {
    progress,
    isLoading: false,
    error: null as string | null,
  };
};

export default useJourneyProgress;
