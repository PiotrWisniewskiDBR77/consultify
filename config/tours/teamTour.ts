import { Tour } from '../../components/Onboarding/TourProvider';

/**
 * Team Tour — Phase F
 * 
 * Triggered when user is ready to expand the team.
 * Explains multi-perspective collaboration.
 */
export const TEAM_TOUR: Tour = {
    id: 'team_expansion',
    name: 'Praca zespołowa',
    triggerCondition: 'feature_unlock',
    steps: [
        {
            id: 'why_team',
            targetSelector: '[data-tour="team-section"]',
            title: 'Dlaczego zespół?',
            content: 'Niektóre decyzje wymagają wielu perspektyw. System pomaga zbierać różne punkty widzenia i wykrywać napięcia.',
            position: 'bottom',
        },
        {
            id: 'invite',
            targetSelector: '[data-tour="invite-button"]',
            title: 'Zaproś członka zespołu',
            content: 'Każda osoba dostaje własne zaproszenie. Mogą dodać swoją perspektywę na istniejące osie.',
            position: 'left',
        },
        {
            id: 'multi_perspective',
            targetSelector: '[data-tour="perspective-view"]',
            title: 'Widok perspektyw',
            content: 'Gdy masz kilka osób, system pokazuje różnice między punktami widzenia. To nie jest problem — to wartość.',
            position: 'bottom',
        },
        {
            id: 'ai_facilitator',
            targetSelector: '[data-tour="ai-facilitation"]',
            title: 'AI jako facylitator',
            content: 'AI teraz pomaga w dialogu zespołowym. Pokazuje gdzie są napięcia, syntetyzuje różnice, ale nigdy nie zajmuje strony.',
            position: 'left',
        },
    ],
};

export default TEAM_TOUR;
