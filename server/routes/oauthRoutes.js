/**
 * OAuth Routes
 * Handles Google and LinkedIn OAuth authentication
 */

const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const config = require('../config');
const oauthService = require('../services/oauthService');

// Initialize Passport
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ==========================================
// GOOGLE OAUTH STRATEGY
// ==========================================

if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        callbackURL: config.GOOGLE_CALLBACK_URL,
        scope: ['profile', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const result = await oauthService.findOrCreateOAuthUser('google', profile);
            done(null, result);
        } catch (error) {
            console.error('Google OAuth error:', error);
            done(error, null);
        }
    }));

    // Initiate Google OAuth
    router.get('/google', passport.authenticate('google', {
        scope: ['profile', 'email'],
        session: false
    }));

    // Google OAuth Callback
    router.get('/google/callback',
        passport.authenticate('google', {
            failureRedirect: `${config.FRONTEND_URL}?auth_error=google_failed`,
            session: false
        }),
        async (req, res) => {
            try {
                const { user } = req.user;
                const { token, safeUser } = await oauthService.generateOAuthToken(user);

                // Redirect to frontend with token
                const userJson = encodeURIComponent(JSON.stringify(safeUser));
                res.redirect(`${config.FRONTEND_URL}/auth/callback?token=${token}&user=${userJson}`);
            } catch (error) {
                console.error('Google callback error:', error);
                res.redirect(`${config.FRONTEND_URL}?auth_error=token_generation_failed`);
            }
        }
    );

    console.log('[OAuth] Google OAuth strategy configured');
} else {
    console.log('[OAuth] Google OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)');

    // Placeholder route when not configured
    router.get('/google', (req, res) => {
        res.status(501).json({ error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
    });
}

// ==========================================
// LINKEDIN OAUTH STRATEGY
// ==========================================

if (config.LINKEDIN_CLIENT_ID && config.LINKEDIN_CLIENT_SECRET) {
    passport.use(new LinkedInStrategy({
        clientID: config.LINKEDIN_CLIENT_ID,
        clientSecret: config.LINKEDIN_CLIENT_SECRET,
        callbackURL: config.LINKEDIN_CALLBACK_URL,
        scope: ['openid', 'profile', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            // LinkedIn profile structure is different
            const normalizedProfile = {
                id: profile.id,
                emails: profile.emails,
                name: {
                    givenName: profile.name?.givenName || profile.givenName,
                    familyName: profile.name?.familyName || profile.familyName
                },
                photos: profile.photos
            };

            const result = await oauthService.findOrCreateOAuthUser('linkedin', normalizedProfile);
            done(null, result);
        } catch (error) {
            console.error('LinkedIn OAuth error:', error);
            done(error, null);
        }
    }));

    // Initiate LinkedIn OAuth
    router.get('/linkedin', passport.authenticate('linkedin', {
        session: false
    }));

    // LinkedIn OAuth Callback
    router.get('/linkedin/callback',
        passport.authenticate('linkedin', {
            failureRedirect: `${config.FRONTEND_URL}?auth_error=linkedin_failed`,
            session: false
        }),
        async (req, res) => {
            try {
                const { user } = req.user;
                const { token, safeUser } = await oauthService.generateOAuthToken(user);

                // Redirect to frontend with token
                const userJson = encodeURIComponent(JSON.stringify(safeUser));
                res.redirect(`${config.FRONTEND_URL}/auth/callback?token=${token}&user=${userJson}`);
            } catch (error) {
                console.error('LinkedIn callback error:', error);
                res.redirect(`${config.FRONTEND_URL}?auth_error=token_generation_failed`);
            }
        }
    );

    console.log('[OAuth] LinkedIn OAuth strategy configured');
} else {
    console.log('[OAuth] LinkedIn OAuth not configured (missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET)');

    // Placeholder route when not configured
    router.get('/linkedin', (req, res) => {
        res.status(501).json({ error: 'LinkedIn OAuth not configured. Please set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.' });
    });
}

// ==========================================
// STATUS ENDPOINT
// ==========================================

router.get('/oauth/status', (req, res) => {
    res.json({
        google: {
            configured: !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET),
            loginUrl: '/api/auth/google'
        },
        linkedin: {
            configured: !!(config.LINKEDIN_CLIENT_ID && config.LINKEDIN_CLIENT_SECRET),
            loginUrl: '/api/auth/linkedin'
        }
    });
});

module.exports = router;
