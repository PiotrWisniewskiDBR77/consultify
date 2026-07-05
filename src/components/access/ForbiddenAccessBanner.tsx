import { AlertTriangle, X } from 'lucide-react';
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type ForbiddenEventDetail = {
  status?: number;
  url?: string;
  message?: string;
};

const ADMIN_LIKE_PATH_PREFIXES = ['/admin', '/settings', '/superadmin', '/decisions'];

const isAdminLikePath = (pathname: string): boolean =>
  ADMIN_LIKE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

export const ForbiddenAccessBanner: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [message, setMessage] = React.useState<string | null>(null);
  const hideTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!isAdminLikePath(location.pathname) && message) {
      setMessage(null);
    }
  }, [location.pathname, message]);

  React.useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const onForbidden = (event: Event) => {
      if (!isAdminLikePath(location.pathname)) return;
      const detail = (event as CustomEvent<ForbiddenEventDetail>).detail || {};
      const fallback =
        'Brak uprawnien do tej sekcji. Skontaktuj sie z OWNER/SUPERADMIN lub wroc do bezpiecznego widoku.';
      setMessage(detail.message || fallback);
      clearHideTimer();
      hideTimerRef.current = window.setTimeout(() => {
        setMessage(null);
        hideTimerRef.current = null;
      }, 12000);
    };

    window.addEventListener('api:forbidden', onForbidden as EventListener);
    return () => {
      clearHideTimer();
      window.removeEventListener('api:forbidden', onForbidden as EventListener);
    };
  }, [location.pathname]);

  if (!message || !isAdminLikePath(location.pathname)) return null;

  return (
    <div className="fixed top-16 right-4 z-modal w-full max-w-md rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg dark:border-amber-500/30 dark:bg-amber-900/25">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700 dark:text-amber-300" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Brak uprawnien
          </div>
          <div className="mt-1 text-sm text-amber-800 dark:text-amber-200">{message}</div>
          <button
            type="button"
            onClick={() => navigate('/chat')}
            className="mt-2 inline-flex rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Wroc do Chat
          </button>
        </div>
        <button
          type="button"
          aria-label="Zamknij komunikat"
          onClick={() => setMessage(null)}
          className="rounded-md p-1 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default ForbiddenAccessBanner;
