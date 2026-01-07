/**
 * Transformation Scenarios Data
 * 
 * Predefined transformation archetypes for strategic planning
 */

export interface ScenarioArchetype {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    focusAreas: string[];
    typicalDuration: string;
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
    recommendedFor: string[];
    gains?: string[];
    sacrifices?: string[];
    impact?: string | Record<string, string>;
    narrative?: string;
    tags?: string[];
    tempo?: string;
    ambition?: string;
    risk?: string;
    approach?: string;
    timeline?: string;
    investment?: string;
    riskLevel?: string;
}

export const SCENARIOS: ScenarioArchetype[] = [
    {
        id: 'digital-foundation',
        name: 'Digital Foundation',
        description: 'Build core digital capabilities and infrastructure',
        icon: '🏗️',
        color: 'blue',
        focusAreas: ['processes', 'data', 'cybersecurity'],
        typicalDuration: '6-12 months',
        complexity: 'MEDIUM',
        recommendedFor: ['Traditional companies starting digital transformation', 'Organizations with legacy systems'],
    },
    {
        id: 'customer-experience',
        name: 'Customer Experience Revolution',
        description: 'Transform customer touchpoints and engagement',
        icon: '🎯',
        color: 'purple',
        focusAreas: ['digital', 'culture', 'processes'],
        typicalDuration: '9-18 months',
        complexity: 'HIGH',
        recommendedFor: ['B2C companies', 'Service-oriented businesses'],
    },
    {
        id: 'operational-excellence',
        name: 'Operational Excellence',
        description: 'Optimize processes and increase efficiency',
        icon: '⚡',
        color: 'emerald',
        focusAreas: ['processes', 'data', 'ai'],
        typicalDuration: '12-24 months',
        complexity: 'MEDIUM',
        recommendedFor: ['Manufacturing', 'Operations-heavy industries'],
    },
    {
        id: 'ai-powered',
        name: 'AI-Powered Transformation',
        description: 'Leverage AI and automation across the organization',
        icon: '🤖',
        color: 'violet',
        focusAreas: ['ai', 'data', 'processes'],
        typicalDuration: '18-36 months',
        complexity: 'HIGH',
        recommendedFor: ['Data-rich organizations', 'Tech-forward companies'],
    },
    {
        id: 'business-model-innovation',
        name: 'Business Model Innovation',
        description: 'Reinvent revenue streams and value proposition',
        icon: '💡',
        color: 'amber',
        focusAreas: ['models', 'digital', 'culture'],
        typicalDuration: '12-24 months',
        complexity: 'HIGH',
        recommendedFor: ['Disrupted industries', 'Companies seeking new markets'],
    },
    {
        id: 'data-driven',
        name: 'Data-Driven Organization',
        description: 'Build analytics capabilities and data culture',
        icon: '📊',
        color: 'blue',
        focusAreas: ['data', 'ai', 'culture'],
        typicalDuration: '12-18 months',
        complexity: 'MEDIUM',
        recommendedFor: ['Organizations with data silos', 'Companies lacking analytics'],
    },
];

/**
 * Recommend scenario based on organization profile
 */
export function recommendScenario(profile: {
    industry?: string;
    size?: string;
    maturityLevel?: number;
    priorities?: string[];
} | any, companyProfile?: any): ScenarioArchetype {
    // Simple recommendation logic
    if (profile.maturityLevel && profile.maturityLevel < 2) {
        return SCENARIOS[0]; // Digital Foundation
    }

    if (profile.priorities?.includes('customer')) {
        return SCENARIOS[1]; // Customer Experience
    }

    if (profile.priorities?.includes('efficiency')) {
        return SCENARIOS[2]; // Operational Excellence
    }

    if (profile.priorities?.includes('ai') || profile.priorities?.includes('automation')) {
        return SCENARIOS[3]; // AI-Powered
    }

    // Default to Digital Foundation
    return SCENARIOS[0];
}

/**
 * Get scenario by ID
 */
export function getScenarioById(id: string): ScenarioArchetype | undefined {
    return SCENARIOS.find(s => s.id === id);
}

/**
 * Filter scenarios by complexity
 */
export function getScenariosByComplexity(complexity: 'LOW' | 'MEDIUM' | 'HIGH'): ScenarioArchetype[] {
    return SCENARIOS.filter(s => s.complexity === complexity);
}

/**
 * Filter scenarios by focus area
 */
export function getScenariosByFocusArea(focusArea: string): ScenarioArchetype[] {
    return SCENARIOS.filter(s => s.focusAreas.includes(focusArea));
}
