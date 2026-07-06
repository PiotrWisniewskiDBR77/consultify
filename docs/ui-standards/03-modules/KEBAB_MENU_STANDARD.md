# Kebab (RowActionsMenu) — standard menu wierszy

SSOT dla menu akcji wiersza/karty w całej aplikacji. Uzupełnia `TABLE_AND_PREVIEW_CANON.md` §9.
Komponent: `src/components/shared/RowActionsMenu.tsx`. Potwierdzone surveyem 2026-07-06
(My Work + Interview + Initiatives + Execution).

## 1. Struktura — 3 bloki, zawsze w tej kolejności
Kebab renderuje sekcje z separatorem między nimi, w stałym porządku:

| Blok (`kind`) | Pozycja | Charakter | Zawartość |
|---|---|---|---|
| `context` | GÓRA | KONTEKSTOWY (wg stanu/roli encji) | primary action + akcje stanu |
| `manage` | ŚRODEK | STAŁY | Open preview · Edit · Archive/Restore · Delay |
| `danger` | DÓŁ | STAŁY | Delete / Reject / Move to trash (crimson, zawsze ostatni) |

Bloki `open`/`ai`/`convert`/`output` — TYLKO dla encji-artefaktów (Idea): bogate konwersje
(Initiative/Task/Decision/Chat) + generowanie output. Reszta encji używa wyłącznie context/manage/danger.

REGUŁA ARCHITEKTURY: używać `RowActionSection[]` z `kind` (nie płaskiej `RowAction[]`), żeby
grupowanie i separatory były spójne. Migracja długu: Gate, Rollout items, Execution Problem
(dziś płaskie) → sekcje+kind.

## 2. STAŁE akcje (identyczne wszędzie — powtarzają się ≥4/6 encji)
- **Open preview** (manage) — 6/6, ChevronRight, otwiera prawy panel/preview
- **Edit** (manage) — 5/6, Edit2
- **Archive / Restore** (manage) — 4/6, wg lifecycle (active↔archived↔trash)
- **Delete / Reject** (danger) — 6/6, crimson, ostatni, z potwierdzeniem

## 3. KONTEKSTOWE akcje (wg stanu encji — pokazywać warunkowo)
| Encja | Akcje kontekstowe (context, góra) | Warunek |
|---|---|---|
| Task | Complete/Reopen · Status(To do/In progress/Blocked) · Accept Today/Snooze | isNew → triage |
| Inbox | Open · Apply AI · Focus→Today/Week/Later · Done · Save · Snooze 1h/4h/1d/3d | suggestedAction → Apply AI |
| Decision | Approve · Reject (Pending) │ Remind · Escalate (Awaiting) | isPending; overdue→Escalate danger |
| Idea | Open · Process Flow │ AI Chat/Insights │ Convert: Initiative/Task/Decision/Chat │ Output | artefakt |
| Notification | View Details · Open Chat · Mark as Read · Go to Source | wg unread/linked |
| Interview Session | Approve · Send back · Remind · Generate AI insights | submitted/approved |
| Interview Template | Use · Assign · Clone · View usage · Set/Unset default | canAssign |
| Interview Assignment | Start/Continue/Fix&Resubmit (assignee) · Approve/Send back/Reassign/Remind/Escalate (manager) | status+rola |
| Initiative | (brak — same stałe) | — |
| Execution item | Mark Complete/Blocked/Cancel · Mitigate/Escalate | dynamiczne z actions |

## 4. Reguły hinting (podpowiadania)
- WIDOCZNOŚĆ WG STANU: pokazuj tylko akcje możliwe w danym stanie (nie disabled-bez-powodu).
- POZYCJA STAŁA: Open preview/Edit/Archive zawsze w tym samym miejscu (manage) → mięśniowa pamięć.
- DISABLED-Z-NOTĄ: akcja niegotowa = `disabled:true` + `description:'Coming soon (backend)'` (PL: 'Wkrótce (backend)').
  Nigdy nie ukrywać stałej akcji — pokazać wyszarzoną z powodem.
- PRIMARY: górna akcja `variant:'primary'` (np. Open/Approve/Use). DANGER: ostatnia, crimson.
- i18n: wszystkie labelki przez `isPolish`/`t()`.

## 5. Rejestr luk backendu (do dokończenia — FAZA B, osobno)
Akcje dziś `Coming soon (backend)` (UI gotowe, brak backendu):
- Edit: Inbox, Notification, Interview Session
- Archive: Task, Decision, Idea, Notification, Initiative (warunkowo)
- Delete: Interview Assignment, Initiative (karta), Gate
- Delay (+1/+3/+7d): Task, Decision, Initiative
- Output (Presentation/Report/Table): Idea
Priorytetyzować i domykać encja po encji; do czasu — zostają jako świadome placeholdery.
