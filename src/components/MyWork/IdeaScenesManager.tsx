/**
 * IdeaScenesManager — zapisane widoki (sceny) + tryb prezentacji.
 *
 * DWA ADRESY (2026-07-28, flaga `ff_ideaPanel6Sections`):
 *   • OFF — pływający panel `absolute top-2 right-4` nad płótnem (jak dziś).
 *   • ON  — `embedded`: karta w sekcji „Narzędzie" prawego panelu, portalowana
 *     tam z `IdeaWhiteboardTool` do `IDEA_PANEL_TOOL_SLOT_ID`.
 * Zgłoszenie właściciela: „Ten system jest ekstra, tylko on też powinien być
 * wywoływany z panelu prawego i możliwy do schowania tam. Teraz jest cały czas
 * widoczny".
 *
 * Zero okrojenia funkcji: dodawanie, przełączanie (klik w scenę), zmiana
 * kolejności, zmiana nazwy, usuwanie i tryb prezentacji (pełny ekran, strzałki,
 * Esc) działają identycznie w obu adresach. Overlay prezentacji zostaje `fixed`
 * — to tryb pełnoekranowy, nie panel informacyjny.
 */
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Edit3,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface Scene {
  id: string;
  name: string;
  viewport: { x: number; y: number; zoom: number };
  createdAt: number;
}

export interface IdeaScenesManagerProps {
  scenes: Scene[];
  onScenesChange: (scenes: Scene[]) => void;
  currentViewport: { x: number; y: number; zoom: number };
  onNavigateToScene: (viewport: { x: number; y: number; zoom: number }) => void;
  /** `true` = karta w prawym panelu (sekcja „Narzędzie") zamiast overlaya. */
  embedded?: boolean;
}

