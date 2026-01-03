/**
 * Enterprise Report Templates - BCG/McKinsey Style
 * Professional-grade content with detailed analysis, benchmarks, and visualizations
 */

const DRD_AXES = {
    processes: { 
        id: 'processes', 
        name: 'Digital Processes', 
        namePl: 'Procesy Cyfrowe',
        icon: '⚙️',
        order: 1,
        maxLevel: 7,
        color: '#3B82F6',
        description: 'Digitalizacja i automatyzacja procesów operacyjnych',
        benchmarks: {
            leader: 6.2,
            average: 3.8,
            laggard: 2.1
        }
    },
    digitalProducts: { 
        id: 'digitalProducts', 
        name: 'Digital Products', 
        namePl: 'Produkty Cyfrowe',
        icon: '📦',
        order: 2,
        maxLevel: 5,
        color: '#F59E0B',
        description: 'Cyfrowe produkty i usługi generujące wartość',
        benchmarks: {
            leader: 4.5,
            average: 2.9,
            laggard: 1.5
        }
    },
    businessModels: { 
        id: 'businessModels', 
        name: 'Digital Business Models', 
        namePl: 'Modele Biznesowe',
        icon: '💼',
        order: 3,
        maxLevel: 5,
        color: '#8B5CF6',
        description: 'Innowacyjne modele generowania wartości',
        benchmarks: {
            leader: 4.2,
            average: 2.5,
            laggard: 1.3
        }
    },
    dataManagement: { 
        id: 'dataManagement', 
        name: 'Data Management', 
        namePl: 'Zarządzanie Danymi',
        icon: '📊',
        order: 4,
        maxLevel: 7,
        color: '#10B981',
        description: 'Strategia danych, analityka i governance',
        benchmarks: {
            leader: 5.8,
            average: 3.2,
            laggard: 1.8
        }
    },
    culture: { 
        id: 'culture', 
        name: 'Culture of Transformation', 
        namePl: 'Kultura Transformacji',
        icon: '🎯',
        order: 5,
        maxLevel: 5,
        color: '#EF4444',
        description: 'Gotowość organizacji do zmian cyfrowych',
        benchmarks: {
            leader: 4.3,
            average: 2.7,
            laggard: 1.6
        }
    },
    cybersecurity: { 
        id: 'cybersecurity', 
        name: 'Cybersecurity', 
        namePl: 'Cyberbezpieczeństwo',
        icon: '🔒',
        order: 6,
        maxLevel: 5,
        color: '#6366F1',
        description: 'Ochrona zasobów i odporność cyfrowa',
        benchmarks: {
            leader: 4.6,
            average: 3.1,
            laggard: 1.9
        }
    },
    aiMaturity: { 
        id: 'aiMaturity', 
        name: 'AI Maturity', 
        namePl: 'Dojrzałość AI',
        icon: '🤖',
        order: 7,
        maxLevel: 5,
        color: '#EC4899',
        description: 'Wykorzystanie AI i ML w organizacji',
        benchmarks: {
            leader: 3.9,
            average: 2.1,
            laggard: 1.2
        }
    }
};

// Industry benchmark data
const INDUSTRY_BENCHMARKS = {
    manufacturing: {
        name: 'Manufacturing',
        namePl: 'Produkcja',
        processes: 4.2, digitalProducts: 2.8, businessModels: 2.3,
        dataManagement: 3.5, culture: 2.9, cybersecurity: 3.4, aiMaturity: 2.3
    },
    retail: {
        name: 'Retail & E-commerce',
        namePl: 'Handel i E-commerce',
        processes: 4.5, digitalProducts: 4.1, businessModels: 3.8,
        dataManagement: 4.2, culture: 3.5, cybersecurity: 3.6, aiMaturity: 3.2
    },
    financial: {
        name: 'Financial Services',
        namePl: 'Usługi Finansowe',
        processes: 5.2, digitalProducts: 4.3, businessModels: 3.5,
        dataManagement: 5.1, culture: 3.2, cybersecurity: 4.5, aiMaturity: 3.8
    },
    healthcare: {
        name: 'Healthcare',
        namePl: 'Ochrona Zdrowia',
        processes: 3.8, digitalProducts: 2.9, businessModels: 2.1,
        dataManagement: 3.2, culture: 2.6, cybersecurity: 4.1, aiMaturity: 2.5
    },
    technology: {
        name: 'Technology',
        namePl: 'Technologia',
        processes: 5.8, digitalProducts: 4.8, businessModels: 4.5,
        dataManagement: 5.5, culture: 4.2, cybersecurity: 4.3, aiMaturity: 4.5
    }
};

