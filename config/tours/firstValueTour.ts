import { Tour } from '../../components/Onboarding/TourProvider';

/**
 * First Value Tour — Phase E
 * 
 * Triggered when user enters Phase E (Guided First Value).
 * Guides through creating first DRD axis and snapshot.
 */
export const FIRST_VALUE_TOUR: Tour = {
    id: 'first_value',
    name: 'Pierwsza wartość',
    triggerCondition: 'feature_unlock',
    steps: [
        {
            id: 'welcome',
            targetSelector: '[data-tour="workspace-header"]',
            title: 'Twoja przestrzeń decyzyjna',
            content: 'Witaj w swojej organizacji! System teraz pamięta Twoje działania. Zacznijmy od pierwszego tematu strategicznego.',
            position: 'bottom',
        },
        {
            id: 'create_axis',
            targetSelector: '[data-tour="create-axis-button"]',
            title: 'Utwórz pierwszą oś',
            content: 'Oś DRD to przestrzeń dyskusji nad jednym zagadnieniem. Kliknij tutaj, aby nazwać swój pierwszy temat.',
            position: 'bottom',
        },
        {
            id: 'axis_examples',
            targetSelector: '[data-tour="axis-templates"]',
            title: 'Przykłady na start',
            content: 'Możesz wybrać jeden z szablonów lub stworzyć własną oś. Przykłady: "Strategia technologiczna", "Model operacyjny".',
            position: 'right',
        },
        {
            id: 'add_position',
            targetSelector: '[data-tour="add-position"]',
            title: 'Dodaj perspektywę',
            content: 'Pozycja to jeden punkt widzenia na temat. Opisz, jak TY widzisz sytuację. Później dodasz perspektywy innych osób.',
            position: 'left',
        },
        {
            id: 'ai_partner',
            targetSelector: '[data-tour="ai-chat"]',
            title: 'AI jako partner myślenia',
            content: 'AI teraz pracuje inaczej — zadaje pytania, które pomagają ustrukturyzować myślenie. Nie daje gotowych odpowiedzi.',
            position: 'left',
        },
        {
            id: 'snapshot',
            targetSelector: '[data-tour="create-snapshot"]',
            title: 'Zapisz snapshot',
            content: 'Snapshot to "zdjęcie" obecnego stanu myślenia. Nie jest ostateczny — możesz wrócić i zaktualizować. To punkt wyjścia do dyskusji.',
            position: 'top',
        },
    ],
};

export default FIRST_VALUE_TOUR;