export const IdeaScenesManager: React.FC<IdeaScenesManagerProps> = ({
  scenes,
  onScenesChange,
  currentViewport,
  onNavigateToScene,
  embedded,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [presentationMode, setPresentationMode] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleAddScene = useCallback(() => {
    const newScene: Scene = {
      id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${t('myWorkIdeas.scenesManager.view')} ${scenes.length + 1}`,
      viewport: { ...currentViewport },
      createdAt: Date.now(),
    };
    onScenesChange([...scenes, newScene]);
  }, [currentViewport, isPl, onScenesChange, scenes]);

  const handleDeleteScene = useCallback(
    (id: string) => {
      onScenesChange(scenes.filter((s) => s.id !== id));
    },
    [onScenesChange, scenes]
  );

  const handleRenameScene = useCallback(
    (id: string) => {
      if (!editName.trim()) return;
      onScenesChange(scenes.map((s) => (s.id === id ? { ...s, name: editName.trim() } : s)));
      setEditingId(null);
    },
    [editName, onScenesChange, scenes]
  );

  const handleMoveScene = useCallback(
    (id: string, direction: 'up' | 'down') => {
      const idx = scenes.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= scenes.length) return;
      const next = [...scenes];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      onScenesChange(next);
    },
    [onScenesChange, scenes]
  );

  // Presentation mode keyboard navigation
  useEffect(() => {
    if (!presentationMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPresentationMode(false);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setCurrentSlide((prev) => {
          const next = Math.min(prev + 1, scenes.length - 1);
          if (scenes[next]) onNavigateToScene(scenes[next].viewport);
          return next;
        });
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlide((prev) => {
          const next = Math.max(prev - 1, 0);
          if (scenes[next]) onNavigateToScene(scenes[next].viewport);
          return next;
        });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onNavigateToScene, presentationMode, scenes]);

  const startPresentation = useCallback(() => {
    if (scenes.length === 0) return;
    setPresentationMode(true);
    setCurrentSlide(0);
    onNavigateToScene(scenes[0].viewport);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, [onNavigateToScene, scenes]);

  /** Opakowanie: overlay nad płótnem (OFF) albo karta w prawym panelu (ON). */
  const wrapperCls = embedded ? 'w-full' : 'absolute top-2 right-4 z-[55] w-[220px]';
  const cardCls = embedded
    ? 'w-full rounded-[11px] border border-c-border-subtle bg-c-surface-raised overflow-hidden'
    : 'bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm rounded-xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg overflow-hidden';
  /** W panelu lista chowa się pod nagłówkiem; overlay zachowuje się jak dziś. */
  const listaWidoczna = embedded ? expanded : true;

  if (scenes.length === 0 && !expanded) {
    return (
      <div className={embedded ? 'w-full' : 'absolute top-2 right-4 z-[55]'}>
        <button
          onClick={() => {
            setExpanded(true);
            handleAddScene();
          }}
          className={
            embedded
              ? 'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[11px] border border-c-border-subtle bg-c-surface-raised text-[11px] font-semibold text-c-text-secondary hover:border-c-focus hover:text-c-text transition-colors'
              : 'flex items-center gap-1.5 px-3 py-1.5 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm rounded-xl border border-slate-200/60 dark:border-navy-700/60 shadow-sm text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:text-c-info transition-colors'
          }
          data-testid="idea-scenes-save-view"
        >
          <Bookmark size={12} />
          {t('myWorkIdeas.scenesManager.saveView')}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Scenes panel */}
      <div className={wrapperCls} data-testid="idea-scenes-manager">
        <div className={cardCls}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200/40 dark:border-navy-700/40">
            <div className="flex items-center gap-1.5">
              <Bookmark size={12} className="text-c-info" />
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                {t('myWorkIdeas.scenesManager.scenes')}
              </span>
              <span className="text-[9px] text-slate-600 font-semibold">{scenes.length}</span>
            </div>
            <div className="flex items-center gap-0.5">
              {scenes.length >= 2 && (
                <button
                  onClick={startPresentation}
                  className="p-1 rounded-lg text-c-info hover:bg-c-info/10 transition-colors"
                  title={t('myWorkIdeas.scenesManager.present')}
                >
                  <Play size={12} />
                </button>
              )}
              <button
                onClick={handleAddScene}
                aria-label={t('myWorkIdeas.scenesManager.addScene')}
                title={t('myWorkIdeas.scenesManager.addScene')}
                className="p-1 rounded-lg text-slate-600 hover:text-c-info hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              >
                <Plus size={12} />
              </button>
              {/* Chowanie sekcji. W panelu = zwijanie listy pod nagłówkiem
                  (właściciel: „musi być możliwość schowania"); nad płótnem =
                  zamknięcie panelu, jak dziś. */}
              <button
                onClick={() => setExpanded(embedded ? !expanded : false)}
                aria-expanded={embedded ? expanded : undefined}
                aria-label={t('myWorkIdeas.scenesManager.closeScenesPanel')}
                title={t('myWorkIdeas.scenesManager.close')}
                className="p-1 rounded-lg text-slate-600 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                data-testid="idea-scenes-toggle"
              >
                {embedded ? (
                  expanded ? (
                    <ChevronUp size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )
                ) : (
                  <X size={12} />
                )}
              </button>
            </div>
          </div>

          {listaWidoczna && (
            <div className="max-h-[200px] overflow-y-auto p-1 space-y-0.5">
              {scenes.map((scene, i) => (
                <div
                  key={scene.id}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors group cursor-pointer"
                  onClick={() => onNavigateToScene(scene.viewport)}
                >
                  <span className="text-[9px] font-bold text-slate-600 w-3">{i + 1}</span>
                  {editingId === scene.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleRenameScene(scene.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameScene(scene.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 text-[10px] bg-transparent border-b border-c-info outline-none focus-visible:ring-2 focus-visible:ring-c-focus text-slate-700 dark:text-slate-300"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">
                      {scene.name}
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveScene(scene.id, 'up');
                      }}
                      aria-label={t('myWorkIdeas.scenesManager.moveUp')}
                      title={t('myWorkIdeas.scenesManager.moveUp')}
                      className="p-0.5 text-slate-600 hover:text-slate-600"
                    >
                      <ChevronUp size={10} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveScene(scene.id, 'down');
                      }}
                      aria-label={t('myWorkIdeas.scenesManager.moveDown')}
                      title={t('myWorkIdeas.scenesManager.moveDown')}
                      className="p-0.5 text-slate-600 hover:text-slate-600"
                    >
                      <ChevronDown size={10} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(scene.id);
                        setEditName(scene.name);
                      }}
                      aria-label={t('myWorkIdeas.scenesManager.rename')}
                      title={t('myWorkIdeas.scenesManager.rename')}
                      className="p-0.5 text-slate-600 hover:text-c-info"
                    >
                      <Edit3 size={10} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteScene(scene.id);
                      }}
                      aria-label={t('myWorkIdeas.scenesManager.deleteScene')}
                      title={t('myWorkIdeas.scenesManager.deleteScene')}
                      className="p-0.5 text-slate-600 hover:text-danger-500"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Presentation mode overlay */}
      {presentationMode && (
        <div className="fixed inset-x-0 bottom-0 z-[100] flex items-center justify-center py-4">
          <div className="flex items-center gap-3 bg-black/80 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-2xl">
            <button
              onClick={() => {
                const prev = Math.max(0, currentSlide - 1);
                setCurrentSlide(prev);
                if (scenes[prev]) onNavigateToScene(scenes[prev].viewport);
              }}
              disabled={currentSlide === 0}
              aria-label={t('myWorkIdeas.scenesManager.previousScene')}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="flex items-center gap-2">
              {scenes.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setCurrentSlide(i);
                    if (scenes[i]) onNavigateToScene(scenes[i].viewport);
                  }}
                  aria-label={`${t('myWorkIdeas.scenesManager.scene')} ${i + 1}`}
                  aria-current={i === currentSlide}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentSlide ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => {
                const next = Math.min(scenes.length - 1, currentSlide + 1);
                setCurrentSlide(next);
                if (scenes[next]) onNavigateToScene(scenes[next].viewport);
              }}
              disabled={currentSlide === scenes.length - 1}
              aria-label={t('myWorkIdeas.scenesManager.nextScene')}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
            >
              <ArrowRight size={18} />
            </button>

            <div className="w-px h-6 bg-white/20 mx-1" />

            <span className="text-[11px] text-white/60 font-medium">
              {currentSlide + 1} / {scenes.length}
            </span>

            <button
              onClick={() => {
                setPresentationMode(false);
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              }}
              aria-label={t('myWorkIdeas.scenesManager.exitPresentation')}
              title={t('myWorkIdeas.scenesManager.exitPresentation')}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors ml-2"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default IdeaScenesManager;
