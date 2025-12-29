/**
 * Help Search Service
 * 
 * Enterprise-grade search service for the help system.
 * Provides full-text search across modules, cards, FAQs, and videos.
 */

import { MODULE_HELP_CONTENT, ModuleHelpContent, HelpModuleId } from '../config/moduleHelpContent';
import { CARD_DOCS, CardDocumentation } from '../config/cardDocumentation';
import { FAQ_CONTENT, FAQItem } from '../config/faqContent';
import { VIDEO_TUTORIALS, VideoTutorial } from '../config/videoTutorialsContent';

// Search result types
export type SearchResultType = 'module' | 'card' | 'faq' | 'video';

export interface SearchResult {
    type: SearchResultType;
    id: string;
    title: string;
    titlePl?: string;
    excerpt: string;
    excerptPl?: string;
    moduleId: HelpModuleId;
    url?: string;
    score: number;
    icon?: string;
    tags?: string[];
}

export interface SearchIndex {
    modules: SearchIndexEntry[];
    cards: SearchIndexEntry[];
    faqs: SearchIndexEntry[];
    videos: SearchIndexEntry[];
    lastBuilt: Date;
}

interface SearchIndexEntry {
    id: string;
    type: SearchResultType;
    moduleId: HelpModuleId;
    searchableText: string;
    searchableTextPl: string;
    title: string;
    titlePl?: string;
    excerpt: string;
    excerptPl?: string;
    url?: string;
    icon?: string;
    tags: string[];
    weight: number; // Priority weight (1-10)
}

// Singleton search index
let searchIndex: SearchIndex | null = null;

/**
 * Normalize text for search (lowercase, remove special chars)
 */
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calculate relevance score for a search match
 */
function calculateScore(
    query: string,
    entry: SearchIndexEntry,
    language: 'en' | 'pl'
): number {
    const normalizedQuery = normalizeText(query);
    const words = normalizedQuery.split(' ').filter(w => w.length > 2);
    
    if (words.length === 0) return 0;
    
    const searchableText = language === 'pl' 
        ? entry.searchableTextPl 
        : entry.searchableText;
    const normalizedText = normalizeText(searchableText);
    const title = normalizeText(language === 'pl' && entry.titlePl ? entry.titlePl : entry.title);
    
    let score = 0;
    
    // Exact phrase match in title (highest priority)
    if (title.includes(normalizedQuery)) {
        score += 100;
    }
    
    // Exact phrase match in text
    if (normalizedText.includes(normalizedQuery)) {
        score += 50;
    }
    
    // Individual word matches
    words.forEach(word => {
        // Title word match
        if (title.includes(word)) {
            score += 30;
        }
        
        // Text word match
        if (normalizedText.includes(word)) {
            score += 10;
        }
        
        // Tag match
        if (entry.tags.some(tag => normalizeText(tag).includes(word))) {
            score += 20;
        }
    });
    
    // Apply weight multiplier
    score *= entry.weight / 5;
    
    // Type bonus (modules are most important)
    const typeBonus: Record<SearchResultType, number> = {
        module: 1.5,
        card: 1.2,
        faq: 1.0,
        video: 1.1
    };
    score *= typeBonus[entry.type];
    
    return Math.round(score * 100) / 100;
}

/**
 * Build search index from all content sources
 */
