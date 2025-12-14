import rawData from '../drd_data.json';

export interface DRDLevel {
    level: number;
    title: string;
    description: string;
}

export interface DRDArea {
    id: string; // e.g. "1A"
    name: string;
    levels: DRDLevel[];
}

export interface DRDAxis {
    id: number;
    name: string;
    areas: DRDArea[];
}

// Ensure the type assertion works
const typedData = (rawData as unknown) as DRDAxis[];

// Fix Axis 7 (AI Readiness) - Populate from raw text dump (translated to Polish)
// Fix Axis 7 (AI Readiness) - Populate from raw text dump (translated to Polish)
let axis7 = typedData.find(a => a.id === 7);
if (!axis7) {
    axis7 = {
        id: 7,
        name: 'AI Maturity',
        areas: []
    };
    typedData.push(axis7);
}

// Ensure proper naming if it existed but was wrong
if (axis7) {
    axis7.name = 'AI Maturity';
    // Clear existing areas if any (to avoid duplicates or mixed languages) and repopulate
    axis7.areas = [
        {
            id: '7A',
            name: 'Dane i Fundamenty AI',
            levels: [
                { level: 1, title: 'Fragmented Data, No AI Readiness', description: 'Dane są rozproszone w arkuszach, na dyskach lokalnych i systemach niepołączonych. Brak jednego widoku informacji. Każda analiza wymaga ręcznego zbierania danych. Dane są niekompletne lub niespójne między systemami. AI nie może działać, bo dane nie są dostępne w odpowiednim formacie.' },
                { level: 2, title: 'Structured Data in Silos', description: 'Firma posiada kilka systemów cyfrowych (ERP, MES, CRM), ale każdy z nich przechowuje dane we własnym „silosie”. Dane są bardziej uporządkowane, lecz nie są łatwo dostępne dla AI. Eksporty realizowane są ręcznie. Dane są cyfrowe, lecz niepołączone.' },
                { level: 3, title: 'Centralized Data & Initial AI Readiness', description: 'Organizacja buduje pierwsze scentralizowane repozytoria danych. Procesy ETL zaczynają funkcjonować, a dane są pobierane do jednego miejsca. Pojawiają się pierwsze projekty machine learning, oparte na ustandaryzowanych zbiorach danych. Dane w hurtowni są aktualizowane regularnie.' },
                { level: 4, title: 'Fully AI-Ready Data Architecture', description: 'Organizacja posiada spójne zasady governance, jakość danych jest monitorowana, a źródła danych są udokumentowane. Dane są dostępne w czasie zbliżonym do rzeczywistego. Dane są zawsze dostępne, spójne i aktualne. Modele AI mają stabilne, powtarzalne pipeline’y.' },
                { level: 5, title: 'Autonomous Data Intelligence', description: 'Dane są automatycznie przygotowywane, czyszczone, wersjonowane i udostępniane modelom AI. Systemy potrafią wykrywać anomalie, uzupełniać braki i optymalizować przepływy danych bez udziału człowieka. Dane są traktowane jako produkt („data as a product”).' }
            ]
        },
        {
            id: '7B',
            name: 'Procesy Wspierane przez AI',
            levels: [
                { level: 1, title: 'Isolated AI Experiments', description: 'AI pojawia się w organizacji jedynie w formie małych, niepowiązanych inicjatyw. Mogą to być testy narzędzi generatywnych, chatboty, OCR lub podstawowe automatyzacje biurowe — ale nie mają one wpływu na główne procesy biznesowe. AI działa „obok” procesów, nie w ich środku.' },
                { level: 2, title: 'Assisted Work Automation', description: 'AI wspiera pracowników w wykonywaniu zadań, ale nie decyduje w procesach. Pojawiają się pierwsze automatyzacje: planowanie spotkań, generowanie treści, analiza dokumentów. Rola AI to przyspieszanie pracy człowieka, nie jej przejmowanie. AI poprawia efektywność, ale nie ma wpływu na jakość procesu.' },
                { level: 3, title: 'Integrated AI Decision Support', description: 'AI zaczyna być częścią procesu, a nie dodatkiem. Modele AI dostarczają rekomendacje operacyjne (prognozy, scoring). Pracownicy podejmują decyzje w oparciu o wskazania AI. Procesy są projektowane tak, by uwzględniały dane i algorytmy — ale odpowiedzialność pozostaje po stronie człowieka.' },
                { level: 4, title: 'Semi-Autonomous Processes', description: 'AI wykonuje część działań procesowych samodzielnie. Człowiek pełni rolę nadzorcy lub zatwierdzającego. Przykłady: automatyczne planowanie, dynamiczne sterowanie zapasami. W wielu procesach człowiek nie podejmuje już decyzji — jedynie kontroluje system.' },
                { level: 5, title: 'Fully Autonomous Operational Orchestration', description: 'Procesy są projektowane tak, aby były wykonywane przez autonomiczne systemy AI. AI nie tylko decyduje, ale monitoruje, reaguje i optymalizuje sposób działania organizacji. Człowiek zajmuje się nadzorem, audytami i strategią. Procesy wykonują się w całości bez udziału człowieka.' }
            ]
        },
        {
            id: '7C',
            name: 'AI w Produktach i Usługach',
            levels: [
                { level: 1, title: 'No AI Components in Products', description: 'Produkty i usługi nie zawierają żadnych elementów AI. Wartość dostarczana klientowi wynika w całości z tradycyjnych funkcji. Produkty działają tak samo dla każdego użytkownika. Nie ma funkcji predykcyjnych ani rekomendacyjnych.' },
                { level: 2, title: 'Add-On AI Features', description: 'AI pojawia się jako dodatkowy moduł wzbogacający produkt, ale nie definiujący jego istoty. Funkcje AI mają charakter ulepszeń (rekomendacje, proste podsumowania). AI jest dodatkiem, który usprawnia doświadczenie klienta, ale produkt nadal posiada klasyczną strukturę.' },
                { level: 3, title: 'AI as a Core Product Component', description: 'AI staje się kluczowym elementem architektury produktu. Bez niego większość nowoczesnych funkcji nie mogłaby działać. Produkt „rozumie” użytkownika, adaptuje się i reaguje na dane. Produkt znacząco różni się od konkurencji dzięki AI.' },
                { level: 4, title: 'Fully AI-Driven Products', description: 'AI odpowiada za większość logiki produktu i dynamicznie dostosowuje sposób działania. Produkt stale uczy się zachowań klienta, optymalizuje procesy i reaguje w czasie rzeczywistym. Funkcjonalność jest personalizowana, adaptacyjna i samodoskonaląca się.' },
                { level: 5, title: 'AI-Native Business Offerings', description: 'Firma oferuje produkty lub usługi, które nie mogłyby istnieć bez AI. AI tworzy cały model biznesowy. Powstają autonomiczne systemy zarządzania, agenty, cyfrowe bliźniaki. Produkt działa jak inteligentny system, nie aplikacja.' }
            ]
        },
        {
            id: '7D',
            name: 'Governance, Bezpieczeństwo i Etyka',
            levels: [
                { level: 1, title: 'No AI Governance, Uncontrolled Use', description: 'AI jest używane spontanicznie i bez nadzoru. Pracownicy korzystają z narzędzi AI według własnego uznania. Nie istnieją polityki użycia, zasady bezpieczeństwa ani standardy prywatności. Organizacja nie jest świadoma ryzyk.' },
                { level: 2, title: 'Basic AI Usage Policies', description: 'Organizacja zaczyna dostrzegać ryzyka i tworzy podstawowe zasady korzystania z AI (co wolno, czego nie wolno). Polityki te mają charakter informacyjny i nie są jeszcze w pełni egzekwowane. Decyzje pozostają po stronie działów lub pojedynczych osób.' },
                { level: 3, title: 'Organization-Wide AI Governance Framework', description: 'Firma formalizuje podejście do AI. Powstają procesy akceptacji projektów, kryteria oceny ryzyka, dedykowana rola (AI Officer/Committee). Modele są wersjonowane i audytowane. AI nie jest wdrażane bez formalnego zatwierdzenia.' },
                { level: 4, title: 'Continuous AI Risk Management & Monitoring', description: 'Organizacja ma ustrukturyzowany system kontroli nad AI, który działa cały czas. Obejmuje to monitoring modeli w czasie rzeczywistym, wykrywanie driftu, testy bezpieczeństwa. AI jest traktowane tak samo poważnie jak systemy krytyczne.' },
                { level: 5, title: 'Ethical, Transparent & Autonomous AI Governance', description: 'AI governance jest zautomatyzowane, wbudowane w systemy i zgodne z najlepszymi praktykami etycznymi. Systemy AI same wykrywają problemy i reagują. Firma posiada zaawansowane podejście do przejrzystości i potrafi to udowodnić audytorom.' }
            ]
        },
        {
            id: '7E',
            name: 'Kompetencje i Kultura AI',
            levels: [
                { level: 1, title: 'Brak Kompetencji', description: 'Pracownicy nie mają umiejętności AI, polegają na metodach manualnych. Dominuje sceptycyzm lub lęk.' },
                { level: 2, title: 'Ad-hoc Usage', description: 'Część osób używa prostych narzędzi na własną rękę. Brak szkoleń, wiedza plemienna.' },
                { level: 3, title: 'Zorganizowany Rozwój', description: 'Firma zapewnia szkolenia i narzędzia. Zdefiniowane role (np. AI Champion). Pierwsze sukcesy zespołowe.' },
                { level: 4, title: 'Płynność AI (AI Fluency)', description: 'Pracownicy sami budują proste automatyzacje i workflowy AI. Ciągłe podnoszenie kompetencji jest normą.' },
                { level: 5, title: 'Kadra AI-Native', description: 'Współpraca człowiek-AI jest bezszwowa. Pracownicy zarządzają agentami AI wykonującymi zadania operacyjne.' }
            ]
        }
    ];
}

// Ensure Axis 6 (Cybersecurity) is correctly named/present
const axis6 = typedData.find(a => a.id === 6);
if (axis6 && axis6.name !== 'Cybersecurity') {
    axis6.name = 'Cybersecurity';
}

export const DRD_STRUCTURE: DRDAxis[] = typedData;

export const getQuestionsForAxis = (axisId: number) => {
    return DRD_STRUCTURE.find(a => a.id === axisId)?.areas || [];
};
