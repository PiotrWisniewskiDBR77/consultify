# CODEX DAY 297 — MARTWE OD KORZENIA — RAPORT STOP

Stan: **STOP CAŁEGO DYŻURU** przed R1.

## Odczyt instrukcji

Instrukcję `INSTRUKCJA_DYZUR_297.md` odczytano w całości (689 linii) bezpośrednio z `github-backup/grafika/m03-20260902` w bare-vaulcie. Dokument miał stan `WYDANY`, marker `984d3658fd` i zasoby: baza `6301`, harness `5272` i `5273`.

## Wynik markera i sanity — dosłownie

```text
MARKER OK
984d3658fd84b91091b0d93381a89eea6cfd0245
```

`git status --short | head -3` nie wypisał żadnej linii.

Tip gałęzi bazowej uciekł do przodu do `4f70f2fca8`; worktree utworzono zgodnie z `DEC-2026-08-26-95` dokładnie z markera.

## STOP — BLOK 0 / wolne miejsce

Rodzaj: MERYTORYCZNY — STOP CAŁEGO DYŻURU.

Powód: Po utworzeniu wymaganego worktree kontrola BLOKU 0 wykazała tylko `1.8Gi` wolnego miejsca, czyli mniej niż bezwarunkowy próg `5 GB` z §0.1 i §0.5.

Licencja, którą sprawdziłem: §0.5: „Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy: […] mniej niż 5 GB wolnego dysku (§0.1 krok 0)”. Wynik bieżącej kontroli po materializacji worktree: `1.8Gi`.

Dowód:

```text
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi   1.8Gi    87%    459k   19M    2%   /
```

Pierwsza kontrola, wykonana przed utworzeniem worktree zgodnie z literalną kolejnością §0.1, pokazała `5.4Gi`. Wymagany worktree zawierający 33 863 pliki zużył margines i ponowna obowiązkowa kontrola z weryfikacji wejścia pokazała `1.8Gi`. Bezpieczniejsza interpretacja nakazuje zastosować próg do aktualnego stanu przed rozpoczęciem R1.

Co dostarczyłem ZAMIAST zmiany: pełny odczyt instrukcji, potwierdzenie `WYDANY`, dowód `MARKER OK`, worktree dokładnie z markera, pomiar rozjazdu tipa, sześć kontroli wejściowych i niniejszy raport. Nie uruchomiono grafu, testów, bazy ani runtime’u; nie zmieniono i nie usunięto kodu produktu.

Co zrobiłbym, gdyby zwolniono miejsce: Powtórzyłbym `df -h /` i kontrole portów. Dopiero przy co najmniej 5 GB wolnego miejsca rozpocząłbym R1, zachowując bazę `6301`, harness `5272/5273` i wszystkie granice licencji.

Rekomendacja dla nadzorcy: Zwolnić miejsce poza cudzymi worktree i wznowić dyżur na istniejącym worktree albo wydać nowy dyżur. Nie adoptować innych katalogów ani nie obniżać progu.

Stan: Zacommitowano wyłącznie raport STOP; zero zmian produktu.

Czy kontynuowałem pozostałe pozycje: NIE — §0.5 nakazuje zatrzymać cały dyżur przy mniej niż 5 GB wolnego miejsca.

## Korekty wobec instrukcji

- Inwentarz ma `267` wierszy zaczynających się od `|`, a nie około `240`; jest to wynik pomiaru, nie powód STOP.
- Pomiar importów dynamicznych dał `499`.
- `InboxTriage` występuje w samym pliku, re-eksporcie i typach API; żywe wywołania kebaba są w `InboxContent.tsx:2859` i `:2946`. Oceny osiągalności nie wykonano z powodu STOP przed R1.
- W `src/components` pomiar nazw `admin`/`Admin` dał `1`.

## Twierdzenia niezweryfikowane

Nie zweryfikowano R1–R6, osiągalności plików, martwych poddrzew, kluczy i18n, bezpiecznika, testów ani pięciu ekranów PRZED/PO. Nie należy interpretować tego raportu jako potwierdzenia lub obalenia tych tez.
