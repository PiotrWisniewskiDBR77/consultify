/**
 * IS-3b v2 (Wpis 122/123 pkt 2, DEC-510/U-08) — „OFFICIAL ANSWERS" = rejestr
 * zatwierdzeń, NIE liczba odpowiedzi.
 *
 * DLACZEGO: `includedAnswerCount` (generation_context.sourceMaterial) liczy
 * pytania `status='answered'` (odpowiedziane). Rejestr zatwierdzeń
 * (`interview_answer_decisions`, projekcja `readInterviewAnswerApprovalProjection`)
 * NIGDY nie odbija decyzji na `interview_questions.status`, więc odpowiedź
 * `sent_back` dalej liczyłaby się jako „official". Warunek CTO: licznik = rejestr
 * zatwierdzeń; „6 zatwierdzonych i 8 odpowiedzi → 6".
 *
 * SEMANTYKA (zmierzona w `interviewAnswerDecisionService.ts:1046-1077`): projekcja
 * daje `latestDecision: 'approved' | 'sent_back' | null` (ostatnia decyzja wg
 * ordinalu; `ai_approved`/`manager_approved` → 'approved', `*_sent_back` →
 * 'sent_back', brak decyzji → null). Przyjęto: oficjalna = `latestDecision ===
 * 'approved'`; `sent_back` i `pending` (null) NIE liczą się.
 */
import type { V8InterviewAnswerApproval } from '@/services/api/v8/interview';

/** Policz oficjalnie zatwierdzone odpowiedzi w jednej projekcji przydziału. */
export function countApprovedAnswers(
  approvals: V8InterviewAnswerApproval[] | null | undefined
): number {
  if (!Array.isArray(approvals)) return 0;
  return approvals.filter((approval) => approval?.latestDecision === 'approved').length;
}

/** Zsumuj zatwierdzone odpowiedzi across wielu przydziałów (sesji). */
export function sumApprovedAnswers(
  perAssignment: Array<V8InterviewAnswerApproval[] | null | undefined>
): number {
  if (!Array.isArray(perAssignment)) return 0;
  return perAssignment.reduce((total, list) => total + countApprovedAnswers(list), 0);
}
