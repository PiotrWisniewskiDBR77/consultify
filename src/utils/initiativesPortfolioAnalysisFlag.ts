type InitiativesPortfolioAnalysisEnv = { VITE_INITIATIVES_PORTFOLIO_ANALYSIS?: string };

/** Release gate for Wave 2 portfolio analysis and canonical card estimates. Default is OFF. */
export const isInitiativesPortfolioAnalysisEnabled = (
  env: InitiativesPortfolioAnalysisEnv = import.meta.env as InitiativesPortfolioAnalysisEnv
): boolean => env.VITE_INITIATIVES_PORTFOLIO_ANALYSIS === 'true';
