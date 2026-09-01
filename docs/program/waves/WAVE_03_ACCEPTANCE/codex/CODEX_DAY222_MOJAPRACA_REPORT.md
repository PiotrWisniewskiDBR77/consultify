# CODEX DAY 222 — Moja praca

Data: 2026-09-01  
Baza: `9fb7942a01`  
Gałąź: `codex/day222-mojapraca-20260901`  
Werdykt: `A.1 FIXED_VERIFIED`; `A.2 FIXED_WITH_MUTATION_PROOF / COMPONENT_RENDER_PARTIAL`; gate modułu bez zmiany.

## §0.1 — marker i sanity (dosłownie)

```text
9fb7942a01 G-3 c.d.: Gamma SAMA ostrzega ze uklady rozjada sie w PPTX (wykrycie przepelnienia + link do slajdu — wzorzec do skopiowania 1:1); deck pamieta source prompt i konspekt; szablon powstaje z gotowego decku; koszt 90 kredytow za 10 slajdow
MARKER OK
9fb7942a0117aaf4001836f00bf8bbdc4e717669
```

`status --short | head -3` nie wypisał żadnej linii. Dysk: `9.2Gi` wolnego. Tip uciekł do
`c557c502c2`; zakres `9fb7942a01..tip` zawiera wyłącznie późniejsze instrukcje/dokumenty
wymienione w logu §0.1, a praca wystartowała dokładnie z markera.

## W1–W9 — wynik wejściowy

```text
W1: 2598 generateAIComment; 2703 setComments((prev) => [...prev, newComment]); montaż 5677 i 7171.
W2: 186 addTaskCommentAndReload; 1600 handleAddComment; helper wykonuje addTaskComment, potem getTaskComments.
W3: 5677 onAIEnhance={generateAIComment}; 7171 onGenerateAIComment={generateAIComment}.
W4: 4518 definicja handleDownloadAttachment; 8909 wywołanie handleDownloadAttachment(a).
W5: stakeholders.map((s) => (...) zawiera handleDownloadAttachment(a); attachments.map((a) występuje osobno na 5549 i 9417.
W6: TaskDetailView.tsx 8828; DecisionDetailView.tsx 9844; razem 18672.
W7: wzorzec obecny; 5 przypadków it().
W8: Current gate: DAY100_PARTIAL_OWNER_PACKET / 3_OF_5_SURFACES_HAVE_FULL_STATE / CORE_DESIGN_TASKS_REQUIRED / NOT_ACCEPTED.
W9: 6165/5118/5119 wolne; brak kontenera cx-day22 w wyniku.
```

Pełne migracje lokalnej bazy `cx-day222-pg` zakończyły się na 876 wpisach. Replay:

```text
Applying migrations: 0
✅ Postgres migrations complete
MIGRATION_REPLAY_EXIT=0
schema_migrations_after_replay: 876
```

## §A.1 — komentarz AI

Zmiana: lokalny obiekt udający `AI Assistant` został zastąpiony przez
`setComments(await addTaskCommentAndReload(Api, taskId, generatedComment))`. Oba konsumery
(`CommentsCanvas` i starszy `CommentsSection`) używają tej samej funkcji.

Kontrakt backendu przyjmuje tylko `content` i opcjonalne `mentions`; kontroler zapisuje
`user_id=req.user.id`. Wybrano najmniejszy wariant (a): po reloadzie komentarz jest
przypisany zalogowanemu użytkownikowi, a etykieta `AI Assistant` nie jest utrwalana.
Nie wykonano migracji ani prefiksowania treści. Kontroler po INSERT wykonuje tylko audit
log i odpowiedź JSON; nie uruchamia wysyłki e-mail ani powiadomienia zewnętrznego.

Dowód mutacyjny (`--retry=0`): przed poprawką przypadek
`routes the generated comment through POST and the server readback` był `failed`; po
poprawce `passed`; po przywróceniu starego pliku przez `cp` ponownie `failed`; po
odtworzeniu poprawki pełny pakiet `RC=0`. Ścieżka błędu nadal odrzuca zapis i nie wykonuje
GET readback; `catch` nadal woła `notifyAiUnavailable`.

Commit: `a13e43cae850dd019c26747e08cebbd50c24e4da` (push `github-backup`).

## §A.2 — RACI

Typ `Stakeholder` nie ma pola załącznika. Usunięto wyłącznie przycisk pobierania z
ostatniego bloku `stakeholders.map((s) => ...)`; rola, osoba, e-mail, kanały i usuwanie
stakeholdera pozostały bez zmian.

