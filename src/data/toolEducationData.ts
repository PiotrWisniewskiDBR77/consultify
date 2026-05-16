/**
 * Tool Education Data
 *
 * Centralized data for the 4 thematic education blocks:
 * 1. Strategic Consulting Tools
 * 2. Operational Tools
 * 3. Digital Transformation
 * 4. Change Management
 */

export type EducationBlockType = 'strategic' | 'operational' | 'digital' | 'change-management';

export interface EducationTool {
  id: string;
  block: EducationBlockType;
  icon: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  featured: boolean;
}

export interface EducationBlock {
  id: EducationBlockType;
  icon: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
}

// ============================================
// EDUCATION BLOCKS
// ============================================

export const EDUCATION_BLOCKS: EducationBlock[] = [
  {
    id: 'strategic',
    icon: 'Target',
    color: 'emerald',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-blue-600',
  },
  {
    id: 'operational',
    icon: 'Settings',
    color: 'blue',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-blue-600',
  },
  {
    id: 'digital',
    icon: 'Zap',
    color: 'violet',
    gradientFrom: 'from-primary-500',
    gradientTo: 'to-primary-600',
  },
  {
    id: 'change-management',
    icon: 'Users',
    color: 'amber',
    gradientFrom: 'from-amber-500',
    gradientTo: 'to-amber-600',
  },
];

// ============================================
// EDUCATION TOOLS
// ============================================

export const EDUCATION_TOOLS: EducationTool[] = [
  // --- STRATEGIC TOOLS ---
  {
    id: 'dynamic-swot',
    block: 'strategic',
    icon: 'Grid3x3',
    featured: true,
  },
  {
    id: 'market-forces',
    block: 'strategic',
    icon: 'Target',
    featured: true,
  },
  {
    id: 'portfolio-priority',
    block: 'strategic',
    icon: 'PieChart',
    featured: true,
  },
  {
    id: 'growth-paths',
    block: 'strategic',
    icon: 'GitBranch',
    featured: false,
  },
  {
    id: 'value-chain',
    block: 'strategic',
    icon: 'Layers',
    featured: false,
  },

  // --- OPERATIONAL TOOLS ---
  {
    id: 'value-stream-mapping',
    block: 'operational',
    icon: 'GitBranch',
    featured: true,
  },
  {
    id: 'oee-analysis',
    block: 'operational',
    icon: 'Activity',
    featured: true,
  },
  {
    id: 'lean-assessment',
    block: 'operational',
    icon: 'BarChart3',
    featured: true,
  },
  {
    id: 'process-capability',
    block: 'operational',
    icon: 'TrendingUp',
    featured: false,
  },

  // --- DIGITAL TRANSFORMATION TOOLS ---
  {
    id: 'digital-maturity',
    block: 'digital',
    icon: 'Gauge',
    featured: true,
  },
  {
    id: 'automation-roadmap',
    block: 'digital',
    icon: 'Bot',
    featured: true,
  },
  {
    id: 'technology-scanner',
    block: 'digital',
    icon: 'Radar',
    featured: true,
  },
  {
    id: 'data-strategy',
    block: 'digital',
    icon: 'Database',
    featured: false,
  },

  // --- CHANGE MANAGEMENT TOOLS ---
  {
    id: 'adkar-assessment',
    block: 'change-management',
    icon: 'UserCheck',
    featured: true,
  },
  {
    id: 'stakeholder-analysis',
    block: 'change-management',
    icon: 'Users',
    featured: true,
  },
  {
    id: 'resistance-mapper',
    block: 'change-management',
    icon: 'Shield',
    featured: true,
  },
  {
    id: 'communication-planner',
    block: 'change-management',
    icon: 'MessageSquare',
    featured: false,
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getToolsByBlock(block: EducationBlockType): EducationTool[] {
  return EDUCATION_TOOLS.filter((tool) => tool.block === block);
}

export function getFeaturedToolsByBlock(block: EducationBlockType): EducationTool[] {
  return EDUCATION_TOOLS.filter((tool) => tool.block === block && tool.featured);
}

export function getBlockById(blockId: EducationBlockType): EducationBlock | undefined {
  return EDUCATION_BLOCKS.find((block) => block.id === blockId);
}

export function getAllFeaturedTools(): EducationTool[] {
  return EDUCATION_TOOLS.filter((tool) => tool.featured);
}
