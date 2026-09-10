/**
 * N5 (odbiór adwersaryjny 20260910, KOSMETYKA) — `LinkedItemsSection.tsx`'s
 * `searchItems` had two silent `catch {}` blocks: when `GET /tasks?search`
 * or `GET /decisions?search` failed, the linked-item search dropdown was
 * quietly incomplete — no toast, no console error, no signal to the user
 * (confirmed for real: `git grep "\.catch(() => {})"` in Initiatives/Execution
 * shows exactly these two hits on a read path — everything else matching
 * that pattern was a comment or test description, not executable code).
 *
 * Fix: report the failure via `toast.error`, the SAME mechanism this exact
 * wrapper already uses for add/remove failures (see `onAdd`/`onRemove`
 * below in the source) — no new component, no new UI surface.
 *
 * STOP for the reader: an earlier version of this fix reported the failure
 * back to `src/components/MyWork/shared/LinkedItemsSection.tsx` (widening
 * `searchItems`'s return shape) so it could show a caption in its own
 * search-results area. That file is frozen under module `07_MY_WORK_AGENT`
 * (`docs/program/MVP_FINAL_ZAMROZONE.json`) and this task carries no
 * unfreeze decision for that module (only `05_INITIATIVES DEC-453`) — so
 * that approach was reverted in favor of the toast, which stays entirely
 * inside the authorized file. Separately (and independently of the freeze):
 * that shared component's own "add link" panel — the one that would have
 * shown the caption — has no reachable way to open (`isAddingLink`/
 * `isAddingExternal` are only ever set back to `false` anywhere in that
 * 610-line file); flagged as a separate follow-up, out of scope here
 * ("ZERO nowych widoków/przycisków" forbids adding the missing trigger).
 */
import { render } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let capturedSearchItems: ((query: string) => Promise<any[]>) | undefined;

vi.mock('../../../MyWork/shared', () => ({
  LinkedItemsSection: (props: any) => {
    capturedSearchItems = props.searchItems;
    return <div data-testid="shared-linked-items-stub" />;
  },
}));

vi.mock('../InitiativeContext', () => ({
  useInitiativeContext: () => ({
    initiativeId: 'init-1',
    linkedItems: [],
    setLinkedItems: vi.fn(),
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(async (url: string) => {
      if (url.includes('/linked-items')) return { items: [] };
      if (url.startsWith('/tasks')) throw new Error('network error');
      if (url.startsWith('/decisions'))
        return { decisions: [{ id: 'd1', title: 'A decision', status: 'open' }] };
      throw new Error(`unexpected url in test: ${url}`);
    }),
  },
}));

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock('react-hot-toast', () => ({
  default: { error: toastErrorMock, success: vi.fn() },
}));

import { LinkedItemsSection } from '../LinkedItemsSection';

describe('Initiatives LinkedItemsSection.searchItems — partial failure reporting (N5)', () => {
  beforeEach(() => {
    capturedSearchItems = undefined;
    toastErrorMock.mockClear();
  });

  it(
    'toasts "Some results could not be retrieved" when the tasks search fails ' +
      'but still returns the decisions that DID succeed (fail-open, not silent)',
    async () => {
      render(<LinkedItemsSection sectionType={{} as any} expanded onToggle={() => {}} />);

      expect(capturedSearchItems).toBeTypeOf('function');
      const items = await capturedSearchItems!('foo');

      // MUTATION GUARD: pre-fix code swallowed the failure with no signal at
      // all — this assertion fails if the `catch {}` is restored bare.
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).toHaveBeenCalledWith('Some results could not be retrieved');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id: 'd1', type: 'decision', title: 'A decision' });
    }
  );

  it('does not toast when both underlying searches succeed', async () => {
    const { Api } = await import('@/services/api');
    (Api.get as any).mockImplementation(async (url: string) => {
      if (url.includes('/linked-items')) return { items: [] };
      if (url.startsWith('/tasks')) return { tasks: [{ id: 't1', title: 'A task', status: 'todo' }] };
      if (url.startsWith('/decisions'))
        return { decisions: [{ id: 'd1', title: 'A decision', status: 'open' }] };
      throw new Error(`unexpected url in test: ${url}`);
    });

    render(<LinkedItemsSection sectionType={{} as any} expanded onToggle={() => {}} />);
    const items = await capturedSearchItems!('foo');

    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(items).toHaveLength(2);
  });
});
