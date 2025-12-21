import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Tooltip } from './Tooltip';

/**
 * TourProvider — Context for managing interactive tours
 * 
 * Features:
 * - Tour state management
 * - Step navigation
 * - Persistence of completed tours
 * - Tracking integration
 */

export interface TourStep {
    id: string;
    targetSelector: string;
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    beforeShow?: () => Promise<void>;
    afterShow?: () => void;
}

export interface Tour {
    id: string;
    name: string;
    steps: TourStep[];
    triggerCondition: 'first_visit' | 'manual' | 'feature_unlock';
}

interface TourContextValue {
    activeTour: Tour | null;
    currentStepIndex: number;
    isActive: boolean;
    startTour: (tour: Tour) => void;
    nextStep: () => void;
    prevStep: () => void;
    endTour: (completed?: boolean) => void;
    skipTour: () => void;
    completedTours: string[];
    isTourCompleted: (tourId: string) => boolean;
}

const TourContext = createContext<TourContextValue | null>(null);

const STORAGE_KEY = 'consultify_completed_tours';

const getCompletedTours = (): string[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const saveCompletedTour = (tourId: string): void => {
    try {
        const completed = getCompletedTours();
        if (!completed.includes(tourId)) {
            completed.push(tourId);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
        }
    } catch (e) {
        console.warn('[TourProvider] Failed to save completed tour:', e);
    }
};

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeTour, setActiveTour] = useState<Tour | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [completedTours, setCompletedTours] = useState<string[]>([]);

    // Load completed tours on mount
    useEffect(() => {
        setCompletedTours(getCompletedTours());
    }, []);

    const startTour = useCallback((tour: Tour) => {
        // Don't restart completed tours unless manual
        if (tour.triggerCondition !== 'manual' && completedTours.includes(tour.id)) {
            return;
        }

        setActiveTour(tour);
        setCurrentStepIndex(0);

        // Run beforeShow for first step
        const firstStep = tour.steps[0];
        if (firstStep?.beforeShow) {
            firstStep.beforeShow();
        }
    }, [completedTours]);

    const nextStep = useCallback(async () => {
        if (!activeTour) return;

        const currentStep = activeTour.steps[currentStepIndex];
        if (currentStep?.afterShow) {
            currentStep.afterShow();
        }

        if (currentStepIndex < activeTour.steps.length - 1) {
            const nextIndex = currentStepIndex + 1;
            const nextStepDef = activeTour.steps[nextIndex];

            // Run beforeShow for next step
            if (nextStepDef?.beforeShow) {
                await nextStepDef.beforeShow();
            }

            setCurrentStepIndex(nextIndex);
        } else {
            // Tour completed
            endTour(true);
        }
    }, [activeTour, currentStepIndex]);

    const prevStep = useCallback(() => {
        if (!activeTour || currentStepIndex <= 0) return;
        setCurrentStepIndex(currentStepIndex - 1);
    }, [activeTour, currentStepIndex]);

    const endTour = useCallback((completed = false) => {
        if (activeTour && completed) {
            saveCompletedTour(activeTour.id);
            setCompletedTours(prev => [...prev, activeTour.id]);

            // Track completion event (if analytics available)
            try {
                // @ts-ignore - optional analytics
                window.journeyAnalytics?.trackMilestone?.('tour_completed', { tourId: activeTour.id });
            } catch { /* ignore */ }
        }

        setActiveTour(null);
        setCurrentStepIndex(0);
    }, [activeTour]);

    const skipTour = useCallback(() => {
        // Track skip event
        try {
            // @ts-ignore - optional analytics
            window.journeyAnalytics?.trackMilestone?.('tour_skipped', {
                tourId: activeTour?.id,
                stoppedAt: currentStepIndex
            });
        } catch { /* ignore */ }

        endTour(false);
    }, [activeTour, currentStepIndex, endTour]);

    const isTourCompleted = useCallback((tourId: string) => {
        return completedTours.includes(tourId);
    }, [completedTours]);

    const currentStep = activeTour?.steps[currentStepIndex];

    return (
        <TourContext.Provider
            value={{
                activeTour,
                currentStepIndex,
                isActive: !!activeTour,
                startTour,
                nextStep,
                prevStep,
                endTour,
                skipTour,
                completedTours,
                isTourCompleted,
            }}
        >
            {children}

            {/* Render active tour tooltip */}
            {activeTour && currentStep && (
                <Tooltip
                    targetSelector={currentStep.targetSelector}
                    title={currentStep.title}
                    content={currentStep.content}
                    position={currentStep.position || 'bottom'}
                    showBackdrop={true}
                    onNext={nextStep}
                    onPrev={currentStepIndex > 0 ? prevStep : undefined}
                    onDismiss={skipTour}
                    step={{
                        current: currentStepIndex + 1,
                        total: activeTour.steps.length,
                    }}
                    isVisible={true}
                />
            )}
        </TourContext.Provider>
    );
};

export const useTour = (): TourContextValue => {
    const context = useContext(TourContext);
    if (!context) {
        throw new Error('useTour must be used within a TourProvider');
    }
    return context;
};

export default TourProvider;