// Axis-specific detailed content for BCG/McKinsey style reports
const AXIS_DETAILED_CONTENT = {
    processes: {
        currentStateDescriptions: {
            1: 'Organizacja polega głównie na ręcznych procesach i arkuszach Excel. Dane są fragmentaryczne, często nieaktualne i przechowywane w silosach. Brak standardowych procedur operacyjnych (SOP) prowadzi do niespójności w realizacji zadań. Typowe problemy to: długi czas realizacji zamówień, wysoki poziom błędów, brak visibilility stanu procesów.',
            2: 'Wprowadzono podstawowe narzędzia cyfrowe na stanowiskach pracy (tablety, terminale). Instrukcje są częściowo zdigitalizowane, ale integracja między systemami jest minimalna. Dane zbierane lokalnie, bez centralnej bazy. Procesy wciąż wymagają znacznej interwencji manualnej.',
            3: 'Procesy są zmapowane i monitorowane z wykorzystaniem KPI. Istnieją podstawowe dashboardy, system alertowania o odchyleniach. Organizacja zaczyna wykorzystywać cyfrowe bliźniaki dla kluczowych procesów. Widoczny postęp w standaryzacji, ale automatyzacja ograniczona.',
            4: 'Wdrożone rozwiązania RPA dla powtarzalnych zadań. Automatyczne workflow i eskalacje działają sprawnie. Dokumenty obiegu są w pełni cyfrowe z automatycznym raportowaniem. Organizacja osiągnęła dobry poziom efektywności, ale nie wykorzystuje pełnego potencjału integracji.',
            5: 'Funkcjonują systemy MES zapewniające monitoring w czasie rzeczywistym. Pełna visibility łańcucha dostaw. Zaawansowana automatyzacja workflow z integracją OT/IT. Organizacja jest gotowa na dalszą transformację w kierunku AI.',
            6: 'Zintegrowany system ERP obejmuje wszystkie kluczowe procesy. Single source of truth dla całej organizacji. Automatyczny przepływ informacji między działami z zaawansowanymi dashboardami. Organizacja jest cyfrowym liderem w swojej branży.',
            7: 'Algorytmy AI wspierają decyzje w czasie rzeczywistym. Predykcyjne modele optymalizują kluczowe procesy. Autonomiczna optymalizacja parametrów z machine learning w cyklu ciągłego doskonalenia. Organizacja wyznacza standardy dla branży.'
        },
        transformationPath: [
            { from: 1, to: 2, actions: ['Digitalizacja instrukcji stanowiskowych', 'Wdrożenie tabletów/terminali', 'Centralizacja danych w jednym systemie', 'Szkolenia pracowników z narzędzi cyfrowych'], timeline: '2-4 miesiące', investment: '50-100 tys. PLN' },
            { from: 2, to: 3, actions: ['Mapowanie procesów end-to-end', 'Wdrożenie systemu KPI i dashboardów', 'Implementacja alertowania', 'Pilotaż cyfrowych bliźniaków'], timeline: '3-6 miesięcy', investment: '100-200 tys. PLN' },
            { from: 3, to: 4, actions: ['Identyfikacja procesów do automatyzacji', 'Wdrożenie RPA dla wybranych procesów', 'Automatyzacja workflow', 'Pełna digitalizacja dokumentów'], timeline: '4-8 miesięcy', investment: '200-400 tys. PLN' },
            { from: 4, to: 5, actions: ['Wdrożenie systemu MES', 'Integracja OT/IT', 'Real-time monitoring produkcji', 'Visibility łańcucha dostaw'], timeline: '6-12 miesięcy', investment: '500 tys. - 1 mln PLN' },
            { from: 5, to: 6, actions: ['Implementacja/modernizacja ERP', 'Integracja wszystkich systemów', 'Single source of truth', 'Zaawansowane dashboardy'], timeline: '12-18 miesięcy', investment: '1-3 mln PLN' },
            { from: 6, to: 7, actions: ['Pilotaż AI dla wybranych procesów', 'Wdrożenie predykcyjnych modeli', 'Autonomiczna optymalizacja', 'Continuous learning'], timeline: '12-24 miesiące', investment: '2-5 mln PLN' }
        ],
        kpis: [
            { name: 'Czas cyklu procesu (Lead Time)', target: '-30%', description: 'Skrócenie czasu od zamówienia do dostawy' },
            { name: 'Poziom automatyzacji', target: '>70%', description: 'Procent zadań wykonywanych automatycznie' },
            { name: 'First Pass Yield', target: '>95%', description: 'Procent produktów bez poprawek za pierwszym razem' },
            { name: 'OEE (Overall Equipment Effectiveness)', target: '>85%', description: 'Całkowita efektywność wyposażenia' },
            { name: 'Czas przestoju nieplanowanego', target: '<3%', description: 'Redukcja nieplanowanych przestojów' }
        ],
        risks: [
            { name: 'Opór pracowników', probability: 'Wysoka', impact: 'Średni', mitigation: 'Program change management, szkolenia, komunikacja korzyści' },
            { name: 'Integracja systemów legacy', probability: 'Średnia', impact: 'Wysoki', mitigation: 'Etapowa migracja, middleware, API-first approach' },
            { name: 'Przekroczenie budżetu', probability: 'Średnia', impact: 'Średni', mitigation: 'Jasno zdefiniowany scope, MVP approach, regularne przeglądy' },
            { name: 'Brak kompetencji', probability: 'Wysoka', impact: 'Wysoki', mitigation: 'Szkolenia, zatrudnienie ekspertów, partnerstwo z dostawcą' }
        ],
        leaderPractices: [
            'Toyota Production System - cyfryzacja lean manufacturing z AI-powered quality control',
            'Siemens - Digital Twin dla całego procesu produkcyjnego z predykcyjnym maintenance',
            'Amazon - w pełni zautomatyzowane centra logistyczne z robotami Kiva',
            'Bosch - Connected Manufacturing z IoT sensors i real-time analytics'
        ]
    },
    digitalProducts: {
        currentStateDescriptions: {
            1: 'Produkty organizacji są w pełni fizyczne, bez komponentu cyfrowego. Brak aplikacji, portali czy usług online. Komunikacja z klientami odbywa się tradycyjnymi kanałami. Organizacja nie generuje przychodów z kanałów cyfrowych.',
            2: 'Istnieją podstawowe elementy cyfrowe - prosta strona www, formularz kontaktowy. Produkty fizyczne mogą mieć podstawową dokumentację online. Początkowe eksperymenty z cyfrowymi usługami dodatkowymi.',
            3: 'Funkcjonuje rozbudowany portal klienta z samoobsługą. Produkty mają cyfrowe rozszerzenia (np. aplikacja towarzysząca). E-commerce stanowi uzupełnienie tradycyjnej sprzedaży. Dane z produktów są częściowo zbierane.',
            4: 'Produkty są cyfrowo rozszerzone - IoT, connected products. Platforma cyfrowa generuje znaczące przychody. Personalizacja oferty na podstawie danych. Modele subskrypcyjne dla usług cyfrowych.',
            5: 'Produkty cyfrowe stanowią core biznesu lub znaczący stream przychodów. Pełna platforma ekosystemu z partnerami. Data-driven product development. Organizacja jest cyfrowym liderem w swojej kategorii.'
        },
        transformationPath: [
            { from: 1, to: 2, actions: ['Modernizacja strony www', 'Wdrożenie CRM', 'Basic e-commerce', 'Digitalizacja dokumentacji produktowej'], timeline: '2-4 miesiące', investment: '30-80 tys. PLN' },
            { from: 2, to: 3, actions: ['Portal klienta z self-service', 'Aplikacja mobilna', 'Rozbudowa e-commerce', 'Program zbierania danych produktowych'], timeline: '4-8 miesięcy', investment: '150-300 tys. PLN' },
            { from: 3, to: 4, actions: ['IoT connectivity w produktach', 'Platforma subskrypcyjna', 'Personalizacja oparta na danych', 'API dla partnerów'], timeline: '6-12 miesięcy', investment: '300-600 tys. PLN' },
            { from: 4, to: 5, actions: ['Budowa ekosystemu partnerów', 'AI-powered product features', 'Marketplace/platforma', 'Data monetization'], timeline: '12-24 miesiące', investment: '1-3 mln PLN' }
        ],
        kpis: [
            { name: 'Digital Revenue Share', target: '>30%', description: 'Udział przychodów z kanałów cyfrowych' },
            { name: 'Customer Digital Engagement', target: '>60%', description: 'Klienci aktywnie korzystający z usług cyfrowych' },
            { name: 'Product Connectivity Rate', target: '>80%', description: 'Produkty z komponentem IoT/connected' },
            { name: 'Digital NPS', target: '>50', description: 'Satysfakcja klientów z usług cyfrowych' },
            { name: 'Time-to-Market cyfrowy', target: '-50%', description: 'Czas wprowadzenia nowych funkcji cyfrowych' }
        ],
        risks: [
            { name: 'Cyberbezpieczeństwo produktów', probability: 'Średnia', impact: 'Krytyczny', mitigation: 'Security by design, regularne audyty, incident response plan' },
            { name: 'Kanibalizacja tradycyjnych produktów', probability: 'Średnia', impact: 'Średni', mitigation: 'Strategia portfolio, premium positioning fizycznych produktów' },
            { name: 'Complexity produktowa', probability: 'Wysoka', impact: 'Średni', mitigation: 'Modular architecture, clear product roadmap' },
            { name: 'Zależność od technologii', probability: 'Średnia', impact: 'Wysoki', mitigation: 'Multi-vendor strategy, in-house capabilities' }
        ],
        leaderPractices: [
            'Tesla - OTA updates transformujące fizyczny produkt w software-defined vehicle',
            'Peloton - hardware + content subscription model z community features',
            'John Deere - precision agriculture platform z data-driven services',
            'Philips - "health tech" transformation z connected medical devices'
        ]
    },
    businessModels: {
        currentStateDescriptions: {
            1: 'Tradycyjny model sprzedaży produktów/usług bez innowacji cyfrowej. Główne źródło przychodów to jednorazowa sprzedaż. Brak recurring revenue. Model biznesowy nie zmienił się od lat.',
            2: 'Pierwsze eksperymenty z cyfrowymi modelami - np. basic online store, prosta subskrypcja. Cyfrowe kanały stanowią marginalną część przychodów. Organizacja rozpoznaje potrzebę zmian.',
            3: 'Funkcjonują hybrydowe modele biznesowe - product + service, częściowa subskrypcja. Wyraźny stream przychodów cyfrowych. Dane klientów wykorzystywane do upsellingu. Partnerstwa z firmami technologicznymi.',
            4: 'Platform business model lub znaczący komponent platformowy. Monetyzacja danych. Ekosystem partnerów generujący wartość. Freemium/premium modele. Recurring revenue stanowi znaczącą część.',
            5: 'Organizacja działa jako platforma/ekosystem. Network effects napędzają wzrost. Data-as-a-Service lub AI-as-a-Service w ofercie. Model skalowalny globalnie z wysoką marżą.'
        },
        transformationPath: [
            { from: 1, to: 2, actions: ['Analiza możliwości cyfryzacji modelu', 'Pilot subskrypcji/SaaS', 'E-commerce launch', 'Customer journey mapping'], timeline: '3-6 miesięcy', investment: '50-150 tys. PLN' },
            { from: 2, to: 3, actions: ['Product-as-a-Service pilotaż', 'Loyalty/membership program', 'Partnerstwa technologiczne', 'Data monetization strategy'], timeline: '6-12 miesięcy', investment: '200-400 tys. PLN' },
            { from: 3, to: 4, actions: ['Platform MVP launch', 'Partner ecosystem development', 'Freemium model implementation', 'API monetization'], timeline: '12-18 miesięcy', investment: '500 tys. - 1.5 mln PLN' },
            { from: 4, to: 5, actions: ['Scale platform', 'AI/ML-based services', 'Global expansion', 'M&A for ecosystem growth'], timeline: '18-36 miesięcy', investment: '2-10 mln PLN' }
        ],
        kpis: [
            { name: 'Recurring Revenue Ratio', target: '>40%', description: 'Udział przychodów powtarzalnych' },
            { name: 'Customer Lifetime Value', target: '+100%', description: 'Wzrost wartości życiowej klienta' },
            { name: 'Platform GMV', target: 'Zdefiniować baseline', description: 'Gross Merchandise Value platformy' },
            { name: 'Partner Ecosystem Size', target: '>50 partnerów', description: 'Liczba aktywnych partnerów ekosystemu' },
            { name: 'Unit Economics', target: 'CAC/LTV <1:3', description: 'Stosunek kosztu akwizycji do wartości klienta' }
        ],
        risks: [
            { name: 'Disruptive konkurencja', probability: 'Wysoka', impact: 'Krytyczny', mitigation: 'Continuous innovation, monitoring startupów, corporate VC' },
            { name: 'Regulacje', probability: 'Średnia', impact: 'Wysoki', mitigation: 'Compliance by design, lobby, elastyczna architektura' },
            { name: 'Platform lock-in', probability: 'Niska', impact: 'Średni', mitigation: 'Open standards, multi-platform strategy' },
            { name: 'Margin pressure', probability: 'Wysoka', impact: 'Średni', mitigation: 'Premium positioning, cost leadership, network effects' }
        ],
        leaderPractices: [
            'Netflix - od DVD rental do global streaming platform z original content',
            'Rolls-Royce - Power-by-the-Hour model dla silników lotniczych',
            'Spotify - two-sided platform z freemium model i creator economy',
            'Adobe - from packaged software do Creative Cloud subscription'
        ]
    },
    dataManagement: {
        currentStateDescriptions: {
            1: 'Dane rozproszone w silosach (Excel, lokalne bazy). Brak centralnego repozytorium. Ręczne raportowanie czasochłonne i podatne na błędy. Brak polityki data governance. Decyzje podejmowane intuicyjnie.',
            2: 'Istnieją lokalne bazy danych i podstawowe narzędzia BI. Raporty generowane cyklicznie, ale z opóźnieniem. Początkowe próby standaryzacji danych. Świadomość wartości danych rośnie.',
            3: 'Centralne repozytorium danych (data warehouse) dla kluczowych obszarów. Dashboardy i regularne raportowanie. Podstawowa polityka data governance. Self-service analytics dla power users.',
            4: 'Data lake/lakehouse z advanced analytics. Real-time dashboardy. Data quality management. Demokratyzacja danych - dostęp dla wszystkich działów. Początkowe wykorzystanie ML.',
            5: 'Advanced ML/AI w produkcji. Predykcyjna analityka napędza decyzje. Data products generują wartość. DataOps i MLOps. Kultura data-driven na wszystkich poziomach.',
            6: 'Enterprise data platform z pełną integracją. Master Data Management. 360° view klienta i operacji. Real-time decisioning. Data monetization.',
            7: 'AI-first organization. Augmented analytics. Prescriptive insights. Autonomous data management. Cognitive automation. Organizacja jako data-driven enterprise.'
        },
        transformationPath: [
            { from: 1, to: 2, actions: ['Konsolidacja źródeł danych', 'Wdrożenie podstawowego BI', 'Data audit', 'Szkolenia z data literacy'], timeline: '2-4 miesiące', investment: '50-100 tys. PLN' },
            { from: 2, to: 3, actions: ['Budowa data warehouse', 'Data governance framework', 'Self-service BI', 'Data quality baseline'], timeline: '4-8 miesięcy', investment: '150-300 tys. PLN' },
            { from: 3, to: 4, actions: ['Data lake implementation', 'Advanced analytics platform', 'ML pilot projects', 'Data democratization'], timeline: '6-12 miesięcy', investment: '300-600 tys. PLN' },
            { from: 4, to: 5, actions: ['MLOps platform', 'Productionizing ML models', 'Data products development', 'Culture transformation'], timeline: '12-18 miesięcy', investment: '500 tys. - 1 mln PLN' },
            { from: 5, to: 6, actions: ['Enterprise data platform', 'MDM implementation', 'Real-time decisioning', 'Data monetization strategy'], timeline: '12-24 miesiące', investment: '1-3 mln PLN' },
            { from: 6, to: 7, actions: ['AI Center of Excellence', 'Autonomous analytics', 'Cognitive automation', 'AI governance'], timeline: '18-36 miesięcy', investment: '2-5 mln PLN' }
        ],
        kpis: [
            { name: 'Data Quality Score', target: '>95%', description: 'Kompletność, dokładność, aktualność danych' },
            { name: 'Analytics Adoption', target: '>80%', description: 'Pracownicy regularnie używający analytics tools' },
            { name: 'Time-to-Insight', target: '<24h', description: 'Czas od pytania do odpowiedzi analitycznej' },
            { name: 'ML Models in Production', target: '>10', description: 'Liczba modeli ML w produkcji' },
            { name: 'Data-driven Decisions', target: '>70%', description: 'Decyzje poparte analizą danych' }
        ],
        risks: [
            { name: 'Data privacy/GDPR', probability: 'Wysoka', impact: 'Krytyczny', mitigation: 'Privacy by design, DPO, regularne audyty' },
            { name: 'Data silos powrót', probability: 'Średnia', impact: 'Średni', mitigation: 'Governance enforcement, incentives, architektura' },
            { name: 'Talent gap', probability: 'Wysoka', impact: 'Wysoki', mitigation: 'Training, hiring, partnerships z uniwersytetami' },
            { name: 'Technology obsolescence', probability: 'Średnia', impact: 'Średni', mitigation: 'Cloud-native, vendor-agnostic, continuous modernization' }
        ],
        leaderPractices: [
            'Google - BigQuery i Looker jako self-service analytics platform',
            'Netflix - data-driven content decisions z ML recommendation engine',
            'Capital One - cloud-first data platform z real-time fraud detection',
            'Spotify - Discover Weekly jako przykład personalizacji opartej na danych'
        ]
    },
    culture: {
        currentStateDescriptions: {
            1: 'Kultura odporna na zmiany. Hierarchiczna struktura blokuje innowacje. Strach przed błędami. Brak zachęt do eksperymentowania. Digital skills bardzo niskie. Transformacja postrzegana jako zagrożenie.',
            2: 'Świadomość potrzeby zmian rośnie. Pojedyncze inicjatywy digitalizacji. Liderzy zaczynają promować cyfryzację. Podstawowe szkolenia digital skills. Opór wciąż znaczący.',
            3: 'Digital agenda jest częścią strategii. Dedykowany zespół transformation. Programy upskilling/reskilling. Kultura eksperymentowania w wybranych obszarach. Mierzenie progress transformacji.',
            4: 'Agile ways of working w większości organizacji. Innowacja jest nagradzana. Fail-fast culture. Wysoki poziom digital literacy. Cross-functional collaboration. Employee experience digital.',
            5: 'Organizacja jest cyfrowo natywna. Continuous learning culture. Innovation jest DNA firmy. Talent magnet dla digital specialists. Employer branding jako tech company.'
        },
        transformationPath: [
            { from: 1, to: 2, actions: ['Komunikacja vision transformacji', 'Quick wins dla budowy momentum', 'Digital champions program', 'Basic digital training'], timeline: '3-6 miesięcy', investment: '30-80 tys. PLN' },
            { from: 2, to: 3, actions: ['Transformation Office setup', 'Comprehensive upskilling program', 'Innovation pilots', 'Change management program'], timeline: '6-12 miesięcy', investment: '150-300 tys. PLN' },
            { from: 3, to: 4, actions: ['Agile transformation', 'Innovation lab/hub', 'Performance metrics update', 'Digital employee experience'], timeline: '12-18 miesięcy', investment: '300-600 tys. PLN' },
            { from: 4, to: 5, actions: ['Continuous learning platform', 'Employer branding refresh', 'Advanced leadership development', 'Culture reinforcement'], timeline: '18-36 miesięcy', investment: '500 tys. - 1 mln PLN' }
        ],
        kpis: [
            { name: 'Digital Skills Index', target: '>4/5', description: 'Średni poziom kompetencji cyfrowych' },
            { name: 'eNPS (Employee Net Promoter Score)', target: '>30', description: 'Satysfakcja i zaangażowanie pracowników' },
            { name: 'Innovation Ideas per Employee', target: '>2/rok', description: 'Aktywność innowacyjna pracowników' },
            { name: 'Training Hours Digital', target: '>40h/rok', description: 'Godziny szkoleń cyfrowych na pracownika' },
            { name: 'Internal Mobility Rate', target: '>15%', description: 'Mobilność wewnętrzna i rozwój talentów' }
        ],
        risks: [
            { name: 'Change fatigue', probability: 'Wysoka', impact: 'Średni', mitigation: 'Pacing transformacji, celebrate wins, wellbeing programs' },
            { name: 'Talent attrition', probability: 'Średnia', impact: 'Wysoki', mitigation: 'Competitive compensation, growth opportunities, culture' },
            { name: 'Middle management resistance', probability: 'Wysoka', impact: 'Wysoki', mitigation: 'Dedykowane programy dla managerów, jasne oczekiwania' },
            { name: 'Skill gap permanentny', probability: 'Średnia', impact: 'Średni', mitigation: 'Continuous learning, external hiring, partnerships' }
        ],
        leaderPractices: [
            'Microsoft - Growth Mindset culture transformation pod Satya Nadella',
            'ING - Agile transformation całej organizacji (15,000+ pracowników)',
            'Spotify - Squad model jako przykład autonomous teams',
            'Google - 20% time i psychological safety jako enablers innowacji'
        ]
    },
    cybersecurity: {
        currentStateDescriptions: {
            1: 'Podstawowe zabezpieczenia (antywirus, firewall). Brak formalnej polityki bezpieczeństwa. Szkolenia sporadyczne. Incident response ad-hoc. Wysokie ryzyko naruszeń.',
            2: 'Istnieje podstawowa polityka bezpieczeństwa. Regularne szkolenia awareness. Backup i disaster recovery zdefiniowane. Monitoring security events. Compliance z podstawowymi wymogami.',
            3: 'Security Operations Center (wewnętrzny lub outsource). Identity and Access Management. Vulnerability management program. Incident response plan przetestowany. Regularne audyty.',
            4: 'Zero Trust Architecture implementowane. Advanced threat protection. Security automation (SOAR). Cloud security posture management. Security jest wbudowane w procesy (DevSecOps).',
            5: 'Cyber resilience na poziomie enterprise. AI-powered threat detection. Proactive threat hunting. Security as enabler biznesu. Continuous compliance. Organizacja jest benchmarkiem dla branży.'
        },
        transformationPath: [
            { from: 1, to: 2, actions: ['Security policy development', 'Awareness training program', 'Backup & DR implementation', 'Basic monitoring'], timeline: '2-4 miesiące', investment: '50-100 tys. PLN' },
            { from: 2, to: 3, actions: ['SOC setup/outsource', 'IAM implementation', 'Vulnerability scanning program', 'Incident response exercises'], timeline: '4-8 miesięcy', investment: '150-300 tys. PLN' },
            { from: 3, to: 4, actions: ['Zero Trust roadmap', 'Advanced security tools', 'DevSecOps integration', 'Cloud security'], timeline: '8-14 miesięcy', investment: '300-600 tys. PLN' },
            { from: 4, to: 5, actions: ['AI/ML for security', 'Threat hunting capability', 'Cyber resilience program', 'Security innovation'], timeline: '12-24 miesiące', investment: '500 tys. - 1.5 mln PLN' }
        ],
        kpis: [
            { name: 'Mean Time to Detect (MTTD)', target: '<24h', description: 'Średni czas wykrycia incydentu' },
            { name: 'Mean Time to Respond (MTTR)', target: '<4h', description: 'Średni czas reakcji na incydent' },
            { name: 'Phishing Click Rate', target: '<5%', description: 'Skuteczność testów phishingowych' },
            { name: 'Vulnerability Remediation Time', target: '<30 dni', description: 'Czas naprawy podatności krytycznych' },
            { name: 'Security Training Completion', target: '100%', description: 'Ukończenie obowiązkowych szkoleń' }
        ],
        risks: [
            { name: 'Ransomware attack', probability: 'Średnia', impact: 'Krytyczny', mitigation: 'Backup strategy, endpoint protection, user training' },
            { name: 'Data breach', probability: 'Średnia', impact: 'Krytyczny', mitigation: 'DLP, encryption, access controls, monitoring' },
            { name: 'Supply chain attack', probability: 'Niska', impact: 'Wysoki', mitigation: 'Vendor assessment, SBOM, zero trust' },
            { name: 'Insider threat', probability: 'Niska', impact: 'Wysoki', mitigation: 'UEBA, privileged access management, culture' }
        ],
        leaderPractices: [
            'Microsoft - Security by Design z $1B+ rocznych inwestycji w cybersecurity',
            'Mastercard - AI-powered fraud detection przetwarzający miliardy transakcji',
            'CrowdStrike - Cloud-native security platform z real-time threat intelligence',
            'Banco Santander - CISO transformation z security as business enabler'
        ]
    },
    aiMaturity: {
        currentStateDescriptions: {
            1: 'Brak wykorzystania AI/ML. Organizacja może używać podstawowej analityki, ale bez elementów machine learning. Brak świadomości możliwości AI. Dane nie są przygotowane do ML.',
            2: 'Eksploracja możliwości AI. Pilotażowe projekty z wykorzystaniem gotowych narzędzi AI (np. ChatGPT). Pierwsze use cases zidentyfikowane. Brak dedykowanych kompetencji.',
            3: 'Funkcjonują produkcyjne rozwiązania AI w wybranych obszarach. Dedykowany zespół data science. AI governance podstawowe. ML models w produkcji. POC-to-production capability.',
            4: 'AI jest strategicznym priorytetem. MLOps platform. Multiple AI use cases w produkcji. AI augments human work. Center of Excellence. Responsible AI framework.',
            5: 'AI-first organization. AI embedded w core products/services. Autonomous AI systems. Leading edge capabilities (GenAI, foundation models). AI drives competitive advantage.'
        },
        transformationPath: [
            { from: 1, to: 2, actions: ['AI awareness workshops', 'Use case identification', 'Data readiness assessment', 'AI tools exploration'], timeline: '2-4 miesiące', investment: '30-80 tys. PLN' },
            { from: 2, to: 3, actions: ['Hire/train data scientists', 'First ML model to production', 'MLOps basics', 'AI governance framework'], timeline: '6-12 miesięcy', investment: '200-400 tys. PLN' },
            { from: 3, to: 4, actions: ['AI CoE establishment', 'MLOps platform', 'Scale AI use cases', 'Responsible AI implementation'], timeline: '12-18 miesięcy', investment: '500 tys. - 1 mln PLN' },
            { from: 4, to: 5, actions: ['AI product development', 'Foundation model exploration', 'AI-driven innovation', 'Autonomous systems'], timeline: '18-36 miesięcy', investment: '1-5 mln PLN' }
        ],
        kpis: [
            { name: 'AI Use Cases in Production', target: '>10', description: 'Liczba rozwiązań AI w produkcji' },
            { name: 'AI-Generated Revenue', target: '>10%', description: 'Przychody z produktów/usług AI' },
            { name: 'Model Accuracy', target: '>90%', description: 'Średnia skuteczność modeli ML' },
            { name: 'Time-to-Deploy Model', target: '<4 tygodnie', description: 'Czas od POC do produkcji' },
            { name: 'AI Talent Ratio', target: '>5%', description: 'Procent pracowników z AI skills' }
        ],
        risks: [
            { name: 'AI bias', probability: 'Średnia', impact: 'Wysoki', mitigation: 'Responsible AI framework, diverse data, audits' },
            { name: 'Model drift', probability: 'Wysoka', impact: 'Średni', mitigation: 'Monitoring, continuous training, MLOps' },
            { name: 'Regulatory compliance', probability: 'Średnia', impact: 'Wysoki', mitigation: 'AI Act preparation, documentation, explainability' },
            { name: 'Over-automation', probability: 'Niska', impact: 'Średni', mitigation: 'Human-in-the-loop, change management' }
        ],
        leaderPractices: [
            'OpenAI/Microsoft - Foundation models transformujące produktywność (GPT-4, Copilot)',
            'Google DeepMind - AlphaFold rewolucjonizuje drug discovery',
            'Tesla - Full Self-Driving jako przykład AI w core product',
            'JPMorgan - AI Contract Intelligence (COIN) automatyzujący przegląd umów'
        ]
    }
};

