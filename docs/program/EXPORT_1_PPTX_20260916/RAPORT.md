# EXPORT-1 — etap PPTX

Implementacja rozszerza istniejący `UnifiedExportService` o `exportBoardDeckPptx`. Osiem ról layoutu odpowiada zaakceptowanemu `deck-board.pptx`: `cover`, `agenda`, `section`, `content-one`, `content-two`, `table`, `chart`, `decision`.

## Kontrakt i kompatybilność

- Dotychczasowe `renderPptx` i `exportPptx` pozostają zgodne dla pięciu żywych wołaczy usługi.
- Nowy renderer jest szczegółem formatu pod `server/src/services/export/pptx/`; publiczną granicą pozostaje `UnifiedExportService`.
- Tabela i wykres są natywnymi, edytowalnymi obiektami OOXML.
- Deck zapisuje motyw Aptos/Aptos Display, a runy nie zawierają literalnych nazw fontów.
- Stopka łączy Consultify, nazwę klienta i poufność; okładka wskazuje Consultify · DBR77 i miejsce na logo klienta.
- Kolor `85182F` nie występuje. `B42318` pozostaje zarezerwowane dla semantycznego ryzyka.
- Renderer usuwa wyłącznie nadmiarowe wpisy masterów, które `pptxgenjs@4.0.1` dodaje do `[Content_Types].xml` bez odpowiadających im części. Kontrola integralności kończy się `finding_count=0`.

## Dowód renderera bez Aptos

Maszyna dowodowa nie ma Aptos: `fc-list | rg -i Aptos` zwraca pusty wynik, a `fc-match Aptos` wskazuje `Verdana.ttf`. Zrzut `northwind-board-deck-slide-8.png` jest więc dowodem realnej substytucji renderera bez osadzania fontu. Substytucja nie zmienia kontraktu OOXML: motyw nadal wskazuje Aptos, a runy są theme-driven.

## Walidacja

- test jednostkowy sprawdza 8 slajdów i 8 nazw layoutów;
- sprawdza motyw Aptos i brak `typeface` w runach slajdów;
- sprawdza natywną tabelę, natywny wykres oraz co-branding stopki;
- render wszystkich slajdów jest kontrolowany wizualnie, a slajd decyzji trafia do odbioru właściciela.
- `parity.json`: `PASS` dla 8 slajdów, 1 layoutu OOXML, 1 mastera, 1 wykresu, 1 tabeli, zaakceptowanej palety, Aptos theme, theme-driven runs, co-brandingu i braku `85182F`;
- `slides_test.py`: PASS, brak overflow;
- `inspect_presentation_package_integrity.py --fail-on-findings`: PASS, 8 slajdów, 1 wykres, 0 ustaleń;
- `northwind-board-deck.pptx`: 190 641 B, SHA-256 `132fdbc2ae2bc92d4e4341361a1a83de5f62dea5b47787523f867cd4c88662f4`;
- `northwind-board-deck-slide-8.png`: 66 223 B, SHA-256 `8efad90fa35cdf4fedecfaa97a9ccc1e9c445ce82df3234a2fd1206d8002d73d`.

Receipt W116 na bazie `cbad80887ce5969f37a38f9ce79e67c6f33844fd`:

- backend `tsc --noEmit`: **0** błędów;
- root/frontend `npm run type-check`: **169** błędów istniejącego baseline, bez delty w plikach toru B;
- delta testów backend: **+1 plik / +3 testy**, 3/3 PASS;
- delta testów frontend: **0 plików / 0 testów** (paczka nie dotyka frontendu);
- ESLint dla czterech zmienionych plików TypeScript: PASS;
- hook commita: TERESA 19/19, crimson ratchet, etykiety, gęstość i bramka językowa PASS.
