# A11y fix — 04_ASSESSMENT (dyżur „reszta", 2026-09-03)

Gałąź: `agent/fix-a11y-reszta-20260903`, worktree `/private/tmp/ag-fix-a11y-reszta`.

## Ekrany

1. `assessment-manage-panel` — mocked `AssessmentManagePanel`
   (`src/components/assessment/manage/AssessmentManagePanel.tsx`)
2. `assessment-report-contract` — mocked `AssessmentReportContractView`
   (`src/components/assessment/report/AssessmentReportContractView.tsx`)

## Tabela PRZED → PO (kadry z realnym naruszeniem)

| Ekran | Szerokość/język | PRZED light | PRZED dark | PO light | PO dark |
|---|---|---|---|---|---|
| assessment-manage-panel | pl-1440 | 2 (color-contrast + scrollable-region-focusable) | 1 (scrollable-region-focusable) | 0 | 0 |
| assessment-manage-panel | en-1024 | — (nie mierzone PRZED, poza zakresem) | — | 0 | 0 |
| assessment-report-contract | pl-1440 | 0 | 0 | 0 | 0 |
| assessment-report-contract | en-1024 | 1 (scrollable-region-focusable — ujawnia się DOPIERO przy węższej szerokości) | 1 | 0 | 0 |

## Korekta pomiaru (punkt 5 instrukcji)

Przy pl-1440 `assessment-report-contract` pokazał **0 naruszeń zarówno PRZED jak i PO**
— tabela macierzy (`min-w-[480px]`) mieści się w kolumnie rozdziału przy tej
szerokości (celowy fix P1-3 z dnia-27, komentarz w kodzie). Naruszenie
`scrollable-region-focusable` ujawnia się dopiero przy węższej szerokości
(en-1024, zmierzone bezpośrednio) — tabela wtedy realnie przewija się poziomo.
To jest realny defekt (potwierdzony bezpośrednim pomiarem przy 1024px, nie
domysł) — naprawiony mimo że nie widać go w pl-1440. Liczba w instrukcji
(„2/8") pasuje do tego zjawiska: naruszenie jest obecne w części kadrów matrycy
(węższe szerokości), nie we wszystkich.

## Naprawy (reguła → komponent → plik)

| Reguła | Komponent | Plik | Co zmieniono |
|---|---|---|---|
| color-contrast | Tekst powodu bramki (`req.reason`, „Uzupełnienie: 82%…") w popoverze „Gate Requirements" — `text-slate-500` na TRZECH możliwych tłach odznaki (danger-50/emerald-50/amber-50), wszystkie 4.30–4.46:1 (< 4.5) | `src/components/assessment/manage/WorkflowStagesTable.tsx` (linia ~550) | `text-slate-500` → `text-slate-600` (6.85–7.11:1 na wszystkich trzech tłach); `dark:text-slate-400` bez zmian |
| scrollable-region-focusable | Popover „Gate Requirements" (`max-h-80 overflow-y-auto`, absolutnie pozycjonowany, bez dostępu klawiaturą) | jw. (linia ~492) | `tabIndex={0}` + `role="region"` + `aria-label` (reużyty klucz i18n tytułu sekcji) |
| scrollable-region-focusable | Tabela macierzy osi (`overflow-x-auto`, realnie przewijana przy węższych szerokościach) | `src/components/assessment/report/AssessmentReportContractView.tsx` (funkcja `Matrix`, linia ~135) | `tabIndex={0}` + `role="region"` + `aria-label` (nowy klucz `assessment.reportView.matrix.regionLabel`, pl+en, przetłumaczony) |
| React ostrzeżenie „two children with the same key" (nie axe, ale zlecone do naprawy — realny błąd renderu) | **Przyczyna: mock harnessu, NIE produkt.** `WorkflowStagesTable.tsx` ma sztywny wymóg `key: 'completion'` (DoD) i poprawnie filtruje duplikat API po `c.key !== 'dod'` — realny backend (`server/src/routes/assessment-workflow-v2.routes.ts:558`) zawsze zwraca `key: 'dod'`, więc w PRODUKCJI kolizji nigdy nie ma. Mock dev-render (`dev-render/screens/assessment-manage-panel.tsx`) miał `key: 'completion'`/`'confidence'` — niezgodne z realnym kontraktem API (który zwraca `auth`/`role`/`dod`/`sod`) — więc filtr nigdy nie usuwał duplikatu i React dostawał dwa elementy z `key="completion"`. | `dev-render/screens/assessment-manage-panel.tsx` | `MOCK_ELIGIBILITY.checks` przepisany na realny kształt API: `auth`/`role`/`dod`/`sod` (zamiast `completion`/`confidence`) — mock teraz odpowiada faktycznemu kontraktowi, ostrzeżenie znika, bo już nie jest reprodukowalne (nigdy nie było reprodukowalne w produkcji) |

Kontrast liczony wg WCAG relative-luminance (jak axe `color-contrast`); wartości
w komentarzach przy każdej zmianie w kodzie.

## Weryfikacja „ostrzeżenie zniknęło" (nie tylko axe)

`node -e` po PO pl-1440: filtr komunikatów konsoli po `/same key/i` na obu
motywach `assessment-manage-panel` → pusta tablica (brak dopasowań).

## Komendy (odtwarzalność)

```
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5333 \
  --ekrany=assessment-manage-panel,assessment-report-contract \
  --katalog=04_ASSESSMENT-po-pl1440 --faza=PO --jezyk=pl --szerokosc=1440 \
  --motywy=light,dark --rozwin-sekcje=1 --a11y=1 \
  --wyjscie=/private/tmp/ag-fix-a11y-reszta-artefakty/04_ASSESSMENT/po-pl-1440 \
  --wynik-json=/private/tmp/ag-fix-a11y-reszta-artefakty/04_ASSESSMENT/po-pl-1440/wynik.json

node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5333 \
  --ekrany=assessment-manage-panel,assessment-report-contract \
  --katalog=04_ASSESSMENT-po-en1024-v2 --faza=PO --jezyk=en --szerokosc=1024 \
  --motywy=light,dark --rozwin-sekcje=1 --a11y=1 \
  --wyjscie=/private/tmp/ag-fix-a11y-reszta-artefakty/04_ASSESSMENT/po-en-1024-v2 \
  --wynik-json=/private/tmp/ag-fix-a11y-reszta-artefakty/04_ASSESSMENT/po-en-1024-v2/wynik.json
```

Surowe dane (poza repo):
`/private/tmp/ag-fix-a11y-reszta-artefakty/04_ASSESSMENT/{przed-pl-1440,po-pl-1440,po-en-1024,po-en-1024-v2}/wynik.json`
i towarzyszące `*.png`.

## Pliki produktu zmienione

- `src/components/assessment/manage/WorkflowStagesTable.tsx`
- `src/components/assessment/report/AssessmentReportContractView.tsx`
- `dev-render/screens/assessment-manage-panel.tsx` (harness — poprawiony mock, nie ekran produktu)
- `public/locales/pl/translation.json`, `public/locales/en/translation.json`

Weryfikacja składni: `npx esbuild <plik> --loader:.tsx=tsx --jsx=automatic` na
wszystkich 3 plikach `.tsx` — exit 0. JSON obu lokalizacji — OK.

## Nienaprawione / nierozstrzygnięte

Brak. Oba ekrany: 0 realnych naruszeń axe na pl-1440 i en-1024, oba motywy;
ostrzeżenie React o zduplikowanym kluczu zweryfikowane jako zniknięte.
