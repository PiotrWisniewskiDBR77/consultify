/**
 * AI Response Post-Processor
 * Step B: Guaranteed deterministic labeling for AI responses
 *
 * This module ensures memory and external source labels are added
 * to AI responses even if the LLM ignores prompt instructions.
 */
export const MEMORY_PREFIX: "\uD83D\uDCDA [Using project memory: ";
export const EXTERNAL_PREFIX: "\uD83C\uDF10 [External sources: ";
export function getMemoryCount(context: any): any;
export function getExternalSources(context: any): any;
export function hasMemoryPrefix(text: any): any;
export function hasExternalPrefix(text: any): any;
export function aiResponsePostProcessor(responseText: string, context: Object): string;
export function stripPrefixes(text: any): any;
declare namespace _default {
    export { aiResponsePostProcessor };
    export { getMemoryCount };
    export { getExternalSources };
    export { hasMemoryPrefix };
    export { hasExternalPrefix };
    export { stripPrefixes };
    export { MEMORY_PREFIX };
    export { EXTERNAL_PREFIX };
}
export default _default;
//# sourceMappingURL=aiResponsePostProcessor.d.ts.map