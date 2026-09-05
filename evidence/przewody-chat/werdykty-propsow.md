# Rodzina propsów warunkujących widoczne elementy

| Prop | Stan tras `/chat` | Werdykt | Uzasadnienie |
| --- | --- | --- | --- |
| `onNavigateToActions` | nieprzekazywany | DEFEKT, naprawiony w R1 | Przycisk był martwy we wszystkich 11 montażach; fallback prowadzi do publicznej trasy `/ai-actions`, wyłącznie za flagą default OFF. |
| `kickoffMessage` / `onKickoffConsumed` | nieprzekazywane | DEFEKT, naprawiony w R2 | Globalny kickoff z Pomocy ginął na pełnoekranowym czacie; komponent czyta teraz store jako fallback. |
| `quickPrompts` | nieprzekazywany | CELOWE | Chippy są kontekstem osadzonego modułu; pełnoekranowy czat nie ma źródła takiego kontekstu. |
| `contextActions` | nieprzekazywany | CELOWE | Akcje publikuje ekran artefaktu do osadzonej Teresy; ogólny `/chat` nie powinien wymyślać akcji bez obiektu. |

Inspekcja wszystkich pól `UnifiedChatPanelProps` nie ujawniła innych pominiętych propsów o tym samym kształcie `{prop && (...)}`.
