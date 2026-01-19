/**
 * Industry Templates for Strategic Analysis Tools
 *
 * Pre-filled templates for common industries to accelerate analysis.
 * Users can select a template as a starting point and customize.
 */

import { SWOTItem, SWOTData } from '@/store/useToolStore';
import { ForceData, PorterData } from '@/store/useToolStore';

// ==================== TYPES ====================

export interface IndustryTemplate {
  id: string;
  name: { en: string; pl: string };
  description: { en: string; pl: string };
  icon: string;
  category: 'technology' | 'manufacturing' | 'services' | 'retail' | 'healthcare' | 'finance';
}

export interface SWOTTemplate extends IndustryTemplate {
  type: 'swot';
  data: {
    strengths: Array<{ text: string; textPl: string; impact: 'high' | 'medium' | 'low' }>;
    weaknesses: Array<{ text: string; textPl: string; impact: 'high' | 'medium' | 'low' }>;
    opportunities: Array<{ text: string; textPl: string; impact: 'high' | 'medium' | 'low' }>;
    threats: Array<{ text: string; textPl: string; impact: 'high' | 'medium' | 'low' }>;
  };
}

export interface PorterTemplate extends IndustryTemplate {
  type: 'porter';
  data: {
    rivalry: { score: number; drivers: string[]; driversPl: string[] };
    newEntrants: { score: number; drivers: string[]; driversPl: string[] };
    substitutes: { score: number; drivers: string[]; driversPl: string[] };
    buyerPower: { score: number; drivers: string[]; driversPl: string[] };
    supplierPower: { score: number; drivers: string[]; driversPl: string[] };
  };
}

// ==================== SWOT TEMPLATES ====================

