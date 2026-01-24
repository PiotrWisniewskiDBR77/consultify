/**
 * Tours Index
 *
 * Exports all tour configurations for the application.
 */

export * from './types';

import { ADMIN_SETUP_TOUR } from './adminSetupTour';
import { AI_TOOLS_TOUR } from './aiToolsTour';
import { ASSESSMENT_TOUR } from './assessmentTour';
import { INITIATIVE_TOUR } from './initiativeTour';
import { REPORT_TOUR } from './reportTour';
import { ROADMAP_TOUR } from './roadmapTour';
import { SUPERADMIN_TOUR } from './superadminTour';
import { TourConfig } from './types';

// Export all tours
export {
  ADMIN_SETUP_TOUR,
  AI_TOOLS_TOUR,
  ASSESSMENT_TOUR,
  INITIATIVE_TOUR,
  REPORT_TOUR,
  ROADMAP_TOUR,
  SUPERADMIN_TOUR,
};

// All tours registry
export const ALL_TOURS: Record<string, TourConfig> = {
  'assessment-flow': ASSESSMENT_TOUR,
  'initiative-creation': INITIATIVE_TOUR,
  'roadmap-building': ROADMAP_TOUR,
  'admin-setup': ADMIN_SETUP_TOUR,
  'superadmin-onboarding': SUPERADMIN_TOUR,
  'report-generation': REPORT_TOUR,
  'ai-tools': AI_TOOLS_TOUR,
};

// Get tour by ID
export function getTour(tourId: string): TourConfig | undefined {
  return ALL_TOURS[tourId];
}

// Get tours for a specific user role
export function getToursForRole(role: string): TourConfig[] {
  return Object.values(ALL_TOURS).filter((tour) => tour.targetAudience.includes(role as any));
}

// Get tours that should auto-start
export function getAutoStartTours(): TourConfig[] {
  return Object.values(ALL_TOURS).filter((tour) => tour.autoStart);
}

// Get tours for first visit
export function getFirstVisitTours(): TourConfig[] {
  return Object.values(ALL_TOURS).filter((tour) => tour.showOnFirstVisit);
}
