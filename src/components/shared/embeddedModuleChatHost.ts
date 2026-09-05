/**
 * embeddedModuleChatHost — rejestr ekranów, które OSADZAJĄ Teresę u siebie.
 *
 * ★ POWÓD ISTNIENIA (decyzja CTO 2026-09-05, „jeden prawy panel"). `MainLayout`
 * decyduje o globalnym doku Teresy po ŚCIEŻCE (`hasEmbeddedModuleChat`:
 * `/wordy`, `/excele`, `/prezentacje`, `/tabele`, warsztat Pomysłów). Dla
 * Notatnika sama ścieżka nie wystarcza i jest wręcz niebezpieczna: pod jednym
 * adresem `/my-work/notebook` żyją DWA ekrany — lista notatników (bez prawego
 * panelu) i otwarta notatka (z panelem). Wyłączenie doku po ścieżce
 * wygasiłoby Teresę na LIŚCIE, gdzie nikt jej nie osadza — czyli dokładnie
 * kształt „zamknięte przez wygaszenie" (funkcja znika dla wszystkich, a
 * bezpiecznik świeci na zielono).
 *
 * Dlatego gospodarz melduje się SAM, na czas montowania powierzchni, która
 * naprawdę renderuje `UnifiedChatPanel` u siebie. Licznik (a nie flaga
 * logiczna) obsługuje przeplot mount/unmount przy przełączaniu tras w React —
 * nowy gospodarz montuje się ZANIM stary się odmontuje.
 *
 * Wzorzec 1:1 z `src/components/MyWork/panel/canvasAnalysisSlot.ts`.
 */
import { useEffect, useState } from 'react';

let liczbaGospodarzy = 0;
const sluchacze = new Set<(host: boolean) => void>();

const rozeslij = () => {
  const host = liczbaGospodarzy > 0;
  for (const f of sluchacze) f(host);
};

/**
 * Melduje/odmeldowuje gospodarza osadzonej Teresy. Zwraca funkcję sprzątającą,
 * żeby wołacz mógł jej użyć wprost jako `return` z `useEffect`.
 */
export function registerEmbeddedModuleChatHost(): () => void {
  liczbaGospodarzy += 1;
  rozeslij();
  let zwolniony = false;
  return () => {
    if (zwolniony) return;
    zwolniony = true;
    liczbaGospodarzy = Math.max(0, liczbaGospodarzy - 1);
    rozeslij();
  };
}

export function isEmbeddedModuleChatHosted(): boolean {
  return liczbaGospodarzy > 0;
}

/** Wyłącznie do testów — czyści rejestr między przypadkami. */
export function resetEmbeddedModuleChatHost(): void {
  liczbaGospodarzy = 0;
  rozeslij();
}

export function useEmbeddedModuleChatHost(): boolean {
  const [host, setHost] = useState<boolean>(() => liczbaGospodarzy > 0);
  useEffect(() => {
    setHost(liczbaGospodarzy > 0);
    sluchacze.add(setHost);
    return () => {
      sluchacze.delete(setHost);
    };
  }, []);
  return host;
}
