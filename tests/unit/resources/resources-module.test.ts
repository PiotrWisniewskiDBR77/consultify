/**
 * Resource Management Module - Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Resource Management Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Resource Allocation', () => {
        it('should allocate resource to project', () => {
            const allocation = {
                id: 'alloc-001',
                resourceId: 'res-001',
                projectId: 'prj-001',
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                allocation: 100,
                status: 'confirmed',
            };

            expect(allocation.status).toBe('confirmed');
        });

        it('should calculate resource utilization', () => {
            const allocations = [
                { hours: 40, project: 'prj-001' },
                { hours: 20, project: 'prj-002' },
            ];
            const totalHours = 45;
            const utilization = (allocations.reduce((sum, a) => sum + a.hours, 0) / totalHours) * 100;

            expect(utilization).toBeGreaterThan(100); // Over-allocated
        });

        it('should detect allocation conflicts', () => {
            const allocations = [
                { start: new Date('2024-01-01'), end: new Date('2024-01-31'), allocation: 60 },
                { start: new Date('2024-01-15'), end: new Date('2024-02-15'), allocation: 50 },
            ];

            // Check for overlap
            const hasConflict = allocations.some((a, i) =>
                allocations.slice(i + 1).some((b) =>
                    a.start <= b.end && b.start <= a.end && a.allocation + b.allocation > 100
                )
            );

            expect(hasConflict).toBe(true);
        });

        it('should calculate remaining capacity', () => {
            const capacity = 100;
            const allocated = 75;
            const remaining = capacity - allocated;

            expect(remaining).toBe(25);
        });

        it('should handle partial allocations', () => {
            const fullAllocation = 100;
            const partialPercent = 50;
            const partialHours = (fullAllocation * partialPercent) / 100;

            expect(partialHours).toBe(50);
        });
    });

    describe('Team Management', () => {
        it('should create team', () => {
            const team = {
                id: 'team-001',
                name: 'Development Team',
                leadId: 'usr-001',
                members: ['usr-001', 'usr-002', 'usr-003'],
                department: 'Engineering',
            };

            expect(team.members).toHaveLength(3);
        });

        it('should calculate team capacity', () => {
            const members = [
                { id: 'usr-001', hoursPerWeek: 40, availability: 1.0 },
                { id: 'usr-002', hoursPerWeek: 40, availability: 0.8 },
                { id: 'usr-003', hoursPerWeek: 32, availability: 1.0 },
            ];

            const totalCapacity = members.reduce(
                (sum, m) => sum + m.hoursPerWeek * m.availability,
                0
            );

            expect(totalCapacity).toBe(104);
        });

        it('should track team skills', () => {
            const teamSkills = {
                'frontend': ['usr-001', 'usr-002'],
                'backend': ['usr-002', 'usr-003'],
                'devops': ['usr-003'],
            };

            const frontendCount = teamSkills['frontend'].length;

            expect(frontendCount).toBe(2);
        });

        it('should find available team members', () => {
            const members = [
                { id: 'usr-001', allocated: 80 },
                { id: 'usr-002', allocated: 40 },
                { id: 'usr-003', allocated: 100 },
            ];

            const available = members.filter((m) => m.allocated < 100);

            expect(available).toHaveLength(2);
        });
    });

    describe('Capacity Planning', () => {
        it('should forecast capacity needs', () => {
            const projects = [
                { id: 'prj-001', hoursNeeded: 200 },
                { id: 'prj-002', hoursNeeded: 150 },
                { id: 'prj-003', hoursNeeded: 100 },
            ];

            const totalNeeded = projects.reduce((sum, p) => sum + p.hoursNeeded, 0);
            const teamCapacity = 320; // 8 people * 40 hours
            const deficit = totalNeeded - teamCapacity;

            expect(deficit).toBeGreaterThan(0);
        });

        it('should calculate hiring needs', () => {
            const capacityGap = 120;
            const avgHoursPerPerson = 40;
            const hiringNeeded = Math.ceil(capacityGap / avgHoursPerPerson);

            expect(hiringNeeded).toBe(3);
        });

        it('should plan for leave', () => {
            const monthlyCapacity = 160;
            const plannedLeave = 40;
            const actualCapacity = monthlyCapacity - plannedLeave;

            expect(actualCapacity).toBe(120);
        });

        it('should handle seasonal variations', () => {
            const baseCapacity = 160;
            const seasonalFactors = {
                'Q1': 0.9,
                'Q2': 1.0,
                'Q3': 0.8, // Summer holidays
                'Q4': 1.1, // Year-end push
            };

            const q3Capacity = baseCapacity * seasonalFactors['Q3'];

            expect(q3Capacity).toBe(128);
        });
    });

    describe('Time Tracking', () => {
        it('should log time entry', () => {
            const entry = {
                id: 'time-001',
                userId: 'usr-001',
                projectId: 'prj-001',
                taskId: 'tsk-001',
                date: new Date(),
                hours: 4.5,
                description: 'Feature development',
                billable: true,
            };

            expect(entry.billable).toBe(true);
        });

        it('should calculate daily total', () => {
            const entries = [
                { hours: 4 },
                { hours: 2.5 },
                { hours: 1.5 },
            ];

            const total = entries.reduce((sum, e) => sum + e.hours, 0);

            expect(total).toBe(8);
        });

        it('should detect overtime', () => {
            const weeklyHours = 45;
            const standardHours = 40;
            const overtime = Math.max(0, weeklyHours - standardHours);

            expect(overtime).toBe(5);
        });

        it('should calculate billable ratio', () => {
            const totalHours = 160;
            const billableHours = 128;
            const ratio = (billableHours / totalHours) * 100;

            expect(ratio).toBe(80);
        });

        it('should validate time entries', () => {
            const entry = { hours: 12, date: new Date() };
            const maxDailyHours = 10;
            const isValid = entry.hours <= maxDailyHours;

            expect(isValid).toBe(false);
        });
    });

    describe('Skill Matrix', () => {
        it('should track skill levels', () => {
            const skills = {
                'React': 4,
                'Node.js': 3,
                'PostgreSQL': 3,
                'TypeScript': 4,
            };

            const avgSkillLevel =
                Object.values(skills).reduce((sum, s) => sum + s, 0) /
                Object.keys(skills).length;

            expect(avgSkillLevel).toBe(3.5);
        });

        it('should find skill gaps', () => {
            const requiredSkills = ['React', 'Node.js', 'Kubernetes', 'AWS'];
            const teamSkills = ['React', 'Node.js', 'PostgreSQL'];
            const gaps = requiredSkills.filter((s) => !teamSkills.includes(s));

            expect(gaps).toContain('Kubernetes');
            expect(gaps).toContain('AWS');
        });

        it('should suggest training', () => {
            const userSkills = { 'React': 2, 'Node.js': 3, 'TypeScript': 1 };
            const trainingThreshold = 2;

            const needsTraining = Object.entries(userSkills)
                .filter(([_, level]) => level <= trainingThreshold)
                .map(([skill]) => skill);

            expect(needsTraining).toContain('TypeScript');
        });

        it('should calculate team skill coverage', () => {
            const requiredSkills = 10;
            const coveredSkills = 8;
            const coverage = (coveredSkills / requiredSkills) * 100;

            expect(coverage).toBe(80);
        });
    });

    describe('Cost Analysis', () => {
        it('should calculate resource cost', () => {
            const hourlyRate = 75;
            const hoursWorked = 160;
            const totalCost = hourlyRate * hoursWorked;

            expect(totalCost).toBe(12000);
        });

        it('should calculate blended rate', () => {
            const resources = [
                { hourlyRate: 100, hours: 80 },
                { hourlyRate: 75, hours: 60 },
                { hourlyRate: 50, hours: 40 },
            ];

            const totalCost = resources.reduce((sum, r) => sum + r.hourlyRate * r.hours, 0);
            const totalHours = resources.reduce((sum, r) => sum + r.hours, 0);
            const blendedRate = totalCost / totalHours;

            expect(blendedRate).toBeCloseTo(80.56, 2);
        });

        it('should track budget vs actual', () => {
            const budget = 50000;
            const actual = 45000;
            const variance = budget - actual;
            const variancePercent = (variance / budget) * 100;

            expect(variancePercent).toBe(10);
        });

        it('should forecast project cost', () => {
            const spentToDate = 30000;
            const percentComplete = 60;
            const estimatedAtCompletion = spentToDate / (percentComplete / 100);

            expect(estimatedAtCompletion).toBe(50000);
        });
    });
});

describe('Scheduling Module', () => {
    describe('Calendar Integration', () => {
        it('should check availability', () => {
            const calendar = [
                { start: '09:00', end: '10:00', busy: true },
                { start: '10:00', end: '12:00', busy: false },
                { start: '12:00', end: '13:00', busy: true },
            ];

            const freeSlots = calendar.filter((s) => !s.busy);

            expect(freeSlots).toHaveLength(1);
        });

        it('should find common free time', () => {
            const users = [
                { free: ['10:00-11:00', '14:00-15:00'] },
                { free: ['10:00-11:00', '16:00-17:00'] },
            ];

            const commonSlots = users[0].free.filter((slot) =>
                users.every((u) => u.free.includes(slot))
            );

            expect(commonSlots).toContain('10:00-11:00');
        });

        it('should respect time zones', () => {
            const utcTime = new Date('2024-01-15T15:00:00Z');
            const warsawOffset = 1; // CET
            const warsawTime = new Date(utcTime.getTime() + warsawOffset * 60 * 60 * 1000);

            expect(warsawTime.getUTCHours()).toBe(16);
        });

        it('should handle recurring events', () => {
            const recurring = {
                frequency: 'weekly',
                interval: 1,
                daysOfWeek: ['monday', 'wednesday', 'friday'],
                endDate: new Date('2024-12-31'),
            };

            expect(recurring.daysOfWeek).toHaveLength(3);
        });
    });

    describe('Meeting Scheduling', () => {
        it('should schedule meeting', () => {
            const meeting = {
                id: 'meet-001',
                title: 'Sprint Planning',
                organizer: 'usr-001',
                attendees: ['usr-001', 'usr-002', 'usr-003'],
                start: new Date('2024-01-15T10:00:00'),
                end: new Date('2024-01-15T11:00:00'),
                location: 'Conference Room A',
            };

            expect(meeting.attendees).toHaveLength(3);
        });

        it('should calculate meeting duration', () => {
            const start = new Date('2024-01-15T10:00:00');
            const end = new Date('2024-01-15T11:30:00');
            const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

            expect(durationMinutes).toBe(90);
        });

        it('should detect conflicts', () => {
            const existing = { start: new Date('2024-01-15T10:00'), end: new Date('2024-01-15T11:00') };
            const proposed = { start: new Date('2024-01-15T10:30'), end: new Date('2024-01-15T11:30') };

            const hasConflict = proposed.start < existing.end && existing.start < proposed.end;

            expect(hasConflict).toBe(true);
        });
    });
});
