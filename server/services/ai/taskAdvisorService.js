/**
 * Task Advisor Service - Virtual PMO Coach
 * 
 * Provides AI-powered assistance for task management:
 * - "Break it down" - Generate subtasks from complex tasks
 * - "Unblock me" - Suggest solutions for blockers
 * - "Review my work" - Evaluate task descriptions and provide feedback
 */

import { LLMService } from './llmService.js';
import { ModelRouter } from './modelRouter.js';
import { draftService } from './draftService.js';
import { memoryManager } from './memoryManager.js';
import { aiLogger } from './logger.js';
import { getDatabase } from '../../src/database/index.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prompt templates for Task Advisor capabilities
const PROMPTS = {
    breakDown: {
        system: `You are an expert PMO Coach helping users break down complex tasks into manageable subtasks.

Your approach:
1. Analyze the task to understand its scope and complexity
2. Identify logical components or phases
3. Create actionable subtasks that can be individually tracked
4. Ensure subtasks are specific, measurable, and achievable
5. Consider dependencies between subtasks

Output format: JSON array of subtasks with title, description, estimatedHours, and any dependencies.`,

        userTemplate: `Break down this task into subtasks:

## Task Details
Title: {taskTitle}
Description: {taskDescription}
Current Status: {status}
Priority: {priority}
Due Date: {dueDate}

## Project Context
Project: {projectName}
{projectContext}

## Requirements
- Create 3-7 logical subtasks
- Each subtask should be completable in 1-8 hours
- Order by logical sequence
- Include clear acceptance criteria in descriptions

Return JSON:
{
  "subtasks": [
    {
      "title": "Subtask title",
      "description": "Clear description with acceptance criteria",
      "estimatedHours": 4,
      "dependsOn": [], // indices of prerequisite subtasks
      "priority": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "reasoning": "Brief explanation of the breakdown approach"
}`
    },

    unblock: {
        system: `You are an experienced project manager helping team members overcome blockers.

Your approach:
1. Understand the blocker's root cause
2. Consider organizational, technical, and resource constraints
3. Suggest practical, actionable solutions
4. Provide alternatives if the primary solution isn't feasible
5. Identify who might help resolve the issue

Be empathetic but solution-focused. Prioritize quick wins.`,

        userTemplate: `Help me unblock this task:

## Task Details
Title: {taskTitle}
Description: {taskDescription}
Current Status: {status}
Assigned To: {assignee}

## Blocker Information
Blocker: {blockerDescription}
Duration Blocked: {blockedDuration}
Previous Attempts: {previousAttempts}

## Context
Project: {projectName}
Team Size: {teamSize}
{additionalContext}

Provide:
1. Root cause analysis
2. Top 3 recommended actions to unblock
3. Who to involve for each action
4. Estimated time to resolve
5. Contingency plan if primary solutions fail

Return JSON:
{
  "rootCause": "Analysis of why this is blocking",
  "recommendations": [
    {
      "action": "What to do",
      "owner": "Who should do it",
      "timeEstimate": "How long",
      "impact": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "contingencyPlan": "What to do if recommendations fail",
  "escalationNeeded": true | false,
  "reasoning": "Brief explanation of the approach"
}`
    },

    review: {
        system: `You are a senior PMO reviewing task descriptions for clarity, completeness, and actionability.

Evaluate based on:
1. Clarity - Is the task clearly defined?
2. Completeness - Does it have all necessary information?
3. Actionability - Can someone act on this immediately?
4. Measurability - Is success clearly defined?
5. Context - Is there enough background?

Be constructive and specific. Suggest improvements.`,

        userTemplate: `Review this task description:

## Task
Title: {taskTitle}
Description: {taskDescription}
Priority: {priority}
Due Date: {dueDate}
Assigned To: {assignee}

## Project Context
Project: {projectName}
Initiative: {initiativeName}

Rate and provide feedback on:
1. Title quality (clear, specific?)
2. Description completeness
3. Acceptance criteria clarity
4. Effort estimation accuracy
5. Overall actionability

Return JSON:
{
  "scores": {
    "titleQuality": 1-5,
    "descriptionCompleteness": 1-5,
    "acceptanceCriteria": 1-5,
    "effortEstimation": 1-5,
    "actionability": 1-5
  },
  "overallScore": 1-5,
  "strengths": ["What's good"],
  "improvements": [
    {
      "area": "What to improve",
      "suggestion": "How to improve it",
      "priority": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "suggestedTitle": "Improved title if needed",
  "suggestedDescription": "Improved description if needed"
}`
    }
};

