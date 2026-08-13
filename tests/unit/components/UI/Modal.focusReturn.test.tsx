/**
 * Modal (`src/components/ui/primitives/Modal.tsx`) — focus return to the
 * real trigger, not `<body>` (RN-G5 platform lane, 2026-08-12, P1 nr 2).
 *
 * `tests/unit/components/UI/Modal.test.tsx` (pre-existing) tests a local
 * `MockModal` fixture that reimplements none of this component's actual
 * focus logic — it proves nothing about the real bug. This file imports
 * and exercises the REAL `Modal` component.
 *
 * Root cause (measured with instrumented Playwright against the real app,
 * see task report — not guessed): the ORIGINAL code captured
 * `document.activeElement` inside a plain `useEffect`, which runs AFTER
 * React's `commitMount` has already applied the modal body's own
 * `autoFocus` field (a common pattern in this codebase's write forms, e.g.
 * `RoiCaseCreateModal`'s title input). A persistent trigger (a Menu 2 CTA
 * that stays mounted) lost that race every time; a kebab-menu trigger only
 * "looked" fine by the accident of a completely unrelated sibling effect
 * (`RowActionsMenu`'s own focus-return-to-kebab effect) happening to run
 * first and overwrite the stolen focus before Modal's effect read it.
 *
 * Fix: capture the opener during RENDER on the open-transition edge
 * (before this component's own commit, so before its own body can steal
 * focus), with a passive-effect fallback for when that captured element
 * doesn't survive to the same commit (the kebab-item case, where a sibling
 * component's own focus-return effect is expected to already have fixed
 * things up by the time Modal's effect runs).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from '../../../../src/components/ui/primitives/Modal';

// Established repo pattern (e.g. tests/unit/components/MyWork/MyTasksList.test.tsx):
// strip framer-motion's exit animation so `AnimatePresence` unmounts
// synchronously in jsdom instead of waiting on animation frames that never
// tick in the test environment — irrelevant to the focus-return logic under
// test here.
const stripMotionProps = (props: Record<string, unknown>) => {
  const {
    initial, animate, exit, variants, transition, whileTap, whileHover, whileFocus, whileDrag,
    ...rest
  } = props;
  return rest;
};
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...stripMotionProps(props)}>{children}</div>,
    // `Button` (rendered by Modal's close button / footer buttons) also
    // uses `motion.button` internally — needs its own stub or React throws
    // "Element type is invalid" on an undefined `motion.button`.
    button: ({ children, ...props }: any) => <button {...stripMotionProps(props)}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('Modal · focus return to trigger (P1 nr 2)', () => {
  it('returns focus to a persistent CTA on close, even when the modal body has an autoFocus field', () => {
    // Mirrors RoiCaseCreateModal.tsx: Modal mounted early with open=false,
    // opened later by a CTA that stays mounted; the body's first input has
    // `autoFocus`.
    function Harness(): React.ReactElement {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" data-testid="cta" onClick={() => setOpen(true)}>
            New case
          </button>
          <Modal open={open} onClose={() => setOpen(false)} title="New case">
            <input data-testid="autofocus-input" autoFocus />
          </Modal>
        </div>
      );
    }

    render(<Harness />);
    const cta = screen.getByTestId('cta');
    cta.focus();
    fireEvent.click(cta);

    // The autoFocus input really did steal focus (sanity check the setup
    // reproduces the race, not just asserting the desired outcome).
    expect(document.activeElement).toBe(screen.getByTestId('autofocus-input'));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(cta);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('returns focus to the trigger when the Modal fiber itself only mounts once already open (RoiTransitionDialog pattern)', () => {
    // Mirrors RoiTransitionDialog.tsx: the wrapping component returns
    // `null` (no <Modal> in the tree at all) until it has content, so
    // <Modal>'s FIRST EVER render already has open=true — no prior
    // open=false render exists for this fiber.
    function ConditionalDialog({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement | null {
      if (!open) return null;
      return (
        <Modal open={open} onClose={onClose} title="Confirm">
          <textarea data-testid="autofocus-textarea" autoFocus />
        </Modal>
      );
    }

    function Harness(): React.ReactElement {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" data-testid="trigger" onClick={() => setOpen(true)}>
            Cancel case
          </button>
          <ConditionalDialog open={open} onClose={() => setOpen(false)} />
        </div>
      );
    }

    render(<Harness />);
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('self-heals when the captured opener is removed from the DOM in the same commit that opens the modal (kebab-item pattern)', () => {
    // Mirrors the RowActionsMenu kebab flow: the literal DOM node focused
    // at click time (a menu item) is removed from the DOM in the SAME
    // commit that opens the modal. A sibling component (RowActionsMenu,
    // out of scope here) is responsible for re-pointing real focus at the
    // durable kebab button via its own effect — which, by ordering, runs
    // before Modal's passive fallback effect. This test stands in for that
    // sibling with a manual `.focus()` call made synchronously in the same
    // click handler, then removes the original node — proving Modal's
    // fallback trusts the DOM's live answer instead of a stale ref.
    function Harness(): React.ReactElement {
      const [open, setOpen] = useState(false);
      const kebabRef = React.useRef<HTMLButtonElement>(null);
      const itemRef = React.useRef<HTMLButtonElement>(null);
      const [menuMounted, setMenuMounted] = useState(true);

      const handleItemClick = () => {
        // Sibling's own "return focus to kebab" contract, firing in the
        // same synchronous batch as the modal open + item removal.
        kebabRef.current?.focus();
        setMenuMounted(false);
        setOpen(true);
      };

      return (
        <div>
          <button type="button" data-testid="kebab" ref={kebabRef}>
            ⋮
          </button>
          {menuMounted ? (
            <button type="button" data-testid="menu-item" ref={itemRef} onClick={handleItemClick}>
              Cancel case
            </button>
          ) : null}
          <Modal open={open} onClose={() => setOpen(false)} title="Confirm">
            <textarea data-testid="autofocus-textarea" autoFocus />
          </Modal>
        </div>
      );
    }

    render(<Harness />);
    const menuItem = screen.getByTestId('menu-item');
    menuItem.focus();
    fireEvent.click(menuItem);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('menu-item')).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId('kebab'));
    expect(document.activeElement).not.toBe(document.body);
  });
});
