/**
 * Consultify Document Studio — "Zrób z tego wzorzec" modal (Fala 2, 2026-07-28).
 *
 * Ożywia `createTemplateFromArtifact` (server-side, complete since it
 * shipped, but never called from the UI — see
 * `Harvard/wdrozenie-100/_SPEC_GENERATOR_TEMPLATOW_2026-07-28.md` Część 3.1).
 *
 * The mechanical extraction (titles, order, level, length) is 100%
 * deterministic and needs no input. This modal asks ONLY the handful of
 * things that can't be deduced from the document itself (N12: "nie
 * wyklikiwanie" — max 5 short questions, no tables, no forced clicking):
 *
 *   1. Which sections are optional (checkboxes, pre-checked = required,
 *      matching today's "always required" default when left untouched).
 *   2. Which data should refresh each time vs. stay fixed text (free text).
 *   3. Keep colors bundled with this template, or save them as a separate,
 *      reusable pattern (N31 — the same "wzorzec kolorów / wzorzec treści,
 *      można nakładać, ale niekoniecznie" choice Fala 1 wired into the
 *      Architect, applied here at extraction time).
 *   4. Anything client-specific that needs review before others reuse this
 *      (free text — surfaced in the draft's notes, not auto-redacted; the
 *      extraction never copies body content, only section titles/purposes,
 *      so there is nothing to mechanically scrub).
 *   5. Name — always shown, but pre-filled with the same default the
 *      server already computes (`${title} (Copy)`), so it costs zero
 *      clicks unless the author wants to rename it.
 *
 * No existing "ask clarifying questions" engine (Teresa / intake /
 * narrativeEngine / `ResearchClarification.tsx`) fit: those are either
 * LLM-driven multi-choice flows for a different domain (research topic
 * disambiguation) or full authoring intake forms. This is a small,
 * deterministic, one-off form — building a second generic "clarification
 * engine" here would be over-engineering for 4 fixed questions.
 */
import { Loader2, Wand2, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ColorPatternPicker } from '@/components/shared/colorPatterns/ColorPatternPicker';
import { useBrandKitColors } from '@/components/shared/colorPatterns/useBrandKitColors';
import Button from '@/components/ui/primitives/Button';

import { createDocumentStudioTemplateFromArtifact } from './api';
import type { DocumentSection, DocumentTemplate } from './types';

export interface CreateTemplateFromArtifactModalProps {
  artifactId: string;
  documentTitle: string;
  sections: DocumentSection[];
  onClose: () => void;
  onCreated: (template: DocumentTemplate) => void;
}

