/**
 * Area Content Templates for Enterprise DRD Reports
 * 
 * This file contains detailed content for all 63 combinations of:
 * - 7 DRD Axes × 9 Business Areas
 * 
 * Each combination includes:
 * - Level descriptions (1-7)
 * - Diagnostic questions
 * - Best practices
 * - KPIs
 * - Risks
 * - Recommendations
 */

// ============================================================================
// CONSTANTS: 9 Business Areas
// ============================================================================
const BUSINESS_AREAS = {
    sales: {
        id: 'sales',
        name: 'Sales',
        namePl: 'Sprzedaż',
        icon: '💰',
        description: 'Sales operations, CRM, customer acquisition and retention',
        descriptionPl: 'Operacje sprzedażowe, CRM, pozyskiwanie i utrzymanie klientów'
    },
    marketing: {
        id: 'marketing',
        name: 'Marketing',
        namePl: 'Marketing',
        icon: '📣',
        description: 'Marketing operations, campaigns, digital presence, brand management',
        descriptionPl: 'Operacje marketingowe, kampanie, obecność cyfrowa, zarządzanie marką'
    },
    technology: {
        id: 'technology',
        name: 'Technology (R&D)',
        namePl: 'Technologia (R&D)',
        icon: '🔬',
        description: 'Research & Development, product innovation, technology management',
        descriptionPl: 'Badania i rozwój, innowacje produktowe, zarządzanie technologią'
    },
    purchasing: {
        id: 'purchasing',
        name: 'Purchasing',
        namePl: 'Zakupy',
        icon: '🛒',
        description: 'Procurement, supplier management, strategic sourcing',
        descriptionPl: 'Zakupy, zarządzanie dostawcami, strategiczny sourcing'
    },
    logistics: {
        id: 'logistics',
        name: 'Logistics',
        namePl: 'Logistyka',
        icon: '🚚',
        description: 'Warehousing, distribution, supply chain management',
        descriptionPl: 'Magazynowanie, dystrybucja, zarządzanie łańcuchem dostaw'
    },
    production: {
        id: 'production',
        name: 'Production',
        namePl: 'Produkcja',
        icon: '🏭',
        description: 'Manufacturing operations, process control, capacity management',
        descriptionPl: 'Operacje produkcyjne, kontrola procesów, zarządzanie zdolnościami'
    },
    quality: {
        id: 'quality',
        name: 'Quality Control',
        namePl: 'Kontrola Jakości',
        icon: '✅',
        description: 'Quality assurance, testing, compliance, continuous improvement',
        descriptionPl: 'Zapewnienie jakości, testowanie, zgodność, ciągłe doskonalenie'
    },
    finance: {
        id: 'finance',
        name: 'Finance',
        namePl: 'Finanse',
        icon: '💵',
        description: 'Financial operations, controlling, budgeting, reporting',
        descriptionPl: 'Operacje finansowe, controlling, budżetowanie, raportowanie'
    },
    hr: {
        id: 'hr',
        name: 'HR & Admin',
        namePl: 'HR i Administracja',
        icon: '👥',
        description: 'Human resources, talent management, administration',
        descriptionPl: 'Zasoby ludzkie, zarządzanie talentami, administracja'
    }
};

// ============================================================================
// MATURITY LEVELS (1-7) - Generic descriptions
// ============================================================================
const MATURITY_LEVELS = {
    1: {
        name: 'Basic/Manual',
        namePl: 'Podstawowy/Ręczny',
        description: 'Manual processes, paper-based, minimal digitalization',
        descriptionPl: 'Procesy ręczne, oparte na dokumentach papierowych, minimalna cyfryzacja',
        color: '#ef4444'
    },
    2: {
        name: 'Digitized',
        namePl: 'Zdigitalizowany',
        description: 'Basic digital tools, local systems, spreadsheets',
        descriptionPl: 'Podstawowe narzędzia cyfrowe, lokalne systemy, arkusze kalkulacyjne',
        color: '#f97316'
    },
    3: {
        name: 'Integrated',
        namePl: 'Zintegrowany',
        description: 'Integrated systems, standardized processes, central data',
        descriptionPl: 'Zintegrowane systemy, standaryzowane procesy, centralne dane',
        color: '#eab308'
    },
    4: {
        name: 'Automated',
        namePl: 'Zautomatyzowany',
        description: 'Process automation, real-time data, workflows',
        descriptionPl: 'Automatyzacja procesów, dane w czasie rzeczywistym, workflow',
        color: '#22c55e'
    },
    5: {
        name: 'Optimized',
        namePl: 'Zoptymalizowany',
        description: 'Advanced optimization, predictive capabilities, full integration',
        descriptionPl: 'Zaawansowana optymalizacja, zdolności predykcyjne, pełna integracja',
        color: '#3b82f6'
    },
    6: {
        name: 'AI-Driven',
        namePl: 'AI-Driven',
        description: 'AI/ML integration, predictive analytics, intelligent automation',
        descriptionPl: 'Integracja AI/ML, analityka predykcyjna, inteligentna automatyzacja',
        color: '#8b5cf6'
    },
    7: {
        name: 'Autonomous',
        namePl: 'Autonomiczny',
        description: 'Self-optimizing systems, autonomous operations, cognitive computing',
        descriptionPl: 'Samooptymalizujące się systemy, operacje autonomiczne, przetwarzanie kognitywne',
        color: '#ec4899'
    }
};

