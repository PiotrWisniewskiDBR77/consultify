/**
 * Pagination Tests
 * Tests for pagination utilities
 *
 * @module tests/pagination/pagination-utils.test.js
 */

import { describe, it, expect } from 'vitest';

// Pagination utilities
const paginationUtils = {
  paginate: (items, page = 1, pageSize = 10) => {
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const currentPage = Math.min(Math.max(1, page), totalPages || 1);

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const data = items.slice(startIndex, endIndex);

    return {
      data,
      pagination: {
        currentPage,
        pageSize,
        totalItems,
        totalPages,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
        startIndex: startIndex + 1,
        endIndex: Math.min(endIndex, totalItems),
      },
    };
  },

  getPageNumbers: (currentPage, totalPages, maxVisible = 5) => {
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const half = Math.floor(maxVisible / 2);
    let start = currentPage - half;
    let end = currentPage + half;

    if (start < 1) {
      start = 1;
      end = maxVisible;
    }

    if (end > totalPages) {
      end = totalPages;
      start = totalPages - maxVisible + 1;
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  },

  getCursorPagination: (items, cursor, limit = 10) => {
    let startIndex = 0;

    if (cursor) {
      const cursorIndex = items.findIndex((item) => item.id === cursor);
      startIndex = cursorIndex === -1 ? 0 : cursorIndex + 1;
    }

    const data = items.slice(startIndex, startIndex + limit);
    const nextCursor = data.length === limit ? data[data.length - 1]?.id : null;

    return {
      data,
      nextCursor,
      hasMore: nextCursor !== null,
    };
  },

  getOffsetPagination: (items, offset = 0, limit = 10) => {
    const data = items.slice(offset, offset + limit);

    return {
      data,
      offset,
      limit,
      total: items.length,
      hasMore: offset + limit < items.length,
    };
  },

  buildPaginationLinks: (baseUrl, currentPage, totalPages) => {
    const links = {
      self: `${baseUrl}?page=${currentPage}`,
      first: `${baseUrl}?page=1`,
      last: `${baseUrl}?page=${totalPages}`,
    };

    if (currentPage > 1) {
      links.prev = `${baseUrl}?page=${currentPage - 1}`;
    }

    if (currentPage < totalPages) {
      links.next = `${baseUrl}?page=${currentPage + 1}`;
    }

    return links;
  },

  parsePaginationParams: (query) => {
    const page = Math.max(1, parseInt(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || query.limit) || 10));
    const sort = query.sort || 'id';
    const order = query.order === 'desc' ? 'desc' : 'asc';

    return { page, pageSize, sort, order };
  },

  sortItems: (items, sortField, sortOrder = 'asc') => {
    return [...items].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  },
};

