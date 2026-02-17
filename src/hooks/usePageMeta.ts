import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const DEFAULT_TITLE = 'Consultinity';

const getTitleFromPath = (path: string) => {
  // Keep the browser tab title stable and branded.
  return DEFAULT_TITLE;
};

export const usePageMeta = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = getTitleFromPath(location.pathname);
  }, [location.pathname]);
};
