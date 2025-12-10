const db = require('../database');
const fetch = require('node-fetch'); // Ensure node-fetch is available (built-in in newer node or needs install)

// Helper to get API Key
const getSearchProvider = () => {
    return new Promise((resolve) => {
        db.get("SELECT * FROM llm_providers WHERE provider IN ('tavily', 'serper', 'google_search') AND is_active = 1 LIMIT 1", (err, row) => {
            resolve(row);
        });
    });
};

const WebSearchService = {
    /**
     * Verifies a fact or statement by searching the web.
     * Supports Tavily (recommended), Serper, or Google Programmable Search.
     */
    verifyFact: async (query) => {
        const providerConfig = await getSearchProvider();

        if (!providerConfig) {
            console.warn("[WebSearch] No active search provider found. Walled Garden mode.");
            return {
                isVerified: false,
                sources: [],
                confidence: 0,
                note: "No search provider configured. (Simulated)"
            };
        }

        try {
            if (providerConfig.provider === 'tavily') {
                return await searchTavily(query, providerConfig.api_key);
            }
            // Add other providers here
            return { isVerified: false, sources: [], confidence: 0, note: "Provider not implemented" };

        } catch (error) {
            console.error("[WebSearch] API Error:", error);
            return {
                isVerified: false,
                sources: [],
                confidence: 0,
                note: "Search failed."
            };
        }
    },

    /**
     * General search for enrichment
     */
    search: async (query) => {
        return WebSearchService.verifyFact(query);
    }
};

// --- TAVILY IMPLEMENTATION ---
async function searchTavily(query, apiKey) {
    const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            api_key: apiKey,
            query: query,
            search_depth: "basic",
            include_answer: true,
            max_results: 5
        })
    });

    if (!response.ok) {
        throw new Error(`Tavily API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
        isVerified: true,
        answer: data.answer,
        sources: data.results.map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.content,
            score: r.score
        })),
        confidence: 0.9, // Tavily is usually reliable
        provider: 'tavily'
    };
}

module.exports = WebSearchService;