// Maturity level descriptions
const MATURITY_LEVELS = {
    7: {
        name: 'AI-Driven',
        namePl: 'Wsparcie AI',
        description: 'Pełna integracja sztucznej inteligencji, predykcyjne zarządzanie, autonomiczna optymalizacja',
        characteristics: [
            'Algorytmy AI wspierające decyzje w czasie rzeczywistym',
            'Predykcyjne modele dla kluczowych procesów',
            'Autonomiczna optymalizacja parametrów',
            'Machine learning w cyklu ciągłego doskonalenia'
        ]
    },
    6: {
        name: 'Enterprise Integration',
        namePl: 'Integracja ERP',
        description: 'Pełna integracja systemów klasy enterprise, single source of truth',
        characteristics: [
            'Zintegrowany system ERP obejmujący wszystkie procesy',
            'Jednolite źródło danych dla całej organizacji',
            'Automatyczny przepływ informacji między działami',
            'Zaawansowane dashboardy i raportowanie'
        ]
    },
    5: {
        name: 'MES/Advanced',
        namePl: 'Systemy MES',
        description: 'Systemy wykonawcze produkcji, real-time visibility, zaawansowana automatyzacja',
        characteristics: [
            'Systemy MES monitorujące produkcję w czasie rzeczywistym',
            'Pełna visibility łańcucha dostaw',
            'Zaawansowana automatyzacja workflow',
            'Integracja OT/IT'
        ]
    },
    4: {
        name: 'Automation',
        namePl: 'Automatyzacja',
        description: 'Automatyzacja powtarzalnych zadań, RPA, workflow automation',
        characteristics: [
            'Roboty programowe (RPA) dla powtarzalnych zadań',
            'Automatyczne workflow i eskalacje',
            'Digitalizacja dokumentów i obiegu',
            'Automatyczne raportowanie'
        ]
    },
    3: {
        name: 'Process Control',
        namePl: 'Kontrola Procesów',
        description: 'Zdefiniowane i monitorowane procesy, KPI, digital twins',
        characteristics: [
            'Zmapowane i zdefiniowane procesy',
            'Monitorowanie KPI procesowych',
            'Alertowanie o odchyleniach',
            'Podstawowe cyfrowe bliźniaki'
        ]
    },
    2: {
        name: 'Workstation Control',
        namePl: 'Kontrola Stanowisk',
        description: 'Cyfrowe narzędzia na stanowiskach pracy, lokalna digitalizacja',
        characteristics: [
            'Tablety/terminale na stanowiskach pracy',
            'Cyfrowe instrukcje i checklisty',
            'Lokalne bazy danych',
            'Podstawowa digitalizacja dokumentów'
        ]
    },
    1: {
        name: 'Data Registration',
        namePl: 'Rejestracja Danych',
        description: 'Podstawowe zbieranie danych, ręczne wprowadzanie, Excel-based',
        characteristics: [
            'Ręczne wprowadzanie danych',
            'Arkusze Excel jako główne narzędzie',
            'Fragmentaryczne dane',
            'Brak integracji systemów'
        ]
    }
};

