/**
 * CMMI-DMM (Data Maturity Model) Questionnaire Structure
 * 5 dimensions based on CMMI Data Management Maturity Model
 */

export interface CMMIDMMDimension {
    id: string;
    name: string;
    description: string;
}

export interface CMMIDMMQuestion {
    id: string;
    text: string;
    dimension: string;
}

export const CMMI_DMM_DIMENSIONS: CMMIDMMDimension[] = [
    {
        id: 'data_strategy',
        name: 'Data Strategy',
        description: 'Strategic planning and governance for data management'
    },
    {
        id: 'data_quality',
        name: 'Data Quality Management',
        description: 'Processes for ensuring data accuracy, consistency, and reliability'
    },
    {
        id: 'data_operations',
        name: 'Data Operations',
        description: 'Day-to-day management of data lifecycle'
    },
    {
        id: 'data_platform',
        name: 'Data Platform & Architecture',
        description: 'Infrastructure and architecture for data storage and processing'
    },
    {
        id: 'data_value',
        name: 'Data Value Creation',
        description: 'Analytics, insights, and value generation from data'
    }
];

// Simplified questionnaire (10 questions, 2 per dimension)
export const CMMI_DMM_QUESTIONS: CMMIDMMQuestion[] = [
    // Data Strategy
    { id: 'strategy_1', text: 'Does your organization have a documented data strategy?', dimension: 'data_strategy' },
    { id: 'strategy_2', text: 'Is there executive sponsorship for data initiatives?', dimension: 'data_strategy' },

    // Data Quality
    { id: 'quality_1', text: 'Are data quality metrics defined and monitored?', dimension: 'data_quality' },
    { id: 'quality_2', text: 'Is there a formal data validation process?', dimension: 'data_quality' },

    // Data Operations
    { id: 'operations_1', text: 'Is data lifecycle management automated?', dimension: 'data_operations' },
    { id: 'operations_2', text: 'Are data backup and recovery processes tested regularly?', dimension: 'data_operations' },

    // Data Platform
    { id: 'platform_1', text: 'Is there a centralized data platform (data lake/warehouse)?', dimension: 'data_platform' },
    { id: 'platform_2', text: 'Can the platform scale with growing data volumes?', dimension: 'data_platform' },

    // Data Value
    { id: 'value_1', text: 'Are advanced analytics (ML/AI) used for business insights?', dimension: 'data_value' },
    { id: 'value_2', text: 'Is data monetized or used to create new revenue streams?', dimension: 'data_value' }
];

// Mapping to DRD Data Management axis
export const mapCMMIDMMToDRD = (cmmiddmScores: Record<string, number>): number => {
    // Average CMMI-DMM scores (1-5 scale) and convert to DRD 1-7 scale
    const avgScore = Object.values(cmmiddmScores).reduce((sum, score) => sum + score, 0) / Object.values(cmmiddmScores).length;

    // Linear interpolation: CMMI 1-5 → DRD 1-7
    return ((avgScore - 1) / 4) * 6 + 1;
};
