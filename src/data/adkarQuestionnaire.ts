/**
 * ADKAR Questionnaire Data
 */

export interface ADKARDimension {
    id: string;
    name: string;
    namePl?: string;
    description: string;
    descriptionPl?: string;
}

export interface ADKARQuestion {
    id: string;
    dimension: string;
    text: string;
    textPl?: string;
    options: Array<{ value: number; label: string }>;
}

export const ADKAR_DIMENSIONS: ADKARDimension[] = [
    {
        id: 'awareness',
        name: 'Awareness',
        namePl: 'Świadomość',
        description: 'Understanding the need for change',
        descriptionPl: 'Zrozumienie potrzeby zmiany',
    },
    {
        id: 'desire',
        name: 'Desire',
        namePl: 'Pragnienie',
        description: 'Wanting to participate in the change',
        descriptionPl: 'Chęć uczestnictwa w zmianie',
    },
    {
        id: 'knowledge',
        name: 'Knowledge',
        namePl: 'Wiedza',
        description: 'Knowing how to change',
        descriptionPl: 'Wiedza jak się zmienić',
    },
    {
        id: 'ability',
        name: 'Ability',
        namePl: 'Umiejętność',
        description: 'Implementing required skills',
        descriptionPl: 'Wdrożenie wymaganych umiejętności',
    },
    {
        id: 'reinforcement',
        name: 'Reinforcement',
        namePl: 'Wzmocnienie',
        description: 'Sustaining the change',
        descriptionPl: 'Podtrzymanie zmiany',
    },
];

export const ADKAR_QUESTIONS: ADKARQuestion[] = [
    {
        id: 'a1',
        dimension: 'awareness',
        text: 'How well do stakeholders understand the need for change?',
        textPl: 'Jak dobrze interesariusze rozumieją potrzebę zmiany?',
        options: [
            { value: 1, label: 'Not at all' },
            { value: 2, label: 'Slightly' },
            { value: 3, label: 'Moderately' },
            { value: 4, label: 'Very well' },
            { value: 5, label: 'Completely' },
        ],
    },
    {
        id: 'a2',
        dimension: 'awareness',
        text: 'Are the reasons for the change clearly communicated?',
        textPl: 'Czy przyczyny zmiany są jasno komunikowane?',
        options: [
            { value: 1, label: 'Not at all' },
            { value: 2, label: 'Slightly' },
            { value: 3, label: 'Moderately' },
            { value: 4, label: 'Very well' },
            { value: 5, label: 'Completely' },
        ],
    },
    {
        id: 'd1',
        dimension: 'desire',
        text: 'Do stakeholders want to participate in the change?',
        textPl: 'Czy interesariusze chcą uczestniczyć w zmianie?',
        options: [
            { value: 1, label: 'Not at all' },
            { value: 2, label: 'Slightly' },
            { value: 3, label: 'Moderately' },
            { value: 4, label: 'Very much' },
            { value: 5, label: 'Completely' },
        ],
    },
    {
        id: 'k1',
        dimension: 'knowledge',
        text: 'Do stakeholders know how to change?',
        textPl: 'Czy interesariusze wiedzą jak się zmienić?',
        options: [
            { value: 1, label: 'Not at all' },
            { value: 2, label: 'Slightly' },
            { value: 3, label: 'Moderately' },
            { value: 4, label: 'Very well' },
            { value: 5, label: 'Completely' },
        ],
    },
    {
        id: 'ab1',
        dimension: 'ability',
        text: 'Can stakeholders implement required skills?',
        textPl: 'Czy interesariusze mogą wdrożyć wymagane umiejętności?',
        options: [
            { value: 1, label: 'Not at all' },
            { value: 2, label: 'Slightly' },
            { value: 3, label: 'Moderately' },
            { value: 4, label: 'Very well' },
            { value: 5, label: 'Completely' },
        ],
    },
    {
        id: 'r1',
        dimension: 'reinforcement',
        text: 'Are there systems to sustain the change?',
        textPl: 'Czy istnieją systemy podtrzymujące zmianę?',
        options: [
            { value: 1, label: 'Not at all' },
            { value: 2, label: 'Slightly' },
            { value: 3, label: 'Moderately' },
            { value: 4, label: 'Very well' },
            { value: 5, label: 'Completely' },
        ],
    },
];

// ADKAR_QUESTIONNAIRE is an array of dimensions with their questions
export const ADKAR_QUESTIONNAIRE: ADKARDimension[] = ADKAR_DIMENSIONS;

export const getADKARQuestions = () => ADKAR_QUESTIONS;
export const getADKARDimensions = () => ADKAR_DIMENSIONS;
