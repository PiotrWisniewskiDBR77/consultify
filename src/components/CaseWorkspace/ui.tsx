/**
 * Zlecenia (Case Workspace) — drobne części wspólne modułu.
 *
 * NIE jest to nowy design system. Wszystko, co ma kanon (pasek modułu,
 * tabela, podgląd), idzie przez `src/components/standard/*`. Tutaj mieszkają
 * wyłącznie rzeczy, których kanon nie ma: jednolita obsługa stanów
 * (ładowanie / pusty / błąd / zablokowany / częściowy), dostępny klawiaturą
 * przełącznik ukrytych zakładek „Więcej" oraz formatowanie dat po polsku.
 *
 * KOLORY: crimson (`primary-*`, `danger-*`) WYŁĄCZNIE dla semantyki
 * krytycznej (błąd, brak dostępu). Stan aktywny i CTA są neutralne, fokus
 * jest niebieski (`c-focus`) — CLAUDE.md pułapka #1.
 */

import { AlertTriangle, ChevronDown, Lock, SearchX } from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states';

import type { CaseApiFailure } from './types';

// ── Fokus ────────────────────────────────────────────────────────────────────
// Jeden łańcuch klas fokusu dla całego modułu. Niebieski `c-focus`, NIGDY
// crimson — crimson w tym repo to `primary` i znaczy „krytyczne".
export const FOCUS_RING =
  'focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 focus-visible:ring-offset-c-bg';

// ── Szerokość okna ───────────────────────────────────────────────────────────

/**
 * Realna szerokość okna (px). Sterownik układu mobilnego — używany do
 * decyzji „ile zakładek zmieści się w Menu 2, a ile idzie do »Więcej«".
 * `matchMedia` byłoby czystsze, ale potrzebujemy liczby, nie boola, bo progi
 * (320/375/430/768) są różne dla różnych elementów.
 */
export function useViewportWidth(): number {
  const [width, setWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

/**
 * Wysokość, jaka REALNIE została do dołu okna dla danego elementu.
 *
 * ★ Z POMIARU, nie z oka. Płótno planu miało `h-[min(62vh,560px)]`. Przy oknie
 * 900 px dawało to 556 px, ale nad płótnem stoi pasek modułu, nagłówek
 * zlecenia i karta „Do czego dążymy" (~376 px), więc dół płótna wypadał na
 * 932 px — a obszar treści NIE przewija się w pionie. Efekt: przyciski
 * powiększania i „Dopasuj do ekranu" (dolny prawy róg płótna) były trwale
 * poza ekranem, nieklikalne. Zmierzone: canvasBottom=932 przy innerHeight=900,
 * docScrollHeight=900.
 *
 * Stała liczba tego nie naprawia — nad płótnem bywa dłuższy tytuł, pasek
 * „widok niepełny" albo lista blokad, więc odstęp jest zmienny. Dlatego
 * liczymy go z pozycji elementu i przeliczamy przy zmianie rozmiaru okna
 * ORAZ przy zmianie treści nad elementem (ResizeObserver na `document.body`).
 */
export function useRemainingHeight(
  ref: React.RefObject<HTMLElement | null>,
  { min = 320, bottomGap = 16 }: { min?: number; bottomGap?: number } = {}
): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const measure = () => {
      const node = ref.current;
      if (!node) return;
      const top = node.getBoundingClientRect().top;
      setHeight(Math.max(min, Math.round(window.innerHeight - top - bottomGap)));
    };
    measure();
    window.addEventListener('resize', measure);
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
    // Treść NAD płótnem zmienia jego `top` bez zmiany rozmiaru okna.
    observer?.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [ref, min, bottomGap]);

  return height;
}

// ── Daty ─────────────────────────────────────────────────────────────────────

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** „3 dni temu" / „za 2 dni" — bez bibliotek, po polsku. */
export function relativeDays(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = date.getTime() - Date.now();
  const days = Math.round(diffMs / 86_400_000);
  if (days === 0) return 'dzisiaj';
  if (days === 1) return 'jutro';
  if (days === -1) return 'wczoraj';
  if (days > 0) return `za ${days} dni`;
  return `${Math.abs(days)} dni temu`;
}

// ── Stany ────────────────────────────────────────────────────────────────────

export interface CaseStateBlockProps {
  loading?: boolean;
  failure?: CaseApiFailure | null;
  onRetry?: () => void;
  onBack?: () => void;
  /** Co pokazać, gdy nic nie padło i nic się nie ładuje, ale dane są puste. */
  empty?: { title: string; description?: string } | null;
  compact?: boolean;
}