export const SWOT_TEMPLATES: SWOTTemplate[] = [
  {
    id: 'saas-b2b',
    name: { en: 'B2B SaaS Company', pl: 'Firma SaaS B2B' },
    description: { en: 'Software-as-a-Service for business customers', pl: 'Oprogramowanie jako usługa dla klientów biznesowych' },
    icon: '💻',
    category: 'technology',
    type: 'swot',
    data: {
      strengths: [
        { text: 'Recurring revenue model with high retention', textPl: 'Model przychodów cyklicznych z wysoką retencją', impact: 'high' },
        { text: 'Scalable cloud infrastructure', textPl: 'Skalowalna infrastruktura chmurowa', impact: 'high' },
        { text: 'Strong product-market fit', textPl: 'Silne dopasowanie produkt-rynek', impact: 'medium' },
        { text: 'Data-driven decision making capabilities', textPl: 'Możliwości podejmowania decyzji opartych na danych', impact: 'medium' },
      ],
      weaknesses: [
        { text: 'High customer acquisition costs', textPl: 'Wysokie koszty pozyskania klienta', impact: 'high' },
        { text: 'Dependency on key technical talent', textPl: 'Zależność od kluczowych talentów technicznych', impact: 'medium' },
        { text: 'Long sales cycles for enterprise deals', textPl: 'Długie cykle sprzedażowe dla dużych klientów', impact: 'medium' },
        { text: 'Technical debt from rapid growth', textPl: 'Dług techniczny z powodu szybkiego wzrostu', impact: 'low' },
      ],
      opportunities: [
        { text: 'AI/ML integration for enhanced features', textPl: 'Integracja AI/ML dla ulepszonych funkcji', impact: 'high' },
        { text: 'International market expansion', textPl: 'Ekspansja na rynki międzynarodowe', impact: 'high' },
        { text: 'Platform/ecosystem play with integrations', textPl: 'Strategia platformy/ekosystemu z integracjami', impact: 'medium' },
        { text: 'Vertical specialization opportunities', textPl: 'Możliwości specjalizacji branżowej', impact: 'medium' },
      ],
      threats: [
        { text: 'Increasing competition from well-funded startups', textPl: 'Rosnąca konkurencja od dobrze sfinansowanych startupów', impact: 'high' },
        { text: 'Economic downturn affecting IT budgets', textPl: 'Spowolnienie gospodarcze wpływające na budżety IT', impact: 'high' },
        { text: 'Data security and privacy regulations', textPl: 'Regulacje bezpieczeństwa danych i prywatności', impact: 'medium' },
        { text: 'Platform risk (dependency on cloud providers)', textPl: 'Ryzyko platformowe (zależność od dostawców chmury)', impact: 'medium' },
      ],
    },
  },
  {
    id: 'manufacturing',
    name: { en: 'Manufacturing Company', pl: 'Firma Produkcyjna' },
    description: { en: 'Industrial manufacturing and production', pl: 'Produkcja przemysłowa' },
    icon: '🏭',
    category: 'manufacturing',
    type: 'swot',
    data: {
      strengths: [
        { text: 'Established production capabilities', textPl: 'Ugruntowane zdolności produkcyjne', impact: 'high' },
        { text: 'Strong supplier relationships', textPl: 'Silne relacje z dostawcami', impact: 'medium' },
        { text: 'Quality control expertise', textPl: 'Ekspertyza w kontroli jakości', impact: 'high' },
        { text: 'Experienced workforce', textPl: 'Doświadczona kadra', impact: 'medium' },
      ],
      weaknesses: [
        { text: 'High fixed costs and capital requirements', textPl: 'Wysokie koszty stałe i wymogi kapitałowe', impact: 'high' },
        { text: 'Legacy systems and processes', textPl: 'Przestarzałe systemy i procesy', impact: 'medium' },
        { text: 'Limited digital capabilities', textPl: 'Ograniczone możliwości cyfrowe', impact: 'medium' },
        { text: 'Supply chain vulnerabilities', textPl: 'Podatności łańcucha dostaw', impact: 'high' },
      ],
      opportunities: [
        { text: 'Industry 4.0 and automation', textPl: 'Przemysł 4.0 i automatyzacja', impact: 'high' },
        { text: 'Sustainable/green manufacturing demand', textPl: 'Popyt na zrównoważoną/ekologiczną produkcję', impact: 'high' },
        { text: 'Nearshoring trends', textPl: 'Trendy nearshoringu', impact: 'medium' },
        { text: 'Custom/personalized production', textPl: 'Produkcja niestandardowa/spersonalizowana', impact: 'medium' },
      ],
      threats: [
        { text: 'Global supply chain disruptions', textPl: 'Globalne zakłócenia łańcucha dostaw', impact: 'high' },
        { text: 'Rising energy and raw material costs', textPl: 'Rosnące koszty energii i surowców', impact: 'high' },
        { text: 'Skilled labor shortage', textPl: 'Niedobór wykwalifikowanej siły roboczej', impact: 'medium' },
        { text: 'Environmental regulations compliance', textPl: 'Zgodność z regulacjami środowiskowymi', impact: 'medium' },
      ],
    },
  },
  {
    id: 'e-commerce',
    name: { en: 'E-commerce Retailer', pl: 'Sprzedawca E-commerce' },
    description: { en: 'Online retail and digital commerce', pl: 'Handel detaliczny online' },
    icon: '🛒',
    category: 'retail',
    type: 'swot',
    data: {
      strengths: [
        { text: 'Direct customer relationship and data', textPl: 'Bezpośrednia relacja z klientem i dane', impact: 'high' },
        { text: 'Lower overhead than physical retail', textPl: 'Niższe koszty ogólne niż tradycyjny handel', impact: 'high' },
        { text: 'Scalable digital platform', textPl: 'Skalowalna platforma cyfrowa', impact: 'medium' },
        { text: 'Flexible pricing and promotions', textPl: 'Elastyczne ceny i promocje', impact: 'medium' },
      ],
      weaknesses: [
        { text: 'High customer acquisition costs', textPl: 'Wysokie koszty pozyskania klienta', impact: 'high' },
        { text: 'Returns and logistics complexity', textPl: 'Złożoność zwrotów i logistyki', impact: 'medium' },
        { text: 'Dependency on marketplace platforms', textPl: 'Zależność od platform marketplace', impact: 'medium' },
        { text: 'Limited physical brand presence', textPl: 'Ograniczona fizyczna obecność marki', impact: 'low' },
      ],
      opportunities: [
        { text: 'Social commerce growth', textPl: 'Wzrost social commerce', impact: 'high' },
        { text: 'Subscription model expansion', textPl: 'Ekspansja modelu subskrypcyjnego', impact: 'medium' },
        { text: 'Omnichannel integration', textPl: 'Integracja omnichannel', impact: 'high' },
        { text: 'Cross-border e-commerce', textPl: 'E-commerce transgraniczny', impact: 'medium' },
      ],
      threats: [
        { text: 'Amazon and marketplace competition', textPl: 'Konkurencja Amazon i marketplace', impact: 'high' },
        { text: 'Rising digital advertising costs', textPl: 'Rosnące koszty reklamy cyfrowej', impact: 'high' },
        { text: 'Privacy changes affecting targeting', textPl: 'Zmiany prywatności wpływające na targetowanie', impact: 'medium' },
        { text: 'Shipping cost inflation', textPl: 'Inflacja kosztów wysyłki', impact: 'medium' },
      ],
    },
  },
  {
    id: 'healthcare-provider',
    name: { en: 'Healthcare Provider', pl: 'Dostawca Usług Medycznych' },
    description: { en: 'Medical services and patient care', pl: 'Usługi medyczne i opieka nad pacjentem' },
    icon: '🏥',
    category: 'healthcare',
    type: 'swot',
    data: {
      strengths: [
        { text: 'Specialized medical expertise', textPl: 'Specjalistyczna wiedza medyczna', impact: 'high' },
        { text: 'Established patient base and referral network', textPl: 'Ugruntowana baza pacjentów i sieć poleceń', impact: 'high' },
        { text: 'Regulatory compliance track record', textPl: 'Historia zgodności regulacyjnej', impact: 'medium' },
        { text: 'Quality certifications and accreditations', textPl: 'Certyfikaty jakości i akredytacje', impact: 'medium' },
      ],
      weaknesses: [
        { text: 'High operational costs', textPl: 'Wysokie koszty operacyjne', impact: 'high' },
        { text: 'Complex billing and insurance processes', textPl: 'Złożone procesy rozliczeń i ubezpieczeń', impact: 'medium' },
        { text: 'Staff burnout and turnover', textPl: 'Wypalenie i rotacja personelu', impact: 'high' },
        { text: 'Legacy IT systems', textPl: 'Przestarzałe systemy IT', impact: 'medium' },
      ],
      opportunities: [
        { text: 'Telehealth and digital health expansion', textPl: 'Ekspansja telemedycyny i zdrowia cyfrowego', impact: 'high' },
        { text: 'Value-based care models', textPl: 'Modele opieki opartej na wartości', impact: 'high' },
        { text: 'AI-assisted diagnostics', textPl: 'Diagnostyka wspomagana AI', impact: 'medium' },
        { text: 'Preventive care focus', textPl: 'Fokus na opiekę prewencyjną', impact: 'medium' },
      ],
      threats: [
        { text: 'Regulatory and reimbursement changes', textPl: 'Zmiany regulacyjne i refundacyjne', impact: 'high' },
        { text: 'Healthcare worker shortage', textPl: 'Niedobór pracowników ochrony zdrowia', impact: 'high' },
        { text: 'Cybersecurity and data breach risks', textPl: 'Ryzyko cyberbezpieczeństwa i wycieku danych', impact: 'medium' },
        { text: 'New market entrants (tech companies)', textPl: 'Nowi gracze rynkowi (firmy technologiczne)', impact: 'medium' },
      ],
    },
  },
  {
    id: 'fintech',
    name: { en: 'Fintech Company', pl: 'Firma Fintech' },
    description: { en: 'Financial technology and digital banking', pl: 'Technologia finansowa i bankowość cyfrowa' },
    icon: '💳',
    category: 'finance',
    type: 'swot',
    data: {
      strengths: [
        { text: 'Superior user experience and digital-first design', textPl: 'Doskonałe UX i projektowanie digital-first', impact: 'high' },
        { text: 'Lower cost structure than traditional banks', textPl: 'Niższa struktura kosztów niż tradycyjne banki', impact: 'high' },
        { text: 'Agile development and fast iteration', textPl: 'Zwinne programowanie i szybka iteracja', impact: 'medium' },
        { text: 'Data analytics capabilities', textPl: 'Możliwości analityki danych', impact: 'medium' },
      ],
      weaknesses: [
        { text: 'Regulatory compliance challenges', textPl: 'Wyzwania zgodności regulacyjnej', impact: 'high' },
        { text: 'Building trust vs established banks', textPl: 'Budowanie zaufania wobec ugruntowanych banków', impact: 'medium' },
        { text: 'Capital requirements for scaling', textPl: 'Wymogi kapitałowe dla skalowania', impact: 'medium' },
        { text: 'Dependency on banking partners', textPl: 'Zależność od partnerów bankowych', impact: 'medium' },
      ],
      opportunities: [
        { text: 'Open banking and API economy', textPl: 'Open banking i ekonomia API', impact: 'high' },
        { text: 'Embedded finance growth', textPl: 'Wzrost embedded finance', impact: 'high' },
        { text: 'Underserved market segments', textPl: 'Niedostatecznie obsługiwane segmenty rynku', impact: 'medium' },
        { text: 'Crypto and blockchain integration', textPl: 'Integracja krypto i blockchain', impact: 'medium' },
      ],
      threats: [
        { text: 'Tightening regulations', textPl: 'Zaostrzające się regulacje', impact: 'high' },
        { text: 'Traditional banks digital transformation', textPl: 'Transformacja cyfrowa tradycyjnych banków', impact: 'high' },
        { text: 'Economic downturn affecting funding', textPl: 'Spowolnienie gospodarcze wpływające na finansowanie', impact: 'medium' },
        { text: 'Fraud and cybersecurity threats', textPl: 'Zagrożenia oszustwami i cyberbezpieczeństwem', impact: 'high' },
      ],
    },
  },
];

