/**
 * K3 (DEC-407, dyżur 1.1-Z1) — DecisionDetailView „Generate options" pisało
 * WPROST do `alternatives` (`setAlternatives([...alternatives, ...generated])`)
 * bez żadnej propozycji do zatwierdzenia — złamanie `ZASADY_AI_TERESA_SSOT`
 * §3 ("AI proposes. User reviews. System executes approved scope.").
 *
 * DecisionDetailView.tsx nie ma dziś ŻADNEGO testu renderującego komponent
 * (0 plików `render(<DecisionDetailView`) — zbudowanie takiego od zera na tym
 * dyżurze okazało się głębsze niż jeden przebieg (dnd-kit sortable left-nav +
 * CapabilityGate/react-query + dwa tryby prezentacji 'n'/'c', 'c' dodatkowo
 * gated przez `VITE_ENABLE_LEGACY_C_MODE`) — ZNALEZISKO do osobnego dyżuru,
 * zgłoszone w meldunku. Ten plik używa techniki już zaakceptowanej w tym
 * samym katalogu dla tego samego dużego pliku:
 * `DecisionDetailView.raciDownload.day222.test.tsx` skanuje źródło funkcji
 * zamiast renderować komponent. Test tutaj pilnuje TEGO SAMEGO kontraktu co
 * TaskDetailView.k3AiProposal.test.tsx (tam faktycznie wyrenderowany i
 * mutacyjnie dowiedziony): `generateAlternativesAI` nigdy nie wywołuje
 * `setAlternatives(...)` — robi to WYŁĄCZNIE `acceptAlternativesProposal`
 * (wołane z przycisku „Apply" w karcie propozycji, patrz
 * DecisionDetailView.tsx ~linia 6598 `data-testid="decision-alternatives-ai-approve"`).
 *
 * Mutacja: dopisz `setAlternatives([...alternatives, ...generatedAlternatives])`
 * z powrotem w ciało `generateAlternativesAI` (jak przed naprawą) -> ten test
 * czerwienieje na pierwszej asercji.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(__dirname, '../DecisionDetailView.tsx'),
  'utf8'
);

function extractFunctionBody(fnStartMarker: string): string {
  const start = source.indexOf(fnStartMarker);
  expect(start, `nie znaleziono „${fnStartMarker}" w DecisionDetailView.tsx`).toBeGreaterThan(-1);
  // Funkcje w tym pliku kończą się linią `  };` na poziomie wcięcia komponentu —
  // szukamy pierwszego takiego zamknięcia po starcie.
  const end = source.indexOf('\n  };', start);
  expect(end, `nie znaleziono końca funkcji zaczynającej się od „${fnStartMarker}"`).toBeGreaterThan(
    start
  );
  return source.slice(start, end);
}

describe('DecisionDetailView — K3 „Generate options" nie zapisuje przed Zatwierdź (kontrakt źródła)', () => {
  it('generateAlternativesAI nigdy nie woła setAlternatives(...) — tylko setAlternativesProposal(...)', () => {
    const body = extractFunctionBody('const generateAlternativesAI = async () => {');
    expect(body).not.toMatch(/\bsetAlternatives\(/);
    expect(body).toMatch(/\bsetAlternativesProposal\(generatedAlternatives\)/);
  });

  it('acceptAlternativesProposal jest jedynym miejscem zapisu do alternatives z propozycji AI', () => {
    const body = extractFunctionBody('const acceptAlternativesProposal = () => {');
    expect(body).toMatch(/setAlternatives\(\[\.\.\.alternatives, \.\.\.alternativesProposal\]\)/);
    expect(body).toMatch(/setAlternativesProposal\(null\)/);
  });

  it('discardAlternativesProposal nie dotyka alternatives, tylko czyści propozycję', () => {
    const body = extractFunctionBody('const discardAlternativesProposal = () => {');
    expect(body).not.toMatch(/\bsetAlternatives\(/);
    expect(body).toMatch(/setAlternativesProposal\(null\)/);
  });

  it('karta propozycji ma realne przyciski Zatwierdź/Odrzuć podpięte pod te funkcje', () => {
    expect(source).toMatch(
      /data-testid="decision-alternatives-ai-approve"[\s\S]{0,80}onClick={acceptAlternativesProposal}/
    );
    expect(source).toMatch(/onClick={discardAlternativesProposal}/);
  });
});
