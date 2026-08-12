/**
 * FinanceCommentsPanel — Pakiet AP-CLIENT (Gate J), priorytet #3.
 *
 * Samodzielny panel komentarzy/review: kotwice na artefakcie/wersji (poziom
 * KPI/linii/komórki/okresu — przez opcjonalny `anchor: CellRef` na nowym
 * komentarzu, ten panel go nie konstruuje samodzielnie, przyjmuje gotowy),
 * wzmianki, przypisanie z terminem, resolve/reopen, flaga blokująca,
 * checklist review (maker-checker: „Wymagane" pozycje muszą być odhaczone
 * przez KOGOŚ INNEGO niż autor zmiany — egzekwowane po stronie serwera,
 * ten panel tylko pokazuje stan).
 *
 * NIE montowany w żadnym workspace produkcyjnym w tym pakiecie — dev-render
 * only, do akceptu Piotra na zrzutach (CLAUDE.md #7).
 *
 * Za flagą `financeCommentsV1` (default OFF): przy `enabled=false` renderuje
 * `null` PRZED jakimkolwiek wywołaniem sieciowym.
 */
import React, { useEffect, useState } from 'react';

import { FinanceStatusAnnouncer } from '@/components/Finance/shared/FinanceStatusAnnouncer';
import { useFinanceCommentsFlag } from '@/hooks/useFinanceCommentsFlag';
import {
  addFinanceReviewChecklistItem,
  checkFinanceReviewChecklistItem,
  createFinanceComment,
  hasUnresolvedBlockingFinanceComments,
  listFinanceComments,
  listFinanceReviewChecklist,
  reopenFinanceComment,
  resolveFinanceComment,
  uncheckFinanceReviewChecklistItem,
} from '@/services/api/financeV2.api';
import { describeFinanceV2Error, type FinanceCommentDto, type FinanceReviewChecklistItemDto } from '@/services/api/financeV2.types';

export interface FinanceCommentsPanelProps {
  artifactId: string;
  businessVersionId: string;
  className?: string;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; title: string; detail: string; code: string | null }
  | { kind: 'loaded'; comments: FinanceCommentDto[]; checklist: FinanceReviewChecklistItemDto[]; hasUnresolvedBlocking: boolean };

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pl-PL');
  } catch {
    return iso;
  }
}

