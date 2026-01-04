const notificationService = import('../services/notificationService.js');

/**
 * Alert Watchdog Middleware
 * Intercepts server errors and generates SYSTEM_ALERT notifications
 * for 500-level errors or explicit critical errors.
 * 
 * Must be placed BEFORE the final error handler.
 */
const alertWatchdog = async (err, req, res, next) => {
    try {
        // Determine status code (default to 500 if not specified)
        const statusCode = err.statusCode || err.status || 500;

        // Only alert on 500-level errors (server errors), ignore 4xx (client errors)
        if (statusCode >= 500) {
            console.error('[AlertWatchdog] Detected Server Error:', err.message);

            // Avoid alerting for expected "operational" errors if marked so (optional pattern)
            // if (err.isOperational) return next(err);

            const location = `${req.method} ${req.originalUrl}`;
            const message = `Server Error at ${location}: ${err.message}`;

            // Fire and forget notification
            notificationService.create({
                userId: 'system', // System-created
                organizationId: 'system',
                projectId: null,
                type: 'SYSTEM_ALERT',
                severity: 'CRITICAL',
                title: `Server Error: ${err.message.substring(0, 50)}`,
                message: message.substring(0, 500), // Truncate for DB
                relatedObjectType: 'ERROR',
                relatedObjectId: null,
                isActionable: false
            }).catch(noteErr => {
                console.error('[AlertWatchdog] Failed to create notification:', noteErr);
            });
        }
    } catch (watchdogErr) {
        // Safety net: ensure watchdog failure doesn't crash the request or hide the original error
        console.error('[AlertWatchdog] Internal Error:', watchdogErr);
    }

    // Always pass to the next error handler (which sends the response)
    next(err);
};

export default alertWatchdog;
