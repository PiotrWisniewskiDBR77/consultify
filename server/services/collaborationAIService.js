/**
 * Collaboration AI Service
 * 
 * Provides AI-powered collaboration features:
 * - Meeting Assistant (notes, action items, decisions)
 * - Workshop Facilitator (brainstorming, ideation)
 * - Conflict Resolution (identifying tensions)
 * - Consensus Building (finding alignment)
 * - Session Summarization
 */

import llmService from './ai/llmService.js';
import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



// Session types
const SESSION_TYPES = {
    MEETING: 'meeting',
    WORKSHOP: 'workshop',
    BRAINSTORM: 'brainstorm',
    REVIEW: 'review',
    DECISION: 'decision'
};

// Facilitation modes
const FACILITATION_MODES = {
    PASSIVE: 'passive',      // Only summarize, don't intervene
    ACTIVE: 'active',        // Suggest topics, ask questions
    GUIDED: 'guided'         // Full facilitation with structure
};

const CollaborationAIService = {
    SESSION_TYPES,
    FACILITATION_MODES,

    /**
     * Start a collaboration session
     */
    startSession: async (options) => {
        const {
            type = SESSION_TYPES.MEETING,
            title,
            agenda = [],
            participants = [],
            projectId,
            organizationId,
            facilitationMode = FACILITATION_MODES.ACTIVE
        } = options;

        const sessionId = uuidv4();
        const now = new Date();

        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO collaboration_sessions (
                    id, type, title, agenda, participants, project_id, organization_id,
                    facilitation_mode, status, started_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
            `, [
                sessionId,
                type,
                title,
                JSON.stringify(agenda),
                JSON.stringify(participants),
                projectId,
                organizationId,
                facilitationMode,
                now.toISOString()
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Generate opening facilitation
        const opening = await CollaborationAIService.generateOpeningRemarks(type, title, agenda);

        return {
            sessionId,
            type,
            title,
            agenda,
            participants,
            facilitationMode,
            startedAt: now.toISOString(),
            openingRemarks: opening,
            status: 'active'
        };
    },

    /**
     * Generate opening remarks for session
     */
    generateOpeningRemarks: async (type, title, agenda) => {
        const prompt = `You are facilitating a ${type} session titled: "${title}"

Agenda items:
${agenda.map((item, i) => `${i + 1}. ${item}`).join('\n') || 'No formal agenda'}

Generate brief opening remarks (2-3 sentences) that:
1. Welcome participants
2. Set expectations for the session
3. Outline what we'll accomplish

Be warm but professional.`;

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: 200,
                temperature: 0.7
            });

            return response.text || response;
        } catch (error) {
            return `Welcome to this ${type}. Let's make this session productive.`;
        }
    },

    /**
     * Process input during session (transcript, notes, etc.)
     */
    processSessionInput: async (sessionId, input) => {
        const { type, content, participantId, participantName } = input;

        // Store the input
        await new Promise((resolve) => {
            db.run(`
                INSERT INTO session_inputs (id, session_id, type, content, participant_id, participant_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [uuidv4(), sessionId, type, content, participantId, participantName], resolve);
        });

        // Analyze for action items, decisions, questions
        const analysis = await CollaborationAIService.analyzeInput(content);

        // Store extracted items
        if (analysis.actionItems.length > 0 || analysis.decisions.length > 0) {
            for (const item of analysis.actionItems) {
                await CollaborationAIService.storeExtractedItem(sessionId, 'action_item', item);
            }
            for (const decision of analysis.decisions) {
                await CollaborationAIService.storeExtractedItem(sessionId, 'decision', decision);
            }
        }

        return analysis;
    },

    /**
     * Analyze input for key elements
     */
    analyzeInput: async (content) => {
        const prompt = `Analyze this meeting/workshop input and extract key elements:

"${content}"

Return a JSON object with:
{
    "actionItems": [{"task": "...", "assignee": "...", "deadline": "..."}],
    "decisions": [{"decision": "...", "rationale": "..."}],
    "questions": ["..."],
    "keyPoints": ["..."],
    "tensions": ["..."],
    "sentiment": "positive|neutral|negative|mixed"
}

If no items found for a category, use empty array.`;

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: 500,
                temperature: 0.3
            });

            const text = response.text || response;
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            return {
                actionItems: [],
                decisions: [],
                questions: [],
                keyPoints: [],
                tensions: [],
                sentiment: 'neutral'
            };
        }
    },

    /**
     * Store extracted item
     */
    storeExtractedItem: async (sessionId, type, item) => {
        return new Promise((resolve) => {
            db.run(`
                INSERT INTO session_items (id, session_id, type, content, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                uuidv4(),
                sessionId,
                type,
                JSON.stringify(item),
                null
            ], resolve);
        });
    },

    /**
     * Get facilitation suggestion
     */
    getFacilitationSuggestion: async (sessionId, context) => {
        // Get session details
        const session = await CollaborationAIService.getSession(sessionId);
        if (!session) return null;

        // Get recent inputs
        const recentInputs = await CollaborationAIService.getRecentInputs(sessionId, 10);

        const prompt = `You are facilitating a ${session.type} session: "${session.title}"

Recent discussion:
${recentInputs.map(i => `${i.participant_name || 'Participant'}: ${i.content}`).join('\n')}

Current context: ${context || 'General discussion'}

Suggest ONE facilitation action that would help:
- Move discussion forward
- Ensure all voices are heard
- Keep focus on agenda
- Resolve any tensions

Be specific and actionable. One sentence only.`;

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: 100,
                temperature: 0.8
            });

            return {
                suggestion: response.text || response,
                sessionId,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return null;
        }
    },

    /**
     * Get session
     */
    getSession: async (sessionId) => {
        return new Promise((resolve) => {
            db.get(`SELECT * FROM collaboration_sessions WHERE id = ?`, [sessionId], (err, row) => {
                if (!row) return resolve(null);
                resolve({
                    ...row,
                    agenda: JSON.parse(row.agenda || '[]'),
                    participants: JSON.parse(row.participants || '[]')
                });
            });
        });
    },

    /**
     * Get recent inputs
     */
    getRecentInputs: async (sessionId, limit = 10) => {
        return new Promise((resolve) => {
            db.all(`
                SELECT * FROM session_inputs 
                WHERE session_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            `, [sessionId, limit], (err, rows) => {
                resolve(rows || []);
            });
        });
    },

    /**
     * Generate session summary
     */
    generateSessionSummary: async (sessionId) => {
        const session = await CollaborationAIService.getSession(sessionId);
        if (!session) return null;

        // Get all inputs and items
        const inputs = await CollaborationAIService.getRecentInputs(sessionId, 100);
        const items = await new Promise((resolve) => {
            db.all(`SELECT * FROM session_items WHERE session_id = ?`, [sessionId], (err, rows) => {
                resolve((rows || []).map(r => ({
                    ...r,
                    content: JSON.parse(r.content || '{}')
                })));
            });
        });

        const actionItems = items.filter(i => i.type === 'action_item');
        const decisions = items.filter(i => i.type === 'decision');

        const prompt = `Generate an executive summary for this ${session.type} session: "${session.title}"

Discussion topics covered:
${inputs.slice(-20).map(i => i.content).join('\n').substring(0, 2000)}

Action Items identified: ${actionItems.length}
Decisions made: ${decisions.length}

Provide:
1. Executive Summary (3-4 sentences)
2. Key Discussion Points (bullet points)
3. Next Steps
4. Open Items for follow-up`;

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: 800,
                temperature: 0.5
            });

            const summary = {
                sessionId,
                title: session.title,
                type: session.type,
                duration: session.ended_at 
                    ? (new Date(session.ended_at) - new Date(session.started_at)) / 60000 
                    : null,
                summary: response.text || response,
                actionItems: actionItems.map(i => i.content),
                decisions: decisions.map(i => i.content),
                participantCount: session.participants.length,
                generatedAt: new Date().toISOString()
            };

            // Store summary
            await new Promise((resolve) => {
                db.run(`
                    UPDATE collaboration_sessions 
                    SET summary = ?, status = 'completed', ended_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [JSON.stringify(summary), sessionId], resolve);
            });

            return summary;

        } catch (error) {
            console.error('[CollaborationAI] Error generating summary:', error);
            return null;
        }
    },

    /**
     * Brainstorm ideas
     */
    brainstormIdeas: async (sessionId, topic, existingIdeas = []) => {
        const prompt = `You are facilitating a brainstorming session on: "${topic}"

Existing ideas:
${existingIdeas.map((idea, i) => `${i + 1}. ${idea}`).join('\n') || 'None yet'}

Generate 5 creative, diverse ideas that:
1. Build on existing ideas (if any)
2. Explore different angles
3. Include at least one "wild card" unconventional idea

Format: Numbered list with brief description for each.`;

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: 500,
                temperature: 0.9 // High creativity
            });

            return {
                topic,
                newIdeas: response.text || response,
                sessionId,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return { error: true, message: error.message };
        }
    },

    /**
     * Identify and help resolve conflicts
     */
    analyzeConflict: async (sessionId, conflictDescription) => {
        const prompt = `You are helping resolve a conflict in a business meeting.

Conflict/Tension: ${conflictDescription}

Analyze this and provide:
1. Root Cause Analysis (what's really at stake)
2. Valid Points from each perspective
3. Potential Common Ground
4. Suggested Resolution Path
5. Facilitation Questions to ask

Be balanced and constructive.`;

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: 600,
                temperature: 0.6
            });

            return {
                analysis: response.text || response,
                sessionId,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return { error: true, message: error.message };
        }
    },

    /**
     * Initialize database tables
     */
    initialize: async () => {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS collaboration_sessions (
                        id TEXT PRIMARY KEY,
                        type TEXT NOT NULL,
                        title TEXT,
                        agenda TEXT,
                        participants TEXT,
                        project_id TEXT,
                        organization_id TEXT,
                        facilitation_mode TEXT,
                        status TEXT DEFAULT 'active',
                        summary TEXT,
                        started_at DATETIME,
                        ended_at DATETIME
                    )
                `);

                db.run(`
                    CREATE TABLE IF NOT EXISTS session_inputs (
                        id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        type TEXT,
                        content TEXT,
                        participant_id TEXT,
                        participant_name TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                db.run(`
                    CREATE TABLE IF NOT EXISTS session_items (
                        id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        type TEXT NOT NULL,
                        content TEXT,
                        metadata TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                db.run(`CREATE INDEX IF NOT EXISTS idx_si_session ON session_inputs(session_id)`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_items_session ON session_items(session_id)`);

                resolve();
            });
        });
    }
};

export default CollaborationAIService;
















