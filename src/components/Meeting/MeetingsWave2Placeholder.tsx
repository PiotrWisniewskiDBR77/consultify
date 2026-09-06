import { CalendarClock, MessageCircle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/primitives';
import { ROUTES } from '@/routes/routeConfig';

/**
 * DEC-425 (właściciel, 2026-09-06): „Wrzuć Spotkania za flagi i wpisz to do
 * Fali 2. Nie będziemy teraz tego rozwijać.” Ten ekran zastępuje
 * `MeetingHub`/`MeetingObjectPage` na KAŻDEJ trasie `/meetings/**` (i, po
 * przekierowaniu legacy, `/meeting`) dopóki `isMeetingsModuleEnabled()`
 * (`meetingsModuleFlag.ts`) jest OFF — czyli domyślnie, do Fali 2.
 *
 * Zamierzenie właściciela: głębokie linki do spotkania z innych modułów
 * (np. `artifactLinks.ts` → `/meetings/:id` z karty inicjatywy, mapy myśli,
 * czatu…) mają wylądować na NEUTRALNYM ekranie, nie na 404/wyjątku. Kanon
 * wizualny 1:1 z `NotFoundPage.tsx` (tokeny `c-*`, przycisk „Wróć do Czatu”),
 * tylko treść inna — to nie jest błąd, to zapowiedziana nieobecność.
 *
 * Z flagą ON ten komponent nigdy się nie renderuje — trasy wracają do
 * `BetaGate moduleId="MODULE_MEETING"` + `MeetingHub`/`MeetingObjectPage`
 * bez żadnej zmiany (patrz `AppRoutes.tsx`).
 */
export const MeetingsWave2Placeholder: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleBackToChat = () => navigate(ROUTES.AI_CHAT);

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-c-surface-raised text-c-text-muted">
        <CalendarClock className="h-8 w-8" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-c-text">
          {t('meeting.wave2Placeholder.title', 'Spotkania — planowane w Fali 2')}
        </h1>
        <p className="max-w-md text-sm text-c-text-secondary">
          {t(
            'meeting.wave2Placeholder.message',
            'Ten moduł nie wchodzi jeszcze do MVP. Wracamy do niego w kolejnej fali rozwoju.'
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" icon={<MessageCircle />} onClick={handleBackToChat}>
          {t('notFoundPage.backToChat', 'Wróć do Czatu')}
        </Button>
      </div>
    </div>
  );
};

export default MeetingsWave2Placeholder;