export function FinanceCommentsPanel({ artifactId, businessVersionId, className }: FinanceCommentsPanelProps): React.ReactElement | null {
  const { enabled } = useFinanceCommentsFlag();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [draftBody, setDraftBody] = useState('');
  const [draftBlocking, setDraftBlocking] = useState(false);
  const [draftMentions, setDraftMentions] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // ★ NAPRAWA a11y (Pakiet I, wymaganie #7): akcje (dodaj/rozwiąż/otwórz
  // ponownie/checklist) zapisują się w tle bez żadnego wizualnego "toast" —
  // jedyny sygnał był wzrokowy (lista się przerysowuje). `actionMessage`
  // niesie ten sam komunikat do stałego `role="status"` poniżej.
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = React.useCallback(() => {
    if (!enabled) return;
    setState({ kind: 'loading' });
    Promise.all([
      listFinanceComments({ businessVersionId }),
      listFinanceReviewChecklist(businessVersionId),
      hasUnresolvedBlockingFinanceComments(businessVersionId),
    ])
      .then(([comments, checklist, blocking]) => {
        setState({ kind: 'loaded', comments, checklist, hasUnresolvedBlocking: blocking.hasUnresolvedBlockingComments });
      })
      .catch((err) => setState({ kind: 'error', ...describeFinanceV2Error(err) }));
  }, [enabled, businessVersionId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!enabled) return null;

  async function handleAddComment() {
    if (!draftBody.trim()) return;
    setSubmitting(true);
    try {
      await createFinanceComment({
        artifactId,
        businessVersionId,
        body: draftBody.trim(),
        isBlocking: draftBlocking,
        mentions: draftMentions
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean),
      });
      setDraftBody('');
      setDraftBlocking(false);
      setDraftMentions('');
      setActionMessage('Komentarz dodany.');
      load();
    } catch (err) {
      setState({ kind: 'error', ...describeFinanceV2Error(err) });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve(commentId: string) {
    try {
      await resolveFinanceComment(commentId);
      setActionMessage('Komentarz oznaczony jako rozwiązany.');
      load();
    } catch (err) {
      setState({ kind: 'error', ...describeFinanceV2Error(err) });
    }
  }

  async function handleReopen(commentId: string) {
    try {
      await reopenFinanceComment(commentId);
      setActionMessage('Komentarz otwarty ponownie.');
      load();
    } catch (err) {
      setState({ kind: 'error', ...describeFinanceV2Error(err) });
    }
  }

  async function handleAddChecklistItem() {
    if (!newChecklistItem.trim()) return;
    try {
      await addFinanceReviewChecklistItem({ businessVersionId, item: newChecklistItem.trim(), required: true });
      setNewChecklistItem('');
      setActionMessage('Pozycja checklisty dodana.');
      load();
    } catch (err) {
      setState({ kind: 'error', ...describeFinanceV2Error(err) });
    }
  }

  async function handleToggleChecklistItem(item: FinanceReviewChecklistItemDto) {
    try {
      if (item.checkedBy) {
        await uncheckFinanceReviewChecklistItem(item.id);
        setActionMessage(`Odznaczono: ${item.item}.`);
      } else {
        await checkFinanceReviewChecklistItem(item.id);
        setActionMessage(`Odhaczono: ${item.item}.`);
      }
      load();
    } catch (err) {
      setState({ kind: 'error', ...describeFinanceV2Error(err) });
    }
  }

  if (state.kind === 'loading') {
    return (
      <>
        <FinanceStatusAnnouncer message="Ładowanie komentarzy…" />
        <div className={`rounded-lg border border-c-border-subtle bg-c-surface p-3 ${className ?? ''}`} data-testid="comments-panel-loading">
          <p className="text-xs text-c-text-secondary">Ładowanie komentarzy…</p>
        </div>
      </>
    );
  }

  if (state.kind === 'error') {
    return (
      <>
        <FinanceStatusAnnouncer message={`Błąd: ${state.title}`} priority="assertive" />
        <div className={`rounded-lg border border-c-danger/40 bg-c-surface p-3 ${className ?? ''}`} data-testid="comments-panel-error">
          <p className="text-sm font-medium text-c-danger">{state.title}</p>
          <p className="text-xs text-c-text-secondary">{state.detail}</p>
        </div>
      </>
    );
  }

  const { comments, checklist, hasUnresolvedBlocking } = state;
  const requiredChecked = checklist.filter((i) => i.required).every((i) => i.checkedBy);

  return (
    <div className={`flex flex-col gap-4 rounded-lg border border-c-border-subtle bg-c-surface p-3 ${className ?? ''}`} data-testid="finance-comments-panel">
      <FinanceStatusAnnouncer message={actionMessage ?? 'Komentarze wczytane.'} />
      {/* ★ NAPRAWA a11y (Pakiet I): `text-c-danger` na tle `bg-c-danger/10`
          mierzył 3.92:1 (axe, próg 4.5:1) — ten sam odcień w tle i tekście
          obniża kontrast mimo że c-danger na czystej powierzchni przechodzi.
          `text-red-800`/dark `red-300` to konwencja `StatusChip` TONE_SHELL. */}
      {hasUnresolvedBlocking ? (
        <div className="rounded-md border border-c-danger/40 bg-c-danger/10 px-3 py-2 text-xs text-red-800 dark:text-red-300" data-testid="comments-blocking-banner">
          Są nierozwiązane komentarze blokujące — zatwierdzenie tej wersji jest wstrzymane do ich rozwiązania.
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold text-c-text-secondary">Komentarze ({comments.length})</p>
        <ul className="flex flex-col gap-2" data-testid="comments-list">
          {comments.length === 0 ? (
            <li className="text-xs text-c-text-secondary">Brak komentarzy.</li>
          ) : (
            comments.map((comment) => (
              <li key={comment.id} className="rounded-md border border-c-border-subtle p-2" data-testid="comment-item" data-resolved={comment.resolvedAt ? 'true' : 'false'}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-c-text-primary">{comment.authorId}</span>
                  <span className="text-[11px] text-c-text-secondary">{formatDate(comment.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs text-c-text-primary">{comment.body}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {comment.isBlocking ? (
                    <span className="rounded-full border border-c-danger/40 bg-c-danger/10 px-1.5 py-0.5 text-[11px] text-red-800 dark:text-red-300">Blokujący</span>
                  ) : null}
                  {comment.mentions.length > 0 ? (
                    <span className="text-[11px] text-c-text-secondary">Wzmianki: {comment.mentions.join(', ')}</span>
                  ) : null}
                  {comment.resolvedAt ? (
                    <>
                      <span className="text-[11px] text-c-text-secondary">Rozwiązany {formatDate(comment.resolvedAt)}</span>
                      {/* ★ NAPRAWA a11y (Pakiet I): `--c-focus` to `rgba(37,99,235,0.4)`
                          — 40% KRYCIA, zaprojektowany jako pierścień fokusa, NIE
                          kolor tekstu. Jako `text-c-focus` dawał 1.8:1 (axe, próg
                          4.5:1) — prawie niewidoczny link. `text-c-focus-solid`
                          (`#2563eb`, pełne krycie) to właściwy token do tekstu. */}
                      <button type="button" className="text-[11px] font-medium text-c-focus-solid hover:underline" onClick={() => handleReopen(comment.id)}>
                        Otwórz ponownie
                      </button>
                    </>
                  ) : (
                    <button type="button" className="text-[11px] font-medium text-c-focus-solid hover:underline" onClick={() => handleResolve(comment.id)}>
                      Oznacz jako rozwiązany
                    </button>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5 rounded-md border border-c-border-subtle p-2">
        <textarea
          className="w-full resize-none rounded-md border border-c-border-subtle bg-c-surface-raised p-2 text-xs text-c-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          rows={2}
          placeholder="Dodaj komentarz…"
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
          data-testid="comment-composer-body"
        />
        <input
          className="w-full rounded-md border border-c-border-subtle bg-c-surface-raised p-1.5 text-xs text-c-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          placeholder="Wzmianki (po przecinku, id użytkowników)"
          value={draftMentions}
          onChange={(e) => setDraftMentions(e.target.value)}
          data-testid="comment-composer-mentions"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs text-c-text-secondary">
            <input
              type="checkbox"
              checked={draftBlocking}
              onChange={(e) => setDraftBlocking(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-c-border-subtle text-c-focus focus:ring-c-focus"
              data-testid="comment-composer-blocking"
            />
            Flaga blokująca
          </label>
          <button
            type="button"
            disabled={submitting || !draftBody.trim()}
            className="rounded-md border border-c-border-subtle bg-c-surface-raised px-2.5 py-1.5 text-xs font-medium text-c-text-primary hover:bg-c-surface disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            onClick={handleAddComment}
            data-testid="comment-composer-submit"
          >
            Dodaj komentarz
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-c-text-secondary">Checklist review</p>
          <span className={`text-[11px] ${requiredChecked ? 'text-c-text-secondary' : 'text-c-danger'}`} data-testid="checklist-required-status">
            {requiredChecked ? 'Wszystkie wymagane odhaczone' : 'Są nieodhaczone wymagane pozycje'}
          </span>
        </div>
        <ul className="flex flex-col gap-1" data-testid="checklist-items">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-xs">
              {/* ★ NAPRAWA a11y (Pakiet I, wymaganie #5): checkbox nie miał
                  ŻADNEJ programowo powiązanej nazwy (axe: "label" critical) —
                  tekst pozycji był tylko wizualnie obok, nie <label>.
                  Owinięcie w <label> daje niejawne (implicit) powiązanie bez
                  zmiany layoutu/wyglądu. */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(item.checkedBy)}
                  onChange={() => handleToggleChecklistItem(item)}
                  className="h-3.5 w-3.5 rounded border-c-border-subtle text-c-focus focus:ring-c-focus"
                />
                <span className="text-c-text-primary">{item.item}</span>
              </label>
              {item.required ? <span className="text-[11px] text-c-text-secondary">(wymagane)</span> : null}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-1.5">
          <input
            className="flex-1 rounded-md border border-c-border-subtle bg-c-surface-raised p-1.5 text-xs text-c-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            placeholder="Nowa pozycja checklisty…"
            value={newChecklistItem}
            onChange={(e) => setNewChecklistItem(e.target.value)}
            data-testid="checklist-new-item-input"
          />
          <button
            type="button"
            className="rounded-md border border-c-border-subtle bg-c-surface-raised px-2.5 py-1.5 text-xs font-medium text-c-text-primary hover:bg-c-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            onClick={handleAddChecklistItem}
            data-testid="checklist-new-item-submit"
          >
            Dodaj
          </button>
        </div>
      </div>
    </div>
  );
}

export default FinanceCommentsPanel;
