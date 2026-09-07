# P14-B — raport wykonania

Data pomiaru: 2026-09-07  
Baza: `codex/m03-admin-20260824` / `50ad9aec5e` (`github-backup`)  
Gałąź robocza: `codex/p14b-karty-dokument`  
Werdykt: **PARTIAL** — kod, kontrakt, pięć renderów i bramki statyczne są domknięte; brak realnego rekordu wzorca prezentacji uniemożliwił dowód hydratacji konkretnego obiektu tej jednej karty.

## Wynik

Wspólny kontrakt rodziny dokument/kreator znajduje się w `src/components/standard/documentCardContracts.ts`, a wspólna rama w `src/components/standard/DocumentCardNFrame.tsx`. Pięć wpisów w `src/components/standard/registry.ts` ma status `zmigrowana`. Wszystkie karty używają kanonicznego `PracujZAI` i prawego panelu o kolejności: Akcje, Właściwości, Powiązania, Źródła i założenia, Komentarze, Historia.

| Karta | Tożsamość / trasa | `Pracuj z AI` | Prawy panel | Stan |
|---|---|---:|---:|---|
| `presentation` | `/presentations/builder/:deckId` | 1; menu otwarte | kanoniczny; tabela właściwości | PASS; usunięto „Zapytaj Teresę” ze stopki |
| `report-builder` | `/reports/builder/:reportId` | 1; menu otwarte | dokładnie 1 panel 320 px | PASS; usunięto zagnieżdżony bespoke `<aside>` |
| `template-architect-doc` | nowa `/presentations/templates/document/:templateId`; realny `doc-template-system-en-client_final_report` | 1; menu otwarte, tylko „Analizuj” dla zatwierdzonego read-only | kanoniczny | PASS |
| `template-architect-deck` | nowa `/presentations/templates/deck/:templateId` | 1; menu otwarte | kanoniczny | PARTIAL; w danych odbiorowych nie ma żadnego rekordu wzorca prezentacji |
| `finance-statement-pack` | realny rekord otwarty z `/finance?tab=statements` | 1; „Analizuj” prowadzi wyłącznie do `HISTORICAL_ANALYSIS` | kanoniczny w V2 i ścieżce zgodnościowej | PASS; brak podłączenia `FinancialModelWorkspace` |

DEC-440 jest zachowane: `finance-model` nie trafił do rejestru, a wejście AI karty sprawozdania tworzy wyłącznie analizę `HISTORICAL_ANALYSIS`. Generowanie raportu pozostało zwykłą akcją artefaktu, nie alternatywnym wejściem AI.

## Dowód renderu 1440, jasny motyw

Każdy plik ma parę `.png.json` z końcowym URL-em, rozmiarem 1440, motywem `light`, liczbą wejść AI i błędami konsoli/HTTP.

- `evidence/p14b/presentation.png` — realny deck, menu otwarte, 0 błędów konsoli/HTTP.
- `evidence/p14b/report-builder.png` — realny raport, menu otwarte, 0 błędów; DOM: dokładnie 1 `<aside>` i 1 panel 320 px.
- `evidence/p14b/template-architect-doc.png` — realny zatwierdzony wzorzec dokumentu na trasie tożsamości, menu otwarte, 0 błędów.
- `evidence/p14b/template-architect-deck.png` — trasa tożsamości działa i menu jest otwarte, ale identyfikator `evidence-missing-no-existing-template` jest jawnym sentinel-em braku rekordu, nie dowodem hydratacji obiektu.
- `evidence/p14b/finance-statement-pack.png` — realne sprawozdanie CD PROJEKT, menu otwarte, 0 błędów, dokładnie 1 prawy panel.

## Testy i bramki

### Przed zmianą

- Wybrany zastany pakiet kontraktów/trasy/Finance: **20/20 PASS**.
- Pełny `tsc` serwera: **0 błędów**.
- Pełny frontend w bieżącym toolchainie: **200 błędów**. Wartość `877` z polecenia jest historycznym mianownikiem zapisanym w raporcie P13; aktualny pomiar tej samej bazy jest niższy.

### Po zmianie

- Pakiet P14-B: **18 plików, 51/51 PASS**.
- `DeckBuilderMelsView.artifactStudio.test.tsx`: **6/6 PASS**, w tym negatywny test braku legacy Teresa chip.
- Pełny `tsc` serwera: **exit 0, 0 błędów**.
- Pełny frontend: **200 błędów**, czyli delta względem aktualnej bazy `0` i wynik poniżej historycznego limitu `877`.
- Hooki repozytorium: Teresa contract `19/19`, brak wzrostu crimson/focus/list debt.

Zastany `DeckBuilder.restoreNoWrite.test.tsx` nadal nie uruchamia się w obecnym środowisku testowym: jego lokalny mock `react-i18next` nie eksportuje `initReactI18next`. Nie zaliczam tego jako PASS ani jako regresji P14-B; błąd występuje na etapie kolekcji.

## Mutacja kontraktu

Mutacja: z `RIGHT_PANEL` usunięto `history`.  
RED: `DocumentCardNFrame.contract.test.tsx` — **1 failed / 1 passed**, różnica oczekiwanego sześciopolowego kontraktu wskazała brak `history`.  
Po przywróceniu: ten sam test i cały pakiet P14-B — GREEN.

## Commity kroków

Zmiany są rozdzielone na commity kontraktu, tras architektów, prezentacji, raportu, obu aktywnych wariantów sprawozdania, rejestru, korekt testów/typów oraz evidence. Nie wykonano pushu do `staging` ani na żadną inną gałąź.

## Czego NIE domknięto

1. **Nie ma dowodu realnego obiektu `template-architect-deck`.** API/lista zwróciły zero wzorców. Nie utworzono rekordu, ponieważ byłby to zapis do danych odbiorowych. Trasa i inicjalizacja po `templateId` są pokryte testem, ale runtime hydration pozostaje `EVIDENCE_MISSING`.
2. **Nie wykonywano operacji AI zmieniających dane.** Dowody potwierdzają obecność, pojedynczość, etykiety i rozwinięcie menu; nie tworzą analizy ani propozycji.
3. **Nie naprawiano globalnego długu 200 błędów frontowego TypeScript.** P14-B nie zwiększa mianownika.
4. **Nie naprawiano zastanego harnessu `DeckBuilder.restoreNoWrite.test.tsx`.** Jego mock blokuje kolekcję niezależnie od funkcji P14-B.
5. **Nie wykonano wdrożenia, pushu do `staging` ani odbioru produkcyjnego.**
