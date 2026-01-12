/**
 * Profile Extended API Service
 *
 * API methods for extended user profile operations:
 * - Bio & About
 * - Professional Details
 * - Social Links
 * - Contact Information
 * - Visibility Settings
 * - Email Preferences
 * - Out of Office
 * - Profile Completion
 */

import {
    EmailPreferences,
    ExtendedContactInfo,
    ExtendedSocialLinks,
    OutOfOfficeSettings,
    ProfileCompletion,
    ProfileVisibility,
    UserProfileExtended,
    UserSkill,
} from '../types';
import { Api } from './api';

// Bio Data Interface
interface BioData {
    shortBio?: string;
    longBio?: string;
    skills?: string[];
    certifications?: any[];
    yearsExperience?: number;
}

// Professional Details Interface
interface ProfessionalDetails {
    department?: string;
    managerId?: string;
    employeeId?: string;
    hireDate?: string;
    contractType?: 'full-time' | 'part-time' | 'contractor' | 'freelance';
    workingHours?: { start: string; end: string };
    workDays?: number[];
}

export const ProfileExtendedApi = {
    /**
     * Get full extended profile
     */
    getExtendedProfile: async (): Promise<{ profile: UserProfileExtended }> => {
        return Api.get('/profile/extended');
    },

    /**
     * Update extended profile
     */
    updateExtendedProfile: async (
        data: Partial<UserProfileExtended>,
    ): Promise<{ success: boolean; profile: UserProfileExtended }> => {
        return Api.put('/profile/extended', data);
    },

    /**
     * Get bio section
     */
    getBio: async (): Promise<{ bio: BioData }> => {
        return Api.get('/profile/bio');
    },

    /**
     * Update bio section
     */
    updateBio: async (bio: BioData): Promise<{ success: boolean; bio: BioData }> => {
        return Api.put('/profile/bio', bio);
    },

    /**
     * Get professional details
     */
    getProfessionalDetails: async (): Promise<{ professional: ProfessionalDetails }> => {
        return Api.get('/profile/professional');
    },

    /**
     * Update professional details
     */
    updateProfessionalDetails: async (
        details: ProfessionalDetails,
    ): Promise<{ success: boolean; professional: ProfessionalDetails }> => {
        return Api.put('/profile/professional', details);
    },

    /**
     * Get social links
     */
    getSocialLinks: async (): Promise<{ socialLinks: ExtendedSocialLinks }> => {
        return Api.get('/profile/social-links');
    },

    /**
     * Update social links
     */
    updateSocialLinks: async (
        links: Partial<ExtendedSocialLinks>,
    ): Promise<{ success: boolean; socialLinks: ExtendedSocialLinks }> => {
        return Api.put('/profile/social-links', links);
    },

    /**
     * Get contact information
     */
    getContactInfo: async (): Promise<{ contact: ExtendedContactInfo }> => {
        return Api.get('/profile/contact');
    },

    /**
     * Update contact information
     */
    updateContactInfo: async (
        contact: Partial<ExtendedContactInfo>,
    ): Promise<{ success: boolean; contact: ExtendedContactInfo }> => {
        return Api.put('/profile/contact', contact);
    },

    /**
     * Get visibility settings
     */
    getVisibility: async (): Promise<{ visibility: ProfileVisibility }> => {
        return Api.get('/profile/visibility');
    },

    /**
     * Update visibility settings
     */
    updateVisibility: async (
        visibility: Partial<ProfileVisibility>,
    ): Promise<{ success: boolean; visibility: ProfileVisibility }> => {
        return Api.put('/profile/visibility', visibility);
    },

    /**
     * Get email preferences
     */
    getEmailPreferences: async (): Promise<{ emailPreferences: EmailPreferences }> => {
        return Api.get('/profile/email-preferences');
    },

    /**
     * Update email preferences
     */
    updateEmailPreferences: async (
        prefs: Partial<EmailPreferences>,
    ): Promise<{ success: boolean; emailPreferences: EmailPreferences }> => {
        return Api.put('/profile/email-preferences', prefs);
    },

    /**
     * Set out of office
     */
    setOutOfOffice: async (
        settings: OutOfOfficeSettings,
    ): Promise<{ success: boolean; outOfOffice: OutOfOfficeSettings }> => {
        return Api.put('/profile/out-of-office', settings);
    },

    /**
     * Clear out of office
     */
    clearOutOfOffice: async (): Promise<{ success: boolean }> => {
        return Api.delete('/profile/out-of-office');
    },

    /**
     * Get profile completion score
     */
    getProfileCompletion: async (): Promise<{ completion: ProfileCompletion }> => {
        return Api.get('/profile/completion');
    },

    /**
     * Recalculate profile completion
     */
    recalculateProfileCompletion: async (): Promise<{ success: boolean; completion: ProfileCompletion }> => {
        return Api.post('/profile/completion/recalculate', {});
    },

    /**
     * Get user skills
     */
    getSkills: async (): Promise<{ skills: UserSkill[] }> => {
        return Api.get('/profile/skills');
    },

    /**
     * Add a skill
     */
    addSkill: async (skill: Partial<UserSkill>): Promise<{ success: boolean; skill: UserSkill }> => {
        return Api.post('/profile/skills', skill);
    },

    /**
     * Remove a skill
     */
    removeSkill: async (skillId: string): Promise<{ success: boolean }> => {
        return Api.delete(`/profile/skills/${skillId}`);
    },
};

export default ProfileExtendedApi;

