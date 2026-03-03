export type LandingFilmId = 'film1' | 'film2' | 'film3' | 'film4' | 'film5' | 'film6';

export interface LandingFilm {
  id: LandingFilmId;
  /** i18n key for title */
  titleKey: string;
  /** i18n key for short description */
  descriptionKey: string;
  /** Public teaser (15–25s) */
  teaserUrl: string;
  /** Full version (login-gated in UI, except Film 1 modal on homepage) */
  fullUrl: string;
  /** Duration label for UI (e.g. "20s", "87s") */
  durationLabel: string;
}

// NOTE: URLs intentionally point to /videos/* (served as static assets in production).
// This code does not enforce auth; gating is handled in the UI (login CTA).
export const LANDING_FILMS: Record<LandingFilmId, LandingFilm> = {
  film1: {
    id: 'film1',
    titleKey: 'landing.films.film1.title',
    descriptionKey: 'landing.films.film1.description',
    teaserUrl: '/videos/teasers/film1-hero.mp4',
    fullUrl: '/videos/full/film1-hero-87s.mp4',
    durationLabel: '87s',
  },
  film2: {
    id: 'film2',
    titleKey: 'landing.films.film2.title',
    descriptionKey: 'landing.films.film2.description',
    teaserUrl: '/videos/teasers/film2-how-it-works-20s.mp4',
    fullUrl: '/videos/full/film2-how-it-works.mp4',
    durationLabel: '20s',
  },
  film3: {
    id: 'film3',
    titleKey: 'landing.films.film3.title',
    descriptionKey: 'landing.films.film3.description',
    teaserUrl: '/videos/teasers/film3-consulting-firms.mp4',
    fullUrl: '/videos/full/film3-consulting-firms.mp4',
    durationLabel: '45s',
  },
  film4: {
    id: 'film4',
    titleKey: 'landing.films.film4.title',
    descriptionKey: 'landing.films.film4.description',
    teaserUrl: '/videos/teasers/film4-results.mp4',
    fullUrl: '/videos/full/film4-results.mp4',
    durationLabel: '30s',
  },
  film5: {
    id: 'film5',
    titleKey: 'landing.films.film5.title',
    descriptionKey: 'landing.films.film5.description',
    teaserUrl: '/videos/teasers/film5.mp4',
    fullUrl: '/videos/full/film5.mp4',
    durationLabel: '20s',
  },
  film6: {
    id: 'film6',
    titleKey: 'landing.films.film6.title',
    descriptionKey: 'landing.films.film6.description',
    teaserUrl: '/videos/teasers/film6.mp4',
    fullUrl: '/videos/full/film6.mp4',
    durationLabel: '20s',
  },
};

