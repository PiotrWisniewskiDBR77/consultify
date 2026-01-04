/**
 * AI Tools Tour
 *
 * Introduces users to AI-powered features and assistants.
 */

import { TourConfig } from './types';

export const AI_TOOLS_TOUR: TourConfig = {
    id: 'ai-tools',
    name: {
        en: 'Explore AI Tools',
        pl: 'Poznaj Narzędzia AI',
    },
    description: {
        en: 'Discover how AI can accelerate your transformation journey.',
        pl: 'Odkryj jak AI może przyspieszyć Twoją podróż transformacyjną.',
    },
    targetAudience: ['user', 'admin'],
    estimatedDuration: 5,
    steps: [
        {
            id: 'intro',
            title: { en: 'AI-Powered Assistance', pl: 'Wsparcie Napędzane AI' },
            content: {
                en: 'Consultify uses AI to provide intelligent recommendations, automate analysis, and accelerate your work.',
                pl: 'Consultify używa AI do dostarczania inteligentnych rekomendacji, automatyzacji analiz i przyspieszania Twojej pracy.',
            },
            placement: 'center',
        },
        {
            id: 'advisor',
            title: { en: 'AI Action Advisor', pl: 'Doradca Akcji AI' },
            content: {
                en: 'Get proactive suggestions for next best actions based on your current transformation state.',
                pl: 'Otrzymuj proaktywne sugestie następnych najlepszych akcji na podstawie aktualnego stanu transformacji.',
            },
            target: '.ai-advisor',
            placement: 'left',
        },
        {
            id: 'chat',
            title: { en: 'AI Assistant Chat', pl: 'Czat z Asystentem AI' },
            content: {
                en: 'Ask questions, analyze documents, and explore scenarios in natural language.',
                pl: 'Zadawaj pytania, analizuj dokumenty i eksploruj scenariusze w naturalnym języku.',
            },
            target: '.ai-chat-button',
            placement: 'left',
        },
        {
            id: 'assessment-ai',
            title: { en: 'Assessment AI', pl: 'AI Oceny' },
            content: {
                en: 'AI can analyze your documents and suggest assessment scores with explanations.',
                pl: 'AI może analizować Twoje dokumenty i sugerować wyniki oceny z wyjaśnieniami.',
            },
            target: '.assessment-ai-button',
            placement: 'bottom',
        },
        {
            id: 'initiative-gen',
            title: { en: 'Initiative Generator', pl: 'Generator Inicjatyw' },
            content: {
                en: 'AI generates tailored initiative recommendations based on your gaps and industry best practices.',
                pl: 'AI generuje dopasowane rekomendacje inicjatyw na podstawie Twoich luk i najlepszych praktyk branżowych.',
            },
            target: '.initiative-generator',
            placement: 'right',
        },
        {
            id: 'feedback',
            title: { en: 'Improve AI with Feedback', pl: 'Popraw AI przez Feedback' },
            content: {
                en: 'Rate AI suggestions to help improve future recommendations. Your feedback matters!',
                pl: 'Oceniaj sugestie AI, aby pomóc poprawić przyszłe rekomendacje. Twój feedback ma znaczenie!',
            },
            target: '.ai-feedback',
            placement: 'top',
        },
    ],
    completionActions: [
        {
            type: 'markComplete',
            payload: { badge: 'ai-explorer' },
        },
    ],
};

export default AI_TOOLS_TOUR;
