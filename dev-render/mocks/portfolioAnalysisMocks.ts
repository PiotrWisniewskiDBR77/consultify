/**
 * Api-method mock dla ekranu dev-render `initiatives-portfolio-analysis`.
 *
 * DLACZEGO patchujemy METODY `Api.get/post/delete`, a NIE `window.fetch`:
 * ekrany harnessu instalują własne stuby przypisując `Api.get = …` przy
 * imporcie modułu. Takie przypisanie krótkuje ZANIM żądanie dojdzie do
 * `fetch`, więc mock na `window.fetch` nigdy nie zostałby zapytany.
 * Podmiana metod singletona `Api` w `useEffect` ekranu nadpisuje tamte
 * przypisania na czas pokazywania tego ekranu. (Ta sama zasada co w
 * `presentationTemplateArchitectMocks.ts`.)
 *
 * Pokrywa dokładnie to, co woła `PortfolioAnalysisView`:
 *   GET    /initiatives/portfolio/dependencies
 *   POST   /initiatives/portfolio/dependencies
 *   DELETE /initiatives/portfolio/dependencies/:id
 *   POST   /ai/generate         ← realne AI wykrywania zależności (atrapa #5)
 *   PATCH/PUT  /initiatives/:id ← „zastosuj" z paneli propozycji
 *
 * Tryb AI sterowany z URL (`?ai=ok|fail|empty`), żeby dało się OBEJRZEĆ
 * ścieżkę awarii bez ruszania żywej bazy — wymóg weryfikacji wariantu A.
 */
import { Api } from '@/services/api';

export type AiMockMode = 'ok' | 'fail' | 'empty';

/** Odpowiedź w kopercie `toAxiosLikeResponse` — `res.x` i `res.data.x` działają jak w produkcji. */
function axiosLike<T extends object>(payload: T): T {
  return new Proxy(payload, {
    get(target, prop, receiver) {
      if (prop === 'data') return target;
      return Reflect.get(target, prop, receiver);
    },
  }) as T;
}

/** Rejestr wywołań — ekran pokazuje go na pasku, żeby było WIDAĆ czy poszło żądanie. */
export interface MockCallLog {
  entries: string[];
}

export const callLog: MockCallLog = { entries: [] };

let dependencies = [
  {
    id: 'dep-1',
    fromInitiativeId: 'init-2',
    toInitiativeId: 'init-4',
    type: 'FINISH_TO_START',
    projectId: null,
  },
];

export function installPortfolioAnalysisApiMock(getAiMode: () => AiMockMode) {
  const originalGet = Api.get;
  const originalPost = Api.post;
  const originalDelete = Api.delete;
  const originalPatch = (Api as unknown as { patch?: unknown }).patch;

  (Api as unknown as { get: unknown }).get = async (url: string) => {
    callLog.entries.push(`GET ${url}`);
    if (url.includes('/initiatives/portfolio/dependencies')) {
      return axiosLike({ dependencies: [...dependencies] });
    }
    return axiosLike({});
  };

  (Api as unknown as { post: unknown }).post = async (url: string, body: unknown) => {
    callLog.entries.push(`POST ${url}`);

    // ── Realne AI: atrapa #5 (LogicAnalysis) ──
    if (url.includes('/ai/generate')) {
      const mode = getAiMode();
      if (mode === 'fail') {
        // Kształt błędu 1:1 jak z `handleResponse` w src/services/api.ts:
        // `err.data.code` jest tym, co czyta `aiFailureReason`.
        const err = new Error('AI provider is not configured') as Error & {
          status?: number;
          data?: { error: string; code: string };
        };
        err.status = 503;
        err.data = { error: 'AI provider is not configured', code: 'NO_LLM_PROVIDER' };
        throw err;
      }
      if (mode === 'empty') {
        return axiosLike({ text: '{"dependencies":[]}' });
      }
      // mode === 'ok' — model zwraca sensowne, ZALEŻNE od danych propozycje.
      // Uwaga: celowo dorzucamy jeden wiersz ze ZMYŚLONYM id ('init-999') oraz
      // duplikat pary już istniejącej (init-2 → init-4), żeby na ekranie było
      // widać, że walidacja po stronie frontu je odrzuca.
      return axiosLike({
        text: JSON.stringify({
          dependencies: [
            {
              fromId: 'init-3',
              toId: 'init-1',
              reason:
                'Migracja hurtowni danych dostarcza źródło, z którego korzysta pulpit zarządczy.',
              confidence: 'high',
            },
            {
              fromId: 'init-1',
              toId: 'init-5',
              reason: 'Pulpit zarządczy definiuje metryki raportowane w przeglądzie kwartalnym.',
              confidence: 'medium',
            },
            {
              fromId: 'init-999',
              toId: 'init-1',
              reason: 'ZMYŚLONE ID — musi zostać odrzucone przez walidację.',
              confidence: 'high',
            },
            {
              fromId: 'init-2',
              toId: 'init-4',
              reason: 'DUPLIKAT istniejącej zależności — musi zostać odrzucony.',
              confidence: 'high',
            },
          ],
        }),
      });
    }

    if (url.includes('/initiatives/portfolio/dependencies')) {
      const b = body as { fromInitiativeId: string; toInitiativeId: string; type: string };
      dependencies = [
        ...dependencies,
        {
          id: `dep-${dependencies.length + 1}`,
          fromInitiativeId: b.fromInitiativeId,
          toInitiativeId: b.toInitiativeId,
          type: b.type,
          projectId: null,
        },
      ];
      return axiosLike({ success: true });
    }

    return axiosLike({ success: true });
  };

  (Api as unknown as { delete: unknown }).delete = async (url: string) => {
    callLog.entries.push(`DELETE ${url}`);
    const id = url.split('/').pop();
    dependencies = dependencies.filter((d) => d.id !== id);
    return axiosLike({ success: true });
  };

  (Api as unknown as { patch: unknown }).patch = async (url: string) => {
    callLog.entries.push(`PATCH ${url}`);
    return axiosLike({ success: true });
  };

  return () => {
    Api.get = originalGet;
    Api.post = originalPost;
    Api.delete = originalDelete;
    (Api as unknown as { patch: unknown }).patch = originalPatch;
  };
}
