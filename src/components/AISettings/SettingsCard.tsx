/**
 * SettingsCard Component
 *
 * Consistent card style for AI settings sections.
 */

import { motion } from 'framer-motion';
import { ChevronRight, Info, LucideIcon } from 'lucide-react';
import React from 'react';

interface SettingsCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  badge?: string;
  badgeColor?: string;
  infoTooltip?: string;
  className?: string;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  title,
  description,
  icon: Icon,
  iconColor = 'text-c-accent',
  children,
  collapsible = false,
  defaultExpanded = true,
  badge,
  badgeColor = 'bg-c-accent-soft text-c-accent',
  infoTooltip,
  className = '',
}) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
                rounded-xl border
                border-c-border-subtle
                bg-c-surface dark:bg-gradient-to-br
                backdrop-blur-sm overflow-hidden shadow-sm dark:shadow-none
                ${className}
            `}
    >
      {/* Header */}
      <div
        className={`
                    flex items-center gap-3 p-4
                    ${collapsible ? 'cursor-pointer hover:bg-c-surface-raised transition-colors' : ''}
                `}
        onClick={() => collapsible && setExpanded(!expanded)}
      >
        {Icon && (
          <div
            className={`
                        w-10 h-10 rounded-lg flex items-center justify-center
                        bg-c-surface-raised dark:bg-gradient-to-br
                        border border-c-border-subtle
                    `}
          >
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-navy-900">{title}</h3>
            {badge && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
            )}
            {infoTooltip && (
              <div className="relative group">
                <Info className="w-4 h-4 text-c-text-secondary hover:text-c-text-muted cursor-help" />
                <div
                  className="
                                    absolute left-1/2 -translate-x-1/2 bottom-full mb-2
                                    px-3 py-2 rounded-lg bg-c-surface border border-c-border-subtle
                                    text-xs text-c-text-secondary w-48 text-center shadow-lg dark:shadow-none
                                    opacity-0 invisible group-hover:opacity-100 group-hover:visible
                                    transition-all duration-200 z-50
                                "
                >
                  {infoTooltip}
                </div>
              </div>
            )}
          </div>
          {description && (
            <p className="text-sm text-c-text-muted truncate">{description}</p>
          )}
        </div>

        {collapsible && (
          <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight className="w-5 h-5 text-c-text-secondary" />
          </motion.div>
        )}
      </div>

      {/* Content */}
      <motion.div
        initial={false}
        animate={{
          height: !collapsible || expanded ? 'auto' : 0,
          opacity: !collapsible || expanded ? 1 : 0,
        }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="px-4 pb-4 pt-0">
          <div className="border-t border-c-border-subtle pt-4">{children}</div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SettingsCard;
