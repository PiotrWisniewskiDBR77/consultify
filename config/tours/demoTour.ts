import { Tour } from '../../components/Onboarding/TourProvider';

/**
 * Demo Tour — Phase B
 * 
 * Triggered on first visit to demo mode.
 * Explains the demo environment and key features.
 */
export const DEMO_TOUR: Tour = {
    id: 'demo_main',
    name: 'Demo Tour',
    triggerCondition: 'first_visit',
    steps: [
        {
            id: 'welcome',
            targetSelector: '[data-tour="demo-banner"]',
            title: 'Witaj w trybie Demo',
            content: 'Eksplorujesz system na podstawie przykładowej firmy Legolex. Wszystko jest tylko do odczytu — możesz swobodnie przeglądać.',
            position: 'bottom',
        },
        {
            id: 'navigation',
            targetSelector: '[data-tour="sidebar-nav"]',
            title: 'Nawigacja',
            content: 'Menu po lewej pozwala przemieszczać się między sekcjami. Każda sekcja pokazuje inny aspekt systemu.',
            position: 'right',
        },
        {
            id: 'drd_workspace',
            targetSelector: '[data-tour="drd-workspace"]',
            title: 'Przestrzeń DRD',
            content: 'Tu toczy się główna praca nad decyzjami strategicznymi. DRD to metodologia strukturyzowania złożonych decyzji.',
            position: 'bottom',
        },
        {
            id: 'axes',
            targetSelector: '[data-tour="axes-list"]',
            title: 'Osie decyzyjne',
            content: 'Każda oś to jeden temat strategiczny. Przykład: "Inwestycje technologiczne" lub "Ekspansja rynkowa". Kliknij oś, aby zobaczyć szczegóły.',
            position: 'right',
        },
        {
            id: 'ai_panel',
            targetSelector: '[data-tour="ai-panel"]',
            title: 'Panel AI',
            content: 'W trybie demo AI tylko wyjaśnia metodologię. Nie zadaje pytań — to rola NARRATORA. W pełnej wersji AI staje się partnerem myślenia.',
            position: 'left',
        },
        {
            id: 'exit',
            targetSelector: '[data-tour="demo-exit"]',
            title: 'Gotowy na więcej?',
            content: 'Po zakończeniu eksploracji możesz przejść do triala. To wymaga kodu dostępu — nie ma otwartej rejestracji.',
            position: 'bottom',
        },
    ],
};

export default DEMO_TOUR;
