/**
 * @vitest-environment jsdom
 *
 * Z-11 (2026-09-14) — dowód wizualny wymagany bramką: DOM-dump banera
 * "new version, refresh". `react-i18next` jest globalnie zamockowany w
 * `tests/setup.ts` (t(key, defaultValue) -> defaultValue, niezależnie od
 * języka — patrz komentarz tam), więc realny przełącznik pl/en nie da się
 * przetestować przez render — pokrycie i18n pl robi osobna asercja na
 * treści `public/locales/pl/translation.json` niżej w tym pliku.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import enTranslation from '../../public/locales/en/translation.json';
import plTranslation from '../../public/locales/pl/translation.json';
import { ChunkUpdateBanner } from '../../src/components/ChunkUpdateBanner';
import { CHUNK_UPDATE_EVENT } from '../../src/utils/chunkLoadRecovery';

describe('ChunkUpdateBanner — Z-11', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('is invisible by default (no chunk error yet)', () => {
    render(<ChunkUpdateBanner />);
    expect(screen.queryByTestId('chunk-update-banner')).not.toBeInTheDocument();
  });

  it('appears when the global CHUNK_UPDATE_EVENT fires and reloads on click', async () => {
    const user = userEvent.setup();
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadSpy },
      writable: true,
      configurable: true,
    });

    render(<ChunkUpdateBanner />);

    act(() => {
      window.dispatchEvent(new Event(CHUNK_UPDATE_EVENT));
    });

    const banner = await screen.findByTestId('chunk-update-banner');
    expect(banner).toHaveTextContent('A new version of the app is available');

    await user.click(screen.getByRole('button', { name: /refresh/i }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('has a non-empty, distinct Polish translation for both banner strings', () => {
    expect(enTranslation.errors.chunkUpdate.message).toBe(
      'A new version of the app is available — refresh the page.'
    );
    expect(plTranslation.errors.chunkUpdate.message).toBe(
      'Dostępna jest nowa wersja aplikacji — odśwież stronę.'
    );
    expect(enTranslation.errors.chunkUpdate.action).toBe('Refresh');
    expect(plTranslation.errors.chunkUpdate.action).toBe('Odśwież');
  });

  it('shows immediately on mount if the one-time reload was already attempted', () => {
    window.sessionStorage.setItem('consultify:chunk-reload-attempted:v1', '|http://localhost/');
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: 'http://localhost/' },
      writable: true,
      configurable: true,
    });

    render(<ChunkUpdateBanner />);

    expect(screen.getByTestId('chunk-update-banner')).toBeInTheDocument();
  });
});