/**
 * Enterprise Report Templates Class
 */
class EnterpriseReportTemplates {
    constructor() {
        this.axes = DRD_AXES;
        this.benchmarks = INDUSTRY_BENCHMARKS;
        this.maturityLevels = MATURITY_LEVELS;
    }

    /**
     * Generate professional cover page
     */
    generateCoverPage(assessment, isPolish = true) {
        const { organization_name, project_name } = assessment;
        const date = new Date().toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        return `
<div class="cover-page" style="text-align: center; padding: 60px 40px; min-height: 600px; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%); color: white; border-radius: 12px;">
    <div style="margin-bottom: 60px;">
        <div style="font-size: 14px; letter-spacing: 3px; opacity: 0.7; margin-bottom: 20px;">DIGITAL READINESS DIAGNOSIS</div>
        <h1 style="font-size: 42px; font-weight: 700; margin: 0 0 16px 0; background: linear-gradient(90deg, #60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            📊 ${isPolish ? 'Raport Diagnozy Gotowości Cyfrowej' : 'Digital Readiness Diagnosis Report'}
        </h1>
        <h2 style="font-size: 28px; font-weight: 500; color: #94a3b8; margin: 0;">
            ${project_name || organization_name || 'Assessment Report'}
        </h2>
    </div>
    
    <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 12px; margin: 40px 0;">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; text-align: left;">
            <div>
                <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">${isPolish ? 'Organizacja' : 'Organization'}</div>
                <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">${organization_name || '-'}</div>
            </div>
            <div>
                <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">${isPolish ? 'Projekt' : 'Project'}</div>
                <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">${project_name || '-'}</div>
            </div>
            <div>
                <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">${isPolish ? 'Data raportu' : 'Report Date'}</div>
                <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">${date}</div>
            </div>
            <div>
                <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">${isPolish ? 'Wersja' : 'Version'}</div>
                <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">1.0 Final</div>
            </div>
        </div>
    </div>
    
    <div style="margin-top: 60px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.2);">
        <p style="font-size: 13px; color: #94a3b8; margin: 0;">
            ${isPolish 
                ? 'Metodologia: Digital Readiness Diagnosis (DRD) zgodna ze standardem SIRI' 
                : 'Methodology: Digital Readiness Diagnosis (DRD) aligned with SIRI standard'}
        </p>
        <p style="font-size: 11px; color: #64748b; margin-top: 8px;">
            ${isPolish ? 'POUFNE - Wyłącznie do użytku wewnętrznego' : 'CONFIDENTIAL - For internal use only'}
        </p>
    </div>
</div>`;
    }

    /**
     * Generate executive summary with key insights
     */
    generateExecutiveSummary(assessment, isPolish = true) {
        const { axisData, organization_name, transformationContext } = assessment;
        const metrics = this.calculateMetrics(axisData);
        const insights = this.generateKeyInsights(axisData, isPolish);
        const industry = transformationContext?.industry || 'manufacturing';
        const industryBenchmark = this.benchmarks[industry] || this.benchmarks.manufacturing;

        return `
<div class="executive-summary">
    <h2>📋 ${isPolish ? 'Streszczenie Wykonawcze' : 'Executive Summary'}</h2>
    
    <div class="summary-intro" style="margin: 20px 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px;">
        <p style="font-size: 16px; margin: 0;">
            ${isPolish 
                ? `Niniejszy raport przedstawia kompleksową diagnozę gotowości cyfrowej organizacji <strong>${organization_name || 'Klient'}</strong>. Analiza obejmuje 7 kluczowych osi transformacji cyfrowej zgodnie z metodologią DRD, uwzględniając ponad 30 szczegółowych obszarów oceny.`
                : `This report presents a comprehensive digital readiness diagnosis for <strong>${organization_name || 'Client'}</strong>. The analysis covers 7 key digital transformation axes according to DRD methodology, including over 30 detailed assessment areas.`}
        </p>
    </div>

    <h3>🎯 ${isPolish ? 'Kluczowe Wskaźniki' : 'Key Metrics'}</h3>
    
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; text-align: center; border-left: 4px solid #3b82f6;">
            <div style="font-size: 32px; font-weight: 700; color: #3b82f6;">${metrics.averageActual}</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${isPolish ? 'Średni poziom aktualny' : 'Average Current Level'}</div>
            <div style="font-size: 11px; color: #94a3b8;">/ 7 max</div>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; text-align: center; border-left: 4px solid #10b981;">
            <div style="font-size: 32px; font-weight: 700; color: #10b981;">${metrics.averageTarget}</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${isPolish ? 'Średni poziom docelowy' : 'Average Target Level'}</div>
            <div style="font-size: 11px; color: #94a3b8;">/ 7 max</div>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; text-align: center; border-left: 4px solid #ef4444;">
            <div style="font-size: 32px; font-weight: 700; color: #ef4444;">${metrics.totalGapPoints}</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${isPolish ? 'Całkowita luka transformacyjna' : 'Total Transformation Gap'}</div>
            <div style="font-size: 11px; color: #94a3b8;">${isPolish ? 'punktów' : 'points'}</div>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; text-align: center; border-left: 4px solid #8b5cf6;">
            <div style="font-size: 32px; font-weight: 700; color: #8b5cf6;">${metrics.estimatedMonths}</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${isPolish ? 'Szacowany czas transformacji' : 'Estimated Transformation Time'}</div>
            <div style="font-size: 11px; color: #94a3b8;">${isPolish ? 'miesięcy' : 'months'}</div>
        </div>
    </div>

    <h3>💪 ${isPolish ? 'Mocna strona organizacji' : 'Organization Strength'}</h3>
    <div style="padding: 15px; background: #ecfdf5; border-radius: 4px; margin: 10px 0;">
        <strong>${insights.strongest.icon} ${insights.strongest.name}</strong> - ${isPolish ? 'poziom' : 'level'} ${insights.strongest.score}/7
        <p style="margin: 8px 0 0 0; color: #065f46;">${insights.strongest.analysis}</p>
    </div>

    <h3>⚠️ ${isPolish ? 'Obszar wymagający największej uwagi' : 'Area Requiring Most Attention'}</h3>
    <div style="padding: 15px; background: #fef2f2; border-radius: 4px; margin: 10px 0;">
        <strong>${insights.weakest.icon} ${insights.weakest.name}</strong> - ${isPolish ? 'poziom' : 'level'} ${insights.weakest.score}/7 (${isPolish ? 'cel' : 'target'}: ${insights.weakest.target})
        <p style="margin: 8px 0 0 0; color: #991b1b;">${insights.weakest.analysis}</p>
    </div>

    <h3>📈 ${isPolish ? 'Priorytetowe luki do zamknięcia' : 'Priority Gaps to Close'}</h3>
    <ul style="margin: 10px 0;">
        ${insights.priorityGaps.map(g => `
            <li><strong>${g.name}</strong>: ${isPolish ? 'luka' : 'gap'} ${g.gap} ${isPolish ? 'pkt' : 'pts'} (${g.actual} → ${g.target})</li>
        `).join('')}
    </ul>

    <h3>🏭 ${isPolish ? 'Porównanie z branżą' : 'Industry Comparison'}: ${isPolish ? industryBenchmark.namePl : industryBenchmark.name}</h3>
    <div style="margin: 20px 0;">
        ${this.generateIndustryComparisonTable(axisData, industryBenchmark, isPolish)}
    </div>

    <h3>💡 ${isPolish ? 'Rekomendacja Strategiczna' : 'Strategic Recommendation'}</h3>
    <div style="padding: 20px; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; font-size: 15px; line-height: 1.6;">
            ${this.generateStrategicRecommendation(metrics, insights, isPolish)}
        </p>
    </div>
</div>`;
    }

