import { motion } from 'framer-motion';
import { Rocket } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '../../services/funnelAnalytics';

interface DemoTrialButtonProps {
  onClick: () => void;
}

export const DemoTrialButton: React.FC<DemoTrialButtonProps> = ({ onClick }) => {
  const { t } = useTranslation();

  const handleClick = () => {
    trackFunnelEvent('demo_cta_clicked', { location: 'persistent_trial_button' });
    onClick();
  };

  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 2, duration: 0.4 }}
      onClick={handleClick}
      className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-crimson-600 text-white text-sm font-semibold rounded-full shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:from-primary-500 hover:to-crimson-500 transition-all"
    >
      <Rocket size={16} />
      {t('demo.conversion.trialButton', 'Start Free Trial')}
    </motion.button>
  );
};

export default DemoTrialButton;
