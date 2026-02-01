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
  icon: string;
  image: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  externalLink: string;
}

export const AUDIT_METHODOLOGIES: AuditMethodology[] = [
  {
    id: 'drd',
    icon: 'Map',
    image: '/assets/landing/cinematic/industrial_audits.png',
    color: 'blue',
    gradientFrom: 'from-blue-600',
    gradientTo: 'to-indigo-700',
    externalLink: 'https://dbr77.com/drd/',
  },
  {
    id: 'siri',
    icon: 'Compass',
    image: '/assets/landing/cinematic/industrial_audits.png',
    color: 'blue',
    gradientFrom: 'from-blue-700',
    gradientTo: 'to-cyan-800',
    externalLink: 'https://incit.org/siri/',
  },
  {
    id: 'adma',
    icon: 'Factory',
    image: '/assets/landing/cinematic/industrial_audits.png',
    color: 'emerald',
    gradientFrom: 'from-emerald-600',
    gradientTo: 'to-teal-700',
    externalLink: 'https://imfactory.eu/adma-scan/',
  },
  {
    id: 'lean-4-0',
    icon: 'Zap',
    image: '/assets/landing/cinematic/industrial_audits.png',
    color: 'amber',
    gradientFrom: 'from-amber-600',
    gradientTo: 'to-orange-700',
    externalLink: 'https://dbr77.com/',
  },
];

export function getAuditById(id: string): AuditMethodology | undefined {
  return AUDIT_METHODOLOGIES.find((audit) => audit.id === id);
}
