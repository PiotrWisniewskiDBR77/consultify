/**
 * Canon component kit — behavioural tests for the standard-as-code
 * (src/components/shared/canon). These lock the invariants that make the
 * components "the standard by construction":
 *   - ArtifactPanel renders sections in the ENFORCED order regardless of prop order
 *   - ArtifactPanel skips empty sections (order preserved)
 *   - ArtifactHeaderBar/ModuleHeaderBar carry exactly ONE primary slot
 *   - ArtifactHeaderBar element order: back → icon → title → status → save → index → primary
 *   - QuietChip is borderless (vs StatusPill), maps semantic tones
 *   - MetaField pins the label/value convention
 *   - SaveIndicator is a separate concern from lifecycle status
 *   - renderCappedTags caps at 2 + "+N"
 */

import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import {
  ArtifactHeaderBar,
  ArtifactPanel,
  ARTIFACT_PANEL_SECTION_ORDER,
  MetaField,
  MetaStrip,
  ModuleHeaderBar,
  QuietChip,
  SaveIndicator,
  renderCappedTags,
} from '@/components/shared/canon';

describe('ArtifactPanel — enforced section order', () => {
  it('renders sections in the canonical order even when props are passed out of order', () => {
    const { container } = render(
      // Deliberately pass history/comments/relations first — order must not follow prop order.
      <ArtifactPanel
        history={<div>hist-body</div>}
        comments={<div>comm-body</div>}
        relations={<div>rel-body</div>}
        properties={<div>prop-body</div>}
        actions={<div>act-body</div>}
      />,
    );
    const sections = Array.from(
      container.querySelectorAll('section[data-section]'),
    ).map((el) => el.getAttribute('data-section'));
    expect(sections).toEqual(ARTIFACT_PANEL_SECTION_ORDER);
    expect(sections).toEqual([
      'actions',
      'properties',
      'relations',
      'comments',
      'history',
    ]);
  });

  it('skips sections with no content but preserves the order of the rest', () => {
    const { container } = render(
      <ArtifactPanel
        actions={<div>a</div>}
        relations={<div>r</div>}
        history={<div>h</div>}
      />,
    );
    const sections = Array.from(
      container.querySelectorAll('section[data-section]'),
    ).map((el) => el.getAttribute('data-section'));
    expect(sections).toEqual(['actions', 'relations', 'history']);
    // properties + comments omitted
    expect(sections).not.toContain('properties');
    expect(sections).not.toContain('comments');
  });

  it('honors localized section labels without changing order', () => {
    const { container } = render(
      <ArtifactPanel
        actions={<div>a</div>}
        properties={<div>p</div>}
        sectionLabels={{ actions: 'Akcje', properties: 'Właściwości' }}
      />,
    );
    expect(screen.getByText('Akcje')).toBeInTheDocument();
    expect(screen.getByText('Właściwości')).toBeInTheDocument();
    const sections = Array.from(
      container.querySelectorAll('section[data-section]'),
    ).map((el) => el.getAttribute('data-section'));
    expect(sections).toEqual(['actions', 'properties']);
  });
});

