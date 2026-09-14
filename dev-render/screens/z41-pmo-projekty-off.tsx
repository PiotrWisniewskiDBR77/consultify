/**
 * Z-41 (14.09) — dowód trasy `/projects` przy `VITE_PMO_PROJECTS` DOMYŚLNIE
 * WYŁĄCZONEJ (brak zmiennej env w procesie dev-render = OFF, jak na
 * produkcji przed akceptem).
 *
 * Montuje REALNY `<AppRoutes/>` (nie sam komponent ekranu) z
 * `MemoryRouter initialEntries={['/projects']}`, żeby zrzut dowodził
 * rzeczywistego zachowania trasy z `src/routes/AppRoutes.tsx:1747-1758`:
 * `pmoProjectsEnabled` czyta `import.meta.env.VITE_PMO_PROJECTS === 'true'`
 * raz przy starcie builda — przy OFF `<Route path="/projects">` renderuje
 * `<Navigate to="/my-work" replace/>`, więc ekran musi pokazać lądowanie
 * „My Work", NIE listę projektów.
 *
 * `seedRealisticSession()` (jak w `finance-hub.tsx`) odblokowuje pełne
 * drzewo providerów (`AppProviders` montuje V8/Org/AccessPolicy itd. gdy
 * `currentUser?.id` istnieje) i `isDemoMode:true`, więc realne wywołania
 * sieciowe /my-work bez backendu spadają na wbudowane dane demo zamiast
 * pustego ekranu błędu.
 *
 * UWAGA: `AppProviders` sam w sobie zawiera `<BrowserRouter>`
 * (`src/providers/AppProviders.tsx:137`) — NIE owijamy dodatkowo w
 * `MemoryRouter` (podwójny Router = crash "cannot render a Router inside
 * another Router"). Zamiast tego ustawiamy początkową ścieżkę przez
 * `window.history.replaceState` PRZED montażem, tak jak realna nawigacja
 * przeglądarki na `/projects`.
 *
 * URL: ?screen=z41-pmo-projekty-off&lang=pl|en&theme=light|dark
 */
import React from 'react';

import { AppRoutes } from '../../src/routes/AppRoutes';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();
window.history.replaceState({}, '', '/projects');

export default function Z41PmoProjektyOffScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div className="h-screen bg-c-bg">
        <AppRoutes />
      </div>
    </AppProviders>
  );
}
