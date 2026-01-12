export default UserGoalsService;
declare namespace UserGoalsService {
    /**
     * Get user's selected goal
     */
    function getUserGoal(userId: any): Promise<any>;
    /**
     * Set user's goal
     */
    function setUserGoal(userId: any, goalId: any, metadata?: {}): Promise<any>;
    /**
     * Get goal history for user
     */
    function getGoalHistory(userId: any): Promise<any>;
    /**
     * Get suggested actions for a goal
     */
    function getSuggestedActions(goalId: any): any;
    /**
     * Get tour ID for goal
     */
    function getTourForGoal(goalId: any): any;
}
//# sourceMappingURL=userGoals.d.ts.map