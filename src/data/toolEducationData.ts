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
  name: string;
  framework: string;
  description: string;
  icon: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  outputs: string[];
  featured: boolean;
}

export interface EducationBlock {
  id: EducationBlockType;
  name: string;
  description: string;
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
    name: 'Strategic Consulting Tools',
    description: 'Classic frameworks powered by AI for strategic analysis and decision-making',
    icon: 'Target',
    color: 'emerald',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-teal-600',
  },
  {
    id: 'operational',
    name: 'Operational Excellence Tools',
    description: 'Process optimization, efficiency analysis, and lean manufacturing tools',
    icon: 'Settings',
    color: 'blue',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-cyan-600',
  },
  {
    id: 'digital',
    name: 'Digital Transformation',
    description: 'Technology assessment, automation roadmaps, and digital maturity tools',
    icon: 'Zap',
    color: 'violet',
    gradientFrom: 'from-violet-500',
    gradientTo: 'to-purple-600',
  },
  {
    id: 'change-management',
    name: 'Change Management',
    description: 'People-centric tools for adoption, communication, and organizational change',
    icon: 'Users',
    color: 'amber',
    gradientFrom: 'from-amber-500',
    gradientTo: 'to-orange-600',
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
    name: 'Dynamic SWOT Analysis',
    framework: 'SWOT Analysis',
    description:
      'AI-driven SWOT that connects strengths with opportunities and weaknesses with threats to generate actionable strategic initiatives.',
    icon: 'Grid3x3',
    outputs: ['SWOT Matrix', 'S+O/W+T Combinations', 'Strategic Initiatives'],
    featured: true,
  },
  {
    id: 'market-forces',
    block: 'strategic',
    name: 'Market Forces Analysis',
    framework: "Porter's 5 Forces",
    description:
      'Analyze competitive forces with data-driven scoring and margin protection initiatives for sustainable competitive advantage.',
    icon: 'Target',
    outputs: ['5 Forces Diagram', 'Margin Risk Assessment', 'Competitive Initiatives'],
    featured: true,
  },
  {
    id: 'portfolio-priority',
    block: 'strategic',
    name: 'Strategic Portfolio Prioritization',
    framework: 'BCG Matrix',
    description:
      'Classify and prioritize strategic initiatives based on impact potential and resource constraints using proven BCG methodology.',
    icon: 'PieChart',
    outputs: ['BCG-style Grid', 'Priority Ranking', 'Stop/Scale/Merge Decisions'],
    featured: true,
  },
  {
    id: 'growth-paths',
    block: 'strategic',
    name: 'Growth Paths Analysis',
    framework: 'Ansoff Matrix',
    description:
      'Map growth opportunities with ROI estimates, risk profiles, and capability requirements for strategic expansion.',
    icon: 'GitBranch',
    outputs: ['Ansoff Matrix', 'Growth ROI Estimates', 'Capability Gap Analysis'],
    featured: false,
  },
  {
    id: 'value-chain',
    block: 'strategic',
    name: 'Value Chain Analysis',
    framework: 'Porter Value Chain',
    description:
      'Identify where value is created and leaked across activities, with optimization initiatives.',
    icon: 'Layers',
    outputs: ['Value Chain Map', 'Leakage Points', 'Optimization Initiatives'],
    featured: false,
  },

  // --- OPERATIONAL TOOLS ---
  {
    id: 'value-stream-mapping',
    block: 'operational',
    name: 'Value Stream Mapping',
    framework: 'Lean Manufacturing',
    description:
      'Visualize end-to-end process flows, identify waste, and design future-state optimized value streams.',
    icon: 'GitBranch',
    outputs: ['Current State Map', 'Waste Identification', 'Future State Design'],
    featured: true,
  },
  {
    id: 'oee-analysis',
    block: 'operational',
    name: 'OEE Analysis',
    framework: 'Overall Equipment Effectiveness',
    description:
      'Measure and improve equipment effectiveness by analyzing availability, performance, and quality metrics.',
    icon: 'Activity',
    outputs: ['OEE Dashboard', 'Loss Waterfall', 'Improvement Actions'],
    featured: true,
  },
  {
    id: 'lean-assessment',
    block: 'operational',
    name: 'Lean Maturity Assessment',
    framework: 'Lean 4.0',
    description:
      'Assess organizational lean maturity across key dimensions and identify improvement opportunities.',
    icon: 'BarChart3',
    outputs: ['Maturity Scorecard', 'Gap Analysis', 'Improvement Roadmap'],
    featured: true,
  },
  {
    id: 'process-capability',
    block: 'operational',
    name: 'Process Capability Analysis',
    framework: 'Six Sigma',
    description:
      'Evaluate process performance against specifications and identify variation reduction opportunities.',
    icon: 'TrendingUp',
    outputs: ['Capability Metrics', 'Control Charts', 'Improvement Projects'],
    featured: false,
  },

  // --- DIGITAL TRANSFORMATION TOOLS ---
  {
    id: 'digital-maturity',
    block: 'digital',
    name: 'Digital Maturity Assessment',
    framework: 'SIRI / Industry 4.0',
    description:
      'Evaluate digital readiness across technology, processes, and people dimensions using industry-standard frameworks.',
    icon: 'Gauge',
    outputs: ['Maturity Radar', 'Benchmark Comparison', 'Transformation Roadmap'],
    featured: true,
  },
  {
    id: 'automation-roadmap',
    block: 'digital',
    name: 'Automation Roadmap Builder',
    framework: 'RPA / AI Implementation',
    description:
      'Identify automation opportunities, prioritize use cases, and build a phased implementation roadmap.',
    icon: 'Bot',
    outputs: ['Opportunity Matrix', 'ROI Projections', 'Implementation Timeline'],
    featured: true,
  },
  {
    id: 'technology-scanner',
    block: 'digital',
    name: 'Technology Landscape Scanner',
    framework: 'Technology Radar',
    description:
      'Scan emerging technologies relevant to your industry and assess adoption readiness.',
    icon: 'Radar',
    outputs: ['Technology Radar', 'Adoption Assessment', 'Pilot Recommendations'],
    featured: true,
  },
  {
    id: 'data-strategy',
    block: 'digital',
    name: 'Data Strategy Framework',
    framework: 'Data Governance',
    description:
      'Design data architecture, governance policies, and analytics capabilities for data-driven decision making.',
    icon: 'Database',
    outputs: ['Data Architecture', 'Governance Framework', 'Analytics Roadmap'],
    featured: false,
  },

  // --- CHANGE MANAGEMENT TOOLS ---
  {
    id: 'adkar-assessment',
    block: 'change-management',
    name: 'ADKAR Change Assessment',
    framework: 'Prosci ADKAR',
    description:
      'Assess individual and organizational readiness for change using the proven ADKAR model.',
    icon: 'UserCheck',
    outputs: ['ADKAR Scores', 'Barrier Analysis', 'Reinforcement Plan'],
    featured: true,
  },
  {
    id: 'stakeholder-analysis',
    block: 'change-management',
    name: 'Stakeholder Analysis',
    framework: 'Influence Mapping',
    description:
      'Map stakeholder influence, interests, and engagement strategies for successful change adoption.',
    icon: 'Users',
    outputs: ['Stakeholder Map', 'Engagement Strategy', 'Communication Plan'],
    featured: true,
  },
  {
    id: 'resistance-mapper',
    block: 'change-management',
    name: 'Resistance Pattern Mapper',
    framework: 'Change Resistance',
    description:
      'Identify resistance patterns, root causes, and develop targeted intervention strategies.',
    icon: 'Shield',
    outputs: ['Resistance Heatmap', 'Root Cause Analysis', 'Intervention Playbook'],
    featured: true,
  },
  {
    id: 'communication-planner',
    block: 'change-management',
    name: 'Change Communication Planner',
    framework: 'Strategic Communication',
    description: 'Design multi-channel communication campaigns aligned with change milestones.',
    icon: 'MessageSquare',
    outputs: ['Communication Calendar', 'Message Templates', 'Channel Strategy'],
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
