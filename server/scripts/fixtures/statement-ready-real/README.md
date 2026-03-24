# Real Corpus Intake

Umieszczaj tutaj zanonimizowane fixture'y do certyfikacji jakości importu.

Zasady:
- każdy plik fixture musi mieć usunięte dane wrażliwe i nazwy klientów,
- `text` ma odzwierciedlać realny layout po redakcji, nie syntetyczny skrót,
- każdy przypadek musi mieć odpowiadający wpis w `server/scripts/fixtures/statement-ready-corpus.real.json`,
- release gate dla produkcyjnej wiarygodności powinien używać tego katalogu przez `--fixturesDir=server/scripts/fixtures/statement-ready-real`.
