/**
 * Card Documentation Registry
 *
 * Contains documentation for all Admin, SuperAdmin, and Settings cards.
 * Used by InfoButton component to show contextual help.
 * Extended with moduleId for integration with HelpSidePanel.
 */
import { HelpModuleId } from './viewToModuleMapping';
export interface CardDocumentation {
    id: string;
    title: string;
    description: string;
    features: string[];
    howToUse: string[];
    tips: string[];
    relatedDocs?: {
        title: string;
        url: string;
    }[];
    moduleId?: HelpModuleId;
}
export declare const CARD_DOCS: Record<string, CardDocumentation>;
export default CARD_DOCS;
//# sourceMappingURL=cardDocumentation.d.ts.map