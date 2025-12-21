const axios = require('axios');
const logger = require('../utils/logger');

/**
 * SIEM Service (Prestige Tier)
 * Handles streaming of audit events to external security collectors.
 */
class SiemService {
    constructor() {
        this.enabled = process.env.SIEM_ENABLED === 'true';
        this.endpoint = process.env.SIEM_ENDPOINT_URL;
        this.apiKey = process.env.SIEM_API_KEY;
        this.buffer = [];
        this.batchSize = 10;
        this.flushInterval = 5000; // 5 seconds

        if (this.enabled && this.endpoint) {
            this.startFlushTimer();
        }
    }

    /**
     * Stream a log entry to SIEM
     */
    async stream(event) {
        if (!this.enabled) return;

        this.buffer.push({
            ...event,
            source: 'consultify-api',
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString()
        });

        if (this.buffer.length >= this.batchSize) {
            await this.flush();
        }
    }

    async flush() {
        if (this.buffer.length === 0) return;

        const batch = [...this.buffer];
        this.buffer = [];

        try {
            // In a real IBM/BCG scenario, this would go to Splunk HEC or Datadog API
            // For now, we log the "streaming" action and try to POST to a configured endpoint
            if (this.endpoint) {
                await axios.post(this.endpoint, { logs: batch }, {
                    headers: { 'Authorization': `Bearer ${this.apiKey}` },
                    timeout: 5000
                });
            } else {
                logger.debug('[SIEM] Would stream batch of logs', { count: batch.length });
            }
        } catch (error) {
            console.warn(`[SIEM] Delivery failed: ${error.message}`);
            // Re-buffer for a future retry (limited depth to prevent memory leak)
            if (this.buffer.length < 100) {
                this.buffer.unshift(...batch);
            }
        }
    }

    startFlushTimer() {
        setInterval(() => this.flush(), this.flushInterval);
    }
}

module.exports = new SiemService();
