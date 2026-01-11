/**
 * Help Content Configuration
 */

export interface HelpItem {
  id: string;
  title: string;
  titlePl?: string;
  description: string;
  descriptionPl?: string;
  category: string;
  link?: string;
  videoUrl?: string;
}

export const HELP_CONTENT: Record<string, HelpItem[]> = {
  dashboard: [
    {
      id: 'dashboard-overview',
      title: 'Dashboard Overview',
      titlePl: 'Przegląd dashboardu',
      description: 'Learn how to use the dashboard to track your projects.',
      descriptionPl: 'Dowiedz się, jak korzystać z dashboardu do śledzenia projektów.',
      category: 'getting-started',
    },
  ],
  projects: [
    {
      id: 'create-project',
      title: 'Creating a Project',
      titlePl: 'Tworzenie projektu',
      description: 'Step-by-step guide to creating your first project.',
      descriptionPl: 'Przewodnik krok po kroku do tworzenia pierwszego projektu.',
      category: 'projects',
    },
  ],
};

export const getHelpForView = (view: string): HelpItem[] => {
  return HELP_CONTENT[view] || [];
};

export const getHelpContent = () => HELP_CONTENT;
