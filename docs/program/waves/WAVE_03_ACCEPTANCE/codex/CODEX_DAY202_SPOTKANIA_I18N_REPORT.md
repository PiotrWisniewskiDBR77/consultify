# CODEX DAY 202 — Spotkania i18n

Data: 2026-08-31  
Gałąź: `codex/day202-spotkania-i18n-20260831`  
Baza: `consultify_w3_meetings_owner_cx202`, kontener `cx-day202-pg`, port `6132`  
Runtime: server `5074`, client `5075`  
Werdykt: **R1 ZROBIONE / R2 ZROBIONE / R3 ZROBIONE DLA i18n, z dwoma residualami poza licencją**.

## 0. Wejście, marker i rozjeście

Dokument miał stan `WYDANY`. Wolne miejsce: `14Gi` (> 5 GB). Porty `6132`, `5074`, `5075` były wolne.

Wynik §0.1 (2), dosłownie (lista 25 commitów została zachowana w logu sesji; poniżej rozstrzygający wynik):

```text
MARKER OK
```

Wynik §0.1 (7), dosłownie:

```text
60581ed6b5054e3218f7bc33d6e2a32794fb2af8
```

`git status --short | head -3` nie wypisał żadnej linii.

Tip `github-backup/codex/m03-admin-20260824` uciekł do przodu. Praca wystartowała dokładnie z markera. Wśród plików rozjeścia były pliki dyżuru 194 (`MeetingObjectPage.tsx` i testy), ale nie `MeetingHub.tsx` ani locale `meeting.*`. Scalenie z tipem pozostaje po stronie nadzorcy.

## 1. Stan wejściowy T1–T5 i korekty wobec instrukcji

- T1: cytat odbioru istnieje w `ODBIOR_181_SPOTKANIA_OTWARCIE.md:41-42`.
- T2: `meeting.empty`, `meeting.sync.workspace`, `meeting.operatorBriefError` były wołane przez `t()` i miały niepuste PL: `Brak spotkań`, `Wspólna przestrzeń`, `Nie udało się załadować briefu operatora.`
- T3: sweep pochodzi z `Wed Jun 17 18:57:25 2026 -0500`, dokładnie `10297` commitów przed markerem; okolica `MeetingHub.tsx:1165-1177` była już naprawiona.
- T4: diff dyżuru 194 pokazał dokładnie: server test, `MeetingObjectPage.tsx`, jego test; brak `MeetingHub.tsx`.
- T5: `MeetingHub.tsx:58,560,1000` potwierdził `attendees: string[]` i `join`; pole jest wolnym tekstem.

Korekta wobec instrukcji: dokładny grep `users.find(u => u.id === meeting.createdBy)` zwrócił 0, ponieważ kod ma nawiasy: `MeetingObjectPage.tsx:1120` — `users.find((u) => u.id === meeting.createdBy)`. Teza merytoryczna została potwierdzona, różniła się tylko literalna składnia wzorca.

## 2. R1 — świeży kompletny inwentarz

Pomiar AST na aktualnym `MeetingHub.tsx` znalazł `116` call-site'ów `t()` i `0` brakujących wartości PL oraz `0` brakujących wartości EN. Po deduplikacji klucza poniższa tabela obejmuje wszystkie teksty produktowe angielskie w tym pliku. Kategoria B = **0**.

Jedyny literal produktowy bez `t()` przed zmianą był w podglądzie: `Property` / `Value` (`MeetingHub.tsx:1031-1032`) — kategoria A. Po R2 ma klucze `meeting.preview.*` i jest kategorią C.