export const CreateTemplateFromArtifactModal: React.FC<CreateTemplateFromArtifactModalProps> = ({
  artifactId,
  documentTitle,
  sections,
  onClose,
  onCreated,
}) => {
  const { t } = useTranslation();
  const brandKitColors = useBrandKitColors();

  const defaultName = `${documentTitle || t('documentStudio.createFromArtifact.untitled', 'Untitled document')} ${t(
    'documentStudio.fileMenu.saveAsCopySuffix',
    '(kopia)'
  )}`;
  const [name, setName] = useState(defaultName);
  // Q1 — pre-checked (= required), matching the pre-Fala-2 "always required" default.
  const [optionalSectionIds, setOptionalSectionIds] = useState<Set<string>>(new Set());
  const [dataRefreshText, setDataRefreshText] = useState('');
  const [colorChoice, setColorChoice] = useState<'together' | 'separate'>('together');
  const [colorPatternId, setColorPatternId] = useState('');
  const [sensitiveText, setSensitiveText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderedSections = useMemo(
    () => sections.slice().sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
    [sections]
  );

  const toggleOptional = (sectionId: string): void => {
    setOptionalSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const handleSubmit = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const dataRefreshHints = dataRefreshText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const template = await createDocumentStudioTemplateFromArtifact(artifactId, {
        name: name.trim() || undefined,
        optionalSectionIds: Array.from(optionalSectionIds),
        dataRefreshHints,
        carryColorPattern: colorChoice === 'together',
        sensitiveContentNotes: sensitiveText.trim() || undefined,
      });
      onCreated(template);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.createFromArtifact.error', 'Nie udało się utworzyć wzorca')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('documentStudio.createFromArtifact.title', 'Zrób z tego wzorzec')}
    >
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-c-border-subtle bg-c-surface shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-c-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-c-text-secondary" aria-hidden />
            <div>
              <div className="text-sm font-semibold text-c-text">
                {t('documentStudio.createFromArtifact.title', 'Zrób z tego wzorzec')}
              </div>
              <div className="text-xs text-c-text-secondary">
                {t(
                  'documentStudio.createFromArtifact.subtitle',
                  'Strukturę wyciągamy automatycznie. Zostały tylko rzeczy, których nie da się wydedukować z dokumentu.'
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('documentStudio.createFromArtifact.close', 'Zamknij')}
            className="rounded-md p-1.5 text-c-text-muted hover:bg-c-surface-raised hover:text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-700 dark:text-danger-400"
            >
              {error}
            </div>
          ) : null}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-c-text">
              {t('documentStudio.createFromArtifact.nameLabel', 'Nazwa wzorca')}
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>

          {orderedSections.length > 0 ? (
            <div>
              <span className="text-sm font-medium text-c-text">
                {t(
                  'documentStudio.createFromArtifact.sectionsQuestion',
                  'Czy każda sekcja ma zawsze występować w kolejnych dokumentach?'
                )}
              </span>
              <p className="mt-0.5 text-xs text-c-text-secondary">
                {t(
                  'documentStudio.createFromArtifact.sectionsHint',
                  'Odznacz sekcje, które pojawiły się tylko w tym dokumencie — reszta zostanie oznaczona jako obowiązkowa.'
                )}
              </p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-c-border-subtle bg-c-surface-raised p-2">
                {orderedSections.map((section) => (
                  <li key={section.sectionId} className="flex items-center gap-2 px-1 py-0.5">
                    <input
                      type="checkbox"
                      id={`optional-${section.sectionId}`}
                      checked={!optionalSectionIds.has(section.sectionId)}
                      onChange={() => toggleOptional(section.sectionId)}
                      className="h-4 w-4 rounded border-c-border-subtle text-c-focus-solid focus:ring-c-focus"
                    />
                    <label
                      htmlFor={`optional-${section.sectionId}`}
                      className="flex-1 truncate text-sm text-c-text"
                    >
                      {section.title}
                    </label>
                    <span className="shrink-0 text-[11px] text-c-text-muted">
                      {optionalSectionIds.has(section.sectionId)
                        ? t('documentStudio.createFromArtifact.optional', 'czasami')
                        : t('documentStudio.createFromArtifact.required', 'zawsze')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-c-text">
              {t(
                'documentStudio.createFromArtifact.dataRefreshQuestion',
                'Które dane mają się za każdym razem odświeżać (nie zostać jako stały tekst)?'
              )}{' '}
              <span className="text-xs font-normal text-c-text-muted">
                {t('documentStudio.createFromArtifact.optionalHint', '(opcjonalnie)')}
              </span>
            </span>
            <textarea
              value={dataRefreshText}
              onChange={(e) => setDataRefreshText(e.target.value)}
              rows={2}
              placeholder={t(
                'documentStudio.createFromArtifact.dataRefreshPlaceholder',
                'Jedna pozycja na linię, np. przychód kwartalny, lista ryzyk'
              )}
              className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>

          <div>
            <span className="text-sm font-medium text-c-text">
              {t('documentStudio.createFromArtifact.colorQuestion', 'Kolory tego dokumentu')}
            </span>
            <div className="mt-1.5 space-y-1.5">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="colorChoice"
                  checked={colorChoice === 'together'}
                  onChange={() => setColorChoice('together')}
                  className="mt-0.5 h-4 w-4 text-c-focus-solid focus:ring-c-focus"
                />
                <span>
                  {t(
                    'documentStudio.createFromArtifact.colorTogether',
                    'Zapisz razem z treścią (ten wzorzec zawsze wygląda tak samo)'
                  )}
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="colorChoice"
                  checked={colorChoice === 'separate'}
                  onChange={() => setColorChoice('separate')}
                  className="mt-0.5 h-4 w-4 text-c-focus-solid focus:ring-c-focus"
                />
                <span>
                  {t(
                    'documentStudio.createFromArtifact.colorSeparate',
                    'Zapisz osobno — kolory wybieram przy każdym użyciu'
                  )}
                </span>
              </label>
            </div>
            {colorChoice === 'separate' ? (
              <div className="mt-2 rounded-lg border border-c-border-subtle bg-c-surface-raised p-2">
                <p className="mb-2 text-[11px] text-c-text-secondary">
                  {t(
                    'documentStudio.createFromArtifact.colorSeparateHint',
                    'Ten wzorzec zapisze się bez kolorów — możesz od razu wybrać jeden do wykorzystania gdzie indziej, albo zrobić to później w Architekcie szablonów.'
                  )}
                </p>
                <ColorPatternPicker
                  value={colorPatternId}
                  onChange={setColorPatternId}
                  brandKitColors={brandKitColors}
                  hideLabel
                />
              </div>
            ) : null}
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-c-text">
              {t(
                'documentStudio.createFromArtifact.sensitiveQuestion',
                'Czy coś w tym dokumencie jest specyficzne tylko dla tego klienta i trzeba to usunąć przed użyciem przez innych?'
              )}{' '}
              <span className="text-xs font-normal text-c-text-muted">
                {t('documentStudio.createFromArtifact.optionalHint', '(opcjonalnie)')}
              </span>
            </span>
            <textarea
              value={sensitiveText}
              onChange={(e) => setSensitiveText(e.target.value)}
              rows={2}
              placeholder={t(
                'documentStudio.createFromArtifact.sensitivePlaceholder',
                'Np. nazwa klienta w sekcji X, konkretna liczba w akapicie Y'
              )}
              className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-c-border-subtle px-5 py-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            {t('documentStudio.createFromArtifact.cancel', 'Anuluj')}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('documentStudio.createFromArtifact.submitBusy', 'Tworzę…')}
              </span>
            ) : (
              t('documentStudio.createFromArtifact.submit', 'Utwórz wzorzec')
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateTemplateFromArtifactModal;
