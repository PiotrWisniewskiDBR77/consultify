/**
 * Framework Initiative Templates
 * 
 * Pre-defined initiative templates for each assessment framework.
 * Used by initiativeGeneratorService to create actionable initiatives from gaps.
 */

// ============================================
// SIRI INITIATIVE TEMPLATES
// ============================================

const SIRI_TEMPLATES = {
    operations: [
        {
            title: 'Wdrożenie systemu MES (Manufacturing Execution System)',
            description: 'Implementacja systemu do zarządzania i monitorowania produkcji w czasie rzeczywistym',
            rationale: 'Poprawa widoczności operacji i kontroli procesów produkcyjnych',
            estimatedEffort: 'L',
            impactScore: 8,
            technologies: ['MES', 'SCADA', 'OPC-UA'],
            expectedOutcomes: ['Zwiększenie OEE o 15-20%', 'Redukcja odpadów o 10%', 'Real-time visibility'],
        },
        {
            title: 'Digitalizacja dokumentacji produkcyjnej',
            description: 'Przejście z papierowej dokumentacji na cyfrową z podpisami elektronicznymi',
            rationale: 'Eliminacja papierowej dokumentacji i poprawa śledzenia',
            estimatedEffort: 'M',
            impactScore: 6,
            technologies: ['e-Signatures', 'Document Management', 'Mobile Apps'],
            expectedOutcomes: ['Zero-paper operations', 'Skrócenie czasu dokumentacji o 50%'],
        },
    ],
    supply_chain: [
        {
            title: 'Wdrożenie platformy S&OP (Sales & Operations Planning)',
            description: 'Implementacja zintegrowanego planowania sprzedaży i operacji',
            rationale: 'Lepsza koordynacja między sprzedażą a produkcją',
            estimatedEffort: 'L',
            impactScore: 8,
            technologies: ['S&OP Platform', 'Demand Sensing', 'AI Forecasting'],
            expectedOutcomes: ['Poprawa dokładności prognoz o 25%', 'Redukcja zapasów o 15%'],
        },
        {
            title: 'Wdrożenie systemu Track & Trace',
            description: 'System śledzenia produktów w całym łańcuchu dostaw',
            rationale: 'Pełna widoczność przepływu materiałów i produktów',
            estimatedEffort: 'M',
            impactScore: 7,
            technologies: ['IoT Sensors', 'RFID', 'Blockchain'],
            expectedOutcomes: ['100% traceability', 'Skrócenie czasu reakcji na problemy'],
        },
    ],
    automation: [
        {
            title: 'Program robotyzacji procesów produkcyjnych',
            description: 'Identyfikacja i wdrożenie robotów przemysłowych w kluczowych obszarach',
            rationale: 'Automatyzacja powtarzalnych i niebezpiecznych zadań',
            estimatedEffort: 'XL',
            impactScore: 9,
            technologies: ['Industrial Robots', 'Cobots', 'AGV/AMR'],
            expectedOutcomes: ['Zwiększenie wydajności o 30%', 'Poprawa bezpieczeństwa'],
        },
        {
            title: 'Wdrożenie systemów wizyjnych',
            description: 'Automatyczna kontrola jakości z wykorzystaniem systemów wizyjnych',
            rationale: 'Eliminacja defektów i poprawa jakości',
            estimatedEffort: 'M',
            impactScore: 7,
            technologies: ['Machine Vision', 'AI/ML', 'High-Speed Cameras'],
            expectedOutcomes: ['100% inspekcja', 'Redukcja defektów o 90%'],
        },
    ],
    connectivity: [
        {
            title: 'Wdrożenie platformy IIoT',
            description: 'Stworzenie infrastruktury Industrial IoT dla zbierania danych z maszyn',
            rationale: 'Podstawa dla analityki i predykcji',
            estimatedEffort: 'L',
            impactScore: 9,
            technologies: ['IoT Platform', 'Edge Computing', 'OPC-UA', 'MQTT'],
            expectedOutcomes: ['Podłączenie 100% maszyn', 'Real-time data collection'],
        },
        {
            title: 'Modernizacja sieci przemysłowej',
            description: 'Upgrade infrastruktury sieciowej do standardów Industry 4.0',
            rationale: 'Niezawodna komunikacja dla systemów real-time',
            estimatedEffort: 'M',
            impactScore: 6,
            technologies: ['Industrial Ethernet', 'TSN', '5G Private Network'],
            expectedOutcomes: ['Latency < 1ms', 'Niezawodność 99.99%'],
        },
    ],
    intelligence: [
        {
            title: 'Wdrożenie predykcyjnego utrzymania ruchu',
            description: 'System przewidywania awarii na podstawie danych z czujników',
            rationale: 'Minimalizacja nieplanowanych przestojów',
            estimatedEffort: 'L',
            impactScore: 9,
            technologies: ['Predictive Maintenance', 'ML Models', 'Vibration Analysis'],
            expectedOutcomes: ['Redukcja przestojów o 40%', 'Optymalizacja kosztów utrzymania'],
        },
        {
            title: 'Wdrożenie AI do optymalizacji procesów',
            description: 'Wykorzystanie AI do optymalizacji parametrów procesów',
            rationale: 'Ciągłe doskonalenie bez interwencji człowieka',
            estimatedEffort: 'L',
            impactScore: 8,
            technologies: ['Process AI', 'Digital Twins', 'Reinforcement Learning'],
            expectedOutcomes: ['Optymalizacja zużycia energii o 20%', 'Zwiększenie jakości'],
        },
    ],
    talent_readiness: [
        {
            title: 'Program upskillingu pracowników Industry 4.0',
            description: 'Kompleksowy program szkoleń z technologii cyfrowych',
            rationale: 'Budowanie kompetencji dla transformacji',
            estimatedEffort: 'M',
            impactScore: 7,
            technologies: ['LMS', 'VR Training', 'Digital Skills Assessment'],
            expectedOutcomes: ['100% przeszkolonych pracowników', 'Certyfikacje Industry 4.0'],
        },
        {
            title: 'Wdrożenie platformy AR do wsparcia operatorów',
            description: 'Augmented Reality dla instrukcji pracy i wsparcia technicznego',
            rationale: 'Szybsze wdrażanie i redukcja błędów',
            estimatedEffort: 'M',
            impactScore: 6,
            technologies: ['AR Glasses', 'Remote Assistance', 'Digital Work Instructions'],
            expectedOutcomes: ['Skrócenie czasu szkolenia o 50%', 'Redukcja błędów o 30%'],
        },
    ],
    structure_management: [
        {
            title: 'Transformacja struktury organizacyjnej do Agile',
            description: 'Przejście z hierarchicznej struktury do zwinnych zespołów',
            rationale: 'Szybsza adaptacja do zmian i innowacji',
            estimatedEffort: 'L',
            impactScore: 7,
            technologies: ['Agile Tools', 'Collaboration Platforms'],
            expectedOutcomes: ['Skrócenie time-to-market', 'Wzrost innowacyjności'],
        },
    ],
};

