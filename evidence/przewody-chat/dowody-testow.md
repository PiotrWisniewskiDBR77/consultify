# Dowody zachowania i mutacji

Pełne JSON-y Vitest znajdują się poza repo w `/private/tmp/cx-day368-przewody-chat-artefakty/`; komendy miały `RUN_DB_TESTS=0 MOCK_DB=true --retry=0 --reporter=json`.

| Pozycja | GREEN | Mutacja RED | GREEN po przywróceniu |
| --- | --- | --- | --- |
| R1 nawigacja | `r1-green-final.json` | `r1-red-mutation.json`: brak dostępnego przycisku | `r1-green-restored.json` |
| R2 kickoff | `r2-green.json` | `r2-red-mutation.json`: czerwone wyłącznie store `/chat` i MainLayout-style | `r2-green-restored.json` |
| R3 etykieta | `r3-green.json` | `r3-red-mutation.json`: czerwony wyłącznie klik i zmiana etykiety | `r3-green-restored.json` |

SHA-256 końcowego przebiegu PO: `po-przewodyChat.json` = `441c78a0f87b83ef0593b023287e9f85f571fe723741a03834a708e026d9455c`.

Zrzut dev-render: `BLOCKED_AUTH`. Pełny lokalny frontend na porcie 5579 zatrzymał się na czterocyfrowym PIN-ie nieobecnym w instrukcji. Nie zgadywano PIN-u i nie dopisano nieautoryzowanego harnessu w `dev-render/**`.
