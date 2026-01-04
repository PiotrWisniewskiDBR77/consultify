/**
 * Knowledge Graph Service
 * 
 * Provides graph-based knowledge representation and querying for:
 * - Concept relationships (is-a, has-a, related-to)
 * - Cross-document linking
 * - Hierarchical knowledge structures
 * - Industry-specific taxonomies
 * 
 * This is a lightweight in-memory implementation.
 * For production, consider Neo4j, TypeDB, or Amazon Neptune.
 */

// Dependency injection for testing
const deps = {
    _db: null,
    _uuidv4: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../src/database/Database.ts');
        deps._db = db;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
}

// In-memory graph structure (for fast queries)
let graphCache = {
    nodes: new Map(),
    edges: new Map(),
    lastUpdated: null
};

// Relationship types
const RELATION_TYPES = {
    IS_A: 'is_a',           // Taxonomy: "DevOps IS_A Methodology"
    PART_OF: 'part_of',     // Composition: "Sprint PART_OF Scrum"
    RELATED_TO: 'related_to', // Association: "Agile RELATED_TO Lean"
    DEPENDS_ON: 'depends_on', // Dependency: "CI DEPENDS_ON Version Control"
    PREREQUISITE: 'prerequisite', // Order: "Discovery PREREQUISITE Analysis"
    CONTRADICTS: 'contradicts', // Conflict: "Waterfall CONTRADICTS Agile"
    SIMILAR_TO: 'similar_to', // Similarity: "Kanban SIMILAR_TO Scrum"
    EXAMPLE_OF: 'example_of', // Instance: "Jira EXAMPLE_OF PM Tool"
    ENABLES: 'enables',       // Enablement: "Automation ENABLES Scale"
    MITIGATES: 'mitigates'    // Risk: "Testing MITIGATES Defects"
};

// Node types
const NODE_TYPES = {
    CONCEPT: 'concept',
    METHODOLOGY: 'methodology',
    FRAMEWORK: 'framework',
    TOOL: 'tool',
    PRACTICE: 'practice',
    ROLE: 'role',
    ARTIFACT: 'artifact',
    METRIC: 'metric',
    RISK: 'risk',
    INDUSTRY: 'industry'
};