// ============================================================================
// AXIS-AREA CONTENT MATRIX
// Detailed content for each axis×area combination
// ============================================================================
const AXIS_AREA_CONTENT = {
    // ========================================================================
    // AXIS: PROCESSES (Procesy Cyfrowe)
    // ========================================================================
    processes: {
        sales: {
            levelDescriptions: {
                1: {
                    namePl: 'Rejestracja podstawowa',
                    name: 'Basic Data Registration',
                    descriptionPl: 'Sprzedaż opiera się na arkuszach kalkulacyjnych i notatkach papierowych. Brak spójnego systemu śledzenia leadów. Dane klientów rozproszone w mailach i dokumentach. Ograniczona widoczność pipeline sprzedażowego.',
                    description: 'Sales relies on spreadsheets and paper notes. No consistent lead tracking system. Customer data scattered across emails and documents. Limited sales pipeline visibility.',
                    characteristics: [
                        'Dane klientów w Excelu lub na papierze',
                        'Brak formalnego procesu sprzedażowego',
                        'Ręczne tworzenie ofert',
                        'Brak prognozowania sprzedaży'
                    ],
                    tools: ['Excel', 'Email', 'Dokumenty Word'],
                    risks: ['Utrata danych klientów', 'Brak powtarzalności', 'Zależność od wiedzy jednostek']
                },
                2: {
                    namePl: 'Wdrożenie CRM',
                    name: 'CRM Implementation',
                    descriptionPl: 'Wdrożono podstawowy system CRM. Handlowcy rejestrują interakcje z klientami. Proces sprzedażowy jest zdefiniowany, ale nie w pełni egzekwowany. Podstawowe raportowanie sprzedaży.',
                    description: 'Basic CRM system implemented. Sales reps log customer interactions. Sales process is defined but not fully enforced. Basic sales reporting.',
                    characteristics: [
                        'CRM wdrożony (np. Pipedrive, HubSpot)',
                        'Podstawowe etapy pipeline',
                        'Ręczne wprowadzanie danych',
                        'Podstawowe raporty sprzedażowe'
                    ],
                    tools: ['Pipedrive', 'HubSpot', 'Zoho CRM'],
                    risks: ['Niekompletne dane w CRM', 'Opór zespołu', 'Brak integracji z innymi systemami']
                },
                3: {
                    namePl: 'Integracja z ERP/Marketing',
                    name: 'Integration with ERP/Marketing',
                    descriptionPl: 'CRM zintegrowany z systemem ERP i narzędziami marketingowymi. Automatyczny przepływ leadów z marketingu do sprzedaży. Widoczność historii zamówień klienta. Ustandaryzowane procesy ofertowania.',
                    description: 'CRM integrated with ERP and marketing tools. Automated lead flow from marketing to sales. Visibility of customer order history. Standardized quoting processes.',
                    characteristics: [
                        'Integracja CRM-ERP',
                        'Automatyczny lead scoring',
                        'Widoczność 360° klienta',
                        'Szablony ofert i umów'
                    ],
                    tools: ['Salesforce', 'SAP CRM', 'Microsoft Dynamics'],
                    risks: ['Złożoność integracji', 'Koszty utrzymania', 'Problemy z jakością danych']
                },
                4: {
                    namePl: 'Automatyzacja sprzedaży',
                    name: 'Sales Automation',
                    descriptionPl: 'Procesy sprzedażowe są zautomatyzowane. Automatyczne powiadomienia i follow-upy. Dynamiczne generowanie ofert. Dashboardy sprzedażowe w czasie rzeczywistym. Automatyzacja raportowania.',
                    description: 'Sales processes are automated. Automatic notifications and follow-ups. Dynamic quote generation. Real-time sales dashboards. Automated reporting.',
                    characteristics: [
                        'Automatyczne sekwencje emaili',
                        'Dynamiczne wyceny',
                        'Real-time dashboardy',
                        'Automatyczne przypisywanie leadów'
                    ],
                    tools: ['Salesforce + Pardot', 'HubSpot Enterprise', 'Pipedrive + Automations'],
                    risks: ['Nadmierna automatyzacja', 'Utrata ludzkiego dotyku', 'Złożoność workflow']
                },
                5: {
                    namePl: 'Integracja omnichannel',
                    name: 'Omnichannel Integration',
                    descriptionPl: 'Pełna integracja wszystkich kanałów sprzedaży. Klient ma spójne doświadczenie niezależnie od kanału. Zaawansowana analityka customer journey. Predykcyjne prognozowanie sprzedaży.',
                    description: 'Full integration of all sales channels. Customer has consistent experience regardless of channel. Advanced customer journey analytics. Predictive sales forecasting.',
                    characteristics: [
                        'Spójne doświadczenie we wszystkich kanałach',
                        'Customer journey mapping',
                        'Predykcyjne prognozowanie',
                        'A/B testing procesów'
                    ],
                    tools: ['Salesforce CDP', 'Adobe Experience Cloud', 'SAP Customer Experience'],
                    risks: ['Wysokie koszty wdrożenia', 'Wymaga zmiany kultury', 'Złożoność danych']
                },
                6: {
                    namePl: 'Prognozowanie AI',
                    name: 'AI-Driven Sales Forecasting',
                    descriptionPl: 'AI napędza prognozowanie sprzedaży i rekomendacje. Inteligentne scorowanie leadów. AI-driven next best action. Automatyczna personalizacja ofert. Chatboty AI wspierające sprzedaż.',
                    description: 'AI powers sales forecasting and recommendations. Intelligent lead scoring. AI-driven next best action. Automatic offer personalization. AI chatbots supporting sales.',
                    characteristics: [
                        'AI lead scoring',
                        'Predykcja churn',
                        'Next best action',
                        'Dynamiczna optymalizacja cen'
                    ],
                    tools: ['Salesforce Einstein', 'Gong.io', 'Chorus.ai', 'Clari'],
                    risks: ['Zaufanie do AI', 'Wymagane duże zbiory danych', 'Etyka AI w sprzedaży']
                },
                7: {
                    namePl: 'Autonomiczni agenci AI',
                    name: 'Autonomous Sales Agents',
                    descriptionPl: 'Autonomiczne systemy AI prowadzą znaczną część procesu sprzedażowego. Samooptymalizujące się strategie sprzedażowe. AI negocjuje warunki w ramach określonych parametrów. Ludzie zarządzają wyjątkami i relacjami strategicznymi.',
                    description: 'Autonomous AI systems conduct significant portion of sales process. Self-optimizing sales strategies. AI negotiates terms within defined parameters. Humans manage exceptions and strategic relationships.',
                    characteristics: [
                        'Autonomiczne AI w sprzedaży',
                        'Samooptymalizacja strategii',
                        'AI-prowadzone negocjacje',
                        'Human-in-the-loop dla strategicznych klientów'
                    ],
                    tools: ['Custom AI agents', 'GPT-4 integrated CRM', 'Autonomous selling platforms'],
                    risks: ['Regulacje prawne', 'Akceptacja klientów', 'Utrata kontroli']
                }
            },
            kpis: [
                { name: 'Czas od leadu do zamknięcia', unit: 'dni', benchmark: { low: 90, medium: 45, high: 21 }},
                { name: 'Konwersja leadów', unit: '%', benchmark: { low: 5, medium: 15, high: 30 }},
                { name: 'Adopcja CRM', unit: '%', benchmark: { low: 40, medium: 75, high: 95 }},
                { name: 'Dokładność prognoz', unit: '%', benchmark: { low: 50, medium: 75, high: 90 }}
            ],
            diagnosticQuestions: [
                'Jaki system CRM jest używany i jak długo?',
                'Jak handlowcy śledzą interakcje z klientami?',
                'Jak wygląda proces od leadu do zamknięcia?',
                'Jak często generowane są prognozy sprzedaży?',
                'Jakie dane są dostępne o pipeline sprzedażowym?'
            ],
            bestPractices: [
                'Regularne przeglądy pipeline z całym zespołem',
                'Automatyzacja powtarzalnych zadań',
                'Integracja CRM ze wszystkimi źródłami leadów',
                'Szkolenia z efektywnego wykorzystania CRM',
                'Dashboardy KPI dostępne dla wszystkich'
            ]
        },
        
        marketing: {
            levelDescriptions: {
                1: {
                    namePl: 'Promocja podstawowa',
                    name: 'Basic Promotion',
                    descriptionPl: 'Marketing ogranicza się do podstawowych materiałów drukowanych i sporadycznych działań. Brak strategii digital. Ręczne tworzenie materiałów. Brak mierzenia efektów.',
                    description: 'Marketing limited to basic print materials and occasional activities. No digital strategy. Manual creation of materials. No measurement of results.',
                    characteristics: [
                        'Ulotki i katalogi papierowe',
                        'Sporadyczne targi i eventy',
                        'Brak strategii content',
                        'Brak analityki marketingowej'
                    ],
                    tools: ['Word', 'PowerPoint', 'Drukowane materiały'],
                    risks: ['Brak widoczności ROI', 'Nieefektywne wydatki', 'Brak dotarcia do nowych klientów']
                },
                2: {
                    namePl: 'Obecność cyfrowa',
                    name: 'Digital Presence',
                    descriptionPl: 'Podstawowa strona www. Obecność w social media. Email marketing w podstawowej formie. Zaczynające się zbieranie danych o leadach.',
                    description: 'Basic website. Social media presence. Basic email marketing. Beginning to collect lead data.',
                    characteristics: [
                        'Strona www (często statyczna)',
                        'Profile w social media',
                        'Newslettery email',
                        'Podstawowe formularze kontaktowe'
                    ],
                    tools: ['WordPress', 'Mailchimp', 'Facebook/LinkedIn'],
                    risks: ['Niespójna komunikacja', 'Brak personalizacji', 'Ręczne procesy']
                },
                3: {
                    namePl: 'Narzędzia automatyzacji',
                    name: 'Marketing Automation Tools',
                    descriptionPl: 'Wdrożone narzędzia marketing automation. Segmentacja bazy kontaktów. Automatyczne kampanie drip. Landing pages i lead magnety.',
                    description: 'Marketing automation tools implemented. Contact database segmentation. Automatic drip campaigns. Landing pages and lead magnets.',
                    characteristics: [
                        'Platform marketing automation',
                        'Segmentacja kontaktów',
                        'Lead nurturing workflows',
                        'A/B testing emaili'
                    ],
                    tools: ['HubSpot', 'Marketo', 'ActiveCampaign', 'Pardot'],
                    risks: ['Spam perception', 'Złożoność narzędzi', 'Potrzeba contentu']
                },
                4: {
                    namePl: 'Personalizacja i segmentacja',
                    name: 'Personalization & Segmentation',
                    descriptionPl: 'Zaawansowana personalizacja treści. Dynamiczna segmentacja behawioralna. Scoring leadów. Pełna integracja z CRM sprzedaży.',
                    description: 'Advanced content personalization. Dynamic behavioral segmentation. Lead scoring. Full integration with sales CRM.',
                    characteristics: [
                        'Dynamiczny content na stronie',
                        'Behavioral triggers',
                        'Scoring i grading leadów',
                        'Attribution modeling'
                    ],
                    tools: ['Salesforce Marketing Cloud', 'Adobe Campaign', 'Eloqua'],
                    risks: ['Privacy concerns (GDPR)', 'Wymagane duże dane', 'Complexity creep']
                },
                5: {
                    namePl: 'Kampanie data-driven',
                    name: 'Data-Driven Campaigns',
                    descriptionPl: 'Kampanie oparte na głębokiej analityce danych. Predykcyjne modelowanie. Zaawansowane testowanie multivariate. Pełna atrybucja wielokanałowa.',
                    description: 'Campaigns based on deep data analytics. Predictive modeling. Advanced multivariate testing. Full multi-channel attribution.',
                    characteristics: [
                        'Customer data platform (CDP)',
                        'Predykcyjne modelowanie',
                        'Real-time personalization',
                        'Full-funnel attribution'
                    ],
                    tools: ['Segment', 'mParticle', 'Treasure Data', 'Optimizely'],
                    risks: ['Data silos', 'Analiza vs akcja', 'Talent shortage']
                },
                6: {
                    namePl: 'Marketing predykcyjny AI',
                    name: 'Predictive Marketing (AI)',
                    descriptionPl: 'AI napędza decyzje marketingowe. Predykcja zachowań klientów. Automatyczna optymalizacja kampanii. AI-generowany content.',
                    description: 'AI drives marketing decisions. Customer behavior prediction. Automatic campaign optimization. AI-generated content.',
                    characteristics: [
                        'AI content generation',
                        'Predictive audiences',
                        'Automated bid management',
                        'Sentiment analysis'
                    ],
                    tools: ['Albert.ai', 'Persado', 'Phrasee', 'Copy.ai'],
                    risks: ['Brand voice consistency', 'AI hallucinations', 'Over-reliance on AI']
                },
                7: {
                    namePl: 'Hiperpersonalizacja real-time',
                    name: 'Real-time Hyper-personalization',
                    descriptionPl: 'Autonomiczne systemy marketingowe działające w czasie rzeczywistym. Każda interakcja jest spersonalizowana. Samooptymalizujące się kampanie. Marketing 1:1 na skalę.',
                    description: 'Autonomous marketing systems operating in real-time. Every interaction is personalized. Self-optimizing campaigns. 1:1 marketing at scale.',
                    characteristics: [
                        'Real-time decisioning',
                        '1:1 personalization at scale',
                        'Autonomous campaign management',
                        'Cross-channel orchestration'
                    ],
                    tools: ['Adobe Real-Time CDP', 'Salesforce Interaction Studio', 'Custom ML platforms'],
                    risks: ['Creepy factor', 'Privacy backlash', 'Technical complexity']
                }
            },
            kpis: [
                { name: 'Cost per Lead (CPL)', unit: 'PLN', benchmark: { low: 500, medium: 150, high: 50 }},
                { name: 'Marketing Qualified Leads (MQLs)', unit: '/miesiąc', benchmark: { low: 10, medium: 50, high: 200 }},
                { name: 'Konwersja MQL → SQL', unit: '%', benchmark: { low: 10, medium: 25, high: 45 }},
                { name: 'Marketing ROI', unit: '%', benchmark: { low: 100, medium: 300, high: 700 }}
            ],
            diagnosticQuestions: [
                'Jakie kanały marketingowe są wykorzystywane?',
                'Jak mierzony jest ROI z marketingu?',
                'Jak wygląda proces przekazywania leadów do sprzedaży?',
                'Jakie narzędzia marketing automation są używane?',
                'Jak personalizowane są komunikaty marketingowe?'
            ],
            bestPractices: [
                'Regularne spotkania marketing-sales',
                'Definicja MQL i SQL uzgodniona z sprzedażą',
                'Content calendar z co najmniej 3-miesięcznym wyprzedzeniem',
                'A/B testing jako standard',
                'Attribution modeling dla wszystkich kampanii'
            ]
        },
        
        technology: {
            levelDescriptions: {
                1: {
                    namePl: 'Projektowanie ręczne',
                    name: 'Manual Design',
                    descriptionPl: 'Projektowanie produktów oparte na rysunkach technicznych 2D. Brak cyfrowych narzędzi projektowych. Prototypy fizyczne tworzone ręcznie. Dokumentacja papierowa.',
                    description: 'Product design based on 2D technical drawings. No digital design tools. Physical prototypes created manually. Paper documentation.',
                    characteristics: [
                        'Rysunki techniczne 2D',
                        'Ręczne prototypowanie',
                        'Papierowa dokumentacja',
                        'Brak wersjonowania projektów'
                    ],
                    tools: ['AutoCAD 2D', 'Rysunki ręczne', 'Fizyczne modele'],
                    risks: ['Długi czas rozwoju', 'Błędy w projektach', 'Brak standaryzacji']
                },
                2: {
                    namePl: 'Narzędzia CAD/CAM',
                    name: 'CAD/CAM Tools',
                    descriptionPl: 'Wdrożone podstawowe narzędzia CAD 3D. Projektowanie parametryczne. Podstawowa dokumentacja cyfrowa. Pojedyncze stacje CAM.',
                    description: 'Basic 3D CAD tools implemented. Parametric design. Basic digital documentation. Single CAM stations.',
                    characteristics: [
                        'Modele 3D parametryczne',
                        'Biblioteki komponentów',
                        'Podstawowe rendery',
                        'Połączenie z CNC'
                    ],
                    tools: ['SolidWorks', 'Inventor', 'CATIA', 'Fusion 360'],
                    risks: ['Silosy danych', 'Brak integracji z produkcją', 'Długi czas zmian']
                },
                3: {
                    namePl: 'Narzędzia symulacyjne',
                    name: 'Simulation Tools',
                    descriptionPl: 'Symulacje wytrzymałościowe i przepływowe. Analiza kinematyczna. Optymalizacja topologiczna. Wirtualne testowanie produktów.',
                    description: 'Structural and flow simulations. Kinematic analysis. Topological optimization. Virtual product testing.',
                    characteristics: [
                        'FEA/CFD symulacje',
                        'Wirtualne testy produktów',
                        'Optymalizacja topologiczna',
                        'Analiza tolerancji'
                    ],
                    tools: ['ANSYS', 'COMSOL', 'SimScale', 'Moldflow'],
                    risks: ['Wymagane kompetencje', 'Czas obliczeń', 'Walidacja wyników']
                },
                4: {
                    namePl: 'Szybkie prototypowanie 3D',
                    name: 'Rapid Prototyping (3D Print)',
                    descriptionPl: 'Wewnętrzne drukowanie 3D prototypów. Iteracyjny rozwój produktu. Szybka walidacja koncepcji. Integracja z procesem projektowym.',
                    description: 'In-house 3D printing of prototypes. Iterative product development. Rapid concept validation. Integration with design process.',
                    characteristics: [
                        'Druk 3D in-house',
                        'Iteracyjne prototypowanie',
                        'Multi-material prototypy',
                        'Rapid tooling'
                    ],
                    tools: ['Stratasys', 'HP Multi Jet Fusion', 'Formlabs', 'Markforged'],
                    risks: ['Koszty materiałów', 'Ograniczenia technologii', 'Jakość vs produkcja']
                },
                5: {
                    namePl: 'Cyfrowy bliźniak',
                    name: 'Digital Twin',
                    descriptionPl: 'Cyfrowe bliźniaki produktów. Symulacja całego cyklu życia. Integracja danych z rzeczywistych produktów. Predykcyjne modelowanie zachowań.',
                    description: 'Digital twins of products. Full lifecycle simulation. Integration of data from real products. Predictive behavior modeling.',
                    characteristics: [
                        'Digital twin produktu',
                        'Dane z IoT sensors',
                        'Symulacja lifecycle',
                        'Predykcyjna konserwacja'
                    ],
                    tools: ['Siemens Teamcenter', 'PTC ThingWorx', 'Azure Digital Twins', 'GE Predix'],
                    risks: ['Złożoność integracji', 'Koszty IoT', 'Bezpieczeństwo danych']
                },
                6: {
                    namePl: 'Projektowanie AI',
                    name: 'AI-Driven Design',
                    descriptionPl: 'AI wspomaga projektowanie generatywne. Automatyczna optymalizacja designu. AI-driven analiza wymagań. Inteligentna konfiguracja produktów.',
                    description: 'AI assists generative design. Automatic design optimization. AI-driven requirements analysis. Intelligent product configuration.',
                    characteristics: [
                        'Generative design',
                        'AI-optymalizacja parametrów',
                        'Automatyczna konfiguracja',
                        'Intelligent BOM'
                    ],
                    tools: ['Autodesk Generative Design', 'nTopology', 'Frustum', 'ParaMatters'],
                    risks: ['Akceptacja wyników AI', 'Manufacturability', 'IP concerns']
                },
                7: {
                    namePl: 'Autonomiczne R&D',
                    name: 'Autonomous R&D',
                    descriptionPl: 'Autonomiczne systemy prowadzące badania i rozwój. AI odkrywa nowe rozwiązania. Samooptymalizujące się produkty. Humans zarządzają strategią i etykę.',
                    description: 'Autonomous systems conducting R&D. AI discovers new solutions. Self-optimizing products. Humans manage strategy and ethics.',
                    characteristics: [
                        'Autonomous experimentation',
                        'AI-driven discovery',
                        'Self-evolving products',
                        'Continuous innovation'
                    ],
                    tools: ['Custom AI platforms', 'Automated labs', 'ML research systems'],
                    risks: ['Nieprzewidywalność', 'Kontrola jakości', 'Patenty i IP']
                }
            },
            kpis: [
                { name: 'Time-to-Market', unit: 'miesięcy', benchmark: { low: 24, medium: 12, high: 6 }},
                { name: 'First-pass yield (design)', unit: '%', benchmark: { low: 60, medium: 80, high: 95 }},
                { name: 'Iteracje prototypów', unit: 'szt.', benchmark: { low: 8, medium: 4, high: 2 }},
                { name: 'Reuse rate (komponenty)', unit: '%', benchmark: { low: 20, medium: 50, high: 80 }}
            ],
            diagnosticQuestions: [
                'Jakie narzędzia CAD są używane?',
                'Jak wygląda proces prototypowania?',
                'Czy używane są symulacje przed produkcją?',
                'Jak zarządzana jest dokumentacja projektowa?',
                'Jak długo trwa typowy cykl rozwoju produktu?'
            ],
            bestPractices: [
                'PLM dla zarządzania cyklem życia produktu',
                'Standardowe biblioteki komponentów',
                'Design review na każdym etapie',
                'Symulacje przed fizycznym prototypem',
                'Integracja z produkcją (DFM/DFA)'
            ]
        },
        
        purchasing: {
            levelDescriptions: {
                1: {
                    namePl: 'Zakupy ad-hoc',
                    name: 'Ad-hoc Purchasing',
                    descriptionPl: 'Zakupy realizowane na bieżąco bez planowania. Brak formalnych procesów. Zamówienia przez telefon lub email. Brak centralnej bazy dostawców.',
                    description: 'Purchases made on an ad-hoc basis without planning. No formal processes. Orders by phone or email. No central supplier database.',
                    characteristics: [
                        'Zamówienia na żądanie',
                        'Brak formalnych umów',
                        'Rozproszeni dostawcy',
                        'Brak analityki zakupowej'
                    ],
                    tools: ['Email', 'Telefon', 'Excel'],
                    risks: ['Brak kontroli kosztów', 'Maverick buying', 'Brak compliance']
                },
                2: {
                    namePl: 'Zamówienia cyfrowe',
                    name: 'Digital Orders',
                    descriptionPl: 'Podstawowy system do składania zamówień. Centralna baza dostawców. Standardowe formularze zamówień. Podstawowe raportowanie wydatków.',
                    description: 'Basic ordering system. Central supplier database. Standard order forms. Basic spending reports.',
                    characteristics: [
                        'System zamówień online',
                        'Baza dostawców',
                        'Standardowe formularze',
                        'Podstawowe raporty'
                    ],
                    tools: ['Prostеjszy e-procurement', 'Supplier portals'],
                    risks: ['Brak integracji', 'Ręczne zatwierdzanie', 'Ograniczona widoczność']
                },
                3: {
                    namePl: 'System zakupowy',
                    name: 'Procurement System',
                    descriptionPl: 'Pełny system procurement z workflow zatwierdzania. Kontrakty zarządzane centralnie. Integracja z finansami. Supplier performance tracking.',
                    description: 'Full procurement system with approval workflows. Centrally managed contracts. Integration with finance. Supplier performance tracking.',
                    characteristics: [
                        'E-procurement platform',
                        'Workflow zatwierdzania',
                        'Contract management',
                        'Spend analytics'
                    ],
                    tools: ['SAP Ariba', 'Coupa', 'Oracle Procurement Cloud', 'Jaggaer'],
                    risks: ['Adoption challenges', 'Process compliance', 'Data quality']
                },
                4: {
                    namePl: 'Automatyczne uzupełnianie',
                    name: 'Automated Replenishment',
                    descriptionPl: 'Automatyczne generowanie zamówień na podstawie stanów magazynowych. MRP integracja. Automatyczne PO. Supplier collaboration portal.',
                    description: 'Automatic order generation based on inventory levels. MRP integration. Automatic POs. Supplier collaboration portal.',
                    characteristics: [
                        'Automatyczne reordering',
                        'MRP/MPS integration',
                        'Supplier portal',
                        'Real-time inventory'
                    ],
                    tools: ['SAP MM', 'Oracle SCM', 'Infor SCM'],
                    risks: ['Bullwhip effect', 'System dependency', 'Supplier reliability']
                },
                5: {
                    namePl: 'Integracja z dostawcami',
                    name: 'Supplier Integration',
                    descriptionPl: 'Pełna integracja systemów z kluczowymi dostawcami. VMI (Vendor Managed Inventory). EDI i API integrations. Collaborative forecasting.',
                    description: 'Full system integration with key suppliers. VMI (Vendor Managed Inventory). EDI and API integrations. Collaborative forecasting.',
                    characteristics: [
                        'VMI z dostawcami',
                        'EDI/API integracje',
                        'Wspólne prognozowanie',
                        'JIT/JIS delivery'
                    ],
                    tools: ['SAP IBP', 'E2open', 'Kinaxis', 'Blue Yonder'],
                    risks: ['Supplier lock-in', 'Data security', 'Integration costs']
                },
                6: {
                    namePl: 'Zakupy AI',
                    name: 'AI-Driven Procurement',
                    descriptionPl: 'AI optymalizuje decyzje zakupowe. Predykcyjne modelowanie popytu. Automatyczne negocjacje. Risk sensing dla dostawców.',
                    description: 'AI optimizes purchasing decisions. Predictive demand modeling. Automated negotiations. Risk sensing for suppliers.',
                    characteristics: [
                        'AI-driven sourcing',
                        'Predictive analytics',
                        'Automated negotiations',
                        'Supply risk monitoring'
                    ],
                    tools: ['Keelvar', 'Pactum AI', 'Sievo', 'SpendHQ'],
                    risks: ['AI trust', 'Supplier acceptance', 'Ethical concerns']
                },
                7: {
                    namePl: 'Autonomiczny sourcing',
                    name: 'Autonomous Sourcing',
                    descriptionPl: 'Autonomiczne systemy zarządzające całym procesem zakupowym. Samooptymalizująca się sieć dostawców. AI prowadzi RFQ i negocjacje. Humans zarządzają strategią.',
                    description: 'Autonomous systems managing entire procurement process. Self-optimizing supplier network. AI conducts RFQs and negotiations. Humans manage strategy.',
                    characteristics: [
                        'Autonomous purchasing',
                        'Self-healing supply chain',
                        'AI negotiations',
                        'Dynamic supplier switching'
                    ],
                    tools: ['Custom AI platforms', 'Blockchain procurement', 'Smart contracts'],
                    risks: ['Legal compliance', 'Relationship management', 'System failures']
                }
            },
            kpis: [
                { name: 'Procure-to-Pay cycle time', unit: 'dni', benchmark: { low: 30, medium: 14, high: 5 }},
                { name: 'Spend under management', unit: '%', benchmark: { low: 40, medium: 70, high: 95 }},
                { name: 'Supplier on-time delivery', unit: '%', benchmark: { low: 80, medium: 92, high: 98 }},
                { name: 'Cost savings YoY', unit: '%', benchmark: { low: 1, medium: 4, high: 8 }}
            ],
            diagnosticQuestions: [
                'Jak wygląda proces zamawiania materiałów?',
                'Ile dostawców macie w bazie?',
                'Jak mierzona jest wydajność dostawców?',
                'Jakie systemy procurement są używane?',
                'Jak zarządzane są kontrakty z dostawcami?'
            ],
            bestPractices: [
                'Centralizacja zakupów strategicznych',
                'Regularne przeglądy dostawców',
                'Category management approach',
                'Supplier development programs',
                'Risk mitigation dla krytycznych komponentów'
            ]
        },
        
        logistics: {
            levelDescriptions: {
                1: {
                    namePl: 'Śledzenie ręczne',
                    name: 'Manual Tracking',
                    descriptionPl: 'Ręczne śledzenie stanów magazynowych. Papierowe dokumenty przyjęć i wydań. Brak systemowego podejścia do lokalizacji towarów. Ręczne planowanie dostaw.',
                    description: 'Manual inventory tracking. Paper-based receipt and dispatch documents. No systematic approach to goods location. Manual delivery planning.',
                    characteristics: [
                        'Papierowe WZ i PZ',
                        'Ręczne liczenie stanów',
                        'Brak kodów kreskowych',
                        'Reaktywne planowanie'
                    ],
                    tools: ['Kartki, Excel', 'Papierowa dokumentacja'],
                    risks: ['Błędy inwentaryzacyjne', 'Zagubione towary', 'Przestoje produkcji']
                },
                2: {
                    namePl: 'Wdrożenie WMS',
                    name: 'WMS Implementation',
                    descriptionPl: 'Podstawowy system WMS. Kody kreskowe dla produktów. Cyfrowa ewidencja stanów. Podstawowe raportowanie logistyczne.',
                    description: 'Basic WMS system. Barcodes for products. Digital inventory records. Basic logistics reporting.',
                    characteristics: [
                        'System WMS',
                        'Kody kreskowe/QR',
                        'Lokalizacje magazynowe',
                        'Podstawowe raporty'
                    ],
                    tools: ['SAP WM', 'Oracle WMS', 'Manhattan WMS', 'Fishbowl'],
                    risks: ['Adopcja przez pracowników', 'Dokładność skanowania', 'Integracja z ERP']
                },
                3: {
                    namePl: 'Zintegrowana logistyka',
                    name: 'Integrated Logistics',
                    descriptionPl: 'WMS zintegrowany z ERP i transportem. Automatyczne generowanie listów przewozowych. Wave planning. Cross-docking capabilities.',
                    description: 'WMS integrated with ERP and transport. Automatic bill of lading generation. Wave planning. Cross-docking capabilities.',
                    characteristics: [
                        'Integracja WMS-ERP-TMS',
                        'Wave picking',
                        'Cross-docking',
                        'Carrier integration'
                    ],
                    tools: ['SAP EWM', 'Blue Yonder WMS', 'Körber WMS'],
                    risks: ['System complexity', 'Change management', 'Process redesign']
                },
                4: {
                    namePl: 'Śledzenie real-time',
                    name: 'Real-time Tracking',
                    descriptionPl: 'Śledzenie przesyłek w czasie rzeczywistym. RFID w magazynie. IoT sensors dla warunków przechowywania. Real-time dashboardy operacyjne.',
                    description: 'Real-time shipment tracking. RFID in warehouse. IoT sensors for storage conditions. Real-time operational dashboards.',
                    characteristics: [
                        'RFID tracking',
                        'IoT sensors',
                        'GPS tracking',
                        'Real-time visibility'
                    ],
                    tools: ['Zebra Technologies', 'FourKites', 'project44', 'Descartes'],
                    risks: ['Infrastructure costs', 'Data overload', 'Battery life (IoT)']
                },
                5: {
                    namePl: 'Automatyczny magazyn',
                    name: 'Automated Warehousing',
                    descriptionPl: 'Automatyzacja procesów magazynowych. AGV/AMR dla transportu wewnętrznego. Automated picking systems. Integracja z produkcją.',
                    description: 'Warehouse process automation. AGV/AMR for internal transport. Automated picking systems. Integration with production.',
                    characteristics: [
                        'AGV/AMR fleet',
                        'Automated picking (G2P)',
                        'Automated storage (AS/RS)',
                        'Voice/Vision picking'
                    ],
                    tools: ['AutoStore', 'Geek+', 'Locus Robotics', 'Fetch Robotics'],
                    risks: ['High CAPEX', 'Maintenance', 'Flexibility limitations']
                },
                6: {
                    namePl: 'Predykcyjny łańcuch dostaw',
                    name: 'Predictive Supply Chain',
                    descriptionPl: 'AI predykcja popytu i optymalizacja zapasów. Predictive maintenance dla sprzętu. Autonomous inventory optimization. Dynamic route optimization.',
                    description: 'AI demand prediction and inventory optimization. Predictive maintenance for equipment. Autonomous inventory optimization. Dynamic route optimization.',
                    characteristics: [
                        'AI demand forecasting',
                        'Dynamic safety stock',
                        'Predictive maintenance',
                        'Route optimization AI'
                    ],
                    tools: ['o9 Solutions', 'Coupa Supply Chain', 'RELEX Solutions', 'Llamasoft'],
                    risks: ['Forecast accuracy', 'Data requirements', 'Change management']
                },
                7: {
                    namePl: 'Autonomiczna sieć logistyczna',
                    name: 'Autonomous Logistics Network',
                    descriptionPl: 'Pełna autonomia operacji logistycznych. Autonomous vehicles. Drone delivery. Self-managing inventory network. Humans zarządzają wyjątkami.',
                    description: 'Full autonomy of logistics operations. Autonomous vehicles. Drone delivery. Self-managing inventory network. Humans manage exceptions.',
                    characteristics: [
                        'Autonomous vehicles',
                        'Drone operations',
                        'Self-organizing network',
                        'Zero-touch logistics'
                    ],
                    tools: ['Custom autonomous systems', 'Drone fleets', 'Self-driving trucks'],
                    risks: ['Regulatory barriers', 'Public acceptance', 'Technology maturity']
                }
            },
            kpis: [
                { name: 'Inventory accuracy', unit: '%', benchmark: { low: 85, medium: 95, high: 99.5 }},
                { name: 'Order fulfillment time', unit: 'godz.', benchmark: { low: 48, medium: 24, high: 4 }},
                { name: 'Warehouse utilization', unit: '%', benchmark: { low: 60, medium: 80, high: 92 }},
                { name: 'Perfect order rate', unit: '%', benchmark: { low: 80, medium: 92, high: 98 }}
            ],
            diagnosticQuestions: [
                'Jak zarządzany jest magazyn?',
                'Jakie systemy WMS/TMS są używane?',
                'Jak często przeprowadzana jest inwentaryzacja?',
                'Jak śledzone są przesyłki do klientów?',
                'Jaki jest średni czas kompletacji zamówienia?'
            ],
            bestPractices: [
                'Cycle counting zamiast rocznej inwentaryzacji',
                'ABC/XYZ analiza dla optymalizacji lokalizacji',
                'Standardowe procedury operacyjne (SOP)',
                'KPI dashboardy dla operacji',
                'Regularne przeglądy z przewoźnikami'
            ]
        },
        
        production: {
            levelDescriptions: {
                1: {
                    namePl: 'Operacje ręczne',
                    name: 'Manual Operations',
                    descriptionPl: 'Produkcja oparta na ręcznych operacjach. Brak lub minimalna automatyzacja. Papierowa dokumentacja produkcyjna. Reaktywne planowanie produkcji.',
                    description: 'Production based on manual operations. No or minimal automation. Paper-based production documentation. Reactive production planning.',
                    characteristics: [
                        'Ręczne stanowiska pracy',
                        'Papierowe zlecenia',
                        'Brak monitoringu OEE',
                        'Reaktywne utrzymanie ruchu'
                    ],
                    tools: ['Papierowe zlecenia', 'Podstawowe maszyny'],
                    risks: ['Niska wydajność', 'Błędy ludzkie', 'Brak powtarzalności']
                },
                2: {
                    namePl: 'Monitoring maszyn',
                    name: 'Machine Monitoring',
                    descriptionPl: 'Podstawowy monitoring maszyn. Rejestracja czasów pracy. Cyfrowe zlecenia produkcyjne. Podstawowe raportowanie wydajności.',
                    description: 'Basic machine monitoring. Recording of working times. Digital production orders. Basic performance reporting.',
                    characteristics: [
                        'Monitoring czasu pracy',
                        'Cyfrowe zlecenia',
                        'Podstawowe OEE',
                        'Rejestracja przestojów'
                    ],
                    tools: ['SCADA podstawowe', 'MDE (Machine Data Acquisition)'],
                    risks: ['Fragmentaryczne dane', 'Brak integracji', 'Ograniczona analityka']
                },
                3: {
                    namePl: 'Systemy sterowania',
                    name: 'Process Control Systems',
                    descriptionPl: 'Systemy sterowania procesem produkcyjnym. SCADA dla monitoringu. Integracja z ERP dla planowania. Podstawowe systemy jakości in-line.',
                    description: 'Production process control systems. SCADA for monitoring. Integration with ERP for planning. Basic in-line quality systems.',
                    characteristics: [
                        'SCADA/DCS',
                        'Integracja z ERP',
                        'In-line quality checks',
                        'Recipe management'
                    ],
                    tools: ['Siemens WinCC', 'Rockwell FactoryTalk', 'Schneider SCADA'],
                    risks: ['Cybersecurity', 'System aging', 'Integration complexity']
                },
                4: {
                    namePl: 'Zautomatyzowane linie',
                    name: 'Automated Production Lines',
                    descriptionPl: 'Zautomatyzowane linie produkcyjne. Robotyka przemysłowa. Automatyczna kontrola jakości. Integracja z systemami przedsiębiorstwa.',
                    description: 'Automated production lines. Industrial robotics. Automatic quality control. Integration with enterprise systems.',
                    characteristics: [
                        'Roboty przemysłowe',
                        'Automatyczne QC',
                        'Zintegrowane systemy',
                        'Real-time OEE'
                    ],
                    tools: ['FANUC', 'KUKA', 'ABB Robotics', 'Universal Robots'],
                    risks: ['High CAPEX', 'Flexibility trade-offs', 'Skilled operators needed']
                },
                5: {
                    namePl: 'Wdrożenie MES',
                    name: 'MES Implementation',
                    descriptionPl: 'Pełny system MES. Real-time tracking produkcji. Integracja shop floor z ERP. Advanced planning and scheduling (APS).',
                    description: 'Full MES system. Real-time production tracking. Shop floor to ERP integration. Advanced Planning and Scheduling (APS).',
                    characteristics: [
                        'MES layer',
                        'Real-time visibility',
                        'APS integration',
                        'Genealogy tracking'
                    ],
                    tools: ['SAP ME/MII', 'Siemens Opcenter', 'Rockwell Plex', 'MPDV'],
                    risks: ['Implementation complexity', 'Change management', 'Data accuracy']
                },
                6: {
                    namePl: 'Cyfrowy bliźniak produkcji',
                    name: 'Digital Twin of Production',
                    descriptionPl: 'Cyfrowy bliźniak całej produkcji. Symulacja i optymalizacja przed zmianami. Predictive maintenance. AI-driven scheduling.',
                    description: 'Digital twin of entire production. Simulation and optimization before changes. Predictive maintenance. AI-driven scheduling.',
                    characteristics: [
                        'Plant digital twin',
                        'What-if simulations',
                        'Predictive maintenance',
                        'AI scheduling'
                    ],
                    tools: ['Siemens Tecnomatix', 'Dassault 3DEXPERIENCE', 'ANSYS Twin Builder'],
                    risks: ['Model accuracy', 'Maintenance of twin', 'Integration complexity']
                },
                7: {
                    namePl: 'Autonomiczna fabryka',
                    name: 'Autonomous Factory',
                    descriptionPl: 'Autonomiczna fabryka (lights-out manufacturing). Samooptymalizujące się procesy. AI zarządza całą produkcją. Humans w roli supervisorów.',
                    description: 'Autonomous factory (lights-out manufacturing). Self-optimizing processes. AI manages entire production. Humans in supervisor role.',
                    characteristics: [
                        'Lights-out manufacturing',
                        'Self-optimizing production',
                        'Autonomous quality',
                        'Zero human intervention'
                    ],
                    tools: ['Custom AI systems', 'Full robotics', 'Autonomous material handling'],
                    risks: ['Technical failures', 'Flexibility loss', 'Workforce transformation']
                }
            },
            kpis: [
                { name: 'OEE (Overall Equipment Effectiveness)', unit: '%', benchmark: { low: 50, medium: 75, high: 85 }},
                { name: 'Defect rate', unit: 'ppm', benchmark: { low: 5000, medium: 500, high: 50 }},
                { name: 'Setup time', unit: 'min', benchmark: { low: 60, medium: 20, high: 5 }},
                { name: 'Unplanned downtime', unit: '%', benchmark: { low: 15, medium: 5, high: 1 }}
            ],
            diagnosticQuestions: [
                'Jak wygląda automatyzacja produkcji?',
                'Jak mierzone jest OEE?',
                'Jakie systemy MES/SCADA są używane?',
                'Jak planowana jest produkcja?',
                'Jak zarządzane jest utrzymanie ruchu?'
            ],
            bestPractices: [
                'Real-time OEE monitoring',
                'SMED dla redukcji przezbrojeń',
                'Predictive maintenance program',
                'Continuous improvement (Kaizen)',
                'Standard work dla operatorów'
            ]
        },
        
        quality: {
            levelDescriptions: {
                1: {
                    namePl: 'Kontrola ręczna',
                    name: 'Manual Inspection',
                    descriptionPl: 'Ręczna kontrola jakości końcowej. Papierowa dokumentacja jakościowa. Brak statystycznej kontroli procesu. Reaktywne podejście do jakości.',
                    description: 'Manual final quality inspection. Paper quality documentation. No statistical process control. Reactive approach to quality.',
                    characteristics: [
                        'Kontrola końcowa',
                        'Papierowe protokoły',
                        'Brak SPC',
                        'Reaktywne reklamacje'
                    ],
                    tools: ['Suwmiarki, mikrometry', 'Papierowe checklisty'],
                    risks: ['Opuszczone defekty', 'Koszty napraw', 'Zadowolenie klienta']
                },
                2: {
                    namePl: 'Dokumentacja cyfrowa',
                    name: 'Digital Records',
                    descriptionPl: 'Cyfrowa dokumentacja jakościowa. Podstawowe systemy QMS. Digitalne checklisty. Podstawowe raportowanie jakości.',
                    description: 'Digital quality documentation. Basic QMS systems. Digital checklists. Basic quality reporting.',
                    characteristics: [
                        'QMS system',
                        'Cyfrowe checklisty',
                        'NCR tracking',
                        'Podstawowe raporty'
                    ],
                    tools: ['QMS software', 'Digital forms', 'Simple databases'],
                    risks: ['Data silos', 'Limited analysis', 'Compliance gaps']
                },
                3: {
                    namePl: 'SPC',
                    name: 'Statistical Process Control',
                    descriptionPl: 'Statystyczna kontrola procesu wdrożona. Control charts dla krytycznych parametrów. FMEA i 8D dla rozwiązywania problemów. Audyty wewnętrzne.',
                    description: 'Statistical process control implemented. Control charts for critical parameters. FMEA and 8D for problem solving. Internal audits.',
                    characteristics: [
                        'Control charts',
                        'Cp/Cpk monitoring',
                        'FMEA/8D',
                        'Internal audits'
                    ],
                    tools: ['Minitab', 'InfinityQS', 'Quality Companion'],
                    risks: ['Training needs', 'Adoption', 'Data collection burden']
                },
                4: {
                    namePl: 'Kontrola automatyczna',
                    name: 'Automated Inspection',
                    descriptionPl: 'Automatyczna kontrola jakości w procesie. Vision systems. Automated testing. Integracja z produkcją.',
                    description: 'Automated in-process quality control. Vision systems. Automated testing. Integration with production.',
                    characteristics: [
                        'Vision inspection',
                        'Automated testing',
                        'In-line QC',
                        'Real-time feedback'
                    ],
                    tools: ['Cognex', 'Keyence', 'ZEISS', 'Renishaw'],
                    risks: ['False positives/negatives', 'Maintenance', 'Edge cases']
                },
                5: {
                    namePl: 'Zintegrowane zarządzanie jakością',
                    name: 'Integrated Quality Management',
                    descriptionPl: 'Zintegrowany system zarządzania jakością. Pełna traceability. Integracja z dostawcami. Zaawansowana analityka jakościowa.',
                    description: 'Integrated quality management system. Full traceability. Supplier integration. Advanced quality analytics.',
                    characteristics: [
                        'Full traceability',
                        'Supplier quality portal',
                        'Quality analytics',
                        'CAPA automation'
                    ],
                    tools: ['SAP QM', 'Sparta Systems', 'MasterControl', 'ETQ Reliance'],
                    risks: ['System complexity', 'Supplier adoption', 'Data overload']
                },
                6: {
                    namePl: 'Jakość predykcyjna AI',
                    name: 'Predictive Quality (AI)',
                    descriptionPl: 'AI predykcja defektów przed ich wystąpieniem. Machine learning dla optymalizacji procesu. Automated root cause analysis. Quality digital twin.',
                    description: 'AI prediction of defects before they occur. Machine learning for process optimization. Automated root cause analysis. Quality digital twin.',
                    characteristics: [
                        'Defect prediction',
                        'ML process optimization',
                        'AI root cause',
                        'Quality twin'
                    ],
                    tools: ['Sight Machine', 'Augury', 'Instrumental', 'Landing.ai'],
                    risks: ['Model drift', 'Data requirements', 'Trust in AI']
                },
                7: {
                    namePl: 'Systemy zero-defektów',
                    name: 'Zero-Defect Autonomous Systems',
                    descriptionPl: 'Autonomiczne systemy zapewnienia jakości. Zero-defect manufacturing. Self-correcting processes. AI-driven continuous improvement.',
                    description: 'Autonomous quality assurance systems. Zero-defect manufacturing. Self-correcting processes. AI-driven continuous improvement.',
                    characteristics: [
                        'Zero-defect philosophy',
                        'Self-correcting processes',
                        'Autonomous CAPA',
                        'Continuous AI learning'
                    ],
                    tools: ['Custom AI quality systems', 'Autonomous inspection robots'],
                    risks: ['Over-confidence', 'Edge cases', 'Technology limits']
                }
            },
            kpis: [
                { name: 'First Pass Yield', unit: '%', benchmark: { low: 85, medium: 95, high: 99.5 }},
                { name: 'Customer complaints', unit: '/million', benchmark: { low: 100, medium: 20, high: 2 }},
                { name: 'Cost of Quality', unit: '% revenue', benchmark: { low: 5, medium: 2, high: 0.5 }},
                { name: 'CAPA closure time', unit: 'dni', benchmark: { low: 90, medium: 30, high: 7 }}
            ],
            diagnosticQuestions: [
                'Jak wygląda proces kontroli jakości?',
                'Jakie narzędzia do analizy jakości są używane?',
                'Jak zarządzane są reklamacje?',
                'Czy stosowana jest kontrola statystyczna (SPC)?',
                'Jak wygląda traceability produktów?'
            ],
            bestPractices: [
                'Quality at the source (nie tylko kontrola końcowa)',
                'SPC dla krytycznych parametrów',
                'Regularne audyty wewnętrzne',
                '8D dla rozwiązywania problemów',
                'Supplier quality management'
            ]
        },
        
        finance: {
            levelDescriptions: {
                1: {
                    namePl: 'Arkusze kalkulacyjne',
                    name: 'Spreadsheets',
                    descriptionPl: 'Finanse zarządzane w Excelu. Ręczne księgowanie. Brak integracji systemów. Zamknięcie miesiąca trwa tygodnie.',
                    description: 'Finance managed in Excel. Manual bookkeeping. No system integration. Month-end close takes weeks.',
                    characteristics: [
                        'Excel jako główne narzędzie',
                        'Ręczne wprowadzanie danych',
                        'Brak automatyzacji',
                        'Długie zamknięcie miesiąca'
                    ],
                    tools: ['Excel', 'Podstawowa księgowość'],
                    risks: ['Błędy w danych', 'Brak audytowalności', 'Compliance risk']
                },
                2: {
                    namePl: 'Oprogramowanie księgowe',
                    name: 'Accounting Software',
                    descriptionPl: 'Podstawowe oprogramowanie księgowe. Automatyczne generowanie dokumentów. Podstawowe raportowanie finansowe. Cyfrowe faktury.',
                    description: 'Basic accounting software. Automatic document generation. Basic financial reporting. Digital invoices.',
                    characteristics: [
                        'System FK',
                        'Cyfrowe faktury',
                        'Podstawowe raporty',
                        'Ręczna konsolidacja'
                    ],
                    tools: ['Symfonia', 'Comarch ERP', 'Sage', 'QuickBooks'],
                    risks: ['Brak integracji', 'Manual reconciliation', 'Limited analytics']
                },
                3: {
                    namePl: 'Moduły finansowe ERP',
                    name: 'ERP Financial Modules',
                    descriptionPl: 'Pełne moduły finansowe ERP. Integracja z innymi obszarami. Automatyczna konsolidacja. Budżetowanie roczne.',
                    description: 'Full ERP financial modules. Integration with other areas. Automatic consolidation. Annual budgeting.',
                    characteristics: [
                        'Zintegrowany ERP FI/CO',
                        'Automatyczna konsolidacja',
                        'Budżetowanie',
                        'Cost center accounting'
                    ],
                    tools: ['SAP FI/CO', 'Oracle Financials', 'Microsoft Dynamics'],
                    risks: ['Implementation cost', 'Change management', 'Training needs']
                },
                4: {
                    namePl: 'Automatyczna fakturacja',
                    name: 'Automated Invoicing',
                    descriptionPl: 'Automatyczne przetwarzanie faktur. OCR dla dokumentów. Workflow zatwierdzania. Integracja z bankami. Rolling forecasts.',
                    description: 'Automatic invoice processing. OCR for documents. Approval workflows. Bank integration. Rolling forecasts.',
                    characteristics: [
                        'OCR/RPA dla faktur',
                        'Automatyczne workflow',
                        'Bank integration',
                        'Rolling forecasts'
                    ],
                    tools: ['Kofax', 'ABBYY', 'UiPath', 'Celonis'],
                    risks: ['OCR accuracy', 'Exception handling', 'Process standardization']
                },
                5: {
                    namePl: 'Controlling real-time',
                    name: 'Real-time Financial Controlling',
                    descriptionPl: 'Real-time widoczność finansowa. Zaawansowane KPI i dashboardy. Continuous close możliwy. Activity-based costing.',
                    description: 'Real-time financial visibility. Advanced KPIs and dashboards. Continuous close possible. Activity-based costing.',
                    characteristics: [
                        'Real-time dashboardy',
                        'Continuous accounting',
                        'ABC costing',
                        'Driver-based planning'
                    ],
                    tools: ['SAP S/4HANA', 'Oracle Cloud', 'Workday', 'Anaplan'],
                    risks: ['Data quality', 'Process discipline', 'Technology investment']
                },
                6: {
                    namePl: 'Modelowanie predykcyjne',
                    name: 'Predictive Financial Modeling',
                    descriptionPl: 'AI-driven forecasting. Predykcyjne modelowanie scenariuszy. Automated variance analysis. Intelligent recommendations.',
                    description: 'AI-driven forecasting. Predictive scenario modeling. Automated variance analysis. Intelligent recommendations.',
                    characteristics: [
                        'AI forecasting',
                        'Scenario modeling',
                        'Anomaly detection',
                        'Predictive cash flow'
                    ],
                    tools: ['BlackLine', 'HighRadius', 'Prophix', 'Vena Solutions'],
                    risks: ['Model accuracy', 'Black box concerns', 'Change management']
                },
                7: {
                    namePl: 'Autonomiczne finanse',
                    name: 'Autonomous Finance Operations',
                    descriptionPl: 'Autonomiczne operacje finansowe. AI zarządza cash management. Automated compliance. Self-healing processes.',
                    description: 'Autonomous finance operations. AI manages cash management. Automated compliance. Self-healing processes.',
                    characteristics: [
                        'Touchless finance',
                        'AI cash management',
                        'Automated compliance',
                        'Continuous auditing'
                    ],
                    tools: ['Custom AI finance platforms', 'Autonomous treasury systems'],
                    risks: ['Regulatory concerns', 'Control framework', 'Technology maturity']
                }
            },
            kpis: [
                { name: 'Days to Close', unit: 'dni', benchmark: { low: 15, medium: 5, high: 1 }},
                { name: 'Invoice processing time', unit: 'godz.', benchmark: { low: 48, medium: 8, high: 1 }},
                { name: 'Forecast accuracy', unit: '%', benchmark: { low: 70, medium: 90, high: 98 }},
                { name: 'Working capital days', unit: 'dni', benchmark: { low: 90, medium: 60, high: 30 }}
            ],
            diagnosticQuestions: [
                'Jakie systemy finansowe są używane?',
                'Jak długo trwa zamknięcie miesiąca?',
                'Jak przetwarzane są faktury?',
                'Jak często aktualizowane są prognozy?',
                'Jaka jest widoczność kosztów w czasie rzeczywistym?'
            ],
            bestPractices: [
                'Monthly close w 5 dni roboczych',
                'Rolling forecasts (kwartalnie)',
                'Automatyzacja AP/AR',
                'Real-time cost visibility',
                'Continuous auditing'
            ]
        },
        
        hr: {
            levelDescriptions: {
                1: {
                    namePl: 'Dokumentacja papierowa',
                    name: 'Paper Records',
                    descriptionPl: 'Akta pracownicze w formie papierowej. Ręczne obliczanie płac. Brak systemu HR. Podstawowa rekrutacja przez ogłoszenia.',
                    description: 'Employee files in paper form. Manual payroll calculation. No HR system. Basic recruitment through ads.',
                    characteristics: [
                        'Papierowe akta osobowe',
                        'Ręczne płace',
                        'Brak systemu HR',
                        'Podstawowa rekrutacja'
                    ],
                    tools: ['Teczki personalne', 'Excel'],
                    risks: ['Compliance risk', 'Data loss', 'Inefficiency']
                },
                2: {
                    namePl: 'Podstawowe oprogramowanie HR',
                    name: 'Basic HR Software',
                    descriptionPl: 'Podstawowy system kadrowo-płacowy. Cyfrowe akta pracownicze. Podstawowe raportowanie HR. E-wnioski urlopowe.',
                    description: 'Basic payroll and HR system. Digital employee files. Basic HR reporting. E-leave requests.',
                    characteristics: [
                        'System kadrowo-płacowy',
                        'E-akta',
                        'Portal pracowniczy',
                        'Podstawowe raporty'
                    ],
                    tools: ['Comarch HR', 'Sage Kadry Płace', 'Enova'],
                    risks: ['Limited functionality', 'No integration', 'Manual processes']
                },
                3: {
                    namePl: 'System HRM',
                    name: 'HRM System',
                    descriptionPl: 'Pełny system HRM. Zarządzanie szkoleniami. Performance management. Samoobsługowy portal HR.',
                    description: 'Full HRM system. Training management. Performance management. Self-service HR portal.',
                    characteristics: [
                        'Kompleksowy HRM',
                        'LMS dla szkoleń',
                        'Performance reviews',
                        'Employee self-service'
                    ],
                    tools: ['SAP HCM', 'Workday', 'Oracle HCM', 'PeopleSoft'],
                    risks: ['Adoption', 'Change management', 'Data migration']
                },
                4: {
                    namePl: 'System zarządzania talentami',
                    name: 'Talent Management System',
                    descriptionPl: 'Zintegrowane zarządzanie talentami. Succession planning. Competency frameworks. 360-degree feedback. Engagement surveys.',
                    description: 'Integrated talent management. Succession planning. Competency frameworks. 360-degree feedback. Engagement surveys.',
                    characteristics: [
                        'Talent management',
                        'Succession planning',
                        'Competency models',
                        '360 feedback'
                    ],
                    tools: ['Cornerstone', 'Saba', 'Talentsoft', 'Culture Amp'],
                    risks: ['Manager adoption', 'Process discipline', 'Calibration']
                },
                5: {
                    namePl: 'Analityka HR',
                    name: 'People Analytics',
                    descriptionPl: 'Zaawansowana analityka HR. Predykcja rotacji. Workforce planning. Diversity analytics. Real-time HR dashboards.',
                    description: 'Advanced HR analytics. Turnover prediction. Workforce planning. Diversity analytics. Real-time HR dashboards.',
                    characteristics: [
                        'People analytics platform',
                        'Churn prediction',
                        'Workforce planning',
                        'Diversity dashboards'
                    ],
                    tools: ['Visier', 'One Model', 'Crunchr', 'Peakon'],
                    risks: ['Privacy concerns', 'Data quality', 'Ethical use']
                },
                6: {
                    namePl: 'Rekrutacja i retencja AI',
                    name: 'AI Recruitment & Retention',
                    descriptionPl: 'AI w rekrutacji i retencji. Inteligentny matching kandydatów. Chatboty HR. Personalized learning paths. Predictive engagement.',
                    description: 'AI in recruitment and retention. Intelligent candidate matching. HR chatbots. Personalized learning paths. Predictive engagement.',
                    characteristics: [
                        'AI recruitment',
                        'HR chatbots',
                        'Personalized L&D',
                        'Engagement prediction'
                    ],
                    tools: ['HireVue', 'Pymetrics', 'Eightfold', 'Degreed'],
                    risks: ['Bias in AI', 'Candidate experience', 'Regulatory compliance']
                },
                7: {
                    namePl: 'Autonomiczne zarządzanie personelem',
                    name: 'Autonomous Workforce Management',
                    descriptionPl: 'Autonomiczne systemy HR. AI-driven workforce optimization. Self-managing teams. Continuous performance management.',
                    description: 'Autonomous HR systems. AI-driven workforce optimization. Self-managing teams. Continuous performance management.',
                    characteristics: [
                        'Autonomous scheduling',
                        'AI workforce optimization',
                        'Self-organizing teams',
                        'Continuous feedback'
                    ],
                    tools: ['Custom AI HR platforms', 'Autonomous workforce systems'],
                    risks: ['Dehumanization', 'Privacy', 'Employee acceptance']
                }
            },
            kpis: [
                { name: 'Time to Hire', unit: 'dni', benchmark: { low: 60, medium: 30, high: 14 }},
                { name: 'Employee turnover', unit: '%', benchmark: { low: 25, medium: 12, high: 5 }},
                { name: 'Training hours/employee', unit: 'godz./rok', benchmark: { low: 8, medium: 24, high: 50 }},
                { name: 'Employee NPS', unit: 'score', benchmark: { low: 10, medium: 30, high: 60 }}
            ],
            diagnosticQuestions: [
                'Jakie systemy HR są używane?',
                'Jak wygląda proces rekrutacji?',
                'Jak zarządzane są szkolenia?',
                'Jak mierzone jest zaangażowanie pracowników?',
                'Czy jest formalny proces performance review?'
            ],
            bestPractices: [
                'Regular engagement surveys',
                'Structured onboarding process',
                'Continuous feedback culture',
                'Clear career paths',
                'Diversity & inclusion programs'
            ]
        }
    }
    
    // TODO: Add content for other 6 axes (digitalProducts, businessModels, dataManagement, culture, cybersecurity, aiMaturity)
    // Following the same structure as 'processes'
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get area assessment content for a specific axis and area
 */
function getAreaContent(axisId, areaId) {
    return AXIS_AREA_CONTENT[axisId]?.[areaId] || null;
}

/**
 * Get level description for a specific axis, area, and level
 */
function getLevelDescription(axisId, areaId, level, language = 'pl') {
    const content = getAreaContent(axisId, areaId);
    if (!content) return null;
    
    const levelData = content.levelDescriptions[level];
    if (!levelData) return null;
    
    return language === 'pl' 
        ? { name: levelData.namePl, description: levelData.descriptionPl }
        : { name: levelData.name, description: levelData.description };
}

/**
 * Get all business areas
 */
function getBusinessAreas() {
    return BUSINESS_AREAS;
}

/**
 * Get maturity level info
 */
function getMaturityLevel(level) {
    return MATURITY_LEVELS[level] || null;
}

/**
 * Generate HTML for area detail card
 */
function generateAreaDetailHTML(axisId, areaId, currentLevel, targetLevel, interviewData = {}, language = 'pl') {
    const area = BUSINESS_AREAS[areaId];
    const content = getAreaContent(axisId, areaId);
    
    if (!area || !content) {
        return `<div class="area-detail-error">No content available for ${axisId}/${areaId}</div>`;
    }
    
    const currentLevelData = content.levelDescriptions[currentLevel] || {};
    const targetLevelData = content.levelDescriptions[targetLevel] || {};
    const gap = targetLevel - currentLevel;
    const priority = gap >= 3 ? 'CRITICAL' : gap >= 2 ? 'HIGH' : gap >= 1 ? 'MEDIUM' : 'LOW';
    const priorityColor = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' }[priority];
    
    const isPolish = language === 'pl';
    
    return `
<div class="area-detail-card" data-axis="${axisId}" data-area="${areaId}">
    <div class="area-header">
        <div class="area-icon">${area.icon}</div>
        <div class="area-title">
            <h3>${isPolish ? area.namePl : area.name}</h3>
            <span class="area-description">${isPolish ? area.descriptionPl : area.description}</span>
        </div>
        <div class="priority-badge" style="background: ${priorityColor}20; color: ${priorityColor}; border: 1px solid ${priorityColor};">
            ${priority}
        </div>
    </div>
    
    <div class="level-cards">
        <div class="level-card current">
            <div class="level-value">${currentLevel}</div>
            <div class="level-label">${isPolish ? 'Aktualny' : 'Current'}</div>
            <div class="level-name">${isPolish ? currentLevelData.namePl : currentLevelData.name}</div>
        </div>
        <div class="level-arrow">→</div>
        <div class="level-card target">
            <div class="level-value">${targetLevel}</div>
            <div class="level-label">${isPolish ? 'Docelowy' : 'Target'}</div>
            <div class="level-name">${isPolish ? targetLevelData.namePl : targetLevelData.name}</div>
        </div>
        <div class="level-card gap" style="border-color: ${priorityColor};">
            <div class="level-value" style="color: ${priorityColor};">+${gap}</div>
            <div class="level-label">${isPolish ? 'Luka' : 'Gap'}</div>
        </div>
    </div>
    
    <div class="section current-state">
        <h4>📋 ${isPolish ? 'Opis stanu aktualnego' : 'Current State Description'}</h4>
        <p>${isPolish ? currentLevelData.descriptionPl : currentLevelData.description}</p>
        
        <h5>${isPolish ? 'Charakterystyki obecnego poziomu' : 'Characteristics of Current Level'}:</h5>
        <ul>
            ${(currentLevelData.characteristics || []).map(c => `<li>${c}</li>`).join('')}
        </ul>
        
        <h5>${isPolish ? 'Używane narzędzia' : 'Tools Used'}:</h5>
        <div class="tools-list">
            ${(currentLevelData.tools || []).map(t => `<span class="tool-badge">${t}</span>`).join('')}
        </div>
    </div>
    
    ${interviewData.notes ? `
    <div class="section interview-notes">
        <h4>📝 ${isPolish ? 'Notatki z wywiadu' : 'Interview Notes'}</h4>
        <div class="interview-meta">
            <span><strong>${isPolish ? 'Rozmówca' : 'Interviewee'}:</strong> ${interviewData.name || 'N/A'} (${interviewData.role || 'N/A'})</span>
            <span><strong>${isPolish ? 'Data' : 'Date'}:</strong> ${interviewData.date || 'N/A'}</span>
        </div>
        ${interviewData.quote ? `
        <blockquote class="interview-quote">
            "${interviewData.quote}"
        </blockquote>
        ` : ''}
        <div class="observations">
            <h5>${isPolish ? 'Obserwacje' : 'Observations'}:</h5>
            <ul>
                ${(interviewData.observations || []).map(o => `<li>${o}</li>`).join('')}
            </ul>
        </div>
    </div>
    ` : ''}
    
    <div class="section target-state">
        <h4>🎯 ${isPolish ? 'Aby osiągnąć poziom' : 'To Reach Level'} ${targetLevel} (${isPolish ? targetLevelData.namePl : targetLevelData.name})</h4>
        <p>${isPolish ? targetLevelData.descriptionPl : targetLevelData.description}</p>
        
        <h5>${isPolish ? 'Wymagane charakterystyki' : 'Required Characteristics'}:</h5>
        <ul>
            ${(targetLevelData.characteristics || []).map(c => `<li>${c}</li>`).join('')}
        </ul>
        
        <h5>${isPolish ? 'Przykładowe narzędzia' : 'Example Tools'}:</h5>
        <div class="tools-list">
            ${(targetLevelData.tools || []).map(t => `<span class="tool-badge target">${t}</span>`).join('')}
        </div>
    </div>
    
    <div class="section recommendations">
        <h4>🚀 ${isPolish ? 'Rekomendacje rozwojowe' : 'Development Recommendations'}</h4>
        <ol>
            ${(content.bestPractices || []).slice(0, 5).map((bp, i) => `
            <li>
                <strong>${bp}</strong>
                <div class="rec-meta">
                    <span class="rec-priority">${isPolish ? 'Priorytet' : 'Priority'}: ${i < 2 ? (isPolish ? 'Wysoki' : 'High') : (isPolish ? 'Średni' : 'Medium')}</span>
                </div>
            </li>
            `).join('')}
        </ol>
    </div>
    
    <div class="section risks">
        <h4>⚠️ ${isPolish ? 'Ryzyka' : 'Risks'}</h4>
        <ul class="risk-list">
            ${(currentLevelData.risks || []).map(r => `<li class="risk-item">${r}</li>`).join('')}
        </ul>
    </div>
    
    <div class="section kpis">
        <h4>📈 ${isPolish ? 'KPI do monitorowania' : 'KPIs to Monitor'}</h4>
        <div class="kpi-grid">
            ${(content.kpis || []).map(kpi => `
            <div class="kpi-card">
                <div class="kpi-name">${kpi.name}</div>
                <div class="kpi-benchmark">
                    <span class="kpi-low">Low: ${kpi.benchmark.low}${kpi.unit}</span>
                    <span class="kpi-high">Best: ${kpi.benchmark.high}${kpi.unit}</span>
                </div>
            </div>
            `).join('')}
        </div>
    </div>
</div>
`;
}

/**
 * Generate HTML for axis area matrix
 */
function generateAxisAreaMatrixHTML(axisId, areaAssessments, language = 'pl') {
    const isPolish = language === 'pl';
    const areas = Object.values(BUSINESS_AREAS);
    
    // Create header row
    const headerCells = areas.map(area => 
        `<th style="text-align: center; padding: 8px; background: #1e1b4b; color: white;">
            <div>${area.icon}</div>
            <div style="font-size: 11px;">${isPolish ? area.namePl : area.name}</div>
        </th>`
    ).join('');
    
    // Create level rows (7 down to 1)
    const levelRows = [];
    for (let level = 7; level >= 1; level--) {
        const levelInfo = MATURITY_LEVELS[level];
        const cells = areas.map(area => {
            const assessment = areaAssessments.find(a => a.areaId === area.id);
            const current = assessment?.currentLevel || 0;
            const target = assessment?.targetLevel || 0;
            
            let cellContent = '';
            let cellStyle = 'padding: 8px; text-align: center; border: 1px solid #e5e7eb;';
            
            if (current === level && target === level) {
                cellContent = '●○';
                cellStyle += ' background: linear-gradient(135deg, #3b82f620, #10b98120);';
            } else if (current === level) {
                cellContent = '●';
                cellStyle += ' background: #3b82f620;';
            } else if (target === level) {
                cellContent = '○';
                cellStyle += ' background: #10b98120;';
            }
            
            return `<td style="${cellStyle}">${cellContent}</td>`;
        }).join('');
        
        levelRows.push(`
            <tr>
                <td style="padding: 8px; background: ${levelInfo.color}20; font-weight: 600; border: 1px solid #e5e7eb;">
                    <div style="color: ${levelInfo.color};">${level}. ${isPolish ? levelInfo.namePl : levelInfo.name}</div>
                </td>
                ${cells}
            </tr>
        `);
    }
    
    // Create summary rows
    const currentRow = areas.map(area => {
        const assessment = areaAssessments.find(a => a.areaId === area.id);
        return `<td style="text-align: center; padding: 8px; font-weight: 700; color: #3b82f6; border: 1px solid #e5e7eb;">
            ${assessment?.currentLevel || '-'}
        </td>`;
    }).join('');
    
    const targetRow = areas.map(area => {
        const assessment = areaAssessments.find(a => a.areaId === area.id);
        return `<td style="text-align: center; padding: 8px; font-weight: 700; color: #10b981; border: 1px solid #e5e7eb;">
            ${assessment?.targetLevel || '-'}
        </td>`;
    }).join('');
    
    const gapRow = areas.map(area => {
        const assessment = areaAssessments.find(a => a.areaId === area.id);
        const gap = (assessment?.targetLevel || 0) - (assessment?.currentLevel || 0);
        const gapColor = gap >= 3 ? '#ef4444' : gap >= 2 ? '#f59e0b' : gap >= 1 ? '#eab308' : '#22c55e';
        return `<td style="text-align: center; padding: 8px; font-weight: 700; color: ${gapColor}; border: 1px solid #e5e7eb;">
            ${gap > 0 ? '+' + gap : gap}
        </td>`;
    }).join('');
    
    return `
<div class="axis-area-matrix">
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
            <tr>
                <th style="padding: 8px; background: #1e1b4b; color: white; text-align: left;">
                    ${isPolish ? 'Poziom' : 'Level'}
                </th>
                ${headerCells}
            </tr>
        </thead>
        <tbody>
            ${levelRows.join('')}
            <tr style="border-top: 3px solid #1e1b4b;">
                <td style="padding: 8px; background: #f8fafc; font-weight: 600; border: 1px solid #e5e7eb;">
                    ${isPolish ? 'Aktualny' : 'Current'}
                </td>
                ${currentRow}
            </tr>
            <tr>
                <td style="padding: 8px; background: #f8fafc; font-weight: 600; border: 1px solid #e5e7eb;">
                    ${isPolish ? 'Docelowy' : 'Target'}
                </td>
                ${targetRow}
            </tr>
            <tr>
                <td style="padding: 8px; background: #f8fafc; font-weight: 600; border: 1px solid #e5e7eb;">
                    ${isPolish ? 'Luka' : 'Gap'}
                </td>
                ${gapRow}
            </tr>
        </tbody>
    </table>
    <div style="margin-top: 12px; font-size: 12px; color: #64748b;">
        <span style="margin-right: 16px;">● = ${isPolish ? 'Stan aktualny' : 'Current state'}</span>
        <span>○ = ${isPolish ? 'Cel' : 'Target'}</span>
    </div>
</div>
`;
}

// ============================================================================
// EXPORTS
// ============================================================================
export default {
    BUSINESS_AREAS,
    MATURITY_LEVELS,
    AXIS_AREA_CONTENT,
    getAreaContent,
    getLevelDescription,
    getBusinessAreas,
    getMaturityLevel,
    generateAreaDetailHTML,
    generateAxisAreaMatrixHTML
};

