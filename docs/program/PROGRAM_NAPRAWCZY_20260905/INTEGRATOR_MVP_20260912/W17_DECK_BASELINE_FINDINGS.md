# W17 — pierwszy pomiar regresji zapisu prezentacji

Kandydat df75f05c201a26eb614c588a54b251bf9cce8ed7. Root wykonał istniejący DeckBuilder.restoreNoWrite.test.tsx, bez DB/API/live i bez zmian produktu. To rzeczywisty render komponentu z mockowanymi serwisami i elementami powłoki, nie dowód browser/Gateway/PG ani plików.

Baseline zatrzymał import: react-i18next mock nie eksportował initReactI18next (0tests). Root dodał wyłącznie adapter testu. Następny run wykonał5/5 i wszystkieFAIL:4asercjeautosave plus nieaktualny testemerytowanegoTeresa button. Root zamienił ten ostatni na wywołanie rzeczywistego handlera zarejestrowanego przez DeckBuilder w sharedchatModuleIntent, bez przywracania drugiego panelu. Ostatni pełnyrunW17_DECK_CURRENT_BRIDGE.log:5/5 wykonane,5FAIL asercji, exit1.

Osobny readonlyreopen test uruchomiony samodzielnie równieżFAIL: jedenPUT /autosave z X-Deck-Version7 i całą wczytaną talią, mimo braku edycji. LogW17_DECK_REOPEN_ISOLATED.log. Pozostałe cztery przypadki wymagają rozdzielenia następstw początkowego niezamówionego zapisu od własnych przyczyn: restore bezwrite, następnyedit po restore, acceptedAI bezwrite, undo podczasinflight.

Źródło: DeckBuilder.tsx835–937 tworzy deckForAutosave dla wczytanego decka, po hasLoadedInitialRef ustawia timer800ms bez porównania z persistedbaseline i bez bramki in-flight. Loader746 setDeck(loaded), restore i accept również setDeck. Aktualny builder nie korzysta z dawnego useDeckAutosave; komentarztestu zaktualizowany do currentwiring. To kandydat rzeczywistej regresji komponentu, do niezależnej klasyfikacji przez scope i późniejszego realUI/PG.

Żadnych asercji nieusunięto i żaden próg nie został rozluźniony. TestowyDIFF rootWIP czeka na source review. Nie zmieniono autozapisu produktu. Scope dostał W17_DECK_BASELINE_REVIEW.md do przygotowania; następny codingpacket ma zachować istniejące CAS/conflict/errorUI/history i jeden writer, nie ożywiać starego chatu. Wszystkie30scenariuszyW17 i pełny mianownikprzycisków pozostają otwarte.
