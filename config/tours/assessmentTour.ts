/**
 * Assessment Flow Tour
 *
 * Guides users through completing their first assessment.
 */

import { TourConfig } from './types';

export const ASSESSMENT_TOUR: TourConfig = {
    id: 'assessment-flow',
    name: {
        en: 'Complete Your First Assessment',
        pl: 'Ukończ Pierwszą Ocenę',
    },
    description: {
        en: 'Learn how to complete a digital readiness assessment step by step.',
        pl: 'Naucz się krok po kroku jak ukończyć ocenę gotowości cyfrowej.',
    },
    targetAudience: ['user', 'admin'],
    estimatedDuration: 10,
    steps: [
        {
            id: 'welcome',
            title: { en: 'Welcome to Assessment', pl: 'Witaj w Ocenie' },
            content: {
                en: "Assessments help you understand your organization's digital maturity. Let's walk through the process together.",
                pl: 'Oceny pomagają zrozumieć dojrzałość cyfrową Twojej organizacji. Przejdźmy przez proces razem.',
            },
            target: '.assessment-header',
            placement: 'bottom',
        },
        {
            id: 'select-framework',
            title: { en: 'Choose Framework', pl: 'Wybierz Ramę Oceny' },
            content: {
                en: 'Select the assessment framework that best matches your needs. DRD is recommended for most organizations.',
                pl: 'Wybierz ramę oceny, która najlepiej odpowiada Twoim potrzebom. DRD jest zalecana dla większości organizacji.',
            },
            target: '.framework-selector',
            placement: 'right',
        },
        {
            id: 'dimensions',
            title: { en: 'Assessment Dimensions', pl: 'Wymiary Oceny' },
            content: {
                en: 'Each framework has multiple dimensions. Work through them one by one for a complete picture.',
                pl: 'Każda rama ma wiele wymiarów. Przejdź przez nie po kolei, aby uzyskać pełny obraz.',
            },
            target: '.dimension-list',
            placement: 'right',
        },
        {
            id: 'scoring',
            title: { en: 'Scoring Questions', pl: 'Pytania Oceny' },
            content: {
                en: 'Rate your organization on each question from 1-5. Be honest - this helps create accurate recommendations.',
                pl: 'Oceń swoją organizację w każdym pytaniu od 1-5. Bądź szczery - to pomoże stworzyć dokładne rekomendacje.',
            },
            target: '.question-card',
            placement: 'bottom',
        },
        {
            id: 'evidence',
            title: { en: 'Upload Evidence', pl: 'Prześlij Dowody' },
            content: {
                en: 'Supporting evidence strengthens your assessment. Upload documents, screenshots, or links.',
                pl: 'Dowody wspierające wzmacniają Twoją ocenę. Prześlij dokumenty, zrzuty ekranu lub linki.',
            },
            target: '.evidence-upload',
            placement: 'left',
        },
        {
            id: 'ai-assist',
            title: { en: 'AI Assistance', pl: 'Wsparcie AI' },
            content: {
                en: 'AI can suggest scores based on uploaded documents. Click the AI button for intelligent suggestions.',
                pl: 'AI może sugerować wyniki na podstawie przesłanych dokumentów. Kliknij przycisk AI dla inteligentnych sugestii.',
            },
            target: '.ai-assist-button',
            placement: 'left',
        },
        {
            id: 'save-progress',
            title: { en: 'Save Your Progress', pl: 'Zapisz Postęp' },
            content: {
                en: 'Your work is auto-saved, but you can also save manually. Return anytime to continue.',
                pl: 'Twoja praca jest automatycznie zapisywana, ale możesz też zapisać ręcznie. Wróć w dowolnym momencie, aby kontynuować.',
            },
            target: '.save-button',
            placement: 'bottom',
        },
        {
            id: 'complete',
            title: { en: 'Complete Assessment', pl: 'Ukończ Ocenę' },
            content: {
                en: "Once all dimensions are scored, click Complete to finalize. You'll see your results and recommendations.",
                pl: 'Gdy wszystkie wymiary są ocenione, kliknij Ukończ, aby sfinalizować. Zobaczysz wyniki i rekomendacje.',
            },
            target: '.complete-button',
            placement: 'top',
        },
    ],
    completionActions: [
        {
            type: 'navigate',
            target: 'assessment',
        },
    ],
};

export default ASSESSMENT_TOUR;


