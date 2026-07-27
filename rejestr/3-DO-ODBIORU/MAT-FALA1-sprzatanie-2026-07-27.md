# MAT-FALA1 — Sprzątanie po inwentaryzacji: jedno wejście per format, szablony do kanonu

- **Stan:** DO ODBIORU (2026-07-27 ~6:00)
- **Demo:** `33662cace7`, tag `demo-safe-2026-07-27-fala1-sprzatanie`. Deploy SUCCESS, health 200,
  gitSha potwierdzony na żywo.
- **Podstawa:** `_INWENTARZ_GENERATORY_3_FORMATY_2026-07-27.md` (inwentaryzacja 3 formatów na
  zlecenie Piotra „nie budujmy zbudowanego").

## Co klikać (2 minuty)
1. **Stare wejścia przekierowują do kanonów**: wpisz ręcznie `/presentations/wizard` → ląduje
   w Architekcie szablonów / Prezentacjach (wg parametrów); `/presentation-studio` → ląduje
   w Materiałach. Zero martwych ekranów.
2. **Arkusze mówią prawdę** ⚠️ *poproszę o rzut oka — patrz „luka weryfikacji" niżej*:
   Materiały → Arkusze → kolumna TYP powinna pokazywać DWIE różne etykiety:
   „Arkusz (model)" (prawdziwe workbooki z formułami — jest ich 6) vs „Arkusz (eksport tabeli)"
   (płaskie eksporty z Table Studio — jest ich ~61). Dotąd wszystko wyglądało tak samo.
3. **Nowy szablon dokumentu z Biblioteki** trafia do rejestru kanonicznego (niewidoczna
   mechanika — dowód testami; jeśli utworzysz szablon, będzie normalnie widoczny i używalny).

## Mechanika niewidoczna (dowody testami, 35/35 zielonych)
- Dokument nie może już „powstać i zniknąć": retry rejestracji + głośny błąd w logach +
  NOWA siatka bezpieczeństwa backfill dla dokumentów Document Studio (realna dziura — dotąd
  dokumenty DS nie miały żadnej rekoncyliacji).
- Kickoff do Teresy nie ginie na /prezentacje, /excele, /tabele (pułapka pod przyszłe przyciski
  „Stwórz z X" — naprawiona zawczasu).
- Deep-linki edycji/klonowania szablonów prezentacji → kanoniczny Architekt (zamyka też starą
  lukę klienckiego resolvera z Wizarda).

## ⚠️ Luka weryfikacji (jawnie)
Etykiety arkuszy (pkt 2) NIE zostały obejrzane moimi oczami na żywych danych — wymaga to
zalogowania na demo (nie mam poświadczeń), a rozróżnienie widać tylko na realnych rekordach
trolley. Mapowanie pokryte 6 testami jednostkowymi; zmiana = tekst w istniejącej kolumnie.
Proszę o 10 sekund przy porannym klik-teście.

## Następne kroki fali (już w toku / w kolejce)
- Kasacja martwych plików wg `_SPIS_MARTWYCH_DO_KASACJI_2026-07-27.md` (8×KASUJ ze świeżymi
  dowodami; 1 pozycja ZOSTAW — okazała się żywa, używa jej główny czat).
- Koncept unifikacji silników dokumentów (Document Studio wchłania zdolności Report Buildera) —
  czeka na skinienie Piotra.