export function buildSearchIndex(): SearchIndex {
    const startTime = Date.now();
    
    const index: SearchIndex = {
        modules: [],
        cards: [],
        faqs: [],
        videos: [],
        lastBuilt: new Date()
    };
    
    // Index modules
    Object.entries(MODULE_HELP_CONTENT).forEach(([moduleId, module]) => {
        const searchableText = [
            module.name.en,
            module.description.en,
            module.purpose.en,
            ...module.keyFeatures.map(f => `${f.title.en} ${f.description.en}`),
            ...module.tips.en
        ].join(' ');
        
        const searchableTextPl = [
            module.name.pl,
            module.description.pl,
            module.purpose.pl,
            ...module.keyFeatures.map(f => `${f.title.pl} ${f.description.pl}`),
            ...module.tips.pl
        ].join(' ');
        
        index.modules.push({
            id: moduleId,
            type: 'module',
            moduleId: moduleId as HelpModuleId,
            searchableText,
            searchableTextPl,
            title: module.name.en,
            titlePl: module.name.pl,
            excerpt: module.description.en.slice(0, 150) + '...',
            excerptPl: module.description.pl.slice(0, 150) + '...',
            icon: module.icon,
            tags: module.keyFeatures.map(f => f.title.en),
            weight: 10
        });
    });
    
    // Index cards
    Object.entries(CARD_DOCS).forEach(([cardId, card]) => {
        const searchableText = [
            card.title,
            card.description,
            ...card.features,
            ...card.howToUse,
            ...card.tips
        ].join(' ');
        
        index.cards.push({
            id: cardId,
            type: 'card',
            moduleId: card.moduleId || 'dashboard',
            searchableText,
            searchableTextPl: searchableText, // Cards are currently EN only
            title: card.title,
            excerpt: card.description.slice(0, 150) + '...',
            tags: card.features.slice(0, 5),
            weight: 7
        });
    });
    
    // Index FAQs
    FAQ_CONTENT.forEach(faq => {
        index.faqs.push({
            id: faq.id,
            type: 'faq',
            moduleId: faq.moduleId,
            searchableText: `${faq.question} ${faq.answer}`,
            searchableTextPl: `${faq.questionPl} ${faq.answerPl}`,
            title: faq.question,
            titlePl: faq.questionPl,
            excerpt: faq.answer.slice(0, 150) + '...',
            excerptPl: faq.answerPl.slice(0, 150) + '...',
            tags: faq.tags,
            weight: 6
        });
    });
    
    // Index videos
    VIDEO_TUTORIALS.forEach(video => {
        index.videos.push({
            id: video.id,
            type: 'video',
            moduleId: video.moduleId,
            searchableText: `${video.title.en} ${video.description.en}`,
            searchableTextPl: `${video.title.pl} ${video.description.pl}`,
            title: video.title.en,
            titlePl: video.title.pl,
            excerpt: video.description.en.slice(0, 150) + '...',
            excerptPl: video.description.pl.slice(0, 150) + '...',
            url: video.url,
            tags: video.tags || [],
            weight: 8
        });
    });
    
    console.log(`[HelpSearch] Index built in ${Date.now() - startTime}ms`);
    console.log(`[HelpSearch] Indexed: ${index.modules.length} modules, ${index.cards.length} cards, ${index.faqs.length} FAQs, ${index.videos.length} videos`);
    
    searchIndex = index;
    return index;
}

/**
 * Get or build search index
 */
export function getSearchIndex(): SearchIndex {
    if (!searchIndex) {
        return buildSearchIndex();
    }
    return searchIndex;
}

/**
 * Search help content
 */
