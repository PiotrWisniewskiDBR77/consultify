# J5 — dowód wizualny modułu 05 OCENA (Assessment), EN i PL

Stanowisko: API `127.0.0.1:4197` / Vite `127.0.0.1:3216` / baza
`consultify_kopia_final` (`NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false
DB_TYPE=postgres DB_MANAGED_SCHEMA=off`, Vite `--mode test`), konto
`audyt@dbr77.local`, 1440×900, motyw jasny.
Skrypt: `scripts/dev/jezyk-j5/zrzuty-j5.mjs po <en|pl>`.

> **Port 3216, nie 3215 z instrukcji.** 3215 był w chwili pracy zajęty przez
> Vite innego worktree (`wt/j9-finanse`). Pierwsze przebiegi fotografowały
> CUDZĄ aplikację — dlatego skrypt ma dziś twardą bramkę pochodzenia
> (sprawdza, czy serwer podaje plik tłumaczeń TEGO drzewa) i przerywa, gdy
> trafi na obcy serwer.

## Wynik przyrządu (obce słowa w INTERFEJSIE, bez wiadra DANE)

| | EN (polskie słowa w UI) | PL (angielskie słowa w UI) |
| --- | --: | --: |
| 11 ekranów × 2 języki | **9** | **49** |

Pomiar statyczny (`scripts/i18n/pomiar-jezyka.mjs --modul "05 Assessment"`):

| Kategoria | PRZED | PO |
| --- | --: | --: |
| K1def (polski `defaultValue` w `t()`) | 35 | **0** |
| K1defWID (z tego widoczne na stałe) | 2 | **0** |
| K3a (klucz w PL, brak w EN) | 26 | **0** |
| K3aKLUCZ (EN widzi surowy klucz) | 12 | **0** |
| K4pl (polski hardcode w JSX) | 188 | **0** |
| K4en (angielski hardcode w JSX) | 43 | **5** |
| K7 (daty/liczby bez locale) | 30 | **0** |
| K5pl / K5en (zdania z serwera) | 97 / 76 | 97 / 76 (poza zakresem paczki) |

Raporty surowe: `pomiar-PRZED.txt`, `pomiar-PO.txt`.
Testy: `testy-PRZED.txt`, `testy-PO.txt` — 3 czerwone w obu (ten sam zastany
`server/src/method-core/__tests__/contractMirrorDrift.test.ts`), zero nowych.

## Ekrany (każdy w EN i PL)

01 Lista ocen · 02 Podgląd wiersza · 03 Biblioteka/szablony · 04 Raporty ·
05 Wnioski (Outputy) · 06 Inicjatywy z oceny · 07 Raport zamrożonego Outputu ·
08 Ten sam raport, stopka · 09 Prezentacja Outputu · 10 Sesja DRD ·
11 Modal nowej oceny

## Co zostaje i dlaczego (EN — 9 słów)

* **„Zarząd Grupy"** (3 ekrany) — nazwa z bazy (dane organizacji). Kategoria
  K6 „dane pokazowe", osobna paczka; przyrząd nie miał tej kolumny w wiadrze
  DANE.
* **„Procesy Sprzedaży", „Procesy Jakości", „Zarządzanie Finansami"** (raport,
  3 słowa) — nazwy jednostek zapisane w **zamrożonym Outpucie** i w
  `method_findings.unit_name`. Zamrożony rekord jest z definicji niezmienny;
  warstwa etykiet raportu tłumaczy już nazwy struktury metodyki
  (`drdLabels.ts`), ale nie przepisuje treści zamrożonej.

`limitations` i `scope` tego Outputu też są po polsku — Output zamrożono
05.09, **przed** naprawą serwera. Nowe zamrożenia idą w języku konta; broni
tego test `server/src/method-core/outputs/__tests__/EventDerivedOutputBridge.test.ts`
(trzy przypadki + dowód mutacyjny).

## Co zostaje i dlaczego (PL — 49 słów)

* **„ENAssessment of…" (23 na raporcie)** — opisy osi z korpusu metodyki DRD,
  które istnieją **wyłącznie po angielsku**; dokument oznacza je znacznikiem
  „EN" zamiast udawać tłumaczenie (świadoma decyzja opisana w
  `AssessmentReportDocument.tsx`, komponent `MethodologyProse`).
* **„AREA", „AS 3"** — etykiety macierzy DRD zaakceptowanej przez właściciela.
* **„Advanced Digital Maturity Assessment"** — nazwa własna metodyki ADMA.
* **„Session not found"** — komunikat z modułu 03 Interview i serwera
  (`server/src/controllers/InterviewController.ts`), nie z modułu Oceny.

## Pułapki przyrządu zmierzone po drodze (nie ukryte — naprawione)

1. **Cudzy serwer na porcie z instrukcji** — patrz ramka wyżej.
2. **Język interfejsu przeskakiwał na polski** przy koncie `language='en'`.
   Zmierzone: samo ustawienie `i18nextLng` w magazynie po zalogowaniu, a
   zwłaszcza przeładowania strony w trakcie sesji, wywracały synchronizację
   języka (wyścig bootstrapu opisany w `src/i18n.ts` i
   `services/languagePreference.ts`). Przyrząd ustawia dziś język konta
   **przed** logowaniem i tylko czeka; przebieg, w którym choć jeden zrzut
   wyszedł w złym języku, kończy się kodem 2 i jest powtarzany.
3. **`document.documentElement.lang` kłamie** — pokazywał „pl" na w pełni
   angielskim ekranie. Miarodajny jest klucz detektora i18next.
4. **Cache Vite** podawał starszy plik tłumaczeń niż ten na dysku — stąd
   `--force` przy starcie i bramka pochodzenia w skrypcie.
