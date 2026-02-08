/**
 * Sample Assessment Data for Report Generation
 *
 * Contains realistic sample data for three frameworks:
 * - DRD (Digital Readiness Diagnosis)
 * - SIRI (Smart Industry Readiness Index)
 * - ADMA (Advanced Digital Maturity Assessment)
 *
 * Used for generating sample reports and testing report templates.
 */

// ==========================================
// SAMPLE COMPANY CONTEXT
// ==========================================

export const SAMPLE_COMPANY_CONTEXT = {
  companyName: 'TechProd Manufacturing Sp. z o.o.',
  industry: 'Produkcja komponentów elektronicznych',
  employeeCount: 450,
  annualRevenue: '85 mln PLN',
  foundedYear: 1998,
  headquarters: 'Wrocław, Polska',
  marketPosition: 'Lider regionalny, obecność w 12 krajach EU',
  keyProducts: [
    'Komponenty elektroniczne dla automotive',
    'Systemy sterowania przemysłowego',
    'Moduły IoT dla smart home',
  ],
  strategicGoals: [
    'Wzrost przychodów o 30% w ciągu 3 lat',
    'Ekspansja na rynki Europy Zachodniej',
    'Uruchomienie linii produktów AI-enabled',
    'Redukcja śladu węglowego o 40%',
  ],
};

// ==========================================
// DRD SAMPLE ASSESSMENT DATA
// ==========================================

