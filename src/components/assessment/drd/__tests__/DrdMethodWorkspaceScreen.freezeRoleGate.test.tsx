/**
 * A10/D1 — regresja: przycisk „Zamroź (tylko approver)" MUSI sprawdzać rolę
 * aktora, nie tylko stan sesji.
 *
 * Defekt znaleziony przez audyt A10 (agent S7), potwierdzony interaktywnie:
 * `disabled` patrzyło wyłącznie na `session.state`, więc przycisk był aktywny
 * także dla ownera — runtime odrzucał dopiero PO kliknięciu. UI nie może
 * oferować akcji, która zawsze zakończy się odmową.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DrdMethodWorkspaceScreen } from '../DrdMethodWorkspaceScreen';

function storage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

describe('A10/D1 — bramka roli na przycisku freeze', () => {
  it('OWNER w stanie in_review: przycisk freeze jest ZABLOKOWANY', () => {
    render(
      <DrdMethodWorkspaceScreen
        storage={storage()}
        seedTo="approval"
        initialActorUserId="demo-owner-piotr"
        forceHttpSourceOfTruth={false}
      />
    );
    const btn = screen.getByTestId('freeze-button');
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('title')).toMatch(/approver/i);
  });

  it('APPROVER w stanie in_review: przycisk freeze jest AKTYWNY', () => {
    render(
      <DrdMethodWorkspaceScreen
        storage={storage()}
        seedTo="approval"
        initialActorUserId="demo-approver-anna"
        forceHttpSourceOfTruth={false}
      />
    );
    expect(screen.getByTestId('freeze-button')).not.toBeDisabled();
  });

  it('APPROVER, ale sesja NIE jest in_review: nadal zablokowany', () => {
    render(
      <DrdMethodWorkspaceScreen
        storage={storage()}
        seedTo="interview"
        initialActorUserId="demo-approver-anna"
        forceHttpSourceOfTruth={false}
      />
    );
    expect(screen.getByTestId('freeze-button')).toBeDisabled();
  });
});
