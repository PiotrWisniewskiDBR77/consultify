/**
 * Help Content Configuration
 * 
 * Context-aware help content per view/route.
 */

export interface HelpItem {
    title: string;
    content: string;
    type: 'article' | 'video' | 'faq';
    videoUrl?: string;
    articleUrl?: string;
    onClick?: () => void;
}

export interface ViewHelpConfig {
    viewId: string;
    pathPattern: string | RegExp;
    items: HelpItem[];
}

export const HELP_CONTENT: ViewHelpConfig[] = [
    {
        viewId: 'dashboard',
        pathPattern: '/dashboard',
        items: [
            {
                title: 'Jak korzystać z dashboardu?',
                content: 'Dashboard pokazuje przegląd Twojej organizacji i bieżących działań. Kliknij na karty, aby zobaczyć szczegóły.',
                type: 'article',
            },
            {
                title: 'Przegląd widoków PMO',
                content: 'Poznaj różne widoki dostępne w systemie i jak się między nimi poruszać.',
                type: 'video',
                videoUrl: '#',
            },
        ],
    },
    {
        viewId: 'assessment',
        pathPattern: /\/assessment|\/full-step1/,
        items: [
            {
                title: 'Jak ocenić dojrzałość?',
                content: 'Ocena dojrzałości polega na określeniu obecnego stanu (Actual) i docelowego (Target) dla każdego obszaru. Użyj pytań pomocniczych, aby lepiej zrozumieć każdy poziom.',
                type: 'article',
            },
            {
                title: 'Co oznaczają poziomy 1-5?',
                content: 'Poziom 1 to początkowy etap, często chaotyczny. Poziom 5 to pełna optymalizacja i ciągłe doskonalenie. Większość organizacji jest na poziomie 2-3.',
                type: 'faq',
            },
            {
                title: 'Jak wybrać odpowiedni poziom?',
                content: 'Przeczytaj opis każdego poziomu i odpowiedz na pytania pomocnicze. Twoja odpowiedź powinna odzwierciedlać faktyczny stan, nie aspiracje.',
                type: 'article',
            },
        ],
    },
    {
        viewId: 'initiatives',
        pathPattern: /\/initiatives|\/full-step2/,
        items: [
            {
                title: 'Czym jest inicjatywa?',
                content: 'Inicjatywa to konkretne działanie transformacyjne z określonym celem, zakresem i harmonogramem.',
                type: 'article',
            },
            {
                title: 'Jak priorytetyzować inicjatywy?',
                content: 'Użyj matrycy Impact/Effort. Zacznij od inicjatyw o wysokim wpływie i niskim wysiłku (quick wins).',
                type: 'article',
            },
        ],
    },
    {
        viewId: 'roadmap',
        pathPattern: /\/roadmap|\/full-step3/,
        items: [
            {
                title: 'Jak czytać roadmapę?',
                content: 'Roadmapa pokazuje oś czasu z fazami projektu. Kolory oznaczają status: zielony (on track), żółty (at risk), czerwony (delayed).',
                type: 'article',
            },
            {
                title: 'Jak edytować harmonogram?',
                content: 'Kliknij na element, aby przesunąć go w czasie lub zmienić szczegóły. Zależności są automatycznie aktualizowane.',
                type: 'video',
                videoUrl: '#',
            },
        ],
    },
    {
        viewId: 'team',
        pathPattern: /\/team|\/users/,
        items: [
            {
                title: 'Jak zaprosić członka zespołu?',
                content: 'Kliknij "Zaproś", wpisz email i wybierz rolę. Osoba otrzyma zaproszenie i będzie mogła dołączyć do organizacji.',
                type: 'article',
            },
            {
                title: 'Role w systemie',
                content: 'Admin może zarządzać wszystkim. Member może edytować treści. Viewer może tylko przeglądać.',
                type: 'faq',
            },
        ],
    },
    {
        viewId: 'drd_workspace',
        pathPattern: /\/drd|\/axis/,
        items: [
            {
                title: 'Czym jest oś decyzyjna?',
                content: 'Oś decyzyjna (DRD Axis) to przestrzeń do ustrukturyzowania jednego tematu strategicznego. Zbierasz tu różne perspektywy i dążysz do konsensusu.',
                type: 'article',
            },
            {
                title: 'Jak dodać perspektywę?',
                content: 'Kliknij "Dodaj pozycję" i opisz swój punkt widzenia. Możesz też zaprosić innych do dodania ich perspektyw.',
                type: 'article',
            },
            {
                title: 'Co to jest snapshot?',
                content: 'Snapshot to "zdjęcie" obecnego stanu dyskusji. Zapisuje wszystkie pozycje i komentarze w danym momencie. Możesz do niego wrócić później.',
                type: 'faq',
            },
        ],
    },
    {
        viewId: 'default',
        pathPattern: /.*/,
        items: [
            {
                title: 'Pierwsze kroki',
                content: 'Zacznij od dashboardu, aby zobaczyć przegląd. Następnie przejdź do sekcji, która Cię interesuje.',
                type: 'article',
            },
            {
                title: 'Potrzebujesz pomocy?',
                content: 'Skontaktuj się z nami przez czat lub email support@consultify.app',
                type: 'faq',
            },
        ],
    },
];

/**
 * Get help content for a specific view/path
 */
export const getHelpForView = (path: string): HelpItem[] => {
    // Find matching config
    for (const config of HELP_CONTENT) {
        if (config.pathPattern instanceof RegExp) {
            if (config.pathPattern.test(path)) {
                return config.items;
            }
        } else if (path.includes(config.pathPattern)) {
            return config.items;
        }
    }

    // Fallback to default
    const defaultConfig = HELP_CONTENT.find(c => c.viewId === 'default');
    return defaultConfig?.items || [];
};

export default HELP_CONTENT;
