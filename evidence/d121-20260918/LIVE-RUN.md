# D-121 — orphaned `interview_evidence` delete-rows (LIVE staging)

**Wpis 178 [D] pt 1** · DEC-673 runbook (delete-rows, NIE fabricate-text, NIE zero-out) · gałąź `qoder/d-d121-interview-evidence-orphans-20260918` od linii `52d5274dde` · delta = evidence (zero kodu produktu).

## Werdykt
Usunięto **DOKŁADNIE 2** osierocone wiersze `interview_evidence` (Northwind, sesja śmieciowa `13c932b0`): `03e3f1d9` (`Answer – Q e563ed82`) i `b140e82d` (`Answer – Q 233ae4ce`). Checksum 13 realnych orgów (poza dotkniętymi wierszami) **PRZED == PO == pass2** = `a48f9b543698b339468a8759f30f7de0`; różnica licznikowa `TOTAL_INCL_TOUCHED` **220 → 218 = dokładnie 2**; **2. przebieg = DELETE 0**.

## KROK 0 — dlaczego „śmieć", nie „realny dowód"
Oba wiersze to lustra `answer_text` (**`evidence_role='answer_text'`**) dwóch śmieciowych pytań Northwind `233ae4ce` + `e563ed82` (`answer_text='asdf asdf qwerty nie wiem 123'`) usuniętych w **D-49-LIVE**. FK `interview_evidence.question_id → interview_questions ON DELETE SET NULL` zostawił je z `question_id=NULL` (sieroty). Treść zerowa: `transcript_text` pusty, `file_name`/`file_path`/`url`/`description` puste, `storage_backend='db'`, `storage_key`/`content_hash` puste. Tytuły wprost osadzają ID usuniętych pytań. To są **dokładnie 2** jedyne wiersze z `question_id IS NULL` w całej tabeli (`ie_orphan_null_q=2`), oba w sesji `13c932b0`, org `468b234c` (Northwind). → kwalifikacja „śmieć" z Wpisu 178 → delete-rows.

## FK pre-flight (Wpis 178 pt 2 — reguła stała, `fk-preflight.sql` / `.txt`)
- **FK wskazujące NA `interview_evidence`: 0** → usunięcie jego wierszy **nie kaskaduje do żadnej innej tabeli**.
- `CASCADE_AFFECTED_ROWS=0` → zbiór „dotkniętych" = **dokładnie 2 kasowane wiersze** (zero modyfikacji SET NULL/CASCADE ubocznie).
- FK **Z** `interview_evidence` (nieuruchamiane przy kasowaniu ie, zapisane dla pełności): `question_id → interview_questions on_delete=n` (SET NULL — to ono osierociło te 2 w D-49-LIVE), `session_id → interview_sessions on_delete=c` (CASCADE).

## Runbook (ta sama dyscyplina co D-49-LIVE / QD3-live)
1. **Pre-dump** (odwracalność): `~/Developer/kopie/staging-pre-d121-20260918.dump` — `pg_dump -Fc`, **251 199 445 B**, `pg_restore -l` TOC **13069** wpisów, exit 0.
2. **Before-images JSONL**: `before-interview_evidence.jsonl` — pełne `row_to_json` 2 wierszy PRZED.
3. **JEDNA transakcja** (`d121-delete.sql`, `apply-run.log`): `BEGIN; DELETE 2; DO … COMMIT`. DELETE kotwiczony na `id IN (2) AND question_id IS NULL AND evidence_role='answer_text' AND session_id='13c932b0…' AND organization_id='468b234c…'`.
4. **Asercje w transakcji** (`DO $do$`, RAISE EXCEPTION = rollback): cele zniknęły (`n_target=0`) ORAZ kolateral nietknięty — `ie_nw=17` (19−2), `ie_session_13c932b0=3` (5−2), `iq_real=128`, `is_real=26`. Wynik: `NOTICE D121_PROVEN: 2 targets gone, collateral intact`.
5. **Checksum chirurgiczny** (`checksum.sql`): md5 po 13 realnych orgach (`id NOT LIKE 'ateliertoys-demo-session-%'`) z WYKLUCZENIEM 2 dotkniętych wierszy, dodatkowo `interview_questions`/`interview_sessions` całe (nietknięte) → odcisk self-contained.

## Dowód PRZED / PO

| miara | PRZED | PO | pass2 |
|---|---|---|---|
| `ORG_COUNT` (realne) | 13 | 13 | 13 |
| `CHECKSUM` (md5 real-orgs excl touched) | `a48f9b54…7de0` | `a48f9b54…7de0` | `a48f9b54…7de0` |
| `TOTAL_INCL_TOUCHED` (ie+iq+is real) | 220 | **218** | 218 |
| `ie real_excl_touched` | 64 | 64 | 64 |
| `iq real` / `is real` | 128 / 26 | 128 / 26 | 128 / 26 |
| `ie_total` | 66 | **64** | — |
| `ie_northwind` (468b234c) | 19 | **17** | 17 |
| `ie_session_13c932b0` | 5 | **3** | 3 |
| `ie_orphan_null_q` | 2 | **0** | 0 |

Jedyna różnica PRZED↔PO w `checksum-*.txt` = `TOTAL_INCL_TOUCHED 220→218`; md5 **identyczny** → nic poza 2 skasowanymi wierszami się nie zmieniło.

## Idempotencja
`pass2-idempotency.log`: ponowne uruchomienie `d121-delete.sql` → `DELETE 0` (cele już zniknęły, WHERE kotwiczony na wartościach), `D121_PROVEN` nadal zielony, `COMMIT`. Checksum pass2 = `218 / a48f9b54…7de0` (bez zmian).

## DEC-607 (znaleziska poza zleceniem — JEDNO zdanie, ZERO naprawy)
Sesja śmieciowa `13c932b0` (Northwind) nadal ma 3 wiersze `interview_evidence` z `question_id` wskazującym na ocalałe pytania oraz pozostałe pytania/sesję — poza zakresem D-121 (Wpis 178 wymienia wyłącznie 2 sieroty `03e3f1d9`/`b140e82d`), nie ruszone.
