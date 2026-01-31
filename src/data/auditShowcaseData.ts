/**
 * Audit Showcase Data
 *
 * Centralized data for the 4 key industrial audit methodologies:
 * 1. DRD (Digital Readiness Diagnosis)
 * 2. SIRI (Smart Industry Readiness Index)
 * 3. ADMA (Advanced Digital Maturity Assessment)
 * 4. Lean 4.0 (DBR77 Methodology)
 */

export interface AuditMethodology {
  id: string;
  name: string;
  fullName: string;
  description: string;
  longDescription: string;
  icon: string;
  image: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  externalLink: string;
  externalLinkLabel: string;
  keyDimensions: string[];
  benefits: string[];
}

export const AUDIT_METHODOLOGIES: AuditMethodology[] = [
  {
    id: 'drd',
    name: 'DRD',
    fullName: 'Digital Readiness Diagnosis',
    description: 'Advanced tool for assessing digital maturity and creating development roadmaps.',
    longDescription:
      'Digital Readiness Diagnosis (DRD) is a proprietary DBR77 methodology designed to support companies in their digital transformation journey. It covers assessment of digital maturity, analysis of external factors, and creation of detailed development roadmaps.',
    icon: 'Map',
    image: '/assets/landing/cinematic/industrial_audits.png',
    color: 'blue',
    gradientFrom: 'from-blue-600',
    gradientTo: 'to-indigo-700',
    externalLink: 'https://dbr77.com/drd/',
    externalLinkLabel: 'About DRD',
    keyDimensions: [
      'Organizational Readiness',
      'Digital Maturity',
      'External Factors',
      'Development Roadmap',
    ],
    benefits: [
      'Structured Transformation',
      'Clear Investment Path',
      'Risk Mitigation',
      'Strategic Alignment',
    ],
  },
  {
    id: 'siri',
    name: 'SIRI',
    fullName: 'Smart Industry Readiness Index',
    description: 'Global standard for evaluating Industry 4.0 maturity across 3 key pillars.',
    longDescription:
      'The Smart Industry Readiness Index (SIRI) is a global initiative created in partnership with the Singapore EDB and WEF. As the international standard for I4.0, it evaluates 16 dimensions across Process, Technology, and Organization to prioritize transformation efforts.',
    icon: 'Compass',
    image: '/assets/landing/cinematic/industrial_audits.png',
    color: 'blue',
    gradientFrom: 'from-blue-700',
    gradientTo: 'to-cyan-800',
    externalLink: 'https://incit.org/siri/',
    externalLinkLabel: 'About SIRI',
    keyDimensions: [
      'Process Maturity',
      'Technology Adoption',
      'Organizational Excellence',
      'Industry 4.0 Alignment',
    ],
    benefits: [
      'Global Benchmarking',
      'Standardized Framework',
      'Cross-Industry Comparison',
      'Strategic Prioritization',
    ],
  },
  {
    id: 'adma',
    name: 'ADMA',
    fullName: 'Advanced Digital Maturity Assessment',
    description: 'European standard for "Factory of the Future" digital transformation audits.',
    longDescription:
      "ADMA was developed by the European Commission to assist companies in adopting advanced manufacturing technologies. It assesses a company's digital maturity across seven key areas, guiding them towards becoming a world-class Factory of the Future.",
    icon: 'Factory',
    image: '/assets/landing/cinematic/industrial_audits.png',
    color: 'emerald',
    gradientFrom: 'from-emerald-600',
    gradientTo: 'to-teal-700',
    externalLink: 'https://imfactory.eu/adma-scan/',
    externalLinkLabel: 'About ADMA',
    keyDimensions: [
      'Advanced Technologies',
      'Digital Factory',
      'Value Chain Integration',
      'People-Centric Change',
    ],
    benefits: [
      'European Standards',
      'Factory of the Future Roadmap',
      'Innovation Focus',
      'Eco-System Integration',
    ],
  },
  {
    id: 'lean-4-0',
    name: 'Lean 4.0',
    fullName: 'Lean 4.0 (DBR77 Methodology)',
    description: '3-Phase optimization path: Measure, Optimize, and Automate.',
    longDescription:
      'Lean 4.0 is a specialized DBR77 methodology that bridges classic Lean manufacturing with Industry 4.0 technology. It follows a rigorous 3-phase path: Measure (establishing data-driven baselines), Optimize (eliminating waste), and Automate (high-ROI technology injection).',
    icon: 'Zap',
    image: '/assets/landing/cinematic/industrial_audits.png',
    color: 'amber',
    gradientFrom: 'from-amber-600',
    gradientTo: 'to-orange-700',
    externalLink: 'https://dbr77.com/',
    externalLinkLabel: 'About Lean 4.0',
    keyDimensions: ['Measure', 'Optimize', 'Automate', 'ROI Focus'],
    benefits: [
      'Waste Elimination',
      'Data-Driven Baselines',
      'High-ROI Automation',
      'Operational Stabilisation',
    ],
  },
];

export function getAuditById(id: string): AuditMethodology | undefined {
  return AUDIT_METHODOLOGIES.find((audit) => audit.id === id);
}
