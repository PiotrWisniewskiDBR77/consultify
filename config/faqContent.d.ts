/**
 * FAQ Content
 *
 * Frequently asked questions organized by module.
 * Used by HelpSidePanel in the "FAQ" tab.
 */
import { HelpModuleId } from './viewToModuleMapping';
export interface FAQItem {
    id: string;
    question: string;
    questionPl: string;
    answer: string;
    answerPl: string;
    moduleId: HelpModuleId;
    tags: string[];
}
export declare const FAQ_CONTENT: FAQItem[];
/**
 * Get FAQs for a specific module
 */
export declare function getFAQsForModule(moduleId: HelpModuleId): FAQItem[];
/**
 * Search FAQs by query
 */
export declare function searchFAQs(query: string, language?: 'en' | 'pl'): FAQItem[];
/**
 * Get all unique tags from FAQs
 */
export declare function getAllFAQTags(): string[];
//# sourceMappingURL=faqContent.d.ts.map