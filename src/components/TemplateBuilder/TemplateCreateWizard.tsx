/**
 * TemplateCreateWizard — wspólny START tworzenia szablonu (#83c §4.1).
 *
 * Lekki modal, identyczny dla 3 typów (doktryna „łatwe, lekkie, przyjemne"):
 *   KROK 1 NAZWA → KROK 2 TYP (Prezentacja / Word / Excel) → KROK 3 DOSTĘPNOŚĆ.
 * Po zakończeniu otwiera builder per typ (kontener) z pustym szkieletem.
 *
 * System-template'y NIE przechodzą tym flow (seed migracjami).
 */

import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ArrowRight, Check, FileText, LayoutTemplate, Table2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/primitives/Button';

import { TextInput } from './templateBuilderFields';
import {
  pickTemplateLabel,
  SCOPE_LABELS,
  SCOPE_LABELS_EN,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_TYPE_LABELS_EN,
  type TemplateScope,
  type TemplateType,
} from './templateBuilderModel';

export interface TemplateCreateWizardProps {
  open: boolean;
  onCancel: () => void;
  onComplete: (payload: { name: string; type: TemplateType; scope: TemplateScope }) => void;
  /** wstępny typ (gdy start z konkretnej zakładki, np. Materials▸Prezentacje). */
  initialType?: TemplateType;
}

function typeCards(t: (key: string, fallback: string) => string): { type: TemplateType; icon: LucideIcon; desc: string }[] {
  return [
    {
      type: 'deck',
      icon: LayoutTemplate,
      desc: t(
        'templateBuilder.wizard.deckDesc',
        'Reużywalny układ slajdów: archetypy, kolejność, placeholdery.'
      ),
    },
    {
      type: 'doc',
      icon: FileText,
      desc: t('templateBuilder.wizard.docDesc', 'Struktura dokumentu: sekcje, typy bloków, głębokość.'),
    },
    {
      type: 'table',
      icon: Table2,
      desc: t('templateBuilder.wizard.tableDesc', 'Schemat arkusza: kolumny, typy danych, formuły.'),
    },
  ];
}

type Step = 1 | 2 | 3;

