---
id: IDE-022
tytul: Przeklikanie i naprawa Whiteboard+Tabela (7 błędów) — 2026-07-26
obszar: IDE
stan: do-odbioru
ekran: whiteboard-workshop
klik: "Otwórz ekran → w prawym rogu URL dopisz &ff_whiteboardSessionInPanel=1 dla podglądu Session Layer w prawym panelu (domyślnie flaga OFF, patrz sekcja Flagi)."
wysokosc: 900
---

# IDE-022 — Autonomiczne przeklikanie narzędzia Tabela + naprawa 7 błędów Whiteboard/Tabela

- **Stan:** DO ODBIORU (2026-07-26)
- **Gałąź/commity:** `integ/whiteboard-table-fixes-2026-07-26` — 6 commitów naprawczych + integracja

## Co się wydarzyło
Na Twoją prośbę przeklikałem autonomicznie narzędzie Tabela (harness z realnym komponentem,
nie makieta) — znalazłem 1 poważny błąd. Dodałeś do tego 8 uwag z testowania Whiteboardu na
żywym demo — po zweryfikowaniu każdej od zera: 6 było realnymi błędami, 2 okazały się
fałszywymi alarmami (galeria szablonów działała poprawnie w obu narzędziach — mój mock danych
w harnessie był „zamrożony" i dawał złudzenie awarii; po naprawieniu mocka wszystko działało).

## Naprawione (7 realnych błędów)

1. **Tabela — widok Timeline to była jednokierunkowa pułapka.** Po wejściu w zakładkę
   „Timeline" żaden przycisk nie wracał do normalnej siatki wierszy. Root cause: jeden globalny
   stan typu widoku dzielony przez wszystkie zakładki — tylko Timeline go ustawiał, żadna inna
   zakładka go nie resetowała. `useTableViews.ts` + `useTablePlatformViews.ts`.
2. **Whiteboard — panel „Session Layer" (Facilitator/Workshop phase) blokował płótno.**
   Przeniesiony z pływającej nakładki do prawego panelu (zakładka Właściwości), za flagą
   `ff_whiteboardSessionInPanel` (**domyślnie OFF** — czeka na Twój ogląd, patrz niżej).
3. **Whiteboard — Scenes (View 1/View 2) nie przełączały widoku.** Root cause: literówka
   architektoniczna — kod szukał `.react-flow` wśród PRZODKÓW elementu (`.closest()`), a
   `.react-flow` jest jego DZIECKIEM. Jedna linijka naprawy, potwierdzone dwoma różnymi
   zapisanymi widokami realnie przełączającymi płótno.
4. **Whiteboard — prawy klik pokazywał menu przeglądarki zamiast aplikacji.** Dwie przyczyny:
   panel Session Layer zasłaniał płótno (naprawione przez punkt 2) + osobny brak obsługi w
   warstwie rysowania (tryb Draw) — dodane.
5. **Whiteboard — pigułka „N niepowiązanych elementów" nic nie robiła.** Wołała zły,
   niepowiązany handler (ten sam wzorzec martwych „fallbacków" co inne dziś naprawione rzeczy).
   Teraz klik zaznacza te węzły na płótnie i dopasowuje widok, żeby je pokazać.
6. **Whiteboard — ikony w prawym dolnym rogu (zoom/pełny ekran/minimapa) różnych rozmiarów.**
   Ujednolicone do jednego wspólnego stylu — naprawa jest we wspólnym pliku, więc obejmuje
   automatycznie też Mapę myśli i Process Flow.

## Fałszywe alarmy (zweryfikowane, NIE naprawiane)
- Galeria szablonów w Tabeli — działa poprawnie (6+ szablonów, realna zmiana danych po użyciu).
- Galeria szablonów w Whiteboard — działa poprawnie (6 szablonów, oba wejścia, realna zmiana danych).

## Dowody
- Strażnicy na zintegrowanym drzewie: check-artefakt ✓ (7/7) · check-list-canon --all ✓
  (409/409) · check-actions ✓ (16 akcji).
- Wszystkie 10 tkniętych plików: esbuild czysty.
- Każdy fix miał własny dev-render harness z realnym komponentem (nie makieta) i zrzutami
  przed/po; Session Layer i ikony toolbar zweryfikowane light+dark.

## Flaga wymagająca Twojej decyzji
`ff_whiteboardSessionInPanel` — **domyślnie OFF**. Relokacja panelu Session Layer z płótna do
prawego panelu to zmiana układu, nie prosta poprawka błędu — zgodnie z regułą #7 czeka na Twój
ogląd przed ustawieniem domyślnie ON. Wszystkie funkcje (przełącznik faz warsztatu, głosowanie,
follow-me) działają identycznie w nowym miejscu — do potwierdzenia na oko.

## Otwarte, niezgłoszone dziś (znalezione przy okazji, nie ruszane)
Pierwsza zapisana Scena może złapać domyślny viewport (0,0,zoom 1) zamiast realnego kadru, jeśli
zapisana natychmiast po otwarciu narzędzia — drobna nieszkodliwość, do obserwacji.
