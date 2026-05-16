/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ExecutionCurrentBlock } from '../../../src/components/MyWork/Home/ExecutionCurrentBlock';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      ({
        'myWork.radar.visibility.private': 'Private',
        'myWork.radar.visibility.reviewShared': 'Needs review',
        'myWork.radar.reviewState.inReview': 'In review',
        'myWork.radar.artifactType.presentation': 'Presentation',
        'myWork.radar.artifactType.report': 'Report',
      })[key] ||
      fallback ||
      key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../src/components/MyWork/Home/HomeBlockShell', () => ({
  HomeBlockShell: ({ children }: any) => <div>{children}</div>,
}));

describe('ExecutionCurrentBlock', () => {
  it('renders artifact visibility badges and opens the selected output', () => {
    const onAction = vi.fn();

    render(
      <ExecutionCurrentBlock
        onAction={onAction}
        block={{
          id: 'executionCurrent',
          title: 'Execution current',
          accent: 'cool',
          size: 'lg',
          priorityWeight: 1,
          relevanceScore: 1,
          freshnessScore: 1,
          ctaIntents: [],
          payload: {
            headline: 'Current execution state',
            streams: [],
            artifactOutputs: [
              {
                id: 'report-native-1',
                artifactId: 'artifact-1',
                title: 'QBR draft',
                outputType: 'report',
                originRuntime: 'report',
                deliveryState: 'draft',
                visibilityScope: 'private',
              },
              {
                id: 'deck-native-1',
                artifactId: 'artifact-2',
                title: 'Board review deck',
                outputType: 'presentation',
                originRuntime: 'presentation',
                deliveryState: 'review',
                visibilityScope: 'review_shared',
                publishState: 'in_review',
                reviewGateCount: 2,
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.getByText('In review · 2')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Board review deck'));

    expect(onAction).toHaveBeenCalledWith({
      type: 'open',
      target: 'presentation',
      id: 'deck-native-1',
    });
  });
});
