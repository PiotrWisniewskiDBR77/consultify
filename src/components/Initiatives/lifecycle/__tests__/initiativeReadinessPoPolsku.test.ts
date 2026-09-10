/**
 * E3b (10.09) — 18. kształt fałszywego „gotowe": blokada gotowości bramy
 * docierała do polskiego użytkownika PO ANGIELSKU.
 *
 * ZMIERZONE na żywym API (kopia `consultify_kopia_e3b`, konto ADMIN DBR77):
 *   GET /api/v8/planning/initiatives/<id>/gate-readiness-check
 *   → { key:'owner', label:'Owner assigned', severity:'blocking', pass:false,
 *       suggestedAction:'Assign a business or execution owner…',
 *       suggestedActor:'PMO / Project Manager' }
 * a `initiativeWriteTruth.getInitiativeStatusPreflightTruth` wkładał `label`
 * wprost do polskiego zdania w toaście („brakuje: • Owner assigned").
 *
 * Ten plik pilnuje LEJKA, nie jednej powierzchni: serwer wysyła klucz, słownik
 * oddaje zdanie po polsku, a klucz spoza słownika oddaje ORYGINAŁ serwera
 * (cisza byłaby gorsza niż obcy język).
 */
import { describe, expect, it } from 'vitest';

import {
  INITIATIVE_READINESS_ACTION_KEYS,
  INITIATIVE_READINESS_CHECK_KEYS,
  initiativeReadinessActionText,
  initiativeReadinessActorLabel,
  initiativeReadinessCheckLabel,
} from '../initiativeLifecycleMessages';

/** Atrapa `t` w wersji polskiej — zwraca to, co dałby `public/locales/pl`. */
const PL: Record<string, string> = {
  'initiatives.lifecycle.readinessCheck.owner': 'Właściciel przypisany',
  'initiatives.lifecycle.readinessCheck.title': 'Tytuł uzupełniony',
  'initiatives.lifecycle.readinessCheck.gate_role':
    'Zatwierdzający bramki {{gate}} przypisany: {{roles}}',
  'initiatives.lifecycle.readinessAction.owner':
    'Przypisz właściciela biznesowego lub wykonawczego, który weźmie odpowiedzialność.',
  'initiatives.lifecycle.readinessAction.gate_role':
    'Przypisz osoby do ról: {{roles}}, żeby bramka mogła zostać zatwierdzona.',
  'initiatives.lifecycle.readinessActor.pmo': 'PMO',
  'initiatives.lifecycle.readinessActor.projectManager': 'Kierownik projektu',
  'initiatives.lifecycle.action.APPROVE': 'Zatwierdź inicjatywę',
};
const t = (key: string, fallback: string) => PL[key] ?? fallback;
/** Atrapa `t` bez pliku tłumaczeń — musi oddać ANGIELSKI fallback z kodu (J17). */
const tBezPliku = (_key: string, fallback: string) => fallback;

describe('gotowość bramy — jeden lejek językowy', () => {
  it('etykieta serwera „Owner assigned" wychodzi po polsku', () => {
    expect(initiativeReadinessCheckLabel('owner', 'Owner assigned', t)).toBe(
      'Właściciel przypisany'
    );
  });

  it('podpowiedź i sugerowany wykonawca też są tłumaczone', () => {
    expect(
      initiativeReadinessActionText(
        'owner',
        'Assign a business or execution owner who will be accountable.',
        t
      )
    ).toBe('Przypisz właściciela biznesowego lub wykonawczego, który weźmie odpowiedzialność.');
    expect(initiativeReadinessActorLabel('PMO / Project Manager', t)).toBe(
      'PMO / Kierownik projektu'
    );
  });

  it('rodzina dynamiczna `gate_role_<BRAMKA>` podstawia bramkę i role', () => {
    expect(
      initiativeReadinessCheckLabel(
        'gate_role_APPROVE',
        'Gate approver assigned for APPROVE: PROJECT_SPONSOR, PORTFOLIO_OWNER',
        t
      )
    ).toBe('Zatwierdzający bramki Zatwierdź inicjatywę przypisany: PROJECT_SPONSOR, PORTFOLIO_OWNER');
    expect(
      initiativeReadinessActionText(
        'gate_role_APPROVE',
        'Assign users to roles: PROJECT_SPONSOR, PORTFOLIO_OWNER so the gate can be approved.',
        t
      )
    ).toBe('Przypisz osoby do ról: PROJECT_SPONSOR, PORTFOLIO_OWNER, żeby bramka mogła zostać zatwierdzona.');
  });

  it('klucz spoza słownika oddaje ORYGINAŁ serwera, nigdy pustkę', () => {
    expect(initiativeReadinessCheckLabel('nowy_klucz_serwera', 'Brand new check', t)).toBe(
      'Brand new check'
    );
    expect(initiativeReadinessActionText('nowy_klucz_serwera', 'Do the new thing.', t)).toBe(
      'Do the new thing.'
    );
    expect(initiativeReadinessActorLabel('Chief Robot Officer', t)).toBe('Chief Robot Officer');
  });

  it('bez pliku tłumaczeń fallback jest ANGIELSKI (J17), nie polski', () => {
    expect(initiativeReadinessCheckLabel('owner', 'Owner assigned', tBezPliku)).toBe(
      'Owner assigned'
    );
  });

  it('słownik pokrywa CAŁĄ rodzinę kluczy serwera (14 stałych)', () => {
    const kluczeSerwera = [
      'title',
      'owner',
      'summary',
      'sponsor',
      'timeline_dates',
      'schedule_milestones',
      'timeline',
      'baseline',
      'scope',
      'risks',
      'tasks',
      'benefits_owner',
      'benefits_kpis',
      'benefits_kpi_targets',
    ];
    const brakEtykiet = kluczeSerwera.filter((k) => !INITIATIVE_READINESS_CHECK_KEYS[k]);
    const brakPodpowiedzi = kluczeSerwera.filter((k) => !INITIATIVE_READINESS_ACTION_KEYS[k]);
    expect(brakEtykiet).toEqual([]);
    expect(brakPodpowiedzi).toEqual([]);
  });
});
