/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/standard/StandardArtifactShell', () => ({
  StandardArtifactShell: ({ sections }: any) => <>{sections.map((section: any) => <section key={section.id}>{section.component}</section>)}</>,
}));
import { CapacityAnalysisCard } from '../cards/CapacityAnalysisCard';

describe('P11 — brak presji', () => {
  it('pokazuje polski komunikat zamiast pustego ekranu lub błędu', () => {
    render(<CapacityAnalysisCard noPressure onBack={() => undefined} onAnalyze={() => undefined} onPublish={() => undefined} scenario={{scenarioId:'capacity-123456789',name:'Analiza mocy',status:'PUBLISHED',scenarioVersion:1,planScenarioId:'plan-123456789',planScenarioVersion:1,periods:[],proposedAssignments:[],constraints:[],publishedAt:'2026-09-06'}}/>);
    expect(screen.getByText('Brak przeciążeń do rozwiązania')).toBeInTheDocument();
  });
});
