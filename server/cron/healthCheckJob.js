/**
 * Health Check Cron Job
 * Monitors database connectivity and sends alerts on failure.
 */

const cron = require('node-cron');
const db = require('../database');
const EmailService = require('../services/emailService');

let isSystemHealthy = true; // Track previous state to avoid spamming
let consecutiveFailures = 0;
const ALERT_THRESHOLD = 1; // Send alert immediately on first confirmed failure
const ALERT_EMAIL = 'piotr.wisniewski@dbr77.com';

const startHealthCheck = () => {
    // Run every minute: * * * * *
    cron.schedule('* * * * *', () => {
        const start = Date.now();
        db.get('SELECT 1', [], async (err) => {
            if (err) {
                // FAILURE
                consecutiveFailures++;
                console.error(`[HEALTH CHECK] FAILED (Consecutive: ${consecutiveFailures}) - ${err.message}`);

                if (isSystemHealthy) {
                    isSystemHealthy = false;
                    // System just went DOWN
                    await EmailService.sendEmail(
                        ALERT_EMAIL,
                        'CRITICAL ALERT: System Database Down',
                        `
                        <h1>System Alert</h1>
                        <p>The Consultify database is unreachable.</p>
                        <p><strong>Error:</strong> ${err.message}</p>
                        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                        <p>Please investigate immediately.</p>
                        `
                    );
                }
            } else {
                // SUCCESS
                if (!isSystemHealthy) {
                    // System just came UP
                    console.log('[HEALTH CHECK] RECOVERED');
                    await EmailService.sendEmail(
                        ALERT_EMAIL,
                        'RESOLVED: System Database Recovered',
                        `
                        <h1>System Recovered</h1>
                        <p>The Consultify database is back online.</p>
                        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                        `
                    );
                    isSystemHealthy = true;
                    consecutiveFailures = 0;
                }
            }
        });
    });

    console.log('[Scheduler] Health Check Job started (every minute)');
};

module.exports = { startHealthCheck };
