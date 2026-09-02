/**
 * @vitest-environment jsdom
 *
 * Rodzina "surowy identyfikator/enum zamiast etykiety" (dyżur 2026-09-02).
 * `Watcher.notifyOn` to zamknięty enum ('all' | 'mentions' | 'status_changes').
 * Panel "Watching" pokazywał tę wartość wprost — użytkownik widział
 * "Notify: status_changes" zamiast tłumaczonej etykiety.
 *
 * Dowód mutacyjny: dwa rendery z różną wartością enum dla tego samego watchera
 * muszą dać różny, przetłumaczony tekst — nie surowy klucz enuma.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import WatchingTab from '../WatchingTab';
import type { Watcher } from '../../../../hooks/useUserNotificationPreferences';

function makeWatcher(overrides: Partial<Watcher>): Watcher {
  return {
    id: 'w-1',
    objectType: 'task',
    objectId: 'task-abc',
    notifyOn: 'all',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('WatchingTab — notifyOn enum shows a human label, not the raw value', () => {
  it('renders "all" as a human label, not the raw enum value', () => {
    render(
      <WatchingTab
        watchers={[makeWatcher({ notifyOn: 'all' })]}
        onAddWatcher={async () => {}}
        onRemoveWatcher={async () => {}}
      />
    );
    expect(screen.queryByText(/^all$/)).toBeNull();
    expect(screen.queryByText(/^status_changes$/)).toBeNull();
  });

  it('MUTATION: switching the enum value changes the rendered label', () => {
    const { rerender, container } = render(
      <WatchingTab
        watchers={[makeWatcher({ notifyOn: 'mentions' })]}
        onAddWatcher={async () => {}}
        onRemoveWatcher={async () => {}}
      />
    );
    const textForMentions = container.textContent;
    expect(textForMentions).not.toMatch(/\bmentions\b/); // raw enum value absent

    rerender(
      <WatchingTab
        watchers={[makeWatcher({ notifyOn: 'status_changes' })]}
        onAddWatcher={async () => {}}
        onRemoveWatcher={async () => {}}
      />
    );
    const textForStatusChanges = container.textContent;
    expect(textForStatusChanges).not.toMatch(/status_changes/);
    // The two renders must differ — proves the label follows the data, not a
    // hardcoded constant.
    expect(textForStatusChanges).not.toBe(textForMentions);
  });

  it('falls back to the raw value only for an unknown enum (no atrapa)', () => {
    render(
      <WatchingTab
        watchers={[makeWatcher({ notifyOn: 'some_future_value' as Watcher['notifyOn'] })]}
        onAddWatcher={async () => {}}
        onRemoveWatcher={async () => {}}
      />
    );
    expect(screen.getByText(/some_future_value/)).toBeTruthy();
  });
});
