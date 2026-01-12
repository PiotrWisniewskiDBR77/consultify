/**
 * Tour Configuration Types
 *
 * Type definitions for interactive onboarding tours.
 */

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export type UserRole = 'user' | 'admin' | 'superadmin' | 'consultant';

export interface TourStep {
    id: string;
    title: {
        en: string;
        pl: string;
    };
    content: {
        en: string;
        pl: string;
    };
    target?: string; // CSS selector for element to highlight
    placement?: TourPlacement;
    spotlightPadding?: number;
    disableInteraction?: boolean;
    waitForElement?: boolean;
    beforeShow?: () => Promise<void> | void;
    afterShow?: () => Promise<void> | void;
}

export interface TourCompletionAction {
    type: 'navigate' | 'openModal' | 'triggerEvent' | 'markComplete';
    target?: string;
    payload?: Record<string, unknown>;
}

export interface TourConfig {
    id: string;
    name: {
        en: string;
        pl: string;
    };
    description: {
        en: string;
        pl: string;
    };
    targetAudience: UserRole[];
    estimatedDuration: number; // minutes
    steps: TourStep[];
    completionActions?: TourCompletionAction[];
    prerequisites?: string[]; // Tour IDs that must be completed first
    autoStart?: boolean;
    showOnFirstVisit?: boolean;
}

export interface TourProgress {
    tourId: string;
    currentStep: number;
    isCompleted: boolean;
    isSkipped: boolean;
    startedAt?: string;
    completedAt?: string;
    skippedAt?: string;
}