export const SAMPLE_DRD_ASSESSMENT = {
  id: 'sample-drd-assessment-001',
  name: 'DRD Assessment - TechProd Manufacturing',
  assessmentType: 'DRD',
  status: 'APPROVED',
  createdAt: '2026-01-15T10:00:00Z',
  approvedAt: '2026-01-28T14:30:00Z',

  // Overall scores
  overallScore: {
    current: 3.8,
    target: 5.2,
    gap: 1.4,
  },

  // Axis scores
  axisScores: {
    // Axis 1: Digital Processes (7 levels)
    axis1: {
      name: 'Procesy Cyfrowe',
      current: 4.2,
      target: 5.8,
      gap: 1.6,
      areaScores: {
        '1A': {
          name: 'Procesy Sprzedaży',
          current: 5,
          target: 6,
          gap: 1,
          evidence: 'CRM wdrożony, brak pełnej integracji z ERP',
        },
        '1B': {
          name: 'Procesy Marketingowe',
          current: 4,
          target: 6,
          gap: 2,
          evidence: 'Marketing automation w trakcie wdrażania',
        },
        '1C': {
          name: 'Technologia Procesowa i R&D',
          current: 5,
          target: 6,
          gap: 1,
          evidence: 'CAD/CAM zintegrowane, digital twin w pilotażu',
        },
        '1D': {
          name: 'Procesy Zakupowe',
          current: 4,
          target: 5,
          gap: 1,
          evidence: 'Platforma B2B wdrożona, MRP działa',
        },
        '1E': {
          name: 'Procesy Logistyczne',
          current: 4,
          target: 6,
          gap: 2,
          evidence: 'WMS funkcjonalny, brak pełnej automatyzacji',
        },
        '1F': {
          name: 'Procesy Produkcyjne',
          current: 5,
          target: 7,
          gap: 2,
          evidence: 'MES wdrożony, OEE monitorowany, brak AI',
        },
        '1G': {
          name: 'Procesy Jakości',
          current: 4,
          target: 6,
          gap: 2,
          evidence: 'QMS certyfikowany, SPC w użyciu',
        },
        '1H': {
          name: 'Zarządzanie Finansami',
          current: 4,
          target: 5,
          gap: 1,
          evidence: 'ERP finansowy zintegrowany',
        },
        '1I': {
          name: 'Procesy HR',
          current: 3,
          target: 5,
          gap: 2,
          evidence: 'HRM podstawowy, brak AI w rekrutacji',
        },
      },
    },
    // Axis 2: Digital Products (5 levels)
    axis2: {
      name: 'Produkty Cyfrowe',
      current: 3.4,
      target: 4.6,
      gap: 1.2,
      areaScores: {
        '2A': {
          name: 'Produkty Cyfrowe',
          current: 4,
          target: 5,
          gap: 1,
          evidence: 'Produkty z modułami IoT, firmware updates OTA',
        },
        '2B': {
          name: 'Produkty Społecznościowe',
          current: 2,
          target: 4,
          gap: 2,
          evidence: 'Forum wsparcia, brak pełnej platformy',
        },
        '2C': {
          name: 'Produkty ICT',
          current: 4,
          target: 5,
          gap: 1,
          evidence: 'API dla integracji, dashboard klienta',
        },
        '2D': {
          name: 'Dopasowanie do Oczekiwań',
          current: 4,
          target: 5,
          gap: 1,
          evidence: 'Konfiguratory online, personalizacja',
        },
        '2E': {
          name: 'Skalowalność Produktu',
          current: 3,
          target: 4,
          gap: 1,
          evidence: 'Obecność w EU, lokalizacja częściowa',
        },
      },
    },
    // Axis 3: Digital Business Models (5 levels)
    axis3: {
      name: 'Cyfrowe Modele Biznesowe',
      current: 2.8,
      target: 4.2,
      gap: 1.4,
      areaScores: {
        '3A': {
          name: 'Modele E-commerce',
          current: 3,
          target: 4,
          gap: 1,
          evidence: 'B2B e-commerce, brak B2C',
        },
        '3B': {
          name: 'Rozwiązania Platformowe',
          current: 2,
          target: 4,
          gap: 2,
          evidence: 'Brak własnej platformy ekosystemowej',
        },
        '3C': {
          name: 'Model As-a-Service',
          current: 3,
          target: 5,
          gap: 2,
          evidence: 'Pilotaż Equipment-as-a-Service',
        },
        '3D': {
          name: 'Współdzielenie Zasobów',
          current: 3,
          target: 4,
          gap: 1,
          evidence: 'Sharing w ramach grupy kapitałowej',
        },
        '3E': {
          name: 'Monetyzacja Danych',
          current: 3,
          target: 4,
          gap: 1,
          evidence: 'Dane produktowe zbierane, brak monetyzacji',
        },
      },
    },
    // Axis 4: Data Management (7 levels)
    axis4: {
      name: 'Zarządzanie Danymi',
      current: 4.0,
      target: 5.6,
      gap: 1.6,
      areaScores: {
        '4A': {
          name: 'Zbieranie Danych',
          current: 5,
          target: 6,
          gap: 1,
          evidence: 'Sensory na produkcji, RFID w magazynie',
        },
        '4B': {
          name: 'Metodologia Przechowywania',
          current: 4,
          target: 6,
          gap: 2,
          evidence: 'Hybrid cloud w użyciu',
        },
        '4C': {
          name: 'Komunikacja Danych',
          current: 4,
          target: 6,
          gap: 2,
          evidence: 'Industrial Ethernet, Wi-Fi 6',
        },
        '4D': {
          name: 'Analiza Big Data',
          current: 4,
          target: 6,
          gap: 2,
          evidence: 'BI tools, brak zaawansowanego ML',
        },
        '4E': {
          name: 'Przetwarzanie (Computing)',
          current: 3,
          target: 5,
          gap: 2,
          evidence: 'Cloud computing, edge pilotaż',
        },
      },
    },
    // Axis 5: Culture of Transformation (5 levels)
    axis5: {
      name: 'Kultura Transformacji',
      current: 3.6,
      target: 4.6,
      gap: 1.0,
      areaScores: {
        '5A': {
          name: 'Styl Przywództwa',
          current: 4,
          target: 5,
          gap: 1,
          evidence: 'Zarząd wspiera digitalizację',
        },
        '5B': {
          name: 'Gotowość na Zmiany',
          current: 4,
          target: 5,
          gap: 1,
          evidence: 'Change management funkcjonuje',
        },
        '5C': {
          name: 'Ciągłe Doskonalenie',
          current: 4,
          target: 5,
          gap: 1,
          evidence: 'Lean manufacturing, Kaizen',
        },
        '5D': {
          name: 'Kultura Innowacji',
          current: 3,
          target: 4,
          gap: 1,
          evidence: 'Program innowacji wewnętrznych',
        },
        '5E': {
          name: 'Dostępność Zasobów',
          current: 3,
          target: 4,
          gap: 1,
          evidence: 'Budżet IT 4% przychodów',
        },
      },
    },
    // Axis 6: Cybersecurity (5 levels)
    axis6: {
      name: 'Cyberbezpieczeństwo',
      current: 3.4,
      target: 4.4,
      gap: 1.0,
      areaScores: {
        '6A': {
          name: 'Strategia i Zarządzanie Ryzykiem',
          current: 4,
          target: 5,
          gap: 1,
          evidence: 'ISMS wdrożony, ISO 27001',
        },
        '6B': {
          name: 'Ochrona Sieci i Systemów',
          current: 3,
          target: 4,
          gap: 1,
          evidence: 'Firewall, IDS, segmentacja',
        },
        '6C': {
          name: 'Bezpieczeństwo Danych',
          current: 4,
          target: 5,
          gap: 1,
          evidence: 'Szyfrowanie, backup, RODO',
        },
        '6D': {
          name: 'Edukacja i Szkolenia',
          current: 3,
          target: 4,
          gap: 1,
          evidence: 'Szkolenia roczne, phishing tests',
        },
        '6E': {
          name: 'Reagowanie na Incydenty',
          current: 3,
          target: 4,
          gap: 1,
          evidence: 'Plan IR, zespół SOC outsourced',
        },
      },
    },
    // Axis 7: AI Maturity (5 levels)
    axis7: {
      name: 'Dojrzałość AI',
      current: 2.4,
      target: 4.0,
      gap: 1.6,
      areaScores: {
        '7A': {
          name: 'Dane i Fundamenty AI',
          current: 3,
          target: 4,
          gap: 1,
          evidence: 'Data lake w budowie, ETL działa',
        },
        '7B': {
          name: 'Procesy Wspierane przez AI',
          current: 2,
          target: 4,
          gap: 2,
          evidence: 'Pilotaże ML w predykcyjnym utrzymaniu',
        },
        '7C': {
          name: 'AI w Produktach i Usługach',
          current: 2,
          target: 4,
          gap: 2,
          evidence: 'Planowane funkcje AI w produktach',
        },
        '7D': {
          name: 'Governance, Bezpieczeństwo, Etyka',
          current: 2,
          target: 4,
          gap: 2,
          evidence: 'Polityka AI w przygotowaniu',
        },
        '7E': {
          name: 'Kompetencje i Kultura AI',
          current: 3,
          target: 4,
          gap: 1,
          evidence: 'Szkolenia AI dla kadry',
        },
      },
    },
  },

  // Identified strengths
  strengths: [
    'Silna pozycja w digitalizacji procesów produkcyjnych (MES, OEE)',
    'Nowoczesna infrastruktura IT z hybrid cloud',
    'Certyfikacja ISO 27001 i dojrzałe praktyki bezpieczeństwa',
    'Produkty z wbudowanymi funkcjami IoT',
    'Kultura Lean manufacturing wspierająca transformację',
    'Zaangażowany zarząd w transformację cyfrową',
    'Doświadczenie w automatyzacji (robotyzacja linii)',
  ],

  // Identified weaknesses
  weaknesses: [
    'Niska dojrzałość AI - brak operacyjnych wdrożeń ML',
    'Brak strategii monetyzacji danych produktowych',
    'Słaba integracja procesów HR z ekosystemem cyfrowym',
    'Brak platformy ekosystemowej dla partnerów',
    'Niedostateczna automatyzacja procesów logistycznych',
    'Brak zaawansowanej analityki predykcyjnej',
    'Ograniczona skalowalność geograficzna produktów cyfrowych',
  ],
};

