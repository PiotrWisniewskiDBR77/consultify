import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface DemoButtonProps {
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'compact' | 'inline' | 'region' | 'framed';
  className?: string;
  region?: 'japan' | 'saudi' | 'europe' | 'usa';
}

const CALENDAR_URL =
  'https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017';

/**
 * DemoButton - Elegant, gradient text style call-to-action for scheduling demos
 * Style inspired by "Get in Touch" header
 *
 * Variants:
 * - default: Elegant gradient text link (like "Get in Touch")
 * - compact: Smaller version for methodology section
 * - inline: Simple inline text link
 * - region: Regional button with flag
 * - framed: Button with border frame
 */
export const DemoButton: React.FC<DemoButtonProps> = ({
  href = CALENDAR_URL,
  onClick,
  variant = 'default',
  className = '',
  region,
}) => {
  const { t } = useTranslation();

  const REGIONS = {
    japan: { flag: '🇯🇵', name: t('landing.regions.japan', 'Japan') },
    saudi: { flag: '🇸🇦', name: t('landing.regions.saudi', 'Saudi Arabia') },
    europe: { flag: '🇪🇺', name: t('landing.regions.europe', 'Europe') },
    usa: { flag: '🇺🇸', name: t('landing.regions.usa', 'United States') },
  };

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  if (variant === 'inline') {
    return (
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        whileHover={{ x: 4 }}
        className={`
                    inline-flex items-center gap-2
                    text-c-accent
                    hover:text-c-accent
                    font-semibold text-sm
                    transition-colors duration-200
                    group
                    ${className}
                `}
      >
        <span>{t('landing.demo.schedule', 'Schedule a Demo')}</span>
        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </motion.a>
    );
  }

  if (variant === 'region' && region) {
    const regionData = REGIONS[region];
    return (
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        whileHover={{ y: -3, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`
                    flex flex-col items-center gap-2 p-4
                    bg-white/5 backdrop-blur-sm
                    border border-c-border-subtle hover:border-c-accent
                    rounded-xl
                    transition-all duration-300
                    group
                    ${className}
                `}
      >
        <span className="text-3xl">{regionData.flag}</span>
        <span className="text-sm font-bold text-white">{regionData.name}</span>
        <span className="text-xs text-c-accent group-hover:text-c-accent flex items-center gap-1">
          {t('landing.demo.scheduleShort', 'Schedule')}{' '}
          <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
        </span>
      </motion.a>
    );
  }

  if (variant === 'framed') {
    return (
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        whileHover={{ y: -2 }}
        className={`
                    inline-flex items-center gap-3 px-6 py-4
                    border-2 border-c-accent hover:border-c-accent
                    rounded-xl
                    bg-c-accent-soft hover:bg-c-accent-soft
                    transition-all duration-300
                    group
                    ${className}
                `}
      >
        <span className="text-lg font-black text-white">{t('landing.demo.getA', 'Get a')}</span>
        <span className="text-lg font-black text-c-accent">
          {t('landing.demo.word', 'Demo')}
        </span>
        <ArrowRight
          size={20}
          className="text-c-accent group-hover:translate-x-1 transition-transform"
        />
      </motion.a>
    );
  }

  if (variant === 'compact') {
    return (
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        whileHover={{ y: -2 }}
        className={`
                    inline-flex items-center gap-3
                    group
                    ${className}
                `}
      >
        <span className="text-xl font-black text-c-text">
          {t('landing.demo.getA', 'Get a')}
        </span>
        <span className="text-xl font-black text-c-accent">
          {t('landing.demo.word', 'Demo')}
        </span>
        <ArrowRight
          size={20}
          className="text-c-accent group-hover:translate-x-1 transition-transform"
        />
      </motion.a>
    );
  }

  // Default variant - elegant gradient text style like "Get in Touch"
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      whileHover={{ y: -2 }}
      className={`
                inline-block group
                ${className}
            `}
    >
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-c-text tracking-tight">
            {t('landing.demo.bookA', 'Book a')}
          </span>
          <span className="text-2xl font-black text-c-accent tracking-tight">
            {t('landing.demo.word', 'Demo')}
          </span>
          <ArrowRight
            size={22}
            className="text-c-accent group-hover:translate-x-2 transition-transform duration-300"
          />
        </div>
        <span className="text-xs text-c-text-muted font-medium">
          {t('landing.demo.subtext', 'Free 30-min call • See Consultify in action')}
        </span>
      </div>
    </motion.a>
  );
};

/**
 * RegionalDemoButtons - Grid of regional demo buttons
 */
export const RegionalDemoButtons: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={className}>
      {/* Regional buttons grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DemoButton variant="region" region="europe" />
        <DemoButton variant="region" region="usa" />
        <DemoButton variant="region" region="saudi" />
        <DemoButton variant="region" region="japan" />
      </div>
    </div>
  );
};

export default DemoButton;
