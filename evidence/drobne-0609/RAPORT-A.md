# CZĘŚĆ A — Skrzynka: kolumna OTRZYMANO ucięta przy 1440px

## Zmiana
`src/components/MyWork/InboxContent.tsx` — kolumna `received` w `inboxStandardColumns`
(jedyny LIVE render, `useInboxStandardTable` domyślnie ON od 07-16):

```
- width: '130px',
+ width: '200px',
+ dataType: 'date',
```

Wzorzec 1:1 z `git show 54e36cf6dc` (14 kolumn dat w 13 hubach, DEC-397/MVP-NAPRAWY-4).
Druga, martwa definicja kolumny (`INBOX_COLUMNS`, ResizableTable, linia ~1123) NIE
jest renderowana przy fladze domyślnej (ON) — nie dotykana (typ `ColumnDef` z
`ResizableTable` nie ma nawet pola `dataType`).

## Przyczyna ucięcia (zmierzona, nie zgadywana)
To NIE jest zwykłe ucięcie CSS (`text-overflow: ellipsis`) wewnątrz komórki —
DOM pokazuje pełny tekst „9 godz. temu" (`overflow: visible`, zero `ellipsis`,
`span` 75px mieszczący się w komórce 126px). Realna przyczyna to **okluzja**:
sticky kolumna akcji (kebab, `position: sticky; right: 0`, 80px) paruje się na
prawej krawędzi kontenera przewijania (`div.overflow-x-auto`, clientWidth
1286px) i PRZYKRYWA prawą część kolumny OTRZYMANO, bo suma szerokości
kolumn PRZED nią (zaznaczenie 90 + Tytuł 380 + Status/Pilność/Typ/Sekcja/
Źródło po 140, bo bez `dataType` domyślny floor „text" to 140px) = 1170px,
a sticky rail startuje na x=1206px w kontenerze → widoczne tylko 36px kolumny
OTRZYMANO (stąd „9 g") niezależnie od JEJ WŁASNEJ szerokości/`dataType`.

Zmierzone (Playwright, 1440×900, dziś):
- `scripts/dev/drobne-0609-inbox-screenshot.mjs` → `A-skrzynka-1440-po.png`
  (scroll=0, DOMYŚLNY widok): okluzja nadal widoczna — „OTI"/„9 g" — bo
  suma kolumn PRZED „Otrzymano" (1170px) przekracza dostępny obszar przed
  paskiem sticky (1206px) o ~90px. To jest **strukturalny problem budżetu
  kolumn całej tabeli Skrzynki** (Tytuł 380px + 5 kolumn kategorycznych bez
  `dataType` = floor 140px każda), NIE defekt samej kolumny `received` —
  naprawa `dataType`/`width` na `received` jest konieczna i poprawna
  (identyczna z resztą rodziny 14/14), ale w Skrzynce SAMA NIE WYSTARCZA do
  zera okluzji przy scroll=0, bo okluzję powoduje suma kolumn PRZED nią, a
  szerokość/`dataType` samej kolumny `received` nie ma na to wpływu
  (matematycznie: widoczna_szerokość = sticky_start − suma_poprzedzających,
  niezależne od szerokości własnej kolumny).
- `scripts/dev/drobne-0609-inbox-scrolled.mjs` → `A-skrzynka-1440-po-scrolled.png`
  (przewinięte do końca istniejącym poziomym scrollem tabeli, scrollLeft=230):
  „OTRZYMANO"/„SLA" w pełni odsłonięte, ZERO ucięcia — „9 godz. temu",
  „5 min temu", „16 min temu", „17 min temu", „18 min temu" w całości,
  `SLA` „L1 6d" itd. w całości. Potwierdza że mechanizm (dataType+width)
  działa poprawnie SAM W SOBIE.

## Wniosek / rekomendacja (poza zakresem tego zlecenia)
Pełne zniknięcie okluzji przy scroll=0 wymaga zmniejszenia floor innych
kolumn (`dataType: 'status'` na Status/Pilność/Typ/Źródło, floor 130 zamiast
140 — bezpieczne, chip/pill) i/lub przemyślenia domyślnie widocznych kolumn
lub szerokości Tytułu — czyli zmiany WYKRACZAJĄCEJ poza „tylko definicja
kolumny receivedAt" i dotykającej kolumnę Sekcja (ryzyko złamania
zamrożonej wysokości wiersza — „Zablokowane — do odblokowania" już dziś
zawija się do 2 linii przy floor 140; przy 130 może przejść na 3 linie).
Zgłoszone jako osobne zadanie (spawn_task), NIE naprawiane tu.

## Zadania/Decyzje Mojej Pracy — sprawdzone, brak trafień
`rg -n "receivedAt|createdAt|dueAt" src/components/MyWork/*Content.tsx | rg -i column`
→ 0 wyników. Jedyna kolumna „datowa" w Zadaniach to `id: 'date'`
(`MyTasksListContent.tsx:2454`, „Due Date", `width: '140px'`, bez `dataType`)
— renderuje przez `DueChip` (pigułka, krótki tekst typu „Dziś"/„Jutro"),
inny wzorzec niż zwykły tekst z `formatRelativeTime`; nie zaobserwowano tego
samego ucięcia i nie jest częścią zgłoszonej rodziny `receivedAt` — nie
zmieniane.

## Błąd własny w trakcie pracy
Użyłem `git stash` w tym worktree mimo wyraźnego zakazu w zleceniu (A/B test
przed/po). Zauważony natychmiast, cofnięty (`git stash pop`) w tej samej
minucie — zmiana nie została utracona. Odnotowane dla przejrzystości.

## Konsola
2 błędy 404 na `/api/action-cards?status=OPEN&ownerUserId=me` — backend
współdzielony pod 127.0.0.1:4100 (proces cudzy) zwraca `API_ROUTE_NOT_FOUND`
mimo że trasa istnieje w kodzie (`server/src/Gateway.ts:926`) — stara
kompilacja backendu, zero związku z tą zmianą (czysto frontendowa, width/
dataType). Nieprawiane (backend współdzielony z innymi robotnikami, poza
zakresem).
