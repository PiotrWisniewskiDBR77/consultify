/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/services/api', () => ({ Api: { post: vi.fn() } }));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/shared/PreviewPane', () => ({
  PreviewMetaCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PreviewDetailsSection: ({ text }: { text: string }) => (
    <div data-testid="details">{text || 'No description available'}</div>
  ),
  PreviewActionBar: () => null,
  PreviewAIHintStrip: () => null,
  PreviewRelations: () => null,
}));

vi.mock('../ToolSessionPreview', () => ({
  getToolCategoryLabel: (toolType: string) => toolType,
}));

import { buildToolSessionDetails } from '../toolSessionDetailsBuilder';
import { type ToolSessionPreviewDetails, ToolSessionPreviewV3Body } from '../ToolSessionPreviewV3';

const richDetails: ToolSessionPreviewDetails = {
  id: 'session-42',
  name: 'European growth options',
  toolType: 'Dynamic SWOT',
  status: 'REVIEW',
  progress: 88,
  confidenceAvg: 4.2,
  createdAt: '2026-07-10T08:30:00.000Z',
  updatedAt: '2026-07-12T15:45:00.000Z',
  answers: {
    strategicGoal: 'Expand recurring revenue in Germany and France during the next planning cycle',
    customerSignal:
      'Enterprise buyers request local implementation partners and shorter onboarding',
    primaryRisk: 'The current support team does not cover both markets in local languages',
    recommendation: 'Validate partner economics before approving the regional launch sequence',
    priorities: ['partner network', 'localized onboarding', 'support capacity'],
  },
  contextSnapshot: {
    organization: {
      sector: 'Industrial software',
      operatingModel: 'Subscription platform with direct enterprise sales',
    },
    planningHorizon: 'Eighteen months',
    sponsor: 'Transformation Office',
    evidenceStatus: 'Customer interviews completed and finance assumptions awaiting validation',
  },
};

const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

