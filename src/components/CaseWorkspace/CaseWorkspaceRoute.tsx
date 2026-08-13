/**
 * Zlecenia — opakowanie trasy produkcyjnej.
 *
 * Jedyny plik, który zna chrome aplikacji: dokłada `MainLayout` (sidebar,
 * topbar, ścieżka) wokół powierzchni modułu. Dzięki temu `src/App.tsx`
 * potrzebuje TYLKO jednego leniwego importu, a moduł nie ciągnie ciężkiego
 * layoutu do harnessu zrzutowego.
 *
 * Trasa jest rejestrowana WYŁĄCZNIE gdy flaga `isCaseWorkspaceEnabled()` jest
 * włączona (domyślnie NIE) — patrz `caseWorkspaceFlag.ts`.
 */

import React from 'react';

import { MainLayout } from '@/layouts/MainLayout';

import { CaseWorkspaceHub } from './CaseWorkspaceHub';

export const CaseWorkspaceRoute: React.FC = () => (
  <MainLayout breadcrumbs={[{ label: 'Zlecenia' }]} noPadding>
    <CaseWorkspaceHub />
  </MainLayout>
);

export default CaseWorkspaceRoute;
