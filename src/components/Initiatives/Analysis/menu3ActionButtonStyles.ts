export {
  getMenu3AiButtonClass,
  MENU3_AI_BUTTON_BASE_CLASS,
} from '@/components/shared/ModuleHub/menu3ActionButtonStyles';

import { MENU3_AI_BUTTON_BASE_CLASS } from '@/components/shared/ModuleHub/menu3ActionButtonStyles';

/**
 * Chip Menu 3 dla akcji DETERMINISTYCZNEJ (liczonej lokalnie, bez modelu).
 *
 * Ta sama powłoka co `getMenu3AiButtonClass` — ten sam rozmiar, promień, stan
 * aktywny — ale BEZ klasy `menu3-ai-opportunity`. Ta klasa (src/index.css)
 * dokłada pulsującą animację `menu3AiCue` + pierścień + animowaną ikonę, czyli
 * wizualny sygnał „tu jest AI". Przycisk, który tylko przelicza dane lokalnie,
 * nie ma prawa tego sygnału nosić — inaczej etykietę zdejmujemy ze słów,
 * a zostawiamy ją w animacji.
 */
export const getMenu3DeterministicButtonClass = (active = false) =>
  `${MENU3_AI_BUTTON_BASE_CLASS} ${
    active
      ? 'bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300 border-sky-300 dark:border-sky-500/30'
      : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-navy-700/60 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-navy-900/50'
  }`;
