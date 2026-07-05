/**
 * ForceStep - Step for analyzing a Porter's force
 *
 * Allows users to score and describe a competitive force.
 */

import { Minus, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import React, { useState } from 'react';

import { ForceData, PorterData, ToolSession, useToolStore } from '@/store/useToolStore';

import { InlineAssist } from '../../InlineAssist';

// ==================== TYPES ====================

interface ForceStepProps {
  forceId: 'rivalry' | 'newEntrants' | 'substitutes' | 'buyerPower' | 'supplierPower';
  session: ToolSession;
  isPolish: boolean;
}

// ==================== CONSTANTS ====================

const FORCE_CONFIG = {
  rivalry: {
    title: { en: 'Competitive Rivalry', pl: 'Rywalizacja konkurencyjna' },
    description: {
      en: 'Intensity of competition among existing firms',
      pl: 'Intensywność konkurencji między istniejącymi firmami',
    },
    questions: [
      { en: 'How many competitors are there?', pl: 'Ilu jest konkurentów?' },
      { en: 'How similar are the products?', pl: 'Jak podobne są produkty?' },
      { en: 'What is the industry growth rate?', pl: 'Jaki jest wzrost branży?' },
    ],
    color: 'red',
  },
  newEntrants: {
    title: { en: 'Threat of New Entrants', pl: 'Zagrożenie nowych graczy' },
    description: {
      en: 'Barriers to entry and likelihood of new competitors',
      pl: 'Bariery wejścia i prawdopodobieństwo nowych konkurentów',
    },
    questions: [
      { en: 'How high are capital requirements?', pl: 'Jak wysokie są wymagania kapitałowe?' },
      { en: 'Are there economies of scale?', pl: 'Czy są korzyści skali?' },
      { en: 'How strong is brand loyalty?', pl: 'Jak silna jest lojalność wobec marki?' },
    ],
    color: 'amber',
  },
  substitutes: {
    title: { en: 'Threat of Substitutes', pl: 'Zagrożenie substytutów' },
    description: {
      en: 'Availability of alternative products or services',
      pl: 'Dostępność alternatywnych produktów lub usług',
    },
    questions: [
      { en: 'Are there close substitutes?', pl: 'Czy są bliskie substytuty?' },
      { en: 'What is the switching cost?', pl: 'Jaki jest koszt zmiany?' },
      { en: 'How is substitute quality?', pl: 'Jaka jest jakość substytutów?' },
    ],
    color: 'purple',
  },
  buyerPower: {
    title: { en: 'Bargaining Power of Buyers', pl: 'Siła przetargowa nabywców' },
    description: {
      en: "Customers' ability to drive prices down",
      pl: 'Zdolność klientów do obniżania cen',
    },
    questions: [
      { en: 'How concentrated are buyers?', pl: 'Jak skoncentrowani są nabywcy?' },
      { en: 'Can buyers backward integrate?', pl: 'Czy nabywcy mogą się integrować wstecz?' },
      { en: 'How price sensitive are they?', pl: 'Jak wrażliwi są na cenę?' },
    ],
    color: 'blue',
  },
  supplierPower: {
    title: { en: 'Bargaining Power of Suppliers', pl: 'Siła przetargowa dostawców' },
    description: {
      en: "Suppliers' ability to drive prices up",
      pl: 'Zdolność dostawców do podnoszenia cen',
    },
    questions: [
      { en: 'How concentrated are suppliers?', pl: 'Jak skoncentrowani są dostawcy?' },
      { en: 'Are there substitutes for inputs?', pl: 'Czy są substytuty dla wejść?' },
      { en: 'How important is volume to them?', pl: 'Jak ważny jest dla nich wolumen?' },
    ],
    color: 'emerald',
  },
};

// ==================== COMPONENT ====================

export const ForceStep: React.FC<ForceStepProps> = ({ forceId, session, isPolish }) => {
  const { updateInputData } = useToolStore();
  const [newDriver, setNewDriver] = useState('');

  const config = FORCE_CONFIG[forceId];
  const lang = isPolish ? 'pl' : 'en';
  const porterData = session.inputData as PorterData;
  const force = porterData.forces[forceId];

  const handleScoreChange = (score: number) => {
    updateInputData({
      forces: {
        ...porterData.forces,
        [forceId]: { ...force, score },
      },
    } as Partial<PorterData>);
  };

  const handleTrendChange = (trend: 'increasing' | 'stable' | 'decreasing') => {
    updateInputData({
      forces: {
        ...porterData.forces,
        [forceId]: { ...force, trend },
      },
    } as Partial<PorterData>);
  };

  const handleAddDriver = () => {
    if (!newDriver.trim()) return;
    updateInputData({
      forces: {
        ...porterData.forces,
        [forceId]: { ...force, drivers: [...force.drivers, newDriver.trim()] },
      },
    } as Partial<PorterData>);
    setNewDriver('');
  };

  const handleRemoveDriver = (index: number) => {
    updateInputData({
      forces: {
        ...porterData.forces,
        [forceId]: { ...force, drivers: force.drivers.filter((_, i) => i !== index) },
      },
    } as Partial<PorterData>);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg bg-${config.color}-100 dark:bg-${config.color}-900/30 flex items-center justify-center`}
        >
          <span
            className={`text-lg font-bold text-${config.color}-600 dark:text-${config.color}-400`}
          >
            {forceId.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {config.title[lang]}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{config.description[lang]}</p>
        </div>
      </div>

      {/* Score selector */}
      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white mb-3">
          {isPolish ? 'Intensywność siły' : 'Force Intensity'}
        </h3>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              onClick={() => handleScoreChange(score)}
              className={`
                flex-1 py-3 rounded-lg border-2 transition-colors
                ${
                  force.score === score
                    ? `border-${config.color}-500 bg-${config.color}-50 dark:bg-${config.color}-900/20`
                    : 'border-slate-200 dark:border-navy-700 hover:border-slate-300'
                }
              `}
            >
              <div
                className={`text-lg font-bold ${force.score === score ? `text-${config.color}-600 dark:text-${config.color}-400` : 'text-slate-600 dark:text-slate-400'}`}
              >
                {score}
              </div>
              <div className="text-xs text-slate-600">
                {score === 1
                  ? isPolish
                    ? 'Bardzo niska'
                    : 'Very Low'
                  : score === 2
                    ? isPolish
                      ? 'Niska'
                      : 'Low'
                    : score === 3
                      ? isPolish
                        ? 'Umiarkowana'
                        : 'Moderate'
                      : score === 4
                        ? isPolish
                          ? 'Wysoka'
                          : 'High'
                        : isPolish
                          ? 'Bardzo wysoka'
                          : 'Very High'}
              </div>
            </button>
          ))}
        </div>
        <InlineAssist
          hint={
            isPolish
              ? 'Ocena powinna byc oparta o dane rynkowe.'
              : 'Score should be grounded in market data.'
          }
        />
      </div>

      {/* Trend selector */}
      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white mb-3">
          {isPolish ? 'Trend' : 'Trend'}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleTrendChange('increasing')}
            className={`
              flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors
              ${
                force.trend === 'increasing'
                  ? 'border-danger-500 bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300'
                  : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
              }
            `}
          >
            <TrendingUp className="w-4 h-4" />
            {isPolish ? 'Rosnący' : 'Increasing'}
          </button>
          <button
            onClick={() => handleTrendChange('stable')}
            className={`
              flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors
              ${
                force.trend === 'stable'
                  ? 'border-slate-500 bg-slate-50 dark:bg-slate-900/20 text-slate-700 dark:text-slate-300'
                  : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
              }
            `}
          >
            <Minus className="w-4 h-4" />
            {isPolish ? 'Stabilny' : 'Stable'}
          </button>
          <button
            onClick={() => handleTrendChange('decreasing')}
            className={`
              flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-colors
              ${
                force.trend === 'decreasing'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
              }
            `}
          >
            <TrendingDown className="w-4 h-4" />
            {isPolish ? 'Malejący' : 'Decreasing'}
          </button>
        </div>
        <InlineAssist
          hint={
            isPolish
              ? 'Wskaz czy sila rosnie czy maleje i dlaczego.'
              : 'Indicate if the force is increasing or decreasing and why.'
          }
        />
      </div>

      {/* Drivers */}
      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white mb-3">
          {isPolish ? 'Kluczowe czynniki' : 'Key Drivers'}
        </h3>

        {/* Add driver */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newDriver}
            onChange={(e) => setNewDriver(e.target.value)}
            placeholder={isPolish ? 'Dodaj czynnik...' : 'Add a driver...'}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAddDriver()}
          />
          <button
            onClick={handleAddDriver}
            disabled={!newDriver.trim()}
            className="px-3 py-2 rounded-lg bg-c-text text-c-bg hover:bg-c-text-secondary transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Drivers list */}
        <div className="space-y-2">
          {force.drivers.length > 0 ? (
            force.drivers.map((driver, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-navy-900"
              >
                <span className="text-sm text-slate-700 dark:text-slate-300">{driver}</span>
                <button
                  onClick={() => handleRemoveDriver(index)}
                  className="p-1 rounded hover:bg-danger-100 dark:hover:bg-danger-900/30 text-slate-600 hover:text-danger-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600 italic">
              {isPolish ? 'Brak dodanych czynników' : 'No drivers added'}
            </p>
          )}
        </div>
        <InlineAssist
          hint={
            isPolish
              ? 'Dodaj 2-4 konkretne czynniki dla kazdej sily.'
              : 'Add 2-4 concrete drivers for each force.'
          }
        />
      </div>

      {/* Guiding questions */}
      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
          {isPolish ? 'Pytania pomocnicze' : 'Guiding Questions'}
        </h4>
        <ul className="space-y-1 text-sm text-blue-600 dark:text-blue-400">
          {config.questions.map((q, i) => (
            <li key={i}>• {q[lang]}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ForceStep;
