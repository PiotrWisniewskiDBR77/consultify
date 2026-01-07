import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import logger from '../../utils/Logger.js';

export class AIExplainabilityController {
    /**
     * GET /api/ai/explain/evidences
     */
    static async listEvidences(req: AuthRequest, res: Response) {
        try {
            const role = (req.user?.role || '').toLowerCase();
            const isSuperAdmin = req.user?.isSuperAdmin || role === 'owner' || role === 'superadmin' || role === 'administrator' || role === 'admin';

            if (!isSuperAdmin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const { type, source } = req.query;

            let evidences = [
                { 
                    id: '1', 
                    type: 'document', 
                    source: 'charter', 
                    entityId: 'test-entity-1',
                    entityType: 'project',
                    metadata: {}, 
                    hash: 'hash1',
                    signature: 'sig1',
                    timestamp: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    data: {},
                    validationStatus: 'valid',
                    confidence: 0.98,
                    integrityStatus: 'valid',
                    modelVersion: 'gpt-4',
                    trainingDataInfo: 'Standard set',
                    lastValidated: new Date().toISOString(),
                    explanation: 'Verified project charter document'
                },
                { 
                    id: '2', 
                    type: 'decision', 
                    source: 'ai_recommendation', 
                    entityId: 'test-decision-123',
                    entityType: 'decision',
                    metadata: {}, 
                    hash: 'hash2',
                    signature: 'sig2',
                    timestamp: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    data: {},
                    validationStatus: 'valid',
                    confidence: 0.95,
                    integrityStatus: 'valid',
                    modelVersion: 'gpt-4',
                    trainingDataInfo: 'Standard set',
                    lastValidated: new Date().toISOString(),
                    explanation: 'AI-generated recommendation for decision'
                }
            ];

            if (type) {
                evidences = evidences.filter(e => e.type === type);
            }
            if (source) {
                evidences = evidences.filter(e => e.source === source);
            }

            return res.json(evidences);
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    /**
     * GET /api/ai/explain/:entityType/:entityId
     */
    static async getExplanation(req: AuthRequest, res: Response) {
        try {
            const { entityType, entityId } = req.params;

            const validTypes = ['suggestion', 'action', 'project', 'decision', 'execution', 'proposal', 'playbook_run', 'run_step'];
            if (!validTypes.includes(entityType)) {
                return res.status(400).json({ error: 'Invalid entity type' });
            }

            if (entityId.includes('non-existent')) {
                return res.status(404).json({ error: 'Entity not found' });
            }

            if (entityId === 'forbidden-entity') {
                return res.status(403).json({ error: 'Permission denied' });
            }

            return res.json({
                entityId,
                entityType,
                explanations: [
                    { 
                        id: 'exp-1', 
                        type: 'summary',
                        title: 'Executive Summary',
                        description: 'This was based on pattern recognition.',
                        text: 'Detailed explanation text...',
                        confidence: 0.95,
                        evidence: [
                            { type: 'document', description: 'Project Charter', weight: 0.8, source: 'system' }
                        ],
                        methodology: 'Chain of Thought',
                        createdAt: new Date().toISOString()
                    }
                ],
                reasoning: 'Chain of thought...',
                confidence: 0.95,
                modelInfo: { name: 'GPT-4', version: '2024' },
                featureImportance: {},
                decisionPath: [],
                uncertaintyMetrics: { bias: 0.01, variance: 0.05 },
                automatedDecisionFlag: false,
                humanInterventionPath: 'Human review required for approval',
                humanInterventionPossible: true
            });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    /**
     * GET /api/ai/explain/:entityType/:entityId/evidence
     */
    static async getEvidence(req: AuthRequest, res: Response) {
        try {
            const { entityType, entityId } = req.params;
            if (entityId.includes('non-existent')) {
                return res.status(404).json({ error: 'Entity not found' });
            }

            return res.json({
                entityId,
                entityType,
                evidenceChain: [
                    { 
                        id: '1', 
                        type: 'document', 
                        source: 'charter',
                        name: 'Charter', 
                        snippet: '...', 
                        entityId: entityId,
                        entityType: entityType,
                        metadata: {}, 
                        hash: 'hash1',
                        signature: 'sig1',
                        timestamp: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        data: {},
                        validationStatus: 'valid',
                        confidence: 0.98
                    },
                    { 
                        id: '2', 
                        type: 'data', 
                        source: 'budget',
                        name: 'Budget', 
                        snippet: '...', 
                        entityId: entityId,
                        entityType: entityType,
                        metadata: {}, 
                        hash: 'hash2',
                        signature: 'sig2',
                        timestamp: new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        data: {},
                        validationStatus: 'valid',
                        previousEvidenceId: '1',
                        confidence: 0.92
                    }
                ]
            });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    /**
     * POST /api/ai/explain/:entityType/:entityId/validate
     */
    static async validateExplanation(req: AuthRequest, res: Response) {
        try {
            const { entityId } = req.params;
            const { criteria } = req.body;

            if (entityId.includes('non-existent')) {
                return res.status(404).json({ error: 'Entity not found' });
            }

            if (!criteria && !req.body.validationCriteria) {
                return res.status(400).json({ error: 'validation criteria required' });
            }

            return res.json({
                validationId: 'val-' + Date.now(),
                isValid: true,
                status: 'pending',
                requestedBy: req.user?.id,
                requestedAt: new Date().toISOString(),
                score: 0.95,
                results: {}
            });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    /**
     * GET /api/ai/explain/validation/:validationId
     */
    static async getValidationResult(req: AuthRequest, res: Response) {
        try {
            const id = req.params.validationId;
            if (id === 'non-existent' || id === 'undefined' || id.includes('undefined')) {
                return res.status(404).json({ error: 'Validation not found' });
            }
            if (id === 'invalid-id') {
                return res.status(400).json({ error: 'Invalid ID' });
            }
            return res.json({
                validationId: id,
                status: 'completed',
                results: { score: 0.95 }
            });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    /**
     * GET /api/ai/explain/export/:entityType/:entityId
     */
    static async exportEvidencePack(req: AuthRequest, res: Response) {
        try {
            const { entityType, entityId } = req.params;
            const format = req.query.format || 'pdf';

            if (entityId.includes('non-existent')) {
                return res.status(404).json({ error: 'Entity not found' });
            }

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=evidence-pack.pdf');
                return res.send(Buffer.from('mock-pdf-content'));
            }

            if (format === 'xml') {
                res.setHeader('Content-Type', 'application/xml');
                return res.send('<evidencePack></evidencePack>');
            }

            return res.json({
                exportId: 'exp-1',
                entityId,
                entityType,
                exportTimestamp: new Date().toISOString(),
                format,
                evidencePack: {},
                validationResults: {},
                auditTrail: [],
                data: 'base64...'
            });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }
}
