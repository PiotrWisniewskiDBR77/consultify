import {cookies, headers} from 'next/headers';
import {getRequestConfig} from 'next-intl/server';
import {defaultLocale, isLocale, LOCALE_COOKIE, LOCALE_HEADER, type Locale} from './config';

async function loadMessages(locale: Locale) {
  switch (locale) {
    case 'en':
      return (await import('../../messages/en.json')).default;
    case 'pl':
      return (await import('../../messages/pl.json')).default;
    case 'de':
      return (await import('../../messages/de.json')).default;
    case 'ja':
      return (await import('../../messages/ja.json')).default;
    case 'ar':
      return (await import('../../messages/ar.json')).default;
    case 'es':
      return (await import('../../messages/es.json')).default;
  }
}

export default getRequestConfig(async () => {
  const hdrs = await headers();
  const hdrLocale = hdrs.get(LOCALE_HEADER);

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;

  const locale = isLocale(hdrLocale)
    ? hdrLocale
    : isLocale(cookieLocale)
      ? cookieLocale
      : defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});

