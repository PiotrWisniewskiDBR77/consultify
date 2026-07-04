/**
 * PillarCard - Card for shaping one Narrative Pillar.
 *
 * Analog of CapabilityCard (Capability Mapper): lets users describe and score a
 * single pillar of a persuasive narrative — the claim it makes (message),
 * the proof points backing it, how strongly it resonates with the audience,
 * with drivers, evidence, an implication, and AI proposal governance.
 *
 * Like CapabilityCard, a PillarCard targets one entry of a DYNAMIC pillars[]
 * array by id (not a fixed Record).
 */

import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import {
  NarrativeEngineData,
  NarrativePillar,
  ProposalCardType,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';
import { ProposalCardActions as CardActions } from '../../shared/ProposalCardGovernance';

// ==================== TYPES ====================

interface PillarCardProps {
  pillarId: string;
  session: ToolSession;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
}

// ==================== CONSTANTS ====================

const RESONANCE_OPTIONS: {
  value: NarrativePillar['audienceResonance'];
  en: string;
  pl: string;
}[] = [
  { value: 'high', en: 'High', pl: 'Wysoki' },
  { value: 'medium', en: 'Medium', pl: 'Średni' },
  { value: 'low', en: 'Low', pl: 'Niski' },
];

// ==================== COMPONENT ====================

export const PillarCard: React.FC<PillarCardProps> = ({
  pillarId,
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}) => {
  const { updateInputData } = useToolStore();
  const [newProof, setNewProof] = useState('');
  const [newDriver, setNewDriver] = useState('');

  const data = session.inputData as NarrativeEngineData;
  const pillar = (data.pillars || []).find((p) => p.id === pillarId);

  if (!pillar) return null;

  const updatePillar = (updates: Partial<NarrativePillar>) => {
    updateInputData({
      pillars: (data.pillars || []).map((p) =>
        p.id === pillarId ? { ...p, ...updates } : p
      ),
    } as Partial<NarrativeEngineData>);
  };

  const removePillar = () => {
    updateInputData({
      pillars: (data.pillars || []).filter((p) => p.id !== pillarId),
    } as Partial<NarrativeEngineData>);
  };

  const handleAddProof = () => {
    if (!newProof.trim()) return;
    updatePillar({ proofPoints: [...(pillar.proofPoints || []), newProof.trim()] });
    setNewProof('');
  };

  const handleRemoveProof = (index: number) => {
    updatePillar({ proofPoints: (pillar.proofPoints || []).filter((_, i) => i !== index) });
  };

  const handleAddDriver = () => {
    if (!newDriver.trim()) return;
    updatePillar({ drivers: [...(pillar.drivers || []), newDriver.trim()] });
    setNewDriver('');
  };

  const handleRemoveDriver = (index: number) => {
    updatePillar({ drivers: (pillar.drivers || []).filter((_, i) => i !== index) });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={pillar.title}
            onChange={(event) => updatePillar({ title: event.target.value })}
            placeholder={isPolish ? 'Nazwa filaru...' : 'Pillar title...'}
            className="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent p-0 font-semibold text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-0 dark:text-slate-100"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {pillar.proposalStatus === 'ai-proposed' ? (
            <CardActions
              cardType="item"
              cardId={pillar.id}
              isPolish={isPolish}
              onAcceptCard={onAcceptCard}
              onRejectCard={onRejectCard}
              onRethinkCard={onRethinkCard}
            />
          ) : (
            <button
              type="button"
              onClick={removePillar}
              className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/30"
              title={isPolish ? 'Usuń filar' : 'Remove pillar'}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Message (the claim) */}
      <label className="mb-3 block text-xs font-medium text-slate-500 dark:text-slate-400">
        {isPolish ? 'Przekaz (teza filaru)' : 'Message (the claim)'}
        <textarea
          value={pillar.message}
          onChange={(event) => updatePillar({ message: event.target.value })}
          rows={2}
          placeholder={
            isPolish ? 'Jaką tezę stawia ten filar...' : 'The claim this pillar makes...'
          }
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900"
        />
      </label>

      {/* Audience resonance */}
      <label className="mb-3 block text-xs font-medium text-slate-500 dark:text-slate-400">
        {isPolish ? 'Rezonans z odbiorcą' : 'Audience resonance'}
        <select
          value={pillar.audienceResonance || 'medium'}
          onChange={(event) =>
            updatePillar({
              audienceResonance: event.target.value as NarrativePillar['audienceResonance'],
            })
          }
          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
        >
          {RESONANCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {isPolish ? opt.pl : opt.en}
            </option>
          ))}
        </select>
      </label>

      {/* Proof points */}
      <div className="mb-3">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          {isPolish ? 'Dowody (proof points)' : 'Proof points'}
        </div>
        <div className="mb-2 flex gap-2">
          <input
            type="text"
            value={newProof}
            onChange={(e) => setNewProof(e.target.value)}
            placeholder={isPolish ? 'Dodaj dowód...' : 'Add a proof point...'}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleAddProof()}
          />
          <button
            type="button"
            onClick={handleAddProof}
            disabled={!newProof.trim()}
            className="rounded-lg bg-c-text px-3 py-2 text-c-bg transition-colors hover:bg-c-text-secondary disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          {(pillar.proofPoints || []).length > 0 ? (
            (pillar.proofPoints || []).map((proof, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-navy-900"
              >
                <span className="text-sm text-slate-700 dark:text-slate-300">{proof}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveProof(index)}
                  className="rounded p-1 text-slate-600 transition-colors hover:bg-danger-100 hover:text-danger-500 dark:hover:bg-danger-900/30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm italic text-slate-600">
              {isPolish ? 'Brak dodanych dowodów' : 'No proof points added'}
            </p>
          )}
        </div>
      </div>

      {/* Drivers */}
      <div className="mb-2">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          {isPolish ? 'Czynniki' : 'Drivers'}
        </div>
        <div className="mb-2 flex gap-2">
          <input
            type="text"
            value={newDriver}
            onChange={(e) => setNewDriver(e.target.value)}
            placeholder={isPolish ? 'Dodaj czynnik...' : 'Add a driver...'}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleAddDriver()}
          />
          <button
            type="button"
            onClick={handleAddDriver}
            disabled={!newDriver.trim()}
            className="rounded-lg bg-c-text px-3 py-2 text-c-bg transition-colors hover:bg-c-text-secondary disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          {(pillar.drivers || []).length > 0 ? (
            (pillar.drivers || []).map((driver, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-2 dark:bg-navy-900"
              >
                <span className="text-sm text-slate-700 dark:text-slate-300">{driver}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveDriver(index)}
                  className="rounded p-1 text-slate-600 transition-colors hover:bg-danger-100 hover:text-danger-500 dark:hover:bg-danger-900/30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm italic text-slate-600">
              {isPolish ? 'Brak dodanych czynników' : 'No drivers added'}
            </p>
          )}
        </div>
      </div>

      {/* Evidence (read-only list from AI / context) */}
      {(pillar.evidence || []).length > 0 && (
        <div className="mb-2 rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {isPolish ? 'Dowody' : 'Evidence'}
          </div>
          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {(pillar.evidence || []).map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Implication */}
      <textarea
        value={pillar.implication || ''}
        onChange={(event) => updatePillar({ implication: event.target.value })}
        rows={2}
        placeholder={isPolish ? 'Implikacja tego filaru...' : 'Implication of this pillar...'}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900"
      />

      <InlineAssist
        hint={
          isPolish
            ? 'Sprawdź, czy przekaz filaru jest poparty dowodami i rezonuje z odbiorcą.'
            : 'Check that the pillar message is backed by proof and resonates with the audience.'
        }
      />
    </div>
  );
};

export default PillarCard;
