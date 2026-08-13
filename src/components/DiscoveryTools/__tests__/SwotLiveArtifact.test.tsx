/**
 * Dynamic SWOT — LIVE Artifact tests.
 *
 * Each test maps directly to one behaviour required of the live field
 * (see src/components/DiscoveryTools/live/SwotLiveArtifact.tsx doc comment):
 *  1. accepted → in the field; not-accepted → excluded, shown outside it.
 *  2. fact/observation/hypothesis are visually distinct; hypothesis never
 *     carries the fact tone.
 *  3. reclassifying an item moves it between quadrants.
 *  4. SO/WO/ST/WT relations come from the engine, not from the view.
 *  5. tension weight is the engine's deterministic 3/2/1 sum, and is shown.
 *  6. a conflict (item pulled into >1 posture) highlights the relation.
 *  7. undo/redo works over reclassification.
 *  8. rebuilding the model / remounting the component ("reload") from the
 *     same items reproduces an identical result.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { deriveTensionCandidates } from '@/config/swot/swotTensionEngine';
import type { SWOTItem } from '@/store/useToolStore';

import { buildSwotFieldModel, SwotLiveArtifact } from '../live/SwotLiveArtifact';

function baseItems(): SWOTItem[] {
  return [
    {
      id: 'i1',
      text: 'Doświadczony zespół wdrożeń',
      impact: 'high',
      quadrant: 'strengths',
      proposalStatus: 'accepted',
      evidenceStatus: 'confirmed',
    },
    {
      id: 'i2',
      text: 'Rosnący popyt w DACH',
      impact: 'high',
      quadrant: 'opportunities',
      proposalStatus: 'accepted',
      evidenceStatus: 'declared',
    },
    {
      id: 'i3',
      text: 'Konkurent obniżył cenę wejścia',
      impact: 'medium',
      quadrant: 'threats',
      proposalStatus: 'accepted',
    },
    // NOT accepted — must never reach a quadrant or count toward tensions.
    {
      id: 'i4',
      text: 'Hipoteza: klienci chcą modelu subskrypcyjnego',
      impact: 'low',
      quadrant: 'opportunities',
      proposalStatus: 'ai-proposed',
    },
  ] as SWOTItem[];
}

/** Only one internal/external pair exists — the resulting tension cannot conflict. */
function noConflictItems(): SWOTItem[] {
  return [
    {
      id: 's1',
      text: 'Jedyna siła',
      impact: 'medium',
      quadrant: 'strengths',
      proposalStatus: 'accepted',
      evidenceStatus: 'confirmed',
    },
    {
      id: 'o1',
      text: 'Jedyna szansa',
      impact: 'medium',
      quadrant: 'opportunities',
      proposalStatus: 'accepted',
      evidenceStatus: 'confirmed',
    },
  ] as SWOTItem[];
}

describe('SwotLiveArtifact — acceptance gate', () => {
  it('renders accepted items in their quadrant and keeps non-accepted items out of the field', () => {
    render(<SwotLiveArtifact items={baseItems()} />);

    expect(
      within(screen.getByTestId('swot-quadrant-strengths')).getByTestId('swot-item-i1')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('swot-quadrant-opportunities')).getByTestId('swot-item-i2')
    ).toBeInTheDocument();

    // i4 is not accepted: never rendered as a field item anywhere...
    expect(screen.queryByTestId('swot-item-i4')).not.toBeInTheDocument();
    // ...but shown explicitly outside the field, labelled as excluded from Output.
    expect(screen.getByTestId('swot-pending-tray')).toBeInTheDocument();
    expect(screen.getByTestId('swot-pending-i4')).toBeInTheDocument();
  });

  it('keeps the acceptance gate in the pure model too (buildSwotFieldModel)', () => {
    const model = buildSwotFieldModel(baseItems());
    expect(model.accepted.map((i) => i.id).sort()).toEqual(['i1', 'i2', 'i3']);
    expect(model.pending.map((i) => i.id)).toEqual(['i4']);
  });
});

describe('SwotLiveArtifact — evidence kind', () => {
  it('gives fact/observation/hypothesis distinct tones; a hypothesis never carries the fact tone', () => {
    render(<SwotLiveArtifact items={baseItems()} />);

    const fact = screen.getByTestId('swot-evidence-i1'); // confirmed
    const hypothesis = screen.getByTestId('swot-evidence-i2'); // declared
    const observation = screen.getByTestId('swot-evidence-i3'); // no evidenceStatus

    expect(fact).toHaveAttribute('data-evidence-kind', 'fact');
    expect(hypothesis).toHaveAttribute('data-evidence-kind', 'hypothesis');
    expect(observation).toHaveAttribute('data-evidence-kind', 'observation');

    expect(fact.className).toContain('text-c-success');
    expect(hypothesis.className).toContain('text-c-warning');
    expect(observation.className).toContain('text-c-info');

    // The hard requirement: hypothesis must never look like a fact.
    expect(hypothesis.className).not.toContain('text-c-success');
    expect(hypothesis.className).not.toBe(fact.className);
  });
});

