import { Calculator, MessageCircle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/primitives';
import { ROUTES } from '@/routes/routeConfig';

/** DEC-470. Same neutral shell as Meetings; Finance delivery belongs to Wave 2. */
export const FinanceWave2Placeholder: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleBackToChat = () => navigate(ROUTES.AI_CHAT);

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-c-surface-raised text-c-text-muted">
        <Calculator className="h-8 w-8" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-c-text">
          {t('finance.wave2Placeholder.title', 'Finance — Coming soon')}
        </h1>
        <p className="max-w-md text-sm text-c-text-secondary">
          {t(
            'finance.wave2Placeholder.message',
            'Financial analysis, planning and valuation are planned for Wave 2.'
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" icon={<MessageCircle />} onClick={handleBackToChat}>
          {t('notFoundPage.backToChat', 'Back to Chat')}
        </Button>
      </div>
    </div>
  );
};

export default FinanceWave2Placeholder;
