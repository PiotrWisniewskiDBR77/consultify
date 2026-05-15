export const MENU3_AI_BUTTON_BASE_CLASS =
  'menu3-ai-button h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold border transition-colors disabled:opacity-40';

export const getMenu3AiButtonClass = (active = false) =>
  `${MENU3_AI_BUTTON_BASE_CLASS} ${
    active
      ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-200 border-cyan-500/40'
      : 'menu3-ai-opportunity bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
  }`;