| Tekst EN / klucz | Lokalizacja | Kat. | Dowód PL |
|---|---:|:---:|---|
| Failed to load meetings / `meeting.errors.loadFailed` | 148,149 | C | Nie udało się załadować spotkań |
| Meetings / `meeting.tabs.all` | 307 | C | Spotkania |
| Meeting / `meeting.columns.title` | 333 | C | Spotkanie |
| No location / `meeting.noLocation2` | 339,1028 | C | Bez lokalizacji |
| When / `meeting.columns.when` | 346 | C | Termin |
| Attendees / `meeting.columns.attendees` | 357,998 | C | Uczestnicy |
| Status / `meeting.columns.status` | 366 | C | Status |
| Scheduled / `meeting.status.scheduled` | 372,403,973 | C | Zaplanowane |
| Completed / `meeting.status.completed` | 377,400,970 | C | Zakończone |
| Past — needs update / `meeting.status.pastNeedsUpdate` | 402,972 | C | Po terminie — wymaga aktualizacji |
| Follow-ups / `meeting.columns.followUps` | 411,1005 | C | Follow-upy |
| All / `meeting.counters.all` | 428 | C | Wszystkie |
| Upcoming / `meeting.counters.upcoming` | 435,444 | C | Nadchodzące |
| Past — needs update / `meeting.counters.pastNeedsUpdate` | 453,462 | C | Po terminie — wymaga aktualizacji |
| Needs follow-up / `meeting.counters.followUp` | 468,477 | C | Wymaga follow-upu |
| Completed / `meeting.counters.completed` | 483,492 | C | Zakończone |
| Operator brief / `meeting.actions.operatorBrief` | 525,528 | C | Brief operatora |
| Meeting updated / `meeting.notifications.updated` | 592 | C | Zaktualizowano spotkanie |
| Failed to update meeting / `meeting.errors.updateFailed` | 595 | C | Nie udało się zaktualizować spotkania |
| Meeting created / `meeting.notifications.created` | 607 | C | Utworzono spotkanie |
| Failed to create meeting / `meeting.errors.createFailed` | 610 | C | Nie udało się utworzyć spotkania |
| Meeting deleted / `meeting.notifications.deleted` | 624 | C | Usunięto spotkanie |
| Failed to delete meeting / `meeting.errors.deleteFailed` | 627 | C | Nie udało się usunąć spotkania |
| Failed to update meeting status / `meeting.errors.statusFailed` | 644 | C | Nie udało się zaktualizować statusu spotkania |
| Meeting note proposed for human approval / `meeting.notes.notifications.proposed` | 689 | C | Notatka ze spotkania zgłoszona do zatwierdzenia przez człowieka |
| Failed to generate notes / `meeting.notes.errors.generateFailed` | 693 | C | Nie udało się wygenerować notatek |
| Could not load meeting note proposals. / `meeting.notes.errors.loadFailed` | 713 | C | Nie udało się załadować propozycji notatek ze spotkania. |
| Meeting note approved and materialized / `meeting.notes.approved` | 743 | C | Notatka ze spotkania zatwierdzona i zmaterializowana |
| Meeting note rejected / `meeting.notes.rejected` | 744 | C | Notatka ze spotkania odrzucona |
| This proposal changed. Reloading the authoritative state. / `meeting.notes.stale` | 752 | C | Ta propozycja się zmieniła. Ładuję aktualny stan. |
| Could not update the proposal. / `meeting.notes.errors.decisionFailed` | 753 | C | Nie udało się zaktualizować propozycji. |
| Mark scheduled / `meeting.markScheduled` | 781,919 | C | Oznacz jako zaplanowane |
| Mark completed / `meeting.markCompleted` | 782,920 | C | Oznacz jako zakończone |
| AI Notes / `meeting.aiNotes` | 791 | C | Notatki AI |
| New meeting / `meeting.actions.new` | 844,895 | C | Nowe spotkanie |
| Loading workspace / `meeting.sync.loading` | 852 | C | Ładowanie przestrzeni |
| Shared workspace / `meeting.sync.workspace` | 855 | C | Wspólna przestrzeń |
| No meetings yet / `meeting.empty` | 890 | C | Brak spotkań |
| Schedule your first meeting to start tracking agendas and follow-ups. / `meeting.emptyState.description` | 891 | C | Zaplanuj pierwsze spotkanie, aby śledzić agendę i follow-upy. |
| Open / `common.open` | 908 | C | Otwórz |
| Coming soon (backend) / `common.comingSoonBackend` | 937 | C | Wkrótce (backend) |
| Meeting / `meeting.meetingLabel` | 960 | C | Spotkanie |
| Agenda / `meeting.agenda` | 1013 | C | Agenda |
| Decisions / `meeting.decisions2` | 1020 | C | Decyzje |
| Location / link / `meeting.fields.location` | 1027,1117 | C | Lokalizacja / link |
| Property / `meeting.preview.propertyLabel` | 1031 | A→C | Właściwość |
| Value / `meeting.preview.valueLabel` | 1032 | A→C | Wartość |
| Could not load the operator brief. / `meeting.operatorBriefError` | 1048 | C | Nie udało się załadować briefu operatora. |
| Project / `meeting.project` | 1073 | C | Projekt |
| Edit meeting / `meeting.modal.editTitle` | 1093 | C | Edytuj spotkanie |
| Create meeting / `meeting.modal.title` | 1094 | C | Utwórz spotkanie |
| Agenda + pre-read + follow-up workspace / `meeting.modal.subtitle` | 1097 | C | Agenda + materiały + follow-upy |
| Title / `meeting.fields.title` | 1110 | C | Tytuł |
| Start / `meeting.fields.start` | 1124 | C | Początek |
| End / `meeting.fields.end` | 1132 | C | Koniec |
| Attendees, one per line / `meeting.fields.attendees` | 1140 | C | Uczestnicy, jeden na linię |
| Pre-read links, one per line / `meeting.fields.preRead` | 1147 | C | Materiały do przeczytania, jeden link na linię |
| Agenda items, one per line / `meeting.fields.agenda` | 1155 | C | Punkty agendy, jeden na linię |
| Meeting details are stored in the shared workspace. / `meeting.modal.note` | 1167 | C | Szczegóły spotkania są zapisywane we wspólnej przestrzeni. |
| Cancel / `common.cancel` | 1175,1466 | C | Anuluj |
| Title and start time are required / `meeting.modal.requiredHint` | 1187 | C | Tytuł i czas rozpoczęcia są wymagane |
| Save changes / `meeting.actions.save` | 1193 | C | Zapisz zmiany |
| Create meeting / `meeting.actions.create` | 1194 | C | Utwórz spotkanie |
| AI Meeting Notes / `meeting.aiMeetingNotes2` | 1208 | C | Notatki AI ze spotkania |
| Recording and automatic transcription are OFF. / `meeting.notes.captureOff` | 1223 | C | Nagrywanie i automatyczna transkrypcja są WYŁĄCZONE. |
| Only text pasted manually is processed. Nothing becomes a decision or follow-up before human approval. / `meeting.notes.manualTextOnly` | 1225 | C | Przetwarzany jest wyłącznie tekst wklejony ręcznie. Nic nie staje się decyzją ani follow-upem przed zatwierdzeniem przez człowieka. |
| Meeting source text / `meeting.notes.manualSourceText` | 1232 | C | Tekst źródłowy spotkania |
| Paste meeting text to prepare a governed note proposal / `meeting.notes.manualSourcePlaceholder` | 1235 | C | Wklej tekst spotkania, aby przygotować nadzorowaną propozycję notatki |
| Governed note proposals / `meeting.notes.proposals` | 1245 | C | Nadzorowane propozycje notatek |
| No meeting note proposals yet. / `meeting.notes.noProposals` | 1256 | C | Brak jeszcze propozycji notatek ze spotkania. |
| Meeting note proposal / `meeting.notes.untitled` | 1273 | C | Propozycja notatki ze spotkania |
| Materialized / `meeting.notes.materialized` | 1292 | C | Zmaterializowana |
| Rejected / `meeting.notes.rejectedState` | 1294 | C | Odrzucona |
| Awaiting approval / `meeting.notes.awaitingApproval` | 1295 | C | Oczekuje na zatwierdzenie |
| Reject / `meeting.notes.reject` | 1307 | C | Odrzuć |
| Saving… / `common.saving` | 1316 | C | Zapisywanie... |
| Approve and materialize / `meeting.notes.approve` | 1317 | C | Zatwierdź i zmaterializuj |
| Approval requires an active organization owner or administrator. / `meeting.notes.approvalRequiresAdmin` | 1322 | C | Zatwierdzenie wymaga aktywnego właściciela lub administratora organizacji. |
| Materialization receipt / `meeting.notes.receipt` | 1330,1360 | C | Potwierdzenie materializacji |
| Decision reason / `meeting.notes.decisionReason` | 1336 | C | Powód decyzji |
| Notes generated by keyword extraction — AI unavailable / `meeting.notesGeneratedByKeywordExtractionAi2` | 1349 | C | Notatki wygenerowane ekstrakcją słów kluczowych (AI niedostępne) |
| Summary / `meeting.summary2` | 1354 | C | Podsumowanie |
| Key points / `meeting.keyPoints2` | 1367 | C | Kluczowe punkty |
| Approved proposed decisions / `meeting.notes.approvedDecisions` | 1380 | C | Zatwierdzone proponowane decyzje |
| Proposed decisions — not saved as decisions / `meeting.notes.proposedDecisions` | 1381 | C | Proponowane decyzje — niezapisane jako decyzje |
| Approved proposed action items / `meeting.notes.approvedActions` | 1398 | C | Zatwierdzone proponowane działania |
| Proposed action items — not saved as follow-ups / `meeting.notes.proposedActions` | 1399 | C | Proponowane działania — niezapisane jako follow-upy |
| Back to proposals / `meeting.notes.backToProposals` | 1426 | C | Wróć do propozycji |
| Close / `common.close` | 1427 | C | Zamknij |
| Generating... / `meeting.generating2` | 1437 | C | Generuję... |
| Generate notes / `meeting.generateNotes2` | 1437 | C | Wygeneruj notatki |
| Delete meeting / `meeting.delete.title` | 1449 | C | Usuń spotkanie |
| This permanently removes the meeting, its decisions, follow-ups, meeting notes, and any pending note proposals. This cannot be undone. / `meeting.delete.confirm` | 1453 | C | To trwale usuwa spotkanie, jego decyzje, follow-upy, notatki ze spotkania i oczekujące propozycje notatek. Tej operacji nie można cofnąć. |
| Delete meeting / `meeting.delete.action` | 1475 | C | Usuń spotkanie |
| Previous month / `meeting.previousMonth` | 1560 | C | Poprzedni miesiąc |
| Today / `meeting.today` | 1570 | C | Dziś |
| Next month / `meeting.nextMonth` | 1575 | C | Następny miesiąc |
| more / `meeting.more` | 1639 | C | więcej |