// ==================== PORTER TEMPLATES ====================

export const PORTER_TEMPLATES: PorterTemplate[] = [
  {
    id: 'saas-industry',
    name: { en: 'SaaS Industry', pl: 'Branża SaaS' },
    description: { en: 'Cloud software subscription market', pl: 'Rynek subskrypcji oprogramowania chmurowego' },
    icon: '☁️',
    category: 'technology',
    type: 'porter',
    data: {
      rivalry: {
        score: 4,
        drivers: ['Many competitors', 'Low switching costs', 'Fast innovation cycles'],
        driversPl: ['Wielu konkurentów', 'Niskie koszty zmiany', 'Szybkie cykle innowacji'],
      },
      newEntrants: {
        score: 4,
        drivers: ['Low capital requirements', 'Cloud infrastructure accessible', 'Open source alternatives'],
        driversPl: ['Niskie wymogi kapitałowe', 'Dostępna infrastruktura chmurowa', 'Alternatywy open source'],
      },
      substitutes: {
        score: 3,
        drivers: ['DIY solutions', 'In-house development', 'Alternative technologies'],
        driversPl: ['Rozwiązania DIY', 'Wewnętrzny rozwój', 'Alternatywne technologie'],
      },
      buyerPower: {
        score: 3,
        drivers: ['Many alternatives', 'Price transparency', 'Negotiation leverage for enterprise'],
        driversPl: ['Wiele alternatyw', 'Transparentność cen', 'Siła negocjacyjna dla enterprise'],
      },
      supplierPower: {
        score: 2,
        drivers: ['Cloud providers concentrated', 'Developer talent scarce', 'API dependencies'],
        driversPl: ['Skoncentrowani dostawcy chmury', 'Deficyt talentów deweloperskich', 'Zależności API'],
      },
    },
  },
  {
    id: 'retail-grocery',
    name: { en: 'Retail Grocery', pl: 'Handel Spożywczy' },
    description: { en: 'Food and grocery retail market', pl: 'Rynek handlu detalicznego żywnością' },
    icon: '🛒',
    category: 'retail',
    type: 'porter',
    data: {
      rivalry: {
        score: 5,
        drivers: ['Thin margins', 'Many players', 'Price-sensitive consumers'],
        driversPl: ['Niskie marże', 'Wielu graczy', 'Wrażliwi cenowo konsumenci'],
      },
      newEntrants: {
        score: 2,
        drivers: ['High capital requirements', 'Established supply chains needed', 'Real estate challenges'],
        driversPl: ['Wysokie wymogi kapitałowe', 'Potrzebne ugruntowane łańcuchy dostaw', 'Wyzwania nieruchomościowe'],
      },
      substitutes: {
        score: 3,
        drivers: ['Restaurant delivery', 'Meal kits', 'Direct-to-consumer brands'],
        driversPl: ['Dostawy restauracyjne', 'Zestawy posiłkowe', 'Marki direct-to-consumer'],
      },
      buyerPower: {
        score: 4,
        drivers: ['Price comparison easy', 'Low switching costs', 'Many alternatives'],
        driversPl: ['Łatwe porównanie cen', 'Niskie koszty zmiany', 'Wiele alternatyw'],
      },
      supplierPower: {
        score: 3,
        drivers: ['Large retailers have leverage', 'Private labels growing', 'Some branded products essential'],
        driversPl: ['Duzi detaliści mają przewagę', 'Marki własne rosną', 'Niektóre markowe produkty niezbędne'],
      },
    },
  },
  {
    id: 'healthcare-services',
    name: { en: 'Healthcare Services', pl: 'Usługi Medyczne' },
    description: { en: 'Medical and healthcare services market', pl: 'Rynek usług medycznych i opieki zdrowotnej' },
    icon: '🏥',
    category: 'healthcare',
    type: 'porter',
    data: {
      rivalry: {
        score: 3,
        drivers: ['Regional concentration', 'Reputation matters', 'Specialization reduces direct competition'],
        driversPl: ['Koncentracja regionalna', 'Reputacja ma znaczenie', 'Specjalizacja zmniejsza bezpośrednią konkurencję'],
      },
      newEntrants: {
        score: 2,
        drivers: ['Heavy regulation', 'Capital intensive', 'Licensing requirements'],
        driversPl: ['Silna regulacja', 'Kapitałochłonność', 'Wymogi licencyjne'],
      },
      substitutes: {
        score: 2,
        drivers: ['Telehealth growing', 'Wellness apps', 'Prevention focus'],
        driversPl: ['Wzrost telemedycyny', 'Aplikacje wellness', 'Fokus na prewencję'],
      },
      buyerPower: {
        score: 3,
        drivers: ['Insurance intermediaries', 'Limited price transparency', 'Emergency needs reduce power'],
        driversPl: ['Pośrednicy ubezpieczeniowi', 'Ograniczona transparentność cen', 'Nagłe potrzeby zmniejszają siłę'],
      },
      supplierPower: {
        score: 4,
        drivers: ['Medical equipment specialized', 'Pharmaceutical pricing', 'Healthcare worker shortage'],
        driversPl: ['Wyspecjalizowany sprzęt medyczny', 'Ceny farmaceutyków', 'Niedobór pracowników ochrony zdrowia'],
      },
    },
  },
];

