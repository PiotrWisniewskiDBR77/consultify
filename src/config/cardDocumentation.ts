export interface CardDocumentation {
    title: string;
    description: string;
    moduleId?: string;
    features: string[];
    howToUse: string[];
    tips: string[];
    relatedDocs?: string[];
}

export const CARD_DOCS: Record<string, CardDocumentation> = {};
