/**
 * First Value Tour Configuration
 * Onboarding tour for new users
 */

export interface TourStep {
    target: string;
    title: string;
    titlePl?: string;
    content: string;
    contentPl?: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    action?: string;
}

export const FIRST_VALUE_TOUR: TourStep[] = [
    {
        target: '[data-tour="dashboard"]',
        title: 'Welcome to Consultinity',
        titlePl: 'Witamy w Consultinity',
        content: 'This is your dashboard where you can see all your projects and tasks.',
        contentPl: 'To jest Twój dashboard, gdzie możesz zobaczyć wszystkie projekty i zadania.',
        placement: 'bottom',
    },
    {
        target: '[data-tour="ai-chat"]',
        title: 'AI Assistant',
        titlePl: 'Asystent AI',
        content: 'Use our AI assistant to get help with your projects.',
        contentPl: 'Użyj naszego asystenta AI, aby uzyskać pomoc z projektami.',
        placement: 'left',
    },
];

export const getFirstValueTour = () => FIRST_VALUE_TOUR;



