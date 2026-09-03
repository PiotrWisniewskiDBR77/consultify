# Rejestr Czatu — trzy defekty — 2026-09-03

Marker: `58ef0771d746124c42361d0a37c653790b7c4cfa`  
Runtime: `5266/5267`, PostgreSQL: `127.0.0.1:6298/consultify_w3_chat_owner_day294`.

## CHAT-OWN-002 — nagłówek i trwałość rozmowy

| Pomiar | PRZED (marker) | PO | Decyzja |
| --- | --- | --- | --- |
| Wysokość nagłówka | `42, 42, 42, 42, 42 px` dla 0/500/1500/3000 ms/po zimnym otwarciu odpowiedzi | bez zmiany produktu | Teza o skoku obalona dla 1440 px; brak pozornej zmiany CSS |
| Zapis rozmowy | `POST /api/conversations` 201; `POST /messages` 201; cold GET 200; obcy 404; SQL 1 wiersz | bez zmiany produktu | Istniejący model i trasa już są kanonicznym zapisem |
| `localStorage` | 76 trafień w `AIChat`; zapis rozmowy: 0. Trafienia to auth, preferencje/UI, artefakty/canvas i testy | bez zmiany produktu | Nie wolno utożsamiać mianownika grep z zapisem transkryptu |

## CHAT-OWN-003 — gałęzie

| Pomiar | PRZED (marker) | PO | Decyzja |
| --- | --- | --- | --- |
| Backend/model | `POST /api/conversations/:id/branch`, `GET /:id/branches`, `conversation_branches` istnieją | bez zmiany produktu | Mechanika istnieje |
| Osiągalność | POST 201, GET 200, foreign GET 404; SQL zachowuje fork message i nazwę | bez zmiany produktu | Mechanika działa przez realny Gateway |
| Konsument | `UnifiedChatPanel.tsx` montuje `BranchSelector` i woła API; UI pokazuje utworzoną gałąź | bez zmiany produktu | UI pozostaje; usunięcie byłoby regresją |

## CHAT-OWN-015 — głos

| Miejsce | PRZED (marker) | PO / stan |
| --- | --- | --- |
| Czat — Teresa conversation | wspólny `TeresaVoiceContext` + `useTeresaVoice`; jawny stan unavailable/idle/connecting/listening/speaking/error | bez zmiany |
| Czat — dyktowanie | lokalny `SpeechRecognition` w `EnhancedChatInput`; jawny brak API i review/send | bez zmiany |
| Czat — odczyt odpowiedzi | `TeresaTTSPlayer`; widoczny przycisk `Speak` i globalny auto-read | bez zmiany |
| Moja Praca — mapa myśli | własny `SpeechRecognition` w `VoiceToNode.tsx` | `NOT_UNIFIED` |
| Moja Praca — notebook | własny `SpeechRecognition` w `AIChatInlinePanel.tsx` | `NOT_UNIFIED` |
| Moja Praca — tabela | własny `SpeechRecognition` w `VoiceImageInput.tsx` | `NOT_UNIFIED` |

Decyzja: `STOP MERYTORYCZNY / EVIDENCE_MISSING` dla przebudowy głosu. W wydanej instrukcji nie ma zapowiedzianej §0.3 ani tabeli licencji, a bez niej pliki Mojej Pracy są tylko do odczytu. Czerwony kontrakt: wszystkie produkcyjne wejścia głosowe muszą konsumować jeden kontrakt stanów `unavailable | ready | recording | error`; obecny grep wykazuje trzy niezależne konstruktory `SpeechRecognition` poza Czatem.
