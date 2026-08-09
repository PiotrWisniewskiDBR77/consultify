# Kontrakt komend i interakcji

## 1. Command registry

Każda akcja użytkownika musi mieć jeden stabilny `commandId` oraz jeden handler.
Menu 3, menu kontekstowe, kebab, skrót klawiaturowy, command palette i Teresa
mogą być wyłącznie aliasami.

Minimalny kontrakt:

```ts
type ArtifactCommand = {
  commandId: string
  labelKey: string
  canonicalPlacement: 'menu2' | 'menu3' | 'left' | 'bottom' | 'workflow'
  aliases: Array<'context' | 'kebab' | 'keyboard' | 'palette' | 'teresa'>
  selectionPredicate: (selection: SelectionContext) => boolean
  permissionPredicate: (permission: PermissionContext) => boolean
  lifecyclePredicate: (lifecycle: LifecycleContext) => boolean
  priority: 'P0' | 'P1'
  execute: CommandHandler
  undoPolicy: 'none' | 'inverse' | 'restore' | 'confirm'
  auditClass: 'none' | 'revision' | 'governance' | 'share' | 'ai' | 'export'
}
```

Duplikat `commandId`, drugi handler dla aliasu lub funkcja bez recovery jest
błędem kontraktowym.

## 2. Warunek widoczności

Komenda P0 jest widoczna dopiero, gdy posiada:

1. prawdziwy komponent lub wejście UI;
2. handler i service/endpoint, jeżeli potrzebny;
3. persistence oraz semantykę wersji;
4. permission i lifecycle predicate;
5. klasyfikację audytu;
6. undo, confirm albo inne recovery;
7. test kontraktowy i właściwy test runtime.

Brak któregokolwiek pola oznacza `MISSING` i komenda pozostaje ukryta.
`Disabled` jest dopuszczalne tylko dla funkcji istniejącej, czasowo
niedostępnej z jasnym powodem.

## 3. Selection contexts

Wspólne typy wysokiego poziomu:

- `none` / artefakt;
- struktura: sekcja, slajd, arkusz;
- tekst/caret;
- obiekt/blok;
- tabela/wykres/obraz;
- XLSX: cell/range/row/column;
- multi-selection;
- read-only/final/locked;
- conflict/loading/generation.

Adapter formatu mapuje swój model zaznaczenia do wspólnego envelope. Nie wolno
mapować komórki na blok tekstu ani slajdu na sekcję dokumentu w domenowym store.

## 4. Menu 3

- jeden rząd;
- stałe Undo/Redo tylko gdy mają zastosowanie;
- dalej najczęstsze komendy dla aktualnego zaznaczenia;
- rzadkie działania w grupach i `Więcej`;
- bez stałego AI/Teresy;
- bez niedziałających ikon;
- przy mniejszym viewporcie deterministic overflow, nie drugi rząd.

## 5. Menu kontekstowe

Kolejność Office-like:

`Schowek → Edycja/format → Struktura/układ → Komentarz/źródła → Przekaż Teresie → Destructive`

Reguły:

- 8–12 pozycji na pierwszym poziomie;
- pozostałe w podmenu;
- destructive na końcu;
- funkcja krytyczna nie istnieje wyłącznie pod prawym kliknięciem;
- `Shift+F10`/Menu key otwiera menu;
- `Esc` i klik poza zamykają;
- focus wraca do triggera;
- menu korzysta z tych samych predicate i handlerów co Menu 3.

## 6. Interakcje asynchroniczne

Każda operacja asynchroniczna ma stany:

`idle → pending → success | error | conflict | cancelled`

Nie wolno używać fake success, nieskończonego spinnera lub pustego fallbacku.
Generowanie pokazuje kompaktowy, przejściowy status z retry/error. Nie zajmuje
stale canvasu i nie jest mylone z historią wersji.

## 7. Save i konflikt

`Zapisywanie / Zapisano / Błąd zapisu / Konflikt` jest osobne od lifecycle.
Konflikt nie może powodować cichego overwrite. Recovery obejmuje zależnie od
formatu: wczytanie najnowszej, zachowanie kopii, porównanie lub rebase.

## 8. Destructive i restore

- zwykła odwracalna operacja może użyć undo toast;
- usunięcie istotnej treści wymaga confirm albo niezawodnego undo;
- restore zawsze tworzy safety revision i nowy head;
- komentarze zachowują anchory, a brakujące stają się `Detached/Orphaned`;
- historia jest append-only.

## 9. Accessibility

- pełna obsługa klawiatury;
- widoczny focus zgodny z `--c-focus`;
- logiczny tab order i roving focus w menu/listach;
- `Esc` zamyka warstwę i przywraca focus;
- etykiety nie są zastępowane samymi tooltipami;
- status nie opiera się wyłącznie na kolorze;
- krytyczne cele mają co najmniej 44 px efektywnego hit area.
