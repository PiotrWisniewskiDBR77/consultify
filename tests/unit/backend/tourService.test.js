/**
 * Tour Service Unit Tests
 * 
 * Tests for product tour and feature discovery management.
 * 
 * @module tests/unit/backend/tourService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create tour service implementation
const createTourService = () => {
    const tours = new Map();
    const userProgress = new Map();
    const tourSteps = new Map();

    return {
        // Create a tour
        createTour: async (data) => {
            if (!data.id || !data.name) throw new Error('ID and name required');

            const tour = {
                id: data.id,
                name: data.name,
                description: data.description || '',
                targetPage: data.targetPage || '*',
                triggerCondition: data.triggerCondition || 'first_visit',
                priority: data.priority || 0,
                active: true,
                createdAt: new Date().toISOString()
            };

            tours.set(data.id, tour);
            tourSteps.set(data.id, []);
            return tour;
        },

        // Add step to tour
        addStep: async (tourId, step) => {
            const tour = tours.get(tourId);
            if (!tour) throw new Error('Tour not found');

            const steps = tourSteps.get(tourId) || [];
            const newStep = {
                id: `step-${steps.length + 1}`,
                tourId,
                order: steps.length + 1,
                target: step.target,
                title: step.title,
                content: step.content,
                placement: step.placement || 'bottom',
                action: step.action || 'next',
                highlight: step.highlight ?? true
            };

            steps.push(newStep);
            tourSteps.set(tourId, steps);
            return newStep;
        },

        // Get tour with steps
        getTour: async (tourId) => {
            const tour = tours.get(tourId);
            if (!tour) return null;

            return {
                ...tour,
                steps: tourSteps.get(tourId) || []
            };
        },

        // Get active tours for page
        getToursForPage: async (page, userId) => {
            const progress = userProgress.get(userId) || { completed: [], dismissed: [] };

            return Array.from(tours.values())
                .filter(t => {
                    if (!t.active) return false;
                    if (progress.completed.includes(t.id)) return false;
                    if (progress.dismissed.includes(t.id)) return false;
                    return t.targetPage === '*' || t.targetPage === page;
                })
                .sort((a, b) => b.priority - a.priority);
        },

        // Start tour for user
        startTour: async (tourId, userId) => {
            const tour = tours.get(tourId);
            if (!tour) throw new Error('Tour not found');

            const key = `${userId}:${tourId}`;
            const session = {
                tourId,
                userId,
                currentStep: 1,
                startedAt: new Date().toISOString(),
                completed: false
            };

            userProgress.set(key, session);
            return session;
        },

        // Advance to next step
        nextStep: async (tourId, userId) => {
            const key = `${userId}:${tourId}`;
            const session = userProgress.get(key);
            if (!session) throw new Error('Tour session not found');

            const steps = tourSteps.get(tourId) || [];

            if (session.currentStep >= steps.length) {
                // Tour complete
                session.completed = true;
                session.completedAt = new Date().toISOString();

                // Mark in user progress
                const progress = userProgress.get(userId) || { completed: [], dismissed: [] };
                progress.completed.push(tourId);
                userProgress.set(userId, progress);
            } else {
                session.currentStep++;
            }

            userProgress.set(key, session);
            return session;
        },

        // Skip/dismiss tour
        dismissTour: async (tourId, userId) => {
            const progress = userProgress.get(userId) || { completed: [], dismissed: [] };
            if (!progress.dismissed.includes(tourId)) {
                progress.dismissed.push(tourId);
            }
            userProgress.set(userId, progress);
            return true;
        },

        // Complete tour
        completeTour: async (tourId, userId) => {
            const progress = userProgress.get(userId) || { completed: [], dismissed: [] };
            if (!progress.completed.includes(tourId)) {
                progress.completed.push(tourId);
            }
            userProgress.set(userId, progress);
            return true;
        },

        // Get user's tour history
        getUserProgress: async (userId) => {
            return userProgress.get(userId) || { completed: [], dismissed: [] };
        },

        // Reset user's tour progress (for testing/debugging)
        resetUserProgress: async (userId) => {
            userProgress.delete(userId);
            return true;
        },

        // Deactivate tour
        deactivateTour: async (tourId) => {
            const tour = tours.get(tourId);
            if (!tour) throw new Error('Tour not found');

            tour.active = false;
            tours.set(tourId, tour);
            return tour;
        },

        // Clear for testing
        clear: () => {
            tours.clear();
            userProgress.clear();
            tourSteps.clear();
        }
    };
};

describe('TourService', () => {
    let tourService;

    beforeEach(() => {
        tourService = createTourService();
    });

    describe('Tour Creation', () => {
        it('should create a tour', async () => {
            const tour = await tourService.createTour({
                id: 'welcome-tour',
                name: 'Welcome Tour',
                description: 'Intro to the platform',
                targetPage: '/dashboard'
            });

            expect(tour.id).toBe('welcome-tour');
            expect(tour.active).toBe(true);
        });

        it('should require ID and name', async () => {
            await expect(tourService.createTour({}))
                .rejects.toThrow('ID and name required');
        });
    });

    describe('Tour Steps', () => {
        it('should add steps to tour', async () => {
            await tourService.createTour({ id: 'test-tour', name: 'Test' });

            await tourService.addStep('test-tour', {
                target: '#sidebar',
                title: 'Navigation',
                content: 'Use the sidebar to navigate'
            });

            await tourService.addStep('test-tour', {
                target: '#create-btn',
                title: 'Create Project',
                content: 'Click here to create a new project'
            });

            const tour = await tourService.getTour('test-tour');

            expect(tour.steps).toHaveLength(2);
            expect(tour.steps[0].order).toBe(1);
            expect(tour.steps[1].order).toBe(2);
        });
    });

    describe('Tour Discovery', () => {
        beforeEach(async () => {
            await tourService.createTour({
                id: 'dashboard-tour',
                name: 'Dashboard',
                targetPage: '/dashboard',
                priority: 10
            });
            await tourService.createTour({
                id: 'projects-tour',
                name: 'Projects',
                targetPage: '/projects',
                priority: 5
            });
            await tourService.createTour({
                id: 'global-tour',
                name: 'Global',
                targetPage: '*',
                priority: 1
            });
        });

        it('should get tours for specific page', async () => {
            const tours = await tourService.getToursForPage('/dashboard', 'user-1');

            expect(tours.some(t => t.id === 'dashboard-tour')).toBe(true);
            expect(tours.some(t => t.id === 'global-tour')).toBe(true);
            expect(tours.some(t => t.id === 'projects-tour')).toBe(false);
        });

        it('should sort by priority', async () => {
            const tours = await tourService.getToursForPage('/dashboard', 'user-1');

            expect(tours[0].id).toBe('dashboard-tour'); // priority 10
            expect(tours[1].id).toBe('global-tour'); // priority 1
        });

        it('should exclude completed tours', async () => {
            await tourService.completeTour('dashboard-tour', 'user-1');

            const tours = await tourService.getToursForPage('/dashboard', 'user-1');

            expect(tours.some(t => t.id === 'dashboard-tour')).toBe(false);
        });

        it('should exclude dismissed tours', async () => {
            await tourService.dismissTour('global-tour', 'user-1');

            const tours = await tourService.getToursForPage('/dashboard', 'user-1');

            expect(tours.some(t => t.id === 'global-tour')).toBe(false);
        });
    });

    describe('Tour Progress', () => {
        beforeEach(async () => {
            await tourService.createTour({ id: 'multi-step', name: 'Multi Step' });
            await tourService.addStep('multi-step', { target: '#a', title: 'A', content: 'Step A' });
            await tourService.addStep('multi-step', { target: '#b', title: 'B', content: 'Step B' });
            await tourService.addStep('multi-step', { target: '#c', title: 'C', content: 'Step C' });
        });

        it('should track tour progress', async () => {
            const session = await tourService.startTour('multi-step', 'user-1');

            expect(session.currentStep).toBe(1);
            expect(session.completed).toBe(false);
        });

        it('should advance through steps', async () => {
            await tourService.startTour('multi-step', 'user-1');

            let session = await tourService.nextStep('multi-step', 'user-1');
            expect(session.currentStep).toBe(2);

            session = await tourService.nextStep('multi-step', 'user-1');
            expect(session.currentStep).toBe(3);
        });

        it('should complete tour after last step', async () => {
            await tourService.startTour('multi-step', 'user-1');

            await tourService.nextStep('multi-step', 'user-1');
            await tourService.nextStep('multi-step', 'user-1');
            const session = await tourService.nextStep('multi-step', 'user-1');

            expect(session.completed).toBe(true);
            expect(session.completedAt).toBeDefined();
        });
    });

    describe('User Progress', () => {
        it('should track completed and dismissed tours', async () => {
            await tourService.createTour({ id: 'tour-1', name: 'Tour 1' });
            await tourService.createTour({ id: 'tour-2', name: 'Tour 2' });
            await tourService.createTour({ id: 'tour-3', name: 'Tour 3' });

            await tourService.completeTour('tour-1', 'user-1');
            await tourService.dismissTour('tour-2', 'user-1');

            const progress = await tourService.getUserProgress('user-1');

            expect(progress.completed).toContain('tour-1');
            expect(progress.dismissed).toContain('tour-2');
        });

        it('should reset user progress', async () => {
            await tourService.createTour({ id: 'tour-1', name: 'Tour 1' });
            await tourService.completeTour('tour-1', 'user-1');

            await tourService.resetUserProgress('user-1');

            const progress = await tourService.getUserProgress('user-1');
            expect(progress.completed).toHaveLength(0);
        });
    });
});