Dowód mutacyjny (`--retry=0`): przed poprawką przypadek
`does not render an attachment download action for a stakeholder row` był `failed` na
obecności `handleDownloadAttachment`; po poprawce `passed`; po przywróceniu starego pliku
przez `cp` ponownie `failed`; finalny pakiet `RC=0`.

Ograniczenie: finalny test sprawdza rzeczywisty blok JSX i rzeczywisty kontrakt typu przez
odczyt źródła. Próba montażu całego `DecisionDetailView` nie osiągnęła tabeli, ponieważ
legacy C-mode jest automatycznie cofany do N-mode bez `VITE_ENABLE_LEGACY_C_MODE=true`.
Nie zmieniano flag ani infrastruktury testowej. Dlatego komponentowy render+klik z DoD
pozostaje `PARTIAL`, a nie `VERIFIED`.

Commit: `677081045c62aa2ca1c8e5e1473b60570f7ec32f` (push `github-backup`).

## §0.4a — nazwy testów

Przed: 5 pełnych nazw z Day 140. Po: te same 5 plus dokładnie:

```text
Day 222 AI task comment persistence does not perform a readback when persistence rejects
Day 222 AI task comment persistence persists before replacing local state with the GET readback
Day 222 AI task comment persistence routes the generated comment through POST and the server readback
Day 222 DecisionDetailView RACI row actions does not render an attachment download action for a stakeholder row
Day 222 DecisionDetailView RACI row actions keeps the stakeholder contract free of a fictional attachment field
```

Nazwy zniknięte: brak. Finalny pakiet: 10/10 `passed`, `--retry=0`, `DB_TYPE=postgres`
potwierdzone asercją w obu nowych plikach. Pułapki Z33 (a), (b), (d) nie leżą na ścieżce
tych czysto frontowych testów; komplet env mimo to ustawiono jawnie. Testy nie dowodzą
egzekucji HTTP/RealPG — dowodzą wyłącznie okablowania klienta i usunięcia błędnej akcji.

Artefakty poza repo:

- `przed.json` SHA-256 `82a88e40ff0d2f78bd7e7ae39ebc906ba64ee0aa8103f04df16003b691a93086`
- `po.json` SHA-256 `11197da4a6f83ab300e4480352ba72bea556da448066f07cb691aa5035584f4c`
- `red-before-corrected.json` SHA-256 `4c30c70bcb35afb0a10f0e68f3653e1854abd6f254809ac6d6b53770994c4f01`
- `red-reverse.json` SHA-256 `357c9ab3c8a205ce8c09513e523d54f2f0cb5786472a6fe105b4664351733289`
- `przed-nazwy.txt` SHA-256 `ac93a45fe6c2ef53c02fe34f56f5c01ac1445ca403c8a9dcf697783fbd16a920`
- `po-nazwy.txt` SHA-256 `3c5816f4664793fb40fdc561073fef5ac4823912667c0e78ecdcfb095b3ec600`

## Z30

Dowody: `BRAK ZMIENNYCH POCZTY`; tabela `settings` zwróciła 0 wierszy `smtp%`;
`Gateway.ts` nie zawiera startu drenażu outboxu. Nie ustawiłem żadnej zmiennej SMTP ani
flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem
`server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie
kalendarzowe nie zostało wysłane.

## Korekty wobec instrukcji

- Pierwsze dwie migracje uruchomione sekwencyjnie trwały dłużej niż okno narzędzia;
  kontrolny replay podczas pierwszego runnera prawidłowo odmówił przez advisory lock.
  Po zwolnieniu locka zmierzono 876 wpisów i osobny replay `Applying migrations: 0`, exit 0.
- DoD A.2 wymaga render+klik lub asercji DOM. Pełny render nie osiągnął legacy C-mode z
  powodu bramki flagi; zgodnie z Z10/Z18 nie włączono flagi i nie zmieniono harnessu.
  Dostarczono czerwono-zielony kontrakt źródłowy, ale status tej części pozostaje PARTIAL.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano realnego HTTP ApiGateway/JWT/SQL readback dla komentarza AI; istniejąca
  trasa backendowa była tylko odczytana, a ten dyżur jej nie zmieniał.
- Nie wykonano końcowego render+klik w legacy tabeli RACI z przyczyn opisanych wyżej.

## Zakres plików

Zmodyfikowano wyłącznie sześć licencjonowanych plików: dwa produktowe, dwa nowe testy,
kartę modułu (dopisek bez zmiany gate'u) i ten raport.
