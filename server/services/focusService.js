/**
 * Focus Service - Daily focus task management
 * Part of My Work Module PMO Upgrade
 * 
 * Features:
 * - Focus task CRUD
 * - Time block management
 * - AI-powered suggestions
 * - Max 5 tasks enforcement
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const BaseService = require('./BaseService');

const MAX_FOCUS_TASKS = 5;

const FocusService = Object.assign({}, BaseService, {
    /**
     * Get focus tasks for a specific date
     * @param {string} userId - User ID
     * @param {string} date - ISO date string (YYYY-MM-DD)
     * @returns {Promise<Object>} Focus board data
     */
    getFocus: async function(userId, date) {
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        const sql = `
            SELECT 
                ft.id,
                ft.task_id as taskId,
                ft.time_block as timeBlock,
                ft.position,
                ft.is_completed as isCompleted,
                ft.completed_at as completedAt,
                ft.due_time as dueTime,
                ft.estimated_minutes as estimatedMinutes,
                t.title,
                t.due_date as dueDate,
                t.priority,
                t.status,
                i.name as initiativeName,
                i.id as initiativeId,
                p.name as projectName
            FROM focus_tasks ft
            JOIN tasks t ON ft.task_id = t.id
            LEFT JOIN initiatives i ON t.initiative_id = i.id
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE ft.user_id = ? AND ft.date = ?
            ORDER BY ft.time_block, ft.position
        `;
        
        const tasks = await this.queryAll(sql, [userId, targetDate]);
        
        // Calculate execution score
        const completedCount = tasks.filter(t => t.isCompleted).length;
        const totalCount = tasks.length;
        const executionScore = totalCount > 0 
            ? Math.round((completedCount / totalCount) * 100)
            : 0;
        
        return {
            board: {
                date: targetDate,
                userId,
                tasks: tasks.map(t => ({
                    ...t,
                    isCompleted: !!t.isCompleted
                })),
                maxTasks: MAX_FOCUS_TASKS,
                executionScore,
                completedCount
            }
        };
    },

    /**
     * Set focus tasks for a specific date
     * @param {string} userId - User ID
     * @param {string} date - ISO date string
     * @param {Array} tasks - Array of {taskId, timeBlock, position}
     * @returns {Promise<Object>} Updated focus board
     */
    setFocus: async function(userId, date, tasks) {
        // Validate max tasks
        if (tasks.length > MAX_FOCUS_TASKS) {
            throw new Error(`Maximum ${MAX_FOCUS_TASKS} focus tasks allowed`);
        }

        // Validate unique task IDs
        const taskIds = tasks.map(t => t.taskId);
        if (new Set(taskIds).size !== taskIds.length) {
            throw new Error('Duplicate task IDs not allowed');
        }

        // Start transaction
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // Delete existing focus tasks for this date
                db.run(
                    `DELETE FROM focus_tasks WHERE user_id = ? AND date = ?`,
                    [userId, date],
                    (err) => {
                        if (err) return reject(err);
                        
                        if (tasks.length === 0) {
                            return resolve(this.getFocus(userId, date));
                        }

                        // Insert new focus tasks
                        const insertSql = `
                            INSERT INTO focus_tasks 
                            (id, user_id, task_id, date, time_block, position)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `;
                        
                        let insertCount = 0;
                        tasks.forEach((task, idx) => {
                            db.run(
                                insertSql,
                                [uuidv4(), userId, task.taskId, date, task.timeBlock, task.position ?? idx],
                                (err) => {
                                    if (err) return reject(err);
                                    insertCount++;
                                    if (insertCount === tasks.length) {
                                        this.getFocus(userId, date).then(resolve).catch(reject);
                                    }
                                }
                            );
                        });
                    }
                );
            });
        });
    },

    /**
     * Add a single task to focus
     * @param {string} userId - User ID
     * @param {string} taskId - Task ID to add
     * @param {string} date - ISO date string
     * @param {string} timeBlock - Time block (morning/afternoon/buffer)
     * @returns {Promise<Object>} Updated focus board
     */
    addToFocus: async function(userId, taskId, date, timeBlock = 'morning') {
        const current = await this.getFocus(userId, date);
        
        if (current.board.tasks.length >= MAX_FOCUS_TASKS) {
            throw new Error(`Maximum ${MAX_FOCUS_TASKS} focus tasks allowed`);
        }
        
        if (current.board.tasks.some(t => t.taskId === taskId)) {
            throw new Error('Task already in focus');
        }

        const position = current.board.tasks.filter(t => t.timeBlock === timeBlock).length;
        
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO focus_tasks (id, user_id, task_id, date, time_block, position)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [uuidv4(), userId, taskId, date, timeBlock, position],
                (err) => {
                    if (err) return reject(err);
                    this.getFocus(userId, date).then(resolve).catch(reject);
                }
            );
        });
    },

    /**
     * Remove a task from focus
     * @param {string} userId - User ID
     * @param {string} taskId - Task ID to remove
     * @param {string} date - ISO date string
     * @returns {Promise<Object>} Updated focus board
     */
    removeFromFocus: async function(userId, taskId, date) {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM focus_tasks WHERE user_id = ? AND task_id = ? AND date = ?`,
                [userId, taskId, date],
                (err) => {
                    if (err) return reject(err);
                    this.getFocus(userId, date).then(resolve).catch(reject);
                }
            );
        });
    },

    /**
     * Reorder tasks within focus board
     * @param {string} userId - User ID
     * @param {string} date - ISO date string
     * @param {number} fromIndex - Source index
     * @param {number} toIndex - Target index
     * @returns {Promise<Object>} Updated focus board
     */
    reorderFocus: async function(userId, date, fromIndex, toIndex) {
        const current = await this.getFocus(userId, date);
        const tasks = [...current.board.tasks];
        
        // Perform reorder
        const [removed] = tasks.splice(fromIndex, 1);
        tasks.splice(toIndex, 0, removed);
        
        // Update positions
        const updates = tasks.map((task, idx) => ({
            taskId: task.taskId,
            timeBlock: task.timeBlock,
            position: idx
        }));
        
        return this.setFocus(userId, date, updates);
    },

    /**
     * Mark focus task as complete/incomplete
     * @param {string} userId - User ID
     * @param {string} taskId - Task ID
     * @param {string} date - ISO date string
     * @param {boolean} completed - Completion status
     * @returns {Promise<Object>} Updated focus board
     */
    setFocusTaskComplete: async function(userId, taskId, date, completed) {
        return new Promise((resolve, reject) => {
            const completedAt = completed ? new Date().toISOString() : null;
            db.run(
                `UPDATE focus_tasks 
                 SET is_completed = ?, completed_at = ?
                 WHERE user_id = ? AND task_id = ? AND date = ?`,
                [completed ? 1 : 0, completedAt, userId, taskId, date],
                (err) => {
                    if (err) return reject(err);
                    this.getFocus(userId, date).then(resolve).catch(reject);
                }
            );
        });
    },

    /**
     * Get AI-powered focus suggestions
     * @param {string} userId - User ID
     * @param {string} projectId - Optional project filter
     * @returns {Promise<Object>} AI suggestions
     */
    getAISuggestions: async function(userId, projectId = null) {
        // Get all incomplete tasks for the user
        let sql = `
            SELECT 
                t.id,
                t.title,
                t.priority,
                t.due_date as dueDate,
                t.status,
                i.name as initiativeName,
                CASE 
                    WHEN t.priority = 'urgent' THEN 1
                    WHEN t.priority = 'high' THEN 2
                    WHEN t.due_date IS NOT NULL AND t.due_date <= date('now', '+2 days') THEN 3
                    WHEN t.priority = 'medium' THEN 4
                    ELSE 5
                END as urgency_score
            FROM tasks t
            LEFT JOIN initiatives i ON t.initiative_id = i.id
            WHERE t.assignee_id = ?
            AND t.status NOT IN ('done', 'completed', 'DONE', 'COMPLETED')
        `;
        
        const params = [userId];
        
        if (projectId) {
            sql += ` AND t.project_id = ?`;
            params.push(projectId);
        }
        
        sql += ` ORDER BY urgency_score, t.due_date ASC LIMIT 10`;
        
        const tasks = await this.queryAll(sql, params);
        
        // Check which tasks are already in today's focus
        const today = new Date().toISOString().split('T')[0];
        const focusResult = await this.getFocus(userId, today);
        const focusedTaskIds = new Set(focusResult.board.tasks.map(t => t.taskId));
        
        // Filter out already focused tasks
        const available = tasks.filter(t => !focusedTaskIds.has(t.id));
        
        // Generate suggestions with reasoning
        const suggestions = available.slice(0, 5).map((task, idx) => {
            let reason = '';
            let suggestedTimeBlock = 'morning';
            
            if (task.priority === 'urgent') {
                reason = 'Urgent priority - requires immediate attention';
                suggestedTimeBlock = 'morning';
            } else if (task.dueDate) {
                const dueDate = new Date(task.dueDate);
                const now = new Date();
                const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysUntilDue <= 0) {
                    reason = 'Overdue - needs immediate completion';
                    suggestedTimeBlock = 'morning';
                } else if (daysUntilDue <= 2) {
                    reason = `Due in ${daysUntilDue} day(s) - prioritize today`;
                    suggestedTimeBlock = idx < 2 ? 'morning' : 'afternoon';
                } else {
                    reason = 'Upcoming deadline - plan ahead';
                    suggestedTimeBlock = 'afternoon';
                }
            } else if (task.priority === 'high') {
                reason = 'High priority task';
                suggestedTimeBlock = 'morning';
            } else {
                reason = 'Standard priority';
                suggestedTimeBlock = 'buffer';
            }
            
            return {
                taskId: task.id,
                title: task.title,
                reason,
                suggestedTimeBlock,
                priority: task.priority || 'medium'
            };
        });
        
        // Generate overall reasoning
        let reasoning = 'Based on your task priorities and deadlines, ';
        const urgentCount = suggestions.filter(s => s.priority === 'urgent').length;
        const overdueCount = suggestions.filter(s => s.reason.includes('Overdue')).length;
        
        if (overdueCount > 0) {
            reasoning += `I've prioritized ${overdueCount} overdue task(s) that need immediate attention. `;
        }
        if (urgentCount > 0) {
            reasoning += `There are ${urgentCount} urgent task(s) that should be completed first. `;
        }
        reasoning += 'I recommend starting with high-impact tasks in the morning when energy is highest.';
        
        return {
            suggestions: {
                suggestedTasks: suggestions,
                reasoning,
                generatedAt: new Date().toISOString()
            }
        };
    },

    /**
     * Get execution score history
     * @param {string} userId - User ID
     * @param {number} days - Number of days to retrieve
     * @returns {Promise<Array>} Score history
     */
    getExecutionHistory: async function(userId, days = 30) {
        const sql = `
            SELECT 
                date,
                COUNT(*) as total,
                SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed
            FROM focus_tasks
            WHERE user_id = ?
            AND date >= date('now', '-' || ? || ' days')
            GROUP BY date
            ORDER BY date DESC
        `;
        
        const history = await this.queryAll(sql, [userId, days]);
        
        return history.map(h => ({
            date: h.date,
            score: h.total > 0 ? Math.round((h.completed / h.total) * 100) : 0,
            completedCount: h.completed,
            totalCount: h.total
        }));
    }
});

module.exports = FocusService;

