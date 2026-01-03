/**
 * Scheduled Reports Service
 * 
 * Manages automated generation and distribution of management reports.
 * Handles recurring schedules (daily, weekly, monthly) and one-time schedules.
 * 
 * PMO Standards: ISO 21500, PMBOK 7, PRINCE2
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const ManagementReportsService = require('./managementReportsService');
const ReportEmailService = require('./reportEmailService');

/**
 * Schedule frequency options
 */
const FREQUENCIES = {
    DAILY: 'DAILY',
    WEEKLY: 'WEEKLY',
    BIWEEKLY: 'BIWEEKLY',
    MONTHLY: 'MONTHLY',
    ONCE: 'ONCE'
};

/**
 * Days of week for weekly schedules
 */
const DAYS_OF_WEEK = {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6
};

const ScheduledReportsService = {
    FREQUENCIES,
    DAYS_OF_WEEK,

    /**
     * Create a new report schedule
     * @param {object} scheduleData - Schedule configuration
     * @returns {Promise<object>} Created schedule
     */
    createSchedule: async (scheduleData) => {
        const {
            organizationId,
            projectId,
            reportType,
            scope,
            frequency,
            dayOfWeek,
            dayOfMonth,
            hourOfDay = 9,
            minuteOfHour = 0,
            recipients,
            options = {},
            createdBy,
            name
        } = scheduleData;

        // Validate required fields
        if (!organizationId || !reportType || !frequency) {
            throw new Error('organizationId, reportType, and frequency are required');
        }

        if (!Object.values(FREQUENCIES).includes(frequency)) {
            throw new Error(`Invalid frequency. Must be one of: ${Object.values(FREQUENCIES).join(', ')}`);
        }

        const scheduleId = uuidv4();
        const now = new Date();

        // Calculate next run time
        const nextRunAt = ScheduledReportsService._calculateNextRun({
            frequency,
            dayOfWeek,
            dayOfMonth,
            hourOfDay,
            minuteOfHour
        });

        const schedule = {
            id: scheduleId,
            organization_id: organizationId,
            project_id: projectId || null,
            report_type: reportType,
            scope: scope || 'PORTFOLIO',
            name: name || `${reportType} - ${frequency}`,
            frequency,
            day_of_week: dayOfWeek,
            day_of_month: dayOfMonth,
            hour_of_day: hourOfDay,
            minute_of_hour: minuteOfHour,
            recipients: JSON.stringify(recipients || []),
            options: JSON.stringify(options),
            status: 'ACTIVE',
            next_run_at: nextRunAt.toISOString(),
            last_run_at: null,
            created_by: createdBy,
            created_at: now.toISOString(),
            updated_at: now.toISOString()
        };

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO management_report_schedules 
                 (id, organization_id, project_id, report_type, scope, name, frequency, 
                  day_of_week, day_of_month, hour_of_day, minute_of_hour, recipients, 
                  options, status, next_run_at, last_run_at, created_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    schedule.id, schedule.organization_id, schedule.project_id,
                    schedule.report_type, schedule.scope, schedule.name, schedule.frequency,
                    schedule.day_of_week, schedule.day_of_month, schedule.hour_of_day,
                    schedule.minute_of_hour, schedule.recipients, schedule.options,
                    schedule.status, schedule.next_run_at, schedule.last_run_at,
                    schedule.created_by, schedule.created_at, schedule.updated_at
                ],
                (err) => err ? reject(err) : resolve()
            );
        });

        console.log(`[ScheduledReports] Created schedule ${scheduleId} - next run: ${nextRunAt.toISOString()}`);
        return schedule;
    },

    /**
     * Update an existing schedule
     * @param {string} scheduleId - Schedule ID
     * @param {object} updates - Fields to update
     */
    updateSchedule: async (scheduleId, updates) => {
        const allowedFields = [
            'name', 'frequency', 'day_of_week', 'day_of_month',
            'hour_of_day', 'minute_of_hour', 'recipients', 'options', 'status'
        ];

        const setClauses = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                setClauses.push(`${key} = ?`);
                if (key === 'recipients' || key === 'options') {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }
        }

        if (setClauses.length === 0) {
            return;
        }

        setClauses.push('updated_at = CURRENT_TIMESTAMP');

        // Recalculate next run if schedule timing changed
        if (updates.frequency || updates.day_of_week || updates.day_of_month || 
            updates.hour_of_day || updates.minute_of_hour) {
            const schedule = await ScheduledReportsService.getSchedule(scheduleId);
            const nextRun = ScheduledReportsService._calculateNextRun({
                frequency: updates.frequency || schedule.frequency,
                dayOfWeek: updates.day_of_week || schedule.day_of_week,
                dayOfMonth: updates.day_of_month || schedule.day_of_month,
                hourOfDay: updates.hour_of_day || schedule.hour_of_day,
                minuteOfHour: updates.minute_of_hour || schedule.minute_of_hour
            });
            setClauses.push('next_run_at = ?');
            values.push(nextRun.toISOString());
        }

        values.push(scheduleId);

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE management_report_schedules SET ${setClauses.join(', ')} WHERE id = ?`,
                values,
                (err) => err ? reject(err) : resolve()
            );
        });

        console.log(`[ScheduledReports] Updated schedule ${scheduleId}`);
    },

    /**
     * Delete a schedule
     * @param {string} scheduleId - Schedule ID
     */
    deleteSchedule: async (scheduleId) => {
        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM management_report_schedules WHERE id = ?`,
                [scheduleId],
                (err) => err ? reject(err) : resolve()
            );
        });
        console.log(`[ScheduledReports] Deleted schedule ${scheduleId}`);
    },

    /**
     * Get schedule by ID
     * @param {string} scheduleId - Schedule ID
     */
    getSchedule: async (scheduleId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM management_report_schedules WHERE id = ?`,
                [scheduleId],
                (err, row) => {
                    if (err) return reject(err);
                    if (row) {
                        row.recipients = JSON.parse(row.recipients || '[]');
                        row.options = JSON.parse(row.options || '{}');
                    }
                    resolve(row);
                }
            );
        });
    },

    /**
     * Get all schedules for an organization
     * @param {string} organizationId - Organization ID
     */
    getSchedules: async (organizationId, filters = {}) => {
        let query = `SELECT * FROM management_report_schedules WHERE organization_id = ?`;
        const params = [organizationId];

        if (filters.status) {
            query += ` AND status = ?`;
            params.push(filters.status);
        }

        if (filters.projectId) {
            query += ` AND project_id = ?`;
            params.push(filters.projectId);
        }

        query += ` ORDER BY next_run_at ASC`;

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve((rows || []).map(row => ({
                    ...row,
                    recipients: JSON.parse(row.recipients || '[]'),
                    options: JSON.parse(row.options || '{}')
                })));
            });
        });
    },

    /**
     * Process all due scheduled reports
     * Called by cron job every hour
     */
    processScheduledReports: async () => {
        const now = new Date();
        console.log(`[ScheduledReports] Processing due schedules at ${now.toISOString()}`);

        // Get all active schedules that are due
        const dueSchedules = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM management_report_schedules 
                 WHERE status = 'ACTIVE' AND next_run_at <= ?`,
                [now.toISOString()],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(row => ({
                        ...row,
                        recipients: JSON.parse(row.recipients || '[]'),
                        options: JSON.parse(row.options || '{}')
                    })));
                }
            );
        });

        console.log(`[ScheduledReports] Found ${dueSchedules.length} due schedule(s)`);

        const results = [];

        for (const schedule of dueSchedules) {
            try {
                await ScheduledReportsService._executeSchedule(schedule);
                results.push({ scheduleId: schedule.id, success: true });
            } catch (err) {
                console.error(`[ScheduledReports] Failed to execute schedule ${schedule.id}:`, err.message);
                results.push({ scheduleId: schedule.id, success: false, error: err.message });
                
                // Update schedule with error
                await new Promise((resolve) => {
                    db.run(
                        `UPDATE management_report_schedules SET last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                        [err.message, schedule.id],
                        () => resolve()
                    );
                });
            }
        }

        return {
            processed: dueSchedules.length,
            results
        };
    },

    /**
     * Execute a single schedule
     * @private
     */
    _executeSchedule: async (schedule) => {
        console.log(`[ScheduledReports] Executing schedule ${schedule.id} (${schedule.name})`);

        const reportOptions = {
            ...schedule.options,
            userId: schedule.created_by,
            aiEnhancement: schedule.options.aiEnhancement !== false
        };

        let report;

        // Generate report based on type and scope
        if (schedule.report_type === 'TEAM_MEETING') {
            if (schedule.scope === 'PORTFOLIO' || !schedule.project_id) {
                report = await ManagementReportsService.generatePortfolioTeamReport(
                    schedule.organization_id,
                    reportOptions
                );
            } else {
                report = await ManagementReportsService.generateTeamMeetingReport(
                    schedule.project_id,
                    reportOptions
                );
            }
        } else if (schedule.report_type === 'STEERING_COMMITTEE') {
            if (schedule.scope === 'PORTFOLIO' || !schedule.project_id) {
                report = await ManagementReportsService.generatePortfolioSteeringReport(
                    schedule.organization_id,
                    reportOptions
                );
            } else {
                report = await ManagementReportsService.generateSteeringCommitteeReport(
                    schedule.project_id,
                    reportOptions
                );
            }
        }

        if (!report) {
            throw new Error('Failed to generate report');
        }

        console.log(`[ScheduledReports] Generated report ${report.id}`);

        // Send email if recipients configured
        if (schedule.recipients && schedule.recipients.length > 0) {
            try {
                await ReportEmailService.sendReport(report.id, schedule.recipients, {
                    branding: schedule.options.branding
                });
                console.log(`[ScheduledReports] Sent report to ${schedule.recipients.length} recipient(s)`);
            } catch (emailErr) {
                console.error(`[ScheduledReports] Email sending failed:`, emailErr.message);
            }
        }

        // Update schedule
        const nextRunAt = schedule.frequency === FREQUENCIES.ONCE 
            ? null 
            : ScheduledReportsService._calculateNextRun({
                frequency: schedule.frequency,
                dayOfWeek: schedule.day_of_week,
                dayOfMonth: schedule.day_of_month,
                hourOfDay: schedule.hour_of_day,
                minuteOfHour: schedule.minute_of_hour
            });

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE management_report_schedules 
                 SET last_run_at = CURRENT_TIMESTAMP, 
                     next_run_at = ?, 
                     status = ?,
                     last_report_id = ?,
                     run_count = COALESCE(run_count, 0) + 1,
                     last_error = NULL,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    nextRunAt ? nextRunAt.toISOString() : null,
                    schedule.frequency === FREQUENCIES.ONCE ? 'COMPLETED' : 'ACTIVE',
                    report.id,
                    schedule.id
                ],
                (err) => err ? reject(err) : resolve()
            );
        });

        return report;
    },

    /**
     * Calculate next run time based on schedule configuration
     * @private
     */
    _calculateNextRun: ({ frequency, dayOfWeek, dayOfMonth, hourOfDay, minuteOfHour }) => {
        const now = new Date();
        let next = new Date(now);

        // Set time
        next.setHours(hourOfDay, minuteOfHour, 0, 0);

        // If already past today's scheduled time, start from tomorrow
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }

        switch (frequency) {
            case FREQUENCIES.DAILY:
                // Already set to next day if past
                break;

            case FREQUENCIES.WEEKLY:
                // Find next occurrence of dayOfWeek
                const targetDay = dayOfWeek || DAYS_OF_WEEK.MONDAY;
                while (next.getDay() !== targetDay) {
                    next.setDate(next.getDate() + 1);
                }
                break;

            case FREQUENCIES.BIWEEKLY:
                // Find next occurrence of dayOfWeek, then skip a week if needed
                const biweeklyTarget = dayOfWeek || DAYS_OF_WEEK.MONDAY;
                while (next.getDay() !== biweeklyTarget) {
                    next.setDate(next.getDate() + 1);
                }
                // Simple biweekly: based on week number
                const weekNum = Math.floor(next.getDate() / 7);
                if (weekNum % 2 !== 0) {
                    next.setDate(next.getDate() + 7);
                }
                break;

            case FREQUENCIES.MONTHLY:
                // Set to dayOfMonth
                const targetDayOfMonth = dayOfMonth || 1;
                next.setDate(targetDayOfMonth);
                if (next <= now) {
                    // Move to next month
                    next.setMonth(next.getMonth() + 1);
                }
                break;

            case FREQUENCIES.ONCE:
                // Already calculated - next available slot
                break;
        }

        return next;
    },

    /**
     * Run a schedule immediately (manual trigger)
     * @param {string} scheduleId - Schedule ID
     */
    runNow: async (scheduleId) => {
        const schedule = await ScheduledReportsService.getSchedule(scheduleId);
        if (!schedule) {
            throw new Error('Schedule not found');
        }

        console.log(`[ScheduledReports] Manual run for schedule ${scheduleId}`);
        return ScheduledReportsService._executeSchedule(schedule);
    },

    /**
     * Pause a schedule
     * @param {string} scheduleId - Schedule ID
     */
    pauseSchedule: async (scheduleId) => {
        await ScheduledReportsService.updateSchedule(scheduleId, { status: 'PAUSED' });
    },

    /**
     * Resume a paused schedule
     * @param {string} scheduleId - Schedule ID
     */
    resumeSchedule: async (scheduleId) => {
        const schedule = await ScheduledReportsService.getSchedule(scheduleId);
        if (!schedule) {
            throw new Error('Schedule not found');
        }

        const nextRun = ScheduledReportsService._calculateNextRun({
            frequency: schedule.frequency,
            dayOfWeek: schedule.day_of_week,
            dayOfMonth: schedule.day_of_month,
            hourOfDay: schedule.hour_of_day,
            minuteOfHour: schedule.minute_of_hour
        });

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE management_report_schedules 
                 SET status = 'ACTIVE', next_run_at = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [nextRun.toISOString(), scheduleId],
                (err) => err ? reject(err) : resolve()
            );
        });
    }
};

module.exports = ScheduledReportsService;






