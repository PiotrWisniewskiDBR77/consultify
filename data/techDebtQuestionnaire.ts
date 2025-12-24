/**
 * Technology Debt Audit Framework
 * Assesses technical debt across code quality, architecture, infrastructure
 */

export interface TechDebtDimension {
    id: string;
    name: string;
    description: string;
    weight: number; // Importance multiplier
}

export interface TechDebtQuestion {
    id: string;
    text: string;
    dimension: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export const TECH_DEBT_DIMENSIONS: TechDebtDimension[] = [
    {
        id: 'code_quality',
        name: 'Code Quality',
        description: 'Code maintainability, readability, and technical quality',
        weight: 1.5
    },
    {
        id: 'architecture',
        name: 'Architecture & Design',
        description: 'System architecture scalability and design patterns',
        weight: 2.0 // Higher weight - architectural debt is costly
    },
    {
        id: 'infrastructure',
        name: 'Infrastructure & DevOps',
        description: 'CI/CD, deployment, monitoring, and operations',
        weight: 1.0
    },
    {
        id: 'security',
        name: 'Security & Compliance',
        description: 'Security vulnerabilities and compliance gaps',
        weight: 1.8 // High weight - security is critical
    },
    {
        id: 'documentation',
        name: 'Documentation',
        description: 'Code documentation, API docs, and knowledge transfer',
        weight: 0.8
    }
];

// Questionnaire (15 questions, 3 per dimension)
export const TECH_DEBT_QUESTIONS: TechDebtQuestion[] = [
    // Code Quality
    { id: 'code_1', text: 'Are automated tests (unit, integration) in place?', dimension: 'code_quality', severity: 'high' },
    { id: 'code_2', text: 'Is code review mandatory for all changes?', dimension: 'code_quality', severity: 'medium' },
    { id: 'code_3', text: 'Are code quality metrics (coverage, complexity) monitored?', dimension: 'code_quality', severity: 'medium' },

    // Architecture
    { id: 'arch_1', text: 'Is the system architecture documented?', dimension: 'architecture', severity: 'high' },
    { id: 'arch_2', text: 'Can the system scale horizontally?', dimension: 'architecture', severity: 'critical' },
    { id: 'arch_3', text: 'Are legacy systems being gradually modernized?', dimension: 'architecture', severity: 'high' },

    // Infrastructure
    { id: 'infra_1', text: 'Is CI/CD pipeline automated?', dimension: 'infrastructure', severity: 'high' },
    { id: 'infra_2', text: 'Are deployments zero-downtime?', dimension: 'infrastructure', severity: 'medium' },
    { id: 'infra_3', text: 'Is monitoring and alerting comprehensive?', dimension: 'infrastructure', severity: 'high' },

    // Security
    { id: 'security_1', text: 'Are security vulnerabilities scanned automatically?', dimension: 'security', severity: 'critical' },
    { id: 'security_2', text: 'Is sensitive data encrypted at rest and in transit?', dimension: 'security', severity: 'critical' },
    { id: 'security_3', text: 'Are security patches applied regularly?', dimension: 'security', severity: 'high' },

    // Documentation
    { id: 'doc_1', text: 'Is API documentation up-to-date?', dimension: 'documentation', severity: 'medium' },
    { id: 'doc_2', text: 'Are onboarding docs available for new developers?', dimension: 'documentation', severity: 'low' },
    { id: 'doc_3', text: 'Is architectural decision record (ADR) maintained?', dimension: 'documentation', severity: 'low' }
];

/**
 * Calculate tech debt score (1-7 scale, lower is better)
 * 1 = Minimal debt, 7 = Critical debt
 */
export const calculateTechDebtScore = (responses: Record<string, number>): {
    overall: number;
    byDimension: Record<string, number>;
    criticalIssues: string[];
} => {
    const dimensionScores: Record<string, number[]> = {};
    const criticalIssues: string[] = [];

    // Group responses by dimension
    TECH_DEBT_QUESTIONS.forEach(q => {
        if (!dimensionScores[q.dimension]) {
            dimensionScores[q.dimension] = [];
        }
        const response = responses[q.id] || 1; // Default to worst case
        dimensionScores[q.dimension].push(response);

        // Flag critical issues with low scores
        if (q.severity === 'critical' && response <= 2) {
            criticalIssues.push(q.text);
        }
    });

    // Calculate weighted average
    let weightedSum = 0;
    let totalWeight = 0;
    const byDimension: Record<string, number> = {};

    TECH_DEBT_DIMENSIONS.forEach(dim => {
        const scores = dimensionScores[dim.id] || [];
        const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        byDimension[dim.id] = avg;

        weightedSum += avg * dim.weight;
        totalWeight += dim.weight;
    });

    const overall = weightedSum / totalWeight;

    return {
        overall: 6 - overall + 1, // Invert: high responses = low debt
        byDimension,
        criticalIssues
    };
};

// Map to DRD Digital Products axis
export const mapTechDebtToDRD = (techDebtScore: number): number => {
    // Tech debt inversely correlates with digital product maturity
    // High debt (7) → Low maturity (1-2)
    // Low debt (1) → High maturity (6-7)
    return 8 - techDebtScore;
};