/**
 * JEDEN punkt renderowania stanów niepełnych. Zwraca `null`, gdy jest co
 * pokazać — wtedy ekran renderuje treść. Nigdy nie zwraca cichej pustki:
 * każdy z pięciu stanów ma własny, nazwany komunikat po polsku.
 */
export const CaseStateBlock: React.FC<CaseStateBlockProps> = ({
  loading,
  failure,
  onRetry,
  onBack,
  empty,
  compact,
}) => {
  if (loading) {
    return <LoadingState template="list" label="Wczytywanie danych zlecenia…" />;
  }
  if (failure?.kind === 'blocked') {
    return (
      <ErrorState
        title="Nie masz dostępu do tego zlecenia"
        description="Poproś właściciela zlecenia albo administratora organizacji o dodanie Cię do zespołu. Dane pozostają ukryte do czasu nadania uprawnień."
        onBack={onBack}
        backLabel="Wróć do listy zleceń"
        compact={compact}
      />
    );
  }
  if (failure?.kind === 'notFound') {
    return (
      <ErrorState
        title="Nie znaleźliśmy tego zlecenia"
        description="Zlecenie nie istnieje albo nie należy do Twojej organizacji. Sprawdź adres lub wróć do listy."
        onBack={onBack}
        backLabel="Wróć do listy zleceń"
        compact={compact}
      />
    );
  }
  if (failure) {
    return (
      <ErrorState
        title="Nie udało się wczytać danych"
        description="Połączenie z serwerem nie doszło do skutku. Spróbuj ponownie — nic nie zostało zmienione."
        onRetry={onRetry}
        retryLabel="Spróbuj ponownie"
        onBack={onBack}
        backLabel="Wróć do listy zleceń"
        compact={compact}
      />
    );
  }
  if (empty) {
    return (
      <EmptyState
        variant="new"
        icon={SearchX}
        title={empty.title}
        description={empty.description}
      />
    );
  }
  return null;
};

/**
 * Pasek „wynik częściowy". Osobny stan wymagany przez właściciela: część
 * sekcji wczytała się poprawnie, część nie — ekran mówi to wprost, zamiast
 * pokazywać niepełne dane jako komplet.
 */
export const PartialBanner: React.FC<{ sections: string[]; onRetry?: () => void }> = ({
  sections,
  onRetry,
}) => {
  if (!sections.length) return null;
  return (
    <div
      role="status"
      className="mb-3 flex flex-wrap items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        Widok niepełny — nie wczytały się: {sections.join(', ')}. Pozostałe dane są aktualne.
      </span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={`shrink-0 rounded-lg border border-amber-300 px-2 py-1 text-xs font-medium dark:border-amber-500/30 ${FOCUS_RING}`}
        >
          Wczytaj ponownie
        </button>
      ) : null}
    </div>
  );
};

// ── Wynik KOMENDY ────────────────────────────────────────────────────────────

/**
 * Pasek wyniku komendy (zapisu). Osobny od `CaseStateBlock`, bo mówi o czymś
 * innym: tam „nie udało się WCZYTAĆ", tutaj „co się stało z Twoją decyzją".
 *
 * Trzy rzeczy, które ten pasek musi umieć powiedzieć i mówi wprost:
 *  · KONFLIKT (409) — nic nie zmieniono, stan na serwerze jest inny niż na
 *    ekranie; obok komunikatu stoi „Odśwież dane", bo powtórzenie tej samej
 *    komendy w ciemno jest bez sensu;
 *  · BRAK DOSTĘPU (403) / NIE ZNALEZIONO (404) — bez sugerowania, że obiekt
 *    istnieje (SEC-009);
 *  · SUKCES NIEPOTWIERDZONY — komenda przeszła, ale kontrolny odczyt nie, więc
 *    NIE twierdzimy, że wiemy, jak wygląda stan.
 */
export interface CommandNotice {
  tone: 'success' | 'warning' | 'critical';
  text: string;
  /** Pokaż przycisk odświeżenia (konflikt, stan nieznany). */
  refresh?: boolean;
}

