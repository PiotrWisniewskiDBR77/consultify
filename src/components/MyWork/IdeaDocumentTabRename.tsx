import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface IdeaDocumentTabRenameProps {
  ideaId: string;
  name: string;
  onPersist: (ideaId: string, nextName: string) => Promise<void>;
  renderActivator: (controls: {
    ref: React.RefObject<HTMLButtonElement | null>;
    onDoubleClick: (event: React.MouseEvent) => void;
    onKeyDown: (event: React.KeyboardEvent) => void;
  }) => React.ReactNode;
}

export const IdeaDocumentTabRename: React.FC<IdeaDocumentTabRenameProps> = ({
  ideaId,
  name,
  onPersist,
  renderActivator,
}) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [failureKind, setFailureKind] = useState<'conflict' | 'error'>('error');
  const inputRef = useRef<HTMLInputElement>(null);
  const activatorRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [editing, name]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      activatorRef.current?.focus();
    }
  }, [editing]);

  const beginRename = () => {
    setDraft(name);
    setState('idle');
    setEditing(true);
  };

  const cancel = () => {
    setDraft(name);
    setState('idle');
    restoreFocusRef.current = true;
    setEditing(false);
  };

  const commit = async () => {
    if (submittingRef.current) return;
    const nextName = draft.trim();
    if (!nextName || nextName === name) {
      setDraft(name);
      setEditing(false);
      setState('idle');
      return;
    }

    submittingRef.current = true;
    setState('saving');
    try {
      await onPersist(ideaId, nextName);
      setState('saved');
      restoreFocusRef.current = true;
      setEditing(false);
    } catch (error) {
      const failure = error as { status?: number; code?: string };
      setFailureKind(
        failure.status === 409 || failure.code === 'IDEA_CONFLICT' ? 'conflict' : 'error'
      );
      setState('error');
      setEditing(true);
    } finally {
      submittingRef.current = false;
    }
  };

  if (editing) {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              event.preventDefault();
              void commit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
          }}
          aria-label={t('myWork.ideaTabs.renameLabel', 'Rename idea tab')}
          aria-invalid={state === 'error'}
          className="min-w-24 max-w-[150px] rounded border border-c-border bg-c-surface px-1 py-0.5 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        />
        {state === 'saving' && (
          <span role="status" className="text-[10px] text-c-text-muted">
            {t('common.saving', 'Saving…')}
          </span>
        )}
        {state === 'error' && (
          <span className="flex items-center gap-1">
            <span role="alert" className="sr-only">
              {failureKind === 'conflict'
                ? t('myWork.ideaTabs.renameConflict', 'Name changed elsewhere. Draft retained.')
                : t('myWork.ideaTabs.renameFailed', 'Rename failed. Draft retained.')}
            </span>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void commit()}
              className="rounded px-1 text-[10px] font-semibold text-c-danger hover:bg-c-danger/10"
            >
              {t('common.retry', 'Retry')}
            </button>
          </span>
        )}
      </span>
    );
  }

  return (
    <>
      {renderActivator({
        ref: activatorRef,
        onDoubleClick: (event) => {
          event.stopPropagation();
          beginRename();
        },
        onKeyDown: (event) => {
          if (event.key !== 'F2') return;
          event.preventDefault();
          event.stopPropagation();
          beginRename();
        },
      })}
      {state === 'saved' && <span className="sr-only">{t('common.saved', 'Saved')}</span>}
    </>
  );
};
