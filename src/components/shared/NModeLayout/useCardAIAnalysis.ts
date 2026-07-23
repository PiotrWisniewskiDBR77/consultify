/**
 * useCardAIAnalysis — SZEW między przyciskiem „Analizuj z AI" (Menu 2) a panelem
 * wyników (ETAP 3 standardu n-Type).
 *
 * Karta N dostarcza JEDNĄ funkcję `buildInput`, która na żądanie opisuje AKTYWNĄ
 * kartę (cztery składniki z kontraktu właściciela: cel + standard bierze silnik
 * z kanonu kart, kartę i kontekst artefaktu podaje widok) oraz `applyChange`,
 * czyli jedyną drogę zapisu. Hook trzyma stan przebiegu i pilnuje trzech rzeczy,
 * które inaczej każda z sześciu kart zaimplementowałaby inaczej (albo wcale):
 *
 *   1. WYŚCIG ODPOWIEDZI — użytkownik klika „Analizuj z AI", potem przełącza
 *      kartę w lewej nawigacji. Odpowiedź na STARĄ kartę nie może wpaść do
 *      panelu opisanego nową kartą. Licznik `runIdRef` odrzuca spóźnialskich.
 *   2. NIEAKTUALNOŚĆ — zmiana aktywnej karty przy otwartym panelu czyści wynik,
 *      zamiast pokazywać analizę innej karty pod nowym tytułem.
 *   3. UCZCIWY BŁĄD — kod błędu ląduje w stanie i jest pokazany, nie połknięty
 *      przez `catch {}`.
 *
 * ZAKAZ NADPISANIA: hook nie zna setterów karty. Zapis wykonuje wyłącznie
 * `applyChange` przekazane przez kartę, wywołane wyłącznie z „Zastosuj".
 *
 * @see src/components/shared/NModeLayout/NCardAIAnalysisPanel.tsx
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  CardAnalysisApply,
  CardAnalysisInput,
  CardAnalysisResult,
} from '@/services/cardAnalysis';
import { analyzeCard, CardAnalysisError } from '@/services/cardAnalysis';

export interface UseCardAIAnalysisOptions {
  /**
   * Render-id AKTYWNEJ karty. Zmiana ⇒ poprzedni wynik przestaje obowiązywać.
   * Podanie `null` (brak aktywnej karty) blokuje uruchomienie.
   */
  activeCardId: string | null;
  /**
   * Opis aktywnej karty w chwili KLIKNIĘCIA. Funkcja, nie obiekt — inaczej
   * każdy render karty (a te są ciężkie: 4-10 tys. linii) budowałby kontekst
   * artefaktu na zapas, przy każdym naciśnięciu klawisza w polu formularza.
   */
  buildInput: () => CardAnalysisInput;
  /** Zapis pojedynczej zmiany. `false` ⇒ panel oznaczy pozycję jako nieudaną. */
  applyChange: CardAnalysisApply;
}

export interface UseCardAIAnalysisResult {
  open: boolean;
  loading: boolean;
  result: CardAnalysisResult | null;
  errorCode: string | null;
  serverErrorCode: string | null;
  /** Podpiąć pod `Menu2AIButton.onClick`. */
  run: () => void;
  /** Ponowne uruchomienie z panelu (ikona odświeżenia). */
  rerun: () => void;
  close: () => void;
  applyChange: CardAnalysisApply;
}

export function useCardAIAnalysis({
  activeCardId,
  buildInput,
  applyChange,
}: UseCardAIAnalysisOptions): UseCardAIAnalysisResult {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CardAnalysisResult | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [serverErrorCode, setServerErrorCode] = useState<string | null>(null);

  /** Numer bieżącego przebiegu — starsze odpowiedzi są ignorowane. */
  const runIdRef = useRef(0);
  /** Czy komponent nadal żyje (karta bywa zamykana w trakcie zapytania). */
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Zmiana aktywnej karty unieważnia wynik. Panel zostaje otwarty tylko wtedy,
  // gdy nic w nim nie zostaje — pokazywanie analizy karty A pod nagłówkiem
  // karty B byłoby kłamstwem.
  useEffect(() => {
    runIdRef.current += 1;
    setResult(null);
    setErrorCode(null);
    setServerErrorCode(null);
    setLoading(false);
    setOpen(false);
  }, [activeCardId]);

  const start = useCallback(() => {
    if (!activeCardId) return;

    const myRun = ++runIdRef.current;
    setOpen(true);
    setLoading(true);
    setResult(null);
    setErrorCode(null);
    setServerErrorCode(null);

    let input: CardAnalysisInput;
    try {
      input = buildInput();
    } catch (err) {
      // Błąd budowy wejścia to defekt karty, nie AI — mówimy to wprost.
      setLoading(false);
      setErrorCode('REQUEST_FAILED');
      setServerErrorCode((err as Error)?.message ?? null);
      return;
    }

    void analyzeCard(input)
      .then((res) => {
        if (!aliveRef.current || runIdRef.current !== myRun) return;
        setResult(res);
        setLoading(false);
      })
      .catch((err) => {
        if (!aliveRef.current || runIdRef.current !== myRun) return;
        const e = err as CardAnalysisError;
        setErrorCode(e?.code ?? 'REQUEST_FAILED');
        setServerErrorCode(e?.serverCode ?? null);
        setLoading(false);
      });
  }, [activeCardId, buildInput]);

  const close = useCallback(() => setOpen(false), []);

  return {
    open,
    loading,
    result,
    errorCode,
    serverErrorCode,
    run: start,
    rerun: start,
    close,
    applyChange,
  };
}

export default useCardAIAnalysis;
