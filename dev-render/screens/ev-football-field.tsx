/**
 * Mock host for <EvBasketFootballField> — the EV "koszyk metod" panel in
 * Finance/Wycena (za flagą `ff.evBasket`, patrz src/components/Economics/panels).
 *
 * Reuses the REAL, presentational component (no re-implementation) and feeds
 * it a realistic EV basket shaped exactly like `EvBasketResult` (the
 * deterministic output of `valuationBasketService`): 4 methods (DCF · mnożniki
 * rynkowe · EV/EBITDA · transakcje porównywalne), a convergence zone
 * (intersection = recommended range), and a divergence flag (>20%, precedent
 * transactions running hot vs. trading multiples) — modeled on the DBR77
 * scale-up valuation numbers used across the Finance/M16 work.
 *
 * The component itself has no store/context/API dependency — it's pure props
 * in, JSX out — so this mock host needs no state at all.
 */
import React from 'react';

import EvBasketFootballField, {
  type EvBasketResult,
} from '../../src/components/Economics/panels/EvBasketFootballField';

// Wszystkie wartości w mln PLN. Ważone: DCF 35% · mnożniki rynkowe 20% ·
// EV/EBITDA 25% · transakcje porównywalne 20% (sumują się do rekomendacji mid).
const MOCK_BASKET: EvBasketResult = {
  methods: [
    {
      key: 'dcf',
      label: 'DCF (zdyskontowane przepływy)',
      low: 185,
      mid: 215,
      high: 245,
      weight: 0.35,
      note: 'WACC 11.2% · wzrost rezydualny 2.5%',
    },
    {
      key: 'trading_multiples',
      label: 'Mnożniki rynkowe (EV/Revenue)',
      low: 170,
      mid: 195,
      high: 220,
      weight: 0.2,
      note: 'EV/Revenue 3.2–4.1x · grupa porównawcza SaaS B2B',
    },
    {
      key: 'ev_ebitda',
      label: 'EV/EBITDA',
      low: 175,
      mid: 200,
      high: 225,
      weight: 0.25,
      note: 'EV/EBITDA 11–14x · EBITDA znormalizowana 16.8M',
    },
    {
      key: 'precedent_transactions',
      label: 'Transakcje porównywalne',
      low: 205,
      mid: 245,
      high: 285,
      weight: 0.2,
      note: '3 transakcje sektorowe 2024–2025 · premia kontrolna 15%',
    },
  ],
  intersection: { low: 205, high: 220 },
  recommended: { low: 205, mid: 213, high: 220 },
  consistencyFlag: {
    triggered: true,
    thresholdPct: 20,
    maxDivergencePct: 25.6,
    message:
      'Transakcje porównywalne odchylają się istotnie od mnożników rynkowych — sprawdź dobór transakcji i premię kontrolną.',
    topDriver: {
      methods: ['trading_multiples', 'precedent_transactions'],
      divergencePct: 25.6,
      lowerLabel: 'Mnożniki rynkowe (EV/Revenue)',
      higherLabel: 'Transakcje porównywalne',
    },
  },
  weights: {
    dcf: 0.35,
    trading_multiples: 0.2,
    ev_ebitda: 0.25,
    precedent_transactions: 0.2,
  },
};

export function EvFootballFieldScreen(): React.ReactElement {
  return (
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <EvBasketFootballField
        basket={MOCK_BASKET}
        unitLabel="mln PLN"
        subjectLabel="DBR77 Sp. z o.o. — Wycena Q2 2026"
      />
    </div>
  );
}

export default EvFootballFieldScreen;