class TaskAdvisorService {
    constructor() {
        this.llmService = new LLMService();
        this.modelRouter = new ModelRouter();
    }

    /**
     * Break down a complex task into subtasks
     * @param {Object} task - Task data
     * @param {Object} context - Additional context
     */
    async breakDown(task, context = {}) {
        const { projectId, userId, organizationId, projectName, projectContext } = context;

        aiLogger.info('TaskAdvisor', `Breaking down task: ${task.title}`);

        try {
            // Get model for task advisor
            const modelConfig = await this.modelRouter.getProviderConfig('gpt-4o-mini', 'STANDARD');

            // Build prompt
            const userPrompt = this._buildPrompt(PROMPTS.breakDown.userTemplate, {
                taskTitle: task.title || 'Untitled',
                taskDescription: task.description || 'No description',
                status: task.status || 'TODO',
                priority: task.priority || 'MEDIUM',
                dueDate: task.due_date || 'Not set',
                projectName: projectName || 'Unknown',
                projectContext: projectContext || ''
            });

            // Call LLM
            const response = await this.llmService.call({
                type: 'chat',
                modelConfig,
                systemPrompt: PROMPTS.breakDown.system,
                messages: [{ role: 'user', content: userPrompt }],
                stream: false
            });

            // Parse response
            const result = this._parseJSONResponse(response.content);

            // Create draft for review
            if (result.subtasks && result.subtasks.length > 0) {
                await draftService.createDraft({
                    organizationId,
                    projectId,
                    userId,
                    draftType: 'TASK_BREAKDOWN',
                    targetEntityType: 'task',
                    targetEntityId: task.id,
                    suggestedContent: result,
                    confidence: 0.85,
                    reasoning: result.reasoning,
                    modelUsed: modelConfig.id,
                    tokensUsed: response.usage?.totalTokens
                });
            }

            // Record to memory
            if (projectId) {
                await memoryManager.projectStore.addMemory(projectId, {
                    type: 'AI_RECOMMENDATION',
                    title: `Task breakdown: ${task.title}`,
                    content: {
                        taskId: task.id,
                        subtaskCount: result.subtasks?.length || 0,
                        capability: 'task_breakdown'
                    },
                    recordedBy: userId
                });
            }

            return {
                success: true,
                subtasks: result.subtasks || [],
                reasoning: result.reasoning,
                draftCreated: true
            };

        } catch (error) {
            aiLogger.error('TaskAdvisor', `breakDown error: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Suggest solutions to unblock a task
     * @param {Object} task - Task data
     * @param {Object} blockerInfo - Information about the blocker
     * @param {Object} context - Additional context
     */
    async unblock(task, blockerInfo, context = {}) {
        const { projectId, userId, organizationId, projectName, teamSize } = context;

        aiLogger.info('TaskAdvisor', `Unblocking task: ${task.title}`);

        try {
            const modelConfig = await this.modelRouter.getProviderConfig('gpt-4o-mini', 'STANDARD');

            const userPrompt = this._buildPrompt(PROMPTS.unblock.userTemplate, {
                taskTitle: task.title || 'Untitled',
                taskDescription: task.description || 'No description',
                status: task.status || 'BLOCKED',
                assignee: task.assignee_name || 'Unassigned',
                blockerDescription: blockerInfo.description || 'Unknown blocker',
                blockedDuration: blockerInfo.duration || 'Unknown',
                previousAttempts: blockerInfo.previousAttempts || 'None documented',
                projectName: projectName || 'Unknown',
                teamSize: teamSize || 'Unknown',
                additionalContext: blockerInfo.additionalContext || ''
            });

            const response = await this.llmService.call({
                type: 'chat',
                modelConfig,
                systemPrompt: PROMPTS.unblock.system,
                messages: [{ role: 'user', content: userPrompt }],
                stream: false
            });

            const result = this._parseJSONResponse(response.content);

            // Create recommendation draft
            if (result.recommendations && result.recommendations.length > 0) {
                await draftService.createDraft({
                    organizationId,
                    projectId,
                    userId,
                    draftType: 'RECOMMENDATION',
                    targetEntityType: 'task',
                    targetEntityId: task.id,
                    suggestedContent: result,
                    confidence: 0.8,
                    reasoning: result.reasoning,
                    modelUsed: modelConfig.id,
                    tokensUsed: response.usage?.totalTokens
                });
            }

            // Record to memory
            if (projectId) {
                await memoryManager.projectStore.addMemory(projectId, {
                    type: 'BLOCKER',
                    title: `Blocker resolved: ${task.title}`,
                    content: {
                        taskId: task.id,
                        blocker: blockerInfo.description,
                        resolution: result.recommendations?.[0]?.action,
                        escalationNeeded: result.escalationNeeded
                    },
                    importance: 4,
                    recordedBy: userId
                });
            }

            return {
                success: true,
                rootCause: result.rootCause,
                recommendations: result.recommendations || [],
                contingencyPlan: result.contingencyPlan,
                escalationNeeded: result.escalationNeeded,
                reasoning: result.reasoning
            };

        } catch (error) {
            aiLogger.error('TaskAdvisor', `unblock error: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Review a task description and provide feedback
     * @param {Object} task - Task data
     * @param {Object} context - Additional context
     */
    async review(task, context = {}) {
        const { projectId, userId, organizationId, projectName, initiativeName } = context;

        aiLogger.info('TaskAdvisor', `Reviewing task: ${task.title}`);

        try {
            const modelConfig = await this.modelRouter.getProviderConfig('gpt-4o-mini', 'BUDGET');

            const userPrompt = this._buildPrompt(PROMPTS.review.userTemplate, {
                taskTitle: task.title || 'Untitled',
                taskDescription: task.description || 'No description',
                priority: task.priority || 'MEDIUM',
                dueDate: task.due_date || 'Not set',
                assignee: task.assignee_name || 'Unassigned',
                projectName: projectName || 'Unknown',
                initiativeName: initiativeName || 'Unknown'
            });

            const response = await this.llmService.call({
                type: 'chat',
                modelConfig,
                systemPrompt: PROMPTS.review.system,
                messages: [{ role: 'user', content: userPrompt }],
                stream: false
            });

            const result = this._parseJSONResponse(response.content);

            // Create improvement draft if suggestions available
            if (result.suggestedTitle || result.suggestedDescription) {
                await draftService.createDraft({
                    organizationId,
                    projectId,
                    userId,
                    draftType: 'FIELD_SUGGESTION',
                    targetEntityType: 'task',
                    targetEntityId: task.id,
                    originalContent: {
                        title: task.title,
                        description: task.description
                    },
                    suggestedContent: {
                        title: result.suggestedTitle || task.title,
                        description: result.suggestedDescription || task.description
                    },
                    confidence: result.overallScore / 5,
                    reasoning: `Review score: ${result.overallScore}/5`,
                    modelUsed: modelConfig.id,
                    tokensUsed: response.usage?.totalTokens
                });
            }

            return {
                success: true,
                scores: result.scores,
                overallScore: result.overallScore,
                strengths: result.strengths || [],
                improvements: result.improvements || [],
                suggestedTitle: result.suggestedTitle,
                suggestedDescription: result.suggestedDescription
            };

        } catch (error) {
            aiLogger.error('TaskAdvisor', `review error: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get task from database
     * @param {string} taskId - Task ID
     */
    async getTask(taskId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT t.*, u.full_name as assignee_name, p.name as project_name
                 FROM tasks t
                 LEFT JOIN users u ON t.assignee_id = u.id
                 LEFT JOIN projects p ON t.project_id = p.id
                 WHERE t.id = ?`,
                [taskId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    /**
     * Build prompt from template
     * @private
     */
    _buildPrompt(template, data) {
        let prompt = template;
        for (const [key, value] of Object.entries(data)) {
            prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value || '');
        }
        return prompt;
    }

    /**
     * Parse JSON from LLM response
     * @private
     */
    _parseJSONResponse(content) {
        try {
            // Try to find JSON in the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return { error: 'No JSON found in response', rawContent: content };
        } catch (error) {
            return { error: 'Failed to parse JSON', rawContent: content };
        }
    }
}

// Singleton instance
const taskAdvisorService = new TaskAdvisorService();

export { TaskAdvisorService };
export default taskAdvisorService;








