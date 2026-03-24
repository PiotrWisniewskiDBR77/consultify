import {isLocale, type Locale} from './config';

function isExternalHref(href: string) {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) || href.startsWith('//');
}

export function stripLocaleFromPathname(pathname: string) {
  const parts = pathname.split('/');
  const maybeLocale = parts[1];
  if (isLocale(maybeLocale)) {
    const rest = '/' + parts.slice(2).join('/');
    return rest === '/' ? '/' : rest.replace(/\/+$/, '') || '/';
  }
  return pathname;
}

export function localizePathname(pathname: string, locale: Locale) {
  if (!pathname.startsWith('/')) return pathname;
  // Cookie-based locale selection (no URL prefix routing)
  void locale;
  return pathname;
}

export function localizeHref(href: string, locale: Locale) {
  if (!href) return href;
  if (href.startsWith('#')) return href;
  if (isExternalHref(href)) return href;

  // Handle relative internal paths (we mostly use absolute '/...')
  if (!href.startsWith('/')) return href;

  return localizePathname(href, locale);
}

