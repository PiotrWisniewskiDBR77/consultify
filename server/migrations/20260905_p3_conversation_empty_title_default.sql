-- P3 / DEC-397: presentation owns the localized placeholder for untitled chats.
-- Existing titles are preserved; legacy English defaults are handled on read by the client.
ALTER TABLE conversations ALTER COLUMN title SET DEFAULT '';
