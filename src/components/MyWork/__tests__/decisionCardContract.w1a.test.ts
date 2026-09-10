import { describe, expect, it } from 'vitest';

import { sekcjeZKontraktu } from '../../standard/contractSections';
import { DECISION_CARDS } from '../decisionCardContract';
import { DECISION_SECTIONS_Z_RENDEREM } from '../DecisionDetailView';

// W1-A (odbiór A1, 2026-09-10): `wymagajSekcjiZKontraktu` miała 0 wołaczy
// produkcyjnych. Decision renderuje centrum PER-ID (`activeNotionSection ===
// '<id>'`), nie tablicą komponentów jak Insight/Notification, więc "ekran" =
// lista id-ków z realnym blokiem JSX (`DECISION_SECTIONS_Z_RENDEREM`,
// utrzymywana ręcznie obok grepa `activeNotionSection ===` w
// DecisionDetailView.tsx). Ten test pilnuje, żeby katalog kanoniczny i lista
// renderu NIE rozjechały się (dopisanie karty bez case'a centrum, albo
// odwrotnie, zaczerwienia go — dokładnie klasa defektu R1 w Insight).
describe('DecisionDetailView — W1-A (kontrakt == render centrum)', () => {
  it('DECISION_SECTIONS_Z_RENDEREM pokrywa 1:1 lewą kolumnę kontraktu (id + kolejność)', () => {
    const kontrakt = sekcjeZKontraktu(DECISION_CARDS, 'decision');
    expect(DECISION_SECTIONS_Z_RENDEREM).toEqual(kontrakt.map((s) => s.id));
  });

  it('mutacja: karta dopisana do kontraktu bez case renderu w tym pliku daje RED', () => {
    const kontrakt = sekcjeZKontraktu(DECISION_CARDS, 'decision');
    const kontraktZMutantem = [...kontrakt, { id: 'mutant-bez-case' }];
    expect(DECISION_SECTIONS_Z_RENDEREM).not.toEqual(kontraktZMutantem.map((s) => s.id));
  });
});