const KnowledgeGraphService = {
    RELATION_TYPES,
    NODE_TYPES,

    /**
     * Initialize the knowledge graph from database
     */
    initialize: async () => {
        return new Promise((resolve, reject) => {
            // Create tables if not exist
            db.serialize(() => {
                deps.db.run(`
                    CREATE TABLE IF NOT EXISTS kg_nodes (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        type TEXT NOT NULL,
                        description TEXT,
                        properties TEXT,
                        embedding TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                deps.db.run(`
                    CREATE TABLE IF NOT EXISTS kg_edges (
                        id TEXT PRIMARY KEY,
                        source_id TEXT NOT NULL,
                        target_id TEXT NOT NULL,
                        relation TEXT NOT NULL,
                        weight REAL DEFAULT 1.0,
                        properties TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (source_id) REFERENCES kg_nodes(id),
                        FOREIGN KEY (target_id) REFERENCES kg_nodes(id)
                    )
                `);

                deps.db.run(`CREATE INDEX IF NOT EXISTS idx_kg_nodes_name ON kg_nodes(name)`);
                deps.db.run(`CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON kg_nodes(type)`);
                deps.db.run(`CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON kg_edges(source_id)`);
                deps.db.run(`CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON kg_edges(target_id)`);
                deps.db.run(`CREATE INDEX IF NOT EXISTS idx_kg_edges_relation ON kg_edges(relation)`);
            });

            // Load graph into memory cache
            KnowledgeGraphService.loadGraphCache()
                .then(resolve)
                .catch(reject);
        });
    },

    /**
     * Load graph into memory cache
     */
    loadGraphCache: async () => {
        return new Promise((resolve, reject) => {
            graphCache.nodes.clear();
            graphCache.edges.clear();

            db.all('SELECT * FROM kg_nodes', [], (err, nodes) => {
                if (err) return reject(err);

                (nodes || []).forEach(node => {
                    graphCache.nodes.set(node.id, {
                        ...node,
                        properties: node.properties ? JSON.parse(node.properties) : {}
                    });
                });

                db.all('SELECT * FROM kg_edges', [], (err, edges) => {
                    if (err) return reject(err);

                    (edges || []).forEach(edge => {
                        graphCache.edges.set(edge.id, {
                            ...edge,
                            properties: edge.properties ? JSON.parse(edge.properties) : {}
                        });
                    });

                    graphCache.lastUpdated = new Date();
                    console.log(`[KnowledgeGraph] Loaded ${graphCache.nodes.size} nodes, ${graphCache.edges.size} edges`);
                    resolve();
                });
            });
        });
    },

    /**
     * Add a node to the knowledge graph
     */
    addNode: async (node) => {
        const id = node.id || uuidv4();
        const properties = JSON.stringify(node.properties || {});

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO kg_nodes (id, name, type, description, properties, updated_at)
                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [id, node.name, node.type, node.description, properties],
                function(err) {
                    if (err) return reject(err);

                    const newNode = {
                        id,
                        name: node.name,
                        type: node.type,
                        description: node.description,
                        properties: node.properties || {}
                    };
                    graphCache.nodes.set(id, newNode);
                    resolve(newNode);
                }
            );
        });
    },

    /**
     * Add an edge (relationship) between nodes
     */
    addEdge: async (edge) => {
        const id = edge.id || uuidv4();
        const properties = JSON.stringify(edge.properties || {});

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO kg_edges (id, source_id, target_id, relation, weight, properties)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, edge.sourceId, edge.targetId, edge.relation, edge.weight || 1.0, properties],
                function(err) {
                    if (err) return reject(err);

                    const newEdge = {
                        id,
                        source_id: edge.sourceId,
                        target_id: edge.targetId,
                        relation: edge.relation,
                        weight: edge.weight || 1.0,
                        properties: edge.properties || {}
                    };
                    graphCache.edges.set(id, newEdge);
                    resolve(newEdge);
                }
            );
        });
    },

    /**
     * Find node by name (fuzzy match)
     */
    findNode: async (name) => {
        const nameLower = name.toLowerCase();
        
        // Check cache first
        for (const [id, node] of graphCache.nodes) {
            if (node.name.toLowerCase() === nameLower) {
                return node;
            }
        }

        // Fuzzy search in cache
        for (const [id, node] of graphCache.nodes) {
            if (node.name.toLowerCase().includes(nameLower) || 
                nameLower.includes(node.name.toLowerCase())) {
                return node;
            }
        }

        return null;
    },

    /**
     * Get all related nodes for a given node
     */
    getRelatedNodes: async (nodeId, options = {}) => {
        const { relation, direction = 'both', maxDepth = 1 } = options;
        const related = [];
        const visited = new Set();

        const traverse = (currentId, depth) => {
            if (depth > maxDepth || visited.has(currentId)) return;
            visited.add(currentId);

            for (const [edgeId, edge] of graphCache.edges) {
                if (relation && edge.relation !== relation) continue;

                let targetId = null;
                let isOutgoing = true;

                if (edge.source_id === currentId && (direction === 'both' || direction === 'outgoing')) {
                    targetId = edge.target_id;
                } else if (edge.target_id === currentId && (direction === 'both' || direction === 'incoming')) {
                    targetId = edge.source_id;
                    isOutgoing = false;
                }

                if (targetId && !visited.has(targetId)) {
                    const node = graphCache.nodes.get(targetId);
                    if (node) {
                        related.push({
                            node,
                            edge,
                            direction: isOutgoing ? 'outgoing' : 'incoming',
                            depth
                        });

                        if (depth < maxDepth) {
                            traverse(targetId, depth + 1);
                        }
                    }
                }
            }
        };

        traverse(nodeId, 1);
        return related;
    },

    /**
     * Query the knowledge graph with a natural language query
     * Returns relevant concepts and their relationships
     */
    query: async (queryText, options = {}) => {
        const { limit = 10, includeRelated = true, maxDepth = 2 } = options;
        const results = [];
        const queryWords = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 2);

        // Score nodes by relevance
        for (const [id, node] of graphCache.nodes) {
            let score = 0;
            const nameLower = node.name.toLowerCase();
            const descLower = (node.description || '').toLowerCase();

            for (const word of queryWords) {
                if (nameLower === word) score += 10;
                else if (nameLower.includes(word)) score += 5;
                if (descLower.includes(word)) score += 2;
            }

            if (score > 0) {
                results.push({ node, score });
            }
        }

        // Sort by score
        results.sort((a, b) => b.score - a.score);
        const topResults = results.slice(0, limit);

        // Enrich with related nodes if requested
        if (includeRelated) {
            for (const result of topResults) {
                result.related = await KnowledgeGraphService.getRelatedNodes(result.node.id, {
                    maxDepth
                });
            }
        }

        return topResults;
    },

    /**
     * Find shortest path between two concepts
     */
    findPath: async (sourceId, targetId, maxDepth = 5) => {
        const queue = [[sourceId]];
        const visited = new Set([sourceId]);

        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];

            if (current === targetId) {
                // Build path with nodes and edges
                const fullPath = [];
                for (let i = 0; i < path.length; i++) {
                    fullPath.push({
                        node: graphCache.nodes.get(path[i]),
                        edge: i > 0 ? KnowledgeGraphService.findEdge(path[i-1], path[i]) : null
                    });
                }
                return fullPath;
            }

            if (path.length > maxDepth) continue;

            // Get neighbors
            for (const [edgeId, edge] of graphCache.edges) {
                let nextId = null;
                if (edge.source_id === current) nextId = edge.target_id;
                else if (edge.target_id === current) nextId = edge.source_id;

                if (nextId && !visited.has(nextId)) {
                    visited.add(nextId);
                    queue.push([...path, nextId]);
                }
            }
        }

        return null; // No path found
    },

    /**
     * Find edge between two nodes
     */
    findEdge: (sourceId, targetId) => {
        for (const [edgeId, edge] of graphCache.edges) {
            if ((edge.source_id === sourceId && edge.target_id === targetId) ||
                (edge.source_id === targetId && edge.target_id === sourceId)) {
                return edge;
            }
        }
        return null;
    },

    /**
     * Get graph statistics
     */
    getStats: () => {
        const nodesByType = {};
        const edgesByRelation = {};

        for (const [id, node] of graphCache.nodes) {
            nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
        }

        for (const [id, edge] of graphCache.edges) {
            edgesByRelation[edge.relation] = (edgesByRelation[edge.relation] || 0) + 1;
        }

        return {
            totalNodes: graphCache.nodes.size,
            totalEdges: graphCache.edges.size,
            nodesByType,
            edgesByRelation,
            lastUpdated: graphCache.lastUpdated
        };
    },

    /**
     * Seed the knowledge graph with default consulting concepts
     */
    seedDefaultKnowledge: async () => {
        const concepts = [
            // Methodologies
            { name: 'Agile', type: NODE_TYPES.METHODOLOGY, description: 'Iterative approach to project management and software development' },
            { name: 'Scrum', type: NODE_TYPES.FRAMEWORK, description: 'Agile framework for managing work with emphasis on sprints' },
            { name: 'Kanban', type: NODE_TYPES.METHODOLOGY, description: 'Visual workflow management method' },
            { name: 'Lean', type: NODE_TYPES.METHODOLOGY, description: 'Continuous improvement through waste elimination' },
            { name: 'DevOps', type: NODE_TYPES.PRACTICE, description: 'Integration of development and operations' },
            { name: 'Design Thinking', type: NODE_TYPES.METHODOLOGY, description: 'Human-centered approach to innovation' },
            { name: 'Six Sigma', type: NODE_TYPES.METHODOLOGY, description: 'Data-driven approach to eliminating defects' },
            { name: 'PRINCE2', type: NODE_TYPES.FRAMEWORK, description: 'Structured project management methodology' },
            { name: 'PMBOK', type: NODE_TYPES.FRAMEWORK, description: 'Project Management Body of Knowledge' },
            
            // Digital Transformation Concepts
            { name: 'Digital Transformation', type: NODE_TYPES.CONCEPT, description: 'Integration of digital technology into all business areas' },
            { name: 'Cloud Computing', type: NODE_TYPES.CONCEPT, description: 'On-demand availability of computer resources' },
            { name: 'Artificial Intelligence', type: NODE_TYPES.CONCEPT, description: 'Simulation of human intelligence by machines' },
            { name: 'Machine Learning', type: NODE_TYPES.CONCEPT, description: 'AI systems that learn from data' },
            { name: 'Data Analytics', type: NODE_TYPES.CONCEPT, description: 'Analysis of data for insights and decisions' },
            { name: 'Automation', type: NODE_TYPES.CONCEPT, description: 'Technology to perform tasks with minimal human intervention' },
            { name: 'IoT', type: NODE_TYPES.CONCEPT, description: 'Internet of Things - connected devices and sensors' },
            
            // Change Management
            { name: 'ADKAR', type: NODE_TYPES.FRAMEWORK, description: 'Change management model: Awareness, Desire, Knowledge, Ability, Reinforcement' },
            { name: 'Kotter 8 Steps', type: NODE_TYPES.FRAMEWORK, description: "Kotter's 8-step change model" },
            { name: 'Change Readiness', type: NODE_TYPES.CONCEPT, description: 'Organization capacity to adopt change' },
            { name: 'Stakeholder Management', type: NODE_TYPES.PRACTICE, description: 'Managing stakeholder expectations and engagement' },
            
            // Strategy
            { name: 'Strategic Planning', type: NODE_TYPES.PRACTICE, description: 'Process of defining strategy and direction' },
            { name: 'SWOT Analysis', type: NODE_TYPES.TOOL, description: 'Strengths, Weaknesses, Opportunities, Threats analysis' },
            { name: "Porter's Five Forces", type: NODE_TYPES.FRAMEWORK, description: 'Framework for industry analysis' },
            { name: 'Blue Ocean Strategy', type: NODE_TYPES.FRAMEWORK, description: 'Creating uncontested market space' },
            { name: 'OKRs', type: NODE_TYPES.FRAMEWORK, description: 'Objectives and Key Results goal-setting framework' },
            { name: 'Balanced Scorecard', type: NODE_TYPES.FRAMEWORK, description: 'Strategic performance management tool' },
            
            // Metrics & KPIs
            { name: 'ROI', type: NODE_TYPES.METRIC, description: 'Return on Investment' },
            { name: 'NPV', type: NODE_TYPES.METRIC, description: 'Net Present Value' },
            { name: 'TCO', type: NODE_TYPES.METRIC, description: 'Total Cost of Ownership' },
            { name: 'NPS', type: NODE_TYPES.METRIC, description: 'Net Promoter Score' },
            { name: 'Time to Market', type: NODE_TYPES.METRIC, description: 'Time from idea to product launch' }
        ];

        // Add nodes
        const nodeMap = new Map();
        for (const concept of concepts) {
            const node = await KnowledgeGraphService.addNode(concept);
            nodeMap.set(concept.name, node.id);
        }

        // Add relationships
        const relationships = [
            { source: 'Scrum', target: 'Agile', relation: RELATION_TYPES.PART_OF },
            { source: 'Kanban', target: 'Lean', relation: RELATION_TYPES.RELATED_TO },
            { source: 'DevOps', target: 'Agile', relation: RELATION_TYPES.RELATED_TO },
            { source: 'Machine Learning', target: 'Artificial Intelligence', relation: RELATION_TYPES.PART_OF },
            { source: 'Cloud Computing', target: 'Digital Transformation', relation: RELATION_TYPES.ENABLES },
            { source: 'Automation', target: 'Digital Transformation', relation: RELATION_TYPES.ENABLES },
            { source: 'Data Analytics', target: 'Digital Transformation', relation: RELATION_TYPES.ENABLES },
            { source: 'ADKAR', target: 'Change Readiness', relation: RELATION_TYPES.RELATED_TO },
            { source: 'Stakeholder Management', target: 'Change Readiness', relation: RELATION_TYPES.ENABLES },
            { source: 'SWOT Analysis', target: 'Strategic Planning', relation: RELATION_TYPES.PART_OF },
            { source: "Porter's Five Forces", target: 'Strategic Planning', relation: RELATION_TYPES.PART_OF },
            { source: 'OKRs', target: 'Strategic Planning', relation: RELATION_TYPES.RELATED_TO },
            { source: 'ROI', target: 'NPV', relation: RELATION_TYPES.RELATED_TO },
            { source: 'Six Sigma', target: 'Lean', relation: RELATION_TYPES.RELATED_TO },
            { source: 'Design Thinking', target: 'Agile', relation: RELATION_TYPES.RELATED_TO },
            { source: 'PRINCE2', target: 'PMBOK', relation: RELATION_TYPES.SIMILAR_TO },
            { source: 'IoT', target: 'Digital Transformation', relation: RELATION_TYPES.ENABLES },
            { source: 'Artificial Intelligence', target: 'Digital Transformation', relation: RELATION_TYPES.ENABLES }
        ];

        for (const rel of relationships) {
            const sourceId = nodeMap.get(rel.source);
            const targetId = nodeMap.get(rel.target);
            if (sourceId && targetId) {
                await KnowledgeGraphService.addEdge({
                    sourceId,
                    targetId,
                    relation: rel.relation
                });
            }
        }

        console.log(`[KnowledgeGraph] Seeded ${concepts.length} concepts and ${relationships.length} relationships`);
        return KnowledgeGraphService.getStats();
    },

    /**
     * Export graph for visualization
     */
    exportForVisualization: () => {
        const nodes = [];
        const edges = [];

        for (const [id, node] of graphCache.nodes) {
            nodes.push({
                id: node.id,
                label: node.name,
                type: node.type,
                description: node.description
            });
        }

        for (const [id, edge] of graphCache.edges) {
            edges.push({
                id: edge.id,
                source: edge.source_id,
                target: edge.target_id,
                label: edge.relation,
                weight: edge.weight
            });
        }

        return { nodes, edges };
    }
};

export default KnowledgeGraphService;






