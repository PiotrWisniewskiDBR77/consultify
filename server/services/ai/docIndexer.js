/**
 * Documentation Indexer Service
 * 
 * Indexes application documentation to provide context for the
 * Prompt Engineering Assistant.
 * 
 * Sources:
 * - docs/AI_MASTER_ARCHITECTURE.md
 * - CURSOR_CONTEXT.md
 * - .cursor/rules/*.mdc
 * - API route documentation
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// Documentation Paths
// ============================================================================

const DOC_SOURCES = [
    // Architecture documentation
    { path: 'docs/AI_MASTER_ARCHITECTURE.md', category: 'architecture', priority: 1 },
    { path: 'docs/00_foundation/PMO_STANDARDS_COMPLIANCE.md', category: 'standards', priority: 1 },
    { path: 'CURSOR_CONTEXT.md', category: 'context', priority: 1 },

    // Cursor rules (MDC files)
    { path: '.cursor/rules/ai-assessment.mdc', category: 'rules', priority: 2 },
    { path: '.cursor/rules/assessment-module.mdc', category: 'rules', priority: 2 },
    { path: '.cursor/rules/my-work-module.mdc', category: 'rules', priority: 2 },
    { path: '.cursor/rules/pmo-standards.mdc', category: 'rules', priority: 2 },

    // Process documentation
    { path: 'docs/AI_QUALITY_CHECKLIST.md', category: 'quality', priority: 2 },
    { path: 'docs/WALKTHROUGH.md', category: 'walkthrough', priority: 3 }
];

// ============================================================================
// Prompt Engineering Best Practices (Embedded Knowledge)
// ============================================================================

const PROMPT_ENGINEERING_KB = `
# PROMPT ENGINEERING BEST PRACTICES

## 1. Language Independence Principles

### DO:
- Use semantic instructions that describe BEHAVIOR not LANGUAGE
- Use {{user.language}} variable for dynamic language adaptation
- Include BEHAVIOR.LANGUAGE_ADAPTIVE block in every user-facing prompt
- Test prompts in all 6 supported languages (en, pl, de, es, ja, ar)

### DON'T:
- Hardcode language names ("Answer in Polish")
- Use language-specific instructions ("Odpowiedz po polsku")
- Mix multiple languages in instructions
- Assume default language is English

### Examples:
BAD: "You are a consultant. Answer in Polish."
GOOD: "PERSONA: Strategic Consultant. LANGUAGE: Respond in {{user.language}}."

BAD: "Napisz raport po polsku."
GOOD: "TASK: Generate report. FORMAT: Executive summary. LANGUAGE: {{user.detected_language}}"

## 2. Block Composition Rules

### Recommended Order:
1. ROLE - Define AI persona
2. BEHAVIOR - Set communication style
3. CONTEXT - Inject relevant data
4. TASK - Specify what to do (if applicable)
5. OUTPUT - Define response format
6. CONSTRAINT - Set rules and limits

### Required Blocks:
- Every prompt MUST have at least one ROLE block
- Every user-facing prompt MUST have BEHAVIOR.LANGUAGE_ADAPTIVE
- Strategic prompts SHOULD have OUTPUT.EXECUTIVE_SUMMARY or similar

### Block Compatibility:
- BEHAVIOR.CONCISE conflicts with OUTPUT.DETAILED_ANALYSIS
- CONSTRAINT.CONTEXT_ONLY should be used with CONTEXT.SCREEN_STATE
- ROLE.MENTOR pairs well with BEHAVIOR.EMPATHETIC

## 3. Variable Usage

### Context Variables (from request):
- {{user.name}} - User's first name
- {{user.role}} - User's role (admin, manager, etc.)
- {{user.language}} - User's preferred language
- {{organization.name}} - Organization name
- {{context.project.name}} - Current project name
- {{context.screen.title}} - Current screen being viewed
- {{context.screen.data}} - Data visible on screen

### Runtime Variables (computed):
- {{user.detected_language}} - Auto-detected from user input
- {{runtime.date}} - Current date
- {{runtime.timeOfDay}} - morning/afternoon/evening

### Config Variables (from app config):
- {{config.supported_languages}} - List of supported language codes
- {{config.app_name}} - Application name

## 4. Anti-Patterns to Avoid

1. **Over-prompting**: Instructions longer than 3000 characters
2. **Under-constraining**: No output format specified
3. **Language Hardcoding**: Any explicit language name
4. **Conflicting Behaviors**: e.g., "be concise" + "provide detailed analysis"
5. **Missing Context**: Not using available screen/project data
6. **Hallucination Risk**: No CONSTRAINT.NO_HALLUCINATION for data-driven prompts

## 5. Testing Checklist

Before deploying a prompt template:
□ Test in English (en)
□ Test in Polish (pl)
□ Test in German (de)
□ Test at least one non-Latin script (ja or ar)
□ Verify language detection works
□ Check token count < 1500 for system prompt
□ Validate all variables resolve correctly
□ Ensure output format matches expectations
□ Review for hardcoded language references

## 6. Consultify-Specific Guidelines

### Domain Context:
- Platform for Digital Transformation PMO
- Users: C-level executives, consultants, project managers
- Key workflows: Assessment → Initiatives → Roadmap → Execution

### PMO Standards Compliance:
- ISO 21500:2021 - Project management concepts
- PMBOK 7th Edition - Performance domains
- PRINCE2 - Governance themes

### Lifecycle Phases:
1. Context (Why change?)
2. Assessment (Where are we?)
3. Initiatives (What must change?)
4. Roadmap (When?)
5. Execution (Delivery)
6. Stabilization (Sustainment)

### Tone Requirements:
- Professional, executive-level communication
- McKinsey Pyramid Principle for structure
- Action-oriented, decision-focused
- Data-driven with clear recommendations
`;

// ============================================================================
// Documentation Indexer Class
// ============================================================================

class DocIndexer {
    constructor() {
        this.indexedDocs = new Map();
        this.lastIndexTime = null;
        this.projectRoot = process.cwd();
    }

    /**
     * Index all documentation sources
     */
    async indexAll() {
        console.log('[DocIndexer] Starting documentation indexing...');

        for (const source of DOC_SOURCES) {
            try {
                await this.indexDocument(source);
            } catch (error) {
                console.warn(`[DocIndexer] Failed to index ${source.path}:`, error.message);
            }
        }

        // Add embedded prompt engineering knowledge
        this.indexedDocs.set('prompt_engineering_kb', {
            path: 'embedded:prompt_engineering',
            category: 'knowledge',
            priority: 0,
            content: PROMPT_ENGINEERING_KB,
            chunks: this.chunkContent(PROMPT_ENGINEERING_KB),
            indexedAt: new Date().toISOString()
        });

        this.lastIndexTime = new Date();
        console.log(`[DocIndexer] Indexed ${this.indexedDocs.size} documents`);
    }

    /**
     * Index a single document
     */
    async indexDocument(source) {
        const fullPath = path.join(this.projectRoot, source.path);

        if (!fs.existsSync(fullPath)) {
            console.warn(`[DocIndexer] Document not found: ${source.path}`);
            return;
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        const chunks = this.chunkContent(content);

        this.indexedDocs.set(source.path, {
            path: source.path,
            category: source.category,
            priority: source.priority,
            content: content,
            chunks: chunks,
            indexedAt: new Date().toISOString()
        });

        console.log(`[DocIndexer] Indexed: ${source.path} (${chunks.length} chunks)`);
    }

    /**
     * Chunk content into smaller pieces for retrieval
     */
    chunkContent(content, maxChunkSize = 1000) {
        const chunks = [];
        const sections = content.split(/\n##\s+/);

        for (const section of sections) {
            if (section.length <= maxChunkSize) {
                chunks.push(section.trim());
            } else {
                // Split large sections by paragraphs
                const paragraphs = section.split(/\n\n+/);
                let currentChunk = '';

                for (const para of paragraphs) {
                    if ((currentChunk + para).length > maxChunkSize) {
                        if (currentChunk) chunks.push(currentChunk.trim());

                        // If paragraph itself is huge, force split it
                        if (para.length > maxChunkSize) {
                            let remaining = para;
                            while (remaining.length > 0) {
                                chunks.push(remaining.slice(0, maxChunkSize).trim());
                                remaining = remaining.slice(maxChunkSize);
                            }
                            currentChunk = '';
                        } else {
                            currentChunk = para;
                        }
                    } else {
                        currentChunk += (currentChunk ? '\n\n' : '') + para;
                    }
                }

                if (currentChunk) chunks.push(currentChunk.trim());
            }
        }

        return chunks.filter(c => c.length > 50);
    }

    /**
     * Search indexed documentation
     */
    search(query, options = {}) {
        const { category, limit = 5 } = options;
        const results = [];
        const queryLower = query.toLowerCase();
        const queryTerms = queryLower.split(/\s+/);

        for (const [path, doc] of this.indexedDocs) {
            if (category && doc.category !== category) continue;

            for (const chunk of doc.chunks) {
                const chunkLower = chunk.toLowerCase();
                let score = 0;

                // Score based on term matches
                for (const term of queryTerms) {
                    if (chunkLower.includes(term)) {
                        score += 10;
                        // Boost for exact phrase match
                        if (chunkLower.includes(queryLower)) {
                            score += 20;
                        }
                    }
                }

                // Priority boost
                score += (5 - doc.priority) * 5;

                if (score > 0) {
                    results.push({
                        path: doc.path,
                        category: doc.category,
                        chunk: chunk,
                        score
                    });
                }
            }
        }

        // Sort by score and limit
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }

    /**
     * Get context for a specific topic
     */
    getContextForTopic(topic) {
        const topicMap = {
            'language': ['language independence', 'multilingual', 'i18n', 'translation'],
            'blocks': ['block composition', 'prompt blocks', 'building blocks'],
            'variables': ['variables', 'context', 'dynamic', 'placeholder'],
            'testing': ['testing', 'validation', 'quality', 'checklist'],
            'pmo': ['pmo', 'project management', 'governance', 'lifecycle'],
            'best_practices': ['best practices', 'guidelines', 'anti-patterns', 'do and dont']
        };

        const searchTerms = topicMap[topic] || [topic];
        const results = [];

        for (const term of searchTerms) {
            results.push(...this.search(term, { limit: 3 }));
        }

        // Deduplicate and take top results
        const seen = new Set();
        const unique = results.filter(r => {
            const key = r.chunk.slice(0, 100);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return unique.slice(0, 5).map(r => r.chunk).join('\n\n---\n\n');
    }

    /**
     * Get prompt engineering knowledge base
     */
    getPromptEngineeringKB() {
        return PROMPT_ENGINEERING_KB;
    }

    /**
     * Get all indexed document metadata
     */
    getIndexedDocuments() {
        const docs = [];
        for (const [path, doc] of this.indexedDocs) {
            docs.push({
                path: doc.path,
                category: doc.category,
                priority: doc.priority,
                chunkCount: doc.chunks.length,
                indexedAt: doc.indexedAt
            });
        }
        return docs;
    }

    /**
     * Get statistics about indexed content
     */
    getStats() {
        let totalChunks = 0;
        let totalCharacters = 0;
        const categoryCounts = {};

        for (const [_, doc] of this.indexedDocs) {
            totalChunks += doc.chunks.length;
            totalCharacters += doc.content.length;
            categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1;
        }

        return {
            documentCount: this.indexedDocs.size,
            totalChunks,
            totalCharacters,
            categoryCounts,
            lastIndexTime: this.lastIndexTime?.toISOString()
        };
    }

    /**
     * Re-index all documents
     */
    async reindex() {
        this.indexedDocs.clear();
        await this.indexAll();
    }
}

// Singleton instance
const docIndexer = new DocIndexer();

// Auto-index on load
docIndexer.indexAll().catch(err => {
    console.error('[DocIndexer] Initial indexing failed:', err);
});

export {
DocIndexer,
    docIndexer,
    PROMPT_ENGINEERING_KB
};

export default {
    DocIndexer,
    docIndexer,
    PROMPT_ENGINEERING_KB
};

