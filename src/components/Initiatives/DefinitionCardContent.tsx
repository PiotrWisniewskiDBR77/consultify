import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Api } from '@/services/api';
import type { InitiativeCardVersionReadModel } from '@/services/initiatives-execution/runtimeApi';
import { isInitiativesPortfolioAnalysisEnabled } from '@/utils/initiativesPortfolioAnalysisFlag';

const definitions = [
  [
    'summary-scope',
    'Zakres i cel',
    'Scope and outcome',
    [
      ['problem', 'Problem', 'Problem'],
      ['outcome', 'Oczekiwany rezultat', 'Expected outcome'],
      ['inScope', 'W zakresie', 'In scope', true],
      ['outOfScope', 'Poza zakresem', 'Out of scope', true],
    ],
  ],
  [
    'strategic-fit',
    'Dopasowanie strategiczne',
    'Strategic fit',
    [
      ['objectives', 'Cele strategiczne', 'Strategic objectives', true],
      ['rationale', 'Uzasadnienie', 'Rationale'],
    ],
  ],
  [
    'success-criteria',
    'Kryteria sukcesu',
    'Success criteria',
    [
      ['successCriteria', 'Kryteria sukcesu', 'Success criteria', true],
      ['measurementPlan', 'Plan pomiaru', 'Measurement plan'],
    ],
  ],
  [
    'outcomes-benefits',
    'Rezultaty i korzyści',
    'Outcomes and benefits',
    [
      ['outcomes', 'Rezultaty', 'Outcomes', true],
      ['benefits', 'Korzyści', 'Benefits', true],
    ],
  ],
  [
    'options',
    'Warianty',
    'Options',
    [
      ['doNothing', 'Brak działania', 'Do nothing'],
      ['alternatives', 'Alternatywy', 'Alternatives', true],
    ],
  ],
  [
    'people-team',
    'Zespół i dostępność',
    'Team and capacity',
    [
      ['team', 'Zespół', 'Team', true],
      ['capacityAssumptions', 'Założenia dostępności', 'Capacity assumptions'],
    ],
  ],
  [
    'roles-raci',
    'Role i odpowiedzialność',
    'Roles and accountability',
    [
      ['accountableOwnerId', 'Osoba odpowiedzialna', 'Accountable owner'],
      ['roles', 'Role', 'Roles', true],
    ],
  ],
  [
    'stakeholders',
    'Interesariusze',
    'Stakeholders',
    [
      ['ownerId', 'Właściciel', 'Owner'],
      ['sponsorId', 'Sponsor', 'Sponsor'],
    ],
  ],
] as const;

export interface DefinitionCardDraft {
  content: Record<string, unknown>;
  evidence: string;
  quality: string;
  completion: string;
  cardVersion: number;
  estimateValue?: string;
  estimateBasis?: string;
}
export type DefinitionCardDraftStore = React.MutableRefObject<
  Record<string, Record<string, DefinitionCardDraft>>
>;
export const DEFINITION_CONTENT_CARD_KEYS: readonly string[] = definitions.map((item) => item[0]);

