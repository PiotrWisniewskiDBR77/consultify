/**
 * Digitization Evaluation Data
 *
 * Defines the 6 axes of digital maturity evaluation based on Industry 4.0 standards
 * Each axis contains multiple evaluation areas with 7 maturity levels
 */

export interface DigitizationLevel {
  id: number;
  nameEn: string;
  namePl: string;
  descriptionEn: string;
  descriptionPl: string;
}

export interface DigitizationArea {
  id: string;
  code: string;
  nameEn: string;
  namePl: string;
  descriptionEn: string;
  descriptionPl: string;
  levels: DigitizationLevel[];
}

export interface DigitizationAxis {
  id: string;
  nameEn: string;
  namePl: string;
  descriptionEn: string;
  descriptionPl: string;
  color: string;
  areas: DigitizationArea[];
}

/**
 * Color mapping for maturity levels (1-7)
 */
export const getLevelColor = (level: number): string => {
  const colors: Record<number, string> = {
    0: '#94a3b8', // slate-400 - Not evaluated
    1: '#ef4444', // red-500 - Registration
    2: '#f97316', // orange-500 - Workstation Control
    3: '#f59e0b', // amber-500 - Process Control
    4: '#eab308', // yellow-500 - Automation
    5: '#84cc16', // lime-500 - MES
    6: '#22c55e', // green-500 - ERP
    7: '#10b981', // emerald-500 - Algorithms
  };
  return colors[level] || colors[0];
};

/**
 * The 6 axes of digital maturity evaluation
 */
export const DIGITIZATION_AXES: DigitizationAxis[] = [
  {
    id: 'digital_processes',
    nameEn: 'Digital Processes',
    namePl: 'Procesy cyfrowe',
    descriptionEn: 'Digitization of business and production processes',
    descriptionPl: 'Cyfryzacja procesów biznesowych i produkcyjnych',
    color: '#3b82f6', // blue-500
    areas: [
      {
        id: 'dp_planning',
        code: 'DP.1',
        nameEn: 'Production Planning',
        namePl: 'Planowanie produkcji',
        descriptionEn: 'Digital planning and scheduling systems',
        descriptionPl: 'Cyfrowe systemy planowania i harmonogramowania',
        levels: [
          {
            id: 1,
            nameEn: 'Registration',
            namePl: 'Rejestracja',
            descriptionEn: 'Manual data collection and recording',
            descriptionPl: 'Ręczne zbieranie i rejestrowanie danych',
          },
          {
            id: 2,
            nameEn: 'Workstation Control',
            namePl: 'Kontrola stanowiska',
            descriptionEn: 'Basic workstation-level digital control',
            descriptionPl: 'Podstawowa cyfrowa kontrola na poziomie stanowiska',
          },
          {
            id: 3,
            nameEn: 'Process Control',
            namePl: 'Kontrola procesu',
            descriptionEn: 'Process-level digital monitoring and control',
            descriptionPl: 'Cyfrowy monitoring i kontrola na poziomie procesu',
          },
          {
            id: 4,
            nameEn: 'Automation',
            namePl: 'Automatyzacja',
            descriptionEn: 'Automated process execution',
            descriptionPl: 'Zautomatyzowane wykonywanie procesów',
          },
          {
            id: 5,
            nameEn: 'MES Integration',
            namePl: 'Integracja MES',
            descriptionEn: 'Manufacturing Execution System integration',
            descriptionPl: 'Integracja z systemem wykonawczym produkcji',
          },
          {
            id: 6,
            nameEn: 'ERP Integration',
            namePl: 'Integracja ERP',
            descriptionEn: 'Enterprise Resource Planning integration',
            descriptionPl: 'Integracja z systemem zarządzania przedsiębiorstwem',
          },
          {
            id: 7,
            nameEn: 'AI Algorithms',
            namePl: 'Algorytmy AI',
            descriptionEn: 'AI-driven optimization and decision making',
            descriptionPl: 'Optymalizacja i podejmowanie decyzji oparte na AI',
          },
        ],
      },
    ],
  },
  {
    id: 'digital_products',
    nameEn: 'Digital Products',
    namePl: 'Produkty cyfrowe',
    descriptionEn: 'Digitization of products and services',
    descriptionPl: 'Cyfryzacja produktów i usług',
    color: '#8b5cf6', // violet-500
    areas: [],
  },
  {
    id: 'digital_business_models',
    nameEn: 'Digital Business Models',
    namePl: 'Cyfrowe modele biznesowe',
    descriptionEn: 'Digital transformation of business models',
    descriptionPl: 'Cyfrowa transformacja modeli biznesowych',
    color: '#ec4899', // pink-500
    areas: [],
  },
  {
    id: 'big_data',
    nameEn: 'Big Data & Analytics',
    namePl: 'Big Data i analityka',
    descriptionEn: 'Data collection, analysis, and utilization',
    descriptionPl: 'Zbieranie, analiza i wykorzystanie danych',
    color: '#14b8a6', // teal-500
    areas: [],
  },
  {
    id: 'transformation_culture',
    nameEn: 'Transformation Culture',
    namePl: 'Kultura transformacji',
    descriptionEn: 'Organizational culture and change management',
    descriptionPl: 'Kultura organizacyjna i zarządzanie zmianą',
    color: '#f59e0b', // amber-500
    areas: [],
  },
  {
    id: 'cybersecurity',
    nameEn: 'Cybersecurity',
    namePl: 'Cyberbezpieczeństwo',
    descriptionEn: 'IT security and data protection',
    descriptionPl: 'Bezpieczeństwo IT i ochrona danych',
    color: '#ef4444', // red-500
    areas: [],
  },
];