Daty, nazwa miesiąca i dni tygodnia nie są brakującymi literalami: `MeetingCalendarView` wylicza je przez `toLocaleDateString`/`toLocaleTimeString` z `pl-PL`; runtime pokazał `wrzesień 2026`, `pon.`, `wt.`, …, `niedz.`.

### Sluggi / identyfikatory uczestników

Znaleziono realny residual w zakresie renderu `MeetingHub.tsx:999-1000`: preview pokazuje elementy `selectedMeeting.attendees.join(', ')`. Fixture zwrócił `w3-mtg-owner-user-v1`, `w3-mtg-admin-user-v1`, `w3-mtg-member-user-v1`. Pole jest wolnym `string[]`; w `MeetingHub.tsx` nie istnieje API/resolver ID→nazwa. Jedyny resolver rosteru dotyczy `createdBy` w wyłączonym `MeetingObjectPage.tsx:1120`. Werdykt: **DO_ZBUDOWANIA / DO ROZWAŻENIA PRZEZ DYŻUR 194 LUB NASTĘPCĘ**; brak prowizorki zgodnie z Z40.

## 3. R2 — wykonanie

Commit `a1cdaacf79e59175a407c8a5c19ffd4ce8557862`:

- zastąpił manualną gałąź `isPolish ? ... : ...` wywołaniami `t('meeting.preview.propertyLabel')` i `t('meeting.preview.valueLabel')`;
- dodał wyłącznie nowe klucze `meeting.preview.propertyLabel/valueLabel` w PL i EN;
- nie zmienił żadnej istniejącej wartości locale;
- dodał trzy testy `day202.*` w dozwolonej ścieżce.

