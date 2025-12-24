/**
 * ADKAR Change Readiness Assessment Questionnaire
 * 5 dimensions: Awareness, Desire, Knowledge, Ability, Reinforcement
 */

export interface ADKARDimension {
    id: string;
    name: string;
    description: string;
}

export interface ADKARQuestion {
    id: string;
    text: string;
    dimension: string;
}

export const ADKAR_QUESTIONNAIRE: ADKARDimension[] = [
    {
        id: 'awareness',
        name: 'Awareness',
        description: 'Understanding of why change is needed'
    },
    {
        id: 'desire',
        name: 'Desire',
        description: 'Personal motivation to support the change'
    },
    {
        id: 'knowledge',
        name: 'Knowledge',
        description: 'Information about how to change'
    },
    {
        id: 'ability',
        name: 'Ability',
        description: 'Skills and behaviors to implement change'
    },
    {
        id: 'reinforcement',
        name: 'Reinforcement',
        description: 'Sustaining the change over time'
    }
];

// Questionnaire structure (simplified)
export const ADKAR_QUESTIONS: ADKARQuestion[] = [
    { id: 'awareness_1', text: 'Do employees understand the business reasons for change?', dimension: 'awareness' },
    { id: 'awareness_2', text: 'Is there clear communication about change drivers?', dimension: 'awareness' },
    { id: 'desire_1', text: 'Are employees motivated to participate in change?', dimension: 'desire' },
    { id: 'desire_2', text: 'Do leaders demonstrate commitment to change?', dimension: 'desire' },
    { id: 'knowledge_1', text: 'Are training programs available for new processes?', dimension: 'knowledge' },
    { id: 'knowledge_2', text: 'Do employees know what behaviors are expected?', dimension: 'knowledge' },
    { id: 'ability_1', text: 'Do employees have the skills to execute change?', dimension: 'ability' },
    { id: 'ability_2', text: 'Are resources available to support new ways of working?', dimension: 'ability' },
    { id: 'reinforcement_1', text: 'Are there mechanisms to sustain change?', dimension: 'reinforcement' },
    { id: 'reinforcement_2', text: 'Is success celebrated and recognized?', dimension: 'reinforcement' }
];
