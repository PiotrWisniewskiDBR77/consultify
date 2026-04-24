/**
 * Chat V9 / INPUT C-IN1 — tests for the Next-message model hint chip.
 *
 * Coverage:
 *   - `resolveNextModelLabel` pure helper: empty inputs, private match,
 *     selectedModelId preference, UUID fallback, truncation.
 *   - Component flag gate (ON → chip renders, OFF → null).
 *   - `overrideLabel` prop short-circuit for deterministic rendering.
 *   - Store selector path wires the aiConfig through `resolveNextModelLabel`.
 *   - Null output when no model id is resolvable.
 *   - Read-only surface: chip has `role="status"` and is not a button.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NextModelChip, resolveNextModelLabel } from '../NextModelChip';

type StoreState = { currentUser?: { aiConfig?: unknown } };

let mockStoreState: StoreState = {};

vi.mock('../../../store/useAppStore', () => ({
  useAppStore: (selector: (state: StoreState) => unknown) => selector(mockStoreState),
}));

describe('resolveNextModelLabel', () => {
  it('returns null for empty / non-object inputs', () => {
    expect(resolveNextModelLabel(undefined)).toBeNull();
    expect(resolveNextModelLabel(null)).toBeNull();
    expect(resolveNextModelLabel('gpt-4o')).toBeNull();
    expect(resolveNextModelLabel({})).toBeNull();
    expect(resolveNextModelLabel({ modelId: '   ' })).toBeNull();
  });

  it('returns the raw modelId for short human-readable ids', () => {
    expect(resolveNextModelLabel({ modelId: 'gpt-4o' })).toBe('gpt-4o');
    expect(resolveNextModelLabel({ modelId: 'llama3:8b' })).toBe('llama3:8b');
  });

  it('prefers selectedModelId over modelId when both are set', () => {
    expect(resolveNextModelLabel({ modelId: 'gpt-4o', selectedModelId: 'claude-3-haiku' })).toBe(
      'claude-3-haiku'
    );
  });

  it('substitutes a friendly label when the id looks like a UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(resolveNextModelLabel({ modelId: uuid })).toBe('Default model');
    expect(resolveNextModelLabel({ selectedModelId: uuid.toUpperCase() })).toBe('Default model');
  });

  it('truncates labels over 22 chars with an ellipsis', () => {
    const long = 'some-extremely-long-private-model-name';
    const out = resolveNextModelLabel({ modelId: long });
    expect(out).toMatch(/^.{22}$/);
    expect(out?.endsWith('…')).toBe(true);
  });

  it('resolves the private model name when the id matches a private entry', () => {
    const result = resolveNextModelLabel({
      selectedModelId: 'private-123',
      modelId: 'gpt-4o',
      privateModels: [{ id: 'private-123', modelId: 'gpt-4o', name: 'Acme On-Prem' }],
    });
    expect(result).toBe('Acme On-Prem');
  });

  it('resolves the private model by modelId when id does not match', () => {
    const result = resolveNextModelLabel({
      modelId: 'custom-engine',
      privateModels: [{ id: 'private-xyz', modelId: 'custom-engine', name: 'Custom Engine' }],
    });
    expect(result).toBe('Custom Engine');
  });

  it('ignores private entries without a usable name', () => {
    const result = resolveNextModelLabel({
      modelId: 'gpt-4o',
      privateModels: [{ id: 'x', modelId: 'gpt-4o', name: '   ' }],
    });
    expect(result).toBe('gpt-4o');
  });
});

describe('NextModelChip (component)', () => {
  afterEach(() => {
    mockStoreState = {};
  });

  // -------------------------------------------------------------------
  // Flag gate.
  // -------------------------------------------------------------------
  it('returns null when the feature flag is disabled', () => {
    mockStoreState = { currentUser: { aiConfig: { modelId: 'gpt-4o' } } };
    const { container } = render(<NextModelChip isEnabled={() => false} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when the resolved label is empty (no model id configured)', () => {
    mockStoreState = { currentUser: { aiConfig: {} } };
    const { container } = render(<NextModelChip isEnabled={() => true} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when there is no current user at all', () => {
    mockStoreState = {};
    const { container } = render(<NextModelChip isEnabled={() => true} />);
    expect(container.firstChild).toBeNull();
  });

  // -------------------------------------------------------------------
  // Store-driven rendering — the primary production path.
  // -------------------------------------------------------------------
  it('renders the chip with the resolved model label from the store', () => {
    mockStoreState = { currentUser: { aiConfig: { modelId: 'gpt-4o' } } };
    render(<NextModelChip isEnabled={() => true} />);

    const chip = screen.getByTestId('next-model-chip');
    expect(chip).toBeInTheDocument();
    expect(chip.textContent).toContain('gpt-4o');
  });

  it('renders the UUID fallback label when modelId is a UUID', () => {
    mockStoreState = {
      currentUser: { aiConfig: { modelId: '550e8400-e29b-41d4-a716-446655440000' } },
    };
    render(<NextModelChip isEnabled={() => true} />);
    expect(screen.getByTestId('next-model-chip').textContent).toContain('Default model');
  });

  // -------------------------------------------------------------------
  // overrideLabel prop — short-circuit for deterministic tests/hosts.
  // -------------------------------------------------------------------
  it('uses the overrideLabel prop when provided, ignoring the store', () => {
    mockStoreState = { currentUser: { aiConfig: { modelId: 'store-model' } } };
    render(<NextModelChip isEnabled={() => true} overrideLabel="manual-label" />);
    expect(screen.getByTestId('next-model-chip').textContent).toContain('manual-label');
  });

  it('returns null when overrideLabel is an empty string', () => {
    mockStoreState = { currentUser: { aiConfig: { modelId: 'store-model' } } };
    const { container } = render(<NextModelChip isEnabled={() => true} overrideLabel="" />);
    expect(container.firstChild).toBeNull();
  });

  // -------------------------------------------------------------------
  // Surface contract — the chip must be read-only.
  // -------------------------------------------------------------------
  it('renders as role="status" rather than a button (read-only surface)', () => {
    render(<NextModelChip isEnabled={() => true} overrideLabel="gpt-4o" />);
    const chip = screen.getByTestId('next-model-chip');
    expect(chip.getAttribute('role')).toBe('status');
    expect(chip.tagName.toLowerCase()).toBe('span');
  });

  it('exposes an aria-label that mentions the active model', () => {
    render(<NextModelChip isEnabled={() => true} overrideLabel="claude-3" />);
    const chip = screen.getByTestId('next-model-chip');
    expect(chip.getAttribute('aria-label')).toBe('Next send will use model claude-3');
  });
});
