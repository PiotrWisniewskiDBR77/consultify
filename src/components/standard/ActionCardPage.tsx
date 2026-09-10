import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NModeToolbar, useCardAIAnalysis } from '@/components/shared/NModeLayout';
import { NCardAIAnalysisPanel } from '@/components/shared/NModeLayout/NCardAIAnalysisPanel';
import { ArtifactPropertiesTable } from './ArtifactPropertiesTable';
import { PracujZAI } from './PracujZAI';
import { StandardArtifactShell } from './StandardArtifactShell';
import type { ActionCardModel } from './ActionCard.types';
import { ACTION_CARD_SECTION_CONTRACT, type ActionCardSection } from './actionCardContract';
import { getActionCard, updateActionCard } from '@/services/actionCards';

const box = 'rounded-xl border border-c-border-subtle bg-c-surface p-4 text-sm text-c-text-secondary';
const value = (text?: string | null) => text?.trim() || '—';

export function ActionCardPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState<ActionCardModel | null>(null);
  const [active, setActive] = useState('description');
  const [loading, setLoading] = useState(true);
  useEffect(() => { void getActionCard(id).then(setCard).finally(() => setLoading(false)); }, [id]);
  const apply = useCallback((fieldId: string, next: string) => {
    if (!card || !['problem', 'rootCause', 'actionText', 'dueDate', 'comment'].includes(fieldId)) return false;
    void updateActionCard(card.id, { [fieldId]: next }).then(setCard);
    return true;
  }, [card]);
  const analysis = useCardAIAnalysis({
    activeCardId: card ? active : null,
    buildInput: () => ({ artifactType: 'action', cardId: active, artifactTitle: card?.problem || 'Karta działania', artifactContext: `Status: ${card?.status || ''}`, fields: [{ id: 'problem', label: 'Opis problemu', value: card?.problem || '', writable: true }, { id: 'rootCause', label: 'Główna przyczyna', value: card?.rootCause || '', writable: true }, { id: 'actionText', label: 'Opis działania', value: card?.actionText || '', writable: true }], isPolish: true }),
    applyChange: (change) => apply(change.fieldId, String(change.proposedValue || '')),
  });
  const aiSource = useMemo(() => ({
    rodzaj: 'pola' as const,
    pola: ({ sekcjaId, caly }: { sekcjaId: string | null; caly: boolean }) => {
      const fields = [
        { id: 'problem', etykieta: 'Opis problemu', wartosc: card?.problem || '', sekcjaId: 'description', sekcjaEtykieta: 'Opis' },
        { id: 'rootCause', etykieta: 'Główna przyczyna', wartosc: card?.rootCause || '', sekcjaId: 'description', sekcjaEtykieta: 'Opis' },
        { id: 'actionText', etykieta: 'Opis działania', wartosc: card?.actionText || '', sekcjaId: 'description', sekcjaEtykieta: 'Opis' },
        { id: 'dueDate', etykieta: 'Termin', wartosc: card?.dueDate || '', sekcjaId: 'owner', sekcjaEtykieta: 'Właściciel i termin', format: 'paragraph' as const },
      ];
      return caly ? fields : fields.filter((field) => field.sekcjaId === sekcjaId);
    },
    zastosuj: apply,
  }), [apply, card]);
  if (!card) return <div className="p-8 text-c-text-secondary">{loading ? 'Wczytywanie karty działania…' : 'Nie znaleziono karty działania.'}</div>;
  const content: Record<string, React.ReactNode> = {
    description: <div className={box}><p><b>Problem:</b> {value(card.problem)}</p><p><b>Główna przyczyna:</b> {value(card.rootCause)}</p><p><b>Działanie:</b> {value(card.actionText)}</p></div>,
    source: <div className={box}>Źródło: {card.sourceKind.replaceAll('_', ' ')}</div>,
    owner: <div className={box}><p>Właściciel: {value(card.ownerName)}</p><p>Termin: {value(card.dueDate)}</p><p>Okres: {value(card.periodStart)} – {value(card.periodEnd)}</p></div>,
    actions: <div className={box}><p>Status: {card.status === 'OPEN' ? 'Otwarta' : 'Zamknięta'}</p>{card.comment ? <p>Komentarz: {card.comment}</p> : null}</div>,
  };
  const sections: ActionCardSection[] = ACTION_CARD_SECTION_CONTRACT.map((section) => ({ ...section, component: content[section.id], aiContract: { none: true, reason: 'AI jest sterowane wspólnie przez Menu 5 tej karty.' } }));
  const rightPanel = {
    actions: { label: 'Akcje', children: <button className="rounded-lg border border-c-border px-3 py-2" onClick={() => navigate(-1)}>Wróć do listy</button>, actionIds: ['back'] },
    properties: { label: 'Właściwości', children: <ArtifactPropertiesTable propertyLabel="Właściwość" valueLabel="Wartość" rows={[{ id: 'status', label: 'Status', value: card.status === 'OPEN' ? 'Otwarta' : 'Zamknięta' }, { id: 'owner', label: 'Właściciel', value: value(card.ownerName) }, { id: 'due', label: 'Termin', value: value(card.dueDate) }]} /> },
    relations: { label: 'Powiązania', children: <div className="text-sm">Powiązana ze źródłem działania.</div> },
    evidence: { label: 'Źródła i założenia', children: <div className="text-sm">Pomiar i próg pochodzą z rekordu źródłowego.</div> },
    comments: card.comment ? { label: 'Komentarze', children: <div className="text-sm">{card.comment}</div> } : { pominieta: true as const, reason: 'Karta nie zawiera komentarza.' },
    history: { label: 'Historia', children: <div className="text-sm">Bieżący stan: {card.status === 'OPEN' ? 'otwarta' : 'zamknięta'}.</div> },
  };
  return <StandardArtifactShell karta="action" klasa="S" header={{ title: card.problem || 'Karta działania', onTitleChange: () => undefined, titleReadOnly: true, artifactType: 'task', artifactId: card.id, onSave: () => undefined, saveState: 'saved', onClose: () => navigate(-1), statusLabel: card.status === 'OPEN' ? 'Otwarta' : 'Zamknięta', statusTone: card.status === 'OPEN' ? 'review' : 'approved' }} primaryAction={{ intentionallyNone: true, reason: 'Zmiana stanu karty jest dostępna w sekcji Akcje.' }} sections={sections} rightPanel={rightPanel} activeSection={active} onSectionChange={setActive} densityMode="n" onDensityModeChange={() => undefined} toolbar={<NModeToolbar activeSectionLabel={sections.find((section) => section.id === active)?.label.pl} isPolish aiArtifactButton={<PracujZAI isPolish onAnalizuj={analysis.run} analizaWToku={analysis.loading} analizaOtwarta={analysis.open} aktywnaSekcja={active} kontekstArtefaktu={{ title: card.problem, status: card.status, type: 'action' }} moznaEdytowac={card.status === 'OPEN'} powodTylkoOdczyt="Karta jest zamknięta." uzupelnijSekcje={aiSource} uzupelnijDokument={aiSource} />} />} nakladki={<NCardAIAnalysisPanel result={analysis.result} loading={analysis.loading} errorCode={analysis.errorCode} serverErrorCode={analysis.serverErrorCode} open={analysis.open} onClose={analysis.close} onRerun={analysis.rerun} onApplyChange={analysis.applyChange} writableFieldIds={['problem', 'rootCause', 'actionText', 'dueDate', 'comment']} isPolish />} />;
}

export default ActionCardPage;