describe('SwotLiveArtifact — reclassification moves items', () => {
  it('moves an item to a new quadrant when its classification changes', () => {
    render(<SwotLiveArtifact items={baseItems()} />);

    expect(
      within(screen.getByTestId('swot-quadrant-strengths')).getByTestId('swot-item-i1')
    ).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('swot-reclassify-i1'), {
      target: { value: 'weaknesses' },
    });

    expect(
      within(screen.getByTestId('swot-quadrant-weaknesses')).getByTestId('swot-item-i1')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('swot-quadrant-strengths')).queryByTestId('swot-item-i1')
    ).not.toBeInTheDocument();
  });

  it('calls onItemChange with the new quadrant so a caller can persist it', () => {
    const calls: Array<[string, Partial<SWOTItem>]> = [];
    render(
      <SwotLiveArtifact
        items={baseItems()}
        onItemChange={(id, updates) => calls.push([id, updates])}
      />
    );
    fireEvent.change(screen.getByTestId('swot-reclassify-i1'), {
      target: { value: 'threats' },
    });
    expect(calls).toEqual([['i1', { quadrant: 'threats' }]]);
  });
});

describe('SwotLiveArtifact — relations come from the engine', () => {
  it('the model never invents SO/WO/ST/WT pairs of its own — it reuses deriveTensionCandidates verbatim', () => {
    const items = baseItems();
    const modelTensions = buildSwotFieldModel(items).tensions.map(
      ({ id: _id, conflict: _conflict, ...rest }) => rest
    );
    const engineTensions = deriveTensionCandidates(items);
    expect(modelTensions).toEqual(engineTensions);
  });
});

describe('SwotLiveArtifact — deterministic weight', () => {
  it('shows the engine-computed 3/2/1 impact weight sum for the SO tension', () => {
    const items = baseItems(); // i1 high(3) + i2 high(3)
    const model = buildSwotFieldModel(items);
    const so = model.tensions.find((t) => t.type === 'SO');
    expect(so?.weight).toBe(6);

    render(<SwotLiveArtifact items={items} />);
    expect(screen.getByTestId(`swot-tension-weight-${so!.id}`)).toHaveTextContent('6');
  });

  it('shows the medium-impact ST tension weight (high 3 + medium 2 = 5)', () => {
    const items = baseItems(); // i1 high(3) + i3 medium(2)
    const model = buildSwotFieldModel(items);
    const st = model.tensions.find((t) => t.type === 'ST');
    expect(st?.weight).toBe(5);

    render(<SwotLiveArtifact items={items} />);
    expect(screen.getByTestId(`swot-tension-weight-${st!.id}`)).toHaveTextContent('5');
  });
});

describe('SwotLiveArtifact — conflict highlighting', () => {
  it('flags and visually highlights a tension whose item is pulled into more than one posture', () => {
    const items = baseItems(); // i1 (strength) anchors both SO/attack and ST/defend
    const model = buildSwotFieldModel(items);
    const conflicting = model.tensions.filter((t) => t.conflict);
    expect(conflicting.length).toBeGreaterThan(0);

    render(<SwotLiveArtifact items={items} />);
    conflicting.forEach((t) => {
      expect(screen.getByTestId(`swot-tension-${t.id}`)).toHaveAttribute('data-conflict', 'true');
      expect(screen.getByTestId(`swot-conflict-badge-${t.id}`)).toBeInTheDocument();
    });
  });

  it('does not flag conflict when only a single tension can be formed', () => {
    const items = noConflictItems();
    const model = buildSwotFieldModel(items);
    expect(model.tensions).toHaveLength(1);
    expect(model.tensions[0].conflict).toBe(false);

    render(<SwotLiveArtifact items={items} />);
    expect(screen.queryByTestId(`swot-conflict-badge-${model.tensions[0].id}`)).not.toBeInTheDocument();
  });
});

describe('SwotLiveArtifact — undo/redo', () => {
  it('undo is disabled until a change is made, then restores the previous quadrant', () => {
    render(<SwotLiveArtifact items={baseItems()} />);
    expect(screen.getByTestId('swot-undo')).toBeDisabled();

    fireEvent.change(screen.getByTestId('swot-reclassify-i1'), {
      target: { value: 'weaknesses' },
    });
    expect(screen.getByTestId('swot-undo')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('swot-undo'));

    expect(
      within(screen.getByTestId('swot-quadrant-strengths')).getByTestId('swot-item-i1')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('swot-quadrant-weaknesses')).queryByTestId('swot-item-i1')
    ).not.toBeInTheDocument();
  });

  it('redo re-applies a reclassification that was undone', () => {
    render(<SwotLiveArtifact items={baseItems()} />);
    fireEvent.change(screen.getByTestId('swot-reclassify-i1'), {
      target: { value: 'weaknesses' },
    });
    fireEvent.click(screen.getByTestId('swot-undo'));
    fireEvent.click(screen.getByTestId('swot-redo'));

    expect(
      within(screen.getByTestId('swot-quadrant-weaknesses')).getByTestId('swot-item-i1')
    ).toBeInTheDocument();
  });
});

describe('SwotLiveArtifact — reload does not change semantics', () => {
  it('buildSwotFieldModel is a pure function of items: rebuilding from an identical (deep-cloned) session yields an identical model', () => {
    const items = baseItems();
    const first = buildSwotFieldModel(items);
    const second = buildSwotFieldModel(JSON.parse(JSON.stringify(items)));
    expect(second).toEqual(first);
  });

  it('remounting the component with the same items reproduces the same field, byte for byte', () => {
    const items = baseItems();
    const { unmount } = render(<SwotLiveArtifact items={items} />);
    const before = screen.getByTestId('swot-live-artifact').innerHTML;
    unmount();

    render(<SwotLiveArtifact items={items} />);
    const after = screen.getByTestId('swot-live-artifact').innerHTML;
    expect(after).toBe(before);
  });
});
