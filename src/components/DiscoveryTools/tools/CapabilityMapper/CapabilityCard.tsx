/**
 * CapabilityCard - Card for analyzing one organizational Capability.
 *
 * Analog of ActivityCard (Value Chain): lets users describe and score a
 * single capability on current vs target maturity (1-5), strategic
 * importance, gap size, and sourcing strategy (build/buy/partner/sustain),
 * with drivers, evidence, an implication, and AI proposal governance.
 *
 * Unlike ActivityCard (which addresses a fixed activity in a Record), a
 * CapabilityCard targets one entry of a DYNAMIC capabilities[] array by id.
 */

import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import {
  Capability,
  CapabilityMapperData,
  ProposalCardType,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';
import { ProposalCardActions as CardActions } from '../../shared/ProposalCardGovernance';

// ==================== TYPES ====================

interface CapabilityCardProps {
  capabilityId: string;
  session: ToolSession;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
}

// ==================== CONSTANTS ====================

const MATURITY_OPTIONS: { value: number; en: string; pl: string }[] = [
  { value: 1, en: '1 · Initial', pl: '1 · Początkowa' },
  { value: 2, en: '2 · Developing', pl: '2 · Rozwijająca się' },
  { value: 3, en: '3 · Defined', pl: '3 · Zdefiniowana' },
  { value: 4, en: '4 · Managed', pl: '4 · Zarządzana' },
  { value: 5, en: '5 · Optimized', pl: '5 · Zoptymalizowana' },
];

const IMPORTANCE_OPTIONS: { value: Capability['importance']; en: string; pl: string }[] = [
  { value: 'high', en: 'High', pl: 'Wysoka' },
  { value: 'medium', en: 'Medium', pl: 'Średnia' },
  { value: 'low', en: 'Low', pl: 'Niska' },
];

const GAP_OPTIONS: { value: NonNullable<Capability['gapSize']>; en: string; pl: string }[] = [
  { value: 'critical', en: 'Critical', pl: 'Krytyczna' },
  { value: 'moderate', en: 'Moderate', pl: 'Umiarkowana' },
  { value: 'minor', en: 'Minor', pl: 'Niewielka' },
];

const SOURCING_OPTIONS: { value: NonNullable<Capability['sourcing']>; en: string; pl: string }[] = [
  { value: 'build', en: 'Build', pl: 'Zbuduj' },
  { value: 'buy', en: 'Buy', pl: 'Kup' },
  { value: 'partner', en: 'Partner', pl: 'Partneruj' },
  { value: 'sustain', en: 'Sustain', pl: 'Utrzymaj' },
];

// ==================== COMPONENT ====================

export const CapabilityCard: React.FC<CapabilityCardProps> = ({
  capabilityId,
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}) => {
  const { updateInputData } = useToolStore();
  const [newDriver, setNewDriver] = useState('');

  const data = session.inputData as CapabilityMapperData;
  const capability = (data.capabilities || []).find((c) => c.id === capabilityId);

  if (!capability) return null;

  const updateCapability = (updates: Partial<Capability>) => {
    updateInputData({
      capabilities: (data.capabilities || []).map((c) =>
        c.id === capabilityId ? { ...c, ...updates } : c
      ),
    } as Partial<CapabilityMapperData>);
  };

  const removeCapability = () => {
    updateInputData({
      capabilities: (data.capabilities || []).filter((c) => c.id !== capabilityId),
    } as Partial<CapabilityMapperData>);
  };

  const handleAddDriver = () => {
    if (!newDriver.trim()) return;
    updateCapability({ drivers: [...(capability.drivers || []), newDriver.trim()] });
    setNewDriver('');
  };

  const handleRemoveDriver = (index: number) => {
    updateCapability({ drivers: (capability.drivers || []).filter((_, i) => i !== index) });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <input
              value={capability.name}
              onChange={(event) => updateCapability({ name: event.target.value })}
              placeholder={isPolish ? 'Nazwa kompetencji...' : 'Capability name...'}
              className="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent p-0 font-semibold text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-0 dark:text-slate-100"
            />
            {capability.domain && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-navy-800 dark:text-slate-300">
                {capability.domain}
              </span>
            )}
          </div>
          <input
            value={capability.domain}
            onChange={(event) => updateCapability({ domain: event.target.value })}
            placeholder={isPolish ? 'Domena (np. technologia, talenty)...' : 'Domain (e.g. technology, talent)...'}
            className="w-full border-0 bg-transparent p-0 text-xs text-slate-500 placeholder-slate-400 focus:outline-none focus:ring-0 dark:text-slate-400"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {capability.proposalStatus === 'ai-proposed' ? (
            <CardActions
              cardType="item"
              cardId={capability.id}
              isPolish={isPolish}
              onAcceptCard={onAcceptCard}
              onRejectCard={onRejectCard}
              onRethinkCard={onRethinkCard}
            />
          ) : (
            <button
              type="button"
              onClick={removeCapability}
              className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/30"
              title={isPolish ? 'Usuń kompetencję' : 'Remove capability'}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scoring grid */}
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Dojrzałość obecna' : 'Current maturity'}
          <select
            value={capability.currentMaturity}
            onChange={(event) => updateCapability({ currentMaturity: Number(event.target.value) })}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          >
            {MATURITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isPolish ? opt.pl : opt.en}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Dojrzałość docelowa' : 'Target maturity'}
          <select
            value={capability.targetMaturity}
            onChange={(event) => updateCapability({ targetMaturity: Number(event.target.value) })}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          >
            {MATURITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isPolish ? opt.pl : opt.en}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Znaczenie strategiczne' : 'Strategic importance'}
          <select
            value={capability.importance}
            onChange={(event) =>
              updateCapability({ importance: event.target.value as Capability['importance'] })
            }
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          >
            {IMPORTANCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isPolish ? opt.pl : opt.en}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {isPolish ? 'Wielkość luki' : 'Gap size'}
          <select
            value={capability.gapSize || 'moderate'}
            onChange={(event) =>
              updateCapability({ gapSize: event.target.value as Capability['gapSize'] })
            }
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          >
            {GAP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isPolish ? opt.pl : opt.en}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:col-span-2">
          {isPolish ? 'Strategia pozyskania' : 'Sourcing strategy'}
          <select
            value={capability.sourcing || 'build'}
            onChange={(event) =>
              updateCapability({ sourcing: event.target.value as Capability['sourcing'] })
            }
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
          >
            {SOURCING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isPolish ? opt.pl : opt.en}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Drivers */}
      <div className="mb-2">
        <div className="mb-2 flex gap-2">
          <input
            type="text"
            value={newDriver}
            onChange={(e) => setNewDriver(e.target.value)}
            placeholder={isPolish ? 'Dodaj czynnik...' : 'Add a driver...'}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-navy-700 dark:bg-navy-900 dark:text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleAddDriver()}
          />
          <button
            type="button"
            onClick={handleAddDriver}
            disabled={!newDriver.trim()}
            className="rounded-lg bg-navy-900 dark:bg-[#F4F7FB] px-3 py-2 text-white dark:text-navy-950 transition-colors hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          {(capability.drivers || []).length > 0 ? (
            (capability.drivers || []).map((driver, index) => (
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
      {(capability.evidence || []).length > 0 && (
        <div className="mb-2 rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {isPolish ? 'Dowody' : 'Evidence'}
          </div>
          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {(capability.evidence || []).map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Implication */}
      <textarea
        value={capability.implication || ''}
        onChange={(event) => updateCapability({ implication: event.target.value })}
        rows={2}
        placeholder={isPolish ? 'Implikacja luki kompetencyjnej...' : 'Implication of the capability gap...'}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900"
      />

      <InlineAssist
        hint={
          isPolish
            ? 'Oceń lukę między dojrzałością obecną a docelową i czy ją zbudować, kupić czy zlecić.'
            : 'Judge the gap between current and target maturity and whether to build, buy, or partner.'
        }
      />
    </div>
  );
};

export default CapabilityCard;
