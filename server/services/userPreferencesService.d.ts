export default UserPreferencesService;
declare namespace UserPreferencesService {
    /**
     * Get all preferences for user
     * @param {string} userId
     */
    function getPreferences(userId: string): Promise<{
        timezone: any;
        locale: any;
        dateFormat: any;
        timeFormat: any;
        firstDayOfWeek: any;
        accessibility: any;
        notifications: any;
        ui: any;
    }>;
    /**
     * Update preferences
     * @param {string} userId
     * @param {Object} updates
     */
    function updatePreferences(userId: string, updates: Object): Promise<{
        success: boolean;
        message: string;
    } | {
        success: boolean;
        message?: undefined;
    }>;
    /**
     * Get timezone options
     */
    function getTimezoneOptions(): {
        value: string;
        label: string;
    }[];
    /**
     * Get locale options
     */
    function getLocaleOptions(): {
        value: string;
        label: string;
    }[];
    /**
     * Format date according to user preferences
     * @param {string|Date} date
     * @param {string} userId
     */
    function formatDate(date: string | Date, userId: string): Promise<any>;
    /**
     * Format time according to user preferences
     * @param {string|Date} time
     * @param {string} userId
     */
    function formatTime(time: string | Date, userId: string): Promise<string>;
}
//# sourceMappingURL=userPreferencesService.d.ts.map