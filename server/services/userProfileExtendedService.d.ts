export default UserProfileExtendedService;
declare class UserProfileExtendedService {
    /**
     * Get extended profile for a user
     * Creates default profile if doesn't exist
     */
    static getExtendedProfile(userId: any): Promise<any>;
    /**
     * Create default extended profile
     */
    static createDefaultProfile(userId: any): Promise<any>;
    /**
     * Update extended profile
     */
    static updateExtendedProfile(userId: any, updates: any): Promise<any>;
    /**
     * Get bio section only
     */
    static getBio(userId: any): Promise<any>;
    /**
     * Update bio section
     */
    static updateBio(userId: any, bio: any): Promise<any>;
    /**
     * Get professional details
     */
    static getProfessionalDetails(userId: any): Promise<any>;
    /**
     * Update professional details
     */
    static updateProfessionalDetails(userId: any, details: any): Promise<any>;
    /**
     * Get social links
     */
    static getSocialLinks(userId: any): Promise<any>;
    /**
     * Update social links
     */
    static updateSocialLinks(userId: any, links: any): Promise<any>;
    /**
     * Get contact information
     */
    static getContactInfo(userId: any): Promise<any>;
    /**
     * Update contact information
     */
    static updateContactInfo(userId: any, contact: any): Promise<any>;
    /**
     * Get visibility settings
     */
    static getVisibility(userId: any): Promise<any>;
    /**
     * Update visibility settings
     */
    static updateVisibility(userId: any, visibility: any): Promise<any>;
    /**
     * Get email preferences
     */
    static getEmailPreferences(userId: any): Promise<any>;
    /**
     * Update email preferences
     */
    static updateEmailPreferences(userId: any, prefs: any): Promise<any>;
    /**
     * Set out of office
     */
    static setOutOfOffice(userId: any, settings: any): Promise<any>;
    /**
     * Calculate profile completion score
     */
    static calculateProfileCompletion(userId: any): Promise<any>;
    /**
     * Get profile completion
     */
    static getProfileCompletion(userId: any): Promise<any>;
    /**
     * Get user skills
     */
    static getSkills(userId: any): Promise<any>;
    /**
     * Add a skill
     */
    static addSkill(userId: any, skill: any): Promise<any>;
    /**
     * Remove a skill
     */
    static removeSkill(userId: any, skillId: any): Promise<any>;
    static safeJsonParse(str: any, defaultValue?: null): any;
    static camelToSnake(str: any): any;
    static parseProfileRow(row: any): {
        userId: any;
        shortBio: any;
        longBio: any;
        skills: any;
        certifications: any;
        yearsExperience: any;
        education: any;
        department: any;
        managerId: any;
        employeeId: any;
        hireDate: any;
        contractType: any;
        workingHours: {
            start: any;
            end: any;
        };
        workDays: any;
        socialLinks: {
            twitter: any;
            github: any;
            website: any;
            portfolio: any;
            custom: any;
        };
        contactInfo: {
            workPhone: any;
            mobilePhone: any;
            officeAddress: any;
            officeBuilding: any;
            officeFloor: any;
            officeDesk: any;
            skype: any;
            teams: any;
            slack: any;
            discord: any;
            zoomLink: any;
        };
        visibility: {
            profile: any;
            showEmail: boolean;
            showPhone: boolean;
            showActivityStatus: boolean;
            showLastSeen: boolean;
            showInDirectory: boolean;
            allowMentionsFrom: any;
            allowDirectMessagesFrom: any;
        };
        emailPreferences: {
            signature: any;
            signatureHtml: any;
            aliases: any;
            forwarding: any;
            outOfOffice: {
                enabled: boolean;
                message: any;
                start: any;
                end: any;
                autoReply: boolean;
            };
            digestFrequency: any;
        };
        profileCompletion: {
            score: any;
            details: any;
        };
        createdAt: any;
        updatedAt: any;
    } | null;
}
//# sourceMappingURL=userProfileExtendedService.d.ts.map