// ============================================
// ADMA INITIATIVE TEMPLATES
// ============================================

const ADMA_TEMPLATES = {
    strategy: {
        leadership_strategy: [
            {
                title: 'Opracowanie strategii cyfrowej transformacji',
                description: 'Kompleksowa strategia digitalizacji z roadmapą i KPIs',
                rationale: 'Kierunek i priorytety dla inwestycji cyfrowych',
                estimatedEffort: 'M',
                impactScore: 9,
                technologies: ['Strategy Tools', 'Digital Maturity Frameworks'],
                expectedOutcomes: ['Jasna wizja transformacji', 'Zdefiniowane priorytety'],
            },
        ],
        digital_culture: [
            {
                title: 'Program budowania kultury innowacji',
                description: 'Inicjatywy wspierające innowacyjność i eksperymentowanie',
                rationale: 'Kultura jako fundament transformacji',
                estimatedEffort: 'M',
                impactScore: 7,
                technologies: ['Innovation Platforms', 'Ideation Tools'],
                expectedOutcomes: ['Wzrost zaangażowania', 'Więcej inicjatyw oddolnych'],
            },
        ],
    },
    smart_products: {
        connected_products: [
            {
                title: 'Program IoT-yzacji produktów',
                description: 'Dodanie łączności i inteligencji do produktów',
                rationale: 'Nowe modele biznesowe i źródła przychodów',
                estimatedEffort: 'XL',
                impactScore: 9,
                technologies: ['IoT Modules', 'Cloud Backend', 'Mobile Apps'],
                expectedOutcomes: ['Produkty z funkcją Smart', 'Dane o użytkowaniu'],
            },
        ],
    },
    smart_operations: {
        digital_manufacturing: [
            {
                title: 'Wdrożenie cyfrowego bliźniaka fabryki',
                description: 'Digital Twin dla symulacji i optymalizacji',
                rationale: 'Wirtualne testowanie i optymalizacja',
                estimatedEffort: 'XL',
                impactScore: 9,
                technologies: ['Digital Twin Platform', '3D Simulation', 'Real-time Data'],
                expectedOutcomes: ['Wirtualna optymalizacja', 'Redukcja czasu wdrożeń'],
            },
        ],
        predictive_maintenance: [
            {
                title: 'Predictive Maintenance dla kluczowych maszyn',
                description: 'System przewidywania awarii z AI',
                rationale: 'Redukcja kosztów utrzymania i przestojów',
                estimatedEffort: 'L',
                impactScore: 8,
                technologies: ['Condition Monitoring', 'ML Models', 'CMMS Integration'],
                expectedOutcomes: ['Redukcja MTTR o 30%', 'Wzrost dostępności'],
            },
        ],
    },
    data_driven: {
        analytics_ai: [
            {
                title: 'Platforma analityki zaawansowanej',
                description: 'Centralna platforma AI/ML dla wszystkich zastosowań',
                rationale: 'Skalowalność i standaryzacja AI',
                estimatedEffort: 'L',
                impactScore: 9,
                technologies: ['ML Platform', 'Data Lake', 'MLOps'],
                expectedOutcomes: ['Demokratyzacja AI', 'Szybsze wdrażanie modeli'],
            },
        ],
    },
};

