---
doc_id: funkcje-dowod-straznik-poufnosci
status: evidence
truth_type: runtime
established: 2026-08-30
---

# Dowód — dokument poufny wchodzi do promptu Teresy

Pomiar wykonany **czytaniem kodu na `codex/m03-admin-20260824`, tip `4003e72440`**,
2026-08-30, przez nadzorcę toru funkcji. Nie jest to przepisany raport wykonawcy.

## Co gwarantuje strażnik

`server/src/services/ai/documentGovernance.ts:18` — `filterDocumentsByVisibility`
blokuje dokument, gdy `ai_visibility = 'blocked'` **albo** `sensitivity = 'confidential'`,
plus całą teczkę przy `governance_settings.ai_documents_disabled`. Sam w sobie jest
**fail-closed**: `documentGovernance.ts:109` — błąd → wszystko do `blocked`.
Strażnik jest napisany dobrze. Problem jest w tym, **kto go woła**.

## Ile jest wołaczy strażnika: DWA

```
server/src/services/aiContextBuilder.ts:974
server/src/services/organizationContext/ContextRetrievalService.ts:333
```

Komenda: `grep -rn "filterDocumentsByVisibility" server/src --include='*.ts' | grep -v __tests__`
→ poza definicją i eksportem (`documentGovernance.ts:18`, `:232`) i importem
(`ContextRetrievalService.ts:22`) **tylko te dwa miejsca**.

- Wołacz `ContextRetrievalService.ts:333` siedzi wyłącznie w
  `keepOnlyGovernanceAllowedDocs`, wołanym tylko z `fetchOrgApprovedContext`
  — czyli **za flagą `ENABLE_ORG_KNOWLEDGE_RETRIEVAL`**, `ai.routes.ts:4077`,
  domyślnie **OFF**. Ta droga jest dziś martwa.
- Wołacz `aiContextBuilder.ts:974` jest na drodze żywej, ale jego `catch`
  ma w kodzie komentarz **`// fail-open`** (`aiContextBuilder.ts:1008`).
  Każdy błąd strażnika = **wszystkie dokumenty przechodzą**. To jest dokładne
  odwrócenie kontraktu `fail-closed` z `documentGovernance.ts:109`.

## Trzy wejścia do promptu, które strażnika NIE wołają wcale — aktywne dziś, bez flagi

| # | Miejsce | Co wpuszcza | Filtr, jaki realnie stosuje |
| --- | --- | --- | --- |
| E1 | `ContextRetrievalService.ts:139` `fetchAccessibleDocuments` — droga RAG załączników, wołana z `ai.routes.ts:4207` | **treść** fragmentów | wyłącznie `organization_id`, `deleted_at`, `scope`; zero `ai_visibility`, zero `sensitivity` |
| E2 | `ai.routes.ts:4368` „Attachment fallback" — surowy `SELECT` z `knowledge_chunks` | **treść** fragmentów | `d.organization_id` i `d.status`; **nie przechodzi nawet przez serwis** |
| E3 | `ai.routes.ts:4458` „ATTACHMENTS (metadata only)" | **nazwy plików** | brak |

E2 jest szczególnie ostry: uruchamia się właśnie wtedy, gdy droga E1 **nic nie zwróciła**
— czyli awaria pierwszej drogi włącza drogę bez żadnego strażnika.

## Dlaczego obrona „użytkownik sam załączył" nie broni się

`ai.routes.ts:4030–4041`:

```sql
SELECT k.doc_id FROM conversations c
 JOIN project_knowledge k ON k.project_id = c.chat_project_id
 WHERE c.id = ? AND k.kind = 'file' AND k.doc_id IS NOT NULL
```

Kod dokłada do `attachmentDocIds` **wszystkie pliki projektu rozmowy**, niezależnie od
tego, co użytkownik załączył. Komentarz w kodzie mówi to wprost: „Only widens retrieval".
Wejście jest **poszerzane bez udziału użytkownika** — więc zgoda użytkownika nie jest
tu żadną barierą.

## Stan i klasyfikacja

| Pozycja | Stan | Ocena |
| --- | --- | --- |
| Strażnik poufności `filterDocumentsByVisibility` | `DZIALA` (sam w sobie, fail-closed) | — |
| Wołacz strażnika na drodze załączników (E1) | `DO_ZBUDOWANIA` — dowód nieistnienia wyżej | `C` |
| Wołacz strażnika na drodze awaryjnej (E2) | `DO_ZBUDOWANIA` | `C` |
| Wołacz strażnika na drodze metadanych (E3) | `DO_ZBUDOWANIA` | `C` |
| Wołacz w `aiContextBuilder` (E4) | `ISTNIEJE_NIEAKTYWNE` — jest, ale `fail-open` znosi go przy błędzie | `C` |
| Droga korpusu organizacji | `ZA_FLAGA` (`ENABLE_ORG_KNOWLEDGE_RETRIEVAL`, OFF) — strażnik obecny | `D` |

**Do właściciela ten zestaw NIE idzie jako funkcja** (reguła nr 2 — same `C`).
Idzie jako podstawa dyżuru.

## Co ma zrobić dyżur

**Jeden** strażnik na **wszystkich trzech** żywych wejściach (E1, E2, E3), plus
zamiana `fail-open` na `fail-closed` w `aiContextBuilder.ts:1008`. Do każdego wejścia
**test różnicujący**: przy cofniętej naprawie dokument `sensitivity='confidential'`
jest w promptcie, po naprawie go nie ma. Test, który przechodzi także przed naprawą,
nie liczy się (bramka fazy 4 planu funkcji).

## Twierdzenia niezweryfikowane

- Nie sprawdziłem, ile dokumentów na żywej bazie ma realnie `sensitivity='confidential'`
  — pomiar czytania kodu, nie bazy. Jeśli kolumna jest wszędzie pusta, defekt jest
  utajony, ale **nie znika**: domyślna wartość w strażniku to `'internal'`, więc
  dopiero jawne oznaczenie poufności coś blokuje.
- Nie prześledziłem, czy `AIPipeline`/`aiOrchestrator` mają czwartą, własną ścieżkę
  wstrzykiwania treści dokumentu do promptu. To wchodzi do zakresu dyżuru jako pozycja
  inwentaryzacyjna, nie jako twierdzenie.
