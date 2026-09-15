/**
 * Server-safe mirror of `src/routes/routeConfig.ts#TERESA_NAVIGATION_MANIFEST`.
 * Kept deliberately data-only so the production backend image does not import
 * the browser router. `tests/unit/routes/teresaNavigationManifest.test.ts`
 * rejects drift between this mirror and the routeConfig source of truth.
 */
export interface TeresaNavigationManifestEntry {
  id: string;
  route: string;
  labelEn: string;
  labelPl: string;
  clickPathEn: readonly string[];
  clickPathPl: readonly string[];
  roles?: readonly string[];
  runtimeFlagKey?: string;
  organizationFlagKey?: string;
  availability?: 'available' | 'coming_soon';
}

export const TERESA_NAVIGATION_MANIFEST: readonly TeresaNavigationManifestEntry[] = [
  { id: 'AI_CHAT', route: '/chat', labelEn: 'Chat', labelPl: 'Czat', clickPathEn: ['Chat'], clickPathPl: ['Czat'] },
  { id: 'MY_WORK', route: '/my-work', labelEn: 'My Work', labelPl: 'Moja praca', clickPathEn: ['My Work'], clickPathPl: ['Moja praca'] },
  { id: 'INTERVIEW', route: '/interview', labelEn: 'Interview', labelPl: 'Wywiad', clickPathEn: ['Interview'], clickPathPl: ['Wywiad'] },
  { id: 'TOOLS', route: '/discovery-tools', labelEn: 'Tools', labelPl: 'Narzędzia', clickPathEn: ['Tools'], clickPathPl: ['Narzędzia'] },
  { id: 'TOOLS_ASSESSMENT', route: '/assessment/overview', labelEn: 'Assessment', labelPl: 'Ocena', clickPathEn: ['Assessment'], clickPathPl: ['Ocena'] },
  { id: 'MODULE_AUDITS', route: '/audit-programs', labelEn: 'Audits', labelPl: 'Audyty', clickPathEn: ['Audits'], clickPathPl: ['Audyty'], organizationFlagKey: 'MODULE_AUDITS' },
  { id: 'MODULE_INITIATIVES', route: '/initiatives', labelEn: 'Initiatives', labelPl: 'Inicjatywy', clickPathEn: ['Initiatives'], clickPathPl: ['Inicjatywy'] },
  { id: 'MODULE_EXECUTION', route: '/execution', labelEn: 'Execution', labelPl: 'Realizacja', clickPathEn: ['Execution'], clickPathPl: ['Realizacja'] },
  { id: 'MODULE_BENEFITS', route: '/results', labelEn: 'Results', labelPl: 'Wyniki', clickPathEn: ['Results'], clickPathPl: ['Wyniki'], organizationFlagKey: 'MODULE_BENEFITS' },
  { id: 'MODULE_ECONOMICS', route: '/finance', labelEn: 'Finance', labelPl: 'Finanse', clickPathEn: ['Finance'], clickPathPl: ['Finanse'], organizationFlagKey: 'MODULE_ECONOMICS', availability: 'coming_soon' },
  { id: 'MODULE_PRESENTATIONS', route: '/presentations', labelEn: 'Materials', labelPl: 'Materiały', clickPathEn: ['Materials'], clickPathPl: ['Materiały'], organizationFlagKey: 'MODULE_PRESENTATIONS' },
  { id: 'MODULE_MEETING', route: '/meetings', labelEn: 'Meetings', labelPl: 'Spotkania', clickPathEn: ['Meetings'], clickPathPl: ['Spotkania'], runtimeFlagKey: 'VITE_MODULE_MEETINGS', organizationFlagKey: 'MODULE_MEETING' },
  { id: 'PROJECTS', route: '/projects', labelEn: 'Projects', labelPl: 'Projekty', clickPathEn: ['My Work', 'Projects'], clickPathPl: ['Moja praca', 'Projekty'], runtimeFlagKey: 'VITE_PMO_PROJECTS' },
  { id: 'ORGANIZATION', route: '/organization/profile', labelEn: 'Organization', labelPl: 'Organizacja', clickPathEn: ['Organization'], clickPathPl: ['Organizacja'] },
  { id: 'ADMIN', route: '/admin', labelEn: 'Administration', labelPl: 'Administracja', clickPathEn: ['Administration'], clickPathPl: ['Administracja'], roles: ['OWNER', 'ADMIN'] },
  { id: 'SETTINGS', route: '/settings', labelEn: 'Settings', labelPl: 'Ustawienia', clickPathEn: ['Settings'], clickPathPl: ['Ustawienia'] },
];
