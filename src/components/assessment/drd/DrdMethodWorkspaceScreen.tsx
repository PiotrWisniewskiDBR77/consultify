/**
 * DRD workspace route adapter.
 *
 * J2 made the server-authoritative HTTP workspace the sole product route:
 * `AssessmentSessionEditorView` mounts this component with
 * `forceHttpSourceOfTruth`, and `shouldMountDrdMethodWorkspace('drd', …)` is
 * true for every DRD session. The former localStorage runtime had no product
 * consumer and kept a second, pre-J2 frozen screen alive. This adapter retains
 * the public prop shape used by the dev harness while always mounting the
 * canonical HTTP workspace and its frozen shell/report/settings layout.
 */
import React from 'react';

import type { MethodWorkspaceViewMode } from '@/components/method-workspace/types';

import { DrdHttpMethodWorkspaceScreen } from './DrdHttpMethodWorkspaceScreen';

export interface DrdMethodWorkspaceScreenProps {
  /** Injectable for the dev-render harness / tests — defaults to window.localStorage. */
  storage?: Storage;
  /** Resume an existing server-authoritative session; omit to create a fresh one. */
  demoSessionId?: string;
  onExit?: () => void;
  /** Seed data straight to a given lifecycle stage — dev-render harness only. */
  seedTo?: 'interview' | 'matrix' | 'teresa' | 'approval' | 'frozen' | 'reopened';
  /** Dev-render harness only — jump straight to a view mode for a screenshot. */
  initialViewMode?: MethodWorkspaceViewMode;
  /** Retained for source compatibility; identity comes from the signed HTTP session. */
  initialActorUserId?: string;
  /**
   * Retained for source compatibility after the J2 cutover. Both values now
   * select the same server-authoritative runtime; there is no legacy branch.
   */
  forceHttpSourceOfTruth?: boolean;
  /** Dev-render/test-only synthetic network state. */
  forceState?: 'offline' | 'conflict' | 'recovery' | 'loading';
}

export const DrdMethodWorkspaceScreen: React.FC<DrdMethodWorkspaceScreenProps> = ({
  forceHttpSourceOfTruth: _retiredFlag,
  initialActorUserId: _retiredActor,
  ...props
}) => <DrdHttpMethodWorkspaceScreen {...props} />;

export default DrdMethodWorkspaceScreen;
