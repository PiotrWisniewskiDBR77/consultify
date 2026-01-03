/**
 * User Profile Extended Routes
 * 
 * API endpoints for extended user profile management:
 * - Bio & About
 * - Professional Details
 * - Social Links
 * - Contact Information
 * - Visibility Settings
 * - Email Preferences
 * - Out of Office
 * - Profile Completion
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const UserProfileExtendedService = require('../services/userProfileExtendedService');

// ==========================================
// FULL EXTENDED PROFILE
// ==========================================

/**
 * @route GET /api/profile/extended
 * @desc Get full extended profile for current user
 * @access Private
 */
router.get('/extended', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const profile = await UserProfileExtendedService.getExtendedProfile(userId);
        res.json({ profile });
    } catch (err) {
        console.error('[ProfileExtended] Error getting extended profile:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/profile/extended
 * @desc Update extended profile for current user
 * @access Private
 */
router.put('/extended', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const updates = req.body;
        
        const result = await UserProfileExtendedService.updateExtendedProfile(userId, updates);
        const profile = await UserProfileExtendedService.getExtendedProfile(userId);
        
        res.json({ success: true, profile });
    } catch (err) {
        console.error('[ProfileExtended] Error updating extended profile:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// BIO & ABOUT SECTION
// ==========================================

/**
 * @route GET /api/profile/bio
 * @desc Get bio section
 * @access Private
 */
router.get('/bio', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const bio = await UserProfileExtendedService.getBio(userId);
        res.json({ bio });
    } catch (err) {
        console.error('[ProfileExtended] Error getting bio:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/profile/bio
 * @desc Update bio section
 * @access Private
 */
router.put('/bio', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const bioData = req.body;
        
        // Validation
        if (bioData.shortBio && bioData.shortBio.length > 500) {
            return res.status(400).json({ error: 'Short bio must be 500 characters or less' });
        }
        if (bioData.longBio && bioData.longBio.length > 5000) {
            return res.status(400).json({ error: 'Long bio must be 5000 characters or less' });
        }
        
        await UserProfileExtendedService.updateBio(userId, bioData);
        const bio = await UserProfileExtendedService.getBio(userId);
        
        res.json({ success: true, bio });
    } catch (err) {
        console.error('[ProfileExtended] Error updating bio:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// PROFESSIONAL DETAILS
// ==========================================

/**
 * @route GET /api/profile/professional
 * @desc Get professional details
 * @access Private
 */
router.get('/professional', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const details = await UserProfileExtendedService.getProfessionalDetails(userId);
        res.json({ professional: details });
    } catch (err) {
        console.error('[ProfileExtended] Error getting professional details:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/profile/professional
 * @desc Update professional details
 * @access Private
 */
router.put('/professional', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const details = req.body;
        
        // Validate contract type
        const validContractTypes = ['full-time', 'part-time', 'contractor', 'freelance'];
        if (details.contractType && !validContractTypes.includes(details.contractType)) {
            return res.status(400).json({ error: 'Invalid contract type' });
        }
        
        // Validate work days
        if (details.workDays) {
            if (!Array.isArray(details.workDays) || 
                details.workDays.some(d => d < 0 || d > 6)) {
                return res.status(400).json({ error: 'Invalid work days format' });
            }
        }
        
        await UserProfileExtendedService.updateProfessionalDetails(userId, details);
        const professional = await UserProfileExtendedService.getProfessionalDetails(userId);
        
        res.json({ success: true, professional });
    } catch (err) {
        console.error('[ProfileExtended] Error updating professional details:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// SOCIAL LINKS
// ==========================================

/**
 * @route GET /api/profile/social-links
 * @desc Get social links
 * @access Private
 */
router.get('/social-links', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const links = await UserProfileExtendedService.getSocialLinks(userId);
        res.json({ socialLinks: links });
    } catch (err) {
        console.error('[ProfileExtended] Error getting social links:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/profile/social-links
 * @desc Update social links
 * @access Private
 */
router.put('/social-links', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const links = req.body;
        
        // Validate URLs
        const urlFields = ['website', 'portfolio'];
        for (const field of urlFields) {
            if (links[field] && !isValidUrl(links[field])) {
                return res.status(400).json({ error: `Invalid ${field} URL` });
            }
        }
        
        // Validate custom links
        if (links.custom && Array.isArray(links.custom)) {
            for (const link of links.custom) {
                if (!link.name || !link.url) {
                    return res.status(400).json({ error: 'Custom links must have name and url' });
                }
                if (!isValidUrl(link.url)) {
                    return res.status(400).json({ error: `Invalid URL for ${link.name}` });
                }
            }
        }
        
        await UserProfileExtendedService.updateSocialLinks(userId, links);
        const socialLinks = await UserProfileExtendedService.getSocialLinks(userId);
        
        res.json({ success: true, socialLinks });
    } catch (err) {
        console.error('[ProfileExtended] Error updating social links:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// CONTACT INFORMATION
// ==========================================

/**
 * @route GET /api/profile/contact
 * @desc Get contact information
 * @access Private
 */
router.get('/contact', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const contact = await UserProfileExtendedService.getContactInfo(userId);
        res.json({ contact });
    } catch (err) {
        console.error('[ProfileExtended] Error getting contact info:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/profile/contact
 * @desc Update contact information
 * @access Private
 */
router.put('/contact', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const contact = req.body;
        
        await UserProfileExtendedService.updateContactInfo(userId, contact);
        const updatedContact = await UserProfileExtendedService.getContactInfo(userId);
        
        res.json({ success: true, contact: updatedContact });
    } catch (err) {
        console.error('[ProfileExtended] Error updating contact info:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// VISIBILITY SETTINGS
// ==========================================

/**
 * @route GET /api/profile/visibility
 * @desc Get visibility settings
 * @access Private
 */
router.get('/visibility', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const visibility = await UserProfileExtendedService.getVisibility(userId);
        res.json({ visibility });
    } catch (err) {
        console.error('[ProfileExtended] Error getting visibility:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/profile/visibility
 * @desc Update visibility settings
 * @access Private
 */
router.put('/visibility', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const visibility = req.body;
        
        // Validate profile visibility
        const validVisibility = ['public', 'organization', 'team', 'private'];
        if (visibility.profile && !validVisibility.includes(visibility.profile)) {
            return res.status(400).json({ error: 'Invalid profile visibility setting' });
        }
        
        // Validate mention settings
        const validMentionSettings = ['all', 'team', 'none'];
        if (visibility.allowMentionsFrom && !validMentionSettings.includes(visibility.allowMentionsFrom)) {
            return res.status(400).json({ error: 'Invalid mentions setting' });
        }
        
        await UserProfileExtendedService.updateVisibility(userId, visibility);
        const updatedVisibility = await UserProfileExtendedService.getVisibility(userId);
        
        res.json({ success: true, visibility: updatedVisibility });
    } catch (err) {
        console.error('[ProfileExtended] Error updating visibility:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// EMAIL PREFERENCES
// ==========================================

/**
 * @route GET /api/profile/email-preferences
 * @desc Get email preferences
 * @access Private
 */
router.get('/email-preferences', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const preferences = await UserProfileExtendedService.getEmailPreferences(userId);
        res.json({ emailPreferences: preferences });
    } catch (err) {
        console.error('[ProfileExtended] Error getting email preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PUT /api/profile/email-preferences
 * @desc Update email preferences
 * @access Private
 */
router.put('/email-preferences', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const preferences = req.body;
        
        // Validate digest frequency
        const validFrequencies = ['realtime', 'daily', 'weekly', 'never'];
        if (preferences.digestFrequency && !validFrequencies.includes(preferences.digestFrequency)) {
            return res.status(400).json({ error: 'Invalid digest frequency' });
        }
        
        await UserProfileExtendedService.updateEmailPreferences(userId, preferences);
        const updated = await UserProfileExtendedService.getEmailPreferences(userId);
        
        res.json({ success: true, emailPreferences: updated });
    } catch (err) {
        console.error('[ProfileExtended] Error updating email preferences:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// OUT OF OFFICE
// ==========================================

/**
 * @route PUT /api/profile/out-of-office
 * @desc Set out of office settings
 * @access Private
 */
router.put('/out-of-office', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = req.body;
        
        // Validate dates if provided
        if (settings.start && settings.end) {
            const start = new Date(settings.start);
            const end = new Date(settings.end);
            if (start >= end) {
                return res.status(400).json({ error: 'End date must be after start date' });
            }
        }
        
        await UserProfileExtendedService.setOutOfOffice(userId, settings);
        const preferences = await UserProfileExtendedService.getEmailPreferences(userId);
        
        res.json({ success: true, outOfOffice: preferences.outOfOffice });
    } catch (err) {
        console.error('[ProfileExtended] Error setting out of office:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route DELETE /api/profile/out-of-office
 * @desc Clear out of office
 * @access Private
 */
router.delete('/out-of-office', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        await UserProfileExtendedService.setOutOfOffice(userId, {
            enabled: false,
            message: null,
            start: null,
            end: null,
            autoReply: false
        });
        
        res.json({ success: true, message: 'Out of office cleared' });
    } catch (err) {
        console.error('[ProfileExtended] Error clearing out of office:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// PROFILE COMPLETION
// ==========================================

/**
 * @route GET /api/profile/completion
 * @desc Get profile completion score and details
 * @access Private
 */
router.get('/completion', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const completion = await UserProfileExtendedService.getProfileCompletion(userId);
        res.json({ completion });
    } catch (err) {
        console.error('[ProfileExtended] Error getting profile completion:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/profile/completion/recalculate
 * @desc Recalculate profile completion score
 * @access Private
 */
router.post('/completion/recalculate', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const completion = await UserProfileExtendedService.calculateProfileCompletion(userId);
        res.json({ success: true, completion });
    } catch (err) {
        console.error('[ProfileExtended] Error recalculating completion:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// SKILLS MANAGEMENT
// ==========================================

/**
 * @route GET /api/profile/skills
 * @desc Get user skills
 * @access Private
 */
router.get('/skills', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const skills = await UserProfileExtendedService.getSkills(userId);
        res.json({ skills });
    } catch (err) {
        console.error('[ProfileExtended] Error getting skills:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/profile/skills
 * @desc Add a skill
 * @access Private
 */
router.post('/skills', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const skill = req.body;
        
        if (!skill.name || skill.name.trim().length === 0) {
            return res.status(400).json({ error: 'Skill name is required' });
        }
        
        const validCategories = ['technical', 'soft', 'language', 'tool'];
        if (skill.category && !validCategories.includes(skill.category)) {
            return res.status(400).json({ error: 'Invalid skill category' });
        }
        
        const result = await UserProfileExtendedService.addSkill(userId, skill);
        res.json({ success: true, skill: result });
    } catch (err) {
        console.error('[ProfileExtended] Error adding skill:', err);
        if (err.message?.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Skill already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route DELETE /api/profile/skills/:id
 * @desc Remove a skill
 * @access Private
 */
router.delete('/skills/:id', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        
        const result = await UserProfileExtendedService.removeSkill(userId, id);
        
        if (!result.removed) {
            return res.status(404).json({ error: 'Skill not found' });
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('[ProfileExtended] Error removing skill:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch {
        return false;
    }
}

module.exports = router;




