/**
 * Help Chat Service
 * 
 * AI-powered chat service that uses help content embeddings
 * to answer user questions.
 */

import db from '../database.js';
import { OpenAI } from 'openai';

// Lazy initialize OpenAI client
let openai = null;
function getOpenAIClient() {
    if (!openai && process.env.OPENAI_API_KEY) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    return openai;
}

// Help content cache
let helpContentCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Load all help content for context
 */
async function loadHelpContent() {
    const now = Date.now();
    if (helpContentCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
        return helpContentCache;
    }
    
    // Load from various help content sources
    try {
        // Module help content
        const moduleHelp = require('../../config/moduleHelpContent').MODULE_HELP_CONTENT;
        
        // Card documentation
        const cardDocs = require('../../config/cardDocumentation').cardDocumentation;
        
        // FAQs
        const faqs = require('../../config/faqContent').FAQ_CONTENT;
        
        helpContentCache = {
            modules: moduleHelp,
            cards: cardDocs,
            faqs: faqs
        };
        cacheTimestamp = now;
        
        return helpContentCache;
    } catch (error) {
        console.error('Error loading help content:', error);
        return { modules: {}, cards: {}, faqs: [] };
    }
}

/**
 * Find relevant help content based on query
 */
async function findRelevantContent(query, contextModule) {
    const content = await loadHelpContent();
    const queryLower = query.toLowerCase();
    
    const results = {
        modules: [],
        cards: [],
        faqs: []
    };
    
    // Search modules
    Object.entries(content.modules || {}).forEach(([id, module]) => {
        const searchText = [
            module.name?.en,
            module.name?.pl,
            module.description?.en,
            module.description?.pl,
            ...(module.features?.map(f => `${f.title?.en} ${f.title?.pl}`) || [])
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (searchText.includes(queryLower) || id === contextModule) {
            results.modules.push({ id, ...module, relevance: id === contextModule ? 'context' : 'match' });
        }
    });
    
    // Search cards
    Object.entries(content.cards || {}).forEach(([id, card]) => {
        const searchText = [
            card.title?.en,
            card.title?.pl,
            card.description?.en,
            card.description?.pl
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (searchText.includes(queryLower) || card.moduleId === contextModule) {
            results.cards.push({ id, ...card, relevance: card.moduleId === contextModule ? 'context' : 'match' });
        }
    });
    
    // Search FAQs
    (content.faqs || []).forEach((faq) => {
        const searchText = [
            faq.question?.en,
            faq.question?.pl,
            faq.answer?.en,
            faq.answer?.pl
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (searchText.includes(queryLower) || faq.moduleId === contextModule) {
            results.faqs.push({ ...faq, relevance: faq.moduleId === contextModule ? 'context' : 'match' });
        }
    });
    
    return results;
}

/**
 * Build context string from relevant content
 */
function buildContext(relevantContent, lang = 'en') {
    const parts = [];
    
    // Add module info
    if (relevantContent.modules.length > 0) {
        parts.push('=== MODULES ===');
        relevantContent.modules.forEach(m => {
            parts.push(`Module: ${m.name?.[lang] || m.name?.en || 'Unknown'}`);
            parts.push(`Description: ${m.description?.[lang] || m.description?.en || ''}`);
            if (m.features) {
                parts.push('Features:');
                m.features.forEach(f => {
                    parts.push(`- ${f.title?.[lang] || f.title?.en}: ${f.description?.[lang] || f.description?.en}`);
                });
            }
            parts.push('');
        });
    }
    
    // Add card documentation
    if (relevantContent.cards.length > 0) {
        parts.push('=== CARDS ===');
        relevantContent.cards.slice(0, 5).forEach(c => {
            parts.push(`Card: ${c.title?.[lang] || c.title?.en || 'Unknown'}`);
            parts.push(`Description: ${c.description?.[lang] || c.description?.en || ''}`);
            parts.push('');
        });
    }
    
    // Add FAQs
    if (relevantContent.faqs.length > 0) {
        parts.push('=== FAQs ===');
        relevantContent.faqs.slice(0, 5).forEach(f => {
            parts.push(`Q: ${f.question?.[lang] || f.question?.en}`);
            parts.push(`A: ${f.answer?.[lang] || f.answer?.en}`);
            parts.push('');
        });
    }
    
    return parts.join('\n');
}

/**
 * Process a chat message
 */
async function processMessage(message, options = {}) {
    const { context: contextModule, history = [], language = 'en' } = options;
    
    // Find relevant content
    const relevantContent = await findRelevantContent(message, contextModule);
    const contextText = buildContext(relevantContent, language);
    
    // Build system prompt
    const systemPrompt = `You are a helpful assistant for Consultify, a project and initiative management platform.
You help users understand how to use the application's features.

IMPORTANT RULES:
1. Only answer questions about Consultify and its features
2. Be concise but helpful
3. If you don't know something, say so honestly
4. Respond in ${language === 'pl' ? 'Polish' : 'English'}
5. Use the context provided below to give accurate answers

CONTEXT:
${contextText}

If the user's question is not related to Consultify, politely redirect them to ask about the application.`;

    // Build messages
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10),
        { role: 'user', content: message }
    ];
    
    try {
        // Call OpenAI
        const client = getOpenAIClient();
        if (!client) {
            throw new Error('OpenAI client not configured - missing OPENAI_API_KEY');
        }
        const completion = await client.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages,
            temperature: 0.7,
            max_tokens: 500
        });
        
        const responseMessage = completion.choices[0]?.message?.content || 
            (language === 'pl' ? 'Przepraszam, nie udało mi się wygenerować odpowiedzi.' : 'Sorry, I could not generate a response.');
        
        // Extract sources from relevant content
        const sources = [];
        relevantContent.modules.slice(0, 2).forEach(m => {
            sources.push({ id: m.id, type: 'module', title: m.name?.[language] || m.name?.en || m.id });
        });
        relevantContent.cards.slice(0, 2).forEach(c => {
            sources.push({ id: c.id, type: 'card', title: c.title?.[language] || c.title?.en || c.id });
        });
        relevantContent.faqs.slice(0, 1).forEach(f => {
            sources.push({ id: f.id, type: 'faq', title: f.question?.[language]?.slice(0, 50) || 'FAQ' });
        });
        
        return {
            message: responseMessage,
            sources
        };
    } catch (error) {
        console.error('OpenAI API error:', error);
        
        // Fallback response using just the context
        if (relevantContent.faqs.length > 0) {
            const faq = relevantContent.faqs[0];
            return {
                message: faq.answer?.[language] || faq.answer?.en,
                sources: [{ id: faq.id, type: 'faq', title: faq.question?.[language]?.slice(0, 50) || 'FAQ' }]
            };
        }
        
        throw error;
    }
}

/**
 * Log chat interaction for analytics
 */
async function logInteraction(userId, sessionId, message, response) {
    try {
        await db.run(`
            INSERT INTO help_analytics (id, user_id, session_id, event_type, content_type, metadata, created_at)
            VALUES (?, ?, ?, 'chat', 'chatbot', ?, CURRENT_TIMESTAMP)
        `, [
            `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId,
            sessionId,
            JSON.stringify({
                message: message.slice(0, 200),
                response_length: response.message?.length || 0,
                sources_count: response.sources?.length || 0
            })
        ]);
    } catch (error) {
        console.error('Error logging chat interaction:', error);
    }
}

export {
processMessage,
    logInteraction,
    findRelevantContent,
    loadHelpContent
};

export default {
    processMessage,
    logInteraction,
    findRelevantContent,
    loadHelpContent
};

