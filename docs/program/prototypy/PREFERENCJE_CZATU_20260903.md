# Preferencje Czatu — inwentarz R1

Stan pomiaru: marker `416432abaf`, 2026-09-04. „Trwałość” poniżej oznacza wyłącznie to, co wynika z kodu; bez testu zimnego logowania na osobnym kliencie pozostaje `NIEZWERYFIKOWANE`.

## Inwentarz

| Preferencja | Komponent / konsument | Gdzie w interfejsie | Zapis (klucz / tabela) | Zimne logowanie | Test | Czy użytkownik znajdzie |
| --- | --- | --- | --- | --- | --- | --- |
| Głęboka analiza | `ToolsMenu` / `UnifiedChatPanel` | Czat → przycisk „Narzędzia AI” → Tryby AI | `consultify-storage.state.aiConfig.deepResearch` w `localStorage`; brak tabeli | Przeżywa rehydratację tej samej przeglądarki; logowanie na innym kliencie `NIEZWERYFIKOWANE` | zachowanie menu i kontrakt strumienia, brak testu zimnego klienta | TAK, po otwarciu menu przy kompozytorze |
| Pokaż rozumowanie | `ToolsMenu` / payload Czatu | Czat → „Narzędzia AI” → Tryby AI | `consultify-storage.state.aiConfig.showReasoning`, `localStorage` | jak wyżej | `ToolsMenu.test.tsx`, kontrakt strumienia; brak zimnego klienta | TAK |
| Analiza wieloagentowa | `ToolsMenu` / payload Czatu | Czat → „Narzędzia AI” → Tryby AI | `consultify-storage.state.aiConfig.multiAgent`, `localStorage` | jak wyżej | test renderu/licznika; brak zimnego klienta | TAK |
| Tryb prywatny | `ToolsMenu` / `UnifiedChatPanel` i backend Czatu | Czat → „Narzędzia AI” → Tryby AI | `consultify-storage.state.aiConfig.privateMode`, `localStorage` | jak wyżej | testy kontraktu prywatności, brak zimnego klienta | TAK |
| Czytanie odpowiedzi | `ToolsMenu` / `UnifiedChatPanel` | Czat → „Narzędzia AI” → Tryby AI | `consultify-storage.state.aiConfig.textToSpeech`, `localStorage` | jak wyżej | `ToolsMenu.test.tsx`, `UnifiedChatPanel.test.tsx`; brak zimnego klienta | TAK |
| Głos, szybkość i wysokość TTS | `TTSSettings` / `useTTS` | podmenu ustawień głosu, widoczne dopiero po włączeniu TTS | `aiConfig.ttsVoice`, `ttsRate`, `ttsPitch` w `localStorage` | jak wyżej | test widoczności i zmiany głosu; brak zimnego klienta | CZĘŚCIOWO — ustawienia są schowane za włączeniem TTS |
| Sugestie następnego kroku | `ToolsMenu` / `UnifiedChatPanel` | Czat → „Narzędzia AI” → Tryby AI | `consultify-storage.state.aiConfig.chatSuggestionsEnabled`, `localStorage` | jak wyżej | konsument istnieje; brak dedykowanego testu zimnego klienta | TAK |
| Styl odpowiedzi | `ToolsMenu` / budowa promptu | Czat → „Narzędzia AI” → „Jak Teresa ma odpowiadać” | `consultify-storage.state.aiConfig.responseStyle`, `localStorage` | jak wyżej | menu i rozróżnienie promptów; brak zimnego klienta | TAK |
| Własne instrukcje | `ToolsMenu` / pamięć Czatu | ten sam modal co styl odpowiedzi | API `/api/ai-memory/custom_instructions`, klucz `custom_instructions`; lustrzana kopia w `aiConfig` | kod ma odczyt z API po otwarciu; realny zimny odczyt `NIEZWERYFIKOWANE` | brak wskazanego testu zimnego klienta | TAK |
| Źródła / fokus bieżącej wiadomości | `FocusModeSelector` / `UnifiedChatPanel` | selektor przy kompozytorze | lokalny stan React `focusMode`, brak zapisu trwałego | NIE | testy konsumentów, brak testu trwałości | TAK, ale to wybór bieżącego kontekstu, nie preferencja trwała |
| Kolejność Kanwa / Teresa (`CHAT-OWN-001`) | brak kontrolki; układ `UnifiedChatPanel` | brak wejścia — D17 ustala układ na sztywno | brak | NIE DOTYCZY | brak | NIE; zakres historycznej uwagi został później rozstrzygnięty przez D17 |

## Cztery warstwy

1. **Kod:** pola istnieją w `src/store/slices/chatSlice.ts`; `setAIConfig` scala zmianę do stanu.
2. **Wołacz:** `ToolsMenu.tsx` wywołuje `setAIConfig`; własne instrukcje dodatkowo wołają `/api/ai-memory/custom_instructions`.
3. **Montaż:** `EnhancedChatInput.tsx` montuje `ToolsMenu`; `UnifiedChatPanel.tsx` montuje wejście Czatu.
4. **Widoczność:** preferencje są osiągalne z ikony „Narzędzia AI” przy kompozytorze; TTS ma drugi poziom ujawniany dopiero po włączeniu funkcji; `CHAT-OWN-001` nie ma kontrolki.

## Wniosek R1

W Czat już wchodzi co najmniej osiem jawnych preferencji użytkownika oraz ustawienia TTS i własnych instrukcji. Większość przeżywa przeładowanie tylko przez persystencję Zustand do `localStorage`, a więc nie ma dowodu przeżycia zimnego logowania na osobnym kliencie; nie wolno na tej podstawie nazwać ich trwałymi per użytkownik w bazie.