export const CommandBanner: React.FC<{
  notice: CommandNotice | null;
  onRefresh?: () => void;
  onDismiss?: () => void;
}> = ({ notice, onRefresh, onDismiss }) => {
  if (!notice) return null;
  const toneClass =
    notice.tone === 'critical'
      ? 'border-danger-300 bg-danger-50 text-danger-800 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200'
      : notice.tone === 'warning'
        ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
        : 'border-success-300 bg-success-50 text-success-800 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-200';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-3 flex flex-wrap items-start gap-2 rounded-xl border px-3 py-2 text-sm ${toneClass}`}
    >
      <span className="min-w-0 flex-1">{notice.text}</span>
      {notice.refresh && onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          className={`shrink-0 rounded-lg border border-current px-2 py-1 text-xs font-medium ${FOCUS_RING}`}
        >
          Odśwież dane
        </button>
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Zamknij komunikat"
          className={`shrink-0 rounded-lg border border-current px-2 py-1 text-xs font-medium ${FOCUS_RING}`}
        >
          Zamknij
        </button>
      ) : null}
    </div>
  );
};

/**
 * Potwierdzenie komendy z opcjonalnym POWODEM.
 *
 * Nie jest to ozdoba: trasy `cancel`, `pause`, `withdraw`, `revoke` wymagają
 * niepustego `reason` po stronie serwera (zod `min(1)`) — bez pola na powód
 * komenda wróciłaby z 400 i użytkownik nie miałby pojęcia dlaczego. Dlatego
 * przycisk potwierdzenia jest ZABLOKOWANY, dopóki wymagany powód jest pusty.
 *
 * Klawiatura: fokus wchodzi na pole/przycisk po otwarciu, Escape zamyka.
 */
export interface CommandDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** Gdy podany — pokazujemy pole powodu; `required` blokuje potwierdzenie. */
  reason?: { label: string; required: boolean; placeholder?: string };
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export const CommandDialog: React.FC<CommandDialogProps> = ({
  open,
  title,
  description,
  confirmLabel,
  reason,
  busy,
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) {
      setValue('');
      return;
    }
    // Fokus na to, co użytkownik ma wypełnić albo kliknąć — nie na tło.
    const node = reason ? inputRef.current : confirmRef.current;
    node?.focus();
  }, [open, reason]);

  if (!open) return null;

  const blocked = Boolean(reason?.required) && value.trim().length === 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-3 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onCancel();
          }
        }}
        className="w-full max-w-md rounded-2xl border border-c-border bg-c-surface p-4 shadow-xl"
      >
        <h2 id={titleId} className="text-base font-semibold text-c-text">
          {title}
        </h2>
        <p id={descId} className="mt-1 text-sm text-c-text-secondary">
          {description}
        </p>
        {reason ? (
          <label className="mt-3 block">
            <span className="block text-xs font-medium uppercase tracking-wide text-c-text-muted">
              {reason.label}
              {reason.required ? ' (wymagany)' : ' (opcjonalny)'}
            </span>
            <textarea
              ref={inputRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              rows={3}
              placeholder={reason.placeholder}
              className={`mt-1 w-full resize-y rounded-lg border border-c-border bg-c-bg px-2.5 py-2 text-sm text-c-text ${FOCUS_RING}`}
            />
          </label>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`rounded-lg border border-c-border px-3 py-1.5 text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised ${FOCUS_RING}`}
          >
            Nie teraz
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={blocked || busy}
            onClick={() => onConfirm(value.trim())}
            className={`rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-sm font-semibold text-c-text hover:bg-c-bg disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
          >
            {busy ? 'Wysyłam…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Okno z FORMULARZEM (kilka pól), nie tylko jednym powodem.
 *
 * `CommandDialog` wyżej zakłada JEDNO pole (powód) — świetne dla
 * cancel/pause/withdraw/revoke, za wąskie dla komendy, która potrzebuje kilku
 * pól naraz (np. „powiąż istniejący obiekt": typ + identyfikator + rola).
 * `FormDialog` niesie TĘ SAMĄ powłokę modalną (tło, `role="dialog"`, Escape,
 * klik w tło zamyka, fokus wchodzi na pierwsze pole po otwarciu) i zostawia
 * TREŚĆ formularza wywołującemu przez `children` — moduł deklaruje pola,
 * ta powłoka narzuca zachowanie okna. Nie jest to „drugi system relacji":
 * to ten sam wzorzec okna komend co `CommandDialog`, tylko bez założenia
 * „jedno pole = powód".
 *
 * Walidację (czy przycisk potwierdzenia jest aktywny) liczy WYWOŁUJĄCY przez
 * `confirmDisabled` — ta powłoka nie zna kształtu pól, więc nie umie sama
 * ocenić poprawności.
 */
export interface FormDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}

export const FormDialog: React.FC<FormDialogProps> = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Nie teraz',
  busy,
  confirmDisabled,
  onConfirm,
  onCancel,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descId = useId();
  // Element, który miał fokus PRZED otwarciem okna (zwykle przycisk, który je
  // otworzył) — klawiaturowy warunek „focus return": po zamknięciu (Escape,
  // „Nie teraz", klik w tło, udana komenda) fokus wraca DOKŁADNIE tam, skąd
  // przyszedł, a nie spada na `<body>`.
  const powrotFokusuRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      powrotFokusuRef.current?.focus();
      powrotFokusuRef.current = null;
      return;
    }
    powrotFokusuRef.current = (document.activeElement as HTMLElement) ?? null;
    // Fokus na PIERWSZE pole formularza — nie na tło, nie na przycisk
    // potwierdzenia (użytkownik ma najpierw coś wypełnić).
    const node = containerRef.current;
    const focusable = node?.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
    );
    focusable?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-3 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onCancel();
          }
        }}
        className="w-full max-w-md rounded-2xl border border-c-border bg-c-surface p-4 shadow-xl"
      >
        <h2 id={titleId} className="text-base font-semibold text-c-text">
          {title}
        </h2>
        {description ? (
          <p id={descId} className="mt-1 text-sm text-c-text-secondary">
            {description}
          </p>
        ) : null}
        <div className="mt-3 space-y-3">{children}</div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`rounded-lg border border-c-border px-3 py-1.5 text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised ${FOCUS_RING}`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={confirmDisabled || busy}
            onClick={onConfirm}
            className={`rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-sm font-semibold text-c-text hover:bg-c-bg disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
          >
            {busy ? 'Wysyłam…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Etykietowane pole tekstowe formularza w `FormDialog` — jeden wygląd dla wszystkich pól tego modułu. */
export const FormField: React.FC<{
  label: string;
  required?: boolean;
  helpText?: string;
  children: React.ReactNode;
}> = ({ label, required, helpText, children }) => (
  <label className="block">
    <span className="block text-xs font-medium uppercase tracking-wide text-c-text-muted">
      {label}
      {required ? ' (wymagane)' : ' (opcjonalne)'}
    </span>
    <div className="mt-1">{children}</div>
    {helpText ? <span className="mt-1 block text-xs text-c-text-muted">{helpText}</span> : null}
  </label>
);

/** Klasy wspólne dla `<input>`/`<select>`/`<textarea>` wewnątrz `FormDialog`. */
export const FORM_INPUT_CLASS = `w-full rounded-lg border border-c-border bg-c-bg px-2.5 py-2 text-sm text-c-text ${FOCUS_RING}`;

/** Wąski pasek „brak uprawnień" wewnątrz sekcji (nie cały ekran). */
export const BlockedNote: React.FC<{ text: string }> = ({ text }) => (
  <div
    role="status"
    className="mb-3 flex items-start gap-2 rounded-xl border border-c-border bg-c-surface-raised px-3 py-2 text-sm text-c-text-secondary"
  >
    <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
    <span className="min-w-0">{text}</span>
  </div>
);

// ── „Więcej" — ukryte zakładki, dostępne klawiaturą i czytnikiem ─────────────

export interface MoreTabsItem {
  id: string;
  label: string;
  /** Zdanie po polsku czytane przez czytnik ekranu obok samej etykiety. */
  description?: string;
}

export interface MoreTabsMenuProps {
  items: MoreTabsItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Widoczna etykieta przycisku. NIGDY sam chevron bez tekstu. */
  label?: string;
  ariaLabel?: string;
}

/**
 * Przycisk „Więcej" z listą ukrytych zakładek.
 *
 * WARUNEK WŁAŚCICIELA (mobile): ukryte zakładki muszą być dostępne przez
 * JEDNOZNACZNE „Więcej", obsługiwane KLAWIATURĄ i czytnikiem — nie przez sam
 * nieopisany chevron i nie przez poziome przeciąganie paska.
 *
 * Klawiatura: Tab wchodzi na przycisk; Enter/Spacja/Strzałka w dół otwierają
 * i ustawiają fokus na pierwszej pozycji; Strzałki góra/dół chodzą po liście
 * (zawijając); Home/End skaczą na skraje; Enter/Spacja wybierają; Escape
 * zamyka i ODDAJE fokus przyciskowi; klik poza menu zamyka.
 * Czytnik: `aria-haspopup="menu"`, `aria-expanded`, `role="menu"` +
 * `role="menuitemradio"` z `aria-checked`, `aria-describedby` na opis.
 */
export const MoreTabsMenu: React.FC<MoreTabsMenuProps> = ({
  items,
  activeId,
  onSelect,
  label = 'Więcej',
  ariaLabel = 'Więcej sekcji zlecenia',
}) => {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDocPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  const openAt = (index: number) => {
    setFocusIndex(Math.max(0, Math.min(index, items.length - 1)));
    setOpen(true);
  };

  const onButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const activeIdx = items.findIndex((item) => item.id === activeId);
      openAt(activeIdx >= 0 ? activeIdx : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openAt(items.length - 1);
    }
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusIndex((idx) => (idx + 1) % items.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusIndex((idx) => (idx - 1 + items.length) % items.length);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setFocusIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setFocusIndex(items.length - 1);
      return;
    }
    if (event.key === 'Tab') {
      // Tab poza menu zamyka je, ale NIE kradnie fokusu — użytkownik idzie dalej.
      setOpen(false);
    }
  };

  if (!items.length) return null;

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() =>
          open
            ? close(false)
            : openAt(
                Math.max(
                  0,
                  items.findIndex((i) => i.id === activeId)
                )
              )
        }
        onKeyDown={onButtonKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={ariaLabel}
        data-testid="zlecenia-wiecej"
        className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-c-border px-3 text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised ${FOCUS_RING}`}
      >
        <span>{label}</span>
        <ChevronDown
          size={14}
          aria-hidden
          className={open ? 'rotate-180 transition motion-reduce:transition-none' : 'transition motion-reduce:transition-none'}
        />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={ariaLabel}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-50 mt-1 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-c-border bg-c-surface shadow-lg"
        >
          {items.map((item, index) => {
            const checked = item.id === activeId;
            const descId = `${menuId}-desc-${item.id}`;
            return (
              <button
                key={item.id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                aria-describedby={item.description ? descId : undefined}
                tabIndex={index === focusIndex ? 0 : -1}
                onClick={() => {
                  onSelect(item.id);
                  close(true);
                }}
                className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-c-surface-raised ${FOCUS_RING} ${
                  checked
                    ? 'bg-c-surface-raised font-semibold text-c-text'
                    : 'text-c-text-secondary'
                }`}
              >
                <span className="block">{item.label}</span>
                {item.description ? (
                  <span id={descId} className="mt-0.5 block text-xs text-c-text-muted">
                    {item.description}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

// ── Etykieta techniczna (tylko widok ekspercki) ─────────────────────────────

/**
 * Surowy identyfikator techniczny OBOK polskiego wyjaśnienia.
 *
 * WARUNEK WŁAŚCICIELA #5: `HUMAN_TASK`, `CAPABILITY`, `decision_basis`,
 * `Case ID` itp. nie mogą być podstawową treścią. Wolno je pokazać wyłącznie
 * w widoku eksperckim, zawsze jako dopisek do polskiej nazwy — ten komponent
 * jest jedynym miejscem, w którym moduł to robi.
 */
export const TechnicalId: React.FC<{ value: string | null | undefined; title?: string }> = ({
  value,
  title,
}) => {
  if (!value) return null;
  return (
    <code
      title={title ?? 'Identyfikator techniczny (widok ekspercki)'}
      className="ml-2 rounded bg-c-surface-raised px-1.5 py-0.5 font-mono text-[11px] text-c-text-muted"
    >
      {value}
    </code>
  );
};

/** Prosty wiersz „etykieta → wartość" w karcie. */
export const FactRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1">
    <span className="text-xs uppercase tracking-wide text-c-text-muted">{label}</span>
    <span className="min-w-0 text-sm text-c-text">{children}</span>
  </div>
);

/** Neutralny znacznik stanu. Crimson tylko dla `tone="critical"`. */
export const StatusTag: React.FC<{
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'critical';
  children: React.ReactNode;
}> = ({ tone = 'neutral', children }) => {
  const toneClass =
    tone === 'critical'
      ? 'border-danger-300 bg-danger-50 text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-300'
      : tone === 'warning'
        ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
        : tone === 'success'
          ? 'border-success-300 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300'
          : tone === 'info'
            ? 'border-c-border bg-c-surface-raised text-c-text-secondary'
            : 'border-c-border bg-c-surface-raised text-c-text-secondary';
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
};

/** Skrót „ile z ilu", np. postęp osi zamknięcia. */
export function useStableCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useMemo(() => ((...args: never[]) => ref.current(...args)) as T, []);
}
