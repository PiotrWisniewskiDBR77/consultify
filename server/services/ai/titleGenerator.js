/**
 * Title Generator Service
 * 
 * Automatically generates concise, action-oriented titles for conversations
 * using AI. Titles are 3-5 words capturing the essence of the discussion.
 */

const { AIPipeline } = require('./aiPipeline');

/**
 * Generate a conversation title from messages
 * @param {Array} messages - Array of { role: string, content: string }
 * @returns {Promise<string>} Generated title
 */
async function generateConversationTitle(messages) {
    if (!messages || messages.length < 2) {
        return 'New conversation';
    }

    // Extract conversation context from first few exchanges
    const context = messages
        .slice(0, 6)
        .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 200)}`)
        .join('\n');

    const prompt = `Generate a concise 3-5 word title for this conversation.
The title should be:
- Action-oriented or topic-focused
- Specific to the content discussed
- Professional and clear

Examples of good titles:
- "Q4 Assessment Review"
- "Initiative ROI Analysis"
- "Digital Roadmap Planning"
- "Data Maturity Discussion"
- "Cloud Migration Strategy"

Conversation:
${context}

Return ONLY the title, nothing else. No quotes, no explanation.
Title:`;

    try {
        const pipeline = new AIPipeline();
        
        // Use a fast, cheap model for title generation
        const result = await pipeline.process({
            type: 'title_generation',
            userId: 'system',
            organizationId: null,
            prompt: prompt,
            options: {
                maxTokens: 20,
                temperature: 0.7,
                tier: 'budget' // Use cheapest model
            }
        });

        if (result.success && result.response) {
            // Clean up the response
            let title = result.response
                .trim()
                .replace(/^["']|["']$/g, '') // Remove quotes
                .replace(/^Title:\s*/i, '')   // Remove "Title:" prefix
                .slice(0, 100);               // Max 100 chars
            
            // Ensure it's not too long
            if (title.split(' ').length > 7) {
                title = title.split(' ').slice(0, 5).join(' ');
            }
            
            return title || 'New conversation';
        }

        return 'New conversation';
    } catch (err) {
        console.error('[TitleGenerator] Error generating title:', err.message);
        // Fallback: generate simple title from first user message
        return generateFallbackTitle(messages);
    }
}

/**
 * Generate a simple fallback title without AI
 * @param {Array} messages - Array of messages
 * @returns {string} Simple title
 */
function generateFallbackTitle(messages) {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) return 'New conversation';

    const content = firstUserMessage.content.trim();
    
    // Extract first meaningful phrase
    const words = content
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2)
        .slice(0, 5);

    if (words.length === 0) return 'New conversation';
    
    // Capitalize first letter
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
    
    return words.join(' ');
}

/**
 * Detect relevant tags from conversation content
 * @param {Array} messages - Array of messages
 * @returns {string[]} Array of detected tags
 */
function detectTags(messages) {
    const tags = new Set();
    const content = messages.map(m => m.content.toLowerCase()).join(' ');

    // PMO-specific tag detection
    const tagPatterns = [
        { pattern: /assessment|maturity|drd|siri|adma|cmmi/i, tag: 'assessment' },
        { pattern: /initiative|improvement|project proposal/i, tag: 'initiative' },
        { pattern: /roadmap|timeline|phases|milestones/i, tag: 'roadmap' },
        { pattern: /roi|cost|benefit|economic|investment/i, tag: 'economics' },
        { pattern: /report|executive summary|analysis/i, tag: 'report' },
        { pattern: /strategy|strategic|goals|objectives/i, tag: 'strategy' },
        { pattern: /risk|issue|mitigation/i, tag: 'risk' },
        { pattern: /kpi|metrics|measure|performance/i, tag: 'metrics' },
        { pattern: /team|resource|capacity|workload/i, tag: 'resources' },
        { pattern: /digital|transformation|automation/i, tag: 'digital' },
    ];

    for (const { pattern, tag } of tagPatterns) {
        if (pattern.test(content)) {
            tags.add(tag);
        }
    }

    return Array.from(tags).slice(0, 5); // Max 5 tags
}

/**
 * Check if a conversation needs title regeneration
 * @param {Object} conversation - Conversation object with title and messages
 * @returns {boolean} Whether title should be regenerated
 */
function shouldRegenerateTitle(conversation) {
    // Don't regenerate if user manually edited
    if (conversation.title_source === 'user') return false;
    
    // Regenerate if title is default
    if (conversation.title === 'New conversation') return true;
    
    // Regenerate if title is too generic
    const genericTitles = ['imported conversation', 'chat', 'discussion'];
    if (genericTitles.includes(conversation.title.toLowerCase())) return true;
    
    return false;
}

module.exports = {
    generateConversationTitle,
    generateFallbackTitle,
    detectTags,
    shouldRegenerateTitle
};

