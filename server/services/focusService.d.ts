export default FocusService;
declare const FocusService: typeof BaseService & {
    /**
     * Get focus tasks for a specific date
     * @param {string} userId - User ID
     * @param {string} date - ISO date string (YYYY-MM-DD)
     * @returns {Promise<Object>} Focus board data
     */
    getFocus: (userId: string, date: string) => Promise<Object>;
    /**
     * Set focus tasks for a specific date
     * @param {string} userId - User ID
     * @param {string} date - ISO date string
     * @param {Array} tasks - Array of {taskId, timeBlock, position}
     * @returns {Promise<Object>} Updated focus board
     */
    setFocus: (userId: string, date: string, tasks: any[]) => Promise<Object>;
    /**
     * Add a single task to focus
     * @param {string} userId - User ID
     * @param {string} taskId - Task ID to add
     * @param {string} date - ISO date string
     * @param {string} timeBlock - Time block (morning/afternoon/buffer)
     * @returns {Promise<Object>} Updated focus board
     */
    addToFocus: (userId: string, taskId: string, date: string, timeBlock?: string) => Promise<Object>;
    /**
     * Remove a task from focus
     * @param {string} userId - User ID
     * @param {string} taskId - Task ID to remove
     * @param {string} date - ISO date string
     * @returns {Promise<Object>} Updated focus board
     */
    removeFromFocus: (userId: string, taskId: string, date: string) => Promise<Object>;
    /**
     * Reorder tasks within focus board
     * @param {string} userId - User ID
     * @param {string} date - ISO date string
     * @param {number} fromIndex - Source index
     * @param {number} toIndex - Target index
     * @returns {Promise<Object>} Updated focus board
     */
    reorderFocus: (userId: string, date: string, fromIndex: number, toIndex: number) => Promise<Object>;
    /**
     * Mark focus task as complete/incomplete
     * @param {string} userId - User ID
     * @param {string} taskId - Task ID
     * @param {string} date - ISO date string
     * @param {boolean} completed - Completion status
     * @returns {Promise<Object>} Updated focus board
     */
    setFocusTaskComplete: (userId: string, taskId: string, date: string, completed: boolean) => Promise<Object>;
    /**
     * Get AI-powered focus suggestions
     * @param {string} userId - User ID
     * @param {string} projectId - Optional project filter
     * @returns {Promise<Object>} AI suggestions
     */
    getAISuggestions: (userId: string, projectId?: string) => Promise<Object>;
    /**
     * Get execution score history
     * @param {string} userId - User ID
     * @param {number} days - Number of days to retrieve
     * @returns {Promise<Array>} Score history
     */
    getExecutionHistory: (userId: string, days?: number) => Promise<any[]>;
};
import BaseService from './BaseService.js';
//# sourceMappingURL=focusService.d.ts.map