// ==================== HELPER FUNCTIONS ====================

export const getTemplatesByCategory = (
  templates: (SWOTTemplate | PorterTemplate)[],
  category: IndustryTemplate['category']
) => {
  return templates.filter((t) => t.category === category);
};

export const applySwotTemplate = (
  template: SWOTTemplate,
  isPolish: boolean
): Partial<SWOTData> => {
  const lang = isPolish ? 'textPl' : 'text';

  const items: Omit<SWOTItem, 'id'>[] = [
    ...template.data.strengths.map((s) => ({
      text: s[lang],
      impact: s.impact,
      quadrant: 'strengths' as const,
      source: 'ai' as const,
    })),
    ...template.data.weaknesses.map((w) => ({
      text: w[lang],
      impact: w.impact,
      quadrant: 'weaknesses' as const,
      source: 'ai' as const,
    })),
    ...template.data.opportunities.map((o) => ({
      text: o[lang],
      impact: o.impact,
      quadrant: 'opportunities' as const,
      source: 'ai' as const,
    })),
    ...template.data.threats.map((t) => ({
      text: t[lang],
      impact: t.impact,
      quadrant: 'threats' as const,
      source: 'ai' as const,
    })),
  ];

  return { items } as Partial<SWOTData>;
};

export const applyPorterTemplate = (
  template: PorterTemplate,
  isPolish: boolean
): Partial<PorterData> => {
  const lang = isPolish ? 'driversPl' : 'drivers';

  return {
    forces: {
      rivalry: {
        id: 'rivalry',
        name: isPolish ? 'Rywalizacja konkurencyjna' : 'Competitive Rivalry',
        score: template.data.rivalry.score,
        trend: 'stable',
        drivers: template.data.rivalry[lang],
      },
      newEntrants: {
        id: 'newEntrants',
        name: isPolish ? 'Nowi gracze' : 'New Entrants',
        score: template.data.newEntrants.score,
        trend: 'stable',
        drivers: template.data.newEntrants[lang],
      },
      substitutes: {
        id: 'substitutes',
        name: isPolish ? 'Substytuty' : 'Substitutes',
        score: template.data.substitutes.score,
        trend: 'stable',
        drivers: template.data.substitutes[lang],
      },
      buyerPower: {
        id: 'buyerPower',
        name: isPolish ? 'Siła nabywców' : 'Buyer Power',
        score: template.data.buyerPower.score,
        trend: 'stable',
        drivers: template.data.buyerPower[lang],
      },
      supplierPower: {
        id: 'supplierPower',
        name: isPolish ? 'Siła dostawców' : 'Supplier Power',
        score: template.data.supplierPower.score,
        trend: 'stable',
        drivers: template.data.supplierPower[lang],
      },
    },
  } as Partial<PorterData>;
};

export default {
  SWOT_TEMPLATES,
  PORTER_TEMPLATES,
  getTemplatesByCategory,
  applySwotTemplate,
  applyPorterTemplate,
};
