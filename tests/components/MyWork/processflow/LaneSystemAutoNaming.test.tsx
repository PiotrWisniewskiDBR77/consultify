/**
 * PF-P2-02 (2026-08-10) — after `addLane` creates a new lane, the lane header
 * must immediately enter inline naming (focused input) instead of waiting for
 * a double-click, so a fresh lane never sits under its "Lane N" placeholder
 * un-noticed. Enter commits the typed name; Escape cancels without touching
 * the persisted default. This exercises `LaneSystem.tsx`'s `autoEdit` /
 * `onAutoEditConsumed` props directly (no `ReactFlowProvider` needed — the
 * plain `LaneSystem` component accepts an explicit `viewport` and defaults to
 * the identity viewport, same pattern used by `laneState.test.ts`-adjacent
 * component tests).
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { LaneSystem, type Lane } from '@/components/MyWork/processflow/LaneSystem';

function makeLane(overrides: Partial<Lane> = {}): Lane {
  return { id: 'lane-1', label: 'Lane 1', color: '#e0e7ff', ...overrides };
}

describe('LaneSystem — PF-P2-02 auto-naming on lane creation', () => {
  it('enters inline naming immediately when autoEditLaneId matches the lane, and consumes the trigger once', () => {
    const onAutoEditConsumed = vi.fn();
    const lane = makeLane();

    render(
      <LaneSystem
        lanes={[lane]}
        isPl={false}
        locked={false}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onColorChange={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        dragOverLaneId={null}
        autoEditLaneId={lane.id}
        onAutoEditConsumed={onAutoEditConsumed}
      />
    );

    // The label text is gone; a focused, editable input with the default
    // value takes its place — no double-click needed.
    expect(screen.queryByText('Lane 1')).not.toBeInTheDocument();
    const input = screen.getByDisplayValue('Lane 1') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(document.activeElement).toBe(input);

    // Trigger is consumed exactly once (not re-armed on later re-renders).
    expect(onAutoEditConsumed).toHaveBeenCalledTimes(1);
    expect(onAutoEditConsumed).toHaveBeenCalledWith(lane.id);
  });

  it('does not auto-enter naming for a lane that is not the autoEditLaneId', () => {
    const lane = makeLane({ id: 'lane-2', label: 'Lane 2' });

    render(
      <LaneSystem
        lanes={[lane]}
        isPl={false}
        locked={false}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onColorChange={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        dragOverLaneId={null}
        autoEditLaneId="some-other-lane"
        onAutoEditConsumed={vi.fn()}
      />
    );

    expect(screen.getByText('Lane 2')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Lane 2')).not.toBeInTheDocument();
  });

  it('Enter commits the typed name via onRename and closes the editor', () => {
    const onRename = vi.fn();
    const lane = makeLane();

    render(
      <LaneSystem
        lanes={[lane]}
        isPl={false}
        locked={false}
        onRename={onRename}
        onDelete={vi.fn()}
        onColorChange={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        dragOverLaneId={null}
        autoEditLaneId={lane.id}
        onAutoEditConsumed={vi.fn()}
      />
    );

    const input = screen.getByDisplayValue('Lane 1') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Onboarding' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith(lane.id, 'Onboarding');
    // Editor closed — no input left behind.
    expect(screen.queryByDisplayValue('Onboarding')).not.toBeInTheDocument();
  });

  it('Escape cancels without calling onRename, leaving the default label intact', () => {
    const onRename = vi.fn();
    const lane = makeLane();

    const { rerender } = render(
      <LaneSystem
        lanes={[lane]}
        isPl={false}
        locked={false}
        onRename={onRename}
        onDelete={vi.fn()}
        onColorChange={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        dragOverLaneId={null}
        autoEditLaneId={lane.id}
        onAutoEditConsumed={vi.fn()}
      />
    );

    const input = screen.getByDisplayValue('Lane 1') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Half-typed junk' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue('Half-typed junk')).not.toBeInTheDocument();

    // Re-render with the same (unchanged) lane — since onRename never fired,
    // the persisted default label is exactly what shows.
    act(() => {
      rerender(
        <LaneSystem
          lanes={[lane]}
          isPl={false}
          locked={false}
          onRename={onRename}
          onDelete={vi.fn()}
          onColorChange={vi.fn()}
          onMoveUp={vi.fn()}
          onMoveDown={vi.fn()}
          dragOverLaneId={null}
          autoEditLaneId={null}
          onAutoEditConsumed={vi.fn()}
        />
      );
    });
    expect(screen.getByText('Lane 1')).toBeInTheDocument();
  });
});
