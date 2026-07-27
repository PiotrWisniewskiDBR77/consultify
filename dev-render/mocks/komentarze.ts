/**
 * Mock STANOWY komentarzy Idei dla harnessów dev-render.
 *
 * PO CO STANOWY: zamrożony mock (`async () => []`) pokazywałby przycisk „Dodaj
 * komentarz" jako działający, a lista nigdy by się nie zmieniła — nie dałoby
 * się odróżnić naprawy od dalszej awarii. Magazyn żyje w `sessionStorage`, więc
 * komentarz PRZEŻYWA przeładowanie strony (F5) — to jedyny sposób, żeby w
 * harnessie bez backendu sprawdzić trwałość zapisu.
 *
 * Kształt odpowiedzi 1:1 z serwerem (`server/src/routes/my-work.routes.ts`):
 *   GET    …/map/comments                  → { comments: [{id,nodeId,author,text,createdAt}] }
 *   GET    …/map/nodes/:nodeId/comments    → j.w., przefiltrowane po nodeId
 *   POST   …/map/nodes/:nodeId/comments    → dopisuje
 *   DELETE …/nodes/:nodeId/comments/:id    → usuwa
 *
 * Dev-only: plik żyje wyłącznie w `dev-render/`, nie wchodzi do buildu.
 */
import { Api } from '../../src/services/api';

export interface MockComment {
  id: string;
  nodeId: string;
  author: string;
  text: string;
  createdAt: string;
}

/**
 * Podpina stanowe mocki komentarzy pod singleton `Api`.
 *
 * @param klucz  osobny klucz sessionStorage per ekran, żeby harnessy nie
 *               podbierały sobie nawzajem danych.
 * @param nasiona  opcjonalne komentarze startowe (gdy magazyn jest pusty).
 */
export function zamontujMockKomentarzy(klucz: string, nasiona: MockComment[] = []): void {
  const wczytaj = (): MockComment[] => {
    try {
      const raw = sessionStorage.getItem(klucz);
      if (raw) return JSON.parse(raw) as MockComment[];
    } catch {
      /* uszkodzony wpis → startujemy od nasion */
    }
    return [...nasiona];
  };

  const zapisz = (lista: MockComment[]): void => {
    try {
      sessionStorage.setItem(klucz, JSON.stringify(lista));
    } catch {
      /* tryb prywatny — trudno, zostaje pamięć procesu */
    }
  };

  Api.getIdeaComments = (async () => ({ comments: wczytaj() })) as typeof Api.getIdeaComments;

  Api.getNodeComments = (async (_ideaId: string, nodeId: string) => ({
    comments: wczytaj().filter((c) => c.nodeId === nodeId),
  })) as typeof Api.getNodeComments;

  Api.addNodeComment = (async (_ideaId: string, nodeId: string, text: string) => {
    const nowy: MockComment = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      nodeId,
      author: 'Piotr Wiśniewski',
      text,
      createdAt: new Date().toISOString(),
    };
    zapisz([...wczytaj(), nowy]);
    return { comment: nowy };
  }) as typeof Api.addNodeComment;

  Api.deleteNodeComment = (async (_ideaId: string, _nodeId: string, commentId: string) => {
    zapisz(wczytaj().filter((c) => c.id !== commentId));
    return { ok: true };
  }) as typeof Api.deleteNodeComment;
}
