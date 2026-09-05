# Dyżur 370 — R3: inwentarz akcji tworzących rekord

Komenda mianownika: `rg -n "handleSaveAs|saveMessageAs" src/components/AIChat src/services/chatActionRegistry.ts src/services/chatActionHandler.ts`. Wynik: trzy rodziny bezpośrednie (`decision/initiative`, `idea`, `note`) oraz ich wołacze; brak osobnego `handleSaveAsTask` i `handleSaveAsMaterial`.

| Akcja / handler | Plik:linia | Endpoint | Tabela | Zapis względem nawigacji | Naprawa 370 | Rekomendacja |
| --- | --- | --- | --- | --- | --- | --- |
| Zapisz jako decyzję / `handleSaveAsDecision` | `UnifiedChatPanel.tsx:5627`, `MessageRenderer.tsx:2416` | `POST /api/ai/deep-thinking/save-decision` | `ai_decision_outcomes` | przed; bez nawigacji | TAK K4 | Zachować kontrakt decyzji bit-do-bitu. |
| Konwertuj na inicjatywę | `MessageRenderer.tsx:2427`, `deep-thinking.routes.ts:63` | ten sam endpoint, `type=initiative` | `initiatives`, przez `createInitiative` | przed; bez nawigacji | TAK K4 | Potwierdzić z właścicielem lineage `ai_chat_deep_thinking + conversationId`. |
| Zapisz jako pomysł / `saveMessageAsIdea` | `UnifiedChatPanel.tsx:1462`, `MessageRenderer.tsx:2200` | `POST /api/my-work/my-ideas/from-chat` | `my_ideas` | po naprawie przed nawigacją | TAK K8 | Zachować realne `idea-*`, nigdy placeholder `new-idea-*`. |
| Zapisz jako notatkę / `saveMessageAsNote` | `UnifiedChatPanel.tsx:1567`, `MessageRenderer.tsx:2192,2470` | `POST /api/my-work/notebook/pages` | `notebook_pages` | przed nawigacją | NIE, wzorzec poprawny | Bez zmian. |
| `ASSIGN_INTERVIEW` | `chatActionHandler.ts:188` | API szablonu + przypisania wywiadu | przypisania/dystrybucje wywiadów | synchronicznie; brak nawigacji przed zapisem | NIE | Traktować jako poprawny wzorzec rejestru. |
| `CREATE_DRAFT_TASK` | `aiActionExecutor.ts:911` | mechanizm `ai_actions` | `tasks` po akceptacji/wykonaniu | osobny cykl propozycja→akceptacja→wykonanie | NIE | Ujednolicić produktowo dwutorowość w osobnym zleceniu. |
| `CREATE_DRAFT_INITIATIVE` | `aiActionExecutor.ts:914,1266` | mechanizm `ai_actions` | `initiatives` przez lejek | po akceptacji | NIE | Zachować lejek; ustalić wspólną semantykę z CTA bezpośrednim. |
| `CREATE_DRAFT_DECISION` | `aiActionExecutor.ts:917,1378` | mechanizm `ai_actions` | decyzje/My Work | po akceptacji | NIE | Osobno uzgodnić jeden kontrakt decyzji. |

`chatActionRegistry/chatActionHandler` ma 14 typów; żaden nie tworzy wprost zadania, decyzji, inicjatywy, pomysłu, notatki ani materiału. `ASSIGN_INTERVIEW` jest najbliższym synchronicznym wzorcem. Bezpośrednie `handleSaveAs*` omijają cykl `ai_actions`; kod pokazuje dwutorowość, ale nie dowodzi, że jest ona zamierzona — klasyfikuję ją jako dług do decyzji właściciela.

## Pozostałe defekty audytu — bez naprawy

| ID | Dowód | Opis / rekomendacja |
| --- | --- | --- |
| K1 | `server/src/routes/work-canvas.routes.ts:1710-1763` | Etykieta AI, operacja deterministyczna; osobno urealnić copy albo podłączyć model. |
| K2 | `UnifiedChatPanel.tsx:6786`, `AppRoutes.tsx:1778` | Akcje biznesowe nieosiągalne; osobne zlecenie montażu. |
| K3 | `server/src/routes/cloud.routes.ts:82-113` | Połączenie bez OAuth; spiąć z `integrationOAuthEngine`. |
| K5 | `CaseIntakeConfirmCard`, typ `case_intake_proposal` | Karta nieosiągalna; dodać producenta kontraktu. |
| K6 | `HelpSidePanel.tsx:307-337`, `AppRoutes.tsx:1772-1782` | Kickoff pomocy ginie na `/chat`; osobno przekazać kontrakt wejścia. |
| K7 | `CanvasRichEditor.tsx:282-285,337-340` | Większość akcji błędu milczy; dodać uczciwy stan błędu. |
| K9 | `ChatToSchemaService.ts:480-482` | Po refreshu stary stan i brzydkie 500 przy powtórce; poprawić readback/409 UX. |
| P2 i18n | `canvasActionAvailability.ts:27-47`, `ChatHistorySidebar.tsx:641` | Około 40 luk; osobna paczka i18n. |
| P2 etykiety/duplikaty | audyt `00_ZESTAWIENIE.md:45` | Duplikaty i nawigacje udające utworzenie; osobna paczka zachowaniowa. |
| P2 martwe pliki | audyt `00_ZESTAWIENIE.md:46` | Martwe komponenty zafałszowują audyty; osobna bezpieczna redukcja. |