// ============================================
// CMMI INITIATIVE TEMPLATES
// ============================================

const CMMI_TEMPLATES = {
    DOING: {
        EST: [
            {
                title: 'Wdrożenie metodologii szacowania opartej na danych',
                description: 'Implementacja parametrycznego szacowania z bazą danych historycznych',
                rationale: 'Poprawa dokładności szacunków projektowych',
                estimatedEffort: 'M',
                impactScore: 7,
                technologies: ['Estimation Tools', 'Historical Database'],
                expectedOutcomes: ['Dokładność szacunków > 85%', 'Powtarzalność procesu'],
            },
        ],
        RDM: [
            {
                title: 'Wdrożenie systemu zarządzania wymaganiami',
                description: 'Narzędzie do śledzenia i zarządzania wymaganiami',
                rationale: 'Kontrola zmian i śledzenie wymagań',
                estimatedEffort: 'M',
                impactScore: 8,
                technologies: ['Requirements Management Tool', 'Traceability Matrix'],
                expectedOutcomes: ['100% traceability', 'Redukcja rework'],
            },
        ],
        VV: [
            {
                title: 'Program automatyzacji testów',
                description: 'Wdrożenie automatycznych testów i CI/CD',
                rationale: 'Szybsze wykrywanie defektów i release',
                estimatedEffort: 'L',
                impactScore: 8,
                technologies: ['Test Automation', 'CI/CD', 'Test Management'],
                expectedOutcomes: ['80% automatyzacji testów', 'Szybsze release'],
            },
        ],
    },
    MANAGING: {
        PLAN: [
            {
                title: 'Standaryzacja procesu planowania projektów',
                description: 'Ujednolicone szablony i proces planowania',
                rationale: 'Konsystencja i jakość planów projektowych',
                estimatedEffort: 'M',
                impactScore: 7,
                technologies: ['Project Management Tools', 'Templates'],
                expectedOutcomes: ['Standaryzowane plany', 'Lepsza predykcyjność'],
            },
        ],
        RSK: [
            {
                title: 'Wdrożenie proaktywnego zarządzania ryzykiem',
                description: 'System identyfikacji i mitygacji ryzyk',
                rationale: 'Redukcja nieoczekiwanych problemów',
                estimatedEffort: 'M',
                impactScore: 8,
                technologies: ['Risk Management Tool', 'Risk Database'],
                expectedOutcomes: ['Proaktywna identyfikacja ryzyk', 'Redukcja eskalacji'],
            },
        ],
    },
    ENABLING: {
        CM: [
            {
                title: 'Wdrożenie systemu zarządzania konfiguracją',
                description: 'Kontrola wersji i zarządzanie baseline',
                rationale: 'Integralność i śledzenie zmian',
                estimatedEffort: 'M',
                impactScore: 7,
                technologies: ['Version Control', 'CM Tool', 'Baseline Management'],
                expectedOutcomes: ['Pełna kontrola wersji', 'Audit trail'],
            },
        ],
        GOV: [
            {
                title: 'Ustanowienie governance dla procesów',
                description: 'Struktura zarządzania i oversight dla procesów',
                rationale: 'Zapewnienie zgodności i ciągłego doskonalenia',
                estimatedEffort: 'M',
                impactScore: 8,
                technologies: ['GRC Platform', 'Process Management'],
                expectedOutcomes: ['Jasna odpowiedzialność', 'Regularne przeglądy'],
            },
        ],
        PPQA: [
            {
                title: 'Wdrożenie programu zapewnienia jakości procesów',
                description: 'Systematyczne audyty i weryfikacja procesów',
                rationale: 'Zgodność z procesami i ciągłe doskonalenie',
                estimatedEffort: 'M',
                impactScore: 7,
                technologies: ['Audit Tools', 'Checklist Management'],
                expectedOutcomes: ['Regularne audyty', 'Identyfikacja odchyleń'],
            },
        ],
    },
};

