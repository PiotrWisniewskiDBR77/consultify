/**
 * Dev-render host — odbiór Sheet #9 (audyt 2026-07-22): realny ExceleView
 * (silnik arkuszy z formułami) odsłaniany pod /excele za flagą. Bez backendu
 * harness pokazuje stan HOME (ArtifactModuleHome lane="excele") — wejście do
 * modułu, które użytkownik zobaczy po włączeniu flagi.
 *
 * ExceleView jest PRE-EXISTING (nie zmieniany naprawą — zmiana Sheet #9 to tylko
 * routing/flaga). Wymaga QueryClientProvider (react-query) + Router
 * (useSearchParams), których globalny harness nie daje — owijamy lokalnie.
 *
 * URL: ?screen=excele-engine-reveal&theme=light|dark&lang=pl|en
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ExceleView } from '@/components/AIChat/KimiWorkspace/ExceleView';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export default function ExceleEngineRevealScreen(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/excele']}>
        <div className="h-screen w-full overflow-hidden bg-c-bg">
          <ExceleView />
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
