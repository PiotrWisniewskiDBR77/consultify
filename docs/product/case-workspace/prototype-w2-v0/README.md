# Case Workspace — prototyp W2-V0 (Stream D)

**Status: PROTOTYP NIEPRODUKCYJNY. NIE POKAZANY PIOTROWI. Nie jest to gotowa specyfikacja ani kod
produkcyjny.** Zbudowany do przeglądu wewnętrznego przed jakąkolwiek prośbą o
`OWNER_PROTOTYPE_APPROVAL_REF`, zgodnie z CLAUDE.md regułą #7 (Piotr nigdy nie jest pierwszym
testerem wizualnym) i regułą #9 (zakaz bespoke tabel — ekrany listowe w tym prototypie wizualnie
naśladują StandardModuleBar/StandardTable/StandardPreview, nie wymyślają własnego języka wizualnego).

## Co to jest

Statyczne mockupy HTML/CSS/JS (bez logowania, bez danych produkcyjnych, bez builda) dla modułu
Zlecenia (Case Workspace):

1. **Zlecenia — lista** (`screens/zlecenia-list.html`) — SPEC-L wg `docs/ui-standards/TRIADA_KANON.md`
   i `docs/ui-standards/MY_WORK_TABLE_SURFACE_CONTRACT_V1.md`.
2. **Pełne Zlecenie — powłoka artefaktu** (`screens/zlecenie.html`) — SPEC-A Archetyp C (Rekord),
   klasa L, wg `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` §10.2/§11.2/§13.1. Zakładki:
   Przegląd · Plan (Prosty/Ekspercki/Lista — trzy projekcje jednego `semantic_graph`) · Realizacja
   (postęp, uwaga, blokady/oczekiwania, approval cards) · Rezultaty (decyzje/dostawy/wartość jako
   obiekty domenowe) · Powiązania · Aktywność. Zawiera zamockowane przejście „Powrót do zlecenia” po
   otwarciu dostawy.
3. **Zlecenie nieznalezione / brak dostępu** (`screens/not-found.html`) — enumeration-safe: ten sam
   ekran dla nieistniejącego ID i dla ID bez uprawnień.

Start: otwórz `index.html` (link do wszystkich ekranów + przełącznik motywu).

## Zgodność z realnymi kształtami danych

Nazwy pól, enumy i stany (case_status, governance_tier, autonomy_policy, closure axes, plan version
status, typy węzłów grafu, action proposal status, wait type/status, artifact link relation, value
measurement status) są przepisane z `server/src/services/caseWorkspace/*.ts` na gałęzi
`claude/case-workspace-v1-20260809` (czytane przez `git show`, nigdy nie ściągnięte do tego
worktree — poza allowlistem strumienia). Treść przykładowa jest fikcyjna.

## Struktura katalogu

```
prototype-w2-v0/
├── index.html                    — hub nawigacyjny
├── README.md                     — ten plik
├── DECISIONS.md                  — lista decyzji nieoczywistych do akceptu właściciela
├── css/
│   ├── tokens.css                — tokeny kolorów/typografii/radiusów (light+dark), z TRIADA_KANON §C1
│   └── shell.css                 — komponenty powłoki (Menu1/2/3, tabela, preview, prawy panel accordion)
├── js/
│   └── app.js                    — przełącznik motywu/stanu/zakładki (parametry URL + przyciski)
├── screens/
│   ├── zlecenia-list.html
│   ├── zlecenie.html
│   └── not-found.html
└── evidence/
    ├── SCREENSHOT_INDEX.md       — mapowanie 116 zrzutów → ekran/viewport/motyw/stan
    └── screenshots/*.png
```

## Jak przeglądać

- Lokalnie: `python3 -m http.server` z tego katalogu, otwórz `http://localhost:<port>/index.html`.
- Sterowanie stanem/motywem: pasek deweloperski (czerwono-czarne paski, widoczny WYŁĄCZNIE w
  prototypie — nie jest częścią projektu) na górze każdego ekranu, albo parametry URL
  `?theme=light|dark&state=default|empty|loading|error|stale|partial|blocked&tab=...&view=...`.
- Zrzuty: `evidence/screenshots/`, indeks w `evidence/SCREENSHOT_INDEX.md`.

## Dalej

Pełna lista decyzji wizualnych/interakcyjnych do potwierdzenia przez właściciela — w tym otwarte
pytania, których świadomie NIE rozstrzygnąłem sam — jest w [`DECISIONS.md`](./DECISIONS.md).
