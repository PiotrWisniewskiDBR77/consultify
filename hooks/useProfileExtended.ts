/**
 * useProfileExtended Hook
 * 
 * React hook for managing extended profile state with auto-save
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ProfileExtendedApi } from '../services/profileExtendedApi';
import { 
    UserProfileExtended, 
    ProfileVisibility, 
    EmailPreferences,
    ExtendedSocialLinks,
    ExtendedContactInfo,
    ProfileCompletion,
    UserSkill
} from '../types';

interface UseProfileExtendedOptions {
    autoSave?: boolean;
    autoSaveDelay?: number;
    onSaveSuccess?: () => void;
    onSaveError?: (error: Error) => void;
}

interface UseProfileExtendedReturn {
    profile: UserProfileExtended | null;
    loading: boolean;
    saving: boolean;
    error: Error | null;
    
    // Bio
    updateBio: (bio: { shortBio?: string; longBio?: string; skills?: string[]; yearsExperience?: number }) => Promise<void>;
    
    // Social
    socialLinks: ExtendedSocialLinks | null;
    updateSocialLinks: (links: Partial<ExtendedSocialLinks>) => Promise<void>;
    
    // Contact
    contactInfo: ExtendedContactInfo | null;
    updateContactInfo: (contact: Partial<ExtendedContactInfo>) => Promise<void>;
    
    // Visibility
    visibility: ProfileVisibility | null;
    updateVisibility: (visibility: Partial<ProfileVisibility>) => Promise<void>;
    
    // Email
    emailPreferences: EmailPreferences | null;
    updateEmailPreferences: (prefs: Partial<EmailPreferences>) => Promise<void>;
    
    // Out of Office
    setOutOfOffice: (settings: { enabled: boolean; message?: string; start?: string; end?: string; autoReply?: boolean }) => Promise<void>;
    clearOutOfOffice: () => Promise<void>;
    
    // Profile Completion
    profileCompletion: ProfileCompletion | null;
    refreshProfileCompletion: () => Promise<void>;
    
    // Skills
    skills: UserSkill[];
    addSkill: (skill: Partial<UserSkill>) => Promise<void>;
    removeSkill: (skillId: string) => Promise<void>;
    
    // Actions
    refresh: () => Promise<void>;
    save: () => Promise<void>;
}

export function useProfileExtended(options: UseProfileExtendedOptions = {}): UseProfileExtendedReturn {
    const { 
        autoSave = false, 
        autoSaveDelay = 2000, 
        onSaveSuccess,
        onSaveError 
    } = options;

    const [profile, setProfile] = useState<UserProfileExtended | null>(null);
    const [socialLinks, setSocialLinks] = useState<ExtendedSocialLinks | null>(null);
    const [contactInfo, setContactInfo] = useState<ExtendedContactInfo | null>(null);
    const [visibility, setVisibility] = useState<ProfileVisibility | null>(null);
    const [emailPreferences, setEmailPreferences] = useState<EmailPreferences | null>(null);
    const [profileCompletion, setProfileCompletion] = useState<ProfileCompletion | null>(null);
    const [skills, setSkills] = useState<UserSkill[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    
    const autoSaveTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
    const pendingChanges = useRef<Partial<UserProfileExtended>>({});

    // Load initial data
    useEffect(() => {
        loadProfile();
        return () => {
            if (autoSaveTimeout.current) {
                clearTimeout(autoSaveTimeout.current);
            }
        };
    }, []);

    const loadProfile = async () => {
        setLoading(true);
        setError(null);
        try {
            const [
                profileRes,
                socialRes,
                contactRes,
                visibilityRes,
                emailRes,
                completionRes,
                skillsRes
            ] = await Promise.all([
                ProfileExtendedApi.getExtendedProfile(),
                ProfileExtendedApi.getSocialLinks(),
                ProfileExtendedApi.getContactInfo(),
                ProfileExtendedApi.getVisibility(),
                ProfileExtendedApi.getEmailPreferences(),
                ProfileExtendedApi.getProfileCompletion(),
                ProfileExtendedApi.getSkills()
            ]);

            setProfile(profileRes.profile);
            setSocialLinks(socialRes.socialLinks);
            setContactInfo(contactRes.contact);
            setVisibility(visibilityRes.visibility);
            setEmailPreferences(emailRes.emailPreferences);
            setProfileCompletion(completionRes.completion);
            setSkills(skillsRes.skills || []);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    };

    const scheduleSave = useCallback(() => {
        if (!autoSave) return;
        
        if (autoSaveTimeout.current) {
            clearTimeout(autoSaveTimeout.current);
        }
        
        autoSaveTimeout.current = setTimeout(async () => {
            if (Object.keys(pendingChanges.current).length > 0) {
                await save();
            }
        }, autoSaveDelay);
    }, [autoSave, autoSaveDelay]);

    const save = async () => {
        if (Object.keys(pendingChanges.current).length === 0) return;
        
        setSaving(true);
        try {
            await ProfileExtendedApi.updateExtendedProfile(pendingChanges.current);
            pendingChanges.current = {};
            onSaveSuccess?.();
        } catch (err) {
            onSaveError?.(err as Error);
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const updateBio = async (bio: { shortBio?: string; longBio?: string; skills?: string[]; yearsExperience?: number }) => {
        setSaving(true);
        try {
            const response = await ProfileExtendedApi.updateBio(bio);
            setProfile(prev => prev ? { ...prev, ...bio } : null);
            onSaveSuccess?.();
        } catch (err) {
            onSaveError?.(err as Error);
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const updateSocialLinks = async (links: Partial<ExtendedSocialLinks>) => {
        setSaving(true);
        try {
            const response = await ProfileExtendedApi.updateSocialLinks(links);
            setSocialLinks(response.socialLinks);
            onSaveSuccess?.();
        } catch (err) {
            onSaveError?.(err as Error);
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const updateContactInfo = async (contact: Partial<ExtendedContactInfo>) => {
        setSaving(true);
        try {
            const response = await ProfileExtendedApi.updateContactInfo(contact);
            setContactInfo(response.contact);
            onSaveSuccess?.();
        } catch (err) {
            onSaveError?.(err as Error);
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const updateVisibility = async (vis: Partial<ProfileVisibility>) => {
        setSaving(true);
        try {
            const response = await ProfileExtendedApi.updateVisibility(vis);
            setVisibility(response.visibility);
            onSaveSuccess?.();
        } catch (err) {
            onSaveError?.(err as Error);
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const updateEmailPreferences = async (prefs: Partial<EmailPreferences>) => {
        setSaving(true);
        try {
            const response = await ProfileExtendedApi.updateEmailPreferences(prefs);
            setEmailPreferences(response.emailPreferences);
            onSaveSuccess?.();
        } catch (err) {
            onSaveError?.(err as Error);
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const setOutOfOffice = async (settings: { enabled: boolean; message?: string; start?: string; end?: string; autoReply?: boolean }) => {
        setSaving(true);
        try {
            await ProfileExtendedApi.setOutOfOffice(settings);
            // Refresh email preferences to get updated OOO status
            const response = await ProfileExtendedApi.getEmailPreferences();
            setEmailPreferences(response.emailPreferences);
            onSaveSuccess?.();
        } catch (err) {
            onSaveError?.(err as Error);
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const clearOutOfOffice = async () => {
        setSaving(true);
        try {
            await ProfileExtendedApi.clearOutOfOffice();
            // Refresh email preferences
            const response = await ProfileExtendedApi.getEmailPreferences();
            setEmailPreferences(response.emailPreferences);
            onSaveSuccess?.();
        } catch (err) {
            onSaveError?.(err as Error);
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const refreshProfileCompletion = async () => {
        try {
            const response = await ProfileExtendedApi.recalculateProfileCompletion();
            setProfileCompletion(response.completion);
        } catch (err) {
            console.error('Failed to refresh profile completion:', err);
        }
    };

    const addSkill = async (skill: Partial<UserSkill>) => {
        setSaving(true);
        try {
            const response = await ProfileExtendedApi.addSkill(skill);
            setSkills(prev => [...prev, response.skill]);
            onSaveSuccess?.();
        } catch (err) {
            onSaveError?.(err as Error);
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const removeSkill = async (skillId: string) => {
        setSaving(true);
        try {
            await ProfileExtendedApi.removeSkill(skillId);
            setSkills(prev => prev.filter(s => s.id !== skillId));
            onSaveSuccess?.();
        } catch (err) {
            onSaveError?.(err as Error);
            throw err;
        } finally {
            setSaving(false);
        }
    };

    return {
        profile,
        loading,
        saving,
        error,
        
        updateBio,
        
        socialLinks,
        updateSocialLinks,
        
        contactInfo,
        updateContactInfo,
        
        visibility,
        updateVisibility,
        
        emailPreferences,
        updateEmailPreferences,
        
        setOutOfOffice,
        clearOutOfOffice,
        
        profileCompletion,
        refreshProfileCompletion,
        
        skills,
        addSkill,
        removeSkill,
        
        refresh: loadProfile,
        save,
    };
}

export default useProfileExtended;