    /**
     * Generate detailed methodology section
     */
    generateMethodology(isPolish = true) {
        return `
<div class="methodology-section">
    <h2>📐 ${isPolish ? 'Metodologia DRD' : 'DRD Methodology'}</h2>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
        <p style="margin: 0; font-size: 15px; line-height: 1.7;">
            ${isPolish 
                ? `<strong>Digital Readiness Diagnosis (DRD)</strong> to kompleksowa metodologia oceny dojrzałości cyfrowej organizacji, opracowana w oparciu o wieloletnie doświadczenie w realizacji projektów transformacji cyfrowej oraz najlepsze światowe praktyki, w tym standard <strong>SIRI</strong> (Smart Industry Readiness Index) opracowany przez Singapore Economic Development Board. DRD dostosowuje te globalne standardy do specyfiki polskiego i europejskiego rynku.`
                : `<strong>Digital Readiness Diagnosis (DRD)</strong> is a comprehensive methodology for assessing organizational digital maturity, developed based on years of experience in digital transformation projects and global best practices, including the <strong>SIRI</strong> (Smart Industry Readiness Index) standard developed by Singapore Economic Development Board.`}
        </p>
    </div>

    <h3>${isPolish ? '7 Osi Transformacji Cyfrowej' : '7 Axes of Digital Transformation'}</h3>
    
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0;">
        ${Object.values(DRD_AXES).map(axis => `
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; border-left: 4px solid ${axis.color};">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span style="font-size: 20px;">${axis.icon}</span>
                    <strong>${isPolish ? axis.namePl : axis.name}</strong>
                    <span style="margin-left: auto; font-size: 12px; color: #64748b;">1-${axis.maxLevel}</span>
                </div>
                <p style="margin: 0; font-size: 13px; color: #64748b;">${axis.description}</p>
            </div>
        `).join('')}
    </div>

    <h3>${isPolish ? 'Macierz Poziomów Dojrzałości' : 'Maturity Level Matrix'}</h3>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
        <thead>
            <tr style="background: #1e1b4b; color: white;">
                <th style="padding: 12px; text-align: left; border: 1px solid #374151;">${isPolish ? 'Poziom' : 'Level'}</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #374151;">${isPolish ? 'Nazwa' : 'Name'}</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #374151;">${isPolish ? 'Charakterystyka' : 'Characteristics'}</th>
            </tr>
        </thead>
        <tbody>
            ${[7, 6, 5, 4, 3, 2, 1].map(level => {
                const lvl = MATURITY_LEVELS[level];
                return `
                    <tr style="background: ${level % 2 === 0 ? '#f8f9fa' : 'white'};">
                        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 700; color: ${this.getLevelColor(level)};">${level}</td>
                        <td style="padding: 12px; border: 1px solid #e5e7eb;"><strong>${isPolish ? lvl.namePl : lvl.name}</strong></td>
                        <td style="padding: 12px; border: 1px solid #e5e7eb;">
                            <div style="margin-bottom: 4px;">${lvl.description}</div>
                            <ul style="margin: 8px 0 0 0; padding-left: 16px; color: #64748b; font-size: 12px;">
                                ${lvl.characteristics.slice(0, 2).map(c => `<li>${c}</li>`).join('')}
                            </ul>
                        </td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    </table>

    <h3>${isPolish ? 'Filozofia Oceny' : 'Assessment Philosophy'}</h3>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0;">
        <div style="padding: 16px; background: #fef3c7; border-radius: 8px;">
            <strong>🎯 ${isPolish ? 'Zasada ostrożności' : 'Prudence Principle'}</strong>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #92400e;">${isPolish ? 'W razie wątpliwości wybierz niższy poziom. Lepiej niedoszacować i pozytywnie zaskoczyć niż przeszacować i rozczarować.' : 'When in doubt, choose the lower level. Better to underestimate and positively surprise than overestimate and disappoint.'}</p>
        </div>
        <div style="padding: 16px; background: #dbeafe; border-radius: 8px;">
            <strong>📝 ${isPolish ? 'Dowody i fakty' : 'Evidence-Based'}</strong>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #1e40af;">${isPolish ? 'Każda ocena musi być poparta konkretnymi dowodami: dokumentami, systemami, wywiadami. Brak dowodu = niższy poziom.' : 'Each assessment must be supported by concrete evidence: documents, systems, interviews. No evidence = lower level.'}</p>
        </div>
        <div style="padding: 16px; background: #d1fae5; border-radius: 8px;">
            <strong>🔄 ${isPolish ? 'Cykliczność' : 'Cyclical Review'}</strong>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #065f46;">${isPolish ? 'Audyt DRD powinien być przeprowadzany co 6-12 miesięcy dla śledzenia postępów transformacji.' : 'DRD audit should be conducted every 6-12 months to track transformation progress.'}</p>
        </div>
    </div>

    <h3>${isPolish ? 'Benchmarki Branżowe' : 'Industry Benchmarks'}</h3>
    <p style="color: #64748b; margin-bottom: 16px;">
        ${isPolish 
            ? 'Poniższa tabela przedstawia typowe poziomy dojrzałości dla różnych branż, oparte na badaniach ponad 200 organizacji:'
            : 'The table below shows typical maturity levels for different industries, based on research of over 200 organizations:'}
    </p>
    
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
            <tr style="background: #1e1b4b; color: white;">
                <th style="padding: 10px; border: 1px solid #374151;">${isPolish ? 'Branża' : 'Industry'}</th>
                ${Object.values(DRD_AXES).map(a => `<th style="padding: 10px; border: 1px solid #374151;">${a.icon}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${Object.entries(INDUSTRY_BENCHMARKS).map(([key, ind]) => `
                <tr style="background: white;">
                    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 500;">${isPolish ? ind.namePl : ind.name}</td>
                    ${Object.keys(DRD_AXES).map(axisKey => `
                        <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center; background: ${this.getHeatmapColor(ind[axisKey], DRD_AXES[axisKey].maxLevel)};">
                            ${ind[axisKey].toFixed(1)}
                        </td>
                    `).join('')}
                </tr>
            `).join('')}
        </tbody>
    </table>
</div>`;
    }

    /**
     * Generate axis detail with comprehensive BCG/McKinsey-style analysis
     */
    generateAxisDetail(axisId, assessment, isPolish = true) {
        const { axisData, transformationContext } = assessment;
        const axisConfig = DRD_AXES[axisId];
        const axis = axisData[axisId] || {};
        const axisContent = AXIS_DETAILED_CONTENT[axisId];
        
        if (!axisConfig) {
            return `<h2>Unknown Axis</h2><p>No data available</p>`;
        }

        const actual = axis.actual || 4;
        const target = axis.target || 6;
        const gap = target - actual;
        const currentLevel = MATURITY_LEVELS[actual] || MATURITY_LEVELS[1];
        const targetLevel = MATURITY_LEVELS[target] || MATURITY_LEVELS[actual + 1];
        const industry = transformationContext?.industry || 'manufacturing';
        const industryBenchmark = INDUSTRY_BENCHMARKS[industry]?.[axisId] || 3;
        const benchmarks = axisConfig.benchmarks || { leader: 4.5, average: 3.0, laggard: 1.5 };

        const positionVsBenchmark = actual >= industryBenchmark + 0.5 ? 'above' : actual <= industryBenchmark - 0.5 ? 'below' : 'at';
        const currentStateDescription = axisContent?.currentStateDescriptions?.[actual] || 'Opis stanu aktualnego do uzupełnienia.';
        
        // Find relevant transformation path
        const transformationStep = axisContent?.transformationPath?.find(step => step.from === actual) || 
                                   axisContent?.transformationPath?.[0] || 
                                   { actions: [], timeline: 'Do ustalenia', investment: 'Do oszacowania' };

        return `
<div class="axis-detail enterprise-section" style="page-break-before: always;">
    <!-- Section Header -->
    <div class="section-header" style="margin-bottom: 32px;">
        <h2 style="font-size: 28px; font-weight: 700; margin: 0; color: #1e293b;">
            ${axisConfig.icon} ${isPolish ? axisConfig.namePl : axisConfig.name}
        </h2>
        <p style="color: #64748b; font-size: 16px; margin-top: 8px; line-height: 1.6;">
            ${axisConfig.description}
        </p>
    </div>

    <!-- Key Takeaways Box -->
    <div class="key-takeaways" style="background: linear-gradient(135deg, #1e1b4b, #312e81); color: white; padding: 24px; border-radius: 16px; margin-bottom: 32px;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; display: flex; align-items: center; gap: 8px;">
            💡 ${isPolish ? 'Kluczowe wnioski' : 'Key Takeaways'}
        </h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div style="text-align: center;">
                <div style="font-size: 14px; opacity: 0.8; margin-bottom: 4px;">${isPolish ? 'Pozycja vs. Branża' : 'vs. Industry'}</div>
                <div style="font-size: 24px; font-weight: 700; color: ${positionVsBenchmark === 'above' ? '#4ade80' : positionVsBenchmark === 'below' ? '#f87171' : '#fbbf24'};">
                    ${positionVsBenchmark === 'above' ? '↑ ' + (isPolish ? 'Powyżej' : 'Above') : positionVsBenchmark === 'below' ? '↓ ' + (isPolish ? 'Poniżej' : 'Below') : '→ ' + (isPolish ? 'Średnia' : 'Average')}
                </div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 14px; opacity: 0.8; margin-bottom: 4px;">${isPolish ? 'Luka do zamknięcia' : 'Gap to Close'}</div>
                <div style="font-size: 24px; font-weight: 700;">+${gap} ${isPolish ? 'poziomów' : 'levels'}</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 14px; opacity: 0.8; margin-bottom: 4px;">${isPolish ? 'Priorytet' : 'Priority'}</div>
                <div style="font-size: 24px; font-weight: 700; color: ${gap > 2 ? '#f87171' : gap > 0 ? '#fbbf24' : '#4ade80'};">
                    ${gap > 2 ? '🔴 ' + (isPolish ? 'Wysoki' : 'High') : gap > 0 ? '🟡 ' + (isPolish ? 'Średni' : 'Medium') : '🟢 ' + (isPolish ? 'Niski' : 'Low')}
                </div>
            </div>
        </div>
    </div>

    <!-- Score Cards -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 32px;">
        <div style="background: linear-gradient(135deg, ${axisConfig.color}15, ${axisConfig.color}05); padding: 24px; border-radius: 16px; text-align: center; border: 2px solid ${axisConfig.color};">
            <div style="font-size: 56px; font-weight: 800; color: ${axisConfig.color}; line-height: 1;">${actual}</div>
            <div style="font-size: 14px; color: #64748b; font-weight: 600; margin-top: 8px;">${isPolish ? 'Stan aktualny' : 'Current State'}</div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">/ ${axisConfig.maxLevel} max</div>
            <div style="margin-top: 12px; padding: 8px 12px; background: ${axisConfig.color}20; border-radius: 8px;">
                <span style="font-size: 12px; font-weight: 600; color: ${axisConfig.color};">${isPolish ? currentLevel.namePl : currentLevel.name}</span>
            </div>
        </div>
        <div style="background: linear-gradient(135deg, #10b98115, #10b98105); padding: 24px; border-radius: 16px; text-align: center; border: 2px solid #10b981;">
            <div style="font-size: 56px; font-weight: 800; color: #10b981; line-height: 1;">${target}</div>
            <div style="font-size: 14px; color: #64748b; font-weight: 600; margin-top: 8px;">${isPolish ? 'Cel docelowy' : 'Target State'}</div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">/ ${axisConfig.maxLevel} max</div>
            <div style="margin-top: 12px; padding: 8px 12px; background: #10b98120; border-radius: 8px;">
                <span style="font-size: 12px; font-weight: 600; color: #10b981;">${targetLevel ? (isPolish ? targetLevel.namePl : targetLevel.name) : '-'}</span>
            </div>
        </div>
        <div style="background: linear-gradient(135deg, ${gap > 2 ? '#ef444415' : gap > 0 ? '#f59e0b15' : '#10b98115'}, transparent); padding: 24px; border-radius: 16px; text-align: center; border: 2px solid ${gap > 2 ? '#ef4444' : gap > 0 ? '#f59e0b' : '#10b981'};">
            <div style="font-size: 56px; font-weight: 800; color: ${gap > 2 ? '#ef4444' : gap > 0 ? '#f59e0b' : '#10b981'}; line-height: 1;">+${gap}</div>
            <div style="font-size: 14px; color: #64748b; font-weight: 600; margin-top: 8px;">${isPolish ? 'Luka transformacyjna' : 'Transformation Gap'}</div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">${isPolish ? 'poziomów' : 'levels'}</div>
            <div style="margin-top: 12px; padding: 8px 12px; background: ${gap > 2 ? '#ef444420' : gap > 0 ? '#f59e0b20' : '#10b98120'}; border-radius: 8px;">
                <span style="font-size: 12px; font-weight: 600; color: ${gap > 2 ? '#ef4444' : gap > 0 ? '#f59e0b' : '#10b981'};">
                    ${gap > 2 ? (isPolish ? 'Wysoki priorytet' : 'High Priority') : gap > 0 ? (isPolish ? 'Średni priorytet' : 'Medium Priority') : (isPolish ? 'Cel osiągnięty' : 'Target Achieved')}
                </span>
            </div>
        </div>
    </div>

    <!-- Current State Analysis -->
    <div class="analysis-section" style="margin-bottom: 32px;">
        <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            📋 ${isPolish ? 'Diagnoza stanu aktualnego' : 'Current State Diagnosis'}
        </h3>
        <div style="padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid ${axisConfig.color};">
            <p style="margin: 0; line-height: 1.8; color: #334155; font-size: 15px;">
                ${currentStateDescription}
            </p>
        </div>
        
        <!-- Current Level Characteristics -->
        <div style="margin-top: 20px;">
            <h4 style="font-size: 16px; font-weight: 600; color: #475569; margin-bottom: 12px;">
                ${isPolish ? 'Charakterystyki poziomu' : 'Level Characteristics'} ${actual} (${isPolish ? currentLevel.namePl : currentLevel.name}):
            </h4>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                ${(currentLevel.characteristics || []).map(char => `
                    <div style="display: flex; align-items: flex-start; gap: 8px; padding: 12px; background: white; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <span style="color: ${axisConfig.color}; font-size: 16px;">✓</span>
                        <span style="font-size: 14px; color: #475569; line-height: 1.5;">${char}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>

    <!-- Expert Assessment -->
    ${axis.justification ? `
    <div class="expert-section" style="margin-bottom: 32px;">
        <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            📝 ${isPolish ? 'Ocena eksperta (z wywiadów)' : 'Expert Assessment (from interviews)'}
        </h3>
        <div style="padding: 20px; background: linear-gradient(135deg, #fef3c720, #fef3c710); border-radius: 12px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; line-height: 1.8; color: #334155; font-size: 15px; font-style: italic;">
                "${axis.justification}"
            </p>
        </div>
    </div>
    ` : ''}

    <!-- Industry Benchmark Section -->
    <div class="benchmark-section" style="margin-bottom: 32px;">
        <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            🏭 ${isPolish ? 'Pozycja względem branży' : 'Industry Position'}
        </h3>
        
        <!-- Benchmark Visualization -->
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
            ${this.generateAxisBenchmarkVisualization(actual, target, industryBenchmark, axisConfig, isPolish)}
            
            <!-- Benchmark Legend -->
            <div style="display: flex; justify-content: space-between; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <div style="text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${benchmarks.laggard}</div>
                    <div style="font-size: 12px; color: #64748b;">${isPolish ? 'Laggardzi' : 'Laggards'}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">${industryBenchmark.toFixed(1)}</div>
                    <div style="font-size: 12px; color: #64748b;">${isPolish ? 'Średnia branżowa' : 'Industry Average'}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: #10b981;">${benchmarks.leader}</div>
                    <div style="font-size: 12px; color: #64748b;">${isPolish ? 'Liderzy' : 'Leaders'}</div>
                </div>
            </div>
        </div>

        <div style="padding: 16px; background: ${positionVsBenchmark === 'above' ? '#f0fdf4' : positionVsBenchmark === 'below' ? '#fef2f2' : '#fffbeb'}; border-radius: 8px;">
            <p style="margin: 0; font-size: 15px; color: #334155; line-height: 1.6;">
                ${positionVsBenchmark === 'above' 
                    ? (isPolish ? `<strong>✅ Organizacja jest powyżej średniej branżowej</strong> (${industryBenchmark.toFixed(1)}). To stanowi przewagę konkurencyjną, którą należy utrzymać i wykorzystać. Rekomendujemy dzielenie się best practices oraz dalszą innowację.` : `<strong>✅ Organization is above industry average</strong> (${industryBenchmark.toFixed(1)}). This is a competitive advantage to maintain and leverage.`)
                    : positionVsBenchmark === 'below'
                    ? (isPolish ? `<strong>⚠️ Organizacja jest poniżej średniej branżowej</strong> (${industryBenchmark.toFixed(1)}). Wymaga to priorytetowych działań, aby nie stracić pozycji konkurencyjnej. Liderzy branży osiągają poziom ${benchmarks.leader}.` : `<strong>⚠️ Organization is below industry average</strong> (${industryBenchmark.toFixed(1)}). Priority actions required.`)
                    : (isPolish ? `<strong>📊 Organizacja jest na poziomie średniej branżowej</strong> (${industryBenchmark.toFixed(1)}). To solidna pozycja, ale wyróżnienie się wymaga przekroczenia tego poziomu. Liderzy osiągają ${benchmarks.leader}.` : `<strong>📊 Organization is at industry average</strong> (${industryBenchmark.toFixed(1)}).`)}
            </p>
        </div>
    </div>

    <!-- Progress Visualization -->
    <div class="progress-section" style="margin-bottom: 32px;">
        <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            📊 ${isPolish ? 'Ścieżka transformacji' : 'Transformation Path'}
        </h3>
        ${this.generateProgressBar(actual, target, axisConfig.maxLevel, axisConfig.color)}
        
        ${gap > 0 ? `
        <!-- Transformation Step Details -->
        <div style="margin-top: 24px; padding: 20px; background: linear-gradient(135deg, #eff6ff, #dbeafe); border-radius: 12px;">
            <div style="font-weight: 600; color: #1e40af; margin-bottom: 12px;">
                📍 ${isPolish ? `Następny krok: Poziom ${actual} → ${Math.min(actual + 1, target)}` : `Next Step: Level ${actual} → ${Math.min(actual + 1, target)}`}
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px;">
                <div style="padding: 12px; background: white; border-radius: 8px;">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">⏱️ ${isPolish ? 'Szacowany czas' : 'Estimated Time'}</div>
                    <div style="font-weight: 600; color: #1e293b;">${transformationStep.timeline}</div>
                </div>
                <div style="padding: 12px; background: white; border-radius: 8px;">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">💰 ${isPolish ? 'Szacowana inwestycja' : 'Estimated Investment'}</div>
                    <div style="font-weight: 600; color: #1e293b;">${transformationStep.investment}</div>
                </div>
            </div>
            <div style="font-size: 14px; color: #475569;">
                <strong>${isPolish ? 'Kluczowe działania:' : 'Key Actions:'}</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                    ${transformationStep.actions.map(action => `<li style="margin-bottom: 4px;">${action}</li>`).join('')}
                </ul>
            </div>
        </div>
        ` : ''}
    </div>

    <!-- KPIs Section -->
    ${axisContent?.kpis && axisContent.kpis.length > 0 ? `
    <div class="kpi-section" style="margin-bottom: 32px;">
        <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            🎯 ${isPolish ? 'Kluczowe wskaźniki (KPI) do monitorowania' : 'Key Performance Indicators'}
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            ${axisContent.kpis.map((kpi, index) => `
                <div style="padding: 16px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <span style="font-weight: 600; color: #1e293b; font-size: 14px;">${kpi.name}</span>
                        <span style="padding: 4px 10px; background: ${axisConfig.color}15; color: ${axisConfig.color}; border-radius: 20px; font-size: 13px; font-weight: 600;">${kpi.target}</span>
                    </div>
                    <span style="font-size: 13px; color: #64748b; line-height: 1.5;">${kpi.description}</span>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}

    <!-- Risks Section -->
    ${axisContent?.risks && axisContent.risks.length > 0 ? `
    <div class="risks-section" style="margin-bottom: 32px;">
        <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            ⚠️ ${isPolish ? 'Ryzyka i bariery transformacji' : 'Transformation Risks and Barriers'}
        </h3>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
                <tr style="background: #f1f5f9;">
                    <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${isPolish ? 'Ryzyko' : 'Risk'}</th>
                    <th style="padding: 14px 16px; text-align: center; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${isPolish ? 'Prawdopodobieństwo' : 'Probability'}</th>
                    <th style="padding: 14px 16px; text-align: center; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${isPolish ? 'Wpływ' : 'Impact'}</th>
                    <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${isPolish ? 'Mitygacja' : 'Mitigation'}</th>
                </tr>
            </thead>
            <tbody>
                ${axisContent.risks.map((risk, index) => `
                    <tr style="background: ${index % 2 === 0 ? 'white' : '#fafafa'};">
                        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #1e293b;">${risk.name}</td>
                        <td style="padding: 14px 16px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                            <span style="padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; background: ${risk.probability === 'Wysoka' ? '#fef2f2' : risk.probability === 'Średnia' ? '#fffbeb' : '#f0fdf4'}; color: ${risk.probability === 'Wysoka' ? '#dc2626' : risk.probability === 'Średnia' ? '#d97706' : '#16a34a'};">
                                ${risk.probability}
                            </span>
                        </td>
                        <td style="padding: 14px 16px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                            <span style="padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; background: ${risk.impact === 'Krytyczny' || risk.impact === 'Wysoki' ? '#fef2f2' : risk.impact === 'Średni' ? '#fffbeb' : '#f0fdf4'}; color: ${risk.impact === 'Krytyczny' || risk.impact === 'Wysoki' ? '#dc2626' : risk.impact === 'Średni' ? '#d97706' : '#16a34a'};">
                                ${risk.impact}
                            </span>
                        </td>
                        <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569; line-height: 1.5;">${risk.mitigation}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <!-- Leader Practices -->
    ${axisContent?.leaderPractices && axisContent.leaderPractices.length > 0 ? `
    <div class="leaders-section" style="margin-bottom: 32px;">
        <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            🏆 ${isPolish ? 'Co robią liderzy branży' : 'What Industry Leaders Do'}
        </h3>
        <div style="display: grid; gap: 12px;">
            ${axisContent.leaderPractices.map(practice => `
                <div style="display: flex; align-items: flex-start; gap: 12px; padding: 16px; background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border-radius: 10px; border-left: 4px solid #0284c7;">
                    <span style="font-size: 20px;">🔹</span>
                    <span style="font-size: 14px; color: #0c4a6e; line-height: 1.6;">${practice}</span>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}

    <!-- Recommendations Summary -->
    <div class="recommendations-section" style="margin-bottom: 20px;">
        <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            ✅ ${isPolish ? 'Podsumowanie rekomendacji' : 'Recommendations Summary'}
        </h3>
        <div style="padding: 24px; background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-radius: 12px; border: 1px solid #10b981;">
            ${gap > 0 ? `
                <p style="margin: 0 0 16px 0; font-weight: 600; color: #065f46; font-size: 16px;">
                    ${isPolish ? `Aby zamknąć lukę ${gap} poziomów, rekomendujemy:` : `To close the ${gap}-level gap, we recommend:`}
                </p>
                <ol style="margin: 0; padding-left: 24px; color: #047857;">
                    ${transformationStep.actions.slice(0, 4).map(action => `
                        <li style="margin-bottom: 10px; line-height: 1.6; font-size: 15px;">${action}</li>
                    `).join('')}
                </ol>
                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #10b98150; display: flex; gap: 24px;">
                    <div>
                        <span style="font-size: 13px; color: #065f46;">⏱️ ${isPolish ? 'Horyzont czasowy' : 'Timeline'}</span>
                        <div style="font-weight: 700; color: #047857; font-size: 18px;">${transformationStep.timeline}</div>
                    </div>
                    <div>
                        <span style="font-size: 13px; color: #065f46;">💰 ${isPolish ? 'Budżet' : 'Budget'}</span>
                        <div style="font-weight: 700; color: #047857; font-size: 18px;">${transformationStep.investment}</div>
                    </div>
                </div>
            ` : `
                <p style="margin: 0; font-size: 16px; color: #065f46;">
                    ✅ <strong>${isPolish ? 'Cel osiągnięty!' : 'Target achieved!'}</strong> ${isPolish ? 'Rekomendujemy utrzymanie obecnego poziomu poprzez:' : 'We recommend maintaining the current level through:'}
                </p>
                <ul style="margin: 16px 0 0 0; padding-left: 24px; color: #047857;">
                    <li style="margin-bottom: 8px;">${isPolish ? 'Regularne monitorowanie KPI i benchmarków branżowych' : 'Regular KPI and industry benchmark monitoring'}</li>
                    <li style="margin-bottom: 8px;">${isPolish ? 'Ciągłe doskonalenie i innowację' : 'Continuous improvement and innovation'}</li>
                    <li style="margin-bottom: 8px;">${isPolish ? 'Dzielenie się best practices wewnątrz organizacji' : 'Sharing best practices within the organization'}</li>
                </ul>
            `}
        </div>
    </div>
</div>`;
    }

    /**
     * Generate gap analysis with heatmap matrix
     */
    generateGapAnalysis(assessment, isPolish = true) {
        const { axisData } = assessment;
        const gaps = this.calculateGaps(axisData);

        return `
<div class="gap-analysis">
    <h2>📉 ${isPolish ? 'Analiza Luk' : 'Gap Analysis'}</h2>

    <h3>${isPolish ? 'Macierz Luk Transformacyjnych' : 'Transformation Gap Matrix'}</h3>
    ${this.generateGapHeatmap(axisData, isPolish)}

    <h3>${isPolish ? 'Priorytetyzacja według BCG' : 'BCG-Style Prioritization'}</h3>
    ${this.generateBCGMatrix(gaps, isPolish)}

    <h3>${isPolish ? 'Szczegółowa analiza priorytetów' : 'Detailed Priority Analysis'}</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
            <tr style="background: #1e1b4b; color: white;">
                <th style="padding: 12px; text-align: left;">${isPolish ? 'Oś' : 'Axis'}</th>
                <th style="padding: 12px; text-align: center;">${isPolish ? 'Aktualny' : 'Current'}</th>
                <th style="padding: 12px; text-align: center;">${isPolish ? 'Docelowy' : 'Target'}</th>
                <th style="padding: 12px; text-align: center;">${isPolish ? 'Luka' : 'Gap'}</th>
                <th style="padding: 12px; text-align: center;">${isPolish ? 'Priorytet' : 'Priority'}</th>
                <th style="padding: 12px; text-align: center;">${isPolish ? 'Szac. czas' : 'Est. Time'}</th>
                <th style="padding: 12px; text-align: left;">${isPolish ? 'Rekomendacja' : 'Recommendation'}</th>
            </tr>
        </thead>
        <tbody>
            ${gaps.map(g => `
                <tr style="background: white; border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px;"><span style="margin-right: 8px;">${g.icon}</span>${g.name}</td>
                    <td style="padding: 12px; text-align: center; font-weight: 600;">${g.actual}</td>
                    <td style="padding: 12px; text-align: center; font-weight: 600;">${g.target}</td>
                    <td style="padding: 12px; text-align: center;">
                        <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; background: ${g.gap > 2 ? '#fef2f2' : g.gap > 0 ? '#fef3c7' : '#ecfdf5'}; color: ${g.gap > 2 ? '#991b1b' : g.gap > 0 ? '#92400e' : '#065f46'}; font-weight: 600;">
                            ${g.gap > 0 ? '+' : ''}${g.gap}
                        </span>
                    </td>
                    <td style="padding: 12px; text-align: center;">
                        <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: ${g.priority === 'HIGH' ? '#ef4444' : g.priority === 'MEDIUM' ? '#f59e0b' : g.priority === 'LOW' ? '#10b981' : '#94a3b8'}; color: white;">
                            ${g.priority}
                        </span>
                    </td>
                    <td style="padding: 12px; text-align: center; font-size: 13px; color: #64748b;">${g.estimatedMonths} ${isPolish ? 'mies.' : 'mo.'}</td>
                    <td style="padding: 12px; font-size: 13px; color: #64748b;">${g.recommendation}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</div>`;
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    calculateMetrics(axisData) {
        let totalActual = 0, totalTarget = 0, totalGap = 0, count = 0;
        
        Object.entries(axisData || {}).forEach(([id, data]) => {
            if (data?.actual) {
                totalActual += data.actual;
                totalTarget += data.target || 0;
                totalGap += Math.max(0, (data.target || 0) - (data.actual || 0));
                count++;
            }
        });

        return {
            averageActual: count > 0 ? (totalActual / count).toFixed(1) : '0.0',
            averageTarget: count > 0 ? (totalTarget / count).toFixed(1) : '0.0',
            totalGapPoints: totalGap,
            estimatedMonths: Math.max(6, totalGap * 3),
            axesAssessed: count
        };
    }

    calculateGaps(axisData) {
        return Object.entries(DRD_AXES).map(([id, config]) => {
            const data = axisData[id] || {};
            const gap = (data.target || 0) - (data.actual || 0);
            return {
                id,
                name: config.namePl,
                icon: config.icon,
                actual: data.actual || 0,
                target: data.target || 0,
                gap,
                priority: gap >= 3 ? 'HIGH' : gap >= 2 ? 'MEDIUM' : gap > 0 ? 'LOW' : 'NONE',
                estimatedMonths: gap > 0 ? `${gap * 3}-${gap * 4}` : '-',
                recommendation: gap >= 3 
                    ? 'Natychmiastowe działanie wymagane'
                    : gap >= 2 
                    ? 'Planowane działanie w ciągu 6 mies.'
                    : gap > 0 
                    ? 'Ciągłe doskonalenie'
                    : 'Utrzymanie poziomu'
            };
        }).sort((a, b) => b.gap - a.gap);
    }

    generateKeyInsights(axisData, isPolish) {
        let strongest = { name: '-', score: 0, icon: '', analysis: '' };
        let weakest = { name: '-', score: 10, target: 0, gap: 0, icon: '', analysis: '' };
        const priorityGaps = [];

        Object.entries(axisData || {}).forEach(([id, data]) => {
            const axis = DRD_AXES[id];
            if (!axis || !data?.actual) return;

            if (data.actual > strongest.score) {
                strongest = {
                    name: isPolish ? axis.namePl : axis.name,
                    score: data.actual,
                    icon: axis.icon,
                    analysis: isPolish 
                        ? `Organizacja wykazuje solidne fundamenty i dobre praktyki. Ten obszar może służyć jako wzorzec dla pozostałych.`
                        : `Organization demonstrates solid foundations and good practices. This area can serve as a model for others.`
                };
            }

            const gap = (data.target || 0) - (data.actual || 0);
            if (gap > weakest.gap) {
                weakest = {
                    name: isPolish ? axis.namePl : axis.name,
                    score: data.actual,
                    target: data.target,
                    gap,
                    icon: axis.icon,
                    analysis: isPolish
                        ? `Wymaga priorytetowej uwagi i dedykowanych zasobów. Rekomendujemy opracowanie szczegółowego planu działań.`
                        : `Requires priority attention and dedicated resources. We recommend developing a detailed action plan.`
                };
            }

            if (gap >= 2) {
                priorityGaps.push({
                    name: isPolish ? axis.namePl : axis.name,
                    actual: data.actual,
                    target: data.target,
                    gap
                });
            }
        });

        priorityGaps.sort((a, b) => b.gap - a.gap);

        return { strongest, weakest, priorityGaps: priorityGaps.slice(0, 3) };
    }

    generateIndustryComparisonTable(axisData, industryBenchmark, isPolish) {
        const rows = Object.entries(DRD_AXES).map(([id, config]) => {
            const actual = axisData[id]?.actual || 0;
            const benchmark = industryBenchmark[id] || 0;
            const diff = actual - benchmark;
            const status = diff >= 0.5 ? '🟢' : diff >= -0.5 ? '🟡' : '🔴';

            return `
                <tr>
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">${config.icon} ${isPolish ? config.namePl : config.name}</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${actual}</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${benchmark.toFixed(1)}</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${status} ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}</td>
                </tr>
            `;
        }).join('');

        return `
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">${isPolish ? 'Oś' : 'Axis'}</th>
                        <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${isPolish ? 'Wynik' : 'Score'}</th>
                        <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${isPolish ? 'Benchmark' : 'Benchmark'}</th>
                        <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${isPolish ? 'Różnica' : 'Diff'}</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    generateStrategicRecommendation(metrics, insights, isPolish) {
        const gap = parseFloat(metrics.averageTarget) - parseFloat(metrics.averageActual);

        if (gap > 2.5) {
            return isPolish
                ? `Ze względu na znaczącą lukę transformacyjną (${gap.toFixed(1)} poziomów średnio), rekomendujemy przyjęcie <strong>programowego podejścia do transformacji</strong> z dedykowanym PMO. Priorytetem powinny być fundamenty: ${insights.weakest.name}. Szacowany czas pełnej transformacji: ${metrics.estimatedMonths} miesięcy przy założeniu adekwatnego budżetu i zaangażowania zarządu.`
                : `Given the significant transformation gap (${gap.toFixed(1)} levels on average), we recommend adopting a <strong>programmatic approach to transformation</strong> with dedicated PMO. Priority should be given to foundations: ${insights.weakest.name}. Estimated full transformation time: ${metrics.estimatedMonths} months assuming adequate budget and executive commitment.`;
        } else if (gap > 1) {
            return isPolish
                ? `Organizacja znajduje się w dobrej pozycji do przeprowadzenia transformacji. Rekomendujemy <strong>fazowe podejście</strong> z koncentracją na ${insights.priorityGaps.length} priorytetowych obszarach. Wykorzystanie mocnej strony (${insights.strongest.name}) jako wzorca może przyspieszyć transformację w pozostałych osiach.`
                : `Organization is well-positioned for transformation. We recommend a <strong>phased approach</strong> focusing on ${insights.priorityGaps.length} priority areas. Leveraging the strength (${insights.strongest.name}) as a model can accelerate transformation in other axes.`;
        } else {
            return isPolish
                ? `Organizacja wykazuje dojrzałość cyfrową zbliżoną do poziomu docelowego. Rekomendujemy <strong>strategię utrzymania i ciągłego doskonalenia</strong>. Warto rozważyć podniesienie ambicji w wybranych osiach oraz dzielenie się najlepszymi praktykami z branżą.`
                : `Organization demonstrates digital maturity close to target level. We recommend a <strong>maintenance and continuous improvement strategy</strong>. Consider raising ambitions in selected axes and sharing best practices with the industry.`;
        }
    }

    generateAxisBenchmarkVisualization(actual, target, benchmark, config, isPolish) {
        const maxLevel = config.maxLevel;
        
        return `
            <div style="position: relative; height: 40px; background: #f1f5f9; border-radius: 20px; overflow: hidden;">
                <!-- Benchmark marker -->
                <div style="position: absolute; left: ${(benchmark / maxLevel) * 100}%; top: 0; bottom: 0; width: 3px; background: #64748b; z-index: 2;">
                    <div style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #64748b; white-space: nowrap;">
                        ${isPolish ? 'Branża' : 'Industry'}: ${benchmark.toFixed(1)}
                    </div>
                </div>
                <!-- Current level -->
                <div style="position: absolute; left: 0; top: 4px; bottom: 4px; width: ${(actual / maxLevel) * 100}%; background: ${config.color}; border-radius: 16px;">
                    <div style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: white; font-size: 12px; font-weight: 600;">${isPolish ? 'Aktualny' : 'Current'}: ${actual}</div>
                </div>
                <!-- Target marker -->
                <div style="position: absolute; left: ${(target / maxLevel) * 100}%; top: 0; bottom: 0; width: 3px; background: #10b981; z-index: 2;">
                    <div style="position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #10b981; white-space: nowrap;">
                        ${isPolish ? 'Cel' : 'Target'}: ${target}
                    </div>
                </div>
            </div>
        `;
    }

    generateProgressBar(actual, target, maxLevel, color) {
        return `
            <div style="margin: 20px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #64748b;">
                    <span>1</span>
                    ${Array.from({length: maxLevel - 2}, (_, i) => `<span>${i + 2}</span>`).join('')}
                    <span>${maxLevel}</span>
                </div>
                <div style="position: relative; height: 24px; background: #e5e7eb; border-radius: 12px; overflow: hidden;">
                    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${(actual / maxLevel) * 100}%; background: ${color}; transition: width 0.5s;"></div>
                    <div style="position: absolute; left: ${(target / maxLevel) * 100}%; top: -4px; bottom: -4px; width: 4px; background: #10b981; border-radius: 2px;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                    <div style="font-size: 12px; color: ${color};"><strong>Aktualny:</strong> ${actual}/${maxLevel}</div>
                    <div style="font-size: 12px; color: #10b981;"><strong>Cel:</strong> ${target}/${maxLevel}</div>
                </div>
            </div>
        `;
    }

    generateGapHeatmap(axisData, isPolish) {
        const axes = Object.entries(DRD_AXES);
        
        return `
            <div style="overflow-x: auto; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                    <thead>
                        <tr>
                            <th style="padding: 12px; background: #1e1b4b; color: white; border: 1px solid #374151;">${isPolish ? 'Oś / Poziom' : 'Axis / Level'}</th>
                            ${[1,2,3,4,5,6,7].map(l => `<th style="padding: 12px; background: #1e1b4b; color: white; border: 1px solid #374151; width: 60px;">${l}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${axes.map(([id, config]) => {
                            const data = axisData[id] || {};
                            const actual = data.actual || 0;
                            const target = data.target || 0;
                            
                            return `
                                <tr>
                                    <td style="padding: 12px; border: 1px solid #e5e7eb; background: #f8f9fa;">
                                        <span style="margin-right: 8px;">${config.icon}</span>
                                        ${isPolish ? config.namePl : config.name}
                                    </td>
                                    ${[1,2,3,4,5,6,7].map(level => {
                                        let bg = '#f1f5f9';
                                        let content = '';
                                        
                                        if (level <= config.maxLevel) {
                                            if (level === actual) {
                                                bg = config.color;
                                                content = `<span style="color: white; font-weight: 700;">●</span>`;
                                            } else if (level === target) {
                                                bg = '#10b981';
                                                content = `<span style="color: white; font-weight: 700;">◎</span>`;
                                            } else if (level > actual && level < target) {
                                                bg = '#fef3c7';
                                                content = `<span style="color: #92400e;">→</span>`;
                                            } else if (level < actual) {
                                                bg = '#ecfdf5';
                                            }
                                        } else {
                                            bg = '#e5e7eb';
                                            content = '-';
                                        }
                                        
                                        return `<td style="padding: 12px; border: 1px solid #e5e7eb; background: ${bg}; text-align: center;">${content}</td>`;
                                    }).join('')}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                <div style="margin-top: 12px; font-size: 12px; color: #64748b;">
                    <span style="margin-right: 16px;">● ${isPolish ? 'Stan aktualny' : 'Current'}</span>
                    <span style="margin-right: 16px;">◎ ${isPolish ? 'Cel' : 'Target'}</span>
                    <span>→ ${isPolish ? 'Luka' : 'Gap'}</span>
                </div>
            </div>
        `;
    }

    generateBCGMatrix(gaps, isPolish) {
        // Kategoryzacja inicjatyw według BCG matrix (Impact vs Effort)
        const quickWins = gaps.filter(g => g.gap === 1);
        const strategic = gaps.filter(g => g.gap >= 2 && g.gap <= 3);
        const transformational = gaps.filter(g => g.gap > 3);
        const maintain = gaps.filter(g => g.gap === 0);

        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 20px 0;">
                <div style="background: #ecfdf5; padding: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: #065f46;">🌟 Quick Wins</h4>
                    <p style="font-size: 12px; color: #64748b; margin: 0 0 12px 0;">${isPolish ? 'Niski nakład, szybki efekt' : 'Low effort, quick impact'}</p>
                    ${quickWins.length > 0 
                        ? quickWins.map(g => `<div style="font-size: 13px; margin-bottom: 4px;">${g.icon} ${g.name}</div>`).join('')
                        : `<div style="font-size: 13px; color: #94a3b8;">-</div>`}
                </div>
                <div style="background: #dbeafe; padding: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: #1e40af;">🎯 ${isPolish ? 'Strategiczne' : 'Strategic'}</h4>
                    <p style="font-size: 12px; color: #64748b; margin: 0 0 12px 0;">${isPolish ? 'Znaczący nakład, wysoka wartość' : 'Significant effort, high value'}</p>
                    ${strategic.length > 0 
                        ? strategic.map(g => `<div style="font-size: 13px; margin-bottom: 4px;">${g.icon} ${g.name}</div>`).join('')
                        : `<div style="font-size: 13px; color: #94a3b8;">-</div>`}
                </div>
                <div style="background: #f1f5f9; padding: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: #64748b;">✅ ${isPolish ? 'Utrzymanie' : 'Maintain'}</h4>
                    <p style="font-size: 12px; color: #64748b; margin: 0 0 12px 0;">${isPolish ? 'Cel osiągnięty' : 'Target achieved'}</p>
                    ${maintain.length > 0 
                        ? maintain.map(g => `<div style="font-size: 13px; margin-bottom: 4px;">${g.icon} ${g.name}</div>`).join('')
                        : `<div style="font-size: 13px; color: #94a3b8;">-</div>`}
                </div>
                <div style="background: #fef2f2; padding: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: #991b1b;">🚀 ${isPolish ? 'Transformacyjne' : 'Transformational'}</h4>
                    <p style="font-size: 12px; color: #64748b; margin: 0 0 12px 0;">${isPolish ? 'Duży nakład, fundamentalna zmiana' : 'Major effort, fundamental change'}</p>
                    ${transformational.length > 0 
                        ? transformational.map(g => `<div style="font-size: 13px; margin-bottom: 4px;">${g.icon} ${g.name}</div>`).join('')
                        : `<div style="font-size: 13px; color: #94a3b8;">-</div>`}
                </div>
            </div>
        `;
    }

    getLevelColor(level) {
        const colors = {
            7: '#10b981',
            6: '#3b82f6',
            5: '#6366f1',
            4: '#8b5cf6',
            3: '#f59e0b',
            2: '#f97316',
            1: '#ef4444'
        };
        return colors[level] || '#64748b';
    }

    getHeatmapColor(value, max) {
        const ratio = value / max;
        if (ratio >= 0.8) return '#dcfce7';
        if (ratio >= 0.6) return '#d1fae5';
        if (ratio >= 0.4) return '#fef3c7';
        if (ratio >= 0.2) return '#fed7aa';
        return '#fecaca';
    }
}

module.exports = new EnterpriseReportTemplates();
module.exports.DRD_AXES = DRD_AXES;
module.exports.INDUSTRY_BENCHMARKS = INDUSTRY_BENCHMARKS;
module.exports.MATURITY_LEVELS = MATURITY_LEVELS;

