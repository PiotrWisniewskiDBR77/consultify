-- Dopuszcza 'initiative' jako trzeci typ obiektu w systemie załączników z dyżuru 147
-- (server/migrations/20260830_day147_object_attachments.sql).
--
-- KONTEKST: front Inicjatyw (AttachmentsSection.tsx) gubił dodane pliki bez śladu —
-- `URL.createObjectURL` + komunikat sukcesu, zero wywołania API. Silnik załączników
-- obiektowych z dyżuru 147 już istniał i działał (Task/Decision), ale zarówno
-- warstwa serwisu (objectAttachmentService.ts: ALLOWED_TYPES), jak i sama tabela
-- (CHECK object_type IN ('task','decision')) blokowały trzeci typ.
--
-- ADDYTYWNOŚĆ: nie usuwa i nie zawęża nic — wyłącznie POSZERZA istniejący CHECK.
-- Zero wierszy istniejących dziś w object_attachments traci ważność (wszystkie mają
-- object_type IN ('task','decision'), a to wciąż podzbiór nowego zbioru).
--
-- KOLEJNOŚĆ: prefiks daty 20260901 sortuje siebie PO 20260830_day147_object_attachments.sql
-- (producencie tabeli) w fazie DATED runnera migracji — patrz
-- server/scripts/migrationOrdering.ts (`compareMigrationOrder`, klucz `${y}${mo}${d}_${filename}`,
-- porównanie stringowe: "20260901" > "20260830"). Bez tego warunku ALTER TABLE poniżej
-- rzuciłby błąd "relation object_attachments does not exist" na świeżej bazie od zera —
-- to jest dokładnie pułapka z tego programu ("migracja czytająca kolumnę/tabelę dodawaną
-- później alfabetycznie wywraca cały łańcuch").
ALTER TABLE object_attachments
  DROP CONSTRAINT IF EXISTS object_attachments_object_type_check;

ALTER TABLE object_attachments
  ADD CONSTRAINT object_attachments_object_type_check
  CHECK (object_type IN ('task', 'decision', 'initiative'));