// ============================================
// LEAN 4.0 INITIATIVE TEMPLATES
// ============================================

const LEAN_TEMPLATES = {
    wastes: {
        OVERPRODUCTION: [
            {
                title: 'Wdrożenie systemu Pull',
                description: 'Przejście z Push na Pull z systemem Kanban',
                rationale: 'Produkcja tylko na zamówienie',
                estimatedEffort: 'M',
                impactScore: 8,
                technologies: ['Kanban System', 'Visual Management'],
                expectedOutcomes: ['Redukcja WIP o 50%', 'Eliminacja nadprodukcji'],
            },
        ],
        WAITING: [
            {
                title: 'Program redukcji czasów oczekiwania',
                description: 'Analiza i eliminacja wąskich gardeł',
                rationale: 'Płynny przepływ bez przestojów',
                estimatedEffort: 'M',
                impactScore: 7,
                technologies: ['Value Stream Mapping', 'Line Balancing'],
                expectedOutcomes: ['Redukcja lead time o 30%', 'Lepsza synchronizacja'],
            },
        ],
        TRANSPORT: [
            {
                title: 'Optymalizacja layoutu i logistyki wewnętrznej',
                description: 'Przeprojektowanie layoutu dla minimalizacji transportu',
                rationale: 'Eliminacja zbędnego transportu',
                estimatedEffort: 'L',
                impactScore: 7,
                technologies: ['Layout Simulation', 'AGV/AMR'],
                expectedOutcomes: ['Redukcja transportu o 40%', 'Szybszy przepływ'],
            },
        ],
        MOTION: [
            {
                title: 'Program ergonomii i standaryzacji pracy',
                description: 'Analiza i optymalizacja ruchów operatorów',
                rationale: 'Efektywność i bezpieczeństwo pracy',
                estimatedEffort: 'M',
                impactScore: 6,
                technologies: ['Motion Study', 'Ergonomic Tools'],
                expectedOutcomes: ['Redukcja zbędnych ruchów', 'Poprawa ergonomii'],
            },
        ],
        DEFECTS: [
            {
                title: 'Wdrożenie Poka-Yoke i kontroli na źródle',
                description: 'Systemy zapobiegające błędom',
                rationale: 'Jakość wbudowana w proces',
                estimatedEffort: 'M',
                impactScore: 8,
                technologies: ['Poka-Yoke Devices', 'Visual Inspection'],
                expectedOutcomes: ['Zero defektów na wyjściu', 'Redukcja rework'],
            },
        ],
    },
    automation: {
        STANDARD: [
            {
                title: 'Automatyzacja stanowiska z robotem współpracującym',
                description: 'Wdrożenie cobota do wsparcia operatora',
                rationale: 'Poprawa wydajności i ergonomii',
                estimatedEffort: 'M',
                impactScore: 7,
                technologies: ['Cobot', 'Safety Systems', 'Programming'],
                expectedOutcomes: ['Wzrost wydajności o 25%', 'Poprawa ergonomii'],
            },
        ],
        RPA: [
            {
                title: 'Wdrożenie RPA dla procesów administracyjnych',
                description: 'Robotic Process Automation dla powtarzalnych zadań',
                rationale: 'Automatyzacja procesów back-office',
                estimatedEffort: 'S',
                impactScore: 6,
                technologies: ['RPA Platform', 'Process Mining'],
                expectedOutcomes: ['Automatyzacja 80% zadań', 'Szybsze przetwarzanie'],
            },
        ],
        AI_ASSISTED: [
            {
                title: 'Wdrożenie systemu AI do wspomagania decyzji',
                description: 'AI do rekomendacji i optymalizacji w czasie rzeczywistym',
                rationale: 'Inteligentne wsparcie operatorów',
                estimatedEffort: 'L',
                impactScore: 8,
                technologies: ['AI Platform', 'Real-time Analytics', 'Recommendation Engine'],
                expectedOutcomes: ['Lepsze decyzje', 'Szybsza reakcja na problemy'],
            },
        ],
        FULL_AUTO: [
            {
                title: 'Pełna automatyzacja linii produkcyjnej',
                description: 'Lights-out manufacturing z minimalną interwencją',
                rationale: 'Maksymalna efektywność i jakość',
                estimatedEffort: 'XL',
                impactScore: 10,
                technologies: ['Industrial Robots', 'AGV', 'MES', 'AI Control'],
                expectedOutcomes: ['24/7 produkcja', 'Minimalna zmienność'],
            },
        ],
    },
};

