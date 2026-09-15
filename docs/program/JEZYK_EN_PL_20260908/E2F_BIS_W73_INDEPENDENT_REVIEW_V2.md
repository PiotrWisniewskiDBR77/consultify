# Independent review v2 — K1 E2f-bis W73

**Werdykt: ACCEPT. Bloker P1 z review `21479faf33` jest zamknięty: efektywny skaner K4obj obejmuje dokładnie siedem ujść W73, a powtórzony pomiar nie zawiera trzech wskazanych fałszywych trafień.**

Kandydat produktu: `89ee194801`  
Freeze: `775947993ef96b1fcbd4e96fa725a48bae9dc7b3`  
Baza: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`

## Zamknięcie wcześniejszego HOLD

- `pomiar-jezyka.wyjatki.json` zawiera dokładnie: `label`, `title`,
  `placeholder`, `header`, `description`, `tooltip`, `emptyText` (7/7).
- `text`, `name`, `message`, `summary`, `tab` i pozostałe dodatkowe pola nie
  uczestniczą w K4obj.
- Pełny raport na freeze daje `K4obj=4343`, `K4objPL=711`; odrzucony kandydat
  dawał odpowiednio 5375 i 866.
- W raporcie nie występują wcześniejsze błędy:
  `AIActionCard.tsx:96`, `sharedActions.ts:472`, `tableActions.ts:1702`.
- Regresje przypinają zarówno klasę Tailwind w `text:`, jak i techniczne unie
  enumów w `description:`.

## Próba precyzji

Test detektora powtarza wymagane 30/30: 30 angielskich etykiet rozpoznanych i
30 polskich, nazw własnych lub dwuznacznych napisów poprawnie pominiętych.
Niezależnie obejrzałem próbkę z realnego drzewa: 30 trafień K4obj i 30
poprawnie pominiętych ujść już przechodzących przez `t()`.

| Moduł | 10 trafień obejrzanych ręcznie | 10 poprawnych pominięć obejrzanych ręcznie |
|---|---|---|
| Execution | `BudgetControlPanel.tsx:95-97`; `ExecutionBankViews.tsx:698-699,968,984,992`; `ExecutionHub.tsx:4814,4850` | `executionBankPreviewDeclaration.tsx:174,209,227,247,262,267,274,282,288,294` |
| Settings | `HelpSidePanel.tsx:45-46`; `GoalSelector.tsx:44-45,55-56,67-68,77-78` | `AIPreferencesModule.tsx:126,131,136,141,146,151`; `AppearanceModule.tsx:69-71,271` |
| Initiatives | `InitiativeCard.tsx:154-157,162,164,166,168`; `InitiativeDetailModal.tsx:996,1341` | `InitiativeDocumentView.tsx:6928,6933,6938,6943,6948,6953,6958,6963,6968,6973` |

Wszystkie 30 raportowanych trafień są tekstami widocznymi dla człowieka.
Wszystkie 30 pominięć są już obsługiwane przez tłumaczenie, więc nie powinny
powiększać mianownika. W tej próbce precyzja obu decyzji wynosi 30/30.

## Powtórzone dowody

- Focus: `pomiar-jezyka.e2f-bis.test.mjs` — 68/68 PASS, `--retry=0`.
- Warstwy + klasyfikacja — 14/14 PASS (9 + 5), `--retry=0`.
- Pełny raport: `K8spl=95`, `K8sen=3183`, `K10dPL=0`, `K10dROZ=2`,
  `K11=1`.
- `npm run check:jezyk:ci` — PASS, bez wzrostu ratchetu.
- `npm run check:list-canon` — 349, baseline 349.
- `npm run check:artefakt` — 8 crimson, 0 R2/R3, 117 danger; bez wzrostu.
- Frontend TypeScript — 177 zastanych błędów, RC=2; osobne
  `--listFilesOnly` potwierdziło RC=0 i 7424 załadowane pliki. Połączony przebieg
  `--listFiles` przekroczył obowiązkowy limit 120 s, dlatego RC i lista plików
  zostały sprawdzone osobno.
- Server TypeScript — 0 błędów, RC=0.
- Build produkcyjny — RC=0 z `NODE_OPTIONS=--max-old-space-size=8192`, 10754
  moduły. Pierwszy przebieg na niepełnym `node_modules` autora nie miał
  `micromark-core-commonmark`; powtórzenie na kompletnej instalacji zależności
  przeszło.
- `git diff --check` — PASS; nowych `as any` — 0.

## Integralność freeze

`testedCandidate=89ee194801`; commit freeze `775947993e` dodaje wyłącznie
manifest. Wszystkie siedem niesamoreferencyjnych wpisów inwentarza ma zgodny
SHA-256 i Git blob z zawartością HEAD. Backup kandydata
`origin/backup/codex/a-k1-e2f-bis-20260915-v2` wskazuje dokładnie freeze.

Zakres nie zmienia UI produktu, serwera, migracji ani wdrożenia.

### P3 — utrzymanie

Lista ma dziś dokładnie siedem pól i ratchet broni jej rozszerzenia pośrednio,
ale kod nie waliduje jawnie zbioru siedmiu nazw. Przy kolejnej zmianie pliku
wyjątków należy zachować osobny pomiar precyzji wymagany komentarzem w skanerze.