/** Existing canonical card publication/review; no acceptance is inferred from a save. */
function DefinitionCardContentForInitiative({
  initiativeId,
  actorId,
  participants,
  canEdit,
  canReview,
  onChanged,
  findingTarget,
  selectedCardKey,
  draftStore,
  onDraftStateChange,
}: {
  initiativeId: string;
  actorId: string;
  participants: Array<{ id: string; name: string }>;
  canEdit: boolean;
  canReview: boolean;
  onChanged: () => Promise<void>;
  findingTarget?: { cardKey: string; field?: string; requestId: number };
  selectedCardKey?: string;
  draftStore?: DefinitionCardDraftStore;
  onDraftStateChange?: () => void;
}) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const { i18n } = useTranslation();
  const pl = i18n.language.startsWith('pl');
  const [cards, setCards] = useState<InitiativeCardVersionReadModel[]>([]);
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const [key, setKey] = useState(() =>
    DEFINITION_CONTENT_CARD_KEYS.includes(selectedCardKey || '')
      ? selectedCardKey!
      : 'summary-scope'
  );
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [evidence, setEvidence] = useState('');
  const [quality, setQuality] = useState('UNKNOWN');
  const [completion, setCompletion] = useState('IN_PROGRESS');
  const [rationale, setRationale] = useState('');
  const [estimateValue, setEstimateValue] = useState('');
  const [estimateBasis, setEstimateBasis] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const estimateEnabled = isInitiativesPortfolioAnalysisEnabled();
  const editorRef = useRef<HTMLDetailsElement>(null);
  const ownDraftStore = useRef<Record<string, Record<string, DefinitionCardDraft>>>({});
  const store = draftStore ?? ownDraftStore;
  const draftScope = JSON.stringify([initiativeId, actorId]);
  store.current[draftScope] ??= {};
  const drafts = { current: store.current[draftScope] };
  const retainDraft = (patch: Partial<DefinitionCardDraft>) => {
    drafts.current[key] = {
      content,
      evidence,
      quality,
      completion,
      estimateValue,
      estimateBasis,
      cardVersion: drafts.current[key]?.cardVersion ?? current?.cardVersion ?? 0,
      ...patch,
    };
  };
  const current = cards.find((c) => c.cardKey === key);
  const definition = definitions.find((d) => d[0] === key)!;
  const base = `/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}`;
  const reload = async () => {
    const next = await Api.get(`${base}/cards`);
    if (!active.current) return;
    setCards(next.cards);
    setCardsLoaded(true);
    setVersion(next.initiativeVersion);
  };
  useEffect(() => {
    void reload().catch((e) => active.current && setError(e.message));
  }, [initiativeId]);
  useEffect(() => {
    const draft = drafts.current[key];
    setContent(draft?.content ?? current?.content ?? {});
    setEvidence(draft?.evidence ?? (current?.evidenceRefs || []).join('\n'));
    setQuality(draft?.quality ?? current?.quality ?? 'UNKNOWN');
    setCompletion(draft?.completion ?? current?.completion ?? 'IN_PROGRESS');
    setEstimateValue(draft?.estimateValue ?? current?.estimate?.value ?? '');
    setEstimateBasis(draft?.estimateBasis ?? current?.estimate?.basis ?? '');
    setRationale('');
  }, [key, cards]);
  useEffect(() => {
    if (selectedCardKey && DEFINITION_CONTENT_CARD_KEYS.includes(selectedCardKey)) {
      setKey(selectedCardKey);
      if (editorRef.current) editorRef.current.open = true;
    }
  }, [selectedCardKey]);
  useEffect(() => {
    if (!findingTarget || !definitions.some((item) => item[0] === findingTarget.cardKey)) return;
    setKey(findingTarget.cardKey);
    if (editorRef.current) editorRef.current.open = true;
  }, [findingTarget]);
  useEffect(() => {
    if (!findingTarget || findingTarget.cardKey !== key) return;
    const field = findingTarget.field;
    const target = field
      ? Array.from(
          editorRef.current?.querySelectorAll<HTMLElement>('[data-definition-field]') || []
        ).find((element) => element.dataset.definitionField === field)
      : editorRef.current?.querySelector<HTMLElement>('textarea, select');
    target?.focus();
  }, [findingTarget, key, cards]);
  const dirty = Boolean(drafts.current[key]);
  useEffect(() => { onDraftStateChange?.(); }, [dirty, key, onDraftStateChange]);
  const act = async (kind: 'publish' | 'review') => {
    if (!active.current || busy || (kind === 'review' && dirty)) return;
    setBusy(true);
    setError('');
    try {
      if (kind === 'publish')
        await Api.post(`${base}/cards/${key}/publications`, {
          expectedVersion: version,
          expectedCardVersion: drafts.current[key]?.cardVersion ?? current?.cardVersion ?? 0,
          clientRequestId: crypto.randomUUID(),
          applicability: current?.applicability || 'REQUIRED',
          completion,
          quality,
          freshness: current?.freshness || 'CURRENT',
          reviewState: 'REQUESTED',
          content,
          evidenceRefs: evidence
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          waiverDecisionId: current?.waiverDecisionId || null,
          ...(estimateEnabled
            ? {
                estimate:
                  estimateValue.trim() && estimateBasis.trim()
                    ? { value: estimateValue.trim(), basis: estimateBasis.trim() }
                    : null,
              }
            : {}),
        });
      else
        await Api.post(`${base}/cards/${key}/reviews`, {
          expectedVersion: version,
          expectedCardVersion: current?.cardVersion,
          clientRequestId: crypto.randomUUID(),
          outcome: 'ACCEPTED',
          rationale: rationale.trim(),
        });
      if (!active.current) return;
      if (kind === 'publish') delete drafts.current[key];
      await reload();
      if (active.current) await onChanged();
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (active.current) setBusy(false);
    }
  };
  return (
    <details ref={editorRef} className="space-y-3 border border-c-border rounded p-3">
      <summary>
        {pl ? 'Treść i przegląd kart definicji' : 'Definition card content and review'}
      </summary>
      {!cardsLoaded && <p role="status">{pl ? 'Wczytywanie opublikowanych kart…' : 'Loading published cards…'}</p>}
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {!selectedCardKey && (
        <label>
          {pl ? 'Karta' : 'Card'}
          <select
            value={key}
            disabled={busy || !cardsLoaded}
            onChange={(e) => setKey(e.target.value)}
            className="block bg-c-bg border border-c-border p-2"
          >
            {definitions.map((d) => (
              <option key={d[0]} value={d[0]}>
                {d[pl ? 1 : 2]}
              </option>
            ))}
          </select>
        </label>
      )}
      <p>
        {pl ? 'Przegląd' : 'Review'}: {current?.reviewState || 'NOT_REQUESTED'} ·{' '}
        {pl ? 'Wersja' : 'Version'}: {current?.cardVersion || 0}
      </p>
      <p role="status" aria-label={pl ? 'Stan zapisu karty' : 'Card save state'}>
        {dirty
          ? pl
            ? 'Niezapisany szkic'
            : 'Unsaved draft'
          : current
            ? pl
              ? 'Wczytana opublikowana wersja'
              : 'Published version loaded'
            : pl
              ? 'Karta nie została jeszcze opublikowana'
              : 'Card has not been published yet'}
      </p>
      {estimateEnabled && (
        <section
          aria-label={pl ? 'Wycena karty' : 'Card estimate'}
          className="space-y-2 rounded border border-c-border-subtle bg-c-surface px-3 py-2"
        >
          <div>
            <p className="text-sm font-semibold text-c-text-primary">
              {pl ? 'Wycena karty' : 'Card estimate'}
            </p>
            {current?.estimatedBy && current?.estimatedAt && (
              <p className="text-xs text-c-text-secondary">
                {pl ? 'Przygotował(a)' : 'Prepared by'} {current.estimatedBy} ·{' '}
                {new Intl.DateTimeFormat(pl ? 'pl-PL' : 'en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(current.estimatedAt))}
              </p>
            )}
          </div>
          <label className="block">
            {pl ? 'Wartość wyceny' : 'Estimate'}
            <input
              aria-label={pl ? 'Wartość wyceny' : 'Estimate'}
              disabled={!canEdit || busy || !cardsLoaded}
              value={estimateValue}
              placeholder={pl ? 'np. 40–60 h lub 120 000 PLN' : 'e.g. 40–60 h or PLN 120,000'}
              onChange={(event) => {
                retainDraft({ estimateValue: event.target.value });
                setEstimateValue(event.target.value);
              }}
              className="block w-full bg-c-bg border border-c-border p-2"
            />
          </label>
          <label className="block">
            {pl ? 'Podstawa wyceny' : 'Estimate basis'}
            <textarea
              aria-label={pl ? 'Podstawa wyceny' : 'Estimate basis'}
              disabled={!canEdit || busy || !cardsLoaded}
              value={estimateBasis}
              onChange={(event) => {
                retainDraft({ estimateBasis: event.target.value });
                setEstimateBasis(event.target.value);
              }}
              className="block w-full bg-c-bg border border-c-border p-2"
            />
          </label>
        </section>
      )}
      {dirty && canReview && (
        <p>
          {pl
            ? 'Przegląd dotyczy opublikowanej wersji. Zapisz zmiany i przekaż je innej osobie do przeglądu.'
            : 'Review applies to the published version. Save your changes and request review by another person.'}
        </p>
      )}
      {definition[3].map((field) => {
        const [name, labelPl, labelEn] = field;
        const array = field.length > 3 && field[3];
        const value = content[name];
        const complex =
          value != null &&
          typeof value !== 'string' &&
          !(Array.isArray(value) && value.every((x) => typeof x === 'string'));
        return (
          <label className="block" key={name}>
            {pl ? labelPl : labelEn}
            {name.endsWith('Id') ? (
              <select
                aria-label={pl ? labelPl : labelEn}
                disabled={!canEdit || busy || !cardsLoaded}
                value={String(value || '')}
                data-definition-field={name}
                onChange={(e) => {
                  const next = { ...content, [name]: e.target.value };
                  retainDraft({ content: next });
                  setContent(next);
                }}
              >
                <option value="">{pl ? 'Wybierz osobę' : 'Select a person'}</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.id}
                  </option>
                ))}
              </select>
            ) : complex ? (
              <p>
                {pl
                  ? 'Pole zawiera istniejące dane strukturalne; zostaną zachowane.'
                  : 'This field contains existing structured data and will be preserved.'}
              </p>
            ) : (
              <textarea
                disabled={!canEdit || busy || !cardsLoaded}
                value={Array.isArray(value) ? value.join('\n') : String(value || '')}
                data-definition-field={name}
                onChange={(e) => {
                  const next = {
                    ...content,
                    [name]: array ? e.target.value.split('\n').filter(Boolean) : e.target.value,
                  };
                  retainDraft({ content: next });
                  setContent(next);
                }}
                className="block w-full bg-c-bg border border-c-border p-2"
              />
            )}
          </label>
        );
      })}
      <label className="block">
        {pl ? 'Odnośniki do dowodów (po jednym w wierszu)' : 'Evidence references (one per line)'}
        <textarea
          disabled={!canEdit || busy || !cardsLoaded}
          value={evidence}
          onChange={(e) => {
            retainDraft({ evidence: e.target.value });
            setEvidence(e.target.value);
          }}
          className="block w-full bg-c-bg border border-c-border p-2"
        />
      </label>
      {canEdit && (
        <>
          <label>
            {pl ? 'Kompletność' : 'Completion'}
            <select
              aria-label={pl ? 'Kompletność' : 'Completion'}
              disabled={busy || !cardsLoaded}
              value={completion}
              onChange={(e) => {
                retainDraft({ completion: e.target.value });
                setCompletion(e.target.value);
              }}
            >
              <option value="IN_PROGRESS">{pl ? 'W opracowaniu' : 'In progress'}</option>
              <option value="COMPLETE">{pl ? 'Kompletna' : 'Complete'}</option>
              <option value="EMPTY">{pl ? 'Pusta' : 'Empty'}</option>
            </select>
          </label>
          <label>
            {pl ? 'Ocena jakości' : 'Quality assessment'}
            <select
              aria-label={pl ? 'Ocena jakości' : 'Quality assessment'}
              disabled={busy || !cardsLoaded}
              value={quality}
              onChange={(e) => {
                retainDraft({ quality: e.target.value });
                setQuality(e.target.value);
              }}
            >
              {['UNKNOWN', 'SUFFICIENT', 'WARNING', 'BLOCKER'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={
              busy ||
              !version ||
              (estimateEnabled && (!estimateValue.trim() || !estimateBasis.trim()))
            }
            onClick={() => void act('publish')}
          >
            {pl ? 'Zapisz i przekaż kartę do przeglądu' : 'Save card and request review'}
          </button>
        </>
      )}
      {(canReview || estimateEnabled) &&
        current?.publishedBy !== actorId &&
        ['REQUESTED', 'CHANGES_REQUESTED'].includes(current?.reviewState || '') && (
          <>
            {canReview ? (
              <label className="block">
                {pl ? 'Uzasadnienie przeglądu' : 'Review rationale'}
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  className="block w-full bg-c-bg border border-c-border p-2"
                />
              </label>
            ) : (
              <p className="text-sm text-c-text-secondary">
                {pl
                  ? 'Nie masz uprawnienia do zatwierdzenia tej karty.'
                  : 'You do not have permission to approve this card.'}
              </p>
            )}
            <button
              disabled={!canReview || busy || dirty || !rationale.trim()}
              onClick={() => void act('review')}
            >
              {pl ? 'Zaakceptuj treść karty' : 'Accept card content'}
            </button>
          </>
        )}
    </details>
  );
}

/** Identity boundary: a navigation never carries editable state or pending reads to another record. */
export function DefinitionCardContent(
  props: Parameters<typeof DefinitionCardContentForInitiative>[0]
) {
  return (
    <DefinitionCardContentForInitiative
      key={JSON.stringify([props.initiativeId, props.actorId])}
      {...props}
    />
  );
}