describe('ArtifactHeaderBar — one primary + fixed element order', () => {
  it('renders a single primary action slot', () => {
    render(
      <ArtifactHeaderBar
        title="My Tool"
        primaryAction={<button>Start session</button>}
      />,
    );
    // exactly one non-icon button (the primary); no back button here.
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('Start session');
  });

  it('orders identity elements: back → title → status → save → index → primary', () => {
    const { container } = render(
      <ArtifactHeaderBar
        onBack={() => {}}
        typeIcon={<svg data-testid="type-icon" />}
        title={<span>Tool Alpha</span>}
        status="draft"
        saveState="saved"
        index={{ current: 2, total: 9 }}
        primaryAction={<button>Generate</button>}
      />,
    );
    const text = container.textContent ?? '';
    // status humanizes "draft" → "Draft"; save shows "Saved"; index "2 / 9".
    const titleIdx = text.indexOf('Tool Alpha');
    const statusIdx = text.indexOf('Draft');
    const savedIdx = text.indexOf('Saved');
    const indexIdx = text.indexOf('2 / 9');
    const primaryIdx = text.indexOf('Generate');
    expect(titleIdx).toBeGreaterThanOrEqual(0);
    expect(titleIdx).toBeLessThan(statusIdx);
    expect(statusIdx).toBeLessThan(savedIdx);
    expect(savedIdx).toBeLessThan(indexIdx);
    expect(indexIdx).toBeLessThan(primaryIdx);
    // back button present with an accessible label
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});

describe('ModuleHeaderBar — title + single primary + optional search', () => {
  it('renders title and a single primary; no search toggle by default', () => {
    render(
      <ModuleHeaderBar title="Tools" primaryAction={<button>Add</button>} />,
    );
    expect(screen.getByRole('heading', { name: 'Tools' })).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('Add');
  });

  it('renders a search toggle when onSearchToggle is provided', () => {
    render(
      <ModuleHeaderBar
        title="Tools"
        onSearchToggle={() => {}}
        primaryAction={<button>Add</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });
});

describe('QuietChip — borderless semantic chip', () => {
  it('renders a borderless soft-tint chip mapped to the semantic tone', () => {
    const { container } = render(<QuietChip status="approved" />);
    const chip = container.firstChild as HTMLElement;
    // emerald tone, borderless (no border-* utility)
    expect(chip.className).toContain('emerald');
    expect(chip.className).not.toMatch(/(^|\s)border(\s|-)/);
    expect(chip).toHaveTextContent('Approved');
  });

  it('dot variant shows a neutral label with a colored dot', () => {
    const { container } = render(
      <QuietChip status="blocked" variant="dot" label="Blocked" />,
    );
    expect(container).toHaveTextContent('Blocked');
    // a dot element exists (rose tone)
    const dot = container.querySelector('span span');
    expect(dot?.className).toContain('rose');
  });
});

describe('MetaField / MetaStrip — one metadata convention', () => {
  it('renders an uppercase muted label and a value', () => {
    render(<MetaField label="Owner" value="Anna K." />);
    const label = screen.getByText('Owner');
    expect(label.className).toContain('uppercase');
    expect(label.className).toContain('text-c-text-muted');
    expect(screen.getByText('Anna K.')).toBeInTheDocument();
  });

  it('renders a slot (children) in place of a text value', () => {
    render(
      <MetaField label="Status">
        <QuietChip status="approved" />
      </MetaField>,
    );
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('MetaStrip separates fields with hairline dividers (horizontal)', () => {
    const { container } = render(
      <MetaStrip>
        <MetaField label="Owner" value="A" />
        <MetaField label="Updated" value="2h" />
      </MetaStrip>,
    );
    // one divider between two fields
    const dividers = container.querySelectorAll('[aria-hidden="true"].bg-c-border-subtle');
    expect(dividers).toHaveLength(1);
  });
});

describe('SaveIndicator — separate from lifecycle status', () => {
  it('renders nothing when idle', () => {
    const { container } = render(<SaveIndicator state="idle" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders distinct copy per state', () => {
    const { rerender } = render(<SaveIndicator state="saving" />);
    expect(screen.getByText(/Saving/i)).toBeInTheDocument();
    rerender(<SaveIndicator state="saved" />);
    expect(screen.getByText(/Saved/i)).toBeInTheDocument();
    rerender(<SaveIndicator state="error" />);
    expect(screen.getByText(/Save failed/i)).toBeInTheDocument();
  });
});

describe('renderCappedTags — max 2 + overflow', () => {
  it('caps visible tags at 2 and shows +N overflow', () => {
    render(<div>{renderCappedTags(['ai', 'ops', 'risk', 'pmo'])}</div>);
    expect(screen.getByText('ai')).toBeInTheDocument();
    expect(screen.getByText('ops')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.queryByText('risk')).not.toBeInTheDocument();
  });

  it('returns null for empty tag lists', () => {
    const { container } = render(<div>{renderCappedTags([])}</div>);
    expect(container.firstChild).toBeEmptyDOMElement();
  });
});