Push wykonano bezpośrednio po commicie na `github-backup/codex/day202-spotkania-i18n-20260831`.

### Dowód mutacyjny Z32

- stan zielony: `day202-focused-green.json`, `3/3 PASS`;
- mutant: przywrócono stare literalne gałęzie w produkcie; `MUTANT_EXIT=1`, test `uses translation keys for preview property headers instead of language branches` był czerwony;
- przywrócenie z `/private/tmp/cx-day202-spotkania-i18n-scratch/MeetingHub.tsx.green`: `RESTORED_EXIT=0`, `3/3 PASS`, `git diff --check` bez błędu.

## 4. §0.4a — pomiar zasięgu nazwami

Przed: `34` pełne nazwy, 14 suite raportowanych, wszystkie PASS.  
Po: `37` pełnych nazw, 16 suite raportowanych, wszystkie PASS.

`diff przed-nazwy.txt po-nazwy.txt`:

```diff
+day202 MeetingHub i18n > keeps every critical MeetingHub key non-empty and in PL/EN parity
+day202 MeetingHub i18n > resolves the cited runtime strings in Polish after an explicit language change
+day202 MeetingHub i18n > uses translation keys for preview property headers instead of language branches
```

Nazwy zniknięte: **0**.

Pułapki Z33: pakiet jest czysto jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`), nie mierzy Gateway/auth/DB; (a)–(d) nie leżą na jego ścieżce. Pułapka (e) jest celem testu: jawne `i18n.changeLanguage('pl')` rozwiązało przytoczone klucze do PL.

## 5. R3 — kanoniczny runtime i zrzuty

Manifest `/private/tmp/consultify-wave3-runtime-manifest-day202.json`: exact SHA `a1cdaacf79…`, fingerprint pustego diffa, health/ready/frontend `200`, client marker potwierdzony, `870` migracji, fixture `W3-MEETINGS-OWNER-v1`, auth bypass OFF.

Język wymuszono przed właściwym renderem przez `localStorage['i18nextLng']='pl'`; odczyt po reloadzie: `{lng:'pl', htmlLang:'pl'}`. Motywy przełączono jawnie przez UI `Jasny` / `Ciemny`.

| Zrzut | SHA-256 |
|---|---|
| `lista-pelna-jasny.png` | `0b4f9e8da21ec8958a34958f222f68272ba69f6d78fb52526fadf98afffc347d` |
| `lista-pelna-ciemny.png` | `ca3d216621ec2664c068d7952b81af7fe509b0588841528ec9598fa156b4c197` |
| `kalendarz-jasny.png` | `4baccc508a1fa18e7c35050cf327cd37689ace4ff9c3d79ffeb37577bcc508fb` |
| `kalendarz-ciemny.png` | `13ce54d8bb8c3fd57a8858625a49637a98e19ce0474283a61d949b629653057a` |
| `podglad-brief-jasny.png` | `b7f68663998ea15725c2f6e848c508715dc4c1a34678ab7a8b347ceaab77edc2` |
| `podglad-brief-ciemny.png` | `2f4c3b395030c048534b59e1a26f199f1eadfab9bf319a4ee71d2d426c05a5f9` |
| `lista-pusta-filtr-jasny.png` | `c21cdb054bf2c388773d05f1d59c475d3b151018c39163536df36ee8dd76e25b` |
| `lista-pusta-filtr-ciemny.png` | `c88a272bd1f292ad662547937466a122e45a837476f2c418ff502b4c2d774df1` |

Pełna lista i kalendarz mają polskie etykiety; preview pokazuje `Właściwość`, `Wartość` i polski uczciwy błąd `Nie udało się załadować briefu operatora.`. Nie ma angielskich tekstów kategorii A/B z R1.

Residual poza licencją: osiągalny pusty stan przez filtr `Nadchodzące 0` pokazuje `Filters`, `Clear all`, `No items found`. DOM wskazuje współdzielony `StandardTable`, a nie literal w `MeetingHub.tsx`. Nie zmieniono pliku poza licencją; rekomendacja: osobny tor i18n dla `StandardTable`.

## 6. Z30 — zero wysyłki

Przed zapisem i przed runtime: `BRAK ZMIENNYCH POCZTY`; tabela `settings` miała `0 rows` dla `smtp%`; `Gateway.ts` nie montował drenów. Po starcie wszystkie 5 PID-ów należących do runtime miało `MAIL_ENV_ABSENT`; log serwera: `BRAK PROBY TRANSPORTU POCZTY W LOGU`.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.

## 7. TWIERDZENIA NIEZWERYFIKOWANE

- Nie udowodniono sukcesu dostarczenia treści operator briefu; lokalny runtime zwrócił uczciwy stan błędu. Udowodniono natomiast, że dokładnie cytowany error renderuje po polsku.
- Nie rozstrzygnięto produktowej polityki, czy `attendees` ma pozostać wolnym tekstem czy przejść na referencje użytkowników. Brak tej decyzji i resolvera uniemożliwia bezpieczną naprawę surowych ID w tym dyżurze.
- Nie naprawiono angielskich tekstów pustego stanu ze współdzielonego `StandardTable`, bo plik nie leży w licencji.

## 8. Pliki repo dotknięte względem markera

```text
public/locales/en/translation.json
public/locales/pl/translation.json
src/components/Meeting/MeetingHub.tsx
tests/unit/i18n/day202.meetingHub-i18n.test.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY202_SPOTKANIA_I18N_REPORT.md
```
