import { Check, FolderKanban, Loader2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

interface ProjectMembershipOption {
  id: string;
  name: string;
}

export const isProjectContextSwitcherEnabled = (): boolean =>
  import.meta.env.VITE_PMO_PROJECT_SWITCHER === 'true';

export function ProjectContextSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const setCurrentProjectId = useAppStore((state) => state.setCurrentProjectId);
  const [projects, setProjects] = React.useState<ProjectMembershipOption[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isProjectContextSwitcherEnabled()) return;
    let alive = true;
    setLoading(true);
    setLoadFailed(false);
    Api.getMyProjectMemberships()
      .then((items) => {
        if (!alive) return;
        const normalized = items
          .map((item) => ({
            id: String(item.id || '').trim(),
            name: String(item.name || '').trim(),
          }))
          .filter((item) => item.id && item.name);
        setProjects(normalized);
      })
      .catch(() => {
        if (!alive) return;
        setProjects([]);
        setLoadFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  if (!isProjectContextSwitcherEnabled()) return null;

  const selectedProject = projects.find((project) => project.id === currentProjectId) || null;
  const activeLabel =
    selectedProject?.name || t('layout.projectSwitcher.allProjects', 'All projects');

  const selectProject = (projectId: string | null) => {
    setCurrentProjectId(projectId);
    setOpen(false);
  };

  const openProject = (projectId: string) => {
    selectProject(projectId);
    navigate(`${ROUTES.PROJECTS}/${projectId}`);
  };

  return (
    <div
      ref={menuRef}
      className="relative hidden min-w-0 lg:block"
      data-testid="project-context-switcher"
    >
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        className="inline-flex h-9 max-w-[260px] items-center gap-2 rounded-md border border-c-border-subtle bg-c-surface px-3 text-sm font-medium text-c-text shadow-sm hover:bg-c-surface-hover focus:outline-none focus:ring-2 focus:ring-c-focus"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('layout.projectSwitcher.ariaLabel', 'Select project context')}
        title={activeLabel}
      >
        <FolderKanban size={16} className="shrink-0 text-c-text-secondary" aria-hidden="true" />
        <span className="truncate">{activeLabel}</span>
        {loading ? (
          <Loader2 size={14} className="shrink-0 animate-spin text-c-text-secondary" />
        ) : null}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-popover w-80 rounded-md border border-c-border-subtle bg-c-surface shadow-xl dark:shadow-none">
          <div className="border-b border-c-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-c-text-secondary">
            {t('layout.projectSwitcher.label', 'Project context')}
          </div>
          <div
            role="listbox"
            aria-label={t('layout.projectSwitcher.ariaLabel', 'Select project context')}
            className="max-h-80 overflow-y-auto py-1"
          >
            <button
              type="button"
              role="option"
              aria-selected={!currentProjectId}
              onClick={() => selectProject(null)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-c-text hover:bg-c-surface-hover focus:bg-c-surface-hover focus:outline-none"
            >
              <Check
                size={15}
                className={!currentProjectId ? 'text-c-success' : 'text-transparent'}
                aria-hidden="true"
              />
              <span className="truncate">
                {t('layout.projectSwitcher.allProjects', 'All projects')}
              </span>
            </button>

            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                role="option"
                aria-selected={project.id === currentProjectId}
                onClick={() => openProject(project.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-c-text hover:bg-c-surface-hover focus:bg-c-surface-hover focus:outline-none"
                title={project.name}
              >
                <Check
                  size={15}
                  className={
                    project.id === currentProjectId ? 'text-c-success' : 'text-transparent'
                  }
                  aria-hidden="true"
                />
                <span className="truncate">{project.name}</span>
              </button>
            ))}

            {!loading && projects.length === 0 ? (
              <div className="px-3 py-2 text-sm text-c-text-secondary">
                {loadFailed
                  ? t('layout.projectSwitcher.loadFailed', 'Projects unavailable')
                  : t('layout.projectSwitcher.empty', 'No project memberships')}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
