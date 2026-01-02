/**
 * User Professional Profile Routes
 * 
 * Manages user professional profile:
 * - Bio/About Me
 * - Skills
 * - Certifications
 * - Education
 * - Work Experience
 * - Social Links
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/authMiddleware');
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

router.use(requireAuth);

/**
 * GET /api/user/professional-profile
 * Get professional profile for current user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        const [profile, skills, certifications, education, workExperience] = await Promise.all([
            // Get extended profile
            new Promise((resolve, reject) => {
                db.get(
                    `SELECT short_bio, long_bio, twitter_handle, github_username, 
                            website_url, portfolio_url, custom_links
                     FROM user_profile_extended 
                     WHERE user_id = ?`,
                    [userId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row || null);
                    }
                );
            }),
            // Get skills
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, name, category, proficiency_level, years_experience, is_primary
                     FROM user_skills 
                     WHERE user_id = ?
                     ORDER BY is_primary DESC, name ASC`,
                    [userId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            }),
            // Get certifications
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, name, issuer, issue_date, expiry_date, credential_id, credential_url, description
                     FROM user_certifications 
                     WHERE user_id = ?
                     ORDER BY issue_date DESC`,
                    [userId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            }),
            // Get education
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, institution, degree, field_of_study, start_year, end_year, is_current, description
                     FROM user_education 
                     WHERE user_id = ?
                     ORDER BY start_year DESC`,
                    [userId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            }),
            // Get work experience
            new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, company, title, location, start_date, end_date, is_current, description
                     FROM user_work_history 
                     WHERE user_id = ?
                     ORDER BY start_date DESC`,
                    [userId],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            })
        ]);

        // Map skills to simple string array for frontend compatibility
        const skillNames = skills.map(s => s.name);

        // Map database fields to frontend expected format
        const socialLinks = {
            twitter: profile?.twitter_handle || '',
            github: profile?.github_username || '',
            website: profile?.website_url || '',
            portfolio: profile?.portfolio_url || ''
        };

        // Map certifications to frontend format
        const mappedCertifications = certifications.map(cert => ({
            id: cert.id,
            name: cert.name,
            issuer: cert.issuer,
            issueDate: cert.issue_date,
            expiryDate: cert.expiry_date,
            credentialId: cert.credential_id,
            credentialUrl: cert.credential_url
        }));

        // Map education to frontend format
        const mappedEducation = education.map(edu => ({
            id: edu.id,
            institution: edu.institution,
            degree: edu.degree,
            fieldOfStudy: edu.field_of_study,
            startDate: edu.start_year ? `${edu.start_year}-01-01` : '',
            endDate: edu.end_year ? `${edu.end_year}-01-01` : '',
            isCurrent: !!edu.is_current,
            description: edu.description
        }));

        // Map work experience to frontend format
        const mappedWorkExperience = workExperience.map(work => ({
            id: work.id,
            company: work.company,
            position: work.title,
            startDate: work.start_date,
            endDate: work.end_date,
            isCurrent: !!work.is_current,
            description: work.description,
            location: work.location
        }));

        res.json({
            success: true,
            bio: profile?.long_bio || profile?.short_bio || '',
            skills: skillNames,
            certifications: mappedCertifications,
            education: mappedEducation,
            workExperience: mappedWorkExperience,
            socialLinks
        });
    } catch (error) {
        console.error('Error fetching professional profile:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch professional profile' });
    }
});

/**
 * PUT /api/user/professional-profile
 * Update professional profile
 */
router.put('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { bio, skills, certifications, education, workExperience, socialLinks } = req.body;

        // =========================================
        // Update extended profile (bio & social links)
        // =========================================
        const existing = await new Promise((resolve, reject) => {
            db.get('SELECT user_id FROM user_profile_extended WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (existing) {
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE user_profile_extended 
                     SET long_bio = ?, twitter_handle = ?, github_username = ?, 
                         website_url = ?, portfolio_url = ?, updated_at = datetime('now')
                     WHERE user_id = ?`,
                    [
                        bio || null,
                        socialLinks?.twitter || null,
                        socialLinks?.github || null,
                        socialLinks?.website || null,
                        socialLinks?.portfolio || null,
                        userId
                    ],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        } else {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO user_profile_extended 
                     (user_id, long_bio, twitter_handle, github_username, website_url, portfolio_url, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                    [
                        userId,
                        bio || null,
                        socialLinks?.twitter || null,
                        socialLinks?.github || null,
                        socialLinks?.website || null,
                        socialLinks?.portfolio || null
                    ],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        // =========================================
        // Update skills
        // =========================================
        if (skills) {
            // Delete existing skills
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM user_skills WHERE user_id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Insert new skills
            for (const skillName of skills) {
                const skillId = uuidv4();
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO user_skills 
                         (id, user_id, name, category, proficiency_level, created_at, updated_at)
                         VALUES (?, ?, ?, 'general', 'intermediate', datetime('now'), datetime('now'))`,
                        [skillId, userId, skillName],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
        }

        // =========================================
        // Update certifications
        // =========================================
        if (certifications) {
            // Delete existing certifications
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM user_certifications WHERE user_id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Insert new certifications
            for (const cert of certifications) {
                const certId = cert.id && !cert.id.includes('-temp-') ? cert.id : uuidv4();
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO user_certifications 
                         (id, user_id, name, issuer, issue_date, expiry_date, credential_id, credential_url, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                        [
                            certId,
                            userId,
                            cert.name,
                            cert.issuer || null,
                            cert.issueDate || null,
                            cert.expiryDate || null,
                            cert.credentialId || null,
                            cert.credentialUrl || null
                        ],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
        }

        // =========================================
        // Update education
        // =========================================
        if (education) {
            // Delete existing education
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM user_education WHERE user_id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Insert new education
            for (const edu of education) {
                const eduId = edu.id && !edu.id.includes('-temp-') ? edu.id : uuidv4();
                // Extract year from date string
                const startYear = edu.startDate ? new Date(edu.startDate).getFullYear() : null;
                const endYear = edu.endDate ? new Date(edu.endDate).getFullYear() : null;
                
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO user_education 
                         (id, user_id, institution, degree, field_of_study, start_year, end_year, is_current, description, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                        [
                            eduId,
                            userId,
                            edu.institution,
                            edu.degree || null,
                            edu.fieldOfStudy || null,
                            startYear,
                            endYear,
                            edu.isCurrent ? 1 : 0,
                            edu.description || null
                        ],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
        }

        // =========================================
        // Update work experience
        // =========================================
        if (workExperience) {
            // Delete existing work experience
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM user_work_history WHERE user_id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Insert new work experience
            for (const work of workExperience) {
                const workId = work.id && !work.id.includes('-temp-') ? work.id : uuidv4();
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO user_work_history 
                         (id, user_id, company, title, location, start_date, end_date, is_current, description, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                        [
                            workId,
                            userId,
                            work.company,
                            work.position || null,
                            work.location || null,
                            work.startDate || null,
                            work.endDate || null,
                            work.isCurrent ? 1 : 0,
                            work.description || null
                        ],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
        }

        res.json({ success: true, message: 'Professional profile updated successfully' });
    } catch (error) {
        console.error('Error updating professional profile:', error);
        res.status(500).json({ success: false, error: 'Failed to update professional profile' });
    }
});

module.exports = router;

