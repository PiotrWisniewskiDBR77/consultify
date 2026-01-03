/**
 * Magic Wand Service
 * AI-powered form field suggestions using structured outputs
 */

const { AIPipeline } = require('./aiPipeline');
const { z } = require('zod');

// Zod schema for Magic Wand suggestions
const MagicWandSuggestionSchema = z.object({
    suggestion: z.string().describe('The suggested content for the field'),
    reasoning: z.string().describe('Brief explanation of why this suggestion is appropriate'),
    confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('Confidence level of the suggestion'),
    alternatives: z.array(z.string()).optional().describe('Alternative suggestions if applicable')
});

class MagicWandService {
    constructor() {
        this.pipeline = new AIPipeline();
    }

    /**
     * Generate a suggestion for a form field
     * @param {Object} params
     * @param {string} params.fieldName - Name of the field to fill
     * @param {string} params.fieldContext - Context about what the field is for
     * @param {Object} params.screenContext - Current screen data (AI Eyes)
     * @param {Object} params.projectData - Project details from MCP tool
     * @param {string} params.userId - User ID
     * @param {string} params.organizationId - Organization ID
     * @param {string} params.projectId - Project ID
     */
    async suggest(params) {
        const {
            fieldName,
            fieldContext,
            screenContext,
            projectData,
            userId,
            organizationId,
            projectId
        } = params;

        // Build the prompt
        const prompt = this.buildPrompt(fieldName, fieldContext, projectData);

        try {
            const response = await this.pipeline.process({
                type: 'structured',
                capability: 'magic_wand',
                schema: MagicWandSuggestionSchema,
                prompt,
                screenContext,
                userId,
                organizationId,
                projectId,
                enableTools: false // Don't need tools for structured output
            });

            return {
                success: true,
                data: response.object || response.content,
                metadata: response.metadata
            };

        } catch (error) {
            console.error('[MagicWand] Error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    buildPrompt(fieldName, fieldContext, projectData) {
        let prompt = `Generate a professional, contextually appropriate suggestion for the following form field.

## Field Information
- **Field Name**: ${fieldName}
- **Purpose**: ${fieldContext || 'General input field'}

`;

        if (projectData) {
            prompt += `## Project Context
- **Project Name**: ${projectData.name || 'Unknown'}
- **Status**: ${projectData.status || 'Active'}
- **Description**: ${projectData.description || 'N/A'}

`;
        }

        prompt += `## Requirements
1. The suggestion should be professional and business-appropriate
2. It should be specific to the project context if available
3. Use clear, concise language
4. Provide a brief reasoning for your suggestion
5. Rate your confidence level

Generate the suggestion:`;

        return prompt;
    }

    /**
     * Generate multiple suggestions for batch filling (sequential)
     */
    async batchSuggest(fields, context) {
        const results = [];

        for (const field of fields) {
            const result = await this.suggest({
                ...field,
                ...context
            });
            results.push({
                fieldName: field.fieldName,
                ...result
            });
        }

        return results;
    }

    /**
     * Enhanced: Generate multiple suggestions in parallel
     * @param {Array} fields - Array of field definitions
     * @param {Object} context - Shared context for all fields
     * @param {Object} options - Options for parallel execution
     */
    async suggestMultipleFields(fields, context, options = {}) {
        const { maxConcurrent = 3, includeAlternatives = true } = options;

        console.log(`[MagicWand] Generating ${fields.length} suggestions in parallel (max ${maxConcurrent})`);

        // Process in batches to avoid overloading
        const results = [];
        for (let i = 0; i < fields.length; i += maxConcurrent) {
            const batch = fields.slice(i, i + maxConcurrent);
            
            const batchPromises = batch.map(field => 
                this.suggest({
                    fieldName: field.fieldName || field.name,
                    fieldContext: field.context || field.description,
                    ...context
                }).then(result => ({
                    fieldName: field.fieldName || field.name,
                    fieldId: field.id,
                    ...result
                })).catch(error => ({
                    fieldName: field.fieldName || field.name,
                    fieldId: field.id,
                    success: false,
                    error: error.message
                }))
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        // Calculate overall statistics
        const successful = results.filter(r => r.success);
        const highConfidence = successful.filter(r => r.data?.confidence === 'HIGH');
        const mediumConfidence = successful.filter(r => r.data?.confidence === 'MEDIUM');

        return {
            success: true,
            suggestions: results,
            stats: {
                total: fields.length,
                successful: successful.length,
                failed: results.length - successful.length,
                highConfidence: highConfidence.length,
                mediumConfidence: mediumConfidence.length,
                lowConfidence: successful.length - highConfidence.length - mediumConfidence.length
            }
        };
    }

    /**
     * Regenerate a suggestion with different parameters
     * @param {Object} params - Same as suggest() plus regeneration options
     * @param {Object} previousSuggestion - The previous suggestion to improve upon
     */
    async regenerate(params, previousSuggestion) {
        const enhancedPrompt = `${this.buildPrompt(params.fieldName, params.fieldContext, params.projectData)}

## Previous Attempt
The previous suggestion was: "${previousSuggestion?.suggestion || 'None'}"
Reason for regeneration: User requested a different option

Please provide a DIFFERENT, alternative suggestion that:
1. Takes a different angle or approach
2. May be more creative or more conservative than before
3. Still fits the context appropriately

Generate a new suggestion:`;

        try {
            const response = await this.pipeline.process({
                type: 'structured',
                capability: 'magic_wand',
                schema: MagicWandSuggestionSchema,
                prompt: enhancedPrompt,
                screenContext: params.screenContext,
                userId: params.userId,
                organizationId: params.organizationId,
                projectId: params.projectId,
                enableTools: false
            });

            return {
                success: true,
                data: response.object || response.content,
                metadata: {
                    ...response.metadata,
                    isRegeneration: true,
                    regenerationCount: (previousSuggestion?.regenerationCount || 0) + 1
                }
            };

        } catch (error) {
            console.error('[MagicWand] Regeneration error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get suggestion with confidence score
     * Returns normalized confidence (0-1 scale)
     */
    async suggestWithConfidence(params) {
        const result = await this.suggest(params);
        
        if (!result.success) return result;

        // Convert confidence enum to numeric
        const confidenceMap = {
            'HIGH': 0.9,
            'MEDIUM': 0.7,
            'LOW': 0.5
        };

        const numericConfidence = confidenceMap[result.data?.confidence] || 0.5;

        return {
            ...result,
            data: {
                ...result.data,
                confidenceScore: numericConfidence,
                confidenceLabel: result.data?.confidence || 'MEDIUM'
            }
        };
    }

    /**
     * Suggest for assessment justification fields
     * Specialized for DRD assessment context
     */
    async suggestJustification(params) {
        const { axisId, axisName, currentScore, assessmentContext, ...baseParams } = params;

        const justificationPrompt = `Generate a professional justification for a DRD assessment score.

## Assessment Context
- **Axis**: ${axisName || axisId}
- **Current Score**: ${currentScore}/5
- **Organization**: ${assessmentContext?.organizationName || 'Unknown'}
- **Industry**: ${assessmentContext?.industry || 'Unknown'}

## Requirements
The justification should:
1. Explain why this score is appropriate
2. Reference specific capabilities or gaps observed
3. Be factual and evidence-based
4. Be 2-4 sentences long
5. Use professional business language

Generate the justification:`;

        return this.suggest({
            ...baseParams,
            fieldName: `${axisName || axisId} Justification`,
            fieldContext: justificationPrompt
        });
    }
}

// Singleton
const magicWandService = new MagicWandService();

export default { MagicWandService, magicWandService, MagicWandSuggestionSchema };
