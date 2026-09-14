/**
 * P-T16 — TEST KONTRAKTOWY: reguła nie jest biblioteką bez wywołania.
 *
 * Test obok (`interviewAnswerIntelligibility.test.ts`) dowodzi, że reguła
 * poprawnie rozpoznaje bełkot. Ten dowodzi rzeczy, bez której tamto nic nie
 * znaczy: że PRODUKCYJNY oceniacz odpowiedzi jej UŻYWA — bełkot nie dociera
 * do modelu, a użytkownik dostaje stałą treść zamiast zmyślonego akapitu.
 *
 * `evaluateInterviewSessionAnswers` nie dotyka bazy (pytania dostaje
 * argumentem), więc wystarczy podmienić `llmService`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn();
const resolveModelConfig = vi.fn(async () => ({ id: 'model-x', provider: 'prov-x' }));

vi.mock('../../ai/llmService.js', () => ({
  llmService: {
    call: (...args: unknown[]) => call(...args),
    resolveModelConfig: (...args: unknown[]) => resolveModelConfig(...args),
  },
}));

const { evaluateInterviewSessionAnswers } = await import(
  '../../../controllers/InterviewController.js'
);

const pytanie = (id: string, answer: string) => ({
  id,
  question_text: `Pytanie ${id}`,
  status: 'answered',
  answer_text: answer,
  is_required: true,
  sort_order: 1,
});

/** Odpowiedź modelu dla pytań, które faktycznie do niego doszły. */
function odpowiedzModelu(ids: string[]) {
  return {
    object: {
      questionEvaluations: ids.map((questionId) => ({
        questionId,
        rubric: [
          { criterion: 'concreteness', score: 3, justification: 'x' },
          { criterion: 'evidence', score: 3, justification: 'x' },
          { criterion: 'depth', score: 3, justification: 'x' },
          { criterion: 'measurability', score: 3, justification: 'x' },
          { criterion: 'coherence', score: 3, justification: 'x' },
        ],
        feedback: 'Solidna odpowiedź.',
        fixType: null,
      })),
      recommendations: ['Dopytaj o liczby.'],
    },
  };
}

describe('P-T16 kontrakt — bełkot nie dociera do modelu', () => {
  beforeEach(() => {
    call.mockReset();
    resolveModelConfig.mockClear();
  });

  it('sesja z samym bełkotem NIE woła modelu ANI RAZU', async () => {
    const questions = [
      pytanie('q1', 'asdasdasd'),
      pytanie('q2', 'qwertyuiop'),
      pytanie('q3', 'gdfkjghdfkjg'),
    ];
    const wynik = await evaluateInterviewSessionAnswers({
      session: { id: 's1', name: 'Sesja' },
      questions,
      language: 'pl',
    });

    expect(call).not.toHaveBeenCalled();

    for (const ocena of wynik.questionEvaluations) {
      expect(ocena.feedback).toContain('Nie rozumiem odpowiedzi — doprecyzuj');
      expect(ocena.fixType).toBe('clarify');
      expect(ocena.rubricTotal).toBe(0);
    }
    // Sesja bez wywołania modelu i tak dostaje wskazówkę, co zrobić.
    expect(wynik.recommendations.join(' ')).toContain('nieczytelne');
  });

  it('do modelu idą WYŁĄCZNIE odpowiedzi czytelne; bełkot dostaje stałą treść', async () => {
    const questions = [
      pytanie('q1', 'asdasdasd'),
      pytanie('q2', 'Wdrożyliśmy ERP w 2023 roku, moduł magazynowy.'),
    ];
    call.mockResolvedValueOnce(odpowiedzModelu(['q2']));

    const wynik = await evaluateInterviewSessionAnswers({
      session: { id: 's2', name: 'Sesja' },
      questions,
      language: 'pl',
    });

    expect(call).toHaveBeenCalledTimes(1);
    const promptUzytkownika = String(call.mock.calls[0][0].messages[0].content);
    expect(promptUzytkownika).toContain('Wdrożyliśmy ERP');
    expect(promptUzytkownika).not.toContain('asdasdasd');

    const belkot = wynik.questionEvaluations.find((e: any) => e.questionId === 'q1');
    const normalna = wynik.questionEvaluations.find((e: any) => e.questionId === 'q2');
    expect(belkot.feedback).toContain('Nie rozumiem odpowiedzi — doprecyzuj');
    expect(normalna.feedback).toBe('Solidna odpowiedź.');
    expect(normalna.rubricTotal).toBe(15);
  });

  it('REGRESJA: sesja bez bełkotu zachowuje się dokładnie jak przed zmianą', async () => {
    const questions = [
      pytanie('q1', 'Mamy dwa magazyny i jeden WMS.'),
      pytanie('q2', 'Obieg faktur trwa 8 dni roboczych.'),
    ];
    call.mockResolvedValueOnce(odpowiedzModelu(['q1', 'q2']));

    const wynik = await evaluateInterviewSessionAnswers({
      session: { id: 's3', name: 'Sesja' },
      questions,
      language: 'pl',
    });

    expect(call).toHaveBeenCalledTimes(1);
    expect(wynik.questionEvaluations).toHaveLength(2);
    for (const ocena of wynik.questionEvaluations) {
      expect(ocena.feedback).toBe('Solidna odpowiedź.');
      expect(ocena.rubricTotal).toBe(15);
    }
    // Zero dopisanych zaleceń — lista pochodzi wyłącznie od modelu.
    expect(wynik.recommendations).toEqual(['Dopytaj o liczby.']);
  });

  it('stała treść jest przetłumaczona — EN dla language=en', async () => {
    const wynik = await evaluateInterviewSessionAnswers({
      session: { id: 's4', name: 'Session' },
      questions: [pytanie('q1', 'jjjjjjj')],
      language: 'en',
    });
    expect(call).not.toHaveBeenCalled();
    expect(wynik.questionEvaluations[0].feedback).toContain("can't interpret this answer");
  });

  it('ta sama sesja bełkotu dwa razy daje IDENTYCZNY wynik (zero rozjazdu)', async () => {
    const zrob = () =>
      evaluateInterviewSessionAnswers({
        session: { id: 's5', name: 'Sesja' },
        questions: [pytanie('q1', 'asdasdasd'), pytanie('q2', 'qwertyuiop')],
        language: 'pl',
      });
    const [a, b] = [await zrob(), await zrob()];
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
