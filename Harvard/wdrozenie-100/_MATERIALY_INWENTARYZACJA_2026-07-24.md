# MATERIAŁY — inwentaryzacja (krok 1 briefu), 2026-07-24

> Read-only audyt na `origin/demo` HEAD `97f466bd98`. 5 czytelników równolegle. Każda teza = plik:linia.
> Cel: mapa route/tabela/caller dla 3 formatów + kontrakt docelowy, PRZED budową (brief §9).

## 1. KONTRAKT DOCELOWY (brief §1) — DZIŚ NIE ISTNIEJE
Dziś: płaski `LauncherSelection = {type:'report'|'presentation'|'table', templateId}` (`OutputsLauncherModal.tsx:39-44`).
Brak pola `entity` (Materiał/Szablon) i `start` (blank/ai/from_template/clone_template). Docelowy:
```ts
{ entity:'artifact'|'template', format:'document'|'presentation'|'spreadsheet',
  start:'blank'|'ai'|'from_template'|'clone_template', templateId?:string }
```

## 2. MAPA SILNIKÓW — co realnie działa (✅) / luka (⚠) / brak (✗)
| Format | blank | ai | from_template | clone_template |
|---|---|---|---|---|
| **Word** (`/document-studio`, `document_studio_templates`) | ✅ obejście (generate useLlm:false) | ✅ pełny pipeline | ✅ **tylko w Doc Studio via TriModeChooser** | ✗ save-as-template odrzuca `native_artifact` |
| **Deck** (`/presentations/wizard`, `presentation_templates`) | ⚠ DWIE impl. (Wizard=AI-pipeline, PrezentacjeView=prawdziwie pusty POST /decks) | ✅ | ✅ SELECT realny | ✅ POST /templates/:id/clone |
| **Excel** (`/excele`, workbook registry 7 modeli) | ✅ POST /workbook/blank | ✅ (czasem cichy fallback→tp_tables) | ✅ 7 parametrycznych | ✗ brak endpointu |

## 3. GDZIE UMIERA `from_template` (główny bug briefu — POTWIERDZONY)
Wspólny launcher „Nowy" (`OutputsLauncherModal`) → `ReportsAndPresentationsHub.tsx:256-274 handleLauncherSelect`
→ `openChatWithContext({contextData:{templateId}})`. **templateId trafia tylko do kontekstu czatu Teresy i GINIE**:
`useOpenChatWithContext.ts:184-222` czyta wyłącznie `teresaPrompt`; `entityData.templateId` nie ma ŻADNEGO konsumenta
(grep 0). Komentarz w kodzie sam przyznaje: „Konsumpcja templateId = seria T" (nie zaimplementowane).
→ Deck/Excel MAJĄ działający from_template, ale przez WŁASNE ścieżki (TriModeChooser / architekt), NIE przez wspólny launcher.

## 4. TEMPLATE LIBRARY split-brain — brief CZĘŚCIOWO NIEAKTUALNY, w jednym miejscu GORSZY
- **NIEAKTUALNE:** `report_builder_templates` i `presentation_templates` SĄ JUŻ zmostkowane do kanonicznego rejestru
  `v8_output_artifacts` (backfill + live `registerBuilderTemplateArtifactBestEffort`, „Fala B 2026-07-22",
  `deliverableTemplateService.ts:424-454`). Ten split-brain był naprawiany wczoraj.
- **★ REALNA DZIURA (ostrzejsza niż brief):** `document_studio_templates` ma **ZERO mostu** do rejestru. Word Architect
  zapisuje tam, ale Biblioteka nigdy tego nie pokaże. `deliverableTemplateService.ts:170-200 listDocTemplates` czyta „doc"
  szablony WYŁĄCZNIE z `report_builder_templates` (0 trafień `document_studio_templates`). To NIE report_builder jest
  sierotą — to document_studio_templates.
- **Arkusze:** `tp_base_templates` most tylko dla NOWYCH wierszy (po 22.07); stare/seedowane (`deliverableTemplateSeedService.ts:381`,
  `tabeleConsultingTemplatesSeeder.ts`) nigdy nie trafiają do rejestru — brak `backfillSheetTemplatesForOrg`.
