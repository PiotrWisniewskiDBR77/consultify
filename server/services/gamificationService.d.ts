export default GamificationService;
declare namespace GamificationService {
    /**
     * Award points to a user
     */
    function awardPoints(userId: any, actionType: any, metadata?: {}): Promise<any>;
    /**
     * Get total user points
     */
    function getUserPoints(userId: any): Promise<any>;
    /**
     * Calculate level based on points
     */
    function calculateLevel(points: any): {
        level: number;
        name: string;
        minPoints: number;
    };
    /**
     * Get user gamification profile
     */
    function getUserProfile(userId: any): Promise<{
        points: any;
        level: {
            level: number;
            name: string;
            minPoints: number;
        };
        nextLevel: {
            level: number;
            name: string;
            minPoints: number;
        } | undefined;
        progress: number;
    }>;
    /**
     * Unlock achievement
     */
    function unlockAchievement(userId: any, achievementId: any, metadata?: {}): Promise<any>;
    /**
     * Get user achievements
     */
    function getUserAchievements(userId: any): Promise<any>;
}
//# sourceMappingURL=gamificationService.d.ts.map