// ============================================
// TEMPLATE RETRIEVAL FUNCTIONS
// ============================================

/**
 * Get initiative templates for a gap
 */
function getTemplatesForGap(gap) {
    switch (gap.framework) {
        case 'SIRI':
            return SIRI_TEMPLATES[gap.dimensionId] || [];
        
        case 'ADMA':
            const pillar = gap.pillar || 'strategy';
            return ADMA_TEMPLATES[pillar]?.[gap.dimensionId] || [];
        
        case 'CMMI':
            const category = gap.category || 'DOING';
            return CMMI_TEMPLATES[category]?.[gap.practiceAreaId] || [];
        
        case 'LEAN':
            if (gap.type === 'WASTE') {
                return LEAN_TEMPLATES.wastes[gap.wasteType] || [];
            } else if (gap.type === 'AUTOMATION') {
                return LEAN_TEMPLATES.automation[gap.automationType] || [];
            }
            return [];
        
        default:
            return [];
    }
}

/**
 * Select best template based on gap severity
 */
function selectBestTemplate(templates, gap) {
    if (templates.length === 0) return null;
    
    // Sort by impact score descending
    const sorted = [...templates].sort((a, b) => b.impactScore - a.impactScore);
    
    // For high priority gaps, select high impact initiatives
    if (gap.priority === 'HIGH' || gap.priority === 'CRITICAL') {
        return sorted[0];
    }
    
    // For medium priority, balance impact and effort
    if (gap.priority === 'MEDIUM') {
        const mediumEffort = sorted.filter(t => ['S', 'M'].includes(t.estimatedEffort));
        return mediumEffort[0] || sorted[0];
    }
    
    // For low priority, prefer quick wins
    const quickWins = sorted.filter(t => t.estimatedEffort === 'S');
    return quickWins[0] || sorted[sorted.length - 1];
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    SIRI_TEMPLATES,
    ADMA_TEMPLATES,
    CMMI_TEMPLATES,
    LEAN_TEMPLATES,
    getTemplatesForGap,
    selectBestTemplate,
};

