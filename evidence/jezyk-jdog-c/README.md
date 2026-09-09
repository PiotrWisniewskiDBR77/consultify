# J-DOG-C — dowód pracy (2026-09-09)

Paczka: J-DOG-C. Worktree: `/Users/piotrwisniewski/Developer/wt/jdog-c`, gałąź
`mvp/jdog-c-0909`, baza `c076e94405`. Zakres: moduły `01 Chat`, `03 Interview`,
`05 Assessment`, `06 Initiatives`, `07 Execution`, `08 Results`, `10 Materials`,
`11 Audits`, `12 Meeting`, `13 Organization` (bez modułów J-DOG-A/B).

## 1. Przyrząd

`scripts/i18n/polski-bez-ogonkow.mjs` — słownik polskich słów bez diakrytyków
zbudowany automatycznie z `public/locales/pl/translation.json` (rozbite na
słowa, zdjęte ogonki, odrzucone słowa ≥4 znaki które są też legalnym
angielskim tokenem w `en/translation.json`) + ręczna lista rdzeni z instrukcji
(`zapisz`, `anuluj`, `dalej`, …, plus rdzenie zmierzone w tej paczce: `kolor`,
`rozmiar`, `czcionk`, `kursyw`, `pogrubien`, `priorytet`, …). Skanuje:
`t('klucz', 'default')`, tekst JSX między `>`/`<`, atrybuty
`title/placeholder/aria-label/label`.

Poprawki narzędzia zrobione W TRAKCIE pomiaru (dowód, że nie jest to czarna
skrzynka — każda znaleziona wada opisana i naprawiona z uzasadnieniem):

1. **Fałszywe trafienie `status`/`import`→„important"** — słowo pasujące do
   ręcznego rdzenia, ale będące też całkiem legalnym angielskim tokenem
   (np. „Status" jako nagłówek kolumny). Naprawa: każde dopasowanie (auto
   ORAZ ręczne) sprawdzane jest teraz też przeciw słownikowi angielskiemu —
   jeśli całe słowo istnieje jako wartość w `en/translation.json`, nie liczy
   się jako polskie.
2. **Wieloliniowy JSX niewidoczny** — `<label>\n  Tekst\n</label>` (tag i
   treść w osobnych liniach) nie pasował do pierwotnego wzorca
   `>[ \t]*(...)[ \t]*<`. Naprawa: dopuszczono `\r\n` wokół przechwyconego
   tekstu (sam tekst musi zostać jednoliniowy, żeby nie łapać kodu rozlanego
   na wiele linii).
3. **Generyki TS i ternary jako fałszywe „tekst JSX"** — `NonNullable<X>`,
   `krok.wielokrotny ? (` też pasują do wzorca `>...<`. Naprawa: dodatkowy
   filtr odrzucający kandydatów w kształcie identyfikator/wyrażenie
   zakończone `?`/nawiasem albo czystym łańcuchem `a.b.c`.
4. **`t()` defaultValue z cudzysłowem innego typu w środku niewidoczny** —
   pierwotny wzorzec wykluczał OBA typy cudzysłowu z treści zamiast tylko
   ogranicznika, więc np. `'Załóż plan przyciskiem „Nowy plan" — …'`
   (ogranicznik `'`, w środku ASCII `"`) w ogóle nie dawał dopasowania.
   Naprawa: wykluczenie tylko ogranicznika przez negative lookahead
   (`(?!\3)[^\\]`), jak już robił wzorzec w bezpiecznikach źródłowych —
   znalazło **15 kolejnych realnych trafień** po tej poprawce (patrz §4).
5. **Komentarz JSX `{/* … */}` z wiodącym `{`** nie pasował do reguły
   „pomiń komentarz" (`^\s*(\/\/|\*|\/\*...)`), bo linia zaczyna się od `{`.
   Naprawa: dodano `\{\s*\/\*` do wzorca pomijania.

## 2. POMIAR PRZED → PO (przyrząd pomocniczy)

Zmierzone przez tymczasowy `git stash` samych śledzonych zmian (narzędzie
zostało jako plik nieśledzony, więc PRZED = realny stan sprzed napraw, PO =
finalny stan, ten sam przyrząd obie strony).

