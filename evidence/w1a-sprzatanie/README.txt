Dowody sprzatania organizacji na stagingu — zadanie 1-A (dyzur w1a-sprzatanie-20260910).

Pliki tutaj:
- pomiar-organizacje-przed-2026-09-10.psv — pelny pomiar 23 organizacji PRZED operacja
  (id|name|created_at|czlonkow|emaile), z zywej bazy stagingu (thomas.proxy.rlwy.net).
- dry-run-log-2026-09-10.txt — pelne wyjscie `usun-organizacje.ts --dry-run`.
- dry-run-per-tabela-*.csv, dry-run-per-organizacja-*.csv — CSV z dry-run (kopia;
  oryginaly zapisuje skrypt w evidence/dane-pokazowe-en/, katalog wpisany na sztywno
  w KATALOG_DOWODOW skryptu usun-organizacje.ts).
- apply-log-2026-09-10.txt — pelne wyjscie `--apply` (usunieto 15 organizacji, 3104
  wiersze jawnie policzone; kaskada zdjela dodatkowo wiersze z tabel bez wskaznika
  na organizacje).
- verify-log-2026-09-10.txt — pelne wyjscie `--verify` PO operacji: 0 organizacji
  z listy w bazie, 0 wierszy nalezacych do listy. Czysto.

Poza repo (za duze / wrazliwe):
- Zrzut PRZED operacja: ~/Developer/consultify-dumps/staging-thomas-przed-w1a-20260910-1307.dump
  (236 144 989 B, zweryfikowany dwoma odczytami rozmiaru w odstepie 20 s + pg_restore --list OK,
  12 722 wpisow TOC).
- Manifest rollbacku (do --rollback=): ~/Developer/consultify-dumps/manifesty/
  usun-organizacje-2026-09-10T11-15-40-895Z-manifest.json (rowniez kopia w
  evidence/dane-pokazowe-en/ na tym worktree — manifest jest za duzy i za bogaty
  w dane osobowe seedu demo, zeby wchodzil do gita).
