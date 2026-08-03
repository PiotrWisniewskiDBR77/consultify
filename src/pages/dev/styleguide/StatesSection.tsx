/**
 * StatesSection — VF0-11 living style guide, "States" tab.
 *
 * Renders every `src/components/shared/states/*` component in every
 * documented variant: EmptyState ×4 (new/filter/forbidden/error),
 * SkeletonState ×4 (table/record/canvas/deck), ErrorState, StreamingState
 * (skeleton→content transition, toggleable). No re-implementation — these
 * are the exact production components (VEGAS V7.1 systemic standard),
 * "NOT YET wired into any screen" per their own header comment; this page
 * is their first live rendering surface.
 */
import { Inbox } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import {
  EmptyState,
  type EmptyStateVariant,
  ErrorState,
  SkeletonState,
  type SkeletonVariant,
  StreamingState,
} from '@/components/shared/states';

const SectionHeading: React.FC<{ children: React.ReactNode; note?: string }> = ({
  children,
  note,
}) => (
  <div className="mb-3 mt-10 first:mt-0">
    <h3 className="text-sm font-semibold text-c-text">{children}</h3>
    {note ? <p className="mt-0.5 max-w-2xl text-xs text-c-text-muted">{note}</p> : null}
  </div>
);

const Frame: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="rounded-token-md border border-c-border-subtle bg-c-surface">
    <div className="border-b border-c-border-subtle px-3 py-1.5 text-[11px] font-medium text-c-text-muted">
      {label}
    </div>
    {children}
  </div>
);

const EMPTY_VARIANTS: EmptyStateVariant[] = ['new', 'filter', 'forbidden', 'error'];
const SKELETON_VARIANTS: SkeletonVariant[] = ['table', 'record', 'canvas', 'deck'];

const StreamingDemo: React.FC = () => {
  const [isStreaming, setIsStreaming] = useState(true);
  const [partial, setPartial] = useState('');

  useEffect(() => {
    if (!isStreaming) return;
    setPartial('');
    const full =
      'Teresa buduje odpowiedź token po tokenie — ten fragment rośnie, żeby pokazać przejście szkielet → treść.';
    let i = 0;
    const id = window.setInterval(() => {
      i += 3;
      setPartial(full.slice(0, i));
      if (i >= full.length) {
        window.clearInterval(id);
        setIsStreaming(false);
      }
    }, 60);
    return () => window.clearInterval(id);
    // Re-run only when explicitly restarted below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  return (
    <div className="rounded-token-md border border-c-border-subtle bg-c-surface p-4">
      <StreamingState
        isStreaming={isStreaming}
        hasContent={partial.length > 0}
        label="Teresa pisze…"
        onStop={() => setIsStreaming(false)}
        skeletonVariant="record"
      >
        <p className="text-sm text-c-text">{partial}</p>
      </StreamingState>
      <button
        type="button"
        className="mt-3 rounded-token-xs border border-c-border px-2 py-1 text-[11px] hover:bg-c-surface-raised"
        onClick={() => setIsStreaming(true)}
      >
        Restart streamu
      </button>
    </div>
  );
};

export const StatesSection: React.FC = () => {
  return (
    <div>
      <SectionHeading note="Cztery przyczyny pustki: nic nie utworzono (new) · filtr wyklucza wszystko (filter) · brak uprawnień (forbidden) · błąd ładowania (error, z Retry).">
        EmptyState ×4
      </SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {EMPTY_VARIANTS.map((variant) => (
          <Frame key={variant} label={`variant="${variant}"`}>
            <EmptyState
              variant={variant}
              icon={variant === 'new' ? Inbox : undefined}
              title={
                variant === 'new'
                  ? 'Brak pozycji'
                  : variant === 'filter'
                    ? 'Brak wyników dla tego filtra'
                    : variant === 'forbidden'
                      ? 'Brak dostępu'
                      : 'Nie udało się załadować'
              }
              description={
                variant === 'new'
                  ? 'Utwórz pierwszą pozycję, by zacząć.'
                  : variant === 'filter'
                    ? 'Zmień lub wyczyść filtry, by zobaczyć więcej.'
                    : variant === 'forbidden'
                      ? 'Poproś administratora o dostęp do tego modułu.'
                      : 'Sprawdź połączenie i spróbuj ponownie.'
              }
              primaryAction={variant === 'new' ? { label: 'Utwórz', onClick: () => {} } : undefined}
              onRetry={variant === 'error' ? () => {} : undefined}
              compact
            />
          </Frame>
        ))}
      </div>

      <SectionHeading note="Cztery archetypy SPEC-A (§3 ARTIFACT_ANATOMY_STANDARD): Matryca/Rekord/Canvas/Deck — kształt szkieletu dopasowany do treści, nie generyczny spinner.">
        SkeletonState ×4
      </SectionHeading>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {SKELETON_VARIANTS.map((variant) => (
          <Frame key={variant} label={`variant="${variant}"`}>
            <div className="p-4">
              <SkeletonState variant={variant} />
            </div>
          </Frame>
        ))}
      </div>

      <SectionHeading note="Awaria całej powierzchni (nie inline jak EmptyState error) — zawsze z wyjściem: Retry i/lub Go back.">
        ErrorState
      </SectionHeading>
      <Frame label="onRetry + onBack">
        <ErrorState
          title="Nie udało się załadować tej inicjatywy"
          description="Rekord mógł zostać przeniesiony lub usunięty."
          onRetry={() => {}}
          onBack={() => {}}
          compact
        />
      </Frame>

      <SectionHeading note="Skeleton (content-shaped, brak treści) → treść renderowana przyrostowo, aż Stop/koniec. Ostatnia częściowa treść NIGDY nie znika po Stop.">
        StreamingState (na żywo — token po tokenie)
      </SectionHeading>
      <StreamingDemo />
    </div>
  );
};

export default StatesSection;
