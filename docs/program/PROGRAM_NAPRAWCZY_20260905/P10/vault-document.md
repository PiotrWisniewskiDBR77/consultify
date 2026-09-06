# Dokument sejfu

**PROPOZYCJA — do słowa właściciela.** Zrzut: `evidence/p10-karty-n/vault-document/vault-document-loaded.png`; ponowne wejście do My Work pozostało na ładowaniu.

| sekcja | kontrakt mówi (plik:linia / „brak kontraktu”) | ekran pokazuje (plik:linia + zrzut) | źródło danych (API pole → writer server/src plik:linia / „MARTWE: brak writera”) | rozjazd | waga |
|---|---|---|---|---|---|
| Treść/podgląd dokumentu | brak kontraktu | `views/vault/VaultDocumentPanel.tsx` | document blob/content → trasy vault | sekcja poza kontraktem | blokuje MVP |
| Metadane | brak kontraktu | jw. | document metadata → trasy vault | sekcja poza kontraktem | blokuje MVP |
| Streszczenie | brak kontraktu | jw.; znany placeholder „—” | MARTWE: brak writera `server/src` | pusta na wyrost | blokuje MVP |
