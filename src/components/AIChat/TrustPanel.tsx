/**
 * TrustPanel (production stub).
 *
 * The full Chat V9 / Wave A7 TrustPanel is WIP on develop and lives as
 * an uncommitted file on the author's workstation. Shipping the V9
 * feature without the component would break the production build, so
 * this stub renders nothing. All callers guard invocation behind a
 * truthy `bundle` prop or a Chat V9 feature flag, so rendering `null`
 * is a no-op for every production-reachable code path.
 *
 * When the real component lands from develop, delete this file.
 */

import React from 'react';

export interface TrustPanelProps {
  bundle?: unknown;
  isCompact?: boolean;
  isRtl?: boolean;
  showOperatorDetail?: boolean;
  messageId?: string | null;
  [key: string]: unknown;
}

export const TrustPanel: React.FC<TrustPanelProps> = () => null;

export default TrustPanel;
