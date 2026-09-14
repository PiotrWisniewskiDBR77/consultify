/**
 * P-T14 (a) — zmiana etapu idei JEDNYM otwarciem listy, prosto z wiersza.
 *
 * Premisa (zmierzona na linii `integracja/20260911`): kolumna „Etap" w tabeli
 * Pomysłów renderowała wyłącznie odznakę do czytania
 * (`IdeasTableContent.tsx` → `renderStageBadge(idea.stage)`), a jedyna droga
 * zmiany wiodła przez kebab wiersza → blok `id: 'stage'`
 * (`MyIdeasListContent.tsx`) → pozycja etapu. Dwa kliknięcia zanim lista
 * etapów w ogóle się pokaże — dokładnie uwaga Tomka (DEC-496 pkt XIV).
 *
 * Ten test pilnuje kontraktu naprawy: lista etapów jest W WIERSZU, wybór
 * zapisuje NATYCHMIAST (jedno wywołanie handlera zapisu), a wybór tej samej
 * wartości nie generuje pustego zapisu.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaStageSelectCell } from '../IdeaStageSelectCell';

describe('P-T14(a) IdeaStageSelectCell — etap zmieniany z wiersza', () => {
  it('pokazuje bieżący etap jako wybraną pozycję listy (PL)', () => {
    render(<IdeaStageSelectCell stage="shaping" isPolish onChangeStage={() => {}} />);
    const select = screen.getByTestId('idea-stage-select') as HTMLSelectElement;
    expect(select.value).toBe('shaping');
    // Etykieta widoczna w wierszu pozostaje odznaką kanonu, nie surowym kluczem
    // (ten sam napis jest też pozycją listy, stąd getAllByText).
    expect(screen.getAllByText('Kształtuje się').length).toBeGreaterThan(0);
  });

  it('wybór innego etapu zapisuje od razu — jedno wywołanie, właściwa wartość', () => {
    const onChangeStage = vi.fn();
    render(<IdeaStageSelectCell stage="spark" isPolish={false} onChangeStage={onChangeStage} />);
    fireEvent.change(screen.getByTestId('idea-stage-select'), { target: { value: 'ready' } });
    expect(onChangeStage).toHaveBeenCalledTimes(1);
    expect(onChangeStage).toHaveBeenCalledWith('ready');
  });

  it('wybór tego samego etapu nie wywołuje zapisu (brak pustego PUT)', () => {
    const onChangeStage = vi.fn();
    render(<IdeaStageSelectCell stage="ready" isPolish={false} onChangeStage={onChangeStage} />);
    fireEvent.change(screen.getByTestId('idea-stage-select'), { target: { value: 'ready' } });
    expect(onChangeStage).not.toHaveBeenCalled();
  });

  it('oferuje pełen cykl życia idei — pięć etapów, w kolejności cyklu', () => {
    render(<IdeaStageSelectCell stage="spark" isPolish onChangeStage={() => {}} />);
    const options = Array.from(
      (screen.getByTestId('idea-stage-select') as HTMLSelectElement).options
    ).map((option) => option.value);
    expect(options).toEqual(['spark', 'incubating', 'shaping', 'ready', 'promoted']);
  });

  it('bez handlera zapisu zostaje czystą odznaką do czytania (brak listy)', () => {
    render(<IdeaStageSelectCell stage="promoted" isPolish={false} />);
    expect(screen.queryByTestId('idea-stage-select')).toBeNull();
    expect(screen.getAllByText('Promoted').length).toBe(1);
  });

  it('klik w listę nie przechodzi na wiersz (wiersz ma własny onClick otwierający ideę)', () => {
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <IdeaStageSelectCell stage="spark" isPolish={false} onChangeStage={() => {}} />
      </div>
    );
    fireEvent.click(screen.getByTestId('idea-stage-select'));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