// ==========================================
// SIRI SAMPLE ASSESSMENT DATA
// ==========================================

export const SAMPLE_SIRI_ASSESSMENT = {
  id: 'sample-siri-assessment-001',
  name: 'SIRI Assessment - TechProd Manufacturing',
  assessmentType: 'SIRI',
  status: 'APPROVED',
  createdAt: '2026-01-10T09:00:00Z',
  approvedAt: '2026-01-25T16:00:00Z',

  // Overall score
  overallScore: 2.8,
  targetScore: 4.0,

  // Building Block scores
  buildingBlocks: {
    PROCESS: {
      name: 'Process',
      score: 3.0,
      target: 4.2,
      gap: 1.2,
      dimensions: {
        operations: { current: 3.2, target: 4.5, gap: 1.3 },
        supply_chain: { current: 2.8, target: 4.0, gap: 1.2 },
        product_lifecycle: { current: 3.0, target: 4.0, gap: 1.0 },
      },
    },
    TECHNOLOGY: {
      name: 'Technology',
      score: 2.8,
      target: 4.0,
      gap: 1.2,
      dimensions: {
        automation: { current: 3.3, target: 4.5, gap: 1.2 },
        connectivity: { current: 2.7, target: 4.0, gap: 1.3 },
        intelligence: { current: 2.3, target: 3.5, gap: 1.2 },
      },
    },
    ORGANIZATION: {
      name: 'Organization',
      score: 2.6,
      target: 3.8,
      gap: 1.2,
      dimensions: {
        talent_readiness: { current: 2.5, target: 4.0, gap: 1.5 },
        structure_management: { current: 2.7, target: 3.5, gap: 0.8 },
      },
    },
  },

  // Prioritisation areas
  prioritisationAreas: {
    vertical_integration: { score: 3.0, priority: 'high' },
    horizontal_integration: { score: 2.5, priority: 'high' },
    integrated_product_lifecycle: { score: 3.0, priority: 'medium' },
    shop_floor_automation: { score: 3.5, priority: 'medium' },
    enterprise_automation: { score: 3.0, priority: 'high' },
    facility_automation: { score: 2.5, priority: 'low' },
    shop_floor_connectivity: { score: 3.0, priority: 'high' },
    enterprise_connectivity: { score: 2.5, priority: 'high' },
    facility_connectivity: { score: 2.0, priority: 'low' },
    shop_floor_intelligence: { score: 2.5, priority: 'high' },
    enterprise_intelligence: { score: 2.0, priority: 'high' },
    facility_intelligence: { score: 2.0, priority: 'low' },
    workforce_learning: { score: 2.5, priority: 'high' },
    leadership_competency: { score: 3.0, priority: 'medium' },
    strategy_governance: { score: 3.0, priority: 'medium' },
    inter_intra_collaboration: { score: 2.5, priority: 'medium' },
  },

  // Key findings
  keyFindings: [
    'Automatyzacja shop floor na poziomie zintegrowanym (3.5)',
    'Znaczne luki w obszarze Intelligence (AI/ML)',
    'Connectivity wymaga modernizacji IT/OT',
    'Talent readiness to główna bariera transformacji',
    'Supply chain visibility ograniczona',
  ],
};

