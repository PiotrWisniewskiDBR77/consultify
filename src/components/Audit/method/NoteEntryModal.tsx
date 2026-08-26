/**
 * NoteEntryModal — kanoniczny modal notatki wymaganej przy przejściu stanu
 * ustalenia (zamknięcie / akceptacja ryzyka rezydualnego).
 *
 * R3(c) (panel powtórny DEC-117): `AuditFindingsTab` zamykał ustalenie i
 * akceptował ryzyko rezydualne przez `window.prompt()` — jednoliniowe pole
 * bez walidacji wizualnej, bez możliwości wielolinijkowego uzasadnienia, i
 * bez śladu w DOM (niedostępne testom bez `vi.spyOn(window, 'prompt')`,
 * niedostępne dla czytnika ekranu). Notatka trafia do NIEZMIENNEGO śladu
 * audytu (`closeFinding`/`acceptResidualRisk` zapisują ją trwale na
 * ustaleniu) — to nie jest miejsce na przeglądarkowy prompt.
 *
 * Wzorzec 1:1 z `NewAuditModal.tsx` (bazowy `Modal` z `ui/primitives`,
 * `footer` z `Button` Anuluj/akcja, `size="md"`) — jedyna różnica to treść:
 * wielolinijkowe `<textarea>` zamiast selecta, z walidacją „niepusta po
 * przycięciu" identyczną do tej, którą `promptForNote()` egzekwował ręcznie.
 */
import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/primitives/Button';
import { Modal } from '@/components/ui/primitives/Modal';

export interface NoteEntryModalProps {
  open: boolean;
  onClose: () => void;
  /** Tytuł modala (np. „Zamknij ustalenie"). */
  title: string;
  /** Opis nad polem (np. instrukcja, jakiej treści notatki wymaga backend). */
  description?: string;
  /** Etykieta pola tekstowego. */
  fieldLabel: string;
  /** Etykieta przycisku potwierdzenia (np. „Zamknij ustalenie"). */
  submitLabel: string;
  /** Wywoływane z przyciętą, niepustą notatką. */
  onSubmit: (note: string) => void;
  /** Trwa zapis — blokuje pole i przyciski, pokazuje spinner na przycisku. */
  submitting?: boolean;
  isPolish: boolean;
}

/**
 * Modal notatki — reużywalny dla dowolnego przejścia stanu wymagającego
 * wielolinijkowego uzasadnienia (zamknięcie ustalenia, akceptacja ryzyka
 * rezydualnego — dziś; przyszłe przejścia mogą dołączyć bez zmiany kontraktu).
 */
export const NoteEntryModal: React.FC<NoteEntryModalProps> = ({
  open,
  onClose,
  title,
  description,
  fieldLabel,
  submitLabel,
  onSubmit,
  submitting = false,
  isPolish,
}) => {
  const [note, setNote] = useState('');

  // Pole zaczyna puste przy każdym otwarciu — poprzednia notatka (innego
  // ustalenia, innego przejścia) nigdy nie przecieka do kolejnego dialogu.
  useEffect(() => {
    if (open) setNote('');
  }, [open]);

  const trimmed = note.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="md"
      preventOverlayClose={submitting}
      preventEscapeClose={submitting}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {isPolish ? 'Anuluj' : 'Cancel'}
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            loading={submitting}
            onClick={() => canSubmit && onSubmit(trimmed)}
            data-testid="note-entry-modal-submit"
          >
            {submitLabel}
          </Button>
        </div>
      }
    >
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-c-text-primary">{fieldLabel}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          disabled={submitting}
          autoFocus
          data-testid="note-entry-modal-textarea"
          className="w-full rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-sm text-c-text-primary focus:outline-none focus:ring-2 focus:ring-c-focus disabled:cursor-not-allowed disabled:opacity-60"
        />
        {trimmed.length === 0 ? (
          <span className="text-[11px] text-c-text-muted">
            {isPolish ? 'Notatka jest wymagana.' : 'A note is required.'}
          </span>
        ) : null}
      </label>
    </Modal>
  );
};

export default NoteEntryModal;
