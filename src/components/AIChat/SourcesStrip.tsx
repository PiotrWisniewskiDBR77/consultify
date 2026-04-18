/**
 * SourcesStrip (production stub).
 *
 * See TrustPanel.tsx for context. The real component is an unpushed
 * WIP on develop; this stub keeps the V9 import chain resolvable for
 * production. Guarded by `bundle` truthiness at every call site.
 */

import React from 'react';

export interface SourcesStripProps {
  bundle?: unknown;
  messageId?: string | null;
  isCompact?: boolean;
  [key: string]: unknown;
}

export const SourcesStrip: React.FC<SourcesStripProps> = () => null;

export default SourcesStrip;
