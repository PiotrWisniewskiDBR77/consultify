# ODBIÓR 222 — Moja praca: komentarz AI + pobieranie RACI

Audytor: sesja adwersaryjna główna (Fable), 2026-09-01. Zakres materiału:
`/private/tmp/cx-day222-mojapraca`, gałąź `codex/day222-mojapraca-20260901`,
commity `a13e43cae8` (A.1), `677081045c` (A.2), `71eddb6950` (docs). Marker `9fb7942a01`.

## Werdykt: SCALIĆ

Oba defekty naprawione poprawnie i w licencjonowanym zakresie; ograniczenie autorstwa
komentarza AI jest jawnie ujawnione przez wykonawcę, nie ukryte.

Ocena: **B+**

## Co zweryfikowano niezależnie

1. Diff `TaskDetailView.tsx`: lokalny fałszywy obiekt `{authorId: 'ai-assistant',
   authorName: 'AI Assistant', ...}` + `setComments((prev) => [...prev, newComment])`
   zastąpiony przez `setComments(await addTaskCommentAndReload(Api, taskId,
   generatedComment))` — ta sama funkcja, która realnie zapisuje ręczne komentarze
   (POST → GET readback), potwierdzona w kodzie (`:186-193`).
2. Diff `DecisionDetailView.tsx`: usunięty **wyłącznie** przycisk
   `onClick={() => handleDownloadAttachment(a)}` z bloku `stakeholders.map((s) => ...)`
   (linia 8909 na markerze) — `a` nie istniało w tym zasięgu (iteracja po `s`). Reszta
   wiersza (rola, e-mail, kanały, usuwanie) nietknięta.
3. Uruchomiono realny Postgres (`cx-day222-pg`, port 6165), oba nowe pliki testów:
   **5/5 PASS** na starcie.
4. **Bramka mutacyjna POTWIERDZONA przeze mnie, obie pozycje jednocześnie.** Przywrócono
   oryginalny buggy kod w obu plikach (lokalny fake-obiekt w `TaskDetailView.tsx` +
   przywrócony przycisk `handleDownloadAttachment(a)` w `DecisionDetailView.tsx`) →
   **oba pliki testów poszły RED** (2 failed, dokładnie test na trasę API i test na
   nieobecność przycisku). Przywrócono oba pliki przez `cp`, `cmp` czysty w obu
   przypadkach, `git status --short` bez zmian.
5. `MODULE_ACCEPTANCE.md`: dopisana wyłącznie jedna notatka w sekcji ewidencji, gate
   `NOT_ACCEPTED` bez zmiany — zgodne z licencją.

## Autorstwo komentarza AI — rozstrzygnięcie, nie przemilczenie

Backend nie niesie pojęcia autorstwa AI (`user_id=req.user.id` z JWT, kontrakt przyjmuje
tylko `content`/`mentions`). Wykonawca **wybrał i jawnie opisał** wariant (a): po
przeładowaniu komentarz jest przypisany zalogowanemu człowiekowi, etykieta „AI Assistant"
nie jest utrwalana. Potwierdzone w kodzie: `mapTaskServerComment` ustawia
`isAIGenerated: c.authorId === 'ai-assistant'`, a po zapisie `authorId` = ID zalogowanego
użytkownika, więc znacznik AI zniknie po odświeżeniu. To jest **znana, udokumentowana
strata** (nie cichy fałsz autorstwa) — zabroniono w tym dyżurze (`Z40`) dodawania kolumny
`is_ai_generated` i zmiany logiki promptu, więc szersza naprawa autorstwa wymaga osobnego,
świadomie zamówionego dyżuru. Warto zanotować do backlogu: komentarz AI dziś **wygląda
jak komentarz człowieka** po odświeżeniu strony.

## Ograniczenie DoD A.2 — zgłoszone, nie ukryte

Pełny render+klik `DecisionDetailView` nie osiągnął legacy C-mode (auto-cofnięcie do
N-mode bez `VITE_ENABLE_LEGACY_C_MODE=true`, którego dyżur nie miał prawa ustawić —
`Z10`/`Z18`). Wykonawca dostarczył zamiast tego kontrakt źródłowy (czerwono-zielony,
zweryfikowany przeze mnie) i **sam oznaczył status jako `PARTIAL`, nie `VERIFIED`** —
uczciwe rozpoznanie ograniczenia, zgodne z zasadą „STOP merytoryczny jest nagradzany".

## Odpowiedź wprost

**Czy komentarz AI zapisuje się z właściwym autorstwem: NIE — zapisuje się z
autorstwem zalogowanego człowieka, nie asystentki.** Defekt zapisu (komentarz znikał
po odświeżeniu) jest naprawiony i potwierdzony mutacyjnie. Utrata etykiety AI jest
jawnie ujawnionym, świadomym kompromisem w granicach licencji tego dyżuru (zakaz zmiany
schematu/promptu), nie cichym przypisaniem cudzego autorstwa — wykonawca nazwał to
wprost w raporcie.
