/**
 * CalendarAttendeesField — inline org-member typeahead + chip picker for the
 * calendar event "Attendees" field.
 *
 * FIX-20 (Day 3 layer-2 acceptance): accepted prototype
 * (kalendarz-prototyp.html — "Uczestnicy (opcjonalnie, tylko z organizacji)")
 * and the owner's own request; the backend (`POST /my-work/calendar/events`)
 * already validates every attendee id against `users WHERE organization_id`,
 * but the create-event modal never offered a way to pick anyone. Uses
 * `Api.searchOrgUsers` — the org-scoped, non-admin-gated `/users/search`
 * endpoint the codebase already documents as the canonical picker source
 * (see `TeamManagementPanel`'s `onSearchUsers` wiring) — instead of the
 * admin-only `GET /users`.
 */
import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Api from '@/services/api';

export interface CalendarAttendeeOption {
  id: string;
  name: string;
  email?: string;
}

interface CalendarAttendeesFieldProps {
  selected: CalendarAttendeeOption[];
  onChange: (next: CalendarAttendeeOption[]) => void;
}

export const CalendarAttendeesField: React.FC<CalendarAttendeesFieldProps> = ({
  selected,
  onChange,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CalendarAttendeeOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await Api.searchOrgUsers(q);
        if (cancelled) return;
        const selectedIds = new Set(selected.map((s) => s.id));
        setResults(found.filter((u) => !selectedIds.has(u.id)));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const selectAttendee = (user: CalendarAttendeeOption) => {
    onChange([...selected, user]);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const deselectAttendee = (id: string) => {
    onChange(selected.filter((s) => s.id !== id));
  };

  return (
    <div className="col-span-2 space-y-2 text-sm">
      <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
        {t('myWork.calendarV2.attendees', 'Attendees')}{' '}
        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
          {t('myWork.calendarV2.attendeesHint', '(optional, organization members only)')}
        </span>
      </label>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((user) => (
            <span
              key={user.id}
              className="inline-flex items-center gap-1 rounded-full border border-c-border bg-c-surface-raised px-2 py-1 text-xs text-c-text"
            >
              {user.name}
              <button
                type="button"
                onClick={() => deselectAttendee(user.id)}
                aria-label={t('myWork.calendarV2.attendeesRemove', {
                  defaultValue: 'Remove attendee {{name}}',
                  name: user.name,
                })}
                className="text-c-text-secondary hover:text-c-text"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Let a click on a result register before the list closes.
            setTimeout(() => setOpen(false), 150);
          }}
          placeholder={t('myWork.calendarV2.attendeesSearchPlaceholder', 'Add person…')}
          aria-label={t('myWork.calendarV2.attendees', 'Attendees')}
          className="w-full rounded-lg border border-c-border bg-c-surface p-2"
        />
        {open && query.trim().length >= 2 ? (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-c-border bg-c-surface-raised shadow-lg">
            {searching ? (
              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                {t('myWork.calendarV2.attendeesSearching', 'Searching…')}
              </div>
            ) : results.length > 0 ? (
              results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectAttendee(user)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-c-surface"
                >
                  <span className="truncate">{user.name}</span>
                  {user.email ? (
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                      {user.email}
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                {t('myWork.calendarV2.attendeesNoResults', 'No results')}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default CalendarAttendeesField;