describe('Pagination Utils Tests', () => {
  // Test data
  const items = Array.from({ length: 100 }, (_, i) => ({
    id: `item-${i + 1}`,
    name: `Item ${i + 1}`,
    value: i + 1,
  }));

  // ═══════════════════════════════════════════════════════════════════
  // PAGINATE
  // ═══════════════════════════════════════════════════════════════════

  describe('paginate', () => {
    it('should return first page', () => {
      const result = paginationUtils.paginate(items, 1, 10);

      expect(result.data.length).toBe(10);
      expect(result.data[0].id).toBe('item-1');
      expect(result.pagination.currentPage).toBe(1);
    });

    it('should return correct page', () => {
      const result = paginationUtils.paginate(items, 3, 10);

      expect(result.data[0].id).toBe('item-21');
      expect(result.pagination.currentPage).toBe(3);
    });

    it('should calculate total pages', () => {
      const result = paginationUtils.paginate(items, 1, 10);

      expect(result.pagination.totalPages).toBe(10);
    });

    it('should set hasNext and hasPrev', () => {
      const first = paginationUtils.paginate(items, 1, 10);
      const middle = paginationUtils.paginate(items, 5, 10);
      const last = paginationUtils.paginate(items, 10, 10);

      expect(first.pagination.hasPrev).toBe(false);
      expect(first.pagination.hasNext).toBe(true);

      expect(middle.pagination.hasPrev).toBe(true);
      expect(middle.pagination.hasNext).toBe(true);

      expect(last.pagination.hasPrev).toBe(true);
      expect(last.pagination.hasNext).toBe(false);
    });

    it('should handle out of range page', () => {
      const result = paginationUtils.paginate(items, 100, 10);

      expect(result.pagination.currentPage).toBe(10);
    });

    it('should handle empty array', () => {
      const result = paginationUtils.paginate([], 1, 10);

      expect(result.data).toEqual([]);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET PAGE NUMBERS
  // ═══════════════════════════════════════════════════════════════════

  describe('getPageNumbers', () => {
    it('should return all pages when less than max', () => {
      const pages = paginationUtils.getPageNumbers(1, 3, 5);

      expect(pages).toEqual([1, 2, 3]);
    });

    it('should return visible range at start', () => {
      const pages = paginationUtils.getPageNumbers(1, 10, 5);

      expect(pages).toEqual([1, 2, 3, 4, 5]);
    });

    it('should return visible range in middle', () => {
      const pages = paginationUtils.getPageNumbers(5, 10, 5);

      expect(pages).toEqual([3, 4, 5, 6, 7]);
    });

    it('should return visible range at end', () => {
      const pages = paginationUtils.getPageNumbers(10, 10, 5);

      expect(pages).toEqual([6, 7, 8, 9, 10]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CURSOR PAGINATION
  // ═══════════════════════════════════════════════════════════════════

  describe('getCursorPagination', () => {
    it('should return first page without cursor', () => {
      const result = paginationUtils.getCursorPagination(items, null, 10);

      expect(result.data.length).toBe(10);
      expect(result.data[0].id).toBe('item-1');
    });

    it('should return next page with cursor', () => {
      const result = paginationUtils.getCursorPagination(items, 'item-10', 10);

      expect(result.data[0].id).toBe('item-11');
    });

    it('should set nextCursor', () => {
      const result = paginationUtils.getCursorPagination(items, null, 10);

      expect(result.nextCursor).toBe('item-10');
      expect(result.hasMore).toBe(true);
    });

    it('should return null cursor on last page', () => {
      const result = paginationUtils.getCursorPagination(items, 'item-95', 10);

      expect(result.nextCursor).toBeNull();
      expect(result.hasMore).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // OFFSET PAGINATION
  // ═══════════════════════════════════════════════════════════════════

  describe('getOffsetPagination', () => {
    it('should return from offset', () => {
      const result = paginationUtils.getOffsetPagination(items, 20, 10);

      expect(result.data[0].id).toBe('item-21');
      expect(result.offset).toBe(20);
    });

    it('should indicate hasMore', () => {
      const result1 = paginationUtils.getOffsetPagination(items, 0, 10);
      const result2 = paginationUtils.getOffsetPagination(items, 95, 10);

      expect(result1.hasMore).toBe(true);
      expect(result2.hasMore).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // BUILD PAGINATION LINKS
  // ═══════════════════════════════════════════════════════════════════

  describe('buildPaginationLinks', () => {
    it('should build all links', () => {
      const links = paginationUtils.buildPaginationLinks('/api/items', 5, 10);

      expect(links.self).toBe('/api/items?page=5');
      expect(links.first).toBe('/api/items?page=1');
      expect(links.last).toBe('/api/items?page=10');
      expect(links.prev).toBe('/api/items?page=4');
      expect(links.next).toBe('/api/items?page=6');
    });

    it('should omit prev on first page', () => {
      const links = paginationUtils.buildPaginationLinks('/api/items', 1, 10);

      expect(links.prev).toBeUndefined();
      expect(links.next).toBeDefined();
    });

    it('should omit next on last page', () => {
      const links = paginationUtils.buildPaginationLinks('/api/items', 10, 10);

      expect(links.prev).toBeDefined();
      expect(links.next).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PARSE PAGINATION PARAMS
  // ═══════════════════════════════════════════════════════════════════

  describe('parsePaginationParams', () => {
    it('should parse query params', () => {
      const result = paginationUtils.parsePaginationParams({
        page: '3',
        pageSize: '20',
        sort: 'name',
        order: 'desc',
      });

      expect(result).toEqual({
        page: 3,
        pageSize: 20,
        sort: 'name',
        order: 'desc',
      });
    });

    it('should use defaults', () => {
      const result = paginationUtils.parsePaginationParams({});

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('should enforce limits', () => {
      const result = paginationUtils.parsePaginationParams({
        page: '-5',
        pageSize: '500',
      });

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SORT ITEMS
  // ═══════════════════════════════════════════════════════════════════

  describe('sortItems', () => {
    it('should sort ascending', () => {
      const data = [{ n: 3 }, { n: 1 }, { n: 2 }];
      const sorted = paginationUtils.sortItems(data, 'n', 'asc');

      expect(sorted.map((i) => i.n)).toEqual([1, 2, 3]);
    });

    it('should sort descending', () => {
      const data = [{ n: 3 }, { n: 1 }, { n: 2 }];
      const sorted = paginationUtils.sortItems(data, 'n', 'desc');

      expect(sorted.map((i) => i.n)).toEqual([3, 2, 1]);
    });

    it('should not mutate original', () => {
      const data = [{ n: 3 }, { n: 1 }];
      paginationUtils.sortItems(data, 'n');

      expect(data[0].n).toBe(3);
    });
  });
});