- `OutputsLauncherModal` hardcoded `TEMPLATES` (linia 115-161) = MARTWY KOD (nigdy nie renderowany; realny render = `apiTemplates`).

## 5. MENU 2 + SIDEBAR
- Menu 2 dziś: 5 zakładek-TYPÓW (All/Documents/Presentations/Sheets/Template Library) **+ 2 zakładki-NARZĘDZIA**
  za flagami: `template_architect` (`Hub.tsx:211-219`) i `workbook_templates` (`:223-231`). Łamią „Menu 2 = types" → do zdjęcia.
- **★ REALNY DEFEKT flagi:** `deckArchitectFlag.ts:19` komentarz „Default: OFF", ale `readEnvFlag` (L34-41) zwraca
  `parsed===null?true` → gdy env nieustawione, zakładka Architekt jest **domyślnie WIDOCZNA wbrew regule #7**.
  Kontrast: `workbookTemplatesFlag.ts` poprawnie `?false`. To literówka/kopiuj-wklej, nie zamiar.
- **Sidebar druga brama:** `menuConfig.ts:159-164` — osobny wpis „Excel", warunkowany `exceleFlag` (domyślnie ON).
  Brief: zdjąć jako drugą bramę do tych samych materiałów; `/excele` zostaje jako route/deep-link.
- Komentarz `menuConfig.ts:153-154` („Excel gated OFF") jest STARY/nieaktualny wobec `exceleFlag.ts` (ON by design).

## 6. LEGACY (brief §7) — potwierdzone route'y (redirect-only, NIE kasować)
`/wordy`→`/document-studio` (`AppRoutes.tsx:1429`). `/reports`→`/presentations?tab=all` (`:2023`).
`/reports/builder` = ODRĘBNY żywy silnik raportów z assessmentu (report_builder_*), NIE duplikat Worda — zostaje dla swoich rekordów.
`/excele` vs `/tabele` = **NIE wzajemne redirecty** (teza briefu OBALONA): jednokierunkowa bramka `isExceleEngineEnabled`
(OFF→/tabele, ON→ExceleView). Sidebar spójny z routingiem.

## 7. RÓŻNICE brief ↔ rzeczywistość (do decyzji Piotra PRZED budową)
1. **Adapter Biblioteki**: brief mówi „przestaw doc z report_builder na właściwe" — ale report_builder JUŻ zmostkowany;
   realna robota = **zmostkować `document_studio_templates`** (dziś sierota) + backfill starych `tp_base_templates`.
2. **clone_template**: brak dla Worda i Excela (jest dla Decka). Brief zakłada 4 tryby — dla Worda/Excela to NOWY silnik, nie podłączenie.
3. **blank dualny** (Word i Deck mają po dwie implementacje) — trzeba wybrać jedną kanoniczną per format.
4. `/excele`↔`/tabele` NIE są wzajemnymi redirectami — mniej do naprawy niż brief zakładał.

## 8. SEKWENCJA (brief §9) — propozycja
1. ✅ inwentaryzacja (ten dok). 2. Kontrakt `{entity,format,start,templateId}` jako typ + adaptery per format.
3. Menu 2 → 5 typów; zdjąć 2 zakładki-narzędzia; naprawić deckArchitectFlag; zdjąć wpis Excel z sidebara (route zostaje).
4. Wspólny launcher Materiałów (reuse UnifiedCreateLauncher wizualnie): format→tryb→REALNY runtime (nie czat).
5. Wspólny launcher Szablonów: typ→(czysto/AI/na bazie istniejącego)→architekt danego formatu.
6. Podłączyć from_template do realnej generacji (naprawić Hub.tsx:256 — templateId do artefaktu, nie do czatu).
7. Most `document_studio_templates`→rejestr + backfill `tp_base_templates`.
8. NA KOŃCU: odłączyć widoczne legacy wejścia, oznaczyć stare rekordy.