| Moduł           | plików | PRZED | PO |
|-----------------|-------:|------:|---:|
| 01 Chat          |    213 |   140 |  0 |
| 03 Interview     |     36 |     5 |  0 |
| 05 Assessment    |     95 |    69 |  2 |
| 06 Initiatives   |    139 |    96 |  0 |
| 07 Execution     |     75 |   148 |  0 |
| 08 Results       |    160 |     2 |  0 |
| 10 Materials     |    302 |   198 |  1 |
| 11 Audits        |     35 |     2 |  0 |
| 12 Meeting       |      5 |     0 |  0 |
| 13 Organization  |     33 |     5 |  0 |
| **SUMA**         |        |**665**| **3** |

Surowe wyjścia: `evidence/jezyk-jdog-c/przed.txt`, `evidence/jezyk-jdog-c/po.txt`.

**Kontrola niezależna** (przyrząd oficjalny projektu, `pomiar-jezyka.mjs`,
uruchomiony automatycznie w bramce J0 pre-commit na commit naprawy) potwierdza
spadek na SWOICH liczbach, licząc więcej kategorii niż mój przyrząd (K1def =
polski defaultValue, K2 = angielski w pliku pl, K3a/K3aKLUCZ = klucz tylko w
pl, K3b = klucz tylko w en, K4pl/K4en = tekst na sztywno w JSX, K7 = daty bez
locale):

```
K1def -816, K1defWID -117, K2 -1, K3a -689, K3aKLUCZ -161, K3b -3,
K4pl -601, K4en -212, K7 -306
```

(Te liczby są dużo większe niż 665, bo `pomiar-jezyka.mjs` liczy CAŁY diff
gałęzi względem bazy, nie tylko zakres J-DOG-C — obejmuje więc też K2/K3a/K3b/K7,
których mój przyrząd pomocniczy w ogóle nie mierzy.)

## 3. Pozostałe 3 trafienia — dlaczego zostają

1. **`src/components/assessment/reports/templates/DBR77ReportTemplate.tsx:219`**
   `<h3 className="font-bold text-primary-900 dark:text-primary-300">AUTOMATYZUJ</h3>` —
   linia niesie klasę `text-primary-*` (crimson, CLAUDE.md UI pkt 3). Komentarz
   w pliku (linia ~385, zostawiony przez paczkę J5) już dokumentuje: dotknięcie
   TEJ linii bramka TRIADA czyta jako NOWE naruszenie, bo klasa jest długiem
   zastanym (`scripts/check-triada.baseline.txt`) — zmiana koloru byłaby zmianą
   wizualną zamrożonego modułu bez akceptu właściciela. **Zostawione i zgłoszone**,
   nie naprawione — zgodnie z regułą „linia z crimsonem — zostaw i zgłoś".
2. **Ten sam plik, linia 392**: `<div className="text-primary-600/70">Stanowisk</div>` —
   identyczny powód, ten sam udokumentowany STOP (do rozstrzygnięcia razem
   z pozostałymi ~14 wystąpieniami `primary-*` w tym pliku, nie w paczce
   językowej).
