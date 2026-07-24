/**
 * SidebarHeader — Tech Sexy (T102)
 *
 * Logo + collapse toggle. Monochromatic chrome, invisible borders.
 */

import { motion } from 'framer-motion';
import { PanelLeftClose } from 'lucide-react';
import React from 'react';

import { ThemeMode } from './types';

interface SidebarHeaderProps {
  showFull: boolean;
  theme: ThemeMode;
  onToggleCollapse: () => void;
  t: (key: string, fallback?: string) => string;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  showFull,
  theme,
  onToggleCollapse,
  t,
}) => {
  const logoSrc =
    theme === 'dark'
      ? '/assets/logos/logo-dark.svg?v=20260319'
      : '/assets/logos/logo-light.svg?v=20260319';

  return (
    <div
      className={[
        'flex items-center shrink-0 transition-all duration-200',
        showFull ? 'justify-between px-4 h-14' : 'flex-col justify-center gap-3 py-5',
      ].join(' ')}
    >
      {showFull ? (
        <>
          <motion.div
            className="flex items-center overflow-hidden flex-1 min-w-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            <img src={logoSrc} alt="Consultify" className="max-w-full h-auto object-contain" />
          </motion.div>

          <motion.button
            type="button"
            onClick={onToggleCollapse}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 rounded-lg transition-colors duration-150 shrink-0 ml-2 text-slate-500 dark:text-slate-500 hover:bg-white/[0.06]"
            title={t('sidebar.collapse', 'Collapse')}
            aria-label={t('sidebar.collapse', 'Collapse sidebar')}
          >
            <PanelLeftClose size={18} strokeWidth={1.75} />
          </motion.button>
        </>
      ) : (
        <>
          <motion.span
            // `text-primary-500` to STALY crimson z tailwinda — w trybie ciemnym
            // dawal ~2.5:1 na ciemnym tle i axe zglaszal to jako color-contrast.
            // `--c-accent` jest udokumentowanym jedynym akcentem marki i sam sie
            // podnosi w ciemnym (#85182f -> #c8324a), wiec znak marki zostaje
            // crimsonowy, a kontrast przestaje zalezec od motywu.
            className="text-xl font-bold tracking-tighter text-c-accent"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            77
          </motion.span>

          <motion.button
            type="button"
            onClick={onToggleCollapse}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 rounded-lg transition-colors duration-150 text-slate-500 dark:text-slate-500 hover:bg-white/[0.06]"
            title={t('sidebar.expand', 'Expand')}
            aria-label={t('sidebar.expand', 'Expand sidebar')}
          >
            <PanelLeftClose size={18} strokeWidth={1.75} className="rotate-180" />
          </motion.button>
        </>
      )}
    </div>
  );
};

export default SidebarHeader;
