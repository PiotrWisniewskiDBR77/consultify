import { ArrowLeft, MessageCircle, SearchX } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/primitives';
import { ROUTES } from '@/routes/routeConfig';

/**
 * WAŻNY, RAPORT_B #4: nieznana trasa była CICHO przekierowywana (zalogowany →
 * `/chat`, niezalogowany → `/`), zero komunikatu — nie do odróżnienia od
 * zwykłego działania aplikacji. Ten ekran renderuje się na wildcard route `*`
 * w `AppRoutes.tsx` dla KAŻDEJ trasy, która nie pasuje do żadnej znanej —
 * TYLKO dla naprawdę nieznanych adresów (istniejące przekierowania starych
 * tras mają własne dedykowane `<Route>` PRZED wildcardem i nigdy tu nie
 * trafiają).
 *
 * Zalogowany użytkownik dostaje ten komponent OPAKOWANY w `MainLayout` (pełna
 * powłoka aplikacji) w `AppRoutes.tsx`; niezalogowany — bez powłoki, sam na
 * pustej stronie (tu, `withShell=false`, gdy wywoływany samodzielnie).
 */
export const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleBackToChat = () => navigate(ROUTES.AI_CHAT);
  const handleGoBack = () => navigate(-1);

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-c-surface-raised text-c-text-muted">
        <SearchX className="h-8 w-8" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-c-text">
          {t('notFoundPage.title', 'Nie ma takiej strony')}
        </h1>
        <p className="max-w-md text-sm text-c-text-secondary">
          {t(
            'notFoundPage.message',
            'Adres, pod który trafiłeś/aś, nie istnieje albo został przeniesiony.'
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" icon={<ArrowLeft />} onClick={handleGoBack}>
          {t('notFoundPage.goBack', 'Wstecz')}
        </Button>
        <Button variant="primary" icon={<MessageCircle />} onClick={handleBackToChat}>
          {t('notFoundPage.backToChat', 'Wróć do Czatu')}
        </Button>
      </div>
    </div>
  );
};

export default NotFoundPage;