// ==========================================
// ADMA SAMPLE ASSESSMENT DATA
// ==========================================

export const SAMPLE_ADMA_ASSESSMENT = {
  id: 'sample-adma-assessment-001',
  name: 'ADMA Assessment - TechProd Manufacturing',
  assessmentType: 'ADMA',
  status: 'APPROVED',
  createdAt: '2026-01-12T11:00:00Z',
  approvedAt: '2026-01-26T10:00:00Z',

  // Overall maturity
  overallMaturity: 2.7, // Beginner-Intermediate
  targetMaturity: 3.8,
  maturityLevel: 'Beginner',
  targetLevel: 'Experienced',

  // Pillar scores
  pillars: {
    strategy: {
      name: 'Strategy & Organization',
      namePL: 'Strategia i Organizacja',
      current: 3.0,
      target: 4.0,
      gap: 1.0,
      dimensions: {
        digital_strategy: { current: 3, target: 4, gap: 1 },
        digital_investments: { current: 3, target: 4, gap: 1 },
        digital_culture: { current: 3, target: 4, gap: 1 },
      },
    },
    smart_products: {
      name: 'Smart Products',
      namePL: 'Inteligentne Produkty',
      current: 3.0,
      target: 4.0,
      gap: 1.0,
      dimensions: {
        product_features: { current: 3, target: 4, gap: 1 },
        product_data: { current: 3, target: 4, gap: 1 },
      },
    },
    smart_operations: {
      name: 'Smart Operations',
      namePL: 'Inteligentne Operacje',
      current: 3.0,
      target: 4.5,
      gap: 1.5,
      dimensions: {
        production_tech: { current: 3, target: 5, gap: 2 },
        production_it: { current: 3, target: 4, gap: 1 },
      },
    },
    smart_supply: {
      name: 'Smart Supply Chain',
      namePL: 'Inteligentny Łańcuch Dostaw',
      current: 2.5,
      target: 4.0,
      gap: 1.5,
      dimensions: {
        supply_integration: { current: 3, target: 4, gap: 1 },
        supply_visibility: { current: 2, target: 4, gap: 2 },
      },
    },
    data_driven: {
      name: 'Data-Driven Services',
      namePL: 'Usługi Oparte na Danych',
      current: 2.3,
      target: 3.5,
      gap: 1.2,
      dimensions: {
        data_collection: { current: 3, target: 4, gap: 1 },
        data_analytics: { current: 2, target: 3, gap: 1 },
        data_services: { current: 2, target: 4, gap: 2 },
      },
    },
  },

  // EU benchmarking
  euBenchmark: {
    sectorAverage: 2.5,
    topPerformers: 4.2,
    regionalAverage: 2.3,
    position: 'Above regional average, below sector leaders',
  },

  // Key findings
  keyFindings: [
    'Poziom Intermediate (3.0) w Strategy & Smart Operations',
    'Znaczne luki w Supply Chain Visibility',
    'Data-Driven Services najmniej dojrzały obszar',
    'Powyżej średniej regionalnej EU',
    'Potencjał do finansowania z Digital Europe Programme',
  ],
};

export default {
  SAMPLE_COMPANY_CONTEXT,
  SAMPLE_DRD_ASSESSMENT,
  SAMPLE_SIRI_ASSESSMENT,
  SAMPLE_ADMA_ASSESSMENT,
};
