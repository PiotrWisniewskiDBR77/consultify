/**
 * Day 236 — komplet 11 realnych ekranów redesignu Organizacji.
 *
 * Ten entry nie replikuje UI ani nie przekazuje ręcznych propsów do ekranów.
 * Montuje istniejący harness `org-identity-operating`, który z kolei montuje
 * realny `OrganizationView` i zasila jego prawdziwe adaptery API fixture'em.
 * Parametr `orgRoute` wybiera jedną z kanonicznych par moduł/ekran.
 * `redesign=off` usuwa query-param flagi i pokazuje dzisiejszy layout legacy.
 */
import React from 'react';

import { useAppStore } from '../../src/store/useAppStore';
import OrgIdentityOperatingScreen from './org-identity-operating';

const REDESIGN_ROUTES = new Set([
  'profile/identity-scale',
  'profile/position-direction',
  'goals/strategic-intent',
  'goals/stakeholder-expectations',
  'challenges/declared-challenges',
  'challenges/root-causes',
  'strategy/risks-opportunities',
  'strategy/executive-brief',
  'sources/claims-sources',
  'sources/knowledge-graph',
  'readiness/summary',
]);

const params = new URLSearchParams(window.location.search);
const requestedRoute = params.get('orgRoute') || 'profile/identity-scale';
const route = REDESIGN_ROUTES.has(requestedRoute) ? requestedRoute : 'profile/identity-scale';
const redesignEnabled = params.get('redesign') !== 'off';

if (redesignEnabled) params.set('ff_org_redesign_v1', '1');
else params.delete('ff_org_redesign_v1');

window.history.replaceState(null, '', `/organization/${route}?${params.toString()}`);

if (params.get('persona') === 'member') {
  const currentUser = useAppStore.getState().currentUser;
  useAppStore.setState({
    currentUser: currentUser
      ? ({ ...currentUser, role: 'MEMBER', accessLevel: 'limited' } as typeof currentUser)
      : currentUser,
  });
}

export default function Day236OrganizacjaScreen() {
  return <OrgIdentityOperatingScreen />;
}
