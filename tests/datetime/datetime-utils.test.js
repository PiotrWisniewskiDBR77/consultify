/**
 * Date and Time Utilities Tests
 * Tests for date manipulation and formatting
 * 
 * @module tests/datetime/datetime-utils.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Date utilities
const createDateUtils = () => {
    return {
        now: () => new Date(),

        parse: (input) => {
            if (input instanceof Date) return input;
            if (typeof input === 'number') return new Date(input);
            return new Date(input);
        },

        format: (date, pattern) => {
            const d = new Date(date);
            const tokens = {
                YYYY: d.getFullYear(),
                MM: String(d.getMonth() + 1).padStart(2, '0'),
                DD: String(d.getDate()).padStart(2, '0'),
                HH: String(d.getHours()).padStart(2, '0'),
                mm: String(d.getMinutes()).padStart(2, '0'),
                ss: String(d.getSeconds()).padStart(2, '0'),
            };

            return pattern.replace(/YYYY|MM|DD|HH|mm|ss/g, match => tokens[match]);
        },

        add: (date, amount, unit) => {
            const d = new Date(date);
            switch (unit) {
                case 'seconds': d.setSeconds(d.getSeconds() + amount); break;
                case 'minutes': d.setMinutes(d.getMinutes() + amount); break;
                case 'hours': d.setHours(d.getHours() + amount); break;
                case 'days': d.setDate(d.getDate() + amount); break;
                case 'weeks': d.setDate(d.getDate() + amount * 7); break;
                case 'months': d.setMonth(d.getMonth() + amount); break;
                case 'years': d.setFullYear(d.getFullYear() + amount); break;
            }
            return d;
        },

        subtract: (date, amount, unit) => {
            return this.add(date, -amount, unit);
        },

        diff: (date1, date2, unit = 'days') => {
            const d1 = new Date(date1);
            const d2 = new Date(date2);
            const diffMs = d1.getTime() - d2.getTime();

            switch (unit) {
                case 'seconds': return Math.floor(diffMs / 1000);
                case 'minutes': return Math.floor(diffMs / (1000 * 60));
                case 'hours': return Math.floor(diffMs / (1000 * 60 * 60));
                case 'days': return Math.floor(diffMs / (1000 * 60 * 60 * 24));
                case 'weeks': return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
                default: return diffMs;
            }
        },

        startOf: (date, unit) => {
            const d = new Date(date);
            switch (unit) {
                case 'day':
                    d.setHours(0, 0, 0, 0);
                    break;
                case 'week':
                    d.setDate(d.getDate() - d.getDay());
                    d.setHours(0, 0, 0, 0);
                    break;
                case 'month':
                    d.setDate(1);
                    d.setHours(0, 0, 0, 0);
                    break;
                case 'year':
                    d.setMonth(0, 1);
                    d.setHours(0, 0, 0, 0);
                    break;
            }
            return d;
        },

        endOf: (date, unit) => {
            const d = new Date(date);
            switch (unit) {
                case 'day':
                    d.setHours(23, 59, 59, 999);
                    break;
                case 'week':
                    d.setDate(d.getDate() + (6 - d.getDay()));
                    d.setHours(23, 59, 59, 999);
                    break;
                case 'month':
                    d.setMonth(d.getMonth() + 1, 0);
                    d.setHours(23, 59, 59, 999);
                    break;
                case 'year':
                    d.setMonth(11, 31);
                    d.setHours(23, 59, 59, 999);
                    break;
            }
            return d;
        },

        isBefore: (date1, date2) => new Date(date1) < new Date(date2),

        isAfter: (date1, date2) => new Date(date1) > new Date(date2),

        isSame: (date1, date2, unit = 'day') => {
            const d1 = this.startOf(date1, unit);
            const d2 = this.startOf(date2, unit);
            return d1.getTime() === d2.getTime();
        },

        isToday: (date) => this.isSame(date, new Date(), 'day'),

        isWeekend: (date) => {
            const day = new Date(date).getDay();
            return day === 0 || day === 6;
        },
    };
};

// Time zone utilities
const createTimezoneUtils = () => {
    return {
        getOffset: (timezone, date = new Date()) => {
            const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
            const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
            return (tzDate - utcDate) / (1000 * 60);
        },

        convert: (date, fromTz, toTz) => {
            const fromOffset = this.getOffset(fromTz, date);
            const toOffset = this.getOffset(toTz, date);
            const diffMinutes = toOffset - fromOffset;

            return new Date(date.getTime() + diffMinutes * 60 * 1000);
        },

        formatInTimezone: (date, timezone, options = {}) => {
            return new Intl.DateTimeFormat('en-US', {
                ...options,
                timeZone: timezone,
            }).format(date);
        },
    };
};

// Duration utilities
const createDurationUtils = () => {
    return {
        parse: (duration) => {
            // Parse ISO 8601 duration or simple formats
            const match = duration.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
            if (!match) return null;

            return {
                days: parseInt(match[1] || 0),
                hours: parseInt(match[2] || 0),
                minutes: parseInt(match[3] || 0),
                seconds: parseInt(match[4] || 0),
            };
        },

        toMilliseconds: (duration) => {
            const parsed = typeof duration === 'string' ? this.parse(duration) : duration;
            if (!parsed) return 0;

            return (
                parsed.days * 24 * 60 * 60 * 1000 +
                parsed.hours * 60 * 60 * 1000 +
                parsed.minutes * 60 * 1000 +
                parsed.seconds * 1000
            );
        },

        fromMilliseconds: (ms) => {
            const seconds = Math.floor(ms / 1000) % 60;
            const minutes = Math.floor(ms / (1000 * 60)) % 60;
            const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
            const days = Math.floor(ms / (1000 * 60 * 60 * 24));

            return { days, hours, minutes, seconds };
        },

        format: (duration) => {
            const d = typeof duration === 'number' ? this.fromMilliseconds(duration) : duration;
            const parts = [];

            if (d.days) parts.push(`${d.days}d`);
            if (d.hours) parts.push(`${d.hours}h`);
            if (d.minutes) parts.push(`${d.minutes}m`);
            if (d.seconds || parts.length === 0) parts.push(`${d.seconds}s`);

            return parts.join(' ');
        },

        humanize: (ms) => {
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
            if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
            if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
            return `${seconds} second${seconds !== 1 ? 's' : ''}`;
        },
    };
};

// Relative time formatter
const createRelativeTime = () => {
    const SECOND = 1000;
    const MINUTE = 60 * SECOND;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;
    const WEEK = 7 * DAY;
    const MONTH = 30 * DAY;
    const YEAR = 365 * DAY;

    return {
        format: (date, baseDate = new Date()) => {
            const diff = new Date(date) - new Date(baseDate);
            const absDiff = Math.abs(diff);
            const isPast = diff < 0;

            let value, unit;

            if (absDiff < MINUTE) {
                return 'just now';
            } else if (absDiff < HOUR) {
                value = Math.floor(absDiff / MINUTE);
                unit = 'minute';
            } else if (absDiff < DAY) {
                value = Math.floor(absDiff / HOUR);
                unit = 'hour';
            } else if (absDiff < WEEK) {
                value = Math.floor(absDiff / DAY);
                unit = 'day';
            } else if (absDiff < MONTH) {
                value = Math.floor(absDiff / WEEK);
                unit = 'week';
            } else if (absDiff < YEAR) {
                value = Math.floor(absDiff / MONTH);
                unit = 'month';
            } else {
                value = Math.floor(absDiff / YEAR);
                unit = 'year';
            }

            const plural = value !== 1 ? 's' : '';
            return isPast ? `${value} ${unit}${plural} ago` : `in ${value} ${unit}${plural}`;
        },
    };
};

describe('Date Utils Tests', () => {
    let dateUtils;

    beforeEach(() => {
        dateUtils = createDateUtils();
    });

    it('should format date', () => {
        const date = new Date('2024-03-15T10:30:45');

        expect(dateUtils.format(date, 'YYYY-MM-DD')).toBe('2024-03-15');
        expect(dateUtils.format(date, 'HH:mm:ss')).toBe('10:30:45');
    });

    it('should add time', () => {
        const date = new Date('2024-01-15');
        const result = dateUtils.add(date, 5, 'days');

        expect(result.getDate()).toBe(20);
    });

    it('should calculate diff', () => {
        const date1 = new Date('2024-01-15');
        const date2 = new Date('2024-01-10');

        expect(dateUtils.diff(date1, date2, 'days')).toBe(5);
    });

    it('should get start of day', () => {
        const date = new Date('2024-03-15T10:30:45');
        const start = dateUtils.startOf(date, 'day');

        expect(start.getHours()).toBe(0);
        expect(start.getMinutes()).toBe(0);
    });

    it('should compare dates', () => {
        const date1 = new Date('2024-01-15');
        const date2 = new Date('2024-01-20');

        expect(dateUtils.isBefore(date1, date2)).toBe(true);
        expect(dateUtils.isAfter(date2, date1)).toBe(true);
    });

    it('should check weekend', () => {
        const saturday = new Date('2024-03-16'); // Saturday
        const monday = new Date('2024-03-18'); // Monday

        expect(dateUtils.isWeekend(saturday)).toBe(true);
        expect(dateUtils.isWeekend(monday)).toBe(false);
    });
});

describe('Duration Utils Tests', () => {
    let durationUtils;

    beforeEach(() => {
        durationUtils = createDurationUtils();
    });

    it('should parse ISO duration', () => {
        const duration = durationUtils.parse('P1DT2H30M15S');

        expect(duration.days).toBe(1);
        expect(duration.hours).toBe(2);
        expect(duration.minutes).toBe(30);
        expect(duration.seconds).toBe(15);
    });

    it('should convert to milliseconds', () => {
        const ms = durationUtils.toMilliseconds({ hours: 1, minutes: 30 });

        expect(ms).toBe(90 * 60 * 1000);
    });

    it('should format duration', () => {
        const formatted = durationUtils.format({ days: 1, hours: 2, minutes: 30 });

        expect(formatted).toBe('1d 2h 30m');
    });

    it('should humanize duration', () => {
        expect(durationUtils.humanize(3600000)).toBe('1 hour');
        expect(durationUtils.humanize(7200000)).toBe('2 hours');
        expect(durationUtils.humanize(60000)).toBe('1 minute');
    });
});

describe('Relative Time Tests', () => {
    let relativeTime;

    beforeEach(() => {
        relativeTime = createRelativeTime();
    });

    it('should format past time', () => {
        const now = new Date();
        const past = new Date(now.getTime() - 2 * 60 * 60 * 1000);

        expect(relativeTime.format(past, now)).toBe('2 hours ago');
    });

    it('should format future time', () => {
        const now = new Date();
        const future = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        expect(relativeTime.format(future, now)).toBe('in 3 days');
    });

    it('should format just now', () => {
        const now = new Date();
        const recent = new Date(now.getTime() - 30 * 1000);

        expect(relativeTime.format(recent, now)).toBe('just now');
    });
});
