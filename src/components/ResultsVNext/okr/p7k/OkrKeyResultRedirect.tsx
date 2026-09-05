/**
 * P7K część A — PRZEKIEROWANIE dawnych poziomów 3 i 4 rodziny OKR.
 *
 * Do 05.09 istniały `/results/okr/:objectiveId/rezultaty` (zbiór kart
 * kluczowych rezultatów) i `/results/okr/:objectiveId/rezultaty/:keyResultId`
 * (karta kluczowego rezultatu). SSOT §1 i korekta P7K §4/§6 kasują oba
 * poziomy: kluczowy rezultat jest SEKCJĄ karty celu.
 *
 * Kasowanie trasy bez przekierowania zostawia po sobie martwe linki (a te
 * siedzą w zakładkach, w notatkach i w wiadomościach), więc oba adresy
 * prowadzą teraz do karty celu OTWARTEJ na sekcji „Kluczowe rezultaty”; gdy
 * adres wskazywał konkretny rezultat, karta go podświetla (`?rezultat=`).
 *
 * Osobny plik, a nie komponent w `AppRoutes.tsx`, bo test poziomów renderuje
 * to przekierowanie NAPRAWDĘ — inaczej „trasa KR nie istnieje” byłoby tylko
 * twierdzeniem o stałych, a nie o zachowaniu aplikacji.
 */
import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { okrObjectiveCardInReportPath } from './okrReportPaths';

export const OkrKeyResultRedirect: React.FC = () => {
  const { setId, objectiveId, keyResultId } = useParams<{
    setId: string;
    objectiveId: string;
    keyResultId?: string;
  }>();
  const target = `${okrObjectiveCardInReportPath(setId ?? '', objectiveId ?? '')}?sekcja=kluczowe-rezultaty${
    keyResultId ? `&rezultat=${encodeURIComponent(keyResultId)}` : ''
  }`;
  return <Navigate to={target} replace />;
};

export default OkrKeyResultRedirect;
