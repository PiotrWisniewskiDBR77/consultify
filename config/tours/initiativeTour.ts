/**
 * Initiative Creation Tour
 * 
 * Guides users through creating and managing transformation initiatives.
 */

import { TourConfig } from './types';

export const INITIATIVE_TOUR: TourConfig = {
    id: 'initiative-creation',
    name: {
        en: 'Create Your First Initiative',
        pl: 'Stwórz Pierwszą Inicjatywę'
    },
    description: {
        en: 'Learn how to create, prioritize, and manage transformation initiatives.',
        pl: 'Naucz się jak tworzyć, priorytetyzować i zarządzać inicjatywami transformacyjnymi.'
    },
    targetAudience: ['user', 'admin'],
    estimatedDuration: 8,
    steps: [
        {
            id: 'overview',
            title: { en: 'Initiative Management', pl: 'Zarządzanie Inicjatywami' },
            content: {
                en: 'Initiatives are actionable projects that address gaps identified in assessments. Let\'s create one together.',
                pl: 'Inicjatywy to realizowalne projekty, które adresują luki zidentyfikowane w ocenach. Stwórzmy jedną razem.'
            },
            target: '.initiatives-header',
            placement: 'bottom'
        },
        {
            id: 'ai-generator',
            title: { en: 'AI Initiative Generator', pl: 'Generator Inicjatyw AI' },
            content: {
                en: 'AI can suggest initiatives based on your assessment gaps. Click here to generate recommendations.',
                pl: 'AI może sugerować inicjatywy na podstawie luk z oceny. Kliknij tutaj, aby wygenerować rekomendacje.'
            },
            target: '.ai-generator-button',
            placement: 'left'
        },
        {
            id: 'manual-create',
            title: { en: 'Manual Creation', pl: 'Ręczne Tworzenie' },
            content: {
                en: 'Or create initiatives manually using templates or from scratch.',
                pl: 'Lub twórz inicjatywy ręcznie używając szablonów lub od zera.'
            },
            target: '.create-initiative-button',
            placement: 'bottom'
        },
        {
            id: 'details',
            title: { en: 'Initiative Details', pl: 'Szczegóły Inicjatywy' },
            content: {
                en: 'Define objectives, expected outcomes, timeline, and resource requirements.',
                pl: 'Zdefiniuj cele, oczekiwane rezultaty, harmonogram i wymagania zasobowe.'
            },
            target: '.initiative-form',
            placement: 'right'
        },
        {
            id: 'prioritization',
            title: { en: 'Prioritization Matrix', pl: 'Macierz Priorytetyzacji' },
            content: {
                en: 'Use the impact vs. effort matrix to prioritize initiatives. Quick wins go first!',
                pl: 'Użyj macierzy wpływ vs. wysiłek do priorytetyzacji inicjatyw. Szybkie zwycięstwa najpierw!'
            },
            target: '.priority-matrix',
            placement: 'left'
        },
        {
            id: 'link-assessment',
            title: { en: 'Link to Assessments', pl: 'Połącz z Ocenami' },
            content: {
                en: 'Link initiatives to specific assessment gaps for traceability.',
                pl: 'Połącz inicjatywy z konkretnymi lukami z oceny dla śledzenia.'
            },
            target: '.assessment-link',
            placement: 'bottom'
        },
        {
            id: 'roadmap',
            title: { en: 'Add to Roadmap', pl: 'Dodaj do Mapy Drogowej' },
            content: {
                en: 'Once prioritized, add initiatives to your transformation roadmap.',
                pl: 'Po priorytetyzacji dodaj inicjatywy do swojej mapy drogowej transformacji.'
            },
            target: '.add-to-roadmap-button',
            placement: 'top'
        }
    ],
    prerequisites: ['assessment-flow'],
    completionActions: [
        {
            type: 'navigate',
            target: 'initiatives'
        }
    ]
};

export default INITIATIVE_TOUR;


