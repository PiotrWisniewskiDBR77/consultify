# K5-4 — podgląd banku Realizacji 1:1 jak zaakceptowany podgląd Inicjatyw

Odrzut właściciela (żywy staging `cf3fded7e4`, ciemny motyw):
**„Preview tutaj nie mieści się na ekranie i jest niezgodne ze standardem".**

## Przyczyna (zmierzona, nie zgadnięta)

`ExecutionHub.tsx` renderował podgląd banku przez `JedenPrawyPanel`
(`src/components/shared/PreviewPane/JedenPrawyPanel.tsx`), a ten **nie podaje
`footer` do `PreviewPaneShell`**. Bloki 5 (Relations), 6 (Akcje) i „Co dalej"
jechały więc WEWNĄTRZ przewijanego ciała panelu — jedyna akcja („Copy link")
stała pod dolną krawędzią okna i nie było jej widać bez przewijania panelu.

Zaakceptowany podgląd Inicjatyw (`CanonicalInitiativeRegister.tsx`) używa
`TableWithPreviewLayout`, który podaje stopkę jako `footer`; `PreviewPaneShell`
renderuje ją `shrink-0`, czyli PRZYKLEJONĄ do dołu panelu. Bank używa teraz
DOKŁADNIE tej samej powłoki.

## Zrzuty

| plik | co pokazuje |
| --- | --- |
| `PRZED-1440x900-jasny.png` | stan sprzed naprawy — panel kończy się na „RELATIONS / No relations" przy dolnej krawędzi; „Copy link" i „What's next" poza ekranem |
| `WZORZEC-inicjatywy-1440-jasny.png` | wzorzec: zaakceptowany podgląd Inicjatyw (ten sam harness, `k5-naprawy-inicjatywy`) |
| `PO-1440x900-jasny.png` · `PO-1440x900-ciemny.png` · `PO-1280x800-jasny.png` · `PO-1920x1080-jasny.png` | stan po naprawie, cztery rozdzielczości odbioru |
| `PO-1440x900-jasny-kebab-bloku3.png` | kebab lokalny bloku 3 rozwinięty (lista czekowania kanonu) |
| `PO-1440x900-jasny-bez-realizacji.png` | wiersz BEZ realizacji — same myślniki w faktach, stopka nadal przyklejona |

## Pomiar

`node evidence/k5-preview2-20260913/pomiar.mjs` (harness `k5-preview-bank`,
port 5313) → `pomiar.json`. Wynik dla wszystkich czterech wariantów:

| wariant | scrollHeight / clientHeight | strona przewija | aside | stopka „Copy link" | ciało `overflow-y` | blok „Co dalej" | „Open" | rzędy chipów meta | błędy konsoli |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1440×900 jasny | 900 / 900 | nie | 1 | 794–871, widoczna | auto | brak | 1 | 1 | 0 |
| 1440×900 ciemny | 900 / 900 | nie | 1 | 794–871, widoczna | auto | brak | 1 | 1 | 0 |
| 1280×800 jasny | 800 / 800 | nie | 1 | 694–771, widoczna | auto | brak | 1 | 1 | 0 |
| 1920×1080 jasny | 1080 / 1080 | nie | 1 | 974–1051, widoczna | auto | brak | 1 | 1 | 0 |

## Test

`src/components/Execution/__tests__/ExecutionHub.bankPreviewCanon.test.tsx`
(8 przypadków). Dowód czerwony→zielony: po przywróceniu deklaracji sprzed K5-4
(`git checkout HEAD -- executionBankPreviewDeclaration.tsx
executionBankPreviewModel.ts`) pada **6 z 8**; po przywróceniu zmian **8/8**.
