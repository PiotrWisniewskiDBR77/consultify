const db = require('../database');

const RagService = {
    /**
     * Retrieves relevant context from the knowledge base based on a query.
     * @param {string} query - The search query (usually user message or analysis topic).
     * @param {number} limit - Number of chunks to retrieve.
     * @returns {Promise<string>} - Combined text of relevant chunks.
     */
    getContext: (query, limit = 3) => {
        return new Promise((resolve, reject) => {
            if (!query) return resolve('');

            // Extract meaningful keywords (length > 3)
            const keywords = query.split(' ')
                .map(w => w.trim().replace(/[^\w\s]/gi, '')) // Remove punctuation
                .filter(w => w.length > 3);

            if (keywords.length === 0) return resolve('');

            // Basic keyword matching (SQLite LIKE)
            // In a production system, this should be Vector Search (e.g. pgvector or Pinecone)
            const sqlParts = keywords.map(() => "content LIKE ?").join(" OR ");
            const params = keywords.map(w => `%${w}%`);

            // Add limit to params
            // params.push(limit); // db.all doesn't take limit as param easily with map above without spread

            const sql = `
                SELECT content, filename, doc_id
                FROM knowledge_chunks 
                JOIN knowledge_docs ON knowledge_chunks.doc_id = knowledge_docs.id
                WHERE ${sqlParts} 
                LIMIT ${limit}
            `;

            db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error("RAG Error:", err);
                    resolve('');
                } else if (!rows || rows.length === 0) {
                    resolve('');
                } else {
                    // Format the context with citations
                    const context = rows.map(r =>
                        `[Source: ${r.filename}]\n${r.content}`
                    ).join('\n\n');
                    resolve(context);
                }
            });
        });
    },

    /**
     * Retrieves context specifically for a given Axis definition.
     * This aids the Diagnosis Engine to find "Level 1" vs "Level 5" definitions.
     * @param {string} axisName - E.g. "Digital Processes" or "Culture"
     * @returns {Promise<string>}
     */
    getAxisDefinitions: (axisName) => {
        // This is a heuristic wrapper around getContext
        // We assume the PDF files are named or contain text like "Axis 1", "Level 1", etc.
        const query = `${axisName} maturity levels definitions 1 2 3 4 5`;
        return RagService.getContext(query, 10); // Get more chunks for broad definition
    }
};

module.exports = RagService;
