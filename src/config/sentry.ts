// Sentry configuration
// Error tracking integration — configure SENTRY_DSN env variable to enable

export const initSentry = () => {
  // Sentry initialization will be added here when needed
  if (process.env.NODE_ENV === 'production') {
    // Initialize Sentry in production
  }
};