export function searchHelp(
    query: string,
    options: {
        limit?: number;
        types?: SearchResultType[];
        moduleId?: HelpModuleId;
        language?: 'en' | 'pl';
    } = {}
): SearchResult[] {
    const {
        limit = 20,
        types = ['module', 'card', 'faq', 'video'],
        moduleId,
        language = 'en'
    } = options;
    
    if (!query || query.trim().length < 2) {
        return [];
    }
    
    const index = getSearchIndex();
    const results: SearchResult[] = [];
    
    // Search through each index type
    const allEntries: SearchIndexEntry[] = [];
    
    if (types.includes('module')) {
        allEntries.push(...index.modules);
    }
    if (types.includes('card')) {
        allEntries.push(...index.cards);
    }
    if (types.includes('faq')) {
        allEntries.push(...index.faqs);
    }
    if (types.includes('video')) {
        allEntries.push(...index.videos);
    }
    
    // Filter by module if specified
    const filteredEntries = moduleId
        ? allEntries.filter(e => e.moduleId === moduleId)
        : allEntries;
    
    // Calculate scores and filter
    filteredEntries.forEach(entry => {
        const score = calculateScore(query, entry, language);
        
        if (score > 0) {
            results.push({
                type: entry.type,
                id: entry.id,
                title: language === 'pl' && entry.titlePl ? entry.titlePl : entry.title,
                titlePl: entry.titlePl,
                excerpt: language === 'pl' && entry.excerptPl ? entry.excerptPl : entry.excerpt,
                excerptPl: entry.excerptPl,
                moduleId: entry.moduleId,
                url: entry.url,
                score,
                icon: entry.icon,
                tags: entry.tags
            });
        }
    });
    
    // Sort by score (descending) and limit
    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

/**
 * Get search suggestions based on partial query
 */
export function getSearchSuggestions(
    partialQuery: string,
    language: 'en' | 'pl' = 'en',
    limit: number = 5
): string[] {
    if (!partialQuery || partialQuery.length < 2) {
        return [];
    }
    
    const index = getSearchIndex();
    const normalizedQuery = normalizeText(partialQuery);
    const suggestions = new Set<string>();
    
    // Collect matching titles
    const allEntries = [
        ...index.modules,
        ...index.cards,
        ...index.faqs,
        ...index.videos
    ];
    
    allEntries.forEach(entry => {
        const title = language === 'pl' && entry.titlePl ? entry.titlePl : entry.title;
        if (normalizeText(title).includes(normalizedQuery)) {
            suggestions.add(title);
        }
        
        // Also add matching tags
        entry.tags.forEach(tag => {
            if (normalizeText(tag).includes(normalizedQuery)) {
                suggestions.add(tag);
            }
        });
    });
    
    return Array.from(suggestions).slice(0, limit);
}

/**
 * Get recent searches from localStorage
 */
export function getRecentSearches(): string[] {
    if (typeof window === 'undefined') return [];
    
    try {
        const stored = localStorage.getItem('consultify_help_searches');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

/**
 * Save search to recent searches
 */
export function saveRecentSearch(query: string): void {
    if (typeof window === 'undefined' || !query.trim()) return;
    
    try {
        const recent = getRecentSearches();
        const updated = [
            query,
            ...recent.filter(s => s.toLowerCase() !== query.toLowerCase())
        ].slice(0, 10);
        
        localStorage.setItem('consultify_help_searches', JSON.stringify(updated));
    } catch {
        // Ignore storage errors
    }
}

/**
 * Clear recent searches
 */
export function clearRecentSearches(): void {
    if (typeof window === 'undefined') return;
    
    try {
        localStorage.removeItem('consultify_help_searches');
    } catch {
        // Ignore storage errors
    }
}

/**
 * Get popular search terms (static list for now, could be analytics-driven)
 */
export function getPopularSearches(language: 'en' | 'pl' = 'en'): string[] {
    const popularEN = [
        'assessment',
        'initiatives',
        'roadmap',
        'ROI calculator',
        'AI recommendations',
        'dashboard',
        'export report',
        'user permissions'
    ];
    
    const popularPL = [
        'ocena',
        'inicjatywy',
        'mapa drogowa',
        'kalkulator ROI',
        'rekomendacje AI',
        'dashboard',
        'eksport raportu',
        'uprawnienia użytkowników'
    ];
    
    return language === 'pl' ? popularPL : popularEN;
}

/**
 * Highlight search query in text
 */
export function highlightQuery(text: string, query: string): string {
    if (!query || !text) return text;
    
    const words = query.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return text;
    
    let highlighted = text;
    words.forEach(word => {
        const regex = new RegExp(`(${word})`, 'gi');
        highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });
    
    return highlighted;
}

// Export singleton interface
export default {
    buildSearchIndex,
    getSearchIndex,
    searchHelp,
    getSearchSuggestions,
    getRecentSearches,
    saveRecentSearch,
    clearRecentSearches,
    getPopularSearches,
    highlightQuery
};

