# K-24c KROK 0 — „lista dowodów dostaje przycisk usuń wpięty w zdarzenie K-24b": premisa FAŁSZYWA (już dostarczone przez K-24b)

Data: 2026-09-19 CDT · Stanowisko C (Qoder) · Linia: okno 16 `75bb013df6`
Zlecenie: KANAL.md Wpis 218 pkt [C] + Wpis 219 [C] — „po QC11b mała pozycja **K-24c**: lista
dowodów z Twojego K-24a (QC3) dostaje przycisk „usuń" wpięty w zdarzenie K-24b (test wpięcia na
realnej liście: klik → wołacz K-24b z argumentem id; mutacja RED; zrzut light/dark)."

## Werdykt KROK 0: premisa FAŁSZYWA — cały zakres funkcyjny K-24c jest JUŻ NA LINII w commicie K-24b `4bbb8f30b3`

K-24b („add DRD evidence removal event", `4bbb8f30b3`, Piotr/Codex 18.09 22:11) dodał NIE tylko
zdarzenie `EVIDENCE_REMOVED`, ale dokładnie to, co Wpis 218 przypisuje K-24c:
1. **przycisk „usuń"** w liście dowodów K-24a (`InterviewFocusPanel.tsx`),
2. **wpięcie** klik → wołacz `runtime.removeEvidence({evidenceId, removedEventId, unitId, level})`
   → `appendEvent('EVIDENCE_REMOVED', …)` z argumentem id,
3. **test wpięcia na REALNEJ liście** (`DrdHttpMethodWorkspaceScreen.evidenceList.test.tsx`),
   asertujący argument wywołania (nie lustro),
4. **projekcję** ukrywającą usunięty wiersz (`evidenceEventsFor` w `drdWorkspaceViewModel.ts`).

Budowanie K-24c od zera = duplikat/konflikt z już scalonym kodem. Zgodnie z regułą KROK 0
(„premisa fałszywa = STOP jednym akapitem; to tańsze niż v2/v3") i DEC-607 (zero naprawy
przy okazji) — STOP, zero kodu produktu.

## Pomiar 1 — przycisk i wpięcie istnieją w drzewie roboczym (HEAD = `75bb013df6`)

- Przycisk: `src/components/method-workspace/InterviewFocusPanel.tsx:385-394` —
  `{onEvidenceRemove && !readOnly && (<button data-testid="evidence-remove-button" … onClick={() => onEvidenceRemove(q.question.questionId, item)}><Trash2 size={13}/></button>)}`;
  ikona `Trash2` import :11; prop `onEvidenceRemove?` :38/:74.
- Wpięcie w ekranie: `src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx:1006-1017`
  (`handleEvidenceRemove` → `runtime.removeEvidence({unitId, level, evidenceId: evidence.evidenceId,
  removedEventId: evidence.eventId})`) oraz :2042 (`onEvidenceRemove: (qid, evidence) => void handleEvidenceRemove(…)`).
- Wołacz runtime: `src/method-core/methods/drd/drdHttpSessionRuntime.ts:364-384`
  (`removeEvidence(input)` → `appendEvent({type:'EVIDENCE_REMOVED', unitId, level, payload})`).
- Projekcja: `src/components/assessment/drd/drdWorkspaceViewModel.ts:96-113`
  (`evidenceEventsFor` zbiera `EVIDENCE_REMOVED` do `removedEvidenceIds` i odsiewa dopasowane
  `EVIDENCE_ATTACHED` bez mutacji historii).

## Pomiar 2 — test wpięcia GREEN na linii (realna lista, nie lustro)

`npx vitest run src/components/assessment/drd/__tests__/DrdHttpMethodWorkspaceScreen.evidenceList.test.tsx --retry=0`
→ **3 passed / 0 failed**, w tym przypadek K-24b
(„kliknięcie usuń zapisuje EVIDENCE_REMOVED i projekcja ukrywa wiersz", linia 189).
Asercja (linia 200-209): `expect(hoisted.appendEvent).toHaveBeenCalledWith('sess-http-1',
expect.objectContaining({type:'EVIDENCE_REMOVED', unitId: AREA_1A.id,
payload: expect.objectContaining({evidenceId:'polityka-bezpieczenstwa-2026.pdf',
removedEventId:'evt-evidence-1'})}), expect.stringMatching(/^evidence-removed:…/))`
+ `queryByText('polityka-…pdf')` znika. To DOKŁADNIE „klik → wołacz K-24b z argumentem id".

## Pomiar 3 — mutacja RED (dowód, że test jest wpięciowy, nie obecnościowy)

Tymczasowo w `DrdHttpMethodWorkspaceScreen.tsx:1008` dopisane `if (evidence) return;` PRZED
`await runtime.removeEvidence(…)` (zdejmuje wpięcie; `evidence` zawsze truthy → early-return).
Run → **1 failed / 2 passed**: przypadek K-24b RED (`appendEvent` nie wołany z `EVIDENCE_REMOVED`),
pozostałe 2 (flaga ON render, flaga OFF brak) GREEN. Cofnięte `git checkout --` (ścieżka
bezwzględna w tej samej komendzie) → `git status --short` PUSTY, `git diff --stat` PUSTY.

## Co JEST, a co NIE jest w commicie K-24b (reszta z Wpisu 218)

- przycisk + wpięcie + test wpięcia + projekcja + mutowalna czerwien = **SĄ** (Pomiar 1-3).
- **zrzut light/dark** — NIE jest w commicie `4bbb8f30b3` (`git show --stat` = 14 plików, zero
  `evidence/`). Lista dowodów renderuje za flagą `VITE_DRD_EVIDENCE_LIST` (domyślnie OFF, DEC-650).
  To JEDYNY residual nazwany przez CTO, którego K-24b nie pokrył. Wymaga decyzji CTO, czy jest
  nadal potrzebny (przycisk jest już żywy w kodzie; zrzut to artefakt wizualnej akceptacji właściciela).

## Rekomendacja

STOP K-24c jako build: zakres funkcyjny dostarczony i udowodniony (K-24b `4bbb8f30b3` + mutacja
RED powyżej). Jeśli CTO chce domknąć Wpis 218 dosłownie, jedyna pozostała czynność = zrzut
light/dark listy z przyciskiem „usuń" z harnessu `dev-render` przy `VITE_DRD_EVIDENCE_LIST=true`
(lokalnie, nie na żywym stagingu — wdrożenie 31 w toku per Wpis 219) — do potwierdzenia przez CTO.

## Stan drzewa

Gałąź `qoder/c-k24c-evidence-remove-20260919` od `75bb013df6` (okno 16). Mutacja cofnięta,
`git status` produktu czysty; ten plik evidence = jedyna zmiana. Zero kodu produktu, zero migracji,
zero zapisu do bazy, kontenerów nie uruchamiałem.
