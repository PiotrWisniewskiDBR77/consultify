# Rejestr DEFEKT-EN — polskie napisy w słowniku angielskim

Pomiar na markerze `bc18bc7acac2ec825ebb3db2f1309738ab034d58`. Detektor słownikowy znalazł 24 prawdziwe defekty; liczba 13 z instrukcji była niepełna, głównie przez pominięcie rodziny `Tabele`. Naprawa: `2d8718a0376d7e85470c90e4f07267bc37b4ee42`.

| Plik:linia przed zmianą | Klucz | Wartość znaleziona | Wartość poprawiona | Commit |
|---|---|---|---|---|
| `public/locales/en/translation.json:5783` | `myWork.closeOpenDocument` | Close: `{{nazwa}}` | Close: `{{name}}` | `2d8718a037` |
| `public/locales/en/translation.json:13468` | `reports.toast.templateNameRequired` | Nazwa szablonu jest wymagana | Template name is required | `2d8718a037` |
| `public/locales/en/translation.json:21754` | `presentations.builder.moduleLabel` | Prezentacje | Presentations | `2d8718a037` |
| `public/locales/en/translation.json:21972` | `presentations.templateArchitect.dataNeeded` | Dane do zebrania | Data to collect | `2d8718a037` |
| `public/locales/en/translation.json:21974` | `presentations.templateArchitect.suggestedVisual` | Sugerowana wizualizacja | Suggested visualization | `2d8718a037` |
| `public/locales/en/translation.json:26025` | `rap.actions.askAI` | Zapytaj AI | Ask AI | `2d8718a037` |
| `public/locales/en/translation.json:26054` | `rap.preview.scope` | Zakres | Scope | `2d8718a037` |
| `public/locales/en/translation.json:26055` | `rap.preview.category` | Kategoria | Category | `2d8718a037` |
| `public/locales/en/translation.json:26056` | `rap.preview.sections` | Sekcje | Sections | `2d8718a037` |
| `public/locales/en/translation.json:26058` | `rap.preview.validationState` | Walidacja | Validation | `2d8718a037` |
| `public/locales/en/translation.json:26060` | `rap.preview.migrationHint` | Zamiennik | Replacement | `2d8718a037` |
| `public/locales/en/translation.json:26061` | `rap.preview.replacedBy` | Nowy wzorzec | New pattern | `2d8718a037` |
| `public/locales/en/translation.json:26683` | `kimi.laneTabele` | Tabele | Tables | `2d8718a037` |
| `public/locales/en/translation.json:26696` | `kimi.tabele.preview.documentLabel` | Tabele operational table preview | Tables operational table preview | `2d8718a037` |
| `public/locales/en/translation.json:26837` | `kimi.shell.lane.prezentacje` | Prezentacje | Presentations | `2d8718a037` |
| `public/locales/en/translation.json:26849` | `kimi.tabeleShell.aiEditor.ariaLabel` | Tabele AI Editor | Tables AI Editor | `2d8718a037` |
| `public/locales/en/translation.json:26913` | `kimi.tabeleShell.leftRail.ariaLabel` | Tabele outline | Tables outline | `2d8718a037` |
| `public/locales/en/translation.json:26924` | `kimi.tabeleShell.qa.ariaLabel` | Tabele QA report | Tables QA report | `2d8718a037` |
| `public/locales/en/translation.json:26978` | `kimi.tabeleShell.share.ariaLabel` | Tabele share and conversions | Tables share and conversions | `2d8718a037` |
| `public/locales/en/translation.json:26987` | `kimi.tabeleShell.share.targetPresentationDescription` | Open in Prezentacje with slide outline | Open in Presentations with slide outline | `2d8718a037` |
| `public/locales/en/translation.json:27035` | `kimi.tabeleShell.sourcePack.ariaLabel` | Tabele source pack builder | Tables source pack builder | `2d8718a037` |
| `public/locales/en/translation.json:27122` | `tabele.rightRail.aiEditor.panelAria` | Tabele AI Editor | Tables AI Editor | `2d8718a037` |
| `public/locales/en/translation.json:27127` | `tabele.rightRail.qa.panelAria` | Tabele QA report | Tables QA report | `2d8718a037` |
| `public/locales/en/translation.json:27137` | `tabele.rightRail.share.panelAria` | Tabele share and conversions | Tables share and conversions | `2d8718a037` |

## Fałszywe alarmy odrzucone ręcznie

| Klucz | Wartość | Rozstrzygnięcie |
|---|---|---|
| `pages.public.cards.tour.description` | Guided by Dr. Piotr Wiśniewski | nazwisko własne; nie tłumaczyć |
| `welcome.videoPerson` | Paweł Bochniarz | imię i nazwisko; nie tłumaczyć |
