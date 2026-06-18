export const MENU3_AI_BUTTON_BASE_CLASS =
  'menu3-ai-button h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold border transition-colors disabled:opacity-40';

// AI buttons share the standardized Menu 3 chip shell + single PRIMARY active
// color (matches MENU_3_CHIP_ACTIVE / MENU_3_CHIP_INACTIVE in ModuleMenu3.tsx).
// Icons keep their own varied colors — only the button shell is standardized.
export const getMenu3AiButtonClass = (active = false) =>
  `${MENU3_AI_BUTTON_BASE_CLASS} ${
    active
      ? 'bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300 border-sky-300 dark:border-sky-500/30'
      : 'menu3-ai-opportunity bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-navy-700/60 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-navy-900/50'
  }`;
