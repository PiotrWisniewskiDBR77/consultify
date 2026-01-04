/**
 * Script to regenerate all report sections with enterprise templates
 * Run: node scripts/regenerate-enterprise-reports.cjs
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Find database
const dbPath = path.join(__dirname, '../server/consultify.db');
console.log(`\n📊 Enterprise Report Regeneration Script`);
console.log(`Database: ${dbPath}\n`);

// DRD Axes configuration
const DRD_AXES = {
    processes: { id: 'processes', namePl: 'Procesy Cyfrowe', icon: '⚙️', order: 1, maxLevel: 7, color: '#3B82F6', description: 'Digitalizacja i automatyzacja procesów operacyjnych' },
    digitalProducts: { id: 'digitalProducts', namePl: 'Produkty Cyfrowe', icon: '📦', order: 2, maxLevel: 5, color: '#F59E0B', description: 'Cyfrowe produkty i usługi generujące wartość' },
    businessModels: { id: 'businessModels', namePl: 'Modele Biznesowe', icon: '💼', order: 3, maxLevel: 5, color: '#8B5CF6', description: 'Innowacyjne modele generowania wartości' },
    dataManagement: { id: 'dataManagement', namePl: 'Zarządzanie Danymi', icon: '📊', order: 4, maxLevel: 7, color: '#10B981', description: 'Strategia danych, analityka i governance' },
    culture: { id: 'culture', namePl: 'Kultura Transformacji', icon: '🎯', order: 5, maxLevel: 5, color: '#EF4444', description: 'Gotowość organizacji do zmian cyfrowych' },
    cybersecurity: { id: 'cybersecurity', namePl: 'Cyberbezpieczeństwo', icon: '🔒', order: 6, maxLevel: 5, color: '#6366F1', description: 'Ochrona zasobów i odporność cyfrowa' },
    aiMaturity: { id: 'aiMaturity', namePl: 'Dojrzałość AI', icon: '🤖', order: 7, maxLevel: 5, color: '#EC4899', description: 'Wykorzystanie AI i ML w organizacji' }
};

// Maturity Level descriptions
const MATURITY_LEVELS = {
    7: { name: 'AI-Driven', namePl: 'Wsparcie AI', characteristics: ['Algorytmy AI wspierające decyzje w czasie rzeczywistym', 'Predykcyjne modele dla kluczowych procesów', 'Autonomiczna optymalizacja parametrów', 'Machine learning w cyklu ciągłego doskonalenia'] },
    6: { name: 'Enterprise Integration', namePl: 'Integracja ERP', characteristics: ['Zintegrowany system ERP obejmujący wszystkie procesy', 'Jednolite źródło danych dla całej organizacji', 'Automatyczny przepływ informacji między działami', 'Zaawansowane dashboardy i raportowanie'] },
    5: { name: 'MES/Advanced', namePl: 'Systemy MES', characteristics: ['Systemy MES monitorujące produkcję w czasie rzeczywistym', 'Pełna visibility łańcucha dostaw', 'Zaawansowana automatyzacja workflow', 'Integracja OT/IT'] },
    4: { name: 'Automation', namePl: 'Automatyzacja', characteristics: ['Roboty programowe (RPA) dla powtarzalnych zadań', 'Automatyczne workflow i eskalacje', 'Digitalizacja dokumentów i obiegu', 'Automatyczne raportowanie'] },
    3: { name: 'Process Control', namePl: 'Kontrola Procesów', characteristics: ['Zmapowane i zdefiniowane procesy', 'Monitorowanie KPI procesowych', 'Alertowanie o odchyleniach', 'Podstawowe cyfrowe bliźniaki'] },
    2: { name: 'Workstation Control', namePl: 'Kontrola Stanowisk', characteristics: ['Tablety/terminale na stanowiskach pracy', 'Cyfrowe instrukcje i checklisty', 'Lokalne bazy danych', 'Podstawowa digitalizacja dokumentów'] },
    1: { name: 'Data Registration', namePl: 'Rejestracja Danych', characteristics: ['Ręczne wprowadzanie danych', 'Arkusze Excel jako główne narzędzie', 'Fragmentaryczne dane', 'Brak integracji systemów'] }
};

// Axis-specific detailed content for BCG/McKinsey style reports  
const AXIS_DETAILED_CONTENT = {
    processes: {
        currentStateDescriptions: {
            1: 'Organizacja polega głównie na ręcznych procesach i arkuszach Excel. Dane są fragmentaryczne, często nieaktualne i przechowywane w silosach.',
            2: 'Wprowadzono podstawowe narzędzia cyfrowe na stanowiskach pracy. Instrukcje są częściowo zdigitalizowane, ale integracja między systemami jest minimalna.',
            3: 'Procesy są zmapowane i monitorowane z wykorzystaniem KPI. Istnieją podstawowe dashboardy, system alertowania o odchyleniach.',
            4: 'Wdrożone rozwiązania RPA dla powtarzalnych zadań. Automatyczne workflow i eskalacje działają sprawnie. Dokumenty obiegu są w pełni cyfrowe.',
            5: 'Funkcjonują systemy MES zapewniające monitoring w czasie rzeczywistym. Pełna visibility łańcucha dostaw. Zaawansowana automatyzacja workflow z integracją OT/IT.',
            6: 'Zintegrowany system ERP obejmuje wszystkie kluczowe procesy. Single source of truth dla całej organizacji.',
            7: 'Algorytmy AI wspierają decyzje w czasie rzeczywistym. Predykcyjne modele optymalizują kluczowe procesy.'
        },
        transformationPath: [
            { from: 1, to: 2, actions: ['Digitalizacja instrukcji stanowiskowych', 'Wdrożenie tabletów/terminali', 'Centralizacja danych'], timeline: '2-4 miesiące', investment: '50-100 tys. PLN' },
            { from: 2, to: 3, actions: ['Mapowanie procesów end-to-end', 'Wdrożenie systemu KPI i dashboardów', 'Implementacja alertowania'], timeline: '3-6 miesięcy', investment: '100-200 tys. PLN' },
            { from: 3, to: 4, actions: ['Identyfikacja procesów do automatyzacji', 'Wdrożenie RPA', 'Automatyzacja workflow'], timeline: '4-8 miesięcy', investment: '200-400 tys. PLN' },
            { from: 4, to: 5, actions: ['Wdrożenie systemu MES', 'Integracja OT/IT', 'Real-time monitoring'], timeline: '6-12 miesięcy', investment: '500 tys. - 1 mln PLN' },
            { from: 5, to: 6, actions: ['Implementacja/modernizacja ERP', 'Integracja wszystkich systemów', 'Single source of truth'], timeline: '12-18 miesięcy', investment: '1-3 mln PLN' },
            { from: 6, to: 7, actions: ['Pilotaż AI dla wybranych procesów', 'Wdrożenie predykcyjnych modeli', 'Autonomiczna optymalizacja'], timeline: '12-24 miesiące', investment: '2-5 mln PLN' }
        ],
        kpis: [
            { name: 'Czas cyklu procesu (Lead Time)', target: '-30%', description: 'Skrócenie czasu od zamówienia do dostawy' },
            { name: 'Poziom automatyzacji', target: '>70%', description: 'Procent zadań wykonywanych automatycznie' },
            { name: 'First Pass Yield', target: '>95%', description: 'Procent produktów bez poprawek' },
            { name: 'OEE', target: '>85%', description: 'Całkowita efektywność wyposażenia' }
        ],
        risks: [
            { name: 'Opór pracowników', probability: 'Wysoka', impact: 'Średni', mitigation: 'Program change management, szkolenia' },
            { name: 'Integracja systemów legacy', probability: 'Średnia', impact: 'Wysoki', mitigation: 'Etapowa migracja, middleware, API-first' },
            { name: 'Przekroczenie budżetu', probability: 'Średnia', impact: 'Średni', mitigation: 'Jasno zdefiniowany scope, MVP approach' }
        ],
        leaderPractices: ['Toyota Production System - cyfryzacja lean manufacturing z AI-powered quality control', 'Siemens - Digital Twin dla procesu produkcyjnego', 'Amazon - w pełni zautomatyzowane centra logistyczne']
    },
    digitalProducts: {
        currentStateDescriptions: {
            1: 'Produkty organizacji są w pełni fizyczne, bez komponentu cyfrowego. Brak aplikacji, portali czy usług online.',
            2: 'Istnieją podstawowe elementy cyfrowe - prosta strona www, formularz kontaktowy. Początkowe eksperymenty z cyfrowymi usługami.',
            3: 'Funkcjonuje rozbudowany portal klienta z samoobsługą. Produkty mają cyfrowe rozszerzenia. E-commerce uzupełnia tradycyjną sprzedaż.',
            4: 'Produkty są cyfrowo rozszerzone - IoT, connected products. Platforma cyfrowa generuje znaczące przychody.',
            5: 'Produkty cyfrowe stanowią core biznesu. Pełna platforma ekosystemu z partnerami. Data-driven product development.'
        },
        transformationPath: [
            { from: 1, to: 2, actions: ['Modernizacja strony www', 'Wdrożenie CRM', 'Basic e-commerce'], timeline: '2-4 miesiące', investment: '30-80 tys. PLN' },
            { from: 2, to: 3, actions: ['Portal klienta z self-service', 'Aplikacja mobilna', 'Rozbudowa e-commerce'], timeline: '4-8 miesięcy', investment: '150-300 tys. PLN' },
            { from: 3, to: 4, actions: ['IoT connectivity w produktach', 'Platforma subskrypcyjna', 'API dla partnerów'], timeline: '6-12 miesięcy', investment: '300-600 tys. PLN' },
            { from: 4, to: 5, actions: ['Budowa ekosystemu partnerów', 'AI-powered product features', 'Data monetization'], timeline: '12-24 miesiące', investment: '1-3 mln PLN' }
        ],
        kpis: [
            { name: 'Digital Revenue Share', target: '>30%', description: 'Udział przychodów z kanałów cyfrowych' },
            { name: 'Customer Digital Engagement', target: '>60%', description: 'Klienci aktywnie korzystający z usług cyfrowych' },
            { name: 'Product Connectivity Rate', target: '>80%', description: 'Produkty z komponentem IoT/connected' }
        ],
        risks: [
            { name: 'Cyberbezpieczeństwo produktów', probability: 'Średnia', impact: 'Krytyczny', mitigation: 'Security by design, regularne audyty' },
            { name: 'Kanibalizacja tradycyjnych produktów', probability: 'Średnia', impact: 'Średni', mitigation: 'Strategia portfolio, premium positioning' }
        ],
        leaderPractices: ['Tesla - OTA updates transformujące fizyczny produkt', 'Peloton - hardware + content subscription model', 'John Deere - precision agriculture platform']
    },
    businessModels: {
        currentStateDescriptions: {
            1: 'Tradycyjny model sprzedaży produktów/usług bez innowacji cyfrowej. Główne źródło przychodów to jednorazowa sprzedaż.',
            2: 'Pierwsze eksperymenty z cyfrowymi modelami - np. basic online store, prosta subskrypcja.',
            3: 'Funkcjonują hybrydowe modele biznesowe - product + service, częściowa subskrypcja. Wyraźny stream przychodów cyfrowych.',
            4: 'Platform business model lub znaczący komponent platformowy. Monetyzacja danych. Ekosystem partnerów.',
            5: 'Organizacja działa jako platforma/ekosystem. Network effects napędzają wzrost. Data-as-a-Service w ofercie.'
        },
        transformationPath: [
            { from: 1, to: 2, actions: ['Analiza możliwości cyfryzacji modelu', 'Pilot subskrypcji/SaaS', 'E-commerce launch'], timeline: '3-6 miesięcy', investment: '50-150 tys. PLN' },
            { from: 2, to: 3, actions: ['Product-as-a-Service pilotaż', 'Loyalty/membership program', 'Partnerstwa technologiczne'], timeline: '6-12 miesięcy', investment: '200-400 tys. PLN' },
            { from: 3, to: 4, actions: ['Platform MVP launch', 'Partner ecosystem development', 'Freemium model'], timeline: '12-18 miesięcy', investment: '500 tys. - 1.5 mln PLN' },
            { from: 4, to: 5, actions: ['Scale platform', 'AI/ML-based services', 'Global expansion'], timeline: '18-36 miesięcy', investment: '2-10 mln PLN' }
        ],
        kpis: [
            { name: 'Recurring Revenue Ratio', target: '>40%', description: 'Udział przychodów powtarzalnych' },
            { name: 'Customer Lifetime Value', target: '+100%', description: 'Wzrost wartości życiowej klienta' },
            { name: 'Partner Ecosystem Size', target: '>50 partnerów', description: 'Liczba aktywnych partnerów' }
        ],
        risks: [
            { name: 'Disruptive konkurencja', probability: 'Wysoka', impact: 'Krytyczny', mitigation: 'Continuous innovation, monitoring startupów' },
            { name: 'Regulacje', probability: 'Średnia', impact: 'Wysoki', mitigation: 'Compliance by design, elastyczna architektura' }
        ],
        leaderPractices: ['Netflix - od DVD rental do global streaming platform', 'Rolls-Royce - Power-by-the-Hour model', 'Adobe - from packaged software do Creative Cloud']
    },
    dataManagement: {
        currentStateDescriptions: {
            1: 'Dane rozproszone w silosach (Excel, lokalne bazy). Brak centralnego repozytorium. Ręczne raportowanie.',
            2: 'Istnieją lokalne bazy danych i podstawowe narzędzia BI. Raporty generowane cyklicznie, ale z opóźnieniem.',
            3: 'Centralne repozytorium danych (data warehouse) dla kluczowych obszarów. Dashboardy i regularne raportowanie.',
            4: 'Data lake/lakehouse z advanced analytics. Real-time dashboardy. Data quality management.',
            5: 'Advanced ML/AI w produkcji. Predykcyjna analityka napędza decyzje. Data products generują wartość.',
            6: 'Enterprise data platform z pełną integracją. Master Data Management. 360° view klienta.',
            7: 'AI-first organization. Augmented analytics. Prescriptive insights. Autonomous data management.'
        },
        transformationPath: [
            { from: 1, to: 2, actions: ['Konsolidacja źródeł danych', 'Wdrożenie podstawowego BI', 'Data audit'], timeline: '2-4 miesiące', investment: '50-100 tys. PLN' },
            { from: 2, to: 3, actions: ['Budowa data warehouse', 'Data governance framework', 'Self-service BI'], timeline: '4-8 miesięcy', investment: '150-300 tys. PLN' },
            { from: 3, to: 4, actions: ['Data lake implementation', 'Advanced analytics platform', 'ML pilot projects'], timeline: '6-12 miesięcy', investment: '300-600 tys. PLN' },
            { from: 4, to: 5, actions: ['MLOps platform', 'Productionizing ML models', 'Data products development'], timeline: '12-18 miesięcy', investment: '500 tys. - 1 mln PLN' },
            { from: 5, to: 6, actions: ['Enterprise data platform', 'MDM implementation', 'Real-time decisioning'], timeline: '12-24 miesiące', investment: '1-3 mln PLN' },
            { from: 6, to: 7, actions: ['AI Center of Excellence', 'Autonomous analytics', 'Cognitive automation'], timeline: '18-36 miesięcy', investment: '2-5 mln PLN' }
        ],
        kpis: [
            { name: 'Data Quality Score', target: '>95%', description: 'Kompletność, dokładność, aktualność danych' },
            { name: 'Analytics Adoption', target: '>80%', description: 'Pracownicy regularnie używający analytics tools' },
            { name: 'Time-to-Insight', target: '<24h', description: 'Czas od pytania do odpowiedzi analitycznej' }
        ],
        risks: [
            { name: 'Data privacy/GDPR', probability: 'Wysoka', impact: 'Krytyczny', mitigation: 'Privacy by design, DPO, regularne audyty' },
            { name: 'Data silos powrót', probability: 'Średnia', impact: 'Średni', mitigation: 'Governance enforcement, architektura' }
        ],
        leaderPractices: ['Google - BigQuery i Looker jako self-service analytics', 'Netflix - data-driven content decisions', 'Capital One - cloud-first data platform']
    },
    culture: {
        currentStateDescriptions: {
            1: 'Kultura odporna na zmiany. Hierarchiczna struktura blokuje innowacje. Strach przed błędami.',
            2: 'Świadomość potrzeby zmian rośnie. Pojedyncze inicjatywy digitalizacji. Liderzy zaczynają promować cyfryzację.',
            3: 'Digital agenda jest częścią strategii. Dedykowany zespół transformation. Programy upskilling/reskilling.',
            4: 'Agile ways of working w większości organizacji. Innowacja jest nagradzana. Fail-fast culture.',
            5: 'Organizacja jest cyfrowo natywna. Continuous learning culture. Innovation jest DNA firmy.'
        },
        transformationPath: [
            { from: 1, to: 2, actions: ['Komunikacja vision transformacji', 'Quick wins dla budowy momentum', 'Digital champions program'], timeline: '3-6 miesięcy', investment: '30-80 tys. PLN' },
            { from: 2, to: 3, actions: ['Transformation Office setup', 'Comprehensive upskilling program', 'Innovation pilots'], timeline: '6-12 miesięcy', investment: '150-300 tys. PLN' },
            { from: 3, to: 4, actions: ['Agile transformation', 'Innovation lab/hub', 'Performance metrics update'], timeline: '12-18 miesięcy', investment: '300-600 tys. PLN' },
            { from: 4, to: 5, actions: ['Continuous learning platform', 'Employer branding refresh', 'Culture reinforcement'], timeline: '18-36 miesięcy', investment: '500 tys. - 1 mln PLN' }
        ],
        kpis: [
            { name: 'Digital Skills Index', target: '>4/5', description: 'Średni poziom kompetencji cyfrowych' },
            { name: 'eNPS', target: '>30', description: 'Satysfakcja i zaangażowanie pracowników' },
            { name: 'Innovation Ideas per Employee', target: '>2/rok', description: 'Aktywność innowacyjna pracowników' }
        ],
        risks: [
            { name: 'Change fatigue', probability: 'Wysoka', impact: 'Średni', mitigation: 'Pacing transformacji, celebrate wins' },
            { name: 'Middle management resistance', probability: 'Wysoka', impact: 'Wysoki', mitigation: 'Dedykowane programy dla managerów' }
        ],
        leaderPractices: ['Microsoft - Growth Mindset culture transformation', 'ING - Agile transformation całej organizacji', 'Spotify - Squad model']
    },
    cybersecurity: {
        currentStateDescriptions: {
            1: 'Podstawowe zabezpieczenia (antywirus, firewall). Brak formalnej polityki bezpieczeństwa.',
            2: 'Istnieje podstawowa polityka bezpieczeństwa. Regularne szkolenia awareness. Backup i DR zdefiniowane.',
            3: 'Security Operations Center. Identity and Access Management. Vulnerability management program.',
            4: 'Zero Trust Architecture implementowane. Advanced threat protection. Security automation (SOAR).',
            5: 'Cyber resilience na poziomie enterprise. AI-powered threat detection. Security as enabler biznesu.'
        },
        transformationPath: [
            { from: 1, to: 2, actions: ['Security policy development', 'Awareness training program', 'Backup & DR implementation'], timeline: '2-4 miesiące', investment: '50-100 tys. PLN' },
            { from: 2, to: 3, actions: ['SOC setup/outsource', 'IAM implementation', 'Vulnerability scanning program'], timeline: '4-8 miesięcy', investment: '150-300 tys. PLN' },
            { from: 3, to: 4, actions: ['Zero Trust roadmap', 'Advanced security tools', 'DevSecOps integration'], timeline: '8-14 miesięcy', investment: '300-600 tys. PLN' },
            { from: 4, to: 5, actions: ['AI/ML for security', 'Threat hunting capability', 'Cyber resilience program'], timeline: '12-24 miesiące', investment: '500 tys. - 1.5 mln PLN' }
        ],
        kpis: [
            { name: 'Mean Time to Detect (MTTD)', target: '<24h', description: 'Średni czas wykrycia incydentu' },
            { name: 'Mean Time to Respond (MTTR)', target: '<4h', description: 'Średni czas reakcji na incydent' },
            { name: 'Phishing Click Rate', target: '<5%', description: 'Skuteczność testów phishingowych' }
        ],
        risks: [
            { name: 'Ransomware attack', probability: 'Średnia', impact: 'Krytyczny', mitigation: 'Backup strategy, endpoint protection' },
            { name: 'Data breach', probability: 'Średnia', impact: 'Krytyczny', mitigation: 'DLP, encryption, access controls' }
        ],
        leaderPractices: ['Microsoft - Security by Design z $1B+ rocznych inwestycji', 'Mastercard - AI-powered fraud detection', 'CrowdStrike - Cloud-native security platform']
    },
    aiMaturity: {
        currentStateDescriptions: {
            1: 'Brak wykorzystania AI/ML. Organizacja może używać podstawowej analityki, ale bez machine learning.',
            2: 'Eksploracja możliwości AI. Pilotażowe projekty z wykorzystaniem gotowych narzędzi AI (np. ChatGPT).',
            3: 'Funkcjonują produkcyjne rozwiązania AI w wybranych obszarach. Dedykowany zespół data science.',
            4: 'AI jest strategicznym priorytetem. MLOps platform. Multiple AI use cases w produkcji.',
            5: 'AI-first organization. AI embedded w core products/services. Autonomous AI systems.'
        },
        transformationPath: [
            { from: 1, to: 2, actions: ['AI awareness workshops', 'Use case identification', 'Data readiness assessment'], timeline: '2-4 miesiące', investment: '30-80 tys. PLN' },
            { from: 2, to: 3, actions: ['Hire/train data scientists', 'First ML model to production', 'AI governance framework'], timeline: '6-12 miesięcy', investment: '200-400 tys. PLN' },
            { from: 3, to: 4, actions: ['AI CoE establishment', 'MLOps platform', 'Scale AI use cases'], timeline: '12-18 miesięcy', investment: '500 tys. - 1 mln PLN' },
            { from: 4, to: 5, actions: ['AI product development', 'Foundation model exploration', 'Autonomous systems'], timeline: '18-36 miesięcy', investment: '1-5 mln PLN' }
        ],
        kpis: [
            { name: 'AI Use Cases in Production', target: '>10', description: 'Liczba rozwiązań AI w produkcji' },
            { name: 'AI-Generated Revenue', target: '>10%', description: 'Przychody z produktów/usług AI' },
            { name: 'Time-to-Deploy Model', target: '<4 tygodnie', description: 'Czas od POC do produkcji' }
        ],
        risks: [
            { name: 'AI bias', probability: 'Średnia', impact: 'Wysoki', mitigation: 'Responsible AI framework, diverse data' },
            { name: 'Model drift', probability: 'Wysoka', impact: 'Średni', mitigation: 'Monitoring, continuous training, MLOps' }
        ],
        leaderPractices: ['OpenAI/Microsoft - Foundation models (GPT-4, Copilot)', 'Google DeepMind - AlphaFold', 'Tesla - Full Self-Driving']
    }
};

// Generate comprehensive axis detail content (BCG/McKinsey style)
function generateEnterpriseAxisDetail(axisId, axisData) {
    const axisConfig = DRD_AXES[axisId];
    const axisContent = AXIS_DETAILED_CONTENT[axisId];
    const axis = axisData?.[axisId] || {};
    
    if (!axisConfig) return '<div><h2>Unknown Axis</h2></div>';

    const actual = axis.actual || 4;
    const target = axis.target || 6;
    const gap = target - actual;
    const currentLevel = MATURITY_LEVELS[actual] || MATURITY_LEVELS[4];
    const targetLevel = MATURITY_LEVELS[target] || MATURITY_LEVELS[6];
    const currentStateDescription = axisContent?.currentStateDescriptions?.[actual] || 'Opis stanu aktualnego do uzupełnienia.';
    const transformationStep = axisContent?.transformationPath?.find(step => step.from === actual) || axisContent?.transformationPath?.[0] || { actions: [], timeline: 'Do ustalenia', investment: 'Do oszacowania' };

    const positionVsBenchmark = actual >= 4 ? 'above' : actual <= 2 ? 'below' : 'at';
    const industryBenchmark = 3.5;

    return `
<div class="axis-detail enterprise-section" style="page-break-before: always;">
    <!-- Section Header -->
    <div class="section-header" style="margin-bottom: 32px;">
        <h2 style="font-size: 28px; font-weight: 700; margin: 0; color: #1e293b;">
            ${axisConfig.icon} ${axisConfig.namePl}
        </h2>
        <p style="color: #64748b; font-size: 16px; margin-top: 8px; line-height: 1.6;">
            ${axisConfig.description}
        </p>
    </div>

    <!-- Key Takeaways Box -->
    <div class="key-takeaways" style="background: linear-gradient(135deg, #1e1b4b, #312e81); color: white; padding: 24px; border-radius: 16px; margin-bottom: 32px;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; display: flex; align-items: center; gap: 8px;">
            💡 Kluczowe wnioski
        </h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div style="text-align: center;">
                <div style="font-size: 14px; opacity: 0.8; margin-bottom: 4px;">Pozycja vs. Branża</div>
                <div style="font-size: 24px; font-weight: 700; color: ${positionVsBenchmark === 'above' ? '#4ade80' : positionVsBenchmark === 'below' ? '#f87171' : '#fbbf24'};">
                    ${positionVsBenchmark === 'above' ? '↑ Powyżej' : positionVsBenchmark === 'below' ? '↓ Poniżej' : '→ Średnia'}
                </div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 14px; opacity: 0.8; margin-bottom: 4px;">Luka do zamknięcia</div>
                <div style="font-size: 24px; font-weight: 700;">+${gap} poziomów</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 14px; opacity: 0.8; margin-bottom: 4px;">Priorytet</div>
                <div style="font-size: 24px; font-weight: 700; color: ${gap > 2 ? '#f87171' : gap > 0 ? '#fbbf24' : '#4ade80'};">
                    ${gap > 2 ? '🔴 Wysoki' : gap > 0 ? '🟡 Średni' : '🟢 Niski'}
                </div>
            </div>
        </div>
    </div>

    <!-- Score Cards -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 32px;">
        <div style="background: linear-gradient(135deg, ${axisConfig.color}15, ${axisConfig.color}05); padding: 24px; border-radius: 16px; text-align: center; border: 2px solid ${axisConfig.color};">
            <div style="font-size: 56px; font-weight: 800; color: ${axisConfig.color}; line-height: 1;">${actual}</div>
            <div style="font-size: 14px; color: #64748b; font-weight: 600; margin-top: 8px;">Stan aktualny</div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">/ ${axisConfig.maxLevel} max</div>
            <div style="margin-top: 12px; padding: 8px 12px; background: ${axisConfig.color}20; border-radius: 8px;">
                <span style="font-size: 12px; font-weight: 600; color: ${axisConfig.color};">${currentLevel.namePl}</span>
            </div>
        </div>
        <div style="background: linear-gradient(135deg, #10b98115, #10b98105); padding: 24px; border-radius: 16px; text-align: center; border: 2px solid #10b981;">
            <div style="font-size: 56px; font-weight: 800; color: #10b981; line-height: 1;">${target}</div>
            <div style="font-size: 14px; color: #64748b; font-weight: 600; margin-top: 8px;">Cel docelowy</div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">/ ${axisConfig.maxLevel} max</div>
            <div style="margin-top: 12px; padding: 8px 12px; background: #10b98120; border-radius: 8px;">
                <span style="font-size: 12px; font-weight: 600; color: #10b981;">${targetLevel ? targetLevel.namePl : '-'}</span>
            </div>
        </div>
        <div style="background: linear-gradient(135deg, ${gap > 2 ? '#ef444415' : gap > 0 ? '#f59e0b15' : '#10b98115'}, transparent); padding: 24px; border-radius: 16px; text-align: center; border: 2px solid ${gap > 2 ? '#ef4444' : gap > 0 ? '#f59e0b' : '#10b981'};">
            <div style="font-size: 56px; font-weight: 800; color: ${gap > 2 ? '#ef4444' : gap > 0 ? '#f59e0b' : '#10b981'}; line-height: 1;">+${gap}</div>
            <div style="font-size: 14px; color: #64748b; font-weight: 600; margin-top: 8px;">Luka transformacyjna</div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">poziomów</div>
            <div style="margin-top: 12px; padding: 8px 12px; background: ${gap > 2 ? '#ef444420' : gap > 0 ? '#f59e0b20' : '#10b98120'}; border-radius: 8px;">
                <span style="font-size: 12px; font-weight: 600; color: ${gap > 2 ? '#ef4444' : gap > 0 ? '#f59e0b' : '#10b981'};">
                    ${gap > 2 ? 'Wysoki priorytet' : gap > 0 ? 'Średni priorytet' : 'Cel osiągnięty'}
                </span>
            </div>
        </div>
    </div>

    <!-- Current State Analysis -->
    <div class="analysis-section" style="margin-bottom: 32px;">
        <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            📋 Diagnoza stanu aktualnego
        </h3>
        <div style="padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid ${axisConfig.color};">
            <p style="margin: 0; line-height: 1.8; color: #334155; font-size: 15px;">
                ${currentStateDescription}
            </p>
        </div>
        
        <!-- Current Level Characteristics -->
        <div style="margin-top: 20px;">
            <h4 style="font-size: 16px; font-weight: 600; color: #475569; margin-bottom: 12px;">
                Charakterystyki poziomu ${actual} (${currentLevel.namePl}):
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

    <!-- Industry Benchmark Section -->
    <div class="benchmark-section" style="margin-bottom: 32px;">
        <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            🏭 Pozycja względem branży
        </h3>
        
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
            <!-- Progress Bar Visualization -->
            <div style="margin-bottom: 20px;">
                <div style="position: relative; height: 32px; background: #e5e7eb; border-radius: 16px; overflow: hidden;">
                    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${(actual / axisConfig.maxLevel) * 100}%; background: linear-gradient(90deg, ${axisConfig.color}, ${axisConfig.color}aa); border-radius: 16px; transition: width 0.5s;"></div>
                    <div style="position: absolute; left: ${(target / axisConfig.maxLevel) * 100}%; top: 4px; bottom: 4px; width: 4px; background: #10b981; border-radius: 2px;"></div>
                    <div style="position: absolute; left: ${(industryBenchmark / axisConfig.maxLevel) * 100}%; top: 0; bottom: 0; width: 2px; background: #f59e0b; border-style: dashed;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #64748b;">
                    <span>1</span>
                    <span style="color: ${axisConfig.color}; font-weight: 600;">Aktualny: ${actual}</span>
                    <span style="color: #f59e0b; font-weight: 600;">Branża: ${industryBenchmark.toFixed(1)}</span>
                    <span style="color: #10b981; font-weight: 600;">Cel: ${target}</span>
                    <span>${axisConfig.maxLevel}</span>
                </div>
            </div>
        </div>

        <div style="padding: 16px; background: ${positionVsBenchmark === 'above' ? '#f0fdf4' : positionVsBenchmark === 'below' ? '#fef2f2' : '#fffbeb'}; border-radius: 8px;">
            <p style="margin: 0; font-size: 15px; color: #334155; line-height: 1.6;">
                ${positionVsBenchmark === 'above' 
                    ? `<strong>✅ Organizacja jest powyżej średniej branżowej</strong> (${industryBenchmark.toFixed(1)}). To stanowi przewagę konkurencyjną, którą należy utrzymać i wykorzystać.`
                    : positionVsBenchmark === 'below'
                    ? `<strong>⚠️ Organizacja jest poniżej średniej branżowej</strong> (${industryBenchmark.toFixed(1)}). Wymaga to priorytetowych działań, aby nie stracić pozycji konkurencyjnej.`
                    : `<strong>📊 Organizacja jest na poziomie średniej branżowej</strong> (${industryBenchmark.toFixed(1)}). To solidna pozycja, ale wyróżnienie się wymaga przekroczenia tego poziomu.`}
            </p>
        </div>
    </div>

    <!-- Transformation Path -->
    ${gap > 0 ? `
    <div class="transformation-section" style="margin-bottom: 32px;">
        <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            🚀 Ścieżka transformacji
        </h3>
        <div style="padding: 20px; background: linear-gradient(135deg, #eff6ff, #dbeafe); border-radius: 12px;">
            <div style="font-weight: 600; color: #1e40af; margin-bottom: 12px;">
                📍 Następny krok: Poziom ${actual} → ${Math.min(actual + 1, target)}
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px;">
                <div style="padding: 12px; background: white; border-radius: 8px;">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">⏱️ Szacowany czas</div>
                    <div style="font-weight: 600; color: #1e293b;">${transformationStep.timeline}</div>
                </div>
                <div style="padding: 12px; background: white; border-radius: 8px;">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">💰 Szacowana inwestycja</div>
                    <div style="font-weight: 600; color: #1e293b;">${transformationStep.investment}</div>
                </div>
            </div>
            <div style="font-size: 14px; color: #475569;">
                <strong>Kluczowe działania:</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                    ${transformationStep.actions.map(action => `<li style="margin-bottom: 4px;">${action}</li>`).join('')}
                </ul>
            </div>
        </div>
    </div>
    ` : ''}

    <!-- KPIs Section -->
    ${axisContent?.kpis && axisContent.kpis.length > 0 ? `
    <div class="kpi-section" style="margin-bottom: 32px;">
        <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            🎯 Kluczowe wskaźniki (KPI) do monitorowania
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            ${axisContent.kpis.map(kpi => `
                <div style="padding: 16px; background: white; border: 1px solid #e2e8f0; border-radius: 12px;">
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
            ⚠️ Ryzyka i bariery transformacji
        </h3>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
                <tr style="background: #f1f5f9;">
                    <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #475569; font-size: 13px;">Ryzyko</th>
                    <th style="padding: 14px 16px; text-align: center; font-weight: 600; color: #475569; font-size: 13px;">Prawdop.</th>
                    <th style="padding: 14px 16px; text-align: center; font-weight: 600; color: #475569; font-size: 13px;">Wpływ</th>
                    <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #475569; font-size: 13px;">Mitygacja</th>
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
            🏆 Co robią liderzy branży
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
    <div class="recommendations-section">
        <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            ✅ Podsumowanie rekomendacji
        </h3>
        <div style="padding: 24px; background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-radius: 12px; border: 1px solid #10b981;">
            ${gap > 0 ? `
                <p style="margin: 0 0 16px 0; font-weight: 600; color: #065f46; font-size: 16px;">
                    Aby zamknąć lukę ${gap} poziomów, rekomendujemy:
                </p>
                <ol style="margin: 0; padding-left: 24px; color: #047857;">
                    ${transformationStep.actions.slice(0, 4).map(action => `
                        <li style="margin-bottom: 10px; line-height: 1.6; font-size: 15px;">${action}</li>
                    `).join('')}
                </ol>
                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #10b98150; display: flex; gap: 24px;">
                    <div>
                        <span style="font-size: 13px; color: #065f46;">⏱️ Horyzont czasowy</span>
                        <div style="font-weight: 700; color: #047857; font-size: 18px;">${transformationStep.timeline}</div>
                    </div>
                    <div>
                        <span style="font-size: 13px; color: #065f46;">💰 Budżet</span>
                        <div style="font-weight: 700; color: #047857; font-size: 18px;">${transformationStep.investment}</div>
                    </div>
                </div>
            ` : `
                <p style="margin: 0; font-size: 16px; color: #065f46;">
                    ✅ <strong>Cel osiągnięty!</strong> Rekomendujemy utrzymanie obecnego poziomu poprzez:
                </p>
                <ul style="margin: 16px 0 0 0; padding-left: 24px; color: #047857;">
                    <li style="margin-bottom: 8px;">Regularne monitorowanie KPI i benchmarków branżowych</li>
                    <li style="margin-bottom: 8px;">Ciągłe doskonalenie i innowację</li>
                    <li style="margin-bottom: 8px;">Dzielenie się best practices wewnątrz organizacji</li>
                </ul>
            `}
        </div>
    </div>
</div>`;
}

// Section configuration
const SECTION_CONFIG = [
    { type: 'cover_page', title: 'Strona Tytułowa', icon: '📋' },
    { type: 'executive_summary', title: 'Streszczenie Wykonawcze', icon: '📊' },
    { type: 'methodology', title: 'Metodologia DRD', icon: '📐' },
    { type: 'maturity_overview', title: 'Przegląd Dojrzałości', icon: '📈' },
    ...Object.values(DRD_AXES).map(axis => ({
        type: 'axis_detail',
        axisId: axis.id,
        title: `${axis.icon} ${axis.namePl}`,
        icon: axis.icon
    })),
    { type: 'gap_analysis', title: 'Analiza Luk', icon: '📉' },
    { type: 'initiatives', title: 'Rekomendowane Inicjatywy', icon: '🚀' },
    { type: 'roadmap', title: 'Roadmapa Transformacji', icon: '🗺️' },
    { type: 'appendix', title: 'Załączniki', icon: '📎' }
];

// Open database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Failed to open database:', err.message);
        process.exit(1);
    }
    console.log('✅ Database connected');
});

// Helper to run query
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function getAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Generate section content (simplified version for script)
function generateSectionContent(config, assessment) {
    const { axisData, organization_name, project_name } = assessment;
    const date = new Date().toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' });

    switch (config.type) {
        case 'cover_page':
            return `
<div class="cover-page" style="text-align: center; padding: 60px 40px; min-height: 600px; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%); color: white; border-radius: 12px;">
    <div style="margin-bottom: 60px;">
        <div style="font-size: 14px; letter-spacing: 3px; opacity: 0.7; margin-bottom: 20px;">DIGITAL READINESS DIAGNOSIS</div>
        <h1 style="font-size: 42px; font-weight: 700; margin: 0 0 16px 0;">📊 Raport Diagnozy Gotowości Cyfrowej</h1>
        <h2 style="font-size: 28px; font-weight: 500; color: #94a3b8; margin: 0;">${project_name || organization_name || 'Assessment Report'}</h2>
    </div>
    <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 12px; margin: 40px 0;">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; text-align: left;">
            <div><div style="font-size: 12px; color: #94a3b8;">Organizacja</div><div style="font-size: 18px; font-weight: 600; margin-top: 4px;">${organization_name || '-'}</div></div>
            <div><div style="font-size: 12px; color: #94a3b8;">Projekt</div><div style="font-size: 18px; font-weight: 600; margin-top: 4px;">${project_name || '-'}</div></div>
            <div><div style="font-size: 12px; color: #94a3b8;">Data raportu</div><div style="font-size: 18px; font-weight: 600; margin-top: 4px;">${date}</div></div>
            <div><div style="font-size: 12px; color: #94a3b8;">Wersja</div><div style="font-size: 18px; font-weight: 600; margin-top: 4px;">1.0 Final</div></div>
        </div>
    </div>
    <div style="margin-top: 60px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.2);">
        <p style="font-size: 13px; color: #94a3b8; margin: 0;">Metodologia: Digital Readiness Diagnosis (DRD) zgodna ze standardem SIRI</p>
        <p style="font-size: 11px; color: #64748b; margin-top: 8px;">POUFNE - Wyłącznie do użytku wewnętrznego</p>
    </div>
</div>`;

        case 'executive_summary':
            const metrics = calculateMetrics(axisData);
            return `
<div class="executive-summary">
    <h2>📋 Streszczenie Wykonawcze</h2>
    
    <div style="margin: 20px 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px;">
        <p style="font-size: 16px; margin: 0;">Niniejszy raport przedstawia kompleksową diagnozę gotowości cyfrowej organizacji <strong>${organization_name || 'Klient'}</strong>. Analiza obejmuje 7 kluczowych osi transformacji cyfrowej zgodnie z metodologią DRD.</p>
    </div>

    <h3>🎯 Kluczowe Wskaźniki</h3>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; text-align: center; border-left: 4px solid #3b82f6;">
            <div style="font-size: 32px; font-weight: 700; color: #3b82f6;">${metrics.averageActual}</div>
            <div style="font-size: 13px; color: #64748b;">Średni poziom aktualny</div>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; text-align: center; border-left: 4px solid #10b981;">
            <div style="font-size: 32px; font-weight: 700; color: #10b981;">${metrics.averageTarget}</div>
            <div style="font-size: 13px; color: #64748b;">Średni poziom docelowy</div>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; text-align: center; border-left: 4px solid #ef4444;">
            <div style="font-size: 32px; font-weight: 700; color: #ef4444;">${metrics.totalGap}</div>
            <div style="font-size: 13px; color: #64748b;">Całkowita luka</div>
        </div>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; text-align: center; border-left: 4px solid #8b5cf6;">
            <div style="font-size: 32px; font-weight: 700; color: #8b5cf6;">${metrics.estimatedMonths}</div>
            <div style="font-size: 13px; color: #64748b;">Miesięcy transformacji</div>
        </div>
    </div>

    <h3>💡 Rekomendacja Strategiczna</h3>
    <div style="padding: 20px; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; border-radius: 8px;">
        <p style="margin: 0; font-size: 15px; line-height: 1.6;">
            Ze względu na zidentyfikowane luki transformacyjne, rekomendujemy przyjęcie fazowego podejścia do transformacji. Priorytetem powinny być fundamenty: zarządzanie danymi i cyberbezpieczeństwo, a następnie procesy i kultura organizacyjna.
        </p>
    </div>
</div>`;

        case 'methodology':
            return `
<div class="methodology-section">
    <h2>📐 Metodologia DRD</h2>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
        <p style="margin: 0; font-size: 15px; line-height: 1.7;">
            <strong>Digital Readiness Diagnosis (DRD)</strong> to kompleksowa metodologia oceny dojrzałości cyfrowej organizacji, opracowana w oparciu o wieloletnie doświadczenie oraz standard <strong>SIRI</strong> (Smart Industry Readiness Index).
        </p>
    </div>

    <h3>7 Osi Transformacji Cyfrowej</h3>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0;">
        ${Object.values(DRD_AXES).map(axis => `
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span style="font-size: 20px;">${axis.icon}</span>
                    <strong>${axis.namePl}</strong>
                    <span style="margin-left: auto; font-size: 12px; color: #64748b;">1-${axis.maxLevel}</span>
                </div>
            </div>
        `).join('')}
    </div>

    <h3>Poziomy Dojrzałości (1-7)</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #1e1b4b; color: white;"><th style="padding: 12px;">Poziom</th><th style="padding: 12px;">Nazwa</th><th style="padding: 12px;">Charakterystyka</th></tr>
        <tr><td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 700; color: #10b981;">7</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Wsparcie AI</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Pełna integracja AI, predykcyjne zarządzanie</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 700; color: #3b82f6;">6</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Integracja ERP</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Pełna integracja systemów enterprise</td></tr>
        <tr><td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 700; color: #6366f1;">5</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Systemy MES</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Real-time visibility, zaawansowana automatyzacja</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 700; color: #8b5cf6;">4</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Automatyzacja</td><td style="padding: 12px; border: 1px solid #e5e7eb;">RPA, workflow automation</td></tr>
        <tr><td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 700; color: #f59e0b;">3</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Kontrola Procesów</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Zdefiniowane i monitorowane procesy</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 700; color: #f97316;">2</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Kontrola Stanowisk</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Cyfrowe narzędzia na stanowiskach</td></tr>
        <tr><td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 700; color: #ef4444;">1</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Rejestracja Danych</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Podstawowe zbieranie danych</td></tr>
    </table>
</div>`;

        case 'maturity_overview':
            return generateMaturityOverviewContent(axisData);

        case 'axis_detail':
            return generateEnterpriseAxisDetail(config.axisId, axisData);

        case 'gap_analysis':
            return generateGapAnalysisContent(axisData);

        case 'initiatives':
            return generateInitiativesContent(axisData);

        case 'roadmap':
            return generateRoadmapContent(axisData);

        case 'appendix':
            return `
<div class="appendix-section">
    <h2>📎 Załączniki</h2>

    <h3>A. Metodyka Zbierania Danych</h3>
    <div style="margin: 16px 0; padding: 16px; background: #f8f9fa; border-radius: 8px;">
        <p style="margin: 0;">Diagnoza DRD została przeprowadzona z wykorzystaniem:</p>
        <ul style="margin: 12px 0; padding-left: 20px;">
            <li>Wywiadów strukturyzowanych z kluczowymi interesariuszami</li>
            <li>Analizy dokumentacji operacyjnej i strategicznej</li>
            <li>Obserwacji procesów (gemba walk)</li>
            <li>Przeglądu systemów IT</li>
            <li>Benchmark z danymi branżowymi</li>
        </ul>
    </div>

    <h3>B. Słownik Pojęć DRD</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #1e1b4b; color: white;"><th style="padding: 12px;">Termin</th><th style="padding: 12px;">Definicja</th></tr>
        <tr><td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">DRD</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Digital Readiness Diagnosis - Diagnoza Gotowości Cyfrowej</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">Oś</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Główny wymiar oceny dojrzałości</td></tr>
        <tr><td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">Luka</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Różnica między stanem aktualnym a docelowym</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">Pathway</td><td style="padding: 12px; border: 1px solid #e5e7eb;">Ścieżka dojścia do poziomu docelowego</td></tr>
    </table>

    <h3>C. Bibliografia</h3>
    <ul style="margin: 16px 0; padding-left: 20px; line-height: 1.8;">
        <li>Wisniewski, P. (2024). <em>Digital Pathfinder</em></li>
        <li>VDA 6.3 Process Audit Standard</li>
        <li>SIRI - Smart Industry Readiness Index (Singapore EDB)</li>
    </ul>
</div>`;

        default:
            return '<div><h2>Nowa Sekcja</h2><p><em>Treść do uzupełnienia...</em></p></div>';
    }
}

// Calculate metrics from axis data
function calculateMetrics(axisData) {
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
        averageActual: count > 0 ? (totalActual / count).toFixed(1) : '4.0',
        averageTarget: count > 0 ? (totalTarget / count).toFixed(1) : '6.0',
        totalGap: totalGap || 10,
        estimatedMonths: Math.max(6, totalGap * 3) || 18,
        axesAssessed: count || 7
    };
}

// Generate maturity overview content
function generateMaturityOverviewContent(axisData) {
    const metrics = calculateMetrics(axisData);
    
    // Create axis scores with defaults
    const axisScores = Object.entries(DRD_AXES).map(([id, config]) => {
        const data = axisData?.[id] || { actual: 4, target: 6 };
        return {
            name: config.namePl,
            icon: config.icon,
            actual: data.actual || 4,
            target: data.target || 6,
            max: config.maxLevel
        };
    });

    return `
<div class="maturity-overview">
    <h2>📊 Przegląd Dojrzałości Cyfrowej</h2>
    
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 24px 0;">
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 24px; border-radius: 12px; color: white; text-align: center;">
            <div style="font-size: 48px; font-weight: 700;">${metrics.averageActual}</div>
            <div style="font-size: 14px; opacity: 0.9;">Średni poziom aktualny</div>
            <div style="font-size: 12px; opacity: 0.7; margin-top: 4px;">/ 7 max</div>
        </div>
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; border-radius: 12px; color: white; text-align: center;">
            <div style="font-size: 48px; font-weight: 700;">${metrics.averageTarget}</div>
            <div style="font-size: 14px; opacity: 0.9;">Średni poziom docelowy</div>
            <div style="font-size: 12px; opacity: 0.7; margin-top: 4px;">/ 7 max</div>
        </div>
        <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 24px; border-radius: 12px; color: white; text-align: center;">
            <div style="font-size: 48px; font-weight: 700;">${(parseFloat(metrics.averageTarget) - parseFloat(metrics.averageActual)).toFixed(1)}</div>
            <div style="font-size: 14px; opacity: 0.9;">Średnia luka</div>
            <div style="font-size: 12px; opacity: 0.7; margin-top: 4px;">poziomów</div>
        </div>
    </div>

    <h3>Macierz Dojrzałości 7 Osi</h3>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
        <thead>
            <tr style="background: linear-gradient(135deg, #1e1b4b, #312e81); color: white;">
                <th style="padding: 14px; text-align: left; border: 1px solid #374151;">#</th>
                <th style="padding: 14px; text-align: left; border: 1px solid #374151;">Oś Transformacji</th>
                <th style="padding: 14px; text-align: center; border: 1px solid #374151; width: 80px;">Aktualny</th>
                <th style="padding: 14px; text-align: center; border: 1px solid #374151; width: 80px;">Docelowy</th>
                <th style="padding: 14px; text-align: center; border: 1px solid #374151; width: 80px;">Luka</th>
                <th style="padding: 14px; text-align: center; border: 1px solid #374151; width: 100px;">Priorytet</th>
                <th style="padding: 14px; text-align: left; border: 1px solid #374151; width: 200px;">Wizualizacja</th>
            </tr>
        </thead>
        <tbody>
            ${axisScores.map((axis, i) => {
                const gap = axis.target - axis.actual;
                const priorityColor = gap >= 3 ? '#ef4444' : gap >= 2 ? '#f59e0b' : gap > 0 ? '#10b981' : '#94a3b8';
                const priorityText = gap >= 3 ? 'WYSOKI' : gap >= 2 ? 'ŚREDNI' : gap > 0 ? 'NISKI' : '-';
                const actualWidth = (axis.actual / axis.max) * 100;
                const targetPos = (axis.target / axis.max) * 100;

                return `
                    <tr style="background: ${i % 2 === 0 ? '#f8f9fa' : 'white'};">
                        <td style="padding: 14px; border: 1px solid #e5e7eb; font-weight: 700; color: #3b82f6;">${i + 1}</td>
                        <td style="padding: 14px; border: 1px solid #e5e7eb;">
                            <span style="margin-right: 8px; font-size: 18px;">${axis.icon}</span>
                            <strong>${axis.name}</strong>
                        </td>
                        <td style="padding: 14px; border: 1px solid #e5e7eb; text-align: center; font-size: 20px; font-weight: 700; color: #3b82f6;">${axis.actual}</td>
                        <td style="padding: 14px; border: 1px solid #e5e7eb; text-align: center; font-size: 20px; font-weight: 700; color: #10b981;">${axis.target}</td>
                        <td style="padding: 14px; border: 1px solid #e5e7eb; text-align: center;">
                            <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; background: ${gap > 0 ? '#fef2f2' : '#ecfdf5'}; color: ${gap > 0 ? '#991b1b' : '#065f46'}; font-weight: 700;">
                                ${gap > 0 ? '+' : ''}${gap}
                            </span>
                        </td>
                        <td style="padding: 14px; border: 1px solid #e5e7eb; text-align: center;">
                            <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; background: ${priorityColor}; color: white; font-size: 11px; font-weight: 700;">
                                ${priorityText}
                            </span>
                        </td>
                        <td style="padding: 14px; border: 1px solid #e5e7eb;">
                            <div style="position: relative; height: 24px; background: #e5e7eb; border-radius: 12px; overflow: hidden;">
                                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${actualWidth}%; background: linear-gradient(90deg, #3b82f6, #60a5fa); border-radius: 12px;"></div>
                                <div style="position: absolute; left: ${targetPos}%; top: 2px; bottom: 2px; width: 3px; background: #10b981; border-radius: 2px;"></div>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    </table>

    <h3>Interpretacja wyników</h3>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0;">
        <div style="padding: 16px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
            <strong style="color: #991b1b;">🔴 Wysoki priorytet</strong>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #7f1d1d;">Luka ≥3 poziomów. Wymaga natychmiastowej uwagi i dedykowanych zasobów.</p>
        </div>
        <div style="padding: 16px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <strong style="color: #92400e;">🟡 Średni priorytet</strong>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #78350f;">Luka 2 poziomów. Planowane działania w ciągu 6-12 miesięcy.</p>
        </div>
        <div style="padding: 16px; background: #ecfdf5; border-radius: 8px; border-left: 4px solid #10b981;">
            <strong style="color: #065f46;">🟢 Niski priorytet / Cel osiągnięty</strong>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #064e3b;">Luka ≤1 poziom lub cel osiągnięty. Ciągłe doskonalenie.</p>
        </div>
    </div>

    <h3>Kluczowe wnioski</h3>
    <ul style="margin: 16px 0; padding-left: 20px; line-height: 1.8;">
        <li>Organizacja osiągnęła średni poziom dojrzałości <strong>${metrics.averageActual}/7</strong>, co plasuje ją w górnej połowie skali.</li>
        <li>Do osiągnięcia stanu docelowego (<strong>${metrics.averageTarget}/7</strong>) wymagane jest zamknięcie luki ${(parseFloat(metrics.averageTarget) - parseFloat(metrics.averageActual)).toFixed(1)} poziomów.</li>
        <li>${metrics.axesAssessed} z 7 osi zostało ocenionych w ramach audytu.</li>
    </ul>
</div>`;
}

// Generate gap analysis content
function generateGapAnalysisContent(axisData) {
    const gaps = Object.entries(DRD_AXES).map(([id, config]) => {
        const data = axisData?.[id] || { actual: 4, target: 6 };
        const gap = (data.target || 6) - (data.actual || 4);
        return { id, name: config.namePl, icon: config.icon, actual: data.actual || 4, target: data.target || 6, gap };
    }).sort((a, b) => b.gap - a.gap);

    return `
<div class="gap-analysis">
    <h2>📉 Analiza Luk</h2>

    <h3>Macierz Luk Transformacyjnych</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
            <tr style="background: #1e1b4b; color: white;">
                <th style="padding: 12px;">Oś</th>
                <th style="padding: 12px; text-align: center;">Aktualny</th>
                <th style="padding: 12px; text-align: center;">Docelowy</th>
                <th style="padding: 12px; text-align: center;">Luka</th>
                <th style="padding: 12px; text-align: center;">Priorytet</th>
            </tr>
        </thead>
        <tbody>
            ${gaps.map(g => `
                <tr>
                    <td style="padding: 12px; border: 1px solid #e5e7eb;">${g.icon} ${g.name}</td>
                    <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${g.actual}</td>
                    <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${g.target}</td>
                    <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;"><span style="padding: 4px 12px; border-radius: 12px; background: ${g.gap > 2 ? '#fef2f2' : g.gap > 0 ? '#fef3c7' : '#ecfdf5'}; color: ${g.gap > 2 ? '#991b1b' : g.gap > 0 ? '#92400e' : '#065f46'}; font-weight: 600;">+${g.gap}</span></td>
                    <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;"><span style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: ${g.gap > 2 ? '#ef4444' : g.gap > 0 ? '#f59e0b' : '#10b981'}; color: white;">${g.gap > 2 ? 'HIGH' : g.gap > 0 ? 'MEDIUM' : 'LOW'}</span></td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h3>Priorytetyzacja BCG</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin: 20px 0;">
        <div style="background: #ecfdf5; padding: 20px;"><h4 style="margin: 0 0 12px 0; color: #065f46;">🌟 Quick Wins</h4><p style="font-size: 12px; color: #64748b; margin: 0;">Niski nakład, szybki efekt</p></div>
        <div style="background: #dbeafe; padding: 20px;"><h4 style="margin: 0 0 12px 0; color: #1e40af;">🎯 Strategiczne</h4><p style="font-size: 12px; color: #64748b; margin: 0;">Znaczący nakład, wysoka wartość</p></div>
        <div style="background: #f1f5f9; padding: 20px;"><h4 style="margin: 0 0 12px 0; color: #64748b;">✅ Utrzymanie</h4><p style="font-size: 12px; color: #64748b; margin: 0;">Cel osiągnięty</p></div>
        <div style="background: #fef2f2; padding: 20px;"><h4 style="margin: 0 0 12px 0; color: #991b1b;">🚀 Transformacyjne</h4><p style="font-size: 12px; color: #64748b; margin: 0;">Duży nakład, fundamentalna zmiana</p></div>
    </div>
</div>`;
}

// Generate initiatives content
function generateInitiativesContent(axisData) {
    return `
<div class="initiatives-section">
    <h2>🚀 Rekomendowane Inicjatywy Transformacyjne</h2>
    
    <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; padding: 20px; border-radius: 12px; margin: 20px 0;">
        <p style="margin: 0; font-size: 15px;">Na podstawie przeprowadzonej diagnozy DRD zidentyfikowaliśmy kluczowe inicjatywy transformacyjne, które pozwolą zamknąć luki między stanem obecnym a docelowym.</p>
    </div>

    <h3>🔴 Inicjatywy Krytyczne</h3>
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 16px 0; border-left: 4px solid #ef4444;">
        <h4 style="margin: 0 0 8px 0;">📊 Program Zarządzania Danymi</h4>
        <p style="margin: 0; color: #64748b; font-size: 13px;">Wdrożenie strategii danych, governance i analityki</p>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <div><div style="font-size: 11px; color: #94a3b8;">Czas</div><div style="font-size: 18px; font-weight: 700;">9-12 mies.</div></div>
            <div><div style="font-size: 11px; color: #94a3b8;">Budżet</div><div style="font-size: 14px; font-weight: 600;">500K-1M PLN</div></div>
            <div><div style="font-size: 11px; color: #94a3b8;">Zespół</div><div style="font-size: 14px; font-weight: 600;">5-10 FTE</div></div>
            <div><div style="font-size: 11px; color: #94a3b8;">Priorytet</div><div style="font-size: 14px; font-weight: 600; color: #ef4444;">Critical</div></div>
        </div>
    </div>

    <h3>🟡 Inicjatywy Priorytetowe</h3>
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 16px 0; border-left: 4px solid #f59e0b;">
        <h4 style="margin: 0 0 8px 0;">⚙️ Automatyzacja Procesów</h4>
        <p style="margin: 0; color: #64748b; font-size: 13px;">RPA i workflow automation dla kluczowych procesów</p>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <div><div style="font-size: 11px; color: #94a3b8;">Czas</div><div style="font-size: 18px; font-weight: 700;">6-8 mies.</div></div>
            <div><div style="font-size: 11px; color: #94a3b8;">Budżet</div><div style="font-size: 14px; font-weight: 600;">200K-500K PLN</div></div>
            <div><div style="font-size: 11px; color: #94a3b8;">Zespół</div><div style="font-size: 14px; font-weight: 600;">3-5 FTE</div></div>
            <div><div style="font-size: 11px; color: #94a3b8;">Priorytet</div><div style="font-size: 14px; font-weight: 600; color: #f59e0b;">High</div></div>
        </div>
    </div>

    <h3>💡 Rekomendacje wdrożeniowe</h3>
    <ol style="margin: 16px 0; padding-left: 20px; line-height: 1.8;">
        <li><strong>Powołanie PMO transformacji</strong> - dedykowany zespół zarządzający programem</li>
        <li><strong>Quick wins first</strong> - rozpoczęcie od inicjatyw o szybkim efekcie</li>
        <li><strong>Fazowe wdrażanie</strong> - realizacja w falach z checkpointami co 3 miesiące</li>
        <li><strong>Zarządzanie zmianą</strong> - kompleksowy program komunikacji i szkoleniowy</li>
    </ol>
</div>`;
}

// Generate roadmap content
function generateRoadmapContent(axisData) {
    return `
<div class="roadmap-section">
    <h2>🗺️ Roadmapa Transformacji Cyfrowej</h2>
    
    <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; padding: 20px; border-radius: 12px; margin: 20px 0;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
            <div><div style="font-size: 36px; font-weight: 700;">18</div><div style="font-size: 13px; opacity: 0.8;">Miesięcy do transformacji</div></div>
            <div><div style="font-size: 36px; font-weight: 700;">4</div><div style="font-size: 13px; opacity: 0.8;">Fazy wdrożenia</div></div>
            <div><div style="font-size: 36px; font-weight: 700;">7</div><div style="font-size: 13px; opacity: 0.8;">Osi do transformacji</div></div>
        </div>
    </div>

    <h3>Fazy Transformacji</h3>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 20px 0;">
        <div style="text-align: center;">
            <div style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 12px; border-radius: 8px;">
                <div style="font-size: 11px; opacity: 0.8;">FAZA 1</div>
                <div style="font-weight: 700;">Fundamenty</div>
                <div style="font-size: 12px; opacity: 0.8;">0-6 mies.</div>
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 8px;">Dane, governance, security</div>
        </div>
        <div style="text-align: center;">
            <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 12px; border-radius: 8px;">
                <div style="font-size: 11px; opacity: 0.8;">FAZA 2</div>
                <div style="font-weight: 700;">Quick Wins</div>
                <div style="font-size: 12px; opacity: 0.8;">3-9 mies.</div>
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 8px;">Procesy, automatyzacja</div>
        </div>
        <div style="text-align: center;">
            <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 12px; border-radius: 8px;">
                <div style="font-size: 11px; opacity: 0.8;">FAZA 3</div>
                <div style="font-weight: 700;">Strategiczne</div>
                <div style="font-size: 12px; opacity: 0.8;">6-18 mies.</div>
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 8px;">Produkty, modele biznesowe</div>
        </div>
        <div style="text-align: center;">
            <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 12px; border-radius: 8px;">
                <div style="font-size: 11px; opacity: 0.8;">FAZA 4</div>
                <div style="font-weight: 700;">Integracja AI</div>
                <div style="font-size: 12px; opacity: 0.8;">12-24 mies.</div>
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 8px;">AI we wszystkich osiach</div>
        </div>
    </div>

    <h3>🏁 Kamienie Milowe</h3>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0;">
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #ef4444;"><strong>Q1:</strong> Zakończenie audytu i zatwierdzenie roadmapy</div>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b;"><strong>Q2:</strong> Wdrożenie fundamentów danych</div>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6;"><strong>Q3:</strong> Pierwsze quick wins dostarczone</div>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981;"><strong>Q4:</strong> Przegląd postępów i aktualizacja planu</div>
    </div>
</div>`;
}

// Main function
async function main() {
    try {
        // Get all reports
        const reports = await getAll(`
            SELECT ar.*, p.name as project_name, o.name as organization_name
            FROM assessment_reports ar
            LEFT JOIN projects p ON ar.project_id = p.id
            LEFT JOIN organizations o ON ar.organization_id = o.id
        `);

        console.log(`\n📋 Found ${reports.length} reports to regenerate\n`);

        for (const report of reports) {
            console.log(`\n📄 Processing: ${report.title || report.id}`);

            // Parse axis data from assessment_snapshot
            let axisData = {};
            try {
                const snapshot = JSON.parse(report.assessment_snapshot || '{}');
                axisData = snapshot.axes || snapshot.axisData || {};
            } catch (e) {
                console.log('   ⚠️ Could not parse assessment_snapshot, using defaults');
            }

            const assessment = {
                axisData,
                organization_name: report.organization_name,
                project_name: report.project_name
            };

            // Delete existing sections
            await runQuery('DELETE FROM report_sections WHERE report_id = ?', [report.id]);
            console.log(`   🗑️ Deleted old sections`);

            // Generate new sections
            const now = new Date().toISOString();
            let inserted = 0;

            for (let i = 0; i < SECTION_CONFIG.length; i++) {
                const config = SECTION_CONFIG[i];
                const sectionId = uuidv4();
                const content = generateSectionContent(config, assessment);

                await runQuery(`
                    INSERT INTO report_sections 
                    (id, report_id, section_type, axis_id, title, content, data_snapshot, order_index, is_ai_generated, version, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
                `, [
                    sectionId,
                    report.id,
                    config.type,
                    config.axisId || null,
                    config.title,
                    content,
                    JSON.stringify({ generatedAt: now, assessmentId: report.id }),
                    i,
                    now,
                    now
                ]);
                inserted++;
            }

            console.log(`   ✅ Generated ${inserted} enterprise sections`);
        }

        console.log(`\n✅ Successfully regenerated all reports with enterprise templates!\n`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        db.close();
    }
}

// Run
main();