export const TemplateCreateWizard: React.FC<TemplateCreateWizardProps> = ({
  open,
  onCancel,
  onComplete,
  initialType,
}) => {
  const { t, i18n } = useTranslation();
  const TYPE_CARDS = typeCards(t);
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [type, setType] = useState<TemplateType | null>(initialType ?? null);
  const [scope, setScope] = useState<TemplateScope>('private');

  if (!open) return null;

  const canNext = step === 1 ? name.trim().length > 0 : step === 2 ? type !== null : true;

  const reset = () => {
    setStep(1);
    setName('');
    setType(initialType ?? null);
    setScope('private');
  };
  const cancel = () => {
    reset();
    onCancel();
  };
  const next = () => {
    if (step < 3) setStep((s) => (s + 1) as Step);
    else if (type) {
      onComplete({ name: name.trim(), type, scope });
      reset();
    }
  };

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('templateBuilder.wizard.title', 'Nowy szablon')}
      data-testid="template-create-wizard"
    >
      <button
        type="button"
        aria-label={t('templateBuilder.wizard.close', 'Zamknij')}
        className="absolute inset-0 bg-black/50 z-overlay"
        onClick={cancel}
      />
      <div className="relative z-modal w-full max-w-lg rounded-xl border border-c-border bg-c-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-c-border">
          <div>
            <h2 className="text-base font-semibold text-c-text">
              {t('templateBuilder.wizard.title', 'Nowy szablon')}
            </h2>
            <p className="text-xs text-c-text-muted mt-0.5">
              {t('templateBuilder.wizard.stepOf', 'Krok {{step}} z 3', { step })}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('templateBuilder.wizard.close', 'Zamknij')}
            onClick={cancel}
            className="p-1.5 rounded-lg text-c-text-muted hover:text-c-text hover:bg-c-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex gap-1.5 px-5 pt-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-c-focus' : 'bg-c-border'}`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="px-5 py-5 min-h-[220px]">
          {step === 1 && (
            <div className="space-y-3" data-testid="wizard-step-name">
              <label className="block text-sm font-medium text-c-text">
                {t('templateBuilder.wizard.nameLabel', 'Nazwa szablonu')}
              </label>
              <TextInput
                value={name}
                onChange={setName}
                placeholder={t('templateBuilder.wizard.namePlaceholder', 'np. Raport statusu projektu')}
                testId="wizard-name"
              />
              <p className="text-xs text-c-text-muted">
                {t('templateBuilder.wizard.nameHint', 'Nazwę zmienisz później w builderze.')}
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2.5" data-testid="wizard-step-type">
              <p className="text-sm font-medium text-c-text mb-2">{t('templateBuilder.wizard.chooseType', 'Wybierz typ')}</p>
              {TYPE_CARDS.map((c) => {
                const Icon = c.icon;
                const active = type === c.type;
                return (
                  <button
                    key={c.type}
                    type="button"
                    onClick={() => setType(c.type)}
                    className={[
                      'w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus',
                      active
                        ? 'border-c-focus bg-c-focus/10'
                        : 'border-c-border bg-c-surface hover:bg-c-bg',
                    ].join(' ')}
                    data-testid={`wizard-type-${c.type}`}
                    aria-pressed={active}
                  >
                    <span
                      className={[
                        'shrink-0 grid place-items-center w-9 h-9 rounded-lg',
                        active ? 'bg-c-focus text-white' : 'bg-c-bg text-c-text-muted',
                      ].join(' ')}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-c-text">
                        {pickTemplateLabel(TEMPLATE_TYPE_LABELS, TEMPLATE_TYPE_LABELS_EN, c.type, i18n.language || 'pl')}
                      </span>
                      <span className="block text-xs text-c-text-muted">{c.desc}</span>
                    </span>
                    {active && <Check className="w-4 h-4 text-c-focus ml-auto mt-1 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2.5" data-testid="wizard-step-scope">
              <p className="text-sm font-medium text-c-text mb-2">{t('templateBuilder.wizard.availability', 'Dostępność')}</p>
              {(['private', 'org'] as TemplateScope[]).map((s) => {
                const active = scope === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScope(s)}
                    className={[
                      'w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus',
                      active
                        ? 'border-c-focus bg-c-focus/10'
                        : 'border-c-border bg-c-surface hover:bg-c-bg',
                    ].join(' ')}
                    data-testid={`wizard-scope-${s}`}
                    aria-pressed={active}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-c-text">
                        {pickTemplateLabel(SCOPE_LABELS, SCOPE_LABELS_EN, s, i18n.language || 'pl')}
                      </span>
                      <span className="block text-xs text-c-text-muted">
                        {s === 'private'
                          ? t('templateBuilder.wizard.privateHint', 'Widoczny tylko dla Ciebie. Domyślnie.')
                          : t(
                              'templateBuilder.wizard.orgHint',
                              'Widoczny dla całej organizacji (może wymagać zatwierdzenia).'
                            )}
                      </span>
                    </span>
                    {active && <Check className="w-4 h-4 text-c-focus ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-c-border">
          <Button
            variant="ghost"
            onClick={step === 1 ? cancel : () => setStep((s) => (s - 1) as Step)}
            icon={step === 1 ? undefined : <ArrowLeft className="w-4 h-4" />}
          >
            {step === 1 ? t('templateBuilder.wizard.cancel', 'Anuluj') : t('templateBuilder.wizard.back', 'Wstecz')}
          </Button>
          <Button
            variant="primary"
            onClick={next}
            disabled={!canNext}
            icon={step === 3 ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          >
            {step === 3 ? t('templateBuilder.wizard.createAndEdit', 'Utwórz i edytuj') : t('templateBuilder.wizard.next', 'Dalej')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TemplateCreateWizard;
