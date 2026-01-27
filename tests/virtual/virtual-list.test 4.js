/**
 * Virtual List Tests
 * Tests for virtualized scrolling patterns
 *
 * @module tests/virtual/virtual-list.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Virtual list
const createVirtualList = (options = {}) => {
  const { itemHeight = 50, containerHeight = 500, overscan = 3 } = options;

  let items = [];
  let scrollTop = 0;

  const getVisibleRange = () => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight)
    );

    return {
      startIndex: Math.max(0, startIndex - overscan),
      endIndex: Math.min(items.length - 1, endIndex + overscan),
    };
  };

  const scrollToIndex = (index) => {
    scrollTop = Math.max(0, index * itemHeight);
  };

  return {
    setItems: (newItems) => {
      items = newItems;
    },
    setScrollTop: (value) => {
      scrollTop = Math.max(0, value);
    },
    getVisibleRange,
    getVisibleItems: () => {
      const { startIndex, endIndex } = getVisibleRange();
      return items.slice(startIndex, endIndex + 1).map((item, i) => ({
        item,
        index: startIndex + i,
        style: {
          position: 'absolute',
          top: (startIndex + i) * itemHeight,
          height: itemHeight,
        },
      }));
    },
    getTotalHeight: () => items.length * itemHeight,
    getItemCount: () => items.length,
    scrollToIndex,
    scrollToItem: (predicate) => {
      const index = items.findIndex(predicate);
      if (index !== -1) {
        scrollToIndex(index);
      }
      return index;
    },
  };
};

// Variable height virtual list
const createVariableList = (options = {}) => {
  const { containerHeight = 500, estimatedHeight = 50 } = options;

  let items = [];
  let heights = new Map();
  let scrollTop = 0;

  const getItemTop = (index) => {
    let top = 0;
    for (let i = 0; i < index; i++) {
      top += heights.get(i) || estimatedHeight;
    }
    return top;
  };

  const getItemHeight = (index) => heights.get(index) || estimatedHeight;

  const getVisibleRange = () => {
    let startIndex = 0;
    let currentTop = 0;

    // Find start index
    while (startIndex < items.length && currentTop + getItemHeight(startIndex) < scrollTop) {
      currentTop += getItemHeight(startIndex);
      startIndex++;
    }

    // Find end index
    let endIndex = startIndex;
    while (endIndex < items.length && currentTop < scrollTop + containerHeight) {
      currentTop += getItemHeight(endIndex);
      endIndex++;
    }

    return { startIndex, endIndex: Math.min(endIndex, items.length - 1) };
  };

  return {
    setItems: (newItems) => {
      items = newItems;
    },

    setItemHeight: (index, height) => {
      heights.set(index, height);
    },

    setScrollTop: (value) => {
      scrollTop = Math.max(0, value);
    },

    getVisibleRange,

    getVisibleItems: () => {
      const { startIndex, endIndex } = getVisibleRange();
      const result = [];

      for (let i = startIndex; i <= endIndex; i++) {
        result.push({
          item: items[i],
          index: i,
          style: {
            position: 'absolute',
            top: getItemTop(i),
            height: getItemHeight(i),
          },
        });
      }

      return result;
    },

    getTotalHeight: () => {
      let total = 0;
      for (let i = 0; i < items.length; i++) {
        total += getItemHeight(i);
      }
      return total;
    },
  };
};

// Infinite scroll
const createInfiniteScroll = (options = {}) => {
  const { threshold = 100, pageSize = 20 } = options;

  let items = [];
  let loading = false;
  let hasMore = true;
  let page = 0;

  return {
    getItems: () => items,

    isLoading: () => loading,

    hasMoreItems: () => hasMore,

    handleScroll: async (scrollTop, scrollHeight, clientHeight, loadMore) => {
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom < threshold && !loading && hasMore) {
        loading = true;
        page++;

        try {
          const newItems = await loadMore(page, pageSize);

          if (newItems.length < pageSize) {
            hasMore = false;
          }

          items = [...items, ...newItems];
        } finally {
          loading = false;
        }
      }
    },

    reset: () => {
      items = [];
      loading = false;
      hasMore = true;
      page = 0;
    },

    getPage: () => page,
  };
};

// Windowing with grid
const createVirtualGrid = (options = {}) => {
  const {
    cellWidth = 100,
    cellHeight = 100,
    containerWidth = 500,
    containerHeight = 500,
    gap = 10,
  } = options;

  let items = [];
  let scrollTop = 0;
  let scrollLeft = 0;

  const getColumnsCount = () => Math.floor((containerWidth + gap) / (cellWidth + gap));

  return {
    setItems: (newItems) => {
      items = newItems;
    },

    setScroll: (top, left) => {
      scrollTop = Math.max(0, top);
      scrollLeft = Math.max(0, left);
    },

    getVisibleCells: () => {
      const columns = getColumnsCount();
      const rows = Math.ceil(items.length / columns);

      const startRow = Math.floor(scrollTop / (cellHeight + gap));
      const endRow = Math.min(
        rows - 1,
        Math.ceil((scrollTop + containerHeight) / (cellHeight + gap))
      );

      const startCol = Math.floor(scrollLeft / (cellWidth + gap));
      const endCol = Math.min(
        columns - 1,
        Math.ceil((scrollLeft + containerWidth) / (cellWidth + gap))
      );

      const visible = [];

      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          const index = row * columns + col;
          if (index < items.length) {
            visible.push({
              item: items[index],
              index,
              row,
              col,
              style: {
                position: 'absolute',
                left: col * (cellWidth + gap),
                top: row * (cellHeight + gap),
                width: cellWidth,
                height: cellHeight,
              },
            });
          }
        }
      }

      return visible;
    },

    getTotalSize: () => {
      const columns = getColumnsCount();
      const rows = Math.ceil(items.length / columns);

      return {
        width: columns * (cellWidth + gap) - gap,
        height: rows * (cellHeight + gap) - gap,
      };
    },

    getColumnsCount,
  };
};

describe('Virtual List Tests', () => {
  let list;

  beforeEach(() => {
    list = createVirtualList({ itemHeight: 50, containerHeight: 200, overscan: 2 });
    list.setItems(Array.from({ length: 100 }, (_, i) => ({ id: i })));
  });

  it('should get visible range', () => {
    const { startIndex, endIndex } = list.getVisibleRange();

    expect(startIndex).toBe(0);
    expect(endIndex).toBeLessThan(10);
  });

  it('should update range on scroll', () => {
    list.setScrollTop(200);

    const { startIndex } = list.getVisibleRange();

    expect(startIndex).toBeGreaterThan(0);
  });

  it('should get visible items with styles', () => {
    const items = list.getVisibleItems();

    expect(items[0].style.top).toBe(0);
    expect(items[0].style.height).toBe(50);
  });

  it('should calculate total height', () => {
    expect(list.getTotalHeight()).toBe(5000); // 100 * 50
  });

  it('should scroll to index', () => {
    list.scrollToIndex(50);

    const { startIndex } = list.getVisibleRange();

    expect(startIndex).toBeLessThanOrEqual(50);
  });
});

describe('Variable List Tests', () => {
  let list;

  beforeEach(() => {
    list = createVariableList({ containerHeight: 200, estimatedHeight: 50 });
    list.setItems(Array.from({ length: 20 }, (_, i) => ({ id: i })));
  });

  it('should use estimated height', () => {
    const items = list.getVisibleItems();

    expect(items[0].style.height).toBe(50);
  });

  it('should use measured height', () => {
    list.setItemHeight(0, 100);

    const items = list.getVisibleItems();

    expect(items[0].style.height).toBe(100);
  });
});

describe('Infinite Scroll Tests', () => {
  let scroll;

  beforeEach(() => {
    scroll = createInfiniteScroll({ threshold: 100, pageSize: 10 });
  });

  it('should load more when near bottom', async () => {
    const loadMore = vi.fn().mockResolvedValue(Array(10).fill({}));

    await scroll.handleScroll(400, 500, 100, loadMore);

    expect(loadMore).toHaveBeenCalled();
    expect(scroll.getItems()).toHaveLength(10);
  });

  it('should not load while loading', async () => {
    const loadMore = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return [];
    });

    scroll.handleScroll(400, 500, 100, loadMore);
    scroll.handleScroll(400, 500, 100, loadMore);

    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('should detect no more items', async () => {
    const loadMore = vi.fn().mockResolvedValue(Array(5).fill({}));

    await scroll.handleScroll(400, 500, 100, loadMore);

    expect(scroll.hasMoreItems()).toBe(false);
  });
});

describe('Virtual Grid Tests', () => {
  let grid;

  beforeEach(() => {
    grid = createVirtualGrid({
      cellWidth: 100,
      cellHeight: 100,
      containerWidth: 300,
      containerHeight: 300,
      gap: 10,
    });
    grid.setItems(Array.from({ length: 50 }, (_, i) => ({ id: i })));
  });

  it('should calculate columns', () => {
    expect(grid.getColumnsCount()).toBe(2);
  });

  it('should get visible cells', () => {
    const cells = grid.getVisibleCells();

    expect(cells.length).toBeGreaterThan(0);
    expect(cells[0].row).toBe(0);
    expect(cells[0].col).toBe(0);
  });

  it('should calculate total size', () => {
    const size = grid.getTotalSize();

    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });
});
