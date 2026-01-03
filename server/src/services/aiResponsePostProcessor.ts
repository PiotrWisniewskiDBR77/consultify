/**
 * AI Response Post-Processor
 * Step B: Guaranteed deterministic labeling for AI responses
 * 
 * This module ensures memory and external source labels are added
 * to AI responses even if the LLM ignores prompt instructions.
 * 
 * Fully migrated from server/services/aiResponsePostProcessor.js to TypeScript
 */

// ==========================================
// CONSTANTS
// ==========================================

export const MEMORY_PREFIX = '📚 [Using project memory: ';
export const EXTERNAL_PREFIX = '🌐 [External sources: ';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface AIContext {
    pmo?: {
        healthSnapshot?: unknown;
    };
    knowledge?: {
        previousDecisions?: unknown[];
    };
    execution?: {
        phaseHistory?: unknown[];
    };
    projectMemory?: {
        memoryCount?: number;
    };
    external?: {
        externalSourcesUsed?: string[];
        internetEnabled?: boolean;
        fetchedData?: {
            webSearch?: unknown;
            news?: unknown;
            market?: unknown;
        };
    };
}

// ==========================================
// FUNCTIONS
// ==========================================

/**
 * Get memory count from context
 */
export const getMemoryCount = (context: AIContext | null | undefined): number => {
    if (!context) return 0;

    // Check pmo.healthSnapshot for project memory indication
    if (context.pmo?.healthSnapshot) {
        // PMO health indicates project-level memory
        return 1;
    }

    // Check knowledge layer for previous decisions
    if (context.knowledge?.previousDecisions && context.knowledge.previousDecisions.length > 0) {
        return context.knowledge.previousDecisions.length;
    }

    // Check execution layer for historical context
    if (context.execution?.phaseHistory && context.execution.phaseHistory.length > 0) {
        return context.execution.phaseHistory.length;
    }

    // Check projectMemory from orchestrator context
    if (context.projectMemory?.memoryCount && context.projectMemory.memoryCount > 0) {
        return context.projectMemory.memoryCount;
    }

    return 0;
};

/**
 * Get external sources from context
 */
export const getExternalSources = (context: AIContext | null | undefined): string[] => {
    if (!context) return [];

    // Check external layer
    if (context.external?.externalSourcesUsed && context.external.externalSourcesUsed.length > 0) {
        return context.external.externalSourcesUsed;
    }

    // Check if internet was enabled and data was fetched
    if (context.external?.internetEnabled && context.external?.fetchedData) {
        const sources: string[] = [];
        if (context.external.fetchedData.webSearch) sources.push('Web Search');
        if (context.external.fetchedData.news) sources.push('News');
        if (context.external.fetchedData.market) sources.push('Market Data');
        return sources;
    }

    return [];
};

/**
 * Check if response already has memory prefix
 */
export const hasMemoryPrefix = (text: string): boolean => {
    return text.startsWith(MEMORY_PREFIX) || text.includes(`\n${MEMORY_PREFIX}`);
};

/**
 * Check if response already has external prefix
 */
export const hasExternalPrefix = (text: string): boolean => {
    return text.startsWith(EXTERNAL_PREFIX) || text.includes(`\n${EXTERNAL_PREFIX}`);
};

/**
 * Post-process AI response to ensure required labels are present
 * 
 * @param responseText - The raw AI response text
 * @param context - The AI context object containing memory/external info
 * @returns The processed response with guaranteed labels
 */
export const aiResponsePostProcessor = (responseText: string | null | undefined, context: AIContext | null | undefined): string => {
    if (!responseText || typeof responseText !== 'string') {
        return responseText || '';
    }

    let processedResponse = responseText.trim();
    const prefixes: string[] = [];

    // Check for memory usage - add prefix if memory is present
    const memoryCount = getMemoryCount(context);
    if (memoryCount > 0 && !hasMemoryPrefix(processedResponse)) {
        prefixes.push(`${MEMORY_PREFIX}${memoryCount} items]`);
    }

    // Check for external sources - add prefix if external sources were used
    const externalSources = getExternalSources(context);
    if (externalSources.length > 0 && !hasExternalPrefix(processedResponse)) {
        prefixes.push(`${EXTERNAL_PREFIX}${externalSources.join(', ')}]`);
    }

    // Prepend prefixes if any need to be added
    if (prefixes.length > 0) {
        processedResponse = prefixes.join('\n') + '\n\n' + processedResponse;
    }

    return processedResponse;
};

/**
 * Strip existing prefixes from response (useful for re-processing)
 */
export const stripPrefixes = (text: string | null | undefined): string => {
    if (!text) return '';

    let result = text;

    // Remove memory prefix line
    const memoryRegex = /📚 \[Using project memory: \d+ items\]\n*/g;
    result = result.replace(memoryRegex, '');

    // Remove external prefix line
    const externalRegex = /🌐 \[External sources: [^\]]+\]\n*/g;
    result = result.replace(externalRegex, '');

    return result.trim();
};

// Default export for backward compatibility
const aiResponsePostProcessorService = {
    aiResponsePostProcessor,
    getMemoryCount,
    getExternalSources,
    hasMemoryPrefix,
    hasExternalPrefix,
    stripPrefixes,
    MEMORY_PREFIX,
    EXTERNAL_PREFIX
};

export default aiResponsePostProcessorService;
