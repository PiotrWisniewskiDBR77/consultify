export const DIGITIZATION_AXES: {
    id: string;
    number: number;
    name: string;
    namePl: string;
    description: string;
    descriptionPl: string;
    icon: string;
    color: string;
    areas: {
        id: string;
        code: string;
        name: string;
        namePl: string;
        levels: {
            level: number;
            name: string;
            namePl: string;
            description: string;
            descriptionPl: string;
            example: string;
            examplePl: string;
            question: string;
            questionPl: string;
            initiative: string;
            initiativePl: string;
        }[];
    }[];
}[];
export function getAxisById(id: any): {
    id: string;
    number: number;
    name: string;
    namePl: string;
    description: string;
    descriptionPl: string;
    icon: string;
    color: string;
    areas: {
        id: string;
        code: string;
        name: string;
        namePl: string;
        levels: {
            level: number;
            name: string;
            namePl: string;
            description: string;
            descriptionPl: string;
            example: string;
            examplePl: string;
            question: string;
            questionPl: string;
            initiative: string;
            initiativePl: string;
        }[];
    }[];
} | undefined;
export function getAreaByCode(code: any): {
    axis: {
        id: string;
        number: number;
        name: string;
        namePl: string;
        description: string;
        descriptionPl: string;
        icon: string;
        color: string;
        areas: {
            id: string;
            code: string;
            name: string;
            namePl: string;
            levels: {
                level: number;
                name: string;
                namePl: string;
                description: string;
                descriptionPl: string;
                example: string;
                examplePl: string;
                question: string;
                questionPl: string;
                initiative: string;
                initiativePl: string;
            }[];
        }[];
    };
    area: {
        id: string;
        code: string;
        name: string;
        namePl: string;
        levels: {
            level: number;
            name: string;
            namePl: string;
            description: string;
            descriptionPl: string;
            example: string;
            examplePl: string;
            question: string;
            questionPl: string;
            initiative: string;
            initiativePl: string;
        }[];
    };
} | undefined;
export function getTotalAreas(): number;
export function getLevelColor(level: any): string;
export function calculateAxisScore(areaScores: any): number;
//# sourceMappingURL=digitizationEvaluationData.d.ts.map