import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

type ProjectOption = { id: string; name: string; status: string };

export function RequiredProjectPicker({
  value,
  onChange,
  disabled = false,
  language = 'en',
  // 05.09.2026: podział na projekty = fala 2 (decyzja właściciela) — niektórzy
  // konsumenci (np. Interview session creator) mogą już zaakceptować pusty
  // projectId (backend ma fallback), więc pole przestaje być "wymagane"
  // wizualnie: bez gwiazdki w etykiecie i bez atrybutu `required`. Domyślnie
  // (`optional=false`) zachowanie jest identyczne jak wcześniej — konsumenci,
  // których backend faktycznie wymaga projectId (np. Kreator Inicjatyw AI,
  // nowa decyzja bez initiative/task), nic tu nie zmieniają.
  optional = false,
}: {
  value: string;
  onChange: (projectId: string) => void;
  disabled?: boolean;
  language?: 'en' | 'pl';
  optional?: boolean;
}) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  // D-C2/DEC-464: selektor projektu przy WYBORZE (nie przeglądzie) ukrywa
  // projekty status='archived' — poza tym, który jest aktualnie wybrany
  // (`value`), żeby formularz edycji istniejącego rekordu nie tracił nazwy
  // swojego (już zarchiwizowanego) projektu. Ten wybrany archiwalny wpis
  // dostaje dopisek "(archived)"/"(zarchiwizowany)" (i18n:
  // shared.project.archivedSuffix — dzielony z innymi selektorami projektu,
  // np. StudioLinkModal).
  const archivedSuffix = t('shared.project.archivedSuffix', {
    lng: language,
    defaultValue: language === 'pl' ? '(zarchiwizowany)' : '(archived)',
  });
  const visibleProjects = useMemo(
    () => projects.filter((project) => project.status !== 'archived' || project.id === value),
    [projects, value]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Api.getProjects()
      .then((response) => {
        if (cancelled) return;
        setProjects(
          (Array.isArray(response) ? response : [])
            .map((project: any) => ({
              id: String(project?.id || '').trim(),
              name: String(project?.name || project?.title || '').trim(),
              status: String(project?.status || '').trim().toLowerCase(),
            }))
            .filter((project) => project.id && project.name)
        );
      })
      .catch(
        () =>
          !cancelled &&
          setError(
            language === 'pl' ? 'Nie udało się pobrać projektów.' : 'Projects could not be loaded.'
          )
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [language]);

  const createProject = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const response = await Api.createProject({ name });
      const raw = response?.project || response?.data || response;
      const created = {
        id: String(raw?.id || '').trim(),
        name: String(raw?.name || name).trim(),
        status: String(raw?.status || 'active').trim().toLowerCase(),
      };
      if (!created.id) throw new Error('Project create response did not include an id');
      setProjects((current) => [
        ...current.filter((project) => project.id !== created.id),
        created,
      ]);
      setNewName('');
      onChange(created.id);
    } catch (cause) {
      const rawMessage = cause instanceof Error ? cause.message : '';
      const message = rawMessage && rawMessage !== '[object Object]' ? rawMessage : '';
      setError(
        message ||
          (language === 'pl' ? 'Nie udało się utworzyć projektu.' : 'Project could not be created.')
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor="required-project-picker"
        className="block text-sm font-medium text-c-text-muted"
      >
        {optional
          ? language === 'pl'
            ? 'Projekt'
            : 'Project'
          : language === 'pl'
            ? 'Projekt *'
            : 'Project *'}
      </label>
      <select
        id="required-project-picker"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || loading}
        required={!optional}
        className="w-full rounded-xl border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text disabled:opacity-60"
      >
        <option value="">
          {loading
            ? language === 'pl'
              ? 'Ładowanie projektów…'
              : 'Loading projects…'
            : language === 'pl'
              ? 'Wybierz projekt…'
              : 'Select a project…'}
        </option>
        {visibleProjects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.status === 'archived' ? `${project.name} ${archivedSuffix}` : project.name}
          </option>
        ))}
      </select>
      {!loading && visibleProjects.length === 0 && (
        <div className="flex gap-2">
          <input
            aria-label={language === 'pl' ? 'Nazwa nowego projektu' : 'New project name'}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={language === 'pl' ? 'Nazwa projektu' : 'Project name'}
            className="min-w-0 flex-1 rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text"
          />
          <button
            type="button"
            onClick={() => void createProject()}
            disabled={creating || !newName.trim()}
            className="rounded-lg bg-navy-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-slate-50 dark:text-navy-950"
          >
            {creating
              ? language === 'pl'
                ? 'Tworzenie…'
                : 'Creating…'
              : language === 'pl'
                ? 'Utwórz projekt'
                : 'Create project'}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
