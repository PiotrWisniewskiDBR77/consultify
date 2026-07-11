/**
 * StudioUnavailableView — crash-containment placeholder for `/studio`.
 *
 * Rendered instead of `<StudioView>` while `studioFlag` (src/utils/studioFlag.ts)
 * is OFF (the default). Studio's AI chat panel calls five `/api/studio/ai/*`
 * endpoints that were never implemented server-side, so the real view
 * crashes the chat flow as soon as a user sends a message. This placeholder
 * keeps the route reachable (no broken link / blank screen) without letting
 * anyone hit the broken chat.
 */

import { Palette } from 'lucide-react';
import React from 'react';

import { SplitLayout } from '../components/layout/SplitLayout';
import { AppView } from '../types';

export const StudioUnavailableView: React.FC = () => {
  return (
    <SplitLayout title="Studio" currentView={AppView.STUDIO}>
      <div className="h-full flex items-center justify-center bg-c-bg">
        <div className="max-w-sm text-center px-6">
          <div className="w-12 h-12 rounded-xl bg-c-accent-soft text-c-accent flex items-center justify-center mx-auto mb-4">
            <Palette size={22} />
          </div>
          <h2 className="text-c-text font-medium mb-2">Studio is not available yet</h2>
          <p className="text-sm text-c-text-muted">
            The visual AI workspace is still being built. Check back soon — in the meantime, try
            Mind Map, Process Flow, or Whiteboard under My Work.
          </p>
        </div>
      </div>
    </SplitLayout>
  );
};

export default StudioUnavailableView;
