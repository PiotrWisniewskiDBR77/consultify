/**
 * StoryRail stops — the single "Full story" tour of the Atelier Forward
 * transformation (docs/demo/DEMO_JOURNEY_REDESIGN.md, decision D3: one path).
 *
 * Each stop is a REAL route with REAL seeded data behind it — the rail
 * narrates the same golden path a live presenter walks (see
 * docs/demo/ATELIER_CLIENT_DEMO_RUNSHEET.md). No fake scenarios, no slides.
 */

export interface StoryRailStop {
  id: string;
  route: string;
  /** Short label shown in the rail. */
  title: string;
  /** One-line narration for the stop — the thing a presenter would say. */
  blurb: string;
}

export const STORY_RAIL_STOPS: StoryRailStop[] = [
  {
    id: 'organization',
    route: '/organization',
    title: 'Organization',
    blurb: 'Every insight is grounded in a living profile of the business.',
  },
  {
    id: 'insights',
    route: '/interview',
    title: 'Discovery',
    blurb: 'Five discovery interviews became four consultant-grade insights.',
  },
  {
    id: 'assessment',
    route: '/assessment/drd',
    title: 'DRD Assessment',
    blurb: 'A scored diagnosis: digital maturity 3.3 / 5 with real gaps.',
  },
  {
    id: 'tools',
    route: '/discovery-tools',
    title: 'Strategy Tools',
    blurb: 'Dynamic SWOT and Porter — completed, evidenced, approved.',
  },
  {
    id: 'initiatives',
    route: '/initiatives',
    title: 'Initiatives',
    blurb: '22 governed initiatives with owners, ROI and a real Gantt.',
  },
  {
    id: 'execution',
    route: '/execution',
    title: 'Execution',
    blurb: 'Delivery in motion: rollout KPIs and weekly status reports.',
  },
  {
    id: 'results',
    route: '/benefits',
    title: 'Results & Value',
    blurb: '€1.4M banked — 194% of target, reconciled to a confirmed P&L.',
  },
  {
    id: 'materials',
    route: '/presentations',
    title: 'Materials',
    blurb: 'Board-ready decks and reports generated from the same living data.',
  },
];

/** Permanent dismissal — one ✕ means the rail never auto-opens again. */
export const STORY_RAIL_DISMISSED_KEY = 'demo_story_rail_dismissed';
/** Last visited stop index, so a reload resumes instead of restarting. */
export const STORY_RAIL_STOP_KEY = 'demo_story_rail_stop';
/** Set after the first navigation — the rail remounts on every route change,
 * so "has the tour started" must survive the remount. */
export const STORY_RAIL_STARTED_KEY = 'demo_story_rail_started';