describe('buildToolSessionDetails', () => {
  it.each(['pl', 'en'] as const)('builds a rich %s description within 80–140 words', (language) => {
    const result = buildToolSessionDetails(richDetails, language);
    expect(wordCount(result)).toBeGreaterThanOrEqual(80);
    expect(wordCount(result)).toBeLessThanOrEqual(140);
    expect(result).toMatch(language === 'pl' ? /^Sesja:/ : /^Session:/);
    expect(result).not.toMatch(/[{}"]/);
  });

  it('preserves persisted facts without inventing values', () => {
    const result = buildToolSessionDetails(richDetails, 'en');
    expect(result).toContain('European growth options');
    expect(result).toContain('Dynamic SWOT');
    expect(result).toContain('88%');
    expect(result).toContain('4.2');
    expect(result).toContain('Industrial software');
    expect(result).toContain('partner economics');
  });

  it('sanitizes unsafe markup and secrets, and caps output length', () => {
    const result = buildToolSessionDetails(
      {
        ...richDetails,
        name: '<script>alert(1)</script> Safe session',
        answers: {
          apiToken: 'must-not-leak',
          narrative: `<b>${'verified '.repeat(100)}</b>`,
          ...Object.fromEntries(
            Array.from({ length: 30 }, (_, index) => [`fact${index}`, `value ${index}`])
          ),
        },
      },
      'en'
    );

    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<b>');
    expect(result).not.toContain('must-not-leak');
    expect(wordCount(result)).toBeLessThanOrEqual(140);
  });

  it.each([
    ['apiKey', 'MARKER_API_KEY'],
    ['api_key', 'MARKER_API_SNAKE_KEY'],
    ['privateKey', 'MARKER_PRIVATE_KEY'],
    ['accessKey', 'MARKER_ACCESS_KEY'],
    ['authHeader', 'MARKER_AUTH_HEADER'],
    ['authentication', 'MARKER_AUTHENTICATION'],
    ['bearer', 'MARKER_BEARER_KEY'],
    ['clientSecret', 'MARKER_CLIENT_SECRET'],
    ['sessionKey', 'MARKER_SESSION_KEY'],
    ['password', 'MARKER_PASSWORD'],
    ['secret', 'MARKER_SECRET'],
    ['token', 'MARKER_TOKEN'],
    ['authorization', 'MARKER_AUTHORIZATION'],
    ['cookie', 'MARKER_COOKIE'],
    ['credential', 'MARKER_CREDENTIAL'],
  ])('blocks normalized credential key %s', (key, marker) => {
    const result = buildToolSessionDetails(
      { ...richDetails, answers: { safeFact: 'visible', [key]: marker } },
      'en'
    );
    expect(result).toContain('visible');
    expect(result).not.toContain(marker);
  });

  it.each([
    [{ api: { key: 'MARKER_NESTED_API_KEY' } }, 'MARKER_NESTED_API_KEY'],
    [{ auth: { header: 'MARKER_NESTED_AUTH_HEADER' } }, 'MARKER_NESTED_AUTH_HEADER'],
    [{ client: { secret: 'MARKER_NESTED_CLIENT_SECRET' } }, 'MARKER_NESTED_CLIENT_SECRET'],
    [{ session: { key: 'MARKER_NESTED_SESSION_KEY' } }, 'MARKER_NESTED_SESSION_KEY'],
  ])('blocks credential keys assembled across a nested path', (answers, marker) => {
    const result = buildToolSessionDetails({ ...richDetails, answers }, 'en');
    expect(result).not.toContain(marker);
  });

  it.each([
    ['Authorization: Bearer MARKER_NEUTRAL_BEARER', 'MARKER_NEUTRAL_BEARER'],
    ['Bearer MARKER_DIRECT_BEARER', 'MARKER_DIRECT_BEARER'],
    ['eyJMARKER_JWT.payload.signature', 'MARKER_JWT'],
    ['api_key=MARKER_ASSIGNED_API_KEY', 'MARKER_ASSIGNED_API_KEY'],
    ['client-secret: MARKER_ASSIGNED_SECRET', 'MARKER_ASSIGNED_SECRET'],
  ])('rejects credential material inside a neutral notes value', (notes, marker) => {
    const result = buildToolSessionDetails(
      { ...richDetails, answers: { safeFact: 'visible', notes } },
      'en'
    );
    expect(result).toContain('visible');
    expect(result).not.toContain(marker);
  });

  it('parses serialized object and array facts into prose without emitting raw JSON', () => {
    const result = buildToolSessionDetails(
      {
        ...richDetails,
        answers: {
          serializedObject: JSON.stringify({ market: 'Poland', score: 7 }),
          serializedArray: JSON.stringify(['partner readiness', 'capacity review']),
        },
      },
      'en'
    );

    expect(result).toContain('Poland');
    expect(result).toContain('score: 7');
    expect(result).toContain('partner readiness');
    expect(result).toContain('capacity review');
    expect(result).not.toMatch(/[{}"]/);
    expect(result).not.toContain('[');
    expect(result).not.toContain(']');
  });

  it('filters credentials recursively from serialized JSON strings', () => {
    const markers = [
      'MARKER_JSON_API_KEY',
      'MARKER_JSON_CLIENT_SECRET',
      'MARKER_JSON_BEARER',
      'MARKER_JSON_JWT',
      'MARKER_ARRAY_API_KEY',
      'MARKER_ARRAY_BEARER',
    ];
    const result = buildToolSessionDetails(
      {
        ...richDetails,
        answers: {
          serializedObject: JSON.stringify({
            safeFact: 'serialized-safe-fact',
            apiKey: markers[0],
            nested: { clientSecret: markers[1] },
            notes: `Authorization: Bearer ${markers[2]}`,
            diagnostic: `eyJ${markers[3]}.payload.signature`,
          }),
          serializedArray: JSON.stringify([
            'serialized-safe-array-fact',
            { api_key: markers[4] },
            `Bearer ${markers[5]}`,
          ]),
        },
      },
      'en'
    );

    expect(result).toContain('serialized-safe-fact');
    expect(result).toContain('serialized-safe-array-fact');
    markers.forEach((marker) => expect(result).not.toContain(marker));
  });

  it.each([
    ['{"safe":"MARKER_TRUNCATED_OBJECT"', 'MARKER_TRUNCATED_OBJECT'],
    ['["MARKER_TRUNCATED_ARRAY"', 'MARKER_TRUNCATED_ARRAY'],
    ['{"safe":"MARKER_TRAILING_GARBAGE"} trailing', 'MARKER_TRAILING_GARBAGE'],
  ])('rejects malformed JSON-like strings without scalar fallback', (payload, marker) => {
    const result = buildToolSessionDetails(
      { ...richDetails, answers: { safeFact: 'visible', payload } },
      'en'
    );

    expect(result).toContain('visible');
    expect(result).not.toContain(marker);
    expect(result).not.toContain(payload);
    expect(result).not.toMatch(/[{}"]/);
    expect(result).not.toContain('[');
    expect(result).not.toContain(']');
  });

  it('applies the same fail-closed JSON-like normalization to every top-level field', () => {
    const markers = [
      'MARKER_NAME_JSON',
      'MARKER_TYPE_JSON',
      'MARKER_STATUS_TRUNCATED',
      'MARKER_CREATED_TRAILING',
      'MARKER_UPDATED_TRUNCATED',
    ];
    const result = buildToolSessionDetails(
      {
        id: 'top-level-json-like',
        name: JSON.stringify({ x: markers[0] }),
        toolType: JSON.stringify([markers[1]]),
        status: `{"x":"${markers[2]}"`,
        createdAt: `{"x":"${markers[3]}"} trailing`,
        updatedAt: `["${markers[4]}"`,
        answers: {},
        contextSnapshot: {},
      },
      'en'
    );

    expect(result).toBe('');
    markers.forEach((marker) => expect(result).not.toContain(marker));
    expect(result).not.toMatch(/[{}"]/);
    expect(result).not.toContain('[');
    expect(result).not.toContain(']');
  });

  it('returns canonical empty text for null or a truly empty session', () => {
    expect(buildToolSessionDetails(null, 'en')).toBe('');
    expect(
      buildToolSessionDetails(
        { id: '', name: '', toolType: '', status: '', answers: {}, contextSnapshot: {} },
        'pl'
      )
    ).toBe('');
  });
});

describe('ToolSessionPreviewV3Body details', () => {
  it('renders factual details and uses the canonical empty state without the retired AI placeholder', () => {
    const { rerender } = render(
      <ToolSessionPreviewV3Body
        itemName="Fallback name"
        itemToolType="SWOT"
        status="draft"
        details={richDetails}
      />
    );

    expect(screen.getByTestId('details')).toHaveTextContent('European growth options');
    expect(screen.queryByText(/Use AI hints in the footer/i)).not.toBeInTheDocument();

    rerender(
      <ToolSessionPreviewV3Body
        itemName="Fallback name"
        itemToolType="SWOT"
        status="draft"
        details={null}
      />
    );

    expect(screen.getByTestId('details')).toHaveTextContent('No description available');
    expect(screen.queryByText(/Use AI hints in the footer/i)).not.toBeInTheDocument();
  });
});
