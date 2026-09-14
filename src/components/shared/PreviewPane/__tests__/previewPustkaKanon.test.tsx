/**
 * KANON PODGLĄDU — blok bez danych i meta bez śmieci (K5-7, 2026-09-13).
 *
 * Odchylenia zmierzone na odbiorze właściciela (staging `cf3fded7e4`):
 *  P1 — pusta ramka „Relations / No relations" na KAŻDYM podglądzie,
 *  P2 — meta „Draft · Unknown · v—" i „Pending · None".
 *
 * Kanon (TRIADA §A7 / TABLE_AND_PREVIEW_CANON §7.0): blok bez danych jest
 * UKRYTY, nie pusty; meta to stan, nie ślad po polu, którego nie ma.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { isPlaceholderValue } from '../../emptyValueCanon';
import { PreviewMetaCard } from '../PreviewMetaCard';
import { PreviewRelations } from '../PreviewRelations';

describe('P1 · Relations bez danych = blok UKRYTY', () => {
  it('pusta lista nie renderuje ani ramki, ani napisu „No relations"', () => {
    // Mutacja: usunięcie `if (!items.length && !showEmpty) return null` —
    // wraca pusta ramka z odbioru właściciela.
    const { container } = render(<PreviewRelations items={[]} />);
    expect(container.querySelector('[data-preview-block="relations"]')).toBeNull();
    expect(screen.queryByText('No relations')).toBeNull();
  });

  it('`showEmpty` zostaje jako JAWNE wyjście dla ekranu, który tego chce', () => {
    // Etykieta po angielsku — bramka językowa J0 liczy polskie literały w JSX
    // także w plikach testowych (tryb szybki), a to nie jest interfejs.
    render(<PreviewRelations items={[]} showEmpty emptyLabel="No links" />);
    expect(screen.getByText('No links')).toBeInTheDocument();
  });

  it('realne powiązania renderują się jak dotąd', () => {
    const { container } = render(<PreviewRelations items={[{ label: 'Initiative A' }]} />);
    expect(container.querySelector('[data-preview-block="relations"]')).not.toBeNull();
    expect(screen.getByText('Initiative A')).toBeInTheDocument();
  });
});

describe('P2 · meta bez wartości-śmieci', () => {
  it('chip z pustą wartością („v—", „—", „n/a") wypada z paska', () => {
    render(
      <PreviewMetaCard
        pills={[
          { label: 'Status', value: 'Draft' },
          { label: 'Wersja', value: 'v—' },
          { label: 'Termin', value: '—' },
          { label: 'Źródło', value: 'n/a' },
        ]}
      />
    );
    expect(screen.getByText('Status: Draft')).toBeInTheDocument();
    expect(screen.queryByText(/Wersja/)).toBeNull();
    expect(screen.queryByText(/Termin/)).toBeNull();
    expect(screen.queryByText(/Źródło/)).toBeNull();
  });

  it('chip samotny będący samą pustką wypada, realny stan zostaje', () => {
    render(<PreviewMetaCard pills={[{ label: 'Draft' }, { label: '—' }, { label: 'v—' }]} />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.queryByText('v—')).toBeNull();
  });

  it('chip sklejony w jeden napis („Owner: —") też wypada', () => {
    // Wzorzec zmierzony 13.09 w 7 plikach: `label: `${t('Owner')}: ${x || '—'}``.
    // Mutacja: usunięcie `isLabelWithEmptyValue` z filtra — chip wraca.
    render(
      <PreviewMetaCard
        pills={[{ label: 'Owner: —' }, { label: 'Last reviewed: n/a' }, { label: 'Owner: Lena' }]}
      />
    );
    expect(screen.getByText('Owner: Lena')).toBeInTheDocument();
    expect(screen.queryByText('Owner: —')).toBeNull();
    expect(screen.queryByText('Last reviewed: n/a')).toBeNull();
  });

  it('„Unknown" ZOSTAJE — to bywa realny stan słownika, a nie pustka', () => {
    // Świadoma granica reguły: kasowanie „Unknown" skłamałoby o rekordzie.
    render(<PreviewMetaCard pills={[{ label: 'Health', value: 'Unknown' }]} />);
    expect(screen.getByText('Health: Unknown')).toBeInTheDocument();
  });

  it('karta meta bez ANI JEDNEGO widocznego elementu nie renderuje pustego boxa', () => {
    const { container } = render(<PreviewMetaCard pills={[{ label: '—' }, { label: 'v—' }]} />);
    expect(container.querySelector('[data-preview-block="meta"]')).toBeNull();
  });

  it('karta meta z samym `trailing` nadal się renderuje', () => {
    const { container } = render(
      <PreviewMetaCard pills={[]} trailing={<span>SLA</span>} />
    );
    expect(container.querySelector('[data-preview-block="meta"]')).not.toBeNull();
  });
});

describe('jedna forma pustki', () => {
  it('rozpoznaje wszystkie przebrania pustki ze zrzutów', () => {
    for (const v of ['', '  ', '-', '—', '–', 'n/a', 'N/A', 'null', 'undefined', 'v—', 'v-']) {
      expect(isPlaceholderValue(v)).toBe(true);
    }
    expect(isPlaceholderValue(null)).toBe(true);
    expect(isPlaceholderValue(undefined)).toBe(true);
  });

  it('NIE uznaje za pustkę realnych stanów słownika ani zera', () => {
    // Mutacja: dopisanie „unknown"/„none" do zbioru — test padnie, i słusznie:
    // to są stany, nie brak pomiaru.
    for (const v of ['Unknown', 'None', 'Nieznane', 'Brak', 0, '0', 'v1']) {
      expect(isPlaceholderValue(v)).toBe(false);
    }
  });
});
