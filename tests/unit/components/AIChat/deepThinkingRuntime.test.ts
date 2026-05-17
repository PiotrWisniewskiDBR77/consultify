import { describe, expect, it } from 'vitest';

import {
  buildDeepThinkingConfirmCardContent,
  buildDeepThinkingConfirmMessageMetadata,
  type DeepThinkingConfirmPayload,
} from '../../../../src/components/AIChat/deepThinkingRuntime';

describe('deepThinkingRuntime read-back and truthfulness copy', () => {
  it('builds confirm card with faithful read-back details', () => {
    const confirm: DeepThinkingConfirmPayload = {
      understanding: {
        goal: 'Prepare steering-committee recommendation',
        context: 'Q2 expansion plan',
        constraints: ['budget cap', '2-week timeline'],
        expectedOutput: 'Decision',
        decisionHorizon: '90 days',
      },
      missingInfoQuestions: [
        { question: 'Which market is priority?' },
        { question: 'What is acceptable risk?' },
      ],
    };

    const card = buildDeepThinkingConfirmCardContent(confirm);
    expect(card).toContain('**My understanding of your task**');
    expect(card).toContain('- Goal: Prepare steering-committee recommendation');
    expect(card).toContain('- Context: Q2 expansion plan');
    expect(card).toContain('- Constraints: budget cap; 2-week timeline');
    expect(card).toContain('- Output: Decision');
    expect(card).toContain('- Horizon: 90 days');
    expect(card).toContain('1. Which market is priority?');
    expect(card).toContain('2. What is acceptable risk?');
    expect(card).toContain('_Confirm to start Deep Thinking. Adjust if the task needs correction._');
  });

  it('maps confirm metadata to normalized expected output and depth', () => {
    const metadata = buildDeepThinkingConfirmMessageMetadata({
      originalMessage: 'help me decide',
      confirm: {
        understanding: {
          expectedOutput: 'StructuredAnalysis',
        },
        suggestedDepth: 'Hard',
      },
      confirmToken: 'token-1',
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        deepThinking: expect.objectContaining({
          kind: 'confirm',
          originalMessage: 'help me decide',
          expectedOutput: 'StructuredAnalysis',
          suggestedDepth: 'hard',
        }),
        deepThinkingConfirmToken: 'token-1',
      })
    );
  });
});
