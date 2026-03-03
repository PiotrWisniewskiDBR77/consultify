import { useEffect, useMemo, useState } from 'react';

import { OpenDocument } from './types';

type ModuleDocsState = {
  openDocuments: OpenDocument[];
  activeDocumentId: string | null;
};

const STORAGE_PREFIX = 'moduleHub.openDocuments.';

const isOpenDocument = (value: any): value is OpenDocument =>
  value &&
  typeof value.id === 'string' &&
  typeof value.type === 'string' &&
  typeof value.subType === 'string' &&
  typeof value.name === 'string' &&
  typeof value.status === 'string';

const parseStoredState = (raw: string | null): ModuleDocsState | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const docs = Array.isArray(parsed.openDocuments)
      ? parsed.openDocuments.filter(isOpenDocument)
      : [];
    const activeId =
      typeof parsed.activeDocumentId === 'string' && parsed.activeDocumentId.trim()
        ? parsed.activeDocumentId
        : null;
    return { openDocuments: docs, activeDocumentId: activeId };
  } catch {
    return null;
  }
};

export const useModuleOpenDocuments = (
  moduleKey: string,
  options?: { maxOpenDocuments?: number }
) => {
  const storageKey = useMemo(() => `${STORAGE_PREFIX}${moduleKey}`, [moduleKey]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const maxOpen = options?.maxOpenDocuments;

  useEffect(() => {
    try {
      const parsed = parseStoredState(window.sessionStorage.getItem(storageKey));
      if (parsed) {
        setOpenDocuments(parsed.openDocuments);
        if (
          parsed.activeDocumentId &&
          parsed.openDocuments.some((d) => d.id === parsed.activeDocumentId)
        ) {
          setActiveDocumentId(parsed.activeDocumentId);
        }
      }
    } catch {
      // Ignore storage read failures.
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          openDocuments,
          activeDocumentId,
        })
      );
    } catch {
      // Ignore storage write failures.
    }
  }, [storageKey, openDocuments, activeDocumentId, hydrated]);

  useEffect(() => {
    if (!maxOpen) return;
    if (openDocuments.length <= maxOpen) return;
    setOpenDocuments((prev) => prev.slice(0, maxOpen));
    if (activeDocumentId && !openDocuments.slice(0, maxOpen).some((d) => d.id === activeDocumentId)) {
      setActiveDocumentId(openDocuments[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxOpen, openDocuments.length]);

  return {
    openDocuments,
    setOpenDocuments,
    activeDocumentId,
    setActiveDocumentId,
    hydrated,
  };
};

export default useModuleOpenDocuments;
