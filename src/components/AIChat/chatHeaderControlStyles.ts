/** CHAT-OWN-010: one measured visual contract for the Chat header controls. */
export const CHAT_HEADER_ICON_CONTROL_CLASS =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-gradient-to-br from-white/85 to-white/60 text-c-text-muted shadow-sm backdrop-blur-xl transition-colors hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.08] dark:from-navy-900/80 dark:to-navy-800/60';

export const CHAT_HEADER_SELECTOR_CLASS =
  'inline-flex h-8 shrink-0 items-center gap-2 rounded-xl border border-white/30 bg-gradient-to-br from-white/85 to-white/60 px-3 text-sm text-c-text shadow-sm backdrop-blur-xl transition-colors hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.08] dark:from-navy-900/80 dark:to-navy-800/60';

/** Shared selected/open state; never changes control geometry. */
export const CHAT_HEADER_CONTROL_ACTIVE_CLASS =
  'border-c-border-strong bg-c-surface-raised text-c-text ring-1 ring-c-border';
