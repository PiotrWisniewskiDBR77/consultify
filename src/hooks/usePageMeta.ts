import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const DEFAULT_TITLE = 'Consultinity';

const getTitleFromPath = (path: string) => {
  if (!path || path === '/') return DEFAULT_TITLE;
  const lastSegment = path.split('/').filter(Boolean).pop();
  if (!lastSegment) return DEFAULT_TITLE;
  const label = lastSegment.replace(/[-_]/g, ' ');
  return `${DEFAULT_TITLE} · ${label[0].toUpperCase()}${label.slice(1)}`;
};

export const usePageMeta = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = getTitleFromPath(location.pathname);
  }, [location.pathname]);
};