3. **`src/views/docs/DocsSecurityView.tsx:259`**: `"Download Security Whitepaper"` —
   **fałszywy alarm** przyrządu. Cały napis jest angielski; słowo „whitepaper"
   trafiło do automatycznego słownika PL, bo w `pl/translation.json` istnieje
   gdzieś fraza z tym samym angielskim zapożyczeniem („Whitepaper") a w
   `en/translation.json` odpowiednik jest zapisany jako dwa słowa („White
   paper"), więc porównanie 1:1 tokenu nie wyłapało kolizji. Sprawdzone
   ręcznie, brak akcji.

## 4. Co naprawiono (kategorie i przykłady)

### 4.1 `t()` defaultValue: polski → angielski (klucz bez zmian)

**494** miejsc w pierwszym przebiegu (skryptowa, punktowa zamiana tekstu w
94 plikach — `plik:linia`, było→jest w `evidence/jezyk-jdog-c/przed.txt` vs
`po.txt`) + **15 kolejnych** znalezionych dopiero po naprawie #4 przyrządu
(cudzysłów innego typu w środku defaultValue):

- `UnifiedChatPanel.tsx:4566,4575,4601,4619,4645,4650` — 6 komunikatów toast
  o załącznikach czatu (np. `'Plik "{{name}}" przekracza limit...'` →
  `'File "{{name}}" exceeds the... limit.'`).
- `PlanScenarioSurface.tsx:1659`, `CapacityAnalysisCard.tsx:167,306,335`,
  `PortfolioListView.tsx:203` — 5 komunikatów Initiatives.
- `ValuationWorkspace.tsx:574,1776` — 2 komunikaty Results.
- `DocumentStudioQaPanel.tsx:113` — 1 podpowiedź Materials.
- `V8ArtifactRunControl.tsx` (×4: `formatPlanLabel`, preflight state, check
  label) i `SIRIReportTemplate.tsx` (legal notice) — znalezione dopiero
  rozszerzeniem bezpiecznika Chat/Assessment (§5), bo używają kluczy
  DYNAMICZNYCH (`` `v8.artifactRun.option.${plan.outputType}` ``) — mój
  przyrząd pomocniczy (jak i oryginalny `pomiar-jezyka.mjs`) wymaga klucza w
  kształcie identyfikatora i nie widzi klucza z interpolacją. **Znana luka
  narzędzia, udokumentowana, nie naprawiona w tym przebiegu** (niski koszt
  false-negative, wysoki koszt regexu akceptującego dowolny klucz).

Wszystkie klucze dotknięte tą kategorią zweryfikowane skryptem: 480/480
sprawdzonych miejsc miało klucz z poprawną wartością w OBU
`public/locales/{en,pl}/translation.json` (K1def = tylko miganie przed
załadowaniem pliku tłumaczeń, nie trwały brak) — poza 39 kluczami całkiem
nieobecnymi w `en` (i 29 z nich też nieobecnymi w `pl`), które dopisano
ręcznie (patrz §4.3).

### 4.2 Napis na sztywno w JSX / atrybucie → `t('nowyKlucz', 'English')`

**~130** miejsc w plikach: `AIActionCard.tsx`, `AgentWorkshopPalette.tsx`,
`EditableSpreadsheetGrid.tsx`, `AgentPlanPanel.tsx`, `WorkCanvasDocumentPanel.tsx`
(Chat); `AssessmentQualityReviewPanel.tsx`, `ReportEditor.tsx`,
`DRDAssessmentEditor.tsx`, `DrdHttpMethodWorkspaceScreen.tsx`,
`DrdMethodWorkspaceScreen.tsx`, `VersionHistoryPanel.tsx`, 4× szablony raportów
(ADMA/CMMI/DBR77/SIRI), 3× formularze narzędzi (Assessment); `PlanCard.tsx`
(Initiatives); `RolloutBaselinePanel.tsx` (Execution); `AuditHistoryView.tsx`
(Audits); `OrganizationDirectionConstraintsScreen.tsx`,
`OrganizationSourcesClaimsScreen.tsx` (Organization); ~25 plików w Materials
(`BlockToolbar.tsx`, `DeckAuditLogModal.tsx`, `TipTapEditor.tsx`,
`GapHeatmap.tsx`, `MetricCard.tsx`, `RecommendationCard.tsx`,
`EditorToolbar.tsx`, `PresentationReviewPanel.tsx`, i in.).

Trzy komponenty nie miały w ogóle `useTranslation()` — dodany hook +
import: `SharedDocumentReaderPage.tsx`, `OrganizationSourcesClaimsScreen.tsx`
(przebudowany z implicit-return na blok, żeby zmieścić hook),
`DBR77DimensionToggle`/`WasteSelector`/`BootstrapLoadingView` (przebudowane
tak samo, po jednym komponencie w `DBR77LeanMap.tsx` i
`DrdHttpMethodWorkspaceScreen.tsx`).

**Trzy „Legal Notice" po polsku mimo angielskiego kontekstu** —
`ADMAAssessmentMap.tsx`, `CMPracticeMap.tsx`, `SIRIReportTemplate.tsx`:
cały akapit disclaimer (ADMA/CMMI/SIRI methodology) miał środek zdania po
polsku wplecony między `<strong>` z angielskimi nazwami własnymi. Uproszczone
do jednego zdania przez `t()` (koszt: stracono osobne pogrubienie 2-3
fragmentów środka zdania — świadomy kompromis, nazwa metodyki w `<strong>`
osobno zostaje pogrubiona).

### 4.3 Nowe klucze w `public/locales/{en,pl}/translation.json`

**149 + 39 + 2 = 190** nowych kluczy (bez usunięcia/zmiany żadnego cudzego).
Sanity: liczba liści w `en/translation.json` wzrosła dokładnie o 187
(38 z pierwszej fali + 149 z drugiej), w `pl` o 177 (o 10 mniej — te 10
kluczy istniały w `pl` już wcześniej, tylko brakowało `en`). Zweryfikowane
`JSON.parse` po każdym zapisie, diff obejrzany (czysto addytywny, żaden cudzy
klucz nie ruszony).

## 5. Bezpieczniki (krok 4)

### 5.1 Nowe (7, moduły bez ochrony)

| Plik | Mutacja RED | Po cofnięciu |
|---|---|---|
| `src/components/Interview/__tests__/jezykInterview.source.test.ts` | `'Inbox'`→`'Skrzynka'` w `InterviewHub.tsx` | GREEN |
| `src/components/assessment/__tests__/jezykAssessment.source.test.ts` | `'Assessment'`→`'Zaplanuj sesje'` w `AssessmentHub.tsx` | GREEN |
| `src/components/Initiatives/__tests__/jezykInicjatywy.source.test.ts` | `'Quick Win'`→`'Szybka wygrana'` w `InitiativesHub.tsx` | GREEN |
| `src/components/Results/__tests__/jezykWyniki.source.test.ts` | `'Action cards — Results'`→`'Karty akcji — Wyniki'` w `ResultsActionCards.tsx` | GREEN |
| `src/components/Audit/__tests__/jezykAudyty.source.test.ts` | `'Change history'`→`'Historia zmian'` w `AuditHistoryView.tsx` | GREEN |
| `src/components/Meeting/__tests__/jezykMeeting.source.test.ts` | `'Failed to load meetings'`→polski w `MeetingHub.tsx` | GREEN |
| `src/components/Organization/__tests__/jezykOrganizacja.source.test.ts` | `'The review decision was saved.'`→polski w `GovernedContextWorkspace.tsx` | GREEN |

Każdy: `vitest run <plik>` pojedynczo, przed mutacją GREEN, po mutacji RED
(assert wypisuje dokładnie wstawiony polski tekst), po cofnięciu z powrotem
GREEN — zweryfikowane w tej sesji dla wszystkich 7, nie tylko deklaratywnie.

Wspólny detektor: `tests/unit/i18n/polskiBezOgonkowWspolny.ts` (port TS
algorytmu z `scripts/i18n/polski-bez-ogonkow.mjs`, żeby test i przyrząd nigdy
się nie rozjechały definicją „polskiego"). Assessment ma jawną listę 2
dozwolonych trafień (te same 2 linie `primary-*` z §3), z komentarzem
odsyłającym do tego README.

### 5.2 Rozszerzone (3, moduły z istniejącą ochroną)

`jezykCzatu.source.test.ts` (Chat), `jezykRealizacji.source.test.ts`
(Execution), `jezykMaterialow.source.test.ts` (Materials) — każdy dostał
dodatkowy `it()` wołający ten sam wspólny detektor na ich istniejącym
`ZRODLA`/`PLIKI_MODULU`. Ich własne słowniki (`polskieSilne` z
`pomiar-jezyka.wyjatki.json`, albo ręcznie dopisana lista w Materials) nie
łapały polskiego bez ogonków spoza tej listy.

Rozszerzenie od razu ZŁAPAŁO 7 realnych, wcześniej niewidocznych przypadków
(GREEN dopiero po naprawie, nie od razu — czyli test faktycznie coś
weryfikował, nie był tylko dekoracją):

- Chat: `V8ArtifactRunControl.tsx` ×4 (`'Materiał'`, `'Dostęp zgodny z
  uprawnieniami'`, `'Wymaga uwagi'` ×2, `'Kontrola materiału'`) — klucze
  dynamiczne, niewidoczne dla obu przyrządów regexowych.
- Chat: `V8ContextIndicator.tsx` `'Nie określono'` — **NIE naprawione**,
  bo to jawny wzorzec `isPolish ? t(klucz, 'Nie określono') : angielski`
  (ten sam poprawny wzorzec dwujęzyczny co `executionRealData.ts` w
  bezpieczniku Execution) — konto angielskie nigdy nie wykonuje tej gałęzi.
  Dodane do jawnej listy dozwolonych w teście, z komentarzem.
- Materials: `PresentationReviewPanel.tsx` ×2 (`'Recenzent'` → etykieta,
  `'Uzasadnienie wymaganych zmian'` → placeholder).

Jedna świadomie NIE naprawiona pułapka podczas budowy wspólnego detektora
(GeneratorInicjatywModal.tsx `krok.wielokrotny ? (`, initiativeCardContract.ts
generyk `ReadonlySet<string>`) — fałszywe trafienia z tego samego powodu co
poprawka #3 przyrządu, naprawione w samym detektorze (nie w źródle).

## 6. Kompilacja i typy

- **Per plik**: `npx esbuild <plik> --loader:.tsx=tsx ...` na wszystkich 143
  dotkniętych plikach `.ts`/`.tsx` (129 zmodyfikowanych + 14 nowych/testowych)
  — zero błędów. Złapało realny błąd składni wprowadzony przez skryptową
  zamianę (`"Teresa's proposal"` w apostrofowanym literale JS — naprawione
  przejściem na cudzysłów), więc bramka faktycznie coś złapała, nie była
  martwa.
- **Pełny `tsc -p tsconfig.json --noEmit`**: **192 błędy**, próg z instrukcji.
  Zmierzone DWA RAZY z porównaniem: `git stash` (bez moich zmian) → 192
  błędów → `diff` linia-po-linii przeciw stanowi z moimi zmianami → **0 różnic**
  (identyczny zestaw błędów, żaden nowy, żaden zniknięty). Wszystkie 192
  błędy to dług zastany w plikach niezwiązanych z tą paczką (np.
  `ExecutionHub.tsx` typy statusów, `AssessmentHub.tsx` typy kolumn tabeli) —
  zero nowych błędów w plikach tej paczki.

## 7. SHA per etap (gałąź `mvp/jdog-c-0909`, worktree jdog-c)

| Etap | SHA (10 znaków) |
|---|---|
| KROK 0 (baza) | `c076e94405` |
| przyrząd + PRZED | `6e2df798fa` |
| naprawa (10 modułów, 134 pliki) | `397e35a6e3` |
| bezpieczniki (7 nowych + 3 rozszerzone) | `98a029c964` |
| pomiar PO + ten dokument | *(commit tej wiadomości)* |

## 8. STOP-y (uczciwie)

1. **2 linie `primary-*` w `DBR77ReportTemplate.tsx`** — zostawione, zgłoszone,
   nienaprawione (§3.1-2). Wymaga decyzji właściciela razem z ~14 innymi
   wystąpieniami `primary-*` w tym pliku (dług poza zakresem paczki
   językowej).
2. **Klucze dynamiczne (`` `module.key.${zmienna}` ``) niewidoczne dla obu
   przyrządów regexowych** (mój i oficjalny `pomiar-jezyka.mjs`) — znaleziono
   i naprawiono 4 konkretne wystąpienia w `V8ArtifactRunControl.tsx` ręcznie
   (dzięki rozszerzeniu bezpiecznika, które ma inny, szerszy wzorzec klucza),
   ale przyrząd pomocniczy SAM z siebie ich nie znajdzie — to luka narzędzia,
   nie tylko tych 4 miejsc. Nie przeszukano całego repo ręcznie pod kątem tego
   wzorca poza zakresem, w którym rozszerzenie bezpiecznika akurat trafiło.
3. **`SIRIReportTemplate.tsx` `language="pl"`** (linia ~261,
   `<ConclusionExecutiveSummary vm={execVM} language="pl" />`) — hardkodowany
   prop języka niezależny od UI, przekazywany do generatora TREŚCI (nie
   etykiety ekranu). Zostawiony nietknięty — zmiana wymagałaby przeglądu, czy
   generowana treść w ogóle ma angielską wersję po drugiej stronie, co jest
   poza zakresem tej paczki (K5/K9 wg taksonomii `pomiar-jezyka.mjs`, nie
   K1/K4).
4. **Materiały demo/dane pokazowe** — świadomie poza zakresem (K6 wg
   taksonomii `pomiar-jezyka.mjs`), zgodnie z istniejącą konwencją list
   `WYLACZONE` w bezpiecznikach Execution/Materials.
5. **Nie przeszukano całego repo ręcznie pod kątem literałów typu
   `x ? 'polski' : 'english'`** poza tym, co złapały bezpieczniki/przyrząd —
   3 takie przypadki znalezione i naprawione PRZY OKAZJI edycji sąsiednich
   linii (`AgentPlanPanel.tsx` krok/kroków/schemat zatwierdzony,
   `RolloutBaselinePanel.tsx` Zapisywanie/Zapisz baseline), ale to
   przypadkowe znalezienie, nie systematyczny skan tej klasy w całym
   zakresie — kategoria K4/K5 częściowo poza mocą obu przyrządów regexowych.

## 9. Dowód mierzalny (nie audyt na słowo)

- `evidence/jezyk-jdog-c/przed.txt`, `po.txt` — surowe wyjścia przyrządu,
  ten sam kod narzędzia po obu stronach porównania.
- `git log --oneline -4` na gałęzi pokazuje 3 commity tej paczki + bazę.
- `node_modules/.bin/vitest run` na wszystkich 10 plików bezpieczników —
  28 testów, wszystkie GREEN w chwili pisania tego dokumentu.
- `tsc --noEmit` — 192/192, identyczny zestaw z baseline (diff = 0 linii).
