# IDE-021 — Teresa: kontrolka potwierdzenia w czacie + etykiety na płótnie

- **Stan:** DO ODBIORU (2026-07-26)
- **Gałąź/commity:** `integ/standard-weryfikacja-2026-07-26` — `5a213e9cd2` (kontrolka), `20eca1640e` (params/etykiety), `795bfa9d62` (rozdział flagi MINDMAP)
- **ekran:** `teresa-confirm-chip` (dev-render, `?screen=teresa-confirm-chip&lang=pl`)

## Co zostało zrobione
1. **Kontrolka potwierdzenia** — akcje trwałe (`Konwertuj`/`Duplikuj` Ideę) wołane przez Teresę
   dostają w czacie przyciski „Potwierdź"/„Anuluj"; potwierdzenie wykonuje TĘ SAMĄ ścieżkę
   co klik człowieka (`executeTeresaTool` z `confirmed:true`). Przed tą zmianą Teresa fizycznie
   nie mogła wykonać tych akcji (czat nigdy nie wysyłał potwierdzenia — odmowa zapętlona).
2. **Etykiety od AI trafiają do elementów** — `ctx.params` płynie na szynę; nowy element w KAŻDYM
   z 4 narzędzi dostaje treść od modelu zamiast pustej edycji. Dowód żywy (DOM): mapa ✓
   whiteboard ✓ przepływ ✓ tabela ✓.
3. **Rozdział flagi-długu** `ENABLE_TERESA_MINDMAP` → osobna `ENABLE_TERESA_MINDMAP_SEARCH`
   (default OFF, kompatybilność wsteczna OR) — koniec z jedną nazwą o dwóch znaczeniach.

## Dowody (zrobione przeze mnie przed odbiorem — reguła #7)
- Zrzuty light+dark kontrolki (realny `MessageRenderer`, neutralne tokeny, zero crimson).
- Pełny łańcuch Z4 dowiedziony w przeglądarce na 4/4 narzędziach (element przybywa na płótno).
- Testy: `ideaActionRegistryConfirmBeforeRun` 6/6 · `ideaActionRegistryElementAddLabel` 3/3 ·
  `teresaMindmapSearchFlag` 4/4.

## Jak odebrać (klikanie)
1. Otwórz ekran `teresa-confirm-chip` → kliknij „Potwierdź" (log ✔) i odśwież → „Anuluj" (log ✖).
2. Na `mindmap-canvas` nic się nie zmieniło wizualnie (kontrolka żyje tylko w czacie).

## Flagi — decyzja CTO
`ENABLE_TERESA_IDEA_ACTIONS` + `VITE_ENABLE_TERESA_IDEA_ACTIONS` **nadal OFF**. Łańcuch jest
kompletny (model→SSE→wykonanie→potwierdzenia), ale włączenie = decyzja produktowa Piotra
po odbiorze tej kontrolki. Włączenie wymaga PRZEBUDOWY frontu (flaga build-time).
