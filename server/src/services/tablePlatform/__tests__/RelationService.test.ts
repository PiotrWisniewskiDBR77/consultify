import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const mockLogEvent = vi.fn();
vi.mock('../AuditService.js', () => ({
  default: { logEvent: (...args: unknown[]) => mockLogEvent(...args) },
}));

import relationService from '../RelationService.js';

const FROM_RECORD = 'rec-from';
const TO_RECORD_1 = 'rec-to-1';
const TO_RECORD_2 = 'rec-to-2';
const LINK_FIELD = 'field-link';
const BACKLINK_FIELD = 'field-backlink';
const SOURCE_TABLE = 'tbl-source';

describe('RelationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogEvent.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue({ rows: [] });
  });

  describe('linkRecords — creates tp_record_links entries', () => {
    it('inserts a link row and recomputes both sides when no backlink field exists', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ field_type: 'linkedRecord', options: {} }] }) // getFieldOptions
        .mockResolvedValueOnce({ rows: [{ table_id: SOURCE_TABLE }] }) // source record lookup
        .mockResolvedValueOnce({ rows: [] }) // INSERT tp_record_links (forward)
        .mockResolvedValueOnce({ rows: [{ field_type: 'linkedRecord', options: {} }] }) // findBacklinkFieldId → getFieldOptions
        .mockResolvedValueOnce({ rows: [{ table_id: 'tbl-target' }] }) // findBacklinkFieldId → target record lookup
        .mockResolvedValueOnce({ rows: [] }) // findBacklinkFieldId → backlink search (no result)
        .mockResolvedValueOnce({ rows: [{ id: TO_RECORD_1 }] }) // getLinkedRecords after link
        .mockResolvedValueOnce({ rows: [{ data: {} }] }) // SELECT record for data patch
        .mockResolvedValueOnce({ rows: [] }) // UPDATE tp_records data patch
        .mockResolvedValueOnce({ rows: [] }) // recomputeComputedFields(fromRecordId): SELECT record
        .mockResolvedValueOnce({ rows: [] }); // (record not found short-circuits recompute)

      await relationService.linkRecords(FROM_RECORD, LINK_FIELD, [TO_RECORD_1]);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tp_record_links'),
        [FROM_RECORD, LINK_FIELD, TO_RECORD_1]
      );
    });

    it('also inserts the reverse link row when a backlink field is found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ field_type: 'linkedRecord', options: {} }] }) // getFieldOptions
        .mockResolvedValueOnce({ rows: [{ table_id: SOURCE_TABLE }] }) // source record lookup
        .mockResolvedValueOnce({ rows: [] }) // INSERT forward link
        .mockResolvedValueOnce({ rows: [{ field_type: 'linkedRecord', options: {} }] }) // findBacklinkFieldId → getFieldOptions
        .mockResolvedValueOnce({ rows: [{ table_id: 'tbl-target' }] }) // findBacklinkFieldId → target record lookup
        .mockResolvedValueOnce({ rows: [{ id: BACKLINK_FIELD }] }) // findBacklinkFieldId → found
        .mockResolvedValueOnce({ rows: [] }) // INSERT reverse link
        .mockResolvedValueOnce({ rows: [{ id: TO_RECORD_1 }] }) // getLinkedRecords
        .mockResolvedValueOnce({ rows: [{ data: {} }] }) // SELECT record for patch
        .mockResolvedValueOnce({ rows: [] }) // UPDATE patch
        .mockResolvedValueOnce({ rows: [] }); // recomputeComputedFields(fromRecordId) → record not found

      await relationService.linkRecords(FROM_RECORD, LINK_FIELD, [TO_RECORD_1], 'user-1');

      expect(mockQuery).toHaveBeenNthCalledWith(
        7,
        expect.stringContaining('INSERT INTO tp_record_links'),
        [TO_RECORD_1, BACKLINK_FIELD, FROM_RECORD]
      );
    });

    it('logs a link audit event', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ field_type: 'linkedRecord', options: {} }] })
        .mockResolvedValueOnce({ rows: [{ table_id: SOURCE_TABLE }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ field_type: 'linkedRecord', options: {} }] })
        .mockResolvedValueOnce({ rows: [{ table_id: 'tbl-target' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // getLinkedRecords
        .mockResolvedValueOnce({ rows: [] }) // SELECT record for patch → not found
        .mockResolvedValueOnce({ rows: [] }); // recomputeComputedFields → not found

      await relationService.linkRecords(FROM_RECORD, LINK_FIELD, [TO_RECORD_1], 'user-1');

      expect(mockLogEvent).toHaveBeenCalledWith(
        'link',
        'record_link',
        FROM_RECORD,
        'user-1',
        undefined,
        { fromFieldId: LINK_FIELD, toRecordIds: [TO_RECORD_1] },
        undefined
      );
    });

    it('throws when the field is not a linkedRecord field', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ field_type: 'singleLineText', options: {} }] });
      await expect(
        relationService.linkRecords(FROM_RECORD, LINK_FIELD, [TO_RECORD_1])
      ).rejects.toThrow(`Field ${LINK_FIELD} is not a linkedRecord field`);
    });

    it('enforces one-to-one cardinality violation', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ field_type: 'linkedRecord', options: { cardinality: 'one-to-one' } }],
        })
        .mockResolvedValueOnce({ rows: [{ cnt: 1 }] }); // existing link count already 1

      await expect(
        relationService.linkRecords(FROM_RECORD, LINK_FIELD, [TO_RECORD_1, TO_RECORD_2])
      ).rejects.toThrow('Cardinality violation');
    });

    it('enforces one-to-many cardinality violation when target already linked elsewhere', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ field_type: 'linkedRecord', options: { cardinality: 'one-to-many' } }],
        })
        .mockResolvedValueOnce({ rows: [{ cnt: 0 }] }) // existing count check (not used for one-to-many path directly but still queried? no—only for one-to-one)
        .mockResolvedValueOnce({ rows: [{ cnt: 1 }] }); // reverse count: target already linked from another record

      await expect(
        relationService.linkRecords(FROM_RECORD, LINK_FIELD, [TO_RECORD_1])
      ).rejects.toThrow('Cardinality violation');
    });
  });

  describe('unlinkRecords — removes tp_record_links entries', () => {
    it('deletes the forward link row', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ table_id: SOURCE_TABLE }] }) // source record lookup
        .mockResolvedValueOnce({ rows: [] }) // DELETE forward link
        .mockResolvedValueOnce({ rows: [{ field_type: 'linkedRecord', options: {} }] }) // findBacklinkFieldId → getFieldOptions
        .mockResolvedValueOnce({ rows: [{ table_id: 'tbl-target' }] }) // findBacklinkFieldId → target lookup
        .mockResolvedValueOnce({ rows: [] }) // findBacklinkFieldId → no backlink found
        .mockResolvedValueOnce({ rows: [] }) // getLinkedRecords after unlink
        .mockResolvedValueOnce({ rows: [] }) // SELECT record for patch → not found
        .mockResolvedValueOnce({ rows: [] }); // recomputeComputedFields → not found

      await relationService.unlinkRecords(FROM_RECORD, LINK_FIELD, [TO_RECORD_1]);

      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('DELETE FROM tp_record_links'),
        [FROM_RECORD, LINK_FIELD, TO_RECORD_1]
      );
    });

    it('also deletes the reverse link row when a backlink field is found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ table_id: SOURCE_TABLE }] })
        .mockResolvedValueOnce({ rows: [] }) // DELETE forward
        .mockResolvedValueOnce({ rows: [{ field_type: 'linkedRecord', options: {} }] })
        .mockResolvedValueOnce({ rows: [{ table_id: 'tbl-target' }] })
        .mockResolvedValueOnce({ rows: [{ id: BACKLINK_FIELD }] }) // backlink found
        .mockResolvedValueOnce({ rows: [] }) // DELETE reverse
        .mockResolvedValueOnce({ rows: [] }) // getLinkedRecords
        .mockResolvedValueOnce({ rows: [] }) // SELECT record for patch → not found
        .mockResolvedValueOnce({ rows: [] }); // recomputeComputedFields → not found

      await relationService.unlinkRecords(FROM_RECORD, LINK_FIELD, [TO_RECORD_1]);

      expect(mockQuery).toHaveBeenNthCalledWith(
        6,
        expect.stringContaining('DELETE FROM tp_record_links'),
        [TO_RECORD_1, BACKLINK_FIELD, FROM_RECORD]
      );
    });

    it('logs an unlink audit event', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ table_id: SOURCE_TABLE }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ field_type: 'linkedRecord', options: {} }] })
        .mockResolvedValueOnce({ rows: [{ table_id: 'tbl-target' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await relationService.unlinkRecords(FROM_RECORD, LINK_FIELD, [TO_RECORD_1], 'user-1');

      expect(mockLogEvent).toHaveBeenCalledWith(
        'unlink',
        'record_link',
        FROM_RECORD,
        'user-1',
        undefined,
        { fromFieldId: LINK_FIELD, toRecordIds: [TO_RECORD_1] },
        undefined
      );
    });
  });

  describe('recompute is invoked for both sides after link/unlink', () => {
    it('linkRecords recomputes the from-record and every to-record', async () => {
      // getFieldOptions, source lookup, INSERT link, findBacklinkFieldId(x3), getLinkedRecords, SELECT+UPDATE patch,
      // then recomputeComputedFields(FROM_RECORD): SELECT record, fields query, UPDATE
      // then recomputeComputedFields(TO_RECORD_1): SELECT record, fields query, UPDATE
      mockQuery
        .mockResolvedValueOnce({ rows: [{ field_type: 'linkedRecord', options: {} }] }) // getFieldOptions
        .mockResolvedValueOnce({ rows: [{ table_id: SOURCE_TABLE }] }) // source lookup
        .mockResolvedValueOnce({ rows: [] }) // INSERT link
        .mockResolvedValueOnce({ rows: [{ field_type: 'linkedRecord', options: {} }] }) // findBacklinkFieldId → getFieldOptions
        .mockResolvedValueOnce({ rows: [{ table_id: 'tbl-target' }] }) // findBacklinkFieldId → target lookup
        .mockResolvedValueOnce({ rows: [] }) // findBacklinkFieldId → none found
        .mockResolvedValueOnce({ rows: [{ id: TO_RECORD_1 }] }) // getLinkedRecords
        .mockResolvedValueOnce({ rows: [{ data: {} }] }) // SELECT record for patch
        .mockResolvedValueOnce({ rows: [] }) // UPDATE patch
        // recomputeComputedFields(FROM_RECORD)
        .mockResolvedValueOnce({ rows: [{ table_id: SOURCE_TABLE, data: {} }] }) // SELECT record
        .mockResolvedValueOnce({ rows: [] }) // fields query (count/lookup/rollup) → none
        .mockResolvedValueOnce({ rows: [] }) // UPDATE tp_records
        // recomputeComputedFields(TO_RECORD_1)
        .mockResolvedValueOnce({ rows: [{ table_id: 'tbl-target', data: {} }] }) // SELECT record
        .mockResolvedValueOnce({ rows: [] }) // fields query
        .mockResolvedValueOnce({ rows: [] }); // UPDATE tp_records

      await relationService.linkRecords(FROM_RECORD, LINK_FIELD, [TO_RECORD_1]);

      // Two UPDATE tp_records calls after the initial data patch, one per recompute call
      const updateCalls = mockQuery.mock.calls.filter(
        ([sql]) => typeof sql === 'string' && sql.includes('UPDATE tp_records SET data')
      );
      expect(updateCalls.length).toBe(3); // 1 link-patch + 2 recomputes (from + to)
    });
  });

  describe('findBacklinkFieldId', () => {
    it('returns the reverseFieldId directly when set on field options', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ field_type: 'linkedRecord', options: { reverseFieldId: BACKLINK_FIELD } }],
      });
      const result = await relationService.findBacklinkFieldId(
        LINK_FIELD,
        SOURCE_TABLE,
        TO_RECORD_1
      );
      expect(result).toBe(BACKLINK_FIELD);
      expect(mockQuery).toHaveBeenCalledTimes(1); // short-circuits, no further lookup
    });

    it('searches for a reciprocal linkedRecord field when reverseFieldId is unset', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ field_type: 'linkedRecord', options: {} }] }) // getFieldOptions
        .mockResolvedValueOnce({ rows: [{ table_id: 'tbl-target' }] }) // target record lookup
        .mockResolvedValueOnce({ rows: [{ id: 'found-backlink' }] }); // search result

      const result = await relationService.findBacklinkFieldId(
        LINK_FIELD,
        SOURCE_TABLE,
        TO_RECORD_1
      );
      expect(result).toBe('found-backlink');
    });

    it('returns null when the field itself does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await relationService.findBacklinkFieldId(
        'missing-field',
        SOURCE_TABLE,
        TO_RECORD_1
      );
      expect(result).toBeNull();
    });

    it('returns null when the target record does not exist', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ field_type: 'linkedRecord', options: {} }] })
        .mockResolvedValueOnce({ rows: [] }); // target record lookup → none
      const result = await relationService.findBacklinkFieldId(
        LINK_FIELD,
        SOURCE_TABLE,
        'missing-target'
      );
      expect(result).toBeNull();
    });
  });

  describe('computeCount / computeLookup / computeRollup', () => {
    it('computeCount counts linked rows via the count field linkedFieldId', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ field_type: 'count', options: { linkedFieldId: LINK_FIELD } }],
        })
        .mockResolvedValueOnce({ rows: [{ cnt: 3 }] });
      const result = await relationService.computeCount('rec-1', 'field-count');
      expect(result).toBe(3);
    });

    it('computeCount returns 0 for a non-count field', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ field_type: 'rollup', options: {} }] });
      const result = await relationService.computeCount('rec-1', 'field-x');
      expect(result).toBe(0);
    });

    it('computeLookup returns values from linked records target field', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              field_type: 'lookup',
              options: { linkedFieldId: LINK_FIELD, lookupFieldId: 'target-field' },
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ data: { 'target-field': 'Value A' } }, { data: { 'target-field': 'Value B' } }],
        });
      const result = await relationService.computeLookup('rec-1', 'field-lookup');
      expect(result).toEqual(['Value A', 'Value B']);
    });

    it('computeRollup sums numeric values from linked records', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            {
              field_type: 'rollup',
              options: { linkedFieldId: LINK_FIELD, lookupFieldId: 'amount', aggregation: 'sum' },
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ data: { amount: 10 } }, { data: { amount: 5 } }],
        });
      const result = await relationService.computeRollup('rec-1', 'field-rollup');
      expect(result).toBe(15);
    });
  });

  describe('onRecordDeleted', () => {
    it('deletes all link rows referencing the deleted record and recomputes affected records', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ from_record_id: 'rec-A' }] }) // linksFrom
        .mockResolvedValueOnce({ rows: [{ to_record_id: 'rec-B', from_record_id: 'rec-A' }] }) // linksTo
        .mockResolvedValueOnce({ rows: [] }) // DELETE tp_record_links
        // recomputeComputedFields('rec-A')
        .mockResolvedValueOnce({ rows: [{ table_id: 'tbl-x', data: {} }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        // recomputeComputedFields('rec-B')
        .mockResolvedValueOnce({ rows: [{ table_id: 'tbl-y', data: {} }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await relationService.onRecordDeleted('rec-deleted');

      expect(mockQuery).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('DELETE FROM tp_record_links'),
        ['rec-deleted', 'rec-deleted']
      );
    });
  });
});
