/**
 * UserProfileExtendedService
 * 
 * Service layer for extended user profile operations
 * Handles bio, professional details, social links, visibility, and email preferences
 */

import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';



class UserProfileExtendedService {
    /**
     * Get extended profile for a user
     * Creates default profile if doesn't exist
     */
    static async getExtendedProfile(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM user_profile_extended WHERE user_id = ?',
                [userId],
                async (err, row) => {
                    if (err) return reject(err);
                    
                    if (!row) {
                        // Create default profile
                        try {
                            await this.createDefaultProfile(userId);
                            const newRow = await this.getExtendedProfile(userId);
                            return resolve(newRow);
                        } catch (createErr) {
                            return reject(createErr);
                        }
                    }
                    
                    // Parse JSON fields
                    resolve(this.parseProfileRow(row));
                }
            );
        });
    }

    /**
     * Create default extended profile
     */
    static async createDefaultProfile(userId) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_profile_extended (user_id) VALUES (?)`,
                [userId],
                (err) => {
                    if (err) return reject(err);
                    resolve({ success: true });
                }
            );
        });
    }

    /**
     * Update extended profile
     */
    static async updateExtendedProfile(userId, updates) {
        // Build dynamic update query
        const allowedFields = [
            'short_bio', 'long_bio', 'skills', 'certifications', 'years_experience',
            'education', 'department', 'manager_id', 'employee_id', 'hire_date',
            'contract_type', 'working_hours_start', 'working_hours_end', 'work_days',
            'twitter_handle', 'github_username', 'website_url', 'portfolio_url',
            'custom_links', 'work_phone', 'mobile_phone', 'office_address',
            'office_building', 'office_floor', 'office_desk', 'skype_username',
            'teams_username', 'slack_username', 'discord_username', 'zoom_personal_link',
            'profile_visibility', 'show_email_publicly', 'show_phone_publicly',
            'show_activity_status', 'show_last_seen', 'show_in_directory',
            'allow_mentions_from', 'allow_direct_messages_from', 'email_signature',
            'email_signature_html', 'email_aliases', 'email_forwarding',
            'out_of_office_enabled', 'out_of_office_message', 'out_of_office_start',
            'out_of_office_end', 'out_of_office_auto_reply', 'email_digest_frequency'
        ];

        const setClause = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            const dbKey = this.camelToSnake(key);
            if (allowedFields.includes(dbKey)) {
                setClause.push(`${dbKey} = ?`);
                // Stringify JSON fields
                if (typeof value === 'object' && value !== null) {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }
        }

        if (setClause.length === 0) {
            return { success: true, message: 'No valid fields to update' };
        }

        setClause.push('updated_at = datetime("now")');
        values.push(userId);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE user_profile_extended SET ${setClause.join(', ')} WHERE user_id = ?`,
                values,
                async function(err) {
                    if (err) return reject(err);
                    
                    if (this.changes === 0) {
                        // Profile doesn't exist, create it first
                        try {
                            await UserProfileExtendedService.createDefaultProfile(userId);
                            const result = await UserProfileExtendedService.updateExtendedProfile(userId, updates);
                            return resolve(result);
                        } catch (createErr) {
                            return reject(createErr);
                        }
                    }
                    
                    // Recalculate profile completion
                    try {
                        await UserProfileExtendedService.calculateProfileCompletion(userId);
                    } catch (e) {
                        console.warn('Failed to calculate profile completion:', e);
                    }
                    
                    resolve({ success: true, updated: this.changes });
                }
            );
        });
    }

    /**
     * Get bio section only
     */
    static async getBio(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT short_bio, long_bio, skills, certifications, years_experience FROM user_profile_extended WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve({});
                    
                    resolve({
                        shortBio: row.short_bio,
                        longBio: row.long_bio,
                        skills: this.safeJsonParse(row.skills, []),
                        certifications: this.safeJsonParse(row.certifications, []),
                        yearsExperience: row.years_experience
                    });
                }
            );
        });
    }

    /**
     * Update bio section
     */
    static async updateBio(userId, bio) {
        const updates = {};
        if (bio.shortBio !== undefined) updates.short_bio = bio.shortBio;
        if (bio.longBio !== undefined) updates.long_bio = bio.longBio;
        if (bio.skills !== undefined) updates.skills = bio.skills;
        if (bio.certifications !== undefined) updates.certifications = bio.certifications;
        if (bio.yearsExperience !== undefined) updates.years_experience = bio.yearsExperience;
        
        return this.updateExtendedProfile(userId, updates);
    }

    /**
     * Get professional details
     */
    static async getProfessionalDetails(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT department, manager_id, employee_id, hire_date, contract_type,
                        working_hours_start, working_hours_end, work_days
                 FROM user_profile_extended WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve({});
                    
                    resolve({
                        department: row.department,
                        managerId: row.manager_id,
                        employeeId: row.employee_id,
                        hireDate: row.hire_date,
                        contractType: row.contract_type,
                        workingHours: {
                            start: row.working_hours_start || '09:00',
                            end: row.working_hours_end || '17:00'
                        },
                        workDays: this.safeJsonParse(row.work_days, [1, 2, 3, 4, 5])
                    });
                }
            );
        });
    }

    /**
     * Update professional details
     */
    static async updateProfessionalDetails(userId, details) {
        const updates = {};
        if (details.department !== undefined) updates.department = details.department;
        if (details.managerId !== undefined) updates.manager_id = details.managerId;
        if (details.employeeId !== undefined) updates.employee_id = details.employeeId;
        if (details.hireDate !== undefined) updates.hire_date = details.hireDate;
        if (details.contractType !== undefined) updates.contract_type = details.contractType;
        if (details.workingHours?.start !== undefined) updates.working_hours_start = details.workingHours.start;
        if (details.workingHours?.end !== undefined) updates.working_hours_end = details.workingHours.end;
        if (details.workDays !== undefined) updates.work_days = details.workDays;
        
        return this.updateExtendedProfile(userId, updates);
    }

    /**
     * Get social links
     */
    static async getSocialLinks(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT twitter_handle, github_username, website_url, portfolio_url, custom_links
                 FROM user_profile_extended WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve({});
                    
                    resolve({
                        twitter: row.twitter_handle,
                        github: row.github_username,
                        website: row.website_url,
                        portfolio: row.portfolio_url,
                        custom: this.safeJsonParse(row.custom_links, [])
                    });
                }
            );
        });
    }

    /**
     * Update social links
     */
    static async updateSocialLinks(userId, links) {
        const updates = {};
        if (links.twitter !== undefined) updates.twitter_handle = links.twitter;
        if (links.github !== undefined) updates.github_username = links.github;
        if (links.website !== undefined) updates.website_url = links.website;
        if (links.portfolio !== undefined) updates.portfolio_url = links.portfolio;
        if (links.custom !== undefined) updates.custom_links = links.custom;
        
        return this.updateExtendedProfile(userId, updates);
    }

    /**
     * Get contact information
     */
    static async getContactInfo(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT work_phone, mobile_phone, office_address, office_building, 
                        office_floor, office_desk, skype_username, teams_username,
                        slack_username, discord_username, zoom_personal_link
                 FROM user_profile_extended WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve({});
                    
                    resolve({
                        workPhone: row.work_phone,
                        mobilePhone: row.mobile_phone,
                        officeAddress: row.office_address,
                        officeBuilding: row.office_building,
                        officeFloor: row.office_floor,
                        officeDesk: row.office_desk,
                        skype: row.skype_username,
                        teams: row.teams_username,
                        slack: row.slack_username,
                        discord: row.discord_username,
                        zoomLink: row.zoom_personal_link
                    });
                }
            );
        });
    }

    /**
     * Update contact information
     */
    static async updateContactInfo(userId, contact) {
        const updates = {};
        if (contact.workPhone !== undefined) updates.work_phone = contact.workPhone;
        if (contact.mobilePhone !== undefined) updates.mobile_phone = contact.mobilePhone;
        if (contact.officeAddress !== undefined) updates.office_address = contact.officeAddress;
        if (contact.officeBuilding !== undefined) updates.office_building = contact.officeBuilding;
        if (contact.officeFloor !== undefined) updates.office_floor = contact.officeFloor;
        if (contact.officeDesk !== undefined) updates.office_desk = contact.officeDesk;
        if (contact.skype !== undefined) updates.skype_username = contact.skype;
        if (contact.teams !== undefined) updates.teams_username = contact.teams;
        if (contact.slack !== undefined) updates.slack_username = contact.slack;
        if (contact.discord !== undefined) updates.discord_username = contact.discord;
        if (contact.zoomLink !== undefined) updates.zoom_personal_link = contact.zoomLink;
        
        return this.updateExtendedProfile(userId, updates);
    }

    /**
     * Get visibility settings
     */
    static async getVisibility(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT profile_visibility, show_email_publicly, show_phone_publicly,
                        show_activity_status, show_last_seen, show_in_directory,
                        allow_mentions_from, allow_direct_messages_from
                 FROM user_profile_extended WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) {
                        return resolve({
                            profile: 'organization',
                            showEmail: false,
                            showPhone: false,
                            showActivityStatus: true,
                            showLastSeen: true,
                            showInDirectory: true,
                            allowMentionsFrom: 'all',
                            allowDirectMessagesFrom: 'all'
                        });
                    }
                    
                    resolve({
                        profile: row.profile_visibility || 'organization',
                        showEmail: !!row.show_email_publicly,
                        showPhone: !!row.show_phone_publicly,
                        showActivityStatus: row.show_activity_status !== 0,
                        showLastSeen: row.show_last_seen !== 0,
                        showInDirectory: row.show_in_directory !== 0,
                        allowMentionsFrom: row.allow_mentions_from || 'all',
                        allowDirectMessagesFrom: row.allow_direct_messages_from || 'all'
                    });
                }
            );
        });
    }

    /**
     * Update visibility settings
     */
    static async updateVisibility(userId, visibility) {
        const updates = {};
        if (visibility.profile !== undefined) updates.profile_visibility = visibility.profile;
        if (visibility.showEmail !== undefined) updates.show_email_publicly = visibility.showEmail ? 1 : 0;
        if (visibility.showPhone !== undefined) updates.show_phone_publicly = visibility.showPhone ? 1 : 0;
        if (visibility.showActivityStatus !== undefined) updates.show_activity_status = visibility.showActivityStatus ? 1 : 0;
        if (visibility.showLastSeen !== undefined) updates.show_last_seen = visibility.showLastSeen ? 1 : 0;
        if (visibility.showInDirectory !== undefined) updates.show_in_directory = visibility.showInDirectory ? 1 : 0;
        if (visibility.allowMentionsFrom !== undefined) updates.allow_mentions_from = visibility.allowMentionsFrom;
        if (visibility.allowDirectMessagesFrom !== undefined) updates.allow_direct_messages_from = visibility.allowDirectMessagesFrom;
        
        return this.updateExtendedProfile(userId, updates);
    }

    /**
     * Get email preferences
     */
    static async getEmailPreferences(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT email_signature, email_signature_html, email_aliases, email_forwarding,
                        out_of_office_enabled, out_of_office_message, out_of_office_start,
                        out_of_office_end, out_of_office_auto_reply, email_digest_frequency
                 FROM user_profile_extended WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve({});
                    
                    resolve({
                        signature: row.email_signature,
                        signatureHtml: row.email_signature_html,
                        aliases: this.safeJsonParse(row.email_aliases, []),
                        forwarding: this.safeJsonParse(row.email_forwarding, []),
                        outOfOffice: {
                            enabled: !!row.out_of_office_enabled,
                            message: row.out_of_office_message,
                            start: row.out_of_office_start,
                            end: row.out_of_office_end,
                            autoReply: !!row.out_of_office_auto_reply
                        },
                        digestFrequency: row.email_digest_frequency || 'daily'
                    });
                }
            );
        });
    }

    /**
     * Update email preferences
     */
    static async updateEmailPreferences(userId, prefs) {
        const updates = {};
        if (prefs.signature !== undefined) updates.email_signature = prefs.signature;
        if (prefs.signatureHtml !== undefined) updates.email_signature_html = prefs.signatureHtml;
        if (prefs.aliases !== undefined) updates.email_aliases = prefs.aliases;
        if (prefs.forwarding !== undefined) updates.email_forwarding = prefs.forwarding;
        if (prefs.digestFrequency !== undefined) updates.email_digest_frequency = prefs.digestFrequency;
        
        return this.updateExtendedProfile(userId, updates);
    }

    /**
     * Set out of office
     */
    static async setOutOfOffice(userId, settings) {
        const updates = {
            out_of_office_enabled: settings.enabled ? 1 : 0,
            out_of_office_message: settings.message || null,
            out_of_office_start: settings.start || null,
            out_of_office_end: settings.end || null,
            out_of_office_auto_reply: settings.autoReply ? 1 : 0
        };
        
        return this.updateExtendedProfile(userId, updates);
    }

    /**
     * Calculate profile completion score
     */
    static async calculateProfileCompletion(userId) {
        const profile = await this.getExtendedProfile(userId);
        const details = {};
        let score = 0;
        const maxScore = 100;
        
        // Basic info (30 points)
        if (profile.shortBio) { score += 10; details.shortBio = true; }
        if (profile.skills?.length > 0) { score += 10; details.skills = true; }
        if (profile.yearsExperience) { score += 5; details.yearsExperience = true; }
        if (profile.department) { score += 5; details.department = true; }
        
        // Contact info (20 points)
        if (profile.workPhone || profile.mobilePhone) { score += 10; details.phone = true; }
        if (profile.officeAddress) { score += 5; details.officeAddress = true; }
        if (profile.slack || profile.teams) { score += 5; details.chat = true; }
        
        // Social links (15 points)
        if (profile.twitter || profile.github) { score += 10; details.socialLinks = true; }
        if (profile.website || profile.portfolio) { score += 5; details.website = true; }
        
        // Professional (20 points)
        if (profile.hireDate) { score += 5; details.hireDate = true; }
        if (profile.contractType) { score += 5; details.contractType = true; }
        if (profile.workingHours?.start) { score += 5; details.workingHours = true; }
        if (profile.managerId) { score += 5; details.manager = true; }
        
        // Visibility configured (15 points)
        if (profile.profileVisibility !== 'organization') { score += 5; details.visibilityConfigured = true; }
        if (profile.emailSignature) { score += 5; details.emailSignature = true; }
        if (profile.longBio) { score += 5; details.longBio = true; }
        
        // Update score in database
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE user_profile_extended 
                 SET profile_completion_score = ?, profile_completion_details = ?
                 WHERE user_id = ?`,
                [Math.min(score, maxScore), JSON.stringify(details), userId],
                (err) => {
                    if (err) return reject(err);
                    resolve({ score: Math.min(score, maxScore), details });
                }
            );
        });
    }

    /**
     * Get profile completion
     */
    static async getProfileCompletion(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT profile_completion_score, profile_completion_details FROM user_profile_extended WHERE user_id = ?',
                [userId],
                async (err, row) => {
                    if (err) return reject(err);
                    
                    if (!row || row.profile_completion_score === null) {
                        // Calculate if not exists
                        try {
                            const result = await this.calculateProfileCompletion(userId);
                            return resolve(result);
                        } catch (calcErr) {
                            return resolve({ score: 0, details: {} });
                        }
                    }
                    
                    resolve({
                        score: row.profile_completion_score,
                        details: this.safeJsonParse(row.profile_completion_details, {})
                    });
                }
            );
        });
    }

    // ==========================================
    // SKILLS MANAGEMENT
    // ==========================================

    /**
     * Get user skills
     */
    static async getSkills(userId) {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM user_skills WHERE user_id = ? ORDER BY is_primary DESC, name ASC',
                [userId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    /**
     * Add a skill
     */
    static async addSkill(userId, skill) {
        const id = uuidv4();
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_skills (id, user_id, name, category, proficiency_level, years_experience, is_primary)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, userId, skill.name, skill.category, skill.proficiencyLevel || 'intermediate', 
                 skill.yearsExperience || null, skill.isPrimary ? 1 : 0],
                function(err) {
                    if (err) return reject(err);
                    resolve({ id, ...skill });
                }
            );
        });
    }

    /**
     * Remove a skill
     */
    static async removeSkill(userId, skillId) {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM user_skills WHERE id = ? AND user_id = ?',
                [skillId, userId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ removed: this.changes > 0 });
                }
            );
        });
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================

    static safeJsonParse(str, defaultValue = null) {
        if (!str) return defaultValue;
        try {
            return JSON.parse(str);
        } catch {
            return defaultValue;
        }
    }

    static camelToSnake(str) {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }

    static parseProfileRow(row) {
        if (!row) return null;
        
        return {
            userId: row.user_id,
            shortBio: row.short_bio,
            longBio: row.long_bio,
            skills: this.safeJsonParse(row.skills, []),
            certifications: this.safeJsonParse(row.certifications, []),
            yearsExperience: row.years_experience,
            education: this.safeJsonParse(row.education, []),
            department: row.department,
            managerId: row.manager_id,
            employeeId: row.employee_id,
            hireDate: row.hire_date,
            contractType: row.contract_type,
            workingHours: {
                start: row.working_hours_start,
                end: row.working_hours_end
            },
            workDays: this.safeJsonParse(row.work_days, [1, 2, 3, 4, 5]),
            socialLinks: {
                twitter: row.twitter_handle,
                github: row.github_username,
                website: row.website_url,
                portfolio: row.portfolio_url,
                custom: this.safeJsonParse(row.custom_links, [])
            },
            contactInfo: {
                workPhone: row.work_phone,
                mobilePhone: row.mobile_phone,
                officeAddress: row.office_address,
                officeBuilding: row.office_building,
                officeFloor: row.office_floor,
                officeDesk: row.office_desk,
                skype: row.skype_username,
                teams: row.teams_username,
                slack: row.slack_username,
                discord: row.discord_username,
                zoomLink: row.zoom_personal_link
            },
            visibility: {
                profile: row.profile_visibility,
                showEmail: !!row.show_email_publicly,
                showPhone: !!row.show_phone_publicly,
                showActivityStatus: row.show_activity_status !== 0,
                showLastSeen: row.show_last_seen !== 0,
                showInDirectory: row.show_in_directory !== 0,
                allowMentionsFrom: row.allow_mentions_from,
                allowDirectMessagesFrom: row.allow_direct_messages_from
            },
            emailPreferences: {
                signature: row.email_signature,
                signatureHtml: row.email_signature_html,
                aliases: this.safeJsonParse(row.email_aliases, []),
                forwarding: this.safeJsonParse(row.email_forwarding, []),
                outOfOffice: {
                    enabled: !!row.out_of_office_enabled,
                    message: row.out_of_office_message,
                    start: row.out_of_office_start,
                    end: row.out_of_office_end,
                    autoReply: !!row.out_of_office_auto_reply
                },
                digestFrequency: row.email_digest_frequency
            },
            profileCompletion: {
                score: row.profile_completion_score,
                details: this.safeJsonParse(row.profile_completion_details, {})
            },
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}

export default UserProfileExtendedService;







