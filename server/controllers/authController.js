const { v4: uuidv4 } = require('uuid');

// Default Dependencies
const deps = {
    db: require('../database'),
    bcrypt: require('bcryptjs'),
    jwt: require('jsonwebtoken'),
    config: require('../config'),
    ActivityService: require('../services/activityService'),
    MFAService: require('../services/mfaService'),
    RefreshTokenService: require('../services/refreshTokenService'),
    RedisStore: require('../utils/redisRateLimitStore')
};

/**
 * Inject mock dependencies for testing
 * @param {Object} newDeps 
 */
function setDependencies(newDeps) {
    Object.assign(deps, newDeps);
}

// Helper: Timeout wrapper
const withTimeout = (promise, timeoutMs = 1000) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), timeoutMs))
    ]);
};

/**
 * Handle User Login
 */
const login = async (req, res) => {
    console.log('[Auth] Login request received for:', req.body?.email || 'no email');
    const { email, password, mfaToken, deviceFingerprint, trustDevice } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    // Best-effort rate limit clear (pre-validation)
    try {
        const authRedisStore = new deps.RedisStore({ windowMs: 15 * 60 * 1000 });
        const rateLimitKey = `auth:${email.toLowerCase().trim()}`;
        await withTimeout(authRedisStore.resetKey(rateLimitKey), 500);
    } catch (err) {
        // Ignore
    }

    try {
        // Get user
        const user = await new Promise((resolve, reject) => {
            deps.db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Verify password
        const passwordIsValid = deps.bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Clear rate limit (success)
        try {
            const authRedisStore = new deps.RedisStore({ windowMs: 15 * 60 * 1000 });
            const rateLimitKey = `auth:${email.toLowerCase().trim()}`;
            await withTimeout(authRedisStore.resetKey(rateLimitKey), 500);
        } catch (err) {
            // Ignore
        }

        // Get organization
        const org = await new Promise((resolve, reject) => {
            deps.db.get('SELECT * FROM organizations WHERE id = ?', [user.organization_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Check organization status
        if (org.status === 'pending' && user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Your organization is waiting for approval.', status: 'pending' });
        }
        if (org.status === 'blocked' && user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Your organization has been blocked. Contact support.' });
        }

        // Check MFA
        const mfaStatus = await deps.MFAService.getMFAStatus(user.id);

        if (mfaStatus.enabled) {
            if (deviceFingerprint) {
                const isTrusted = await deps.MFAService.isDeviceTrusted(user.id, deviceFingerprint);
                if (!isTrusted && !mfaToken) {
                    return res.json({ mfaRequired: true, userId: user.id, message: 'Please enter your 2FA code' });
                } else if (!isTrusted) {
                    // Verify Token
                    const verification = await deps.MFAService.verifyTOTP(user.id, mfaToken, req.ip, req.get('user-agent'));
                    if (!verification.success) {
                        return res.status(401).json({ error: verification.error, mfaRequired: true });
                    }
                    if (trustDevice) {
                        const deviceName = (req.get('user-agent') || 'Unknown Device').substring(0, 100);
                        await deps.MFAService.trustDevice(user.id, deviceFingerprint, deviceName);
                    }
                }
            } else if (!mfaToken) {
                return res.json({ mfaRequired: true, userId: user.id, message: 'Please enter your 2FA code' });
            } else {
                const verification = await deps.MFAService.verifyTOTP(user.id, mfaToken, req.ip, req.get('user-agent'));
                if (!verification.success) {
                    return res.status(401).json({ error: verification.error, mfaRequired: true });
                }
            }
        } else if (mfaStatus.enforced) {
            return res.status(403).json({
                error: 'Your organization requires two-factor authentication. Please set up MFA first.',
                mfaSetupRequired: true,
                gracePeriodRemaining: mfaStatus.gracePeriodRemaining
            });
        }

        // Update Last Login
        await new Promise((resolve) => {
            deps.db.run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id], resolve);
        });

        // Generate tokens
        const deviceInfo = (req.get('user-agent') || 'Unknown Device').substring(0, 200);
        const tokenPair = await deps.RefreshTokenService.generateTokenPair(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                organization_id: user.organization_id
            },
            {
                deviceInfo,
                ip: req.ip,
                userAgent: req.get('user-agent')
            }
        );

        const safeUser = {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            status: user.status,
            organizationId: user.organization_id,
            companyName: org.name,
            mfaEnabled: mfaStatus.enabled
        };

        // Log activity
        deps.ActivityService.log({
            organizationId: user.organization_id,
            userId: user.id,
            action: 'login',
            entityType: 'session',
            entityId: 'session',
            entityName: 'User Login'
        });

        res.json({
            user: safeUser,
            token: tokenPair.accessToken,
            refreshToken: tokenPair.refreshToken,
            expiresIn: tokenPair.expiresIn
        });

    } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    login,
    setDependencies
};
